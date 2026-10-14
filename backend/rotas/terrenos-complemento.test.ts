import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarComplemento, CAMPOS_EDITAVEIS } from './terrenos-complemento.js';
import esquema from '../../schema.json';

test('CAMPOS_EDITAVEIS bate com as colunas do schema (menos as de identidade)', () => {
  const colunas = Object.keys((esquema as any).tabelas.terrenos_complemento.colunas)
    .filter((c) => c !== 'imovel_nucleo_id' && c !== 'tipo_imovel');
  assert.deepEqual([...CAMPOS_EDITAVEIS].sort(), colunas.sort());
});

test('texto vazio vira null; texto é aparado; chave ausente não entra', () => {
  const r = validarComplemento({ proprietario: '  Fulano ', contato: '   ', zoneamento: undefined });
  assert.ok('dados' in r);
  assert.deepEqual((r as any).dados, { proprietario: 'Fulano', contato: null });
});

test('opção fora da lista é recusada; null limpa', () => {
  const ruim = validarComplemento({ situacao_negociacao: 'vendido' });
  assert.ok('falha' in ruim && ruim.falha.codigo === 'OPCAO_INVALIDA');
  const ok = validarComplemento({ situacao_negociacao: 'em_negociacao', topografia: null });
  assert.deepEqual((ok as any).dados, { situacao_negociacao: 'em_negociacao', topografia: null });
});

test('numéricos: string decimal estrita vira número; lixo é recusado nomeando o campo', () => {
  const ok = validarComplemento({ preco_pedido: '1500000.50', gabarito_pavimentos: '4', coeficiente_aproveitamento: 2.5 });
  assert.deepEqual((ok as any).dados, { preco_pedido: 1500000.5, gabarito_pavimentos: 4, coeficiente_aproveitamento: 2.5 });
  for (const lixo of ['abc', '0x10', '1e3', true, {}]) {
    const r = validarComplemento({ preco_pedido: lixo });
    assert.ok('falha' in r, `deveria recusar ${JSON.stringify(lixo)}`);
    assert.match((r as any).falha.mensagem, /preco_pedido/);
  }
  const frac = validarComplemento({ gabarito_pavimentos: 3.5 });
  assert.ok('falha' in frac, 'pavimentos é inteiro');
});

test('negativo e taxa de ocupação acima de 100 são recusados', () => {
  assert.ok('falha' in validarComplemento({ preco_pedido: -1 }));
  assert.ok('falha' in validarComplemento({ taxa_ocupacao_pct: 101 }));
  assert.ok('dados' in validarComplemento({ taxa_ocupacao_pct: 100 }));
});

test('limite de texto do schema é respeitado', () => {
  assert.ok('falha' in validarComplemento({ zoneamento: 'x'.repeat(101) }));
  assert.ok('dados' in validarComplemento({ zoneamento: 'x'.repeat(100) }));
  assert.ok('dados' in validarComplemento({ observacoes: 'x'.repeat(5000) }));
});

test('corpo que não é objeto é recusado; campos fora da lista são ignorados', () => {
  assert.ok('falha' in validarComplemento(null));
  assert.ok('falha' in validarComplemento([]));
  const r = validarComplemento({ id: 9, imovel_nucleo_id: 3, tipo_imovel: 'lote', contato: 'a' });
  assert.deepEqual((r as any).dados, { contato: 'a' });
});

test('teto das colunas: acima do que o NUMERIC/int do schema comporta é 400, não 500 do banco', () => {
  assert.ok('falha' in validarComplemento({ coeficiente_aproveitamento: 1000 }));
  assert.ok('dados' in validarComplemento({ coeficiente_aproveitamento: 999.99 }));
  assert.ok('falha' in validarComplemento({ preco_pedido: 1e10 }));
  assert.ok('dados' in validarComplemento({ preco_pedido: 9999999999.99 }));
  assert.ok('falha' in validarComplemento({ gabarito_pavimentos: 3e9 }));
});

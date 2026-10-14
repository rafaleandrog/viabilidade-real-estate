import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarComplemento, CAMPOS_EDITAVEIS, gravarComplemento, listarTodosComplementos, type DadosComplemento,
} from './terrenos-complemento.js';
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

// ── Upsert e listagem, contra um `dados` falso ──────────────────────────────

function falso(linhas: any[] = [], opcoes: { falhaCriar?: Error; criarInsere?: boolean } = {}) {
  const chamadas: string[] = [];
  const dados: DadosComplemento = {
    async listar(_t, o) {
      chamadas.push('listar');
      if (o.filtros) return { dados: linhas.filter((l) => l.imovel_nucleo_id === o.filtros!.imovel_nucleo_id).slice(0, 1) };
      const i = (o.pagina - 1) * o.por_pagina;
      return { dados: linhas.slice(i, i + o.por_pagina), total: linhas.length };
    },
    async criar(_t, d) {
      chamadas.push('criar');
      if (opcoes.falhaCriar) {
        if (opcoes.criarInsere) linhas.push({ id: 99, tipo_imovel: d.tipo_imovel, imovel_nucleo_id: d.imovel_nucleo_id });
        throw opcoes.falhaCriar;
      }
      const l = { id: linhas.length + 1, ...d }; linhas.push(l); return l;
    },
    async atualizar(_t, id, d) { chamadas.push('atualizar'); return { id, ...d }; },
  };
  return { dados, chamadas, linhas };
}

test('gravarComplemento: sem registro cria (201); com registro atualiza (200)', async () => {
  const f = falso();
  const c = await gravarComplemento(f.dados, 'lote', 7, { contato: 'a' });
  assert.equal(c.http, 201);
  assert.deepEqual(f.chamadas, ['listar', 'criar']);
  const u = await gravarComplemento(f.dados, 'lote', 7, { contato: 'b' });
  assert.equal(u.http, 200);
  assert.equal(f.chamadas.at(-1), 'atualizar');
});

test('gravarComplemento: tipo divergente é 409 e não escreve; corpo vazio devolve o registro sem escrever', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 7, tipo_imovel: 'gleba' }]);
  const r = await gravarComplemento(f.dados, 'lote', 7, { contato: 'x' });
  assert.equal(r.http, 409);
  const v = await gravarComplemento(f.dados, 'gleba', 7, {});
  assert.equal(v.http, 200);
  assert.ok(!f.chamadas.includes('atualizar') && !f.chamadas.includes('criar'));
});

test('gravarComplemento: corrida — criar bate no único, recarrega o vencedor e atualiza (não é 500)', async () => {
  const f = falso([], { falhaCriar: new Error('duplicate key'), criarInsere: true });
  const r = await gravarComplemento(f.dados, 'lote', 7, { contato: 'x' });
  assert.equal(r.http, 200);
  assert.deepEqual(f.chamadas, ['listar', 'criar', 'listar', 'atualizar']);
});

test('gravarComplemento: criar falha por OUTRO motivo (registro continua ausente) — relança', async () => {
  const f = falso([], { falhaCriar: new Error('conexão caiu') });
  await assert.rejects(gravarComplemento(f.dados, 'lote', 7, { contato: 'x' }), /conexão caiu/);
});

test('listarTodosComplementos: junta as páginas e nunca devolve lista truncada', async () => {
  const muitas = Array.from({ length: 450 }, (_, i) => ({ id: i + 1, imovel_nucleo_id: i + 1 }));
  assert.equal((await listarTodosComplementos(falso(muitas).dados)).length, 450);
  assert.equal((await listarTodosComplementos(falso([]).dados)).length, 0);
  // Página cheia que nunca termina (servidor que ignora `pagina` e devolve sempre 200, sem `total`):
  // bate o teto e LANÇA em vez de devolver 100 mil linhas como se fosse tudo.
  const infinito: DadosComplemento = {
    async listar() { return { dados: Array.from({ length: 200 }, (_, i) => ({ id: i })) }; },
    async criar() { return {}; }, async atualizar() { return {}; },
  };
  await assert.rejects(listarTodosComplementos(infinito), /lista incompleta recusada/);
});

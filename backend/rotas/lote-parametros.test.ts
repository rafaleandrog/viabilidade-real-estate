import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarParametros, CAMPOS_EDITAVEIS, gravarParametros, listarTodosParametros, importarParametros,
  MAX_ITENS_IMPORTACAO, type DadosParametros,
} from './lote-parametros.js';
import esquema from '../../schema.json';

test('CAMPOS_EDITAVEIS bate com as colunas do schema (menos o vínculo imovel_nucleo_id)', () => {
  const colunas = Object.keys((esquema as any).tabelas.lote_parametros.colunas).filter((c) => c !== 'imovel_nucleo_id');
  assert.deepEqual([...CAMPOS_EDITAVEIS].sort(), colunas.sort());
});

test('o vínculo é ÚNICO no schema: imovel_nucleo_id em `unicos`', () => {
  assert.deepEqual((esquema as any).tabelas.lote_parametros.unicos, [['imovel_nucleo_id']]);
});

test('texto vazio vira null; texto é aparado; chave ausente não entra', () => {
  const r = validarParametros({ rua: '  Amsterdam ', quadra: '   ', uos: undefined });
  assert.deepEqual((r as any).dados, { rua: 'Amsterdam', quadra: null });
});

test('numéricos: string decimal estrita vira número; lixo é recusado nomeando o campo', () => {
  const ok = validarParametros({ coef_maximo: '3.50', gabarito_maximo: '12', area_m2: 1464.91 });
  assert.deepEqual((ok as any).dados, { coef_maximo: 3.5, gabarito_maximo: 12, area_m2: 1464.91 });
  for (const lixo of ['abc', '0x10', '1e3', true, {}]) {
    const r = validarParametros({ coef_maximo: lixo });
    assert.ok('falha' in r, `deveria recusar ${JSON.stringify(lixo)}`);
    assert.match((r as any).falha.mensagem, /coef_maximo/);
  }
});

test('negativo e acima do teto da coluna são recusados (400, não 500 do banco)', () => {
  assert.ok('falha' in validarParametros({ coef_maximo: -1 }));
  assert.ok('falha' in validarParametros({ coef_maximo: 10000 }));
  assert.ok('dados' in validarParametros({ coef_maximo: 9999.99 }));
  assert.ok('falha' in validarParametros({ gabarito_maximo: 1e6 }));
  assert.ok('falha' in validarParametros({ parcelamento_id: 3e9 }));
});

test('coeficiente mínimo não passa do máximo (só quando os dois vêm)', () => {
  assert.ok('falha' in validarParametros({ coef_minimo: 4, coef_maximo: 3.5 }));
  assert.ok('dados' in validarParametros({ coef_minimo: 3.5, coef_maximo: 3.5 }));
  assert.ok('dados' in validarParametros({ coef_minimo: 4 }), 'sem o máximo na requisição não há o que comparar');
});

test('limite de texto do schema é respeitado; corpo inválido e campos extras', () => {
  assert.ok('falha' in validarParametros({ uos: 'x'.repeat(41) }));
  assert.ok('dados' in validarParametros({ uos: 'x'.repeat(40) }));
  assert.ok('falha' in validarParametros(null));
  assert.ok('falha' in validarParametros([]));
  const r = validarParametros({ id: 9, imovel_nucleo_id: 3, uos: 'CSIIR 2' });
  assert.deepEqual((r as any).dados, { uos: 'CSIIR 2' });
});

// ── gravação e listagem contra um `dados` falso ─────────────────────────────

function falso(linhas: any[] = [], opcoes: { falhaCriar?: Error; criarInsere?: boolean } = {}) {
  const chamadas: string[] = [];
  const dados: DadosParametros = {
    async listar(_t, o) {
      chamadas.push('listar');
      if (o.filtros) return { dados: linhas.filter((l) => l.imovel_nucleo_id === o.filtros!.imovel_nucleo_id).slice(0, 1) };
      const i = (o.pagina - 1) * o.por_pagina;
      return { dados: linhas.slice(i, i + o.por_pagina), total: linhas.length };
    },
    async criar(_t, d) {
      chamadas.push('criar');
      if (opcoes.falhaCriar) {
        if (opcoes.criarInsere) linhas.push({ id: 99, imovel_nucleo_id: d.imovel_nucleo_id });
        throw opcoes.falhaCriar;
      }
      const l = { id: linhas.length + 1, ...d }; linhas.push(l); return l;
    },
    async atualizar(_t, id, d) { chamadas.push('atualizar'); return { id, ...d }; },
  };
  return { dados, chamadas, linhas };
}
const CARIMBO = { parcelamento_id: 12, numero_lote: '4910', area_m2: 1464.91 };

test('gravarParametros: criar exige o carimbo mínimo; atualizar não', async () => {
  const f = falso();
  const sem = await gravarParametros(f.dados, 781, { coef_maximo: 3.5 });
  assert.equal(sem.http, 400);
  assert.ok(!f.chamadas.includes('criar'), 'sem carimbo nada é criado');
  const c = await gravarParametros(f.dados, 781, { coef_maximo: 3.5, ...CARIMBO });
  assert.equal(c.http, 201);
  const u = await gravarParametros(f.dados, 781, { coef_maximo: 3 });
  assert.equal(u.http, 200);
  assert.equal(f.chamadas.at(-1), 'atualizar');
});

test('gravarParametros: corpo vazio devolve o registro sem escrever', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781 }]);
  const r = await gravarParametros(f.dados, 781, {});
  assert.equal(r.http, 200);
  assert.ok(!f.chamadas.includes('atualizar') && !f.chamadas.includes('criar'));
});

test('gravarParametros: corrida — criar bate no único, relê o vencedor e atualiza (não é 500)', async () => {
  const f = falso([], { falhaCriar: new Error('duplicate key'), criarInsere: true });
  const r = await gravarParametros(f.dados, 781, { coef_maximo: 3.5, ...CARIMBO });
  assert.equal(r.http, 200);
  assert.deepEqual(f.chamadas, ['listar', 'criar', 'listar', 'atualizar']);
});

test('gravarParametros: criar falha por OUTRO motivo — relança', async () => {
  const f = falso([], { falhaCriar: new Error('conexão caiu') });
  await assert.rejects(gravarParametros(f.dados, 781, { ...CARIMBO }), /conexão caiu/);
});

test('listarTodosParametros: junta as páginas e nunca devolve lista truncada', async () => {
  const muitas = Array.from({ length: 450 }, (_, i) => ({ id: i + 1, imovel_nucleo_id: i + 1 }));
  assert.equal((await listarTodosParametros(falso(muitas).dados)).length, 450);
  const infinito: DadosParametros = {
    async listar() { return { dados: Array.from({ length: 200 }, (_, i) => ({ id: i })) }; },
    async criar() { return {}; }, async atualizar() { return {}; },
  };
  await assert.rejects(listarTodosParametros(infinito), /lista incompleta recusada/);
});

test('importarParametros: um resultado por lote; erro de um não derruba os outros; id repetido é recusado', async () => {
  const f = falso();
  const { resultados } = await importarParametros(f.dados, [
    { imovel_nucleo_id: 781, coef_maximo: 3.5, ...CARIMBO },
    { imovel_nucleo_id: 780, coef_maximo: 'abc', ...CARIMBO },
    { imovel_nucleo_id: 779, coef_maximo: 3.5 },
    { imovel_nucleo_id: 781, coef_maximo: 3, ...CARIMBO },
    { imovel_nucleo_id: 'x' },
  ]);
  assert.deepEqual(resultados.map((r) => r.ok), [true, false, false, false, false]);
  assert.equal(resultados[0].criado, true);
  assert.match(resultados[1].erro!, /coef_maximo/);
  assert.match(resultados[2].erro!, /carimbo/);
  assert.match(resultados[3].erro!, /repetido/);
  assert.equal(f.linhas.length, 1, 'só o primeiro lote válido foi gravado');
  assert.ok(MAX_ITENS_IMPORTACAO >= 63, 'a etapa 1 inteira cabe numa importação');
});

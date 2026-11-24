import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchmarksPadrao, CAMPOS_SENSIBILIDADE, CAMPOS_SENSIBILIDADE_CENARIOS } from './benchmarks.js';

// Indicadores padrão: metas (§4.6) + os 4 indicadores de SENSIBILIDADE (variáveis
// estressadas na Proforma). Eficiência de aproveitamento só existe para Loteamento.

test('loteamento: 6 metas (com eficiência) + 4 de sensibilidade + 1 dos cenários = 11', () => {
  const campos = benchmarksPadrao('loteamento').map((b) => b.campo);
  assert.ok(campos.includes('eficiencia_aproveitamento'));
  assert.ok(campos.includes('resultado_final'));
  assert.equal(campos.length, 11);
});

test('incorporacao: 5 metas (sem eficiência) + 4 de sensibilidade + 1 dos cenários = 10', () => {
  const campos = benchmarksPadrao('incorporacao').map((b) => b.campo);
  assert.ok(!campos.includes('eficiencia_aproveitamento'));
  assert.equal(campos.length, 10);
});

test('inclui os 4 indicadores de sensibilidade (variáveis da Proforma)', () => {
  for (const tipo of ['loteamento', 'incorporacao']) {
    const campos = benchmarksPadrao(tipo).map((b) => b.campo);
    for (const c of CAMPOS_SENSIBILIDADE) assert.ok(campos.includes(c), `${tipo} deve ter ${c}`);
  }
  assert.deepEqual([...CAMPOS_SENSIBILIDADE], ['preco', 'permuta_fisica', 'permuta_financeira', 'custo_obras']);
});

test('resultado_final é o piso (atingir_ou_superar) e custo_obras_vgv é teto (nao_exceder)', () => {
  const bm = benchmarksPadrao('incorporacao');
  const resultado = bm.find((b) => b.campo === 'resultado_final');
  const custo = bm.find((b) => b.campo === 'custo_obras_vgv');
  assert.equal(resultado?.regra_comparacao, 'atingir_ou_superar');
  assert.equal(custo?.regra_comparacao, 'nao_exceder');
});

test('#971: velocidade de vendas é sensibilidade dos cenários, ±15%, nos dois tipos e fora da lista da Proforma', () => {
  assert.deepEqual([...CAMPOS_SENSIBILIDADE_CENARIOS], ['velocidade']);
  assert.ok(!(CAMPOS_SENSIBILIDADE as readonly string[]).includes('velocidade'));
  for (const tipo of ['loteamento', 'incorporacao']) {
    const v = benchmarksPadrao(tipo).find((b) => b.campo === 'velocidade');
    assert.deepEqual(v, { campo: 'velocidade', valor: 0, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 15, variacao_negativa_pct: 15 }, tipo);
  }
});

import { padroesFaltantes, camposDoSemear } from './benchmarks.js';
import { readFileSync } from 'node:fs';

test('#971 semear com `campos`: cria só os listados que faltam; sem `campos`, todos os que faltam', () => {
  const jaTem = new Set(['preco', 'roi']);
  assert.deepEqual(padroesFaltantes('incorporacao', jaTem, ['velocidade']).map((p) => p.campo), ['velocidade']);
  assert.deepEqual(padroesFaltantes('incorporacao', new Set(['velocidade']), ['velocidade']), []);
  const todos = padroesFaltantes('incorporacao', jaTem).map((p) => p.campo);
  assert.ok(todos.includes('velocidade') && todos.includes('margem_liquida') && !todos.includes('preco'));
});

test('#971 semear: corpo `campos` ausente vale todos; lista de textos vale ela; outra coisa é inválida', () => {
  assert.equal(camposDoSemear(undefined), undefined);
  assert.equal(camposDoSemear({}), undefined);
  assert.deepEqual(camposDoSemear({ campos: ['velocidade'] }), ['velocidade']);
  for (const c of ['velocidade', [1], [null], {}]) assert.equal(camposDoSemear({ campos: c }), null, JSON.stringify(c));
  // Fiação: a rota usa as duas e recusa `campos` inválido com 400.
  const rota = readFileSync(new URL('./benchmarks.ts', import.meta.url), 'utf8');
  assert.match(rota, /const campos = camposDoSemear\(req\.body\);/);
  assert.match(rota, /if \(campos === null\) \{ erro\(res, 400, 'CAMPOS_INVALIDOS'/);
  assert.match(rota, /for \(const padrao of padroesFaltantes\(tipo, jaTem, campos\)\)/);
});

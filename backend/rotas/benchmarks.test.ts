import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchmarksPadrao } from './benchmarks.js';

// Indicadores padrão (§4.6): eficiência de aproveitamento só existe para
// Loteamento; o resto é comum aos dois tipos.

test('loteamento inclui eficiencia_aproveitamento', () => {
  const campos = benchmarksPadrao('loteamento').map((b) => b.campo);
  assert.ok(campos.includes('eficiencia_aproveitamento'));
  assert.ok(campos.includes('resultado_final'));
  assert.equal(campos.length, 6);
});

test('incorporacao NÃO inclui eficiencia_aproveitamento', () => {
  const campos = benchmarksPadrao('incorporacao').map((b) => b.campo);
  assert.ok(!campos.includes('eficiencia_aproveitamento'));
  assert.equal(campos.length, 5);
});

test('resultado_final é o piso (atingir_ou_superar) e custo_obras_vgv é teto (nao_exceder)', () => {
  const bm = benchmarksPadrao('incorporacao');
  const resultado = bm.find((b) => b.campo === 'resultado_final');
  const custo = bm.find((b) => b.campo === 'custo_obras_vgv');
  assert.equal(resultado?.regra_comparacao, 'atingir_ou_superar');
  assert.equal(custo?.regra_comparacao, 'nao_exceder');
});

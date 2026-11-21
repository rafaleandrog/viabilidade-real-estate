import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDoRestante, TOLERANCIA_SOMA_PCT_ALV } from './produtos-alv.js';
import { estadoConsistenciaAlocacao } from './consistencia-alocacao.js';
import { calcularProforma } from './proforma.js';

test('estadoDoRestante: limites da tolerância', () => {
  assert.equal(TOLERANCIA_SOMA_PCT_ALV, 0.01);
  assert.equal(estadoDoRestante(0), 'completa');
  assert.equal(estadoDoRestante(0.01), 'completa');
  assert.equal(estadoDoRestante(-0.01), 'completa');
  assert.equal(estadoDoRestante(0.01004), 'falta');
  assert.equal(estadoDoRestante(-0.01004), 'excesso');
  assert.equal(estadoDoRestante(100 - 3 * 33.3333), 'completa');
});

test('aba Gráficos: 3 × 33,3333% sobre 300.000 m² é completa (dif. −0,30 m²)', () => {
  const pct = 3 * 33.3333;
  const dif = Math.round((pct / 100 * 300_000 - 300_000) * 100) / 100;
  assert.equal(dif, -0.3);
  assert.equal(estadoConsistenciaAlocacao(pct, dif), 'completa');
});

test('aba Gráficos: falta e excesso reais continuam avisando', () => {
  assert.equal(estadoConsistenciaAlocacao(99.5, -1500), 'falta');
  assert.equal(estadoConsistenciaAlocacao(100.5, 1500), 'excesso');
});

test('aba Gráficos: sem base (pct null) vale o sinal da diferença', () => {
  assert.equal(estadoConsistenciaAlocacao(null, 5), 'excesso');
  assert.equal(estadoConsistenciaAlocacao(null, -5), 'falta');
  assert.equal(estadoConsistenciaAlocacao(null, 0), 'completa');
});

test('motor entrega os dois campos que a tela consome', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 300_000,
    produtos: [1, 2, 3].map((i) => ({ id: i, nome: `P${i}`, ordem: i, pct_alv: 33.3333, unidades: 100, preco_venda_m2: 1000 })),
  } as any);
  assert.equal(typeof p.diferencaAreaAlocada, 'number');
  assert.ok(Math.abs((p.pctAreaAlocada as number) - 99.9999) < 1e-6);
  assert.equal(estadoConsistenciaAlocacao(p.pctAreaAlocada, p.diferencaAreaAlocada), 'completa');
});

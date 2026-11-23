import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoConfig } from './fluxo-caixa-motor.js';
import { periodosAnuais } from './fluxo-shared.js';

// Receita de 10M, toda vendida no mês `mes` (1-based), recebida à vista.
// Mesmo cronograma dos testes do motor: a janela de vendas começa no lançamento (mês 12).
const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const receita = (mes: number) => ({
  id: 1, nome: 'Vendas',
  tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes, pct: 100 }] },
  fluxo_pagamento: { ret: { ativo: false, pct: 0 } },
});
const custo = (valor: number, inicio: number, duracao: number) => ({
  id: 2, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: valor, orcamento_unidade: 'rs',
  inicio_mes: inicio, duracao_meses: duracao,
});
const cfg = (linhasReceita: unknown[], linhasCusto: unknown[]): FluxoConfig => ({
  dataInicio: 'jan/2027', prazoMeses: 60, taxaDescontoAa: 12, areaTerreno: 0, cronograma: CRONO,
  jurosTabelaAaEstudo: 0, linhasReceita, linhasCusto,
} as unknown as FluxoConfig);

test('#910: sempre positivo — exposição 0 (sem -0), mês e payback nulos', () => {
  const r = calcularFluxo(cfg([receita(12)], []));
  assert.ok(r.fluxoAcumulado.some((v) => v > 0));
  assert.ok(r.fluxoAcumulado.every((v) => v >= 0));
  assert.ok(Object.is(r.exposicaoMaxima, 0), `exposição ${r.exposicaoMaxima}`);
  assert.equal(r.mesExposicaoMaxima, null);
  assert.equal(r.paybackMes, null);
  assert.equal(r.paybackData, null);
});

test('#910: negativo que recupera — payback é o primeiro mês do acumulado >= 0', () => {
  const r = calcularFluxo(cfg([receita(20)], [custo(1_000_000, 0, 3)]));
  const iMin = r.fluxoAcumulado.indexOf(Math.min(...r.fluxoAcumulado));
  assert.ok(r.exposicaoMaxima < 0);
  assert.equal(r.exposicaoMaxima, Math.min(...r.fluxoAcumulado));
  assert.equal(r.mesExposicaoMaxima, iMin);
  const esperado = r.fluxoAcumulado.findIndex((v, i) => v >= 0 && r.fluxoAcumulado.slice(0, i).some((x) => x < 0));
  assert.ok(esperado > iMin);
  assert.equal(r.paybackMes, esperado);
});

test('#910: negativo que nunca recupera — payback nulo, exposição no pior ponto', () => {
  const r = calcularFluxo(cfg([], [custo(1_000_000, 0, 3)]));
  assert.ok(r.exposicaoMaxima < 0);
  assert.equal(r.paybackMes, null);
  assert.equal(r.mesExposicaoMaxima, r.fluxoAcumulado.indexOf(r.exposicaoMaxima));
});

test('#910: payback vem do acumulado, não do sinal do fluxo mensal', () => {
  // Receita antes do custo: mensal negativo com acumulado ainda >= 0.
  const r = calcularFluxo(cfg([receita(12)], [custo(100, 50, 1)]));
  assert.ok(r.fluxoMensal.some((v) => v < 0));
  assert.ok(r.fluxoAcumulado.every((v) => v >= 0));
  assert.equal(r.paybackMes, null);
  assert.ok(Object.is(r.exposicaoMaxima, 0));
});

test('#910: série agregada (anual) — mês nulo sem exposição', () => {
  const pos = calcularFluxo(cfg([receita(12)], []));
  const aPos = agregarFluxoPorPeriodos(pos, periodosAnuais('jan/2027', pos.fluxoAcumulado.length));
  assert.ok(Object.is(aPos.exposicaoMaxima, 0));
  assert.equal(aPos.mesExposicaoMaxima, null);

  const neg = calcularFluxo(cfg([], [custo(1_000_000, 0, 3)]));
  const aNeg = agregarFluxoPorPeriodos(neg, periodosAnuais('jan/2027', neg.fluxoAcumulado.length));
  assert.ok(aNeg.exposicaoMaxima < 0);
});

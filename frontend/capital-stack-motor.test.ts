import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fluxoAposFundingMensal, caixaAcumuladoMensal, necessidadeFundingMensal,
  caixaDistribuivelMensal, reconciliarCapitalStack,
} from './capital-stack-motor.js';

// Reconciliados contra os Casos 1 e 16 do oráculo (frontend/fixtures/
// capital-stack-golden.ts, #270) — mesmos números, mesma leitura.

test('fluxoAposFundingMensal: sem entradas/saídas de funding, é idêntico ao fluxo livre', () => {
  const fluxoLivre = [0, 100, 100, 100];
  const r = fluxoAposFundingMensal(fluxoLivre, [], []);
  assert.deepEqual(r, [0, 100, 100, 100]);
});

test('fluxoAposFundingMensal: soma entradas e subtrai saídas mês a mês', () => {
  const r = fluxoAposFundingMensal([0, -200, -200, 300], [0, 200, 200, 0], [0, 0, 0, 0]);
  assert.deepEqual(r, [0, 0, 0, 300]);
});

test('caixaAcumuladoMensal: soma corrida, mês 0 sempre zero', () => {
  assert.deepEqual(caixaAcumuladoMensal([0, 100, 100, 100]), [0, 100, 200, 300]);
  assert.deepEqual(caixaAcumuladoMensal([0, -200, -200, 300]), [0, -200, -400, -100]);
});

test('necessidadeFundingMensal: máximo(0, reserva − caixa) — Caso 16 do oráculo', () => {
  const caixaProjeto = [0, 300, -200, 0];
  assert.deepEqual(necessidadeFundingMensal(caixaProjeto, 0), [0, 0, 200, 0]);
});

test('necessidadeFundingMensal: reserva mínima positiva também gera necessidade com caixa positivo insuficiente', () => {
  assert.deepEqual(necessidadeFundingMensal([0, 50, 150], 100), [0, 50, 0]);
});

test('caixaDistribuivelMensal: nunca fica negativo mesmo com reserva alta', () => {
  assert.deepEqual(caixaDistribuivelMensal([0, 500, 50], 100), [0, 400, 0]);
});

test('caixaDistribuivelMensal: desconta obrigações futuras protegidas quando informadas', () => {
  assert.deepEqual(caixaDistribuivelMensal([0, 500], 100, [0, 100]), [0, 300]);
});

// #240-style: reconciliação fechada — Caso 1 (sem funding, sem lacuna).
test('reconciliarCapitalStack: Caso 1 do oráculo — projeto sem funding', () => {
  const r = reconciliarCapitalStack([0, 100, 100, 100], [], [], 0);
  assert.deepEqual(r.caixaProjetoMensal, [0, 100, 200, 300]);
  assert.equal(r.lacunaFundingMaxima, 0);
});

// Caso 16 — sem nenhum instrumento (entradas/saídas zero), o fluxo livre não
// muda; a lacuna é só informativa.
test('reconciliarCapitalStack: Caso 16 do oráculo — sem instrumentos, fluxo livre intocado', () => {
  const r = reconciliarCapitalStack([0, 300, -500, 200], [0, 0, 0], [0, 0, 0], 0);
  assert.deepEqual(r.fluxoAposFundingMensal, [0, 300, -500, 200]);
  assert.deepEqual(r.caixaProjetoMensal, [0, 300, -200, 0]);
  assert.deepEqual(r.necessidadeFundingMensal, [0, 0, 200, 0]);
  assert.equal(r.lacunaFundingMaxima, 200);
});

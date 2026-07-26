import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularVariacao, fmtVariacao } from './cenario-variacao.js';

test('fmtVariacao: sinal sempre explícito, 1 casa decimal com vírgula', () => {
  assert.equal(fmtVariacao(12.34), '+12,3%');
  assert.equal(fmtVariacao(-4.25), '-4,3%');
  assert.equal(fmtVariacao(0.2), '+0,2%');
});

test('maiorMelhor: subir é melhor (VPL, Resultado, TIR)', () => {
  const sobe = calcularVariacao(110, 100, true);
  assert.equal(sobe?.melhor, true);
  assert.equal(sobe?.texto, '+10,0%');

  const cai = calcularVariacao(90, 100, true);
  assert.equal(cai?.melhor, false);
  assert.equal(cai?.texto, '-10,0%');
});

test('menorMelhor: cair é melhor', () => {
  assert.equal(calcularVariacao(90, 100, false)?.melhor, true);
  assert.equal(calcularVariacao(110, 100, false)?.melhor, false);
});

test('base negativa: normaliza pelo módulo — exposição máxima menos negativa é melhor', () => {
  // Exposição máxima é min(fluxoAcumulado), tipicamente negativa. Ir de
  // -1.000 para -800 é uma MELHORA de +20% (maiorMelhor = true).
  const v = calcularVariacao(-800, -1000, true);
  assert.equal(v?.melhor, true);
  assert.equal(v?.texto, '+20,0%');

  // Afundar mais: de -1.000 para -1.300 é -30% e uma piora.
  const w = calcularVariacao(-1300, -1000, true);
  assert.equal(w?.melhor, false);
  assert.equal(w?.texto, '-30,0%');
});

test('sem variação relevante devolve null (não pinta seta nem badge)', () => {
  assert.equal(calcularVariacao(100, 100, true), null);
  assert.equal(calcularVariacao(100.02, 100, true), null);
});

test('entradas inválidas devolvem null', () => {
  assert.equal(calcularVariacao(null, 100, true), null);
  assert.equal(calcularVariacao(100, null, true), null);
  assert.equal(calcularVariacao(100, 0, true), null, 'base zerada não tem denominador');
  assert.equal(calcularVariacao(Number.NaN, 100, true), null);
  assert.equal(calcularVariacao(100, Number.POSITIVE_INFINITY, true), null);
});

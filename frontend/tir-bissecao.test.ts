import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tirFluxo, tirBissecaoFluxo, vplFluxo } from './fluxo-caixa-motor.js';

const aporteMaisRetornos = (aporte: number, ret: number, n: number) => [-aporte, ...Array(n).fill(ret)];

function vplRelativo(fluxo: number[], tirAa: number): number {
  const tm = Math.pow(1 + tirAa / 100, 1 / 12) - 1;
  const escala = fluxo.reduce((s, cf, i) => s + Math.abs(cf) / Math.pow(1 + tm, i + 1), 0);
  return Math.abs(vplFluxo(fluxo, tirAa)) / escala;
}

test('prejuízo grande: o Newton diverge e a bisseção devolve a TIR negativa', () => {
  // Medido na main antes do conserto: tirFluxo devolvia null para este fluxo.
  const fluxo = aporteMaisRetornos(1_000_000, 5_000, 24);
  const tir = tirFluxo(fluxo);
  assert.ok(tir !== null, 'deveria haver TIR');
  assert.ok(tir < 0 && tir > -100, `TIR negativa esperada, veio ${tir}`);
  assert.ok(vplRelativo(fluxo, tir) < 1e-6, 'VPL na TIR deve ser ~0 (relativo)');
  // outros fluxos que também davam null
  for (const [ret, n] of [[2_000, 24], [3_000, 36], [1_000, 24], [20_000, 12]]) {
    const f = aporteMaisRetornos(1_000_000, ret, n);
    const t = tirFluxo(f);
    assert.ok(t !== null && t < 0, `ret=${ret} n=${n}`);
    assert.ok(vplRelativo(f, t!) < 1e-6);
  }
});

test('sem raiz no intervalo ou sem mudança de sinal nas pontas: null', () => {
  assert.equal(tirFluxo([-100, -50, -20]), null); // guard inicial
  assert.equal(tirFluxo([100, 50]), null);
  // fluxo com troca de sinal mas sem raiz real (VPL sempre positivo, mesmo sinal nas pontas)
  assert.equal(tirBissecaoFluxo([100, -150, 100]), null);
  // raiz fora do intervalo (acima de 1000% ao mês)
  assert.equal(tirBissecaoFluxo([-1, 1e6]), null);
});

test('regressão: fluxos que o Newton já resolvia dão o mesmo valor de antes', () => {
  const casos: [number[], number][] = [
    [[-1000, 300, 300, 300, 300], 143.92620451011297],
    [[-500000, ...Array.from({ length: 36 }, (_, i) => 20000 + i * 1500)], 115.51206421475074],
    [[-100, -100, 50, 50, 50, 50, 80, 80, 80, 80, 80], 1064.0144024422145],
    [aporteMaisRetornos(1_000_000, 20_000, 24), -47.273413184191945],
  ];
  for (const [f, esperado] of casos) assert.ok(Math.abs((tirFluxo(f) as number) - esperado) < 1e-9);
});

test('início tardio: critério relativo não aceita taxa absurda', () => {
  for (const zeros of [3, 12, 36, 60]) {
    const f = [...Array(zeros).fill(0), ...aporteMaisRetornos(1_000_000, 5_000, 24)];
    const t = tirBissecaoFluxo(f);
    assert.ok(t !== null, `zeros=${zeros}`);
    // mesma raiz do fluxo sem os zeros (zeros iniciais não mudam a raiz da taxa)
    const base = tirBissecaoFluxo(aporteMaisRetornos(1_000_000, 5_000, 24)) as number;
    assert.ok(Math.abs(t - base) < 1e-6, `zeros=${zeros}: ${t} vs ${base}`);
    assert.ok(t < 0, `prejuízo deve dar TIR negativa, veio ${t}`);
    assert.ok(vplRelativo(f, t) < 1e-6);
  }
});

test('fluxo longo (estouro de potência no extremo inferior) ainda acha a raiz', () => {
  const f = aporteMaisRetornos(1_000_000, 3_000, 150);
  const t = tirFluxo(f);
  assert.ok(t !== null && t < 0);
  assert.ok(vplRelativo(f, t!) < 1e-6);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tirFluxo, tirBissecaoFluxo, vplFluxo } from './fluxo-caixa-motor.js';

const aporteMaisRetornos = (aporte: number, ret: number, n: number) => [-aporte, ...Array(n).fill(ret)];

function vplRelativo(fluxo: number[], tirAa: number): number {
  const tm = Math.pow(1 + tirAa / 100, 1 / 12) - 1;
  const escala = fluxo.reduce((s, cf, i) => s + Math.abs(cf) / Math.pow(1 + tm, i + 1), 0);
  return Math.abs(vplFluxo(fluxo, tirAa)) / escala;
}

test('início tardio: o aceite do Newton é relativo, não devolve taxa absurda', () => {
  // Medido na main antes do conserto (critério absoluto 1e-3): z=3 → 1,45e42 % a.a.,
  // z=12 → 1,24e14 % a.a., z=60 → 4,0e4 % a.a. Em taxa enorme o VPL fica minúsculo.
  for (const z of [3, 12, 60]) {
    const f = [...Array(z).fill(0), ...aporteMaisRetornos(1_000_000, 5_000, 24)];
    const tir = tirFluxo(f);
    assert.ok(tir !== null && Number.isFinite(tir) && tir < 0, `z=${z}: TIR deveria ser finita e negativa, veio ${tir}`);
    assert.ok(vplRelativo(f, tir as number) <= 1e-6, `z=${z}: VPL relativo ${vplRelativo(f, tir as number)}`);
    // A raiz é a que a bisseção acha (cerca de −80,6% a.a. neste fluxo).
    assert.equal(tir, tirBissecaoFluxo(f));
  }
});

test('regressão: fluxos que o Newton já resolvia mantêm o valor medido na main', () => {
  const casos: [number[], number][] = [
    [[-1000, 300, 400, 500], 178.07335404307793],
    [aporteMaisRetornos(1_000_000, 60_000, 24), 45.07302318700766],
    [[-3e7, ...Array.from({ length: 59 }, (_, i) => 800_000 + i * 5_000)], 29.940694268120318],
    [[-2e7, -1e7, ...Array(10).fill(1e6), ...Array(48).fill(1.2e6)], 43.76127902307307],
  ];
  for (const [f, esperado] of casos) {
    const t = tirFluxo(f) as number;
    assert.ok(Math.abs(t - esperado) < 1e-9, `${t} vs ${esperado}`);
  }
});

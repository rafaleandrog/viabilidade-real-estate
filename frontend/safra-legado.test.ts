import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedacosSafraLegado, partirPedaco, repartirAcumulado } from './safra-legado.js';

// Safras de poucos centavos: nenhum centavo some quando todos os pedaços são
// menores que meio centavo, e nenhum pedaço ou parcela fica negativo.

const soma = (v: number[]) => Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100;
const semIntervalo = () => 1;
const semObra = () => [];

test('safra de R$ 0,01 em 34/33/33%: o centavo é depositado', () => {
  const p = pedacosSafraLegado(0.01, 0, [{ pct: 34 }], [{ pct: 33, parcelas: 1 }], 33, 5, semIntervalo, semObra);
  assert.equal(soma(p.map((x) => x.total)), 0.01);
  assert.ok(p.every((x) => x.total >= 0), JSON.stringify(p));
});

test('safra de R$ 0,02 em quatro pedaços de 25%: nenhum pedaço negativo', () => {
  const p = pedacosSafraLegado(0.02, 0, [{ pct: 25 }, { pct: 25 }], [{ pct: 25, parcelas: 1 }], 25, 5, semIntervalo, semObra);
  assert.equal(soma(p.map((x) => x.total)), 0.02);
  assert.ok(p.every((x) => x.total >= 0), JSON.stringify(p));
});

test('pedaço de R$ 0,11 em 7 parcelas: soma ao centavo, nenhuma parcela negativa', () => {
  const parcelas = partirPedaco({ total: 0.11, meses: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(soma(parcelas), 0.11);
  assert.ok(parcelas.every((v) => v >= 0), JSON.stringify(parcelas));
});

test('com desconto, a safra soma a venda menos o desconto arredondado', () => {
  const p = pedacosSafraLegado(1000.03, 0, [{ pct: 33.33, descontoPct: 5, parcelas: 3 }], [{ pct: 33.33, parcelas: 7 }], 33.34, 9, semIntervalo, semObra);
  const desconto = Math.round(1000.03 * 0.3333 * 0.05 * 100) / 100;
  assert.equal(soma(p.map((x) => x.total)), Math.round((1000.03 - desconto) * 100) / 100);
  for (const x of p) assert.equal(soma(partirPedaco(x)), x.total);
});

test('repartirAcumulado: sem peso, tudo zero; soma sempre o alvo', () => {
  assert.deepEqual(repartirAcumulado(5, [0, 0]), [0, 0]);
  for (const alvo of [0.01, 0.07, 1234.57, 99999.99]) {
    for (const pesos of [[1], [1, 1, 1], [0.3333, 0.3333, 0.3334], [7, 0, 3]]) {
      const r = repartirAcumulado(alvo, pesos);
      assert.equal(soma(r), alvo);
      assert.ok(r.every((v) => v >= 0));
    }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kpiAreaPermutada } from './kpi-area-permutada.js';
import { fmtR$, fmtNum } from './viab-format.js';

test('sem permuta nenhuma: o card não existe (inalterado)', () => {
  assert.equal(kpiAreaPermutada(0, 0), null);
});

test('só permuta financeira: valor "—" e nota com o montante em 2 casas', () => {
  const k = kpiAreaPermutada(0, 1_234_567.89);
  assert.ok(k);
  assert.equal(k.rot, 'Área permutada');
  assert.equal(k.val, '—');
  assert.ok(k.nota?.includes('só financeira'), 'a nota diz que a permuta é só financeira');
  assert.ok(k.nota?.includes(fmtR$(1_234_567.89)), 'o montante sai com fmtR$');
});

test('permuta física: área em m², sem nota (inalterado)', () => {
  const k = kpiAreaPermutada(320, 0);
  assert.deepEqual(k, { rot: 'Área permutada', val: `${fmtNum(320)} m²`, nota: null });
});

test('permuta física e financeira juntas: a área manda, sem nota', () => {
  const k = kpiAreaPermutada(320, 500_000);
  assert.equal(k?.val, `${fmtNum(320)} m²`);
  assert.equal(k?.nota, null);
});

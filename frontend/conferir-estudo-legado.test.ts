// A conta "Σ legado entrada+parcelas" do `scripts/conferir-estudo.ts` só vale
// para a fase sem `componentes`; com `componentes`, o legado é só o espelho da
// tela e o script não o confere (era um FALHA falso em todo plano canônico).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somaLegadoAplicavel } from '../scripts/conferir-estudo.js';

test('conferir-estudo: fase com componentes não tem conta de legado', () => {
  assert.equal(somaLegadoAplicavel({
    entrada: [{ pct: 20 }], parcelas: [{ pct: 20 }],
    componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }],
  }), null);
  assert.equal(somaLegadoAplicavel({ entrada: [], parcelas: [], componentes: [] }), null);
});

test('conferir-estudo: fase legada sem componentes continua conferida', () => {
  assert.equal(somaLegadoAplicavel({ entrada: [{ pct: 15 }], parcelas: [{ pct: 15 }, { pct: 10 }] }), 40);
  assert.equal(somaLegadoAplicavel({ entrada: [{ pct: 70 }], parcelas: [{ pct: 50 }] }), 120);
  assert.equal(somaLegadoAplicavel(null), 0);
});

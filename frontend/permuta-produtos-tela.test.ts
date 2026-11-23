import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colunasProduto, dadosEdicaoUnidades } from './tela-premissas.js';

// A tabela do catálogo ganha "Unidades permutadas" logo depois de "Unidades", nos dois tipos.
test('colunasProduto: Unidades permutadas entra depois de Unidades', () => {
  for (const lot of [true, false]) {
    const cols = colunasProduto(lot);
    const i = cols.findIndex((c) => c.chave === 'unidades');
    assert.equal(cols[i + 1].chave, 'unidadesPermutadas');
    assert.equal(cols[i + 1].rotulo, 'Unidades permutadas');
    assert.equal(cols[i + 1].classe, 'p-uperm');
  }
});

test('dadosEdicaoUnidades: baixar unidades abaixo das permutadas leva as permutadas junto', () => {
  assert.deepEqual(dadosEdicaoUnidades({ unidades_permutadas: 5 }, 3), { unidades: 3, unidades_permutadas: 3 });
  assert.deepEqual(dadosEdicaoUnidades({ unidades_permutadas: 5 }, null), { unidades: null, unidades_permutadas: 0 });
  assert.deepEqual(dadosEdicaoUnidades({ unidades_permutadas: 2 }, 10), { unidades: 10 });
  assert.deepEqual(dadosEdicaoUnidades({}, 4), { unidades: 4 });
});

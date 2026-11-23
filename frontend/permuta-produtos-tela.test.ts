import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colunasProduto, colunasProdutoTabela, dadosEdicaoUnidades } from './tela-premissas.js';

// A tabela do catálogo ganha "Unidades permutadas" logo depois de "Unidades";
// `colunasProduto` (a lista base) segue como estava.
test('colunasProdutoTabela: Unidades permutadas entra depois de Unidades, nos dois tipos', () => {
  for (const lot of [true, false]) {
    const chaves = colunasProdutoTabela(lot).map((c) => c.chave);
    assert.deepEqual(chaves, ['nome', 'tipo', 'pct', 'unidades', 'unidadesPermutadas', 'areaTotal', 'area', 'preco', 'vgv']);
    assert.deepEqual(colunasProduto(lot).map((c) => c.chave), chaves.filter((c) => c !== 'unidadesPermutadas'));
    const col = colunasProdutoTabela(lot).find((c) => c.chave === 'unidadesPermutadas')!;
    assert.equal(col.rotulo, 'Unidades permutadas');
    assert.equal(col.classe, 'p-uperm');
  }
});

test('dadosEdicaoUnidades: baixar unidades abaixo das permutadas leva as permutadas junto', () => {
  assert.deepEqual(dadosEdicaoUnidades({ unidades_permutadas: 5 }, 3), { unidades: 3, unidades_permutadas: 3 });
  assert.deepEqual(dadosEdicaoUnidades({ unidades_permutadas: 5 }, null), { unidades: null, unidades_permutadas: 0 });
  assert.deepEqual(dadosEdicaoUnidades({ unidades_permutadas: 2 }, 10), { unidades: 10 });
  assert.deepEqual(dadosEdicaoUnidades({}, 4), { unidades: 4 });
});

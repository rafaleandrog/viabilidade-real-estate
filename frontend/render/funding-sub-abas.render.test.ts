// Render: duas operações do mesmo tipo viram dois cartões, na ordem de `ordem`.
// Ver o topo de `casos/funding-sub-abas.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, naoDeclaradas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Funding: duas operações do mesmo tipo viram dois cartões, na ordem de `ordem`', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-sub-abas', larguras: [900] });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));

  const extra = a.extra?.['900'] as { ids: string[]; nomes: string[] } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.deepEqual(
    extra!.ids, ['11', '10'],
    'dentro do mesmo tipo os cartões seguem `ordem` (a de id 11 tem ordem 0), não o id nem a chegada' + relato(a),
  );
  assert.deepEqual(extra!.nomes, ['Abrir operação 2º Dívida', 'Abrir operação 1º Dívida'], 'nome acessível do cartão');
});

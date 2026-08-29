// Render do chassi de abas do Funding (#586) — a prova de FIAÇÃO que os testes
// de função pura não dão. Ver o topo de `casos/funding-abas.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Funding: as três abas de tipo montam dentro do urbi-abas (#586)', { skip: pular ?? false }, async () => {
  // O `exigir` do caso já reprova a montagem ausente ANTES de medir pixel — é
  // ele que carrega o critério 5 da issue. As asserções abaixo cobrem o resto.
  const a = await verificarRender({ caso: 'funding-abas' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algo estourou a caixa' + relato(a));
  assert.equal(contar(a, 'transbordoDeTexto'), 0, 'texto saltou para fora do quadro' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'duas caixas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

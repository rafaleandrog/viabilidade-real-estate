// Render da cascata de áreas da INCORPORAÇÃO com um negativo digitado — #612,
// rodada 1 de revisão do PR 620.
//
// Ver o topo de `casos/cascata-areas-incorporacao-deficit.ts` para o que ele
// mede. Em uma frase: é o único ponto do repositório que exige o aviso do piso
// em zero na tela da INCORPORAÇÃO — o piso do motor está coberto por
// `frontend/areas-cascata.test.ts` e a leitura capada de `calcularProforma`
// por `frontend/proforma.test.ts` (testes `#612:`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Terreno & Áreas (Incorporação): negativo digitado mostra a linha cortada e o aviso', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-areas-incorporacao-deficit' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Terreno & Áreas (Incorporação): nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-areas-incorporacao-deficit' });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

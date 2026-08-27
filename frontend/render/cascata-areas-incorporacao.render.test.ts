// Render da CASCATA de áreas da Incorporação (#564) — aba Terreno & Áreas.
//
// O que se verifica aqui é o mesmo par de garantias dos outros casos de
// tabela (`tabela-fluxo.ts`): a tabela não estoura o card, nenhuma caixa
// pinta sobre outra, e as cores resolvem nos temas do espelho. A prova de
// que a cascata (e não o grid plano antigo) está na tela é o próprio
// `exigir` do caso — ver `casos/cascata-areas-incorporacao.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Cascata de áreas da Incorporação: tabela contida, sem caixa sobre caixa', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-areas-incorporacao' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a tabela empurrou o DOCUMENTO na horizontal' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

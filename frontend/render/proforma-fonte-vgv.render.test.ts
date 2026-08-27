// Render da Proforma nas duas condições que a fonte do VGV cria: estudo SEM
// catálogo efetivo (estado vazio) e permuta física acima da base (aviso de
// excedente).
//
// ⚠️ Estes dois casos NÃO medem número — medem que a tela olhou para
// `semProdutos` e para `permutaCapada`. Os dois campos são calculados por
// `frontend/proforma.ts` e cobertos por teste de lógica pura; nada nessa camada
// impede `tela-proforma.ts` de ignorá-los, e apagar qualquer um dos dois ramos
// do template deixaria toda a suíte verde. O que fica vermelho é o `exigir` de
// cada caso, aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Proforma sem catálogo: o estado vazio está na tela, e cabe nas 3 larguras', { skip: pular ?? false }, async () => {
  // O `exigir` do caso já reprova a montagem quando `urbi-estado-vazio` não
  // aparece — é ele a prova de fiação, e o `verificarRender` lança antes de
  // medir qualquer pixel.
  const a = await verificarRender({ caso: 'proforma-sem-produtos' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'o estado vazio não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Proforma com excedente de permuta: o aviso está na tela, acima da tabela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-permuta-capada' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'o aviso do excedente não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Proforma sem catálogo: as cores do estado vazio resolvem em todas as variantes de tema', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-sem-produtos', larguras: [1280] });

  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

test('Proforma com excedente de permuta: as cores do aviso resolvem em todas as variantes de tema', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-permuta-capada', larguras: [1280] });

  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

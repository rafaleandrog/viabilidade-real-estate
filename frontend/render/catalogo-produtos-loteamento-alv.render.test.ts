// Render do cadastro de Produtos do Loteamento por % da ALV (#781) — prova de que o
// input de % da ALV, o seletor de Tipo e as áreas calculadas estão mesmo na
// tela, e não só no motor/backend/schema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Catálogo de Produtos: o Loteamento cadastra por % da ALV, com áreas calculadas e indicador', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'catalogo-produtos-loteamento-alv' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'a tabela por % da ALV não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Catálogo de Produtos: as cores do cadastro por % da ALV resolvem em todas as variantes de tema', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'catalogo-produtos-loteamento-alv', larguras: [1280] });

  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

// Render da permuta física por produto: a coluna "Unidades permutadas" está na
// tabela do catálogo de Produtos, e a aba Permutas desabilita os campos por área
// da categoria cuja permuta vem do catálogo — e só dela.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';
import type { MedidaPermutaProduto } from './casos/permutas-permuta-por-produto.js';

const pular = await motivoParaPular();

test('Permuta por produto: a coluna Unidades permutadas está na tela do catálogo', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'catalogo-produtos-permuta', larguras: [1280] });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'a coluna Unidades permutadas não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Permuta por produto: a aba Permutas desabilita só a categoria cuja permuta vem do catálogo', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'permutas-permuta-por-produto', larguras: [1280] });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'a aba Permutas não montou o esperado' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const m = a.extra?.['1280'] as MedidaPermutaProduto | undefined;
  assert.ok(m, 'o caso não devolveu a medida — `medir()` não rodou' + relato(a));
  assert.equal(m!.camposPermutaFisica, 2, 'a aba Permutas tem que desenhar os dois campos de permuta física' + relato(a));
  assert.equal(m!.desabilitadosResidencial, true,
    'a residencial tem produto permutado: o campo por área tem que sair desabilitado' + relato(a));
  assert.equal(m!.desabilitadosNaoResidencial, false,
    'a não residencial não tem produto permutado: o campo por área continua habilitado' + relato(a));
  assert.equal(m!.avisos, 1, 'um aviso, só da categoria que vem do catálogo' + relato(a));
  assert.match(m!.textoAviso, /vem do catálogo de produtos/, 'o aviso tem que dizer de onde vem a permuta' + relato(a));
});

test('Permuta por produto: as cores resolvem em todas as variantes de tema', { skip: pular ?? false }, async () => {
  for (const caso of ['catalogo-produtos-permuta', 'permutas-permuta-por-produto']) {
    const a = await verificarRender({ caso, larguras: [1280] });
    assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
    assert.deepEqual(tokensSemValor(a), [], `${caso}: token citado pelo CSS não resolve em alguma variante` + relato(a));
    assert.deepEqual(textosInvisiveis(a), [], `${caso}: texto pintado da mesma cor do próprio fundo` + relato(a));
  }
});

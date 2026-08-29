// Render da cascata de áreas do LOTEAMENTO com as deduções estouradas — #612.
//
// Ver o topo de `casos/cascata-areas-loteamento-deficit.ts` para o que ele mede
// e o que não mede. Em uma frase: é o único ponto do repositório que exige o
// AVISO do piso em zero na tela — o piso em si é do motor, e o motor está
// coberto por `frontend/areas-cascata.test.ts`.
//
// #621 — este caso rodava só a 1280px (`larguras: [1280]`), porque montar esta
// tela pela primeira vez tinha exposto um defeito de layout alheio ao #612: o
// ramo `if (lot)` de `tela-premissas.ts` nunca tinha ido a DOM, e `.area-seletor`
// (3 badges + `viab-num` de 130px, `flex-wrap: nowrap`) media 251px contra
// células de 219px (600px de viewport) e 245px (900px) — 6 transbordos de
// caixa + 6 sobreposições nas duas larguras. Consertado em `table.areas`
// (`frontend/tela-premissas.ts`, ver o comentário lá) com `min-width`, que
// força o auto-layout a respeitar o conteúdo mínimo das colunas antes de
// espremer, rolando o excedente dentro do `.areas-wrap` já existente. A
// restrição de largura não é mais necessária — a lista padrão do harness
// (1280/900/600) roda limpa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Terreno & Áreas (Loteamento): a cascata monta com as 11 linhas e o aviso de área negativa', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-areas-loteamento-deficit' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Terreno & Áreas (Loteamento): nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-areas-loteamento-deficit', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

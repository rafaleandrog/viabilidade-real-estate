// Render da cascata de áreas do LOTEAMENTO com as deduções estouradas — #612.
//
// Ver o topo de `casos/cascata-areas-loteamento-deficit.ts` para o que ele mede
// e o que não mede. Em uma frase: é o único ponto do repositório que exige o
// AVISO do piso em zero na tela — o piso em si é do motor, e o motor está
// coberto por `frontend/areas-cascata.test.ts`.
//
// ⚠️ **POR QUE `larguras: [1280]` E NÃO A LISTA PADRÃO (1280/900/600).** Montar
// esta tela pela primeira vez expôs um defeito de layout que NÃO é desta issue
// e que ninguém tinha visto porque o ramo `if (lot)` de `tela-premissas.ts`
// nunca tinha ido a DOM nenhum: `div.area-seletor` (os 3 badges de unidade +
// o `viab-num` de 130px das 7 linhas editáveis) tem `flex-wrap: nowrap` e mede
// **251px**, enquanto a célula que o contém mede 219px a 600px e 245px a 900px
// — 6 transbordos de caixa e 6 sobreposições do input sobre a coluna "Área
// (m²)" ao lado, medidos nesta branch. A 1280px a tela é **limpa** (0 achados
// em todas as lentes).
//
// Não é conserto desta issue (regra R3: um assunto por PR) e não é regressão
// do diff — o piso em zero não move largura nenhuma. A largura está declarada
// aqui, com o número medido, em vez de a lente ficar vermelha por um defeito
// alheio; a mesma escolha explícita que `kpis-fluxo.render.test.ts` faz. O
// achado está no corpo do PR para virar issue própria — a correção provável é
// o `table.areas` deixar de ser espremido em `width: 100%` e passar a rolar
// dentro do `.areas-wrap`, que já tem `overflow-x: auto` para isso.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Terreno & Áreas (Loteamento): a cascata monta com as 11 linhas e o aviso de área negativa', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-areas-loteamento-deficit', larguras: [1280] });

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

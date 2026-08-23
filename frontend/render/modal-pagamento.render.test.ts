// Render do modal FLUXO DE PAGAMENTO (Receitas do Avançado).
//
// A tela mais densa do app em campos por linha: três blocos de `viab-num` em
// grade dentro de um `urbi-modal` de 860px. Densidade assim é onde campo
// espremido aparece primeiro, e nada disso existe fora do render.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho — ele carrega as declarações
// `:host` reais, mas não o overlay nem o posicionamento internos, que
// `docs/ui-urbiverso/` não espelha. Logo: este teste julga o layout do
// CONTEÚDO do modal, e NÃO o comportamento do primitivo por dentro.
//
// 🔴 E há um detalhe que quase tornou este caso inútil. O `:host` do
// `urbi-modal` é `position: fixed; inset: 0` com flex centrado — ou seja, o
// FUNDO de tela inteira. Quem carrega o `max-width: 860px` é o painel interno,
// que o espelho não conhece. Até o PR 506 o stub não aplicava nada: o painel
// media 1176px em viewport de 1280 (`max-width: none`), a grade de pagamento era
// medida contra a largura livre do host e transbordo real produzia ZERO achados.
// Hoje `PROPS_QUE_DIMENSIONAM` em `scripts/render-check.mjs` aplica a prop ao
// painel, e o painel mede 860px — a restrição que o modal de verdade impõe.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, lacunasEmUso, larguraComOverflowDeDocumento, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Modal de Pagamento: a grade de campos cabe em 1280/900/600px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-pagamento' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o modal empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(lacunasEmUso(a), [], 'prop de tamanho que o stub não honra' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Modal de Pagamento: nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-pagamento', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

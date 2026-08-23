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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, larguraComOverflowDeDocumento, motivoParaPular, relato, textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Modal de Pagamento: a grade de campos cabe em 1280/900/600px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-pagamento' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o modal empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
});

test('Modal de Pagamento: nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-pagamento', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

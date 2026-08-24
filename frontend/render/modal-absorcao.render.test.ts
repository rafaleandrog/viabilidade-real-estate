// Render do modal ABSORÇÃO DE VENDAS (Receitas do Avançado).
//
// #431: além da geometria, este arquivo é o único lugar do repositório que
// prova que o `urbi-banner variante="alerta"` da curva não representável chega
// à TELA. A decisão de exibi-lo é função pura testada em
// `fluxo-absorcao-editor.test.ts`; a FIAÇÃO entre a função e o template só
// existe aqui — o `exigir` do caso é quem a mede.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: carrega as declarações `:host`
// reais, mas não o overlay nem o posicionamento internos, que
// `docs/ui-urbiverso/` não espelha. Este teste julga o layout do CONTEÚDO do
// modal, e não o comportamento do primitivo por dentro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Modal de Absorção: a tabela, o gráfico e o aviso cabem em 1280/900/600px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-absorcao' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o modal empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Modal de Absorção: nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-absorcao', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

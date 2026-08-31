// Render do modal de Fluxo de pagamento num Grupo de plano LEGADO (#585).
//
// O caso irmão (`modal-pagamento`) monta o mesmo modal com `componentes`
// persistidos; este monta sem eles. A única diferença entre os dois é a chave
// que decide o motor de recebíveis — e, portanto, o único bloco de layout novo
// é o aviso `p.plano-legado`, declarado em `exigir`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Modal de pagamento (plano legado): o aviso cabe no modal nas três larguras', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-pagamento-legado', larguras: [1280, 900, 600] });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o modal empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Modal de pagamento (plano legado): o aviso não é texto invisível nem token sem valor', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-pagamento-legado', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

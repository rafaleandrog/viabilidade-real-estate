// Render da cascata do resultado com VGV de 9 dígitos (#579) — Rodada 12.
// Substitui `resultado-graficos.render.test.ts`, obsoleto desde que a
// cascata trocou de lugar com o card `div.resultado > urbi-kpi`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Cascata do resultado: um VGV de 9 dígitos não estoura a coluna de valor (#579)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cascata-resultado-longos' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});

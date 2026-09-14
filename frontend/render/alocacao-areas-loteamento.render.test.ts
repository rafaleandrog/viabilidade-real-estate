// Render da aba Gráficos de um LOTEAMENTO — #574.
//
// Primeiro caso de render deste repositório montado sobre um estudo de
// Loteamento: até ele, os ramos `if (lot)` das telas do Preliminar nunca
// tinham sido montados em DOM nenhum. Ver o topo de
// `casos/alocacao-areas-loteamento.ts` para o que ele mede e o que não mede.
//
// ⚠️ Rodada 12 — a cascata do resultado (`viab-grafico-cascata`) também
// monta aqui; o transbordo de texto/corte por overflow oculto dela é
// reportado e não asseverado, mesmo padrão de `grafico-cascata.render.test.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Gráficos (Loteamento): a aba monta inteira, com a pizza da gleba e a cascata do resultado', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'alocacao-areas-loteamento' });

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

test('Gráficos (Loteamento): nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'alocacao-areas-loteamento', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

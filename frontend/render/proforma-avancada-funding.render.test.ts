// Render da PROFORMA do Avançado com funding — prova de FIAÇÃO das DUAS
// linhas informativas do rodapé (funding, #447; "Receita líquida de
// proforma" da EVI, #465).
//
// A geometria não é o ponto principal aqui (embora as mesmas lentes rodem,
// de graça, por cima do que já se mede). O ponto é que `exigir` só passa se
// `tela-fluxo-ver.ts` de fato chamou `linhaInformativaFunding` **e**
// `linhaInformativaReceitaLiquidaEvi` e anexou os dois resultados antes de
// render — ver a nota no topo de
// `frontend/render/casos/proforma-avancada-funding.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Proforma do Avançado: a linha informativa do funding chega à tela (fiação, não só cálculo)', { skip: pular ?? false }, async () => {
  // `exigir: [{ seletor: 'tr.informativo', minimo: 1 }]` é a prova: sem a
  // chamada em `_renderProforma`, o caso não monta o que declara e o harness
  // rejeita — em vez de reportar "limpo" para uma linha que nunca desenhou.
  const a = await verificarRender({ caso: 'proforma-avancada-funding' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Proforma do Avançado (com funding): nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-avancada-funding', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
});

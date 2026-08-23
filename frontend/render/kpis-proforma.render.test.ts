// Render dos KPIs da PROFORMA — o CASO DE CONTROLE.
//
// Mesma grade de `urbi-kpi` do Resumo, mesmo primitivo, mesmo box model. A
// única diferença é `frontend/tela-proforma.ts:53`, que usa `min-width: 0` em
// vez de impor largura: o card encolhe com a célula em vez de estourá-la.
//
// ⚠️ Se ESTE arquivo ficar vermelho, o suspeito é o harness, não o app. Um
// verificador que acusa o padrão certo junto com o errado não distingue nada, e
// a primeira coisa que se faz com um verificador assim é desligá-lo — ver a
// nota sobre falso positivo em `scripts/guard-box-model-urbi.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, lacunasEmUso, larguraComOverflowDeDocumento, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('KPIs da Proforma: min-width:0 não estoura a célula em 1280/900/600px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-proforma' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'controle transbordou — suspeite do harness' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'controle sobrepôs — suspeite do harness' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));

  // A medida só vale se o stub soube reproduzir as restrições de tamanho em
  // jogo. Prop de dimensão não mapeada torna a caixa medida MENOS restrita que
  // a real — e "limpo" numa caixa mais folgada não prova nada.
  assert.deepEqual(lacunasEmUso(a), [], 'prop de tamanho que o stub não honra' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('KPIs da Proforma: as cores resolvem em todas as variantes de tema do espelho', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-proforma', larguras: [1280] });

  // O NÚMERO de variantes vem do dado, não daqui: `docs/ui-urbiverso/tokens.json`
  // guarda, por token, todos os valores que ele assume. Cravar "4" neste teste
  // faria dele o único lugar do repositório a saber quantos temas existem — e o
  // lugar que ficaria errado quando o shell ganhasse o quinto.
  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

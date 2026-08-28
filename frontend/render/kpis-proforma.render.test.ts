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
//
// #579 ("o VALOR salta para fora do quadro do KPI") — o teste NOVO no fim
// deste arquivo mede o defeito IRMÃO com um caso PRÓPRIO (`kpis-proforma-longos`),
// para não perturbar a calibração do caso de controle acima. ⚠️ Este é um dos
// casos (ver `comp-analise-mercado.render.test.ts` para o outro) em que a
// mutação NÃO fecha vermelho — motivo medido no topo de `casos/kpis-proforma-longos.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
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
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
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

// #579 ("o VALOR salta para fora do quadro do KPI") — caso PRÓPRIO
// (`kpis-proforma-longos`), não uma edição do caso de controle acima: aquele
// existe para calibrar o harness com valores pequenos (ver o comentário no
// topo dele). `_renderKpis` desta tela não mostra R$ — "Área vendável"
// carrega os 9 dígitos aqui (ver o comentário no topo do caso, inclusive a
// nota MEDIDA de que a mutação não fecha vermelho para esta faixa).
test('KPIs da Proforma: uma "Área vendável" de 9 dígitos não salta da caixa (#579)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-proforma-longos' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algum urbi-kpi estourou a track' + relato(a));
  assert.equal(
    contar(a, 'transbordoDeTexto'), 0,
    'Um valor de KPI (9 dígitos) saltou para fora do quadro — #579.' + relato(a),
  );
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois cards se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

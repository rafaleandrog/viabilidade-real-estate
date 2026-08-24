// Render dos medidores vs. benchmark — aba Gráficos (Preliminar), #451.
//
// Este arquivo é o único lugar do repositório que prova que
// `resolverIndicadoresBenchmark` e o `foraEscala` de `montarMedidor` chegam
// à TELA — ver o topo de `casos/medidores-graficos.ts` para a explicação
// completa de por que o cálculo puro sozinho não basta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Medidores vs. benchmark: os 4 indicadores e o aviso de fora da escala chegam à tela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'medidores-graficos' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Medidores vs. benchmark: nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'medidores-graficos', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

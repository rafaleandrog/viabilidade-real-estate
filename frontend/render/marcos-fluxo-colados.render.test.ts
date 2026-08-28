// Render dos rótulos de marco no topo dos gráficos de Fluxo de Caixa — #582.
//
// Ver o topo de `casos/marcos-fluxo-colados.ts` para por que este caso
// precisa de render em Chromium (mede a FIAÇÃO, não o cálculo) e por que as
// duas instâncias (Incorporação/Loteamento) bastam para os dois critérios de
// aceite extremos (#582.1 e #582.2) e para a paridade entre padrões (#582.6).
//
// A lente decisiva é `sobreposicaoTexto` — nova neste PR, complementar à
// `sobreposicao` de "caixas pintadas" que `scripts/render-check.mjs` já
// tinha (e que exclui toda forma de SVG de propósito).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Marcos do Fluxo de Caixa: rótulos colados não se sobrepõem (Incorporação e Loteamento)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'marcos-fluxo-colados' });

  assert.equal(contar(a, 'sobreposicaoTexto'), 0, 'rótulo de marco/Payback/Exposição Máx. sobreposto' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

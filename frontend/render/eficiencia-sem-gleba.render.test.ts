// Render do KPI "Vendável / gleba" sem área de gleba — #611.
//
// Ver o topo de `casos/eficiencia-sem-gleba.ts` para como a ausência de cor é
// provada com um `exigir` que só sabe exigir presença (contagem de
// `urbi-kpi[variante=""]`). Em uma frase: é o único ponto do repositório que
// enxerga o componente deixando de pintar — trocar `eficienciaParaFaixa(p)` de
// volta por `p.eficienciaPct` no template não derruba teste de lógica pura
// nenhum.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Premissas → Produtos (Loteamento sem gleba): os 6 KPIs do Resumo saem sem cor', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'eficiencia-sem-gleba' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Premissas → Produtos (Loteamento sem gleba): nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'eficiencia-sem-gleba', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});

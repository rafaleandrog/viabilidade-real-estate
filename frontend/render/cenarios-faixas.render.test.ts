// Render das faixas bear–base–bull contra o benchmark (#731): os dois
// indicadores em % da aba Cenários saem como `viab-faixa-cenarios`, com as
// faixas do benchmark ao fundo (invertidas na regra "não exceder"), três
// marcadores numa escala só e os valores à direita — sem badge de indicador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato, contar, larguraComOverflowDeDocumento, tokensSemValor } from './apoio.js';

const pular = await motivoParaPular();

test('#731: os dois indicadores viram faixas contra o benchmark, numa escala só, sem pílulas', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-faixas' });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));

  const g = a.extra?.['900'] as {
    rotulos: string[]; segmentosPorFaixa: number[]; marcadoresPorFaixa: number[];
    coresPrimeiroSegmento: string[]; valores: string[][]; badgesDeIndicador: number; ordemMarcadores: string[][];
  } | undefined;
  assert.ok(g, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.deepEqual(g!.rotulos, ['Custo obras / VGV', 'Margem sobre VGV'], 'faltou faixa de indicador' + relato(a));
  // "Custo obras / VGV" (não exceder, sem cortes): 2 faixas, verde EMBAIXO.
  // "Margem sobre VGV" (atingir ou superar, 3 cortes): 3 faixas, vermelho embaixo.
  assert.deepEqual(g!.segmentosPorFaixa, [2, 3], 'os segmentos das faixas não batem com o benchmark' + relato(a));
  assert.match(g!.coresPrimeiroSegmento[0], /cor-sucesso/, '"não exceder" tem que ter verde na região baixa' + relato(a));
  assert.match(g!.coresPrimeiroSegmento[1], /cor-erro/, '"atingir ou superar" tem que ter vermelho na região baixa' + relato(a));
  assert.deepEqual(g!.marcadoresPorFaixa, [3, 3], 'cada faixa tem que desenhar os três marcadores' + relato(a));
  // Escala única: estressando o PREÇO, o custo/VGV é maior no Bear (VGV menor)
  // e a margem menor — a ordem no trilho é a ordem dos valores, e ela só é
  // legível se os três marcadores dividem a mesma escala.
  assert.deepEqual(g!.ordemMarcadores[0], ['bull', 'base', 'bear'], 'Custo obras / VGV: Bull < Base < Bear no trilho' + relato(a));
  assert.deepEqual(g!.ordemMarcadores[1], ['bear', 'base', 'bull'], 'Margem sobre VGV: Bear < Base < Bull no trilho' + relato(a));
  for (const v of g!.valores) {
    assert.equal(v.length, 3);
    for (const t of v) assert.match(t, /\d+,\d%$/, `valor fora do formato de percentual: "${t}"` + relato(a));
  }
  assert.equal(g!.badgesDeIndicador, 0, 'sobrou badge de indicador com benchmark válido' + relato(a));
});

test('#731: as cores das faixas resolvem em todas as variantes de tema', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-faixas', larguras: [1280] });
  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
});

// Render de <viab-grafico-tornado> standalone (Rodada 13, issue #728).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, tokensSemValor,
  motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Tornado de alavancas: linhas, trilhos, eixo e barras chegam à tela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grafico-tornado' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'var() citado pelo CSS sem valor em alguma variante de tema' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const m = a.extra?.['900'] as {
    selecionouPorClique: string | null; selecionouPorEnter: string | null;
    larguraPrecoPx: number; larguraObraPx: number; larguraPermutaFinPx: number;
    rotulosValor: string[];
  } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  // Seleção por clique e por teclado (Enter) — a única camada que enxerga se
  // o componente REAGE, e não só se `role`/`tabindex` estão marcados.
  assert.equal(m!.selecionouPorClique, 'custo_obras', 'clique na linha de custo de obra não emitiu o evento com a variável certa' + relato(a));
  assert.equal(m!.selecionouPorEnter, 'permuta_financeira', 'Enter na linha de permuta financeira não emitiu o evento' + relato(a));

  // A PROVA DE ESCALA: a barra é proporcional à amplitude, escalada pela
  // MAIOR do conjunto (preço, 8.000.000) — não pela primeira que aparece na
  // tela por acaso. Achado mais caro da Rodada 12 (PR #707): escalar pela
  // primeira em vez de pela maior.
  assert.ok(m!.larguraPrecoPx > 0, 'a barra de preço deveria ter largura > 0' + relato(a));
  const razaoObra = m!.larguraObraPx / m!.larguraPrecoPx;
  const razaoPermutaFin = m!.larguraPermutaFinPx / m!.larguraPrecoPx;
  // Custo de obra: amplitude 3.200.000 / 8.000.000 = 0,4 — tolerância para
  // arredondamento de subpixel do layout do Chromium.
  assert.ok(Math.abs(razaoObra - 0.4) < 0.05, `razão obra/preço=${razaoObra} esperado≈0,4` + relato(a));
  // Permuta financeira: amplitude 600.000 / 8.000.000 = 0,075.
  assert.ok(Math.abs(razaoPermutaFin - 0.075) < 0.05, `razão permutaFin/preço=${razaoPermutaFin} esperado≈0,075` + relato(a));

  // Rótulo "±X,X%" — nunca um percentual de 4 dígitos.
  const FORMATO = /^±\d{1,3},\d%$/;
  assert.ok(m!.rotulosValor.length >= 5, `esperava ao menos 5 rótulos de valor, leu ${m!.rotulosValor.length}` + relato(a));
  assert.deepEqual(
    m!.rotulosValor.filter((t) => !FORMATO.test(t)), [],
    'rótulo de barra fora do formato ±X,X%' + relato(a),
  );

  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});

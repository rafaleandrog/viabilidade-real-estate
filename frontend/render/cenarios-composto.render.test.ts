// Render do cenário composto (#735): item no topo do tornado, cabeçalho
// declarando as três premissas, e o Bear composto pior que o Bear isolado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato, contar, larguraComOverflowDeDocumento } from './apoio.js';

const pular = await motivoParaPular();

const numero = (celula: string) => {
  // "(1.234.567)" → −1234567 · "1.234.567" → 1234567
  const neg = celula.startsWith('(');
  const n = Number(celula.replace(/[().\s]/g, '').replace(',', '.'));
  return neg ? -n : n;
};

test('#735: o cenário composto é o item do topo do tornado, declara as três premissas e é pior que o Bear isolado', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-composto' });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));

  const g = a.extra?.['900'] as {
    primeiraLinha: string; primeiraEhComposto: boolean; nLinhas: number;
    resultadoBearPreco: string; cabecalhoBearComposto: string; resultadoBearComposto: string;
    subtitulo: string; compostoAtivoDepoisDoClique: boolean;
  } | undefined;
  assert.ok(g, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(g!.primeiraEhComposto, true, 'o composto não é o item do topo do tornado' + relato(a));
  assert.match(g!.primeiraLinha, /^Cenário composto \(.+ \+ .+ \+ .+\)$/, 'o rótulo do composto não declara as três premissas' + relato(a));
  assert.equal(g!.nLinhas, 6, '5 alavancas + 1 composto' + relato(a));
  assert.equal(g!.compostoAtivoDepoisDoClique, true, 'clicar no composto não o seleciona' + relato(a));
  // Cabeçalho: "📉 Bear −10% Preço de venda · +10% Custo de obra · +10% …"
  assert.match(g!.cabecalhoBearComposto, /Bear −10% .+ · \+10% .+ · [+−]10% .+/, 'o cabeçalho do Bear composto não declara as três premissas com o sentido' + relato(a));
  assert.match(g!.subtitulo, /Cenário estressado: Cenário composto/, 'o subtítulo da tabela não declara o composto' + relato(a));
  // O Bear composto é PIOR que o Bear do preço isolado — o ponto do handoff.
  assert.ok(numero(g!.resultadoBearComposto) < numero(g!.resultadoBearPreco),
    `Resultado do Bear composto (${g!.resultadoBearComposto}) deveria ser pior que o do Bear de preço (${g!.resultadoBearPreco})` + relato(a));
});

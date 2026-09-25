// Render da tabela de sensibilidade com a variável "Permuta financeira" (#730):
// as linhas que não se movem saem para o grupo recolhido, com a contagem no
// rótulo; o cabeçalho declara o estresse; os Δ% aparecem nas linhas visíveis.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato, contar, larguraComOverflowDeDocumento } from './apoio.js';

const pular = await motivoParaPular();

test('#730: Cenários com permuta financeira — 4 linhas visíveis, 4 recolhidas com a contagem no rótulo, cabeçalho com o estresse', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-invariantes' });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  // Sete colunas nas três larguras: a tabela tem `min-width` e o `.pf-wrap`
  // rola — nada transborda e o documento não rola na horizontal.
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));

  const g = a.extra?.['900'] as {
    resumo: string; visiveis: string[]; recolhidas: string[]; recolhidasVisiveisAoAbrir: number;
    fechadoAoMontar: boolean; cabecalhoBear: string; deltas: string[];
  } | undefined;
  assert.ok(g, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(g!.fechadoAoMontar, true, 'o grupo de invariantes tem que nascer RECOLHIDO' + relato(a));
  assert.equal(g!.recolhidasVisiveisAoAbrir, 4, 'ao abrir o grupo, as 4 linhas têm que ganhar caixa' + relato(a));
  assert.deepEqual(g!.visiveis, ['Deduções sobre VGV', 'Receita líquida', 'Receita operacional', 'Resultado'], 'as linhas visíveis não são as que se movem' + relato(a));
  assert.deepEqual(g!.recolhidas, ['VGV', 'Receita bruta', 'Custo direto total', 'Custo indireto total'], 'o grupo recolhido não tem as linhas invariantes' + relato(a));
  assert.equal(g!.resumo, '4 linhas não afetadas por esta variável', 'o rótulo do grupo recolhido não traz a contagem certa' + relato(a));
  assert.match(g!.cabecalhoBear, /Bear \+10% Permuta financeira/, 'o cabeçalho do Bear não declara o estresse aplicado' + relato(a));
  // Δ% em toda linha visível, dos dois lados, com sinal explícito.
  assert.equal(g!.deltas.length, 8, 'faltou célula de Δ%' + relato(a));
  assert.deepEqual(g!.deltas.filter((d) => !/^[+-]\d+,\d%$/.test(d)), [], 'Δ% fora do formato' + relato(a));
});

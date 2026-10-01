// Render da semeadura das linhas obrigatórias de Custos (#802). Ver o topo de
// `casos/custos-semeadura.ts` para o porquê de medir aqui — duas instâncias da
// tela no mesmo estudo, que é fiação do componente e não cálculo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaSemeadura } from './casos/custos-semeadura.js';

const pular = await motivoParaPular();

const UMA_DE_CADA = {
  'terreno::Preço': 1,
  'obra::Construção': 1,
  'diretos::Corretagem de vendas': 1,
};

test('#802: duas instâncias de Custos no mesmo estudo sem obrigatórias semeiam exatamente 1 linha de cada; remontar (ou carregar lista velha) continua 1', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'custos-semeadura', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaSemeadura | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.deepEqual(m!.porCategoria, UMA_DE_CADA, 'as duas instâncias semearam em duplicidade' + relato(a));
  assert.equal(m!.posts, 3, 'um POST por obrigatória, não um por instância' + relato(a));
  assert.deepEqual(m!.custosPorInstancia, [3, 3], 'cada instância tem de mostrar as 3 linhas, sem repetir' + relato(a));

  assert.deepEqual(m!.porCategoriaRemontado, UMA_DE_CADA, 'remontar a tela criou linha a mais' + relato(a));
  assert.equal(m!.postsRemontado, 3, 'remontar a tela não pode mandar POST nenhum' + relato(a));

  // A carga inicial veio velha (outra aba semeou depois): a reconsulta do
  // servidor antes de criar é o que impede a 2ª semeadura.
  assert.deepEqual(m!.porCategoriaListaVelha, UMA_DE_CADA, 'a tela semeou de novo a partir de uma lista velha' + relato(a));
  assert.equal(m!.postsListaVelha, 3, 'com lista velha a tela tem de reconsultar, não mandar POST' + relato(a));
});

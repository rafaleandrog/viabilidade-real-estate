// Render do botão "Gerar otimista, base e pessimista" da aba Cenários do
// Avançado (#889). Ver o topo de `casos/cenarios-gerar-padrao.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaGerarPadrao } from './casos/cenarios-gerar-padrao.js';

const pular = await motivoParaPular();

const COLUNAS = [
  'Cenário', 'Preço venda', 'Custo obra', 'Velocidade', 'VGV', 'Resultado', 'Margem',
  'VPL', 'TIR', 'Payback', 'Exposição máx.',
];

test('Cenários do Avançado: quem escreve gera os três cenários pré-preenchidos, e a tabela compara seis indicadores', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-gerar-padrao', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaGerarPadrao | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.equal(m!.temBotao, true, relato(a));
  assert.deepEqual(m!.colunas, COLUNAS, relato(a));
  // Faixas do caso: preço −20..+10, custo −5..+8, velocidade −30..+25.
  assert.deepEqual(m!.dialogo, [
    { nome: 'Otimista', preco: 10, custo: -5, velocidade: 25 },
    { nome: 'Base', preco: 0, custo: 0, velocidade: 0 },
    { nome: 'Pessimista', preco: -20, custo: 8, velocidade: -30 },
  ], relato(a));
});

test('Cenários do Avançado: quem não escreve não vê o botão de gerar, e vê as mesmas colunas', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-gerar-padrao-leitor', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaGerarPadrao | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.equal(m!.temBotao, false, relato(a));
  assert.deepEqual(m!.colunas, COLUNAS, relato(a));
  assert.deepEqual(m!.dialogo, [], relato(a));
});

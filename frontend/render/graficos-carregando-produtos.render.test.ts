// Render da aba Gráficos do Preliminar com o catálogo ainda carregando: o
// estado vazio NÃO aparece e o ramo normal sim. Ver
// `casos/graficos-carregando-produtos.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Gráficos com catálogo carregando: sem piscar o estado vazio', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'graficos-carregando-produtos', larguras: [900] });

  const m = a.extra?.['900'] as { estadoVazio: number; estadoVazioWrapper: number; kpis: number } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(m.kpis, 1, 'o ramo normal (faixa de KPIs) deveria estar na tela' + relato(a));
  assert.equal(m.estadoVazio, 0, 'o estado vazio piscou antes do catálogo carregar' + relato(a));
  assert.equal(m.estadoVazioWrapper, 0, 'o wrapper do estado vazio piscou antes do catálogo carregar' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
});

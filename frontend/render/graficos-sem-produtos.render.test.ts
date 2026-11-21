// Render da aba Gráficos do Preliminar com o catálogo carregado e vazio: o
// estado vazio está na tela e a cascata não. Ver `casos/graficos-sem-produtos.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Gráficos sem catálogo: só o estado vazio na tela, sem cascata', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'graficos-sem-produtos', larguras: [900] });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'o estado vazio não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  // Ausência da cascata e da faixa de KPIs, medida no DOM (`medir`): o
  // `naoDeclaradas` só enxerga primitivos do espelho, não `viab-*`.
  const m = a.extra?.['900'] as { cascata: number; kpis: number } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(m.cascata, 0, 'a cascata apareceu sem catálogo' + relato(a));
  assert.equal(m.kpis, 0, 'a faixa de KPIs apareceu sem catálogo' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

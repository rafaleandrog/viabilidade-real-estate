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
  const a = await verificarRender({ caso: 'graficos-sem-produtos' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'o estado vazio não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  // Ausência da cascata/medidores: o caso não declara as props deles, então
  // se voltarem a renderizar entram em uso sem declaração.
  assert.deepEqual(naoDeclaradas(a), [], 'prop não declarada — a aba voltou a desenhar gráficos sem catálogo' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

// Render do banner de preço sugerido de Premissas → Produtos com o catálogo
// carregado e vazio: pede o cadastro, não "inatingível". Ver
// `casos/premissas-preco-sugerido-sem-produtos.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, naoDeclaradas, motivoParaPular, relato } from './apoio.js';
import { PRECO_SUGERIDO_SEM_PRODUTOS, PRECO_SUGERIDO_INATINGIVEL } from '../sem-produtos.js';

const pular = await motivoParaPular();

test('Premissas sem catálogo: o banner do preço sugerido pede o cadastro', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'premissas-preco-sugerido-sem-produtos', larguras: [900] });

  const m = a.extra?.['900'] as { banners: string[] } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  const banner = m.banners.find((t) => t.includes('Preço sugerido'));
  assert.ok(banner, 'o banner do preço sugerido não apareceu: ' + JSON.stringify(m.banners) + relato(a));
  assert.ok(banner.includes(PRECO_SUGERIDO_SEM_PRODUTOS), 'o banner não pede o cadastro dos produtos: ' + banner + relato(a));
  assert.ok(!banner.includes(PRECO_SUGERIDO_INATINGIVEL), 'o banner voltou a dizer "inatingível" sem catálogo: ' + banner + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
});

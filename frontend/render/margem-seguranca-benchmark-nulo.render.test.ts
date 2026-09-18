// Rodada 13 (achado do App do Codex, PR #757, rodada 3) — um benchmark de
// margem-alvo LIMPO (`valor: null`, estado que `POST /benchmarks` grava de
// propósito) tinha que cair no fallback de 20%, não virar meta 0% em
// silêncio. Ver o cabeçalho de `casos/margem-seguranca-benchmark-nulo.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Margem de segurança: benchmark de margem-alvo nulo cai no fallback de 20%, não vira meta 0%', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'margem-seguranca-benchmark-nulo' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'o cartão "Terreno máximo" não citou o fallback de 20%' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

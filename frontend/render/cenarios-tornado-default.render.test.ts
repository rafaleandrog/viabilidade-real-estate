// Rodada 13 (#729) — a seleção inicial do tornado é a alavanca de MAIOR
// amplitude, não o literal `'preco'`. Ver o cabeçalho de
// `casos/cenarios-tornado-default.ts` para o porquê do fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Cenários: o tornado abre com a alavanca de maior amplitude ativa, não com "preco" fixo', { skip: pular ?? false }, async () => {
  // O `exigir` do caso já reprova se a linha ativa não for exatamente
  // 'custo_obras' — é ele a prova; aqui confere-se que a montagem não
  // quebrou em nenhuma das outras dimensões.
  const a = await verificarRender({ caso: 'cenarios-tornado-default' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'a seleção automática não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

// Rodada 13 (achado do App do Codex, PR #757, rodada 4) — quando o resultado
// fica positivo em toda a faixa de estresse, o cartão de margem de segurança
// tem que dizer isso, não "não atinge o ponto de equilíbrio" (o oposto da
// verdade). Ver o cabeçalho de `casos/margem-seguranca-sempre-positivo.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Margem de segurança: resultado sempre positivo cita isso, não "não atinge o ponto de equilíbrio"', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'margem-seguranca-sempre-positivo' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'o cartão não citou o resultado sempre positivo' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

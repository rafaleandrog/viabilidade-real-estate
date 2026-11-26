// Render do `rotulo-acessivel` do `viab-num` (#908). Ver `casos/viab-num-nome-acessivel.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaNomeAcessivel } from './casos/viab-num-nome-acessivel.js';

const pular = await motivoParaPular();

test('viab-num: rotulo-acessivel nomeia input e stepper sem label; com label, o label manda', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'viab-num-nome-acessivel', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaNomeAcessivel | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.equal(m!.soAcessivel.input, 'Início de Obras', relato(a));
  assert.deepEqual(m!.soAcessivel.botoes, ['Aumentar Início de Obras', 'Diminuir Início de Obras'], relato(a));
  assert.equal(m!.comLabelEAcessivel.input, null, relato(a));
  assert.deepEqual(m!.comLabelEAcessivel.botoes, ['Aumentar Duração', 'Diminuir Duração'], relato(a));
});

// Render do nome acessível dos botões do stepper do `viab-num` (#908).
// Ver o topo de `casos/viab-num-stepper.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaStepperNum } from './casos/viab-num-stepper.js';

const pular = await motivoParaPular();

test('viab-num: os botões do stepper levam o rótulo do campo no nome acessível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'viab-num-stepper', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaStepperNum | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.deepEqual(m!.comRotulo, ['Aumentar Área do terreno', 'Diminuir Área do terreno'], relato(a));
  assert.deepEqual(m!.semRotulo, ['Aumentar', 'Diminuir'], relato(a));
});

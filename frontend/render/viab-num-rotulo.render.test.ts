// Render do rótulo ligado ao campo do `viab-num` (#908).
// Ver o topo de `casos/viab-num-rotulo.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaRotuloNum } from './casos/viab-num-rotulo.js';

const pular = await motivoParaPular();

test('viab-num: o rótulo visível é o nome acessível do input', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'viab-num-rotulo', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaRotuloNum | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.equal(m!.comRotulo.length, 1, 'o input não tem <label> associado' + relato(a));
  assert.match(m!.comRotulo[0], /^Área do terreno$/i, relato(a));
  assert.deepEqual(m!.comObrigatorio, ['Preço por m²'], 'campo obrigatório sem rótulo associado' + relato(a));
  // Sem rótulo: nenhum nome inventado.
  assert.equal(m!.semRotuloLabels, 0, relato(a));
  assert.equal(m!.semRotuloAriaLabel, null, relato(a));
  assert.equal(m!.idsDistintos, true, 'o id do input não é único por instância' + relato(a));
});

// Render do aviso de alíquota inválida no regime oculto (#834, fatia 3). Ver o
// topo de `casos/custos-imposto-aviso-oculto.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaAvisoOculto } from './casos/custos-imposto-aviso-oculto.js';

const pular = await motivoParaPular();

test('#834 Custos › Financeiro: alíquota inválida no regime oculto aparece como aviso', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'custos-imposto-aviso-oculto', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaAvisoOculto | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.match(m!.aviso, /alíquota do imposto padrão está fora de 0 a 100/, relato(a));
  assert.equal(m!.avisoValido, '', 'o aviso ficou depois de a alíquota voltar a ser válida' + relato(a));
});

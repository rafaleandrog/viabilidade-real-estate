// Render: o Núcleo grava a área do terreno com as Premissas montadas e um
// rascunho em outro campo; depois de trocar de página e salvar, o PATCH leva
// só a edição — nunca a área velha. Ver `casos/premissas-rascunho-nucleo.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Premissas: área gravada pelo Núcleo com a tela montada não é desfeita pelo Salvar do rascunho', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'premissas-rascunho-nucleo', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const m = a.extra?.['1280'] as { formArea: unknown; patches: Record<string, unknown>[] } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(m!.patches.length, 1, `o Salvar não chegou ao PATCH: ${JSON.stringify(m!.patches)}` + relato(a));
  assert.equal(m!.patches[0].custo_decoracao_m2, 150, 'a edição do usuário não foi salva' + relato(a));
  assert.ok(!('area_terreno_nucleo' in m!.patches[0]),
    `o Salvar mandou a área VELHA do terreno, desfazendo o Núcleo: ${JSON.stringify(m!.patches[0])}` + relato(a));
  assert.equal(String(m!.formArea), '1000.00', 'o formulário montado ficou com a área velha do terreno' + relato(a));

  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
});

// Render da Proforma com permuta SÓ financeira: o KPI "Área permutada" não pode
// dizer "0 m²".
//
// Mede a FIAÇÃO: apagar a chamada de `kpiAreaPermutada` em `tela-proforma.ts`
// deixa a suíte de função pura verde e derruba este teste.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Proforma com permuta só financeira: KPI de área em "—" e nota com o montante', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpi-area-permutada', larguras: [1280] });
  const m = a.extra?.['1280'] as { valorAreaPermutada: string | null; nota: string | null } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.equal(m.valorAreaPermutada, '—', 'o KPI de área deveria sair "—" com permuta só financeira' + relato(a));
  assert.ok(m.nota?.includes('só financeira'), 'a nota da permuta só financeira não está na tela' + relato(a));
  assert.ok(m.nota?.includes('R$'), 'a nota deveria trazer o montante em R$' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
});

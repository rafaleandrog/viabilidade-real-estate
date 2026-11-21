// Render da aba Gráficos: faixa de consistência com a tolerância de Premissas.
// Ver `casos/graficos-alocacao-tolerancia.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Gráficos alocação (tolerancia): 3 x 33,3333% nao deve gerar aviso', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'graficos-alocacao-tolerancia', larguras: [900] });
  const m = a.extra?.['900'] as { avisos: number; kpis: number } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(m.kpis, 1, 'a faixa de KPIs deveria estar na tela' + relato(a));
  assert.equal(m.avisos, 0, 'aviso de consistência: quantidade inesperada' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
});

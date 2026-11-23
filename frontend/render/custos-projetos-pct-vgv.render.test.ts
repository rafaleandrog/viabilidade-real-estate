// Render de Projetos em `% do VGV` na tela Custos do Avançado.
// Ver o topo de `casos/custos-projetos-pct-vgv.ts` para o porquê de medir aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaProjetosPctVgv } from './casos/custos-projetos-pct-vgv.js';
import { resolverCustoTotal } from '../fluxo-shared.js';

const pular = await motivoParaPular();

test('Custos do Avançado: Projetos oferece % VGV e a tela resolve o R$ sobre o VGV', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'custos-projetos-pct-vgv', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaProjetosPctVgv | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.deepEqual(m!.unidadesPermitidas, ['rs', 'rs_m2_priv', 'pct_vgv', 'pct_constr'], relato(a));
  assert.ok(m!.badgesProjetos.includes('% VGV'), `badges de Projetos: ${m!.badgesProjetos}` + relato(a));
  // 2% de R$ 10.000.000 de VGV.
  assert.match(m!.resultadoProjetos, /200\.000,00/, relato(a));
  assert.equal(m!.ligacaoVgv, 10_000_000, relato(a));
});

test('motor: Projetos em pct_vgv resolve sobre o VGV do contexto', () => {
  const linha = { categoria: 'Projetos', orcamento_valor: 2, orcamento_unidade: 'pct_vgv', orcamento_valor_canonico: null };
  assert.equal(resolverCustoTotal(linha, { vgvTotal: 10_000_000 } as any), 200_000);
});

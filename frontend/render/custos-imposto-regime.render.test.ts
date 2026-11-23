// Render do regime do imposto em Custos → Financeiro (#834). Ver o topo de
// `casos/custos-imposto-regime.ts` para o que é provado e por quê aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaImpostoRegime } from './casos/custos-imposto-regime.js';

const pular = await motivoParaPular();

test('#834 Custos › Financeiro: regime do imposto vem da rota, troca e salva com as duas alíquotas', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'custos-imposto-regime', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaImpostoRegime | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  // Os parâmetros da rota viram o rascunho: regime padrão, alíquota 6,73.
  assert.equal(m!.regimeInicial, 'padrao', relato(a));
  assert.equal(m!.rotuloInicial, 'Alíquota do imposto padrão', relato(a));
  assert.equal(m!.aliquotaInicial, 6.73, relato(a));
  // Fora do RET, o controle não fala em RET.
  assert.doesNotMatch(m!.textoCaixaInicial, /\bRET\b|patrimônio de afetação/, m!.textoCaixaInicial + relato(a));

  // Trocar o regime troca o rótulo e mostra a alíquota do RET, sem perder a outra.
  assert.equal(m!.rotuloDepoisDeTrocar, 'Alíquota do RET', relato(a));
  assert.equal(m!.aliquotaDepoisDeTrocar, 4, relato(a));
  // As DUAS alíquotas são gravadas: inválida no regime oculto barra o Salvar.
  assert.equal(m!.salvarDesabilitadoComOutraInvalida, true, 'Salvar habilitado com alíquota padrão −5 %' + relato(a));
  assert.equal(m!.salvarDesabilitadoValido, false, relato(a));
  assert.deepEqual(m!.patch, { considerar_ret: true, ret_pct: 4, imposto_percentual: 5 },
    'o Salvar não mandou o PATCH com o regime e as duas alíquotas' + relato(a));
  // O que o servidor gravou sobe para a tela do estudo, pelos dois eventos.
  const gravado = { considerar_ret: true, ret_pct: 4, imposto_percentual: 5 };
  assert.deepEqual(m!.eventos, [
    { tipo: 'viab:premissas-change', dados: gravado },
    { tipo: 'viab:premissas-salvas', dados: gravado },
  ], 'a tela do estudo não soube do imposto salvo — a aba Financeiro regravaria o antigo' + relato(a));

  // Base `% Receita` com permuta física, medida antes da troca (imposto padrão
  // 6,73 %): a da tela é a do motor — 8 unidades vendáveis de R$ 1.000.000
  // líquidas do imposto, R$ 7.461.600 —, não a do VGV total (R$ 9.327.000).
  assert.ok(m!.receitaTotalTela !== undefined && Math.abs(m!.receitaTotalTela - m!.receitaTotalMotor) <= 0.01,
    `tela ${m!.receitaTotalTela} × motor ${m!.receitaTotalMotor}` + relato(a));
  assert.ok(Math.abs(m!.receitaTotalMotor - 7_461_600) <= 0.01, `motor ${m!.receitaTotalMotor}` + relato(a));
  assert.ok(m!.receitaTotalTela! < m!.receitaTotalVgvTotal, `a tela usou o VGV total: ${m!.receitaTotalTela}` + relato(a));

  // A sub-aba irmã (Terreno) está viva junto; depois do Salvar (RET 4 %), o
  // `estudo` atualizado chega a ela e a base dela segue: 8 × R$ 1.000.000 × 0,96.
  assert.ok(m!.irmaAntes !== undefined && Math.abs(m!.irmaAntes - 7_461_600) <= 0.01, `irmã antes ${m!.irmaAntes}` + relato(a));
  assert.ok(m!.irmaDepois !== undefined && Math.abs(m!.irmaDepois - 7_680_000) <= 0.01,
    `a sub-aba irmã ficou com o imposto antigo: ${m!.irmaDepois}` + relato(a));
});

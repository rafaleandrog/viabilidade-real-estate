import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simularDivida, simularEquity, simularFinanciamentoProducao, indicadoresOperacao, fundingDoEstudo,
  agregarFundingPorPeriodos, taxaMensalEquivalente, pmtPrice, tirAnual,
  type OperacaoFunding,
} from './funding-motor.js';

// ─────────────────────────────────────────────────────────────────────────
// #355 — golden cases da planilha `fluxo_investidor_FORMULAS.xlsx`, transcrita
// em docs/viabilidade/fluxo-investidor-formulas.md §4. Cobre `divida` e
// `equity` — a matemática de calendário/PMT da planilha nova.
//
// `financiamento_producao` NÃO segue esta planilha: preserva o modelo de
// exposição mínima/catch-up retroativo/cash sweep da planilha `Incorp
// Individual` (#405), com oráculo próprio em
// `frontend/financiamento-producao-golden.test.ts`. Decisão do autor
// (2026-08-12) — ver o cabeçalho de `funding-motor.ts`.
//
// Os valores esperados saíram das células da própria planilha. Onde há
// tolerância, é porque a planilha arredonda SÓ o saldo devedor (coluna F) e
// deixa juros/PMT com precisão cheia, enquanto o motor arredonda todo valor
// monetário a 2 casas (contrato do CLAUDE.md). A diferença acumulada é de
// centavos ao longo do horizonte — nunca estrutural. O caminho do SALDO é
// idêntico: o motor carrega adiante o saldo arredondado, igual à coluna F.
// ─────────────────────────────────────────────────────────────────────────

/** Dívida do exemplo: 10M, 20% a.a., 3 tranches, carência 12, amortização 36. */
const DIVIDA_GOLDEN: OperacaoFunding = {
  tipo: 'divida',
  nome: 'Capital de giro',
  valor: 10_000_000,
  inicio_mes: 0,            // planilha: "Mês aporte = 1" (1-based)
  distribuir_aporte: true,
  aporte_meses: 3,
  taxa_anual: 20,
  periodo_amortizacao_meses: 36,
  periodo_carencia_meses: 12,
};

const PRAZO_DIVIDA = 48;    // a planilha vai até o mês 48

test('#355 golden dívida: taxa mensal equivalente e PMT batem com a planilha', () => {
  const i = taxaMensalEquivalente(0.20);
  assert.ok(Math.abs(i - 0.015309470499731193) < 1e-15, `taxa mensal ${i}`);

  // Base do PMT é o VALOR FUTURO das 3 tranches, não os 10M crus.
  const principal = (10_000_000 / 3) * (Math.pow(1 + i, 3) - 1) / i;
  const parcela = pmtPrice(i, 36 - 12, principal);
  assert.ok(Math.abs(parcela - 508_746.97518660501) < 0.01, `PMT ${parcela}`);
});

test('#355 golden dívida: liberação, carência e quitação nos meses certos', () => {
  const s = simularDivida(DIVIDA_GOLDEN, PRAZO_DIVIDA);

  // Liberação: 3 tranches iguais nos meses 0,1,2 (planilha 1,2,3).
  assert.ok(Math.abs(s.entradas[0] - 3_333_333.33) < 0.01);
  assert.ok(Math.abs(s.entradas[2] - 3_333_333.33) < 0.01);
  assert.equal(s.entradas[3], 0, 'liberação acaba na 3ª tranche');

  // ini = 0 + 3 = 3; carência 12 meses => meses 3..14 pagam só juros.
  for (const t of [3, 8, 14]) {
    assert.ok(Math.abs(s.saidas[t] - s.juros[t]) < 0.01, `mês ${t} deveria pagar só juros`);
  }
  // Durante a carência o saldo não anda (juros pagos, principal intacto).
  assert.ok(Math.abs(s.saldo[3] - s.saldo[14]) < 0.01, 'saldo constante na carência');

  // 1ª parcela cheia no mês 15 (planilha: linha do mês 16).
  assert.ok(Math.abs(s.saidas[15] - 508_746.98) < 0.02, `parcela ${s.saidas[15]}`);

  // fim = ini − 1 + 36 = 38 (planilha: mês 39). Depois disso, nada.
  assert.ok(s.saidas[38] > 0, 'mês da quitação paga');
  assert.equal(s.saidas[39], 0, 'depois da quitação não há pagamento');
  assert.ok(Math.abs(s.saldo[38]) < 0.01, 'saldo zera na quitação');
});

test('#355 golden dívida: indicadores do investidor batem com a planilha', () => {
  const s = simularDivida(DIVIDA_GOLDEN, PRAZO_DIVIDA);
  const ind = indicadoresOperacao(s, 12);

  assert.ok(Math.abs(ind.investimentoTotal - (-10_000_000)) < 0.01, `investimento ${ind.investimentoTotal}`);
  assert.ok(Math.abs(ind.retornoTotal - 14_075_333.01) < 0.5, `retorno ${ind.retornoTotal}`);
  assert.ok(Math.abs(ind.jurosPagos - 4_075_332.99) < 0.5, `juros ${ind.jurosPagos}`);
  assert.ok(Math.abs(ind.lucro - 4_075_333.01) < 0.5, `lucro ${ind.lucro}`);
  assert.ok(Math.abs(ind.saldoFinal) < 0.01, `saldo final ${ind.saldoFinal}`);

  // Sanidade financeira: empréstimo precificado à própria taxa rende ela.
  assert.ok(ind.tirAnual !== null);
  assert.ok(Math.abs((ind.tirAnual as number) - 0.20000000111133076) < 1e-6, `TIR a.a. ${ind.tirAnual}`);
});

test('#355 dívida: Σ PMT − Σ liberado = Σ juros (conservação)', () => {
  const s = simularDivida(DIVIDA_GOLDEN, PRAZO_DIVIDA);
  const pago = s.saidas.reduce((a, b) => a + b, 0);
  const liberado = s.entradas.reduce((a, b) => a + b, 0);
  const juros = s.juros.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs((pago - liberado) - juros) < 0.5, `${pago - liberado} vs ${juros}`);
});

test('#355 dívida sem distribuir: libera tudo num mês só e o PMT usa o valor cru', () => {
  const op: OperacaoFunding = { ...DIVIDA_GOLDEN, distribuir_aporte: false, aporte_meses: 3 };
  const s = simularDivida(op, PRAZO_DIVIDA);
  assert.ok(Math.abs(s.entradas[0] - 10_000_000) < 0.01);
  assert.equal(s.entradas[1], 0);
  // ini = 0 + 1 = 1; fim = 1 − 1 + 36 = 36.
  assert.equal(s.saidas[0], 0, 'no mês da liberação ainda não se paga');
  assert.ok(s.saidas[36] > 0 && s.saidas[37] === 0, 'quita no mês 36');
  assert.ok(Math.abs(s.saldo[36]) < 0.01, 'saldo zera na quitação');
});

test('#355 dívida com carência >= amortização não divide por zero', () => {
  // A rota barra isso na entrada; o motor não pode explodir se chegar assim.
  const op: OperacaoFunding = { ...DIVIDA_GOLDEN, periodo_amortizacao_meses: 12, periodo_carencia_meses: 12 };
  const s = simularDivida(op, PRAZO_DIVIDA);
  assert.ok(s.saidas.every((v) => Number.isFinite(v)), 'nenhum NaN/Infinity');
  assert.ok(s.saldo.every((v) => Number.isFinite(v)));
});

// ── Equity ───────────────────────────────────────────────────────────────

/**
 * Reconstrói a curva de receita da aba `equity` (coluna B) para o exemplo:
 * VGV 200M, 36 meses, lançamento no mês 2, obra 30, repasse no 32,
 * 20% entrada / 30% parcelas / 0% pós-chaves / 50% repasse.
 * Devolve a receita LÍQUIDA (coluna C), já com as deduções de 14%.
 */
function receitaLiquidaGolden(): number[] {
  const VGV = 200_000_000, PRAZO = 36, LANC = 2, OBRA = 30, REPASSE = 32;
  const pctEntrada = 0.2, pctParcelas = 0.3, pctPos = 0, pctRepasse = 0.5;
  const deducoes = 0.05 + 0.03 + 0.06;
  const bruta: number[] = [];
  for (let m = 1; m <= PRAZO; m++) {
    let v = 0;
    if (m === LANC) v = VGV * pctEntrada;
    else if (m > LANC && m < REPASSE) v = VGV * pctParcelas / Math.max(1, OBRA - 1);
    else if (m === REPASSE) v = VGV * pctRepasse;
    else if (m > REPASSE) v = VGV * pctPos / Math.max(1, PRAZO - REPASSE);
    bruta.push(v);
  }
  // Invariante da planilha: a curva conserva o VGV.
  const somaBruta = bruta.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(somaBruta - VGV) < 1, `curva deveria conservar o VGV, deu ${somaBruta}`);
  return bruta.map((v) => v * (1 - deducoes));
}

const EQUITY_GOLDEN: OperacaoFunding = {
  tipo: 'equity',
  nome: 'Investidor',
  valor: 5_000_000,
  inicio_mes: 0,             // planilha: "Mês do Aporte = 1"
  modo_retorno: 'permuta_financeira',
  pct_retorno: 4,
};

test('#355 golden equity (permuta financeira): retorno, lucro e payback batem', () => {
  const liquida = receitaLiquidaGolden();
  // Resultado final não é usado no modo progressivo; mês do repasse é 31 (0-based).
  const s = simularEquity(EQUITY_GOLDEN, liquida, 166_999_999.99, 31, 36);
  const ind = indicadoresOperacao(s, 12);

  assert.ok(Math.abs(ind.investimentoTotal - (-5_000_000)) < 0.01, `investimento ${ind.investimentoTotal}`);
  assert.ok(Math.abs(ind.retornoTotal - 6_880_000) < 1, `retorno ${ind.retornoTotal}`);
  assert.ok(Math.abs(ind.lucro - 1_880_000) < 1, `lucro ${ind.lucro}`);

  // D10: o caixa vira positivo no mês 32 da planilha (índice 31), não no 59.
  assert.equal(ind.paybackMes, 31, 'payback no mês do repasse');

  assert.ok(ind.tirMensal !== null);
  assert.ok(Math.abs((ind.tirMensal as number) - 0.016823843299068608) < 1e-6, `TIR mensal ${ind.tirMensal}`);
});

test('#355 equity (resultado final): paga tudo de uma vez, no mês do repasse', () => {
  const liquida = receitaLiquidaGolden();
  const op: OperacaoFunding = { ...EQUITY_GOLDEN, modo_retorno: 'resultado_final', pct_retorno: 4 };
  const s = simularEquity(op, liquida, 166_999_999.99, 31, 36);

  const mesesComRetorno = s.saidas.filter((v) => v > 0.005).length;
  assert.equal(mesesComRetorno, 1, 'um único pagamento');
  assert.ok(Math.abs(s.saidas[31] - 166_999_999.99 * 0.04) < 0.05, `retorno ${s.saidas[31]}`);
  // A receita mensal não influencia este modo.
  assert.equal(s.saidas[10], 0);
});

test('#355 equity: o aporte não vira receita nem o retorno vira aporte (sinais)', () => {
  const liquida = receitaLiquidaGolden();
  const s = simularEquity(EQUITY_GOLDEN, liquida, 0, 31, 36);
  // Projeto RECEBE o aporte (entradas) e PAGA o retorno (saidas).
  assert.ok(s.entradas[0] > 0 && s.saidas[0] === 0);
  // Investidor: desembolso negativo no mês 0.
  assert.ok(s.fluxoInvestidor[0] < 0, 'mês do aporte é negativo para o investidor');
  assert.ok(s.fluxoInvestidor[31] > 0, 'mês de recebimento é positivo');
});

// ── A costura com a tabela (#349) ────────────────────────────────────────

test('#355 fundingDoEstudo: sem operações devolve null', () => {
  assert.equal(fundingDoEstudo([], [0, 0, 0], [0, 0, 0], 0, 1, 12), null);
});

test('#355 fundingDoEstudo: fluxo alavancado = livre + entradas − saídas', () => {
  const prazo = PRAZO_DIVIDA;
  const livre = new Array(prazo).fill(-100_000);
  const liquida = new Array(prazo).fill(200_000);
  const f = fundingDoEstudo([DIVIDA_GOLDEN, EQUITY_GOLDEN], livre, liquida, 1_000_000, 31, 12);
  assert.ok(f);
  const nf = f!.noFluxo;

  for (let t = 0; t < prazo; t++) {
    assert.ok(
      Math.abs(nf.fluxoMensal[t] - (livre[t] + nf.entradas[t] - nf.saidas[t])) < 0.02,
      `mês ${t} não fecha`,
    );
  }
  // Uma linha de entrada e uma de saída por operação.
  assert.equal(nf.linhasEntrada.length, 2);
  assert.equal(nf.linhasSaida.length, 2);
  // O VPL líquido é a diferença dos VPLs das linhas — é o que corrige a coluna
  // VPL do rodapé alavancado.
  const esperado = nf.linhasEntrada.reduce((s, l) => s + l.vpl, 0)
    - nf.linhasSaida.reduce((s, l) => s + l.vpl, 0);
  assert.ok(Math.abs(nf.vplLiquido - esperado) < 0.02);
});

test('#355 fundingDoEstudo: Financiamento à produção NÃO usa a matemática de calendário da Dívida', () => {
  // Decisão do autor (2026-08-12): o modelo de calendário/PMT da planilha
  // `fluxo_investidor_FORMULAS` reverteria o catch-up retroativo aprovado na
  // #405 (planilha `Incorp Individual`). As duas operações têm a MESMA
  // "forma" de campos, mas rodam motores DIFERENTES — este teste prova que
  // divergem, o oposto do que a versão original do #355 assumia.
  const prazo = 24;
  const livre = new Array(prazo).fill(-50_000);
  const comoFin = fundingDoEstudo(
    [{ ...DIVIDA_GOLDEN, tipo: 'financiamento_producao' }], livre, livre, 0, 1, 12);
  const comoDiv = fundingDoEstudo([DIVIDA_GOLDEN], livre, livre, 0, 1, 12);

  assert.ok(comoFin && comoDiv);
  // `financiamento_producao` ignora calendário/PMT: sem `custosRaw`/
  // `linhasCusto` no contexto, não há base de medição — logo nenhuma
  // liberação, ao contrário da Dívida, que libera nos meses 0-2 por calendário.
  assert.ok(comoFin!.operacoes[0].entradas.every((v) => v === 0));
  assert.ok(comoDiv!.operacoes[0].entradas.some((v) => v > 0));
  assert.notDeepEqual(comoFin!.operacoes[0].saidas, comoDiv!.operacoes[0].saidas);
  // E tem o diagnóstico do §38, que `divida` nunca produz.
  assert.ok(comoFin!.operacoes[0].diagnostico);
  assert.equal(comoDiv!.operacoes[0].diagnostico, undefined);
});

test('#355 simularFinanciamentoProducao vs simularDivida: mesmos parâmetros de calendário, resultado diferente', () => {
  // Mesmo com taxa/valor/carência/amortização idênticos, a Dívida amortiza
  // por PMT contratual e o Financiamento à produção por cash sweep contra o
  // caixa livre do projeto — nunca coincidem fora do caso degenerado.
  const prazo = 24;
  const custoElegivel = new Array(prazo).fill(0).map((_, i) => (i < 6 ? 1_000_000 : 0));
  const fluxoLivre = new Array(prazo).fill(-200_000);
  const divida = simularDivida(DIVIDA_GOLDEN, prazo);
  const finProducao = simularFinanciamentoProducao(
    { ...DIVIDA_GOLDEN, tipo: 'financiamento_producao', exposicao_minima: 20, percentual_financiavel: 80 },
    custoElegivel, null, null, fluxoLivre, prazo,
  );
  assert.notDeepEqual(divida.entradas, finProducao.entradas);
  assert.notDeepEqual(divida.saidas, finProducao.saidas);
});

test('#355 agregarFundingPorPeriodos: soma dentro da faixa e conserva o total', () => {
  const prazo = 24;
  const livre = new Array(prazo).fill(-50_000);
  const liquida = new Array(prazo).fill(100_000);
  const f = fundingDoEstudo([EQUITY_GOLDEN], livre, liquida, 500_000, 12, 12)!;
  const periodos = [{ inicio: 0, fim: 11 }, { inicio: 12, fim: 23 }];
  const ag = agregarFundingPorPeriodos(f.noFluxo, periodos);

  assert.equal(ag.entradas.length, 2);
  const totalMensal = f.noFluxo.entradas.reduce((a, b) => a + b, 0);
  const totalAnual = ag.entradas.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(totalMensal - totalAnual) < 0.02, 'agregar não pode criar nem perder dinheiro');
  // O acumulado pega o ÚLTIMO ponto da faixa, não a soma.
  assert.equal(ag.fluxoAcumulado[1], f.noFluxo.fluxoAcumulado[23]);
  // VPL não é reagregado.
  assert.equal(ag.vplLiquido, f.noFluxo.vplLiquido);
});

test('#355 tirAnual devolve null quando não há troca de sinal', () => {
  assert.equal(tirAnual([100, 200, 300]), null);
  assert.equal(tirAnual([-100, -200]), null);
});

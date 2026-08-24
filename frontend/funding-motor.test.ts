import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simularDivida, simularEquity, simularFinanciamentoProducao, indicadoresOperacao, fundingDoEstudo,
  agregarFundingPorPeriodos, taxaMensalEquivalente, pmtPrice, tirAnual,
  receitaLiquidaComCorretagemMensal,
  type OperacaoFunding,
} from './funding-motor.js';
import { receitaLiquidaDeProformaMensal } from './fluxo-caixa-motor.js';

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

// ── #432 — receita líquida negativa: clamp em 0 com carry-forward ────────
//
// O estado NÃO existe na planilha: `!equity!C28 = B28*(1−C15−C16−C17)` é uma
// dedução MULTIPLICATIVA sobre frações não negativas do VGV, logo `C ≥ 0` e a
// coluna `D` não precisa de `MAX`. No app a dedução é uma SÉRIE SUBTRAÍDA com
// cronograma próprio (corretagem integral no mês da venda, #121), e o mês de
// lançamento cujo sinal é menor que a corretagem produz base NEGATIVA.
//
// Decisão do autor, 2026-08-22 — ver `docs/viabilidade/fluxo-investidor-formulas.md`
// §4.2, bloco "Divergência deliberada do app".

const EQUITY_432: OperacaoFunding = {
  tipo: 'equity',
  nome: 'Investidor',
  valor: 0,
  inicio_mes: 0,
  modo_retorno: 'permuta_financeira',
  pct_retorno: 10,
};

test('#432 base negativa não paga retorno negativo — o déficit abate o mês seguinte', () => {
  const base = [-200_000, 2_000_000, 2_000_000];
  const s = simularEquity(EQUITY_432, base, 0, 2, 3);

  // Na `main` isto era [-20000, 200000, 200000]: o INVESTIDOR pagava ao projeto.
  assert.deepEqual(s.saidas, [0, 180_000, 200_000]);

  // A base negativa é MESMO exercitada — sem isto o teste passaria com o
  // código antigo em qualquer curva não negativa.
  assert.ok(base[0] < 0, 'o caso precisa ter receita líquida negativa');
  assert.ok(base.some((v) => v < 0), 'pelo menos um mês com base negativa');

  // ⚠️ Sem esta asserção o teste NÃO distingue carry-forward de um
  // `Math.max(0, …)` seco, que devolveria [0, 200000, 200000] = 400.000.
  const somaSemClamp = base.reduce((a, v) => a + v * 0.1, 0);
  assert.equal(s.saidas.reduce((a, v) => a + v, 0), 380_000);
  assert.equal(Math.round(somaSemClamp * 100) / 100, 380_000);
});

test('#432 déficit maior que o retorno dos meses seguintes: carrega e, no fim, extingue', () => {
  const base = [-3_000_000, 100_000, 2_000_000];
  const s = simularEquity(EQUITY_432, base, 0, 2, 3);

  // mês 0: −300.000 → paga 0, déficit 300.000
  // mês 1:  +10.000 → paga 0, déficit 290.000
  // mês 2: +200.000 → paga 0, déficit 90.000 — EXTINTO, não vira pagamento negativo
  assert.deepEqual(s.saidas, [0, 0, 0]);

  // O total pago é MENOR que `Σ base × pct` (= −90.000): o déficit remanescente
  // não é cobrado do investidor.
  const somaSemClamp = base.reduce((a, v) => a + v * 0.1, 0);
  assert.ok(somaSemClamp < 0, `sem clamp o total seria negativo (${somaSemClamp})`);
  assert.equal(s.saidas.reduce((a, v) => a + v, 0), 0);
});

test('#432 o déficit é POR OPERAÇÃO — a segunda chamada não herda a primeira', () => {
  // Se o acumulador virasse estado de módulo, a segunda chamada abriria com o
  // déficit de 300.000 da primeira e devolveria [0, 0, 0].
  simularEquity(EQUITY_432, [-3_000_000, 100_000, 2_000_000], 0, 2, 3);
  const s = simularEquity(EQUITY_432, [-200_000, 2_000_000, 2_000_000], 0, 2, 3);
  assert.deepEqual(s.saidas, [0, 180_000, 200_000]);
});

test('#432 o clamp NÃO toca o modo resultado_final nem curva sempre positiva', () => {
  // `resultado_final` paga no mês do repasse, sem passar pelo carry-forward.
  const op = { ...EQUITY_432, modo_retorno: 'resultado_final' as const };
  const s = simularEquity(op, [-200_000, 2_000_000, 2_000_000], 1_000_000, 2, 3);
  assert.deepEqual(s.saidas, [0, 0, 100_000]);

  // Curva não negativa: o resultado é idêntico ao da fórmula crua.
  const t = simularEquity(EQUITY_432, [100_000, 200_000, 300_000], 0, 2, 3);
  assert.deepEqual(t.saidas, [10_000, 20_000, 30_000]);
});

test('#432 o déficit acumula em precisão plena — só `saidas` arredonda (C7)', () => {
  // 3 meses de −0,333333 de base ×10% deixam um déficit que, arredondado a cada
  // mês, divergiria do exato. Aqui o mês 3 paga a diferença completa.
  const base = [-0.333_333, -0.333_333, -0.333_333, 1_000_000];
  const s = simularEquity(EQUITY_432, base, 0, 3, 4);
  const deficitExato = 3 * 0.333_333 * 0.1;
  assert.deepEqual(s.saidas.slice(0, 3), [0, 0, 0]);
  assert.equal(s.saidas[3], Math.round((100_000 - deficitExato) * 100) / 100);
  assert.equal(s.saidas[3], 99_999.9);
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

// ─────────────────────────────────────────────────────────────────────────
// #434 — o cash sweep do Financiamento à produção enxerga o caixa que as
// outras operações deixaram.
//
// `fundingDoEstudo` simula em DUAS PASSADAS: primeiro as cegas ao caixa
// (`divida`, `equity`), depois a dirigida por caixa (`financiamento_producao`)
// contra `fluxoLivreMensal + entradasCegas − saidasCegas`. Passos 23–24 de
// `docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`.
//
// ⚠️ NÃO é o waterfall que a #355 apagou: sem prioridade, sem fila, sem
// competição por caixa — só ordem de leitura.
//
// Os testes exercitam `fundingDoEstudo` (a COMPOSIÇÃO), não
// `simularFinanciamentoProducao` isolada: é a composição que muda. A função
// tem oráculo próprio em `frontend/financiamento-producao-golden.test.ts`,
// e a assinatura dela não mudou.
//
// ⚠️ Os pares `antes → depois` abaixo são MEDIDOS, não estimados: a série
// `ANTES_434` foi capturada rodando estes mesmos cenários contra o motor de
// uma passada. Ela é a MESMA nos três cenários — e é exatamente esse o
// defeito: pré-conserto o FP amortizava igual houvesse R$ 5 MM de equity no
// caixa ou não.
// ─────────────────────────────────────────────────────────────────────────

const PRAZO_434 = 12;
const CTX_434 = {
  linhasCusto: [{ id: 1, mensal: new Array(PRAZO_434).fill(0).map((_, i) => (i < 6 ? 1_000_000 : 0)) }],
  custosRaw: [{ id: 1, grupo: 'obra' }],
};
/** Livre apertado durante a obra (−200k/mês), folgado depois (+400k/mês). */
const LIVRE_434 = new Array(PRAZO_434).fill(0).map((_, i) => (i < 6 ? -200_000 : 400_000));
const LIQUIDA_434 = new Array(PRAZO_434).fill(100_000);

const FIN_434: OperacaoFunding = {
  id: 'f1', tipo: 'financiamento_producao', nome: 'FP', valor: 0, inicio_mes: 0,
  taxa_anual: 12, exposicao_minima: 20, percentual_financiavel: 80,
  custo_linha_ids: [1], amortizar_com_caixa_disponivel: true,
};
/** Aporte de R$ 5 MM no mês 1 — bem no meio da obra, com o livre negativo. */
const EQUITY_434: OperacaoFunding = {
  id: 'e1', tipo: 'equity', nome: 'Investidor', valor: 5_000_000, inicio_mes: 1,
  modo_retorno: 'resultado_final', pct_retorno: 0,
};
/** Parcela pesada: 3 MM a 24% a.a. amortizados em 6 meses, sem carência. */
const DIVIDA_434: OperacaoFunding = {
  id: 'd1', tipo: 'divida', nome: 'Giro', valor: 3_000_000, inicio_mes: 0,
  taxa_anual: 24, periodo_amortizacao_meses: 6, periodo_carencia_meses: 0,
};

/** Amortização do FP no motor de UMA passada — idêntica nos três cenários. */
const ANTES_434 = [0, 0, 1_000_000, 600_000, 600_000, 600_000, 1_200_000, 400_000, 400_000, 95_022.25, 0, 0];

const serieFin434 = (ops: OperacaoFunding[]) => {
  const f = fundingDoEstudo(ops, LIVRE_434, LIQUIDA_434, 1_000_000, 10, 12, CTX_434)!;
  return { calc: f, fin: f.operacoes.find((s) => s.operacao.tipo === 'financiamento_producao')! };
};

test('#434 equity aumenta o caixa que o cash sweep enxerga', () => {
  const { fin } = serieFin434([FIN_434, EQUITY_434]);

  // Mês 2: o aporte de R$ 5 MM do mês 1 já está no caixa, então o sweep
  // amortiza até o TETO do mês (`saldo_abertura + juros`) em vez de parar no
  // caixa magro do projeto desalavancado.
  assert.equal(ANTES_434[2], 1_000_000);          // antes  — teto era o caixa
  assert.equal(fin.saidas[2], 1_615_182.07);      // depois — teto vira a dívida
  assert.ok(fin.saidas[2] > ANTES_434[2]);

  // E a consequência que importa: o saldo devedor zera no mês 6 em vez de
  // arrastar até o 9, e o total de juros pagos cai.
  assert.equal(fin.saldo[6], 0);
  assert.ok(fin.juros.reduce((a, b) => a + b, 0) < 200_000);
});

test('#434 parcela de dívida reduz o caixa que o cash sweep enxerga', () => {
  const { fin } = serieFin434([FIN_434, DIVIDA_434]);

  // Mês 5: as parcelas acumuladas da dívida (24% a.a. em 6 meses, sem
  // carência) já drenaram o caixa que o aporte dela injetou no mês 0, e o
  // sweep tem MENOS caixa para amortizar do que o livre desalavancado sugeria.
  assert.equal(ANTES_434[5], 600_000);            // antes
  assert.equal(fin.saidas[5], 67_873.98);         // depois
  assert.ok(fin.saidas[5] < ANTES_434[5]);

  // O saldo devedor do mês fica maior — é o efeito no número que a issue
  // aponta como o de maior impacto do documento de funding.
  assert.equal(fin.saldo[5], 1_700_092.73);
});

test('#434 sem outras operações, nada muda', () => {
  // ⚠️ Este é o teste que impede o conserto de VAZAR para o caso de operação
  // única — o único que a instância tem hoje. Com uma só operação não há
  // "cegas" para somar, e a série tem de sair idêntica à de uma passada.
  const { fin } = serieFin434([FIN_434]);
  assert.deepEqual(fin.saidas, ANTES_434);
  assert.deepEqual(fin.entradas, [0, 1_600_000, 800_000, 800_000, 800_000, 800_000, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(
    fin.saldo,
    [0, 1_600_000, 1_415_182.07, 1_628_610.44, 1_844_063.99, 2_061_561.93,
      881_123.66, 489_484.46, 94_129.08, 0, 0, 0],
  );
});

test('#434 a ordem das linhas não muda', () => {
  // `series` é simulada em duas passadas mas REMONTADA na ordem de
  // `operacoes` — `linhasEntrada`/`linhasSaida` são as linhas da tabela do
  // Fluxo de Caixa, e reordená-las mudaria a tela sem ninguém pedir.
  const { calc } = serieFin434([EQUITY_434, FIN_434, DIVIDA_434]);

  assert.deepEqual(calc.operacoes.map((s) => s.operacao.id), ['e1', 'f1', 'd1']);
  assert.deepEqual(calc.noFluxo.linhasEntrada.map((l) => l.nome), [
    'Investidor (Equity) — aporte',
    'FP — liberações',
    'Giro — liberações',
  ]);
  assert.deepEqual(calc.noFluxo.linhasSaida.map((l) => l.nome), [
    'Funding · FP — parcelas',
    'Funding · Giro — parcelas',
  ]);
});

test('#434 duas dirigidas leem o MESMO caixa — a ordem não vira prioridade', () => {
  // ⚠️ ESTE TESTE EXISTE POR CAUSA DE UM ACHADO DO CODEX (revisão do PR 526,
  // P1). A primeira versão do conserto ENCADEAVA as dirigidas: a segunda via o
  // caixa já alterado pela primeira. Isso faz a posição no array virar
  // PRIORIDADE DE PAGAMENTO — a competição por caixa que a #355 apagou.
  //
  // E o estado não é impossível, só improvável: quem impede dois
  // `financiamento_producao` no mesmo estudo é `conflitoFinanciamentoUnico`
  // (`backend/rotas/funding.ts`), que LÊ e depois GRAVA — dois POSTs
  // concorrentes passam os dois —, e o `schema.json` não tem índice único para
  // o par (só `[["estudo_id"]]`). Então o motor tem de se comportar bem nele.
  //
  // ⚠️ O CAIXA AQUI É APERTADO DE PROPÓSITO (`+150k/mês` depois da obra, e uma
  // `divida` pequena no lugar do aporte de R$ 5 MM). Com o caixa folgado o
  // sweep bate no TETO DA DÍVIDA (`saldo_abertura + juros`) e não no caixa —
  // e aí encadear ou não encadear dá o MESMO número, o que faria este teste
  // passar verde sob a própria mutação que ele deveria matar. Medido: com
  // `LIVRE_434` o encadeamento é indistinguível; com este, f1 e f2 divergem
  // (1.236.824 vs 1.615.182 no mês 2).
  const P = 12;
  const livreApertado = new Array(P).fill(0).map((_, i) => (i < 6 ? -200_000 : 150_000));
  const fin2: OperacaoFunding = { ...FIN_434, id: 'f2', nome: 'FP 2' };
  const giro: OperacaoFunding = {
    id: 'd2', tipo: 'divida', nome: 'Giro leve', valor: 300_000, inicio_mes: 0,
    taxa_anual: 12, periodo_amortizacao_meses: 10, periodo_carencia_meses: 0,
  };
  const rodar = (ops: OperacaoFunding[]) =>
    fundingDoEstudo(ops, livreApertado, LIQUIDA_434, 1_000_000, 10, 12, CTX_434)!;

  const ab = rodar([FIN_434, fin2, giro]);
  const ba = rodar([fin2, FIN_434, giro]);
  const porId = (c: typeof ab, id: string) => c.operacoes.find((s) => s.operacao.id === id)!;

  // 1) trocar a ordem das duas dirigidas não muda a série de nenhuma delas.
  for (const id of ['f1', 'f2']) {
    assert.deepEqual(porId(ab, id).saidas, porId(ba, id).saidas, `saídas de ${id} dependem da ordem`);
    assert.deepEqual(porId(ab, id).entradas, porId(ba, id).entradas, `entradas de ${id} dependem da ordem`);
    assert.deepEqual(porId(ab, id).saldo, porId(ba, id).saldo, `saldo de ${id} depende da ordem`);
  }

  // 2) e as duas, lendo o MESMO caixa, saem idênticas entre si — é isto que
  //    cai no instante em que alguém reintroduzir o encadeamento.
  assert.deepEqual(porId(ab, 'f1').saidas, porId(ab, 'f2').saidas);
  // O par declarado, para a asserção não ser só uma comparação de iguais:
  // limitado pelo CAIXA (1.236.824,34), não pelo teto da dívida (1.615.182,07),
  // que é o número que a segunda dirigida receberia se houvesse fila.
  assert.equal(porId(ab, 'f1').saidas[2], 1_236_824.34);
  assert.equal(porId(ab, 'f2').saidas[2], 1_236_824.34);

  // 3) a remontagem continua respeitando a ordem original em cada arranjo.
  assert.deepEqual(ab.operacoes.map((s) => s.operacao.id), ['f1', 'f2', 'd2']);
  assert.deepEqual(ba.operacoes.map((s) => s.operacao.id), ['f2', 'f1', 'd2']);
});

// ─────────────────────────────────────────────────────────────────────────
// #446 — com o horizonte certo, `saldoFinal` passa a ser o saldo NA QUITAÇÃO.
//
// Nenhuma lógica nova de KPI: `saldoFinal` continua sendo a última posição da
// série (`funding-motor.ts`, `indicadoresOperacao`). O que mudou é que a série
// agora chega ao mês da quitação. Antes, num horizonte curto, ele exibia um
// saldo truncado — "R$ 3 MM" numa operação de 120 meses dentro de 48 — que não
// correspondia a compromisso nenhum.
// ─────────────────────────────────────────────────────────────────────────

test('#446: saldoFinal zera quando o horizonte alcança a quitação', () => {
  const op = {
    tipo: 'divida', nome: 'CG', valor: 1_000_000, taxa_anual: 12,
    inicio_mes: 0, distribuir_aporte: false, periodo_amortizacao_meses: 36,
    periodo_carencia_meses: 0,
  } as OperacaoFunding;

  // Horizonte truncado (24 meses, o operacional): a dívida NÃO zera.
  const truncado = indicadoresOperacao(simularDivida(op, 24), 12);
  assert.ok(Math.abs(truncado.saldoFinal) > 0.01,
    'ancoragem: com 24 meses a série é cortada antes da quitação');

  // Horizonte da #446 (fim + 1 = 37): zera dentro de R$ 0,01.
  const inteiro = indicadoresOperacao(simularDivida(op, 37), 12);
  assert.ok(Math.abs(inteiro.saldoFinal) <= 0.01,
    `saldo na quitação deveria ser ~0, achei ${inteiro.saldoFinal}`);
});

// ── #465 — a base do equity e a "Receita líquida de proforma" divergem DE PROPÓSITO ──
//
// Trava para o "conserto ingênuo": se alguém alinhar receitaLiquidaComCorretagemMensal
// à planilha (deduzindo marketing também), este teste fica vermelho — é a
// prova de que a divergência é intencional, não pendência esquecida (decisão
// do autor 2026-08-21, citada verbatim no comentário da função).
test('#465 receitaLiquidaComCorretagemMensal (base do equity) e receitaLiquidaDeProformaMensal (EVI) divergem quando há marketing', () => {
  const receitaMensal = [1_000_000, 1_000_000];
  const linhasCusto = [
    { id: 'corretagem', mensal: [50_000, 50_000] },
    { id: 'marketing', mensal: [10_000, 10_000] },
  ];
  const custosRaw = [
    { id: 'corretagem', grupo: 'diretos', categoria: 'Corretagem de vendas' },
    { id: 'marketing', grupo: 'diretos', categoria: 'Marketing & Publicidade' },
  ];

  const baseEquity = receitaLiquidaComCorretagemMensal(receitaMensal, linhasCusto, custosRaw);
  const baseEvi = receitaLiquidaDeProformaMensal(receitaMensal, linhasCusto, custosRaw);

  // A base do equity só deduz corretagem — marketing continua dentro dela.
  assert.deepEqual(baseEquity, [950_000, 950_000]);
  // A base EVI deduz corretagem E marketing — R$ 10.000/mês a menos.
  assert.deepEqual(baseEvi, [940_000, 940_000]);

  // A divergência É o ponto: as duas NÃO podem ficar iguais enquanto a
  // decisão do autor (funding-motor.ts, ao lado de receitaLiquidaComCorretagemMensal)
  // não mudar. Sem marketing na linha de custo, as duas convergem (prova que
  // marketing é a ÚNICA diferença entre as duas funções).
  const semMarketing = linhasCusto.filter((l) => l.id !== 'marketing');
  const custosRawSemMarketing = custosRaw.filter((c) => c.id !== 'marketing');
  assert.deepEqual(
    receitaLiquidaComCorretagemMensal(receitaMensal, semMarketing, custosRawSemMarketing),
    receitaLiquidaDeProformaMensal(receitaMensal, semMarketing, custosRawSemMarketing),
  );
});

test('#465 receitaLiquidaDeProformaMensal soma marketing dos DOIS grupos possíveis (diretos + indireto)', () => {
  const receitaMensal = [1_000_000];
  const linhasCusto = [
    { id: 'mkt1', mensal: [10_000] },
    { id: 'mkt2', mensal: [5_000] },
  ];
  const custosRaw = [
    { id: 'mkt1', grupo: 'diretos', categoria: 'Marketing & Publicidade' },
    { id: 'mkt2', grupo: 'indireto', categoria: 'Marketing global' },
  ];
  assert.deepEqual(receitaLiquidaDeProformaMensal(receitaMensal, linhasCusto, custosRaw), [985_000]);
});

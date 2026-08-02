// ─────────────────────────────────────────────────────────────────────────
// Oráculo de referência do Programa Financeiro / Capital Stack — FIN-01 (#270).
//
// Este módulo NÃO é importado pelo runtime (não entra no bundle de
// index.ts) — serve só aos testes. É a espec EXECUTÁVEL da epic #239
// (docs/viabilidade/funding-capital-stack.md): implementa os mecanismos do
// documento (§3 conceitos canônicos, §4 instrumentos, §5 prioridade de
// funding, §6 waterfall, §7 ordem mensal) como funções puras, e os 16 casos
// de teste do §14 como cenários executáveis. FIN-02...FIN-10 implementam a
// MESMA regra no motor de produção e passam a ser comparadas contra este
// oráculo — mesmo papel que `calliandra-golden.ts` teve para #232–#237.
//
// Diferença importante de método: os cenários de Calliandra reproduzem uma
// planilha REAL (valores "conferidos à mão" contra uma fonte externa). Não
// existe planilha de referência para Capital Stack — os 16 casos aqui usam
// números redondos, deliberadamente simples, e as expectativas são
// verificadas por INVARIANTE FECHADA (ex.: "saldo final = 0", "juros totais
// de uma bullet = principal × taxa × meses", "MOIC = distribuições/aportes")
// em vez de comparação linha a linha contra uma terceira fonte. Isso é
// consistente com o que o próprio documento pede na Seção 12 (Validações e
// invariantes) e no critério de aceite do corpo original da #270.
// ─────────────────────────────────────────────────────────────────────────

const n = (v: any): number => Number(v) || 0;
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Taxa mensal equivalente a uma taxa anual composta: (1+a)^(1/12) − 1 — mesma fórmula usada em toda a app (VPL, Calliandra). */
export function taxaMensalEquivalente(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

// ── Tipos de instrumento (§4) ───────────────────────────────────────────

export type PoliticaAmortizacao = 'cash_sweep' | 'bullet';

/** Financiamento à produção (§4.3) ou Capital de giro/dívida ponte (§4.4) — mesmo motor. */
export interface InstrumentoDivida {
  tipo: 'divida';
  nome: string;
  limiteComprometido: number;
  taxaMensal: number;
  politicaAmortizacao: PoliticaAmortizacao;
  /** Só para `bullet`: mês em que o saldo remanescente é quitado. */
  vencimentoMes?: number;
  /** Liberações manuais (mês → valor), aplicadas antes das automáticas. */
  liberacaoProgramada?: { mes: number; valor: number }[];
  /**
   * Quando definido, a liberação AUTOMÁTICA é dirigida pelo custo elegível
   * incorrido (§4.3 "Liberação mensal") — `percentualFinanciavel` do
   * acumulado, até `limiteComprometido`. Sem isso (capital de giro, §4.4),
   * a liberação automática vai direto até o limite, sem medição de custo.
   */
  custoElegivelMensal?: number[];
  percentualFinanciavel?: number; // 0–1
  /** Ordem de utilização (§5) — menor primeiro. */
  prioridadeFunding: number;
}

/** Preferred Equity (§4.2) — três modos de remuneração. */
export interface InstrumentoPreferredEquity {
  tipo: 'preferred_equity';
  nome: string;
  aportes: { mes: number; valor: number }[];
  modo: 'A' | 'B' | 'C';
  // Modo A — retorno preferencial fixo.
  taxaMensal?: number;
  capitalizacao?: 'simples' | 'composta';
  // Modo B — participação no residual em evento único.
  percentualResidualEvento?: number;
  mesEvento?: number;
  // Modo C — participação na receita líquida recebida.
  percentualReceitaLiquida?: number;
}

/**
 * Sponsor Equity (§4.1) — sempre existe pelo menos uma camada. Dois modos de
 * retorno, mutuamente exclusivos nesta referência: residual do waterfall
 * (padrão — `percentualReceitaLiquida` ausente) ou participação na receita
 * líquida recebida (percentual mensal, sem devolução separada de principal).
 */
export interface InstrumentoSponsorEquity {
  tipo: 'sponsor_equity';
  nome: string;
  aportesProgramados?: { mes: number; valor: number }[];
  cobreLacunaAutomatica: boolean;
  percentualReceitaLiquida?: number;
}

export type Instrumento = InstrumentoDivida | InstrumentoPreferredEquity | InstrumentoSponsorEquity;

export interface CenarioCapitalStack {
  nome: string;
  meses: number;
  /** Fluxo de caixa LIVRE do projeto (§2.1) — 1-based, índice 0 ignorado. Nunca inclui funding. */
  fluxoLivreMensal: number[];
  /** Receita líquida RECEBIDA no mês (§6.2), só necessária para Preferred Equity modo C. */
  receitaLiquidaMensal?: number[];
  reservaMinima: number;
  instrumentos: Instrumento[];
}

export interface ResultadoCapitalStack {
  lacunaFundingMensal: number[];
  lacunaFundingMaxima: number;
  caixaProjetoMensal: number[];
  liberacaoPorInstrumento: Record<string, number[]>;
  jurosPorInstrumento: Record<string, number[]>;
  amortizacaoPorInstrumento: Record<string, number[]>;
  saldoDividaPorInstrumento: Record<string, number[]>;
  aportePorInstrumentoPE: Record<string, number[]>;
  devolucaoPrincipalPE: Record<string, number[]>;
  remuneracaoPagaPE: Record<string, number[]>;
  remuneracaoAcumuladaFinalPE: Record<string, number>;
  capitalNaoDevolvidoFinalPE: Record<string, number>;
  participacaoReceitaPE: Record<string, number[]>;
  participacaoResidualPE: Record<string, number[]>;
  aporteSponsorMensal: number[];
  distribuicaoSponsorMensal: number[];
}

const arr = (n: number): number[] => new Array(n + 1).fill(0);

/**
 * Simulação de referência do Capital Stack — ordem mensal do §7, reduzida
 * ao que os instrumentos suportados (§4) exigem. Não modela dívida
 * `sac`/`price` nem Preferred Equity automático por lacuna (nenhum dos 16
 * casos de referência precisa) — ficam para quando um caso real exigir.
 */
export function simularCapitalStack(cen: CenarioCapitalStack): ResultadoCapitalStack {
  const N = cen.meses;
  const dividas = cen.instrumentos.filter((i): i is InstrumentoDivida => i.tipo === 'divida')
    .sort((a, b) => a.prioridadeFunding - b.prioridadeFunding);
  const preferenciais = cen.instrumentos.filter((i): i is InstrumentoPreferredEquity => i.tipo === 'preferred_equity');
  const sponsor = cen.instrumentos.find((i): i is InstrumentoSponsorEquity => i.tipo === 'sponsor_equity');

  const saldoDivida = new Map(dividas.map((d) => [d.nome, 0]));
  const liberadoAcumulado = new Map(dividas.map((d) => [d.nome, 0]));
  const custoElegivelAcumulado = new Map(dividas.map((d) => [d.nome, 0]));
  const capitalNaoDevolvido = new Map(preferenciais.map((p) => [p.nome, 0]));
  const remuneracaoAcumulada = new Map(preferenciais.map((p) => [p.nome, 0]));

  const r: ResultadoCapitalStack = {
    lacunaFundingMensal: arr(N), lacunaFundingMaxima: 0, caixaProjetoMensal: arr(N),
    liberacaoPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    jurosPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    amortizacaoPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    saldoDividaPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    aportePorInstrumentoPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    devolucaoPrincipalPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    remuneracaoPagaPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    remuneracaoAcumuladaFinalPE: {}, capitalNaoDevolvidoFinalPE: {},
    participacaoReceitaPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    participacaoResidualPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    aporteSponsorMensal: arr(N), distribuicaoSponsorMensal: arr(N),
  };

  let caixaProjeto = 0;

  for (let t = 1; t <= N; t++) {
    // 1) juros sobre saldo de ABERTURA (§4.3 "Juros e saldo") — sempre capitalizados
    // (nenhum dos 16 casos usa juros pagos na carência; fica para issue futura).
    for (const d of dividas) {
      const abertura = saldoDivida.get(d.nome)!;
      const juros = round2(abertura * d.taxaMensal);
      saldoDivida.set(d.nome, round2(abertura + juros));
      r.jurosPorInstrumento[d.nome][t] = juros;
    }

    // 2) fluxo livre do mês entra no caixa provisório
    let caixaProvisorio = caixaProjeto + n(cen.fluxoLivreMensal[t]);

    // 3) aportes/liberações PROGRAMADOS
    for (const d of dividas) {
      const prog = d.liberacaoProgramada?.find((l) => l.mes === t);
      if (!prog) continue;
      const liberar = Math.min(prog.valor, d.limiteComprometido - liberadoAcumulado.get(d.nome)!);
      if (liberar <= 0) continue;
      saldoDivida.set(d.nome, round2(saldoDivida.get(d.nome)! + liberar));
      liberadoAcumulado.set(d.nome, round2(liberadoAcumulado.get(d.nome)! + liberar));
      caixaProvisorio += liberar;
      r.liberacaoPorInstrumento[d.nome][t] = round2((r.liberacaoPorInstrumento[d.nome][t] ?? 0) + liberar);
    }
    for (const p of preferenciais) {
      const prog = p.aportes.find((a) => a.mes === t);
      if (!prog) continue;
      capitalNaoDevolvido.set(p.nome, round2(capitalNaoDevolvido.get(p.nome)! + prog.valor));
      caixaProvisorio += prog.valor;
      r.aportePorInstrumentoPE[p.nome][t] = prog.valor;
    }
    const aporteSponsorProg = sponsor?.aportesProgramados?.find((a) => a.mes === t);
    if (aporteSponsorProg) { caixaProvisorio += aporteSponsorProg.valor; r.aporteSponsorMensal[t] = aporteSponsorProg.valor; }

    // 4) necessidade de funding (§3.1) e liberações AUTOMÁTICAS por prioridade (§5)
    let necessidade = Math.max(0, cen.reservaMinima - caixaProvisorio);
    for (const d of dividas) {
      if (necessidade <= 0) break;
      let disponivel: number;
      if (d.custoElegivelMensal) {
        custoElegivelAcumulado.set(d.nome, round2(custoElegivelAcumulado.get(d.nome)! + n(d.custoElegivelMensal[t])));
        const desejadoAcum = Math.min(d.limiteComprometido, (d.percentualFinanciavel ?? 1) * custoElegivelAcumulado.get(d.nome)!);
        disponivel = Math.max(0, desejadoAcum - liberadoAcumulado.get(d.nome)!);
      } else {
        disponivel = Math.max(0, d.limiteComprometido - liberadoAcumulado.get(d.nome)!);
      }
      const real = round2(Math.min(disponivel, necessidade));
      if (real <= 0) continue;
      saldoDivida.set(d.nome, round2(saldoDivida.get(d.nome)! + real));
      liberadoAcumulado.set(d.nome, round2(liberadoAcumulado.get(d.nome)! + real));
      caixaProvisorio += real; necessidade -= real;
      r.liberacaoPorInstrumento[d.nome][t] = round2((r.liberacaoPorInstrumento[d.nome][t] ?? 0) + real);
    }
    if (necessidade > 0 && sponsor?.cobreLacunaAutomatica) {
      caixaProvisorio += necessidade;
      r.aporteSponsorMensal[t] = round2((r.aporteSponsorMensal[t] ?? 0) + necessidade);
      necessidade = 0;
    }
    r.lacunaFundingMensal[t] = round2(necessidade);
    r.lacunaFundingMaxima = Math.max(r.lacunaFundingMaxima, r.lacunaFundingMensal[t]);

    caixaProjeto = caixaProvisorio;

    // 5) amortização — cash sweep (§4.3, política recomendada) e bullet no vencimento
    let disponivelSweep = Math.max(0, caixaProjeto - cen.reservaMinima);
    for (const d of dividas) {
      if (d.politicaAmortizacao !== 'cash_sweep' || disponivelSweep <= 0) continue;
      const saldo = saldoDivida.get(d.nome)!;
      const pag = round2(Math.min(disponivelSweep, saldo));
      if (pag <= 0) continue;
      saldoDivida.set(d.nome, round2(saldo - pag));
      caixaProjeto = round2(caixaProjeto - pag); disponivelSweep = round2(disponivelSweep - pag);
      r.amortizacaoPorInstrumento[d.nome][t] = pag;
    }
    for (const d of dividas) {
      if (d.politicaAmortizacao !== 'bullet' || d.vencimentoMes !== t) continue;
      const saldo = saldoDivida.get(d.nome)!;
      const disponivel = Math.max(0, caixaProjeto - cen.reservaMinima);
      const pag = round2(Math.min(saldo, disponivel));
      saldoDivida.set(d.nome, round2(saldo - pag));
      caixaProjeto = round2(caixaProjeto - pag);
      r.amortizacaoPorInstrumento[d.nome][t] = round2((r.amortizacaoPorInstrumento[d.nome][t] ?? 0) + pag);
    }
    for (const d of dividas) r.saldoDividaPorInstrumento[d.nome][t] = saldoDivida.get(d.nome)!;

    // 6) Preferred Equity — remuneração, devolução de principal, participações (§4.2, §6.1-6.3)
    let caixaDistribuivel = Math.max(0, caixaProjeto - cen.reservaMinima);
    for (const p of preferenciais) {
      if (p.modo === 'A') {
        const capNaoDev = capitalNaoDevolvido.get(p.nome)!;
        const remunAcumAntes = remuneracaoAcumulada.get(p.nome)!;
        const base = p.capitalizacao === 'composta' ? capNaoDev + remunAcumAntes : capNaoDev;
        const remunMes = round2(base * (p.taxaMensal ?? 0));
        remuneracaoAcumulada.set(p.nome, round2(remunAcumAntes + remunMes));

        const remunDevida = remuneracaoAcumulada.get(p.nome)!;
        const pagRemun = round2(Math.min(remunDevida, caixaDistribuivel));
        remuneracaoAcumulada.set(p.nome, round2(remunDevida - pagRemun));
        caixaDistribuivel = round2(caixaDistribuivel - pagRemun); caixaProjeto = round2(caixaProjeto - pagRemun);
        r.remuneracaoPagaPE[p.nome][t] = pagRemun;

        const pagPrincipal = round2(Math.min(capNaoDev, caixaDistribuivel));
        capitalNaoDevolvido.set(p.nome, round2(capNaoDev - pagPrincipal));
        caixaDistribuivel = round2(caixaDistribuivel - pagPrincipal); caixaProjeto = round2(caixaProjeto - pagPrincipal);
        r.devolucaoPrincipalPE[p.nome][t] = pagPrincipal;
      } else if (p.modo === 'C') {
        const receitaLiq = Math.max(0, n(cen.receitaLiquidaMensal?.[t]));
        const desejado = round2(receitaLiq * (p.percentualReceitaLiquida ?? 0));
        const pag = round2(Math.min(desejado, caixaDistribuivel));
        caixaDistribuivel = round2(caixaDistribuivel - pag); caixaProjeto = round2(caixaProjeto - pag);
        r.participacaoReceitaPE[p.nome][t] = pag;
      } else if (p.modo === 'B' && p.mesEvento === t) {
        const capNaoDev = capitalNaoDevolvido.get(p.nome)!;
        const pagPrincipal = round2(Math.min(capNaoDev, caixaDistribuivel));
        capitalNaoDevolvido.set(p.nome, round2(capNaoDev - pagPrincipal));
        caixaDistribuivel = round2(caixaDistribuivel - pagPrincipal); caixaProjeto = round2(caixaProjeto - pagPrincipal);
        r.devolucaoPrincipalPE[p.nome][t] = pagPrincipal;

        const residual = round2(caixaDistribuivel * (p.percentualResidualEvento ?? 0));
        caixaDistribuivel = round2(caixaDistribuivel - residual); caixaProjeto = round2(caixaProjeto - residual);
        r.participacaoResidualPE[p.nome][t] = residual;
      }
    }

    // 7) Sponsor Equity: participação na receita líquida (se configurada) OU
    // resíduo do waterfall (§6.1 item 7 / §4.1).
    if (sponsor?.percentualReceitaLiquida !== undefined) {
      const receitaLiq = Math.max(0, n(cen.receitaLiquidaMensal?.[t]));
      const desejado = round2(receitaLiq * sponsor.percentualReceitaLiquida);
      const dist = round2(Math.min(desejado, caixaDistribuivel));
      caixaProjeto = round2(caixaProjeto - dist);
      r.distribuicaoSponsorMensal[t] = dist;
    } else if (sponsor) {
      const dist = caixaDistribuivel;
      caixaProjeto = round2(caixaProjeto - dist);
      r.distribuicaoSponsorMensal[t] = dist;
    }

    r.caixaProjetoMensal[t] = caixaProjeto;
  }

  for (const p of preferenciais) {
    r.remuneracaoAcumuladaFinalPE[p.nome] = remuneracaoAcumulada.get(p.nome)!;
    r.capitalNaoDevolvidoFinalPE[p.nome] = capitalNaoDevolvido.get(p.nome)!;
  }

  return r;
}

/** MOIC/ROI/TIR do fluxo de UM investidor (§8.3) — aportes como saída, recebimentos como entrada. */
export function moic(aportes: number, distribuicoes: number): number {
  return aportes > 0 ? distribuicoes / aportes : 0;
}
export function roi(aportes: number, distribuicoes: number): number {
  return aportes > 0 ? (distribuicoes - aportes) / aportes : 0;
}

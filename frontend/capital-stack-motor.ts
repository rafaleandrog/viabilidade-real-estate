// Motor do Programa Financeiro / Capital Stack (#239, FIN-03 a FIN-07 —
// #272-#276). Funções puras — sem DOM, sem I/O — mesma convenção de
// fluxo-caixa-motor.ts (arrays mensais 1-based; índice 0 ignorado).
//
// Histórico: FIN-03 entregou só a reconciliação de caixa
// (`fluxoAposFundingMensal`/`necessidadeFundingMensal`/etc.), porque nenhum
// instrumento tinha efeito no motor ainda. FIN-04+05+06+07 (Grupo 2 da Fase
// 9) promovem para aqui o simulador dos 4 instrumentos do §4 + prioridade de
// funding (§5) + waterfall (§6) que nasceu em
// `frontend/fixtures/capital-stack-golden.ts` (#270) — ele já estava
// correto e testado contra os 16 casos do §14; reescrevê-lo do zero, sem uma
// segunda fonte independente para comparar (não existe planilha real de
// Capital Stack, ver o ADR do #270), só trocaria risco por risco. A fixture
// agora importa este módulo em vez de duplicá-lo — os 16 casos continuam
// sendo a suíte de reconciliação, só que contra o motor real.

import { eCorretagem } from './fluxo-shared.js';

const round2 = (v: number): number => Math.round(v * 100) / 100;
const n = (v: any): number => Number(v) || 0;

/**
 * §6.2: receita_liquida_base = receita_bruta_recebida − impostos − corretagem
 * − permuta_financeira. `receitaMensal` (de `calcularFluxo`) já é líquida de
 * RET e permuta financeira (#228) — falta só a corretagem, que é uma linha
 * de custo comum (fonte oficial única, #227/#228) já calculada dentro de
 * `linhasCusto` com seu próprio `.mensal`. Única fonte para não duplicar
 * `corretagemMensal` (fluxo-caixa-motor.ts) nem divergir entre telas —
 * `tela-capital-stack.ts` e `tela-fluxo-ver.ts` consomem daqui.
 */
export function receitaLiquidaComCorretagemMensal(
  receitaMensal: number[],
  linhasCusto: { id: any; mensal: number[] }[],
  custosRaw: any[],
): number[] {
  const linhaCorretagem = custosRaw.find(eCorretagem);
  const corretagem = linhaCorretagem ? linhasCusto.find((l) => l.id === linhaCorretagem.id)?.mensal ?? [] : [];
  return receitaMensal.map((v, i) => v - (corretagem[i] ?? 0));
}

/** Taxa mensal equivalente a uma taxa anual composta: (1+a)^(1/12) − 1 — mesma fórmula usada em toda a app (VPL, Calliandra). */
export function taxaMensalEquivalente(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/**
 * Parcela fixa do sistema Price/francês que amortiza `principal` em `nper`
 * meses a `taxaMensal` — magnitude POSITIVA (convenção deste módulo: valores
 * de pagamento são positivos, o sinal é aplicado explicitamente por quem
 * chama). Equivalente ao `PMT` do Excel com o sinal invertido.
 */
export function pmtPrice(taxaMensal: number, nper: number, principal: number): number {
  if (nper <= 0) return principal;
  if (taxaMensal === 0) return principal / nper;
  const fator = Math.pow(1 + taxaMensal, nper);
  return principal * taxaMensal * fator / (fator - 1);
}

// ── Reconciliação de caixa (FIN-03, #272) ──────────────────────────────

/**
 * Fluxo de caixa do PROJETO após funding (§2.1, §12.4):
 *
 *   fluxo_apos_funding_t = fluxo_livre_projeto_t + entradas_funding_t − saidas_funding_t
 *
 * Os três arrays são 1-based (índice 0 ignorado); o resultado tem o
 * comprimento do maior dos três, preenchendo com zero onde um array for
 * mais curto.
 */
export function fluxoAposFundingMensal(
  fluxoLivreMensal: number[],
  entradasFundingMensal: number[],
  saidasFundingMensal: number[],
): number[] {
  const tam = Math.max(fluxoLivreMensal.length, entradasFundingMensal.length, saidasFundingMensal.length);
  const out = new Array<number>(tam).fill(0);
  for (let t = 1; t < tam; t++) {
    out[t] = round2((fluxoLivreMensal[t] ?? 0) + (entradasFundingMensal[t] ?? 0) - (saidasFundingMensal[t] ?? 0));
  }
  return out;
}

/** Caixa acumulado do projeto mês a mês, a partir de um fluxo mensal (1-based). */
export function caixaAcumuladoMensal(fluxoMensal: number[]): number[] {
  const out = new Array<number>(fluxoMensal.length).fill(0);
  let acc = 0;
  for (let t = 1; t < fluxoMensal.length; t++) {
    acc = round2(acc + (fluxoMensal[t] ?? 0));
    out[t] = acc;
  }
  return out;
}

/**
 * Necessidade de funding do mês (§3.1):
 *
 *   necessidade_funding_t = máximo(0, reserva_minima_caixa − caixa_provisorio_t)
 *
 * `caixaProvisorioMensal` já é o caixa acumulado ANTES de qualquer liberação
 * automática do mês (§7 passo 6) — quem chama decide o que entra nele; esta
 * função só aplica a fórmula.
 */
export function necessidadeFundingMensal(caixaProvisorioMensal: number[], reservaMinima: number): number[] {
  return caixaProvisorioMensal.map((v, i) => (i === 0 ? 0 : round2(Math.max(0, reservaMinima - v))));
}

/**
 * Caixa distribuível do mês (§3.2):
 *
 *   caixa_distribuivel_t = máximo(0, caixa_apos_operacao_e_divida_t − reserva_minima_caixa − obrigacoes_futuras_protegidas_t)
 *
 * `obrigacoesFuturasProtegidas` é opcional (default 0) — nenhum dos
 * instrumentos ainda em produção reserva caixa para obrigação futura;
 * fica pronto para quando existir.
 */
export function caixaDistribuivelMensal(
  caixaAposOperacaoEDividaMensal: number[],
  reservaMinima: number,
  obrigacoesFuturasProtegidas: number[] = [],
): number[] {
  return caixaAposOperacaoEDividaMensal.map((v, i) =>
    i === 0 ? 0 : round2(Math.max(0, v - reservaMinima - (obrigacoesFuturasProtegidas[i] ?? 0))));
}

/**
 * Reconciliação completa de um estudo (§12.4), válida enquanto nenhuma
 * camada tem efeito no motor (entradas/saídas de funding zero) — sem
 * instrumentos ativos, `fluxoAposFundingMensal` é idêntico a
 * `fluxoLivreMensal`. A lacuna de funding continua sendo calculada e
 * reportada mesmo assim (é só um SINAL informativo — nunca altera o fluxo
 * livre do projeto, Caso 16 do §14).
 *
 * Com instrumentos ATIVOS, use `simularCapitalStackDoEstudo` — ele já
 * calcula entradas/saídas de funding na ordem certa (§7) e não precisa
 * desta função por cima.
 */
export function reconciliarCapitalStack(
  fluxoLivreMensal: number[],
  entradasFundingMensal: number[],
  saidasFundingMensal: number[],
  reservaMinima: number,
): { fluxoAposFundingMensal: number[]; caixaProjetoMensal: number[]; necessidadeFundingMensal: number[]; lacunaFundingMaxima: number } {
  const fluxo = fluxoAposFundingMensal(fluxoLivreMensal, entradasFundingMensal, saidasFundingMensal);
  const caixaProjeto = caixaAcumuladoMensal(fluxo);
  const necessidade = necessidadeFundingMensal(caixaProjeto, reservaMinima);
  return {
    fluxoAposFundingMensal: fluxo,
    caixaProjetoMensal: caixaProjeto,
    necessidadeFundingMensal: necessidade,
    lacunaFundingMaxima: necessidade.length ? Math.max(...necessidade) : 0,
  };
}

// ── Instrumentos (§4), prioridade de funding (§5) e waterfall (§6) —
// FIN-04+05+06+07 (#273-276), promovido do oráculo #270 ──────────────────

export type PoliticaAmortizacao = 'cash_sweep' | 'bullet' | 'price';

/**
 * Financiamento à produção (§4.3), Capital de giro/dívida ponte (§4.4) ou
 * qualquer outra dívida — mesmo motor, independente do `tipo` da camada
 * (`financiamento_producao`/`capital_giro`). O modelo de carência + Price
 * (decodificado de `Incorp Individual!CK:CQ` da planilha de referência,
 * 2026-08-03) é genérico: aplica a QUALQUER dívida com essa política, não é
 * um produto à parte.
 */
export interface InstrumentoDivida {
  tipo: 'divida';
  nome: string;
  limiteComprometido: number;
  taxaMensal: number;
  politicaAmortizacao: PoliticaAmortizacao;
  /** Só para `bullet`: mês em que o saldo remanescente é quitado. */
  vencimentoMes?: number;
  /**
   * Só para `price`: meses de carência (juros pagos em caixa, principal
   * intocado) contados a partir do mês da PRIMEIRA liberação real (não um
   * mês fixo digitado — segue a liberação de fato, programada ou
   * automática). `undefined`/`0` = sem carência, amortização Price começa
   * no mês seguinte à primeira liberação.
   */
  carenciaMeses?: number;
  /**
   * Só para `price`: prazo TOTAL do contrato em meses, incluindo a
   * carência — mesma convenção da planilha ("Prazo total (inclui
   * carência)"). Os meses de amortização Price = `prazoMeses − carenciaMeses`.
   */
  prazoMeses?: number;
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
  /** Ordem de utilização/funding (§5) — menor primeiro. */
  prioridadeFunding: number;
  /** Ordem de pagamento/amortização entre dívidas (§9 "prioridade de pagamento") — menor primeiro. */
  prioridadePagamento: number;
}

/** Preferred Equity (§4.2) — quatro modos de remuneração. */
export interface InstrumentoPreferredEquity {
  tipo: 'preferred_equity';
  nome: string;
  aportes: { mes: number; valor: number }[];
  modo: 'A' | 'B' | 'C' | 'D';
  // Modo A — retorno preferencial fixo.
  taxaMensal?: number;
  capitalizacao?: 'simples' | 'composta';
  // Modo B — participação no residual em evento único.
  percentualResidualEvento?: number;
  mesEvento?: number;
  // Modo C — participação na receita líquida recebida, pró-rata mensal.
  percentualReceitaLiquida?: number;
  /**
   * Modo D (2026-08-03) — % do LUCRO FINAL do projeto (não do residual de um
   * mês específico como o modo B), pago a partir do mês seguinte à entrega/
   * fim de obras, em `parcelasLucro` meses IGUAIS. A base é o resultado
   * desalavancado do projeto inteiro (`Σ fluxoLivreMensal`) — só é
   * COMPUTÁVEL porque o motor já recebe o horizonte inteiro de uma vez (não
   * é streaming mês a mês); nenhuma fórmula existente muda, o valor é lido
   * uma vez antes do loop mensal começar.
   */
  percentualLucro?: number;
  mesEntregaLucro?: number;
  parcelasLucro?: number;
  /** Ordem de pagamento entre Preferred Equities (§9 "prioridade de pagamento") — menor primeiro. */
  prioridadePagamento: number;
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
  /** Receita líquida RECEBIDA no mês (§6.2), só necessária para Preferred Equity/Sponsor modo C. */
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
  /** Séries mensais dos dois saldos acima (§10 "Saldos") — os campos `*FinalPE` continuam sendo só o último mês, por conveniência. */
  remuneracaoAcumuladaPorInstrumentoPE: Record<string, number[]>;
  capitalNaoDevolvidoPorInstrumentoPE: Record<string, number[]>;
  participacaoReceitaPE: Record<string, number[]>;
  participacaoResidualPE: Record<string, number[]>;
  /** Modo D — parcelas de "% do lucro final", pagas a partir do mês seguinte à entrega. */
  participacaoLucroPE: Record<string, number[]>;
  aporteSponsorMensal: number[];
  distribuicaoSponsorMensal: number[];
  /** Por instrumento — só relevante com 2+ Sponsor Equity ativos (rateio pro-rata pelo aporte, §4.1). Com 1 só, é igual ao array agregado acima. */
  aportePorInstrumentoSponsor: Record<string, number[]>;
  distribuicaoPorInstrumentoSponsor: Record<string, number[]>;
}

const arr = (tam: number): number[] => new Array(tam + 1).fill(0);

/** Peso pro-rata (0..1) pelo aporte acumulado de cada instrumento; igual entre todos se a soma for zero. */
function pesarPorAporte(instrumentos: { nome: string }[], aporteAcumulado: Map<string, number>): Map<string, number> {
  const total = instrumentos.reduce((s, i) => s + (aporteAcumulado.get(i.nome) ?? 0), 0);
  const pesos = new Map<string, number>();
  for (const i of instrumentos) {
    pesos.set(i.nome, total > 0 ? (aporteAcumulado.get(i.nome) ?? 0) / total : 1 / instrumentos.length);
  }
  return pesos;
}

/**
 * Simulação dos 4 instrumentos do §4, prioridade de funding (§5) e waterfall
 * (§6) — ordem mensal do §7, reduzida ao que os instrumentos suportados
 * exigem. Não modela dívida `sac` nem Preferred Equity automático por lacuna
 * (nenhum dos 16 casos de referência do #270 precisa) — ficam para quando um
 * caso real exigir. `price` (2026-08-03) foi adicionada a partir da
 * planilha de referência (Capital de Giro, `Incorp Individual!CK:CQ`).
 */
export function simularCapitalStack(cen: CenarioCapitalStack): ResultadoCapitalStack {
  const N = cen.meses;
  const dividas = cen.instrumentos.filter((i): i is InstrumentoDivida => i.tipo === 'divida')
    .sort((a, b) => a.prioridadeFunding - b.prioridadeFunding);
  // §9 "prioridade de pagamento" é uma ordem DISTINTA da de funding (§5) —
  // só importa quando há 2+ dívidas ou 2+ Preferred Equity; nenhum dos 16
  // golden cases (#270) tem mais de um instrumento do mesmo tipo, então esta
  // ordem nunca é exercida por eles (sort estável = não regride nada).
  const dividasPorPagamento = [...dividas].sort((a, b) => a.prioridadePagamento - b.prioridadePagamento);
  const preferenciais = cen.instrumentos.filter((i): i is InstrumentoPreferredEquity => i.tipo === 'preferred_equity')
    .sort((a, b) => a.prioridadePagamento - b.prioridadePagamento);
  // Rateio pro-rata pelo aporte acumulado — decisão do autor (2026-08-02):
  // com 2+ Sponsor Equity ativos, cada um recebe fatia proporcional ao que já
  // aportou; sem nenhum aporte ainda, divide igualmente (nenhum critério para
  // preferir um sobre o outro). Com 1 só sponsor, o peso é sempre 1 — nenhum
  // dos 16 golden cases (#270) tem mais de um, então não regride nada.
  const sponsors = cen.instrumentos.filter((i): i is InstrumentoSponsorEquity => i.tipo === 'sponsor_equity');

  const saldoDivida = new Map(dividas.map((d) => [d.nome, 0]));
  const liberadoAcumulado = new Map(dividas.map((d) => [d.nome, 0]));
  const custoElegivelAcumulado = new Map(dividas.map((d) => [d.nome, 0]));
  const capitalNaoDevolvido = new Map(preferenciais.map((p) => [p.nome, 0]));
  const remuneracaoAcumulada = new Map(preferenciais.map((p) => [p.nome, 0]));
  const aporteAcumuladoSponsor = new Map(sponsors.map((s) => [s.nome, 0]));
  // `price`: mês da primeira liberação real (não um mês fixo digitado — segue
  // a liberação de fato) e a parcela fixa, calculada uma única vez ao entrar
  // na fase de amortização (mesma convenção da planilha: PMT sobre o saldo
  // no início da fase, não recalculado todo mês).
  const primeiraLiberacaoMes = new Map<string, number | null>(dividas.map((d) => [d.nome, null]));
  const parcelaPrice = new Map<string, number | null>(dividas.map((d) => [d.nome, null]));
  // Modo D: base = resultado desalavancado do projeto INTEIRO — só é
  // computável de antemão porque `cen.fluxoLivreMensal` já chega com o
  // horizonte inteiro (o motor não é streaming mês a mês); nenhuma fórmula
  // existente muda, é só uma leitura antecipada de um array já conhecido.
  const resultadoFinalProjeto = cen.fluxoLivreMensal.reduce((s, v) => s + n(v), 0);
  // Saldo pendente por falta de caixa num mês — mesma convenção do modo A
  // (`remuneracaoAcumulada`): nunca força caixa negativo, acumula e tenta de novo.
  const saldoDevidoLucro = new Map(preferenciais.map((p) => [p.nome, 0]));

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
    remuneracaoAcumuladaPorInstrumentoPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    capitalNaoDevolvidoPorInstrumentoPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    participacaoReceitaPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    participacaoResidualPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    participacaoLucroPE: Object.fromEntries(preferenciais.map((p) => [p.nome, arr(N)])),
    aporteSponsorMensal: arr(N), distribuicaoSponsorMensal: arr(N),
    aportePorInstrumentoSponsor: Object.fromEntries(sponsors.map((s) => [s.nome, arr(N)])),
    distribuicaoPorInstrumentoSponsor: Object.fromEntries(sponsors.map((s) => [s.nome, arr(N)])),
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
    for (const s of sponsors) {
      const prog = s.aportesProgramados?.find((a) => a.mes === t);
      if (!prog) continue;
      aporteAcumuladoSponsor.set(s.nome, round2(aporteAcumuladoSponsor.get(s.nome)! + prog.valor));
      caixaProvisorio += prog.valor;
      r.aporteSponsorMensal[t] = round2((r.aporteSponsorMensal[t] ?? 0) + prog.valor);
      r.aportePorInstrumentoSponsor[s.nome][t] = round2((r.aportePorInstrumentoSponsor[s.nome][t] ?? 0) + prog.valor);
    }

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
    const sponsorsCobrem = sponsors.filter((s) => s.cobreLacunaAutomatica);
    if (necessidade > 0 && sponsorsCobrem.length > 0) {
      const pesos = pesarPorAporte(sponsorsCobrem, aporteAcumuladoSponsor);
      for (const s of sponsorsCobrem) {
        const parte = round2(necessidade * pesos.get(s.nome)!);
        caixaProvisorio += parte;
        r.aporteSponsorMensal[t] = round2((r.aporteSponsorMensal[t] ?? 0) + parte);
        r.aportePorInstrumentoSponsor[s.nome][t] = round2((r.aportePorInstrumentoSponsor[s.nome][t] ?? 0) + parte);
        aporteAcumuladoSponsor.set(s.nome, round2(aporteAcumuladoSponsor.get(s.nome)! + parte));
      }
      necessidade = 0;
    }
    r.lacunaFundingMensal[t] = round2(necessidade);
    r.lacunaFundingMaxima = Math.max(r.lacunaFundingMaxima, r.lacunaFundingMensal[t]);

    caixaProjeto = caixaProvisorio;

    // Marca a primeira liberação real (programada ou automática) — só depois
    // dela é que carência/amortização Price fazem sentido.
    for (const d of dividas) {
      if (primeiraLiberacaoMes.get(d.nome) == null && (r.liberacaoPorInstrumento[d.nome][t] ?? 0) > 0) {
        primeiraLiberacaoMes.set(d.nome, t);
      }
    }

    // 5) amortização — as 3 políticas dividem UMA fila de prioridade de
    // pagamento (§9), em vez de duas filas separadas (cash_sweep sempre
    // antes de bullet, independente da prioridade) — corrige uma
    // inconsistência que só aparecia com 2+ dívidas de políticas diferentes
    // competindo pelo mesmo caixa no mesmo mês.
    let disponivelAmort = Math.max(0, caixaProjeto - cen.reservaMinima);
    for (const d of dividasPorPagamento) {
      if (disponivelAmort <= 0) break;
      const saldo = saldoDivida.get(d.nome)!;
      if (saldo <= 0) continue;
      let pag = 0;
      if (d.politicaAmortizacao === 'cash_sweep') {
        pag = round2(Math.min(disponivelAmort, saldo));
      } else if (d.politicaAmortizacao === 'bullet') {
        if (d.vencimentoMes === t) pag = round2(Math.min(disponivelAmort, saldo));
      } else if (d.politicaAmortizacao === 'price') {
        const primeiraLib = primeiraLiberacaoMes.get(d.nome);
        if (primeiraLib != null) {
          const carencia = d.carenciaMeses ?? 0;
          const emCarencia = t > primeiraLib && t <= primeiraLib + carencia;
          // `saldo` (lido acima) JÁ inclui os juros deste mês (passo 1 soma
          // antes de chegar aqui) — não somar `juros` de novo.
          const juros = r.jurosPorInstrumento[d.nome][t] ?? 0;
          if (emCarencia) {
            // §4.3/4.4 do doc — "juros pagos na carência" (não capitalizados):
            // o saldo não muda (juros somados no passo 1 e devolvidos aqui).
            // Diferente da planilha (que sempre paga o juros da carência,
            // sem checar caixa): aqui é capado pelo caixa disponível, como
            // toda amortização deste motor (§12.2/12.3) — não força negativo.
            pag = round2(Math.min(disponivelAmort, juros));
          } else if (t === primeiraLib + carencia + 1) {
            // 1º mês fora da carência: calcula a parcela fixa UMA VEZ, sobre
            // o total LIBERADO (não `saldo`, que aqui já embute o juros deste
            // mês) — equivale ao principal original quando a carência só
            // pagou juros (o caso comum), e generaliza corretamente se houve
            // liberação adicional durante a carência.
            const nAmort = Math.max(1, (d.prazoMeses ?? 0) - carencia);
            const parcela = round2(pmtPrice(d.taxaMensal, nAmort, liberadoAcumulado.get(d.nome)!));
            parcelaPrice.set(d.nome, parcela);
            pag = round2(Math.min(disponivelAmort, Math.min(parcela, saldo)));
          } else {
            const parcela = parcelaPrice.get(d.nome) ?? 0;
            pag = round2(Math.min(disponivelAmort, Math.min(parcela, saldo)));
          }
        }
      }
      if (pag <= 0) continue;
      saldoDivida.set(d.nome, round2(saldo - pag));
      caixaProjeto = round2(caixaProjeto - pag); disponivelAmort = round2(disponivelAmort - pag);
      r.amortizacaoPorInstrumento[d.nome][t] = round2((r.amortizacaoPorInstrumento[d.nome][t] ?? 0) + pag);
    }
    for (const d of dividas) r.saldoDividaPorInstrumento[d.nome][t] = saldoDivida.get(d.nome)!;

    // 6) Preferred Equity — remuneração, devolução de principal, participações (§4.2, §6.1-6.3)
    let caixaDistribuivel = Math.max(0, caixaProjeto - cen.reservaMinima);
    for (const p of preferenciais) {
      if (p.modo === 'A') {
        // §6.1 "Ordem padrão obrigatória": item 4 (devolução de principal) vem
        // ANTES do item 5 (pagamento da remuneração preferencial acumulada).
        // O acúmulo da remuneração deste mês usa o saldo de ABERTURA
        // (`capNaoDevAbertura`, antes de qualquer pagamento do mês — mesma
        // convenção de `juros_t = saldo_abertura_t × taxa`, §4.3); só a ORDEM
        // de PAGAMENTO é principal-primeiro, quando o caixa não cobre os dois.
        const capNaoDevAbertura = capitalNaoDevolvido.get(p.nome)!;
        const remunAcumAntes = remuneracaoAcumulada.get(p.nome)!;
        const base = p.capitalizacao === 'composta' ? capNaoDevAbertura + remunAcumAntes : capNaoDevAbertura;
        const remunMes = round2(base * (p.taxaMensal ?? 0));
        remuneracaoAcumulada.set(p.nome, round2(remunAcumAntes + remunMes));

        const pagPrincipal = round2(Math.min(capNaoDevAbertura, caixaDistribuivel));
        capitalNaoDevolvido.set(p.nome, round2(capNaoDevAbertura - pagPrincipal));
        caixaDistribuivel = round2(caixaDistribuivel - pagPrincipal); caixaProjeto = round2(caixaProjeto - pagPrincipal);
        r.devolucaoPrincipalPE[p.nome][t] = pagPrincipal;

        const remunDevida = remuneracaoAcumulada.get(p.nome)!;
        const pagRemun = round2(Math.min(remunDevida, caixaDistribuivel));
        remuneracaoAcumulada.set(p.nome, round2(remunDevida - pagRemun));
        caixaDistribuivel = round2(caixaDistribuivel - pagRemun); caixaProjeto = round2(caixaProjeto - pagRemun);
        r.remuneracaoPagaPE[p.nome][t] = pagRemun;
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
      } else if (p.modo === 'D' && p.mesEntregaLucro !== undefined && p.parcelasLucro) {
        // % do LUCRO FINAL do projeto (não do resíduo de um mês, como o modo
        // B) — total fixo desde o mês 1, parcelado em `parcelasLucro` meses
        // iguais a partir do mês seguinte à entrega. Lucro negativo não gera
        // pagamento (participação sobre prejuízo não faz sentido econômico).
        const totalLucro = Math.max(0, round2((p.percentualLucro ?? 0) * resultadoFinalProjeto));
        const parcelaFixa = round2(totalLucro / p.parcelasLucro);
        if (t > p.mesEntregaLucro && t <= p.mesEntregaLucro + p.parcelasLucro) {
          saldoDevidoLucro.set(p.nome, round2(saldoDevidoLucro.get(p.nome)! + parcelaFixa));
        }
        const devido = saldoDevidoLucro.get(p.nome)!;
        const pag = round2(Math.min(devido, caixaDistribuivel));
        saldoDevidoLucro.set(p.nome, round2(devido - pag));
        caixaDistribuivel = round2(caixaDistribuivel - pag); caixaProjeto = round2(caixaProjeto - pag);
        r.participacaoLucroPE[p.nome][t] = pag;
      }
      // §10 "Saldos" — série mensal (não só o valor final) dos dois saldos de
      // Preferred Equity, para a tabela/exportação mostrarem a evolução.
      r.capitalNaoDevolvidoPorInstrumentoPE[p.nome][t] = capitalNaoDevolvido.get(p.nome)!;
      r.remuneracaoAcumuladaPorInstrumentoPE[p.nome][t] = remuneracaoAcumulada.get(p.nome)!;
    }

    // 7) Sponsor Equity: participação na receita líquida (se configurada,
    // INDEPENDENTE por sponsor — é % contratual fixo, não pool compartilhado)
    // OU resíduo do waterfall (§6.1 item 7 / §4.1) — esse sim é pool
    // compartilhado entre os sponsors sem % próprio, rateado pro-rata pelo
    // aporte acumulado (decisão do autor, 2026-08-02).
    for (const s of sponsors) {
      if (s.percentualReceitaLiquida === undefined) continue;
      const receitaLiq = Math.max(0, n(cen.receitaLiquidaMensal?.[t]));
      const desejado = round2(receitaLiq * s.percentualReceitaLiquida);
      const dist = round2(Math.min(desejado, caixaDistribuivel));
      caixaDistribuivel = round2(caixaDistribuivel - dist); caixaProjeto = round2(caixaProjeto - dist);
      r.distribuicaoSponsorMensal[t] = round2((r.distribuicaoSponsorMensal[t] ?? 0) + dist);
      r.distribuicaoPorInstrumentoSponsor[s.nome][t] = dist;
    }
    const sponsorsResidual = sponsors.filter((s) => s.percentualReceitaLiquida === undefined);
    if (sponsorsResidual.length > 0 && caixaDistribuivel > 0) {
      const pesos = pesarPorAporte(sponsorsResidual, aporteAcumuladoSponsor);
      for (const s of sponsorsResidual) {
        const parte = round2(caixaDistribuivel * pesos.get(s.nome)!);
        caixaProjeto = round2(caixaProjeto - parte);
        r.distribuicaoSponsorMensal[t] = round2((r.distribuicaoSponsorMensal[t] ?? 0) + parte);
        r.distribuicaoPorInstrumentoSponsor[s.nome][t] = parte;
      }
    }

    r.caixaProjetoMensal[t] = caixaProjeto;
  }

  for (const p of preferenciais) {
    r.remuneracaoAcumuladaFinalPE[p.nome] = remuneracaoAcumulada.get(p.nome)!;
    r.capitalNaoDevolvidoFinalPE[p.nome] = capitalNaoDevolvido.get(p.nome)!;
  }

  return r;
}

/** MOIC/ROI do fluxo de UM investidor (§8.3) — aportes como saída, recebimentos como entrada. */
export function moic(aportes: number, distribuicoes: number): number {
  return aportes > 0 ? distribuicoes / aportes : 0;
}
export function roi(aportes: number, distribuicoes: number): number {
  return aportes > 0 ? (distribuicoes - aportes) / aportes : 0;
}

/**
 * TIR mensal do fluxo de caixa de UM investidor/credor — `fluxo[t]` negativo
 * nos meses de aporte/liberação, positivo nos meses de recebimento (§8.3).
 * Bisseção (robusta, sem risco de não-convergência do Newton-Raphson) sobre
 * a taxa que zera o VPL do fluxo. `null` quando não há troca de sinal (só
 * saídas, só entradas, ou fluxo todo zero) — não existe TIR nesse caso.
 */
export function tirMensal(fluxo: number[]): number | null {
  const temNegativo = fluxo.some((v) => v < 0);
  const temPositivo = fluxo.some((v) => v > 0);
  if (!temNegativo || !temPositivo) return null;

  const vpl = (taxa: number): number => fluxo.reduce((s, v, t) => s + v / Math.pow(1 + taxa, t), 0);

  // Busca um intervalo [lo, hi] com troca de sinal de VPL antes de bissectar.
  let lo = -0.99, hi = 10;
  const vplLo = vpl(lo), vplHi = vpl(hi);
  if (Math.sign(vplLo) === Math.sign(vplHi)) return null;

  for (let i = 0; i < 100; i++) {
    const meio = (lo + hi) / 2;
    const vplMeio = vpl(meio);
    if (Math.abs(vplMeio) < 0.01) return meio;
    if (Math.sign(vplMeio) === Math.sign(vpl(lo))) lo = meio; else hi = meio;
  }
  return (lo + hi) / 2;
}

/** TIR anualizada — `(1 + TIR mensal)^12 − 1` (§8.3). `null` se não há TIR mensal. */
export function tirAnual(fluxo: number[]): number | null {
  const m = tirMensal(fluxo);
  return m === null ? null : Math.pow(1 + m, 12) - 1;
}

/** Soma elemento a elemento todas as séries de um Record — 1-based, mesmo comprimento de `tam`. */
function somaRecord(rec: Record<string, number[]>, tam: number): number[] {
  const out = new Array<number>(tam).fill(0);
  for (const serie of Object.values(rec)) {
    for (let t = 1; t < tam; t++) out[t] = round2(out[t] + (serie[t] ?? 0));
  }
  return out;
}

/**
 * §10 "Fluxo de Caixa e relatórios" — Funding Entradas/Saídas agregado, mês a
 * mês, EXATAMENTE como a árvore do doc define (as mesmas linhas somadas, na
 * mesma composição). Função pura e única fonte: a tela (gráfico/tabela) e a
 * exportação CSV/PDF devem consumir daqui, nunca recalcular por conta própria
 * (§10: "Exportação CSV/PDF e cenários devem usar exatamente os mesmos
 * arrays do motor").
 */
export function fundingEntradasSaidasMensal(r: ResultadoCapitalStack): { entradas: number[]; saidas: number[] } {
  const tam = r.caixaProjetoMensal.length;
  const entradas = somaRecord(r.liberacaoPorInstrumento, tam);
  const entradasPE = somaRecord(r.aportePorInstrumentoPE, tam);
  const saidas = somaRecord(r.jurosPorInstrumento, tam);
  const amortizacao = somaRecord(r.amortizacaoPorInstrumento, tam);
  const devolucaoPE = somaRecord(r.devolucaoPrincipalPE, tam);
  const remuneracaoPE = somaRecord(r.remuneracaoPagaPE, tam);
  const participacaoReceita = somaRecord(r.participacaoReceitaPE, tam);
  const participacaoResidual = somaRecord(r.participacaoResidualPE, tam);
  const participacaoLucro = somaRecord(r.participacaoLucroPE, tam);
  for (let t = 1; t < tam; t++) {
    entradas[t] = round2(entradas[t] + entradasPE[t] + (r.aporteSponsorMensal[t] ?? 0));
    saidas[t] = round2(saidas[t] + amortizacao[t] + devolucaoPE[t] + remuneracaoPE[t]
      + participacaoReceita[t] + participacaoResidual[t] + participacaoLucro[t] + (r.distribuicaoSponsorMensal[t] ?? 0));
  }
  return { entradas, saidas };
}

// ── Adaptador: camadas reais (avancado_capital_instrumentos, #271) → Instrumento ──

/**
 * Soma, mês a mês, as linhas de custo ELEGÍVEIS de um financiamento à
 * produção (§4.3 "seleção das linhas de custo elegíveis") — `linhasCusto`
 * já vem calculado (`LinhaCalc[]` de `calcularFluxo`, cada uma com sua
 * própria série `mensal`); `custoLinhaIds` é a seleção guardada em
 * `config.custoLinhaIds` da camada.
 */
export function custoElegivelMensalDeLinhas(
  linhasCusto: { id: any; mensal: number[] }[],
  custoLinhaIds: number[] | undefined,
  meses: number,
): number[] {
  const out = new Array<number>(meses + 1).fill(0);
  if (!custoLinhaIds?.length) return out;
  const ids = new Set(custoLinhaIds.map(Number));
  for (const l of linhasCusto) {
    if (!ids.has(Number(l.id))) continue;
    for (let t = 1; t <= meses; t++) out[t] = round2(out[t] + (l.mensal[t - 1] ?? 0));
  }
  return out;
}

/**
 * Converte um registro de `avancado_capital_instrumentos` (coluna `config`
 * json, shape por `tipo` — ver docs/viabilidade/funding-capital-stack.md
 * §4) no `Instrumento` que `simularCapitalStack` consome. `null` para um
 * `tipo` desconhecido (defensivo — o schema já restringe as 4 opções).
 */
export function instrumentoDeRegistro(registro: any, custoElegivelMensal?: number[]): Instrumento | null {
  const cfg = registro?.config ?? {};
  if (registro?.tipo === 'financiamento_producao' || registro?.tipo === 'capital_giro') {
    return {
      tipo: 'divida',
      nome: registro.nome,
      limiteComprometido: n(registro.compromisso),
      taxaMensal: taxaMensalEquivalente(n(cfg.taxaAnual)),
      politicaAmortizacao: cfg.politicaAmortizacao === 'bullet' ? 'bullet' : cfg.politicaAmortizacao === 'price' ? 'price' : 'cash_sweep',
      vencimentoMes: cfg.vencimentoMes !== undefined ? Number(cfg.vencimentoMes) : undefined,
      carenciaMeses: cfg.carenciaMeses !== undefined ? Number(cfg.carenciaMeses) : undefined,
      prazoMeses: cfg.prazoMeses !== undefined ? Number(cfg.prazoMeses) : undefined,
      liberacaoProgramada: cfg.liberacaoProgramada,
      custoElegivelMensal: registro.tipo === 'financiamento_producao' ? custoElegivelMensal : undefined,
      percentualFinanciavel: cfg.percentualFinanciavel !== undefined ? Number(cfg.percentualFinanciavel) : undefined,
      prioridadeFunding: n(registro.prioridade_funding),
      prioridadePagamento: n(registro.prioridade_pagamento),
    };
  }
  if (registro?.tipo === 'preferred_equity') {
    return {
      tipo: 'preferred_equity',
      nome: registro.nome,
      aportes: cfg.aportes ?? [],
      modo: cfg.modo === 'B' || cfg.modo === 'C' || cfg.modo === 'D' ? cfg.modo : 'A',
      taxaMensal: cfg.taxaAnual !== undefined ? taxaMensalEquivalente(n(cfg.taxaAnual)) : undefined,
      capitalizacao: cfg.capitalizacao === 'composta' ? 'composta' : 'simples',
      percentualResidualEvento: cfg.percentualResidualEvento !== undefined ? Number(cfg.percentualResidualEvento) : undefined,
      mesEvento: cfg.mesEvento !== undefined ? Number(cfg.mesEvento) : undefined,
      percentualReceitaLiquida: cfg.percentualReceitaLiquida !== undefined ? Number(cfg.percentualReceitaLiquida) : undefined,
      percentualLucro: cfg.percentualLucro !== undefined ? Number(cfg.percentualLucro) : undefined,
      mesEntregaLucro: cfg.mesEntregaLucro !== undefined ? Number(cfg.mesEntregaLucro) : undefined,
      parcelasLucro: cfg.parcelasLucro !== undefined ? Number(cfg.parcelasLucro) : undefined,
      prioridadePagamento: n(registro.prioridade_pagamento),
    };
  }
  if (registro?.tipo === 'sponsor_equity') {
    return {
      tipo: 'sponsor_equity',
      nome: registro.nome,
      aportesProgramados: cfg.aportesProgramados,
      cobreLacunaAutomatica: Boolean(cfg.cobreLacunaAutomatica),
      percentualReceitaLiquida: cfg.percentualReceitaLiquida !== undefined ? Number(cfg.percentualReceitaLiquida) : undefined,
    };
  }
  return null;
}

/**
 * Simula o Capital Stack de um estudo a partir das camadas reais
 * (`avancado_capital_instrumentos`, #271) + do fluxo já calculado pelo motor
 * comercial (`calcularFluxo`, `frontend/fluxo-caixa-motor.ts`).
 *
 * Só camadas com `status === 'ativo'` participam — `rascunho`/
 * `revisao_necessaria`/`encerrado` não têm efeito no motor (§13.3): uma
 * camada migrada (#271) fica inerte até o usuário confirmá-la.
 */
export function simularCapitalStackDoEstudo(
  fluxoLivreMensal: number[],
  receitaLiquidaMensal: number[],
  registros: any[],
  linhasCusto: { id: any; mensal: number[] }[],
  reservaMinima: number,
): ResultadoCapitalStack {
  const meses = Math.max(0, fluxoLivreMensal.length - 1);
  const instrumentos: Instrumento[] = [];
  for (const registro of registros) {
    if (registro?.status !== 'ativo') continue;
    const custoElegivel = registro.tipo === 'financiamento_producao'
      ? custoElegivelMensalDeLinhas(linhasCusto, registro.config?.custoLinhaIds, meses)
      : undefined;
    const inst = instrumentoDeRegistro(registro, custoElegivel);
    if (inst) instrumentos.push(inst);
  }
  return simularCapitalStack({ nome: 'estudo', meses, fluxoLivreMensal, receitaLiquidaMensal, reservaMinima, instrumentos });
}

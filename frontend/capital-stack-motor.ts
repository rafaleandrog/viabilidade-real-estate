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

import { eCorretagem, eFinanciavelPadrao, marcosObra, type EventoCrono } from './fluxo-shared.js';
import { vplFluxo } from './fluxo-caixa-motor.js';

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

// Defaults do Financiamento à produção — os valores da planilha de
// referência (`Premissas e Resultados!D25:D28`). Aplicam-se quando a camada
// não declara o campo; um `0` GRAVADO continua valendo 0 (é escolha, não
// ausência). A migração `028` persiste estes mesmos números nas camadas
// antigas, para que o valor apareça editável na tela em vez de ficar
// implícito no código.
export const PADRAO_EXPOSICAO_MINIMA = 0.20;
export const PADRAO_PERCENTUAL_FINANCIAVEL = 0.80;
export const PADRAO_AMORTIZAR_COM_CAIXA = true;

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
 * Como a liberação AUTOMÁTICA da dívida é dimensionada:
 *
 *  - `por_necessidade` — libera só o que falta de caixa no mês
 *    (`min(disponível, necessidade)`), respeitando o §4.3 "o app não deve
 *    liberar mais dívida apenas porque o limite existe". É o modelo do
 *    Capital de giro/dívida ponte (§4.4).
 *  - `retroativo` — libera INCONDICIONALMENTE o que a medição de custo
 *    autoriza, tenha o projeto necessidade de caixa ou não, e a primeira
 *    liberação reconhece retroativamente todo o custo elegível já incorrido
 *    (catch-up). É o modelo contratual de Financiamento à produção da
 *    planilha de referência (`Incorp Individual!BW:CH`) — o "modo contratual
 *    de liberação explicitamente selecionado" que o próprio §4.3 abre como
 *    exceção à regra acima.
 *
 * `equity_first` (incorporadora banca permanentemente os primeiros N% e o
 * banco só financia os custos seguintes) é uma terceira modalidade
 * concebível, deliberadamente NÃO implementada: nenhum contrato real pediu, e
 * confundi-la com `retroativo` é o erro clássico deste produto (a exposição
 * mínima é um GATILHO, não uma franquia permanente).
 */
export type ModalidadeLiberacao = 'por_necessidade' | 'retroativo';

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
  /**
   * Teto contratual de principal. `0` = SEM teto — o caso da planilha de
   * referência, onde o principal para naturalmente em
   * `percentualFinanciavel × custoElegivelTotal`. Na modalidade `retroativo`
   * esse produto vira o limite efetivo quando este campo é zero.
   */
  limiteComprometido: number;
  taxaMensal: number;
  politicaAmortizacao: PoliticaAmortizacao;
  /** Default `por_necessidade` — preserva o comportamento de toda dívida que não declara nada. */
  modalidadeLiberacao?: ModalidadeLiberacao;
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
  /**
   * Denominador do "% de custo financiável incorrido" que dispara
   * `exposicaoMinima`. Default: `Σ custoElegivelMensal` — o custo elegível do
   * projeto INTEIRO, não o do horizonte já percorrido. É deliberado que o
   * gatilho seja medido contra o total planejado: é assim que o banco afere
   * "20% da obra executada", e é o que a planilha faz
   * (`BX = SUM(BW até t) / Totals(BW)`).
   */
  custoElegivelTotal?: number;
  /**
   * Só na modalidade `retroativo` (§4.3 "exigência de equity/obra executada
   * antes da primeira liberação"): fração (0–1) do custo elegível TOTAL que
   * precisa já ter sido incorrida para o banco começar a liberar. Enquanto
   * não é atingida, `liberacao = 0`; quando é, a primeira liberação cobre
   * retroativamente todo o acumulado. `undefined`/`0` = sem gatilho.
   */
  exposicaoMinima?: number;
  /**
   * Só na modalidade `retroativo`: 1-based, `true` nos meses em que o
   * contrato admite liberação (obra ativa ou evento de entrega). Fora da
   * janela não há desembolso mesmo com custo elegível incorrido.
   * `undefined` = sem restrição de janela.
   */
  janelaLiberacao?: boolean[];
  /**
   * Só na modalidade `retroativo`: quando `false`, nenhuma amortização
   * acontece ANTES da entrega das chaves, mesmo com caixa sobrando. Depois de
   * `mesChaves` a amortização é sempre permitida, independente deste campo.
   * Default `true`.
   */
  amortizarComCaixaDisponivel?: boolean;
  /** Só na modalidade `retroativo`: a partir dele o cash sweep é obrigatório. */
  mesChaves?: number;
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
  // ── Diagnóstico da medição de custo elegível (§4.3) ──────────────────
  // Preenchidas para TODA dívida com `custoElegivelMensal`; zeradas nas
  // demais. Existem para auditoria linha a linha contra a planilha: sem elas
  // só dá para conferir o resultado, não o caminho até ele.
  custoElegivelPorInstrumento: Record<string, number[]>;
  custoElegivelAcumuladoPorInstrumento: Record<string, number[]>;
  /** Fração 0–1 do custo elegível total já incorrido — precisão plena, arredonda só para exibir. */
  percentualIncorridoPorInstrumento: Record<string, number[]>;
  /** 0/1 — o gatilho de exposição mínima + janela autorizou liberação neste mês. */
  liberacaoHabilitadaPorInstrumento: Record<string, number[]>;
  /** `min(limite, percentualFinanciavel × custoElegivelAcumulado)` — quanto DEVERIA estar liberado. */
  alvoAcumuladoPorInstrumento: Record<string, number[]>;
  liberacaoAcumuladaPorInstrumento: Record<string, number[]>;
  /**
   * Caixa que o mês oferece ao cash sweep. Na modalidade `retroativo` é o
   * caixa de FECHAMENTO de `t−1` mais o fluxo livre de `t` — sem a liberação
   * do próprio mês, que só entra no caixa disponível do mês seguinte.
   */
  caixaDisponivelAmortizacaoPorInstrumento: Record<string, number[]>;
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
  // Denominador do gatilho de exposição mínima: o custo elegível do projeto
  // INTEIRO. Só é computável de antemão porque `custoElegivelMensal` chega com
  // o horizonte todo (mesma premissa que o modo D do Preferred Equity já usa).
  const custoElegivelTotal = new Map(dividas.map((d) => [
    d.nome,
    d.custoElegivelTotal ?? (d.custoElegivelMensal ?? []).reduce((s, v) => s + n(v), 0),
  ]));
  // Teto efetivo de principal: o contratado, ou — quando não há teto
  // contratado (`0`, o caso da planilha) — o que a medição de custo autoriza.
  const limiteEfetivo = new Map(dividas.map((d) => [
    d.nome,
    d.limiteComprometido > 0
      ? d.limiteComprometido
      : (d.percentualFinanciavel ?? 1) * custoElegivelTotal.get(d.nome)!,
  ]));
  const chavesJaOcorreram = new Map(dividas.map((d) => [d.nome, false]));
  const retroativa = (d: InstrumentoDivida): boolean => d.modalidadeLiberacao === 'retroativo';
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
    custoElegivelPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    custoElegivelAcumuladoPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    percentualIncorridoPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    liberacaoHabilitadaPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    alvoAcumuladoPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    liberacaoAcumuladaPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
    caixaDisponivelAmortizacaoPorInstrumento: Object.fromEntries(dividas.map((d) => [d.nome, arr(N)])),
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
    //
    // `dividaAmortizavel` congela `saldo_abertura + juros_do_mês` AQUI, antes
    // de qualquer liberação: é o teto de amortização da modalidade
    // `retroativo` (a liberação do próprio mês não pode ser quitada no mês em
    // que entrou). Nas demais modalidades o teto continua sendo o saldo vivo.
    const dividaAmortizavel = new Map<string, number>();
    for (const d of dividas) {
      const abertura = saldoDivida.get(d.nome)!;
      const juros = round2(abertura * d.taxaMensal);
      saldoDivida.set(d.nome, round2(abertura + juros));
      r.jurosPorInstrumento[d.nome][t] = juros;
      dividaAmortizavel.set(d.nome, round2(abertura + juros));
    }

    // 2) fluxo livre do mês entra no caixa provisório
    let caixaProvisorio = caixaProjeto + n(cen.fluxoLivreMensal[t]);
    // Caixa que a modalidade `retroativo` oferece ao cash sweep: fechamento de
    // `t−1` + fluxo livre de `t`, congelado ANTES de qualquer liberação/aporte
    // do mês. É a coluna `Caixa disponível Fin Prod` da planilha, e a razão de
    // ela existir: sem esse congelamento a liberação do mês pagaria a si
    // mesma, gastando o mesmo real duas vezes.
    const caixaAntesFunding = caixaProvisorio;

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

    // 3.5) liberação CONTRATUAL da modalidade `retroativo` (§4.3) — acontece
    // ANTES da medição de necessidade porque não depende dela: o banco libera
    // o que a medição de custo autoriza, tenha o projeto caixa ou não.
    //
    // A primeira liberação é naturalmente um catch-up: `alvo` é calculado
    // sobre o custo elegível ACUMULADO desde o mês 1, então no mês em que o
    // gatilho abre o banco reconhece de uma vez todo o custo já incorrido —
    // não só o do mês. Isso não é código especial, é a fórmula funcionando.
    for (const d of dividas) {
      if (!retroativa(d)) continue;
      if (d.mesChaves != null && t >= d.mesChaves) chavesJaOcorreram.set(d.nome, true);

      const acum = round2(custoElegivelAcumulado.get(d.nome)! + n(d.custoElegivelMensal?.[t]));
      custoElegivelAcumulado.set(d.nome, acum);
      const total = custoElegivelTotal.get(d.nome)!;
      // Custo elegível total zero ⇒ exposição zero e nenhuma liberação: sem
      // base de medição não há o que o banco financiar (§42).
      const pctIncorrido = total > 0 ? acum / total : 0;
      const dentroDaJanela = d.janelaLiberacao ? Boolean(d.janelaLiberacao[t]) : true;
      const habilitada = pctIncorrido >= (d.exposicaoMinima ?? 0) && dentroDaJanela;
      const alvo = round2(Math.min(limiteEfetivo.get(d.nome)!, (d.percentualFinanciavel ?? 1) * acum));

      r.custoElegivelPorInstrumento[d.nome][t] = round2(n(d.custoElegivelMensal?.[t]));
      r.custoElegivelAcumuladoPorInstrumento[d.nome][t] = acum;
      r.percentualIncorridoPorInstrumento[d.nome][t] = pctIncorrido;
      r.liberacaoHabilitadaPorInstrumento[d.nome][t] = habilitada ? 1 : 0;
      r.alvoAcumuladoPorInstrumento[d.nome][t] = alvo;

      // `max(0, …)` é defensivo (§42): a diferença só ficaria negativa se o
      // custo elegível encolhesse entre meses, o que o fluxo não produz.
      const liberar = habilitada ? round2(Math.max(0, alvo - liberadoAcumulado.get(d.nome)!)) : 0;
      if (liberar > 0) {
        saldoDivida.set(d.nome, round2(saldoDivida.get(d.nome)! + liberar));
        liberadoAcumulado.set(d.nome, round2(liberadoAcumulado.get(d.nome)! + liberar));
        caixaProvisorio += liberar;
        r.liberacaoPorInstrumento[d.nome][t] = round2((r.liberacaoPorInstrumento[d.nome][t] ?? 0) + liberar);
      }
      r.liberacaoAcumuladaPorInstrumento[d.nome][t] = liberadoAcumulado.get(d.nome)!;
      r.caixaDisponivelAmortizacaoPorInstrumento[d.nome][t] = round2(caixaAntesFunding);
    }

    // 4) necessidade de funding (§3.1) e liberações AUTOMÁTICAS por prioridade (§5)
    let necessidade = Math.max(0, cen.reservaMinima - caixaProvisorio);
    for (const d of dividas) {
      // Dívida `retroativo` já desembolsou no passo 3.5 e não responde a
      // necessidade de caixa — deixá-la aqui desembolsaria duas vezes.
      if (retroativa(d)) continue;
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
    //
    // Duas piscinas de caixa, uma fila só: a modalidade `retroativo` saca do
    // caixa CONGELADO antes das liberações do mês (`caixaAntesFunding`), as
    // demais do caixa corrente. Todo pagamento abate as DUAS — é o mesmo
    // dinheiro, e nenhuma piscina pode gastá-lo de novo. Sem nenhum
    // instrumento `retroativo` no cenário a piscina defasada nunca é tocada e
    // o comportamento é idêntico ao anterior.
    let disponivelAmort = Math.max(0, caixaProjeto - cen.reservaMinima);
    let disponivelAmortDefasado = Math.max(0, caixaAntesFunding - cen.reservaMinima);
    for (const d of dividasPorPagamento) {
      const usaDefasado = retroativa(d);
      const disponivel = usaDefasado ? disponivelAmortDefasado : disponivelAmort;
      if (disponivel <= 0) continue;
      const saldo = saldoDivida.get(d.nome)!;
      if (saldo <= 0) continue;
      let pag = 0;
      if (usaDefasado) {
        // A modalidade implica cash sweep — não há prestação contratual aqui
        // (§43): a dívida é liquidada conforme o caixa do projeto. O teto é
        // `dividaAmortizavel` (saldo de abertura + juros do mês), NÃO o saldo
        // vivo, que já embute a liberação deste mês.
        const permitida = (d.amortizarComCaixaDisponivel ?? true) || chavesJaOcorreram.get(d.nome)!;
        if (permitida) pag = round2(Math.max(0, Math.min(dividaAmortizavel.get(d.nome)!, disponivel)));
      } else if (d.politicaAmortizacao === 'cash_sweep') {
        pag = round2(Math.min(disponivel, saldo));
      } else if (d.politicaAmortizacao === 'bullet') {
        if (d.vencimentoMes === t) pag = round2(Math.min(disponivel, saldo));
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
            pag = round2(Math.min(disponivel, juros));
          } else if (t === primeiraLib + carencia + 1) {
            // 1º mês fora da carência: calcula a parcela fixa UMA VEZ, sobre
            // o total LIBERADO (não `saldo`, que aqui já embute o juros deste
            // mês) — equivale ao principal original quando a carência só
            // pagou juros (o caso comum), e generaliza corretamente se houve
            // liberação adicional durante a carência.
            const nAmort = Math.max(1, (d.prazoMeses ?? 0) - carencia);
            const parcela = round2(pmtPrice(d.taxaMensal, nAmort, liberadoAcumulado.get(d.nome)!));
            parcelaPrice.set(d.nome, parcela);
            pag = round2(Math.min(disponivel, Math.min(parcela, saldo)));
          } else {
            const parcela = parcelaPrice.get(d.nome) ?? 0;
            pag = round2(Math.min(disponivel, Math.min(parcela, saldo)));
          }
        }
      }
      if (pag <= 0) continue;
      saldoDivida.set(d.nome, round2(saldo - pag));
      caixaProjeto = round2(caixaProjeto - pag);
      disponivelAmort = round2(Math.max(0, disponivelAmort - pag));
      disponivelAmortDefasado = round2(Math.max(0, disponivelAmortDefasado - pag));
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

/** Uma linha de funding já projetada na tabela principal do fluxo — 0-based, do tamanho do prazo. */
export interface LinhaFunding {
  nome: string;
  mensal: number[];
  total: number;
  vpl: number;
}

/**
 * O funding lido DENTRO das categorias da tabela principal (#349) — entradas
 * como bloco de receita, saídas dentro de "Custos Financeiros" (uma das 5
 * categorias de custo que já existiam). Todas as séries são 0-based e do
 * tamanho de `fluxoLivreMensal`, prontas para a tabela; as do motor são
 * 1-based e são convertidas aqui, num lugar só.
 */
/**
 * Como a célula é lida e como a linha se agrega na visão Anual. Nem toda
 * linha do detalhamento é dinheiro que soma: `% incorrido` e `saldo devedor`
 * são ESTOQUES (o valor do último mês da faixa é o correto; somar doze
 * saldos devedores não significa nada) e `liberação habilitada` é um sinal.
 */
export type FormatoLinhaFinanciamento = 'moeda' | 'percentual' | 'sinal';

export interface LinhaFinanciamentoProducao {
  nome: string;
  mensal: number[];
  formato: FormatoLinhaFinanciamento;
  agregacao: 'soma' | 'ultimo';
  /** `false` nas linhas em que a coluna "Total" não teria significado. */
  mostrarTotal: boolean;
}

/** Detalhamento mensal de UMA camada de financiamento à produção (§38). */
export interface BlocoFinanciamentoProducao {
  nome: string;
  linhas: LinhaFinanciamentoProducao[];
}

export interface FundingNoFluxo {
  entradas: number[];
  saidas: number[];
  linhasEntrada: LinhaFunding[];
  linhasSaida: LinhaFunding[];
  /**
   * §38 — bloco de auditoria por camada de financiamento à produção. É
   * DISPLAY-ONLY: as liberações, juros e amortizações destas linhas já entram
   * no fluxo pelas linhas de funding acima, e repeti-las em `entradas`/
   * `saidas` seria contagem dupla. Vazio quando não há camada com liberação.
   */
  financiamentoProducao: BlocoFinanciamentoProducao[];
  /** Fluxo ALAVANCADO: livre + entradas − saídas. É o que a tabela mostra no rodapé. */
  fluxoMensal: number[];
  fluxoAcumulado: number[];
  /**
   * VPL do funding isolado (Σ VPL das entradas − Σ VPL das saídas). Somado ao
   * VPL desalavancado do motor dá o VPL do fluxo alavancado — sem isso a
   * coluna VPL do rodapé mostraria o número desalavancado ao lado de um fluxo
   * alavancado, que é o tipo de inconsistência silenciosa que esta tabela
   * existe para não ter.
   */
  vplLiquido: number;
}

/**
 * #349: projeta o resultado do Capital Stack nas categorias da tabela
 * principal, no lugar da tabela separada "Programa Financeiro (Capital
 * Stack)" que o autor pediu para apagar.
 *
 * Esta é a **fonte única** dessa composição. Antes da #349 as mesmas ~15
 * linhas eram montadas DUAS vezes — `tabelaCapitalStack` (fluxo-tabela.ts) e
 * `linhasCapitalStack` (exportar.ts) —, cada uma com sua própria cópia de
 * `a0`/`somaPorNomes`/`nomesPorTipo`. Duas cópias da mesma árvore é
 * exatamente o caminho pelo qual tela e CSV divergem sem ninguém perceber;
 * as duas foram removidas em favor desta.
 *
 * ⚠️ **KPIs continuam DESALAVANCADOS.** `fluxoMensal` aqui é o fluxo depois
 * do funding, mas TIR/VPL/Payback/Exposição seguem lendo `calcularFluxo`
 * (livre) — decisão de spec, não omissão: `docs/viabilidade/funding-capital-
 * stack.md` §8.1, "A TIR e o VPL do projeto permanecem desalavancados, para
 * manter comparabilidade entre estruturas de capital". Por isso a tabela
 * mostra as duas linhas ("Fluxo de Caixa Livre" e "Fluxo de Caixa Mensal")
 * quando há funding: o número que alimenta os KPIs continua visível e
 * reconciliável na própria tabela.
 *
 * Devolve `null` sem resultado ou sem camadas — nesse caso a tabela não ganha
 * nenhuma linha nova e o rodapé segue sendo o fluxo do motor, idêntico ao de
 * antes desta issue (blast radius zero em estudo sem Capital Stack).
 */
export function fundingNoFluxo(
  resultado: ResultadoCapitalStack | null,
  camadas: { nome: string; tipo: string }[],
  fluxoLivreMensal: number[],
  taxaDescontoAa: number,
): FundingNoFluxo | null {
  if (!resultado || camadas.length === 0) return null;
  const r = resultado;
  const prazo = fluxoLivreMensal.length;
  // Séries do motor são 1-based (índice 0 ignorado); a tabela principal é 0-based.
  const a0 = (serie: number[]): number[] => {
    const out = new Array<number>(prazo).fill(0);
    for (let i = 0; i < prazo; i++) out[i] = serie[i + 1] ?? 0;
    return out;
  };
  const nomesPorTipo = (tipo: string) => camadas.filter((c) => c.tipo === tipo).map((c) => c.nome);
  const somaPorNomes = (nomes: string[], rec: Record<string, number[]>): number[] => {
    const out = new Array<number>(prazo).fill(0);
    for (const nome of nomes) {
      const s = rec[nome];
      if (!s) continue;
      for (let i = 0; i < prazo; i++) out[i] += s[i + 1] ?? 0;
    }
    return out;
  };
  const linha = (nome: string, mensal: number[]): LinhaFunding => ({
    nome, mensal,
    total: mensal.reduce((s, v) => s + v, 0),
    vpl: vplFluxo(mensal, taxaDescontoAa),
  });

  const nomesDivida = [...nomesPorTipo('financiamento_producao'), ...nomesPorTipo('capital_giro')];
  const nomesPE = nomesPorTipo('preferred_equity');

  const linhasEntrada = [
    linha('Financiamento à produção — liberações', somaPorNomes(nomesPorTipo('financiamento_producao'), r.liberacaoPorInstrumento)),
    linha('Capital de giro — liberações', somaPorNomes(nomesPorTipo('capital_giro'), r.liberacaoPorInstrumento)),
    linha('Equity preferencial — aportes', somaPorNomes(nomesPE, r.aportePorInstrumentoPE)),
    linha('Sponsor Equity — aportes', a0(r.aporteSponsorMensal)),
  ];
  // Participações sobre receita/residual/lucro andam juntas numa linha só, como
  // na tabela removida — são a mesma natureza econômica (participação do
  // investidor), e `fundingEntradasSaidasMensal` soma as três em `saidas`.
  const partReceita = somaPorNomes(nomesPE, r.participacaoReceitaPE);
  const partResidual = somaPorNomes(nomesPE, r.participacaoResidualPE);
  const partLucro = somaPorNomes(nomesPE, r.participacaoLucroPE);
  const participacoes = partReceita.map((v, i) => v + partResidual[i] + partLucro[i]);
  const linhasSaida = [
    linha('Funding · Juros e taxas de dívida', somaPorNomes(nomesDivida, r.jurosPorInstrumento)),
    linha('Funding · Amortização de principal', somaPorNomes(nomesDivida, r.amortizacaoPorInstrumento)),
    linha('Funding · Devolução de Preferred Equity', somaPorNomes(nomesPE, r.devolucaoPrincipalPE)),
    linha('Funding · Retorno preferencial', somaPorNomes(nomesPE, r.remuneracaoPagaPE)),
    linha('Funding · Participações sobre receita/residual', participacoes),
    linha('Funding · Distribuições ao sponsor', a0(r.distribuicaoSponsorMensal)),
  ];

  // `fundingEntradasSaidasMensal` continua sendo a fonte dos AGREGADOS — as
  // linhas acima são a abertura dele. Somar as linhas por conta própria criaria
  // uma segunda definição de "entradas"/"saídas" que poderia divergir da do §10.
  const { entradas, saidas } = fundingEntradasSaidasMensal(r);
  const entradas0 = a0(entradas);
  const saidas0 = a0(saidas);
  const fluxoMensal = fluxoLivreMensal.map((v, i) => round2(v + entradas0[i] - saidas0[i]));
  const fluxoAcumulado: number[] = [];
  let acc = 0;
  for (const v of fluxoMensal) { acc = round2(acc + v); fluxoAcumulado.push(acc); }

  const vplLiquido = linhasEntrada.reduce((s, l) => s + l.vpl, 0) - linhasSaida.reduce((s, l) => s + l.vpl, 0);

  // §38: detalhamento por camada de financiamento à produção. Só entra quem
  // efetivamente liberou — uma camada cujo gatilho de exposição nunca abriu
  // renderizaria oito linhas de zero, sem informação nenhuma.
  const financiamentoProducao: BlocoFinanciamentoProducao[] = [];
  for (const camada of camadas.filter((c) => c.tipo === 'financiamento_producao')) {
    const lib = r.liberacaoPorInstrumento[camada.nome];
    if (!lib || lib.every((v) => v === 0)) continue;
    financiamentoProducao.push({
      nome: camada.nome,
      linhas: [
        { nome: 'Despesas financiáveis', mensal: a0(r.custoElegivelPorInstrumento[camada.nome] ?? []), formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: '% custos financiáveis incorridos', mensal: a0(r.percentualIncorridoPorInstrumento[camada.nome] ?? []), formato: 'percentual', agregacao: 'ultimo', mostrarTotal: false },
        { nome: 'Liberação habilitada', mensal: a0(r.liberacaoHabilitadaPorInstrumento[camada.nome] ?? []), formato: 'sinal', agregacao: 'ultimo', mostrarTotal: false },
        { nome: 'Liberação do financiamento', mensal: a0(lib), formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: 'Juros do financiamento', mensal: a0(r.jurosPorInstrumento[camada.nome] ?? []), formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: 'Caixa disponível para amortização', mensal: a0(r.caixaDisponivelAmortizacaoPorInstrumento[camada.nome] ?? []), formato: 'moeda', agregacao: 'ultimo', mostrarTotal: false },
        { nome: 'Amortização', mensal: a0(r.amortizacaoPorInstrumento[camada.nome] ?? []), formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: 'Saldo devedor', mensal: a0(r.saldoDividaPorInstrumento[camada.nome] ?? []), formato: 'moeda', agregacao: 'ultimo', mostrarTotal: false },
      ],
    });
  }

  return {
    entradas: entradas0, saidas: saidas0, linhasEntrada, linhasSaida,
    financiamentoProducao, fluxoMensal, fluxoAcumulado, vplLiquido,
  };
}

/**
 * Reagrupa as séries de funding nas mesmas faixas da view Anual (#127) — sem
 * isso o funding sumiria da tabela ao trocar para Anual, que é o que a tabela
 * separada fazia (só renderizava na view Mensal). Soma dentro de cada faixa;
 * o acumulado pega o ÚLTIMO ponto da faixa, mesma convenção de
 * `agregarFluxoPorPeriodos`.
 */
export function agregarFundingPorPeriodos(
  f: FundingNoFluxo,
  periodos: { inicio: number; fim: number }[],
): FundingNoFluxo {
  const soma = (serie: number[]): number[] => periodos.map((p) => {
    let acc = 0;
    for (let i = p.inicio; i <= p.fim; i++) acc += serie[i] ?? 0;
    return acc;
  });
  const ultimo = (serie: number[]): number[] => periodos.map((p) => serie[p.fim] ?? 0);
  // `vpl` (da linha e o líquido) NÃO é reagregado: é escalar, calculado sobre a
  // série MENSAL, e desconto sobre balde anual daria outro número.
  const agregarLinha = (l: LinhaFunding): LinhaFunding => ({ ...l, mensal: soma(l.mensal) });
  return {
    entradas: soma(f.entradas),
    saidas: soma(f.saidas),
    linhasEntrada: f.linhasEntrada.map(agregarLinha),
    linhasSaida: f.linhasSaida.map(agregarLinha),
    // Cada linha do detalhamento declara a sua agregação: fluxos somam dentro
    // da faixa, estoques (saldo devedor, % incorrido) pegam o último ponto —
    // mesma convenção de `fluxoAcumulado`.
    financiamentoProducao: f.financiamentoProducao.map((b) => ({
      ...b,
      linhas: b.linhas.map((l) => ({ ...l, mensal: l.agregacao === 'soma' ? soma(l.mensal) : ultimo(l.mensal) })),
    })),
    fluxoMensal: soma(f.fluxoMensal),
    fluxoAcumulado: ultimo(f.fluxoAcumulado),
    vplLiquido: f.vplLiquido,
  };
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
 * IDs das linhas de custo que compõem a base financiável PADRÃO (§5/§6 do
 * pedido, `eFinanciavelPadrao` em `fluxo-shared.ts`). Usada em dois lugares:
 * como seleção inicial no editor da camada e como fallback quando
 * `config.custoLinhaIds` nunca foi definido — camadas criadas pela migração
 * `019` são exatamente esse caso, e sem o fallback ficariam sem base de
 * medição e portanto sem nenhuma liberação.
 *
 * Uma seleção EXPLICITAMENTE vazia (`[]`) não é sobrescrita: quem
 * desmarcou tudo quis desmarcar tudo.
 */
export function linhasFinanciaveisPadrao(custosRaw: any[]): number[] {
  return (custosRaw ?? []).filter(eFinanciavelPadrao).map((c) => Number(c.id));
}

/**
 * Janela 1-based em que o contrato admite liberação: os meses de obra mais o
 * mês da entrega. Cronograma é 0-based, o motor é 1-based — daí o `+1`.
 */
export function janelaLiberacaoDeMarcos(
  marcos: { inicioObra: number; fimObra: number; mesEntrega: number },
  meses: number,
): boolean[] {
  const j = new Array<boolean>(meses + 1).fill(false);
  for (let t = 1; t <= meses; t++) {
    const mesRelativo = t - 1;
    j[t] = mesRelativo >= marcos.inicioObra && mesRelativo <= marcos.mesEntrega;
  }
  return j;
}

/**
 * Converte um registro de `avancado_capital_instrumentos` (coluna `config`
 * json, shape por `tipo` — ver docs/viabilidade/funding-capital-stack.md
 * §4) no `Instrumento` que `simularCapitalStack` consome. `null` para um
 * `tipo` desconhecido (defensivo — o schema já restringe as 4 opções).
 */
export function instrumentoDeRegistro(
  registro: any,
  custoElegivelMensal?: number[],
  marcos?: { janelaLiberacao?: boolean[]; mesChaves?: number },
): Instrumento | null {
  const cfg = registro?.config ?? {};
  if (registro?.tipo === 'financiamento_producao') {
    // Financiamento à produção é SEMPRE o modelo contratual da planilha:
    // liberação por medição com catch-up retroativo e cash sweep (§4.3). Não
    // há seletor de modalidade nem de política de amortização — §43 é
    // explícito em que este produto não tem prestação contratual (SAC/Price),
    // e o §4.3 é explícito em que a liberação segue a medição, não a
    // necessidade de caixa. Capital de giro (abaixo) é que tem essas escolhas.
    return {
      tipo: 'divida',
      nome: registro.nome,
      limiteComprometido: n(registro.compromisso),
      taxaMensal: taxaMensalEquivalente(n(cfg.taxaAnual)),
      politicaAmortizacao: 'cash_sweep',
      modalidadeLiberacao: 'retroativo',
      custoElegivelMensal,
      percentualFinanciavel: cfg.percentualFinanciavel !== undefined ? Number(cfg.percentualFinanciavel) : PADRAO_PERCENTUAL_FINANCIAVEL,
      exposicaoMinima: cfg.exposicaoMinima !== undefined ? Number(cfg.exposicaoMinima) : PADRAO_EXPOSICAO_MINIMA,
      amortizarComCaixaDisponivel: cfg.amortizarComCaixaDisponivel !== undefined
        ? Boolean(cfg.amortizarComCaixaDisponivel) : PADRAO_AMORTIZAR_COM_CAIXA,
      janelaLiberacao: marcos?.janelaLiberacao,
      mesChaves: marcos?.mesChaves,
      prioridadeFunding: n(registro.prioridade_funding),
      prioridadePagamento: n(registro.prioridade_pagamento),
    };
  }
  if (registro?.tipo === 'capital_giro') {
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
  contexto?: { custosRaw?: any[]; cronograma?: EventoCrono[] },
): ResultadoCapitalStack {
  const meses = Math.max(0, fluxoLivreMensal.length - 1);
  // Janela e mês das chaves vêm do Cronograma do estudo — não são premissas
  // digitadas na camada. Sem cronograma (chamadas de teste), o financiamento
  // roda sem restrição de janela e sem gate de chaves.
  const marcos = contexto?.cronograma ? marcosObra(contexto.cronograma) : null;
  const marcosDoInstrumento = marcos
    ? { janelaLiberacao: janelaLiberacaoDeMarcos(marcos, meses), mesChaves: marcos.mesEntrega + 1 }
    : undefined;
  const instrumentos: Instrumento[] = [];
  for (const registro of registros) {
    if (registro?.status !== 'ativo') continue;
    let custoElegivel: number[] | undefined;
    if (registro.tipo === 'financiamento_producao') {
      const ids: number[] | undefined = registro.config?.custoLinhaIds
        ?? (contexto?.custosRaw ? linhasFinanciaveisPadrao(contexto.custosRaw) : undefined);
      custoElegivel = custoElegivelMensalDeLinhas(linhasCusto, ids, meses);
    }
    const inst = instrumentoDeRegistro(registro, custoElegivel, marcosDoInstrumento);
    if (inst) instrumentos.push(inst);
  }
  return simularCapitalStack({ nome: 'estudo', meses, fluxoLivreMensal, receitaLiquidaMensal, reservaMinima, instrumentos });
}

export interface IndicadoresFinanciamentoProducao {
  custoFinanciavelTotal: number;
  percentualFinanciado: number;
  /** `percentualFinanciado × custoFinanciavelTotal` — o principal que a medição autoriza no limite. */
  principalMaximoPrevisto: number;
  /** 1-based; `null` quando o gatilho nunca abriu. */
  primeiroMesLiberacao: number | null;
  /** O catch-up inicial — costuma ser muito maior que as liberações seguintes. */
  primeiraLiberacao: number;
  totalLiberado: number;
  totalJuros: number;
  picoSaldoDevedor: number;
  mesPicoSaldoDevedor: number | null;
  primeiroMesAmortizacao: number | null;
  /** Último mês com saldo > 0 — o mês seguinte é o da quitação. `null` se nunca houve dívida. */
  ultimoMesComDivida: number | null;
  totalAmortizado: number;
}

/**
 * Indicadores de resumo de uma camada de financiamento à produção (§37 do
 * pedido). Função pura sobre o resultado da simulação — nenhuma regra nova,
 * só leitura das séries que o motor já produziu.
 *
 * `totalAmortizado` é a soma do cash sweep, que paga principal E juros
 * capitalizados juntos: com a dívida começando e terminando em zero, ele tem
 * de bater com `totalLiberado + totalJuros`. Essa igualdade é o teste de
 * consistência do §35.
 */
export function indicadoresFinanciamentoProducao(
  r: ResultadoCapitalStack,
  nome: string,
): IndicadoresFinanciamentoProducao | null {
  const liberacao = r.liberacaoPorInstrumento[nome];
  if (!liberacao) return null;
  const juros = r.jurosPorInstrumento[nome] ?? [];
  const amortizacao = r.amortizacaoPorInstrumento[nome] ?? [];
  const saldo = r.saldoDividaPorInstrumento[nome] ?? [];
  const acumulado = r.custoElegivelAcumuladoPorInstrumento[nome] ?? [];
  const alvo = r.alvoAcumuladoPorInstrumento[nome] ?? [];

  const soma = (s: number[]) => round2(s.reduce((acc, v) => acc + v, 0));
  const primeiroMes = (s: number[]) => {
    const i = s.findIndex((v, idx) => idx > 0 && v > 0);
    return i === -1 ? null : i;
  };
  const custoFinanciavelTotal = acumulado.length ? acumulado[acumulado.length - 1] : 0;
  const totalLiberado = soma(liberacao);
  // Lido do alvo em vez de recalculado: assim o indicador respeita o teto
  // contratual quando ele existe, sem duplicar a regra do `limiteEfetivo`.
  const principalMaximoPrevisto = alvo.length ? Math.max(...alvo) : 0;
  const percentualFinanciado = custoFinanciavelTotal > 0 ? principalMaximoPrevisto / custoFinanciavelTotal : 0;
  const pico = saldo.length ? Math.max(...saldo) : 0;
  const mesPico = pico > 0 ? saldo.indexOf(pico) : null;
  const ultimoComDivida = saldo.reduce((idx, v, i) => (i > 0 && v > 0 ? i : idx), -1);
  const primeiroLib = primeiroMes(liberacao);

  return {
    custoFinanciavelTotal,
    percentualFinanciado,
    principalMaximoPrevisto,
    primeiroMesLiberacao: primeiroLib,
    primeiraLiberacao: primeiroLib == null ? 0 : liberacao[primeiroLib],
    totalLiberado,
    totalJuros: soma(juros),
    picoSaldoDevedor: pico,
    mesPicoSaldoDevedor: mesPico,
    primeiroMesAmortizacao: primeiroMes(amortizacao),
    ultimoMesComDivida: ultimoComDivida === -1 ? null : ultimoComDivida,
    totalAmortizado: soma(amortizacao),
  };
}

/**
 * #277: reordenação da pilha de camadas — parte PURA, para ter teste.
 *
 * Move a camada `id` uma posição na direção dada e devolve a lista já com
 * `ordem` reescrita a partir do índice. A normalização é deliberada: camadas
 * criadas pela migração `019` nascem todas com a mesma `ordem`, e listas
 * legadas podem ter buracos — reescrever tudo pelo índice conserta as duas
 * situações sem precisar de migração.
 *
 * Não toca `prioridade_funding` nem `prioridade_pagamento`: são eixos
 * independentes (§5 e §6.1) e é por eles que o motor decide, não pela ordem de
 * exibição. Reordenar é organização visual da pilha.
 *
 * Movimento impossível (topo para cima, fim para baixo, id inexistente)
 * devolve a lista original, sem alteração — o chamador não precisa checar.
 */
export function reordenarCamadas<T extends { id: any }>(
  camadas: T[], id: any, direcao: -1 | 1,
): (T & { ordem: number })[] {
  const lista = [...camadas];
  const i = lista.findIndex((c) => c.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) {
    return camadas.map((c, k) => ({ ...c, ordem: k }));
  }
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista.map((c, k) => ({ ...c, ordem: k }));
}

/**
 * #277: devolve todas as camadas cuja ordem precisa ser persistida.
 *
 * Não basta salvar as duas camadas trocadas: ao normalizar dados legados com
 * ordens repetidas ou esparsas, outras posições também mudam. Persistir só a
 * vizinhança faz a ordenação voltar a ficar ambígua depois do reload.
 */
export function camadasComOrdemAlterada<T extends { id: any; ordem?: number }>(
  antes: T[], depois: (T & { ordem: number })[],
): (T & { ordem: number })[] {
  const ordemAnterior = new Map(antes.map((c) => [c.id, Number(c.ordem)]));
  return depois.filter((c) => ordemAnterior.get(c.id) !== c.ordem);
}

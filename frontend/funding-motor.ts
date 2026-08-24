import { eCorretagem, eFinanciavelPadrao, marcosObra, type EventoCrono } from './fluxo-shared.js';
import { vplFluxo } from './fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────────────
// Motor de Funding (#355, item 48 da Rodada 7).
//
// Substitui `capital-stack-motor.ts` (modelo de 4 instrumentos com waterfall
// de 8 passos). O modelo novo, especificado pela planilha do autor e
// transcrito em docs/viabilidade/fluxo-investidor-formulas.md, tem 3 tipos de
// operação INDEPENDENTES — sem waterfall, sem prioridades, sem competição por
// caixa:
//
//   · `financiamento_producao` — dívida, ÚNICA por estudo;
//   · `divida`                 — mesma matemática, quantas quiser;
//   · `equity`                 — aporte + retorno em dois modos.
//
// ── `financiamento_producao` NÃO usa a matemática de calendário ──
//
// A planilha `fluxo_investidor_FORMULAS` modela dívida por calendário: aporte
// num mês (ou distribuído em N), amortização Price após carência. Decisão do
// autor (2026-08-12): isso reverteria o modelo aprovado a partir da planilha
// `Incorp Individual` (#405) — gatilho de exposição mínima sobre custo
// incorrido, catch-up retroativo na 1ª liberação, cash sweep sem parcela
// fixa. As duas planilhas especificam produtos diferentes; o app precisa das
// duas. Por isso `financiamento_producao` tem sua PRÓPRIA função de
// simulação (`simularFinanciamentoProducao`), e é a ÚNICA operação cujo
// desembolso/amortização depende do fluxo de caixa do projeto — `divida` e
// `equity` seguem puramente a matemática da planilha nova, sem checar caixa.
//
// ── Convenções ──
//
// TEMPO: meses RELATIVOS 0-based, índice = mês, igual a `fluxo-caixa-motor.ts`
// e `fluxo-shared.ts`. A planilha conta a partir de 1; a conversão acontece na
// borda (o `inicio_mes` persistido já é 0-based, como nas linhas de Custo).
//
// SINAL: a planilha raciocina na VISÃO DO INVESTIDOR (desembolso negativo,
// recebimento positivo); a tabela de Resultados precisa da VISÃO DO PROJETO.
// Este módulo produz as duas e nomeia cada uma:
//   · `entradas`/`saidas`   — o que o PROJETO recebe / paga;
//   · `fluxoInvestidor`     — `saidas − entradas`, que é o fluxo de quem põe o
//                             dinheiro (e a base da TIR/VPL/Payback dele).
//
// PERCENTUAIS: as colunas guardam percentual (20 = 20% a.a.), não fração — as
// conversões ficam aqui, num lugar só.
// ─────────────────────────────────────────────────────────────────────────

const round2 = (v: number): number => Math.round(v * 100) / 100;
const n = (v: any): number => Number(v) || 0;

/**
 * §6.2: receita_liquida_base = receita_bruta_recebida − impostos − corretagem
 * − permuta_financeira. `receitaMensal` (de `calcularFluxo`) já é líquida de
 * RET e permuta financeira (#228) — falta só a corretagem, que é uma linha
 * de custo comum (fonte oficial única, #227/#228) já calculada dentro de
 * `linhasCusto` com seu próprio `.mensal`. Única fonte para não duplicar
 * `corretagemMensal` (fluxo-caixa-motor.ts) nem divergir entre telas.
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

/** Taxa mensal equivalente a uma taxa anual composta: (1+a)^(1/12) − 1 (planilha `divida!C15`). */
export function taxaMensalEquivalente(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/**
 * Parcela fixa do sistema Price/francês que amortiza `principal` em `nper`
 * meses a `taxaMensal` — magnitude POSITIVA. Equivalente ao `PMT` do Excel
 * com o sinal invertido (planilha `divida!C16`).
 */
export function pmtPrice(taxaMensal: number, nper: number, principal: number): number {
  if (nper <= 0) return principal;
  if (taxaMensal === 0) return principal / nper;
  const fator = Math.pow(1 + taxaMensal, nper);
  return principal * taxaMensal * fator / (fator - 1);
}

/**
 * TIR mensal de um fluxo de investidor — negativo nos meses de desembolso,
 * positivo nos de recebimento. Bisseção (robusta, sem risco de não-convergência
 * do Newton-Raphson). `null` quando não há troca de sinal — não existe TIR.
 */
export function tirMensal(fluxo: number[]): number | null {
  const temNegativo = fluxo.some((v) => v < 0);
  const temPositivo = fluxo.some((v) => v > 0);
  if (!temNegativo || !temPositivo) return null;

  const vpl = (taxa: number): number => fluxo.reduce((s, v, t) => s + v / Math.pow(1 + taxa, t), 0);

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

/** TIR anualizada — `(1 + TIR mensal)^12 − 1` (planilha `divida!C78`). */
export function tirAnual(fluxo: number[]): number | null {
  const m = tirMensal(fluxo);
  return m === null ? null : Math.pow(1 + m, 12) - 1;
}

/** Múltiplo sobre o capital investido. */
export function moic(aportes: number, distribuicoes: number): number {
  return aportes > 0 ? distribuicoes / aportes : 0;
}

// Defaults do Financiamento à produção — os valores da planilha de
// referência `Incorp Individual` (`Premissas e Resultados!D25:D28`).
export const PADRAO_EXPOSICAO_MINIMA = 20;
export const PADRAO_PERCENTUAL_FINANCIAVEL = 80;
export const PADRAO_AMORTIZAR_COM_CAIXA = true;

// ─────────────────────────────────────────────────────────────────────────
// Operações
// ─────────────────────────────────────────────────────────────────────────

export type TipoOperacao = 'financiamento_producao' | 'divida' | 'equity';
export type ModoRetorno = 'permuta_financeira' | 'resultado_final';

/** Uma linha de `avancado_funding_operacoes`, como o motor a lê. */
export interface OperacaoFunding {
  id?: number | string;
  tipo: TipoOperacao;
  nome: string;
  /** Genérico: aporte de dívida/equity. Em `financiamento_producao`, é o TETO de crédito — 0 = sem teto. */
  valor: number;
  /** Mês RELATIVO 0-based do aporte/1ª liberação (já resolvido da âncora pelo backend). Não usado por `financiamento_producao`. */
  inicio_mes: number;
  // ── dívida (`divida`) ──
  distribuir_aporte?: boolean;
  aporte_meses?: number;
  /** Percentual ao ano (20 = 20% a.a.). Usado por `divida` e `financiamento_producao`. */
  taxa_anual?: number;
  periodo_amortizacao_meses?: number;
  periodo_carencia_meses?: number;
  // ── equity ──
  modo_retorno?: ModoRetorno;
  /** Percentual (4 = 4%). */
  pct_retorno?: number;
  // ── financiamento_producao (§4.3 de funding-capital-stack.md, planilha `Incorp Individual`) ──
  /** Percentual (20 = 20%) do custo elegível TOTAL que precisa estar incorrido para o banco começar a liberar. */
  exposicao_minima?: number;
  /** Percentual (80 = 80%) do custo elegível acumulado que o banco financia. */
  percentual_financiavel?: number;
  /** `false` = nenhuma amortização antes das chaves, mesmo com caixa sobrando. Default `true`. */
  amortizar_com_caixa_disponivel?: boolean;
  /** IDs de `avancado_linhas_custo` elegíveis. `null`/ausente = base padrão (`linhasFinanciaveisPadrao`). */
  custo_linha_ids?: number[] | null;
}

/**
 * Formato de exibição de uma linha do detalhamento de Financiamento à
 * produção (§38) — nem toda linha é dinheiro: `% incorrido` é fração e
 * `liberação habilitada` é sinal.
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

/** Detalhamento mensal de UMA operação de financiamento à produção (§38). */
export interface BlocoFinanciamentoProducao {
  nome: string;
  linhas: LinhaFinanciamentoProducao[];
}

/** Séries de diagnóstico específicas de `financiamento_producao` — a auditoria do §38. */
export interface DiagnosticoFinanciamentoProducao {
  custoElegivel: number[];
  custoElegivelAcumulado: number[];
  /** Fração 0–1, precisão plena — arredonda só para exibir. */
  percentualIncorrido: number[];
  /** 0/1. */
  liberacaoHabilitada: number[];
  alvoAcumulado: number[];
  liberacaoAcumulada: number[];
  /** Caixa oferecido ao cash sweep no mês — fechamento de `t−1` + fluxo livre de `t`, sem a liberação do próprio mês. */
  caixaDisponivelAmortizacao: number[];
}

/** As séries mensais de UMA operação, 0-based e do comprimento do horizonte. */
export interface SerieOperacao {
  operacao: OperacaoFunding;
  /** Dívida: liberação do principal. Equity: aporte. O projeto RECEBE. */
  entradas: number[];
  /** Dívida: PMT pago (ou amortização, em `financiamento_producao`). Equity: retorno pago. O projeto PAGA. */
  saidas: number[];
  /** Visão do investidor: `saidas − entradas`. Base da TIR/VPL/Payback dele. */
  fluxoInvestidor: number[];
  /** Só dívida — vazios em equity. */
  juros: number[];
  saldo: number[];
  /** Só `financiamento_producao` — os campos que alimentam o §38 e o §37. */
  diagnostico?: DiagnosticoFinanciamentoProducao;
}

export function eDivida(tipo: TipoOperacao): boolean {
  return tipo === 'financiamento_producao' || tipo === 'divida';
}

const serieZerada = (prazo: number): number[] => new Array<number>(Math.max(0, prazo)).fill(0);

/**
 * Dívida (`divida`) — tradução direta das colunas B a G da aba `divida`.
 * NÃO se aplica a `financiamento_producao` — ver `simularFinanciamentoProducao`.
 *
 * As duas âncoras da planilha, em meses 0-based:
 *   `ini` = 1º mês de carência/amortização = `inicio_mes + nTranches`
 *   `fim` = último mês (quitação)          = `ini − 1 + amortização`
 *
 * ⚠️ Quando o aporte é distribuído, a base do PMT NÃO é `valor`: é o valor
 * futuro das tranches capitalizado até o fim da liberação
 * (`valor/n × ((1+i)^n − 1)/i`). Durante a liberação não há pagamento, mas os
 * juros já correm e capitalizam — usar `valor` cru subestimaria a parcela e
 * deixaria saldo residual no fim.
 */
export function simularDivida(op: OperacaoFunding, prazo: number): SerieOperacao {
  const entradas = serieZerada(prazo);
  const saidas = serieZerada(prazo);
  const juros = serieZerada(prazo);
  const saldo = serieZerada(prazo);

  const i = taxaMensalEquivalente(n(op.taxa_anual) / 100);
  const distribuir = op.distribuir_aporte === true;
  const nTranches = distribuir ? Math.max(1, Math.floor(n(op.aporte_meses)) || 1) : 1;
  const amort = Math.floor(n(op.periodo_amortizacao_meses));
  const carencia = Math.floor(n(op.periodo_carencia_meses));
  const valor = n(op.valor);

  const m0 = Math.max(0, Math.floor(n(op.inicio_mes)));
  const ini = m0 + nTranches;
  const fim = ini - 1 + amort;

  // Base do PMT: valor futuro das tranches liberadas (ver nota acima).
  const principalPmt = distribuir && i > 0
    ? (valor / nTranches) * (Math.pow(1 + i, nTranches) - 1) / i
    : valor;
  // Carência >= amortização não deixa prazo para amortizar — a rota barra
  // isso na entrada; aqui a parcela vira 0 em vez de dividir por zero.
  const parcela = amort <= carencia ? 0 : pmtPrice(i, amort - carencia, principalPmt);

  let saldoAnt = 0;
  for (let t = 0; t < prazo; t++) {
    const libera = distribuir
      ? (t >= m0 && t <= m0 + nTranches - 1 ? valor / nTranches : 0)
      : (t === m0 ? valor : 0);
    // Juros sobre o saldo de ABERTURA, só dentro da janela da operação.
    const jurosMes = t <= fim ? saldoAnt * i : 0;
    const devido = saldoAnt + libera + jurosMes;

    let pmt: number;
    if (t < ini || t > fim) pmt = 0;
    else if (t === fim) pmt = devido;                                   // quitação
    else if (t <= ini + carencia - 1) pmt = Math.min(jurosMes, devido); // carência: só juros
    else pmt = Math.min(parcela, devido);

    entradas[t] = round2(libera);
    saidas[t] = round2(pmt);
    juros[t] = round2(jurosMes);
    saldo[t] = Math.max(0, round2(devido - pmt));
    saldoAnt = saldo[t];
  }

  return {
    operacao: op,
    entradas,
    saidas,
    fluxoInvestidor: saidas.map((v, t) => round2(v - entradas[t])),
    juros,
    saldo,
  };
}

/**
 * Financiamento à produção (§4.3 de funding-capital-stack.md) — reprodução da
 * aba `Incorp Individual` da planilha de referência (colunas BW:CH),
 * decodificada e verificada no PR #405 (oráculo:
 * `frontend/financiamento-producao-golden.test.ts`, 80 períodos do cenário
 * real, tolerância R$ 0,15).
 *
 * Não usa calendário nem PMT: a liberação é dirigida pela medição do custo
 * elegível incorrido, com gatilho de exposição mínima e catch-up retroativo
 * na 1ª liberação; a amortização é cash sweep puro contra o caixa livre do
 * projeto, sem prestação contratual (§43 — este produto não tem parcela
 * fixa). É a ÚNICA operação de dívida cujo desembolso/amortização depende do
 * fluxo de caixa do projeto.
 *
 * `custoElegivelMensal`/`janelaLiberacao` já vêm resolvidos por quem chama
 * (`fundingDoEstudo`, a partir de `custo_linha_ids`/base padrão e do
 * Cronograma) — esta função é pura sobre séries já prontas.
 */
export function simularFinanciamentoProducao(
  op: OperacaoFunding,
  custoElegivelMensal: number[],
  janelaLiberacao: boolean[] | null,
  mesChaves: number | null,
  fluxoLivreMensal: number[],
  prazo: number,
): SerieOperacao {
  const entradas = serieZerada(prazo);
  const saidas = serieZerada(prazo);
  const juros = serieZerada(prazo);
  const saldo = serieZerada(prazo);
  const custoElegivel = serieZerada(prazo);
  const custoElegivelAcumulado = serieZerada(prazo);
  const percentualIncorrido = serieZerada(prazo);
  const liberacaoHabilitada = serieZerada(prazo);
  const alvoAcumulado = serieZerada(prazo);
  const liberacaoAcumulada = serieZerada(prazo);
  const caixaDisponivelAmortizacao = serieZerada(prazo);

  const i = taxaMensalEquivalente(n(op.taxa_anual) / 100);
  const exposicaoMinima = n(op.exposicao_minima ?? PADRAO_EXPOSICAO_MINIMA) / 100;
  const percentualFinanciavel = n(op.percentual_financiavel ?? PADRAO_PERCENTUAL_FINANCIAVEL) / 100;
  const amortizarComCaixaDisponivel = op.amortizar_com_caixa_disponivel === undefined
    ? PADRAO_AMORTIZAR_COM_CAIXA : op.amortizar_com_caixa_disponivel !== false;
  const limiteContratado = n(op.valor); // 0 = sem teto contratual
  const custoElegivelTotal = custoElegivelMensal.reduce((s, v) => s + n(v), 0);
  const limiteEfetivo = limiteContratado > 0 ? limiteContratado : percentualFinanciavel * custoElegivelTotal;

  let saldoAnt = 0;
  let custoAcum = 0;
  let liberadoAcum = 0;
  let caixaFechamentoAnt = 0;
  let chavesJaOcorreram = false;

  for (let t = 0; t < prazo; t++) {
    // 1) juros sobre saldo de ABERTURA — a liberação do mês NÃO gera juros no
    // próprio mês. `dividaAmortizavel` congela `saldo_abertura + juros_t`
    // AQUI, antes de qualquer liberação: é o teto de amortização do mês.
    const jurosMes = round2(saldoAnt * i);
    const dividaAmortizavel = round2(saldoAnt + jurosMes);

    // 2) caixa disponível: fechamento de t−1 + fluxo livre de t, congelado
    // ANTES da liberação do mês — senão ela pagaria a si mesma.
    const caixaAntesFunding = round2(caixaFechamentoAnt + n(fluxoLivreMensal[t]));

    if (mesChaves != null && t >= mesChaves) chavesJaOcorreram = true;

    // 3) liberação por medição — catch-up retroativo (§4.3 "Liberação mensal").
    custoAcum = round2(custoAcum + n(custoElegivelMensal[t]));
    const pctIncorrido = custoElegivelTotal > 0 ? custoAcum / custoElegivelTotal : 0;
    const dentroDaJanela = janelaLiberacao ? Boolean(janelaLiberacao[t]) : true;
    const habilitada = pctIncorrido >= exposicaoMinima && dentroDaJanela;
    const alvo = round2(Math.min(limiteEfetivo, percentualFinanciavel * custoAcum));
    // `max(0, …)` defensivo (§42): só ficaria negativo se o custo elegível
    // encolhesse entre meses, o que o fluxo não produz.
    const liberacao = habilitada ? round2(Math.max(0, alvo - liberadoAcum)) : 0;
    liberadoAcum = round2(liberadoAcum + liberacao);

    // 4) amortização — cash sweep puro contra o caixa congelado no passo 2.
    // O gatilho de liberação NÃO governa a amortização: depois da obra a
    // janela fecha e o cash sweep continua até zerar.
    const permitida = amortizarComCaixaDisponivel || chavesJaOcorreram;
    const amortizacao = permitida
      ? round2(Math.max(0, Math.min(dividaAmortizavel, Math.max(0, caixaAntesFunding))))
      : 0;

    const saldoFinal = Math.max(0, round2(dividaAmortizavel + liberacao - amortizacao));
    const caixaFechamento = round2(caixaAntesFunding + liberacao - amortizacao);

    entradas[t] = liberacao;
    saidas[t] = amortizacao;
    juros[t] = jurosMes;
    saldo[t] = saldoFinal;
    custoElegivel[t] = round2(n(custoElegivelMensal[t]));
    custoElegivelAcumulado[t] = custoAcum;
    percentualIncorrido[t] = pctIncorrido;
    liberacaoHabilitada[t] = habilitada ? 1 : 0;
    alvoAcumulado[t] = alvo;
    liberacaoAcumulada[t] = liberadoAcum;
    caixaDisponivelAmortizacao[t] = round2(caixaAntesFunding);

    saldoAnt = saldoFinal;
    caixaFechamentoAnt = caixaFechamento;
  }

  return {
    operacao: op,
    entradas,
    saidas,
    fluxoInvestidor: saidas.map((v, t) => round2(v - entradas[t])),
    juros,
    saldo,
    diagnostico: {
      custoElegivel, custoElegivelAcumulado, percentualIncorrido,
      liberacaoHabilitada, alvoAcumulado, liberacaoAcumulada, caixaDisponivelAmortizacao,
    },
  };
}

/**
 * Equity — colunas D a F da aba `equity`, nos dois modos:
 *
 *  · `permuta_financeira` — `pct` incide sobre a RECEITA LÍQUIDA mensal, mês a
 *    mês, progressivamente, com clamp em 0 e CARRY-FORWARD do déficit quando a
 *    receita líquida do mês é negativa (#432 — ver o bloco no laço);
 *  · `resultado_final`    — `pct` incide sobre o RESULTADO FINAL do projeto e
 *    é pago de uma vez, no mês do repasse.
 *
 * ⚠️ Diferente do modelo antigo, o pagamento NÃO é limitado pelo caixa do
 * projeto — é o que a planilha especifica. O risco de o caixa alavancado ficar
 * negativo é sinalizado pela Reconciliação (`validarFunding`), não bloqueado
 * aqui em silêncio.
 */
export function simularEquity(
  op: OperacaoFunding,
  receitaLiquidaMensal: number[],
  resultadoFinal: number,
  mesRepasseValor: number,
  prazo: number,
): SerieOperacao {
  const entradas = serieZerada(prazo);
  const saidas = serieZerada(prazo);
  const pct = n(op.pct_retorno) / 100;
  const m0 = Math.max(0, Math.floor(n(op.inicio_mes)));
  const progressivo = (op.modo_retorno ?? 'permuta_financeira') === 'permuta_financeira';

  // #432 — clamp em 0 com CARRY-FORWARD do déficit, no modo progressivo.
  //
  // A planilha não tem `MAX(0; …)` na coluna D porque o estado negativo é
  // ESTRUTURALMENTE IRREPRESENTÁVEL nela: `C = B × (1 − C15 − C16 − C17)` é uma
  // dedução MULTIPLICATIVA sobre frações não negativas do VGV. No app a dedução
  // é uma SÉRIE SUBTRAÍDA com cronograma próprio — a corretagem é paga
  // integralmente no mês da venda (`fluxo-shared.ts:502-509`, #121) enquanto o
  // recebimento é espalhado pelo plano —, e o estado existe: um lançamento cujo
  // sinal é menor que a corretagem produz receita líquida negativa, e a fórmula
  // crua fazia o INVESTIDOR pagar ao projeto a título de "retorno".
  //
  // Decisão do autor, 2026-08-22 (ver `docs/viabilidade/fluxo-investidor-formulas.md` §4.2):
  // o mês paga zero, o déficit fica registrado e abate os meses seguintes até se
  // extinguir. NÃO é o `Math.max(0, …)` seco que existia em `capital-stack-motor.ts`
  // antes da #355 — aquele não tinha memória e inflava o total pago.
  //
  // O acumulador é LOCAL — `simularEquity` é chamada uma vez por operação, em
  // `fundingDoEstudo` — e carrega PRECISÃO PLENA: só `saidas[t]` é arredondado
  // (contrato C7). Arredondar o déficit a cada mês acumularia erro ao longo de
  // 36+ meses.
  let deficit = 0;

  for (let t = 0; t < prazo; t++) {
    entradas[t] = t === m0 ? round2(n(op.valor)) : 0;
    if (progressivo) {
      const devido = n(receitaLiquidaMensal[t]) * pct - deficit;
      if (devido < 0) {
        // Nada a pagar: o que faltou vira (ou engorda) o déficit carregado.
        deficit = -devido;
        saidas[t] = 0;
      } else {
        deficit = 0;
        saidas[t] = round2(devido);
      }
    } else {
      saidas[t] = t === mesRepasseValor ? round2(resultadoFinal * pct) : 0;
    }
  }
  // Déficit que sobra ao fim do horizonte é EXTINTO — nunca vira pagamento
  // negativo. Nesse caso o total pago ao investidor é menor que `Σ base × pct`.

  return {
    operacao: op,
    entradas,
    saidas,
    fluxoInvestidor: saidas.map((v, t) => round2(v - entradas[t])),
    juros: serieZerada(prazo),
    saldo: serieZerada(prazo),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Indicadores do investidor
// ─────────────────────────────────────────────────────────────────────────

export interface IndicadoresOperacao {
  /** Total desembolsado pelo investidor, NEGATIVO (planilha: `−Σ aportes`). */
  investimentoTotal: number;
  retornoTotal: number;
  /** `retornoTotal + investimentoTotal` — o lucro nominal do investidor. */
  lucro: number;
  jurosPagos: number;
  saldoFinal: number;
  tirMensal: number | null;
  tirAnual: number | null;
  vpl: number;
  moic: number;
  /** 1º mês (0-based) em que o acumulado do investidor fica >= 0. `null` se nunca. */
  paybackMes: number | null;
}

/**
 * Indicadores de UMA operação, na visão do investidor.
 *
 * Duas divergências deliberadas em relação à planilha `fluxo_investidor_
 * FORMULAS`, registradas na #355:
 *  · **D9** — o VPL usa a `taxaDescontoAa` do estudo, convertida a mês por
 *    `vplFluxo`. A planilha aplica `NPV(0,1)` sobre a série MENSAL, ou seja
 *    10% ao mês (≈214% a.a.), o que produz VPL fortemente negativo numa
 *    operação que rende 20% a.a.
 *  · **D10** — o payback é o 1º mês com acumulado >= 0. A fórmula da planilha
 *    (`MATCH(...)+28−1`) soma o deslocamento da linha à resposta e devolve 59
 *    onde o caixa vira positivo no mês 32.
 */
export function indicadoresOperacao(s: SerieOperacao, taxaDescontoAa: number): IndicadoresOperacao {
  const investimentoTotal = -round2(s.entradas.reduce((a, b) => a + b, 0));
  const retornoTotal = round2(s.saidas.reduce((a, b) => a + b, 0));
  const jurosPagos = round2(s.juros.reduce((a, b) => a + b, 0));

  let acc = 0;
  let paybackMes: number | null = null;
  for (let t = 0; t < s.fluxoInvestidor.length; t++) {
    acc = round2(acc + s.fluxoInvestidor[t]);
    // Só conta como payback depois de ter havido desembolso — um fluxo que
    // começa em zero não "pagou de volta" nada no mês 0.
    if (paybackMes === null && acc >= 0 && investimentoTotal < 0) paybackMes = t;
  }

  return {
    investimentoTotal,
    retornoTotal,
    lucro: round2(retornoTotal + investimentoTotal),
    jurosPagos,
    saldoFinal: round2(s.saldo[s.saldo.length - 1] ?? 0),
    tirMensal: tirMensal(s.fluxoInvestidor),
    tirAnual: tirAnual(s.fluxoInvestidor),
    vpl: round2(vplFluxo(s.fluxoInvestidor, taxaDescontoAa)),
    moic: moic(-investimentoTotal, retornoTotal),
    paybackMes,
  };
}

export interface IndicadoresFinanciamentoProducao {
  custoFinanciavelTotal: number;
  percentualFinanciado: number;
  /** `percentualFinanciavel × custoFinanciavelTotal` (ou o teto contratual, se houver) — o principal que a medição autoriza no limite. */
  principalMaximoPrevisto: number;
  /** 0-based; `null` quando o gatilho nunca abriu. */
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
 * Indicadores de resumo do Financiamento à produção (§37 do pedido original
 * do #405) — função pura sobre a `SerieOperacao` que
 * `simularFinanciamentoProducao` produziu. Devolve `null` se a série não tem
 * diagnóstico (não é uma operação `financiamento_producao`).
 */
export function indicadoresFinanciamentoProducao(s: SerieOperacao): IndicadoresFinanciamentoProducao | null {
  const d = s.diagnostico;
  if (!d) return null;

  const soma = (xs: number[]) => round2(xs.reduce((acc, v) => acc + v, 0));
  const primeiroMes = (xs: number[]) => {
    const i = xs.findIndex((v) => v > 0);
    return i === -1 ? null : i;
  };
  const custoFinanciavelTotal = d.custoElegivelAcumulado.length
    ? d.custoElegivelAcumulado[d.custoElegivelAcumulado.length - 1] : 0;
  const totalLiberado = soma(s.entradas);
  const principalMaximoPrevisto = d.alvoAcumulado.length ? Math.max(...d.alvoAcumulado) : 0;
  const percentualFinanciado = custoFinanciavelTotal > 0 ? principalMaximoPrevisto / custoFinanciavelTotal : 0;
  const pico = s.saldo.length ? Math.max(...s.saldo) : 0;
  const mesPico = pico > 0 ? s.saldo.indexOf(pico) : null;
  const ultimoComDivida = s.saldo.reduce((idx, v, i) => (v > 0 ? i : idx), -1);
  const primeiroLib = primeiroMes(s.entradas);

  return {
    custoFinanciavelTotal,
    percentualFinanciado,
    principalMaximoPrevisto,
    primeiroMesLiberacao: primeiroLib,
    primeiraLiberacao: primeiroLib == null ? 0 : s.entradas[primeiroLib],
    totalLiberado,
    totalJuros: soma(s.juros),
    picoSaldoDevedor: pico,
    mesPicoSaldoDevedor: mesPico,
    primeiroMesAmortizacao: primeiroMes(s.saidas),
    ultimoMesComDivida: ultimoComDivida === -1 ? null : ultimoComDivida,
    totalAmortizado: soma(s.saidas),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Base financiável padrão e janela de liberação de Financiamento à produção
// ─────────────────────────────────────────────────────────────────────────

/**
 * Soma, mês a mês, as linhas de custo ELEGÍVEIS de um financiamento à
 * produção (§4.3 "seleção das linhas de custo elegíveis") — `linhasCusto`
 * já vem calculado (`LinhaCalc[]` de `calcularFluxo`, cada uma com sua
 * própria série `mensal`); `custoLinhaIds` é a seleção guardada em
 * `custo_linha_ids` da operação.
 */
export function custoElegivelMensalDeLinhas(
  linhasCusto: { id: any; mensal: number[] }[],
  custoLinhaIds: number[] | undefined | null,
  prazo: number,
): number[] {
  const out = new Array<number>(prazo).fill(0);
  if (!custoLinhaIds?.length) return out;
  const ids = new Set(custoLinhaIds.map(Number));
  for (const l of linhasCusto) {
    if (!ids.has(Number(l.id))) continue;
    for (let t = 0; t < prazo; t++) out[t] = round2(out[t] + (l.mensal[t] ?? 0));
  }
  return out;
}

/**
 * IDs das linhas de custo que compõem a base financiável PADRÃO (§5/§6 da
 * spec original do #405, `eFinanciavelPadrao` em `fluxo-shared.ts`). Usada
 * como seleção inicial no editor e como fallback quando `custo_linha_ids`
 * nunca foi definido — sem o fallback a operação fica sem base de medição e
 * portanto sem nenhuma liberação.
 *
 * Uma seleção EXPLICITAMENTE vazia (`[]`) não é sobrescrita: quem desmarcou
 * tudo quis desmarcar tudo.
 */
export function linhasFinanciaveisPadrao(custosRaw: any[]): number[] {
  return (custosRaw ?? []).filter(eFinanciavelPadrao).map((c) => Number(c.id));
}

/** Janela 0-based em que o contrato admite liberação: os meses de obra mais o mês da entrega. */
export function janelaLiberacaoDeMarcos(
  marcos: { inicioObra: number; fimObra: number; mesEntrega: number },
  prazo: number,
): boolean[] {
  const j = new Array<boolean>(prazo).fill(false);
  for (let t = 0; t < prazo; t++) j[t] = t >= marcos.inicioObra && t <= marcos.mesEntrega;
  return j;
}

// ─────────────────────────────────────────────────────────────────────────
// A costura com a tabela de Resultados (#349) — NÃO mudar o shape
// ─────────────────────────────────────────────────────────────────────────

export interface LinhaFunding {
  nome: string;
  mensal: number[];
  total: number;
  vpl: number;
}

/**
 * O funding lido DENTRO das categorias da tabela principal (#349) — entradas
 * como bloco de receita, saídas dentro de "Custos Financeiros". Todas as
 * séries são 0-based e do comprimento do fluxo livre.
 *
 * ⚠️ Este shape é consumido por `fluxo-tabela.ts`, `exportar.ts`,
 * `tela-fluxo-ver.ts` e `tela-cenarios.ts`. Ele sobreviveu à reescrita do #355
 * de propósito: é a fronteira que manteve a entrega da Fase 9 de pé enquanto
 * todo o motor por trás era trocado.
 *
 * ⚠️ `proforma-avancado.ts` SAIU desta lista com a #426: a proforma do
 * Avançado é desalavancada e a função nem recebe mais funding.
 *
 * As KPIs do projeto continuam DESALAVANCADAS (§8.1 de
 * funding-capital-stack.md) — TIR/VPL/Payback/Exposição seguem lendo
 * `calcularFluxo`. Só o rodapé da tabela alavanca, e `vplLiquido` existe para
 * que a coluna VPL desse rodapé não fique mostrando o número desalavancado ao
 * lado de um fluxo alavancado.
 */
export interface FundingNoFluxo {
  entradas: number[];
  saidas: number[];
  linhasEntrada: LinhaFunding[];
  linhasSaida: LinhaFunding[];
  /**
   * §38 — bloco de auditoria por operação de Financiamento à produção.
   * DISPLAY-ONLY: as liberações e amortizações destas linhas já entram no
   * fluxo pelas linhas de funding acima; repeti-las em `entradas`/`saidas`
   * seria contagem dupla. Vazio quando não há operação com liberação.
   */
  financiamentoProducao: BlocoFinanciamentoProducao[];
  /** Fluxo ALAVANCADO: livre + entradas − saídas. */
  fluxoMensal: number[];
  fluxoAcumulado: number[];
  /** Σ VPL das entradas − Σ VPL das saídas. */
  vplLiquido: number;
}

/** Resultado completo: as séries por operação (tela e invariantes) + a costura. */
export interface FundingCalc {
  operacoes: SerieOperacao[];
  noFluxo: FundingNoFluxo;
}

const TIPO_LABEL: Record<TipoOperacao, string> = {
  financiamento_producao: 'Financiamento à produção',
  divida: 'Dívida',
  equity: 'Equity',
};

/**
 * Contexto de estudo necessário só para `financiamento_producao` — a janela
 * de liberação e o mês das chaves vêm do Cronograma, não são digitados na
 * operação; a base financiável padrão vem das linhas de custo cruas.
 */
export interface ContextoFinanciamentoProducao {
  linhasCusto?: { id: any; mensal: number[] }[];
  custosRaw?: any[];
  cronograma?: EventoCrono[];
}

/**
 * Simula todas as operações do estudo e monta a costura com a tabela.
 *
 * `receitaLiquidaMensal` alimenta o Equity em modo permuta financeira;
 * `resultadoFinal` e `mesRepasseValor`, o modo resultado final. Nenhum dos
 * três é digitado pelo usuário (**D8**): vêm do próprio estudo, para que a
 * aba de Funding e a de Resultados nunca contem histórias diferentes.
 *
 * `contexto` é opcional e só importa quando há operação `financiamento_
 * producao` — sem ele (ou sem `cronograma`), a operação roda sem restrição de
 * janela e sem gate de chaves, e sem `custosRaw`/`linhasCusto` fica sem base
 * de medição (nenhuma liberação, degradação segura).
 */
export function fundingDoEstudo(
  operacoes: OperacaoFunding[],
  fluxoLivreMensal: number[],
  receitaLiquidaMensal: number[],
  resultadoFinal: number,
  mesRepasseValor: number,
  taxaDescontoAa: number,
  contexto?: ContextoFinanciamentoProducao,
): FundingCalc | null {
  if (!operacoes || operacoes.length === 0) return null;
  const prazo = fluxoLivreMensal.length;

  const marcos = contexto?.cronograma ? marcosObra(contexto.cronograma) : null;
  const janela = marcos ? janelaLiberacaoDeMarcos(marcos, prazo) : null;
  const mesChaves = marcos ? marcos.mesEntrega + 1 : null;

  // #434 — DUAS PASSADAS, porque o cash sweep tem de enxergar o caixa que as
  // outras operações deixaram. Passos 23–24 de
  // `docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`: processa-se
  // o capital de giro e os demais instrumentos e só então se forma o
  // "fluxo final = fluxo de caixa livre + fluxos líquidos dos instrumentos de
  // funding" — no plural, e NUMA ORDEM.
  //
  // ⚠️ NÃO É WATERFALL: não há prioridade nem competição por caixa. O
  // waterfall foi apagado de propósito pela #355 e não volta. O que existe
  // aqui é só a ORDEM DE LEITURA do caixa, em duas classes:
  //
  //   1. CEGAS ao caixa — `divida` e `equity`. Não recebem `fluxoLivreMensal`
  //      e não o consultam, então a ordem ENTRE ELAS é irrelevante: não
  //      interagem.
  //   2. DIRIGIDA por caixa — `financiamento_producao`, a única cujo
  //      desembolso/amortização depende do fluxo do projeto. Lê
  //      `fluxoLivreMensal + entradasCegas − saidasCegas`.
  //
  // ⚠️ E SE HOUVER MAIS DE UMA DIRIGIDA? Todas leem o MESMO caixa — nenhuma
  // enxerga o que a outra consumiu. É deliberado: encadeá-las faria a ordem do
  // array virar PRIORIDADE DE PAGAMENTO, que é exatamente a competição por
  // caixa que a #355 apagou. Enquanto não houver decisão do autor sobre como
  // duas dirigidas dividem caixa, o motor não inventa uma — e a ausência de
  // dependência de ordem está travada em teste (`#434 duas dirigidas leem o
  // mesmo caixa`).
  //
  // O estado NÃO é impossível, só improvável: `financiamento_producao` é única
  // por estudo (`docs/viabilidade/fluxo-investidor-formulas.md:27`), mas quem
  // garante isso é `conflitoFinanciamentoUnico` em `backend/rotas/funding.ts`,
  // que LÊ e depois GRAVA (dois POSTs concorrentes passam os dois), e o
  // `schema.json` não tem índice único para o par — só `[["estudo_id"]]`.
  // Fechar essa janela é decisão de schema, fora do escopo da #434.
  //
  // ⚠️ `series` é REMONTADA NA ORDEM ORIGINAL de `operacoes`: ela alimenta
  // `linhasEntrada`/`linhasSaida` abaixo, que são as linhas da tabela do Fluxo
  // de Caixa. Simular em duas passadas e devolver na ordem de simulação
  // trocaria a ordem das linhas na tela sem ninguém pedir.
  const series: SerieOperacao[] = new Array(operacoes.length);
  const indicesDirigidas: number[] = [];

  // Passada 1 — cegas ao caixa.
  operacoes.forEach((op, idx) => {
    if (op.tipo === 'financiamento_producao') { indicesDirigidas.push(idx); return; }
    series[idx] = eDivida(op.tipo)
      ? simularDivida(op, prazo)
      : simularEquity(op, receitaLiquidaMensal, resultadoFinal, mesRepasseValor, prazo);
  });

  // Caixa que a passada 2 enxerga. Mesma disciplina de arredondamento da
  // costura final `fluxoMensal` (C7): round2 na composição por período.
  // Sem nenhuma cega, é o próprio `fluxoLivreMensal` — operação única não
  // muda de comportamento.
  let fluxoParaDirigidas = fluxoLivreMensal;
  if (indicesDirigidas.length < operacoes.length) {
    const entradasCegas = serieZerada(prazo);
    const saidasCegas = serieZerada(prazo);
    for (const s of series) {
      if (!s) continue;
      for (let t = 0; t < prazo; t++) {
        entradasCegas[t] = round2(entradasCegas[t] + s.entradas[t]);
        saidasCegas[t] = round2(saidasCegas[t] + s.saidas[t]);
      }
    }
    fluxoParaDirigidas = fluxoLivreMensal.map(
      (v, t) => round2(n(v) + entradasCegas[t] - saidasCegas[t]),
    );
  }

  // Passada 2 — dirigidas por caixa. `fluxoParaDirigidas` NÃO é atualizado
  // dentro do laço: cada dirigida lê o mesmo caixa, e por isso o resultado de
  // cada uma independe da posição dela em `operacoes` (ver o aviso acima).
  for (const idx of indicesDirigidas) {
    const op = operacoes[idx];
    const ids = Array.isArray(op.custo_linha_ids) && op.custo_linha_ids.length
      ? op.custo_linha_ids
      : linhasFinanciaveisPadrao(contexto?.custosRaw ?? []);
    const custoElegivel = custoElegivelMensalDeLinhas(contexto?.linhasCusto ?? [], ids, prazo);
    series[idx] = simularFinanciamentoProducao(
      op, custoElegivel, janela, mesChaves, fluxoParaDirigidas, prazo,
    );
  }

  const linha = (nome: string, mensal: number[]): LinhaFunding => ({
    nome,
    mensal,
    total: round2(mensal.reduce((a, b) => a + b, 0)),
    vpl: round2(vplFluxo(mensal, taxaDescontoAa)),
  });

  const rotulo = (s: SerieOperacao) => {
    const nome = s.operacao.nome || TIPO_LABEL[s.operacao.tipo];
    return eDivida(s.operacao.tipo) ? nome : `${nome} (Equity)`;
  };

  const linhasEntrada = series
    .filter((s) => s.entradas.some((v) => Math.abs(v) > 0.005))
    .map((s) => linha(`${rotulo(s)} — ${eDivida(s.operacao.tipo) ? 'liberações' : 'aporte'}`, s.entradas));

  const linhasSaida = series
    .filter((s) => s.saidas.some((v) => Math.abs(v) > 0.005))
    .map((s) => linha(`Funding · ${rotulo(s)} — ${eDivida(s.operacao.tipo) ? 'parcelas' : 'retorno'}`, s.saidas));

  const soma = (pegar: (s: SerieOperacao) => number[]): number[] => {
    const out = serieZerada(prazo);
    for (const s of series) for (let t = 0; t < prazo; t++) out[t] = round2(out[t] + pegar(s)[t]);
    return out;
  };
  const entradas = soma((s) => s.entradas);
  const saidas = soma((s) => s.saidas);

  const fluxoMensal = fluxoLivreMensal.map((v, t) => round2(v + entradas[t] - saidas[t]));
  const fluxoAcumulado: number[] = [];
  let acc = 0;
  for (const v of fluxoMensal) { acc = round2(acc + v); fluxoAcumulado.push(acc); }

  const vplLiquido = round2(
    linhasEntrada.reduce((s, l) => s + l.vpl, 0) - linhasSaida.reduce((s, l) => s + l.vpl, 0),
  );

  // §38: detalhamento por operação de financiamento à produção. Só entra
  // quem efetivamente liberou — uma operação cujo gatilho nunca abriu
  // renderizaria oito linhas de zero, sem informação nenhuma.
  const financiamentoProducao: BlocoFinanciamentoProducao[] = [];
  for (const s of series) {
    if (s.operacao.tipo !== 'financiamento_producao' || !s.diagnostico) continue;
    if (s.entradas.every((v) => v === 0)) continue;
    const d = s.diagnostico;
    financiamentoProducao.push({
      nome: s.operacao.nome || TIPO_LABEL.financiamento_producao,
      linhas: [
        { nome: 'Despesas financiáveis', mensal: d.custoElegivel, formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: '% custos financiáveis incorridos', mensal: d.percentualIncorrido, formato: 'percentual', agregacao: 'ultimo', mostrarTotal: false },
        { nome: 'Liberação habilitada', mensal: d.liberacaoHabilitada, formato: 'sinal', agregacao: 'ultimo', mostrarTotal: false },
        { nome: 'Liberação do financiamento', mensal: s.entradas, formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: 'Juros do financiamento', mensal: s.juros, formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: 'Caixa disponível para amortização', mensal: d.caixaDisponivelAmortizacao, formato: 'moeda', agregacao: 'ultimo', mostrarTotal: false },
        { nome: 'Amortização', mensal: s.saidas, formato: 'moeda', agregacao: 'soma', mostrarTotal: true },
        { nome: 'Saldo devedor', mensal: s.saldo, formato: 'moeda', agregacao: 'ultimo', mostrarTotal: false },
      ],
    });
  }

  return {
    operacoes: series,
    noFluxo: { entradas, saidas, linhasEntrada, linhasSaida, financiamentoProducao, fluxoMensal, fluxoAcumulado, vplLiquido },
  };
}

/**
 * Reagrupa as séries de funding nas mesmas faixas da view Anual (#127) — sem
 * isso o funding sumiria da tabela ao trocar para Anual. Soma dentro de cada
 * faixa; o acumulado pega o ÚLTIMO ponto da faixa, mesma convenção de
 * `agregarFluxoPorPeriodos`. VPL NÃO é reagregado: descontar de novo uma
 * série já descontada não significa nada. Cada linha do detalhamento declara
 * a sua agregação: fluxos somam, estoques (saldo devedor, % incorrido) pegam
 * o último ponto.
 */
export function agregarFundingPorPeriodos(
  f: FundingNoFluxo,
  periodos: { inicio: number; fim: number }[],
): FundingNoFluxo {
  const somar = (serie: number[]) => periodos.map((p) => {
    let s = 0;
    for (let t = p.inicio; t <= p.fim && t < serie.length; t++) s += serie[t];
    return round2(s);
  });
  const ultimo = (serie: number[]) => periodos.map((p) => serie[Math.min(p.fim, serie.length - 1)] ?? 0);
  const linhas = (ls: LinhaFunding[]) => ls.map((l) => ({ ...l, mensal: somar(l.mensal) }));

  return {
    entradas: somar(f.entradas),
    saidas: somar(f.saidas),
    linhasEntrada: linhas(f.linhasEntrada),
    linhasSaida: linhas(f.linhasSaida),
    financiamentoProducao: f.financiamentoProducao.map((b) => ({
      ...b,
      linhas: b.linhas.map((l) => ({ ...l, mensal: l.agregacao === 'soma' ? somar(l.mensal) : ultimo(l.mensal) })),
    })),
    fluxoMensal: somar(f.fluxoMensal),
    fluxoAcumulado: ultimo(f.fluxoAcumulado),
    vplLiquido: f.vplLiquido,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Reordenação (genérica — herdada do #277, continua servindo)
// ─────────────────────────────────────────────────────────────────────────

export function reordenarCamadas<T extends { id: any; ordem?: number }>(
  camadas: T[], id: any, direcao: 'cima' | 'baixo',
): T[] {
  const lista = [...camadas].sort((a, b) => n(a.ordem) - n(b.ordem));
  const i = lista.findIndex((c) => String(c.id) === String(id));
  const j = direcao === 'cima' ? i - 1 : i + 1;
  if (i >= 0 && j >= 0 && j < lista.length) {
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista.map((c, idx) => ({ ...c, ordem: idx }));
}

export function camadasComOrdemAlterada<T extends { id: any; ordem?: number }>(
  antes: T[], depois: T[],
): T[] {
  const ordemAntes = new Map(antes.map((c) => [String(c.id), n(c.ordem)]));
  return depois.filter((c) => ordemAntes.get(String(c.id)) !== n(c.ordem));
}

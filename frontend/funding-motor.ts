import { eCorretagem } from './fluxo-shared.js';
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
  valor: number;
  /** Mês RELATIVO 0-based do aporte/1ª liberação (já resolvido da âncora pelo backend). */
  inicio_mes: number;
  // ── dívida ──
  distribuir_aporte?: boolean;
  aporte_meses?: number;
  /** Percentual ao ano (20 = 20% a.a.). */
  taxa_anual?: number;
  periodo_amortizacao_meses?: number;
  periodo_carencia_meses?: number;
  // ── equity ──
  modo_retorno?: ModoRetorno;
  /** Percentual (4 = 4%). */
  pct_retorno?: number;
}

/** As séries mensais de UMA operação, 0-based e do comprimento do horizonte. */
export interface SerieOperacao {
  operacao: OperacaoFunding;
  /** Dívida: liberação do principal. Equity: aporte. O projeto RECEBE. */
  entradas: number[];
  /** Dívida: PMT pago. Equity: retorno pago. O projeto PAGA. */
  saidas: number[];
  /** Visão do investidor: `saidas − entradas`. Base da TIR/VPL/Payback dele. */
  fluxoInvestidor: number[];
  /** Só dívida — vazios em equity. */
  juros: number[];
  saldo: number[];
}

export function eDivida(tipo: TipoOperacao): boolean {
  return tipo === 'financiamento_producao' || tipo === 'divida';
}

const serieZerada = (prazo: number): number[] => new Array<number>(Math.max(0, prazo)).fill(0);

/**
 * Dívida (Financiamento à produção e Dívida) — tradução direta das colunas
 * B a G da aba `divida`.
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
 * Equity — colunas D a F da aba `equity`, nos dois modos:
 *
 *  · `permuta_financeira` — `pct` incide sobre a RECEITA LÍQUIDA mensal, mês a
 *    mês, progressivamente;
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
  mesRepasse: number,
  prazo: number,
): SerieOperacao {
  const entradas = serieZerada(prazo);
  const saidas = serieZerada(prazo);
  const pct = n(op.pct_retorno) / 100;
  const m0 = Math.max(0, Math.floor(n(op.inicio_mes)));
  const progressivo = (op.modo_retorno ?? 'permuta_financeira') === 'permuta_financeira';

  for (let t = 0; t < prazo; t++) {
    entradas[t] = t === m0 ? round2(n(op.valor)) : 0;
    if (progressivo) {
      saidas[t] = round2(n(receitaLiquidaMensal[t]) * pct);
    } else {
      saidas[t] = t === mesRepasse ? round2(resultadoFinal * pct) : 0;
    }
  }

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
 * Duas divergências deliberadas em relação à planilha, registradas na #355:
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
 * `tela-fluxo-ver.ts`, `tela-cenarios.ts` e `proforma-avancado.ts`. Ele
 * sobreviveu à reescrita do #355 de propósito: é a fronteira que manteve a
 * entrega da Fase 9 de pé enquanto todo o motor por trás era trocado.
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
 * Simula todas as operações do estudo e monta a costura com a tabela.
 *
 * `receitaLiquidaMensal` alimenta o Equity em modo permuta financeira;
 * `resultadoFinal` e `mesRepasse`, o modo resultado final. Nenhum dos três é
 * digitado pelo usuário (**D8**): vêm do próprio estudo, para que a aba de
 * Funding e a de Resultados nunca contem histórias diferentes.
 */
export function fundingDoEstudo(
  operacoes: OperacaoFunding[],
  fluxoLivreMensal: number[],
  receitaLiquidaMensal: number[],
  resultadoFinal: number,
  mesRepasse: number,
  taxaDescontoAa: number,
): FundingCalc | null {
  if (!operacoes || operacoes.length === 0) return null;
  const prazo = fluxoLivreMensal.length;

  const series = operacoes.map((op) => (eDivida(op.tipo)
    ? simularDivida(op, prazo)
    : simularEquity(op, receitaLiquidaMensal, resultadoFinal, mesRepasse, prazo)));

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

  return {
    operacoes: series,
    noFluxo: { entradas, saidas, linhasEntrada, linhasSaida, fluxoMensal, fluxoAcumulado, vplLiquido },
  };
}

/**
 * Reagrupa as séries de funding nas mesmas faixas da view Anual (#127) — sem
 * isso o funding sumiria da tabela ao trocar para Anual. Soma dentro de cada
 * faixa; o acumulado pega o ÚLTIMO ponto da faixa, mesma convenção de
 * `agregarFluxoPorPeriodos`. VPL NÃO é reagregado: descontar de novo uma
 * série já descontada não significa nada.
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

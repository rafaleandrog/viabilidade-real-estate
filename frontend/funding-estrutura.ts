// Estrutura de capital do Funding do Avançado — núcleo de cálculo PURO.
//
// Sem lit, sem DOM e sem simulação própria: este módulo NÃO chama o motor de
// fluxo nem o funding do estudo. Quem simula é a tela (ou o script de
// conferência), que injeta a função `simular` na sequência e entrega as séries
// já calculadas para as camadas e os KPIs. Tudo aqui é derivado do motor:
// nenhum número é digitado.
//
// ── Convenções de unidade (fixadas UMA vez, na borda) ─────────────────────
//
// O motor mistura unidades, e este módulo as converte aqui. Tudo o que ele
// devolve em percentual está em PONTOS PERCENTUAIS (20 = 20%), com precisão
// plena e sem arredondar:
//
//   · `IndicadoresEstrutura.tirAlavancada` já vem em % a.a. (TIR do fluxo
//     alavancado, a mesma função da TIR do projeto) e passa direto;
//   · `tirAnual` (dívida e equity), `custoEfetivoAnual` e `desagioPct`
//     (antecipação) vêm em FRAÇÃO (0,20 = 20%) e saem multiplicados por 100;
//   · `exposicaoMaxima` vem em R$, ≤ 0 (piso em zero). O cartão e o stack
//     mostram o MÓDULO (`Math.abs`): o sinal do motor não vaza para a tela.
//
// ── Senioridade ─────────────────────────────────────────────────────────
//
// Ordem de pagamento e ordem de leitura da comparação "antes → depois":
// Financiamento à produção (base) → dívidas → antecipações → equity → o
// incorporador, que não é operação: é o que sobra. É RÓTULO e ordem de
// leitura; o motor não muda (todo terceiro recebe o contrato inteiro e o
// incorporador cobre a falta de caixa). A ordem quase nunca muda o resultado
// do estudo: a antecipação é simulada em ordem cronológica de `inicio_mes`, e
// o Financiamento à produção lê o caixa depois das operações cegas, em
// qualquer ordem recebida. A exceção é o EMPATE de `inicio_mes` entre duas
// antecipações: o motor as simula na ordem do array recebido, e a segunda
// cede sobre o lastro que a primeira deixou. Entre antecipações, a ordem de
// senioridade é `ordem` e depois `id` — a mesma ordem em que a tela recebe as
// operações (por `ordem`) —, então as duas só divergem se duas antecipações
// do mesmo mês tiverem a mesma `ordem`.
//
// ── Camada ≠ passo ──────────────────────────────────────────────────────
//
// O Financiamento à produção lê o caixa depois das operações cegas (dívida,
// equity, antecipação). A série dele sozinho (o primeiro passo da sequência)
// difere da série dele na estrutura completa. Por isso o VALOR DA CAMADA vem
// da estrutura COMPLETA, e o "depois" do passo vem da estrutura PARCIAL. As
// duas leituras são corretas; respondem perguntas diferentes.

import type { FluxoCalc } from './fluxo-caixa-motor.js';
import { tirFluxo } from './fluxo-caixa-motor.js';
import {
  eDivida, indicadoresAntecipacao, indicadoresOperacao,
  type FundingCalc, type ModoRetorno, type OperacaoFunding, type SerieOperacao, type TipoOperacao,
} from './funding-motor.js';
import { fmtPct } from './viab-format.js';

// ─────────────────────────────────────────────────────────────────────────
// Indicadores de uma estrutura (movidos de `funding-alternativas.ts`, que os
// reexporta até a tela deixar de importá-los de lá)
// ─────────────────────────────────────────────────────────────────────────

export interface IndicadoresEstrutura {
  /** Pior ponto do acumulado do fluxo alavancado, com piso em zero (nunca positivo, nunca -0). */
  exposicaoMaxima: number;
  /** TIR anual em % a.a. (mesma unidade e mesma função da TIR do projeto); null sem mudança de sinal. */
  tirAlavancada: number | null;
  /** Σ saídas − Σ entradas do funding no fluxo; 0 sem funding. */
  custoFinanceiro: number;
  /** Σ do fluxo alavancado; sem funding, Σ do fluxo livre. */
  resultadoAposFunding: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
/** round2 sem produzir -0. */
const r2 = (v: number): number => round2(v) || 0;
const soma = (xs: number[]): number => xs.reduce((s, v) => s + v, 0);

/**
 * Os quatro indicadores de uma estrutura. Sem funding (`null`), a estrutura é
 * o próprio projeto: TIR = TIR do projeto, custo financeiro 0 e resultado = Σ
 * do fluxo livre.
 *
 * O acumulado segue a convenção do motor de fluxo: `round2` a cada passo.
 * `custoFinanceiro` é a soma das saídas menos a das entradas arredondada só no
 * fim; por isso, contra "resultado sem funding − resultado após funding" (cada
 * mês do alavancado é arredondado em separado) pode haver diferença de centavos.
 */
export function indicadoresEstrutura(
  calc: Pick<FluxoCalc, 'fluxoMensal'>,
  funding: FundingCalc | null,
): IndicadoresEstrutura {
  const nf = funding?.noFluxo;
  const fluxo = nf ? nf.fluxoMensal : calc.fluxoMensal;
  let acc = 0;
  let menor = 0;
  for (const v of fluxo) {
    acc = round2(acc + v);
    if (acc < menor) menor = acc;
  }
  return {
    exposicaoMaxima: menor < 0 ? menor : 0,
    tirAlavancada: tirFluxo(fluxo),
    custoFinanceiro: nf ? r2(soma(nf.saidas) - soma(nf.entradas)) : 0,
    resultadoAposFunding: r2(soma(fluxo)),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Ordem de senioridade
// ─────────────────────────────────────────────────────────────────────────

/** Da base (mais sênior) para o topo. O incorporador não é operação e fica fora. */
export const ORDEM_SENIORIDADE: readonly TipoOperacao[] = [
  'financiamento_producao', 'divida', 'antecipacao_recebiveis', 'equity',
];

/** Posição do tipo na senioridade (0 = base). Tipo desconhecido vai depois do equity, nunca é descartado. */
export function nivelSenioridade(tipo: string): number {
  const i = (ORDEM_SENIORIDADE as readonly string[]).indexOf(tipo);
  return i < 0 ? ORDEM_SENIORIDADE.length : i;
}

type Ordenavel = Pick<OperacaoFunding, 'tipo'> & { id?: number | string; ordem?: number | null };

function compararId(a: number | string, b: number | string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

const ordemDe = (o: Ordenavel): number => {
  const v = o.ordem;
  return v === null || v === undefined || !Number.isFinite(Number(v)) ? Number.POSITIVE_INFINITY : Number(v);
};

/**
 * Comparador da senioridade: tipo; dentro do tipo, operação sem `id` (rascunho)
 * vai depois das irmãs; entre as que têm `id`, `ordem` (ausente vai por último)
 * e depois `id`. Empate completo devolve 0 — a ordenação estável preserva a
 * ordem de chegada.
 */
function compararSenioridade(a: Ordenavel, b: Ordenavel): number {
  const nivel = nivelSenioridade(a.tipo) - nivelSenioridade(b.tipo);
  if (nivel !== 0) return nivel;
  const semIdA = a.id === undefined || a.id === null;
  const semIdB = b.id === undefined || b.id === null;
  if (semIdA || semIdB) return semIdA === semIdB ? 0 : semIdA ? 1 : -1;
  const oa = ordemDe(a);
  const ob = ordemDe(b);
  if (oa !== ob) return oa < ob ? -1 : 1;
  return compararId(a.id as number | string, b.id as number | string);
}

/** Array NOVO na ordem de senioridade; não muta a entrada. Ordenação estável. */
export function ordenarPorSenioridade<T extends Ordenavel>(operacoes: readonly T[]): T[] {
  return [...operacoes].sort(compararSenioridade);
}

// ─────────────────────────────────────────────────────────────────────────
// Sequência "antes → depois"
// ─────────────────────────────────────────────────────────────────────────

export interface PassoEstrutura {
  operacao: OperacaoFunding;
  /** A estrutura com as operações mais seniores que esta (no primeiro passo, o projeto sem funding). */
  antes: IndicadoresEstrutura;
  /** A estrutura com as mais seniores e esta. */
  depois: IndicadoresEstrutura;
}

export interface SequenciaEstrutura {
  /** O projeto sem funding. */
  base: IndicadoresEstrutura;
  passos: PassoEstrutura[];
}

/**
 * Operações que participam da estrutura: a mesma regra do funding do estudo,
 * que ignora a operação desligada (`ativo === false`, hoje só o Financiamento
 * à produção pode estar assim).
 */
export const operacoesEfetivas = (operacoes: readonly OperacaoFunding[]): OperacaoFunding[] =>
  operacoes.filter((op) => op.ativo !== false);

/**
 * A sequência por senioridade. `simular` recebe um subconjunto de operações e
 * devolve os indicadores da estrutura com ELAS (lista vazia = projeto sem
 * funding), ou `null` enquanto a tela não tem o fluxo carregado — e aí esta
 * função também devolve `null`.
 *
 * Cada passo SIMULA DE NOVO o prefixo, nunca soma efeitos isolados: o
 * Financiamento à produção lê o caixa que as outras deixaram, e uma antecipação
 * enxerga o que a anterior já cedeu.
 */
export function sequenciaDeEstrutura(
  operacoes: readonly OperacaoFunding[],
  simular: (ops: OperacaoFunding[]) => IndicadoresEstrutura | null,
): SequenciaEstrutura | null {
  const base = simular([]);
  if (!base) return null;
  const ordenadas = ordenarPorSenioridade(operacoesEfetivas(operacoes));
  const passos: PassoEstrutura[] = [];
  let antes = base;
  for (let i = 0; i < ordenadas.length; i++) {
    const depois = simular(ordenadas.slice(0, i + 1));
    if (!depois) return null;
    passos.push({ operacao: ordenadas[i], antes, depois });
    antes = depois;
  }
  return { base, passos };
}

// ─────────────────────────────────────────────────────────────────────────
// KPIs do cartão
// ─────────────────────────────────────────────────────────────────────────

/** Os KPIs comuns a todo cartão: a estrutura antes e depois da operação. */
export interface KpisEstruturaPasso {
  /** % a.a.; null sem troca de sinal ou sem passo. */
  tirAlavancadaAntes: number | null;
  tirAlavancadaDepois: number | null;
  /** R$, módulo da exposição do motor (≥ 0); null sem passo. */
  exposicaoAntes: number | null;
  exposicaoDepois: number | null;
}

export type KpisOperacao = KpisEstruturaPasso & (
  | {
    tipo: 'divida';
    /** Principal liberado ÷ VGV potencial, em pontos percentuais. */
    ltvPct: number | null;
    /** TIR anual do fluxo do credor, com tarifas, em % a.a. */
    custoEfetivoPct: number | null;
  }
  | {
    tipo: 'equity';
    /** Lucro ÷ aporte, em pontos percentuais (−100 se nada volta). */
    roiInvestidorPct: number | null;
    /** TIR anual do investidor, em % a.a. */
    tirInvestidorPct: number | null;
  }
  | {
    tipo: 'antecipacao_recebiveis';
    /** Deságio ÷ valor de face, em pontos percentuais. */
    desagioPct: number | null;
    /** TIR anual da cessão, com tarifas, em % a.a. */
    custoEfetivoPct: number | null;
  }
  | { tipo: 'financiamento_producao' }
  | { tipo: 'outro' }
);

const pctDeFracao = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : v * 100);
const exposicao = (e: IndicadoresEstrutura | undefined): number | null =>
  e ? Math.abs(e.exposicaoMaxima) : null;

/**
 * LTV de uma operação, direto da série dela. Não usa a visão do investidor:
 * ela casa operações por `nome` (nomes repetidos colidem) e só é chamada com a
 * lista inteira. `null` sem VGV ou sem principal.
 */
export function ltvDaSerie(serie: SerieOperacao, vgvTotal: number): number | null {
  const principal = soma(serie.entradas);
  if (!(vgvTotal > 0) || !(principal > 0)) return null;
  return (principal / vgvTotal) * 100;
}

/**
 * Os KPIs do cartão de UMA operação. `serie` é a série dela na estrutura
 * completa; `passo`, o passo dela na sequência (null enquanto a sequência não
 * existe). Todo KPI sem base de cálculo é `null`, nunca zero.
 */
export function kpisDaOperacao(
  serie: SerieOperacao,
  vgvTotal: number,
  passo: PassoEstrutura | null,
): KpisOperacao {
  const comum: KpisEstruturaPasso = {
    tirAlavancadaAntes: passo?.antes.tirAlavancada ?? null,
    tirAlavancadaDepois: passo?.depois.tirAlavancada ?? null,
    exposicaoAntes: exposicao(passo?.antes),
    exposicaoDepois: exposicao(passo?.depois),
  };
  const tipo = serie.operacao.tipo;
  // A taxa de desconto só move o VPL, que não é lido aqui: TIR, lucro e
  // investimento não dependem dela.
  if (tipo === 'divida') {
    const ind = indicadoresOperacao(serie, 0);
    return { ...comum, tipo, ltvPct: ltvDaSerie(serie, vgvTotal), custoEfetivoPct: pctDeFracao(ind.tirAnual) };
  }
  if (tipo === 'equity') {
    const ind = indicadoresOperacao(serie, 0);
    const aporte = -ind.investimentoTotal;
    return {
      ...comum,
      tipo,
      roiInvestidorPct: aporte > 0 ? (ind.lucro / aporte) * 100 : null,
      tirInvestidorPct: pctDeFracao(ind.tirAnual),
    };
  }
  if (tipo === 'antecipacao_recebiveis') {
    const ind = indicadoresAntecipacao(serie);
    // O motor devolve deságio 0 (não null) sem lastro: quem decide é o valor de face.
    const comLastro = ind.valorFace > 0;
    return {
      ...comum,
      tipo,
      desagioPct: comLastro ? ind.desagioPct * 100 : null,
      custoEfetivoPct: comLastro ? pctDeFracao(ind.custoEfetivoAnual) : null,
    };
  }
  if (tipo === 'financiamento_producao') return { ...comum, tipo };
  return { ...comum, tipo: 'outro' };
}

/** Maior saldo devedor da série: só dívida e Financiamento à produção; `null` nos demais. */
export function maiorSaldoDevedor(serie: SerieOperacao): number | null {
  if (!eDivida(serie.operacao.tipo)) return null;
  return serie.saldo.reduce((m, v) => (v > m ? v : m), 0);
}

// ─────────────────────────────────────────────────────────────────────────
// Camadas do stack e totais
// ─────────────────────────────────────────────────────────────────────────

export interface CamadaStack {
  /** `id` da operação; `'incorporador'` na camada do topo; `null` em operação sem id. */
  id: number | string | null;
  tipo: TipoOperacao | 'incorporador';
  nome: string;
  /** R$, nunca negativo. */
  valor: number;
  /** Fração de Σ camadas em pontos percentuais; null quando Σ = 0. */
  pct: number | null;
}

const ROTULO_TIPO: Record<string, string> = {
  financiamento_producao: 'Financiamento à produção',
  divida: 'Dívida',
  antecipacao_recebiveis: 'Antecipação de recebíveis',
  equity: 'Equity',
};

/** Tamanho da camada: o maior valor que aquela parte teve dentro do projeto. */
function valorDaCamada(s: SerieOperacao): number {
  const tipo = s.operacao.tipo;
  if (eDivida(tipo)) return Math.max(0, r2(maiorSaldoDevedor(s) ?? 0));
  if (tipo === 'antecipacao_recebiveis') return Math.max(0, indicadoresAntecipacao(s).valorPresente);
  // Equity (e tipo desconhecido, que o motor simula como equity): o aporte.
  return Math.max(0, r2(soma(s.entradas)));
}

/**
 * Uma camada por operação efetiva da estrutura COMPLETA, na ordem de
 * senioridade, mais a do incorporador no topo (o módulo da exposição máxima
 * após o funding). Camada de valor zero é devolvida com valor 0: quem desenha
 * decide se a mostra. Sem funding, só a camada do incorporador.
 */
export function camadasDoStack(
  funding: FundingCalc | null,
  estruturaCompleta: IndicadoresEstrutura,
): CamadaStack[] {
  const series = funding?.operacoes ?? [];
  const ordenadas = [...series].sort((a, b) => compararSenioridade(a.operacao, b.operacao));
  const brutas: Omit<CamadaStack, 'pct'>[] = ordenadas.map((s) => ({
    id: s.operacao.id ?? null,
    tipo: s.operacao.tipo,
    nome: s.operacao.nome || ROTULO_TIPO[s.operacao.tipo] || String(s.operacao.tipo),
    valor: valorDaCamada(s),
  }));
  brutas.push({
    id: 'incorporador',
    tipo: 'incorporador',
    nome: 'Incorporador',
    valor: Math.abs(estruturaCompleta.exposicaoMaxima),
  });
  const total = soma(brutas.map((c) => c.valor));
  return brutas.map((c) => ({ ...c, pct: total > 0 ? (c.valor / total) * 100 : null }));
}

export interface TotaisEstrutura {
  /** Σ dos custos do projeto. */
  usosTotais: number;
  /** Camadas de dívida + Financiamento à produção. */
  divida: number;
  /** Camadas de equity (os aportes). */
  equityTerceiros: number;
  /** Módulo da exposição máxima após o funding. */
  incorporadorNoPico: number;
}

export function totaisDaEstrutura(
  calc: Pick<FluxoCalc, 'custoMensal'>,
  camadas: readonly CamadaStack[],
  estruturaCompleta: IndicadoresEstrutura,
): TotaisEstrutura {
  const somaDe = (pred: (c: CamadaStack) => boolean) => r2(soma(camadas.filter(pred).map((c) => c.valor)));
  return {
    usosTotais: r2(soma(calc.custoMensal)),
    divida: somaDe((c) => c.tipo === 'divida' || c.tipo === 'financiamento_producao'),
    equityTerceiros: somaDe((c) => c.tipo === 'equity'),
    incorporadorNoPico: Math.abs(estruturaCompleta.exposicaoMaxima),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Rótulo de preferência do equity
// ─────────────────────────────────────────────────────────────────────────

/**
 * Modo ausente cai em `permuta_financeira`, o padrão do motor. Qualquer outro
 * valor segue o motor, que só trata como progressivo o `permuta_financeira`
 * exato e simula o resto como `resultado_final`: o rótulo nunca diz uma coisa
 * enquanto o motor calcula outra.
 */
export function rotuloPreferenciaEquity(modo: ModoRetorno | string | null | undefined): string {
  return (modo ?? 'permuta_financeira') === 'permuta_financeira' ? 'recebe sobre a receita' : 'participa do resultado';
}

// ─────────────────────────────────────────────────────────────────────────
// Leitura da operação (texto por regras)
// ─────────────────────────────────────────────────────────────────────────

/** Diferença de exposição (R$) abaixo da qual a operação "não altera a exposição". */
export const LIMIAR_EXPOSICAO_INALTERADA = 0.5;
/** Diferença (pontos percentuais) abaixo da qual custo e TIR "praticamente se igualam". */
export const LIMIAR_CUSTO_EMPATE_PP = 0.05;
/** Valor mensal (R$) abaixo do qual um mês não conta como recebimento ou pagamento. */
export const LIMIAR_MES_COM_VALOR = 0.005;
/** Teto de frases da leitura. */
export const MAX_FRASES_LEITURA = 3;

export interface EntradaLeitura {
  serie: SerieOperacao;
  kpis: KpisOperacao;
  passo: PassoEstrutura | null;
}

const pctAa = (v: number): string => `${fmtPct(v)} a.a.`;

function primeiroMes(xs: number[]): number | null {
  const i = xs.findIndex((v) => Math.abs(v) >= LIMIAR_MES_COM_VALOR);
  return i < 0 ? null : i;
}
function ultimoMes(xs: number[]): number | null {
  for (let i = xs.length - 1; i >= 0; i--) if (Math.abs(xs[i]) >= LIMIAR_MES_COM_VALOR) return i;
  return null;
}

function fraseExposicao(passo: PassoEstrutura | null, fmtValor: (v: number) => string): string | null {
  if (!passo) return null;
  const antes = Math.abs(passo.antes.exposicaoMaxima);
  const depois = Math.abs(passo.depois.exposicaoMaxima);
  if (Math.abs(depois - antes) < LIMIAR_EXPOSICAO_INALTERADA) {
    return `Não altera a exposição máxima do incorporador, que fica em ${fmtValor(depois)}.`;
  }
  return depois < antes
    ? `Reduz a exposição máxima do incorporador de ${fmtValor(antes)} para ${fmtValor(depois)}.`
    : `Aumenta a exposição máxima do incorporador de ${fmtValor(antes)} para ${fmtValor(depois)}.`;
}

/** O mês sai pelo formatador da tela (`fmtMes` recebe o índice 0-based do motor), para a leitura dizer o mesmo mês que o resto da tela. */
function fraseQuando(serie: SerieOperacao, fmtMes: (mes: number) => string): string | null {
  const entra = primeiroMes(serie.entradas);
  const sai = ultimoMes(serie.saidas);
  const tipo = serie.operacao.tipo;
  const [recebe, paga] = tipo === 'equity'
    ? ['O investidor aporta a partir de', 'recebe o retorno até']
    : tipo === 'antecipacao_recebiveis'
      ? ['O projeto recebe o valor antecipado a partir de', 'repassa as parcelas cedidas até']
      : ['O projeto recebe a partir de', 'paga até'];
  if (entra !== null && sai !== null) return `${recebe} ${fmtMes(entra)} e ${paga} ${fmtMes(sai)}.`;
  if (entra !== null) return `${recebe} ${fmtMes(entra)}.`;
  if (sai !== null) {
    const sujeito = tipo === 'equity' ? 'O investidor' : 'O projeto';
    return `${sujeito} ${paga} ${fmtMes(sai)}.`;
  }
  return null;
}

/** O custo da operação para o projeto, em % a.a.: custo efetivo, ou a TIR do investidor no equity. */
function custoDaOperacao(k: KpisOperacao): number | null {
  if (k.tipo === 'divida' || k.tipo === 'antecipacao_recebiveis') return k.custoEfetivoPct;
  if (k.tipo === 'equity') return k.tirInvestidorPct;
  return null;
}

function fraseCusto(k: KpisOperacao): string | null {
  const custo = custoDaOperacao(k);
  const tir = k.tirAlavancadaAntes;
  if (custo === null || tir === null) return null;
  const rotulo = k.tipo === 'equity' ? 'O investidor recebe' : 'Custa';
  const dif = custo - tir;
  if (Math.abs(dif) < LIMIAR_CUSTO_EMPATE_PP) {
    return `${rotulo} ${pctAa(custo)}, praticamente a TIR alavancada de ${pctAa(tir)} antes dela.`;
  }
  return dif < 0
    ? `${rotulo} ${pctAa(custo)}, abaixo da TIR alavancada de ${pctAa(tir)} antes dela: alavanca o retorno do incorporador.`
    : `${rotulo} ${pctAa(custo)}, acima da TIR alavancada de ${pctAa(tir)} antes dela: reduz o retorno do incorporador.`;
}

/**
 * Até três frases, na ordem: (1) o que acontece com a exposição; (2) quando o
 * projeto recebe e paga; (3) o custo da operação contra a TIR alavancada
 * "antes" dela — as duas em % a.a. O veredito pode ser negativo. Frase sem
 * número que a sustente não sai; sem nenhum número, `[]`.
 *
 * `fmtValor` formata os valores em R$ — a tela passa o formatador do cartão.
 * `fmtMes` formata o mês (índice 0-based do motor) — a tela passa o rótulo de
 * mês que usa em todo o resto (`rotuloMesRelativo`). Os dois são obrigatórios:
 * esquecer um vira erro de compilação, não um mês contado de outro jeito.
 */
export function leituraDaOperacao(
  entrada: EntradaLeitura,
  fmtValor: (v: number) => string,
  fmtMes: (mes: number) => string,
): string[] {
  const frases = [
    fraseExposicao(entrada.passo, fmtValor),
    fraseQuando(entrada.serie, fmtMes),
    fraseCusto(entrada.kpis),
  ].filter((f): f is string => f !== null);
  return frases.slice(0, MAX_FRASES_LEITURA);
}

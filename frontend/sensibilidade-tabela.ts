// Tabela de sensibilidade da aba Cenários do Preliminar (Rodada 13, handoff
// §4.6.B — issue #730). Módulo PURO, sem Lit e sem DOM: as linhas do proforma
// que a tabela publica, o Δ% de cada lado contra a base, a amplitude
// (bull − bear) ÷ base, a partição entre linhas que se movem e linhas
// invariantes, e o rótulo de cabeçalho que declara o estresse aplicado.
//
// Antes eram três colunas de valores absolutos — "obrigando o leitor a
// calcular o delta de cabeça" — e toda linha aparecia, inclusive as sete que
// não se movem quando a variável é, por exemplo, a permuta financeira.

import type { Proforma } from './proforma.js';
import { calcularVariacao, EPSILON_PCT, type Variacao } from './cenario-variacao.js';

export type NaturezaSensibilidade = 'receita' | 'despesa';

/** O que cada cenário entrega à tabela: a Proforma do cenário e o VGV bruto dele. */
export interface CenarioSensibilidade { p: Proforma; vgvBruto: number; }

export interface LinhaSensibilidade {
  l: string;
  f: (c: CenarioSensibilidade) => number | null;
  natureza: NaturezaSensibilidade;
  pct?: boolean;
  badge?: boolean;
  bmCampo?: string;
  divisoria?: boolean;
}

/**
 * As dez linhas da tabela — oito monetárias e dois indicadores em %. É o
 * MESMO catálogo que `frontend/tela-proforma.ts` consumia inline; mora aqui
 * para a partição e o Δ% serem testáveis sem montar o componente.
 *
 * "Deduções sobre VGV" é a mesma linha da Proforma (imposto + corretagem +
 * marketing + permuta financeira R/NR), sem cálculo próprio — `c.p.*` já vem
 * do MESMO `calcularProforma`, reprecificado pelo fator do cenário; é a única
 * linha monetária que reage à variável "Permuta financeira" (pedido do autor,
 * 2026-09-14).
 *
 * #571: só as duas linhas `pct: true` podem devolver `null` (cenário com
 * VGV ≤ 0); as monetárias são sempre `number`.
 */
export const LINHAS_SENSIBILIDADE: readonly LinhaSensibilidade[] = [
  { l: 'VGV', f: (c) => c.vgvBruto, natureza: 'receita' },
  { l: 'Receita bruta', f: (c) => c.p.vgv, natureza: 'receita' },
  { l: 'Deduções sobre VGV', f: (c) => c.p.imposto + c.p.corretagem + c.p.marketing + c.p.permutaFinResidencial + c.p.permutaFinNaoResidencial, natureza: 'despesa' },
  { l: 'Receita líquida', f: (c) => c.p.receitaLiquida, natureza: 'receita' },
  { l: 'Custo direto total', f: (c) => c.p.custoDiretoTotal, natureza: 'despesa' },
  { l: 'Receita operacional', f: (c) => c.p.receitaOperacional, natureza: 'receita' },
  { l: 'Custo indireto total', f: (c) => c.p.custoIndiretoTotal, natureza: 'despesa' },
  { l: 'Resultado', f: (c) => c.p.resultado, natureza: 'receita' },
  { l: 'Custo obras / VGV', f: (c) => c.p.custoObrasVgvPct, natureza: 'despesa', pct: true, badge: true, bmCampo: 'custo_obras_vgv', divisoria: true },
  { l: 'Margem sobre VGV', f: (c) => c.p.margemLiquidaPct, natureza: 'receita', pct: true, badge: true, bmCampo: 'margem_liquida' },
];

export interface ValoresCenarios { bear: number | null; base: number | null; bull: number | null; }

export interface LinhaCalculada {
  linha: LinhaSensibilidade;
  valores: ValoresCenarios;
  /** Δ% do Bear contra a base — `null` quando não há o que sinalizar (#571: `—`, nunca `0,0%`). */
  deltaBear: Variacao | null;
  /** Δ% do Bull contra a base. */
  deltaBull: Variacao | null;
  /** (bull − bear) ÷ |base| × 100, assinada. `null` sem base ou sem os três valores. */
  amplitudePct: number | null;
  /** A linha não se move com esta variável (amplitude abaixo de `EPSILON_PCT`). */
  invariante: boolean;
}

/**
 * Sentido de "melhor" de cada linha, derivado da `natureza` que ela já
 * carrega: receita cresce = melhor; despesa cresce = pior. É o `maiorMelhor`
 * OBRIGATÓRIO de `calcularVariacao` (nota da #491) — uma cópia só, aqui.
 */
export function maiorMelhorDaNatureza(natureza: NaturezaSensibilidade): boolean {
  return natureza === 'receita';
}

/** (bull − bear) ÷ |base| × 100. `null` quando falta valor ou a base não serve de denominador. */
export function amplitudePct(v: ValoresCenarios): number | null {
  if (v.bear === null || v.base === null || v.bull === null) return null;
  if (!Number.isFinite(v.bear) || !Number.isFinite(v.base) || !Number.isFinite(v.bull)) return null;
  if (Math.abs(v.base) < 1e-9) return null;
  return ((v.bull - v.bear) / Math.abs(v.base)) * 100;
}

export function calcularLinha(linha: LinhaSensibilidade, valores: ValoresCenarios): LinhaCalculada {
  const maiorMelhor = maiorMelhorDaNatureza(linha.natureza);
  const amplitude = amplitudePct(valores);
  // Invariante = não se move com a MESMA tolerância que faz uma variação
  // arredondar para 0,0% (`EPSILON_PCT`). Sem base para medir (VGV zerado,
  // ou indicador `null`), a linha é invariante quando os três valores são o
  // mesmo — inclusive os três `null`.
  const invariante = amplitude !== null
    ? Math.abs(amplitude) < EPSILON_PCT
    : valores.bear === valores.base && valores.bull === valores.base;
  return {
    linha, valores,
    deltaBear: calcularVariacao(valores.bear, valores.base, maiorMelhor),
    deltaBull: calcularVariacao(valores.bull, valores.base, maiorMelhor),
    amplitudePct: amplitude,
    invariante,
  };
}

/** As linhas que se movem, na ordem do proforma, e as que não se movem, para o grupo recolhido. */
export function particionarInvariantes(linhas: LinhaCalculada[]): { visiveis: LinhaCalculada[]; invariantes: LinhaCalculada[] } {
  return {
    visiveis: linhas.filter((x) => !x.invariante),
    invariantes: linhas.filter((x) => x.invariante),
  };
}

/** Rótulo do grupo recolhido: "N linhas não afetadas por esta variável". */
export function rotuloInvariantes(n: number): string {
  return n === 1 ? '1 linha não afetada por esta variável' : `${n} linhas não afetadas por esta variável`;
}

/** Ordena por |amplitude| decrescente; sem amplitude vai para o fim, e a ordem do proforma desempata. */
export function ordenarPorAmplitude(linhas: LinhaCalculada[]): LinhaCalculada[] {
  return linhas
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      const aa = a.x.amplitudePct === null ? -1 : Math.abs(a.x.amplitudePct);
      const bb = b.x.amplitudePct === null ? -1 : Math.abs(b.x.amplitudePct);
      return bb - aa || a.i - b.i;
    })
    .map((o) => o.x);
}

/**
 * O cabeçalho declara o ESTRESSE, não só o nome do cenário: `📉 Bear −10%
 * Preço de venda`, não `📉 Bear`. Para uma variável custo-like o Bear é uma
 * ALTA (+X%) e o Bull uma queda — o mesmo sentido de `ehCustoLike` que a
 * tela usa para montar os fatores. A base é a referência: só `📊 Base`.
 */
export function rotuloEstresse(
  id: 'bear' | 'base' | 'bull', rotuloVariavel: string, varNeg: number, varPos: number, custoLike: boolean,
): string {
  if (id === 'base') return '📊 Base';
  if (id === 'bear') return `📉 Bear ${custoLike ? '+' : '−'}${varNeg}% ${rotuloVariavel}`;
  return `🚀 Bull ${custoLike ? '−' : '+'}${varPos}% ${rotuloVariavel}`;
}

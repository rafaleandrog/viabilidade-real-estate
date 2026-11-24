// ─────────────────────────────────────────────────────────────────────────
// Os três cenários clássicos da aba Cenários do Avançado — otimista, base e
// pessimista — e os seis indicadores da comparação entre eles.
//
// Funções puras, sem DOM: a tela (`tela-cenarios.ts`) as chama para
// pré-preencher o diálogo "Gerar otimista, base e pessimista" e para montar
// as colunas da tabela de cenários salvos. Ficam aqui, e não no componente,
// para o sinal de cada alavanca e a conta de cada indicador serem testáveis.
//
// As alavancas são as duas que o cenário salvo guarda (`preco_venda_pct` e
// `custo_obra_pct`). A velocidade de vendas ficou de fora por decisão do dono:
// exigiria coluna nova no schema.
// ─────────────────────────────────────────────────────────────────────────

import type { FluxoCalc } from './fluxo-caixa-motor.js';

/** Faixa de variação de uma alavanca, em %: `min ≤ 0 ≤ max`. */
export interface Faixa { min: number; max: number; }

/** Variação padrão de cada lado quando o benchmark não está configurado. */
export const FAIXA_PADRAO_PCT = 15;

const num = (v: any): number => Number(v) || 0;

/**
 * Faixa de uma alavanca a partir do benchmark de sensibilidade (`campo` =
 * `preco` ou `custo_obras`): `variacao_negativa_pct` vira o limite de baixo e
 * `variacao_positiva_pct` o de cima, os dois em módulo e arredondados. Sem
 * benchmark, ou sem um dos lados, ±15%. É a mesma régua dos controles
 * deslizantes da tela, que a usam para os limites.
 */
export function faixaDoBenchmark(benchmarks: any[], campo: string): Faixa {
  const b = (benchmarks ?? []).find((x) => String(x?.campo) === campo);
  const pos = b && b.variacao_positiva_pct != null ? Math.abs(num(b.variacao_positiva_pct)) : FAIXA_PADRAO_PCT;
  const neg = b && b.variacao_negativa_pct != null ? Math.abs(num(b.variacao_negativa_pct)) : FAIXA_PADRAO_PCT;
  return { min: -Math.round(neg), max: Math.round(pos) };
}

export interface CenarioPadrao {
  nome: string;
  precoVendaPct: number;
  custoObraPct: number;
}

/**
 * Os três cenários, nesta ordem:
 *  - **Otimista:** preço no limite de cima da faixa de preço, custo de obra no
 *    limite de baixo da faixa de custo;
 *  - **Base:** as duas alavancas em zero, o próprio estudo;
 *  - **Pessimista:** preço no limite de baixo, custo de obra no de cima.
 *
 * `+ 0` normaliza o `-0` de uma faixa sem lado negativo.
 */
export function cenariosPadrao(faixaPreco: Faixa, faixaCusto: Faixa): CenarioPadrao[] {
  return [
    { nome: 'Otimista', precoVendaPct: faixaPreco.max + 0, custoObraPct: faixaCusto.min + 0 },
    { nome: 'Base', precoVendaPct: 0, custoObraPct: 0 },
    { nome: 'Pessimista', precoVendaPct: faixaPreco.min + 0, custoObraPct: faixaCusto.max + 0 },
  ];
}

export interface IndicadoresCenario {
  /** VGV potencial do cenário (`vgvTotal`), que escala com o preço. */
  vgv: number;
  /** Resultado = fluxo de caixa livre acumulado no fim do horizonte. */
  resultado: number;
  /** Resultado ÷ VGV, em %; `null` com VGV ≤ 0 (sem base, não margem zero). */
  margemPct: number | null;
  tir: number | null;
  vpl: number;
  /** Exposição máxima em módulo: quanto maior, pior. */
  exposicao: number;
}

/**
 * Os seis indicadores da comparação, lidos de um `FluxoCalc`. O resultado e a
 * margem seguem a leitura de caixa do Resumo do Avançado (resultado =
 * `fluxoAcumulado[último]`, margem = resultado ÷ `vgvTotal`), para o mesmo
 * estudo dar o mesmo número nas duas abas.
 */
export function indicadoresCenario(c: FluxoCalc): IndicadoresCenario {
  const vgv = c.vgvTotal;
  const resultado = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] || 0;
  return {
    vgv,
    resultado,
    margemPct: vgv > 0 ? (resultado / vgv) * 100 : null,
    tir: c.tir,
    vpl: c.vpl,
    exposicao: Math.abs(c.exposicaoMaxima),
  };
}

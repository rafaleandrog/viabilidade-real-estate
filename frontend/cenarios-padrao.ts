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

/**
 * A `ordem` do primeiro cenário a gravar depois dos que já existem: o maior
 * `ordem` salvo mais um (0 com a lista vazia). Usar `cenarios.length` empata
 * quando um cenário do meio foi removido, e a lista é ordenada só por `ordem`.
 */
export function proximaOrdem(cenarios: { ordem?: unknown }[]): number {
  let maior = -1;
  for (const c of cenarios ?? []) {
    const o = Number(c?.ordem);
    if (Number.isFinite(o) && o > maior) maior = o;
  }
  return Math.floor(maior) + 1;
}

/**
 * A `ordem` de partida de uma gravação: a próxima depois dos salvos e, numa
 * nova tentativa depois de falha parcial, nunca abaixo da que a tentativa
 * anterior deixou livre (`retomada`). Sem isso, se a releitura da lista também
 * falhar, a lista em memória fica velha e a nova tentativa reaproveita uma
 * `ordem` já gravada.
 */
export function ordemDaTentativa(cenarios: { ordem?: unknown }[], retomada: number | null): number {
  return Math.max(proximaOrdem(cenarios), retomada ?? 0);
}

export interface ResultadoGravacao {
  /** Quantos foram gravados, na ordem do rascunho. */
  gravados: number;
  /** A `ordem` que a próxima gravação deve usar: a inicial mais os gravados. */
  ordemLivre: number;
  /** O que falta gravar: vazio quando todos entraram. Tentar de novo usa só isto. */
  pendentes: CenarioPadrao[];
  /** Mensagem do primeiro erro, ou `null`. */
  erro: string | null;
}

/**
 * Grava os cenários em sequência por `criar` (o `POST` de cenário), com `ordem`
 * a partir de `ordemInicial`, e para no primeiro erro — devolvido pela API
 * (`{ erro: true, mensagem }`) ou lançado. Os já gravados saem de `pendentes`,
 * para uma nova tentativa não os duplicar.
 */
export async function gravarCenariosPadrao(
  rascunho: CenarioPadrao[],
  ordemInicial: number,
  criar: (dados: Record<string, unknown>) => Promise<any>,
): Promise<ResultadoGravacao> {
  let gravados = 0;
  let erro: string | null = null;
  for (const c of rascunho) {
    try {
      const res = await criar({
        nome: c.nome, preco_venda_pct: c.precoVendaPct, custo_obra_pct: c.custoObraPct,
        ordem: ordemInicial + gravados,
      });
      if (res?.erro) { erro = res.mensagem || `Erro ao salvar o cenário ${c.nome}`; break; }
    } catch (e: any) {
      erro = e?.message || `Erro ao salvar o cenário ${c.nome}`;
      break;
    }
    gravados++;
  }
  return { gravados, ordemLivre: ordemInicial + gravados, pendentes: rascunho.slice(gravados), erro };
}

// Visão do investidor — agregados puros (sem lit/html) do card da
// Análise Financeira do Avançado. Sempre do projeto inteiro.
//
// Escolhas de desenho:
// - O app NÃO modela capital próprio do incorporador. Por isso o Yield usa a
//   exposição máxima de caixa como denominador (o capital que o projeto de fato
//   precisou) e, como numerador, o Fluxo de Caixa Livre — desalavancado, a mesma
//   base da TIR/VPL/Payback.
// - A duração do Yield é o horizonte OPERACIONAL do fluxo livre: do mês 0 até o
//   último mês com fluxo livre ≠ 0. O motor estende o horizonte até a quitação
//   do funding, o que acrescenta zeros no fim; contá-los faria criar ou alongar
//   uma dívida reduzir o Yield, contra a base desalavancada.
// - Equity é allowlist (`tipo === 'equity'`); antecipação de recebíveis nunca
//   entra em nada aqui.
// - Denominador ≤ 0 devolve `null`, NUNCA 0%: zero seria um resultado falso.
// - Percentuais e múltiplos saem com precisão plena; arredondar é só para exibir.

import { type FundingCalc, type SerieOperacao, eDivida } from './funding-motor.js';

export interface LtvOperacao {
  nome: string;
  tipo: 'divida' | 'financiamento_producao';
  principal: number;
  ltvPct: number | null;
}

export interface VisaoInvestidor {
  /** Σ saídas equity ÷ Σ entradas equity; null se Σ entradas ≤ 0. */
  equityMultiple: number | null;
  aportesEquity: number;
  retornoEquity: number;
  /** Yield anualizado sobre a exposição máxima, em %; null sem denominador. */
  yieldPct: number | null;
  ltvs: LtvOperacao[];
}

export interface EntradaVisaoInvestidor {
  funding: FundingCalc | null | undefined;
  fluxoLivreMensal: number[];
  exposicaoMaxima: number;
  vgvTotal: number;
}

const soma = (v: number[] | undefined): number =>
  (v ?? []).reduce((a, x) => a + x, 0);

export function visaoInvestidor(entrada: EntradaVisaoInvestidor): VisaoInvestidor {
  const series: SerieOperacao[] = entrada.funding?.operacoes ?? [];
  const equities = series.filter((s) => s.operacao.tipo === 'equity');
  const aportesEquity = equities.reduce((a, s) => a + soma(s.entradas), 0);
  const retornoEquity = equities.reduce((a, s) => a + soma(s.saidas), 0);
  // Agregado (Σ ÷ Σ), não média dos múltiplos de cada equity.
  const equityMultiple = aportesEquity > 0 ? retornoEquity / aportesEquity : null;

  let meses = entrada.fluxoLivreMensal.length;
  while (meses > 0 && entrada.fluxoLivreMensal[meses - 1] === 0) meses--;
  const exposicao = Math.abs(entrada.exposicaoMaxima);
  // O motor entrega exposição ≤ 0 (piso em zero): 0 significa que não há base.
  const yieldPct =
    meses > 0 && entrada.exposicaoMaxima < 0 && exposicao > 0
      ? (soma(entrada.fluxoLivreMensal) / (meses / 12) / exposicao) * 100
      : null;

  const ltvs: LtvOperacao[] = [];
  for (const s of series) {
    const tipo = s.operacao.tipo;
    if (!eDivida(tipo)) continue;
    const principal = soma(s.entradas);
    ltvs.push({
      nome: s.operacao.nome || (tipo === 'divida' ? 'Dívida' : 'Financiamento à produção'),
      tipo: tipo as 'divida' | 'financiamento_producao',
      principal,
      ltvPct: entrada.vgvTotal > 0 ? (principal / entrada.vgvTotal) * 100 : null,
    });
  }
  return { equityMultiple, aportesEquity, retornoEquity, yieldPct, ltvs };
}

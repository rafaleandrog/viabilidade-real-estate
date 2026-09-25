// Consumo do colchão, alerta de cenário inviável e a regra da baixa alavanca
// (Rodada 13, handoff §4.6.D e §4.6.E — issue #734). Módulo PURO, sem Lit e
// sem DOM: é a ligação que "transforma a aba de descritiva em decisória" —
// relaciona o ESTRESSE aplicado pelo cenário Bear com a FOLGA que a margem de
// segurança mediu para a mesma premissa, e diz em palavras o que isso
// significa.
//
// As duas pontas vêm de módulos diferentes — o estresse da tela (o passo do
// benchmark, assinado no sentido desfavorável) e `folgaPct` de
// `frontend/margem-seguranca.ts` (assinado no sentido em que o resultado
// zera) — e é aí que a unidade se perde: os dois são percentuais ASSINADOS
// sobre a MESMA premissa, e a divisão é feita em módulo. Está escrito no
// código, não confiado à leitura.

import type { MargemDeSeguranca } from './margem-seguranca.js';
import { fmtVariacao } from './cenario-variacao.js';
import { fmtPct } from './viab-format.js';

/**
 * Abaixo disto (variação ±X do resultado, `Alavanca.amplitudePct`) a premissa
 * é de BAIXA ALAVANCA: o resultado é insensível a ela neste projeto, e a tela
 * diz isso em vez de deixar o usuário concluir sozinho a partir de três
 * colunas quase idênticas (§4.6.E). Constante nomeada, nunca um número solto
 * no meio do template.
 */
export const LIMIAR_BAIXA_ALAVANCA_PCT = 2;

export interface ConsumoColchao {
  /** `estresse ÷ folga`, em %, os dois em módulo. */
  consumoPct: number;
  /** O estresse do Bear já passa da folga: o cenário Bear é inviável (resultado ≤ 0). */
  inviavel: boolean;
}

/**
 * `null` quando NÃO há colchão para consumir — `folgaPct === null` (sem raiz
 * no intervalo) ou folga zero. Dividir por `null` coagido a 0 devolveria
 * `Infinity`, e `Infinity` formatado vira um número que parece medido.
 */
export function consumoDoColchao(estressePct: number, folgaPct: number | null): ConsumoColchao | null {
  if (folgaPct === null || !Number.isFinite(folgaPct) || !Number.isFinite(estressePct)) return null;
  const folga = Math.abs(folgaPct);
  if (folga < 1e-9) return null;
  const consumoPct = (Math.abs(estressePct) / folga) * 100;
  return { consumoPct, inviavel: consumoPct > 100 };
}

/** Regra da baixa alavanca: `null` (sem denominador legível) não é baixa alavanca — é "não medido". */
export function ehBaixaAlavanca(amplitudePct: number | null): boolean {
  return amplitudePct !== null && Math.abs(amplitudePct) < LIMIAR_BAIXA_ALAVANCA_PCT;
}

/** "o Bear consome 25% do colchão disponível" / "o cenário Bear já é inviável". */
export function textoConsumo(c: ConsumoColchao | null, estressePct: number): string {
  if (c === null) return 'Não há colchão a consumir: o resultado não zera dentro da faixa de estresse desta premissa.';
  const consumo = fmtPct(c.consumoPct);
  if (c.inviavel) {
    return `O cenário Bear (${fmtVariacao(estressePct)}) já é inviável: ele consome ${consumo} do colchão — mais do que a premissa suporta antes de o resultado zerar.`;
  }
  return `O cenário Bear (${fmtVariacao(estressePct)}) consome ${consumo} do colchão disponível.`;
}

/** As duas perguntas do ponto de equilíbrio: até zerar, e até a margem-alvo. */
export function textoPontoDeEquilibrio(m: MargemDeSeguranca, margemAlvoPct: number): string {
  const equilibrio = m.folgaPct === null
    ? (m.resultadoSemprePositivo
      ? 'o resultado é positivo em toda a faixa de estresse'
      : 'o resultado não zera em nenhum ponto da faixa de estresse')
    : `pode errar ${fmtVariacao(m.folgaPct)} até o resultado zerar`;
  const alvo = m.fatorAlvo !== null
    ? `${fmtVariacao((m.fatorAlvo - 1) * 100)} até a margem-alvo de ${fmtPct(margemAlvoPct)}`
    : m.alvoSempreAtingido
      ? `já atinge a margem-alvo de ${fmtPct(margemAlvoPct)} em toda a faixa`
      : `não atinge a margem-alvo de ${fmtPct(margemAlvoPct)} em nenhum ponto da faixa`;
  return `Ponto de equilíbrio: ${equilibrio}; ${alvo}.`;
}

export const TEXTO_BAIXA_ALAVANCA = 'Variável de baixa alavanca — o resultado é insensível a esta premissa neste projeto.';
export const TEXTO_CIRCULAR = 'Base de cálculo circular — esta premissa é orçada como % do VGV, que o próprio preço estressado move junto; estressá-la não mede nada isolado, e por isso ela fica fora do ranking do tornado.';

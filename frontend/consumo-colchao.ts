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
 * Abaixo disto a premissa é de BAIXA ALAVANCA: o resultado é insensível a ela
 * neste projeto, e a tela diz isso em vez de deixar o usuário concluir
 * sozinho a partir de três colunas quase idênticas (§4.6.E). Mede a AMPLITUDE
 * TOTAL do resultado — (bull − bear) sobre o resultado base, em % — e não a
 * metade ±X que `Alavanca.amplitudePct` guarda (a conversão é de
 * `ehBaixaAlavanca`). Constante nomeada, nunca um número solto no template.
 */
export const LIMIAR_BAIXA_ALAVANCA_PCT = 2;

export interface ConsumoColchao {
  /**
   * `estresse ÷ folga`, em %, os dois em módulo — só quando a folga está do
   * MESMO lado do estresse. `null` no estado `baseDeficitaria`.
   */
  consumoPct: number | null;
  /** O cenário Bear é inviável (resultado ≤ 0): consumo acima de 100%, ou base já deficitária. */
  inviavel: boolean;
  /**
   * A raiz do equilíbrio está do lado FAVORÁVEL: o resultado já é negativo na
   * base e só zera se a premissa MELHORAR — o Bear a piora. Não há colchão a
   * consumir, e dividir em módulo publicaria um "consumo" que não existe
   * (achado do Kimi, PR 776, rodada 1).
   */
  baseDeficitaria: boolean;
  /** A folga que a margem de segurança mediu, assinada, para o texto citar. */
  folgaPct: number;
}

/**
 * `null` quando NÃO há colchão para medir — `folgaPct === null` (sem raiz no
 * intervalo) ou folga zero. Dividir por `null` coagido a 0 devolveria
 * `Infinity`, e `Infinity` formatado vira um número que parece medido.
 *
 * Os dois argumentos são percentuais ASSINADOS sobre a mesma premissa, no
 * sentido em que a tela os produz: `estressePct` é o Bear (negativo para o
 * preço, positivo para custo-like) e `folgaPct = (fatorEquilibrio − 1) × 100`.
 * Sinais IGUAIS ⇒ o Bear caminha para o equilíbrio, e o consumo é a razão
 * dos módulos. Sinais OPOSTOS ⇒ base deficitária: não há colchão.
 */
export function consumoDoColchao(estressePct: number, folgaPct: number | null): ConsumoColchao | null {
  if (folgaPct === null || !Number.isFinite(folgaPct) || !Number.isFinite(estressePct)) return null;
  if (Math.abs(folgaPct) < 1e-9) return null;
  if (Math.sign(estressePct) !== Math.sign(folgaPct)) {
    return { consumoPct: null, inviavel: true, baseDeficitaria: true, folgaPct };
  }
  const consumoPct = (Math.abs(estressePct) / Math.abs(folgaPct)) * 100;
  return { consumoPct, inviavel: consumoPct > 100, baseDeficitaria: false, folgaPct };
}

/**
 * Regra da baixa alavanca sobre `Alavanca.amplitudePct` (±X, a METADE da
 * amplitude): a amplitude total é `2·|±X|`. `null` (sem denominador legível)
 * não é baixa alavanca — é "não medido".
 */
export function ehBaixaAlavanca(amplitudePctMetade: number | null): boolean {
  return amplitudePctMetade !== null && 2 * Math.abs(amplitudePctMetade) < LIMIAR_BAIXA_ALAVANCA_PCT;
}

/** "o Bear consome 25% do colchão disponível" / "o cenário Bear já é inviável". */
export function textoConsumo(c: ConsumoColchao | null, estressePct: number): string {
  if (c === null) return 'Não há colchão a consumir: o resultado não zera dentro da faixa de estresse desta premissa.';
  if (c.baseDeficitaria) {
    return `O resultado já é negativo na base: esta premissa precisaria melhorar ${fmtVariacao(c.folgaPct)} para o resultado zerar, e o cenário Bear (${fmtVariacao(estressePct)}) a piora — não há colchão, o Bear já é inviável.`;
  }
  const consumo = fmtPct(c.consumoPct as number);
  if (c.inviavel) {
    return `O cenário Bear (${fmtVariacao(estressePct)}) já é inviável: ele consome ${consumo} do colchão — mais do que a premissa suporta antes de o resultado zerar.`;
  }
  return `O cenário Bear (${fmtVariacao(estressePct)}) consome ${consumo} do colchão disponível.`;
}

/** As duas perguntas do ponto de equilíbrio: até zerar, e até a margem-alvo. */
export function textoPontoDeEquilibrio(m: MargemDeSeguranca, margemAlvoPct: number, custoLike: boolean): string {
  // A folga é assinada: para o preço, negativa é "pode cair"; para custo-like,
  // positiva é "pode subir". No sentido FAVORÁVEL (preço que precisa subir,
  // custo que precisa cair) não é folga — é o quanto a premissa precisa
  // melhorar para o resultado zerar (base deficitária).
  const desfavoravel = (folga: number) => (custoLike ? folga > 0 : folga < 0);
  const equilibrio = m.folgaPct === null
    ? (m.resultadoSemprePositivo
      ? 'o resultado é positivo em toda a faixa de estresse'
      : 'o resultado não zera em nenhum ponto da faixa de estresse')
    : desfavoravel(m.folgaPct)
      ? `pode errar ${fmtVariacao(m.folgaPct)} até o resultado zerar`
      : `precisa melhorar ${fmtVariacao(m.folgaPct)} para o resultado zerar (já é negativo na base)`;
  const alvo = m.fatorAlvo !== null
    ? `${fmtVariacao((m.fatorAlvo - 1) * 100)} até a margem-alvo de ${fmtPct(margemAlvoPct)}`
    : m.alvoSempreAtingido
      ? `já atinge a margem-alvo de ${fmtPct(margemAlvoPct)} em toda a faixa`
      : `não atinge a margem-alvo de ${fmtPct(margemAlvoPct)} em nenhum ponto da faixa`;
  return `Ponto de equilíbrio: ${equilibrio}; ${alvo}.`;
}

export const TEXTO_BAIXA_ALAVANCA = 'Variável de baixa alavanca — o resultado é insensível a esta premissa neste projeto.';
export const TEXTO_CIRCULAR = 'Base de cálculo circular — esta premissa é orçada como % do VGV, que o próprio preço estressado move junto; estressá-la não mede nada isolado, e por isso ela fica fora do ranking do tornado.';

// Cor de cada tipo de operação de funding — UMA tabela para a tela inteira.
//
// O `urbi-badge` do cartão usa a cor pela prop `cor="variante_N"`; o CSS próprio
// (a faixa do cartão e, na aba Estrutura de capital, a camada do stack) usa o
// token `--cor-categoria-N` pela paleta categórica, `corCategorica(N − 1)`. Os
// dois saem do MESMO N, então o badge e a camada nunca contam cores diferentes
// para o mesmo tipo.
//
// O Financiamento à produção não tem cartão, mas tem camada no stack: entra na
// tabela com a cor dele. A antecipação é uma terceira categoria, com cor
// própria, entre as dívidas e o equity.

import type { TipoOperacao } from './funding-motor.js';
import { corCategorica } from './paleta-categorica.js';

/** Posição 1–8 da cor de categoria de cada tipo. Os quatro N são distintos. */
export const COR_DO_TIPO: Readonly<Record<TipoOperacao, number>> = {
  financiamento_producao: 1,
  divida: 2,
  antecipacao_recebiveis: 3,
  equity: 4,
};

/**
 * O incorporador não é operação, mas tem camada no topo do stack: o quinto N,
 * distinto dos quatro tipos.
 */
export const COR_DO_INCORPORADOR = 5;

/** N do tipo; tipo desconhecido cai numa posição que nenhum tipo conhecido usa. */
export function numeroDaCor(tipo: string): number {
  if (tipo === 'incorporador') return COR_DO_INCORPORADOR;
  return (COR_DO_TIPO as Record<string, number>)[tipo] ?? 8;
}

/** Valor da prop `cor` do `urbi-badge` (`variante_1` a `variante_8`). */
export function varianteDoBadge(tipo: string): string {
  return `variante_${numeroDaCor(tipo)}`;
}

/** Cor CSS do tipo (`var(--cor-categoria-N)`), para marcação própria. */
export function corDoTipo(tipo: string): string {
  return corCategorica(numeroDaCor(tipo) - 1);
}

// As variáveis que a aba Cenários do Preliminar deixa estressar, com o rótulo
// e o sentido de "favorável" de cada uma. Puro, sem Lit e sem DOM — a tela
// consome estas funções, não reimplementa a regra.

import type { VariavelSensibilidade } from './proforma.js';

/** Rótulo único por variável — a mesma tabela em todo o app, para não haver
 * dois nomes para a mesma premissa. */
export function rotuloAlavanca(variavel: VariavelSensibilidade, lot: boolean): string {
  switch (variavel) {
    case 'preco': return lot ? 'Preço/m² de venda' : 'Preço de venda';
    case 'permuta_fisica': return 'Permuta física';
    case 'permuta_financeira': return 'Permuta financeira';
    case 'custo_infra': return 'Custo de infraestrutura';
    case 'custo_obras': return 'Custo de obra';
    case 'custo_terreno': return 'Custo do terreno';
    case 'custo_indireto': return 'Custo indireto';
  }
}

/**
 * Sentido de "favorável" de cada variável: para o preço, favorável é subir;
 * para toda variável "custo-like" (as demais), favorável é descer — o Bull de
 * um custo é uma REDUÇÃO (bug #13).
 */
export function ehCustoLike(variavel: VariavelSensibilidade): boolean {
  return variavel !== 'preco';
}

/**
 * As opções do seletor "Variável estressada", na ordem em que aparecem.
 * Loteamento estressa o custo de infraestrutura; Incorporação, o de obra —
 * as duas nunca aparecem juntas.
 */
export function variaveisSensibilidade(lot: boolean): VariavelSensibilidade[] {
  return ['preco', lot ? 'custo_infra' : 'custo_obras', 'custo_indireto', 'custo_terreno', 'permuta_fisica', 'permuta_financeira'];
}

// Motor do tornado de alavancas (Rodada 13, handoff §4.2 — issue #727).
// Puro, sem Lit e sem DOM: para cada premissa estressável, recalcula a
// Proforma a −passo e +passo e mede a variação do Resultado, ranqueando por
// amplitude decrescente. Substitui a escolha às cegas do dropdown antigo por
// um ranking medido.

import { calcularProforma, type ProformaInput, type Proforma, type VariavelSensibilidade } from './proforma.js';

export interface Alavanca {
  variavel: VariavelSensibilidade;
  rotulo: string;
  resultadoBear: number;
  resultadoBull: number;
  resultadoBase: number;
  /** |bull − bear|, em R$ — sempre definida, é o eixo da ordenação. */
  amplitudeRS: number;
  /**
   * Variação percentual do resultado, ±X: metade da amplitude sobre o
   * resultado base. `null` quando `|resultadoBase|` não serve de denominador
   * (menor que 0,5% da receita líquida) — nunca um percentual de 4 dígitos.
   */
  amplitudePct: number | null;
  /**
   * Base de cálculo circular (§4.6.E): a premissa é orçada como % do VGV, que
   * o próprio preço estressado move junto — estressá-la não mede nada
   * isolado. O motor INFORMA a marca; excluir do desenho é decisão de quem
   * desenha (o componente), nunca do motor.
   */
  circular: boolean;
}

/** Rótulo único por variável — a mesma tabela que a tela consome, para não
 * haver dois nomes para a mesma alavanca no app (handoff §5, regra 7). */
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
 * Sentido de "favorável" de cada variável, extraído de
 * `frontend/tela-proforma.ts` (antigo `_renderSensibilidade`): para o preço,
 * favorável é subir; para toda variável "custo-like" (as demais), favorável é
 * descer. Uma cópia só — a tela consome esta função, não reimplementa a regra.
 */
export function ehCustoLike(variavel: VariavelSensibilidade): boolean {
  return variavel !== 'preco';
}

// As 5 alavancas que o tornado desenha (handoff, imagem anexada pelo autor):
// Preço de venda, Custo de obra/infra, Permuta física, Permuta financeira,
// Custo indireto. `custo_terreno` fica de fora do tornado por decisão do
// autor (issue #725) — ele é estressável no motor, mas a leitura de "Terreno
// máximo" da margem de segurança sai por fórmula fechada, não por ranking.
function variaveisDoTornado(lot: boolean): VariavelSensibilidade[] {
  return ['preco', 'permuta_fisica', 'permuta_financeira', lot ? 'custo_infra' : 'custo_obras', 'custo_indireto'];
}

export function rankearAlavancas(
  entrada: ProformaInput,
  passoPct: number,
  lot: boolean,
  calcular: (e: ProformaInput) => Proforma = calcularProforma,
): Alavanca[] {
  const base = calcular(entrada);
  const resultadoBase = base.resultado;
  // Limiar de 0,5% da receita líquida (issue #727, critério 2): abaixo dele o
  // resultado base não serve de denominador — publicar o percentual seria um
  // número de 4 dígitos sem sentido de leitura.
  const limiar = Math.abs(base.receitaLiquida) * 0.005;

  return variaveisDoTornado(lot).map((variavel): Alavanca => {
    const custoLike = ehCustoLike(variavel);
    const fatorBull = custoLike ? 1 - passoPct / 100 : 1 + passoPct / 100;
    const fatorBear = custoLike ? 1 + passoPct / 100 : 1 - passoPct / 100;
    const resultadoBull = calcular({ ...entrada, sensibilidade: { variavel, fator: fatorBull } }).resultado;
    const resultadoBear = calcular({ ...entrada, sensibilidade: { variavel, fator: fatorBear } }).resultado;
    const amplitudeRS = Math.abs(resultadoBull - resultadoBear);
    // `resultadoBase !== 0` evita divisão por zero quando a receita líquida
    // também é zero (estudo sem catálogo efetivo) — nesse caso o limiar cai
    // para 0 e `> limiar` sozinho deixaria de barrar o caso degenerado.
    const amplitudePct = resultadoBase !== 0 && Math.abs(resultadoBase) > limiar
      ? (amplitudeRS / (2 * Math.abs(resultadoBase))) * 100
      : null;
    const circular = variavel === 'custo_infra' && entrada.infra_modo === 'pct_vgv';
    return {
      variavel, rotulo: rotuloAlavanca(variavel, lot),
      resultadoBear, resultadoBull, resultadoBase, amplitudeRS, amplitudePct, circular,
    };
  }).sort((a, b) => b.amplitudeRS - a.amplitudeRS);
}

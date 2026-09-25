// Cenário composto — as três maiores alavancas estressadas JUNTAS (Rodada 13,
// handoff §4.6.A — issue #735). Módulo PURO, sem Lit e sem DOM.
//
// "Estresse de variável isolada subestima sistematicamente o risco, porque
// na prática as premissas erram juntas." O Bear de uma variável só é otimista
// por construção. Aqui as três alavancas de maior amplitude (entre as NÃO
// circulares) entram ao mesmo tempo — cada uma no sentido desfavorável no
// Bear e favorável no Bull — numa ÚNICA execução do motor com o conjunto de
// fatores (`FatoresSensibilidade`, `frontend/proforma.ts`).
//
// ⚠️ Composição não é soma de efeitos: os custos percentuais sobre o VGV
// fazem os efeitos interagirem, e o resultado composto DIFERE da soma dos
// três deltas isolados. O motor roda com os três juntos; publicar a soma
// seria um número plausível e errado (o teste prova a diferença).

import { calcularProforma, type ProformaInput, type Proforma, type VariavelSensibilidade } from './proforma.js';
import { ehCustoLike, type Alavanca } from './tornado-alavancas.js';

/** Quantas alavancas entram no composto — as três maiores, como o handoff pede. */
export const N_COMPOSTO = 3;

export interface CenarioComposto {
  /** As variáveis estressadas, na ordem do ranking (maior amplitude primeiro). */
  variaveis: VariavelSensibilidade[];
  /** Rótulos das mesmas, para a tela declarar as premissas (§4.6.E: "nenhum cenário altera duas premissas sem declarar ambas"). */
  rotulos: string[];
  resultadoBear: number;
  resultadoBase: number;
  resultadoBull: number;
  amplitudeRS: number;
  /** Os conjuntos de fatores de cada lado — é o que a tela passa ao motor para a tabela Bear/Base/Bull. */
  fatoresBear: Partial<Record<VariavelSensibilidade, number>>;
  fatoresBull: Partial<Record<VariavelSensibilidade, number>>;
}

/** Fatores de um lado para um conjunto de variáveis, cada uma no seu sentido. */
export function fatoresDoLado(
  variaveis: VariavelSensibilidade[], passoPct: number, lado: 'bear' | 'bull',
): Partial<Record<VariavelSensibilidade, number>> {
  const out: Partial<Record<VariavelSensibilidade, number>> = {};
  for (const v of variaveis) {
    const custoLike = ehCustoLike(v);
    // Bear: preço cai, custo-like sobe. Bull: o inverso. Mesmo sentido de
    // `rankearAlavancas` — uma cópia só da regra (`ehCustoLike`).
    const desfavoravel = custoLike ? 1 + passoPct / 100 : 1 - passoPct / 100;
    const favoravel = custoLike ? 1 - passoPct / 100 : 1 + passoPct / 100;
    out[v] = lado === 'bear' ? desfavoravel : favoravel;
  }
  return out;
}

/** As `N_COMPOSTO` alavancas de maior `amplitudeRS` entre as não circulares, na ordem do ranking. */
export function escolherAlavancas(alavancas: Alavanca[], n = N_COMPOSTO): Alavanca[] {
  return [...alavancas]
    .filter((a) => !a.circular)
    .sort((a, b) => b.amplitudeRS - a.amplitudeRS)
    .slice(0, n);
}

/**
 * `null` quando não há ao menos duas alavancas não circulares: "composto" de
 * uma variável só é o cenário isolado dela, e publicá-lo com outro nome seria
 * enganar.
 */
export function cenarioComposto(
  entrada: ProformaInput,
  alavancas: Alavanca[],
  passoPct: number,
  calcular: (e: ProformaInput) => Proforma = calcularProforma,
): CenarioComposto | null {
  const escolhidas = escolherAlavancas(alavancas);
  if (escolhidas.length < 2) return null;
  const variaveis = escolhidas.map((a) => a.variavel);
  const fatoresBear = fatoresDoLado(variaveis, passoPct, 'bear');
  const fatoresBull = fatoresDoLado(variaveis, passoPct, 'bull');
  const resultadoBase = calcular(entrada).resultado;
  const resultadoBear = calcular({ ...entrada, sensibilidade: { fatores: fatoresBear } }).resultado;
  const resultadoBull = calcular({ ...entrada, sensibilidade: { fatores: fatoresBull } }).resultado;
  return {
    variaveis,
    rotulos: escolhidas.map((a) => a.rotulo),
    resultadoBear, resultadoBase, resultadoBull,
    amplitudeRS: Math.abs(resultadoBull - resultadoBear),
    fatoresBear, fatoresBull,
  };
}

/** "−10% Preço de venda · +10% Custo de obra · +10% Permuta física" — o que o cabeçalho declara. */
export function descreverLado(c: CenarioComposto, lado: 'bear' | 'bull', passoPct: number): string {
  return c.variaveis.map((v, i) => {
    const custoLike = ehCustoLike(v);
    const sobe = lado === 'bear' ? custoLike : !custoLike;
    return `${sobe ? '+' : '−'}${passoPct}% ${c.rotulos[i]}`;
  }).join(' · ');
}

/** "Cenário composto (Preço de venda + Custo de obra + Permuta física)". */
export function rotuloComposto(c: CenarioComposto): string {
  return `Cenário composto (${c.rotulos.join(' + ')})`;
}

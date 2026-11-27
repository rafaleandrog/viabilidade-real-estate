// Geometria e texto acessível da torre do capital stack — PUROS, sem lit e sem
// DOM, para o teste de unidade os exercitar sem navegador. Quem desenha é
// `viab-grafico-stack-capital` (`grafico-stack-capital.ts`); aqui só a
// repartição da altura e o nome acessível de cada camada. Nenhuma regra de
// cálculo de funding mora aqui: o valor e o percentual chegam prontos.

import { fmtR$, fmtPct } from './viab-format.js';
import type { CamadaDaTorre } from './funding-estrutura-dados.js';

/** Altura da torre quando as camadas cabem nela (px). */
export const ALTURA_TORRE = 360;
/** Altura mínima de uma camada: uma linha de texto legível (px). */
export const ALTURA_MINIMA_CAMADA = 28;
/** A partir desta altura a camada escreve em duas linhas (px). */
export const ALTURA_DUAS_LINHAS = 46;
/** Separação entre camadas (px). */
export const VAO_CAMADAS = 2;

/**
 * Reparte a altura da torre entre as camadas, proporcional ao valor, com piso
 * `minimo`. O piso só se aplica a quem ficaria ABAIXO dele: as camadas fixadas
 * no piso saem da conta, e o resto é repartido de novo, proporcional, até
 * ninguém mais cair abaixo. Se nem o piso de todas cabe, a torre cresce.
 * Valor ≤ 0 não é camada desenhada: quem chama já o filtrou.
 */
export function alturasDasCamadas(valores: readonly number[], altura: number, minimo: number): number[] {
  const n = valores.length;
  if (n === 0) return [];
  const total = Math.max(altura, n * minimo);
  const fixas = new Array<boolean>(n).fill(false);
  for (;;) {
    const livre = total - fixas.filter(Boolean).length * minimo;
    const somaLivre = valores.reduce((s, v, i) => (fixas[i] ? s : s + v), 0);
    let mudou = false;
    for (let i = 0; i < n; i++) {
      if (fixas[i]) continue;
      if (somaLivre <= 0 || (valores[i] / somaLivre) * livre < minimo) { fixas[i] = true; mudou = true; }
    }
    if (!mudou) {
      return valores.map((v, i) => (fixas[i] ? minimo : (v / somaLivre) * livre));
    }
  }
}

/** Nome acessível da camada: nome, nível, valor exato em 2 casas e a fração. */
export function nomeAcessivelCamada(c: Pick<CamadaDaTorre, 'nome' | 'nivel' | 'valor' | 'pct'>): string {
  const pct = c.pct === null ? '—' : fmtPct(c.pct);
  return `${c.nome}, ${c.nivel}, ${fmtR$(c.valor)}, ${pct} do total das camadas`;
}

// ─────────────────────────────────────────────────────────────────────────
// Variação de um indicador entre o CENÁRIO em avaliação e o CENÁRIO REAL
// (base) — aba Cenários do Avançado (S20 · #132).
//
// Módulo PURO (sem Lit, sem DOM) para que a regra de "melhor × pior" fique
// testável: é ela que decide a seta e a cor exibidas nos KPIs e nos badges da
// tabela de cenários salvos.
//
// A direção NÃO é a do sinal da variação — é a do indicador:
//   · Resultado / VPL / TIR → maior é melhor (`maiorMelhor = true`);
//   · Exposição máxima (#491, 2026-08-24) → lida por MAGNITUDE, não por
//     sinal: o chamador passa os dois valores já em módulo e
//     `maiorMelhor = false` — crescer em módulo é sempre pior (mais
//     dinheiro em risco), independente do sinal que o motor guarda
//     internamente (`fluxo-caixa-motor.ts`, sempre negativo ou zero).
// Por isso `maiorMelhor` é sempre explícito no ponto de uso.
// ─────────────────────────────────────────────────────────────────────────

export interface Variacao {
  /** Variação percentual ASSINADA em relação à base (ex.: -4.2 = caiu 4,2%). */
  pct: number;
  /** true quando o cenário MELHOROU o indicador (verde); false = piorou (vermelho). */
  melhor: boolean;
  /** Rótulo pronto, com sinal explícito: "+12,3%" / "-4,2%". */
  texto: string;
}

/** Abaixo disto a variação arredonda para 0,0% — nada a sinalizar. */
const EPSILON_PCT = 0.05;

/**
 * Variação percentual de `novo` sobre `base`, normalizada pelo MÓDULO da base
 * (senão indicadores negativos — exposição máxima — inverteriam o sinal).
 *
 * Devolve `null` quando não há o que exibir: valores não-finitos, base zerada
 * (sem denominador possível) ou variação desprezível.
 */
export function calcularVariacao(
  novo: number | null,
  base: number | null,
  maiorMelhor: boolean,
): Variacao | null {
  if (novo == null || base == null) return null;
  if (!Number.isFinite(novo) || !Number.isFinite(base)) return null;
  if (Math.abs(base) < 1e-9) return null;

  const pct = ((novo - base) / Math.abs(base)) * 100;
  if (Math.abs(pct) < EPSILON_PCT) return null;

  const subiu = novo > base;
  return { pct, melhor: maiorMelhor ? subiu : !subiu, texto: fmtVariacao(pct) };
}

/** "+12,3%" / "-4,2%" — 1 casa decimal, vírgula pt-BR, sinal sempre visível. */
export function fmtVariacao(pct: number): string {
  const abs = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(Math.abs(pct));
  return `${pct < 0 ? '-' : '+'}${abs}%`;
}

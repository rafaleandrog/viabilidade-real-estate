// O que a tela de benchmarks semeia ao abrir (por quem pode escrever).
//
// - Lista vazia (instalação nova): todos os indicadores padrão.
// - Lista com itens, mas sem `velocidade` (#971, sensibilidade da velocidade
//   de vendas dos Cenários do Avançado, que chegou depois): só ela. Semear tudo
//   traria de volta indicador padrão que o admin apagou de propósito.
// - Senão, nada.

/** Indicadores padrão que uma instalação antiga ganha mesmo com a lista já preenchida. */
export const CAMPOS_SEMEADOS_EM_INSTALACAO_EXISTENTE = ['velocidade'] as const;

/** `null` = nada a semear; `{}` = todos; `{ campos }` = só esses. */
export function semeaduraNecessaria(itens: { campo?: unknown }[]): { campos?: string[] } | null {
  if (!itens || itens.length === 0) return {};
  const tem = new Set(itens.map((b) => String(b?.campo)));
  const faltam = CAMPOS_SEMEADOS_EM_INSTALACAO_EXISTENTE.filter((c) => !tem.has(c));
  return faltam.length ? { campos: [...faltam] } : null;
}

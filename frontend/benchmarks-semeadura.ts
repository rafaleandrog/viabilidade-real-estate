// O que a tela de benchmarks semeia ao abrir (por quem pode escrever).
//
// - Lista vazia (instalação nova): todos os indicadores padrão, nos dois tipos
//   (é o semear de sempre).
// - Na PRIMEIRA carga da tela, lista com itens mas sem `velocidade` (#971,
//   sensibilidade da velocidade de vendas dos Cenários do Avançado, que chegou
//   depois): só ela. Semear tudo traria de volta os outros indicadores padrão
//   apagados. Só na primeira carga porque a tela recarrega depois de Remover, e a
//   recarga não pode desfazer a remoção; na próxima abertura da tela, um
//   `velocidade` apagado volta, com ±15% — o mesmo que os Cenários usam sem ele.
// - Senão, nada.

/** Indicadores padrão que uma instalação antiga ganha mesmo com a lista já preenchida. */
export const CAMPOS_SEMEADOS_EM_INSTALACAO_EXISTENTE = ['velocidade'] as const;

/** `null` = nada a semear; `{}` = todos; `{ campos }` = só esses. */
export function semeaduraNecessaria(itens: { campo?: unknown }[], primeiraCarga: boolean): { campos?: string[] } | null {
  if (!itens || itens.length === 0) return {};
  if (!primeiraCarga) return null;
  const tem = new Set(itens.map((b) => String(b?.campo)));
  const faltam = CAMPOS_SEMEADOS_EM_INSTALACAO_EXISTENTE.filter((c) => !tem.has(c));
  return faltam.length ? { campos: [...faltam] } : null;
}

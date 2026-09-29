// Paleta categórica compartilhada — 12 posições, mesma origem de
// `tela-graficos.ts:PALETA_CUSTOS` (#476 / decisão D15 do autor, 2026-08-22):
// tokens do tema (`--cor-categoria-1..8`, `--cor-escala-1..4`) com o
// hexadecimal que ocupava cada posição como fallback, para não perder a
// aparência num shell sem esses tokens.
//
// Extraída para módulo próprio na Rodada 12 (handoff de KPIs/gráficos), para
// os componentes novos (`grafico-barra-ranqueada.ts`, `grafico-cadeia-areas.ts`)
// usarem a MESMA paleta que a pizza de custos já usa, sem duplicar os 12
// tokens numa terceira cópia. `tela-graficos.ts` continua com a sua cópia
// local por ora — convergir os dois é assunto da PR que remover a pizza.

export const PALETA_CATEGORICA: readonly string[] = [
  'var(--cor-categoria-1)', 'var(--cor-categoria-2)',
  'var(--cor-categoria-3)', 'var(--cor-categoria-4)',
  'var(--cor-categoria-5)', 'var(--cor-categoria-6)',
  'var(--cor-categoria-7)', 'var(--cor-categoria-8)',
  'var(--cor-escala-1)', 'var(--cor-escala-2)',
  'var(--cor-escala-3)', 'var(--cor-escala-4)',
];

/** Cor categórica na posição `i`, ciclando quando `i >= PALETA_CATEGORICA.length`. */
export function corCategorica(i: number): string {
  return PALETA_CATEGORICA[i % PALETA_CATEGORICA.length];
}

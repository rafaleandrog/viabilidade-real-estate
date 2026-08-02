// Formatadores compartilhados (pt-BR).
//
// Números usam sempre "." como separador de milhar (Intl pt-BR) — inclusive
// dentro de R$ e m² (bug #1). Porcentagens (bug #5):
//   - fmtPct       → valor CALCULADO: uma casa decimal ("xx,x%").
//   - fmtPctEntrada→ valor de ENTRADA/config: duas casas decimais ("xx,xx%").
//
// #281: R$ sempre com 2 casas decimais — contrato C7 (decisão do autor,
// 2026-08-01: "todo valor monetário resultado de fórmula tem 2 casas
// decimais... na apresentação"). Antes eram 0 casas aqui e 2 em
// `exportar.ts:9` — o mesmo estudo mostrava números diferentes em tela e em
// CSV/PDF.
export const fmtR$ = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);

// Porcentagem calculada (resultado de conta): 1 casa decimal, vírgula.
export const fmtPct = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v || 0)}%`;

// Porcentagem digitada pelo usuário / benchmark: 2 casas decimais, vírgula.
export const fmtPctEntrada = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}%`;

// Interpreta um número no formato pt-BR digitado pelo usuário: "." é separador
// de milhar (descartado) e "," é o separador decimal. Vazio/inválido → null.
export function parseNumeroBR(bruto: string | null | undefined): number | null {
  if (bruto == null) return null;
  const s = String(bruto).trim();
  if (s === '') return null;
  const limpo = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (limpo === '' || limpo === '-' || limpo === '.' || limpo === '-.') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

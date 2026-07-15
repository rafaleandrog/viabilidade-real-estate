// Formatadores compartilhados (pt-BR).
//
// Números usam sempre "." como separador de milhar (Intl pt-BR) — inclusive
// dentro de R$ e m² (bug #1). Porcentagens (bug #5):
//   - fmtPct       → valor CALCULADO: uma casa decimal ("xx,x%").
//   - fmtPctEntrada→ valor de ENTRADA/config: duas casas decimais ("xx,xx%").
export const fmtR$ = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);

// Porcentagem calculada (resultado de conta): 1 casa decimal, vírgula.
export const fmtPct = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v || 0)}%`;

// Porcentagem digitada pelo usuário / benchmark: 2 casas decimais, vírgula.
export const fmtPctEntrada = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}%`;

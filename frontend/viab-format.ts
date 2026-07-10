// Formatadores compartilhados (pt-BR).
export const fmtR$ = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);
export const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

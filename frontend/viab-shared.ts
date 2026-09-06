// Constantes e rótulos compartilhados do app `viabilidade`.
// (O antigo `estilosBase` — mini design-system artesanal — foi removido:
// a UI usa os primitivos urbi-* e os tokens do shell. Ver frontend/estilos.ts.)

export const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  arquivado: 'Arquivado',
};

export const TIPO_LABEL: Record<string, string> = {
  loteamento: 'Loteamento',
  incorporacao: 'Incorporação',
};

export const NIVEL_LABEL: Record<string, string> = {
  preliminar: 'Preliminar',
  avancado: 'Avançado',
};

// Cor semântica da badge (variante nativa do <urbi-badge>) por status.
export type CorBadge = 'padrao' | 'sucesso' | 'perigo' | 'alerta' | 'info';
export const COR_STATUS: Record<string, CorBadge> = {
  rascunho: 'padrao',
  em_analise: 'info',
  aprovado: 'sucesso',
  reprovado: 'perigo',
  arquivado: 'padrao',
};

// Cor semântica da badge por nível de análise — mapa único (#675): Preliminar
// é amarelo (`alerta`) nos dois lugares que a exibem (Painel e cabeçalho do
// estudo), nunca cinza (`padrao`).
export const COR_NIVEL: Record<string, CorBadge> = {
  preliminar: 'alerta',
  avancado: 'info',
};

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

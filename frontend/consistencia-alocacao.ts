// Estado da consistência de área alocada, para a aba Gráficos do Preliminar.
// Usa a MESMA função e a MESMA tolerância de Premissas (`estadoDoRestante`,
// `TOLERANCIA_SOMA_PCT_ALV` em `produtos-alv.ts`), aplicadas ao restante em
// pontos percentuais da base — assim três produtos a 33,3333% não são
// "completos" numa tela e "faltam 0,30 m²" na outra.

import { estadoDoRestante, type EstadoAlocacaoAlv } from './produtos-alv.js';

/**
 * `pctAreaAlocada`: % da base já alocada (null sem base). `diferencaAreaAlocada`:
 * m² alocados − base. Sem base não há % para comparar com a tolerância, então
 * vale o sinal da diferença.
 */
export function estadoConsistenciaAlocacao(
  pctAreaAlocada: number | null, diferencaAreaAlocada: number,
): EstadoAlocacaoAlv {
  if (pctAreaAlocada !== null) return estadoDoRestante(100 - pctAreaAlocada);
  if (diferencaAreaAlocada > 0) return 'excesso';
  if (diferencaAreaAlocada < 0) return 'falta';
  return 'completa';
}

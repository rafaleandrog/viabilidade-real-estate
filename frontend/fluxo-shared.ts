// Helpers puros de calendário do Fluxo de Caixa (nível Avançado).
// Sem DOM, cobertos por testes unitários (fluxo-shared.test.ts).
//
// Convenção de tempo: o fluxo é indexado em meses RELATIVOS 1-based — o mês 1
// é o mês de `data_inicio_projeto` ("mmm/AAAA", ex.: "jan/2027").

export const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface MesAno { mes: number; ano: number } // mes 0-based (0 = jan)

/** Interpreta "mmm/AAAA" (pt-BR, case-insensitive). Retorna null se inválido. */
export function parseMesAno(texto: string | null | undefined): MesAno | null {
  if (!texto) return null;
  const m = /^([a-zç]{3})\/(\d{4})$/i.exec(String(texto).trim().toLowerCase());
  if (!m) return null;
  const mes = MESES_ABREV.indexOf(m[1]);
  if (mes < 0) return null;
  return { mes, ano: Number(m[2]) };
}

/** Formata um MesAno como "mmm/AAAA". */
export function formatarMesAno(v: MesAno): string {
  return `${MESES_ABREV[v.mes]}/${v.ano}`;
}

/**
 * Rótulo curto do mês relativo `mesRel` (1-based) a partir de `dataInicio`
 * ("mmm/AAAA"). Ex.: dataInicio "jan/2027", mesRel 13 → "jan/28".
 * Sem data de início válida, degrada para "M13".
 */
export function rotuloMesRelativo(dataInicio: string | null | undefined, mesRel: number): string {
  const p = parseMesAno(dataInicio);
  if (!p) return `M${mesRel}`;
  const total = p.ano * 12 + p.mes + (mesRel - 1);
  const ano = Math.floor(total / 12);
  const mes = total % 12;
  return `${MESES_ABREV[mes]}/${String(ano).slice(2)}`;
}

/** Rótulo longo "mmm/AAAA" do mês relativo (ou null sem data de início). */
export function mesRelativoCompleto(dataInicio: string | null | undefined, mesRel: number): string | null {
  const p = parseMesAno(dataInicio);
  if (!p) return null;
  const total = p.ano * 12 + p.mes + (mesRel - 1);
  return formatarMesAno({ mes: total % 12, ano: Math.floor(total / 12) });
}

/** Período "jan/27 → dez/27 (12m)" de um evento com início e duração relativos. */
export function rotuloPeriodo(dataInicio: string | null | undefined, inicioMes: number, duracaoMeses: number): string {
  const ini = rotuloMesRelativo(dataInicio, inicioMes);
  if (duracaoMeses <= 1) return `${ini} (1m)`;
  const fim = rotuloMesRelativo(dataInicio, inicioMes + duracaoMeses - 1);
  return `${ini} → ${fim} (${duracaoMeses}m)`;
}

// Rótulos e cores (tokens do shell, com fallback) dos eventos do cronograma.
export const EVENTO_LABEL: Record<string, string> = {
  planejamento: 'Planejamento',
  pre_lancamento: 'Pré-lançamento',
  lancamento: 'Lançamento',
  obra: 'Obra',
  pos_obra: 'Pós-obra',
};

export const EVENTO_COR: Record<string, string> = {
  planejamento: 'var(--cor-info, #2aa9e0)',
  pre_lancamento: 'var(--cor-alerta, #e0a82a)',
  lancamento: 'var(--cor-sucesso, #13a98d)',
  obra: 'var(--cor-primaria-solida, #7a5af8)',
  pos_obra: 'var(--cor-texto-sec, #8a8f98)',
};

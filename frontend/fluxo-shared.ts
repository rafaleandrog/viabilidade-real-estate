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

// ─────────────────────────────────────────────────────────────────
// Absorção de vendas e VGV (puros — reutilizados pelo motor do fluxo)
// ─────────────────────────────────────────────────────────────────

export interface EventoCrono {
  evento: string;
  inicio_mes: number;
  duracao_meses: number;
}

const n = (v: any): number => Number(v) || 0;

/** VGV de uma tipologia: quantidade × área privativa × preço/m². */
export function vgvTipologia(t: any): number {
  return n(t?.quantidade) * n(t?.area_privativa_m2) * n(t?.preco_m2);
}

/** VGV de uma linha de receita (soma das tipologias). */
export function vgvLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + vgvTipologia(t), 0);
}

/**
 * VGL (Valor Geral Líquido) da linha: VGV líquido de comissão DESTACADA e de
 * RET, conforme o fluxo de pagamento. Comissão embutida já está no preço e
 * não deduz.
 */
export function vglLinha(vgv: number, fluxoPagamento: any): number {
  const fp = fluxoPagamento ?? {};
  let liquido = vgv;
  if (fp.comissao?.ativo && fp.comissao?.tipo === 'destacada') liquido -= vgv * (n(fp.comissao.pct) / 100);
  if (fp.ret?.ativo) liquido -= vgv * (n(fp.ret.pct) / 100);
  return liquido;
}

/**
 * Período de absorção de uma linha: do início do Lançamento até o fim da
 * Pós-obra (a duração da pós-obra pode ser sobrescrita pelo bloco de absorção).
 * Retorna null se o cronograma não tiver os eventos necessários.
 */
export function periodoAbsorcao(
  crono: EventoCrono[],
  posObraMeses?: number,
): { inicio: number; fim: number } | null {
  const lanc = crono.find((e) => e.evento === 'lancamento');
  const pos = crono.find((e) => e.evento === 'pos_obra');
  if (!lanc || !pos) return null;
  const durPos = Math.max(1, Math.round(posObraMeses ?? n(pos.duracao_meses)));
  return { inicio: n(lanc.inicio_mes), fim: n(pos.inicio_mes) + durPos - 1 };
}

/**
 * Distribui a absorção (% de vendas) mês a mês, em meses RELATIVOS do projeto.
 * Retorna { inicio, pcts } onde pcts[i] é o % vendido no mês (inicio + i),
 * ou null se o cronograma for insuficiente.
 *
 * - linear: uniforme por todo o período de absorção
 * - distribuido: cada bloco (lancamento / obra / pos_obra) espalha seu % pelos
 *   meses do próprio evento (pós-obra usa duracao_meses do bloco, se houver)
 * - personalizado: usa absorcao.meses = [{ mes (relativo), pct }]
 */
export function absorcaoMensal(
  absorcao: any,
  crono: EventoCrono[],
): { inicio: number; pcts: number[] } | null {
  const modo = absorcao?.modo ?? 'linear';
  const blocoPos = Array.isArray(absorcao?.blocos)
    ? absorcao.blocos.find((b: any) => b?.evento === 'pos_obra')
    : null;
  const periodo = periodoAbsorcao(crono, blocoPos?.duracao_meses);
  if (!periodo) return null;
  const tamanho = periodo.fim - periodo.inicio + 1;
  const pcts = new Array<number>(tamanho).fill(0);

  if (modo === 'personalizado' && Array.isArray(absorcao?.meses)) {
    for (const m of absorcao.meses) {
      const idx = n(m?.mes) - periodo.inicio;
      if (idx >= 0 && idx < tamanho) pcts[idx] += n(m?.pct);
    }
    return { inicio: periodo.inicio, pcts };
  }

  if (modo === 'distribuido' && Array.isArray(absorcao?.blocos)) {
    for (const b of absorcao.blocos) {
      const ev = crono.find((e) => e.evento === b?.evento);
      if (!ev) continue;
      const dur = b.evento === 'pos_obra'
        ? Math.max(1, Math.round(n(b.duracao_meses) || n(ev.duracao_meses)))
        : Math.max(1, n(ev.duracao_meses));
      const porMes = n(b.pct) / dur;
      for (let i = 0; i < dur; i++) {
        const idx = n(ev.inicio_mes) + i - periodo.inicio;
        if (idx >= 0 && idx < tamanho) pcts[idx] += porMes;
      }
    }
    return { inicio: periodo.inicio, pcts };
  }

  // linear (default)
  const porMes = 100 / tamanho;
  pcts.fill(porMes);
  return { inicio: periodo.inicio, pcts };
}

// ─────────────────────────────────────────────────────────────────
// Custos: resolução de unidade de orçamento (puro — motor reutiliza)
// ─────────────────────────────────────────────────────────────────

export interface ContextoCusto {
  areaPrivativaTotal: number; // soma de área × qtd de todas as tipologias
  areaTerreno: number;        // m² do terreno (Premissas)
  vgvTotal: number;           // VGV somado das linhas de receita
  receitaTotal?: number;      // receita líquida (VGL) — para pct_receita
}

/** Área privativa total (área × quantidade) de todas as tipologias das linhas. */
export function areaPrivativaTotalLinhas(linhas: any[]): number {
  return (linhas ?? []).reduce((s, l) =>
    s + (l.tipologias ?? []).reduce((si: number, t: any) =>
      si + n(t.area_privativa_m2) * n(t.quantidade), 0), 0);
}

/** Converte o orçamento de uma linha de custo para R$ absolutos. */
export function resolverCustoTotal(custo: any, ctx: ContextoCusto): number {
  const valor = n(custo?.orcamento_valor);
  switch (custo?.orcamento_unidade) {
    case 'rs_m2_priv': return valor * n(ctx.areaPrivativaTotal);
    case 'rs_m2_terreno': return valor * n(ctx.areaTerreno);
    case 'pct_vgv': return (valor / 100) * n(ctx.vgvTotal);
    case 'pct_receita': return (valor / 100) * n(ctx.receitaTotal ?? ctx.vgvTotal);
    default: return valor; // 'rs'
  }
}

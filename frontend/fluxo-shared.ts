// Helpers puros de calendário do Fluxo de Caixa (nível Avançado).
// Sem DOM, cobertos por testes unitários (fluxo-shared.test.ts).
//
// Convenção de tempo: o fluxo é indexado em meses RELATIVOS 0-based — o mês 0
// é o mês de `data_inicio_projeto` ("mmm/AAAA", ex.: "jan/2027"). O índice do
// array mensal coincide com o número do mês (índice i = mês i).

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
 * Rótulo curto do mês relativo `mesRel` (0-based) a partir de `dataInicio`
 * ("mmm/AAAA"). Ex.: dataInicio "jan/2027", mesRel 0 → "jan/27", mesRel 12 →
 * "jan/28". Sem data de início válida, degrada para "M12".
 */
export function rotuloMesRelativo(dataInicio: string | null | undefined, mesRel: number): string {
  const p = parseMesAno(dataInicio);
  if (!p) return `M${mesRel}`;
  const total = p.ano * 12 + p.mes + mesRel;
  const ano = Math.floor(total / 12);
  const mes = total % 12;
  return `${MESES_ABREV[mes]}/${String(ano).slice(2)}`;
}

/** Rótulo longo "mmm/AAAA" do mês relativo (0-based) (ou null sem data de início). */
export function mesRelativoCompleto(dataInicio: string | null | undefined, mesRel: number): string | null {
  const p = parseMesAno(dataInicio);
  if (!p) return null;
  const total = p.ano * 12 + p.mes + mesRel;
  return formatarMesAno({ mes: total % 12, ano: Math.floor(total / 12) });
}

/**
 * Um período agregado da view do fluxo: uma faixa CONTÍGUA de meses relativos
 * (inclusive nas duas pontas) e o rótulo da coluna correspondente.
 */
export interface PeriodoAgregado { rotulo: string; inicio: number; fim: number }

/**
 * Agrupa os meses relativos `0..prazo-1` em ANOS-CALENDÁRIO (#127), para a view
 * "Anual" do Fluxo de Caixa.
 *
 * O corte segue o calendário real: com `dataInicio` "abr/2027", o primeiro
 * período é 2027 e cobre só abr→dez (9 meses); os seguintes são anos cheios,
 * e o último é truncado no fim do horizonte. Os períodos são contíguos e
 * cobrem exatamente todos os meses — condição para que a soma anual bata com
 * a soma mensal em qualquer linha.
 *
 * Sem data de início válida não há calendário: agrupa em blocos de 12 meses
 * rotulados "Ano 1", "Ano 2"… (mesma degradação de `rotuloMesRelativo`).
 */
export function periodosAnuais(dataInicio: string | null | undefined, prazo: number): PeriodoAgregado[] {
  const total = Math.max(0, Math.round(Number(prazo) || 0));
  const out: PeriodoAgregado[] = [];
  const p = parseMesAno(dataInicio);
  if (!p) {
    for (let i = 0; i < total; i += 12) {
      out.push({ rotulo: `Ano ${i / 12 + 1}`, inicio: i, fim: Math.min(i + 11, total - 1) });
    }
    return out;
  }
  let i = 0;
  while (i < total) {
    const abs = p.ano * 12 + p.mes + i;      // mês absoluto do mês relativo i
    const fim = Math.min(total - 1, i + (11 - (abs % 12))); // até dezembro daquele ano
    out.push({ rotulo: String(Math.floor(abs / 12)), inicio: i, fim });
    i = fim + 1;
  }
  return out;
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
  pos_obra: 'Após-chaves', // #223: rótulo comercial do período após a entrega (id interno pos_obra intacto)
};

export const EVENTO_COR: Record<string, string> = {
  planejamento: 'var(--cor-info, #2aa9e0)',
  pre_lancamento: 'var(--cor-alerta, #e0a82a)',
  lancamento: 'var(--cor-sucesso, #13a98d)',
  obra: 'var(--cor-primaria-solida, #7a5af8)',
  pos_obra: 'var(--cor-erro, #e05757)',
};

// Paleta de tokens para fases extras (índice cíclico).
const FASE_PALETA = [
  'var(--cor-info, #2aa9e0)',
  'var(--cor-alerta, #e0a82a)',
  'var(--cor-sucesso, #13a98d)',
  'var(--cor-primaria-solida, #7a5af8)',
  'var(--cor-erro, #e05757)',
];
export function corFaseExtra(idx: number): string {
  return FASE_PALETA[idx % FASE_PALETA.length];
}

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
 * VGV atribuído às unidades permutadas (fisicamente) de uma tipologia — #188.
 * `unidades_permutadas` é um SUBCONJUNTO de `quantidade` (não soma além dela);
 * daí o `Math.min`.
 */
export function vgvPermutaFisicaTipologia(t: any): number {
  const qtd = n(t?.quantidade);
  const permutadas = Math.min(n(t?.unidades_permutadas), qtd);
  return permutadas * n(t?.area_privativa_m2) * n(t?.preco_m2);
}

/** VGV de permuta física de uma linha de receita (soma das tipologias). */
export function vgvPermutaFisicaLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + vgvPermutaFisicaTipologia(t), 0);
}

/**
 * VGV VENDÁVEL de uma tipologia — `vgvTipologia` menos a fatia de permuta
 * física (#195): a unidade permutada é entregue em troca do terreno/serviço,
 * não vendida por caixa, então não gera receita a distribuir no fluxo. Esta é
 * a base usada por `receitaMensalLinha` para a absorção de vendas — `vgvTotal`
 * (KPI informativo, #188) continua contando a tipologia inteira.
 */
export function vgvVendavelTipologia(t: any): number {
  return vgvTipologia(t) - vgvPermutaFisicaTipologia(t);
}

/** VGV vendável de uma linha de receita (soma das tipologias). */
export function vgvVendavelLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + vgvVendavelTipologia(t), 0);
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
 * As 4 faixas de tempo da absorção Distribuída (#108), em meses RELATIVOS do
 * projeto, derivadas do Cronograma:
 *  - `pre_lancamento` (período 1): duração do evento Pré-lançamento.
 *  - `lancamento`     (período 2): duração do evento Lançamento.
 *  - `obra`           (período 3): duração do evento Obra.
 *  - `pos_obra`       (período 4): duração do evento Pós-obra (pode ser
 *    sobrescrita por `posObraMeses`).
 * Retorna null se faltar Lançamento, Obra ou Pós-obra no cronograma.
 * Quando não há Pré-lançamento, `pre_lancamento` tem fim < inicio (faixa vazia,
 * sem absorção nesse período).
 */
export function faixasAbsorcao(
  crono: EventoCrono[],
  posObraMeses?: number,
): {
  pre_lancamento: { inicio: number; fim: number };
  lancamento: { inicio: number; fim: number };
  obra: { inicio: number; fim: number };
  pos_obra: { inicio: number; fim: number };
} | null {
  const pre = crono.find((e) => e.evento === 'pre_lancamento');
  const lanc = crono.find((e) => e.evento === 'lancamento');
  const obra = crono.find((e) => e.evento === 'obra');
  const pos = crono.find((e) => e.evento === 'pos_obra');
  if (!lanc || !obra || !pos) return null;
  const durPos = Math.max(1, Math.round(posObraMeses ?? n(pos.duracao_meses)));
  // Pré-lançamento: faixa vazia (fim < inicio) quando o evento não existe no cronograma.
  const preInicio = pre ? n(pre.inicio_mes) : n(lanc.inicio_mes);
  const preFim = pre ? n(pre.inicio_mes) + Math.max(1, n(pre.duracao_meses)) - 1 : n(lanc.inicio_mes) - 1;
  return {
    pre_lancamento: { inicio: preInicio, fim: preFim },
    lancamento: { inicio: n(lanc.inicio_mes), fim: n(lanc.inicio_mes) + Math.max(1, n(lanc.duracao_meses)) - 1 },
    obra: { inicio: n(obra.inicio_mes), fim: n(obra.inicio_mes) + Math.max(1, n(obra.duracao_meses)) - 1 },
    pos_obra: { inicio: n(pos.inicio_mes), fim: n(pos.inicio_mes) + durPos - 1 },
  };
}

/**
 * Período total de absorção de uma linha/fase: do início do Pré-lançamento até
 * o fim da Pós-obra. Retorna null se o cronograma não tiver os eventos necessários.
 */
export function periodoAbsorcao(
  crono: EventoCrono[],
  posObraMeses?: number,
): { inicio: number; fim: number } | null {
  const f = faixasAbsorcao(crono, posObraMeses);
  if (!f) return null;
  return { inicio: f.pre_lancamento.inicio, fim: f.pos_obra.fim };
}

/** Lê o % de um bloco de absorção por chave de evento (0 se ausente). */
function pctBloco(blocos: any[], evento: string): number {
  const b = (blocos ?? []).find((x: any) => x?.evento === evento);
  return b ? n(b.pct) : 0;
}

/** % da Pós-obra = 100 − Pré-lançamento − Lançamento − Obra (derivado, #108). */
export function pctPosObraDerivado(blocos: any[]): number {
  return Math.max(0, 100 - pctBloco(blocos, 'pre_lancamento') - pctBloco(blocos, 'lancamento') - pctBloco(blocos, 'obra'));
}

/**
 * Distribui a absorção (% de vendas) mês a mês, em meses RELATIVOS do projeto.
 * Retorna { inicio, pcts } onde pcts[i] é o % vendido no mês (inicio + i),
 * ou null se o cronograma for insuficiente.
 *
 * Modelo vigente (#108): apenas **Distribuído** em 4 períodos —
 * Pré-lançamento (bloco `pre_lancamento`), Lançamento (bloco `lancamento`),
 * Durante a obra (bloco `obra`) e Pós-obra (bloco `pos_obra`, derivado =
 * 100 − p1 − p2 − p3). Cada bloco espalha seu % uniformemente pela faixa.
 *
 * Compat: `personalizado` (dado legado) usa `absorcao.meses`; qualquer outro
 * modo cai em `linear` (uniforme por todo o período de absorção).
 */
export function absorcaoMensal(
  absorcao: any,
  crono: EventoCrono[],
): { inicio: number; pcts: number[] } | null {
  const modo = absorcao?.modo ?? 'linear';
  const blocos = Array.isArray(absorcao?.blocos) ? absorcao.blocos : [];
  const blocoPos = blocos.find((b: any) => b?.evento === 'pos_obra');
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

  if (modo === 'distribuido') {
    const faixas = faixasAbsorcao(crono, blocoPos?.duracao_meses);
    if (!faixas) return null;
    const espalhar = (faixa: { inicio: number; fim: number }, pct: number) => {
      if (faixa.fim < faixa.inicio) return; // faixa vazia (ex.: sem Pré-lançamento)
      const dur = Math.max(1, faixa.fim - faixa.inicio + 1);
      const porMes = pct / dur;
      for (let m = faixa.inicio; m <= faixa.fim; m++) {
        const idx = m - periodo.inicio;
        if (idx >= 0 && idx < tamanho) pcts[idx] += porMes;
      }
    };
    espalhar(faixas.pre_lancamento, pctBloco(blocos, 'pre_lancamento'));
    espalhar(faixas.lancamento, pctBloco(blocos, 'lancamento'));
    espalhar(faixas.obra, pctBloco(blocos, 'obra'));
    espalhar(faixas.pos_obra, pctPosObraDerivado(blocos));
    return { inicio: periodo.inicio, pcts };
  }

  // linear (fallback)
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
  totalObra?: number;         // total do grupo Obra (excl. linhas pct_obra) — para pct_obra
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
    case 'pct_obra': return (valor / 100) * n(ctx.totalObra);
    default: return valor; // 'rs'
  }
}

// ─────────────────────────────────────────────────────────────────
// Saldo de tipologias nas Fases da Receita (#170)
// ─────────────────────────────────────────────────────────────────

/**
 * Unidades da tipologia ainda DISPONÍVEIS quando se chega na alocação `alocId`
 * — a coluna "Total" da tabela de alocações. É o balanço cumulativo de cima
 * para baixo: quantidade do catálogo menos tudo que as alocações ANTERIORES da
 * mesma tipologia já venderam, em qualquer fase anterior (a linha `alocId` não
 * entra na conta). O "Saldo" da linha é este total menos as unidades dela.
 *
 * A ordem é a que o backend devolve — fases por `ordem`, alocações na ordem da
 * fase — e é parte do contrato: mudá-la muda o resultado de cada linha.
 *
 * Alocação não encontrada devolve 0 (a tela não tem o que exibir).
 */
export function totalAntesAlocacao(
  fases: any[],
  tipologias: any[],
  alocId: any,
  tipologiaId: any,
): number {
  const tip = (tipologias ?? []).find((t) => Number(t?.id) === Number(tipologiaId));
  if (!tip) return 0;
  let usado = 0;
  for (const fase of fases ?? []) {
    for (const a of (fase?.alocacoes ?? [])) {
      if (Number(a?.id) === Number(alocId)) {
        return Math.max(0, n(tip.quantidade) - usado);
      }
      if (Number(a?.tipologia_id) === Number(tipologiaId)) {
        usado += n(a?.unidades);
      }
    }
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────
// Corretagem de vendas (#121) — custo direto pago no mês da venda
// ─────────────────────────────────────────────────────────────────

/** Categoria da linha obrigatória de Corretagem (1ª linha de Custos Diretos). */
export const CATEGORIA_CORRETAGEM = 'Corretagem de vendas';

/**
 * Identifica a linha de Corretagem de vendas. Ela não tem Distribuição,
 * Cronograma, Início nem Duração: o motor a paga integralmente no mês em que
 * cada unidade é vendida (#121).
 */
export function eCorretagem(custo: any): boolean {
  return custo?.grupo === 'diretos' && custo?.categoria === CATEGORIA_CORRETAGEM;
}

/** Categoria da linha obrigatória de Preço do Terreno (renomeada de "Compra" no #193). */
export const CATEGORIA_PRECO_TERRENO = 'Preço';

/**
 * Identifica a linha de Preço do Terreno — a única que aceita os modos de
 * distribuição `unit_delivery`/`sales_revenue` do `distribuicao_modo` (#194).
 */
export function ePrecoTerreno(custo: any): boolean {
  return custo?.grupo === 'terreno' && custo?.categoria === CATEGORIA_PRECO_TERRENO;
}

/**
 * VGV VENDIDO mês a mês (meses RELATIVOS 0-based), somando todas as linhas de
 * receita: o VGV de cada linha é repartido pela sua própria curva de absorção.
 * Devolve um array de `prazoTotal` posições; vendas fora do horizonte são
 * ignoradas. Linhas sem VGV ou com cronograma insuficiente não contribuem.
 */
export function vgvVendidoMensal(
  linhasReceita: any[],
  crono: EventoCrono[],
  prazoTotal: number,
): number[] {
  const saida = new Array<number>(Math.max(prazoTotal, 0)).fill(0);
  for (const l of linhasReceita ?? []) {
    const vgv = vgvLinha(l?.tipologias ?? []);
    if (vgv <= 0) continue;
    const abs = absorcaoMensal(l?.absorcao ?? { modo: 'linear' }, crono);
    if (!abs) continue;
    for (let i = 0; i < abs.pcts.length; i++) {
      const idx = abs.inicio + i; // mês 0-based coincide com o índice
      if (idx >= 0 && idx < saida.length) saida[idx] += (vgv * abs.pcts[i]) / 100;
    }
  }
  return saida;
}

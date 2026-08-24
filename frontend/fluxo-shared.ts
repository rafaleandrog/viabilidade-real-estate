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

// BUG7-19: conversão entre o formato persistido ("mmm/AAAA", contrato do
// motor — mês 0 relativo) e o ISO ("YYYY-MM-DD") que `urbi-input-data`
// exige. Dia é sempre 1º nos dois sentidos — o motor nunca leu dia, só
// mês/ano, então descartá-lo na conversão não perde nem inventa informação.

/** "mmm/AAAA" → ISO "YYYY-MM-01" para alimentar `urbi-input-data`. '' se vazio/inválido. */
export function mesAnoParaISO(texto: string | null | undefined): string {
  const p = parseMesAno(texto);
  if (!p) return '';
  return `${p.ano}-${String(p.mes + 1).padStart(2, '0')}-01`;
}

/** ISO "YYYY-MM-DD" (de `urbi-input-data`) → "mmm/AAAA", descartando o dia. '' se vazio/inválido. */
export function isoParaMesAno(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(iso ?? '').trim());
  if (!m) return '';
  const mes = Number(m[2]) - 1;
  if (mes < 0 || mes > 11) return '';
  return formatarMesAno({ mes, ano: Number(m[1]) });
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
  // BUG7-20: rótulo do evento do Cronograma (fase de custos) — id interno
  // pos_obra intacto. Não confundir com "Pós-chaves"/APOS_CHAVES_MESES logo
  // abaixo, a janela comercial fixa de 12 meses da Absorção (#348) — nomes
  // parecidos, conceitos diferentes (fase de custo livre × janela de vendas
  // travada em 12 meses).
  pos_obra: 'Pós-obras',
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
export function vgvPermutaFisicaTipologia(t: any, unidadesPermutadas?: number): number {
  const qtd = n(t?.quantidade);
  // A fonte nova é a reserva da linha de Custos (#266/#268). O campo legado
  // permanece como fallback apenas para consumidores antigos desta função.
  const solicitadas = unidadesPermutadas === undefined ? n(t?.unidades_permutadas) : n(unidadesPermutadas);
  const permutadas = Math.min(Math.max(0, solicitadas), qtd);
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
export function vgvVendavelTipologia(t: any, unidadesPermutadas?: number): number {
  return vgvTipologia(t) - vgvPermutaFisicaTipologia(t, unidadesPermutadas);
}

/** VGV vendável de uma linha de receita (soma das tipologias). */
export function vgvVendavelLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + vgvVendavelTipologia(t), 0);
}

// #457: livro de estoque em m²/unidades — espelham EXATAMENTE o padrão dos
// helpers de VGV acima (total / permuta física / vendável), trocando
// `preco_m2` por 1 (unidades) ou por `area_privativa_m2` sozinho (m²). Sem
// oráculo de planilha para unidades (BRIEF-EVI.md T4: a EVI só trabalha em
// m² e não tem célula de VSO) — os testes de unidades/VSO verificam
// coerência interna com a série em m², não paridade externa.

/** Área privativa TOTAL de uma tipologia (quantidade × área) — é a SEMENTE
 * do livro de estoque em m² (#457): a EVI semeia com a privativa total, não
 * com a área já líquida de permuta (`Areas e Precos!F14`, não `F17`). */
export function areaTotalTipologia(t: any): number {
  return n(t?.quantidade) * n(t?.area_privativa_m2);
}

/** Área privativa total de uma linha de receita (soma das tipologias). */
export function areaTotalLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + areaTotalTipologia(t), 0);
}

/** Área (m²) atribuída às unidades permutadas fisicamente de uma tipologia —
 * mesma fonte/fallback de `vgvPermutaFisicaTipologia`, sem o preço/m². */
export function areaPermutaFisicaTipologia(t: any, unidadesPermutadas?: number): number {
  const qtd = n(t?.quantidade);
  const solicitadas = unidadesPermutadas === undefined ? n(t?.unidades_permutadas) : n(unidadesPermutadas);
  const permutadas = Math.min(Math.max(0, solicitadas), qtd);
  return permutadas * n(t?.area_privativa_m2);
}

/** Área (m²) de permuta física de uma linha de receita (soma das tipologias). */
export function areaPermutaFisicaLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + areaPermutaFisicaTipologia(t), 0);
}

/** Área VENDÁVEL (m²) de uma tipologia — total menos a fatia de permuta
 * física, mesmo modelo de `vgvVendavelTipologia`. */
export function areaVendavelTipologia(t: any, unidadesPermutadas?: number): number {
  return areaTotalTipologia(t) - areaPermutaFisicaTipologia(t, unidadesPermutadas);
}

/** Área vendável (m²) de uma linha de receita (soma das tipologias). */
export function areaVendavelLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + areaVendavelTipologia(t), 0);
}

/** Unidades VENDÁVEIS de uma tipologia — quantidade menos as permutadas
 * fisicamente (mesmo modelo de `vgvVendavelTipologia`, sem preço nem área). */
export function unidadesVendaveisTipologia(t: any, unidadesPermutadas?: number): number {
  const qtd = n(t?.quantidade);
  const solicitadas = unidadesPermutadas === undefined ? n(t?.unidades_permutadas) : n(unidadesPermutadas);
  const permutadas = Math.min(Math.max(0, solicitadas), qtd);
  return qtd - permutadas;
}

/** Unidades vendáveis de uma linha de receita (soma das tipologias). */
export function unidadesVendaveisLinha(tipologias: any[]): number {
  return (tipologias ?? []).reduce((s, t) => s + unidadesVendaveisTipologia(t), 0);
}

/**
 * Receita líquida de uma linha, para fins de BASE DE CUSTO (`pct_receita`) —
 * VGV menos o único imposto oficial do Avançado: RET (#228, decisão do autor
 * 2026-08-01 — o regime da aba Financeiro, `regime_tributario`/`aliquota_*`,
 * é exclusivo do Preliminar e não é lido pelo motor do Avançado). Substitui
 * `vglLinha` (removida): a comissão NUNCA deduz aqui — ela já é a linha de
 * custo obrigatória "Corretagem de vendas" (#227); deduzi-la também da
 * receita duplicava o efeito quando o comissionamento era "Destacada", o
 * bug que a #228 corrige.
 *
 * #346: RET era controle POR GRUPO (`fluxo_pagamento.ret`, JSON por fase) —
 * agora é GLOBAL do estudo (`estudos.considerar_ret`/`ret_pct`), o mesmo
 * valor para toda linha de receita. O parâmetro passou a ser o RET já
 * resolvido, não mais o `fluxo_pagamento` de onde extraí-lo.
 */
export function receitaLiquidaLinha(vgv: number, ret: { ativo: boolean; pct: number } | null | undefined): number {
  if (!ret?.ativo) return vgv;
  return vgv * (1 - n(ret.pct) / 100);
}

// #226: janela comercial "Pós-chaves" (rótulo renomeado de "Após-chaves" pela
// #348 — o nome do identificador/constante não mudou) — CONSTANTE do motor,
// não campo editável. Antes a duração vinha de `pos_obra.duracao_meses`
// (evento do Cronograma) ou de um bloco de absorção com `duracao_meses` —
// acoplando a janela de VENDAS à duração de um evento que também serve de
// ÂNCORA de custo (ex.: manutenção pós-entrega). Editar essa duração no
// Cronograma não muda mais a absorção — só as âncoras de custo continuam
// livres, com a duração que já tinham. Não confundir com "Pós-obras" (#328),
// a fase de CUSTO do Cronograma — nomes parecidos, conceitos diferentes.
export const APOS_CHAVES_MESES = 12;

/**
 * As 4 faixas de tempo da absorção Distribuída (#108), em meses RELATIVOS do
 * projeto, derivadas do Cronograma:
 *  - `pre_lancamento` (período 1): duração do evento Pré-lançamento.
 *  - `lancamento`     (período 2): duração do evento Lançamento.
 *  - `obra`           (período 3, "Durante a obra"): do mês SEGUINTE ao fim do
 *    Lançamento até o fim físico da Obra (#225). Como a Obra física começa junto
 *    com o Pré-lançamento (#224), usar o evento Obra inteiro sobreporia
 *    Pré-lançamento e Lançamento; a janela comercial "Durante a obra" começa só
 *    depois do Lançamento. Fica vazia (fim < início) se o Lançamento terminar
 *    em ou depois do fim da Obra — ver `problemaJanelaDuranteObra`.
 *  - `pos_chaves`     (período 4, "Pós-chaves"): início no fim da Obra + 1
 *    (herdado do evento `pos_obra` do Cronograma — dele vem só o INÍCIO),
 *    duração FIXA de `APOS_CHAVES_MESES` — #226, ignora
 *    `pos_obra.duracao_meses`.
 *
 *    #430: a chave se chama `pos_chaves`, não `pos_obra`, porque é outro
 *    conceito. "Pós-obras" é a fase de CUSTO do Cronograma, com duração
 *    digitada pelo usuário e consumida pela ancoragem de custo; "Pós-chaves"
 *    é a janela COMERCIAL — em que ainda se vende e o cliente termina de
 *    pagar —, de 12 meses fixos. Compartilhar o nome fazia o usuário esticar
 *    o campo de custo achando que ganhava janela de venda, e vender MENOS.
 * Retorna null se faltar Lançamento, Obra ou Pós-obra no cronograma.
 * Quando não há Pré-lançamento, `pre_lancamento` tem fim < inicio (faixa vazia,
 * sem absorção nesse período).
 */
export function faixasAbsorcao(
  crono: EventoCrono[],
): {
  pre_lancamento: { inicio: number; fim: number };
  lancamento: { inicio: number; fim: number };
  obra: { inicio: number; fim: number };
  pos_chaves: { inicio: number; fim: number };
} | null {
  const pre = crono.find((e) => e.evento === 'pre_lancamento');
  const lanc = crono.find((e) => e.evento === 'lancamento');
  const obra = crono.find((e) => e.evento === 'obra');
  const pos = crono.find((e) => e.evento === 'pos_obra');
  if (!lanc || !obra || !pos) return null;
  // Pré-lançamento: faixa vazia (fim < inicio) quando o evento não existe no cronograma.
  const preInicio = pre ? n(pre.inicio_mes) : n(lanc.inicio_mes);
  const preFim = pre ? n(pre.inicio_mes) + Math.max(1, n(pre.duracao_meses)) - 1 : n(lanc.inicio_mes) - 1;
  return {
    pre_lancamento: { inicio: preInicio, fim: preFim },
    lancamento: { inicio: n(lanc.inicio_mes), fim: n(lanc.inicio_mes) + Math.max(1, n(lanc.duracao_meses)) - 1 },
    // #225: "Durante a obra" começa no mês seguinte ao fim do Lançamento, não no
    // início físico da Obra — evita sobrepor Pré-lançamento e Lançamento.
    obra: { inicio: n(lanc.inicio_mes) + Math.max(1, n(lanc.duracao_meses)), fim: n(obra.inicio_mes) + Math.max(1, n(obra.duracao_meses)) - 1 },
    // #226: início herdado do Cronograma (fim da Obra + 1, travado por
    // recalcularTravados); duração é a CONSTANTE, não `pos.duracao_meses`.
    pos_chaves: { inicio: n(pos.inicio_mes), fim: n(pos.inicio_mes) + APOS_CHAVES_MESES - 1 },
  };
}

/**
 * Problema estrutural do calendário comercial (#225): o Lançamento termina em ou
 * depois do fim da Obra, deixando "Durante a obra" vazia — e, como o Pós-chaves
 * é ancorado no fim da Obra + 1, ele passaria a sobrepor o Lançamento, reintroduzindo
 * a sobreposição que a derivação existe para eliminar. Retorna a explicação para a
 * UI, ou null quando o calendário é coerente.
 */
export function problemaJanelaDuranteObra(crono: EventoCrono[]): string | null {
  const lanc = crono.find((e) => e.evento === 'lancamento');
  const obra = crono.find((e) => e.evento === 'obra');
  if (!lanc || !obra) return null;
  const lancFim = n(lanc.inicio_mes) + Math.max(1, n(lanc.duracao_meses)) - 1;
  const obraFim = n(obra.inicio_mes) + Math.max(1, n(obra.duracao_meses)) - 1;
  if (lancFim >= obraFim) {
    return 'O Lançamento termina no fim da Obra ou depois, sem janela "Durante a obra". Encurte o Lançamento ou estenda a Obra.';
  }
  return null;
}

/**
 * Período total de absorção de uma linha/fase: do início do Pré-lançamento até
 * o fim do Pós-chaves (12 meses fixos — #226). Retorna null se o cronograma
 * não tiver os eventos necessários.
 */
export function periodoAbsorcao(
  crono: EventoCrono[],
): { inicio: number; fim: number } | null {
  const f = faixasAbsorcao(crono);
  if (!f) return null;
  return { inicio: f.pre_lancamento.inicio, fim: f.pos_chaves.fim };
}

/** Lê o % de um bloco de absorção por chave de evento (0 se ausente). */
function pctBloco(blocos: any[], evento: string): number {
  const b = (blocos ?? []).find((x: any) => x?.evento === evento);
  return b ? n(b.pct) : 0;
}

/** % do Pós-chaves = 100 − Pré-lançamento − Lançamento − Obra (derivado, #108). */
export function pctPosChavesDerivado(blocos: any[]): number {
  return Math.max(0, 100 - pctBloco(blocos, 'pre_lancamento') - pctBloco(blocos, 'lancamento') - pctBloco(blocos, 'obra'));
}

/**
 * #347: valida a soma dos três períodos INFORMADOS do formulário de Absorção
 * (Pré-lançamento + Lançamento + Obra) — sem isso, um total acima de 100%
 * clampava silenciosamente no Pós-chaves (`pctPosChavesDerivado` usa
 * `Math.max(0, ...)`) e a soma real da absorção fechava abaixo de 100%,
 * perdendo % de vendas sem aviso nenhum. `pre_lancamento_pct` já chega aqui
 * zerado quando o Cronograma não tem a fase (a tela nem mostra o campo nesse
 * caso), então a soma não precisa saber disso por conta própria.
 */
export function erroFormularioAbsorcao(f: {
  pre_lancamento_pct: number; lancamento_pct: number; obra_pct: number;
}): string | null {
  const soma = n(f.pre_lancamento_pct) + n(f.lancamento_pct) + n(f.obra_pct);
  if (soma > 100.01) {
    return `Pré-lançamento + Lançamento + Obra somam ${soma.toFixed(2)}%; o total não pode superar 100%.`;
  }
  return null;
}

/**
 * #429: saída de `absorcaoMensal`. Além da série mensal, carrega a
 * CONSERVAÇÃO da curva: `pctTotal` é o quanto ela declara vender e
 * `pctDescartado` é a parte que não coube na janela derivada de absorção e,
 * portanto, **não** está em `pcts`. Antes esse resto sumia sem log nem erro —
 * o motor continua não o computando, mas agora quem valida consegue vê-lo.
 *
 * ⚠️ C7: `pctTotal`/`pctDescartado` são percentuais DERIVADOS, não monetários
 * — carregam precisão plena aqui e só arredondam para exibir.
 */
export interface AbsorcaoMensal {
  /** Mês relativo (0-based) do primeiro elemento de `pcts`. */
  inicio: number;
  /** % vendido no mês (`inicio` + i). Só o que caiu DENTRO da janela. */
  pcts: number[];
  /** Soma dos % que a curva declara vender — 100 numa curva íntegra. */
  pctTotal: number;
  /** Parte de `pctTotal` que caiu fora da janela e não entrou em `pcts`. */
  pctDescartado: number;
  /** Meses relativos com % descartado — alimenta a mensagem de diagnóstico. */
  mesesDescartados: number[];
}

/**
 * Distribui a absorção (% de vendas) mês a mês, em meses RELATIVOS do projeto.
 * Retorna { inicio, pcts } onde pcts[i] é o % vendido no mês (inicio + i),
 * ou null se o cronograma for insuficiente.
 *
 * Modelo vigente (#108): apenas **Distribuído** em 4 períodos —
 * Pré-lançamento (bloco `pre_lancamento`), Lançamento (bloco `lancamento`),
 * Durante a obra (bloco `obra`) e Pós-chaves (derivado = 100 − p1 − p2 − p3).
 * Cada bloco espalha seu % uniformemente pela faixa.
 *
 * #430: o bloco persistido do 4º período continua gravado com
 * `evento: 'pos_obra'` — é dado em coluna `json`, e o backend o reconhece por
 * esse nome ao excluí-lo da soma informada (`backend/rotas/avancado.ts:217`).
 * Renomeá-lo seria mudança de DADO, com migração; o que a #430 renomeia é o
 * identificador em memória. O `pct` desse bloco nunca é lido PELO MOTOR — o 4º
 * período é sempre derivado. (`scripts/conferir-estudo.ts` o lê de propósito,
 * justamente para comparar o gravado com o derivado; é conferência, não cálculo.)
 *
 * Compat: `personalizado` (dado legado) usa `absorcao.meses`; qualquer outro
 * modo cai em `linear` (uniforme por todo o período de absorção).
 *
 * #429: a saída carrega também a CONSERVAÇÃO da curva — ver `AbsorcaoMensal`.
 */
export function absorcaoMensal(
  absorcao: any,
  crono: EventoCrono[],
): AbsorcaoMensal | null {
  const modo = absorcao?.modo ?? 'linear';
  const blocos = Array.isArray(absorcao?.blocos) ? absorcao.blocos : [];
  // #226: a duração do Pós-chaves não é mais lida do bloco de absorção nem do
  // evento pos_obra — periodoAbsorcao/faixasAbsorcao usam a constante fixa.
  const periodo = periodoAbsorcao(crono);
  if (!periodo) return null;
  const tamanho = periodo.fim - periodo.inicio + 1;
  const pcts = new Array<number>(tamanho).fill(0);
  let pctTotal = 0;
  let pctDescartado = 0;
  const mesesDescartados: number[] = [];

  if (modo === 'personalizado' && Array.isArray(absorcao?.meses)) {
    // #429: o ponto fora da janela derivada CONTINUA não sendo computado (a
    // camada denuncia, não corrige — item 4 do Comportamento esperado), mas
    // deixa de sumir sem rastro: entra em pctDescartado/mesesDescartados,
    // que é o dado BRUTO de que `validarProduto` precisa. Derivar a checagem
    // de `pcts` seria autoconsistente: `pcts` já é a saída truncada.
    for (const m of absorcao.meses) {
      const mes = n(m?.mes);
      const pct = n(m?.pct);
      pctTotal += pct;
      const idx = mes - periodo.inicio;
      if (idx >= 0 && idx < tamanho) { pcts[idx] += pct; continue; }
      if (pct === 0) continue; // ponto vazio fora da janela não perde venda nenhuma
      pctDescartado += pct;
      mesesDescartados.push(mes);
    }
    return { inicio: periodo.inicio, pcts, pctTotal, pctDescartado, mesesDescartados };
  }

  if (modo === 'distribuido') {
    const faixas = faixasAbsorcao(crono);
    if (!faixas) return null;
    const espalhar = (faixa: { inicio: number; fim: number }, pct: number) => {
      pctTotal += pct;
      if (faixa.fim < faixa.inicio) {
        // Faixa vazia (sem Pré-lançamento, ou "Durante a obra" espremida pelo
        // Lançamento — `problemaJanelaDuranteObra`). #429: o % do bloco não
        // tem onde cair; antes evaporava calado, agora é contabilizado.
        if (pct !== 0) pctDescartado += pct;
        return;
      }
      const dur = Math.max(1, faixa.fim - faixa.inicio + 1);
      const porMes = pct / dur;
      for (let m = faixa.inicio; m <= faixa.fim; m++) {
        const idx = m - periodo.inicio;
        if (idx >= 0 && idx < tamanho) { pcts[idx] += porMes; continue; }
        if (porMes === 0) continue;
        pctDescartado += porMes;
        mesesDescartados.push(m);
      }
    };
    espalhar(faixas.pre_lancamento, pctBloco(blocos, 'pre_lancamento'));
    espalhar(faixas.lancamento, pctBloco(blocos, 'lancamento'));
    espalhar(faixas.obra, pctBloco(blocos, 'obra'));
    espalhar(faixas.pos_chaves, pctPosChavesDerivado(blocos));
    return { inicio: periodo.inicio, pcts, pctTotal, pctDescartado, mesesDescartados };
  }

  // linear (fallback): por construção cobre a janela inteira, nada a descartar.
  const porMes = 100 / tamanho;
  pcts.fill(porMes);
  return { inicio: periodo.inicio, pcts, pctTotal: 100, pctDescartado: 0, mesesDescartados: [] };
}

/**
 * #429: quanto da curva o motor efetivamente computa — `pctTotal` menos o que
 * caiu fora da janela. Numa curva íntegra dá 100. É a primeira das duas
 * grandezas da invariante `ABSORCAO_NAO_FECHA`.
 *
 * ⚠️ No modo `personalizado` este número é aritmeticamente igual a `Σ pcts`
 * (todo ponto ou cai dentro, ou é descartado) — quem NÃO é derivável de
 * `pcts` é `pctDescartado`, e é por isso que a invariante olha os dois.
 */
export function pctAbsorcaoEfetivo(abs: AbsorcaoMensal): number {
  return abs.pctTotal - abs.pctDescartado;
}

/** #429: último mês (relativo, 0-based) da janela derivada de absorção. */
export function fimJanelaAbsorcao(abs: AbsorcaoMensal): number {
  return abs.inicio + abs.pcts.length - 1;
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
  // #259: para linhas já convertidas, R$ canônico independe da unidade exibida.
  if (custo?.orcamento_valor_canonico !== null && custo?.orcamento_valor_canonico !== undefined
    && Number.isFinite(Number(custo.orcamento_valor_canonico))) return n(custo.orcamento_valor_canonico);
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

/** Subcategoria canônica de permuta financeira da linha de Preço do Terreno (#257). */
export const SUBCATEGORIA_PERMUTA_FINANCEIRA = 'Permuta financeira';

/**
 * Permuta financeira (#196/#238): a subcategoria "Permuta financeira" da
 * linha de Preço do Terreno — parte do preço paga em % da receita (ou valor
 * fixo), não em caixa; é DEDUÇÃO DA RECEITA, não custo. Movida para aqui
 * (#238) para ser a MESMA checagem usada pelo motor
 * (`frontend/fluxo-caixa-motor.ts`) e pela UI (`tela-fluxo-custos.ts`) — a
 * armadilha A10 (Anexo D) era exatamente a UI classificar por
 * `distribuicao_modo` enquanto o motor classifica por subcategoria.
 */
export function ePermutaFinanceira(custo: any): boolean {
  return ePrecoTerreno(custo) && String(custo?.subcategoria || '') === SUBCATEGORIA_PERMUTA_FINANCEIRA;
}

/** Subcategoria canônica de permuta física da linha de Preço do Terreno (#257). */
export const SUBCATEGORIA_PERMUTA_FISICA = 'Permuta física';

/**
 * #266 (modelo/UI): identifica a linha de Preço do Terreno configurada como
 * permuta física — referencia uma tipologia + quantidade entregue, em vez de
 * um valor em caixa. Cronograma/Início/Duração ficam vazios (a entrega não
 * tem calendário próprio) e a Distribuição é fixa ("Entrega de unidades").
 * O MOTOR que consome `permuta_tipologia_id`/`permuta_quantidade` para
 * valorar a permuta (a base declarada pelo ADR da #266) é o #268 — esta
 * função só identifica a linha para a UI, ainda não afeta `calcularFluxo`.
 */
export function ePermutaFisica(custo: any): boolean {
  return ePrecoTerreno(custo) && custo?.subcategoria === SUBCATEGORIA_PERMUTA_FISICA;
}

/** Categoria da linha obrigatória do grupo Obra (#115/#120). */
export const CATEGORIA_CONSTRUCAO = 'Construção';

/**
 * Linha "Construção" (obrigatória, 1ª do grupo Obra): além da categoria travada
 * (#115), o Cronograma fica fixo em "Obra" e Início/Duração são derivados do
 * cronograma do empreendimento e bloqueados (#120).
 */
export function eConstrucao(custo: any): boolean {
  return custo?.grupo === 'obra' && custo?.categoria === CATEGORIA_CONSTRUCAO;
}

// ─────────────────────────────────────────────────────────────────
// Base financiável do Financiamento à produção (§4.3 de
// docs/viabilidade/funding-capital-stack.md)
// ─────────────────────────────────────────────────────────────────

/** Outorga onerosa — contrapartida do potencial construtivo, grupo Obra (#180). */
export const CATEGORIA_OUTORGA = 'Outorga';
/** Projetos (arquitetura, complementares) — grupo Custos Diretos. */
export const CATEGORIA_PROJETOS = 'Projetos';
/** Licenças e Aprovações — grupo Custos Diretos; junto com Projetos forma o "Projetos e aprovações" da planilha. */
export const CATEGORIA_LICENCAS = 'Licenças e Aprovações';

/**
 * Uma linha de custo pertence à base financiável PADRÃO do Financiamento à
 * produção? São os quatro grupos que a planilha de referência soma em
 * `Aux Despesas Financiáveis` (`Incorp Individual!BW`):
 *
 *   1. pagamento CASH do terreno — a linha de Preço, exceto as subcategorias
 *      de permuta (física não gera caixa; financeira é dedução de receita,
 *      não desembolso — nenhuma das duas é despesa que o banco financia);
 *   2. custo de construção;
 *   3. outorga;
 *   4. projetos e aprovações.
 *
 * Ficam DE FORA, deliberadamente: impostos, corretagem, marketing, permutas,
 * incorporação e registro, manutenção pós-obra, mobiliário, contingências,
 * gestão e demais indiretos. Todos continuam pesando no fluxo de caixa — só
 * não aumentam a base sobre a qual o banco libera.
 *
 * É só o PADRÃO: a camada pode selecionar outras linhas em
 * `config.custoLinhaIds`, e é essa seleção que prevalece quando existe.
 */
export function eFinanciavelPadrao(custo: any): boolean {
  if (ePrecoTerreno(custo)) return !ePermutaFisica(custo) && !ePermutaFinanceira(custo);
  if (eConstrucao(custo)) return true;
  if (custo?.grupo === 'obra' && custo?.categoria === CATEGORIA_OUTORGA) return true;
  if (custo?.grupo === 'diretos'
    && (custo?.categoria === CATEGORIA_PROJETOS || custo?.categoria === CATEGORIA_LICENCAS)) return true;
  return false;
}

/**
 * Marcos da Obra em meses relativos 0-based, derivados do Cronograma.
 *
 * `mesEntrega` é o ÚLTIMO mês de obra — a mesma definição que o motor de
 * recebíveis já usa (`ehVendaAposChaves`, `pagamentosAteMarco`,
 * `REPASSE_MESES_APOS_ENTREGA`), repetida hoje em seis pontos de
 * `fluxo-caixa-motor.ts`. Este helper é a fonte única para código novo; os
 * seis pontos existentes seguem como estão até uma issue de refatoração.
 *
 * ⚠️ A planilha de referência marca `Chaves` no mês SEGUINTE ao último mês de
 * obra (`Mês = PrazoObra`, com `Obra` valendo `0 ≤ Mês < PrazoObra`). O app
 * adota o último mês de obra, para não ter duas definições de entrega
 * convivendo. A diferença é de um mês e não altera o cenário de referência
 * (o mês das chaves não tem custo financiável nem liberação).
 *
 * Retorna `null` quando não há evento `obra` no cronograma.
 */
export function marcosObra(crono: EventoCrono[]): { inicioObra: number; fimObra: number; mesEntrega: number } | null {
  const obra = crono.find((e) => e.evento === 'obra');
  if (!obra) return null;
  const inicioObra = n(obra.inicio_mes);
  const fimObra = inicioObra + Math.max(1, n(obra.duracao_meses)) - 1;
  return { inicioObra, fimObra, mesEntrega: fimObra };
}

/**
 * Mês do repasse/entrega das chaves (0-based) — o mês SEGUINTE ao último mês
 * de obra (`marcosObra(crono).mesEntrega + 1`). É o marco que o Equity em
 * modo `resultado_final` usa para pagar de uma vez (`funding-motor.ts`), e o
 * mesmo que `REPASSE_MESES_APOS_ENTREGA` usa em `fluxo-caixa-motor.ts` para
 * os recebíveis do cliente — uma fonte só para "quando o repasse acontece".
 * `0` quando o cronograma não tem evento `obra`.
 */
export function mesRepasse(crono: EventoCrono[]): number {
  const marcos = marcosObra(crono ?? []);
  return marcos ? marcos.mesEntrega + 1 : 0;
}

/**
 * Regime de cronograma de uma linha de custo (#255).
 *
 * Por que existe: esta classificação estava INLINE no render de
 * `tela-fluxo-custos.ts`, repetida IDÊNTICA nas três colunas (Cronograma,
 * Início e Duração). Essa repetição é o mecanismo exato das duas correções
 * parciais que a #255 cita — a #120 tratou só a linha Construção, a #167 tratou
 * só o Início. Quem corrige uma coluna e esquece as outras reproduz o histórico.
 *
 * É também a única parte da matriz de ancoragem SENSÍVEL AO GRUPO: as funções
 * do backend (`ancorarLinhaCusto`, `resolverTravamentoCusto`) não recebem
 * `grupo`, e por isso a matriz por aba é redundante lá — mas não aqui.
 *
 * A ordem das condições é a do código original, e é significativa: Corretagem
 * antes de Permuta, Permuta antes de Construção, Construção antes de
 * fase-âncora. Alterá-la muda comportamento.
 *
 *  · `sem_cronograma` — não tem calendário próprio. Corretagem segue as vendas
 *    (#121); permuta física/financeira e Preço do Terreno distribuído por
 *    `unit_delivery`/`sales_revenue` seguem a curva que os define (#194).
 *  · `fixo_obra`      — Construção: presa ao evento Obra, sem seletor (#120).
 *  · `fase_ancora`    — ancorada numa fase do Cronograma (#167).
 *  · `evento_fixo`    — ancorada num dos eventos fixos.
 *  · `customizado`    — início e duração livres.
 */
export type RegimeCronograma =
  | 'sem_cronograma' | 'fixo_obra' | 'fase_ancora' | 'evento_fixo' | 'customizado';

export function regimeCronogramaLinha(custo: any): RegimeCronograma {
  if (eCorretagem(custo)) return 'sem_cronograma';
  if (ePermutaFisica(custo) || ePermutaFinanceira(custo)
    || (ePrecoTerreno(custo) && custo?.distribuicao_modo && custo.distribuicao_modo !== 'fixo')) {
    return 'sem_cronograma';
  }
  if (eConstrucao(custo)) return 'fixo_obra';
  if (custo?.fase_ancora_id) return 'fase_ancora';
  // Legado sem o campo cai em `customizado`, que é o default histórico.
  if ((custo?.cronograma_evento || 'customizado') !== 'customizado') return 'evento_fixo';
  return 'customizado';
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

/**
 * #442: o dinheiro de uma linha de custo para EXIBIR num seletor, quando quem
 * exibe não tem as grandezas de ligação para converter unidade.
 *
 * O seletor de base financiável do Funding lia `orcamento_valor` cru — a mesma
 * coluna que a #442 mostrou congelada — e rotulava "R$ 0,24" um custo de
 * quatrocentos mil reais — e a coluna pode estar em qualquer unidade, então lê-la
 * como R$ é errado por construção, não só quando ela está congelada.
 *
 * A fonte certa é o total que o MOTOR aplica. `calcLinhas` é `calc.linhasCusto`,
 * já resolvido; permuta física e financeira não entram lá (#268), e para elas o
 * canônico é a fonte — exceto na permuta FÍSICA, em que o backend zera os dois
 * campos de propósito (`backend/rotas/avancado.ts:1394-1397`), e aí não há
 * dinheiro nenhum a mostrar. Sem canônico, a coluna crua só é R$ quando a
 * unidade é `rs`; nas demais devolve `null`, para o chamador não afirmar um
 * número que não sabe.
 */
export function dinheiroParaRotulo(custo: any, calcLinhas: Array<{ id: any; total: number }>): number | null {
  const doMotor = (calcLinhas ?? []).find((l) => l.id === custo?.id);
  if (doMotor) return doMotor.total;
  const canonico = custo?.orcamento_valor_canonico;
  if (canonico !== null && canonico !== undefined && canonico !== '' && Number.isFinite(Number(canonico))) {
    return Number(canonico);
  }
  const bruto = custo?.orcamento_valor;
  if ((custo?.orcamento_unidade || 'rs') !== 'rs') return null;
  if (bruto === null || bruto === undefined || bruto === '' || !Number.isFinite(Number(bruto))) return null;
  return Number(bruto);
}

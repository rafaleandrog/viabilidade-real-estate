import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor, exigirAprovador } from '../permissoes-estudo.js';

// Rotas do nível AVANÇADO (fluxo de caixa temporal). Todo o conjunto só opera
// sobre estudos com nivel_analise === 'avancado' — em estudos preliminares as
// rotas respondem 422 NIVEL_INVALIDO e nada é lido/escrito. O Preliminar não
// passa por aqui.
//
// Entidades (schema.json): avancado_cronograma (5 eventos fixos por estudo),
// avancado_curvas (globais da instância), avancado_linhas_receita +
// avancado_tipologias, avancado_linhas_custo. Parâmetros globais
// (data_inicio_projeto, taxa_desconto_aa) vivem na própria tabela estudos.

export const rotasAvancado: ReturnType<typeof Router> = Router();

// ─────────────────────────────────────────────────────────────────
// Lógica pura (exportada para testes unitários)
// ─────────────────────────────────────────────────────────────────

export const EVENTOS_CRONOGRAMA = ['planejamento', 'pre_lancamento', 'lancamento', 'obra', 'pos_obra'] as const;
export type EventoCronograma = (typeof EVENTOS_CRONOGRAMA)[number];

export interface LinhaCronograma {
  evento: EventoCronograma;
  inicio_mes: number;
  duracao_meses: number;
  travado_inicio: boolean;
  travado_duracao: boolean;
}

// Defaults de um cronograma novo (48 meses no total, espelhando a referência).
// Convenção 0-based: mês 0 = início do projeto (Lote 4 · #16).
export function cronogramaPadrao(): LinhaCronograma[] {
  const base: LinhaCronograma[] = [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6, travado_inicio: false, travado_duracao: false },
    { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6, travado_inicio: true, travado_duracao: false },
    { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1, travado_inicio: true, travado_duracao: false },
    // #224: Obra começa no fim do Planejamento, junto com o Pré-lançamento —
    // início derivado e travado (recalcularTravados reimpõe). Antes nascia no
    // mês 17, fora da regra.
    { evento: 'obra', inicio_mes: 6, duracao_meses: 24, travado_inicio: true, travado_duracao: false },
    { evento: 'pos_obra', inicio_mes: 30, duracao_meses: 12, travado_inicio: true, travado_duracao: false },
  ];
  return recalcularTravados(base);
}

/**
 * Recalcula os campos travados do cronograma:
 *  - Pré-lançamento: início = fim do Planejamento (travado — #165)
 *  - Obra:           início = fim do Planejamento (travado — #224): a obra física
 *                     começa SIMULTÂNEA ao Pré-lançamento. Antes o início era livre,
 *                     permitindo lacuna entre Planejamento e Obra.
 *  - Lançamento:     início = fim do Pré-lançamento (travado); duração LIVRE (#166 —
 *                     antes fixa em 1 mês, o usuário já podia editá-la na tela e
 *                     tomava 422 do backend, que ainda forçava o valor). Sem
 *                     Pré-lançamento no cronograma (#330), ancora no fim do
 *                     Planejamento em vez disso.
 *  - Pós-obra:       início = fim da Obra (travado; duração livre)
 *
 * #246: `travado_duracao` é sempre `false` para os 5 eventos — nenhum dos
 * defaults (cronogramaPadrao) trava duração, e nenhuma rota escreve `true`.
 * O único jeito de existir `true` é dado LEGADO de antes da #166 (quando o
 * Lançamento tinha duração fixa em 1 mês) — o valor sobrevivia para sempre no
 * banco porque só `travado_inicio` era recalculado aqui, nunca `travado_duracao`.
 * A normalização roda em TODO recálculo (leitura e PATCH via lerCronograma),
 * corrigindo o legado sem migração.
 *
 * Retorna um novo array (não muta o de entrada).
 */
export function recalcularTravados(eventos: LinhaCronograma[]): LinhaCronograma[] {
  const porEvento = new Map(eventos.map((e) => [e.evento, { ...e, travado_duracao: false }]));
  const plan = porEvento.get('planejamento');
  const pre = porEvento.get('pre_lancamento');
  const lanc = porEvento.get('lancamento');
  const obra = porEvento.get('obra');
  const pos = porEvento.get('pos_obra');
  if (plan && pre) {
    pre.inicio_mes = plan.inicio_mes + plan.duracao_meses; // fim do planejamento
    pre.travado_inicio = true;
  }
  if (plan && obra) {
    obra.inicio_mes = plan.inicio_mes + plan.duracao_meses; // #224: junto com o Pré-lançamento
    obra.travado_inicio = true;
  }
  if (pre && lanc) {
    lanc.inicio_mes = pre.inicio_mes + pre.duracao_meses; // fim do pré-lançamento
    lanc.travado_inicio = true;
  } else if (plan && lanc) {
    // #330: sem Pré-lançamento, o Lançamento ancora direto no fim do Planejamento.
    lanc.inicio_mes = plan.inicio_mes + plan.duracao_meses;
    lanc.travado_inicio = true;
  }
  if (obra && pos) {
    pos.inicio_mes = obra.inicio_mes + obra.duracao_meses; // fim da obra
    pos.travado_inicio = true;
  }
  return EVENTOS_CRONOGRAMA
    .map((ev) => porEvento.get(ev))
    .filter((e): e is LinhaCronograma => Boolean(e));
}

/**
 * Resolve início/duração de uma linha de custo ancorada a um evento do
 * cronograma. Para 'customizado' (ou evento ausente) retorna null — campos
 * livres, não são sobrescritos.
 */
export function ancorarLinhaCusto(
  cronogramaEvento: string,
  cronograma: LinhaCronograma[],
): { inicio_mes: number; duracao_meses: number } | null {
  if (cronogramaEvento === 'customizado') return null;
  const ev = cronograma.find((e) => e.evento === cronogramaEvento);
  if (!ev) return null;
  return { inicio_mes: ev.inicio_mes, duracao_meses: ev.duracao_meses };
}

export interface ResultadoTravamentoCusto {
  /** Campos a aplicar em `dados` — vazio quando a linha não está ancorada. */
  campos: Partial<{ inicio_mes: number; duracao_meses: number }>;
  /** Presente quando o PATCH violou o travamento — a rota deve responder 422. */
  erroCampoTravado?: string;
}

/**
 * Decide o que fazer com início/duração de uma linha de custo dada a âncora
 * final (#249) — usada pelos dois ramos do PATCH (fase e evento), que têm a
 * mesma regra: início E duração são simétricos, os dois SEMPRE derivados
 * quando ancorada.
 *
 * - `trocandoAncora`: a própria âncora está sendo alterada nesta chamada
 *   (fase_ancora_id ou cronograma_evento vieram no corpo). Nesse caso início e
 *   duração são derivados incondicionalmente — um valor enviado junto é
 *   ignorado, pois a linha está migrando de âncora, sem "override" coerente a
 *   preservar.
 * - Permanecendo na mesma âncora (`trocandoAncora=false`): início e duração
 *   continuam calculados; enviar QUALQUER um dos dois é erro — o cliente
 *   precisa trocar a âncora para `customizado` para editar. Antes só início
 *   travava (duração podia ser sobrescrita em silêncio enquanto a linha
 *   continuava ancorada — a assimetria que esta issue corrige).
 * - `ancora === null`: linha não ancorada (customizado) — nada a derivar/travar.
 */
export function resolverTravamentoCusto(
  trocandoAncora: boolean,
  ancora: { inicio_mes: number; duracao_meses: number } | null,
  enviouInicio: boolean,
  enviouDuracao: boolean,
  mensagemErro: string,
): ResultadoTravamentoCusto {
  if (!ancora) return { campos: {} };
  if (trocandoAncora) {
    return { campos: { inicio_mes: ancora.inicio_mes, duracao_meses: ancora.duracao_meses } };
  }
  if (enviouInicio || enviouDuracao) {
    return { campos: {}, erroCampoTravado: mensagemErro };
  }
  return { campos: {} };
}

/**
 * Resolve início/duração de uma linha de custo ancorada a uma FASE do
 * Cronograma (#167 — só depois do #168 separar fases de Cronograma/Receitas
 * era seguro oferecer isso: antes, a lista de fases misturava as duas telas).
 * `null` = `fase_ancora_id` inválido (fase inexistente, de outro estudo, ou
 * do tipo `receita` — só fases `cronograma` servem de âncora).
 */
async function ancorarLinhaCustoEmFase(
  req: Request,
  estudoId: number,
  faseAncoraId: number,
): Promise<{ inicio_mes: number; duracao_meses: number } | null> {
  const fase = await req.dados!.buscar('avancado_fases', faseAncoraId);
  if (!fase || Number(fase.estudo_id) !== estudoId || fase.tipo !== 'cronograma') return null;
  return { inicio_mes: Number(fase.inicio_mes) || 0, duracao_meses: Number(fase.duracao_meses) || 1 };
}

// Curva S padrão: distribuição em S normalizada para 12 meses (soma = 100).
// O motor interpola para a duração real de cada linha.
export function curvaSPadrao(): { mes: number; pct: number }[] {
  const pcts = [2, 4, 7, 10, 13, 14, 14, 13, 10, 7, 4, 2];
  return pcts.map((pct, i) => ({ mes: i + 1, pct }));
}

/** Valida o array `valores` de uma curva: {mes, pct}[] com soma 100 (±0.01). */
export function validarValoresCurva(valores: any): string | null {
  if (!Array.isArray(valores) || valores.length === 0) return 'valores deve ser uma lista de { mes, pct }';
  let soma = 0;
  for (const v of valores) {
    const pct = Number(v?.pct);
    if (!Number.isFinite(pct) || pct < 0) return 'cada linha da curva precisa de pct numérico ≥ 0';
    soma += pct;
  }
  if (Math.abs(soma - 100) > 0.01) return `a soma da curva deve ser 100% (atual: ${soma.toFixed(2)}%)`;
  return null;
}

/**
 * Valida o JSON de absorção de vendas de uma FASE (Lote 6 · #20).
 * Modelo vigente: apenas **Distribuído** em 3 períodos — Pré-lançamento+Lançamento
 * (bloco `lancamento`), Durante a obra (bloco `obra`) e Pós-obra (derivado). NÃO
 * há mais validação de soma = 100% (o Pós-obra é calculado). Modos legados
 * (`linear`/`personalizado`) são tolerados na leitura, sem exigência de soma.
 */
export function validarAbsorcao(a: any): string | null {
  if (a === null || a === undefined) return null; // ausente = default
  if (typeof a !== 'object') return 'absorcao deve ser um objeto';
  const modo = a.modo;
  if (modo !== undefined && !['linear', 'distribuido', 'personalizado'].includes(modo)) {
    return 'absorcao.modo deve ser distribuido (ou linear/personalizado legado)';
  }
  if (modo === 'distribuido' && a.blocos !== undefined && !Array.isArray(a.blocos)) {
    return 'absorcao.blocos deve ser uma lista';
  }
  return null;
}

/**
 * Valida o JSON de fluxo de pagamento de uma FASE (Lote 6 · #20).
 * O contrato canônico (`componentes`) exige soma de 100%. Entrada e
 * Parcelamento ainda aceitam múltiplas linhas (lista) ou objeto único legado;
 * nesse shape o Repasse é derivado (100 − Σentrada − Σparcelas).
 */
export function validarFluxoPagamento(fp: any): string | null {
  if (fp === null || fp === undefined) return null; // ausente = default
  if (typeof fp !== 'object') return 'fluxo_pagamento deve ser um objeto';
  // #230: o contrato novo é opt-in (`componentes`). O JSON legado continua
  // aceito sem reinterpretação; a soma de 100% só é obrigatória no shape novo.
  if (fp.componentes !== undefined) {
    if (!Array.isArray(fp.componentes) || fp.componentes.length === 0) {
      return 'fluxo_pagamento.componentes deve ser uma lista não vazia';
    }
    const tipos = ['imediato', 'prazo_fixo', 'ate_marco', 'concentrado'];
    let soma = 0;
    for (const c of fp.componentes) {
      if (!c || typeof c !== 'object' || !tipos.includes(c.tipo)) return 'componente de pagamento tem tipo inválido';
      const pct = Number(c.participacaoPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 'participacaoPct deve ser um percentual entre 0 e 100';
      soma += pct;
      if (c.tipo === 'prazo_fixo'
        && (!Number.isInteger(Number(c.prazoMeses)) || Number(c.prazoMeses) < 1)) {
        return 'prazo_fixo requer prazoMeses inteiro maior que zero';
      }
      if (c.tipo === 'ate_marco'
        && (!Number.isInteger(Number(c.marcoMes)) || Number(c.marcoMes) < 0)) {
        return 'ate_marco requer marcoMes inteiro não negativo';
      }
      if (c.tipo === 'concentrado' && (!Number.isInteger(Number(c.mesPagamento)) || Number(c.mesPagamento) < 0)) {
        return 'concentrado requer mesPagamento inteiro não negativo';
      }
    }
    if (Math.abs(soma - 100) > 0.01) return `a soma dos componentes deve ser 100% (atual: ${soma.toFixed(2)}%)`;
    return null;
  }
  for (const chave of ['entrada', 'parcelas']) {
    const v = fp[chave];
    if (v !== undefined && v !== null && !Array.isArray(v) && typeof v !== 'object') {
      return `fluxo_pagamento.${chave} deve ser uma lista de linhas (ou objeto)`;
    }
  }
  return null;
}

// Defaults de uma fase nova (absorção Distribuída + fluxo com listas de linhas).
export function absorcaoPadrao(): Record<string, any> {
  return {
    modo: 'distribuido',
    correcao_estoque: false,
    blocos: [
      { evento: 'lancamento', pct: 30 }, // Pré-lançamento + Lançamento
      { evento: 'obra', pct: 40 },        // Durante a obra
      { evento: 'pos_obra', pct: 0 },     // Pós-obra: derivado = 100 − 30 − 40 = 30
    ],
  };
}
export function fluxoPagamentoPadrao(): Record<string, any> {
  return {
    comissao: { ativo: true, tipo: 'embutida', pct: 6 },
    ret: { ativo: false, pct: 4 },
    entrada: [{ pct: 15, parcelas: 1 }],
    parcelas: [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 }],
    repasse: { apos_entrega_meses: 1 }, // #345: repasse travado em 1 mês após a obra; pct derivado = 100 − 15 − 15 = 70
  };
}

const GRUPOS_CUSTO = ['terreno', 'obra', 'diretos', 'indireto', 'financeiro'];
const UNIDADES_ORCAMENTO = ['rs', 'rs_m2_priv', 'rs_m2_terreno', 'pct_vgv', 'pct_receita'];
const EVENTOS_ANCORA = ['planejamento', 'pre_lancamento', 'lancamento', 'obra', 'pos_obra', 'customizado']; // #339
// `unit_delivery`/`sales_revenue` (#194): só a linha de Preço do Terreno usa —
// o motor (fluxo-caixa-motor.ts) ignora o campo em qualquer outra linha.
const MODOS_DISTRIBUICAO = ['fixo', 'unit_delivery', 'sales_revenue'];

// #335: reverte a #179/#256 — categoria de custo não trava mais renomeação,
// remoção nem some do combo. `avancado_linhas_custo.obrigatoria` continua no
// schema (migração 025 zera o dado existente), mas nada volta a escrevê-la
// nem a lê-la para bloquear operação; uma categoria repetida no mesmo grupo
// vira alerta na Reconciliação (`validarCustosDuplicados`, fluxo-invariantes.ts),
// não bloqueio.
const REGEX_MES_ANO = /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{4}$/i;

/** Projeta só os campos listados, ignorando ausentes (para cópia de linhas). */
export function extrairCampos(obj: any, campos: string[]): Record<string, any> {
  const saida: Record<string, any> = {};
  for (const c of campos) {
    if (obj?.[c] !== undefined) saida[c] = obj[c];
  }
  return saida;
}

// ─────────────────────────────────────────────────────────────────
// Guards e helpers de rota
// ─────────────────────────────────────────────────────────────────

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

/** Carrega o estudo e garante nível avançado (422 NIVEL_INVALIDO se preliminar). */
async function estudoAvancado(req: Request, res: Response): Promise<any | null> {
  const estudoId = parseInt(req.params.id);
  if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return null; }
  const estudo = await req.dados!.buscar('estudos', estudoId);
  if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return null; }
  if (estudo.nivel_analise !== 'avancado') {
    erro(res, 422, 'NIVEL_INVALIDO', 'Este estudo é Preliminar — o Fluxo de Caixa existe apenas no nível Avançado');
    return null;
  }
  return estudo;
}

/** Leitura: exige membro do estudo (ou admin de app). */
async function exigirLeitura(req: Request, res: Response, estudo: any): Promise<boolean> {
  const perm = await exigirMembro(req, estudo.id);
  if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return false; }
  return true;
}

/**
 * Escrita: editor+ em status abertos; apenas aprovador quando o estudo está
 * Aprovado/Reprovado/Arquivado (mesma regra do PATCH /estudos/:id).
 */
async function exigirEscrita(req: Request, res: Response, estudo: any): Promise<boolean> {
  const travado = estudo.status === 'aprovado' || estudo.status === 'reprovado' || estudo.status === 'arquivado';
  const perm = travado ? await exigirAprovador(req, estudo.id) : await exigirEditor(req, estudo.id);
  if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar este estudo'); return false; }
  return true;
}

function exigirAdminApp(req: Request, res: Response): boolean {
  if (req.contexto?.nivelApp !== 'admin') {
    erro(res, 403, 'SEM_PERMISSAO', 'Apenas administradores podem gerenciar curvas');
    return false;
  }
  return true;
}

/**
 * Lê o cronograma persistido do estudo; completa com defaults os eventos
 * ausentes. #330: quando `estudo.tem_pre_lancamento === false`, o evento
 * `pre_lancamento` é excluído do resultado — `recalcularTravados` ancora o
 * Lançamento direto no fim do Planejamento nesse caso.
 */
async function lerCronograma(req: Request, estudo: { id: number; tem_pre_lancamento?: unknown }): Promise<{ linhas: LinhaCronograma[]; ids: Map<string, number> }> {
  const r = await req.dados!.listar('avancado_cronograma', { filtros: { estudo_id: estudo.id }, por_pagina: 10 });
  const ids = new Map<string, number>();
  const salvos = new Map<string, LinhaCronograma>();
  for (const linha of r.dados) {
    ids.set(String(linha.evento), Number(linha.id));
    salvos.set(String(linha.evento), {
      evento: linha.evento,
      inicio_mes: Number(linha.inicio_mes),
      duracao_meses: Number(linha.duracao_meses),
      travado_inicio: Boolean(linha.travado_inicio),
      travado_duracao: Boolean(linha.travado_duracao),
    });
  }
  const temPreLancamento = estudo.tem_pre_lancamento !== false;
  const padrao = cronogramaPadrao().filter((p) => temPreLancamento || p.evento !== 'pre_lancamento');
  const linhas = recalcularTravados(padrao.map((p) => salvos.get(p.evento) ?? p));
  return { linhas, ids };
}

/** Persiste (upsert) as 5 linhas do cronograma e retorna o estado final. */
async function salvarCronograma(
  req: Request,
  estudoId: number,
  linhas: LinhaCronograma[],
  ids: Map<string, number>,
): Promise<void> {
  for (const linha of linhas) {
    const id = ids.get(linha.evento);
    const valores = {
      inicio_mes: linha.inicio_mes,
      duracao_meses: linha.duracao_meses,
      travado_inicio: linha.travado_inicio,
      travado_duracao: linha.travado_duracao,
    };
    if (id) await req.dados!.atualizar('avancado_cronograma', id, valores);
    else await req.dados!.criar('avancado_cronograma', { estudo_id: estudoId, evento: linha.evento, ...valores });
  }
}

/** Reancora as linhas de custo presas a eventos do cronograma recém-alterado. */
async function reancorarCustos(req: Request, estudoId: number, cronograma: LinhaCronograma[]): Promise<number> {
  const r = await req.dados!.listar('avancado_linhas_custo', { filtros: { estudo_id: estudoId }, por_pagina: 500 });
  let alteradas = 0;
  for (const custo of r.dados) {
    const ancora = ancorarLinhaCusto(String(custo.cronograma_evento), cronograma);
    if (!ancora) continue;
    if (Number(custo.inicio_mes) !== ancora.inicio_mes || Number(custo.duracao_meses) !== ancora.duracao_meses) {
      await req.dados!.atualizar('avancado_linhas_custo', custo.id, ancora);
      alteradas++;
    }
  }
  return alteradas;
}

// ─────────────────────────────────────────────────────────────────
// Parâmetros globais do fluxo
// ─────────────────────────────────────────────────────────────────

rotasAvancado.get('/estudos/:id/avancado/parametros', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    res.json({
      data_inicio_projeto: estudo.data_inicio_projeto ?? null,
      taxa_desconto_aa: estudo.taxa_desconto_aa !== null && estudo.taxa_desconto_aa !== undefined
        ? Number(estudo.taxa_desconto_aa) : 12,
      tem_pre_lancamento: estudo.tem_pre_lancamento !== false,
    });
  } catch (e: any) {
    console.error('Erro em GET /avancado/parametros:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/parametros', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const dados: Record<string, any> = {};
    if (req.body.data_inicio_projeto !== undefined) {
      const v = String(req.body.data_inicio_projeto || '').toLowerCase().trim();
      if (v && !REGEX_MES_ANO.test(v)) {
        erro(res, 400, 'DATA_INVALIDA', 'data_inicio_projeto deve estar no formato mmm/AAAA (ex.: jan/2027)');
        return;
      }
      dados.data_inicio_projeto = v || null;
    }
    if (req.body.taxa_desconto_aa !== undefined) {
      const t = Number(req.body.taxa_desconto_aa);
      if (!Number.isFinite(t) || t < 0 || t > 100) {
        erro(res, 400, 'TAXA_INVALIDA', 'taxa_desconto_aa deve ser um percentual entre 0 e 100');
        return;
      }
      dados.taxa_desconto_aa = t;
    }
    if (req.body.tem_pre_lancamento !== undefined) {
      dados.tem_pre_lancamento = Boolean(req.body.tem_pre_lancamento);
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }

    const atualizado = await req.dados!.atualizar('estudos', estudo.id, dados);
    // `atualizar` devolve `null` quando o registro sumiu entre a leitura e a
    // escrita. Sem esta guarda o acesso às propriedades abaixo estourava e o
    // catch devolvia 500 ERRO_INTERNO — 404 é a resposta correta, e é o mesmo
    // tratamento que o PATCH de curvas já dava (`CURVA_NAO_ENCONTRADA`).
    if (!atualizado) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    res.json({
      data_inicio_projeto: atualizado.data_inicio_projeto ?? null,
      taxa_desconto_aa: Number(atualizado.taxa_desconto_aa ?? 12),
      tem_pre_lancamento: atualizado.tem_pre_lancamento !== false,
    });
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/parametros:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ─────────────────────────────────────────────────────────────────
// Cronograma
// ─────────────────────────────────────────────────────────────────

rotasAvancado.get('/estudos/:id/avancado/cronograma', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    // Sem escrita no GET: eventos ainda não salvos vêm com defaults calculados.
    const { linhas } = await lerCronograma(req, estudo);
    res.json({ dados: linhas });
  } catch (e: any) {
    console.error('Erro em GET /avancado/cronograma:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

/**
 * Aplica um delta `{inicio_mes?, duracao_meses?}` a UM evento (mutação local,
 * não persistida) — extraída para que o endpoint em lote (#252) valide cada
 * evento do lote exatamente como o antigo PATCH de evento único validava.
 * Retorna a falha (código + mensagem HTTP) ou `null` se aplicou.
 */
export function aplicarDeltaEvento(
  alvo: LinhaCronograma,
  delta: { inicio_mes?: unknown; duracao_meses?: unknown },
): { codigo: string; mensagem: string } | null {
  if (delta.inicio_mes !== undefined) {
    if (alvo.travado_inicio) return { codigo: 'CAMPO_TRAVADO', mensagem: `O início de ${alvo.evento} é calculado automaticamente` };
    const v = Number(delta.inicio_mes);
    if (!Number.isInteger(v) || v < 0) return { codigo: 'INICIO_INVALIDO', mensagem: 'inicio_mes deve ser inteiro ≥ 0 (mês 0 = início do projeto)' };
    alvo.inicio_mes = v;
  }
  if (delta.duracao_meses !== undefined) {
    if (alvo.travado_duracao) return { codigo: 'CAMPO_TRAVADO', mensagem: `A duração de ${alvo.evento} é calculada automaticamente` };
    const v = Number(delta.duracao_meses);
    if (!Number.isInteger(v) || v < 1) return { codigo: 'DURACAO_INVALIDA', mensagem: 'duracao_meses deve ser inteiro ≥ 1' };
    alvo.duracao_meses = v;
  }
  return null;
}

/**
 * #252: salvamento em lote do cronograma — substitui o antigo
 * `PATCH .../cronograma/:evento` (um evento por chamada, removido: "UI e API
 * andam sempre juntas" — a tela passou a usar só o lote, mesmo para 1 evento
 * só). Um clique em "Salvar cronograma" na tela envia todos os eventos
 * alterados numa ÚNICA chamada, em vez de um PATCH por evento (que reancorava
 * custos e emitia um toast a cada um).
 *
 * Atomicidade de VALIDAÇÃO, não de banco (não há transação disponível aqui —
 * ver CLAUDE.md do monorepo, apps segregadas por conta só usam `req.dados`):
 * todo delta do lote é validado contra o cronograma lido UMA vez, antes de
 * qualquer escrita — se um evento falhar, nada é persistido, nenhum é. Só
 * depois de todos passarem é que `recalcularTravados`/`salvarCronograma`/
 * `reancorarCustos` rodam, cada um exatamente UMA vez para o lote inteiro.
 */
rotasAvancado.patch('/estudos/:id/avancado/cronograma', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const eventos = req.body.eventos;
    if (!eventos || typeof eventos !== 'object' || Array.isArray(eventos) || Object.keys(eventos).length === 0) {
      erro(res, 400, 'NENHUM_CAMPO', 'eventos deve ser um objeto { evento: { inicio_mes?, duracao_meses? } } com ao menos uma entrada');
      return;
    }
    for (const evento of Object.keys(eventos)) {
      if (!EVENTOS_CRONOGRAMA.includes(evento as EventoCronograma)) {
        erro(res, 400, 'EVENTO_INVALIDO', `evento "${evento}" deve ser um de: ${EVENTOS_CRONOGRAMA.join(', ')}`);
        return;
      }
    }

    const { linhas, ids } = await lerCronograma(req, estudo);

    // Fase 1: valida TODOS os deltas contra o cronograma lido, sem escrever
    // nada — se qualquer um falhar, a resposta é 422/400 e o rascunho do
    // cliente permanece intacto (nada foi persistido).
    for (const [evento, delta] of Object.entries(eventos)) {
      const alvo = linhas.find((l) => l.evento === evento);
      // #330: pre_lancamento some de `linhas` quando o estudo tem a fase
      // desabilitada — sem esta guarda o `!` original estourava (TypeError).
      if (!alvo) { erro(res, 422, 'EVENTO_DESABILITADO', `${evento} não existe no cronograma deste estudo`); return; }
      const falha = aplicarDeltaEvento(alvo, delta as Record<string, unknown>);
      if (falha) { erro(res, falha.codigo === 'CAMPO_TRAVADO' ? 422 : 400, falha.codigo, falha.mensagem); return; }
    }

    // Fase 2: todos os deltas validaram — recalcula, persiste e reancora
    // UMA VEZ para o cronograma inteiro (não uma vez por evento do lote).
    const recalculado = recalcularTravados(linhas);
    await salvarCronograma(req, estudo.id, recalculado, ids);
    const custosReancorados = await reancorarCustos(req, estudo.id, recalculado);
    res.json({ dados: recalculado, custos_reancorados: custosReancorados });
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/cronograma:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ─────────────────────────────────────────────────────────────────
// Curvas (globais da instância)
// ─────────────────────────────────────────────────────────────────

async function semearCurvaS(req: Request): Promise<boolean> {
  const existentes = await req.dados!.listar('avancado_curvas', { filtros: { is_padrao: true }, por_pagina: 1 });
  if (existentes.total > 0) return false;
  try {
    await req.dados!.criar('avancado_curvas', {
      nome: 'Curva S',
      is_padrao: true,
      valores: curvaSPadrao(),
      criado_por: req.contexto?.usuario?.id ?? null,
    });
    return true;
  } catch {
    return false; // corrida com outra requisição (nome único) — já existe
  }
}

rotasAvancado.get('/avancado/curvas', async (req: Request, res: Response) => {
  try {
    // Criação lazy da Curva S na primeira leitura (idempotente).
    await semearCurvaS(req);
    const r = await req.dados!.listar('avancado_curvas', { ordenar: 'nome', ordem: 'asc', por_pagina: 200 });
    res.json(r);
  } catch (e: any) {
    console.error('Erro em GET /avancado/curvas:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.post('/avancado/curvas/semear', async (req: Request, res: Response) => {
  try {
    if (!exigirAdminApp(req, res)) return;
    const criada = await semearCurvaS(req);
    res.json({ ok: true, criadas: criada ? 1 : 0 });
  } catch (e: any) {
    console.error('Erro em POST /avancado/curvas/semear:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.post('/avancado/curvas', async (req: Request, res: Response) => {
  try {
    if (!exigirAdminApp(req, res)) return;
    const nome = String(req.body.nome || '').trim();
    if (!nome) { erro(res, 400, 'NOME_OBRIGATORIO', 'Informe o nome da curva'); return; }
    const invalido = validarValoresCurva(req.body.valores);
    if (invalido) { erro(res, 400, 'CURVA_INVALIDA', invalido); return; }

    const existente = await req.dados!.listar('avancado_curvas', { filtros: { nome }, por_pagina: 1 });
    if (existente.total > 0) { erro(res, 409, 'CURVA_DUPLICADA', `Já existe uma curva chamada "${nome}"`); return; }

    const criada = await req.dados!.criar('avancado_curvas', {
      nome,
      is_padrao: false,
      valores: req.body.valores,
      criado_por: req.contexto?.usuario?.id ?? null,
    });
    res.status(201).json(criada);
  } catch (e: any) {
    console.error('Erro em POST /avancado/curvas:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/avancado/curvas/:cid', async (req: Request, res: Response) => {
  try {
    if (!exigirAdminApp(req, res)) return;
    const id = parseInt(req.params.cid);
    if (isNaN(id)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const dados: Record<string, any> = {};
    if (req.body.nome !== undefined) {
      const nome = String(req.body.nome || '').trim();
      if (!nome) { erro(res, 400, 'NOME_OBRIGATORIO', 'Informe o nome da curva'); return; }
      dados.nome = nome;
    }
    if (req.body.valores !== undefined) {
      const invalido = validarValoresCurva(req.body.valores);
      if (invalido) { erro(res, 400, 'CURVA_INVALIDA', invalido); return; }
      dados.valores = req.body.valores;
    }
    // is_padrao nunca é editável via API.
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }

    const atualizada = await req.dados!.atualizar('avancado_curvas', id, dados);
    if (!atualizada) { erro(res, 404, 'CURVA_NAO_ENCONTRADA', 'Curva não encontrada'); return; }
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/curvas/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.delete('/avancado/curvas/:cid', async (req: Request, res: Response) => {
  try {
    if (!exigirAdminApp(req, res)) return;
    const id = parseInt(req.params.cid);
    if (isNaN(id)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const curva = await req.dados!.buscar('avancado_curvas', id);
    if (!curva) { erro(res, 404, 'CURVA_NAO_ENCONTRADA', 'Curva não encontrada'); return; }
    if (curva.is_padrao) { erro(res, 422, 'CURVA_PADRAO', 'A Curva S padrão não pode ser excluída'); return; }
    await req.dados!.deletar('avancado_curvas', id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/curvas/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});
// ─────────────────────────────────────────────────────────────────
// Receitas (Lote 6 · #19–21): catálogo de Tipologias (nível estudo) +
// Fases (Absorção/Fluxo por fase) + Alocações de venda (tipologia → fase).
//
// Modelo:
//  - avancado_tipologias  = catálogo do estudo (cadastrado em Empreendimento).
//  - avancado_fases       = fase estruturada, dona da Absorção e do Fluxo de
//                           Pagamento (antes viviam na linha de receita).
//  - avancado_alocacoes   = venda de N unidades de uma tipologia, a um preço/m²,
//                           dentro de uma fase (várias linhas por tipologia).
//
// GET /receitas devolve as FASES no formato que o motor do fluxo consome
// (fase = "linha de receita"; alocações joinadas ao catálogo = "tipologias"),
// mantendo tela-fluxo-ver/gráficos/exportar sem mudança.
// ─────────────────────────────────────────────────────────────────

const TIPOS_UNIDADE = ['apartamento', 'cobertura', 'loja', 'lote', 'outro'];
// #253: `unidades_permutadas` retirada da entrada — a fonte de verdade da
// permuta física do Avançado agora é a linha de custo Preço/Permuta física
// (#266/#267/#268: permuta_tipologia_id + permuta_quantidade + valor
// declarado). A coluna em si permanece no schema (dado histórico
// preservado); só o CRUD deixa de ler/escrever nela.
const CAMPOS_TIPOLOGIA = ['nome', 'tipo_unidade', 'area_privativa_m2', 'dormitorios', 'vagas', 'quantidade', 'preco_m2', 'ordem'];

// ── Catálogo de tipologias (nível estudo) ──

async function tipologiaDoEstudo(req: Request, res: Response, estudoId: number): Promise<any | null> {
  const tid = parseInt(req.params.tid);
  if (isNaN(tid)) { erro(res, 400, 'ID_INVALIDO', 'ID da tipologia inválido'); return null; }
  const tip = await req.dados!.buscar('avancado_tipologias', tid);
  if (!tip || Number(tip.estudo_id) !== estudoId) {
    erro(res, 404, 'TIPOLOGIA_NAO_ENCONTRADA', 'Tipologia não encontrada neste estudo');
    return null;
  }
  return tip;
}

rotasAvancado.get('/estudos/:id/avancado/tipologias', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    const r = await req.dados!.listar('avancado_tipologias', {
      filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
    });
    res.json(r);
  } catch (e: any) {
    console.error('Erro em GET /avancado/tipologias:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.post('/estudos/:id/avancado/tipologias', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const lote = estudo.tipo_empreendimento === 'loteamento';
    const existentes = await req.dados!.listar('avancado_tipologias', { filtros: { estudo_id: estudo.id }, por_pagina: 500 });
    const dados: Record<string, any> = {
      estudo_id: estudo.id,
      nome: lote ? 'Lote' : '',
      tipo_unidade: lote ? 'lote' : 'apartamento',
      quantidade: 0,
      ordem: existentes.total,
    };
    for (const campo of CAMPOS_TIPOLOGIA) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (!TIPOS_UNIDADE.includes(dados.tipo_unidade)) {
      erro(res, 400, 'TIPO_UNIDADE_INVALIDO', `tipo_unidade deve ser um de: ${TIPOS_UNIDADE.join(', ')}`);
      return;
    }
    const criada = await req.dados!.criar('avancado_tipologias', dados);
    res.status(201).json(criada);
  } catch (e: any) {
    console.error('Erro em POST /avancado/tipologias:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/tipologias/:tid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const tip = await tipologiaDoEstudo(req, res, estudo.id);
    if (!tip) return;

    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_TIPOLOGIA) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (dados.tipo_unidade !== undefined && !TIPOS_UNIDADE.includes(dados.tipo_unidade)) {
      erro(res, 400, 'TIPO_UNIDADE_INVALIDO', `tipo_unidade deve ser um de: ${TIPOS_UNIDADE.join(', ')}`);
      return;
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    const atualizada = await req.dados!.atualizar('avancado_tipologias', tip.id, dados);
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/tipologias/:tid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.delete('/estudos/:id/avancado/tipologias/:tid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const tip = await tipologiaDoEstudo(req, res, estudo.id);
    if (!tip) return;
    // Integridade (Lote 6 · #19): excluir uma tipologia com alocações é bloqueado.
    const usos = await req.dados!.listar('avancado_alocacoes', { filtros: { tipologia_id: tip.id }, por_pagina: 1 });
    if (usos.total > 0) {
      erro(res, 422, 'TIPOLOGIA_EM_USO', 'Esta tipologia tem alocações de venda — remova as alocações antes de excluí-la');
      return;
    }
    await req.dados!.deletar('avancado_tipologias', tip.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/tipologias/:tid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ── Fases (dona da Absorção e do Fluxo de Pagamento) ──

async function faseDoEstudo(req: Request, res: Response, estudoId: number): Promise<any | null> {
  const fid = parseInt(req.params.fid);
  if (isNaN(fid)) { erro(res, 400, 'ID_INVALIDO', 'ID da fase inválido'); return null; }
  const fase = await req.dados!.buscar('avancado_fases', fid);
  if (!fase || Number(fase.estudo_id) !== estudoId) {
    erro(res, 404, 'FASE_NAO_ENCONTRADA', 'Fase não encontrada neste estudo');
    return null;
  }
  return fase;
}

/** Alocações de uma fase (cru), ordenadas. */
async function alocacoesDaFase(req: Request, faseId: number): Promise<any[]> {
  const r = await req.dados!.listar('avancado_alocacoes', {
    filtros: { fase_id: faseId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
  });
  return r.dados;
}

const TIPOS_FASE = ['cronograma', 'receita'];

rotasAvancado.get('/estudos/:id/avancado/fases', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    // `tipo` separa as fases do Cronograma das fases de Receitas (#168) —
    // sem filtro, devolve as duas (uso legado/relatórios que precisem de tudo).
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
    if (tipo !== undefined && !TIPOS_FASE.includes(tipo)) {
      erro(res, 400, 'TIPO_INVALIDO', `tipo deve ser um de: ${TIPOS_FASE.join(', ')}`);
      return;
    }
    const filtrosFases: Record<string, any> = { estudo_id: estudo.id };
    if (tipo) filtrosFases.tipo = tipo;
    const [fases, alocacoes] = await Promise.all([
      req.dados!.listar('avancado_fases', { filtros: filtrosFases, ordenar: 'ordem', ordem: 'asc', por_pagina: 100 }),
      req.dados!.listar('avancado_alocacoes', { filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 1000 }),
    ]);
    const porFase = new Map<number, any[]>();
    for (const a of alocacoes.dados) {
      const chave = Number(a.fase_id);
      if (!porFase.has(chave)) porFase.set(chave, []);
      porFase.get(chave)!.push(a);
    }
    res.json({
      dados: fases.dados.map((f) => ({ ...f, alocacoes: porFase.get(Number(f.id)) ?? [] })),
      total: fases.total,
    });
  } catch (e: any) {
    console.error('Erro em GET /avancado/fases:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// #341: nome padrão da próxima fase — "1º Grupo"/"2º Grupo"… para Receitas
// (`tipo='receita'`, #222 renomeou o termo na tela), "Fase N" para Cronograma
// (onde "Fase" continua correto — representa tempo, não agrupamento
// comercial). Usa o MAIOR sufixo numérico já usado no nome padrão, não a
// contagem de linhas — `existentes.total + 1` repetia nome depois de apagar
// um grupo (ex.: 3 grupos, apaga o "3º Grupo", cria outro → "3º Grupo" de
// novo, colidindo se o nome ainda não tivesse sido trocado). Nomes
// renomeados pelo usuário (fora do padrão) não contam para o maior sufixo.
export function proximoNumeroFase(nomesExistentes: string[], tipo: string): number {
  const padrao = tipo === 'receita' ? /^(\d+)º Grupo$/ : /^Fase (\d+)$/;
  let maior = 0;
  for (const nome of nomesExistentes) {
    const m = padrao.exec(String(nome || '').trim());
    if (m) maior = Math.max(maior, Number(m[1]));
  }
  return maior + 1;
}

rotasAvancado.post('/estudos/:id/avancado/fases', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    // `tipo` (#168): Cronograma cria marcadores do gantt (`cronograma`);
    // Receitas cria fases estruturadas com Absorção/Fluxo de Pagamento
    // (`receita`, padrão do schema — mantém o comportamento pré-#168 para
    // chamadas legadas sem o campo). Numeração/ordem contam só dentro do
    // próprio tipo, para as duas listas não brigarem por "Fase N".
    const tipo = req.body.tipo !== undefined ? String(req.body.tipo) : 'receita';
    if (!TIPOS_FASE.includes(tipo)) {
      erro(res, 400, 'TIPO_INVALIDO', `tipo deve ser um de: ${TIPOS_FASE.join(', ')}`);
      return;
    }
    const existentes = await req.dados!.listar('avancado_fases', { filtros: { estudo_id: estudo.id, tipo }, por_pagina: 100 });
    const n = proximoNumeroFase(existentes.dados.map((f: any) => f.nome), tipo);
    const nomePadrao = tipo === 'receita' ? `${n}º Grupo` : `Fase ${n}`;
    const dados: Record<string, any> = {
      estudo_id: estudo.id,
      tipo,
      nome: String(req.body.nome || nomePadrao).trim() || nomePadrao,
      ordem: existentes.total,
    };
    if (req.body.inicio_mes !== undefined) dados.inicio_mes = Math.max(0, Number(req.body.inicio_mes) || 0);
    if (req.body.duracao_meses !== undefined) dados.duracao_meses = Math.max(1, Number(req.body.duracao_meses) || 1);
    // Absorção/Fluxo de Pagamento só fazem sentido para fases de receita — o
    // Cronograma nunca lê/edita esses campos.
    if (tipo === 'receita') {
      dados.absorcao = absorcaoPadrao();
      dados.fluxo_pagamento = fluxoPagamentoPadrao();
    }
    const criada = await req.dados!.criar('avancado_fases', dados);
    res.status(201).json({ ...criada, alocacoes: [] });
  } catch (e: any) {
    console.error('Erro em POST /avancado/fases:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/fases/:fid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const fase = await faseDoEstudo(req, res, estudo.id);
    if (!fase) return;

    const dados: Record<string, any> = {};
    if (req.body.nome !== undefined) dados.nome = String(req.body.nome).trim();
    if (req.body.ordem !== undefined) dados.ordem = Number(req.body.ordem) || 0;
    if (req.body.inicio_mes !== undefined) dados.inicio_mes = Math.max(0, Number(req.body.inicio_mes) || 0);
    if (req.body.duracao_meses !== undefined) dados.duracao_meses = Math.max(1, Number(req.body.duracao_meses) || 1);
    if (req.body.absorcao !== undefined) {
      const invalido = validarAbsorcao(req.body.absorcao);
      if (invalido) { erro(res, 400, 'ABSORCAO_INVALIDA', invalido); return; }
      dados.absorcao = req.body.absorcao;
    }
    if (req.body.fluxo_pagamento !== undefined) {
      const invalido = validarFluxoPagamento(req.body.fluxo_pagamento);
      if (invalido) { erro(res, 400, 'FLUXO_PAGAMENTO_INVALIDO', invalido); return; }
      dados.fluxo_pagamento = req.body.fluxo_pagamento;
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    const atualizada = await req.dados!.atualizar('avancado_fases', fase.id, dados);
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/fases/:fid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.delete('/estudos/:id/avancado/fases/:fid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const fase = await faseDoEstudo(req, res, estudo.id);
    if (!fase) return;
    await req.dados!.deletar('avancado_fases', fase.id); // alocações caem por cascata
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/fases/:fid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ── Alocações de venda (tipologia → fase) ──

/**
 * Saldo de unidades de uma tipologia no ESTUDO INTEIRO (#52 · trava agregada por
 * todas as fases): quantidade do catálogo − Σ unidades já alocadas em qualquer
 * fase (ignorando, opcionalmente, uma alocação em edição). Como cada tipologia
 * pertence a um único estudo, filtrar por `tipologia_id` já cobre todo o estudo.
 */
async function unidadesPermutadasNoEstudo(
  req: Request, estudoId: number, tipologiaId: number, ignorarCustoId?: number,
): Promise<number> {
  const r = await req.dados!.listar('avancado_linhas_custo', {
    filtros: { estudo_id: estudoId }, por_pagina: 1000,
  });
  return r.dados
    .filter((c: any) => Number(c.id) !== Number(ignorarCustoId)
      && c.grupo === 'terreno' && c.categoria === 'Preço' && c.subcategoria === 'Permuta física'
      && Number(c.permuta_tipologia_id) === Number(tipologiaId))
    .reduce((s: number, c: any) => s + Math.max(0, Number(c.permuta_quantidade) || 0), 0);
}

async function saldoTipologiaNoEstudo(
  req: Request, tipologia: any, ignorarAlocId?: number,
): Promise<number> {
  const r = await req.dados!.listar('avancado_alocacoes', {
    filtros: { tipologia_id: tipologia.id }, por_pagina: 1000,
  });
  const [permutadas] = await Promise.all([
    unidadesPermutadasNoEstudo(req, Number(tipologia.estudo_id), Number(tipologia.id)),
  ]);
  const vendido = r.dados
    .filter((a: any) => Number(a.id) !== Number(ignorarAlocId))
    .reduce((s: number, a: any) => s + (Number(a.unidades) || 0), 0);
  return (Number(tipologia.quantidade) || 0) - vendido - permutadas;
}

async function alocacaoDaFase(req: Request, res: Response, faseId: number): Promise<any | null> {
  const aid = parseInt(req.params.aid);
  if (isNaN(aid)) { erro(res, 400, 'ID_INVALIDO', 'ID da alocação inválido'); return null; }
  const aloc = await req.dados!.buscar('avancado_alocacoes', aid);
  if (!aloc || Number(aloc.fase_id) !== faseId) {
    erro(res, 404, 'ALOCACAO_NAO_ENCONTRADA', 'Alocação não encontrada nesta fase');
    return null;
  }
  return aloc;
}

rotasAvancado.post('/estudos/:id/avancado/fases/:fid/alocacoes', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const fase = await faseDoEstudo(req, res, estudo.id);
    if (!fase) return;

    const tipologiaId = parseInt(req.body.tipologia_id);
    if (isNaN(tipologiaId)) { erro(res, 400, 'TIPOLOGIA_OBRIGATORIA', 'Informe a tipologia da alocação'); return; }
    const tip = await req.dados!.buscar('avancado_tipologias', tipologiaId);
    if (!tip || Number(tip.estudo_id) !== estudo.id) {
      erro(res, 404, 'TIPOLOGIA_NAO_ENCONTRADA', 'Tipologia não encontrada neste estudo'); return;
    }
    const unidades = Math.max(0, Math.round(Number(req.body.unidades) || 0));
    const saldo = await saldoTipologiaNoEstudo(req, tip);
    if (saldo <= 0) {
      erro(res, 422, 'SALDO_ESGOTADO', `A tipologia "${tip.nome || 'sem nome'}" não tem unidades disponíveis (todas as fases)`); return;
    }
    if (unidades > saldo) {
      erro(res, 422, 'SALDO_EXCEDIDO', `Só há ${saldo} unidade(s) disponível(is) desta tipologia (somando todas as fases)`); return;
    }
    const existentes = await alocacoesDaFase(req, fase.id);
    const criada = await req.dados!.criar('avancado_alocacoes', {
      estudo_id: estudo.id,
      fase_id: fase.id,
      tipologia_id: tip.id,
      unidades,
      preco_m2: req.body.preco_m2 !== undefined ? Number(req.body.preco_m2) || 0 : (Number(tip.preco_m2) || 0),
      ordem: existentes.length,
    });
    res.status(201).json(criada);
  } catch (e: any) {
    console.error('Erro em POST /avancado/alocacoes:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/fases/:fid/alocacoes/:aid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const fase = await faseDoEstudo(req, res, estudo.id);
    if (!fase) return;
    const aloc = await alocacaoDaFase(req, res, Number(fase.id));
    if (!aloc) return;

    const dados: Record<string, any> = {};
    if (req.body.tipologia_id !== undefined) {
      const tid = parseInt(req.body.tipologia_id);
      const t = await req.dados!.buscar('avancado_tipologias', tid);
      if (!t || Number(t.estudo_id) !== estudo.id) { erro(res, 404, 'TIPOLOGIA_NAO_ENCONTRADA', 'Tipologia não encontrada neste estudo'); return; }
      dados.tipologia_id = tid;
    }
    if (req.body.preco_m2 !== undefined) dados.preco_m2 = Number(req.body.preco_m2) || 0;
    if (req.body.ordem !== undefined) dados.ordem = Number(req.body.ordem) || 0;
    if (req.body.unidades !== undefined) {
      const unidades = Math.max(0, Math.round(Number(req.body.unidades) || 0));
      const tipId = dados.tipologia_id ?? Number(aloc.tipologia_id);
      const tip = await req.dados!.buscar('avancado_tipologias', tipId);
      const saldo = tip ? await saldoTipologiaNoEstudo(req, tip, Number(aloc.id)) : 0;
      if (unidades > saldo) {
        erro(res, 422, 'SALDO_EXCEDIDO', `Só há ${saldo} unidade(s) disponível(is) desta tipologia (somando todas as fases)`); return;
      }
      dados.unidades = unidades;
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    const atualizada = await req.dados!.atualizar('avancado_alocacoes', aloc.id, dados);
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/alocacoes/:aid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.delete('/estudos/:id/avancado/fases/:fid/alocacoes/:aid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const fase = await faseDoEstudo(req, res, estudo.id);
    if (!fase) return;
    const aloc = await alocacaoDaFase(req, res, Number(fase.id));
    if (!aloc) return;
    await req.dados!.deletar('avancado_alocacoes', aloc.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/alocacoes/:aid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ── GET /receitas: fases no formato do motor do fluxo (compat) ──
//
// Cada fase vira uma "linha de receita"; suas alocações, joinadas ao catálogo,
// viram as "tipologias" que o motor usa para VGV (unidades × área × preço/m²).

/** Constrói as linhas de receita (formato do motor) a partir de fases+alocações+catálogo. */
export function montarLinhasReceita(fases: any[], alocacoes: any[], tipologias: any[]): any[] {
  const catalogo = new Map<number, any>(tipologias.map((t) => [Number(t.id), t]));
  const porFase = new Map<number, any[]>();
  for (const a of alocacoes) {
    const chave = Number(a.fase_id);
    if (!porFase.has(chave)) porFase.set(chave, []);
    porFase.get(chave)!.push(a);
  }
  return fases.map((f) => ({
    id: f.id,
    // #341: fallback de exibição — GET /receitas só lê fases tipo='receita'
    // (#222 renomeou o termo na tela); "Fase" continua correto só no
    // Cronograma, que não passa por aqui.
    nome: f.nome || 'Grupo',
    fase_label: f.nome || '',
    ordem: f.ordem,
    absorcao: f.absorcao,
    fluxo_pagamento: f.fluxo_pagamento,
    tipologias: (porFase.get(Number(f.id)) ?? []).map((a) => {
      const t = catalogo.get(Number(a.tipologia_id));
      return {
        id: a.id,
        tipologia_id: a.tipologia_id,
        nome: t?.nome || 'Tipologia',
        area_privativa_m2: t?.area_privativa_m2 ?? 0,
        quantidade: a.unidades,
        preco_m2: a.preco_m2,
      };
    }),
  }));
}

rotasAvancado.get('/estudos/:id/avancado/receitas', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    // Só fases de receita (#168) — as fases do Cronograma são marcadores do
    // gantt, sem alocação, e não devem virar "linhas de receita" vazias no motor.
    const [fases, alocacoes, tipologias] = await Promise.all([
      req.dados!.listar('avancado_fases', { filtros: { estudo_id: estudo.id, tipo: 'receita' }, ordenar: 'ordem', ordem: 'asc', por_pagina: 100 }),
      req.dados!.listar('avancado_alocacoes', { filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 1000 }),
      req.dados!.listar('avancado_tipologias', { filtros: { estudo_id: estudo.id }, por_pagina: 500 }),
    ]);
    const linhas = montarLinhasReceita(fases.dados, alocacoes.dados, tipologias.dados);
    res.json({ dados: linhas, total: fases.total });
  } catch (e: any) {
    console.error('Erro em GET /avancado/receitas:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ─────────────────────────────────────────────────────────────────
// Linhas de custo
// ─────────────────────────────────────────────────────────────────

rotasAvancado.get('/estudos/:id/avancado/custos', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    const r = await req.dados!.listar('avancado_linhas_custo', {
      filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
    });
    res.json(r);
  } catch (e: any) {
    console.error('Erro em GET /avancado/custos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// #266: permuta_tipologia_id/permuta_quantidade — referência de tipologia +
// quantidade entregue na linha de Preço/Permuta física (modelo/UI). O valor
// declarado que valora a permuta continua em orcamento_valor/orcamento_unidade
// (ADR: nunca derivado — ver docs/viabilidade/padrao-incorporacao.md §15.1).
// #238: permuta_financeira_base escolhe qual visão (bruta/líquida, §15.2)
// alimenta o fluxo para a linha de Preço/Permuta financeira.
const CAMPOS_CUSTO = ['grupo', 'categoria', 'subcategoria', 'orcamento_valor', 'orcamento_valor_canonico', 'orcamento_unidade', 'curva_id', 'cronograma_evento', 'fase_ancora_id', 'inicio_mes', 'duracao_meses', 'ordem', 'distribuicao_modo', 'permuta_tipologia_id', 'permuta_quantidade', 'permuta_financeira_base'];
const BASES_PERMUTA_FINANCEIRA = ['bruta', 'liquida'];

// #257: as quatro subcategorias CANÔNICAS da linha `terreno`/`Preço`. Mesma
// lista que a UI oferece (`frontend/tela-fluxo-custos.ts:58`) — aqui ela vira
// contrato, porque `<select>` não é validação: qualquer cliente da API podia
// gravar subcategoria fora da lista.
export const SUBCATEGORIAS_PRECO_TERRENO = [
  'Valor à vista', 'Parcelado', 'Permuta física', 'Permuta financeira',
];

/**
 * #257: `subcategoria` só é enum na linha `terreno`/`Preço`. Em todo o resto
 * ela é TEXTO LIVRE — a categoria `Outro` (presente nos 5 grupos) usa esse
 * campo para o usuário descrever o custo (`tela-fluxo-custos.ts:625`). Validar
 * a coluna globalmente contra a lista canônica destruiria esse campo, então a
 * regra é obrigatoriamente CONTEXTUAL.
 *
 * Vazio/nulo sempre passa: é como se limpa a subcategoria.
 *
 * O `Outro` LEGADO de `Preço` (a lista antiga era `Valor à vista`/`Permuta`/
 * `Parcelado`/`Outro`) não é convertido — a migração `015` o preservou de
 * propósito, por não existir regra de remapeamento. Ele continua no banco e
 * segue legível; o que esta função barra é **escrita nova** com ele, que é
 * exatamente o critério de aceite da issue. Como a tela só envia os campos
 * ALTERADOS no PATCH, editar outro campo de uma linha legada não passa por
 * aqui — nada quebra.
 */
export function subcategoriaPrecoValida(
  grupo: any, categoria: any, subcategoria: any,
): boolean {
  if (String(grupo) !== 'terreno' || String(categoria) !== 'Preço') return true;
  if (subcategoria === null || subcategoria === undefined || String(subcategoria).trim() === '') return true;
  return SUBCATEGORIAS_PRECO_TERRENO.includes(String(subcategoria));
}

/**
 * `atual` é a linha já gravada, e só o PATCH a tem. Ela existe porque o PATCH
 * manda apenas os campos alterados: num `{ subcategoria: 'X' }` isolado, o
 * grupo e a categoria que definem o contexto vêm da linha, não do payload.
 */
function validarCamposCusto(
  res: Response, dados: Record<string, any>, atual?: Record<string, any> | null,
): boolean {
  if (dados.grupo !== undefined && !GRUPOS_CUSTO.includes(dados.grupo)) {
    erro(res, 400, 'GRUPO_INVALIDO', `grupo deve ser um de: ${GRUPOS_CUSTO.join(', ')}`);
    return false;
  }
  if (dados.orcamento_unidade !== undefined && !UNIDADES_ORCAMENTO.includes(dados.orcamento_unidade)) {
    erro(res, 400, 'UNIDADE_INVALIDA', `orcamento_unidade deve ser um de: ${UNIDADES_ORCAMENTO.join(', ')}`);
    return false;
  }
  if (dados.cronograma_evento !== undefined && !EVENTOS_ANCORA.includes(dados.cronograma_evento)) {
    erro(res, 400, 'EVENTO_INVALIDO', `cronograma_evento deve ser um de: ${EVENTOS_ANCORA.join(', ')}`);
    return false;
  }
  if (dados.distribuicao_modo !== undefined && !MODOS_DISTRIBUICAO.includes(dados.distribuicao_modo)) {
    erro(res, 400, 'MODO_DISTRIBUICAO_INVALIDO', `distribuicao_modo deve ser um de: ${MODOS_DISTRIBUICAO.join(', ')}`);
    return false;
  }
  if (dados.permuta_quantidade !== undefined && dados.permuta_quantidade !== null
    && (!Number.isInteger(Number(dados.permuta_quantidade)) || Number(dados.permuta_quantidade) < 0)) {
    erro(res, 400, 'PERMUTA_QUANTIDADE_INVALIDA', 'permuta_quantidade deve ser um inteiro ≥ 0');
    return false;
  }
  if (dados.permuta_financeira_base !== undefined && !BASES_PERMUTA_FINANCEIRA.includes(dados.permuta_financeira_base)) {
    erro(res, 400, 'PERMUTA_FINANCEIRA_BASE_INVALIDA', `permuta_financeira_base deve ser um de: ${BASES_PERMUTA_FINANCEIRA.join(', ')}`);
    return false;
  }
  // #257: grupo/categoria efetivos = o que o payload manda, senão o que a linha
  // já tem — sem isso um PATCH de `subcategoria` sozinho não teria contexto.
  if (dados.subcategoria !== undefined) {
    const grupo = dados.grupo !== undefined ? dados.grupo : atual?.grupo;
    const categoria = dados.categoria !== undefined ? dados.categoria : atual?.categoria;
    if (!subcategoriaPrecoValida(grupo, categoria, dados.subcategoria)) {
      erro(res, 400, 'SUBCATEGORIA_INVALIDA',
        `subcategoria de Preço (terreno) deve ser uma de: ${SUBCATEGORIAS_PRECO_TERRENO.join(', ')}`);
      return false;
    }
  }
  return true;
}

/** #266: `permuta_tipologia_id` precisa referenciar uma tipologia do MESMO estudo. */
async function validarPermutaFisica(
  req: Request, res: Response, estudoId: number, dados: Record<string, any>, atual?: Record<string, any> | null,
): Promise<boolean> {
  const grupo = dados.grupo !== undefined ? dados.grupo : atual?.grupo;
  const categoria = dados.categoria !== undefined ? dados.categoria : atual?.categoria;
  const subcategoria = dados.subcategoria !== undefined ? dados.subcategoria : atual?.subcategoria;
  if (grupo !== 'terreno' || categoria !== 'Preço' || subcategoria !== 'Permuta física') return true;
  const tipologiaId = dados.permuta_tipologia_id !== undefined ? dados.permuta_tipologia_id : atual?.permuta_tipologia_id;
  const quantidade = dados.permuta_quantidade !== undefined ? dados.permuta_quantidade : atual?.permuta_quantidade;
  if (tipologiaId === null || tipologiaId === undefined || tipologiaId === '') {
    erro(res, 400, 'PERMUTA_TIPOLOGIA_OBRIGATORIA', 'Permuta física exige uma tipologia');
    return false;
  }
  if (!Number.isInteger(Number(quantidade)) || Number(quantidade) < 1) {
    erro(res, 400, 'PERMUTA_QUANTIDADE_OBRIGATORIA', 'Permuta física exige pelo menos uma unidade');
    return false;
  }
  const tip = await req.dados!.buscar('avancado_tipologias', tipologiaId);
  if (!tip || Number(tip.estudo_id) !== estudoId) return false;
  const vendida = await req.dados!.listar('avancado_alocacoes', { filtros: { tipologia_id: tipologiaId }, por_pagina: 1000 });
  const custos = await req.dados!.listar('avancado_linhas_custo', { filtros: { estudo_id: estudoId }, por_pagina: 1000 });
  const usada = vendida.dados.reduce((sum: number, a: any) => sum + (Number(a.unidades) || 0), 0);
  const reservada = custos.dados
    .filter((c: any) => Number(c.id) !== Number(atual?.id)
      && c.grupo === 'terreno' && c.categoria === 'Preço' && c.subcategoria === 'Permuta física'
      && Number(c.permuta_tipologia_id) === Number(tipologiaId))
    .reduce((sum: number, c: any) => sum + Math.max(0, Number(c.permuta_quantidade) || 0), 0);
  const disponivel = (Number(tip.quantidade) || 0) - usada - reservada;
  if (Number(quantidade) > disponivel) {
    erro(res, 422, 'PERMUTA_SALDO_EXCEDIDO', `Só há ${disponivel} unidade(s) disponível(is) para permuta desta tipologia`);
    return false;
  }
  return true;
}

async function validarPermutaTipologia(
  req: Request, res: Response, estudoId: number, permutaTipologiaId: any,
): Promise<boolean> {
  if (permutaTipologiaId === undefined || permutaTipologiaId === null) return true;
  const tip = await req.dados!.buscar('avancado_tipologias', permutaTipologiaId);
  if (!tip || Number(tip.estudo_id) !== estudoId) {
    erro(res, 400, 'PERMUTA_TIPOLOGIA_INVALIDA', 'permuta_tipologia_id deve ser uma tipologia deste estudo');
    return false;
  }
  return true;
}

rotasAvancado.post('/estudos/:id/avancado/custos', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const lote = estudo.tipo_empreendimento === 'loteamento';
    const dados: Record<string, any> = {
      estudo_id: estudo.id,
      grupo: 'indireto',
      orcamento_unidade: lote ? 'rs_m2_terreno' : 'rs',
      cronograma_evento: 'customizado',
      inicio_mes: 0,
      duracao_meses: 1,
      ordem: 0,
    };
    for (const campo of CAMPOS_CUSTO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (!validarCamposCusto(res, dados)) return;
    if (!(await validarPermutaTipologia(req, res, estudo.id, dados.permuta_tipologia_id))) return;
    if (!(await validarPermutaFisica(req, res, estudo.id, dados))) return;
    if (dados.grupo === 'terreno' && dados.categoria === 'Preço' && dados.subcategoria === 'Permuta física') {
      dados.orcamento_valor = null;
      dados.orcamento_valor_canonico = null;
      dados.orcamento_unidade = 'rs';
    }

    // Ancoragem: fase do Cronograma (#167) tem prioridade sobre evento fixo —
    // as duas são mutuamente exclusivas (o frontend nunca manda as duas).
    // #249: início E duração são sempre DERIVADOS da âncora — símetrico nos
    // dois campos; um `duracao_meses` enviado junto é ignorado (a linha nasce
    // ancorada, não há "override inicial" a preservar).
    if (dados.fase_ancora_id !== undefined && dados.fase_ancora_id !== null) {
      const ancoraFase = await ancorarLinhaCustoEmFase(req, estudo.id, Number(dados.fase_ancora_id));
      if (!ancoraFase) {
        erro(res, 400, 'FASE_ANCORA_INVALIDA', 'fase_ancora_id deve ser uma fase do Cronograma deste estudo');
        return;
      }
      dados.cronograma_evento = 'customizado';
      dados.inicio_mes = ancoraFase.inicio_mes;
      dados.duracao_meses = ancoraFase.duracao_meses;
    } else {
      // Ancoragem: evento ≠ customizado herda início/duração do cronograma.
      const ancora = ancorarLinhaCusto(String(dados.cronograma_evento), (await lerCronograma(req, estudo)).linhas);
      if (ancora) {
        dados.inicio_mes = ancora.inicio_mes;
        dados.duracao_meses = ancora.duracao_meses;
      }
    }

    const criada = await req.dados!.criar('avancado_linhas_custo', dados);
    res.status(201).json(criada);
  } catch (e: any) {
    console.error('Erro em POST /avancado/custos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/custos/:cid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const cid = parseInt(req.params.cid);
    if (isNaN(cid)) { erro(res, 400, 'ID_INVALIDO', 'ID da linha de custo inválido'); return; }
    const custo = await req.dados!.buscar('avancado_linhas_custo', cid);
    if (!custo || Number(custo.estudo_id) !== estudo.id) {
      erro(res, 404, 'CUSTO_NAO_ENCONTRADO', 'Linha de custo não encontrada neste estudo');
      return;
    }
    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_CUSTO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    // `custo` entra como contexto (#257): num PATCH de `subcategoria` sozinho,
    // o grupo e a categoria que decidem a regra vêm da linha já gravada.
    if (!validarCamposCusto(res, dados, custo)) return;
    if (!(await validarPermutaTipologia(req, res, estudo.id, dados.permuta_tipologia_id))) return;
    if (!(await validarPermutaFisica(req, res, estudo.id, dados, custo))) return;
    const grupoEfetivo = dados.grupo !== undefined ? dados.grupo : custo.grupo;
    const categoriaEfetiva = dados.categoria !== undefined ? dados.categoria : custo.categoria;
    const subcategoriaEfetiva = dados.subcategoria !== undefined ? dados.subcategoria : custo.subcategoria;
    if (grupoEfetivo === 'terreno' && categoriaEfetiva === 'Preço' && subcategoriaEfetiva === 'Permuta física') {
      dados.orcamento_valor = null;
      dados.orcamento_valor_canonico = null;
      dados.orcamento_unidade = 'rs';
    }

    // Âncora final (nova, se veio no PATCH; senão a que já estava salva) —
    // fase do Cronograma (#167) e evento fixo são mutuamente exclusivas.
    // #249: início E duração são simétricos — os dois são DERIVADOS quando
    // ancorada (resolverTravamentoCusto). Antes só início travava com 422;
    // duração podia ser sobrescrita em silêncio enquanto a linha continuava
    // ancorada — a assimetria que esta issue corrige.
    const enviouInicio = dados.inicio_mes !== undefined;
    const enviouDuracao = dados.duracao_meses !== undefined;
    const faseAncoraFinal = dados.fase_ancora_id !== undefined ? dados.fase_ancora_id : custo.fase_ancora_id;
    if (faseAncoraFinal !== undefined && faseAncoraFinal !== null) {
      const trocandoAncora = dados.fase_ancora_id !== undefined;
      let ancoraFase: { inicio_mes: number; duracao_meses: number } | null = null;
      if (trocandoAncora) {
        ancoraFase = await ancorarLinhaCustoEmFase(req, estudo.id, Number(faseAncoraFinal));
        if (!ancoraFase) {
          erro(res, 400, 'FASE_ANCORA_INVALIDA', 'fase_ancora_id deve ser uma fase do Cronograma deste estudo');
          return;
        }
        dados.cronograma_evento = 'customizado';
      }
      const r = resolverTravamentoCusto(trocandoAncora, ancoraFase, enviouInicio, enviouDuracao,
        'início e duração são calculados pela fase-âncora; envie fase_ancora_id = null para editar');
      if (r.erroCampoTravado) { erro(res, 422, 'CAMPO_TRAVADO', r.erroCampoTravado); return; }
      Object.assign(dados, r.campos);
    } else {
      // Ao trocar a âncora para um evento do cronograma, herda início/duração dele.
      const eventoFinal = String(dados.cronograma_evento ?? custo.cronograma_evento);
      const trocandoAncora = dados.cronograma_evento !== undefined && dados.cronograma_evento !== 'customizado';
      const ancoraEvento = eventoFinal !== 'customizado'
        ? ancorarLinhaCusto(eventoFinal, (await lerCronograma(req, estudo)).linhas)
        : null;
      const r = resolverTravamentoCusto(trocandoAncora, ancoraEvento, enviouInicio, enviouDuracao,
        'início e duração são calculados pelo evento-âncora; use cronograma_evento = customizado para editar');
      if (r.erroCampoTravado) { erro(res, 422, 'CAMPO_TRAVADO', r.erroCampoTravado); return; }
      Object.assign(dados, r.campos);
    }

    const atualizada = await req.dados!.atualizar('avancado_linhas_custo', cid, dados);
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/custos/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ─────────────────────────────────────────────────────────────────
// Duplicação: copia todos os dados do Avançado para um novo estudo
// (chamada por POST /estudos/:id/duplicar quando o estudo é avançado)
// ─────────────────────────────────────────────────────────────────

const CAMPOS_CRONOGRAMA = ['evento', 'inicio_mes', 'duracao_meses', 'travado_inicio', 'travado_duracao'];
const CAMPOS_FASE_COPIA = ['tipo', 'nome', 'ordem', 'inicio_mes', 'duracao_meses', 'absorcao', 'fluxo_pagamento'];
const CAMPOS_ALOCACAO_COPIA = ['unidades', 'preco_m2', 'ordem'];

export async function duplicarDadosAvancado(req: Request, origId: number, novoId: number): Promise<void> {
  // Cronograma (5 eventos).
  const crono = await req.dados!.listar('avancado_cronograma', {
    filtros: { estudo_id: origId }, por_pagina: 10,
  });
  for (const linha of crono.dados) {
    await req.dados!.criar('avancado_cronograma', {
      estudo_id: novoId, ...extrairCampos(linha, CAMPOS_CRONOGRAMA),
    });
  }

  // Catálogo de tipologias (nível estudo) — mapeando id antigo → novo.
  const tipologias = await req.dados!.listar('avancado_tipologias', {
    filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
  });
  const mapaTipologia = new Map<number, number>();
  for (const tip of tipologias.dados) {
    const nova = await req.dados!.criar('avancado_tipologias', {
      estudo_id: novoId, ...extrairCampos(tip, CAMPOS_TIPOLOGIA),
    });
    mapaTipologia.set(Number(tip.id), Number(nova.id));
  }

  // Fases + alocações (mapeando fase antiga → nova e tipologia antiga → nova).
  const [fases, alocacoes] = await Promise.all([
    req.dados!.listar('avancado_fases', { filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 100 }),
    req.dados!.listar('avancado_alocacoes', { filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 1000 }),
  ]);
  const mapaFase = new Map<number, number>();
  for (const fase of fases.dados) {
    const nova = await req.dados!.criar('avancado_fases', {
      estudo_id: novoId, ...extrairCampos(fase, CAMPOS_FASE_COPIA),
    });
    mapaFase.set(Number(fase.id), Number(nova.id));
    for (const aloc of alocacoes.dados) {
      if (Number(aloc.fase_id) !== Number(fase.id)) continue;
      const novaTipologia = mapaTipologia.get(Number(aloc.tipologia_id));
      if (!novaTipologia) continue; // tipologia órfã (não deveria ocorrer)
      await req.dados!.criar('avancado_alocacoes', {
        estudo_id: novoId, fase_id: nova.id, tipologia_id: novaTipologia,
        ...extrairCampos(aloc, CAMPOS_ALOCACAO_COPIA),
      });
    }
  }

  // Linhas de custo (curva_id copia direto — curvas são globais da instância;
  // fase_ancora_id remapeia para a fase NOVA, #167 — copiar o id antigo
  // apontaria para uma fase de outro estudo).
  const custos = await req.dados!.listar('avancado_linhas_custo', {
    filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
  });
  for (const custo of custos.dados) {
    const copia: Record<string, any> = { estudo_id: novoId, ...extrairCampos(custo, CAMPOS_CUSTO) };
    if (custo.fase_ancora_id !== null && custo.fase_ancora_id !== undefined) {
      copia.fase_ancora_id = mapaFase.get(Number(custo.fase_ancora_id)) ?? null;
    }
    await req.dados!.criar('avancado_linhas_custo', copia);
  }

  // Cenários salvos (Etapa 8 · #56) — deltas percentuais, sem dado derivado.
  const cenarios = await req.dados!.listar('avancado_cenarios', {
    filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 200,
  });
  for (const cen of cenarios.dados) {
    await req.dados!.criar('avancado_cenarios', {
      estudo_id: novoId, ...extrairCampos(cen, CAMPOS_CENARIO),
    });
  }
}

rotasAvancado.delete('/estudos/:id/avancado/custos/:cid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const cid = parseInt(req.params.cid);
    if (isNaN(cid)) { erro(res, 400, 'ID_INVALIDO', 'ID da linha de custo inválido'); return; }
    const custo = await req.dados!.buscar('avancado_linhas_custo', cid);
    if (!custo || Number(custo.estudo_id) !== estudo.id) {
      erro(res, 404, 'CUSTO_NAO_ENCONTRADO', 'Linha de custo não encontrada neste estudo');
      return;
    }
    await req.dados!.deletar('avancado_linhas_custo', cid);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/custos/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ─────────────────────────────────────────────────────────────────
// Cenários (Etapa 8 · #56)
//
// Cada cenário é um par de variações percentuais (deltas) sobre a base —
// preço de venda (R$/m²) e custo de obra (R$/m²). Persiste permanentemente
// no estudo; o frontend reaplica os deltas ao motor (aplicarCenario) para
// recalcular o fluxo. Nenhum indicador derivado é gravado.
// ─────────────────────────────────────────────────────────────────

const CAMPOS_CENARIO = ['nome', 'preco_venda_pct', 'custo_obra_pct', 'ordem'];

rotasAvancado.get('/estudos/:id/avancado/cenarios', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    const r = await req.dados!.listar('avancado_cenarios', {
      filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 200,
    });
    res.json(r);
  } catch (e: any) {
    console.error('Erro em GET /avancado/cenarios:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.post('/estudos/:id/avancado/cenarios', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const dados: Record<string, any> = {
      estudo_id: estudo.id,
      nome: 'Cenário',
      preco_venda_pct: 0,
      custo_obra_pct: 0,
      ordem: 0,
    };
    for (const campo of CAMPOS_CENARIO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    const criado = await req.dados!.criar('avancado_cenarios', dados);
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em POST /avancado/cenarios:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/cenarios/:cid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const cid = parseInt(req.params.cid);
    if (isNaN(cid)) { erro(res, 400, 'ID_INVALIDO', 'ID do cenário inválido'); return; }
    const cen = await req.dados!.buscar('avancado_cenarios', cid);
    if (!cen || Number(cen.estudo_id) !== estudo.id) {
      erro(res, 404, 'CENARIO_NAO_ENCONTRADO', 'Cenário não encontrado neste estudo');
      return;
    }

    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_CENARIO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }

    const atualizado = await req.dados!.atualizar('avancado_cenarios', cid, dados);
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/cenarios/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.delete('/estudos/:id/avancado/cenarios/:cid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const cid = parseInt(req.params.cid);
    if (isNaN(cid)) { erro(res, 400, 'ID_INVALIDO', 'ID do cenário inválido'); return; }
    const cen = await req.dados!.buscar('avancado_cenarios', cid);
    if (!cen || Number(cen.estudo_id) !== estudo.id) {
      erro(res, 404, 'CENARIO_NAO_ENCONTRADO', 'Cenário não encontrado neste estudo');
      return;
    }
    await req.dados!.deletar('avancado_cenarios', cid);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/cenarios/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

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
    { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6, travado_inicio: false, travado_duracao: false },
    { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1, travado_inicio: true, travado_duracao: true },
    { evento: 'obra', inicio_mes: 17, duracao_meses: 24, travado_inicio: false, travado_duracao: false },
    { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12, travado_inicio: true, travado_duracao: false },
  ];
  return recalcularTravados(base);
}

/**
 * Recalcula os campos travados do cronograma:
 *  - Lançamento: início = fim do Pré-lançamento + 1; duração = 1 (ambos travados)
 *  - Pós-obra:   início = fim da Obra + 1 (travado; duração livre)
 * Retorna um novo array (não muta o de entrada).
 */
export function recalcularTravados(eventos: LinhaCronograma[]): LinhaCronograma[] {
  const porEvento = new Map(eventos.map((e) => [e.evento, { ...e }]));
  const pre = porEvento.get('pre_lancamento');
  const lanc = porEvento.get('lancamento');
  const obra = porEvento.get('obra');
  const pos = porEvento.get('pos_obra');
  if (pre && lanc) {
    lanc.inicio_mes = pre.inicio_mes + pre.duracao_meses; // fim do pré + 1
    lanc.duracao_meses = 1;
    lanc.travado_inicio = true;
    lanc.travado_duracao = true;
  }
  if (obra && pos) {
    pos.inicio_mes = obra.inicio_mes + obra.duracao_meses; // fim da obra + 1
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

/** Valida o JSON de absorção de vendas de uma linha de receita. */
export function validarAbsorcao(a: any): string | null {
  if (a === null || a === undefined) return null; // ausente = linear default
  if (typeof a !== 'object') return 'absorcao deve ser um objeto';
  const modo = a.modo;
  if (!['linear', 'distribuido', 'personalizado'].includes(modo)) {
    return 'absorcao.modo deve ser linear, distribuido ou personalizado';
  }
  if (modo === 'distribuido') {
    if (!Array.isArray(a.blocos) || a.blocos.length === 0) return 'absorcao.blocos é obrigatório no modo distribuido';
    const soma = a.blocos.reduce((s: number, b: any) => s + (Number(b?.pct) || 0), 0);
    if (Math.abs(soma - 100) > 0.01) return `a soma dos blocos de absorção deve ser 100% (atual: ${soma.toFixed(2)}%)`;
  }
  if (modo === 'personalizado') {
    if (!Array.isArray(a.meses) || a.meses.length === 0) return 'absorcao.meses é obrigatório no modo personalizado';
    const soma = a.meses.reduce((s: number, m: any) => s + (Number(m?.pct) || 0), 0);
    if (Math.abs(soma - 100) > 0.01) return `a soma da absorção mensal deve ser 100% (atual: ${soma.toFixed(2)}%)`;
  }
  return null;
}

/** Valida o JSON de fluxo de pagamento: entrada + parcelas + repasse = 100%. */
export function validarFluxoPagamento(fp: any): string | null {
  if (fp === null || fp === undefined) return null; // ausente = default
  if (typeof fp !== 'object') return 'fluxo_pagamento deve ser um objeto';
  const entrada = Number(fp.entrada?.pct) || 0;
  const parcelas = Number(fp.parcelas?.pct) || 0;
  const repasse = Number(fp.repasse?.pct) || 0;
  const soma = entrada + parcelas + repasse;
  if (Math.abs(soma - 100) > 0.01) {
    return `Entrada + Parcelas + Repasse deve somar 100% (atual: ${soma.toFixed(2)}%)`;
  }
  return null;
}

// Defaults de uma linha de receita nova.
export function absorcaoPadrao(): Record<string, any> {
  return { modo: 'linear', correcao_estoque: false };
}
export function fluxoPagamentoPadrao(): Record<string, any> {
  return {
    comissao: { ativo: true, tipo: 'embutida', pct: 6 },
    ret: { ativo: false, pct: 4 },
    entrada: { modo: 'entrada', parcelas: 1, pct: 15 },
    parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 },
    repasse: { pct: 70, apos_entrega_meses: 2 },
  };
}

const GRUPOS_CUSTO = ['terreno', 'obra', 'indireto'];
const UNIDADES_ORCAMENTO = ['rs', 'rs_m2_priv', 'rs_m2_terreno', 'pct_vgv', 'pct_receita'];
const EVENTOS_ANCORA = ['planejamento', 'pre_lancamento', 'obra', 'pos_obra', 'customizado'];
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

/** Lê o cronograma persistido do estudo; completa com defaults os eventos ausentes. */
async function lerCronograma(req: Request, estudoId: number): Promise<{ linhas: LinhaCronograma[]; ids: Map<string, number> }> {
  const r = await req.dados!.listar('avancado_cronograma', { filtros: { estudo_id: estudoId }, por_pagina: 10 });
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
  const padrao = cronogramaPadrao();
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
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }

    const atualizado = await req.dados!.atualizar('estudos', estudo.id, dados);
    res.json({
      data_inicio_projeto: atualizado.data_inicio_projeto ?? null,
      taxa_desconto_aa: Number(atualizado.taxa_desconto_aa ?? 12),
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
    const { linhas } = await lerCronograma(req, estudo.id);
    res.json({ dados: linhas });
  } catch (e: any) {
    console.error('Erro em GET /avancado/cronograma:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.patch('/estudos/:id/avancado/cronograma/:evento', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const evento = String(req.params.evento) as EventoCronograma;
    if (!EVENTOS_CRONOGRAMA.includes(evento)) {
      erro(res, 400, 'EVENTO_INVALIDO', `evento deve ser um de: ${EVENTOS_CRONOGRAMA.join(', ')}`);
      return;
    }

    const { linhas, ids } = await lerCronograma(req, estudo.id);
    const alvo = linhas.find((l) => l.evento === evento)!;

    if (req.body.inicio_mes !== undefined) {
      if (alvo.travado_inicio) { erro(res, 422, 'CAMPO_TRAVADO', `O início de ${evento} é calculado automaticamente`); return; }
      const v = Number(req.body.inicio_mes);
      if (!Number.isInteger(v) || v < 0) { erro(res, 400, 'INICIO_INVALIDO', 'inicio_mes deve ser inteiro ≥ 0 (mês 0 = início do projeto)'); return; }
      alvo.inicio_mes = v;
    }
    if (req.body.duracao_meses !== undefined) {
      if (alvo.travado_duracao) { erro(res, 422, 'CAMPO_TRAVADO', `A duração de ${evento} é fixa (1 mês)`); return; }
      const v = Number(req.body.duracao_meses);
      if (!Number.isInteger(v) || v < 1) { erro(res, 400, 'DURACAO_INVALIDA', 'duracao_meses deve ser inteiro ≥ 1'); return; }
      alvo.duracao_meses = v;
    }

    const recalculado = recalcularTravados(linhas);
    await salvarCronograma(req, estudo.id, recalculado, ids);
    const custosReancorados = await reancorarCustos(req, estudo.id, recalculado);
    res.json({ dados: recalculado, custos_reancorados: custosReancorados });
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/cronograma/:evento:', e);
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
// Linhas de receita + tipologias
// ─────────────────────────────────────────────────────────────────

rotasAvancado.get('/estudos/:id/avancado/receitas', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;

    const [linhas, tipologias] = await Promise.all([
      req.dados!.listar('avancado_linhas_receita', {
        filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 100,
      }),
      req.dados!.listar('avancado_tipologias', {
        filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
      }),
    ]);
    const porLinha = new Map<number, any[]>();
    for (const t of tipologias.dados) {
      const chave = Number(t.linha_receita_id);
      if (!porLinha.has(chave)) porLinha.set(chave, []);
      porLinha.get(chave)!.push(t);
    }
    res.json({
      dados: linhas.dados.map((l) => ({ ...l, tipologias: porLinha.get(Number(l.id)) ?? [] })),
      total: linhas.total,
    });
  } catch (e: any) {
    console.error('Erro em GET /avancado/receitas:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.post('/estudos/:id/avancado/receitas', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const existentes = await req.dados!.listar('avancado_linhas_receita', {
      filtros: { estudo_id: estudo.id }, por_pagina: 100,
    });
    const n = existentes.total + 1;
    const criada = await req.dados!.criar('avancado_linhas_receita', {
      estudo_id: estudo.id,
      nome: String(req.body.nome || 'Sales').trim() || 'Sales',
      fase_label: String(req.body.fase_label || `Fase ${n}`),
      tipo: 'venda',
      ordem: existentes.total,
      absorcao: absorcaoPadrao(),
      fluxo_pagamento: fluxoPagamentoPadrao(),
    });
    res.status(201).json({ ...criada, tipologias: [] });
  } catch (e: any) {
    console.error('Erro em POST /avancado/receitas:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

/** Busca a linha de receita e valida que pertence ao estudo da URL. */
async function linhaReceitaDoEstudo(req: Request, res: Response, estudoId: number): Promise<any | null> {
  const rid = parseInt(req.params.rid);
  if (isNaN(rid)) { erro(res, 400, 'ID_INVALIDO', 'ID da linha de receita inválido'); return null; }
  const linha = await req.dados!.buscar('avancado_linhas_receita', rid);
  if (!linha || Number(linha.estudo_id) !== estudoId) {
    erro(res, 404, 'RECEITA_NAO_ENCONTRADA', 'Linha de receita não encontrada neste estudo');
    return null;
  }
  return linha;
}

rotasAvancado.patch('/estudos/:id/avancado/receitas/:rid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const linha = await linhaReceitaDoEstudo(req, res, estudo.id);
    if (!linha) return;

    const dados: Record<string, any> = {};
    if (req.body.nome !== undefined) dados.nome = String(req.body.nome).trim();
    if (req.body.fase_label !== undefined) dados.fase_label = String(req.body.fase_label).trim();
    if (req.body.tipo !== undefined) {
      if (req.body.tipo !== 'venda') { erro(res, 400, 'TIPO_INVALIDO', 'tipo deve ser "venda"'); return; }
      dados.tipo = 'venda';
    }
    if (req.body.ordem !== undefined) dados.ordem = Number(req.body.ordem) || 0;
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

    const atualizada = await req.dados!.atualizar('avancado_linhas_receita', linha.id, dados);
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/receitas/:rid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAvancado.delete('/estudos/:id/avancado/receitas/:rid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const linha = await linhaReceitaDoEstudo(req, res, estudo.id);
    if (!linha) return;
    await req.dados!.deletar('avancado_linhas_receita', linha.id); // tipologias caem por cascata
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/receitas/:rid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ── Tipologias ──

const TIPOS_UNIDADE = ['apartamento', 'cobertura', 'loja', 'lote', 'outro'];
const CAMPOS_TIPOLOGIA = ['nome', 'tipo_unidade', 'area_privativa_m2', 'dormitorios', 'vagas', 'quantidade', 'unidades_permutadas', 'preco_m2', 'ordem'];

rotasAvancado.post('/estudos/:id/avancado/receitas/:rid/tipologias', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const linha = await linhaReceitaDoEstudo(req, res, estudo.id);
    if (!linha) return;

    const lote = estudo.tipo_empreendimento === 'loteamento';
    const dados: Record<string, any> = {
      linha_receita_id: linha.id,
      estudo_id: estudo.id,
      nome: lote ? 'Lote' : '',
      tipo_unidade: lote ? 'lote' : 'apartamento',
      quantidade: 0,
      ordem: 0,
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

async function tipologiaDaLinha(req: Request, res: Response, linhaId: number): Promise<any | null> {
  const tid = parseInt(req.params.tid);
  if (isNaN(tid)) { erro(res, 400, 'ID_INVALIDO', 'ID da tipologia inválido'); return null; }
  const tip = await req.dados!.buscar('avancado_tipologias', tid);
  if (!tip || Number(tip.linha_receita_id) !== linhaId) {
    erro(res, 404, 'TIPOLOGIA_NAO_ENCONTRADA', 'Tipologia não encontrada nesta linha de receita');
    return null;
  }
  return tip;
}

rotasAvancado.patch('/estudos/:id/avancado/receitas/:rid/tipologias/:tid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const linha = await linhaReceitaDoEstudo(req, res, estudo.id);
    if (!linha) return;
    const tip = await tipologiaDaLinha(req, res, Number(linha.id));
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

rotasAvancado.delete('/estudos/:id/avancado/receitas/:rid/tipologias/:tid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const linha = await linhaReceitaDoEstudo(req, res, estudo.id);
    if (!linha) return;
    const tip = await tipologiaDaLinha(req, res, Number(linha.id));
    if (!tip) return;
    await req.dados!.deletar('avancado_tipologias', tip.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/tipologias/:tid:', e);
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

const CAMPOS_CUSTO = ['grupo', 'categoria', 'subcategoria', 'orcamento_valor', 'orcamento_unidade', 'curva_id', 'cronograma_evento', 'inicio_mes', 'duracao_meses', 'ordem'];

function validarCamposCusto(res: Response, dados: Record<string, any>): boolean {
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

    // Ancoragem: evento ≠ customizado herda início/duração do cronograma.
    const ancora = ancorarLinhaCusto(String(dados.cronograma_evento), (await lerCronograma(req, estudo.id)).linhas);
    if (ancora) {
      dados.inicio_mes = ancora.inicio_mes;
      if (req.body.duracao_meses === undefined) dados.duracao_meses = ancora.duracao_meses;
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
    if (!validarCamposCusto(res, dados)) return;

    // Ao trocar a âncora para um evento do cronograma, herda início/duração dele.
    const eventoFinal = String(dados.cronograma_evento ?? custo.cronograma_evento);
    if (dados.cronograma_evento !== undefined && dados.cronograma_evento !== 'customizado') {
      const ancora = ancorarLinhaCusto(eventoFinal, (await lerCronograma(req, estudo.id)).linhas);
      if (ancora) {
        dados.inicio_mes = ancora.inicio_mes;
        if (req.body.duracao_meses === undefined) dados.duracao_meses = ancora.duracao_meses;
      }
    } else if (eventoFinal !== 'customizado' && dados.inicio_mes !== undefined) {
      // Início é calculado quando ancorado — só editável em customizado.
      erro(res, 422, 'CAMPO_TRAVADO', 'inicio_mes é calculado pelo evento-âncora; use cronograma_evento = customizado para editar');
      return;
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
const CAMPOS_RECEITA = ['nome', 'fase_label', 'tipo', 'ordem', 'absorcao', 'fluxo_pagamento'];

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

  // Linhas de receita + tipologias (mapeando linha antiga → nova).
  const [receitas, tipologias] = await Promise.all([
    req.dados!.listar('avancado_linhas_receita', {
      filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 100,
    }),
    req.dados!.listar('avancado_tipologias', {
      filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
    }),
  ]);
  for (const linha of receitas.dados) {
    const nova = await req.dados!.criar('avancado_linhas_receita', {
      estudo_id: novoId, ...extrairCampos(linha, CAMPOS_RECEITA),
    });
    for (const tip of tipologias.dados) {
      if (Number(tip.linha_receita_id) !== Number(linha.id)) continue;
      await req.dados!.criar('avancado_tipologias', {
        linha_receita_id: nova.id, estudo_id: novoId, ...extrairCampos(tip, CAMPOS_TIPOLOGIA),
      });
    }
  }

  // Linhas de custo (curva_id copia direto — curvas são globais da instância).
  const custos = await req.dados!.listar('avancado_linhas_custo', {
    filtros: { estudo_id: origId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
  });
  for (const custo of custos.dados) {
    await req.dados!.criar('avancado_linhas_custo', {
      estudo_id: novoId, ...extrairCampos(custo, CAMPOS_CUSTO),
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

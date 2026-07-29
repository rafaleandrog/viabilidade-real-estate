import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor } from '../permissoes-estudo.js';
import {
  SCHEMA_ANALISE, instrucoesSistemaAnalise, montarContextoAnalise,
  normalizarAnalise, CAMPOS_INDICADOR,
} from '../mercado-ia.js';

// Rotas da ANÁLISE DE MERCADO (#199) — leitura do snapshot de mercado de um
// estudo. A tabela `analise_mercado` guarda só o lado MERCADO (preço/custo por
// m², VSO, macros, riscos e procedência); o lado PROJETO é derivado no
// frontend a partir do próprio estudo (`frontend/analise-mercado.ts`), para não
// duplicar dado que já existe nas outras abas.
//
// Aqui há apenas o GET: quem PREENCHE o snapshot é a rota de IA do #200. Até
// ela existir, o GET responde `{ analise: null }` e a tela mostra o estado
// "sem dado de mercado" — que é estado normal, não erro.

export const rotasAnaliseMercado: ReturnType<typeof Router> = Router();

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// GET /estudos/:id/analise-mercado — snapshot de mercado (ou null)
rotasAnaliseMercado.get('/estudos/:id/analise-mercado', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirMembro(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return; }

    const r = await req.dados!.listar('analise_mercado', {
      filtros: { estudo_id: estudoId }, por_pagina: 1,
    });
    const estudo = await req.dados!.buscar('estudos', estudoId);
    const regiaoId = estudo?.regiao_mercado_id ?? null;
    const regiao = regiaoId ? await req.dados!.buscar('mercado_regioes', Number(regiaoId)) : null;
    // Coletas recentes da região do estudo — o material que a análise usa e que
    // o usuário precisa ver para julgar a procedência do que a IA respondeu.
    let coletas: any[] = [];
    if (regiao) {
      const c = await req.dados!.listar('mercado_coletas', {
        filtros: { regiao_id: regiao.id }, por_pagina: 30,
      });
      coletas = (c.dados ?? [])
        .sort((a: any, b: any) => String(b.data_coleta).localeCompare(String(a.data_coleta)))
        .slice(0, 15);
    }
    // Ausência de snapshot NÃO é 404: o estudo existe, só nunca rodou a análise.
    res.json({ analise: r.dados[0] ?? null, regiao, coletas });
  } catch (e: any) {
    console.error('Erro em GET analise-mercado:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/analise-mercado/regiao — vincula o estudo a uma região monitorada
rotasAnaliseMercado.patch('/estudos/:id/analise-mercado/regiao', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem alterar a região'); return; }

    const bruto = req.body?.regiao_mercado_id;
    let regiaoId: number | null = null;
    if (bruto !== null && bruto !== undefined && bruto !== '') {
      regiaoId = Number(bruto);
      if (!Number.isFinite(regiaoId)) { erro(res, 400, 'REGIAO_INVALIDA', 'regiao_mercado_id deve ser um número ou null'); return; }
      const regiao = await req.dados!.buscar('mercado_regioes', regiaoId);
      if (!regiao) { erro(res, 400, 'REGIAO_INVALIDA', 'Região monitorada não encontrada'); return; }
    }
    const atualizado = await req.dados!.atualizar('estudos', estudoId, { regiao_mercado_id: regiaoId });
    if (!atualizado) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    res.json({ regiao_mercado_id: regiaoId });
  } catch (e: any) {
    console.error('Erro em PATCH analise-mercado/regiao:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/analise-mercado — roda a análise de IA e grava o snapshot (#200)
//
// Sob demanda (botão), nunca por carga de tela: a análise custa IA e o usuário
// precisa decidir quando gastá-la. Exige editor, como toda escrita no estudo.
rotasAnaliseMercado.post('/estudos/:id/analise-mercado', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem rodar a análise'); return; }
    if (!req.ia) { erro(res, 422, 'IA_INDISPONIVEL', 'Framework de IA não disponível para esta app/instância'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    // Região monitorada do estudo — dá a localidade e o material coletado.
    const regiaoId = estudo.regiao_mercado_id ?? null;
    const regiao = regiaoId ? await req.dados!.buscar('mercado_regioes', Number(regiaoId)) : null;
    let coletas: any[] = [];
    if (regiao) {
      const c = await req.dados!.listar('mercado_coletas', { filtros: { regiao_id: regiao.id }, por_pagina: 40 });
      coletas = (c.dados ?? [])
        .sort((a: any, b: any) => (Number(b.relevancia) || 0) - (Number(a.relevancia) || 0))
        .slice(0, 20);
    }

    const localidade = regiao
      ? `${regiao.nome}${regiao.uf ? `/${regiao.uf}` : ''}`
      : String(estudo.uf ?? '').trim();

    // Números do PROJETO vêm da tela (`projeto`), que já os derivou para exibir
    // (`frontend/analise-mercado.ts`). Entram apenas como CONTEXTO do prompt —
    // nada aqui é persistido como verdade — e evitam duplicar as fórmulas no
    // backend, o que faria os dois lados divergirem na primeira mudança.
    const p = req.body?.projeto ?? {};
    const numOuNull = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

    const contexto = montarContextoAnalise({
      localidade,
      tipoEmpreendimento: String(estudo.tipo_empreendimento ?? ''),
      areaPrivativaTotal: Number(p.area_privativa_total) || 0,
      unidades: Number(p.unidades) || 0,
      precoMedioM2Projeto: numOuNull(p.preco_medio_m2),
      custoObraM2Projeto: numOuNull(p.custo_obra_m2),
      vsoProjetoPct: numOuNull(p.vso_pct),
      coletas: coletas.map((c) => ({
        titulo: String(c.titulo ?? ''), resumo: String(c.resumo ?? ''),
        fonte: String(c.fonte ?? ''), publicado_em: String(c.publicado_em ?? ''),
        tipo: String(c.tipo ?? 'noticia'),
      })),
    });

    const resposta = await req.ia.consultar({
      contexto,
      schema: SCHEMA_ANALISE,
      instrucoes_sistema: instrucoesSistemaAnalise(),
    });

    // A normalização é a trava: número sem procedência não chega ao banco.
    const norm = normalizarAnalise(resposta?.dados ?? {});

    const dados: Record<string, any> = {
      estudo_id: estudoId,
      abrangencia: norm.abrangencia,
      localidade: norm.localidade || localidade,
      data_referencia: norm.data_referencia,
      riscos: norm.riscos,
      resultado: { limitacoes: norm.limitacoes, indicadores: norm.indicadores, bruto: resposta?.dados ?? null },
      origem: 'Análise de IA sobre coletas da região',
      gerado_em: new Date().toISOString(),
      modelo: String(resposta?.modelo ?? ''),
    };
    for (const campo of CAMPOS_INDICADOR) dados[campo] = norm.indicadores[campo]?.valor ?? null;

    const existente = await req.dados!.listar('analise_mercado', { filtros: { estudo_id: estudoId }, por_pagina: 1 });
    const salva = existente.dados.length > 0
      ? await req.dados!.atualizar('analise_mercado', existente.dados[0].id, dados)
      : await req.dados!.criar('analise_mercado', dados);

    res.json({ analise: salva, regiao, coletas: coletas.slice(0, 15) });
  } catch (e: any) {
    console.error('Erro em POST analise-mercado:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ── Regiões monitoradas (registro GLOBAL da app, como benchmarks/curvas) ──

function exigirAdmin(req: Request, res: Response): boolean {
  if (req.contexto?.nivelApp !== 'admin') {
    erro(res, 403, 'SEM_PERMISSAO', 'Apenas administradores podem gerenciar as regiões monitoradas');
    return false;
  }
  return true;
}

const CAMPOS_REGIAO = ['nome', 'uf', 'palavras_chave', 'ativa', 'ordem'];

// GET /mercado/regioes — leitura liberada: a tela do estudo precisa listar para escolher
rotasAnaliseMercado.get('/mercado/regioes', async (req: Request, res: Response) => {
  try {
    const r = await req.dados!.listar('mercado_regioes', { por_pagina: 200 });
    const regioes = (r.dados ?? []).sort((a: any, b: any) =>
      (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    res.json({ dados: regioes });
  } catch (e: any) {
    console.error('Erro em GET mercado/regioes:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAnaliseMercado.post('/mercado/regioes', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    const nome = String(req.body?.nome ?? '').trim();
    if (!nome) { erro(res, 400, 'NOME_OBRIGATORIO', 'A região precisa de um nome'); return; }
    const dados: Record<string, any> = { nome, uf: String(req.body?.uf ?? 'DF').trim().toUpperCase().slice(0, 2) };
    for (const campo of ['palavras_chave', 'ativa', 'ordem']) {
      if (req.body?.[campo] !== undefined) dados[campo] = req.body[campo];
    }
    res.status(201).json(await req.dados!.criar('mercado_regioes', dados));
  } catch (e: any) {
    console.error('Erro em POST mercado/regioes:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAnaliseMercado.patch('/mercado/regioes/:rid', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    const rid = parseInt(req.params.rid);
    if (isNaN(rid)) { erro(res, 400, 'ID_INVALIDO', 'ID inválido'); return; }
    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_REGIAO) {
      if (req.body?.[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (typeof dados.nome === 'string') {
      dados.nome = dados.nome.trim();
      if (!dados.nome) { erro(res, 400, 'NOME_OBRIGATORIO', 'A região precisa de um nome'); return; }
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    const atualizada = await req.dados!.atualizar('mercado_regioes', rid, dados);
    if (!atualizada) { erro(res, 404, 'REGIAO_NAO_ENCONTRADA', 'Região não encontrada'); return; }
    res.json(atualizada);
  } catch (e: any) {
    console.error('Erro em PATCH mercado/regioes:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasAnaliseMercado.delete('/mercado/regioes/:rid', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    const rid = parseInt(req.params.rid);
    if (isNaN(rid)) { erro(res, 400, 'ID_INVALIDO', 'ID inválido'); return; }
    await req.dados!.remover('mercado_regioes', rid);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE mercado/regioes:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// GET /mercado/regioes/:rid/coletas — o que a rotina diária juntou
rotasAnaliseMercado.get('/mercado/regioes/:rid/coletas', async (req: Request, res: Response) => {
  try {
    const rid = parseInt(req.params.rid);
    if (isNaN(rid)) { erro(res, 400, 'ID_INVALIDO', 'ID inválido'); return; }
    const c = await req.dados!.listar('mercado_coletas', { filtros: { regiao_id: rid }, por_pagina: 100 });
    const coletas = (c.dados ?? []).sort((a: any, b: any) =>
      String(b.data_coleta).localeCompare(String(a.data_coleta))
      || (Number(b.relevancia) || 0) - (Number(a.relevancia) || 0));
    res.json({ dados: coletas.slice(0, 50) });
  } catch (e: any) {
    console.error('Erro em GET mercado/coletas:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

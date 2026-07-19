import { Router, type Request, type Response } from 'express';
import {
  resolverPermissaoEstudo,
  exigirMembro,
  exigirEditor,
  exigirAprovador,
  garantirMembro,
} from '../permissoes-estudo.js';
import {
  publicarEvento,
  inscreverMembroEstudo,
  payloadEstudoCriado,
  payloadStatusAlterado,
} from '../eventos-viabilidade.js';
import { gerarIdentificacao } from '../identificacao.js';

export const rotasEstudos: ReturnType<typeof Router> = Router();

const TIPOS = ['loteamento', 'incorporacao'];
const STATUS = ['rascunho', 'em_analise', 'aprovado', 'reprovado', 'arquivado'];

// Campos que não são copiados na duplicação (gerados ou de junção do shell).
const CAMPOS_NAO_COPIAVEIS = new Set([
  'id', 'criado_em', 'atualizado_em', 'removido_em', 'removido_por_id',
  'id_legivel', 'nome_exibicao', 'sequencia', 'status',
  'autor_id', 'autor_nome', 'autor_avatar_url',
]);

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// ---------------------------------------------------------------
// POST /estudos — criar (auto-adiciona o criador como editor)
// ---------------------------------------------------------------
rotasEstudos.post('/estudos', async (req: Request, res: Response) => {
  try {
    const podeCriar = req.contexto?.nivelApp === 'escrita' || req.contexto?.nivelApp === 'admin';
    if (!podeCriar) {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para criar estudos');
      return;
    }

    const { nome, tipo_empreendimento, uf, nivel_analise, origem_terreno } = req.body;
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      erro(res, 400, 'CAMPOS_OBRIGATORIOS', 'O campo "nome" é obrigatório');
      return;
    }
    if (!TIPOS.includes(tipo_empreendimento)) {
      erro(res, 400, 'TIPO_INVALIDO', 'tipo_empreendimento deve ser "loteamento" ou "incorporacao"');
      return;
    }
    if (origem_terreno !== undefined && origem_terreno !== 'nucleo' && origem_terreno !== 'manual') {
      erro(res, 400, 'ORIGEM_INVALIDA', 'origem_terreno deve ser "nucleo" ou "manual"');
      return;
    }

    const ident = await gerarIdentificacao(req, { nome: nome.trim(), tipo_empreendimento, uf });
    const dados: Record<string, any> = {
      nome: nome.trim(),
      tipo_empreendimento,
      uf: uf ?? null,
      nivel_analise: nivel_analise === 'avancado' ? 'avancado' : 'preliminar',
      status: 'rascunho',
      origem_terreno: origem_terreno ?? 'manual',
      autor_id: req.contexto!.usuario.id,
      ...ident,
    };
    // Campos opcionais de terreno manual, se vierem já na criação.
    for (const campo of ['terreno_manual_nome', 'terreno_manual_area', 'notas']) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }

    const estudo = await req.dados!.criar('estudos', dados);

    // Criador vira editor do estudo.
    const funcao = await garantirMembro(req, estudo.id, req.contexto!.usuario.id, 'editor');
    if (funcao) await inscreverMembroEstudo(req, estudo.id, req.contexto!.usuario.id, funcao);

    await publicarEvento(req, 'estudo_criado', payloadEstudoCriado(estudo, req.contexto!.usuario.nome));
    res.status(201).json(estudo);
  } catch (e: any) {
    console.error('Erro em POST /estudos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// GET /estudos — listar filtrado por membership
// ---------------------------------------------------------------
rotasEstudos.get('/estudos', async (req: Request, res: Response) => {
  try {
    const userId = req.contexto!.usuario.id;
    const { tipo_empreendimento, status } = req.query as Record<string, string>;

    let estudos: any[];
    if (req.contexto?.nivelApp === 'admin') {
      // Admin de app enxerga todos os estudos.
      const filtros: Record<string, any> = {};
      if (tipo_empreendimento) filtros.tipo_empreendimento = tipo_empreendimento;
      if (status) filtros.status = status;
      const r = await req.dados!.listar('estudos', {
        filtros, ordenar: 'criado_em', ordem: 'desc', por_pagina: 200,
      });
      estudos = r.dados.map((e) => ({ ...e, _funcao: 'aprovador' }));
    } else {
      // Demais: apenas estudos onde é membro.
      const mem = await req.dados!.listar('estudo_membros', {
        filtros: { usuario_id: userId }, por_pagina: 500,
      });
      const funcaoPorEstudo = new Map<number, string>();
      for (const m of mem.dados) funcaoPorEstudo.set(Number(m.estudo_id), String(m.funcao));

      estudos = [];
      for (const [estudoId, funcao] of funcaoPorEstudo) {
        const est = await req.dados!.buscar('estudos', estudoId);
        if (!est) continue; // removido ou inexistente
        // Leitor não vê estudos em Rascunho ou Arquivado.
        if (funcao === 'leitor' && (est.status === 'rascunho' || est.status === 'arquivado')) continue;
        if (tipo_empreendimento && est.tipo_empreendimento !== tipo_empreendimento) continue;
        if (status && est.status !== status) continue;
        estudos.push({ ...est, _funcao: funcao });
      }
      estudos.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    }

    res.json({ dados: estudos, total: estudos.length });
  } catch (e: any) {
    console.error('Erro em GET /estudos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// GET /estudos/:id — detalhe (membro)
// ---------------------------------------------------------------
rotasEstudos.get('/estudos/:id', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const perm = await exigirMembro(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return; }
    // Leitor não acessa Rascunho/Arquivado.
    if (perm.ehLeitor && (estudo.status === 'rascunho' || estudo.status === 'arquivado')) {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo neste status');
      return;
    }

    const [membros, imoveis] = await Promise.all([
      req.dados!.listar('estudo_membros', { filtros: { estudo_id: estudoId }, por_pagina: 100 }),
      req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 }),
    ]);

    const podeAprovar = perm.ehAprovador || perm.ehAdminApp;
    const podeEditar = perm.ehEditor || podeAprovar;
    res.json({
      ...estudo,
      membros: membros.dados,
      imoveis: imoveis.dados,
      _permissao: {
        funcao: perm.funcao,
        ehMembro: perm.ehMembro,
        podeEditar,
        podeAprovar,
        podeSubmeter: podeEditar && estudo.status === 'rascunho',
        podeEditarImoveis: podeEditar && estudo.status === 'rascunho',
      },
    });
  } catch (e: any) {
    console.error('Erro em GET /estudos/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// PATCH /estudos/:id — editar premissas
// ---------------------------------------------------------------
rotasEstudos.patch('/estudos/:id', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const perm = await resolverPermissaoEstudo(req, estudoId);
    const podeAprovar = perm.ehAprovador || perm.ehAdminApp;
    const podeEditor = perm.ehEditor || podeAprovar;

    // Aprovado/Reprovado/Arquivado: só aprovador edita. Demais status: editor+.
    const travado = estudo.status === 'aprovado' || estudo.status === 'reprovado' || estudo.status === 'arquivado';
    if (travado ? !podeAprovar : !podeEditor) {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar este estudo');
      return;
    }

    // Nunca via PATCH: identidade/estado/autor gerados, colunas de soft-delete
    // geridas pelo framework (removido_em/removido_por_id — DADOS_CAMPO_RESERVADO
    // se repassadas a req.dados.atualizar). tipo_empreendimento só em rascunho.
    const bloqueados = new Set([
      'id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id',
      'criado_em', 'atualizado_em', 'removido_em', 'removido_por_id',
    ]);
    const dados: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (bloqueados.has(k)) continue;
      if (k === 'tipo_empreendimento' && estudo.status !== 'rascunho') {
        erro(res, 422, 'TIPO_TRAVADO', 'tipo_empreendimento só pode mudar em Rascunho');
        return;
      }
      // Nível de análise é imutável após a criação (Preliminar × Avançado
      // definem estruturas diferentes — trocar corromperia o estudo).
      if (k === 'nivel_analise') {
        if (v !== estudo.nivel_analise) {
          erro(res, 422, 'NIVEL_IMUTAVEL', 'nivel_analise não pode ser alterado após a criação do estudo');
          return;
        }
        continue;
      }
      dados[k] = v;
    }
    if (Object.keys(dados).length === 0) {
      erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar');
      return;
    }

    const atualizado = await req.dados!.atualizar('estudos', estudoId, dados);
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// DELETE /estudos/:id — remover (soft delete)
// ---------------------------------------------------------------
rotasEstudos.delete('/estudos/:id', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para remover este estudo'); return; }

    const removido = await req.dados!.remover('estudos', estudoId, req.contexto!.usuario.id);
    if (!removido) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /estudos/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// POST /estudos/:id/duplicar
// ---------------------------------------------------------------
rotasEstudos.post('/estudos/:id/duplicar', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para duplicar este estudo'); return; }

    const orig = await req.dados!.buscar('estudos', estudoId);
    if (!orig) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const copia: Record<string, any> = {};
    for (const [k, v] of Object.entries(orig)) {
      if (!CAMPOS_NAO_COPIAVEIS.has(k)) copia[k] = v;
    }
    const ident = await gerarIdentificacao(req, {
      nome: orig.nome, tipo_empreendimento: orig.tipo_empreendimento, uf: orig.uf,
    });
    copia.status = 'rascunho';
    copia.autor_id = req.contexto!.usuario.id;
    Object.assign(copia, ident);

    const novo = await req.dados!.criar('estudos', copia);

    // Copiar imóveis vinculados.
    const imoveis = await req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
    for (const im of imoveis.dados) {
      await req.dados!.criar('estudo_imoveis', {
        estudo_id: novo.id,
        imovel_nucleo_id: im.imovel_nucleo_id,
        tipo_imovel: im.tipo_imovel,
      });
    }

    const funcao = await garantirMembro(req, novo.id, req.contexto!.usuario.id, 'editor');
    if (funcao) await inscreverMembroEstudo(req, novo.id, req.contexto!.usuario.id, funcao);

    await publicarEvento(req, 'estudo_criado', payloadEstudoCriado(novo, req.contexto!.usuario.nome));
    res.status(201).json(novo);
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/duplicar:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// POST /estudos/:id/status — transição validada
// ---------------------------------------------------------------
// Retorna o gate necessário ('editor' | 'aprovador') ou null se transição inválida.
export function gateTransicao(de: string, para: string): 'editor' | 'aprovador' | null {
  if (de === para) return null;
  if (de === 'rascunho' && para === 'em_analise') return 'editor';
  if (de === 'em_analise' && (para === 'aprovado' || para === 'reprovado' || para === 'rascunho')) return 'aprovador';
  if (de === 'arquivado' && para === 'rascunho') return 'aprovador'; // reabrir
  if (para === 'arquivado' && de !== 'aprovado' && de !== 'arquivado') return 'aprovador';
  return null;
}

rotasEstudos.post('/estudos/:id/status', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const novoStatus = req.body.status;
    if (!STATUS.includes(novoStatus)) {
      erro(res, 400, 'STATUS_INVALIDO', `status deve ser um de: ${STATUS.join(', ')}`);
      return;
    }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const statusAnterior = String(estudo.status);
    const gate = gateTransicao(statusAnterior, novoStatus);
    if (!gate) {
      erro(res, 422, 'TRANSICAO_INVALIDA', `Transição de "${statusAnterior}" para "${novoStatus}" não é permitida`);
      return;
    }

    const perm = gate === 'aprovador'
      ? await exigirAprovador(req, estudoId)
      : await exigirEditor(req, estudoId);
    if (!perm) {
      const quem = gate === 'aprovador' ? 'aprovadores' : 'editores';
      erro(res, 403, 'SEM_PERMISSAO', `Apenas ${quem} podem fazer esta transição`);
      return;
    }

    const atualizado = await req.dados!.atualizar('estudos', estudoId, { status: novoStatus });
    await publicarEvento(
      req,
      'estudo_status_alterado',
      payloadStatusAlterado(atualizado ?? estudo, statusAnterior, novoStatus, req.contexto!.usuario.nome),
    );
    res.json(atualizado ?? { ...estudo, status: novoStatus });
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/status:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

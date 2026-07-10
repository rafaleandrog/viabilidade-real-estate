import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor, garantirMembro } from '../permissoes-estudo.js';
import { inscreverMembroEstudo, desinscreverMembroEstudo } from '../eventos-viabilidade.js';

export const rotasMembrosEstudo: ReturnType<typeof Router> = Router();

const FUNCOES = ['leitor', 'editor', 'aprovador'];

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// GET /estudos/:id/membros
rotasMembrosEstudo.get('/estudos/:id/membros', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const perm = await exigirMembro(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return; }
    const membros = await req.dados!.listar('estudo_membros', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
    res.json(membros);
  } catch (e: any) {
    console.error('Erro em GET /estudos/:id/membros:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/membros — adicionar membro (editor+)
rotasMembrosEstudo.post('/estudos/:id/membros', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const { usuario_id, funcao } = req.body;
    if (!usuario_id) { erro(res, 400, 'USUARIO_OBRIGATORIO', 'Campo "usuario_id" é obrigatório'); return; }
    if (!FUNCOES.includes(funcao)) {
      erro(res, 400, 'FUNCAO_INVALIDA', 'funcao deve ser "leitor", "editor" ou "aprovador"');
      return;
    }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem adicionar membros'); return; }

    const nova = await garantirMembro(req, estudoId, Number(usuario_id), funcao);
    if (nova) await inscreverMembroEstudo(req, estudoId, Number(usuario_id), nova);
    res.json({ ok: true, adicionado: nova !== null });
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/membros:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/membros/:usuarioId — mudar função (editor+)
rotasMembrosEstudo.patch('/estudos/:id/membros/:usuarioId', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const usuarioId = parseInt(req.params.usuarioId);
    if (isNaN(estudoId) || isNaN(usuarioId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }

    const { funcao } = req.body;
    if (!FUNCOES.includes(funcao)) {
      erro(res, 400, 'FUNCAO_INVALIDA', 'funcao deve ser "leitor", "editor" ou "aprovador"');
      return;
    }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem alterar funções'); return; }

    const membros = await req.dados!.listar('estudo_membros', {
      filtros: { estudo_id: estudoId, usuario_id: usuarioId }, por_pagina: 1,
    });
    if (membros.dados.length === 0) {
      erro(res, 404, 'MEMBRO_NAO_ENCONTRADO', 'Usuário não é membro deste estudo');
      return;
    }
    await req.dados!.atualizar('estudo_membros', membros.dados[0].id, { funcao });
    // Reconcilia inscrições conforme a nova função.
    await inscreverMembroEstudo(req, estudoId, usuarioId, funcao);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id/membros/:usuarioId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/membros/:usuarioId/remover — remover membro (editor+)
rotasMembrosEstudo.patch('/estudos/:id/membros/:usuarioId/remover', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const usuarioId = parseInt(req.params.usuarioId);
    if (isNaN(estudoId) || isNaN(usuarioId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem remover membros'); return; }

    const membros = await req.dados!.listar('estudo_membros', {
      filtros: { estudo_id: estudoId, usuario_id: usuarioId }, por_pagina: 1,
    });
    if (membros.dados.length > 0) {
      await req.dados!.deletar('estudo_membros', membros.dados[0].id);
      await desinscreverMembroEstudo(req, estudoId, usuarioId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id/membros/:usuarioId/remover:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

import { Router, type Request, type Response } from 'express';
import {
  garantirMembro, acessoLeituraEstudo, acessoEscritaEstudo, acessoNegado,
  type PermissaoEstudo,
} from '../permissoes-estudo.js';
import { inscreverMembroEstudo, desinscreverMembroEstudo } from '../eventos-viabilidade.js';

export const rotasMembrosEstudo: ReturnType<typeof Router> = Router();

const FUNCOES = ['leitor', 'editor', 'aprovador'];

/**
 * Regra pura de quem pode mexer em qual membro. Devolve a recusa, ou `null`.
 *
 * Antes, ser editor bastava para tudo: o editor se promovia a aprovador e
 * aprovava o próprio estudo, ou rebaixava/removia os aprovadores — e removendo
 * TODOS os membros, o fallback "estudo sem membros" dava editor a qualquer
 * usuário com escrita no app. A separação editor × aprovador do fluxo de
 * aprovação deixava de existir.
 *
 * - conceder `aprovador`, ou mexer em quem já É aprovador, exige aprovador
 *   (ou admin de app, que age como aprovador em qualquer estudo);
 * - ninguém muda a PRÓPRIA função (salvo admin de app);
 * - o último membro não sai: estudo sem membros fica aberto a todo editor do app.
 */
export function recusaAlteracaoMembro(args: {
  perm: Pick<PermissaoEstudo, 'ehAprovador' | 'ehAdminApp'>;
  usuarioAtual: number | undefined;
  alvo: number;
  funcaoAtualAlvo: string | null;
  funcaoNova: string | null; // null = remoção
  totalMembros: number;
}): { http: number; codigo: string; mensagem: string } | null {
  const podeAprovar = args.perm.ehAprovador || args.perm.ehAdminApp;
  if (args.funcaoNova !== null && args.usuarioAtual === args.alvo && !args.perm.ehAdminApp) {
    return { http: 403, codigo: 'PROPRIA_FUNCAO', mensagem: 'Você não pode alterar a sua própria função no estudo' };
  }
  if (!podeAprovar && (args.funcaoNova === 'aprovador' || args.funcaoAtualAlvo === 'aprovador')) {
    return { http: 403, codigo: 'SO_APROVADOR', mensagem: 'Só o aprovador concede ou altera a função de aprovador' };
  }
  if (args.funcaoNova === null && args.funcaoAtualAlvo !== null && args.totalMembros <= 1) {
    return { http: 422, codigo: 'ULTIMO_MEMBRO', mensagem: 'O estudo precisa de ao menos um membro' };
  }
  return null;
}

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// GET /estudos/:id/membros
rotasMembrosEstudo.get('/estudos/:id/membros', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const acesso = await acessoLeituraEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }
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

    const acesso = await acessoEscritaEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }
    const recusa = recusaAlteracaoMembro({
      perm: acesso.perm, usuarioAtual: req.contexto?.usuario?.id, alvo: Number(usuario_id),
      funcaoAtualAlvo: null, funcaoNova: funcao, totalMembros: 0, // só conta na remoção
    });
    if (recusa) { erro(res, recusa.http, recusa.codigo, recusa.mensagem); return; }

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

    const acesso = await acessoEscritaEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }

    const membros = await req.dados!.listar('estudo_membros', {
      filtros: { estudo_id: estudoId, usuario_id: usuarioId }, por_pagina: 1,
    });
    if (membros.dados.length === 0) {
      erro(res, 404, 'MEMBRO_NAO_ENCONTRADO', 'Usuário não é membro deste estudo');
      return;
    }
    const recusa = recusaAlteracaoMembro({
      perm: acesso.perm, usuarioAtual: req.contexto?.usuario?.id, alvo: usuarioId,
      funcaoAtualAlvo: String(membros.dados[0].funcao), funcaoNova: funcao, totalMembros: 0, // só conta na remoção
    });
    if (recusa) { erro(res, recusa.http, recusa.codigo, recusa.mensagem); return; }
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

    const acesso = await acessoEscritaEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }

    const membros = await req.dados!.listar('estudo_membros', {
      filtros: { estudo_id: estudoId, usuario_id: usuarioId }, por_pagina: 1,
    });
    if (membros.dados.length > 0) {
      const todos = await req.dados!.listar('estudo_membros', { filtros: { estudo_id: estudoId }, por_pagina: 1 });
      const recusa = recusaAlteracaoMembro({
        perm: acesso.perm, usuarioAtual: req.contexto?.usuario?.id, alvo: usuarioId,
        funcaoAtualAlvo: String(membros.dados[0].funcao), funcaoNova: null, totalMembros: todos.total,
      });
      if (recusa) { erro(res, recusa.http, recusa.codigo, recusa.mensagem); return; }
      await req.dados!.deletar('estudo_membros', membros.dados[0].id);
      await desinscreverMembroEstudo(req, estudoId, usuarioId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id/membros/:usuarioId/remover:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

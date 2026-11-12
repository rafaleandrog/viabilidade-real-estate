import { Router, type Request, type Response } from 'express';
import {
  garantirMembro, acessoLeituraEstudo, acessoEscritaEstudo, acessoNegado,
  type PermissaoEstudo,
} from '../permissoes-estudo.js';
import { inscreverMembroEstudo, desinscreverMembroEstudo } from '../eventos-viabilidade.js';

export const rotasMembrosEstudo: ReturnType<typeof Router> = Router();

const FUNCOES = ['leitor', 'editor', 'aprovador'];

const RESPONSAVEIS = ['editor', 'aprovador'];
const ehResponsavel = (f: unknown) => RESPONSAVEIS.includes(String(f));

/**
 * Regra pura de quem pode mexer em qual membro. Devolve a recusa, ou `null`.
 *
 * Antes, ser editor bastava para tudo: o editor se promovia a aprovador e
 * aprovava o próprio estudo, ou rebaixava/removia os aprovadores — e removendo
 * TODOS os membros, o atalho "estudo sem membros" dava editor a qualquer
 * usuário com escrita no app. A separação editor × aprovador do fluxo de
 * aprovação deixava de existir.
 *
 * - conceder `aprovador`, ou mexer em quem já É aprovador, exige aprovador
 *   (ou admin de app, que age como aprovador em qualquer estudo);
 * - quem já é membro não muda a PRÓPRIA função (salvo admin de app);
 * - o estudo nunca fica sem RESPONSÁVEL (editor ou aprovador): a remoção ou o
 *   rebaixamento a `leitor` do último deles é recusado.
 */
export function recusaAlteracaoMembro(args: {
  perm: Pick<PermissaoEstudo, 'ehAprovador' | 'ehAdminApp'>;
  usuarioAtual: number | undefined;
  alvo: number;
  funcaoAtualAlvo: string | null;
  funcaoNova: string | null; // null = remoção
  /** Editores e aprovadores do estudo SEM contar o alvo. */
  outrosResponsaveis: number;
}): { http: number; codigo: string; mensagem: string } | null {
  const podeAprovar = args.perm.ehAprovador || args.perm.ehAdminApp;
  if (args.funcaoNova !== null && args.funcaoAtualAlvo !== null
    && args.usuarioAtual === args.alvo && !args.perm.ehAdminApp) {
    return { http: 403, codigo: 'PROPRIA_FUNCAO', mensagem: 'Você não pode alterar a sua própria função no estudo' };
  }
  if (!podeAprovar && (args.funcaoNova === 'aprovador' || args.funcaoAtualAlvo === 'aprovador')) {
    return { http: 403, codigo: 'SO_APROVADOR', mensagem: 'Só o aprovador concede ou altera a função de aprovador' };
  }
  if (ehResponsavel(args.funcaoAtualAlvo) && !ehResponsavel(args.funcaoNova) && args.outrosResponsaveis === 0) {
    return {
      http: 422, codigo: 'ULTIMO_RESPONSAVEL',
      mensagem: 'O estudo precisa de ao menos um editor ou aprovador — adicione outro antes',
    };
  }
  return null;
}

/** Editores e aprovadores do estudo, exceto `excluirUsuario`. */
async function contarResponsaveis(req: Request, estudoId: number, excluirUsuario?: number): Promise<number> {
  const todos = await req.dados!.varrerTudo('estudo_membros', { filtros: { estudo_id: estudoId } });
  return (todos as any[]).filter((m) => ehResponsavel(m.funcao) && Number(m.usuario_id) !== excluirUsuario).length;
}

/**
 * Desfaz a remoção do último responsável. Se, na janela entre o `deletar` e
 * aqui, outra requisição já re-incluiu o MESMO usuário (como leitor, digamos),
 * criar de novo bateria na unicidade `[estudo_id, usuario_id]` e responderia
 * 500, deixando o estudo só com esse leitor. Então: se a linha voltou a existir,
 * ela recebe de volta a função de responsável; se não, é recriada.
 */
async function restaurarResponsavel(req: Request, estudoId: number, usuarioId: number, funcao: string): Promise<void> {
  const linha = async () => (await req.dados!.listar('estudo_membros', {
    filtros: { estudo_id: estudoId, usuario_id: usuarioId }, por_pagina: 1,
  })).dados[0];
  const existente = await linha();
  if (existente) { await req.dados!.atualizar('estudo_membros', existente.id, { funcao }); return; }
  try {
    await req.dados!.criar('estudo_membros', { estudo_id: estudoId, usuario_id: usuarioId, funcao });
  } catch (e) {
    // Perdeu a corrida para a re-inclusão concorrente: a linha agora existe.
    const outra = await linha();
    if (!outra) throw e;
    await req.dados!.atualizar('estudo_membros', outra.id, { funcao });
  }
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
    // Quem já é membro não muda por aqui (`garantirMembro` é idempotente), mas a
    // função atual entra na regra para a resposta ser a mesma do PATCH.
    const existente = await req.dados!.listar('estudo_membros', {
      filtros: { estudo_id: estudoId, usuario_id: Number(usuario_id) }, por_pagina: 1,
    });
    const recusa = recusaAlteracaoMembro({
      perm: acesso.perm, usuarioAtual: req.contexto?.usuario?.id, alvo: Number(usuario_id),
      funcaoAtualAlvo: existente.dados[0] ? String(existente.dados[0].funcao) : null,
      funcaoNova: funcao, outrosResponsaveis: 1, // não conta: adicionar nunca tira responsável
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
    const anterior = String(membros.dados[0].funcao);
    const recusa = recusaAlteracaoMembro({
      perm: acesso.perm, usuarioAtual: req.contexto?.usuario?.id, alvo: usuarioId,
      funcaoAtualAlvo: anterior, funcaoNova: funcao,
      outrosResponsaveis: await contarResponsaveis(req, estudoId, usuarioId),
    });
    if (recusa) { erro(res, recusa.http, recusa.codigo, recusa.mensagem); return; }
    await req.dados!.atualizar('estudo_membros', membros.dados[0].id, { funcao });
    // Mesma recontagem da remoção (ver lá): dois rebaixamentos simultâneos não
    // podem deixar o estudo sem responsável.
    if (ehResponsavel(anterior) && !ehResponsavel(funcao) && (await contarResponsaveis(req, estudoId)) === 0) {
      await req.dados!.atualizar('estudo_membros', membros.dados[0].id, { funcao: anterior });
      erro(res, 422, 'ULTIMO_RESPONSAVEL', 'O estudo precisa de ao menos um editor ou aprovador — adicione outro antes');
      return;
    }
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
      const removido = membros.dados[0];
      const recusa = recusaAlteracaoMembro({
        perm: acesso.perm, usuarioAtual: req.contexto?.usuario?.id, alvo: usuarioId,
        funcaoAtualAlvo: String(removido.funcao), funcaoNova: null,
        outrosResponsaveis: await contarResponsaveis(req, estudoId, usuarioId),
      });
      if (recusa) { erro(res, recusa.http, recusa.codigo, recusa.mensagem); return; }
      await req.dados!.deletar('estudo_membros', removido.id);
      // A contagem acima e o `deletar` não são atômicos: duas remoções simultâneas
      // num estudo de 2 responsáveis passariam as duas. Recontar DEPOIS de apagar
      // fecha a janela: quem achar zero desfaz a própria remoção. Na corrida, as
      // duas desfazem e o estudo fica com os dois — nunca sem responsável. (Sem o
      // atalho "estudo sem membros", o instante entre o `deletar` e a recriação
      // não abre o estudo a ninguém além do admin do app.)
      if (ehResponsavel(removido.funcao) && (await contarResponsaveis(req, estudoId)) === 0) {
        await restaurarResponsavel(req, estudoId, Number(removido.usuario_id), String(removido.funcao));
        erro(res, 422, 'ULTIMO_RESPONSAVEL', 'O estudo precisa de ao menos um editor ou aprovador — adicione outro antes');
        return;
      }
      await desinscreverMembroEstudo(req, estudoId, usuarioId);
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id/membros/:usuarioId/remover:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

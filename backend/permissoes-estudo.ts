import type { Request } from 'express';

// Permissão por estudo (4ª camada) — espelha o padrão de `ciclo_membros` do OKR.
// Cada estudo tem seus próprios membros com função leitor/editor/aprovador.
// O nível de app (leitura/escrita/admin) vem do shell em req.contexto.nivelApp.

export type FuncaoEstudo = 'leitor' | 'editor' | 'aprovador' | null;

export interface PermissaoEstudo {
  funcao: FuncaoEstudo;
  ehLeitor: boolean;
  ehEditor: boolean;
  ehAprovador: boolean;
  ehMembro: boolean;
  podeEditar: boolean; // nível de app escrita+
  ehAdminApp: boolean; // nível de app admin (age como aprovador em qualquer estudo)
}

/**
 * Resolve a função do usuário no contexto de um estudo, consultando
 * `estudo_membros` e combinando com o nível de app.
 */
export async function resolverPermissaoEstudo(
  req: Request,
  estudoId: number,
): Promise<PermissaoEstudo> {
  const userId = req.contexto?.usuario?.id;
  const nivel = req.contexto?.nivelApp;
  const podeEditar = nivel === 'escrita' || nivel === 'admin';
  const ehAdminApp = nivel === 'admin';

  let funcao: FuncaoEstudo = null;
  if (userId && estudoId) {
    const membros = await req.dados!.listar('estudo_membros', {
      filtros: { estudo_id: estudoId, usuario_id: userId },
      por_pagina: 1,
    });
    if (membros.dados.length > 0) {
      funcao = membros.dados[0].funcao as FuncaoEstudo;
    }
  }

  const ehLeitor = funcao === 'leitor';
  const ehEditor = funcao === 'editor';
  const ehAprovador = funcao === 'aprovador';
  const ehMembro = ehLeitor || ehEditor || ehAprovador;

  return { funcao, ehLeitor, ehEditor, ehAprovador, ehMembro, podeEditar, ehAdminApp };
}

/** Verdadeiro se o estudo ainda não tem nenhum membro. */
async function semMembros(req: Request, estudoId: number): Promise<boolean> {
  const total = await req.dados!.listar('estudo_membros', {
    filtros: { estudo_id: estudoId },
    por_pagina: 1,
  });
  return total.total === 0;
}

/**
 * Garante que o usuário é membro do estudo (qualquer função).
 * Estudo sem membros: qualquer usuário com escrita+ age como membro.
 */
export async function exigirMembro(
  req: Request,
  estudoId: number,
): Promise<PermissaoEstudo | null> {
  const perm = await resolverPermissaoEstudo(req, estudoId);
  if (perm.ehMembro || perm.ehAdminApp) return perm;
  if (perm.podeEditar && (await semMembros(req, estudoId))) {
    return { ...perm, ehMembro: true };
  }
  return null;
}

/**
 * Garante função de editor (ou aprovador, que inclui tudo do editor).
 * Estudo sem membros: qualquer usuário com escrita+ assume editor.
 */
export async function exigirEditor(
  req: Request,
  estudoId: number,
): Promise<PermissaoEstudo | null> {
  const perm = await resolverPermissaoEstudo(req, estudoId);
  if (perm.ehEditor || perm.ehAprovador || perm.ehAdminApp) return perm;
  if (perm.podeEditar && (await semMembros(req, estudoId))) {
    return { ...perm, ehEditor: true };
  }
  return null;
}

/**
 * Garante função de aprovador. Admin de app age como aprovador em qualquer estudo.
 */
export async function exigirAprovador(
  req: Request,
  estudoId: number,
): Promise<PermissaoEstudo | null> {
  const perm = await resolverPermissaoEstudo(req, estudoId);
  if (perm.ehAprovador || perm.ehAdminApp) return perm;
  return null;
}

/**
 * Adiciona o usuário como membro do estudo com a função dada, se ainda não for.
 * Idempotente: retorna a função recém-criada, ou null se já era membro.
 */
export async function garantirMembro(
  req: Request,
  estudoId: number,
  usuarioId: number,
  funcao: 'leitor' | 'editor' | 'aprovador',
): Promise<'leitor' | 'editor' | 'aprovador' | null> {
  const existente = await req.dados!.listar('estudo_membros', {
    filtros: { estudo_id: estudoId, usuario_id: usuarioId },
    por_pagina: 1,
  });
  if (existente.dados.length > 0) return null;
  await req.dados!.criar('estudo_membros', { estudo_id: estudoId, usuario_id: usuarioId, funcao });
  return funcao;
}

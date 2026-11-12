import type { Request } from 'express';
import { funcaoEfetivaDoMembro } from '../frontend/membros-regras.js';

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

  // #861: a função que vale é o mínimo entre a linha gravada e o que o nível do
  // app comporta (aprovador exige `admin`, decisão do autor, 2026-11-12). Defesa
  // para linhas gravadas antes da regra de concessão, ou de quem perdeu nível.
  const efetiva = funcaoEfetivaDoMembro(funcao, nivel);
  const ehLeitor = efetiva === 'leitor';
  const ehEditor = efetiva === 'editor';
  const ehAprovador = efetiva === 'aprovador';
  const ehMembro = ehLeitor || ehEditor || ehAprovador;

  return { funcao: efetiva, ehLeitor, ehEditor, ehAprovador, ehMembro, podeEditar, ehAdminApp };
}

/**
 * Garante que o usuário é membro do estudo (qualquer função) ou admin do app.
 *
 * #861: não existe mais o atalho "estudo sem membros: qualquer usuário com
 * escrita+ age como membro". Ele era a ponte para estudos anteriores à tabela de
 * membros, mas todo estudo nasce hoje com o criador como editor, então o único
 * jeito de atingi-lo era ESVAZIAR o estudo — e aí qualquer usuário com escrita
 * se adicionava como aprovador e aprovava. Estudo sem membros é só do admin do
 * app, que re-adiciona quem precisar; e a regra do último responsável
 * (`decidirResponsavelRestante`) impede que ele fique vazio.
 */
export async function exigirMembro(
  req: Request,
  estudoId: number,
): Promise<PermissaoEstudo | null> {
  const perm = await resolverPermissaoEstudo(req, estudoId);
  if (perm.ehMembro || perm.ehAdminApp) return perm;
  return null;
}

/** Garante função de editor (ou aprovador, que inclui tudo do editor), ou admin do app. */
export async function exigirEditor(
  req: Request,
  estudoId: number,
): Promise<PermissaoEstudo | null> {
  const perm = await resolverPermissaoEstudo(req, estudoId);
  if (perm.ehEditor || perm.ehAprovador || perm.ehAdminApp) return perm;
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

import type { Request } from 'express';
import { STATUS_TRAVADO } from '../frontend/estudo-status.js';

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

// ⚠️ Não há mais o atalho "estudo sem membros: qualquer usuário com escrita+
// age como membro/editor". Ele era a ponte para estudos anteriores à tabela de
// membros; hoje todo estudo nasce com o criador como editor (`POST /estudos` e
// `POST /duplicar` chamam `garantirMembro`), e o atalho só era alcançado quando
// alguém ESVAZIAVA o estudo — e aí virava porta de entrada: qualquer usuário com
// escrita se incluía como aprovador e aprovava. Estudo sem membros agora é só do
// admin do app, que re-adiciona quem precisar.

/** Garante que o usuário é membro do estudo (qualquer função), ou admin do app. */
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

// ---------------------------------------------------------------
// Acesso a um estudo pelas SUB-ROTAS (produtos, documentos de Empreendimento,
// apelo, análise de mercado, leitura de imóveis e membros). O Avançado e o
// Funding têm helpers próprios (`exigirLeitura`/`exigirEscrita`), que aplicam as
// mesmas regras de status; a escrita de imóveis aceita só Rascunho.
//
// Antes, cada sub-rota chamava só `exigirMembro`/`exigirEditor`, sem carregar o
// estudo. Três regras que `GET`/`PATCH /estudos/:id` aplicam ficavam de fora:
//
// - estudo EXCLUÍDO (soft delete): `buscar` devolve `null` → 404. Sem isto as
//   sub-rotas seguiam lendo e gravando filhos de um estudo removido, porque o
//   vínculo de membro sobrevive à remoção;
// - estudo TRAVADO (aprovado/reprovado/arquivado): só aprovador escreve — a
//   mesma regra de status de `podeEditarEstudo` (o `PATCH /estudos/:id`). Sem isto um editor mudava
//   o catálogo (e portanto o VGV) de um estudo já aprovado;
// - LEITOR não vê rascunho nem arquivado — a mesma regra do `GET /estudos/:id`
//   e da listagem. Sem isto o leitor lia custos, catálogo e funding do
//   rascunho chamando a sub-rota direto.
//
// As duas funções devolvem o estudo carregado para o handler não buscá-lo de novo.
// ---------------------------------------------------------------

/** Status que o leitor não enxerga — os mesmos do `GET /estudos/:id`. */
export const STATUS_OCULTO_AO_LEITOR: readonly string[] = ['rascunho', 'arquivado'];

export interface NegacaoAcesso { http: number; codigo: string; mensagem: string }
export type AcessoEstudo = { estudo: Record<string, any>; perm: PermissaoEstudo } | NegacaoAcesso;

export function acessoNegado(a: AcessoEstudo): a is NegacaoAcesso {
  return 'http' in a;
}

/**
 * Regra pura de leitura: o leitor (que não seja admin de app) não vê rascunho
 * nem arquivado. Admin de app enxerga tudo, inclusive quando também é membro
 * com função `leitor` — a listagem já mostra todos os estudos a ele.
 */
export function leituraBloqueadaPorStatus(status: unknown, perm: Pick<PermissaoEstudo, 'ehLeitor' | 'ehAdminApp'>): boolean {
  return perm.ehLeitor && !perm.ehAdminApp && STATUS_OCULTO_AO_LEITOR.includes(String(status));
}

/** Verdadeiro quando escrever no estudo, neste status, exige aprovador. */
export function escritaExigeAprovador(status: unknown): boolean {
  return STATUS_TRAVADO.includes(String(status));
}

/** Carrega o estudo e confere leitura: 404 se não existe/foi excluído, 403 sem acesso. */
export async function acessoLeituraEstudo(req: Request, estudoId: number): Promise<AcessoEstudo> {
  const estudo = await req.dados!.buscar('estudos', estudoId);
  if (!estudo) return { http: 404, codigo: 'ESTUDO_NAO_ENCONTRADO', mensagem: 'Estudo não encontrado' };
  const perm = await exigirMembro(req, estudoId);
  if (!perm) return { http: 403, codigo: 'SEM_PERMISSAO', mensagem: 'Sem acesso a este estudo' };
  if (leituraBloqueadaPorStatus(estudo.status, perm)) {
    return { http: 403, codigo: 'SEM_PERMISSAO', mensagem: 'Sem acesso a este estudo neste status' };
  }
  return { estudo, perm };
}

/**
 * Carrega o estudo e confere escrita: 404 se não existe/foi excluído; editor+
 * em status aberto; só aprovador (ou admin de app) com o estudo travado.
 */
export async function acessoEscritaEstudo(req: Request, estudoId: number): Promise<AcessoEstudo> {
  const estudo = await req.dados!.buscar('estudos', estudoId);
  if (!estudo) return { http: 404, codigo: 'ESTUDO_NAO_ENCONTRADO', mensagem: 'Estudo não encontrado' };
  const travado = escritaExigeAprovador(estudo.status);
  const perm = travado ? await exigirAprovador(req, estudoId) : await exigirEditor(req, estudoId);
  if (!perm) {
    return {
      http: 403, codigo: 'SEM_PERMISSAO',
      mensagem: travado ? 'Estudo travado neste status — só o aprovador edita' : 'Sem permissão para editar este estudo',
    };
  }
  return { estudo, perm };
}

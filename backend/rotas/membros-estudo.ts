import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor, garantirMembro, type PermissaoEstudo } from '../permissoes-estudo.js';
import { inscreverMembroEstudo, desinscreverMembroEstudo } from '../eventos-viabilidade.js';
import {
  ehFuncaoEstudo, decidirAlteracaoMembro, decidirResponsavelRestante, decidirNivelDoAlvo,
  type AtorMembros, type FuncaoEstudo, type RecusaMembros,
} from '../../frontend/membros-regras.js';
import { numeroEstrito } from './coercao-numerica.js';

export const rotasMembrosEstudo: ReturnType<typeof Router> = Router();

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

function recusar(res: Response, r: RecusaMembros) {
  erro(res, r.http, r.codigo, r.mensagem);
}

// #861: as três regras de concessão (quem concede o quê, último responsável e
// nível do app do alvo) moram em `frontend/membros-regras.ts`, funções puras
// que a tela também usa. Aqui elas são o portão: reavaliadas a cada pedido.

/** id de usuário: inteiro positivo, pelo parser único da app. */
function idUsuario(v: unknown): number | null {
  const n = numeroEstrito(v);
  return n !== null && Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

function atorDe(req: Request, perm: PermissaoEstudo): AtorMembros {
  return {
    usuarioId: Number(req.contexto!.usuario.id),
    ehAdminApp: perm.ehAdminApp,
    funcao: perm.ehAprovador ? 'aprovador' : perm.ehEditor ? 'editor' : perm.ehLeitor ? 'leitor' : null,
  };
}

/**
 * As mutações de membros de um MESMO estudo correm em série. Sem isso, duas
 * remoções (ou rebaixamentos) simultâneas dos dois últimos responsáveis leem a
 * mesma lista, as duas passam por `decidirResponsavelRestante` e o estudo fica
 * sem editor nem aprovador — achado P2 do App do Codex na revisão da #861.
 * Mesmo desenho da `filaSemeadura` de `./avancado.ts`, com a mesma ressalva: a
 * fila é deste processo; com mais de uma réplica do backend a janela volta a
 * existir entre réplicas (e o estado resultante é só um estudo do admin, não
 * uma escalação — sem o atalho `semMembros`, ninguém mais entra nele).
 */
const filaMembros = new Map<number, Promise<unknown>>();

async function emSerie<T>(estudoId: number, fn: () => Promise<T>): Promise<T> {
  const anterior = filaMembros.get(estudoId) ?? Promise.resolve();
  const atual = anterior.then(fn, fn);
  const cauda = atual.then(() => undefined, () => undefined);
  filaMembros.set(estudoId, cauda);
  try {
    return await atual;
  } finally {
    if (filaMembros.get(estudoId) === cauda) filaMembros.delete(estudoId);
  }
}

async function membrosDoEstudo(req: Request, estudoId: number): Promise<any[]> {
  return req.dados!.varrerTudo('estudo_membros', { filtros: { estudo_id: estudoId } });
}

/**
 * Nível efetivo do alvo no app. Usuário inexistente ou sem acesso responde
 * `nenhuma` — e vira 422 na regra de nível, nunca 500.
 */
async function nivelDoAlvo(req: Request, usuarioId: number): Promise<string> {
  try {
    return (await req.shell!.nivelEfetivoUsuario(usuarioId)) ?? 'nenhuma';
  } catch (e) {
    // Falha FECHADA: sem confirmar o nível, a concessão é recusada. O SDK não diz
    // quando o helper lança (usuário inexistente? falha transitória?), então o
    // erro vai para o log — a recusa em si não distingue os dois casos.
    console.warn(`nivelEfetivoUsuario(${usuarioId}) falhou; tratado como "nenhuma":`, e);
    return 'nenhuma';
  }
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

// POST /estudos/:id/membros — adicionar membro (editor+, dentro das regras de concessão)
rotasMembrosEstudo.post('/estudos/:id/membros', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const { funcao } = req.body;
    if (req.body.usuario_id === undefined || req.body.usuario_id === null || req.body.usuario_id === '') {
      erro(res, 400, 'USUARIO_OBRIGATORIO', 'Campo "usuario_id" é obrigatório'); return;
    }
    const usuarioId = idUsuario(req.body.usuario_id);
    if (usuarioId === null) { erro(res, 400, 'USUARIO_INVALIDO', '"usuario_id" deve ser um inteiro positivo'); return; }
    if (!ehFuncaoEstudo(funcao)) {
      erro(res, 400, 'FUNCAO_INVALIDA', 'funcao deve ser "leitor", "editor" ou "aprovador"');
      return;
    }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem adicionar membros'); return; }

    await emSerie(estudoId, async () => {
      const membros = await membrosDoEstudo(req, estudoId);
      const atual = membros.find((m) => Number(m.usuario_id) === usuarioId);
      if (atual) { res.json({ ok: true, adicionado: false }); return; }

      const recusa = decidirAlteracaoMembro(atorDe(req, perm), { usuarioId, funcaoAtual: null }, funcao)
        ?? decidirNivelDoAlvo(await nivelDoAlvo(req, usuarioId), funcao);
      if (recusa) { recusar(res, recusa); return; }

      const nova = await garantirMembro(req, estudoId, usuarioId, funcao);
      if (nova) await inscreverMembroEstudo(req, estudoId, usuarioId, nova);
      res.json({ ok: true, adicionado: nova !== null });
    });
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/membros:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/membros/:usuarioId — mudar função (editor+, dentro das regras de concessão)
rotasMembrosEstudo.patch('/estudos/:id/membros/:usuarioId', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const usuarioId = parseInt(req.params.usuarioId);
    if (isNaN(estudoId) || isNaN(usuarioId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }

    const { funcao } = req.body;
    if (!ehFuncaoEstudo(funcao)) {
      erro(res, 400, 'FUNCAO_INVALIDA', 'funcao deve ser "leitor", "editor" ou "aprovador"');
      return;
    }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem alterar funções'); return; }

    await emSerie(estudoId, async () => {
      const membros = await membrosDoEstudo(req, estudoId);
      const membro = membros.find((m) => Number(m.usuario_id) === usuarioId);
      if (!membro) {
        erro(res, 404, 'MEMBRO_NAO_ENCONTRADO', 'Usuário não é membro deste estudo');
        return;
      }
      if (membro.funcao === funcao) { res.json({ ok: true }); return; }

      const recusa = decidirAlteracaoMembro(
        atorDe(req, perm), { usuarioId, funcaoAtual: membro.funcao as FuncaoEstudo }, funcao,
      )
        ?? decidirResponsavelRestante(membros, usuarioId, funcao)
        ?? decidirNivelDoAlvo(await nivelDoAlvo(req, usuarioId), funcao);
      if (recusa) { recusar(res, recusa); return; }

      await req.dados!.atualizar('estudo_membros', membro.id, { funcao });
      // Reconcilia inscrições conforme a nova função.
      await inscreverMembroEstudo(req, estudoId, usuarioId, funcao);
      res.json({ ok: true });
    });
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id/membros/:usuarioId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/membros/:usuarioId/remover — remover membro (editor+, dentro das regras de concessão)
rotasMembrosEstudo.patch('/estudos/:id/membros/:usuarioId/remover', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const usuarioId = parseInt(req.params.usuarioId);
    if (isNaN(estudoId) || isNaN(usuarioId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem remover membros'); return; }

    await emSerie(estudoId, async () => {
      const membros = await membrosDoEstudo(req, estudoId);
      const membro = membros.find((m) => Number(m.usuario_id) === usuarioId);
      if (membro) {
        const recusa = decidirAlteracaoMembro(
          atorDe(req, perm), { usuarioId, funcaoAtual: membro.funcao as FuncaoEstudo }, null,
        ) ?? decidirResponsavelRestante(membros, usuarioId, null);
        if (recusa) { recusar(res, recusa); return; }
        await req.dados!.deletar('estudo_membros', membro.id);
        await desinscreverMembroEstudo(req, estudoId, usuarioId);
      }
      res.json({ ok: true });
    });
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id/membros/:usuarioId/remover:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

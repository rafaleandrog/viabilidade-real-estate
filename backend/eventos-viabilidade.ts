import type { Request } from 'express';

// Helpers de eventos do app `viabilidade`.
// Os tipos são declarados no manifesto (§6.9). Ao publicar, o shell prefixa
// automaticamente `app.viabilidade.` — publicamos a chave nua.
// A publicação valida o payload contra os `campos` do manifesto (nem faltando
// nem extra), então os payloads abaixo batem exatamente com a declaração.

const PREFIXO = 'app.viabilidade.';

/** Publica um evento sem bloquear a mutação em caso de falha — apenas loga. */
export async function publicarEvento(
  req: Request,
  tipo: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await req.eventos!.publicar(tipo, payload);
  } catch (err) {
    console.warn(`[viabilidade] Falha ao publicar evento ${tipo}:`, err);
  }
}

/**
 * Inscreve um membro do estudo nos eventos relevantes (inscrição forte).
 * Todos os membros seguem mudanças de status; editores e aprovadores também
 * seguem a conclusão do apelo comercial.
 */
export async function inscreverMembroEstudo(
  req: Request,
  estudoId: number,
  usuarioId: number,
  funcao: 'leitor' | 'editor' | 'aprovador',
): Promise<void> {
  try {
    await req.eventos!.inscreverUsuario(
      usuarioId,
      `${PREFIXO}estudo_status_alterado`,
      { estudo_id: estudoId },
      'forte',
    );
    if (funcao === 'editor' || funcao === 'aprovador') {
      await req.eventos!.inscreverUsuario(
        usuarioId,
        `${PREFIXO}apelo_comercial_concluido`,
        { estudo_id: estudoId },
        'forte',
      );
    }
  } catch (err) {
    console.warn('[viabilidade] Falha ao inscrever membro:', err);
  }
}

/** Cancela as inscrições de um membro removido do estudo. Best-effort. */
export async function desinscreverMembroEstudo(
  req: Request,
  estudoId: number,
  usuarioId: number,
): Promise<void> {
  const filtros = { estudo_id: estudoId };
  for (const tipo of ['estudo_status_alterado', 'apelo_comercial_concluido']) {
    try {
      await req.eventos!.cancelarInscricao(usuarioId, `${PREFIXO}${tipo}`, filtros);
    } catch (err) {
      console.warn('[viabilidade] Falha ao cancelar inscrição:', err);
    }
  }
}

// --- Payload builders (batem com os `campos` do manifesto) ---

export function payloadEstudoCriado(estudo: any, autorNome: string): Record<string, unknown> {
  return {
    estudo_id: Number(estudo.id),
    nome_estudo: String(estudo.nome_exibicao ?? estudo.nome ?? ''),
    tipo_empreendimento: String(estudo.tipo_empreendimento ?? ''),
    autor: autorNome,
  };
}

export function payloadStatusAlterado(
  estudo: any,
  statusAnterior: string,
  statusNovo: string,
  autorNome: string,
): Record<string, unknown> {
  return {
    estudo_id: Number(estudo.id),
    nome_estudo: String(estudo.nome_exibicao ?? estudo.nome ?? ''),
    tipo_empreendimento: String(estudo.tipo_empreendimento ?? ''),
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    autor: autorNome,
  };
}

export function payloadApeloConcluido(estudo: any, scoreGeral: number): Record<string, unknown> {
  return {
    estudo_id: Number(estudo.id),
    nome_estudo: String(estudo.nome_exibicao ?? estudo.nome ?? ''),
    score_geral: scoreGeral,
  };
}

import { Router, type Request, type Response } from 'express';
import { publicarEvento, payloadStatusAlterado } from '../eventos-viabilidade.js';

export const rotasManutencao: ReturnType<typeof Router> = Router();

// Arquivamento automático (§3): estudos parados por N dias (default 30) em
// qualquer status exceto Aprovado viram "Arquivado".
//
// A regra vive aqui como rotina idempotente. O DISPARO automático depende do
// contrato de agendamento do shell (rotina/cron do UrbiVerso) — não há hook de
// boot na app; enquanto isso, um admin ou o agendador chama este endpoint.
rotasManutencao.post('/manutencao/arquivar-inativos', async (req: Request, res: Response) => {
  try {
    if (req.contexto?.nivelApp !== 'admin') {
      res.status(403).json({ erro: true, codigo: 'SEM_PERMISSAO', mensagem: 'Apenas administradores' });
      return;
    }

    let prazoDias = 30;
    try { prazoDias = Number(await req.parametros!.obter('prazo_arquivamento_dias')) || 30; } catch { /* usa default */ }
    const corte = Date.now() - prazoDias * 24 * 60 * 60 * 1000;

    const todos = await req.dados!.listar('estudos', { por_pagina: 1000 });
    let arquivados = 0;
    for (const e of todos.dados) {
      if (e.status === 'aprovado' || e.status === 'arquivado') continue;
      const ref = new Date(e.atualizado_em || e.criado_em).getTime();
      if (isNaN(ref) || ref >= corte) continue;
      await req.dados!.atualizar('estudos', e.id, { status: 'arquivado' });
      await publicarEvento(req, 'estudo_status_alterado',
        payloadStatusAlterado(e, String(e.status), 'arquivado', 'Sistema (arquivamento automático)'));
      arquivados++;
    }
    res.json({ ok: true, arquivados, prazo_dias: prazoDias });
  } catch (e: any) {
    console.error('Erro em POST /manutencao/arquivar-inativos:', e);
    res.status(500).json({ erro: true, codigo: 'ERRO_INTERNO', mensagem: e.message });
  }
});

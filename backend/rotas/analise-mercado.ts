import { Router, type Request, type Response } from 'express';
import { exigirMembro } from '../permissoes-estudo.js';

// Rotas da ANÁLISE DE MERCADO (#199) — leitura do snapshot de mercado de um
// estudo. A tabela `analise_mercado` guarda só o lado MERCADO (preço/custo por
// m², VSO, macros, riscos e procedência); o lado PROJETO é derivado no
// frontend a partir do próprio estudo (`frontend/analise-mercado.ts`), para não
// duplicar dado que já existe nas outras abas.
//
// Aqui há apenas o GET: quem PREENCHE o snapshot é a rota de IA do #200. Até
// ela existir, o GET responde `{ analise: null }` e a tela mostra o estado
// "sem dado de mercado" — que é estado normal, não erro.

export const rotasAnaliseMercado: ReturnType<typeof Router> = Router();

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// GET /estudos/:id/analise-mercado — snapshot de mercado (ou null)
rotasAnaliseMercado.get('/estudos/:id/analise-mercado', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirMembro(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return; }

    const r = await req.dados!.listar('analise_mercado', {
      filtros: { estudo_id: estudoId }, por_pagina: 1,
    });
    // Ausência de snapshot NÃO é 404: o estudo existe, só nunca rodou a análise.
    res.json({ analise: r.dados[0] ?? null });
  } catch (e: any) {
    console.error('Erro em GET analise-mercado:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

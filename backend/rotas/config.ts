import { Router, type Request, type Response } from 'express';

export const rotasConfig: ReturnType<typeof Router> = Router();

// Parâmetros configuráveis da app (§6.5), declarados no manifesto e geridos
// pelo shell (Admin → Apps → viabilidade). Esta rota expõe os valores efetivos
// ao frontend para pré-preencher defaults na criação de estudos.

const PARAMETROS = [
  'imposto_padrao_pct',
  'aliquota_ret_pct',
  'corretagem_padrao_pct',
  'marketing_padrao_pct',
  'gestao_indiretos_padrao_pct',
  'prazo_arquivamento_dias',
];

// GET /config — valores efetivos dos parâmetros da app
rotasConfig.get('/config', async (req: Request, res: Response) => {
  try {
    const parametros: Record<string, unknown> = {};
    for (const slug of PARAMETROS) {
      try {
        parametros[slug] = await req.parametros!.obter(slug);
      } catch {
        parametros[slug] = null;
      }
    }
    res.json({ parametros });
  } catch (e: any) {
    console.error('Erro em GET /config:', e);
    res.status(500).json({ erro: true, codigo: 'ERRO_INTERNO', mensagem: e.message });
  }
});

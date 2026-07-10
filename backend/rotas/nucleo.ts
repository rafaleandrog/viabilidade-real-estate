import { Router, type Request, type Response } from 'express';

export const rotasNucleo: ReturnType<typeof Router> = Router();

// Proxy do Núcleo para o modo "Buscar terreno" (§6.6).
//
// Estado atual: a instância do Núcleo deste ambiente NÃO expõe glebas/lotes
// (não há rota REST nem método de listagem em req.nucleo — os tipos do SDK
// listam essas entidades como futuras). Portanto as rotas abaixo respondem com
// `disponivel: false` e lista vazia, para o frontend degradar graciosamente
// para o modo "Inserir novo" (manual). Quando o Núcleo expuser glebas/lotes,
// declarar `permissoes_nucleo: { glebas: "leitura", lotes: "leitura" }` no
// manifesto e trocar a implementação por chamadas reais via req.nucleo.

const MOTIVO = 'Integração com o Núcleo (glebas/lotes) ainda não disponível nesta instância. Use o modo "Inserir novo" (manual).';

function respostaIndisponivel(res: Response) {
  res.json({ dados: [], total: 0, disponivel: false, motivo: MOTIVO });
}

// GET /nucleo/glebas — listar glebas (Loteamento)
rotasNucleo.get('/nucleo/glebas', async (_req: Request, res: Response) => {
  respostaIndisponivel(res);
});

// GET /nucleo/lotes — listar lotes (Incorporação)
rotasNucleo.get('/nucleo/lotes', async (_req: Request, res: Response) => {
  respostaIndisponivel(res);
});

// GET /nucleo/imoveis/:id — detalhe do imóvel selecionado
rotasNucleo.get('/nucleo/imoveis/:id', async (_req: Request, res: Response) => {
  res.status(404).json({
    erro: true,
    codigo: 'NUCLEO_INDISPONIVEL',
    mensagem: MOTIVO,
  });
});

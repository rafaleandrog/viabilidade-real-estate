import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor } from '../permissoes-estudo.js';

// Rotas da aba "Empreendimento → Informações" (nível Avançado · Lote 4 · #16):
// anexos do estudo (imagem principal, renders, plantas). Espelha o padrão dos
// documentos do Apelo Comercial — o upload cru vai pelo endpoint genérico do
// framework de arquivos (/api/dados/viabilidade/estudo_documentos/__upload),
// e estas rotas associam o upload ao estudo com metadados.
//
// Matrícula e descrição vivem na própria tabela `estudos` e são gravadas pelo
// PATCH /estudos/:id (blocklist — passam direto).

export const rotasEmpreendimento: ReturnType<typeof Router> = Router();

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

const CATEGORIAS = ['imagem_principal', 'render', 'planta'];

// GET /estudos/:id/empreendimento/documentos — lista anexos do estudo
rotasEmpreendimento.get('/estudos/:id/empreendimento/documentos', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirMembro(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso'); return; }

    const r = await req.dados!.listar('estudo_documentos', {
      filtros: { estudo_id: estudoId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 200,
    });
    res.json({ dados: r.dados });
  } catch (e: any) {
    console.error('Erro em GET empreendimento/documentos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/empreendimento/documentos — associa upload + metadados
rotasEmpreendimento.post('/estudos/:id/empreendimento/documentos', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem anexar documentos'); return; }

    const { upload_id, categoria, nome_arquivo } = req.body;
    if (!upload_id) { erro(res, 400, 'NADA_A_ANEXAR', 'Informe um arquivo (upload_id)'); return; }
    const cat = CATEGORIAS.includes(categoria) ? categoria : 'render';

    const r = await req.dados!.listar('estudo_documentos', { filtros: { estudo_id: estudoId }, por_pagina: 1 });
    const doc = await req.dados!.criar('estudo_documentos', {
      estudo_id: estudoId,
      categoria: cat,
      documento: upload_id,
      nome_arquivo: nome_arquivo ? String(nome_arquivo).slice(0, 255) : null,
      ordem: r.total ?? 0,
    });
    res.status(201).json(doc);
  } catch (e: any) {
    console.error('Erro em POST empreendimento/documentos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// DELETE /estudos/:id/empreendimento/documentos/:docId
rotasEmpreendimento.delete('/estudos/:id/empreendimento/documentos/:docId', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(estudoId) || isNaN(docId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão'); return; }

    const doc = await req.dados!.buscar('estudo_documentos', docId);
    if (!doc || Number(doc.estudo_id) !== estudoId) {
      erro(res, 404, 'DOCUMENTO_NAO_ENCONTRADO', 'Documento não encontrado neste estudo');
      return;
    }
    await req.dados!.deletar('estudo_documentos', docId);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE empreendimento/documento:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

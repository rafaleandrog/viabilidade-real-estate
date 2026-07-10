import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor } from '../permissoes-estudo.js';

export const rotasImoveisEstudo: ReturnType<typeof Router> = Router();

// Vínculo imóvel ↔ estudo (§4.3). A seleção só é editável em Rascunho.
// Loteamento → exatamente 1 gleba. Incorporação → 1+ lotes.
// imovel_nucleo_id é referência lógica ao Núcleo (glebas/lotes via req.nucleo).

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// GET /estudos/:id/imoveis
rotasImoveisEstudo.get('/estudos/:id/imoveis', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const perm = await exigirMembro(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return; }
    const imoveis = await req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
    res.json(imoveis);
  } catch (e: any) {
    console.error('Erro em GET /estudos/:id/imoveis:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/imoveis — vincular imóvel (editor+, apenas Rascunho)
rotasImoveisEstudo.post('/estudos/:id/imoveis', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    if (estudo.status !== 'rascunho') {
      erro(res, 422, 'IMOVEL_TRAVADO', 'O imóvel vinculado só pode ser alterado em Rascunho');
      return;
    }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para vincular imóveis'); return; }

    const imovelNucleoId = parseInt(req.body.imovel_nucleo_id);
    if (isNaN(imovelNucleoId)) {
      erro(res, 400, 'IMOVEL_INVALIDO', 'imovel_nucleo_id deve ser um número inteiro');
      return;
    }

    // Consistência tipo_imovel × tipo_empreendimento.
    const tipoEsperado = estudo.tipo_empreendimento === 'loteamento' ? 'gleba' : 'lote';
    const tipoImovel = req.body.tipo_imovel ?? tipoEsperado;
    if (tipoImovel !== tipoEsperado) {
      erro(res, 422, 'TIPO_IMOVEL_INCOMPATIVEL',
        `${estudo.tipo_empreendimento} exige imóvel do tipo "${tipoEsperado}"`);
      return;
    }

    // Loteamento: no máximo 1 gleba.
    const existentes = await req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
    if (estudo.tipo_empreendimento === 'loteamento' && existentes.total >= 1) {
      erro(res, 422, 'GLEBA_UNICA', 'Loteamento admite exatamente 1 gleba; remova a atual antes de vincular outra');
      return;
    }
    if (existentes.dados.some((im) => Number(im.imovel_nucleo_id) === imovelNucleoId)) {
      erro(res, 409, 'IMOVEL_DUPLICADO', 'Este imóvel já está vinculado ao estudo');
      return;
    }

    const criado = await req.dados!.criar('estudo_imoveis', {
      estudo_id: estudoId,
      imovel_nucleo_id: imovelNucleoId,
      tipo_imovel: tipoImovel,
    });
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/imoveis:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// DELETE /estudos/:id/imoveis/:vinculoId — desvincular (editor+, apenas Rascunho)
rotasImoveisEstudo.delete('/estudos/:id/imoveis/:vinculoId', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const vinculoId = parseInt(req.params.vinculoId);
    if (isNaN(estudoId) || isNaN(vinculoId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    if (estudo.status !== 'rascunho') {
      erro(res, 422, 'IMOVEL_TRAVADO', 'O imóvel vinculado só pode ser alterado em Rascunho');
      return;
    }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para desvincular imóveis'); return; }

    const vinculo = await req.dados!.buscar('estudo_imoveis', vinculoId);
    if (!vinculo || Number(vinculo.estudo_id) !== estudoId) {
      erro(res, 404, 'VINCULO_NAO_ENCONTRADO', 'Vínculo não encontrado neste estudo');
      return;
    }
    await req.dados!.deletar('estudo_imoveis', vinculoId);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /estudos/:id/imoveis/:vinculoId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor } from '../permissoes-estudo.js';
import { publicarEvento, payloadApeloConcluido } from '../eventos-viabilidade.js';
import { FATORES, SCHEMA_RESPOSTA, instrucoesSistema, calcularScores } from '../apelo-comercial.js';

export const rotasApelo: ReturnType<typeof Router> = Router();

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

/** Garante uma linha de apelo_comercial para o estudo (cria vazia se não existir). */
async function garantirApelo(req: Request, estudoId: number): Promise<any> {
  const existente = await req.dados!.listar('apelo_comercial', { filtros: { estudo_id: estudoId }, por_pagina: 1 });
  if (existente.dados.length > 0) return existente.dados[0];
  return req.dados!.criar('apelo_comercial', { estudo_id: estudoId });
}

// GET /estudos/:id/apelo-comercial — resultado + documentos
rotasApelo.get('/estudos/:id/apelo-comercial', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirMembro(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso'); return; }

    const apeloRes = await req.dados!.listar('apelo_comercial', { filtros: { estudo_id: estudoId }, por_pagina: 1 });
    const apelo = apeloRes.dados[0] || null;
    let documentos: any[] = [];
    if (apelo) {
      const d = await req.dados!.listar('apelo_comercial_documentos', { filtros: { apelo_id: apelo.id }, por_pagina: 100 });
      documentos = d.dados;
    }
    res.json({ apelo, documentos, fatores: FATORES });
  } catch (e: any) {
    console.error('Erro em GET apelo-comercial:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/apelo-comercial/documentos — associar upload + metadados
rotasApelo.post('/estudos/:id/apelo-comercial/documentos', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem anexar documentos'); return; }

    const { upload_id, tipo_dado, texto_adicional, nome_arquivo } = req.body;
    if (!upload_id && !texto_adicional) {
      erro(res, 400, 'NADA_A_ANEXAR', 'Informe um arquivo (upload_id) ou texto_adicional');
      return;
    }
    const apelo = await garantirApelo(req, estudoId);
    const doc = await req.dados!.criar('apelo_comercial_documentos', {
      apelo_id: apelo.id,
      documento: upload_id || null,
      nome_arquivo: (upload_id && nome_arquivo) ? String(nome_arquivo).slice(0, 255) : null,
      tipo_dado: tipo_dado || null,
      texto_adicional: texto_adicional || null,
    });
    res.status(201).json(doc);
  } catch (e: any) {
    console.error('Erro em POST apelo documentos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// DELETE /estudos/:id/apelo-comercial/documentos/:docId
rotasApelo.delete('/estudos/:id/apelo-comercial/documentos/:docId', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (isNaN(estudoId) || isNaN(docId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão'); return; }
    await req.dados!.deletar('apelo_comercial_documentos', docId);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE apelo documento:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/apelo-comercial — dispara a análise de IA
rotasApelo.post('/estudos/:id/apelo-comercial', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem disparar a análise'); return; }
    if (!req.ia) { erro(res, 422, 'IA_INDISPONIVEL', 'Framework de IA não disponível para esta app/instância'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const apelo = await garantirApelo(req, estudoId);
    const docsRes = await req.dados!.listar('apelo_comercial_documentos', { filtros: { apelo_id: apelo.id }, por_pagina: 100 });
    const documentos = docsRes.dados;
    if (documentos.length === 0) {
      erro(res, 422, 'SEM_DOCUMENTOS', 'Anexe ao menos um documento ou texto antes de analisar');
      return;
    }

    // Extrair conteúdo dos arquivos + reunir textos adicionais.
    const partes: string[] = [];
    for (const doc of documentos) {
      if (doc.texto_adicional) partes.push(`[${doc.tipo_dado || 'texto'}] ${doc.texto_adicional}`);
      if (doc.documento) {
        try {
          const ext = await req.ia.extrairConteudo({ arquivo_id: Number(doc.documento) },
            { instrucao: 'Extraia o texto e as tabelas relevantes deste documento imobiliário.' });
          const conteudo = typeof ext.conteudo === 'string' ? ext.conteudo : JSON.stringify(ext.conteudo);
          partes.push(`[${doc.tipo_dado || 'documento'}] ${conteudo}`);
        } catch (err) {
          console.warn('Falha ao extrair documento', doc.id, err);
        }
      }
    }

    const contexto = [
      `Tipo de empreendimento: ${estudo.tipo_empreendimento}.`,
      `Estudo: ${estudo.nome_exibicao || estudo.nome}.`,
      'Fontes fornecidas:',
      ...partes,
    ].join('\n\n');

    const resposta = await req.ia.consultar({
      contexto,
      schema: SCHEMA_RESPOSTA,
      instrucoes_sistema: instrucoesSistema(estudo.tipo_empreendimento),
    });
    const dados = resposta.dados as any;
    const { porFator, geral } = calcularScores(dados.fatores || []);

    const atualizado = await req.dados!.atualizar('apelo_comercial', apelo.id, {
      resultado: dados,
      ...porFator,
      score_geral: geral,
    });

    await publicarEvento(req, 'apelo_comercial_concluido', payloadApeloConcluido(estudo, geral ?? 0));
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em POST apelo-comercial (IA):', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

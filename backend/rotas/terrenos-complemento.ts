import { Router, type Request, type Response } from 'express';
import { coagirNumericosDeclarados } from './coercao-numerica.js';

export const rotasTerrenosComplemento: ReturnType<typeof Router> = Router();

// Complemento de terreno (aba Terrenos do Painel): dados de viabilidade de uma gleba ou de um
// lote que o módulo imobiliário não guarda — situação da negociação, preço pedido, parâmetros
// urbanísticos, restrições. É registro GERAL da app (não é de um estudo): um por imóvel.
// `imovel_nucleo_id` é referência lógica, sem FK, ao `id` que a listagem de glebas/lotes do
// módulo devolve (o mesmo que `estudo_imoveis.imovel_nucleo_id` guarda).
//
// Leitura: qualquer usuário com acesso à app. Escrita: nível de app escrita+ (editor, aprovador).

export const TIPOS_IMOVEL = ['gleba', 'lote'] as const;

export const OPCOES_COMPLEMENTO: Record<string, readonly string[]> = {
  situacao_negociacao: ['prospeccao', 'em_negociacao', 'opcao_compra', 'adquirido', 'descartado'],
  topografia: ['plana', 'leve', 'acentuada'],
  infraestrutura: ['completa', 'parcial', 'inexistente'],
};

// Limites de `texto` do schema.json; `texto_longo` não tem limite declarado.
const LIMITES_TEXTO: Record<string, number> = {
  proprietario: 150, contato: 150, zoneamento: 100,
};
const CAMPOS_TEXTO_LONGO = ['restricoes', 'observacoes'];
const CAMPOS_NUMERICOS = [
  'preco_pedido', 'coeficiente_aproveitamento', 'taxa_ocupacao_pct', 'gabarito_pavimentos',
];

/** Campos que o cliente pode gravar — o resto do corpo é ignorado. */
export const CAMPOS_EDITAVEIS = [
  ...Object.keys(OPCOES_COMPLEMENTO), ...Object.keys(LIMITES_TEXTO), ...CAMPOS_TEXTO_LONGO, ...CAMPOS_NUMERICOS,
];

export interface FalhaComplemento { http: number; codigo: string; mensagem: string; }

/**
 * Valida e normaliza o corpo de um PUT. Texto vazio vira `null` (campo limpo); número passa pelo
 * parser único da app (`coercao-numerica.ts`); percentual e pavimentos negativos são recusados.
 * Chave ausente do corpo não entra no resultado — o PUT só toca o que veio.
 */
export function validarComplemento(corpo: any): { dados: Record<string, any> } | { falha: FalhaComplemento } {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return { falha: { http: 400, codigo: 'CORPO_INVALIDO', mensagem: 'Corpo da requisição deve ser um objeto' } };
  }
  const dados: Record<string, any> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (corpo[campo] === undefined) continue;
    let v = corpo[campo];
    if (typeof v === 'string') { v = v.trim(); if (v === '') v = null; }
    if (v !== null && campo in OPCOES_COMPLEMENTO) {
      if (typeof v !== 'string' || !OPCOES_COMPLEMENTO[campo].includes(v)) {
        return { falha: { http: 400, codigo: 'OPCAO_INVALIDA', mensagem: `Valor inválido para "${campo}"` } };
      }
    } else if (v !== null && (campo in LIMITES_TEXTO || CAMPOS_TEXTO_LONGO.includes(campo))) {
      if (typeof v !== 'string') {
        return { falha: { http: 400, codigo: 'CAMPO_INVALIDO', mensagem: `Campo "${campo}" deve ser texto` } };
      }
      if (campo in LIMITES_TEXTO && v.length > LIMITES_TEXTO[campo]) {
        return { falha: { http: 400, codigo: 'CAMPO_INVALIDO', mensagem: `Campo "${campo}" aceita até ${LIMITES_TEXTO[campo]} caracteres` } };
      }
    }
    dados[campo] = v;
  }
  const coagido = coagirNumericosDeclarados('terrenos_complemento', dados);
  if ('falha' in coagido) {
    return { falha: { http: 400, codigo: 'CAMPO_INVALIDO', mensagem: coagido.falha.mensagem } };
  }
  for (const campo of CAMPOS_NUMERICOS) {
    const n = coagido.dados[campo];
    if (typeof n === 'number' && n < 0) {
      return { falha: { http: 400, codigo: 'CAMPO_INVALIDO', mensagem: `Campo "${campo}" não pode ser negativo` } };
    }
  }
  if (typeof coagido.dados.taxa_ocupacao_pct === 'number' && coagido.dados.taxa_ocupacao_pct > 100) {
    return { falha: { http: 400, codigo: 'CAMPO_INVALIDO', mensagem: 'Campo "taxa_ocupacao_pct" não pode passar de 100' } };
  }
  return { dados: coagido.dados };
}

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

function podeEscrever(req: Request): boolean {
  const nivel = req.contexto?.nivelApp;
  return nivel === 'escrita' || nivel === 'admin';
}

// GET /terrenos-complemento — todos os registros (a aba Terrenos cruza com a lista do Núcleo).
rotasTerrenosComplemento.get('/terrenos-complemento', async (req: Request, res: Response) => {
  try {
    const POR = 200;
    const dados: any[] = [];
    for (let pagina = 1; pagina <= 500; pagina++) {
      const r = await req.dados!.listar('terrenos_complemento', { por_pagina: POR, pagina });
      dados.push(...r.dados);
      if (r.dados.length < POR) break;
    }
    res.json({ dados, total: dados.length });
  } catch (e: any) {
    console.error('Erro em GET /terrenos-complemento:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PUT /terrenos-complemento/:tipo/:imovelId — grava (cria ou atualiza) o complemento do imóvel.
rotasTerrenosComplemento.put('/terrenos-complemento/:tipo/:imovelId', async (req: Request, res: Response) => {
  try {
    if (!podeEscrever(req)) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar terrenos'); return; }
    const tipo = req.params.tipo as string;
    if (!(TIPOS_IMOVEL as readonly string[]).includes(tipo)) {
      erro(res, 400, 'TIPO_INVALIDO', 'tipo deve ser "gleba" ou "lote"'); return;
    }
    const imovelId = Number(req.params.imovelId);
    if (!Number.isInteger(imovelId) || imovelId <= 0) {
      erro(res, 400, 'ID_INVALIDO', 'imovelId deve ser um inteiro positivo'); return;
    }
    const v = validarComplemento(req.body);
    if ('falha' in v) { erro(res, v.falha.http, v.falha.codigo, v.falha.mensagem); return; }

    const existente = await req.dados!.listar('terrenos_complemento', {
      filtros: { imovel_nucleo_id: imovelId }, por_pagina: 1,
    });
    if (existente.dados.length > 0) {
      const atual = existente.dados[0];
      if (atual.tipo_imovel !== tipo) {
        erro(res, 409, 'TIPO_IMOVEL_DIVERGENTE', `O imóvel já está registrado como "${atual.tipo_imovel}"`); return;
      }
      if (Object.keys(v.dados).length === 0) { res.json(atual); return; }
      const atualizado = await req.dados!.atualizar('terrenos_complemento', atual.id, v.dados);
      res.json(atualizado);
      return;
    }
    const criado = await req.dados!.criar('terrenos_complemento', {
      imovel_nucleo_id: imovelId, tipo_imovel: tipo, ...v.dados,
    });
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em PUT /terrenos-complemento/:tipo/:imovelId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

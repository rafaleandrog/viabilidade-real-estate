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

// DECIMAL(12,2) → 9.999.999.999,99; DECIMAL(5,2) → 999,99; inteiro de 32 bits → 2.147.483.647.
const TETOS_NUMERICOS: Record<string, number> = {
  preco_pedido: 9999999999.99, coeficiente_aproveitamento: 999.99, gabarito_pavimentos: 2147483647,
};

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
  // Teto de cada coluna `decimal`/`inteiro` do schema: passar dele estoura no banco e viraria 500.
  for (const [campo, teto] of Object.entries(TETOS_NUMERICOS)) {
    const n = coagido.dados[campo];
    if (typeof n === 'number' && n > teto) {
      return { falha: { http: 400, codigo: 'CAMPO_INVALIDO', mensagem: `Campo "${campo}" não pode passar de ${teto}` } };
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

/** Subconjunto de `req.dados` que estas rotas usam — permite exercitar a lógica sem servidor nem banco. */
export interface DadosComplemento {
  listar(tabela: string, opcoes: Record<string, any>): Promise<{ dados: any[]; total?: number }>;
  criar(tabela: string, dados: Record<string, any>): Promise<any>;
  atualizar(tabela: string, id: number, dados: Record<string, any>): Promise<any>;
}

const POR_PAGINA = 200;
const TETO_PAGINAS = 500;

/**
 * Todos os registros. NUNCA devolve uma lista truncada: a tela trata a ausência de registro como
 * "terreno sem informações" e um PUT total em cima de um registro que ficou de fora o zeraria.
 * Pagina até a página vir incompleta ou até somar `total`; bateu o teto sem terminar, LANÇA.
 */
export async function listarTodosComplementos(dados: DadosComplemento): Promise<any[]> {
  const todos: any[] = [];
  for (let pagina = 1; pagina <= TETO_PAGINAS; pagina++) {
    const r = await dados.listar('terrenos_complemento', { por_pagina: POR_PAGINA, pagina });
    todos.push(...r.dados);
    if (r.dados.length < POR_PAGINA) return todos;
    if (typeof r.total === 'number' && todos.length >= r.total) return todos;
  }
  throw new Error(`terrenos_complemento passou de ${TETO_PAGINAS * POR_PAGINA} registros: lista incompleta recusada`);
}

export type ResultadoGravacao =
  | { http: 200 | 201; registro: any }
  | { http: 409; codigo: 'TIPO_IMOVEL_DIVERGENTE'; mensagem: string };

/**
 * Upsert por `imovel_nucleo_id`. Dois primeiros PUTs simultâneos do mesmo imóvel passam ambos pela
 * busca vazia e o segundo `criar` bate no único do schema: em vez de 500, recarrega o registro que
 * venceu e atualiza por cima dele. Se depois do erro o registro continua ausente, o erro era outro
 * e é relançado.
 */
export async function gravarComplemento(
  dados: DadosComplemento, tipo: string, imovelId: number, campos: Record<string, any>,
): Promise<ResultadoGravacao> {
  const buscar = async () => (await dados.listar('terrenos_complemento', {
    filtros: { imovel_nucleo_id: imovelId }, por_pagina: 1,
  })).dados[0];
  const sobre = async (atual: any): Promise<ResultadoGravacao> => {
    if (atual.tipo_imovel !== tipo) {
      return { http: 409, codigo: 'TIPO_IMOVEL_DIVERGENTE', mensagem: `O imóvel já está registrado como "${atual.tipo_imovel}"` };
    }
    if (Object.keys(campos).length === 0) return { http: 200, registro: atual };
    return { http: 200, registro: await dados.atualizar('terrenos_complemento', atual.id, campos) };
  };

  const existente = await buscar();
  if (existente) return sobre(existente);
  try {
    return { http: 201, registro: await dados.criar('terrenos_complemento', { imovel_nucleo_id: imovelId, tipo_imovel: tipo, ...campos }) };
  } catch (e) {
    const vencedor = await buscar();
    if (!vencedor) throw e;
    return sobre(vencedor);
  }
}

// GET /terrenos-complemento — todos os registros (a aba Terrenos cruza com a lista do Núcleo).
rotasTerrenosComplemento.get('/terrenos-complemento', async (req: Request, res: Response) => {
  try {
    const dados = await listarTodosComplementos(req.dados! as unknown as DadosComplemento);
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

    const r = await gravarComplemento(req.dados! as unknown as DadosComplemento, tipo, imovelId, v.dados);
    if (r.http === 409) { erro(res, 409, r.codigo, r.mensagem); return; }
    res.status(r.http).json(r.registro);
  } catch (e: any) {
    console.error('Erro em PUT /terrenos-complemento/:tipo/:imovelId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

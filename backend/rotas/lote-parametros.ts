import { Router, type Request, type Response } from 'express';
import { coagirNumericosDeclarados, numeroEstrito } from './coercao-numerica.js';

export const rotasLoteParametros: ReturnType<typeof Router> = Router();

// Parâmetros urbanísticos de um LOTE (coeficiente mínimo e máximo, gabarito máximo), guardados no
// schema do app e ligados ao lote do módulo imobiliário SEM escrever nada no módulo.
//
// O vínculo é o `imovel_nucleo_id` — o `id` do lote no módulo (o mesmo de `GET /imoveis/:id`) —,
// ÚNICO na tabela (`unicos` do schema). Junto vai um CARIMBO do lote no momento do cadastro
// (parcelamento, rua, número, quadra, conjunto, área): a tela o compara com o lote de hoje e acusa
// quando o vínculo deixou de ser confiável (lote removido, outra identificação, outro parcelamento).
//
// Leitura: qualquer usuário com acesso à app. Escrita: nível de app escrita+ (editor, aprovador).

const TEXTOS: Record<string, number> = {
  rua: 150, numero_lote: 30, quadra: 60, conjunto: 60, uos: 40, uso: 40, origem: 200,
};
const NUMEROS = ['parcelamento_id', 'area_m2', 'coef_minimo', 'coef_maximo', 'gabarito_maximo'] as const;
// Tetos das colunas do schema (DECIMAL(6,2), DECIMAL(8,2), DECIMAL(12,2), inteiro de 32 bits).
const TETOS: Record<string, number> = {
  coef_minimo: 9999.99, coef_maximo: 9999.99, gabarito_maximo: 999999.99, area_m2: 9999999999.99,
  parcelamento_id: 2147483647,
};
/** Campos de CARIMBO: identificam o lote no módulo no momento do cadastro. */
export const CAMPOS_CARIMBO = ['parcelamento_id', 'rua', 'numero_lote', 'quadra', 'conjunto', 'area_m2'] as const;
/**
 * Sem estes dois o vínculo não pode ser conferido depois: são obrigatórios ao CRIAR o registro.
 * `parcelamento_id` NÃO é: lote sem parcelamento existe (a aba Terrenos o lista) e seu carimbo grava
 * `null`, que a conferência trata como um valor — lote que ganha ou perde parcelamento depois muda de identidade.
 */
export const CARIMBO_OBRIGATORIO = ['numero_lote', 'area_m2'] as const;
/** Campos que o cliente pode gravar — o resto do corpo é ignorado. */
export const CAMPOS_EDITAVEIS = [
  ...CAMPOS_CARIMBO, 'coef_minimo', 'coef_maximo', 'gabarito_maximo', 'uos', 'uso', 'origem',
];

export interface Falha { http: number; codigo: string; mensagem: string; }
const falha = (codigo: string, mensagem: string): { falha: Falha } => ({ falha: { http: 400, codigo, mensagem } });

/**
 * Valida e normaliza um corpo de gravação. Texto vazio vira `null` (campo limpo); número passa pelo
 * parser único da app (`coercao-numerica.ts`). Chave ausente não entra no resultado: gravar só toca
 * o que veio. Regra de negócio: `coef_minimo` não passa de `coef_maximo` (valendo só com os dois).
 */
export function validarParametros(corpo: any): { dados: Record<string, any> } | { falha: Falha } {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return falha('CORPO_INVALIDO', 'Corpo da requisição deve ser um objeto');
  }
  const dados: Record<string, any> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (corpo[campo] === undefined) continue;
    let v = corpo[campo];
    if (typeof v === 'string') { v = v.trim(); if (v === '') v = null; }
    if (v !== null && campo in TEXTOS) {
      if (typeof v !== 'string') return falha('CAMPO_INVALIDO', `Campo "${campo}" deve ser texto`);
      if (v.length > TEXTOS[campo]) return falha('CAMPO_INVALIDO', `Campo "${campo}" aceita até ${TEXTOS[campo]} caracteres`);
    }
    dados[campo] = v;
  }
  const coagido = coagirNumericosDeclarados('lote_parametros', dados);
  if ('falha' in coagido) return falha('CAMPO_INVALIDO', coagido.falha.mensagem);
  for (const campo of NUMEROS) {
    const n = coagido.dados[campo];
    if (typeof n !== 'number') continue;
    if (n < 0) return falha('CAMPO_INVALIDO', `Campo "${campo}" não pode ser negativo`);
    if (n > TETOS[campo]) return falha('CAMPO_INVALIDO', `Campo "${campo}" não pode passar de ${TETOS[campo]}`);
  }
  const { coef_minimo: min, coef_maximo: max } = coagido.dados;
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    return falha('CAMPO_INVALIDO', 'O coeficiente mínimo não pode ser maior que o máximo');
  }
  return { dados: coagido.dados };
}

/** `decimal` volta do banco como string (`"3.50"`). */
function paraNumeroLinha(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Subconjunto de `req.dados` usado aqui — permite exercitar a lógica sem servidor nem banco. */
export interface DadosParametros {
  listar(tabela: string, opcoes: Record<string, any>): Promise<{ dados: any[]; total?: number }>;
  criar(tabela: string, dados: Record<string, any>): Promise<any>;
  atualizar(tabela: string, id: number, dados: Record<string, any>): Promise<any>;
}

const POR_PAGINA = 200;
const TETO_PAGINAS = 500;

/** Todos os registros. NUNCA devolve lista truncada: bateu o teto sem terminar, LANÇA. */
export async function listarTodosParametros(dados: DadosParametros): Promise<any[]> {
  const todos: any[] = [];
  for (let pagina = 1; pagina <= TETO_PAGINAS; pagina++) {
    // `ordenar: 'id'` torna a paginação por offset estável (o default do shell é `criado_em DESC`, que não é total).
    const r = await dados.listar('lote_parametros', { por_pagina: POR_PAGINA, pagina, ordenar: 'id', ordem: 'asc' });
    todos.push(...r.dados);
    if (r.dados.length < POR_PAGINA) return todos;
    if (typeof r.total === 'number' && todos.length >= r.total) return todos;
  }
  throw new Error(`lote_parametros passou de ${TETO_PAGINAS * POR_PAGINA} registros: lista incompleta recusada`);
}

export type ResultadoGravacao =
  | { http: 200 | 201; registro: any }
  | { http: 400; codigo: 'CARIMBO_OBRIGATORIO' | 'INVARIANTE'; mensagem: string };

/**
 * Upsert por `imovel_nucleo_id` (único no schema). Ao CRIAR exige o carimbo mínimo; ao atualizar, o
 * carimbo só muda se vier no corpo. Dois primeiros PUTs simultâneos passam ambos pela busca vazia e o
 * segundo `criar` bate no único: em vez de 500, relê o vencedor e atualiza por cima dele.
 */
export async function gravarParametros(
  dados: DadosParametros, imovelId: number, campos: Record<string, any>,
  opcoes: { preservarCarimbo?: boolean } = {},
): Promise<ResultadoGravacao> {
  const buscar = async () => (await dados.listar('lote_parametros', {
    filtros: { imovel_nucleo_id: imovelId }, por_pagina: 1,
  })).dados[0];
  const sobre = async (atual: any, camposOriginais: Record<string, any>): Promise<ResultadoGravacao> => {
    // Importação: o carimbo de um registro que JÁ existe não é regravado, e quem decide que ele existe é o
    // servidor (o Painel pode ter carregado antes de outro editor criar ou reconfirmar o registro).
    const campos = opcoes.preservarCarimbo
      ? Object.fromEntries(Object.entries(camposOriginais).filter(([c]) => !(CAMPOS_CARIMBO as readonly string[]).includes(c)))
      : camposOriginais;
    if (Object.keys(campos).length === 0) return { http: 200, registro: atual };
    // Os invariantes valem para a LINHA que fica gravada, não só para o corpo: um PUT com só um dos dois
    // coeficientes, ou que zera um campo do carimbo, passaria na validação do corpo e deixaria a linha inconsistente.
    const mesclada = { ...atual, ...campos };
    const a = paraNumeroLinha(mesclada.coef_minimo); const b = paraNumeroLinha(mesclada.coef_maximo);
    if (a != null && b != null && a > b) {
      return { http: 400, codigo: 'INVARIANTE', mensagem: 'O coeficiente mínimo não pode ser maior que o máximo (conferido contra o valor já gravado)' };
    }
    const zerados = CARIMBO_OBRIGATORIO.filter((c) => c in campos && campos[c] == null);
    if (zerados.length > 0) {
      return { http: 400, codigo: 'INVARIANTE', mensagem: `O carimbo do lote não pode ser apagado: ${zerados.join(', ')}` };
    }
    return { http: 200, registro: await dados.atualizar('lote_parametros', atual.id, campos) };
  };

  const existente = await buscar();
  if (existente) return sobre(existente, campos);
  const faltando = CARIMBO_OBRIGATORIO.filter((c) => campos[c] == null);
  if (faltando.length > 0) {
    return {
      http: 400, codigo: 'CARIMBO_OBRIGATORIO',
      mensagem: `Para cadastrar o lote informe também: ${faltando.join(', ')} (o carimbo que permite conferir o vínculo)`,
    };
  }
  try {
    return { http: 201, registro: await dados.criar('lote_parametros', { imovel_nucleo_id: imovelId, ...campos }) };
  } catch (e) {
    const vencedor = await buscar();
    if (!vencedor) throw e;
    return sobre(vencedor, campos);
  }
}

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

function podeEscrever(req: Request): boolean {
  const nivel = req.contexto?.nivelApp;
  return nivel === 'escrita' || nivel === 'admin';
}

// A chave do vínculo passa pelo parser ÚNICO da app (`numeroEstrito`): `Number()` cru aceitaria "0x10"
// (lote 16), "1e3" (lote 1000) e `true` (lote 1) como id.
function idImovel(v: unknown): number | null {
  const n = numeroEstrito(v);
  return n !== null && Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

// GET /lote-parametros — todos os registros (a aba Terrenos cruza com a lista de lotes do módulo).
rotasLoteParametros.get('/lote-parametros', async (req: Request, res: Response) => {
  try {
    const dados = await listarTodosParametros(req.dados! as unknown as DadosParametros);
    res.json({ dados, total: dados.length });
  } catch (e: any) {
    console.error('Erro em GET /lote-parametros:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PUT /lote-parametros/:imovelId — grava (cria ou atualiza) os parâmetros do lote.
rotasLoteParametros.put('/lote-parametros/:imovelId', async (req: Request, res: Response) => {
  try {
    if (!podeEscrever(req)) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar parâmetros de lote'); return; }
    const imovelId = idImovel(req.params.imovelId);
    if (imovelId === null) { erro(res, 400, 'ID_INVALIDO', 'imovelId deve ser um inteiro positivo'); return; }
    const v = validarParametros(req.body);
    if ('falha' in v) { erro(res, v.falha.http, v.falha.codigo, v.falha.mensagem); return; }
    const r = await gravarParametros(req.dados! as unknown as DadosParametros, imovelId, v.dados);
    if (r.http === 400) { erro(res, 400, r.codigo, r.mensagem); return; }
    res.status(r.http).json(r.registro);
  } catch (e: any) {
    console.error('Erro em PUT /lote-parametros/:imovelId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

export const MAX_ITENS_IMPORTACAO = 300;

/**
 * Importação em lote. Cada item é independente (um erro não derruba os outros): a resposta traz um
 * resultado por `imovel_nucleo_id`. Um mesmo id repetido no lote é recusado nas repetições, para a
 * última linha não vencer a primeira em silêncio.
 */
export async function importarParametros(
  dados: DadosParametros, itens: any[],
): Promise<{ resultados: Array<{ imovel_nucleo_id: any; ok: boolean; criado?: boolean; erro?: string }> }> {
  const vistos = new Set<number>();
  const resultados: Array<{ imovel_nucleo_id: any; ok: boolean; criado?: boolean; erro?: string }> = [];
  for (const item of itens) {
    const id = idImovel(item?.imovel_nucleo_id);
    if (id === null) { resultados.push({ imovel_nucleo_id: item?.imovel_nucleo_id, ok: false, erro: 'imovel_nucleo_id inválido' }); continue; }
    if (vistos.has(id)) { resultados.push({ imovel_nucleo_id: id, ok: false, erro: 'lote repetido na importação' }); continue; }
    vistos.add(id);
    const v = validarParametros(item);
    if ('falha' in v) { resultados.push({ imovel_nucleo_id: id, ok: false, erro: v.falha.mensagem }); continue; }
    try {
      const r = await gravarParametros(dados, id, v.dados, { preservarCarimbo: true });
      if (r.http === 400) resultados.push({ imovel_nucleo_id: id, ok: false, erro: r.mensagem });
      else resultados.push({ imovel_nucleo_id: id, ok: true, criado: r.http === 201 });
    } catch (e: any) {
      resultados.push({ imovel_nucleo_id: id, ok: false, erro: e?.message || 'erro ao gravar' });
    }
  }
  return { resultados };
}

// POST /lote-parametros/importar — { itens: [{ imovel_nucleo_id, ...campos }] }
rotasLoteParametros.post('/lote-parametros/importar', async (req: Request, res: Response) => {
  try {
    if (!podeEscrever(req)) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para importar parâmetros de lote'); return; }
    const itens = req.body?.itens;
    if (!Array.isArray(itens) || itens.length === 0) { erro(res, 400, 'ITENS_INVALIDOS', 'itens deve ser uma lista não vazia'); return; }
    if (itens.length > MAX_ITENS_IMPORTACAO) {
      erro(res, 400, 'ITENS_DEMAIS', `Máximo de ${MAX_ITENS_IMPORTACAO} lotes por importação`); return;
    }
    res.json(await importarParametros(req.dados! as unknown as DadosParametros, itens));
  } catch (e: any) {
    console.error('Erro em POST /lote-parametros/importar:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

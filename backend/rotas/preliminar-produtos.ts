import { Router, type Request, type Response } from 'express';
import { acessoLeituraEstudo, acessoEscritaEstudo, acessoNegado } from '../permissoes-estudo.js';
import { idDeRota, numeroEstrito, coagirNumericosDeclarados } from './coercao-numerica.js';
import esquema from '../../schema.json';

// Catálogo de Produtos do Preliminar (#315 — item 3 da Rodada 7): tabela
// dinâmica (add/remove) com Nome, Área média, Preço de venda e Unidades;
// VGV é calculado (área × preço × unidades), nunca persistido — igual ao
// padrão do catálogo de Tipologias do Avançado (`backend/rotas/avancado.ts`),
// mas sem o gate de nível (Preliminar não tem `estudoAvancado`/`exigirEscrita`
// próprios — usa os helpers genéricos de `permissoes-estudo.ts`, como
// `empreendimento.ts`).

export const rotasPreliminarProdutos: ReturnType<typeof Router> = Router();

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// #565: `tipo` (residencial/nao_residencial) entra ENTRE `nome` e `area_media_m2`
// — mesma posição da coluna no `schema.json` e no grid da tela.
// #781/#784: `pct_alv` (participação na base do estudo: ALV no Loteamento, áreas
// privativas fechadas na Incorporação) entra logo depois de `tipo`.
export const CAMPOS = ['nome', 'tipo', 'pct_alv', 'area_media_m2', 'preco_venda_m2', 'unidades', 'ordem'];

// Permuta física por produto: unidades do produto entregues em permuta. Lista
// À PARTE de `CAMPOS` (que fixa a forma original do catálogo) e somada a ela em
// `CAMPOS_GRAVAVEIS` — é esta a lista que POST, PATCH e a duplicação do estudo
// leem, então a coluna não pode ficar fora de nenhum dos três.
export const CAMPOS_PERMUTA = ['unidades_permutadas'];
export const CAMPOS_GRAVAVEIS = [...CAMPOS, ...CAMPOS_PERMUTA];

// #812 — os valores válidos de `tipo` vêm do `schema.json`, não de lista escrita
// à mão: o shell recusa o que não está em `opcoes`, e sem a checagem aqui a
// recusa do CLIENTE voltava como `500 ERRO_INTERNO` pelo `catch` genérico.
export const TIPOS_PRODUTO: string[] = (esquema as any).tabelas.preliminar_produtos.colunas.tipo.opcoes;

/** Mensagem do erro de `tipo`, ou `null` quando ausente (default do schema / PATCH inalterado) ou válido. */
export function erroTipoProduto(body: Record<string, any>): string | null {
  if (body.tipo === undefined) return null;
  if (typeof body.tipo === 'string' && TIPOS_PRODUTO.includes(body.tipo)) return null;
  return `tipo deve ser um de: ${TIPOS_PRODUTO.join(', ')}`;
}

/**
 * `unidades_permutadas`: inteiro entre 0 e as `unidades` do produto. Parser
 * único (`numeroEstrito`), fail-closed — texto, `''`, `'1e3'`, negativo, fração
 * e `null` são recusados, não coagidos. O teto vale sobre o PAR efetivo: o que
 * veio no corpo, completado pelo que já está gravado (`atual`) — baixar
 * `unidades` abaixo do que já está permutado também é recusado, e a tela manda
 * os dois juntos. Devolve a mensagem do erro, ou `null` quando está válido.
 */
export function erroUnidadesPermutadas(
  body: Record<string, any>,
  atual: { unidades?: unknown; unidades_permutadas?: unknown } = {},
): string | null {
  const mudouPerm = body.unidades_permutadas !== undefined;
  const mudouUn = body.unidades !== undefined;
  if (!mudouPerm && !mudouUn) return null;
  let perm = Number(atual.unidades_permutadas) || 0;
  if (mudouPerm) {
    const v = numeroEstrito(body.unidades_permutadas);
    if (v === null || !Number.isInteger(v) || v < 0) return 'unidades_permutadas deve ser um número inteiro maior ou igual a 0';
    perm = v;
  }
  let un = Number(atual.unidades) || 0;
  if (mudouUn) {
    const u = numeroEstrito(body.unidades);
    // `unidades` inválida é recusada pela coerção numérica, com a mensagem dela.
    if (u === null || u < 0) return null;
    un = u;
  }
  if (perm > un) return `unidades_permutadas (${perm}) não pode passar das unidades do produto (${un})`;
  return null;
}

/**
 * Coage os campos numéricos declarados (`area_media_m2`, `preco_venda_m2`,
 * `unidades`, `ordem`, `pct_alv`, `unidades_permutadas`) pelo parser único; lixo vira 400
 * `CAMPO_INVALIDO` em vez de 500. Muta `dados` e devolve `false` se respondeu.
 */
function coagirNumericosOuResponder(res: Response, dados: Record<string, any>): boolean {
  const r = coagirNumericosDeclarados('preliminar_produtos', dados);
  if ('falha' in r) { erro(res, 400, 'CAMPO_INVALIDO', r.falha.mensagem); return false; }
  Object.assign(dados, r.dados);
  return true;
}

/**
 * #781 — `pct_alv` é percentual: número estrito entre 0 e 100. Parser único do
 * repositório (`numeroEstrito`), fail-closed: `''`, `'1e3'`, `'0x10'`, negativo
 * e acima de 100 são recusados, não coagidos. **`null` também é recusado**:
 * `pct_alv` ausente (NULL no banco) significa "produto legado, ainda com a área
 * antiga", e um PATCH que gravasse `null` faria a linha voltar a esse estado —
 * limpar o campo na tela grava 0. Devolve a mensagem do erro, ou `null` quando o
 * corpo está válido. A SOMA dos percentuais NÃO é conferida aqui: a edição é
 * linha a linha e passa por estados intermediários; o portão da soma é o
 * salvamento da tela e a submissão (`POST /estudos/:id/status`).
 */
export function erroPctAlv(body: Record<string, any>): string | null {
  if (body.pct_alv === undefined) return null;
  const v = numeroEstrito(body.pct_alv);
  if (v === null || v < 0 || v > 100) return 'pct_alv deve ser um número entre 0 e 100';
  return null;
}

/** O valor JÁ VALIDADO por `erroPctAlv`, como número — o shell recusa string em coluna decimal. */
function comPctAlvNumerico(dados: Record<string, any>): Record<string, any> {
  if (dados.pct_alv !== undefined) dados.pct_alv = numeroEstrito(dados.pct_alv);
  return dados;
}

async function produtoDoEstudo(req: Request, res: Response, estudoId: number): Promise<any | null> {
  const pid = idDeRota(req.params.pid);
  if (isNaN(pid)) { erro(res, 400, 'ID_INVALIDO', 'ID do produto inválido'); return null; }
  const p = await req.dados!.buscar('preliminar_produtos', pid);
  if (!p || Number(p.estudo_id) !== estudoId) {
    erro(res, 404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado neste estudo');
    return null;
  }
  return p;
}

rotasPreliminarProdutos.get('/estudos/:id/preliminar/produtos', async (req: Request, res: Response) => {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const acesso = await acessoLeituraEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }

    // #781: o catálogo INTEIRO — a tela confere a soma dos percentuais sobre esta
    // lista, e uma página fixa (antes 200) faria a regra dos 100% valer sobre uma
    // fatia enquanto a submissão (que varre tudo) valeria sobre o total.
    const dados = await req.dados!.varrerTudo('preliminar_produtos', {
      filtros: { estudo_id: estudoId }, ordenar: 'ordem', ordem: 'asc',
    });
    res.json({ dados, total: dados.length });
  } catch (e: any) {
    console.error('Erro em GET /preliminar/produtos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasPreliminarProdutos.post('/estudos/:id/preliminar/produtos', async (req: Request, res: Response) => {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const acesso = await acessoEscritaEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }

    const msgPct = erroPctAlv(req.body);
    if (msgPct) { erro(res, 400, 'PCT_ALV_INVALIDO', msgPct); return; }
    const msgTipo = erroTipoProduto(req.body);
    if (msgTipo) { erro(res, 400, 'TIPO_INVALIDO', msgTipo); return; }
    const msgPerm = erroUnidadesPermutadas(req.body);
    if (msgPerm) { erro(res, 400, 'UNIDADES_PERMUTADAS_INVALIDAS', msgPerm); return; }

    const existentes = await req.dados!.listar('preliminar_produtos', { filtros: { estudo_id: estudoId }, por_pagina: 500 });
    const dados: Record<string, any> = { estudo_id: estudoId, nome: '', ordem: existentes.total };
    for (const campo of CAMPOS_GRAVAVEIS) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (!coagirNumericosOuResponder(res, dados)) return;
    const criado = await req.dados!.criar('preliminar_produtos', comPctAlvNumerico(dados));
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em POST /preliminar/produtos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasPreliminarProdutos.patch('/estudos/:id/preliminar/produtos/:pid', async (req: Request, res: Response) => {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const acesso = await acessoEscritaEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }
    const p = await produtoDoEstudo(req, res, estudoId);
    if (!p) return;

    const msgPct = erroPctAlv(req.body);
    if (msgPct) { erro(res, 400, 'PCT_ALV_INVALIDO', msgPct); return; }
    const msgTipo = erroTipoProduto(req.body);
    if (msgTipo) { erro(res, 400, 'TIPO_INVALIDO', msgTipo); return; }
    const msgPerm = erroUnidadesPermutadas(req.body, p);
    if (msgPerm) { erro(res, 400, 'UNIDADES_PERMUTADAS_INVALIDAS', msgPerm); return; }

    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_GRAVAVEIS) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    if (!coagirNumericosOuResponder(res, dados)) return;
    const atualizado = await req.dados!.atualizar('preliminar_produtos', p.id, comPctAlvNumerico(dados));
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /preliminar/produtos/:pid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

async function removerProdutoPreliminar(req: Request, res: Response): Promise<void> {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const acesso = await acessoEscritaEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }
    const p = await produtoDoEstudo(req, res, estudoId);
    if (!p) return;

    await req.dados!.deletar('preliminar_produtos', p.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro ao remover (PATCH …/remover ou DELETE) /preliminar/produtos/:pid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
}
// #860: remover é PATCH …/remover, porque o shell só deixa `admin` usar DELETE
// (SDK, permissoes.md § Contrato uniforme método→nível) e o editor precisa remover.
// O DELETE fica como alias (admin e clientes antigos); as guardas são as mesmas.
rotasPreliminarProdutos.patch('/estudos/:id/preliminar/produtos/:pid/remover', removerProdutoPreliminar);
rotasPreliminarProdutos.delete('/estudos/:id/preliminar/produtos/:pid', removerProdutoPreliminar);

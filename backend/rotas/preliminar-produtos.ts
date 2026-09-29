import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor } from '../permissoes-estudo.js';
import { numeroEstrito } from './coercao-numerica.js';

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
// #781: `pct_alv` (participação na ALV, só Loteamento) entra logo depois de `tipo`.
export const CAMPOS = ['nome', 'tipo', 'pct_alv', 'area_media_m2', 'preco_venda_m2', 'unidades', 'ordem'];

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
  const pid = parseInt(req.params.pid);
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
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirMembro(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso'); return; }

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
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem adicionar produtos'); return; }

    const msgPct = erroPctAlv(req.body);
    if (msgPct) { erro(res, 400, 'PCT_ALV_INVALIDO', msgPct); return; }

    const existentes = await req.dados!.listar('preliminar_produtos', { filtros: { estudo_id: estudoId }, por_pagina: 500 });
    const dados: Record<string, any> = { estudo_id: estudoId, nome: '', ordem: existentes.total };
    for (const campo of CAMPOS) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    const criado = await req.dados!.criar('preliminar_produtos', comPctAlvNumerico(dados));
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em POST /preliminar/produtos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasPreliminarProdutos.patch('/estudos/:id/preliminar/produtos/:pid', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem editar produtos'); return; }
    const p = await produtoDoEstudo(req, res, estudoId);
    if (!p) return;

    const msgPct = erroPctAlv(req.body);
    if (msgPct) { erro(res, 400, 'PCT_ALV_INVALIDO', msgPct); return; }

    const dados: Record<string, any> = {};
    for (const campo of CAMPOS) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    const atualizado = await req.dados!.atualizar('preliminar_produtos', p.id, comPctAlvNumerico(dados));
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /preliminar/produtos/:pid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

rotasPreliminarProdutos.delete('/estudos/:id/preliminar/produtos/:pid', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    if (!(await exigirEditor(req, estudoId))) { erro(res, 403, 'SEM_PERMISSAO', 'Apenas editores podem remover produtos'); return; }
    const p = await produtoDoEstudo(req, res, estudoId);
    if (!p) return;

    await req.dados!.deletar('preliminar_produtos', p.id);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /preliminar/produtos/:pid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor, exigirAprovador } from '../permissoes-estudo.js';

// Rotas do Programa Financeiro / Capital Stack (epic #239, FIN-02/#271).
// CRUD de `avancado_capital_instrumentos` — as CAMADAS de capital (§2.4/§4 de
// docs/viabilidade/funding-capital-stack.md). Só opera sobre estudos com
// nivel_analise === 'avancado', mesmo padrão de todo o resto do Avançado.
//
// `config` (json) carrega os parâmetros específicos de cada `tipo` — o shape
// exato por tipo (financiamento por custo elegível, capital de giro, os 3
// modos de Preferred Equity, Sponsor Equity) é definido pelas issues FIN-04
// a FIN-06, que ainda não fecharam; por isso a validação aqui é só
// estrutural (precisa ser um objeto), não por campo.
//
// Uma camada nasce/permanece SEM efeito no motor até o usuário confirmá-la
// (status `rascunho`/`revisao_necessaria`) — §13.3. Estas rotas não calculam
// nada, só persistem; o motor (FIN-03+) lê pelo status quando existir.

export const rotasCapitalStack: ReturnType<typeof Router> = Router();

const TIPOS_INSTRUMENTO = ['financiamento_producao', 'capital_giro', 'preferred_equity', 'sponsor_equity'];
const STATUS_INSTRUMENTO = ['rascunho', 'ativo', 'encerrado', 'revisao_necessaria'];
const CAMPOS_INSTRUMENTO = ['tipo', 'nome', 'status', 'prioridade_funding', 'prioridade_pagamento', 'compromisso', 'config', 'ordem'];

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

/** Carrega o estudo e garante nível avançado (422 NIVEL_INVALIDO se preliminar). */
async function estudoAvancado(req: Request, res: Response): Promise<any | null> {
  const estudoId = parseInt(req.params.id);
  if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return null; }
  const estudo = await req.dados!.buscar('estudos', estudoId);
  if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return null; }
  if (estudo.nivel_analise !== 'avancado') {
    erro(res, 422, 'NIVEL_INVALIDO', 'Este estudo é Preliminar — o Capital Stack existe apenas no nível Avançado');
    return null;
  }
  return estudo;
}

async function exigirLeitura(req: Request, res: Response, estudo: any): Promise<boolean> {
  const perm = await exigirMembro(req, estudo.id);
  if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return false; }
  return true;
}

async function exigirEscrita(req: Request, res: Response, estudo: any): Promise<boolean> {
  const travado = estudo.status === 'aprovado' || estudo.status === 'reprovado' || estudo.status === 'arquivado';
  const perm = travado ? await exigirAprovador(req, estudo.id) : await exigirEditor(req, estudo.id);
  if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar este estudo'); return false; }
  return true;
}

/** Pura e testável (padrão `validarAbsorcao`/`validarFluxoPagamento` em avancado.ts): mensagem de erro ou `null`. */
export function validarCamposInstrumento(dados: Record<string, any>): string | null {
  if (dados.tipo !== undefined && !TIPOS_INSTRUMENTO.includes(dados.tipo)) {
    return `tipo deve ser um de: ${TIPOS_INSTRUMENTO.join(', ')}`;
  }
  if (dados.status !== undefined && !STATUS_INSTRUMENTO.includes(dados.status)) {
    return `status deve ser um de: ${STATUS_INSTRUMENTO.join(', ')}`;
  }
  if (dados.config !== undefined && dados.config !== null && typeof dados.config !== 'object') {
    return 'config deve ser um objeto';
  }
  return null;
}

// GET /estudos/:id/avancado/capital-instrumentos
rotasCapitalStack.get('/estudos/:id/avancado/capital-instrumentos', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    const r = await req.dados!.listar('avancado_capital_instrumentos', {
      filtros: { estudo_id: estudo.id }, ordenar: 'ordem', ordem: 'asc', por_pagina: 200,
    });
    res.json(r);
  } catch (e: any) {
    console.error('Erro em GET /avancado/capital-instrumentos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/avancado/capital-instrumentos
rotasCapitalStack.post('/estudos/:id/avancado/capital-instrumentos', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const dados: Record<string, any> = { estudo_id: estudo.id, status: 'rascunho', compromisso: 0, ordem: 0 };
    for (const campo of CAMPOS_INSTRUMENTO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (!dados.tipo) { erro(res, 400, 'TIPO_OBRIGATORIO', 'tipo é obrigatório'); return; }
    if (!dados.nome) { erro(res, 400, 'NOME_OBRIGATORIO', 'nome é obrigatório'); return; }
    const erroValidacao = validarCamposInstrumento(dados);
    if (erroValidacao) { erro(res, 400, 'CAMPO_INVALIDO', erroValidacao); return; }

    const criada = await req.dados!.criar('avancado_capital_instrumentos', dados);
    res.status(201).json(criada);
  } catch (e: any) {
    console.error('Erro em POST /avancado/capital-instrumentos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/avancado/capital-instrumentos/:cid
rotasCapitalStack.patch('/estudos/:id/avancado/capital-instrumentos/:cid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const cid = parseInt(req.params.cid);
    if (isNaN(cid)) { erro(res, 400, 'ID_INVALIDO', 'ID do instrumento inválido'); return; }
    const instrumento = await req.dados!.buscar('avancado_capital_instrumentos', cid);
    if (!instrumento || Number(instrumento.estudo_id) !== estudo.id) {
      erro(res, 404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado neste estudo');
      return;
    }

    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_INSTRUMENTO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }
    const erroValidacao = validarCamposInstrumento(dados);
    if (erroValidacao) { erro(res, 400, 'CAMPO_INVALIDO', erroValidacao); return; }

    const atualizado = await req.dados!.atualizar('avancado_capital_instrumentos', cid, dados);
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/capital-instrumentos/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// DELETE /estudos/:id/avancado/capital-instrumentos/:cid
rotasCapitalStack.delete('/estudos/:id/avancado/capital-instrumentos/:cid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const cid = parseInt(req.params.cid);
    if (isNaN(cid)) { erro(res, 400, 'ID_INVALIDO', 'ID do instrumento inválido'); return; }
    const instrumento = await req.dados!.buscar('avancado_capital_instrumentos', cid);
    if (!instrumento || Number(instrumento.estudo_id) !== estudo.id) {
      erro(res, 404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado neste estudo');
      return;
    }
    await req.dados!.deletar('avancado_capital_instrumentos', cid);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/capital-instrumentos/:cid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

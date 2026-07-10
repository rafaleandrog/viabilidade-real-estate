import { Router, type Request, type Response } from 'express';

export const rotasBenchmarks: ReturnType<typeof Router> = Router();

// Benchmarks são registro geral da app (não do Núcleo), editáveis apenas por
// admin (nível de app 'admin' = role aprovador/Diretoria). Leitura liberada a
// qualquer usuário com acesso à app — os estudos precisam validar indicadores.
// (Nota: a spec §2 diz "editor edita benchmarks", mas §6.8 e o schema
// `acesso_externo: restrito` dizem admin-only — seguimos admin-only.)

const TIPOS = ['loteamento', 'incorporacao'];
const REGRAS = ['atingir_ou_superar', 'nao_exceder'];

// Conjunto de indicadores padrão (§4.6). Valores são placeholders editáveis
// pelo admin; eficiência de aproveitamento só existe para Loteamento.
export interface BenchmarkPadrao {
  campo: string;
  valor: number;
  regra_comparacao: string;
  variacao_positiva_pct: number;
  variacao_negativa_pct: number;
}

const INDICADORES_COMUNS: BenchmarkPadrao[] = [
  { campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
  { campo: 'margem_bruta', valor: 30, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
  { campo: 'margem_liquida', valor: 20, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
  { campo: 'roi', valor: 15, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
  { campo: 'custo_obras_vgv', valor: 35, regra_comparacao: 'nao_exceder', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
];

export function benchmarksPadrao(tipo: string): BenchmarkPadrao[] {
  const base = [...INDICADORES_COMUNS];
  if (tipo === 'loteamento') {
    base.push({ campo: 'eficiencia_aproveitamento', valor: 40, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 10, variacao_negativa_pct: 10 });
  }
  return base;
}

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

function exigirAdmin(req: Request, res: Response): boolean {
  if (req.contexto?.nivelApp !== 'admin') {
    erro(res, 403, 'SEM_PERMISSAO', 'Apenas administradores (aprovadores) podem editar benchmarks');
    return false;
  }
  return true;
}

// GET /benchmarks?tipo_empreendimento=...
rotasBenchmarks.get('/benchmarks', async (req: Request, res: Response) => {
  try {
    const filtros: Record<string, any> = {};
    const tipo = (req.query.tipo_empreendimento as string) || '';
    if (tipo) {
      if (!TIPOS.includes(tipo)) { erro(res, 400, 'TIPO_INVALIDO', 'tipo_empreendimento inválido'); return; }
      filtros.tipo_empreendimento = tipo;
    }
    const r = await req.dados!.listar('benchmarks', { filtros, ordenar: 'campo', ordem: 'asc', por_pagina: 200 });
    res.json(r);
  } catch (e: any) {
    console.error('Erro em GET /benchmarks:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /benchmarks — criar (admin)
rotasBenchmarks.post('/benchmarks', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    const { tipo_empreendimento, campo, valor, regra_comparacao, variacao_positiva_pct, variacao_negativa_pct } = req.body;

    if (!TIPOS.includes(tipo_empreendimento)) { erro(res, 400, 'TIPO_INVALIDO', 'tipo_empreendimento inválido'); return; }
    if (!campo || typeof campo !== 'string') { erro(res, 400, 'CAMPO_OBRIGATORIO', 'campo é obrigatório'); return; }
    if (regra_comparacao !== undefined && !REGRAS.includes(regra_comparacao)) {
      erro(res, 400, 'REGRA_INVALIDA', 'regra_comparacao deve ser "atingir_ou_superar" ou "nao_exceder"');
      return;
    }

    // Unicidade [tipo_empreendimento, campo].
    const existente = await req.dados!.listar('benchmarks', {
      filtros: { tipo_empreendimento, campo }, por_pagina: 1,
    });
    if (existente.total > 0) {
      erro(res, 409, 'BENCHMARK_DUPLICADO', `Já existe benchmark "${campo}" para ${tipo_empreendimento}`);
      return;
    }

    const criado = await req.dados!.criar('benchmarks', {
      tipo_empreendimento,
      campo,
      valor: valor ?? null,
      regra_comparacao: regra_comparacao ?? 'atingir_ou_superar',
      variacao_positiva_pct: variacao_positiva_pct ?? null,
      variacao_negativa_pct: variacao_negativa_pct ?? null,
    });
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em POST /benchmarks:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /benchmarks/:id — atualizar (admin)
rotasBenchmarks.patch('/benchmarks/:id', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    const id = parseInt(req.params.id);
    if (isNaN(id)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const dados: Record<string, any> = {};
    for (const campo of ['valor', 'regra_comparacao', 'variacao_positiva_pct', 'variacao_negativa_pct']) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (dados.regra_comparacao !== undefined && !REGRAS.includes(dados.regra_comparacao)) {
      erro(res, 400, 'REGRA_INVALIDA', 'regra_comparacao inválida');
      return;
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }

    const atualizado = await req.dados!.atualizar('benchmarks', id, dados);
    if (!atualizado) { erro(res, 404, 'BENCHMARK_NAO_ENCONTRADO', 'Benchmark não encontrado'); return; }
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /benchmarks/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// DELETE /benchmarks/:id — remover (admin)
rotasBenchmarks.delete('/benchmarks/:id', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    const id = parseInt(req.params.id);
    if (isNaN(id)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const ok = await req.dados!.deletar('benchmarks', id);
    if (!ok) { erro(res, 404, 'BENCHMARK_NAO_ENCONTRADO', 'Benchmark não encontrado'); return; }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /benchmarks/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /benchmarks/semear — cria os indicadores padrão que ainda faltam (admin, idempotente)
rotasBenchmarks.post('/benchmarks/semear', async (req: Request, res: Response) => {
  try {
    if (!exigirAdmin(req, res)) return;
    let criados = 0;
    for (const tipo of TIPOS) {
      const existentesRes = await req.dados!.listar('benchmarks', { filtros: { tipo_empreendimento: tipo }, por_pagina: 200 });
      const jaTem = new Set(existentesRes.dados.map((b) => String(b.campo)));
      for (const padrao of benchmarksPadrao(tipo)) {
        if (jaTem.has(padrao.campo)) continue;
        await req.dados!.criar('benchmarks', { tipo_empreendimento: tipo, ...padrao });
        criados++;
      }
    }
    res.json({ ok: true, criados });
  } catch (e: any) {
    console.error('Erro em POST /benchmarks/semear:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

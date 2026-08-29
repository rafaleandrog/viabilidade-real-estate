import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos } from './estudos.js';

// #634 — PROVA DE FIAÇÃO DE PONTA A PONTA. A leitura de `avancado_linhas_custo`
// dentro de `duplicarDadosAvancado` usava `listar(..., por_pagina: 500)`: um
// estudo com MAIS de 500 linhas de custo perdia, em silêncio, tudo além da
// 500ª na cópia — e `mapaCusto` (que remapeia `custo_linha_ids` das operações
// de funding) cobria só as 500 lidas, então uma operação cujo `custo_linha_ids`
// apontasse para uma linha além da página 1 a tratava como órfã e a
// descartava, mesmo a linha existindo no original.
//
// Teste de rota, não de função pura (mesma exigência do PR #643/#590): monta
// um Express real, registra `rotasEstudos` como o shell faria, e faz um
// `POST /estudos/:id/duplicar` de verdade. `duplicarDadosAvancado` é I/O puro
// (só `req.dados`), então o fake abaixo tem que se comportar como o backend
// REAL quanto a `por_pagina` — obedecendo-o como escrito — para que a
// mutação "trocar varrerTudo de volta por listar(..., por_pagina: 500)"
// derrube o teste. `varrerTudo` é implementado aqui como um LAÇO genuíno de
// páginas sobre `listar`, replicando `docs/shell/banco-de-dados.md`
// § "varrerTudo" (no monorepo): pagina até esgotar e devolve o array de
// linhas, sem envelope `{dados, total}`.

// ── fake de `req.dados` (o que o shell injeta) — em memória, tabelas por Map ──
class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;

  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }

  async buscar(tabela: string, id: number) {
    return this.tabelas.get(tabela)?.get(Number(id)) ?? null;
  }

  // Obedece `por_pagina` COMO ESCRITO — mesmo contrato do backend real
  // (`docs/shell/banco-de-dados.md` § "por_pagina no backend é obedecido").
  // Sem isso o fake não reproduziria o bug: um `listar(..., por_pagina: 500)`
  // teria que devolver só 500 das 501+ linhas seedadas, exatamente como o
  // banco real devolveria.
  async listar(tabela: string, opts: {
    filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc';
    pagina?: number; por_pagina?: number;
  } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const filtros = opts.filtros ?? {};
    let linhas = todas.filter((l) => Object.entries(filtros).every(([k, v]) => l[k] === v));
    if (opts.ordenar) {
      const campo = opts.ordenar;
      const dir = opts.ordem === 'desc' ? -1 : 1;
      linhas = [...linhas].sort((a, b) => {
        const av = a[campo]; const bv = b[campo];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * dir;
      });
    }
    const total = linhas.length;
    const pagina = opts.pagina ?? 1;
    const porPagina = opts.por_pagina ?? 20;
    const inicio = (pagina - 1) * porPagina;
    const dados = linhas.slice(inicio, inicio + porPagina);
    return { dados, total };
  }

  // Pagina em laço até esgotar e devolve o ARRAY de linhas — mesmo contrato
  // do `varrerTudo` real (sem `total`/`paginas`, porque não há página).
  async varrerTudo(tabela: string, opts: {
    filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc'; lote?: number;
  } = {}) {
    const lote = opts.lote ?? 500;
    const todas: any[] = [];
    let pagina = 1;
    for (;;) {
      const r = await this.listar(tabela, { ...opts, pagina, por_pagina: lote });
      todas.push(...r.dados);
      if (todas.length >= r.total || r.dados.length === 0) break;
      pagina++;
    }
    return todas;
  }

  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    const tab = this.tabelas.get(tabela);
    const atual = tab?.get(Number(id));
    if (!atual) throw new Error(`DadosFake: ${tabela}#${id} não existe`);
    const atualizado = { ...atual, ...patch };
    tab!.set(Number(id), atualizado);
    return atualizado;
  }

  async criar(tabela: string, dados: Record<string, any>) {
    const id = this.semear(tabela, dados);
    return this.buscar(tabela, id);
  }

  async remover(tabela: string, id: number, _atorId?: number) {
    return this.atualizar(tabela, id, { removido_em: new Date().toISOString() });
  }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1, nome: 'Teste' } };
    req.eventos = {
      publicar: async () => {},
      inscreverUsuario: async () => {},
      cancelarInscricao: async () => {},
    };
    next();
  });
  app.use(rotasEstudos);
  return app;
}

async function comServidor(
  app: ReturnType<typeof express>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', reject);
    });
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Semeia um estudo Avançado com `n` linhas de custo (grupo/categoria triviais,
// só o suficiente para `extrairCampos`/`validarCamposCusto` não terem nada a
// reclamar) e devolve o id do estudo original + o id da linha de índice
// `linhaAlvoIdx` (0-based), que o teste usa como base de uma operação de
// funding.
function semearEstudoComCustos(dados: DadosFake, n: number) {
  const origId = dados.semear('estudos', {
    id: 1, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo original', uf: 'DF', status: 'rascunho', sequencia: 1,
  });
  const idsCusto: number[] = [];
  for (let i = 0; i < n; i++) {
    const cid = dados.semear('avancado_linhas_custo', {
      estudo_id: origId, grupo: 'diretos', categoria: 'Outro', subcategoria: null,
      orcamento_valor: 1000 + i, orcamento_valor_canonico: 1000 + i, orcamento_unidade: 'rs',
      curva_id: null, cronograma_evento: 'customizado', fase_ancora_id: null,
      inicio_mes: 0, duracao_meses: 1, ordem: i, distribuicao_modo: 'fixo',
      permuta_tipologia_id: null, permuta_quantidade: 0,
      permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
    });
    idsCusto.push(cid);
  }
  return { origId, idsCusto };
}

test('#634 fiação: POST /estudos/:id/duplicar copia TODAS as 501 linhas de custo, não só as primeiras 500', async () => {
  const dados = new DadosFake();
  const { origId, idsCusto } = semearEstudoComCustos(dados, 501);
  const idLinha501 = idsCusto[500]; // índice 500 = a 501ª linha, ordem 500

  // Operação de funding cujo `custo_linha_ids` inclui EXATAMENTE a linha 501ª
  // — critério de aceite (b) da issue: `mapaCusto` precisa cobrir essa linha
  // para o remapeamento não a descartar como órfã.
  dados.semear('avancado_funding_operacoes', {
    estudo_id: origId, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
    ordem: 0, valor: 0, cronograma_evento: 'customizado', fase_ancora_id: null,
    inicio_mes: 0, distribuir_aporte: false, aporte_meses: 1, taxa_anual: 0,
    periodo_amortizacao_meses: 0, periodo_carencia_meses: 0,
    modo_retorno: 'permuta_financeira', pct_retorno: 0,
    exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true,
    custo_linha_ids: [idLinha501],
  });

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201, `esperado 201, veio ${res.status}: ${JSON.stringify(corpo)}`);
    const novoId = Number(corpo.id);
    assert.notEqual(novoId, origId);

    // Critério de aceite (a): total de linhas de custo copiadas == original.
    const custosCopia = await dados.listar('avancado_linhas_custo', {
      filtros: { estudo_id: novoId }, por_pagina: 10000,
    });
    assert.equal(custosCopia.total, 501, 'a cópia perdeu linhas de custo além da página 1 (500)');

    // Critério de aceite (b): a operação de funding copiada preserva a
    // seleção de custo_linha_ids — a linha 501ª não foi tratada como órfã.
    const opsCopia = await dados.listar('avancado_funding_operacoes', {
      filtros: { estudo_id: novoId }, por_pagina: 10,
    });
    assert.equal(opsCopia.total, 1, 'a operação de funding não foi copiada');
    const idsRemapeados: number[] = opsCopia.dados[0].custo_linha_ids;
    assert.equal(idsRemapeados.length, 1,
      'custo_linha_ids da cópia veio vazio — a linha 501ª foi tratada como órfã e descartada ' +
      '(exatamente o defeito da #634: mapaCusto não cobria além da página 1)');
    // O id remapeado tem que apontar para uma linha de custo QUE EXISTE na
    // cópia (não o id antigo, de outro estudo).
    const idsCopiaSet = new Set(custosCopia.dados.map((c: any) => Number(c.id)));
    assert.ok(idsCopiaSet.has(idsRemapeados[0]),
      'custo_linha_ids da cópia aponta para um id que não existe na cópia');
  });
});

test('#634 controle: com só 3 linhas de custo (bem abaixo do antigo teto de 500), a duplicação sempre funcionou — prova que o teste acima mede o caso de BORDA, não qualquer duplicação', async () => {
  const dados = new DadosFake();
  const { origId } = semearEstudoComCustos(dados, 3);

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201);
    const novoId = Number(corpo.id);
    const custosCopia = await dados.listar('avancado_linhas_custo', {
      filtros: { estudo_id: novoId }, por_pagina: 100,
    });
    assert.equal(custosCopia.total, 3);
  });
});

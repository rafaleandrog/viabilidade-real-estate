import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado } from './avancado.js';

// #590/#514 — PROVA DE FIAÇÃO DE PONTA A PONTA (critério de aceite 3 da
// #590). Teste puro de frontend NÃO satisfaz este critério: era exatamente
// o caso antes deste PR — `dadosDaTrocaDeUnidade` convertia certo, e o
// `PATCH` real do backend tomava 400 UNIDADE_INVALIDA mesmo assim, porque o
// bug morava na FIAÇÃO (a allowlist de validação da rota), não no cálculo.
// Este arquivo monta um Express real, registra `rotasAvancado` como o shell
// faria, e faz uma requisição HTTP de verdade contra ele — a única forma de
// provar que a rota aceita o payload, e não só que a função pura converte.

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

  async listar(tabela: string, opts: { filtros?: Record<string, any>; por_pagina?: number } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const filtros = opts.filtros ?? {};
    const dados = todas.filter((linha) => Object.entries(filtros).every(([k, v]) => linha[k] === v));
    return { dados, total: dados.length };
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
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  // O shell injeta req.dados/req.contexto antes de despachar para a rota da
  // app — aqui simulado por um middleware, com nível admin (evita precisar
  // semear estudo_membros para passar por exigirEditor/exigirMembro).
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasAvancado);
  return app;
}

function custoObraBase(estudoId: number, overrides: Record<string, any> = {}) {
  return {
    estudo_id: estudoId,
    grupo: 'obra',
    categoria: 'Gestão da obra',
    subcategoria: null,
    orcamento_valor: null,
    orcamento_valor_canonico: null,
    orcamento_unidade: 'rs',
    cronograma_evento: 'customizado',
    fase_ancora_id: null,
    inicio_mes: 0,
    duracao_meses: 1,
    ordem: 0,
    distribuicao_modo: 'fixo',
    permuta_tipologia_id: null,
    permuta_quantidade: 0,
    permuta_financeira_deduzir_imposto: false,
    permuta_financeira_deduzir_corretagem: false,
    ...overrides,
  };
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

test('#590 fiação: PATCH /estudos/:id/avancado/custos/:cid com orcamento_unidade=pct_obra devolve 200, não 400', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const cid = dados.semear('avancado_linhas_custo', custoObraBase(1));

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orcamento_unidade: 'pct_obra' }),
    });
    const corpo = await res.json();
    assert.equal(res.status, 200, `esperado 200, veio ${res.status}: ${JSON.stringify(corpo)}`);
    assert.equal(corpo.orcamento_unidade, 'pct_obra');
    // Confirma que a mudança foi de fato PERSISTIDA no "banco" (não só ecoada
    // na resposta) — busca a linha de novo, fora da resposta do PATCH.
    const linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(linha.orcamento_unidade, 'pct_obra');
  });
});

test('#590 controle negativo: unidade inexistente continua tomando 400 UNIDADE_INVALIDA (prova que o teste acima exerce validação de verdade)', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const cid = dados.semear('avancado_linhas_custo', custoObraBase(1));

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orcamento_unidade: 'pct_fantasma' }),
    });
    const corpo = await res.json();
    assert.equal(res.status, 400);
    assert.equal(corpo.codigo, 'UNIDADE_INVALIDA');
    // A mensagem reflete a lista ATUAL — se pct_obra for removida de novo da
    // allowlist, este assert também acusa (a mensagem para de citá-la).
    assert.match(corpo.mensagem, /pct_obra/);
  });
});

test('#590 fiação: a linha muda de valor também — 10% de totalObra R$ 50.000.000 grava R$ 5.000.000 canônico (via _editarOrcamento simulado pelo cliente)', async () => {
  // Reproduz o fluxo completo do usuário: 1) troca a badge para "% Obra"
  // (PATCH orcamento_unidade); 2) digita 10 na badge (PATCH orcamento_valor +
  // orcamento_valor_canonico, exatamente como `_editarOrcamento` monta —
  // #514 é quem faz esse canônico sair certo; esta rota só precisa aceitar
  // gravar os dois campos, o que já valia antes desta issue).
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const cid = dados.semear('avancado_linhas_custo', custoObraBase(1, { orcamento_unidade: 'pct_obra' }));

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orcamento_valor: 10, orcamento_valor_canonico: 5_000_000 }),
    });
    assert.equal(res.status, 200);
    const linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(Number(linha.orcamento_valor_canonico), 5_000_000);
  });
});

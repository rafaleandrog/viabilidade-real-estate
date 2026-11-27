import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasFunding } from './funding.js';

// O tipo de uma operação de funding trava depois de criada: o PATCH que troca o
// `tipo` volta 422 `TIPO_IMUTAVEL` e não grava nada; o PATCH que reenvia o MESMO
// tipo, ou que nem manda tipo, segue o caminho de sempre. Prova de FIAÇÃO pela
// porta real (Express de verdade), no molde de `avancado-coercao-rota.test.ts`:
// a função pura `trocaDeTipoBloqueada` tem teste próprio em `funding.test.ts`, e
// o que se prova aqui é que a rota a chama, e antes da validação de campo.

class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;
  escritas = 0;

  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }

  async buscar(tabela: string, id: number) { return this.tabelas.get(tabela)?.get(Number(id)) ?? null; }

  async listar(tabela: string, opts: { filtros?: Record<string, any>; pagina?: number; por_pagina?: number } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const filtros = opts.filtros ?? {};
    const linhas = todas.filter((l) => Object.entries(filtros).every(([k, v]) => l[k] === v));
    const pagina = opts.pagina ?? 1;
    const porPagina = opts.por_pagina ?? 20;
    const ini = (pagina - 1) * porPagina;
    return { dados: linhas.slice(ini, ini + porPagina), total: linhas.length };
  }

  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    return (await this.listar(tabela, { ...opts, por_pagina: 100000 })).dados;
  }

  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    this.escritas++;
    const atual = this.tabelas.get(tabela)?.get(Number(id));
    if (!atual) throw new Error(`DadosFake: ${tabela}#${id} não existe`);
    const novo = { ...atual, ...patch };
    this.tabelas.get(tabela)!.set(Number(id), novo);
    return novo;
  }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasFunding);
  return app;
}

async function comServidor(app: ReturnType<typeof express>, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', () => resolve()); server.once('error', reject); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function patch(base: string, caminho: string, corpo: unknown) {
  const res = await fetch(`${base}${caminho}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: res.status, corpo: await res.json() as any };
}

function cenario() {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise', tipo_empreendimento: 'incorporacao' });
  const id = dados.semear('avancado_funding_operacoes', {
    estudo_id: 1, tipo: 'divida', nome: 'Dívida A', valor: 1000, taxa_anual: 12,
    periodo_amortizacao_meses: 36, periodo_carencia_meses: 12, cronograma_evento: 'customizado', inicio_mes: 0, ordem: 0,
  });
  return { dados, id, caminho: `/estudos/1/avancado/funding/${id}` };
}

test('PATCH de funding: trocar o tipo volta 422 TIPO_IMUTAVEL e não grava nada', async () => {
  for (const tipo of ['equity', 'antecipacao_recebiveis', 'financiamento_producao']) {
    const { dados, id, caminho } = cenario();
    await comServidor(criarApp(dados), async (base) => {
      const r = await patch(base, caminho, { tipo, nome: 'Trocado' });
      assert.equal(r.status, 422, JSON.stringify(r.corpo));
      assert.equal(r.corpo.codigo, 'TIPO_IMUTAVEL');
      assert.equal(dados.escritas, 0, 'a recusa não pode gravar');
      const linha = await dados.buscar('avancado_funding_operacoes', id);
      assert.equal(linha.tipo, 'divida');
      assert.equal(linha.nome, 'Dívida A');
    });
  }
});

test('PATCH de funding: a troca de tipo é recusada antes da validação de campo (não vira 400)', async () => {
  const { dados, caminho } = cenario();
  await comServidor(criarApp(dados), async (base) => {
    // Carência ≥ amortização daria 400 CAMPO_INVALIDO; a troca de tipo vem antes.
    const r = await patch(base, caminho, { tipo: 'equity', periodo_carencia_meses: 40 });
    assert.equal(r.status, 422, JSON.stringify(r.corpo));
    assert.equal(r.corpo.codigo, 'TIPO_IMUTAVEL');
  });
});

test('PATCH de funding: reenviar o MESMO tipo é aceito e grava os outros campos', async () => {
  const { dados, id, caminho } = cenario();
  await comServidor(criarApp(dados), async (base) => {
    const r = await patch(base, caminho, { tipo: 'divida', nome: 'Dívida B' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal((await dados.buscar('avancado_funding_operacoes', id)).nome, 'Dívida B');
  });
});

test('PATCH de funding: sem tipo, continua como antes', async () => {
  const { dados, id, caminho } = cenario();
  await comServidor(criarApp(dados), async (base) => {
    const r = await patch(base, caminho, { taxa_anual: 14 });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const linha = await dados.buscar('avancado_funding_operacoes', id);
    assert.equal(linha.taxa_anual, 14);
    assert.equal(linha.tipo, 'divida');
  });
});

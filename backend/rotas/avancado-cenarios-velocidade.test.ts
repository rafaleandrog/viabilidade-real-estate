// #971: velocidade de vendas dos cenários do Avançado na fronteira de escrita.
// A função pura tem teste próprio; o que se prova aqui é que POST e PATCH de
// `/avancado/cenarios` a CHAMAM, gravam o campo e recusam o que está fora da faixa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado, erroVelocidadeVendas, VELOCIDADE_VENDAS_MIN, VELOCIDADE_VENDAS_MAX } from './avancado.js';
import esquema from '../../schema.json';

class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;
  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }
  todas(tabela: string) { return [...(this.tabelas.get(tabela)?.values() ?? [])]; }
  async buscar(tabela: string, id: number) { return this.tabelas.get(tabela)?.get(Number(id)) ?? null; }
  async listar(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    const linhas = this.todas(tabela).filter((l) => Object.entries(opts.filtros ?? {}).every(([k, v]) => l[k] === v));
    return { dados: linhas, total: linhas.length };
  }
  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    const novo = { ...(await this.buscar(tabela, id)), ...patch };
    this.tabelas.get(tabela)!.set(Number(id), novo);
    return novo;
  }
  async criar(tabela: string, dados: Record<string, any>) { return this.buscar(tabela, this.semear(tabela, dados)); }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasAvancado);
  return app;
}

async function comServidor(dados: DadosFake, fn: (base: string) => Promise<void>) {
  const server = criarApp(dados).listen(0);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', () => resolve()); server.once('error', reject); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function enviar(base: string, metodo: 'POST' | 'PATCH', caminho: string, corpo: unknown) {
  const res = await fetch(`${base}${caminho}`, {
    method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
  return { status: res.status, corpo: await res.json() as any };
}

function novo() {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise', tipo_empreendimento: 'incorporacao' });
  const id = dados.semear('avancado_cenarios', { estudo_id: 1, nome: 'C', preco_venda_pct: 0, custo_obra_pct: 0, velocidade_vendas_pct: 0, ordem: 0 });
  return { dados, id };
}

test('#971 schema: avancado_cenarios.velocidade_vendas_pct é decimal(6,2) com padrão 0', () => {
  const col = (esquema as any).tabelas.avancado_cenarios.colunas.velocidade_vendas_pct;
  assert.deepEqual(col, { tipo: 'decimal', precisao: 6, escala: 2, padrao: 0 });
});

test('#971 erroVelocidadeVendas: faixa de −90% a +500%; ausente ou nula vale', () => {
  assert.equal(VELOCIDADE_VENDAS_MIN, -90);
  assert.equal(VELOCIDADE_VENDAS_MAX, 500);
  for (const v of [undefined, null, 0, -90, 500, 25.5]) assert.equal(erroVelocidadeVendas(v), null, String(v));
  for (const v of [-90.01, -100, 500.01, NaN, Infinity, '10']) assert.match(String(erroVelocidadeVendas(v)), /entre -90% e \+500%/, String(v));
});

test('#971 POST de cenário grava a velocidade, com 0 de padrão quando ausente', async () => {
  const { dados } = novo();
  await comServidor(dados, async (base) => {
    const com = await enviar(base, 'POST', '/estudos/1/avancado/cenarios', { nome: 'Rápido', velocidade_vendas_pct: 30 });
    assert.equal(com.status, 201, JSON.stringify(com.corpo));
    assert.equal(com.corpo.velocidade_vendas_pct, 30);
    const sem = await enviar(base, 'POST', '/estudos/1/avancado/cenarios', { nome: 'Sem' });
    assert.equal(sem.status, 201);
    assert.equal(sem.corpo.velocidade_vendas_pct, 0);
  });
});

test('#971 POST e PATCH recusam velocidade fora da faixa com 400, sem gravar nada', async () => {
  for (const v of [-95, -100, 600]) {
    const { dados, id } = novo();
    const antes = dados.todas('avancado_cenarios').length;
    await comServidor(dados, async (base) => {
      const post = await enviar(base, 'POST', '/estudos/1/avancado/cenarios', { nome: 'X', velocidade_vendas_pct: v });
      assert.equal(post.status, 400, `POST ${v}`);
      assert.equal(post.corpo.codigo, 'VELOCIDADE_VENDAS_INVALIDA');
      const patch = await enviar(base, 'PATCH', `/estudos/1/avancado/cenarios/${id}`, { velocidade_vendas_pct: v });
      assert.equal(patch.status, 400, `PATCH ${v}`);
      assert.equal(patch.corpo.codigo, 'VELOCIDADE_VENDAS_INVALIDA');
    });
    assert.equal(dados.todas('avancado_cenarios').length, antes);
    assert.equal((await dados.buscar('avancado_cenarios', id)).velocidade_vendas_pct, 0);
  }
});

test('#971 PATCH grava a velocidade dentro da faixa', async () => {
  const { dados, id } = novo();
  await comServidor(dados, async (base) => {
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/cenarios/${id}`, { velocidade_vendas_pct: -40 });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.velocidade_vendas_pct, -40);
  });
});

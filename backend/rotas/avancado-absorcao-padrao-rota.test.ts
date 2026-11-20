import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado } from './avancado.js';
import { pctPosChavesDerivado } from '../../frontend/fluxo-shared.js';

// O Pós-chaves gravado de um Grupo é o valor DERIVADO (100 − demais), como a tela grava —
// aqui provado pela rota real (POST de grupo novo e PATCH de blocos), não pela função pura.

class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;
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
    return { dados: linhas, total: linhas.length };
  }
  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    return (await this.listar(tabela, opts)).dados;
  }
  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    const atual = this.tabelas.get(tabela)?.get(Number(id));
    if (!atual) throw new Error(`DadosFake: ${tabela}#${id} não existe`);
    const novo = { ...atual, ...patch };
    this.tabelas.get(tabela)!.set(Number(id), novo);
    return novo;
  }
  async criar(tabela: string, dados: Record<string, any>) {
    return this.buscar(tabela, this.semear(tabela, dados));
  }
}

async function comServidor(dados: DadosFake, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasAvancado);
  const server = app.listen(0);
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

const pctPos = (blocos: any[]) => blocos.find((b) => b.evento === 'pos_obra')?.pct;

test('grupo novo por API grava o pos_obra derivado (30 no default 100 − 30 − 40)', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise', tipo_empreendimento: 'incorporacao', tem_pre_lancamento: false });
  await comServidor(dados, async (base) => {
    const r = await enviar(base, 'POST', '/estudos/1/avancado/fases', { tipo: 'receita' });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    const salvo = await dados.buscar('avancado_fases', r.corpo.id);
    assert.equal(pctPos(salvo.absorcao.blocos), pctPosChavesDerivado(salvo.absorcao.blocos));
    assert.equal(pctPos(salvo.absorcao.blocos), 30);
  });
});

test('PATCH que muda os blocos regrava o pos_obra derivado, ignorando o valor enviado', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise', tipo_empreendimento: 'incorporacao' });
  const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0 });
  await comServidor(dados, async (base) => {
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, {
      absorcao: { modo: 'distribuido', blocos: [
        { evento: 'lancamento', pct: 50 }, { evento: 'obra', pct: 20 }, { evento: 'pos_obra', pct: 999 },
      ] },
    });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const salvo = await dados.buscar('avancado_fases', fid);
    assert.equal(pctPos(salvo.absorcao.blocos), 30);
  });
});

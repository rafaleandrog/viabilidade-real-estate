import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos } from './estudos.js';

// O portão do catálogo de Produtos na SUBMISSÃO do Preliminar
// (`POST /estudos/:id/status` → `em_analise`), por HTTP contra um Express real.
// Antes, a base 0 pulava a regra dos 100% (60% + 41% eram submetidos) e um
// produto com 0 unidades zerava o VGV sem aviso — os dois chegavam a "Em análise".

class DadosFake {
  tabelas = new Map<string, Map<number, any>>();
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
    const linhas = todas.filter((l) => Object.entries(opts.filtros ?? {}).every(([k, v]) => l[k] === v));
    const pp = opts.por_pagina ?? 20; const ini = ((opts.pagina ?? 1) - 1) * pp;
    return { dados: linhas.slice(ini, ini + pp), total: linhas.length };
  }
  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    return (await this.listar(tabela, { ...opts, por_pagina: 100000 })).dados;
  }
  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    const t = this.tabelas.get(tabela)!; const a = { ...t.get(Number(id)), ...patch }; t.set(Number(id), a); return a;
  }
}

// 26 = editor (nível escrita, membro editor do estudo); 1 = admin do app (aprova em qualquer estudo).
function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const uid = Number(req.header('x-usuario'));
    req.dados = dados;
    req.contexto = { nivelApp: uid === 26 ? 'escrita' : uid === 1 ? 'admin' : 'nenhuma', usuario: { id: uid, nome: `U${uid}` } };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasEstudos);
  return app;
}

async function submeter(dados: DadosFake, estudoId: number, status = 'em_analise', usuario = '26'): Promise<{ status: number; j: any }> {
  const server = criarApp(dados).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/estudos/${estudoId}/status`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-usuario': usuario },
      body: JSON.stringify({ status }),
    });
    return { status: r.status, j: await r.json() };
  } finally { await new Promise<void>((r) => server.close(() => r())); }
}

/** Incorporação Preliminar em Rascunho; `base` = área privativa fechada (a base dos %). */
function estudoIncorporacao(dados: DadosFake, base: number, produtos: Record<string, any>[]): number {
  const id = dados.semear('estudos', {
    status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao', nome: 'e',
    area_pvt_r_fechada: base, area_pvt_nr_fechada: 0,
  });
  dados.semear('estudo_membros', { estudo_id: id, usuario_id: 26, funcao: 'editor' });
  produtos.forEach((p, i) => dados.semear('preliminar_produtos', { estudo_id: id, ordem: i, ...p }));
  return id;
}

const statusDe = (dados: DadosFake, id: number) => dados.tabelas.get('estudos')!.get(id)!.status;

test('submissão: base 0 com 101% (60 + 41) é recusada, e o status não muda', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 0, [
    { nome: 'Torre A', pct_alv: 60, preco_venda_m2: 10_000, unidades: 50 },
    { nome: 'Torre B', pct_alv: 41, preco_venda_m2: 10_000, unidades: 30 },
  ]);
  const r = await submeter(dados, id);
  assert.equal(r.status, 422, JSON.stringify(r.j));
  assert.equal(r.j.codigo, 'BASE_PRODUTOS_ZERADA');
  assert.match(r.j.mensagem, /área privativa fechada/);
  assert.equal(statusDe(dados, id), 'rascunho');
});

test('submissão: base positiva com 101% é recusada pela soma', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 1000, [
    { nome: 'Torre A', pct_alv: 60, preco_venda_m2: 10_000, unidades: 50 },
    { nome: 'Torre B', pct_alv: 41, preco_venda_m2: 10_000, unidades: 30 },
  ]);
  const r = await submeter(dados, id);
  assert.equal(r.status, 422, JSON.stringify(r.j));
  assert.equal(r.j.codigo, 'SOMA_ALV_INVALIDA');
  assert.equal(statusDe(dados, id), 'rascunho');
});

test('submissão: produto com 0 unidades é recusado, e a mensagem nomeia o produto', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 1000, [
    { nome: 'Torre A', pct_alv: 60, preco_venda_m2: 10_000, unidades: 50 },
    { nome: 'Torre B', pct_alv: 40, preco_venda_m2: 10_000, unidades: 0 },
  ]);
  const r = await submeter(dados, id);
  assert.equal(r.status, 422, JSON.stringify(r.j));
  assert.equal(r.j.codigo, 'PRODUTO_SEM_VGV');
  assert.match(r.j.mensagem, /Torre B/);
  assert.match(r.j.mensagem, /unidades/);
  assert.doesNotMatch(r.j.mensagem, /Torre A/);
  assert.equal(statusDe(dados, id), 'rascunho');
});

test('submissão: produto sem preço de venda é recusado (VGV da linha = 0)', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 1000, [
    { nome: 'Loja', pct_alv: 100, preco_venda_m2: 0, unidades: 5 },
  ]);
  const r = await submeter(dados, id);
  assert.equal(r.status, 422, JSON.stringify(r.j));
  assert.equal(r.j.codigo, 'PRODUTO_SEM_VGV');
  assert.match(r.j.mensagem, /Loja/);
  assert.match(r.j.mensagem, /preço/);
});

test('submissão: caso normal (base positiva, 100%, unidades e preço) passa', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 1000, [
    { nome: 'Torre A', pct_alv: 60, preco_venda_m2: 10_000, unidades: 50 },
    { nome: 'Torre B', pct_alv: 40, preco_venda_m2: 10_000, unidades: 30 },
  ]);
  const r = await submeter(dados, id);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(statusDe(dados, id), 'em_analise');
});

test('submissão: catálogo vazio continua passando (decisão anterior preservada)', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 0, []);
  const r = await submeter(dados, id);
  assert.equal(r.status, 200, JSON.stringify(r.j));
});

// A APROVAÇÃO confere o mesmo catálogo: em análise o estudo não está travado, e o
// editor pode zerar as unidades de um produto depois de submeter — ou o estudo já
// estava em análise antes desta regra. Sem o portão aqui, o aprovador aprovaria
// com VGV zerado.
function emAnalise(dados: DadosFake, base: number, produtos: Record<string, any>[]): number {
  const id = estudoIncorporacao(dados, base, produtos);
  dados.tabelas.get('estudos')!.get(id)!.status = 'em_analise';
  return id;
}

test('aprovação: produto com 0 unidades em estudo já em análise é recusado', async () => {
  const dados = new DadosFake();
  const id = emAnalise(dados, 1000, [
    { nome: 'Torre A', pct_alv: 60, preco_venda_m2: 10_000, unidades: 50 },
    { nome: 'Torre B', pct_alv: 40, preco_venda_m2: 10_000, unidades: 0 },
  ]);
  const r = await submeter(dados, id, 'aprovado', '1');
  assert.equal(r.status, 422, JSON.stringify(r.j));
  assert.equal(r.j.codigo, 'PRODUTO_SEM_VGV');
  assert.match(r.j.mensagem, /Torre B/);
  assert.equal(statusDe(dados, id), 'em_analise');
});

test('aprovação: base 0 com produto por % é recusada', async () => {
  const dados = new DadosFake();
  const id = emAnalise(dados, 0, [{ nome: 'Torre A', pct_alv: 100, preco_venda_m2: 10_000, unidades: 50 }]);
  const r = await submeter(dados, id, 'aprovado', '1');
  assert.equal(r.status, 422, JSON.stringify(r.j));
  assert.equal(r.j.codigo, 'BASE_PRODUTOS_ZERADA');
  assert.equal(statusDe(dados, id), 'em_analise');
});

test('aprovação: catálogo válido aprova; reprovar e devolver não conferem o catálogo', async () => {
  const dados = new DadosFake();
  const ok = emAnalise(dados, 1000, [{ nome: 'Torre A', pct_alv: 100, preco_venda_m2: 10_000, unidades: 50 }]);
  assert.equal((await submeter(dados, ok, 'aprovado', '1')).status, 200);
  assert.equal(statusDe(dados, ok), 'aprovado');
  for (const destino of ['reprovado', 'rascunho']) {
    const id = emAnalise(dados, 1000, [{ nome: 'Torre B', pct_alv: 100, preco_venda_m2: 10_000, unidades: 0 }]);
    const r = await submeter(dados, id, destino, '1');
    assert.equal(r.status, 200, `${destino}: ${JSON.stringify(r.j)}`);
  }
});

test('submissão: catálogo só de legados (sem pct_alv) com base 0 passa', async () => {
  const dados = new DadosFake();
  const id = estudoIncorporacao(dados, 0, [
    { nome: 'Legado', area_media_m2: 80, preco_venda_m2: 9_000, unidades: 10 },
  ]);
  const r = await submeter(dados, id);
  assert.equal(r.status, 200, JSON.stringify(r.j));
});

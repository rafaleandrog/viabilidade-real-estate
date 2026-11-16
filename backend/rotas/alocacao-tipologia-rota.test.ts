import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado } from './avancado.js';

// PROVA DE FIAÇÃO do PATCH de alocação que troca a tipologia. O POST já
// conferia o estoque da tipologia e tomava o preço/m² dela; o PATCH só
// conferia o estoque quando o corpo trazia `unidades`, então trocar SÓ a
// `tipologia_id` levava as unidades da origem para o destino sem conferir o
// saldo dele, e a alocação seguia com o preço/m² da tipologia de origem.
// HTTP contra um Express real, no padrão de `remover-por-patch-rota.test.ts`.

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
  async criar(tabela: string, dados: Record<string, any>) { return this.buscar(tabela, this.semear(tabela, dados)); }
  async deletar(tabela: string, id: number) { this.tabelas.get(tabela)?.delete(Number(id)); }
  linha(tabela: string, id: number) { return this.tabelas.get(tabela)?.get(id); }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'escrita', usuario: { id: 26, nome: 'U26' } };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasAvancado);
  return app;
}

type Chamada = (metodo: string, caminho: string, corpo: Record<string, any>) => Promise<{ status: number; j: any }>;

async function comServidor(dados: DadosFake, fn: (chamar: Chamada) => Promise<void>) {
  const server = criarApp(dados).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  const chamar: Chamada = async (metodo, caminho, corpo) => {
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
    });
    return { status: r.status, j: await r.json() };
  };
  try { await fn(chamar); } finally { await new Promise<void>((r) => server.close(() => r())); }
}

/** Estudo Avançado em Rascunho, editor 26, um grupo de receita e duas tipologias. */
function cenario(qtdDestino = 3) {
  const dados = new DadosFake();
  const e = dados.semear('estudos', { status: 'rascunho', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao', nome: 'e' });
  dados.semear('estudo_membros', { estudo_id: e, usuario_id: 26, funcao: 'editor' });
  const grupo = dados.semear('avancado_fases', { estudo_id: e, tipo: 'receita', nome: '1º Grupo' });
  const origem = dados.semear('avancado_tipologias', { estudo_id: e, nome: 'Origem', quantidade: 10, preco_m2: 8000 });
  const destino = dados.semear('avancado_tipologias', { estudo_id: e, nome: 'Destino', quantidade: qtdDestino, preco_m2: 12000 });
  const aloc = dados.semear('avancado_alocacoes', { estudo_id: e, fase_id: grupo, tipologia_id: origem, unidades: 5, preco_m2: 8000, ordem: 0 });
  const url = `/estudos/${e}/avancado/fases/${grupo}/alocacoes/${aloc}`;
  return { dados, e, grupo, origem, destino, aloc, url };
}

test('PATCH só com tipologia_id: estoque do DESTINO estourado é recusado (SALDO_EXCEDIDO)', async () => {
  const c = cenario(3);
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: c.destino });
    assert.equal(r.status, 422, JSON.stringify(r.j));
    assert.equal(r.j.codigo, 'SALDO_EXCEDIDO');
    assert.equal(c.dados.linha('avancado_alocacoes', c.aloc).tipologia_id, c.origem, 'a alocação não mudou de tipologia');
  });
});

test('PATCH só com tipologia_id: destino sem saldo nenhum é recusado (SALDO_ESGOTADO), como no POST', async () => {
  const c = cenario(2);
  c.dados.semear('avancado_alocacoes', { estudo_id: c.e, fase_id: c.grupo, tipologia_id: c.destino, unidades: 2, preco_m2: 12000, ordem: 1 });
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: c.destino });
    assert.equal(r.status, 422, JSON.stringify(r.j));
    assert.equal(r.j.codigo, 'SALDO_ESGOTADO');
  });
});

test('PATCH só com tipologia_id: com saldo, troca e leva o preço/m² do DESTINO', async () => {
  const c = cenario(8);
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: c.destino });
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.equal(r.j.tipologia_id, c.destino);
    assert.equal(r.j.unidades, 5);
    assert.equal(r.j.preco_m2, 12000, 'preço/m² da tipologia de destino, não o da origem');
    assert.equal(c.dados.linha('avancado_alocacoes', c.aloc).preco_m2, 12000);
  });
});

test('PATCH com tipologia_id e preco_m2 explícito: vale o preço informado', async () => {
  const c = cenario(8);
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: c.destino, preco_m2: 9500 });
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.equal(r.j.preco_m2, 9500);
  });
});

test('PATCH com tipologia_id e unidades: confere as unidades novas contra o destino', async () => {
  const c = cenario(3);
  await comServidor(c.dados, async (chamar) => {
    assert.equal((await chamar('PATCH', c.url, { tipologia_id: c.destino, unidades: 4 })).status, 422);
    const r = await chamar('PATCH', c.url, { tipologia_id: c.destino, unidades: 3 });
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.equal(r.j.unidades, 3);
    assert.equal(r.j.preco_m2, 12000);
  });
});

test('PATCH repetindo a MESMA tipologia não reescreve o preço/m² negociado', async () => {
  const c = cenario(3);
  c.dados.atualizar('avancado_alocacoes', c.aloc, { preco_m2: 8800 });
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: c.origem });
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.equal(r.j.preco_m2, 8800);
  });
});

test('PATCH com tipologia de OUTRO estudo é 404; tipologia_id não numérico é 400, como no POST', async () => {
  const c = cenario(3);
  const outro = c.dados.semear('estudos', { status: 'rascunho', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao', nome: 'o' });
  const alheia = c.dados.semear('avancado_tipologias', { estudo_id: outro, nome: 'Alheia', quantidade: 100, preco_m2: 1 });
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: alheia });
    assert.equal(r.status, 404);
    assert.equal(r.j.codigo, 'TIPOLOGIA_NAO_ENCONTRADA');
    const r2 = await chamar('PATCH', c.url, { tipologia_id: 'x' });
    assert.equal(r2.status, 400);
    assert.equal(r2.j.codigo, 'TIPOLOGIA_OBRIGATORIA');
  });
});

test('PATCH só de unidades na mesma tipologia segue excluindo a própria alocação do saldo', async () => {
  const c = cenario(3);
  await comServidor(c.dados, async (chamar) => {
    assert.equal((await chamar('PATCH', c.url, { unidades: 10 })).status, 200);
    const r = await chamar('PATCH', c.url, { unidades: 11 });
    assert.equal(r.status, 422);
    assert.equal(r.j.codigo, 'SALDO_EXCEDIDO');
  });
});

test('POST continua com as mesmas regras (saldo e preço da tipologia)', async () => {
  const c = cenario(3);
  await comServidor(c.dados, async (chamar) => {
    const base = `/estudos/${c.e}/avancado/fases/${c.grupo}/alocacoes`;
    assert.equal((await chamar('POST', base, { tipologia_id: c.destino, unidades: 4 })).j.codigo, 'SALDO_EXCEDIDO');
    const r = await chamar('POST', base, { tipologia_id: c.destino, unidades: 3 });
    assert.equal(r.status, 201, JSON.stringify(r.j));
    assert.equal(r.j.preco_m2, 12000);
    assert.equal((await chamar('POST', base, { tipologia_id: c.destino, unidades: 0 })).j.codigo, 'SALDO_ESGOTADO');
  });
});

test('trocar a tipologia continua sujeito à permuta física da ORIGEM', async () => {
  const c = cenario(8);
  c.dados.semear('avancado_linhas_custo', {
    estudo_id: c.e, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: c.origem, permuta_quantidade: 3,
  });
  await comServidor(c.dados, async (chamar) => {
    const r = await chamar('PATCH', c.url, { tipologia_id: c.destino });
    assert.equal(r.status, 422, JSON.stringify(r.j));
    assert.equal(r.j.codigo, 'PERMUTA_EXCEDE_ALOCADO');
  });
});

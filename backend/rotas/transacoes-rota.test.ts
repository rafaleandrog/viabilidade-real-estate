import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos } from './estudos.js';
import { rotasAvancado } from './avancado.js';

// #837 — atomicidade da criação, da duplicação e do salvamento do cronograma.
//
// PROVA DE FIAÇÃO: cada rota grava pelo `trx` de `req.dados.transaction(...)`,
// não por `req.dados`. O fake abaixo separa os dois executores — `raiz` (o
// `req.dados`) e `trx` (o que o callback recebe) — e registra, em cada escrita,
// QUAL deles a fez; a transação tira um snapshot antes e o restaura se o
// callback lançar, como o ROLLBACK do SDK. Sem o `transaction(` na rota, as
// escritas saem pela `raiz`, nenhum rollback acontece, e estes testes ficam
// vermelhos (mutações medidas no PR).

type Escrita = { exec: 'raiz' | 'trx'; op: 'criar' | 'atualizar'; tabela: string };

class Banco {
  tabelas = new Map<string, Map<number, any>>();
  proximoId = 1000;
  escritas: Escrita[] = [];
  transacoes = 0;
  /** Lança quando a escrita casa — simula falha do banco no meio da unidade. */
  falharEm: ((op: string, tabela: string) => boolean) | null = null;

  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }
  linhas(tabela: string, filtros: Record<string, any> = {}): any[] {
    return [...(this.tabelas.get(tabela)?.values() ?? [])]
      .filter((l) => Object.entries(filtros).every(([k, v]) => l[k] === v));
  }
}

class Executor {
  constructor(private banco: Banco, private nome: 'raiz' | 'trx') {}

  async buscar(tabela: string, id: number) {
    return this.banco.tabelas.get(tabela)?.get(Number(id)) ?? null;
  }
  async listar(tabela: string, opts: { filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc'; pagina?: number; por_pagina?: number } = {}) {
    let linhas = this.banco.linhas(tabela, opts.filtros);
    if (opts.ordenar) {
      const c = opts.ordenar; const dir = opts.ordem === 'desc' ? -1 : 1;
      linhas = [...linhas].sort((a, b) => (a[c] === b[c] ? 0 : (a[c] > b[c] ? 1 : -1) * dir));
    }
    const pagina = opts.pagina ?? 1; const porPagina = opts.por_pagina ?? 20;
    const inicio = (pagina - 1) * porPagina;
    return { dados: linhas.slice(inicio, inicio + porPagina), total: linhas.length };
  }
  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc' } = {}) {
    return (await this.listar(tabela, { ...opts, pagina: 1, por_pagina: 100000 })).dados;
  }
  async criar(tabela: string, dados: Record<string, any>) {
    this.banco.escritas.push({ exec: this.nome, op: 'criar', tabela });
    if (this.banco.falharEm?.('criar', tabela)) throw new Error(`falha injetada em criar(${tabela})`);
    const id = this.banco.semear(tabela, dados);
    return this.buscar(tabela, id);
  }
  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    this.banco.escritas.push({ exec: this.nome, op: 'atualizar', tabela });
    if (this.banco.falharEm?.('atualizar', tabela)) throw new Error(`falha injetada em atualizar(${tabela})`);
    const atual = this.banco.tabelas.get(tabela)?.get(Number(id));
    if (!atual) throw new Error(`${tabela}#${id} não existe`);
    const novo = { ...atual, ...patch };
    this.banco.tabelas.get(tabela)!.set(Number(id), novo);
    return novo;
  }
  async remover(tabela: string, id: number) {
    return this.atualizar(tabela, id, { removido_em: 'x' });
  }
  async transaction<T>(cb: (trx: Executor) => Promise<T>): Promise<T> {
    if (this.nome === 'trx') throw new Error('transação aninhada não é o contrato testado aqui');
    this.banco.transacoes++;
    const copia = new Map<string, Map<number, any>>();
    for (const [n, t] of this.banco.tabelas) copia.set(n, new Map([...t].map(([i, l]) => [i, { ...l }])));
    const proximoId = this.banco.proximoId;
    try {
      return await cb(new Executor(this.banco, 'trx'));
    } catch (e) {
      this.banco.tabelas = copia;
      this.banco.proximoId = proximoId;
      throw e;
    }
  }
}

async function comRota(banco: Banco, rotas: express.Router, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = new Executor(banco, 'raiz');
    req.contexto = { nivelApp: 'admin', usuario: { id: 1, nome: 'Teste' } };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotas);
  const server = app.listen(0);
  try {
    await new Promise<void>((ok, ruim) => { server.once('listening', () => ok()); server.once('error', ruim); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
}

function semearAvancado(banco: Banco) {
  const origId = banco.semear('estudos', {
    id: 1, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao',
    nome: 'Original', uf: 'DF', status: 'rascunho', sequencia: 1,
  });
  banco.semear('avancado_cronograma', { estudo_id: origId, evento: 'planejamento', inicio_mes: 0, duracao_meses: 3, travado_inicio: true, travado_duracao: false });
  banco.semear('avancado_fases', { estudo_id: origId, tipo: 'obra', nome: 'Fase 1', ordem: 0, inicio_mes: 0, duracao_meses: 12 });
  // As duas escritas do duplicar que não são do Avançado: o vínculo com imóvel
  // e uma tabela de FILHAS_SIMPLES. Sem seed, trocar `trx` por `req.dados` nelas passava.
  banco.semear('estudo_imoveis', { estudo_id: origId, imovel_nucleo_id: 5000, tipo_imovel: 'lote' });
  banco.semear('preliminar_produtos', { estudo_id: origId, nome: 'Produto 1', tipo: 'residencial', area_media_m2: 50, unidades: 1, preco_m2: 10000, ordem: 0 });
  return origId;
}

const estaticoDaCopia = (banco: Banco) => ({
  estudos: banco.linhas('estudos').length,
  cronograma: banco.linhas('avancado_cronograma').length,
  fases: banco.linhas('avancado_fases').length,
  imoveis: banco.linhas('estudo_imoveis').length,
  produtos: banco.linhas('preliminar_produtos').length,
  membros: banco.linhas('estudo_membros').length,
});

// (a) duplicação ---------------------------------------------------------

test('#837 duplicar: grava tudo pelo trx, numa única transação', async () => {
  const banco = new Banco();
  const origId = semearAvancado(banco);
  await comRota(banco, rotasEstudos, async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    assert.equal(res.status, 201, await res.clone().text());
  });
  assert.equal(banco.transacoes, 1, 'a duplicação deveria abrir exatamente uma transação');
  const fora = banco.escritas.filter((e) => e.exec !== 'trx');
  assert.deepEqual(fora, [], 'escrita da duplicação saiu pelo req.dados em vez do trx');
  for (const t of ['estudos', 'avancado_cronograma', 'avancado_fases', 'estudo_imoveis', 'preliminar_produtos', 'estudo_membros']) {
    assert.ok(banco.escritas.some((e) => e.tabela === t && e.exec === 'trx'), `nenhuma escrita em ${t} pelo trx`);
  }
});

for (const falha of ['avancado_fases', 'estudo_membros']) {
  test(`#837 duplicar: falha em criar(${falha}) deixa zero linhas novas e responde 500`, async () => {
    const banco = new Banco();
    const origId = semearAvancado(banco);
    const antes = estaticoDaCopia(banco);
    banco.falharEm = (op, tabela) => op === 'criar' && tabela === falha;
    await comRota(banco, rotasEstudos, async (base) => {
      const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
      assert.equal(res.status, 500);
    });
    assert.deepEqual(estaticoDaCopia(banco), antes, 'sobrou linha do clone depois da falha — a unidade não é atômica');
    assert.equal(banco.linhas('estudos').filter((e) => e.removido_em).length, 0, 'o clone foi "removido" em vez de desfeito');
  });
}

// (b) POST /estudos ------------------------------------------------------

test('#837 POST /estudos: estudo e vínculo do criador gravam pelo trx; falha no vínculo não deixa estudo', async () => {
  const ok = new Banco();
  await comRota(ok, rotasEstudos, async (base) => {
    const res = await fetch(`${base}/estudos`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Novo', tipo_empreendimento: 'incorporacao', uf: 'DF' }),
    });
    assert.equal(res.status, 201, await res.clone().text());
  });
  assert.equal(ok.transacoes, 1);
  assert.deepEqual(ok.escritas.filter((e) => e.exec !== 'trx'), [], 'escrita de POST /estudos saiu fora do trx');
  assert.equal(ok.linhas('estudo_membros').length, 1);

  const ruim = new Banco();
  ruim.falharEm = (op, tabela) => op === 'criar' && tabela === 'estudo_membros';
  await comRota(ruim, rotasEstudos, async (base) => {
    const res = await fetch(`${base}/estudos`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Novo', tipo_empreendimento: 'incorporacao', uf: 'DF' }),
    });
    assert.equal(res.status, 500);
  });
  assert.equal(ruim.linhas('estudos').length, 0, 'o estudo sobrou sem membro (ou foi só marcado removido)');
});

// (c) cronograma ---------------------------------------------------------

function semearCronograma(banco: Banco) {
  const id = banco.semear('estudos', { id: 7, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao', nome: 'A', status: 'rascunho' });
  banco.semear('avancado_cronograma', { estudo_id: id, evento: 'planejamento', inicio_mes: 0, duracao_meses: 3, travado_inicio: true, travado_duracao: false });
  // custo preso à obra: precisa ser reancorado quando o planejamento muda
  banco.semear('avancado_linhas_custo', { estudo_id: id, cronograma_evento: 'obra', inicio_mes: 99, duracao_meses: 99 });
  return id;
}
const patchCronograma = (base: string, id: number) => fetch(`${base}/estudos/${id}/avancado/cronograma`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ eventos: { planejamento: { duracao_meses: 6 } } }),
});

test('#837 cronograma: salvar e reancorar gravam pelo mesmo trx, numa transação', async () => {
  const banco = new Banco();
  const id = semearCronograma(banco);
  await comRota(banco, rotasAvancado, async (base) => {
    const res = await patchCronograma(base, id);
    assert.equal(res.status, 200, await res.clone().text());
    assert.ok((await res.json()).custos_reancorados >= 1, 'o custo preso à obra deveria ter sido reancorado');
  });
  assert.equal(banco.transacoes, 1);
  assert.deepEqual(banco.escritas.filter((e) => e.exec !== 'trx'), [], 'escrita do cronograma saiu fora do trx');
  assert.ok(banco.escritas.some((e) => e.tabela === 'avancado_cronograma' && e.exec === 'trx'));
  assert.ok(banco.escritas.some((e) => e.tabela === 'avancado_linhas_custo' && e.exec === 'trx'));
});

test('#837 cronograma: falha na reancoragem desfaz também o cronograma salvo e responde 500', async () => {
  const banco = new Banco();
  const id = semearCronograma(banco);
  const antes = JSON.stringify(banco.linhas('avancado_cronograma'));
  banco.falharEm = (op, tabela) => op === 'atualizar' && tabela === 'avancado_linhas_custo';
  await comRota(banco, rotasAvancado, async (base) => {
    assert.equal((await patchCronograma(base, id)).status, 500);
  });
  assert.equal(JSON.stringify(banco.linhas('avancado_cronograma')), antes, 'o cronograma ficou gravado pela metade');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasPreliminarProdutos } from './preliminar-produtos.js';
import esquema from '../../schema.json';

// #812 — `tipo` fora do enum do `schema.json` virava 500 ERRO_INTERNO (o shell
// recusa e o `catch` genérico devolvia a recusa do CLIENTE como erro interno).
// Prova de FIAÇÃO com Express real + `DadosFake` que reproduz a regra do shell
// (`tipo` fora de `opcoes` e string em coluna numérica → lança).

const COLUNAS = (esquema as any).tabelas.preliminar_produtos.colunas as Record<string, any>;
const VALIDOS: string[] = COLUNAS.tipo.opcoes;
const NUMERICAS = Object.entries(COLUNAS)
  .filter(([, c]) => ['decimal', 'inteiro', 'referencia'].includes(c.tipo))
  .map(([n]) => n);

class DadosFake {
  private linhas = new Map<number, any>();
  private estudos = new Map<number, any>();
  private proximoId = 1;

  constructor() { this.estudos.set(1, { id: 1, status: 'em_analise', tipo_empreendimento: 'incorporacao' }); }

  semear(linha: Record<string, any>) { const id = this.proximoId++; this.linhas.set(id, { ...linha, id }); return id; }
  total() { return this.linhas.size; }

  private validar(d: Record<string, any>) {
    if (d.tipo !== undefined && !VALIDOS.includes(d.tipo)) throw new Error(`Campo "tipo" deve ser um de: ${VALIDOS.join(', ')}`);
    for (const c of NUMERICAS) {
      if (d[c] === null || d[c] === undefined) continue;
      if (typeof d[c] !== 'number') throw new Error(`Campo "${c}" deve ser um número`);
    }
  }

  async buscar(tabela: string, id: number) {
    return tabela === 'estudos' ? this.estudos.get(Number(id)) ?? null : this.linhas.get(Number(id)) ?? null;
  }
  async listar(_t: string, opts: any = {}) {
    const dados = [...this.linhas.values()].filter((l) => l.estudo_id === opts.filtros?.estudo_id);
    return { dados, total: dados.length };
  }
  async criar(_t: string, d: Record<string, any>) {
    this.validar(d);
    const id = this.semear({ tipo: COLUNAS.tipo.padrao, ...d });
    return this.linhas.get(id);
  }
  async atualizar(_t: string, id: number, d: Record<string, any>) {
    this.validar(d);
    const novo = { ...this.linhas.get(Number(id)), ...d };
    this.linhas.set(Number(id), novo);
    return novo;
  }
}

async function comServidor(dados: DadosFake, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.dados = dados; req.contexto = { nivelApp: 'admin', usuario: { id: 1 } }; next(); });
  app.use(rotasPreliminarProdutos);
  const server = app.listen(0);
  try {
    await new Promise<void>((ok, ko) => { server.once('listening', () => ok()); server.once('error', ko); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
}

async function enviar(base: string, metodo: 'POST' | 'PATCH', caminho: string, corpo: unknown) {
  const res = await fetch(`${base}${caminho}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  return { status: res.status, corpo: await res.json() as any };
}

const SEMENTE = { estudo_id: 1, nome: 'P', tipo: 'residencial', unidades: 1, ordem: 0 };

test('#812 POST e PATCH com tipo fora do enum → 400 TIPO_INVALIDO listando os válidos, sem gravar', async () => {
  for (const invalido of ['comercial', '', 'Residencial', 1, null]) {
    const dados = new DadosFake();
    const id = dados.semear(SEMENTE);
    await comServidor(dados, async (base) => {
      const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', tipo: invalido });
      assert.equal(post.status, 400, `POST tipo=${JSON.stringify(invalido)} → ${JSON.stringify(post.corpo)}`);
      assert.equal(post.corpo.codigo, 'TIPO_INVALIDO');
      for (const v of VALIDOS) assert.match(post.corpo.mensagem, new RegExp(v));
      assert.equal(dados.total(), 1, 'POST recusado não pode criar linha');

      const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { tipo: invalido });
      assert.equal(patch.status, 400, `PATCH tipo=${JSON.stringify(invalido)} → ${JSON.stringify(patch.corpo)}`);
      assert.equal(patch.corpo.codigo, 'TIPO_INVALIDO');
      assert.equal((await dados.buscar('preliminar_produtos', id)).tipo, 'residencial', 'PATCH recusado não pode alterar');
    });
  }
});

test('#812 tipos válidos do schema.json → 201 no POST e 200 no PATCH', async () => {
  assert.deepEqual([...VALIDOS].sort(), ['nao_residencial', 'residencial']);
  for (const tipo of VALIDOS) {
    const dados = new DadosFake();
    const id = dados.semear({ ...SEMENTE, tipo: tipo === 'residencial' ? 'nao_residencial' : 'residencial' });
    await comServidor(dados, async (base) => {
      const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', tipo });
      assert.equal(post.status, 201, JSON.stringify(post.corpo));
      assert.equal(post.corpo.tipo, tipo);
      const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { tipo });
      assert.equal(patch.status, 200, JSON.stringify(patch.corpo));
      assert.equal(patch.corpo.tipo, tipo);
    });
  }
});

test('#812 tipo ausente: POST usa o default do schema, PATCH deixa inalterado', async () => {
  const dados = new DadosFake();
  const id = dados.semear({ ...SEMENTE, tipo: 'nao_residencial' });
  await comServidor(dados, async (base) => {
    const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X' });
    assert.equal(post.status, 201, JSON.stringify(post.corpo));
    assert.equal(post.corpo.tipo, COLUNAS.tipo.padrao);
    const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { nome: 'Y' });
    assert.equal(patch.status, 200, JSON.stringify(patch.corpo));
    assert.equal(patch.corpo.tipo, 'nao_residencial');
  });
});

test('#812 lixo nos campos numéricos → 400 CAMPO_INVALIDO (nunca 500); string decimal estrita é gravada como número', async () => {
  for (const campo of ['unidades', 'area_media_m2', 'preco_venda_m2']) {
    for (const lixo of ['abc', '1e3', '0x10', '']) {
      const dados = new DadosFake();
      const id = dados.semear(SEMENTE);
      await comServidor(dados, async (base) => {
        const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', [campo]: lixo });
        assert.equal(post.status, 400, `POST ${campo}=${JSON.stringify(lixo)} → ${JSON.stringify(post.corpo)}`);
        assert.equal(post.corpo.codigo, 'CAMPO_INVALIDO');
        const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { [campo]: lixo });
        assert.equal(patch.status, 400, `PATCH ${campo}=${JSON.stringify(lixo)} → ${JSON.stringify(patch.corpo)}`);
        assert.equal(dados.total(), 1);
      });
    }
  }
  const dados = new DadosFake();
  await comServidor(dados, async (base) => {
    const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', preco_venda_m2: '1234.50', unidades: '3' });
    assert.equal(post.status, 201, JSON.stringify(post.corpo));
    assert.equal(post.corpo.preco_venda_m2, 1234.5);
    assert.equal(post.corpo.unidades, 3);
  });
});

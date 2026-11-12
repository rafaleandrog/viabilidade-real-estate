import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos } from './estudos.js';
import { rotasPreliminarProdutos } from './preliminar-produtos.js';
import { rotasApelo } from './apelo-comercial.js';
import { rotasEmpreendimento } from './empreendimento.js';
import { rotasAvancado } from './avancado.js';
import { rotasFunding } from './funding.js';
import { rotasImoveisEstudo } from './imoveis-estudo.js';

// #860 — PROVA DE FIAÇÃO das remoções por `PATCH …/remover`. O shell barra
// DELETE para quem não é admin (SDK, permissoes.md § Contrato uniforme
// método→nível); este arquivo prova, por HTTP contra um Express real, que a rota
// nova existe para cada remoção de dentro do estudo, que o editor a usa em
// Rascunho, que o gate de status vale nela, e que o documento do apelo é
// conferido contra o estudo (antes, qualquer editor apagava o de outro estudo).

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
  async remover(tabela: string, id: number) { return this.tabelas.get(tabela)?.delete(Number(id)) ?? false; }
  existe(tabela: string, id: number) { return this.tabelas.get(tabela)?.has(id) ?? false; }
}

// 26 = editor (nível escrita, membro editor); 28 = admin do app.
const NIVEIS: Record<number, string> = { 26: 'escrita', 28: 'admin' };

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const uid = Number(req.header('x-usuario'));
    req.dados = dados;
    req.contexto = { nivelApp: NIVEIS[uid] ?? 'nenhuma', usuario: { id: uid, nome: `U${uid}` } };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  for (const r of [rotasEstudos, rotasPreliminarProdutos, rotasApelo, rotasEmpreendimento, rotasAvancado, rotasFunding, rotasImoveisEstudo]) app.use(r);
  return app;
}

async function comServidor(dados: DadosFake, fn: (patch: (uid: number, caminho: string) => Promise<{ status: number; j: any }>) => Promise<void>) {
  const server = criarApp(dados).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  const patch = async (uid: number, caminho: string) => {
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-usuario': String(uid) }, body: '{}',
    });
    return { status: r.status, j: await r.json() };
  };
  try { await fn(patch); } finally { await new Promise<void>((r) => server.close(() => r())); }
}

function estudo(dados: DadosFake, status: string, nivel = 'preliminar') {
  const id = dados.semear('estudos', { status, nivel_analise: nivel, tipo_empreendimento: 'incorporacao', nome: 'e' });
  dados.semear('estudo_membros', { estudo_id: id, usuario_id: 26, funcao: 'editor' });
  return id;
}

test('#860: o editor remove por PATCH …/remover em Rascunho, rota a rota', async () => {
  const dados = new DadosFake();
  const p = estudo(dados, 'rascunho');
  const a = estudo(dados, 'rascunho', 'avancado');
  const prod = dados.semear('preliminar_produtos', { estudo_id: p, nome: 'x' });
  const doc = dados.semear('estudo_documentos', { estudo_id: p, categoria: 'render' });
  const apelo = dados.semear('apelo_comercial', { estudo_id: p });
  const docApelo = dados.semear('apelo_comercial_documentos', { apelo_id: apelo, texto_adicional: 't' });
  const imovel = dados.semear('estudo_imoveis', { estudo_id: p, imovel_nucleo_id: 9, tipo_imovel: 'lote' });
  const cen = dados.semear('avancado_cenarios', { estudo_id: a, nome: 'c' });
  const op = dados.semear('avancado_funding_operacoes', { estudo_id: a, tipo: 'divida', nome: 'd' });
  const casos: [string, string, number][] = [
    [`/estudos/${p}/preliminar/produtos/${prod}/remover`, 'preliminar_produtos', prod],
    [`/estudos/${p}/empreendimento/documentos/${doc}/remover`, 'estudo_documentos', doc],
    [`/estudos/${p}/apelo-comercial/documentos/${docApelo}/remover`, 'apelo_comercial_documentos', docApelo],
    [`/estudos/${p}/imoveis/${imovel}/remover`, 'estudo_imoveis', imovel],
    [`/estudos/${a}/avancado/cenarios/${cen}/remover`, 'avancado_cenarios', cen],
    [`/estudos/${a}/avancado/funding/${op}/remover`, 'avancado_funding_operacoes', op],
  ];
  await comServidor(dados, async (patch) => {
    for (const [caminho, tabela, id] of casos) {
      const r = await patch(26, caminho);
      assert.equal(r.status, 200, `${caminho} → ${JSON.stringify(r.j)}`);
      assert.equal(dados.existe(tabela, id), false, `${caminho} não removeu`);
    }
    // o próprio estudo, em Rascunho
    assert.equal((await patch(26, `/estudos/${p}/remover`)).status, 200);
    assert.equal(dados.existe('estudos', p), false);
  });
});

test('#860: em estudo aprovado o editor não remove; o admin remove', async () => {
  const dados = new DadosFake();
  const e = estudo(dados, 'aprovado');
  const prod = dados.semear('preliminar_produtos', { estudo_id: e, nome: 'x' });
  const doc = dados.semear('estudo_documentos', { estudo_id: e, categoria: 'render' });
  const apelo = dados.semear('apelo_comercial', { estudo_id: e });
  const docApelo = dados.semear('apelo_comercial_documentos', { apelo_id: apelo, texto_adicional: 't' });
  await comServidor(dados, async (patch) => {
    for (const c of [
      `/estudos/${e}/preliminar/produtos/${prod}/remover`,
      `/estudos/${e}/empreendimento/documentos/${doc}/remover`,
      `/estudos/${e}/apelo-comercial/documentos/${docApelo}/remover`,
      `/estudos/${e}/remover`,
    ]) {
      assert.equal((await patch(26, c)).status, 403, c);
    }
    assert.equal(dados.existe('preliminar_produtos', prod), true);
    assert.equal(dados.existe('estudos', e), true);
    assert.equal((await patch(28, `/estudos/${e}/preliminar/produtos/${prod}/remover`)).status, 200);
    assert.equal((await patch(28, `/estudos/${e}/remover`)).status, 200);
  });
});

test('#860: fora de Rascunho o editor não exclui o estudo (decisão do autor)', async () => {
  const dados = new DadosFake();
  const e = estudo(dados, 'em_analise');
  await comServidor(dados, async (patch) => {
    const r = await patch(26, `/estudos/${e}/remover`);
    assert.equal(r.status, 403);
    assert.equal(dados.existe('estudos', e), true);
  });
});

test('#860: documento do apelo de OUTRO estudo não é apagado (404)', async () => {
  const dados = new DadosFake();
  const meu = estudo(dados, 'rascunho');
  const outro = estudo(dados, 'rascunho');
  const apeloOutro = dados.semear('apelo_comercial', { estudo_id: outro });
  const docOutro = dados.semear('apelo_comercial_documentos', { apelo_id: apeloOutro, texto_adicional: 't' });
  await comServidor(dados, async (patch) => {
    const r = await patch(26, `/estudos/${meu}/apelo-comercial/documentos/${docOutro}/remover`);
    assert.equal(r.status, 404);
    assert.equal(r.j.codigo, 'DOCUMENTO_NAO_ENCONTRADO');
    assert.equal(dados.existe('apelo_comercial_documentos', docOutro), true);
  });
});

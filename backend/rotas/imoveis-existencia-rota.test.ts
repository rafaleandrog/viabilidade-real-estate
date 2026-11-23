import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasImoveisEstudo } from './imoveis-estudo.js';

// Vincular imóvel confere que ele existe no módulo imobiliário (req.modulos.imobiliario
// .buscarPorChave), por HTTP contra um Express real com o módulo simulado. Falha
// fechada: módulo ausente ou com falha não vincula.

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


type Modulo = { buscarPorChave: (tabela: string, campos: readonly string[], valores: any[]) => Promise<any> };
const NIVEIS: Record<number, string> = { 26: 'escrita', 30: 'escrita' };

function criarApp(dados: DadosFake, modulos: Record<string, Modulo> | undefined) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const uid = Number(req.header('x-usuario'));
    req.dados = dados;
    if (modulos) req.modulos = modulos;
    req.contexto = { nivelApp: NIVEIS[uid] ?? 'nenhuma', usuario: { id: uid, nome: `U${uid}` } };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasImoveisEstudo);
  return app;
}

async function post(dados: DadosFake, modulos: Record<string, Modulo> | undefined, uid: number, estudoId: number, corpo: unknown) {
  const server = criarApp(dados, modulos).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/estudos/${estudoId}/imoveis`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-usuario': String(uid) }, body: JSON.stringify(corpo),
    });
    return { status: r.status, j: await r.json() };
  } finally { await new Promise<void>((r) => server.close(() => r())); }
}

function estudo(dados: DadosFake, tipo: 'incorporacao' | 'loteamento' = 'incorporacao', status = 'rascunho') {
  const id = dados.semear('estudos', { status, nivel_analise: 'preliminar', tipo_empreendimento: tipo, nome: 'e' });
  dados.semear('estudo_membros', { estudo_id: id, usuario_id: 26, funcao: 'editor' });
  return id;
}

function modulo(existentes: number[], chamadas: Array<{ tabela: string; campos: readonly string[]; valores: any[] }> = []): Record<string, Modulo> {
  return { imobiliario: { async buscarPorChave(tabela, campos, valores) {
    chamadas.push({ tabela, campos, valores });
    const achados = new Map<string, any>();
    for (const v of valores) if (existentes.includes(v.id)) achados.set(String(v.id), { id: v.id });
    return { achados };
  } } };
}

const vinculos = (d: DadosFake) => d.tabelas.get('estudo_imoveis')?.size ?? 0;

test('imóvel existente no módulo: 201 e vincula', async () => {
  const dados = new DadosFake(); const e = estudo(dados);
  const r = await post(dados, modulo([77]), 26, e, { imovel_nucleo_id: 77 });
  assert.equal(r.status, 201, JSON.stringify(r.j));
  assert.equal(vinculos(dados), 1);
});

test('imóvel inexistente: 404 IMOVEL_NAO_ENCONTRADO e nada gravado', async () => {
  const dados = new DadosFake(); const e = estudo(dados);
  const r = await post(dados, modulo([1]), 26, e, { imovel_nucleo_id: 77 });
  assert.equal(r.status, 404); assert.equal(r.j.codigo, 'IMOVEL_NAO_ENCONTRADO');
  assert.equal(vinculos(dados), 0);
});

test('helper lança: 502 MODULO_FALHOU e nada gravado', async () => {
  const dados = new DadosFake(); const e = estudo(dados);
  const m: Record<string, Modulo> = { imobiliario: { buscarPorChave: async () => { throw new Error('banco fora'); } } };
  const r = await post(dados, m, 26, e, { imovel_nucleo_id: 77 });
  assert.equal(r.status, 502); assert.equal(r.j.codigo, 'MODULO_FALHOU');
  assert.equal(vinculos(dados), 0);
});

test('sem req.modulos (ou sem o helper imobiliario): 502 MODULO_INDISPONIVEL e nada gravado', async () => {
  const dados = new DadosFake(); const e = estudo(dados);
  for (const m of [undefined, {} as Record<string, Modulo>]) {
    const r = await post(dados, m, 26, e, { imovel_nucleo_id: 77 });
    assert.equal(r.status, 502); assert.equal(r.j.codigo, 'MODULO_INDISPONIVEL');
  }
  assert.equal(vinculos(dados), 0);
});

test('erro de flag do módulo devolve o status e o código dele, sem vincular', async () => {
  const dados = new DadosFake(); const e = estudo(dados);
  const erroFlag = Object.assign(new Error('flag desligada'), { name: 'ErroFlagNucleoApp', status: 403, codigo: 'NUCLEO_FLAG_DESLIGADA' });
  const m: Record<string, Modulo> = { imobiliario: { buscarPorChave: async () => { throw erroFlag; } } };
  const r = await post(dados, m, 26, e, { imovel_nucleo_id: 77 });
  assert.equal(r.status, 403); assert.equal(r.j.codigo, 'NUCLEO_FLAG_DESLIGADA');
  assert.equal(vinculos(dados), 0);
});

test('a tabela consultada é glebas no loteamento e lotes na incorporação, pela chave id', async () => {
  const dados = new DadosFake(); const chamadas: Array<{ tabela: string; campos: readonly string[]; valores: any[] }> = [];
  const lot = estudo(dados, 'loteamento'); const inc = estudo(dados, 'incorporacao');
  await post(dados, modulo([5], chamadas), 26, lot, { imovel_nucleo_id: 5 });
  await post(dados, modulo([6], chamadas), 26, inc, { imovel_nucleo_id: 6 });
  assert.deepEqual(chamadas.map((c) => c.tabela), ['glebas', 'lotes']);
  assert.deepEqual(chamadas[0].campos, ['id']);
  assert.deepEqual(chamadas[0].valores, [{ id: 5 }]);
});

test('ordem: quem não é membro recebe 403 e o módulo nem é consultado; fora de Rascunho, 422 antes da existência', async () => {
  const dados = new DadosFake(); const chamadas: Array<{ tabela: string; campos: readonly string[]; valores: any[] }> = [];
  const e = estudo(dados); const travado = estudo(dados, 'incorporacao', 'em_analise');
  const r = await post(dados, modulo([], chamadas), 30, e, { imovel_nucleo_id: 77 });
  assert.equal(r.status, 403);
  const t = await post(dados, modulo([], chamadas), 26, travado, { imovel_nucleo_id: 77 });
  assert.equal(t.status, 422); assert.equal(t.j.codigo, 'IMOVEL_TRAVADO');
  assert.equal(chamadas.length, 0);
});

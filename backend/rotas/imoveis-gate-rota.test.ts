import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos } from './estudos.js';
import { rotasImoveisEstudo } from './imoveis-estudo.js';

// #871 — quem NÃO é membro de um estudo não pode ler o status dele pela
// diferença entre as respostas. Antes, vincular/desvincular imóvel testava o
// status (422 IMOVEL_TRAVADO fora de Rascunho) antes da permissão (403), e a
// exclusão do estudo devolvia um texto de 403 diferente fora de Rascunho. O id do
// estudo é sequencial, então bastava varrer ids. Este arquivo prova, por HTTP
// contra um Express real, que as respostas são IGUAIS nos dois status para quem
// não é membro, e que o gate de status continua valendo para o membro.

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

// 26 = editor (nível escrita, membro editor); 30 = escrita, NÃO membro;
// 27 = leitura, membro leitor; 28 = admin do app, NÃO membro.
const NIVEIS: Record<number, string> = { 26: 'escrita', 27: 'leitura', 28: 'admin', 30: 'escrita' };

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
  for (const r of [rotasEstudos, rotasImoveisEstudo]) app.use(r);
  return app;
}

type Chamada = (uid: number, metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; j: any }>;
async function comServidor(dados: DadosFake, fn: (chamar: Chamada) => Promise<void>) {
  const server = criarApp(dados).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  const chamar: Chamada = async (uid, metodo, caminho, corpo = {}) => {
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(uid) }, body: JSON.stringify(corpo),
    });
    return { status: r.status, j: await r.json() };
  };
  try { await fn(chamar); } finally { await new Promise<void>((r) => server.close(() => r())); }
}

function estudo(dados: DadosFake, status: string) {
  const id = dados.semear('estudos', { status, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao', nome: 'e' });
  dados.semear('estudo_membros', { estudo_id: id, usuario_id: 26, funcao: 'editor' });
  dados.semear('estudo_membros', { estudo_id: id, usuario_id: 27, funcao: 'leitor' });
  const vinculo = dados.semear('estudo_imoveis', { estudo_id: id, imovel_nucleo_id: 9, tipo_imovel: 'lote' });
  return { id, vinculo };
}

test('#871: para quem não é membro, vincular, desvincular e excluir respondem igual em Rascunho e fora dele', async () => {
  const dados = new DadosFake();
  const rascunho = estudo(dados, 'rascunho');
  const emAnalise = estudo(dados, 'em_analise');
  await comServidor(dados, async (chamar) => {
    const rotas = (e: { id: number; vinculo: number }): [string, string, unknown][] => [
      ['POST', `/estudos/${e.id}/imoveis`, { imovel_nucleo_id: 77 }],
      ['PATCH', `/estudos/${e.id}/imoveis/${e.vinculo}/remover`, {}],
      ['DELETE', `/estudos/${e.id}/imoveis/${e.vinculo}`, {}],
      ['PATCH', `/estudos/${e.id}/remover`, {}],
    ];
    const a = rotas(rascunho); const b = rotas(emAnalise);
    for (let i = 0; i < a.length; i++) {
      const ra = await chamar(30, a[i][0], a[i][1], a[i][2]);
      const rb = await chamar(30, b[i][0], b[i][1], b[i][2]);
      assert.equal(ra.status, 403, `${a[i][0]} ${a[i][1]} → ${JSON.stringify(ra.j)}`);
      assert.deepEqual(rb, ra, `${b[i][0]} ${b[i][1]}: a resposta não pode depender do status`);
    }
    // nada foi alterado por quem não é membro
    assert.equal(dados.existe('estudo_imoveis', rascunho.vinculo), true);
    assert.equal(dados.existe('estudo_imoveis', emAnalise.vinculo), true);
    assert.equal(dados.existe('estudos', rascunho.id), true);
  });
});

test('#871: para o membro editor, o gate de status continua valendo (422 IMOVEL_TRAVADO fora de Rascunho)', async () => {
  const dados = new DadosFake();
  const emAnalise = estudo(dados, 'em_analise');
  const rascunho = estudo(dados, 'rascunho');
  await comServidor(dados, async (chamar) => {
    const vincular = await chamar(26, 'POST', `/estudos/${emAnalise.id}/imoveis`, { imovel_nucleo_id: 77 });
    assert.equal(vincular.status, 422); assert.equal(vincular.j.codigo, 'IMOVEL_TRAVADO');
    const desvincular = await chamar(26, 'PATCH', `/estudos/${emAnalise.id}/imoveis/${emAnalise.vinculo}/remover`);
    assert.equal(desvincular.status, 422); assert.equal(desvincular.j.codigo, 'IMOVEL_TRAVADO');
    assert.equal(dados.existe('estudo_imoveis', emAnalise.vinculo), true);
    // em Rascunho o editor desvincula
    assert.equal((await chamar(26, 'PATCH', `/estudos/${rascunho.id}/imoveis/${rascunho.vinculo}/remover`)).status, 200);
    // e o membro editor ainda recebe a mensagem específica ao tentar excluir fora de Rascunho
    const excluir = await chamar(26, 'PATCH', `/estudos/${emAnalise.id}/remover`);
    assert.equal(excluir.status, 403);
    assert.match(excluir.j.mensagem, /Fora de Rascunho/);
  });
});

test('#871: o leitor também recebe a mesma resposta em Rascunho e Arquivado (os dois ocultos a ele)', async () => {
  const dados = new DadosFake();
  const rascunho = estudo(dados, 'rascunho');
  const arquivado = estudo(dados, 'arquivado');
  await comServidor(dados, async (chamar) => {
    for (const [m, sufixo, corpo] of [
      ['POST', 'imoveis', { imovel_nucleo_id: 77 }],
      ['PATCH', 'remover', {}],
    ] as [string, string, unknown][]) {
      const ra = await chamar(27, m, `/estudos/${rascunho.id}/${sufixo}`, corpo);
      const rb = await chamar(27, m, `/estudos/${arquivado.id}/${sufixo}`, corpo);
      assert.equal(ra.status, 403, `${m} ${sufixo} → ${JSON.stringify(ra.j)}`);
      assert.deepEqual(rb, ra, `${m} ${sufixo}: a resposta ao leitor não pode depender do status`);
    }
    const da = await chamar(27, 'PATCH', `/estudos/${rascunho.id}/imoveis/${rascunho.vinculo}/remover`);
    const db = await chamar(27, 'PATCH', `/estudos/${arquivado.id}/imoveis/${arquivado.vinculo}/remover`);
    assert.equal(da.status, 403); assert.deepEqual(db, da);
    assert.equal(dados.existe('estudos', rascunho.id), true);
  });
});

test('#871: o admin do app, sem ser membro, segue desvinculando em Rascunho e excluindo em qualquer status', async () => {
  const dados = new DadosFake();
  const rascunho = estudo(dados, 'rascunho');
  const emAnalise = estudo(dados, 'em_analise');
  await comServidor(dados, async (chamar) => {
    assert.equal((await chamar(28, 'PATCH', `/estudos/${rascunho.id}/imoveis/${rascunho.vinculo}/remover`)).status, 200);
    const travado = await chamar(28, 'PATCH', `/estudos/${emAnalise.id}/imoveis/${emAnalise.vinculo}/remover`);
    assert.equal(travado.status, 422); assert.equal(travado.j.codigo, 'IMOVEL_TRAVADO');
    assert.equal((await chamar(28, 'PATCH', `/estudos/${emAnalise.id}/remover`)).status, 200);
    assert.equal(dados.existe('estudos', emAnalise.id), false);
  });
});

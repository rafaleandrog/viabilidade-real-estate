import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasMembrosEstudo } from './membros-estudo.js';
import { rotasEstudos } from './estudos.js';

// #861 — PROVA DE FIAÇÃO, de ponta a ponta por HTTP. As regras moram em
// `frontend/membros-regras.ts` e têm teste próprio; este arquivo prova que as
// ROTAS as chamam (classe de defeito nº 1 do CLAUDE.md: a função pura testada
// e o handler que nunca a chama). Cada caso repete, contra um Express real com
// o `req.dados` em memória, a sequência que a QA reproduziu na Pinguim em
// 2026-11-12 — e que antes deste PR devolvia 200 em cada passo.

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
  membros(estudoId: number) {
    return [...(this.tabelas.get('estudo_membros')?.values() ?? [])].filter((m) => m.estudo_id === estudoId);
  }
}

// Nível de cada usuário no app — o que `req.shell.nivelEfetivoUsuario` responde.
const NIVEIS: Record<number, string> = { 26: 'escrita', 27: 'leitura', 28: 'admin', 29: 'escrita' };

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const uid = Number(req.header('x-usuario'));
    req.dados = dados;
    req.contexto = { nivelApp: NIVEIS[uid] ?? 'nenhuma', usuario: { id: uid, nome: `U${uid}` } };
    req.shell = { nivelEfetivoUsuario: async (id: number) => NIVEIS[id] ?? 'nenhuma' };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasMembrosEstudo);
  app.use(rotasEstudos);
  return app;
}

async function comServidor(dados: DadosFake, fn: (chamar: (uid: number, metodo: string, caminho: string, corpo?: any) => Promise<{ status: number; j: any }>) => Promise<void>) {
  const server = criarApp(dados).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  const chamar = async (uid: number, metodo: string, caminho: string, corpo?: any) => {
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-usuario': String(uid) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: r.status, j: await r.json() };
  };
  try { await fn(chamar); } finally { await new Promise<void>((r) => server.close(() => r())); }
}

function estudoComMembros(dados: DadosFake, membros: [number, string][]) {
  const id = dados.semear('estudos', { status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'loteamento', nome: 'e' });
  for (const [u, f] of membros) dados.semear('estudo_membros', { estudo_id: id, usuario_id: u, funcao: f });
  return id;
}

test('#861 porta 1: editor não se promove a aprovador e não aprova o próprio estudo', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[26, 'editor']]);
  dados.tabelas.get('estudos')!.get(e).status = 'em_analise';
  await comServidor(dados, async (chamar) => {
    const prom = await chamar(26, 'PATCH', `/estudos/${e}/membros/26`, { funcao: 'aprovador' });
    assert.equal(prom.status, 403);
    assert.equal(prom.j.codigo, 'AUTOPROMOCAO');
    assert.equal(dados.membros(e)[0].funcao, 'editor', 'a linha não mudou');
    const apr = await chamar(26, 'POST', `/estudos/${e}/status`, { status: 'aprovado' });
    assert.equal(apr.status, 403);
  });
});

test('#861: linha `aprovador` gravada para usuário de escrita não aprova (defesa para dado antigo)', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[26, 'aprovador']]);
  dados.tabelas.get('estudos')!.get(e).status = 'em_analise';
  await comServidor(dados, async (chamar) => {
    assert.equal((await chamar(26, 'POST', `/estudos/${e}/status`, { status: 'aprovado' })).status, 403);
  });
});

test('#861 porta 2: o último responsável não sai, e estudo vazio não abre para quem tem escrita', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[28, 'editor']]);
  await comServidor(dados, async (chamar) => {
    // o admin do app é o único membro: sair deixaria o estudo vazio
    const sai = await chamar(28, 'PATCH', `/estudos/${e}/membros/28/remover`, {});
    assert.equal(sai.status, 422);
    assert.equal(sai.j.codigo, 'ULTIMO_RESPONSAVEL');
    assert.equal(dados.membros(e).length, 1);
  });
  // Mesmo que um estudo chegue vazio por outro caminho, o atalho `semMembros`
  // não existe mais: o não-membro com escrita não lê nem se adiciona.
  const vazio = estudoComMembros(dados, []);
  await comServidor(dados, async (chamar) => {
    assert.equal((await chamar(29, 'GET', `/estudos/${vazio}`)).status, 403);
    assert.equal((await chamar(29, 'GET', `/estudos/${vazio}/membros`)).status, 403);
    const add = await chamar(29, 'POST', `/estudos/${vazio}/membros`, { usuario_id: 29, funcao: 'aprovador' });
    assert.equal(add.status, 403);
    // Caso que só o atalho deixaria passar: as regras de concessão aceitariam
    // um editor pondo OUTRO usuário como leitor — então o 403 aqui prova que o
    // não-membro não vira editor do estudo vazio (`exigirEditor`), e não que a
    // concessão o barrou por outro motivo.
    const outro = await chamar(29, 'POST', `/estudos/${vazio}/membros`, { usuario_id: 27, funcao: 'leitor' });
    assert.equal(outro.status, 403);
    assert.equal(outro.j.codigo, 'SEM_PERMISSAO');
    assert.equal(dados.membros(vazio).length, 0);
    // o admin do app continua entrando, e re-adiciona quem precisar
    assert.equal((await chamar(28, 'POST', `/estudos/${vazio}/membros`, { usuario_id: 29, funcao: 'editor' })).status, 200);
  });
});

test('#861: editor não concede aprovador; aprovador (admin) concede; nível do alvo é o teto', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[26, 'editor']]);
  await comServidor(dados, async (chamar) => {
    const r1 = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 28, funcao: 'aprovador' });
    assert.equal(r1.j.codigo, 'FUNCAO_ACIMA_DO_ATOR');
    // leitura não comporta editor
    const r2 = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 27, funcao: 'editor' });
    assert.equal(r2.status, 422);
    assert.equal(r2.j.codigo, 'NIVEL_INSUFICIENTE');
    // usuário inexistente → 422, não 500
    const r3 = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 99999999, funcao: 'leitor' });
    assert.equal(r3.status, 422);
    // usuario_id não inteiro → 400, não 500
    assert.equal((await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 'abc', funcao: 'leitor' })).status, 400);
    assert.equal((await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: -1, funcao: 'leitor' })).status, 400);
    // caminho feliz do editor
    assert.equal((await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 27, funcao: 'leitor' })).status, 200);
    // admin do app concede aprovador a quem tem admin; escrita não comporta
    assert.equal((await chamar(28, 'POST', `/estudos/${e}/membros`, { usuario_id: 29, funcao: 'aprovador' })).j.codigo, 'NIVEL_INSUFICIENTE');
    assert.equal((await chamar(28, 'POST', `/estudos/${e}/membros`, { usuario_id: 28, funcao: 'aprovador' })).status, 200);
    // e o editor não remove nem rebaixa esse aprovador
    assert.equal((await chamar(26, 'PATCH', `/estudos/${e}/membros/28/remover`, {})).j.codigo, 'FUNCAO_ACIMA_DO_ATOR');
    assert.equal((await chamar(26, 'PATCH', `/estudos/${e}/membros/28`, { funcao: 'leitor' })).j.codigo, 'FUNCAO_ACIMA_DO_ATOR');
    // com o aprovador presente, o editor pode sair
    assert.equal((await chamar(26, 'PATCH', `/estudos/${e}/membros/26/remover`, {})).status, 200);
  });
});

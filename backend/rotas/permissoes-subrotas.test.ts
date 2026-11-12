import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasApelo } from './apelo-comercial.js';
import { rotasMembrosEstudo, recusaAlteracaoMembro } from './membros-estudo.js';
import { rotasEstudos } from './estudos.js';
import { rotasPreliminarProdutos } from './preliminar-produtos.js';
import { rotasEmpreendimento } from './empreendimento.js';
import { rotasImoveisEstudo } from './imoveis-estudo.js';
import { rotasAnaliseMercado } from './analise-mercado.js';
import { leituraBloqueadaPorStatus, escritaExigeAprovador } from '../permissoes-estudo.js';

// Autorização por estudo nas SUB-ROTAS — teste de rota, com Express real e um
// `req.dados` em memória, porque o defeito morava na FIAÇÃO (o handler não
// carregava o estudo), não numa função pura. Cada caso abaixo foi reproduzido
// antes do conserto: na instância de homologação, (1) e (4); executando estas
// mesmas rotas, os demais.

interface Linha { id: number; [k: string]: any }

function montarBanco() {
  const db: Record<string, Linha[]> = {
    estudos: [
      { id: 1, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
      { id: 2, status: 'aprovado', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
      { id: 3, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
      { id: 4, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao', removido_em: '2026-11-01' },
    ],
    estudo_membros: [
      { id: 10, estudo_id: 1, usuario_id: 7, funcao: 'editor' },
      { id: 11, estudo_id: 2, usuario_id: 7, funcao: 'editor' },
      { id: 12, estudo_id: 3, usuario_id: 99, funcao: 'editor' },
      { id: 13, estudo_id: 4, usuario_id: 7, funcao: 'editor' },
      { id: 14, estudo_id: 1, usuario_id: 8, funcao: 'leitor' },
      { id: 15, estudo_id: 2, usuario_id: 9, funcao: 'aprovador' },
      { id: 16, estudo_id: 1, usuario_id: 9, funcao: 'aprovador' },
    ],
    apelo_comercial: [{ id: 900, estudo_id: 3 }, { id: 901, estudo_id: 1 }],
    apelo_comercial_documentos: [{ id: 500, apelo_id: 900 }, { id: 501, apelo_id: 901 }],
    preliminar_produtos: [{ id: 70, estudo_id: 2, nome: 'x' }, { id: 71, estudo_id: 4, nome: 'y' }, { id: 72, estudo_id: 1, nome: 'z' }],
    estudo_imoveis: [],
    estudo_documentos: [],
  };
  const vivo = (t: string, r: Linha) => !(t === 'estudos' && r.removido_em);
  const casa = (r: Linha, f: Record<string, any> = {}) => Object.entries(f).every(([k, v]) => r[k] === v);
  let seq = 5000;
  const dados = {
    async listar(t: string, o: any = {}) {
      const d = (db[t] ?? []).filter((r) => vivo(t, r) && casa(r, o.filtros));
      return { dados: d.slice(0, o.por_pagina ?? 20), total: d.length };
    },
    async varrerTudo(t: string, o: any = {}) { return (db[t] ?? []).filter((r) => vivo(t, r) && casa(r, o.filtros)); },
    // Como o shell: `buscar` não devolve registro removido por soft delete.
    async buscar(t: string, id: number) { return (db[t] ?? []).find((r) => r.id === Number(id) && vivo(t, r)) ?? null; },
    async criar(t: string, v: any) { const r = { id: seq++, ...v }; (db[t] ??= []).push(r); return r; },
    async atualizar(t: string, id: number, v: any) {
      const r = (db[t] ?? []).find((x) => x.id === Number(id)); if (!r) return null; Object.assign(r, v); return r;
    },
    async deletar(t: string, id: number) { db[t] = (db[t] ?? []).filter((r) => r.id !== Number(id)); return true; },
    async remover(t: string, id: number) {
      const r = (db[t] ?? []).find((x) => x.id === Number(id) && vivo(t, x));
      if (!r) return null; r.removido_em = 'agora'; return r;
    },
  };
  return { db, dados };
}

async function comServidor(fn: (chamar: (m: string, p: string, corpo?: unknown, quem?: { id: number; nivel: string }) => Promise<{ status: number; corpo: any }>, db: Record<string, Linha[]>) => Promise<void>) {
  const { db, dados } = montarBanco();
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = {
      usuario: { id: Number(req.headers['x-usuario'] ?? 7), nome: 'u' },
      nivelApp: String(req.headers['x-nivel'] ?? 'escrita'),
    };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, desinscreverUsuario: async () => {} };
    next();
  });
  app.use(rotasApelo, rotasMembrosEstudo, rotasEstudos, rotasPreliminarProdutos, rotasEmpreendimento,
    rotasImoveisEstudo, rotasAnaliseMercado);
  const srv = app.listen(0);
  await new Promise((r) => srv.once('listening', r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const chamar = async (m: string, p: string, corpo?: unknown, quem = { id: 7, nivel: 'escrita' }) => {
    const r = await fetch(base + p, {
      method: m,
      headers: { 'content-type': 'application/json', 'x-usuario': String(quem.id), 'x-nivel': quem.nivel },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const txt = await r.text();
    return { status: r.status, corpo: txt ? JSON.parse(txt) : null };
  };
  try { await fn(chamar, db); } finally { srv.close(); }
}

const LEITOR = { id: 8, nivel: 'leitura' };
const APROVADOR = { id: 9, nivel: 'escrita' };
const ADMIN = { id: 50, nivel: 'admin' };

test('apelo: DELETE de documento de OUTRO estudo devolve 404 e não apaga nada', () =>
  comServidor(async (chamar, db) => {
    const r = await chamar('DELETE', '/estudos/1/apelo-comercial/documentos/500');
    assert.equal(r.status, 404);
    assert.ok(db.apelo_comercial_documentos.some((d) => d.id === 500), 'o documento do estudo 3 sobrevive');
    const ok = await chamar('DELETE', '/estudos/1/apelo-comercial/documentos/501');
    assert.equal(ok.status, 200, 'o documento do próprio estudo continua removível');
  }));

test('estudo aprovado: editor não mexe no catálogo, nem remove o estudo; aprovador sim', () =>
  comServidor(async (chamar, db) => {
    assert.equal((await chamar('PATCH', '/estudos/2/preliminar/produtos/70', { nome: 'editado' })).status, 403);
    assert.equal((await chamar('POST', '/estudos/2/preliminar/produtos', { nome: 'novo' })).status, 403);
    assert.equal((await chamar('DELETE', '/estudos/2/preliminar/produtos/70')).status, 403);
    assert.equal((await chamar('POST', '/estudos/2/apelo-comercial/documentos', { texto_adicional: 't' })).status, 403);
    assert.equal((await chamar('PATCH', '/estudos/2/analise-mercado/regiao', { regiao_mercado_id: null })).status, 403);
    assert.equal((await chamar('DELETE', '/estudos/2')).status, 403);
    assert.equal(db.preliminar_produtos.find((p) => p.id === 70)!.nome, 'x');
    assert.ok(!db.estudos.find((e) => e.id === 2)!.removido_em);
    assert.equal((await chamar('PATCH', '/estudos/2/preliminar/produtos/70', { nome: 'pelo aprovador' }, APROVADOR)).status, 200);
  }));

test('estudo excluído: sub-rotas respondem 404 em vez de ler e gravar os filhos', () =>
  comServidor(async (chamar, db) => {
    assert.equal((await chamar('GET', '/estudos/4/preliminar/produtos')).status, 404);
    assert.equal((await chamar('PATCH', '/estudos/4/preliminar/produtos/71', { nome: 'fantasma' })).status, 404);
    assert.equal((await chamar('GET', '/estudos/4/membros')).status, 404);
    assert.equal((await chamar('POST', '/estudos/4/membros', { usuario_id: 30, funcao: 'leitor' })).status, 404);
    assert.equal((await chamar('GET', '/estudos/4/apelo-comercial')).status, 404);
    assert.equal((await chamar('GET', '/estudos/4/imoveis')).status, 404);
    assert.equal((await chamar('DELETE', '/estudos/4')).status, 404, 'excluir de novo não é 200');
    assert.equal(db.preliminar_produtos.find((p) => p.id === 71)!.nome, 'y');
  }));

test('leitor não lê sub-rotas de rascunho; admin de app lê mesmo sendo membro leitor', () =>
  comServidor(async (chamar, db) => {
    for (const p of ['/estudos/1/preliminar/produtos', '/estudos/1/membros', '/estudos/1/apelo-comercial',
      '/estudos/1/analise-mercado', '/estudos/1/imoveis', '/estudos/1/empreendimento/documentos', '/estudos/1']) {
      assert.equal((await chamar('GET', p, undefined, LEITOR)).status, 403, p);
    }
    db.estudo_membros.push({ id: 99, estudo_id: 1, usuario_id: ADMIN.id, funcao: 'leitor' });
    assert.equal((await chamar('GET', '/estudos/1/preliminar/produtos', undefined, ADMIN)).status, 200);
    assert.equal((await chamar('GET', '/estudos/1', undefined, ADMIN)).status, 200);
  }));

test('membros: editor não se promove nem concede/retira aprovador; não remove o último membro', () =>
  comServidor(async (chamar, db) => {
    const r1 = await chamar('PATCH', '/estudos/1/membros/7', { funcao: 'aprovador' });
    assert.equal(r1.status, 403);
    assert.equal(r1.corpo.codigo, 'PROPRIA_FUNCAO');
    assert.equal((await chamar('POST', '/estudos/1/membros', { usuario_id: 30, funcao: 'aprovador' })).status, 403);
    assert.equal((await chamar('PATCH', '/estudos/1/membros/8', { funcao: 'aprovador' })).status, 403);
    assert.equal((await chamar('PATCH', '/estudos/1/membros/9', { funcao: 'leitor' })).status, 403, 'rebaixar aprovador');
    assert.equal((await chamar('PATCH', '/estudos/1/membros/9/remover')).status, 403, 'remover aprovador');
    assert.equal(db.estudo_membros.find((m) => m.id === 10)!.funcao, 'editor');
    assert.equal(db.estudo_membros.find((m) => m.id === 16)!.funcao, 'aprovador');
    // O que continua permitido ao editor.
    assert.equal((await chamar('POST', '/estudos/1/membros', { usuario_id: 30, funcao: 'leitor' })).status, 200);
    assert.equal((await chamar('PATCH', '/estudos/1/membros/8', { funcao: 'editor' })).status, 200);
    // O aprovador concede aprovador.
    assert.equal((await chamar('PATCH', '/estudos/1/membros/8', { funcao: 'aprovador' }, APROVADOR)).status, 200);
    // Último membro: estudo 3 só tem o usuário 99.
    const r2 = await chamar('PATCH', '/estudos/3/membros/99/remover', undefined, ADMIN);
    assert.equal(r2.status, 422);
    assert.equal(r2.corpo.codigo, 'ULTIMO_MEMBRO');
  }));

test('regras puras: status e alteração de membro', () => {
  assert.equal(leituraBloqueadaPorStatus('rascunho', { ehLeitor: true, ehAdminApp: false }), true);
  assert.equal(leituraBloqueadaPorStatus('arquivado', { ehLeitor: true, ehAdminApp: false }), true);
  assert.equal(leituraBloqueadaPorStatus('em_analise', { ehLeitor: true, ehAdminApp: false }), false);
  assert.equal(leituraBloqueadaPorStatus('rascunho', { ehLeitor: true, ehAdminApp: true }), false);
  assert.equal(leituraBloqueadaPorStatus('rascunho', { ehLeitor: false, ehAdminApp: false }), false);
  for (const s of ['aprovado', 'reprovado', 'arquivado']) assert.equal(escritaExigeAprovador(s), true, s);
  for (const s of ['rascunho', 'em_analise']) assert.equal(escritaExigeAprovador(s), false, s);
  const editor = { ehAprovador: false, ehAdminApp: false };
  assert.equal(recusaAlteracaoMembro({ perm: editor, usuarioAtual: 1, alvo: 2, funcaoAtualAlvo: 'leitor', funcaoNova: 'editor', totalMembros: 3 }), null);
  assert.equal(recusaAlteracaoMembro({ perm: editor, usuarioAtual: 1, alvo: 2, funcaoAtualAlvo: 'leitor', funcaoNova: null, totalMembros: 3 }), null);
  assert.equal(recusaAlteracaoMembro({ perm: { ehAprovador: false, ehAdminApp: true }, usuarioAtual: 1, alvo: 1, funcaoAtualAlvo: 'leitor', funcaoNova: 'aprovador', totalMembros: 3 }), null);
});

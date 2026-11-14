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
import { rotasAvancado } from './avancado.js';
import { rotasFunding } from './funding.js';
import { leituraBloqueadaPorStatus, escritaExigeAprovador } from '../permissoes-estudo.js';

// Autorização por estudo nas SUB-ROTAS — teste de rota, com Express real e um
// `req.dados` em memória, porque o defeito morava na FIAÇÃO (o handler não
// carregava o estudo), não numa função pura. Cada caso abaixo foi reproduzido
// antes do conserto: na instância de homologação, (1) e (4); executando estas
// mesmas rotas, os demais.
//
// O harness reproduz o gate de MÉTODO do shell (SDK, `docs/permissoes.md`):
// `GET` exige leitura, `POST`/`PATCH`/`PUT` exigem escrita e `DELETE` exige
// admin — com `403 AUTH_NIVEL_INSUFICIENTE` antes do handler. Sem ele, um caso de
// `DELETE` com nível `escrita` mediria um caminho que não existe em produção.

interface Linha { id: number; [k: string]: any }
const NIVEL_ALVO: Record<number, string> = { 8: 'leitura', 9: 'admin', 50: 'admin', 51: 'admin' };
interface Ganchos {
  antesDeDeletar?: (t: string) => Promise<void>;
  antesDeAtualizar?: (t: string) => Promise<void>;
}

function montarBanco() {
  const db: Record<string, Linha[]> = {
    estudos: [
      { id: 1, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
      { id: 2, status: 'aprovado', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
      { id: 3, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
      { id: 4, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao', removido_em: '2026-11-01' },
      { id: 5, status: 'rascunho', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
      { id: 6, status: 'rascunho', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' },
    ],
    estudo_membros: [
      { id: 10, estudo_id: 1, usuario_id: 7, funcao: 'editor' },
      { id: 11, estudo_id: 2, usuario_id: 7, funcao: 'editor' },
      { id: 12, estudo_id: 3, usuario_id: 99, funcao: 'editor' },
      { id: 13, estudo_id: 4, usuario_id: 7, funcao: 'editor' },
      { id: 14, estudo_id: 1, usuario_id: 8, funcao: 'leitor' },
      { id: 15, estudo_id: 2, usuario_id: 9, funcao: 'aprovador' },
      { id: 16, estudo_id: 1, usuario_id: 9, funcao: 'aprovador' },
      { id: 17, estudo_id: 5, usuario_id: 7, funcao: 'editor' },
      { id: 18, estudo_id: 5, usuario_id: 8, funcao: 'leitor' },
      { id: 19, estudo_id: 6, usuario_id: 7, funcao: 'editor' },
      { id: 20, estudo_id: 6, usuario_id: 9, funcao: 'editor' },
    ],
    apelo_comercial: [{ id: 900, estudo_id: 3 }, { id: 901, estudo_id: 1 }],
    apelo_comercial_documentos: [{ id: 500, apelo_id: 900 }, { id: 501, apelo_id: 901 }],
    preliminar_produtos: [{ id: 70, estudo_id: 2, nome: 'x' }, { id: 71, estudo_id: 4, nome: 'y' }, { id: 72, estudo_id: 1, nome: 'z' }],
    estudo_imoveis: [],
    estudo_documentos: [],
    avancado_linhas_custo: [],
    avancado_funding_operacoes: [],
  };
  const vivo = (t: string, r: Linha) => !(t === 'estudos' && r.removido_em);
  const casa = (r: Linha, f: Record<string, any> = {}) => Object.entries(f).every(([k, v]) => r[k] === v);
  let seq = 5000;
  const ganchos: Ganchos = {};
  const dados = {
    async listar(t: string, o: any = {}) {
      // Cede o event loop antes de ler, como um banco real: é o que deixa duas
      // requisições simultâneas intercalarem leitura e escrita.
      await new Promise((r) => setTimeout(r, 2));
      const d = (db[t] ?? []).filter((r) => vivo(t, r) && casa(r, o.filtros));
      return { dados: d.slice(0, o.por_pagina ?? 20), total: d.length };
    },
    async varrerTudo(t: string, o: any = {}) { return (db[t] ?? []).filter((r) => vivo(t, r) && casa(r, o.filtros)); },
    // Como o shell: `buscar` não devolve registro removido por soft delete.
    async buscar(t: string, id: number) { return (db[t] ?? []).find((r) => r.id === Number(id) && vivo(t, r)) ?? null; },
    async criar(t: string, v: any) {
      if (t === 'estudo_membros' && (db[t] ?? []).some((m) => m.estudo_id === v.estudo_id && m.usuario_id === v.usuario_id)) {
        throw new Error('duplicate key value violates unique constraint (estudo_id, usuario_id)');
      }
      const r = { id: seq++, ...v }; (db[t] ??= []).push(r); return r;
    },
    async atualizar(t: string, id: number, v: any) {
      await ganchos.antesDeAtualizar?.(t);
      const r = (db[t] ?? []).find((x) => x.id === Number(id)); if (!r) return null; Object.assign(r, v); return r;
    },
    async deletar(t: string, id: number) {
      await ganchos.antesDeDeletar?.(t);
      db[t] = (db[t] ?? []).filter((r) => r.id !== Number(id)); return true;
    },
    async remover(t: string, id: number) {
      const r = (db[t] ?? []).find((x) => x.id === Number(id) && vivo(t, x));
      if (!r) return null; r.removido_em = 'agora'; return r;
    },
  };
  return { db, dados, ganchos };
}

async function comServidor(fn: (chamar: (m: string, p: string, corpo?: unknown, quem?: { id: number; nivel: string }) => Promise<{ status: number; corpo: any }>, db: Record<string, Linha[]>, ganchos: Ganchos) => Promise<void>) {
  const { db, dados, ganchos } = montarBanco();
  const app = express();
  app.use(express.json());
  app.use((req: any, res, next) => {
    const nivel = String(req.headers['x-nivel'] ?? 'escrita');
    const ordem = ['leitura', 'escrita', 'admin'];
    const minimo = req.method === 'DELETE' ? 'admin' : req.method === 'GET' ? 'leitura' : 'escrita';
    if (ordem.indexOf(nivel) < ordem.indexOf(minimo)) {
      res.status(403).json({ erro: true, codigo: 'AUTH_NIVEL_INSUFICIENTE' }); return;
    }
    req.dados = dados;
    req.contexto = {
      usuario: { id: Number(req.headers['x-usuario'] ?? 7), nome: 'u' },
      nivelApp: String(req.headers['x-nivel'] ?? 'escrita'),
    };
    // Nível do usuário-ALVO no app, como `req.shell.nivelEfetivoUsuario` responde:
    // é o teto da função que ele recebe no estudo. Quem não está no mapa tem `escrita`.
    req.shell = { nivelEfetivoUsuario: async (id: number) => NIVEL_ALVO[id] ?? 'escrita' };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, desinscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasApelo, rotasMembrosEstudo, rotasEstudos, rotasPreliminarProdutos, rotasEmpreendimento,
    rotasImoveisEstudo, rotasAnaliseMercado, rotasAvancado, rotasFunding);
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
  try { await fn(chamar, db, ganchos); } finally { srv.close(); }
}

const LEITOR = { id: 8, nivel: 'leitura' };
// `aprovador` exige `admin` no app (decisão do autor): com `escrita`, a linha
// `aprovador` do 9 valeria só como editor (ver `funcaoEfetivaDoMembro`).
const APROVADOR = { id: 9, nivel: 'admin' };
const ADMIN = { id: 50, nivel: 'admin' };

test('apelo: DELETE de documento de OUTRO estudo devolve 404 e não apaga nada', () =>
  comServidor(async (chamar, db) => {
    // `DELETE` só chega ao handler com nível admin (gate do shell).
    assert.equal((await chamar('DELETE', '/estudos/1/apelo-comercial/documentos/500')).corpo.codigo, 'AUTH_NIVEL_INSUFICIENTE');
    const r = await chamar('DELETE', '/estudos/1/apelo-comercial/documentos/500', undefined, ADMIN);
    assert.equal(r.status, 404);
    assert.ok(db.apelo_comercial_documentos.some((d) => d.id === 500), 'o documento do estudo 3 sobrevive');
    const ok = await chamar('DELETE', '/estudos/1/apelo-comercial/documentos/501', undefined, ADMIN);
    assert.equal(ok.status, 200, 'o documento do próprio estudo continua removível');
  }));

test('estudo aprovado: editor não mexe no catálogo, apelo, região nem membros; aprovador sim', () =>
  comServidor(async (chamar, db) => {
    assert.equal((await chamar('PATCH', '/estudos/2/preliminar/produtos/70', { nome: 'editado' })).status, 403);
    assert.equal((await chamar('POST', '/estudos/2/preliminar/produtos', { nome: 'novo' })).status, 403);
    assert.equal((await chamar('POST', '/estudos/2/apelo-comercial/documentos', { texto_adicional: 't' })).status, 403);
    assert.equal((await chamar('PATCH', '/estudos/2/analise-mercado/regiao', { regiao_mercado_id: null })).status, 403);
    assert.equal((await chamar('POST', '/estudos/2/membros', { usuario_id: 30, funcao: 'leitor' })).status, 403);
    assert.equal(db.preliminar_produtos.find((p) => p.id === 70)!.nome, 'x');
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
    assert.equal((await chamar('DELETE', '/estudos/4', undefined, ADMIN)).status, 404, 'excluir de novo não é 200');
    assert.equal(db.preliminar_produtos.find((p) => p.id === 71)!.nome, 'y');
  }));

test('leitor não lê sub-rotas de rascunho; admin de app lê mesmo sendo membro leitor', () =>
  comServidor(async (chamar, db) => {
    for (const p of ['/estudos/1/preliminar/produtos', '/estudos/1/membros', '/estudos/1/apelo-comercial',
      '/estudos/1/analise-mercado', '/estudos/1/imoveis', '/estudos/1/empreendimento/documentos', '/estudos/1']) {
      assert.equal((await chamar('GET', p, undefined, LEITOR)).status, 403, p);
    }
    // Avançado e Funding: mesma regra, pelos helpers próprios deles.
    assert.equal((await chamar('GET', '/estudos/5/avancado/custos', undefined, LEITOR)).status, 403);
    assert.equal((await chamar('GET', '/estudos/5/avancado/funding', undefined, LEITOR)).status, 403);
    assert.equal((await chamar('GET', '/estudos/5/avancado/custos')).status, 200, 'o editor lê');
    assert.equal((await chamar('GET', '/estudos/5/avancado/funding')).status, 200, 'o editor lê');
    db.estudos.find((e) => e.id === 5)!.status = 'em_analise';
    assert.equal((await chamar('GET', '/estudos/5/avancado/custos', undefined, LEITOR)).status, 200, 'o leitor lê fora do rascunho');
    assert.equal((await chamar('GET', '/estudos/5/avancado/funding', undefined, LEITOR)).status, 200, 'o leitor lê fora do rascunho');
    db.estudo_membros.push({ id: 99, estudo_id: 1, usuario_id: ADMIN.id, funcao: 'leitor' });
    assert.equal((await chamar('GET', '/estudos/1/preliminar/produtos', undefined, ADMIN)).status, 200);
    assert.equal((await chamar('GET', '/estudos/1', undefined, ADMIN)).status, 200);
  }));

test('membros: editor não se promove nem concede/retira aprovador; não deixa o estudo sem responsável', () =>
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
    // ...dentro do nível do alvo: o 8 tem só `leitura` no app e não vira editor.
    const r4 = await chamar('PATCH', '/estudos/1/membros/8', { funcao: 'editor' });
    assert.equal(r4.status, 422);
    assert.equal(r4.corpo.codigo, 'NIVEL_INSUFICIENTE');
    assert.equal((await chamar('PATCH', '/estudos/1/membros/30', { funcao: 'editor' })).status, 200);
    // O aprovador concede aprovador — a quem tem `admin` no app.
    assert.equal((await chamar('POST', '/estudos/1/membros', { usuario_id: 51, funcao: 'aprovador' }, APROVADOR)).status, 200);
    // Último responsável: estudo 3 só tem o editor 99 — nem o admin o remove nem o rebaixa.
    const r2 = await chamar('PATCH', '/estudos/3/membros/99/remover', undefined, ADMIN);
    assert.equal(r2.status, 422);
    assert.equal(r2.corpo.codigo, 'ULTIMO_RESPONSAVEL');
    const r3 = await chamar('PATCH', '/estudos/3/membros/99', { funcao: 'leitor' }, ADMIN);
    assert.equal(r3.status, 422);
    assert.equal(r3.corpo.codigo, 'ULTIMO_RESPONSAVEL');
    assert.equal(db.estudo_membros.find((m) => m.id === 12)!.funcao, 'editor');
  }));

test('estudo sem membros: só o admin do app entra (não há mais atalho para quem tem escrita)', () =>
  comServidor(async (chamar, db) => {
    db.estudo_membros = db.estudo_membros.filter((m) => m.estudo_id !== 3);
    assert.equal((await chamar('GET', '/estudos/3')).status, 403);
    assert.equal((await chamar('GET', '/estudos/3/preliminar/produtos')).status, 403);
    assert.equal((await chamar('POST', '/estudos/3/membros', { usuario_id: 7, funcao: 'aprovador' })).status, 403);
    assert.equal((await chamar('POST', '/estudos/3/status', { status: 'em_analise' })).status, 403);
    assert.ok(!db.estudo_membros.some((m) => m.estudo_id === 3), 'ninguém se incluiu');
    const r = await chamar('POST', '/estudos/3/membros', { usuario_id: 7, funcao: 'editor' }, ADMIN);
    assert.equal(r.status, 200, 'o admin re-adiciona quem precisar');
  }));

test('membros: duas remoções simultâneas não deixam o estudo sem responsável', () =>
  comServidor(async (chamar, db, ganchos) => {
    // Estudo 6: dois editores, sem aprovador. Cada um remove o outro ao mesmo tempo.
    // A barreira força a pior intercalação: nenhum `deletar` de membro acontece
    // antes de as DUAS requisições terem contado os membros (e visto 2).
    let chegaram = 0;
    let liberar!: () => void;
    const barreira = new Promise<void>((r) => { liberar = r; });
    ganchos.antesDeDeletar = async (t) => {
      if (t !== 'estudo_membros') return;
      chegaram++;
      if (chegaram >= 2) liberar();
      let teto: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([barreira, new Promise((r) => { teto = setTimeout(r, 2000); })]);
      clearTimeout(teto); // sem isto o timer perdedor segura o processo ~2 s no fim
    };
    const [a, b] = await Promise.all([
      chamar('PATCH', '/estudos/6/membros/9/remover', undefined, { id: 7, nivel: 'escrita' }),
      chamar('PATCH', '/estudos/6/membros/7/remover', undefined, { id: 9, nivel: 'escrita' }),
    ]);
    const restantes = db.estudo_membros.filter((m) => m.estudo_id === 6).length;
    assert.ok(restantes >= 1, `sobrou ${restantes} membro(s) — respostas ${a.status}/${b.status}`);
    assert.ok([a.status, b.status].includes(422), 'ao menos uma remoção é desfeita');
  }));

test('membros: dois rebaixamentos simultâneos a leitor não deixam o estudo sem responsável', () =>
  comServidor(async (chamar, db, ganchos) => {
    // Mesma barreira da remoção, agora no `atualizar`: nenhum rebaixamento grava
    // antes de os dois terem contado os responsáveis (e visto 2).
    let chegaram = 0;
    let liberar!: () => void;
    const barreira = new Promise<void>((r) => { liberar = r; });
    ganchos.antesDeAtualizar = async (t) => {
      if (t !== 'estudo_membros') return;
      chegaram++;
      if (chegaram >= 2) liberar();
      let teto: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([barreira, new Promise((r) => { teto = setTimeout(r, 2000); })]);
      clearTimeout(teto); // sem isto o timer perdedor segura o processo ~2 s no fim
    };
    const [a, b] = await Promise.all([
      chamar('PATCH', '/estudos/6/membros/9', { funcao: 'leitor' }, { id: 7, nivel: 'escrita' }),
      chamar('PATCH', '/estudos/6/membros/7', { funcao: 'leitor' }, { id: 9, nivel: 'escrita' }),
    ]);
    ganchos.antesDeAtualizar = undefined;
    const resp = db.estudo_membros.filter((m) => m.estudo_id === 6 && m.funcao !== 'leitor').length;
    assert.ok(resp >= 1, `sobrou ${resp} responsável(is) — respostas ${a.status}/${b.status}`);
    assert.ok([a.status, b.status].includes(422), 'ao menos um rebaixamento é desfeito');
  }));

test('membros: re-inclusão concorrente do removido não vira 500 nem deixa o estudo só com leitor', () =>
  comServidor(async (chamar, db, ganchos) => {
    // Estudo 3: só o editor 99. O admin tenta removê-lo (vai ser recusado pela
    // regra antes de apagar) — então forçamos o caminho da recontagem: um
    // segundo editor existe na contagem e sai ANTES da recontagem, enquanto o
    // próprio 99 é re-incluído como leitor na janela.
    db.estudo_membros.push({ id: 300, estudo_id: 3, usuario_id: 98, funcao: 'editor' });
    ganchos.antesDeDeletar = async (t) => {
      if (t !== 'estudo_membros') return;
      ganchos.antesDeDeletar = undefined;
      // Na janela: o outro editor sai, e o 99 volta como leitor.
      db.estudo_membros = db.estudo_membros.filter((m) => m.id !== 300);
      db.estudo_membros.push({ id: 301, estudo_id: 3, usuario_id: 99, funcao: 'leitor', __pendente: true });
    };
    // O fake só aplica a unicidade no `criar`, como o banco.
    const r = await chamar('PATCH', '/estudos/3/membros/99/remover', undefined, ADMIN);
    assert.equal(r.status, 422, JSON.stringify(r.corpo));
    const do99 = db.estudo_membros.filter((m) => m.estudo_id === 3 && m.usuario_id === 99);
    assert.equal(do99.length, 1, 'sem linha duplicada');
    assert.equal(do99[0].funcao, 'editor', 'o 99 volta a ser responsável');
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
  assert.equal(recusaAlteracaoMembro({ perm: editor, usuarioAtual: 1, alvo: 2, funcaoAtualAlvo: 'leitor', funcaoNova: 'editor', outrosResponsaveis: 1 }), null);
  assert.equal(recusaAlteracaoMembro({ perm: editor, usuarioAtual: 1, alvo: 2, funcaoAtualAlvo: 'leitor', funcaoNova: null, outrosResponsaveis: 0 }), null, 'remover leitor nunca é o último responsável');
  assert.equal(recusaAlteracaoMembro({ perm: editor, usuarioAtual: 1, alvo: 2, funcaoAtualAlvo: 'editor', funcaoNova: 'leitor', outrosResponsaveis: 0 })?.codigo, 'ULTIMO_RESPONSAVEL');
  assert.equal(recusaAlteracaoMembro({ perm: editor, usuarioAtual: 1, alvo: 2, funcaoAtualAlvo: 'editor', funcaoNova: null, outrosResponsaveis: 1 }), null);
  assert.equal(recusaAlteracaoMembro({ perm: { ehAprovador: false, ehAdminApp: true }, usuarioAtual: 1, alvo: 1, funcaoAtualAlvo: 'leitor', funcaoNova: 'aprovador', outrosResponsaveis: 1 }), null);
});

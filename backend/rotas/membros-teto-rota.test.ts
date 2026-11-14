import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasMembrosEstudo } from './membros-estudo.js';
import { rotasEstudos } from './estudos.js';

// Teto da função no estudo pelo nível do usuário no app — PROVA DE FIAÇÃO por
// HTTP, contra um Express real com `req.dados` em memória. As regras puras
// (`frontend/membros-regras.ts`) têm teste próprio; aqui se prova que as ROTAS
// as chamam (classe de defeito nº 1 do CLAUDE.md): o POST e o PATCH de membros
// conferem o nível do alvo, `resolverPermissaoEstudo` usa a função EFETIVA, a
// listagem publica a efetiva, e `usuario_id` inválido é 400, não 500.

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
  async criar(tabela: string, dados: Record<string, any>) {
    // Como o banco: `usuario_id` não inteiro estoura na coluna — é o 500 que o
    // parser estrito evita.
    if (tabela === 'estudo_membros' && !Number.isInteger(dados.usuario_id)) {
      throw new Error(`invalid input syntax for type integer: "${dados.usuario_id}"`);
    }
    return this.buscar(tabela, this.semear(tabela, dados));
  }
  async deletar(tabela: string, id: number) { this.tabelas.get(tabela)?.delete(Number(id)); }
  membros(estudoId: number) {
    return [...(this.tabelas.get('estudo_membros')?.values() ?? [])].filter((m) => m.estudo_id === estudoId);
  }
}

// Nível de cada usuário no app — o mesmo para `req.contexto.nivelApp` (quem
// chama) e `req.shell.nivelEfetivoUsuario` (o alvo).
const NIVEIS: Record<number, string> = { 26: 'escrita', 27: 'leitura', 28: 'admin', 29: 'escrita', 32: 'admin' };

function criarApp(dados: DadosFake, opts: { shellFalha?: boolean } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const uid = Number(req.header('x-usuario'));
    req.dados = dados;
    req.contexto = { nivelApp: NIVEIS[uid] ?? 'nenhuma', usuario: { id: uid, nome: `U${uid}` } };
    req.shell = {
      nivelEfetivoUsuario: async (id: number) => {
        if (opts.shellFalha) throw new Error('shell indisponível');
        return NIVEIS[id] ?? 'nenhuma';
      },
    };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, desinscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasMembrosEstudo);
  app.use(rotasEstudos);
  return app;
}

type Chamar = (uid: number, metodo: string, caminho: string, corpo?: any) => Promise<{ status: number; j: any }>;

async function comServidor(dados: DadosFake, fn: (chamar: Chamar) => Promise<void>, opts: { shellFalha?: boolean } = {}) {
  const server = criarApp(dados, opts).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  const chamar: Chamar = async (uid, metodo, caminho, corpo) => {
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-usuario': String(uid) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const txt = await r.text();
    return { status: r.status, j: txt ? JSON.parse(txt) : null };
  };
  try { await fn(chamar); } finally { await new Promise<void>((r) => server.close(() => r())); }
}

function estudoComMembros(dados: DadosFake, membros: [number, string][], status = 'rascunho') {
  const id = dados.semear('estudos', { status, nivel_analise: 'preliminar', tipo_empreendimento: 'loteamento', nome: 'e' });
  for (const [u, f] of membros) dados.semear('estudo_membros', { estudo_id: id, usuario_id: u, funcao: f });
  return id;
}

test('teto: linha `aprovador` de quem tem só escrita no app não aprova — vale como editor', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[29, 'aprovador']], 'em_analise');
  await comServidor(dados, async (chamar) => {
    const apr = await chamar(29, 'POST', `/estudos/${e}/status`, { status: 'aprovado' });
    assert.equal(apr.status, 403, JSON.stringify(apr.j));
    assert.equal(dados.tabelas.get('estudos')!.get(e).status, 'em_analise');
    const d = await chamar(29, 'GET', `/estudos/${e}`);
    assert.equal(d.status, 200);
    assert.equal(d.j._permissao.funcao, 'editor');
    assert.equal(d.j._permissao.podeAprovar, false);
    assert.equal(d.j._permissao.podeEditar, true);
    // com `admin` no app, a mesma linha aprova
    dados.semear('estudo_membros', { estudo_id: e, usuario_id: 32, funcao: 'aprovador' });
    assert.equal((await chamar(32, 'POST', `/estudos/${e}/status`, { status: 'aprovado' })).status, 200);
  });
});

test('teto: linha `editor` de quem tem só leitura vale como leitor (não edita, não vê rascunho)', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[26, 'editor'], [27, 'editor']], 'em_analise');
  await comServidor(dados, async (chamar) => {
    const d = await chamar(27, 'GET', `/estudos/${e}`);
    assert.equal(d.status, 200);
    assert.equal(d.j._permissao.funcao, 'leitor');
    assert.equal(d.j._permissao.podeEditar, false);
    dados.tabelas.get('estudos')!.get(e).status = 'rascunho';
    assert.equal((await chamar(27, 'GET', `/estudos/${e}`)).status, 403, 'leitor efetivo não vê rascunho');
  });
});

test('teto: GET /estudos publica a função EFETIVA e não lista o estudo quando ela é nula', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[29, 'aprovador'], [31, 'aprovador']]);
  await comServidor(dados, async (chamar) => {
    const r = await chamar(29, 'GET', '/estudos');
    assert.equal(r.status, 200);
    assert.equal(r.j.dados.find((x: any) => x.id === e)?._funcao, 'editor');
    // 31 não tem nível no app: o detalhe nega e a listagem não publica o estudo
    assert.equal((await chamar(31, 'GET', `/estudos/${e}`)).status, 403);
    assert.equal((await chamar(31, 'GET', '/estudos')).j.dados.some((x: any) => x.id === e), false);
  });
});

test('teto: POST de membro confere o nível do alvo no app (aprovador exige admin)', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[26, 'editor']]);
  await comServidor(dados, async (chamar) => {
    // leitura não comporta editor
    const r1 = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 27, funcao: 'editor' });
    assert.equal(r1.status, 422);
    assert.equal(r1.j.codigo, 'NIVEL_INSUFICIENTE');
    // usuário sem nível ou inexistente → 422, não 500
    const r2 = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 99999999, funcao: 'leitor' });
    assert.equal(r2.status, 422);
    assert.equal(r2.j.codigo, 'NIVEL_INSUFICIENTE');
    assert.equal(dados.membros(e).length, 1, 'nenhuma linha gravada');
    // caminho feliz do editor
    assert.equal((await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 27, funcao: 'leitor' })).status, 200);
    // o admin do app concede aprovador só a quem tem admin
    const r3 = await chamar(28, 'POST', `/estudos/${e}/membros`, { usuario_id: 29, funcao: 'aprovador' });
    assert.equal(r3.status, 422);
    assert.equal(r3.j.codigo, 'NIVEL_INSUFICIENTE');
    assert.equal(dados.membros(e).some((m) => m.usuario_id === 29), false);
    assert.equal((await chamar(28, 'POST', `/estudos/${e}/membros`, { usuario_id: 32, funcao: 'aprovador' })).status, 200);
    // a regra de quem concede vem antes: editor pedindo aprovador é 403
    const r4 = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: 28, funcao: 'aprovador' });
    assert.equal(r4.status, 403);
  });
});

test('teto: PATCH de membro não passa a função do nível do alvo', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[28, 'editor'], [29, 'editor'], [27, 'leitor']]);
  await comServidor(dados, async (chamar) => {
    const r = await chamar(28, 'PATCH', `/estudos/${e}/membros/29`, { funcao: 'aprovador' });
    assert.equal(r.status, 422);
    assert.equal(r.j.codigo, 'NIVEL_INSUFICIENTE');
    assert.equal(dados.membros(e).find((m) => m.usuario_id === 29).funcao, 'editor');
    const r2 = await chamar(28, 'PATCH', `/estudos/${e}/membros/27`, { funcao: 'editor' });
    assert.equal(r2.j.codigo, 'NIVEL_INSUFICIENTE');
    assert.equal(dados.membros(e).find((m) => m.usuario_id === 27).funcao, 'leitor');
    // rebaixar cabe sempre no nível
    assert.equal((await chamar(28, 'PATCH', `/estudos/${e}/membros/29`, { funcao: 'leitor' })).status, 200);
  });
});

test('usuario_id inválido no POST de membros é 400, não 500', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[26, 'editor']]);
  await comServidor(dados, async (chamar) => {
    for (const v of ['abc', -1, 0, 1.5, '1e3', '0x10', true, [27], { id: 27 }, 2147483648]) {
      const r = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: v, funcao: 'leitor' });
      assert.equal(r.status, 400, `${JSON.stringify(v)} → ${r.status} ${JSON.stringify(r.j)}`);
      assert.equal(r.j.codigo, 'USUARIO_INVALIDO', JSON.stringify(v));
    }
    for (const v of [undefined, null, '']) {
      const r = await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: v, funcao: 'leitor' });
      assert.equal(r.status, 400);
      assert.equal(r.j.codigo, 'USUARIO_OBRIGATORIO');
    }
    // string inteira estrita continua valendo
    assert.equal((await chamar(26, 'POST', `/estudos/${e}/membros`, { usuario_id: '27', funcao: 'leitor' })).status, 200);
    assert.equal(dados.membros(e).find((m) => m.usuario_id === 27)?.funcao, 'leitor');
    assert.equal(dados.membros(e).length, 2);
  });
});

test('falha fechada: se a consulta do nível do alvo lança, a concessão é 422, não 500 nem aceita', async () => {
  const dados = new DadosFake();
  const e = estudoComMembros(dados, [[28, 'editor'], [29, 'editor'], [27, 'leitor']]);
  const avisos = console.warn;
  console.warn = () => {}; // o handler registra a falha no log; aqui é esperado
  try {
    await comServidor(dados, async (chamar) => {
      const r1 = await chamar(28, 'POST', `/estudos/${e}/membros`, { usuario_id: 32, funcao: 'aprovador' });
      assert.equal(r1.status, 422, JSON.stringify(r1.j));
      assert.equal(r1.j.codigo, 'NIVEL_INSUFICIENTE');
      const r2 = await chamar(28, 'POST', `/estudos/${e}/membros`, { usuario_id: 26, funcao: 'editor' });
      assert.equal(r2.j.codigo, 'NIVEL_INSUFICIENTE');
      const r3 = await chamar(28, 'PATCH', `/estudos/${e}/membros/27`, { funcao: 'editor' });
      assert.equal(r3.status, 422);
      assert.equal(r3.j.codigo, 'NIVEL_INSUFICIENTE');
      const r4 = await chamar(28, 'PATCH', `/estudos/${e}/membros/29`, { funcao: 'aprovador' });
      assert.equal(r4.j.codigo, 'NIVEL_INSUFICIENTE');
      assert.equal(dados.membros(e).length, 3, 'nada gravado');
      assert.equal(dados.membros(e).find((m) => m.usuario_id === 27).funcao, 'leitor');
      assert.equal(dados.membros(e).find((m) => m.usuario_id === 29).funcao, 'editor');
    }, { shellFalha: true });
  } finally { console.warn = avisos; }
});

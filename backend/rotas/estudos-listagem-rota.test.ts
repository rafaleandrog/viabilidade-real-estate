import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos, ordenarEstudosRecentes } from './estudos.js';

// #909 — GET /estudos truncava em 200 (admin) e 500 (membro), e o membro fazia
// um `buscar('estudos', id)` por estudo (N+1). Teste de rota, com um Express
// real e um fake de `req.dados` que PAGINA DE VERDADE (obedece `por_pagina`
// como escrito, default 20), para que voltar a `listar` com página fixa ou a
// `buscar` por estudo derrube o teste.
//
// O contador conta as chamadas ao NÍVEL DE `req.dados` (o que a rota faz); as
// páginas internas de `varrerTudo` não entram — são o custo da plataforma, e o
// critério é que a rota não emita mais consultas quando há mais estudos.

class DadosFake {
  private tabelas = new Map<string, any[]>();
  chamadas = 0;
  // Linhas que `varrerTudo` entregou por tabela (o "volume lido do banco").
  lidas = new Map<string, number>();
  // Chamadas de `varrerTudo` que passaram `ordenar` (desliga a proteção contra INSERT).
  varridasComOrdenar: string[] = [];

  semear(tabela: string, linha: Record<string, any>) {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, []);
    this.tabelas.get(tabela)!.push({ ...linha });
  }

  private filtrar(
    tabela: string,
    opts: { filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc' },
  ) {
    const filtros = opts.filtros ?? {};
    let linhas = (this.tabelas.get(tabela) ?? []).filter((l) =>
      // Valor em array numa chave de igualdade vira IN, como no SDK real.
      Object.entries(filtros).every(([k, v]) => (Array.isArray(v) ? v.includes(l[k]) : l[k] === v)));
    if (opts.ordenar) {
      const c = opts.ordenar;
      const dir = opts.ordem === 'desc' ? -1 : 1;
      linhas = [...linhas].sort((a, b) => (a[c] === b[c] ? 0 : (a[c] > b[c] ? 1 : -1) * dir));
    }
    return linhas;
  }

  async buscar(tabela: string, id: number) {
    this.chamadas++;
    return (this.tabelas.get(tabela) ?? []).find((l) => l.id === Number(id)) ?? null;
  }

  async listar(tabela: string, opts: any = {}) {
    this.chamadas++;
    const linhas = this.filtrar(tabela, opts);
    const pagina = opts.pagina ?? 1;
    // Teto de página do fake (500), para que `por_pagina` alto trunque em vez de esconder o defeito.
    const porPagina = Math.min(opts.por_pagina ?? 20, 500);
    return { dados: linhas.slice((pagina - 1) * porPagina, pagina * porPagina), total: linhas.length };
  }

  // Devolve o ARRAY completo (o verbo real pagina em laço até esgotar).
  async varrerTudo(tabela: string, opts: any = {}) {
    this.chamadas++;
    if (opts.ordenar) this.varridasComOrdenar.push(tabela);
    const linhas = this.filtrar(tabela, opts);
    this.lidas.set(tabela, (this.lidas.get(tabela) ?? 0) + linhas.length);
    return linhas;
  }
}

function criarApp(dados: DadosFake, nivelApp: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    // `req.arquivos` presente: exercita `anexarImagemPrincipal` (capas).
    req.arquivos = { url: async (id: number) => `https://arquivos.test/${id}` };
    req.contexto = { nivelApp, usuario: { id: 7, nome: 'Teste' } };
    next();
  });
  app.use(rotasEstudos);
  return app;
}

async function comServidor(app: ReturnType<typeof express>, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  try {
    await new Promise<void>((ok, ko) => { server.once('listening', () => ok()); server.once('error', ko); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
}

// `n` estudos (ids 1..n); o usuário 7 é membro de todos, como editor.
function semear(n: number) {
  const d = new DadosFake();
  for (let i = 1; i <= n; i++) {
    d.semear('estudos', {
      id: i, nome: `E${i}`, tipo_empreendimento: 'incorporacao', status: 'em_analise',
      criado_em: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    });
    d.semear('estudo_membros', { estudo_id: i, usuario_id: 7, funcao: 'editor' });
  }
  // Um estudo de outro usuário, que o membro NÃO pode ver.
  d.semear('estudos', {
    id: n + 1, nome: 'Alheio', tipo_empreendimento: 'incorporacao', status: 'em_analise',
    criado_em: '2025-01-01T00:00:00.000Z',
  });
  d.semear('estudo_membros', { estudo_id: n + 1, usuario_id: 99, funcao: 'editor' });
  d.semear('preliminar_produtos', { estudo_id: 1, nome: 'P' });
  // Toda estudo (inclusive o alheio) tem capa: > 500 capas obrigam a varredura.
  for (let i = 1; i <= n + 1; i++) {
    d.semear('estudo_documentos', { estudo_id: i, categoria: 'imagem_principal', ordem: 1, documento: 1000 + i });
  }
  return d;
}

async function listar(base: string) {
  const res = await fetch(`${base}/estudos`);
  assert.equal(res.status, 200);
  return res.json() as Promise<{ dados: any[]; total: number }>;
}

for (const nivel of ['admin', 'escrita'] as const) {
  test(`#909 fiação: GET /estudos (${nivel}) devolve TODOS os 650 estudos, com total certo`, async () => {
    const N = 650;
    const d = semear(N);
    await comServidor(criarApp(d, nivel), async (base) => {
      const r = await listar(base);
      const esperado = nivel === 'admin' ? N + 1 : N;
      assert.equal(r.total, esperado);
      assert.equal(r.dados.length, esperado, 'a listagem truncou');
      assert.equal(new Set(r.dados.map((e) => e.id)).size, esperado);
      // Mais recente primeiro.
      const criados = r.dados.map((e) => e.criado_em);
      assert.deepEqual(criados, [...criados].sort().reverse());
      // Todas as capas chegam (mais de 500 capas: um teto de página truncaria).
      assert.ok(r.dados.every((e) => e.imagem_principal_url === `https://arquivos.test/${1000 + e.id}`),
        'capa ausente');
      // `ordenar` no `varrerTudo` desligaria a proteção contra INSERT concorrente.
      assert.deepEqual(d.varridasComOrdenar, [], '`varrerTudo` com `ordenar`');
      assert.equal(r.dados.find((e) => e.id === 1).produtos.length, 1);
      if (nivel === 'admin') assert.ok(r.dados.every((e) => e._funcao === 'aprovador'));
      else {
        assert.ok(r.dados.every((e) => e.id !== N + 1), 'membro viu estudo alheio');
        // O membro lê a tabela filtrada por tipo/status (aqui, sem filtro: todos os estudos).
        assert.equal(d.lidas.get('estudos'), N + 1);
      }
    });
  });

  test(`#909 fiação: GET /estudos (${nivel}) não emite mais consultas com mais estudos`, async () => {
    const contar = async (n: number) => {
      const d = semear(n);
      let c = 0;
      await comServidor(criarApp(d, nivel), async (base) => { await listar(base); c = d.chamadas; });
      return c;
    };
    const pequeno = await contar(3);
    const grande = await contar(650);
    assert.equal(grande, pequeno, `consultas cresceram com N (${pequeno} → ${grande})`);
  });
}

test('#909 regras preservadas: leitor não vê rascunho/arquivado e os filtros valem', async () => {
  const d = new DadosFake();
  const mk = (id: number, status: string, tipo = 'incorporacao') => {
    d.semear('estudos', {
      id, nome: `E${id}`, tipo_empreendimento: tipo, status, criado_em: `2026-01-0${id}T00:00:00.000Z`,
    });
    d.semear('estudo_membros', { estudo_id: id, usuario_id: 7, funcao: 'leitor' });
  };
  mk(1, 'rascunho'); mk(2, 'arquivado'); mk(3, 'em_analise'); mk(4, 'em_analise', 'loteamento');
  await comServidor(criarApp(d, 'leitura'), async (base) => {
    const r = await listar(base);
    assert.deepEqual(r.dados.map((e) => e.id).sort(), [3, 4]);
    const f = await (await fetch(`${base}/estudos?tipo_empreendimento=loteamento`)).json();
    assert.deepEqual(f.dados.map((e: any) => e.id), [4]);
    assert.equal(f.total, 1);
  });
});

test('#909 ordenarEstudosRecentes: Date e texto, desempate por id desc, sem data por último', () => {
  const r = ordenarEstudosRecentes([
    { id: 1, criado_em: new Date('2026-03-01T00:00:00Z') },
    { id: 2, criado_em: '2026-03-02 10:00:00+00' }, // não-ISO "T", mas parseável
    { id: 3, criado_em: '2026-03-01T00:00:00.000Z' }, // empata com o id 1
    { id: 4, criado_em: null },
    { id: 5, criado_em: new Date('2026-01-01T00:00:00Z') },
  ]);
  assert.deepEqual(r.map((e) => e.id), [2, 3, 1, 5, 4]);
});

test('#909 capa: menor `ordem` de cada estudo, desempate pelo menor id, sem `ordenar` na varredura', async () => {
  const d = semear(2);
  // Estudo 1: uma capa de ordem 0 inserida DEPOIS (id maior) vence a de ordem 1.
  d.semear('estudo_documentos', { id: 50, estudo_id: 1, categoria: 'imagem_principal', ordem: 0, documento: 5000 });
  // Estudo 2: duas capas de mesma ordem 0; vence a de menor id, mesmo inserida depois.
  d.semear('estudo_documentos', { id: 61, estudo_id: 2, categoria: 'imagem_principal', ordem: 0, documento: 6100 });
  d.semear('estudo_documentos', { id: 60, estudo_id: 2, categoria: 'imagem_principal', ordem: 0, documento: 6000 });
  await comServidor(criarApp(d, 'admin'), async (base) => {
    const r = await listar(base);
    const url = (id: number) => r.dados.find((e) => e.id === id).imagem_principal_url;
    assert.equal(url(1), 'https://arquivos.test/5000');
    assert.equal(url(2), 'https://arquivos.test/6000');
    assert.deepEqual(d.varridasComOrdenar, []);
  });
});

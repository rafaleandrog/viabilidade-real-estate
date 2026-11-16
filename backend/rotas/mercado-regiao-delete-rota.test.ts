import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAnaliseMercado } from './analise-mercado.js';

// DELETE /mercado/regioes/:rid chamava `remover` (soft delete), que exige
// `soft_delete` na tabela; mercado_regioes não o declara, então sempre dava 500.
// Agora usa `deletar`. O fake imita o contrato do shell: `remover` lança em
// tabela sem soft_delete, e `deletar` aplica as regras de FK do schema.json
// (coletas em cascata, `regiao_mercado_id` dos estudos anulado).

class DadosFake {
  t = new Map<string, Map<number, any>>();
  semear(tabela: string, l: any) { if (!this.t.has(tabela)) this.t.set(tabela, new Map()); this.t.get(tabela)!.set(l.id, l); }
  async buscar(tabela: string, id: number) { return this.t.get(tabela)?.get(Number(id)) ?? null; }
  async listar(tabela: string) { const d = [...(this.t.get(tabela)?.values() ?? [])]; return { dados: d, total: d.length }; }
  async remover(): Promise<never> { throw new Error('Tabela sem soft_delete: use deletar'); }
  async deletar(tabela: string, id: number) {
    this.t.get(tabela)?.delete(Number(id));
    if (tabela === 'mercado_regioes') {
      for (const [cid, c] of [...(this.t.get('mercado_coletas') ?? [])]) if (c.regiao_id === id) this.t.get('mercado_coletas')!.delete(cid);
      for (const e of this.t.get('estudos')?.values() ?? []) if (e.regiao_mercado_id === id) e.regiao_mercado_id = null;
    }
  }
}

async function comServidor(nivel: string, dados: DadosFake, fn: (u: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.dados = dados; req.contexto = { nivelApp: nivel, usuario: { id: 1 } }; next(); });
  app.use(rotasAnaliseMercado);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { server.close(); }
}

function semear() {
  const d = new DadosFake();
  d.semear('mercado_regioes', { id: 1, nome: 'Águas Claras', ordem: 0 });
  d.semear('mercado_regioes', { id: 2, nome: 'Asa Sul', ordem: 1 });
  d.semear('mercado_coletas', { id: 10, regiao_id: 2 });
  d.semear('estudos', { id: 5, regiao_mercado_id: 2 });
  return d;
}

test('admin exclui região sem uso: 200 e some do GET', async () => {
  const d = semear();
  await comServidor('admin', d, async (u) => {
    const r = await fetch(`${u}/mercado/regioes/1`, { method: 'DELETE' });
    assert.equal(r.status, 200);
    const lista = await (await fetch(`${u}/mercado/regioes`)).json() as any;
    assert.deepEqual(lista.dados.map((x: any) => x.id), [2]);
  });
});

test('região em uso por estudo e com coletas: 200, coletas em cascata, estudo anulado', async () => {
  const d = semear();
  await comServidor('admin', d, async (u) => {
    const r = await fetch(`${u}/mercado/regioes/2`, { method: 'DELETE' });
    assert.equal(r.status, 200);
    assert.equal(d.t.get('mercado_coletas')!.size, 0);
    assert.equal(d.t.get('estudos')!.get(5).regiao_mercado_id, null);
  });
});

test('região inexistente 404, id inválido 400, não-admin 403 sem apagar', async () => {
  const d = semear();
  await comServidor('admin', d, async (u) => {
    assert.equal((await fetch(`${u}/mercado/regioes/999`, { method: 'DELETE' })).status, 404);
    assert.equal((await fetch(`${u}/mercado/regioes/abc`, { method: 'DELETE' })).status, 400);
  });
  await comServidor('escrita', d, async (u) => {
    assert.equal((await fetch(`${u}/mercado/regioes/1`, { method: 'DELETE' })).status, 403);
    assert.ok(d.t.get('mercado_regioes')!.has(1));
  });
});

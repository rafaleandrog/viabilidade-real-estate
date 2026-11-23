import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado, aliquotaImpostoDoCorpo } from './avancado.js';

// #834, fatia 2 — o PATCH dos parâmetros do Avançado passa a gravar a alíquota
// do imposto padrão (`imposto_percentual`), que a tela de Custos edita. É a
// fronteira: a tela barra o mesmo intervalo, mas a rota é chamável direto.

class DadosFake {
  gravado: Record<string, any> | null = null;
  constructor(private estudo: any) {}
  async buscar(tabela: string, id: number) { return tabela === 'estudos' && Number(id) === this.estudo.id ? this.estudo : null; }
  async listar() { return { dados: [], total: 0 }; }
  async varrerTudo() { return []; }
  async atualizar(_t: string, _id: number, patch: Record<string, any>) {
    for (const [k, v] of Object.entries(patch)) {
      if (k.endsWith('_pct') || k === 'imposto_percentual') {
        if (typeof v !== 'number') throw new Error(`Campo "${k}" deve ser um número`);
      }
    }
    this.gravado = patch;
    this.estudo = { ...this.estudo, ...patch };
    return this.estudo;
  }
}

async function patch(corpo: unknown) {
  const dados = new DadosFake({ id: 1, nivel_analise: 'avancado', status: 'rascunho', considerar_ret: false, ret_pct: '4.00', imposto_percentual: '7.00' });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.dados = dados; req.contexto = { nivelApp: 'admin', usuario: { id: 1 } }; next(); });
  app.use(rotasAvancado);
  const server = app.listen(0);
  try {
    await new Promise<void>((r) => server.once('listening', () => r()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const r = await fetch(`${base}/estudos/1/avancado/parametros`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
    });
    return { status: r.status, corpo: await r.json() as any, gravado: dados.gravado };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test('#834 aliquotaImpostoDoCorpo: parser estrito, entre 0 e 100', () => {
  assert.equal(aliquotaImpostoDoCorpo(6.73), 6.73);
  assert.equal(aliquotaImpostoDoCorpo('6.73'), 6.73);
  assert.equal(aliquotaImpostoDoCorpo(0), 0);
  assert.equal(aliquotaImpostoDoCorpo(100), 100);
  for (const v of [-1, 100.01, '0x10', '1e3', '', null, undefined, 'abc', true]) {
    assert.equal(aliquotaImpostoDoCorpo(v), null, String(v));
  }
});

test('#834 PATCH grava o regime padrão com a alíquota, e devolve o que gravou', async () => {
  const r = await patch({ considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.gravado, { considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73 });
  assert.equal(r.corpo.imposto_percentual, 6.73);
  assert.equal(r.corpo.considerar_ret, false);
});

test('#834 PATCH recusa alíquota fora do intervalo ou ilegível, sem gravar nada', async () => {
  for (const v of [-1, 150, '0x10', null, 'sete']) {
    const r = await patch({ considerar_ret: false, imposto_percentual: v });
    assert.equal(r.status, 400, String(v));
    assert.match(JSON.stringify(r.corpo), /IMPOSTO_PCT_INVALIDO/, String(v));
    assert.equal(r.gravado, null, `gravou com ${String(v)}`);
  }
});

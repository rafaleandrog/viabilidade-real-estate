import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado, impostoPercentualDaRota } from './avancado.js';
import { impostoDoEstudoAvancado } from '../../frontend/fluxo-shared.js';

// #834 — fora do RET, o motor do Avançado deduz a alíquota do imposto padrão
// do estudo (`estudos.imposto_percentual`). As telas a leem de
// `GET /estudos/:id/avancado/parametros`; se a rota não a devolvesse, o
// resolvedor do frontend leria `undefined` e o imposto voltaria a zero calado.
// Este arquivo prova a ponta da rota: Express real, `req.dados` falso.

class DadosFake {
  constructor(private estudos: Map<number, any>) {}
  async buscar(tabela: string, id: number) {
    return tabela === 'estudos' ? (this.estudos.get(Number(id)) ?? null) : null;
  }
  async listar() { return { dados: [], total: 0 }; }
  async varrerTudo() { return []; }
  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    if (tabela !== 'estudos') return null;
    const atual = this.estudos.get(Number(id));
    if (!atual) return null;
    const novo = { ...atual, ...patch };
    this.estudos.set(Number(id), novo);
    return novo;
  }
}

function criarApp(estudos: any[]) {
  const dados = new DadosFake(new Map(estudos.map((e) => [e.id, e])));
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasAvancado);
  return app;
}

async function comServidor(app: ReturnType<typeof express>, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', () => resolve()); server.once('error', reject); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const estudo = (id: number, extra: Record<string, any>) => ({
  id, nivel_analise: 'avancado', status: 'rascunho', taxa_desconto_aa: '12.00', ...extra,
});

test('#834 impostoPercentualDaRota: decimal do banco vira número; ausente ou ilegível vira null', () => {
  assert.equal(impostoPercentualDaRota('6.73'), 6.73);
  assert.equal(impostoPercentualDaRota(7), 7);
  assert.equal(impostoPercentualDaRota(0), 0);
  for (const v of [null, undefined, '', 'abc', '0x10', Number.NaN]) {
    assert.equal(impostoPercentualDaRota(v), null, `entrada ${String(v)}`);
  }
});

test('#834 GET /avancado/parametros devolve imposto_percentual, e o resolvedor o aplica fora do RET', async () => {
  const app = criarApp([
    estudo(1, { considerar_ret: false, ret_pct: '4.00', imposto_percentual: '6.73' }),
    estudo(2, { considerar_ret: true, ret_pct: '4.00', imposto_percentual: '7.00' }),
    estudo(3, { considerar_ret: false, ret_pct: '4.00', imposto_percentual: null }),
  ]);
  await comServidor(app, async (base) => {
    const ler = async (id: number) => {
      const r = await fetch(`${base}/estudos/${id}/avancado/parametros`);
      assert.equal(r.status, 200);
      return r.json() as Promise<any>;
    };

    const fora = await ler(1);
    assert.equal(fora.imposto_percentual, 6.73);
    assert.deepEqual(impostoDoEstudoAvancado(fora), { regime: 'padrao', ativo: true, pct: 6.73 });

    const ret = await ler(2);
    assert.equal(ret.imposto_percentual, 7);
    assert.deepEqual(impostoDoEstudoAvancado(ret), { regime: 'ret', ativo: true, pct: 4 });

    const semAliquota = await ler(3);
    assert.equal(semAliquota.imposto_percentual, null);
    assert.deepEqual(impostoDoEstudoAvancado(semAliquota), { regime: 'padrao', ativo: true, pct: 0 });
  });
});

test('#834 PATCH /avancado/parametros devolve imposto_percentual na resposta', async () => {
  const app = criarApp([estudo(1, { considerar_ret: true, ret_pct: '4.00', imposto_percentual: '6.73' })]);
  await comServidor(app, async (base) => {
    const r = await fetch(`${base}/estudos/1/avancado/parametros`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ considerar_ret: false }),
    });
    assert.equal(r.status, 200);
    const corpo = await r.json() as any;
    assert.equal(corpo.considerar_ret, false);
    assert.equal(corpo.imposto_percentual, 6.73);
    assert.deepEqual(impostoDoEstudoAvancado(corpo), { regime: 'padrao', ativo: true, pct: 6.73 });
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasPreliminarProdutos, erroUnidadesPermutadas, CAMPOS, CAMPOS_GRAVAVEIS } from './preliminar-produtos.js';
import { FILHAS_SIMPLES } from './estudos.js';
import esquema from '../../schema.json';

// Permuta física por produto: `unidades_permutadas` (inteiro, 0 ≤ x ≤ unidades).
// Prova de FIAÇÃO com Express real e um `DadosFake` que reproduz a regra do shell
// (string em coluna numérica → lança), mais o inventário do schema e da duplicação.

const COLUNAS = (esquema as any).tabelas.preliminar_produtos.colunas as Record<string, any>;

class DadosFake {
  private linhas = new Map<number, any>();
  private proximoId = 1;
  semear(linha: Record<string, any>) { const id = this.proximoId++; this.linhas.set(id, { ...linha, id }); return id; }
  total() { return this.linhas.size; }
  private validar(d: Record<string, any>) {
    for (const [c, def] of Object.entries(COLUNAS)) {
      if (!['decimal', 'inteiro', 'referencia'].includes(def.tipo)) continue;
      if (d[c] === null || d[c] === undefined) continue;
      if (typeof d[c] !== 'number') throw new Error(`Campo "${c}" deve ser um número`);
    }
  }
  async buscar(tabela: string, id: number) {
    return tabela === 'estudos' ? { id: 1, status: 'em_analise', tipo_empreendimento: 'incorporacao' } : this.linhas.get(Number(id)) ?? null;
  }
  async listar(_t: string, opts: any = {}) {
    const dados = [...this.linhas.values()].filter((l) => l.estudo_id === opts.filtros?.estudo_id);
    return { dados, total: dados.length };
  }
  async criar(_t: string, d: Record<string, any>) {
    this.validar(d);
    const id = this.semear({ unidades_permutadas: COLUNAS.unidades_permutadas.padrao, ...d });
    return this.linhas.get(id);
  }
  async atualizar(_t: string, id: number, d: Record<string, any>) {
    this.validar(d);
    const novo = { ...this.linhas.get(Number(id)), ...d };
    this.linhas.set(Number(id), novo);
    return novo;
  }
}

async function comServidor(dados: DadosFake, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.dados = dados; req.contexto = { nivelApp: 'admin', usuario: { id: 1 } }; next(); });
  app.use(rotasPreliminarProdutos);
  const server = app.listen(0);
  try {
    await new Promise<void>((ok, ko) => { server.once('listening', () => ok()); server.once('error', ko); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
}

async function enviar(base: string, metodo: 'POST' | 'PATCH', caminho: string, corpo: unknown) {
  const res = await fetch(`${base}${caminho}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  return { status: res.status, corpo: await res.json() as any };
}

const SEMENTE = { estudo_id: 1, nome: 'P', tipo: 'residencial', unidades: 10, unidades_permutadas: 2, ordem: 0 };

test('schema: unidades_permutadas é inteiro com padrão 0, e a forma original de CAMPOS não mudou', () => {
  assert.deepEqual(COLUNAS.unidades_permutadas, { tipo: 'inteiro', padrao: 0 });
  assert.deepEqual(CAMPOS, ['nome', 'tipo', 'pct_alv', 'area_media_m2', 'preco_venda_m2', 'unidades', 'ordem']);
  assert.deepEqual(CAMPOS_GRAVAVEIS, [...CAMPOS, 'unidades_permutadas']);
});

test('duplicar estudo: a coluna entra na lista de campos copiados do catálogo', () => {
  const filha = FILHAS_SIMPLES.find((f) => f.tabela === 'preliminar_produtos')!;
  assert.ok([...filha.campos, ...(filha.extras ?? [])].includes('unidades_permutadas'), 'a cópia do estudo perderia a permuta por produto');
});

test('POST e PATCH gravam e devolvem unidades_permutadas (e a string decimal estrita vira número)', async () => {
  const dados = new DadosFake();
  const id = dados.semear(SEMENTE);
  await comServidor(dados, async (base) => {
    const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', unidades: 8, unidades_permutadas: '3' });
    assert.equal(post.status, 201, JSON.stringify(post.corpo));
    assert.equal(post.corpo.unidades_permutadas, 3);
    const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { unidades_permutadas: 10 });
    assert.equal(patch.status, 200, JSON.stringify(patch.corpo));
    assert.equal(patch.corpo.unidades_permutadas, 10);
    const zera = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { unidades_permutadas: 0 });
    assert.equal(zera.status, 200);
    assert.equal(zera.corpo.unidades_permutadas, 0);
  });
});

test('lixo, negativo, fração e null → 400 UNIDADES_PERMUTADAS_INVALIDAS, sem gravar (fail-closed)', async () => {
  for (const ruim of ['abc', '', '1e1', '0x2', -1, 1.5, '1.5', null, true, {}]) {
    const dados = new DadosFake();
    const id = dados.semear(SEMENTE);
    await comServidor(dados, async (base) => {
      const post = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', unidades: 10, unidades_permutadas: ruim });
      assert.equal(post.status, 400, `POST ${JSON.stringify(ruim)} → ${JSON.stringify(post.corpo)}`);
      assert.equal(post.corpo.codigo, 'UNIDADES_PERMUTADAS_INVALIDAS');
      assert.equal(dados.total(), 1, 'POST recusado não pode criar linha');
      const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { unidades_permutadas: ruim });
      assert.equal(patch.status, 400, `PATCH ${JSON.stringify(ruim)} → ${JSON.stringify(patch.corpo)}`);
      assert.equal(patch.corpo.codigo, 'UNIDADES_PERMUTADAS_INVALIDAS');
      assert.equal((await dados.buscar('preliminar_produtos', id)).unidades_permutadas, 2, 'PATCH recusado não pode alterar');
    });
  }
});

test('o teto é o par efetivo: permutadas acima das unidades (no corpo ou já gravadas) é recusado', async () => {
  const dados = new DadosFake();
  const id = dados.semear(SEMENTE);
  await comServidor(dados, async (base) => {
    const acima = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { unidades_permutadas: 11 });
    assert.equal(acima.status, 400, JSON.stringify(acima.corpo));
    assert.equal(acima.corpo.codigo, 'UNIDADES_PERMUTADAS_INVALIDAS');
    // Baixar `unidades` abaixo do que já está permutado (2) também é recusado…
    const baixa = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { unidades: 1 });
    assert.equal(baixa.status, 400, JSON.stringify(baixa.corpo));
    // …a menos que as duas desçam juntas (é o que a tela manda).
    const juntas = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { unidades: 1, unidades_permutadas: 1 });
    assert.equal(juntas.status, 200, JSON.stringify(juntas.corpo));
    const postAcima = await enviar(base, 'POST', '/estudos/1/preliminar/produtos', { nome: 'X', unidades: 2, unidades_permutadas: 3 });
    assert.equal(postAcima.status, 400, JSON.stringify(postAcima.corpo));
  });
});

test('PATCH de outro campo não mexe nas unidades permutadas', async () => {
  const dados = new DadosFake();
  const id = dados.semear(SEMENTE);
  await comServidor(dados, async (base) => {
    const patch = await enviar(base, 'PATCH', `/estudos/1/preliminar/produtos/${id}`, { nome: 'Y' });
    assert.equal(patch.status, 200, JSON.stringify(patch.corpo));
    assert.equal(patch.corpo.unidades_permutadas, 2);
  });
});

test('erroUnidadesPermutadas: puro — ausente passa, par inconsistente falha', () => {
  assert.equal(erroUnidadesPermutadas({}), null);
  assert.equal(erroUnidadesPermutadas({ nome: 'x' }, { unidades: 5, unidades_permutadas: 9 }), null, 'outro campo não revalida');
  assert.equal(erroUnidadesPermutadas({ unidades_permutadas: 5 }, { unidades: 5 }), null);
  assert.match(erroUnidadesPermutadas({ unidades_permutadas: 6 }, { unidades: 5 })!, /não pode passar/);
  assert.match(erroUnidadesPermutadas({ unidades_permutadas: 1.5 })!, /inteiro/);
});

// Projetos em `% Construção` na tela de Premissas do Preliminar: a badge existe,
// casa com as `opcoes` do `schema.json`, e o MÉTODO do componente grava o
// canônico sobre o custo de obras — não sobre o VGV. Exercita a fiação da tela
// (classe de defeito nº 1 do CLAUDE.md); o motor tem teste próprio em
// `frontend/bases-custo-pct.test.ts`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

(globalThis as any).urbiVerso = { api: async () => ({}), notificar: () => {} };
if (!(globalThis as any).CustomEvent) {
  (globalThis as any).CustomEvent = class extends Event {
    detail: unknown;
    constructor(t: string, o?: { detail?: unknown }) { super(t); this.detail = o?.detail; }
  };
}

const { ViabTelaPremissas, CUSTOS_UNIDADE } = await import('./tela-premissas.js');
const schema = JSON.parse(readFileSync(new URL('../schema.json', import.meta.url), 'utf8'));

const PROJETOS = CUSTOS_UNIDADE.find((c: any) => c.modoKey === 'projetos_modo')!;
const PCT_CONSTR = PROJETOS.opcoes.find((o: any) => o.valor === 'pct_constr')!;

test('Projetos: as unidades da tela são exatamente as opcoes de estudos.projetos_modo', () => {
  const daTela = PROJETOS.opcoes.map((o: any) => o.valor).sort();
  const doSchema = [...schema.tabelas.estudos.colunas.projetos_modo.opcoes].sort();
  assert.deepEqual(daTela, doSchema);
  for (const v of doSchema) {
    assert.ok(v.length <= schema.tabelas.estudos.colunas.projetos_modo.limite, `${v} estoura o limite da coluna`);
  }
});

test('Projetos em % Construção: digitar 1,6 grava o canônico sobre o custo de obras', () => {
  assert.ok(PCT_CONSTR, 'a badge % Construção sumiu de Projetos');
  assert.deepEqual(PCT_CONSTR.conv, { tipo: 'pct', link: 'custoObras' });
  const el: any = new ViabTelaPremissas();
  el.estudo = { id: 1, tipo_empreendimento: 'incorporacao', nivel_analise: 'preliminar' };
  el.form = {
    tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 10_000,
    construcao_modo: 'valor_total', construcao_valor_total: 96_000_000, construcao_valor_canonico: 96_000_000,
    custo_decoracao_m2: 0, taxa_gestao_pct: 6, projetos_modo: 'pct_constr',
  };
  el.produtos = [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 100 }];
  el.benchmarks = [];
  el._catalogoCarregado = true;
  el._editarCustoUnidade(PROJETOS, PCT_CONSTR, 1.6);
  assert.equal(el.form.projetos_pct, 1.6);
  assert.ok(Math.abs(el.form.projetos_valor_canonico - 1_628_160) < 0.01,
    `canônico=${el.form.projetos_valor_canonico} — esperado 1,6% de R$ 101.760.000`);
  // E a exibição volta do canônico para o mesmo 1,6.
  assert.ok(Math.abs(el._valorUnidade(PROJETOS, PCT_CONSTR) - 1.6) < 1e-9);
});

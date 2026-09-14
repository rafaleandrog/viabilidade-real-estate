import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, vgvBrutoDeProforma, type ProformaInput } from './proforma.js';
import { calcularCascataResultado } from './cascata-resultado-motor.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Mesmo fixture "saudável" de `frontend/auditoria-indicadores-preliminar.test.ts`.
const LOT: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100000,
  area_viario_publico_modo: 'pct_poligonal',
  area_viario_publico_valor: 25,
  produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }],
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  considerar_custo_terreno: true,
  custo_terreno_m2: 100,
  infra_modo: 'pct_vgv',
  infra_pct: 30,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 0,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

const INCORP: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 5000,
  area_pvt_r_fechada: 6000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 60 }],
  considerar_custo_terreno: true,
  custo_terreno_m2: 500,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 3000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 2,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
} as ProformaInput;

test('calcularCascataResultado: a etapa "resultado" bate com p.resultado, em ambos os fixtures', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    const etapas = calcularCascataResultado(p);
    const resultado = etapas.find((e) => e.id === 'resultado');
    assert.ok(resultado, 'a etapa "resultado" precisa sempre existir');
    assert.ok(perto(resultado!.valor, p.resultado), `resultado etapa=${resultado!.valor} p.resultado=${p.resultado}`);
    assert.equal(resultado!.tipo, 'total');
  }
});

test('calcularCascataResultado: os subtotais batem com os campos do motor (sem recálculo)', () => {
  const p = calcularProforma(LOT);
  const etapas = calcularCascataResultado(p);
  const porId = new Map(etapas.map((e) => [e.id, e.valor]));
  assert.ok(perto(porId.get('vgv_tabela')!, vgvBrutoDeProforma(p)));
  assert.ok(perto(porId.get('receita_bruta')!, p.vgv));
  assert.ok(perto(porId.get('receita_liquida')!, p.receitaLiquida));
  assert.ok(perto(porId.get('receita_operacional')!, p.receitaOperacional));
});

test('calcularCascataResultado: subtotais partem de left=0; deduções nunca têm width negativa', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    const etapas = calcularCascataResultado(p);
    for (const e of etapas) {
      assert.ok(e.widthPct >= 0 && e.widthPct <= 100, `${e.id} widthPct=${e.widthPct}`);
      assert.ok(e.leftPct >= 0 && e.leftPct <= 100, `${e.id} leftPct=${e.leftPct}`);
      if (e.tipo !== 'deducao') assert.equal(e.leftPct, 0, `${e.id} deveria partir de 0`);
    }
  }
});

test('calcularCascataResultado: deduções zeradas (abaixo do limiar) não entram na lista', () => {
  // LOT não tem permuta física nenhuma — as duas etapas de permuta física
  // não deveriam aparecer.
  const p = calcularProforma(LOT);
  const etapas = calcularCascataResultado(p);
  assert.equal(etapas.find((e) => e.id === 'permuta_fisica_r'), undefined);
  assert.equal(etapas.find((e) => e.id === 'permuta_fisica_nr'), undefined);
});

test('calcularCascataResultado: estudo vazio não quebra (vgv=0 → widths em 0, sem NaN)', () => {
  const p = calcularProforma({ tipo_empreendimento: 'loteamento' } as ProformaInput);
  const etapas = calcularCascataResultado(p);
  for (const e of etapas) {
    assert.ok(Number.isFinite(e.leftPct), `${e.id} leftPct não finito`);
    assert.ok(Number.isFinite(e.widthPct), `${e.id} widthPct não finito`);
  }
});

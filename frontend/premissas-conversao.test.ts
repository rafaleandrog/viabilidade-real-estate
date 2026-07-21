import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converterUnidade, type CtxConversao } from './premissas-conversao.js';

const ctx = (over: Partial<CtxConversao> = {}): CtxConversao => ({
  vgv: 0, vgvResidencial: 0, vgvNaoResidencial: 0,
  areaVendavel: 0, areaVendavelR: 0, areaVendavelNR: 0, areaPrivativa: 0, ...over,
});

const IDENT = { tipo: 'identidade' } as const;

test('permuta física: m² ↔ % da área de venda (exemplo do autor)', () => {
  const c = ctx({ areaVendavel: 40000, areaVendavelR: 40000 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  // 2.000 m² → 5%
  assert.equal(converterUnidade(IDENT, areaParaPct, 2000, c), 5);
  // 10% → 4.000 m²
  assert.equal(converterUnidade(areaParaPct, IDENT, 10, c), 4000);
});

test('infra: % VGV ↔ R$/m² ↔ R$ fixo', () => {
  const c = ctx({ vgv: 75_000_000, areaVendavel: 75000 });
  const pctVgv = { tipo: 'pct', link: 'vgv' } as const;
  const porM2 = { tipo: 'por_area', link: 'areaVendavel' } as const;
  // 30% do VGV (22,5M) → R$/m² = 22,5M / 75.000 = 300
  assert.equal(converterUnidade(pctVgv, porM2, 30, c), 300);
  // R$/m² 300 → % VGV = (300×75.000)/75M×100 = 30
  assert.equal(converterUnidade(porM2, pctVgv, 300, c), 30);
  // 30% → R$ fixo = 22,5M
  assert.equal(converterUnidade(pctVgv, IDENT, 30, c), 22_500_000);
});

test('construção: R$/m² ↔ R$ total (× área privativa)', () => {
  const c = ctx({ areaPrivativa: 1350 });
  const porM2 = { tipo: 'por_area', link: 'areaPrivativa' } as const;
  assert.equal(converterUnidade(porM2, IDENT, 5000, c), 6_750_000); // 5000 × 1350
  assert.equal(converterUnidade(IDENT, porM2, 6_750_000, c), 5000);
});

test('permuta financeira: % do VGV do tipo ↔ R$', () => {
  const c = ctx({ vgvResidencial: 10_000_000, vgvNaoResidencial: 4_000_000 });
  const pctR = { tipo: 'pct', link: 'vgvResidencial' } as const;
  assert.equal(converterUnidade(pctR, IDENT, 10, c), 1_000_000); // 10% de 10M
  assert.equal(converterUnidade(IDENT, pctR, 1_000_000, c), 10);
  const pctNR = { tipo: 'pct', link: 'vgvNaoResidencial' } as const;
  assert.equal(converterUnidade(pctNR, IDENT, 25, c), 1_000_000); // 25% de 4M
});

test('sem base definida (grandeza de ligação = 0): não converte (null)', () => {
  const c = ctx({ areaVendavelR: 0 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  assert.equal(converterUnidade(IDENT, areaParaPct, 2000, c), null); // m² → % sem área
  assert.equal(converterUnidade(areaParaPct, IDENT, 5, c), null);    // % → m² sem área
});

test('valor inválido/vazio (NaN) não converte', () => {
  const c = ctx({ areaVendavelR: 40000 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  assert.equal(converterUnidade(IDENT, areaParaPct, NaN, c), null);
});

test('arredonda a 2 casas', () => {
  const c = ctx({ areaVendavelR: 30000 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  // 1000 m² / 30000 × 100 = 3,3333… → 3,33
  assert.equal(converterUnidade(IDENT, areaParaPct, 1000, c), 3.33);
});

// Grandezas do Avançado (Lote 5 · custos): R$/m² de terreno e % da receita.
test('custo Avançado: R$/m² de terreno ↔ R$ (link areaTerreno)', () => {
  const c = ctx({ areaTerreno: 20000 });
  const porTerreno = { tipo: 'por_area', link: 'areaTerreno' } as const;
  assert.equal(converterUnidade(porTerreno, IDENT, 150, c), 3_000_000); // 150 × 20000
  assert.equal(converterUnidade(IDENT, porTerreno, 3_000_000, c), 150);
});

test('custo Avançado: % da receita ↔ R$ (link receita)', () => {
  const c = ctx({ receita: 50_000_000 });
  const pctReceita = { tipo: 'pct', link: 'receita' } as const;
  assert.equal(converterUnidade(pctReceita, IDENT, 4, c), 2_000_000); // 4% de 50M
  assert.equal(converterUnidade(IDENT, pctReceita, 2_000_000, c), 4);
});

test('custo Avançado: chave de ligação ausente no ctx não converte', () => {
  const c = ctx({}); // sem areaTerreno/receita
  const porTerreno = { tipo: 'por_area', link: 'areaTerreno' } as const;
  assert.equal(converterUnidade(porTerreno, IDENT, 150, c), null);
  assert.equal(converterUnidade(IDENT, porTerreno, 3_000_000, c), null);
});

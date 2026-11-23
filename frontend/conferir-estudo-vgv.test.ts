// A conta de VGV do `scripts/conferir-estudo.ts` acusava FALHA falsa: somava só
// a área fechada e usava o preço do catálogo em vez do da alocação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vgvAlocacoes, vgvCatalogo } from '../scripts/conferir-vgv.js';
import { vgvLinha } from '../frontend/fluxo-shared.js';

const motor = (receitas: any[]) => receitas.reduce((s, l) => s + vgvLinha(l.tipologias), 0);
const antigaLinhas = (receitas: any[]) => receitas.reduce((s, l) =>
  s + l.tipologias.reduce((a: number, t: any) => a + t.quantidade * t.area_privativa_m2 * t.preco_m2, 0), 0);
const antigaCatalogo = (tipologias: any[]) =>
  tipologias.reduce((s, t) => s + t.quantidade * t.area_privativa_m2 * t.preco_m2, 0);

test('estudo 21: área aberta entra na conta e bate com o motor', () => {
  const tipologias = [{ id: 7, quantidade: 120, area_privativa_m2: 62.35, area_privativa_aberta_m2: 11.8, preco_m2: 7450.9 }];
  const receitas = [{ tipologias: [{ tipologia_id: 7, quantidade: 120, area_privativa_m2: 62.35, area_privativa_aberta_m2: 11.8, preco_m2: 7450.9 }] }];
  assert.equal(vgvAlocacoes(receitas), motor(receitas));
  assert.equal(vgvCatalogo(tipologias, receitas), motor(receitas));
  assert.notEqual(vgvAlocacoes(receitas), antigaLinhas(receitas));
  assert.notEqual(vgvCatalogo(tipologias, receitas), antigaCatalogo(tipologias));
});

test('estudo 22: etapas com preços diferentes usam o preço da alocação', () => {
  const tipologias = [{ id: 3, quantidade: 100, area_privativa_m2: 48.5, area_privativa_aberta_m2: 6.25, preco_m2: 800 }];
  const aloc = (q: number, p: number) => ({ tipologia_id: 3, quantidade: q, area_privativa_m2: 48.5, area_privativa_aberta_m2: 6.25, preco_m2: p });
  const receitas = [{ tipologias: [aloc(60, 800)] }, { tipologias: [aloc(40, 860)] }];
  assert.equal(vgvCatalogo(tipologias, receitas), motor(receitas));
  assert.equal(vgvAlocacoes(receitas), motor(receitas));
  assert.notEqual(vgvCatalogo(tipologias, receitas), 100 * (48.5 * 800 + 6.25 * 800));
  assert.notEqual(vgvCatalogo(tipologias, receitas), antigaCatalogo(tipologias));
});

test('regressão: sem área aberta e preço do catálogo, igual à fórmula antiga', () => {
  const tipologias = [{ id: 1, quantidade: 37, area_privativa_m2: 54.73, preco_m2: 6120.45 }];
  const receitas = [{ tipologias: [{ tipologia_id: 1, quantidade: 37, area_privativa_m2: 54.73, preco_m2: 6120.45 }] }];
  assert.equal(vgvAlocacoes(receitas), antigaLinhas(receitas));
  assert.equal(vgvCatalogo(tipologias, receitas), antigaCatalogo(tipologias));
});

test('estoque não alocado: catálogo vale a diferença a preço de catálogo', () => {
  const tipologias = [{ id: 5, quantidade: 10, area_privativa_m2: 70.2, area_privativa_aberta_m2: 5.5, preco_m2: 9000.5 }];
  const receitas = [{ tipologias: [{ tipologia_id: 5, quantidade: 8, area_privativa_m2: 70.2, area_privativa_aberta_m2: 5.5, preco_m2: 9000.5 }] }];
  const dois = 2 * (70.2 * 9000.5 + 5.5 * 9000.5);
  assert.ok(vgvCatalogo(tipologias, receitas) > vgvAlocacoes(receitas));
  assert.ok(Math.abs(vgvCatalogo(tipologias, receitas) - vgvAlocacoes(receitas) - dois) < 0.01);
});

test('fiação: conferir-estudo.ts chama as funções e não tem a conta antiga', () => {
  const src = readFileSync(new URL('../scripts/conferir-estudo.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('vgvCatalogo('));
  assert.ok(src.includes('vgvAlocacoes('));
  assert.ok(!src.includes('n(t.area_privativa_m2) * n(t.preco_m2)'));
});

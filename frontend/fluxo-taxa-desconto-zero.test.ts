import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, taxaDescontoOuPadrao, type FluxoConfig } from './fluxo-caixa-motor.js';
import { readFileSync } from 'node:fs';
import type { EventoCrono } from './fluxo-shared.js';

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const config = (taxaDescontoAa: any): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa, cronograma: CRONO, jurosTabelaAaEstudo: 0,
  linhasReceita: [{ id: 1, nome: 'G', fase_label: 'G',
    tipologias: [{ id: 1, tipologia_id: 1, nome: 'T', quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] } }],
  linhasCusto: [{ id: 1, grupo: 'obra', categoria: 'Construção', orcamento_valor: 20_000_000, orcamento_unidade: 'rs',
    cronograma_evento: 'obra', inicio_mes: 17, duracao_meses: 24, curva_id: null, distribuicao_modo: 'fixo' }],
  areaTerreno: 1000,
} as FluxoConfig);
// VPL medido no motor anterior à correção (taxas 10 e 12 não mudam). Se uma mudança
// legítima de receita/custo/quantização mexer no VPL, re-baseline esperado — a causa não é a taxa.
const V10 = 29248604.99, V12 = 29054009.82;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

test('taxa de desconto 0% não desconta nada: VPL = soma do fluxo', () => {
  const r = calcularFluxo(config(0));
  assert.ok(Math.abs(r.vpl - soma(r.fluxoMensal)) <= 1, `VPL a 0% deveria ser ${soma(r.fluxoMensal)} e foi ${r.vpl}`);
});

test('controle: 12% dá VPL menor que a soma do fluxo', () => {
  const r = calcularFluxo(config(12));
  assert.ok(r.vpl < soma(r.fluxoMensal));
});

test('taxa ausente cai em 12%; 10% e 12% mantêm o VPL anterior', () => {
  const v12 = calcularFluxo(config(12)).vpl;
  for (const ausente of [undefined, null, '', 'abc', NaN]) {
    assert.equal(calcularFluxo(config(ausente)).vpl, v12, `ausente=${String(ausente)}`);
  }
  assert.equal(Math.round(calcularFluxo(config(12)).vpl * 100) / 100, V12);
  assert.equal(Math.round(calcularFluxo(config(10)).vpl * 100) / 100, V10);
});

test('taxaDescontoOuPadrao: 0 fica 0, ausente vira 12', () => {
  assert.equal(taxaDescontoOuPadrao(0), 0);
  assert.equal(taxaDescontoOuPadrao('0'), 0);
  assert.equal(taxaDescontoOuPadrao(10), 10);
  assert.equal(taxaDescontoOuPadrao(undefined), 12);
  assert.equal(taxaDescontoOuPadrao(null), 12);
  for (const lixo of [' ', false, true, [], [0], {}, Infinity]) {
    assert.equal(taxaDescontoOuPadrao(lixo), 12, `lixo=${JSON.stringify(lixo)}`);
  }
});

// Fiação da tela Funding: ela só importa o helper, então a mutação para
// `Number(...) || 12` não derruba nenhum teste de função pura. A leitura da taxa do
// estudo tem de passar por `taxaDescontoOuPadrao`, e o `|| 12` não pode voltar.
test('tela-funding lê a taxa do estudo por taxaDescontoOuPadrao, sem || 12', () => {
  const src = readFileSync(new URL('./tela-funding.ts', import.meta.url), 'utf8');
  assert.match(src, /taxaDescontoOuPadrao\(params\.taxa_desconto_aa\)/);
  assert.doesNotMatch(src, /taxa_desconto_aa\)\s*\|\|\s*12/);
});

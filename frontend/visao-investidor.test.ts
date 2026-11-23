// Visão do investidor — matemática pura. Não prova fiação em tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visaoInvestidor } from './visao-investidor.js';
import type { FundingCalc, SerieOperacao } from './funding-motor.js';

const serie = (tipo: string, nome: string, entradas: number[], saidas: number[]): SerieOperacao =>
  ({ operacao: { tipo, nome }, entradas, saidas }) as unknown as SerieOperacao;
const fc = (...operacoes: SerieOperacao[]): FundingCalc => ({ operacoes }) as unknown as FundingCalc;

test('equity multiple agrega duas equities (Σ÷Σ, não média)', () => {
  const f = fc(
    serie('equity', 'A', [100, 0], [0, 150]),
    serie('equity', 'B', [300, 0], [0, 300]),
  );
  const v = visaoInvestidor({ funding: f, fluxoLivreMensal: [], exposicaoMaxima: 0, vgvTotal: 0 });
  assert.equal(v.aportesEquity, 400);
  assert.equal(v.retornoEquity, 450);
  assert.equal(v.equityMultiple, 1.125); // média dos múltiplos seria 1,25
});

test('sem equity: multiple null', () => {
  const f = fc(serie('divida', 'D', [100], [10]));
  const v = visaoInvestidor({ funding: f, fluxoLivreMensal: [], exposicaoMaxima: 0, vgvTotal: 0 });
  assert.equal(v.equityMultiple, null);
  assert.equal(v.aportesEquity, 0);
});

test('yield com números conhecidos', () => {
  // FCL 24 meses somando 600 => 300/ano; exposição -1000 => 30%
  const mensal = Array(24).fill(25);
  const v = visaoInvestidor({ funding: null, fluxoLivreMensal: mensal, exposicaoMaxima: -1000, vgvTotal: 0 });
  assert.equal(v.yieldPct, 30);
});

test('exposição 0 => yield null, nunca 0%', () => {
  const v = visaoInvestidor({ funding: null, fluxoLivreMensal: [10, 10], exposicaoMaxima: 0, vgvTotal: 0 });
  assert.equal(v.yieldPct, null);
});

test('meses vazios => yield null', () => {
  const v = visaoInvestidor({ funding: null, fluxoLivreMensal: [], exposicaoMaxima: -500, vgvTotal: 0 });
  assert.equal(v.yieldPct, null);
});

test('LTV: divida e financiamento_producao entram; antecipacao e equity ficam fora', () => {
  const f = fc(
    serie('divida', 'Banco', [100, 100], []),
    serie('financiamento_producao', '', [300], []),
    serie('divida', '', [50], []),
    serie('antecipacao_recebiveis', 'Ant', [999], []),
    serie('equity', 'Eq', [500], [600]),
  );
  const v = visaoInvestidor({ funding: f, fluxoLivreMensal: [], exposicaoMaxima: 0, vgvTotal: 1000 });
  assert.deepEqual(v.ltvs, [
    { nome: 'Banco', tipo: 'divida', principal: 200, ltvPct: 20 },
    { nome: 'Financiamento à produção', tipo: 'financiamento_producao', principal: 300, ltvPct: 30 },
    { nome: 'Dívida', tipo: 'divida', principal: 50, ltvPct: 5 },
  ]);
});

test('vgvTotal 0 => ltvPct null', () => {
  const f = fc(serie('divida', 'D', [100], []));
  const v = visaoInvestidor({ funding: f, fluxoLivreMensal: [], exposicaoMaxima: 0, vgvTotal: 0 });
  assert.equal(v.ltvs[0].ltvPct, null);
  assert.equal(v.ltvs[0].principal, 100);
});

test('funding null: ltvs vazio, multiple null, yield ainda calculado', () => {
  const v = visaoInvestidor({ funding: null, fluxoLivreMensal: Array(12).fill(10), exposicaoMaxima: -100, vgvTotal: 1000 });
  assert.deepEqual(v.ltvs, []);
  assert.equal(v.equityMultiple, null);
  assert.equal(v.yieldPct, 120);
});

test('yield ignora zeros no fim (quitação do funding não alonga a duração)', () => {
  const base = Array(24).fill(25);
  const estendida = [...base, ...Array(12).fill(0)];
  const a = visaoInvestidor({ funding: null, fluxoLivreMensal: base, exposicaoMaxima: -1000, vgvTotal: 0 });
  const b = visaoInvestidor({ funding: null, fluxoLivreMensal: estendida, exposicaoMaxima: -1000, vgvTotal: 0 });
  assert.equal(b.yieldPct, a.yieldPct);
  assert.equal(b.yieldPct, 30);
});

test('fluxo livre todo zerado => yield null', () => {
  const v = visaoInvestidor({ funding: null, fluxoLivreMensal: Array(12).fill(0), exposicaoMaxima: -1000, vgvTotal: 0 });
  assert.equal(v.yieldPct, null);
});

test('aporte de equity > 0 com retorno 0 => multiple 0, não null', () => {
  const f = fc(serie('equity', 'A', [100], [0]));
  const v = visaoInvestidor({ funding: f, fluxoLivreMensal: [], exposicaoMaxima: 0, vgvTotal: 0 });
  assert.equal(v.equityMultiple, 0);
});

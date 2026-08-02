import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fluxoAposFundingMensal, caixaAcumuladoMensal, necessidadeFundingMensal,
  caixaDistribuivelMensal, reconciliarCapitalStack,
  custoElegivelMensalDeLinhas, instrumentoDeRegistro, simularCapitalStackDoEstudo,
} from './capital-stack-motor.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Reconciliados contra os Casos 1 e 16 do oráculo (frontend/fixtures/
// capital-stack-golden.ts, #270) — mesmos números, mesma leitura.

test('fluxoAposFundingMensal: sem entradas/saídas de funding, é idêntico ao fluxo livre', () => {
  const fluxoLivre = [0, 100, 100, 100];
  const r = fluxoAposFundingMensal(fluxoLivre, [], []);
  assert.deepEqual(r, [0, 100, 100, 100]);
});

test('fluxoAposFundingMensal: soma entradas e subtrai saídas mês a mês', () => {
  const r = fluxoAposFundingMensal([0, -200, -200, 300], [0, 200, 200, 0], [0, 0, 0, 0]);
  assert.deepEqual(r, [0, 0, 0, 300]);
});

test('caixaAcumuladoMensal: soma corrida, mês 0 sempre zero', () => {
  assert.deepEqual(caixaAcumuladoMensal([0, 100, 100, 100]), [0, 100, 200, 300]);
  assert.deepEqual(caixaAcumuladoMensal([0, -200, -200, 300]), [0, -200, -400, -100]);
});

test('necessidadeFundingMensal: máximo(0, reserva − caixa) — Caso 16 do oráculo', () => {
  const caixaProjeto = [0, 300, -200, 0];
  assert.deepEqual(necessidadeFundingMensal(caixaProjeto, 0), [0, 0, 200, 0]);
});

test('necessidadeFundingMensal: reserva mínima positiva também gera necessidade com caixa positivo insuficiente', () => {
  assert.deepEqual(necessidadeFundingMensal([0, 50, 150], 100), [0, 50, 0]);
});

test('caixaDistribuivelMensal: nunca fica negativo mesmo com reserva alta', () => {
  assert.deepEqual(caixaDistribuivelMensal([0, 500, 50], 100), [0, 400, 0]);
});

test('caixaDistribuivelMensal: desconta obrigações futuras protegidas quando informadas', () => {
  assert.deepEqual(caixaDistribuivelMensal([0, 500], 100, [0, 100]), [0, 300]);
});

// #240-style: reconciliação fechada — Caso 1 (sem funding, sem lacuna).
test('reconciliarCapitalStack: Caso 1 do oráculo — projeto sem funding', () => {
  const r = reconciliarCapitalStack([0, 100, 100, 100], [], [], 0);
  assert.deepEqual(r.caixaProjetoMensal, [0, 100, 200, 300]);
  assert.equal(r.lacunaFundingMaxima, 0);
});

// Caso 16 — sem nenhum instrumento (entradas/saídas zero), o fluxo livre não
// muda; a lacuna é só informativa.
test('reconciliarCapitalStack: Caso 16 do oráculo — sem instrumentos, fluxo livre intocado', () => {
  const r = reconciliarCapitalStack([0, 300, -500, 200], [0, 0, 0], [0, 0, 0], 0);
  assert.deepEqual(r.fluxoAposFundingMensal, [0, 300, -500, 200]);
  assert.deepEqual(r.caixaProjetoMensal, [0, 300, -200, 0]);
  assert.deepEqual(r.necessidadeFundingMensal, [0, 0, 200, 0]);
  assert.equal(r.lacunaFundingMaxima, 200);
});

// ── Adaptador de camadas reais (FIN-04+05+06+07, #273-276) ────────────────

test('custoElegivelMensalDeLinhas: soma só as linhas selecionadas, 1-based', () => {
  const linhasCusto = [{ id: 1, mensal: [100, 100, 100] }, { id: 2, mensal: [50, 50, 50] }];
  assert.deepEqual(custoElegivelMensalDeLinhas(linhasCusto, [1], 3), [0, 100, 100, 100]);
  assert.deepEqual(custoElegivelMensalDeLinhas(linhasCusto, [1, 2], 3), [0, 150, 150, 150]);
  assert.deepEqual(custoElegivelMensalDeLinhas(linhasCusto, undefined, 3), [0, 0, 0, 0]);
  assert.deepEqual(custoElegivelMensalDeLinhas(linhasCusto, [], 3), [0, 0, 0, 0]);
});

test('instrumentoDeRegistro: financiamento_producao carrega compromisso/prioridade da coluna e taxa/política do config', () => {
  const registro = {
    tipo: 'financiamento_producao', nome: 'Financiamento', compromisso: 1000, prioridade_funding: 1,
    config: { taxaAnual: 0.12, politicaAmortizacao: 'cash_sweep', percentualFinanciavel: 0.8 },
  };
  const inst = instrumentoDeRegistro(registro, [0, 500]);
  assert.equal(inst?.tipo, 'divida');
  if (inst?.tipo !== 'divida') throw new Error('esperava divida');
  assert.equal(inst.nome, 'Financiamento');
  assert.equal(inst.limiteComprometido, 1000);
  assert.equal(inst.prioridadeFunding, 1);
  assert.equal(inst.percentualFinanciavel, 0.8);
  assert.deepEqual(inst.custoElegivelMensal, [0, 500]);
  assert.ok(Math.abs(inst.taxaMensal - (Math.pow(1.12, 1 / 12) - 1)) < 1e-9);
});

test('instrumentoDeRegistro: capital_giro nunca recebe custoElegivelMensal, mesmo se passado', () => {
  const registro = { tipo: 'capital_giro', nome: 'Giro', compromisso: 500, prioridade_funding: 2, config: { taxaAnual: 0 } };
  const inst = instrumentoDeRegistro(registro, [0, 999]);
  assert.equal(inst?.tipo, 'divida');
  if (inst?.tipo !== 'divida') throw new Error('esperava divida');
  assert.equal(inst.custoElegivelMensal, undefined);
});

test('instrumentoDeRegistro: preferred_equity usa defaults (modo A, capitalização simples) sem config completo', () => {
  const inst = instrumentoDeRegistro({ tipo: 'preferred_equity', nome: 'PE', config: {} });
  assert.equal(inst?.tipo, 'preferred_equity');
  if (inst?.tipo !== 'preferred_equity') throw new Error('esperava preferred_equity');
  assert.equal(inst.modo, 'A');
  assert.equal(inst.capitalizacao, 'simples');
  assert.deepEqual(inst.aportes, []);
});

test('instrumentoDeRegistro: sponsor_equity coage cobreLacunaAutomatica para booleano', () => {
  const inst = instrumentoDeRegistro({ tipo: 'sponsor_equity', nome: 'Sponsor', config: { cobreLacunaAutomatica: true } });
  assert.equal(inst?.tipo, 'sponsor_equity');
  assert.equal((inst as any).cobreLacunaAutomatica, true);
  const inst2 = instrumentoDeRegistro({ tipo: 'sponsor_equity', nome: 'Sponsor', config: {} });
  assert.equal((inst2 as any).cobreLacunaAutomatica, false);
});

test('instrumentoDeRegistro: tipo desconhecido devolve null (defensivo)', () => {
  assert.equal(instrumentoDeRegistro({ tipo: 'nao_existe' }), null);
  assert.equal(instrumentoDeRegistro(null), null);
});

test('simularCapitalStackDoEstudo: só camadas ATIVAS participam — rascunho/revisão fica sem efeito (§13.3)', () => {
  const registros = [
    { tipo: 'capital_giro', nome: 'Giro', status: 'ativo', compromisso: 1000, prioridade_funding: 1, config: { taxaAnual: 0, politicaAmortizacao: 'cash_sweep' } },
    // Sponsor cobriria a lacuna se estivesse ativo — está em rascunho, deve ser ignorado por completo.
    { tipo: 'sponsor_equity', nome: 'SponsorRascunho', status: 'rascunho', config: { cobreLacunaAutomatica: true } },
  ];
  const r = simularCapitalStackDoEstudo([0, -500, 600], [0, 0, 0], registros, [], 0);
  assert.deepEqual(r.liberacaoPorInstrumento['Giro'], [0, 500, 0]);
  assert.deepEqual(r.aporteSponsorMensal, [0, 0, 0]);
  assert.deepEqual(r.lacunaFundingMensal, [0, 0, 0]);
  assert.ok(perto(r.caixaProjetoMensal[2], 100));
});

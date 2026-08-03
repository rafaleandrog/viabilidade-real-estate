import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fluxoAposFundingMensal, caixaAcumuladoMensal, necessidadeFundingMensal,
  caixaDistribuivelMensal, reconciliarCapitalStack,
  custoElegivelMensalDeLinhas, instrumentoDeRegistro, simularCapitalStackDoEstudo,
  simularCapitalStack, type InstrumentoPreferredEquity, type InstrumentoDivida, type InstrumentoSponsorEquity,
  fundingEntradasSaidasMensal, pmtPrice, tirMensal, tirAnual,
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

test('instrumentoDeRegistro: divida com politicaAmortizacao=price carrega carência e prazo', () => {
  const registro = {
    tipo: 'capital_giro', nome: 'CapGiro', compromisso: 1_000_000, prioridade_funding: 1,
    config: { taxaAnual: 0.12, politicaAmortizacao: 'price', carenciaMeses: 3, prazoMeses: 15 },
  };
  const inst = instrumentoDeRegistro(registro);
  assert.equal(inst?.tipo, 'divida');
  if (inst?.tipo !== 'divida') throw new Error('esperava divida');
  assert.equal(inst.politicaAmortizacao, 'price');
  assert.equal(inst.carenciaMeses, 3);
  assert.equal(inst.prazoMeses, 15);
});

test('instrumentoDeRegistro: preferred_equity modo D carrega percentualLucro/mesEntregaLucro/parcelasLucro', () => {
  const registro = {
    tipo: 'preferred_equity', nome: 'PE',
    config: { modo: 'D', percentualLucro: 0.10, mesEntregaLucro: 12, parcelasLucro: 4 },
  };
  const inst = instrumentoDeRegistro(registro);
  assert.equal(inst?.tipo, 'preferred_equity');
  if (inst?.tipo !== 'preferred_equity') throw new Error('esperava preferred_equity');
  assert.equal(inst.modo, 'D');
  assert.equal(inst.percentualLucro, 0.10);
  assert.equal(inst.mesEntregaLucro, 12);
  assert.equal(inst.parcelasLucro, 4);
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

// Achado da segunda verificação (2026-08-02): o código pagava a remuneração
// ANTES do principal — invertido em relação ao §6.1 do doc ("Ordem padrão
// obrigatória": item 4 = devolução de principal, item 5 = remuneração
// preferencial). Os 16 golden cases não pegaram porque nenhum tinha caixa
// insuficiente para os dois no mesmo mês — corrigido, e este teste isola
// exatamente esse cenário para não regredir.
test('#6.1: Preferred Equity modo A paga PRINCIPAL antes da remuneração quando o caixa não cobre os dois', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 1000 }],
    modo: 'A', taxaMensal: 0.10, capitalizacao: 'simples', prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'ordem-waterfall', meses: 1, fluxoLivreMensal: [0, 50], reservaMinima: 0, instrumentos: [pe],
  });
  // Caixa distribuível = 1050; principal (1000) + remuneração (100) = 1100 > 1050.
  assert.equal(r.devolucaoPrincipalPE['PE'][1], 1000);
  assert.equal(r.remuneracaoPagaPE['PE'][1], 50); // só o que sobrou do caixa
  assert.equal(r.capitalNaoDevolvidoFinalPE['PE'], 0);
  assert.equal(r.remuneracaoAcumuladaFinalPE['PE'], 50); // 100 devido − 50 pago, fica pendente
});

// Achado da segunda verificação (2026-08-02): `prioridade_pagamento` é coluna
// real do schema (avancado_capital_instrumentos) e campo listado no §9 do
// doc como distinto de `prioridade_funding`, mas até aqui o motor reusava a
// MESMA ordem (por prioridadeFunding) tanto para captar quanto para pagar —
// e as Preferred Equity nem tinham ordem alguma entre si. Nenhum dos 16
// golden cases (#270) tem 2+ instrumentos do mesmo tipo, então isso nunca
// foi exercido. Este teste isola 2 dívidas com prioridade de FUNDING
// invertida da de PAGAMENTO — se o motor confundisse as duas ordens, a
// dívida "B" (funding=2, pagamento=1) seria amortizada depois da "A".
test('§9: prioridade de pagamento entre dívidas é independente da prioridade de funding', () => {
  const a: InstrumentoDivida = {
    tipo: 'divida', nome: 'A', limiteComprometido: 1000, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 1, prioridadePagamento: 2,
  };
  const b: InstrumentoDivida = {
    tipo: 'divida', nome: 'B', limiteComprometido: 1000, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 2, prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'ordem-pagamento', meses: 2, fluxoLivreMensal: [0, -1500, 1200], reservaMinima: 0, instrumentos: [a, b],
  });
  // Mês 1: necessidade de 1500 coberta por funding em ordem de FUNDING (A primeiro, então B).
  assert.deepEqual(r.liberacaoPorInstrumento['A'][1], 1000);
  assert.deepEqual(r.liberacaoPorInstrumento['B'][1], 500);
  // Mês 2: 1200 de caixa sweep em ordem de PAGAMENTO (B primeiro, então A) — B (saldo 500) zera
  // e sobra 700 para A (saldo 1000), não o inverso.
  assert.equal(r.amortizacaoPorInstrumento['B'][2], 500);
  assert.equal(r.amortizacaoPorInstrumento['A'][2], 700);
  assert.equal(r.saldoDividaPorInstrumento['B'][2], 0);
  assert.equal(r.saldoDividaPorInstrumento['A'][2], 300);
});

// §10: fonte única de agregação Funding Entradas/Saídas, consumida pelo
// gráfico mensal (tela-capital-stack.ts) e pela tabela/exportação
// (fluxo-tabela.ts/exportar.ts) — precisa somar exatamente as mesmas linhas
// que a árvore do doc lista, nem mais nem menos.
test('fundingEntradasSaidasMensal: soma liberação de dívida como entrada, juros+amortização como saída', () => {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Fin', limiteComprometido: 1000, taxaMensal: 0.01,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 1, prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'entradas-saidas', meses: 2, fluxoLivreMensal: [0, -500, 800], reservaMinima: 0, instrumentos: [fin],
  });
  const { entradas, saidas } = fundingEntradasSaidasMensal(r);
  assert.deepEqual(entradas, [0, 500, 0]);
  assert.deepEqual(saidas, [0, 0, 510]);
});

// §10 "Saldos": a série mensal precisa existir (não só o valor final) para a
// tabela mostrar a evolução mês a mês — o último ponto da série tem que
// bater com o `*FinalPE` que já era exposto.
test('capitalNaoDevolvidoPorInstrumentoPE/remuneracaoAcumuladaPorInstrumentoPE: série mensal bate com o valor final', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 1000 }],
    modo: 'A', taxaMensal: 0.10, capitalizacao: 'simples', prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    // fluxoLivre[1] = -1000 absorve o próprio aporte no mês 1 — sem isso, o
    // aporte entraria em caixa e pagaria a si mesmo de volta no mesmo mês.
    nome: 'saldos-mensais', meses: 2, fluxoLivreMensal: [0, -1000, 0], reservaMinima: 0, instrumentos: [pe],
  });
  // Sem caixa distribuível nos 2 meses, nada é pago: saldo cresce só por juros acumulados.
  assert.deepEqual(r.capitalNaoDevolvidoPorInstrumentoPE['PE'], [0, 1000, 1000]);
  assert.deepEqual(r.remuneracaoAcumuladaPorInstrumentoPE['PE'], [0, 100, 200]);
  assert.equal(r.capitalNaoDevolvidoPorInstrumentoPE['PE'][2], r.capitalNaoDevolvidoFinalPE['PE']);
  assert.equal(r.remuneracaoAcumuladaPorInstrumentoPE['PE'][2], r.remuneracaoAcumuladaFinalPE['PE']);
});

// Achado da segunda verificação (2026-08-02), decisão do autor: com 2+
// Sponsor Equity ativos, o motor usava `.find()` — só o primeiro participava,
// o segundo ficava silenciosamente sem efeito mesmo com `cobreLacunaAutomatica:
// true`. Corrigido para ratear pro-rata pelo aporte acumulado; sem nenhum
// aporte ainda (caso deste teste), divide igualmente entre os ativos.
test('múltiplos Sponsor Equity: lacuna e resíduo se dividem igualmente sem aporte prévio, depois pro-rata pelo acumulado', () => {
  const a: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'A', cobreLacunaAutomatica: true };
  const b: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'B', cobreLacunaAutomatica: true };
  const r = simularCapitalStack({
    nome: 'multi-sponsor', meses: 2, fluxoLivreMensal: [0, -300, 100], reservaMinima: 0, instrumentos: [a, b],
  });
  // Mês 1: nenhum aportou ainda — lacuna de 300 dividida 50/50.
  assert.equal(r.aportePorInstrumentoSponsor['A'][1], 150);
  assert.equal(r.aportePorInstrumentoSponsor['B'][1], 150);
  assert.equal(r.aporteSponsorMensal[1], 300);
  // Mês 2: sem % de receita própria, o resíduo (100) é pool compartilhado —
  // agora pro-rata pelo que cada um já aportou (150 cada, ainda 50/50).
  assert.equal(r.distribuicaoPorInstrumentoSponsor['A'][2], 50);
  assert.equal(r.distribuicaoPorInstrumentoSponsor['B'][2], 50);
  assert.equal(r.distribuicaoSponsorMensal[2], 100);
});

// Achado da 3ª rodada (2026-08-03) — o autor apontou a planilha real
// `20260730_EVI_Urbita_corrigido.xlsx`, aba "Incorp Individual", colunas
// CK:CQ (Capital de Giro) como referência: liberação única, carência (juros
// pagos em caixa, principal intocado) e amortização Price (parcela fixa,
// calculada uma vez sobre o saldo ao entrar na fase). Este teste reproduz o
// oráculo EXATO das fórmulas do Excel: Volume=1.000.000, MesTomada=1,
// JurosAA=12%, Carência=3, Prazo total=15 (amortização=12 meses). O oráculo
// (réplica das fórmulas CK:CQ, verificado à mão) zera em t=16.
test('price: carência (juros pagos, principal intocado) + amortização Price — reproduz o oráculo da planilha', () => {
  const taxaMensal = Math.pow(1.12, 1 / 12) - 1;
  const divida: InstrumentoDivida = {
    tipo: 'divida', nome: 'CapGiro', limiteComprometido: 1_000_000, taxaMensal,
    politicaAmortizacao: 'price', carenciaMeses: 3, prazoMeses: 15,
    liberacaoProgramada: [{ mes: 1, valor: 1_000_000 }],
    prioridadeFunding: 1, prioridadePagamento: 1,
  };
  // Caixa abundante — fluxoLivreMensal irrelevante aqui, só a dívida move o caixa do projeto.
  const fluxoLivreMensal = new Array(19).fill(0);
  const r = simularCapitalStack({
    nome: 'price-carencia', meses: 18, fluxoLivreMensal, reservaMinima: -10_000_000, instrumentos: [divida],
  });
  assert.equal(r.liberacaoPorInstrumento['CapGiro'][1], 1_000_000);
  // Carência: meses 2,3,4 pagam só juros — saldo fica achatado em 1.000.000.
  for (const t of [2, 3, 4]) {
    assert.equal(r.saldoDividaPorInstrumento['CapGiro'][t], 1_000_000);
    assert.ok(r.amortizacaoPorInstrumento['CapGiro'][t] > 0);
  }
  // Parcela fixa: PMT(taxaMensal, 12, 1_000_000) — mesmo valor todo mês da fase de amortização.
  const parcelaEsperada = pmtPrice(taxaMensal, 12, 1_000_000);
  for (const t of [5, 6, 10, 15]) {
    assert.ok(Math.abs(r.amortizacaoPorInstrumento['CapGiro'][t] - parcelaEsperada) < 0.01);
  }
  // Zera exatamente no mês 16 (12ª parcela: meses 5..16).
  assert.equal(r.saldoDividaPorInstrumento['CapGiro'][16], 0);
  assert.equal(r.saldoDividaPorInstrumento['CapGiro'][17], 0);
});

test('price: caixa insuficiente na carência não força saldo negativo (§12.2) — divergência deliberada da planilha', () => {
  const divida: InstrumentoDivida = {
    tipo: 'divida', nome: 'CapGiro', limiteComprometido: 1_000_000, taxaMensal: 0.01,
    politicaAmortizacao: 'price', carenciaMeses: 2, prazoMeses: 10,
    liberacaoProgramada: [{ mes: 1, valor: 1_000_000 }],
    prioridadeFunding: 1, prioridadePagamento: 1,
  };
  // O próprio mês da liberação gasta tudo (obra consome o 1M no ato) — não
  // sobra caixa nenhum para pagar os juros da carência no mês seguinte.
  const r = simularCapitalStack({
    nome: 'price-sem-caixa', meses: 3, fluxoLivreMensal: [0, -1_000_000, 0, 0], reservaMinima: 0, instrumentos: [divida],
  });
  assert.equal(r.amortizacaoPorInstrumento['CapGiro'][2], 0);
  // Saldo cresce (juros não pagos) em vez de ficar negativo ou forçar pagamento sem caixa.
  assert.ok(r.saldoDividaPorInstrumento['CapGiro'][2] > 1_000_000);
});

test('múltiplos Sponsor Equity: % de receita líquida é contratual e independente — não é rateado', () => {
  const a: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'A', cobreLacunaAutomatica: false, percentualReceitaLiquida: 0.10 };
  const b: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'B', cobreLacunaAutomatica: false, percentualReceitaLiquida: 0.05 };
  const r = simularCapitalStack({
    nome: 'multi-sponsor-pct', meses: 1, fluxoLivreMensal: [0, 1000], receitaLiquidaMensal: [0, 1000],
    reservaMinima: 0, instrumentos: [a, b],
  });
  assert.equal(r.distribuicaoPorInstrumentoSponsor['A'][1], 100);
  assert.equal(r.distribuicaoPorInstrumentoSponsor['B'][1], 50);
  assert.equal(r.distribuicaoSponsorMensal[1], 150);
});

// §8.3: TIR por instrumento (aportes negativos, recebimentos positivos) —
// achado da 3ª rodada (2026-08-03): o comentário do código já citava
// "MOIC/ROI/TIR" desde a Fase 9, mas só MOIC e ROI tinham sido implementados.
test('tirMensal/tirAnual: caso analítico simples — 1000 hoje vira 1200 em 12 meses', () => {
  const fluxo = new Array(13).fill(0);
  fluxo[0] = -1000; fluxo[12] = 1200;
  const anual = tirAnual(fluxo);
  assert.ok(anual !== null);
  assert.ok(Math.abs(anual! - 0.20) < 0.001);
});

test('tirMensal: sem troca de sinal (só saída ou só entrada) não tem TIR — devolve null', () => {
  assert.equal(tirMensal([0, -100, -100]), null);
  assert.equal(tirMensal([0, 100, 100]), null);
  assert.equal(tirMensal([0, 0, 0]), null);
});

// Modo D (2026-08-03) — % do lucro FINAL do projeto (não de um mês
// específico), parcelado a partir do mês seguinte à entrega/fim de obras.
// Achado no pedido do autor: a base tem que ser o resultado do projeto
// inteiro, só conhecido no fim do horizonte — computável porque o motor já
// recebe `fluxoLivreMensal` inteiro de uma vez, não em streaming.
test('modo D: % do lucro final parcelado igualmente a partir do mês seguinte à entrega', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 1_000_000 }],
    modo: 'D', percentualLucro: 0.10, mesEntregaLucro: 12, parcelasLucro: 4, prioridadePagamento: 1,
  };
  // Fluxo livre soma 5.000.000 ao longo do horizonte (lucro final do projeto) —
  // 10% disso = 500.000, dividido em 4 parcelas de 125.000 cada.
  const fluxoLivreMensal = new Array(17).fill(0);
  fluxoLivreMensal[16] = 5_000_000; // todo o "lucro" chega no fim, caixa abundante lá
  const r = simularCapitalStack({
    nome: 'modo-d', meses: 16, fluxoLivreMensal, reservaMinima: -10_000_000, instrumentos: [pe],
  });
  assert.deepEqual([13, 14, 15, 16].map((t) => r.participacaoLucroPE['PE'][t]), [125000, 125000, 125000, 125000]);
  assert.equal(r.participacaoLucroPE['PE'][12], 0); // mês da entrega em si — ainda não paga
  assert.equal(r.participacaoLucroPE['PE'][17] ?? 0, 0); // depois das 4 parcelas, não paga mais
});

test('modo D: lucro negativo não gera pagamento (participação sobre prejuízo não existe)', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 1_000_000 }],
    modo: 'D', percentualLucro: 0.10, mesEntregaLucro: 2, parcelasLucro: 2, prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'modo-d-prejuizo', meses: 5, fluxoLivreMensal: [0, -1_000_000, 0, 0, 0, 0],
    reservaMinima: -10_000_000, instrumentos: [pe],
  });
  assert.deepEqual([3, 4, 5].map((t) => r.participacaoLucroPE['PE'][t]), [0, 0, 0]);
});

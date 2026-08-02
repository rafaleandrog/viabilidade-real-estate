import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simularCapitalStack, moic, roi,
  type CenarioCapitalStack, type InstrumentoDivida, type InstrumentoPreferredEquity, type InstrumentoSponsorEquity,
} from './capital-stack-golden.js';

// ─────────────────────────────────────────────────────────────────────────
// Os 16 casos de teste de referência do §14 (docs/viabilidade/funding-
// capital-stack.md). Cada cenário usa números redondos, verificados por
// invariante fechada (ver comentário no topo de capital-stack-golden.ts) —
// não há planilha externa de Capital Stack para reproduzir linha a linha
// como a Calliandra tem para recebíveis.
// ─────────────────────────────────────────────────────────────────────────

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// 1 — Projeto sem funding
test('Caso 1: projeto sem funding — caixa acompanha o fluxo livre, sem lacuna', () => {
  const cen: CenarioCapitalStack = { nome: '1', meses: 3, fluxoLivreMensal: [0, 100, 100, 100], reservaMinima: 0, instrumentos: [] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.caixaProjetoMensal, [0, 100, 200, 300]);
  assert.equal(r.lacunaFundingMaxima, 0);
});

// 2 — Sponsor automático cobrindo toda a exposição
test('Caso 2: sponsor automático cobre toda a exposição negativa e recebe o resíduo depois', () => {
  const sponsor: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'Sponsor', cobreLacunaAutomatica: true };
  const cen: CenarioCapitalStack = { nome: '2', meses: 3, fluxoLivreMensal: [0, -200, -200, 300], reservaMinima: 0, instrumentos: [sponsor] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.aporteSponsorMensal, [0, 200, 200, 0]);
  assert.deepEqual(r.distribuicaoSponsorMensal, [0, 0, 0, 300]);
  assert.deepEqual(r.caixaProjetoMensal, [0, 0, 0, 0]);
  assert.equal(r.lacunaFundingMaxima, 0);
});

// 3 — Financiamento à produção com custo elegível, liberações mensais e cash sweep
test('Caso 3: financiamento por custo elegível libera mês a mês e o excedente quita via cash sweep', () => {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Financiamento', limiteComprometido: 10_000, taxaMensal: 0.01,
    politicaAmortizacao: 'cash_sweep', custoElegivelMensal: [0, 1000, 1000, 1000], percentualFinanciavel: 0.8,
    prioridadeFunding: 1,
  };
  const cen: CenarioCapitalStack = { nome: '3', meses: 3, fluxoLivreMensal: [0, -800, -800, 2000], reservaMinima: 0, instrumentos: [fin] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.liberacaoPorInstrumento['Financiamento'], [0, 800, 800, 0]);
  assert.deepEqual(r.jurosPorInstrumento['Financiamento'], [0, 0, 8, 16.08]);
  assert.deepEqual(r.saldoDividaPorInstrumento['Financiamento'], [0, 800, 1608, 0]);
  assert.ok(perto(r.amortizacaoPorInstrumento['Financiamento'][3], 1624.08));
  assert.ok(perto(r.caixaProjetoMensal[3], 375.92));
});

// 4 — Financiamento com taxa zero
test('Caso 4: taxa zero não produz juros — saldo só reflete liberação e amortização', () => {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Financiamento', limiteComprometido: 5000, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', custoElegivelMensal: [0, 1000, 1000], percentualFinanciavel: 1,
    prioridadeFunding: 1,
  };
  const cen: CenarioCapitalStack = { nome: '4', meses: 2, fluxoLivreMensal: [0, -1000, 1500], reservaMinima: 0, instrumentos: [fin] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.jurosPorInstrumento['Financiamento'], [0, 0, 0]);
  assert.deepEqual(r.saldoDividaPorInstrumento['Financiamento'], [0, 1000, 0]);
  assert.deepEqual(r.amortizacaoPorInstrumento['Financiamento'], [0, 0, 1000]);
  assert.deepEqual(r.caixaProjetoMensal, [0, 0, 500]);
});

// 5 — Financiamento atingindo o limite antes do fim da obra
test('Caso 5: financiamento atinge o limite comprometido e o restante vira lacuna de funding', () => {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Financiamento', limiteComprometido: 1500, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', custoElegivelMensal: [0, 1000, 1000, 1000], percentualFinanciavel: 1,
    prioridadeFunding: 1,
  };
  const cen: CenarioCapitalStack = { nome: '5', meses: 3, fluxoLivreMensal: [0, -1000, -1000, -1000], reservaMinima: 0, instrumentos: [fin] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.liberacaoPorInstrumento['Financiamento'], [0, 1000, 500, 0]);
  assert.deepEqual(r.lacunaFundingMensal, [0, 0, 500, 1500]);
  assert.equal(r.lacunaFundingMaxima, 1500);
  // #4.3: "não deve liberar mais dívida apenas porque o limite existe" —
  // limite (1500) já foi atingido no mês 2; mês 3 não libera nada, mesmo
  // com mais custo elegível incorrido.
  assert.equal(r.liberacaoPorInstrumento['Financiamento'][3], 0);
});

// 6 — Capital de giro automático durante descasamento
test('Caso 6: capital de giro cobre descasamento sem depender de custo elegível', () => {
  const giro: InstrumentoDivida = {
    tipo: 'divida', nome: 'Giro', limiteComprometido: 2000, taxaMensal: 0.02,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 1,
  };
  const cen: CenarioCapitalStack = { nome: '6', meses: 3, fluxoLivreMensal: [0, -500, -500, 2000], reservaMinima: 0, instrumentos: [giro] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.liberacaoPorInstrumento['Giro'], [0, 500, 500, 0]);
  assert.deepEqual(r.jurosPorInstrumento['Giro'], [0, 0, 10, 20.2]);
  assert.ok(perto(r.amortizacaoPorInstrumento['Giro'][3], 1030.2));
  assert.ok(perto(r.caixaProjetoMensal[3], 969.8));
});

// 7 — Dívida bullet com juros capitalizados
test('Caso 7: bullet capitaliza juros até o vencimento e quita o saldo inteiro de uma vez', () => {
  const bullet: InstrumentoDivida = {
    tipo: 'divida', nome: 'Bullet', limiteComprometido: 1000, taxaMensal: 0.01,
    politicaAmortizacao: 'bullet', vencimentoMes: 3, prioridadeFunding: 1,
    liberacaoProgramada: [{ mes: 1, valor: 1000 }],
  };
  const cen: CenarioCapitalStack = { nome: '7', meses: 3, fluxoLivreMensal: [0, 0, 0, 2000], reservaMinima: 0, instrumentos: [bullet] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.saldoDividaPorInstrumento['Bullet'], [0, 1000, 1010, 0]);
  assert.ok(perto(r.jurosPorInstrumento['Bullet'][3], 10.1));
  assert.ok(perto(r.amortizacaoPorInstrumento['Bullet'][3], 1020.1));
  assert.ok(perto(r.caixaProjetoMensal[3], 1979.9));
});

// 8 — Preferred Equity com aporte único, retorno preferencial e devolução de principal
test('Caso 8: Preferred Equity modo A (simples) — remuneração sobre capital não devolvido, depois principal', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 1000 }],
    modo: 'A', taxaMensal: 0.02, capitalizacao: 'simples',
  };
  const cen: CenarioCapitalStack = { nome: '8', meses: 3, fluxoLivreMensal: [0, -1000, 600, 600], reservaMinima: 0, instrumentos: [pe] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.remuneracaoPagaPE['PE'], [0, 0, 40, 8.8]);
  assert.deepEqual(r.devolucaoPrincipalPE['PE'], [0, 0, 560, 440]);
  assert.equal(r.capitalNaoDevolvidoFinalPE['PE'], 0);
  assert.equal(r.remuneracaoAcumuladaFinalPE['PE'], 0);
  const totalDistribuido = 40 + 560 + 8.8 + 440;
  assert.ok(perto(moic(1000, totalDistribuido), 1.0488));
  assert.ok(roi(1000, totalDistribuido) > 0);
});

// 9 — Preferred Equity com 20% do residual no encerramento
test('Caso 9: Preferred Equity modo B — devolução de principal + 20% do residual, só no evento', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 1000 }],
    modo: 'B', mesEvento: 3, percentualResidualEvento: 0.20,
  };
  const sponsor: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'Sponsor', cobreLacunaAutomatica: false };
  const cen: CenarioCapitalStack = { nome: '9', meses: 3, fluxoLivreMensal: [0, -1000, 0, 2000], reservaMinima: 0, instrumentos: [pe, sponsor] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.devolucaoPrincipalPE['PE'], [0, 0, 0, 1000]);
  assert.deepEqual(r.participacaoResidualPE['PE'], [0, 0, 0, 200]);
  // Antes do evento (meses 1-2), nenhum pagamento — só no mês do evento.
  assert.equal(r.devolucaoPrincipalPE['PE'][1], 0);
  assert.equal(r.devolucaoPrincipalPE['PE'][2], 0);
  assert.deepEqual(r.distribuicaoSponsorMensal, [0, 0, 0, 800]);
  assert.deepEqual(r.caixaProjetoMensal, [0, 0, 0, 0]);
});

// 10 — Preferred Equity com 10% da receita líquida, sem devolução separada de principal
test('Caso 10: Preferred Equity modo C — % da receita líquida recebida, sem devolução de principal', () => {
  const pe: InstrumentoPreferredEquity = {
    tipo: 'preferred_equity', nome: 'PE', aportes: [{ mes: 1, valor: 500 }],
    modo: 'C', percentualReceitaLiquida: 0.10,
  };
  const sponsor: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'Sponsor', cobreLacunaAutomatica: false };
  const cen: CenarioCapitalStack = {
    nome: '10', meses: 3, fluxoLivreMensal: [0, -500, 300, 300],
    receitaLiquidaMensal: [0, 1000, 2000, 1500], reservaMinima: 0, instrumentos: [pe, sponsor],
  };
  const r = simularCapitalStack(cen);
  // Mês 1: 10% de 1000 = 100 desejado, mas caixa distribuível é 0 (aporte
  // consumido pela necessidade de funding) — não paga (§6.2: "saldo de
  // distribuição pendente", não modelado nesta referência — ver ADR).
  assert.equal(r.participacaoReceitaPE['PE'][1], 0);
  assert.deepEqual(r.participacaoReceitaPE['PE'], [0, 0, 200, 150]);
  // Nunca há devolução de principal separada no modo C.
  assert.deepEqual(r.devolucaoPrincipalPE['PE'], [0, 0, 0, 0]);
});

// 11 — Sponsor Equity com participação na receita líquida
test('Caso 11: Sponsor Equity modo participação na receita líquida (sem waterfall residual)', () => {
  const sponsor: InstrumentoSponsorEquity = {
    tipo: 'sponsor_equity', nome: 'Sponsor', cobreLacunaAutomatica: false, percentualReceitaLiquida: 0.05,
  };
  const cen: CenarioCapitalStack = {
    nome: '11', meses: 2, fluxoLivreMensal: [0, 500, 500],
    receitaLiquidaMensal: [0, 2000, 3000], reservaMinima: 0, instrumentos: [sponsor],
  };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.distribuicaoSponsorMensal, [0, 100, 150]);
  assert.deepEqual(r.caixaProjetoMensal, [0, 400, 750]);
});

// 12 — Múltiplos instrumentos com ordem de funding e waterfall
test('Caso 12: múltiplos instrumentos — a prioridade de funding decide quem cobre a necessidade primeiro', () => {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Financiamento', limiteComprometido: 600, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', custoElegivelMensal: [0, 500, 0], percentualFinanciavel: 1,
    prioridadeFunding: 1,
  };
  const giro: InstrumentoDivida = {
    tipo: 'divida', nome: 'Giro', limiteComprometido: 1000, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 2,
  };
  const sponsor: InstrumentoSponsorEquity = { tipo: 'sponsor_equity', nome: 'Sponsor', cobreLacunaAutomatica: true };
  const cen: CenarioCapitalStack = { nome: '12', meses: 2, fluxoLivreMensal: [0, -800, 0], reservaMinima: 0, instrumentos: [fin, giro, sponsor] };
  const r = simularCapitalStack(cen);
  // Financiamento (prioridade 1) é usado até seu limite disponível (500,
  // travado pelo custo elegível) antes de o Giro (prioridade 2) entrar.
  assert.equal(r.liberacaoPorInstrumento['Financiamento'][1], 500);
  assert.equal(r.liberacaoPorInstrumento['Giro'][1], 300);
  assert.equal(r.aporteSponsorMensal[1], 0); // nem precisou do sponsor
  assert.equal(r.lacunaFundingMensal[1], 0);
});

// 13 — Compromisso insuficiente gerando lacuna
test('Caso 13: compromisso insuficiente e sem sponsor — lacuna de funding não coberta', () => {
  const giro: InstrumentoDivida = {
    tipo: 'divida', nome: 'Giro', limiteComprometido: 300, taxaMensal: 0,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 1,
  };
  const cen: CenarioCapitalStack = { nome: '13', meses: 1, fluxoLivreMensal: [0, -1000], reservaMinima: 0, instrumentos: [giro] };
  const r = simularCapitalStack(cen);
  assert.equal(r.liberacaoPorInstrumento['Giro'][1], 300);
  assert.equal(r.lacunaFundingMensal[1], 700);
  assert.equal(r.lacunaFundingMaxima, 700);
  assert.equal(r.caixaProjetoMensal[1], -700);
});

// 14 — Dívida não quitada no horizonte
test('Caso 14: bullet sem caixa suficiente no vencimento — dívida termina o horizonte sem zerar (erro bloqueante, §12.2)', () => {
  const bullet: InstrumentoDivida = {
    tipo: 'divida', nome: 'Bullet', limiteComprometido: 1000, taxaMensal: 0,
    politicaAmortizacao: 'bullet', vencimentoMes: 2, prioridadeFunding: 1,
    liberacaoProgramada: [{ mes: 1, valor: 1000 }],
  };
  const cen: CenarioCapitalStack = { nome: '14', meses: 2, fluxoLivreMensal: [0, -1000, 50], reservaMinima: 0, instrumentos: [bullet] };
  const r = simularCapitalStack(cen);
  const saldoFinal = r.saldoDividaPorInstrumento['Bullet'][2];
  // A referência DOCUMENTA a falha — quem consumir este oráculo (FIN-04)
  // precisa reportá-la como erro bloqueante (§12.2), nunca escondê-la.
  assert.ok(saldoFinal > 0, 'este caso deve terminar com saldo residual — é o cenário de referência do defeito');
  assert.equal(saldoFinal, 950);
});

// 15 — Cenário adverso aumentando a necessidade de funding
test('Caso 15: cenário adverso aumenta a lacuna máxima de funding frente ao caso-base', () => {
  const cenarioComLimite = (fluxoLivreMensal: number[]): CenarioCapitalStack => ({
    nome: 'sensibilidade', meses: 3, fluxoLivreMensal, reservaMinima: 0,
    instrumentos: [{
      tipo: 'divida', nome: 'Giro', limiteComprometido: 1200, taxaMensal: 0,
      politicaAmortizacao: 'cash_sweep', prioridadeFunding: 1,
    }],
  });
  const base = simularCapitalStack(cenarioComLimite([0, -500, -500, 2000]));
  const adverso = simularCapitalStack(cenarioComLimite([0, -1000, -1000, 2000]));
  assert.equal(base.lacunaFundingMaxima, 0);
  assert.equal(adverso.lacunaFundingMaxima, 800);
  assert.ok(adverso.lacunaFundingMaxima > base.lacunaFundingMaxima);
});

// 16 — Migração de estudo legado sem alteração automática de resultado
test('Caso 16: sem nenhum instrumento configurado, o motor não altera o fluxo livre do projeto', () => {
  // #271/FIN-02: instrumentos migrados nascem em rascunho, SEM efeito no
  // motor. Um estudo ainda não migrado (instrumentos = []) precisa produzir
  // exatamente o fluxo livre acumulado — a lacuna é só um SINAL informativo,
  // nunca uma alteração do resultado.
  const cen: CenarioCapitalStack = { nome: '16', meses: 3, fluxoLivreMensal: [0, 300, -500, 200], reservaMinima: 0, instrumentos: [] };
  const r = simularCapitalStack(cen);
  assert.deepEqual(r.caixaProjetoMensal, [0, 300, -200, 0]);
  assert.deepEqual(r.lacunaFundingMensal, [0, 0, 200, 0]);
});

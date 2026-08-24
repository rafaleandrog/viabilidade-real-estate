import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cenarioEquity, codigos, MES_LANCAMENTO,
  CONFIG_E1, OPS_E1, CONFIG_E2, OPS_E2, CONFIG_E3, OPS_E3,
} from './equity-divergencias.js';

// As três provas da #469. Ver o cabeçalho de `equity-divergencias.ts` para o
// que cada caso afirma e qual issue inverteu a asserção original.
//
// ⚠️ Números capturados da `main` em 2026-08-24 (`6b8d184`), rodando a cadeia
// real. Mudou algum? Então algum PR moveu o comportamento — o diff DESTE
// arquivo é a declaração disso, e é o que se quer. O que não pode é mudar em
// silêncio.

const CENT = 0.01;

// ── E1 · retorno de equity negativo (#432) ──────────────────────────────────

test('#469 E1 · a receita líquida do mês do lançamento é NEGATIVA na saída do motor real', () => {
  const c = cenarioEquity(CONFIG_E1, OPS_E1);

  // R$ 10.000.000 de VGV: 2% de sinal recebidos (R$ 200.000) contra 6% de
  // corretagem paga integralmente no mês da venda (R$ 600.000).
  assert.equal(c.receitaLiquida[MES_LANCAMENTO], -400_000);
  // E é o ÚNICO mês negativo — o resto da série é positiva, então o carry-forward
  // tem de onde se extinguir.
  assert.equal(c.receitaLiquida.filter((v) => v < 0).length, 1);
});

test('#469 E1 · o mês negativo paga ZERO, e o déficit abate os meses seguintes (#432)', () => {
  const c = cenarioEquity(CONFIG_E1, OPS_E1);

  // A asserção ORIGINAL da #469 era "o retorno do mês é negativo". A #432
  // inverteu: paga zero.
  assert.equal(c.saidasEquityPorMes[MES_LANCAMENTO], 0);

  // Déficit de R$ 40.000 (10% de 400.000). A base mensal seguinte é
  // R$ 150.000 → R$ 15.000 de retorno: os meses 8 e 9 (índices 7 e 8) são
  // consumidos inteiros, e o mês 10 (índice 9) paga o resto.
  assert.equal(c.saidasEquityPorMes[7], 0);
  assert.equal(c.saidasEquityPorMes[8], 0);
  assert.equal(c.saidasEquityPorMes[9], 5_000);
  assert.equal(c.saidasEquityPorMes[10], 15_000);
});

test('#469 E1 · carry-forward, e NÃO `Math.max(0, …)` seco — o total distingue os dois', () => {
  const c = cenarioEquity(CONFIG_E1, OPS_E1);

  const somaBase = c.receitaLiquida.reduce((a, b) => a + b, 0);
  const somaBasePositiva = c.receitaLiquida.reduce((a, b) => a + Math.max(0, b), 0);

  // Com memória do déficit: `pct × Σ base`, o mês negativo incluído.
  assert.ok(Math.abs(c.totalPagoEquity - somaBase * 0.10) < CENT,
    `total pago ${c.totalPagoEquity} deveria ser 10% de ${somaBase}`);
  assert.ok(Math.abs(c.totalPagoEquity - 940_000) < CENT, `total pago ${c.totalPagoEquity}`);

  // Sem memória (o clamp que existia em `capital-stack-motor.ts` antes da #355)
  // o investidor receberia R$ 40.000 a mais. É este delta que separa os dois
  // mecanismos — e nenhum teste do repositório o media sobre a cadeia real.
  assert.ok(Math.abs(somaBasePositiva * 0.10 - 980_000) < CENT);
  assert.ok(c.totalPagoEquity < somaBasePositiva * 0.10);
});

test('#469 E1 · a Reconciliação não acusa RETORNO_EQUITY_NEGATIVO (#445 sobre o conserto da #432)', () => {
  const c = cenarioEquity(CONFIG_E1, OPS_E1);
  assert.equal(codigos(c.divergencias).filter((k) => k === 'RETORNO_EQUITY_NEGATIVO').length, 0);
});

// ⚠️ OBSERVAÇÃO REGISTRADA, NÃO CONSERTO (2026-08-24, #469).
//
// `RETORNO_EQUITY_EXCEDE_RECEITA` (#445) compara `Σ saídas <= receita + tol`.
// Num mês de receita líquida NEGATIVA isso é falso mesmo pagando ZERO — a
// operação não excede coisa nenhuma, ela simplesmente não paga. O E1 congela
// esse estado porque ele é a interação, não prevista, entre o carry-forward da
// #432 e a leitura mensal da #445; mudar a checagem é decisão do autor e teria
// de virar issue própria.
test('#469 E1 · o mês negativo dispara EXCEDE_RECEITA mesmo pagando zero — comportamento de hoje', () => {
  const c = cenarioEquity(CONFIG_E1, OPS_E1);
  const excede = c.divergencias.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA');
  assert.equal(excede.length, 1);
  assert.equal(excede[0].mes, MES_LANCAMENTO);
  assert.equal(c.saidasEquityPorMes[MES_LANCAMENTO], 0, 'e o valor pago no mês acusado é zero');
});

// ── E2 · teto de 100% (#435 nominal, #445 mensal) ───────────────────────────

test('#469 E2 · o MOTOR não tem portão: três operações a 40% pagam 120% da receita do mês', () => {
  const c = cenarioEquity(CONFIG_E2, OPS_E2);

  // Mês do repasse (índice 19): R$ 8.000.000 de receita líquida, R$ 9.600.000
  // pagos aos três investidores. Isto NÃO é defeito do motor — quem barra o
  // nominal é a rota (`somaRetornoExcede`, `backend/rotas/funding.ts`), que
  // recusa a terceira operação com `422` antes de ela existir. O motor
  // simular o que está gravado é o contrato.
  assert.equal(c.receitaLiquida[19], 8_000_000);
  assert.ok(Math.abs(c.saidasEquityPorMes[19] - 9_600_000) < CENT, `pago ${c.saidasEquityPorMes[19]}`);
  assert.ok(Math.abs(c.saidasEquityPorMes[19] / c.receitaLiquida[19] - 1.2) < 1e-9);
});

test('#469 E2 · a Reconciliação ACUSA o excesso mensal (#445 inverteu o "não emite nada")', () => {
  const c = cenarioEquity(CONFIG_E2, OPS_E2);

  const excede = c.divergencias.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA');
  // 11 meses: o do lançamento (receita negativa, ver a observação do E1), os
  // nove meses de parcela em que os três já voltaram a pagar (índices 10 a 18)
  // e o do repasse.
  assert.equal(excede.length, 11);
  assert.ok(excede.some((d) => d.mes === 19), 'o mês do repasse está entre os acusados');
  assert.equal(excede.every((d) => d.severidade === 'alerta'), true);
});

test('#469 E2 · sem o 4º argumento de validarFunding a checagem mensal NÃO roda — a fiação importa', () => {
  const c = cenarioEquity(CONFIG_E2, OPS_E2);

  // Esta é a metade que teste de função pura não pega: `validarFunding` aceita
  // `receitaLiquidaMensal` como parâmetro OPCIONAL, então o chamador que
  // esquecer não quebra typecheck nem teste — a checagem some em silêncio.
  assert.equal(
    codigos(c.divergenciasSemReceita).filter((k) => k === 'RETORNO_EQUITY_EXCEDE_RECEITA').length,
    0,
  );
  assert.ok(
    codigos(c.divergencias).filter((k) => k === 'RETORNO_EQUITY_EXCEDE_RECEITA').length > 0,
    'com o argumento, acusa',
  );
});

// ── E3 · resultado final e horizonte (#446) ─────────────────────────────────

test('#469 E3 · o horizonte cobre a quitação da dívida de 120 meses, e o saldo final zera (#446)', () => {
  const c = cenarioEquity(CONFIG_E3, OPS_E3);

  // `janelaDivida`: ini = 0 + 1 = 1; fim = 1 − 1 + 120 = 120 → 121 posições.
  // O último evento operacional do cronograma acaba no mês 23.
  assert.equal(c.prazo, 121);
  assert.ok(Math.abs(c.saldoFinalPorOperacao['Dívida longa']) < CENT,
    `saldo final ${c.saldoFinalPorOperacao['Dívida longa']}`);
  assert.equal(codigos(c.divergencias).filter((k) => k === 'HORIZONTE_TRUNCA_FUNDING').length, 0);
  assert.equal(codigos(c.divergencias).filter((k) => k === 'DIVIDA_FINAL_NAO_ZERA').length, 0);
});

test('#469 E3 · sem operacoesFunding no FluxoConfig a dívida volta a ser cortada — a fiação da #446', () => {
  const c = cenarioEquity(CONFIG_E3, OPS_E3, false);

  // Este é o chamador esquecido que a #446 descreve, e o estado que a asserção
  // ORIGINAL da #469 afirmava: `saldoFinal` é o do último mês do horizonte
  // curto, não o da quitação.
  assert.equal(c.prazo, 31);
  assert.ok(Math.abs(c.saldoFinalPorOperacao['Dívida longa'] - 1_688_930.88) < CENT,
    `saldo truncado ${c.saldoFinalPorOperacao['Dívida longa']}`);

  const ks = codigos(c.divergencias);
  // `HORIZONTE_TRUNCA_FUNDING` vem PRIMEIRO de propósito: sem ela o sintoma
  // aparecia só como `DIVIDA_FINAL_NAO_ZERA`, que aponta para o lugar errado.
  assert.equal(ks[0], 'HORIZONTE_TRUNCA_FUNDING');
  assert.ok(ks.includes('DIVIDA_FINAL_NAO_ZERA'));
});

test('#469 E3 · resultado_final paga uma vez, no mês do repasse, sobre o fluxo acumulado final', () => {
  const c = cenarioEquity(CONFIG_E3, OPS_E3);

  const mesesComPagamento = c.saidasEquityPorMes
    .map((v, i) => [i, v] as const)
    .filter(([, v]) => v !== 0);
  assert.equal(mesesComPagamento.length, 1, 'pagamento único');

  const [mes, valor] = mesesComPagamento[0];
  assert.equal(mes, c.mesRepasseValor);
  assert.equal(mes, 19);
  // 5% do `fluxoAcumulado` do ÚLTIMO mês do horizonte — não de
  // "receita líquida − despesa" do mês, que é o que a #469 registrava como
  // divergência a conferir.
  assert.ok(Math.abs(valor - c.resultadoFinal * 0.05) < CENT,
    `pago ${valor}, 5% de ${c.resultadoFinal}`);
  assert.ok(Math.abs(valor - 220_000) < CENT, `pago ${valor}`);
});

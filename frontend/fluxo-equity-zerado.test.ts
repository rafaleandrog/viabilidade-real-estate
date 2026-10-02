import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFunding } from './fluxo-invariantes.js';
import type { FundingCalc } from './funding-motor.js';

// "1º Equity" como a tela o cria: valor 0, sem retorno (pct_retorno 0, permuta_financeira).
const equityZerado = (): FundingCalc => ({
  operacoes: [{
    operacao: { tipo: 'equity', nome: '1º Equity', valor: 0, inicio_mes: 0, pct_retorno: 0, modo_retorno: 'permuta_financeira' },
    entradas: [0, 0, 0], saidas: [0, 0, 0], fluxoInvestidor: [0, 0, 0],
    juros: [0, 0, 0], saldo: [0, 0, 0], tarifas: [0, 0, 0],
  }],
  noFluxo: {
    entradas: [0, 0, 0], saidas: [0, 0, 0], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
    fluxoMensal: [0, 0, 0], fluxoAcumulado: [0, 0, 0], vplLiquido: 0,
  },
} as unknown as FundingCalc);

const acusa = (r: ReturnType<typeof validarFunding>) => r.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA');

test('equity sem retorno (R$ 0) não "excede" a receita líquida do mês, mesmo negativa', () => {
  const r = validarFunding(equityZerado(), [0, 0, 0], undefined, [-553_323, -390_049.13, -221_733.46]);
  assert.deepEqual(acusa(r), []);
});

test('controle: retorno real acima da receita do mês continua acusando', () => {
  const calc = equityZerado();
  calc.operacoes[0].saidas = [0, 100, 0];
  calc.noFluxo.saidas = [0, 100, 0];
  const r = validarFunding(calc, [0, 0, 0], undefined, [0, 50, 0]);
  assert.equal(acusa(r).length, 1);
});

test('retorno positivo contra receita negativa acusa e a mensagem diz que a receita é negativa', () => {
  const calc = equityZerado();
  calc.operacoes[0].saidas = [0, 100, 0];
  calc.noFluxo.saidas = [0, 100, 0];
  const a = acusa(validarFunding(calc, [0, 0, 0], undefined, [0, -50, 0]));
  assert.equal(a.length, 1);
  assert.match(a[0].mensagem, /negativa/);
});

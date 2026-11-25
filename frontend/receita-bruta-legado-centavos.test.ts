import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, recebimentoBrutoMensal, vendaLiquidaContratadaMensal } from './fluxo-caixa-motor.js';
import { validarFluxoCalc } from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';

// Plano de pagamento LEGADO (entrada, parcelas e repasse, sem `componentes`) com
// curva de vendas de percentuais fracionados: a Receita Bruta conserva ao
// centavo, porque cada safra é repartida por arredondamento acumulado.

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

const FLUXO_LEGADO = {
  entrada: [{ pct: 20, parcelas: 3, descontoPct: 5 }, { pct: 10, parcelas: 1, descontoPct: 0 }],
  parcelas: [
    { pct: 30, ao_longo_obra: true, periodicidade: 'mensal' },
    { pct: 15, ao_longo_obra: false, parcelas: 7, periodicidade: 'mensal' },
  ],
};

const CASOS: { nome: string; absorcao: any }[] = [
  { nome: 'curva linear de 43 meses', absorcao: { modo: 'linear' } },
  {
    nome: 'curva personalizada 3 × 33,33%',
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 33.33 }, { mes: 13, pct: 33.33 }, { mes: 14, pct: 33.33 }] },
  },
  {
    nome: 'curva personalizada 7 × 14,29%',
    absorcao: { modo: 'personalizado', meses: [12, 13, 14, 15, 16, 17, 18].map((mes) => ({ mes, pct: 14.29 })) },
  },
];

function rodar(absorcao: any) {
  const linhasReceita = [{
    nome: 'Legado', absorcao,
    tipologias: [{ tipologia_id: 1, id: 1, quantidade: 83, area_privativa_m2: 47.3, preco_m2: 9_137.19 }],
    fluxo_pagamento: FLUXO_LEGADO,
  }];
  return calcularFluxo({
    dataInicio: null, taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 0,
    linhasReceita, linhasCusto: [], areaTerreno: 0,
  });
}

for (const { nome, absorcao } of CASOS) {
  test(`legado, ${nome}: Receita Bruta = venda líquida contratada ao centavo, sem RECEITA_BRUTA_NAO_CONSERVA`, () => {
    const calc = rodar(absorcao);
    assert.ok(calc.vendaLiquidaContratada > 0);
    const erros = validarFluxoCalc(calc).filter((d) => d.codigo === 'RECEITA_BRUTA_NAO_CONSERVA');
    assert.deepEqual(erros, []);
    assert.ok(Math.abs(calc.receitaBruta - calc.vendaLiquidaContratada) < 0.005,
      `receita ${calc.receitaBruta} ≠ contratado ${calc.vendaLiquidaContratada}`);
  });

  test(`legado, ${nome}: cada safra recebe exatamente a sua venda líquida`, () => {
    const linha = {
      absorcao,
      tipologias: [{ tipologia_id: 1, id: 1, quantidade: 83, area_privativa_m2: 47.3, preco_m2: 9_137.19 }],
      fluxo_pagamento: FLUXO_LEGADO,
    };
    const prazo = 80;
    const rec = recebimentoBrutoMensal(linha, CRONO, prazo, 0);
    const liq = vendaLiquidaContratadaMensal(linha, CRONO, prazo, 0);
    assert.ok(Math.abs(soma(rec) - soma(liq)) < 0.005, `Σ recebido ${soma(rec)} ≠ Σ líquido ${soma(liq)}`);
  });
}

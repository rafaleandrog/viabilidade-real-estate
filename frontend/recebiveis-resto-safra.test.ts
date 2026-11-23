import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, partesDaSafra, calcularRecebiveisComponentes } from './fluxo-caixa-motor.js';
import type { ComponentePagamento } from './fluxo-caixa-motor.js';
import { validarFluxoCalc } from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';

// #824: o último componente de cada safra fica com o RESTO — a soma das
// partes é exatamente o valor contratado da safra, a 2 casas.

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

function casoA(taxaAa: number, permutadas: number) {
  const taxaMensal = taxaAa > 0 ? Math.pow(1 + taxaAa / 100, 1 / 12) - 1 : 0;
  const componentes: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 41, taxaMensal, rotulo: 'repasse' },
  ];
  const linhasReceita = [{
    nome: 'Caso A',
    absorcao: { modo: 'distribuido', blocos: [
      { evento: 'lancamento', pct: 20 }, { evento: 'obra', pct: 50 }, { evento: 'pos_obra', pct: 30 },
    ] },
    tipologias: [{ tipologia_id: 1, id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: { componentes },
  }];
  const linhasCusto = permutadas > 0 ? [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: permutadas,
  }] : [];
  const calc = calcularFluxo({
    dataInicio: null, taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: taxaAa,
    linhasReceita, linhasCusto, areaTerreno: 0,
  });
  return { calc, componentes };
}

for (const taxaAa of [12.5, 0]) {
  test(`#824 caso A (com permuta, juros ${taxaAa}% a.a.): Σ principal recebido = venda contratada ao centavo, sem RECEITA_BRUTA_NAO_CONSERVA`, () => {
    const { calc } = casoA(taxaAa, 10);
    const erros = validarFluxoCalc(calc).filter((d) => d.codigo === 'RECEITA_BRUTA_NAO_CONSERVA');
    assert.deepEqual(erros, []);
    const principal = soma(calc.principalRecebidoMensal);
    assert.ok(Math.abs(principal - calc.vendaLiquidaContratada) < 0.005,
      `Σ principal ${principal} ≠ contratado ${calc.vendaLiquidaContratada}`);
  });
}

test('#824 caso B (sem permuta) continua limpo', () => {
  const { calc } = casoA(12.5, 0);
  assert.deepEqual(validarFluxoCalc(calc).filter((d) => d.codigo === 'RECEITA_BRUTA_NAO_CONSERVA'), []);
  assert.ok(Math.abs(soma(calc.principalRecebidoMensal) - calc.vendaLiquidaContratada) < 0.005);
});

test('#824 partesDaSafra: 50/50 com centavos ímpares soma exatamente o contratado', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 5, taxaMensal: 0 },
  ];
  const partes = partesDaSafra(comps, 100.01);
  assert.equal(partes[0], 50.01); // round2(50,005) sobe
  assert.equal(partes[1], 50);    // o resto
  assert.equal(Math.round(soma(partes) * 100), 10001);
});

test('#824 partesDaSafra: 33,33 / 33,33 / 33,34 fecha o contratado', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 33.33, descontoPct: 0 },
    { tipo: 'imediato', participacaoPct: 33.33, descontoPct: 0 },
    { tipo: 'imediato', participacaoPct: 33.34, descontoPct: 0 },
  ];
  const partes = partesDaSafra(comps, 1_000_000.07);
  assert.equal(Math.round(soma(partes) * 100), 100_000_007);
});

test('#824 partesDaSafra: componente com 0% não recebe o resto', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 100, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 0, mesPagamento: 5, taxaMensal: 0 },
  ];
  const partes = partesDaSafra(comps, 123.45);
  assert.deepEqual(partes, [123.45, 0]);
  assert.deepEqual(partesDaSafra([], 10), []);
});

test('#824 erro REAL de conservação continua acusado (série de juros zerada)', () => {
  const { calc } = casoA(12.5, 10);
  const quebrado = { ...calc, jurosClientesMensal: calc.jurosClientesMensal.map(() => 0), jurosClientes: 0 };
  const erros = validarFluxoCalc(quebrado as typeof calc);
  assert.ok(erros.some((d) => d.codigo === 'RECEITA_BRUTA_NAO_CONSERVA' || d.codigo === 'RECEITA_MENSAL_NAO_RECONCILIA'));
});

test('#824 calcularRecebiveisComponentes: safra com centavos ímpares 50/50 recebe exatamente o contratado', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 5, taxaMensal: 0 },
  ];
  const r = calcularRecebiveisComponentes(comps, [{ safra: 1, valorContratado: 100.01 }], 3, 8);
  assert.equal(Math.round(soma(r.principalRecebidoMensal) * 100), 10001);
});

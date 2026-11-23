import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFluxo, partesDaSafra, calcularRecebiveisComponentes, descontoComercialMensal,
  consolidarCarteiraClientes,
} from './fluxo-caixa-motor.js';
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

// Fiação do resto: o ÚLTIMO componente é quem carrega o resto, e cada caminho
// do motor precisa ler a parte resolvida (não a fatia isolada). Contratado
// 100,01: o primeiro componente (50%) sobe a 50,01 e o último fica com 50,00;
// a fatia isolada do último seria 50,01 e a soma passaria um centavo.
const CT = 100.01;
const centavos = (v: number) => Math.round(v * 100);

test('#824 fiação: último componente imediato com desconto recebe a parte do resto (valor e desconto)', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 10 },
  ];
  const r = calcularRecebiveisComponentes(comps, [{ safra: 12, valorContratado: CT }], 40, 60);
  // parte do resto = 50,00 → à vista com 10% de desconto = 45,00 (isolada: 45,01)
  assert.equal(centavos(r.receitaPorComponenteMensal.aVista[12]), 4500);
  const linha = {
    nome: 'L',
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    tipologias: [{ tipologia_id: 1, id: 1, quantidade: 1, area_privativa_m2: 1, preco_m2: CT }],
    fluxo_pagamento: { componentes: comps },
  };
  const desc = descontoComercialMensal(linha, CRONO, 60, 0);
  // 10% de 50,00 = 5,00; a fatia isolada daria 5,001, que também arredonda a 5,00 —
  // quem separa o desconto da fatia isolada é o caso de 60%, mais abaixo.
  assert.equal(centavos(soma(desc)), 500);
  // Σ principal + desconto = contratado
  assert.equal(centavos(soma(r.principalRecebidoMensal)) + centavos(soma(desc)), centavos(CT));
});

for (const variante of ['prazo_fixo', 'carteira_pos_marco'] as const) {
  test(`#824 fiação: último componente ${variante} com carteira — Σ principal = contratado e a carteira começa na parte do resto`, () => {
    const ultimo: ComponentePagamento = variante === 'prazo_fixo'
      ? { tipo: 'prazo_fixo', participacaoPct: 50, sinalPct: 0, prazoMeses: 3, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false }
      : { tipo: 'carteira_pos_marco', participacaoPct: 50, marcoMes: 20, carenciaMeses: 0, prazoMeses: 3, taxaMensal: 0 };
    const comps: ComponentePagamento[] = [
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
      ultimo,
    ];
    const r = calcularRecebiveisComponentes(comps, [{ safra: 12, valorContratado: CT }], 40, 80);
    assert.equal(centavos(soma(r.principalRecebidoMensal)), centavos(CT));
    const serie = variante === 'prazo_fixo' ? r.carteiraPorComponenteMensal.tabelaCurta : r.carteiraPorComponenteMensal.carteiraPropria;
    assert.equal(centavos(serie[12]), 5000); // isolada: 50,01
    assert.equal(centavos(serie[serie.length - 1]), 0);
    assert.equal(centavos(r.carteiraMensal[r.carteiraMensal.length - 1]), 0);
  });
}

test('#824 fiação: consolidarCarteiraClientes com centavos ímpares usa a parte do resto e zera', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
    { tipo: 'prazo_fixo', participacaoPct: 50, sinalPct: 0, prazoMeses: 3, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
  ];
  const c = consolidarCarteiraClientes(comps, [{ safra: 12, valorContratado: CT }], 40);
  assert.equal(centavos(c.mensal[12].prazoFixo), 5000); // isolada: 50,01
  assert.equal(centavos(c.mensal[12].concentrado), 5001);
  assert.equal(centavos(c.mensal[12].total), 10001);
  assert.equal(centavos(c.mensal[c.mensal.length - 1].total), 0);
});

test('#824 fiação: desconto comercial usa a parte do resto (desconto de 60% separa a fatia isolada)', () => {
  const linha = {
    nome: 'L',
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    tipologias: [{ tipologia_id: 1, id: 1, quantidade: 1, area_privativa_m2: 1, preco_m2: CT }],
    fluxo_pagamento: { componentes: [
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
      { tipo: 'imediato', participacaoPct: 50, descontoPct: 60 },
    ] },
  };
  const desc = descontoComercialMensal(linha, CRONO, 60, 0);
  assert.equal(centavos(desc[12]), 3000); // 60% de 50,00 (isolada: 60% de 50,01 = 30,01)
});

test('#824 fiação: a alocação de juros da carteira parte do saldo da parte do resto (série pinada)', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
    { tipo: 'prazo_fixo', participacaoPct: 50, sinalPct: 0, prazoMeses: 24, defasagemMeses: 1, taxaMensal: 0.01, jurosNoMesDaContratacao: false },
  ];
  const r = calcularRecebiveisComponentes(comps, [{ safra: 12, valorContratado: 14333.29 }], 40, 80);
  const esperado = [
    71.67, 69.01, 66.33, 63.62, 60.88, 58.11, 55.32, 52.5, 49.65, 46.77, 43.87, 40.93,
    37.97, 34.98, 31.95, 28.9, 25.81, 22.7, 19.55, 16.37, 13.16, 9.92, 6.65, 3.35,
  ];
  assert.deepEqual(r.jurosMensal.slice(13, 37).map(centavos), esperado.map(centavos));
});

test('#824 fiação: carteira do concentrado por último começa na parte do resto', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'prazo_fixo', participacaoPct: 50, sinalPct: 0, prazoMeses: 3, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
  ];
  const r = calcularRecebiveisComponentes(comps, [{ safra: 12, valorContratado: CT }], 40, 80);
  // o prazo fixo sobe a 50,01; o concentrado (último) fica com 50,00 (isolada: 50,01)
  assert.equal(centavos(r.carteiraPorComponenteMensal.saldoARepassar[12]), 5000);
  assert.equal(centavos(r.carteiraMensal[12]), 10001);
});

test('#824 fiação: ate_marco por último recebe a parte do resto', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 30, taxaMensal: 0 },
    { tipo: 'ate_marco', participacaoPct: 50, sinalPct: 0, marcoMes: 20, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
  ];
  const r = calcularRecebiveisComponentes(comps, [{ safra: 12, valorContratado: CT }], 40, 80);
  assert.equal(centavos(soma(r.principalRecebidoMensal)), centavos(CT));
});

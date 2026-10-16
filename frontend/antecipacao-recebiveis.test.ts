// #851 — antecipação de recebíveis como operação de Funding.
//
// O que estes testes provam, na ordem do critério de aceite da issue:
//  1. golden: lastro conhecido, cessão de 50% a 18% a.a. → VP, deságio e custo
//     efetivo conferem com cálculo independente;
//  2. taxa 0 → VP = face, deságio 0;
//  3. cessões sobre o mesmo lastro nunca passam de 100% dele;
//  4. a operação aparece no fluxo alavancado e não altera o desalavancado;
//  5. o lastro vem do motor do fluxo (`recebimentoPorSafraMensal`) e só das
//     safras vendidas até a cessão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fundingDoEstudo, indicadoresAntecipacao, recebiveisFuturosDeSafras, simularAntecipacao,
  taxaMensalEquivalente, tranchesDeInvestimento, type OperacaoFunding,
} from './funding-motor.js';
import { calcularFluxo } from './fluxo-caixa-motor.js';
import { validarFunding } from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';

const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const perto = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

const antecipacao = (over: Partial<OperacaoFunding> = {}): OperacaoFunding => ({
  id: 1, tipo: 'antecipacao_recebiveis', nome: 'Cessão', valor: 0, inicio_mes: 2,
  pct_carteira_cedida: 50, taxa_anual: 18, ...over,
});

test('#851: o lastro é o que as safras até a cessão ainda vão pagar DEPOIS dela', () => {
  const porSafra = {
    0: [100, 10, 10, 10, 10, 0],
    2: [0, 0, 50, 20, 20, 0],
    4: [0, 0, 0, 0, 70, 30],   // venda depois da cessão: fora do lastro
  };
  assert.deepEqual(recebiveisFuturosDeSafras(porSafra, 2, 6), [0, 0, 0, 30, 30, 0]);
  // A fração já cedida por uma cessão anterior sai do lastro.
  assert.deepEqual(recebiveisFuturosDeSafras(porSafra, 2, 6, { 0: 0.5 }), [0, 0, 0, 25, 25, 0]);
});

test('#851 critério 1 (golden): VP, deságio, saldo e custo efetivo contra cálculo independente', () => {
  const prazo = 20;
  const lastro = new Array<number>(prazo).fill(0);
  for (let k = 3; k <= 14; k++) lastro[k] = 10_000; // 12 parcelas depois da cessão no mês 2
  const s = simularAntecipacao(antecipacao(), lastro, prazo);

  const i = Math.pow(1.18, 1 / 12) - 1;
  assert.ok(perto(taxaMensalEquivalente(0.18), i, 1e-12));
  let vp = 0;
  for (let k = 3; k <= 14; k++) vp += 5_000 / Math.pow(1 + i, k - 2);
  vp = Math.round(vp * 100) / 100;

  assert.equal(s.entradas[2], vp);
  assert.equal(soma(s.entradas), vp);
  assert.ok(perto(soma(s.saidas), 60_000), 'as parcelas cedidas somam metade do lastro');
  assert.ok(perto(soma(s.juros), 60_000 - vp), 'deságio = face − VP');
  assert.equal(s.saldo[14], 0, 'o lastro zera na última parcela cedida');
  assert.ok(s.saldo.every((v) => v >= 0));
  const ind = indicadoresAntecipacao(s);
  assert.ok(perto(ind.valorFace, 60_000));
  assert.equal(ind.valorPresente, vp);
  assert.equal(ind.valorLiquido, vp, 'sem tarifas, o líquido é o próprio VP');
  // Sem tarifas o custo efetivo é a própria taxa de desconto.
  assert.ok(ind.custoEfetivoAnual !== null && perto(ind.custoEfetivoAnual, 0.18, 0.001), `custo ${ind.custoEfetivoAnual}`);

  // Com tarifas o custo efetivo sobe, e o líquido cai.
  const comTarifas = indicadoresAntecipacao(simularAntecipacao(
    antecipacao({ taxa_estruturacao_pct: 2, outros_encargos_iniciais: 500, taxa_administracao_mensal: 100 }), lastro, prazo));
  assert.ok(perto(comTarifas.valorLiquido, vp - Math.round(vp * 2) / 100 - 500));
  assert.ok(perto(comTarifas.tarifas, Math.round(vp * 2) / 100 + 500 + 12 * 100));
  assert.ok(comTarifas.custoEfetivoAnual! > 0.18);
});

test('#851 critério 2: taxa zero → valor presente igual à face, deságio zero', () => {
  const lastro = [0, 0, 0, 1_000, 1_000, 1_000];
  const ind = indicadoresAntecipacao(simularAntecipacao(antecipacao({ taxa_anual: 0, pct_carteira_cedida: 100 }), lastro, 6));
  assert.equal(ind.valorPresente, 3_000);
  assert.equal(ind.desagio, 0);
});

test('#851: sem lastro (ou 0% cedido) a operação sai zerada, sem erro', () => {
  for (const s of [
    simularAntecipacao(antecipacao(), new Array(10).fill(0), 10),
    simularAntecipacao(antecipacao({ pct_carteira_cedida: 0 }), [0, 0, 0, 500, 500, 0, 0, 0, 0, 0], 10),
  ]) {
    assert.equal(soma(s.entradas), 0);
    assert.equal(soma(s.saidas), 0);
  }
});

test('#851 critério 3: duas cessões sobre o mesmo lastro nunca passam de 100%, e a ordem do array não importa', () => {
  const prazo = 12;
  const porSafra = { 0: [0, 0, 0, 0, 1_000, 1_000, 1_000, 1_000, 0, 0, 0, 0] };
  const livre = new Array<number>(prazo).fill(0);
  const ops = [
    antecipacao({ id: 2, inicio_mes: 3, pct_carteira_cedida: 80 }),
    antecipacao({ id: 1, inicio_mes: 1, pct_carteira_cedida: 80 }),
  ];
  const f = fundingDoEstudo(ops, livre, livre, 0, 0, 12, { recebimentoPorSafraMensal: porSafra })!;
  const primeira = f.operacoes.find((s) => s.operacao.id === 1)!;
  const segunda = f.operacoes.find((s) => s.operacao.id === 2)!;
  // A primeira (mês 1) cede 80%; a segunda (mês 3) cede 80% dos 20% restantes.
  assert.ok(perto(soma(primeira.saidas), 3_200));
  assert.ok(perto(soma(segunda.saidas), 640));
  assert.ok(soma(primeira.saidas) + soma(segunda.saidas) <= 4_000 + 0.01);
  // Mesma resposta com o array na outra ordem.
  const g = fundingDoEstudo([...ops].reverse(), livre, livre, 0, 0, 12, { recebimentoPorSafraMensal: porSafra })!;
  assert.deepEqual(g.operacoes.find((s) => s.operacao.id === 2)!.saidas, segunda.saidas);
  // Sem o lastro no contexto, nada a ceder.
  const semLastro = fundingDoEstudo(ops, livre, livre, 0, 0, 12, {})!;
  assert.equal(soma(semLastro.noFluxo.entradas), 0);
});

const CRONO: EventoCrono[] = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 3 },
  { evento: 'obra', inicio_mes: 3, duracao_meses: 12 }, // entrega no mês 14
  { evento: 'pos_obra', inicio_mes: 15, duracao_meses: 12 },
];

test('#851 critérios 4 e 5: lastro do motor do fluxo, entra no alavancado e não mexe no desalavancado', () => {
  const linha = {
    id: 1, nome: 'Lotes', tipologias: [{ id: 1, quantidade: 20, area_privativa_m2: 300, preco_m2: 1_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      componentes: [
        { tipo: 'imediato', participacaoPct: 10, descontoPct: 0 },
        { tipo: 'carteira_pos_marco', participacaoPct: 90, marcoMes: 14, carenciaMeses: 0, prazoMeses: 60 },
      ],
    },
  };
  const calc = calcularFluxo({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 12,
    linhasReceita: [linha], linhasCusto: [], areaTerreno: 0,
  });
  // O lastro por safra soma exatamente a receita bruta canônica.
  const porSafra = calc.recebimentoPorSafraMensal;
  const totalPorSafra = soma(Object.values(porSafra).map((serie) => soma(serie)));
  assert.ok(perto(totalPorSafra, soma(calc.receitaBrutaMensal), 0.5));

  const cessao = antecipacao({ inicio_mes: 16, pct_carteira_cedida: 50, taxa_anual: 20 });
  const f = fundingDoEstudo([cessao], calc.fluxoMensal, calc.receitaMensal, 0, 15, 12, {
    cronograma: CRONO, recebimentoPorSafraMensal: porSafra,
  })!;
  const s = f.operacoes[0];
  // O que se cede é 50% do que as vendas até o mês 16 pagam depois dele.
  const esperado = recebiveisFuturosDeSafras(porSafra, 16, calc.prazo).map((v) => v * 0.5);
  assert.ok(perto(soma(s.saidas), soma(esperado), 0.5));
  assert.ok(s.entradas[16] > 0 && s.entradas[16] < soma(s.saidas), 'o VP fica abaixo da face');
  // Linhas do fluxo alavancado; o livre é o mesmo de antes.
  assert.ok(f.noFluxo.linhasEntrada.some((l) => /Antecipação/.test(l.nome) && /valor antecipado/.test(l.nome)));
  assert.ok(f.noFluxo.linhasSaida.some((l) => /parcelas cedidas/.test(l.nome)));
  calc.fluxoMensal.forEach((v, t) => assert.ok(perto(f.noFluxo.fluxoMensal[t], v + f.noFluxo.entradas[t] - f.noFluxo.saidas[t])));
  // Não é tranche de investidor (fica fora do Retorno por parte).
  assert.deepEqual(tranchesDeInvestimento(f), []);
  // As invariantes de funding não acusam nada: o lastro zera, nada negativo.
  assert.deepEqual(validarFunding(f, calc.fluxoMensal, undefined, calc.receitaMensal).filter((d) => d.severidade === 'erro'), []);
});

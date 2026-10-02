// Repasse (`concentrado`) configurado ANTES da venda: o motor paga no próprio
// mês da venda (`Math.max(mesPagamento, safra)`, em `componentesEfetivosSafra`)
// em vez de lançar. Antes, `pagamentosConcentrado` lançava e `calcularFluxo`
// derrubava a tela do estudo por um dado que a própria tela produz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, componentesEfetivosSafra, type FluxoConfig, type ComponentePagamento } from './fluxo-caixa-motor.js';
import { validarFluxoCalc, validarSafrasReceita } from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const config = (componentes: unknown[]): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 10, cronograma: CRONO, jurosTabelaAaEstudo: 12.5,
  linhasReceita: [{ id: 1, nome: 'G', fase_label: 'G',
    tipologias: [{ id: 1, tipologia_id: 1, nome: 'T', quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    fluxo_pagamento: { componentes } }],
  linhasCusto: [], areaTerreno: 1000,
} as FluxoConfig);

test('repasse (concentrado) em mês anterior à safra não derruba o cálculo', () => {
  // A venda cai no mês 12; o repasse está configurado para o mês 5.
  const cfg = config([
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 5 },
  ]);
  assert.doesNotThrow(() => calcularFluxo(cfg));
});

test('repasse anterior à safra é pago no mês da venda, sem juros, e a receita conserva', () => {
  const r = calcularFluxo(config([
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 5 },
  ]));
  // VGV = 100 × 50 m² × 10.000 = 50.000.000, todo vendido no mês 12. O
  // repasse antecipado entra à vista no mês da venda — não na série de
  // repasse, que é o pagamento único que liquida a carteira.
  assert.equal(r.receitaBrutaMensal[12], 50_000_000);
  assert.equal(r.repasseMensal.reduce((a, b) => a + b, 0), 0);
  assert.equal(r.receitaBruta, 50_000_000);
  // nenhuma invariante de erro: a carteira do repasse nasce e zera no mês 12
  const cfg = config([
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 5 },
  ]);
  const erros = [
    ...validarFluxoCalc(r),
    ...validarSafrasReceita(cfg.linhasReceita, CRONO, r.prazo, undefined, [], 12.5),
  ].filter((d) => d.severidade === 'erro');
  assert.deepEqual(erros.map((d) => d.codigo), []);
});

test('regressão: repasse posterior à safra não muda (plano completo)', () => {
  const r = calcularFluxo(config([
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42 },
  ]));
  // 25 M capitalizados de 12 a 42 à taxa do estudo (12,5% a.a.)
  const taxa = Math.pow(1.125, 1 / 12) - 1;
  assert.equal(r.repasseMensal[12] ?? 0, 0);
  assert.ok(Math.abs(r.repasseMensal[42] - 25_000_000 * Math.pow(1 + taxa, 30)) < 1);
});

test('componentesEfetivosSafra devolve cópia e não muta o persistido', () => {
  const persistido: ComponentePagamento[] = [
    { tipo: 'concentrado', participacaoPct: 100, mesPagamento: 5, taxaMensal: 0.01 },
  ];
  const efetivos = componentesEfetivosSafra(persistido, 12, 40);
  assert.equal((efetivos[0] as any).mesPagamento, 12);
  assert.equal((persistido[0] as any).mesPagamento, 5);
  // repasse na própria safra ou depois: o array volta intacto (mesma referência)
  assert.equal(componentesEfetivosSafra(persistido, 5, 40), persistido);
});

test('vendas em meses diferentes depois do repasse configurado não viram repasse em vários meses', () => {
  // absorção distribuída: metade no lançamento (mês 12), metade na obra; o
  // repasse do Grupo está no mês 5. Cada safra recebe a sua parte no mês da
  // venda, e o invariante do repasse único não acusa falso erro.
  const cfg = config([
    { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 5 },
  ]);
  (cfg.linhasReceita[0] as any).absorcao = { modo: 'distribuido', blocos: [
    { evento: 'lancamento', pct: 50 }, { evento: 'obra', pct: 50 }] };
  const r = calcularFluxo(cfg);
  assert.ok(r.receitaBrutaMensal.filter((v) => v > 0).length > 1, 'o cenário precisa de vendas em mais de um mês');
  assert.deepEqual(validarFluxoCalc(r).filter((d) => d.codigo === 'REPASSE_EM_MULTIPLOS_MESES'), []);
  // centavos de arredondamento mensal da absorção distribuída
  assert.ok(Math.abs(r.receitaBruta - 50_000_000) < 1);
});

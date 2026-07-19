import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distribuirLinha, reamostrarCurva, receitaMensalLinha,
  vplFluxo, tirFluxo, calcularFluxo,
  type FluxoConfig,
} from './fluxo-caixa-motor.js';
import type { EventoCrono } from './fluxo-shared.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 1, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 7, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 13, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 18, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 42, duracao_meses: 12 },
];

const CURVA_S = [2, 4, 7, 10, 13, 14, 14, 13, 10, 7, 4, 2].map((pct, i) => ({ mes: i + 1, pct }));

// 1. Distribuição linear
test('distribuirLinha linear: 12 meses iguais somando o total', () => {
  const r = distribuirLinha(1_200_000, 3, 12, 'linear', 24);
  assert.equal(r.length, 24);
  assert.ok(perto(soma(r), 1_200_000));
  assert.equal(r[0], 0);
  assert.equal(r[1], 0);
  for (let i = 2; i < 14; i++) assert.ok(perto(r[i], 100_000));
  assert.equal(r[14], 0);
});

// 2. Curva S interpolada para outra duração
test('curva S de 12 meses reamostrada para 24 mantém soma e formato', () => {
  const pesos = reamostrarCurva(CURVA_S, 24);
  assert.equal(pesos.length, 24);
  assert.ok(perto(soma(pesos), 1, 1e-9));
  // formato de S preservado: meio > extremidades
  assert.ok(pesos[11] > pesos[0]);
  assert.ok(pesos[11] > pesos[23]);
  const r = distribuirLinha(500_000, 1, 24, CURVA_S, 24);
  assert.ok(perto(soma(r), 500_000));
});

// 3. Absorção distribuída aplicada às vendas de uma linha
test('absorção distribuída: vendas caem nos meses dos blocos e somam o VGV', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
    absorcao: {
      modo: 'distribuido',
      blocos: [
        { evento: 'lancamento', pct: 30 },
        { evento: 'obra', pct: 35 },
        { evento: 'pos_obra', pct: 35, duracao_meses: 12 },
      ],
    },
    fluxo_pagamento: null, // sem config → recebe à vista no mês da venda
  };
  const r = receitaMensalLinha(linha, CRONO, 60);
  assert.ok(perto(soma(r), 50_000_000, 1));
  assert.ok(perto(r[12], 15_000_000, 1));          // mês 13: 30% no lançamento
  assert.ok(perto(r[14], 0, 1));                   // hiato (mês 15)
  assert.ok(perto(r[17], (0.35 * 50_000_000) / 24, 1)); // 1º mês da obra
});

// 4. Fluxo de pagamento: entrada + parcelas + repasse = VGV no tempo correto
test('fluxo de pagamento distribui entrada, parcelas na obra e repasse na entrega', () => {
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 13, pct: 100 }] },        // tudo vendido no lançamento
    fluxo_pagamento: {
      comissao: { ativo: true, tipo: 'embutida', pct: 6 },  // embutida: não deduz
      ret: { ativo: false, pct: 0 },
      entrada: { modo: 'entrada', parcelas: 1, pct: 15 },
      parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 },
      repasse: { pct: 70, apos_entrega_meses: 2 },
    },
  };
  const r = receitaMensalLinha(linha, CRONO, 60);
  assert.ok(perto(soma(r), 10_000_000, 1));                   // nada se perde
  assert.ok(perto(r[12], 1_500_000, 1));                      // entrada no mês 13
  // parcelas: mensal do mês 14 até o fim da obra (mês 41) = 28 meses
  assert.ok(perto(r[13], 1_500_000 / 28, 1));
  assert.ok(perto(r[40], 1_500_000 / 28, 1));
  // repasse: fim da obra (41) + 2 = mês 43
  assert.ok(perto(r[42], 7_000_000, 1));
});

// 5. Resolução de unidade pct_vgv dentro do fluxo completo
test('linha de custo em % VGV resolve sobre o VGV das tipologias', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Sales', tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: { modo: 'linear' }, fluxo_pagamento: null,
    }],
    linhasCusto: [{ id: 1, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv', inicio_mes: 1, duracao_meses: 12 }],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.ok(perto(r.linhasCusto[0].total, 1_250_000, 1));
  assert.ok(perto(soma(r.linhasCusto[0].mensal), 1_250_000, 1));
});

// 6. VPL com taxa zero = soma do fluxo
test('VPL a taxa zero é a soma simples do fluxo', () => {
  const fluxo = [-100, 30, 40, 50];
  assert.ok(perto(vplFluxo(fluxo, 0), 20, 1e-9));
});

// 7. Payback identificado corretamente
test('payback é o primeiro mês com acumulado ≥ 0 após investimento', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12,
    cronograma: [{ evento: 'lancamento', inicio_mes: 2, duracao_meses: 1 }, { evento: 'obra', inicio_mes: 2, duracao_meses: 2 }, { evento: 'pos_obra', inicio_mes: 4, duracao_meses: 2 }],
    linhasReceita: [{
      id: 1, nome: 'Sales', tipologias: [{ id: 1, quantidade: 1, area_privativa_m2: 100, preco_m2: 3_000 }], // 300k
      absorcao: { modo: 'personalizado', meses: [{ mes: 2, pct: 100 }] },
      fluxo_pagamento: null, // à vista no mês 2
    }],
    linhasCusto: [{ id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 200_000, orcamento_unidade: 'rs', inicio_mes: 1, duracao_meses: 1 }],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  // mês 1: -200k; mês 2: +300k → acumulado vira ≥ 0 no índice 1
  assert.equal(r.paybackMes, 1);
  assert.equal(r.paybackData, 'fev/2027');
});

// 8. TIR nula quando o fluxo nunca fica positivo
test('TIR retorna null para fluxo sempre negativo', () => {
  assert.equal(tirFluxo([-100, -50, -20]), null);
});

// 9. Fluxo completo com cronograma real
test('fluxo completo: consolidação, acumulado, TIR e exposição coerentes', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Sales', fase_label: 'Fase 1',
      tipologias: [
        { id: 1, nome: 'Studio', quantidade: 200, area_privativa_m2: 25, preco_m2: 12_000 },   // 60M
        { id: 2, nome: '2 dorms', quantidade: 400, area_privativa_m2: 70, preco_m2: 10_000 },  // 280M
      ],
      absorcao: {
        modo: 'distribuido',
        blocos: [
          { evento: 'lancamento', pct: 30 },
          { evento: 'obra', pct: 35 },
          { evento: 'pos_obra', pct: 35, duracao_meses: 12 },
        ],
      },
      fluxo_pagamento: {
        comissao: { ativo: true, tipo: 'embutida', pct: 6 },
        ret: { ativo: false, pct: 0 },
        entrada: { modo: 'entrada', parcelas: 1, pct: 15 },
        parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 },
        repasse: { pct: 70, apos_entrega_meses: 2 },
      },
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 60_000_000, orcamento_unidade: 'rs', inicio_mes: 1, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 4_800, orcamento_unidade: 'rs_m2_priv', inicio_mes: 18, duracao_meses: 24, curva_id: 9 },
      { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv', inicio_mes: 1, duracao_meses: 12 },
    ],
    curvas: [{ id: 9, nome: 'Curva S', valores: CURVA_S }],
    areaTerreno: 50_000,
  };
  const r = calcularFluxo(config);

  const vgv = 340_000_000;
  const areaPriv = 200 * 25 + 400 * 70; // 33.000 m²
  const custoTotal = 60_000_000 + 4_800 * areaPriv + 0.0125 * vgv;
  assert.ok(perto(r.vgvTotal, vgv, 1));
  assert.ok(perto(soma(r.receitaMensal), vgv, 5));
  assert.ok(perto(soma(r.custoMensal), custoTotal, 5));
  // consolidação: fluxo = receita − custo, mês a mês
  for (let i = 0; i < r.prazo; i++) {
    assert.ok(perto(r.fluxoMensal[i], r.receitaMensal[i] - r.custoMensal[i], 0.01));
  }
  // acumulado final = resultado total
  assert.ok(perto(r.fluxoAcumulado[r.prazo - 1], vgv - custoTotal, 5));
  // projeto lucrativo com desembolso inicial → TIR existe e é positiva
  assert.ok(r.tir !== null && r.tir! > 0);
  // exposição máxima é negativa (terreno à vista no mês 1)
  assert.ok(r.exposicaoMaxima < 0);
  // payback existe e o acumulado é ≥ 0 dali em diante... (no mês do payback)
  assert.ok(r.paybackMes !== null && r.fluxoAcumulado[r.paybackMes!] >= 0);
  // rótulos de calendário ancorados em jan/2027
  assert.equal(r.meses[0], 'jan/27');
  assert.equal(r.meses[12], 'jan/28');
  // tipologias somam a linha
  const linha = r.linhasReceita[0];
  const somaTipologias = linha.itens!.reduce((s, t) => s + t.total, 0);
  assert.ok(perto(somaTipologias, linha.total, 1));
});

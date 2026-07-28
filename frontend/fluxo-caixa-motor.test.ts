import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distribuirLinha, reamostrarCurva, receitaMensalLinha,
  vplFluxo, tirFluxo, calcularFluxo, aplicarCenario, agregarFluxoPorPeriodos,
  type FluxoConfig,
} from './fluxo-caixa-motor.js';
import { periodosAnuais, CATEGORIA_CORRETAGEM, type EventoCrono } from './fluxo-shared.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// Cronograma 0-based (mês 0 = início do projeto).
const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const CURVA_S = [2, 4, 7, 10, 13, 14, 14, 13, 10, 7, 4, 2].map((pct, i) => ({ mes: i + 1, pct }));

// 1. Distribuição linear (mês 0-based: início 3 = índice 3)
test('distribuirLinha linear: 12 meses iguais somando o total', () => {
  const r = distribuirLinha(1_200_000, 3, 12, 'linear', 24);
  assert.equal(r.length, 24);
  assert.ok(perto(soma(r), 1_200_000));
  assert.equal(r[0], 0);
  assert.equal(r[2], 0);
  for (let i = 3; i < 15; i++) assert.ok(perto(r[i], 100_000));
  assert.equal(r[15], 0);
});

// 2. Curva S interpolada para outra duração
test('curva S de 12 meses reamostrada para 24 mantém soma e formato', () => {
  const pesos = reamostrarCurva(CURVA_S, 24);
  assert.equal(pesos.length, 24);
  assert.ok(perto(soma(pesos), 1, 1e-9));
  // formato de S preservado: meio > extremidades
  assert.ok(pesos[11] > pesos[0]);
  assert.ok(pesos[11] > pesos[23]);
  const r = distribuirLinha(500_000, 0, 24, CURVA_S, 24);
  assert.ok(perto(soma(r), 500_000));
});

// 3. Absorção distribuída (4 períodos) aplicada às vendas de uma linha (#108)
test('absorção distribuída: vendas caem nos 4 períodos e somam o VGV', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
    absorcao: {
      modo: 'distribuido',
      blocos: [
        { evento: 'pre_lancamento', pct: 20 }, // período 1 = pré-lançamento (meses 6..11, 6m)
        { evento: 'lancamento', pct: 10 },     // período 2 = lançamento (mês 12, 1m)
        { evento: 'obra', pct: 35 },           // período 3 = obra (meses 17..40, 24m)
        { evento: 'pos_obra', pct: 0 },        // período 4 = derivado = 35% (meses 41..52)
      ],
    },
    fluxo_pagamento: null, // sem config → recebe à vista no mês da venda
  };
  const r = receitaMensalLinha(linha, CRONO, 60);
  assert.ok(perto(soma(r), 50_000_000, 1));
  assert.ok(perto(r[6], (0.20 * 50_000_000) / 6, 1));   // pré-lançamento: 20% / 6 meses
  assert.ok(perto(r[12], (0.10 * 50_000_000) / 1, 1));  // lançamento: 10% em 1 mês
  assert.ok(perto(r[14], 0, 1));                         // hiato entre lançamento e obra
  assert.ok(perto(r[17], (0.35 * 50_000_000) / 24, 1)); // 1º mês da obra (mês 17)
  assert.ok(perto(r[41], (0.35 * 50_000_000) / 12, 1)); // 1º mês da pós-obra (derivado)
});

// 4. Fluxo de pagamento: entrada + parcelas + repasse = VGV no tempo correto
test('fluxo de pagamento distribui entrada, parcelas na obra e repasse na entrega', () => {
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },        // tudo vendido no lançamento
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
  assert.ok(perto(r[12], 1_500_000, 1));                      // entrada no mês 12
  // parcelas: mensal do mês 13 até o fim da obra (mês 40) = 28 meses
  assert.ok(perto(r[13], 1_500_000 / 28, 1));
  assert.ok(perto(r[40], 1_500_000 / 28, 1));
  // repasse: fim da obra (40) + 2 = mês 42
  assert.ok(perto(r[42], 7_000_000, 1));
});

// 4b. Fluxo de pagamento com MÚLTIPLAS linhas de entrada e repasse derivado
test('fluxo de pagamento: múltiplas entradas + repasse derivado (100 − entradas − parcelas)', () => {
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: {
      comissao: { ativo: true, tipo: 'embutida', pct: 6 },
      ret: { ativo: false, pct: 0 },
      entrada: [{ pct: 10, parcelas: 1 }, { pct: 5, parcelas: 1 }], // duas linhas, 15% no total
      parcelas: [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, pct: 15 }],
      repasse: { apos_entrega_meses: 2 }, // pct derivado = 100 − 15 − 15 = 70
    },
  };
  const r = receitaMensalLinha(linha, CRONO, 60);
  assert.ok(perto(soma(r), 10_000_000, 1));       // nada se perde
  assert.ok(perto(r[12], 1_500_000, 1));          // 10% + 5% de entrada no mês 12
  assert.ok(perto(r[13], 1_500_000 / 28, 1));     // parcelas ao longo da obra (mês 13..40)
  assert.ok(perto(r[42], 7_000_000, 1));          // repasse derivado (70%) na entrega (mês 42)
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

// 5b. Corretagem de vendas: paga no mês da venda, não distribuída (#121)
test('corretagem de vendas cai no mês da venda, acompanhando a absorção', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: {
        modo: 'distribuido',
        blocos: [
          { evento: 'lancamento', pct: 40 },  // mês 12 (1m)
          { evento: 'obra', pct: 60 },        // meses 17..40 (24m)
          { evento: 'pos_obra', pct: 0 },     // derivado = 0
        ],
      },
      fluxo_pagamento: null,
    }],
    linhasCusto: [
      // Corretagem: 4% do VGV. inicio_mes/duracao_meses são IGNORADOS pelo motor.
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const linha = r.linhasCusto[0];

  // Total = 4% do VGV vendido (absorção completa) e o mensal soma o mesmo.
  assert.ok(perto(linha.total, 4_000_000, 1));
  assert.ok(perto(soma(linha.mensal), 4_000_000, 1));
  // Mês do lançamento: 40% do VGV vendido → 4% de 40M = 1,6M.
  assert.ok(perto(linha.mensal[12], 0.04 * 40_000_000, 1));
  // Durante a obra: 60% espalhados por 24 meses.
  assert.ok(perto(linha.mensal[17], (0.04 * 60_000_000) / 24, 1));
  assert.ok(perto(linha.mensal[40], (0.04 * 60_000_000) / 24, 1));
  // Nada antes da 1ª venda nem no hiato entre lançamento e obra.
  assert.ok(perto(linha.mensal[0], 0, 1e-6));
  assert.ok(perto(linha.mensal[14], 0, 1e-6));
  // Início/duração vêm do recorte das vendas (mês 12 até o mês 40).
  assert.equal(linha.inicio, 12);
  assert.equal(linha.duracao, 40 - 12 + 1);
});

// 5c. Corretagem sem vendas no horizonte não gera desembolso (#121)
test('corretagem sem linhas de receita não gera custo', () => {
  const config: FluxoConfig = {
    dataInicio: null, taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.ok(perto(r.linhasCusto[0].total, 0, 1e-9));
  assert.equal(r.linhasCusto[0].duracao, 0);
  assert.ok(perto(soma(r.custoMensal), 0, 1e-9));
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
    cronograma: [{ evento: 'lancamento', inicio_mes: 1, duracao_meses: 1 }, { evento: 'obra', inicio_mes: 1, duracao_meses: 2 }, { evento: 'pos_obra', inicio_mes: 3, duracao_meses: 2 }],
    linhasReceita: [{
      id: 1, nome: 'Sales', tipologias: [{ id: 1, quantidade: 1, area_privativa_m2: 100, preco_m2: 3_000 }], // 300k
      absorcao: { modo: 'personalizado', meses: [{ mes: 1, pct: 100 }] },
      fluxo_pagamento: null, // à vista no mês 1
    }],
    linhasCusto: [{ id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 200_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 }],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  // mês 0: -200k; mês 1: +300k → acumulado vira ≥ 0 no índice 1
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
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 60_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 4_800, orcamento_unidade: 'rs_m2_priv', inicio_mes: 17, duracao_meses: 24, curva_id: 9 },
      { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 12 },
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

// #188: VGV Total / VGV Permuta Física / Receita Bruta (VGV).
test('vgvPermutaFisica e receitaBrutaVgv: permutadas são subconjunto de quantidade, informativo', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Sales', fase_label: 'Fase 1',
      tipologias: [
        // 200 un a 12.000/m² × 25m² = 60M, das quais 20 permutadas = 6M
        { id: 1, nome: 'Studio', quantidade: 200, unidades_permutadas: 20, area_privativa_m2: 25, preco_m2: 12_000 },
        // 400 un a 10.000/m² × 70m² = 280M, sem permuta
        { id: 2, nome: '2 dorms', quantidade: 400, area_privativa_m2: 70, preco_m2: 10_000 },
      ],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [],
    areaTerreno: 50_000,
  };
  const r = calcularFluxo(config);

  assert.ok(perto(r.vgvTotal, 340_000_000, 1));
  // Permuta física não altera vgvTotal nem o fluxo — apenas expõe a fatia (#195 é quem muda o motor).
  assert.ok(perto(r.vgvPermutaFisica, 6_000_000, 1));
  assert.ok(perto(r.receitaBrutaVgv, 334_000_000, 1));
  assert.ok(perto(soma(r.receitaMensal), 340_000_000, 5));
});

// Cenários (Etapa 8 · #56): aplicarCenario escala preço de venda e custo de obra.
test('aplicarCenario escala preço/m² das tipologias e orçamento de obra', () => {
  const base: FluxoConfig = {
    dataInicio: null, taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
      absorcao: { modo: 'linear' }, fluxo_pagamento: null,
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 5_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 20_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
    ],
    areaTerreno: 10_000,
  };

  // Base: VGV 50M, custo total 25M.
  const rBase = calcularFluxo(base);
  assert.ok(perto(rBase.vgvTotal, 50_000_000, 1));

  // Cenário: +10% preço, +20% custo de obra.
  const rCen = calcularFluxo(aplicarCenario(base, { precoVendaPct: 10, custoObraPct: 20 }));
  assert.ok(perto(rCen.vgvTotal, 55_000_000, 1)); // 50M × 1,10
  // custo total = terreno 5M + obra 20M×1,20 = 5M + 24M = 29M
  assert.ok(perto(soma(rCen.custoMensal), 29_000_000, 5));
  // terreno intacto (grupo ≠ obra)
  assert.ok(perto(base.linhasCusto[0].orcamento_valor, 5_000_000, 0.01));

  // pureza: a config-base não foi mutada
  assert.equal(base.linhasReceita[0].tipologias[0].preco_m2, 10_000);
  assert.equal(base.linhasCusto[1].orcamento_valor, 20_000_000);

  // cenário-zero = base
  const rZero = calcularFluxo(aplicarCenario(base, { precoVendaPct: 0, custoObraPct: 0 }));
  assert.ok(perto(rZero.vgvTotal, rBase.vgvTotal, 1));
  assert.ok(perto(soma(rZero.custoMensal), soma(rBase.custoMensal), 1));
});

// View Anual (S17 · #127): agregação de colunas mensais em anos-calendário.
test('agregarFluxoPorPeriodos: soma anual bate com a mensal em TODAS as linhas', () => {
  const config: FluxoConfig = {
    dataInicio: 'abr/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Vendas', fase_label: 'Fase 1',
      tipologias: [
        { id: 1, nome: 'Studio', quantidade: 100, area_privativa_m2: 30, preco_m2: 10_000 },
        { id: 2, nome: '2 dorms', quantidade: 80, area_privativa_m2: 70, preco_m2: 9_000 },
      ],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 40 }, { evento: 'obra', pct: 40 }] },
      fluxo_pagamento: null,
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 12_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 30_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
      { id: 3, grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM, orcamento_valor: 4, orcamento_unidade: 'pct_vgv' },
    ],
    areaTerreno: 20_000,
  };
  const mensal = calcularFluxo(config);
  const periodos = periodosAnuais('abr/2027', mensal.prazo);
  const anual = agregarFluxoPorPeriodos(mensal, periodos);

  // Colunas viram anos; o 1º ano é parcial (abr→dez).
  assert.equal(anual.prazo, periodos.length);
  assert.ok(anual.prazo < mensal.prazo);
  assert.equal(anual.meses[0], '2027');
  assert.equal(anual.meses[1], '2028');

  // Toda série de fluxo conserva a soma — inclusive linhas e tipologias.
  const mesmaSoma = (a: number[], b: number[], nome: string) =>
    assert.ok(perto(soma(a), soma(b), 0.01), `${nome}: soma anual ≠ soma mensal`);
  mesmaSoma(anual.receitaMensal, mensal.receitaMensal, 'receita');
  mesmaSoma(anual.custoMensal, mensal.custoMensal, 'custo');
  mesmaSoma(anual.fluxoMensal, mensal.fluxoMensal, 'fluxo');
  for (let i = 0; i < mensal.linhasReceita.length; i++) {
    const lm = mensal.linhasReceita[i]; const la = anual.linhasReceita[i];
    mesmaSoma(la.mensal, lm.mensal, `receita ${lm.nome}`);
    assert.ok(perto(soma(la.mensal), la.total, 0.01), 'linha: colunas somam o Total');
    for (let j = 0; j < (lm.itens ?? []).length; j++) {
      mesmaSoma(la.itens![j].mensal, lm.itens![j].mensal, `tipologia ${lm.itens![j].nome}`);
    }
  }
  for (let i = 0; i < mensal.linhasCusto.length; i++) {
    mesmaSoma(anual.linhasCusto[i].mensal, mensal.linhasCusto[i].mensal, `custo ${mensal.linhasCusto[i].nome}`);
  }
  // cada coluna anual = soma dos meses da sua faixa
  periodos.forEach((p, k) => {
    assert.ok(perto(anual.fluxoMensal[k], soma(mensal.fluxoMensal.slice(p.inicio, p.fim + 1)), 0.01));
  });
});

test('agregarFluxoPorPeriodos: acumulado é o saldo do ÚLTIMO mês do ano, não a soma', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, nome: 'Lote', quantidade: 100, area_privativa_m2: 250, preco_m2: 2_000 }],
      absorcao: { modo: 'linear' }, fluxo_pagamento: null,
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 10_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 25_000,
  };
  const mensal = calcularFluxo(config);
  const periodos = periodosAnuais('jan/2027', mensal.prazo);
  const anual = agregarFluxoPorPeriodos(mensal, periodos);

  periodos.forEach((p, k) => {
    assert.ok(perto(anual.fluxoAcumulado[k], mensal.fluxoAcumulado[p.fim], 0.01),
      `ano ${p.rotulo}: acumulado = saldo no mês ${p.fim}`);
  });
  // saldo final é o mesmo nas duas views
  assert.ok(perto(anual.fluxoAcumulado[anual.prazo - 1], mensal.fluxoAcumulado[mensal.prazo - 1], 0.01));
  // acumulado anual também é a soma corrida dos fluxos anuais
  let acc = 0;
  anual.fluxoMensal.forEach((v, k) => { acc += v; assert.ok(perto(acc, anual.fluxoAcumulado[k], 0.01)); });

  // Indicadores NÃO mudam com a view (são do fluxo mensal) e a entrada não é mutada.
  assert.equal(anual.vpl, mensal.vpl);
  assert.equal(anual.tir, mensal.tir);
  assert.equal(anual.exposicaoMaxima, mensal.exposicaoMaxima);
  assert.equal(anual.paybackMes, mensal.paybackMes);
  assert.equal(anual.paybackData, mensal.paybackData);
  assert.equal(anual.vgvTotal, mensal.vgvTotal);
  assert.equal(mensal.meses[0], 'jan/27');
  assert.equal(mensal.fluxoMensal.length, mensal.prazo);
});

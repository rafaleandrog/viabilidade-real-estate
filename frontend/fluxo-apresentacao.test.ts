import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoConfig } from './fluxo-caixa-motor.js';
import { periodosAnuais } from './fluxo-shared.js';
import { linhasFluxo } from './exportar.js';
import { chavesColapso } from './fluxo-tabela.js';
import { seriesEconomicasFluxo } from './fluxo-graficos.js';
import {
  fundingNoFluxo, simularCapitalStack, type InstrumentoDivida,
} from './capital-stack-motor.js';

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const CONFIG: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  linhasReceita: [{
    id: 1, nome: 'Grupo Residencial', fase_label: 'Torre A',
    tipologias: [
      { id: 11, nome: 'Dois quartos', quantidade: 6, area_privativa_m2: 100, preco_m2: 10_000 },
      { id: 12, nome: 'Três quartos', quantidade: 4, area_privativa_m2: 100, preco_m2: 10_000 },
    ],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 80 }, { mes: 41, pct: 20 }] },
    fluxo_pagamento: { componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 5, rotulo: 'À vista' },
      { tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 12,
        defasagemMeses: 1, taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'Curta' },
      { tipo: 'ate_marco', participacaoPct: 20, sinalPct: 0, marcoMes: 40,
        defasagemMeses: 1, taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'Longa — Obra' },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
    ] },
  }],
  linhasCusto: [], areaTerreno: 0,
};

const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

test('#241 componentes comerciais reconciliam Receita Bruta e Carteira mês a mês', () => {
  const c = calcularFluxo(CONFIG);
  for (let mes = 0; mes < c.prazo; mes++) {
    const receitaComponentes = Object.values(c.receitaPorComponenteMensal)
      .reduce((s, serie) => s + (serie[mes] ?? 0), 0);
    const carteiraComponentes = Object.values(c.carteiraPorComponenteMensal)
      .reduce((s, serie) => s + (serie[mes] ?? 0), 0);
    assert.ok(Math.abs(receitaComponentes - c.receitaBrutaMensal[mes]) <= 0.01, `receita mês ${mes}`);
    assert.ok(Math.abs(carteiraComponentes - c.carteiraClientesMensal[mes]) <= 0.01, `carteira mês ${mes}`);
  }
  assert.ok(soma(c.receitaPorComponenteMensal.aVista) > 0);
  assert.ok(soma(c.receitaPorComponenteMensal.tabelaCurta) > 0);
  assert.ok(soma(c.receitaPorComponenteMensal.tabelaLongaObra) > 0);
  assert.ok(soma(c.receitaPorComponenteMensal.repasse) > 0);
  assert.equal(soma(c.receitaPorComponenteMensal.aposChaves), 2_000_000);
});

// #241 continua valendo NO MOTOR: Vendas contratadas fecha por Grupo e
// tipologia. O que a #349 mudou é só quem consome — a tabela e a exportação
// deixaram de listar esse bloco, mas `linhasVendasContratadas` segue
// calculado e conservado (é o que alimenta os KPIs e o gráfico econômico).
test('#241 Vendas contratadas fecha por Grupo e tipologia em valores longos', () => {
  const c = calcularFluxo(CONFIG);
  const grupo = c.linhasVendasContratadas[0];
  assert.equal(c.vendaBrutaContratada, 10_000_000);
  assert.equal(grupo.total, 10_000_000);
  assert.equal(soma(grupo.itens?.map((item) => item.total) ?? []), grupo.total);
  assert.equal(grupo.itens?.[0].total, 6_000_000);
  assert.equal(grupo.itens?.[1].total, 4_000_000);
});

// #349: as chaves de colapso acompanham os blocos que a tabela realmente tem.
// Sobreviver a este teste é o que impede "Recolher tudo" de guardar chave de
// bloco inexistente (ou de esquecer a de um bloco novo).
test('#349 chavesColapso cobre só os blocos que a tabela passou a ter', () => {
  const c = calcularFluxo(CONFIG);
  const chaves = chavesColapso(c);
  assert.ok(chaves.includes('receita-bruta'));
  assert.ok(chaves.includes('funding-capital'));
  assert.ok(chaves.includes('rb1'));
  for (const removida of ['vendas-contratadas', 'carteira-clientes', 'receita-liquida', 'vc1', 'rl1']) {
    assert.ok(!chaves.includes(removida), `chave de bloco removido ainda listada: ${removida}`);
  }
});

test('#349 CSV/PDF espelham a tabela reduzida: VGV, grupos de receita, 5 custos e o fluxo', () => {
  const c = calcularFluxo(CONFIG);
  const linhas = linhasFluxo(c);
  const nomes = linhas.map((l) => l.nome);
  assert.deepEqual(nomes.slice(0, 2), [
    'Receita Bruta — VGV', 'Grupo · Grupo Residencial (Torre A)',
  ]);
  assert.deepEqual(nomes.slice(-3), [
    'Custo Total', 'Fluxo de Caixa Mensal', 'Fluxo de Caixa Acumulado',
  ]);
  // Blocos que a #349 tirou da tela precisam sair da exportação junto — tela e
  // arquivo divergirem é exatamente o que a #241 tinha fechado.
  for (const fora of ['Vendas contratadas', '(-) Desconto comercial', '= Venda líquida contratada',
    'Componente · À vista', 'Componente · Repasse', 'Componente · Após-chaves',
    'Carteira de clientes (pico)', 'Componente · Saldo a repassar',
    'Auditoria · Principal recebido', 'Auditoria · Juros de clientes']) {
    assert.ok(!nomes.includes(fora), `linha removida ainda exportada: ${fora}`);
  }
});

test('#241 gráfico econômico usa os mesmos arrays da tabela e respeita visão anual', () => {
  const mensal = calcularFluxo(CONFIG);
  const series = seriesEconomicasFluxo(mensal);
  assert.deepEqual(series.map((s) => s.rotulo), [
    'Venda líquida contratada', 'Receita Bruta — VGV', 'Carteira de clientes', 'Repasse',
  ]);
  assert.equal(series[0].valores, mensal.vendaLiquidaContratadaMensal);
  assert.equal(series[1].valores, mensal.receitaBrutaMensal);
  assert.equal(series[2].valores, mensal.carteiraClientesMensal);
  assert.equal(series[3].valores, mensal.repasseMensal);

  const periodos = periodosAnuais(CONFIG.dataInicio, mensal.prazo);
  const anual = agregarFluxoPorPeriodos(mensal, periodos);
  assert.equal(seriesEconomicasFluxo(anual)[0].valores.length, periodos.length);
  assert.ok(Math.abs(soma(anual.vendaLiquidaContratadaMensal) - soma(mensal.vendaLiquidaContratadaMensal)) <= 0.01);
  periodos.forEach((p, i) => assert.equal(
    anual.carteiraClientesMensal[i], mensal.carteiraClientesMensal[p.fim] ?? 0));
});

// ─────────────────────────────────────────────────────────────────────────
// #349 — conservação da tabela reconstruída, com e sem funding.
//
// O critério de aceite da issue pede a conservação de receita/caixa provada
// por teste. A tabela é um demonstrativo: se as linhas listadas não somam o
// rodapé, ela mente — e foi justamente para não mentir que as duas linhas-
// ponte (deduções → Receita Líquida) ficaram, mesmo com a issue pedindo
// "só isso".
// ─────────────────────────────────────────────────────────────────────────

/** Fixture com custo em todos os 5 grupos e RET ativo (deduções != 0). */
const CONFIG_COMPLETA: FluxoConfig = {
  ...CONFIG,
  ret: { ativo: true, pct: 4 },
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 2_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
    { id: 3, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 5, orcamento_unidade: 'pct_vgv' },
    { id: 4, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 500_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
    { id: 5, grupo: 'financeiro', categoria: 'Taxas bancárias', orcamento_valor: 100_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
  ],
};

test('#349 sem funding: Receita Líquida − Custo Total = Fluxo, mês a mês', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const linhas = linhasFluxo(c);
  const nome = (n: string) => linhas.find((l) => l.nome === n)!;

  // A ponte existe porque há RET: bruta − deduções = líquida.
  const bruta = nome('Receita Bruta — VGV');
  const deducoes = nome('(-) Impostos e deduções sobre a receita');
  const liquida = nome('= Receita Líquida do Projeto');
  assert.ok(deducoes.total < 0, 'com RET ativo a dedução tem que ser negativa');
  for (let m = 0; m < c.prazo; m++) {
    assert.ok(Math.abs((bruta.mensal[m] + deducoes.mensal[m]) - liquida.mensal[m]) <= 0.01, `ponte mês ${m}`);
  }

  // E o rodapé é exatamente líquida − custo.
  const custo = nome('Custo Total');
  const fluxo = nome('Fluxo de Caixa Mensal');
  for (let m = 0; m < c.prazo; m++) {
    assert.ok(Math.abs((liquida.mensal[m] - custo.mensal[m]) - fluxo.mensal[m]) <= 0.01, `fluxo mês ${m}`);
  }
  // Sem funding o rodapé continua sendo o fluxo do motor — nada mudou para
  // quem não usa Capital Stack.
  assert.deepEqual(fluxo.mensal, c.fluxoMensal);
  assert.equal(linhas.find((l) => l.nome === 'Fluxo de Caixa Livre (antes do funding)'), undefined);
});

test('#349 os 5 grupos de custo somam o Custo Total', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const linhas = linhasFluxo(c);
  const grupos = ['Custos do Terreno', 'Custos de Obra', 'Custos Diretos', 'Custos Indiretos', 'Custos Financeiros']
    .map((n) => linhas.find((l) => l.nome === n)!);
  assert.ok(grupos.every(Boolean), 'os 5 grupos precisam aparecer');
  const total = linhas.find((l) => l.nome === 'Custo Total')!;
  for (let m = 0; m < c.prazo; m++) {
    const soma5 = grupos.reduce((s, g) => s + g.mensal[m], 0);
    assert.ok(Math.abs(soma5 - total.mensal[m]) <= 0.01, `custo mês ${m}`);
  }
});

test('#349 com funding: entradas viram receita, saídas entram em Custos Financeiros e o rodapé alavanca', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  // Financiamento à produção elegível sobre a linha de Obra, cobrindo a
  // necessidade de caixa — gera liberação (entrada) e juros/amortização (saída).
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Fin produção', limiteComprometido: 5_000_000, taxaMensal: 0.01,
    politicaAmortizacao: 'cash_sweep', prioridadeFunding: 1, prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'e41', meses: c.prazo, fluxoLivreMensal: [0, ...c.fluxoMensal],
    reservaMinima: 0, instrumentos: [fin],
  });
  const funding = fundingNoFluxo(r, [{ nome: 'Fin produção', tipo: 'financiamento_producao' }],
    c.fluxoMensal, CONFIG_COMPLETA.taxaDescontoAa)!;
  assert.ok(soma(funding.entradas) > 0, 'a fixture precisa gerar liberação, senão o teste não prova nada');
  assert.ok(soma(funding.saidas) > 0, 'a fixture precisa gerar serviço de dívida');

  const linhas = linhasFluxo(c, funding);
  const nome = (n: string) => linhas.find((l) => l.nome === n)!;

  // Entradas: bloco de receita próprio, aberto nas 4 origens de capital.
  const capital = nome('Funding — Capital (entradas)');
  assert.ok(capital, 'entradas de funding têm que virar bloco de receita');
  assert.ok(nome('Financiamento à produção — liberações'));
  assert.equal(capital.custo, false);

  // Saídas: dentro de "Custos Financeiros", que já era uma das 5 categorias —
  // e o subtotal do grupo tem que somá-las junto com a linha do usuário.
  const financeiro = nome('Custos Financeiros');
  const jurosFunding = nome('Funding · Juros e taxas de dívida');
  assert.ok(jurosFunding, 'saídas de funding têm que entrar em Custos Financeiros');
  const linhaUsuario = nome('Taxas bancárias');
  for (let m = 0; m < c.prazo; m++) {
    const somaFilhas = linhaUsuario.mensal[m]
      + soma(funding.linhasSaida.map((l) => l.mensal[m]));
    assert.ok(Math.abs(somaFilhas - financeiro.mensal[m]) <= 0.01, `custos financeiros mês ${m}`);
  }

  // Rodapé: livre e alavancado convivem, e o alavancado é livre + entradas − saídas.
  const livre = nome('Fluxo de Caixa Livre (antes do funding)');
  const fluxo = nome('Fluxo de Caixa Mensal');
  assert.deepEqual(livre.mensal, c.fluxoMensal);
  for (let m = 0; m < c.prazo; m++) {
    assert.ok(Math.abs((livre.mensal[m] + funding.entradas[m] - funding.saidas[m]) - fluxo.mensal[m]) <= 0.01,
      `alavancado mês ${m}`);
  }

  // E a tabela inteira fecha: receita líquida + capital − custo total = fluxo.
  const liquida = nome('= Receita Líquida do Projeto');
  const custo = nome('Custo Total');
  for (let m = 0; m < c.prazo; m++) {
    const esperado = liquida.mensal[m] + capital.mensal[m] - custo.mensal[m];
    assert.ok(Math.abs(esperado - fluxo.mensal[m]) <= 0.01, `conservação mês ${m}`);
  }
});

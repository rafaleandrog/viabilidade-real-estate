import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoConfig } from './fluxo-caixa-motor.js';
import { periodosAnuais } from './fluxo-shared.js';
import { linhasFluxo } from './exportar.js';
import { chavesColapso } from './fluxo-tabela.js';
import { seriesEconomicasFluxo } from './fluxo-graficos.js';

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

test('#241 Vendas contratadas fecha por Grupo e tipologia em valores longos', () => {
  const c = calcularFluxo(CONFIG);
  const grupo = c.linhasVendasContratadas[0];
  assert.equal(c.vendaBrutaContratada, 10_000_000);
  assert.equal(grupo.total, 10_000_000);
  assert.equal(soma(grupo.itens?.map((item) => item.total) ?? []), grupo.total);
  assert.equal(grupo.itens?.[0].total, 6_000_000);
  assert.equal(grupo.itens?.[1].total, 4_000_000);
  assert.ok(chavesColapso(c).includes('vendas-contratadas'));
  assert.ok(chavesColapso(c).includes('vc1'));
});

test('#241 CSV/PDF compartilham a hierarquia canônica, inclusive desconto negativo e zeros', () => {
  const c = calcularFluxo(CONFIG);
  const linhas = linhasFluxo(c);
  const nomes = linhas.map((l) => l.nome);
  assert.deepEqual(nomes.slice(0, 4), [
    'Vendas contratadas', '(-) Desconto comercial', '= Venda líquida contratada',
    'Grupo · Grupo Residencial (Torre A)',
  ]);
  assert.ok(nomes.includes('Componente · À vista'));
  assert.ok(nomes.includes('Componente · Tabela curta'));
  assert.ok(nomes.includes('Componente · Tabela longa — Obra'));
  assert.ok(nomes.includes('Componente · Repasse'));
  assert.ok(nomes.includes('Componente · Após-chaves'));
  assert.ok(nomes.includes('Carteira de clientes (pico)'));
  assert.ok(nomes.includes('Componente · Saldo a repassar'));
  assert.ok((linhas.find((l) => l.nome === '(-) Desconto comercial')?.total ?? 0) < 0);
  assert.equal(linhas.find((l) => l.nome === 'Componente · Legado / não classificado'), undefined);
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

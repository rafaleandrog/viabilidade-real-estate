import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoConfig } from './fluxo-caixa-motor.js';
import { periodosAnuais } from './fluxo-shared.js';
import { linhasFluxo } from './exportar.js';
import { chavesColapso } from './fluxo-tabela.js';
import { seriesEconomicasFluxo } from './fluxo-graficos.js';
import { fundingDoEstudo, type OperacaoFunding } from './funding-motor.js';
import { proformaAvancado } from './proforma-avancado.js';

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
  const fin: OperacaoFunding = {
    tipo: 'divida', nome: 'Fin produção', valor: 5_000_000, inicio_mes: 0,
    taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  };
  const fundingCalc = fundingDoEstudo(
    [fin], c.fluxoMensal, new Array(c.prazo).fill(0), 0, 0, CONFIG_COMPLETA.taxaDescontoAa,
  );
  const funding = fundingCalc!.noFluxo;
  assert.ok(soma(funding.entradas) > 0, 'a fixture precisa gerar liberação, senão o teste não prova nada');
  assert.ok(soma(funding.saidas) > 0, 'a fixture precisa gerar serviço de dívida');

  const linhas = linhasFluxo(c, funding);
  const nome = (n: string) => linhas.find((l) => l.nome === n)!;

  // Entradas: bloco de receita próprio, aberto por OPERAÇÃO (#355 — o modelo
  // novo não agrupa por tipo, cada operação abre sua própria linha).
  const capital = nome('Funding — Capital (entradas)');
  assert.ok(capital, 'entradas de funding têm que virar bloco de receita');
  assert.ok(nome('Fin produção — liberações'));
  assert.equal(capital.custo, false);

  // Saídas: dentro de "Custos Financeiros", que já era uma das 5 categorias —
  // e o subtotal do grupo tem que somá-las junto com a linha do usuário.
  const financeiro = nome('Custos Financeiros');
  const jurosFunding = nome('Funding · Fin produção — parcelas');
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

// ─────────────────────────────────────────────────────────────────────────
// #351 — Proforma do Avançado (2ª sub-aba de Resultados).
//
// A razão de existir da proforma derivada do motor (em vez de reusar
// `calcularProforma` do Preliminar) é não contar história diferente da aba
// Fluxo de Caixa. Estes testes travam exatamente isso.
// ─────────────────────────────────────────────────────────────────────────

test('#351 proforma: Resultado reconcilia com o fluxo do motor (sem funding)', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const p = proformaAvancado(c, 1000);
  // Sem funding, o Resultado econômico é o mesmo do fluxo: receita líquida
  // menos todos os custos. Se divergir, as duas sub-abas mentem uma sobre a
  // outra — que é o defeito que esta implementação existe para evitar.
  assert.ok(Math.abs(p.resultado - soma(c.fluxoMensal)) <= 0.01);

  const nome = (n: string) => p.linhas.find((l) => l.nome === n)!;
  assert.equal(nome('Receita bruta (VGV)').valor, c.receitaBruta);
  assert.ok(Math.abs(nome('= Receita líquida').valor - soma(c.receitaMensal)) <= 0.01);
  // A ponte de deduções é a mesma da tabela do fluxo (RET + permuta financeira).
  assert.ok(nome('(-) Impostos e deduções sobre a receita').valor < 0);
  // Custo direto + indireto somam o Custo Total do motor.
  const direto = -nome('= Custo direto total').valor;
  const indireto = -nome('= Custo indireto total').valor;
  assert.ok(Math.abs((direto + indireto) - soma(c.custoMensal)) <= 0.01);
});

// ⚠️ SUBSTITUI o teste `#351 proforma: custo do funding entra em Custos
// Financeiros; aporte NÃO vira receita`. Aquele teste TRAVAVA O DEFEITO: a
// última asserção dele exigia `semFunding.resultado − comFunding.resultado ===
// Σ linhasSaida`, ou seja, exigia que o principal da dívida fosse cobrado como
// custo. Ele não podia sobreviver ao conserto — não é "teste que passou a
// falhar", é teste cujo critério estava errado.
test('#426 proforma do Avançado é DESALAVANCADA (D14)', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const fin: OperacaoFunding = {
    tipo: 'divida', nome: 'Fin produção', valor: 5_000_000, inicio_mes: 0,
    taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  };
  const fundingCalc = fundingDoEstudo(
    [fin], c.fluxoMensal, new Array(c.prazo).fill(0), 0, 0, CONFIG_COMPLETA.taxaDescontoAa,
  );
  const funding = fundingCalc!.noFluxo;

  // ── (a) por que a alternativa "creditar as duas pontas" também está errada.
  // As pontas NÃO se cancelam. Só o PRINCIPAL devolvido cancela o principal
  // liberado; as saídas carregam os JUROS por cima, e num horizonte que
  // termine antes da quitação ainda sobra saldo devedor jamais pago. Nesta
  // fixture o resíduo é R$ 1.053.567,77 sobre R$ 5.000.000,00 liberados — e
  // ele vazaria para o Resultado como se fosse lucro (ou prejuízo).
  const entradas = soma(funding.entradas);
  const saidas = funding.linhasSaida.reduce((s, l) => s + l.total, 0);
  assert.ok(entradas > 0, 'a fixture precisa gerar liberação, senão não prova nada');
  assert.ok(saidas > 0, 'a fixture precisa gerar serviço de dívida');
  assert.ok(Math.abs(entradas - saidas) > 0.01,
    'as duas pontas do funding NÃO se cancelam — é por isso que creditar ambas não serve');

  // ── (b) as três invariantes da proforma desalavancada.
  const p = proformaAvancado(c, 1000);

  // 1. o Resultado reconcilia com o fluxo LIVRE do motor;
  assert.ok(Math.abs(p.resultado - soma(c.fluxoMensal)) <= 0.01,
    `Resultado ${p.resultado} != Σ fluxoMensal ${soma(c.fluxoMensal)}`);

  // 2. "(-) Custos Financeiros" vale EXATAMENTE as linhas de custo que o
  //    usuário classificou no grupo `financeiro` — nunca o serviço da dívida;
  const custoFinanceiroProprio = c.linhasCusto
    .filter((x) => x.grupo === 'financeiro')
    .reduce((s, x) => s + x.total, 0);
  const linhaFinanceira = p.linhas.find((l) => l.nome === '(-) Custos Financeiros')!;
  assert.ok(linhaFinanceira, 'a fixture tem linha no grupo financeiro; a proforma precisa mostrá-la');
  assert.ok(Math.abs(-linhaFinanceira.valor - custoFinanceiroProprio) <= 0.01,
    'Custos Financeiros da proforma tem que ser só o custo próprio do estudo');
  assert.ok(Math.abs(-linhaFinanceira.valor - (custoFinanceiroProprio + saidas)) > 0.01,
    'se bater com custo próprio + serviço da dívida, o defeito da #426 voltou');

  // 3. o investimento total reconcilia com o custo do motor.
  assert.ok(Math.abs(p.investimentoTotal - soma(c.custoMensal)) <= 0.01,
    `investimentoTotal ${p.investimentoTotal} != Σ custoMensal ${soma(c.custoMensal)}`);
});

test('#426 a assinatura de `proformaAvancado` não aceita funding — trava de volta', () => {
  // ⚠️ `assert.equal(proformaAvancado.length, 2)`, que o critério de aceite da
  // issue pedia, NÃO DISTINGUE NADA: `Function.length` ignora parâmetro com
  // valor default, então a assinatura ANTIGA — `(c, area, funding = null)` —
  // já respondia 2. Medido: `function f(a,b,c=null){}` → `f.length === 2`.
  // Fica registrado porque é barato, mas o que morde são as duas travas abaixo.
  assert.equal(proformaAvancado.length, 2);

  // TRAVA 1 (compilação) — se alguém readicionar um terceiro parâmetro, mesmo
  // opcional e mesmo com default, `Parameters<...>['length']` deixa de ser
  // exatamente `2` (vira `2 | 3`) e o typecheck fica VERMELHO nesta linha.
  const arityDaAssinatura: 2 = 2 as Parameters<typeof proformaAvancado>['length'];
  assert.equal(arityDaAssinatura, 2);

  // TRAVA 2 (runtime) — passar funding por um terceiro argumento não pode
  // mudar nada. Hoje o argumento extra é ignorado pelo JS; se alguém voltar a
  // consumi-lo, esta comparação quebra. O cast existe para o grep do critério
  // de aceite 2 continuar verdadeiro: nenhuma chamada literal com 3 argumentos.
  const c = calcularFluxo(CONFIG_COMPLETA);
  const fundingCalc = fundingDoEstudo(
    [{ tipo: 'divida', nome: 'Fin produção', valor: 5_000_000, inicio_mes: 0,
       taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6 }],
    c.fluxoMensal, new Array(c.prazo).fill(0), 0, 0, CONFIG_COMPLETA.taxaDescontoAa,
  );
  const comTerceiroArgumento = (proformaAvancado as unknown as
    (...args: unknown[]) => ReturnType<typeof proformaAvancado>)(c, 1000, fundingCalc!.noFluxo);
  assert.deepEqual(comTerceiroArgumento, proformaAvancado(c, 1000));
});

test('#351 proforma: R$/m² e % VGV têm base declarada e sobrevivem a área/VGV zero', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const p = proformaAvancado(c, 2000);
  assert.equal(p.areaPrivativa, 2000);
  assert.equal(p.vgv, c.receitaBruta);
  assert.ok(Math.abs(p.margemPct - (p.resultado / p.vgv) * 100) <= 1e-9);
  // Estudo vazio: sem divisão por zero e sem NaN vazando para a tela.
  const vazio = calcularFluxo({ ...CONFIG, linhasReceita: [], linhasCusto: [] });
  const pv = proformaAvancado(vazio, 0);
  assert.equal(pv.margemPct, 0);
  assert.ok(pv.linhas.every((l) => Number.isFinite(l.valor)));
});

// ─────────────────────────────────────────────────────────────────────────
// #427 — a proforma do Avançado fecha com TRÊS linhas de resultado, como a
// EVI (`Premissas e Resultados!K35/K37/K39`): Resultado puro, + permuta
// financeira estornada, + permuta física (numerador E denominador).
// ─────────────────────────────────────────────────────────────────────────

/** CONFIG_COMPLETA + permuta financeira (8% VGV) + permuta física (2 unidades). */
const CONFIG_PERMUTAS: FluxoConfig = {
  ...CONFIG_COMPLETA,
  linhasCusto: [
    ...CONFIG_COMPLETA.linhasCusto,
    { id: 6, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira', orcamento_valor: 8, orcamento_unidade: 'pct_vgv' },
    { id: 7, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 11, permuta_quantidade: 2, orcamento_valor: null },
  ],
};

test('#427 proforma fecha com três leituras, cada uma com sua própria base', () => {
  const c = calcularFluxo(CONFIG_PERMUTAS);
  // A fixture precisa de facto gerar as duas permutas, senão o teste não prova nada.
  assert.ok(c.permutaFinanceiraTotal > 0, 'permutaFinanceiraTotal deveria ser > 0 nesta fixture');
  assert.ok(c.vgvPermutaFisica > 0, 'vgvPermutaFisica deveria ser > 0 nesta fixture');

  const p = proformaAvancado(c, 1000);

  // resultado (linha 1) — a definição não muda com esta issue.
  assert.ok(Math.abs(p.resultado - soma(c.fluxoMensal)) <= 0.01);

  // resultadoMaisPermutaFinanceira = resultado + permutaFinanceiraTotal — o
  // ESTORNO da dedução (P37 = P39 − P15 − P16 na EVI), não uma soma às cegas.
  assert.ok(Math.abs(p.resultadoMaisPermutaFinanceira - (p.resultado + c.permutaFinanceiraTotal)) <= 0.01);

  // resultadoMaisPermutas = resultadoMaisPermutaFinanceira + c.vgvPermutaFisica.
  assert.ok(Math.abs(p.resultadoMaisPermutas - (p.resultadoMaisPermutaFinanceira + c.vgvPermutaFisica)) <= 0.01);

  // Os três percentuais, cada um com a base declarada na issue.
  assert.ok(Math.abs(p.margemPct - (p.resultado / p.vgv) * 100) <= 1e-9);
  assert.ok(Math.abs(p.pctResultadoMaisPermutaFinanceira - (p.resultadoMaisPermutaFinanceira / p.vgv) * 100) <= 1e-9);
  assert.ok(Math.abs(
    p.pctResultadoMaisPermutas - (p.resultadoMaisPermutas / (p.vgv + c.vgvPermutaFisica)) * 100,
  ) <= 1e-9);

  // ⚠️ Asserção NEGATIVA — a que distingue: se alguém "unificar" os
  // denominadores (usar só `p.vgv` na 3ª linha), este teste tem de reprovar.
  assert.notEqual(p.pctResultadoMaisPermutas, (p.resultadoMaisPermutas / p.vgv) * 100);

  // As três linhas de fecho aparecem na tabela, com pctOverride e — só a 3ª,
  // só porque há permuta física — o rótulo/nota condicionais (K35/K36).
  const linhasResultado = p.linhas.filter((l) => l.tipo === 'resultado');
  assert.equal(linhasResultado.length, 3);
  assert.equal(linhasResultado[0].nome, '= Resultado');
  assert.equal(linhasResultado[1].nome, '= Resultado + Perm. Financ.');
  assert.equal(linhasResultado[2].nome, '= Resultado + Permutas');
  assert.equal(linhasResultado[2].notaBase, '1 / (VGV + Permutas Físicas)');
  assert.ok(linhasResultado.every((l) => typeof l.pctOverride === 'number'));
});

test('#427 degenerescência: sem permutas as três linhas coincidem, sem rótulo/nota extra (K35/K36)', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  assert.equal(c.permutaFinanceiraTotal, 0);
  assert.equal(c.vgvPermutaFisica, 0);

  const p = proformaAvancado(c, 1000);
  assert.ok(Math.abs(p.resultado - p.resultadoMaisPermutaFinanceira) <= 0.01);
  assert.ok(Math.abs(p.resultado - p.resultadoMaisPermutas) <= 0.01);
  assert.ok(Math.abs(p.margemPct - p.pctResultadoMaisPermutaFinanceira) <= 1e-9);
  assert.ok(Math.abs(p.margemPct - p.pctResultadoMaisPermutas) <= 1e-9);

  const linhasResultado = p.linhas.filter((l) => l.tipo === 'resultado');
  assert.equal(linhasResultado.length, 3);
  // Sem permuta física, o rótulo da 3ª linha cai para "= Resultado" (molde de
  // K35) e a nota de denominador não aparece (molde de K36).
  assert.equal(linhasResultado[2].nome, '= Resultado');
  assert.equal(linhasResultado[2].notaBase, undefined);
});

test('#427 não-regressão: o campo `resultado` de #351/#426 não muda de valor com esta issue', () => {
  // Trava explícita, além dos testes #351/#426 acima seguirem verdes sem
  // edição: mesmo com as duas permutas presentes, `resultado` (linha 1)
  // continua sendo receitaLiquida − custoDireto − custoIndireto, igual antes
  // desta issue — só as linhas 2 e 3 são NOVAS, nenhuma redefine a 1ª.
  const c = calcularFluxo(CONFIG_PERMUTAS);
  const p = proformaAvancado(c, 1000);
  assert.ok(Math.abs(p.resultado - soma(c.fluxoMensal)) <= 0.01);
});

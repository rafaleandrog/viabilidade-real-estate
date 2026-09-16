import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoConfig } from './fluxo-caixa-motor.js';
import { periodosAnuais, DEDUCOES_RECEITA_EH_CUSTO } from './fluxo-shared.js';
import { linhasFluxo, celulaFx } from './exportar.js';
import { chavesColapso, GRUPO_CUSTO_LABEL, celula as celulaTela } from './fluxo-tabela.js';
import { seriesEconomicasFluxo } from './fluxo-graficos.js';
import { fundingDoEstudo, type OperacaoFunding } from './funding-motor.js';
import { proformaAvancado, linhaInformativaFunding, linhaInformativaReceitaLiquidaEvi, comInformativasAntesDoResultado } from './proforma-avancado.js';

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const CONFIG: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
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

// #449: `celula` (tela, fluxo-tabela.ts) e `celulaFx` (exportação,
// exportar.ts) chamam a MESMA fonte (`celula` de viab-format.ts) — antes,
// cada uma tinha sua própria expressão de formatação e divergiam em casas
// decimais, limiar de célula vazia e representação do negativo.
//
// Decisão de desenho (o "Como corrigir" da issue pedia para decidir e
// declarar): a TELA sempre usa notação contábil (parênteses) — nunca existiu
// modo "sinal de menos" nela, e não é criado agora. O modo `comParenteses:
// false` (sinal de menos, `-100,00`) é exclusivo da EXPORTAÇÃO, herdado da
// linha informativa "antes do funding" de `celulaFx`. Por isso a equivalência
// testada é: para as DUAS combinações do parâmetro que `celula` (tela) já
// tinha (`ehCusto`/`negativoEntreParenteses`, true/false — que sempre operou
// em modo parênteses), `celulaTela` e `celulaFx` com `comParenteses: true`
// produzem texto IDÊNTICO. O modo exclusivo da exportação é testado à parte.
test('#449 celula (tela) e celulaFx (exportação, comParenteses=true) produzem texto idêntico', () => {
  const valores = [1234.56, 0.20, 0.004, -1234.56, -0.004, 0, -0, 1e9];
  for (const custo of [true, false]) {
    for (const v of valores) {
      const daTela = celulaTela(v, custo);
      const daExportacao = celulaFx(v, { custo }, true);
      assert.equal(
        daTela, daExportacao,
        `celula(${v}, ${custo}) = "${daTela}" ≠ celulaFx(${v}, {custo:${custo}}, true) = "${daExportacao}"`,
      );
    }
  }
});

test('#449 celulaFx: comParenteses=false (exclusivo da exportação) usa sinal de menos, não parênteses', () => {
  assert.equal(celulaFx(-1234.56, { custo: true }, false), '-1.234,56');
  assert.equal(celulaFx(-1234.56, { custo: false }, false), '-1.234,56');
  assert.equal(celulaFx(1234.56, { custo: true }, false), '1.234,56');
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

test('#592 com funding: as duas pontas saem do meio e a tabela fecha em Livre → funding → Fluxo de Caixa', () => {
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

  // #592 (O1) — Saídas NÃO estão mais dentro de "Custos Financeiros". O grupo
  // volta a valer só a linha que o usuário classificou ali, e o serviço da
  // dívida ganhou bloco próprio, depois do fecho do Livre.
  const financeiro = nome('Custos Financeiros');
  const linhaUsuario = nome('Taxas bancárias');
  for (let m = 0; m < c.prazo; m++) {
    assert.ok(Math.abs(linhaUsuario.mensal[m] - financeiro.mensal[m]) <= 0.01,
      `Custos Financeiros tem que valer SÓ a linha do usuário no mês ${m}`);
  }
  const servico = nome('Funding — Serviço (saídas)');
  assert.ok(servico, 'as saídas de funding têm bloco próprio');
  assert.equal(servico.custo, true);
  assert.ok(nome('Funding · Fin produção — parcelas'), 'a linha da operação continua detalhada');
  assert.deepEqual(servico.mensal, funding.saidas);

  // #592 (O1) — Custo Total é o custo do PROJETO, puro: não soma mais o
  // serviço da dívida. Prova pelo lado que o defeito atacaria: se as saídas
  // tivessem voltado para dentro, esta igualdade quebraria.
  const custo = nome('Custo Total');
  assert.deepEqual(custo.mensal, c.custoMensal);

  // #592 (O4) — A IDENTIDADE, mês a mês. É a afirmação central da tabela nova.
  const livre = nome('Fluxo de Caixa Livre Mensal');
  const fluxo = nome('Fluxo de Caixa Mensal');
  assert.deepEqual(livre.mensal, c.fluxoMensal, 'o Livre é o desalavancado do motor, sem retoque');
  for (let m = 0; m < c.prazo; m++) {
    assert.ok(Math.abs((livre.mensal[m] + capital.mensal[m] - servico.mensal[m]) - fluxo.mensal[m]) <= 0.01,
      `identidade O4 no mês ${m}`);
  }

  // E o Livre continua sendo receita líquida − custo do projeto: é o que
  // torna o encadeamento de cima para baixo legível.
  const liquida = nome('= Receita Líquida do Projeto');
  for (let m = 0; m < c.prazo; m++) {
    assert.ok(Math.abs((liquida.mensal[m] - custo.mensal[m]) - livre.mensal[m]) <= 0.01,
      `Livre = líquida − custo no mês ${m}`);
  }
});

// #472 (D12): com financiamento à produção — o único tipo que gera o bloco de
// detalhamento removido —, a tabela principal não ganha o bloco "(detalhamento)"
// nem a linha de rodapé "Fluxo de Caixa Livre (antes do funding)", a lista de
// nomes de NÍVEL 0 fecha exatamente como o critério de aceite pede, e os
// totais/VPL não mudam (o bloco removido já tinha total e VPL zerados).
test('#472 com financiamento à produção: sem bloco de detalhamento na tabela, nível 0 fecha exato', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const fin: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Banco X', valor: 0, inicio_mes: 0,
    taxa_anual: 12, exposicao_minima: 5, percentual_financiavel: 80, custo_linha_ids: [2],
    amortizar_com_caixa_disponivel: true,
  };
  const fundingCalc = fundingDoEstudo(
    [fin], c.fluxoMensal, new Array(c.prazo).fill(0), 0, 42, CONFIG_COMPLETA.taxaDescontoAa,
    { custosRaw: c.linhasCusto, linhasCusto: c.linhasCusto, cronograma: CONFIG_COMPLETA.cronograma },
  );
  const funding = fundingCalc!.noFluxo;
  assert.ok(funding.financiamentoProducao.length > 0,
    'a fixture precisa efetivamente liberar financiamento, senão o teste não prova nada');

  const linhas = linhasFluxo(c, funding);

  // Critérios 1 e 2: nada de "detalhamento" nem "fin-prod" na tabela.
  assert.equal(linhas.find((l) => l.nome.includes('detalhamento')), undefined);
  assert.equal(linhas.find((l) => l.nome === 'Fluxo de Caixa Livre (antes do funding)'), undefined);

  // Critério 3: a lista de nomes de NÍVEL 0, na ordem, sem nenhuma outra linha.
  const nomesNivel0 = linhas.filter((l) => l.nivel === 0).map((l) => l.nome);
  // #592: a ordem mudou — nada de funding antes do fecho do Livre.
  assert.deepEqual(nomesNivel0, [
    'Receita Bruta — VGV',
    'Custo Total',
    'Fluxo de Caixa Livre Mensal',
    'Fluxo de Caixa Livre Acumulado',
    'Funding — Capital (entradas)',
    'Funding — Serviço (saídas)',
    'Fluxo de Caixa Mensal',
    'Fluxo de Caixa Acumulado',
  ]);

  // Critério 4: Fluxo de Caixa Acumulado continua — regressão do endereço
  // errado (a redação anterior da issue mandava apagar :610, que hoje é
  // exatamente esta linha).
  assert.ok(linhas.find((l) => l.nome === 'Fluxo de Caixa Acumulado'));

  // Critério 5: totais/VPL do rodapé (Mensal e Acumulado) idênticos ao que
  // seriam sem o bloco de detalhamento — comparado contra um `linhasFluxo`
  // calculado sem funding algum, que nunca teve o bloco para começar.
  const semFunding = linhasFluxo(c, null);
  const mensalSemFunding = semFunding.find((l) => l.nome === 'Fluxo de Caixa Mensal')!;
  const mensalComFunding = linhas.find((l) => l.nome === 'Fluxo de Caixa Mensal')!;
  // O bloco removido tinha total/VPL zerados: a diferença entre os dois
  // rodapés é só o efeito do funding em si (entradas − saídas), não um
  // resíduo do bloco de auditoria.
  for (let m = 0; m < c.prazo; m++) {
    const esperado = mensalSemFunding.mensal[m] + funding.entradas[m] - funding.saidas[m];
    assert.ok(Math.abs(esperado - mensalComFunding.mensal[m]) <= 0.01, `mensal com funding, mês ${m}`);
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
  // #742: "= Receita líquida" agora também deduz Corretagem e Marketing (que
  // viraram dedução de receita, não mais custo) — não é mais igual a
  // `soma(c.receitaMensal)` (que só deduz RET + permuta financeira). CONFIG_COMPLETA
  // tem uma linha "Corretagem de vendas" (grupo diretos) — é ela que diverge.
  const corretagem = c.linhasCusto.find((x) => x.nome === 'Corretagem de vendas')!.total;
  assert.ok(Math.abs(nome('= Receita líquida').valor - (soma(c.receitaMensal) - corretagem)) <= 0.01);
  // A dedução de Imposto aparece isolada (CONFIG_COMPLETA tem RET ativo).
  assert.ok(nome('(-) Imposto').valor < 0);
  assert.ok(nome('(-) Corretagem').valor < 0);
  // Custo direto + indireto somam o Custo Total do motor MENOS Corretagem
  // (que saiu do custo direto para a seção de deduções).
  const direto = -nome('= Custo direto total').valor;
  const indireto = -nome('= Custo indireto total').valor;
  assert.ok(Math.abs((direto + indireto) - (soma(c.custoMensal) - corretagem)) <= 0.01);
});

// Proforma itemizada: cada linha de custo cadastrada em Custos aparece
// individualmente pelo nome que o usuário deu — classe de defeito nº 1 do
// CLAUDE.md ("o defeito mora na fiação"): sem este teste, apagar o `for (const
// l of doGrupo)` dentro de `itemizar` (proforma-avancado.ts) deixaria a suíte
// inteira verde (o teste acima só confere os TOTAIS).
test('Proforma itemizada: cada linha de custo aparece pelo nome, no bucket canônico certo', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const p = proformaAvancado(c, 1000);

  // CONFIG_COMPLETA (#742): 'Preço' (terreno) → bucket "Terreno"; 'Obra'
  // (categoria livre, não bate com nenhum bucket nomeado) → fallback direto;
  // 'Corretagem de vendas' (diretos) → dedução de receita, não mais item
  // itemizado do custo direto; 'Projetos' (classificada em `indireto` na
  // fixture, DE PROPÓSITO — #742 casa por NOME, não por grupo/aba) ainda
  // cai no bucket "Projetos e aprovações" do custo DIRETO;
  // 'Taxas bancárias' (financeiro) → bucket "Despesas Financeiras".
  const itens: Array<[string, string]> = [
    ['(-) Preço', 'terreno'],
    ['(-) Obra', 'obra'],
    ['(-) Projetos', 'indireto'],
    ['(-) Taxas bancárias', 'financeiro'],
  ];
  for (const [nomeItem, grupo] of itens) {
    const linhaItem = p.linhas.find((l) => l.nome === nomeItem);
    assert.ok(linhaItem, `linha de item "${nomeItem}" (grupo ${grupo}) não apareceu na Proforma`);
    assert.equal(linhaItem!.nivel, 1);
    assert.equal(linhaItem!.tipo, 'custo');
    const esperado = c.linhasCusto.find((x) => x.grupo === grupo)!.total;
    assert.ok(Math.abs(linhaItem!.valor - -esperado) <= 0.01, `valor do item "${nomeItem}"`);
  }
  // Corretagem não é mais item do custo direto — virou dedução de receita.
  assert.equal(p.linhas.find((l) => l.nome === '(-) Corretagem de vendas'), undefined);

  // O subtotal de "Despesas Financeiras" continua existindo, com o MESMO
  // valor de antes (só o rótulo mudou de "Custos Financeiros" para
  // "Despesas Financeiras", pedido do autor na #742).
  const subtotalFinanceiro = p.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!;
  assert.ok(Math.abs(subtotalFinanceiro.valor - -c.linhasCusto.find((x) => x.grupo === 'financeiro')!.total) <= 0.01);

  // Achado da revisão (PR #713): item e subtotal do bucket são AMBOS
  // `nivel: 1` — sem um sinal a mais, ficam visualmente idênticos na tela.
  // `subgrupo: true` é esse sinal, e só o subtotal carrega esse flag.
  assert.equal(subtotalFinanceiro.subgrupo, true);
  const itemObra = p.linhas.find((l) => l.nome === '(-) Obra')!;
  assert.equal(itemObra.subgrupo, undefined);
});

// Item de custo com valor ~zero não aparece na lista, mas o subtotal do
// bucket continua somando TODAS as linhas — mesmo critério que a linha
// "(-) Imposto" já usa (`Math.abs(v) > 0.005`).
test('Proforma itemizada: item de custo zerado some da lista, mas o subtotal do bucket não muda', () => {
  const comItemZerado: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      { id: 99, grupo: 'financeiro', categoria: 'Item zerado', orcamento_valor: 0, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
  };
  const semZerado = calcularFluxo(CONFIG_COMPLETA);
  const comZerado = calcularFluxo(comItemZerado);
  const pSemZerado = proformaAvancado(semZerado, 1000);
  const pComZerado = proformaAvancado(comZerado, 1000);

  assert.equal(pComZerado.linhas.find((l) => l.nome === '(-) Item zerado'), undefined);
  const subtotalSemZerado = pSemZerado.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!.valor;
  const subtotalComZerado = pComZerado.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!.valor;
  assert.equal(subtotalComZerado, subtotalSemZerado);
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

  // 2. "(-) Despesas Financeiras (exclui serviço da dívida)" vale EXATAMENTE
  //    as linhas de custo que o usuário classificou no grupo `financeiro` —
  //    nunca o serviço da dívida (#447: rótulo desambiguado da proforma;
  //    renomeado de "Custos Financeiros" para "Despesas Financeiras" na #742,
  //    a pedido do autor).
  const custoFinanceiroProprio = c.linhasCusto
    .filter((x) => x.grupo === 'financeiro')
    .reduce((s, x) => s + x.total, 0);
  const linhaFinanceira = p.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!;
  assert.ok(linhaFinanceira, 'a fixture tem linha no grupo financeiro; a proforma precisa mostrá-la');
  assert.ok(Math.abs(-linhaFinanceira.valor - custoFinanceiroProprio) <= 0.01,
    'Despesas Financeiras da proforma tem que ser só o custo próprio do estudo');
  assert.ok(Math.abs(-linhaFinanceira.valor - (custoFinanceiroProprio + saidas)) > 0.01,
    'se bater com custo próprio + serviço da dívida, o defeito da #426 voltou');

  // 3. o investimento total reconcilia com o custo do motor.
  assert.ok(Math.abs(p.investimentoTotal - soma(c.custoMensal)) <= 0.01,
    `investimentoTotal ${p.investimentoTotal} != Σ custoMensal ${soma(c.custoMensal)}`);
});

// ─────────────────────────────────────────────────────────────────────────
// #447 — desambiguação do rótulo "Custos Financeiros" na proforma, sem
// vazar para o mapa compartilhado `GRUPO_CUSTO_LABEL` (aba Fluxo + Resumo).
// ─────────────────────────────────────────────────────────────────────────

test('#447 a proforma rotula o grupo diferente da aba Fluxo, sem editar o mapa compartilhado', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  const p = proformaAvancado(c, 1000);
  const linhaFinanceira = p.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!;

  // O rótulo da proforma NÃO é o do mapa compartilhado (nem o antigo "Custos
  // Financeiros", nem uma versão sem o parêntese), e cita a exclusão.
  assert.notEqual(linhaFinanceira.nome, '(-) Custos Financeiros');
  assert.notEqual(linhaFinanceira.nome, '(-) Despesas Financeiras');
  assert.ok(linhaFinanceira.nome.includes('exclui serviço da dívida'),
    `rótulo "${linhaFinanceira.nome}" precisa declarar a exclusão`);

  // Teste de NÃO-VAZAMENTO: `GRUPO_CUSTO_LABEL.financeiro` — consumido pela
  // aba Fluxo (`fluxo-tabela.ts:599`) e pelo Resumo (`tela-resumo.ts:220`) —
  // continua EXATAMENTE 'Custos Financeiros'. Sem este teste, editar o mapa
  // compartilhado (em vez do override local) passaria nos critérios acima e
  // renomearia as outras duas telas por engano.
  assert.equal(GRUPO_CUSTO_LABEL.financeiro, 'Custos Financeiros');

  // E a exportação da aba Fluxo de Caixa (`linhasFluxo`, `exportar.ts`) — que
  // é outra superfície, de CAIXA, e não deve mudar — continua com o rótulo
  // sem parêntese.
  const linhasExportadas = linhasFluxo(c);
  assert.ok(linhasExportadas.some((l) => l.nome === 'Custos Financeiros'),
    'a exportação do Fluxo de Caixa não pode herdar o rótulo da proforma');
});

// ─────────────────────────────────────────────────────────────────────────
// #447 — linha informativa do funding no rodapé da proforma: mostra o
// serviço da dívida sem somá-lo em nenhum total.
// ─────────────────────────────────────────────────────────────────────────

/** Igual a `CONFIG_COMPLETA`, mas SEM linha de custo própria no grupo `financeiro`. */
const CONFIG_SEM_FINANCEIRO_PROPRIO: FluxoConfig = {
  ...CONFIG_COMPLETA,
  linhasCusto: CONFIG_COMPLETA.linhasCusto.filter((l) => l.grupo !== 'financeiro'),
};

test('#447 linha informativa do funding aparece sem linha de custo financeira própria, e não soma no Resultado', () => {
  const c = calcularFluxo(CONFIG_SEM_FINANCEIRO_PROPRIO);
  const fin: OperacaoFunding = {
    tipo: 'divida', nome: 'Fin produção', valor: 5_000_000, inicio_mes: 0,
    taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  };
  const fundingCalc = fundingDoEstudo(
    [fin], c.fluxoMensal, new Array(c.prazo).fill(0), 0, 0, CONFIG_SEM_FINANCEIRO_PROPRIO.taxaDescontoAa,
  );
  const funding = fundingCalc!.noFluxo;
  const totalSaidas = funding.linhasSaida.reduce((s, l) => s + l.total, 0);
  assert.ok(totalSaidas > 0, 'a fixture precisa gerar serviço de dívida, senão o teste não prova nada');

  // Na proforma: sem linha de custo própria no grupo, "(-) Despesas
  // Financeiras…" não aparece — o grupo só existe aqui através da linha
  // informativa.
  const p = proformaAvancado(c, 1000);
  assert.equal(p.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras')), undefined);

  const informativa = linhaInformativaFunding(totalSaidas);
  assert.ok(informativa, 'com serviço de dívida > 0, a linha informativa tem que existir');
  assert.equal(informativa!.tipo, 'informativo');
  assert.ok(informativa!.nome.includes('efeito do funding'));
  assert.ok(informativa!.nome.toLowerCase().includes('fluxo de caixa'));
  assert.ok(Math.abs(informativa!.valor - -totalSaidas) <= 0.01);

  // A invariante da #426 não muda com a linha presente: `resultado` é campo
  // próprio de `ProformaAvancado`, nunca recomputado a partir de `linhas`.
  assert.ok(Math.abs(p.resultado - soma(c.fluxoMensal)) <= 0.01,
    `Resultado ${p.resultado} != Σ fluxoMensal ${soma(c.fluxoMensal)}`);

  // ⚠️ #592 MUDOU O ENDEREÇO, e a distinção de conteúdo continua de pé.
  // Antes, na aba Fluxo de Caixa o serviço da dívida aparecia DENTRO do
  // subtotal "Custos Financeiros" — e este fixture não tem linha própria nesse
  // grupo, então o grupo existia SÓ por causa do funding. Agora ele não
  // existe: o serviço da dívida tem bloco próprio ao fim da tabela.
  //
  // O que a #447 afirma segue valendo, e é sobre as DUAS superfícies: na
  // proforma o efeito do funding é EXIBIDO e nunca somado; na aba Fluxo de
  // Caixa ele é SOMADO — só que agora entre o Fluxo de Caixa Livre e o Fluxo
  // de Caixa, que é onde o autor o quer.
  const linhasFx = linhasFluxo(c, funding);
  assert.equal(linhasFx.find((l) => l.nome === 'Custos Financeiros'), undefined,
    'sem linha própria do usuário, o grupo não existe mais — o funding saiu de dentro dele');
  const servicoFx = linhasFx.find((l) => l.nome === 'Funding — Serviço (saídas)')!;
  assert.ok(servicoFx, 'o serviço da dívida tem bloco próprio');
  assert.ok(Math.abs(servicoFx.total - totalSaidas) <= 0.01);
});

test('#447 sem funding (ou sem serviço de dívida), a linha informativa não existe', () => {
  assert.equal(linhaInformativaFunding(0), null);
  assert.equal(linhaInformativaFunding(0.001), null);
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
  // #604: com VGV > 0 a margem tem de estar DEFINIDA — `null` aqui seria o
  // conserto vazando para o caso normal, que é o risco desta issue.
  assert.notEqual(p.margemPct, null, 'com VGV > 0 a margem não pode ser indefinida');
  assert.ok(Math.abs(p.margemPct! - (p.resultado / p.vgv) * 100) <= 1e-9);
  // #611: com investimento > 0 (CONFIG_COMPLETA tem linhas de custo) o ROI
  // tem que estar DEFINIDO — `null` aqui seria o conserto vazando para o
  // caso normal, que é o risco desta issue.
  assert.notEqual(p.roiPct, null, 'com investimento > 0 o ROI não pode ser indefinido');
  assert.ok(Math.abs(p.roiPct! - (p.resultado / p.investimentoTotal) * 100) <= 1e-9);
  // Estudo vazio: sem divisão por zero e sem NaN vazando para a tela.
  //
  // ⚠️ #604 INVERTEU esta asserção, e a inversão é o ponto da issue. Ela
  // cobrava `pv.margemPct === 0` — ou seja, TRAVAVA o defeito: um percentual
  // sem denominador publicado como "zero medido". Agora cobra `null`, que é o
  // que distingue "mediu zero" de "não há base para medir".
  //
  // O que a #351 realmente queria daqui **continua valendo e continua aqui**:
  // nada de divisão por zero, nada de NaN vazando para a tela. É a linha do
  // `Number.isFinite` abaixo, que não mudou.
  const vazio = calcularFluxo({ ...CONFIG, linhasReceita: [], linhasCusto: [] });
  const pv = proformaAvancado(vazio, 0);
  assert.equal(pv.margemPct, null);
  // #611: sem NENHUMA linha de custo, `investimentoTotal = 0` — o ROI é
  // indefinido (não há denominador), nunca "mediu zero". Mutação: trocar o
  // `null` de volta para 0 em `proforma-avancado.ts` faz esta asserção falhar.
  assert.equal(pv.investimentoTotal, 0, 'a fixture precisa MESMO zerar o investimento, senão o teste não prova nada');
  assert.equal(pv.roiPct, null);
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
  // #604: os três definidos, porque este estudo tem VGV > 0.
  assert.notEqual(p.margemPct, null);
  assert.notEqual(p.pctResultadoMaisPermutaFinanceira, null);
  assert.notEqual(p.pctResultadoMaisPermutas, null);
  assert.ok(Math.abs(p.margemPct! - (p.resultado / p.vgv) * 100) <= 1e-9);
  assert.ok(Math.abs(p.pctResultadoMaisPermutaFinanceira! - (p.resultadoMaisPermutaFinanceira / p.vgv) * 100) <= 1e-9);
  assert.ok(Math.abs(
    p.pctResultadoMaisPermutas! - (p.resultadoMaisPermutas / (p.vgv + c.vgvPermutaFisica)) * 100,
  ) <= 1e-9);

  // ⚠️ Asserção NEGATIVA — a que distingue: se alguém "unificar" os
  // denominadores (usar só `p.vgv` na 3ª linha), este teste tem de reprovar.
  assert.notEqual(p.pctResultadoMaisPermutas, (p.resultadoMaisPermutas / p.vgv) * 100);

  // As três linhas de fecho aparecem na tabela, com pctOverride e — só a 3ª,
  // só porque há permuta física — o rótulo/nota condicionais (K35/K36).
  const linhasResultado = p.linhas.filter((l) => l.tipo === 'resultado');
  assert.equal(linhasResultado.length, 3);
  // #742: ordem invertida a pedido do autor — a leitura mais inclusiva
  // primeiro, o resultado de fato (sem nenhuma permuta somada) por último.
  assert.equal(linhasResultado[0].nome, '= Resultado + Permutas');
  assert.equal(linhasResultado[0].notaBase, '1 / (VGV + Permutas Físicas)');
  assert.equal(linhasResultado[1].nome, '= Resultado + Perm. Financ.');
  assert.equal(linhasResultado[2].nome, '= Resultado');
  assert.ok(linhasResultado.every((l) => typeof l.pctOverride === 'number'));
});

test('#427 degenerescência: sem permutas as três linhas coincidem, sem rótulo/nota extra (K35/K36)', () => {
  const c = calcularFluxo(CONFIG_COMPLETA);
  assert.equal(c.permutaFinanceiraTotal, 0);
  assert.equal(c.vgvPermutaFisica, 0);

  const p = proformaAvancado(c, 1000);
  assert.ok(Math.abs(p.resultado - p.resultadoMaisPermutaFinanceira) <= 0.01);
  assert.ok(Math.abs(p.resultado - p.resultadoMaisPermutas) <= 0.01);
  assert.notEqual(p.margemPct, null);
  assert.ok(Math.abs(p.margemPct! - p.pctResultadoMaisPermutaFinanceira!) <= 1e-9);
  assert.ok(Math.abs(p.margemPct! - p.pctResultadoMaisPermutas!) <= 1e-9);

  const linhasResultado = p.linhas.filter((l) => l.tipo === 'resultado');
  assert.equal(linhasResultado.length, 3);
  // Sem permuta física, o rótulo da 1ª linha (a leitura "+ Permutas", #742
  // reordenou o rodapé — ela é a primeira agora) cai para "= Resultado"
  // (molde de K35) e a nota de denominador não aparece (molde de K36).
  assert.equal(linhasResultado[0].nome, '= Resultado');
  assert.equal(linhasResultado[0].notaBase, undefined);
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

// ─────────────────────────────────────────────────────────────────────────
// #742 — reordenação/reclassificação da Proforma do Avançado a pedido do
// autor: Corretagem/Marketing viram dedução de receita, os demais custos
// diretos/indiretos ganham posição canônica por NOME (independente do grupo
// da aba Custos), e o rodapé de resultado é exibido na ordem inversa.
// ─────────────────────────────────────────────────────────────────────────

test('#742: Corretagem e Marketing viram dedução de receita, independente do grupo em que foram cadastradas', () => {
  const CONFIG_MARKETING_FORA_DE_LUGAR: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      // Cadastrada em `indireto` de propósito — a #742 casa por NOME
      // ("Marketing & Publicidade" é a categoria da dedução de receita,
      // distinta de "Marketing global", que é custo indireto de verdade).
      { id: 100, grupo: 'indireto', categoria: 'Marketing & Publicidade', orcamento_valor: 200_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 6 },
    ],
  };
  const c = calcularFluxo(CONFIG_MARKETING_FORA_DE_LUGAR);
  const p = proformaAvancado(c, 1000);

  const marketing = c.linhasCusto.find((x) => x.nome === 'Marketing & Publicidade')!.total;
  const corretagem = c.linhasCusto.find((x) => x.nome === 'Corretagem de vendas')!.total;
  assert.ok(marketing > 0, 'a fixture precisa mesmo gerar a linha, senão o teste não prova nada');

  const linhaMarketing = p.linhas.find((l) => l.nome === '(-) Marketing')!;
  assert.ok(linhaMarketing, '"(-) Marketing" tem que existir mesmo vindo do grupo indireto');
  assert.ok(Math.abs(linhaMarketing.valor - -marketing) <= 0.01);
  // E não aparece de novo como item de custo indireto (nem some, nem duplica).
  assert.equal(p.linhas.find((l) => l.nome === '(-) Marketing & Publicidade'), undefined);

  // Resultado não muda de valor por causa de ONDE a linha foi cadastrada —
  // só de apresentação.
  assert.ok(Math.abs(p.resultado - soma(c.fluxoMensal)) <= 0.01);
  void corretagem;
});

test('#742: item sem categoria canônica (grupo "Outro"/livre) não é descartado — cai no fallback do próprio bloco', () => {
  const CONFIG_COM_OUTRO: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      { id: 101, grupo: 'diretos', categoria: 'Outro', subcategoria: 'Brinde de lançamento', orcamento_valor: 50_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 102, grupo: 'indireto', categoria: 'Outro', orcamento_valor: 30_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
  };
  const c = calcularFluxo(CONFIG_COM_OUTRO);
  const p = proformaAvancado(c, 1000);

  // grupo='diretos' não tem `subcategoria` no nome (nomeLinhaCusto só junta
  // categoria+subcategoria quando grupo==='terreno') — o nome exibido é só
  // "Outro".
  const itensOutro = p.linhas.filter((l) => l.nome === '(-) Outro');
  assert.equal(itensOutro.length, 2, 'as duas linhas "Outro" (diretos e indireto) têm que aparecer, sem se fundir');

  const custoDireto = -p.linhas.find((l) => l.nome === '= Custo direto total')!.valor;
  const custoIndireto = -p.linhas.find((l) => l.nome === '= Custo indireto total')!.valor;
  // O "Outro" de `diretos` soma no custo direto; o de `indireto`, no indireto
  // — nenhum dos dois é descartado (a soma dos dois totais bate com o custo
  // do motor, menos Corretagem/Marketing que saíram para a dedução de receita).
  const corretagem = c.linhasCusto.find((x) => x.nome === 'Corretagem de vendas')!.total;
  assert.ok(Math.abs((custoDireto + custoIndireto) - (soma(c.custoMensal) - corretagem)) <= 0.01);

  // #742 (achado do Codex, rodada 1): o teste acima só confere o AGREGADO —
  // um "Outro" que trocasse de lado (ex.: o de `diretos` cair no indireto por
  // casar pelo NOME "Outro" no bucket "Gestão e outros custos indiretos")
  // ainda bateria na soma, porque o total do motor não muda. Confira o LADO
  // de cada um, individualmente: "Outro" de `diretos` (id 101, R$ 50.000) tem
  // que compor `= Custo direto total`, nunca o indireto — e vice-versa para
  // o de `indireto` (id 102, R$ 30.000).
  const outroDiretos = c.linhasCusto.find((l) => l.nome === 'Outro' && l.grupo === 'diretos')!;
  const outroIndireto = c.linhasCusto.find((l) => l.nome === 'Outro' && l.grupo === 'indireto')!;
  assert.ok(custoDireto >= outroDiretos.total - 0.01, '"Outro" de `diretos` tem que estar no custo DIRETO');
  assert.ok(custoIndireto >= outroIndireto.total - 0.01, '"Outro" de `indireto` tem que estar no custo INDIRETO');
});

test('#742: "(-) Imposto" isolado bate com o RET medido, mesmo com Corretagem e Permuta financeira presentes', () => {
  const c = calcularFluxo(CONFIG_PERMUTAS);
  const p = proformaAvancado(c, 1000);
  const imposto = p.linhas.find((l) => l.nome === '(-) Imposto')!;
  assert.ok(imposto, 'CONFIG_PERMUTAS tem RET ativo — a linha tem que existir');

  // Identidade: Receita líquida canônica (RET + permuta financeira, só) menos
  // a permuta financeira isola o RET — é exatamente o que "(-) Imposto"
  // publica, independente de haver Corretagem/Marketing no estudo.
  const receitaLiquidaCanonica = soma(c.receitaMensal);
  const impostoEsperado = -(receitaLiquidaCanonica - c.receitaBruta) - c.permutaFinanceiraTotal;
  assert.ok(Math.abs(-imposto.valor - impostoEsperado) <= 0.01);
});

test('#742: rodapé de resultado mostra "Resultado + Permutas" primeiro e "Resultado" (o efetivo) por último', () => {
  const c = calcularFluxo(CONFIG_PERMUTAS);
  const p = proformaAvancado(c, 1000);
  const linhasResultado = p.linhas.filter((l) => l.tipo === 'resultado');
  assert.equal(linhasResultado.length, 3);
  assert.deepEqual(linhasResultado.map((l) => l.nome), [
    '= Resultado + Permutas',
    '= Resultado + Perm. Financ.',
    '= Resultado',
  ]);
  // A ÚLTIMA linha é o resultado de fato — sem nenhuma permuta somada de volta.
  assert.ok(Math.abs(linhasResultado[2].valor - p.resultado) <= 0.01);
});

test('#742 (achado do Codex, rodada 1): com Contingência E financeiro no mesmo estudo, "Despesas Financeiras" vem ANTES de "Contingências"', () => {
  const CONFIG_CONTINGENCIA_E_FINANCEIRO: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      { id: 200, grupo: 'obra', categoria: 'Contingência', orcamento_valor: 80_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
  };
  const c = calcularFluxo(CONFIG_CONTINGENCIA_E_FINANCEIRO);
  const p = proformaAvancado(c, 1000);
  const idxFinanceiro = p.linhas.findIndex((l) => l.nome.startsWith('(-) Despesas Financeiras'));
  const idxContingencia = p.linhas.findIndex((l) => l.nome === '(-) Contingência');
  assert.ok(idxFinanceiro >= 0 && idxContingencia >= 0, 'as duas linhas têm que existir na fixture');
  assert.ok(idxFinanceiro < idxContingencia, 'ordem canônica: "... Despesas Financeiras, Contingências"');
});

test('#742 (achado do Codex, rodada 2): nome canônico vence o grupo mesmo quando a linha está em `financeiro`', () => {
  const CONFIG_NOME_CANONICO_NO_GRUPO_FINANCEIRO: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      // Combinação que o backend aceita hoje: nome de bucket canônico, mas
      // classificado no grupo `financeiro` em vez do grupo "natural" dele.
      { id: 300, grupo: 'financeiro', categoria: 'Contingência', orcamento_valor: 40_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 301, grupo: 'financeiro', categoria: 'Marketing global', orcamento_valor: 60_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
  };
  const c = calcularFluxo(CONFIG_NOME_CANONICO_NO_GRUPO_FINANCEIRO);
  const p = proformaAvancado(c, 1000);

  // As duas têm que aparecer pelo BUCKET NOMEADO, nunca dentro do catch-all
  // "Despesas Financeiras" — a classificação é por NOME, independente do
  // grupo em que o usuário classificou a linha (decisão do autor, #742).
  assert.ok(p.linhas.find((l) => l.nome === '(-) Contingência'), '"Contingência" tem que aparecer pelo nome, mesmo vindo do grupo financeiro');
  assert.ok(p.linhas.find((l) => l.nome === '(-) Marketing global'), '"Marketing global" tem que aparecer pelo nome, mesmo vindo do grupo financeiro');

  // "Despesas Financeiras" continua existindo (CONFIG_COMPLETA já tem uma
  // linha 'Taxas bancárias'/financeiro, R$ 100.000, que ESSA sim não tem
  // nome canônico e cai no catch-all) — mas o valor tem que ser EXATAMENTE
  // essa, sem as duas linhas de nome canônico (Contingência R$ 40.000 e
  // Marketing global R$ 60.000) misturadas dentro.
  const linhaFinanceiro = p.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!;
  assert.ok(linhaFinanceiro, '"Despesas Financeiras" continua existindo — só não pode incluir as linhas de nome canônico');
  assert.ok(Math.abs(linhaFinanceiro.valor - -100_000) <= 0.01, 'só a linha SEM nome canônico ("Taxas bancárias") pode estar em Despesas Financeiras');

  // Ordem preservada: "Contingência" continua depois de onde "Despesas
  // Financeiras" estaria, e "Marketing global" continua entre "Receita
  // operacional" e "= Custo indireto total" (não vira custo direto).
  const idxReceitaOperacional = p.linhas.findIndex((l) => l.nome === '= Receita operacional');
  const idxMarketingGlobal = p.linhas.findIndex((l) => l.nome === '(-) Marketing global');
  const idxCustoIndiretoTotal = p.linhas.findIndex((l) => l.nome === '= Custo indireto total');
  assert.ok(idxReceitaOperacional < idxMarketingGlobal && idxMarketingGlobal < idxCustoIndiretoTotal);
});

test('#742 (achado do Codex, rodada 3): "Preço" casa por nome mesmo fora do grupo `terreno`', () => {
  const CONFIG_PRECO_FORA_DO_TERRENO: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      // Combinação que o backend aceita hoje, embora o catálogo de Custos só
      // ofereça "Preço" dentro do grupo `terreno`: aqui ela vem do `financeiro`.
      { id: 400, grupo: 'financeiro', categoria: 'Preço', orcamento_valor: 70_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
  };
  const c = calcularFluxo(CONFIG_PRECO_FORA_DO_TERRENO);
  const p = proformaAvancado(c, 1000);

  // Tem que existir DUAS linhas "(-) Preço" — a do terreno de CONFIG_COMPLETA
  // (id 1) e esta nova (id 400) — ambas no bucket "Terreno", nunca dentro de
  // "Despesas Financeiras".
  const itensPreco = p.linhas.filter((l) => l.nome === '(-) Preço');
  assert.equal(itensPreco.length, 2, 'as duas linhas "Preço" (terreno e financeiro) têm que casar pelo bucket Terreno');

  const linhaFinanceiro = p.linhas.find((l) => l.nome.startsWith('(-) Despesas Financeiras'))!;
  assert.ok(Math.abs(linhaFinanceiro.valor - -100_000) <= 0.01, '"Preço" não pode inflar "Despesas Financeiras" (só a Taxas bancárias original)');
});

test('#742 (achado do Codex, rodada 4): nome canônico casa mesmo com sufixo de subcategoria do terreno', () => {
  const CONFIG_SUFIXO_TERRENO: FluxoConfig = {
    ...CONFIG_COMPLETA,
    linhasCusto: [
      ...CONFIG_COMPLETA.linhasCusto,
      // `nomeLinhaCusto` só junta categoria+subcategoria quando grupo===
      // 'terreno' — o backend aceita qualquer categoria ali, então esta linha
      // sai como "Corretagem de vendas — algumacoisa", não "Corretagem de
      // vendas" pura.
      { id: 500, grupo: 'terreno', categoria: 'Corretagem de vendas', subcategoria: 'algumacoisa', orcamento_valor: 20_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
  };
  const c = calcularFluxo(CONFIG_SUFIXO_TERRENO);
  const p = proformaAvancado(c, 1000);

  // Tem que virar dedução de receita ("(-) Corretagem"), não ficar presa no
  // fallback de custo direto com o nome completo sufixado.
  const linhaCorretagem = p.linhas.find((l) => l.nome === '(-) Corretagem')!;
  assert.ok(linhaCorretagem, '"(-) Corretagem" tem que existir mesmo com o nome sufixado');
  const corretagemOriginal = c.linhasCusto.find((x) => x.nome.startsWith('Corretagem de vendas') && x.grupo === 'diretos')!.total;
  const corretagemSuficada = c.linhasCusto.find((x) => x.grupo === 'terreno' && x.nome.startsWith('Corretagem'))!.total;
  assert.ok(Math.abs(-linhaCorretagem.valor - (corretagemOriginal + corretagemSuficada)) <= 0.01, 'as duas Corretagens (com e sem sufixo) somam na mesma dedução');

  // E não pode sobrar solta como item de custo direto com o nome completo.
  assert.equal(p.linhas.find((l) => l.nome.includes('— algumacoisa')), undefined);
});

test('#742 (achado do Codex, rodada 4): `comInformativasAntesDoResultado` preserva "= Resultado" como a última linha', () => {
  const c = calcularFluxo(CONFIG_PERMUTAS);
  const p = proformaAvancado(c, 1000);
  const informativas = [
    linhaInformativaFunding(50_000)!,
    linhaInformativaReceitaLiquidaEvi(123_456),
  ];
  const linhas = comInformativasAntesDoResultado(p.linhas, informativas);

  // A última linha da lista RENDERIZADA continua sendo o resultado efetivo —
  // as informativas não podem empurrá-lo para o meio.
  assert.equal(linhas[linhas.length - 1].nome, '= Resultado');
  assert.equal(linhas[linhas.length - 1].tipo, 'resultado');

  // As duas informativas continuam presentes, só que ANTES do bloco de
  // resultado (`tipo: 'resultado'`), não depois.
  const idxPrimeiroResultado = linhas.findIndex((l) => l.tipo === 'resultado');
  const idxInformativas = linhas
    .map((l, i) => (l.tipo === 'informativo' ? i : -1))
    .filter((i) => i !== -1);
  assert.equal(idxInformativas.length, 2);
  for (const i of idxInformativas) assert.ok(i < idxPrimeiroResultado);

  // Caso sem informativas: devolve a lista original intocada.
  const semInformativas = comInformativasAntesDoResultado(p.linhas, []);
  assert.deepEqual(semInformativas, p.linhas);
});

// ─────────────────────────────────────────────────────────────────────────
// #591 — a dedução sobre a receita é CUSTO, e as três vistas concordam.
//
// O defeito relatado era de APRESENTAÇÃO: a linha "(-) Impostos e deduções
// sobre a receita" saía com a classe `receita` na tabela do Fluxo de Caixa e
// o CSS a pintava com o token de sucesso, na mesma faixa verde dos grupos de
// VGV logo acima. A Proforma do Avançado, com a MESMA linha, sempre a
// classificou como `custo`.
//
// ⚠️ O QUE ESTE BLOCO MEDE, E O QUE ELE NÃO MEDE — a distinção importa.
// Ele confronta duas IMPLEMENTAÇÕES REAIS entre si (a exportação e a Proforma
// do Avançado), em vez de comparar cada uma com um literal escrito aqui: um
// literal teria de ser copiado de um dos dois lados, e a partir daí os três
// poderiam divergir sem nada ficar vermelho. É o mesmo desenho de
// `frontend/proforma-cores.test.ts` e de `frontend/proforma-ordem-linhas.test.ts`.
//
// O que ele NÃO alcança é a TELA: `tabelaFluxo` devolve um `TemplateResult`, e
// nenhuma etapa de lógica pura lê classe de CSS chegando ao DOM. Quem prova
// aquela ponta é o caso de render `frontend/render/casos/tabela-fluxo.ts`, que
// exige `tr.subgrupo.custo[data-linha="deducoes"]` na tela montada em Chromium.
// As duas pontas se movem juntas porque leem a MESMA constante
// (`DEDUCOES_RECEITA_EH_CUSTO`, `frontend/fluxo-shared.ts`).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fixture de LOTEAMENTO com RET ativo — critério 7 da issue (paridade
 * Loteamento × Incorporação). `tabelaFluxo`/`linhasFluxo` não ramificam por
 * padrão de empreendimento hoje, então este fixture não exercita um segundo
 * CAMINHO de código: ele é a trava contra alguém introduzir a ramificação
 * depois e a paridade se perder em silêncio.
 */
const CONFIG_LOTEAMENTO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
  ret: { ativo: true, pct: 4 },
  linhasReceita: [{
    id: 1, nome: 'Quadra A', fase_label: 'Lotes',
    tipologias: [{ id: 21, nome: 'Lote padrão', quantidade: 120, area_privativa_m2: 250, preco_m2: 900 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 80, parcelas: 36, periodicidade: 'mensal' }],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Gleba', orcamento_valor: 4_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Infraestrutura', orcamento_valor: 9_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
  ],
  areaTerreno: 60_000,
};

for (const [padrao, cfg] of [
  ['Incorporação', CONFIG_COMPLETA],
  ['Loteamento', CONFIG_LOTEAMENTO],
] as [string, FluxoConfig][]) {
  test(`#591 (${padrao}) a dedução sai como CUSTO na exportação, igual à Proforma do Avançado`, () => {
    const c = calcularFluxo(cfg);
    const linhas = linhasFluxo(c);
    const deducaoFx = linhas.find((l) => l.nome === '(-) Impostos e deduções sobre a receita')!;
    const liquidaFx = linhas.find((l) => l.nome === '= Receita Líquida do Projeto')!;
    assert.ok(deducaoFx, 'com RET ativo a linha-ponte de deduções tem que existir');
    assert.ok(deducaoFx.total < 0, 'a dedução é negativa (líquida − bruta)');

    // A MESMA linha, na Proforma do Avançado — que desde a #742 mostra o
    // Imposto isolado (`(-) Imposto`), não mais uma linha combinada. Nestas
    // duas fixtures não há permuta financeira, então o valor de "(-) Imposto"
    // é exatamente a ponte que `linhasFluxo` soma. `tipo: 'custo'` lá é o
    // lado que sempre esteve certo — é contra ele que a exportação é
    // confrontada.
    const pf = proformaAvancado(c, 1000);
    const deducaoPf = pf.linhas.find((l) => l.nome === '(-) Imposto')!;
    assert.ok(deducaoPf, 'a Proforma do Avançado também lista o Imposto');
    assert.ok(Math.abs(deducaoPf.valor - deducaoFx.total) <= 0.01,
      'sem permuta financeira nestas fixtures, "(-) Imposto" tem que bater com a ponte do Fluxo de Caixa');
    assert.equal(deducaoPf.tipo, 'custo');

    assert.equal(
      deducaoFx.custo, deducaoPf.tipo === 'custo',
      'a dedução tem que ter a MESMA natureza no Fluxo de Caixa e na Proforma do Avançado',
    );
    assert.equal(deducaoFx.custo, DEDUCOES_RECEITA_EH_CUSTO);
    assert.equal(DEDUCOES_RECEITA_EH_CUSTO, true);

    // Critério 4: a linha irmã continua sendo RECEITA — ela é o total de
    // receita a que a dedução chega, não uma redução.
    assert.equal(liquidaFx.custo, false);
  });

  test(`#591 (${padrao}) a aritmética da ponte não muda, e o texto da célula também não`, () => {
    const c = calcularFluxo(cfg);
    const linhas = linhasFluxo(c);
    const nome = (n: string) => linhas.find((l) => l.nome === n)!;
    const bruta = nome('Receita Bruta — VGV');
    const deducao = nome('(-) Impostos e deduções sobre a receita');
    const liquida = nome('= Receita Líquida do Projeto');

    for (let m = 0; m < c.prazo; m++) {
      // Critério 3: bruta + deduções = líquida, mês a mês, sem afrouxamento.
      assert.ok(
        Math.abs((bruta.mensal[m] + deducao.mensal[m]) - liquida.mensal[m]) <= 0.01,
        `ponte mês ${m}`,
      );
      // Critério 2: tela e exportação escrevem a MESMA célula. `celulaTela`
      // recebe o mesmo `ehCusto` que a linha exportada declara — é a paridade
      // que a #449 fechou, agora sobre a natureza nova.
      assert.equal(
        celulaTela(deducao.mensal[m], deducao.custo),
        celulaFx(deducao.mensal[m], deducao, true),
        `célula divergente no mês ${m}`,
      );
      // E o texto NÃO muda por causa desta issue: a série é ≤ 0, e
      // `negativoContabil` já põe negativo entre parênteses com ou sem
      // `custo`. É a evidência de que trocar a natureza acerta a COR sem
      // mexer na notação — o efeito colateral que a issue listava em D2.
      assert.equal(
        celulaTela(deducao.mensal[m], true),
        celulaTela(deducao.mensal[m], false),
        `a notação da dedução mudou no mês ${m}`,
      );
    }
  });
}

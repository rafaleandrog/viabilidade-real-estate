// #592 — a tabela mensal do Fluxo de Caixa fecha em DUAS seções: primeiro o
// `Fluxo de Caixa Livre` (sem nenhuma linha de funding), depois as duas pontas
// do funding, e só então o `Fluxo de Caixa`. É a estrutura da planilha do
// autor: `Caixa Livre` → fluxos de funding → `Caixa`.
//
// ⚠️ O QUE ESTE ARQUIVO MEDE, E ONDE ELE ANCORA.
// A afirmação central da issue (O4) é uma IDENTIDADE — `Fluxo de Caixa =
// Fluxo de Caixa Livre + entradas − saídas` —, e ela é aferida sobre as linhas
// que a tabela e o relatório realmente publicam, não sobre as séries do motor.
// A diferença importa: as séries do motor sempre fecharam; o que a issue muda
// é quais delas viram linha e em que ordem. Um teste contra o motor passaria
// mesmo com a tabela montando a ordem errada.
//
// A ancoragem na TELA usa `strings`/`values` do `TemplateResult` (mesmo idioma
// de `frontend/nav-avancado.test.ts`, que explica por que isso roda sem DOM):
// os rótulos são argumentos de `linhaTabela`/`linhaResultado`, então ficam nos
// `values`, e a ORDEM deles no template é a ordem visual das linhas.
//
// O que este arquivo NÃO alcança é a cor e a geometria — isso é
// `frontend/render/casos/tabela-fluxo-funding.ts`, em Chromium.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig, type FluxoCalc } from './fluxo-caixa-motor.js';
import { fundingDoEstudo, type OperacaoFunding, type FundingNoFluxo } from './funding-motor.js';
import { tabelaFluxo, chavesColapso, kpisFluxo } from './fluxo-tabela.js';
import { linhasFluxo } from './exportar.js';

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

/** Incorporação: torre com tipologias e RET ativo. */
const INCORPORACAO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  ret: { ativo: true, pct: 4 },
  linhasReceita: [{
    id: 1, nome: 'Torre A', fase_label: 'lancamento',
    tipologias: [{ id: 11, nome: 'Dois quartos', quantidade: 80, area_privativa_m2: 62, preco_m2: 11_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
      repasse: [{ pct: 30, mesesAposObra: 3 }],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 9_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 28_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
    { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1_400_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
    { id: 5, grupo: 'financeiro', categoria: 'Taxas bancárias', orcamento_valor: 100_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
  ],
  areaTerreno: 4_800,
};

/** Loteamento: lotes e infraestrutura — critério 10 (paridade entre padrões). */
const LOTEAMENTO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
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
    { id: 5, grupo: 'financeiro', categoria: 'Taxas bancárias', orcamento_valor: 80_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
  ],
  areaTerreno: 60_000,
};

/**
 * AS TRÊS NATUREZAS numa fixture só — exigência literal do critério 3. Cada
 * uma exercita um caminho diferente do motor de funding: o financiamento à
 * produção é DIRIGIDO ao caixa (libera conforme exposição e amortiza com o
 * disponível), enquanto dívida e equity são CEGAS ao caixa.
 */
const TRES_OPERACOES: OperacaoFunding[] = [
  {
    tipo: 'financiamento_producao', nome: 'Banco X', valor: 0, inicio_mes: 0,
    taxa_anual: 12, exposicao_minima: 5, percentual_financiavel: 80, custo_linha_ids: [2],
    amortizar_com_caixa_disponivel: true,
  },
  {
    tipo: 'divida', nome: 'Capital de giro', valor: 5_000_000, inicio_mes: 0,
    taxa_anual: 14, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  },
  {
    // `pct_retorno` NÃO é decoração: sem ele o retorno do equity é 0% e a
    // operação não produz linha de SAÍDA nenhuma — a fixture teria as três
    // naturezas só na ponta das entradas, e a identidade fecharia sobre uma
    // série zerada justamente na natureza que o autor mais quer ver.
    tipo: 'equity', nome: 'Investidor', valor: 8_000_000, inicio_mes: 2,
    modo_retorno: 'resultado_final', pct_retorno: 20,
  },
];

function comFunding(cfg: FluxoConfig): { c: FluxoCalc; funding: FundingNoFluxo } {
  const c = calcularFluxo(cfg);
  // `resultadoFinal` real (não 0): é a base do retorno do equity no modo
  // `resultado_final`. Com 0, aquela ponta some e a fixture mente por omissão.
  const resultadoFinal = c.fluxoMensal.reduce((s, v) => s + v, 0);
  const fundingCalc = fundingDoEstudo(
    TRES_OPERACOES, c.fluxoMensal, c.receitaMensal, resultadoFinal, 42, cfg.taxaDescontoAa,
    { custosRaw: c.linhasCusto, linhasCusto: c.linhasCusto, cronograma: cfg.cronograma },
  );
  assert.ok(fundingCalc, 'a fixture precisa produzir funding, senão nada aqui prova nada');
  return { c, funding: fundingCalc!.noFluxo };
}

/**
 * Todos os valores de string de um `TemplateResult`, em ordem de template —
 * é onde os rótulos de linha caem, porque `linhaTabela`/`linhaResultado` os
 * recebem como argumento. Recursivo: a tabela é uma árvore de templates
 * aninhados (blocos condicionais e `.map`).
 */
function textosDoTemplate(no: unknown, saida: string[] = []): string[] {
  if (typeof no === 'string') { saida.push(no); return saida; }
  if (Array.isArray(no)) { for (const x of no) textosDoTemplate(x, saida); return saida; }
  const tr = no as { strings?: readonly string[]; values?: readonly unknown[] };
  if (tr && Array.isArray(tr.values)) for (const v of tr.values) textosDoTemplate(v, saida);
  return saida;
}

/** Índice do rótulo exato dentro dos textos do template; −1 se não aparece. */
function ondeNaTela(c: FluxoCalc, funding: FundingNoFluxo | null, rotulo: string): number {
  const textos = textosDoTemplate(tabelaFluxo(c, 'jan/2027', {}, () => {}, funding));
  return textos.indexOf(rotulo);
}

const PADROES: [string, FluxoConfig][] = [
  ['Incorporação', INCORPORACAO],
  ['Loteamento', LOTEAMENTO],
];

for (const [padrao, cfg] of PADROES) {
  // ───────────────────────────────────────────────────────────────────────
  // Critério 3 / O4 — A IDENTIDADE. É o que segura o PR.
  // ───────────────────────────────────────────────────────────────────────
  test(`#592 (${padrao}) identidade O4: Fluxo de Caixa = Livre + entradas − saídas, mês a mês e no total`, () => {
    const { c, funding } = comFunding(cfg);
    const linhas = linhasFluxo(c, funding);
    const nome = (n: string) => linhas.find((l) => l.nome === n)!;

    // A fixture precisa exercitar as três naturezas de verdade, senão a
    // identidade fecha sobre séries zeradas e o teste não mede nada.
    assert.ok(funding.financiamentoProducao.length > 0, 'financiamento à produção precisa liberar');
    assert.ok(funding.entradas.some((v) => Math.abs(v) > 0.005), 'tem que haver entrada');
    assert.ok(funding.saidas.some((v) => Math.abs(v) > 0.005), 'tem que haver saída');
    assert.equal(funding.linhasEntrada.length, 3, 'as TRÊS naturezas abrem linha de entrada');
    assert.equal(funding.linhasSaida.length, 3, 'as TRÊS naturezas abrem linha de saída');

    const livre = nome('Fluxo de Caixa Livre Mensal');
    const entradas = nome('Funding — Capital (entradas)');
    const saidas = nome('Funding — Serviço (saídas)');
    const caixa = nome('Fluxo de Caixa Mensal');

    let piorMes = 0;
    for (let m = 0; m < c.prazo; m++) {
      const resto = Math.abs((livre.mensal[m] + entradas.mensal[m] - saidas.mensal[m]) - caixa.mensal[m]);
      piorMes = Math.max(piorMes, resto);
      assert.ok(resto <= 0.01, `identidade quebrou no mês ${m}: resíduo R$ ${resto.toFixed(4)}`);
    }
    // A folga tem que ser de ARREDONDAMENTO, não de conta: o motor faz
    // `round2` por mês, então o resíduo mensal é zero ou um centavo perdido.
    assert.ok(piorMes <= 0.01, `pior resíduo mensal: R$ ${piorMes.toFixed(4)}`);

    // E no TOTAL. A tolerância cresce com o prazo porque cada mês pode perder
    // meio centavo no `round2` — declarada em função do prazo, não chutada.
    const restoTotal = Math.abs((livre.total + entradas.total - saidas.total) - caixa.total);
    assert.ok(restoTotal <= 0.005 * c.prazo + 0.01,
      `identidade no total: resíduo R$ ${restoTotal.toFixed(4)} em ${c.prazo} meses`);

    // O acumulado também fecha: último do Livre + Σ entradas − Σ saídas.
    const acumulado = nome('Fluxo de Caixa Acumulado');
    const livreAcum = nome('Fluxo de Caixa Livre Acumulado');
    const restoAcum = Math.abs((livreAcum.total + entradas.total - saidas.total) - acumulado.total);
    assert.ok(restoAcum <= 0.005 * c.prazo + 0.01, `acumulado: resíduo R$ ${restoAcum.toFixed(4)}`);
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 2 — nenhuma linha de funding antes do fecho do Livre
  // ───────────────────────────────────────────────────────────────────────
  test(`#592 (${padrao}) nenhuma linha de funding aparece antes do Fluxo de Caixa Livre`, () => {
    const { c, funding } = comFunding(cfg);
    const linhas = linhasFluxo(c, funding);
    const ordem = linhas.map((l) => l.nome);
    const i = (n: string) => ordem.indexOf(n);

    assert.ok(i('Fluxo de Caixa Livre Mensal') > i('Custo Total'), 'o Livre fecha depois dos custos');
    assert.ok(i('Funding — Capital (entradas)') > i('Fluxo de Caixa Livre Acumulado'),
      'as entradas de funding vêm DEPOIS do fecho do Livre');
    assert.ok(i('Funding — Serviço (saídas)') > i('Funding — Capital (entradas)'));
    assert.ok(i('Fluxo de Caixa Mensal') > i('Funding — Serviço (saídas)'),
      'o Fluxo de Caixa fecha DEPOIS das duas pontas do funding');

    // `Custos Financeiros` volta a valer só o que o usuário classificou ali.
    const financeiro = linhas.find((l) => l.nome === 'Custos Financeiros')!;
    const doUsuario = c.linhasCusto.filter((x) => x.grupo === 'financeiro');
    assert.ok(doUsuario.length > 0, 'a fixture tem linha própria de custo financeiro');
    for (let m = 0; m < c.prazo; m++) {
      const soma = doUsuario.reduce((s, x) => s + x.mensal[m], 0);
      assert.ok(Math.abs(soma - financeiro.mensal[m]) <= 0.01,
        `Custos Financeiros carregou algo que não é do usuário no mês ${m}`);
    }

    // E o Custo Total é o custo do projeto, sem o serviço da dívida.
    assert.deepEqual(linhas.find((l) => l.nome === 'Custo Total')!.mensal, c.custoMensal);
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 6 — tela e exportação publicam as MESMAS linhas, na mesma ordem
  // ───────────────────────────────────────────────────────────────────────
  test(`#592 (${padrao}) tela e exportação publicam as mesmas seções de fecho, na mesma ordem`, () => {
    const { c, funding } = comFunding(cfg);
    const ROTULOS = [
      'Fluxo de Caixa Livre Mensal',
      'Fluxo de Caixa Livre Acumulado',
      'Funding — Capital (entradas)',
      'Funding — Serviço (saídas)',
      'Fluxo de Caixa Mensal',
      'Fluxo de Caixa Acumulado',
    ];

    // Lado da TELA: posição de cada rótulo dentro do template real.
    const naTela = ROTULOS.map((r) => ondeNaTela(c, funding, r));
    naTela.forEach((pos, k) => assert.notEqual(pos, -1, `a TELA não publica "${ROTULOS[k]}"`));
    for (let k = 1; k < naTela.length; k++) {
      assert.ok(naTela[k] > naTela[k - 1],
        `na tela, "${ROTULOS[k]}" tem que vir depois de "${ROTULOS[k - 1]}"`);
    }

    // Lado da EXPORTAÇÃO: mesma sequência, sobre `linhasFluxo`.
    const ordemExport = linhasFluxo(c, funding).map((l) => l.nome);
    const naExportacao = ROTULOS.map((r) => ordemExport.indexOf(r));
    naExportacao.forEach((pos, k) => assert.notEqual(pos, -1, `a EXPORTAÇÃO não publica "${ROTULOS[k]}"`));
    for (let k = 1; k < naExportacao.length; k++) {
      assert.ok(naExportacao[k] > naExportacao[k - 1],
        `na exportação, "${ROTULOS[k]}" tem que vir depois de "${ROTULOS[k - 1]}"`);
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 5 / O6 — os indicadores continuam DESALAVANCADOS
  // ───────────────────────────────────────────────────────────────────────
  test(`#592 (${padrao}) O6: o Livre carrega o VPL desalavancado e os KPIs não se mexem`, () => {
    const { c, funding } = comFunding(cfg);
    const linhas = linhasFluxo(c, funding);
    const nome = (n: string) => linhas.find((l) => l.nome === n)!;

    // A fixture tem de ter efeito de funding no VPL, senão as duas asserções
    // abaixo seriam a mesma e o teste não distinguiria nada.
    assert.ok(Math.abs(funding.vplLiquido) > 0.01, 'o funding precisa mexer no VPL');

    assert.equal(nome('Fluxo de Caixa Livre Mensal').vpl, c.vpl);
    assert.equal(nome('Fluxo de Caixa Livre Acumulado').vpl, c.vpl);
    assert.equal(nome('Fluxo de Caixa Mensal').vpl, c.vpl + funding.vplLiquido);
    assert.equal(nome('Fluxo de Caixa Acumulado').vpl, c.vpl + funding.vplLiquido);

    // Os KPIs (`kpisFluxo`) leem `FluxoCalc`, que o funding não toca: TIR, VPL
    // e Payback são os desalavancados por §8.1. A prova de que esta issue não
    // os realavancou é que o cartão continua publicando os valores de `c`.
    const semFunding = calcularFluxo(cfg);
    assert.equal(semFunding.vpl, c.vpl, 'VPL do motor não depende de funding');
    assert.equal(semFunding.tir, c.tir, 'TIR do motor não depende de funding');
    assert.equal(semFunding.paybackMes, c.paybackMes, 'Payback do motor não depende de funding');
    const textosKpi = textosDoTemplate(kpisFluxo(c));
    assert.ok(textosKpi.length > 0, 'kpisFluxo tem que produzir conteúdo');
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Critério 4 / O5 — estudo SEM funding renderiza como antes
// ─────────────────────────────────────────────────────────────────────────

test('#592 (O5) sem funding: uma seção de fecho só, com os rótulos e o VPL de sempre', () => {
  const c = calcularFluxo(INCORPORACAO);
  const linhas = linhasFluxo(c, null);
  const nomes = linhas.map((l) => l.nome);

  // Decisão declarada do O5: seção única, rotulada `Fluxo de Caixa`. Sem
  // funding, Livre e Fluxo de Caixa são o MESMO número — publicar as duas
  // seria a mesma linha duas vezes.
  assert.ok(nomes.includes('Fluxo de Caixa Mensal'));
  assert.ok(nomes.includes('Fluxo de Caixa Acumulado'));
  assert.equal(nomes.find((n) => n.startsWith('Fluxo de Caixa Livre')), undefined,
    'sem funding não existe seção Livre separada');
  assert.equal(nomes.find((n) => n.startsWith('Funding —')), undefined,
    'sem funding não existe bloco de funding');

  // Os números do fecho são os desalavancados, como sempre foram.
  const mensal = linhas.find((l) => l.nome === 'Fluxo de Caixa Mensal')!;
  assert.deepEqual(mensal.mensal, c.fluxoMensal);
  assert.equal(mensal.vpl, c.vpl);

  // E na TELA idem: o rótulo do Livre não aparece.
  assert.equal(ondeNaTela(c, null, 'Fluxo de Caixa Livre Mensal'), -1);
  assert.notEqual(ondeNaTela(c, null, 'Fluxo de Caixa Mensal'), -1);
});

// ─────────────────────────────────────────────────────────────────────────
// O2 — a chave de colapso é PRESERVADA, e a nova entrou junto
// ─────────────────────────────────────────────────────────────────────────

test('#592 (O2) "recolher/expandir tudo" alcança os dois blocos de funding', () => {
  const { c, funding } = comFunding(INCORPORACAO);
  const chaves = chavesColapso(c, funding);
  assert.ok(chaves.includes('funding-capital'), 'a chave existente é preservada — só mudou de lugar');
  assert.ok(chaves.includes('funding-servico'), 'o bloco novo de saídas também colapsa');
});

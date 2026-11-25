// Os montadores do dossiê (`frontend/dossie-montar.ts`): PARIDADE com as telas e seção por nível.
//
// "Paridade" aqui é medida contra três referências, não contra o próprio montador:
//   1. o objeto calculado que a tela usa (`calcularProforma`, `calcularFluxo`…) passado pelo MESMO
//      formatador que a tela usa;
//   2. as exportações que já existem (`htmlProforma`, `htmlFluxo`), que têm a sua própria paridade
//      com a tela travada em outros testes;
//   3. um cálculo INDEPENDENTE do cenário (refeito aqui com `calcularFluxo(aplicarCenario(…))` e
//      `calcularProforma({ …, sensibilidade })`), para o montador não poder errar o fator e acertar
//      a si mesmo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularProforma, vgvBrutoDeProforma, type ProformaInput } from './proforma.js';
import { calcularFluxo, aplicarCenario, type FluxoConfig } from './fluxo-caixa-motor.js';
import { fundingDoEstudo, receitaLiquidaComCorretagemMensal, indicadoresOperacao, tranchesDeInvestimento, type OperacaoFunding } from './funding-motor.js';
import { mesRepasse, areaPrivativaTotalLinhas } from './fluxo-shared.js';
import { visaoInvestidor } from './visao-investidor.js';
import { indicadoresCenario } from './cenarios-padrao.js';
import { htmlProforma, htmlFluxo } from './exportar.js';
import { htmlDossie, type DadosDossie } from './dossie.js';
import { dossiePreliminar, dossieAvancado, secaoApelo, ROTULO_TIPO_OPERACAO } from './dossie-montar.js';
import { fmtR$, fmtPct, fmtPctOuIndef, fmtNum } from './viab-format.js';

const IMG = '<img src=x onerror=alert(1)>';
const conta = (html: string, re: RegExp) => (html.match(re) ?? []).length;

const kpis = (d: DadosDossie, id: string): Record<string, string> =>
  Object.fromEntries((d.secoes.find((s) => s.id === id)?.kpis ?? []).map((k) => [k.rotulo, k.valor]));
const ids = (d: DadosDossie) => d.secoes.map((s) => s.id);
const tabela = (d: DadosDossie, id: string, titulo?: string) =>
  d.secoes.find((s) => s.id === id)?.tabelas?.find((t) => titulo === undefined || t.titulo === titulo);

// ── Preliminar ──────────────────────────────────────────────────────────

const ESTUDO_PRE = {
  id: 7, nome: 'Torre Aurora', nome_exibicao: 'INC - Torre Aurora - DF - 001', tipo_empreendimento: 'incorporacao',
  status: 'rascunho', uf: 'DF', matricula: '12345', descricao: 'Torre residencial de 80 unidades.',
};
const ENTRADA_PRE: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  produtos: [
    { nome: 'Dois quartos', tipo: 'residencial', area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 } as any,
    { nome: 'Loja', tipo: 'nao_residencial', area_media_m2: 50, preco_venda_m2: 14_000, unidades: 4 } as any,
    { nome: '', area_media_m2: 0, preco_venda_m2: 0, unidades: 0 } as any, // linha em branco de "Adicionar Produto"
  ],
  imposto_percentual: 6, corretagem_percentual: 5,
  considerar_custo_terreno: true, custo_terreno_m2: 500, terreno_manual_area: 3_000,
  custo_construcao_m2: 3_000, construcao_modo: 'm2',
} as any;

const APELO = {
  score_geral: 4.2,
  resultado: {
    fatores: [
      { nome: 'Localização', nota_consolidada: 4.5, justificativa_geral: 'Bem servida.' },
      { nome: 'Demanda', nota_consolidada: 3.9 },
    ],
    relatorio: { vantagens: ['Perto do metrô'], desvantagens: [], ganhos: ['Valorização'], riscos: ['Oferta nova'] },
  },
};

test('Preliminar: os indicadores são os da Proforma, pelos mesmos formatadores', () => {
  const p = calcularProforma(ENTRADA_PRE);
  const d = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: [] });
  const k = kpis(d, 'indicadores');
  assert.equal(k['VGV'], fmtR$(p.vgv));
  assert.equal(k['Receita líquida'], fmtR$(p.receitaLiquida));
  assert.equal(k['Resultado'], fmtR$(p.resultado));
  assert.equal(k['Margem sobre VGV'], fmtPctOuIndef(p.margemLiquidaPct));
  assert.equal(k['Custo obras / VGV'], fmtPctOuIndef(p.custoObrasVgvPct));
  assert.equal(k['ROI'], fmtPctOuIndef(p.roiPct));
  assert.ok(p.vgv > 0 && p.resultado !== 0, 'a fixture precisa ter número a comparar');
});

test('Preliminar: VGV e Margem do dossiê são os do PDF da Proforma (que tem paridade com a tela)', () => {
  const p = calcularProforma(ENTRADA_PRE);
  const pdf = htmlProforma(ESTUDO_PRE, p, false);
  const k = kpis(dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: [] }), 'indicadores');
  assert.ok(pdf.includes(`<div class="r">VGV</div><div class="v">${k['VGV']}</div>`));
  assert.ok(pdf.includes(`<div class="r">Margem sobre VGV</div><div class="v">${k['Margem sobre VGV']}</div>`));
});

test('Preliminar: identificação com terreno, áreas e tipologias — sem a linha em branco do catálogo', () => {
  const p = calcularProforma(ENTRADA_PRE);
  const d = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: [] });
  const k = kpis(d, 'identificacao');
  assert.equal(k['Área do terreno'], `${fmtNum(p.areaTerreno)} m²`);
  assert.equal(k['Área vendável'], `${fmtNum(p.areaVendavel)} m²`);
  assert.equal(k['Área privativa'], `${fmtNum(p.areaPrivativa)} m²`);
  assert.equal(k['Nº de unidades'], fmtNum(p.numUnidades));
  assert.equal(k['UF'], 'DF');
  const t = tabela(d, 'identificacao', 'Tipologias')!;
  assert.deepEqual(t.linhas.map((l) => l[0]), ['Dois quartos', 'Loja']);
  assert.deepEqual(t.linhas.map((l) => l[1]), ['Residencial', 'Não residencial']);
  assert.equal(t.linhas[0][5], fmtR$(100 * 10_000 * 10));
});

test('Preliminar: o cenário de preço refaz Bear/Base/Bull com a variação do benchmark e o fallback de ±10%', () => {
  const cenario = (fator: number) => {
    const p = calcularProforma({ ...ENTRADA_PRE, sensibilidade: { variavel: 'preco', fator } });
    return { p, vgvBruto: vgvBrutoDeProforma(p) };
  };
  const casos: [any[], number, number][] = [
    [[], 10, 10],
    [[{ campo: 'preco', variacao_positiva_pct: 5, variacao_negativa_pct: 20 }], 20, 5],
  ];
  for (const [bms, neg, pos] of casos) {
    const d = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: bms });
    const t = tabela(d, 'cenarios')!;
    assert.deepEqual(t.colunas, ['Indicador', `Bear (−${neg}%)`, 'Base', `Bull (+${pos}%)`]);
    const bear = cenario(1 - neg / 100), base = cenario(1), bull = cenario(1 + pos / 100);
    const res = t.linhas.find((l) => l[0] === 'Resultado')!;
    assert.deepEqual(res.slice(1), [bear.p.resultado, base.p.resultado, bull.p.resultado].map((v) => fmtR$(v)));
    const vgv = t.linhas.find((l) => l[0] === 'VGV')!;
    assert.deepEqual(vgv.slice(1), [bear.vgvBruto, base.vgvBruto, bull.vgvBruto].map((v) => fmtR$(v)));
    const margem = t.linhas.find((l) => l[0] === 'Margem sobre VGV')!;
    assert.deepEqual(margem.slice(1), [bear.p, base.p, bull.p].map((p) => fmtPctOuIndef(p.margemLiquidaPct)));
    assert.ok(bear.p.resultado < base.p.resultado && base.p.resultado < bull.p.resultado, 'o preço move o resultado');
    // O preço não move o custo direto: a linha invariante fica de fora, como a tela a recolhe.
    assert.equal(t.linhas.find((l) => l[0] === 'Custo direto total'), undefined);
  }
});

test('Preliminar: seção sem dado não aparece — sem Apelo, o PDF não traz o título', () => {
  const sem = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: [], apelo: null });
  assert.deepEqual(ids(sem), ['identificacao', 'indicadores', 'cenarios']);
  assert.ok(!htmlDossie(sem).includes('Análise de Mercado do Imóvel'));
  const semResultado = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: [], apelo: { score_geral: 3, resultado: null } });
  assert.deepEqual(ids(semResultado), ['identificacao', 'indicadores', 'cenarios']);
  const com = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: ENTRADA_PRE, benchmarks: [], apelo: APELO });
  assert.deepEqual(ids(com), ['identificacao', 'indicadores', 'cenarios', 'apelo']);
  assert.ok(htmlDossie(com).includes('Análise de Mercado do Imóvel (IA)'));
});

test('Preliminar: sem produto que componha VGV, só a identificação — a tela também não desenha Proforma', () => {
  const d = dossiePreliminar({ estudo: ESTUDO_PRE, entrada: { ...ENTRADA_PRE, produtos: [] }, benchmarks: [] });
  assert.deepEqual(ids(d), ['identificacao']);
});

test('Apelo: score, nota por fator, justificativa e as quatro listas — lista vazia não sai', () => {
  const s = secaoApelo(APELO, 'Apelo')!;
  assert.deepEqual(s.kpis, [
    { rotulo: 'Score geral', valor: '4.2' }, { rotulo: 'Localização', valor: '4.5' }, { rotulo: 'Demanda', valor: '3.9' },
  ]);
  assert.deepEqual(s.paragrafos, ['Localização: Bem servida.']);
  const html = htmlDossie({ nome: 'x', tipo: 'incorporacao', status: 'rascunho', nivel: 'Preliminar', secoes: [s] });
  assert.ok(html.includes('Vantagens') && html.includes('Riscos') && html.includes('Ganhos'));
  assert.ok(!html.includes('Desvantagens'), 'lista sem itens não deixa título solto');
  assert.equal(secaoApelo(null, 'Apelo'), null);
});

// ── Avançado ────────────────────────────────────────────────────────────

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const RECEITAS = [{
  id: 1, nome: 'Grupo Residencial', fase_label: 'Torre A',
  tipologias: [{ id: 11, nome: 'Dois quartos', quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 80 }, { mes: 41, pct: 20 }] },
  fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0, rotulo: 'À vista' }] },
}];
const CUSTOS = [
  { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 2_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
  { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
];
const TIPOLOGIAS = [{ id: 11, nome: 'Dois quartos', dormitorios: 2, vagas: 1, area_privativa_m2: 100, quantidade: 10, preco_m2: 10_000 }];
const FUNDING: OperacaoFunding[] = [
  { id: 1, tipo: 'divida', nome: 'CCB Sênior', valor: 1_000_000, inicio_mes: 6, taxa_anual: 18, periodo_amortizacao_meses: 24, periodo_carencia_meses: 6 },
  { id: 2, tipo: 'equity', nome: 'Sócio investidor', valor: 500_000, inicio_mes: 0, modo_retorno: 'resultado_final', pct_retorno: 25 },
];
const SALVOS = [
  { id: 1, nome: 'Pessimista', preco_venda_pct: -10, custo_obra_pct: 10, velocidade_vendas_pct: -5, ordem: 0 },
  { id: 2, nome: 'Otimista', preco_venda_pct: 10, custo_obra_pct: -10, velocidade_vendas_pct: 5, ordem: 1 },
];
const ESTUDO_AV = { id: 9, nome: 'Torre Aurora', tipo_empreendimento: 'incorporacao', status: 'rascunho', uf: 'DF', terreno_manual_area: 3_000 };

function montarAvancado(operacoes: OperacaoFunding[], extra: Record<string, unknown> = {}, estudo: any = ESTUDO_AV) {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, jurosTabelaAaEstudo: 0, cronograma: CRONO as any,
    linhasReceita: RECEITAS, linhasCusto: CUSTOS, curvas: [], areaTerreno: 3_000,
    ret: { ativo: true, pct: 4 } as any, operacoesFunding: operacoes,
  };
  const calc = calcularFluxo(config);
  const receitaLiquida = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, CUSTOS);
  const fundingCalc = operacoes.length > 0
    ? fundingDoEstudo(operacoes, calc.fluxoMensal, receitaLiquida, calc.fluxoAcumulado.at(-1) ?? 0, mesRepasse(CRONO as any), 12, {
      custosRaw: CUSTOS, linhasCusto: calc.linhasCusto, cronograma: CRONO as any, recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal,
    })
    : null;
  const entrada = {
    estudo, dados: { receitas: RECEITAS, tipologias: TIPOLOGIAS, crono: CRONO as any, dataInicio: 'jan/2027', taxa: 12 },
    calc, config, operacoes, fundingCalc, cenarios: SALVOS, mercado: null, apelo: null, ...extra,
  };
  return { config, calc, fundingCalc, entrada: entrada as any };
}

test('Avançado: os indicadores são os do fluxo do projeto, pelos formatadores da tela', () => {
  const { calc, fundingCalc, entrada } = montarAvancado(FUNDING);
  const k = kpis(dossieAvancado(entrada), 'indicadores');
  const ind = indicadoresCenario(calc);
  assert.equal(k['VGV potencial'], fmtR$(calc.vgvTotal));
  assert.equal(k['Receita Bruta — VGV'], fmtR$(calc.receitaBruta));
  assert.equal(k['Resultado'], fmtR$(calc.fluxoAcumulado.at(-1)!));
  assert.equal(k['Margem de caixa'], fmtPct(ind.margemPct!));
  assert.equal(k['TIR'], `${fmtPct(calc.tir!)} a.a.`);
  assert.equal(k['VPL'], fmtR$(calc.vpl));
  assert.equal(k['Payback'], calc.paybackData);
  assert.ok(k['Exposição máxima (fluxo livre)'].startsWith(fmtR$(Math.abs(calc.exposicaoMaxima))), 'a exposição sai em módulo, como o card da tela');
  assert.equal(k['Juros de clientes'], fmtR$(calc.jurosClientes));
  assert.ok(k['Carteira máxima de clientes'].startsWith(fmtR$(calc.carteiraClientesMaxima)));
  // Visão do investidor — a mesma `visaoInvestidor` do card da tela.
  const v = visaoInvestidor({ funding: fundingCalc, fluxoLivreMensal: calc.fluxoMensal, exposicaoMaxima: calc.exposicaoMaxima, vgvTotal: calc.vgvTotal });
  assert.ok(v.equityMultiple !== null && v.ltvs.length > 0, 'a fixture precisa ter equity e dívida');
  assert.equal(k['Equity Multiple'], `${fmtNum(v.equityMultiple!, 2)}×`);
  assert.equal(k['LTV — CCB Sênior (Dívida)'], fmtPct(v.ltvs[0].ltvPct!));
});

test('Avançado: TIR, VPL e Payback do dossiê são os do PDF do Fluxo de Caixa', () => {
  const { calc, entrada } = montarAvancado(FUNDING);
  const pdf = htmlFluxo(ESTUDO_AV, calc, 'jan/2027');
  const k = kpis(dossieAvancado(entrada), 'indicadores');
  for (const [rotuloPdf, valor] of [['TIR', k['TIR']], ['VPL', k['VPL']], ['Payback', k['Payback']], ['Juros de Clientes', k['Juros de clientes']], ['Receita Bruta — VGV', k['Receita Bruta — VGV']]]) {
    assert.ok(pdf.includes(`<div class="r">${rotuloPdf}</div><div class="v">${valor}</div>`), `${rotuloPdf} difere do PDF do fluxo`);
  }
});

test('Avançado: cada cenário salvo é recalculado como a aba Cenários o faz (cálculo independente)', () => {
  const { config, calc, entrada } = montarAvancado(FUNDING);
  const t = tabela(dossieAvancado(entrada), 'cenarios')!;
  assert.deepEqual(t.linhas.map((l) => l[0]), ['Cenário real', 'Pessimista', 'Otimista']);
  for (const [i, c] of [[1, SALVOS[0]], [2, SALVOS[1]]] as const) {
    const cc = calcularFluxo(aplicarCenario(config, {
      precoVendaPct: c.preco_venda_pct, custoObraPct: c.custo_obra_pct, velocidadeVendasPct: c.velocidade_vendas_pct,
    }));
    const ind = indicadoresCenario(cc);
    const l = t.linhas[i];
    assert.deepEqual(l.slice(1, 4), [`${c.preco_venda_pct > 0 ? '+' : ''}${c.preco_venda_pct}%`, `${c.custo_obra_pct > 0 ? '+' : ''}${c.custo_obra_pct}%`, `${c.velocidade_vendas_pct > 0 ? '+' : ''}${c.velocidade_vendas_pct}%`]);
    assert.equal(l[4], fmtR$(ind.vgv));
    assert.equal(l[5], fmtR$(ind.resultado));
    assert.equal(l[7], fmtR$(cc.vpl));
    assert.equal(l[10], fmtR$(Math.abs(cc.exposicaoMaxima)));
  }
  assert.equal(t.linhas[0][5], fmtR$(indicadoresCenario(calc).resultado));
  assert.notEqual(t.linhas[1][5], t.linhas[2][5], 'os dois cenários precisam diferir');
});

test('Avançado: a estrutura de funding traz as operações e o retorno por parte da tela', () => {
  const { calc, fundingCalc, entrada } = montarAvancado(FUNDING);
  const d = dossieAvancado(entrada);
  const ops = tabela(d, 'funding', 'Operações')!;
  assert.deepEqual(ops.linhas.map((l) => [l[0], l[1]]), [['CCB Sênior', 'Dívida'], ['Sócio investidor', 'Equity']]);
  assert.equal(ops.linhas[0][2], fmtR$(1_000_000));
  const partes = tabela(d, 'funding', 'Retorno por parte')!;
  const tranches = tranchesDeInvestimento(fundingCalc);
  assert.equal(partes.linhas.length, 1 + tranches.length);
  tranches.forEach((s, i) => {
    const ind = indicadoresOperacao(s, 12);
    assert.equal(partes.linhas[i + 1][1], fmtR$(ind.investimentoTotal));
    assert.equal(partes.linhas[i + 1][2], fmtR$(ind.retornoTotal));
    assert.equal(partes.linhas[i + 1][6], fmtR$(ind.vpl));
  });
  const fx = tabela(d, 'funding', 'Fluxo de Caixa Livre × Fluxo de Caixa')!;
  assert.equal(fx.linhas[0][1], fmtR$(calc.fluxoMensal.reduce((s, v) => s + v, 0)));
  assert.equal(fx.linhas[2][1], fmtR$(fundingCalc!.noFluxo.fluxoMensal.reduce((s, v) => s + v, 0)));
});

const ANALISE = {
  localidade: 'Brasília/DF', abrangencia: 'uf', data_referencia: '2026-10', preco_medio_m2: 9_500, vso_pct: 4, selic_pct: 14.5,
  resultado: {
    limitacoes: 'Poucos anúncios.',
    indicadores: {
      preco_medio_m2: { origem: 'Portal X', confianca: 'media', observacao: 'Preço acima da mediana.' },
      vso_pct: { origem: '', confianca: 'alta', observacao: 'sem origem, não entra' },
      selic_pct: { origem: 'Banco Central', confianca: 'alta', observacao: '' },
    },
  },
};

test('Avançado: mercado só com dado de procedência, e a comparação é a da tela', () => {
  const { entrada } = montarAvancado(FUNDING, { mercado: { analise: ANALISE, regiao: null } });
  const d = dossieAvancado(entrada);
  const t = tabela(d, 'mercado', 'Projeto × mercado')!;
  assert.deepEqual(t.linhas.map((l) => l[0]), ['Preço de venda (R$/m²)'], 'vso sem origem é tratado como ausente');
  assert.equal(t.linhas[0][1], fmtR$(10_000));
  assert.equal(t.linhas[0][2], fmtR$(9_500));
  assert.ok(t.linhas[0][3].includes('acima do mercado'), t.linhas[0][3]);
  assert.equal(tabela(d, 'mercado', 'Indicadores macro')!.linhas[0][1], fmtPct(14.5));
  const html = htmlDossie(d);
  assert.ok(html.includes('limitada a estado (UF)') && html.includes('Poucos anúncios.') && html.includes('não é recomendação de investimento'));
  assert.ok(!html.includes('sem origem, não entra'));
});

test('Avançado: sem análise de mercado, ou sem nenhum indicador com origem, a seção não existe', () => {
  const semAnalise = dossieAvancado(montarAvancado(FUNDING, { mercado: { analise: null, regiao: null } }).entrada);
  assert.ok(!ids(semAnalise).includes('mercado'));
  const semOrigem = dossieAvancado(montarAvancado(FUNDING, {
    mercado: { analise: { preco_medio_m2: 9_500, resultado: { indicadores: {} } }, regiao: null },
  }).entrada);
  assert.ok(!ids(semOrigem).includes('mercado'));
});

test('Avançado: com tudo, as seis seções saem na ordem do pedido', () => {
  const { entrada } = montarAvancado(FUNDING, { mercado: { analise: ANALISE, regiao: null }, apelo: APELO });
  const d = dossieAvancado(entrada);
  assert.deepEqual(ids(d), ['identificacao', 'indicadores', 'cenarios', 'funding', 'mercado', 'apelo']);
  assert.equal(d.nivel, 'Avançado');
});

test('Avançado: sem funding, cenários salvos, mercado nem Apelo — só identificação e indicadores, e nada de linha vazia', () => {
  const { entrada } = montarAvancado([], { cenarios: [] });
  const d = dossieAvancado(entrada);
  assert.deepEqual(ids(d), ['identificacao', 'indicadores']);
  const k = kpis(d, 'indicadores');
  assert.equal(k['Equity Multiple'], undefined, 'sem equity, a visão do investidor não inventa linha');
  assert.ok(!Object.keys(k).some((r) => r.startsWith('LTV')));
  const html = htmlDossie(d);
  for (const t of ['Cenários', 'Estrutura de funding', 'Análise de mercado', 'Apelo Comercial']) assert.ok(!html.includes(t), `"${t}" saiu sem dado`);
});

test('Avançado: a identificação traz terreno, área privativa e a tipologia do catálogo', () => {
  const { entrada } = montarAvancado(FUNDING);
  const d = dossieAvancado(entrada);
  const k = kpis(d, 'identificacao');
  assert.equal(k['Área do terreno'], `${fmtNum(3_000)} m²`);
  assert.equal(k['Área privativa nas receitas'], `${fmtNum(areaPrivativaTotalLinhas(RECEITAS))} m²`);
  assert.equal(k['Unidades nas receitas'], '10');
  assert.deepEqual(tabela(d, 'identificacao', 'Catálogo de tipologias')!.linhas[0], ['Dois quartos', '2', '1', fmtNum(100, 2), '10', fmtR$(10_000)]);
});

test('Avançado: catálogo maior que as receitas — cada bloco diz a sua base, e os números não se confundem', () => {
  const { entrada } = montarAvancado(FUNDING);
  // 10 unidades alocadas às receitas; o catálogo tem 25 (15 ainda sem linha de receita).
  entrada.dados = { ...entrada.dados, tipologias: [{ ...TIPOLOGIAS[0], quantidade: 25 }] };
  const d = dossieAvancado(entrada);
  const k = kpis(d, 'identificacao');
  assert.equal(k['Unidades nas receitas'], '10', 'o KPI soma as linhas de receita, não o catálogo');
  assert.equal(k['Nº de unidades'], undefined, 'rótulo sem base não pode voltar');
  const t = tabela(d, 'identificacao', 'Catálogo de tipologias')!;
  assert.ok(t.colunas.includes('Unidades no catálogo'));
  assert.equal(t.linhas[0][4], '25');
});

test('Escape de ponta a ponta: nome do estudo, do cenário, da tipologia, da operação, de mercado e do Apelo', () => {
  const hostil = { ...ESTUDO_AV, nome: IMG, nome_exibicao: IMG, descricao: IMG };
  const { entrada } = montarAvancado(
    [{ ...FUNDING[0], nome: IMG }, FUNDING[1]],
    {
      cenarios: [{ ...SALVOS[0], nome: IMG }],
      mercado: { analise: { ...ANALISE, localidade: IMG, resultado: { ...ANALISE.resultado, limitacoes: IMG, indicadores: { ...ANALISE.resultado.indicadores, preco_medio_m2: { origem: IMG, confianca: 'alta', observacao: IMG } } } }, regiao: null },
      apelo: { score_geral: IMG, resultado: { fatores: [{ nome: IMG, nota_consolidada: IMG, justificativa_geral: IMG }], relatorio: { vantagens: [IMG], desvantagens: [IMG], ganhos: [IMG], riscos: [IMG] } } },
    },
    hostil,
  );
  entrada.dados = { ...entrada.dados, tipologias: [{ ...TIPOLOGIAS[0], nome: IMG }] };
  const html = htmlDossie(dossieAvancado(entrada));
  assert.equal(conta(html, /<img\b/gi), 0, 'tag <img> vinda de dado');
  assert.ok(conta(html, /&lt;img src=x onerror=alert\(1\)&gt;/g) >= 12, 'o texto aparece, escapado, em cada ponto de interpolação');

  const pre = htmlDossie(dossiePreliminar({
    estudo: { ...ESTUDO_PRE, nome: IMG, nome_exibicao: IMG, descricao: IMG, uf: IMG },
    entrada: { ...ENTRADA_PRE, produtos: [{ ...(ENTRADA_PRE.produtos as any[])[0], nome: IMG }] }, benchmarks: [], apelo: { ...APELO, score_geral: IMG },
  }));
  assert.equal(conta(pre, /<img\b/gi), 0);
});

test('ROTULO_TIPO_OPERACAO: os rótulos são os da tela (seletor de Funding e card de retorno por parte)', () => {
  const funding = readFileSync(new URL('./tela-funding.ts', import.meta.url), 'utf8');
  for (const valor of ['financiamento_producao', 'equity', 'antecipacao_recebiveis']) {
    assert.ok(funding.includes(`{ valor: '${valor}', rotulo: '${ROTULO_TIPO_OPERACAO[valor]}'`), `${valor} difere de tela-funding.ts`);
  }
  // `divida` é "Dívida / Capital de giro" no seletor e "Dívida" nos cards de resultado — o dossiê usa o dos cards.
  const fluxo = readFileSync(new URL('./tela-fluxo-ver.ts', import.meta.url), 'utf8');
  assert.equal(ROTULO_TIPO_OPERACAO.divida, 'Dívida');
  assert.ok(fluxo.includes("eDivida(s.operacao.tipo) ? 'Dívida' : 'Equity'"));
});

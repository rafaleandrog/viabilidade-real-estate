// #594 — ROI geral do projeto + abertura por parte (incorporador e cada tranche
// de dívida/equity) na aba Resultados → Análise Financeira.
//
// ⚠️ O QUE ESTE ARQUIVO PROVA, E O QUE ELE NÃO CONSEGUE PROVAR.
//
// Ele cobre a MATEMÁTICA e a SELEÇÃO: que o ROI exibido é o mesmo número da
// coluna ROI do Painel de estudos, que o financiamento à produção fica de fora
// da abertura, e que operação criada e não configurada não produz NaN nem
// Infinity. Ele NÃO prova que a tela chama alguma dessas coisas — teste de
// função pura nunca prova fiação, e essa é a classe de defeito nº 1 do
// `CLAUDE.md` (sete PRs da Rodada 9 tiveram o bloqueante aí, nenhum no
// cálculo). Quem prova a fiação é `frontend/render/retorno-por-parte.render.test.ts`,
// que monta a aba em Chromium e EXIGE as linhas na tela; apagar
// `_renderRetornoPorParte` da `_renderAnaliseFinanceira` deixa esta suíte
// inteira verde e derruba aquela.
//
// A única exceção é o teste de leitura de fonte no fim: ele existe porque
// "nenhuma fórmula nova nasce nesta tela" (critério de aceite 4) é uma
// propriedade do TEXTO do componente, não do valor que ele devolve.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { areaPrivativaTotalLinhas, type EventoCrono } from './fluxo-shared.js';
import { proformaAvancado } from './proforma-avancado.js';
import {
  fundingDoEstudo, indicadoresOperacao, tranchesDeInvestimento,
  type FundingCalc, type OperacaoFunding,
} from './funding-motor.js';
import { roiProjetoAnalise, ViabFluxoVer } from './tela-fluxo-ver.js';

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 13, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 37, duracao_meses: 12 },
];

const PAGAMENTO = {
  entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
  parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
  repasse: [{ pct: 30, mesesAposObra: 3 }],
};

/**
 * Critério de aceite 9 (paridade Avançado): a aba Análise Financeira e a tela
 * de Funding são as MESMAS nos dois padrões — `tela-fluxo-ver.ts` não ramifica
 * por `tipo_empreendimento` em lugar nenhum, e o teste de fonte no fim deste
 * arquivo trava isso. Estes dois estudos existem para o exercício ser real
 * mesmo assim: a Incorporação vende unidades de uma torre, o Loteamento vende
 * lotes, e as duas passam pela mesma cadeia motor → funding → abertura.
 */
const RECEITAS_INCORPORACAO = [{
  id: 1, nome: 'Torre A', fase_label: 'lancamento',
  tipologias: [{ id: 1, quantidade: 80, area_privativa_m2: 62, preco_m2: 11_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: PAGAMENTO,
}];

const RECEITAS_LOTEAMENTO = [{
  id: 1, nome: 'Quadra A', fase_label: 'lancamento',
  tipologias: [{ id: 1, quantidade: 130, area_privativa_m2: 300, preco_m2: 1_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: PAGAMENTO,
}];

const CUSTOS = [
  { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 9_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
  { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 20_000_000, orcamento_unidade: 'rs', inicio_mes: 13, duracao_meses: 24 },
  { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1_400_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
];

function fluxo(receitas: any[], operacoes: OperacaoFunding[] = []): FluxoCalc {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027',
    taxaDescontoAa: 12,
    cronograma: CRONO,
    linhasReceita: receitas,
    linhasCusto: CUSTOS,
    curvas: [],
    areaTerreno: 40_000,
    ret: { ativo: true, pct: 4 },
    operacoesFunding: operacoes,
  };
  return calcularFluxo(config);
}

function funding(c: FluxoCalc, operacoes: OperacaoFunding[]): FundingCalc | null {
  const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
  return fundingDoEstudo(
    operacoes, c.fluxoMensal, new Array(c.prazo).fill(0), resultadoFinal, 40, 12,
    { custosRaw: CUSTOS, linhasCusto: c.linhasCusto, cronograma: CRONO },
  );
}

/** FàP + dívida + equity — o estudo do critério de aceite 3. */
const TRES_OPERACOES: OperacaoFunding[] = [
  {
    id: 1, tipo: 'financiamento_producao', nome: 'FàP Banco X', valor: 0, inicio_mes: 0,
    taxa_anual: 11, exposicao_minima: 20, percentual_financiavel: 80,
  },
  {
    id: 2, tipo: 'divida', nome: 'CCB Sênior', valor: 5_000_000, inicio_mes: 0,
    taxa_anual: 18, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  },
  {
    id: 3, tipo: 'equity', nome: 'Sócio investidor', valor: 3_000_000, inicio_mes: 0,
    modo_retorno: 'resultado_final', pct_retorno: 25,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Critério 1 — o ROI da Análise Financeira é o MESMO da coluna do Painel
// ─────────────────────────────────────────────────────────────────────────────

for (const [padrao, receitas] of [
  ['Incorporação', RECEITAS_INCORPORACAO],
  ['Loteamento', RECEITAS_LOTEAMENTO],
] as const) {
  test(`#594 critério 1 (${padrao}): o ROI da Análise Financeira é numericamente idêntico ao do Painel de estudos`, () => {
    const c = fluxo(receitas);
    const area = areaPrivativaTotalLinhas(receitas);

    // O caminho do PAINEL DE ESTUDOS, transcrito de `tela-dashboard.ts`
    // (`_calcularUmAvancado`: `proformaAvancado(c, area)` → `p.roiPct`, guardado
    // em `calculosAvancado[id].roiPct` e publicado pela coluna `roi`).
    const roiPainel = proformaAvancado(c, area).roiPct;
    // O caminho da ANÁLISE FINANCEIRA.
    const roiAnalise = roiProjetoAnalise(c, area);

    assert.equal(roiAnalise, roiPainel);
    // Sem esta linha o teste passaria com os dois em zero — e zero é
    // exatamente o valor que um ROI quebrado produziria nos dois lados.
    assert.ok(Math.abs(roiPainel) > 1, `ROI degenerado (${roiPainel}): o estudo do teste não exercita o denominador`);
  });
}

test('#594 critério 1: sem investimento não há ROI — nem NaN, nem Infinity, nem zero inventado', () => {
  // Estudo com receita e SEM nenhuma linha de custo direto/indireto:
  // `investimentoTotal` = 0, o denominador não existe.
  const c = calcularFluxo({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: RECEITAS_INCORPORACAO, linhasCusto: [], curvas: [],
    areaTerreno: 40_000, ret: { ativo: false, pct: 0 },
  });
  const p = proformaAvancado(c, areaPrivativaTotalLinhas(RECEITAS_INCORPORACAO));
  assert.equal(p.investimentoTotal, 0);
  const roi = roiProjetoAnalise(c, areaPrivativaTotalLinhas(RECEITAS_INCORPORACAO));
  assert.ok(Number.isFinite(roi), 'o ROI virou NaN/Infinity sem denominador');
  // A tela NÃO publica este 0: `_renderRoiProjeto` troca por "—" quando
  // `investimentoTotal <= 0` (critério de aceite 5).
  assert.equal(roi, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Critérios 2, 3 e 9 — a abertura por parte, e quem NÃO é parte
// ─────────────────────────────────────────────────────────────────────────────

for (const [padrao, receitas] of [
  ['Incorporação', RECEITAS_INCORPORACAO],
  ['Loteamento', RECEITAS_LOTEAMENTO],
] as const) {
  test(`#594 critério 3 (${padrao}): FàP + dívida + equity abrem DUAS tranches, não três`, () => {
    const c = fluxo(receitas, TRES_OPERACOES);
    const f = funding(c, TRES_OPERACOES);
    assert.ok(f, 'o motor de funding devolveu null com três operações');
    assert.equal(f!.operacoes.length, 3, 'o motor deixou de simular as três operações');

    const tranches = tranchesDeInvestimento(f);
    assert.equal(tranches.length, 2, `esperava 2 tranches, veio ${tranches.length}`);
    assert.deepEqual(tranches.map((s) => s.operacao.tipo), ['divida', 'equity']);
    assert.deepEqual(tranches.map((s) => s.operacao.nome), ['CCB Sênior', 'Sócio investidor']);
    assert.ok(
      !tranches.some((s) => s.operacao.tipo === 'financiamento_producao'),
      'o financiamento à produção entrou na abertura por parte',
    );
  });

  test(`#594 critério 2 (${padrao}): cada tranche traz os indicadores de indicadoresOperacao, sem número inventado`, () => {
    const c = fluxo(receitas, TRES_OPERACOES);
    const f = funding(c, TRES_OPERACOES);
    for (const s of tranchesDeInvestimento(f)) {
      const ind = indicadoresOperacao(s, 12);
      for (const [campo, valor] of Object.entries(ind)) {
        if (valor === null) continue; // `tirMensal`/`tirAnual`/`paybackMes` podem não existir
        assert.ok(
          Number.isFinite(valor as number),
          `${s.operacao.nome}: ${campo} saiu ${valor} — NaN/Infinity chega à tela como célula quebrada`,
        );
      }
      assert.ok(ind.investimentoTotal < 0, `${s.operacao.nome}: investimento não é negativo`);
      assert.ok(ind.retornoTotal > 0, `${s.operacao.nome}: retorno total zerado`);
      // MOIC e ROI diferem de exatamente 1 — a tela rotula MOIC, e é por isto
      // que o rótulo importa (critério de aceite 5).
      assert.ok(Math.abs(ind.moic - (1 + ind.lucro / -ind.investimentoTotal)) < 1e-9);
    }
  });
}

test('#594 critério 3: um estudo SÓ com financiamento à produção não abre nenhuma tranche', () => {
  const so_fap = [TRES_OPERACOES[0]];
  const c = fluxo(RECEITAS_INCORPORACAO, so_fap);
  const f = funding(c, so_fap);
  assert.ok(f, 'o motor devolveu null com uma operação');
  assert.equal(f!.operacoes.length, 1);
  assert.equal(tranchesDeInvestimento(f).length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Critério 7 — estudo sem funding e operação criada e não configurada
// ─────────────────────────────────────────────────────────────────────────────

test('#594 critério 7: sem funding a abertura não tem tranche nenhuma (e não estoura)', () => {
  assert.deepEqual(tranchesDeInvestimento(null), []);
  assert.deepEqual(tranchesDeInvestimento(undefined), []);
  // Estudo real, sem operação: `fundingDoEstudo` devolve `null` por contrato.
  const c = fluxo(RECEITAS_INCORPORACAO, []);
  assert.equal(funding(c, []), null);
  assert.deepEqual(tranchesDeInvestimento(funding(c, [])), []);
});

test('#594 critério 7: operação criada e NÃO configurada (valor 0) não gera NaN nem divisão por zero', () => {
  const zerada: OperacaoFunding[] = [
    { id: 9, tipo: 'divida', nome: 'Dívida em branco', valor: 0, inicio_mes: 0 },
    { id: 10, tipo: 'equity', nome: 'Equity em branco', valor: 0, inicio_mes: 0 },
  ];
  const c = fluxo(RECEITAS_INCORPORACAO, zerada);
  const tranches = tranchesDeInvestimento(funding(c, zerada));
  assert.equal(tranches.length, 2);
  for (const s of tranches) {
    const ind = indicadoresOperacao(s, 12);
    // ⚠️ `assert.ok(x === 0)` e não `assert.equal(x, 0)`: `investimentoTotal` é
    // `-round2(Σ entradas)`, e sem aporte isso é **-0**, que `assert.equal`
    // (Object.is) reprova contra `0`. O detalhe não é acadêmico — a tela
    // decide exibir "—" com `ind.investimentoTotal < 0`, e `-0 < 0` é FALSO,
    // que é justamente o desfecho certo aqui (não houve investimento).
    assert.ok(ind.investimentoTotal === 0, `${s.operacao.nome}: sem aporte o investimento tem de ser 0, veio ${ind.investimentoTotal}`);
    assert.ok(!(ind.investimentoTotal < 0), `${s.operacao.nome}: -0 passou por "houve investimento" e a tela publicaria MOIC 0,00×`);
    // `moic` devolve 0 quando `aportes <= 0` — nunca Infinity. A tela troca
    // esse 0 por "—", porque "0,00×" afirmaria que o investidor perdeu tudo.
    assert.equal(ind.moic, 0);
    for (const [campo, valor] of Object.entries(ind)) {
      if (valor === null) continue;
      assert.ok(Number.isFinite(valor as number), `${s.operacao.nome}: ${campo} = ${valor}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Critérios 4, 5 e 9 — propriedades do TEXTO do componente
// ─────────────────────────────────────────────────────────────────────────────

const TELA = readFileSync(new URL('./tela-fluxo-ver.ts', import.meta.url), 'utf8');
// Contar substring crua deixaria um comentário citando o símbolo compensar a
// remoção da chamada real — a mesma armadilha que `kpi-casas-decimais.test.ts`
// documenta. Comentário fora, então, antes de contar.
const semComentarios = TELA
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

test('#594 critério 4: a Análise Financeira NÃO recalcula os indicadores por tranche', () => {
  assert.ok(
    semComentarios.includes('indicadoresOperacao(s, taxa)'),
    'a tela parou de ler `indicadoresOperacao` — os indicadores por tranche passaram a ter uma segunda fonte de verdade',
  );
  assert.ok(
    semComentarios.includes('tranchesDeInvestimento(fundingProjeto)'),
    'a tela parou de filtrar as operações por `tranchesDeInvestimento` — o financiamento à produção volta à abertura',
  );
  // Nenhuma aritmética de indicador de investidor no arquivo: TIR, MOIC e VPL
  // são de `funding-motor.ts`, e a tela só formata.
  for (const proibido of [/\bmoic\s*\(/, /\btirAnual\s*\(/, /\btirMensal\s*\(/, /\bvplFluxo\s*\(/]) {
    assert.ok(
      !proibido.test(semComentarios),
      `\`tela-fluxo-ver.ts\` passou a chamar ${proibido} — indicador de investidor é de funding-motor.ts`,
    );
  }
});

test('#594 critério 1: o ROI da tela sai de `roiProjetoAnalise`, e não de uma divisão local', () => {
  assert.ok(semComentarios.includes('roiProjetoAnalise(cProjeto, area)'), 'a tela parou de chamar `roiProjetoAnalise`');
  // `investimentoTotal` só pode aparecer como LEITURA (`p.investimentoTotal`),
  // nunca como denominador de uma conta escrita aqui.
  assert.ok(
    !/\/\s*[\w.]*investimentoTotal/.test(semComentarios),
    '`tela-fluxo-ver.ts` passou a dividir por `investimentoTotal` — é o segundo ROI que a #443 proíbe',
  );
});

test('#594 critério 5: a tela rotula MOIC como MOIC, e diz por que o incorporador sai sem ROI', () => {
  assert.ok(semComentarios.includes('>MOIC<'), 'o cabeçalho da coluna MOIC sumiu');
  assert.ok(!/>\s*ROI\s*<\/th>/.test(semComentarios), 'uma coluna de MOIC foi rotulada "ROI"');
  assert.ok(
    /não modela o capital próprio/.test(TELA),
    'a tela deixou de explicar por que o incorporador sai sem ROI — "—" sem explicação é o que o critério 5 proíbe',
  );
});

test('#594 critério 9: a Análise Financeira não ramifica por padrão (Loteamento × Incorporação)', () => {
  assert.ok(
    !semComentarios.includes('tipo_empreendimento'),
    '`tela-fluxo-ver.ts` passou a ramificar por `tipo_empreendimento` — a aba deixaria de ser a mesma nos dois padrões',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Achado P1 do App de revisão (PR 650) — o filtro de fase NÃO move o projeto
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ O defeito que estes testes barram é o mais caro deste PR, e ele não estava
// no cálculo nem na fiação: estava na ESCOLHA DO INSUMO. `_recalcular` recorta
// as linhas de RECEITA pela fase selecionada e mantém TODOS os custos — o que é
// correto para a tabela e os gráficos, que mostram a fase, e é ruína para um
// card que se anuncia como "do projeto". Com uma fase selecionada, o ROI da
// Análise Financeira deixaria de bater com a coluna do Painel de estudos
// (critério de aceite 1) e as tranches mudariam de valor porque alguém mexeu
// num controle de EXIBIÇÃO.
//
// Estes testes chamam `_recalcular()` na classe REAL — o mesmo método privado
// que `_carregar()` e o seletor de fase disparam —, no molde de
// `frontend/carregamento-corrida.test.ts`: `LitElement` se instancia em Node
// sem `customElements` nem `document` porque `_recalcular` não toca o DOM (só
// lê `this.dados` e escreve `@state()`).

const RECEITAS_DUAS_FASES = [
  { ...RECEITAS_INCORPORACAO[0], id: 1, nome: 'Torre A', fase_label: 'lancamento' },
  {
    id: 2, nome: 'Torre B', fase_label: 'fase 2',
    tipologias: [{ id: 2, quantidade: 60, area_privativa_m2: 70, preco_m2: 12_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: PAGAMENTO,
  },
];

function telaComDuasFases(faseFiltro: string) {
  const el: any = new ViabFluxoVer();
  el.estudo = { id: 1, nivel_analise: 'avancado' };
  el.operacoes = TRES_OPERACOES;
  el.faseFiltro = faseFiltro;
  el.dados = {
    receitas: RECEITAS_DUAS_FASES, custos: CUSTOS, curvas: [], tipologias: [],
    crono: CRONO, dataInicio: 'jan/2027', taxa: 12, ret: { ativo: true, pct: 4 },
  };
  el._recalcular();
  return el;
}

test('#594 P1: o filtro de fase move `calc`, e NÃO move `calcProjeto`', () => {
  const semFiltro = telaComDuasFases('');
  const comFiltro = telaComDuasFases('lancamento');

  const area = areaPrivativaTotalLinhas(RECEITAS_DUAS_FASES);
  const roiPainel = proformaAvancado(semFiltro.calcProjeto, area).roiPct;

  // O filtro precisa MESMO mudar a exibição, senão o teste não exercita nada.
  assert.notEqual(
    roiProjetoAnalise(comFiltro.calc, area), roiProjetoAnalise(semFiltro.calc, area),
    'o filtro de fase não mudou `calc` — a fixture não exercita o defeito',
  );

  // …e não pode mudar o insumo dos cards do projeto.
  assert.equal(roiProjetoAnalise(comFiltro.calcProjeto, area), roiPainel);
  assert.equal(roiProjetoAnalise(semFiltro.calcProjeto, area), roiPainel);
});

test('#594 P1: o filtro de fase não move as tranches nem o resíduo do incorporador', () => {
  const semFiltro = telaComDuasFases('');
  const comFiltro = telaComDuasFases('lancamento');

  const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
  const residuo = (el: any) => soma(el.fundingCalcProjeto.noFluxo.fluxoMensal);
  const perfil = (el: any) => tranchesDeInvestimento(el.fundingCalcProjeto)
    .map((s) => JSON.stringify(indicadoresOperacao(s, 12)));

  // Controle: o par de EXIBIÇÃO muda mesmo — é o que torna o defeito possível.
  assert.notEqual(
    soma(comFiltro.fundingCalc.noFluxo.fluxoMensal),
    soma(semFiltro.fundingCalc.noFluxo.fluxoMensal),
    'o filtro não mudou `fundingCalc` — a fixture não exercita o defeito',
  );

  assert.equal(residuo(comFiltro), residuo(semFiltro));
  assert.deepEqual(perfil(comFiltro), perfil(semFiltro));
  assert.equal(perfil(semFiltro).length, 2, 'a fixture perdeu as duas tranches');
});

test('#594 P1: sem filtro, o par do projeto é o MESMO objeto do par de exibição', () => {
  // Identidade referencial, e não igualdade de valor: prova que o caminho comum
  // não paga um segundo `calcularFluxo`. Se alguém trocar por uma cópia, o
  // custo dobra em toda tela de Resultados sem nada ficar vermelho — por isso a
  // asserção é de identidade.
  const el = telaComDuasFases('');
  assert.equal(el.calcProjeto, el.calc);
  assert.equal(el.fundingCalcProjeto, el.fundingCalc);
});

test('#594 P1: a Análise Financeira lê `calcProjeto`/`fundingCalcProjeto`, não os filtrados', () => {
  assert.ok(
    semComentarios.includes('this._renderRoiProjeto(this.calcProjeto ?? c)'),
    'o card de ROI voltou a receber o `FluxoCalc` filtrado pela fase',
  );
  assert.ok(
    semComentarios.includes('const fundingProjeto = this.fundingCalcProjeto;'),
    'a abertura por parte voltou a ler `fundingCalc` (filtrado) em vez de `fundingCalcProjeto`',
  );
  assert.ok(
    semComentarios.includes('tranchesDeInvestimento(fundingProjeto)'),
    'as tranches deixaram de sair do funding do projeto inteiro',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Achado P1 da rodada 2 — o DEFLATOR de área aberta faltava no Painel
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ O segundo P1 do App de revisão, e ele é do mesmo gênero do primeiro: a
// fórmula estava certa nos dois lados, o INSUMO é que divergia. `_configFluxo`
// (`tela-fluxo-ver.ts`) passava `deflatorAreaAbertaPct` (#462); o caminho do
// Painel (`tela-dashboard.ts`, `_calcularUmAvancado`) NÃO passava. Num estudo
// com deflator diferente de zero e produto de área privativa aberta, os dois
// ROIs divergiam — e o critério de aceite 1 desta issue é justamente que eles
// sejam idênticos.
//
// O conserto é do lado do Painel, porque ele é que estava errado: a listagem
// mostrava VGV/Resultado/Margem/ROI sobre o preço CHEIO da área aberta enquanto
// a sub-aba Proforma do MESMO estudo mostrava o deflacionado.

const RECEITA_AREA_ABERTA = [{
  id: 1, nome: 'Torre com varanda', fase_label: 'lancamento',
  tipologias: [{
    id: 1, quantidade: 80, area_privativa_m2: 62, preco_m2: 11_000,
    area_privativa_aberta_m2: 18,
  }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: PAGAMENTO,
}];

/**
 * O `FluxoConfig` do caminho do PAINEL DE ESTUDOS, transcrito de
 * `tela-dashboard.ts` (`_calcularUmAvancado`). Se aquele arquivo passar a
 * montar o config de outro jeito, este teste deixa de descrever a realidade —
 * por isso o teste de fonte logo abaixo trava o campo que o defeito perdeu.
 */
function configDoPainel(receitas: any[], estudo: any): FluxoConfig {
  return {
    dataInicio: 'jan/2027',
    taxaDescontoAa: 12,
    cronograma: CRONO,
    linhasReceita: receitas,
    linhasCusto: CUSTOS,
    curvas: [],
    areaTerreno: Number(estudo?.terreno_manual_area) || 0,
    ret: { ativo: true, pct: 4 },
    corretagemSobrePermutaFisica: estudo?.corretagem_sobre_permuta_fisica !== false,
    deflatorAreaAbertaPct: Number(estudo?.deflator_area_aberta_pct) || 0,
  };
}

test('#594 P1 (rodada 2): com deflator de área aberta, Painel e Análise Financeira dão o MESMO ROI', () => {
  const estudo = { terreno_manual_area: 40_000, deflator_area_aberta_pct: 50 };
  const area = areaPrivativaTotalLinhas(RECEITA_AREA_ABERTA);

  const roiPainel = proformaAvancado(calcularFluxo(configDoPainel(RECEITA_AREA_ABERTA, estudo)), area).roiPct;

  const el: any = new ViabFluxoVer();
  el.estudo = { id: 1, nivel_analise: 'avancado', ...estudo };
  el.operacoes = [];
  el.faseFiltro = '';
  el.dados = {
    receitas: RECEITA_AREA_ABERTA, custos: CUSTOS, curvas: [], tipologias: [],
    crono: CRONO, dataInicio: 'jan/2027', taxa: 12, ret: { ativo: true, pct: 4 },
  };
  el._recalcular();
  const roiAnalise = roiProjetoAnalise(el.calcProjeto, area);

  // Controle: o deflator precisa MOVER o número, senão o teste não exercita
  // nada — era exatamente assim que o defeito ficava invisível.
  const semDeflator = proformaAvancado(
    calcularFluxo(configDoPainel(RECEITA_AREA_ABERTA, { ...estudo, deflator_area_aberta_pct: 0 })), area,
  ).roiPct;
  assert.notEqual(roiPainel, semDeflator, 'o deflator não moveu o ROI — a fixture não exercita o defeito');

  assert.equal(roiAnalise, roiPainel);
});

test('#594 P1 (rodada 2): o caminho do Painel passa `deflatorAreaAbertaPct` ao motor', () => {
  // Leitura de fonte porque a propriedade é do INVENTÁRIO do config, e o modo de
  // falha é a AUSÊNCIA de um campo — nada fica vermelho quando ele some, o
  // motor simplesmente lê o default 0 e devolve outro número, em silêncio.
  const dashboard = readFileSync(new URL('./tela-dashboard.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.ok(
    /deflatorAreaAbertaPct:\s*Number\(estudo\?\.deflator_area_aberta_pct\)\s*\|\|\s*0/.test(dashboard),
    '`tela-dashboard.ts` parou de passar `deflatorAreaAbertaPct` — a coluna ROI do Painel volta a '
    + 'divergir da Análise Financeira em todo estudo com área privativa aberta deflacionada',
  );
});

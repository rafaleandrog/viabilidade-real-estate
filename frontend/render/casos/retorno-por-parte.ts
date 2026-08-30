// Caso de render: a ABERTURA POR PARTE da aba Análise Financeira (#594), num
// estudo Avançado com as TRÊS naturezas de funding ao mesmo tempo —
// financiamento à produção, dívida e equity — e com o FILTRO DE FASE LIGADO.
//
// ⚠️ POR QUE ESTE CASO EXISTE, e por que ele não é substituível por teste de
// função pura. `tranchesDeInvestimento` e `indicadoresOperacao` são funções
// puras testadas em `frontend/retorno-por-parte.test.ts`; nenhuma delas fica
// vermelha se `_renderAnaliseFinanceira` parar de chamar
// `_renderRetornoPorParte`. É a classe de defeito nº 1 do `CLAUDE.md` — a que
// pegou sete PRs da Rodada 9, sempre na fiação e nunca no cálculo. Só a
// montagem em Chromium enxerga "o componente não chamou".
//
// O que os `exigir` provam, um a um:
//  · `table.proforma.partes`   — o card "Retorno por parte" está montado.
//  · `tr.parte-incorporador`   — a linha do incorporador (P2 da issue).
//  · `tr.parte-tranche` ≥ 2    — as tranches de dívida e equity (P3).
//  · `td.roi-projeto`          — o ROI geral do projeto (P1).
// Apagar qualquer uma das chamadas faz o seletor não casar nada e o harness
// REJEITA a montagem, em vez de reportar "limpo".
//
// ⚠️ DUAS asserções vivem dentro do `montar`, e não em `exigir`, porque
// `exigir` só tem PISO (`minimo`) e as duas são de OUTRA natureza:
//
//  1. o TETO do critério de aceite 3 — "duas tranches, não três": três
//     operações entram, duas linhas saem;
//  2. o VALOR publicado na célula de ROI, que prova a escolha do insumo.
//     Este caso monta `calc` (exibição, recortado pela fase "lancamento") com
//     números DIFERENTES de `calcProjeto` (projeto inteiro, duas fases), e o
//     `montar` exige que a célula mostre o do PROJETO. É o achado P1 do App de
//     revisão: o filtro de fase recorta a receita e mantém todo o custo, então
//     um card "do projeto" alimentado por `calc` publicaria um ROI que muda ao
//     mexer num controle de exibição — e deixaria de bater com a coluna do
//     Painel de estudos, que é o critério de aceite 1.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, forcarEstado } from './dados.js';
import { calcularFluxo } from '../../fluxo-caixa-motor.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';
import { areaPrivativaTotalLinhas } from '../../fluxo-shared.js';
import { roiProjetoAnalise } from '../../tela-fluxo-ver.js';
import { fmtPctOuIndef } from '../../viab-format.js';

const FUNDING: OperacaoFunding[] = [
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

/** Segunda fase, para o filtro ter o que recortar. */
const RECEITA_FASE_2 = {
  id: 2, nome: 'Torre B', fase_label: 'fase 2',
  tipologias: [{ id: 2, quantidade: 60, area_privativa_m2: 70, preco_m2: 12_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: (RECEITAS[0] as any).fluxo_pagamento,
};
const RECEITAS_PROJETO = [...RECEITAS, RECEITA_FASE_2];

function calcular(receitas: any[]) {
  return calcularFluxo({
    dataInicio: DATA_INICIO,
    taxaDescontoAa: 12,
    cronograma: CRONO,
    linhasReceita: receitas,
    linhasCusto: CUSTOS,
    curvas: [],
    areaTerreno: 4_800,
    ret: { ativo: true, pct: 4 },
    // #446 (guard-fiacao-funding): quem simula funding passa as operações ao
    // motor, senão o horizonte não cobre a quitação e a série sai truncada.
    operacoesFunding: FUNDING,
  });
}

function funding(c: ReturnType<typeof calcular>) {
  const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
  return fundingDoEstudo(
    FUNDING, c.fluxoMensal, new Array(c.prazo).fill(0), resultadoFinal, 40, 12,
    { custosRaw: CUSTOS, linhasCusto: c.linhasCusto, cronograma: CRONO },
  );
}

export const caso = {
  nome: 'retorno-por-parte',
  exigir: [
    { seletor: 'table.proforma.partes', minimo: 1 },
    { seletor: 'tr.parte-incorporador', minimo: 1 },
    { seletor: 'tr.parte-tranche', minimo: 2 },
    { seletor: 'td.roi-projeto', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    // A aba `analise` monta a tela inteira: KPIs, controles de view e os três
    // gráficos vêm junto e não têm como sair. As props abaixo são desses
    // vizinhos, não do que este caso afere.
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-grafico-linha.categorias',
    'urbi-grafico-linha.formato',
    'urbi-grafico-linha.legenda',
    'urbi-grafico-linha.series',
    // O seletor de fase de `controlesFluxo` só aparece quando há mais de uma
    // fase — e este caso tem duas, de propósito.
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const cProjeto = calcular(RECEITAS_PROJETO);
    const cFase = calcular(RECEITAS);
    const el = document.createElement('viab-fluxo-ver');
    // `estudo` fica de fora de propósito: é o que impede `updated()` de disparar
    // o carregamento por API. O estado já calculado entra aqui — inclusive o
    // par de EXIBIÇÃO (`calc`/`fundingCalc`, recortado pela fase) separado do
    // par do PROJETO (`calcProjeto`/`fundingCalcProjeto`), que é o que os dois
    // cards novos têm de consumir.
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: cFase,
      calcProjeto: cProjeto,
      vista: 'analise',
      visao: 'mensal',
      faseFiltro: 'lancamento',
      colapso: {},
      operacoes: FUNDING,
      fundingCalc: funding(cFase),
      funding: funding(cFase)?.noFluxo ?? null,
      fundingCalcProjeto: funding(cProjeto),
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS_PROJETO, custos: CUSTOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;

    const sombra = (el as any).shadowRoot;

    // (1) O TETO do critério de aceite 3, medido no DOM: três operações
    // entraram, duas linhas de tranche têm de sair. Se o financiamento à
    // produção voltar à abertura, isto lança e o harness reprova a montagem
    // inteira — em vez de as lentes reportarem "limpo" sobre uma tela errada.
    const linhas = sombra?.querySelectorAll('tr.parte-tranche')?.length ?? 0;
    if (linhas !== 2) {
      throw new Error(
        `abertura por parte com ${linhas} tranche(s): esperava exatamente 2 (dívida + equity). `
        + 'Três operações foram criadas, e a de financiamento à produção NÃO é uma parte '
        + '(#594, critério de aceite 3).',
      );
    }

    // (2) O ROI publicado é o do PROJETO, não o da fase filtrada. Os dois
    // números são diferentes de propósito nesta montagem — se coincidissem, a
    // asserção passaria sem medir nada, e é isso que a segunda checagem barra.
    //
    // #611: `roiProjetoAnalise` virou `number | null` — `fmtPctOuIndef` é o
    // MESMO ternário que `_renderRoiProjeto` usa na tela (`medido ? fmtPct
    // (roi!) : '—'` é exatamente `fmtPctOuIndef(roi)`, já que `medido` é o
    // mesmo predicado `roi !== null`), então "esperado" continua batendo
    // caractere a caractere com o que a célula publica.
    const area = areaPrivativaTotalLinhas(RECEITAS_PROJETO);
    const esperado = fmtPctOuIndef(roiProjetoAnalise(cProjeto, area));
    const daFase = fmtPctOuIndef(roiProjetoAnalise(cFase, area));
    if (esperado === daFase) {
      throw new Error(
        'a fixture deixou de exercitar o filtro de fase: o ROI do projeto e o da fase coincidem '
        + `(${esperado}), então a checagem abaixo não distingue os dois insumos.`,
      );
    }
    const publicado = sombra?.querySelector('td.roi-projeto')?.textContent?.trim();
    if (publicado !== esperado) {
      throw new Error(
        `a célula de ROI publicou "${publicado}", e o ROI do PROJETO é "${esperado}" `
        + `(o da fase filtrada é "${daFase}"). O card leu o FluxoCalc recortado pelo filtro de `
        + 'fase — achado P1 do App de revisão no PR 650.',
      );
    }
  },
};

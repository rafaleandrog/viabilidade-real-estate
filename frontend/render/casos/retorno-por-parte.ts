// Caso de render: a ABERTURA POR PARTE da aba Análise Financeira (#594), num
// estudo Avançado com as TRÊS naturezas de funding ao mesmo tempo —
// financiamento à produção, dívida e equity.
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
// ⚠️ `exigir` só tem PISO (`minimo`), e o critério de aceite 3 da issue é um
// TETO: "duas tranches, não três". Por isso a contagem exata é assertada
// dentro do próprio `montar` — lançar ali derruba o harness com a mensagem, e
// é a única forma de o teto viver na camada que mede DOM. O piso (a função
// devolve exatamente 2) tem o seu par em `frontend/retorno-por-parte.test.ts`.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, forcarEstado } from './dados.js';
import { calcularFluxo } from '../../fluxo-caixa-motor.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';

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
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const c = calcularFluxo({
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      cronograma: CRONO,
      linhasReceita: RECEITAS,
      linhasCusto: CUSTOS,
      curvas: [],
      areaTerreno: 4_800,
      ret: { ativo: true, pct: 4 },
      // #446 (guard-fiacao-funding): quem simula funding passa as operações ao
      // motor, senão o horizonte não cobre a quitação e a série sai truncada.
      operacoesFunding: FUNDING,
    });
    const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
    const fundingCalc = fundingDoEstudo(
      FUNDING, c.fluxoMensal, new Array(c.prazo).fill(0), resultadoFinal, 40, 12,
      { custosRaw: CUSTOS, linhasCusto: c.linhasCusto, cronograma: CRONO },
    );
    const el = document.createElement('viab-fluxo-ver');
    // `estudo` fica de fora de propósito: é o que impede `updated()` de disparar
    // o carregamento por API. O estado já calculado entra aqui.
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: c,
      vista: 'analise',
      visao: 'mensal',
      colapso: {},
      operacoes: FUNDING,
      fundingCalc,
      funding: fundingCalc?.noFluxo ?? null,
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS, custos: CUSTOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;

    // O TETO do critério de aceite 3, medido no DOM: três operações entraram,
    // duas linhas de tranche têm de sair. Se o financiamento à produção voltar
    // à abertura, isto lança e o harness reprova a montagem inteira — em vez de
    // as lentes reportarem "limpo" sobre uma tela errada.
    const linhas = (el as any).shadowRoot?.querySelectorAll('tr.parte-tranche')?.length ?? 0;
    if (linhas !== 2) {
      throw new Error(
        `abertura por parte com ${linhas} tranche(s): esperava exatamente 2 (dívida + equity). `
        + 'Três operações foram criadas, e a de financiamento à produção NÃO é uma parte '
        + '(#594, critério de aceite 3).',
      );
    }
  },
};

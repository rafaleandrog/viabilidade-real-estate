// Caso de render: o card "Visão do investidor" da aba Análise Financeira, num
// estudo Avançado com financiamento à produção, dívida e equity, e com o filtro
// de fase ligado. Prova a FIAÇÃO: `visaoInvestidor` é função pura testada à
// parte, e nada fica vermelho se `_renderAnaliseFinanceira` parar de chamar
// `_renderVisaoInvestidor` — só a montagem em Chromium enxerga isso.
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
    jurosTabelaAaEstudo: 0,
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
  nome: 'visao-investidor',
  exigir: [
    { seletor: 'table.proforma.visao-investidor', minimo: 1 },
    { seletor: 'tr.vi-equity-multiple', minimo: 1 },
    { seletor: 'tr.vi-yield', minimo: 1 },
    { seletor: 'tr.vi-ltv', minimo: 2 },
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
    const em = sombra?.querySelector('tr.vi-equity-multiple td.num')?.textContent?.trim() ?? '';
    if (em === '—' || !em.endsWith('×')) {
      throw new Error(`a célula do Equity Multiple publicou "${em}": esperava um múltiplo terminado em "×" (há equity na fixture).`);
    }
  },
};

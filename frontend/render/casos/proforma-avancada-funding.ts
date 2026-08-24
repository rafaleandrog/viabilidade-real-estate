// Render da PROFORMA do Avançado, com funding — as DUAS linhas INFORMATIVAS
// do rodapé: o serviço da dívida do funding (#447) e a "Receita líquida de
// proforma" da EVI (#465).
//
// As funções puras que decidem o conteúdo (`linhaInformativaFunding`,
// `linhaInformativaReceitaLiquidaEvi`) já são testadas em
// `fluxo-apresentacao.test.ts`/`funding-motor.test.ts`. O que NENHUM teste
// de lógica pura prova é que `tela-fluxo-ver.ts` de fato as CHAMA e anexa o
// resultado a `p.linhas` antes de render: apagar QUALQUER uma das duas
// chamadas em `_renderProforma` deixa os testes de lógica pura inteiramente
// verdes, porque nenhum deles monta a tela. Este caso é o único lugar do
// repositório que mede a FIAÇÃO, não o cálculo — mesmo padrão do
// `modal-absorcao` (#431, ver o topo daquele arquivo).
//
// O `exigir` de `tr.informativo` com `minimo: 2` é a prova: `linhaInformativaFunding`
// é condicional (`null` sem saída de funding) mas `linhaInformativaReceitaLiquidaEvi`
// NUNCA é — então este caso, que tem funding configurado, só chega a DUAS
// linhas se as DUAS chamadas sobreviverem. Apagar uma delas cai para 1 e o
// harness rejeita o caso por não montar o que declara, em vez de reportar
// "limpo" para uma tela que perdeu uma das duas linhas.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, fluxo, forcarEstado } from './dados.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';

const FUNDING: OperacaoFunding[] = [{
  tipo: 'divida', nome: 'Fin produção', valor: 5_000_000, inicio_mes: 0,
  taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
}];

export const caso = {
  nome: 'proforma-avancada-funding',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.proforma', minimo: 1 },
    { seletor: 'tr.custo', minimo: 1 },
    { seletor: 'tr.resultado', minimo: 1 },
    // A prova de fiação: só chega a 2 se `_renderProforma` chamou as DUAS
    // funções (`linhaInformativaFunding` E `linhaInformativaReceitaLiquidaEvi`,
    // #465) e anexou os dois resultados antes de render.
    { seletor: 'tr.informativo', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const c = fluxo();
    const fundingCalc = fundingDoEstudo(
      FUNDING, c.fluxoMensal, new Array(c.prazo).fill(0), 0, 0, 12,
    );
    const el = document.createElement('viab-fluxo-ver');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: c,
      vista: 'proforma',
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
  },
};

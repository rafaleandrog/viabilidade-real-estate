// Render da PROFORMA do Avançado, com funding — a linha INFORMATIVA do
// rodapé (#447).
//
// A função pura que decide o conteúdo (`linhaInformativaFunding`) já é
// testada em `fluxo-apresentacao.test.ts`. O que NENHUM teste de lógica pura
// prova é que `tela-fluxo-ver.ts` de fato a CHAMA e anexa o resultado a
// `p.linhas` antes de render: apagar a chamada em `_renderProforma` — e só
// ela — deixa os 513 testes de lógica pura inteiramente verdes, porque
// nenhum dos dois testes novos da #447 monta a tela. Este caso é o único
// lugar do repositório que mede a FIAÇÃO, não o cálculo — mesmo padrão do
// `modal-absorcao` (#431, ver o topo daquele arquivo).
//
// O `exigir` de `tr.informativo` é a prova: sem a linha anexada, o seletor
// não casa nada e o harness rejeita o caso por não montar o que declara —
// em vez de reportar "limpo" para uma tela que nunca desenhou a linha.

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
    // A prova de fiação: só existe se `_renderProforma` chamou
    // `linhaInformativaFunding` e anexou o resultado antes de render.
    { seletor: 'tr.informativo', minimo: 1 },
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

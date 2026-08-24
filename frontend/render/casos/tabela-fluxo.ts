// Caso de render: a TABELA do Fluxo de Caixa.
//
// A tabela mensal é o conteúdo mais largo do app — dezenas de colunas de mês
// dentro de um wrapper com `overflow-x: auto`. Duas coisas que só o render
// responde: se o scroller é mesmo o wrapper (e não o documento inteiro
// rolando), e se nada dentro dele transborda por fora do scroller.
//
// O `overflow-x: auto` do wrapper é INTENÇÃO, e a sonda o reconhece como tal —
// ver `scripts/render-check.mjs`, seção "transbordo por nó".

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, fluxo, forcarEstado } from './dados.js';

export const caso = {
  nome: 'tabela-fluxo',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  // Estes seletores são a prova de que a tela sob medição está na tela.
  exigir: [
    { seletor: 'div.fx-kpis', minimo: 1 },
    { seletor: 'div.kpi-card', minimo: 9 },
    { seletor: 'table.fx', minimo: 1 },
    { seletor: 'table.fx tbody tr', minimo: 4 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-ver');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: fluxo(),
      vista: 'fluxo-caixa',
      visao: 'mensal',
      colapso: {},
      operacoes: [],
      fundingCalc: null,
      funding: null,
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

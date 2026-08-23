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

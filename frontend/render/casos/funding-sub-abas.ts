// Caso de render: DUAS operações do mesmo tipo viram DOIS cartões, na ordem de
// `ordem`.
//
// Antes, a segunda dívida virava uma sub-aba dentro da aba Dívida. As abas por
// tipo saíram: agora cada operação é um cartão na aba Operações, e dentro do
// mesmo tipo vale a posição da operação (`ordem`) — a mesma que as setas da
// página da operação mudam.
//
// A fixture tem `ordem` INVERTIDA em relação ao `id` de propósito: a operação
// de id 11 vem antes da de id 10. Ordenar por `id`, ou pela ordem de chegada,
// deixaria este caso vermelho; ordenar por `ordem` o deixa verde.

import '../../tela-funding.js';
import type { OperacaoFunding } from '../../funding-motor.js';
import { estadoFundingCarregado, forcarEstado } from './dados.js';

const OPERACOES: (OperacaoFunding & { id: number; ordem: number })[] = [
  {
    id: 10, ordem: 1, tipo: 'divida', nome: '1º Dívida',
    valor: 4_000_000, inicio_mes: 0, taxa_anual: 14,
    periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
  },
  {
    id: 11, ordem: 0, tipo: 'divida', nome: '2º Dívida',
    valor: 6_000_000, inicio_mes: 6, taxa_anual: 16,
    periodo_amortizacao_meses: 24, periodo_carencia_meses: 3,
  },
];

export const caso = {
  nome: 'funding-sub-abas',
  exigir: [
    { seletor: 'viab-funding-cartao', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.cor',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-funding') as any;
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      ...estadoFundingCarregado(OPERACOES),
      editavel: false,
    });
    raiz.appendChild(el);
    await el.updateComplete;
    el._recalcular();
    await el.updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{ ids: (string | undefined)[]; nomes: (string | null)[] }> {
    const tela = raiz.querySelector('viab-funding') as any;
    const cartoes = [...tela.shadowRoot.querySelectorAll('viab-funding-cartao')] as any[];
    return {
      ids: cartoes.map((c) => c.dataset.id),
      nomes: cartoes.map((c) => c.getAttribute('aria-label')),
    };
  },
};

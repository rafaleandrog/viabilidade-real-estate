// Caso de render: o modal FLUXO DE PAGAMENTO (Receitas do Avançado).
//
// É a tela mais densa do app em campos por linha — `viab-num` em grade, três
// blocos (entrada, parcelamento, repasse), dentro de um `urbi-modal` com
// `maxWidth: 860px`. Densidade assim é onde campo espremido e rótulo cortado
// aparecem primeiro, e nada disso existe fora do render.
//
// ⚠️ O `urbi-modal` do harness é o stub do espelho: ele tem as declarações
// `:host` reais, mas NÃO o overlay nem o posicionamento internos, que o espelho
// não carrega. O que este caso mede é o layout do CONTEÚDO do modal.

import '../../tela-fluxo-receitas.js';
import { formularioPagamento } from '../../fluxo-pagamento-editor.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  alocacoes: [{ tipologia_id: 1, unidades: 80, preco_m2: 11_000 }],
  fluxo_pagamento: {
    entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
    parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
    repasse: [{ pct: 30, mesesAposObra: 3 }],
  },
};

export const caso = {
  nome: 'modal-pagamento',
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-receitas');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      editavel: true,
      // A lista de Grupos fica VAZIA de propósito: o caso é o MODAL, e o card do
      // Grupo por trás dele tem grade própria e larga, que abafaria o achado.
      fases: [],
      tipologias: [{ id: 1, nome: 'Tipo 62', quantidade: 80, area_privativa_m2: 62 }],
      crono: CRONO,
      dataInicio: DATA_INICIO,
      custosPermuta: [],
      modalPag: FASE,
      pagForm: formularioPagamento(FASE.fluxo_pagamento),
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

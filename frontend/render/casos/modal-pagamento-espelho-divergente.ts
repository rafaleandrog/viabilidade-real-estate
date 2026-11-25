// Caso de render: o modal FLUXO DE PAGAMENTO aberto num Grupo cujo plano foi
// gravado por API com `componentes` que o espelho legado (entrada/parcelas) não
// descreve. A tela trata o plano como somente canônico: mostra o aviso
// `p.espelho-divergente` e desabilita os campos do espelho.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho, sem overlay nem posicionamento.

import '../../tela-fluxo-receitas.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  alocacoes: [{ tipologia_id: 1, unidades: 80, preco_m2: 11_000 }],
  fluxo_pagamento: {
    entrada: [{ pct: 50, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 50, parcelas: 12, periodicidade: 'mensal' }],
    repasse: { apos_entrega_meses: 1 },
    componentes: [
      { tipo: 'imediato', rotulo: 'Entrada', descontoPct: 0, participacaoPct: 10 },
      { tipo: 'prazo_fixo', rotulo: 'Parcelas', prazoMeses: 12, sinalPct: 0, defasagemMeses: 0, taxaMensal: 0, participacaoPct: 20 },
      { tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 50, taxaMensal: 0, participacaoPct: 70 },
    ],
    aplicado: true,
  },
};

export const caso = {
  nome: 'modal-pagamento-espelho-divergente',
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'div.pag-grid', minimo: 1 },
    // O seletor que este caso existe para exercitar.
    { seletor: 'p.espelho-divergente', minimo: 1 },
    // Os campos do espelho ficam desabilitados.
    { seletor: 'viab-num[desabilitado]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.variante',

    'urbi-icone.classe',
    'urbi-select.opcoes',
    'urbi-select.label',
    'urbi-checkbox.label',
    'urbi-checkbox.desabilitado',
    'urbi-select.desabilitado',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-modal.title',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-receitas');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      editavel: true,
      fases: [],
      tipologias: [{ id: 1, nome: 'Tipo 62', quantidade: 80, area_privativa_m2: 62 }],
      crono: CRONO,
      dataInicio: DATA_INICIO,
    });
    raiz.appendChild(el);
    // Abre o modal pelo caminho real da tela (`_abrirPagamento` monta o formulário):
    // forçar `pagForm` aqui deixaria a fiação da tela sem cobertura.
    (el as any)._abrirPagamento(FASE);
    await (el as any).updateComplete;
  },
};

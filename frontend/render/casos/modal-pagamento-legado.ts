// Caso de render: o modal FLUXO DE PAGAMENTO aberto num Grupo cujo plano ainda
// está no formato LEGADO — `fluxo_pagamento` sem a chave `componentes`.
//
// Por que este caso existe (#585, rodada 5 de revisão, achado do revisor
// externo): a linha `p.juros-vigente` que o caso irmão exige afirma que a taxa
// do estudo "vale para entrada parcelada, parcelamento e repasse de todas as
// linhas de receita". Numa linha legada isso é FALSO — ela não passa pelo motor
// canônico (`recebiveisComponentesLinha` devolve `null` no guard de shape) e o
// cálculo cai no motor legado, que soma entrada/parcelas/repasse SEM juros.
//
// O parágrafo `p.plano-legado` é o que torna esse caso visível na tela em vez
// de deixar um número que nenhum campo explica. Sem este caso, apagá-lo do
// componente deixaria a suíte inteira verde — a classe de defeito nº 1 do
// `CLAUDE.md`, o defeito que mora na fiação.
//
// ⚠️ Mesma ressalva do caso irmão: o `urbi-modal` aqui é o stub do espelho, sem
// overlay nem posicionamento internos. O que se mede é o layout do CONTEÚDO.

import '../../tela-fluxo-receitas.js';
import { formularioPagamento } from '../../fluxo-pagamento-editor.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  alocacoes: [{ tipologia_id: 1, unidades: 80, preco_m2: 11_000 }],
  // Exatamente o mesmo plano do caso irmão, MENOS a chave `componentes` — é só
  // ela que decide o motor, e é ela que este caso remove. Manter o resto igual
  // é o que faz a comparação entre os dois casos significar alguma coisa.
  fluxo_pagamento: {
    entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
    parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
    repasse: [{ pct: 30, mesesAposObra: 3 }],
  },
};

export const caso = {
  nome: 'modal-pagamento-legado',
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'div.pag-grid', minimo: 1 },
    { seletor: 'viab-num', minimo: 6 },
    { seletor: 'p.juros-vigente', minimo: 1 },
    // O seletor que este caso existe para exercitar. Apagar o parágrafo do
    // componente derruba ESTE caso, e só ele.
    { seletor: 'p.plano-legado', minimo: 1 },
    { seletor: 'urbi-select', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-select.opcoes',
    'urbi-select.label',
    'urbi-checkbox.label',
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
      custosPermuta: [],
      modalPag: FASE,
      pagForm: formularioPagamento(FASE.fluxo_pagamento),
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

// Render do modal Fluxo de pagamento com CARTEIRA PRÓPRIA (#850).
//
// O mesmo modal de `modal-pagamento.ts`, com o repasse bancário abaixo de 100%:
// é o que faz a linha `div.carteira-propria` (fatia da carteira, Nº parcelas e
// carência) existir. Sem este caso, apagar a linha do template deixava a suíte
// de render inteira verde, e a densidade dela — mais três campos no bloco do
// saldo de chaves — nunca era medida.

import '../../tela-fluxo-receitas.js';
import { formularioPagamento } from '../../fluxo-pagamento-editor.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE = {
  id: 1,
  nome: 'Lotes — Quadra A',
  fase_label: 'lancamento',
  alocacoes: [{ tipologia_id: 1, unidades: 80, preco_m2: 1_000 }],
  fluxo_pagamento: {
    entrada: [{ pct: 10, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 20, parcelas: 24, periodicidade: 'mensal' }],
    // 70% de saldo de chaves, 25% dele ao banco e o resto em 120x após 6 meses.
    repasse: { apos_entrega_meses: 0, pct_banco: 25, carteira_parcelas: 120, carteira_carencia_meses: 6 },
    componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 0 },
      { tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 24, defasagemMeses: 1, taxaMensal: 0.0098636 },
      { tipo: 'concentrado', participacaoPct: 17.5, mesPagamento: 23, taxaMensal: 0.0098636 },
      { tipo: 'carteira_pos_marco', participacaoPct: 52.5, marcoMes: 22, carenciaMeses: 6, prazoMeses: 120, taxaMensal: 0.0098636 },
    ],
  },
};

export const caso = {
  nome: 'modal-pagamento-carteira',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  // Estes seletores são a prova de que a tela sob medição está na tela.
  // `viab-num` é o campo numérico do app (não é stub): a grade de pagamento tem
  // entrada, parcelamento e repasse, e é a densidade deles que o caso mede.
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'div.pag-grid', minimo: 1 },
    // #455: 3 na Entrada (% do total, Nº parcelas, Desconto) + 3 no
    // Parcelamento (% do total, Sinal, Nº parcelas).
    // #585: eram 7 — o 7º era o campo do bloco "Juros de tabela", que SAIU deste
    // modal para a aba Viabilidade → Financeiro. Junto com ele saiu o
    // `p.aviso-juros` ("este plano tem N taxas diferentes gravadas"), que este
    // caso exigia: com uma taxa por ESTUDO não há mais o que avisar.
    { seletor: 'viab-num', minimo: 6 },
    // #850: a linha da carteira própria só existe com repasse bancário < 100%,
    // e traz os dois campos dela (Nº parcelas e carência).
    { seletor: 'div.carteira-propria', minimo: 1 },
    { seletor: 'div.carteira-propria viab-num', minimo: 2 },
    // #585 (rodada 2): a linha somente-leitura com a taxa VIGENTE do estudo.
    // Ela é a única coisa que diz ao usuário deste modal qual taxa está sendo
    // aplicada — o campo saiu para a aba Financeiro. Sem este seletor, apagar o
    // parágrafo deixava os dois testes de render VERDES (medido por mutação):
    // uma defesa acrescentada e não exercitada, que é a mesma classe de defeito
    // que a rodada 1 achou três vezes.
    { seletor: 'p.juros-vigente', minimo: 1 },
    // #460: o controle de destino do resíduo — primeiro `urbi-select` deste caso.
    { seletor: 'urbi-select', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // `urbi-modal.maxWidth` NÃO está aqui de propósito: ela É reproduzida, pelo
    // PROPS_QUE_DIMENSIONAM — é o conserto que faz este caso medir contra os
    // 860px reais em vez da largura livre da janela.
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    // Binding de PROPRIEDADE (o Lit nem escreve atributo); o stub não desenha
    // opção nenhuma — mesma natureza documentada em kpis-resumo.ts e
    // grupo-badge-legado.ts. O que este caso mede é a grade de `viab-num`.
    'urbi-select.opcoes',
    // O espelho de `urbi-select` não desenha o rótulo — medido aqui: mesmo
    // com `label` em atributo, a caixa fica sem esse texto. Igual natureza
    // das duas acima; não é isenção, é o registro do que este caso não cobre.
    'urbi-select.label',
    // Os três abaixo têm a mesma natureza entre si: o stub não desenha o
    // conteúdo deles, então as caixas ficam com altura zero e não contribuem
    // geometria. O que este caso mede é a GRADE do modal, que é feita de
    // `viab-num` — componente do app, não stub, e portanto renderizado de
    // verdade. O `urbi-estado-vazio` só aparece porque a lista de Grupos está
    // vazia de propósito, para isolar o modal.
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
      // A lista de Grupos fica VAZIA de propósito: o caso é o MODAL, e o card do
      // Grupo por trás dele tem grade própria e larga, que abafaria o achado.
      fases: [],
      tipologias: [{ id: 1, nome: 'Tipo 62', quantidade: 80, area_privativa_m2: 62 }],
      crono: CRONO,
      dataInicio: DATA_INICIO,
      modalPag: FASE,
      pagForm: formularioPagamento(FASE.fluxo_pagamento),
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

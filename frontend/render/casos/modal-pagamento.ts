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
    // #436: `componentes` PERSISTIDOS com juros — é o que faz o bloco "Juros de
    // tabela" existir na tela. Sem isto o caso media um modal sem esse bloco, e
    // qualquer defeito nele passava despercebido: medi por mutação que ler do
    // formulário em vez do persistido sobrevivia à suíte inteira.
    //
    // A taxa é a do estudo 5 de Pinguim (12,5% a.a.); a segunda difere para o
    // caso exercitar o ramo de taxas divergentes, que é o layout mais largo.
    componentes: [
      { tipo: 'prazo_fixo', participacaoPct: 50, taxaMensal: 0.0098636, rotulo: 'parcelas' },
      { tipo: 'concentrado', participacaoPct: 30, taxaMensal: 0.005, rotulo: 'repasse' },
    ],
  },
};

export const caso = {
  nome: 'modal-pagamento',
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
    // Parcelamento (% do total, Sinal, Nº parcelas) + 1 no bloco de Juros.
    { seletor: 'viab-num', minimo: 7 },
    // #436: o bloco de juros e o aviso de que "Aplicar" os apaga. Sem estas duas
    // linhas o bloco novo não é medido por nada.
    { seletor: 'p.aviso-juros', minimo: 1 },
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
      custosPermuta: [],
      modalPag: FASE,
      pagForm: formularioPagamento(FASE.fluxo_pagamento),
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

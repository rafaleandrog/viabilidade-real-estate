// Caso de render: o modal ABSORÇÃO DE VENDAS (Receitas do Avançado), aberto
// sobre um Grupo cuja curva é `personalizado`.
//
// Por que este caso existe, e por que a fixture é `personalizado` e não a linha
// comum: a #431 acrescentou ao modal um `urbi-banner variante="alerta"` que só
// aparece quando o registro persistido carrega uma curva que o formulário não
// sabe desenhar. Toda a lógica de decisão vive em módulo puro
// (`fluxo-absorcao-editor.ts`) e tem teste próprio — mas a FIAÇÃO entre o
// módulo e a tela não tem, porque nenhum `.test.ts` deste repo importa
// componente. Este caso é a única coisa que mede o banner de fato na tela.
//
// É a mesma lição do PR 517: lá o caso de render existia, mas a fixture não
// tinha `componentes` persistidos — e trocar o objeto persistido pelo
// formulário sobrevivia a 458 testes. Fixture pobre é caso de render que
// aprova o que não mediu.
//
// ⚠️ O `urbi-modal` do harness é o stub do espelho: ele tem as declarações
// `:host` reais, mas NÃO o overlay nem o posicionamento internos. O que este
// caso mede é o layout do CONTEÚDO do modal.

import '../../tela-fluxo-receitas.js';
import { formularioAbsorcao } from '../../fluxo-absorcao-editor.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  alocacoes: [{ tipologia_id: 1, unidades: 80, preco_m2: 11_000 }],
  // A linha do estudo 6 de Pinguim: curva própria de 43 pontos, sem `blocos`.
  // Sem `blocos`, os três campos abrem zerados — é justamente o estado em que o
  // aviso precisa aparecer, porque a tela não tem como mostrar a curva.
  absorcao: {
    modo: 'personalizado',
    correcao_estoque: false,
    meses: Array.from({ length: 43 }, (_, i) => ({ mes: 6 + i, pct: 100 / 43 })),
    aplicado: true,
  },
};

export const caso = {
  nome: 'modal-absorcao',
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'table.abs', minimo: 1 },
    // Pré-lançamento, Lançamento e Obra (Pós-chaves é derivado, não é campo).
    { seletor: 'viab-num', minimo: 3 },
    // #431: o aviso da curva não representável. Sem esta linha, o banner podia
    // sumir do template e nenhuma medida acusaria.
    { seletor: 'urbi-banner[variante="alerta"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-banner.variante',
    'urbi-botao.icone',
    'urbi-botao.variante',
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
      // Lista de Grupos vazia de propósito: o caso é o MODAL.
      fases: [],
      tipologias: [{ id: 1, nome: 'Tipo 62', quantidade: 80, area_privativa_m2: 62 }],
      crono: CRONO,
      dataInicio: DATA_INICIO,
      custosPermuta: [],
      modalAbs: FASE,
      absForm: formularioAbsorcao(FASE.absorcao, true),
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

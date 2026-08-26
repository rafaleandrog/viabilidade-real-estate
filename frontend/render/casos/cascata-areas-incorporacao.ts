// Caso de render: #564 — a tabela de áreas em CASCATA da Incorporação, aba
// "Terreno & Áreas" (`frontend/tela-premissas.ts:_renderTabelaAreasIncorporacao`).
//
// `CASCATA_INCORPORACAO` (`frontend/areas-cascata.ts`) existia desde 2026-08-03
// sem nenhum consumidor de produção — este é o primeiro caso de render que toca
// `viab-tela-premissas`, e a prova de que a tela renderiza a cascata (e não o
// grid plano antigo de 5 campos) só existe aqui: nenhum teste de lógica pura
// vê o DOM.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

// `...ESTUDO` já é um estudo Preliminar de Incorporação com origem manual do
// terreno — o mesmo fixture de `kpis-proforma.ts`/`kpis-resumo.ts`. Completa
// as duas áreas "abertas" (ausentes no fixture-base) para exercitar as 4
// parcelas da soma de `privativa_total`, não só as 2 "fechadas".
const ESTUDO_CASCATA_INC = {
  ...ESTUDO,
  area_pvt_r_aberta: 620,
  area_pvt_nr_aberta: 0,
};

export const caso = {
  nome: 'cascata-areas-incorporacao',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.areas', minimo: 1 },
    // As 8 linhas de `CASCATA_INCORPORACAO`: Terreno + 4 áreas privativas +
    // Área Privativa Total (computada) + Área Comum + Área Construída Total
    // (computada) — 2 linhas `tr.computada`, 6 linhas normais.
    { seletor: 'table.areas tbody tr', minimo: 8 },
    { seletor: 'tr.computada', minimo: 2 },
    // As 5 linhas EDITÁVEIS da cascata (as 4 áreas privativas + comum) — sem
    // badge de unidade (critério 2 da #564): só o `viab-num` da própria célula.
    { seletor: 'table.areas viab-num.area-valor', minimo: 5 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // Os dois `urbi-card` da aba ("Imagem principal" e "Terreno & Áreas") —
    // mesma natureza de `kpis-proforma.ts`: o stub não desenha o título.
    'urbi-card.titulo',
    // `viab-imagem-principal` (card de cima, fora do escopo desta cascata):
    // rótulo do input de nome do terreno e do botão de anexar imagem — o stub
    // não desenha texto de nenhum dos dois.
    'urbi-input.label',
    'urbi-seletor-arquivo.texto',
    'urbi-seletor-arquivo.accept',
    // Botão "Salvar premissas" do rodapé do form — mesma natureza de
    // `modal-pagamento.ts`/`grupo-badge-legado.ts`: o stub não pinta variante.
    'urbi-botao.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_CASCATA_INC,
      secao: 'terreno',
      editavel: true,
      benchmarks: [],
      produtos: [],
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

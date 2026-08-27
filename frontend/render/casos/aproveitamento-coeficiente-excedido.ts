// Caso de render: #569 — o ESTADO DE ESTOURO do indicador de aproveitamento do
// coeficiente máximo, aba "Terreno & Áreas" da Incorporação
// (`frontend/tela-premissas.ts:_renderAproveitamentoCoeficiente`).
//
// Caso irmão de `cascata-areas-incorporacao.ts` (que cobre o indicador SOB o
// teto, sem aviso) — juntos os dois provam as duas metades do critério 5 da
// #569: "indicador presente" e "estado de estouro". A prova de que o AVISO
// está na tela (e não só o cálculo, testado em `proforma.test.ts`) só existe
// aqui: nenhum teste de lógica pura vê o DOM, e apagar `_renderAproveitamentoCoeficiente`
// do template deixaria a suíte de lógica pura inteira verde.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

// ESTUDO base: terreno manual 4.800 m², área PVT residencial fechada 4.960 m²
// (as outras 3 parcelas ficam ausentes/0). Coeficiente 0,5 → teto = 2.400 m²,
// bem abaixo dos 4.960 m² usados (206,7% de aproveitamento) — excedente largo,
// para o estouro não depender de arredondamento.
const ESTUDO_EXCEDIDO = {
  ...ESTUDO,
  coef_aproveitamento_maximo: 0.5,
};

export const caso = {
  nome: 'aproveitamento-coeficiente-excedido',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.areas', minimo: 1 },
    // O indicador (3 `urbi-kpi`: usada, teto, %) continua presente mesmo em
    // estouro — só o aviso é que é condicional.
    { seletor: '.kpis.aproveitamento', minimo: 1 },
    { seletor: '.kpis.aproveitamento urbi-kpi', minimo: 3 },
    // A prova do critério 3 da #569: o AVISO na tela, não só `aproveitamentoExcedido`
    // no motor.
    { seletor: 'urbi-banner.aviso-aproveitamento', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // Os dois `urbi-card` da aba ("Imagem principal" e "Terreno & Áreas") —
    // mesma natureza de `kpis-proforma.ts`: o stub não desenha o título.
    'urbi-card.titulo',
    // `viab-imagem-principal` (card de cima, fora do escopo deste indicador):
    // rótulo do input de nome do terreno e do botão de anexar imagem — o stub
    // não desenha texto de nenhum dos dois.
    'urbi-input.label',
    'urbi-seletor-arquivo.texto',
    'urbi-seletor-arquivo.accept',
    // Botão "Salvar premissas" do rodapé do form — mesma natureza de
    // `modal-pagamento.ts`/`grupo-badge-legado.ts`: o stub não pinta variante.
    'urbi-botao.variante',
    // Os 3 `urbi-kpi` do indicador ligam `variante` (o 3º vira "erro" em
    // estouro) — mesma natureza de `kpis-proforma.ts`. E o `urbi-banner` do
    // aviso liga `variante="alerta"` — mesma natureza de
    // `proforma-permuta-capada.ts`.
    'urbi-kpi.variante',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_EXCEDIDO,
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

// Caso de render: #612 — a tabela de áreas em cascata do LOTEAMENTO com as
// deduções somando mais que a poligonal, aba "Terreno & Áreas"
// (`frontend/tela-premissas.ts:_renderTabelaAreasLoteamento`).
//
// ⚠️ POR QUE ESTE CASO EXISTE, e o que só ele mede. O piso em zero é do motor
// (`calcularCascata`, `frontend/areas-cascata.ts`) e está coberto por
// `frontend/areas-cascata.test.ts`. O AVISO não: apagar
// `_renderAvisoAreaNegativa` do template deixa a suíte de lógica pura inteira
// verde, porque nenhum teste dela vê o DOM — e o conserto viraria o que a
// #563 evitou no VGV, um número capado em silêncio. Este caso é o único ponto
// do repositório que exige o banner NA TELA.
//
// É também o primeiro caso de render montado sobre `viab-tela-premissas` de um
// LOTEAMENTO: os dois irmãos (`cascata-areas-incorporacao.ts` e
// `aproveitamento-coeficiente-excedido.ts`) são de Incorporação, e o ramo
// `if (lot)` desta tela — a cascata de 11 linhas com os badges de unidade —
// nunca tinha sido montado em DOM nenhum.

import '../../tela-premissas.js';
import { forcarEstado } from './dados.js';

// Gleba de 10.000 m² com 26.000 m² de deduções — os mesmos números do teste de
// lógica pura da #612, para as duas camadas descreverem o mesmo estudo. Sem
// piso, Parcelável = −2.000, Líquida = −11.000 e ALV = −26.000 m²; com piso,
// as três ficam em 0 e as três acusam corte.
const ESTUDO_LOT_ESTOURADO: Record<string, any> = {
  id: 22,
  nome: 'Render Check — Loteamento com deduções estouradas',
  tipo_empreendimento: 'loteamento',
  nivel_analise: 'preliminar',
  origem_terreno: 'manual',
  terreno_manual_area: 10_000,
  area_app_modo: 'm2', area_app_valor: 12_000,
  area_elup_epu_modo: 'm2', area_elup_epu_valor: 4_000,
  area_epc_modo: 'm2', area_epc_valor: 3_000,
  area_viario_publico_modo: 'm2', area_viario_publico_valor: 2_000,
  area_viario_privado_modo: 'm2', area_viario_privado_valor: 3_000,
  area_comuns_privadas_modo: 'm2', area_comuns_privadas_valor: 1_000,
  area_verdes_modo: 'm2', area_verdes_valor: 1_000,
  sujeito_ret: true,
  considerar_custo_terreno: true,
  custo_terreno_m2: 120,
  infra_modo: 'valor_m2', custo_infra_m2: 400,
};

export const caso = {
  nome: 'cascata-areas-loteamento-deficit',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.areas', minimo: 1 },
    // As 11 linhas de `CASCATA_LOTEAMENTO`: Poligonal (âncora 1) + 7 editáveis
    // + Parcelável + Líquida + ALV.
    { seletor: 'table.areas tbody tr', minimo: 11 },
    // As 7 editáveis trazem o seletor de unidade (m² · % Pol. · % Parc.) —
    // é o ramo `lot` que nenhum outro caso montava.
    { seletor: 'table.areas .area-seletor', minimo: 7 },
    // A prova do critério 2 da #612: o AVISO na tela, não só `deficitM2` no
    // motor.
    { seletor: 'urbi-banner.aviso-area-negativa', minimo: 1 },
    // As 3 linhas COMPUTADAS cortadas (Parcelável, Líquida, ALV) marcadas.
    { seletor: 'table.areas tr.deficit', minimo: 3 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // Os dois `urbi-card` da aba ("Imagem principal" e "Terreno & Áreas") —
    // mesma natureza de `cascata-areas-incorporacao.ts`: o stub não desenha o
    // título.
    'urbi-card.titulo',
    // `viab-imagem-principal` (card de cima, fora do escopo desta cascata):
    // rótulo do input de nome do terreno e do botão de anexar imagem.
    'urbi-input.label',
    'urbi-seletor-arquivo.texto',
    'urbi-seletor-arquivo.accept',
    // Botão "Salvar premissas" do rodapé do form — mesma natureza de
    // `modal-pagamento.ts`/`grupo-badge-legado.ts`: o stub não pinta variante.
    'urbi-botao.variante',
    // Os badges de unidade das 7 linhas editáveis (`m²` · `% Pol.` · `% Parc.`)
    // — o stub não reproduz nem a cor nem o estado ativo.
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-badge.ativo',
    // O `urbi-banner` do aviso liga `variante="erro"` — mesma natureza de
    // `aproveitamento-coeficiente-excedido.ts`.
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_LOT_ESTOURADO,
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

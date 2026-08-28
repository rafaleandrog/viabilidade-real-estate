// Caso de render: #612 (rodada 1 de revisão do PR 620) — a tabela de áreas em
// cascata da INCORPORAÇÃO com um valor NEGATIVO digitado numa linha editável,
// aba "Terreno & Áreas" (`frontend/tela-premissas.ts:_renderTabelaAreasIncorporacao`).
//
// ⚠️ POR QUE ESTE CASO EXISTE. A revisão do PR 620 mostrou que o piso genérico
// de `calcularCascata` também corta um negativo digitado numa editável da
// `CASCATA_INCORPORACAO` — a tabela mostrava 0 enquanto o motor
// (`calcularProforma`) seguia lendo o negativo cru. O conserto ligou o motor
// ao mesmo piso (`areaM2`, `frontend/proforma.ts`) e o aviso à tabela da
// Incorporação. Este caso é o único ponto do repositório que exige o banner NA
// TELA da Incorporação — o irmão `cascata-areas-loteamento-deficit.ts` prova o
// mesmo para o Loteamento, e `cascata-areas-incorporacao.ts` é o estado limpo,
// sem corte e sem banner.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

// O mesmo fixture-base do caso limpo, com a área privativa R aberta NEGATIVA —
// o piso corta para 0 (deficitM2 620) e o banner aparece. As demais parcelas
// ficam como no caso limpo, para o corte ser de UMA linha só.
const ESTUDO_CASCATA_INC_NEGATIVA = {
  ...ESTUDO,
  area_pvt_r_aberta: -620,
  area_pvt_nr_aberta: 0,
};

export const caso = {
  nome: 'cascata-areas-incorporacao-deficit',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.areas', minimo: 1 },
    // As 8 linhas de `CASCATA_INCORPORACAO` (ver `cascata-areas-incorporacao.ts`).
    { seletor: 'table.areas tbody tr', minimo: 8 },
    // A prova do conserto: o AVISO na tela da INCORPORAÇÃO, não só no Loteamento.
    { seletor: 'urbi-banner.aviso-area-negativa', minimo: 1 },
    // A linha editável cortada (Área Privativa R aberta) marcada.
    { seletor: 'table.areas tr.deficit', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma (mesma lista do caso limpo `cascata-areas-incorporacao.ts`, mais a
  // variante do banner que só aparece no estado de corte).
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-input.label',
    'urbi-seletor-arquivo.texto',
    'urbi-seletor-arquivo.accept',
    'urbi-botao.variante',
    // O `urbi-banner` do aviso liga `variante="erro"` — mesma natureza de
    // `cascata-areas-loteamento-deficit.ts`.
    'urbi-banner.variante',
    // Os KPIs da mesma aba (aproveitamento #569 e área alocada #573) ligam
    // `variante` quando o fixture sai do estado neutro — o corte do negativo
    // muda a área privativa e tira o indicador de área alocada do zero.
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_CASCATA_INC_NEGATIVA,
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

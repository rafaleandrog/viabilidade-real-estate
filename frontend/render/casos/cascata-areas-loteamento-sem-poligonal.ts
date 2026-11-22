// Caso de render: #904 — a cascata de áreas do LOTEAMENTO com a poligonal em
// 0 (nenhuma área de terreno informada), aba "Terreno & Áreas"
// (`frontend/tela-premissas.ts:_renderTabelaAreasLoteamento`).
//
// ⚠️ O que só este caso mede. A decisão do bloqueio é função pura
// (`frontend/cascata-modo-area.ts`) e está coberta por
// `frontend/cascata-modo-area.test.ts`. A FIAÇÃO não: apagar a chamada a
// `motivoBloqueioTrocaModoArea` em `_renderSeletorArea` deixa a suíte de
// lógica verde, e os badges de % voltariam a ser clicáveis, apagando o valor
// digitado. Este caso exige os badges bloqueados e o motivo NA TELA.

import '../../tela-premissas.js';
import { forcarEstado } from './dados.js';

// Sem área de terreno: a âncora 1 (Poligonal) é 0, e com ela a Parcelável.
// Linhas em m² com valores digitados — são eles que a troca apagava.
const ESTUDO_LOT_SEM_POLIGONAL: Record<string, any> = {
  id: 23,
  nome: 'Render Check — Loteamento sem área de terreno',
  tipo_empreendimento: 'loteamento',
  nivel_analise: 'preliminar',
  origem_terreno: 'manual',
  terreno_manual_area: 0,
  area_app_modo: 'm2', area_app_valor: 1_200,
  area_elup_epu_modo: 'm2', area_elup_epu_valor: 400,
  area_epc_modo: 'm2', area_epc_valor: 300,
  area_viario_publico_modo: 'm2', area_viario_publico_valor: 200,
  area_viario_privado_modo: 'm2', area_viario_privado_valor: 300,
  area_comuns_privadas_modo: 'm2', area_comuns_privadas_valor: 100,
  area_verdes_modo: 'm2', area_verdes_valor: 100,
  sujeito_ret: true,
  considerar_custo_terreno: true,
  custo_terreno_m2: 120,
  infra_modo: 'valor_m2', custo_infra_m2: 400,
};

export const caso = {
  nome: 'cascata-areas-loteamento-sem-poligonal',
  exigir: [
    { seletor: 'table.areas .area-seletor', minimo: 7 },
    // Em cada uma das 7 linhas editáveis, o badge "% Pol." fica bloqueado; nas
    // que oferecem "% Parc.", esse também. 7 é o piso.
    { seletor: 'table.areas .area-seletor urbi-badge.cu-badge-dis', minimo: 7 },
    // O motivo visível abaixo da tabela.
    { seletor: 'p.area-aviso-ancora', minimo: 1 },
  ],
  // Mesmas props não reproduzidas de `cascata-areas-loteamento-deficit.ts`.
  // O banner de área negativa também aparece aqui: com a poligonal em 0, as
  // deduções digitadas estouram a cascata.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-input.label',
    'urbi-seletor-arquivo.texto',
    'urbi-seletor-arquivo.accept',
    'urbi-botao.variante',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-badge.ativo',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_LOT_SEM_POLIGONAL,
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

// Render da aba Gráficos de um estudo de LOTEAMENTO — #574.
//
// ⚠️ POR QUE ESTE CASO EXISTE. Até ele, os 27 casos de render deste
// repositório montavam estudos de INCORPORAÇÃO — `casos/dados.ts` declara
// `tipo_empreendimento: 'incorporacao'` e todos os outros derivam dele. Todo
// ramo `if (lot)` de tela (a cascata de áreas de Premissas, o KPI "Vendável /
// gleba", o campo único de permuta física, esta cadeia de áreas) nunca tinha
// sido montado em DOM nenhum. Este é o primeiro.
//
// ⚠️ E O QUE ELE NÃO MEDE. Quem confere os VALORES de cada estágio da cadeia
// (poligonal→parcelável→líquida→ALV) é `frontend/areas-cascata.test.ts`
// (`calcularCascata`/`etapasCadeiaAreas`, função pura); quem confere que o
// componente a chama é `frontend/tela-graficos.test.ts` (fiação lida no
// código-fonte). Este caso mede o que só o DOM sabe: que a aba de um
// Loteamento monta inteira, sem transbordo, sem sobreposição e com todos os
// tokens resolvendo nas quatro variantes de tema.

import '../../tela-graficos.js';
import { forcarEstado } from './dados.js';

/**
 * Loteamento de 90.402,31 m² com a cascata de áreas preenchida em m² — os
 * mesmos números do golden case "MACEDO REV 10" de
 * `frontend/areas-cascata.test.ts`, para as duas camadas descreverem o mesmo
 * empreendimento.
 *
 * Os 7 campos "% da gleba" aposentados pela migração `020` ficam de fora de
 * propósito: é assim que nasce um loteamento criado depois da reestruturação
 * do Preliminar, e era exatamente essa a condição em que a pizza antiga saía
 * com uma fatia só.
 */
const ESTUDO_LOTEAMENTO: Record<string, any> = {
  id: 21,
  nome: 'Render Check — Loteamento',
  tipo_empreendimento: 'loteamento',
  nivel_analise: 'preliminar',
  origem_terreno: 'manual',
  terreno_manual_area: 90_402.31,
  area_app_modo: 'm2', area_app_valor: 8_613.82,
  area_elup_epu_modo: 'm2', area_elup_epu_valor: 8_219.72,
  area_epc_modo: 'm2', area_epc_valor: 4_841.44,
  area_viario_publico_modo: 'm2', area_viario_publico_valor: 6_404.00,
  area_viario_privado_modo: 'm2', area_viario_privado_valor: 11_534.12,
  area_comuns_privadas_modo: 'm2', area_comuns_privadas_valor: 1_200.00,
  area_verdes_modo: 'm2', area_verdes_valor: 2_400.00,
  sujeito_ret: true,
  imposto_percentual: 4,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  considerar_custo_terreno: true,
  custo_terreno_m2: 120,
  projetos_modo: 'pct_vgv', projetos_pct: 2,
  infra_modo: 'pct_vgv', infra_pct: 30,
  manutencao_pct: 1,
  contingencias_pct: 2,
  stand_vendas_valor: 450_000,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

/** Catálogo de Produtos — a fonte do VGV desde a #563 (sem ele, estado vazio). */
const PRODUTOS_LOTEAMENTO: Record<string, any>[] = [
  { id: 1, nome: 'Lote padrão', ordem: 0, area_media_m2: 300, preco_venda_m2: 1_000, unidades: 130 },
];

export const caso = {
  nome: 'alocacao-areas-loteamento',
  exigir: [
    // Faixa de KPIs · Cascata do resultado · Cadeia de áreas da gleba.
    { seletor: 'urbi-card', minimo: 2 },
    // Cadeia de áreas da gleba. Um `urbi-estado-vazio` no lugar dela derruba
    // a contagem — é o que pega a tela montada com o estudo sem áreas.
    { seletor: 'viab-grafico-cadeia-areas', minimo: 1 },
    // Rodada 12 — a cascata do resultado substituiu a pizza de custos e o
    // gráfico de barras Receita×Custos (achado 2.3 da auditoria).
    { seletor: 'viab-grafico-cascata', minimo: 1 },
    // Faixa de consistência (handoff §4.5) — este fixture cai no ramo
    // "sobra" (ver `aceitaNaoReproduzido` abaixo). Sem esta linha, apagar a
    // chamada a `_renderConsistencia()` só seria pego indiretamente (a
    // declaração de `urbi-banner.variante` viraria "ociosa") — achado da
    // revisão nativa (L3, PR #707): a asserção direta é mais robusta.
    { seletor: 'urbi-banner', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    // Rodada 12 (handoff §4.5) — a ALV deste fixture (47.189,21 m², cascata
    // de áreas) é maior que a área do único produto cadastrado (300×130 =
    // 39.000 m²), então `diferencaAreaAlocada` < 0 e a faixa de consistência
    // desenha o `urbi-banner` de "ainda faltam alocar".
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `tela-graficos.ts` busca benchmarks, config e o catálogo de Produtos no
    // `_init()`. Sem o catálogo o estudo fica sem receita modelada e a aba
    // inteira desenha outro cenário — ver `casos/medidores-graficos.ts`, que
    // faz o mesmo desvio pela mesma razão.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_LOTEAMENTO };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO_LOTEAMENTO });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

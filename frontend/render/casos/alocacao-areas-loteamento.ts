// Render da aba Gráficos de um estudo de LOTEAMENTO — #574.
//
// ⚠️ POR QUE ESTE CASO EXISTE. Até ele, os 27 casos de render deste
// repositório montavam estudos de INCORPORAÇÃO — `casos/dados.ts` declara
// `tipo_empreendimento: 'incorporacao'` e todos os outros derivam dele. Todo
// ramo `if (lot)` de tela (a cascata de áreas de Premissas, o KPI "Vendável /
// gleba", o campo único de permuta física, esta pizza) nunca tinha sido
// montado em DOM nenhum. Este é o primeiro.
//
// ⚠️ E O QUE ELE NÃO MEDE. O stub do harness não reproduz `.categorias` de
// `urbi-grafico-pizza` (ver `aceitaNaoReproduzido` abaixo), então nenhum caso
// de render consegue afirmar QUAIS fatias a pizza recebeu. Quem confere os
// valores das 8 fatias é `frontend/areas-cascata.test.ts`
// (`itensAlocacaoGleba`, função pura); quem confere que o componente a chama é
// `frontend/tela-graficos.test.ts` (fiação lida no código-fonte). Este caso
// mede o que só o DOM sabe: que a aba de um Loteamento monta inteira, sem
// transbordo, sem sobreposição e com todos os tokens resolvendo nas quatro
// variantes de tema.

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
    // Composição dos custos · Receita × Custos · Alocação de áreas da gleba.
    // O Loteamento tem UM card de alocação (a Incorporação tem dois: geral e
    // macro) — 3 cards é o número certo desta tela, e 4 denunciaria o ramo
    // errado montado.
    { seletor: 'urbi-card', minimo: 3 },
    // Pizza de custos + pizza da gleba. Um `urbi-estado-vazio` no lugar de
    // qualquer uma delas derruba a contagem — é o que pega a tela montada com
    // o estudo sem áreas ou sem catálogo.
    { seletor: 'urbi-grafico-pizza', minimo: 2 },
    { seletor: 'urbi-grafico-colunas', minimo: 1 },
    { seletor: 'urbi-kpi', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-checkbox.label',
    'urbi-grafico-colunas.categorias',
    'urbi-grafico-colunas.empilhado',
    'urbi-grafico-colunas.formato',
    'urbi-grafico-colunas.legenda',
    'urbi-grafico-colunas.series',
    'urbi-grafico-pizza.categorias',
    'urbi-grafico-pizza.formato',
    'urbi-grafico-pizza.series',
    'urbi-kpi.variante',
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

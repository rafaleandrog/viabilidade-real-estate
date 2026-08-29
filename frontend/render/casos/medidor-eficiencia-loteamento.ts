// Render do medidor de EFICIÊNCIA DE APROVEITAMENTO — aba Gráficos de um
// estudo de LOTEAMENTO (#613, critério de aceite 3).
//
// ⚠️ O QUE SÓ ESTE CASO MEDE, E POR QUE OS OUTROS NÃO BASTAM.
//
// `resolverIndicadoresBenchmark` reconhecer `eficiencia_aproveitamento` está
// testado como função pura em `benchmarks-indicadores.test.ts` — com um objeto
// de valores que o PRÓPRIO teste monta. Isso deixa intacto o buraco que
// interessa: o campo é opcional no tipo do parâmetro (`Partial<Record<…>>`),
// então `tela-graficos.ts` pode simplesmente não pô-lo no objeto que passa, e
// nem o typecheck nem um único teste de lógica pura fica vermelho. O medidor
// some da tela em silêncio. É a classe 1 do `CLAUDE.md`: o defeito mora na
// FIAÇÃO, não no cálculo.
//
// `casos/medidores-graficos.ts` também não cobre: ele monta uma INCORPORAÇÃO,
// e a eficiência de aproveitamento é o único benchmark exclusivo do Loteamento
// (`backend/rotas/benchmarks.ts`, `benchmarksPadrao`) — a semente nem cria o
// campo para o outro tipo.
//
// A ASSERÇÃO é o piso de CINCO medidores. Um Loteamento com os benchmarks
// semeados tem exatamente 5 indicadores exibíveis (os 4 comuns + o dele);
// apagar a linha `eficiencia_aproveitamento:` de `_renderMedidores` derruba a
// contagem para 4 e reprova este caso. É a única camada deste repositório que
// enxerga "o componente não chamou".

import '../../tela-graficos.js';
import { forcarEstado } from './dados.js';

/**
 * O MESMO loteamento de `casos/alocacao-areas-loteamento.ts` — gleba de
 * 90.402,31 m² com a cascata de áreas preenchida em m², os números do golden
 * case "MACEDO REV 10" de `frontend/areas-cascata.test.ts`.
 *
 * Reusar o fixture é deliberado: os dois casos montam a MESMA aba do MESMO
 * tipo de estudo, e um segundo loteamento inventado só acrescentaria números
 * para conferir sem acrescentar cobertura.
 */
const ESTUDO_LOTEAMENTO: Record<string, any> = {
  id: 24,
  nome: 'Render Check — Loteamento (medidores)',
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

// Os benchmarks que `benchmarksPadrao('loteamento')` semeia, com as 4 âncoras
// de medidor preenchidas. Valores do fixture, conferidos por `calcularProforma`
// e registrados no corpo do PR: `custoObrasVgvPct` = 30, `margemLiquidaPct` ≈
// 23,78, `roiPct` ≈ 35,91 e `eficienciaPct` ≈ 52,20.
//
// As âncoras deixam os CINCO valores DENTRO da escala de propósito: sem
// `foraEscala` a aba não desenha nenhum `urbi-badge`, e a contagem de medidores
// fica sendo a única variável que este caso mede. Quem cobre o aviso de fora da
// escala é `casos/medidores-graficos.ts`.
const BENCHMARKS = [
  { id: 1, campo: 'custo_obras_vgv', valor: 35, regra_comparacao: 'nao_exceder',
    medidor_min: 10, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 45 },
  { id: 2, campo: 'margem_liquida', valor: 20, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 5, medidor_faixa1_ate: 15, medidor_faixa2_ate: 25, medidor_max: 40 },
  { id: 3, campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 5, medidor_faixa1_ate: 15, medidor_faixa2_ate: 25, medidor_max: 40 },
  { id: 4, campo: 'roi', valor: 15, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 10, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 },
  // ⚠️ O CAMPO DA #613 — o exclusivo do Loteamento, com a meta de 40% da
  // semente. Sem a fiação em `_renderMedidores` ele volta para `descartados` e
  // o piso de 5 medidores abaixo reprova.
  { id: 5, campo: 'eficiencia_aproveitamento', valor: 40, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 30, medidor_faixa1_ate: 40, medidor_faixa2_ate: 50, medidor_max: 70 },
  // Semeados e DESCARTADOS, cada um pelo seu motivo — provam que os descartes
  // continuam não travando a tela nem inflando a contagem acima.
  { id: 6, campo: 'margem_bruta', valor: 30, regra_comparacao: 'atingir_ou_superar' },
  { id: 7, campo: 'preco', valor: 0, regra_comparacao: 'atingir_ou_superar' },
];

export const caso = {
  nome: 'medidor-eficiencia-loteamento',
  exigir: [
    // Composição dos custos · Receita × Custos · Alocação de áreas da gleba ·
    // Indicadores vs. benchmark.
    { seletor: 'urbi-card', minimo: 4 },
    // ⚠️ A ASSERÇÃO DA #613. Quatro indicadores comuns + a eficiência de
    // aproveitamento. Com a fiação apagada sobram 4 e o caso reprova.
    { seletor: 'urbi-grafico-medidor', minimo: 5 },
    // A aba de um Loteamento continua montando inteira ao redor do medidor
    // novo: pizza de custos + pizza da gleba, e a coluna Receita × Custos.
    { seletor: 'urbi-grafico-pizza', minimo: 2 },
    { seletor: 'urbi-grafico-colunas', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    // O espelho não desenha o ponteiro do velocímetro nem a legenda das faixas
    // por dentro — só o `:host` do primitivo. Este caso mede QUANTOS medidores
    // chegam ao DOM, não o desenho interno de cada um.
    'urbi-grafico-medidor.faixas',
    'urbi-grafico-medidor.formato',
    'urbi-grafico-medidor.max',
    'urbi-grafico-medidor.min',
    'urbi-card.titulo',
    // Props das outras seções da aba, que `viab-tela-graficos` monta inteira.
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
    // `_init()` de `tela-graficos.ts` busca benchmarks, config e o catálogo de
    // Produtos de verdade — mutar `urbiVerso.api` é o que faz os benchmarks
    // acima chegarem no lugar do `{ dados: [] }` default do espelho. Sem o
    // catálogo o estudo fica sem receita modelada e a aba desenha outro
    // cenário; mesmo desvio, pela mesma razão, de `casos/medidores-graficos.ts`.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/benchmarks')) return { dados: BENCHMARKS };
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_LOTEAMENTO };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO_LOTEAMENTO });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

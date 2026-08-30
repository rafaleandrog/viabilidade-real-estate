// #443 — Inventário rótulo → função-fonte dos indicadores de negócio (VGV,
// Margem, ROI).
//
// Decisão do autor — D-Q03, 2026-08-22: "corrigir o erro da proforma, mas
// NÃO unificar as definições". As fórmulas concorrentes continuam existindo
// (Resumo do Avançado, Proforma do Avançado, Proforma do Preliminar, Painel
// de estudos); o que muda é que cada rótulo literal exibido passa a mapear
// exatamente UMA fórmula — a régua de benchmark continua julgando um número
// que depende da tela em que o usuário está, e essa consequência foi aceita
// explicitamente (ver o corpo da issue #443).
//
// Este arquivo é o registro executável dessa regra. Toda vez que uma tela
// nova exibir um rótulo "VGV"/"Margem"/"ROI" (ou variante), a entrada
// correspondente entra aqui — é o `frontend/rotulos-indicador.test.ts` que
// confere que nenhum rótulo aparece duas vezes com fontes diferentes fora
// das exceções documentadas abaixo.
//
// ⚠️ Isto NÃO é extraído automaticamente do código-fonte (não há parser de
// AST aqui) — é um catálogo mantido à mão. O que o torna mais que decoração
// é `frontend/rotulos-indicador.test.ts`: cada entrada é conferida contra o
// texto real dos arquivos citados (`fs.readFileSync`), então reverter um
// rótulo no componente sem atualizar esta tabela quebra o teste.

export interface RotuloIndicador {
  /** Texto literal exibido ao usuário — a chave de unicidade da regra. */
  rotulo: string;
  /** Arquivo(s) onde o rótulo aparece, caminho relativo à raiz do repo. */
  arquivos: string[];
  /**
   * Identificador estável da fórmula-fonte. Duas entradas com o MESMO
   * `rotulo` precisam ter a MESMA `fonte` (exceto as listadas em
   * `ROTULOS_COM_EXCECAO_DOCUMENTADA`, abaixo).
   */
  fonte: string;
}

export const INVENTARIO_ROTULOS_INDICADOR: RotuloIndicador[] = [
  // ── Resumo do Avançado (frontend/tela-resumo.ts, _kpisAvancado) ────────
  {
    rotulo: 'VGV potencial',
    arquivos: ['frontend/tela-resumo.ts'],
    fonte: 'c.vgvTotal — grandeza 1 da taxonomia (fluxo-caixa-motor.ts:234)',
  },
  {
    rotulo: 'Margem de caixa',
    arquivos: ['frontend/tela-resumo.ts'],
    fonte: 'fluxoAcumulado[último] / vgvTotal — tela-resumo.ts:_kpisAvancado (regime de caixa)',
  },
  {
    rotulo: 'ROI sobre custo total',
    arquivos: ['frontend/tela-resumo.ts'],
    fonte: 'resultado / custoTotal — tela-resumo.ts:_kpisAvancado (custoTotal = soma de TODAS as linhas de custo)',
  },

  // ── Proforma do Avançado (frontend/proforma-avancado.ts, via tela-fluxo-ver.ts) ──
  {
    rotulo: 'Margem sobre Receita Bruta',
    arquivos: ['frontend/tela-fluxo-ver.ts'],
    fonte: 'resultado / receitaBruta — proforma-avancado.ts:margemPct, leitura "= Resultado" (sem permutas)',
  },

  // ── Proforma do Preliminar (frontend/proforma.ts, via várias telas) ────
  {
    rotulo: 'Margem sobre VGV',
    arquivos: [
      'frontend/exportar.ts',
      // #451/#453 (mergeado depois deste inventário existir, resolvido no
      // merge): tela-graficos.ts parou de ter um ROTULOS local — o rótulo
      // agora mora em benchmarks-indicadores.ts, que ela consome via
      // `resolverIndicadoresBenchmark`. tela-graficos.ts continua sendo a
      // TELA que exibe "Margem sobre VGV"; benchmarks-indicadores.ts é onde
      // o literal vive no código-fonte.
      'frontend/benchmarks-indicadores.ts',
      'frontend/tela-premissas.ts',
      'frontend/tela-proforma.ts',
    ],
    fonte: 'resultado / vgv — proforma.ts:margemLiquidaPct (Preliminar)',
  },

  // ── Eficiência de aproveitamento — exclusiva do Loteamento (#613) ──────
  //
  // O rótulo unificado. Até a #613 o mesmo número saía como "Vendável / gleba"
  // no Resumo de Premissas e como "Eficiência" no PDF/CSV; a exportação passou
  // a dizer o que a tela diz, e a entrada abaixo é o que impede a divergência
  // de voltar em silêncio (o teste de wiring confere o texto no fonte de CADA
  // arquivo citado).
  //
  // "Eficiência" bare NÃO foi o escolhido de propósito: a especificação já usa
  // esse nome para a razão área privativa / área construída da Incorporação
  // (`docs/spec/estudo-de-viabilidade-spec.md`), fórmula diferente. Adotá-lo
  // aqui criaria a colisão que esta tabela existe para acusar.
  {
    rotulo: 'Vendável / gleba',
    arquivos: [
      // Onde o literal mora no código-fonte: a tabela de rótulos de benchmark
      // (que alimenta o medidor da aba Gráficos), a exportação, o Resumo de
      // Premissas e as métricas da Proforma.
      'frontend/benchmarks-indicadores.ts',
      'frontend/exportar.ts',
      'frontend/tela-premissas.ts',
      'frontend/tela-proforma.ts',
    ],
    fonte: 'areaVendavel / areaTerreno — proforma.ts:eficienciaPct (Loteamento; null quando a gleba não foi informada, ver eficienciaParaFaixa)',
  },

  // ── Painel de estudos (frontend/tela-dashboard.ts) ──────────────────────
  {
    rotulo: 'ROI',
    arquivos: ['frontend/tela-dashboard.ts'],
    // A MESMA fórmula nos dois níveis — por isso não precisa de exceção:
    // proforma.ts:320 e proforma-avancado.ts:320 calculam ambas
    // `resultado / (custoDireto + custoIndireto)`.
    fonte: 'resultado / investimentoTotal — mesma fórmula nos dois níveis (proforma.ts e proforma-avancado.ts)',
  },
];

/**
 * Exceções documentadas ao "um rótulo, uma fórmula": colunas do Painel de
 * estudos (`frontend/tela-dashboard.ts`) que precisam mostrar Preliminar e
 * Avançado lado a lado na MESMA coluna, e cujas fórmulas DIVERGEM entre os
 * dois níveis (issue #443, itens 2 e 6 — "o caso que a saída (b) não resolve
 * sozinha"). Colapsar as duas na mesma grandeza moveria o número de um dos
 * dois níveis, fora do escopo desta issue ("sem unificar as definições").
 *
 * Decisão registrada aqui (D-Q03, 2026-08-22): rótulo genérico + atributo
 * `title` (tooltip nativo) por LINHA da tabela, dizendo qual fórmula está
 * ativa — implementado em `frontend/tela-dashboard.ts:_colunas` (`numeroTitulo`).
 *
 * Cada entrada é travada nas DUAS fontes já conhecidas — uma TERCEIRA fonte
 * nova para o mesmo rótulo ainda derruba o teste de unicidade.
 */
export const ROTULOS_COM_EXCECAO_DOCUMENTADA: Record<string, [string, string]> = {
  VGV: [
    'p.vgv — proforma.ts (VGV nominal, soma dos preços das unidades) — linha Preliminar',
    'p.vgv — proforma-avancado.ts (= receitaBruta, grandeza 6) — linha Avançado',
  ],
  Margem: [
    'p.margemLiquidaPct — proforma.ts (resultado / VGV nominal) — linha Preliminar',
    'p.margemPct — proforma-avancado.ts (resultado / receitaBruta) — linha Avançado',
  ],
};

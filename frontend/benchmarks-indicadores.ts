// #451: tabela ÚNICA de benchmark → indicador, compartilhada entre as duas
// telas que desenham medidor (tela-graficos.ts, o Preliminar; tela-resumo.ts,
// o Avançado). É uma tabela de NOMES (rótulo, e quais campos têm indicador
// correspondente hoje) — não de VALORES: os dois `MAPA` leem fontes
// diferentes (`Proforma` no Preliminar, `_kpisAvancado`/`FluxoCalc` no
// Avançado), e cada tela continua resolvendo o número na sua própria fonte.
// Unificar os valores seria a alternativa (a) recusada pela D-Q03 (#443).
//
// Antes desta tabela, cada tela tinha seu próprio `MAPA`/`ROTULOS`
// hardcoded com só 2 dos 9 campos configuráveis (`custo_obras_vgv`,
// `margem_liquida`) — os outros 7 eram descartados em silêncio por um
// `.filter((m) => m !== null)` que não distingue "sem indicador" de "campo
// desconhecido".

/** Os 4 campos com indicador de RESULTADO calculado pelo app hoje. */
export const INDICADORES_SUPORTADOS = ['custo_obras_vgv', 'margem_liquida', 'resultado_final', 'roi'] as const;
export type IndicadorSuportado = typeof INDICADORES_SUPORTADOS[number];

/**
 * Rótulo de tela.
 *
 * ⚠️ #443 (mergeado depois desta tabela existir, resolvido no merge): esta
 * tabela hoje só alimenta `tela-graficos.ts` (o medidor do Preliminar) — a
 * doc-string original dizia "mesmo texto nas duas telas", mas
 * `tela-resumo.ts` (o medidor do Avançado) NÃO importa este módulo; ele
 * mantém seu próprio mapa local, com "Margem de caixa" em vez de
 * "Margem sobre VGV" — são fórmulas diferentes (`resultado/vgv` aqui,
 * `fluxoAcumulado[último]/vgvTotal` lá) e não podem compartilhar rótulo. Se
 * um dia `tela-resumo.ts` passar a importar este módulo, ele PRECISA parar
 * de usar `margem_liquida` daqui — o par (rótulo, fonte) tem que continuar
 * único, ver `frontend/rotulos-indicador.ts`.
 */
export const ROTULOS_INDICADOR: Record<IndicadorSuportado, string> = {
  // "Custo obras / VGV" (plural) — mesmo rótulo usado em exportar.ts, tela-premissas.ts e tela-proforma.ts (#183).
  custo_obras_vgv: 'Custo obras / VGV',
  // #443: "Margem sobre VGV" — este indicador só alimenta o Preliminar
  // (`resultado/vgv`, ver acima); não confundir com "Margem de caixa" do
  // Avançado (`tela-resumo.ts`) nem "Margem sobre Receita Bruta" da
  // Proforma do Avançado (`proforma-avancado.ts`).
  margem_liquida: 'Margem sobre VGV',
  resultado_final: 'Resultado final',
  roi: 'ROI',
};

// backend/rotas/benchmarks.ts:34-37 declara estes 4 como indicadores de
// SENSIBILIDADE (as variáveis estressadas na Análise de Sensibilidade da
// Proforma): não têm meta nem faixa, `valor`/`regra_comparacao` não se
// aplicam. Não é "decidir se entram" — já não entram, por construção; o que
// falta é registrar o motivo em vez de descartar em silêncio.
const CAMPOS_SENSIBILIDADE = new Set(['custo_obras', 'preco', 'permuta_fisica', 'permuta_financeira']);

// #453: o campo que calculava "margem bruta" media receita líquida / VGV —
// não é margem, e foi renomeado. Enquanto não existir um indicador de margem
// bruta de verdade, o benchmark `margem_bruta` fica declaradamente sem fonte.
const MARGEM_BRUTA_SEM_FONTE_MOTIVO = 'sem indicador correspondente até existir margem bruta de verdade (#453)';
const SENSIBILIDADE_MOTIVO = 'indicador de sensibilidade, sem meta';
const SEM_INDICADOR_MOTIVO = 'sem indicador correspondente';

export interface BenchmarkCampo { campo: string; [k: string]: unknown; }
export interface DescartadoBenchmark { campo: string; motivo: string; }
export interface MedidorResolvido<B extends BenchmarkCampo> { benchmark: B; campo: IndicadorSuportado; rotulo: string; valor: number; }
export interface ResolucaoMedidores<B extends BenchmarkCampo> {
  exibiveis: MedidorResolvido<B>[];
  descartados: DescartadoBenchmark[];
}

/**
 * Cruza a lista de benchmarks configurados com os valores que a tela já
 * calculou (`valores`, indicador → número). Devolve os que têm indicador
 * correspondente E os descartados COM MOTIVO — a lista de descartados é o
 * que distingue este resolvedor de um `.filter` que engole tudo em silêncio.
 */
export function resolverIndicadoresBenchmark<B extends BenchmarkCampo>(
  benchmarks: B[],
  valores: Partial<Record<IndicadorSuportado, number>>,
): ResolucaoMedidores<B> {
  const exibiveis: MedidorResolvido<B>[] = [];
  const descartados: DescartadoBenchmark[] = [];
  for (const b of benchmarks) {
    const campo = b.campo;
    if ((INDICADORES_SUPORTADOS as readonly string[]).includes(campo) && valores[campo as IndicadorSuportado] !== undefined) {
      exibiveis.push({
        benchmark: b,
        campo: campo as IndicadorSuportado,
        rotulo: ROTULOS_INDICADOR[campo as IndicadorSuportado],
        valor: valores[campo as IndicadorSuportado]!,
      });
      continue;
    }
    let motivo = SEM_INDICADOR_MOTIVO;
    if (campo === 'margem_bruta') motivo = MARGEM_BRUTA_SEM_FONTE_MOTIVO;
    else if (CAMPOS_SENSIBILIDADE.has(campo)) motivo = SENSIBILIDADE_MOTIVO;
    descartados.push({ campo, motivo });
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[benchmarks] "${campo}" descartado do medidor: ${motivo}`);
    }
  }
  return { exibiveis, descartados };
}

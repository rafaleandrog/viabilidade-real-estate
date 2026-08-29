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

/**
 * Os 5 campos com indicador de RESULTADO calculado pelo app hoje.
 *
 * ⚠️ "Suportado" é uma propriedade do CAMPO, não da tela. `eficiencia_aproveitamento`
 * (#613) entrou aqui porque o app calcula o número (`eficienciaPct`,
 * `frontend/proforma.ts`), e é o Preliminar (`tela-graficos.ts`) quem o
 * fornece; o Avançado (`tela-resumo.ts`) não tem essa grandeza no
 * `_kpisAvancado` e simplesmente não passa o valor. Quem separa os dois casos
 * é `resolverIndicadoresBenchmark`, no motivo do descarte — ver
 * `SEM_VALOR_NESTA_TELA_MOTIVO`.
 */
export const INDICADORES_SUPORTADOS = [
  'custo_obras_vgv', 'margem_liquida', 'resultado_final', 'roi', 'eficiencia_aproveitamento',
] as const;
export type IndicadorSuportado = typeof INDICADORES_SUPORTADOS[number];

/**
 * Rótulo de tela.
 *
 * ⚠️ #443: o par (rótulo, fórmula-fonte) tem que ser único no app inteiro —
 * o inventário é `frontend/rotulos-indicador.ts`, conferido por teste. As
 * DUAS telas de medidor importam esta tabela (`tela-graficos.ts`, o
 * Preliminar; `tela-resumo.ts`, o Avançado), mas ela é de NOMES, não de
 * VALORES: cada uma resolve o número na sua própria fonte (`Proforma` lá,
 * `_kpisAvancado`/`FluxoCalc` cá). Unificar os valores é a alternativa (a)
 * recusada pela D-Q03 (#443).
 *
 * Consequência viva disso: `tela-resumo.ts` NÃO usa os rótulos de
 * `margem_liquida` e `roi` daqui — as fórmulas do Avançado são outras
 * ("Margem de caixa" = `fluxoAcumulado[último]/vgvTotal`; "ROI sobre custo
 * total" = `resultado/custoTotal`), e reusar o texto do Preliminar reabriria
 * a colisão que a #443 fechou. Ele sobrescreve os dois no seu
 * `ROTULO_OVERRIDE` local. Rótulo novo que entre aqui e já exista no Avançado
 * com outra fórmula precisa do mesmo tratamento.
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
  // #613 — o rótulo ÚNICO da eficiência de aproveitamento, o indicador
  // exclusivo do Loteamento (`areaVendavel / areaTerreno`). Antes o mesmo
  // número tinha dois nomes: "Vendável / gleba" no Resumo de Premissas e
  // "Eficiência" no PDF/CSV; a exportação passou a dizer o mesmo que a tela.
  //
  // Por que "Vendável / gleba" e não "Eficiência": o texto nomeia a fórmula, e
  // "Eficiência" sozinho já designa OUTRA razão na especificação (área
  // privativa / área construída, a eficiência de projeto da Incorporação —
  // `docs/spec/estudo-de-viabilidade-spec.md`). Adotá-lo aqui plantaria a
  // colisão rótulo↔fórmula que `frontend/rotulos-indicador.ts` existe para
  // impedir, no dia em que a Incorporação ganhar a dela.
  eficiencia_aproveitamento: 'Vendável / gleba',
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
// #613: o campo É suportado (está em `INDICADORES_SUPORTADOS`), mas a tela da
// vez não passou valor para ele. É o caso de `eficiencia_aproveitamento` no
// Resumo do Avançado: a grandeza existe no app, só não no `_kpisAvancado`.
//
// ⚠️ Antes da #613 este ramo era INALCANÇÁVEL — as duas telas de medidor
// passavam os 4 campos suportados, então "suportado sem valor" nunca
// acontecia e cair no motivo genérico não custava nada. Com um 5º campo que
// só o Preliminar fornece, ele passa a acontecer toda vez que um Loteamento
// Avançado tem o benchmark configurado, e "sem indicador correspondente"
// viraria mentira no `console.warn`: manda procurar um indicador que existe.
export const SEM_VALOR_NESTA_TELA_MOTIVO = 'indicador existe, mas esta tela não calcula o valor';

export interface BenchmarkCampo { campo: string; [k: string]: unknown; }
export interface DescartadoBenchmark { campo: string; motivo: string; }
// #571: `valor` aceita `null` — o indicador tem fonte configurada, mas o
// denominador ficou inválido (ex.: VGV ≤ 0) nesta leitura. Continua
// "exibível" (a tela decide o que fazer com um valor indefinido — tipicamente
// não desenhar o medidor, via `montarMedidor` também null-seguro); é
// diferente de "sem indicador correspondente" (`descartados`, abaixo), que é
// sobre o CAMPO não ter fonte nenhuma, não sobre o valor da vez.
export interface MedidorResolvido<B extends BenchmarkCampo> { benchmark: B; campo: IndicadorSuportado; rotulo: string; valor: number | null; }
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
  valores: Partial<Record<IndicadorSuportado, number | null>>,
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
    else if ((INDICADORES_SUPORTADOS as readonly string[]).includes(campo)) motivo = SEM_VALOR_NESTA_TELA_MOTIVO;
    descartados.push({ campo, motivo });
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[benchmarks] "${campo}" descartado do medidor: ${motivo}`);
    }
  }
  return { exibiveis, descartados };
}

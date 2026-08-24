// Catraca de regressão dos 4 KPIs do Avançado — Resultado, Margem, ROI e TIR.
//
// ⚠️ ESTE ARQUIVO NÃO É UM ORÁCULO, E CONFUNDIR ISSO DESTRUIRIA A CATRACA.
// O vizinho `calliandra-golden.ts` **reimplementa** a matemática de propósito,
// para confrontar o motor com uma segunda opinião. Aqui é o oposto: estas
// fixtures **chamam o motor real** (`calcularFluxo` + `proformaAvancado` +
// `fundingDoEstudo`) e congelam a saída dele.
//
// Por isso vale a regra da #468, e ela é dura: **nada de aritmética de negócio
// neste arquivo.** Sem `pmt`, sem taxa equivalente, sem reimplementar rateio.
// Uma catraca que reimplementa o motor não vigia nada — ela fica verde
// enquanto os dois estiverem errados juntos. O que existe aqui é: entradas, e
// os quatro números que o motor produz hoje.
//
// ⚠️ OS ESPERADOS REGISTRAM O *HOJE*, INCLUSIVE ONDE O HOJE ESTÁ ERRADO.
// A margem do caso `C` sai negativa porque a proforma soma o principal da
// dívida como custo (`proforma-avancado.ts:92-93`) — que é justamente o
// defeito da #426. **Não "conserte" o número aqui**: quem muda é o PR da
// issue, e o diff desta fixture é a evidência de que ele mudou o que disse
// que mudaria, e só isso.
//
// De onde vem cada KPI (a #468 corrigiu dois símbolos que não existiam):
//
//   Resultado  proformaAvancado(...).resultado    monetário, round2 pelo motor
//   Margem     proformaAvancado(...).margemPct    derivada, precisão plena (C7)
//   ROI        proformaAvancado(...).roiPct       derivada, precisão plena (C7)
//   TIR        calcularFluxo(...).tir             `number | null`, NÃO é da proforma
//
// `margemLiquidaPct` **não existe** em `ProformaAvancado` — é campo da
// `Proforma` do Preliminar. E `tir` vem de `FluxoCalc`, não da proforma.

import { calcularFluxo, type FluxoConfig } from '../fluxo-caixa-motor.js';
import { proformaAvancado } from '../proforma-avancado.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal,
  type OperacaoFunding,
} from '../funding-motor.js';
import { mesRepasse, areaPrivativaTotalLinhas, type EventoCrono } from '../fluxo-shared.js';

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

// ⚠️ Definido AQUI, e não importado de `fluxo-apresentacao.test.ts`.
// O `CONFIG_COMPLETA` de lá é `const` local **não exportada** (`:137`): copiá-lo
// criaria uma segunda cópia que envelhece sozinha, e a catraca passaria a vigiar
// um estudo que ninguém mais mantém.
const BASE: FluxoConfig = {
  dataInicio: 'jan/2027',
  taxaDescontoAa: 12,
  cronograma: CRONO,
  areaTerreno: 0,
  linhasReceita: [{
    id: 1, nome: 'Grupo Residencial', fase_label: 'Torre A',
    tipologias: [
      { id: 11, nome: 'Dois quartos', quantidade: 6, area_privativa_m2: 100, preco_m2: 10_000 },
      { id: 12, nome: 'Três quartos', quantidade: 4, area_privativa_m2: 100, preco_m2: 10_000 },
    ],
    absorcao: { modo: 'distribuido', blocos: [
      { evento: 'pre_lancamento', pct: 10 },
      { evento: 'lancamento', pct: 20 },
      { evento: 'obra', pct: 40 },
      { evento: 'pos_obra', pct: 0 },
    ] },
    fluxo_pagamento: { componentes: [
      { tipo: 'imediato', participacaoPct: 20, descontoPct: 0, rotulo: 'Entrada' },
      { tipo: 'ate_marco', participacaoPct: 30, sinalPct: 0, marcoMes: 40,
        defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'Durante a obra' },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
    ] },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 2_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
    { id: 3, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 5, orcamento_unidade: 'pct_vgv' },
    { id: 4, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 500_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
    { id: 5, grupo: 'financeiro', categoria: 'Taxas bancárias', orcamento_valor: 100_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
  ],
};

/**
 * O que a catraca vigia.
 *
 * ⚠️ **Os quatro primeiros são DESALAVANCADOS por contrato**, e isso não é
 * detalhe: `funding-motor.ts:650-653` declara que *"as KPIs do projeto
 * continuam desalavancadas (§8.1) — TIR/VPL/Payback/Exposição seguem lendo
 * `calcularFluxo`. Só o rodapé da tabela alavanca"*.
 *
 * A consequência foi medida e é dura: **hoje** `resultado`/`margemPct`/`roiPct`
 * parecem enxergar funding, mas só o fazem **através do defeito da #426** — a
 * proforma soma o principal da dívida como custo. Assim que a #426 entrar, os
 * casos A, B e C ficam **bit-idênticos** nos quatro. Medido: os doze números
 * convergem.
 *
 * Por isso os três últimos campos existem. Eles leem `FundingNoFluxo`, que é o
 * **rodapé alavancado** da tabela — a única superfície exibida que enxerga
 * funding —, e são o que mantém a catraca viva depois da #426.
 */
export interface KpisBaseline {
  // ── desalavancados (proforma + motor) ──
  resultado: number;
  margemPct: number;
  roiPct: number;
  /** `null` quando o fluxo não inverte de sinal — estudo sem TIR definida. */
  tir: number | null;
  // ── alavancados (rodapé da tabela) — `null` em estudo sem funding ──
  /** Último mês de `FundingNoFluxo.fluxoAcumulado`: o caixa final ALAVANCADO. */
  caixaFinalAlavancado: number | null;
  /** `Σ VPL(entradas) − Σ VPL(saídas)` — `FundingNoFluxo.vplLiquido`. */
  vplLiquidoFunding: number | null;
  /** `Σ FundingNoFluxo.saidas` — o serviço da dívida que o estudo paga. */
  fundingSaidas: number | null;
}

export interface CasoBaseline {
  /** Chave curta, usada no nome do teste. */
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  titulo: string;
  /** Qual issue da cadeia este caso vigia — se nenhuma, o caso é enfeite. */
  vigia: string;
  config: FluxoConfig;
  operacoes: OperacaoFunding[];
  esperado: KpisBaseline;
}

// ── as quatro configurações ─────────────────────────────────────────────────

/** `A` — incorporação simples, sem funding nenhum. É o CONTROLE. */
const CONFIG_A: FluxoConfig = BASE;

/** `B` — com financiamento à produção sobre a linha de Obra. */
const OPS_B: OperacaoFunding[] = [{
  id: 'b1', tipo: 'financiamento_producao', nome: 'FP obra',
  valor: 0, inicio_mes: 0, taxa_anual: 12,
  exposicao_minima: 20, percentual_financiavel: 80,
  amortizar_com_caixa_disponivel: true,
}];

/** `C` — dívida + equity + financiamento à produção, que é onde o sweep cega. */
const OPS_C: OperacaoFunding[] = [
  ...OPS_B,
  { id: 'c1', tipo: 'divida', nome: 'Capital de giro', valor: 1_500_000, inicio_mes: 0,
    taxa_anual: 18, periodo_amortizacao_meses: 24, periodo_carencia_meses: 6 },
  { id: 'c2', tipo: 'equity', nome: 'Investidor', valor: 2_000_000, inicio_mes: 0,
    modo_retorno: 'resultado_final', pct_retorno: 20 },
];

/**
 * `D` — juros de tabela (`taxaMensal ≠ 0`) e absorção `personalizado`.
 *
 * ⚠️ Este par de dados a UI de hoje **não sabe escrever**, e isso é o valor do
 * caso, não um defeito dele: ele congela exatamente o comportamento que a #431
 * vai preservar (o modal para de reescrever) e que a #428 vai tornar editável.
 */
const CONFIG_D: FluxoConfig = {
  ...BASE,
  ret: { ativo: true, pct: 4 },
  linhasReceita: [{
    ...BASE.linhasReceita[0],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 80 }, { mes: 41, pct: 20 }] },
    fluxo_pagamento: { componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 5, rotulo: 'À vista' },
      { tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 12,
        defasagemMeses: 1, taxaMensal: 0.0098636, jurosNoMesDaContratacao: false, rotulo: 'Curta' },
      { tipo: 'ate_marco', participacaoPct: 20, sinalPct: 0, marcoMes: 40,
        defasagemMeses: 1, taxaMensal: 0.0098636, jurosNoMesDaContratacao: false, rotulo: 'Longa' },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
    ] },
  }],
};

/**
 * Roda o motor real para um caso e devolve os quatro KPIs.
 *
 * ⚠️ Esta função é **fiação**, não conta: ela só encadeia `calcularFluxo` →
 * `fundingDoEstudo` → `proformaAvancado` na mesma ordem que a tela de Funding
 * usa (`tela-dashboard.ts:267-285`). Se ela reproduzisse a matemática, o teste
 * pararia de vigiar o motor e passaria a vigiar a si mesmo.
 */
export function kpisDoCaso(config: FluxoConfig, operacoes: OperacaoFunding[]): KpisBaseline {
  const c = calcularFluxo(config);
  const areaPrivativa = areaPrivativaTotalLinhas(config.linhasReceita ?? []);
  let funding = null;
  if (operacoes.length > 0) {
    const receitaLiquida = receitaLiquidaComCorretagemMensal(
      c.receitaMensal, c.linhasCusto, config.linhasCusto ?? [],
    );
    const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
    const fc = fundingDoEstudo(
      operacoes, c.fluxoMensal, receitaLiquida, resultadoFinal,
      mesRepasse(config.cronograma ?? []), config.taxaDescontoAa,
      { custosRaw: config.linhasCusto ?? [], linhasCusto: c.linhasCusto, cronograma: config.cronograma ?? [] },
    );
    funding = fc?.noFluxo ?? null;
  }
  // #426: a proforma passou a ser DESALAVANCADA e não aceita mais `funding`.
  // O `funding` continua sendo calculado acima porque os três KPIs alavancados
  // saem dele — é justamente o que impede a catraca de cegar com este conserto.
  const p = proformaAvancado(c, areaPrivativa);
  const soma = (xs: number[] | undefined) => (xs ?? []).reduce((t, v) => t + v, 0);
  return {
    resultado: p.resultado, margemPct: p.margemPct, roiPct: p.roiPct, tir: c.tir,
    caixaFinalAlavancado: funding ? (funding.fluxoAcumulado[funding.fluxoAcumulado.length - 1] ?? 0) : null,
    vplLiquidoFunding: funding ? funding.vplLiquido : null,
    fundingSaidas: funding ? soma(funding.saidas) : null,
  };
}

// ── os esperados ────────────────────────────────────────────────────────────
//
// ⚠️ CAPTURADOS DA `main` INTOCADA. Substituí-los é a maneira de um PR da
// cadeia DECLARAR que moveu um KPI — e o diff aqui é a prova. Um PR que os
// mude sem dizer é o caso que esta fixture existe para pegar.
//
// ⚠️ DOIS FATOS QUE SÓ APARECERAM AO CAPTURAR, E QUE MUDAM O QUE A CATRACA PEGA:
//
// 1. **A TIR não enxerga funding.** `FluxoCalc.tir` sai de `tirFluxo(fluxoMensal)`,
//    que é o fluxo DESALAVANCADO — o funding é costurado depois, na tela. Por
//    isso A, B e C têm a MESMA TIR (31,018…%) apesar de estruturas de capital
//    completamente diferentes. Consequência prática: a TIR **não vigia** #426,
//    #434, #432 nem #435; ela vigia só o lado da receita (#431, #428, #429), e
//    é o caso `D` que a exercita (38,756%). A #468 lista a TIR entre os quatro
//    KPIs que as cinco mudanças movem — para as de funding, isso não se
//    verifica no símbolo exposto hoje.
//
// 2. **Depois da #426, os DESALAVANCADOS de A, B e C são idênticos** — e isso é
//    a invariante do conserto, não perda de cobertura. Antes dela, B e C tinham
//    margem NEGATIVA (−7,52% e −33,63%) contra +39% do MESMO projeto sem
//    funding, porque a proforma somava o principal da dívida como custo. Com o
//    conserto, a proforma deixa de olhar a estrutura de capital, e é isso que
//    ela tem de fazer. Quem continua distinguindo B de C são os ALAVANCADOS.

/**
 * `E` — equity em `permuta_financeira` sobre receita líquida que FICA NEGATIVA.
 *
 * ⚠️ Existe por um motivo específico e medido: **sem ele a #432 é inalcançável.**
 * O conserto dela (clamp em zero + carry-forward do déficit) mora no ramo
 * `progressivo` de `funding-motor.ts`, que só executa quando
 * `modo_retorno === 'permuta_financeira'` — e o caso `C` usa `resultado_final`.
 * Pior: mesmo trocando o modo, `C` não serviria, porque a receita líquida dele
 * nunca fica negativa (mínimo medido: 0,00), e é a base negativa que dispara o
 * clamp.
 *
 * A negatividade aqui é construída com dado realista, não com número absurdo:
 * sinal de **3%** contra corretagem de **6%**. A corretagem é paga no mês da
 * venda (#121) enquanto o recebimento é diferido, então o mês da venda fecha no
 * vermelho. Medido: 4 meses negativos, mínimo −R$ 48.219,25.
 */
const CONFIG_E: FluxoConfig = {
  ...BASE,
  linhasCusto: BASE.linhasCusto.map((l) =>
    l.categoria === 'Corretagem de vendas' ? { ...l, orcamento_valor: 6 } : l),
  linhasReceita: [{
    ...BASE.linhasReceita[0],
    fluxo_pagamento: { componentes: [
      { tipo: 'imediato', participacaoPct: 3, descontoPct: 0, rotulo: 'Sinal' },
      { tipo: 'ate_marco', participacaoPct: 37, sinalPct: 0, marcoMes: 40,
        defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'Obra' },
      { tipo: 'concentrado', participacaoPct: 60, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
    ] },
  }],
};

const OPS_E: OperacaoFunding[] = [
  { id: 'e1', tipo: 'equity', nome: 'Investidor progressivo', valor: 2_000_000, inicio_mes: 0,
    modo_retorno: 'permuta_financeira', pct_retorno: 15 },
];

export const CASOS: CasoBaseline[] = [
  {
    id: 'A',
    titulo: 'incorporação simples, sem funding',
    vigia: 'CONTROLE DO LADO DE FUNDING: #426, #434, #432 e #435 NÃO podem movê-lo — '
      + 'não há funding aqui, então mudança neste caso é vazamento. Já as issues do lado '
      + 'da RECEITA (#429, #431, #428) podem movê-lo legitimamente, e movem: medido por '
      + 'mutação, tirar o 4º período da absorção derruba A, B e C juntos.',
    config: CONFIG_A, operacoes: [],
    esperado: { resultado: 3_899_999.94, margemPct: 38.99999963400001, roiPct: 63.93442524590166, tir: 31.018485354972892, caixaFinalAlavancado: null, vplLiquidoFunding: null, fundingSaidas: null },
  },
  {
    id: 'B',
    titulo: 'com financiamento à produção',
    vigia: '#426 (principal na proforma). NÃO vigia a #434: o critério de aceite 3 dela '
      + 'exige que uma operação sozinha produza série `deepEqual` à de hoje — B tem uma só, '
      + 'então ficar VERDE aqui é o comportamento correto do conserto, não cegueira.',
    config: BASE, operacoes: OPS_B,
    esperado: { resultado: 3_899_999.94, margemPct: 38.99999963400001, roiPct: 63.93442524590166, tir: 31.018485354972892, caixaFinalAlavancado: 3_247_746.82, vplLiquidoFunding: 0.01, fundingSaidas: 4_652_253.12 },
  },
  {
    id: 'C',
    titulo: 'dívida + equity + financiamento à produção',
    vigia: '#426 e #434 — é o único caso com MAIS DE UMA operação, que é a condição do '
      + 'cash sweep enxergar as outras. Medido: o conserto da #434 derruba só este caso. '
      + 'NÃO vigia #432 (equity aqui é `resultado_final`, e o clamp mora no ramo '
      + '`progressivo` — ver caso E) nem #435 (validação de rota, backend puro).',
    config: BASE, operacoes: OPS_C,
    esperado: { resultado: 3_899_999.94, margemPct: 38.99999963400001, roiPct: 63.93442524590166, tir: 31.018485354972892, caixaFinalAlavancado: 4_137_114.51, vplLiquidoFunding: 1_361_408.79, fundingSaidas: 7_262_885.43 },
  },
  {
    id: 'D',
    titulo: 'juros de tabela e absorção personalizada',
    vigia: 'É a REFERÊNCIA do lado da receita: congela o resultado de juros de tabela + '
      + 'absorção personalizada, que é o estado que a #431 tem de preservar. NÃO fica '
      + 'vermelho com o conserto de #431 nem de #428: os dois moram na camada de EDITOR '
      + '(`fluxo-pagamento-editor.ts`, `_absorcaoJson`), fora da cadeia '
      + '`calcularFluxo → fundingDoEstudo → proformaAvancado` que esta fixture percorre. '
      + 'E a #429 é diagnóstico por desenho — o item 4 dela diz "nenhum número muda".',
    config: CONFIG_D, operacoes: [],
    esperado: { resultado: 3_791_222.83, margemPct: 36.79599561118192, roiPct: 62.15119393442623, tir: 38.75601784396314, caixaFinalAlavancado: null, vplLiquidoFunding: null, fundingSaidas: null },
  },
  {
    id: 'E',
    titulo: 'equity progressivo sobre receita líquida negativa',
    vigia: '#432 (clamp em zero + carry-forward do déficit). É o ÚNICO caso que alcança '
      + 'o ramo `progressivo` do motor de equity — medido: só com A–D, o conserto da #432 '
      + 'passava 8/8 verde.',
    config: CONFIG_E, operacoes: OPS_E,
    esperado: { resultado: 3_799_999.66, margemPct: 37.99999789199993, roiPct: 61.290317096774196, tir: 26.644417484686667, caixaFinalAlavancado: 4_389_999.67, vplLiquidoFunding: 1_027_495.56, fundingSaidas: 1_409_999.99 },
  },
];

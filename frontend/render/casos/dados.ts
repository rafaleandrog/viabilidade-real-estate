// Dados de montagem dos casos de render.
//
// NÃO são fixture de número: nenhum teste de `frontend/render/` compara valor
// calculado. Existem só para as telas terem o que desenhar — o que se mede lá
// é geometria e cor, e um número diferente não muda o veredito.
//
// Por isso também são deliberadamente pequenos e fixos: nada de `Date.now()`,
// nada de aleatório, nada lido de arquivo. Render-check que dependesse do
// relógio seria a quarta vez, nesta rodada, que um teste muda de veredito
// conforme o ambiente.

import { type EventoCrono } from '../../fluxo-shared.js';
import { calcularFluxo, type FluxoCalc } from '../../fluxo-caixa-motor.js';
import { fundingDoEstudo } from '../../funding-motor.js';

export const DATA_INICIO = 'jan/2027';

export const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 13, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 37, duracao_meses: 12 },
];

const LINHA_RECEITA = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  tipologias: [{ id: 1, quantidade: 80, area_privativa_m2: 62, preco_m2: 11_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: {
    entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
    parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
    repasse: [{ pct: 30, mesesAposObra: 3 }],
  },
};

const LINHAS_CUSTO = [
  { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'À vista', orcamento_valor: 9_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
  { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 28_000_000, orcamento_unidade: 'rs', inicio_mes: 13, duracao_meses: 24 },
  { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1_400_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
  { id: 4, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 2_180_000, orcamento_unidade: 'rs', inicio_mes: 12, duracao_meses: 24 },
];

/** Um `FluxoCalc` de verdade, saído do motor de verdade. */
export function fluxo(): FluxoCalc {
  return calcularFluxo({
    dataInicio: DATA_INICIO,
    taxaDescontoAa: 12,
    cronograma: CRONO,
    linhasReceita: [LINHA_RECEITA],
    linhasCusto: LINHAS_CUSTO,
    curvas: [],
    areaTerreno: 4_800,
    ret: { ativo: true, pct: 4 },
  });
}

export const RECEITAS = [LINHA_RECEITA];
export const CUSTOS = LINHAS_CUSTO;

/**
 * Variante de `fluxo()` com valores de 9 dígitos, positivos e negativos — o
 * fixture de STRESS da #579 ("o VALOR salta para fora do quadro do KPI").
 *
 * NÃO é fixture de número (mesma ressalva do topo deste arquivo): nenhum caso
 * que usa esta função audita consistência aritmética entre os campos — ela
 * sobrescreve só os campos que os cards de KPI leem para exibir (`vpl`,
 * `exposicaoMaxima`, `vgvTotal`, `fluxoAcumulado` — a base de "Resultado" em
 * `tela-resumo.ts`/`fluxo-tabela.ts` —, `jurosClientes`, `carteiraClientesMaxima`,
 * `receitaBruta`), sem tocar as séries mensais. O propósito é geometria: um
 * valor deste tamanho (`R$ 171.448.400,00`, o exemplo literal da issue) e um
 * negativo (`-R$ 12.345.678,90`) cabem na caixa do card?
 */
export function fluxoValoresLongos(): FluxoCalc {
  const c = fluxo();
  const grande = 171_448_400.00;   // 9 dígitos, 2 casas — o exemplo literal da #579
  const negativo = -12_345_678.90; // negativo — nos cards vira "-R$ …" sem
                                   // centavos (fmtR$Kpi, exceção da #581); a
                                   // forma entre parênteses é exercida em
                                   // `scores-apelo.ts` (campo passthrough)
  return {
    ...c,
    vpl: negativo,
    exposicaoMaxima: negativo,
    vgvTotal: grande,
    receitaBruta: grande,
    receitaBrutaVgv: grande,
    vgvVendavel: grande,
    jurosClientes: grande,
    carteiraClientesMaxima: grande,
    fluxoAcumulado: [...c.fluxoAcumulado.slice(0, -1), negativo],
  };
}

/**
 * Catálogo de Produtos do `ESTUDO` — a fonte do VGV do Preliminar.
 *
 * 80 unidades × 62 m² × R$ 11.000 = R$ 54.560.000, o mesmo VGV que os campos
 * legados de área × preço produziam enquanto eram fallback (4.960 m² ×
 * R$ 11.000). Os casos que medem a Proforma e os Gráficos continuam desenhando
 * exatamente os mesmos números.
 */
export const PRODUTOS: Record<string, any>[] = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 62, preco_venda_m2: 11_000, unidades: 80 },
];

/** Estudo Preliminar de Incorporação — entrada do `calcularProforma`. */
export const ESTUDO: Record<string, any> = {
  id: 1,
  nome: 'Render Check',
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 4_800,
  coef_aproveitamento_basico: 2,
  coef_aproveitamento_maximo: 4,
  area_pvt_r_fechada: 4_960,
  area_pvt_nr_fechada: 0,
  area_comum_total: 2_100,
  num_unidades: 80,
  num_unidades_residencial: 80,
  preco_venda_m2_residencial: 11_000,
  preco_venda_m2_nao_residencial: 0,
  sujeito_ret: true,
  imposto_percentual: 4,
  corretagem_percentual: 4,
  marketing_percentual: 2,
  considerar_custo_terreno: true,
  custo_terreno_m2: 1_875,
  projetos_modo: 'percentual',
  projetos_pct: 3,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 4_000,
  infra_modo: 'percentual',
  infra_pct: 2,
  taxa_gestao_pct: 3,
};

/**
 * Variante de `PRODUTOS` com preço de venda 10× maior — empurra o VGV de
 * `calcularProforma` de 8 para 9 dígitos (80×62×R$110.000 = R$ 545.600.000).
 * `produtos.produtos` é a ÚNICA fonte de VGV do Preliminar (`frontend/proforma.ts:67`)
 * — o campo legado `preco_venda_m2_residencial` de `ESTUDO` não entra em jogo
 * quando o catálogo está presente. Usada só pelo caso `resultado-graficos`
 * (#579): a aba "Gráficos" (`tela-graficos.ts`) não lê `FluxoCalc`, lê
 * `calcularProforma`.
 */
export const PRODUTOS_VALORES_LONGOS: Record<string, any>[] = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 62, preco_venda_m2: 110_000, unidades: 80 },
];

/**
 * Empurra um componente do app para o estado JÁ CARREGADO, sem passar pela
 * camada de API.
 *
 * As telas do Avançado carregam por `updated()` quando `estudo?.id` existe;
 * deixando `estudo` de fora, o carregamento nunca dispara e o estado é posto
 * aqui, direto. O ganho não é velocidade: é que o caso de render deixa de
 * depender do formato de sete respostas de API que ele não está verificando.
 *
 * O `as any` é intencional — os campos são `@state() private`, e é justamente
 * o estado interno que se quer fixar.
 */
export function forcarEstado(el: HTMLElement, estado: Record<string, unknown>): void {
  Object.assign(el as any, estado);
}

// ─────────────────────────────────────────────────────────────────
// #592 — funding para o caso de render da tabela em duas seções
// ─────────────────────────────────────────────────────────────────

/**
 * As TRÊS naturezas de operação, para o caso `tabela-fluxo-funding` ter as
 * duas pontas do funding com valor de verdade. Mesma ressalva do topo deste
 * arquivo: não é fixture de número — nenhum caso de render compara valor. O
 * que importa aqui é que `entradas` e `saidas` sejam não nulas, senão os
 * blocos novos não são montados e o `exigir` do caso mediria o vazio.
 */
export const OPERACOES_FUNDING = [
  {
    tipo: 'financiamento_producao', nome: 'Banco X', valor: 0, inicio_mes: 0,
    taxa_anual: 12, exposicao_minima: 5, percentual_financiavel: 80, custo_linha_ids: [2],
    amortizar_com_caixa_disponivel: true,
  },
  { tipo: 'divida', nome: 'Capital de giro', valor: 5_000_000, inicio_mes: 0,
    taxa_anual: 14, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6 },
  { tipo: 'equity', nome: 'Investidor', valor: 8_000_000, inicio_mes: 2,
    modo_retorno: 'resultado_final', pct_retorno: 20 },
] as any[];

/**
 * `FluxoCalc` para o caso COM funding. ⚠️ Não é `fluxo()`: o horizonte precisa
 * cobrir a quitação das operações, e quem estica o prazo é `operacoesFunding`
 * no `FluxoConfig` (#446). Sem ele a série é cortada e o saldo final sai
 * truncado — sem erro em lugar nenhum, que é o que o
 * `scripts/guard-fiacao-funding.mjs` existe para barrar.
 */
export function fluxoComFunding(): FluxoCalc {
  return calcularFluxo({
    dataInicio: DATA_INICIO,
    taxaDescontoAa: 12,
    cronograma: CRONO,
    linhasReceita: [LINHA_RECEITA],
    linhasCusto: LINHAS_CUSTO,
    curvas: [],
    areaTerreno: 4_800,
    ret: { ativo: true, pct: 4 },
    operacoesFunding: OPERACOES_FUNDING,
  });
}

/** `FundingCalc` de verdade, saído do motor de verdade, sobre o calc acima. */
export function fundingDeFluxo() {
  const c = fluxoComFunding();
  // ⚠️ Endpoint do ACUMULADO, como a produção faz (`tela-fluxo-ver.ts` e
  // `tela-cenarios.ts`) — não a soma crua dos mensais, que diverge dele quando
  // o arredondamento por centavo acumulado difere da soma em ponto flutuante.
  const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
  return fundingDoEstudo(
    OPERACOES_FUNDING, c.fluxoMensal, c.receitaMensal, resultadoFinal, 42, 12,
    { custosRaw: c.linhasCusto, linhasCusto: c.linhasCusto, cronograma: CRONO },
  );
}

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

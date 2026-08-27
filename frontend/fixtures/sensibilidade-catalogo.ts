// #568 — o estudo dourado da ANÁLISE DE SENSIBILIDADE, com catálogo de Produtos.
//
// Por que ele existe, e por que é um só para três consumidores:
//
//   · `frontend/proforma.test.ts` prova o MOTOR — estressar Preço/m² escala o
//     VGV do catálogo (Bear ×0,9 / Bull ×1,1);
//   · `frontend/tela-proforma.test.ts` prova a NOTAÇÃO — as três células da
//     linha "VGV" saem diferentes, e o Resultado negativo do Bear sai entre
//     parênteses, não com sinal de menos;
//   · `frontend/render/casos/cenarios-sensibilidade.ts` prova a FIAÇÃO — a
//     sub-aba Cenários, montada em Chromium, mostra de fato a marca de negativo
//     do Bear, que só existe se o fator chegou ao catálogo.
//
// Fixture único porque a premissa dos três é a MESMA aritmética: se ela deixar
// de valer (o Bear parar de virar deficitário, por exemplo), os três caem
// juntos, em vez de um render vermelho sem ninguém saber que a premissa mudou.
//
// O VGV de R$ 24.764.117,40 é o do print de produção que abriu a issue: é dele
// que saem os dois números do critério de aceite — ×0,9 = 22.287.705,66 e
// ×1,1 = 27.240.529,14.

import { type ProdutoPreliminar, type ProformaInput } from '../proforma.js';

/** VGV bruto do catálogo, sem stress (o número do print da issue). */
export const VGV_BASE = 24_764_117.40;
/** Variação padrão dos cenários quando não há indicador de benchmark: ±10%. */
export const VARIACAO_PADRAO_PCT = 10;
export const FATOR_BEAR = 1 - VARIACAO_PADRAO_PCT / 100;   // 0,9
export const FATOR_BULL = 1 + VARIACAO_PADRAO_PCT / 100;   // 1,1
/** VGV do catálogo em cada cenário, já com 2 casas (contrato C7). */
export const VGV_BEAR = 22_287_705.66;
export const VGV_BULL = 27_240_529.14;

/**
 * Duas linhas de catálogo que somam EXATAMENTE o VGV do print:
 *   40 un × 50,00 m² × R$ 10.000,00/m² = R$ 20.000.000,00
 *   10 un × 47,00 m² × R$ 10.136,42/m² = R$  4.764.117,40
 * Área privativa vendável somada: 40×50 + 10×47 = 2.470 m² — o mesmo valor de
 * `area_pvt_r_fechada` do estudo abaixo, para o catálogo e a cascata de áreas
 * descreverem o mesmo empreendimento.
 */
export const PRODUTOS_SENSIBILIDADE: (ProdutoPreliminar & { id: number; nome: string; ordem: number })[] = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 50, preco_venda_m2: 10_000, unidades: 40 },
  { id: 2, nome: 'Torre B', ordem: 1, area_media_m2: 47, preco_venda_m2: 10_136.42, unidades: 10 },
];

/**
 * Incorporação de MARGEM FINA — e a margem é fina de propósito.
 *
 * No cenário Base o Resultado fecha positivo por pouco (≈ R$ 1,48 milhão, ~6%
 * do VGV); no Bear, com o preço 10% abaixo, ele vira NEGATIVO. É exatamente
 * para isso que a análise de sensibilidade existe — e é o que dá ao caso de
 * render uma marca observável no DOM (`td.num.neg`) que só aparece quando o
 * fator de stress alcança o catálogo. Num estudo de margem gorda os três
 * cenários seriam positivos e a fiação quebrada passaria despercebida.
 *
 * Sem permuta física nem financeira: aqui o fator de preço tem UM caminho só
 * até o VGV — o catálogo. Com permuta, o preço legado ainda moveria alguma
 * coisa (era o que mascarava o bug), e o caso deixaria de ser conclusivo.
 */
export const ESTUDO_SENSIBILIDADE: ProformaInput & { id: number; nome: string } = {
  id: 568,
  nome: 'Sensibilidade — margem fina',
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 2_000,
  area_pvt_r_fechada: 2_470,
  area_pvt_nr_fechada: 0,
  area_comum_total: 800,
  // Deduções: RET 4% + corretagem 4% + marketing 2% = 10% do VGV.
  sujeito_ret: true,
  aliquota_ret_pct: 4,
  corretagem_percentual: 4,
  marketing_percentual: 2,
  // Custos diretos: terreno R$ 4.000.000 + projetos 3% do VGV +
  // construção R$ 14.820.000 + gestão 3% das obras.
  considerar_custo_terreno: true,
  custo_terreno_m2: 2_000,
  projetos_modo: 'pct_vgv',
  projetos_pct: 3,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 6_000,
  taxa_gestao_pct: 3,
  // Indiretos: 3,25% do VGV.
  marketing_global_pct: 2,
  gestao_indiretos_pct: 1.25,
};

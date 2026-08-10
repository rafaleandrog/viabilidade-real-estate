// Engine de Proforma — cálculos em tempo real (§6.2). Funções puras, sem DOM,
// reutilizadas pelo frontend e cobertas por testes unitários.
//
// Interpretações documentadas (onde a spec §4.4/§6.2 é ambígua ou se contradiz,
// seguimos o app-protótipo `analise_viabilidade` e o bom senso de mercado):
//   - Custo do terreno = custo_terreno_m2 × ÁREA DO TERRENO (não "área privativa"
//     como diz o texto literal de §6.2 — preço de aquisição incide sobre a gleba/lote).
//   - "Obras": Loteamento usa Infraestrutura; Incorporação usa Construção +
//     Decoração + Gestão da construção. (A ✓ de "Construção" para Loteamento em
//     §4.4 é tratada como engano — o protótipo não constrói em loteamento.)
//   - Projetos e Licenciamento no modo % incidem sobre o VGV (§4.4 toggle "% VGV").
//   - Contingências e Manutenção incidem sobre o VGV (§6.2).

import { calcularCascata, CASCATA_LOTEAMENTO, type EstadoLinha, type UnidadeMestre } from './areas-cascata.js';

export interface ProformaInput {
  tipo_empreendimento: string;
  // terreno
  origem_terreno?: string;                          // 'nucleo' | 'manual'
  terreno_manual_area?: number | string | null;     // usado quando origem = manual
  area_terreno_nucleo?: number | string | null;     // área somada dos imóveis do Núcleo (origem = nucleo)
  // loteamento — áreas: campos antigos (% da gleba) ainda existem no schema
  // mas não são mais lidos aqui (migração 020) — a tabela em cascata abaixo
  // é a única fonte, e já incorpora os dois campos sem linha própria na
  // imagem de referência (faixas_nao_edificaveis somado a area_app_valor,
  // areas_privativas_nao_vendaveis somado a area_viario_privado_valor).
  area_app_modo?: string; area_app_valor?: number | string;
  area_elup_epu_modo?: string; area_elup_epu_valor?: number | string;
  area_epc_modo?: string; area_epc_valor?: number | string;
  area_viario_publico_modo?: string; area_viario_publico_valor?: number | string;
  area_viario_privado_modo?: string; area_viario_privado_valor?: number | string;
  area_comuns_privadas_modo?: string; area_comuns_privadas_valor?: number | string;
  area_verdes_modo?: string; area_verdes_valor?: number | string;
  area_media_lote_m2?: number | string; preco_venda_m2?: number | string;
  // incorporação — áreas e coeficientes
  coef_aproveitamento_basico?: number | string; coef_aproveitamento_maximo?: number | string;
  area_pvt_r_fechada?: number | string; area_pvt_nr_fechada?: number | string;
  area_pvt_r_aberta?: number | string; area_pvt_nr_aberta?: number | string;
  area_comum_total?: number | string; num_unidades?: number | string;
  num_unidades_residencial?: number | string; num_unidades_nao_residencial?: number | string;
  preco_venda_m2_residencial?: number | string; preco_venda_m2_nao_residencial?: number | string;
  valor_venal_terreno_m2?: number | string;
  // deduções da receita
  sujeito_ret?: boolean; imposto_percentual?: number | string;
  corretagem_percentual?: number | string; marketing_percentual?: number | string;
  permuta_financeira_residencial_pct?: number | string; permuta_financeira_nao_residencial_pct?: number | string;
  permuta_financeira_residencial_modo?: string; permuta_financeira_residencial_valor?: number | string; permuta_financeira_residencial_valor_canonico?: number | string;
  permuta_financeira_nao_residencial_modo?: string; permuta_financeira_nao_residencial_valor?: number | string; permuta_financeira_nao_residencial_valor_canonico?: number | string;
  // custos diretos
  considerar_custo_terreno?: boolean; custo_terreno_m2?: number | string;
  projetos_modo?: string; projetos_pct?: number | string; projetos_valor_fixo?: number | string; projetos_valor_canonico?: number | string;
  licenciamento_modo?: string; licenciamento_pct?: number | string; licenciamento_valor_fixo?: number | string;
  infra_modo?: string; custo_infra_m2?: number | string; infra_pct?: number | string; infra_valor_fixo?: number | string; infra_valor_canonico?: number | string;
  incorporacao_registro_pct?: number | string;
  construcao_modo?: string; custo_construcao_m2?: number | string; construcao_valor_total?: number | string; construcao_valor_canonico?: number | string;
  taxa_gestao_pct?: number | string; custo_decoracao_m2?: number | string;
  manutencao_pct?: number | string; contingencias_pct?: number | string; stand_vendas_valor?: number | string;
  considerar_contingencias?: boolean;
  // custos indiretos
  marketing_global_pct?: number | string; gestao_indiretos_pct?: number | string;
  considerar_marketing_global?: boolean; considerar_gestao_indiretos?: boolean;
  // permuta física — o par legado (`permuta_fisica_*`) é o RESIDENCIAL (e o único
  // do loteamento); o par `_nr_*` é o não residencial (só incorporação). (#10)
  permuta_fisica_modo?: string; permuta_fisica_area_m2?: number | string; permuta_fisica_pct?: number | string; permuta_fisica_area_canonica?: number | string;
  permuta_fisica_nr_modo?: string; permuta_fisica_nr_area_m2?: number | string; permuta_fisica_nr_pct?: number | string; permuta_fisica_nr_area_canonica?: number | string;
  aliquota_ret_pct?: number; // parâmetro da app (default 4)
  // #315: catálogo de Produtos (tabela `preliminar_produtos`). Quando presente
  // e não-vazio, substitui os campos fixos legados (area_media_lote_m2/
  // preco_venda_m2 no Loteamento; area_pvt_*_fechada/preco_venda_m2_*/
  // num_unidades_* na Incorporação) como fonte de VGV e nº de unidades — ver
  // `totalProdutos()`. Ausente/vazio: comportamento idêntico a antes do #315.
  produtos?: ProdutoPreliminar[];
}

export interface ProdutoPreliminar {
  area_media_m2?: number | string | null;
  preco_venda_m2?: number | string | null;
  unidades?: number | string | null;
}

/** VGV de uma linha do catálogo: área média × preço × unidades (#315). */
export function vgvProduto(p: ProdutoPreliminar): number {
  return (Number(p.area_media_m2) || 0) * (Number(p.preco_venda_m2) || 0) * (Number(p.unidades) || 0);
}

/** Totais do catálogo — VGV bruto (soma das linhas) e nº de unidades. */
export function totalProdutos(produtos: ProdutoPreliminar[] | undefined): { vgv: number; unidades: number } {
  const lista = produtos ?? [];
  return {
    vgv: lista.reduce((s, p) => s + vgvProduto(p), 0),
    unidades: lista.reduce((s, p) => s + (Number(p.unidades) || 0), 0),
  };
}

export interface Proforma {
  // áreas
  areaTerreno: number; areaVendavel: number; areaPermutaFisica: number; areaVendavelLiquida: number;
  areaPrivativa: number; areaConstruida: number;
  // permuta física por tipo (#10): m² entregue e VGV correspondente, R e NR.
  areaPermutaResidencial: number; areaPermutaNaoResidencial: number;
  vgvPermutaResidencial: number; vgvPermutaNaoResidencial: number;
  // receita
  vgvResidencial: number; vgvNaoResidencial: number; vgv: number;
  // deduções
  imposto: number; corretagem: number; marketing: number;
  permutaFinResidencial: number; permutaFinNaoResidencial: number; receitaLiquida: number;
  // custos diretos (linhas)
  custoTerreno: number; projetos: number; infraestrutura: number; outorga: number;
  incorporacaoRegistro: number; construcao: number; gestaoConstrucao: number; decoracao: number;
  manutencao: number; contingencias: number; custoDiretoTotal: number;
  // receita operacional = receita líquida − custo direto total
  receitaOperacional: number;
  // custos indiretos
  marketingGlobal: number; gestaoIndiretos: number; custoIndiretoTotal: number;
  // resultado (final — permutas financeiras e físicas já o reduzem)
  resultado: number; valorPermutaFisica: number; margemLiquidaPct: number;
  // KPIs
  investimentoTotal: number; custoObras: number; custoObrasVgvPct: number;
  margemBrutaPct: number; roiPct: number; eficienciaPct: number;
  numUnidades: number; precoMedioUnidade: number;
  // Detalhe por tipo (Incorporação — #7). Loteamento não separa R/NR: ficam 0.
  numUnidadesResidencial: number; numUnidadesNaoResidencial: number;
  precoMedioUnidadeResidencial: number; precoMedioUnidadeNaoResidencial: number;
}

const n = (v: any): number => Number(v) || 0;
const moeda = (v: number): number => Math.round(v * 100) / 100;
const canonico = (v: any, legado: number): number => v === null || v === undefined ? legado : n(v);

// O schema/UI usa os nomes de domínio da cascata do Loteamento
// ('pct_poligonal'/'pct_parcelavel' — ver schema.json); o motor genérico
// (`areas-cascata.ts`) usa 'pct_ancora1'/'pct_ancora2', reutilizável por
// qualquer cascata (a de Incorporação usará 'pct_terreno'/'pct_construida').
function modoOuM2(v: any): UnidadeMestre {
  if (v === 'pct_poligonal') return 'pct_ancora1';
  if (v === 'pct_parcelavel') return 'pct_ancora2';
  return 'm2';
}

/** Estados das 7 linhas editáveis da cascata de áreas do Loteamento, a partir do `ProformaInput`. */
function estadosCascataLoteamento(e: ProformaInput): Record<string, EstadoLinha> {
  return {
    app: { modo: modoOuM2(e.area_app_modo), valor: n(e.area_app_valor) },
    elup_epu: { modo: modoOuM2(e.area_elup_epu_modo), valor: n(e.area_elup_epu_valor) },
    epc: { modo: modoOuM2(e.area_epc_modo), valor: n(e.area_epc_valor) },
    viario_publico: { modo: modoOuM2(e.area_viario_publico_modo), valor: n(e.area_viario_publico_valor) },
    viario_privado: { modo: modoOuM2(e.area_viario_privado_modo), valor: n(e.area_viario_privado_valor) },
    comuns_privadas: { modo: modoOuM2(e.area_comuns_privadas_modo), valor: n(e.area_comuns_privadas_valor) },
    verdes: { modo: modoOuM2(e.area_verdes_modo), valor: n(e.area_verdes_valor) },
  };
}

export function calcularProforma(e: ProformaInput): Proforma {
  const lot = e.tipo_empreendimento === 'loteamento';
  // Área do terreno: do Núcleo (soma das glebas/lotes vinculados) quando a
  // origem é Núcleo; senão, a área informada manualmente no estudo.
  const areaTerreno = e.origem_terreno === 'nucleo'
    ? n(e.area_terreno_nucleo)
    : n(e.terreno_manual_area);

  // ── Áreas + VGV ──
  let areaVendavel = 0, areaPrivativa = 0, areaConstruida = 0;
  let vgvResidencial = 0, vgvNaoResidencial = 0;
  const precoLot = n(e.preco_venda_m2);

  if (lot) {
    // Tabela em cascata (2026-08-03, `frontend/areas-cascata.ts`) — a Área
    // Líquida de Venda (ALV) da cascata É a área vendável do Loteamento.
    const cascata = calcularCascata(CASCATA_LOTEAMENTO, estadosCascataLoteamento(e), areaTerreno);
    areaVendavel = cascata.find((l) => l.id === 'alv')!.m2;
    areaPrivativa = areaVendavel; // lotes vendáveis
  } else {
    const rFech = n(e.area_pvt_r_fechada), nrFech = n(e.area_pvt_nr_fechada);
    const rAb = n(e.area_pvt_r_aberta), nrAb = n(e.area_pvt_nr_aberta);
    areaPrivativa = rFech + nrFech + rAb + nrAb;
    areaConstruida = areaPrivativa + n(e.area_comum_total);
    areaVendavel = rFech + nrFech; // área privativa vendável (áreas fechadas)
    vgvResidencial = rFech * n(e.preco_venda_m2_residencial);
    vgvNaoResidencial = nrFech * n(e.preco_venda_m2_nao_residencial);
  }

  // Permuta física (#10) — R e NR separados. Cada uma sai da área vendável do seu
  // tipo (loteamento é produto único ⇒ tudo "residencial", NR = 0). O par legado
  // `permuta_fisica_*` é o residencial; `permuta_fisica_nr_*` é o não residencial.
  const areaVendavelR = lot ? areaVendavel : n(e.area_pvt_r_fechada);
  const areaVendavelNR = lot ? 0 : n(e.area_pvt_nr_fechada);
  const precoR = lot ? precoLot : n(e.preco_venda_m2_residencial);
  const precoNR = lot ? 0 : n(e.preco_venda_m2_nao_residencial);

  const areaPermutaResidencialLegada = e.permuta_fisica_modo === 'pct_area_venda'
    ? areaVendavelR * n(e.permuta_fisica_pct) / 100
    : n(e.permuta_fisica_area_m2);
  const areaPermutaResidencial = canonico(e.permuta_fisica_area_canonica, areaPermutaResidencialLegada);
  const areaPermutaNaoResidencialLegada = lot ? 0
    : (e.permuta_fisica_nr_modo === 'pct_area_venda'
      ? areaVendavelNR * n(e.permuta_fisica_nr_pct) / 100
      : n(e.permuta_fisica_nr_area_m2));
  const areaPermutaNaoResidencial = canonico(e.permuta_fisica_nr_area_canonica, areaPermutaNaoResidencialLegada);
  const areaPermutaFisica = areaPermutaResidencial + areaPermutaNaoResidencial;
  const areaVendavelLiquida = areaVendavel - areaPermutaFisica;

  // A permuta reduz o VGV do tipo (área entregue × preço do tipo) — reduz o
  // resultado nos dois tipos de empreendimento (#14).
  const vgvPermutaResidencial = areaPermutaResidencial * precoR;
  const vgvPermutaNaoResidencial = areaPermutaNaoResidencial * precoNR;
  // #315: quando o catálogo de Produtos está populado, ele substitui o VGV
  // bruto (área×preço legados) como fonte — um bucket único (a tabela não
  // distingue R/NR). Interim documentado: a divisão fina residencial/não
  // residencial de permuta física/financeira e a sensibilidade continuam
  // lendo os campos legados até as issues #317/#320 integrarem o catálogo.
  const produtosTotal = e.produtos && e.produtos.length > 0 ? totalProdutos(e.produtos) : null;
  if (produtosTotal) {
    vgvResidencial = produtosTotal.vgv - (vgvPermutaResidencial + vgvPermutaNaoResidencial);
    vgvNaoResidencial = 0;
  } else {
    vgvResidencial = lot
      ? (areaVendavel - areaPermutaResidencial) * precoLot
      : vgvResidencial - vgvPermutaResidencial;
    vgvNaoResidencial = lot ? 0 : vgvNaoResidencial - vgvPermutaNaoResidencial;
  }
  const vgv = vgvResidencial + vgvNaoResidencial;

  // ── Deduções da receita ──
  const impostoPct = e.sujeito_ret ? (e.aliquota_ret_pct ?? 4) : n(e.imposto_percentual);
  const imposto = vgv * impostoPct / 100;
  const corretagem = vgv * n(e.corretagem_percentual) / 100;
  const marketing = vgv * n(e.marketing_percentual) / 100;
  // Permuta financeira (#5): por % do VGV do tipo ou por valor absoluto em R$.
  const permutaFinResidencialLegada = e.permuta_financeira_residencial_modo === 'valor_fixo'
    ? n(e.permuta_financeira_residencial_valor)
    : vgvResidencial * n(e.permuta_financeira_residencial_pct) / 100;
  const permutaFinResidencial = canonico(e.permuta_financeira_residencial_valor_canonico, permutaFinResidencialLegada);
  const permutaFinNaoResidencialLegada = e.permuta_financeira_nao_residencial_modo === 'valor_fixo'
    ? n(e.permuta_financeira_nao_residencial_valor)
    : vgvNaoResidencial * n(e.permuta_financeira_nao_residencial_pct) / 100;
  const permutaFinNaoResidencial = canonico(e.permuta_financeira_nao_residencial_valor_canonico, permutaFinNaoResidencialLegada);
  const receitaLiquida = vgv - imposto - corretagem - marketing - permutaFinResidencial - permutaFinNaoResidencial;

  // ── Custos diretos ──
  const custoTerreno = e.considerar_custo_terreno === false ? 0 : n(e.custo_terreno_m2) * areaTerreno;

  // Infraestrutura (loteamento) — 3 modos (#5): % do VGV, valor fixo em R$, ou
  // R$/m² × área privativa dos lotes (= área vendável bruta).
  const infraestruturaLegada = lot
    ? (e.infra_modo === 'valor_m2' ? n(e.custo_infra_m2) * areaVendavel
      : e.infra_modo === 'valor_fixo' ? n(e.infra_valor_fixo)
      : vgv * n(e.infra_pct) / 100)
    : 0;
  const infraestrutura = canonico(e.infra_valor_canonico, infraestruturaLegada);
  // Construção: por área (R$/m² × área privativa) ou valor total em R$ (#4).
  const construcaoLegada = lot ? 0
    : (e.construcao_modo === 'valor_total' ? n(e.construcao_valor_total) : n(e.custo_construcao_m2) * areaPrivativa);
  const construcao = canonico(e.construcao_valor_canonico, construcaoLegada);
  const decoracao = lot ? 0 : n(e.custo_decoracao_m2) * areaPrivativa;
  const custoTotalConstrucao = lot ? infraestrutura : (construcao + decoracao);
  const gestaoConstrucao = lot ? 0 : custoTotalConstrucao * n(e.taxa_gestao_pct) / 100;

  const projetosLegado = e.projetos_modo === 'valor_fixo' ? n(e.projetos_valor_fixo) : vgv * n(e.projetos_pct) / 100;
  const projetos = canonico(e.projetos_valor_canonico, projetosLegado);
  const outorga = lot ? 0 : (n(e.coef_aproveitamento_basico) > 0
    ? (n(e.valor_venal_terreno_m2) / n(e.coef_aproveitamento_basico)) * areaTerreno
      * (n(e.coef_aproveitamento_maximo) - n(e.coef_aproveitamento_basico)) * 0.20
    : 0);
  const incorporacaoRegistro = lot ? 0 : vgv * n(e.incorporacao_registro_pct) / 100;
  const manutencao = vgv * n(e.manutencao_pct) / 100;
  const contingencias = e.considerar_contingencias === false ? 0 : vgv * n(e.contingencias_pct) / 100;

  const custoDiretoTotal = custoTerreno + projetos + infraestrutura + outorga + incorporacaoRegistro
    + construcao + gestaoConstrucao + decoracao + manutencao + contingencias;

  // ── Custos indiretos ──
  const marketingGlobal = (e.considerar_marketing_global === false ? 0 : vgv * n(e.marketing_global_pct) / 100)
    + (lot ? n(e.stand_vendas_valor) : 0);
  const gestaoIndiretos = e.considerar_gestao_indiretos === false ? 0 : vgv * n(e.gestao_indiretos_pct) / 100;
  const custoIndiretoTotal = marketingGlobal + gestaoIndiretos;

  // Receita operacional = receita líquida − custo direto total (antes dos indiretos).
  const receitaOperacional = receitaLiquida - custoDiretoTotal;

  // ── Resultado ──
  // Final. Permuta financeira já foi deduzida da receita líquida; permuta física
  // já reduziu o VGV — ambas, portanto, reduzem o resultado (#14). `valorPermutaFisica`
  // é memo: o valor de mercado da área entregue em permuta.
  const resultado = receitaOperacional - custoIndiretoTotal;
  const precoMedioM2 = lot ? precoLot
    : (areaVendavelLiquida > 0 ? vgv / areaVendavelLiquida : 0);
  const valorPermutaFisica = areaPermutaFisica * precoMedioM2;
  const margemLiquidaPct = vgv > 0 ? resultado / vgv * 100 : 0;

  // ── KPIs ──
  const investimentoTotal = custoDiretoTotal + custoIndiretoTotal;
  const custoObras = lot ? infraestrutura : (construcao + decoracao + gestaoConstrucao);
  const custoObrasVgvPct = vgv > 0 ? custoObras / vgv * 100 : 0;
  const margemBrutaPct = vgv > 0 ? receitaLiquida / vgv * 100 : 0;
  const roiPct = investimentoTotal > 0 ? resultado / investimentoTotal * 100 : 0;
  const eficienciaPct = areaTerreno > 0 ? areaVendavel / areaTerreno * 100 : 0;
  // Incorporação: nº de unidades vem dos dois campos R e NR (#2); mantém
  // compatibilidade com o campo único legado num_unidades quando ambos zerados.
  const unidadesInc = n(e.num_unidades_residencial) + n(e.num_unidades_nao_residencial);
  const numUnidades = produtosTotal
    ? produtosTotal.unidades
    : (lot
      ? (n(e.area_media_lote_m2) > 0 ? Math.floor(areaVendavelLiquida / n(e.area_media_lote_m2)) : 0)
      : (unidadesInc > 0 ? unidadesInc : n(e.num_unidades)));
  const precoMedioUnidade = produtosTotal
    ? (numUnidades > 0 ? vgv / numUnidades : 0)
    : (lot ? n(e.area_media_lote_m2) * precoLot : (numUnidades > 0 ? vgv / numUnidades : 0));
  // Detalhe por tipo (#7): nº e preço médio por unidade, R e NR separados. Preço
  // médio = VGV do tipo (já líquido de permuta física) ÷ nº de unidades do tipo.
  // #315: catálogo de Produtos não distingue R/NR — bucket único em Residencial.
  const numUnidadesResidencial = produtosTotal ? produtosTotal.unidades : (lot ? 0 : n(e.num_unidades_residencial));
  const numUnidadesNaoResidencial = produtosTotal ? 0 : (lot ? 0 : n(e.num_unidades_nao_residencial));
  const precoMedioUnidadeResidencial = numUnidadesResidencial > 0 ? vgvResidencial / numUnidadesResidencial : 0;
  const precoMedioUnidadeNaoResidencial = numUnidadesNaoResidencial > 0 ? vgvNaoResidencial / numUnidadesNaoResidencial : 0;

  const resultadoProforma: Proforma = {
    areaTerreno, areaVendavel, areaPermutaFisica, areaVendavelLiquida, areaPrivativa, areaConstruida,
    areaPermutaResidencial, areaPermutaNaoResidencial, vgvPermutaResidencial, vgvPermutaNaoResidencial,
    vgvResidencial, vgvNaoResidencial, vgv,
    imposto, corretagem, marketing, permutaFinResidencial, permutaFinNaoResidencial, receitaLiquida,
    custoTerreno, projetos, infraestrutura, outorga, incorporacaoRegistro, construcao, gestaoConstrucao,
    decoracao, manutencao, contingencias, custoDiretoTotal,
    receitaOperacional,
    marketingGlobal, gestaoIndiretos, custoIndiretoTotal,
    resultado, valorPermutaFisica, margemLiquidaPct,
    investimentoTotal, custoObras, custoObrasVgvPct, margemBrutaPct, roiPct, eficienciaPct,
    numUnidades, precoMedioUnidade,
    numUnidadesResidencial, numUnidadesNaoResidencial,
    precoMedioUnidadeResidencial, precoMedioUnidadeNaoResidencial,
  };
  // #260/C7: toda saída monetária da Proforma é canônica a duas casas. As
  // métricas de área, quantidade e percentuais preservam sua própria precisão.
  const monetarios: (keyof Proforma)[] = [
    'vgvPermutaResidencial', 'vgvPermutaNaoResidencial', 'vgvResidencial', 'vgvNaoResidencial', 'vgv',
    'imposto', 'corretagem', 'marketing', 'permutaFinResidencial', 'permutaFinNaoResidencial', 'receitaLiquida',
    'custoTerreno', 'projetos', 'infraestrutura', 'outorga', 'incorporacaoRegistro', 'construcao', 'gestaoConstrucao',
    'decoracao', 'manutencao', 'contingencias', 'custoDiretoTotal', 'receitaOperacional',
    'marketingGlobal', 'gestaoIndiretos', 'custoIndiretoTotal', 'resultado', 'valorPermutaFisica',
    'investimentoTotal', 'custoObras', 'precoMedioUnidade', 'precoMedioUnidadeResidencial', 'precoMedioUnidadeNaoResidencial',
  ];
  for (const campo of monetarios) resultadoProforma[campo] = moeda(resultadoProforma[campo] as number) as never;
  return resultadoProforma;
}

/**
 * Preço Sugerido/m² (§1): menor preço de venda por m² para o resultado final (%)
 * atingir o piso do benchmark. Valor único (Incorporação usa o mesmo preço para
 * residencial e não residencial na busca). Resolve por bisseção sobre o preço.
 */
export function precoSugeridoM2(e: ProformaInput, pisoResultadoPct: number): number | null {
  const lot = e.tipo_empreendimento === 'loteamento';
  const margemNoPreco = (p: number): number => {
    const teste: ProformaInput = lot
      ? { ...e, preco_venda_m2: p }
      : { ...e, preco_venda_m2_residencial: p, preco_venda_m2_nao_residencial: p };
    return calcularProforma(teste).margemLiquidaPct;
  };
  // Se nem com preço altíssimo atinge o piso, não há solução.
  const P_MAX = 1_000_000;
  if (margemNoPreco(P_MAX) < pisoResultadoPct) return null;
  if (margemNoPreco(0.01) >= pisoResultadoPct) return 0; // já atinge sem preço (raro)

  let lo = 0, hi = P_MAX;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (margemNoPreco(mid) >= pisoResultadoPct) hi = mid; else lo = mid;
  }
  return hi;
}

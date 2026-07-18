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

export interface ProformaInput {
  tipo_empreendimento: string;
  // terreno
  origem_terreno?: string;                          // 'nucleo' | 'manual'
  terreno_manual_area?: number | string | null;     // usado quando origem = manual
  area_terreno_nucleo?: number | string | null;     // área somada dos imóveis do Núcleo (origem = nucleo)
  // loteamento — áreas (% da gleba)
  app_pct?: number | string; faixas_nao_edificaveis_pct?: number | string;
  sistema_viario_pct?: number | string; elup_pct?: number | string;
  epc_pct?: number | string; epu_pct?: number | string;
  areas_privativas_nao_vendaveis_pct?: number | string;
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
  permuta_financeira_residencial_modo?: string; permuta_financeira_residencial_valor?: number | string;
  permuta_financeira_nao_residencial_modo?: string; permuta_financeira_nao_residencial_valor?: number | string;
  // custos diretos
  considerar_custo_terreno?: boolean; custo_terreno_m2?: number | string;
  projetos_modo?: string; projetos_pct?: number | string; projetos_valor_fixo?: number | string;
  licenciamento_modo?: string; licenciamento_pct?: number | string; licenciamento_valor_fixo?: number | string;
  infra_modo?: string; custo_infra_m2?: number | string; infra_pct?: number | string; infra_valor_fixo?: number | string;
  incorporacao_registro_pct?: number | string;
  construcao_modo?: string; custo_construcao_m2?: number | string; construcao_valor_total?: number | string;
  taxa_gestao_pct?: number | string; custo_decoracao_m2?: number | string;
  manutencao_pct?: number | string; contingencias_pct?: number | string; stand_vendas_valor?: number | string;
  // custos indiretos
  marketing_global_pct?: number | string; gestao_indiretos_pct?: number | string;
  // permuta física — o par legado (`permuta_fisica_*`) é o RESIDENCIAL (e o único
  // do loteamento); o par `_nr_*` é o não residencial (só incorporação). (#10)
  permuta_fisica_modo?: string; permuta_fisica_area_m2?: number | string; permuta_fisica_pct?: number | string;
  permuta_fisica_nr_modo?: string; permuta_fisica_nr_area_m2?: number | string; permuta_fisica_nr_pct?: number | string;
  aliquota_ret_pct?: number; // parâmetro da app (default 4)
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
    const somaDeducoes = n(e.app_pct) + n(e.faixas_nao_edificaveis_pct) + n(e.sistema_viario_pct)
      + n(e.elup_pct) + n(e.epc_pct) + n(e.epu_pct) + n(e.areas_privativas_nao_vendaveis_pct);
    areaVendavel = areaTerreno * (1 - somaDeducoes / 100);
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

  const areaPermutaResidencial = e.permuta_fisica_modo === 'pct_area_venda'
    ? areaVendavelR * n(e.permuta_fisica_pct) / 100
    : n(e.permuta_fisica_area_m2);
  const areaPermutaNaoResidencial = lot ? 0
    : (e.permuta_fisica_nr_modo === 'pct_area_venda'
      ? areaVendavelNR * n(e.permuta_fisica_nr_pct) / 100
      : n(e.permuta_fisica_nr_area_m2));
  const areaPermutaFisica = areaPermutaResidencial + areaPermutaNaoResidencial;
  const areaVendavelLiquida = areaVendavel - areaPermutaFisica;

  // A permuta reduz o VGV do tipo (área entregue × preço do tipo) — reduz o
  // resultado nos dois tipos de empreendimento (#14).
  const vgvPermutaResidencial = areaPermutaResidencial * precoR;
  const vgvPermutaNaoResidencial = areaPermutaNaoResidencial * precoNR;
  vgvResidencial = lot
    ? (areaVendavel - areaPermutaResidencial) * precoLot
    : vgvResidencial - vgvPermutaResidencial;
  vgvNaoResidencial = lot ? 0 : vgvNaoResidencial - vgvPermutaNaoResidencial;
  const vgv = vgvResidencial + vgvNaoResidencial;

  // ── Deduções da receita ──
  const impostoPct = e.sujeito_ret ? (e.aliquota_ret_pct ?? 4) : n(e.imposto_percentual);
  const imposto = vgv * impostoPct / 100;
  const corretagem = vgv * n(e.corretagem_percentual) / 100;
  const marketing = vgv * n(e.marketing_percentual) / 100;
  // Permuta financeira (#5): por % do VGV do tipo ou por valor absoluto em R$.
  const permutaFinResidencial = e.permuta_financeira_residencial_modo === 'valor_fixo'
    ? n(e.permuta_financeira_residencial_valor)
    : vgvResidencial * n(e.permuta_financeira_residencial_pct) / 100;
  const permutaFinNaoResidencial = e.permuta_financeira_nao_residencial_modo === 'valor_fixo'
    ? n(e.permuta_financeira_nao_residencial_valor)
    : vgvNaoResidencial * n(e.permuta_financeira_nao_residencial_pct) / 100;
  const receitaLiquida = vgv - imposto - corretagem - marketing - permutaFinResidencial - permutaFinNaoResidencial;

  // ── Custos diretos ──
  const custoTerreno = e.considerar_custo_terreno === false ? 0 : n(e.custo_terreno_m2) * areaTerreno;

  // Infraestrutura (loteamento) — 3 modos (#5): % do VGV, valor fixo em R$, ou
  // R$/m² × área privativa dos lotes (= área vendável bruta).
  const infraestrutura = lot
    ? (e.infra_modo === 'valor_m2' ? n(e.custo_infra_m2) * areaVendavel
      : e.infra_modo === 'valor_fixo' ? n(e.infra_valor_fixo)
      : vgv * n(e.infra_pct) / 100)
    : 0;
  // Construção: por área (R$/m² × área privativa) ou valor total em R$ (#4).
  const construcao = lot ? 0
    : (e.construcao_modo === 'valor_total' ? n(e.construcao_valor_total) : n(e.custo_construcao_m2) * areaPrivativa);
  const decoracao = lot ? 0 : n(e.custo_decoracao_m2) * areaPrivativa;
  const custoTotalConstrucao = lot ? infraestrutura : (construcao + decoracao);
  const gestaoConstrucao = lot ? 0 : custoTotalConstrucao * n(e.taxa_gestao_pct) / 100;

  const projetos = e.projetos_modo === 'valor_fixo' ? n(e.projetos_valor_fixo) : vgv * n(e.projetos_pct) / 100;
  const outorga = lot ? 0 : (n(e.coef_aproveitamento_basico) > 0
    ? (n(e.valor_venal_terreno_m2) / n(e.coef_aproveitamento_basico)) * areaTerreno
      * (n(e.coef_aproveitamento_maximo) - n(e.coef_aproveitamento_basico)) * 0.20
    : 0);
  const incorporacaoRegistro = lot ? 0 : vgv * n(e.incorporacao_registro_pct) / 100;
  const manutencao = vgv * n(e.manutencao_pct) / 100;
  const contingencias = vgv * n(e.contingencias_pct) / 100;

  const custoDiretoTotal = custoTerreno + projetos + infraestrutura + outorga + incorporacaoRegistro
    + construcao + gestaoConstrucao + decoracao + manutencao + contingencias;

  // ── Custos indiretos ──
  const marketingGlobal = vgv * n(e.marketing_global_pct) / 100 + (lot ? n(e.stand_vendas_valor) : 0);
  const gestaoIndiretos = vgv * n(e.gestao_indiretos_pct) / 100;
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
  const numUnidades = lot
    ? (n(e.area_media_lote_m2) > 0 ? Math.floor(areaVendavelLiquida / n(e.area_media_lote_m2)) : 0)
    : (unidadesInc > 0 ? unidadesInc : n(e.num_unidades));
  const precoMedioUnidade = lot
    ? n(e.area_media_lote_m2) * precoLot
    : (numUnidades > 0 ? vgv / numUnidades : 0);
  // Detalhe por tipo (#7): nº e preço médio por unidade, R e NR separados. Preço
  // médio = VGV do tipo (já líquido de permuta física) ÷ nº de unidades do tipo.
  const numUnidadesResidencial = lot ? 0 : n(e.num_unidades_residencial);
  const numUnidadesNaoResidencial = lot ? 0 : n(e.num_unidades_nao_residencial);
  const precoMedioUnidadeResidencial = numUnidadesResidencial > 0 ? vgvResidencial / numUnidadesResidencial : 0;
  const precoMedioUnidadeNaoResidencial = numUnidadesNaoResidencial > 0 ? vgvNaoResidencial / numUnidadesNaoResidencial : 0;

  return {
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

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
  // Catálogo de Produtos (tabela `preliminar_produtos`) — a ÚNICA fonte de VGV
  // e de nº de unidades. Os pares legados (area_media_lote_m2/preco_venda_m2 no
  // Loteamento; area_pvt_*_fechada/preco_venda_m2_*/num_unidades_* na
  // Incorporação) continuam no schema e no tipo porque a permuta física ainda
  // lê o preço deles, mas deixaram de gerar receita: sem catálogo efetivo o
  // estudo não tem receita modelada (`semProdutos`), e não há fallback.
  produtos?: ProdutoPreliminar[];
  // BUG7-08: fator de stress da análise de sensibilidade (Bear/Base/Bull).
  // Escala o valor JÁ RESOLVIDO (canônico se houver, senão o legado) de uma
  // das 5 variáveis estressáveis — em vez de a UI escalar campos legados
  // individualmente (que o motor ignora quando há canônico, tornando o
  // stress um no-op), o fator é aplicado aqui, no único lugar que sabe qual
  // valor (canônico ou legado) está realmente em uso.
  sensibilidade?: FatorSensibilidade;
}

export type VariavelSensibilidade = 'preco' | 'permuta_fisica' | 'permuta_financeira' | 'custo_infra' | 'custo_obras';
export interface FatorSensibilidade { variavel: VariavelSensibilidade; fator: number; }

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

/**
 * Se esta linha COMPÕE catálogo: precisa das três grandezas que formam VGV.
 *
 * "Adicionar Produto" cria a linha só com `ordem` e as três colunas nascem
 * vazias (`unidades` tem default 0 no schema). Contar essa linha em branco como
 * catálogo presente trocava a fonte do VGV por uma soma zero — e, com permuta
 * física por cima, levava a Receita bruta a NEGATIVO.
 */
export function produtoCompoeCatalogo(p: ProdutoPreliminar): boolean {
  return (Number(p.area_media_m2) || 0) > 0
    && (Number(p.preco_venda_m2) || 0) > 0
    && (Number(p.unidades) || 0) > 0;
}

/** As linhas do catálogo que compõem VGV; lista vazia = estudo sem receita modelada. */
export function catalogoEfetivo(produtos: ProdutoPreliminar[] | undefined): ProdutoPreliminar[] {
  return (produtos ?? []).filter(produtoCompoeCatalogo);
}

export interface Proforma {
  // áreas
  areaTerreno: number; areaVendavel: number; areaPermutaFisica: number; areaVendavelLiquida: number;
  areaPrivativa: number; areaConstruida: number;
  // permuta física por tipo (#10): m² entregue e VGV correspondente, R e NR.
  // Os dois `vgvPermuta*` são a permuta EFETIVA — já capada na base, para que
  // `vgv + vgvPermutaResidencial + vgvPermutaNaoResidencial` continue sendo o
  // VGV bruto.
  areaPermutaResidencial: number; areaPermutaNaoResidencial: number;
  vgvPermutaResidencial: number; vgvPermutaNaoResidencial: number;
  // Fonte do VGV e o que ela impõe a quem desenha a tela.
  // `semProdutos`: não há linha de catálogo que componha VGV — o estudo não tem
  // receita modelada, e a tela mostra estado vazio em vez de tabela.
  // `permutaCapada`: a permuta física pedida vale mais que a base, e o
  // excedente foi cortado; `vgvPermutaSolicitada` é o que ela pedia antes do
  // corte, para o aviso poder dizer o tamanho do excedente.
  semProdutos: boolean; permutaCapada: boolean; vgvPermutaSolicitada: number;
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
  // #571: os três indicadores "% VGV" abaixo (`margemLiquidaPct`,
  // `custoObrasVgvPct`, `receitaLiquidaSobreVgvPct`) ficam `null` quando o
  // denominador (`vgv`) é ≤ 0 — indefinido, não "mediu zero". Mesmo padrão de
  // `tetoAproveitamentoM2`/`pctAproveitamentoCoef` (#569, abaixo).
  resultado: number; valorPermutaFisica: number; margemLiquidaPct: number | null;
  // KPIs
  investimentoTotal: number; custoObras: number; custoObrasVgvPct: number | null;
  // #453: campo renomeado — o nome antigo dava a entender que havia custo no
  // numerador, e não há. A fórmula é "1 − deduções" (receita líquida / VGV, a
  // coluna "% VGV" da linha Receita líquida na EVI Urbitá). Renome puro,
  // fórmula intacta — nenhum número muda.
  receitaLiquidaSobreVgvPct: number | null; roiPct: number; eficienciaPct: number;
  numUnidades: number; precoMedioUnidade: number;
  // Detalhe por tipo (Incorporação — #7). Loteamento não separa R/NR: ficam 0.
  numUnidadesResidencial: number; numUnidadesNaoResidencial: number;
  precoMedioUnidadeResidencial: number; precoMedioUnidadeNaoResidencial: number;
  // Aproveitamento do coeficiente máximo (#569, só Incorporação): teto de área
  // privativa vendável construível (`areaTerreno × coef_aproveitamento_maximo`)
  // contra o que a cascata de áreas já usa (`areaPrivativa` — soma das 4
  // parcelas PVT). `tetoAproveitamentoM2`/`pctAproveitamentoCoef` ficam `null`
  // sem coeficiente preenchido (0/vazio) OU sem teto positivo — não é "0% de
  // aproveitamento", é "indicador não se aplica" (sem divisão por zero, sem
  // falso alarme). Loteamento não tem coeficiente no schema: os dois saem
  // `null` por construção, sempre.
  tetoAproveitamentoM2: number | null; pctAproveitamentoCoef: number | null;
  aproveitamentoExcedido: boolean;
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

  // BUG7-08: fator de sensibilidade — 1 quando a variável estressada não é a
  // que este cálculo está resolvendo, senão o fator do estudo (Bear/Bull).
  const fatorSens = (variavel: VariavelSensibilidade): number =>
    e.sensibilidade?.variavel === variavel ? e.sensibilidade.fator : 1;

  // ── Áreas + VGV ──
  let areaVendavel = 0, areaPrivativa = 0, areaConstruida = 0;
  const precoLot = n(e.preco_venda_m2) * fatorSens('preco');
  const precoR = lot ? precoLot : n(e.preco_venda_m2_residencial) * fatorSens('preco');
  const precoNR = lot ? 0 : n(e.preco_venda_m2_nao_residencial) * fatorSens('preco');

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
  }

  // O catálogo de Produtos é a única fonte do VGV bruto. Os pares legados de
  // área × preço não têm mais campo na tela; enquanto eram fallback, um estudo
  // sem catálogo herdava receita — e toda despesa em % de VGV — de valores que
  // ninguém consegue ver nem corrigir. Linha em branco não conta (a tela cria o
  // produto vazio), então `semProdutos` é sobre catálogo EFETIVO.
  const catalogo = catalogoEfetivo(e.produtos);
  const semProdutos = catalogo.length === 0;
  const totalCatalogo = totalProdutos(catalogo);
  const vgvBrutoCatalogo = totalCatalogo.vgv;

  // Permuta física (#10) — R e NR separados. Cada uma sai da área vendável do seu
  // tipo (loteamento é produto único ⇒ tudo "residencial", NR = 0). O par legado
  // `permuta_fisica_*` é o residencial; `permuta_fisica_nr_*` é o não residencial.
  const areaVendavelR = lot ? areaVendavel : n(e.area_pvt_r_fechada);
  const areaVendavelNR = lot ? 0 : n(e.area_pvt_nr_fechada);

  const areaPermutaResidencialLegada = e.permuta_fisica_modo === 'pct_area_venda'
    ? areaVendavelR * n(e.permuta_fisica_pct) / 100
    : n(e.permuta_fisica_area_m2);
  // BUG7-08: o fator escala o valor JÁ RESOLVIDO (canônico se houver, senão o
  // legado acima) — cobre os dois em vez de exigir que a UI escale campos
  // individualmente.
  const areaPermutaResidencial = canonico(e.permuta_fisica_area_canonica, areaPermutaResidencialLegada) * fatorSens('permuta_fisica');
  const areaPermutaNaoResidencialLegada = lot ? 0
    : (e.permuta_fisica_nr_modo === 'pct_area_venda'
      ? areaVendavelNR * n(e.permuta_fisica_nr_pct) / 100
      : n(e.permuta_fisica_nr_area_m2));
  const areaPermutaNaoResidencial = canonico(e.permuta_fisica_nr_area_canonica, areaPermutaNaoResidencialLegada) * fatorSens('permuta_fisica');
  const areaPermutaFisica = areaPermutaResidencial + areaPermutaNaoResidencial;
  const areaVendavelLiquida = areaVendavel - areaPermutaFisica;

  // A permuta reduz o VGV (área entregue × preço do tipo) — reduz o resultado
  // nos dois tipos de empreendimento (#14). Interim que RESTA do #315: o preço
  // da permuta ainda sai do campo legado do tipo, não do catálogo.
  const vgvPermutaSolicitadaR = areaPermutaResidencial * precoR;
  const vgvPermutaSolicitadaNR = areaPermutaNaoResidencial * precoNR;
  const vgvPermutaSolicitada = vgvPermutaSolicitadaR + vgvPermutaSolicitadaNR;
  // A permuta física não pode entregar mais do que existe para vender. A
  // subtração era feita sem piso: permuta de 100% da área sobre um catálogo
  // zerado devolvia Receita bruta negativa, e nada na tela dizia isso. O corte
  // é PROPORCIONAL para preservar a divisão R/NR, e a permuta efetiva é o que
  // sai no resultado — assim `vgv + as duas permutas` continua sendo o bruto.
  const vgvPermutaEfetiva = Math.min(vgvPermutaSolicitada, vgvBrutoCatalogo);
  // Comparação ao CENTAVO, não em precisão plena: excedente abaixo de meio
  // centavo some no arredondamento do contrato C7, e um aviso que mostrasse
  // "informada R$ X sobre base R$ X" seria ruído.
  const permutaCapada = moeda(vgvPermutaSolicitada) > moeda(vgvBrutoCatalogo);
  const fatorCap = vgvPermutaSolicitada > 0 ? vgvPermutaEfetiva / vgvPermutaSolicitada : 0;
  // ⚠️ As três parcelas são quantizadas AQUI, e uma delas é o RESÍDUO das
  // outras — não são três arredondamentos independentes. Independentes, cada
  // um erra até meio centavo para o seu lado e a identidade
  // `vgv + permutaR + permutaNR = VGV bruto` quebra: com base de R$ 0,01 e as
  // duas permutas pedindo o mesmo, o fator 0,5 dá 0,005 em cada, que sobe para
  // 0,01 nas duas e soma R$ 0,02 — o dobro da base. Derivando a parcela NR do
  // total efetivo já quantizado, a identidade vale por construção, em qualquer
  // entrada. O resíduo (no máximo um centavo) cai no NÃO residencial; no
  // Loteamento ele é sempre zero, porque lá `precoNR` é zero.
  const baseQuantizada = moeda(vgvBrutoCatalogo);
  const permutaEfetivaQuantizada = moeda(vgvPermutaEfetiva);
  const vgvPermutaResidencial = moeda(vgvPermutaSolicitadaR * fatorCap);
  const vgvPermutaNaoResidencial = permutaEfetivaQuantizada - vgvPermutaResidencial;
  // Bucket único: a tabela de Produtos não distingue residencial de não
  // residencial, então o VGV inteiro cai em `vgvResidencial`. `min` é monótono
  // sob arredondamento, então a subtração nunca fica negativa.
  const vgvResidencial = baseQuantizada - permutaEfetivaQuantizada;
  const vgvNaoResidencial = 0;
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
  const permutaFinResidencial = canonico(e.permuta_financeira_residencial_valor_canonico, permutaFinResidencialLegada) * fatorSens('permuta_financeira');
  const permutaFinNaoResidencialLegada = e.permuta_financeira_nao_residencial_modo === 'valor_fixo'
    ? n(e.permuta_financeira_nao_residencial_valor)
    : vgvNaoResidencial * n(e.permuta_financeira_nao_residencial_pct) / 100;
  const permutaFinNaoResidencial = canonico(e.permuta_financeira_nao_residencial_valor_canonico, permutaFinNaoResidencialLegada) * fatorSens('permuta_financeira');
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
  const infraestrutura = canonico(e.infra_valor_canonico, infraestruturaLegada) * fatorSens('custo_infra');
  // Construção: por área (R$/m² × área privativa) ou valor total em R$ (#4).
  const construcaoLegada = lot ? 0
    : (e.construcao_modo === 'valor_total' ? n(e.construcao_valor_total) : n(e.custo_construcao_m2) * areaPrivativa);
  const construcao = canonico(e.construcao_valor_canonico, construcaoLegada) * fatorSens('custo_obras');
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
  // #571: `null`, não 0 — vgv ≤ 0 é "sem base para medir", e um estudo
  // deficitário de verdade (margem negativa) precisa continuar distinguível
  // de "indefinido".
  const margemLiquidaPct = vgv > 0 ? resultado / vgv * 100 : null;

  // ── KPIs ──
  const investimentoTotal = custoDiretoTotal + custoIndiretoTotal;
  const custoObras = lot ? infraestrutura : (construcao + decoracao + gestaoConstrucao);
  const custoObrasVgvPct = vgv > 0 ? custoObras / vgv * 100 : null;
  const receitaLiquidaSobreVgvPct = vgv > 0 ? receitaLiquida / vgv * 100 : null;
  const roiPct = investimentoTotal > 0 ? resultado / investimentoTotal * 100 : 0;
  const eficienciaPct = areaTerreno > 0 ? areaVendavel / areaTerreno * 100 : 0;
  // Nº de unidades: também só do catálogo. Os campos legados que o alimentavam
  // (num_unidades_*, e a divisão da área vendável por area_media_lote_m2 no
  // Loteamento) saíram junto com o fallback de VGV — mantê-los daria contagem
  // de unidades num estudo cuja receita é zero.
  const numUnidades = totalCatalogo.unidades;
  const precoMedioUnidade = numUnidades > 0 ? vgv / numUnidades : 0;
  // Detalhe por tipo (#7): nº e preço médio por unidade, R e NR separados. Preço
  // médio = VGV do tipo (já líquido de permuta física) ÷ nº de unidades do tipo.
  // O catálogo não distingue R/NR — bucket único em Residencial —, e Loteamento
  // não separa os dois tipos: lá as duas métricas ficam em zero.
  const numUnidadesResidencial = lot ? 0 : numUnidades;
  const numUnidadesNaoResidencial = 0;
  const precoMedioUnidadeResidencial = numUnidadesResidencial > 0 ? vgvResidencial / numUnidadesResidencial : 0;
  const precoMedioUnidadeNaoResidencial = numUnidadesNaoResidencial > 0 ? vgvNaoResidencial / numUnidadesNaoResidencial : 0;

  // Aproveitamento do coeficiente máximo (#569): o teto só existe com
  // coeficiente > 0 — Loteamento nunca preenche o campo, então `coefMax` fica
  // 0 e o par sai `null` por construção, sem ramo `lot` explícito. `usada` é
  // `areaPrivativa`, a MESMA soma das 4 parcelas PVT que a cascata da
  // Incorporação calcula em `privativa_total` (`areas-cascata.ts`) — decisão
  // registrada no corpo do PR #569.
  const coefMax = n(e.coef_aproveitamento_maximo);
  const tetoAproveitamentoM2 = coefMax > 0 ? areaTerreno * coefMax : null;
  const pctAproveitamentoCoef = tetoAproveitamentoM2 !== null && tetoAproveitamentoM2 > 0
    ? (areaPrivativa / tetoAproveitamentoM2) * 100 : null;
  const aproveitamentoExcedido = tetoAproveitamentoM2 !== null && tetoAproveitamentoM2 > 0
    && areaPrivativa > tetoAproveitamentoM2;

  const resultadoProforma: Proforma = {
    areaTerreno, areaVendavel, areaPermutaFisica, areaVendavelLiquida, areaPrivativa, areaConstruida,
    areaPermutaResidencial, areaPermutaNaoResidencial, vgvPermutaResidencial, vgvPermutaNaoResidencial,
    semProdutos, permutaCapada, vgvPermutaSolicitada,
    vgvResidencial, vgvNaoResidencial, vgv,
    imposto, corretagem, marketing, permutaFinResidencial, permutaFinNaoResidencial, receitaLiquida,
    custoTerreno, projetos, infraestrutura, outorga, incorporacaoRegistro, construcao, gestaoConstrucao,
    decoracao, manutencao, contingencias, custoDiretoTotal,
    receitaOperacional,
    marketingGlobal, gestaoIndiretos, custoIndiretoTotal,
    resultado, valorPermutaFisica, margemLiquidaPct,
    investimentoTotal, custoObras, custoObrasVgvPct, receitaLiquidaSobreVgvPct, roiPct, eficienciaPct,
    numUnidades, precoMedioUnidade,
    numUnidadesResidencial, numUnidadesNaoResidencial,
    precoMedioUnidadeResidencial, precoMedioUnidadeNaoResidencial,
    tetoAproveitamentoM2, pctAproveitamentoCoef, aproveitamentoExcedido,
  };
  // #260/C7: toda saída monetária da Proforma é canônica a duas casas. As
  // métricas de área, quantidade e percentuais preservam sua própria precisão.
  const monetarios: (keyof Proforma)[] = [
    'vgvPermutaResidencial', 'vgvPermutaNaoResidencial', 'vgvPermutaSolicitada',
    'vgvResidencial', 'vgvNaoResidencial', 'vgv',
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
  // O preço testado tem que chegar ao CATÁLOGO: ele é a fonte do VGV, e mexer
  // só nos campos legados deixaria a margem constante — a bisseção não teria
  // nada para procurar e devolveria sempre o mesmo extremo. Os campos legados
  // seguem no override porque a permuta física ainda lê o preço deles.
  const margemNoPreco = (p: number): number => {
    const produtos = e.produtos?.map((x) => ({ ...x, preco_venda_m2: p }));
    const teste: ProformaInput = lot
      ? { ...e, preco_venda_m2: p, produtos }
      : { ...e, preco_venda_m2_residencial: p, preco_venda_m2_nao_residencial: p, produtos };
    // #571: `margemLiquidaPct` agora é `number | null` (indefinido quando
    // `vgv` fica ≤ 0). Aqui é busca numérica interna, não exibição — sem
    // catálogo com quantidade/área o VGV fica 0 para QUALQUER preço testado
    // (a bisseção nunca sai do lugar de qualquer forma), e `?? 0` preserva o
    // comportamento numérico de antes da #571 só para esta busca.
    return calcularProforma(teste).margemLiquidaPct ?? 0;
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

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
  // ⚠️ `preco_venda_m2` NÃO está aqui, e a ausência é a #615. Ele era o preço
  // da permuta física do Loteamento pela fonte legada, e não tem campo em tela
  // nenhuma (o array `PRODUTOS_LOT` que o declarava sobrevive só dentro de
  // `TODOS_NUM`, para o tipo numérico do Salvar) nem `padrao` no schema. Fora
  // do TIPO, e não só do cálculo, de propósito: assim voltar a lê-lo é erro de
  // compilação (`TS2339`), e não uma linha que passa despercebida na revisão.
  // A coluna continua no `schema.json` — apagá-la é mudança de schema, e
  // portanto outro escopo.
  area_media_lote_m2?: number | string;
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
  // Catálogo de Produtos (tabela `preliminar_produtos`) — a ÚNICA fonte de VGV,
  // de área e de nº de unidades, e desde a #570 também das bases das duas
  // permutas, separadas por categoria. Os campos legados da INCORPORAÇÃO
  // (area_pvt_*_fechada/preco_venda_m2_*/num_unidades_*) continuam no schema e
  // no tipo, mas só governam o estudo SEM catálogo efetivo — que, por não ter
  // receita modelada (`semProdutos`), fecha em zero de qualquer forma. Não há
  // fallback de um para o outro.
  //
  // O par legado do LOTEAMENTO não governa mais nada: `preco_venda_m2` saiu do
  // tipo na #615 (a permuta física dele era o último leitor) e
  // `area_media_lote_m2` já não tinha leitor desde que o nº de unidades passou
  // a sair só do catálogo.
  produtos?: ProdutoPreliminar[];
  // BUG7-08: fator de stress da análise de sensibilidade (Bear/Base/Bull).
  // Escala o valor JÁ RESOLVIDO (canônico se houver, senão o legado) de uma
  // das 5 variáveis estressáveis — em vez de a UI escalar campos legados
  // individualmente (que o motor ignora quando há canônico, tornando o
  // stress um no-op), o fator é aplicado aqui, no único lugar que sabe qual
  // valor (canônico ou legado) está realmente em uso.
  // #568: `preco` alcança também o CATÁLOGO (`aplicarFatorPreco`), que é a
  // fonte do VGV desde a #563 — antes o stress de preço só movia o valor da
  // permuta física, e o VGV ficava igual nos três cenários.
  sensibilidade?: FatorSensibilidade;
}

export type VariavelSensibilidade = 'preco' | 'permuta_fisica' | 'permuta_financeira' | 'custo_infra' | 'custo_obras';
export interface FatorSensibilidade { variavel: VariavelSensibilidade; fator: number; }

export interface ProdutoPreliminar {
  area_media_m2?: number | string | null;
  preco_venda_m2?: number | string | null;
  unidades?: number | string | null;
  // Classificação Residencial/Não Residencial. Nasceu na #565 (coluna, tela e
  // persistência) e passou a governar o cálculo na #570: é ela que separa o
  // VGV, a área e o preço médio de cada categoria — e, com eles, a base das
  // duas permutas do tipo. Ler o valor é sempre por `tipoProdutoEfetivo`,
  // nunca pelo campo cru, para o produto legado (sem `tipo`) cair no default.
  tipo?: string | null;
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

/** Área total de uma lista de produtos: Σ (área média × unidades). */
export function areaTotalProdutos(produtos: ProdutoPreliminar[] | undefined): number {
  return (produtos ?? []).reduce(
    (s, p) => s + (Number(p.area_media_m2) || 0) * (Number(p.unidades) || 0), 0,
  );
}

/**
 * #568 — o catálogo REPRECIFICADO pelo fator de stress da sensibilidade.
 *
 * Estressar "Preço/m²" é, literalmente, mexer no preço de cada linha do
 * catálogo: desde a #563 ele é a ÚNICA fonte do VGV, e o fator só alcançava os
 * campos legados `preco_venda_m2*` — que hoje sobraram como preço da permuta
 * física. Resultado: com catálogo presente (o caso normal), Bear/Base/Bull
 * saíam com o MESMO VGV, e a análise de sensibilidade não media nada.
 *
 * Escala o PREÇO, não o VGV da linha: `unidades` e `area_media_m2` seguem
 * intactas, então nº de unidades, área e as duas ponderações de
 * `resumoCatalogoProdutos` continuam descrevendo o mesmo portfólio — o cenário
 * é o mesmo empreendimento a outro preço, não outro empreendimento.
 *
 * `fator` é OBRIGATÓRIO de propósito (sem valor default): apagar o argumento na
 * chamada do motor vira erro de compilação em vez de silenciosamente
 * reintroduzir o bug — a defesa que a auditoria da Rodada 9 cobrou depois da
 * #491.
 */
export function aplicarFatorPreco(produtos: ProdutoPreliminar[], fator: number): ProdutoPreliminar[] {
  return produtos.map((p) => ({ ...p, preco_venda_m2: (Number(p.preco_venda_m2) || 0) * fator }));
}

export interface ResumoCatalogo {
  areaMediaM2: number | null;
  unidades: number | null;
  precoVendaM2: number | null;
}

/**
 * Resumo agregado do catálogo EFETIVO — área média por unidade, total de
 * unidades e preço de venda médio (R$/m²), na mesma unidade das três colunas
 * da tela.
 *
 * `unidades` é a soma simples das linhas do catálogo efetivo. `areaMediaM2` é
 * ponderada por `unidades` (Σ área×unidades / Σunidades) — a área média real
 * de uma unidade sorteada ao acaso do portfólio, não a média simples das
 * linhas. `precoVendaM2` é ponderada pela área total de cada linha
 * (Σ VGV / Σ área×unidades, reaproveitando `vgvProduto`/`totalProdutos`) — o
 * preço médio de venda por m² pesado pelo volume de área que cada linha
 * representa, não pelo número de linhas do catálogo.
 *
 * As duas ponderações são deliberadamente diferentes (unidades vs. área) mas
 * consistentes entre si: `areaMediaM2 × precoVendaM2 × unidades` reproduz o
 * VGV total do catálogo efetivo, porque `areaMediaM2 × unidades` é, por
 * construção, a área total somada.
 *
 * Catálogo sem nenhuma linha efetiva devolve os três campos `null` —
 * fallback honesto, nunca `0` (zero pareceria um dado real).
 *
 * Consumido pelo backend do Apelo Comercial (`backend/rotas/apelo-comercial.ts`)
 * para montar o contexto da análise de IA a partir do catálogo de Produtos —
 * nunca dos campos legados congelados (`area_media_lote_m2`, `num_unidades*`,
 * `preco_venda_m2*`).
 *
 * #568: descreve o CADASTRO, não um cenário — não conhece fator de stress. Quem
 * quiser o resumo de um cenário compõe (`resumoCatalogoProdutos(aplicarFatorPreco(
 * catalogoEfetivo(produtos), fator))`): só `precoVendaM2` se move, porque o fator
 * escala preço e a ponderação é por área.
 */
export function resumoCatalogoProdutos(produtos: ProdutoPreliminar[] | undefined): ResumoCatalogo {
  const catalogo = catalogoEfetivo(produtos);
  const { vgv, unidades } = totalProdutos(catalogo);
  const areaTotal = areaTotalProdutos(catalogo);
  return {
    unidades: unidades > 0 ? unidades : null,
    areaMediaM2: unidades > 0 ? areaTotal / unidades : null,
    precoVendaM2: areaTotal > 0 ? vgv / areaTotal : null,
  };
}

/**
 * Tipo efetivo de uma linha do catálogo — Residencial ou Não Residencial (#565).
 *
 * Produto LEGADO (gravado antes da migração `035`) não tem `tipo` no payload;
 * o default é Residencial, a mesma leitura que o `padrao` do `schema.json`
 * declara para a coluna. Qualquer valor que não seja exatamente
 * `nao_residencial` cai em Residencial — fail-safe, não fail-loud.
 *
 * ⚠️ Desde a #570 este campo GOVERNA cálculo (o VGV, a área e o preço médio de
 * cada categoria saem daqui), então o fail-safe deixou de ser inconsequente e
 * passou a ser uma escolha: valor fora do domínio classifica como Residencial
 * em vez de derrubar a Proforma inteira. Quem barra o valor inválido é o
 * `opcoes` da coluna no `schema.json`, na escrita — não este ponto, na leitura.
 */
export function tipoProdutoEfetivo(p: ProdutoPreliminar): 'residencial' | 'nao_residencial' {
  return p.tipo === 'nao_residencial' ? 'nao_residencial' : 'residencial';
}

export interface TotalCategoria {
  vgv: number;
  unidades: number;
  areaTotalM2: number;
  /** Preço médio ponderado pela área (Σ VGV / Σ área); `null` sem área na categoria. */
  precoMedioM2: number | null;
}
export interface TotaisPorTipo { residencial: TotalCategoria; nao_residencial: TotalCategoria; }

/**
 * Totais de uma lista de produtos separados por categoria (#570) — é este o
 * "total de cada categoria" sobre o qual as duas permutas passam a incidir.
 *
 * `precoMedioM2` é ponderado pela ÁREA da categoria (Σ VGV / Σ área×unidades),
 * a mesma ponderação de `resumoCatalogoProdutos`: é o preço por m² que o
 * portfólio daquela categoria pratica, não a média das linhas. Categoria sem
 * nenhuma linha devolve `null` — fallback honesto, nunca `0`, que pareceria
 * "vende de graça" em vez de "não há o que vender". Produto legado sem `tipo`
 * cai em Residencial (`tipoProdutoEfetivo`).
 *
 * ⚠️ **NÃO filtra**, de propósito — mesmo contrato de `totalProdutos` e
 * `areaTotalProdutos`, e não o de `resumoCatalogoProdutos`. Quem filtra é
 * `calcularProforma`, UMA vez, antes de reprecificar pelo fator de
 * sensibilidade (#568): refiltrar aqui faria um fator 0 zerar os preços,
 * derrubar as linhas no filtro e a categoria perder suas unidades só naquele
 * cenário. Para o resumo CADASTRAL, componha: `totaisPorTipoProdutos(
 * catalogoEfetivo(produtos))`.
 */
export function totaisPorTipoProdutos(produtos: ProdutoPreliminar[] | undefined): TotaisPorTipo {
  const catalogo = produtos ?? [];
  const daCategoria = (t: 'residencial' | 'nao_residencial'): TotalCategoria => {
    const linhas = catalogo.filter((p) => tipoProdutoEfetivo(p) === t);
    const { vgv, unidades } = totalProdutos(linhas);
    const areaTotalM2 = areaTotalProdutos(linhas);
    return { vgv, unidades, areaTotalM2, precoMedioM2: areaTotalM2 > 0 ? vgv / areaTotalM2 : null };
  };
  return { residencial: daCategoria('residencial'), nao_residencial: daCategoria('nao_residencial') };
}

export interface Proforma {
  // áreas
  areaTerreno: number; areaVendavel: number; areaPermutaFisica: number; areaVendavelLiquida: number;
  areaPrivativa: number; areaConstruida: number;
  // permuta física por tipo (#10): m² entregue e VGV correspondente, R e NR.
  // Os dois `vgvPermuta*` são a permuta EFETIVA — já capada na base DA PRÓPRIA
  // CATEGORIA (#570), para que as duas identidades por categoria
  // (`vgvResidencial + vgvPermutaResidencial` = VGV bruto residencial, idem NR)
  // e a soma delas continuem fechando.
  areaPermutaResidencial: number; areaPermutaNaoResidencial: number;
  vgvPermutaResidencial: number; vgvPermutaNaoResidencial: number;
  // Base de ÁREA da permuta física de cada categoria (#570) — é sobre ela que o
  // modo "% área venda" converte % em m², e é a mesma grandeza que a badge de
  // unidade da tela usa (`ctxConversaoPreliminar`, `premissas-conversao.ts`).
  // Na Incorporação com catálogo efetivo é a área do catálogo DA CATEGORIA
  // (Σ área×unidades); sem catálogo, `area_pvt_*_fechada`. No **Loteamento** é
  // sempre a ALV da cascata — a base da área lá é do terreno, não do catálogo
  // (#574); o que o catálogo governa no Loteamento é o preço.
  areaBasePermutaResidencial: number; areaBasePermutaNaoResidencial: number;
  // Fonte do VGV e o que ela impõe a quem desenha a tela.
  // `semProdutos`: não há linha de catálogo que componha VGV — o estudo não tem
  // receita modelada, e a tela mostra estado vazio em vez de tabela.
  // `permutaCapada`: a permuta física pedida vale mais que a base de ALGUMA das
  // duas categorias, e o excedente daquela categoria foi cortado;
  // `vgvPermutaSolicitada` é o que as duas pediam somadas, antes do corte, para
  // o aviso poder dizer o tamanho do excedente.
  semProdutos: boolean; permutaCapada: boolean; vgvPermutaSolicitada: number;
  // receita — os dois VGV por categoria saem do `tipo` de cada linha do
  // catálogo (#565/#570), cada um já líquido da permuta física da SUA
  // categoria. `vgv` é a soma.
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
  // #611 — a grandeza foi MEDIDA? Os dois indicadores acima continuam `number`
  // (a #571 não os alcançou, e transformá-los em `number | null` é o resto da
  // issue, que o autor adiou em 2026-08-28: *"por enquanto deixe sem cor
  // então"*). O que muda agora é só a COR: um denominador ausente devolve `0`,
  // e `0` pintado pela faixa do benchmark é falso alarme sobre grandeza que
  // ninguém mediu.
  //
  // As duas flags nascem ao LADO da própria divisão, e não recalculadas na
  // tela: assim o predicado ("há denominador") e a divisão não podem divergir.
  // Quem colore chama `eficienciaParaFaixa`/`roiParaFaixa`, abaixo.
  eficienciaMedida: boolean; roiMedido: boolean;
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
  // Área privativa alocada nos produtos (#573, Produtos): compara o que o
  // catálogo aloca (Residencial + Não Residencial somados — `areaTotalProdutos`
  // do catálogo EFETIVO, a mesma soma que `resumoCatalogoProdutos` usa) contra
  // a área privativa de venda REGISTRADA em Terreno & Áreas (`areaPrivativa`,
  // acima — a mesma grandeza que o teto de aproveitamento #569 usa como
  // "usada"). É uma comparação por SUBTRAÇÃO, não por razão, então
  // `areaProdutosAlocada` e `diferencaAreaAlocada` estão SEMPRE definidos —
  // catálogo vazio aloca 0 m², e 0 m² registrados menos 0 m² alocados ainda é
  // uma diferença válida (zero). `pctAreaAlocada` é a exceção: fica `null`
  // sem área registrada (`areaPrivativa` ≤ 0) — mesmo padrão null-safe de
  // `pctAproveitamentoCoef`, "indefinido" em vez de "0%" falso quando a razão
  // não tem denominador.
  //
  // `diferencaAreaAlocada` é `alocada − registrada`: positivo = excesso
  // alocado (o catálogo pede mais m² do que o terreno declara vender),
  // negativo = sobra por alocar (falta produto para a área toda), zero =
  // tudo alocado — os três estados do critério 2 da #573.
  //
  // Vale para os DOIS tipos de empreendimento sem ramo `lot` explícito: no
  // Loteamento `areaPrivativa` é a ALV da cascata (não há parcelas PVT), e o
  // catálogo — normalizado para o bucket residencial único (comentário acima,
  // em `porTipo`) — soma do mesmo jeito, R+NR sendo sempre só R ali. A soma é
  // agnóstica ao bucket por construção: não precisa saber quantas categorias
  // existem para somar todas.
  areaProdutosAlocada: number; pctAreaAlocada: number | null; diferencaAreaAlocada: number;
}

const n = (v: any): number => Number(v) || 0;
// #612 (rodada 1 de revisão): as áreas digitadas da Incorporação entram no
// motor pelo MESMO piso em zero que `calcularCascata` aplica na tabela — sem
// isto, um negativo digitado mostraria 0 na cascata e seguiria negativo no
// cálculo (área, custo e KPIs divergindo da tela).
const areaM2 = (v: any): number => Math.max(0, n(v));
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
  // origem é Núcleo; senão, a área informada manualmente no estudo. Pelo
  // MESMO piso das demais áreas (#612, rodada 2 de revisão): a cascata mostra
  // a âncora cortada em 0, e custoTerreno/outorga/teto leem o mesmo 0.
  const areaTerreno = e.origem_terreno === 'nucleo'
    ? areaM2(e.area_terreno_nucleo)
    : areaM2(e.terreno_manual_area);

  // BUG7-08: fator de sensibilidade — 1 quando a variável estressada não é a
  // que este cálculo está resolvendo, senão o fator do estudo (Bear/Bull).
  //
  // #568: o piso em 0 é aplicado AQUI, na fonte, e não dentro de
  // `aplicarFatorPreco` — clampar só lá deixaria o catálogo com fator 0 e a
  // valoração da permuta física com fator negativo, e a identidade do cap
  // (#563) deixaria de valer por construção. O benchmark aceita
  // `variacao_negativa_pct > 100` e a tela deriva `1 − varNeg/100`, então o
  // Bear pode pedir fator negativo: variação além de 100% degrada para preço
  // ZERO, nunca para preço negativo — VGV negativo é o que a #563 proibiu.
  const fatorSens = (variavel: VariavelSensibilidade): number =>
    e.sensibilidade?.variavel === variavel ? Math.max(0, e.sensibilidade.fator) : 1;

  // ── Áreas + VGV ──
  // Os dois preços abaixo são hoje o preço da PERMUTA FÍSICA da INCORPORAÇÃO
  // pela fonte legada (interim do #315: sem catálogo efetivo ela é valorada
  // pelo campo legado do tipo). Levam o MESMO `fatorSens('preco')` que o
  // catálogo recebe logo abaixo — é o que mantém o cenário coerente: base e
  // permuta escalam juntas, e a proporção que o cap do excedente (#563) mede
  // não muda de cenário para cenário.
  //
  // ⚠️ **O LOTEAMENTO NÃO TEM FONTE LEGADA DE PREÇO — #615.** Decisão do autor
  // em 2026-08-28, verbatim: *"retire isso então"*. Até aqui, `precoLot` era
  // `n(e.preco_venda_m2)`, e `estudos.preco_venda_m2` não tem campo em tela
  // nenhuma nem `padrao` no schema. A consequência era a que a auditoria #574
  // achou: num Loteamento sem catálogo, a coluna vazia deixava a permuta
  // deduzir ÁREA sem deduzir VGV — e um estudo antigo, com a coluna
  // preenchida, deduzia. Mesma premissa, resultados diferentes, sem nada na
  // tela dizendo por quê.
  //
  // Zero aqui não é "dedução silenciosamente zerada": sem catálogo efetivo o
  // estudo não tem receita modelada (`semProdutos`), e desde a #563 a Proforma
  // inteira vira estado vazio — não há VGV, não há tabela e não há o KPI de
  // área permutada ao lado. É a mesma filosofia, no eixo do preço: sem fonte
  // visível, nenhum número-fantasma.
  let areaVendavel = 0, areaPrivativa = 0, areaConstruida = 0;
  const precoR = lot ? 0 : n(e.preco_venda_m2_residencial) * fatorSens('preco');
  const precoNR = lot ? 0 : n(e.preco_venda_m2_nao_residencial) * fatorSens('preco');

  if (lot) {
    // Tabela em cascata (2026-08-03, `frontend/areas-cascata.ts`) — a Área
    // Líquida de Venda (ALV) da cascata É a área vendável do Loteamento.
    const cascata = calcularCascata(CASCATA_LOTEAMENTO, estadosCascataLoteamento(e), areaTerreno);
    areaVendavel = cascata.find((l) => l.id === 'alv')!.m2;
    areaPrivativa = areaVendavel; // lotes vendáveis
  } else {
    const rFech = areaM2(e.area_pvt_r_fechada), nrFech = areaM2(e.area_pvt_nr_fechada);
    const rAb = areaM2(e.area_pvt_r_aberta), nrAb = areaM2(e.area_pvt_nr_aberta);
    areaPrivativa = rFech + nrFech + rAb + nrAb;
    areaConstruida = areaPrivativa + areaM2(e.area_comum_total);
    areaVendavel = rFech + nrFech; // área privativa vendável (áreas fechadas)
  }

  // O catálogo de Produtos é a única fonte do VGV bruto. Os pares legados de
  // área × preço não têm mais campo na tela; enquanto eram fallback, um estudo
  // sem catálogo herdava receita — e toda despesa em % de VGV — de valores que
  // ninguém consegue ver nem corrigir. Linha em branco não conta (a tela cria o
  // produto vazio), então `semProdutos` é sobre catálogo EFETIVO.
  const catalogo = catalogoEfetivo(e.produtos);
  const semProdutos = catalogo.length === 0;
  // #568: o stress de "Preço/m²" tem que alcançar o CATÁLOGO — sem isso o VGV
  // ficava congelado entre Bear/Base/Bull, porque `fatorSens('preco')` só
  // tocava os campos legados (hoje só o preço da permuta física).
  //
  // A ORDEM importa: filtrar ANTES de reprecificar. `semProdutos` é um fato
  // CADASTRAL do estudo ("não há linha com as três grandezas preenchidas") e
  // não pode depender do cenário — reprecificar primeiro faria um fator 0
  // zerar os preços, derrubar todas as linhas no filtro e transformar o estudo
  // em "sem produtos" só naquele cenário.
  const catalogoEstressado = aplicarFatorPreco(catalogo, fatorSens('preco'));
  // `unidades` sai daqui e NÃO é afetada pelo fator (só o preço escala), então
  // nº de unidades e preço médio por unidade continuam coerentes no cenário.
  const totalCatalogo = totalProdutos(catalogoEstressado);
  // ⚠️ #568 × #570 — o PONTO DE ENCONTRO dos dois, e a ordem é a mesma que a
  // #568 fixou, com um passo a mais no fim: filtrar → reprecificar → SEPARAR
  // POR CATEGORIA. `totaisPorTipoProdutos` recebe o catálogo JÁ efetivo e JÁ
  // reprecificado, e por isso NÃO refiltra (mesmo contrato de `totalProdutos`):
  // refiltrar aqui devolveria a armadilha que a #568 acabou de fechar — com
  // fator 0 todo preço vira 0, o filtro derrubaria as linhas, e a categoria
  // perderia suas unidades enquanto `numUnidades` (de `totalCatalogo`, sem
  // refiltro) continuaria certo.
  //
  // A consequência que importa para o cap: o preço médio ponderado de cada
  // categoria JÁ carrega o fator, então a base e a permuta física daquela
  // categoria escalam JUNTAS — é o que mantém as duas identidades do cap
  // (#563/#570) fechando em qualquer cenário. E é por isso que `precoPermuta*`
  // abaixo NÃO reaplica `fatorSens('preco')`: por este caminho ele já entrou.
  //
  // ⚠️ O Loteamento normaliza TUDO para o bucket residencial antes de separar:
  // a tela de Permutas dele só expõe os controles residenciais (física e
  // financeira), então um produto marcado `nao_residencial` no grid sairia da
  // única base que a tela sabe editar — permuta física ignorando o produto e %
  // financeiro incidindo só sobre o resto, deduções subestimadas em silêncio.
  // A semântica R/NR é da Incorporação; aqui o catálogo é um bucket só, como a
  // tela sempre expôs (e, desde este PR, como o grid de Produtos também mostra:
  // a coluna "Tipo" não é desenhada no Loteamento).
  const porTipo = totaisPorTipoProdutos(
    lot ? catalogoEstressado.map((x) => ({ ...x, tipo: 'residencial' })) : catalogoEstressado,
  );

  // Permuta física (#10) — R e NR separados. O par legado `permuta_fisica_*` é
  // o residencial; `permuta_fisica_nr_*` é o não residencial (Loteamento não
  // tem NR: a tela nem desenha o par, e aqui ele é zero por construção — o que
  // só é seguro porque o catálogo do Loteamento foi normalizado acima, senão
  // haveria VGV numa categoria sem nenhum controle na tela).
  //
  // #570 — a BASE de cada uma passou a ser a da sua categoria NO CATÁLOGO:
  // área (para o modo "% área venda") e preço médio ponderado (para valorar os
  // m² entregues). Enquanto o VGV vinha do catálogo e a permuta era medida e
  // valorada por campos legados sem tela, os dois lados falavam de projetos
  // diferentes — era o interim que esta issue fecha.
  //
  // Sem catálogo efetivo NADA disso muda: o estudo não tem receita modelada
  // (`semProdutos`), e as bases legadas seguem exatamente como estavam. É a
  // mesma decisão do #315 — não há fallback de uma fonte para a outra, em
  // nenhum dos dois sentidos.
  //
  // ⚠️ E a troca de base da ÁREA é semântica da INCORPORAÇÃO, não do Loteamento.
  // Lá o `%` da permuta física sempre incidiu sobre a **ALV da cascata** (a área
  // líquida de venda que a tabela de Áreas calcula do terreno), e a auditoria do
  // Loteamento (#574) reafirmou que é essa a base correta: o loteador entrega
  // uma fração da área LOTEÁVEL, que é uma grandeza do terreno, não do catálogo.
  // O que o catálogo governa no Loteamento é o PREÇO — e é isso que conserta a
  // permuta que reduzia área sem reduzir VGV, porque `preco_venda_m2` não tem
  // campo em tela nenhuma nem `padrao` no schema.
  const areaBasePermutaResidencial = lot ? areaVendavel
    : (semProdutos ? areaM2(e.area_pvt_r_fechada) : porTipo.residencial.areaTotalM2);
  const areaBasePermutaNaoResidencial = lot ? 0
    : (semProdutos ? areaM2(e.area_pvt_nr_fechada) : porTipo.nao_residencial.areaTotalM2);
  // ⚠️ O fator de sensibilidade de preço NÃO aparece nesta linha, e a ausência
  // é a reconciliação com a #568: pelo caminho do catálogo ele já entrou em
  // `catalogoEstressado`, e `precoMedioM2` sai de lá — reaplicá-lo aqui o
  // elevaria ao QUADRADO, e a permuta passaria a escalar mais rápido que a
  // própria base, quebrando o cap. Pela fonte legada (`semProdutos`) ele entra
  // em `precoR`/`precoNR`, como a #568 deixou. Categoria sem linha no catálogo
  // tem `precoMedioM2` nulo — vale zero, porque não há estoque daquela
  // categoria para entregar.
  const precoPermutaR = semProdutos ? precoR : (porTipo.residencial.precoMedioM2 ?? 0);
  const precoPermutaNR = lot ? 0
    : (semProdutos ? precoNR : (porTipo.nao_residencial.precoMedioM2 ?? 0));

  const areaPermutaResidencialLegada = e.permuta_fisica_modo === 'pct_area_venda'
    ? areaBasePermutaResidencial * n(e.permuta_fisica_pct) / 100
    : n(e.permuta_fisica_area_m2);
  // BUG7-08: o fator escala o valor JÁ RESOLVIDO (canônico se houver, senão o
  // legado acima) — cobre os dois em vez de exigir que a UI escale campos
  // individualmente.
  const areaPermutaResidencial = canonico(e.permuta_fisica_area_canonica, areaPermutaResidencialLegada) * fatorSens('permuta_fisica');
  const areaPermutaNaoResidencialLegada = lot ? 0
    : (e.permuta_fisica_nr_modo === 'pct_area_venda'
      ? areaBasePermutaNaoResidencial * n(e.permuta_fisica_nr_pct) / 100
      : n(e.permuta_fisica_nr_area_m2));
  const areaPermutaNaoResidencial = canonico(e.permuta_fisica_nr_area_canonica, areaPermutaNaoResidencialLegada) * fatorSens('permuta_fisica');
  const areaPermutaFisica = areaPermutaResidencial + areaPermutaNaoResidencial;
  const areaVendavelLiquida = areaVendavel - areaPermutaFisica;

  // A permuta reduz o VGV (área entregue × preço da SUA categoria) — reduz o
  // resultado nos dois tipos de empreendimento (#14).
  const vgvPermutaSolicitadaR = areaPermutaResidencial * precoPermutaR;
  const vgvPermutaSolicitadaNR = areaPermutaNaoResidencial * precoPermutaNR;
  const vgvPermutaSolicitada = vgvPermutaSolicitadaR + vgvPermutaSolicitadaNR;
  // A permuta física não pode entregar mais do que existe para vender. A
  // subtração era feita sem piso: permuta de 100% da área sobre um catálogo
  // zerado devolvia Receita bruta negativa, e nada na tela dizia isso (#563).
  //
  // ⚠️ DECISÃO #570 — o cap é POR CATEGORIA: cada uma capa no VGV bruto da
  // própria categoria, e não há corte proporcional entre as duas. O corte
  // proporcional existia porque o cap era global, sobre um bucket único; com
  // as bases separadas ele passaria a deixar o excedente de uma categoria
  // comendo o VGV da outra — e aí `vgvNaoResidencial` deixaria de ser "o VGV
  // não residencial", que é justamente a base que a permuta financeira NR
  // precisa (critério 3 da issue). Consequência aritmética: como `min` é
  // monótono sob arredondamento, os DOIS VGV param em zero por baixo, cada um
  // por conta própria, e nenhum fica negativo.
  //
  // Consequência de leitura, e ela é intencional: no modo "% área venda" o cap
  // deixou de ser alcançável abaixo de 100%, porque o % agora incide sobre a
  // mesma área que dá o preço médio — pedir 40% da área da categoria vale
  // exatamente 40% do VGV dela. O cap continua guardando o modo m² absoluto, o
  // valor canônico e o fator de sensibilidade, que não têm essa amarração.
  const capadaR = moeda(vgvPermutaSolicitadaR) > moeda(porTipo.residencial.vgv);
  const capadaNR = moeda(vgvPermutaSolicitadaNR) > moeda(porTipo.nao_residencial.vgv);
  // Comparação ao CENTAVO, não em precisão plena: excedente abaixo de meio
  // centavo some no arredondamento do contrato C7, e um aviso que mostrasse
  // "informada R$ X sobre base R$ X" seria ruído.
  const permutaCapada = capadaR || capadaNR;
  // ⚠️ Cada VGV é o RESÍDUO da sua base já quantizada menos a sua permuta já
  // quantizada — não são dois arredondamentos independentes. Assim a identidade
  // por categoria (`vgvResidencial + vgvPermutaResidencial` = VGV bruto R, idem
  // NR) vale por construção, ao centavo, em qualquer entrada — inclusive nas de
  // fração de centavo, que foram o que quebrou a versão anterior (#563).
  const vgvPermutaResidencial = moeda(Math.min(vgvPermutaSolicitadaR, porTipo.residencial.vgv));
  const vgvPermutaNaoResidencial = moeda(Math.min(vgvPermutaSolicitadaNR, porTipo.nao_residencial.vgv));
  const vgvResidencial = moeda(porTipo.residencial.vgv) - vgvPermutaResidencial;
  const vgvNaoResidencial = moeda(porTipo.nao_residencial.vgv) - vgvPermutaNaoResidencial;
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
  // #615 — o memo do Loteamento usa o MESMO preço da dedução. O ramo antigo
  // (`lot ? precoLot : …`) valorava por `estudos.preco_venda_m2` enquanto a
  // dedução já vinha do catálogo — duas valorações da mesma área, discordando.
  // A primeira versão deste conserto usou `vgv / areaVendavelLiquida` nos dois
  // tipos, e a rodada 1 de revisão mostrou que isso só coincide com a dedução
  // quando a área do catálogo == ALV — caso a área do catálogo divergir (o que
  // a #570 suporta: a base da permuta é a ALV, o preço é do catálogo), a média
  // residual NÃO recupera o preço do catálogo. Então o Loteamento usa
  // `precoPermutaR` — literalmente a variável da dedução (:558) — e a
  // Incorporação mantém a média residual que sempre teve (critério 4).
  const precoMedioM2 = lot
    ? precoPermutaR
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
  // #611: o predicado do denominador é NOMEADO e reusado pela própria divisão
  // — não há como a flag dizer "medido" e a conta cair no ramo do zero.
  const roiMedido = investimentoTotal > 0;
  const roiPct = roiMedido ? resultado / investimentoTotal * 100 : 0;
  const eficienciaMedida = areaTerreno > 0;
  const eficienciaPct = eficienciaMedida ? areaVendavel / areaTerreno * 100 : 0;
  // Nº de unidades: também só do catálogo. Os campos legados que o alimentavam
  // (num_unidades_*, e a divisão da área vendável por area_media_lote_m2 no
  // Loteamento) saíram junto com o fallback de VGV — mantê-los daria contagem
  // de unidades num estudo cuja receita é zero.
  const numUnidades = totalCatalogo.unidades;
  const precoMedioUnidade = numUnidades > 0 ? vgv / numUnidades : 0;
  // Detalhe por tipo (#7): nº e preço médio por unidade, R e NR separados. Preço
  // médio = VGV do tipo (já líquido de permuta física) ÷ nº de unidades do tipo.
  // A contagem por tipo vem do `tipo` de cada linha do catálogo (#570) — antes
  // caía inteira em Residencial, e o preço médio NR mostrava zero mesmo com VGV
  // não residencial existindo. Loteamento não separa os dois tipos: lá as duas
  // métricas ficam em zero, como sempre estiveram.
  const numUnidadesResidencial = lot ? 0 : porTipo.residencial.unidades;
  const numUnidadesNaoResidencial = lot ? 0 : porTipo.nao_residencial.unidades;
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

  // Área privativa alocada nos produtos (#573) — `catalogo` é o mesmo
  // `catalogoEfetivo(e.produtos)` desta função, de antes de reprecificar: a
  // área média × unidades de cada linha não muda com o fator de sensibilidade
  // de preço, então usar o catálogo cru ou o estressado dá o mesmo total —
  // igual decisão de `resumoCatalogoProdutos`, que descreve o CADASTRO, não
  // um cenário.
  const areaProdutosAlocada = areaTotalProdutos(catalogo);
  const pctAreaAlocada = areaPrivativa > 0 ? (areaProdutosAlocada / areaPrivativa) * 100 : null;
  const diferencaAreaAlocada = moeda(areaProdutosAlocada - areaPrivativa);

  const resultadoProforma: Proforma = {
    areaTerreno, areaVendavel, areaPermutaFisica, areaVendavelLiquida, areaPrivativa, areaConstruida,
    areaPermutaResidencial, areaPermutaNaoResidencial, vgvPermutaResidencial, vgvPermutaNaoResidencial,
    areaBasePermutaResidencial, areaBasePermutaNaoResidencial,
    semProdutos, permutaCapada, vgvPermutaSolicitada,
    vgvResidencial, vgvNaoResidencial, vgv,
    imposto, corretagem, marketing, permutaFinResidencial, permutaFinNaoResidencial, receitaLiquida,
    custoTerreno, projetos, infraestrutura, outorga, incorporacaoRegistro, construcao, gestaoConstrucao,
    decoracao, manutencao, contingencias, custoDiretoTotal,
    receitaOperacional,
    marketingGlobal, gestaoIndiretos, custoIndiretoTotal,
    resultado, valorPermutaFisica, margemLiquidaPct,
    investimentoTotal, custoObras, custoObrasVgvPct, receitaLiquidaSobreVgvPct, roiPct, eficienciaPct,
    eficienciaMedida, roiMedido,
    numUnidades, precoMedioUnidade,
    numUnidadesResidencial, numUnidadesNaoResidencial,
    precoMedioUnidadeResidencial, precoMedioUnidadeNaoResidencial,
    tetoAproveitamentoM2, pctAproveitamentoCoef, aproveitamentoExcedido,
    areaProdutosAlocada, pctAreaAlocada, diferencaAreaAlocada,
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
 * #611 — o valor de `eficienciaPct` **para COLORIR**, ou `null` quando a área do
 * terreno não foi informada.
 *
 * Decisão do autor em 2026-08-28, verbatim: *"por enquanto deixe sem cor
 * então"*. `eficienciaPct` é o indicador exclusivo do Loteamento ("Vendável /
 * gleba"): sem área de terreno ele cai em `0`, e `varianteFaixa` recebia esse
 * `0` — que numa faixa `atingir_ou_superar` fica na banda vermelha. O KPI
 * aparecia **em vermelho** anunciando um benchmark estourado sobre uma
 * grandeza que ninguém mediu, ao lado de uma margem que já mostrava "—".
 *
 * ⚠️ **O VALOR EXIBIDO não muda, e a diferença é deliberada.** A tela continua
 * imprimindo `0,0%` — trocá-lo por "—" exige `eficienciaPct: number | null`, o
 * padrão da #571, e é o restante desta issue, que o "por enquanto" do autor
 * adiou. Esta função existe para separar as duas coisas: *quanto* o indicador
 * vale (sempre `number`) e se há base para *julgá-lo* (`null` = não julgue).
 *
 * `varianteFaixa`, `bolaFaixa` e `montarMedidor` já aceitam `null` desde a
 * #571 e devolvem "sem cor" / "sem medidor" — por isso o conserto é passar o
 * `null`, e não mexer nas faixas.
 */
export function eficienciaParaFaixa(p: Proforma): number | null {
  return p.eficienciaMedida ? p.eficienciaPct : null;
}

/**
 * #611 — o mesmo, para `roiPct`: `null` quando não houve investimento
 * (`investimentoTotal <= 0`). Sem denominador, o ROI cai em `0` e o medidor de
 * benchmark da aba Gráficos desenhava o ponteiro no fim vermelho da escala.
 */
export function roiParaFaixa(p: Proforma): number | null {
  return p.roiMedido ? p.roiPct : null;
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
  // seguem no override da INCORPORAÇÃO para o estudo SEM catálogo, onde a
  // permuta física ainda lê o preço deles (#570); com catálogo, o preço da
  // permuta é o médio da categoria, e o override do catálogo já o move junto.
  //
  // #615: o Loteamento perdeu o override do campo legado junto com a leitura
  // dele — `preco_venda_m2` saiu do `ProformaInput`. Escrevê-lo aqui seria
  // mover um campo que ninguém mais lê, o que faria a bisseção parecer estar
  // testando algo que não testa.
  const margemNoPreco = (p: number): number => {
    const produtos = e.produtos?.map((x) => ({ ...x, preco_venda_m2: p }));
    const teste: ProformaInput = lot
      ? { ...e, produtos }
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

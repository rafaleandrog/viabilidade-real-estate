// Montadores do dossiê do projeto — transformam o que as telas JÁ calculam ou carregam em
// `DadosDossie` (`frontend/dossie.ts`). Puros: sem DOM, sem I/O, sem Lit.
//
// Regra de ouro deste arquivo: NENHUMA fórmula nasce aqui. Cada número sai da MESMA função e do
// MESMO objeto calculado que a tela usa (`calcularProforma`, `calcularFluxo`, `indicadoresCenario`,
// `visaoInvestidor`, `indicadoresOperacao`, `lerIndicador`…) e passa pelo MESMO formatador
// (`fmtR$`, `fmtPct`, `fmtNum`). O que o dossiê escolhe é QUAIS grandezas entram e em que ordem.
//
// Os valores monetários saem em `fmtR$` (2 casas), como os KPIs do PDF da Proforma: as três
// exceções de exibição do contrato (card de KPI, cascata e coluna R$ da Proforma) não se estendem
// a este documento.
//
// Seção sem dado não é montada aqui (a função devolve `null`) e, mesmo que fosse, o documento a
// omite (`secaoTemConteudo`). Os rótulos seguem os da tela de onde o número vem — o inventário de
// `frontend/rotulos-indicador.ts` continua valendo, um rótulo para uma fórmula.
import {
  calcularProforma, vgvBrutoDeProforma, vgvProduto, produtosDoEstudo, produtoCompoeCatalogo, tipoProdutoEfetivo,
  type Proforma, type ProformaInput,
} from './proforma.js';
import { proformaAvancado } from './proforma-avancado.js';
import { calcularFluxo, aplicarCenario, pctDeReceitaBruta, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { indicadoresCenario } from './cenarios-padrao.js';
import { visaoInvestidor } from './visao-investidor.js';
import { indicadoresOperacao, tranchesDeInvestimento, eDivida, type FundingCalc, type OperacaoFunding } from './funding-motor.js';
import { LINHAS_SENSIBILIDADE, calcularLinha, particionarInvariantes, type LinhaCalculada } from './sensibilidade-tabela.js';
import { rotuloAlavanca, ehCustoLike } from './variaveis-sensibilidade.js';
import { kpiAreaPermutada } from './kpi-area-permutada.js';
import {
  lerIndicador, compararProjetoMercado, precoMedioM2Projeto, custoObraM2Projeto, vsoProjetoPct,
  ROTULO_ABRANGENCIA, ROTULO_CONFIANCA, type ProcedenciaIndicador,
} from './analise-mercado.js';
import { areaPrivativaTotalLinhas, rotuloMesRelativo, type EventoCrono } from './fluxo-shared.js';
import { fmtR$, fmtNum, fmtPct, fmtPctOuIndef } from './viab-format.js';
import { secaoTemConteudo, type DadosDossie, type DossieKpi, type DossieSecao, type DossieTabela } from './dossie.js';

const n = (v: any): number => Number(v) || 0;
const texto = (v: unknown): string => String(v ?? '').trim();
const nomeDoEstudo = (e: any): string => texto(e?.nome_exibicao) || texto(e?.nome);

/** `null` quando a seção não tem conteúdo nenhum — quem monta a lista descarta. */
function secao(s: DossieSecao): DossieSecao | null {
  return secaoTemConteudo(s) ? s : null;
}
const somenteComDado = (lista: (DossieSecao | null)[]): DossieSecao[] =>
  lista.filter((s): s is DossieSecao => s !== null);

// ─────────────────────────────────────────────────────────────────────────
// Apelo Comercial (IA) — compartilhado entre os dois níveis
// ─────────────────────────────────────────────────────────────────────────

/**
 * O resultado da análise de Apelo Comercial, como `viab-tela-apelo` o desenha: o score geral, a
 * nota consolidada de cada fator (+ a justificativa geral dele) e as quatro listas do relatório.
 * `apelo` é `res.apelo` de `GET /estudos/:id/apelo-comercial`; sem `resultado` (nenhuma análise
 * rodou) a tela mostra estado vazio e o dossiê omite a seção.
 */
export function secaoApelo(apelo: any, titulo: string): DossieSecao | null {
  const r = apelo?.resultado;
  if (!r) return null;
  const fatores: any[] = Array.isArray(r.fatores) ? r.fatores : [];
  const kpis: DossieKpi[] = [
    { rotulo: 'Score geral', valor: texto(apelo?.score_geral ?? '—') || '—' },
    ...fatores.map((f) => ({ rotulo: texto(f?.nome), valor: texto(f?.nota_consolidada ?? '—') || '—' })),
  ];
  const lista = (t: string, itens: unknown) =>
    ({ titulo: t, itens: (Array.isArray(itens) ? itens : []).map(texto).filter((i) => i !== '') });
  const rel = r.relatorio ?? {};
  return secao({
    id: 'apelo', titulo, kpis,
    paragrafos: fatores
      .filter((f) => texto(f?.justificativa_geral) !== '')
      .map((f) => `${texto(f?.nome)}: ${texto(f?.justificativa_geral)}`),
    listas: [
      lista('Vantagens', rel.vantagens), lista('Desvantagens', rel.desvantagens),
      lista('Ganhos', rel.ganhos), lista('Riscos', rel.riscos),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PRELIMINAR
// ─────────────────────────────────────────────────────────────────────────

export interface EntradaDossiePreliminar {
  estudo: any;
  /** O MESMO `ProformaInput` que `viab-tela-proforma` passa a `calcularProforma` (estudo + RET + catálogo). */
  entrada: ProformaInput;
  /** Benchmarks do tipo de empreendimento — a variação do estresse de preço vem deles. */
  benchmarks: any[];
  /** `res.apelo` do Apelo Comercial; `null`/ausente = sem análise. */
  apelo?: any | null;
}

function secaoIdentificacaoPreliminar(estudo: any, entrada: ProformaInput, p: Proforma, lot: boolean): DossieSecao | null {
  const kpis: DossieKpi[] = [];
  if (texto(estudo?.uf)) kpis.push({ rotulo: 'UF', valor: texto(estudo.uf) });
  if (texto(estudo?.matricula)) kpis.push({ rotulo: 'Matrícula', valor: texto(estudo.matricula) });
  if (p.areaTerreno > 0) kpis.push({ rotulo: 'Área do terreno', valor: `${fmtNum(p.areaTerreno)} m²` });
  kpis.push({ rotulo: 'Área vendável', valor: `${fmtNum(p.areaVendavel)} m²` });
  if (!lot) {
    kpis.push({ rotulo: 'Área privativa', valor: `${fmtNum(p.areaPrivativa)} m²` });
    kpis.push({ rotulo: 'Área construída', valor: `${fmtNum(p.areaConstruida)} m²` });
  } else {
    kpis.push({ rotulo: 'Vendável / gleba', valor: fmtPctOuIndef(p.eficienciaPct) });
  }
  kpis.push({ rotulo: 'Nº de unidades', valor: fmtNum(p.numUnidades) });

  // O catálogo é o que COMPÕE o VGV — a linha em branco de "Adicionar Produto" não é produto.
  const produtos = (produtosDoEstudo(entrada).filter(produtoCompoeCatalogo) as any[]);
  const tipo = (x: any) => tipoProdutoEfetivo(x) === 'residencial' ? 'Residencial' : (lot ? 'Comercial' : 'Não residencial');
  const tabela: DossieTabela = {
    titulo: 'Tipologias',
    colunas: ['Produto', 'Tipo', 'Unidades', 'Área média (m²)', 'Preço (R$/m²)', 'VGV bruto'],
    linhas: produtos.map((x) => [
      texto(x.nome) || 'Produto', tipo(x), fmtNum(n(x.unidades)), fmtNum(n(x.area_media_m2), 2),
      fmtR$(n(x.preco_venda_m2)), fmtR$(vgvProduto(x)),
    ]),
  };
  return secao({
    id: 'identificacao', titulo: 'Identificação do empreendimento', kpis, tabelas: [tabela],
    paragrafos: texto(estudo?.descricao) ? [texto(estudo.descricao)] : [],
  });
}

function secaoIndicadoresPreliminar(p: Proforma): DossieSecao | null {
  const kpis: DossieKpi[] = [
    { rotulo: 'VGV', valor: fmtR$(p.vgv) },
    { rotulo: 'Receita líquida', valor: fmtR$(p.receitaLiquida) },
    { rotulo: 'Resultado', valor: fmtR$(p.resultado) },
    { rotulo: 'Margem sobre VGV', valor: fmtPctOuIndef(p.margemLiquidaPct) },
    { rotulo: 'Custo obras / VGV', valor: fmtPctOuIndef(p.custoObrasVgvPct) },
    { rotulo: 'ROI', valor: fmtPctOuIndef(p.roiPct) },
    { rotulo: 'Investimento (custo direto + indireto)', valor: fmtR$(p.investimentoTotal) },
  ];
  // Área permutada: o mesmo card (e a mesma nota) que a faixa de KPIs da Proforma.
  const permuta = kpiAreaPermutada(p.areaPermutaFisica, p.permutaFinResidencial + p.permutaFinNaoResidencial);
  if (permuta) kpis.push({ rotulo: permuta.rot, valor: permuta.val });
  return secao({
    id: 'indicadores', titulo: 'Indicadores principais', kpis,
    paragrafos: permuta?.nota ? [permuta.nota] : [],
  });
}

/**
 * O estresse de PREÇO da aba Cenários do Preliminar (a variável que a tela abre selecionada), com a
 * variação do benchmark `preco` e o mesmo fallback de ±10%. Bear/Base/Bull rodam `calcularProforma`
 * sobre o MESMO `ProformaInput`, e as linhas são as de `LINHAS_SENSIBILIDADE`, as que a tela
 * publica — as invariantes (que não se movem com o preço) ficam de fora, como a tela as recolhe.
 */
function secaoCenariosPreliminar(entrada: ProformaInput, benchmarks: any[], lot: boolean): DossieSecao | null {
  const bm = (benchmarks ?? []).find((b) => b?.campo === 'preco');
  const varPos = Number(bm?.variacao_positiva_pct) || 10;
  const varNeg = Number(bm?.variacao_negativa_pct) || 10;
  const variavel = 'preco' as const;
  const custoLike = ehCustoLike(variavel);
  const fatorBull = custoLike ? 1 - varPos / 100 : 1 + varPos / 100;
  const fatorBear = custoLike ? 1 + varNeg / 100 : 1 - varNeg / 100;
  const cenario = (fator: number) => {
    const p = calcularProforma({ ...entrada, sensibilidade: { variavel, fator } });
    return { p, vgvBruto: vgvBrutoDeProforma(p) };
  };
  const bear = cenario(fatorBear), base = cenario(1), bull = cenario(fatorBull);
  if (base.p.semProdutos) return null;
  const calculadas: LinhaCalculada[] = LINHAS_SENSIBILIDADE.map((m) => calcularLinha(m, {
    bear: m.f(bear), base: m.f(base), bull: m.f(bull),
  }));
  const monetarias = calculadas.filter((x) => !x.linha.divisoria && !x.linha.badge);
  const indicadores = calculadas.filter((x) => x.linha.divisoria || x.linha.badge);
  const { visiveis } = particionarInvariantes(monetarias);
  const fmt = (x: LinhaCalculada, v: number | null) => v === null ? '—' : (x.linha.pct ? fmtPct(v) : fmtR$(v));
  const rotVar = rotuloAlavanca(variavel, lot);
  return secao({
    id: 'cenarios', titulo: 'Cenários',
    tabelas: [{
      titulo: `Sensibilidade — ${rotVar}`,
      colunas: ['Indicador', `Bear (−${varNeg}%)`, 'Base', `Bull (+${varPos}%)`],
      linhas: [...visiveis, ...indicadores].map((x) => [
        x.linha.l, fmt(x, x.valores.bear), fmt(x, x.valores.base), fmt(x, x.valores.bull),
      ]),
      nota: `Estresse de −${varNeg}% e +${varPos}% em ${rotVar.toLowerCase()}, como na aba Cenários do estudo.`,
    }],
  });
}

/** O dossiê de um estudo PRELIMINAR: identificação, indicadores, cenários (sensibilidade) e análise de mercado do imóvel (IA). */
export function dossiePreliminar(e: EntradaDossiePreliminar): DadosDossie {
  const lot = e.estudo?.tipo_empreendimento === 'loteamento';
  const p = calcularProforma(e.entrada);
  // Sem produtos que componham VGV a tela não desenha Proforma: não há o que apresentar além da identificação.
  const comReceita = !p.semProdutos;
  return {
    nome: nomeDoEstudo(e.estudo), tipo: e.estudo?.tipo_empreendimento, status: e.estudo?.status, nivel: 'Preliminar',
    secoes: somenteComDado([
      secaoIdentificacaoPreliminar(e.estudo, e.entrada, p, lot),
      comReceita ? secaoIndicadoresPreliminar(p) : null,
      comReceita ? secaoCenariosPreliminar(e.entrada, e.benchmarks, lot) : null,
      secaoApelo(e.apelo, 'Análise de Mercado do Imóvel (IA)'),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// AVANÇADO
// ─────────────────────────────────────────────────────────────────────────

/** Os rótulos dos quatro tipos de operação — os mesmos do seletor de `viab-tela-funding`. */
export const ROTULO_TIPO_OPERACAO: Record<string, string> = {
  financiamento_producao: 'Financiamento à produção',
  divida: 'Dívida',
  equity: 'Equity',
  antecipacao_recebiveis: 'Antecipação de recebíveis',
};

export interface EntradaDossieAvancado {
  estudo: any;
  /** As linhas e o cronograma que `viab-fluxo-ver` carregou (`dados`). */
  dados: { receitas: any[]; tipologias: any[]; crono: EventoCrono[]; dataInicio: string | null; taxa: number };
  /** O `FluxoCalc` do PROJETO INTEIRO (`calcProjeto`), o mesmo de ROI do projeto e Visão do investidor. */
  calc: FluxoCalc;
  /** O `FluxoConfig` do projeto inteiro (`_configFluxo(receitas)`) — base dos cenários salvos. */
  config: FluxoConfig;
  operacoes: OperacaoFunding[];
  /** O funding sobre `calc` (`fundingCalcProjeto`); `null` sem operações. */
  fundingCalc: FundingCalc | null;
  /** Cenários salvos (`GET /estudos/:id/avancado/cenarios`). */
  cenarios: any[];
  /** `GET /estudos/:id/analise-mercado`: `{ analise, regiao }`; `null` sem resposta. */
  mercado?: { analise: any; regiao: any } | null;
  apelo?: any | null;
}

function secaoIdentificacaoAvancado(e: EntradaDossieAvancado): DossieSecao | null {
  const { estudo, dados } = e;
  const area = areaPrivativaTotalLinhas(dados.receitas);
  const unidades = dados.receitas.reduce(
    (s: number, l: any) => s + (l.tipologias ?? []).reduce((si: number, t: any) => si + n(t.quantidade), 0), 0);
  const terreno = n(estudo?.terreno_manual_area) || n(estudo?.area_terreno_nucleo);
  const kpis: DossieKpi[] = [];
  if (texto(estudo?.uf)) kpis.push({ rotulo: 'UF', valor: texto(estudo.uf) });
  if (texto(estudo?.matricula)) kpis.push({ rotulo: 'Matrícula', valor: texto(estudo.matricula) });
  if (terreno > 0) kpis.push({ rotulo: 'Área do terreno', valor: `${fmtNum(terreno)} m²` });
  // Os KPIs somam as LINHAS DE RECEITA (o que entra no fluxo e no VGV); a tabela
  // abaixo é o CATÁLOGO, que pode ter unidades ainda não alocadas a uma linha.
  // Cada bloco diz a sua base no rótulo, para os dois números não parecerem o
  // mesmo dado em desacordo.
  if (area > 0) kpis.push({ rotulo: 'Área privativa nas receitas', valor: `${fmtNum(area)} m²` });
  if (unidades > 0) kpis.push({ rotulo: 'Unidades nas receitas', valor: fmtNum(unidades) });
  const tipologias = dados.tipologias.filter((t: any) => texto(t?.nome) !== '' || n(t?.quantidade) > 0);
  return secao({
    id: 'identificacao', titulo: 'Identificação do empreendimento', kpis,
    tabelas: [{
      titulo: 'Catálogo de tipologias',
      colunas: ['Tipologia', 'Dorm.', 'Vagas', 'Área privativa (m²)', 'Unidades no catálogo', 'Preço (R$/m²)'],
      linhas: tipologias.map((t: any) => [
        texto(t.nome) || 'Tipologia', fmtNum(n(t.dormitorios)), fmtNum(n(t.vagas)),
        fmtNum(n(t.area_privativa_m2) + n(t.area_privativa_aberta_m2), 2), fmtNum(n(t.quantidade)), fmtR$(n(t.preco_m2)),
      ]),
    }],
    paragrafos: texto(estudo?.descricao) ? [texto(estudo.descricao)] : [],
  });
}

function secaoIndicadoresAvancado(e: EntradaDossieAvancado): DossieSecao | null {
  const c = e.calc;
  const ind = indicadoresCenario(c);
  const expMag = Math.abs(c.exposicaoMaxima);
  const mesTxt = (mes: number | null) => mes === null ? '' : ` — ${c.meses[mes] ?? `M${mes + 1}`}`;
  const kpis: DossieKpi[] = [
    { rotulo: 'VGV potencial', valor: fmtR$(ind.vgv) },
    { rotulo: 'Receita Bruta — VGV', valor: fmtR$(c.receitaBruta) },
    { rotulo: 'Resultado', valor: fmtR$(ind.resultado) },
    { rotulo: 'Margem de caixa', valor: ind.margemPct === null ? '—' : fmtPct(ind.margemPct) },
    { rotulo: 'TIR', valor: c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.` },
    { rotulo: 'VPL', valor: fmtR$(c.vpl) },
    { rotulo: 'Payback', valor: c.paybackData ?? '—' },
    {
      rotulo: 'Exposição máxima (fluxo livre)',
      valor: `${fmtR$(expMag)} · ${fmtPct(pctDeReceitaBruta(expMag, c.receitaBruta))} do VGV${mesTxt(c.mesExposicaoMaxima)}`,
    },
    { rotulo: 'Juros de clientes', valor: fmtR$(c.jurosClientes) },
    {
      rotulo: 'Carteira máxima de clientes',
      valor: `${fmtR$(c.carteiraClientesMaxima)} · ${fmtPct(pctDeReceitaBruta(c.carteiraClientesMaxima, c.receitaBruta))} do VGV${mesTxt(c.mesCarteiraClientesMaxima)}`,
    },
  ];
  // ROI do projeto: o `roiPct` de `proformaAvancado`, o mesmo do card "ROI do projeto" e do Painel.
  const roi = proformaAvancado(c, areaPrivativaTotalLinhas(e.dados.receitas)).roiPct;
  if (roi !== null) kpis.push({ rotulo: 'ROI do projeto', valor: fmtPct(roi) });

  // Visão do investidor: só entra o que existe ("—" na tela vira ausência aqui).
  const v = visaoInvestidor({
    funding: e.fundingCalc, fluxoLivreMensal: c.fluxoMensal, exposicaoMaxima: c.exposicaoMaxima, vgvTotal: c.vgvTotal,
  });
  if (v.equityMultiple !== null) kpis.push({ rotulo: 'Equity Multiple', valor: `${fmtNum(v.equityMultiple, 2)}×` });
  if (v.yieldPct !== null) kpis.push({ rotulo: 'Yield a.a. (sobre a exposição máxima)', valor: fmtPct(v.yieldPct) });
  for (const l of v.ltvs) {
    if (l.ltvPct === null) continue;
    kpis.push({
      rotulo: `LTV — ${l.nome} (${l.tipo === 'divida' ? 'Dívida' : 'Financiamento à produção'})`,
      valor: fmtPct(l.ltvPct),
    });
  }
  return secao({ id: 'indicadores', titulo: 'Indicadores principais', kpis });
}

/**
 * Os cenários SALVOS do estudo, na ordem da aba Cenários: a linha "Cenário real" e uma por cenário,
 * cada um calculado por `calcularFluxo(aplicarCenario(config, alavancas))` — o `_calc` da tela — e
 * lido por `indicadoresCenario`, as mesmas colunas de VGV, Resultado, Margem, VPL, TIR e Exposição.
 * Sem nenhum cenário salvo a seção some: o "Cenário real" sozinho não é um resumo de cenários.
 */
function secaoCenariosAvancado(e: EntradaDossieAvancado): DossieSecao | null {
  const salvos = (e.cenarios ?? []).filter((c) => c && typeof c === 'object');
  if (salvos.length === 0) return null;
  const pctTxt = (v: number) => `${v > 0 ? '+' : ''}${v}%`;
  const linha = (nome: string, alavancas: [string, string, string], c: FluxoCalc): string[] => {
    const i = indicadoresCenario(c);
    return [
      nome, ...alavancas, fmtR$(i.vgv), fmtR$(i.resultado), i.margemPct === null ? '—' : fmtPct(i.margemPct),
      fmtR$(c.vpl), c.tir === null ? '—' : fmtPct(c.tir), c.paybackData ?? '—', fmtR$(Math.abs(c.exposicaoMaxima)),
    ];
  };
  return secao({
    id: 'cenarios', titulo: 'Cenários',
    tabelas: [{
      colunas: ['Cenário', 'Preço', 'Custo de obra', 'Velocidade', 'VGV potencial', 'Resultado', 'Margem de caixa', 'VPL', 'TIR', 'Payback', 'Exposição'],
      linhas: [
        linha('Cenário real', ['—', '—', '—'], e.calc),
        ...salvos.map((c) => {
          const params = { precoVendaPct: n(c.preco_venda_pct), custoObraPct: n(c.custo_obra_pct), velocidadeVendasPct: n(c.velocidade_vendas_pct) };
          return linha(
            texto(c.nome) || 'Cenário',
            [pctTxt(params.precoVendaPct), pctTxt(params.custoObraPct), pctTxt(params.velocidadeVendasPct)],
            calcularFluxo(aplicarCenario(e.config, params)),
          );
        }),
      ],
    }],
  });
}

/**
 * A estrutura de funding: as operações cadastradas, o fluxo livre contra o alavancado e, quando há
 * dívida ou equity, o retorno por parte — os mesmos cards da Análise Financeira e da aba Funding,
 * sobre o projeto inteiro. Sem operação nenhuma, a seção some.
 */
function secaoFunding(e: EntradaDossieAvancado): DossieSecao | null {
  if (e.operacoes.length === 0) return null;
  const dataInicio = e.dados.dataInicio;
  const tabelas: DossieTabela[] = [{
    titulo: 'Operações',
    colunas: ['Operação', 'Tipo', 'Valor', 'Taxa a.a.', 'Início'],
    linhas: e.operacoes.map((op) => [
      texto(op.nome) || ROTULO_TIPO_OPERACAO[op.tipo] || texto(op.tipo),
      ROTULO_TIPO_OPERACAO[op.tipo] ?? texto(op.tipo),
      n(op.valor) > 0 ? fmtR$(n(op.valor)) : '—',
      n(op.taxa_anual) > 0 ? fmtPct(n(op.taxa_anual)) : '—',
      op.tipo === 'financiamento_producao' ? '—' : rotuloMesRelativo(dataInicio, n(op.inicio_mes)),
    ]),
    nota: 'Valor: aporte da dívida ou do equity e teto de crédito do financiamento à produção ("—" sem teto).',
  }];

  const f = e.fundingCalc;
  const livre = e.calc.fluxoMensal.reduce((s, v) => s + v, 0);
  const real = f ? f.noFluxo.fluxoMensal.reduce((s, v) => s + v, 0) : livre;
  const custoFunding = f
    ? f.noFluxo.linhasSaida.reduce((s, l) => s + l.total, 0) - f.noFluxo.entradas.reduce((s, v) => s + v, 0)
    : 0;
  tabelas.push({
    titulo: 'Fluxo de Caixa Livre × Fluxo de Caixa',
    colunas: ['Linha', 'R$'],
    linhas: [
      ['Fluxo de Caixa Livre (sem despesas financeiras)', fmtR$(livre)],
      ['(-) Efeito líquido do funding (saídas − entradas)', fmtR$(-custoFunding)],
      ['= Fluxo de Caixa', fmtR$(real)],
    ],
    nota: 'TIR, VPL e Payback são desalavancados: leem o Fluxo de Caixa Livre.',
  });

  const tranches = tranchesDeInvestimento(f);
  if (tranches.length > 0) {
    const taxa = e.dados.taxa;
    tabelas.push({
      titulo: 'Retorno por parte',
      colunas: ['Parte', 'Investimento', 'Retorno total', 'Lucro', 'MOIC', 'TIR a.a.', 'VPL', 'Payback'],
      linhas: [
        ['Incorporador — resíduo de caixa', '—', fmtR$(real), '—', '—', '—', '—', '—'],
        ...tranches.map((s) => {
          const ind = indicadoresOperacao(s, taxa);
          const investiu = ind.investimentoTotal < 0;
          return [
            `${texto(s.operacao.nome) || (eDivida(s.operacao.tipo) ? 'Dívida' : 'Equity')} (${eDivida(s.operacao.tipo) ? 'Dívida' : 'Equity'})`,
            fmtR$(ind.investimentoTotal), fmtR$(ind.retornoTotal), fmtR$(ind.lucro),
            investiu ? `${fmtNum(ind.moic, 2)}×` : '—',
            ind.tirAnual === null ? '—' : fmtPct(ind.tirAnual * 100),
            fmtR$(ind.vpl),
            ind.paybackMes === null ? '—' : rotuloMesRelativo(dataInicio, ind.paybackMes),
          ];
        }),
      ],
      nota: 'O incorporador fica com o resíduo e sai sem ROI: o app não modela o capital próprio dele.',
    });
  }
  return secao({ id: 'funding', titulo: 'Estrutura de funding', tabelas });
}

/**
 * A análise de mercado: projeto × mercado (preço, custo de obra, velocidade de vendas) e os
 * indicadores macro, SÓ onde há dado de mercado com procedência — `lerIndicador` trata número sem
 * origem como ausente, e a seção some quando nada tem dado, em vez de repetir o "sem análise" da tela.
 */
function secaoMercado(e: EntradaDossieAvancado): DossieSecao | null {
  const m = e.mercado?.analise ?? null;
  if (!m) return null;
  const receitas = e.dados.receitas;
  // Mesma base de área da tela de Análise de Mercado: só a parte fechada × quantidade.
  const areaPriv = receitas.reduce((s: number, l: any) => s + (l.tipologias ?? []).reduce(
    (si: number, t: any) => si + n(t.area_privativa_m2) * n(t.quantidade), 0), 0);
  const projetoPreco = precoMedioM2Projeto(receitas);
  const projetoCusto = custoObraM2Projeto(e.calc.linhasCusto, areaPriv);
  const projetoVso = vsoProjetoPct(receitas, e.dados.crono);
  const comparacoes: { rotulo: string; projeto: number | null; ind: ProcedenciaIndicador; fmt: (v: number) => string }[] = [
    { rotulo: 'Preço de venda (R$/m²)', projeto: projetoPreco, ind: lerIndicador(m, 'preco_medio_m2'), fmt: fmtR$ },
    { rotulo: 'Custo de obra (R$/m²)', projeto: projetoCusto, ind: lerIndicador(m, 'custo_obra_m2'), fmt: fmtR$ },
    { rotulo: 'Velocidade de vendas (%/mês)', projeto: projetoVso, ind: lerIndicador(m, 'vso_pct'), fmt: fmtPct },
  ].filter((x) => x.ind.valor !== null);
  const macros = [
    { rotulo: 'IPCA (12m)', campo: 'ipca_pct' }, { rotulo: 'Selic', campo: 'selic_pct' },
    { rotulo: 'INCC (12m)', campo: 'incc_pct' }, { rotulo: 'Focus · IPCA', campo: 'focus_ipca_pct' },
    { rotulo: 'Focus · Selic', campo: 'focus_selic_pct' },
  ].map((x) => ({ ...x, ind: lerIndicador(m, x.campo) })).filter((x) => x.ind.valor !== null);
  if (comparacoes.length === 0 && macros.length === 0) return null;

  const origem = (ind: ProcedenciaIndicador) => `${ind.origem} (${ROTULO_CONFIANCA[ind.confianca] ?? ind.confianca})`;
  const tabelas: DossieTabela[] = [];
  if (comparacoes.length > 0) {
    tabelas.push({
      titulo: 'Projeto × mercado',
      colunas: ['Indicador', 'Projeto', 'Mercado', 'Diferença', 'Origem'],
      linhas: comparacoes.map((x) => {
        const cmp = compararProjetoMercado(x.projeto, x.ind.valor);
        return [
          x.rotulo, x.projeto === null ? '—' : x.fmt(x.projeto), x.fmt(x.ind.valor as number),
          !cmp ? '—' : (cmp.posicao === 'alinhado'
            ? 'Alinhado com o mercado'
            : `${fmtPct(Math.abs(cmp.deltaPct))} ${cmp.posicao} do mercado (${x.fmt(Math.abs(cmp.delta))})`),
          origem(x.ind),
        ];
      }),
    });
  }
  if (macros.length > 0) {
    tabelas.push({
      titulo: 'Indicadores macro',
      colunas: ['Indicador', 'Valor', 'Origem'],
      linhas: macros.map((x) => [x.rotulo, fmtPct(x.ind.valor as number), origem(x.ind)]),
    });
  }
  const regiao = e.mercado?.regiao;
  const local = texto(m?.localidade)
    || (regiao ? `${texto(regiao.nome)}${texto(regiao.uf) ? `/${texto(regiao.uf)}` : ''}` : '')
    || texto(e.estudo?.uf);
  const abr = texto(m?.abrangencia) || 'municipio';
  const limitacoes = texto(m?.resultado?.limitacoes);
  const paragrafos = [
    `${local ? `Localidade: ${local}. ` : ''}${m?.data_referencia ? `Referência: ${texto(m.data_referencia)}. ` : ''}`.trim(),
    abr !== 'municipio' ? `Sem dado no nível da cidade — análise limitada a ${ROTULO_ABRANGENCIA[abr] ?? abr}.` : '',
    limitacoes,
    'Dados de mercado externos, apenas para referência — não é recomendação de investimento.',
  ].filter((p) => p !== '');
  const observacoes = [...comparacoes, ...macros].filter((x) => x.ind.observacao !== '')
    .map((x) => `${x.rotulo}: ${x.ind.observacao}`);
  return secao({
    id: 'mercado', titulo: 'Análise de mercado', tabelas, paragrafos,
    listas: [{ titulo: 'Observações da análise', itens: observacoes }],
  });
}

/** O dossiê de um estudo AVANÇADO: identificação, indicadores (com a visão do investidor), cenários salvos, funding, mercado e Apelo Comercial. */
export function dossieAvancado(e: EntradaDossieAvancado): DadosDossie {
  return {
    nome: nomeDoEstudo(e.estudo), tipo: e.estudo?.tipo_empreendimento, status: e.estudo?.status, nivel: 'Avançado',
    secoes: somenteComDado([
      secaoIdentificacaoAvancado(e),
      secaoIndicadoresAvancado(e),
      secaoCenariosAvancado(e),
      secaoFunding(e),
      secaoMercado(e),
      secaoApelo(e.apelo, 'Apelo Comercial do Imóvel (IA)'),
    ]),
  };
}

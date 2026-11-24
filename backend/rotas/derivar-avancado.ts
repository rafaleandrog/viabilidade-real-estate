import { Router, type Request, type Response } from 'express';
import { exigirEditor, garantirMembro, type ExecutorDados } from '../permissoes-estudo.js';
import { publicarEvento, inscreverMembroEstudo, payloadEstudoCriado } from '../eventos-viabilidade.js';
import { gerarIdentificacao } from '../identificacao.js';
import { montarCopiaEstudo, montarCopiasFilhas, FILHAS_SIMPLES } from './estudos.js';
import {
  absorcaoPadrao, ancorarLinhaCusto, cronogramaPadrao, fluxoPagamentoDeNascimento, recalcularTravados,
  type LinhaCronograma,
} from './avancado.js';
import { omitirValoresNulos } from './duplicar-utils.js';
import { coagirNumericosOuLancar, idDeRota, numeroEstrito } from './coercao-numerica.js';
import {
  calcularProforma, catalogoEfetivo, produtoCompoeCatalogo, produtosDoEstudo, tipoProdutoEfetivo,
  vgvBrutoDeProforma, type ProformaInput,
} from '../../frontend/proforma.js';
import { unidadesPermutadasDoProduto } from '../../frontend/permuta-produtos.js';
import {
  areaPrivativaTotalLinhas, CATEGORIA_CONSTRUCAO, CATEGORIA_CORRETAGEM, CATEGORIA_MANUTENCAO_POS_OBRA,
  CATEGORIA_MARKETING_DIRETOS, CATEGORIA_PRECO_TERRENO, CATEGORIA_PROJETOS, resolverCustoTotal,
  SUBCATEGORIA_PERMUTA_FINANCEIRA, SUBCATEGORIA_PERMUTA_FISICA, totalConstrucaoCustos, vgvTipologia,
  vgvVendavelTipologia, type ContextoCusto,
} from '../../frontend/fluxo-shared.js';
import { chaveTipologiaLinha, reservarPermutasFisicas } from '../../frontend/fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────
// Criação de um estudo AVANÇADO a partir de um PRELIMINAR
//
// O Preliminar nunca é alterado: o Avançado nasce como estudo NOVO, pré-preenchido
// com o que o Preliminar já sabe. Tudo que não tem equivalente exato vira item do
// relatório — nunca um "igual" que não é.
//
// Duas partes, de propósito:
//   · `planejarDerivacao` — PURA, sem I/O. Recebe o estudo e o catálogo como vêm do
//     Postgres (decimais em string) e devolve o que gravar e o que declarar.
//   · `executarDerivacao` — só I/O, na ordem das dependências. Roda dentro da
//     transação da rota.
// ─────────────────────────────────────────────────────────────────

export const rotasDerivarAvancado: ReturnType<typeof Router> = Router();

export interface OpcoesDerivacao {
  /** Alíquota do RET (parâmetro da app); `null` quando não pôde ser lida. */
  aliquotaRet: number | null;
  /** Cronograma padrão do Avançado, já com os eventos travados recalculados. */
  cronograma: LinhaCronograma[];
  /** Data do cabeçalho das notas, `dd/mm/aaaa`. */
  hoje: string;
}

export interface ItemRelatorio {
  origem: string;
  destino: string;
  regra: string;
  nota?: string;
  alerta?: boolean;
}

export interface TipologiaPlanejada {
  nome: string;
  tipo_unidade: string;
  area_privativa_m2: number;
  area_privativa_aberta_m2: number;
  quantidade: number;
  preco_m2: number;
  ordem: number;
}

export interface GrupoPlanejado {
  tipo: 'receita';
  nome: string;
  ordem: number;
  absorcao: Record<string, any>;
  fluxo_pagamento: Record<string, any>;
}

export interface AlocacaoPlanejada {
  /** Posição da tipologia em `tipologias` — o id só existe depois do `criar`. */
  tipologiaIndice: number;
  unidades: number;
  preco_m2: number;
  ordem: number;
}

export interface CustoPlanejado {
  grupo: string;
  categoria: string;
  subcategoria?: string;
  orcamento_unidade: string;
  orcamento_valor: number | null;
  orcamento_valor_canonico: number | null;
  cronograma_evento: string;
  inicio_mes: number;
  duracao_meses: number;
  ordem: number;
  /** Só na permuta física: posição da tipologia em `tipologias`. */
  permuta_tipologia_indice?: number;
  permuta_quantidade?: number;
}

export interface ConferenciaVgv {
  vgvPreliminarBruto: number;
  vgvAvancado: number;
  diferencaAreaAberta: number;
  diferencaQuantizacao: number;
}

export interface PlanoDerivacao {
  copiaEstudo: Record<string, any>;
  tipologias: TipologiaPlanejada[];
  grupo: GrupoPlanejado;
  alocacoes: AlocacaoPlanejada[];
  custos: CustoPlanejado[];
  relatorio: ItemRelatorio[];
  conferencia: ConferenciaVgv;
  /**
   * As linhas CRUAS do catálogo que geraram este plano. O executor copia `preliminar_produtos`
   * a partir delas, e não de uma segunda leitura: uma edição do catálogo entre as duas leituras
   * faria tipologias/custos/conferência descreverem um catálogo e o estudo novo guardar outro.
   */
  produtosOrigem: Record<string, any>[];
}

// As doze colunas de permuta física do `estudos` (par residencial e par `_nr_`). NÃO viajam: no
// Avançado a permuta física é declarada por unidade, nas linhas de Custos — copiá-las criaria uma
// segunda camada que as Premissas do Avançado nem mostram.
const COLUNAS_PERMUTA_FISICA_ESTUDO = [
  'permuta_fisica_modo', 'permuta_fisica_area_m2', 'permuta_fisica_area_canonica',
  'permuta_fisica_pct', 'permuta_fisica_produto_id', 'permuta_fisica_quantidade',
  'permuta_fisica_nr_modo', 'permuta_fisica_nr_area_m2', 'permuta_fisica_nr_area_canonica',
  'permuta_fisica_nr_pct', 'permuta_fisica_nr_produto_id', 'permuta_fisica_nr_quantidade',
] as const;

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v: number): number => Math.round(v * 100) / 100;
const centavos = (v: number): number => Math.round(v * 100);
const TOL_CENTAVO = 0.005;

const brl = (v: number): string => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const m2txt = (v: number): string => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

type Familia = 'R' | 'NR';

/** Linha de custo em construção: o que gravar + o que o relatório precisa para falar dela. */
interface CandidatoCusto {
  linha: CustoPlanejado;
  /** Rótulos para o relatório, em português de usuário final. */
  origem: string;
  destino: string;
  /** Valor efetivo do Preliminar (R$), quando a linha é percentual e deve ser conferida. */
  efetivoPercentual?: number;
  /** Complemento da nota quando o valor do Avançado diverge do efetivo. */
  notaBase?: string;
}

export function planejarDerivacao(
  estudo: Record<string, any>,
  produtos: Record<string, any>[],
  opts: OpcoesDerivacao,
): PlanoDerivacao {
  const lot = estudo.tipo_empreendimento === 'loteamento';
  const relatorio: ItemRelatorio[] = [];
  const item = (origem: string, destino: string, regra: string, nota?: string, alerta?: boolean): void => {
    const it: ItemRelatorio = { origem, destino, regra };
    if (nota) it.nota = nota;
    if (alerta) it.alerta = true;
    relatorio.push(it);
  };

  // ── O valor efetivo do Preliminar: UMA conta, fonte de tudo que segue ──
  const ordenados = [...(produtos ?? [])].sort((a, b) => (n(a.ordem) - n(b.ordem)) || (n(a.id) - n(b.id)));
  const entrada = {
    ...estudo,
    nivel_analise: 'preliminar',
    produtos: ordenados,
    aliquota_ret_pct: opts.aliquotaRet ?? undefined,
  } as ProformaInput;
  const p = calcularProforma(entrada);
  const derivados = produtosDoEstudo(entrada);
  const catalogo = catalogoEfetivo(derivados);

  derivados.forEach((prod: any, i) => {
    if (produtoCompoeCatalogo(prod)) return;
    item(
      `Produto "${String(prod.nome ?? '').trim() || `Produto ${i + 1}`}" do catálogo`,
      'Tipologias',
      'não levado (sem área, preço ou unidades)',
      'Só entra no Avançado o produto que compõe o VGV do Preliminar.',
    );
  });

  // ── Tipologias: uma por produto do catálogo efetivo ──
  const familias: Familia[] = catalogo.map((prod) => (lot || tipoProdutoEfetivo(prod) === 'residencial' ? 'R' : 'NR'));
  const tipologias: TipologiaPlanejada[] = catalogo.map((prod: any, i) => {
    const naoResidencial = !lot && familias[i] === 'NR';
    return {
      nome: String(prod.nome ?? '').trim() || `Produto ${i + 1}`,
      tipo_unidade: lot ? 'lote' : (naoResidencial ? 'loja' : 'apartamento'),
      area_privativa_m2: round2(n(prod.area_media_m2)),
      area_privativa_aberta_m2: 0,
      quantidade: n(prod.unidades),
      preco_m2: n(prod.preco_venda_m2),
      ordem: i,
    };
  });

  // Área aberta: rateada por unidade, proporcional à área fechada da família.
  if (!lot) {
    const abertaPorFamilia: Record<Familia, number> = {
      R: Math.max(0, n(estudo.area_pvt_r_aberta)),
      NR: Math.max(0, n(estudo.area_pvt_nr_aberta)),
    };
    const rotuloFamilia: Record<Familia, string> = { R: 'residencial', NR: 'não residencial' };
    for (const fam of ['R', 'NR'] as Familia[]) {
      const aberta = abertaPorFamilia[fam];
      if (aberta <= 0) continue;
      const indices = tipologias.map((_, i) => i).filter((i) => familias[i] === fam);
      const base = indices.reduce((s, i) => s + tipologias[i].area_privativa_m2 * tipologias[i].quantidade, 0);
      const origem = `Área privativa aberta ${rotuloFamilia[fam]} (${m2txt(aberta)})`;
      if (indices.length === 0 || base <= 0) {
        item(origem, 'Tipologias › área privativa aberta', 'não levada',
          'Não há produto desta família no catálogo para receber a área aberta; o Avançado não a representa.', true);
        continue;
      }
      for (const i of indices) {
        tipologias[i].area_privativa_aberta_m2 = round2(aberta * tipologias[i].area_privativa_m2 / base);
      }
      item(origem, 'Tipologias › área privativa aberta',
        'rateada por unidade, proporcional à área fechada de cada produto',
        'No Avançado a área aberta é valorizada ao mesmo preço da fechada; o Preliminar não a valoriza.');
    }
  }

  // ── Grupo de receita e alocações: 100% das unidades no grupo único ──
  const grupo: GrupoPlanejado = {
    tipo: 'receita',
    nome: '1º Grupo',
    ordem: 0,
    absorcao: absorcaoPadrao(estudo.tem_pre_lancamento !== false),
    fluxo_pagamento: fluxoPagamentoDeNascimento(opts.cronograma, Number(estudo.juros_tabela_aa_padrao) || 0),
  };
  const alocacoes: AlocacaoPlanejada[] = tipologias.map((t, i) => ({
    tipologiaIndice: i, unidades: t.quantidade, preco_m2: t.preco_m2, ordem: i,
  }));

  // ── Conferência do VGV (critério forte) ──
  const tipsMotor = tipologias.map((t, i) => ({ ...t, id: i + 1, tipologia_id: i + 1 }));
  const vgvAvancado = round2(tipsMotor.reduce((s, t) => s + vgvTipologia(t), 0));
  const vgvPreliminarBruto = round2(vgvBrutoDeProforma(p));
  const diferencaAreaAberta = round2(tipologias.reduce((s, t) => s + t.quantidade * t.area_privativa_aberta_m2 * t.preco_m2, 0));
  const diferencaQuantizacao = round2(vgvAvancado - vgvPreliminarBruto - diferencaAreaAberta);
  const conferencia: ConferenciaVgv = { vgvPreliminarBruto, vgvAvancado, diferencaAreaAberta, diferencaQuantizacao };
  if (centavos(diferencaAreaAberta) !== 0) {
    item('VGV bruto', 'Receitas › VGV total',
      `a área aberta soma ${brl(diferencaAreaAberta)} ao VGV`,
      `Preliminar ${brl(vgvPreliminarBruto)}; Avançado ${brl(vgvAvancado)}.`, true);
  }
  if (centavos(diferencaQuantizacao) !== 0) {
    item('VGV bruto', 'Receitas › VGV total',
      `diferença de ${brl(diferencaQuantizacao)} por arredondamento das áreas a 2 casas`,
      'O Avançado guarda a área por unidade com 2 casas; o Preliminar deriva a área do percentual com precisão plena.', true);
  }
  if (Math.abs(p.diferencaAreaAlocada) > TOL_CENTAVO) {
    item('Catálogo de produtos', 'Tipologias',
      `a área do catálogo difere da base em ${m2txt(Math.abs(p.diferencaAreaAlocada))}`,
      p.diferencaAreaAlocada > 0 ? 'Há mais área alocada nos produtos que a base do estudo.' : 'Sobra área da base sem produto.', true);
  }

  // ── Permuta física: linhas de Custos que reservam unidades ──
  const permutas: CandidatoCusto[] = [];
  const linhaPermuta = (indice: number, quantidade: number): CandidatoCusto => ({
    linha: {
      grupo: 'terreno', categoria: CATEGORIA_PRECO_TERRENO, subcategoria: SUBCATEGORIA_PERMUTA_FISICA,
      orcamento_unidade: 'rs', orcamento_valor: null, orcamento_valor_canonico: null,
      cronograma_evento: 'customizado', inicio_mes: 0, duracao_meses: 1, ordem: 0,
      permuta_tipologia_indice: indice, permuta_quantidade: quantidade,
    },
    origem: 'Permuta física', destino: 'Custos › Terreno › Preço › Permuta física',
  });
  for (const fam of (lot ? ['R'] : ['R', 'NR']) as Familia[]) {
    const rotulo = lot ? 'Permuta física' : `Permuta física ${fam === 'R' ? 'residencial' : 'não residencial'}`;
    const indices = tipologias.map((_, i) => i).filter((i) => familias[i] === fam);
    const porProduto = indices.filter((i) => unidadesPermutadasDoProduto(catalogo[i] as any) > 0);
    if (porProduto.length > 0) {
      for (const i of porProduto) {
        const un = Math.round(unidadesPermutadasDoProduto(catalogo[i] as any));
        const declarado = Number((catalogo[i] as any).unidades_permutadas);
        const limitado = Number.isFinite(declarado) && declarado > un + 1e-9;
        permutas.push(linhaPermuta(i, un));
        item(`${rotulo} — ${tipologias[i].nome}`, 'Custos › Terreno › Preço › Permuta física',
          `${un} unidade(s) da tipologia "${tipologias[i].nome}"`,
          limitado
            ? `O produto declara ${declarado} unidade(s) em permuta, mas tem só ${un}; a permuta foi limitada às unidades do produto (${un}).`
            : 'As unidades declaradas no produto foram levadas exatamente.',
          limitado);
      }
      continue;
    }
    const area = fam === 'R' ? p.areaPermutaResidencial : p.areaPermutaNaoResidencial;
    if (!(area > 0)) continue;
    let melhor: { i: number; u: number; residuo: number } | null = null;
    for (const i of indices) {
      const areaT = tipologias[i].area_privativa_m2;
      const qtd = tipologias[i].quantidade;
      if (!(areaT > 0) || !(qtd > 0)) continue;
      const u = Math.min(Math.round(area / areaT), qtd);
      if (u < 1) continue;
      const residuo = Math.abs(area - u * areaT);
      const vence = melhor === null
        || residuo < melhor.residuo - 1e-9
        || (Math.abs(residuo - melhor.residuo) <= 1e-9 && qtd > tipologias[melhor.i].quantidade);
      if (vence) melhor = { i, u, residuo };
    }
    if (!melhor) {
      item(`${rotulo} (${m2txt(area)})`, 'Custos › Terreno › Preço › Permuta física', 'não levada',
        'A área permutada não corresponde a nenhuma unidade inteira de tipologia do Avançado; declare a permuta por unidade em Custos.', true);
      continue;
    }
    permutas.push(linhaPermuta(melhor.i, melhor.u));
    item(`${rotulo} (${m2txt(area)})`, 'Custos › Terreno › Preço › Permuta física',
      `${melhor.u} unidade(s) da tipologia "${tipologias[melhor.i].nome}"`,
      `Convertida da área para unidades inteiras; resíduo de ${m2txt(melhor.residuo)}.`,
      melhor.residuo > TOL_CENTAVO ? true : undefined);
  }

  // ── Contexto de custo, montado como `calcularFluxo` o monta ──
  const linhaReceita = { id: 1, tipologias: tipsMotor };
  const linhasPermutaMotor = permutas.map((c) => ({
    ...c.linha, permuta_tipologia_id: (c.linha.permuta_tipologia_indice ?? 0) + 1,
  }));
  const reserva = reservarPermutasFisicas([linhaReceita], linhasPermutaMotor);
  const vgvTotalCtx = tipsMotor.reduce((s, t) => s + vgvTipologia(t), 0);
  const vgvVendavelCtx = tipsMotor.reduce((s, t, ti) => {
    const chave = chaveTipologiaLinha(linhaReceita, 0, t, ti);
    return s + vgvVendavelTipologia(t, reserva.usaFonteNova ? (reserva.porTipologia.get(chave) ?? 0) : undefined);
  }, 0);
  const ctx: ContextoCusto = {
    areaPrivativaTotal: areaPrivativaTotalLinhas([linhaReceita]),
    areaTerreno: Number(estudo.terreno_manual_area) || Number(estudo.area_terreno_nucleo) || 0,
    vgvTotal: vgvTotalCtx,
    vgvVendavel: vgvVendavelCtx,
  };

  const reconcilia = (unitario: number, base: number, efetivo: number): boolean =>
    unitario > 0 && base > 0 && centavos(round2(unitario * base)) === centavos(efetivo);

  // ── Custos ──
  const ancora = (evento: string): { evento: string; inicio_mes: number; duracao_meses: number } => {
    if (evento === 'customizado') return { evento, inicio_mes: 0, duracao_meses: 1 };
    const a = ancorarLinhaCusto(evento, opts.cronograma);
    if (a) return { evento, ...a };
    const b = ancorarLinhaCusto('lancamento', opts.cronograma);
    return b ? { evento: 'lancamento', ...b } : { evento: 'customizado', inicio_mes: 0, duracao_meses: 1 };
  };
  const novo = (
    grupoCusto: string, categoria: string, subcategoria: string | undefined, evento: string,
    unidade: string, valor: number | null, canonico: number | null,
    origem: string, destino: string, extra: Partial<CandidatoCusto> = {},
  ): CandidatoCusto => {
    const a = ancora(evento);
    const linha: CustoPlanejado = {
      grupo: grupoCusto, categoria,
      orcamento_unidade: unidade, orcamento_valor: valor, orcamento_valor_canonico: canonico,
      cronograma_evento: a.evento, inicio_mes: a.inicio_mes, duracao_meses: a.duracao_meses, ordem: 0,
    };
    if (subcategoria !== undefined) linha.subcategoria = subcategoria;
    return { linha, origem, destino, ...extra };
  };
  const emReais = (
    g: string, cat: string, sub: string | undefined, evento: string, valor: number, origem: string, destino: string,
    extra: Partial<CandidatoCusto> = {},
  ): CandidatoCusto => novo(g, cat, sub, evento, 'rs', valor, valor, origem, destino, extra);
  const porArea = (
    g: string, cat: string, evento: string, unidade: 'rs_m2_priv' | 'rs_m2_terreno', unitario: number,
    origem: string, destino: string,
  ): CandidatoCusto => novo(g, cat, undefined, evento, unidade, unitario, null, origem, destino);
  const percentual = (
    g: string, cat: string, evento: string, unidade: string, pct: number, efetivo: number,
    origem: string, destino: string, notaBase?: string,
  ): CandidatoCusto => novo(g, cat, undefined, evento, unidade, pct, null, origem, destino, { efetivoPercentual: efetivo, notaBase });

  /** R$/m² quando reconcilia com o efetivo; senão R$ com o valor efetivo e o motivo no relatório. */
  const areaOuReais = (
    g: string, cat: string, evento: string, unidade: 'rs_m2_priv' | 'rs_m2_terreno',
    unitario: number, efetivo: number, origem: string, destino: string,
  ): CandidatoCusto => {
    const base = unidade === 'rs_m2_priv' ? ctx.areaPrivativaTotal : ctx.areaTerreno;
    if (reconcilia(unitario, base, efetivo)) return porArea(g, cat, evento, unidade, unitario, origem, destino);
    if (unitario > 0) {
      const alt = round2(unitario * base);
      item(origem, destino, `levado em R$ (${brl(efetivo)})`,
        `${brl(unitario)}/m² × ${m2txt(base)} do Avançado daria ${brl(alt)}; para não mudar o custo, o valor do Preliminar foi mantido em R$.`, true);
    }
    return emReais(g, cat, undefined, evento, efetivo, origem, destino);
  };

  const terreno: CandidatoCusto[] = [];
  const obra: CandidatoCusto[] = [];
  const diretos: CandidatoCusto[] = [];
  const indireto: CandidatoCusto[] = [];

  // Terreno › Preço › Valor à vista
  if (estudo.considerar_custo_terreno !== false && p.custoTerreno > 0) {
    const c = areaOuReais('terreno', CATEGORIA_PRECO_TERRENO, 'customizado', 'rs_m2_terreno',
      n(estudo.custo_terreno_m2), p.custoTerreno, 'Custo do terreno', 'Custos › Terreno › Preço › Valor à vista');
    c.linha.subcategoria = 'Valor à vista';
    terreno.push(c);
  }
  // Permuta física
  terreno.push(...permutas);
  // Permuta financeira: soma R + NR, em R$
  const permutaFin = p.permutaFinResidencial + p.permutaFinNaoResidencial;
  if (permutaFin > 0) {
    if (ctx.vgvVendavel > 0) {
      terreno.push(emReais('terreno', CATEGORIA_PRECO_TERRENO, SUBCATEGORIA_PERMUTA_FINANCEIRA, 'customizado',
        round2(permutaFin), 'Permuta financeira', 'Custos › Terreno › Preço › Permuta financeira'));
    } else {
      item('Permuta financeira', 'Custos › Terreno › Preço › Permuta financeira', 'não levada',
        'O Avançado não tem VGV vendável para sustentar a permuta financeira; sem receita, ela não é lançada.', true);
    }
  }
  // Preço obrigatória, quando nenhuma linha de Preço foi criada
  if (!terreno.some((c) => c.linha.categoria === CATEGORIA_PRECO_TERRENO)) {
    terreno.push(novo('terreno', CATEGORIA_PRECO_TERRENO, undefined, 'customizado', 'rs', null, null,
      'Custo do terreno', 'Custos › Terreno › Preço'));
    item('Custo do terreno', 'Custos › Terreno › Preço', 'linha criada sem valor', 'O Preliminar não tem custo de terreno; complete o Preço em Custos.');
  }
  // Registro (Incorporação)
  if (!lot && p.incorporacaoRegistro > 0) {
    terreno.push(emReais('terreno', 'Registro', undefined, 'planejamento', p.incorporacaoRegistro,
      'Registro da incorporação', 'Custos › Terreno › Registro'));
  }

  // Obra › Construção (obrigatória)
  const valorConstrucao = lot ? p.infraestrutura : p.construcao;
  let construcao: CandidatoCusto;
  if (valorConstrucao > 0) {
    if (lot) {
      construcao = estudo.infra_modo === 'valor_m2'
        ? areaOuReais('obra', CATEGORIA_CONSTRUCAO, 'obra', 'rs_m2_priv', n(estudo.custo_infra_m2), valorConstrucao,
          'Infraestrutura', 'Custos › Obras › Construção')
        : emReais('obra', CATEGORIA_CONSTRUCAO, undefined, 'obra', valorConstrucao,
          'Infraestrutura', 'Custos › Obras › Construção');
    } else {
      construcao = estudo.construcao_modo !== 'valor_total' && n(estudo.custo_construcao_m2) > 0
        ? areaOuReais('obra', CATEGORIA_CONSTRUCAO, 'obra', 'rs_m2_priv', n(estudo.custo_construcao_m2), valorConstrucao,
          'Custo de construção', 'Custos › Obras › Construção')
        : emReais('obra', CATEGORIA_CONSTRUCAO, undefined, 'obra', valorConstrucao,
          'Custo de construção', 'Custos › Obras › Construção');
    }
  } else {
    construcao = novo('obra', CATEGORIA_CONSTRUCAO, undefined, 'obra', 'rs', null, null,
      lot ? 'Infraestrutura' : 'Custo de construção', 'Custos › Obras › Construção');
    item(lot ? 'Infraestrutura' : 'Custo de construção', 'Custos › Obras › Construção', 'linha criada sem valor',
      'O Preliminar não tem este custo; complete a Construção em Custos.');
  }
  obra.push(construcao);
  if (p.decoracao > 0) {
    obra.push(areaOuReais('obra', 'Decoração', 'obra', 'rs_m2_priv', n(estudo.custo_decoracao_m2), p.decoracao,
      'Decoração', 'Custos › Obras › Decoração'));
  }
  if (!lot && n(estudo.taxa_gestao_pct) > 0) {
    obra.push(percentual('obra', 'Gestão da obra', 'obra', 'pct_obra', n(estudo.taxa_gestao_pct), p.gestaoConstrucao,
      'Taxa de gestão da obra', 'Custos › Obras › Gestão da obra',
      'No Avançado a base é o grupo Obras inteiro, inclusive a Contingência; no Preliminar é só construção e decoração.'));
  }
  if (estudo.considerar_contingencias !== false && n(estudo.contingencias_pct) > 0) {
    obra.push(percentual('obra', 'Contingência', 'obra', 'pct_vgv', n(estudo.contingencias_pct), p.contingencias,
      'Contingências', 'Custos › Obras › Contingência'));
  }

  // Diretos
  diretos.push(percentual('diretos', CATEGORIA_CORRETAGEM, 'customizado', 'pct_vgv', n(estudo.corretagem_percentual), p.corretagem,
    'Corretagem', 'Custos › Diretos › Corretagem de vendas'));
  if (n(estudo.marketing_percentual) > 0) {
    diretos.push(percentual('diretos', CATEGORIA_MARKETING_DIRETOS, 'lancamento', 'pct_vgv', n(estudo.marketing_percentual), p.marketing,
      'Marketing', 'Custos › Diretos › Marketing & Publicidade'));
  }
  {
    const modo = estudo.projetos_modo || 'pct_vgv';
    const pct = n(estudo.projetos_pct);
    const origem = 'Projetos';
    const destino = 'Custos › Diretos › Projetos';
    if (modo === 'valor_fixo') {
      if (p.projetos > 0) diretos.push(emReais('diretos', CATEGORIA_PROJETOS, undefined, 'planejamento', p.projetos, origem, destino));
    } else {
      const canonico = estudo.projetos_valor_canonico;
      const congelado = canonico !== null && canonico !== undefined && canonico !== '';
      const legado = modo === 'pct_constr' ? p.custoObras * pct / 100 : p.vgv * pct / 100;
      if (congelado && Math.abs(n(canonico) - legado) > TOL_CENTAVO) {
        if (p.projetos > 0) {
          diretos.push(emReais('diretos', CATEGORIA_PROJETOS, undefined, 'planejamento', p.projetos, origem, destino));
          item(origem, destino, `levado em R$ (${brl(p.projetos)})`,
            `O valor de Projetos foi fixado no Preliminar (${brl(n(canonico))}) e difere do percentual (${brl(round2(legado))}); o valor fixado foi mantido.`, true);
        }
      } else if (pct > 0) {
        diretos.push(percentual('diretos', CATEGORIA_PROJETOS, 'planejamento', modo === 'pct_constr' ? 'pct_constr' : 'pct_vgv',
          pct, p.projetos, origem, destino));
      }
    }
  }
  if (n(estudo.manutencao_pct) > 0) {
    diretos.push(percentual('diretos', CATEGORIA_MANUTENCAO_POS_OBRA, 'pos_obra', 'pct_vgv', n(estudo.manutencao_pct), p.manutencao,
      'Manutenção pós-obra', 'Custos › Diretos › Manutenção pós-obra'));
  }

  // Indiretos
  if (lot && p.standVendas > 0) {
    indireto.push(emReais('indireto', 'Stand de vendas', undefined, 'lancamento', p.standVendas,
      'Stand de vendas', 'Custos › Indiretos › Stand de vendas'));
  }
  if (estudo.considerar_gestao_indiretos !== false && n(estudo.gestao_indiretos_pct) > 0) {
    indireto.push(percentual('indireto', 'Gestão', 'obra', 'pct_vgv', n(estudo.gestao_indiretos_pct), p.gestaoIndiretos,
      'Gestão (indiretos)', 'Custos › Indiretos › Gestão'));
  }

  // Ordem dentro do grupo, a obrigatória primeiro; ids para o motor.
  const porGrupo = [terreno, obra, diretos, indireto];
  porGrupo.forEach((lista) => lista.forEach((c, i) => { c.linha.ordem = i; }));
  const todos = porGrupo.flat();
  const comId = todos.map((c, i) => ({
    id: i + 1,
    grupo: c.linha.grupo, categoria: c.linha.categoria, subcategoria: c.linha.subcategoria,
    orcamento_unidade: c.linha.orcamento_unidade,
    orcamento_valor: c.linha.orcamento_valor,
    orcamento_valor_canonico: c.linha.orcamento_valor_canonico,
  }));
  ctx.totalObra = comId
    .filter((c) => c.grupo === 'obra' && (c.orcamento_unidade || 'rs') !== 'pct_obra')
    .reduce((s, c) => s + resolverCustoTotal(c, ctx), 0);
  ctx.totalConstrucao = totalConstrucaoCustos(comId, ctx);

  todos.forEach((c, i) => {
    const u = c.linha.orcamento_unidade;
    // R$ não tem nada a conferir: o valor efetivo do Preliminar foi levado como está (e, quando
    // vinha de R$/m², o motivo já foi declarado em `areaOuReais`).
    if (u === 'rs') return;
    const avancado = round2(resolverCustoTotal(comId[i], ctx));
    if (c.efetivoPercentual === undefined) {
      item(c.origem, c.destino, u === 'rs_m2_terreno' ? 'levado em R$/m² do terreno' : 'levado em R$/m² de área privativa');
      return;
    }
    const efetivo = round2(c.efetivoPercentual);
    const rotuloUnidade = u === 'pct_obra' ? '% das Obras' : (u === 'pct_constr' ? '% da construção' : '% do VGV vendável');
    if (Math.abs(avancado - efetivo) > TOL_CENTAVO) {
      item(c.origem, c.destino, `levado como percentual vivo (${rotuloUnidade})`,
        `No Preliminar o custo é ${brl(efetivo)}; no Avançado, com a base própria dele, passa a ${brl(avancado)}.${c.notaBase ? ` ${c.notaBase}` : ''}`, true);
    } else {
      item(c.origem, c.destino, `levado como percentual vivo (${rotuloUnidade})`);
    }
  });

  // ── Estudo: cópia sem a permuta física, com o regime de imposto ──
  const copia = montarCopiaEstudo(estudo);
  for (const col of COLUNAS_PERMUTA_FISICA_ESTUDO) delete copia[col];
  copia.nivel_analise = 'avancado';
  if (estudo.sujeito_ret === true) {
    copia.considerar_ret = true;
    if (opts.aliquotaRet !== null) {
      copia.ret_pct = opts.aliquotaRet;
      item('Sujeito ao RET', 'Custos › Financeiro › regime do imposto', `RET, alíquota de ${opts.aliquotaRet}%`);
    } else {
      item('Sujeito ao RET', 'Custos › Financeiro › regime do imposto',
        `RET, com a alíquota já gravada no estudo (${n(copia.ret_pct ?? 4)}%)`,
        'Não foi possível ler a alíquota do RET nos parâmetros do app; confira-a em Custos › Financeiro.', true);
    }
  } else {
    copia.considerar_ret = false;
    item('Imposto sobre a receita', 'Custos › Financeiro › regime do imposto',
      `imposto padrão do estudo (${n(estudo.imposto_percentual)}%)`);
  }

  // ── Itens que o relatório sempre traz ──
  item('Cronograma', 'Cronograma do Avançado', 'cronograma padrão criado',
    'Revise o Cronograma: o Preliminar não tem prazos, e os custos ancorados a eventos seguem o cronograma padrão.');
  const dataInicio = String(estudo.data_inicio_projeto ?? '').trim();
  item('Data de início', 'Data de início do projeto', dataInicio ? `copiada (${dataInicio})` : 'a definir',
    dataInicio ? undefined : 'O Preliminar não tem data de início; defina-a para o fluxo ter datas.');
  const juros = n(estudo.juros_tabela_aa_padrao);
  item('Juros de tabela', 'Viabilidade › Financeiro', juros > 0 ? `${juros}% a.a. (do estudo)` : '0% até preencher',
    juros > 0 ? undefined : 'O Preliminar não tem juros de tabela; sem eles a receita parcelada não é corrigida.');
  item('Grupo de receita', 'Receitas', 'um único grupo com 100% das unidades',
    'Absorção e fluxo de pagamento nascem no padrão do Avançado; ajuste-os em Receitas.');
  if (lot) {
    item('Cascata de áreas do Loteamento', 'Avançado', 'não levada',
      'O Avançado parte das tipologias; a cascata de áreas continua só no Preliminar.');
  }
  item('Documentos do estudo', 'Avançado', 'não levados', 'Os arquivos anexados ao Preliminar continuam só nele.');
  item('Membros do estudo', 'Avançado', 'não levados', 'Você entra como editor; adicione os demais membros no novo estudo.');
  item('Cenários de sensibilidade', 'Avançado', 'não levados', 'A sensibilidade do Preliminar não existe no Avançado.');

  // ── Notas ──
  const idLegivel = String(estudo.id_legivel ?? '').trim() || `#${estudo.id}`;
  const linhasNota = relatorio.map((r) => `- ${r.origem} → ${r.destino}: ${r.regra}.${r.nota ? ` ${r.nota}` : ''}`);
  const cabecalho = `Criado a partir do estudo Preliminar ${idLegivel} em ${opts.hoje}.`;
  const notasOrigem = String(estudo.notas ?? '').trim();
  copia.notas = [notasOrigem, [cabecalho, ...linhasNota].join('\n')].filter((s) => s !== '').join('\n\n');

  return {
    copiaEstudo: copia,
    tipologias,
    grupo,
    alocacoes,
    custos: todos.map((c) => c.linha),
    relatorio,
    conferencia,
    produtosOrigem: [...(produtos ?? [])],
  };
}

// ─────────────────────────────────────────────────────────────────
// Executor: só I/O, na ordem das dependências
// ─────────────────────────────────────────────────────────────────

export async function executarDerivacao(
  dados: ExecutorDados,
  origemId: number,
  plano: PlanoDerivacao,
  usuarioId: number,
): Promise<{ novo: any; funcao: 'leitor' | 'editor' | 'aprovador' | null }> {
  const criado = await dados.criar('estudos', plano.copiaEstudo);
  const novoId = Number(criado.id);

  // Imóveis vinculados, como na duplicação.
  const imoveis = await dados.varrerTudo('estudo_imoveis', { filtros: { estudo_id: origemId } });
  for (const im of imoveis as any[]) {
    await dados.criar('estudo_imoveis', coagirNumericosOuLancar('estudo_imoveis', omitirValoresNulos({
      estudo_id: novoId,
      imovel_nucleo_id: im.imovel_nucleo_id,
      tipo_imovel: im.tipo_imovel,
    })));
  }

  // Catálogo de produtos, análise de mercado e apelo comercial, como na duplicação.
  // O catálogo de produtos NÃO é relido: vem do plano, a mesma leitura que gerou tipologias e custos.
  for (const { tabela, campos } of FILHAS_SIMPLES) {
    const linhas = tabela === 'preliminar_produtos'
      ? plano.produtosOrigem
      : await dados.varrerTudo(tabela, { filtros: { estudo_id: origemId } });
    for (const copiaFilha of montarCopiasFilhas(linhas as any[], novoId, campos)) {
      await dados.criar(tabela, coagirNumericosOuLancar(tabela, omitirValoresNulos(copiaFilha)));
    }
  }

  // Tipologias, guardando o id criado de cada posição do plano.
  const idTipologia: number[] = [];
  for (const t of plano.tipologias) {
    const nova = await dados.criar('avancado_tipologias', coagirNumericosOuLancar('avancado_tipologias', omitirValoresNulos({
      estudo_id: novoId, ...t,
    })));
    idTipologia.push(Number(nova.id));
  }

  // Grupo de receita.
  const fase = await dados.criar('avancado_fases', coagirNumericosOuLancar('avancado_fases', omitirValoresNulos({
    estudo_id: novoId, ...plano.grupo,
  })));

  // Alocações: fase e tipologia pelos ids criados.
  for (const a of plano.alocacoes) {
    await dados.criar('avancado_alocacoes', coagirNumericosOuLancar('avancado_alocacoes', omitirValoresNulos({
      estudo_id: novoId, fase_id: Number(fase.id), tipologia_id: idTipologia[a.tipologiaIndice],
      unidades: a.unidades, preco_m2: a.preco_m2, ordem: a.ordem,
    })));
  }

  // Custos: a permuta física aponta para a tipologia criada.
  for (const c of plano.custos) {
    const { permuta_tipologia_indice, ...linha } = c;
    const gravar: Record<string, any> = { estudo_id: novoId, ...linha };
    if (permuta_tipologia_indice !== undefined) gravar.permuta_tipologia_id = idTipologia[permuta_tipologia_indice];
    await dados.criar('avancado_linhas_custo', coagirNumericosOuLancar('avancado_linhas_custo', omitirValoresNulos(gravar)));
  }

  const funcao = await garantirMembro(dados, novoId, usuarioId, 'editor');
  return { novo: criado, funcao };
}

// ─────────────────────────────────────────────────────────────────
// POST /estudos/:id/derivar-avancado
// ─────────────────────────────────────────────────────────────────

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

function dataDeHoje(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

rotasDerivarAvancado.post('/estudos/:id/derivar-avancado', async (req: Request, res: Response) => {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para criar um estudo a partir deste'); return; }
    const nivel = req.contexto?.nivelApp;
    if (nivel !== 'escrita' && nivel !== 'admin') {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para criar estudos'); return;
    }

    const orig = await req.dados!.buscar('estudos', estudoId);
    if (!orig) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    if (orig.nivel_analise === 'avancado') {
      erro(res, 422, 'NIVEL_INVALIDO', 'O estudo de origem já é Avançado; só um Preliminar gera um Avançado'); return;
    }
    if (orig.tipo_empreendimento !== 'loteamento' && orig.tipo_empreendimento !== 'incorporacao') {
      erro(res, 422, 'TIPO_INVALIDO', 'tipo_empreendimento deve ser "loteamento" ou "incorporacao"'); return;
    }

    const produtos = await req.dados!.varrerTudo('preliminar_produtos', { filtros: { estudo_id: estudoId } });
    let aliquotaRet: number | null = null;
    try {
      // Parser estrito: `null`/`''` não viram 0.
      aliquotaRet = numeroEstrito(await req.parametros!.obter('aliquota_ret_pct'));
    } catch { aliquotaRet = null; }
    const cronograma = recalcularTravados(
      cronogramaPadrao().filter((c) => orig.tem_pre_lancamento !== false || c.evento !== 'pre_lancamento'),
    );

    const plano = planejarDerivacao(orig, produtos as any[], { aliquotaRet, cronograma, hoje: dataDeHoje() });
    const ident = await gerarIdentificacao(req, {
      nome: orig.nome, tipo_empreendimento: orig.tipo_empreendimento, uf: orig.uf,
    });
    plano.copiaEstudo.status = 'rascunho';
    plano.copiaEstudo.autor_id = req.contexto!.usuario.id;
    Object.assign(plano.copiaEstudo, ident);

    // Estudo, filhas, Avançado e o vínculo do criador gravam numa ÚNICA transação: se qualquer
    // estrutura falhar, o ROLLBACK desfaz tudo e não sobra estudo pela metade. A inscrição em
    // eventos sai DEPOIS do commit.
    const { novo, funcao } = await req.dados!.transaction(async (trx) =>
      executarDerivacao(trx, estudoId, plano, req.contexto!.usuario.id));
    if (funcao) await inscreverMembroEstudo(req, novo.id, req.contexto!.usuario.id, funcao);
    await publicarEvento(req, 'estudo_criado', payloadEstudoCriado(novo, req.contexto!.usuario.nome));

    res.status(201).json({ estudo: novo, relatorio: plano.relatorio });
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/derivar-avancado:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// O que o cartão de uma operação de funding mostra — montado aqui, PURO.
//
// Sem lit e sem DOM: a tela entrega a operação (já mesclada com o rascunho), a
// série dela na estrutura completa e o passo dela na sequência por
// senioridade, e este módulo devolve textos prontos. O cartão
// (`viab-funding-cartao`) só desenha. Nenhuma simulação acontece aqui — os
// números saem do motor e do núcleo da Estrutura de capital
// (`funding-estrutura.ts`).
//
// Formato dos números (decisão do dono para o Funding):
//   · valores em reais com `fmtR$Mi` ("R$ 20,1 mi"), com o valor exato em 2
//     casas no `titulo` — a quarta exceção de exibição do contrato C7;
//   · percentual DIGITADO (taxa, retorno, % cedido) com `fmtPctEntrada`, 2
//     casas: é entrada, não KPI;
//   · KPI percentual com `fmtPct`, uma casa, como o contrato dos cards;
//   · mês pelo `rotuloMesRelativo`, o mesmo do resto da tela;
//   · KPI sem base de cálculo sai "—", nunca zero.

import { fmtR$, fmtR$Mi, fmtPct, fmtPctEntrada } from './viab-format.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import { indicadoresAntecipacao, indicadoresOperacao, type OperacaoFunding, type SerieOperacao } from './funding-motor.js';
import {
  kpisDaOperacao, leituraDaOperacao, ordenarPorSenioridade, LIMIAR_MES_COM_VALOR, type PassoEstrutura,
} from './funding-estrutura.js';
import { varianteDoBadge } from './funding-cores.js';

/**
 * Os tipos que têm CARTÃO na aba Operações. O Financiamento à produção não
 * tem: é único por estudo e mora na aba dele.
 */
export const TIPOS_DE_CARTAO = ['divida', 'equity', 'antecipacao_recebiveis'] as const;
export type TipoDeCartao = typeof TIPOS_DE_CARTAO[number];

/** As operações que viram cartão, na ordem de senioridade. Array novo; não muta a entrada. */
export function operacoesDeCartao<T extends { tipo: string; id?: number | string; ordem?: number | null }>(
  operacoes: readonly T[],
): T[] {
  return ordenarPorSenioridade(
    operacoes.filter((o) => (TIPOS_DE_CARTAO as readonly string[]).includes(o.tipo)) as any[],
  ) as T[];
}

/** Um texto do cartão; `titulo` leva o valor exato quando o texto o abrevia. */
export interface ValorCartao {
  texto: string;
  titulo?: string;
}

export interface TermoCartao {
  rotulo: string;
  valor: ValorCartao;
}

export interface KpiCartao {
  rotulo: string;
  valor: ValorCartao;
  /** Só nos KPIs da sequência (TIR alavancada e exposição máxima): o "antes", que o cartão mostra riscado. */
  antes?: ValorCartao;
}

export interface DadosCartao {
  id: number | string | null;
  tipo: string;
  nome: string;
  rotuloTipo: string;
  /** Valor da prop `cor` do `urbi-badge`. */
  corBadge: string;
  termos: TermoCartao[];
  kpis: KpiCartao[];
  /** "Leitura da operação": vazia quando não há número que sustente frase. */
  leitura: string[];
  /** Antecipação sem parcela a ceder: o cartão mostra o aviso abaixo dos KPIs. */
  semLastro: boolean;
}

export interface EntradaCartao {
  /** A operação já mesclada com o rascunho (o mesmo objeto que a simulação usa). */
  operacao: OperacaoFunding & { id?: number | string; distribuir_aporte?: boolean; aporte_meses?: number };
  /** A série dela na estrutura completa; null antes do primeiro cálculo. */
  serie: SerieOperacao | null;
  /** O passo dela na sequência; null enquanto a sequência não existe. */
  passo: PassoEstrutura | null;
  vgvTotal: number;
  dataInicio: string | null;
  rotuloTipo: string;
}

/**
 * O aviso de antecipação sem lastro — o mesmo texto no cartão e no painel
 * "Resultado da antecipação" da página da operação.
 */
export const AVISO_SEM_LASTRO = 'Nenhuma parcela a ceder. Ou não há, até o mês da cessão, venda com parcela a '
  + 'receber depois dele; ou o percentual cedido é zero; ou os Grupos de receita ainda estão com o plano de '
  + 'pagamento no formato antigo — só os planos já aplicados entram no lastro (abra o Fluxo de pagamento de '
  + 'cada Grupo, em Receitas, e clique em Aplicar).';

const SEM = '—';
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown): number => Number(v) || 0;

/**
 * Valor em reais no formato do cartão, com o exato no título. Sem base, "—".
 * Exportado para a aba Estrutura de capital: os totais e a tabela da sequência
 * saem deste MESMO formatador, e o texto da tabela é o mesmo do cartão.
 */
export function valorEmReais(v: number | null | undefined): ValorCartao {
  if (!finito(v)) return { texto: SEM };
  return { texto: fmtR$Mi(v), titulo: fmtR$(v) };
}

/** KPI percentual (uma casa); "a.a." quando é taxa anual. Exportado pelo mesmo motivo de `valorEmReais`. */
export function valorPercentual(v: number | null | undefined, anual = false): ValorCartao {
  if (!finito(v)) return { texto: SEM };
  return { texto: anual ? `${fmtPct(v)} a.a.` : fmtPct(v) };
}

function mesesComValor(xs: readonly number[]): number[] {
  const meses: number[] = [];
  xs.forEach((v, i) => { if (Math.abs(v) >= LIMIAR_MES_COM_VALOR) meses.push(i); });
  return meses;
}

/** "jan/30", "jan/30 a dez/32" ou "—": os meses em que a série tem saída. */
function periodo(xs: readonly number[] | undefined, dataInicio: string | null): ValorCartao {
  const meses = mesesComValor(xs ?? []);
  if (meses.length === 0) return { texto: SEM };
  const a = rotuloMesRelativo(dataInicio, meses[0]);
  const b = rotuloMesRelativo(dataInicio, meses[meses.length - 1]);
  return { texto: a === b ? a : `${a} a ${b}` };
}

function termosDivida(e: EntradaCartao): TermoCartao[] {
  const o = e.operacao;
  const valor = num(o.valor);
  const meses = Math.max(1, Math.round(num(o.aporte_meses)));
  const distribuido = o.distribuir_aporte === true && meses > 1;
  const aporte = valorEmReais(valor > 0 ? valor : null);
  const amort = Math.max(0, Math.round(num(o.periodo_amortizacao_meses)));
  const car = Math.max(0, Math.round(num(o.periodo_carencia_meses)));
  return [
    {
      rotulo: 'Aporte',
      valor: aporte.titulo
        ? { texto: `${aporte.texto} ${distribuido ? `em ${meses} meses` : 'à vista'}`, titulo: aporte.titulo }
        : aporte,
    },
    { rotulo: 'Taxa', valor: { texto: `${fmtPctEntrada(num(o.taxa_anual))} a.a.` } },
    { rotulo: 'Prazo', valor: { texto: `${amort} meses, ${car > 0 ? `${car} de carência` : 'sem carência'}` } },
    { rotulo: 'Amortização', valor: { texto: 'Price' } },
  ];
}

function termosEquity(e: EntradaCartao): TermoCartao[] {
  const o = e.operacao;
  const valor = num(o.valor);
  const modo = (o.modo_retorno ?? 'permuta_financeira') === 'permuta_financeira'
    ? 'da receita líquida' : 'do resultado final';
  const retornoTotal = e.serie ? indicadoresOperacao(e.serie, 0).retornoTotal : null;
  return [
    { rotulo: 'Aporte', valor: valorEmReais(valor > 0 ? valor : null) },
    { rotulo: 'Retorno', valor: { texto: `${fmtPctEntrada(num(o.pct_retorno))} ${modo}` } },
    { rotulo: 'Quando recebe', valor: periodo(e.serie?.saidas, e.dataInicio) },
    { rotulo: 'Retorno total', valor: valorEmReais(retornoTotal !== null && retornoTotal > 0 ? retornoTotal : null) },
  ];
}

function termosAntecipacao(e: EntradaCartao, valorAntecipado: number | null): TermoCartao[] {
  const o = e.operacao;
  return [
    { rotulo: 'Carteira cedida', valor: { texto: fmtPctEntrada(num(o.pct_carteira_cedida)) } },
    { rotulo: 'Taxa de desconto', valor: { texto: `${fmtPctEntrada(num(o.taxa_anual))} a.a.` } },
    { rotulo: 'Mês da cessão', valor: { texto: rotuloMesRelativo(e.dataInicio, num(o.inicio_mes)) } },
    { rotulo: 'Valor antecipado', valor: valorEmReais(valorAntecipado) },
  ];
}

/** Os dois KPIs da sequência, em "antes → depois". Sem "antes" (sem passo, ou sem troca de
 * sinal só no antes), mostra só o "depois", sem riscado e sem seta. */
function kpisDaSequencia(k: ReturnType<typeof kpisDaOperacao> | null): KpiCartao[] {
  const tir = (antes: number | null, depois: number | null): KpiCartao => ({
    rotulo: 'TIR alavancada',
    valor: valorPercentual(depois, true),
    ...(antes === null ? {} : { antes: valorPercentual(antes, true) }),
  });
  const exp = (antes: number | null, depois: number | null): KpiCartao => ({
    rotulo: 'Exposição máxima',
    valor: valorEmReais(depois),
    ...(antes === null ? {} : { antes: valorEmReais(antes) }),
  });
  return [
    tir(k?.tirAlavancadaAntes ?? null, k?.tirAlavancadaDepois ?? null),
    exp(k?.exposicaoAntes ?? null, k?.exposicaoDepois ?? null),
  ];
}

/** Tudo o que o cartão de uma operação mostra. */
export function dadosDoCartao(e: EntradaCartao): DadosCartao {
  const o = e.operacao;
  const tipo = String(o.tipo);
  const k = e.serie ? kpisDaOperacao(e.serie, e.vgvTotal, e.passo) : null;

  let termos: TermoCartao[];
  let proprios: KpiCartao[];
  let semLastro = false;
  if (tipo === 'divida') {
    termos = termosDivida(e);
    proprios = [
      { rotulo: 'LTV', valor: valorPercentual(k?.tipo === 'divida' ? k.ltvPct : null) },
      { rotulo: 'Custo efetivo', valor: valorPercentual(k?.tipo === 'divida' ? k.custoEfetivoPct : null, true) },
    ];
  } else if (tipo === 'antecipacao_recebiveis') {
    const ind = e.serie ? indicadoresAntecipacao(e.serie) : null;
    semLastro = !ind || !(ind.valorFace > 0);
    termos = termosAntecipacao(e, semLastro || !ind ? null : ind.valorPresente);
    proprios = [
      { rotulo: 'Deságio', valor: valorPercentual(k?.tipo === 'antecipacao_recebiveis' ? k.desagioPct : null) },
      { rotulo: 'Custo efetivo', valor: valorPercentual(k?.tipo === 'antecipacao_recebiveis' ? k.custoEfetivoPct : null, true) },
    ];
  } else {
    termos = termosEquity(e);
    proprios = [
      { rotulo: 'ROI do investidor', valor: valorPercentual(k?.tipo === 'equity' ? k.roiInvestidorPct : null) },
      { rotulo: 'TIR do investidor', valor: valorPercentual(k?.tipo === 'equity' ? k.tirInvestidorPct : null, true) },
    ];
  }

  const leitura = e.serie && k
    ? leituraDaOperacao(
      { serie: e.serie, kpis: k, passo: e.passo },
      (v) => valorEmReais(v).texto,
      (mes) => rotuloMesRelativo(e.dataInicio, mes),
    )
    : [];

  return {
    id: o.id ?? null,
    tipo,
    nome: String(o.nome || e.rotuloTipo),
    rotuloTipo: e.rotuloTipo,
    corBadge: varianteDoBadge(tipo),
    termos,
    kpis: [...proprios, ...kpisDaSequencia(k)],
    leitura,
    semLastro,
  };
}

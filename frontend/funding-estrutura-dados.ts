// O que a aba Estrutura de capital do Funding mostra — montado aqui, PURO.
//
// Sem lit e sem DOM, e sem simulação própria: a tela entrega o fluxo do
// projeto, o funding da estrutura completa e a sequência "antes → depois" que
// ela JÁ calculou em `_recalcular` (a mesma que alimenta os cartões da aba
// Operações), e este módulo devolve textos prontos para os totais, as camadas
// da torre e a tabela da sequência. Não chama o motor de fluxo nem o funding
// do estudo: os números saem do núcleo da Estrutura de capital
// (`funding-estrutura.ts`).
//
// Formato: os valores em reais e as TIRs saem dos MESMOS formatadores do cartão
// (`valorEmReais`, `valorPercentual`), para a tabela da sequência repetir, letra
// por letra, o "depois" que cada cartão mostra.

import type { FluxoCalc } from './fluxo-caixa-motor.js';
import type { FundingCalc, ModoRetorno } from './funding-motor.js';
import {
  camadasDoStack, rotuloNivelCamada, totaisDaEstrutura,
  type CamadaStack, type IndicadoresEstrutura, type SequenciaEstrutura,
} from './funding-estrutura.js';
import { corDoTipo } from './funding-cores.js';
import { valorEmReais, valorPercentual, type ValorCartao } from './funding-cartao-dados.js';

/** Uma camada da torre, pronta para desenhar: o componente não decide texto nem cor. */
export interface CamadaDaTorre extends CamadaStack {
  /** Rótulo de nível ("sênior · base", "dívida", …). */
  nivel: string;
  /** Cor da categoria (`var(--cor-categoria-N)`), a mesma do badge do cartão. */
  cor: string;
}

export interface TotalEstrutura {
  rotulo: string;
  valor: ValorCartao;
}

export interface LinhaSequencia {
  /** `'base'` no projeto sem funding; senão o `id` da operação do passo. */
  id: string;
  passo: string;
  tir: ValorCartao;
  exposicao: ValorCartao;
}

export interface DadosEstrutura {
  totais: TotalEstrutura[];
  /** Todas as camadas, inclusive as de valor zero (a torre as filtra; a lista em texto, não). */
  camadas: CamadaDaTorre[];
  linhas: LinhaSequencia[];
}

export interface EntradaEstrutura {
  /** O fluxo do projeto usado na sequência (com o rascunho, quando houver). */
  calc: Pick<FluxoCalc, 'custoMensal'>;
  /** O funding da estrutura completa (null sem operação efetiva). */
  funding: FundingCalc | null;
  /** A sequência que a tela já calculou para os cartões. */
  sequencia: SequenciaEstrutura;
  /** As operações (mescladas com o rascunho): o equity lê `modo_retorno` delas para o rótulo de nível. */
  operacoes: readonly { id?: number | string | null; modo_retorno?: ModoRetorno | string | null }[];
  /** Rótulo do tipo, para passo de operação sem nome. */
  rotuloTipo: (tipo: string) => string;
}

/**
 * A estrutura completa é o "depois" do último passo da sequência (ou o
 * projeto sem funding, sem passo nenhum). É dela que saem a camada do
 * incorporador e o total "incorporador no pico" — e é por isso que a última
 * linha da tabela e esses dois números nunca divergem.
 */
export function estruturaCompleta(sequencia: SequenciaEstrutura): IndicadoresEstrutura {
  const passos = sequencia.passos;
  return passos.length ? passos[passos.length - 1].depois : sequencia.base;
}

/** A linha da tabela de UMA estrutura: TIR alavancada e exposição máxima (em módulo). */
function linha(id: string, passo: string, ind: IndicadoresEstrutura): LinhaSequencia {
  return {
    id,
    passo,
    tir: valorPercentual(ind.tirAlavancada, true),
    exposicao: valorEmReais(Math.abs(ind.exposicaoMaxima)),
  };
}

/** Tudo o que a aba Estrutura de capital mostra. */
export function dadosDaEstrutura(e: EntradaEstrutura): DadosEstrutura {
  const completa = estruturaCompleta(e.sequencia);
  const brutas = camadasDoStack(e.funding, completa);
  const camadas: CamadaDaTorre[] = brutas.map((c) => ({
    ...c,
    nivel: rotuloNivelCamada(c, e.operacoes),
    cor: corDoTipo(c.tipo),
  }));
  const t = totaisDaEstrutura(e.calc, brutas, completa);
  const totais: TotalEstrutura[] = [
    { rotulo: 'Usos totais', valor: valorEmReais(t.usosTotais) },
    { rotulo: 'Dívida', valor: valorEmReais(t.divida) },
    { rotulo: 'Equity de terceiros', valor: valorEmReais(t.equityTerceiros) },
    { rotulo: 'Incorporador no pico', valor: valorEmReais(t.incorporadorNoPico) },
  ];
  const linhas: LinhaSequencia[] = [
    linha('base', 'Projeto sem funding', e.sequencia.base),
    ...e.sequencia.passos.map((p) => linha(
      String(p.operacao.id ?? ''),
      String(p.operacao.nome || e.rotuloTipo(p.operacao.tipo)),
      p.depois,
    )),
  ];
  return { totais, camadas, linhas };
}

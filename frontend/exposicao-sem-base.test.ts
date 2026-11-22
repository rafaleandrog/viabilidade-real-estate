import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { kpisFluxo } from './fluxo-tabela.js';
import { exposicaoSemBase, TEXTO_VARIACAO_SEM_BASE } from './cenario-variacao.js';

// #910 (decisão do dono): com o piso em zero, um cenário de referência sem
// exposição tem base 0 e a variação da exposição não se define. A tela publica
// "n/d" em vez de deixar a célula em branco — na tabela de Cenários e no card
// "Exposição máxima (fluxo livre)" quando ele compara com o cenário real.

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const receita = (mes: number) => ({
  id: 1, nome: 'Vendas',
  tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes, pct: 100 }] },
  fluxo_pagamento: { ret: { ativo: false, pct: 0 } },
});
const custo = (valor: number, inicio: number, duracao: number) => ({
  id: 2, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: valor, orcamento_unidade: 'rs',
  inicio_mes: inicio, duracao_meses: duracao,
});
const cfg = (linhasReceita: unknown[], linhasCusto: unknown[]): FluxoConfig => ({
  dataInicio: 'jan/2027', prazoMeses: 60, taxaDescontoAa: 12, areaTerreno: 0, cronograma: CRONO,
  jurosTabelaAaEstudo: 0, linhasReceita, linhasCusto,
} as unknown as FluxoConfig);

type TR = { values?: unknown[] };
function textosDoTemplate(no: unknown, saida: string[] = []): string[] {
  if (typeof no === 'string') { saida.push(no); return saida; }
  if (Array.isArray(no)) { for (const x of no) textosDoTemplate(x, saida); return saida; }
  const tr = no as TR;
  if (tr && Array.isArray(tr.values)) for (const v of tr.values) textosDoTemplate(v, saida);
  return saida;
}

test('#910 n/d: exposicaoSemBase reconhece só a base zerada', () => {
  assert.equal(exposicaoSemBase(0), true);
  assert.equal(exposicaoSemBase(-0), true);
  assert.equal(exposicaoSemBase(-0.004), true);
  assert.equal(exposicaoSemBase(-0.01), false);
  assert.equal(exposicaoSemBase(-1_000_000), false);
  assert.equal(exposicaoSemBase(null), false);
  assert.equal(exposicaoSemBase(undefined), false);
  assert.equal(exposicaoSemBase(Number.NaN), false);
});

test('#910 n/d fiação: o card de exposição comparado a uma base sem exposição publica "n/d"', () => {
  const semExposicao = calcularFluxo(cfg([receita(12)], []));
  const comExposicao = calcularFluxo(cfg([receita(20)], [custo(1_000_000, 0, 3)]));
  assert.ok(Object.is(semExposicao.exposicaoMaxima, 0));
  assert.ok(comExposicao.exposicaoMaxima < 0);

  const comBaseZero = textosDoTemplate(kpisFluxo(comExposicao, semExposicao));
  assert.ok(comBaseZero.includes(TEXTO_VARIACAO_SEM_BASE), 'base sem exposição: o card tem de publicar "n/d"');

  // Base com exposição: variação normal, sem "n/d". Sem base: nem variação nem "n/d".
  assert.ok(!textosDoTemplate(kpisFluxo(semExposicao, comExposicao)).includes(TEXTO_VARIACAO_SEM_BASE));
  assert.ok(!textosDoTemplate(kpisFluxo(comExposicao)).includes(TEXTO_VARIACAO_SEM_BASE));
});

test('#910 n/d fiação: a linha de cenário da tabela de Cenários publica "n/d" com base sem exposição', async () => {
  const { ViabTelaCenarios } = await import('./tela-cenarios.js');
  const tela = (config: FluxoConfig) => {
    const el: any = new (ViabTelaCenarios as any)();
    Object.assign(el, {
      estudo: { id: 1, nivel_analise: 'avancado' }, carregando: false, baseConfig: config,
      crono: CRONO, dataInicio: config.dataInicio ?? null, operacoes: [], cenarios: [],
      colapso: {}, visao: 'mensal', precoPct: 0, custoPct: 0,
    });
    return el;
  };
  const cenario = { id: 9, nome: 'Custo +200%', preco_venda_pct: 0, custo_obra_pct: 200 };

  const semExp = tela(cfg([receita(12)], []));
  const baseSem = semExp._calc({ precoVendaPct: 0, custoObraPct: 0 });
  assert.ok(Object.is(baseSem.exposicaoMaxima, 0));
  assert.ok(textosDoTemplate(semExp._linhaCenario(cenario, baseSem)).includes(TEXTO_VARIACAO_SEM_BASE));

  const comExp = tela(cfg([receita(20)], [custo(1_000_000, 0, 3)]));
  const baseCom = comExp._calc({ precoVendaPct: 0, custoObraPct: 0 });
  assert.ok(baseCom.exposicaoMaxima < 0);
  assert.ok(!textosDoTemplate(comExp._linhaCenario(cenario, baseCom)).includes(TEXTO_VARIACAO_SEM_BASE));
});

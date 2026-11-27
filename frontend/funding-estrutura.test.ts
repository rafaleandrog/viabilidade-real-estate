// Núcleo de cálculo da Estrutura de capital — módulo puro. Não prova fiação em
// tela: esta fase não tem consumidor, e a prova de que a tela chama cada função
// é das fases que a desenham.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  fundingDoEstudo, indicadoresAntecipacao, receitaLiquidaComCorretagemMensal,
  type FundingCalc, type OperacaoFunding, type SerieOperacao,
} from './funding-motor.js';
import { mesRepasse } from './fluxo-shared.js';
import { visaoInvestidor } from './visao-investidor.js';
import {
  LIMIAR_CUSTO_EMPATE_PP, LIMIAR_EXPOSICAO_INALTERADA, LIMIAR_MES_COM_VALOR, MAX_FRASES_LEITURA, ORDEM_SENIORIDADE,
  camadasDoStack, indicadoresEstrutura, kpisDaOperacao, leituraDaOperacao, ltvDaSerie, maiorSaldoDevedor,
  nivelSenioridade, ordenarPorSenioridade, rotuloPreferenciaEquity, sequenciaDeEstrutura, totaisDaEstrutura,
  type IndicadoresEstrutura, type KpisOperacao, type PassoEstrutura,
} from './funding-estrutura.js';

// ── Fixture: o motor real, com os quatro tipos ──────────────────────────

const CRONO = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 3 },
  { evento: 'obra', inicio_mes: 3, duracao_meses: 12 },
  { evento: 'pos_obra', inicio_mes: 15, duracao_meses: 12 },
] as any;

const CONFIG: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 0,
  linhasReceita: [{
    id: 1, nome: 'Vendas',
    tipologias: [{ id: 1, quantidade: 40, area_privativa_m2: 60, preco_m2: 10_000 }],
    absorcao: { modo: 'linear' },
    // Contrato canônico (`componentes`): é ele que alimenta o lastro por safra da antecipação.
    fluxo_pagamento: {
      componentes: [
        { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
        { tipo: 'carteira_pos_marco', participacaoPct: 80, marcoMes: 14, carenciaMeses: 0, prazoMeses: 36 },
      ],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 4_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 12_000_000, orcamento_unidade: 'rs', inicio_mes: 3, duracao_meses: 12 },
  ],
  areaTerreno: 3_000,
};

const FAP: OperacaoFunding = {
  id: 10, tipo: 'financiamento_producao', nome: 'Plano empresário', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
  exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true, ativo: true,
};
const DIVIDA: OperacaoFunding = {
  id: 20, tipo: 'divida', nome: 'Crédito de terreno', ordem: 1, valor: 3_000_000, inicio_mes: 0, taxa_anual: 14,
  periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, aporte_meses: 1,
} as OperacaoFunding;
const ANTECIPACAO: OperacaoFunding = {
  id: 30, tipo: 'antecipacao_recebiveis', nome: 'Cessão', valor: 0, inicio_mes: 16, taxa_anual: 18,
  pct_carteira_cedida: 40,
} as OperacaoFunding;
const EQUITY: OperacaoFunding = {
  id: 40, tipo: 'equity', nome: 'Sócio investidor', valor: 1_500_000, inicio_mes: 1,
  modo_retorno: 'permuta_financeira', pct_retorno: 6,
};
const QUATRO = [EQUITY, ANTECIPACAO, FAP, DIVIDA];

/** Fluxo + funding exatamente como a tela de Funding monta, com o fluxo refeito para o subconjunto. */
function rodar(ops: OperacaoFunding[], calcFixo?: FluxoCalc): { calc: FluxoCalc; funding: FundingCalc | null } {
  const calc = calcFixo ?? calcularFluxo({ ...CONFIG, operacoesFunding: ops });
  const rl = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, CONFIG.linhasCusto);
  const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
  const funding = fundingDoEstudo(ops, calc.fluxoMensal, rl, resultadoFinal, mesRepasse(CRONO), 12, {
    custosRaw: CONFIG.linhasCusto, linhasCusto: calc.linhasCusto, cronograma: CRONO,
    recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal,
  });
  return { calc, funding };
}
const simular = (ops: OperacaoFunding[]): IndicadoresEstrutura => {
  const { calc, funding } = rodar(ops);
  return indicadoresEstrutura(calc, funding);
};
const serieDe = (f: FundingCalc | null, id: number): SerieOperacao => {
  const s = f?.operacoes.find((x) => x.operacao.id === id);
  assert.ok(s, `série da operação ${id}`);
  return s;
};
const somaDe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const COMPLETA = rodar(QUATRO);

// ── Pureza ───────────────────────────────────────────────────────────────

test('o módulo é puro: sem lit, sem DOM, sem simular o motor por conta própria', () => {
  const fonte = readFileSync(new URL('./funding-estrutura.ts', import.meta.url), 'utf8');
  assert.equal(fonte.includes('fundingDoEstudo('), false, 'não chama o funding do estudo');
  assert.equal(fonte.includes('calcularFluxo('), false, 'não calcula o fluxo');
  assert.equal(/from ['"]lit/.test(fonte), false, 'não importa lit');
  assert.equal(/\b(document|window|customElements|HTMLElement)\b/.test(fonte), false, 'não toca o DOM');
});

test('a fixture exercita os quatro tipos com valor', () => {
  assert.ok(COMPLETA.funding);
  for (const id of [10, 20, 30, 40]) {
    const s = serieDe(COMPLETA.funding, id);
    assert.ok(somaDe(s.entradas) > 0, `operação ${id} tem entrada`);
  }
});

// ── indicadoresEstrutura ──

test('indicadores: estrutura idêntica (cópia profunda) reproduz os 4 indicadores', () => {
  const b = rodar(JSON.parse(JSON.stringify(QUATRO)));
  assert.deepEqual(indicadoresEstrutura(b.calc, b.funding), indicadoresEstrutura(COMPLETA.calc, COMPLETA.funding));
});

test('indicadores: mais equity muda os indicadores', () => {
  const base = indicadoresEstrutura(COMPLETA.calc, COMPLETA.funding);
  const maior = rodar(QUATRO.map((o) => (o.tipo === 'equity' ? { ...o, valor: 3_000_000 } : o)));
  const ind = indicadoresEstrutura(maior.calc, maior.funding);
  assert.notDeepEqual(ind, base);
  assert.notEqual(ind.custoFinanceiro, base.custoFinanceiro);
});

test('indicadores sem funding: TIR do projeto, custo 0, resultado = Σ do fluxo livre', () => {
  const calc = calcularFluxo(CONFIG);
  const ind = indicadoresEstrutura(calc, null);
  assert.equal(ind.tirAlavancada, calc.tir);
  assert.equal(ind.custoFinanceiro, 0);
  assert.equal(ind.resultadoAposFunding, Math.round(somaDe(calc.fluxoMensal) * 100) / 100);
  assert.equal(ind.exposicaoMaxima, calc.exposicaoMaxima);
});

test('indicadores: custo financeiro = resultado sem funding − resultado após (tolerância de centavos)', () => {
  const { calc, funding } = COMPLETA;
  const ind = indicadoresEstrutura(calc, funding);
  const sem = indicadoresEstrutura(calc, null);
  assert.ok(ind.custoFinanceiro > 0);
  assert.ok(Math.abs(sem.resultadoAposFunding - ind.resultadoAposFunding - ind.custoFinanceiro) <= 0.01 * calc.fluxoMensal.length);
});

test('indicadores: exposição com piso em zero e nunca -0', () => {
  const ind = indicadoresEstrutura({ fluxoMensal: [10, 20] }, null);
  assert.ok(Object.is(ind.exposicaoMaxima, 0));
  assert.equal(indicadoresEstrutura({ fluxoMensal: [-10, 4, -1] }, null).exposicaoMaxima, -10);
});

// ── Ordem ────────────────────────────────────────────────────────────────

test('ordem: os quatro tipos fora de ordem saem na senioridade', () => {
  const saida = ordenarPorSenioridade(QUATRO);
  assert.deepEqual(saida.map((o) => o.tipo), ['financiamento_producao', 'divida', 'antecipacao_recebiveis', 'equity']);
  assert.deepEqual([...ORDEM_SENIORIDADE], ['financiamento_producao', 'divida', 'antecipacao_recebiveis', 'equity']);
});

test('ordem: empate de ordem desempata por id; sem ordem vai depois; sem id por último no tipo, na ordem de chegada', () => {
  const ops = [
    { tipo: 'divida', id: 9, ordem: 2 },
    { tipo: 'divida', nome: 'rascunho A' },
    { tipo: 'divida', id: 3, ordem: 2 },
    { tipo: 'divida', id: 1 },
    { tipo: 'divida', id: 7, ordem: 1 },
    { tipo: 'divida', nome: 'rascunho B' },
    { tipo: 'equity', id: 2, ordem: 0 },
  ] as any[];
  const saida = ordenarPorSenioridade(ops);
  assert.deepEqual(saida.map((o) => o.id ?? o.nome), [7, 3, 9, 1, 'rascunho A', 'rascunho B', 2]);
});

test('ordem: tipo desconhecido vai depois do equity e nunca é descartado; entrada não é mutada', () => {
  const ops = [{ tipo: 'misterio', id: 1 }, { tipo: 'equity', id: 2 }, { tipo: 'divida', id: 3 }] as any[];
  const copia = JSON.parse(JSON.stringify(ops));
  const saida = ordenarPorSenioridade(ops);
  assert.deepEqual(saida.map((o) => o.tipo), ['divida', 'equity', 'misterio']);
  assert.deepEqual(ops, copia, 'entrada intacta');
  assert.notEqual(saida, ops, 'array novo');
  assert.equal(nivelSenioridade('misterio'), ORDEM_SENIORIDADE.length);
  assert.equal(nivelSenioridade('financiamento_producao'), 0);
});

// ── Sequência ────────────────────────────────────────────────────────────

test('sequência: antes de cada passo é o depois do anterior; o primeiro antes é o projeto sem funding', () => {
  const seq = sequenciaDeEstrutura(QUATRO, simular);
  assert.ok(seq);
  assert.deepEqual(seq.base, indicadoresEstrutura(calcularFluxo(CONFIG), null));
  assert.deepEqual(seq.passos.map((p) => p.operacao.id), [10, 20, 30, 40]);
  assert.equal(seq.passos[0].antes, seq.base);
  for (let i = 1; i < seq.passos.length; i++) assert.equal(seq.passos[i].antes, seq.passos[i - 1].depois);
});

test('sequência: o último depois é a estrutura completa', () => {
  const seq = sequenciaDeEstrutura(QUATRO, simular);
  assert.ok(seq);
  assert.deepEqual(seq.passos[seq.passos.length - 1].depois, indicadoresEstrutura(COMPLETA.calc, COMPLETA.funding));
});

test('sequência: embaralhar a entrada não muda a saída', () => {
  const a = sequenciaDeEstrutura(QUATRO, simular);
  const b = sequenciaDeEstrutura([DIVIDA, FAP, EQUITY, ANTECIPACAO], simular);
  const c = sequenciaDeEstrutura([ANTECIPACAO, EQUITY, DIVIDA, FAP], simular);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('sequência: Financiamento à produção desligado não entra, nem como passo nem no prefixo', () => {
  const vistos: OperacaoFunding[][] = [];
  const espiao = (ops: OperacaoFunding[]) => { vistos.push(ops); return simular(ops); };
  const seq = sequenciaDeEstrutura([{ ...FAP, ativo: false }, DIVIDA, EQUITY], espiao);
  assert.ok(seq);
  assert.deepEqual(seq.passos.map((p) => p.operacao.tipo), ['divida', 'equity']);
  assert.equal(vistos.some((ops) => ops.some((o) => o.tipo === 'financiamento_producao')), false);
});

test('sequência: sem operação efetiva, passos vazios; simular null devolve null', () => {
  const seq = sequenciaDeEstrutura([{ ...FAP, ativo: false }], simular);
  assert.ok(seq);
  assert.deepEqual(seq.passos, []);
  assert.equal(sequenciaDeEstrutura(QUATRO, () => null), null);
  let n = 0;
  assert.equal(sequenciaDeEstrutura(QUATRO, (ops) => (++n > 2 ? null : simular(ops))), null, 'null no meio também');
});

test('reaproveitar o fluxo da estrutura completa dá o mesmo que recalcular o fluxo, em cada prefixo', () => {
  // O horizonte maior (que cobre a quitação de todas as operações) só acrescenta zeros.
  const ordenadas = ordenarPorSenioridade(QUATRO);
  for (let i = 0; i <= ordenadas.length; i++) {
    const prefixo = ordenadas.slice(0, i);
    const reaproveitado = rodar(prefixo, COMPLETA.calc);
    const refeito = rodar(prefixo);
    assert.deepEqual(
      indicadoresEstrutura(reaproveitado.calc, reaproveitado.funding),
      indicadoresEstrutura(refeito.calc, refeito.funding),
      `prefixo de ${i} operação(ões)`,
    );
  }
});

// ── Camadas e totais ─────────────────────────────────────────────────────

test('camadas: nunca negativas, na senioridade com o incorporador no topo, somando 100%', () => {
  const completa = indicadoresEstrutura(COMPLETA.calc, COMPLETA.funding);
  assert.ok(completa.exposicaoMaxima < 0, 'a fixture tem exposição');
  const camadas = camadasDoStack(COMPLETA.funding, completa);
  assert.deepEqual(camadas.map((c) => c.tipo), ['financiamento_producao', 'divida', 'antecipacao_recebiveis', 'equity', 'incorporador']);
  for (const c of camadas) assert.ok(c.valor >= 0, `${c.nome} não negativa`);
  const topo = camadas[camadas.length - 1];
  assert.equal(topo.valor, Math.abs(completa.exposicaoMaxima));
  assert.ok(Math.abs(somaDe(camadas.map((c) => c.pct ?? 0)) - 100) < 1e-9);
  // Os valores de cada tipo.
  assert.equal(camadas[0].valor, maiorSaldoDevedor(serieDe(COMPLETA.funding, 10)));
  assert.equal(camadas[1].valor, maiorSaldoDevedor(serieDe(COMPLETA.funding, 20)));
  assert.equal(camadas[2].valor, indicadoresAntecipacao(serieDe(COMPLETA.funding, 30)).valorPresente);
  assert.equal(camadas[3].valor, Math.round(somaDe(serieDe(COMPLETA.funding, 40).entradas) * 100) / 100);
});

test('camadas: sem operação, só o incorporador; Σ = 0 devolve pct null, nunca NaN', () => {
  const so = camadasDoStack(null, { exposicaoMaxima: -500, tirAlavancada: null, custoFinanceiro: 0, resultadoAposFunding: 0 });
  assert.deepEqual(so, [{ id: 'incorporador', tipo: 'incorporador', nome: 'Incorporador', valor: 500, pct: 100 }]);
  const zero = camadasDoStack(null, { exposicaoMaxima: 0, tirAlavancada: null, custoFinanceiro: 0, resultadoAposFunding: 0 });
  assert.equal(zero.length, 1);
  assert.equal(zero[0].valor, 0);
  assert.equal(zero[0].pct, null);
});

test('camada do Financiamento à produção vem da estrutura completa, não do passo dele sozinho', () => {
  const sozinho = rodar([FAP]);
  const s1 = serieDe(sozinho.funding, 10);
  const sc = serieDe(COMPLETA.funding, 10);
  assert.notDeepEqual(s1.saldo, sc.saldo, 'a fixture distingue as duas leituras');
  const camadas = camadasDoStack(COMPLETA.funding, indicadoresEstrutura(COMPLETA.calc, COMPLETA.funding));
  assert.equal(camadas[0].valor, maiorSaldoDevedor(sc));
  assert.notEqual(camadas[0].valor, maiorSaldoDevedor(s1));
});

test('totais: usos = Σ custos; dívida = dívidas + Financiamento à produção; equity = aportes; incorporador = pico', () => {
  const completa = indicadoresEstrutura(COMPLETA.calc, COMPLETA.funding);
  const camadas = camadasDoStack(COMPLETA.funding, completa);
  const t = totaisDaEstrutura(COMPLETA.calc, camadas, completa);
  assert.equal(t.usosTotais, Math.round(somaDe(COMPLETA.calc.custoMensal) * 100) / 100);
  assert.equal(t.divida, Math.round((camadas[0].valor + camadas[1].valor) * 100) / 100);
  assert.equal(t.equityTerceiros, camadas[3].valor);
  assert.equal(t.incorporadorNoPico, Math.abs(completa.exposicaoMaxima));
});

test('maior saldo devedor: só dívida e Financiamento à produção', () => {
  assert.ok((maiorSaldoDevedor(serieDe(COMPLETA.funding, 20)) ?? 0) > 0);
  assert.equal(maiorSaldoDevedor(serieDe(COMPLETA.funding, 40)), null);
  assert.equal(maiorSaldoDevedor(serieDe(COMPLETA.funding, 30)), null);
});

// ── KPIs ─────────────────────────────────────────────────────────────────

const VGV = COMPLETA.calc.vgvTotal;
const seq = sequenciaDeEstrutura(QUATRO, simular)!;
const passoDe = (id: number): PassoEstrutura => seq.passos.find((p) => p.operacao.id === id)!;

test('KPIs da dívida, do equity e da antecipação com base', () => {
  const kd = kpisDaOperacao(serieDe(COMPLETA.funding, 20), VGV, passoDe(20));
  assert.equal(kd.tipo, 'divida');
  if (kd.tipo !== 'divida') return;
  assert.ok((kd.ltvPct ?? 0) > 0);
  assert.ok((kd.custoEfetivoPct ?? 0) > 10, 'taxa de 14% a.a. sai como ~14 pontos, não 0,14');
  assert.equal(kd.exposicaoAntes, Math.abs(passoDe(20).antes.exposicaoMaxima));
  assert.equal(kd.exposicaoDepois, Math.abs(passoDe(20).depois.exposicaoMaxima));
  assert.equal(kd.tirAlavancadaAntes, passoDe(20).antes.tirAlavancada);
  assert.equal(kd.tirAlavancadaDepois, passoDe(20).depois.tirAlavancada);

  const ke = kpisDaOperacao(serieDe(COMPLETA.funding, 40), VGV, passoDe(40));
  assert.equal(ke.tipo, 'equity');
  if (ke.tipo !== 'equity') return;
  assert.equal(typeof ke.roiInvestidorPct, 'number');
  assert.equal(typeof ke.tirInvestidorPct, 'number');

  const ka = kpisDaOperacao(serieDe(COMPLETA.funding, 30), VGV, passoDe(30));
  assert.equal(ka.tipo, 'antecipacao_recebiveis');
  if (ka.tipo !== 'antecipacao_recebiveis') return;
  const ind = indicadoresAntecipacao(serieDe(COMPLETA.funding, 30));
  assert.equal(ka.desagioPct, ind.desagioPct * 100);
  assert.equal(ka.custoEfetivoPct, (ind.custoEfetivoAnual as number) * 100);
});

test('unidade: custo efetivo e TIR alavancada saem em pontos percentuais, e a leitura compara na mesma unidade', () => {
  const s = serieDe(COMPLETA.funding, 20);
  const k = kpisDaOperacao(s, VGV, passoDe(20));
  if (k.tipo !== 'divida') throw new Error('dívida');
  // TIR alavancada: % direto de `tirFluxo` (12 = 12%); custo efetivo: fração × 100.
  assert.ok(k.tirAlavancadaAntes !== null && Math.abs(k.tirAlavancadaAntes) > 1, 'TIR alavancada não está em fração');
  assert.ok(k.custoEfetivoPct !== null && k.custoEfetivoPct > 1 && k.custoEfetivoPct < 100);
  // A leitura usa os dois números como estão, lado a lado, em % a.a.
  const fake: KpisOperacao = { ...k, custoEfetivoPct: 14, tirAlavancadaAntes: 20 };
  const frases = leituraDaOperacao({ serie: s, kpis: fake, passo: null }, String, fmtMes);
  assert.ok(frases.some((f) => f.includes('14,0% a.a.') && f.includes('20,0% a.a.') && f.includes('abaixo')));
});

/** Série sintética de uma operação. */
function serie(tipo: string, campos: Partial<SerieOperacao> = {}, op: Partial<OperacaoFunding> = {}): SerieOperacao {
  const z = () => [0, 0, 0, 0];
  return {
    operacao: { tipo, nome: 'X', valor: 0, inicio_mes: 0, ...op } as OperacaoFunding,
    entradas: z(), saidas: z(), fluxoInvestidor: z(), juros: z(), saldo: z(), tarifas: z(), ...campos,
  };
}

test('KPIs sem base são null, nunca zero', () => {
  // Dívida de valor zero: sem liberação, sem troca de sinal.
  const d = kpisDaOperacao(serie('divida'), VGV, null);
  assert.deepEqual(d, {
    tipo: 'divida', ltvPct: null, custoEfetivoPct: null,
    tirAlavancadaAntes: null, tirAlavancadaDepois: null, exposicaoAntes: null, exposicaoDepois: null,
  });
  // VGV zero com principal: LTV null.
  const comPrincipal = serie('divida', { entradas: [100, 0, 0, 0], saidas: [0, 0, 0, 110], fluxoInvestidor: [-100, 0, 0, 110] });
  const dv = kpisDaOperacao(comPrincipal, 0, null);
  assert.ok(dv.tipo === 'divida' && dv.ltvPct === null && dv.custoEfetivoPct !== null);
  // Equity sem aporte: ROI e TIR null.
  const e0 = kpisDaOperacao(serie('equity'), VGV, null);
  assert.ok(e0.tipo === 'equity' && e0.roiInvestidorPct === null && e0.tirInvestidorPct === null);
  // Equity com aporte e sem retorno: TIR null, ROI −100.
  const eSem = kpisDaOperacao(serie('equity', { entradas: [100, 0, 0, 0], fluxoInvestidor: [-100, 0, 0, 0] }), VGV, null);
  assert.ok(eSem.tipo === 'equity');
  if (eSem.tipo !== 'equity') return;
  assert.equal(eSem.tirInvestidorPct, null);
  assert.equal(eSem.roiInvestidorPct, -100);
  // Antecipação sem lastro: o motor devolve deságio 0, o KPI devolve null.
  const semLastro = serie('antecipacao_recebiveis');
  assert.equal(indicadoresAntecipacao(semLastro).desagioPct, 0, 'premissa: o motor devolve 0');
  const a = kpisDaOperacao(semLastro, VGV, null);
  assert.ok(a.tipo === 'antecipacao_recebiveis' && a.desagioPct === null && a.custoEfetivoPct === null);
});

test('KPIs do Financiamento à produção e de tipo desconhecido: só os da estrutura', () => {
  const f = kpisDaOperacao(serieDe(COMPLETA.funding, 10), VGV, passoDe(10));
  assert.equal(f.tipo, 'financiamento_producao');
  assert.equal(f.exposicaoDepois, Math.abs(passoDe(10).depois.exposicaoMaxima));
  assert.equal(kpisDaOperacao(serie('misterio'), VGV, null).tipo, 'outro');
});

test('LTV pela série é o da visão do investidor com nomes distintos, e correto com dois nomes iguais', () => {
  const vi = visaoInvestidor({ funding: COMPLETA.funding, fluxoLivreMensal: COMPLETA.calc.fluxoMensal, exposicaoMaxima: 0, vgvTotal: VGV });
  for (const id of [10, 20]) {
    const s = serieDe(COMPLETA.funding, id);
    const doVi = vi.ltvs.find((l) => l.nome === s.operacao.nome);
    assert.ok(doVi);
    assert.equal(ltvDaSerie(s, VGV), doVi.ltvPct);
  }
  // Dois nomes iguais: cada série tem o seu LTV, sem colisão.
  const a = serie('divida', { entradas: [100, 0, 0, 0] }, { nome: 'Banco' });
  const b = serie('divida', { entradas: [300, 0, 0, 0] }, { nome: 'Banco' });
  assert.equal(ltvDaSerie(a, 1_000), 10);
  assert.equal(ltvDaSerie(b, 1_000), 30);
});

// ── Rótulo e leitura ─────────────────────────────────────────────────────

test('rótulo de preferência do equity, com o padrão do motor', () => {
  assert.equal(rotuloPreferenciaEquity('permuta_financeira'), 'recebe sobre a receita');
  assert.equal(rotuloPreferenciaEquity('resultado_final'), 'participa do resultado');
  assert.equal(rotuloPreferenciaEquity(undefined), 'recebe sobre a receita');
  assert.equal(rotuloPreferenciaEquity(null), 'recebe sobre a receita');
  // Modo desconhecido: o motor só é progressivo com `permuta_financeira` exato,
  // e o rótulo segue o motor.
  assert.equal(rotuloPreferenciaEquity('outro_modo'), 'participa do resultado');
  assert.equal(rotuloPreferenciaEquity(''), 'participa do resultado');
});

const est = (exposicaoMaxima: number, tirAlavancada: number | null = null): IndicadoresEstrutura =>
  ({ exposicaoMaxima, tirAlavancada, custoFinanceiro: 0, resultadoAposFunding: 0 });
const passo = (antes: IndicadoresEstrutura, depois: IndicadoresEstrutura): PassoEstrutura =>
  ({ operacao: { tipo: 'divida', nome: 'X', valor: 0, inicio_mes: 0 }, antes, depois });
const kpiDivida = (custo: number | null, tirAntes: number | null): KpisOperacao => ({
  tipo: 'divida', ltvPct: null, custoEfetivoPct: custo,
  tirAlavancadaAntes: tirAntes, tirAlavancadaDepois: null, exposicaoAntes: null, exposicaoDepois: null,
});
const fmt = (v: number) => `R$${v}`;
/** Formatador de mês de teste: o índice 0-based do motor, como `rotuloMesRelativo` sem data de início. */
const fmtMes = (i: number) => `M${i}`;
const VAZIA = serie('divida');

test('leitura (1): exposição reduz, aumenta ou não altera, com a fronteira do limiar', () => {
  const ler = (a: number, d: number) => leituraDaOperacao({ serie: VAZIA, kpis: kpiDivida(null, null), passo: passo(est(a), est(d)) }, fmt, fmtMes);
  assert.deepEqual(ler(-1000, -400), ['Reduz a exposição máxima do incorporador de R$1000 para R$400.']);
  assert.deepEqual(ler(-400, -1000), ['Aumenta a exposição máxima do incorporador de R$400 para R$1000.']);
  // Abaixo do limiar: não altera; no limiar: já altera.
  assert.match(ler(-1000, -1000 + LIMIAR_EXPOSICAO_INALTERADA - 0.01)[0], /^Não altera/);
  assert.match(ler(-1000, -1000 + LIMIAR_EXPOSICAO_INALTERADA)[0], /^Reduz/);
});

test('leitura (2): quando recebe e paga, com o mês pelo formatador da tela (índice 0-based do motor)', () => {
  const s = serie('divida', { entradas: [0, 100, 0, 0], saidas: [0, 0, 60, 60] });
  assert.deepEqual(
    leituraDaOperacao({ serie: s, kpis: kpiDivida(null, null), passo: null }, fmt, fmtMes),
    ['O projeto recebe a partir de M1 e paga até M3.'],
  );
  const eq = serie('equity', { entradas: [100, 0, 0, 0] });
  assert.deepEqual(
    leituraDaOperacao({ serie: eq, kpis: { ...kpiDivida(null, null), tipo: 'equity', roiInvestidorPct: null, tirInvestidorPct: null } as KpisOperacao, passo: null }, fmt, fmtMes),
    ['O investidor aporta a partir de M0.'],
  );
  const so = serie('divida', { saidas: [0, 0, 0, 5] });
  assert.deepEqual(leituraDaOperacao({ serie: so, kpis: kpiDivida(null, null), passo: null }, fmt, fmtMes), ['O projeto paga até M3.']);
});

test('leitura (2): fronteira de LIMIAR_MES_COM_VALOR — abaixo não conta como mês, no limiar conta', () => {
  const abaixo = LIMIAR_MES_COM_VALOR - 0.001;
  const ler = (s: SerieOperacao) => leituraDaOperacao({ serie: s, kpis: kpiDivida(null, null), passo: null }, fmt, fmtMes);
  // Valores abaixo do limiar, nos dois sinais, não fazem frase.
  assert.deepEqual(ler(serie('divida', { entradas: [abaixo, 0, 0, 0], saidas: [0, 0, 0, -abaixo] })), []);
  // No limiar exato, o mês conta — na entrada (primeiro mês) e na saída (último mês).
  assert.deepEqual(
    ler(serie('divida', { entradas: [abaixo, LIMIAR_MES_COM_VALOR, 0, 0], saidas: [0, 0, LIMIAR_MES_COM_VALOR, abaixo] })),
    ['O projeto recebe a partir de M1 e paga até M2.'],
  );
});

test('leitura (3): custo contra a TIR alavancada antes, com veredito negativo e a fronteira do empate', () => {
  const ler = (custo: number, tir: number) => leituraDaOperacao({ serie: VAZIA, kpis: kpiDivida(custo, tir), passo: null }, fmt, fmtMes);
  assert.match(ler(12, 20)[0], /abaixo .*alavanca o retorno/);
  assert.match(ler(25, 20)[0], /acima .*reduz o retorno/, 'veredito negativo');
  assert.match(ler(20 + LIMIAR_CUSTO_EMPATE_PP - 0.001, 20)[0], /praticamente/);
  assert.match(ler(20 + LIMIAR_CUSTO_EMPATE_PP, 20)[0], /acima/);
  // Sem um dos dois números, a frase não sai.
  assert.deepEqual(leituraDaOperacao({ serie: VAZIA, kpis: kpiDivida(12, null), passo: null }, fmt, fmtMes), []);
  assert.deepEqual(leituraDaOperacao({ serie: VAZIA, kpis: kpiDivida(null, 20), passo: null }, fmt, fmtMes), []);
});

test('leitura: sem número nenhum devolve [] e nunca passa de três frases', () => {
  assert.deepEqual(leituraDaOperacao({ serie: VAZIA, kpis: kpiDivida(null, null), passo: null }, fmt, fmtMes), []);
  const cheia = serie('divida', { entradas: [100, 0, 0, 0], saidas: [0, 0, 0, 110] });
  const frases = leituraDaOperacao({ serie: cheia, kpis: kpiDivida(12, 20), passo: passo(est(-10), est(-5)) }, fmt, fmtMes);
  assert.equal(frases.length, MAX_FRASES_LEITURA);
  assert.match(frases[0], /exposição/);
  assert.match(frases[1], /M\d/);
  assert.match(frases[2], /TIR alavancada/);
});

test('leitura sobre o motor real: o cartão de cada operação tem as três frases', () => {
  for (const id of [20, 30, 40]) {
    const s = serieDe(COMPLETA.funding, id);
    const p = passoDe(id);
    const frases = leituraDaOperacao({ serie: s, kpis: kpisDaOperacao(s, VGV, p), passo: p }, fmt, fmtMes);
    assert.equal(frases.length, 3, `operação ${id}: ${frases.join(' | ')}`);
  }
});

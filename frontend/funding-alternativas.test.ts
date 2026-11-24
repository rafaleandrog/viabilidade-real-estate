// Estruturas de capital alternativas — módulo puro. Não prova fiação em tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { fundingDoEstudo, receitaLiquidaComCorretagemMensal, type OperacaoFunding } from './funding-motor.js';
import { mesRepasse } from './fluxo-shared.js';
import {
  MAX_ALTERNATIVAS, alternativaDoSalvo, gravarAlternativas, indicadoresEstrutura, lerAlternativas,
  novaOperacaoAlternativa, planoUsarAlternativa, planoVazio, type AlternativaFunding,
} from './funding-alternativas.js';

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
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 50, parcelas: 12, periodicidade: 'mensal' }],
      repasse: [{ pct: 30, mesesAposObra: 1 }],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 4_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 12_000_000, orcamento_unidade: 'rs', inicio_mes: 3, duracao_meses: 12 },
  ],
  areaTerreno: 3_000,
};

const SALVAS: OperacaoFunding[] = [
  { id: 1, tipo: 'divida', nome: '1º Dívida', valor: 3_000_000, inicio_mes: 0, taxa_anual: 12,
    periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, aporte_meses: 3, distribuir_aporte: true },
  { id: 2, tipo: 'equity', nome: '1º Equity', valor: 1_000_000, inicio_mes: 1, modo_retorno: 'permuta_financeira', pct_retorno: 5 },
  { id: 3, tipo: 'financiamento_producao', nome: 'FàP', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
    exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true, ativo: false },
];

/** Monta o funding exatamente como `_recalcular` da tela de Funding. */
function simular(operacoes: OperacaoFunding[]) {
  const calc = calcularFluxo({ ...CONFIG, operacoesFunding: operacoes });
  const receita = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, CONFIG.linhasCusto);
  const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
  const funding = fundingDoEstudo(operacoes, calc.fluxoMensal, receita, resultadoFinal, mesRepasse(CRONO), 12, {
    custosRaw: CONFIG.linhasCusto, linhasCusto: calc.linhasCusto, cronograma: CRONO,
    recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal,
  });
  return { calc, funding };
}
const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

test('critério 2: alternativa idêntica ao salvo reproduz os 4 indicadores', () => {
  const a = simular(SALVAS);
  const b = simular(alternativaDoSalvo(SALVAS, 'Cópia').operacoes);
  assert.deepEqual(indicadoresEstrutura(b.calc, b.funding), indicadoresEstrutura(a.calc, a.funding));
});

test('mais equity/dívida muda os indicadores', () => {
  const s0 = simular(SALVAS);
  const base = indicadoresEstrutura(s0.calc, s0.funding);
  const maior = SALVAS.map((o) => (o.tipo === 'equity' ? { ...o, valor: 3_000_000 } : o));
  const s = simular(maior);
  const ind = indicadoresEstrutura(s.calc, s.funding);
  assert.notDeepEqual(ind, base);
  assert.notEqual(ind.custoFinanceiro, base.custoFinanceiro);
});

test('sem funding: TIR do projeto, custo 0, resultado = Σ do fluxo livre', () => {
  const calc = calcularFluxo(CONFIG);
  const ind = indicadoresEstrutura(calc, null);
  assert.equal(ind.tirAlavancada, calc.tir);
  assert.equal(ind.custoFinanceiro, 0);
  assert.equal(ind.resultadoAposFunding, Math.round(soma(calc.fluxoMensal) * 100) / 100);
  assert.equal(ind.exposicaoMaxima, calc.exposicaoMaxima);
});

test('custo financeiro = resultado sem funding − resultado após (tolerância de centavos)', () => {
  const { calc, funding } = simular(SALVAS);
  const ind = indicadoresEstrutura(calc, funding);
  const sem = indicadoresEstrutura(calc, null);
  assert.ok(ind.custoFinanceiro > 0);
  // Cada mês do alavancado é arredondado em separado: aceita até 1 centavo por mês.
  assert.ok(Math.abs(sem.resultadoAposFunding - ind.resultadoAposFunding - ind.custoFinanceiro) <= 0.01 * calc.fluxoMensal.length);
});

test('exposição: piso em zero e nunca -0', () => {
  const ind = indicadoresEstrutura({ fluxoMensal: [10, 20] }, null);
  assert.ok(Object.is(ind.exposicaoMaxima, 0));
  assert.equal(indicadoresEstrutura({ fluxoMensal: [-10, 4, -1] }, null).exposicaoMaxima, -10);
});

test('plano: idêntica ao salvo é vazio e não muta as entradas', () => {
  const antes = JSON.stringify(SALVAS);
  const alt = alternativaDoSalvo(SALVAS, 'X');
  const altAntes = JSON.stringify(alt);
  assert.ok(planoVazio(planoUsarAlternativa(SALVAS, alt)));
  const alt2 = alternativaDoSalvo(SALVAS, 'Y');
  alt2.operacoes[0].valor = 1; // a cópia é profunda
  assert.equal(JSON.stringify(SALVAS), antes);
  planoUsarAlternativa(SALVAS, alt2);
  assert.equal(JSON.stringify(SALVAS), antes);
  assert.equal(JSON.stringify(alt), altAntes);
});

test('plano: criar, atualizar só o que mudou e remover', () => {
  const alt = alternativaDoSalvo(SALVAS, 'X');
  alt.operacoes[0].valor = 5_000_000;                       // atualizar
  alt.operacoes = alt.operacoes.filter((o) => o.id !== 2);  // remover o equity
  alt.operacoes.push(novaOperacaoAlternativa('equity', '2º Equity'));       // criar
  alt.operacoes.push({ ...novaOperacaoAlternativa('divida', 'fantasma'), id: 99 }); // id inexistente → criar
  const p = planoUsarAlternativa(SALVAS, alt);
  assert.deepEqual(p.atualizar, [{ id: 1, campos: { valor: 5_000_000 } }]);
  assert.deepEqual(p.remover, [2]);
  assert.equal(p.criar.length, 2);
  assert.ok(p.criar.every((o) => !('id' in o)));
});

test('plano: Financiamento à produção é desligado, não removido', () => {
  const ligada = SALVAS.map((o) => (o.id === 3 ? { ...o, ativo: true } : o));
  const alt = alternativaDoSalvo(ligada, 'X');
  alt.operacoes = alt.operacoes.filter((o) => o.tipo !== 'financiamento_producao');
  const p = planoUsarAlternativa(ligada, alt);
  assert.deepEqual(p.atualizar, [{ id: 3, campos: { ativo: false } }]);
  assert.deepEqual(p.remover, []);
  // já desligada: nada a fazer
  const semFap = planoUsarAlternativa(SALVAS, alt);
  assert.deepEqual(semFap.atualizar, []);
  assert.deepEqual(semFap.remover, []);
});

function storageFalso(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, v); },
  } as Storage;
}

test('localStorage: ida e volta, por estudo', () => {
  const st = storageFalso();
  const alts = [alternativaDoSalvo(SALVAS, 'A', 'a')];
  assert.equal(gravarAlternativas(7, alts, st), true);
  assert.deepEqual(lerAlternativas(7, st), alts);
  assert.deepEqual(lerAlternativas(8, st), []);
  assert.ok(st.getItem('viab:funding-alternativas:7'));
});

test('localStorage: storage que lança, JSON corrompido, null e formato inválido', () => {
  const lanca = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } as unknown as Storage;
  assert.deepEqual(lerAlternativas(1, lanca), []);
  assert.equal(gravarAlternativas(1, [], lanca), false);
  assert.deepEqual(lerAlternativas(1, null), []);
  assert.equal(gravarAlternativas(1, [], null), false);
  const st = storageFalso();
  st.setItem('viab:funding-alternativas:1', '{não é json');
  assert.deepEqual(lerAlternativas(1, st), []);
  st.setItem('viab:funding-alternativas:1', '{"a":1}');
  assert.deepEqual(lerAlternativas(1, st), []);
  st.setItem('viab:funding-alternativas:1', '[1,{"id":"a"}]');
  assert.deepEqual(lerAlternativas(1, st), []);
});

test('localStorage: corta em MAX_ALTERNATIVAS', () => {
  const st = storageFalso();
  const alts: AlternativaFunding[] = Array.from({ length: 5 }, (_, i) => alternativaDoSalvo([], `n${i}`, `id${i}`));
  gravarAlternativas(1, alts, st);
  assert.equal(JSON.parse(st.getItem('viab:funding-alternativas:1')!).length, MAX_ALTERNATIVAS);
  st.setItem('viab:funding-alternativas:1', JSON.stringify(alts));
  assert.equal(lerAlternativas(1, st).length, MAX_ALTERNATIVAS);
});

// Estruturas de capital alternativas — módulo puro. Não prova fiação em tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { fundingDoEstudo, receitaLiquidaComCorretagemMensal, type OperacaoFunding } from './funding-motor.js';
import { mesRepasse } from './fluxo-shared.js';
import {
  MAX_ALTERNATIVAS, alternativaDoSalvo, gravarAlternativas, indicadoresEstrutura, lerAlternativas,
  novaOperacaoAlternativa, passosDoPlano, planoUsarAlternativa, planoVazio, type AlternativaFunding,
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

test('plano: operação nova ancorada ao cronograma é criada preservando o cronograma_evento', () => {
  const nova = { ...novaOperacaoAlternativa('divida', 'Dívida ancorada'), cronograma_evento: 'obra' } as OperacaoFunding;
  const alt = alternativaDoSalvo([], 'a', 'a1');
  alt.operacoes.push(nova);
  const plano = planoUsarAlternativa([], alt);
  assert.equal(plano.criar.length, 1);
  assert.equal((plano.criar[0] as any).cronograma_evento, 'obra');
  assert.equal(plano.criar[0].id, undefined);
  assert.deepEqual(plano.atualizar, []);
  assert.deepEqual(plano.remover, []);
});

test('plano: marcadores de tela (`__*`) nunca entram — nem em criar nem em atualizar', () => {
  // Desmarcar e remarcar "Incluir" deixava `__fora: false` na operação.
  const alt = alternativaDoSalvo(SALVAS, 'X');
  (alt.operacoes[0] as any).__fora = false;
  assert.ok(planoVazio(planoUsarAlternativa(SALVAS, alt)), 'alternativa idêntica segue igual ao salvo');
  alt.operacoes[0].valor = 7_000_000;
  const nova = { ...novaOperacaoAlternativa('equity', 'N'), __fora: false } as any;
  alt.operacoes.push(nova);
  const p = planoUsarAlternativa(SALVAS, alt);
  assert.deepEqual(p.atualizar, [{ id: alt.operacoes[0].id, campos: { valor: 7_000_000 } }]);
  assert.ok(p.criar.every((o) => Object.keys(o).every((k) => !k.startsWith('__'))));
});

test('passosDoPlano: remover → atualizar → criar; reduções antes de aumentos', () => {
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 100, pct_retorno: 80 },
    { id: 2, tipo: 'equity', nome: 'B', valor: 100, pct_retorno: 10 },
    { id: 3, tipo: 'equity', nome: 'C', valor: 5, pct_retorno: 5 },
  ] as any;
  const plano = {
    criar: [{ tipo: 'equity', nome: 'N', pct_retorno: 40 }] as any,
    atualizar: [
      { id: 2, campos: { pct_retorno: 40 } },   // sobe
      { id: 1, campos: { pct_retorno: 20 } },   // baixa
    ],
    remover: [3],
  };
  const passos = passosDoPlano(plano, salvas);
  assert.deepEqual(passos.map((p) => p.acao), ['remover', 'atualizar', 'atualizar', 'criar']);
  assert.deepEqual(passos.filter((p) => p.acao === 'atualizar').map((p: any) => p.id), [1, 2]);
  simularServidor(salvas, passos);
});

/** Aplica os passos sobre as salvas e confere o teto de 100% por modo a cada passo (como o servidor). */
function simularServidor(salvas: any[], passos: any[]): any[] {
  const ops = salvas.map((o) => ({ ...o }));
  let prox = 1000;
  const confere = (op: any, ignorar?: any) => {
    if (op.tipo !== 'equity') return;
    const modo = String(op.modo_retorno ?? 'permuta_financeira');
    const usado = ops.filter((o) => o.tipo === 'equity' && o.id !== ignorar
      && String(o.modo_retorno ?? 'permuta_financeira') === modo).reduce((a, o) => a + (Number(o.pct_retorno) || 0), 0);
    assert.ok(usado + (Number(op.pct_retorno) || 0) <= 100.01, `soma em ${modo} passou de 100`);
  };
  for (const p of passos) {
    if (p.acao === 'remover') ops.splice(ops.findIndex((o) => o.id === p.id), 1);
    else if (p.acao === 'criar') { const n = { ...p.op, id: prox++ }; confere(n); ops.push(n); }
    else {
      const i = ops.findIndex((o) => o.id === p.id);
      const novo = { ...ops[i], ...p.campos };
      confere(novo, p.id);
      ops[i] = novo;
    }
  }
  return ops;
}

test('passosDoPlano: ordem não soma valor com pct (A 20→80 com valor menor, B 80→20)', () => {
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 10_000_000, pct_retorno: 20 },
    { id: 2, tipo: 'equity', nome: 'B', valor: 100, pct_retorno: 80 },
  ] as any;
  const plano = {
    criar: [],
    atualizar: [
      { id: 1, campos: { pct_retorno: 80, valor: 1_000_000 } },
      { id: 2, campos: { pct_retorno: 20 } },
    ],
    remover: [],
  };
  const passos = passosDoPlano(plano, salvas);
  assert.deepEqual(passos.map((p: any) => p.id), [2, 1]);
  simularServidor(salvas, passos);
});

test('passosDoPlano: troca de modo cruzada zera antes e nunca passa de 100 por modo', () => {
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 1, modo_retorno: 'permuta_financeira', pct_retorno: 80 },
    { id: 2, tipo: 'equity', nome: 'B', valor: 1, modo_retorno: 'resultado_final', pct_retorno: 80 },
  ] as any;
  const plano: any = {
    criar: [],
    atualizar: [
      { id: 1, campos: { modo_retorno: 'resultado_final', pct_retorno: 80 } },
      { id: 2, campos: { modo_retorno: 'permuta_financeira', pct_retorno: 80 } },
    ],
    remover: [],
  };
  const passos = passosDoPlano(plano, salvas) as any[];
  assert.deepEqual(passos.slice(0, 2).map((p) => p.campos), [{ pct_retorno: 0 }, { pct_retorno: 0 }]);
  simularServidor(salvas, passos);
});

test('passosDoPlano: reduzir valor mas subir pct conta como aumento; remover+criar 80/80 respeita o teto', () => {
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 100, pct_retorno: 10 },
    { id: 2, tipo: 'equity', nome: 'B', valor: 100, pct_retorno: 50 },
    { id: 3, tipo: 'equity', nome: 'C', valor: 100, pct_retorno: 80 },
  ] as any;
  const plano = {
    criar: [{ tipo: 'equity', nome: 'N', pct_retorno: 80 }] as any,
    atualizar: [
      { id: 1, campos: { valor: 1, pct_retorno: 20 } },  // valor cai, pct sobe
      { id: 2, campos: { pct_retorno: 0 } },
    ],
    remover: [3],
  };
  const passos = passosDoPlano(plano, salvas);
  assert.deepEqual(passos.map((p: any) => p.id ?? 'n'), [3, 2, 1, 'n']);
  simularServidor(salvas, passos);
});

test('passosDoPlano: troca só de modo preserva o pct_retorno no estado final', () => {
  // `campos` traz só o que mudou (o modo); o zeramento prévio não pode ficar gravado.
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 1, modo_retorno: 'permuta_financeira', pct_retorno: 80 },
  ] as any;
  const plano: any = { criar: [], atualizar: [{ id: 1, campos: { modo_retorno: 'resultado_final' } }], remover: [] };
  const final = simularServidor(salvas, passosDoPlano(plano, salvas));
  assert.equal(final[0].modo_retorno, 'resultado_final');
  assert.equal(final[0].pct_retorno, 80);
});

test('passosDoPlano: troca cruzada termina com cada equity no modo e no pct da alternativa', () => {
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 1, modo_retorno: 'permuta_financeira', pct_retorno: 60 },
    { id: 2, tipo: 'equity', nome: 'B', valor: 1, modo_retorno: 'resultado_final', pct_retorno: 0 },
  ] as any;
  const plano: any = {
    criar: [],
    atualizar: [
      { id: 1, campos: { modo_retorno: 'resultado_final' } },
      { id: 2, campos: { modo_retorno: 'permuta_financeira', pct_retorno: 30 } },
    ],
    remover: [],
  };
  const passos = passosDoPlano(plano, salvas) as any[];
  // B já está em 0: nenhum zeramento inútil para ela.
  assert.equal(passos.filter((p) => p.id === 2 && p.campos?.pct_retorno === 0).length, 0);
  const final = simularServidor(salvas, passos);
  assert.deepEqual(final.map((o) => [o.id, o.modo_retorno, o.pct_retorno]),
    [[1, 'resultado_final', 60], [2, 'permuta_financeira', 30]]);
});

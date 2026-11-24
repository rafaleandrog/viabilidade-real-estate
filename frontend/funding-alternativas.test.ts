// Estruturas de capital alternativas — módulo puro. Não prova fiação em tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { fundingDoEstudo, receitaLiquidaComCorretagemMensal, type OperacaoFunding } from './funding-motor.js';
import { mesRepasse } from './fluxo-shared.js';
import {
  MAX_ALTERNATIVAS, alternativaDoSalvo, errosDoEstadoFinal, validarOperacaoComoServidor, recusaDoPostComoServidor, gravarAlternativas, indicadoresEstrutura, lerAlternativas, limparCacheAlternativas,
  novaOperacaoAlternativa, passosDoPlano, planoUsarAlternativa, planoVazio, sincronizarAncoras, religarCriadas, type AlternativaFunding,
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
  limparCacheAlternativas();
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

// ── estado final e cache em memória ─────────────────────────────────

const eq = (pct: number, modo?: string, extra: Record<string, unknown> = {}) =>
  ({ ...novaOperacaoAlternativa('equity', `E${pct}`), pct_retorno: pct, ...(modo ? { modo_retorno: modo } : {}), ...extra }) as OperacaoFunding;
const altCom = (...ops: OperacaoFunding[]): AlternativaFunding => ({ id: 'x', nome: 'X', operacoes: ops });

test('errosDoEstadoFinal: soma 120% num modo → um erro; modo padrão é permuta_financeira', () => {
  const erros = errosDoEstadoFinal(altCom(eq(70), eq(50, 'permuta_financeira')));
  assert.equal(erros.length, 1);
  assert.match(erros[0], /Permuta financeira.*120\.00%/);
});

test('errosDoEstadoFinal: 100 em cada um de dois modos → sem erro', () => {
  assert.deepEqual(errosDoEstadoFinal(altCom(eq(100, 'permuta_financeira'), eq(100, 'resultado_final'))), []);
});

test('errosDoEstadoFinal: operação fora não conta; Financiamento desligado continua validado', () => {
  // A operação `__fora` sai da gravação (o plano a remove), então não soma.
  assert.deepEqual(errosDoEstadoFinal(altCom(eq(70), eq(50, undefined, { __fora: true }))), []);
  // O Financiamento desligado continua gravado, e o PATCH do servidor o valida inteiro.
  const fin = { tipo: 'financiamento_producao', nome: 'F', ativo: false, valor: -5 } as unknown as OperacaoFunding;
  assert.equal(errosDoEstadoFinal(altCom(fin)).length, 1);
});

test('planoUsarAlternativa: operação marcada fora é removida, e a nova marcada fora não é criada', () => {
  const salvas = [
    { id: 1, tipo: 'equity', nome: 'A', valor: 1, pct_retorno: 70 },
    { id: 2, tipo: 'financiamento_producao', nome: 'F', valor: 0, ativo: true },
  ] as any;
  const alt: any = { id: 'a', nome: 'x', operacoes: [
    { ...salvas[0], __fora: true },
    { ...salvas[1], __fora: true },
    { tipo: 'divida', nome: 'nova', valor: 10, __fora: true },
  ] };
  const plano = planoUsarAlternativa(salvas, alt);
  assert.deepEqual(plano.remover, [1]);
  assert.deepEqual(plano.atualizar, [{ id: 2, campos: { ativo: false } }]);
  assert.deepEqual(plano.criar, []);
});

test('errosDoEstadoFinal: retorno ou valor negativo e retorno acima de 100 por operação', () => {
  assert.equal(errosDoEstadoFinal(altCom(eq(-5))).length, 1);
  assert.equal(errosDoEstadoFinal(altCom(eq(10, undefined, { valor: -1 }))).length, 1);
  assert.ok(errosDoEstadoFinal(altCom(eq(101))).length >= 1);
});

test('alternativas: sem storage utilizável, gravar e ler devolve da memória', () => {
  limparCacheAlternativas();
  const lanca = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } as unknown as Storage;
  const alts = [alternativaDoSalvo(SALVAS, 'A', 'a')];
  assert.equal(gravarAlternativas(31, alts, lanca), false);
  assert.deepEqual(lerAlternativas(31, lanca), alts);
  assert.deepEqual(lerAlternativas(31, null), alts);
  assert.deepEqual(lerAlternativas(32, lanca), []);
  limparCacheAlternativas();
  assert.deepEqual(lerAlternativas(31, lanca), []);
});

test('alternativas: a memória da página vence o storage (cota cheia: setItem falha e getItem devolve o velho)', () => {
  limparCacheAlternativas();
  const st = storageFalso();
  const velha = [alternativaDoSalvo(SALVAS, 'Velha', 'v')];
  const nova = [alternativaDoSalvo(SALVAS, 'Nova', 'n')];
  assert.equal(gravarAlternativas(33, velha, st), true);
  const cheio = { getItem: (k: string) => st.getItem(k), setItem() { throw new Error('QuotaExceeded'); } } as unknown as Storage;
  assert.equal(gravarAlternativas(33, nova, cheio), false);
  assert.deepEqual(lerAlternativas(33, cheio), nova);
  assert.deepEqual(lerAlternativas(33, st), nova);
  // primeira leitura da página (memória sem a chave): lê o storage; corrompido vira []
  limparCacheAlternativas();
  assert.deepEqual(lerAlternativas(33, st), velha);
  st.setItem('viab:funding-alternativas:33', '{não é json');
  assert.deepEqual(lerAlternativas(33, st), []);
  limparCacheAlternativas();
});

// ── paridade com o servidor ─────────────────────────────────────────
// O frontend não importa de `backend/`, mas este teste carrega o módulo do
// servidor em tempo de execução: trava que `validarOperacaoComoServidor`
// aceite/recuse exatamente o que `validarCamposOperacao` aceita/recusa. O
// especificador é uma variável de propósito: um `import` estático arrastaria o
// typecheck do backend (augmentação de tipos do SDK) para o do frontend.
const CAMINHO_BACKEND_FUNDING = '../backend/rotas/funding.ts';
const CAMINHO_BACKEND_COERCAO = '../backend/rotas/coercao-numerica.ts';
async function validarCamposOperacao(op: Record<string, any>): Promise<string | null> {
  const mod = await import(CAMINHO_BACKEND_FUNDING);
  return mod.validarCamposOperacao(op);
}

const BASE_POR_TIPO: Record<string, Record<string, any>> = {
  financiamento_producao: { tipo: 'financiamento_producao', nome: 'F', ativo: true, valor: 100, taxa_anual: 12, percentual_financiavel: 50, exposicao_minima: 10, periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, aporte_meses: 3, inicio_mes: 1, custo_linha_ids: [1, 2] },
  divida: { tipo: 'divida', nome: 'D', ativo: true, valor: 100, taxa_anual: 12, periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, taxa_estruturacao_pct: 1, outros_encargos_iniciais: 0, inicio_mes: 2, aporte_meses: 1, cronograma_evento: 'obra' },
  equity: { tipo: 'equity', nome: 'E', ativo: true, valor: 100, pct_retorno: 30, modo_retorno: 'permuta_financeira', taxa_administracao_mensal: 0, inicio_mes: 1, aporte_meses: 2 },
  antecipacao_recebiveis: { tipo: 'antecipacao_recebiveis', nome: 'A', ativo: true, valor: 100, taxa_anual: 20, pct_carteira_cedida: 40, taxa_estruturacao_pct: 1, inicio_mes: 3 },
};
const CAMPOS_NUM = [
  'valor', 'inicio_mes', 'aporte_meses', 'taxa_anual', 'periodo_amortizacao_meses', 'periodo_carencia_meses', 'pct_retorno',
  'exposicao_minima', 'percentual_financiavel', 'taxa_estruturacao_pct', 'taxa_administracao_mensal', 'outros_encargos_iniciais', 'pct_carteira_cedida',
];

function casosDeParidade(): Array<[string, Record<string, any>]> {
  const casos: Array<[string, Record<string, any>]> = [];
  for (const [tipo, base] of Object.entries(BASE_POR_TIPO)) {
    casos.push([`${tipo} base`, base]);
    for (const campo of CAMPOS_NUM) {
      for (const v of [-1, 101, 'x', null, 0, 50]) casos.push([`${tipo} ${campo}=${JSON.stringify(v)}`, { ...base, [campo]: v }]);
    }
    casos.push([`${tipo} carência>=amort`, { ...base, periodo_amortizacao_meses: 12, periodo_carencia_meses: 12 }]);
    casos.push([`${tipo} carência>amort`, { ...base, periodo_amortizacao_meses: 12, periodo_carencia_meses: 20 }]);
    casos.push([`${tipo} amort 0 carência 5`, { ...base, periodo_amortizacao_meses: 0, periodo_carencia_meses: 5 }]);
    casos.push([`${tipo} aporte_meses 0`, { ...base, aporte_meses: 0 }]);
    for (const a of ['sim', false, true, null, 1]) casos.push([`${tipo} ativo=${JSON.stringify(a)}`, { ...base, ativo: a }]);
    casos.push([`${tipo} tipo inválido`, { ...base, tipo: 'xx' }]);
    casos.push([`${tipo} modo inválido`, { ...base, modo_retorno: 'xx' }]);
    casos.push([`${tipo} evento inválido`, { ...base, cronograma_evento: 'xx' }]);
    casos.push([`${tipo} evento válido`, { ...base, cronograma_evento: 'lancamento' }]);
    for (const l of [['a'], 'x', [1, '2'], [null], []]) casos.push([`${tipo} custo_linha_ids=${JSON.stringify(l)}`, { ...base, custo_linha_ids: l }]);
  }
  return casos;
}

test('paridade: validarOperacaoComoServidor aceita ⇔ validarCamposOperacao aceita', async () => {
  const casos = casosDeParidade();
  assert.ok(casos.length > 300);
  for (const [nome, op] of casos) {
    const servidor = await validarCamposOperacao(op);
    assert.equal(validarOperacaoComoServidor(op) === null, servidor === null, nome);
    assert.equal(validarOperacaoComoServidor(op), servidor, `${nome} (mensagem)`);
  }
});

// Reproduz a ordem do POST com as funções REAIS do servidor: coerção numérica,
// `tipo`/`nome` obrigatórios e `validarCamposOperacao` (sobre os dados coagidos).
// No `nome` vai além do servidor, de propósito (conservador): só espaços e mais de
// 100 caracteres (schema `obrigatorio` + `limite: 100`).
async function servidorRecusa(op: Record<string, any>): Promise<string | null> {
  const coer = await import(CAMINHO_BACKEND_COERCAO);
  const r = coer.coagirNumericosDeclarados('avancado_funding_operacoes', op);
  if ('falha' in r) return r.falha.mensagem;
  const dados = r.dados;
  if (!dados.tipo) return 'tipo é obrigatório';
  if (!dados.nome || typeof dados.nome !== 'string' || !dados.nome.trim()) return 'nome é obrigatório';
  if (dados.nome.length > 100) return 'nome longo';
  return validarCamposOperacao(dados);
}

test('paridade do POST: recusaDoPostComoServidor ⇔ coerção + tipo/nome + validarCamposOperacao', async () => {
  const INTEIROS = ['inicio_mes', 'aporte_meses', 'periodo_amortizacao_meses', 'periodo_carencia_meses', 'ordem'];
  const casos: Array<[string, Record<string, any>]> = [];
  for (const [tipo, base] of Object.entries(BASE_POR_TIPO)) {
    casos.push([`${tipo} base`, base]);
    for (const n of ['', '   ', 'x'.repeat(100), 'x'.repeat(101), undefined, null, 5]) {
      casos.push([`${tipo} nome=${JSON.stringify(n)}`, { ...base, nome: n }]);
    }
    for (const t of [undefined, '', null]) casos.push([`${tipo} tipo=${JSON.stringify(t)}`, { ...base, tipo: t }]);
    for (const campo of [...CAMPOS_NUM, 'ordem', 'estudo_id', 'fase_ancora_id']) {
      for (const v of ['abc', '', '12', ' 7 ', '1e3', '0x10', 1.5, true, NaN, Infinity, {}, [], '1.5']) {
        casos.push([`${tipo} ${campo}=${String(v)}`, { ...base, [campo]: v }]);
      }
    }
  }
  assert.ok(casos.some(([n]) => n.includes('1.5')) && INTEIROS.length === 5);
  for (const [nome, op] of casos) {
    const servidor = await servidorRecusa(op);
    const front = recusaDoPostComoServidor(op);
    assert.equal(front === null, servidor === null, `${nome}: front=${front} servidor=${servidor}`);
  }
  assert.equal(recusaDoPostComoServidor({ ...BASE_POR_TIPO.divida, nome: '' }), 'nome é obrigatório');
});

test('errosDoEstadoFinal: nome apagado, tipo ausente e número inválido são recusados antes de gravar', () => {
  const div = BASE_POR_TIPO.divida as any;
  assert.equal(errosDoEstadoFinal(altCom({ ...div, nome: '' })).length, 1);
  assert.equal(errosDoEstadoFinal(altCom({ ...div, nome: 'x'.repeat(101) })).length, 1);
  assert.equal(errosDoEstadoFinal(altCom({ ...div, tipo: '' })).length, 1);
  assert.equal(errosDoEstadoFinal(altCom({ ...div, valor: 'abc' })).length, 1);
  assert.equal(errosDoEstadoFinal(altCom({ ...div, inicio_mes: 1.5 })).length, 1);
});

test('lerAlternativas: alternativa com operação nula, não objeto ou sem tipo é descartada', () => {
  limparCacheAlternativas();
  const boa = { id: 'a', nome: 'A', operacoes: [{ tipo: 'divida', nome: 'D' }] };
  for (const [i, ops] of [[null], [1], ['x'], [[]], [{ nome: 'sem tipo' }], [{ tipo: 3 }]].entries()) {
    const st = storageFalso();
    st.setItem(`viab:funding-alternativas:${90 + i}`, JSON.stringify([{ id: 'b', nome: 'B', operacoes: ops }, boa]));
    assert.deepEqual(lerAlternativas(90 + i, st), [boa], JSON.stringify(ops));
  }
  limparCacheAlternativas();
});

test('errosDoEstadoFinal: recusa o que o servidor recusa (taxa negativa, carência >= amortização, ativo inválido)', () => {
  const div = { ...BASE_POR_TIPO.divida, taxa_anual: -3 } as unknown as OperacaoFunding;
  const erros = errosDoEstadoFinal(altCom(div));
  assert.equal(erros.length, 1);
  assert.match(erros[0], /taxa_anual não pode ser negativo/);
  assert.equal(errosDoEstadoFinal(altCom({ ...BASE_POR_TIPO.divida, periodo_carencia_meses: 30 } as unknown as OperacaoFunding)).length, 1);
  assert.equal(errosDoEstadoFinal(altCom({ ...BASE_POR_TIPO.divida, ativo: false } as unknown as OperacaoFunding)).length, 1);
  assert.deepEqual(errosDoEstadoFinal(altCom(BASE_POR_TIPO.divida as unknown as OperacaoFunding)), []);
});

test('sincronizarAncoras: operação ancorada no salvo recebe o mês de hoje; customizada e nova não mudam', () => {
  const salvas = [
    { id: 1, tipo: 'divida', nome: 'A', valor: 1, inicio_mes: 12, cronograma_evento: 'obra' },
    { id: 2, tipo: 'equity', nome: 'B', valor: 1, inicio_mes: 3, fase_ancora_id: 9, cronograma_evento: 'customizado' },
    { id: 3, tipo: 'divida', nome: 'C', valor: 1, inicio_mes: 5, cronograma_evento: 'customizado' },
  ] as any;
  const ops = [
    { ...salvas[0], inicio_mes: 4 },          // âncora andou de 4 para 12
    { ...salvas[1], inicio_mes: 0 },          // fase andou de 0 para 3
    { ...salvas[2], inicio_mes: 8 },          // customizada: o mês digitado vale
    { tipo: 'divida', nome: 'nova', valor: 1, inicio_mes: 2 },
  ] as any;
  const copia = JSON.parse(JSON.stringify(ops));
  const r = sincronizarAncoras(ops, salvas) as any[];
  assert.deepEqual(r.map((o) => o.inicio_mes), [12, 3, 8, 2]);
  assert.deepEqual(ops, copia, 'não muta a entrada');
  // Já sincronizada: devolve a mesma lista, e o plano não vê mudança de início.
  assert.equal(sincronizarAncoras(r, salvas), r);
  assert.deepEqual(planoUsarAlternativa(salvas, { id: 'a', nome: 'x', operacoes: r.slice(0, 3) }), { criar: [], atualizar: [{ id: 3, campos: { inicio_mes: 8 } }], remover: [] });
});

test('religarCriadas: depois de aplicar, a operação criada recebe o id e a alternativa volta a ser igual ao salvo', () => {
  const salvas = [
    { id: 1, tipo: 'divida', nome: '1º Dívida', valor: 10 },
    { id: 7, tipo: 'equity', nome: '1º Equity', valor: 5, pct_retorno: 20 },  // criada pelo "Usar esta"
  ] as any;
  const ops = [
    { id: 1, tipo: 'divida', nome: '1º Dívida', valor: 10 },
    { tipo: 'equity', nome: '1º Equity', valor: 5, pct_retorno: 20 },
    { tipo: 'divida', nome: 'Fora', valor: 1, __fora: true },
  ] as any;
  const r = religarCriadas(ops, salvas) as any[];
  assert.equal(r[1].id, 7);
  assert.equal(r[2].id, undefined, 'operação fora não é religada');
  assert.equal(ops[1].id, undefined, 'não muta a entrada');
  assert.equal(planoVazio(planoUsarAlternativa(salvas, { id: 'a', nome: 'x', operacoes: r })), true);
  assert.equal(religarCriadas(r, salvas), r, 'já religada: mesma lista');
  // Id já usado por outra operação da alternativa não é reaproveitado.
  const dupla = religarCriadas([{ id: 7, tipo: 'equity', nome: '1º Equity' }, { tipo: 'equity', nome: '1º Equity' }] as any, salvas) as any[];
  assert.equal(dupla[1].id, undefined);
});

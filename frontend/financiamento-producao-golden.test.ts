import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simularCapitalStack, simularCapitalStackDoEstudo, taxaMensalEquivalente,
  instrumentoDeRegistro, linhasFinanciaveisPadrao, janelaLiberacaoDeMarcos,
  indicadoresFinanciamentoProducao, fundingNoFluxo, agregarFundingPorPeriodos,
  type CenarioCapitalStack, type InstrumentoDivida,
} from './capital-stack-motor.js';
import { marcosObra } from './fluxo-shared.js';

// ─────────────────────────────────────────────────────────────────────────
// Cenário dourado do Financiamento à Produção — reprodução linha a linha da
// aba `Incorp Individual` da planilha de referência (20260730_EVI_Urbita),
// colunas BW:CH, contra a modalidade `retroativo` do motor.
//
// Este arquivo é o ORÁCULO da modalidade: os 16 golden cases do Capital
// Stack (fixtures/capital-stack-golden.test.ts) foram construídos por
// invariante fechada, porque não existia planilha real de Capital Stack.
// Aqui existe — os números abaixo são valores CALCULADOS pelo Excel, lidos
// do arquivo, não derivados de fórmula reimplementada. É a mesma relação que
// `calliandra-golden` tem com os recebíveis.
//
// Convenção temporal: a planilha indexa o mês pelo `Mês` relativo (−14 a
// +98, mês 0 = início da obra); o motor é 1-based. O mapeamento é
//
//     t = Mês + 15
//
// então Mês 0 → t=15, Mês 29 (último de obra) → t=44, Mês 30 (Chaves) →
// t=45, Mês 36 (quitação) → t=51.
//
// TOLERÂNCIA: a planilha calcula em precisão plena; o motor quantiza a 2
// casas a cada passo (contrato C7 do CLAUDE.md). Ao longo de 80 períodos com
// juros capitalizados isso acumula alguns centavos — medido: R$ 0,12 no pior
// ponto. `TOL` é 0,15; antes da primeira liberação o desvio é exatamente 0.
// ─────────────────────────────────────────────────────────────────────────

const TOL = 0.15;
const perto = (a: number, b: number, tol = TOL) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

const N = 80;
const MES = (mes: number) => mes + 15;

/** `Aux Despesas Financiáveis` (BW) em magnitude positiva — projetos e aprovações, construção e outorga. */
function custoElegivelDaPlanilha(): number[] {
  const c = new Array<number>(N + 1).fill(0);
  for (let t = 3; t <= 14; t++) c[t] = 36_571.43;        // Projetos e aprovações, pré-obra
  for (let t = 15; t <= 26; t++) c[t] = 3_491_085.94;    // Construção + outorga (12x) + projetos
  for (let t = 27; t <= 44; t++) c[t] = 3_428_571.43;    // idem, já sem a outorga parcelada
  return c;
}

/** `Fluxo de Caixa Livre` (BZ) — receitas menos despesas, sem nenhum funding. */
function fluxoLivreDaPlanilha(): number[] {
  const f = new Array<number>(N + 1).fill(0);
  for (let t = 3; t <= 14; t++) f[t] = -198_883.31;
  const obraEmDiante = [
    -3_608_121.92, -3_019_716.02, -2_915_825.73, -3_248_873.78, -3_232_682.29, -3_216_042.34,
    -3_198_916.35, -3_181_261.87, -3_163_030.62, -3_144_167.47, -3_124_608.98, -3_104_281.71,
    -3_020_585.47, -2_998_448.49, -2_975_236.55, -2_950_806.02, -2_924_982.46, -2_897_551.22,
    -2_868_243.95, -2_836_719.13, -2_802_532.77, -2_765_092.90, -2_723_585.57, -5_676_847.95,
    -2_623_135.85, -2_559_658.53, -2_481_532.19, -2_378_989.26, -2_227_610.81, -1_929_721.07,
    60_914_818.21, 8_502_235.10, 8_502_235.10, 8_502_235.10, 8_502_235.10, 8_502_235.10,
    8_502_235.10, 8_479_136.33, 8_456_037.56, 8_432_938.80, 8_429_516.76, 8_426_094.72,
    973.01, -2_449.03, -5_871.07, -9_293.11, -12_715.15, -16_137.19, -19_559.23, -22_981.27,
    -26_403.31, -29_825.35, -33_247.39, -36_669.43, -40_091.47, 37_642.44, 34_220.40,
    30_798.36, 27_376.32, 23_954.28, 20_532.24, 17_110.20, 13_688.16, 10_266.12, 6_844.08,
    3_422.04,
  ];
  obraEmDiante.forEach((v, i) => { f[15 + i] = v; });
  return f;
}

/** `Obra` (D) ou `Chaves` (E) — a janela em que o contrato admite liberação. */
function janelaDaPlanilha(): boolean[] {
  const j = new Array<boolean>(N + 1).fill(false);
  for (let t = 15; t <= 45; t++) j[t] = true;   // obra em 15..44, chaves em 45
  return j;
}

function cenarioReferencia(over: Partial<InstrumentoDivida> = {}): CenarioCapitalStack {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Fin produção',
    limiteComprometido: 0,                       // sem teto — o teto é 80% da base
    taxaMensal: taxaMensalEquivalente(0.125),    // FinancProdJurosAA
    politicaAmortizacao: 'cash_sweep',
    modalidadeLiberacao: 'retroativo',
    custoElegivelMensal: custoElegivelDaPlanilha(),
    percentualFinanciavel: 0.80,                 // FinancProdPercentFinanciado
    exposicaoMinima: 0.20,                       // FinancProdExpMinima
    janelaLiberacao: janelaDaPlanilha(),
    amortizarComCaixaDisponivel: true,           // financProdAmortizarComCaixaDisponivel
    mesChaves: 45,
    prioridadeFunding: 1, prioridadePagamento: 1,
    ...over,
  };
  return {
    nome: 'EVI Urbita — Incorp Individual', meses: N,
    fluxoLivreMensal: fluxoLivreDaPlanilha(), reservaMinima: 0, instrumentos: [fin],
  };
}

const rodar = (over: Partial<InstrumentoDivida> = {}) => {
  const r = simularCapitalStack(cenarioReferencia(over));
  return {
    lib: r.liberacaoPorInstrumento['Fin produção'],
    juros: r.jurosPorInstrumento['Fin produção'],
    amort: r.amortizacaoPorInstrumento['Fin produção'],
    saldo: r.saldoDividaPorInstrumento['Fin produção'],
    pct: r.percentualIncorridoPorInstrumento['Fin produção'],
    habil: r.liberacaoHabilitadaPorInstrumento['Fin produção'],
    caixa: r.caixaDisponivelAmortizacaoPorInstrumento['Fin produção'],
    acum: r.custoElegivelAcumuladoPorInstrumento['Fin produção'],
    libAcum: r.liberacaoAcumuladaPorInstrumento['Fin produção'],
  };
};

// ── Taxa ────────────────────────────────────────────────────────────────

test('taxa mensal é a efetiva composta, não a anual dividida por 12', () => {
  const mensal = taxaMensalEquivalente(0.125);
  assert.ok(perto(mensal, 0.00986358, 1e-8), `taxa mensal ${mensal}`);
  // 12,5%/12 = 1,0417% — errado por mais de 5 pontos-base ao mês.
  assert.ok(Math.abs(mensal - 0.125 / 12) > 5e-4);
});

// ── Base financiável ────────────────────────────────────────────────────

test('custo financiável total é a soma dos 4 grupos elegíveis (§7)', () => {
  const c = custoElegivelDaPlanilha();
  assert.ok(perto(soma(c), 104_046_174.19, 0.05), `total ${soma(c)}`);
});

// ── Ativação (§30) ──────────────────────────────────────────────────────

test('mês 4: exposição de 17,20% não atinge o gatilho — nenhuma liberação', () => {
  const r = rodar();
  assert.ok(perto(r.pct[MES(4)], 0.171984, 1e-5), `pct ${r.pct[MES(4)]}`);
  assert.equal(r.habil[MES(4)], 0);
  assert.equal(r.lib[MES(4)], 0);
  assert.equal(r.saldo[MES(4)], 0);
});

test('mês 5: exposição de 20,55% abre o gatilho e a 1ª liberação é o catch-up retroativo', () => {
  const r = rodar();
  assert.ok(perto(r.pct[MES(5)], 0.205537, 1e-5), `pct ${r.pct[MES(5)]}`);
  assert.equal(r.habil[MES(5)], 1);
  assert.ok(perto(r.acum[MES(5)], 21_385_372.81, 0.05), `acumulado ${r.acum[MES(5)]}`);
  // 80% de TODO o custo acumulado — não 80% do custo do mês (que daria R$ 2,79 MM).
  assert.ok(perto(r.lib[MES(5)], 17_108_298.25), `liberação ${r.lib[MES(5)]}`);
  assert.ok(r.lib[MES(5)] > 6 * 2_792_868.76, 'a 1ª liberação tem de ser um catch-up, não a parcela do mês');
  // §17: liberação relevante no mês, juros zero — não há saldo anterior.
  assert.equal(r.juros[MES(5)], 0);
  assert.ok(perto(r.saldo[MES(5)], 17_108_298.25), `saldo ${r.saldo[MES(5)]}`);
});

// ── Regime corrente (§31) ───────────────────────────────────────────────

test('mês 6: juros incidem só sobre o saldo anterior; liberação passa a ser 80% do custo do mês', () => {
  const r = rodar();
  assert.ok(perto(r.lib[MES(6)], 2_792_868.76), `liberação ${r.lib[MES(6)]}`);
  assert.ok(perto(r.juros[MES(6)], 168_749.08), `juros ${r.juros[MES(6)]}`);
  assert.ok(perto(r.saldo[MES(6)], 20_069_916.08), `saldo ${r.saldo[MES(6)]}`);
  // O erro que este teste existe para pegar: juros sobre saldo + liberação do
  // próprio mês daria ~R$ 196,3 mil em vez de R$ 168,7 mil.
  const taxa = taxaMensalEquivalente(0.125);
  const erradoSeIncluisseLiberacaoDoMes = (r.saldo[MES(5)] + r.lib[MES(6)]) * taxa;
  assert.ok(Math.abs(r.juros[MES(6)] - erradoSeIncluisseLiberacaoDoMes) > 25_000);
});

test('durante a obra o caixa disponível é negativo, então não há amortização antecipada', () => {
  const r = rodar();
  for (let t = MES(5); t <= MES(29); t++) {
    assert.ok(r.caixa[t] < 0, `mês ${t - 15} deveria ter caixa negativo, tem ${r.caixa[t]}`);
    assert.equal(r.amort[t], 0, `mês ${t - 15} não deveria amortizar`);
  }
});

// ── Fim da obra (§32) ───────────────────────────────────────────────────

test('mês 29: 100% do custo incorrido, pico do saldo devedor antes das chaves', () => {
  const r = rodar();
  assert.ok(perto(r.pct[MES(29)], 1, 1e-6), `pct ${r.pct[MES(29)]}`);
  assert.ok(perto(r.lib[MES(29)], 2_742_857.14), `liberação ${r.lib[MES(29)]}`);
  assert.ok(perto(r.juros[MES(29)], 909_736.78), `juros ${r.juros[MES(29)]}`);
  assert.ok(perto(r.saldo[MES(29)], 95_884_494.59), `saldo ${r.saldo[MES(29)]}`);
  assert.ok(perto(Math.max(...r.saldo), 95_884_494.59), 'o pico da dívida é o fechamento do mês 29');
  // §18: o saldo supera o principal liberado por causa dos juros capitalizados.
  assert.ok(r.saldo[MES(29)] > r.libAcum[MES(29)]);
});

// ── Entrega das chaves (§33) ────────────────────────────────────────────

test('mês 30: entram as chaves e todo o caixa disponível vai para o cash sweep', () => {
  const r = rodar();
  assert.equal(r.lib[MES(30)], 0, 'sem custo financiável novo, sem liberação');
  assert.ok(perto(r.juros[MES(30)], 945_764.44), `juros ${r.juros[MES(30)]}`);
  assert.ok(perto(r.caixa[MES(30)], 51_966_348.52), `caixa disponível ${r.caixa[MES(30)]}`);
  // O caixa não quita a dívida (caixa < dívida + juros): usa-se tudo.
  assert.ok(perto(r.amort[MES(30)], 51_966_348.52), `amortização ${r.amort[MES(30)]}`);
  assert.ok(perto(r.saldo[MES(30)], 44_863_910.50), `saldo ${r.saldo[MES(30)]}`);
});

test('mês 31: o caixa disponível volta a ser só o fluxo livre do mês (a defasagem de 1 período)', () => {
  const r = rodar();
  assert.ok(perto(r.caixa[MES(31)], 8_502_235.10), `caixa ${r.caixa[MES(31)]}`);
  assert.ok(perto(r.juros[MES(31)], 442_518.80), `juros ${r.juros[MES(31)]}`);
  assert.ok(perto(r.amort[MES(31)], 8_502_235.10), `amortização ${r.amort[MES(31)]}`);
  assert.ok(perto(r.saldo[MES(31)], 36_804_194.19), `saldo ${r.saldo[MES(31)]}`);
});

// ── Liquidação (§34) ────────────────────────────────────────────────────

test('mês 36: a amortização é limitada à dívida existente e o saldo zera', () => {
  const r = rodar();
  assert.ok(perto(r.juros[MES(36)], 37_111.45), `juros ${r.juros[MES(36)]}`);
  assert.ok(perto(r.amort[MES(36)], 3_799_583.76), `amortização ${r.amort[MES(36)]}`);
  // Não usa todo o caixa disponível — só o que a dívida exige.
  assert.ok(r.amort[MES(36)] < r.caixa[MES(36)]);
  assert.ok(perto(r.saldo[MES(36)], 0, 0.01), `saldo ${r.saldo[MES(36)]}`);
});

test('depois da quitação a dívida fica em zero: sem juros, sem amortização, sem saldo negativo', () => {
  const r = rodar();
  for (let t = MES(37); t <= N; t++) {
    assert.equal(r.juros[t], 0, `mês ${t - 15} não deveria ter juros`);
    assert.equal(r.amort[t], 0, `mês ${t - 15} não deveria amortizar`);
    assert.equal(r.saldo[t], 0, `mês ${t - 15} não deveria ter saldo`);
  }
  assert.ok(Math.min(...r.saldo) >= 0, 'saldo devedor nunca fica negativo');
});

// ── Totais e invariante (§35) ───────────────────────────────────────────

test('totais do cenário: principal, juros e amortização batem com a planilha', () => {
  const r = rodar();
  assert.ok(perto(soma(r.lib), 83_236_939.35, 0.5), `total liberado ${soma(r.lib)}`);
  assert.ok(perto(soma(r.juros), 15_040_168.42, 0.5), `total de juros ${soma(r.juros)}`);
  assert.ok(perto(soma(r.amort), 98_277_107.77, 0.5), `total amortizado ${soma(r.amort)}`);
});

test('invariante de consistência: dívida começa e termina em zero, logo Σamortizado = Σliberado + Σjuros', () => {
  const r = rodar();
  assert.ok(perto(soma(r.amort), soma(r.lib) + soma(r.juros), 0.05));
});

test('principal liberado converge para 80% da base financiável (§14)', () => {
  const r = rodar();
  const totalElegivel = soma(custoElegivelDaPlanilha());
  assert.ok(perto(soma(r.lib), 0.80 * totalElegivel, 0.5));
});

// ── Toggle de amortização antecipada (§40/§41) ──────────────────────────

test('com amortizarComCaixaDisponivel=false nada muda neste cenário — o caixa já era negativo', () => {
  const ligado = rodar();
  const desligado = rodar({ amortizarComCaixaDisponivel: false });
  assert.deepEqual(desligado.amort, ligado.amort);
  assert.deepEqual(desligado.saldo, ligado.saldo);
});

test('com caixa positivo antes das chaves, o toggle decide se há amortização antecipada', () => {
  // Fluxo livre folgado desde o início: caixa positivo durante a obra inteira.
  const base = cenarioReferencia();
  const fluxoFolgado = new Array<number>(N + 1).fill(0);
  for (let t = 1; t <= N; t++) fluxoFolgado[t] = 5_000_000;
  const comAmort = simularCapitalStack({ ...base, fluxoLivreMensal: fluxoFolgado });
  const semAmort = simularCapitalStack({
    ...base, fluxoLivreMensal: fluxoFolgado,
    instrumentos: [{ ...(base.instrumentos[0] as InstrumentoDivida), amortizarComCaixaDisponivel: false }],
  });
  const amortAntesDasChaves = (r: ReturnType<typeof simularCapitalStack>) =>
    soma(r.amortizacaoPorInstrumento['Fin produção'].slice(0, 45));

  assert.ok(amortAntesDasChaves(comAmort) > 0, 'com o toggle ligado, o caixa positivo amortiza durante a obra');
  assert.equal(amortAntesDasChaves(semAmort), 0, 'com o toggle desligado, nada é pago antes das chaves');
  // Depois das chaves a amortização passa a ser obrigatória, toggle ou não.
  assert.ok(soma(semAmort.amortizacaoPorInstrumento['Fin produção'].slice(45)) > 0);
});

// ── Casos extremos (§42) ────────────────────────────────────────────────

test('custo financiável zero: exposição 0 e nenhuma liberação', () => {
  const r = rodar({ custoElegivelMensal: new Array<number>(N + 1).fill(0) });
  assert.ok(r.pct.every((v) => v === 0));
  assert.ok(r.lib.every((v) => v === 0));
  assert.ok(r.saldo.every((v) => v === 0));
});

test('percentual financiado zero: nenhuma liberação, nenhum saldo devedor', () => {
  const r = rodar({ percentualFinanciavel: 0 });
  assert.ok(r.lib.every((v) => v === 0));
  assert.ok(r.saldo.every((v) => v === 0));
  assert.ok(r.juros.every((v) => v === 0));
});

test('taxa de juros zero: a dívida cresce só pelo principal', () => {
  const r = rodar({ taxaMensal: 0 });
  assert.ok(r.juros.every((v) => v === 0));
  assert.ok(perto(Math.max(...r.saldo), 0.80 * soma(custoElegivelDaPlanilha()), 0.5));
});

test('exposição mínima nunca atingida: o financiamento nunca é ativado', () => {
  const r = rodar({ exposicaoMinima: 1.01 });
  assert.ok(r.habil.every((v) => v === 0));
  assert.ok(r.lib.every((v) => v === 0));
});

test('fora da janela de liberação não há desembolso, mesmo com custo incorrido', () => {
  const r = rodar({ janelaLiberacao: new Array<boolean>(N + 1).fill(false) });
  assert.ok(r.lib.every((v) => v === 0));
  // A medição continua acontecendo — o gatilho abre, só a janela impede.
  assert.ok(r.pct[MES(29)] > 0.99);
});

test('caixa disponível maior que a dívida: amortiza só saldo anterior + juros, sem saldo negativo', () => {
  const base = cenarioReferencia();
  const fluxoAbundante = new Array<number>(N + 1).fill(0);
  for (let t = 1; t <= N; t++) fluxoAbundante[t] = 500_000_000;
  const r = simularCapitalStack({ ...base, fluxoLivreMensal: fluxoAbundante });
  const amort = r.amortizacaoPorInstrumento['Fin produção'];
  const saldo = r.saldoDividaPorInstrumento['Fin produção'];
  assert.ok(Math.min(...saldo) >= 0, 'saldo nunca negativo');
  assert.ok(Math.max(...amort) < 500_000_000, 'nunca amortiza o caixa inteiro, só a dívida');
});

test('teto contratual, quando existe, limita o principal abaixo do que a medição autorizaria', () => {
  const r = rodar({ limiteComprometido: 30_000_000 });
  assert.ok(perto(soma(r.lib), 30_000_000, 0.05), `total liberado ${soma(r.lib)}`);
});

// ── Não-regressão da outra modalidade ───────────────────────────────────

test('a modalidade por_necessidade continua liberando só o que falta de caixa', () => {
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Fin', limiteComprometido: 10_000, taxaMensal: 0.01,
    politicaAmortizacao: 'cash_sweep', custoElegivelMensal: [0, 1000, 1000, 1000],
    percentualFinanciavel: 0.8, prioridadeFunding: 1, prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'x', meses: 3, fluxoLivreMensal: [0, -800, -800, 2000], reservaMinima: 0, instrumentos: [fin],
  });
  // Idêntico ao Caso 3 dos 16 golden cases — a modalidade nova não pode
  // mexer no caminho de quem não a declara.
  assert.deepEqual(r.liberacaoPorInstrumento['Fin'], [0, 800, 800, 0]);
  assert.deepEqual(r.jurosPorInstrumento['Fin'], [0, 0, 8, 16.08]);
  assert.deepEqual(r.saldoDividaPorInstrumento['Fin'], [0, 800, 1608, 0]);
});

// ─────────────────────────────────────────────────────────────────────────
// Adaptadores: como um estudo real vira o cenário acima.
// ─────────────────────────────────────────────────────────────────────────

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 6, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 30, duracao_meses: 12 },
];

const CUSTOS = [
  { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista' },
  { id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física' },
  { id: 3, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira' },
  { id: 4, grupo: 'terreno', categoria: 'Registro' },
  { id: 5, grupo: 'obra', categoria: 'Construção' },
  { id: 6, grupo: 'obra', categoria: 'Outorga' },
  { id: 7, grupo: 'obra', categoria: 'Contingência' },
  { id: 8, grupo: 'diretos', categoria: 'Projetos' },
  { id: 9, grupo: 'diretos', categoria: 'Licenças e Aprovações' },
  { id: 10, grupo: 'diretos', categoria: 'Corretagem de vendas' },
  { id: 11, grupo: 'diretos', categoria: 'Marketing & Publicidade' },
  { id: 12, grupo: 'indireto', categoria: 'Gestão' },
];

test('base financiável padrão: os 4 grupos da planilha, sem permutas nem indiretos', () => {
  assert.deepEqual(linhasFinanciaveisPadrao(CUSTOS), [1, 5, 6, 8, 9]);
});

test('base financiável padrão exclui explicitamente o que o §6 lista como não financiável', () => {
  const ids = new Set(linhasFinanciaveisPadrao(CUSTOS));
  // Permuta física não gera caixa; permuta financeira é dedução de receita.
  assert.ok(!ids.has(2) && !ids.has(3));
  // Corretagem, marketing, contingência, registro e indiretos pesam no fluxo
  // mas não aumentam a base sobre a qual o banco libera.
  for (const id of [4, 7, 10, 11, 12]) assert.ok(!ids.has(id), `linha ${id} não é financiável`);
});

test('marcos da obra: entrega é o último mês de obra, e a janela cobre a obra inteira', () => {
  const m = marcosObra(CRONO)!;
  assert.deepEqual(m, { inicioObra: 6, fimObra: 29, mesEntrega: 29 });
  // 1-based: mês relativo 6 → t=7; mês relativo 29 → t=30.
  const janela = janelaLiberacaoDeMarcos(m, 40);
  assert.equal(janela[6], false);
  assert.equal(janela[7], true);
  assert.equal(janela[30], true);
  assert.equal(janela[31], false);
});

test('camada sem seleção própria de custos cai na base padrão em vez de ficar inerte', () => {
  const meses = 40;
  const linhasCusto = [
    { id: 5, mensal: new Array(meses).fill(0).map((_, i) => (i >= 6 && i <= 29 ? 100_000 : 0)) },
    { id: 10, mensal: new Array(meses).fill(50_000) },   // corretagem: NÃO financiável
  ];
  const fluxoLivre = [0, ...new Array(meses).fill(-100_000)];
  const camada = {
    id: 1, tipo: 'financiamento_producao', nome: 'Fin', status: 'ativo',
    compromisso: 0, prioridade_funding: 1, prioridade_pagamento: 1,
    config: { taxaAnual: 0.125 },   // sem custoLinhaIds, sem exposicaoMinima
  };
  const r = simularCapitalStackDoEstudo(fluxoLivre, [], [camada], linhasCusto, 0,
    { custosRaw: CUSTOS, cronograma: CRONO });
  const acum = r.custoElegivelAcumuladoPorInstrumento['Fin'];
  // Só a construção entrou na base — a corretagem ficou de fora.
  assert.ok(perto(acum[acum.length - 1], 24 * 100_000, 0.01), `base ${acum[acum.length - 1]}`);
  assert.ok(soma(r.liberacaoPorInstrumento['Fin']) > 0, 'a camada não pode ficar inerte');
});

test('o adaptador aplica os defaults da planilha quando a camada não os declara', () => {
  const camada = {
    id: 1, tipo: 'financiamento_producao', nome: 'Fin', status: 'ativo',
    compromisso: 0, prioridade_funding: 1, prioridade_pagamento: 1,
    config: { taxaAnual: 0.125 },
  };
  const inst = instrumentoDeRegistro(camada) as InstrumentoDivida;
  assert.equal(inst.modalidadeLiberacao, 'retroativo');
  assert.equal(inst.politicaAmortizacao, 'cash_sweep');
  assert.equal(inst.exposicaoMinima, 0.20);
  assert.equal(inst.percentualFinanciavel, 0.80);
  assert.equal(inst.amortizarComCaixaDisponivel, true);
});

test('um 0 gravado é escolha, não ausência — o default não o sobrescreve', () => {
  const camada = {
    id: 1, tipo: 'financiamento_producao', nome: 'Fin', status: 'ativo',
    compromisso: 0, prioridade_funding: 1, prioridade_pagamento: 1,
    config: { taxaAnual: 0.125, exposicaoMinima: 0, amortizarComCaixaDisponivel: false },
  };
  const inst = instrumentoDeRegistro(camada) as InstrumentoDivida;
  assert.equal(inst.exposicaoMinima, 0);
  assert.equal(inst.amortizarComCaixaDisponivel, false);
});

test('capital de giro NÃO herda a modalidade retroativa nem perde as políticas de amortização', () => {
  const camada = {
    id: 2, tipo: 'capital_giro', nome: 'CG', status: 'ativo',
    compromisso: 1_000_000, prioridade_funding: 2, prioridade_pagamento: 2,
    config: { taxaAnual: 0.14, politicaAmortizacao: 'price', carenciaMeses: 12, prazoMeses: 36 },
  };
  const inst = instrumentoDeRegistro(camada) as InstrumentoDivida;
  assert.equal(inst.modalidadeLiberacao, undefined);
  assert.equal(inst.politicaAmortizacao, 'price');
  assert.equal(inst.carenciaMeses, 12);
  assert.equal(inst.prazoMeses, 36);
});

// ─────────────────────────────────────────────────────────────────────────
// Indicadores (§37) e detalhamento no fluxo (§38)
// ─────────────────────────────────────────────────────────────────────────

test('indicadores de resumo reproduzem os números do cenário de referência', () => {
  const r = simularCapitalStack(cenarioReferencia());
  const ind = indicadoresFinanciamentoProducao(r, 'Fin produção')!;
  assert.ok(perto(ind.custoFinanciavelTotal, 104_046_174.19, 0.05));
  assert.ok(perto(ind.percentualFinanciado, 0.80, 1e-6));
  assert.ok(perto(ind.principalMaximoPrevisto, 83_236_939.35, 0.5));
  assert.equal(ind.primeiroMesLiberacao, MES(5));
  assert.ok(perto(ind.primeiraLiberacao, 17_108_298.25));
  assert.ok(perto(ind.picoSaldoDevedor, 95_884_494.59));
  assert.equal(ind.mesPicoSaldoDevedor, MES(29));
  assert.equal(ind.primeiroMesAmortizacao, MES(30));
  assert.equal(ind.ultimoMesComDivida, MES(35));
  assert.ok(perto(ind.totalAmortizado, ind.totalLiberado + ind.totalJuros, 0.05));
});

test('§38: o detalhamento no fluxo tem as 8 linhas e não altera o fluxo alavancado', () => {
  const r = simularCapitalStack(cenarioReferencia());
  const fluxoLivre0based = fluxoLivreDaPlanilha().slice(1);
  const camadas = [{ nome: 'Fin produção', tipo: 'financiamento_producao' }];
  const f = fundingNoFluxo(r, camadas, fluxoLivre0based, 12)!;

  assert.equal(f.financiamentoProducao.length, 1);
  const nomes = f.financiamentoProducao[0].linhas.map((l) => l.nome);
  assert.deepEqual(nomes, [
    'Despesas financiáveis', '% custos financiáveis incorridos', 'Liberação habilitada',
    'Liberação do financiamento', 'Juros do financiamento', 'Caixa disponível para amortização',
    'Amortização', 'Saldo devedor',
  ]);

  // Display-only: o fluxo alavancado é livre + entradas − saídas, e as linhas
  // do detalhamento não podem entrar nessa conta uma segunda vez.
  for (let i = 0; i < fluxoLivre0based.length; i++) {
    const esperado = fluxoLivre0based[i] + f.entradas[i] - f.saidas[i];
    assert.ok(Math.abs(f.fluxoMensal[i] - esperado) <= 0.01, `mês ${i}`);
  }
});

test('§38: na visão Anual, fluxos somam e estoques pegam o último ponto da faixa', () => {
  const r = simularCapitalStack(cenarioReferencia());
  const fluxoLivre0based = fluxoLivreDaPlanilha().slice(1);
  const camadas = [{ nome: 'Fin produção', tipo: 'financiamento_producao' }];
  const f = fundingNoFluxo(r, camadas, fluxoLivre0based, 12)!;
  const periodos = [{ inicio: 0, fim: 11 }, { inicio: 12, fim: 23 }, { inicio: 24, fim: 35 },
    { inicio: 36, fim: 47 }, { inicio: 48, fim: 59 }, { inicio: 60, fim: 79 }];
  const anual = agregarFundingPorPeriodos(f, periodos);
  const linha = (n: string) => anual.financiamentoProducao[0].linhas.find((l) => l.nome === n)!;
  const mensal = (n: string) => f.financiamentoProducao[0].linhas.find((l) => l.nome === n)!;

  // Liberação é fluxo: soma dentro da faixa.
  const libAno1 = mensal('Liberação do financiamento').mensal.slice(0, 12).reduce((s, v) => s + v, 0);
  assert.ok(perto(linha('Liberação do financiamento').mensal[0], libAno1, 0.01));
  // Saldo devedor é estoque: o valor do último mês da faixa, não a soma de 12.
  assert.ok(perto(linha('Saldo devedor').mensal[0], mensal('Saldo devedor').mensal[11], 0.01));
});

test('§38: sem liberação nenhuma o bloco não é renderizado', () => {
  const r = simularCapitalStack(cenarioReferencia({ exposicaoMinima: 1.01 }));
  const f = fundingNoFluxo(r, [{ nome: 'Fin produção', tipo: 'financiamento_producao' }],
    fluxoLivreDaPlanilha().slice(1), 12);
  assert.deepEqual(f?.financiamentoProducao ?? [], []);
});

// ─────────────────────────────────────────────────────────────────────────
// #408: na modalidade `por_necessidade`, a medição do custo elegível não
// pode ser perdida num mês em que a necessidade de caixa já era zero.
// ─────────────────────────────────────────────────────────────────────────

test('#408: custo elegível medido mesmo num mês sem necessidade de caixa (por_necessidade)', () => {
  // 3 meses, reservaMinima = 0, 100% financiável, sem teto de crédito.
  //
  // t=1: caixa fica negativo (-100) → precisa de 100 → libera 40 (o custo
  //      elegível do mês) → sobra necessidade de 60, mas não há mais custo a
  //      medir; caixa fecha em -60.
  // t=2: entrada grande de caixa (+200) cobre tudo (caixa fica positivo) →
  //      necessidade = 0 → NENHUMA liberação. É exatamente o mês em que o
  //      `break` antigo saltava a medição — custoElegivelMensal[2] = 30 não
  //      podia ser perdido só porque o banco não foi acionado.
  // t=3: caixa negativo de novo (-500) → precisa de 360. Sem custo elegível
  //      novo neste mês, mas o acumulado TEM que refletir os 30 do mês 2:
  //      alvo = 100% × (40+30+0) = 70; já liberado = 40; libera 30.
  // `por_necessidade` NÃO trata `limiteComprometido: 0` como "sem teto" — essa
  // convenção existe só na modalidade `retroativo`. Aqui 0 seria um teto real
  // de zero, então usa-se um teto folgado o bastante para não interferir.
  const fin: InstrumentoDivida = {
    tipo: 'divida', nome: 'Fin', limiteComprometido: 1_000_000,
    taxaMensal: 0, politicaAmortizacao: 'cash_sweep',
    custoElegivelMensal: [0, 40, 30, 0],
    percentualFinanciavel: 1,
    prioridadeFunding: 1, prioridadePagamento: 1,
  };
  const r = simularCapitalStack({
    nome: 'x', meses: 3, fluxoLivreMensal: [0, -100, 200, -500],
    reservaMinima: 0, instrumentos: [fin],
  });
  assert.deepEqual(r.liberacaoPorInstrumento['Fin'], [0, 40, 0, 30],
    'o custo do mês 2 não pode ser perdido — a liberação do mês 3 precisa refleti-lo');
  assert.ok(perto(soma(r.liberacaoPorInstrumento['Fin']), 70, 0.01),
    'total liberado tem que convergir para 100% da base financiável (40+30+0)');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simularFinanciamentoProducao, fundingDoEstudo, agregarFundingPorPeriodos,
  taxaMensalEquivalente, custoElegivelMensalDeLinhas, linhasFinanciaveisPadrao,
  janelaLiberacaoDeMarcos, indicadoresFinanciamentoProducao,
  type OperacaoFunding, type SerieOperacao,
} from './funding-motor.js';
import { marcosObra, type EventoCrono } from './fluxo-shared.js';

// ─────────────────────────────────────────────────────────────────────────
// Cenário dourado do Financiamento à Produção — reprodução linha a linha da
// aba `Incorp Individual` da planilha de referência (20260730_EVI_Urbita),
// colunas BW:CH, contra `simularFinanciamentoProducao` (#405, preservada na
// reescrita do Funding pela #355 — ver o cabeçalho de `funding-motor.ts`
// sobre por que `financiamento_producao` NÃO usa a matemática de calendário
// da planilha `fluxo_investidor_FORMULAS`).
//
// Este arquivo é o ORÁCULO da modalidade: os números abaixo são valores
// CALCULADOS pelo Excel, lidos do arquivo, não derivados de fórmula
// reimplementada.
//
// Convenção temporal: a planilha indexa o mês pelo `Mês` relativo (−14 a
// +98, mês 0 = início da obra); o motor é 0-based (mesmo índice de
// `fluxo-caixa-motor.ts`/`fluxo-shared.ts`). O mapeamento é
//
//     t = Mês + 14
//
// então Mês 0 → t=14, Mês 29 (último de obra) → t=43, Mês 30 (Chaves) →
// t=44, Mês 36 (quitação) → t=50.
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
const MES = (mes: number) => mes + 14;

/** `Aux Despesas Financiáveis` (BW) em magnitude positiva — projetos e aprovações, construção e outorga. */
function custoElegivelDaPlanilha(): number[] {
  const c = new Array<number>(N).fill(0);
  for (let t = 2; t <= 13; t++) c[t] = 36_571.43;        // Projetos e aprovações, pré-obra
  for (let t = 14; t <= 25; t++) c[t] = 3_491_085.94;    // Construção + outorga (12x) + projetos
  for (let t = 26; t <= 43; t++) c[t] = 3_428_571.43;    // idem, já sem a outorga parcelada
  return c;
}

/** `Fluxo de Caixa Livre` (BZ) — receitas menos despesas, sem nenhum funding. */
function fluxoLivreDaPlanilha(): number[] {
  const f = new Array<number>(N).fill(0);
  for (let t = 2; t <= 13; t++) f[t] = -198_883.31;
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
  obraEmDiante.forEach((v, i) => { f[14 + i] = v; });
  return f;
}

/** `Obra` (D) ou `Chaves` (E) — a janela em que o contrato admite liberação. */
function janelaDaPlanilha(): boolean[] {
  const j = new Array<boolean>(N).fill(false);
  for (let t = 14; t <= 44; t++) j[t] = true;   // obra em 14..43, chaves em 44
  return j;
}

function operacaoReferencia(over: Partial<OperacaoFunding> = {}): OperacaoFunding {
  return {
    tipo: 'financiamento_producao',
    nome: 'Fin produção',
    valor: 0,                       // sem teto — o teto é 80% da base
    inicio_mes: 0,                  // não usado por financiamento_producao
    taxa_anual: 12.5,               // FinancProdJurosAA
    percentual_financiavel: 80,     // FinancProdPercentFinanciado
    exposicao_minima: 20,           // FinancProdExpMinima
    amortizar_com_caixa_disponivel: true, // financProdAmortizarComCaixaDisponivel
    ...over,
  };
}

function rodar(
  over: Partial<OperacaoFunding> = {},
  opts: { custoElegivel?: number[]; janela?: boolean[] | null; mesChaves?: number | null; fluxoLivre?: number[] } = {},
) {
  const s = simularFinanciamentoProducao(
    operacaoReferencia(over),
    opts.custoElegivel ?? custoElegivelDaPlanilha(),
    opts.janela === undefined ? janelaDaPlanilha() : opts.janela,
    opts.mesChaves === undefined ? 44 : opts.mesChaves,
    opts.fluxoLivre ?? fluxoLivreDaPlanilha(),
    N,
  );
  const d = s.diagnostico!;
  return {
    s,
    lib: s.entradas, juros: s.juros, amort: s.saidas, saldo: s.saldo,
    pct: d.percentualIncorrido, habil: d.liberacaoHabilitada, caixa: d.caixaDisponivelAmortizacao,
    acum: d.custoElegivelAcumulado, libAcum: d.liberacaoAcumulada,
  };
}

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
    assert.ok(r.caixa[t] < 0, `mês ${t - 14} deveria ter caixa negativo, tem ${r.caixa[t]}`);
    assert.equal(r.amort[t], 0, `mês ${t - 14} não deveria amortizar`);
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
  for (let t = MES(37); t < N; t++) {
    assert.equal(r.juros[t], 0, `mês ${t - 14} não deveria ter juros`);
    assert.equal(r.amort[t], 0, `mês ${t - 14} não deveria amortizar`);
    assert.equal(r.saldo[t], 0, `mês ${t - 14} não deveria ter saldo`);
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
  const desligado = rodar({ amortizar_com_caixa_disponivel: false });
  assert.deepEqual(desligado.amort, ligado.amort);
  assert.deepEqual(desligado.saldo, ligado.saldo);
});

test('com caixa positivo antes das chaves, o toggle decide se há amortização antecipada', () => {
  // Fluxo livre folgado desde o início: caixa positivo durante a obra inteira.
  const fluxoFolgado = new Array<number>(N).fill(5_000_000);
  const comAmort = simularFinanciamentoProducao(
    operacaoReferencia(), custoElegivelDaPlanilha(), janelaDaPlanilha(), 44, fluxoFolgado, N);
  const semAmort = simularFinanciamentoProducao(
    operacaoReferencia({ amortizar_com_caixa_disponivel: false }),
    custoElegivelDaPlanilha(), janelaDaPlanilha(), 44, fluxoFolgado, N);
  const amortAntesDasChaves = (s: SerieOperacao) => soma(s.saidas.slice(0, 44));

  assert.ok(amortAntesDasChaves(comAmort) > 0, 'com o toggle ligado, o caixa positivo amortiza durante a obra');
  assert.equal(amortAntesDasChaves(semAmort), 0, 'com o toggle desligado, nada é pago antes das chaves');
  // Depois das chaves a amortização passa a ser obrigatória, toggle ou não.
  assert.ok(soma(semAmort.saidas.slice(44)) > 0);
});

// ── Casos extremos (§42) ────────────────────────────────────────────────

test('custo financiável zero: exposição 0 e nenhuma liberação', () => {
  const r = rodar({}, { custoElegivel: new Array<number>(N).fill(0) });
  assert.ok(r.pct.every((v) => v === 0));
  assert.ok(r.lib.every((v) => v === 0));
  assert.ok(r.saldo.every((v) => v === 0));
});

test('percentual financiado zero: nenhuma liberação, nenhum saldo devedor', () => {
  const r = rodar({ percentual_financiavel: 0 });
  assert.ok(r.lib.every((v) => v === 0));
  assert.ok(r.saldo.every((v) => v === 0));
  assert.ok(r.juros.every((v) => v === 0));
});

test('taxa de juros zero: a dívida cresce só pelo principal', () => {
  const r = rodar({ taxa_anual: 0 });
  assert.ok(r.juros.every((v) => v === 0));
  assert.ok(perto(Math.max(...r.saldo), 0.80 * soma(custoElegivelDaPlanilha()), 0.5));
});

test('exposição mínima nunca atingida: o financiamento nunca é ativado', () => {
  const r = rodar({ exposicao_minima: 101 });
  assert.ok(r.habil.every((v) => v === 0));
  assert.ok(r.lib.every((v) => v === 0));
});

test('fora da janela de liberação não há desembolso, mesmo com custo incorrido', () => {
  const r = rodar({}, { janela: new Array<boolean>(N).fill(false) });
  assert.ok(r.lib.every((v) => v === 0));
  // A medição continua acontecendo — o gatilho abre, só a janela impede.
  assert.ok(r.pct[MES(29)] > 0.99);
});

test('caixa disponível maior que a dívida: amortiza só saldo anterior + juros, sem saldo negativo', () => {
  const r = rodar({}, { fluxoLivre: new Array<number>(N).fill(500_000_000) });
  assert.ok(Math.min(...r.saldo) >= 0, 'saldo nunca negativo');
  assert.ok(Math.max(...r.amort) < 500_000_000, 'nunca amortiza o caixa inteiro, só a dívida');
});

test('teto contratual, quando existe, limita o principal abaixo do que a medição autorizaria', () => {
  const r = rodar({ valor: 30_000_000 });
  assert.ok(perto(soma(r.lib), 30_000_000, 0.05), `total liberado ${soma(r.lib)}`);
});

// ── Defaults e valores explícitos (§4.3) ────────────────────────────────

test('operação sem os campos de configuração usa os defaults da planilha (20/80/true)', () => {
  const custo = [0, 100, 100, 100, 100, 100];
  const fluxo = [0, 0, 0, 0, 0, 0];
  const semCampos: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Fin', valor: 0, inicio_mes: 0, taxa_anual: 12,
  };
  const comDefaultsExplicitos: OperacaoFunding = {
    ...semCampos, exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true,
  };
  const s1 = simularFinanciamentoProducao(semCampos, custo, null, null, fluxo, custo.length);
  const s2 = simularFinanciamentoProducao(comDefaultsExplicitos, custo, null, null, fluxo, custo.length);
  assert.deepEqual(s1.entradas, s2.entradas);
  assert.deepEqual(s1.saldo, s2.saldo);
});

test('um valor 0 gravado é escolha, não ausência — exposicao_minima:0 habilita já no 1º mês com custo', () => {
  const custo = [100, 0, 0];
  const fluxo = [0, 0, 0];
  const op: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Fin', valor: 0, inicio_mes: 0, taxa_anual: 12, exposicao_minima: 0,
  };
  const s = simularFinanciamentoProducao(op, custo, null, null, fluxo, 3);
  assert.equal(s.diagnostico!.liberacaoHabilitada[0], 1);
});

// ─────────────────────────────────────────────────────────────────────────
// Adaptadores: como um estudo real vira o cenário acima.
// ─────────────────────────────────────────────────────────────────────────

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'obra', inicio_mes: 6, duracao_meses: 24 },
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
  const janela = janelaLiberacaoDeMarcos(m, 40);
  assert.equal(janela[5], false);
  assert.equal(janela[6], true);
  assert.equal(janela[29], true);
  assert.equal(janela[30], false);
});

test('operação sem custo_linha_ids cai na base padrão em vez de ficar inerte', () => {
  const meses = 40;
  const linhasCusto = [
    { id: 5, mensal: new Array(meses).fill(0).map((_, i) => (i >= 6 && i <= 29 ? 100_000 : 0)) },
    { id: 10, mensal: new Array(meses).fill(50_000) },   // corretagem: NÃO financiável
  ];
  const fluxoLivre = new Array(meses).fill(-100_000);
  const op: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Fin', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
  };
  const calc = fundingDoEstudo([op], fluxoLivre, new Array(meses).fill(0), 0, 0, 0.10,
    { custosRaw: CUSTOS, linhasCusto, cronograma: CRONO })!;
  const acum = calc.operacoes[0].diagnostico!.custoElegivelAcumulado;
  // Só a construção entrou na base — a corretagem ficou de fora.
  assert.ok(perto(acum[acum.length - 1], 24 * 100_000, 0.01), `base ${acum[acum.length - 1]}`);
  assert.ok(soma(calc.operacoes[0].entradas) > 0, 'a operação não pode ficar inerte');
});

// ─────────────────────────────────────────────────────────────────────────
// Indicadores (§37) e detalhamento no fluxo (§38)
// ─────────────────────────────────────────────────────────────────────────

test('indicadores de resumo reproduzem os números do cenário de referência', () => {
  const s = simularFinanciamentoProducao(
    operacaoReferencia(), custoElegivelDaPlanilha(), janelaDaPlanilha(), 44, fluxoLivreDaPlanilha(), N);
  const ind = indicadoresFinanciamentoProducao(s)!;
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
  const meses = 40;
  const linhasCusto = [
    { id: 5, mensal: new Array(meses).fill(0).map((_, i) => (i >= 6 && i <= 29 ? 100_000 : 0)) },
  ];
  const fluxoLivre = new Array(meses).fill(-50_000);
  const op: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Fin produção', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
  };
  const calc = fundingDoEstudo([op], fluxoLivre, new Array(meses).fill(0), 0, 0, 0.10,
    { custosRaw: CUSTOS, linhasCusto, cronograma: CRONO })!;
  const f = calc.noFluxo;

  assert.equal(f.financiamentoProducao.length, 1);
  const nomes = f.financiamentoProducao[0].linhas.map((l) => l.nome);
  assert.deepEqual(nomes, [
    'Despesas financiáveis', '% custos financiáveis incorridos', 'Liberação habilitada',
    'Liberação do financiamento', 'Juros do financiamento', 'Caixa disponível para amortização',
    'Amortização', 'Saldo devedor',
  ]);

  // Display-only: o fluxo alavancado é livre + entradas − saídas, e as linhas
  // do detalhamento não podem entrar nessa conta uma segunda vez.
  for (let i = 0; i < meses; i++) {
    const esperado = fluxoLivre[i] + f.entradas[i] - f.saidas[i];
    assert.ok(Math.abs(f.fluxoMensal[i] - esperado) <= 0.01, `mês ${i}`);
  }
});

test('§38: na visão Anual, fluxos somam e estoques pegam o último ponto da faixa', () => {
  const meses = 40;
  const linhasCusto = [
    { id: 5, mensal: new Array(meses).fill(0).map((_, i) => (i >= 6 && i <= 29 ? 100_000 : 0)) },
  ];
  const fluxoLivre = new Array(meses).fill(-50_000);
  const op: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Fin produção', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
  };
  const calc = fundingDoEstudo([op], fluxoLivre, new Array(meses).fill(0), 0, 0, 0.10,
    { custosRaw: CUSTOS, linhasCusto, cronograma: CRONO })!;
  const f = calc.noFluxo;
  const periodos = [{ inicio: 0, fim: 11 }, { inicio: 12, fim: 23 }, { inicio: 24, fim: 35 }, { inicio: 36, fim: 39 }];
  const anual = agregarFundingPorPeriodos(f, periodos);
  const linha = (nome: string) => anual.financiamentoProducao[0].linhas.find((l) => l.nome === nome)!;
  const mensal = (nome: string) => f.financiamentoProducao[0].linhas.find((l) => l.nome === nome)!;

  // Liberação é fluxo: soma dentro da faixa.
  const libAno1 = mensal('Liberação do financiamento').mensal.slice(0, 12).reduce((s, v) => s + v, 0);
  assert.ok(perto(linha('Liberação do financiamento').mensal[0], libAno1, 0.01));
  // Saldo devedor é estoque: o valor do último mês da faixa, não a soma de 12.
  assert.ok(perto(linha('Saldo devedor').mensal[0], mensal('Saldo devedor').mensal[11], 0.01));
});

test('§38: sem liberação nenhuma o bloco não é renderizado', () => {
  const meses = 40;
  const linhasCusto = [
    { id: 5, mensal: new Array(meses).fill(0).map((_, i) => (i >= 6 && i <= 29 ? 100_000 : 0)) },
  ];
  const fluxoLivre = new Array(meses).fill(-50_000);
  const op: OperacaoFunding = {
    tipo: 'financiamento_producao', nome: 'Fin', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
    exposicao_minima: 101,
  };
  const calc = fundingDoEstudo([op], fluxoLivre, new Array(meses).fill(0), 0, 0, 0.10,
    { custosRaw: CUSTOS, linhasCusto, cronograma: CRONO })!;
  assert.deepEqual(calc.noFluxo.financiamentoProducao, []);
});

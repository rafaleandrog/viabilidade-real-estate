import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { OperacaoFunding, SerieOperacao } from './funding-motor.js';
import type { IndicadoresEstrutura, PassoEstrutura } from './funding-estrutura.js';
import { AVISO_SEM_LASTRO, dadosDoCartao, type DadosCartao, type EntradaCartao } from './funding-cartao-dados.js';
import { COR_DO_TIPO, corDoTipo, numeroDaCor, varianteDoBadge } from './funding-cores.js';
import { corCategorica } from './paleta-categorica.js';

// O que o cartão de operação do Funding mostra. Função pura: a fiação (o
// cartão chegar à tela, o clique abrir a página) é dos casos de render
// `funding-abas` e `funding-pagina-operacao`.

const DATA = 'jan/2027';
const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

function serie(tipo: string, campos: Partial<SerieOperacao> = {}, op: Partial<OperacaoFunding> = {}): SerieOperacao {
  const z = () => [0, 0, 0, 0, 0, 0];
  return {
    operacao: { id: 1, tipo, nome: 'X', valor: 0, inicio_mes: 0, ...op } as OperacaoFunding,
    entradas: z(), saidas: z(), fluxoInvestidor: z(), juros: z(), saldo: z(), tarifas: z(), ...campos,
  };
}
const est = (exposicaoMaxima: number, tirAlavancada: number | null): IndicadoresEstrutura =>
  ({ exposicaoMaxima, tirAlavancada, custoFinanceiro: 0, resultadoAposFunding: 0 });

function entrada(s: SerieOperacao | null, passo: PassoEstrutura | null, op: Partial<OperacaoFunding> = {}): EntradaCartao {
  const tipo = (op.tipo ?? s?.operacao.tipo ?? 'divida') as string;
  return {
    operacao: { id: 1, tipo, nome: 'Operação', valor: 0, inicio_mes: 0, ...(s?.operacao ?? {}), ...op } as any,
    serie: s, passo, vgvTotal: 10_000_000, dataInicio: DATA, rotuloTipo: 'Tipo',
  };
}

/** Nenhum texto do cartão tem NaN, "undefined" ou zero em milhões no lugar de "—". */
function semLixo(d: DadosCartao) {
  const textos = [
    ...d.termos.map((t) => t.valor.texto), ...d.kpis.map((k) => k.valor.texto),
    ...d.kpis.map((k) => k.antes?.texto ?? ''), ...d.leitura,
  ];
  for (const t of textos) {
    assert.ok(!/NaN|undefined|Infinity/.test(t), `texto inválido: ${t}`);
  }
  for (const k of d.kpis) assert.ok(!norm(k.valor.texto).includes('R$ 0,0 mi'), `KPI zerado em vez de "—": ${k.rotulo}`);
}

// ── Cores ──────────────────────────────────────────────────────────────────

test('cores: os quatro tipos têm N distintos entre 1 e 8, e badge e CSS saem do mesmo N', () => {
  const ns = Object.values(COR_DO_TIPO);
  assert.equal(ns.length, 4);
  assert.equal(new Set(ns).size, 4, 'dois tipos com a mesma cor');
  for (const n of ns) assert.ok(n >= 1 && n <= 8);
  for (const tipo of Object.keys(COR_DO_TIPO)) {
    const n = numeroDaCor(tipo);
    assert.equal(varianteDoBadge(tipo), `variante_${n}`);
    assert.equal(corDoTipo(tipo), corCategorica(n - 1), 'a cor CSS sai do mesmo N do badge');
  }
});

// ── Dívida ─────────────────────────────────────────────────────────────────

const DIVIDA = serie('divida', {
  entradas: [2_000_000, 0, 0, 0, 0, 0],
  saidas: [0, 0, 700_000, 700_000, 700_000, 0],
  fluxoInvestidor: [-2_000_000, 0, 700_000, 700_000, 700_000, 0],
  saldo: [2_000_000, 2_020_000, 1_400_000, 700_000, 0, 0],
}, { valor: 2_000_000, taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12 } as any);
const PASSO: PassoEstrutura = { operacao: DIVIDA.operacao, antes: est(-9_000_000, 18), depois: est(-7_000_000, 22) };

test('dívida: quatro termos, quatro KPIs, leitura e o "antes → depois" da sequência', () => {
  const d = dadosDoCartao(entrada(DIVIDA, PASSO));
  assert.deepEqual(d.termos.map((t) => t.rotulo), ['Aporte', 'Taxa', 'Prazo', 'Amortização']);
  assert.deepEqual(d.kpis.map((k) => k.rotulo), ['LTV', 'Custo efetivo', 'TIR alavancada', 'Exposição máxima']);
  assert.equal(norm(d.termos[0].valor.texto), 'R$ 2,0 mi à vista');
  assert.equal(norm(d.termos[0].valor.titulo ?? ''), 'R$ 2.000.000,00', 'o valor exato em 2 casas vai no título');
  assert.equal(d.termos[1].valor.texto, '12,00% a.a.', '% digitado em 2 casas');
  assert.equal(d.termos[2].valor.texto, '36 meses, 12 de carência');
  assert.equal(d.kpis[0].valor.texto, '20,0%', 'LTV = 2 mi ÷ 10 mi, KPI com uma casa');
  assert.equal(d.kpis[2].antes?.texto, '18,0% a.a.');
  assert.equal(d.kpis[2].valor.texto, '22,0% a.a.');
  assert.equal(norm(d.kpis[3].antes?.texto ?? ''), 'R$ 9,0 mi');
  assert.equal(norm(d.kpis[3].valor.texto), 'R$ 7,0 mi');
  assert.equal(norm(d.kpis[3].valor.titulo ?? ''), 'R$ 7.000.000,00');
  assert.ok(d.leitura.length > 0, 'sem leitura');
  assert.equal(d.corBadge, varianteDoBadge('divida'));
  semLixo(d);
});

test('dívida com aporte distribuído mostra "em N meses"', () => {
  const d = dadosDoCartao(entrada(DIVIDA, PASSO, { distribuir_aporte: true, aporte_meses: 3 } as any));
  assert.equal(norm(d.termos[0].valor.texto), 'R$ 2,0 mi em 3 meses');
});

test('leitura: o mês sai pelo rótulo de mês da tela (0-based, a partir da data de início)', () => {
  const d = dadosDoCartao(entrada(DIVIDA, PASSO));
  // entradas no índice 0 → jan/27; última saída no índice 4 → mai/27.
  assert.ok(d.leitura.some((f) => f.includes('a partir de jan/27') && f.includes('até mai/27')), d.leitura.join(' | '));
});

test('sem passo (sequência ainda não calculada): TIR alavancada e exposição "—", sem seta', () => {
  const d = dadosDoCartao(entrada(DIVIDA, null));
  assert.equal(d.kpis.length, 4);
  assert.equal(d.kpis[2].valor.texto, '—');
  assert.equal(d.kpis[2].antes, undefined);
  assert.equal(d.kpis[3].valor.texto, '—');
  semLixo(d);
});

test('"antes" ausente com "depois" presente: só o "depois", sem riscado e sem seta', () => {
  // A operação faz a TIR alavancada passar a existir (antes sem troca de sinal).
  const d = dadosDoCartao(entrada(DIVIDA, { operacao: DIVIDA.operacao, antes: est(-9_000_000, null), depois: est(-7_000_000, 22) }));
  assert.equal(d.kpis[2].valor.texto, '22,0% a.a.');
  assert.equal(d.kpis[2].antes, undefined, 'sem "—" riscado antes da seta');
  assert.ok(d.kpis[3].antes, 'a exposição tem os dois lados');
  semLixo(d);
});

test('operação de valor zero: KPIs "—", nunca zero nem NaN, e a grade continua com quatro', () => {
  const zero = serie('divida');
  const d = dadosDoCartao(entrada(zero, { operacao: zero.operacao, antes: est(-1_000_000, null), depois: est(-1_000_000, null) }));
  assert.equal(d.kpis.length, 4);
  assert.equal(d.kpis[0].valor.texto, '—', 'LTV');
  assert.equal(d.kpis[1].valor.texto, '—', 'custo efetivo');
  assert.equal(d.kpis[2].valor.texto, '—', 'TIR sem troca de sinal');
  assert.equal(d.termos[0].valor.texto, '—', 'aporte zero');
  semLixo(d);
});

test('sem série (antes do primeiro cálculo): termos do contrato, KPIs "—", sem leitura', () => {
  const d = dadosDoCartao(entrada(null, null, { tipo: 'divida', valor: 1_000_000, taxa_anual: 10 } as any));
  assert.equal(d.kpis.length, 4);
  assert.ok(d.kpis.every((k) => k.valor.texto === '—'));
  assert.deepEqual(d.leitura, []);
  semLixo(d);
});

// ── Equity ─────────────────────────────────────────────────────────────────

test('equity sem retorno: ROI −100% (há aporte) e TIR do investidor "—"', () => {
  const s = serie('equity', {
    entradas: [1_000_000, 0, 0, 0, 0, 0],
    fluxoInvestidor: [-1_000_000, 0, 0, 0, 0, 0],
  }, { valor: 1_000_000, pct_retorno: 0, modo_retorno: 'resultado_final' } as any);
  const d = dadosDoCartao(entrada(s, null));
  assert.deepEqual(d.termos.map((t) => t.rotulo), ['Aporte', 'Retorno', 'Quando recebe', 'Retorno total']);
  assert.deepEqual(d.kpis.map((k) => k.rotulo), ['ROI do investidor', 'TIR do investidor', 'TIR alavancada', 'Exposição máxima']);
  assert.equal(d.kpis[0].valor.texto, '-100,0%');
  assert.equal(d.kpis[1].valor.texto, '—');
  assert.equal(d.termos[1].valor.texto, '0,00% do resultado final');
  assert.equal(d.termos[2].valor.texto, '—', 'sem saída, sem mês de recebimento');
  assert.equal(d.termos[3].valor.texto, '—');
  semLixo(d);
});

test('equity com retorno: período de recebimento pelos meses com saída', () => {
  const s = serie('equity', {
    entradas: [1_000_000, 0, 0, 0, 0, 0],
    saidas: [0, 0, 400_000, 400_000, 400_000, 0],
    fluxoInvestidor: [-1_000_000, 0, 400_000, 400_000, 400_000, 0],
  }, { valor: 1_000_000, pct_retorno: 15 } as any);
  const d = dadosDoCartao(entrada(s, null));
  assert.equal(d.termos[1].valor.texto, '15,00% da receita líquida');
  assert.equal(d.termos[2].valor.texto, 'mar/27 a mai/27');
  assert.equal(norm(d.termos[3].valor.texto), 'R$ 1,2 mi');
  assert.equal(d.kpis[0].valor.texto, '20,0%');
});

// ── Antecipação ────────────────────────────────────────────────────────────

test('antecipação sem lastro: mantém a grade de quatro KPIs com "—" e marca o aviso', () => {
  const s = serie('antecipacao_recebiveis', {}, { pct_carteira_cedida: 50, taxa_anual: 18, inicio_mes: 3 } as any);
  const d = dadosDoCartao(entrada(s, { operacao: s.operacao, antes: est(-5_000_000, 10), depois: est(-5_000_000, 10) }));
  assert.equal(d.semLastro, true);
  assert.deepEqual(d.kpis.map((k) => k.rotulo), ['Deságio', 'Custo efetivo', 'TIR alavancada', 'Exposição máxima']);
  assert.equal(d.kpis[0].valor.texto, '—');
  assert.equal(d.kpis[1].valor.texto, '—');
  assert.deepEqual(d.termos.map((t) => t.rotulo), ['Carteira cedida', 'Taxa de desconto', 'Mês da cessão', 'Valor antecipado']);
  assert.equal(d.termos[0].valor.texto, '50,00%');
  assert.equal(d.termos[1].valor.texto, '18,00% a.a.');
  assert.equal(d.termos[2].valor.texto, 'abr/27');
  assert.equal(d.termos[3].valor.texto, '—');
  assert.ok(AVISO_SEM_LASTRO.startsWith('Nenhuma parcela a ceder'));
  semLixo(d);
});

test('antecipação com lastro: valor antecipado e deságio', () => {
  const s = serie('antecipacao_recebiveis', {
    entradas: [0, 800_000, 0, 0, 0, 0],
    saidas: [0, 0, 500_000, 500_000, 0, 0],
    fluxoInvestidor: [0, -800_000, 500_000, 500_000, 0, 0],
  }, { pct_carteira_cedida: 50, taxa_anual: 18, inicio_mes: 1 } as any);
  const d = dadosDoCartao(entrada(s, null));
  assert.equal(d.semLastro, false);
  assert.equal(norm(d.termos[3].valor.texto), 'R$ 0,8 mi');
  assert.equal(d.kpis[0].valor.texto, '20,0%', 'deságio = 200 mil ÷ 1 mi');
  semLixo(d);
});

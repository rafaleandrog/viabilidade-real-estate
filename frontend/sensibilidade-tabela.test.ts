import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularProforma, vgvBrutoDeProforma, type ProformaInput, type Proforma } from './proforma.js';
import {
  LINHAS_SENSIBILIDADE, calcularLinha, particionarInvariantes, rotuloInvariantes, ordenarPorAmplitude,
  rotuloEstresse, amplitudePct, maiorMelhorDaNatureza, type LinhaCalculada,
} from './sensibilidade-tabela.js';
import { calcularVariacao, EPSILON_PCT } from './cenario-variacao.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE, FATOR_BEAR, FATOR_BULL } from './fixtures/sensibilidade-catalogo.js';

// ─────────────────────────────────────────────────────────────────────────────
// #730 — tabela de sensibilidade com Δ% explícito, amplitude e invariantes
// recolhidas. O módulo é puro; a tela só o consome (fiação no fim).
// ─────────────────────────────────────────────────────────────────────────────

// Mesmo fixture de `tela-proforma.test.ts`: permuta financeira de 5%, a única
// variável cuja única linha monetária afetada é "Deduções sobre VGV".
const COM_PERMUTA_FINANCEIRA: ProformaInput = { ...ESTUDO_SENSIBILIDADE, permuta_financeira_residencial_pct: 5 };

function cenario(entrada: ProformaInput, variavel: 'permuta_financeira' | 'preco', fator: number) {
  const p: Proforma = calcularProforma({ ...entrada, produtos: PRODUTOS_SENSIBILIDADE, sensibilidade: { variavel, fator } });
  return { p, vgvBruto: vgvBrutoDeProforma(p) };
}

function calcularTodas(entrada: ProformaInput, variavel: 'permuta_financeira' | 'preco'): LinhaCalculada[] {
  const bear = cenario(entrada, variavel, FATOR_BEAR);
  const base = cenario(entrada, variavel, 1);
  const bull = cenario(entrada, variavel, FATOR_BULL);
  return LINHAS_SENSIBILIDADE.map((m) => calcularLinha(m, { bear: m.f(bear), base: m.f(base), bull: m.f(bull) }));
}

const monetarias = (xs: LinhaCalculada[]) => xs.filter((x) => !x.linha.badge && !x.linha.divisoria);

test('#730 critério 1: estressando permuta_financeira, só as linhas que se movem ficam visíveis e as demais entram no grupo recolhido', () => {
  const todas = calcularTodas(COM_PERMUTA_FINANCEIRA, 'permuta_financeira');
  assert.ok((todas.find((x) => x.linha.l === 'Deduções sobre VGV')!.valores.base ?? 0) > 0, 'o fixture precisa ter permuta financeira > 0');
  const { visiveis, invariantes } = particionarInvariantes(monetarias(todas));
  // A permuta financeira só entra na dedução — daí para baixo tudo se move;
  // VGV, Receita bruta e os dois custos (percentuais do VGV, que não muda) não.
  assert.deepEqual(visiveis.map((x) => x.linha.l), ['Deduções sobre VGV', 'Receita líquida', 'Receita operacional', 'Resultado']);
  assert.deepEqual(invariantes.map((x) => x.linha.l), ['VGV', 'Receita bruta', 'Custo direto total', 'Custo indireto total']);
  assert.equal(rotuloInvariantes(invariantes.length), '4 linhas não afetadas por esta variável');
  assert.equal(rotuloInvariantes(1), '1 linha não afetada por esta variável');
  // Estressando o preço, tudo se move — nenhum grupo recolhido.
  const preco = particionarInvariantes(monetarias(calcularTodas(ESTUDO_SENSIBILIDADE, 'preco')));
  assert.equal(preco.invariantes.length, 0);
  assert.equal(preco.visiveis.length, 8);
});

test('#730 critério 2: a amplitude bate com (bull − bear) ÷ base calculado à parte', () => {
  const todas = calcularTodas(ESTUDO_SENSIBILIDADE, 'preco');
  for (const x of monetarias(todas)) {
    const { bear, base, bull } = x.valores;
    const esperado = ((bull! - bear!) / Math.abs(base!)) * 100;
    assert.ok(Math.abs(x.amplitudePct! - esperado) < 1e-9, `${x.linha.l}: ${x.amplitudePct} ≠ ${esperado}`);
  }
  // A função sozinha: assinada, sobre o MÓDULO da base, nula sem denominador ou sem valor.
  assert.equal(amplitudePct({ bear: 80, base: 100, bull: 120 }), 40);
  assert.equal(amplitudePct({ bear: 120, base: -100, bull: 80 }), -40);
  assert.equal(amplitudePct({ bear: 80, base: 0, bull: 120 }), null);
  assert.equal(amplitudePct({ bear: null, base: 100, bull: 120 }), null);
});

test('#730 critério 3: despesa que sobe no Bear é PIORA (maiorMelhor invertido); receita que sobe é melhora', () => {
  assert.equal(maiorMelhorDaNatureza('despesa'), false);
  assert.equal(maiorMelhorDaNatureza('receita'), true);
  const despesa = calcularLinha({ l: 'Custo', f: () => 0, natureza: 'despesa' }, { bear: 110, base: 100, bull: 90 });
  assert.equal(despesa.deltaBear?.melhor, false, 'custo que sobe no Bear tem que ser piora');
  assert.equal(despesa.deltaBull?.melhor, true, 'custo que cai no Bull tem que ser melhora');
  assert.equal(despesa.deltaBear?.texto, '+10,0%');
  const receita = calcularLinha({ l: 'Receita', f: () => 0, natureza: 'receita' }, { bear: 90, base: 100, bull: 110 });
  assert.equal(receita.deltaBear?.melhor, false);
  assert.equal(receita.deltaBull?.melhor, true);
  // Mutação declarada: trocar o `maiorMelhor` de uma natureza inverte os quatro `melhor` acima.
  // E é a MESMA função pura das outras telas — não uma terceira formatação de variação.
  assert.deepEqual(despesa.deltaBear, calcularVariacao(110, 100, false));
});

test('#730: invariância usa a tolerância de EPSILON_PCT, e `null` continua `—` (nunca 0,0%)', () => {
  const quase = calcularLinha({ l: 'x', f: () => 0, natureza: 'receita' }, { bear: 100 - 100 * (EPSILON_PCT / 100) * 0.4, base: 100, bull: 100 + 100 * (EPSILON_PCT / 100) * 0.4 });
  assert.equal(quase.invariante, true, 'abaixo de EPSILON_PCT a linha é invariante');
  assert.equal(quase.deltaBear, null);
  const move = calcularLinha({ l: 'x', f: () => 0, natureza: 'receita' }, { bear: 99, base: 100, bull: 101 });
  assert.equal(move.invariante, false);
  // Indicador nulo nos três cenários (VGV ≤ 0): invariante, sem Δ, sem amplitude.
  const nulo = calcularLinha({ l: 'x', f: () => null, natureza: 'receita', pct: true }, { bear: null, base: null, bull: null });
  assert.equal(nulo.invariante, true);
  assert.equal(nulo.deltaBear, null);
  assert.equal(nulo.amplitudePct, null);
  // Base zerada com movimento: NÃO é invariante (os três diferem), mas não há Δ nem amplitude a publicar.
  const semBase = calcularLinha({ l: 'x', f: () => 0, natureza: 'receita' }, { bear: -5, base: 0, bull: 5 });
  assert.equal(semBase.invariante, false);
  assert.equal(semBase.amplitudePct, null);
});

test('#730: ordenar por amplitude é por MÓDULO decrescente, com a ordem do proforma como desempate e os nulos no fim', () => {
  const l = (nome: string, v: { bear: number | null; base: number | null; bull: number | null }) =>
    calcularLinha({ l: nome, f: () => 0, natureza: 'receita' }, v);
  const ordenadas = ordenarPorAmplitude([
    l('a', { bear: 95, base: 100, bull: 105 }),   // 10
    l('b', { bear: 120, base: 100, bull: 80 }),   // −40
    l('c', { bear: null, base: 100, bull: 105 }), // null
    l('d', { bear: 95, base: 100, bull: 105 }),   // 10 (empate com a)
  ]);
  assert.deepEqual(ordenadas.map((x) => x.linha.l), ['b', 'a', 'd', 'c']);
});

test('#730: o cabeçalho declara o estresse — sentido invertido para variável custo-like, base sem Δ', () => {
  assert.equal(rotuloEstresse('bear', 'Preço de venda', 10, 15, false), '📉 Bear −10% Preço de venda');
  assert.equal(rotuloEstresse('bull', 'Preço de venda', 10, 15, false), '🚀 Bull +15% Preço de venda');
  assert.equal(rotuloEstresse('bear', 'Custo de obra', 10, 15, true), '📉 Bear +10% Custo de obra');
  assert.equal(rotuloEstresse('bull', 'Custo de obra', 10, 15, true), '🚀 Bull −15% Custo de obra');
  assert.equal(rotuloEstresse('base', 'Custo de obra', 10, 15, true), '📊 Base');
});

test('#730 fiação: a aba Cenários monta a tabela pelo módulo — sete colunas, Δ% dos dois lados, amplitude e o grupo recolhido', () => {
  const tela = readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8');
  for (const s of [
    'LINHAS_SENSIBILIDADE.map((m) => calcularLinha(m, {',
    'particionarInvariantes(monetarias)',
    'rotuloInvariantes(invariantes.length)',
    '<details class="sens-invariantes">',
    "rotuloEstresse('bear', rotuloVar, varNeg, varPos, custoLike)",
    '${celulaDelta(x.deltaBear)}',
    '${celulaDelta(x.deltaBull)}',
    'fmtVariacao(x.amplitudePct)',
    'ordenarPorAmplitude(visiveis)',
    '${cabecalho(true)}',  // só a tabela monetária ordena
    '${cabecalho(false)}', // as invariantes e os indicadores têm cabeçalho, sem controle
  ]) {
    assert.ok(tela.includes(s), `tela-proforma.ts perdeu "${s}" — a tabela deixou de consumir o módulo`);
  }
  const colgroup = tela.slice(tela.indexOf('const colgroup = html`'), tela.indexOf('</colgroup>'));
  assert.equal((colgroup.match(/<col /g) ?? []).length, 7, 'o colgroup da sensibilidade tem que ter 7 colunas');
});

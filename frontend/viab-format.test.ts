import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASAS_DECIMAIS_MONETARIAS, fmtR$, fmtR$Kpi, fmtR$Milhoes, celulaInteira, fmtPct, fmtPctOuIndef, fmtPctEntrada, fmtM2, parseNumeroBR, celula, negativoContabil,
 semZeroNegativo } from './viab-format.js';

test('#281: fmtR$ é a fonte única de valores monetários com 2 casas', () => {
  assert.equal(CASAS_DECIMAIS_MONETARIAS, 2);
  assert.equal(fmtR$(10_000_000), 'R$ 10.000.000,00');
  assert.equal(fmtR$(1234.5), 'R$ 1.234,50');
  assert.equal(fmtR$(0), 'R$ 0,00');
  assert.equal(fmtR$(-2_500.789), '-R$ 2.500,79');
  assert.equal(fmtR$(1234.5, false), '1.234,50');
  assert.equal(fmtR$(-2_500.789, false), '-2.500,79');
});

// #492: a tabela de sensibilidade do Proforma (Preliminar → Resultado → Cenários)
// usava `fmtNum` com 2 casas, que declara só `maximumFractionDigits` e portanto
// entrega *até* 2 casas. Numa coluna alinhada à direita a vírgula deixava de bater
// entre as linhas. `fmtR$(v, false)` fixa min = max = 2 — é o que a tela chama hoje.
test('#492: fmtR$ sem símbolo fixa 2 casas decimais, não "até 2"', () => {
  assert.equal(fmtR$(1_500_000, false), '1.500.000,00');
  assert.equal(fmtR$(1_500_000.5, false), '1.500.000,50');
  assert.equal(fmtR$(1_500_000.55, false), '1.500.000,55');
  assert.equal(fmtR$(21_230_000, false), '21.230.000,00');
});

// #581: a exceção declarada ao C7 — card de KPI exibe R$ sem centavos. Mínimo E
// máximo em 0, pelo mesmo motivo que `fmtR$` fixa os dois (#492): só
// `maximumFractionDigits` entregaria "até 0 casas", e a coluna de cards
// desalinharia entre um valor redondo e outro com fração.
//
// ⚠️ O ARREDONDAMENTO É DE EXIBIÇÃO, e a última asserção é o que prova isso: o
// mesmo número que o card mostra como R$ 171.448.400 sai da tabela como
// R$ 171.448.399,51. Nada persistido muda, nada no motor muda — se estas duas
// deixarem de conviver, a exceção virou perda de dado.
test('#581 fmtR$Kpi: card de KPI sem casas decimais, mínimo E máximo', () => {
  assert.equal(fmtR$Kpi(171_448_400), 'R$ 171.448.400');
  assert.equal(fmtR$Kpi(1234.5), 'R$ 1.235');
  assert.equal(fmtR$Kpi(1234.4), 'R$ 1.234');
  assert.equal(fmtR$Kpi(0), 'R$ 0');
  assert.equal(fmtR$Kpi(-2_500.789), '-R$ 2.501');
});

test('#581: valor que arredonda a zero perde o sinal — "-R$ 0" não é um KPI', () => {
  // Entre -R$ 0,50 e R$ 0 o Intl arredonda a fração fora mas preserva o
  // sinal (achado do App de revisão no PR): -0.01 e -0.49 publicariam
  // "-R$ 0". O mesmo vale para -0 literal e para o positivo que arredonda
  // a zero — todos saem "R$ 0".
  assert.equal(fmtR$Kpi(-0.01), 'R$ 0');
  assert.equal(fmtR$Kpi(-0.49), 'R$ 0');
  assert.equal(fmtR$Kpi(-0), 'R$ 0');
  assert.equal(fmtR$Kpi(0.49), 'R$ 0');
  // A fronteira exata -0,50 arredonda para LONGE do zero no Intl (half away
  // from zero) — é "-R$ 1" legítimo, não zero. O critério do teste é o mesmo
  // da função: |v| < 0,5 zera; |v| >= 0,5 preserva sinal e valor (achado da
  // rodada 2 do App: Math.round(-0.5) = -0 engoliria este caso).
  assert.equal(fmtR$Kpi(-0.5), '-R$ 1');
  assert.equal(fmtR$Kpi(0.5), 'R$ 1');
  // E -0.51 é -R$ 1 de verdade — o sinal legítimo não é suprimido.
  assert.equal(fmtR$Kpi(-0.51), '-R$ 1');
});

test('#581: o card arredonda só para exibir — fmtR$ segue em 2 casas sobre o mesmo número', () => {
  const v = 171_448_399.514;
  assert.equal(fmtR$Kpi(v), 'R$ 171.448.400');
  assert.equal(fmtR$(v), 'R$ 171.448.399,51');
  assert.equal(fmtR$(v, false), '171.448.399,51');
  assert.equal(CASAS_DECIMAIS_MONETARIAS, 2);
});

test('fmtPct: valor calculado usa 1 casa decimal com vírgula', () => {
  assert.equal(fmtPct(12.34), '12,3%');
  assert.equal(fmtPct(0), '0,0%');
  assert.equal(fmtPct(-3.25), '-3,3%');
});

// #571: indicador com denominador inválido (ex.: VGV ≤ 0) — o motor devolve
// `null`, e aqui vira "—", nunca "0,0%". Mutação: apagar o `v === null ? '—'`
// e chamar `fmtPct(v)` direto derrubaria a 1ª asserção (viraria "0,0%") — e
// nem compilaria, já que `fmtPct` só aceita `number`.
test('#571 fmtPctOuIndef: null vira "—"; número segue fmtPct normalmente', () => {
  assert.equal(fmtPctOuIndef(null), '—');
  assert.equal(fmtPctOuIndef(0), '0,0%');
  assert.equal(fmtPctOuIndef(12.34), '12,3%');
  assert.equal(fmtPctOuIndef(-3.25), '-3,3%');
});

test('fmtPctEntrada: valor de entrada usa 2 casas decimais com vírgula', () => {
  assert.equal(fmtPctEntrada(6.7), '6,70%');
  assert.equal(fmtPctEntrada(15), '15,00%');
});

test('parseNumeroBR: interpreta separador de milhar "." e decimal ","', () => {
  assert.equal(parseNumeroBR('1.234.567'), 1234567);
  assert.equal(parseNumeroBR('1.234.567,89'), 1234567.89);
  assert.equal(parseNumeroBR('1234,5'), 1234.5);
  assert.equal(parseNumeroBR('0,5'), 0.5);
  assert.equal(parseNumeroBR('-2.500'), -2500);
});

test('parseNumeroBR: vazio ou inválido vira null', () => {
  assert.equal(parseNumeroBR(''), null);
  assert.equal(parseNumeroBR('   '), null);
  assert.equal(parseNumeroBR(null), null);
  assert.equal(parseNumeroBR('abc'), null);
  assert.equal(parseNumeroBR('-'), null);
});

test('fmtM2: duas casas e separador de milhar pt-BR', () => {
  assert.equal(fmtM2(1611.14), '1.611,14 m²');
  assert.equal(fmtM2(335.66), '335,66 m²');
  assert.equal(fmtM2(0), '0,00 m²');
});

test('fmtM2: ausência vira "—", nunca "0,00 m²"', () => {
  // Zero é um terreno de área zero; ausência é ausência. A tabela precisa
  // distinguir "não informado" de "informado como zero".
  assert.equal(fmtM2(null), '—');
  assert.equal(fmtM2(undefined), '—');
  assert.equal(fmtM2(NaN), '—');
});

// ── #449: célula da tela (fluxo-tabela.ts) e da exportação (exportar.ts)
// chamam a MESMA função de viab-format.ts — antes cada uma tinha a sua
// própria expressão de formatação, e divergiam em casas decimais, limiar de
// célula vazia e representação do negativo.

test('#449 celula: valor literal — 2 casas, thousand separator, célula vazia abaixo de R$ 0,005', () => {
  assert.equal(celula(1234.56, { comParenteses: false }), '1.234,56');
  assert.equal(celula(0.004, { comParenteses: false }), '');
  assert.equal(celula(0.20, { comParenteses: false }), '0,20');
  assert.equal(celula(0, { comParenteses: false }), '');
  assert.equal(celula(-0, { comParenteses: false }), '');
});

test('#449 celula: comParenteses=false usa sinal de menos; comParenteses=true usa parênteses', () => {
  assert.equal(celula(-1234.56, { comParenteses: false }), '-1.234,56');
  assert.equal(celula(-1234.56, { comParenteses: true }), '(1.234,56)');
  assert.equal(celula(-0.004, { comParenteses: false }), '');
  assert.equal(celula(-0.004, { comParenteses: true }), '');
});

test('#449 celula: custo=true força parênteses mesmo em valor POSITIVO (notação contábil), só com comParenteses=true', () => {
  assert.equal(celula(1234.56, { comParenteses: true, custo: true }), '(1.234,56)');
  assert.equal(celula(1234.56, { comParenteses: true, custo: false }), '1.234,56');
  assert.equal(celula(1234.56, { comParenteses: false, custo: true }), '1.234,56');
});

test('#449 celula: formato percentual e sinal ignoram a formatação monetária', () => {
  assert.equal(celula(0.4321, { comParenteses: true, formato: 'percentual' }), '43,2%');
  assert.equal(celula(0, { comParenteses: true, formato: 'percentual' }), '');
  assert.equal(celula(1, { comParenteses: true, formato: 'sinal' }), 'sim');
  assert.equal(celula(0, { comParenteses: true, formato: 'sinal' }), '');
});

test('#449 celula: valores grandes (1e9) não perdem casas nem separador', () => {
  assert.equal(celula(1e9, { comParenteses: false }), '1.000.000.000,00');
});

// ── #567: `negativoContabil` é o núcleo de sinal que `celula` (R$) e
// `celulaProformaM2` (`frontend/tela-proforma.ts`, R$/m²) reusam, e
// `sempreExibir` é a opção que a Proforma precisa e o Fluxo de Caixa não —
// mostrar "0,00" numa linha-total que fecha em zero, em vez de célula vazia.

test('#567 negativoContabil: custo sempre entra entre parênteses; receita/resultado só quando negativo', () => {
  assert.equal(negativoContabil(100, true), true);
  assert.equal(negativoContabil(-100, true), true);
  assert.equal(negativoContabil(0, true), true);
  assert.equal(negativoContabil(100, false), false);
  assert.equal(negativoContabil(-100, false), true);
  assert.equal(negativoContabil(0, false), false);
});

test('#567 celula: sempreExibir mostra "0,00"/"(0,00)" em vez de célula vazia abaixo de R$ 0,005', () => {
  assert.equal(celula(0, { comParenteses: true, custo: true, sempreExibir: true }), '(0,00)');
  assert.equal(celula(0, { comParenteses: true, custo: false, sempreExibir: true }), '0,00');
  assert.equal(celula(0.004, { comParenteses: true, custo: true, sempreExibir: true }), '(0,00)');
  // Sem `sempreExibir`, o limiar de R$ 0,005 do Fluxo de Caixa continua valendo.
  assert.equal(celula(0, { comParenteses: true, custo: true }), '');
});

test('#567 celula: sempreExibir NÃO muda a notação — custo sempre parênteses, receita/resultado pelo sinal real', () => {
  assert.equal(celula(-259_500_000, { comParenteses: true, custo: false, sempreExibir: true }), '(259.500.000,00)');
  assert.equal(celula(259_500_000, { comParenteses: true, custo: false, sempreExibir: true }), '259.500.000,00');
  assert.equal(celula(259_500_000, { comParenteses: true, custo: true, sempreExibir: true }), '(259.500.000,00)');
});

// ─────────────────────────────────────────────────────────────────────────────
// fmtR$Milhoes — a SEGUNDA exceção declarada ao contrato C7 (rótulo de barra da
// cascata do resultado). O inventário de call sites é travado à parte, em
// `frontend/cascata-milhoes.test.ts`; aqui só a função pura.
// ─────────────────────────────────────────────────────────────────────────────
//
// `\u00A0` é literal e deliberado: o Intl pt-BR separa símbolo e número com
// ESPAÇO NÃO SEPARÁVEL (U+00A0), e escrevê-lo escapado evita que a asserção
// dependa de um caractere invisível no fonte.

test('fmtR$Milhoes: o caso do pedido — R$ 26.540.000 vira "R$ 26,5"', () => {
  assert.equal(fmtR$Milhoes(26_540_000), 'R$\u00A026,5');
});

test('fmtR$Milhoes: uma casa decimal, mínimo E máximo', () => {
  assert.equal(fmtR$Milhoes(264_400_000), 'R$\u00A0264,4');
  assert.equal(fmtR$Milhoes(219_400_000), 'R$\u00A0219,4');
  // Valor redondo NÃO perde a casa — o mínimo é 1, como o máximo.
  assert.equal(fmtR$Milhoes(45_000_000), 'R$\u00A045,0');
  assert.equal(fmtR$Milhoes(0), 'R$\u00A00,0');
});

test('fmtR$Milhoes: abaixo de um milhão continua legível, não vira vazio', () => {
  assert.equal(fmtR$Milhoes(2_194_000), 'R$\u00A02,2');
  assert.equal(fmtR$Milhoes(450_000), 'R$\u00A00,5');
  // Item pequeno colapsa para "R$ 0,0" — é o preço da escala única, e o valor
  // exato continua no `title` da coluna.
  assert.equal(fmtR$Milhoes(40_000), 'R$\u00A00,0');
});

test('fmtR$Milhoes: zero negativo normalizado APÓS o arredondamento', () => {
  // Sem a normalização o Intl preservaria o sinal e a barra publicaria
  // "-R$ 0,0" — zero negativo não é um valor. Mesma defesa de `fmtR$Kpi`.
  assert.equal(fmtR$Milhoes(-10_000), 'R$\u00A00,0');
  assert.equal(fmtR$Milhoes(-49_999), 'R$\u00A00,0');
  assert.equal(fmtR$Milhoes(-0), 'R$\u00A00,0');
  assert.equal(fmtR$Milhoes(49_999), 'R$\u00A00,0');
  // As DUAS fronteiras exatas de R$ 50.000, simétricas (half away from zero).
  // Testar só o lado negativo deixaria passar regressão assimétrica no limiar
  // — achado da lente T4 (Kimi) na rodada 1 do PR.
  assert.equal(fmtR$Milhoes(-50_000), '-R$\u00A00,1');
  assert.equal(fmtR$Milhoes(50_000), 'R$\u00A00,1');
  assert.equal(fmtR$Milhoes(-12_300_000), '-R$\u00A012,3');
});

test('fmtR$Milhoes: entrada não finita vira zero, nunca "∞" nem "NaN" na tela', () => {
  // ⚠️ `v || 0` NÃO basta, e o título antigo deste teste mentia: o `||` engole
  // `NaN` e `undefined` mas deixa `Infinity` passar intacto, e o Intl publica
  // "R$ ∞" na barra (medido). A guarda é `Number.isFinite`.
  assert.equal(fmtR$Milhoes(NaN), 'R$\u00A00,0');
  assert.equal(fmtR$Milhoes(undefined as unknown as number), 'R$\u00A00,0');
  assert.equal(fmtR$Milhoes(Infinity), 'R$\u00A00,0');
  assert.equal(fmtR$Milhoes(-Infinity), 'R$\u00A00,0');
});

// ── #754: celulaInteira — a TERCEIRA exceção ao C7 (coluna R$ da Proforma) ──

test('#754 celulaInteira: inteiro, separador de milhar pt-BR, sem símbolo R$', () => {
  assert.equal(celulaInteira(1234.56, { comParenteses: false }), '1.235');
  assert.equal(celulaInteira(283_411_826.35, { comParenteses: true }), '283.411.826');
  assert.equal(celulaInteira(1234.49, { comParenteses: false }), '1.234');
});

test('#754 celulaInteira: sinal normalizado DEPOIS de arredondar — receita a −0,3 sai "0", nunca "(0)"', () => {
  assert.equal(celulaInteira(-0.3, { comParenteses: true, sempreExibir: true }), '0');
  assert.equal(celulaInteira(-0.5, { comParenteses: true, sempreExibir: true }), '(1)');
  assert.equal(celulaInteira(-1234.56, { comParenteses: true }), '(1.235)');
  assert.equal(celulaInteira(-1234.56, { comParenteses: false }), '-1.235');
});

test('#754 celulaInteira: custo SEMPRE entre parênteses, inclusive zero — "(0)"', () => {
  assert.equal(celulaInteira(0, { comParenteses: true, custo: true, sempreExibir: true }), '(0)');
  assert.equal(celulaInteira(10_000, { comParenteses: true, custo: true }), '(10.000)');
  assert.equal(celulaInteira(10_000, { comParenteses: false, custo: true }), '10.000');
});

test('#754 celulaInteira: célula vazia abaixo de 0,5 sem sempreExibir; "0" com sempreExibir; não finito vira 0', () => {
  assert.equal(celulaInteira(0.4, { comParenteses: true }), '');
  assert.equal(celulaInteira(0, { comParenteses: true }), '');
  assert.equal(celulaInteira(0, { comParenteses: true, sempreExibir: true }), '0');
  assert.equal(celulaInteira(NaN, { comParenteses: true, sempreExibir: true }), '0');
  assert.equal(celulaInteira(Infinity, { comParenteses: true, sempreExibir: true }), '0');
});

test('#754 celulaInteira: `celula` (Fluxo de Caixa) continua em 2 casas — a exceção não a alcança', () => {
  assert.equal(celula(1234.56, { comParenteses: false }), '1.234,56');
});

test('#754 semZeroNegativo: só o sinal sai na faixa em que o R$ publica "0"; a magnitude nunca', () => {
  assert.equal(semZeroNegativo(-0.3), 0.3);
  assert.equal(semZeroNegativo(-0.49), 0.49);
  assert.equal(semZeroNegativo(0.3), 0.3);
  assert.equal(Object.is(semZeroNegativo(-0), 0), true);
  assert.equal(semZeroNegativo(-0.5), -0.5, 'fora da faixa (R$ publica "(1)"): cru');
  assert.equal(semZeroNegativo(-1_234.56), -1_234.56);
  assert.equal(semZeroNegativo(5), 5);
  assert.equal(semZeroNegativo(NaN), 0);
});

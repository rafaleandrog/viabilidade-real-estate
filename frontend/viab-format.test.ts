import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASAS_DECIMAIS_MONETARIAS, fmtR$, fmtPct, fmtPctEntrada, fmtM2, parseNumeroBR } from './viab-format.js';

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

test('fmtPct: valor calculado usa 1 casa decimal com vírgula', () => {
  assert.equal(fmtPct(12.34), '12,3%');
  assert.equal(fmtPct(0), '0,0%');
  assert.equal(fmtPct(-3.25), '-3,3%');
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

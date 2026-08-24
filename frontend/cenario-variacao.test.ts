import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularVariacao, fmtVariacao } from './cenario-variacao.js';

test('fmtVariacao: sinal sempre explícito, 1 casa decimal com vírgula', () => {
  assert.equal(fmtVariacao(12.34), '+12,3%');
  assert.equal(fmtVariacao(-4.25), '-4,3%');
  assert.equal(fmtVariacao(0.2), '+0,2%');
});

test('maiorMelhor: subir é melhor (VPL, Resultado, TIR)', () => {
  const sobe = calcularVariacao(110, 100, true);
  assert.equal(sobe?.melhor, true);
  assert.equal(sobe?.texto, '+10,0%');

  const cai = calcularVariacao(90, 100, true);
  assert.equal(cai?.melhor, false);
  assert.equal(cai?.texto, '-10,0%');
});

test('menorMelhor: cair é melhor', () => {
  assert.equal(calcularVariacao(90, 100, false)?.melhor, true);
  assert.equal(calcularVariacao(110, 100, false)?.melhor, false);
});

test('base negativa: o percentual normaliza pelo MÓDULO da base, não pelo valor assinado', () => {
  // Este teste prova só a normalização (a divisão por Math.abs(base)) —
  // não uma convenção de indicador específico. Com maiorMelhor=true, subir
  // o valor (de -1.000 para -800) é uma "melhora" de +20% aritmética; o
  // exemplo é só para exercitar base negativa, não afirma que este é o jeito
  // certo de ler nenhum indicador do app — quem decide isso é o chamador, no
  // `maiorMelhor` que passa. #491 corrigiu a leitura de Exposição máxima
  // para magnitude (`maiorMelhor=false`, valores em módulo) — ver o teste
  // '#491' abaixo, que é o que descreve a convenção vigente dela.
  const v = calcularVariacao(-800, -1000, true);
  assert.equal(v?.melhor, true);
  assert.equal(v?.texto, '+20,0%');

  // Afundar mais: de -1.000 para -1.300 é -30% pelo mesmo cálculo.
  const w = calcularVariacao(-1300, -1000, true);
  assert.equal(w?.melhor, false);
  assert.equal(w?.texto, '-30,0%');
});

test('#353: exposição máxima por MAGNITUDE — maior é pior, menor é melhor', () => {
  // fluxo-tabela.ts (kpisFluxo) passa Math.abs() dos dois lados com
  // maiorMelhor=false: o autor quer a leitura por módulo (dinheiro em
  // risco), não pelo sinal — de -1.000 para -1.300 a exposição CRESCEU
  // (mais risco) e deve marcar como PIOR, seta para cima.
  const cresceu = calcularVariacao(Math.abs(-1300), Math.abs(-1000), false);
  assert.equal(cresceu?.melhor, false);
  assert.equal(cresceu?.texto, '+30,0%');

  // De -1.000 para -800 a exposição DIMINUIU (menos risco) — MELHOR, seta
  // para baixo.
  const diminuiu = calcularVariacao(Math.abs(-800), Math.abs(-1000), false);
  assert.equal(diminuiu?.melhor, true);
  assert.equal(diminuiu?.texto, '-20,0%');
});

test('#491: badge da tabela de cenários lê a mesma magnitude e o mesmo veredito do KPI', () => {
  // Critério de aceite 1 — o mesmo par (base -1.000.000, novo -1.200.000)
  // que fluxo-tabela.ts:279 (varKpi) e tela-cenarios.ts:568 (_badgeVar, pós
  // #491) agora calculam da mesma forma: Math.abs dos dois lados,
  // maiorMelhor=false. Piorou (mais exposição) → sinal positivo, "melhor"
  // falso — a mesma leitura nos dois lugares da tela.
  const kpiELinha = calcularVariacao(Math.abs(-1_200_000), Math.abs(-1_000_000), false);
  assert.equal(kpiELinha?.texto, '+20,0%');
  assert.equal(kpiELinha?.melhor, false);

  // Critério de aceite 2 — caso simétrico: melhorou (menos exposição) → sinal
  // negativo, "melhor" true. Sem este par, uma implementação que trocasse só
  // o SINAL do texto sem trocar a DIREÇÃO do veredito passaria no critério 1.
  const melhorou = calcularVariacao(Math.abs(-800_000), Math.abs(-1_000_000), false);
  assert.equal(melhorou?.texto, '-20,0%');
  assert.equal(melhorou?.melhor, true);
});

test('sem variação relevante devolve null (não pinta seta nem badge)', () => {
  assert.equal(calcularVariacao(100, 100, true), null);
  assert.equal(calcularVariacao(100.02, 100, true), null);
});

test('entradas inválidas devolvem null', () => {
  assert.equal(calcularVariacao(null, 100, true), null);
  assert.equal(calcularVariacao(100, null, true), null);
  assert.equal(calcularVariacao(100, 0, true), null, 'base zerada não tem denominador');
  assert.equal(calcularVariacao(Number.NaN, 100, true), null);
  assert.equal(calcularVariacao(100, Number.POSITIVE_INFINITY, true), null);
});

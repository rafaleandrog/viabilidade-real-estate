import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarMedidor, bolaFaixa, varianteFaixa } from './medidor-faixas.js';

test('configurado: 3 faixas vermelho/amarelo/verde (atingir_ou_superar)', () => {
  const c = montarMedidor(
    { regra_comparacao: 'atingir_ou_superar', medidor_min: 0, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 },
    38)!;
  assert.equal(c.min, 0);
  assert.equal(c.max, 50);
  assert.deepEqual(c.faixas.map((f) => f.ate), [20, 30, 50]);
  assert.match(c.faixas[0].cor, /cor-erro/);     // baixo = ruim
  assert.match(c.faixas[1].cor, /cor-alerta/);
  assert.match(c.faixas[2].cor, /cor-sucesso/);  // alto = bom
});

test('configurado + nao_exceder: cores invertidas (verde embaixo)', () => {
  const c = montarMedidor(
    { regra_comparacao: 'nao_exceder', medidor_min: 0, medidor_faixa1_ate: 30, medidor_faixa2_ate: 40, medidor_max: 60 },
    35)!;
  assert.match(c.faixas[0].cor, /cor-sucesso/);  // baixo = bom
  assert.match(c.faixas[1].cor, /cor-alerta/);
  assert.match(c.faixas[2].cor, /cor-erro/);     // alto = ruim
  assert.deepEqual(c.faixas.map((f) => f.ate), [30, 40, 60]);
});

test('sem configuração: fallback automático de 2 faixas a partir da meta', () => {
  const c = montarMedidor({ regra_comparacao: 'atingir_ou_superar', valor: 25 }, 38)!;
  assert.equal(c.min, 0);
  assert.equal(c.faixas.length, 2);
  assert.equal(c.faixas[0].ate, 25);            // corte na meta
  assert.match(c.faixas[0].cor, /cor-erro/);
  assert.match(c.faixas[1].cor, /cor-sucesso/);
  assert.equal(c.max, Math.max(50, 38 * 1.2, 35)); // máx(meta×2, val×1,2, meta+10)
});

test('config incompleta/inválida cai no fallback', () => {
  // cortes fora de ordem
  const c1 = montarMedidor(
    { regra_comparacao: 'atingir_ou_superar', valor: 25, medidor_min: 0, medidor_faixa1_ate: 40, medidor_faixa2_ate: 30, medidor_max: 50 },
    38)!;
  assert.equal(c1.faixas.length, 2);
  // só alguns campos preenchidos
  const c2 = montarMedidor({ regra_comparacao: 'atingir_ou_superar', valor: 25, medidor_max: 50 }, 38)!;
  assert.equal(c2.faixas.length, 2);
});

test('sem meta e sem config: null (não desenha medidor)', () => {
  assert.equal(montarMedidor({ regra_comparacao: 'atingir_ou_superar', valor: 0 }, 0), null);
});

test('bolaFaixa: bola da faixa em que o valor cai (config 3 faixas)', () => {
  const b = { regra_comparacao: 'atingir_ou_superar', medidor_min: 0, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 };
  assert.equal(bolaFaixa(b, 10), '🔴');  // ≤20 → faixa baixa (ruim)
  assert.equal(bolaFaixa(b, 25), '🟡');  // 20–30 → alerta
  assert.equal(bolaFaixa(b, 40), '🟢');  // 30–50 → boa
  assert.equal(bolaFaixa(b, 999), '🟢'); // acima do máx → última faixa
});

test('bolaFaixa: nao_exceder inverte (verde embaixo)', () => {
  const b = { regra_comparacao: 'nao_exceder', medidor_min: 0, medidor_faixa1_ate: 30, medidor_faixa2_ate: 40, medidor_max: 60 };
  assert.equal(bolaFaixa(b, 10), '🟢');
  assert.equal(bolaFaixa(b, 55), '🔴');
});

test('bolaFaixa: sem medidor válido → vazio', () => {
  assert.equal(bolaFaixa({ regra_comparacao: 'atingir_ou_superar', valor: 0 }, 0), '');
});

test('varianteFaixa: variante (sucesso/alerta/erro) da faixa, sem emoji', () => {
  const b = { regra_comparacao: 'atingir_ou_superar', medidor_min: 0, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 };
  assert.equal(varianteFaixa(b, 10), 'erro');
  assert.equal(varianteFaixa(b, 25), 'alerta');
  assert.equal(varianteFaixa(b, 40), 'sucesso');
  assert.equal(varianteFaixa({ regra_comparacao: 'atingir_ou_superar', valor: 0 }, 0), '');
});

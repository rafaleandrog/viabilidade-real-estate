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

// #451: estado "fora da escala" — o valor real de custo_obras_vgv medido em
// Pinguim (70,32%) contra o medidor calibrado 20/25/30/40. Número fechado do
// critério de aceite da issue.
test('#451: fora da escala — valor acima do máximo do ramo configurado', () => {
  const c = montarMedidor(
    { medidor_min: 20, medidor_faixa1_ate: 25, medidor_faixa2_ate: 30, medidor_max: 40, regra_comparacao: 'nao_exceder' },
    70.32,
  )!;
  assert.equal(c.foraEscala, true);
});

// Caso negativo — sem ele, um sinal que dispara sempre passaria pelo teste
// acima sem provar nada.
test('#451: NÃO fora da escala — valor dentro de [min, max]', () => {
  const c = montarMedidor(
    { medidor_min: 20, medidor_faixa1_ate: 25, medidor_faixa2_ate: 30, medidor_max: 40, regra_comparacao: 'nao_exceder' },
    30,
  )!;
  assert.equal(c.foraEscala, false);
});

// A outra ponta: abaixo do mínimo também é "fora da escala" — não só acima
// do máximo. margem_liquida real (14,67%) contra o medidor 15/25/35/45.
test('#451: fora da escala — valor abaixo do mínimo do ramo configurado', () => {
  const c = montarMedidor(
    { medidor_min: 15, medidor_faixa1_ate: 25, medidor_faixa2_ate: 35, medidor_max: 45, regra_comparacao: 'atingir_ou_superar' },
    14.67,
  )!;
  assert.equal(c.foraEscala, true);
});

// Nos limites exatos (min e max) o valor ainda está DENTRO da escala.
test('#451: nos limites exatos (min e max) não é fora da escala', () => {
  const base = { medidor_min: 20, medidor_faixa1_ate: 25, medidor_faixa2_ate: 30, medidor_max: 40, regra_comparacao: 'nao_exceder' };
  assert.equal(montarMedidor(base, 20)!.foraEscala, false);
  assert.equal(montarMedidor(base, 40)!.foraEscala, false);
});

// O fallback automático (sem os 4 valores configurados) nunca estoura — o
// `max` se adapta ao valor recebido. Os 9 testes acima deste bloco (ramo
// fallback) seguem verdes SEM edição; este só acrescenta a asserção que
// faltava sobre `foraEscala` num caso de fallback já existente na suíte.
test('#451: fallback automático nunca sinaliza fora da escala, mesmo com valor alto', () => {
  const c = montarMedidor({ regra_comparacao: 'atingir_ou_superar', valor: 25 }, 1000)!;
  assert.equal(c.foraEscala, false);
});

// #571: `val: null` — indicador com denominador inválido (ex.: VGV ≤ 0). Sem
// valor definido não há como pousar honestamente o ponteiro numa escala:
// `null` é o mesmo desfecho de "sem medidor válido" (linha 48/66/75 acima),
// mesmo com benchmark configurado — é o VALOR que falta, não a configuração.
// Mutação: apagar o `if (val === null) return null` de `montarMedidor` (ou o
// de `corFaixa`) faz alguma das quatro asserções abaixo lançar/falhar — a
// que usa `medidor_min: 0` (`!Number.isFinite(NaN)` derrubaria `configurado`,
// mas as outras três dependem só do `null` explícito para não estourar em
// `val <= f.ate` com `val` `null`.
test('#571: val null → sem medidor, sem bola, sem variante — mesmo com benchmark configurado', () => {
  const bConfigurado = { regra_comparacao: 'atingir_ou_superar', medidor_min: 0, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 };
  assert.equal(montarMedidor(bConfigurado, null), null);
  assert.equal(bolaFaixa(bConfigurado, null), '');
  assert.equal(varianteFaixa(bConfigurado, null), '');
});

test('#571: val null no fallback automático também não desenha nada', () => {
  assert.equal(montarMedidor({ regra_comparacao: 'atingir_ou_superar', valor: 25 }, null), null);
});

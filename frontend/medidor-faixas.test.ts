import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarMedidor, varianteFaixa } from './medidor-faixas.js';

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

test('varianteFaixa: faixa em que o valor cai (config 3 faixas)', () => {
  const b = { regra_comparacao: 'atingir_ou_superar', medidor_min: 0, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 };
  assert.equal(varianteFaixa(b, 10), 'erro');     // ≤20 → faixa baixa (ruim)
  assert.equal(varianteFaixa(b, 25), 'alerta');   // 20–30 → alerta
  assert.equal(varianteFaixa(b, 40), 'sucesso');  // 30–50 → boa
  assert.equal(varianteFaixa(b, 999), 'sucesso'); // acima do máx → última faixa
});

test('varianteFaixa: nao_exceder inverte (verde embaixo)', () => {
  const b = { regra_comparacao: 'nao_exceder', medidor_min: 0, medidor_faixa1_ate: 30, medidor_faixa2_ate: 40, medidor_max: 60 };
  assert.equal(varianteFaixa(b, 10), 'sucesso');
  assert.equal(varianteFaixa(b, 55), 'erro');
});

test('varianteFaixa: sem medidor válido → vazio', () => {
  assert.equal(varianteFaixa({ regra_comparacao: 'atingir_ou_superar', valor: 0 }, 0), '');
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
  assert.equal(varianteFaixa(bConfigurado, null), '');
});

test('#571: val null no fallback automático também não desenha nada', () => {
  assert.equal(montarMedidor({ regra_comparacao: 'atingir_ou_superar', valor: 25 }, null), null);
});

// #899: valor IGUAL à meta/corte conta como atingido, nas duas regras, sem
// arredondar antes de comparar.
test('#899 fallback atingir_ou_superar: igual à meta é verde; logo abaixo é vermelho', () => {
  const b = { regra_comparacao: 'atingir_ou_superar', valor: 25 };
  assert.equal(varianteFaixa(b, 25), 'sucesso');
  assert.equal(varianteFaixa(b, 25.000001), 'sucesso');
  assert.equal(varianteFaixa(b, 24.999999), 'erro');
  // 24,96 arredondaria para 25,0 — a comparação é de plena precisão.
  assert.equal(varianteFaixa(b, 24.96), 'erro');
});

test('#899 fallback nao_exceder: igual ao teto é verde; logo acima é vermelho', () => {
  const b = { regra_comparacao: 'nao_exceder', valor: 35 };
  assert.equal(varianteFaixa(b, 35), 'sucesso');
  assert.equal(varianteFaixa(b, 34.999999), 'sucesso');
  assert.equal(varianteFaixa(b, 35.000001), 'erro');
  assert.equal(varianteFaixa(b, 35.04), 'erro');
});

test('#899 configurado: valor no corte vai para a faixa melhor nas duas regras', () => {
  const cfg = { medidor_min: 0, medidor_faixa1_ate: 20, medidor_faixa2_ate: 30, medidor_max: 50 };
  const a = { regra_comparacao: 'atingir_ou_superar', valor: 30, ...cfg };
  assert.equal(varianteFaixa(a, 20), 'alerta');
  assert.equal(varianteFaixa(a, 19.999999), 'erro');
  assert.equal(varianteFaixa(a, 30), 'sucesso');
  assert.equal(varianteFaixa(a, 29.999999), 'alerta');
  const n = { regra_comparacao: 'nao_exceder', valor: 30, ...cfg };
  assert.equal(varianteFaixa(n, 20), 'sucesso');
  assert.equal(varianteFaixa(n, 20.000001), 'alerta');
  assert.equal(varianteFaixa(n, 30), 'alerta');
  assert.equal(varianteFaixa(n, 30.000001), 'erro');
});

// Fiação (classe 1): as telas que colorem KPI/medidor por benchmark chamam as
// funções puras; apagar a chamada na tela deixa a pura verde, e aqui vermelho.
test('#899 fiação: telas usam varianteFaixa e o cálculo usa faixaDoValor', async () => {
  const { readFileSync } = await import('node:fs');
  const le = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.match(le('frontend/tela-proforma.ts'), /varianteFaixa\(co, p\.custoObrasVgvPct\)/);
  assert.match(le('frontend/tela-proforma.ts'), /varianteFaixa\(this\._bm\(m\.bmCampo\), valNum\)/);
  assert.match(le('frontend/tela-premissas.ts'), /varianteFaixa\(ml, p\.margemLiquidaPct\)/);
  assert.match(le('frontend/medidor-faixas.ts'), /return faixaDoValor\(b, cfg\.faixas, val\)\.cor/);
});

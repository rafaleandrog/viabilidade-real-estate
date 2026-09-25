import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  consumoDoColchao, ehBaixaAlavanca, textoConsumo, textoPontoDeEquilibrio,
  LIMIAR_BAIXA_ALAVANCA_PCT, TEXTO_BAIXA_ALAVANCA, TEXTO_CIRCULAR,
} from './consumo-colchao.js';
import { margemDeSeguranca } from './margem-seguranca.js';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from './fixtures/sensibilidade-catalogo.js';

// ─────────────────────────────────────────────────────────────────────────────
// #734 — consumo do colchão, alerta de cenário inviável, baixa alavanca
// ─────────────────────────────────────────────────────────────────────────────

test('#734 critério 1: folga −40%, estresse −10% ⇒ consumo 25% (um caso aritmético, à mão)', () => {
  const c = consumoDoColchao(-10, -40)!;
  assert.ok(c);
  assert.equal(c.consumoPct, 25);
  assert.equal(c.inviavel, false);
  assert.equal(c.baseDeficitaria, false);
  // Os dois são percentuais ASSINADOS sobre a mesma premissa e do MESMO lado
  // (custo-like: o Bear sobe o custo, +10; o resultado zera com o custo +40).
  assert.equal(consumoDoColchao(10, 40)!.consumoPct, 25);
  assert.match(textoConsumo(c, -10), /consome 25,0% do colchão/);
});

test('#734: sinais OPOSTOS são base deficitária — a raiz está do lado favorável e não há colchão a consumir', () => {
  // Custo-like: o Bear SOBE o custo (+10), mas o resultado só zera se o custo
  // CAIR 40 — a base já é negativa. Antes, o módulo publicava "25% de consumo".
  const c = consumoDoColchao(10, -40)!;
  assert.ok(c);
  assert.equal(c.consumoPct, null);
  assert.equal(c.baseDeficitaria, true);
  assert.equal(c.inviavel, true);
  assert.match(textoConsumo(c, 10), /já é negativo na base/);
  assert.match(textoConsumo(c, 10), /precisaria melhorar -40,0%/);
  // Preço: Bear −10, folga +15 (o preço precisaria SUBIR 15%).
  assert.equal(consumoDoColchao(-10, 15)!.baseDeficitaria, true);
  // E medido no MOTOR: um estudo deficitário (obra a 7.000 R$/m² no fixture da
  // sub-aba) tem folga de preço POSITIVA — o Bear de −10% cai no estado.
  const deficit: ProformaInput = { ...ESTUDO_SENSIBILIDADE, custo_construcao_m2: 7_000, produtos: PRODUTOS_SENSIBILIDADE };
  assert.ok(calcularProforma(deficit).resultado < 0, 'o fixture tem que ser deficitário');
  const m = margemDeSeguranca(deficit, 'preco', 20);
  assert.ok(m.folgaPct !== null && m.folgaPct > 0, `folga do preço deveria ser positiva (${m.folgaPct})`);
  assert.equal(consumoDoColchao(-10, m.folgaPct)!.baseDeficitaria, true);
  assert.match(textoPontoDeEquilibrio(m, 20, false), /precisa melhorar \+[\d.]+,\d% para o resultado zerar \(já é negativo na base\)/);
});

test('#734 critério 2: estresse maior que a folga ⇒ consumo > 100% E o texto do alerta aparece, em palavras', () => {
  const c = consumoDoColchao(-15, -12)!;
  assert.ok((c.consumoPct as number) > 100);
  assert.equal(c.inviavel, true);
  const texto = textoConsumo(c, -15);
  assert.match(texto, /já é inviável/);
  assert.match(texto, /125,0%/);
});

test('#734 critério 3: folgaPct === null ⇒ nenhum consumo publicado, nenhuma divisão (sem Infinity, sem NaN)', () => {
  assert.equal(consumoDoColchao(-10, null), null);
  assert.equal(consumoDoColchao(-10, 0), null);
  assert.equal(consumoDoColchao(NaN, -40), null);
  // Estresse zero: consumo zero, nunca "base deficitária".
  assert.deepEqual(consumoDoColchao(0, -40), { consumoPct: 0, inviavel: false, baseDeficitaria: false, folgaPct: -40 });
  const texto = textoConsumo(null, -10);
  assert.match(texto, /Não há colchão a consumir/);
  assert.doesNotMatch(texto, /Infinity|NaN/);
});

test('#734 critério 4: amplitude TOTAL abaixo do limiar ⇒ baixa alavanca; acima, não; null não é baixa alavanca', () => {
  assert.equal(LIMIAR_BAIXA_ALAVANCA_PCT, 2);
  // O argumento é ±X (metade): total 1,8% < 2 ⇒ baixa; total 2% não; total 3% não.
  assert.equal(ehBaixaAlavanca(0.9), true);
  assert.equal(ehBaixaAlavanca(-0.9), true);
  assert.equal(ehBaixaAlavanca(1), false);
  assert.equal(ehBaixaAlavanca(1.5), false);
  assert.equal(ehBaixaAlavanca(25), false);
  assert.equal(ehBaixaAlavanca(null), false);
  // Mutação declarada: apagar a comparação com o limiar — "sempre false"
  // derruba a primeira asserção; "sempre true" derruba a de `ehBaixaAlavanca(1)`.
  assert.match(TEXTO_BAIXA_ALAVANCA, /baixa alavanca/);
  assert.match(TEXTO_CIRCULAR, /circular/);
});

test('#734: o ponto de equilíbrio responde as duas perguntas — até zerar e até a meta — em todos os estados', () => {
  const comRaiz = { variavel: 'preco' as const, fatorEquilibrio: 0.6, fatorAlvo: 0.85, folgaPct: -40 };
  assert.equal(textoPontoDeEquilibrio(comRaiz, 20, false), 'Ponto de equilíbrio: pode errar -40,0% até o resultado zerar; -15,0% até a margem-alvo de 20,0%.');
  // Custo-like com folga positiva: pode subir. Preço com folga positiva: precisa melhorar.
  assert.match(textoPontoDeEquilibrio({ ...comRaiz, folgaPct: 40 }, 20, true), /pode errar \+40,0%/);
  assert.match(textoPontoDeEquilibrio({ ...comRaiz, folgaPct: 40 }, 20, false), /precisa melhorar \+40,0%/);
  const semprePositivo = { variavel: 'preco' as const, fatorEquilibrio: null, resultadoSemprePositivo: true, fatorAlvo: null, alvoSempreAtingido: true, folgaPct: null };
  assert.match(textoPontoDeEquilibrio(semprePositivo, 20, false), /positivo em toda a faixa de estresse; já atinge a margem-alvo/);
  const nuncaLucra = { variavel: 'preco' as const, fatorEquilibrio: null, resultadoSemprePositivo: false, fatorAlvo: null, alvoSempreAtingido: false, folgaPct: null };
  assert.match(textoPontoDeEquilibrio(nuncaLucra, 20, false), /não zera em nenhum ponto da faixa de estresse; não atinge a margem-alvo/);
});

test('#734 fiação: a aba Cenários publica o bloco entre o tornado e a tabela, para a variável selecionada', () => {
  const tela = readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8');
  for (const s of [
    'consumoDoColchao(',
    'ehBaixaAlavanca(',
    'textoConsumo(',
    'textoPontoDeEquilibrio(',
    'TEXTO_BAIXA_ALAVANCA',
    'TEXTO_CIRCULAR',
    'class="colchao',
  ]) {
    assert.ok(tela.includes(s), `tela-proforma.ts perdeu "${s}" — o bloco de consumo do colchão deixou de ser ligado`);
  }
});

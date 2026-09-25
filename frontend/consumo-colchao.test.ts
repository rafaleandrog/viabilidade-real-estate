import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  consumoDoColchao, ehBaixaAlavanca, textoConsumo, textoPontoDeEquilibrio,
  LIMIAR_BAIXA_ALAVANCA_PCT, TEXTO_BAIXA_ALAVANCA, TEXTO_CIRCULAR,
} from './consumo-colchao.js';

// ─────────────────────────────────────────────────────────────────────────────
// #734 — consumo do colchão, alerta de cenário inviável, baixa alavanca
// ─────────────────────────────────────────────────────────────────────────────

test('#734 critério 1: folga −40%, estresse −10% ⇒ consumo 25% (um caso aritmético, à mão)', () => {
  const c = consumoDoColchao(-10, -40)!;
  assert.ok(c);
  assert.equal(c.consumoPct, 25);
  assert.equal(c.inviavel, false);
  // Os dois são percentuais ASSINADOS sobre a mesma premissa: a divisão é em
  // módulo — o sinal de um não muda a conta (custo-like: estresse +10, folga +40).
  assert.equal(consumoDoColchao(10, 40)!.consumoPct, 25);
  assert.equal(consumoDoColchao(10, -40)!.consumoPct, 25);
  assert.match(textoConsumo(c, -10), /consome 25,0% do colchão/);
});

test('#734 critério 2: estresse maior que a folga ⇒ consumo > 100% E o texto do alerta aparece, em palavras', () => {
  const c = consumoDoColchao(-15, -12)!;
  assert.ok(c.consumoPct > 100);
  assert.equal(c.inviavel, true);
  const texto = textoConsumo(c, -15);
  assert.match(texto, /já é inviável/);
  assert.match(texto, /125,0%/);
});

test('#734 critério 3: folgaPct === null ⇒ nenhum consumo publicado, nenhuma divisão (sem Infinity, sem NaN)', () => {
  assert.equal(consumoDoColchao(-10, null), null);
  assert.equal(consumoDoColchao(-10, 0), null);
  assert.equal(consumoDoColchao(NaN, -40), null);
  const texto = textoConsumo(null, -10);
  assert.match(texto, /Não há colchão a consumir/);
  assert.doesNotMatch(texto, /Infinity|NaN/);
});

test('#734 critério 4: amplitude abaixo do limiar ⇒ baixa alavanca; acima, não; null não é baixa alavanca', () => {
  assert.equal(LIMIAR_BAIXA_ALAVANCA_PCT, 2);
  assert.equal(ehBaixaAlavanca(1.9), true);
  assert.equal(ehBaixaAlavanca(-1.9), true);
  assert.equal(ehBaixaAlavanca(2), false);
  assert.equal(ehBaixaAlavanca(25), false);
  assert.equal(ehBaixaAlavanca(null), false);
  // Mutação declarada: apagar a comparação com o limiar (devolver sempre
  // false, ou sempre true) derruba uma das duas primeiras asserções.
  assert.match(TEXTO_BAIXA_ALAVANCA, /baixa alavanca/);
  assert.match(TEXTO_CIRCULAR, /circular/);
});

test('#734: o ponto de equilíbrio responde as duas perguntas — até zerar e até a meta — em todos os estados', () => {
  const comRaiz = { variavel: 'preco' as const, fatorEquilibrio: 0.6, fatorAlvo: 0.85, folgaPct: -40 };
  assert.equal(textoPontoDeEquilibrio(comRaiz, 20), 'Ponto de equilíbrio: pode errar -40,0% até o resultado zerar; -15,0% até a margem-alvo de 20,0%.');
  const semprePositivo = { variavel: 'preco' as const, fatorEquilibrio: null, resultadoSemprePositivo: true, fatorAlvo: null, alvoSempreAtingido: true, folgaPct: null };
  assert.match(textoPontoDeEquilibrio(semprePositivo, 20), /positivo em toda a faixa de estresse; já atinge a margem-alvo/);
  const nuncaLucra = { variavel: 'preco' as const, fatorEquilibrio: null, resultadoSemprePositivo: false, fatorAlvo: null, alvoSempreAtingido: false, folgaPct: null };
  assert.match(textoPontoDeEquilibrio(nuncaLucra, 20), /não zera em nenhum ponto da faixa de estresse; não atinge a margem-alvo/);
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

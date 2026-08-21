import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precisaCarregar, respostaAindaVale } from './viab-imagem-principal.js';

test('primeiro estudo carregado dispara carga', () => {
  assert.equal(precisaCarregar(42, null), true);
});

test('mesmo estudo já carregado não recarrega', () => {
  assert.equal(precisaCarregar(42, 42), false);
});

test('trocar de estudo (navegação sem reload de página) dispara nova carga', () => {
  // Era o bug: com um booleano "já carreguei alguma vez", a capa do estudo 42
  // continuava na tela depois de navegar para o estudo 99.
  assert.equal(precisaCarregar(99, 42), true);
});

test('sem estudo (id ausente) não carrega', () => {
  assert.equal(precisaCarregar(undefined, null), false);
  assert.equal(precisaCarregar(null, null), false);
});

test('id malformado (NaN) não entra em loop de recarga', () => {
  // Sem o guard `Number.isFinite`, NaN !== NaN é sempre true em JS e
  // `precisaCarregar` devolveria true a cada `updated()` — recarga em loop.
  assert.equal(precisaCarregar(NaN, NaN), false);
  assert.equal(precisaCarregar(NaN, null), false);
});

// ─────────────────────────────────────────────────────────────────────────
// Bloqueante da revisão de 2026-08-18: trocar o guard booleano por comparação
// de id (acima) permite, pela primeira vez, DUAS chamadas de `_carregar()`
// concorrentes — antes disso `_carregar()` só rodava uma vez por tempo de
// vida do componente, então duas fetches simultâneas eram impossíveis.
//
// Cenário: abre o estudo 42 (fetch A dispara), navega rápido para o 99 antes
// de A responder (fetch B dispara, `idCarregado` já é 99). Sem controle de
// qual fetch é a mais recente, se A responder DEPOIS de B — sem ordem
// garantida entre duas fetches HTTP — o `.then` de A escreveria por último e
// a tela mostraria a capa do 42 com `estudo.id` já em 99: o mesmo bug que
// este componente existe para corrigir, reaparecendo por uma corrida
// assíncrona em vez do booleano antigo.
//
// `respostaAindaVale` é o guard que `_carregar()` chama nos três pontos onde
// grava estado; estes testes exercitam exatamente essa função, não uma cópia.
// ─────────────────────────────────────────────────────────────────────────

test('resposta da fetch em voo ainda vale quando o estudo não mudou', () => {
  assert.equal(respostaAindaVale(42, 42), true);
});

test('resposta de uma fetch antiga (estudo 42) não vale mais depois de navegar para o 99', () => {
  // É exatamente o cenário da corrida: fetch A pediu pelo estudo 42, mas
  // quando ela responde `this.estudo.id` já é 99 — a resposta é descartada.
  assert.equal(respostaAindaVale(42, 99), false);
});

test('resposta não vale quando o estudo foi limpo (id undefined) enquanto a fetch estava em voo', () => {
  assert.equal(respostaAindaVale(42, undefined), false);
});

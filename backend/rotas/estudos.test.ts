import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateTransicao } from './estudos.js';

// Ciclo de vida do estudo (spec §3):
//   rascunho → em_analise (editor)
//   em_analise → aprovado | reprovado | rascunho (aprovador)
//   arquivado → rascunho (aprovador reabre)
//   * → arquivado (aprovador), exceto de aprovado/arquivado

test('editor submete rascunho para em_analise', () => {
  assert.equal(gateTransicao('rascunho', 'em_analise'), 'editor');
});

test('aprovador aprova, reprova e devolve estudos em análise', () => {
  assert.equal(gateTransicao('em_analise', 'aprovado'), 'aprovador');
  assert.equal(gateTransicao('em_analise', 'reprovado'), 'aprovador');
  assert.equal(gateTransicao('em_analise', 'rascunho'), 'aprovador');
});

test('aprovador reabre estudo arquivado para rascunho', () => {
  assert.equal(gateTransicao('arquivado', 'rascunho'), 'aprovador');
});

test('arquivamento manual exige aprovador e não vale para aprovado/arquivado', () => {
  assert.equal(gateTransicao('rascunho', 'arquivado'), 'aprovador');
  assert.equal(gateTransicao('em_analise', 'arquivado'), 'aprovador');
  assert.equal(gateTransicao('reprovado', 'arquivado'), 'aprovador');
  assert.equal(gateTransicao('aprovado', 'arquivado'), null);
  assert.equal(gateTransicao('arquivado', 'arquivado'), null);
});

test('transições inválidas retornam null', () => {
  assert.equal(gateTransicao('rascunho', 'aprovado'), null); // pula em_analise
  assert.equal(gateTransicao('rascunho', 'reprovado'), null);
  assert.equal(gateTransicao('aprovado', 'em_analise'), null);
  assert.equal(gateTransicao('reprovado', 'rascunho'), null);
  assert.equal(gateTransicao('em_analise', 'em_analise'), null); // no-op
});

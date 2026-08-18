import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precisaCarregar } from './viab-imagem-principal.js';

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

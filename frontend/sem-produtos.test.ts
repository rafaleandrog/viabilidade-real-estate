import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  textoPrecoSugerido, PRECO_SUGERIDO_SEM_PRODUTOS, PRECO_SUGERIDO_INATINGIVEL,
} from './sem-produtos.js';

test('catálogo carregado e vazio: pede o cadastro, nunca "inatingível"', () => {
  const t = textoPrecoSugerido({ catalogoCarregado: true, semProdutos: true, precoSug: null });
  assert.equal(t, PRECO_SUGERIDO_SEM_PRODUTOS);
  assert.ok(!t!.includes('inatingível'));
});

test('com produtos e preço calculado: não há texto, vale o valor', () => {
  assert.equal(textoPrecoSugerido({ catalogoCarregado: true, semProdutos: false, precoSug: 5200 }), null);
});

test('com produtos e sem preço: inatingível', () => {
  assert.equal(
    textoPrecoSugerido({ catalogoCarregado: true, semProdutos: false, precoSug: null }),
    PRECO_SUGERIDO_INATINGIVEL,
  );
});

test('catálogo ainda carregando: comportamento anterior (só o preço decide)', () => {
  assert.equal(
    textoPrecoSugerido({ catalogoCarregado: false, semProdutos: true, precoSug: null }),
    PRECO_SUGERIDO_INATINGIVEL,
  );
  assert.equal(textoPrecoSugerido({ catalogoCarregado: false, semProdutos: true, precoSug: 4000 }), null);
});

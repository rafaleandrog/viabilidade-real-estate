import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS } from './preliminar-produtos.js';

// #565: `tipo` (Residencial/Não Residencial) entra na whitelist do
// backend — POST e PATCH usam o mesmo array `CAMPOS`, então esta é a
// única verificação de que a rota aceita o campo em ambos os verbos.
// A posição confere a issue: "entre Nome e Área média".

test('CAMPOS inclui `tipo`, entre `nome` e `area_media_m2`', () => {
  assert.deepEqual(CAMPOS, ['nome', 'tipo', 'area_media_m2', 'preco_venda_m2', 'unidades', 'ordem']);
  const iNome = CAMPOS.indexOf('nome');
  const iTipo = CAMPOS.indexOf('tipo');
  const iArea = CAMPOS.indexOf('area_media_m2');
  assert.ok(iNome < iTipo && iTipo < iArea, 'tipo deve ficar entre nome e area_media_m2');
});

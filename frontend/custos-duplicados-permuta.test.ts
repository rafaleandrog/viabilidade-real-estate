import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCustosDuplicados } from './fluxo-invariantes.js';

// Permuta física é reservada POR TIPOLOGIA: uma linha por tipologia não é duplicata.
const permuta = (tipologia?: number | string | null) => ({
  grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
  ...(tipologia === undefined ? {} : { permuta_tipologia_id: tipologia }),
});

test('permuta física em tipologias DIFERENTES não é duplicata', () => {
  assert.deepEqual(validarCustosDuplicados([permuta(1), permuta(2)]), []);
});

test('permuta física na MESMA tipologia continua acusada (id numérico e textual contam igual)', () => {
  const r = validarCustosDuplicados([permuta(1), permuta('1')]);
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'CATEGORIA_CUSTO_DUPLICADA');
  assert.equal(r[0].encontrado, 2);
});

test('duas permutas físicas SEM tipologia continuam acusadas entre si', () => {
  const r = validarCustosDuplicados([permuta(null), permuta('')]);
  assert.equal(r.length, 1);
  assert.equal(r[0].encontrado, 2);
});

test('permuta física com tipologia e outra sem tipologia não são duplicata', () => {
  assert.deepEqual(validarCustosDuplicados([permuta(1), permuta(null)]), []);
});

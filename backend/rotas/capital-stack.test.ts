import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCamposInstrumento } from './capital-stack.js';

test('validarCamposInstrumento: tipo/status ausentes não são erro (padrão parcial)', () => {
  assert.equal(validarCamposInstrumento({}), null);
});

test('validarCamposInstrumento: aceita os 4 tipos e os 4 status do §4/§13.3', () => {
  for (const tipo of ['financiamento_producao', 'capital_giro', 'preferred_equity', 'sponsor_equity']) {
    assert.equal(validarCamposInstrumento({ tipo }), null);
  }
  for (const status of ['rascunho', 'ativo', 'encerrado', 'revisao_necessaria']) {
    assert.equal(validarCamposInstrumento({ status }), null);
  }
});

test('validarCamposInstrumento: rejeita tipo e status fora do enum', () => {
  assert.ok(validarCamposInstrumento({ tipo: 'financiamento_bancario' }));
  assert.ok(validarCamposInstrumento({ status: 'pendente' }));
});

test('validarCamposInstrumento: config precisa ser objeto quando presente; null é aceito (limpa o campo)', () => {
  assert.equal(validarCamposInstrumento({ config: { taxaAnual: 0.12 } }), null);
  assert.equal(validarCamposInstrumento({ config: null }), null);
  assert.ok(validarCamposInstrumento({ config: 'texto' }));
  assert.ok(validarCamposInstrumento({ config: 42 }));
});

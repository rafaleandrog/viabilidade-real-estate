import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehCustoLike, rotuloAlavanca, variaveisSensibilidade } from './variaveis-sensibilidade.js';

test('ehCustoLike e rotuloAlavanca — uma tabela só de rótulos e sentido', () => {
  assert.equal(ehCustoLike('preco'), false);
  assert.equal(ehCustoLike('custo_obras'), true);
  assert.equal(ehCustoLike('custo_indireto'), true);
  assert.equal(rotuloAlavanca('custo_obras', false), 'Custo de obra');
  assert.equal(rotuloAlavanca('custo_infra', true), 'Custo de infraestrutura');
  assert.equal(rotuloAlavanca('preco', true), 'Preço/m² de venda');
  assert.equal(rotuloAlavanca('preco', false), 'Preço de venda');
});

test('variaveisSensibilidade: Loteamento estressa infraestrutura, Incorporação estressa obra — nunca as duas', () => {
  const lot = variaveisSensibilidade(true);
  const inc = variaveisSensibilidade(false);
  assert.ok(lot.includes('custo_infra') && !lot.includes('custo_obras'));
  assert.ok(inc.includes('custo_obras') && !inc.includes('custo_infra'));
  assert.equal(lot[0], 'preco');
  assert.equal(inc[0], 'preco');
  assert.equal(new Set(inc).size, inc.length, 'variável repetida no seletor');
});

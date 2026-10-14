import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formDoComplemento, payloadDoForm, validarForm, paraNumero, indexarComplementos, rotuloDe, SITUACOES,
} from './terrenos-complemento.js';

test('paraNumero: decimal-string do banco vira número; vazio e lixo viram null', () => {
  assert.equal(paraNumero('1500000.00'), 1500000);
  assert.equal(paraNumero(2.5), 2.5);
  assert.equal(paraNumero(0), 0, '0 é valor, não ausência');
  for (const v of [null, undefined, '', 'abc', NaN]) assert.equal(paraNumero(v), null);
});

test('formDoComplemento: sem registro, texto vazio e número nulo; com registro, converte decimal', () => {
  const vazio = formDoComplemento(null);
  assert.equal(vazio.proprietario, '');
  assert.equal(vazio.preco_pedido, null);
  const f = formDoComplemento({ proprietario: 'A', preco_pedido: '10.50', taxa_ocupacao_pct: 60, restricoes: null });
  assert.equal(f.proprietario, 'A');
  assert.equal(f.preco_pedido, 10.5);
  assert.equal(f.taxa_ocupacao_pct, 60);
  assert.equal(f.restricoes, '');
});

test('payloadDoForm manda TODOS os campos: limpar na tela limpa no banco', () => {
  const p = payloadDoForm({ ...formDoComplemento(null), proprietario: '  X ', preco_pedido: 0 });
  assert.equal(p.proprietario, 'X');
  assert.equal(p.preco_pedido, 0, '0 não vira null');
  assert.equal(p.contato, null);
  assert.equal(p.situacao_negociacao, null);
  assert.equal(Object.keys(p).length, 12);
});

test('validarForm: faixa da taxa, negativo e pavimentos inteiros', () => {
  const base = formDoComplemento(null);
  assert.equal(validarForm(base), '');
  assert.match(validarForm({ ...base, taxa_ocupacao_pct: 101 }), /taxa de ocupação/);
  assert.match(validarForm({ ...base, preco_pedido: -5 }), /negativos/);
  assert.match(validarForm({ ...base, gabarito_pavimentos: 2.5 }), /inteiro/);
  assert.match(validarForm({ ...base, taxa_ocupacao_pct: 62.5 }), /taxa de ocupação.*inteiro/);
  assert.equal(validarForm({ ...base, taxa_ocupacao_pct: 100, gabarito_pavimentos: 12 }), '');
});

test('indexarComplementos chaveia por imovel_nucleo_id numérico; rotuloDe devolve o rótulo', () => {
  const m = indexarComplementos([{ imovel_nucleo_id: '7', x: 1 }, { imovel_nucleo_id: 9 }, {}]);
  assert.equal(m.size, 2);
  assert.equal(m.get(7)?.x, 1);
  assert.equal(rotuloDe(SITUACOES, 'opcao_compra'), 'Opção de compra');
  assert.equal(rotuloDe(SITUACOES, 'zzz'), '');
});

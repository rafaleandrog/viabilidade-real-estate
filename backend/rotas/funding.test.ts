import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCamposOperacao, conflitoFinanciamentoUnico } from './funding.js';

// #355 — validação das operações de Funding. Só lógica pura: as rotas em si
// exigem servidor e banco, que este ambiente não sobe (ver CLAUDE.md).

test('#355 payload parcial é válido (o mesmo validador serve POST e PATCH)', () => {
  assert.equal(validarCamposOperacao({}), null);
  assert.equal(validarCamposOperacao({ nome: 'Dívida A' }), null);
  assert.equal(validarCamposOperacao({ valor: 1_000_000 }), null);
});

test('#355 aceita os 3 tipos e os 2 modos de retorno', () => {
  for (const tipo of ['financiamento_producao', 'divida', 'equity']) {
    assert.equal(validarCamposOperacao({ tipo }), null, tipo);
  }
  for (const modo_retorno of ['permuta_financeira', 'resultado_final']) {
    assert.equal(validarCamposOperacao({ modo_retorno }), null, modo_retorno);
  }
});

test('#355 rejeita tipo, modo e âncora fora da lista', () => {
  // `capital_giro`, `preferred_equity` e `sponsor_equity` eram do modelo antigo
  // e deixam de existir — a API precisa recusar, não aceitar em silêncio.
  assert.match(String(validarCamposOperacao({ tipo: 'capital_giro' })), /tipo deve ser um de/);
  assert.match(String(validarCamposOperacao({ tipo: 'preferred_equity' })), /tipo deve ser um de/);
  assert.match(String(validarCamposOperacao({ modo_retorno: 'A' })), /modo_retorno deve ser um de/);
  assert.match(String(validarCamposOperacao({ cronograma_evento: 'entrega' })), /cronograma_evento deve ser um de/);
});

test('#355 rejeita valores negativos e não numéricos', () => {
  assert.match(String(validarCamposOperacao({ valor: -1 })), /não pode ser negativo/);
  assert.match(String(validarCamposOperacao({ taxa_anual: -0.5 })), /não pode ser negativo/);
  assert.match(String(validarCamposOperacao({ pct_retorno: -2 })), /não pode ser negativo/);
  assert.match(String(validarCamposOperacao({ valor: 'abc' })), /deve ser numérico/);
  // null é ausência de valor, não erro — a coluna é anulável.
  assert.equal(validarCamposOperacao({ fase_ancora_id: null, valor: null }), null);
});

test('#355 carência precisa ser menor que a amortização', () => {
  // O PMT da planilha é calculado sobre `amortização − carência`: igualar os
  // dois zeraria o prazo e a operação nunca se pagaria.
  assert.match(
    String(validarCamposOperacao({ periodo_amortizacao_meses: 12, periodo_carencia_meses: 12 })),
    /menor que periodo_amortizacao_meses/,
  );
  assert.match(
    String(validarCamposOperacao({ periodo_amortizacao_meses: 12, periodo_carencia_meses: 24 })),
    /menor que periodo_amortizacao_meses/,
  );
  assert.equal(validarCamposOperacao({ periodo_amortizacao_meses: 36, periodo_carencia_meses: 12 }), null);
  // Amortização 0 = operação ainda em branco; não é erro de coerência.
  assert.equal(validarCamposOperacao({ periodo_amortizacao_meses: 0, periodo_carencia_meses: 0 }), null);
});

test('#355 aporte_meses mínimo é 1', () => {
  assert.match(String(validarCamposOperacao({ aporte_meses: 0 })), /pelo menos 1/);
  assert.equal(validarCamposOperacao({ aporte_meses: 1 }), null);
});

test('#355 Financiamento à produção é único por estudo', () => {
  const existentes = [
    { id: 1, tipo: 'financiamento_producao' },
    { id: 2, tipo: 'divida' },
  ];
  // Um segundo financiamento conflita...
  assert.deepEqual(conflitoFinanciamentoUnico('financiamento_producao', existentes), { id: 1, tipo: 'financiamento_producao' });
  // ...mas dívida e equity são livres.
  assert.equal(conflitoFinanciamentoUnico('divida', existentes), undefined);
  assert.equal(conflitoFinanciamentoUnico('equity', existentes), undefined);
  // Sem nenhum ainda, pode criar.
  assert.equal(conflitoFinanciamentoUnico('financiamento_producao', [{ id: 2, tipo: 'divida' }]), undefined);
});

test('#355 o PATCH do próprio financiamento não conflita consigo mesmo', () => {
  const existentes = [{ id: 1, tipo: 'financiamento_producao' }];
  assert.equal(conflitoFinanciamentoUnico('financiamento_producao', existentes, 1), undefined);
  // Mas outro registro tentando virar financiamento, sim.
  assert.deepEqual(conflitoFinanciamentoUnico('financiamento_producao', existentes, 9), { id: 1, tipo: 'financiamento_producao' });
});

// ── Campos de financiamento_producao (§4.3, preservados da #405) ──────────

test('#355 exposicao_minima e percentual_financiavel aceitam 0-100 e rejeitam acima disso', () => {
  assert.equal(validarCamposOperacao({ exposicao_minima: 0 }), null);
  assert.equal(validarCamposOperacao({ exposicao_minima: 20 }), null);
  assert.equal(validarCamposOperacao({ percentual_financiavel: 100 }), null);
  assert.match(String(validarCamposOperacao({ exposicao_minima: 101 })), /não pode passar de 100/);
  assert.match(String(validarCamposOperacao({ percentual_financiavel: -5 })), /não pode ser negativo/);
});

test('#355 custo_linha_ids precisa ser uma lista de números', () => {
  assert.equal(validarCamposOperacao({ custo_linha_ids: [1, 5, 8] }), null);
  assert.equal(validarCamposOperacao({ custo_linha_ids: [] }), null);
  // null é "sem seleção própria" (cai na base padrão no motor) — não é erro.
  assert.equal(validarCamposOperacao({ custo_linha_ids: null }), null);
  assert.match(String(validarCamposOperacao({ custo_linha_ids: 'abc' })), /lista de números/);
  assert.match(String(validarCamposOperacao({ custo_linha_ids: [1, 'x'] })), /lista de números/);
});

test('#355 amortizar_com_caixa_disponivel não passa pela checagem numérica (é booleano)', () => {
  assert.equal(validarCamposOperacao({ amortizar_com_caixa_disponivel: true }), null);
  assert.equal(validarCamposOperacao({ amortizar_com_caixa_disponivel: false }), null);
});

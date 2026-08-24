import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camposVisiveisFinanceiro, sujeitoRetVisivelFinanceiro, impostoPercentualEditavel,
} from './tela-financeiro.js';

// #450 (D8/D-Q08, 2026-08-22): a aba Financeiro do Avançado parava de exibir
// controles sem consumidor no Avançado. Os testes de frontend deste repo são
// de lógica pura (sem DOM) — a decisão de o quê renderizar/desabilitar foi
// extraída para estas três funções puras, exportadas só para isto.

test('#450 camposVisiveisFinanceiro: no Avançado, só taxa_desconto_aa e imposto_percentual', () => {
  assert.deepEqual(camposVisiveisFinanceiro('avancado'), ['taxa_desconto_aa', 'imposto_percentual']);
});

test('#450 camposVisiveisFinanceiro: fora do Avançado, a aba não renderiza nada', () => {
  assert.deepEqual(camposVisiveisFinanceiro('preliminar'), []);
  assert.deepEqual(camposVisiveisFinanceiro(''), []);
});

test('#450 camposVisiveisFinanceiro: os 7 controles removidos nunca aparecem na lista, em nível nenhum', () => {
  const removidos = [
    'regime_tributario', 'aliquota_pis_pct', 'aliquota_cofins_pct', 'aliquota_csll_pct',
    'aliquota_irpj_pct', 'aliquota_itbi_pct', 'imposto_sobre_permuta_fisica',
  ];
  for (const nivel of ['avancado', 'preliminar', '']) {
    const visiveis = camposVisiveisFinanceiro(nivel);
    for (const campo of removidos) {
      assert.ok(!visiveis.includes(campo), `${campo} não deveria aparecer para nivel="${nivel}"`);
    }
  }
});

test('#450 (D-Q08) sujeitoRetVisivelFinanceiro: oculto no Avançado, visível fora dele', () => {
  assert.equal(sujeitoRetVisivelFinanceiro('avancado'), false);
  assert.equal(sujeitoRetVisivelFinanceiro('preliminar'), true);
  assert.equal(sujeitoRetVisivelFinanceiro(''), true);
});

test('#450 impostoPercentualEditavel: nunca editável na aba Financeiro — só o Preliminar (Premissas) edita de fato', () => {
  assert.equal(impostoPercentualEditavel('avancado'), false);
  assert.equal(impostoPercentualEditavel('preliminar'), false);
});

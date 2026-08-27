// #566: fim da permuta física por seleção de unidade (só m² e % área venda).
//
// `PERMUTA_UNIDADE`/`PERMUTA_FIS_NR` são exatamente o array que o template
// percorre para desenhar as badges (`cu.opcoes.map(...)`, em
// `_custoUnidade`) — testar o array direto não é "cobertura decorativa" no
// sentido que o CLAUDE.md acusa (função pura testada, nunca chamada pela
// tela): aqui não há gap de fiação possível, porque o template lê o MESMO
// objeto que o teste importa. Mutação — recolocar `{ valor: 'unidade', ... }`
// em qualquer um dos dois — deixa este teste vermelho.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERMUTA_UNIDADE, PERMUTA_FIS_NR, modoEfetivo } from './tela-premissas.js';

test('#566: Permuta física (R/Loteamento) só oferece m² e % área de venda', () => {
  assert.deepEqual(PERMUTA_UNIDADE.opcoes.map((o) => o.valor), ['area_m2', 'pct_area_venda']);
  assert.ok(!PERMUTA_UNIDADE.opcoes.some((o) => o.valor === 'unidade'), 'badge "Unidade" voltou');
});

test('#566: Permuta física não residencial só oferece m² e % área de venda', () => {
  assert.deepEqual(PERMUTA_FIS_NR.opcoes.map((o) => o.valor), ['area_m2', 'pct_area_venda']);
  assert.ok(!PERMUTA_FIS_NR.opcoes.some((o) => o.valor === 'unidade'), 'badge "Unidade" voltou');
});

test('#566: modoEfetivo trata modo aposentado/desconhecido como o padrão do campo', () => {
  // Estudo salvo ANTES da migração 036 rodar: `permuta_fisica_modo` ainda é
  // 'unidade' — a tela não pode indexar `opcoes` fora do array nem travar.
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, 'unidade'), 'area_m2');
  assert.equal(modoEfetivo(PERMUTA_FIS_NR, 'unidade'), 'area_m2');
  // Qualquer outro valor nunca visto (defensivo) cai no mesmo padrão.
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, 'modo_inexistente'), 'area_m2');
  // Sem valor salvo (campo novo/nulo), usa o padrão declarado.
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, undefined), PERMUTA_UNIDADE.padrao);
});

test('#566: modoEfetivo preserva um modo válido em uso (não força o padrão)', () => {
  assert.equal(modoEfetivo(PERMUTA_UNIDADE, 'pct_area_venda'), 'pct_area_venda');
  assert.equal(modoEfetivo(PERMUTA_FIS_NR, 'area_m2'), 'area_m2');
});

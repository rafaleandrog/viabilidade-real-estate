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
import { PERMUTA_UNIDADE, PERMUTA_FIS_NR, modoEfetivo, colunasProduto } from './tela-premissas.js';

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

// #570 / rodada 1 de revisão — a coluna "Tipo" do grid de Produtos não existe
// no Loteamento.
//
// ⚠️ A prova mora AQUI, e não no harness de render, porque o harness só sabe
// exigir PRESENÇA (`exigir`/`minimo`): ele não conta células nem prova que algo
// está ausente. É o mesmo recurso que a #566 usou para provar que a Permuta
// física parou de oferecer "Unidade" — a lista é exportada e conferida direto.
test('rev1: o grid de Produtos não tem a coluna "Tipo" no Loteamento', () => {
  const chaves = colunasProduto(true).map((c) => c.chave);
  assert.ok(!chaves.includes('tipo'),
    `o Loteamento não edita categoria — o motor normaliza tudo para residencial: ${chaves.join(',')}`);
  assert.deepEqual(chaves, ['nome', 'area', 'preco', 'unidades', 'vgv']);
});

test('rev1: na Incorporação a coluna "Tipo" continua entre Nome e Área média', () => {
  const chaves = colunasProduto(false).map((c) => c.chave);
  assert.deepEqual(chaves, ['nome', 'tipo', 'area', 'preco', 'unidades', 'vgv']);
  // A posição importa: é o que o caso de render `catalogo-produtos-tipo` mede
  // pelo `colgroup`, e as duas provas têm que concordar.
  assert.equal(chaves.indexOf('tipo'), chaves.indexOf('nome') + 1);
  assert.equal(chaves.indexOf('area'), chaves.indexOf('tipo') + 1);
});

test('rev1: as duas configurações diferem em UMA coluna, e só nela', () => {
  const lot = colunasProduto(true).map((c) => c.chave);
  const inc = colunasProduto(false).map((c) => c.chave);
  assert.equal(inc.length, lot.length + 1, 'a diferença tem que ser exatamente uma coluna');
  assert.deepEqual(inc.filter((c) => c !== 'tipo'), lot);
});

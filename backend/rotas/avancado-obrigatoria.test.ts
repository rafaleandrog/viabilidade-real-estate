import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloqueioLinhaObrigatoria } from './avancado.js';

// #256: a linha obrigatória de um grupo (Preço/terreno, Construção/obra,
// Corretagem de vendas/diretos) é intocável na API, não só na tela.
//
// Arquivo próprio, no mesmo padrão de `avancado-ancoragem.test.ts`: mantém a
// regra isolada e evita que duas branches mexendo em custos colidam no fim de
// `avancado.test.ts`.
//
// A trava existia SÓ no frontend — a categoria vira texto e o botão de remover
// some quando `obrigatoria === true` (tela-fluxo-custos.ts:598,843). Esconder
// controle não é regra: PATCH/DELETE diretos na API passavam, e o estudo
// ficava sem identidade oficial no grupo.

test('#256 DELETE da linha obrigatória é recusado', () => {
  assert.ok(bloqueioLinhaObrigatoria({ obrigatoria: true, grupo: 'terreno', categoria: 'Preço' }));
});

test('#256 DELETE de linha comum passa', () => {
  assert.equal(bloqueioLinhaObrigatoria({ obrigatoria: false, grupo: 'terreno', categoria: 'Outro' }), null);
  assert.equal(bloqueioLinhaObrigatoria({ grupo: 'obra', categoria: 'Construção' }), null); // flag ausente
});

test('#256 PATCH que RENOMEIA a linha obrigatória é recusado', () => {
  const oficial = { obrigatoria: true, grupo: 'terreno', categoria: 'Preço' };
  assert.ok(bloqueioLinhaObrigatoria(oficial, { categoria: 'Outro' }));
  assert.ok(bloqueioLinhaObrigatoria(oficial, { grupo: 'obra' }));
});

test('#256 PATCH que edita orçamento/curva da linha obrigatória PASSA', () => {
  // O escopo da issue é bloquear renomeação e remoção — não congelar a linha.
  // Editar o valor da linha de Preço é justamente o uso principal dela.
  const oficial = { obrigatoria: true, grupo: 'terreno', categoria: 'Preço' };
  assert.equal(bloqueioLinhaObrigatoria(oficial, { orcamento_valor: 5_000_000 }), null);
  assert.equal(bloqueioLinhaObrigatoria(oficial, { curva_id: 3, inicio_mes: 2 }), null);
  assert.equal(bloqueioLinhaObrigatoria(oficial, { subcategoria: 'Parcelado' }), null);
});

test('#256 reenviar o MESMO grupo/categoria não é renomear — passa', () => {
  const oficial = { obrigatoria: true, grupo: 'terreno', categoria: 'Preço' };
  assert.equal(bloqueioLinhaObrigatoria(oficial, { categoria: 'Preço', grupo: 'terreno' }), null);
});

test('#256 linha comum pode ser renomeada à vontade', () => {
  const comum = { obrigatoria: false, grupo: 'terreno', categoria: 'Registro' };
  assert.equal(bloqueioLinhaObrigatoria(comum, { categoria: 'Outro' }), null);
});

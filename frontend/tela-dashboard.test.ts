import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoListagem, type ResumoListagem } from './tela-dashboard.js';

// ─────────────────────────────────────────────────────────────────────────
// #406: a listagem de Estudos mostrava "—" em VGV/Resultado/Margem para todo
// estudo Avançado, porque calculava com o motor do Preliminar
// (`calcularProforma`), que só lê campos fixos que o Avançado não tem.
//
// `resumoListagem` é a decisão pura por trás das três colunas: Preliminar
// segue exatamente como sempre foi (mesma chamada síncrona); Avançado lê de
// um mapa preenchido de forma assíncrona (`_calcularUmAvancado`, pesado
// demais para testar aqui — 5 chamadas de API + `calcularFluxo` +
// opcionalmente `simularCapitalStackDoEstudo`), com três desfechos:
// 'carregando' (chave ausente), null (chave 'indisponivel', ou calculou e
// deu vgv<=0) e o resultado pronto.
// ─────────────────────────────────────────────────────────────────────────

test('Preliminar com VGV nos campos legados: comportamento inalterado (sem calculosAvancado)', () => {
  const estudo = {
    nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000, num_unidades_residencial: 10,
  };
  const r = resumoListagem(estudo, {});
  assert.notEqual(r, null);
  assert.notEqual(r, 'carregando');
  assert.ok((r as ResumoListagem).vgv > 0);
});

test('Preliminar sem VGV nos campos legados nem no catálogo: "—" (null), não "carregando"', () => {
  const estudo = { id: 1, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' };
  assert.equal(resumoListagem(estudo, {}), null);
});

test('#406: Avançado ainda sem entrada no mapa é "carregando", não "—"', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.equal(resumoListagem(estudo, {}), 'carregando');
});

test('#406: Avançado calculado e pronto devolve o resumo — MESMA grandeza da sub-aba Proforma', () => {
  const calc: ResumoListagem = { vgv: 48_000_000, resultado: 12_000_000, margemPct: 25 };
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.deepEqual(resumoListagem(estudo, { 42: calc }), calc);
});

test('#406: Avançado marcado "indisponivel" (erro no cálculo) vira "—" (null)', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.equal(resumoListagem(estudo, { 42: 'indisponivel' }), null);
});

test('#406: Avançado calculado com vgv <= 0 também vira "—" — mesmo guard do Preliminar', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  const semReceita: ResumoListagem = { vgv: 0, resultado: 0, margemPct: 0 };
  assert.equal(resumoListagem(estudo, { 42: semReceita }), null);
});

test('#406: cada estudo Avançado é resolvido pelo seu PRÓPRIO id — um "carregando" não contamina os outros', () => {
  const pronto: ResumoListagem = { vgv: 10_000_000, resultado: 2_000_000, margemPct: 20 };
  const mapa = { 1: pronto, 2: 'indisponivel' as const };
  assert.deepEqual(resumoListagem({ id: 1, nivel_analise: 'avancado' }, mapa), pronto);
  assert.equal(resumoListagem({ id: 2, nivel_analise: 'avancado' }, mapa), null);
  assert.equal(resumoListagem({ id: 3, nivel_analise: 'avancado' }, mapa), 'carregando');
});

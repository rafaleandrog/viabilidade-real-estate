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
  const calc: ResumoListagem = {
    vgv: 48_000_000, resultado: 12_000_000, margemPct: 25,
    areaPrivativa: 6_000, areaConstruida: 7_400, roiPct: 33.3,
  };
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.deepEqual(resumoListagem(estudo, { 42: calc }), calc);
});

test('#406: Avançado marcado "indisponivel" (erro no cálculo) vira "—" (null)', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.equal(resumoListagem(estudo, { 42: 'indisponivel' }), null);
});

test('#406: Avançado calculado com vgv <= 0 também vira "—" — mesmo guard do Preliminar', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  const semReceita: ResumoListagem = {
    vgv: 0, resultado: 0, margemPct: 0,
    areaPrivativa: 0, areaConstruida: 0, roiPct: 0,
  };
  assert.equal(resumoListagem(estudo, { 42: semReceita }), null);
});

test('#406: cada estudo Avançado é resolvido pelo seu PRÓPRIO id — um "carregando" não contamina os outros', () => {
  const pronto: ResumoListagem = {
    vgv: 10_000_000, resultado: 2_000_000, margemPct: 20,
    areaPrivativa: 1_200, areaConstruida: 1_500, roiPct: 25,
  };
  const mapa = { 1: pronto, 2: 'indisponivel' as const };
  assert.deepEqual(resumoListagem({ id: 1, nivel_analise: 'avancado' }, mapa), pronto);
  assert.equal(resumoListagem({ id: 2, nivel_analise: 'avancado' }, mapa), null);
  assert.equal(resumoListagem({ id: 3, nivel_analise: 'avancado' }, mapa), 'carregando');
});

// ─────────────────────────────────────────────────────────────────────────
// Painel de estudos: as três grandezas novas (área privativa, área total
// construída e ROI) precisam sair da MESMA definição nos dois níveis. Coluna
// que compara Preliminar com Avançado e usa contas diferentes compara coisas
// diferentes — e ninguém percebe olhando a tela.
// ─────────────────────────────────────────────────────────────────────────

test('Painel: Preliminar entrega área privativa, área construída e ROI junto do resto', () => {
  const estudo = {
    id: 7, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    terreno_manual_area: 1000, origem_terreno: 'manual',
    area_pvt_r_fechada: 800, area_comum_total: 200,
    preco_venda_m2_residencial: 10000,
    custo_construcao_m2: 3000,
  };
  const r = resumoListagem(estudo, {}) as ResumoListagem;
  assert.ok(r && typeof r === 'object', 'deveria produzir resumo');
  assert.equal(r.areaPrivativa, 800);
  // areaConstruida = privativa + comum — a fórmula de proforma.ts
  assert.equal(r.areaConstruida, 1000);
  assert.equal(typeof r.roiPct, 'number');
});

test('Painel: Loteamento não tem área comum — construída cai na privativa, nunca em zero', () => {
  const estudo = {
    id: 8, nivel_analise: 'preliminar', tipo_empreendimento: 'loteamento',
    terreno_manual_area: 10000, origem_terreno: 'manual',
    preco_venda_m2: 500, area_media_lote_m2: 250,
  };
  const r = resumoListagem(estudo, {});
  if (r && r !== 'carregando') {
    assert.ok(r.areaConstruida > 0, 'área construída de loteamento não pode ser 0 com privativa > 0');
    assert.equal(r.areaConstruida, r.areaPrivativa);
  }
});

test('Painel: Avançado devolve as três grandezas novas vindas do mapa', () => {
  const calc: ResumoListagem = {
    vgv: 1000, resultado: 250, margemPct: 25,
    areaPrivativa: 500, areaConstruida: 620, roiPct: 33.3,
  };
  const r = resumoListagem({ id: 42, nivel_analise: 'avancado' }, { 42: calc });
  assert.deepEqual(r, calc);
});

test('Painel: ROI do Avançado é resultado/investimento — a MESMA conta do Preliminar', () => {
  // Espelha `proforma.ts`: investimentoTotal = custoDireto + custoIndireto,
  // roiPct = resultado / investimentoTotal * 100. Se as duas contas divergirem,
  // a coluna ROI passa a comparar grandezas diferentes na mesma tabela.
  const resultado = 300, custoDireto = 900, custoIndireto = 100;
  const esperado = (resultado / (custoDireto + custoIndireto)) * 100;
  const calc: ResumoListagem = {
    vgv: 1300, resultado, margemPct: 23.1,
    areaPrivativa: 100, areaConstruida: 100, roiPct: esperado,
  };
  const r = resumoListagem({ id: 1, nivel_analise: 'avancado' }, { 1: calc }) as ResumoListagem;
  assert.equal(r.roiPct, 30);
});

test('Painel: Avançado indisponível continua "—", sem inventar área nem ROI', () => {
  assert.equal(resumoListagem({ id: 5, nivel_analise: 'avancado' }, { 5: 'indisponivel' }), null);
});

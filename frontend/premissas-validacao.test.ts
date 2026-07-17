import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarObrigatorios, camposObrigatorios, campoObrasAtivo } from './premissas-validacao.js';

test('campoObrasAtivo segue o modo de unidade', () => {
  assert.equal(campoObrasAtivo({ infra_modo: 'pct_vgv' }, 'loteamento'), 'infra_pct');
  assert.equal(campoObrasAtivo({ infra_modo: 'valor_m2' }, 'loteamento'), 'custo_infra_m2');
  assert.equal(campoObrasAtivo({ infra_modo: 'valor_fixo' }, 'loteamento'), 'infra_valor_fixo');
  assert.equal(campoObrasAtivo({ construcao_modo: 'valor_m2' }, 'incorporacao'), 'custo_construcao_m2');
  assert.equal(campoObrasAtivo({ construcao_modo: 'valor_total' }, 'incorporacao'), 'construcao_valor_total');
});

test('loteamento: exige área do terreno e infraestrutura', () => {
  const vazio = validarObrigatorios({ origem_terreno: 'manual', infra_modo: 'pct_vgv' }, 'loteamento');
  assert.ok('terreno_manual_area' in vazio.erros);
  assert.ok('infra_pct' in vazio.erros); // modo pct_vgv → infra_pct
  assert.equal(vazio.faltando.length, 2);

  const ok = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 100000, infra_modo: 'pct_vgv', infra_pct: 30 }, 'loteamento');
  assert.equal(ok.faltando.length, 0, JSON.stringify(ok.faltando));
});

test('loteamento: infra no modo R$/m² valida custo_infra_m2', () => {
  const r = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 1000, infra_modo: 'valor_m2' }, 'loteamento');
  assert.ok('custo_infra_m2' in r.erros);
  assert.ok(!('infra_pct' in r.erros));
});

test('incorporação: exige ao menos um lado de unidades', () => {
  const r = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 1000, construcao_modo: 'valor_m2', custo_construcao_m2: 5000 },
    'incorporacao');
  assert.ok(r.faltando.some((f) => f.includes('Nº de unidades')));
  assert.ok('num_unidades_residencial' in r.erros);
  assert.ok('num_unidades_nao_residencial' in r.erros);
});

test('incorporação só residencial: NR não é exigido', () => {
  const r = validarObrigatorios({
    origem_terreno: 'manual', terreno_manual_area: 1000,
    construcao_modo: 'valor_m2', custo_construcao_m2: 5000,
    num_unidades_residencial: 100, area_pvt_r_fechada: 5000, preco_venda_m2_residencial: 10000,
  }, 'incorporacao');
  assert.equal(r.faltando.length, 0, JSON.stringify(r.faltando));
  assert.ok(!('preco_venda_m2_nao_residencial' in r.erros));
  assert.ok(!('area_pvt_nr_fechada' in r.erros));
});

test('incorporação: lado R com unidades exige área R e preço R', () => {
  const r = validarObrigatorios({
    origem_terreno: 'manual', terreno_manual_area: 1000,
    construcao_modo: 'valor_m2', custo_construcao_m2: 5000,
    num_unidades_residencial: 100, // sem área R nem preço R
  }, 'incorporacao');
  assert.ok('area_pvt_r_fechada' in r.erros);
  assert.ok('preco_venda_m2_residencial' in r.erros);
});

test('incorporação misto: exige área e preço dos dois lados', () => {
  const r = validarObrigatorios({
    origem_terreno: 'manual', terreno_manual_area: 1000,
    construcao_modo: 'valor_m2', custo_construcao_m2: 5000,
    num_unidades_residencial: 100, area_pvt_r_fechada: 5000, preco_venda_m2_residencial: 10000,
    num_unidades_nao_residencial: 20, // falta área NR e preço NR
  }, 'incorporacao');
  assert.ok('area_pvt_nr_fechada' in r.erros);
  assert.ok('preco_venda_m2_nao_residencial' in r.erros);
  assert.ok(!('preco_venda_m2_residencial' in r.erros)); // lado R completo
});

test('terreno via Núcleo: valida a área somada, sem exigir campo manual', () => {
  const semArea = validarObrigatorios(
    { origem_terreno: 'nucleo', area_terreno_nucleo: 0, infra_modo: 'pct_vgv', infra_pct: 30 }, 'loteamento');
  assert.ok(semArea.faltando.some((f) => f.includes('Núcleo')));
  assert.ok(!('terreno_manual_area' in semArea.erros));

  const comArea = validarObrigatorios(
    { origem_terreno: 'nucleo', area_terreno_nucleo: 50000, infra_modo: 'pct_vgv', infra_pct: 30 }, 'loteamento');
  assert.equal(comArea.faltando.length, 0);
});

test('zero não conta como preenchido', () => {
  const r = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 0, infra_modo: 'pct_vgv', infra_pct: 0 }, 'loteamento');
  assert.ok('terreno_manual_area' in r.erros);
  assert.ok('infra_pct' in r.erros);
});

test('camposObrigatorios (asterisco) reflete os lados preenchidos', () => {
  const soR = camposObrigatorios(
    { origem_terreno: 'manual', construcao_modo: 'valor_m2', num_unidades_residencial: 10 }, 'incorporacao');
  assert.ok(soR.has('area_pvt_r_fechada') && soR.has('preco_venda_m2_residencial'));
  assert.ok(!soR.has('area_pvt_nr_fechada'));
  assert.ok(soR.has('custo_construcao_m2')); // obras
  assert.ok(soR.has('terreno_manual_area'));
});

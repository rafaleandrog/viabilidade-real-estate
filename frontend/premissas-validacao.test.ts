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

test('loteamento: exige área do terreno e infraestrutura — Produtos não bloqueia', () => {
  const vazio = validarObrigatorios({ origem_terreno: 'manual', infra_modo: 'pct_vgv' }, 'loteamento');
  assert.ok('terreno_manual_area' in vazio.erros);
  assert.ok('infra_pct' in vazio.erros); // modo pct_vgv → infra_pct
  assert.ok(!vazio.faltando.some((f) => f.includes('Produtos')));
  assert.equal(vazio.faltando.length, 2);

  const ok = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 100000, infra_modo: 'pct_vgv', infra_pct: 30 },
    'loteamento');
  assert.equal(ok.faltando.length, 0, JSON.stringify(ok.faltando));
});

test('loteamento: infra no modo R$/m² valida custo_infra_m2', () => {
  const r = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 1000, infra_modo: 'valor_m2' }, 'loteamento');
  assert.ok('custo_infra_m2' in r.erros);
  assert.ok(!('infra_pct' in r.erros));
});

// #315/#711: o catálogo de Produtos (tabela `preliminar_produtos`) é a fonte
// de produto, mas NÃO é obrigatório para salvar Premissas, em nenhum tipo de
// estudo — as áreas de Premissas são só referência, o catálogo é preenchido
// depois, numa aba própria.
test('incorporação: catálogo vazio não bloqueia o salvamento de Premissas', () => {
  const r = validarObrigatorios(
    { origem_terreno: 'manual', terreno_manual_area: 1000, construcao_modo: 'valor_m2', custo_construcao_m2: 5000 },
    'incorporacao');
  assert.equal(r.faltando.length, 0, JSON.stringify(r.faltando));
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

test('camposObrigatorios (asterisco): terreno e obras, sem depender do catálogo', () => {
  const s = camposObrigatorios({ origem_terreno: 'manual', construcao_modo: 'valor_m2' }, 'incorporacao');
  assert.ok(s.has('custo_construcao_m2')); // obras
  assert.ok(s.has('terreno_manual_area'));
});

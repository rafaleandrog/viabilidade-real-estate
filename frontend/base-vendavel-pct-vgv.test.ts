import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { calcularFluxo, vgvVendavelTotalBase, type FluxoConfig } from './fluxo-caixa-motor.js';
import { resolverCustoTotal } from './fluxo-shared.js';
import { converterUnidade, type ConvUnidade } from './premissas-conversao.js';

// ─────────────────────────────────────────────────────────────────────────────
// Avançado: `% do VGV` e a corretagem incidem sobre o VGV VENDÁVEL (potencial
// menos a permuta física). VGV potencial 100M (100 un. × 50 m² × 20.000), 30
// unidades permutadas fisicamente (30M) → vendável 70M.
// ─────────────────────────────────────────────────────────────────────────────

const perto = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const RECEITA = [{
  id: 1, nome: 'Vendas',
  tipologias: [{ id: 1, tipologia_id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
  absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
  fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
}];
const PERMUTA = {
  id: 9, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
  permuta_tipologia_id: 1, permuta_quantidade: 30,
};
const config = (custos: any[]): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO as any,
  jurosTabelaAaEstudo: 0, linhasReceita: RECEITA, linhasCusto: custos, areaTerreno: 0,
});
const totalDe = (r: ReturnType<typeof calcularFluxo>, nome: string) =>
  r.linhasCusto.find((l) => l.nome === nome)!.total;

test('pct_vgv incide sobre o VGV vendável, não sobre o potencial', () => {
  const r = calcularFluxo(config([
    { id: 1, grupo: 'diretos', categoria: 'Marketing', orcamento_valor: 2, orcamento_unidade: 'pct_vgv' },
    PERMUTA,
  ]));
  assert.ok(perto(r.vgvTotal, 100_000_000));
  assert.ok(perto(r.vgvVendavel, 70_000_000));
  assert.ok(perto(totalDe(r, 'Marketing'), 1_400_000), `veio ${totalDe(r, 'Marketing')}`);
});

test('a corretagem usa sempre o vendável, sem escolha do estudo', () => {
  const r = calcularFluxo(config([
    { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv' },
    PERMUTA,
  ]));
  assert.ok(perto(totalDe(r, 'Corretagem de vendas'), 2_800_000));
});

test('canônico congelado de pct_vgv: o % derivado usa a base vendável', () => {
  // 2.800.000 sobre 70M vendáveis = 4%; sobre 100M seria 2,8% (→ 1.960.000).
  const r = calcularFluxo(config([
    {
      id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas',
      orcamento_valor: 4, orcamento_unidade: 'pct_vgv', orcamento_valor_canonico: 2_800_000,
    },
    PERMUTA,
  ]));
  assert.ok(perto(totalDe(r, 'Corretagem de vendas'), 2_800_000));
});

test('resolverCustoTotal: pct_vgv lê ctx.vgvVendavel e ignora vgvTotal', () => {
  const ctx = { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 100_000_000, vgvVendavel: 70_000_000 };
  assert.equal(resolverCustoTotal({ orcamento_valor: 2, orcamento_unidade: 'pct_vgv' }, ctx), 1_400_000);
});

test('vgvVendavelTotalBase (tela de Custos) coincide com o vgvVendavel do motor', () => {
  const custos = [PERMUTA];
  const motor = calcularFluxo(config(custos)).vgvVendavel;
  assert.ok(perto(vgvVendavelTotalBase(RECEITA, custos), motor));
  assert.ok(perto(vgvVendavelTotalBase(RECEITA, []), 100_000_000));
});

const FINANCEIRA = {
  id: 7, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
  orcamento_valor: 5, orcamento_unidade: 'pct_vgv',
};

test('permuta financeira em pct_vgv sem canônico: dedução = % gravado × receita de caixa', () => {
  // Estado depois da migração que anula o canônico: 5% × 70M de caixa = 3.500.000.
  const r = calcularFluxo(config([FINANCEIRA, PERMUTA]));
  assert.ok(perto(r.permutaFinanceiraTotal, 3_500_000), `veio ${r.permutaFinanceiraTotal}`);
});

test('permuta financeira em pct_vgv com canônico congelado: transitório (% derivado = canônico ÷ vendável)', () => {
  // Transitório documentado: 5.000.000 ÷ 70M = 7,142857% × 70M de caixa = 5.000.000
  // (com o denominador bruto seria 5% × 70M = 3.500.000). Some quando a migração
  // anula o canônico; por isso esta base só entra junto com ela.
  const r = calcularFluxo(config([{ ...FINANCEIRA, orcamento_valor_canonico: 5_000_000 }, PERMUTA]));
  assert.ok(perto(r.permutaFinanceiraTotal, 5_000_000), `veio ${r.permutaFinanceiraTotal}`);
});

test('vendável zero (permuta física de 100%): o % derivado não vira NaN nem Infinity', () => {
  const total100 = { ...PERMUTA, permuta_quantidade: 100 };
  const r = calcularFluxo(config([
    { ...FINANCEIRA, orcamento_valor_canonico: 5_000_000 },
    { id: 1, grupo: 'diretos', categoria: 'Marketing', orcamento_valor: 2, orcamento_unidade: 'pct_vgv', orcamento_valor_canonico: 1_000_000 },
    total100,
  ]));
  assert.ok(perto(r.vgvVendavel, 0));
  assert.ok(Number.isFinite(r.permutaFinanceiraTotal), `veio ${r.permutaFinanceiraTotal}`);
  assert.equal(r.permutaFinanceiraTotal, 0);
  assert.ok(Number.isFinite(totalDe(r, 'Marketing')));
  // A auditoria da base oposta é onde o NaN aparecia sem o guard.
  const linha = r.linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;
  assert.ok(Number.isFinite(linha.permutaAlternativa!.total), `veio ${linha.permutaAlternativa!.total}`);
});

test('conversão de unidade da tela de Custos: R$ → % VGV usa a base vendável', () => {
  const custos = [PERMUTA];
  const pctVgv: ConvUnidade = { tipo: 'pct', link: 'vgv' };
  const rs: ConvUnidade = { tipo: 'identidade' } as ConvUnidade;
  const vendavel = vgvVendavelTotalBase(RECEITA, custos);
  const pct = converterUnidade(rs, pctVgv, 2_800_000, { vgv: vendavel } as any);
  assert.ok(pct !== null && perto(pct, 4, 1e-9), `veio ${pct}`);
  // Com o VGV potencial (100M) seria 2,8%.
  const bruto = converterUnidade(rs, pctVgv, 2_800_000, { vgv: 100_000_000 } as any);
  assert.ok(bruto !== null && perto(bruto, 2.8, 1e-9));
});

// ── Fiação da tela ──────────────────────────────────────────────────────────
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const semComentarios = (t: string) => t
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');

test('fiação: a conversão e o contexto da tela de Custos usam a base vendável', () => {
  const s = semComentarios(fonte('frontend/tela-fluxo-custos.ts'));
  assert.ok(s.includes('vgv: this._vgvVendavel(),'), 'a conversão de unidade voltou ao VGV potencial');
  assert.ok(/_ctxBase\(\): ContextoCusto \{[^}]*vgvVendavel: this\._vgvVendavel\(\)/.test(s));
  assert.ok(s.includes('vgvVendavelTotalBase(this.linhasReceita, this.custos)'));
  assert.ok(!s.includes('vgv: this.ctxCusto.vgvTotal'));
});

test('o controle da base da corretagem saiu: nenhum código do frontend o lê ou grava', () => {
  const arquivos = execFileSync('git', ['ls-files', 'frontend', 'scripts/conferir-estudo.ts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.ts$/.test(f) && !f.endsWith('.test.ts') && !f.includes('/render/casos/'));
  for (const f of arquivos) {
    const s = semComentarios(fonte(f));
    assert.ok(!s.includes('corretagemSobrePermutaFisica'), f);
    assert.ok(!s.includes('corretagem_sobre_permuta_fisica'), f);
  }
});

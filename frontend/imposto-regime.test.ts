import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  OPCOES_REGIME_IMPOSTO, TETO_ALIQUOTA_IMPOSTO, aliquotaDoRegime, erroAliquotaImposto, formImpostoAlterado,
  formImpostoDeParametros, patchImpostoAvancado, rotuloAliquotaImposto,
} from './imposto-regime.js';
import { calcularFluxo, receitaTotalBaseCusto, vgvVendavelPorLinha, type FluxoConfig } from './fluxo-caixa-motor.js';
import { impostoDoEstudoAvancado } from './fluxo-shared.js';
import { validarImposto } from './fluxo-invariantes.js';

// ─────────────────────────────────────────────────────────────────────────────
// #834, fatia 2 — o editor do regime do imposto, o alerta de imposto zero e a
// base `% da receita` com permuta física.
// ─────────────────────────────────────────────────────────────────────────────

// ── Editor ──────────────────────────────────────────────────────────────────

test('#834 formImpostoDeParametros: rota vira rascunho com o regime e as duas alíquotas', () => {
  assert.deepEqual(formImpostoDeParametros({ considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73 }),
    { regime: 'padrao', retPct: 4, padraoPct: 6.73 });
  assert.deepEqual(formImpostoDeParametros({ considerar_ret: true, ret_pct: '5.5', imposto_percentual: '7.00' }),
    { regime: 'ret', retPct: 5.5, padraoPct: 7 });
  // Sem alíquota gravada: RET cai no padrão de 4 %, imposto padrão em 0.
  assert.deepEqual(formImpostoDeParametros({ considerar_ret: false, ret_pct: null, imposto_percentual: null }),
    { regime: 'padrao', retPct: 4, padraoPct: 0 });
  assert.deepEqual(formImpostoDeParametros({ erro: true }), { regime: 'padrao', retPct: 4, padraoPct: 0 });
});

test('#834 o rascunho e o resolvedor do motor leem a rota do mesmo jeito', () => {
  for (const params of [
    { considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73 },
    { considerar_ret: true, ret_pct: '5.5', imposto_percentual: 7 },
    { considerar_ret: false, ret_pct: 4, imposto_percentual: null },
  ]) {
    const form = formImpostoDeParametros(params);
    const motor = impostoDoEstudoAvancado(params)!;
    assert.equal(form.regime, motor.regime);
    assert.equal(aliquotaDoRegime(form), motor.pct);
  }
});

test('#834 patchImpostoAvancado grava o regime e as DUAS alíquotas', () => {
  assert.deepEqual(patchImpostoAvancado({ regime: 'ret', retPct: 4, padraoPct: 6.73 }),
    { considerar_ret: true, ret_pct: 4, imposto_percentual: 6.73 });
  assert.deepEqual(patchImpostoAvancado({ regime: 'padrao', retPct: 4, padraoPct: 6.73 }),
    { considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73 });
});

test('#834 erroAliquotaImposto: só percentual entre 0 e o teto', () => {
  assert.equal(TETO_ALIQUOTA_IMPOSTO, 100);
  for (const v of [0, 4, 6.73, 100]) assert.equal(erroAliquotaImposto(v), null, String(v));
  for (const v of [-0.01, 100.01, NaN, Infinity, null, undefined, '7']) {
    assert.match(String(erroAliquotaImposto(v)), /entre 0 e 100/, String(v));
  }
});

test('#834 fora do RET o controle não fala em RET', () => {
  assert.equal(rotuloAliquotaImposto('padrao'), 'Alíquota do imposto padrão');
  assert.equal(rotuloAliquotaImposto('ret'), 'Alíquota do RET');
  const padrao = OPCOES_REGIME_IMPOSTO.find((o) => o.valor === 'padrao')!;
  assert.doesNotMatch(padrao.rotulo + rotuloAliquotaImposto('padrao'), /\bRET\b|afetação/);
});

test('#834 formImpostoAlterado', () => {
  const a = { regime: 'padrao' as const, retPct: 4, padraoPct: 7 };
  assert.equal(formImpostoAlterado(a, { ...a }), false);
  assert.equal(formImpostoAlterado(a, { ...a, regime: 'ret' }), true);
  assert.equal(formImpostoAlterado(a, { ...a, padraoPct: 6.73 }), true);
});

// ── Alerta de imposto zero ──────────────────────────────────────────────────

test('#834 validarImposto: estudo sem imposto declarado alerta; com alíquota, não', () => {
  const semAliquota = validarImposto(impostoDoEstudoAvancado({ considerar_ret: false, imposto_percentual: null }));
  assert.equal(semAliquota.length, 1);
  assert.equal(semAliquota[0].codigo, 'IMPOSTO_ZERO');
  assert.equal(semAliquota[0].severidade, 'alerta');
  assert.doesNotMatch(semAliquota[0].mensagem, /RET está marcado/);

  const retZero = validarImposto(impostoDoEstudoAvancado({ considerar_ret: true, ret_pct: 0 }));
  assert.equal(retZero.length, 1);
  assert.match(retZero[0].mensagem, /RET está marcado com alíquota zero/);

  assert.deepEqual(validarImposto(impostoDoEstudoAvancado({ considerar_ret: false, imposto_percentual: 7 })), []);
  assert.deepEqual(validarImposto(impostoDoEstudoAvancado({ considerar_ret: true, ret_pct: 4 })), []);
  // Rota com erro: a tela não leu o imposto — não é "estudo sem imposto".
  assert.deepEqual(validarImposto(impostoDoEstudoAvancado({ erro: true })), []);
  // Forma legada sem RET (`ativo: false`) também é imposto zero.
  assert.equal(validarImposto({ ativo: false, pct: 4 }).length, 1);
});

// ── Base `% da receita` com permuta física ─────────────────────────────────

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const RECEITAS = [
  { id: 1, nome: 'A', tipologias: [{ id: 11, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] } },
  { id: 2, nome: 'B', tipologias: [{ id: 12, quantidade: 5, area_privativa_m2: 50, preco_m2: 8_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] } },
];
const PERMUTA = { id: 9, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
  orcamento_unidade: 'rs', orcamento_valor: null, permuta_tipologia_id: 11, permuta_quantidade: 3 };
const PCT_RECEITA = { id: 10, grupo: 'indireto', categoria: 'Outro', orcamento_valor: 2,
  orcamento_unidade: 'pct_receita', cronograma_evento: 'customizado', inicio_mes: 0, duracao_meses: 1 };

test('#834 vgvVendavelPorLinha: a unidade permutada fica fora', () => {
  assert.deepEqual(vgvVendavelPorLinha(RECEITAS, [PERMUTA]), [7_000_000, 2_000_000]);
  assert.deepEqual(vgvVendavelPorLinha(RECEITAS, []), [10_000_000, 2_000_000]);
});

for (const params of [
  { considerar_ret: false, imposto_percentual: 6.73 },
  { considerar_ret: true, ret_pct: 4 },
]) {
  test(`#834 receitaTotalBaseCusto é a base que o motor aplica em % da receita (${params.considerar_ret ? 'RET' : 'padrão'}, com permuta física)`, () => {
    const imposto = impostoDoEstudoAvancado(params);
    const config: FluxoConfig = {
      dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 0,
      linhasReceita: RECEITAS, linhasCusto: [PERMUTA, PCT_RECEITA], areaTerreno: 0, ret: imposto,
    };
    const linha = calcularFluxo(config).linhasCusto.find((l: any) => l.id === 10)!;
    const base = receitaTotalBaseCusto(RECEITAS, [PERMUTA, PCT_RECEITA], imposto);
    assert.ok(Math.abs(linha.total - base * 0.02) <= 0.01, `motor ${linha.total} × base ${base * 0.02}`);
    assert.ok(Math.abs(base - 9_000_000 * (1 - imposto!.pct / 100)) <= 0.01);
  });
}

// ── Fiação ──────────────────────────────────────────────────────────────────

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

test('#834 fiação: o alerta de imposto zero está na lista de divergências do Fluxo e do conferir-estudo', () => {
  for (const arquivo of ['frontend/tela-fluxo-ver.ts', 'scripts/conferir-estudo.ts']) {
    const s = semComentarios(fonte(arquivo));
    assert.equal(s.split('...validarImposto(d.ret)').length - 1, 1, arquivo);
  }
  // E a lista é a única que chama: nenhuma outra tela inventa o alerta à parte.
  const telas = execFileSync('git', ['ls-files', 'frontend/tela-*.ts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => f && f !== 'frontend/tela-fluxo-ver.ts');
  for (const f of telas) assert.ok(!semComentarios(fonte(f)).includes('validarImposto('), f);
});

test('#834 fiação: a base % da receita da tela de Custos é o VGV vendável do motor, recalculada a cada leitura', () => {
  const s = semComentarios(fonte('frontend/tela-fluxo-custos.ts'));
  assert.ok(s.includes('vgvVendavelPorLinha(this.linhasReceita, this.custos)'));
  assert.ok(/_ctxBase\(\): ContextoCusto \{\s*return \{ \.\.\.this\.ctxCusto, receitaTotal: this\._receitaTotal\(\)/.test(s));
  assert.ok(s.includes('receita: this._receitaTotal(),'), 'a conversão por badge usa a mesma base');
  assert.ok(!/receitaTotal:\s*linhas\.reduce/.test(s), 'a base voltou a ser calculada só na carga');
});

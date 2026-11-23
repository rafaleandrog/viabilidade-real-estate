import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { impostoDoEstudoAvancado, receitaLiquidaLinha } from './fluxo-shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// #834 — o imposto do Avançado tem dois regimes, e nenhum deles é "zero"
// ─────────────────────────────────────────────────────────────────────────────
//
// Decisão do dono (2026-11-22): imposto padrão (a alíquota informada no
// estudo, `estudos.imposto_percentual`) ou RET (`estudos.ret_pct`, padrão 4 %).
// Antes, fora do RET o motor deduzia zero, sem aviso. A base continua sendo a
// receita recebida, mês a mês, nos dois regimes.
//
// Três camadas: o resolvedor (tradução dos parâmetros da rota), o motor (o
// número que sai) e a FIAÇÃO — toda tela que monta `FluxoConfig` passa pelo
// resolvedor (classe de defeito nº 1 do `CLAUDE.md`: apagar a passagem numa
// tela deixa o resto da suíte verde, então a trava aqui é de inventário).

// ── 1. Resolvedor ───────────────────────────────────────────────────────────

test('#834 resolvedor: RET marcado → regime ret com ret_pct', () => {
  assert.deepEqual(
    impostoDoEstudoAvancado({ considerar_ret: true, ret_pct: 4, imposto_percentual: 7 }),
    { regime: 'ret', ativo: true, pct: 4 },
  );
  // A rota devolve decimal do Postgres como string em instâncias antigas.
  assert.deepEqual(
    impostoDoEstudoAvancado({ considerar_ret: true, ret_pct: '6.73' }),
    { regime: 'ret', ativo: true, pct: 6.73 },
  );
  // RET sem alíquota gravada: o padrão de 4 % do RET.
  assert.deepEqual(impostoDoEstudoAvancado({ considerar_ret: true }), { regime: 'ret', ativo: true, pct: 4 });
});

test('#834 resolvedor: fora do RET → imposto padrão com imposto_percentual, nunca zero calado', () => {
  assert.deepEqual(
    impostoDoEstudoAvancado({ considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73 }),
    { regime: 'padrao', ativo: true, pct: 6.73 },
  );
  assert.deepEqual(
    impostoDoEstudoAvancado({ considerar_ret: false, imposto_percentual: '7.00' }),
    { regime: 'padrao', ativo: true, pct: 7 },
  );
  // Sem alíquota gravada (ou ilegível): 0 declarado como regime padrão —
  // o alerta de imposto zero lê esse estado; nenhum padrão é inventado aqui.
  for (const v of [null, undefined, '', 'abc', -1]) {
    assert.deepEqual(
      impostoDoEstudoAvancado({ considerar_ret: false, imposto_percentual: v }),
      { regime: 'padrao', ativo: true, pct: 0 },
      `imposto_percentual=${String(v)}`,
    );
  }
});

test('#834 resolvedor: rota com erro → undefined (o motor não deduz nada, como antes)', () => {
  assert.equal(impostoDoEstudoAvancado(undefined), undefined);
  assert.equal(impostoDoEstudoAvancado(null), undefined);
  assert.equal(impostoDoEstudoAvancado({ erro: true, mensagem: 'x' }), undefined);
  assert.equal(impostoDoEstudoAvancado({ _http: 500 }), undefined);
});

test('#834 base de custo (% da receita): o imposto padrão também deduz', () => {
  const padrao = impostoDoEstudoAvancado({ considerar_ret: false, imposto_percentual: 7 });
  assert.ok(Math.abs(receitaLiquidaLinha(1_000_000, padrao) - 930_000) < 1e-6);
  const ret = impostoDoEstudoAvancado({ considerar_ret: true, ret_pct: 4 });
  assert.ok(Math.abs(receitaLiquidaLinha(1_000_000, ret) - 960_000) < 1e-6);
});

// ── 2. Motor ────────────────────────────────────────────────────────────────

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const BASE: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
  linhasReceita: [{
    id: 1, nome: 'Grupo Residencial', fase_label: 'Torre A',
    tipologias: [{ id: 11, nome: 'Lote', quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 80 }, { mes: 41, pct: 20 }] },
    fluxo_pagamento: { componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 0, rotulo: 'À vista' },
      { tipo: 'prazo_fixo', participacaoPct: 40, sinalPct: 0, prazoMeses: 24,
        defasagemMeses: 1, taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'Curta' },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
    ] },
  }],
  linhasCusto: [
    { id: 1, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 3, orcamento_unidade: 'pct_receita', inicio_mes: 0, duracao_meses: 12 },
  ],
  areaTerreno: 0,
};

const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const comImposto = (params: any): FluxoConfig => ({ ...BASE, ret: impostoDoEstudoAvancado(params) });

test('#834 motor: fora do RET com alíquota X, deduz X % da receita recebida', () => {
  const c = calcularFluxo(comImposto({ considerar_ret: false, imposto_percentual: 6.73 }));
  const deduzido = c.receitaBruta - soma(c.receitaMensal);
  // Mês a mês arredondado a centavo: tolerância de um centavo por mês.
  assert.ok(Math.abs(deduzido - c.receitaBruta * 0.0673) <= c.prazo * 0.01,
    `deduzido ${deduzido} × esperado ${c.receitaBruta * 0.0673}`);
  assert.ok(deduzido > 0);
});

test('#834 motor: "sem RET" deixou de ser imposto zero — o regime padrão deduz a alíquota do estudo', () => {
  const zero = calcularFluxo({ ...BASE, ret: undefined });
  const padrao = calcularFluxo(comImposto({ considerar_ret: false, imposto_percentual: 7 }));
  assert.ok(soma(padrao.receitaMensal) < soma(zero.receitaMensal));
  assert.ok(padrao.fluxoAcumulado.at(-1)! < zero.fluxoAcumulado.at(-1)!);
  // A Receita Bruta (antes do imposto) não muda; só o líquido.
  assert.equal(padrao.receitaBruta, zero.receitaBruta);
});

test('#834 motor: com RET, o resultado é exatamente o de antes (regressão)', () => {
  // `{ ativo: true, pct: 4 }` é a forma que toda tela montava antes da #834.
  const antes = calcularFluxo({ ...BASE, ret: { ativo: true, pct: 4 } });
  const agora = calcularFluxo(comImposto({ considerar_ret: true, ret_pct: 4, imposto_percentual: 7 }));
  assert.deepEqual(agora.receitaMensal, antes.receitaMensal);
  assert.deepEqual(agora.fluxoMensal, antes.fluxoMensal);
  assert.deepEqual(agora.fluxoAcumulado, antes.fluxoAcumulado);
  assert.equal(agora.receitaBruta, antes.receitaBruta);
});

test('#834 motor: a alíquota padrão também move a base `% da receita` dos custos', () => {
  const zero = calcularFluxo(comImposto({ considerar_ret: false, imposto_percentual: 0 }));
  const sete = calcularFluxo(comImposto({ considerar_ret: false, imposto_percentual: 7 }));
  const custo = (c: ReturnType<typeof calcularFluxo>) => soma(c.custoMensal);
  assert.ok(Math.abs(custo(sete) - custo(zero) * 0.93) <= 0.05, `${custo(sete)} × ${custo(zero) * 0.93}`);
});

// ── 3. Fiação: toda tela que monta `FluxoConfig` passa pelo resolvedor ─────

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const fonte = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

// Fonte VERSIONADA (armadilha 1 da Rodada 10): nunca varrer o disco.
const telas = execFileSync('git', ['ls-files', 'frontend/tela-*.ts'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter((f) => f && !f.endsWith('.test.ts'));

const TELAS_COM_FLUXO = [
  'frontend/tela-analise-mercado.ts',
  'frontend/tela-cenarios.ts',
  'frontend/tela-dashboard.ts',
  'frontend/tela-fluxo-custos.ts',
  'frontend/tela-fluxo-ver.ts',
  'frontend/tela-funding.ts',
  'frontend/tela-resumo.ts',
];

test('#834 fiação: o inventário de telas que calculam o fluxo é o conhecido', () => {
  const achadas = telas.filter((f) => semComentarios(fonte(f)).includes('calcularFluxo(')).sort();
  assert.deepEqual(achadas, [...TELAS_COM_FLUXO].sort(),
    'tela nova que calcula o fluxo precisa entrar nesta lista — e passar o imposto pelo resolvedor');
});

for (const arquivo of TELAS_COM_FLUXO) {
  test(`#834 fiação: ${arquivo} resolve o imposto por impostoDoEstudoAvancado, uma vez`, () => {
    const s = semComentarios(fonte(arquivo));
    assert.equal(s.split('impostoDoEstudoAvancado(params)').length - 1, 1,
      'a tela tem que chamar o resolvedor com os parâmetros do estudo');
    // A forma antiga (`ret: … { ativo: params.considerar_ret === true, … }`)
    // zerava o imposto fora do RET. O rascunho do controle RET em Custos lê
    // `considerar_ret` à parte, e isso é legítimo: ele não vai ao motor.
    assert.ok(!/\bret:[^\n]*params\.considerar_ret/.test(s), 'FluxoConfig.ret remontado à mão a partir de considerar_ret');
  });
}

test('#834 fiação: Custos alimenta motor e base de custo com o imposto resolvido, não com o rascunho do RET', () => {
  const s = semComentarios(fonte('frontend/tela-fluxo-custos.ts'));
  assert.ok(/\bret:\s*this\.imposto\b/.test(s), 'FluxoConfig.ret tem que ser this.imposto');
  assert.ok(/receitaLiquidaLinha\([^)]*\),\s*this\.imposto\)/.test(s), 'ctxCusto.receitaTotal tem que usar this.imposto');
  assert.ok(!/\bret:\s*this\.ret\b/.test(s));
  assert.ok(!/receitaLiquidaLinha\([^)]*\),\s*this\.ret\)/.test(s));
});

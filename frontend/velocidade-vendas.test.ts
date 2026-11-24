// #971: velocidade de vendas dos cenários do Avançado (opção B do dono):
// vende-se (1 + v) vezes mais por mês, e o prazo de vendas vira prazo ÷ (1 + v).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absorcaoMensal, curvaComVelocidade, janelaVendasDaCurva, velocidadeVendasValida, absorcaoComVelocidade,
  VELOCIDADE_VENDAS_MIN, VELOCIDADE_VENDAS_MAX,
} from './fluxo-shared.js';
import { calcularFluxo, aplicarCenario, type FluxoConfig } from './fluxo-caixa-motor.js';
import { validarFluxoCalc } from './fluxo-invariantes.js';
// Um estudo qualquer com receita, custo e cronograma: os testes comparam contas
// do motor entre si (com e sem velocidade), nunca contra um número fixo.
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS } from './render/casos/dados.js';

const soma = (ms: { pct: number }[]) => ms.reduce((s, m) => s + m.pct, 0);
const quase = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

// Curva personalizada de 10 meses a 10%, vendendo do mês 12 ao 21.
const DEZ_MESES = { modo: 'personalizado', meses: Array.from({ length: 10 }, (_, i) => ({ mes: 12 + i, pct: 10 })) };

const DISTRIBUIDA = {
  modo: 'distribuido', pos_chaves_meses: 6,
  blocos: [{ evento: 'pre_lancamento', pct: 0 }, { evento: 'lancamento', pct: 30 }, { evento: 'obra', pct: 50 }],
};

// Plano de pagamento canônico (por componentes), com juros de carteira: vender
// antes ou depois das chaves muda quanto passa pela carteira, como no app.
const PAGAMENTO = { componentes: [
  { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
  { tipo: 'prazo_fixo', participacaoPct: 50, prazoMeses: 24, defasagemMeses: 1, sinalPct: 0 },
  { tipo: 'carteira_pos_marco', participacaoPct: 30, marcoMes: 36, carenciaMeses: 0, prazoMeses: 60 },
] };

function config(absorcao: any): FluxoConfig {
  return {
    dataInicio: DATA_INICIO, taxaDescontoAa: 12, jurosTabelaAaEstudo: 12, cronograma: CRONO,
    linhasReceita: [{ ...RECEITAS[0], absorcao, fluxo_pagamento: PAGAMENTO }], linhasCusto: CUSTOS, curvas: [], areaTerreno: 4_800,
    ret: { ativo: true, pct: 4 },
  } as FluxoConfig;
}

test('velocidadeVendasValida: só número finito de −90% a +500% (a mesma faixa da API)', () => {
  for (const v of [0, 50, -50, -90, 300, 500]) assert.equal(velocidadeVendasValida(v), true, String(v));
  for (const v of [-90.01, -100, -150, 500.01, NaN, Infinity, '10', null, undefined]) assert.equal(velocidadeVendasValida(v), false, String(v));
  assert.equal(VELOCIDADE_VENDAS_MIN, -90);
  assert.equal(VELOCIDADE_VENDAS_MAX, 500);
});

test('curvaComVelocidade: com 0 ou velocidade inválida devolve a MESMA curva, sem trocar a referência', () => {
  for (const v of [0, -100, -200, NaN]) assert.equal(curvaComVelocidade(DEZ_MESES, CRONO, v), DEZ_MESES, String(v));
  assert.deepEqual(absorcaoComVelocidade({ absorcao: DEZ_MESES }, CRONO, 0), {});
});

test('curvaComVelocidade: +50% vende 15%/mês e o prazo vai de 10 para 6,67 meses (último mês parcial)', () => {
  const c = curvaComVelocidade(DEZ_MESES, CRONO, 50);
  assert.equal(c.modo, 'personalizado');
  assert.equal(c.janelaLivre, true);
  assert.deepEqual(c.meses.map((m: any) => m.mes), [12, 13, 14, 15, 16, 17, 18]);
  for (const m of c.meses.slice(0, 6)) assert.ok(quase(m.pct, 15), String(m.pct));
  assert.ok(quase(c.meses[6].pct, 10));
  assert.ok(quase(soma(c.meses), 100));
});

test('curvaComVelocidade: −50% vende 5%/mês por 20 meses, a partir do mesmo mês', () => {
  const c = curvaComVelocidade(DEZ_MESES, CRONO, -50);
  assert.equal(c.meses.length, 20);
  assert.equal(c.meses[0].mes, 12);
  for (const m of c.meses) assert.ok(quase(m.pct, 5), String(m.pct));
  assert.equal(soma(c.meses), 100);
});

test('curvaComVelocidade: curva não uniforme mantém a forma — o acumulado nas mesmas frações do prazo é o mesmo', () => {
  const base = [2, 3, 25, 15, 10, 8, 7, 6, 6, 6, 6, 6];
  const curva = { modo: 'personalizado', meses: base.map((pct, i) => ({ mes: 12 + i, pct })) };
  const ac = (ms: number[], ate: number) => ms.slice(0, ate).reduce((s, x) => s + x, 0);
  // +100%: o prazo cai à metade; o acumulado no mês j novo = o do mês 2j da base.
  const rapido = curvaComVelocidade(curva, CRONO, 100).meses.map((m: any) => m.pct);
  assert.equal(rapido.length, 6);
  for (const j of [1, 2, 3, 6]) assert.ok(quase(ac(rapido, j), ac(base, 2 * j)), `mês ${j}`);
  // −50%: o prazo dobra; o acumulado no mês 2j novo = o do mês j da base.
  const lento = curvaComVelocidade(curva, CRONO, -50).meses.map((m: any) => m.pct);
  assert.equal(lento.length, 24);
  for (const j of [1, 3, 6, 12]) assert.ok(quase(ac(lento, 2 * j), ac(base, j)), `mês ${j}`);
});

test('curvaComVelocidade: ancora na PRIMEIRA venda — meses iniciais sem venda não atrasam o início', () => {
  const base = absorcaoMensal(DISTRIBUIDA, CRONO)!;
  const primeiraBase = base.inicio + base.pcts.findIndex((x) => x > 0);
  assert.ok(primeiraBase > base.inicio, 'a fixture precisa ter meses vazios no começo da janela');
  for (const v of [-50, 50]) {
    const c = curvaComVelocidade(DISTRIBUIDA, CRONO, v);
    assert.equal(c.meses[0].mes, primeiraBase, `v=${v}`);
    assert.ok(c.meses[0].pct > 0, `v=${v}`);
  }
});

test('janelaVendasDaCurva: só a curva de cenário muda a janela, e ela termina na última venda', () => {
  const periodo = { inicio: 6, fim: 48 };
  assert.equal(janelaVendasDaCurva(DEZ_MESES, periodo), periodo);
  assert.equal(janelaVendasDaCurva({ ...DEZ_MESES, janelaLivre: 'sim' }, periodo), periodo);
  assert.deepEqual(janelaVendasDaCurva({ ...DEZ_MESES, janelaLivre: true }, periodo), { inicio: 6, fim: 21 });
  const longa = curvaComVelocidade(DEZ_MESES, CRONO, -90);
  assert.deepEqual(janelaVendasDaCurva(longa, periodo), { inicio: 6, fim: 12 + 99 });
  assert.equal(janelaVendasDaCurva(DEZ_MESES, null), null);
});

for (const [nome, absorcao] of [['linear (enche a janela)', { modo: 'linear' }], ['distribuída', DISTRIBUIDA]] as const) {
  test(`#971 motor, curva ${nome}: com 0% o cenário é o estudo; com qualquer velocidade nenhuma venda se perde`, () => {
    const cfg = config(absorcao);
    const real = calcularFluxo(cfg);
    const zero = calcularFluxo(aplicarCenario(cfg, { precoVendaPct: 0, custoObraPct: 0, velocidadeVendasPct: 0 }));
    assert.deepEqual(zero, real);
    assert.deepEqual(validarFluxoCalc(real), []);
    for (const v of [-50, -20, 20, 50, 100]) {
      const cenario = aplicarCenario(cfg, { precoVendaPct: 0, custoObraPct: 0, velocidadeVendasPct: v });
      const abs = absorcaoMensal(cenario.linhasReceita[0].absorcao, CRONO)!;
      assert.equal(abs.pctDescartado, 0, `v=${v}: venda fora da janela`);
      const c = calcularFluxo(cenario);
      assert.deepEqual(validarFluxoCalc(c), [], `v=${v}: o cálculo do cenário tem divergência interna`);
      // Mesmas vendas: só o tempo muda. (A receita RECEBIDA muda com os juros de
      // carteira, que dependem de quando se vende — o que se conserva é o contratado.)
      // Cada safra mensal é arredondada ao centavo: até um centavo por mês de venda.
      const mesesVenda = abs.pcts.filter((x) => x !== 0).length;
      assert.ok(quase(c.vendaBrutaContratada, real.vendaBrutaContratada, 0.01 * mesesVenda),
        `v=${v}: contratado ${c.vendaBrutaContratada} × ${real.vendaBrutaContratada} (${mesesVenda} meses)`);
      assert.ok(quase(c.vgvTotal, real.vgvTotal, 0.005), `v=${v}`);
    }
  });

  test(`#971 motor, curva ${nome}: vender mais rápido melhora VPL, TIR e exposição; mais devagar piora`, () => {
    const cfg = config(absorcao);
    const r = [-50, -20, 0, 20, 50].map((v) => calcularFluxo(aplicarCenario(cfg, { precoVendaPct: 0, custoObraPct: 0, velocidadeVendasPct: v })));
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i].vpl > r[i - 1].vpl, `VPL ${i}`);
      assert.ok((r[i].tir ?? -Infinity) > (r[i - 1].tir ?? -Infinity), `TIR ${i}`);
      assert.ok(Math.abs(r[i].exposicaoMaxima) < Math.abs(r[i - 1].exposicaoMaxima), `exposição ${i}`);
    }
  });
}

test('#971 motor: a velocidade só troca a curva de vendas — preço e custo do cenário continuam valendo juntos', () => {
  const cfg = config(DISTRIBUIDA);
  const so = aplicarCenario(cfg, { precoVendaPct: 10, custoObraPct: 5, velocidadeVendasPct: 0 });
  const com = aplicarCenario(cfg, { precoVendaPct: 10, custoObraPct: 5, velocidadeVendasPct: 30 });
  assert.deepEqual(com.linhasReceita[0].tipologias, so.linhasReceita[0].tipologias);
  assert.deepEqual(com.linhasCusto, so.linhasCusto);
  assert.notDeepEqual(com.linhasReceita[0].absorcao, so.linhasReceita[0].absorcao);
  assert.equal(so.linhasReceita[0].absorcao, DISTRIBUIDA);
});

// Achado P2 do App do Codex (PR 978, rodada 6): com velocidade positiva o
// cenário termina antes do estudo; agregado pelos períodos do estudo (mais
// longo), o acumulado do cenário saía 0 nos anos depois do seu fim.
import { agregarFluxoPorPeriodos } from './fluxo-caixa-motor.js';
import { periodosAnuais } from './fluxo-shared.js';
import { readFileSync } from 'node:fs';

test('#971 Anual: o cenário mais curto, agregado pelo próprio prazo, fecha no acumulado final dele', () => {
  const cfg = config(DISTRIBUIDA);
  const real = calcularFluxo(cfg);
  const rapido = calcularFluxo(aplicarCenario(cfg, { precoVendaPct: 0, custoObraPct: 0, velocidadeVendasPct: 100 }));
  assert.ok(rapido.prazo < real.prazo, `o cenário precisa ser mais curto (${rapido.prazo} × ${real.prazo})`);
  const final = rapido.fluxoAcumulado[rapido.fluxoAcumulado.length - 1];
  const proprio = agregarFluxoPorPeriodos(rapido, periodosAnuais(DATA_INICIO, rapido.prazo)!);
  assert.equal(proprio.fluxoAcumulado[proprio.fluxoAcumulado.length - 1], final);
  // A armadilha: pelos períodos do estudo, o último ano do cenário sai 0.
  const doEstudo = agregarFluxoPorPeriodos(rapido, periodosAnuais(DATA_INICIO, real.prazo)!);
  assert.notEqual(doEstudo.fluxoAcumulado[doEstudo.fluxoAcumulado.length - 1], final);
  // Fiação: a tabela de Cenários agrega pelo prazo do próprio cenário.
  const tela = readFileSync(new URL('./tela-cenarios.ts', import.meta.url), 'utf8');
  assert.match(tela, /const periodosCenario = this\._periodos\(cenario\.prazo\);/);
  assert.match(tela, /agregarFluxoPorPeriodos\(cenario, periodosCenario\)/);
  assert.match(tela, /this\._fundingDe\(cenario, periodosCenario\)/);
});

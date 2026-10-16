// #850 — saldo de chaves dividido entre repasse bancário e carteira própria.
//
// O que estes testes provam, na ordem do critério de aceite da issue:
//  1. plano sem o campo (ou com 100% banco) produz EXATAMENTE os componentes
//     de antes — nenhum número muda em estudo existente;
//  2. a divisão do saldo, o 1º vencimento e a Price da carteira própria;
//  3. a venda Após-chaves continua financiada quando há carteira;
//  4. as invariantes de carteira (nunca negativa, zera no fim);
//  5. a fronteira de escrita aceita e valida o tipo novo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calcularFluxo, calcularRecebiveisComponentes, componentesDoLegado, componentesPagamento, consolidarCarteiraClientes, componentesEfetivosSafra,
  destinoSaldoChaves, pctRepasseDerivado, pagamentosCarteiraPosMarco, pagamentosConcentrado, pmt, primeiroVencimentoCarteira,
  taxaMensalDeAnual, ultimoMesRecebivelLinha, type ComponentePagamento,
} from './fluxo-caixa-motor.js';
import { validarComponentesSafra, validarFluxoCalc, validarSafrasReceita } from './fluxo-invariantes.js';
import { erroComponentePagamento, erroDestinoSaldoChaves } from './fluxo-pagamento-contrato.js';
import {
  erroFormularioPagamento, fluxoPagamentoParaSalvar, formularioPagamento, planoSoCanonico,
} from './fluxo-pagamento-editor.js';
import type { EventoCrono } from './fluxo-shared.js';

const CRONO: EventoCrono[] = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 3 },
  { evento: 'obra', inicio_mes: 3, duracao_meses: 20 }, // fim da obra = mês 22
  { evento: 'pos_obra', inicio_mes: 23, duracao_meses: 12 },
];
const FIM_OBRA = 22;
const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const perto = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

/** O espelho legado de um plano: 30% entrada à vista, 70% de saldo de chaves. */
const plano = (repasse: Record<string, number> = {}) => ({
  entrada: [{ pct: 30, parcelas: 1, descontoPct: 0 }],
  parcelas: [],
  repasse: { apos_entrega_meses: 0, ...repasse },
});

test('#850 critério 1: sem `pct_banco` o adaptador produz o mesmo plano de antes (100% banco)', () => {
  const semCampo = componentesDoLegado(plano(), CRONO, 12);
  const banco100 = componentesDoLegado(plano({ pct_banco: 100, carteira_parcelas: 120 }), CRONO, 12);
  assert.deepEqual(semCampo, banco100);
  assert.equal(semCampo.length, 2);
  assert.equal(semCampo[1].tipo, 'concentrado');
  assert.equal(semCampo[1].participacaoPct, 70);
  assert.equal(semCampo.some((c) => c.tipo === 'carteira_pos_marco'), false);
});

test('#850 critério 2: saldo 70% com repasse de 60% → 42% banco e 28% carteira própria', () => {
  const comps = componentesDoLegado(plano({ pct_banco: 60, carteira_parcelas: 120, carteira_carencia_meses: 0 }), CRONO, 12);
  const banco = comps.find((c) => c.tipo === 'concentrado')!;
  const carteira = comps.find((c) => c.tipo === 'carteira_pos_marco')!;
  assert.equal(banco.participacaoPct, 42);
  assert.equal(carteira.participacaoPct, 28);
  assert.equal(soma(comps.map((c) => c.participacaoPct)), 100);
  assert.ok(carteira.tipo === 'carteira_pos_marco');
  assert.equal(carteira.marcoMes, FIM_OBRA);
  assert.equal(carteira.prazoMeses, 120);
  assert.equal(carteira.taxaMensal, taxaMensalDeAnual(12));
  // 0% banco: o saldo inteiro vira carteira, sem `concentrado` — o loteamento sem banco.
  const lote = componentesDoLegado(plano({ pct_banco: 0, carteira_parcelas: 180 }), CRONO, 12);
  assert.equal(lote.some((c) => c.tipo === 'concentrado'), false);
  assert.equal(lote.find((c) => c.tipo === 'carteira_pos_marco')!.participacaoPct, 70);
});

const carteira = (over: Partial<Extract<ComponentePagamento, { tipo: 'carteira_pos_marco' }>> = {}) => ({
  tipo: 'carteira_pos_marco' as const, participacaoPct: 100, marcoMes: FIM_OBRA,
  carenciaMeses: 0, prazoMeses: 12, taxaMensal: 0.01, ...over,
});

test('#850 critério 2: 1º vencimento após a entrega e a carência; Price sobre o saldo capitalizado', () => {
  const c = carteira({ carenciaMeses: 6 });
  assert.equal(primeiroVencimentoCarteira(c, 5), FIM_OBRA + 1 + 6);
  const pags = pagamentosCarteiraPosMarco(c, 5, 100_000);
  assert.equal(pags.length, 12);
  assert.equal(pags[0].mes, FIM_OBRA + 7);
  assert.equal(pags[11].mes, FIM_OBRA + 18);
  // Capitaliza da safra (5) até o mês anterior ao 1º vencimento (28): 23 meses.
  const capitalizado = 100_000 * Math.pow(1.01, 23);
  const parcela = Math.round(pmt(0.01, 12, capitalizado) * 100) / 100;
  assert.equal(pags[0].valor, parcela);
  assert.ok(perto(soma(pags.map((p) => p.valor)), pmt(0.01, 12, capitalizado) * 12));
});

test('#850: carteira de 1 parcela no mês M paga o mesmo que um repasse concentrado em M', () => {
  const c = carteira({ prazoMeses: 1 });
  const conc = pagamentosConcentrado(
    { tipo: 'concentrado', participacaoPct: 100, mesPagamento: FIM_OBRA + 1, taxaMensal: 0.01 }, 4, 50_000);
  const cart = pagamentosCarteiraPosMarco(c, 4, 50_000);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].mes, conc[0].mes);
  assert.equal(cart[0].valor, conc[0].valor);
});

test('#850 critério 3: venda Após-chaves com carteira é financiada a partir de s + 1; sem carteira, à vista', () => {
  const comps = componentesDoLegado(plano({ pct_banco: 60, carteira_parcelas: 120 }), CRONO, 12);
  const safra = FIM_OBRA + 5;
  const efetivos = componentesEfetivosSafra(comps, safra, FIM_OBRA);
  const cart = efetivos.find((c) => c.tipo === 'carteira_pos_marco')!;
  const vista = efetivos.find((c) => c.tipo === 'imediato')!;
  assert.equal(cart.participacaoPct, 28);
  assert.equal(vista.participacaoPct, 72);
  assert.ok(cart.tipo === 'carteira_pos_marco');
  assert.equal(primeiroVencimentoCarteira(cart, safra), safra + 1);

  const semCarteira = componentesDoLegado(plano(), CRONO, 12);
  assert.deepEqual(componentesEfetivosSafra(semCarteira, safra, FIM_OBRA),
    [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }]);
});

test('#850 critério 4: carteira consolidada zera na última parcela, nunca negativa, juros reconciliam', () => {
  const comps = componentesDoLegado(plano({ pct_banco: 60, carteira_parcelas: 24, carteira_carencia_meses: 3 }), CRONO, 12);
  const contratacoes = [
    { safra: 2, valorContratado: 1_000_000 },
    { safra: 10, valorContratado: 500_000 },
    { safra: FIM_OBRA + 4, valorContratado: 300_000 }, // Após-chaves
  ];
  const prazo = FIM_OBRA + 4 + 1 + 24 + 2;
  const r = calcularRecebiveisComponentes(comps, contratacoes, FIM_OBRA, prazo);
  assert.ok(r.carteiraMensal.every((v) => v >= -0.01), 'carteira negativa');
  assert.ok(perto(r.carteiraMensal[r.carteiraMensal.length - 1], 0), 'carteira não zera no fim');
  // Repasse bancário num mês só: o da entrega + 1.
  const mesesRepasse = r.repasseMensal.map((v, m) => ({ v, m })).filter((x) => x.v > 0.01);
  assert.deepEqual(mesesRepasse.map((x) => x.m), [FIM_OBRA + 1]);
  // Receita bruta = principal + juros, mês a mês, e o principal nunca é negativo.
  r.recebimentoBrutoMensal.forEach((v, m) => assert.ok(perto(v, r.principalRecebidoMensal[m] + r.jurosMensal[m]), `mês ${m}`));
  assert.ok(r.principalRecebidoMensal.every((v) => v >= -0.01), 'principal negativo em algum mês');
  // Principal total = valor contratado inteiro.
  assert.ok(perto(soma(r.principalRecebidoMensal), 1_800_000, 0.5));
  assert.ok(soma(r.receitaPorComponenteMensal.carteiraPropria) > 0);
  assert.ok(r.carteiraPorComponenteMensal.carteiraPropria.some((v) => v > 0));
  assert.ok(soma(r.jurosMensal) > 0);
  // Carteira máxima enxerga a carteira própria (a série por componente cabe dentro do total).
  r.carteiraPorComponenteMensal.carteiraPropria.forEach((v, m) => assert.ok(v <= r.carteiraMensal[m] + 0.01));
  // Invariantes por safra: a capitalização até o 1º vencimento não é "carteira ressurge".
  for (const ct of contratacoes) {
    const efetivos = componentesEfetivosSafra(comps, ct.safra, FIM_OBRA);
    assert.deepEqual(validarComponentesSafra(efetivos, ct.safra, ct.valorContratado), [], `safra ${ct.safra}`);
  }
});

test('#850: o horizonte do fluxo cobre a última parcela da carteira, inclusive da última venda', () => {
  const linha = {
    id: 1, nome: 'Lotes', tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 300, preco_m2: 1_000 }],
    absorcao: { modo: 'linear', pos_chaves_meses: 6 },
    fluxo_pagamento: fluxoPagamentoParaSalvar(
      formularioPagamento(plano({ pct_banco: 0, carteira_parcelas: 120, carteira_carencia_meses: 0 })), CRONO, 12),
  };
  const ultimo = ultimoMesRecebivelLinha(linha, CRONO, 12);
  assert.ok(ultimo >= FIM_OBRA + 1 + 120 - 1, `horizonte ${ultimo} não cobre a carteira`);
  const r = calcularFluxo({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 12,
    linhasReceita: [linha], linhasCusto: [], areaTerreno: 0,
  });
  assert.ok(r.prazo > ultimo);
  assert.ok(perto(r.carteiraClientesMensal[r.prazo - 1], 0), 'carteira não zera no fim do horizonte');
  assert.ok(r.carteiraClientesMaxima > 0);
  assert.equal(soma(r.repasseMensal), 0, '0% banco não pode gerar repasse');
  assert.deepEqual(validarFluxoCalc(r).filter((d) => d.severidade === 'erro'), []);
  assert.deepEqual(validarSafrasReceita([linha], CRONO, r.prazo, undefined, [], 12)
    .filter((d) => d.severidade === 'erro'), []);
});

test('#850 critério 5: a fronteira de escrita aceita a carteira e recusa âncora inválida', () => {
  assert.equal(erroComponentePagamento(carteira()), null);
  assert.match(erroComponentePagamento(carteira({ prazoMeses: 0 }))!, /prazoMeses/);
  assert.match(erroComponentePagamento(carteira({ carenciaMeses: -1 }))!, /carenciaMeses/);
  assert.match(erroComponentePagamento({ ...carteira(), carenciaMeses: undefined })!, /carenciaMeses/);
  assert.match(erroComponentePagamento(carteira({ marcoMes: 1.5 }))!, /marcoMes/);
});

test('#850: o formulário valida o destino do saldo e o plano gravado sobrevive à releitura', () => {
  const form = formularioPagamento(plano({ pct_banco: 50, carteira_parcelas: 0 }));
  assert.match(erroFormularioPagamento(form, CRONO)!, /carteira própria/);
  const forma = formularioPagamento(plano({ pct_banco: 120 }));
  assert.match(erroFormularioPagamento(forma, CRONO)!, /repasse bancário/);
  const ok = formularioPagamento(plano({ pct_banco: 50, carteira_parcelas: 60, carteira_carencia_meses: 2 }));
  assert.equal(erroFormularioPagamento(ok, CRONO), null);
  const gravado = fluxoPagamentoParaSalvar(ok, CRONO, 12);
  assert.deepEqual(destinoSaldoChaves(gravado), { pctBanco: 50, prazoMeses: 60, carenciaMeses: 2 });
  const cart = gravado.componentes.find((c) => c.tipo === 'carteira_pos_marco')!;
  // O formulário de um plano sem `componentes` nasce com o parcelamento
  // padrão; a carteira é metade do saldo que sobrar, qualquer que ele seja.
  assert.ok(perto(cart.participacaoPct, pctRepasseDerivado(ok) / 2, 1e-9));
  assert.ok(cart.tipo === 'carteira_pos_marco');
  assert.equal(cart.carenciaMeses, 2);
  // Reabrir e reaplicar sem mudar nada preserva o plano (o caso 2 de `componentesParaSalvar`).
  const reaplicado = fluxoPagamentoParaSalvar(formularioPagamento(gravado), CRONO, 12);
  assert.deepEqual(reaplicado.componentes, gravado.componentes);
  // Plano antigo, sem o campo, não ganha `pct_banco` no Aplicar.
  const antigo = fluxoPagamentoParaSalvar(formularioPagamento(plano()), CRONO, 12);
  assert.equal('pct_banco' in antigo.repasse, false);
});

// ─── Rodada 1 da revisão do PR: um teste por bloqueante consertado ───────────

test('#850 revisão: com 100% banco a participação do repasse é a de antes, sem arredondar (percentual fracionário)', () => {
  const fracionado = {
    entrada: [{ pct: 33.333, parcelas: 1, descontoPct: 0 }],
    parcelas: [],
    repasse: { apos_entrega_meses: 0 },
  };
  const comps = componentesDoLegado(fracionado, CRONO, 12);
  const banco = comps.find((c) => c.tipo === 'concentrado')!;
  assert.equal(banco.participacaoPct, pctRepasseDerivado(fracionado), 'o repasse foi arredondado');
  assert.equal(comps.some((c) => c.tipo === 'carteira_pos_marco'), false);
  // Com pct_banco fracionado as duas partes fecham o saldo sem perder nada.
  const meio = componentesDoLegado({ ...fracionado, repasse: { pct_banco: 50, carteira_parcelas: 12 } }, CRONO, 12);
  assert.ok(perto(soma(meio.map((c) => c.participacaoPct)), 100, 1e-9));
  // Resíduo minúsculo de repasse não some.
  const minusculo = componentesDoLegado({ entrada: [{ pct: 20, parcelas: 1 }], parcelas: [{ pct: 79.996, parcelas: 10 }], repasse: {} }, CRONO, 12);
  assert.ok(perto(minusculo.find((c) => c.tipo === 'concentrado')!.participacaoPct, 0.004, 1e-9));
});

test('#850 revisão: `pct_banco` que não é número falha fechado (100% banco) e a fronteira de escrita o recusa', () => {
  for (const sujo of ['', '50', false, [], null, NaN, -1, 101, '0x10']) {
    assert.equal(destinoSaldoChaves({ repasse: { pct_banco: sujo, carteira_parcelas: 12 } }).pctBanco, 100, `pct_banco ${JSON.stringify(sujo)}`);
  }
  assert.equal(destinoSaldoChaves({ repasse: { pct_banco: 40, carteira_parcelas: '12' } }).prazoMeses, 1);
  assert.equal(destinoSaldoChaves({ repasse: [{ pct: 30 }] }).pctBanco, 100);
  for (const sujo of ['', '50', false, -1, 101]) {
    assert.ok(erroDestinoSaldoChaves({ pct_banco: sujo, carteira_parcelas: 12 }), `aceitou pct_banco ${JSON.stringify(sujo)}`);
  }
  assert.match(erroDestinoSaldoChaves({ pct_banco: 40 })!, /carteira_parcelas/);
  assert.match(erroDestinoSaldoChaves({ pct_banco: 40, carteira_parcelas: 1.5 })!, /carteira_parcelas/);
  assert.match(erroDestinoSaldoChaves({ pct_banco: 40, carteira_parcelas: 12, carteira_carencia_meses: -1 })!, /carencia/);
  assert.equal(erroDestinoSaldoChaves({ pct_banco: 40, carteira_parcelas: 12, carteira_carencia_meses: 0 }), null);
  assert.equal(erroDestinoSaldoChaves(undefined), null);
  assert.equal(erroDestinoSaldoChaves([{ pct: 30, mesesAposObra: 3 }]), null, 'repasse legado em lista');
  // O formulário NÃO converte o valor sujo em 0 — ele segue sujo até a validação recusá-lo.
  const form = formularioPagamento({ ...plano(), repasse: { pct_banco: '' } });
  assert.equal(form.repasse.pct_banco as unknown, '');
  assert.match(erroFormularioPagamento(form, CRONO)!, /repasse bancário/);
});

test('#850 revisão: carteira gravada pela API sem o espelho sobrevive ao Aplicar do modal', () => {
  const pelaApi = {
    entrada: [{ pct: 10, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 20, parcelas: 24, periodicidade: 'mensal' }],
    repasse: { apos_entrega_meses: 0 },
    componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 0 },
      { tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 24, defasagemMeses: 24, taxaMensal: 0 },
      { tipo: 'concentrado', participacaoPct: 17.5, mesPagamento: FIM_OBRA + 1, taxaMensal: 0 },
      { tipo: 'carteira_pos_marco', participacaoPct: 52.5, marcoMes: FIM_OBRA, carenciaMeses: 6, prazoMeses: 120, taxaMensal: 0 },
    ],
  };
  const form = formularioPagamento(pelaApi);
  assert.ok(perto(form.repasse.pct_banco!, 25, 1e-9));
  assert.equal(form.repasse.carteira_parcelas, 120);
  assert.equal(form.repasse.carteira_carencia_meses, 6);
  const gravado = fluxoPagamentoParaSalvar(form, CRONO, 0);
  const tipos = gravado.componentes.map((c) => c.tipo);
  assert.ok(tipos.includes('carteira_pos_marco'), `a carteira virou ${tipos.join(', ')}`);
  const cart = gravado.componentes.find((c) => c.tipo === 'carteira_pos_marco')!;
  assert.ok(perto(cart.participacaoPct, 52.5, 1e-9));
  assert.ok(cart.tipo === 'carteira_pos_marco' && cart.prazoMeses === 120 && cart.carenciaMeses === 6);
});

test('#850 revisão: plano só canônico é reconhecido, e nele o destino do saldo não é editável', () => {
  const soComponentes = formularioPagamento({
    entrada: [], parcelas: [],
    componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }],
  });
  assert.equal(planoSoCanonico(soComponentes), true);
  assert.equal(planoSoCanonico(formularioPagamento(plano())), false);
  // A tela esconde o controle nesse caso; a regra que ela usa está ligada ao template.
  const tela = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');
  assert.match(tela, /const soCanonico = planoSoCanonico\(f\);/);
  assert.match(tela, /\$\{editaDestino \? html`\s*<viab-num label="Repasse bancário"/);
});

test('#850 revisão: `consolidarCarteiraClientes` soma a carteira própria no total', () => {
  const comps: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 30, descontoPct: 0 },
    carteira({ participacaoPct: 70, prazoMeses: 6 }),
  ];
  const r = consolidarCarteiraClientes(comps, [{ safra: 3, valorContratado: 1_000 }], FIM_OBRA);
  const pico = r.mensal.find((p) => p.carteiraPropria > 0)!;
  assert.equal(pico.total, pico.carteiraPropria);
  assert.ok(r.carteiraMaxima > 700);
  assert.equal(r.mensal.at(-1)!.total, 0);
});

test('#850 revisão (rodada 2): carteiras gravadas com prazos diferentes não são fundidas no Aplicar — o modal recusa', () => {
  const duas = formularioPagamento({
    entrada: [{ pct: 30, parcelas: 1, descontoPct: 0 }], parcelas: [], repasse: { apos_entrega_meses: 0 },
    componentes: [
      { tipo: 'imediato', participacaoPct: 30, descontoPct: 0 },
      { tipo: 'carteira_pos_marco', participacaoPct: 20, marcoMes: FIM_OBRA, carenciaMeses: 0, prazoMeses: 24, taxaMensal: 0 },
      { tipo: 'carteira_pos_marco', participacaoPct: 50, marcoMes: FIM_OBRA, carenciaMeses: 6, prazoMeses: 120, taxaMensal: 0 },
    ],
  });
  assert.match(erroFormularioPagamento(duas, CRONO)!, /carteiras próprias com prazos/);
  // Duas carteiras IGUAIS cabem no espelho (somam numa só, mesmo prazo).
  const iguais = formularioPagamento({
    entrada: [{ pct: 30, parcelas: 1, descontoPct: 0 }], parcelas: [], repasse: { apos_entrega_meses: 0 },
    componentes: [
      { tipo: 'imediato', participacaoPct: 30, descontoPct: 0 },
      { tipo: 'carteira_pos_marco', participacaoPct: 20, marcoMes: FIM_OBRA, carenciaMeses: 0, prazoMeses: 24, taxaMensal: 0 },
      { tipo: 'carteira_pos_marco', participacaoPct: 50, marcoMes: FIM_OBRA, carenciaMeses: 0, prazoMeses: 24, taxaMensal: 0 },
    ],
  });
  assert.equal(erroFormularioPagamento(iguais, CRONO), null);
});

test('#850 revisão (rodada 2, App do Codex): a carteira segue a entrega VIGENTE depois do Aplicar', () => {
  const gravado = fluxoPagamentoParaSalvar(
    formularioPagamento(plano({ pct_banco: 0, carteira_parcelas: 12, carteira_carencia_meses: 2 })), CRONO, 12);
  assert.equal('ancorasVivas' in gravado, false, 'o Aplicar não deixa o plano com âncoras vivas');
  const obraMaior: EventoCrono[] = CRONO.map((e) => (e.evento === 'obra' ? { ...e, duracao_meses: 30 } : e));
  const cart = componentesPagamento(gravado, obraMaior, 12).find((c) => c.tipo === 'carteira_pos_marco')!;
  assert.ok(cart.tipo === 'carteira_pos_marco');
  assert.equal(cart.marcoMes, 3 + 30 - 1, 'a carteira ficou presa ao fim de obra antigo');
  assert.equal(primeiroVencimentoCarteira(cart, 5), 3 + 30 - 1 + 1 + 2);
});

test('#850 revisão (rodada 2, App do Codex): venda pós-entrega com carteira fracionária soma 100% exatos', () => {
  const comps = componentesDoLegado(
    { entrada: [{ pct: 33.333, parcelas: 1 }], parcelas: [], repasse: { pct_banco: 50, carteira_parcelas: 12 } }, CRONO, 12);
  const efetivos = componentesEfetivosSafra(comps, FIM_OBRA + 3, FIM_OBRA);
  assert.ok(perto(soma(efetivos.map((c) => c.participacaoPct)), 100, 1e-9));
});

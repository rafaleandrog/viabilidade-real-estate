import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularRecebiveisComponentes, carteiraSaldoSafra, componentesDoLegado, jurosSafra, pagamentosPrazoFixo,
  type ComponentePagamento,
} from './fluxo-caixa-motor.js';
import { validarComponentesSafra } from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';

// Carteira com a 1ª parcela dois ou mais meses depois da venda: o parcelamento
// legado trimestral/semestral/anual, que o adaptador traduz em `prazo_fixo`
// com `defasagemMeses` = o intervalo, ou um plano gravado pela API. A PMT é a
// de uma tabela com o 1º vencimento um período depois da venda, e a carteira
// capitaliza a carência mês a mês, então o saldo NÃO fecha no último
// vencimento. O que se exige aqui: (a) nenhum zeramento forçado esconde esse
// saldo, (b) o `CARTEIRA_NAO_ZERA` o acusa, (c) nenhum mês recebe juros
// negativos. Quem paga a carência (capitalizá-la na parcela, como a carteira
// própria faz) é convenção ainda não decidida para `prazo_fixo`/`ate_marco`.

const CRONO = [{ evento: 'obra', inicio_mes: 0, duracao_meses: 24 }] as unknown as EventoCrono[];
const JUROS_AA = 12; // % a.a., a taxa de tabela do estudo
const SAFRA = 5;
const VALOR = 100_000;
const HORIZONTE = 100;

type PrazoFixo = Extract<ComponentePagamento, { tipo: 'prazo_fixo' }>;

function legado(periodicidade: string): PrazoFixo {
  const fp = { entrada: [], parcelas: [{ pct: 100, parcelas: 4, periodicidade }] };
  const cs = componentesDoLegado(fp, CRONO, JUROS_AA);
  assert.equal(cs.length, 1, 'o plano é só o parcelamento');
  assert.equal(cs[0].tipo, 'prazo_fixo');
  return cs[0] as PrazoFixo;
}

const viaComponentes: PrazoFixo = {
  tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 4, defasagemMeses: 3,
  taxaMensal: 0.01, jurosNoMesDaContratacao: false, rotulo: 'gravado pela API',
};

const CASOS: Array<[string, () => PrazoFixo, number]> = [
  ['trimestral (legado)', () => legado('trimestral'), 3],
  ['semestral (legado)', () => legado('semestral'), 6],
  ['anual (legado)', () => legado('anual'), 12],
  ['componentes, 1ª parcela no mês +3', () => viaComponentes, 3],
];

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (s: number[]) => r2(s.reduce((a, b) => a + b, 0));

for (const [nome, fabrica, defasagem] of CASOS) {
  test(`carência sem capitalizar (${nome}): o saldo que sobra não é zerado à força`, () => {
    const c = fabrica();
    assert.equal(c.defasagemMeses, defasagem);
    assert.ok(c.taxaMensal > 0);
    const porMes = new Map<number, number>();
    for (const p of pagamentosPrazoFixo(c, SAFRA, VALOR)) porMes.set(p.mes, (porMes.get(p.mes) ?? 0) + p.valor);
    const saldos = carteiraSaldoSafra(c, SAFRA, VALOR);
    assert.equal(saldos.at(-1)!.mes, SAFRA + defasagem + 3, 'a série termina no último vencimento');
    // A recorrência da §13.6, refeita à mão: o último saldo é o que ela dá.
    let saldo = VALOR;
    assert.equal(saldos[0].saldo, saldo);
    for (let i = 1; i < saldos.length; i++) {
      saldo = r2(saldo * (1 + c.taxaMensal) - (porMes.get(saldos[i].mes) ?? 0));
      assert.equal(saldos[i].saldo, Math.max(0, saldo), `mês ${saldos[i].mes}`);
    }
    assert.ok(saldos.at(-1)!.saldo > 1, `sobra o saldo da carência: ${saldos.at(-1)!.saldo}`);
  });

  test(`carência sem capitalizar (${nome}): CARTEIRA_NAO_ZERA acusa o saldo que sobra`, () => {
    const c = fabrica();
    const r = validarComponentesSafra([c], SAFRA, VALOR).filter((d) => d.codigo === 'CARTEIRA_NAO_ZERA');
    assert.equal(r.length, 1);
    assert.equal(r[0].severidade, 'erro');
    assert.equal(r[0].encontrado, carteiraSaldoSafra(c, SAFRA, VALOR).at(-1)!.saldo);
  });

  test(`carência sem capitalizar (${nome}): nenhum mês com juros negativos, e juros + principal fecham o recebido`, () => {
    const c = fabrica();
    const r = calcularRecebiveisComponentes([c], [{ safra: SAFRA, valorContratado: VALOR }], HORIZONTE, HORIZONTE);
    r.jurosMensal.forEach((j, mes) => assert.ok(j >= 0, `juros negativos no mês ${mes}: ${j}`));
    r.principalRecebidoMensal.forEach((p, mes) => assert.ok(p >= 0, `principal negativo no mês ${mes}: ${p}`));
    const juros = jurosSafra(c, SAFRA, VALOR);
    assert.ok(juros > 0);
    assert.equal(soma(r.jurosMensal), juros);
    assert.equal(soma(r.principalRecebidoMensal), VALOR);
    assert.equal(soma(r.recebimentoBrutoMensal), r2(VALOR + juros));
  });
}

test('carência: sem ela (1ª parcela no mês seguinte) o último vencimento continua fechando em zero', () => {
  const c: PrazoFixo = { ...viaComponentes, defasagemMeses: 1 };
  assert.equal(carteiraSaldoSafra(c, SAFRA, VALOR).at(-1)!.saldo, 0);
  assert.deepEqual(validarComponentesSafra([c], SAFRA, VALOR).filter((d) => d.codigo === 'CARTEIRA_NAO_ZERA'), []);
});

test('carência com taxa zero: nada a capitalizar, a carteira fecha em zero sem acusação', () => {
  const c: PrazoFixo = { ...viaComponentes, taxaMensal: 0 };
  assert.equal(carteiraSaldoSafra(c, SAFRA, VALOR).at(-1)!.saldo, 0);
  assert.deepEqual(validarComponentesSafra([c], SAFRA, VALOR).filter((d) => d.codigo === 'CARTEIRA_NAO_ZERA'), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFluxo, calcularRecebiveisComponentes, carteiraSaldoSafra, componentesIntegradosSafra, pagamentosAteMarco,
  vendaBrutaContratadaMensal, vendaLiquidaContratadaMensal, type ComponentePagamento,
} from './fluxo-caixa-motor.js';
import {
  TOLERANCIA_PADRAO, validarComponentesSafra, validarContratacao, validarSafrasReceita,
} from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';
import { COMPONENTES_EVI, FIM_OBRA_MES } from './fixtures/evi-urbita-golden.js';

// Reconciliação da carteira de recebíveis: a parcela que vence no mês da
// contratação (#789) e os dois falsos positivos do validador (#749, porte do
// conserto do PR 751).

// Plano EVI de 25/09: 1ª parcela NO mês da venda (defasagemMeses = 0), até o fim da obra (marco 41).
const ateMarco = (defasagemMeses: number): Extract<ComponentePagamento, { tipo: 'ate_marco' }> => ({
  tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 41, defasagemMeses,
  taxaMensal: 0.0098636, jurosNoMesDaContratacao: false, rotulo: 'ao longo da obra',
});

test('#789 defasagem 0, venda no mês do marco (N_s = 1): a carteira zera no mês do pagamento', () => {
  const saldos = carteiraSaldoSafra(ateMarco(0), 41, 1_000_000);
  assert.equal(saldos.at(-1)!.mes, 41);
  assert.equal(saldos.at(-1)!.saldo, 0, 'o saldo do último vencimento deveria ser 0');
});

test('#789 validarComponentesSafra não acusa CARTEIRA_NAO_ZERA para defasagem 0 com N_s = 1', () => {
  const r = validarComponentesSafra([ateMarco(0)], 41, 1_000_000);
  assert.deepEqual(r.filter((d) => d.codigo === 'CARTEIRA_NAO_ZERA'), []);
});

test('#789 controle: defasagem 1 e N_s > 1 já zera (não deve regredir)', () => {
  assert.equal(carteiraSaldoSafra(ateMarco(1), 12, 1_000_000).at(-1)!.saldo, 0);
});

test('#789 defasagem 0, N_s > 1: o saldo do mês da contratação já desconta a amortização da 1ª parcela', () => {
  const c = ateMarco(0);
  const pagamentos = pagamentosAteMarco(c, 12, 1_000_000);
  assert.equal(pagamentos[0].mes, 12, 'a 1ª parcela vence no mês da venda');
  const saldos = carteiraSaldoSafra(c, 12, 1_000_000);
  // Convenção: saldo_{s,s} = principal × (1+taxa) − parcela_s(s) — a 1ª
  // parcela carrega um período de juros e só a amortização sai do saldo.
  const esperado = Math.round((1_000_000 * (1 + c.taxaMensal) - pagamentos[0].valor) * 100) / 100;
  assert.equal(saldos[0].mes, 12);
  assert.equal(saldos[0].saldo, esperado);
  assert.ok(saldos[0].saldo < 1_000_000, 'antes do conserto o saldo da contratação era o principal inteiro');
  // A série decresce mês a mês até zerar no último vencimento, e o penúltimo
  // saldo é a última parcela trazida a valor presente — a carteira espelha os
  // pagamentos, sem cruzar zero antes do fim.
  for (let i = 1; i < saldos.length; i++) {
    assert.ok(saldos[i].saldo < saldos[i - 1].saldo, `mês ${saldos[i].mes}: saldo deveria decrescer`);
  }
  assert.equal(saldos.at(-1)!.saldo, 0);
  const ultima = pagamentos.at(-1)!.valor;
  assert.ok(Math.abs(saldos.at(-2)!.saldo * (1 + c.taxaMensal) - ultima) < 1,
    'o penúltimo saldo capitalizado deveria liquidar a última parcela');
});

test('#789 defasagem 0: a parcela do mês da contratação leva um período de juros, coerente com a carteira', () => {
  const c = ateMarco(0);
  const r = calcularRecebiveisComponentes([c], [{ safra: 12, valorContratado: 1_000_000 }], 41, 60);
  // Recebimento intacto: é exatamente o que o motor de pagamentos já gerava.
  const pagamentos = pagamentosAteMarco(c, 12, 1_000_000);
  assert.equal(r.recebimentoBrutoMensal[12], pagamentos[0].valor);
  // Os juros dessa 1ª parcela incidem sobre o principal (o período que
  // `saldo_{s,s}` reconhece), e o resto dela é amortização.
  assert.equal(r.jurosMensal[12], Math.round(1_000_000 * c.taxaMensal * 100) / 100);
  assert.equal(
    Math.round((r.principalRecebidoMensal[12] + r.jurosMensal[12]) * 100) / 100,
    pagamentos[0].valor,
  );
  assert.equal(r.carteiraMensal[12], carteiraSaldoSafra(c, 12, 1_000_000)[0].saldo);
  // A última parcela não carrega mais o período da 1ª como resíduo: o juro
  // dela é o do saldo anterior, não um múltiplo dele.
  const saldos = carteiraSaldoSafra(c, 12, 1_000_000);
  assert.ok(Math.abs(r.jurosMensal[41] - saldos.at(-2)!.saldo * c.taxaMensal) < 1);
});

test('#789 defasagem 0 com taxa 0 (entrada parcelada do legado): saldo da contratação = principal − parcela', () => {
  const c = { ...ateMarco(0), taxaMensal: 0 };
  const saldos = carteiraSaldoSafra(c, 32, 1_000_000); // 10 parcelas de 100.000, meses 32..41
  assert.equal(saldos[0].saldo, 900_000);
  assert.equal(saldos[1].saldo, 800_000);
  assert.equal(saldos.at(-1)!.saldo, 0);
});

test('#789 concentrado pago no próprio mês da safra: zera em s, sem CARTEIRA_NAO_ZERA', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 100, mesPagamento: 10, taxaMensal: 0.01, rotulo: 'repasse',
  };
  assert.deepEqual(carteiraSaldoSafra(c, 10, 500_000), [{ safra: 10, mes: 10, saldo: 0 }]);
  assert.deepEqual(validarComponentesSafra([c], 10, 500_000), []);
});

// ── #749: CARTEIRA_RESSURGE no plano real (COMPONENTES_EVI) ────────────────

const EVI = COMPONENTES_EVI as ComponentePagamento[];

test('#749 COMPONENTES_EVI em todas as safras até o fim da obra: nenhuma divergência (o repasse capitaliza por desenho)', () => {
  // Antes do conserto, o `concentrado` (56% de repasse a 12,5% a.a.) acusava
  // CARTEIRA_RESSURGE em toda safra — o plano EVI de referência do repo.
  for (let safra = 0; safra <= FIM_OBRA_MES; safra++) {
    const efetivos = componentesIntegradosSafra(EVI, safra, FIM_OBRA_MES, 'imediato');
    assert.deepEqual(validarComponentesSafra(efetivos, safra, 1_000_000), [], `safra ${safra}`);
  }
});

test('#789/#749 plano EVI de 25/09 (1ª parcela no mês da venda) em todas as safras, inclusive a do marco: nenhuma divergência', () => {
  const plano25_09 = EVI.map((c) => (c.tipo === 'ate_marco' ? { ...c, defasagemMeses: 0 } : c));
  for (let safra = 0; safra <= FIM_OBRA_MES; safra++) {
    const efetivos = componentesIntegradosSafra(plano25_09, safra, FIM_OBRA_MES, 'imediato');
    if (safra === FIM_OBRA_MES) {
      // N_s = 1: o `ate_marco` continua parcelado (uma parcela, no próprio mês).
      assert.ok(efetivos.some((c) => c.tipo === 'ate_marco'), 'N_s = 1 não é degenerado');
    }
    assert.deepEqual(validarComponentesSafra(efetivos, safra, 1_000_000), [], `safra ${safra}`);
  }
});

test('#749 a isenção da CARTEIRA_RESSURGE é só do concentrado: a checagem continua rodando para os tipos que amortizam', () => {
  // O concentrado capitaliza por desenho e não acusa nada.
  const concentrado: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 100, mesPagamento: 15, taxaMensal: 0.01, rotulo: 'repasse',
  };
  const saldos = carteiraSaldoSafra(concentrado, 5, 100_000);
  assert.ok(saldos[1].saldo > saldos[0].saldo, 'o concentrado capitaliza');
  assert.deepEqual(validarComponentesSafra([concentrado], 5, 100_000), []);

  // Para os que amortizam, o único saldo crescente que o motor produz hoje é
  // o da carência que capitaliza (1º vencimento dois ou mais meses depois da
  // venda, com juros > 0). Esse caso é um FALSO positivo registrado na #808 e
  // fora deste conserto — aqui ele serve só para provar que a checagem não
  // foi desligada para `prazo_fixo` nem para `ate_marco`. Quando a #808 for
  // resolvida, este teste muda junto (e precisa de outro saldo crescente).
  const comCarencia: ComponentePagamento[] = [
    {
      tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 4, defasagemMeses: 3,
      taxaMensal: 0.01, jurosNoMesDaContratacao: false, rotulo: 'trimestral',
    },
    {
      tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 20, defasagemMeses: 2,
      taxaMensal: 0.01, jurosNoMesDaContratacao: false, rotulo: 'obra com carência',
    },
  ];
  for (const c of comCarencia) {
    const r = validarComponentesSafra([c], 5, 100_000);
    assert.equal(r.filter((d) => d.codigo === 'CARTEIRA_RESSURGE').length, 1, c.tipo);
  }
});

test('#789 parcela única ANTES da venda (defasagem negativa persistida): a carteira não zera no mês da venda e CARTEIRA_NAO_ZERA continua acusando', () => {
  // `ultimoMes` nasce no mês da safra; sem parcela nele, o grampo de N_s = 1
  // não pode valer — o principal não foi pago no mês da venda.
  const c: ComponentePagamento = {
    tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 1, defasagemMeses: -1,
    taxaMensal: 0.01, jurosNoMesDaContratacao: false, rotulo: 'parcela antecipada',
  };
  assert.deepEqual(carteiraSaldoSafra(c, 10, 100_000), [{ safra: 10, mes: 10, saldo: 100_000 }]);
  const r = validarComponentesSafra([c], 10, 100_000);
  assert.equal(r.filter((d) => d.codigo === 'CARTEIRA_NAO_ZERA').length, 1);
});

// ── validarSafrasReceita: não mascara mais ────────────────────────────────

const CRONO_LONGO: EventoCrono[] = [
  { evento: 'pre_lancamento', inicio_mes: 0, duracao_meses: 1 },
  { evento: 'lancamento', inicio_mes: 1, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 1, duracao_meses: 20 },
  { evento: 'pos_obra', inicio_mes: 21, duracao_meses: 12 },
];
const MES_ENTREGA = 20;
const ABSORCAO_2_A_8 = {
  modo: 'personalizado',
  meses: [2, 3, 4, 5, 6, 7, 8].map((mes) => ({ mes, pct: 100 / 7 })),
};

test('#789 validarSafrasReceita reporta a 1ª divergência de CADA componente, não para na 1ª safra da linha', () => {
  const linhas = [{
    nome: 'Torre M',
    absorcao: ABSORCAO_2_A_8,
    tipologias: [{ tipologia_id: 1, quantidade: 7, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: {
      componentes: [
        // 50% + 40% = 90%: SOMA_COMPONENTES_DIVERGE em toda safra (relatada uma vez).
        { tipo: 'imediato', participacaoPct: 50, descontoPct: 0, rotulo: 'à vista' },
        // pago no mês 5: inválido só para as safras 6 a 8.
        { tipo: 'concentrado', participacaoPct: 40, mesPagamento: 5, taxaMensal: 0, rotulo: 'repasse' },
      ],
    },
  }];
  const r = validarSafrasReceita(linhas, CRONO_LONGO, 40, undefined, [], 0);
  const soma = r.filter((d) => d.codigo === 'SOMA_COMPONENTES_DIVERGE');
  const invalido = r.filter((d) => d.codigo === 'COMPONENTE_INVALIDO');
  assert.equal(soma.length, 1, 'a mesma divergência do mesmo componente sai uma vez só');
  assert.equal(soma[0].safra, 2);
  assert.equal(invalido.length, 1, 'antes, o break na safra 2 escondia esta');
  assert.equal(invalido[0].safra, 6);
  assert.equal(invalido[0].linha, 'Torre M / repasse');
});

test('#789 validarSafrasReceita: dois componentes do mesmo tipo e sem rótulo, inválidos pelo mesmo código em safras diferentes, saem os dois', () => {
  // A identidade é a posição do componente no plano, não o rótulo: sem
  // rótulo, os dois concentrados viram "concentrado" — e uma chave por rótulo
  // escondia o defeito do segundo atrás do do primeiro.
  const linhas = [{
    nome: 'Torre N',
    absorcao: ABSORCAO_2_A_8,
    tipologias: [{ tipologia_id: 1, quantidade: 7, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: {
      componentes: [
        { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
        // pago no mês 3: inválido para as safras 4 a 8.
        { tipo: 'concentrado', participacaoPct: 40, mesPagamento: 3, taxaMensal: 0 },
        // pago no mês 5: inválido para as safras 6 a 8.
        { tipo: 'concentrado', participacaoPct: 40, mesPagamento: 5, taxaMensal: 0 },
      ],
    },
  }];
  const r = validarSafrasReceita(linhas, CRONO_LONGO, 40, undefined, [], 0);
  const invalido = r.filter((d) => d.codigo === 'COMPONENTE_INVALIDO');
  assert.deepEqual(invalido.map((d) => d.safra), [4, 6]);
  assert.ok(invalido.every((d) => d.linha === 'Torre N / concentrado'), 'os dois têm o mesmo rótulo exibido');
  assert.deepEqual(r.filter((d) => d.codigo === 'SOMA_COMPONENTES_DIVERGE'), [], 'a soma fecha 100%');
});

test('#789/#749 caso equivalente ao estudo 15: plano de 25/09 com vendas até o mês do marco, reconciliação limpa', () => {
  // VGV fracionário (7 meses de absorção) — é o que fazia a soma dos
  // percentuais divergir do `round2` mensal do motor por centavos.
  const linhas = [{
    nome: 'Tabela longa',
    absorcao: {
      modo: 'personalizado',
      meses: [14, 15, 16, 17, 18, 19, 20].map((mes) => ({ mes, pct: 100 / 7 })),
    },
    tipologias: [{ tipologia_id: 1, quantidade: 13, area_privativa_m2: 71.37, preco_m2: 13_333.33 }],
    fluxo_pagamento: {
      componentes: [
        { tipo: 'imediato', participacaoPct: 10, descontoPct: 0, rotulo: 'à vista' },
        {
          tipo: 'ate_marco', participacaoPct: 30, sinalPct: 0, marcoMes: MES_ENTREGA,
          defasagemMeses: 0, taxaMensal: 0, jurosNoMesDaContratacao: false,
          rotulo: '30% em parcelas até o fim da obra',
        },
        { tipo: 'concentrado', participacaoPct: 60, mesPagamento: MES_ENTREGA + 1, taxaMensal: 0, rotulo: 'repasse' },
      ],
    },
  }];
  const contratadas = vendaLiquidaContratadaMensal(linhas[0], CRONO_LONGO, 40, 12.5);
  assert.ok(contratadas[MES_ENTREGA] > 0, 'há venda no mês do marco (N_s = 1)');

  assert.deepEqual(validarSafrasReceita(linhas, CRONO_LONGO, 40, undefined, [], 12.5), []);

  const calc = calcularFluxo({
    dataInicio: null, taxaDescontoAa: 10, cronograma: CRONO_LONGO, jurosTabelaAaEstudo: 12.5,
    linhasReceita: linhas, linhasCusto: [], areaTerreno: 0,
  });
  assert.deepEqual(
    validarContratacao(linhas, CRONO_LONGO, calc.prazo, calc.vendaBrutaContratada, TOLERANCIA_PADRAO, []),
    [],
  );
  // A carteira consolidada zera depois do repasse e nunca fica negativa.
  assert.ok(calc.carteiraClientesMensal.every((v) => v >= 0));
  assert.equal(calc.carteiraClientesMensal[MES_ENTREGA + 1] ?? 0, 0);
});

test('#749 VENDA_BRUTA: o esperado segue o round2 mensal do motor, e divergência real continua acusada', () => {
  const linhas = [{
    nome: 'Torre F',
    absorcao: ABSORCAO_2_A_8,
    tipologias: [{ tipologia_id: 1, quantidade: 10, area_privativa_m2: 50, preco_m2: 3_334 }],
  }];
  const prazo = 40;
  const doMotor = vendaBrutaContratadaMensal(linhas[0], CRONO_LONGO, prazo).reduce((s, v) => s + v, 0);
  // VGV 1.667.000 em 7 meses de 100/7 %: o round2 mensal do motor soma
  // 1.667.000,02 — R$ 0,02 acima da tolerância contra o arredondamento único
  // no fim, que era o esperado antigo e acusava erro sem defeito.
  assert.ok(Math.abs(doMotor - 1_667_000) > TOLERANCIA_PADRAO, 'o caso precisa ser fracionário de verdade');
  assert.deepEqual(validarContratacao(linhas, CRONO_LONGO, prazo, doMotor, TOLERANCIA_PADRAO, []), []);
  const r = validarContratacao(linhas, CRONO_LONGO, prazo, doMotor - 1, TOLERANCIA_PADRAO, []);
  assert.equal(r[0]?.codigo, 'VENDA_BRUTA_NAO_RECONCILIA');
});

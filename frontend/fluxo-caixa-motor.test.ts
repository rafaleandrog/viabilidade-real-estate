import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distribuirLinha, reamostrarCurva, receitaMensalLinha,
  vendaBrutaContratadaMensal, descontoComercialMensal, vendaLiquidaContratadaMensal,
  recebimentoBrutoMensal, impostoMensal, recebimentoLiquidoMensal,
  componentesDoLegado, componentesPagamento, ultimoMesRecebivelLinha,
  taxaMensalDeAnual, taxaAnualDeMensal, taxaMensalDoEstudo,
  pmt, pagamentosPrazoFixo, pagamentosAteMarco, pagamentosConcentrado,
  carteiraSaldoSafra, consolidarCarteiraClientes,
  calcularRecebiveisComponentes,
  jurosSafra, receitaBrutaSafra, componentesEfetivosSafra, ehVendaAposChaves,
  parcelasAoLongoObra, vencimentosAoLongoObra,
  vplFluxo, tirFluxo, calcularFluxo, aplicarCenario, agregarFluxoPorPeriodos, pctDeReceitaBruta,
  permutaFinanceiraBrutaMensal, permutaFinanceiraLiquidaMensal, permutaFinanceiraDeduzidaMensal,
  areaVendidaMensal, unidadesVendidasMensal, estoqueM2Mensal, estoqueM2Semente, vsoMensal,
  type FluxoConfig, type FluxoCalc, type ComponentePagamento, type ResiduoAteMarco,
} from './fluxo-caixa-motor.js';
import { periodosAnuais, CATEGORIA_CORRETAGEM, type EventoCrono } from './fluxo-shared.js';
import {
  CALLIANDRA_G1, CALLIANDRA_G2, G1_ESPERADO, G2_ESPERADO,
  type CenarioRecebiveis,
} from './fixtures/calliandra-golden.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// Cronograma 0-based (mês 0 = início do projeto).
const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const CURVA_S = [2, 4, 7, 10, 13, 14, 14, 13, 10, 7, 4, 2].map((pct, i) => ({ mes: i + 1, pct }));

test('#230: contrato canônico é preferido sem alterar a leitura legada', () => {
  const fluxo = { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] };
  assert.deepEqual(componentesPagamento(fluxo, CRONO, 0), fluxo.componentes);
  const legado = { entrada: [{ pct: 15, parcelas: 1 }], parcelas: [], repasse: { apos_entrega_meses: 0 } };
  assert.deepEqual(componentesPagamento(legado, CRONO, 0), componentesDoLegado(legado, CRONO, 0));
});

// 1. Distribuição linear (mês 0-based: início 3 = índice 3)
test('distribuirLinha linear: 12 meses iguais somando o total', () => {
  const r = distribuirLinha(1_200_000, 3, 12, 'linear', 24);
  assert.equal(r.length, 24);
  assert.ok(perto(soma(r), 1_200_000));
  assert.equal(r[0], 0);
  assert.equal(r[2], 0);
  for (let i = 3; i < 15; i++) assert.ok(perto(r[i], 100_000));
  assert.equal(r[15], 0);
});

// 2. Curva S interpolada para outra duração
test('curva S de 12 meses reamostrada para 24 mantém soma e formato', () => {
  const pesos = reamostrarCurva(CURVA_S, 24);
  assert.equal(pesos.length, 24);
  assert.ok(perto(soma(pesos), 1, 1e-9));
  // formato de S preservado: meio > extremidades
  assert.ok(pesos[11] > pesos[0]);
  assert.ok(pesos[11] > pesos[23]);
  const r = distribuirLinha(500_000, 0, 24, CURVA_S, 24);
  assert.ok(perto(soma(r), 500_000));
});

// ── Série canônica de contratação — bruto / desconto / líquido (#227) ──

test('vendaBrutaContratadaMensal: soma o VGV vendável, distribuído pela absorção linear', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
    absorcao: { modo: 'linear' },
  };
  const r = vendaBrutaContratadaMensal(linha, CRONO, 60);
  assert.ok(perto(soma(r), 50_000_000, 1));
  assert.equal(r.slice(0, 6).every((v) => v === 0), true); // nada antes do Pré-lançamento
});

test('vendaBrutaContratadaMensal exclui a permuta física (usa VGV vendável, #195)', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000, unidades_permutadas: 20 }],
    absorcao: { modo: 'linear' },
  };
  const r = vendaBrutaContratadaMensal(linha, CRONO, 60);
  assert.ok(perto(soma(r), 40_000_000, 1)); // 80/100 unidades vendáveis
});

test('descontoComercialMensal: zero sem entrada configurada — nenhum estudo existente muda', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: null,
  };
  const r = descontoComercialMensal(linha, CRONO, 60, 0);
  assert.ok(r.every((v) => v === 0));
});

test('descontoComercialMensal: aplica só sobre a fração da entrada, não sobre o total da venda', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] }, // tudo no mês 12
    fluxo_pagamento: { entrada: [{ pct: 20, parcelas: 1, descontoPct: 5 }] },
  };
  const bruto = vendaBrutaContratadaMensal(linha, CRONO, 60);
  const desconto = descontoComercialMensal(linha, CRONO, 60, 0);
  // desconto = 5% de (20% da venda bruta do mês), não 5% da venda inteira.
  assert.ok(perto(desconto[12], bruto[12] * 0.20 * 0.05, 1));
  assert.ok(desconto[12] < bruto[12] * 0.05); // bem menor que 5% do total
});

test('vendaLiquidaContratadaMensal = bruta − desconto, mês a mês', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    fluxo_pagamento: { entrada: [{ pct: 20, parcelas: 1, descontoPct: 5 }] },
  };
  const bruto = vendaBrutaContratadaMensal(linha, CRONO, 60);
  const desconto = descontoComercialMensal(linha, CRONO, 60, 0);
  const liquido = vendaLiquidaContratadaMensal(linha, CRONO, 60, 0);
  for (let i = 0; i < liquido.length; i++) assert.ok(perto(liquido[i], bruto[i] - desconto[i], 1e-6));
});

// #260 — contrato C7: toda série monetária resultado de fórmula tem 2 casas
// decimais no motor, não só na apresentação (#281). Absorção linear em 47
// meses de uma venda que não divide exato é o caso clássico de resíduo de
// ponto flutuante (dízima), que sem quantização vazaria mais de 2 casas.
test('#260: vendaBrutaContratadaMensal/descontoComercialMensal/vendaLiquidaContratadaMensal têm 2 casas', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
    absorcao: { modo: 'linear' },
    fluxo_pagamento: { entrada: [{ pct: 33, parcelas: 1, descontoPct: 7 }] },
  };
  const casas2 = (v: number) => Math.round(v * 100) / 100 === v;
  const bruto = vendaBrutaContratadaMensal(linha, CRONO, 60);
  const desconto = descontoComercialMensal(linha, CRONO, 60, 0);
  const liquido = vendaLiquidaContratadaMensal(linha, CRONO, 60, 0);
  assert.ok(bruto.every(casas2), 'venda bruta com resíduo além de 2 casas');
  assert.ok(desconto.every(casas2), 'desconto comercial com resíduo além de 2 casas');
  assert.ok(liquido.every(casas2), 'venda líquida com resíduo além de 2 casas');
});

// ── #457: livro de estoque em m²/unidades e VSO ──
//
// Cronograma dedicado: SEM Pré-lançamento, para que `periodoAbsorcao.inicio`
// (usado para indexar `abs.pcts`) coincida com `lancamento.inicio_mes` (usado
// para a baixa da permuta) — os dois caem no índice 0. Lançamento de 3 meses,
// como pede o critério de aceite ("Lançamento de 3 meses"); absorção
// distribuída 15/20/65 (lançamento/obra/pós-chaves; pré-lançamento 0%, não
// citado) — 15%/3 = 5%/mês no Lançamento, a fonte do "5%" do critério 1.
const CRONO_LANCAMENTO_3M: EventoCrono[] = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 3 },
  { evento: 'obra', inicio_mes: 3, duracao_meses: 20 },
  { evento: 'pos_obra', inicio_mes: 23, duracao_meses: 12 },
];

// Área privativa TOTAL da linha = 18.438,410033 m² (100 unid. × 184,38410033
// m²/unid., a "semente" da EVI — `Areas e Precos!F14`). 11 unidades
// permutadas fisicamente = 2.028,22510363 m² ≈ 2.028,225104 (`cfINC!G19`,
// arredondado a 6 casas na planilha). Área de venda resultante (89 unidades)
// = 16.410,18492937 m² ≈ 16.410,184929 (`Areas e Precos!F17`).
function linhaEstoqueTeste(absorcao: any = { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 15 }, { evento: 'obra', pct: 20 }] }) {
  return {
    tipologias: [{ quantidade: 100, area_privativa_m2: 184.38410033, preco_m2: 10_000, unidades_permutadas: 11 }],
    absorcao,
  };
}

test('#457: areaVendidaMensal/estoqueM2Mensal reproduzem cfINC — semente = privativa TOTAL, permuta baixa no mês do Lançamento', () => {
  const linha = linhaEstoqueTeste();
  const semente = estoqueM2Semente(linha);
  const vendida = areaVendidaMensal(linha, CRONO_LANCAMENTO_3M, 60);
  const estoque = estoqueM2Mensal(linha, CRONO_LANCAMENTO_3M, 60);

  // A asserção que distingue o modelo (issue #457): a semente é a privativa
  // TOTAL (18.438,41...), não a área de venda já líquida (16.410,18...) — sem
  // ela, semear com a área líquida E baixar a permuta de novo produziria
  // 13.561,45 no mês 0 e passaria em tudo, menos nisto.
  assert.ok(perto(semente, 18_438.410033, 1e-6), `semente esperada 18438.410033, achei ${semente}`);

  assert.ok(perto(vendida[0], 820.509246, 1e-6), `areaVendidaMensal[0] esperado 820.509246, achei ${vendida[0]}`);
  assert.ok(perto(estoque[0], 15_589.675683, 1e-6), `estoqueM2Mensal[0] esperado 15589.675683, achei ${estoque[0]}`);
});

test('#457: conservação — estoqueM2Mensal fecha em 0 quando a absorção soma 100%, e ≠ 0 quando falta 1,41% (caso do estudo 6)', () => {
  const linhaCompleta = linhaEstoqueTeste(); // distribuído 15/20/65 — soma 100% por construção
  const estoqueCompleto = estoqueM2Mensal(linhaCompleta, CRONO_LANCAMENTO_3M, 60);
  assert.ok(perto(estoqueCompleto[59], 0, 0.01), `estoque final esperado ~0, achei ${estoqueCompleto[59]}`);

  // Absorção 'personalizado' que só declara 98,59% de vendas — reproduz o
  // descarte silencioso do estudo 6 (#429): 1,41% de área fica sem vender e
  // o resíduo tem que aparecer no estoque final, não sumir.
  const linhaIncompleta = linhaEstoqueTeste({ modo: 'personalizado', meses: [{ mes: 0, pct: 98.59 }] });
  const estoqueIncompleto = estoqueM2Mensal(linhaIncompleta, CRONO_LANCAMENTO_3M, 60);
  const areaVendavelLinhaTeste = 16_410.184929; // 89 unid. × 184,38410033 m²
  assert.ok(
    Math.abs(estoqueIncompleto[59] - areaVendavelLinhaTeste * 0.0141) < 0.5,
    `resíduo de 1,41% esperado, achei ${estoqueIncompleto[59]}`,
  );
  assert.ok(Math.abs(estoqueIncompleto[59]) > 0.01, 'estoque incompleto não pode fechar em 0');
});

test('#457: unidadesVendidasMensal/vsoMensal — coerência interna, sem oráculo de planilha (BRIEF-EVI.md T4)', () => {
  const linha = linhaEstoqueTeste();
  const areaPrivativa = 184.38410033;
  const unidades = unidadesVendidasMensal(linha, CRONO_LANCAMENTO_3M, 60);
  const area = areaVendidaMensal(linha, CRONO_LANCAMENTO_3M, 60);
  for (let i = 0; i < unidades.length; i++) {
    assert.ok(perto(unidades[i] * areaPrivativa, area[i], 1e-6), `mês ${i}: unidades×área diverge de areaVendidaMensal`);
  }

  const vso = vsoMensal(linha, CRONO_LANCAMENTO_3M, 60);
  // Mês 0: 820,509246 m² vendidos sobre 16.410,184929 m² de estoque de
  // início (semente − permuta, já baixada no mesmo mês) = 5% — bate com o
  // bloco de Lançamento (15% / 3 meses).
  assert.ok(perto(vso[0], 0.05, 1e-6), `vso[0] esperado 0.05, achei ${vso[0]}`);
  // Fora do período de absorção (antes do Lançamento não existe aqui;
  // depois do Pós-chaves, estoque zerado): sem NaN, sem divisão por zero.
  assert.ok(vso.every((v) => Number.isFinite(v)), 'vso não pode conter NaN/Infinity');
  assert.equal(vso[59], 0, 'vso deve ser 0 quando o estoque de início já é 0 (sem divisão por zero)');
});

// Rodada de revisão do PR 531: `CRONO_LANCAMENTO_3M` (usado nos 3 testes
// acima) não tem evento `pre_lancamento` — o Lançamento já começa no mês 0,
// então "baixa no mês do Lançamento" e "baixa no início/imediatamente" são
// INDISTINGUÍVEIS nesses testes. A mutação que reverte `estoqueM2Mensal`/
// `vsoMensal` para subtrair a permuta ANTES do laço (em vez de em
// `mesLancamento`) passa nos 3 testes acima sem derrubar nenhuma asserção.
// Este teste fecha o buraco: cronograma COM Pré-lançamento, checando que o
// estoque nos meses de Pré-lançamento ainda NÃO tem a permuta baixada.
test('#457: com Pré-lançamento, a permuta só baixa no mês do Lançamento — não antes', () => {
  const CRONO_COM_PRE: EventoCrono[] = [
    { evento: 'pre_lancamento', inicio_mes: 0, duracao_meses: 6 },
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 3 },
    { evento: 'obra', inicio_mes: 9, duracao_meses: 20 },
    { evento: 'pos_obra', inicio_mes: 29, duracao_meses: 12 },
  ];
  const linha = linhaEstoqueTeste({ modo: 'distribuido', blocos: [
    { evento: 'pre_lancamento', pct: 40 },
    { evento: 'lancamento', pct: 15 },
    { evento: 'obra', pct: 20 },
  ]});
  const semente = estoqueM2Semente(linha);
  const vendida = areaVendidaMensal(linha, CRONO_COM_PRE, 60);
  const estoque = estoqueM2Mensal(linha, CRONO_COM_PRE, 60);
  const permuta = 11 * 184.38410033; // 2.028,225104 m² (11 unid. permutadas)

  // Mês 5 (último mês de Pré-lançamento, ANTES do mês do Lançamento = 6):
  // o estoque só reflete as vendas do Pré-lançamento — a permuta ainda não
  // baixou. Se baixasse no início (upfront, como o livro em unidades faz),
  // o valor seria ~9.846,11 em vez de ~11.874,34 — uma diferença de mais de
  // 2.000 m² que nenhuma tolerância esconde.
  const esperadoSemPermutaAinda = semente - 6 * vendida[0];
  assert.ok(
    perto(estoque[5], esperadoSemPermutaAinda, 1e-3),
    `estoque[5] esperado ${esperadoSemPermutaAinda} (SEM permuta baixada), achei ${estoque[5]}`,
  );

  // Mês 6 (mês do Lançamento): a permuta baixa integralmente aqui, além da
  // venda do próprio mês.
  const esperadoComPermuta = estoque[5] - permuta - vendida[6];
  assert.ok(
    perto(estoque[6], esperadoComPermuta, 1e-3),
    `estoque[6] esperado ${esperadoComPermuta} (COM permuta baixada), achei ${estoque[6]}`,
  );

  // Conservação também vale com Pré-lançamento no cronograma: sem sobra,
  // sem negativo nos meses intermediários.
  assert.ok(perto(estoque[59], 0, 0.01), `estoque final esperado ~0, achei ${estoque[59]}`);
  assert.ok(estoque.every((v) => v >= -0.01), 'estoque não pode ficar negativo em nenhum mês');
});

test('#260: rateio monetário fecha exatamente com o total da linha', () => {
  const r = calcularFluxo({
    dataInicio: 'jan/2027', prazoMeses: 3, taxaDescontoAa: 12, areaTerreno: 0, cronograma: [], linhasReceita: [],
    jurosTabelaAaEstudo: 0,
    linhasCusto: [{ id: 1, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 100, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 3 }],
  });
  const linha = r.linhasCusto[0];
  // #446: `prazoMeses` virou PISO, não teto — os `prazoMeses: 3` daqui não
  // encurtam mais o horizonte, que agora é o derivado (12, pelo piso de
  // `11 + 1`). `mensal` é a série INTEIRA do horizonte, então o rateio de 3
  // meses ocupa as 3 primeiras posições e o resto é zero. O que este teste
  // prova NÃO mudou: o rateio fecha exatamente em 100, com 2 casas e o
  // resíduo no último mês com valor.
  assert.equal(linha.mensal.length, 12);
  assert.deepEqual(linha.mensal.slice(0, 3), [33.33, 33.33, 33.34]);
  assert.ok(linha.mensal.slice(3).every((v) => v === 0), 'meses sem rateio têm de ser zero');
  assert.equal(linha.total, 100);
  assert.equal(r.custoMensal.reduce((s, v) => s + v, 0), 100);
});

test('#260: custo canônico mantém o mesmo fluxo após troca de unidade', () => {
  const r = calcularFluxo({
    dataInicio: 'jan/2027', prazoMeses: 1, taxaDescontoAa: 12, areaTerreno: 0, cronograma: [], linhasReceita: [],
    jurosTabelaAaEstudo: 0,
    linhasCusto: [{ id: 1, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 12.09, orcamento_unidade: 'pct_vgv', orcamento_valor_canonico: 10_000_000, inicio_mes: 0, duracao_meses: 1 }],
  });
  assert.equal(r.linhasCusto[0].total, 10_000_000);
});

test('#260: recebimentoBrutoMensal/impostoMensal/recebimentoLiquidoMensal têm 2 casas', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 80, parcelas: 7, periodicidade: 'mensal' }],
      ret: { ativo: true, pct: 4 },
    },
  };
  const casas2 = (v: number) => Math.round(v * 100) / 100 === v;
  const bruto = recebimentoBrutoMensal(linha, CRONO, 60, 0);
  const imposto = impostoMensal(linha, CRONO, 60, 0);
  const liquido = recebimentoLiquidoMensal(linha, CRONO, 60, 0);
  assert.ok(bruto.every(casas2), 'recebimento bruto com resíduo além de 2 casas');
  assert.ok(imposto.every(casas2), 'imposto com resíduo além de 2 casas');
  assert.ok(liquido.every(casas2), 'recebimento líquido com resíduo além de 2 casas');
});

// #584 (era #462): a área aberta muda a CADEIA DE RECEBÍVEIS inteira, não só
// o VGV, porque `vgvVendavelLinha` é a base de `vendaBrutaContratadaMensal` e,
// por ela, de `recebimentoBrutoMensal`/`impostoMensal`/`recebimentoLiquidoMensal`
// (`frontend/fluxo-shared.ts`, `vgvUnitarioTipologia`). O que a #584 mudou é o
// TAMANHO do efeito: sem o deflator, a área aberta entra a preço CHEIO.
test('#584: área aberta muda recebimentoBruto/imposto/líquido — não só o VGV', () => {
  const base = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 80, parcelas: 7, periodicidade: 'mensal' }],
      ret: { ativo: true, pct: 4 },
    },
  };
  // Mesma tipologia, com 20 m² de área aberta por unidade, a preço CHEIO
  // (#584 retirou o deflator) — preço efetivo por unidade:
  // (100 + 20) × 10.000 = 1.200.000 (era 1.000.000) → VGV da linha sobe de
  // 10M para 12M (+20%). Com o deflator de 50% da #462 seriam 11M (+10%): o
  // degrau DOBRA, e é essa a mudança de número que a #584 pede.
  const comAberta = {
    ...base,
    tipologias: [{ ...base.tipologias[0], area_privativa_aberta_m2: 20 }],
  };
  const brutoBase = recebimentoBrutoMensal(base, CRONO, 60, 0);
  const brutoAberta = recebimentoBrutoMensal(comAberta, CRONO, 60, 0);
  const impostoBase = impostoMensal(base, CRONO, 60, 0, base.fluxo_pagamento.ret);
  const impostoAberta = impostoMensal(comAberta, CRONO, 60, 0, comAberta.fluxo_pagamento.ret);
  const liquidoBase = recebimentoLiquidoMensal(base, CRONO, 60, 0, base.fluxo_pagamento.ret);
  const liquidoAberta = recebimentoLiquidoMensal(comAberta, CRONO, 60, 0, comAberta.fluxo_pagamento.ret);

  const somaBruto = brutoBase.reduce((s, v) => s + v, 0);
  const somaBrutoAberta = brutoAberta.reduce((s, v) => s + v, 0);
  const somaImposto = impostoBase.reduce((s, v) => s + v, 0);
  const somaImpostoAberta = impostoAberta.reduce((s, v) => s + v, 0);
  const somaLiquido = liquidoBase.reduce((s, v) => s + v, 0);
  const somaLiquidoAberta = liquidoAberta.reduce((s, v) => s + v, 0);

  // Não é só o VGV nominal que muda — as TRÊS séries mensais de recebível
  // sobem na mesma proporção (+20%): imposto e líquido são derivados do
  // bruto, então o efeito se propaga pela cadeia inteira, não fica preso na
  // contratação.
  assert.ok(perto(somaBrutoAberta, somaBruto * 1.2, 1), 'recebimento bruto não subiu 20%');
  assert.ok(perto(somaImpostoAberta, somaImposto * 1.2, 1), 'imposto não subiu 20%');
  assert.ok(perto(somaLiquidoAberta, somaLiquido * 1.2, 1), 'recebimento líquido não subiu 20%');
  // Mutação da #584: com o deflator de 50% da #462 este mesmo insumo dava
  // +10%. A asserção abaixo REPROVA se alguém reintroduzir o deflator por
  // qualquer caminho — é o oráculo do degrau, não um arredondamento.
  assert.ok(!perto(somaBrutoAberta, somaBruto * 1.1, 1), 'o deflator voltou: o bruto subiu só 10%');
  // Mês a mês — não só o total: prova que a mudança está na SÉRIE, não numa
  // agregação que por acaso bate.
  for (let i = 0; i < 60; i++) {
    if (brutoBase[i] === 0 && brutoAberta[i] === 0) continue;
    assert.ok(perto(brutoAberta[i], brutoBase[i] * 1.2, 0.5), `mês ${i}: bruto não escalou 20%`);
  }
});

// #227 reconciliado contra o Anexo G.1 (Calliandra prazo fixo): à vista do mês 1
// = 20% × (1 − 5%) × 2.860.111,52 = R$ 543.421,19 (docs/viabilidade/padrao-
// incorporacao.md, Anexo G.1). Reproduz por construção, com a linha real do
// motor (receitaMensalLinha), não com o oráculo isolado de calliandra-golden.
test('#227: desconto de entrada reproduz o à vista do mês 1 do cenário G.1 (Calliandra)', () => {
  const cronoG1: EventoCrono[] = [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 1 },
    { evento: 'pre_lancamento', inicio_mes: 1, duracao_meses: 0 },
    { evento: 'lancamento', inicio_mes: 1, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 1, duracao_meses: 132 },
    { evento: 'pos_obra', inicio_mes: 133, duracao_meses: 1 },
  ];
  const basePorMes = [0, 2_860_111.52, 2_860_111.52, 2_860_111.52, 2_860_111.52,
    2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64];
  const vgvTotal = basePorMes.reduce((s, v) => s + v, 0);
  const linha = {
    tipologias: [{ quantidade: 1, area_privativa_m2: vgvTotal, preco_m2: 1 }], // VGV = base exata
    absorcao: {
      modo: 'personalizado',
      meses: basePorMes.map((v, mes) => ({ mes, pct: (v / vgvTotal) * 100 })),
    },
    fluxo_pagamento: { entrada: [{ pct: 20, parcelas: 1, descontoPct: 5 }] },
  };
  // prazoTotal folgado (140) para não estourar o horizonte do repasse derivado
  // (80% da venda, no fim da Obra do cenário = mês 132) — este teste só confere
  // o mês 1, mas #231 agora avisa (console.warn) se algo cair fora do array.
  const r = receitaMensalLinha(linha, cronoG1, 140, 0);
  // Mês 1: só a fração de entrada cai no mês da venda (as demais modalidades —
  // curta/longa, #232+ — ainda não existem nesta fase); confere isoladamente o
  // valor da entrada com desconto.
  assert.ok(perto(r[1], 0.20 * (1 - 0.05) * 2_860_111.52, 0.5));
});

// 3. Absorção distribuída (4 períodos) aplicada às vendas de uma linha (#108)
test('absorção distribuída: vendas caem nos 4 períodos e somam o VGV', () => {
  const linha = {
    tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
    absorcao: {
      modo: 'distribuido',
      blocos: [
        { evento: 'pre_lancamento', pct: 20 }, // período 1 = pré-lançamento (meses 6..11, 6m)
        { evento: 'lancamento', pct: 10 },     // período 2 = lançamento (mês 12, 1m)
        { evento: 'obra', pct: 35 },           // período 3 = "Durante a obra" (meses 13..40, 28m — #225)
        { evento: 'pos_obra', pct: 0 },        // período 4 = derivado = 35% (meses 41..52)
      ],
    },
    fluxo_pagamento: null, // sem config → recebe à vista no mês da venda
  };
  const r = receitaMensalLinha(linha, CRONO, 60, 0);
  assert.ok(perto(soma(r), 50_000_000, 1));
  assert.ok(perto(r[6], (0.20 * 50_000_000) / 6, 1));   // pré-lançamento: 20% / 6 meses
  assert.ok(perto(r[12], (0.10 * 50_000_000) / 1, 1));  // lançamento: 10% em 1 mês
  // #225: "Durante a obra" cobre do mês seguinte ao lançamento (13) ao fim da
  // obra (40) = 28 meses; não há mais hiato entre lançamento e obra.
  assert.ok(perto(r[13], (0.35 * 50_000_000) / 28, 1)); // 1º mês de "Durante a obra"
  assert.ok(perto(r[14], (0.35 * 50_000_000) / 28, 1)); // antes era hiato = 0
  assert.ok(perto(r[41], (0.35 * 50_000_000) / 12, 1)); // 1º mês da pós-obra (derivado)
});

// 4. Fluxo de pagamento: entrada + parcelas + repasse = VGV no tempo correto
test('fluxo de pagamento distribui entrada, parcelas na obra e repasse na entrega', () => {
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },        // tudo vendido no lançamento
    fluxo_pagamento: {
      comissao: { ativo: true, tipo: 'embutida', pct: 6 },  // embutida: não deduz
      ret: { ativo: false, pct: 0 },
      entrada: { modo: 'entrada', parcelas: 1, pct: 15 },
      parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 },
      repasse: { pct: 70, apos_entrega_meses: 2 }, // #345: ignorado — offset travado em 1
    },
  };
  const r = receitaMensalLinha(linha, CRONO, 60, 0);
  assert.ok(perto(soma(r), 10_000_000, 1));                   // nada se perde
  assert.ok(perto(r[12], 1_500_000, 1));                      // entrada no mês 12
  // #190: parcelas ancoradas nos MESES DA OBRA (17..40 = 24 parcelas), não mais
  // contadas a partir do mês da venda (que dava 28 parcelas, do mês 13 ao 40).
  assert.ok(perto(r[13], 0, 1));                              // antes da obra: nada
  assert.ok(perto(r[17], 1_500_000 / 24, 1));                 // 1º mês da obra
  assert.ok(perto(r[40], 1_500_000 / 24, 1));                 // último mês da obra
  // #345: repasse: fim da obra (40) + 1 (travado) = mês 41 — `apos_entrega_meses:
  // 2` acima é ignorado, prova de que o valor persistido não influencia mais.
  assert.ok(perto(r[41], 7_000_000, 1));
});

// 4c. #190 — "Ao longo da obra" + Mensal: nº de parcelas = duração da obra.
test('#190 ao longo da obra: nº de parcelas fixo pela duração da obra', () => {
  assert.equal(parcelasAoLongoObra(CRONO), 24);               // obra 17..40
  // Venda ANTES da obra: todos os 24 meses de obra recebem parcela igual.
  const v = vencimentosAoLongoObra(CRONO, 12);
  assert.equal(v.length, 24);
  assert.equal(v[0], 17);
  assert.equal(v[23], 40);
});

test('#190 venda no meio da obra: 1ª parcela no 1º vencimento >= mês da venda', () => {
  // Venda no mês 25 (obra 17..40): sobram os meses 25..40 = 16 vencimentos.
  const v = vencimentosAoLongoObra(CRONO, 25);
  assert.equal(v.length, 16);
  assert.equal(v[0], 25);                                     // nada retroativo
  assert.equal(v[15], 40);

  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 25, pct: 100 }] },        // vendido no mês 25
    fluxo_pagamento: {
      comissao: { ativo: false, tipo: 'embutida', pct: 0 },
      ret: { ativo: false, pct: 0 },
      entrada: { modo: 'entrada', parcelas: 1, pct: 0 },
      parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 100 },
      repasse: { pct: 0, apos_entrega_meses: 0 },
    },
  };
  const r = receitaMensalLinha(linha, CRONO, 60, 0);
  assert.ok(perto(soma(r), 10_000_000, 1));                   // conservação da receita
  assert.ok(perto(r[24], 0, 1));                              // antes da venda: nada
  assert.ok(perto(r[25], 10_000_000 / 16, 1));                // parcela maior, total igual
  assert.ok(perto(r[40], 10_000_000 / 16, 1));
});

// 4d. #191 — periodicidade respeitada no "Ao longo da obra".
test('#191 trimestral/semestral/anual: nº de parcelas = floor(duração / intervalo)', () => {
  // Obra de 24 meses (17..40).
  assert.equal(parcelasAoLongoObra(CRONO, 'mensal'), 24);
  assert.equal(parcelasAoLongoObra(CRONO, 'trimestral'), 8);
  assert.equal(parcelasAoLongoObra(CRONO, 'semestral'), 4);
  assert.equal(parcelasAoLongoObra(CRONO, 'anual'), 2);
  // Vencimentos a cada intervalo, a partir do início da obra.
  assert.deepEqual(vencimentosAoLongoObra(CRONO, 12, 'trimestral'), [17, 20, 23, 26, 29, 32, 35, 38]);
  assert.deepEqual(vencimentosAoLongoObra(CRONO, 12, 'semestral'), [17, 23, 29, 35]);
  assert.deepEqual(vencimentosAoLongoObra(CRONO, 12, 'anual'), [17, 29]);
});

test('#191 resto da divisão não vira parcela (10 meses trimestral = 3 parcelas)', () => {
  const obra10: EventoCrono[] = [{ evento: 'obra', inicio_mes: 5, duracao_meses: 10 }];
  assert.equal(parcelasAoLongoObra(obra10, 'trimestral'), 3);       // 10/3 = 3, sobra 1 mês
  assert.deepEqual(vencimentosAoLongoObra(obra10, 0, 'trimestral'), [5, 8, 11]);
  // Duração menor que um intervalo ainda gera 1 parcela (piso).
  const obra2: EventoCrono[] = [{ evento: 'obra', inicio_mes: 5, duracao_meses: 2 }];
  assert.equal(parcelasAoLongoObra(obra2, 'anual'), 1);
  assert.deepEqual(vencimentosAoLongoObra(obra2, 0, 'anual'), [5]);
});

test('#191 semestral: receita se conserva e vence no intervalo certo', () => {
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: {
      comissao: { ativo: false, tipo: 'embutida', pct: 0 },
      ret: { ativo: false, pct: 0 },
      entrada: { modo: 'entrada', parcelas: 1, pct: 0 },
      parcelas: { periodicidade: 'semestral', parcelas: 0, ao_longo_obra: true, juros: false, pct: 100 },
      repasse: { pct: 0, apos_entrega_meses: 0 },
    },
  };
  const r = receitaMensalLinha(linha, CRONO, 60, 0);
  assert.ok(perto(soma(r), 10_000_000, 1));            // conservação da receita
  // 4 parcelas iguais nos meses 17, 23, 29 e 35 — e nada nos meses do meio.
  for (const mes of [17, 23, 29, 35]) assert.ok(perto(r[mes], 10_000_000 / 4, 1));
  assert.ok(perto(r[18], 0, 1));
  assert.ok(perto(r[40], 0, 1));
});

test('#190 obra sem duração: cai para 1 parcela no mês da venda', () => {
  const semObra: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 17, duracao_meses: 0 },
  ];
  assert.equal(parcelasAoLongoObra(semObra), 1);
  assert.deepEqual(vencimentosAoLongoObra(semObra, 12), [12]);
  // Venda depois do FIM da obra também vira parcela única no mês da venda.
  assert.deepEqual(vencimentosAoLongoObra(CRONO, 50), [50]);
});

// 4b. Fluxo de pagamento com MÚLTIPLAS linhas de entrada e repasse derivado
test('fluxo de pagamento: múltiplas entradas + repasse derivado (100 − entradas − parcelas)', () => {
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: {
      comissao: { ativo: true, tipo: 'embutida', pct: 6 },
      ret: { ativo: false, pct: 0 },
      entrada: [{ pct: 10, parcelas: 1 }, { pct: 5, parcelas: 1 }], // duas linhas, 15% no total
      parcelas: [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, pct: 15 }],
      repasse: { apos_entrega_meses: 2 }, // #345: ignorado — pct derivado = 100 − 15 − 15 = 70
    },
  };
  const r = receitaMensalLinha(linha, CRONO, 60, 0);
  assert.ok(perto(soma(r), 10_000_000, 1));       // nada se perde
  assert.ok(perto(r[12], 1_500_000, 1));          // 10% + 5% de entrada no mês 12
  // #190: parcelas ao longo da obra vencem nos MESES DA OBRA (17..40 = 24), não
  // a partir do mês seguinte à venda (13..40 = 28).
  assert.ok(perto(r[13], 0, 1));
  assert.ok(perto(r[17], 1_500_000 / 24, 1));
  assert.ok(perto(r[41], 7_000_000, 1));          // repasse derivado (70%) na entrega (fim obra + 1, #345)
});

// #228: "Destacada" não deduz mais do recebível — a corretagem é sempre a
// linha de custo obrigatória (base bruto/VGV, #227). Antes, marcar "Destacada"
// dobrava a dedução (uma vez na receita via vglLinha, outra vez como custo);
// agora o Resultado é IDÊNTICO entre "Destacada" e "Embutida" com o mesmo %.
test('#228: marcar comissão "Destacada" não muda mais o Resultado (fim da dupla dedução)', () => {
  const base = (tipo: 'embutida' | 'destacada'): FluxoConfig => ({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: { comissao: { ativo: true, tipo, pct: 6 }, ret: { ativo: false, pct: 0 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM, orcamento_valor: 6, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  });
  const rEmbutida = calcularFluxo(base('embutida'));
  const rDestacada = calcularFluxo(base('destacada'));
  const resultado = (c: FluxoCalc) => c.fluxoAcumulado[c.fluxoAcumulado.length - 1];
  assert.ok(perto(resultado(rEmbutida), resultado(rDestacada), 1));
  // A receita bruta (antes da corretagem, que é custo) também é idêntica.
  assert.ok(perto(soma(rEmbutida.receitaMensal), soma(rDestacada.receitaMensal), 1));
  // E igual à venda contratada (10M) — sem RET, sem juros ainda (#232+).
  assert.ok(perto(soma(rEmbutida.receitaMensal), 10_000_000, 1));
});

test('#228/#346: RET reduz o Resultado uma única vez (imposto), sem dobrar com a comissão', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: { comissao: { ativo: true, tipo: 'destacada', pct: 6 } },
    }],
    linhasCusto: [],
    areaTerreno: 0,
    ret: { ativo: true, pct: 4 }, // #346: RET é global, não mais lido de fluxo_pagamento
  };
  const r = calcularFluxo(config);
  // Receita líquida = 10M − 4% de RET = 9,6M — a comissão "destacada" não soma
  // outra dedução (não há linha de custo de corretagem nesta config).
  assert.ok(perto(soma(r.receitaMensal), 9_600_000, 1));
});

// 5. Resolução de unidade pct_vgv dentro do fluxo completo
test('linha de custo em % VGV resolve sobre o VGV das tipologias', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Sales', tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: { modo: 'linear' }, fluxo_pagamento: null,
    }],
    linhasCusto: [{ id: 1, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv', inicio_mes: 1, duracao_meses: 12 }],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.ok(perto(r.linhasCusto[0].total, 1_250_000, 1));
  assert.ok(perto(soma(r.linhasCusto[0].mensal), 1_250_000, 1));
});

// #173: subcategoria só compõe o nome de exibição em Terreno — nos demais
// grupos a coluna some da tela e o dado legado não deve "vazar" no nome.
test('nome da linha de custo inclui subcategoria só em Terreno (#173)', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira', orcamento_valor: 1, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'indireto', categoria: 'Gestão', subcategoria: 'Legado', orcamento_valor: 1, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const terreno = r.linhasReceita.find((l) => l.nome.includes('Preço'))!; // vira dedução da receita (#196)
  const indireto = r.linhasCusto.find((l) => l.nome.includes('Gestão'))!;
  assert.equal(terreno.nome, 'Preço — Permuta financeira');
  assert.equal(indireto.nome, 'Gestão'); // subcategoria legada não aparece fora de Terreno
});

// 5b. Corretagem de vendas: paga no mês da venda, não distribuída (#121)
test('corretagem de vendas cai no mês da venda, acompanhando a absorção', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: {
        modo: 'distribuido',
        blocos: [
          { evento: 'lancamento', pct: 40 },  // mês 12 (1m)
          { evento: 'obra', pct: 60 },        // "Durante a obra": meses 13..40 (28m — #225)
          { evento: 'pos_obra', pct: 0 },     // derivado = 0
        ],
      },
      fluxo_pagamento: null,
    }],
    linhasCusto: [
      // Corretagem: 4% do VGV. inicio_mes/duracao_meses são IGNORADOS pelo motor.
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const linha = r.linhasCusto[0];

  // Total = 4% do VGV vendido (absorção completa) e o mensal soma o mesmo.
  assert.ok(perto(linha.total, 4_000_000, 1));
  assert.ok(perto(soma(linha.mensal), 4_000_000, 1));
  // Mês do lançamento: 40% do VGV vendido → 4% de 40M = 1,6M.
  assert.ok(perto(linha.mensal[12], 0.04 * 40_000_000, 1));
  // #225: "Durante a obra" espalha 60% por 28 meses (13..40), sem hiato.
  assert.ok(perto(linha.mensal[13], (0.04 * 60_000_000) / 28, 1));
  assert.ok(perto(linha.mensal[40], (0.04 * 60_000_000) / 28, 1));
  // Nada antes da 1ª venda; o mês 14 agora faz parte de "Durante a obra".
  assert.ok(perto(linha.mensal[0], 0, 1e-6));
  assert.ok(perto(linha.mensal[14], (0.04 * 60_000_000) / 28, 1));
  // Início/duração vêm do recorte das vendas (mês 12 até o mês 40).
  assert.equal(linha.inicio, 12);
  assert.equal(linha.duracao, 40 - 12 + 1);
});

// #473: a base da Corretagem quanto à permuta física é escolha do estudo.
// VGV total 100M (100 un. × 50m² × 20.000); 30 unidades permutadas
// fisicamente (VGV permutado 30M) → vendável 70M. Corretagem 4%.
test('#473: default (undefined) preserva o comportamento histórico — corretagem sobre o VGV BRUTO, permuta física inclusa', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, tipologia_id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv' },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
        permuta_tipologia_id: 1, permuta_quantidade: 30,
      },
    ],
    areaTerreno: 0,
    // corretagemSobrePermutaFisica OMITIDO de propósito — é o caso real de
    // todo estudo existente antes da #473 (a coluna nasce mas o config não a
    // manda explicitamente até a tela carregar).
  };
  const r = calcularFluxo(config);
  const corretagem = r.linhasCusto.find((l) => l.nome === 'Corretagem de vendas')!;
  // 4% de 100M (bruto) — a permuta física NÃO reduz a base, como antes da #473.
  assert.ok(perto(corretagem.total, 4_000_000, 1));
});

test('#473: corretagemSobrePermutaFisica=false usa o VGV VENDÁVEL, excluindo a permuta física', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, tipologia_id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv' },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
        permuta_tipologia_id: 1, permuta_quantidade: 30,
      },
    ],
    areaTerreno: 0,
    corretagemSobrePermutaFisica: false,
  };
  const r = calcularFluxo(config);
  const corretagem = r.linhasCusto.find((l) => l.nome === 'Corretagem de vendas')!;
  // 4% de 70M (vendável, 100M − 30M permutados).
  assert.ok(perto(corretagem.total, 2_800_000, 1));

  // Mutação: a diferença entre a base bruta e a vendável é EXATAMENTE 4% dos
  // 30M permutados (1,2M) — reintroduzir "sempre bruto" faria este teste
  // devolver 4.000.000 em vez de 2.800.000.
  assert.ok(perto(4_000_000 - corretagem.total, 1_200_000, 1));
});

test('#473: com corretagemSobrePermutaFisica=true explícito, idêntico ao default (paridade)', () => {
  const base = (flag: boolean | undefined): FluxoConfig => ({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, tipologia_id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv' },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
        permuta_tipologia_id: 1, permuta_quantidade: 30,
      },
    ],
    areaTerreno: 0,
    ...(flag === undefined ? {} : { corretagemSobrePermutaFisica: flag }),
  });
  const semFlag = calcularFluxo(base(undefined)).linhasCusto.find((l) => l.nome === 'Corretagem de vendas')!;
  const comTrue = calcularFluxo(base(true)).linhasCusto.find((l) => l.nome === 'Corretagem de vendas')!;
  assert.equal(semFlag.total, comTrue.total);
});

// #473 — achado do Codex (PR #545, rodada 1): quando `orcamento_valor_canonico`
// está persistido (o caso comum — toda edição pela tela grava o R$ congelado
// junto, `tela-fluxo-custos.ts:_editarOrcamento`), a base ESCOLHIDA tinha de
// mudar o TOTAL da corretagem, não só o calendário. Mesma fixture do teste
// acima (VGV 100M, 30 unidades permutadas → vendável 70M), mas com
// `orcamento_valor_canonico` no lugar de `orcamento_valor` puro — o caminho
// que TODA linha de custo editada uma vez pela tela usa de fato.
test('#473 com orcamento_valor_canonico persistido, o TOTAL da corretagem reage à base (não só o calendário)', () => {
  const base = (flag: boolean | undefined): FluxoConfig => ({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, tipologia_id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      // canônico = 4% do VGV bruto (100M) no momento em que foi digitado —
      // o valor R$ FIXO que `_editarOrcamento` grava junto do percentual.
      {
        id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas',
        orcamento_valor: 4, orcamento_unidade: 'pct_vgv', orcamento_valor_canonico: 4_000_000,
      },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
        permuta_tipologia_id: 1, permuta_quantidade: 30,
      },
    ],
    areaTerreno: 0,
    ...(flag === undefined ? {} : { corretagemSobrePermutaFisica: flag }),
  });
  const achar = (c: FluxoConfig) => calcularFluxo(c).linhasCusto.find((l) => l.nome === 'Corretagem de vendas')!;

  const bruta = achar(base(true));
  assert.ok(perto(bruta.total, 4_000_000, 1), `esperado 4.000.000 (bruto), veio ${bruta.total}`);

  const vendavel = achar(base(false));
  // Mutação: SEM a correção, isto continuaria batendo 4.000.000 (o R$
  // congelado redistribuído por peso, sem mudar o total).
  assert.ok(perto(vendavel.total, 2_800_000, 1), `esperado 2.800.000 (vendável), veio ${vendavel.total}`);
  assert.notEqual(vendavel.total, bruta.total, 'a base tem de mudar o TOTAL, não só o calendário');
});

// 5c. Corretagem sem vendas no horizonte não gera desembolso (#121)
test('corretagem sem linhas de receita não gera custo', () => {
  const config: FluxoConfig = {
    dataInicio: null, taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 4, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.ok(perto(r.linhasCusto[0].total, 0, 1e-9));
  assert.equal(r.linhasCusto[0].duracao, 0);
  assert.ok(perto(soma(r.custoMensal), 0, 1e-9));
});

// #194: Preço do Terreno em `sales_revenue` segue o VGV vendido — mesmo
// mecanismo da Corretagem, mas aplicado à linha de Terreno.
test('Preço do Terreno em sales_revenue acompanha o VGV vendido (#194)', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: {
        modo: 'distribuido',
        blocos: [
          { evento: 'lancamento', pct: 40 },  // mês 12
          { evento: 'obra', pct: 60 },        // "Durante a obra": meses 13..40 (28m — #225)
          { evento: 'pos_obra', pct: 0 },
        ],
      },
      fluxo_pagamento: null,
    }],
    linhasCusto: [
      {
        id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 10, orcamento_unidade: 'pct_vgv',
        distribuicao_modo: 'sales_revenue', inicio_mes: 0, duracao_meses: 1,
      },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const linha = r.linhasCusto[0];

  assert.ok(perto(linha.total, 10_000_000, 1)); // 10% de 100M
  assert.ok(perto(linha.mensal[12], 0.10 * 40_000_000, 1)); // 40% vendido no lançamento
  assert.ok(perto(linha.mensal[17], (0.10 * 60_000_000) / 28, 1)); // "Durante a obra" espalhada em 28m
  assert.ok(perto(linha.mensal[0], 0, 1e-6)); // nada antes da 1ª venda
});

// #194: Preço do Terreno em `unit_delivery` segue a receita em CAIXA (entrada +
// parcelas + repasse), não o momento da venda — difere de sales_revenue quando
// há parcelamento/repasse pós-venda.
test('Preço do Terreno em unit_delivery acompanha a receita em caixa, nao o VGV vendido (#194)', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] }, // 100% vendido no mês 12
      fluxo_pagamento: {
        entrada: { modo: 'entrada', parcelas: 1, pct: 20 },
        parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: false, juros: false, pct: 0 },
        repasse: { pct: 80, apos_entrega_meses: 0 }, // #345: ignorado — repasse trava em fim da obra + 1 (mês 41)
      },
    }],
    linhasCusto: [
      {
        id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 10, orcamento_unidade: 'pct_vgv',
        distribuicao_modo: 'unit_delivery', inicio_mes: 0, duracao_meses: 1,
      },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const linha = r.linhasCusto[0];

  assert.ok(perto(linha.total, 10_000_000, 1)); // 10% de 100M
  // 100% vendido no mês 12, mas o CAIXA chega em 2 momentos: entrada (mês 12) e
  // repasse (entrega, mês 41) — sales_revenue concentraria tudo no mês 12.
  assert.ok(perto(linha.mensal[12], 0.10 * 20_000_000, 1)); // 20% de entrada
  assert.ok(linha.mensal[41] > 0); // repasse na entrega
  assert.ok(perto(linha.mensal[13], 0, 1e-6)); // nada entre entrada e repasse
});

// #196: Permuta financeira (subcategoria "Permuta" do Preço do Terreno) é
// dedução da receita — sai de linhasCusto/custoMensal, entra negativa em
// linhasReceita/receitaMensal. vgvTotal (KPI informativo) não muda.
test('Permuta financeira do Preço do Terreno deduz a receita, nao vira custo (#196)', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: {
        modo: 'distribuido',
        blocos: [{ evento: 'lancamento', pct: 40 }, { evento: 'obra', pct: 60 }, { evento: 'pos_obra', pct: 0 }],
      },
      fluxo_pagamento: null,
    }],
    linhasCusto: [
      {
        // #238: sem `distribuicao_modo` — a permuta financeira sempre sai da
        // Receita das vendas, não é mais escolha da linha (armadilha A10).
        id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
        orcamento_valor: 10, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1,
      },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);

  // Some 1 linha em linhasReceita (a dedução) e NENHUMA em linhasCusto.
  assert.equal(r.linhasCusto.length, 0);
  assert.equal(r.linhasReceita.length, 2); // a linha de Vendas + a dedução
  const deducao = r.linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;
  assert.ok(deducao, 'a permuta financeira deve aparecer em linhasReceita');
  assert.ok(perto(deducao.total, -10_000_000, 1)); // -10% de 100M, negativo

  // vgvTotal (KPI informativo, #188) não é afetado por permuta financeira.
  assert.ok(perto(r.vgvTotal, 100_000_000, 1));
  // Receita mensal já vem líquida da dedução (acompanha a receita de caixa).
  assert.ok(perto(r.receitaMensal[12], 40_000_000 - 0.10 * 40_000_000, 1));
  // custoMensal fica zerado — a dedução não é custo.
  assert.ok(perto(soma(r.custoMensal), 0, 1e-6));
  // Resultado final = 100M vendido - 10M de permuta financeira.
  assert.ok(perto(r.fluxoAcumulado[r.prazo - 1], 90_000_000, 1));
});

// #238 (padrao-incorporacao.md §15.2): duas visões no regime de caixa.
test('#238: permuta financeira bruta (default) não deduz imposto/corretagem da base', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 5, orcamento_unidade: 'pct_vgv' },
      { id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira', orcamento_valor: 10, orcamento_unidade: 'pct_vgv' },
    ],
    areaTerreno: 0,
    ret: { ativo: true, pct: 4 }, // #346: RET global ativo — mesmo assim, a base bruta não deduz
  };
  const r = calcularFluxo(config);
  const deducao = r.linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;
  // Default `bruta`: 10% da receita de caixa (100M), sem deduzir RET (4%) nem corretagem (5%).
  assert.ok(perto(deducao.total, -10_000_000, 1));
});

test('#238: permuta financeira líquida deduz imposto e corretagem da base antes do %', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }], // VGV 100M
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 5, orcamento_unidade: 'pct_vgv' },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
        orcamento_valor: 10, orcamento_unidade: 'pct_vgv',
        permuta_financeira_deduzir_imposto: true, permuta_financeira_deduzir_corretagem: true,
      },
    ],
    areaTerreno: 0,
    ret: { ativo: true, pct: 4 }, // #346: RET é global, não mais lido de fluxo_pagamento
  };
  const r = calcularFluxo(config);
  const deducao = r.linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;
  // Base líquida = 100M − 4% RET (4M) − 5% corretagem (5M) = 91M; 10% disso = 9,1M.
  assert.ok(perto(deducao.total, -9_100_000, 1));
});

test('#238: permuta financeira em valor fixo (rs) não distingue bruta/líquida', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira', orcamento_valor: 3_000_000, orcamento_unidade: 'rs' },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const deducao = r.linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;
  // Valor fixo integral (única safra, único mês de receita) — mesma dedução
  // independente dos flags de dedução (não setados aqui).
  assert.ok(perto(deducao.total, -3_000_000, 1));
});

// #257: a subcategoria genérica "Permuta" foi migrada para o rótulo canônico
// (migracoes/015). Depois da migração, nenhuma linha real tem mais o valor
// antigo — este teste prova que, SE alguma linha ainda tivesse (dado que
// escapou da migração), ela vira custo normal em caixa, não dedução da
// receita. Documenta a mudança de comportamento, não a esconde.
test('#257: subcategoria "Permuta" (legada, pré-migração) NÃO é mais reconhecida como financeira', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta', orcamento_valor: 5_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.equal(r.linhasCusto.length, 1); // continua custo, não migrou para receita
  assert.ok(perto(soma(r.custoMensal), 5_000_000, 1));
});

// 6. VPL com taxa zero = soma do fluxo
test('VPL a taxa zero é a soma simples do fluxo', () => {
  const fluxo = [-100, 30, 40, 50];
  assert.ok(perto(vplFluxo(fluxo, 0), 20, 1e-9));
});

// 7. Payback identificado corretamente
test('payback é o primeiro mês com acumulado ≥ 0 após investimento', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12,
    jurosTabelaAaEstudo: 0,
    cronograma: [{ evento: 'lancamento', inicio_mes: 1, duracao_meses: 1 }, { evento: 'obra', inicio_mes: 1, duracao_meses: 2 }, { evento: 'pos_obra', inicio_mes: 3, duracao_meses: 2 }],
    linhasReceita: [{
      id: 1, nome: 'Sales', tipologias: [{ id: 1, quantidade: 1, area_privativa_m2: 100, preco_m2: 3_000 }], // 300k
      absorcao: { modo: 'personalizado', meses: [{ mes: 1, pct: 100 }] },
      fluxo_pagamento: null, // à vista no mês 1
    }],
    linhasCusto: [{ id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 200_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 }],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  // mês 0: -200k; mês 1: +300k → acumulado vira ≥ 0 no índice 1
  assert.equal(r.paybackMes, 1);
  assert.equal(r.paybackData, 'fev/2027');
});

// 8. TIR nula quando o fluxo nunca fica positivo
test('TIR retorna null para fluxo sempre negativo', () => {
  assert.equal(tirFluxo([-100, -50, -20]), null);
});

// 9. Fluxo completo com cronograma real
test('fluxo completo: consolidação, acumulado, TIR e exposição coerentes', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Sales', fase_label: 'Fase 1',
      tipologias: [
        { id: 1, nome: 'Studio', quantidade: 200, area_privativa_m2: 25, preco_m2: 12_000 },   // 60M
        { id: 2, nome: '2 dorms', quantidade: 400, area_privativa_m2: 70, preco_m2: 10_000 },  // 280M
      ],
      absorcao: {
        modo: 'distribuido',
        blocos: [
          { evento: 'lancamento', pct: 30 },
          { evento: 'obra', pct: 35 },
          { evento: 'pos_obra', pct: 35, duracao_meses: 12 },
        ],
      },
      fluxo_pagamento: {
        comissao: { ativo: true, tipo: 'embutida', pct: 6 },
        ret: { ativo: false, pct: 0 },
        entrada: { modo: 'entrada', parcelas: 1, pct: 15 },
        parcelas: { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 },
        repasse: { pct: 70, apos_entrega_meses: 2 },
      },
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 60_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 4_800, orcamento_unidade: 'rs_m2_priv', inicio_mes: 17, duracao_meses: 24, curva_id: 9 },
      { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 12 },
    ],
    curvas: [{ id: 9, nome: 'Curva S', valores: CURVA_S }],
    areaTerreno: 50_000,
  };
  const r = calcularFluxo(config);

  const vgv = 340_000_000;
  const areaPriv = 200 * 25 + 400 * 70; // 33.000 m²
  const custoTotal = 60_000_000 + 4_800 * areaPriv + 0.0125 * vgv;
  assert.ok(perto(r.vgvTotal, vgv, 1));
  assert.ok(perto(soma(r.receitaMensal), vgv, 5));
  assert.ok(perto(soma(r.custoMensal), custoTotal, 5));
  // consolidação: fluxo = receita − custo, mês a mês
  for (let i = 0; i < r.prazo; i++) {
    assert.ok(perto(r.fluxoMensal[i], r.receitaMensal[i] - r.custoMensal[i], 0.01));
  }
  // acumulado final = resultado total
  assert.ok(perto(r.fluxoAcumulado[r.prazo - 1], vgv - custoTotal, 5));
  // projeto lucrativo com desembolso inicial → TIR existe e é positiva
  assert.ok(r.tir !== null && r.tir! > 0);
  // exposição máxima é negativa (terreno à vista no mês 1)
  assert.ok(r.exposicaoMaxima < 0);
  // payback existe e o acumulado é ≥ 0 dali em diante... (no mês do payback)
  assert.ok(r.paybackMes !== null && r.fluxoAcumulado[r.paybackMes!] >= 0);
  // rótulos de calendário ancorados em jan/2027
  assert.equal(r.meses[0], 'jan/27');
  assert.equal(r.meses[12], 'jan/28');
  // tipologias somam a linha
  const linha = r.linhasReceita[0];
  const somaTipologias = linha.itens!.reduce((s, t) => s + t.total, 0);
  assert.ok(perto(somaTipologias, linha.total, 1));
});

// #188/#268: VGV Total / VGV Permuta Física (reservas de unidades em Custos).
test('permuta física usa tipologia/quantidade de Custos e reduz VGV vendável sem caixa', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Sales', fase_label: 'Fase 1',
      tipologias: [
        // 200 un a 12.000/m² × 25m² = 60M — 20 são reservadas na permuta.
        { id: 1, tipologia_id: 1, nome: 'Studio', quantidade: 200, area_privativa_m2: 25, preco_m2: 12_000 },
        // 400 un a 10.000/m² × 70m² = 280M, sem permuta.
        { id: 2, tipologia_id: 2, nome: '2 dorms', quantidade: 400, area_privativa_m2: 70, preco_m2: 10_000 },
      ],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      // A linha não tem orçamento: só reserva tipologia + quantidade (#266).
      { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 20, orcamento_valor: null },
    ],
    areaTerreno: 50_000,
  };
  const r = calcularFluxo(config);

  assert.ok(perto(r.vgvTotal, 340_000_000, 1));
  assert.ok(perto(r.vgvPermutaFisica, 6_000_000, 1)); // 20 × 25 × 12.000
  assert.ok(perto(r.receitaBrutaVgv, 334_000_000, 1));
  assert.ok(perto(r.vgvVendavel, 334_000_000, 1));
  // As unidades permutadas não geram venda, entrada, parcela ou repasse.
  assert.ok(perto(soma(r.receitaMensal), 334_000_000, 5));
  assert.ok(perto(soma(r.custoMensal), 0, 1e-6));
  assert.ok(perto(soma(r.fluxoMensal), 334_000_000, 5));
});

// #268: a mesma tipologia pode aparecer em dois Grupos de Receitas; a reserva
// é consumida uma única vez, sem dupla alocação.
test('#268: permuta física não duplica unidades quando a tipologia aparece em vários Grupos', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [
      { id: 1, tipologias: [{ id: 10, tipologia_id: 7, quantidade: 30, area_privativa_m2: 50, preco_m2: 10_000 }], absorcao: { modo: 'linear' }, fluxo_pagamento: null },
      { id: 2, tipologias: [{ id: 20, tipologia_id: 7, quantidade: 20, area_privativa_m2: 50, preco_m2: 11_000 }], absorcao: { modo: 'linear' }, fluxo_pagamento: null },
    ],
    linhasCusto: [{ id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 7, permuta_quantidade: 40 }],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  // Primeiro Grupo consome 30 unidades; segundo consome 10 — nunca 40 em ambos.
  assert.ok(perto(r.vgvPermutaFisica, 30 * 50 * 10_000 + 10 * 50 * 11_000, 1));
  assert.ok(perto(r.receitaBrutaVgv, 30 * 50 * 10_000 + 10 * 50 * 11_000, 1) === false);
  assert.ok(perto(r.receitaBrutaVgv, 30 * 50 * 10_000 + 20 * 50 * 11_000 - r.vgvPermutaFisica, 1));
  assert.ok(perto(soma(r.custoMensal), 0, 1e-6));
});

// #229 — as seis grandezas com valor nesta fase, e as relações entre elas.
test('#229: taxonomia — bruto, desconto, líquido e Receita Bruta não colidem', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: { entrada: [{ pct: 20, parcelas: 1, descontoPct: 5 }] }, // resto vai a repasse
    }],
    linhasCusto: [],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  // Grandeza 3: bruto contratado = VGV vendável (sem permuta física nesta linha).
  assert.ok(perto(r.vendaBrutaContratada, 10_000_000, 1));
  // Grandeza 4: desconto = 5% de 20% da venda — só a fração da entrada.
  assert.ok(perto(r.descontoComercial, 10_000_000 * 0.20 * 0.05, 1));
  // Grandeza 5: líquido = bruto − desconto (identidade, não coincidência).
  assert.ok(perto(r.vendaLiquidaContratada, r.vendaBrutaContratada - r.descontoComercial, 1e-6));
  // Grandeza 6: Receita Bruta (recebimento em caixa) — sem juros (ainda não
  // implementados, #232+) e sem RET, é igual à venda contratada líquida
  // (critério de aceite da #228: "recebimento_bruto de um Grupo sem juros é
  // igual às suas vendas contratadas").
  assert.ok(perto(r.receitaBruta, r.vendaLiquidaContratada, 1));
  // Nenhuma das quatro é a mesma que vgvVendavel (grandeza 2) — são conceitos
  // distintos mesmo quando os NÚMEROS coincidem neste cenário sem permuta física.
  assert.ok(perto(r.vgvVendavel, 10_000_000, 1));
});

// #195: tipologia 100% permutada não gera receita nem "puxa" fatia do caixa
// da linha (a proporção por tipologia usa VGV VENDÁVEL, não o bruto).
test('tipologia 100% permutada nao gera receita em caixa (#195)', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [
        // Vendável: 300 un a 10.000/m² × 60m² = 180M
        { id: 1, nome: 'Vendável', quantidade: 300, area_privativa_m2: 60, preco_m2: 10_000 },
        // 100% permutada — VGV bruto 60M, vendável 0
        { id: 2, nome: 'Permutada', quantidade: 100, unidades_permutadas: 100, area_privativa_m2: 60, preco_m2: 10_000 },
      ],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);

  assert.ok(perto(r.vgvTotal, 240_000_000, 1)); // bruto: 180M + 60M
  // #268: vgvPermutaFisica não vem mais de `unidades_permutadas` (código
  // morto no Avançado real — nenhuma linha de custo declara a permuta aqui,
  // então é 0; ver teste dedicado abaixo para a fonte nova).
  assert.ok(perto(r.vgvPermutaFisica, 0, 1e-6));
  // Caixa recebido = só o vendável (180M) — a permutada não entra no fluxo.
  assert.ok(perto(soma(r.receitaMensal), 180_000_000, 5));
  const [vendavel, permutada] = r.linhasReceita[0].itens!;
  assert.ok(perto(vendavel.total, 180_000_000, 1));
  assert.ok(perto(permutada.total, 0, 1e-6));
});

// #268 (substitui o ADR da #266 citado aqui antes): o VALOR DECLARADO na
// linha de custo deixou de existir como fonte — a #268 passou a derivar o
// VGV de permuta física do preço/m² e área da tipologia CORRESPONDENTE em
// Receitas (ver "permuta física usa tipologia/quantidade de Custos..." acima).
// Sem tipologia correspondente em nenhum Grupo de Receitas, a reserva não tem
// o que precificar — o KPI é 0, não a soma de `orcamento_valor`.
test('#268: reserva sem tipologia correspondente em Receitas não pode ser precificada', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 5, orcamento_valor: 2_000_000, orcamento_unidade: 'rs' },
      { id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 2, permuta_quantidade: 3, orcamento_valor: 500_000, orcamento_unidade: 'rs' },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.ok(perto(r.vgvPermutaFisica, 0, 1e-6));
  // Não é custo em caixa — não aparece em linhasCusto nem em custoMensal.
  assert.equal(r.linhasCusto.length, 0);
  assert.ok(perto(soma(r.custoMensal), 0, 1e-6));
});

test('#268: linha Permuta física com valor declarado em branco (migração #267) conta como 0, sem quebrar', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 5, orcamento_valor: null, orcamento_unidade: 'rs' },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.equal(r.vgvPermutaFisica, 0);
});

// Cenários (Etapa 8 · #56): aplicarCenario escala preço de venda e custo de obra.
test('aplicarCenario escala preço/m² das tipologias e orçamento de obra', () => {
  const base: FluxoConfig = {
    dataInicio: null, taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 50M
      absorcao: { modo: 'linear' }, fluxo_pagamento: null,
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 5_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 20_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
    ],
    areaTerreno: 10_000,
  };

  // Base: VGV 50M, custo total 25M.
  const rBase = calcularFluxo(base);
  assert.ok(perto(rBase.vgvTotal, 50_000_000, 1));

  // Cenário: +10% preço, +20% custo de obra.
  const rCen = calcularFluxo(aplicarCenario(base, { precoVendaPct: 10, custoObraPct: 20 }));
  assert.ok(perto(rCen.vgvTotal, 55_000_000, 1)); // 50M × 1,10
  // custo total = terreno 5M + obra 20M×1,20 = 5M + 24M = 29M
  assert.ok(perto(soma(rCen.custoMensal), 29_000_000, 5));
  // terreno intacto (grupo ≠ obra)
  assert.ok(perto(base.linhasCusto[0].orcamento_valor, 5_000_000, 0.01));

  // pureza: a config-base não foi mutada
  assert.equal(base.linhasReceita[0].tipologias[0].preco_m2, 10_000);
  assert.equal(base.linhasCusto[1].orcamento_valor, 20_000_000);

  // cenário-zero = base
  const rZero = calcularFluxo(aplicarCenario(base, { precoVendaPct: 0, custoObraPct: 0 }));
  assert.ok(perto(rZero.vgvTotal, rBase.vgvTotal, 1));
  assert.ok(perto(soma(rZero.custoMensal), soma(rBase.custoMensal), 1));
});

// View Anual (S17 · #127): agregação de colunas mensais em anos-calendário.
test('agregarFluxoPorPeriodos: soma anual bate com a mensal em TODAS as linhas', () => {
  const config: FluxoConfig = {
    dataInicio: 'abr/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas', fase_label: 'Fase 1',
      tipologias: [
        { id: 1, nome: 'Studio', quantidade: 100, area_privativa_m2: 30, preco_m2: 10_000 },
        { id: 2, nome: '2 dorms', quantidade: 80, area_privativa_m2: 70, preco_m2: 9_000 },
      ],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 40 }, { evento: 'obra', pct: 40 }] },
      fluxo_pagamento: null,
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 12_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 30_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
      { id: 3, grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM, orcamento_valor: 4, orcamento_unidade: 'pct_vgv' },
    ],
    areaTerreno: 20_000,
  };
  const mensal = calcularFluxo(config);
  const periodos = periodosAnuais('abr/2027', mensal.prazo);
  const anual = agregarFluxoPorPeriodos(mensal, periodos);

  // Colunas viram anos; o 1º ano é parcial (abr→dez).
  assert.equal(anual.prazo, periodos.length);
  assert.ok(anual.prazo < mensal.prazo);
  assert.equal(anual.meses[0], '2027');
  assert.equal(anual.meses[1], '2028');

  // Toda série de fluxo conserva a soma — inclusive linhas e tipologias.
  const mesmaSoma = (a: number[], b: number[], nome: string) =>
    assert.ok(perto(soma(a), soma(b), 0.01), `${nome}: soma anual ≠ soma mensal`);
  mesmaSoma(anual.receitaMensal, mensal.receitaMensal, 'receita');
  mesmaSoma(anual.vendaBrutaContratadaMensal, mensal.vendaBrutaContratadaMensal, 'venda bruta contratada');
  mesmaSoma(anual.descontoComercialMensal, mensal.descontoComercialMensal, 'desconto comercial');
  mesmaSoma(anual.vendaLiquidaContratadaMensal, mensal.vendaLiquidaContratadaMensal, 'venda líquida contratada');
  mesmaSoma(anual.receitaBrutaMensal, mensal.receitaBrutaMensal, 'receita bruta');
  mesmaSoma(anual.custoMensal, mensal.custoMensal, 'custo');
  mesmaSoma(anual.fluxoMensal, mensal.fluxoMensal, 'fluxo');
  for (let i = 0; i < mensal.linhasReceita.length; i++) {
    const lm = mensal.linhasReceita[i]; const la = anual.linhasReceita[i];
    mesmaSoma(la.mensal, lm.mensal, `receita ${lm.nome}`);
    assert.ok(perto(soma(la.mensal), la.total, 0.01), 'linha: colunas somam o Total');
    for (let j = 0; j < (lm.itens ?? []).length; j++) {
      mesmaSoma(la.itens![j].mensal, lm.itens![j].mensal, `tipologia ${lm.itens![j].nome}`);
    }
  }
  for (let i = 0; i < mensal.linhasReceitaBruta.length; i++) {
    const lm = mensal.linhasReceitaBruta[i]; const la = anual.linhasReceitaBruta[i];
    mesmaSoma(la.mensal, lm.mensal, `receita bruta ${lm.nome}`);
    assert.ok(perto(soma(la.mensal), la.total, 0.01), 'linha bruta: colunas somam o Total');
    for (let j = 0; j < (lm.itens ?? []).length; j++) {
      mesmaSoma(la.itens![j].mensal, lm.itens![j].mensal, `tipologia bruta ${lm.itens![j].nome}`);
    }
  }
  for (let i = 0; i < mensal.linhasVendasContratadas.length; i++) {
    const lm = mensal.linhasVendasContratadas[i]; const la = anual.linhasVendasContratadas[i];
    mesmaSoma(la.mensal, lm.mensal, `vendas contratadas ${lm.nome}`);
    for (let j = 0; j < (lm.itens ?? []).length; j++) {
      mesmaSoma(la.itens![j].mensal, lm.itens![j].mensal, `venda tipologia ${lm.itens![j].nome}`);
    }
  }
  for (const chave of ['aVista', 'tabelaCurta', 'tabelaLongaObra', 'repasse', 'aposChaves', 'outros'] as const) {
    mesmaSoma(anual.receitaPorComponenteMensal[chave], mensal.receitaPorComponenteMensal[chave], `componente ${chave}`);
  }
  for (const chave of ['tabelaCurta', 'tabelaLongaObra', 'saldoARepassar'] as const) {
    periodos.forEach((p, k) => assert.equal(
      anual.carteiraPorComponenteMensal[chave][k], mensal.carteiraPorComponenteMensal[chave][p.fim] ?? 0));
  }
  for (let i = 0; i < mensal.linhasCusto.length; i++) {
    mesmaSoma(anual.linhasCusto[i].mensal, mensal.linhasCusto[i].mensal, `custo ${mensal.linhasCusto[i].nome}`);
  }
  // cada coluna anual = soma dos meses da sua faixa
  periodos.forEach((p, k) => {
    assert.ok(perto(anual.fluxoMensal[k], soma(mensal.fluxoMensal.slice(p.inicio, p.fim + 1)), 0.01));
  });
});

test('agregarFluxoPorPeriodos: acumulado é o saldo do ÚLTIMO mês do ano, não a soma', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, nome: 'Lote', quantidade: 100, area_privativa_m2: 250, preco_m2: 2_000 }],
      absorcao: { modo: 'linear' }, fluxo_pagamento: null,
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 10_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    ],
    areaTerreno: 25_000,
  };
  const mensal = calcularFluxo(config);
  const periodos = periodosAnuais('jan/2027', mensal.prazo);
  const anual = agregarFluxoPorPeriodos(mensal, periodos);

  periodos.forEach((p, k) => {
    assert.ok(perto(anual.fluxoAcumulado[k], mensal.fluxoAcumulado[p.fim], 0.01),
      `ano ${p.rotulo}: acumulado = saldo no mês ${p.fim}`);
  });
  // saldo final é o mesmo nas duas views
  assert.ok(perto(anual.fluxoAcumulado[anual.prazo - 1], mensal.fluxoAcumulado[mensal.prazo - 1], 0.01));
  // acumulado anual também é a soma corrida dos fluxos anuais
  let acc = 0;
  anual.fluxoMensal.forEach((v, k) => { acc += v; assert.ok(perto(acc, anual.fluxoAcumulado[k], 0.01)); });

  // Indicadores NÃO mudam com a view (são do fluxo mensal) e a entrada não é mutada.
  assert.equal(anual.vpl, mensal.vpl);
  assert.equal(anual.tir, mensal.tir);
  assert.equal(anual.exposicaoMaxima, mensal.exposicaoMaxima);
  assert.equal(anual.paybackMes, mensal.paybackMes);
  assert.equal(anual.paybackData, mensal.paybackData);
  assert.equal(anual.vgvTotal, mensal.vgvTotal);
  assert.equal(mensal.meses[0], 'jan/27');
  assert.equal(mensal.fluxoMensal.length, mensal.prazo);
});

// ─────────────────────────────────────────────────────────────────
// #230 — Adapter do legado para o contrato de componentes de pagamento
// ─────────────────────────────────────────────────────────────────

test('componentesDoLegado: sem fluxo_pagamento — um único imediato de 100%', () => {
  const r = componentesDoLegado(null, CRONO, 0);
  assert.deepEqual(r, [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }]);
});

test('componentesDoLegado: entrada com 1 parcela → imediato, com desconto (#227)', () => {
  // 20% na entrada; o resto (80%) vira repasse derivado → concentrado.
  const fp = { entrada: [{ pct: 20, parcelas: 1, descontoPct: 5 }] };
  const r = componentesDoLegado(fp, CRONO, 0);
  assert.equal(r.length, 2); // imediato (entrada) + concentrado (repasse)
  assert.deepEqual(r[0], { tipo: 'imediato', participacaoPct: 20, descontoPct: 5 });
  assert.equal(r[1].tipo, 'concentrado');
});

test('componentesDoLegado: entrada com várias parcelas → prazo_fixo com defasagem 0 (1ª no mês da venda, como hoje)', () => {
  // 30% na entrada; o resto (70%) vira repasse derivado → concentrado.
  const fp = { entrada: [{ pct: 30, parcelas: 4 }] };
  const r = componentesDoLegado(fp, CRONO, 0);
  assert.equal(r.length, 2); // prazo_fixo (entrada) + concentrado (repasse)
  assert.equal(r[0].tipo, 'prazo_fixo');
  const c = r[0] as any;
  assert.equal(c.participacaoPct, 30);
  assert.equal(c.prazoMeses, 4);
  assert.equal(c.defasagemMeses, 0);
  assert.equal(c.taxaMensal, 0);
});

test('componentesDoLegado: parcelamento "ao longo da obra" → ate_marco no fim da Obra do cronograma', () => {
  // 40% ao longo da obra; o resto (60%) vira repasse derivado → concentrado.
  const fp = { parcelas: [{ pct: 40, ao_longo_obra: true, periodicidade: 'mensal' }] };
  const r = componentesDoLegado(fp, CRONO, 0);
  assert.equal(r.length, 2); // ate_marco (parcelas) + concentrado (repasse)
  assert.equal(r[0].tipo, 'ate_marco');
  const c = r[0] as any;
  assert.equal(c.participacaoPct, 40);
  const obra = CRONO.find((e) => e.evento === 'obra')!;
  assert.equal(c.marcoMes, obra.inicio_mes + obra.duracao_meses - 1);
  assert.equal(c.defasagemMeses, 1);
});

test('componentesDoLegado: parcelamento sem "ao longo da obra" → prazo_fixo com defasagem = periodicidade', () => {
  // 25% em parcelamento; o resto (75%) vira repasse derivado → concentrado.
  const fp = { parcelas: [{ pct: 25, ao_longo_obra: false, periodicidade: 'trimestral', parcelas: 6 }] };
  const r = componentesDoLegado(fp, CRONO, 0);
  assert.equal(r.length, 2); // prazo_fixo (parcelas) + concentrado (repasse)
  assert.equal(r[0].tipo, 'prazo_fixo');
  const c = r[0] as any;
  assert.equal(c.prazoMeses, 6);
  assert.equal(c.defasagemMeses, 3); // trimestral = intervalo 3
});

test('#455 componentesDoLegado: sinal do Parcelamento chega a sinalPct (ate_marco e prazo_fixo)', () => {
  const fp = {
    parcelas: [
      { pct: 40, ao_longo_obra: true, periodicidade: 'mensal', sinalPct: 15 },
      { pct: 25, ao_longo_obra: false, periodicidade: 'trimestral', parcelas: 6, sinalPct: 8.5 },
    ],
  };
  const r = componentesDoLegado(fp, CRONO, 0) as any[];
  const ateMarco = r.find((c) => c.tipo === 'ate_marco');
  const prazoFixo = r.find((c) => c.tipo === 'prazo_fixo');
  assert.equal(ateMarco.sinalPct, 15);
  assert.equal(prazoFixo.sinalPct, 8.5);

  // Regressão: sem a chave (todo estudo anterior a esta issue), continua 0.
  const semSinal = componentesDoLegado(
    { parcelas: [{ pct: 40, ao_longo_obra: true, periodicidade: 'mensal' }] }, CRONO, 0
  ) as any[];
  assert.equal(semSinal.find((c) => c.tipo === 'ate_marco').sinalPct, 0);
});

test('#455 componentesDoLegado: Entrada parcelada NÃO ganha campo de sinal — decisão declarada', () => {
  // O sinal é da seção "Parcelamento"; Entrada com `parcelas > 1` também vira
  // `prazo_fixo`, mas fica sempre em 0 — mesmo que a chave exista no dado
  // persistido (ela não deveria existir ali, mas o motor não confia nisso).
  const fp = { entrada: [{ pct: 20, parcelas: 3, sinalPct: 99 } as any] };
  const r = componentesDoLegado(fp, CRONO, 0) as any[];
  assert.equal(r.find((c) => c.tipo === 'prazo_fixo').sinalPct, 0);
});

test('#345 componentesDoLegado: repasse deriva concentrado no mês fixo (fim da Obra + 1, travado)', () => {
  // `apos_entrega_meses: 2` é persistido mas IGNORADO — o offset é sempre 1,
  // inclusive para estudo legado com outro valor gravado.
  const fp = { entrada: [{ pct: 15, parcelas: 1 }], repasse: { apos_entrega_meses: 2 } };
  const r = componentesDoLegado(fp, CRONO, 0);
  const concentrado = r.find((c) => c.tipo === 'concentrado') as any;
  assert.ok(concentrado);
  assert.ok(perto(concentrado.participacaoPct, 85, 1e-6)); // 100 − 15 (derivado)
  const obra = CRONO.find((e) => e.evento === 'obra')!;
  assert.equal(concentrado.mesPagamento, obra.inicio_mes + obra.duracao_meses - 1 + 1);
});

test('componentesDoLegado: participação total sempre fecha 100% (entrada+parcelas+repasse derivado)', () => {
  const fp = {
    entrada: [{ pct: 10, parcelas: 1 }, { pct: 5, parcelas: 3 }],
    parcelas: [{ pct: 15, ao_longo_obra: true }, { pct: 10, ao_longo_obra: false, periodicidade: 'semestral', parcelas: 2 }],
    repasse: { apos_entrega_meses: 1 },
  };
  const r = componentesDoLegado(fp, CRONO, 0);
  const total = r.reduce((s, c: any) => s + c.participacaoPct, 0);
  assert.ok(perto(total, 100, 1e-6));
  assert.equal(r.length, 5); // 2 entradas + 2 parcelas + 1 repasse
});

test('componentesDoLegado: sem repasse (100% já coberto por entrada+parcelas) não cria concentrado', () => {
  const fp = { entrada: [{ pct: 100, parcelas: 1 }] };
  const r = componentesDoLegado(fp, CRONO, 0);
  assert.equal(r.length, 1);
  assert.ok(!r.some((c) => c.tipo === 'concentrado'));
});

// ─────────────────────────────────────────────────────────────────
// #231 — Horizonte derivado de todos os componentes e todas as safras
// ─────────────────────────────────────────────────────────────────

test('ultimoMesRecebivelLinha: sem fluxo_pagamento é o fim do Após-chaves (à vista no mês da venda)', () => {
  const linha = { fluxo_pagamento: null };
  const r = ultimoMesRecebivelLinha(linha, CRONO, 0);
  const pos = CRONO.find((e) => e.evento === 'pos_obra')!;
  assert.equal(r, pos.inicio_mes + pos.duracao_meses - 1);
});

test('ultimoMesRecebivelLinha: entrada com muitas parcelas estende além do fim do Após-chaves', () => {
  const linha = { fluxo_pagamento: { entrada: [{ pct: 100, parcelas: 60 }] } };
  const r = ultimoMesRecebivelLinha(linha, CRONO, 0);
  const pos = CRONO.find((e) => e.evento === 'pos_obra')!;
  const fimAposChaves = pos.inicio_mes + pos.duracao_meses - 1;
  assert.equal(r, fimAposChaves + 59); // última safra + 59 parcelas restantes
  assert.ok(r > fimAposChaves); // maior que o cronograma isoladamente
});

test('ultimoMesRecebivelLinha: parcelamento por periodicidade (sem "ao longo da obra") considera intervalo × parcelas', () => {
  const linha = { fluxo_pagamento: { parcelas: [{ pct: 100, ao_longo_obra: false, periodicidade: 'semestral', parcelas: 8 }] } };
  const r = ultimoMesRecebivelLinha(linha, CRONO, 0);
  const pos = CRONO.find((e) => e.evento === 'pos_obra')!;
  const fimAposChaves = pos.inicio_mes + pos.duracao_meses - 1;
  assert.equal(r, fimAposChaves + 6 * 8); // semestral = intervalo 6
});

test('#345 ultimoMesRecebivelLinha: repasse legado com offset distante NÃO estende mais o horizonte (travado em 1)', () => {
  const linha = { fluxo_pagamento: { entrada: [{ pct: 20, parcelas: 1 }], repasse: { apos_entrega_meses: 36 } } };
  const r = ultimoMesRecebivelLinha(linha, CRONO, 0);
  const pos = CRONO.find((e) => e.evento === 'pos_obra')!;
  const fimAposChaves = pos.inicio_mes + pos.duracao_meses - 1;
  // Antes da #345, um `apos_entrega_meses` legado grande (36) estendia o
  // horizonte além do fim do Após-chaves (fimObra + 36 = 76 > 52). Agora o
  // offset é travado em 1 (mês 41) — bem dentro do baseline — então o
  // repasse deixa de ser o termo dominante e o horizonte fica no baseline.
  assert.equal(r, fimAposChaves);
});

// Regressão de ponta a ponta: ANTES da #231, o horizonte derivava só de
// `ultimoCrono + maxRepasse` — uma entrada de 60 parcelas SEM repasse (e sem
// eventos de custo longos) ficava de fora, e a 60ª parcela era empilhada no
// último mês em silêncio. Agora o horizonte cobre a linha inteira.
test('#231: calcularFluxo não trunca nem empilha uma entrada de 60 parcelas no último mês', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // VGV 10M
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: { entrada: [{ pct: 100, parcelas: 60 }] }, // sem repasse (100% já coberto)
    }],
    linhasCusto: [],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  const mesVenda = 12;
  const ultimaParcelaReal = mesVenda + 59; // 71: 60 parcelas a partir do mês 12
  // Horizonte ANTIGO (ultimoCrono + maxRepasse, sem repasse configurado) era
  // só o fim do cronograma (pos_obra, mês 52) — bem menor que a 60ª parcela.
  const horizonteAntigo = CRONO.find((e) => e.evento === 'pos_obra')!;
  const ultimoMesAntigo = horizonteAntigo.inicio_mes + horizonteAntigo.duracao_meses - 1;
  assert.ok(ultimaParcelaReal > ultimoMesAntigo, 'pré-condição: a 60ª parcela excede o horizonte antigo');
  assert.ok(r.prazo > ultimaParcelaReal, `prazo (${r.prazo}) deveria cobrir até ${ultimaParcelaReal}`);
  // Nada se perde: a soma bate com o VGV (cada parcela igual a 10M/60).
  assert.ok(perto(soma(r.receitaMensal), 10_000_000, 1));
  // A última parcela cai no mês CORRETO — não empilhada no horizonte antigo.
  assert.ok(perto(r.receitaMensal[ultimaParcelaReal], 10_000_000 / 60, 1));
  assert.ok(perto(r.receitaMensal[ultimoMesAntigo], 10_000_000 / 60, 1)); // só a parcela normal deste mês, sem excedente empilhado
});

// ─────────────────────────────────────────────────────────────────
// #232 — Motor de safras: PMT e componente prazo_fixo
// ─────────────────────────────────────────────────────────────────

test('pmt: taxa zero é divisão simples; n<=0 é 0', () => {
  assert.equal(pmt(0, 12, 1200), 100);
  assert.equal(pmt(0, 0, 1000), 0);
  assert.equal(pmt(0.01, 0, 1000), 0);
});

test('pmt: taxa positiva reproduz a parcela da tabela curta do Anexo G.1 (Calliandra)', () => {
  // taxa mensal = 1,15^(1/12) - 1 = 1,1714917% a.m.; principal = 13,3% × 85% × 2.860.111,52
  const taxaMensal = Math.pow(1.15, 1 / 12) - 1;
  const principal = 0.133 * 0.85 * 2_860_111.52;
  assert.ok(Math.abs(pmt(taxaMensal, 36, principal) - 11_059.94) < 0.01);
});

test('pagamentosPrazoFixo: sinal no mês da safra, parcelas de safra+1 até safra+prazo (padrão novo)', () => {
  const taxaMensal = Math.pow(1.15, 1 / 12) - 1;
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 13.3, sinalPct: 15, prazoMeses: 36,
    defasagemMeses: 1, taxaMensal, jurosNoMesDaContratacao: false,
  };
  const pagamentos = pagamentosPrazoFixo(c, 1, 2_860_111.52);
  const sinal = pagamentos.find((p) => p.tipo === 'sinal')!;
  assert.ok(perto(sinal.valor, 0.133 * 0.15 * 2_860_111.52, 1)); // R$ 57.059,22 (Anexo G.1)
  const parcelas = pagamentos.filter((p) => p.tipo === 'parcela');
  assert.equal(parcelas.length, 36);
  assert.equal(Math.min(...parcelas.map((p) => p.mes)), 2); // safra 1 + defasagem 1 = mês 2
  assert.equal(Math.max(...parcelas.map((p) => p.mes)), 37); // última parcela = 1 + 1 + 36 - 1
  for (const p of parcelas.slice(0, -1)) assert.equal(p.valor, 11_059.94);
  assert.equal(parcelas[35].valor, 11_059.93); // resíduo de centavos da 36ª
});

test('pagamentosPrazoFixo: sem sinal e taxa zero, VP das parcelas = valor contratado (fecha 100%)', () => {
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 12,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  const pagamentos = pagamentosPrazoFixo(c, 5, 1_200_000);
  assert.equal(pagamentos.length, 12); // sem sinal
  assert.ok(pagamentos.every((p) => p.tipo === 'parcela'));
  assert.ok(perto(soma(pagamentos.map((p) => p.valor)), 1_200_000, 1e-6));
  assert.equal(Math.min(...pagamentos.map((p) => p.mes)), 6); // 5+1
  assert.equal(Math.max(...pagamentos.map((p) => p.mes)), 17); // 5+1+12-1
});

test('pagamentosPrazoFixo: 36ª parcela absorve o resíduo de centavos, sem criar 37ª', () => {
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 15, prazoMeses: 36,
    defasagemMeses: 1, taxaMensal: Math.pow(1.15, 1 / 12) - 1, jurosNoMesDaContratacao: false,
  };
  const pagamentos = pagamentosPrazoFixo(c, 0, 2_860_111.52);
  const parcelas = pagamentos.filter((p) => p.tipo === 'parcela');
  const principal = 2_860_111.52 - pagamentos.find((p) => p.tipo === 'sinal')!.valor;
  const totalEsperado = Math.round(pmt(c.taxaMensal, 36, principal) * 36 * 100) / 100;
  assert.equal(parcelas.length, 36);
  assert.equal(Math.round(soma(parcelas.map((p) => p.valor)) * 100) / 100, totalEsperado);
  assert.notEqual(parcelas[35].valor, parcelas[0].valor); // somente a última recebe o resíduo
});

test('pagamentosPrazoFixo: valorContratado <= 0 não gera pagamento', () => {
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 12,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  assert.deepEqual(pagamentosPrazoFixo(c, 5, 0), []);
});

test('pagamentosPrazoFixo: defasagemMeses=0 (adapter legado) tem 1ª parcela NO mês da safra', () => {
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 0, prazoMeses: 4,
    defasagemMeses: 0, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  const pagamentos = pagamentosPrazoFixo(c, 12, 1_000_000);
  assert.equal(Math.min(...pagamentos.map((p) => p.mes)), 12); // mesmo mês da venda, como hoje
  assert.equal(Math.max(...pagamentos.map((p) => p.mes)), 15); // 12+0+4-1
});

// ─────────────────────────────────────────────────────────────────
// #233 — Componente até marco: N_s = M − s, erro se N_s ≤ 0
// ─────────────────────────────────────────────────────────────────

test('pagamentosAteMarco: N_s = marco − safra (varia por safra), 1ª parcela em s+1, última no marco', () => {
  const c: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 15, sinalPct: 0, marcoMes: 24,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  // Safra 1 (venda cedo): N_1 = 24-1 = 23 parcelas.
  const p1 = pagamentosAteMarco(c, 1, 2_378_978.36);
  assert.equal(p1.length, 23);
  assert.equal(Math.min(...p1.map((p) => p.mes)), 2);  // s+1
  assert.equal(Math.max(...p1.map((p) => p.mes)), 24); // marco
  // Safra 12 (venda tardia): N_12 = 24-12 = 12 parcelas — MENOS que a safra 1.
  const p12 = pagamentosAteMarco(c, 12, 2_378_978.36);
  assert.equal(p12.length, 12);
  assert.equal(Math.max(...p12.map((p) => p.mes)), 24); // sempre termina no marco
  // Mesmo principal, menos parcelas → parcela MAIOR (venda tardia paga mais por mês).
  assert.ok(p12[0].valor > p1[0].valor);
});

test('pagamentosAteMarco: N_s ≤ 0 (venda no marco ou depois) lança erro, nunca prazo negativo', () => {
  const c: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 24,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  assert.throws(() => pagamentosAteMarco(c, 24, 1_000_000), /N_s.*≤ 0|prazo negativo/);
  assert.throws(() => pagamentosAteMarco(c, 25, 1_000_000), /N_s.*≤ 0|prazo negativo/);
  // Safra no mês imediatamente anterior ao marco: N_s = 1, ainda válido.
  const r = pagamentosAteMarco(c, 23, 1_000_000);
  assert.equal(r.length, 1);
  assert.equal(r[0].mes, 24);
});

test('pagamentosAteMarco: valorContratado <= 0 não gera pagamento nem avalia N_s', () => {
  const c: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 5, // marco já passado
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  assert.deepEqual(pagamentosAteMarco(c, 10, 0), []); // não lança, mesmo com N_s negativo
});

test('#233: última parcela até marco absorve os centavos e encerra exatamente no marco', () => {
  const c: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 7,
    defasagemMeses: 1, taxaMensal: 0.01, jurosNoMesDaContratacao: false,
  };
  const pagamentos = pagamentosAteMarco(c, 1, 1_000_000);
  const totalEsperado = Math.round(pmt(0.01, 6, 1_000_000) * 6 * 100) / 100;
  assert.equal(pagamentos.length, 6);
  assert.equal(pagamentos.at(-1)!.mes, 7);
  assert.ok(pagamentos.every((p) => Number.isInteger(p.valor * 100)));
  assert.equal(Math.round(soma(pagamentos.map((p) => p.valor)) * 100) / 100, totalEsperado);
});

// Reconciliação de ponta a ponta contra o Anexo G.2 (Calliandra até Obra +
// repasse): base uniforme 2.378.978,36/mês nos meses 1-12; componente
// até-marco de 15%, marco=24, taxa zero.
test('#233: soma de todas as safras reproduz os meses 1, 13-24 do Anexo G.2', () => {
  const c: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 15, sinalPct: 0, marcoMes: 24,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  const basePorSafra = 2_378_978.36;
  const porMes = new Map<number, number>();
  for (let s = 1; s <= 12; s++) {
    for (const p of pagamentosAteMarco(c, s, basePorSafra)) {
      porMes.set(p.mes, (porMes.get(p.mes) ?? 0) + p.valor);
    }
  }
  // Mês 2: só a safra 1 já venceu (1ª parcela em s+1); a safra 2 só paga a
  // partir do mês 3. Testamos SÓ o componente até-marco isoladamente — o
  // documento G.2 soma isso à entrada (15%, imediata) para o "mês 1" dele.
  assert.ok(perto(porMes.get(2) ?? 0, (basePorSafra * 0.15) / 23, 1)); // só a safra 1, N_1=23
  assert.ok(perto(porMes.get(13) ?? 0, 254_936.38, 1)); // todas as 12 safras ativas
  assert.ok(perto(porMes.get(24) ?? 0, 254_936.38, 1)); // último mês, ainda todas ativas
  assert.equal(porMes.has(25), false); // nada além do marco
});

// ─────────────────────────────────────────────────────────────────
// #234 — Componente concentrado: juros depois da contratação, liquidação
// ─────────────────────────────────────────────────────────────────

test('pagamentosConcentrado: taxa zero paga exatamente o principal (repasse legado, Anexo G.2)', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 70, mesPagamento: 25, taxaMensal: 0,
  };
  // Soma de todas as 12 safras (base uniforme 2.378.978,36/mês) → 70% da base total.
  const baseTotal = 12 * 2_378_978.36;
  let soma25 = 0;
  for (let s = 1; s <= 12; s++) soma25 += pagamentosConcentrado(c, s, 2_378_978.36)[0].valor;
  assert.ok(perto(soma25, baseTotal * 0.70, 1)); // R$ 19.983.418,20 (Anexo G.2)
  assert.ok(perto(soma25, 19_983_418.20, 1));
});

test('pagamentosConcentrado: juros começam DEPOIS da contratação (saldo_s,s = principal_s)', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 100, mesPagamento: 13, taxaMensal: 0.01, // 1% a.m.
  };
  const r = pagamentosConcentrado(c, 1, 1_000_000);
  // 12 meses de juros (do mês 2 ao 13 — a contratação em si, mês 1, não capitaliza).
  assert.ok(perto(r[0].valor, 1_000_000 * Math.pow(1.01, 12), 0.01));
  // Pagamento na PRÓPRIA safra (sem meses de capitalização) = só o principal.
  const semJuros = pagamentosConcentrado(c, 13, 1_000_000);
  assert.ok(perto(semJuros[0].valor, 1_000_000, 1e-6));
});

test('pagamentosConcentrado: participacaoPct ou valorContratado <= 0 não gera pagamento', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 0, mesPagamento: 25, taxaMensal: 0,
  };
  assert.deepEqual(pagamentosConcentrado(c, 1, 1_000_000), []);
  const c2 = { ...c, participacaoPct: 70 };
  assert.deepEqual(pagamentosConcentrado(c2, 1, 0), []);
});

test('pagamentosConcentrado: liquidação integral — um único pagamento no mês do marco', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 50, mesPagamento: 40, taxaMensal: 0.005,
  };
  const r = pagamentosConcentrado(c, 10, 2_000_000);
  assert.equal(r.length, 1);
  assert.equal(r[0].mes, 40);
  assert.equal(r[0].tipo, 'concentrado');
});

test('#234: repasse é monetário, nunca antecede a contratação e liquida múltiplas safras no marco', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 70, mesPagamento: 25, taxaMensal: 0.01,
  };
  const pagamentos = [1, 2, 12].flatMap((safra) => pagamentosConcentrado(c, safra, 1_000_000));
  assert.equal(pagamentos.length, 3);
  assert.ok(pagamentos.every((p) => p.mes === 25 && p.valor === Number(p.valor.toFixed(2))));
  assert.throws(() => pagamentosConcentrado(c, 26, 1_000_000), /anterior à safra|não pode ser antecipado/);
});

// ─────────────────────────────────────────────────────────────────
// #236 — Carteira: saldo por safra e componente, nunca agregado
// ─────────────────────────────────────────────────────────────────

test('carteiraSaldoSafra: imediato não tem saldo (paga e encerra no próprio mês)', () => {
  const c: Extract<ComponentePagamento, { tipo: 'imediato' }> = {
    tipo: 'imediato', participacaoPct: 20, descontoPct: 5,
  };
  assert.deepEqual(carteiraSaldoSafra(c, 1, 1_000_000), []);
});

test('carteiraSaldoSafra: prazo_fixo taxa zero — saldo decai linearmente e zera na última parcela', () => {
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 4,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  const saldos = carteiraSaldoSafra(c, 10, 400);
  // safra 10: saldo=400; parcela=100/mês a partir de 11.
  assert.deepEqual(saldos.map((s) => [s.mes, s.saldo]), [
    [10, 400], [11, 300], [12, 200], [13, 100], [14, 0],
  ]);
});

test('carteiraSaldoSafra: até marco com juros — nunca negativo e zera exatamente no marco', () => {
  const c: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 15, sinalPct: 0, marcoMes: 24,
    defasagemMeses: 1, taxaMensal: 0.01, jurosNoMesDaContratacao: false,
  };
  const saldos = carteiraSaldoSafra(c, 3, 2_378_978.36);
  assert.equal(saldos[0].mes, 3);
  assert.equal(saldos.at(-1)!.mes, 24);
  assert.equal(saldos.at(-1)!.saldo, 0);
  for (const s of saldos) assert.ok(s.saldo >= 0, `saldo negativo em mes=${s.mes}`);
  // Saldo estritamente decrescente (sem ressurgimento) até zerar.
  for (let i = 1; i < saldos.length; i++) assert.ok(saldos[i].saldo <= saldos[i - 1].saldo + 1e-6);
});

test('carteiraSaldoSafra: concentrado acumula juros até o pagamento e zera nele', () => {
  const c: Extract<ComponentePagamento, { tipo: 'concentrado' }> = {
    tipo: 'concentrado', participacaoPct: 100, mesPagamento: 13, taxaMensal: 0.01,
  };
  const saldos = carteiraSaldoSafra(c, 1, 1_000_000);
  assert.equal(saldos[0].saldo, 1_000_000); // saldo_{s,s} = principal_s (#234)
  assert.ok(perto(saldos.find((s) => s.mes === 12)!.saldo, 1_000_000 * Math.pow(1.01, 11), 0.01));
  assert.equal(saldos.at(-1)!.mes, 13);
  assert.equal(saldos.at(-1)!.saldo, 0);
});

test('carteiraSaldoSafra: duas safras do mesmo componente NUNCA se somam num saldo único', () => {
  // O defeito do Urbitá é justamente agregar safras num acumulador recorrente
  // — cada chamada aqui é isolada por construção (a assinatura só recebe UMA
  // safra), então safras vizinhas não podem interferir uma na outra.
  const c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
    tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 3,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false,
  };
  const safra1 = carteiraSaldoSafra(c, 1, 300);
  const safra2 = carteiraSaldoSafra(c, 2, 300);
  assert.deepEqual(safra1.map((s) => s.mes), [1, 2, 3, 4]);
  assert.deepEqual(safra2.map((s) => s.mes), [2, 3, 4, 5]);
  // No mês 2, a safra 1 já amortizou uma parcela (saldo 200) enquanto a
  // safra 2 nasce intacta (saldo 300) — nada foi somado nem confundido.
  assert.equal(safra1.find((s) => s.mes === 2)!.saldo, 200);
  assert.equal(safra2.find((s) => s.mes === 2)!.saldo, 300);
});

test('#236: carteira consolidada soma componentes, calcula a máxima e termina em zero', () => {
  const componentes: ComponentePagamento[] = [
    { tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 0, prazoMeses: 4, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
    { tipo: 'ate_marco', participacaoPct: 20, sinalPct: 0, marcoMes: 6, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 7, taxaMensal: 0 },
  ];
  const base = consolidarCarteiraClientes(componentes, [
    { safra: 1, valorContratado: 1_000 },
    { safra: 2, valorContratado: 1_000 },
  ], 6);
  const comVendaAposChaves = consolidarCarteiraClientes(componentes, [
    { safra: 1, valorContratado: 1_000 },
    { safra: 2, valorContratado: 1_000 },
    { safra: 8, valorContratado: 5_000 }, // à vista: não cria carteira
  ], 6);

  assert.deepEqual(comVendaAposChaves, base);
  assert.ok(base.carteiraMaxima > 0);
  assert.ok(base.mesCarteiraMaxima !== null);
  assert.equal(base.mensal.at(-1)!.mes, 7);
  assert.equal(base.mensal.at(-1)!.total, 0);
  for (const ponto of base.mensal) {
    assert.equal(ponto.total, Math.round((ponto.prazoFixo + ponto.ateMarco + ponto.concentrado) * 100) / 100);
    assert.ok(ponto.prazoFixo >= 0 && ponto.ateMarco >= 0 && ponto.concentrado >= 0);
  }
});

test('#236: carteira vazia tem máxima zero e nenhum mês de ocorrência', () => {
  const r = consolidarCarteiraClientes([], [], 24);
  assert.deepEqual(r, {
    mensal: [{ mes: 0, prazoFixo: 0, ateMarco: 0, concentrado: 0, total: 0 }],
    carteiraMaxima: 0,
    mesCarteiraMaxima: null,
  });
});

// ─────────────────────────────────────────────────────────────────
// #237 — Receita Bruta = líquido + juros = bruto − descontos + juros
// ─────────────────────────────────────────────────────────────────
//
// `valorContratado` aqui é o BRUTO da safra (#227): a única fonte de desconto
// é o `descontoPct` do componente `imediato` (exatamente como
// `vendaBrutaContratadaMensal`/`descontoComercialMensal` já modelam — a
// entrada à vista é o único lugar com abatimento comercial). Os demais
// componentes usam o bruto direto, então a soma dos principais fecha o bruto
// por construção (as `participacaoPct` somam 100%).

test('jurosSafra: imediato nunca gera juros (paga no próprio mês)', () => {
  const c: Extract<ComponentePagamento, { tipo: 'imediato' }> = {
    tipo: 'imediato', participacaoPct: 20, descontoPct: 5,
  };
  assert.equal(jurosSafra(c, 1, 1_000_000), 0);
});

test('receitaBrutaSafra: sem desconto e sem juros, Receita Bruta = bruto contratado (Anexo G.2, taxa 0)', () => {
  const componentes: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 15, descontoPct: 0 },
    { tipo: 'ate_marco', participacaoPct: 15, sinalPct: 0, marcoMes: 24, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
    { tipo: 'concentrado', participacaoPct: 70, mesPagamento: 25, taxaMensal: 0 },
  ];
  const valorContratado = 2_378_978.36;
  const receitaBruta = receitaBrutaSafra(componentes, 1, valorContratado);
  const jurosTotal = componentes.reduce((s, c) => s + jurosSafra(c, 1, valorContratado), 0);
  assert.equal(jurosTotal, 0);
  assert.ok(perto(receitaBruta, valorContratado, 1e-6));
});

test('receitaBrutaSafra + jurosSafra fecham a identidade: Receita Bruta = (bruto − desconto) + juros', () => {
  const componentes: ComponentePagamento[] = [
    { tipo: 'imediato', participacaoPct: 20, descontoPct: 5 },
    { tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 10, prazoMeses: 12, defasagemMeses: 1, taxaMensal: 0.01, jurosNoMesDaContratacao: false },
    { tipo: 'ate_marco', participacaoPct: 20, sinalPct: 0, marcoMes: 20, defasagemMeses: 1, taxaMensal: 0.008, jurosNoMesDaContratacao: false },
    { tipo: 'concentrado', participacaoPct: 30, mesPagamento: 25, taxaMensal: 0.005 },
  ];
  const safra = 3;
  const bruto = 1_000_000;
  const descontoImediato = bruto * 0.20 * 0.05;
  const liquido = bruto - descontoImediato;
  const jurosTotal = componentes.reduce((s, c) => s + jurosSafra(c, safra, bruto), 0);
  assert.ok(jurosTotal > 0); // as taxas positivas garantem juros > 0 neste mix
  const receitaBruta = receitaBrutaSafra(componentes, safra, bruto);
  assert.ok(perto(receitaBruta, liquido + jurosTotal, 1e-6));
});

// ─────────────────────────────────────────────────────────────────
// #235 — Vendas Após-chaves recebidas à vista no mês da contratação
// ─────────────────────────────────────────────────────────────────

const COMPONENTES_GRUPO_PADRAO: ComponentePagamento[] = [
  { tipo: 'imediato', participacaoPct: 20, descontoPct: 5 },
  { tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 15, prazoMeses: 36, defasagemMeses: 1, taxaMensal: 0.01, jurosNoMesDaContratacao: false },
  { tipo: 'ate_marco', participacaoPct: 20, sinalPct: 0, marcoMes: 24, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false },
  { tipo: 'concentrado', participacaoPct: 30, mesPagamento: 25, taxaMensal: 0 },
];

test('#235: fronteira temporal classifica somente meses posteriores à entrega como Após-chaves', () => {
  assert.equal(ehVendaAposChaves(23, 24), false);
  assert.equal(ehVendaAposChaves(24, 24), false);
  assert.equal(ehVendaAposChaves(25, 24), true);
});

test('componentesEfetivosSafra: venda no último mês antes da entrega mantém os componentes normais', () => {
  const mesEntrega = 24;
  const r = componentesEfetivosSafra(COMPONENTES_GRUPO_PADRAO, 24, mesEntrega);
  assert.equal(r, COMPONENTES_GRUPO_PADRAO); // mesma referência — nenhuma venda pós-entrega
});

test('componentesEfetivosSafra: venda no primeiro mês Após-chaves vira 100% à vista, sem sinal/parcela/repasse', () => {
  const mesEntrega = 24;
  const r = componentesEfetivosSafra(COMPONENTES_GRUPO_PADRAO, 25, mesEntrega);
  assert.deepEqual(r, [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }]);
  const pagamentos = receitaBrutaSafra(r, 25, 1_000_000);
  assert.equal(pagamentos, 1_000_000); // integral, no próprio mês, sem desconto
});

test('componentesEfetivosSafra: venda no último dos 12 meses Após-chaves também vira à vista', () => {
  const mesEntrega = 24;
  const ultimoMesJanela = mesEntrega + 12; // #226: janela fixa de 12 meses
  const r = componentesEfetivosSafra(COMPONENTES_GRUPO_PADRAO, ultimoMesJanela, mesEntrega);
  assert.deepEqual(r, [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }]);
});

test('componentesEfetivosSafra: coexistência — repasse de safra antiga e venda nova à vista no mesmo mês', () => {
  const mesEntrega = 24;
  const mesRepasse = 25;
  // Safra antiga (contratada mês 12, antes da entrega): componentes normais,
  // o repasse dela cai em 25 via `pagamentosConcentrado`.
  const componentesAntiga = componentesEfetivosSafra(COMPONENTES_GRUPO_PADRAO, 12, mesEntrega);
  assert.equal(componentesAntiga, COMPONENTES_GRUPO_PADRAO);
  const repasseAntigo = pagamentosConcentrado(
    componentesAntiga[3] as Extract<ComponentePagamento, { tipo: 'concentrado' }>,
    12, 1_000_000,
  );
  assert.equal(repasseAntigo[0].mes, mesRepasse);
  // Safra nova (contratada NO mês do repasse, já Após-chaves): 100% à vista,
  // no mesmo mês — os dois recebimentos coexistem sem se misturar.
  const componentesNova = componentesEfetivosSafra(COMPONENTES_GRUPO_PADRAO, mesRepasse, mesEntrega);
  const vendaNovaAVista = receitaBrutaSafra(componentesNova, mesRepasse, 500_000);
  assert.equal(vendaNovaAVista, 500_000);
});

// ── #283: integração do motor de safras ao cálculo real ────────────────────

function componentesDaFixture(cenario: CenarioRecebiveis): ComponentePagamento[] {
  return cenario.componentes.map((c): ComponentePagamento => {
    if (c.tipo === 'imediato') return {
      tipo: 'imediato', participacaoPct: c.participacao * 100,
      descontoPct: (c.desconto ?? 0) * 100, rotulo: c.rotulo,
    };
    if (c.tipo === 'prazo_fixo') return {
      tipo: 'prazo_fixo', participacaoPct: c.participacao * 100,
      sinalPct: (c.sinalPct ?? 0) * 100, prazoMeses: c.prazoN,
      defasagemMeses: 1, taxaMensal: c.taxaMensal,
      jurosNoMesDaContratacao: false, rotulo: c.rotulo,
    };
    if (c.tipo === 'ate_marco') return {
      tipo: 'ate_marco', participacaoPct: c.participacao * 100,
      sinalPct: (c.sinalPct ?? 0) * 100, marcoMes: c.marcoM,
      defasagemMeses: 1, taxaMensal: c.taxaMensal,
      jurosNoMesDaContratacao: false, rotulo: c.rotulo,
    };
    return {
      tipo: 'concentrado', participacaoPct: c.participacao * 100,
      mesPagamento: c.mesPagamento, taxaMensal: 0, rotulo: c.rotulo,
    };
  });
}

test('#283 motor de produção reproduz os checkpoints Calliandra G.1', () => {
  const contratacoes = CALLIANDRA_G1.contratacaoPorMes
    .map((valorContratado, safra) => ({ safra, valorContratado }))
    .filter((c) => c.valorContratado > 0);
  const r = calcularRecebiveisComponentes(
    componentesDaFixture(CALLIANDRA_G1), contratacoes, 999, 134,
  );
  for (const [mes, esperado] of G1_ESPERADO) {
    // O oráculo mantém precisão integral; produção quantiza cada parcela em
    // centavos (C7). Centenas de parcelas/safras acumulam até R$ 0,52.
    assert.ok(perto(r.recebimentoBrutoMensal[mes] ?? 0, esperado, 1),
      `G.1 mês ${mes}: esperado ${esperado}, obtido ${r.recebimentoBrutoMensal[mes]}`);
  }
  assert.ok(soma(r.jurosMensal) > 0);
  assert.ok(perto(soma(r.recebimentoBrutoMensal), soma(r.principalRecebidoMensal) + soma(r.jurosMensal), 0.01));
});

test('#283 motor de produção reproduz Calliandra G.2 e separa o repasse', () => {
  const contratacoes = CALLIANDRA_G2.contratacaoPorMes
    .map((valorContratado, safra) => ({ safra, valorContratado }))
    .filter((c) => c.valorContratado > 0);
  const r = calcularRecebiveisComponentes(
    componentesDaFixture(CALLIANDRA_G2), contratacoes, 999, 27,
  );
  for (const [mes, esperado] of G2_ESPERADO) {
    assert.ok(perto(r.recebimentoBrutoMensal[mes] ?? 0, esperado, 1),
      `G.2 mês ${mes}: esperado ${esperado}, obtido ${r.recebimentoBrutoMensal[mes]}`);
  }
  assert.ok(perto(r.repasseMensal[25], 0.70 * CALLIANDRA_G2.baseContratada, 0.10));
  assert.equal(r.receitaPorComponenteMensal.repasse[25], r.repasseMensal[25]);
  assert.equal(r.carteiraPorComponenteMensal.saldoARepassar[25], 0);
  assert.equal(soma(r.jurosMensal), 0);
  assert.equal(r.carteiraMensal[25], 0);
});

// ── #460: resíduo de `ate_marco` sem prazo (N_s ≤ 0) — imediato × concentrado ─
//
// Venda contratada no próprio mês do marco (ou depois) não tem prazo restante
// para parcelar. A EVI rola esse resíduo para o saldo a repassar (`cfINC!AH`);
// o app SEMPRE fez o oposto (converte para `imediato`, R-A2-07 original). O
// campo `residuoAteMarco` torna a regra da EVI um opt-in, com o comportamento
// de sempre como default — nenhum estudo existente muda de número sem
// alguém marcar o controle novo.

test('#460 residuoAteMarco ausente/"imediato": resíduo vira caixa no mês do marco (comportamento de sempre)', () => {
  const fimObra = 10;
  const componentes: ComponentePagamento[] = [
    { tipo: 'ate_marco', participacaoPct: 24, sinalPct: 0, marcoMes: fimObra, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até o marco' },
    { tipo: 'concentrado', participacaoPct: 56, mesPagamento: fimObra + 1, taxaMensal: 0, rotulo: 'repasse' },
  ];
  const contratacoes = [{ safra: fimObra, valorContratado: 1_000_000 }];

  // Sem o campo — o comportamento de sempre, nenhum número muda.
  const semCampo = calcularRecebiveisComponentes(componentes, contratacoes, fimObra, fimObra + 5);
  assert.equal(semCampo.recebimentoBrutoMensal[fimObra], 240_000, '24% imediato no mês do marco');
  assert.equal(semCampo.recebimentoBrutoMensal[fimObra + 1], 560_000, '56% do concentrado, sem o resíduo');

  // Com 'imediato' EXPLÍCITO — idêntico ao ausente.
  const explicito = calcularRecebiveisComponentes(componentes, contratacoes, fimObra, fimObra + 5, 'imediato');
  assert.deepEqual(explicito.recebimentoBrutoMensal, semCampo.recebimentoBrutoMensal);
});

test('#460 residuoAteMarco "concentrado": o resíduo rola para o Repasse — as DUAS séries mensais, não o total', () => {
  // ⚠️ O total é IGUAL nos dois modos (80% de 1.000.000 = 800.000, sempre); o
  // que muda é o MÊS. Um teste de total passaria nos dois — este assevera as
  // duas séries.
  const fimObra = 10;
  const componentes: ComponentePagamento[] = [
    { tipo: 'ate_marco', participacaoPct: 24, sinalPct: 0, marcoMes: fimObra, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até o marco' },
    { tipo: 'concentrado', participacaoPct: 56, mesPagamento: fimObra + 1, taxaMensal: 0, rotulo: 'repasse' },
  ];
  const contratacoes = [{ safra: fimObra, valorContratado: 1_000_000 }];

  const r = calcularRecebiveisComponentes(componentes, contratacoes, fimObra, fimObra + 5, 'concentrado');
  assert.equal(r.recebimentoBrutoMensal[fimObra], 0, 'nada fica no mês do marco — tudo rolou');
  assert.equal(r.recebimentoBrutoMensal[fimObra + 1], 800_000, '80% (24% + 56%) no mês do Repasse');

  // O total é o mesmo dos dois modos — não é isto que distingue.
  const semCampo = calcularRecebiveisComponentes(componentes, contratacoes, fimObra, fimObra + 5);
  assert.equal(soma(r.recebimentoBrutoMensal), soma(semCampo.recebimentoBrutoMensal));
});

test('#460 "concentrado" capitaliza o resíduo pela taxa do componente concentrado — não é só calendário', () => {
  const fimObra = 10;
  const TAXA = 0.0098635806;
  const componentes: ComponentePagamento[] = [
    { tipo: 'ate_marco', participacaoPct: 24, sinalPct: 0, marcoMes: fimObra, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até o marco' },
    { tipo: 'concentrado', participacaoPct: 56, mesPagamento: fimObra + 1, taxaMensal: TAXA, rotulo: 'repasse' },
  ];
  const contratacoes = [{ safra: fimObra, valorContratado: 1_000_000 }];

  const r = calcularRecebiveisComponentes(componentes, contratacoes, fimObra, fimObra + 5, 'concentrado');
  const esperado = Math.round(800_000 * Math.pow(1 + TAXA, 1) * 100) / 100;
  assert.equal(r.recebimentoBrutoMensal[fimObra + 1], esperado);
  // Sem isto, o dinheiro rolaria sem capitalizar — meia entrega.
  assert.ok(r.recebimentoBrutoMensal[fimObra + 1] > 800_000, 'o resíduo capitalizou junto com o repasse');
});

test('#460 FIAÇÃO: `linha.fluxo_pagamento.residuoAteMarco` chega a `recebimentoBrutoMensal` — não só o motor isolado', () => {
  // Os três testes acima constroem `ComponentePagamento[]` à mão e chamam
  // `calcularRecebiveisComponentes` direto — provam o CÁLCULO, não a FIAÇÃO
  // entre o campo persistido na linha e o motor. Este entra pela porta real:
  // `recebimentoBrutoMensal(linha, ...)`, que é o que `descontoComercialMensal`
  // e `recebiveisComponentesLinha` (privada) leem de verdade.
  const CRONO_460: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 0, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 1, duracao_meses: 10 }, // fim da Obra = mês 10
    { evento: 'pos_obra', inicio_mes: 11, duracao_meses: 6 },
  ];
  const linha = (residuoAteMarco?: ResiduoAteMarco) => ({
    tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 50, preco_m2: 10_000 }], // VGV 5.000.000
    absorcao: { modo: 'personalizado', meses: [{ mes: 10, pct: 100 }] }, // 100% no mês do marco
    fluxo_pagamento: {
      ...(residuoAteMarco ? { residuoAteMarco } : {}),
      componentes: [
        { tipo: 'imediato', participacaoPct: 20, descontoPct: 0, rotulo: 'sinal' },
        { tipo: 'ate_marco', participacaoPct: 24, sinalPct: 0, marcoMes: 10, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'x' },
        { tipo: 'concentrado', participacaoPct: 56, mesPagamento: 11, taxaMensal: 0, rotulo: 'y' },
      ],
    },
  });

  const semCampo = recebimentoBrutoMensal(linha(), CRONO_460, 20, 0);
  const comCampo = recebimentoBrutoMensal(linha('concentrado'), CRONO_460, 20, 0);

  // Sem o campo: 20% (imediato) + 24% (ate_marco virado imediato) = 44% no mês 10.
  assert.equal(semCampo[10], 2_200_000);
  assert.equal(semCampo[11], 2_800_000); // só os 56% do concentrado
  // Com 'concentrado': só os 20% do imediato ficam no mês 10; o resto foi.
  assert.equal(comCampo[10], 1_000_000);
  assert.equal(comCampo[11], 4_000_000); // 56% + 24% transferidos
  assert.equal(soma(semCampo), soma(comCampo), 'o total da linha não muda — só o calendário');
});

test('#460 fallback: sem `concentrado` na linha, "concentrado" continua virando imediato', () => {
  const marco = 20;
  const componentes: ComponentePagamento[] = [
    { tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: marco, defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até o marco, sem repasse' },
  ];
  const contratacoes = [{ safra: marco, valorContratado: 500_000 }];

  const r = calcularRecebiveisComponentes(componentes, contratacoes, marco, marco + 3, 'concentrado');
  assert.equal(r.recebimentoBrutoMensal[marco], 500_000, 'sem concentrado, o resíduo tem de ir a algum lugar: imediato');
});

// ── #428: juros de tabela — a conversão, o adaptador e os goldens da EVI ───
//
// O oráculo é a EVI Urbitá (consultiva, nunca contrato): `ClienteJurosAA =
// 12,5% a.a.` em `Premissas e Resultados!H14`, convertido por
// `ClienteJurosAM = (1 + ClienteJurosAA)^(1/12) − 1` — nome definido, fórmula
// pura, sem arredondamento: 0,00986358055321146.

test('#428 a conversão é COMPOSTA, nunca aa/12, e a volta desfaz a ida', () => {
  // O valor exato de `ClienteJurosAM` na EVI. `12,5 / 12 / 100` daria
  // 0,010416…, quase 6% a mais de juros mensais — o erro que esta asserção
  // existe para impedir.
  assert.equal(taxaMensalDeAnual(12.5), 0.00986358055321146);
  assert.notEqual(taxaMensalDeAnual(12.5), 12.5 / 12 / 100);
  // A taxa não residencial da EVI (`!H22`, válida só com `H16 = TRUE`).
  assert.ok(perto(taxaMensalDeAnual(13) * 100, 1.0237, 0.0001));
  // Contrato C7: derivada NÃO monetária carrega precisão plena. Se alguma
  // dessas duas arredondasse, a volta não fecharia em 12 casas.
  assert.ok(perto(taxaAnualDeMensal(taxaMensalDeAnual(12.5)), 12.5, 1e-12));
  // 0% continua 0% nos dois sentidos — é o default de todo estudo existente.
  assert.equal(taxaMensalDeAnual(0), 0);
  assert.equal(taxaAnualDeMensal(0), 0);
  // Lixo não vira NaN dentro dos componentes.
  assert.equal(taxaMensalDeAnual(NaN), 0);
  assert.equal(taxaAnualDeMensal(undefined as any), 0);
});

test('#585 a guarda de domínio de taxaMensalDeAnual continua ligada', () => {
  // ⚠️ Esta asserção existe porque a #585 APAGOU a única que cobria isto (era
  // `#428 revisão B2`, junto com o campo do modal). Medido: sem ela, remover o
  // `if (aa <= -100) return 0` do motor deixa a suíte inteira VERDE.
  //
  // A guarda importa porque `Math.pow` com base negativa e expoente fracionário
  // devolve `NaN`, `JSON.stringify(NaN)` é `null`, e um único "Aplicar"
  // gravaria `taxaMensal: null` em todo componente financiado — a classe de
  // defeito da #431 de volta por outra porta.
  assert.equal(taxaMensalDeAnual(-100), 0);
  assert.equal(taxaMensalDeAnual(-150), 0);
  assert.equal(taxaMensalDoEstudo(-150), 0, 'o wrapper do estudo herda a guarda');
  // E o caminho todo: nem um componente sai com `taxaMensal` não finita.
  const comps = componentesDoLegado(
    { parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }] },
    CRONO, -150,
  ) as any[];
  for (const c of comps.filter((x) => 'taxaMensal' in x)) {
    assert.ok(Number.isFinite(c.taxaMensal), 'taxaMensal não finita vira `null` no JSON persistido');
  }
});

test('#585 a taxa do plano vem do ESTUDO — a chave da linha e a derivação sumiram', () => {
  // A #428 tinha duas fontes com precedência (`fluxo_pagamento.juros_tabela_aa`
  // e, na falta dela, a primeira `taxaMensal` persistida). As duas eram
  // leituras POR LINHA, e não há mais taxa por linha: a decisão do autor de
  // 2026-08-26 tornou a taxa um valor do estudo.
  assert.equal(taxaMensalDoEstudo(12.5), taxaMensalDeAnual(12.5));
  assert.equal(taxaMensalDoEstudo(0), 0, 'estudo sem juros de tabela é 0, e 0 é resposta');
  assert.equal(taxaMensalDoEstudo(NaN as any), 0, 'lixo não vira NaN dentro dos componentes');
  assert.equal(taxaMensalDoEstudo(undefined as any), 0);

  // E a chave legada da LINHA não tem mais efeito nenhum: um plano que a
  // carrega calcula pela taxa do estudo, não por ela. É o que impede um estudo
  // de continuar com o número antigo depois desta versão.
  const fpLegado = {
    juros_tabela_aa: 13,
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  };
  const comps = componentesDoLegado(fpLegado, CRONO, 12.5) as any[];
  for (const c of comps.filter((x) => x.tipo !== 'imediato')) {
    assert.equal(c.taxaMensal, taxaMensalDeAnual(12.5),
      'a chave legada da linha voltou a mandar — ela é INERTE desde a #585');
  }
});

test('#585 componentesPagamento aplica a taxa do estudo sobre o array PERSISTIDO', () => {
  // O ponto único do override, e o coração da issue. Sem ele, toda linha
  // editada desde a #248 (que persiste `componentes`) ignoraria o campo da aba
  // Financeiro, porque este ramo devolvia o persistido verbatim.
  const persistido = {
    componentes: [
      { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
      { tipo: 'ate_marco', participacaoPct: 30, marcoMes: 38, defasagemMeses: 1,
        sinalPct: 0, taxaMensal: 0.0104, jurosNoMesDaContratacao: false, rotulo: 'Tabela longa' },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 39, taxaMensal: 0, rotulo: 'Repasse' },
    ],
  };
  const comps = componentesPagamento(persistido, CRONO, 12.5) as any[];
  assert.equal('taxaMensal' in comps[0], false, 'imediato não pode ganhar taxa');
  assert.equal(comps[1].taxaMensal, taxaMensalDeAnual(12.5));
  assert.equal(comps[2].taxaMensal, taxaMensalDeAnual(12.5),
    'o Repasse em 0% também passa a valer a taxa do estudo — é o caso de maior dinheiro da EVI');
  // O resto do componente é preservado: o override toca UMA chave.
  assert.equal(comps[1].rotulo, 'Tabela longa');
  assert.equal(comps[1].participacaoPct, 30);
  // E não muta o array de entrada.
  assert.equal(persistido.componentes[1].taxaMensal, 0.0104);
});

test('#585 componente FINANCIADO sem a chave taxaMensal também recebe a taxa do estudo', () => {
  // ⚠️ O override testava `'taxaMensal' in c`, e o contrato do backend
  // (`validarFluxoPagamento`) ACEITA componente financiado sem a chave — um
  // `prazo_fixo` só com `participacaoPct`/`prazoMeses` é shape válido, gravável
  // pela API. Nessa linha a taxa do estudo nunca era aplicada: a tela mostrava
  // 12,5% e as parcelas não rendiam juros nenhum.
  //
  // Quem decide é o TIPO. `imediato` é o único sem taxa, e continua sem.
  const semChave = componentesPagamento(
    { componentes: [
      { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
      { tipo: 'prazo_fixo', participacaoPct: 30, prazoMeses: 12, defasagemMeses: 1, sinalPct: 0 },
      { tipo: 'ate_marco', participacaoPct: 20, marcoMes: 38, defasagemMeses: 1, sinalPct: 0 },
      { tipo: 'concentrado', participacaoPct: 30, mesPagamento: 39 },
    ] },
    CRONO, 12.5,
  ) as any[];
  assert.equal('taxaMensal' in semChave[0], false, 'imediato não pode ganhar taxa');
  // ⚠️ E a regra é uma ALLOWLIST, não "tudo menos imediato": componente com
  // `tipo` ausente, `null` ou desconhecido — dado que a validação barra hoje mas
  // que pode existir persistido de antes dela — continua SEM taxa, como estava
  // sob a regra da presença de chave. A negação teria mudado isso em silêncio.
  const estranhos = componentesPagamento(
    { componentes: [
      { participacaoPct: 10 },
      { tipo: null, participacaoPct: 10 },
      { tipo: 'tipo_que_nao_existe', participacaoPct: 10 },
    ] },
    CRONO, 12.5,
  ) as any[];
  for (const c of estranhos) {
    assert.equal('taxaMensal' in c, false,
      'componente de tipo desconhecido ganhou taxa — a regra virou negação em vez de allowlist');
  }
  for (const c of semChave.slice(1)) {
    assert.equal(c.taxaMensal, taxaMensalDeAnual(12.5),
      `${c.tipo} sem a chave persistida ficou sem a taxa do estudo`);
  }
  // E os juros aparecem de verdade no motor, não só no array de componentes —
  // é a diferença entre "a função marca o campo" e "o número da tela muda".
  const linha = {
    id: 1, nome: 'Venda', tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: { componentes: [
      { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, defasagemMeses: 1, sinalPct: 0 },
    ] },
  };
  const base = { dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [linha], linhasCusto: [], areaTerreno: 0 };
  assert.equal(calcularFluxo({ ...base, jurosTabelaAaEstudo: 0 }).jurosClientes, 0);
  assert.ok(calcularFluxo({ ...base, jurosTabelaAaEstudo: 12.5 }).jurosClientes > 0,
    'a linha sem a chave persistida não produziu juros nenhum');
});

test('#585 LIMITE declarado: componente financiado sem `sinalPct` produz receita NaN — defeito PRÉ-EXISTENTE', () => {
  // ⚠️ Achado colateral da rodada 2, e ele NÃO é desta issue — está aqui porque
  // foi medido e some se ninguém o escrever.
  //
  // O teste acima precisou de `sinalPct: 0` para funcionar. Sem essa chave, um
  // `prazo_fixo` canônico faz `receitaBruta` virar **NaN** — não zero, NaN — e o
  // estudo inteiro passa a exibir números inválidos. A taxa do estudo não tem
  // nada a ver: o NaN acontece com `jurosTabelaAaEstudo` em 0 igualmente, e
  // acontecia antes da #585.
  //
  // O que torna isso relevante e não teórico: `validarFluxoPagamento`
  // (`backend/rotas/avancado.ts`) **aceita** o shape sem `sinalPct`, então é
  // gravável pela API. Consertar o motor para tolerá-lo alargaria este PR —
  // fica registrado como issue própria, com a reprodução pronta.
  const semSinal = {
    id: 1, nome: 'Venda', tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: { componentes: [
      { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, defasagemMeses: 1 },
    ] },
  };
  const r = calcularFluxo({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [semSinal], linhasCusto: [], areaTerreno: 0, jurosTabelaAaEstudo: 0,
  });
  assert.ok(Number.isNaN(r.receitaBruta),
    'o limite mudou — se `sinalPct` ausente deixou de produzir NaN, alguém consertou o motor '
    + 'e esta nota (e a issue que ela pede) precisa ser reescrita');
});

test('#585 componentesDoLegado propaga a taxa do estudo nos QUATRO caminhos', () => {
  const fp = {
    entrada: [
      { pct: 10, parcelas: 1, descontoPct: 0 },   // imediato — não tem taxa, e não deve ter
      { pct: 10, parcelas: 3, descontoPct: 0 },   // prazo_fixo (entrada parcelada)
    ],
    parcelas: [
      { pct: 20, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true },  // ate_marco
      { pct: 20, periodicidade: 'mensal', parcelas: 12 },                      // prazo_fixo
    ],
  };
  const comps = componentesDoLegado(fp, CRONO, 12.5) as any[];
  const esperada = taxaMensalDeAnual(12.5);
  assert.deepEqual(comps.map((c) => c.tipo),
    ['imediato', 'prazo_fixo', 'ate_marco', 'prazo_fixo', 'concentrado']);
  for (const c of comps.filter((x) => x.tipo !== 'imediato')) {
    assert.equal(c.taxaMensal, esperada, `${c.rotulo} ficou sem a taxa do estudo`);
  }
  assert.equal('taxaMensal' in comps[0], false, 'imediato não tem juros: paga no mês da venda');

  // Regressão: estudo sem taxa continua em 0 — nenhum estudo muda de número
  // enquanto o campo da aba Financeiro estiver zerado.
  const semTaxa = componentesDoLegado(fp, CRONO, 0) as any[];
  for (const c of semTaxa.filter((x) => x.tipo !== 'imediato')) assert.equal(c.taxaMensal, 0);
});

test('#428 golden EVI safra única: sinal de 15% e 36 parcelas de R$ 21.414,48 (cfINC!AY20)', () => {
  // Mês 0 do cenário dourado (`docs/rodada-8/02-regras-evi.md` §3).
  //
  // ⚠️ SAFRA ÚNICA, e só. `cfINC!AY` é um PMT rolante sobre um pool, não
  // amortização por safra: as "36 parcelas iguais" só existem quando há UMA
  // safra. Cobrar paridade com AY em cenário multi-safra pediria ao app um
  // método que ele não tem — e não deve ter: o contrato do app é por safra.
  const BASE = 7_603_022.19;
  const componente: ComponentePagamento = {
    tipo: 'prazo_fixo', participacaoPct: 10, sinalPct: 15, prazoMeses: 36,
    defasagemMeses: 1, taxaMensal: 0.0098635806,
    jurosNoMesDaContratacao: false, rotulo: 'tabela curta',
  };
  const pagamentos = pagamentosPrazoFixo(componente, 0, BASE);

  const sinal = pagamentos.filter((p) => p.tipo === 'sinal');
  assert.equal(sinal.length, 1);
  assert.equal(sinal[0].mes, 0, 'o sinal é pago no mês da contratação');
  assert.equal(sinal[0].valor, 114_045.33);        // 7.603.022,19 × 10% × 15%

  const parcelas = pagamentos.filter((p) => p.tipo !== 'sinal');
  assert.equal(parcelas.length, 36);
  assert.equal(parcelas[0].mes, 1, 'defasagem 1: a 1ª parcela vence no mês seguinte');
  assert.equal(parcelas[35].mes, 36);
  for (const p of parcelas) {
    assert.ok(perto(p.valor, 21_414.48, 0.10), `parcela do mês ${p.mes}: ${p.valor}`);
  }
  // As 35 primeiras são exatas; a última carrega o resíduo de centavos da
  // quantização (C7, `round2` parcela a parcela).
  for (const p of parcelas.slice(0, 35)) assert.equal(p.valor, 21_414.48);

  // E o principal recuperado é exatamente a fração contratada: os juros são
  // acréscimo, nunca reclassificação de principal.
  const r = calcularRecebiveisComponentes([componente], [{ safra: 0, valorContratado: BASE }], 999, 60);
  assert.ok(perto(soma(r.principalRecebidoMensal), BASE * 0.10, 0.01));
  assert.ok(perto(soma(r.jurosMensal), 124_664.47, 0.01));
  assert.ok(perto(soma(r.recebimentoBrutoMensal),
    soma(r.principalRecebidoMensal) + soma(r.jurosMensal), 0.01));
});

test('#428 golden EVI repasse: o saldo a repassar capitaliza, e os juros são série própria', () => {
  // `cfINC!AJ/AK/AL` — o maior item de juros da EVI: R$ 4.257.692,43 de
  // principal (`cfINC!AH19`) viram R$ 5.715.517,93 no mês 30, dos quais
  // R$ 1.457.825,50 são juros (78% dos juros daquela safra).
  const PRINCIPAL = 4_257_692.43;
  const componente: ComponentePagamento = {
    tipo: 'concentrado', participacaoPct: 100, mesPagamento: 30,
    taxaMensal: 0.0098635806, rotulo: 'saldo a repassar',
  };
  const r = calcularRecebiveisComponentes(
    [componente], [{ safra: 0, valorContratado: PRINCIPAL }], 999, 60);

  // ⚠️ A issue cita 5.715.517,93 / 1.457.825,50; o motor arredonda por `round2`
  // e dá 5.715.517,94 / 1.457.825,51. É UM centavo, do último arredondamento
  // (o exato é 5.715.517,9379…) — a tolerância de 2 centavos abaixo é isso, e
  // não folga para erro de modelo.
  assert.ok(perto(r.recebimentoBrutoMensal[30], 5_715_517.93, 0.02));
  assert.ok(perto(r.recebimentoBrutoMensal[30], PRINCIPAL * Math.pow(1.0098635806, 30), 0.01));

  // AS DUAS SÉRIES, que é o que prova que os juros não são principal disfarçado.
  assert.equal(r.principalRecebidoMensal[30], PRINCIPAL, 'o principal do repasse não pode crescer');
  assert.ok(perto(r.jurosMensal[30], 1_457_825.50, 0.02));
  assert.equal(soma(r.principalRecebidoMensal), PRINCIPAL);
  assert.equal(r.repasseMensal[30], r.recebimentoBrutoMensal[30]);

  // "Os juros começam no mês seguinte à contratação": nada é recebido antes.
  assert.equal(soma(r.recebimentoBrutoMensal.slice(0, 30)), 0);
  // Taxa 0 é o mesmo repasse de sempre, sem um centavo de juros — o default.
  const semJuros = calcularRecebiveisComponentes(
    [{ ...componente, taxaMensal: 0 }], [{ safra: 0, valorContratado: PRINCIPAL }], 999, 60);
  assert.equal(semJuros.recebimentoBrutoMensal[30], PRINCIPAL);
  assert.equal(soma(semJuros.jurosMensal), 0);
});

test('#283 linha opt-in alimenta juros, principal e carteira no FluxoCalc', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    // #585: a taxa vem do ESTUDO. O `taxaMensal` do componente persistido
    // abaixo é o dado histórico e ficou inerte — quem produz os juros é este
    // campo.
    jurosTabelaAaEstudo: 12.7,
    linhasReceita: [{
      id: 1, nome: 'Venda financiada',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: { componentes: [{
        tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0,
        prazoMeses: 12, defasagemMeses: 1, taxaMensal: 0.01,
        jurosNoMesDaContratacao: false,
      }] },
    }],
    linhasCusto: [], areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.ok(r.jurosClientes > 0);
  assert.ok(r.carteiraClientesMaxima > 0);
  assert.equal(r.carteiraClientesMensal[r.carteiraClientesMensal.length - 1], 0);
  assert.ok(perto(r.receitaBruta, r.vendaLiquidaContratada + r.jurosClientes, 0.01));
  assert.ok(perto(soma(r.receitaBrutaMensal), soma(r.principalRecebidoMensal) + soma(r.jurosClientesMensal), 0.01));
  assert.equal(soma(r.repasseMensal), 0);
  assert.ok(soma(r.receitaPorComponenteMensal.tabelaCurta) > 0);
  assert.deepEqual(r.carteiraPorComponenteMensal.tabelaCurta, r.carteiraClientesMensal);
  assert.equal(soma(r.receitaPorComponenteMensal.aVista), 0);
});

test('#237 Receita Bruta fecha por linha e tipologia sem deduzir RET ou corretagem destacada', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 7, nome: 'Grupo Residencial', fase_label: 'Fase 1',
      tipologias: [
        { id: 71, nome: 'Dois quartos', quantidade: 6, area_privativa_m2: 100, preco_m2: 10_000 },
        { id: 72, nome: 'Três quartos', quantidade: 4, area_privativa_m2: 100, preco_m2: 10_000 },
      ],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: {
        componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }],
        comissao: { ativo: true, tipo: 'destacada', pct: 6 },
      },
    }],
    linhasCusto: [{
      id: 8, grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM,
      orcamento_valor: 6, orcamento_unidade: 'pct_vgv', inicio_mes: 0, duracao_meses: 1,
    }],
    areaTerreno: 0,
    ret: { ativo: true, pct: 4 }, // #346: RET é global, não mais lido de fluxo_pagamento
  };
  const r = calcularFluxo(config);
  const linha = r.linhasReceitaBruta[0];
  assert.equal(r.receitaBruta, 10_000_000);
  assert.equal(soma(r.receitaBrutaMensal), 10_000_000);
  assert.equal(linha.total, r.receitaBruta);
  assert.equal(soma(linha.itens?.map((item) => item.total) ?? []), linha.total);
  assert.equal(linha.itens?.[0].total, 6_000_000);
  assert.equal(linha.itens?.[1].total, 4_000_000);
  assert.equal(r.linhasVendasContratadas[0].total, r.vendaBrutaContratada);
  assert.equal(soma(r.linhasVendasContratadas[0].itens?.map((item) => item.total) ?? []), r.vendaBrutaContratada);
  assert.deepEqual(r.vendaBrutaContratadaMensal, r.receitaBrutaMensal);
  assert.equal(r.jurosClientes, 0);
  // RET e corretagem são deduções explícitas; nenhuma reduz a Receita Bruta.
  assert.equal(soma(r.receitaMensal), 9_600_000);
  assert.equal(soma(r.custoMensal), 600_000);
});

test('#283 estudo legado sem componentes mantém exatamente o caminho vigente', () => {
  const linha = {
    id: 1, nome: 'Venda legada',
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: {
      entrada: [{ pct: 15, parcelas: 1 }],
      parcelas: [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, pct: 15 }],
      repasse: { apos_entrega_meses: 2 }, // #345: ignorado — offset travado em 1
    },
  };
  const vigente = receitaMensalLinha(linha, CRONO, 60, 0);
  assert.ok(perto(vigente[12], 1_500_000, 0.01));
  assert.ok(perto(vigente[17], 1_500_000 / 24, 0.01));
  assert.ok(perto(vigente[41], 7_000_000, 0.01));
  assert.equal(soma(vigente), 10_000_000);

  const consolidado = calcularFluxo({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [linha], linhasCusto: [], areaTerreno: 0,
  });
  assert.deepEqual(consolidado.receitaBrutaMensal, recebimentoBrutoMensal(linha, CRONO, consolidado.prazo, 0));
  assert.deepEqual(consolidado.principalRecebidoMensal, consolidado.receitaBrutaMensal);
  assert.equal(consolidado.jurosClientes, 0);
  assert.equal(consolidado.carteiraClientesMaxima, 0);
  assert.equal(soma(consolidado.repasseMensal), 0);
  assert.deepEqual(consolidado.receitaPorComponenteMensal.outros, consolidado.receitaBrutaMensal);
});

// ─────────────────────────────────────────────────────────────────────────
// #458 — a divergência ENTRE os dois ramos de recebíveis (legado x canônico)
// é CONHECIDA e tem de ficar VERMELHA se alguém "unificar" os ramos sem
// decisão explícita — hoje a escolha de ramo é `Array.isArray(fp?.componentes)`
// (`recebimentoBrutoMensal`), invisível ao usuário.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Duas linhas com o MESMO `fluxo_pagamento` — uma com `componentes` (ramo
 * canônico), outra sem (ramo legado) — sobre o MESMO cronograma (`CRONO`,
 * obra 17→40). `comComponentes` usa `componentesDoLegado` sobre o MESMO
 * objeto legado, então a única variável entre as duas é a FORMA do JSON, não
 * o conteúdo — é o que prova que a divergência vem do ramo, não da fixture.
 */
function linha458(mesVenda: number, comComponentes: boolean) {
  const fluxoPagamentoLegado = {
    entrada: [],
    parcelas: [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, pct: 100 }],
    repasse: { apos_entrega_meses: 0 },
  };
  return {
    id: 1, nome: 'Grupo #458',
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: mesVenda, pct: 100 }] },
    fluxo_pagamento: comComponentes
      ? { componentes: componentesDoLegado(fluxoPagamentoLegado, CRONO, 0) }
      : fluxoPagamentoLegado,
  };
}

test('#658: `marcoMes`/`mesPagamento` reancoram no cronograma VIGENTE, como a taxa reancora no estudo', () => {
  // Achado do revisor externo no PR 658. `componentesDoLegado` deriva o fim da
  // obra A CADA cálculo — então o ramo legado sempre acompanhou o cronograma
  // vigente. O ramo canônico lia as âncoras do array PERSISTIDO, congeladas no
  // momento da gravação: mudar o início ou a duração da obra deixava a linha
  // pagando nos meses do cronograma antigo, sem nada ficar vermelho.
  //
  // Que os dois campos são PROJEÇÃO e não dado da linha está provado em
  // `CAMPOS_DO_ESPELHO` (`fluxo-pagamento-editor.ts`): estando lá, o
  // transplante nunca os move do persistido. São ao cronograma o que
  // `taxaMensal` é à taxa do estudo — e recebem o mesmo tratamento.
  const OBRA_ANTIGA = CRONO;                        // obra 17→40 ⇒ fim 40, repasse 41
  const OBRA_NOVA: EventoCrono[] = CRONO.map((e) => (
    e.evento === 'obra' ? { ...e, duracao_meses: 12 } : e
  ));                                               // obra 17→28 ⇒ fim 28, repasse 29

  // A linha foi GRAVADA sob o cronograma antigo — é o caso real: o usuário
  // aplicou o plano e depois mexeu na obra.
  const legado = { entrada: [], parcelas: [], repasse: { apos_entrega_meses: 0 } };
  const linha = {
    id: 1, nome: 'Grupo #658',
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 13, pct: 100 }] },
    fluxo_pagamento: {
      ...legado, ancorasVivas: true,
      componentes: componentesDoLegado(legado, OBRA_ANTIGA, 0),
    },
  };
  // Pré-condição: o array persistido carrega a âncora ANTIGA.
  const persistido: any[] = (linha.fluxo_pagamento as any).componentes;
  const repassePersistido = persistido.find((c) => c.tipo === 'concentrado');
  assert.ok(repassePersistido, 'pré-condição: o plano tem um repasse concentrado');
  assert.equal(repassePersistido.mesPagamento, 41, 'pré-condição: gravado sob a obra que terminava no mês 40');

  // Lido sob o cronograma NOVO, o repasse tem de cair no mês 29.
  const lido = componentesPagamento(linha.fluxo_pagamento, OBRA_NOVA, 0) as any[];
  const repasseLido = lido.find((c) => c.tipo === 'concentrado');
  assert.equal(repasseLido.mesPagamento, 29,
    'o repasse tem de seguir a obra vigente (fim 28 + 1), não a âncora gravada');

  // E o efeito no caixa é o que importa: o dinheiro muda de mês.
  const serieNova = recebimentoBrutoMensal(linha, OBRA_NOVA, 60, 0);
  assert.ok(serieNova[29] > 0, 'o repasse entra no mês 29 sob a obra nova');
  assert.equal(serieNova[41], 0, 'e NÃO no mês 41, que era o da obra antiga');
});

test('#658 caso negativo: SEM `ancorasVivas`, a âncora persistida manda — mesmo divergindo do cronograma', () => {
  // A reancoragem é opt-in de propósito, e este teste é a razão. Medido: com
  // ela valendo para toda linha canônica, os quatro KPIs de CINCO baselines da
  // #468 se moviam e os dois testes de `ate_marco` degenerado da #444 caíam.
  // A fixture da #468 grava `mesPagamento: 42` com a obra terminando no mês 40
  // — o derivado seria 41. Repasse dois meses após a entrega era configurável
  // antes da #345, e esse dado existe. `mesPagamento` NÃO é projeção pura.
  const fp = {
    componentes: [
      { tipo: 'imediato', participacaoPct: 50, descontoPct: 0 },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
    ],
  };
  const lido = componentesPagamento(fp, CRONO, 0) as any[];   // obra 17→40 ⇒ derivado seria 41
  const repasse = lido.find((c) => c.tipo === 'concentrado');
  assert.equal(repasse.mesPagamento, 42,
    'sem o marcador, a âncora do usuário é preservada — 42, não 41');
});

test('#658 caso negativo: sem evento de obra, a âncora persistida é PRESERVADA', () => {
  // Derivar `fimObra = 0` de um cronograma sem obra trocaria um dado velho por
  // um dado errado — o repasse iria para o mês 1 em qualquer chamador que
  // ainda não montou o cronograma. Este teste é o que impede esse conserto.
  const legado = { entrada: [], parcelas: [], repasse: { apos_entrega_meses: 0 } };
  const fp = { ...legado, ancorasVivas: true, componentes: componentesDoLegado(legado, CRONO, 0) };
  const semObra: EventoCrono[] = CRONO.filter((e) => e.evento !== 'obra');

  const lido = componentesPagamento(fp, semObra, 0) as any[];
  const repasse = lido.find((c) => c.tipo === 'concentrado');
  assert.equal(repasse.mesPagamento, 41, 'sem obra no cronograma, o persistido continua valendo');
});

test('#458: ramo legado × ramo canônico divergem no MESMO fluxo_pagamento — "ao longo da obra"', () => {
  // Venda no mês 20, DENTRO da janela de obra (17..40). Diferença NOMEADA da
  // tabela da issue: no ramo LEGADO, o vencimento é ancorado em
  // `obra.inicio_mes + k×intervalo` e, com periodicidade mensal, sempre há um
  // k que bate exatamente no mês da venda (`vencimentosAoLongoObra` filtra só
  // `mes >= mesVenda`) — o mês da venda já recebe parcela. No ramo CANÔNICO
  // (`ate_marco`, motor de safras), `pagamentosAteMarco` nunca paga na
  // própria safra: a 1ª parcela cai em `safra + defasagemMeses` = safra + 1.
  const mesVenda = 20;
  const legado = linha458(mesVenda, false);
  const canonico = linha458(mesVenda, true);
  assert.equal(Array.isArray((legado.fluxo_pagamento as any).componentes), false,
    'pré-condição: a linha legada não tem componentes');
  const comps = (canonico.fluxo_pagamento as any).componentes;
  assert.ok(Array.isArray(comps) && comps.length > 0, 'pré-condição: a linha canônica tem componentes');

  const brutoLegado = recebimentoBrutoMensal(legado, CRONO, 60, 0);
  const brutoCanonico = recebimentoBrutoMensal(canonico, CRONO, 60, 0);

  assert.notDeepEqual(brutoCanonico, brutoLegado, 'os dois ramos têm de produzir séries diferentes');
  assert.ok(brutoLegado[mesVenda] > 0,
    'legado: o mês da venda já recebe parcela (vencimento ancorado na obra)');
  assert.equal(brutoCanonico[mesVenda], 0,
    'canônico: nada é recebido antes de safra + 1 — o mês da venda fica zerado');
  assert.ok(brutoCanonico[mesVenda + 1] > 0, 'canônico: a 1ª parcela cai em safra + 1');
});

test('#585: linha em shape LEGADO ignora a taxa do estudo — comportamento DECLARADO, não acidental', () => {
  // O revisor externo (rodada 5) apontou que a taxa global do estudo não chega
  // a uma linha cujo `fluxo_pagamento` não tem `componentes`: o guard de shape
  // em `recebiveisComponentesLinha` devolve `null` e o cálculo cai no motor
  // legado, que soma entrada/parcelas/repasse SEM juros.
  //
  // O achado procede, e a guarda é ANTERIOR a esta issue — idêntica na `main`
  // (`fd7a9de`, mesma linha). Trocar de motor não é conserto de juros: os dois
  // divergem no TIMING dos pagamentos, e a divergência está medida nos dois
  // testes `#458` logo acima. Fazer a troca aqui mudaria, dentro de um PR sobre
  // taxa de juros, um número que ninguém pediu para mudar.
  //
  // Então o caso fica DECLARADO em três lugares que se sustentam: este teste,
  // o aviso `p.plano-legado` no modal (com caso de render próprio) e a badge
  // "Plano não migrado" que a #458 já pôs no card do Grupo. Este teste é o que
  // impede a declaração de apodrecer: quem rotear o legado pelo adaptador
  // canônico derruba ESTE teste e tem de reescrever a declaração de propósito,
  // em vez de mudar o comportamento em silêncio.
  const mesVenda = 20;
  const legado = linha458(mesVenda, false);
  assert.equal(Array.isArray((legado.fluxo_pagamento as any).componentes), false,
    'pré-condição: a linha é legada');

  assert.deepEqual(
    recebimentoBrutoMensal(legado, CRONO, 60, 12.5),
    recebimentoBrutoMensal(legado, CRONO, 60, 0),
    'linha legada: a taxa do estudo não muda nada — é o motor legado, sem juros',
  );

  // Contraprova, no MESMO plano: a linha canônica responde à taxa. Sem ela,
  // este teste passaria também num app em que a taxa do estudo não chega a
  // lugar nenhum — que é precisamente o defeito que a issue conserta.
  const canonico = linha458(mesVenda, true);
  assert.notDeepEqual(
    recebimentoBrutoMensal(canonico, CRONO, 60, 12.5),
    recebimentoBrutoMensal(canonico, CRONO, 60, 0),
    'linha canônica: a taxa do estudo TEM de mudar a série',
  );
});

test('#458 caso negativo: com `componentes` presente nos DOIS Grupos, as séries são iguais', () => {
  // Prova que a divergência acima vem do RAMO escolhido, não de uma diferença
  // escondida na fixture: quando os dois lados já são canônicos, o mesmo
  // fluxo_pagamento produz exatamente o mesmo resultado.
  const mesVenda = 20;
  const a = linha458(mesVenda, true);
  const b = linha458(mesVenda, true);
  assert.deepEqual(recebimentoBrutoMensal(a, CRONO, 60, 0), recebimentoBrutoMensal(b, CRONO, 60, 0));
});

// ── #456: KPIs de tela — juros de clientes, carteira máxima, exposição máxima
// ── (e o mês em que cada uma ocorre) ────────────────────────────────────────
//
// A matemática já existia (`jurosClientes`/`carteiraClientesMaxima`/
// `mesCarteiraClientesMaxima`, #283); estes testes cobrem o que a #456
// acrescentou: `mesExposicaoMaxima` no motor (critério 2), o caso de borda
// `mesCarteira === null` (critério 1) e o percentual com divisor zero →
// `0`, nunca `NaN` (critério 3).

test('#456 mesCarteiraClientesMaxima bate com Math.max/indexOf, e é null quando a carteira é toda zero', () => {
  // Estudo com componente financiado → carteira > 0 em algum mês.
  const comCarteira: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Venda financiada',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
      fluxo_pagamento: { componentes: [{
        tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0,
        prazoMeses: 12, defasagemMeses: 1, taxaMensal: 0.01,
        jurosNoMesDaContratacao: false,
      }] },
    }],
    linhasCusto: [], areaTerreno: 0,
  };
  const r = calcularFluxo(comCarteira);
  assert.ok(r.carteiraClientesMaxima > 0);
  assert.equal(r.carteiraClientesMaxima, Math.max(0, ...r.carteiraClientesMensal));
  assert.equal(r.mesCarteiraClientesMaxima, r.carteiraClientesMensal.indexOf(r.carteiraClientesMaxima));

  // Estudo legado (sem `componentes`) → carteira toda zero → mês É `null`,
  // não `-1` nem `0` — um KPI que renderizasse "mês null"/"mês -1" passaria
  // sem este caso. É o comportamento que `:2352-2353` já implementa.
  const semCarteira: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Venda legada',
      tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    }],
    linhasCusto: [], areaTerreno: 0,
  };
  const r2 = calcularFluxo(semCarteira);
  assert.equal(r2.carteiraClientesMaxima, 0);
  assert.equal(r2.mesCarteiraClientesMaxima, null);
});

test('#456 mesExposicaoMaxima bate com fluxoAcumulado.indexOf(exposicaoMaxima)', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Torre',
      tipologias: [{ id: 1, quantidade: 20, area_privativa_m2: 80, preco_m2: 9_000 }],
      absorcao: { modo: 'linear' },
    }],
    linhasCusto: [
      { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 5_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
      { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 8_000_000, orcamento_unidade: 'rs', inicio_mes: 6, duracao_meses: 18 },
    ],
    areaTerreno: 0,
  };
  const r = calcularFluxo(config);
  assert.equal(r.mesExposicaoMaxima, r.fluxoAcumulado.indexOf(r.exposicaoMaxima));
  assert.notEqual(r.mesExposicaoMaxima, null, 'estudo com prazo > 0 sempre tem o mínimo dentro do próprio array');
});

test('#456 agregarFluxoPorPeriodos recalcula mesExposicaoMaxima contra a série JÁ agregada — achado de auto-revisão', () => {
  // `agregarFluxoPorPeriodos` espalha (`...c`) o `FluxoCalc` mensal e SÓ
  // sobrescreve as séries que resume; `exposicaoMaxima` fica de propósito
  // sem recalcular (é o mínimo MENSAL verdadeiro — ver o teste "acumulado é
  // o saldo do ÚLTIMO mês", mais acima). Mas `mesExposicaoMaxima` é um
  // ÍNDICE, e o índice do mês na série mensal não é o índice do período na
  // série agregada: sem recalcular, o consumidor (`graficoFluxoAcumulado`)
  // armaria o marcador na posição errada do eixo X em vez de sumir (-1),
  // que era o comportamento de antes desta issue.
  const base: FluxoCalc = calcularFluxo({
    dataInicio: 'jan/2027', prazoMeses: 6, taxaDescontoAa: 12,
    jurosTabelaAaEstudo: 0,
    cronograma: [], linhasReceita: [], linhasCusto: [], areaTerreno: 0,
  });
  // Mínimo verdadeiro (-100) cai no mês 2, que NÃO é fim de nenhum período —
  // o período 0 termina no mês 3. A série agregada é
  // [fluxoAcumuladoMensal[3], fluxoAcumuladoMensal[5]] = [-100, -60]: o valor
  // -100 aparece ali de novo (mês 3), então o marcador é legítimo — mas o
  // índice tem de ser 0 (posição do PERÍODO), nunca 2 ou 3 (posição do MÊS).
  // `mesExposicaoMaxima: 999` é sentinela deliberada: se `agregarFluxoPorPeriodos`
  // voltar a espalhar `...c` sem recalcular este campo (a regressão real desta
  // auto-revisão), o teste falha com 999 em vez de coincidir com a resposta certa.
  const fluxoAcumuladoMensal = [0, -50, -100, -100, -80, -60];
  const mensal: FluxoCalc = {
    ...base, prazo: 6, fluxoAcumulado: fluxoAcumuladoMensal, exposicaoMaxima: -100, mesExposicaoMaxima: 999,
  };
  const periodos = [{ rotulo: 'P0', inicio: 0, fim: 3 }, { rotulo: 'P1', inicio: 4, fim: 5 }];
  const anual = agregarFluxoPorPeriodos(mensal, periodos);

  assert.deepEqual(anual.fluxoAcumulado, [-100, -60]);
  assert.equal(anual.exposicaoMaxima, -100, 'o VALOR não recalcula — continua o mínimo mensal verdadeiro');
  assert.equal(anual.mesExposicaoMaxima, 0,
    'o ÍNDICE aponta pro período 0 (agregado), não pro mês 2 nem 3 (mensal), nem sobra a sentinela 999');
});

test('#456 agregarFluxoPorPeriodos: mesExposicaoMaxima vira null quando o mínimo não cai em fim de período', () => {
  const base: FluxoCalc = calcularFluxo({
    dataInicio: 'jan/2027', prazoMeses: 4, taxaDescontoAa: 12,
    jurosTabelaAaEstudo: 0,
    cronograma: [], linhasReceita: [], linhasCusto: [], areaTerreno: 0,
  });
  // Mínimo único no mês 2; os períodos terminam nos meses 1 e 3 — o valor
  // -100 nunca aparece na série agregada [-30, -60].
  const fluxoAcumuladoMensal = [0, -30, -100, -60];
  const mensal: FluxoCalc = {
    ...base, prazo: 4, fluxoAcumulado: fluxoAcumuladoMensal, exposicaoMaxima: -100, mesExposicaoMaxima: 999,
  };
  const periodos = [{ rotulo: 'P0', inicio: 0, fim: 1 }, { rotulo: 'P1', inicio: 2, fim: 3 }];
  const anual = agregarFluxoPorPeriodos(mensal, periodos);

  assert.deepEqual(anual.fluxoAcumulado, [-30, -60]);
  assert.equal(anual.mesExposicaoMaxima, null,
    'nao pode sobrar indice STALE (999 nem 2) quando o minimo mensal nao cai em fim de periodo');
});

test('#456 pctDeReceitaBruta: divisor zero devolve 0, nunca NaN', () => {
  assert.equal(pctDeReceitaBruta(1_000, 0), 0);
  assert.equal(pctDeReceitaBruta(1_000, -500), 0);
  assert.ok(perto(pctDeReceitaBruta(500_000, 10_000_000), 5, 0.0001));
});

// ── #238: permuta financeira — bases bruta e líquida ────────────────────────
//
// As duas funções existiam desde a Fase 7 sem NENHUM teste. A issue lista como
// testes mínimos: sem deduções, só imposto, só corretagem, ambas, e taxa zero.

test('#238 base bruta: percentual direto sobre a receita de caixa', () => {
  const r = permutaFinanceiraBrutaMensal([1000, 2000, 0], 10);
  assert.deepEqual(r, [100, 200, 0]);
});

test('#238 sem deduções, líquida == bruta', () => {
  const receita = [1000, 2000];
  const bruta = permutaFinanceiraBrutaMensal(receita, 10);
  const liquida = permutaFinanceiraLiquidaMensal(receita, [0, 0], [0, 0], 10);
  assert.deepEqual(liquida, bruta);
});

test('#238 só imposto deduz da base', () => {
  // (1000 − 200) × 10% = 80
  assert.deepEqual(permutaFinanceiraLiquidaMensal([1000], [200], [0], 10), [80]);
});

test('#238 só corretagem deduz da base', () => {
  // (1000 − 50) × 10% = 95
  assert.deepEqual(permutaFinanceiraLiquidaMensal([1000], [0], [50], 10), [95]);
});

test('#238 imposto e corretagem juntos: SUBTRAÇÃO, não desconto multiplicativo', () => {
  // A issue proíbe explicitamente o desconto multiplicativo.
  // Correto:   (1000 − 200 − 50) × 10% = 75
  // Errado:    1000 × 0,8 × 0,95 × 10% = 76
  assert.deepEqual(permutaFinanceiraLiquidaMensal([1000], [200], [50], 10), [75]);
});

test('#238 base líquida nunca fica negativa (clamp em 0)', () => {
  // Deduções acima da receita do mês não geram permuta negativa.
  assert.deepEqual(permutaFinanceiraLiquidaMensal([100], [200], [50], 10), [0]);
});

test('#238 taxa zero de permuta gera série zero nas duas bases', () => {
  assert.deepEqual(permutaFinanceiraBrutaMensal([1000, 2000], 0), [0, 0]);
  assert.deepEqual(permutaFinanceiraLiquidaMensal([1000, 2000], [100, 100], [10, 10], 0), [0, 0]);
});

test('#238 meses sem receita não geram permuta', () => {
  assert.deepEqual(permutaFinanceiraBrutaMensal([0, 0, 500], 20), [0, 0, 100]);
});

// ── #459: permutaFinanceiraDeduzidaMensal — generalização com dois flags ───

test('#459 permutaFinanceiraDeduzidaMensal: as quatro combinações batem com as funções antigas', () => {
  const receita = [1000];
  const imposto = [200];
  const corretagem = [50];
  assert.deepEqual(
    permutaFinanceiraDeduzidaMensal(receita, imposto, corretagem, 10, false, false),
    permutaFinanceiraBrutaMensal(receita, 10),
  );
  assert.deepEqual(
    permutaFinanceiraDeduzidaMensal(receita, imposto, corretagem, 10, true, true),
    permutaFinanceiraLiquidaMensal(receita, imposto, corretagem, 10),
  );
  // Mistas: só imposto e só corretagem, cada uma isolada do outro flag.
  assert.deepEqual(permutaFinanceiraDeduzidaMensal(receita, imposto, corretagem, 10, true, false), [80]);
  assert.deepEqual(permutaFinanceiraDeduzidaMensal(receita, imposto, corretagem, 10, false, true), [95]);
});

test('#459 permutaFinanceiraDeduzidaMensal: mutação — trocar `&&` por `||` nos dois flags quebra o teste acima', () => {
  // Documenta a armadilha: se a implementação decidisse "deduz se QUALQUER
  // flag estiver ligado" em vez de cada flag controlar sua própria dedução,
  // (true,false) devolveria a base líquida inteira (75), não 80.
  const r = permutaFinanceiraDeduzidaMensal([1000], [200], [50], 10, true, false);
  assert.notEqual(r[0], 75);
  assert.deepEqual(r, [80]);
});

test('#238 série ausente de imposto/corretagem é tratada como zero', () => {
  // O motor passa séries de comprimentos possivelmente distintos.
  assert.deepEqual(permutaFinanceiraLiquidaMensal([1000, 1000], [100], [], 10), [90, 100]);
});

// #459: as quatro combinações dos dois flags independentes de dedução.
// VGV 100M, RET 4% (imposto = 4M), corretagem 5% (5M), permuta 10%.
//   (false,false) "bruta"     → base 100M            → permuta 10,0M
//   (true, false) só imposto  → base 100M − 4M  = 96M → permuta  9,6M
//   (false,true ) só corret.  → base 100M − 5M  = 95M → permuta  9,5M
//   (true, true ) "líquida"   → base 100M −4M−5M= 91M → permuta  9,1M
test('#459: as quatro combinações de deduzir_imposto × deduzir_corretagem', () => {
  const montar = (deduzirImposto: boolean, deduzirCorretagem: boolean): FluxoConfig => ({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 5, orcamento_unidade: 'pct_vgv' },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
        orcamento_valor: 10, orcamento_unidade: 'pct_vgv',
        permuta_financeira_deduzir_imposto: deduzirImposto,
        permuta_financeira_deduzir_corretagem: deduzirCorretagem,
      },
    ],
    areaTerreno: 0,
    ret: { ativo: true, pct: 4 }, // #346: RET é global, não mais lido de fluxo_pagamento
  });
  const achar = (c: FluxoConfig) =>
    calcularFluxo(c).linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;

  const brutaBruta = achar(montar(false, false));
  assert.ok(perto(brutaBruta.total, -10_000_000, 1));

  const soImposto = achar(montar(true, false));
  assert.ok(perto(soImposto.total, -9_600_000, 1));

  const soCorretagem = achar(montar(false, true));
  assert.ok(perto(soCorretagem.total, -9_500_000, 1));

  const liquida = achar(montar(true, true));
  assert.ok(perto(liquida.total, -9_100_000, 1));

  // Mutação: as combinações mistas ficam ESTRITAMENTE entre os dois extremos —
  // `total` é NEGATIVO (dedução de receita), então "entre" em módulo significa
  // maior que o extremo bruto (-10M) e menor que o extremo líquido (-9,1M).
  assert.ok(soImposto.total > brutaBruta.total && soImposto.total < liquida.total);
  assert.ok(soCorretagem.total > brutaBruta.total && soCorretagem.total < liquida.total);
});

test('#459 permutaAlternativa expõe a base OPOSTA (flags invertidos), para auditoria', () => {
  // Mesma fixture do teste acima. Escolhida = líquida (9,1M); oposta = bruta (10M).
  const montar = (deduzirImposto: boolean, deduzirCorretagem: boolean): FluxoConfig => ({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [
      { id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 5, orcamento_unidade: 'pct_vgv' },
      {
        id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
        orcamento_valor: 10, orcamento_unidade: 'pct_vgv',
        permuta_financeira_deduzir_imposto: deduzirImposto,
        permuta_financeira_deduzir_corretagem: deduzirCorretagem,
      },
    ],
    areaTerreno: 0,
    ret: { ativo: true, pct: 4 }, // #346: RET é global, não mais lido de fluxo_pagamento
  });
  const achar = (c: FluxoConfig) =>
    calcularFluxo(c).linhasReceita.find((l) => l.grupo === 'receita' && l.nome.includes('Permuta'))!;

  const comLiquida = achar(montar(true, true));
  assert.equal(comLiquida.permutaAlternativa?.deduzirImposto, false);
  assert.equal(comLiquida.permutaAlternativa?.deduzirCorretagem, false);
  assert.ok(perto(comLiquida.permutaAlternativa!.total, 10_000_000, 1));

  // Escolhendo bruta, a oposta é a líquida — simétrico.
  const comBruta = achar(montar(false, false));
  assert.equal(comBruta.permutaAlternativa?.deduzirImposto, true);
  assert.equal(comBruta.permutaAlternativa?.deduzirCorretagem, true);
  assert.ok(perto(comBruta.permutaAlternativa!.total, 9_100_000, 1));
  // E a escolhida continua sendo a que alimenta o fluxo.
  assert.ok(perto(comBruta.total, -10_000_000, 1));

  // Combinação mista: a oposta de (imposto=true, corretagem=false) é
  // (imposto=false, corretagem=true) — bem definida mesmo fora dos extremos.
  const soImposto = achar(montar(true, false));
  assert.equal(soImposto.permutaAlternativa?.deduzirImposto, false);
  assert.equal(soImposto.permutaAlternativa?.deduzirCorretagem, true);
  assert.ok(perto(soImposto.permutaAlternativa!.total, 9_500_000, 1));
});

test('#238 permuta em R$ não tem alternativa — as duas bases dão o mesmo valor', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [{
      id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
      orcamento_valor: 1_000_000, orcamento_unidade: 'rs',
    }],
    areaTerreno: 0,
  };
  const d = calcularFluxo(config).linhasReceita.find((l) => l.nome.includes('Permuta'))!;
  assert.equal(d.permutaAlternativa, undefined);
});

test('#238 auditoria preserva o valor canônico quando o percentual visível está desatualizado', () => {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: 0,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
      absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
      fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
    }],
    linhasCusto: [{
      id: 2, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira',
      orcamento_valor: 50, orcamento_unidade: 'pct_vgv',
      orcamento_valor_canonico: 10_000_000,
      permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
    }],
    areaTerreno: 0,
  };
  const d = calcularFluxo(config).linhasReceita.find((l) => l.nome.includes('Permuta'))!;
  assert.equal(d.total, -10_000_000); // canônico equivale a 10%, não aos 50% visíveis
  assert.equal(d.permutaAlternativa?.total, 10_000_000);
});

// ── #429: o descarte de absorção deixa rastro no motor ───────────────────

/** Captura os `console.warn` emitidos durante `fn`, restaurando o original. */
const capturarWarns = (fn: () => void): string[] => {
  const original = console.warn;
  const out: string[] = [];
  console.warn = (...args: unknown[]) => { out.push(args.map(String).join(' ')); };
  try { fn(); } finally { console.warn = original; }
  return out;
};

const configAbsorcao = (meses: { mes: number; pct: number }[]): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  linhasReceita: [{
    id: 1, nome: 'Vendas',
    tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 20_000 }],
    absorcao: { modo: 'personalizado', meses },
    fluxo_pagamento: { entrada: { modo: 'entrada', parcelas: 1, pct: 100 } },
  }],
  linhasCusto: [], areaTerreno: 0,
} as unknown as FluxoConfig);

test('#429 calcularFluxo avisa quando a curva de absorção não fecha na janela', () => {
  // periodoAbsorcao(CRONO) = { inicio: 6, fim: 52 } → o mês 53 fica de fora.
  const avisos = capturarWarns(() => calcularFluxo(
    configAbsorcao([{ mes: 12, pct: 60 }, { mes: 19, pct: 30 }, { mes: 53, pct: 10 }])));
  const meu = avisos.filter((a) => a.includes('absorção da linha'));
  assert.equal(meu.length, 1, `avisos: ${avisos.join(' | ')}`);
  assert.match(meu[0], /"Vendas"/);
  assert.match(meu[0], /90\.00%/);
  assert.match(meu[0], /10\.00 pp/);
  assert.match(meu[0], /NÃO foram computados/);
});

test('#429 calcularFluxo avisa mesmo quando a soma truncada fecha 100 por coincidência', () => {
  // 60 + 40 dentro da janela + 10 no mês 53: Σ pcts = 100, mas a curva
  // declarava 110 e 10 pp foram descartados.
  const avisos = capturarWarns(() => calcularFluxo(
    configAbsorcao([{ mes: 12, pct: 60 }, { mes: 19, pct: 40 }, { mes: 53, pct: 10 }])));
  const meu = avisos.filter((a) => a.includes('absorção da linha'));
  assert.equal(meu.length, 1, `avisos: ${avisos.join(' | ')}`);
  assert.match(meu[0], /declara 110\.00%/);
});

test('#429 calcularFluxo NÃO avisa quando a curva fecha 100% dentro da janela', () => {
  const avisos = capturarWarns(() => calcularFluxo(
    configAbsorcao([{ mes: 12, pct: 60 }, { mes: 19, pct: 40 }])));
  assert.deepEqual(avisos.filter((a) => a.includes('absorção da linha')), []);
});

test('#429 o aviso NÃO corrige: a venda bruta contratada continua a truncada', () => {
  let comDescarte!: FluxoCalc;
  let semDescarte!: FluxoCalc;
  capturarWarns(() => { // silencia o aviso esperado; o assunto aqui é o número
    comDescarte = calcularFluxo(
      configAbsorcao([{ mes: 12, pct: 60 }, { mes: 19, pct: 30 }, { mes: 53, pct: 10 }]));
    semDescarte = calcularFluxo(configAbsorcao([{ mes: 12, pct: 60 }, { mes: 19, pct: 40 }]));
  });
  // 100 un × 50 m² × 20.000 = 100.000.000 de VGV; 90% contratados, não 100%.
  assert.ok(perto(comDescarte.vendaBrutaContratada, 90_000_000));
  assert.ok(perto(semDescarte.vendaBrutaContratada, 100_000_000));
});

// ─────────────────────────────────────────────────────────────────────────
// #446 — o horizonte cobre TODO mês em que algo entra ou sai.
//
// Decisão do autor, 2026-08-22: "o fluxo vai até o último mês que é enquanto
// alguma coisa está entrando ou saindo do fluxo". Antes, cronograma, custos e
// recebíveis entravam no `Math.max` do horizonte e as operações de FUNDING
// não — e o funding herda o horizonte já fechado (`fundingDoEstudo`:
// `const prazo = fluxoLivreMensal.length`), então uma operação que amortizava
// além do último evento operacional era CORTADA, em silêncio.
// ─────────────────────────────────────────────────────────────────────────

/** Estudo cujo último evento operacional é o mês 23 (obra 0..23). */
const baseAte23 = (): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, areaTerreno: 0,
  jurosTabelaAaEstudo: 0,
  cronograma: [{ evento: 'obra', inicio_mes: 0, duracao_meses: 24 } as any],
  linhasReceita: [],
  linhasCusto: [{ id: 1, grupo: 'obra', categoria: 'Construção', orcamento_valor: 1_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 24 }],
});

test('#446: o horizonte alcança a quitação da dívida — a conta, não um >=', () => {
  const semFunding = calcularFluxo(baseAte23());
  // Ancoragem: sem funding o horizonte é o operacional. Se este número mudar,
  // o teste abaixo deixa de provar o que diz.
  assert.equal(semFunding.prazo, 24, 'último evento operacional é o mês 23 ⇒ 24 meses');

  const comFunding = calcularFluxo({
    ...baseAte23(),
    operacoesFunding: [{
      tipo: 'divida', inicio_mes: 0, distribuir_aporte: false, periodo_amortizacao_meses: 36,
    }],
  });
  // fim = inicio_mes + nTranches - 1 + amort = 0 + 1 - 1 + 36 = 36, 0-based e
  // INCLUSIVO (a quitação é paga no próprio mês `fim`) ⇒ comprimento 37.
  assert.equal(comFunding.prazo, 37);
  assert.equal(comFunding.fluxoMensal.length, 37);
});

test('#446: prazoMeses é PISO — um valor menor que o derivado não trunca nada', () => {
  // Derivado: obra 0..47 ⇒ 48.
  const cfg: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, areaTerreno: 0,
    jurosTabelaAaEstudo: 0,
    cronograma: [{ evento: 'obra', inicio_mes: 0, duracao_meses: 48 } as any],
    linhasReceita: [], linhasCusto: [],
  };
  assert.equal(calcularFluxo(cfg).prazo, 48, 'ancoragem: o derivado deste estudo é 48');

  const curto = calcularFluxo({ ...cfg, prazoMeses: 12 });
  assert.equal(curto.prazo, 48);
  assert.equal(curto.fluxoMensal.length, 48);
});

test('#446: prazoMeses ainda ESTICA — piso não é o mesmo que ignorar', () => {
  const cfg: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, areaTerreno: 0,
    jurosTabelaAaEstudo: 0,
    cronograma: [{ evento: 'obra', inicio_mes: 0, duracao_meses: 48 } as any],
    linhasReceita: [], linhasCusto: [],
  };
  const longo = calcularFluxo({ ...cfg, prazoMeses: 60 });
  assert.equal(longo.prazo, 60);
  assert.equal(longo.fluxoMensal.length, 60);
});

test('#446: o aporte de equity além do último evento operacional entra no horizonte', () => {
  const c = calcularFluxo({
    ...baseAte23(),
    operacoesFunding: [{ tipo: 'equity', inicio_mes: 40 }],
  });
  // Sem `periodo_amortizacao_meses`, o que manda é `max(inicio_mes, mesRepasse)`
  // — aqui o aporte no mês 40 é o último evento financeiro ⇒ 41 meses.
  assert.equal(c.prazo, 41);
});

test('#446: estudo SEM funding tem horizonte idêntico ao baseline', () => {
  const semCampo = calcularFluxo(baseAte23());
  const comCampoVazio = calcularFluxo({ ...baseAte23(), operacoesFunding: [] });
  assert.equal(semCampo.prazo, comCampoVazio.prazo);
  assert.deepEqual(semCampo.fluxoMensal, comCampoVazio.fluxoMensal);
});

test('#446: esticar o horizonte NÃO move o resultado final desalavancado (#474)', () => {
  // Por que este teste existe: quatro telas (Resumo, Dashboard, Análise de
  // Mercado, Orçamento de Custos) leem o fluxo DESALAVANCADO e, de propósito,
  // não carregam operações — então o horizonte delas continua o operacional,
  // menor que o das telas que simulam funding. A #474 avisa que
  // `resultadoFinal` é remontado em cinco lugares e que um horizonte maior
  // muda o valor lido em todas elas. Aqui se prova que NÃO muda: os meses
  // extras não carregam movimento operacional, então o acumulado fica plano e
  // `fluxoAcumulado[último]` é o mesmo. Só o COMPRIMENTO difere.
  const curto = calcularFluxo(baseAte23());
  const longo = calcularFluxo({
    ...baseAte23(),
    operacoesFunding: [{ tipo: 'divida', inicio_mes: 0, distribuir_aporte: false, periodo_amortizacao_meses: 36 }],
  });
  assert.notEqual(curto.prazo, longo.prazo, 'ancoragem: os horizontes têm de ser diferentes');
  const ultimo = (s: number[]) => s[s.length - 1];
  assert.equal(ultimo(longo.fluxoAcumulado), ultimo(curto.fluxoAcumulado));
});

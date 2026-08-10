import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarFluxoCalc, validarComponentesSafra, validarPermutaFisica, permutaFisicaPorTipologia,
  validarProduto, validarContratacao, validarSafrasReceita, validarCapitalStack, validarCustosDuplicados,
  unidadesNaoAlocadasPorTipologia, TOLERANCIA_PADRAO,
} from './fluxo-invariantes.js';
import type { FluxoCalc, ComponentePagamento } from './fluxo-caixa-motor.js';
import type { ResultadoCapitalStack } from './capital-stack-motor.js';

// FluxoCalc mínimo para exercitar validarFluxoCalc — só os campos que a
// invariante lê precisam existir de fato.
const fluxoBase = (vendaLiquidaContratada: number, receitaBruta: number, jurosClientes = 0): FluxoCalc => ({
  prazo: 1, meses: ['jan/27'], receitaMensal: [], custoMensal: [], fluxoMensal: [], fluxoAcumulado: [],
  vgvTotal: 0, vpl: 0, tir: null, paybackMes: null, paybackData: null, exposicaoMaxima: 0,
  vgvPermutaFisica: 0, receitaBrutaVgv: 0, vgvVendavel: 0,
  vendaBrutaContratada: vendaLiquidaContratada, descontoComercial: 0,
  vendaLiquidaContratada, receitaBruta, jurosClientes,
  receitaBrutaMensal: [receitaBruta], principalRecebidoMensal: [receitaBruta - jurosClientes],
  jurosClientesMensal: [jurosClientes], carteiraClientesMensal: [0], repasseMensal: [0],
  linhasReceita: [], linhasCusto: [],
} as unknown as FluxoCalc);

test('validarFluxoCalc: cenário válido (Receita Bruta = venda líquida contratada) não gera divergência', () => {
  assert.deepEqual(validarFluxoCalc(fluxoBase(1_000_000, 1_000_000)), []);
});

test('#283 validarFluxoCalc inclui juros de clientes na reconciliação', () => {
  assert.deepEqual(validarFluxoCalc(fluxoBase(1_000_000, 1_120_000, 120_000)), []);
});

test('validarFluxoCalc: diferença de centavos DENTRO da tolerância não diverge', () => {
  assert.deepEqual(validarFluxoCalc(fluxoBase(1_000_000, 1_000_000.005)), []);
});

test('validarFluxoCalc: diferença de centavos FORA da tolerância diverge, com esperado/encontrado/diferença', () => {
  const r = validarFluxoCalc(fluxoBase(1_000_000, 1_000_050));
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'RECEITA_BRUTA_NAO_CONSERVA');
  assert.equal(r[0].severidade, 'erro');
  assert.equal(r[0].esperado, 1_000_000);
  assert.equal(r[0].encontrado, 1_000_050);
  assert.ok(Math.abs(r[0].diferenca - 50) < 1e-9);
});

test('validarFluxoCalc: receita não conservada (menor que o contratado)', () => {
  const r = validarFluxoCalc(fluxoBase(1_000_000, 900_000));
  assert.equal(r.length, 1);
  assert.equal(r[0].diferenca, -100_000);
});

test('#283 validarFluxoCalc reconcilia Receita Bruta mensal = principal + juros', () => {
  const fluxo = {
    ...fluxoBase(100, 110, 10),
    receitaBrutaMensal: [110], principalRecebidoMensal: [100], jurosClientesMensal: [10],
    carteiraClientesMensal: [0], repasseMensal: [40],
  };
  assert.deepEqual(validarFluxoCalc(fluxo), []);

  const divergencias = validarFluxoCalc({ ...fluxo, principalRecebidoMensal: [90] });
  assert.equal(divergencias.find((d) => d.codigo === 'RECEITA_MENSAL_NAO_RECONCILIA')?.mes, 0);
});

test('#283 validarFluxoCalc exige carteira zerada no fim do horizonte', () => {
  const fluxo = {
    ...fluxoBase(100, 100),
    receitaBrutaMensal: [100], principalRecebidoMensal: [100], jurosClientesMensal: [0],
    carteiraClientesMensal: [25], repasseMensal: [0],
  };
  const divergencia = validarFluxoCalc(fluxo).find((d) => d.codigo === 'CARTEIRA_FINAL_NAO_ZERA');
  assert.equal(divergencia?.encontrado, 25);
});

test('#283 validarFluxoCalc impede classificar como repasse valor maior que o recebido', () => {
  const fluxo = {
    ...fluxoBase(100, 100),
    receitaBrutaMensal: [100], principalRecebidoMensal: [100], jurosClientesMensal: [0],
    carteiraClientesMensal: [0], repasseMensal: [100.02],
  };
  const divergencia = validarFluxoCalc(fluxo).find((d) => d.codigo === 'REPASSE_SUPERA_RECEITA');
  assert.equal(divergencia?.mes, 0);
});

test('validarFluxoCalc reconcilia contratação líquida = bruta − descontos', () => {
  const valido = { ...fluxoBase(90, 90), vendaBrutaContratada: 100, descontoComercial: 10 };
  assert.equal(validarFluxoCalc(valido).some((d) => d.codigo === 'CONTRATACAO_NAO_RECONCILIA'), false);
  const invalido = { ...valido, vendaLiquidaContratada: 91, receitaBruta: 91 };
  const div = validarFluxoCalc(invalido).find((d) => d.codigo === 'CONTRATACAO_NAO_RECONCILIA');
  assert.equal(div?.esperado, 90);
  assert.equal(div?.encontrado, 91);
});

test('validarFluxoCalc diferencia carteira negativa e repasse repetido', () => {
  const fluxo = {
    ...fluxoBase(100, 100), vendaBrutaContratada: 100,
    receitaBrutaMensal: [50, 50], principalRecebidoMensal: [50, 50], jurosClientesMensal: [0, 0],
    carteiraClientesMensal: [20, -1], repasseMensal: [25, 25],
  };
  const codigos = validarFluxoCalc(fluxo).map((d) => d.codigo);
  assert.ok(codigos.includes('CARTEIRA_NEGATIVA'));
  assert.ok(codigos.includes('REPASSE_EM_MULTIPLOS_MESES'));
});

// ── validarComponentesSafra ──────────────────────────────────────────────

const COMPONENTE_PRAZO_FIXO: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }> = {
  tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0, prazoMeses: 4,
  defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'curta',
};

test('validarComponentesSafra: cenário totalmente válido (soma 100%, carteira zera, nunca ressurge)', () => {
  assert.deepEqual(validarComponentesSafra([COMPONENTE_PRAZO_FIXO], 10, 400_000), []);
});

test('validarComponentesSafra: soma dos componentes diverge de 100%', () => {
  const componentes: ComponentePagamento[] = [
    { ...COMPONENTE_PRAZO_FIXO, participacaoPct: 60 },
    { tipo: 'imediato', participacaoPct: 30, descontoPct: 0 },
  ]; // soma 90%, não 100%
  const r = validarComponentesSafra(componentes, 10, 400_000);
  const div = r.find((d) => d.codigo === 'SOMA_COMPONENTES_DIVERGE')!;
  assert.ok(div, 'deveria reportar soma divergente');
  assert.equal(div.safra, 10);
  assert.equal(div.esperado, 100);
  assert.equal(div.encontrado, 90);
});

test('validarComponentesSafra: componente que fecha exato (N_s = 1) não reporta carteira residual', () => {
  // CARTEIRA_NAO_ZERA/CARTEIRA_RESSURGE são defensivas: as funções puras do
  // motor de safra (#232-#237) já garantem o fechamento por construção — não
  // há hoje um componente válido que viole essas duas checagens. Ficam
  // prontas para pegar uma REGRESSÃO futura no motor, não um caso atual.
  const componenteAteMarco: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 11,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até marco',
  };
  const r = validarComponentesSafra([componenteAteMarco], 10, 400_000);
  assert.deepEqual(r, []);
});

test('validarComponentesSafra: N_s ≤ 0 (venda no/após o marco) reporta COMPONENTE_INVALIDO, não quebra', () => {
  const componenteInvalido: Extract<ComponentePagamento, { tipo: 'ate_marco' }> = {
    tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 10,
    defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até marco',
  };
  // safra 10 == marcoMes 10 → N_s = 0 ≤ 0 (#233): pagamentosAteMarco lança.
  const r = validarComponentesSafra([componenteInvalido], 10, 400_000);
  const div = r.find((d) => d.codigo === 'COMPONENTE_INVALIDO')!;
  assert.ok(div, 'deveria reportar o componente inválido em vez de lançar');
  assert.equal(div.safra, 10);
  assert.equal(div.linha, 'até marco');
});

test('validarComponentesSafra: tolerância de 1 centavo não gera falso positivo', () => {
  const r = validarComponentesSafra(
    [{ ...COMPONENTE_PRAZO_FIXO, participacaoPct: 100.005 }],
    10, 400_000, TOLERANCIA_PADRAO,
  );
  assert.deepEqual(r.filter((d) => d.codigo === 'SOMA_COMPONENTES_DIVERGE'), []);
});

test('validarComponentesSafra: imediato não entra na checagem de carteira (paga e encerra no mesmo mês)', () => {
  const r = validarComponentesSafra([{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }], 5, 100_000);
  assert.deepEqual(r, []);
});

// ── validarPermutaFisica (#269) ──────────────────────────────────────────

const TIPOLOGIAS = [{ id: 1, nome: 'Studio', quantidade: 20 }, { id: 2, nome: '2 dorms', quantidade: 10 }];

test('validarPermutaFisica: dentro do estoque não diverge', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 15 },
  ];
  assert.deepEqual(validarPermutaFisica(linhasCusto, TIPOLOGIAS), []);
});

test('validarPermutaFisica: excede o estoque da tipologia — ERRO com esperado/encontrado/diferença', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 25 },
  ];
  const r = validarPermutaFisica(linhasCusto, TIPOLOGIAS);
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'PERMUTA_FISICA_EXCEDE_ESTOQUE');
  assert.equal(r[0].severidade, 'erro');
  assert.equal(r[0].linha, 'Studio');
  assert.equal(r[0].esperado, 20);
  assert.equal(r[0].encontrado, 25);
  assert.equal(r[0].diferenca, 5);
});

test('validarPermutaFisica: soma DUAS linhas para a mesma tipologia antes de comparar com o estoque', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 12 },
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 9 },
  ];
  // 12 + 9 = 21 > 20 do catálogo, mesmo que nenhuma linha isolada exceda.
  const r = validarPermutaFisica(linhasCusto, TIPOLOGIAS);
  assert.equal(r.length, 1);
  assert.equal(r[0].encontrado, 21);
});

test('validarPermutaFisica: ignora linhas que não são Permuta física e sem tipologia referenciada', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista', orcamento_valor: 1_000_000 },
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: null, permuta_quantidade: 5 },
  ];
  assert.deepEqual(validarPermutaFisica(linhasCusto, TIPOLOGIAS), []);
});

test('validarPermutaFisica: tolerância de 1 centavo/unidade não gera falso positivo', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 20.005 },
  ];
  assert.deepEqual(validarPermutaFisica(linhasCusto, TIPOLOGIAS, TOLERANCIA_PADRAO), []);
});

// ── permutaFisicaPorTipologia (#269) — mesma fonte que tela e exportação ──

const TIPOLOGIAS_COM_AREA = [
  { id: 1, nome: 'Studio', quantidade: 20, area_privativa_m2: 25 },
  { id: 2, nome: '2 dorms', quantidade: 10, area_privativa_m2: 60 },
];

test('permutaFisicaPorTipologia: uma tipologia com permuta — quantidade e área corretas', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 5 },
  ];
  const r = permutaFisicaPorTipologia(linhasCusto, TIPOLOGIAS_COM_AREA);
  assert.equal(r.length, 1);
  assert.equal(r[0].tipologiaId, 1);
  assert.equal(r[0].nome, 'Studio');
  assert.equal(r[0].quantidadeTotal, 20);
  assert.equal(r[0].quantidadePermutada, 5);
  assert.equal(r[0].areaPermutada, 125); // 5 × 25m²
});

test('permutaFisicaPorTipologia: várias tipologias, cada uma com sua linha', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 4 },
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 2, permuta_quantidade: 3 },
  ];
  const r = permutaFisicaPorTipologia(linhasCusto, TIPOLOGIAS_COM_AREA);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((l) => l.areaPermutada), [100, 180]); // 4×25, 3×60
});

test('permutaFisicaPorTipologia: estudo sem permuta física — array vazio', () => {
  assert.deepEqual(permutaFisicaPorTipologia([], TIPOLOGIAS_COM_AREA), []);
  const linhasCusto = [{ grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista', orcamento_valor: 1_000_000 }];
  assert.deepEqual(permutaFisicaPorTipologia(linhasCusto, TIPOLOGIAS_COM_AREA), []);
});

test('permutaFisicaPorTipologia: tipologia_id sem correspondente no catálogo — quantidadeTotal 0, área 0 (não precificável)', () => {
  const linhasCusto = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 999, permuta_quantidade: 3 },
  ];
  const r = permutaFisicaPorTipologia(linhasCusto, TIPOLOGIAS_COM_AREA);
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'tipologia 999');
  assert.equal(r[0].quantidadeTotal, 0);
  assert.equal(r[0].areaPermutada, 0);
});

// ── produto/estoque + funding (#240) ────────────────────────────────────

const CRONO_PRODUTO = [
  { evento: 'pre_lancamento', inicio_mes: 0, duracao_meses: 1 },
  { evento: 'lancamento', inicio_mes: 1, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 1, duracao_meses: 2 },
  { evento: 'pos_obra', inicio_mes: 3, duracao_meses: 12 },
];
const RECEITA_PRODUTO = [{
  nome: 'Fase 1',
  absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
  tipologias: [{ tipologia_id: 1, quantidade: 20 }],
}];

test('validarProduto: estoque totalmente alocado e absorvido fecha em zero', () => {
  assert.deepEqual(validarProduto(RECEITA_PRODUTO, [], TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4), []);
});

test('#335 validarCustosDuplicados: sem duplicata, sem divergência', () => {
  const custos = [
    { grupo: 'terreno', categoria: 'Preço' },
    { grupo: 'obra', categoria: 'Construção' },
    { grupo: 'diretos', categoria: 'Corretagem de vendas' },
  ];
  assert.deepEqual(validarCustosDuplicados(custos), []);
});

test('#335 validarCustosDuplicados: 2ª linha com a mesma categoria no mesmo grupo é ALERTA, não erro', () => {
  const custos = [
    { grupo: 'terreno', categoria: 'Preço' },
    { grupo: 'terreno', categoria: 'Preço' },
  ];
  const r = validarCustosDuplicados(custos);
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'CATEGORIA_CUSTO_DUPLICADA');
  assert.equal(r[0].severidade, 'alerta');
  assert.equal(r[0].linha, 'Preço');
  assert.equal(r[0].encontrado, 2);
  assert.equal(r[0].diferenca, 1);
});

test('#335 validarCustosDuplicados: mesma categoria em GRUPOS diferentes não é duplicata', () => {
  const custos = [
    { grupo: 'terreno', categoria: 'Outro' },
    { grupo: 'obra', categoria: 'Outro' },
  ];
  assert.deepEqual(validarCustosDuplicados(custos), []);
});

test('#335 validarCustosDuplicados: "Outro" nunca dispara — é a categoria de texto livre', () => {
  const custos = [
    { grupo: 'terreno', categoria: 'Outro' },
    { grupo: 'terreno', categoria: 'Outro' },
    { grupo: 'terreno', categoria: 'Outro' },
  ];
  assert.deepEqual(validarCustosDuplicados(custos), []);
});

test('#335 validarCustosDuplicados: 3 linhas na mesma categoria conta certo (encontrado=3, diferenca=2)', () => {
  const custos = [
    { grupo: 'obra', categoria: 'Construção' },
    { grupo: 'obra', categoria: 'Construção' },
    { grupo: 'obra', categoria: 'Construção' },
  ];
  const r = validarCustosDuplicados(custos);
  assert.equal(r.length, 1);
  assert.equal(r[0].encontrado, 3);
  assert.equal(r[0].diferenca, 2);
});

test('validarContratacao: bruto fecha por quantidade × área × preço × absorção', () => {
  const linhas = [{
    ...RECEITA_PRODUTO[0],
    tipologias: [{ tipologia_id: 1, quantidade: 20, area_privativa_m2: 50, preco_m2: 10_000 }],
  }];
  assert.deepEqual(validarContratacao(linhas, CRONO_PRODUTO, 20, 10_000_000), []);
  const div = validarContratacao(linhas, CRONO_PRODUTO, 20, 9_000_000)[0];
  assert.equal(div.codigo, 'VENDA_BRUTA_NAO_RECONCILIA');
  assert.equal(div.diferenca, -1_000_000);
});

test('validarSafrasReceita: identifica linha e safra com componentes que não fecham 100%', () => {
  const linhas = [{
    nome: 'Torre A',
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    tipologias: [{ quantidade: 1, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 90, descontoPct: 0 }] },
  }];
  const div = validarSafrasReceita(linhas, CRONO_PRODUTO, 20)[0];
  assert.equal(div.codigo, 'SOMA_COMPONENTES_DIVERGE');
  assert.equal(div.linha, 'Torre A');
  assert.equal(div.safra, 1);
});

test('validarProduto: alocação + permuta acima do catálogo identifica tipologia e mês negativo', () => {
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 2,
  }];
  const r = validarProduto(RECEITA_PRODUTO, custos, TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4);
  assert.equal(r.find((d) => d.codigo === 'PRODUTO_EXCEDE_ESTOQUE')?.linha, 'Studio');
  assert.equal(r.find((d) => d.codigo === 'ESTOQUE_MENSAL_NEGATIVO')?.mes, 1);
});

test('#340 validarProduto: sub-alocação vira PRODUTO_SUBALOCADO, alerta não erro', () => {
  const receitaParcial = [{ ...RECEITA_PRODUTO[0], tipologias: [{ tipologia_id: 1, quantidade: 15 }] }];
  const r = validarProduto(receitaParcial, [], TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4);
  const div = r.find((d) => d.codigo === 'PRODUTO_SUBALOCADO');
  assert.ok(div);
  assert.equal(div!.severidade, 'alerta');
  assert.equal(div!.linha, 'Studio');
  assert.equal(div!.diferenca, 5);
});

test('#340 validarProduto: sub-alocação descontando permuta física não dispara se cobre o resto', () => {
  const receitaParcial = [{ ...RECEITA_PRODUTO[0], tipologias: [{ tipologia_id: 1, quantidade: 15 }] }];
  const custosPermuta = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 5 },
  ];
  const r = validarProduto(receitaParcial, custosPermuta, TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4);
  assert.equal(r.find((d) => d.codigo === 'PRODUTO_SUBALOCADO'), undefined);
});

test('#340 unidadesNaoAlocadasPorTipologia: desconta alocação e permuta física corretamente', () => {
  const receitaParcial = [{ ...RECEITA_PRODUTO[0], tipologias: [{ tipologia_id: 1, quantidade: 12 }] }];
  const custosPermuta = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 3 },
  ];
  const r = unidadesNaoAlocadasPorTipologia(receitaParcial, custosPermuta, TIPOLOGIAS.slice(0, 1));
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'Studio');
  assert.equal(r[0].quantidadeTotal, 20);
  assert.equal(r[0].naoAlocado, 5); // 20 - 12 - 3
});

test('#340 unidadesNaoAlocadasPorTipologia: totalmente alocada não aparece', () => {
  const r = unidadesNaoAlocadasPorTipologia(RECEITA_PRODUTO, [], TIPOLOGIAS.slice(0, 1));
  assert.deepEqual(r, []);
});

test('#340 unidadesNaoAlocadasPorTipologia: sobre-alocada (excede estoque) também não aparece — diferença negativa', () => {
  const custosPermuta = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', permuta_tipologia_id: 1, permuta_quantidade: 5 },
  ];
  const r = unidadesNaoAlocadasPorTipologia(RECEITA_PRODUTO, custosPermuta, TIPOLOGIAS.slice(0, 1));
  assert.deepEqual(r, []);
});

function capitalBase(): ResultadoCapitalStack {
  return {
    lacunaFundingMensal: [0, 0], lacunaFundingMaxima: 0, caixaProjetoMensal: [0, 100],
    liberacaoPorInstrumento: {}, jurosPorInstrumento: {}, amortizacaoPorInstrumento: {},
    saldoDividaPorInstrumento: {}, aportePorInstrumentoPE: {}, devolucaoPrincipalPE: {},
    remuneracaoPagaPE: {}, remuneracaoAcumuladaFinalPE: {}, capitalNaoDevolvidoFinalPE: {},
    remuneracaoAcumuladaPorInstrumentoPE: {}, capitalNaoDevolvidoPorInstrumentoPE: {},
    participacaoReceitaPE: {}, participacaoResidualPE: {}, participacaoLucroPE: {},
    aporteSponsorMensal: [0, 0], distribuicaoSponsorMensal: [0, 0],
    aportePorInstrumentoSponsor: {}, distribuicaoPorInstrumentoSponsor: {},
  };
}

test('validarCapitalStack: caixa reconciliado e dívida zerada não divergem', () => {
  const r = capitalBase();
  r.saldoDividaPorInstrumento = { Banco: [0, 0] };
  assert.deepEqual(validarCapitalStack(r, [100]), []);
});

test('validarCapitalStack: acusa dívida terminal e primeira quebra da reconciliação', () => {
  const r = capitalBase();
  r.caixaProjetoMensal[1] = 90;
  r.saldoDividaPorInstrumento = { Banco: [0, 25] };
  const divs = validarCapitalStack(r, [100]);
  assert.equal(divs.find((d) => d.codigo === 'DIVIDA_FINAL_NAO_ZERA')?.linha, 'Banco');
  assert.equal(divs.find((d) => d.codigo === 'FLUXO_FUNDING_NAO_RECONCILIA')?.mes, 0);
});

test('validarCapitalStack: lacuna é alerta de premissa, não erro de implementação', () => {
  const r = capitalBase();
  r.lacunaFundingMensal = [0, 30]; r.lacunaFundingMaxima = 30;
  const div = validarCapitalStack(r, [100]).find((d) => d.codigo === 'LACUNA_FUNDING');
  assert.equal(div?.severidade, 'alerta');
});

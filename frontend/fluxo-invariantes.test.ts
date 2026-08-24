import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarFluxoCalc, validarComponentesSafra, validarPermutaFisica, permutaFisicaPorTipologia,
  validarProduto, validarContratacao, validarSafrasReceita, validarFunding, validarCustosDuplicados,
  unidadesNaoAlocadasPorTipologia, TOLERANCIA_PADRAO, validarReconciliacaoCamadas, permutaFisicaDerivadaCatalogo,
} from './fluxo-invariantes.js';
import { absorcaoMensal } from './fluxo-shared.js';
import {
  calcularFluxo, linhasReceitaComPermutaReservada, vendaBrutaContratadaMensal,
} from './fluxo-caixa-motor.js';
import type { FluxoCalc, ComponentePagamento } from './fluxo-caixa-motor.js';
import type { EventoCrono } from './fluxo-shared.js';
import type { FundingCalc, OperacaoFunding } from './funding-motor.js';

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

// ── #429: conservação da absorção ───────────────────────────────────────
// periodoAbsorcao(CRONO_PRODUTO) = { inicio: 0, fim: 14 } — pos_obra começa no
// mês 3 e a janela Pós-chaves tem 12 meses fixos (#226). Logo, o mês 15 é o
// primeiro fora da janela.
const receitaComCurva = (meses: { mes: number; pct: number }[]) => ([{
  nome: 'Fase 1',
  absorcao: { modo: 'personalizado', meses },
  tipologias: [{ tipologia_id: 1, quantidade: 20 }],
}]);

test('#429 validarProduto: curva com ponto fora da janela vira ABSORCAO_NAO_FECHA', () => {
  const receitas = receitaComCurva([{ mes: 0, pct: 60 }, { mes: 2, pct: 30 }, { mes: 15, pct: 10 }]);
  const r = validarProduto(receitas, [], TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4);
  const d = r.filter((x) => x.codigo === 'ABSORCAO_NAO_FECHA');
  assert.equal(d.length, 1, `divergências: ${r.map((x) => x.codigo).join(', ')}`);
  assert.equal(d[0].severidade, 'erro');
  assert.equal(d[0].linha, 'Fase 1');
  assert.equal(d[0].esperado, 100);
  assert.ok(Math.abs(d[0].encontrado - 90) < 1e-9);
  assert.ok(Math.abs(d[0].diferenca + 10) < 1e-9);
  assert.equal(d[0].mes, 15);
  // A mensagem diz QUANTO falta e O QUE zeraria (desenho do VGV SOMADO da EVI).
  assert.match(d[0].mensagem, /90\.00%/);
  assert.match(d[0].mensagem, /faltam 10\.00 pp/);
  assert.match(d[0].mensagem, /mês 16/);   // 0-based 15 → 1-based 16 na mensagem
  assert.match(d[0].mensagem, /até o mês 15/); // janela 0..14 → 1-based até 15
});

test('#429 a checagem NÃO é derivável de `abs.pcts`: curva que declara 110% e perde 10 pp', () => {
  // Σ abs.pcts = 100 exatamente — uma invariante que somasse a saída truncada
  // diria "fechou". Mas o usuário escreveu 110%, e 10 pp foram jogados fora.
  const receitas = receitaComCurva([
    { mes: 0, pct: 60 }, { mes: 2, pct: 40 }, { mes: 15, pct: 10 },
  ]);
  const abs = absorcaoMensal(receitas[0].absorcao, CRONO_PRODUTO)!;
  assert.ok(Math.abs(abs.pcts.reduce((s, x) => s + x, 0) - 100) < 1e-9, 'a saída truncada fecha 100');

  const d = validarProduto(receitas, [], TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4)
    .filter((x) => x.codigo === 'ABSORCAO_NAO_FECHA');
  assert.equal(d.length, 1);
  assert.equal(d[0].esperado, 110);   // o que a curva prometia
  assert.ok(Math.abs(d[0].encontrado - 100) < 1e-9);
  assert.ok(Math.abs(d[0].diferenca + 10) < 1e-9);
  assert.match(d[0].mensagem, /declara 110\.00%/);
  assert.match(d[0].mensagem, /NÃO são computados/);
});

test('#429 validarProduto: curva que fecha 100% DENTRO da janela não gera divergência', () => {
  const receitas = receitaComCurva([{ mes: 0, pct: 60 }, { mes: 2, pct: 40 }]);
  const r = validarProduto(receitas, [], TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4);
  assert.deepEqual(r, []);
});

test('#429 validarProduto: a mesma curva descartada não vira uma divergência por tipologia', () => {
  // Duas tipologias na MESMA linha: a curva é uma só, o alarme também.
  const receitas = [{
    nome: 'Fase 1',
    absorcao: { modo: 'personalizado', meses: [{ mes: 0, pct: 90 }, { mes: 15, pct: 10 }] },
    tipologias: [{ tipologia_id: 1, quantidade: 20 }, { tipologia_id: 2, quantidade: 10 }],
  }];
  const r = validarProduto(receitas, [], TIPOLOGIAS.slice(0, 2), CRONO_PRODUTO, 4);
  assert.equal(r.filter((x) => x.codigo === 'ABSORCAO_NAO_FECHA').length, 1);
});

test('#429 validarProduto: linha cuja tipologia não está no catálogo AINDA é checada', () => {
  // O laço de produto itera o CATÁLOGO; a checagem de absorção itera as
  // LINHAS — senão uma curva quebrada passaria batida por falta de catálogo.
  const receitas = receitaComCurva([{ mes: 0, pct: 90 }, { mes: 15, pct: 10 }]);
  const r = validarProduto(receitas, [], [], CRONO_PRODUTO, 4);
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'ABSORCAO_NAO_FECHA');
});

test('#429 validarProduto: a invariante NÃO pode ser satisfeita pela saída truncada', () => {
  // Regressão do achado estrutural da vistoria: `Σ abs.pcts` fecha em 90 e é
  // internamente consistente — validarContratacao passa. Só o dado bruto da
  // curva (pctTotal/pctDescartado) revela a perda.
  const receitas = receitaComCurva([{ mes: 0, pct: 60 }, { mes: 2, pct: 30 }, { mes: 15, pct: 10 }]);
  const vgvContratadoQueOMotorProduz = 0; // sem tipologias com preço, a conta fecha em zero
  assert.deepEqual(
    validarContratacao(receitas, CRONO_PRODUTO, 4, vgvContratadoQueOMotorProduz, undefined, []), [],
    'validarContratacao continua cega ao descarte — é por isso que a #429 existe',
  );
  assert.equal(
    validarProduto(receitas, [], TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4)
      .filter((x) => x.codigo === 'ABSORCAO_NAO_FECHA').length, 1,
  );
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

// ── #444: validarCustosDuplicados chaveia também por `subcategoria` ──────

test('#444 validarCustosDuplicados: as 4 subcategorias canônicas de terreno/Preço + a linha sem subcategoria não são duplicata', () => {
  const custos = [
    { grupo: 'terreno', categoria: 'Preço' }, // "—", sem subcategoria
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista' },
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira' },
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física' },
  ];
  assert.deepEqual(validarCustosDuplicados(custos), []);
});

test('#444 validarCustosDuplicados: mesma categoria e subcategoria continua sendo acusada', () => {
  const custos = [
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista' },
    { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista' },
  ];
  const r = validarCustosDuplicados(custos);
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'CATEGORIA_CUSTO_DUPLICADA');
  assert.equal(r[0].encontrado, 2);
  assert.equal(r[0].diferenca, 1);
});

test('#444 validarCustosDuplicados: duas linhas SEM subcategoria no grupo obra continuam duplicata (chave nova não abre buraco fora de terreno)', () => {
  const custos = [
    { grupo: 'obra', categoria: 'Construção' },
    { grupo: 'obra', categoria: 'Construção' },
  ];
  const r = validarCustosDuplicados(custos);
  assert.equal(r.length, 1);
  assert.equal(r[0].encontrado, 2);
  assert.equal(r[0].diferenca, 1);
});

// ── #444: validarContratacao reconcilia contra o VGV VENDÁVEL ────────────

test('validarContratacao: bruto fecha por quantidade × área × preço × absorção', () => {
  const linhas = [{
    ...RECEITA_PRODUTO[0],
    tipologias: [{ tipologia_id: 1, quantidade: 20, area_privativa_m2: 50, preco_m2: 10_000 }],
  }];
  assert.deepEqual(validarContratacao(linhas, CRONO_PRODUTO, 20, 10_000_000, undefined, []), []);
  const div = validarContratacao(linhas, CRONO_PRODUTO, 20, 9_000_000, undefined, [])[0];
  assert.equal(div.codigo, 'VENDA_BRUTA_NAO_RECONCILIA');
  assert.equal(div.diferenca, -1_000_000);
});

test('#444 validarContratacao: permuta física reservada em Custos reconcilia contra a mesma grandeza do motor (vendaBrutaContratadaMensal)', () => {
  const linhas = [{
    nome: 'Torre E',
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    tipologias: [{ tipologia_id: 1, id: 1, quantidade: 20, area_privativa_m2: 50, preco_m2: 10_000 }],
  }];
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 5,
  }];
  const linhasReservadas = linhasReceitaComPermutaReservada(linhas, custos);
  const esperadoMotor = linhasReservadas.reduce(
    (s, l) => s + vendaBrutaContratadaMensal(l, CRONO_PRODUTO, 20).reduce((ss, v) => ss + v, 0), 0);
  // Sanidade: a permuta (5 × 50 × 10.000 = 2.500.000) reduziu o VGV vendável
  // de 10.000.000 para 7.500.000.
  assert.equal(esperadoMotor, 7_500_000);
  assert.deepEqual(validarContratacao(linhas, CRONO_PRODUTO, 20, esperadoMotor, TOLERANCIA_PADRAO, custos), []);
  // Sem `linhasCusto`, o validador cai no VGV BRUTO (10.000.000) — regressão
  // que prova que a permuta entrou de fato na conta quando `linhasCusto` é
  // passado, e não por coincidência.
  const semReserva = validarContratacao(linhas, CRONO_PRODUTO, 20, esperadoMotor, undefined, []);
  assert.equal(semReserva[0]?.codigo, 'VENDA_BRUTA_NAO_RECONCILIA');
});

const CRONO_PARCIAL: EventoCrono[] = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 0, duracao_meses: 1 },
  { evento: 'pos_obra', inicio_mes: 1, duracao_meses: 12 },
];

test('#444 validarContratacao: absorção que NÃO fecha 100% no horizonte reprova a subtração do escalar global de permuta', () => {
  const linhas = [
    {
      nome: 'Sem permuta',
      absorcao: { modo: 'personalizado', meses: [{ mes: 0, pct: 100 }] },
      tipologias: [{ tipologia_id: 1, id: 1, quantidade: 20, area_privativa_m2: 50, preco_m2: 10_000 }],
    },
    {
      nome: 'Com permuta, absorção parcial no horizonte',
      absorcao: { modo: 'personalizado', meses: [{ mes: 0, pct: 50 }, { mes: 11, pct: 50 }] },
      tipologias: [{ tipologia_id: 2, id: 2, quantidade: 20, area_privativa_m2: 50, preco_m2: 10_000 }],
    },
  ];
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 2, permuta_quantidade: 10,
  }];
  const prazo = 6; // o mês 11 da 2ª linha cai FORA do horizonte
  // Correto (por LINHA): a 1ª linha contribui 10.000.000 (sem permuta, 100%
  // no horizonte); a 2ª contribui 2.500.000 (vendável 5.000.000 × 50% no
  // horizonte — o outro 50% caiu fora do prazo e não conta). Total: 12.500.000.
  assert.deepEqual(
    validarContratacao(linhas, CRONO_PARCIAL, prazo, 12_500_000, TOLERANCIA_PADRAO, custos), [],
  );
  // Errado: subtrair o escalar `vgvPermutaFisica` do ESTUDO (5.000.000, sem
  // peso de absorção) do bruto ponderado (10.000.000 + 5.000.000 =
  // 15.000.000) dá 10.000.000 — só coincide com o correto quando a absorção
  // fecha 100% no horizonte, que NÃO é o caso aqui. O validador tem de
  // ACUSAR esse número.
  const comEscalarErrado = validarContratacao(
    linhas, CRONO_PARCIAL, prazo, 10_000_000, TOLERANCIA_PADRAO, custos,
  );
  assert.equal(comEscalarErrado[0]?.codigo, 'VENDA_BRUTA_NAO_RECONCILIA');
});

// ── #444: validarSafrasReceita usa a mesma regra do motor para o
// `ate_marco` degenerado (N_s ≤ 0) ───────────────────────────────────────

test('validarSafrasReceita: identifica linha e safra com componentes que não fecham 100%', () => {
  const linhas = [{
    nome: 'Torre A',
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    tipologias: [{ quantidade: 1, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 90, descontoPct: 0 }] },
  }];
  const div = validarSafrasReceita(linhas, CRONO_PRODUTO, 20, undefined, [])[0];
  assert.equal(div.codigo, 'SOMA_COMPONENTES_DIVERGE');
  assert.equal(div.linha, 'Torre A');
  assert.equal(div.safra, 1);
  // #444 regressão: SOMA_COMPONENTES_DIVERGE continua sendo acusada depois da
  // troca de `componentesEfetivosSafra` por `componentesIntegradosSafra`.
});

test('#444 validarSafrasReceita: ate_marco degenerado (N_s ≤ 0, mesmo mecanismo do motor) não emite COMPONENTE_INVALIDO', () => {
  const linhas = [{
    nome: 'Torre B',
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    tipologias: [{ tipologia_id: 1, quantidade: 1, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: {
      componentes: [{
        tipo: 'ate_marco', participacaoPct: 100, sinalPct: 0, marcoMes: 1,
        defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'até marco',
      }],
    },
  }];
  // safra 1 (lançamento) == marcoMes 1 → N_s = 0 ≤ 0 — o motor converte para
  // `imediato`; o validador precisa fazer o mesmo, não lançar/capturar.
  const r = validarSafrasReceita(linhas, CRONO_PRODUTO, 20, undefined, []);
  assert.deepEqual(r.filter((d) => d.codigo === 'COMPONENTE_INVALIDO'), []);

  // `calcularFluxo` roda sem exceção sobre a MESMA fixture e produz número —
  // asserção contra o array, não contra "não lançou": a venda é contratada e
  // recebida integralmente no mês 1 (safra 1 → imediato): 1×50×10.000.
  const calc = calcularFluxo({
    dataInicio: null, taxaDescontoAa: 10, cronograma: CRONO_PRODUTO,
    linhasReceita: linhas, linhasCusto: [], areaTerreno: 0,
  });
  assert.equal(calc.fluxoMensal[1], 500_000);
});

test('#444 validarSafrasReceita: componente GENUINAMENTE inválido (concentrado pago antes da safra, não o caso degenerado) continua acusado', () => {
  const linhas = [{
    nome: 'Torre D',
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    tipologias: [{ tipologia_id: 1, quantidade: 1, area_privativa_m2: 50, preco_m2: 10_000 }],
    fluxo_pagamento: {
      componentes: [{
        tipo: 'concentrado', participacaoPct: 100, mesPagamento: 0, taxaMensal: 0, rotulo: 'repasse',
      }],
    },
  }];
  // contratação na safra 1 (lançamento, inicio_mes 1); mesPagamento 0 < safra
  // 1 — `pagamentosConcentrado` lança (#234), independente da conversão do
  // `ate_marco` degenerado que esta issue introduziu.
  const div = validarSafrasReceita(linhas, CRONO_PRODUTO, 20, undefined, []).find((d) => d.codigo === 'COMPONENTE_INVALIDO');
  assert.ok(div, 'componente genuinamente inválido deveria continuar sendo acusado');
});

test('validarProduto: alocação + permuta acima do catálogo identifica tipologia e mês negativo', () => {
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 2,
  }];
  const r = validarProduto(RECEITA_PRODUTO, custos, TIPOLOGIAS.slice(0, 1), CRONO_PRODUTO, 4);
  assert.equal(r.find((d) => d.codigo === 'PRODUTO_EXCEDE_ESTOQUE')?.linha, 'Studio');
  assert.equal(r.find((d) => d.codigo === 'ESTOQUE_MENSAL_NEGATIVO')?.mes, 1);
  // #457: sem `area_privativa_m2` no catálogo (caso de `TIPOLOGIAS`), a
  // dimensão m² não tem como ser calculada — nenhum código M2 aparece.
  assert.equal(r.find((d) => d.codigo?.includes('_M2_')), undefined);
});

// #457: a dimensão m² do livro de estoque (ver `validarProduto` acima) reusa
// o MESMO laço de vendas/estoque em unidades — não duplica a absorção, só
// escala por `area_privativa_m2`. Por isso os dois pares abaixo reproduzem
// EXATAMENTE os cenários de `ESTOQUE_MENSAL_NEGATIVO`/`ESTOQUE_FINAL_NAO_ZERA`
// acima, trocando `TIPOLOGIAS` (sem área) por `TIPOLOGIAS_COM_AREA`.

test('#457 validarProduto: ESTOQUE_MENSAL_NEGATIVO tem par em m² como alerta (mesma violação, escalada por área)', () => {
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 2,
  }];
  const r = validarProduto(RECEITA_PRODUTO, custos, TIPOLOGIAS_COM_AREA.slice(0, 1), CRONO_PRODUTO, 4);
  const erroUnidades = r.find((d) => d.codigo === 'ESTOQUE_MENSAL_NEGATIVO');
  const alertaM2 = r.find((d) => d.codigo === 'ESTOQUE_M2_MENSAL_NEGATIVO');
  assert.equal(erroUnidades?.severidade, 'erro');
  assert.equal(erroUnidades?.mes, 1);
  assert.ok(alertaM2, 'esperava o par em m² (#457)');
  assert.equal(alertaM2!.severidade, 'alerta'); // #457 item 6 — nasce alerta, não erro
  assert.equal(alertaM2!.mes, 1);
  assert.ok(Math.abs(alertaM2!.encontrado - erroUnidades!.encontrado * 25) < 1e-6); // Studio: 25 m²/unid.
});

test('#457 validarProduto: ESTOQUE_FINAL_NAO_ZERA tem par em m² como alerta (prazo mais curto que a janela de absorção)', () => {
  // Só o Lançamento (50%) cabe dentro de `prazo=4`; o Pós-chaves derivado
  // (50%, espalhado por `cfINC`-style 12 meses fixos a partir do mês 3)
  // conta para `somaPct` (absorção "completa") mas cai majoritariamente fora
  // da janela rastreada — resíduo real de estoque ao fim do horizonte.
  const receita = [{ ...RECEITA_PRODUTO[0], absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 50 }] } }];
  const r = validarProduto(receita, [], TIPOLOGIAS_COM_AREA.slice(0, 1), CRONO_PRODUTO, 4);
  const erroUnidades = r.find((d) => d.codigo === 'ESTOQUE_FINAL_NAO_ZERA');
  const alertaM2 = r.find((d) => d.codigo === 'ESTOQUE_M2_FINAL_NAO_ZERA');
  assert.ok(erroUnidades, 'esperava ESTOQUE_FINAL_NAO_ZERA em unidades');
  assert.equal(erroUnidades!.severidade, 'erro');
  assert.ok(alertaM2, 'esperava o par em m² (#457)');
  assert.equal(alertaM2!.severidade, 'alerta');
  assert.ok(Math.abs(alertaM2!.encontrado - erroUnidades!.encontrado * 25) < 1e-6);
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

const OP_BANCO: OperacaoFunding = { tipo: 'divida', nome: 'Banco', valor: 0, inicio_mes: 0 };

function fundingBase(saldoBanco: number[], entradas: number[], saidas: number[]): FundingCalc {
  const fluxoMensal = saldoBanco.map((_, t) => 0 + (entradas[t] ?? 0) - (saidas[t] ?? 0));
  return {
    operacoes: [{
      operacao: OP_BANCO, entradas, saidas,
      fluxoInvestidor: saidas.map((v, t) => v - entradas[t]),
      juros: saldoBanco.map(() => 0), saldo: saldoBanco,
      tarifas: saldoBanco.map(() => 0),
    }],
    noFluxo: {
      entradas, saidas, linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal, fluxoAcumulado: [], vplLiquido: 0,
    },
  };
}

test('validarFunding: dívida zerada e fluxo reconciliado não divergem', () => {
  const calc = fundingBase([0, 0], [0, 0], [0, 0]);
  assert.deepEqual(validarFunding(calc, [0, 0]), []);
});

test('validarFunding: acusa dívida terminal e quebra da reconciliação do fluxo alavancado', () => {
  const calc = fundingBase([0, 25], [0, 0], [0, 0]);
  calc.noFluxo.fluxoMensal = [0, 999]; // não bate com fluxoLivre + entradas − saídas
  const divs = validarFunding(calc, [0, 100]);
  assert.equal(divs.find((d) => d.codigo === 'DIVIDA_FINAL_NAO_ZERA')?.linha, 'Banco');
  assert.equal(divs.find((d) => d.codigo === 'FLUXO_FUNDING_NAO_RECONCILIA')?.mes, 1);
});

test('validarFunding: acusa saldo devedor negativo', () => {
  const calc = fundingBase([0, -10], [0, 0], [0, 0]);
  const divs = validarFunding(calc, [0, 0]);
  assert.equal(divs.find((d) => d.codigo === 'DIVIDA_NEGATIVA')?.mes, 1);
});

// #445: o nome do teste antigo ("equity sem saldo não é checado pela
// invariante de dívida") ficou FALSO — equity ganhou diagnóstico próprio.
// Reescrito para exercitar exatamente essa borda: (a) e (c) na mesma
// operação, e a prova de que nenhuma checagem de DÍVIDA dispara para ela.
test('#445 validarFunding: equity ganha diagnóstico próprio — (a) retorno negativo + (c) sem aporte, nenhuma checagem de dívida', () => {
  const equity: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'equity', nome: 'Investidor', valor: 0, inicio_mes: 0, pct_retorno: 5 },
      entradas: [0, 0], saidas: [-10, 50], fluxoInvestidor: [10, 50],
      juros: [0, 0], saldo: [0, 0], tarifas: [0, 0],
    }],
    noFluxo: {
      entradas: [0, 0], saidas: [-10, 50], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [10, -50], fluxoAcumulado: [10, -40], vplLiquido: 0,
    },
  };
  const divs = validarFunding(equity, [0, 0]);
  const negativo = divs.find((d) => d.codigo === 'RETORNO_EQUITY_NEGATIVO');
  assert.ok(negativo, 'deveria acusar retorno negativo (a)');
  assert.equal(negativo!.mes, 0);
  const semAporte = divs.find((d) => d.codigo === 'EQUITY_SEM_APORTE');
  assert.ok(semAporte, 'deveria acusar equity sem aporte (c)');
  assert.deepEqual(
    divs.filter((d) => d.codigo === 'DIVIDA_NEGATIVA' || d.codigo === 'DIVIDA_FINAL_NAO_ZERA'), [],
    'equity não tem saldo devedor — as checagens de dívida nunca deveriam alcançá-la',
  );
});

test('#445 validarFunding: equity SAUDÁVEL (aportou, retorno positivo) produz ZERO divergências — teste negativo', () => {
  const equity: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'equity', nome: 'Investidor', valor: 1000, inicio_mes: 0, pct_retorno: 5 },
      entradas: [1000, 0], saidas: [0, 50], fluxoInvestidor: [-1000, 50],
      juros: [0, 0], saldo: [0, 0], tarifas: [0, 0],
    }],
    noFluxo: {
      entradas: [1000, 0], saidas: [0, 50], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [1000, -50], fluxoAcumulado: [1000, 950], vplLiquido: 0,
    },
  };
  assert.deepEqual(validarFunding(equity, [0, 0]), []);
});

test('#445 validarFunding: (a) modo resultado_final com resultadoFinal negativo produz retorno negativo', () => {
  // funding-motor.ts:549 — `saidas[t] = round2(resultadoFinal * pct)`, sem
  // clamp; um `resultadoFinal` negativo vira retorno negativo diretamente.
  const equity: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'equity', nome: 'Investidor', valor: 1000, inicio_mes: 0, pct_retorno: 5, modo_retorno: 'resultado_final' },
      entradas: [1000, 0], saidas: [0, -500], fluxoInvestidor: [-1000, -500],
      juros: [0, 0], saldo: [0, 0], tarifas: [0, 0],
    }],
    noFluxo: {
      entradas: [1000, 0], saidas: [0, -500], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [1000, 500], fluxoAcumulado: [1000, 1500], vplLiquido: 0,
    },
  };
  const div = validarFunding(equity, [0, 0]).find((d) => d.codigo === 'RETORNO_EQUITY_NEGATIVO');
  assert.ok(div, 'resultado_final negativo deveria produzir retorno negativo');
  assert.equal(div!.mes, 1);
});

test('#445 validarFunding: (a) modo progressivo (permuta_financeira) também é coberto pela checagem — mesmo com o clamp do #432 no motor', () => {
  // O clamp+carry-forward de `simularEquity` (#432) impede saída negativa
  // HOJE no motor real — mas a checagem opera sobre `saidas` diretamente,
  // sem presumir qual mecanismo gerou o valor, e cobre uma regressão futura
  // que reintroduza saída negativa no modo progressivo.
  const equity: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'equity', nome: 'Investidor', valor: 1000, inicio_mes: 0, pct_retorno: 5, modo_retorno: 'permuta_financeira' },
      entradas: [1000, 0], saidas: [-20, 50], fluxoInvestidor: [980, 50],
      juros: [0, 0], saldo: [0, 0], tarifas: [0, 0],
    }],
    noFluxo: {
      entradas: [1000, 0], saidas: [-20, 50], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [1020, -50], fluxoAcumulado: [1020, 970], vplLiquido: 0,
    },
  };
  const div = validarFunding(equity, [0, 0]).find((d) => d.codigo === 'RETORNO_EQUITY_NEGATIVO');
  assert.ok(div, 'saída negativa em modo progressivo também deveria ser acusada');
});

test('#445 validarFunding: dívida com saldo TODO ZERO (nunca desembolsou) continua sem ser acusada — regressão do desvio por TIPO', () => {
  const divida: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'divida', nome: 'Linha sem saque', valor: 0, inicio_mes: 0 },
      entradas: [0, 0], saidas: [0, 0], fluxoInvestidor: [0, 0],
      juros: [0, 0], saldo: [0, 0], tarifas: [0, 0],
    }],
    noFluxo: {
      entradas: [0, 0], saidas: [0, 0], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [0, 0], fluxoAcumulado: [0, 0], vplLiquido: 0,
    },
  };
  assert.deepEqual(validarFunding(divida, [0, 0]), []);
});

const opEquitySoma = (nome: string, pctRetorno: number, saidaMes0: number, modoRetorno?: 'permuta_financeira' | 'resultado_final') => ({
  operacao: { tipo: 'equity' as const, nome, valor: 1, inicio_mes: 0, pct_retorno: pctRetorno, modo_retorno: modoRetorno },
  entradas: [0], saidas: [saidaMes0], fluxoInvestidor: [saidaMes0], juros: [0], saldo: [0], tarifas: [0],
});

test('#445 validarFunding (b): Σ retorno de equity (permuta_financeira) EXCEDE a receita líquida do mês — R$ 120.000 > R$ 100.000, um só alerta', () => {
  const calc: FundingCalc = {
    // "A" sem `modo_retorno` — prova que o default `permuta_financeira`
    // (funding-motor.ts:512) foi aplicado: se não fosse, só "B" (50.000)
    // entraria na soma e 50.000 ≤ 100.000 não dispararia nada.
    operacoes: [opEquitySoma('A', 70, 70_000), opEquitySoma('B', 50, 50_000, 'permuta_financeira')],
    noFluxo: {
      entradas: [0], saidas: [120_000], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [-120_000], fluxoAcumulado: [-120_000], vplLiquido: 0,
    },
  };
  const divs = validarFunding(calc, [0], TOLERANCIA_PADRAO, [100_000]);
  const alerta = divs.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA');
  assert.equal(alerta.length, 1, 'um alerta por mês, não um por operação');
  assert.equal(alerta[0].severidade, 'alerta');
  assert.equal(alerta[0].mes, 0);
  assert.equal(alerta[0].esperado, 100_000);
  assert.equal(alerta[0].encontrado, 120_000);
});

test('#445 validarFunding (b): Σ = R$ 100.000 (70 + 30), DENTRO da tolerância — nenhum alerta', () => {
  const calc: FundingCalc = {
    operacoes: [opEquitySoma('A', 70, 70_000), opEquitySoma('B', 30, 30_000)],
    noFluxo: {
      entradas: [0], saidas: [100_000], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [-100_000], fluxoAcumulado: [-100_000], vplLiquido: 0,
    },
  };
  const divs = validarFunding(calc, [0], TOLERANCIA_PADRAO, [100_000]);
  assert.deepEqual(divs.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA'), []);
});

test('#445 validarFunding (b): equity em modo resultado_final NÃO entra na soma mensal — é pagamento nominal, não fração da receita do mês', () => {
  const calc: FundingCalc = {
    operacoes: [opEquitySoma('A', 70, 200_000, 'resultado_final')],
    noFluxo: {
      entradas: [0], saidas: [200_000], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [-200_000], fluxoAcumulado: [-200_000], vplLiquido: 0,
    },
  };
  const divs = validarFunding(calc, [0], TOLERANCIA_PADRAO, [100_000]);
  assert.deepEqual(divs.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA'), []);
});

test('#445 validarFunding (b): sem `receitaLiquidaMensal`, a checagem simplesmente não roda (compatibilidade com os chamadores que não a passam)', () => {
  const calc: FundingCalc = {
    operacoes: [opEquitySoma('A', 70, 200_000)],
    noFluxo: {
      entradas: [0], saidas: [200_000], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [-200_000], fluxoAcumulado: [-200_000], vplLiquido: 0,
    },
  };
  const divs = validarFunding(calc, [0]);
  assert.deepEqual(divs.filter((d) => d.codigo === 'RETORNO_EQUITY_EXCEDE_RECEITA'), []);
});

test('#445 validarFunding (c): { valor: 0, pct_retorno: 5 } acusa EQUITY_SEM_APORTE; { valor: 1000, pct_retorno: 5 } não acusa nada', () => {
  const semAporte: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'equity', nome: 'X', valor: 0, inicio_mes: 0, pct_retorno: 5 },
      entradas: [0], saidas: [0], fluxoInvestidor: [0], juros: [0], saldo: [0], tarifas: [0],
    }],
    noFluxo: {
      entradas: [0], saidas: [0], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [0], fluxoAcumulado: [0], vplLiquido: 0,
    },
  };
  const divs = validarFunding(semAporte, [0]);
  assert.equal(divs.filter((d) => d.codigo === 'EQUITY_SEM_APORTE').length, 1);

  const comAporte: FundingCalc = {
    operacoes: [{
      operacao: { tipo: 'equity', nome: 'X', valor: 1000, inicio_mes: 0, pct_retorno: 5 },
      entradas: [1000], saidas: [0], fluxoInvestidor: [-1000], juros: [0], saldo: [0], tarifas: [0],
    }],
    noFluxo: {
      entradas: [1000], saidas: [0], linhasEntrada: [], linhasSaida: [], financiamentoProducao: [],
      fluxoMensal: [1000], fluxoAcumulado: [1000], vplLiquido: 0,
    },
  };
  assert.deepEqual(validarFunding(comAporte, [0]).filter((d) => d.codigo === 'EQUITY_SEM_APORTE'), []);
});

// ── D14 (#355): caixa acumulado negativo depois do funding ──────────────────
//
// `divida` e `equity` pagam sem checar o caixa do projeto — o PMT é capado só
// pelo saldo devedor e o retorno do equity é % da receita. O alerta torna o
// risco visível sem bloquear (severidade `alerta`, como a D5/#335).

test('#355 D14: acumulado sempre >= 0 não gera alerta', () => {
  const calc = fundingBase([0, 0], [0, 0], [0, 0]);
  calc.noFluxo.fluxoAcumulado = [10, 5, 0];
  assert.deepEqual(validarFunding(calc, [0, 0]), []);
});

test('#355 D14: acumulado que mergulha gera UM alerta, no primeiro mês negativo', () => {
  const calc = fundingBase([0, 0], [0, 0], [0, 0]);
  calc.noFluxo.fluxoAcumulado = [100, 50, -30, -80, -120];
  const divs = validarFunding(calc, [0, 0]).filter(
    (d) => d.codigo === 'CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING',
  );
  assert.equal(divs.length, 1, 'um só item, não um por mês negativo');
  assert.equal(divs[0].mes, 2);
  assert.equal(divs[0].encontrado, -30);
});

test('#355 D14: é alerta, não erro — não bloqueia o cálculo', () => {
  const calc = fundingBase([0, 0], [0, 0], [0, 0]);
  calc.noFluxo.fluxoAcumulado = [0, -500];
  const d = validarFunding(calc, [0, 0]).find(
    (x) => x.codigo === 'CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING',
  );
  assert.equal(d?.severidade, 'alerta');
});

test('#355 D14: mergulho dentro da tolerância não acusa (ruído de arredondamento)', () => {
  const calc = fundingBase([0, 0], [0, 0], [0, 0]);
  calc.noFluxo.fluxoAcumulado = [0, -0.005];
  assert.deepEqual(validarFunding(calc, [0, 0]), []);
});

// ─────────────────────────────────────────────────────────────────────────
// #446 — HORIZONTE_TRUNCA_FUNDING.
//
// Esta invariante existe para a metade NÃO-CÁLCULO do conserto: a fiação.
// Cada chamador de `calcularFluxo` que também simula funding tem de passar
// `operacoesFunding` no `FluxoConfig`. Quem esquecer não quebra teste nenhum —
// o motor devolve horizonte curto, o funding herda, e a operação é cortada em
// silêncio. Sem esta checagem o sintoma reaparece como DIVIDA_FINAL_NAO_ZERA,
// que aponta para o lugar errado: acusa a dívida de não quitar quando o que
// houve foi truncamento.
// ─────────────────────────────────────────────────────────────────────────

const opDividaLonga = {
  tipo: 'divida', nome: 'CG', valor: 1_000_000, taxa_anual: 12,
  inicio_mes: 0, distribuir_aporte: false, periodo_amortizacao_meses: 36,
  periodo_carencia_meses: 0,
} as OperacaoFunding;

/** FundingCalc mínimo: só o que as invariantes de funding leem. */
const fundingComDivida = (prazo: number): FundingCalc => {
  const zeros = Array.from({ length: prazo }, () => 0);
  return {
    operacoes: [{
      operacao: opDividaLonga,
      entradas: [...zeros], saidas: [...zeros], juros: [...zeros], saldo: [...zeros],
    } as any],
    noFluxo: {
      entradas: [...zeros], saidas: [...zeros], linhasEntrada: [], linhasSaida: [],
      financiamentoProducao: null, fluxoMensal: [...zeros], fluxoAcumulado: [...zeros],
      vplLiquido: 0,
    },
  } as any;
};

test('#446: horizonte curto denuncia o truncamento, com a operação nomeada', () => {
  const prazo = 24;                       // operacional, não alcança a quitação (mês 36)
  const divs = validarFunding(fundingComDivida(prazo), Array.from({ length: prazo }, () => 0));
  const d = divs.find((x) => x.codigo === 'HORIZONTE_TRUNCA_FUNDING');
  assert.ok(d, 'a invariante tinha de disparar num horizonte de 24 meses');
  assert.equal(d!.severidade, 'erro');
  assert.equal(d!.linha, 'CG');
  assert.equal(d!.esperado, 37);          // fim (36) + 1
  assert.equal(d!.encontrado, 24);
});

test('#446: horizonte que cobre a quitação não dispara a invariante', () => {
  const prazo = 37;
  const divs = validarFunding(fundingComDivida(prazo), Array.from({ length: prazo }, () => 0));
  assert.equal(divs.filter((x) => x.codigo === 'HORIZONTE_TRUNCA_FUNDING').length, 0);
});

// ── #441: reconciliação Catálogo × Premissas ──────────────────────────────

const TIPOLOGIAS_441 = [
  { id: 1, nome: 'Apto A', tipo_unidade: 'apartamento', quantidade: 20, area_privativa_m2: 50 },
  { id: 2, nome: 'Loja B', tipo_unidade: 'loja', quantidade: 10, area_privativa_m2: 30 },
];

const ESTUDO_AVANCADO_441 = { nivel_analise: 'avancado' };

test('#441 validarReconciliacaoCamadas: só roda em nivel_analise avancado', () => {
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 5,
  }];
  assert.deepEqual(
    validarReconciliacaoCamadas({ nivel_analise: 'preliminar' }, custos, TIPOLOGIAS_441), [],
  );
});

test('#441 validarReconciliacaoCamadas: Catálogo com permuta e Premissas com canônico null acusa divergência (esperado = área do catálogo, encontrado = 0)', () => {
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 5,
  }];
  const estudo = { ...ESTUDO_AVANCADO_441, permuta_fisica_area_canonica: null };
  const r = validarReconciliacaoCamadas(estudo, custos, TIPOLOGIAS_441);
  const div = r.find((d) => d.codigo === 'CAMADAS_DIVERGEM_PERMUTA_FISICA' && d.linha?.includes('residencial') && !d.linha?.includes('não'));
  assert.ok(div, 'deveria acusar divergência residencial');
  assert.equal(div!.esperado, 250); // 5 × 50 m²
  assert.equal(div!.encontrado, 0);
});

test('#441 validarReconciliacaoCamadas: reprova a leitura errada — unidades_permutadas legado, sem linha de custo de permuta, não acusa', () => {
  const tipologiasComLegado = [
    { ...TIPOLOGIAS_441[0], unidades_permutadas: 42 },
    TIPOLOGIAS_441[1],
  ];
  const estudo = { ...ESTUDO_AVANCADO_441, permuta_fisica_area_canonica: null, permuta_fisica_nr_area_canonica: null };
  // Nenhuma linha de custo `Preço/Permuta física` — a fonte legada
  // (`unidades_permutadas`) não deve produzir divergência nenhuma, porque
  // `permutaFisicaPorTipologia` (e portanto `permutaFisicaDerivadaCatalogo`)
  // não a lê.
  assert.deepEqual(validarReconciliacaoCamadas(estudo, [], tipologiasComLegado), []);
});

test('#441 validarReconciliacaoCamadas: regressão — camadas coerentes não acusam nada', () => {
  const custos = [{
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    permuta_tipologia_id: 1, permuta_quantidade: 5,
  }];
  const estudo = {
    ...ESTUDO_AVANCADO_441,
    permuta_fisica_area_canonica: 250, // 5 × 50 m², igual ao Catálogo
    permuta_fisica_nr_area_canonica: 0,
  };
  assert.deepEqual(validarReconciliacaoCamadas(estudo, custos, TIPOLOGIAS_441), []);
});

test('#441 permutaFisicaDerivadaCatalogo: divide entre as famílias R e NR pelo tipo_unidade', () => {
  const custos = [
    {
      grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
      permuta_tipologia_id: 1, permuta_quantidade: 4, // apartamento → residencial: 4 × 50 = 200 m²
    },
    {
      grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
      permuta_tipologia_id: 2, permuta_quantidade: 3, // loja → não residencial: 3 × 30 = 90 m²
    },
  ];
  const d = permutaFisicaDerivadaCatalogo(custos, TIPOLOGIAS_441);
  assert.equal(d.residencial.areaM2, 200);
  assert.equal(d.residencial.quantidade, 4);
  assert.equal(d.naoResidencial.areaM2, 90);
  assert.equal(d.naoResidencial.quantidade, 3);
});

test('#441 validarReconciliacaoCamadas: divisão R × NR — apartamento e loja caem em famílias diferentes das Premissas', () => {
  const custos = [
    {
      grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
      permuta_tipologia_id: 1, permuta_quantidade: 4,
    },
    {
      grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
      permuta_tipologia_id: 2, permuta_quantidade: 3,
    },
  ];
  // Premissas só têm o residencial certo — a NR está errada (0 em vez de 90).
  const estudo = {
    ...ESTUDO_AVANCADO_441,
    permuta_fisica_area_canonica: 200,
    permuta_fisica_nr_area_canonica: 0,
  };
  const r = validarReconciliacaoCamadas(estudo, custos, TIPOLOGIAS_441);
  assert.equal(r.length, 1, 'só a família NR deveria divergir');
  assert.match(r[0].linha!, /não residencial/);
  assert.equal(r[0].esperado, 90);
  assert.equal(r[0].encontrado, 0);
});

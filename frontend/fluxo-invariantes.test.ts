import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFluxoCalc, validarComponentesSafra, validarPermutaFisica, TOLERANCIA_PADRAO } from './fluxo-invariantes.js';
import type { FluxoCalc, ComponentePagamento } from './fluxo-caixa-motor.js';

// FluxoCalc mínimo para exercitar validarFluxoCalc — só os campos que a
// invariante lê precisam existir de fato.
const fluxoBase = (vendaLiquidaContratada: number, receitaBruta: number): FluxoCalc => ({
  prazo: 1, meses: ['jan/27'], receitaMensal: [], custoMensal: [], fluxoMensal: [], fluxoAcumulado: [],
  vgvTotal: 0, vpl: 0, tir: null, paybackMes: null, paybackData: null, exposicaoMaxima: 0,
  vgvPermutaFisica: 0, receitaBrutaVgv: 0, vgvVendavel: 0,
  vendaBrutaContratada: 0, descontoComercial: 0, vendaLiquidaContratada, receitaBruta,
  linhasReceita: [], linhasCusto: [],
} as unknown as FluxoCalc);

test('validarFluxoCalc: cenário válido (Receita Bruta = venda líquida contratada) não gera divergência', () => {
  assert.deepEqual(validarFluxoCalc(fluxoBase(1_000_000, 1_000_000)), []);
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

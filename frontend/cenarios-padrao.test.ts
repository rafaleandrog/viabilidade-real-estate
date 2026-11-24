// #889: os três cenários clássicos da aba Cenários do Avançado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  faixaDoBenchmark, cenariosPadrao, indicadoresCenario, FAIXA_PADRAO_PCT,
  proximaOrdem, gravarCenariosPadrao,
} from './cenarios-padrao.js';
import { calcularFluxo, aplicarCenario, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
// A configuração dos casos de render é usada só como um estudo qualquer com
// receita, custo e funding: os testes abaixo comparam duas contas do motor
// entre si, nunca contra um número fixo.
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, OPERACOES_FUNDING } from './render/casos/dados.js';

const CONFIG: FluxoConfig = {
  dataInicio: DATA_INICIO,
  taxaDescontoAa: 12,
  cronograma: CRONO,
  linhasReceita: RECEITAS,
  linhasCusto: CUSTOS,
  curvas: [],
  areaTerreno: 4_800,
  ret: { ativo: true, pct: 4 },
  jurosTabelaAaEstudo: 0,
  operacoesFunding: OPERACOES_FUNDING,
} as FluxoConfig;

test('faixaDoBenchmark: sem benchmark, ±15%', () => {
  assert.deepEqual(faixaDoBenchmark([], 'preco'), { min: -FAIXA_PADRAO_PCT, max: FAIXA_PADRAO_PCT });
  assert.deepEqual(faixaDoBenchmark(undefined as any, 'preco'), { min: -15, max: 15 });
});

test('faixaDoBenchmark: lê os dois lados do benchmark do campo pedido, em módulo e arredondados', () => {
  const bm = [
    { campo: 'preco', variacao_positiva_pct: 10.4, variacao_negativa_pct: -20.6 },
    { campo: 'custo_obras', variacao_positiva_pct: '8', variacao_negativa_pct: 5 },
  ];
  assert.deepEqual(faixaDoBenchmark(bm, 'preco'), { min: -21, max: 10 });
  assert.deepEqual(faixaDoBenchmark(bm, 'custo_obras'), { min: -5, max: 8 });
});

test('faixaDoBenchmark: lado ausente cai no padrão só daquele lado', () => {
  const bm = [{ campo: 'preco', variacao_positiva_pct: 12, variacao_negativa_pct: null }];
  assert.deepEqual(faixaDoBenchmark(bm, 'preco'), { min: -15, max: 12 });
});

test('cenariosPadrao: otimista sobe o preço e baixa a obra; pessimista o contrário; base zerada', () => {
  const [oti, base, pes] = cenariosPadrao({ min: -20, max: 10 }, { min: -5, max: 8 });
  assert.deepEqual(oti, { nome: 'Otimista', precoVendaPct: 10, custoObraPct: -5 });
  assert.deepEqual(base, { nome: 'Base', precoVendaPct: 0, custoObraPct: 0 });
  assert.deepEqual(pes, { nome: 'Pessimista', precoVendaPct: -20, custoObraPct: 8 });
  // O sinal de cada alavanca, dito explicitamente.
  assert.ok(oti.precoVendaPct > 0 && oti.custoObraPct < 0);
  assert.ok(pes.precoVendaPct < 0 && pes.custoObraPct > 0);
});

test('cenariosPadrao: faixa sem um dos lados não gera -0', () => {
  const [oti, , pes] = cenariosPadrao({ min: -0, max: 10 }, { min: -0, max: 0 });
  assert.ok(Object.is(pes.precoVendaPct, 0));
  assert.ok(Object.is(oti.custoObraPct, 0));
  assert.ok(Object.is(pes.custoObraPct, 0));
});

test('indicadoresCenario: margem nula sem VGV, exposição em módulo', () => {
  const c = {
    vgvTotal: 0, fluxoAcumulado: [-50, 30], tir: null, vpl: -3, exposicaoMaxima: -50,
  } as unknown as FluxoCalc;
  const i = indicadoresCenario(c);
  assert.equal(i.margemPct, null);
  assert.equal(i.resultado, 30);
  assert.equal(i.exposicao, 50);
  const d = indicadoresCenario({ ...c, vgvTotal: 300 } as FluxoCalc);
  assert.equal(d.margemPct, 10);
});

test('#889 critério 2: o cenário "Base" reproduz o estudo exatamente nos seis indicadores', () => {
  const real = indicadoresCenario(calcularFluxo(CONFIG));
  const [, base] = cenariosPadrao(faixaDoBenchmark([], 'preco'), faixaDoBenchmark([], 'custo_obras'));
  const comoCenario = indicadoresCenario(calcularFluxo(aplicarCenario(CONFIG, base)));
  assert.deepEqual(comoCenario, real);
  // Controle: o estudo tem número de verdade, e um cenário alterado sai diferente.
  assert.ok(real.vgv > 0 && real.resultado !== 0);
  const [oti] = cenariosPadrao(faixaDoBenchmark([], 'preco'), faixaDoBenchmark([], 'custo_obras'));
  const otimista = indicadoresCenario(calcularFluxo(aplicarCenario(CONFIG, oti)));
  assert.ok(otimista.vgv > real.vgv);
  assert.ok(otimista.resultado > real.resultado);
});

// Fiação (classe de defeito nº 1 do CLAUDE.md): a tela tem de usar as três
// funções. O caso de render `cenarios-gerar-padrao` cobre o que aparece na tela.
test('#889 fiação: a aba Cenários usa a régua, os padrões e os indicadores do módulo', () => {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const tela = readFileSync(join(raiz, 'frontend/tela-cenarios.ts'), 'utf8');
  assert.match(tela, /faixaDoBenchmark\(bm\?\.dados \|\| \[\], 'preco'\)/);
  assert.match(tela, /faixaDoBenchmark\(bm\?\.dados \|\| \[\], 'custo_obras'\)/);
  assert.match(tela, /cenariosPadrao\(this\.faixaPreco, this\.faixaCusto\)/);
  assert.match(tela, /indicadoresCenario\(calc\)/);
  assert.match(tela, /gravarCenariosPadrao\(rascunho, proximaOrdem\(this\.cenarios\),/);
  assert.match(tela, /this\.rascunhoPadrao = r\.pendentes;/);
  // A trava do botão é liberada em toda saída (finally), inclusive se reler a lista lançar.
  assert.match(tela, /finally \{\s*this\.gerando = false;\s*\}/);
  // A régua antiga, local ao componente, não pode voltar como segunda fonte.
  assert.doesNotMatch(tela, /private _faixa\(/);
});

test('proximaOrdem: maior ordem salva mais um, sem empatar depois de uma remoção', () => {
  assert.equal(proximaOrdem([]), 0);
  // Três cenários, o do meio (ordem 1) removido: length daria 2 e empataria com o último.
  assert.equal(proximaOrdem([{ ordem: 0 }, { ordem: 2 }]), 3);
  assert.equal(proximaOrdem([{ ordem: '4' }, { ordem: null }, { ordem: 'x' }]), 5);
});

const TRES = cenariosPadrao({ min: -10, max: 10 }, { min: -5, max: 5 });

test('gravarCenariosPadrao: grava os três em sequência, com ordem a partir da inicial', async () => {
  const corpos: any[] = [];
  const r = await gravarCenariosPadrao(TRES, 7, async (d) => { corpos.push(d); return { id: corpos.length }; });
  assert.deepEqual(r, { gravados: 3, pendentes: [], erro: null });
  assert.deepEqual(corpos.map((c) => [c.nome, c.ordem]), [['Otimista', 7], ['Base', 8], ['Pessimista', 9]]);
  assert.deepEqual(corpos[2], { nome: 'Pessimista', preco_venda_pct: -10, custo_obra_pct: 5, ordem: 9 });
});

test('gravarCenariosPadrao: erro devolvido pela API para a sequência e deixa só os que faltam', async () => {
  let n = 0;
  const r = await gravarCenariosPadrao(TRES, 0, async () => (++n === 2 ? { erro: true, mensagem: 'falhou' } : {}));
  assert.equal(n, 2);
  assert.equal(r.gravados, 1);
  assert.equal(r.erro, 'falhou');
  assert.deepEqual(r.pendentes.map((c) => c.nome), ['Base', 'Pessimista']);
});

test('gravarCenariosPadrao: exceção lançada também para e preserva os pendentes', async () => {
  let n = 0;
  const r = await gravarCenariosPadrao(TRES, 0, async () => { if (++n === 3) throw new Error('rede'); return {}; });
  assert.equal(r.gravados, 2);
  assert.equal(r.erro, 'rede');
  assert.deepEqual(r.pendentes.map((c) => c.nome), ['Pessimista']);
});

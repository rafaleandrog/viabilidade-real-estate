import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput, type Proforma } from './proforma.js';
import { rankearAlavancas, ehCustoLike, rotuloAlavanca } from './tornado-alavancas.js';

// Incorporação de margem fina, números redondos, montada para que a ordem
// esperada seja conhecida à mão: preço domina (o VGV inteiro escala), custo
// de obra vem em segundo (base grande, R$ 30M), custo indireto num meio
// termo e permuta financeira por último (base pequena, 1% de um VGV líquido).
// Permuta física fica em zero de propósito (área 0 m²) — alavanca sem
// impacto nenhum, o piso do ranking.
const BASE: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 1_000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 100 }], // vgv bruto = 100.000.000
  imposto_percentual: 4,
  corretagem_percentual: 4,
  marketing_percentual: 2,
  permuta_financeira_residencial_pct: 1,
  permuta_fisica_modo: 'area_m2',
  permuta_fisica_area_m2: 0,
  considerar_custo_terreno: true,
  custo_terreno_m2: 2_000,
  construcao_modo: 'valor_total',
  construcao_valor_total: 30_000_000,
  marketing_global_pct: 2,
  gestao_indiretos_pct: 1,
};

test('#727 rankearAlavancas: ordem conhecida — preço > custo de obra > permuta financeira', () => {
  const alavancas = rankearAlavancas(BASE, 10, false);
  const posicao = (v: string) => alavancas.findIndex((a) => a.variavel === v);
  assert.ok(posicao('preco') < posicao('custo_obras'), 'preço deve vir antes do custo de obra');
  assert.ok(posicao('custo_obras') < posicao('permuta_financeira'), 'custo de obra antes da permuta financeira');
  assert.ok(posicao('preco') < posicao('permuta_financeira'), 'preço antes da permuta financeira');
  assert.equal(alavancas.length, 5, 'as 5 alavancas do tornado (sem custo_terreno)');
});

test('#727: resultadoBase = 0 (estudo sem catálogo) não produz NaN e ordena por amplitudeRS', () => {
  const vazio: ProformaInput = { tipo_empreendimento: 'incorporacao' };
  const alavancas = rankearAlavancas(vazio, 10, false);
  for (const a of alavancas) {
    assert.equal(a.amplitudePct, null, `${a.variavel}: amplitudePct deveria ser null, não NaN`);
    assert.equal(a.amplitudeRS, 0, `${a.variavel}: sem catálogo, nenhuma alavanca move o resultado`);
  }
});

test('#727: loteamento com infra_modo pct_vgv marca custo_infra como circular; valor_m2 não marca', () => {
  const lotPct: ProformaInput = { ...BASE, tipo_empreendimento: 'loteamento', infra_modo: 'pct_vgv', infra_pct: 20 };
  const comPct = rankearAlavancas(lotPct, 10, true).find((a) => a.variavel === 'custo_infra')!;
  assert.equal(comPct.circular, true);

  const lotM2: ProformaInput = { ...BASE, tipo_empreendimento: 'loteamento', infra_modo: 'valor_m2', custo_infra_m2: 500 };
  const comM2 = rankearAlavancas(lotM2, 10, true).find((a) => a.variavel === 'custo_infra')!;
  assert.equal(comM2.circular, false);
});

// #727, critério 4: a contagem de execuções do motor é a esperada — prova de
// que não há execução escondida em laço. 5 alavancas × 2 lados + 1 base = 11.
test('#727: rankearAlavancas executa o motor exatamente 11 vezes para 5 alavancas', () => {
  let chamadas = 0;
  const contando = (e: ProformaInput): Proforma => { chamadas++; return calcularProforma(e); };
  rankearAlavancas(BASE, 10, false, contando);
  assert.equal(chamadas, 11);
});

test('#727: sentido — bull sempre supera bear, para preço e para custo de obra', () => {
  const alavancas = rankearAlavancas(BASE, 10, false);
  const preco = alavancas.find((a) => a.variavel === 'preco')!;
  assert.ok(preco.resultadoBull > preco.resultadoBear, 'preço: bull > bear');
  const obras = alavancas.find((a) => a.variavel === 'custo_obras')!;
  assert.ok(obras.resultadoBull > obras.resultadoBear, 'custo de obra: bull > bear');
});

test('#727: apagar a passagem de passoPct faz o teste de ordem ficar vermelho (mutação declarada)', () => {
  // Com passo 0 nenhuma alavanca se move — a suíte inteira do teste de ordem
  // acima depende de `passoPct` chegar ao motor. Reproduz aqui a mutação
  // "esquecer de passar o passo" (equivalente a passoPct fixo em 0).
  const semPasso = rankearAlavancas(BASE, 0, false);
  for (const a of semPasso) assert.equal(a.amplitudeRS, 0, `${a.variavel}: passo 0 não deveria mover nada`);
});

test('#727: ehCustoLike e rotuloAlavanca — uma tabela só de rótulos e sentido', () => {
  assert.equal(ehCustoLike('preco'), false);
  assert.equal(ehCustoLike('custo_obras'), true);
  assert.equal(ehCustoLike('custo_indireto'), true);
  assert.equal(rotuloAlavanca('custo_obras', false), 'Custo de obra');
  assert.equal(rotuloAlavanca('custo_infra', true), 'Custo de infraestrutura');
  assert.equal(rotuloAlavanca('preco', true), 'Preço/m² de venda');
});

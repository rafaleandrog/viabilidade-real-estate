import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, vgvBrutoDeProforma, permutaFisicaPorProdutosDoEstudo, type ProformaInput } from './proforma.js';
import {
  unidadesPermutadasDoProduto, permutaFisicaDeProdutos, permutaFisicaPorCategoria,
} from './permuta-produtos.js';

// Permuta física declarada POR PRODUTO do catálogo: quando alguma linha de uma
// categoria entrega unidades em permuta, a permuta daquela categoria vem do
// catálogo (m² = Σ unidades × área; VGV = Σ unidades × área × preço do produto)
// e os campos por área dela são ignorados. Sem nenhuma, o caminho por área é o
// de sempre — o par de testes `sem unidades_permutadas` mede que nada mudou.

const centavo = (a: number, b: number) => Math.abs(a - b) <= 0.01;

const INC_BASE: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  area_pvt_r_fechada: 8000,
  area_pvt_nr_fechada: 600,
  imposto_percentual: 4,
  corretagem_percentual: 3,
  marketing_percentual: 1,
  custo_construcao_m2: 5000,
  projetos_pct: 2,
};

// Residencial: Tipo A (50 m² × R$ 10.000/m² × 100 un) e Tipo B (80 m² × 12.000 × 50 un).
// Não residencial: Loja (30 m² × 20.000 × 20 un).
const A = { nome: 'A', tipo: 'residencial', area_media_m2: 50, preco_venda_m2: 10_000, unidades: 100 };
const B = { nome: 'B', tipo: 'residencial', area_media_m2: 80, preco_venda_m2: 12_000, unidades: 50 };
const LOJA = { nome: 'Loja', tipo: 'nao_residencial', area_media_m2: 30, preco_venda_m2: 20_000, unidades: 20 };

test('permuta por produto: m² e VGV saem das unidades permutadas × área × preço DO PRODUTO', () => {
  const p = calcularProforma({
    ...INC_BASE,
    produtos: [{ ...A, unidades_permutadas: 10 }, { ...B, unidades_permutadas: 5 }, LOJA],
  });
  // 10 × 50 = 500 m² a 10.000 + 5 × 80 = 400 m² a 12.000
  assert.equal(p.areaPermutaResidencial, 900);
  assert.ok(centavo(p.vgvPermutaResidencial, 5_000_000 + 4_800_000), `vgvPermutaResidencial=${p.vgvPermutaResidencial}`);
  // Categoria sem produto permutado: sem campos por área, nada é entregue.
  assert.equal(p.areaPermutaNaoResidencial, 0);
  assert.equal(p.vgvPermutaNaoResidencial, 0);
  // VGV bruto da residencial: 100×50×10.000 + 50×80×12.000 = 98.000.000.
  assert.ok(centavo(p.vgvResidencial, 98_000_000 - 9_800_000));
  assert.ok(centavo(p.valorPermutaFisica, 9_800_000), `valorPermutaFisica=${p.valorPermutaFisica}`);
  assert.equal(p.permutaCapada, false);
});

test('permuta por produto: os campos por área DA CATEGORIA são ignorados (modo, %, m² e canônico)', () => {
  const produtos = [{ ...A, unidades_permutadas: 10 }, B, LOJA];
  const semCampos = calcularProforma({ ...INC_BASE, produtos });
  const comCampos = calcularProforma({
    ...INC_BASE, produtos,
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 50, permuta_fisica_area_m2: 12_345,
    permuta_fisica_area_canonica: 7_777,
  });
  assert.deepEqual(comCampos, semCampos);
});

test('permuta por produto numa categoria NÃO muda a outra: ela segue por área, com o preço médio da categoria', () => {
  const produtos = [{ ...A, unidades_permutadas: 10 }, B, LOJA];
  const p = calcularProforma({ ...INC_BASE, produtos, permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 60 });
  assert.equal(p.areaPermutaNaoResidencial, 60);
  assert.ok(centavo(p.vgvPermutaNaoResidencial, 60 * 20_000));
  assert.equal(p.areaPermutaResidencial, 500);
  assert.ok(centavo(p.vgvPermutaResidencial, 5_000_000));
  // valor da permuta = a soma do VGV efetivo das duas categorias.
  assert.ok(centavo(p.valorPermutaFisica, 5_000_000 + 60 * 20_000), `valor=${p.valorPermutaFisica}`);
});

test('sem unidades_permutadas em nenhum produto o resultado é IDÊNTICO ao do catálogo sem o campo', () => {
  const entrada: ProformaInput = {
    ...INC_BASE, produtos: [A, B, LOJA],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 30,
  };
  const comZero = { ...entrada, produtos: [A, B, LOJA].map((x) => ({ ...x, unidades_permutadas: 0 })) };
  assert.deepEqual(calcularProforma(comZero), calcularProforma(entrada));
  // E o caminho por área continua valendo: 10% de 9.000 m² de catálogo residencial.
  const p = calcularProforma(entrada);
  assert.equal(p.areaPermutaResidencial, 900);
});

test('o teto é o do produto: unidades_permutadas acima das unidades entrega só as unidades', () => {
  const p = calcularProforma({ ...INC_BASE, produtos: [{ ...LOJA, unidades_permutadas: 999 }, A] });
  assert.equal(p.areaPermutaNaoResidencial, 20 * 30);
  assert.ok(centavo(p.vgvPermutaNaoResidencial, 20 * 30 * 20_000));
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.permutaCapada, false);
});

test('lixo em unidades_permutadas (texto, negativo, NaN) vale 0 — fail-closed, nunca permuta fantasma', () => {
  for (const lixo of ['abc', -3, NaN, '', null, undefined]) {
    assert.equal(unidadesPermutadasDoProduto({ unidades: 10, unidades_permutadas: lixo as any }), 0, String(lixo));
  }
  assert.equal(unidadesPermutadasDoProduto({ unidades: 10, unidades_permutadas: '4' }), 4);
});

test('identidades por categoria: VGV líquido + permuta = VGV bruto da categoria, com o fator de preço e o de permuta', () => {
  const produtos = [{ ...A, unidades_permutadas: 10 }, { ...B, unidades_permutadas: 5 }, { ...LOJA, unidades_permutadas: 2 }];
  for (const sens of [undefined, { variavel: 'preco' as const, fator: 0.8 }, { variavel: 'permuta_fisica' as const, fator: 1.5 }]) {
    const p = calcularProforma({ ...INC_BASE, produtos, sensibilidade: sens });
    const fPreco = sens?.variavel === 'preco' ? sens.fator : 1;
    const brutoR = (100 * 50 * 10_000 + 50 * 80 * 12_000) * fPreco;
    const brutoNR = 20 * 30 * 20_000 * fPreco;
    assert.ok(centavo(p.vgvResidencial + p.vgvPermutaResidencial, brutoR), `R ${JSON.stringify(sens)}`);
    assert.ok(centavo(p.vgvNaoResidencial + p.vgvPermutaNaoResidencial, brutoNR), `NR ${JSON.stringify(sens)}`);
    assert.ok(centavo(vgvBrutoDeProforma(p), brutoR + brutoNR));
  }
});

test('fator de preço entra UMA vez (no preço do produto) e o de permuta incide uma vez sobre m² e VGV', () => {
  const produtos = [{ ...A, unidades_permutadas: 10 }, B];
  const base = calcularProforma({ ...INC_BASE, produtos });
  const preco = calcularProforma({ ...INC_BASE, produtos, sensibilidade: { variavel: 'preco', fator: 0.8 } });
  assert.ok(centavo(preco.vgvPermutaResidencial, base.vgvPermutaResidencial * 0.8));
  assert.equal(preco.areaPermutaResidencial, base.areaPermutaResidencial);
  const perm = calcularProforma({ ...INC_BASE, produtos, sensibilidade: { variavel: 'permuta_fisica', fator: 1.5 } });
  assert.ok(centavo(perm.vgvPermutaResidencial, base.vgvPermutaResidencial * 1.5));
  assert.ok(Math.abs(perm.areaPermutaResidencial - base.areaPermutaResidencial * 1.5) < 1e-9);
});

test('permuta de TODAS as unidades zera o VGV da categoria sem cortar', () => {
  const p = calcularProforma({ ...INC_BASE, produtos: [{ ...LOJA, unidades_permutadas: 20 }, A] });
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.permutaCapada, false);
});

test('Loteamento: um bucket só — todos os produtos permutam no residencial, e o campo por área é ignorado', () => {
  const lot: ProformaInput = {
    tipo_empreendimento: 'loteamento', terreno_manual_area: 100_000,
    area_viario_publico_modo: 'pct_poligonal', area_viario_publico_valor: 25,
    produtos: [
      { area_media_m2: 300, preco_venda_m2: 1000, unidades: 200, unidades_permutadas: 20 },
      { area_media_m2: 500, preco_venda_m2: 1400, unidades: 30, tipo: 'nao_residencial', unidades_permutadas: 3 },
    ],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 9_999,
  };
  const p = calcularProforma(lot);
  assert.equal(p.areaPermutaResidencial, 20 * 300 + 3 * 500);
  assert.ok(centavo(p.vgvPermutaResidencial, 20 * 300 * 1000 + 3 * 500 * 1400));
  assert.equal(p.areaPermutaNaoResidencial, 0);
  assert.equal(p.vgvPermutaNaoResidencial, 0);
});

test('preço médio por unidade desconta as unidades permutadas (entregues, não vendidas) só no modo por produto', () => {
  const porProduto = calcularProforma({ ...INC_BASE, produtos: [{ ...A, unidades_permutadas: 10 }, B] });
  assert.equal(porProduto.numUnidades, 150);
  assert.ok(centavo(porProduto.precoMedioUnidadeResidencial, porProduto.vgvResidencial / 140));
  assert.ok(centavo(porProduto.precoMedioUnidade, porProduto.vgv / 140));
  // Por área, o denominador segue sendo o catálogo todo.
  const porArea = calcularProforma({ ...INC_BASE, produtos: [A, B], permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 500 });
  assert.ok(centavo(porArea.precoMedioUnidadeResidencial, porArea.vgvResidencial / 150));
});

test('permutaFisicaDeProdutos / PorCategoria: somas e separação por tipo', () => {
  const r = permutaFisicaDeProdutos([{ ...A, unidades_permutadas: 2 }, { ...B, unidades_permutadas: 1 }]);
  assert.deepEqual(r, { ativa: true, unidades: 3, areaM2: 180, vgv: 2 * 50 * 10_000 + 80 * 12_000 });
  assert.equal(permutaFisicaDeProdutos([A, B]).ativa, false);
  const cat = permutaFisicaPorCategoria([{ ...A, unidades_permutadas: 1 }, LOJA], false);
  assert.equal(cat.residencial.ativa, true);
  assert.equal(cat.nao_residencial.ativa, false);
});

test('permutaFisicaPorProdutosDoEstudo (lida pela tela de Permutas) usa o catálogo EFETIVO do motor', () => {
  // Produto em branco (sem área/preço) não compõe catálogo: não ativa a categoria.
  const e: ProformaInput = { ...INC_BASE, produtos: [A, { tipo: 'nao_residencial', unidades: 5, unidades_permutadas: 2 }] };
  assert.equal(permutaFisicaPorProdutosDoEstudo(e).nao_residencial.ativa, false);
  const e2: ProformaInput = { ...INC_BASE, produtos: [{ ...A, unidades_permutadas: 1 }, LOJA] };
  const r = permutaFisicaPorProdutosDoEstudo(e2);
  assert.equal(r.residencial.ativa, true);
  assert.equal(r.nao_residencial.ativa, false);
});

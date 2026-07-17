import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, precoSugeridoM2, type ProformaInput } from './proforma.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Loteamento de referência (valores conferidos à mão)
const LOT: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100000,
  sistema_viario_pct: 25,
  area_media_lote_m2: 300,
  preco_venda_m2: 1000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  considerar_custo_terreno: true,
  custo_terreno_m2: 100,
  infra_modo: 'pct_vgv',
  infra_pct: 30,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 0,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

test('loteamento: áreas e VGV', () => {
  const p = calcularProforma(LOT);
  assert.ok(perto(p.areaVendavel, 75000), `areaVendavel=${p.areaVendavel}`);
  assert.ok(perto(p.areaVendavelLiquida, 75000));
  assert.ok(perto(p.vgv, 75_000_000), `vgv=${p.vgv}`);
  assert.ok(perto(p.eficienciaPct, 75), `eficiencia=${p.eficienciaPct}`);
});

test('loteamento: deduções e receita líquida', () => {
  const p = calcularProforma(LOT);
  assert.ok(perto(p.imposto, 5_250_000), `imposto=${p.imposto}`);
  assert.ok(perto(p.corretagem, 3_750_000));
  assert.ok(perto(p.marketing, 750_000));
  assert.ok(perto(p.receitaLiquida, 65_250_000), `receitaLiquida=${p.receitaLiquida}`);
});

test('loteamento: custos, resultado e margem', () => {
  const p = calcularProforma(LOT);
  assert.ok(perto(p.custoTerreno, 10_000_000));
  assert.ok(perto(p.infraestrutura, 22_500_000));
  assert.ok(perto(p.projetos, 1_500_000));
  assert.ok(perto(p.custoDiretoTotal, 34_750_000), `custoDireto=${p.custoDiretoTotal}`);
  assert.ok(perto(p.custoIndiretoTotal, 1_687_500), `custoIndireto=${p.custoIndiretoTotal}`);
  assert.ok(perto(p.resultado, 28_812_500), `resultado=${p.resultado}`);
  assert.ok(perto(p.margemLiquidaPct, 38.4167, 0.01), `margem=${p.margemLiquidaPct}`);
  assert.equal(p.numUnidades, 250);
  assert.ok(perto(p.precoMedioUnidade, 300_000));
});

test('custo do terreno desconsiderado zera a linha', () => {
  const p = calcularProforma({ ...LOT, considerar_custo_terreno: false });
  assert.equal(p.custoTerreno, 0);
});

test('RET fixa imposto em 4%', () => {
  const p = calcularProforma({ ...LOT, sujeito_ret: true });
  assert.ok(perto(p.imposto, 3_000_000), `imposto RET=${p.imposto}`); // 4% de 75M
});

test('origem Núcleo: área vem de area_terreno_nucleo (ignora terreno_manual_area)', () => {
  const p = calcularProforma({
    ...LOT, terreno_manual_area: 5, origem_terreno: 'nucleo', area_terreno_nucleo: 100000,
  });
  assert.ok(perto(p.areaVendavel, 75000), `areaVendavel=${p.areaVendavel}`);
  assert.ok(perto(p.vgv, 75_000_000), `vgv=${p.vgv}`);
});

test('incorporação: VGV usa áreas fechadas res + não-res', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    area_pvt_nr_fechada: 200, preco_venda_m2_nao_residencial: 8000,
    area_comum_total: 500,
  });
  assert.ok(perto(p.vgvResidencial, 10_000_000));
  assert.ok(perto(p.vgvNaoResidencial, 1_600_000));
  assert.ok(perto(p.vgv, 11_600_000), `vgv=${p.vgv}`);
  assert.ok(perto(p.areaPrivativa, 1200));
  assert.ok(perto(p.areaConstruida, 1700));
});

test('incorporação: construção por R$/m² vs valor total (#4)', () => {
  const base: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    custo_construcao_m2: 5000, // × 1000 m² = 5.000.000
  };
  const porM2 = calcularProforma({ ...base, construcao_modo: 'valor_m2' });
  assert.ok(perto(porM2.construcao, 5_000_000), `construcao m²=${porM2.construcao}`);

  const total = calcularProforma({ ...base, construcao_modo: 'valor_total', construcao_valor_total: 7_500_000 });
  assert.ok(perto(total.construcao, 7_500_000), `construcao total=${total.construcao}`);
});

test('loteamento: infra 3 modos — % VGV, R$/m² e R$ fixo (#5)', () => {
  const pct = calcularProforma({ ...LOT, infra_modo: 'pct_vgv', infra_pct: 30 });
  assert.ok(perto(pct.infraestrutura, 22_500_000), `infra %=${pct.infraestrutura}`); // 30% de 75M

  // R$/m² incide sobre a área privativa dos lotes (= área vendável = 75.000 m²).
  const m2 = calcularProforma({ ...LOT, infra_modo: 'valor_m2', custo_infra_m2: 100 });
  assert.ok(perto(m2.infraestrutura, 7_500_000), `infra R$/m²=${m2.infraestrutura}`);

  const fixo = calcularProforma({ ...LOT, infra_modo: 'valor_fixo', infra_valor_fixo: 5_000_000 });
  assert.ok(perto(fixo.infraestrutura, 5_000_000), `infra R$ fixo=${fixo.infraestrutura}`);
});

test('permuta financeira: modo valor fixo deduz R$ absoluto (#5)', () => {
  const sem = calcularProforma(LOT);
  const com = calcularProforma({
    ...LOT,
    permuta_financeira_residencial_modo: 'valor_fixo',
    permuta_financeira_residencial_valor: 3_000_000,
    permuta_financeira_residencial_pct: 10, // deve ser ignorado no modo valor_fixo
  });
  assert.ok(perto(com.permutaFinResidencial, 3_000_000), `permutaFin=${com.permutaFinResidencial}`);
  assert.ok(perto(sem.resultado - com.resultado, 3_000_000), `dif=${sem.resultado - com.resultado}`);
});

test('incorporação: construção R$/m² incide sobre a área privativa TOTAL (#5)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, area_pvt_nr_fechada: 200,
    area_pvt_r_aberta: 100, area_pvt_nr_aberta: 50,
    preco_venda_m2_residencial: 10000,
    construcao_modo: 'valor_m2', custo_construcao_m2: 5000,
  });
  assert.ok(perto(p.areaPrivativa, 1350), `areaPriv=${p.areaPrivativa}`);
  assert.ok(perto(p.construcao, 6_750_000), `construcao=${p.construcao}`); // 5000 × 1350
});

test('projetos por % VGV vs valor fixo (#3)', () => {
  const pct = calcularProforma({ ...LOT, projetos_modo: 'pct_vgv', projetos_pct: 2 });
  assert.ok(perto(pct.projetos, 1_500_000), `projetos %=${pct.projetos}`); // 2% de 75M
  const fixo = calcularProforma({ ...LOT, projetos_modo: 'valor_fixo', projetos_valor_fixo: 900_000 });
  assert.ok(perto(fixo.projetos, 900_000), `projetos fixo=${fixo.projetos}`);
});

test('incorporação: permuta física reduz VGV proporcionalmente e o resultado (#14)', () => {
  const base: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
  };
  const sem = calcularProforma(base);
  const com = calcularProforma({ ...base, permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10 });
  assert.ok(perto(sem.vgv, 10_000_000));
  assert.ok(perto(com.vgv, 9_000_000), `vgv com permuta=${com.vgv}`); // −10% da área vendável
  assert.ok(com.resultado < sem.resultado, 'permuta física reduz o resultado');
});

test('incorporação: permuta física R e NR separadas reduzem cada VGV (#10)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,    // VGV R bruto = 10M
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000, // VGV NR bruto = 4M
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,     // R: 10% de 1000 = 100 m²
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 50,  // NR: 50 m²
  });
  assert.ok(perto(p.areaPermutaResidencial, 100), `areaR=${p.areaPermutaResidencial}`);
  assert.ok(perto(p.areaPermutaNaoResidencial, 50), `areaNR=${p.areaPermutaNaoResidencial}`);
  assert.ok(perto(p.areaPermutaFisica, 150));
  assert.ok(perto(p.vgvPermutaResidencial, 1_000_000), `vgvPermR=${p.vgvPermutaResidencial}`);     // 100 × 10000
  assert.ok(perto(p.vgvPermutaNaoResidencial, 400_000), `vgvPermNR=${p.vgvPermutaNaoResidencial}`); // 50 × 8000
  // VGV líquido = (1000−100)×10000 + (500−50)×8000 = 9M + 3,6M = 12,6M
  assert.ok(perto(p.vgvResidencial, 9_000_000));
  assert.ok(perto(p.vgvNaoResidencial, 3_600_000));
  assert.ok(perto(p.vgv, 12_600_000), `vgv=${p.vgv}`);
});

test('loteamento: permuta física usa o campo legado, NR não se aplica (#10)', () => {
  const p = calcularProforma({ ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 15000 });
  assert.ok(perto(p.areaPermutaResidencial, 15000));
  assert.equal(p.areaPermutaNaoResidencial, 0);
  assert.ok(perto(p.areaVendavelLiquida, 60000), `liq=${p.areaVendavelLiquida}`);
  assert.ok(perto(p.vgv, 60_000_000), `vgv=${p.vgv}`); // 60.000 m² × R$ 1.000
});

test('permuta financeira reduz o resultado final (#14)', () => {
  const sem = calcularProforma(LOT);
  const com = calcularProforma({ ...LOT, permuta_financeira_residencial_pct: 10 });
  // 10% do VGV residencial (75M) = 7,5M deduzidos da receita.
  assert.ok(perto(sem.resultado - com.resultado, 7_500_000), `dif=${sem.resultado - com.resultado}`);
});

test('incorporação: nº de unidades soma R + NR (#2)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    num_unidades_residencial: 8, num_unidades_nao_residencial: 2,
  });
  assert.equal(p.numUnidades, 10);
  assert.ok(perto(p.precoMedioUnidade, 1_000_000), `preçoMedio=${p.precoMedioUnidade}`);
});

test('incorporação: nº e preço médio por unidade detalhados R e NR (#7)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,   // VGV res = 10.000.000
    area_pvt_nr_fechada: 200, preco_venda_m2_nao_residencial: 8000, // VGV nr  = 1.600.000
    num_unidades_residencial: 10, num_unidades_nao_residencial: 4,
  });
  // VGV soma R + NR
  assert.ok(perto(p.vgvResidencial, 10_000_000));
  assert.ok(perto(p.vgvNaoResidencial, 1_600_000));
  assert.ok(perto(p.vgv, 11_600_000), `vgv=${p.vgv}`);
  // Detalhe por tipo
  assert.equal(p.numUnidadesResidencial, 10);
  assert.equal(p.numUnidadesNaoResidencial, 4);
  assert.ok(perto(p.precoMedioUnidadeResidencial, 1_000_000), `pmR=${p.precoMedioUnidadeResidencial}`);
  assert.ok(perto(p.precoMedioUnidadeNaoResidencial, 400_000), `pmNR=${p.precoMedioUnidadeNaoResidencial}`);
});

test('loteamento não separa R/NR (métricas por tipo zeradas) (#7)', () => {
  const p = calcularProforma(LOT);
  assert.equal(p.numUnidadesResidencial, 0);
  assert.equal(p.numUnidadesNaoResidencial, 0);
  assert.equal(p.precoMedioUnidadeResidencial, 0);
  assert.equal(p.precoMedioUnidadeNaoResidencial, 0);
});

test('preço sugerido: atinge o piso do benchmark', () => {
  const piso = 40; // acima da margem atual (~38,4%)
  const preco = precoSugeridoM2(LOT, piso);
  assert.ok(preco !== null && preco > 1000, `preço=${preco}`);
  const margem = calcularProforma({ ...LOT, preco_venda_m2: preco! }).margemLiquidaPct;
  assert.ok(perto(margem, piso, 0.05), `margem no preço sugerido=${margem}`);
});

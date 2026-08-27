import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularProforma, precoSugeridoM2, vgvProduto, totalProdutos, catalogoEfetivo, produtoCompoeCatalogo,
  resumoCatalogoProdutos, tipoProdutoEfetivo,
  type ProformaInput,
} from './proforma.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Loteamento de referência (valores conferidos à mão).
//
// O catálogo de Produtos é a única fonte do VGV, então ele entra no fixture
// reproduzindo EXATAMENTE o que o par legado (area_media_lote_m2 ×
// preco_venda_m2 × lotes derivados da área vendável) produzia antes: 300 m² ×
// R$ 1.000 × 250 lotes = R$ 75.000.000, com 250 unidades. Todos os números
// conferidos à mão abaixo continuam valendo sem alteração.
//
// `area_media_lote_m2` e `preco_venda_m2` ficam no fixture porque a permuta
// física ainda lê o preço legado do tipo (interim do #315) — não porque
// alimentem receita.
const LOT: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100000,
  area_viario_publico_modo: 'pct_poligonal',
  area_viario_publico_valor: 25,
  area_media_lote_m2: 300,
  preco_venda_m2: 1000,
  produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }],
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

// Migração 020: faixas_nao_edificaveis_pct e areas_privativas_nao_vendaveis_pct
// (sem linha própria na tabela nova) são somados dentro de area_app_valor e
// area_viario_privado_valor — a soma total de deduções, e portanto a área
// vendável, tem que ficar IDÊNTICA à fórmula antiga (soma plana dos 7 campos).
test('loteamento: soma "dobrada" dos campos órfãos reproduz a fórmula antiga (migração 020)', () => {
  // Fórmula antiga: 100.000 × (1 − (9.5+2+25+6+4+1+3)/100) = 100.000 × 0.495 = 49.500.
  const comCamposAntigos: ProformaInput = {
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100000,
    area_app_modo: 'pct_poligonal', area_app_valor: 9.5 + 2, // app_pct + faixas_nao_edificaveis_pct
    area_elup_epu_modo: 'pct_poligonal', area_elup_epu_valor: 6 + 1, // elup_pct + epu_pct
    area_epc_modo: 'pct_poligonal', area_epc_valor: 4,
    area_viario_publico_modo: 'pct_poligonal', area_viario_publico_valor: 25,
    area_viario_privado_modo: 'pct_poligonal', area_viario_privado_valor: 3, // areas_privativas_nao_vendaveis_pct
  };
  const p = calcularProforma(comCamposAntigos);
  assert.ok(perto(p.areaVendavel, 49500), `areaVendavel=${p.areaVendavel}`);
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

// #453: campo renomeado — o nome antigo mentia, dando a entender que havia
// custo no numerador. Trava a fórmula sob o nome novo E compara com o valor
// que o campo antigo produzia para o MESMO fixture (LOT) nas duas outras
// suítes desta rodada: 65.250.000 / 75.000.000 × 100 = 87% — idêntico ao que
// a issue #453 mediu antes do rename. Renome puro: nenhum número muda.
test('#453: receitaLiquidaSobreVgvPct = receitaLiquida / vgv × 100 (renome, não fórmula nova)', () => {
  const p = calcularProforma(LOT);
  assert.ok(perto(p.receitaLiquidaSobreVgvPct, 87, 0.01), `receitaLiquidaSobreVgvPct=${p.receitaLiquidaSobreVgvPct}`);
  assert.ok(
    perto(p.receitaLiquidaSobreVgvPct, (p.receitaLiquida / p.vgv) * 100, 1e-9),
    'tem que ser exatamente receitaLiquida/vgv*100, não outra fórmula',
  );
  // Não é a mesma grandeza de margemLiquidaPct — o renome não colapsou dois
  // conceitos num só.
  assert.notEqual(p.receitaLiquidaSobreVgvPct, p.margemLiquidaPct);
});

test('#453: vgv === 0 → receitaLiquidaSobreVgvPct = 0 (caso de borda que a fórmula já tratava)', () => {
  const p = calcularProforma({ tipo_empreendimento: 'loteamento' } as ProformaInput);
  assert.equal(p.vgv, 0);
  assert.equal(p.receitaLiquidaSobreVgvPct, 0);
});

test('custo do terreno desconsiderado zera a linha', () => {
  const p = calcularProforma({ ...LOT, considerar_custo_terreno: false });
  assert.equal(p.custoTerreno, 0);
});

// item 5 — checkbox por custo: Marketing global/estrutura, Gestão indiretos,
// Contingências, mesmo padrão de considerar_custo_terreno.
test('contingências desconsideradas zera a linha (custo direto)', () => {
  const p = calcularProforma({ ...LOT, considerar_contingencias: false, contingencias_pct: 5 });
  assert.equal(p.contingencias, 0);
  const comContingencia = calcularProforma({ ...LOT, contingencias_pct: 5 });
  assert.ok(comContingencia.contingencias > 0);
});

test('marketing global desconsiderado zera só a parte percentual (custo indireto) — stand de vendas continua', () => {
  const p = calcularProforma({ ...LOT, considerar_marketing_global: false, stand_vendas_valor: 50_000 });
  assert.ok(perto(p.marketingGlobal, 50_000), `marketingGlobal=${p.marketingGlobal}`);
});

test('gestão indiretos desconsiderada zera a linha (custo indireto)', () => {
  const p = calcularProforma({ ...LOT, considerar_gestao_indiretos: false });
  assert.equal(p.gestaoIndiretos, 0);
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

// Migrado: o VGV vinha das áreas fechadas × os preços legados, que é
// exatamente o fallback que deixou de existir. O catálogo abaixo reproduz os
// mesmos R$ 11.600.000 (10M residenciais + 1,6M não residenciais), e as
// asserções de ÁREA — que sempre saíram dos campos de área, não do fallback —
// ficam idênticas. A separação R/NR do VGV não sobreviveu porque o catálogo é
// bucket único; o teste do estado vazio, logo abaixo, cobre o que era o outro
// lado deste.
test('incorporação: o VGV vem do catálogo; as áreas continuam vindo dos campos de área', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, area_pvt_nr_fechada: 200,
    area_comum_total: 500,
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }, // 10.000.000
      { area_media_m2: 25, preco_venda_m2: 8000, unidades: 8 },    //  1.600.000
    ],
  });
  assert.equal(p.semProdutos, false);
  assert.ok(perto(p.vgvResidencial, 11_600_000), `vgvR=${p.vgvResidencial}`);
  assert.ok(perto(p.vgvNaoResidencial, 0));
  assert.ok(perto(p.vgv, 11_600_000), `vgv=${p.vgv}`);
  assert.ok(perto(p.areaPrivativa, 1200));
  assert.ok(perto(p.areaConstruida, 1700));
});

// #569 — indicador de aproveitamento do coeficiente máximo. `usada` é
// `areaPrivativa` (soma das 4 parcelas PVT, a MESMA que a cascata da
// Incorporação chama `privativa_total` — ver `areas-cascata.ts`).
test('#569: aproveitamento do coeficiente — teto = área do terreno × coef. máximo, % = usada / teto', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual', terreno_manual_area: 4_000,
    coef_aproveitamento_maximo: 2,
    area_pvt_r_fechada: 6_000, area_pvt_nr_fechada: 1_000, // usada = 7.000
  });
  // teto = 4.000 × 2 = 8.000; pct = 7.000 / 8.000 × 100 = 87,5%.
  assert.equal(p.tetoAproveitamentoM2, 8_000);
  assert.ok(perto(p.areaPrivativa, 7_000));
  assert.ok(perto(p.pctAproveitamentoCoef!, 87.5));
  assert.equal(p.aproveitamentoExcedido, false);
});

test('#569: usada > teto → aproveitamentoExcedido true (o aviso é responsabilidade da tela)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual', terreno_manual_area: 4_000,
    coef_aproveitamento_maximo: 1, // teto = 4.000
    area_pvt_r_fechada: 5_000, // usada = 5.000 > 4.000
  });
  assert.equal(p.tetoAproveitamentoM2, 4_000);
  assert.ok(perto(p.pctAproveitamentoCoef!, 125));
  assert.equal(p.aproveitamentoExcedido, true);
});

test('#569: usada exatamente igual ao teto não é excedente (fronteira, não ">=")', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual', terreno_manual_area: 4_000,
    coef_aproveitamento_maximo: 1,
    area_pvt_r_fechada: 4_000, // usada == teto
  });
  assert.ok(perto(p.pctAproveitamentoCoef!, 100));
  assert.equal(p.aproveitamentoExcedido, false);
});

test('#569: coeficiente 0/vazio/negativo → indicador não se aplica (null, sem divisão por zero, sem falso alarme)', () => {
  const semCoef = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual', terreno_manual_area: 4_000,
    area_pvt_r_fechada: 50_000, // usada gigante — não pode virar "excedeu" sem teto
  });
  assert.equal(semCoef.tetoAproveitamentoM2, null);
  assert.equal(semCoef.pctAproveitamentoCoef, null);
  assert.equal(semCoef.aproveitamentoExcedido, false);

  const coefZero = calcularProforma({
    tipo_empreendimento: 'incorporacao', terreno_manual_area: 4_000, coef_aproveitamento_maximo: 0,
  });
  assert.equal(coefZero.tetoAproveitamentoM2, null);

  const coefNegativo = calcularProforma({
    tipo_empreendimento: 'incorporacao', terreno_manual_area: 4_000, coef_aproveitamento_maximo: -1,
  });
  assert.equal(coefNegativo.tetoAproveitamentoM2, null);
});

test('#569: loteamento nunca preenche o coeficiente — indicador sempre null, por construção', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 90_000, area_media_lote_m2: 300, preco_venda_m2: 1_000,
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1_000, unidades: 250 }],
  });
  assert.equal(p.tetoAproveitamentoM2, null);
  assert.equal(p.pctAproveitamentoCoef, null);
  assert.equal(p.aproveitamentoExcedido, false);
});

test('#569: área do terreno zerada com coeficiente preenchido — teto 0, sem NaN/Infinity', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual', terreno_manual_area: 0,
    coef_aproveitamento_maximo: 2, area_pvt_r_fechada: 100,
  });
  assert.equal(p.tetoAproveitamentoM2, 0);
  assert.equal(p.pctAproveitamentoCoef, null); // teto <= 0: "% de zero" não se exibe como número
  assert.equal(p.aproveitamentoExcedido, false); // sem teto positivo, não há "excedente" a acusar
});

// O MESMO estudo sem catálogo: os preços legados por m² não têm campo em tela
// nenhuma e deixaram de gerar receita. As áreas continuam, porque elas têm
// campo próprio em Premissas → Terreno & Áreas.
test('incorporação sem catálogo: os preços legados por m² não geram VGV nem despesa em % de VGV', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    area_pvt_nr_fechada: 200, preco_venda_m2_nao_residencial: 8000,
    area_comum_total: 500,
    imposto_percentual: 7, corretagem_percentual: 5, marketing_percentual: 1,
    manutencao_pct: 1, contingencias_pct: 2,
  });
  assert.equal(p.semProdutos, true);
  assert.equal(p.vgv, 0);
  assert.equal(p.imposto, 0);
  assert.equal(p.corretagem, 0);
  assert.equal(p.marketing, 0);
  assert.equal(p.manutencao, 0);
  assert.equal(p.contingencias, 0);
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

test('#259: Proforma prefere o valor canônico após trocar a unidade exibida', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10_000,
    construcao_modo: 'valor_m2', custo_construcao_m2: 4800,
    // A unidade ativa ainda pode carregar um legado diferente; o canônico é a fonte.
    construcao_valor_canonico: 5_000_000,
  });
  assert.equal(p.construcao, 5_000_000);
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

// Migrado: o VGV bruto de R$ 10.000.000 passou a vir do catálogo (100 m² ×
// R$ 10.000 × 10 unidades). O preço legado fica porque é dele que a permuta
// física tira o preço do m² entregue — a conta da permuta é a mesma de antes.
test('incorporação: permuta física reduz VGV proporcionalmente e o resultado (#14)', () => {
  const base: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }],
  };
  const sem = calcularProforma(base);
  const com = calcularProforma({ ...base, permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10 });
  assert.ok(perto(sem.vgv, 10_000_000));
  assert.ok(perto(com.vgv, 9_000_000), `vgv com permuta=${com.vgv}`); // −10% da área vendável
  assert.ok(com.resultado < sem.resultado, 'permuta física reduz o resultado');
});

// Migrado: o VGV bruto (10M residenciais + 4M não residenciais = 14M) veio
// para o catálogo. A separação R/NR que este teste prova é a da PERMUTA — área
// e VGV entregues de cada tipo —, e ela continua inteira: são os dois pares de
// campos legados de permuta, cada um com o preço do seu tipo. O que o catálogo
// não separa é o VGV, que passa a sair inteiro em `vgvResidencial`; o TOTAL
// líquido (12,6M) é o mesmo de antes.
test('incorporação: permuta física R e NR separadas reduzem cada VGV (#10)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,    // preço da permuta R
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000, // preço da permuta NR
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }, // VGV bruto R = 10M
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 5 },   // VGV bruto NR =  4M
    ],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,     // R: 10% de 1000 = 100 m²
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 50,  // NR: 50 m²
  });
  assert.ok(perto(p.areaPermutaResidencial, 100), `areaR=${p.areaPermutaResidencial}`);
  assert.ok(perto(p.areaPermutaNaoResidencial, 50), `areaNR=${p.areaPermutaNaoResidencial}`);
  assert.ok(perto(p.areaPermutaFisica, 150));
  assert.equal(p.permutaCapada, false, '1,4M de permuta cabe nos 14M de base — nada a capar');
  assert.ok(perto(p.vgvPermutaResidencial, 1_000_000), `vgvPermR=${p.vgvPermutaResidencial}`);     // 100 × 10000
  assert.ok(perto(p.vgvPermutaNaoResidencial, 400_000), `vgvPermNR=${p.vgvPermutaNaoResidencial}`); // 50 × 8000
  // VGV líquido = 14M − 1M − 0,4M = 12,6M, o mesmo total de antes do catálogo.
  assert.ok(perto(p.vgvResidencial, 12_600_000));
  assert.ok(perto(p.vgvNaoResidencial, 0));
  assert.ok(perto(p.vgv, 12_600_000), `vgv=${p.vgv}`);
});

// BUG7-07: "VGV sem permuta física" repetia a Receita bruta porque o override
// zerava só os campos LEGADOS, e o motor prioriza o canônico. Este teste
// prova a identidade que a tela agora usa (vgv + vgvPermutaResidencial +
// vgvPermutaNaoResidencial reconstrói o VGV bruto) com o canônico preenchido
// diretamente — nenhum teste existente cobria esse campo.
test('BUG7-07: identidade "vgv + permutas" reconstrói o VGV bruto com o canônico preenchido', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,     // preço da permuta R
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000,  // preço da permuta NR
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 },   // VGV bruto R = 10M
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 5 },     // VGV bruto NR = 4M
    ],
    // Canônico preenchido diretamente (como _editarCustoUnidade grava a cada
    // digitação) — SEM os campos legados equivalentes, para provar que o
    // motor lê o canônico e não o legado.
    permuta_fisica_area_canonica: 100,     // R: 100 m² de permuta
    permuta_fisica_nr_area_canonica: 50,   // NR: 50 m²
  });
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.ok(perto(vgvBruto, 14_000_000), `vgvBruto=${vgvBruto}`); // 10M + 4M
  assert.ok(p.vgv < vgvBruto, 'VGV líquido de permuta tem que ser menor que o bruto');
  assert.ok(perto(p.vgv, 12_600_000), `vgv líquido=${p.vgv}`); // 9M + 3,6M, mesma conta do teste R/NR acima
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

// Migrado: o nº de unidades vinha de num_unidades_residencial +
// num_unidades_nao_residencial, um par sem campo em tela nenhuma, e agora vem
// do catálogo. O que este teste prova — que a contagem SOMA as fontes e que o
// preço médio é VGV ÷ unidades — continua igual, com os mesmos 10 unidades e
// R$ 1.000.000 por unidade.
test('incorporação: nº de unidades soma as linhas do catálogo (#2)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000,
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 8 }, // 8.000.000
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 2 }, // 2.000.000
    ],
  });
  assert.equal(p.numUnidades, 10);
  assert.ok(perto(p.precoMedioUnidade, 1_000_000), `preçoMedio=${p.precoMedioUnidade}`);
});

// Substituído pelo teste do estado vazio: este provava exatamente o fallback
// legado — nº e preço médio por tipo saindo de num_unidades_* × preco_venda_m2_*,
// quatro campos sem UI. O detalhe por tipo COM catálogo (bucket único em
// Residencial) já é coberto por "catálogo com múltiplos produtos", abaixo.
test('sem catálogo: o detalhe por tipo não sai de num_unidades_* nem dos preços legados', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    area_pvt_nr_fechada: 200, preco_venda_m2_nao_residencial: 8000,
    num_unidades_residencial: 10, num_unidades_nao_residencial: 4,
  });
  assert.equal(p.semProdutos, true);
  assert.equal(p.vgv, 0);
  assert.equal(p.vgvResidencial, 0);
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.numUnidades, 0);
  assert.equal(p.numUnidadesResidencial, 0);
  assert.equal(p.numUnidadesNaoResidencial, 0);
  assert.equal(p.precoMedioUnidade, 0);
  assert.equal(p.precoMedioUnidadeResidencial, 0);
  assert.equal(p.precoMedioUnidadeNaoResidencial, 0);
});

test('loteamento não separa R/NR (métricas por tipo zeradas) (#7)', () => {
  const p = calcularProforma(LOT);
  assert.equal(p.numUnidadesResidencial, 0);
  assert.equal(p.numUnidadesNaoResidencial, 0);
  assert.equal(p.precoMedioUnidadeResidencial, 0);
  assert.equal(p.precoMedioUnidadeNaoResidencial, 0);
});

// #315 — catálogo de Produtos
test('vgvProduto: multiplica área média × preço × unidades', () => {
  assert.ok(perto(vgvProduto({ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }), 75_000_000));
  assert.equal(vgvProduto({ area_media_m2: null, preco_venda_m2: 1000, unidades: 10 }), 0);
});

test('totalProdutos: soma VGV e unidades de várias linhas', () => {
  const t = totalProdutos([
    { area_media_m2: 300, preco_venda_m2: 1000, unidades: 200 },
    { area_media_m2: 500, preco_venda_m2: 1200, unidades: 50 },
  ]);
  assert.ok(perto(t.vgv, 60_000_000 + 30_000_000));
  assert.equal(t.unidades, 250);
});

test('#315: catálogo de Produtos é a fonte do VGV — os campos fixos legados não influenciam (loteamento)', () => {
  const p = calcularProforma({
    ...LOT,
    // Campos legados propositalmente diferentes — o VGV não pode senti-los.
    // (`preco_venda_m2` continua sendo o preço da permuta física, e aqui não há
    // permuta, então nada além do catálogo entra na conta.)
    area_media_lote_m2: 999, preco_venda_m2: 1,
  });
  assert.ok(perto(p.vgv, 75_000_000), `vgv=${p.vgv}`);
  assert.equal(p.numUnidades, 250);
  assert.ok(perto(p.precoMedioUnidade, 300_000));
});

// Migrado: onde este teste comparava "sem produtos" com "produtos: []" para
// provar que os dois caíam no legado, ele agora prova que os TRÊS jeitos de
// não ter catálogo são a MESMA condição — inclusive a linha em branco que
// "Adicionar Produto" cria, que é o caso da issue.
test('produtos ausente, lista vazia e linha em branco são a mesma condição: sem catálogo', () => {
  const base: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    num_unidades_residencial: 10,
  };
  const ausente = calcularProforma(base);
  const vazia = calcularProforma({ ...base, produtos: [] });
  // O que a tela grava em "Adicionar Produto": só a ordem, três colunas em
  // branco, `unidades` no default 0 do schema.
  const emBranco = calcularProforma({ ...base, produtos: [{ area_media_m2: null, preco_venda_m2: null, unidades: 0 }] });
  for (const [rotulo, p] of [['ausente', ausente], ['vazia', vazia], ['em branco', emBranco]] as const) {
    assert.equal(p.semProdutos, true, `${rotulo}: deveria ser estado vazio`);
    assert.equal(p.vgv, 0, `${rotulo}: vgv=${p.vgv}`);
    assert.equal(p.numUnidades, 0, `${rotulo}: numUnidades=${p.numUnidades}`);
  }
});

// Uma linha com as três colunas preenchidas ao lado de outra em branco: a em
// branco não desconta nada, e o catálogo continua presente.
test('linha em branco convive com linha preenchida sem alterar o VGV nem a contagem', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 },
      { area_media_m2: null, preco_venda_m2: null, unidades: null },
      { area_media_m2: 80, preco_venda_m2: 9000, unidades: 0 },   // sem unidades: não compõe
    ],
  });
  assert.equal(p.semProdutos, false);
  assert.ok(perto(p.vgv, 10_000_000), `vgv=${p.vgv}`);
  assert.equal(p.numUnidades, 10);
});

test('produtoCompoeCatalogo / catalogoEfetivo: exigem área, preço E unidades', () => {
  assert.equal(produtoCompoeCatalogo({ area_media_m2: 100, preco_venda_m2: 9000, unidades: 4 }), true);
  assert.equal(produtoCompoeCatalogo({ area_media_m2: 0, preco_venda_m2: 9000, unidades: 4 }), false);
  assert.equal(produtoCompoeCatalogo({ area_media_m2: 100, preco_venda_m2: null, unidades: 4 }), false);
  assert.equal(produtoCompoeCatalogo({ area_media_m2: 100, preco_venda_m2: 9000, unidades: 0 }), false);
  assert.equal(catalogoEfetivo(undefined).length, 0);
  assert.equal(catalogoEfetivo([{ unidades: 0 }, { area_media_m2: 100, preco_venda_m2: 1, unidades: 1 }]).length, 1);
});

// #588: resumo agregado do catálogo EFETIVO — consumido pelo backend do
// Apelo Comercial (backend/rotas/apelo-comercial.ts) para montar o contexto
// da IA, no lugar dos campos legados congelados de `estudos`.
test('resumoCatalogoProdutos: sem catálogo efetivo devolve os três campos null (nunca zero)', () => {
  assert.deepEqual(resumoCatalogoProdutos(undefined), { areaMediaM2: null, unidades: null, precoVendaM2: null });
  assert.deepEqual(resumoCatalogoProdutos([]), { areaMediaM2: null, unidades: null, precoVendaM2: null });
  // Linha em branco (o que "Adicionar Produto" cria) não compõe catálogo.
  assert.deepEqual(
    resumoCatalogoProdutos([{ area_media_m2: null, preco_venda_m2: null, unidades: 0 }]),
    { areaMediaM2: null, unidades: null, precoVendaM2: null },
  );
});

test('resumoCatalogoProdutos: linha única — área e preço batem com a própria linha', () => {
  const r = resumoCatalogoProdutos([{ area_media_m2: 65.5, preco_venda_m2: 8500, unidades: 120 }]);
  assert.equal(r.unidades, 120);
  assert.ok(perto(r.areaMediaM2!, 65.5));
  assert.ok(perto(r.precoVendaM2!, 8500));
});

test('resumoCatalogoProdutos: várias linhas — unidades soma simples; área e preço ponderados, e o produto dos três reproduz o VGV total', () => {
  const produtos = [
    { area_media_m2: 100, preco_venda_m2: 8000, unidades: 100 },  // VGV 80.000.000, área total 10.000
    { area_media_m2: 300, preco_venda_m2: 12000, unidades: 20 },  // VGV 72.000.000, área total 6.000
  ];
  const r = resumoCatalogoProdutos(produtos);
  // unidades: soma simples.
  assert.equal(r.unidades, 120);
  // áreaMediaM2: ponderada por unidades — Σ(área×unidades)/Σunidades = 16.000/120.
  assert.ok(perto(r.areaMediaM2!, 16_000 / 120), `areaMediaM2=${r.areaMediaM2}`);
  // precoVendaM2: ponderado pela área total de cada linha — Σ VGV/Σ(área×unidades) = 152.000.000/16.000.
  assert.ok(perto(r.precoVendaM2!, 152_000_000 / 16_000), `precoVendaM2=${r.precoVendaM2}`);
  // Consistência: areaMediaM2 × precoVendaM2 × unidades reproduz o VGV total do catálogo efetivo.
  const vgvTotal = totalProdutos(produtos).vgv;
  assert.ok(perto(r.areaMediaM2! * r.precoVendaM2! * r.unidades!, vgvTotal, 0.5), 'produto dos três != VGV total');
});

test('resumoCatalogoProdutos: linha em branco convivendo com linha válida não distorce o resumo', () => {
  const r = resumoCatalogoProdutos([
    { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 },
    { area_media_m2: null, preco_venda_m2: null, unidades: null },
    { area_media_m2: 80, preco_venda_m2: 9000, unidades: 0 }, // sem unidades: não compõe
  ]);
  assert.equal(r.unidades, 10);
  assert.ok(perto(r.areaMediaM2!, 100));
  assert.ok(perto(r.precoVendaM2!, 10000));
});

test('#565: tipoProdutoEfetivo — produto LEGADO (sem `tipo`) cai em Residencial, sem quebrar', () => {
  assert.equal(tipoProdutoEfetivo({}), 'residencial');
  assert.equal(tipoProdutoEfetivo({ tipo: undefined }), 'residencial');
  assert.equal(tipoProdutoEfetivo({ tipo: null as any }), 'residencial');
  assert.equal(tipoProdutoEfetivo({ tipo: 'residencial' }), 'residencial');
  assert.equal(tipoProdutoEfetivo({ tipo: 'nao_residencial' }), 'nao_residencial');
  // Valor inesperado (nunca deveria chegar do backend, mas não é fail-loud
  // aqui — este campo ainda não alimenta cálculo, ver #570) também cai em
  // Residencial, não trava.
  assert.equal(tipoProdutoEfetivo({ tipo: 'lixo' as any }), 'residencial');
});

test('#315: catálogo com múltiplos produtos (incorporação) — VGV combinado em bucket único', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }, // VGV 10.000.000
      { area_media_m2: 50, preco_venda_m2: 8000, unidades: 4 },    // VGV 1.600.000
    ],
  });
  assert.ok(perto(p.vgv, 11_600_000), `vgv=${p.vgv}`);
  assert.equal(p.numUnidades, 14);
  // #315: interim — bucket único (residencial); NR zerado até #317/#320.
  assert.equal(p.numUnidadesResidencial, 14);
  assert.equal(p.numUnidadesNaoResidencial, 0);
  assert.ok(perto(p.vgvNaoResidencial, 0));
});

test('#315: permuta física continua deduzindo o VGV quando produtos está presente (preço vem do campo legado — interim até #317)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100000,
    preco_venda_m2: 1000, // interim: permuta física ainda lê o preço legado, não o catálogo
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }], // VGV bruto 75.000.000
    permuta_fisica_area_m2: 3000, // 3.000 m² × 1000 R$/m² = 3.000.000
  });
  assert.ok(perto(p.vgv, 75_000_000 - 3_000_000), `vgv=${p.vgv}`);
});

// BUG7-08: sensibilidade — `sensibilidade` escala o valor JÁ RESOLVIDO
// (canônico OU legado, qualquer modo), então o stress funciona
// independentemente de qual unidade/modo está selecionada na UI. Cobertura
// exigida pelo critério de aceite: cada variável × cada modo.
// Migrado: as duas asserções liam o VGV, que era o produto direto de
// precoLot/precoR/precoNR pelas áreas. Com o catálogo como fonte, o preço
// legado do tipo sobreviveu num lugar só — o valor do m² entregue em permuta
// física —, e é lá que o fator continua observável. O que o teste prova é o
// mesmo: `fatorSens('preco')` escala o preço JÁ RESOLVIDO, nos dois tipos de
// empreendimento. (O fator ainda não alcança o preço do catálogo; isso é #568,
// fora do escopo desta correção.)
test('BUG7-08 preco: escala precoLot (loteamento) e precoR/precoNR (incorporação)', () => {
  const baseLot: ProformaInput = { ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 3000 };
  const lot = calcularProforma({ ...baseLot, sensibilidade: { variavel: 'preco', fator: 1.1 } });
  // 3.000 m² × R$ 1.000 × 1,1 — o preço do loteamento escalado pelo fator.
  assert.ok(perto(lot.vgvPermutaResidencial, 3_000_000 * 1.1), `lot.vgvPermR=${lot.vgvPermutaResidencial}`);

  const inc = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 100 }], // base 100M, sem cap
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 100,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 50,
    sensibilidade: { variavel: 'preco', fator: 0.9 },
  });
  assert.ok(perto(inc.vgvPermutaResidencial, 100 * 10000 * 0.9), `incR=${inc.vgvPermutaResidencial}`);
  assert.ok(perto(inc.vgvPermutaNaoResidencial, 50 * 8000 * 0.9), `incNR=${inc.vgvPermutaNaoResidencial}`);
});

test('BUG7-08 permuta_fisica: escala o modo legado (m²/% área venda) e o canônico', () => {
  const base: ProformaInput = { ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 3000 };
  const semFator = calcularProforma(base);
  const comFator = calcularProforma({ ...base, sensibilidade: { variavel: 'permuta_fisica', fator: 2 } });
  assert.ok(perto(comFator.areaPermutaResidencial, semFator.areaPermutaResidencial * 2), `legado=${comFator.areaPermutaResidencial}`);

  // Modo % área venda também escala (mesmo "valor resolvido", modo diferente).
  const basePct = { ...LOT, permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10 } as ProformaInput;
  const comFatorPct = calcularProforma({ ...basePct, sensibilidade: { variavel: 'permuta_fisica', fator: 1.5 } });
  const semFatorPct = calcularProforma(basePct);
  assert.ok(perto(comFatorPct.areaPermutaResidencial, semFatorPct.areaPermutaResidencial * 1.5));

  // Canônico: sem fator, o legado (que o motor ignoraria) não importa — o que
  // conta é escalar o canônico, que é o que estava quebrado antes do BUG7-08.
  const baseCanon = { ...LOT, permuta_fisica_area_canonica: 5000, permuta_fisica_area_m2: 999999 } as ProformaInput;
  const comFatorCanon = calcularProforma({ ...baseCanon, sensibilidade: { variavel: 'permuta_fisica', fator: 2 } });
  assert.ok(perto(comFatorCanon.areaPermutaResidencial, 10000), `canonico=${comFatorCanon.areaPermutaResidencial}`);
});

test('BUG7-08 permuta_financeira: escala o modo % VGV, o modo valor fixo e o canônico', () => {
  const basePct: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    permuta_financeira_residencial_pct: 5,
  };
  const semFator = calcularProforma(basePct);
  const comFator = calcularProforma({ ...basePct, sensibilidade: { variavel: 'permuta_financeira', fator: 2 } });
  assert.ok(perto(comFator.permutaFinResidencial, semFator.permutaFinResidencial * 2));

  const baseFixo: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    permuta_financeira_residencial_modo: 'valor_fixo', permuta_financeira_residencial_valor: 200_000,
  };
  const comFatorFixo = calcularProforma({ ...baseFixo, sensibilidade: { variavel: 'permuta_financeira', fator: 1.5 } });
  assert.ok(perto(comFatorFixo.permutaFinResidencial, 300_000), `fixo=${comFatorFixo.permutaFinResidencial}`);

  const baseCanon: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    permuta_financeira_residencial_valor_canonico: 100_000,
  };
  const comFatorCanon = calcularProforma({ ...baseCanon, sensibilidade: { variavel: 'permuta_financeira', fator: 2 } });
  assert.ok(perto(comFatorCanon.permutaFinResidencial, 200_000), `canonico=${comFatorCanon.permutaFinResidencial}`);
});

test('BUG7-08 custo_infra: escala os 3 modos (% VGV, R$/m², R$ fixo) e o canônico', () => {
  const pct = calcularProforma({ ...LOT, infra_modo: 'pct_vgv', infra_pct: 30, sensibilidade: { variavel: 'custo_infra', fator: 2 } });
  const pctSem = calcularProforma({ ...LOT, infra_modo: 'pct_vgv', infra_pct: 30 });
  assert.ok(perto(pct.infraestrutura, pctSem.infraestrutura * 2), `pct=${pct.infraestrutura}`);

  const m2 = calcularProforma({ ...LOT, infra_modo: 'valor_m2', custo_infra_m2: 100, sensibilidade: { variavel: 'custo_infra', fator: 3 } });
  assert.ok(perto(m2.infraestrutura, 75_000 * 100 * 3), `m2=${m2.infraestrutura}`); // antes do BUG7-08 já funcionava (sem canônico)

  // R$ fixo: NÃO era coberto antes do BUG7-08 (só custo_infra_m2/infra_pct estavam na lista).
  const fixo = calcularProforma({ ...LOT, infra_modo: 'valor_fixo', infra_valor_fixo: 1_000_000, sensibilidade: { variavel: 'custo_infra', fator: 1.2 } });
  assert.ok(perto(fixo.infraestrutura, 1_200_000), `fixo=${fixo.infraestrutura}`);

  const canon = calcularProforma({ ...LOT, infra_valor_canonico: 500_000, sensibilidade: { variavel: 'custo_infra', fator: 2 } });
  assert.ok(perto(canon.infraestrutura, 1_000_000), `canonico=${canon.infraestrutura}`);
});

test('BUG7-08 custo_obras: escala os 2 modos (R$/m², valor total) e o canônico', () => {
  const base: ProformaInput = { tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 1000 };
  const m2 = calcularProforma({ ...base, construcao_modo: 'valor_m2', custo_construcao_m2: 5000, sensibilidade: { variavel: 'custo_obras', fator: 2 } });
  assert.ok(perto(m2.construcao, 1000 * 5000 * 2), `m2=${m2.construcao}`); // já funcionava antes

  // valor_total: NÃO era coberto antes do BUG7-08 (só custo_construcao_m2 estava na lista).
  const total = calcularProforma({ ...base, construcao_modo: 'valor_total', construcao_valor_total: 7_500_000, sensibilidade: { variavel: 'custo_obras', fator: 1.5 } });
  assert.ok(perto(total.construcao, 11_250_000), `total=${total.construcao}`);

  const canon = calcularProforma({ ...base, construcao_valor_canonico: 4_000_000, sensibilidade: { variavel: 'custo_obras', fator: 1.5 } });
  assert.ok(perto(canon.construcao, 6_000_000), `canonico=${canon.construcao}`);
});

test('BUG7-08: sensibilidade ausente/fator neutro preserva o comportamento anterior', () => {
  const semSens = calcularProforma(LOT);
  const comFator1 = calcularProforma({ ...LOT, sensibilidade: { variavel: 'preco', fator: 1 } });
  assert.ok(perto(semSens.vgv, comFator1.vgv));
});

test('preço sugerido: atinge o piso do benchmark', () => {
  const piso = 40; // acima da margem atual (~38,4%)
  const preco = precoSugeridoM2(LOT, piso);
  assert.ok(preco !== null && preco > 1000, `preço=${preco}`);
  // O preço sugerido é preço de CATÁLOGO — conferir a margem exige repô-lo nas
  // linhas do catálogo, que é o que `precoSugeridoM2` faz por dentro. Repor só
  // no campo legado deixaria a margem parada em 38,4%.
  const margem = calcularProforma({
    ...LOT,
    preco_venda_m2: preco!,
    produtos: LOT.produtos!.map((x) => ({ ...x, preco_venda_m2: preco! })),
  }).margemLiquidaPct;
  assert.ok(perto(margem, piso, 0.05), `margem no preço sugerido=${margem}`);
});

// ── #407: o caso que a listagem quebrava ────────────────────────────────
//
// O estudo que existe na prática: catálogo de Produtos preenchido e campos
// legados vazios. Sem `produtos` no payload esse estudo dá `vgv = 0` — e a
// listagem (frontend/tela-dashboard.ts, guard `p.vgv > 0 ? … : '—'`) mostrava
// "—" em VGV, Resultado e Margem. O conserto foi o backend anexar os produtos
// à listagem; o segundo teste continua a prova de que a omissão do payload é a
// causa, e não uma peculiaridade da tela.

const SO_CATALOGO: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  terreno_manual_area: 5000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  custo_construcao_m2: 4000,
  // Nenhum campo legado de área/preço: area_pvt_r_fechada,
  // preco_venda_m2_residencial e num_unidades_residencial ausentes.
  produtos: [{ area_media_m2: 100, preco_venda_m2: 12000, unidades: 40 }],
};

test('#407: estudo com VGV só do catálogo tem vgv > 0 — a listagem não pode mostrar "—"', () => {
  const p = calcularProforma(SO_CATALOGO);
  assert.ok(perto(p.vgv, 48_000_000), `vgv=${p.vgv}`);
  assert.ok(p.vgv > 0, 'o guard da listagem depende exatamente disto');
  assert.equal(p.numUnidades, 40);
});

test('#407: o MESMO estudo sem `produtos` no payload cai em vgv 0 — a causa do "—"', () => {
  const { produtos, ...semProdutos } = SO_CATALOGO;
  const p = calcularProforma(semProdutos as ProformaInput);
  assert.equal(p.vgv, 0);
  assert.equal(p.margemLiquidaPct, 0);
});

// ── Excedente de permuta física ─────────────────────────────────────────
//
// O estudo do print de produção: permuta física em 100% da área privativa
// residencial, com R$ 24.764.117,40 de valor de mercado. Antes esse valor era
// subtraído sem piso e a Receita bruta saía NEGATIVA na tela.
//
// 3.095,514675 m² × R$ 8.000,00/m² = R$ 24.764.117,40 — a área é a do estudo
// reconstituída a partir do valor do print e de um preço redondo, porque o que
// esta suíte prova é o tratamento do excedente, não qual das duas grandezas o
// autor digitou.
const AREA_PERMUTA_PRINT = 3095.514675;
const PRECO_PRINT = 8000;
const VGV_PRINT = 24_764_117.40;

test('permuta física igual à base: VGV zera sem capar — o limite exato não é excedente', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: AREA_PERMUTA_PRINT, preco_venda_m2_residencial: PRECO_PRINT,
    produtos: [{ area_media_m2: AREA_PERMUTA_PRINT, preco_venda_m2: PRECO_PRINT, unidades: 1 }],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 100,
  });
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.ok(perto(vgvBruto, VGV_PRINT), `vgvBruto=${vgvBruto}`);
  assert.equal(p.vgv, 0, `vgv=${p.vgv}`);
  assert.equal(p.permutaCapada, false, 'permuta exatamente igual à base não é excedente');
  assert.ok(perto(p.vgvPermutaResidencial, VGV_PRINT), `vgvPermR=${p.vgvPermutaResidencial}`);
});

test('permuta física maior que a base: a efetiva é capada, o VGV para em zero e o aviso liga', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: AREA_PERMUTA_PRINT, preco_venda_m2_residencial: PRECO_PRINT,
    // Base menor que a permuta: metade das unidades do teste acima.
    produtos: [{ area_media_m2: AREA_PERMUTA_PRINT / 2, preco_venda_m2: PRECO_PRINT, unidades: 1 }],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 100,
  });
  assert.equal(p.permutaCapada, true, 'o excedente tem que ser sinalizado');
  assert.ok(perto(p.vgvPermutaSolicitada, VGV_PRINT), `solicitada=${p.vgvPermutaSolicitada}`);
  assert.ok(perto(p.vgvPermutaResidencial, VGV_PRINT / 2), `efetiva=${p.vgvPermutaResidencial}`);
  assert.equal(p.vgv, 0, `vgv=${p.vgv}`);
  assert.ok(p.vgv >= 0, 'o VGV nunca pode ficar negativo');
  // A identidade continua fechando sobre a permuta EFETIVA.
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.ok(perto(vgvBruto, VGV_PRINT / 2), `vgvBruto=${vgvBruto}`);
  // A área informada não é reescrita: quem digitou 100% continua vendo 100%.
  assert.ok(perto(p.areaPermutaFisica, AREA_PERMUTA_PRINT), `area=${p.areaPermutaFisica}`);
});

test('reconstituição do print: catálogo com produto em branco + permuta de 100% não dá VGV negativo', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: AREA_PERMUTA_PRINT, preco_venda_m2_residencial: PRECO_PRINT,
    produtos: [{ area_media_m2: null, preco_venda_m2: null, unidades: 0 }],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 100,
    imposto_percentual: 7, corretagem_percentual: 5, marketing_percentual: 1,
  });
  // Era −24.764.117,40 na tela.
  assert.equal(p.vgv, 0, `vgv=${p.vgv}`);
  assert.equal(p.semProdutos, true, 'produto em branco não é catálogo');
  assert.equal(p.permutaCapada, true);
  assert.ok(perto(p.vgvPermutaSolicitada, VGV_PRINT), `solicitada=${p.vgvPermutaSolicitada}`);
  assert.equal(p.vgvPermutaResidencial, 0, 'sem base, não há permuta a entregar');
  // Nenhuma dedução em % de VGV pode aparecer.
  assert.equal(p.imposto, 0);
  assert.equal(p.corretagem, 0);
  assert.equal(p.marketing, 0);
});

test('permuta física R e NR acima da base: o corte é proporcional e preserva a divisão entre os dois', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,     // solicita 6M
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000,  // solicita 2M
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 4 }], // base 4M
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 600,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 250,
  });
  assert.equal(p.permutaCapada, true);
  assert.ok(perto(p.vgvPermutaSolicitada, 8_000_000), `solicitada=${p.vgvPermutaSolicitada}`);
  // Metade de cada: 4M de base sobre 8M pedidos.
  assert.ok(perto(p.vgvPermutaResidencial, 3_000_000), `R=${p.vgvPermutaResidencial}`);
  assert.ok(perto(p.vgvPermutaNaoResidencial, 1_000_000), `NR=${p.vgvPermutaNaoResidencial}`);
  assert.equal(p.vgv, 0);
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.ok(perto(vgvBruto, 4_000_000), `vgvBruto=${vgvBruto}`);
});

test('loteamento também é capado — o estado vazio e o cap valem nos dois padrões', () => {
  const semCatalogo = calcularProforma({
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100000,
    area_media_lote_m2: 300, preco_venda_m2: 1000,   // par legado, sem UI
    imposto_percentual: 7, corretagem_percentual: 5,
    infra_modo: 'pct_vgv', infra_pct: 30,
  });
  assert.equal(semCatalogo.semProdutos, true);
  assert.equal(semCatalogo.vgv, 0);
  assert.equal(semCatalogo.numUnidades, 0);
  assert.equal(semCatalogo.imposto, 0);
  assert.equal(semCatalogo.infraestrutura, 0, 'infra em % de VGV não pode sair do preço legado');

  const capado = calcularProforma({
    ...LOT,
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 10 }], // base 3M
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 5000,           // pede 5M
  });
  assert.equal(capado.permutaCapada, true);
  assert.ok(perto(capado.vgvPermutaSolicitada, 5_000_000));
  assert.ok(perto(capado.vgvPermutaResidencial, 3_000_000));
  assert.equal(capado.vgv, 0);
});

// ── Quantização do cap: a identidade tem de valer ao CENTAVO ─────────────
//
// O corte proporcional produz frações de centavo, e três arredondamentos
// independentes não somam de volta à base. O caso abaixo é o mínimo que
// quebra: base de R$ 0,01 com as duas permutas pedindo o mesmo valor. O fator
// 0,5 dá R$ 0,005 em cada, que sobe para R$ 0,01 nas duas — R$ 0,02 de
// permuta sobre uma base de R$ 0,01, o dobro.
test('cap com meio centavo: a identidade fecha EXATAMENTE, sem resíduo de arredondamento', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    // Permutas iguais em valor: 1 m² × R$ 0,01 de cada lado = R$ 0,02 pedidos.
    area_pvt_r_fechada: 1, preco_venda_m2_residencial: 0.01,
    area_pvt_nr_fechada: 1, preco_venda_m2_nao_residencial: 0.01,
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 1,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 1,
    // Base de exatamente R$ 0,01.
    produtos: [{ area_media_m2: 1, preco_venda_m2: 0.01, unidades: 1 }],
  });
  assert.equal(p.permutaCapada, true);
  assert.equal(p.vgv, 0);
  // A soma das três parcelas é a base, ao centavo — não R$ 0,02.
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.equal(vgvBruto, 0.01, `vgvBruto=${vgvBruto} (esperado 0,01 — o dobro seria o resíduo)`);
  // E cada parcela continua sendo um valor de 2 casas.
  for (const v of [p.vgv, p.vgvPermutaResidencial, p.vgvPermutaNaoResidencial]) {
    assert.equal(Math.round(v * 100) / 100, v, `parcela fora do contrato de 2 casas: ${v}`);
  }
});

test('a identidade fecha ao centavo mesmo SEM cap, com parcelas de fração de centavo', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1, preco_venda_m2_residencial: 0.333,
    area_pvt_nr_fechada: 1, preco_venda_m2_nao_residencial: 0.333,
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 1,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 1,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 1, unidades: 1 }], // base 100, folgada
  });
  assert.equal(p.permutaCapada, false);
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.equal(vgvBruto, 100, `vgvBruto=${vgvBruto}`);
});

// A DECISÃO de não capar as áreas (só o valor) tem uma consequência: com a
// permuta maior que a área vendável, `areaVendavelLiquida` fica NEGATIVA. Ela
// é saída pública do motor, então o que este teste trava é o confinamento —
// nenhum valor monetário derivado dela pode sair negativo ou inventado.
test('permuta maior que a área vendável: a área líquida negativa não contamina valor monetário', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 100, preco_venda_m2_residencial: 1000,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 100, unidades: 1 }], // base 10.000
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 300,          // 3× a área vendável
  });
  assert.ok(p.areaVendavelLiquida < 0, `areaVendavelLiquida=${p.areaVendavelLiquida}`);
  assert.equal(p.permutaCapada, true);
  assert.equal(p.vgv, 0);
  // `precoMedioM2` é guardado por `areaVendavelLiquida > 0`, então o memo do
  // valor de mercado da permuta zera em vez de sair negativo.
  assert.equal(p.valorPermutaFisica, 0, `valorPermutaFisica=${p.valorPermutaFisica}`);
  assert.ok(p.vgvPermutaResidencial >= 0 && p.vgvPermutaNaoResidencial >= 0);
  // A área informada é preservada — é a decisão de desenho, e o aviso a declara.
  assert.ok(perto(p.areaPermutaFisica, 300));
});

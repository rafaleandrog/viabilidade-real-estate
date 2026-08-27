import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularProforma, precoSugeridoM2, vgvProduto, totalProdutos, catalogoEfetivo, produtoCompoeCatalogo,
  resumoCatalogoProdutos, tipoProdutoEfetivo, aplicarFatorPreco,
  totaisPorTipoProdutos, areaTotalProdutos,
  type ProformaInput,
} from './proforma.js';
import {
  ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE,
  FATOR_BEAR, FATOR_BULL, VGV_BASE, VGV_BEAR, VGV_BULL,
} from './fixtures/sensibilidade-catalogo.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Loteamento de referência (valores conferidos à mão).
//
// O catálogo de Produtos é a única fonte do VGV, então ele entra no fixture
// reproduzindo EXATAMENTE o que o par legado (area_media_lote_m2 ×
// preco_venda_m2 × lotes derivados da área vendável) produzia antes: 300 m² ×
// R$ 1.000 × 250 lotes = R$ 75.000.000, com 250 unidades. Todos os números
// conferidos à mão abaixo continuam valendo sem alteração.
//
// `area_media_lote_m2` e `preco_venda_m2` ficam no fixture porque governam o
// estudo SEM catálogo (a permuta física lê o preço legado ali, #570) — não
// porque alimentem receita quando há catálogo.
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
  // #571: vgv > 0 neste fixture, então margemLiquidaPct nunca é `null` aqui —
  // a checagem de runtime é o que deixa o `!` seguro para o TS.
  assert.notEqual(p.margemLiquidaPct, null);
  assert.ok(perto(p.margemLiquidaPct!, 38.4167, 0.01), `margem=${p.margemLiquidaPct}`);
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
  assert.notEqual(p.receitaLiquidaSobreVgvPct, null);
  assert.ok(perto(p.receitaLiquidaSobreVgvPct!, 87, 0.01), `receitaLiquidaSobreVgvPct=${p.receitaLiquidaSobreVgvPct}`);
  assert.ok(
    perto(p.receitaLiquidaSobreVgvPct!, (p.receitaLiquida / p.vgv) * 100, 1e-9),
    'tem que ser exatamente receitaLiquida/vgv*100, não outra fórmula',
  );
  // Não é a mesma grandeza de margemLiquidaPct — o renome não colapsou dois
  // conceitos num só.
  assert.notEqual(p.receitaLiquidaSobreVgvPct, p.margemLiquidaPct);
});

// #571: este teste dizia "= 0" — era exatamente o bug que a #571 fecha. Um
// resultado de fórmula real de 0% (margem exatamente zero) e "sem VGV para
// medir margem nenhuma" são estados DIFERENTES, e o motor agora os distingue:
// `null` é o segundo, nunca o primeiro. Mutação: trocar o `null` de volta
// para 0 em `proforma.ts` faz as duas asserções abaixo falharem.
test('#453: vgv === 0 → receitaLiquidaSobreVgvPct = null (indefinido, não "mediu zero")', () => {
  const p = calcularProforma({ tipo_empreendimento: 'loteamento' } as ProformaInput);
  assert.equal(p.vgv, 0);
  assert.equal(p.receitaLiquidaSobreVgvPct, null);
  assert.equal(p.margemLiquidaPct, null);
  assert.equal(p.custoObrasVgvPct, null);
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
// ficam idênticas. A separação R/NR do VGV voltou pela #570 — as duas linhas
// do catálogo aqui são residenciais (nenhuma leva `tipo`), então o VGV inteiro
// sai em `vgvResidencial`; o teste do estado vazio, logo abaixo, cobre o que
// era o outro lado deste.
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

// #573 — indicador de área privativa alocada nos produtos. `registrada` é
// `areaPrivativa` (a MESMA grandeza que o teto de aproveitamento #569 usa
// como "usada"); `alocada` é `areaTotalProdutos` do catálogo EFETIVO,
// Residencial + Não Residencial somados.
test('#573: alocada == registrada → diferença zero, percentual 100%, nenhum estado de excesso/sobra', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 4_000, area_pvt_nr_fechada: 1_000, // registrada = 5.000
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 30 }, // 3.000 residencial
      { area_media_m2: 50, preco_venda_m2: 8_000, unidades: 40, tipo: 'nao_residencial' }, // 2.000 NR
    ],
  });
  assert.ok(perto(p.areaPrivativa, 5_000));
  assert.ok(perto(p.areaProdutosAlocada, 5_000), `alocada=${p.areaProdutosAlocada}`);
  assert.equal(p.diferencaAreaAlocada, 0);
  assert.ok(perto(p.pctAreaAlocada!, 100));
});

test('#573: catálogo excede a área registrada → diferença positiva (excesso alocado)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1_000, // registrada = 1.000
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 15 }], // 1.500 alocado
  });
  assert.ok(perto(p.areaProdutosAlocada, 1_500));
  assert.ok(perto(p.diferencaAreaAlocada, 500), `diferenca=${p.diferencaAreaAlocada}`); // 1.500 - 1.000
  assert.ok(perto(p.pctAreaAlocada!, 150));
});

test('#573: catálogo aquém da área registrada → diferença negativa (sobra por alocar)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 2_000, // registrada = 2.000
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 12 }], // 1.200 alocado
  });
  assert.ok(perto(p.areaProdutosAlocada, 1_200));
  assert.ok(perto(p.diferencaAreaAlocada, -800), `diferenca=${p.diferencaAreaAlocada}`); // 1.200 - 2.000
  assert.ok(perto(p.pctAreaAlocada!, 60));
});

test('#573: sem NADA registrado em Terreno & Áreas → percentual null, nunca "0%" falso', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    // area_pvt_* ausentes: registrada = 0.
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 }], // 1.000 alocado
  });
  assert.equal(p.areaPrivativa, 0);
  assert.ok(perto(p.areaProdutosAlocada, 1_000));
  assert.equal(p.pctAreaAlocada, null); // sem denominador — indefinido, não "0%" nem "100000%"
  assert.ok(perto(p.diferencaAreaAlocada, 1_000)); // a subtração continua definida sem a área registrada
});

test('#573: catálogo vazio E nada registrado → os dois lados zerados, diferença zero (nada a alocar)', () => {
  const p = calcularProforma({ tipo_empreendimento: 'incorporacao' });
  assert.equal(p.areaPrivativa, 0);
  assert.equal(p.areaProdutosAlocada, 0);
  assert.equal(p.diferencaAreaAlocada, 0);
  assert.equal(p.pctAreaAlocada, null);
});

// Loteamento: `areaPrivativa` é a ALV da cascata (não há parcelas PVT), e o
// catálogo é sempre bucket único — mesma soma, sem ramo `lot` no motor.
test('#573: loteamento — registrada é a ALV da cascata, alocada é o catálogo (bucket único)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100_000,
    area_viario_publico_modo: 'pct_poligonal', area_viario_publico_valor: 25, // ALV = 75.000
    area_media_lote_m2: 300, preco_venda_m2: 1_000,
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1_000, unidades: 200 }], // 60.000 alocado
  });
  assert.ok(perto(p.areaPrivativa, 75_000));
  assert.ok(perto(p.areaProdutosAlocada, 60_000));
  assert.ok(perto(p.diferencaAreaAlocada, -15_000)); // sobra por alocar
  assert.ok(perto(p.pctAreaAlocada!, 80));
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
// campos legados de permuta, cada um sobre a base da sua categoria.
//
// #570: as bases (área e preço) saem AGORA do catálogo da categoria, não mais
// dos campos legados. O fixture foi montado para que os dois caminhos deem o
// MESMO número — a área do catálogo R (100 × 10 = 1.000 m²) é igual a
// `area_pvt_r_fechada`, e o preço médio R (10M ÷ 1.000) é igual a
// `preco_venda_m2_residencial`; idem NR. Assim o que muda de veredito neste
// teste é só o que a issue pediu: os dois VGV deixam de ser "14M em R e 0 em
// NR" e passam a ser 9M em R e 3,6M em NR. O TOTAL (12,6M) não se move.
test('incorporação: permuta física R e NR separadas reduzem cada VGV (#10)', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,    // legado: idêntico ao catálogo R
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000, // legado: idêntico ao catálogo NR
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 },  // R (default): VGV 10M, 1.000 m²
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 5, tipo: 'nao_residencial' }, // NR: VGV 4M, 500 m²
    ],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,     // R: 10% de 1.000 = 100 m²
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 50,  // NR: 50 m²
  });
  assert.ok(perto(p.areaPermutaResidencial, 100), `areaR=${p.areaPermutaResidencial}`);
  assert.ok(perto(p.areaPermutaNaoResidencial, 50), `areaNR=${p.areaPermutaNaoResidencial}`);
  assert.ok(perto(p.areaPermutaFisica, 150));
  assert.equal(p.permutaCapada, false, '1M cabe nos 10M de R e 0,4M cabe nos 4M de NR — nada a capar');
  assert.ok(perto(p.vgvPermutaResidencial, 1_000_000), `vgvPermR=${p.vgvPermutaResidencial}`);     // 100 × 10000
  assert.ok(perto(p.vgvPermutaNaoResidencial, 400_000), `vgvPermNR=${p.vgvPermutaNaoResidencial}`); // 50 × 8000
  // #570: cada categoria líquida da SUA permuta — 10M − 1M e 4M − 0,4M.
  assert.ok(perto(p.vgvResidencial, 9_000_000), `vgvR=${p.vgvResidencial}`);
  assert.ok(perto(p.vgvNaoResidencial, 3_600_000), `vgvNR=${p.vgvNaoResidencial}`);
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
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 5, tipo: 'nao_residencial' }, // VGV bruto NR = 4M
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
// quatro campos sem UI. O detalhe por tipo COM catálogo é coberto pelo bloco da
// #570, no fim do arquivo.
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
  // Valor fora do domínio (o `opcoes` da coluna barra na escrita) também cai
  // em Residencial: desde a #570 este campo governa cálculo, e a escolha é
  // classificar em vez de derrubar a Proforma inteira.
  assert.equal(tipoProdutoEfetivo({ tipo: 'lixo' as any }), 'residencial');
});

// Duas linhas SEM `tipo`: o catálogo inteiro é residencial por default (#565),
// e é assim que todo estudo anterior à migração `035` continua sendo lido.
test('#315: catálogo com múltiplos produtos (incorporação) — VGV combinado, todas as linhas residenciais', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }, // VGV 10.000.000
      { area_media_m2: 50, preco_venda_m2: 8000, unidades: 4 },    // VGV 1.600.000
    ],
  });
  assert.ok(perto(p.vgv, 11_600_000), `vgv=${p.vgv}`);
  assert.equal(p.numUnidades, 14);
  // Nenhuma linha é NR: as 14 unidades e o VGV todo ficam em Residencial.
  assert.equal(p.numUnidadesResidencial, 14);
  assert.equal(p.numUnidadesNaoResidencial, 0);
  assert.ok(perto(p.vgvNaoResidencial, 0));
});

// #570: o preço da permuta passou a ser o médio do catálogo da categoria. Aqui
// os dois coincidem em R$ 1.000/m² (75M ÷ 75.000 m²), então o número não muda —
// o teste do Loteamento COM catálogo divergente, no bloco da #570, é o que
// separa as duas fontes.
test('#315: permuta física continua deduzindo o VGV quando produtos está presente', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100000,
    preco_venda_m2: 1000, // legado: idêntico ao preço médio do catálogo abaixo
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
// empreendimento. (O fator hoje alcança TAMBÉM o preço do catálogo — #568,
// bloco no fim deste arquivo; este teste continua medindo só a permuta, que é
// o que o preço legado ainda governa.)
test('BUG7-08 preco: escala precoLot (loteamento) e precoR/precoNR (incorporação)', () => {
  const baseLot: ProformaInput = { ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 3000 };
  const lot = calcularProforma({ ...baseLot, sensibilidade: { variavel: 'preco', fator: 1.1 } });
  // 3.000 m² × R$ 1.000 × 1,1 — o preço do loteamento escalado pelo fator.
  assert.ok(perto(lot.vgvPermutaResidencial, 3_000_000 * 1.1), `lot.vgvPermR=${lot.vgvPermutaResidencial}`);

  const inc = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8000,
    // #570: o preço que valora a permuta é o médio da categoria NO CATÁLOGO —
    // montado aqui igual ao legado (10.000 em R, 8.000 em NR) para o fator
    // continuar sendo a única variável do teste. Bases folgadas, sem cap.
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 100 },  // R: 100M
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 50, tipo: 'nao_residencial' }, // NR: 40M
    ],
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

// ─────────────────────────────────────────────────────────────────────────
// #568 — a análise de sensibilidade alcança o CATÁLOGO DE PRODUTOS.
//
// O defeito: `fatorSens('preco')` escalava só os campos legados
// `preco_venda_m2*`, que desde a #563 sobraram como preço da PERMUTA FÍSICA.
// Com catálogo presente — o caso normal — Bear/Base/Bull saíam com o mesmo
// VGV, e o print de produção que abriu a issue mostrava a linha "VGV"
// congelada nos três cenários.
//
// O fixture dourado (`frontend/fixtures/sensibilidade-catalogo.ts`) é o do
// print: VGV base R$ 24.764.117,40.
// ─────────────────────────────────────────────────────────────────────────

const sens = (fator: number): ProformaInput => ({
  ...ESTUDO_SENSIBILIDADE,
  produtos: PRODUTOS_SENSIBILIDADE,
  sensibilidade: { variavel: 'preco', fator },
});

test('#568 preco: o fator escala o VGV do CATÁLOGO — Bear ×0,9 e Bull ×1,1, com 2 casas', () => {
  // `toFixed(2)` e não `perto`: o critério de aceite é numérico ao CENTAVO
  // (contrato C7), e uma tolerância de um centavo esconderia justamente o
  // erro de quantização que o cap da #563 introduziria se o fator entrasse
  // depois do arredondamento.
  assert.equal(calcularProforma(sens(1)).vgv.toFixed(2), VGV_BASE.toFixed(2));
  assert.equal(calcularProforma(sens(FATOR_BEAR)).vgv.toFixed(2), VGV_BEAR.toFixed(2));
  assert.equal(calcularProforma(sens(FATOR_BULL)).vgv.toFixed(2), VGV_BULL.toFixed(2));
  // E os três são DIFERENTES entre si — a asserção que o bug fazia falhar
  // (antes da correção os três davam 24.764.117,40).
  const vgvs = new Set([sens(FATOR_BEAR), sens(1), sens(FATOR_BULL)].map((e) => calcularProforma(e).vgv));
  assert.equal(vgvs.size, 3, `o VGV não variou entre os cenários: ${[...vgvs].join(' | ')}`);
});

test('#568: o nº de unidades e o preço médio por unidade acompanham o cenário sem duplicar o fator', () => {
  const base = calcularProforma(sens(1));
  const bull = calcularProforma(sens(FATOR_BULL));
  // Unidades são cadastro, não preço: idênticas nos dois cenários.
  assert.equal(base.numUnidades, 50);
  assert.equal(bull.numUnidades, 50);
  // O preço médio por unidade sobe na mesma proporção do VGV — uma vez só.
  assert.ok(perto(bull.precoMedioUnidade, base.precoMedioUnidade * FATOR_BULL, 0.02),
    `precoMedioUnidade base=${base.precoMedioUnidade} bull=${bull.precoMedioUnidade}`);
});

test('#568 aplicarFatorPreco: escala o PREÇO de cada linha, nunca área ou unidades', () => {
  const escalado = aplicarFatorPreco(PRODUTOS_SENSIBILIDADE, 1.1);
  assert.equal(escalado.length, PRODUTOS_SENSIBILIDADE.length);
  escalado.forEach((p, i) => {
    const original = PRODUTOS_SENSIBILIDADE[i];
    assert.ok(perto(Number(p.preco_venda_m2), Number(original.preco_venda_m2) * 1.1, 1e-6));
    assert.equal(p.area_media_m2, original.area_media_m2);
    assert.equal(p.unidades, original.unidades);
  });
  // Não muta a lista de entrada (o motor a reusa para `numUnidades`).
  assert.equal(PRODUTOS_SENSIBILIDADE[0].preco_venda_m2, 10_000);
  // Fator neutro devolve o mesmo VGV.
  assert.ok(perto(totalProdutos(aplicarFatorPreco(PRODUTOS_SENSIBILIDADE, 1)).vgv, VGV_BASE));
});

test('#568: o resumo do catálogo composto com o fator move só o preço médio', () => {
  const cadastro = resumoCatalogoProdutos(PRODUTOS_SENSIBILIDADE);
  const cenario = resumoCatalogoProdutos(aplicarFatorPreco(catalogoEfetivo(PRODUTOS_SENSIBILIDADE), FATOR_BULL));
  assert.equal(cenario.unidades, cadastro.unidades);
  assert.ok(perto(cenario.areaMediaM2!, cadastro.areaMediaM2!, 1e-9));
  assert.ok(perto(cenario.precoVendaM2!, cadastro.precoVendaM2! * FATOR_BULL, 1e-6),
    `preço médio cadastro=${cadastro.precoVendaM2} cenário=${cenario.precoVendaM2}`);
});

test('#568 loteamento: catálogo e valoração da permuta física escalam JUNTOS — o VGV líquido é proporcional', () => {
  // O Loteamento continua valorando a permuta pelo preço LEGADO
  // (`preco_venda_m2`, interim do #315) enquanto o VGV sai do catálogo. Se só
  // um dos dois recebesse o fator, o cenário mudaria a PROPORÇÃO entre base e
  // permuta — e a permuta pareceria encolher (ou inchar) sozinha.
  const base: ProformaInput = { ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 3_000 };
  const semFator = calcularProforma(base);
  const bull = calcularProforma({ ...base, sensibilidade: { variavel: 'preco', fator: 1.1 } });
  assert.ok(perto(semFator.vgv, 72_000_000), `vgv base=${semFator.vgv}`);          // 75M − 3M
  assert.ok(perto(bull.vgv, 79_200_000), `vgv bull=${bull.vgv}`);                   // 82,5M − 3,3M
  assert.ok(perto(bull.vgv, semFator.vgv * 1.1, 0.02), 'o VGV líquido não é proporcional ao fator');
  // A permuta pesa o mesmo sobre o bruto nos dois cenários.
  const peso = (p: ReturnType<typeof calcularProforma>) =>
    p.vgvPermutaResidencial / (p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial);
  assert.ok(perto(peso(bull), peso(semFator), 1e-9), `peso base=${peso(semFator)} bull=${peso(bull)}`);
});

test('#568: o cap do excedente de permuta (#563) e os indicadores indefinidos (#571) sobrevivem ao stress', () => {
  // Permuta que vale mais que a base inteira: 80.000 m² × R$ 1.000 = R$ 80M
  // sobre catálogo de R$ 75M. Como base e permuta escalam pelo MESMO fator, o
  // excedente continua excedente em qualquer cenário — o cap não é um efeito
  // do cenário, é do estudo.
  const capado: ProformaInput = { ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 80_000 };
  for (const fator of [FATOR_BEAR, 1, FATOR_BULL]) {
    const p = calcularProforma({ ...capado, sensibilidade: { variavel: 'preco', fator } });
    assert.equal(p.permutaCapada, true, `fator ${fator}: a permuta deveria continuar capada`);
    assert.equal(p.vgv, 0, `fator ${fator}: vgv=${p.vgv}`);
    // #571: sem base, o indicador é INDEFINIDO — nunca 0,0%.
    assert.equal(p.margemLiquidaPct, null, `fator ${fator}: margemLiquidaPct=${p.margemLiquidaPct}`);
    assert.equal(p.custoObrasVgvPct, null, `fator ${fator}: custoObrasVgvPct=${p.custoObrasVgvPct}`);
  }
});

test('#568: variação negativa acima de 100% degrada o preço para ZERO — nunca para preço negativo', () => {
  // O editor de benchmarks, o `schema.json` e a rota PATCH aceitam
  // `variacao_negativa_pct > 100`, e a tela deriva `fatorBear = 1 − varNeg/100`
  // — com 150% o fator pedido é **−0,5**. Sem o piso na fonte, o catálogo era
  // reprecificado a preço NEGATIVO: o VGV bruto ficava negativo, o cap
  // escolhia `Math.min(0, negativo)` como permuta efetiva, e a tela mostrava a
  // linha "VGV" NEGATIVA com "Receita bruta" zerada — exatamente o que a #563
  // proibiu.
  const fatorPedido = 1 - 150 / 100;
  assert.ok(fatorPedido < 0, 'o fixture deste teste precisa pedir um fator negativo');

  const p = calcularProforma({
    ...ESTUDO_SENSIBILIDADE, produtos: PRODUTOS_SENSIBILIDADE,
    sensibilidade: { variavel: 'preco', fator: fatorPedido },
  });
  // Preço zero ⇒ VGV zero. Nem a base, nem a permuta, nem o VGV BRUTO que a
  // tela imprime na linha "VGV" (`vgv + as duas permutas`) podem ficar
  // negativos.
  assert.equal(p.vgv, 0, `vgv=${p.vgv}`);
  assert.equal(p.vgvResidencial, 0);
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.vgvPermutaResidencial, 0, `permutaR=${p.vgvPermutaResidencial}`);
  assert.equal(p.vgvPermutaNaoResidencial, 0, `permutaNR=${p.vgvPermutaNaoResidencial}`);
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.equal(vgvBruto, 0, `a linha "VGV" da tela saiu ${vgvBruto}`);
  // #571: sem base, indicador é INDEFINIDO — nunca 0,0%.
  assert.equal(p.margemLiquidaPct, null);
  assert.equal(p.custoObrasVgvPct, null);
  assert.equal(p.receitaLiquidaSobreVgvPct, null);

  // O mesmo com permuta física no estudo, que é onde o cap opera: a permuta
  // pedida também vale zero, então não há excedente a capar e a identidade
  // `vgv + permutas = VGV bruto` continua fechando em zero.
  const comPermuta = calcularProforma({
    ...LOT, permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 3_000,
    sensibilidade: { variavel: 'preco', fator: fatorPedido },
  });
  assert.equal(comPermuta.vgv, 0, `vgv com permuta=${comPermuta.vgv}`);
  assert.equal(comPermuta.vgvPermutaSolicitada, 0);
  assert.equal(comPermuta.permutaCapada, false, 'sem base e sem permuta não há excedente a capar');
  assert.equal(
    comPermuta.vgv + comPermuta.vgvPermutaResidencial + comPermuta.vgvPermutaNaoResidencial, 0,
  );
});

test('#568: estressar CUSTO ou PERMUTA não reprecifica o catálogo — só a variável "preco"', () => {
  const base = calcularProforma({ ...ESTUDO_SENSIBILIDADE, produtos: PRODUTOS_SENSIBILIDADE });
  for (const variavel of ['custo_obras', 'custo_infra', 'permuta_fisica', 'permuta_financeira'] as const) {
    const p = calcularProforma({
      ...ESTUDO_SENSIBILIDADE, produtos: PRODUTOS_SENSIBILIDADE,
      sensibilidade: { variavel, fator: 1.5 },
    });
    assert.equal(p.vgv.toFixed(2), base.vgv.toFixed(2), `${variavel} moveu o VGV do catálogo`);
  }
  // ...e o custo de obras respondeu ao seu próprio fator (o stress não virou
  // um no-op inteiro — critério 2 da issue).
  const obras = calcularProforma({
    ...ESTUDO_SENSIBILIDADE, produtos: PRODUTOS_SENSIBILIDADE,
    sensibilidade: { variavel: 'custo_obras', fator: 1.5 },
  });
  assert.ok(perto(obras.construcao, base.construcao * 1.5, 0.02), `construcao=${obras.construcao}`);
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
  // #571: preço/catálogo positivos aqui — margem nunca é `null` neste caso.
  assert.notEqual(margem, null);
  assert.ok(perto(margem!, piso, 0.05), `margem no preço sugerido=${margem}`);
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

// #571: a asserção final dizia "margemLiquidaPct = 0" — a mesma confusão que
// a #571 corrige em toda a tela. vgv 0 é "sem base", não "margem zero"; o
// motor agora devolve `null`.
test('#407: o MESMO estudo sem `produtos` no payload cai em vgv 0 — a causa do "—"', () => {
  const { produtos, ...semProdutos } = SO_CATALOGO;
  const p = calcularProforma(semProdutos as ProformaInput);
  assert.equal(p.vgv, 0);
  assert.equal(p.margemLiquidaPct, null);
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

// #570: o modo tem que ser o m² ABSOLUTO aqui. Com o % incidindo sobre a área
// do catálogo da categoria, "100%" passou a valer exatamente o VGV bruto dela —
// nunca mais que ele —, e o cap deixou de ser alcançável por esse caminho. Quem
// ainda pode exceder é o m² digitado (este caso), o valor canônico e o fator de
// sensibilidade. O excedente medido é o mesmo do print: pede-se a área inteira
// sobre um catálogo que tem metade dela.
test('permuta física maior que a base: a efetiva é capada, o VGV para em zero e o aviso liga', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: AREA_PERMUTA_PRINT, preco_venda_m2_residencial: PRECO_PRINT,
    // Base menor que a permuta: metade da área do teste acima.
    produtos: [{ area_media_m2: AREA_PERMUTA_PRINT / 2, preco_venda_m2: PRECO_PRINT, unidades: 1 }],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: AREA_PERMUTA_PRINT,
  });
  assert.equal(p.permutaCapada, true, 'o excedente tem que ser sinalizado');
  assert.ok(perto(p.vgvPermutaSolicitada, VGV_PRINT), `solicitada=${p.vgvPermutaSolicitada}`);
  assert.ok(perto(p.vgvPermutaResidencial, VGV_PRINT / 2), `efetiva=${p.vgvPermutaResidencial}`);
  assert.equal(p.vgv, 0, `vgv=${p.vgv}`);
  assert.ok(p.vgv >= 0, 'o VGV nunca pode ficar negativo');
  // #571: este é exatamente o estado VIVO que a issue #571 mirava — catálogo
  // presente (`semProdutos: false`, a Proforma mostra a tabela) e vgv=0 pela
  // permuta capada, não por ausência de catálogo. Os três indicadores "% VGV"
  // têm que sair `null` (indefinido), nunca 0 — 0 renderizaria "0,0%" na tela
  // em vez de "—". Mutação: trocar qualquer `null` de volta para 0 em
  // `proforma.ts` derruba uma destas três linhas.
  assert.equal(p.semProdutos, false, 'catálogo presente — não é o caso "sem produtos"');
  assert.equal(p.margemLiquidaPct, null, 'sem VGV, não há margem sobre VGV para medir');
  assert.equal(p.custoObrasVgvPct, null, 'sem VGV, não há custo/VGV para medir');
  assert.equal(p.receitaLiquidaSobreVgvPct, null, 'sem VGV, não há receita líquida/VGV para medir');
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

// ⚠️ DECISÃO #570 — o cap é POR CATEGORIA, e este par de testes é a prova.
//
// Antes, o cap era global (a soma das duas permutas contra a soma do catálogo)
// e o corte, proporcional entre R e NR. Com bases separadas isso deixaria o
// excedente de uma categoria comendo o VGV da outra — e `vgvNaoResidencial`
// deixaria de ser a base que a permuta financeira NR precisa.
test('#570: cada categoria capa na PRÓPRIA base — as duas excedendo, cada uma para em zero', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 4 },   // R:  400 m², 4M
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 2, tipo: 'nao_residencial' }, // NR: 200 m², 1,6M
    ],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 600,        // R:  600 × 10.000 = 6M > 4M
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 250,  // NR: 250 ×  8.000 = 2M > 1,6M
  });
  assert.equal(p.permutaCapada, true);
  assert.ok(perto(p.vgvPermutaSolicitada, 8_000_000), `solicitada=${p.vgvPermutaSolicitada}`);
  // Cada uma capa no próprio VGV bruto — nada de fator proporcional comum.
  assert.ok(perto(p.vgvPermutaResidencial, 4_000_000), `R=${p.vgvPermutaResidencial}`);
  assert.ok(perto(p.vgvPermutaNaoResidencial, 1_600_000), `NR=${p.vgvPermutaNaoResidencial}`);
  assert.equal(p.vgvResidencial, 0);
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.vgv, 0);
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.ok(perto(vgvBruto, 5_600_000), `vgvBruto=${vgvBruto}`);
});

// O caso que separa as duas regras: SÓ o NR excede. Sob o cap global antigo, o
// corte proporcional teria mordido também a permuta residencial (e, com o VGV
// em bucket único, o excedente NR sairia do VGV residencial). Aqui o VGV
// residencial não sente nada.
test('#570: excedente de UMA categoria não come o VGV da outra', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 4 },   // R:  400 m², 4M
      { area_media_m2: 100, preco_venda_m2: 8000, unidades: 2, tipo: 'nao_residencial' }, // NR: 200 m², 1,6M
    ],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 100,        // R:  1M, cabe nos 4M
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 250,  // NR: 2M, excede os 1,6M
  });
  assert.equal(p.permutaCapada, true, 'o excedente do NR tem que ligar o aviso');
  assert.ok(perto(p.vgvPermutaResidencial, 1_000_000), `R=${p.vgvPermutaResidencial}`);
  assert.ok(perto(p.vgvPermutaNaoResidencial, 1_600_000), `NR capado na própria base=${p.vgvPermutaNaoResidencial}`);
  // A prova: o VGV residencial é 4M − 1M, intocado pelo excedente do NR.
  assert.ok(perto(p.vgvResidencial, 3_000_000), `vgvR=${p.vgvResidencial}`);
  assert.equal(p.vgvNaoResidencial, 0, 'a categoria capada é a que para em zero');
  assert.ok(perto(p.vgv, 3_000_000), `vgv=${p.vgv}`);
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
// O caso histórico do #563 era o corte PROPORCIONAL sobre um cap global: com
// base de R$ 0,01 e as duas permutas pedindo o mesmo, o fator 0,5 dava R$ 0,005
// em cada, que subia para R$ 0,01 nas duas — R$ 0,02 de permuta sobre uma base
// de R$ 0,01, o dobro. O cap por categoria (#570) apagou o fator proporcional,
// mas a exigência continua a mesma e é ela que se afere aqui: cada VGV é o
// RESÍDUO da sua base quantizada menos a sua permuta quantizada, então as duas
// identidades por categoria fecham EXATAMENTE, com entradas de fração de
// centavo dos dois lados.
test('cap com meio centavo: a identidade fecha EXATAMENTE em cada categoria, sem resíduo', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    // Base de exatamente R$ 0,005 em cada categoria — meio centavo, o valor que
    // arredonda para cima e produzia o resíduo.
    produtos: [
      { area_media_m2: 1, preco_venda_m2: 0.005, unidades: 1 },
      { area_media_m2: 1, preco_venda_m2: 0.005, unidades: 1, tipo: 'nao_residencial' },
    ],
    // Permuta de 4 m² em cada lado: R$ 0,02 pedidos sobre R$ 0,005 de base. O
    // excedente é real AO CENTAVO (0,02 > 0,01), que é o limiar do aviso — a
    // comparação é quantizada de propósito, para excedente de meio centavo não
    // virar ruído na tela.
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 4,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 4,
  });
  assert.equal(p.permutaCapada, true);
  assert.equal(p.vgv, 0);
  // As duas identidades por categoria, cada uma ao centavo.
  assert.equal(p.vgvResidencial + p.vgvPermutaResidencial, 0.01,
    `R: ${p.vgvResidencial} + ${p.vgvPermutaResidencial}`);
  assert.equal(p.vgvNaoResidencial + p.vgvPermutaNaoResidencial, 0.01,
    `NR: ${p.vgvNaoResidencial} + ${p.vgvPermutaNaoResidencial}`);
  // E o total: R$ 0,02 de base, não R$ 0,04.
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.equal(vgvBruto, 0.02, `vgvBruto=${vgvBruto} (o dobro seria o resíduo)`);
  // E cada parcela continua sendo um valor de 2 casas.
  for (const v of [p.vgv, p.vgvPermutaResidencial, p.vgvPermutaNaoResidencial]) {
    assert.equal(Math.round(v * 100) / 100, v, `parcela fora do contrato de 2 casas: ${v}`);
  }
});

test('a identidade fecha ao centavo mesmo SEM cap, com parcelas de fração de centavo', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    // Preço de fração de centavo nas duas categorias, base folgada: a permuta
    // de 1 m² vale R$ 0,333 de cada lado e nenhuma das duas capa.
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 0.333, unidades: 1 },
      { area_media_m2: 100, preco_venda_m2: 0.333, unidades: 1, tipo: 'nao_residencial' },
    ],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 1,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 1,
  });
  assert.equal(p.permutaCapada, false);
  assert.equal(p.vgvResidencial + p.vgvPermutaResidencial, 33.3, `R=${p.vgvResidencial}`);
  assert.equal(p.vgvNaoResidencial + p.vgvPermutaNaoResidencial, 33.3, `NR=${p.vgvNaoResidencial}`);
  const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  assert.equal(vgvBruto, 66.6, `vgvBruto=${vgvBruto}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// #570 — as duas permutas incidem sobre o total da SUA categoria no catálogo
//
// Antes desta issue o catálogo era um bucket único: `vgvNaoResidencial` saía
// sempre 0 (e a permuta financeira NR, em % de zero, não deduzia nada), e a
// permuta física era medida e valorada pelos campos LEGADOS de área e preço —
// os mesmos que a reestruturação do Preliminar tirou da tela. O motor calculava
// a receita de um projeto e a permuta de outro.
//
// ⚠️ Todo fixture abaixo põe os campos legados em valores ABSURDOS de propósito
// (área 9.999 m², preço R$ 1,00/m²). Qualquer número que bata com eles é prova
// de que a fonte errada venceu — é essa a mutação que estes testes detectam.
const MISTO: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  area_pvt_r_fechada: 9999, preco_venda_m2_residencial: 1,
  area_pvt_nr_fechada: 7777, preco_venda_m2_nao_residencial: 2,
  produtos: [
    { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 6 },  // R (default): 600 m², 6,0M
    { area_media_m2: 50, preco_venda_m2: 12_000, unidades: 8 },   // R (default): 400 m², 4,8M
    { area_media_m2: 200, preco_venda_m2: 5_000, unidades: 5, tipo: 'nao_residencial' }, // NR: 1.000 m², 5,0M
  ],
};
// R: 1.000 m², R$ 10.800.000, preço médio ponderado 10.800/m², 14 unidades.
// NR: 1.000 m², R$ 5.000.000, preço médio 5.000/m², 5 unidades.

test('#570 totaisPorTipoProdutos: VGV, unidades, área e preço médio de cada categoria', () => {
  const t = totaisPorTipoProdutos(MISTO.produtos);
  assert.ok(perto(t.residencial.vgv, 10_800_000), `R.vgv=${t.residencial.vgv}`);
  assert.equal(t.residencial.unidades, 14);
  assert.ok(perto(t.residencial.areaTotalM2, 1000), `R.area=${t.residencial.areaTotalM2}`);
  // Ponderado pela ÁREA (10,8M ÷ 1.000), não a média simples de 10.000 e 12.000.
  assert.ok(perto(t.residencial.precoMedioM2!, 10_800), `R.preco=${t.residencial.precoMedioM2}`);
  assert.ok(perto(t.nao_residencial.vgv, 5_000_000), `NR.vgv=${t.nao_residencial.vgv}`);
  assert.equal(t.nao_residencial.unidades, 5);
  assert.ok(perto(t.nao_residencial.areaTotalM2, 1000));
  assert.ok(perto(t.nao_residencial.precoMedioM2!, 5_000));
});

test('#570 areaTotalProdutos: Σ área média × unidades, e lista vazia/ausente devolve 0', () => {
  assert.ok(perto(areaTotalProdutos(MISTO.produtos), 2000), `area=${areaTotalProdutos(MISTO.produtos)}`);
  assert.equal(areaTotalProdutos([]), 0);
  assert.equal(areaTotalProdutos(undefined), 0);
  // Coluna vazia é 0, não NaN — `Number(null)` é 0, `Number(undefined)` é NaN.
  assert.equal(areaTotalProdutos([{ area_media_m2: null, unidades: undefined }]), 0);
});

test('#570 totaisPorTipoProdutos: categoria vazia devolve preço null (nunca 0)', () => {
  const t = totaisPorTipoProdutos([{ area_media_m2: 100, preco_venda_m2: 1_000, unidades: 2 }]);
  assert.ok(perto(t.residencial.vgv, 200_000));
  assert.equal(t.nao_residencial.vgv, 0);
  assert.equal(t.nao_residencial.areaTotalM2, 0);
  assert.equal(t.nao_residencial.precoMedioM2, null, 'preço 0 pareceria "vende de graça"');
});

// ⚠️ Contrato deliberado, e o oposto do de `resumoCatalogoProdutos`: esta
// função NÃO filtra — quem filtra é `calcularProforma`, uma vez, ANTES de
// reprecificar pelo fator de sensibilidade (#568). Refiltrar depois da
// reprecificação faria um fator 0 zerar os preços, derrubar as linhas no filtro
// e a categoria perder suas unidades só naquele cenário. O teste da interação
// #568×#570, no fim deste bloco, é o que mede essa consequência.
test('#570 totaisPorTipoProdutos NÃO filtra — quem filtra é o motor, e a composição é explícita', () => {
  // Linha com área e unidades mas SEM preço: não compõe catálogo, e sem filtro
  // ela puxa o preço médio ponderado da categoria para baixo.
  const comIncompleta = [
    { area_media_m2: 100, preco_venda_m2: 1_000, unidades: 2 },   // 200 m², 200.000
    { area_media_m2: 100, preco_venda_m2: null, unidades: 2 },    // 200 m², zero
  ];
  const cru = totaisPorTipoProdutos(comIncompleta);
  assert.ok(perto(cru.residencial.areaTotalM2, 400), `área crua=${cru.residencial.areaTotalM2}`);
  assert.ok(perto(cru.residencial.precoMedioM2!, 500), `preço cru=${cru.residencial.precoMedioM2}`);
  // A composição com `catalogoEfetivo` é o que descreve o CADASTRO.
  const efetivo = totaisPorTipoProdutos(catalogoEfetivo(comIncompleta));
  assert.ok(perto(efetivo.residencial.areaTotalM2, 200), `área efetiva=${efetivo.residencial.areaTotalM2}`);
  assert.ok(perto(efetivo.residencial.precoMedioM2!, 1_000), `preço efetivo=${efetivo.residencial.precoMedioM2}`);
  assert.equal(totaisPorTipoProdutos(undefined).residencial.vgv, 0);
});

test('#570 critério 1: o VGV de cada categoria sai do `tipo` de cada produto', () => {
  const p = calcularProforma(MISTO);
  assert.ok(perto(p.vgvResidencial, 10_800_000), `vgvR=${p.vgvResidencial}`);
  assert.ok(perto(p.vgvNaoResidencial, 5_000_000), `vgvNR=${p.vgvNaoResidencial}`);
  assert.ok(perto(p.vgv, 15_800_000), `vgv=${p.vgv}`);
  // O detalhe por tipo acompanha — antes contava as 19 unidades em Residencial
  // e mostrava preço médio NR zerado ao lado de um VGV NR que existia.
  assert.equal(p.numUnidadesResidencial, 14);
  assert.equal(p.numUnidadesNaoResidencial, 5);
  assert.ok(perto(p.precoMedioUnidadeResidencial, 10_800_000 / 14), `pmR=${p.precoMedioUnidadeResidencial}`);
  assert.ok(perto(p.precoMedioUnidadeNaoResidencial, 1_000_000), `pmNR=${p.precoMedioUnidadeNaoResidencial}`);
});

test('#570 critério 2: o modo "% área venda" incide sobre a ÁREA da categoria no catálogo', () => {
  const p = calcularProforma({
    ...MISTO,
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,       // 10% de 1.000 m² = 100
    permuta_fisica_nr_modo: 'pct_area_venda', permuta_fisica_nr_pct: 20, // 20% de 1.000 m² = 200
  });
  // A base publicada pelo motor é a do catálogo, não `area_pvt_*_fechada`.
  assert.ok(perto(p.areaBasePermutaResidencial, 1000), `baseR=${p.areaBasePermutaResidencial}`);
  assert.ok(perto(p.areaBasePermutaNaoResidencial, 1000), `baseNR=${p.areaBasePermutaNaoResidencial}`);
  // 10% de 9.999 seria 999,9 m² — o número que a fonte legada produziria.
  assert.ok(perto(p.areaPermutaResidencial, 100), `areaR=${p.areaPermutaResidencial}`);
  assert.ok(perto(p.areaPermutaNaoResidencial, 200), `areaNR=${p.areaPermutaNaoResidencial}`);
});

test('#570 critério 4: a permuta física é valorada pelo preço médio da SUA categoria', () => {
  const p = calcularProforma({
    ...MISTO,
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 100,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 200,
  });
  // 100 m² × 10.800 (média ponderada de R), não × R$ 1,00 do campo legado.
  assert.ok(perto(p.vgvPermutaResidencial, 1_080_000), `permR=${p.vgvPermutaResidencial}`);
  // 200 m² × 5.000 (NR), não × R$ 2,00 do campo legado.
  assert.ok(perto(p.vgvPermutaNaoResidencial, 1_000_000), `permNR=${p.vgvPermutaNaoResidencial}`);
  assert.ok(perto(p.vgvPermutaSolicitada, 2_080_000), `solicitada=${p.vgvPermutaSolicitada}`);
  assert.equal(p.permutaCapada, false);
  // Cada VGV líquido da sua permuta; as duas identidades fecham.
  assert.ok(perto(p.vgvResidencial, 10_800_000 - 1_080_000), `vgvR=${p.vgvResidencial}`);
  assert.ok(perto(p.vgvNaoResidencial, 5_000_000 - 1_000_000), `vgvNR=${p.vgvNaoResidencial}`);
  assert.ok(perto(p.vgvResidencial + p.vgvPermutaResidencial, 10_800_000));
  assert.ok(perto(p.vgvNaoResidencial + p.vgvPermutaNaoResidencial, 5_000_000));
  assert.ok(perto(p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial, 15_800_000));
});

// O defeito nominal do item 3 da planilha: a % de permuta financeira NR incidia
// sobre `vgvNaoResidencial`, que era zero por construção — o campo existia na
// tela, aceitava valor, e não deduzia nada.
test('#570 critério 3: a permuta financeira de cada tipo incide sobre o VGV da SUA categoria', () => {
  const p = calcularProforma({
    ...MISTO,
    permuta_financeira_residencial_pct: 5,      // 5% de 10,8M = 540.000
    permuta_financeira_nao_residencial_pct: 10, // 10% de 5,0M = 500.000 (antes: 0)
  });
  assert.ok(perto(p.permutaFinResidencial, 540_000), `finR=${p.permutaFinResidencial}`);
  assert.ok(perto(p.permutaFinNaoResidencial, 500_000), `finNR=${p.permutaFinNaoResidencial}`);
  // E as duas chegam à receita líquida.
  const semPermutas = calcularProforma(MISTO);
  assert.ok(perto(semPermutas.receitaLiquida - p.receitaLiquida, 1_040_000),
    `dif=${semPermutas.receitaLiquida - p.receitaLiquida}`);
});

test('#570 cap por categoria — fronteira: permuta que vale EXATAMENTE a base não é excedente', () => {
  const p = calcularProforma({
    ...MISTO,
    // 1.000 m² de R = a área inteira da categoria; 1.000 m² de NR, idem.
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 1000,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 1000,
  });
  assert.equal(p.permutaCapada, false, 'igual à base não é excedente (">", não ">=")');
  assert.ok(perto(p.vgvPermutaResidencial, 10_800_000));
  assert.ok(perto(p.vgvPermutaNaoResidencial, 5_000_000));
  assert.equal(p.vgvResidencial, 0);
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.vgv, 0);
});

test('#570 cap por categoria — um m² a mais em UMA categoria já liga o aviso', () => {
  const p = calcularProforma({
    ...MISTO,
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 1001,      // excede R
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 900, // cabe em NR
  });
  assert.equal(p.permutaCapada, true);
  assert.ok(perto(p.vgvPermutaResidencial, 10_800_000), 'capado na base de R');
  assert.ok(perto(p.vgvPermutaNaoResidencial, 900 * 5_000), 'NR não é tocado pelo excedente de R');
  assert.equal(p.vgvResidencial, 0);
  assert.ok(perto(p.vgvNaoResidencial, 5_000_000 - 4_500_000), `vgvNR=${p.vgvNaoResidencial}`);
});

test('#570: estudo só residencial e estudo só não residencial', () => {
  const soR = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 }],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,
    permuta_financeira_nao_residencial_pct: 50, // sem base NR: não deduz nada
  });
  assert.ok(perto(soR.vgvResidencial, 9_000_000), `soR.vgvR=${soR.vgvResidencial}`);
  assert.equal(soR.vgvNaoResidencial, 0);
  assert.equal(soR.permutaFinNaoResidencial, 0, 'sem catálogo NR não há base para deduzir');
  assert.equal(soR.numUnidadesNaoResidencial, 0);

  const soNR = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10, tipo: 'nao_residencial' }],
    permuta_fisica_nr_modo: 'pct_area_venda', permuta_fisica_nr_pct: 10,
    permuta_financeira_residencial_pct: 50, // sem base R: não deduz nada
  });
  assert.equal(soNR.vgvResidencial, 0);
  assert.ok(perto(soNR.vgvNaoResidencial, 9_000_000), `soNR.vgvNR=${soNR.vgvNaoResidencial}`);
  assert.equal(soNR.permutaFinResidencial, 0);
  assert.equal(soNR.numUnidadesResidencial, 0);
  assert.equal(soNR.numUnidadesNaoResidencial, 10);
  // A permuta física do tipo ausente não vale nada: não há estoque daquela
  // categoria para entregar, e a área informada segue exibida como informada.
  const soRcomPermutaNR = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 }],
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8_000, // legado, ignorado
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 50,
  });
  assert.ok(perto(soRcomPermutaNR.areaPermutaNaoResidencial, 50), 'a área informada não é reescrita');
  assert.equal(soRcomPermutaNR.vgvPermutaNaoResidencial, 0, 'sem catálogo NR, a permuta NR vale zero');
  assert.ok(perto(soRcomPermutaNR.vgv, 10_000_000), 'e não pode sair do VGV residencial');
});

test('#570: produto LEGADO (sem `tipo`) conta como Residencial no cálculo, não fica de fora', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 },                 // sem `tipo`
      { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10, tipo: 'residencial' },
      { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10, tipo: 'lixo' as any }, // fora do domínio
    ],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,
  });
  // As três linhas na mesma categoria: 3.000 m², R$ 30M, 30 unidades.
  assert.ok(perto(p.areaBasePermutaResidencial, 3000), `base=${p.areaBasePermutaResidencial}`);
  assert.ok(perto(p.vgvPermutaResidencial, 3_000_000), `permR=${p.vgvPermutaResidencial}`); // 300 m² × 10.000
  assert.ok(perto(p.vgvResidencial, 27_000_000), `vgvR=${p.vgvResidencial}`);
  assert.equal(p.vgvNaoResidencial, 0);
  assert.equal(p.numUnidadesResidencial, 30);
});

// A outra metade do contrato: SEM catálogo efetivo nada muda. O estudo não tem
// receita modelada (`semProdutos`) e as bases legadas continuam sendo as de
// antes — é a mesma decisão do #315, sem fallback em nenhum dos dois sentidos.
test('#570: estudo SEM catálogo mantém as bases legadas, intocadas', () => {
  const inc = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10_000,
    area_pvt_nr_fechada: 500, preco_venda_m2_nao_residencial: 8_000,
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,
    permuta_fisica_nr_modo: 'pct_area_venda', permuta_fisica_nr_pct: 10,
  });
  assert.equal(inc.semProdutos, true);
  assert.ok(perto(inc.areaBasePermutaResidencial, 1000), `baseR=${inc.areaBasePermutaResidencial}`);
  assert.ok(perto(inc.areaBasePermutaNaoResidencial, 500), `baseNR=${inc.areaBasePermutaNaoResidencial}`);
  assert.ok(perto(inc.areaPermutaResidencial, 100));
  assert.ok(perto(inc.areaPermutaNaoResidencial, 50));
  // Valorada pelos preços legados: 100×10.000 + 50×8.000 = 1,4M pedidos, todos
  // capados contra a base zero do catálogo inexistente — o comportamento que a
  // #563 fixou e esta issue não move.
  assert.ok(perto(inc.vgvPermutaSolicitada, 1_400_000), `solicitada=${inc.vgvPermutaSolicitada}`);
  assert.equal(inc.vgv, 0);
  assert.equal(inc.permutaCapada, true);

  const lot = calcularProforma({ ...LOT, produtos: [], permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 3000 });
  assert.equal(lot.semProdutos, true);
  // Loteamento sem catálogo: a base é a área vendável da cascata, como sempre.
  assert.ok(perto(lot.areaBasePermutaResidencial, 75_000), `lot.base=${lot.areaBasePermutaResidencial}`);
  assert.equal(lot.areaBasePermutaNaoResidencial, 0, 'Loteamento não tem categoria NR');
  assert.ok(perto(lot.vgvPermutaSolicitada, 3_000_000), '3.000 m² × R$ 1.000 legado');
});

// ⚠️ No Loteamento as duas bases vêm de fontes DIFERENTES, e é de propósito
// (#574): a ÁREA do modo "% área venda" é a ALV da cascata — o loteador entrega
// uma fração da área loteável, que é grandeza do TERRENO —, e o PREÇO que valora
// os m² entregues é o do catálogo. A troca de base da área é semântica da
// Incorporação (critério 2 da #570) e não atravessa para cá.
test('#570/#574: Loteamento — a base da ÁREA é a ALV da cascata; o PREÇO é o do catálogo', () => {
  // Catálogo deliberadamente diferente da área vendável da cascata (75.000 m²)
  // e do preço legado (R$ 1.000): 200 lotes de 250 m² a R$ 1.200.
  const p = calcularProforma({
    ...LOT,
    produtos: [{ area_media_m2: 250, preco_venda_m2: 1200, unidades: 200 }], // 50.000 m², 60M
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,
  });
  // A base da ÁREA é a ALV (75.000), não os 50.000 m² do catálogo.
  assert.ok(perto(p.areaBasePermutaResidencial, 75_000), `base=${p.areaBasePermutaResidencial}`);
  assert.ok(perto(p.areaPermutaResidencial, 7_500), `area=${p.areaPermutaResidencial}`);
  // O PREÇO é o do catálogo: 7.500 × R$ 1.200 (e não × R$ 1.000 do campo legado).
  assert.ok(perto(p.vgvPermutaResidencial, 9_000_000), `permuta=${p.vgvPermutaResidencial}`);
  assert.ok(perto(p.vgvResidencial, 51_000_000), `vgvR=${p.vgvResidencial}`);
  assert.equal(p.vgvNaoResidencial, 0, 'Loteamento não tem NR: nem permuta, nem VGV de categoria');
  assert.ok(perto(p.areaVendavel, 75_000), `areaVendavel=${p.areaVendavel}`);
});

// #574 (auditoria do Loteamento, medida na `main` SEM este diff): lá a permuta
// física do Loteamento é valorada por `precoLot = n(e.preco_venda_m2)`, e
// `estudos.preco_venda_m2` NÃO tem campo em tela nenhuma nem `padrao` no
// schema — então em Loteamento NOVO a permuta reduzia a área e **não** reduzia
// o VGV. O fixture `LOT` declara `preco_venda_m2: 1000`, e foi exatamente por
// isso que o defeito atravessou as suítes: nenhum caso exercia a ausência.
test('#574: Loteamento com catálogo e SEM `preco_venda_m2` — a permuta física deduz do VGV', () => {
  const { preco_venda_m2: _semPrecoLegado, ...semPreco } = LOT;
  assert.equal((semPreco as ProformaInput).preco_venda_m2, undefined,
    'o fixture deste teste precisa NÃO ter o campo legado');
  const p = calcularProforma({
    ...(semPreco as ProformaInput),
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1_000, unidades: 250 }], // 75.000 m², 75M
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 7_500,
  });
  // Na `main` isto daria permuta ZERO (7.500 × preço legado ausente = 0) e o
  // VGV sairia inteiro, com a área permutada reduzindo só a área líquida.
  assert.ok(perto(p.vgvPermutaResidencial, 7_500_000), `permuta=${p.vgvPermutaResidencial}`);
  assert.ok(perto(p.vgvResidencial, 67_500_000), `vgvR=${p.vgvResidencial}`);
  assert.ok(perto(p.vgv, 67_500_000), `vgv=${p.vgv}`);
  assert.ok(perto(p.areaVendavelLiquida, 67_500), `liq=${p.areaVendavelLiquida}`);
  // Sem catálogo o comportamento continua o da `main` (sem fallback): o
  // residual do achado é issue própria, não deste PR.
  const semCatalogo = calcularProforma({ ...(semPreco as ProformaInput), produtos: [],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 7_500 });
  assert.equal(semCatalogo.semProdutos, true);
  assert.equal(semCatalogo.vgvPermutaSolicitada, 0, 'sem catálogo, o preço legado ausente segue valendo zero');
  assert.equal(semCatalogo.vgv, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// #568 × #570 — o PONTO DE ENCONTRO dos dois PRs
//
// Os dois reescrevem o mesmo trecho do motor, e a ordem em que as operações
// acontecem é o contrato entre eles:
//
//   catalogoEfetivo → aplicarFatorPreco (fator clampado em 0 na fonte)
//                   → totaisPorTipoProdutos (SEM refiltrar) → permutas/cap por categoria
//
// O que este teste mede, e que nenhum dos dois PRs media sozinho: sob stress, a
// base e a permuta física de CADA categoria escalam JUNTAS, porque o preço médio
// da categoria sai do catálogo JÁ reprecificado. Se a reprecificação não chegar
// ao caminho por categoria (ou chegar duas vezes), a permuta passa a escalar em
// ritmo diferente da própria base e as duas identidades do cap deixam de fechar.
test('#568×#570: sob o cenário Bear, as duas identidades de cap fecham e cada VGV escala pelo fator', () => {
  const MISTO_STRESS: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    // Legados absurdos: se algum aparecer no resultado, a fonte errada venceu.
    area_pvt_r_fechada: 9999, preco_venda_m2_residencial: 1,
    area_pvt_nr_fechada: 7777, preco_venda_m2_nao_residencial: 2,
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 },  // R: 1.000 m², 10,0M
      { area_media_m2: 100, preco_venda_m2: 5_000, unidades: 4, tipo: 'nao_residencial' }, // NR: 400 m², 2,0M
    ],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 100,       // R: 100 m²
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 200, // NR: 200 m²
  };
  const base = calcularProforma(MISTO_STRESS);
  const bear = calcularProforma({ ...MISTO_STRESS, sensibilidade: { variavel: 'preco', fator: FATOR_BEAR } });

  // 1. O VGV bruto de CADA categoria escala pelo fator — não só o total.
  const brutoR = (p: typeof base) => p.vgvResidencial + p.vgvPermutaResidencial;
  const brutoNR = (p: typeof base) => p.vgvNaoResidencial + p.vgvPermutaNaoResidencial;
  assert.ok(perto(brutoR(base), 10_000_000), `brutoR base=${brutoR(base)}`);
  assert.ok(perto(brutoNR(base), 2_000_000), `brutoNR base=${brutoNR(base)}`);
  assert.ok(perto(brutoR(bear), 10_000_000 * FATOR_BEAR), `brutoR bear=${brutoR(bear)}`);
  assert.ok(perto(brutoNR(bear), 2_000_000 * FATOR_BEAR), `brutoNR bear=${brutoNR(bear)}`);

  // 2. A permuta de cada categoria escala pelo MESMO fator, uma vez só. Duas
  //    vezes (fator ao quadrado) daria 810.000 em R — o defeito que a
  //    reconciliação evita ao não reaplicar `fatorSens('preco')` sobre
  //    `precoMedioM2`, que já vem do catálogo reprecificado.
  assert.ok(perto(base.vgvPermutaResidencial, 1_000_000), `permR base=${base.vgvPermutaResidencial}`);
  assert.ok(perto(bear.vgvPermutaResidencial, 1_000_000 * FATOR_BEAR), `permR bear=${bear.vgvPermutaResidencial}`);
  assert.ok(perto(bear.vgvPermutaNaoResidencial, 1_000_000 * FATOR_BEAR), `permNR bear=${bear.vgvPermutaNaoResidencial}`);

  // 3. As DUAS identidades de cap fecham ao centavo DENTRO do cenário.
  assert.equal(bear.vgvResidencial + bear.vgvPermutaResidencial, 9_000_000);
  assert.equal(bear.vgvNaoResidencial + bear.vgvPermutaNaoResidencial, 1_800_000);
  assert.equal(bear.vgv, bear.vgvResidencial + bear.vgvNaoResidencial);
  assert.equal(bear.permutaCapada, false, 'nenhuma categoria excede no cenário');

  // 4. O cap não muda de veredito por causa do cenário: a proporção
  //    permuta ÷ base é a mesma nos dois, porque as duas escalam juntas.
  assert.ok(perto(base.vgvPermutaResidencial / brutoR(base), bear.vgvPermutaResidencial / brutoR(bear)),
    'a proporção da permuta mudou de cenário — base e permuta não escalaram juntas');

  // 5. A consequência de NÃO refiltrar depois de reprecificar (#568): com fator
  //    0 todo preço vira 0, e um refiltro derrubaria as linhas — a contagem por
  //    categoria zeraria enquanto `numUnidades` continuaria certo.
  const zerado = calcularProforma({ ...MISTO_STRESS, sensibilidade: { variavel: 'preco', fator: 0 } });
  assert.equal(zerado.vgv, 0);
  assert.equal(zerado.numUnidades, 14);
  assert.equal(zerado.numUnidadesResidencial, 10, 'a categoria perdeu suas unidades no cenário');
  assert.equal(zerado.numUnidadesNaoResidencial, 4, 'a categoria perdeu suas unidades no cenário');
  assert.equal(zerado.semProdutos, false, '`semProdutos` é fato cadastral, não do cenário');
});

// ─────────────────────────────────────────────────────────────────────────────
// Rodada 1 de revisão do PR 607 — o Loteamento não tem categoria NR
//
// O defeito: a separação por categoria movia para o bucket NR o produto que
// alguém marcasse "Não Residencial" no grid — mas a tela de Permutas do
// Loteamento só expõe os controles RESIDENCIAIS (física e financeira), e
// `areaBasePermutaNaoResidencial` é zero por construção no Loteamento. O
// produto sumia da única base editável: a permuta física passava a ignorá-lo e
// o % financeiro incidia só sobre o VGV residencial remanescente. Dedução
// subestimada, sem nada na tela dizendo por quê.
test('rev1: no Loteamento, produto marcado "não residencial" continua na base das duas permutas', () => {
  const p = calcularProforma({
    ...LOT,
    // Área do catálogo (45.000 m²) DIFERENTE da ALV da cascata (75.000 m²), de
    // propósito: assim a asserção da base não fica ambígua entre as duas fontes.
    produtos: [
      { area_media_m2: 300, preco_venda_m2: 1_000, unidades: 100 },  // 30.000 m², 30M
      // Marcado NR no grid. No Loteamento isso não pode mudar conta nenhuma.
      { area_media_m2: 300, preco_venda_m2: 1_000, unidades: 50, tipo: 'nao_residencial' }, // 15.000 m², 15M
    ],
    permuta_fisica_modo: 'pct_area_venda', permuta_fisica_pct: 10,
    permuta_financeira_residencial_pct: 10,
  });
  // 1. O VGV inteiro fica no bucket residencial — o único que a tela edita.
  assert.ok(perto(p.vgvResidencial + p.vgvPermutaResidencial, 45_000_000), `brutoR=${p.vgvResidencial}`);
  assert.equal(p.vgvNaoResidencial, 0, 'Loteamento não tem categoria NR');
  assert.equal(p.vgvPermutaNaoResidencial, 0);
  // 2. A base da ÁREA é a ALV da cascata (#574), não a área do catálogo.
  assert.ok(perto(p.areaBasePermutaResidencial, 75_000), `base=${p.areaBasePermutaResidencial}`);
  assert.ok(perto(p.areaPermutaResidencial, 7_500), `área=${p.areaPermutaResidencial}`);
  // 3. O PREÇO é o médio do catálogo INTEIRO (45M ÷ 45.000 = 1.000), não o das
  //    linhas residenciais só. 7.500 × 1.000 = 7,5M.
  assert.ok(perto(p.vgvPermutaResidencial, 7_500_000), `permuta=${p.vgvPermutaResidencial}`);
  // 4. E o % financeiro incide sobre o VGV inteiro, líquido da permuta:
  //    10% de (45M − 7,5M). Sem a normalização seriam 10% de (30M − 7,5M).
  assert.ok(perto(p.vgv, 37_500_000), `vgv=${p.vgv}`);
  assert.ok(perto(p.permutaFinResidencial, 3_750_000), `finR=${p.permutaFinResidencial}`);
  // 5. E a contagem de unidades não se parte em duas.
  assert.equal(p.numUnidades, 150);
});

test('rev1: a normalização é SÓ do Loteamento — a Incorporação continua separando R de NR', () => {
  const produtos = [
    { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 },  // R: 1.000 m², 10M
    { area_media_m2: 100, preco_venda_m2: 5_000, unidades: 4, tipo: 'nao_residencial' }, // NR: 400 m², 2M
  ];
  const inc = calcularProforma({ tipo_empreendimento: 'incorporacao', produtos });
  assert.ok(perto(inc.vgvResidencial, 10_000_000), `incR=${inc.vgvResidencial}`);
  assert.ok(perto(inc.vgvNaoResidencial, 2_000_000), `incNR=${inc.vgvNaoResidencial}`);
  assert.equal(inc.numUnidadesNaoResidencial, 4);
  // O mesmo catálogo num Loteamento: um bucket só.
  const lot = calcularProforma({ ...LOT, produtos });
  assert.ok(perto(lot.vgvResidencial, 12_000_000), `lotR=${lot.vgvResidencial}`);
  assert.equal(lot.vgvNaoResidencial, 0);
});

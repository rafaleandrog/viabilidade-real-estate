import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areasParaTrocarDeTipo, pctAlvEfetivo, areaTotalDaLinha, areaMediaDaLinha, produtosComAreaDerivada,
  somaPctAlv, alocacaoAlv, validarSomaPctAlv, rotuloBaseProdutos,
} from './produtos-alv.js';
import { calcularProforma, produtosDoEstudo, alvDoLoteamento, baseProdutosM2, areaPrivativaFechadaIncorporacao, type ProformaInput } from './proforma.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// ALV de 75.000 m²: terreno 100.000 − 25% de viário público.
const BASE: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100000,
  area_viario_publico_modo: 'pct_poligonal',
  area_viario_publico_valor: 25,
};
const ALV = 75000;

test('#781: ALV do Loteamento de referência', () => {
  assert.ok(perto(alvDoLoteamento(BASE), ALV));
});

test('#781: área total = ALV × %; área média = área total ÷ unidades', () => {
  const p = { pct_alv: 40, unidades: 100 };
  assert.ok(perto(areaTotalDaLinha(p, ALV), 30000));
  assert.ok(perto(areaMediaDaLinha(p, ALV), 300));
});

test('#781: pct_alv chega como STRING do Postgres e continua valendo', () => {
  assert.ok(perto(areaTotalDaLinha({ pct_alv: '40.0000', unidades: 100 }, ALV), 30000));
});

test('#781: sem unidades a área média é 0, sem dividir por zero', () => {
  assert.equal(areaMediaDaLinha({ pct_alv: 40, unidades: 0 }, ALV), 0);
  assert.equal(areaMediaDaLinha({ pct_alv: 40, unidades: null }, ALV), 0);
});

test('#781: ALV ≤ 0 zera a área do produto por % — nenhum número negativo sai da derivação', () => {
  assert.equal(areaTotalDaLinha({ pct_alv: 40, unidades: 100 }, 0), 0);
  assert.equal(areaTotalDaLinha({ pct_alv: 40, unidades: 100 }, -500), 0);
});

test('#781: produto legado mantém a área mesmo sem ALV (estudo antigo não perde o VGV ao abrir)', () => {
  assert.equal(areaTotalDaLinha({ area_media_m2: 300, unidades: 250 }, 0), 75000);
  assert.equal(pctAlvEfetivo({ area_media_m2: 300, unidades: 250 }, 0), 0);
});

test('#781: produto LEGADO (sem pct_alv) deriva o % da área antiga e reproduz a mesma área', () => {
  const legado = { area_media_m2: 300, unidades: 250 }; // 75.000 m² = 100% da ALV
  assert.ok(perto(pctAlvEfetivo(legado, ALV), 100));
  assert.ok(perto(areaTotalDaLinha(legado, ALV), 75000));
  assert.ok(perto(areaMediaDaLinha(legado, ALV), 300));
  // pct_alv = 0 gravado NÃO é ausência: o zero é um valor.
  assert.equal(pctAlvEfetivo({ pct_alv: 0, area_media_m2: 300, unidades: 250 }, ALV), 0);
});

test('#781: soma e alocação — completa, falta, excesso, com tolerância', () => {
  const dois = [{ pct_alv: 60, unidades: 1 }, { pct_alv: 40, unidades: 1 }];
  assert.equal(somaPctAlv(dois, ALV), 100);
  assert.equal(alocacaoAlv(dois, ALV).estado, 'completa');
  assert.equal(alocacaoAlv([{ pct_alv: 60 }], ALV).estado, 'falta');
  assert.ok(perto(alocacaoAlv([{ pct_alv: 60 }], ALV).restante, 40));
  assert.equal(alocacaoAlv([{ pct_alv: 60 }, { pct_alv: 45 }], ALV).estado, 'excesso');
  // três terços com 4 casas: 99,9999 fecha dentro da tolerância.
  const tercos = [33.3333, 33.3333, 33.3333].map((pct_alv) => ({ pct_alv }));
  assert.equal(alocacaoAlv(tercos, ALV).estado, 'completa');
});

test('#781: os limites exatos da tolerância (99,99 e 100,01) contam como completos', () => {
  assert.equal(alocacaoAlv([{ pct_alv: 99.99 }], ALV).estado, 'completa');
  assert.equal(alocacaoAlv([{ pct_alv: 100.01 }], ALV).estado, 'completa');
  assert.equal(alocacaoAlv([{ pct_alv: 99.98 }], ALV).estado, 'falta');
  // pct derivado de linha antiga tem mais de 4 casas: o desvio real conta, sem arredondar.
  assert.equal(alocacaoAlv([{ pct_alv: 99.98996 }], ALV).estado, 'falta');
  assert.equal(alocacaoAlv([{ pct_alv: 100.01004 }], ALV).estado, 'excesso');
  assert.equal(alocacaoAlv([{ pct_alv: 100.02 }], ALV).estado, 'excesso');
});

test('#781: validarSomaPctAlv — catálogo vazio passa; soma ≠ 100 barra com mensagem', () => {
  assert.equal(validarSomaPctAlv([], ALV, 'ALV').ok, true);
  assert.equal(validarSomaPctAlv(undefined, ALV, 'ALV').ok, true);
  assert.equal(validarSomaPctAlv([{ pct_alv: 100 }], ALV, 'ALV').ok, true);
  const falta = validarSomaPctAlv([{ pct_alv: 90 }], ALV, 'ALV');
  assert.equal(falta.ok, false);
  assert.match(falta.mensagem!, /faltam/);
  const excesso = validarSomaPctAlv([{ pct_alv: 110 }], ALV, 'ALV');
  assert.equal(excesso.ok, false);
  assert.match(excesso.mensagem!, /excedem/);
});

// ── Motor: o catálogo derivado é o que alimenta VGV, unidades e resumo ──

test('#781 motor: VGV do Loteamento = ALV × % × preço, e reproduz o cadastro antigo', () => {
  const novo = calcularProforma({
    ...BASE,
    produtos: [
      { pct_alv: 60, unidades: 150, preco_venda_m2: 1000 },
      { pct_alv: 40, unidades: 100, preco_venda_m2: 1500 },
    ],
  });
  // 45.000 m² × 1.000 + 30.000 m² × 1.500 = 45 mi + 45 mi
  assert.ok(perto(novo.vgv, 90_000_000), `vgv=${novo.vgv}`);
  assert.equal(novo.numUnidades, 250);

  // Mesmo portfólio no formato antigo (área média digitada): 300 m² × 150 e 300 m² × 100.
  const antigo = calcularProforma({
    ...BASE,
    produtos: [
      { area_media_m2: 300, unidades: 150, preco_venda_m2: 1000 },
      { area_media_m2: 300, unidades: 100, preco_venda_m2: 1500 },
    ],
  });
  assert.ok(perto(novo.vgv, antigo.vgv), 'legado e por-% têm que dar o mesmo VGV');
  assert.equal(novo.numUnidades, antigo.numUnidades);
});

test('#781 motor: mudar a ALV recalcula a área e o VGV, sem tocar no % cadastrado', () => {
  const produtos = [{ pct_alv: 100, unidades: 250, preco_venda_m2: 1000 }];
  const a = calcularProforma({ ...BASE, produtos });
  const b = calcularProforma({ ...BASE, terreno_manual_area: 200000, produtos });
  assert.ok(perto(b.vgv, a.vgv * 2), `a=${a.vgv} b=${b.vgv}`);
});

test('#781 motor: linha em branco (sem unidades ou sem preço) continua fora do catálogo', () => {
  const p = calcularProforma({
    ...BASE,
    produtos: [
      { pct_alv: 50, unidades: 100, preco_venda_m2: 1000 },
      { pct_alv: 50, unidades: 0, preco_venda_m2: 1000 },
    ],
  });
  assert.ok(perto(p.vgv, 37_500_000), `vgv=${p.vgv}`);
  assert.equal(p.numUnidades, 100);
});

test('#781 motor: Tipo Residencial/Comercial separa unidades e preço médio no Loteamento', () => {
  const p = calcularProforma({
    ...BASE,
    produtos: [
      { pct_alv: 80, unidades: 200, preco_venda_m2: 1000, tipo: 'residencial' },
      { pct_alv: 20, unidades: 10, preco_venda_m2: 2000, tipo: 'nao_residencial' },
    ],
  });
  assert.equal(p.numUnidadesResidencial, 200);
  assert.equal(p.numUnidadesNaoResidencial, 10);
  assert.ok(perto(p.precoMedioUnidadeResidencial, 60000 * 1000 / 200));
  assert.ok(perto(p.precoMedioUnidadeNaoResidencial, 15000 * 2000 / 10));
  // ...e NÃO mexe no dinheiro: o VGV é o mesmo com tudo Residencial.
  const tudoR = calcularProforma({
    ...BASE,
    produtos: [
      { pct_alv: 80, unidades: 200, preco_venda_m2: 1000, tipo: 'residencial' },
      { pct_alv: 20, unidades: 10, preco_venda_m2: 2000, tipo: 'residencial' },
    ],
  });
  assert.ok(perto(p.vgv, tudoR.vgv));
});

// ── Prova de FIAÇÃO (CLAUDE.md, classe nº 1) ──
// O motor e os consumidores fora dele leem o catálogo por `produtosDoEstudo`.
// Se `calcularProforma` deixasse de derivar a área, o VGV do Loteamento sairia
// do campo legado (`area_media_m2` ausente = 0) e cairia para zero.
test('#781/#784 fiação: produtosDoEstudo entrega a área derivada da base, nos dois tipos', () => {
  const lot = produtosDoEstudo({ ...BASE, produtos: [{ pct_alv: 40, unidades: 100 }] });
  assert.ok(perto(Number(lot[0].area_media_m2), 300));
  // Incorporação: base = áreas privativas fechadas (8.000 m²); 40% ÷ 100 un = 32 m². O
  // `area_media_m2` gravado (55) é LEGADO e não vale mais quando há `pct_alv`.
  const inc = produtosDoEstudo({
    tipo_empreendimento: 'incorporacao', area_pvt_r_fechada: 6000, area_pvt_nr_fechada: 2000,
    produtos: [{ pct_alv: 40, unidades: 100, area_media_m2: 55 }],
  } as ProformaInput);
  assert.ok(perto(Number(inc[0].area_media_m2), 32), 'a Incorporação também deriva a área');
});

test('#781 fiação: só com pct_alv (sem area_media_m2) o Loteamento tem VGV', () => {
  const p = calcularProforma({ ...BASE, produtos: [{ pct_alv: 100, unidades: 250, preco_venda_m2: 1000 }] });
  assert.ok(p.vgv > 0 && !p.semProdutos, `vgv=${p.vgv}`);
});

test('#784: na Incorporação o VGV sai de pct_alv × base, não do area_media_m2 legado', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 10000,
    produtos: [{ pct_alv: 100, area_media_m2: 100, unidades: 10, preco_venda_m2: 5000 }],
  } as ProformaInput);
  // 100% de 10.000 m² × R$ 5.000/m² (o `area_media_m2` de 100 × 10 un = 1.000 m² é ignorado).
  assert.ok(perto(p.vgv, 10000 * 5000, 1));
});

test('#781: produtosComAreaDerivada não muta a entrada', () => {
  const entrada = [{ pct_alv: 50, unidades: 10, area_media_m2: 999 }];
  const saida = produtosComAreaDerivada(entrada, ALV);
  assert.equal(entrada[0].area_media_m2, 999);
  assert.ok(perto(saida[0].area_media_m2, 3750));
});

test('#781: sem ALV (Terreno & Áreas ainda vazio) a regra da soma não se aplica', () => {
  assert.equal(validarSomaPctAlv([{ pct_alv: 10 }], 0, 'ALV').ok, true);
  assert.equal(validarSomaPctAlv([{ area_media_m2: 300, unidades: 250 }], 0, 'ALV').ok, true);
});

test('#781/#784: trocar o tipo do rascunho leva a área derivada, sem zerar o VGV', () => {
  const produtos = [
    { id: 1, pct_alv: 60, unidades: 150 },   // 45.000 m² / 150 = 300
    { id: 2, pct_alv: 40, unidades: 100 },   // 30.000 m² / 100 = 300
    { id: 3, area_media_m2: 80, unidades: 5 }, // legado: sem pct_alv, já tem área
  ];
  const saida = areasParaTrocarDeTipo(produtos, ALV);
  assert.deepEqual(saida, [{ id: 1, area_media_m2: 300 }, { id: 2, area_media_m2: 300 }]);
  // Linha recém-criada (sem unidades) não tem área derivável: fica como está, com o %.
  assert.deepEqual(areasParaTrocarDeTipo([{ id: 9, pct_alv: 50, unidades: 0 }], ALV), []);
  const inc = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    produtos: produtos.map((p) => {
      const a = saida.find((s) => s.id === p.id);
      return { ...p, area_media_m2: a ? a.area_media_m2 : p.area_media_m2, pct_alv: null, preco_venda_m2: 1000 };
    }),
  } as ProformaInput);
  assert.ok(inc.vgv > 0 && !inc.semProdutos, `vgv=${inc.vgv}`);
});

// ── #784: Incorporação — a base é a soma das áreas privativas FECHADAS ──

// Terreno & Áreas: 6.000 m² residencial fechado + 2.000 m² não residencial
// fechado = 8.000 m² de base. As áreas ABERTAS (1.500 + 500) ficam FORA da base.
const INC: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  area_pvt_r_fechada: 6000, area_pvt_nr_fechada: 2000,
  area_pvt_r_aberta: 1500, area_pvt_nr_aberta: 500,
} as ProformaInput;
const BASE_INC = 8000;

test('#784: a base dos produtos da Incorporação é a área privativa FECHADA (sem as abertas)', () => {
  assert.equal(areaPrivativaFechadaIncorporacao(INC), BASE_INC);
  assert.equal(baseProdutosM2(INC), BASE_INC);
  // O Loteamento continua na ALV.
  assert.ok(perto(baseProdutosM2(BASE), ALV));
  // Mesmo piso das demais áreas: área negativa digitada não subtrai da base.
  assert.equal(areaPrivativaFechadaIncorporacao({ ...INC, area_pvt_nr_fechada: -500 } as ProformaInput), 6000);
  assert.equal(rotuloBaseProdutos('incorporacao'), 'área privativa fechada');
  assert.equal(rotuloBaseProdutos('loteamento'), 'ALV');
});

test('#784: produtosDoEstudo deriva a área na Incorporação a partir de pct_alv × base ÷ unidades', () => {
  const r = produtosDoEstudo({
    ...INC,
    produtos: [
      { pct_alv: 75, unidades: 60, preco_venda_m2: 10000 },   // 6.000 m² / 60 = 100
      { pct_alv: 25, unidades: 20, preco_venda_m2: 12000 },   // 2.000 m² / 20 = 100
    ],
  } as ProformaInput);
  assert.ok(perto(r[0].area_media_m2 as number, 100));
  assert.ok(perto(r[1].area_media_m2 as number, 100));
});

test('#784 motor: VGV da Incorporação = base × % × preço; legado (sem pct_alv) não muda de número', () => {
  const legado = calcularProforma({
    ...INC, produtos: [{ area_media_m2: 100, unidades: 60, preco_venda_m2: 10000 }, { area_media_m2: 100, unidades: 20, preco_venda_m2: 12000 }],
  } as ProformaInput);
  const novo = calcularProforma({
    ...INC, produtos: [{ pct_alv: 75, unidades: 60, preco_venda_m2: 10000 }, { pct_alv: 25, unidades: 20, preco_venda_m2: 12000 }],
  } as ProformaInput);
  assert.ok(perto(novo.vgv, 6000 * 10000 + 2000 * 12000, 1));
  assert.ok(perto(novo.vgv, legado.vgv, 1), 'o mesmo par área×unidades tem o mesmo VGV nos dois modelos');
  // Com Σ = 100% os produtos alocam exatamente a base: nada de "falta"/"excesso".
  assert.ok(perto(novo.areaProdutosAlocada, BASE_INC));
  assert.ok(perto(novo.diferencaAreaAlocada, 0));
});

test('#784 motor: mudar a área privativa fechada em Terreno & Áreas recalcula área e VGV sem tocar nos %', () => {
  const produtos = [{ pct_alv: 100, unidades: 80, preco_venda_m2: 10000 }];
  const antes = calcularProforma({ ...INC, produtos } as ProformaInput);
  const depois = calcularProforma({ ...INC, area_pvt_r_fechada: 8000, produtos } as ProformaInput);
  assert.ok(perto(antes.vgv, 8000 * 10000, 1));
  assert.ok(perto(depois.vgv, 10000 * 10000, 1));
});

test('#784: alocação e validação da soma sobre a base da Incorporação', () => {
  assert.equal(alocacaoAlv([{ pct_alv: 60 }, { pct_alv: 40 }], BASE_INC).estado, 'completa');
  const falta = validarSomaPctAlv([{ pct_alv: 90 }], BASE_INC, 'área privativa fechada');
  assert.equal(falta.ok, false);
  assert.match(falta.mensagem!, /90% da área privativa fechada e precisa ser 100%/);
  // Sem base (Terreno & Áreas vazio) a regra não se aplica; catálogo vazio também não.
  assert.equal(validarSomaPctAlv([{ pct_alv: 10 }], 0, 'área privativa fechada').ok, true);
  assert.equal(validarSomaPctAlv([], BASE_INC, 'área privativa fechada').ok, true);
});

test('#784: produto legado da Incorporação (só area_media_m2) tem o % derivado da base e a mesma área', () => {
  const legado = { area_media_m2: 100, unidades: 60 }; // 6.000 m²
  assert.ok(perto(pctAlvEfetivo(legado, BASE_INC), 75));
  assert.ok(perto(areaTotalDaLinha(legado, BASE_INC), 6000));
  // Sem base o legado segue com a própria área (não depende da cascata estar preenchida).
  assert.ok(perto(areaTotalDaLinha(legado, 0), 6000));
});

test('#784: trocar Incorporação → Loteamento leva a área derivada da base de ORIGEM', () => {
  const produtos = [{ id: 1, pct_alv: 75, unidades: 60 }, { id: 2, pct_alv: 25, unidades: 20 }];
  // Origem = Incorporação (base 8.000): 6.000/60 = 100 e 2.000/20 = 100. Com a ALV do
  // Loteamento como base o resultado seria outro — é a diferença que a conversão evita.
  assert.deepEqual(areasParaTrocarDeTipo(produtos, BASE_INC), [
    { id: 1, area_media_m2: 100 }, { id: 2, area_media_m2: 100 },
  ]);
  assert.notDeepEqual(areasParaTrocarDeTipo(produtos, ALV), areasParaTrocarDeTipo(produtos, BASE_INC));
});

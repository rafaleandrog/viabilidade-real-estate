import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pctAlvEfetivo, areaTotalDaLinha, areaMediaDaLinha, produtosComAreaDerivada,
  somaPctAlv, alocacaoAlv, validarSomaPctAlv,
} from './produtos-alv.js';
import { calcularProforma, produtosDoEstudo, alvDoLoteamento, type ProformaInput } from './proforma.js';

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

test('#781: validarSomaPctAlv — catálogo vazio passa; soma ≠ 100 barra com mensagem', () => {
  assert.equal(validarSomaPctAlv([], ALV).ok, true);
  assert.equal(validarSomaPctAlv(undefined, ALV).ok, true);
  assert.equal(validarSomaPctAlv([{ pct_alv: 100 }], ALV).ok, true);
  const falta = validarSomaPctAlv([{ pct_alv: 90 }], ALV);
  assert.equal(falta.ok, false);
  assert.match(falta.mensagem!, /faltam/);
  const excesso = validarSomaPctAlv([{ pct_alv: 110 }], ALV);
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
test('#781 fiação: produtosDoEstudo entrega a área derivada no Loteamento e a crua na Incorporação', () => {
  const lot = produtosDoEstudo({ ...BASE, produtos: [{ pct_alv: 40, unidades: 100 }] });
  assert.ok(perto(Number(lot[0].area_media_m2), 300));
  const inc = produtosDoEstudo({
    tipo_empreendimento: 'incorporacao', produtos: [{ pct_alv: 40, unidades: 100, area_media_m2: 55 }],
  } as ProformaInput);
  assert.equal(Number(inc[0].area_media_m2), 55, 'Incorporação não deriva nada');
});

test('#781 fiação: só com pct_alv (sem area_media_m2) o Loteamento tem VGV', () => {
  const p = calcularProforma({ ...BASE, produtos: [{ pct_alv: 100, unidades: 250, preco_venda_m2: 1000 }] });
  assert.ok(p.vgv > 0 && !p.semProdutos, `vgv=${p.vgv}`);
});

test('#781: a Incorporação ignora pct_alv por completo', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 10000,
    produtos: [{ pct_alv: 100, area_media_m2: 100, unidades: 10, preco_venda_m2: 5000 }],
  } as ProformaInput);
  assert.ok(perto(p.vgv, 100 * 10 * 5000));
});

test('#781: produtosComAreaDerivada não muta a entrada', () => {
  const entrada = [{ pct_alv: 50, unidades: 10, area_media_m2: 999 }];
  const saida = produtosComAreaDerivada(entrada, ALV);
  assert.equal(entrada[0].area_media_m2, 999);
  assert.ok(perto(saida[0].area_media_m2, 3750));
});

test('#781: sem ALV (Terreno & Áreas ainda vazio) a regra da soma não se aplica', () => {
  assert.equal(validarSomaPctAlv([{ pct_alv: 10 }], 0).ok, true);
  assert.equal(validarSomaPctAlv([{ area_media_m2: 300, unidades: 250 }], 0).ok, true);
});

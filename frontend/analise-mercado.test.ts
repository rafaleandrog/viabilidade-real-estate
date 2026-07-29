import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  precoMedioM2Projeto, custoObraM2Projeto, vsoProjetoPct, compararProjetoMercado,
} from './analise-mercado.js';
import type { EventoCrono } from './fluxo-shared.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

// Duas tipologias com preços/m² diferentes e áreas diferentes — o caso em que
// média ponderada e média aritmética divergem.
const LINHA_MISTA = {
  tipologias: [
    { quantidade: 10, area_privativa_m2: 50, preco_m2: 10_000 },  // 500 m², VGV 5M
    { quantidade: 2, area_privativa_m2: 200, preco_m2: 20_000 },  // 400 m², VGV 8M
  ],
  absorcao: { modo: 'linear' },
};

test('#199 preço médio do projeto é ponderado pela área, não a média dos preços', () => {
  // VGV 13M / 900 m² = 14.444,44 — a média aritmética dos preços daria 15.000.
  const r = precoMedioM2Projeto([LINHA_MISTA]);
  assert.ok(r !== null);
  assert.ok(perto(r!, 13_000_000 / 900));
  assert.ok(!perto(r!, 15_000, 1), 'não pode ser a média aritmética dos preco_m2');
});

test('#199 sem tipologia/VGV o preço do projeto é null, não zero', () => {
  assert.equal(precoMedioM2Projeto([]), null);
  assert.equal(precoMedioM2Projeto([{ tipologias: [] }]), null);
  // Área existe mas preço zerado → VGV 0 → não há preço a comparar.
  assert.equal(
    precoMedioM2Projeto([{ tipologias: [{ quantidade: 1, area_privativa_m2: 50, preco_m2: 0 }] }]),
    null,
  );
});

test('#199 custo de obra por m² soma o grupo obra e ignora os demais grupos', () => {
  const linhas = [
    { grupo: 'obra', total: 6_000_000 },
    { grupo: 'obra', total: 3_000_000 },
    { grupo: 'terreno', total: 5_000_000 },   // não entra
    { grupo: 'diretos', total: 1_000_000 },   // não entra
  ];
  const r = custoObraM2Projeto(linhas, 900);
  assert.ok(r !== null);
  assert.ok(perto(r!, 9_000_000 / 900));
});

test('#199 custo por m² é null sem linha de obra ou sem área', () => {
  assert.equal(custoObraM2Projeto([{ grupo: 'terreno', total: 5_000_000 }], 900), null);
  assert.equal(custoObraM2Projeto([{ grupo: 'obra', total: 9_000_000 }], 0), null);
});

test('#199 VSO do projeto = 100% dividido pelos meses com venda', () => {
  // Absorção personalizada em 4 meses → 25%/mês.
  const linha = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: {
      modo: 'personalizado',
      meses: [{ mes: 12, pct: 25 }, { mes: 13, pct: 25 }, { mes: 14, pct: 25 }, { mes: 15, pct: 25 }],
    },
  };
  const r = vsoProjetoPct([linha], CRONO);
  assert.ok(r !== null);
  assert.ok(perto(r!, 25));
});

test('#199 VSO pondera as fases pelo VGV, não pela contagem de fases', () => {
  // Fase grande (VGV 90M) vendendo a 10%/mês e fase pequena (VGV 10M) a 50%/mês.
  const grande = {
    tipologias: [{ quantidade: 90, area_privativa_m2: 100, preco_m2: 10_000 }], // 90M
    absorcao: { modo: 'personalizado', meses: Array.from({ length: 10 }, (_, i) => ({ mes: 12 + i, pct: 10 })) },
  };
  const pequena = {
    tipologias: [{ quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }], // 10M
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 50 }, { mes: 13, pct: 50 }] },
  };
  const r = vsoProjetoPct([grande, pequena], CRONO);
  assert.ok(r !== null);
  // Ponderado: (10×90M + 50×10M) / 100M = 14 — a média simples daria 30.
  assert.ok(perto(r!, 14, 0.5));
});

test('#199 VSO é null sem receita utilizável', () => {
  assert.equal(vsoProjetoPct([], CRONO), null);
  assert.equal(vsoProjetoPct([{ tipologias: [], absorcao: { modo: 'linear' } }], CRONO), null);
});

test('#199 comparação projeto × mercado: acima, abaixo e alinhado', () => {
  const acima = compararProjetoMercado(11_000, 10_000);
  assert.equal(acima?.posicao, 'acima');
  assert.ok(perto(acima!.deltaPct, 10));
  assert.ok(perto(acima!.delta, 1_000));

  const abaixo = compararProjetoMercado(9_000, 10_000);
  assert.equal(abaixo?.posicao, 'abaixo');
  assert.ok(perto(abaixo!.deltaPct, -10));

  assert.equal(compararProjetoMercado(10_000, 10_000)?.posicao, 'alinhado');
});

test('#199 comparação é null quando falta um dos lados (não vira zero)', () => {
  assert.equal(compararProjetoMercado(null, 10_000), null);
  assert.equal(compararProjetoMercado(10_000, null), null);
  assert.equal(compararProjetoMercado(10_000, undefined), null);
  // Mercado zero tornaria o % infinito — tratado como "sem dado".
  assert.equal(compararProjetoMercado(10_000, 0), null);
});

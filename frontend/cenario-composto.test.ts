import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularProforma, fatoresDe, type ProformaInput } from './proforma.js';
import { rankearAlavancas } from './tornado-alavancas.js';
import { cenarioComposto, escolherAlavancas, fatoresDoLado, rotuloComposto, descreverLado, N_COMPOSTO } from './cenario-composto.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from './fixtures/sensibilidade-catalogo.js';

// ─────────────────────────────────────────────────────────────────────────────
// #735 — cenário composto: as três maiores alavancas estressadas juntas
// ─────────────────────────────────────────────────────────────────────────────

// Fixture com custo percentual sobre o VGV (projetos, marketing global,
// gestão de indiretos): é o que faz os efeitos INTERAGIREM, e o composto
// diferir da soma dos deltas isolados.
const ENTRADA: ProformaInput = { ...ESTUDO_SENSIBILIDADE, produtos: PRODUTOS_SENSIBILIDADE, permuta_financeira_residencial_pct: 5 };
const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

test('#735 critério 3: a forma antiga (uma variável) e a nova (conjunto) normalizam no mesmo mapa', () => {
  assert.deepEqual(fatoresDe({ variavel: 'preco', fator: 0.9 }), { preco: 0.9 });
  assert.deepEqual(fatoresDe({ fatores: { preco: 0.9, custo_obras: 1.1 } }), { preco: 0.9, custo_obras: 1.1 });
  assert.deepEqual(fatoresDe(undefined), {});
  assert.deepEqual(fatoresDe(null), {});
  // Fronteira fail-closed: NaN, null e string não entram no mapa (ausente = 1).
  assert.deepEqual(fatoresDe({ fatores: { preco: NaN, custo_obras: null as any, custo_infra: '0.9' as any, custo_terreno: 1.2 } }), { custo_terreno: 1.2 });
  assert.equal(calcularProforma({ ...ENTRADA, sensibilidade: { fatores: { preco: NaN } } }).resultado, calcularProforma(ENTRADA).resultado);
  // Uma variável só, nas duas formas, dá a MESMA Proforma.
  const a = calcularProforma({ ...ENTRADA, sensibilidade: { variavel: 'preco', fator: 0.9 } });
  const b = calcularProforma({ ...ENTRADA, sensibilidade: { fatores: { preco: 0.9 } } });
  assert.equal(a.resultado, b.resultado);
  assert.equal(a.vgv, b.vgv);
});

test('#735 critério 1: três fatores simultâneos movem as três grandezas, cada uma pelo seu fator', () => {
  const base = calcularProforma(ENTRADA);
  const p = calcularProforma({ ...ENTRADA, sensibilidade: { fatores: { preco: 0.9, custo_obras: 1.2, permuta_financeira: 1.5 } } });
  assert.ok(perto(p.vgv, base.vgv * 0.9), `vgv ${p.vgv} ≠ ${base.vgv * 0.9}`);
  assert.ok(perto(p.construcao, base.construcao * 1.2), `construcao ${p.construcao} ≠ ${base.construcao * 1.2}`);
  // A permuta financeira em % do VGV: escala pelo fator dela E pelo VGV já
  // estressado pelo preço — é a interação que o composto captura.
  assert.ok(perto(p.permutaFinResidencial, base.permutaFinResidencial * 1.5 * 0.9), `permFin ${p.permutaFinResidencial}`);
  // O piso continua POR fator: um fator negativo numa variável não zera as outras.
  const piso = calcularProforma({ ...ENTRADA, sensibilidade: { fatores: { preco: -1, custo_obras: 1.2 } } });
  assert.equal(piso.vgv, 0);
  assert.ok(perto(piso.construcao, base.construcao * 1.2));
});

test('#735 critério 2: o resultado composto DIFERE da soma dos três deltas isolados — a composição roda no motor', () => {
  const alavancas = rankearAlavancas(ENTRADA, 10, false);
  const c = cenarioComposto(ENTRADA, alavancas, 10)!;
  assert.ok(c);
  assert.equal(c.variaveis.length, N_COMPOSTO);
  const base = c.resultadoBase;
  const somaBear = c.variaveis.reduce((s, v) => s + (alavancas.find((a) => a.variavel === v)!.resultadoBear - base), 0);
  assert.ok(Math.abs((c.resultadoBear - base) - somaBear) > 1, `composto ${c.resultadoBear - base} vs soma ${somaBear} — deveriam diferir`);
  // Nesta fixture o composto é PIOR que a pior alavanca isolada — o ponto do
  // handoff. NÃO é teorema: uma dedução em % do VGV estressada para cima
  // enquanto o preço cai fica MENOR em R$ (1,1 × 0,9 < 1), e num composto de
  // só duas alavancas (preço + permuta financeira) o composto pode sair
  // melhor que o Bear de preço isolado (achado do Kimi, PR 777).
  const piorIsolado = Math.min(...c.variaveis.map((v) => alavancas.find((a) => a.variavel === v)!.resultadoBear));
  assert.ok(c.resultadoBear < piorIsolado, `composto ${c.resultadoBear} não é pior que o pior isolado ${piorIsolado}`);
  assert.ok(c.resultadoBull > base && c.resultadoBear < base);
  assert.ok(perto(c.amplitudeRS, Math.abs(c.resultadoBull - c.resultadoBear)));
});

test('#735 critério 4: as escolhidas são as de maior amplitudeRS entre as NÃO circulares', () => {
  const al = rankearAlavancas(ENTRADA, 10, false);
  const esc = escolherAlavancas(al);
  const semCircular = al.filter((a) => !a.circular).sort((a, b) => b.amplitudeRS - a.amplitudeRS);
  assert.deepEqual(esc.map((a) => a.variavel), semCircular.slice(0, 3).map((a) => a.variavel));
  // Loteamento com infra % do VGV: custo_infra é circular e fica de fora mesmo rankeado alto.
  const lot: ProformaInput = { tipo_empreendimento: 'loteamento', terreno_manual_area: 100_000, area_viario_publico_modo: 'pct_poligonal', area_viario_publico_valor: 25, produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }], imposto_percentual: 7, corretagem_percentual: 5, marketing_percentual: 1, considerar_custo_terreno: true, custo_terreno_m2: 100, infra_modo: 'pct_vgv', infra_pct: 30, projetos_modo: 'pct_vgv', projetos_pct: 2, manutencao_pct: 1, marketing_global_pct: 1, gestao_indiretos_pct: 1.25 } as ProformaInput;
  const alLot = rankearAlavancas(lot, 10, true);
  assert.ok(alLot.find((a) => a.variavel === 'custo_infra')!.circular);
  const escLot = escolherAlavancas(alLot);
  assert.ok(!escLot.some((a) => a.circular), 'alavanca circular entrou no composto');
  // Mutação declarada (critério 6): reduzir a seleção a duas deixa vermelho.
  assert.equal(escLot.length, 3);
  assert.equal(N_COMPOSTO, 3);
});

test('#735: fatores de cada lado no sentido certo, rótulo declara as premissas, e composto de uma alavanca só é null', () => {
  assert.deepEqual(fatoresDoLado(['preco', 'custo_obras'], 10, 'bear'), { preco: 0.9, custo_obras: 1.1 });
  assert.deepEqual(fatoresDoLado(['preco', 'custo_obras'], 10, 'bull'), { preco: 1.1, custo_obras: 0.9 });
  const al = rankearAlavancas(ENTRADA, 10, false);
  const c = cenarioComposto(ENTRADA, al, 10)!;
  assert.match(rotuloComposto(c), /^Cenário composto \(.+ \+ .+ \+ .+\)$/);
  // O cabeçalho declara as três, cada uma com o sentido do lado.
  const bear = descreverLado(c, 'bear', 10); const bull = descreverLado(c, 'bull', 10);
  assert.equal(bear.split(' · ').length, 3);
  assert.match(bear, /−10% Preço de venda/); assert.match(bull, /\+10% Preço de venda/);
  assert.match(bear, /\+10% Custo de obra/); assert.match(bull, /−10% Custo de obra/);
  assert.equal(cenarioComposto(ENTRADA, al.slice(0, 1), 10), null);
});

test('#735 fiação: o composto é o item do topo do tornado, o cabeçalho declara as premissas e a tabela roda o motor com o conjunto', () => {
  const tela = readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8');
  for (const s of ['cenarioComposto(', 'rotuloComposto(', 'fatoresBear', 'fatoresBull', "'composto'"]) {
    assert.ok(tela.includes(s), `tela-proforma.ts perdeu "${s}" — o cenário composto deixou de ser ligado`);
  }
  const tornado = readFileSync(new URL('./grafico-tornado.ts', import.meta.url), 'utf8');
  assert.ok(tornado.includes('composto'), 'grafico-tornado.ts não desenha o item composto');
});

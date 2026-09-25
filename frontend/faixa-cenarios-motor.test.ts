import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarFaixaCenarios } from './faixa-cenarios-motor.js';
import { montarMedidor } from './medidor-faixas.js';

// ─────────────────────────────────────────────────────────────────────────────
// #731 — faixa bear–base–bull contra o benchmark, numa escala ÚNICA
// ─────────────────────────────────────────────────────────────────────────────

const CONFIGURADO = { regra_comparacao: 'atingir_ou_superar', valor: 20, medidor_min: 0, medidor_faixa1_ate: 15, medidor_faixa2_ate: 20, medidor_max: 40 };
const NAO_EXCEDER = { regra_comparacao: 'nao_exceder', valor: 35, medidor_min: 0, medidor_faixa1_ate: 30, medidor_faixa2_ate: 40, medidor_max: 60 };
const SO_META = { regra_comparacao: 'atingir_ou_superar', valor: 25 };

const perto = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

test('#731 critério 1: os três marcadores saem na MESMA escala — mudar o Bull não move o Bear', () => {
  const a = montarFaixaCenarios(CONFIGURADO, { bear: 12, base: 22, bull: 30 })!;
  const b = montarFaixaCenarios(CONFIGURADO, { bear: 12, base: 22, bull: 38 })!;
  assert.ok(a && b);
  assert.equal(a.min, 0); assert.equal(a.max, 40);
  assert.equal(b.min, 0); assert.equal(b.max, 40);
  assert.ok(perto(a.marcadores.bear!, 30) && perto(b.marcadores.bear!, 30), 'o Bear se moveu com o Bull');
  assert.ok(perto(a.marcadores.base!, 55) && perto(b.marcadores.base!, 55));
  assert.ok(perto(a.marcadores.bull!, 75) && perto(b.marcadores.bull!, 95));
  // No ramo AUTOMÁTICO `montarMedidor` adapta o max ao valor recebido: três
  // chamadas dariam três escalas. Aqui a escala é uma — a do maior valor —
  // e é a mesma para os três marcadores.
  const auto = montarFaixaCenarios(SO_META, { bear: 18, base: 30, bull: 45 })!;
  const escalaDoMaior = montarMedidor(SO_META, 45)!;
  assert.equal(auto.max, escalaDoMaior.max);
  assert.ok(perto(auto.marcadores.bear!, (18 / auto.max) * 100));
  assert.ok(perto(auto.marcadores.bull!, (45 / auto.max) * 100));
  // Valor FORA do benchmark configurado estende a escala em vez de grampear:
  // o marcador continua comparável, e a faixa declara que foi estendida.
  const fora = montarFaixaCenarios(CONFIGURADO, { bear: -5, base: 22, bull: 50 })!;
  assert.equal(fora.min, -5); assert.equal(fora.max, 50);
  assert.equal(fora.estendida, true);
  assert.ok(perto(fora.marcadores.bear!, 0) && perto(fora.marcadores.bull!, 100));
  assert.equal(a.estendida, false);
});

test('#731 critério 2: regra nao_exceder inverte as cores de fundo — verde na região baixa', () => {
  const f = montarFaixaCenarios(NAO_EXCEDER, { bear: 45, base: 35, bull: 28 })!;
  assert.match(f.segmentos[0].cor, /cor-sucesso/);
  assert.match(f.segmentos[1].cor, /cor-alerta/);
  assert.match(f.segmentos[2].cor, /cor-erro/);
  const g = montarFaixaCenarios(CONFIGURADO, { bear: 12, base: 22, bull: 30 })!;
  assert.match(g.segmentos[0].cor, /cor-erro/);
  assert.match(g.segmentos[2].cor, /cor-sucesso/);
  // Os segmentos cobrem o trilho inteiro, contíguos, na ordem dos cortes.
  assert.equal(g.segmentos[0].dePct, 0);
  assert.equal(g.segmentos[g.segmentos.length - 1].atePct, 100);
  for (let i = 1; i < g.segmentos.length; i++) assert.equal(g.segmentos[i].dePct, g.segmentos[i - 1].atePct);
  assert.ok(perto(g.segmentos[0].atePct, 37.5) && perto(g.segmentos[1].atePct, 50));
});

test('#731 critério 3: indicador null num cenário ⇒ aquele marcador não é desenhado, os outros dois ficam', () => {
  const f = montarFaixaCenarios(CONFIGURADO, { bear: null, base: 22, bull: 30 })!;
  assert.equal(f.marcadores.bear, null);
  assert.ok(perto(f.marcadores.base!, 55) && perto(f.marcadores.bull!, 75));
  assert.equal(f.valores.bear, null);
  // Base nula (VGV ≤ 0 no cenário real): a escala sai dos outros dois.
  const g = montarFaixaCenarios(SO_META, { bear: 10, base: null, bull: 30 })!;
  assert.equal(g.marcadores.base, null);
  assert.ok(g.marcadores.bear !== null && g.marcadores.bull !== null);
  // Os três nulos: nada a desenhar.
  assert.equal(montarFaixaCenarios(CONFIGURADO, { bear: null, base: null, bull: null }), null);
});

test('#731 critério 4: benchmark sem configuração válida (meta <= 0) ⇒ null, sem barra fantasma', () => {
  assert.equal(montarFaixaCenarios({ regra_comparacao: 'atingir_ou_superar', valor: 0 }, { bear: 12, base: 22, bull: 30 }), null);
  assert.equal(montarFaixaCenarios(undefined, { bear: 12, base: 22, bull: 30 }), null);
  assert.equal(montarFaixaCenarios({ valor: -3 }, { bear: 12, base: 22, bull: 30 }), null);
  // Configuração parcial cai no fallback da meta, como em `montarMedidor`.
  assert.ok(montarFaixaCenarios({ regra_comparacao: 'atingir_ou_superar', valor: 25, medidor_min: 0, medidor_max: 40 }, { bear: 12, base: 22, bull: 30 }));
});

test('#731 fiação: a aba Cenários monta uma faixa por indicador e cai nas badges quando o motor devolve null', () => {
  const tela = readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8');
  for (const s of [
    'montarFaixaCenarios(this._bm(x.linha.bmCampo', // a escala única, uma chamada por indicador
    '<viab-faixa-cenarios',
    '.faixa=${',
    'comBadge',  // o fallback declarado: indicador sem benchmark válido segue como badge
  ]) {
    assert.ok(tela.includes(s), `tela-proforma.ts perdeu "${s}" — os indicadores voltaram às pílulas`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pagamentosPrazoFixo, pagamentosAteMarco, calcularRecebiveisComponentes,
  type ComponentePagamento,
} from '../fluxo-caixa-motor.js';
import {
  BASE_CONTRATADA, TAXA_MENSAL, FIM_OBRA_MES, MES_REPASSE,
  COMPONENTES_EVI, EVI_ESPERADO,
} from './evi-urbita-golden.js';

// #463 — o fixture EXECUTA: estes testes rodam o motor de produção
// (`frontend/fluxo-caixa-motor.ts`, não reimplementado aqui) contra os
// números apurados da EVI Urbitá. Se a matemática de safra única divergir,
// estes testes ficam vermelhos — é a prova que a issue pede, em vez de uma
// tabela colada num comentário.

const perto = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// `as ComponentePagamento[]` — os literais do fixture já têm o shape exato
// da união discriminada; a asserção de tipo só declara a intenção ao leitor.
const componentes = COMPONENTES_EVI as ComponentePagamento[];

test('#463 EVI Urbitá — sinal e 36 parcelas do componente prazo_fixo (cfINC!AY20)', () => {
  const c = componentes.find((x) => x.tipo === 'prazo_fixo')!;
  const pagamentos = pagamentosPrazoFixo(c as Extract<ComponentePagamento, { tipo: 'prazo_fixo' }>, 0, BASE_CONTRATADA);

  const sinal = pagamentos.filter((p) => p.tipo === 'sinal');
  assert.equal(sinal.length, 1);
  assert.equal(sinal[0].valor, EVI_ESPERADO.sinalPrazoFixo);

  const parcelas = pagamentos.filter((p) => p.tipo !== 'sinal');
  assert.equal(parcelas.length, EVI_ESPERADO.qtdParcelasPrazoFixo);
  // As 35 primeiras são exatas; a 36ª carrega o resíduo de centavos (round2 por parcela).
  for (const p of parcelas.slice(0, -1)) assert.equal(p.valor, EVI_ESPERADO.parcelaPrazoFixo);
  for (const p of parcelas) assert.ok(perto(p.valor, EVI_ESPERADO.parcelaPrazoFixo, 0.10));
});

test('#463 EVI Urbitá — 29 parcelas do componente ate_marco, marco = fim da Obra (cfINC!AD20)', () => {
  const c = componentes.find((x) => x.tipo === 'ate_marco')!;
  const pagamentos = pagamentosAteMarco(c as Extract<ComponentePagamento, { tipo: 'ate_marco' }>, 0, BASE_CONTRATADA);

  assert.equal(pagamentos.filter((p) => p.tipo === 'sinal').length, 0, 'sinalPct 0 — sem sinal');
  const parcelas = pagamentos.filter((p) => p.tipo !== 'sinal');
  assert.equal(parcelas.length, EVI_ESPERADO.qtdParcelasAteMarco);
  assert.equal(parcelas[0].mes, 1, 'defasagem 1: 1ª parcela no mês seguinte à contratação');
  assert.equal(parcelas[parcelas.length - 1].mes, FIM_OBRA_MES, 'N_s = marco − safra, última parcela cai exatamente no marco');
  for (const p of parcelas.slice(0, -1)) assert.equal(p.valor, EVI_ESPERADO.parcelaAteMarco);
  for (const p of parcelas) assert.ok(perto(p.valor, EVI_ESPERADO.parcelaAteMarco, 0.10));
});

test('#463 EVI Urbitá — saldo a repassar capitaliza para R$ 5.715.517,93 no mês 30 (cfINC!AJ/AK/AL)', () => {
  const c = componentes.find((x) => x.tipo === 'concentrado')!;
  const principal = BASE_CONTRATADA * ((c as Extract<ComponentePagamento, { tipo: 'concentrado' }>).participacaoPct / 100);
  assert.ok(perto(principal, EVI_ESPERADO.principalRepasse, 0.01));

  const r = calcularRecebiveisComponentes([c], [{ safra: 0, valorContratado: BASE_CONTRATADA }], 999, 60);
  assert.ok(perto(r.recebimentoBrutoMensal[MES_REPASSE], EVI_ESPERADO.repasseMes30, 0.02));
  assert.equal(r.principalRecebidoMensal[MES_REPASSE], round2(EVI_ESPERADO.principalRepasse), 'principal não pode crescer com a capitalização');
  assert.ok(perto(r.jurosMensal[MES_REPASSE], EVI_ESPERADO.jurosRepasseMes30, 0.02));
  assert.equal(soma(r.recebimentoBrutoMensal.slice(0, MES_REPASSE)), 0, 'nada recebido antes do repasse');
});

test('#463 EVI Urbitá — receita do mês 0 combina os 4 componentes: R$ 874.347,55 (cfINC!BI19)', () => {
  const r = calcularRecebiveisComponentes(componentes, [{ safra: 0, valorContratado: BASE_CONTRATADA }], 999, 60);
  assert.ok(perto(r.recebimentoBrutoMensal[0], EVI_ESPERADO.receitaMes0, 0.02));
  // Nenhum dos outros 3 componentes paga nada no mês 0: só imediato + sinal.
  assert.ok(perto(
    r.recebimentoBrutoMensal[0],
    BASE_CONTRATADA * 0.10 /* imediato */ + EVI_ESPERADO.sinalPrazoFixo /* sinal */,
    0.02,
  ));
});

test('#463 EVI Urbitá — a taxa mensal é exatamente (1,125)^(1/12) − 1', () => {
  assert.ok(perto(TAXA_MENSAL, Math.pow(1.125, 1 / 12) - 1, 1e-9));
});

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

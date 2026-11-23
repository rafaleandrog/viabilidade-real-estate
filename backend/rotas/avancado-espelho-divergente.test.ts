import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respostaFaseComAviso } from './avancado.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];
const DIVERGENTE = {
  entrada: [{ pct: 50, parcelas: 1 }],
  parcelas: [{ pct: 50, periodicidade: 'mensal', parcelas: 12 }],
  repasse: { apos_entrega_meses: 1 },
  componentes: [
    { tipo: 'imediato', descontoPct: 0, participacaoPct: 10 },
    { tipo: 'prazo_fixo', prazoMeses: 12, sinalPct: 0, defasagemMeses: 0, taxaMensal: 0, participacaoPct: 20 },
    { tipo: 'concentrado', mesPagamento: 37, taxaMensal: 0, participacaoPct: 70 },
  ],
};
const SOMENTE_CANONICO = { entrada: [], parcelas: [], repasse: { apos_entrega_meses: 1 }, componentes: DIVERGENTE.componentes };

test('PATCH da fase: plano com espelho divergente responde com espelho_divergente', () => {
  const r = respostaFaseComAviso({ id: 1 }, DIVERGENTE, CRONO);
  assert.equal(r.espelho_divergente, true);
  assert.equal(r.id, 1);
});

test('PATCH da fase: plano coerente, só canônico ou ausente responde sem o aviso', () => {
  assert.equal('espelho_divergente' in respostaFaseComAviso({ id: 1 }, SOMENTE_CANONICO, CRONO), false);
  assert.equal('espelho_divergente' in respostaFaseComAviso({ id: 1 }, undefined, CRONO), false);
  assert.equal('espelho_divergente' in respostaFaseComAviso({ id: 1 }, { entrada: [{ pct: 20, parcelas: 1 }], parcelas: [] }, CRONO), false);
});

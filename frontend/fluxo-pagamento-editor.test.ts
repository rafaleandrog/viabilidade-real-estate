import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  erroFormularioPagamento,
  fluxoPagamentoParaSalvar,
  formularioPagamento,
} from './fluxo-pagamento-editor.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];

test('#248 configuração nova persiste contrato canônico e espelho legado', () => {
  const form = formularioPagamento(null);
  const salvo = fluxoPagamentoParaSalvar(form, CRONO);

  assert.equal(erroFormularioPagamento(form, CRONO), null);
  assert.deepEqual(salvo.componentes.map((c) => [c.tipo, c.participacaoPct]), [
    ['imediato', 15],
    ['ate_marco', 15],
    ['concentrado', 70],
  ]);
  assert.equal(salvo.entrada[0].pct, 15);
  assert.equal(salvo.parcelas[0].periodicidade, 'mensal');
  assert.equal(salvo.aplicado, true);
});

test('#248 leitura de shapes legados não reinterpreta os campos', () => {
  const legado = {
    comissao: { ativo: false, tipo: 'destacada', pct: 4 },
    entrada: { pct: 20, parcelas: 1, descontoPct: 5 },
    parcelas: { pct: 30, periodicidade: 'trimestral', parcelas: 10, ao_longo_obra: false },
    repasse: { apos_entrega_meses: 6 },
  };
  const form = formularioPagamento(legado);
  assert.deepEqual(form.entrada, [legado.entrada]);
  assert.deepEqual(form.parcelas, [legado.parcelas]);
  assert.equal(form.repasse.apos_entrega_meses, 6);
});

test('#248 bloqueia soma acima de 100% antes de chamar o backend', () => {
  const form = formularioPagamento(null);
  form.entrada[0].pct = 60;
  form.parcelas[0].pct = 50;
  assert.match(erroFormularioPagamento(form, CRONO)!, /não pode superar 100%/);
});

test('#248 rejeita prazo fixo vazio e aceita parcelas mensais válidas', () => {
  const form = formularioPagamento(null);
  form.parcelas[0] = { pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: false };
  assert.match(erroFormularioPagamento(form, CRONO)!, /ao menos uma parcela mensal/);
  form.parcelas[0].parcelas = 36;
  assert.equal(erroFormularioPagamento(form, CRONO), null);
});

test('#248 percentuais negativos são inválidos', () => {
  const form = formularioPagamento(null);
  form.entrada[0].pct = -1;
  assert.match(erroFormularioPagamento(form, CRONO)!, /entre 0% e 100%/);
});

test('#345 repasse.apos_entrega_meses não é mais validado (campo inerte, sem controle na UI)', () => {
  const form = formularioPagamento(null);
  form.repasse.apos_entrega_meses = 1.5; // valor fracionário, antes rejeitado
  assert.equal(erroFormularioPagamento(form, CRONO), null);
});

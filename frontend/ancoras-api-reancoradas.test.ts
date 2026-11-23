// Âncoras de calendário gravadas pela API (decisão do dono: seguem o Cronograma).
//
// Um plano cujos componentes trazem `mesPagamento` (repasse) ou `marcoMes`
// diferente do derivado do Cronograma NÃO é espelho divergente: o modal fica
// editável e o Aplicar sem edição regrava as datas pelo Cronograma vigente. É a
// mesma regra do plano criado pela tela cujo Cronograma mudou depois — os dois
// casos são indistinguíveis sem uma marca de âncora manual, e a escolha foi
// seguir o Cronograma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  componentesParaSalvar, espelhoDescreveComponentes, fluxoPagamentoParaSalvar,
  formularioPagamento, formularioPagamentoDoPlano,
} from './fluxo-pagamento-editor.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];
const CRONO_LONGO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 30 }];
const AA = 12.5;

const planoDaTela = (crono: any[]) => fluxoPagamentoParaSalvar(formularioPagamento({
  entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
  parcelas: [
    { pct: 30, periodicidade: 'mensal', parcelas: 12 },
    { pct: 10, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true },
  ],
  repasse: { apos_entrega_meses: 1 },
}), crono, AA) as any;

const ancoras = (cs: any[]) => cs.map((c) => ({ tipo: c.tipo, marcoMes: c.marcoMes, mesPagamento: c.mesPagamento }));

test('âncoras da API: repasse fora do cronograma não é divergente e o Aplicar o reancora', () => {
  const derivado = planoDaTela(CRONO);
  const repasseDerivado = derivado.componentes.find((c: any) => c.tipo === 'concentrado').mesPagamento;
  const daApi = structuredClone(derivado);
  daApi.componentes.find((c: any) => c.tipo === 'concentrado').mesPagamento = repasseDerivado + 2;

  assert.equal(espelhoDescreveComponentes(daApi, CRONO), true);
  const form = formularioPagamentoDoPlano(daApi, CRONO);
  assert.equal(form.espelhoDivergente, undefined, 'o modal fica editável');
  const salvo = componentesParaSalvar(form, CRONO, AA) as any[];
  assert.equal(salvo.find((c) => c.tipo === 'concentrado').mesPagamento, repasseDerivado, 'o repasse segue o Cronograma');
});

test('âncoras da API: marco fora do cronograma não é divergente e o Aplicar o reancora', () => {
  const derivado = planoDaTela(CRONO);
  const marcoDerivado = derivado.componentes.find((c: any) => c.tipo === 'ate_marco').marcoMes;
  const daApi = structuredClone(derivado);
  daApi.componentes.find((c: any) => c.tipo === 'ate_marco').marcoMes = marcoDerivado + 3;

  assert.equal(espelhoDescreveComponentes(daApi, CRONO), true);
  const salvo = componentesParaSalvar(formularioPagamentoDoPlano(daApi, CRONO), CRONO, AA) as any[];
  assert.equal(salvo.find((c) => c.tipo === 'ate_marco').marcoMes, marcoDerivado);
});

test('âncoras da tela: plano aplicado e Cronograma mudado depois segue a mesma regra', () => {
  const antigo = planoDaTela(CRONO);
  assert.equal(espelhoDescreveComponentes(antigo, CRONO_LONGO), true);
  const salvo = componentesParaSalvar(formularioPagamentoDoPlano(antigo, CRONO_LONGO), CRONO_LONGO, AA) as any[];
  assert.deepEqual(ancoras(salvo), ancoras(planoDaTela(CRONO_LONGO).componentes));
});

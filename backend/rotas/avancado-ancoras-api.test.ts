// A rota usa a mesma regra do modal: âncora de calendário fora do Cronograma
// (repasse ou marco) não gera `espelho_divergente` — o plano segue o Cronograma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respostaFaseComAviso } from './avancado.js';
import { fluxoPagamentoParaSalvar, formularioPagamento } from '../../frontend/fluxo-pagamento-editor.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];

test('PATCH da fase: repasse fora do Cronograma responde sem espelho_divergente', () => {
  const fp: any = fluxoPagamentoParaSalvar(formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 12 }],
    repasse: { apos_entrega_meses: 1 },
  }), CRONO, 12);
  fp.componentes.find((c: any) => c.tipo === 'concentrado').mesPagamento += 2;
  assert.equal('espelho_divergente' in respostaFaseComAviso({ id: 1 }, fp, CRONO), false);
});

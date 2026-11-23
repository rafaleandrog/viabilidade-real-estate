import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisoRegimeOculto } from './imposto-regime.js';

// #834, fatia 3 — o Salvar do regime do imposto valida as DUAS alíquotas; quando
// a inválida está no regime que não está à vista, a caixa diz por quê.

test('#834 avisoRegimeOculto: nomeia a alíquota inválida do regime oculto', () => {
  assert.match(String(avisoRegimeOculto({ regime: 'ret', retPct: 4, padraoPct: -5 })), /alíquota do imposto padrão está fora de 0 a 100/);
  assert.match(String(avisoRegimeOculto({ regime: 'padrao', retPct: 150, padraoPct: 7 })), /alíquota do RET está fora de 0 a 100/);
});

test('#834 avisoRegimeOculto: nada a avisar quando o regime oculto é válido', () => {
  assert.equal(avisoRegimeOculto({ regime: 'ret', retPct: 4, padraoPct: 7 }), null);
  // A inválida à vista já tem o erro no próprio campo: não é aviso de regime oculto.
  assert.equal(avisoRegimeOculto({ regime: 'ret', retPct: -1, padraoPct: 7 }), null);
});

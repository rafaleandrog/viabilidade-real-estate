// Caso de render: variante `falta` de `graficos-alocacao-tolerancia.ts` — 3 × 30%
// sobre 300.000 m² deixa 30.000 m² sem alocar e o aviso tem que aparecer.

import { fabricar } from '../fabrica-graficos-alocacao.js';

export const caso = fabricar('graficos-alocacao-falta', [30, 30, 30], 1);

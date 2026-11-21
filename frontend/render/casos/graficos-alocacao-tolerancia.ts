// Caso de render: aba GRÁFICOS do Preliminar com 3 produtos a 33,3333% sobre
// uma base de 300.000 m² (Σ = 99,9999%, diferença −0,30 m²). Mede FIAÇÃO: a
// faixa de consistência decide pela tolerância de Premissas
// (`estadoConsistenciaAlocacao`), não pela diferença em m² crua. Voltar
// `_renderConsistencia` a `diferencaAreaAlocada > 0 / < 0` deixa a suíte de
// lógica pura verde e faz este caso ver o aviso falso.
// A variante `falta` (pct 90%) prova o lado oposto: o aviso continua aparecendo.

import { fabricar } from '../fabrica-graficos-alocacao.js';

export const caso = fabricar('graficos-alocacao-tolerancia', [33.3333, 33.3333, 33.3333], 0);

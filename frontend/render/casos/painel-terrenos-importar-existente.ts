// Caso de render: importar por cima de um lote que JÁ tem registro.
//
// O CSV traz só `cmax` (como o da etapa 1). O registro existente tem `coef_minimo` editado à mão. O
// item enviado não pode levar `coef_minimo` nem `null` nenhum (reimportar não apaga o que a planilha não
// traz) e não pode regravar o carimbo (reconfirmar é ação do modal do lote).

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoComFiltros, montarCaso } from './painel-terrenos-regularizacao.js';
import { REGISTRO } from './painel-terrenos-parametros.js';
import { medirImportar } from './painel-terrenos-importar.js';

const CSV = `logradouro;numero;area_m2;cmax
Amsterdam;4910;300;3.5
`;

export const caso = {
  nome: 'painel-terrenos-importar-existente',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoComFiltros, 'urbi-modal.title'],
  montar: montarCaso('ok', [REGISTRO]),
  medir: (raiz: HTMLElement) => medirImportar(raiz, CSV),
};

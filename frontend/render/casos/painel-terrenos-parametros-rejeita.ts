// Caso de render: aba Terrenos com a leitura dos parâmetros FALHANDO (modo `rejeita`).
// O modal não pode abrir editável sobre formulário vazio: o PUT manda todos os campos e zeraria o
// registro que existe. Ver `painel-terrenos-parametros.ts`.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';
import { medirParametros } from './painel-terrenos-parametros.js';

export const caso = {
  nome: 'painel-terrenos-parametros-rejeita',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-banner.variante', 'urbi-modal.title'],
  montar: montarCaso('ok', 'rejeita'),
  medir: medirParametros,
};

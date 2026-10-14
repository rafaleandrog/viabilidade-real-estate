// Caso de render: aba Terrenos com a leitura dos complementos FALHANDO — a requisição lança (falha de rede).
// O modal não pode abrir editável sobre formulário vazio: o PUT manda todos os campos e zeraria o
// registro que existe. Ver `painel-terrenos-complemento.ts`.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';
import { medirComplemento } from './painel-terrenos-complemento.js';

export const caso = {
  nome: 'painel-terrenos-complemento-rejeita',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-banner.variante', 'urbi-modal.title'],
  montar: montarCaso('ok', 'rejeita'),
  medir: medirComplemento,
};

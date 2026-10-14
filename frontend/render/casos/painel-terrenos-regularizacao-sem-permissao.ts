// Caso de render: aba Terrenos do Painel com a leitura de `parcelamentos` negada (403).
// Fail-closed — ver `painel-terrenos-regularizacao.ts`.

import { aceitaNaoReproduzidoBase, montarCaso, medirCaso } from './painel-terrenos-regularizacao.js';

export const caso = {
  nome: 'painel-terrenos-regularizacao-sem-permissao',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-banner.variante'],
  montar: montarCaso('sem-permissao'),
  medir: medirCaso,
};

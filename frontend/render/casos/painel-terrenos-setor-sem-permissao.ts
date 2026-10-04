// Caso de render: aba Terrenos do Painel com a leitura de `setores_habitacionais` negada (403).
// Fail-closed — ver `painel-terrenos-setor-urbita.ts`.

import { aceitaNaoReproduzidoBase, montarCaso, medirCaso } from './painel-terrenos-setor-urbita.js';

export const caso = {
  nome: 'painel-terrenos-setor-sem-permissao',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-banner.variante'],
  montar: montarCaso('sem-permissao'),
  medir: medirCaso,
};

// Caso de render: aba Terrenos do Painel com setores cadastrados, nenhum deles Urbitá.
// Resposta, não falha: esconde os lotes, avisa, e a aba fica carregada (sem repetir a varredura).
// Ver `painel-terrenos-setor-urbita.ts`.

import { aceitaNaoReproduzidoBase, montarCaso, medirCaso } from './painel-terrenos-setor-urbita.js';

export const caso = {
  nome: 'painel-terrenos-setor-inexistente',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-banner.variante'],
  montar: montarCaso('sem-setor'),
  medir: medirCaso,
};

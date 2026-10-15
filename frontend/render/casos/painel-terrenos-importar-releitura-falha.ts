// Caso de render: a importação grava, mas a releitura dos registros FALHA (resposta de erro).
//
// O cache fica velho; com o modal editável o próximo Salvar mandaria os valores antigos e desfaria a
// importação. O Painel tem que tratar como falha de leitura: aviso, edição bloqueada, aba "não carregada"
// (volta a ela recarrega) — e o resumo da importação continua dizendo a verdade (gravou).

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';
import { CSV, medirImportar } from './painel-terrenos-importar.js';

export const caso = {
  nome: 'painel-terrenos-importar-releitura-falha',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-modal.title', 'urbi-banner.variante'],
  montar: montarCaso('ok', []),
  medir: (raiz: HTMLElement) => medirImportar(raiz, CSV, true),
};

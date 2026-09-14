// Caso de render standalone: <viab-grafico-barra-ranqueada> (Rodada 12, PR4).

import '../../grafico-barra-ranqueada.js';
import { forcarEstado } from './dados.js';

const ITENS = [
  { l: 'Construção', v: 12_500_000 },
  { l: 'Terreno', v: 3_000_000 },
  { l: 'Projetos', v: 400_000 },
  { l: 'Decoração', v: 250_000 },
  { l: 'Gestão da construção', v: 180_000 },
];

export const caso = {
  nome: 'grafico-barra-ranqueada',
  exigir: [
    { seletor: 'div.linha', minimo: 5 },
    { seletor: 'div.trilho', minimo: 5 },
    { seletor: 'div.barra', minimo: 5 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-grafico-barra-ranqueada');
    forcarEstado(el, { itens: ITENS });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

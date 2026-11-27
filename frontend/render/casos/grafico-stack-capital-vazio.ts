// Caso de render: a torre sem nenhuma camada com valor (estudo sem operação e
// que nunca fica no vermelho — só o incorporador, com valor zero). No lugar da
// torre, uma linha de texto: "Nenhuma camada com valor."

import '../../grafico-stack-capital.js';
import { corDoTipo } from '../../funding-cores.js';
import { forcarEstado } from './dados.js';

export const caso = {
  nome: 'grafico-stack-capital-vazio',
  exigir: [{ seletor: 'p.vazio', minimo: 1 }],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-grafico-stack-capital');
    forcarEstado(el, {
      camadas: [{
        id: 'incorporador', tipo: 'incorporador', nome: 'Incorporador', nivel: 'recebe por último',
        valor: 0, pct: null, cor: corDoTipo('incorporador'),
      }],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement) {
    const sr = (raiz.querySelector('viab-grafico-stack-capital') as any).shadowRoot as ShadowRoot;
    return {
      texto: sr.querySelector('p.vazio')?.textContent?.trim() ?? null,
      torres: sr.querySelectorAll('div.torre').length,
    };
  },
};

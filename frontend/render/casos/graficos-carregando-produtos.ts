// Caso de render: a aba GRÁFICOS do Preliminar ENQUANTO o catálogo de Produtos
// ainda não chegou (a busca nunca resolve). Mede a guarda "sem piscar" de
// `render()` em `tela-graficos.ts` (`this.produtosCarregados && p.semProdutos`):
// antes da carga `produtos` é `[]` e `semProdutos` é verdadeiro, e só o portão
// de carga impede o estado vazio de piscar para quem TEM catálogo. Remover
// `this.produtosCarregados &&` deixa a suíte de lógica pura verde; o que fica
// vermelho é a negação do estado vazio abaixo.
//
// O harness só sabe EXIGIR presença, então a ausência do estado vazio é medida
// por `medir`, e o teste a afirma.

import '../../tela-graficos.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'graficos-carregando-produtos',
  // O ramo normal está na tela (faixa de KPIs), o que prova que a medição é
  // do estado "carregando" e não de uma tela vazia.
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    { seletor: 'div.kpis-preliminar', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = (rota: string) => {
      // O catálogo NUNCA chega: a tela fica no estado "carregando".
      if (rota.includes('/preliminar/produtos')) return new Promise(() => {});
      return Promise.resolve({ dados: [] });
    };
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO });
    raiz.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{ estadoVazio: number; estadoVazioWrapper: number; kpis: number }> {
    const sr = (raiz.querySelector('viab-tela-graficos') as any).shadowRoot!;
    return {
      estadoVazio: sr.querySelectorAll('urbi-estado-vazio').length,
      estadoVazioWrapper: sr.querySelectorAll('div.gr-vazio').length,
      kpis: sr.querySelectorAll('div.kpis-preliminar').length,
    };
  },
};

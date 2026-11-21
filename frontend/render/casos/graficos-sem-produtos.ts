// Caso de render: a aba GRÁFICOS do Preliminar com o catálogo carregado e
// VAZIO. Mede FIAÇÃO: o ramo de `semProdutos` em `render()` de
// `tela-graficos.ts`. Apagá-lo deixa a suíte de lógica pura verde; o que fica
// vermelho é o `exigir` abaixo, que pede o estado vazio E nega a cascata.

import '../../tela-graficos.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'graficos-sem-produtos',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    // O seletor é o WRAPPER: o stub do harness não desenha o miolo do
    // primitivo (0 de altura), então o `urbi-estado-vazio` não conta como
    // visível. Mesma decisão de `proforma-sem-produtos.ts`.
    { seletor: 'div.gr-vazio', minimo: 1 },
  ],
  // Sem a cascata: o `viab-grafico-cascata` e a faixa de KPIs só existem no
  // ramo com produtos. `exigir` só sabe exigir presença, então a ausência é
  // medida por `medir` e afirmada pelo teste. (`naoDeclaradas` NÃO serve para
  // isso: o harness só confronta primitivos do espelho e ignora `viab-*`.)
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-estado-vazio.submensagem',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO });
    raiz.appendChild(el);
    // `_init()` é assíncrono: espera o catálogo (vazio) chegar antes de medir,
    // senão o caso mediria o estado "carregando".
    await new Promise((r) => setTimeout(r, 50));
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{ cascata: number; kpis: number }> {
    const sr = (raiz.querySelector('viab-tela-graficos') as any).shadowRoot!;
    return {
      cascata: sr.querySelectorAll('viab-grafico-cascata').length,
      kpis: sr.querySelectorAll('div.kpis-preliminar').length,
    };
  },
};

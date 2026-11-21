// Fábrica dos casos `graficos-alocacao-*` (um arquivo por caso, o harness exige
// `caso` único por arquivo). Ver `casos/graficos-alocacao-tolerancia.ts`.

import '../tela-graficos.js';
import { ESTUDO, forcarEstado } from './casos/dados.js';

const ESTUDO_BASE = { ...ESTUDO, area_pvt_r_fechada: 300_000, area_pvt_nr_fechada: 0 };
const mk = (pcts: number[]) => pcts.map((pct, i) => ({
  id: i + 1, nome: `Produto ${i + 1}`, ordem: i, pct_alv: pct, unidades: 100, preco_venda_m2: 11_000,
}));

export function fabricar(nome: string, pcts: number[], minimoAviso: number) {
  return {
    nome,
    exigir: [
      { seletor: 'urbi-card', minimo: 1 },
      // Prova que a medição é da tela com catálogo, não de uma tela vazia.
      { seletor: 'div.kpis-preliminar', minimo: 1 },
      ...(minimoAviso > 0 ? [{ seletor: 'urbi-banner.aviso-consistencia', minimo: minimoAviso }] : []),
    ],
    aceitaNaoReproduzido: minimoAviso > 0 ? ['urbi-card.titulo', 'urbi-banner.variante'] : ['urbi-card.titulo'],
    async montar(raiz: HTMLElement): Promise<void> {
      (globalThis as any).urbiVerso.api = async (rota: string) => {
        if (rota.includes('/preliminar/produtos')) return { dados: mk(pcts) };
        return { dados: [] };
      };
      const el = document.createElement('viab-tela-graficos');
      forcarEstado(el, { estudo: ESTUDO_BASE });
      raiz.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));
      await (el as any).updateComplete;
    },
    async medir(raiz: HTMLElement): Promise<{ avisos: number; kpis: number }> {
      const sr = (raiz.querySelector('viab-tela-graficos') as any).shadowRoot!;
      return {
        avisos: sr.querySelectorAll('urbi-banner.aviso-consistencia').length,
        kpis: sr.querySelectorAll('div.kpis-preliminar').length,
      };
    },
  };
}


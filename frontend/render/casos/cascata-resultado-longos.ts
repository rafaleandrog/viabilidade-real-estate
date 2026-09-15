// Caso de render: a cascata do resultado (aba Gráficos, Preliminar/tela
// inteira) com um VGV de 9 DÍGITOS (#579 — "o valor salta para fora do
// quadro do KPI").
//
// Substitui `resultado-graficos.ts` (Rodada 12) — o card `div.resultado >
// urbi-kpi` que aquele caso media deixou de existir quando a cascata
// substituiu a pizza de custos e o gráfico Receita×Custos. Este caso herda o
// papel: provar que um valor grande não estoura a coluna de valor (~78px) da
// cascata, medindo `transbordoDeCaixa` — a lente que aponta caixa real
// vazando do pai, não o transbordo de texto/corte já sabido e não
// asseverado nas colunas estreitas de rótulo.

import '../../tela-graficos.js';
import { ESTUDO, PRODUTOS_VALORES_LONGOS, forcarEstado } from './dados.js';

export const caso = {
  nome: 'cascata-resultado-longos',
  exigir: [
    { seletor: 'viab-grafico-cascata', minimo: 1 },
    { seletor: 'div.linha', minimo: 5 },
    { seletor: 'span.kpi-valor', minimo: 5 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_VALORES_LONGOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

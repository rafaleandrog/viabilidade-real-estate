// Caso de render: o card "Resultado" da aba Gráficos (Preliminar/Avançado
// compartilhado — `tela-graficos.ts` é usada pelas duas, ver
// `frontend/tela-preliminar.ts:136` e `frontend/tela-avancado.ts:230`) com um
// VGV de 9 DÍGITOS (#579 — "o VALOR salta para fora do quadro do KPI").
//
// Mesmo padrão de `medidores-graficos.ts`: mocka `/preliminar/produtos` e
// deixa `_init()` (real) montar o `Proforma` de verdade via `calcularProforma`.
// `produtos.produtos` é a ÚNICA fonte de VGV do Preliminar
// (`frontend/proforma.ts:67`) — por isso o catálogo, não `ESTUDO`, é o que
// precisa dos valores grandes (`PRODUTOS_VALORES_LONGOS`).
//
// O card `.resultado > urbi-kpi` (`frontend/tela-graficos.ts:172`) NÃO mora
// numa track estreita — é filho solto de `.resultado`, dentro do segundo
// `urbi-card` do grid `.graficos` (minmax(300px, 1fr)) — bem mais folgado que
// o Resumo/Fluxo de Caixa. Este caso confere se essa folga é suficiente na
// prática, nas 3 larguras padrão.

import '../../tela-graficos.js';
import { ESTUDO, PRODUTOS_VALORES_LONGOS, forcarEstado } from './dados.js';

export const caso = {
  nome: 'resultado-graficos',
  exigir: [
    { seletor: 'div.resultado', minimo: 1 },
    { seletor: 'urbi-kpi', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-checkbox.label',
    'urbi-grafico-colunas.categorias',
    'urbi-grafico-colunas.empilhado',
    'urbi-grafico-colunas.formato',
    'urbi-grafico-colunas.legenda',
    'urbi-grafico-colunas.series',
    'urbi-grafico-pizza.categorias',
    'urbi-grafico-pizza.formato',
    'urbi-grafico-pizza.series',
    'urbi-card.titulo',
    'urbi-kpi.variante',
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

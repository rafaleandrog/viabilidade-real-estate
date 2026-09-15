// Caso de render: a faixa de 5 KPIs da aba Gráficos do Preliminar (Rodada 12,
// handoff de KPIs/gráficos §3.1) — VGV do incorporador, Resultado final,
// Margem sobre VGV de tabela, Margem sobre receita líquida, Custo obras/VGV.
//
// Mesmo padrão de `medidores-graficos.ts`: mocka `/benchmarks` e
// `/preliminar/produtos` e deixa `_init()` (real) montar o `Proforma` de
// verdade via `calcularProforma`.

import '../../tela-graficos.js';
import { ESTUDO, PRODUTOS, forcarEstado } from './dados.js';

export const caso = {
  nome: 'kpis-graficos-preliminar',
  exigir: [
    { seletor: 'div.kpis-preliminar', minimo: 1 },
    // As 5 grandezas do handoff — rótulo, valor e rodapé (denominador) são o
    // requisito da seção 3.1, não enfeite; provar os 3 seletores é provar que
    // o denominador chegou à tela, não só o número.
    { seletor: 'span.kpi-rotulo', minimo: 5 },
    { seletor: 'span.kpi-valor', minimo: 5 },
    { seletor: 'span.kpi-rodape', minimo: 5 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

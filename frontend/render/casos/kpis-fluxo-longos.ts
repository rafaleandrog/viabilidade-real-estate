// Caso de render: os 9 `.kpi-card` do Fluxo de Caixa com VALORES DE 9 DÍGITOS
// (#579 — "o VALOR salta para fora do quadro do KPI").
//
// Espelha `tabela-fluxo.ts` (mesmo componente, mesmo fixture de receitas/
// custos/cronograma) e difere só no `calc`: aqui é `fluxoValoresLongos()`, não
// `fluxo()`. Caso PRÓPRIO, não uma edição do `tabela-fluxo.ts` existente —
// aquele caso alimenta as outras ~30 asserções de `tabela-fluxo.render.test.ts`
// (células da tabela, sensibilidade, cores…), e trocar o `calc` ali mudaria o
// que elas medem sem relação com esta issue. Este caso mede só a faixa de
// KPIs (`.fx-kpis`).
//
// ⚠️ #596: esta grade já era reusada por `tela-cenarios.ts`, que tinha ali o
// urbi-kpi "Resultado após custo financeiro". Aquele KPI saiu, e com ele o
// único `urbi-kpi` que alcançava `.fx-kpis` — hoje a grade só carrega os
// `.kpi-card` de markup próprio.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, fluxoValoresLongos, forcarEstado } from './dados.js';

export const caso = {
  nome: 'kpis-fluxo-longos',
  exigir: [
    { seletor: 'div.fx-kpis', minimo: 1 },
    { seletor: 'div.kpi-card', minimo: 9 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-ver');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: fluxoValoresLongos(),
      vista: 'fluxo-caixa',
      visao: 'mensal',
      colapso: {},
      operacoes: [],
      fundingCalc: null,
      funding: null,
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS, custos: CUSTOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

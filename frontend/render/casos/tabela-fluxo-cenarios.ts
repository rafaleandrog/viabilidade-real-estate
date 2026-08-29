// Caso de render: a TABELA DE FLUXO DA ABA CENÁRIOS, com funding (#596).
//
// ⚠️ POR QUE EXISTE UM SEGUNDO CASO, se a tabela é a mesma função.
// Justamente porque "é a mesma função" é a HIPÓTESE que a #596 manda provar, e
// o caso irmão `tabela-fluxo-funding.ts` monta `viab-fluxo-ver` — ele afere a
// aba Resultados e não toca em Cenários. Uma função pura correta que a segunda
// tela não chama, ou chama com argumento diferente, é a classe de defeito nº 1
// do `CLAUDE.md`, medida em quatro PRs da Rodada 9. Este caso é a única camada
// que enxerga "a tabela de Cenários não montou".
//
// Os seletores são DELIBERADAMENTE os mesmos do caso irmão — inclusive a ordem
// pelo combinador `~` (irmão geral), que é o que torna "vem depois" verificável
// no DOM. Se as duas telas divergirem, um dos dois casos fica vermelho.
//
// ⚠️ Cenários monta a tabela a partir do `baseConfig` e RODA O MOTOR sozinha
// (`_calc` → `calcularFluxo(aplicarCenario(...))`), em vez de receber um
// `FluxoCalc` pronto como `viab-fluxo-ver`. Por isso a fixture aqui é a
// CONFIGURAÇÃO, não o cálculo: forçar um `calc` pronto pularia exatamente o
// caminho que esta issue quer aferir.

import '../../tela-cenarios.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, OPERACOES_FUNDING, forcarEstado } from './dados.js';

export const caso = {
  nome: 'tabela-fluxo-cenarios',
  exigir: [
    { seletor: 'table.fx', minimo: 1 },
    // As duas seções de fecho, cada uma com as suas duas linhas.
    { seletor: 'table.fx tbody tr.resultado[data-linha="fcl-mensal"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.resultado[data-linha="fcl-acumulado"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.resultado[data-linha="fc-mensal"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.resultado[data-linha="fc-acumulado"]', minimo: 1 },
    // Os dois blocos de funding, com a natureza certa (entrada = receita,
    // saída = custo) — trocar a natureza troca a cor da faixa (#591).
    { seletor: 'table.fx tbody tr.grupo.receita[data-linha="funding-entradas"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.grupo.custo[data-linha="funding-saidas"]', minimo: 1 },
    // A ORDEM: o Livre fecha ANTES das duas pontas, o Fluxo de Caixa DEPOIS.
    { seletor: 'tr[data-linha="fcl-acumulado"] ~ tr[data-linha="funding-entradas"]', minimo: 1 },
    { seletor: 'tr[data-linha="funding-entradas"] ~ tr[data-linha="funding-saidas"]', minimo: 1 },
    { seletor: 'tr[data-linha="funding-saidas"] ~ tr[data-linha="fc-mensal"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    // Exclusivos de Cenários: os sliders e o gráfico de comparação, que vivem
    // acima da tabela medida.
    'urbi-grafico-linha.categorias',
    'urbi-grafico-linha.formato',
    'urbi-grafico-linha.legenda',
    'urbi-grafico-linha.marcadores',
    'urbi-grafico-linha.series',
    'urbi-kpi.variante',
    'urbi-botao.desabilitado',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-icone.classe',
    'urbi-input.label',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-cenarios');
    forcarEstado(el, {
      carregando: false,
      // ⚠️ `operacoesFunding` no config NÃO é decoração (#446): é ele que
      // estica o horizonte até a quitação. Sem ele a série sai truncada e a
      // tabela fecha no meio da amortização, sem erro em lugar nenhum.
      baseConfig: {
        dataInicio: DATA_INICIO,
        taxaDescontoAa: 12,
        cronograma: CRONO,
        linhasReceita: RECEITAS,
        linhasCusto: CUSTOS,
        curvas: [],
        areaTerreno: 4_800,
        ret: { ativo: true, pct: 4 },
        operacoesFunding: OPERACOES_FUNDING,
      },
      crono: CRONO,
      dataInicio: DATA_INICIO,
      operacoes: OPERACOES_FUNDING,
      cenarios: [],
      colapso: {},
      visao: 'mensal',
      precoPct: 0,
      custoPct: 0,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

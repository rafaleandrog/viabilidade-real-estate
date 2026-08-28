// Caso de render: rótulos de MARCO no topo dos gráficos de Fluxo de Caixa
// (aba Resumo, Avançado) — #582.
//
// `graficoFluxoAcumulado` não tinha NENHUMA detecção de colisão para os
// rótulos de marco (Lançamento, Início/Fim Obra), Payback e Exposição Máx. —
// os quatro disputam a mesma faixa superior do SVG com `y` constante. Quando
// dois marcos caem a poucos meses um do outro (Lançamento e Início da Obra,
// tipicamente), os textos imprimiam em cima um do outro. `graficoFluxoMensal`
// tinha uma tentativa (`(idx % 2) * 10`), mas só alterna DOIS níveis por
// paridade de índice — três marcos próximos ainda colidem dois a dois.
//
// Por que ISTO precisa de render, e não só do teste de função pura
// (`frontend/fluxo-graficos.test.ts`): a função `resolverColisoesRotulos` ser
// correta não prova que os dois gráficos a CHAMAM — é exatamente a classe de
// defeito "mora na fiação, não no cálculo" que o CLAUDE.md nomeia. Medido: ao
// apagar a chamada em `graficoFluxoAcumulado`/`graficoFluxoMensal` (voltando
// ao `y` constante / `(idx % 2) * 10` originais), este caso reprova por
// `sobreposicaoTexto` — a lente que `scripts/render-check.mjs` ganhou junto
// com este PR, complementar à `sobreposicao` de "caixas pintadas", que exclui
// toda forma de SVG de propósito (path cruza text por projeto).
//
// Duas instâncias, os dois casos-limite do critério de aceite:
//  · Incorporação — Lançamento e Início Obra a 2 meses um do outro
//    (critério #582.1, "não se sobrepõem");
//  · Loteamento — os TRÊS marcos no mesmo mês (critério #582.2, o extremo
//    explícito "três marcos no mesmo mês… a decisão de desenho é do PR").
// `marcos()` lê `EventoCrono` sem ramificar por `tipo_empreendimento` — os
// dois padrões usam o MESMO formato de cronograma (`avancado_fases`), então
// as duas instâncias abaixo provam paridade por construção, não por
// coincidência (critério #582.6).

import '../../tela-resumo.js';
import { calcularFluxo, type FluxoCalc } from '../../fluxo-caixa-motor.js';
import type { EventoCrono } from '../../fluxo-shared.js';
import { DATA_INICIO, RECEITAS, CUSTOS, forcarEstado } from './dados.js';

// Lançamento (mês 4) e Início Obra (mês 6) — 2 meses de distância, o próprio
// limite do critério de aceite #582.1 ("Lançamento e Início Obra distam ≤ 2
// meses"). Fim Obra bem mais adiante, fora da faixa de colisão.
const CRONO_INCORPORACAO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 4 },
  { evento: 'lancamento', inicio_mes: 4, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 6, duracao_meses: 20 },
  { evento: 'pos_obra', inicio_mes: 26, duracao_meses: 6 },
];

// Lançamento e Início Obra no MESMO mês, com `duracao_meses: 1` — Início Obra
// e Fim Obra também coincidem. Os TRÊS marcos de `marcos()` caem em `mes: 10`
// — o extremo citado pelo critério #582.2.
const CRONO_LOTEAMENTO: EventoCrono[] = [
  { evento: 'lancamento', inicio_mes: 10, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 10, duracao_meses: 1 },
  { evento: 'pos_obra', inicio_mes: 11, duracao_meses: 6 },
];

// Receitas/custos são o fixture genérico de `dados.ts` (o mesmo dos demais
// casos de render) — este caso mede a faixa de rótulos no TOPO do gráfico,
// não a consistência entre Cronograma e Custos, que são abas independentes
// no app de verdade (nada aqui impede um usuário real de ter os dois fora de
// sincronia, como qualquer outro estudo).
function calc(cronograma: EventoCrono[]): FluxoCalc {
  return calcularFluxo({
    dataInicio: DATA_INICIO, taxaDescontoAa: 12, cronograma,
    linhasReceita: RECEITAS, linhasCusto: CUSTOS, curvas: [],
    areaTerreno: 4_800, ret: { ativo: true, pct: 4 },
  });
}

export const caso = {
  nome: 'marcos-fluxo-colados',
  exigir: [
    { seletor: 'viab-tela-resumo', minimo: 2 },
    { seletor: 'svg[aria-label="Fluxo de caixa acumulado"]', minimo: 2 },
    { seletor: 'svg[aria-label="Fluxo de caixa mensal"]', minimo: 2 },
    { seletor: 'urbi-kpi', minimo: 14 },
  ],
  // Mesma lista de `casos/kpis-resumo.ts` — mesmo componente (`viab-tela-resumo`),
  // mesmo conjunto de primitivos fora da faixa de rótulos que este caso mede.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-grafico-pizza.categorias',
    'urbi-grafico-pizza.formato',
    'urbi-grafico-pizza.series',
    'urbi-kpi.variante',
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const incorporacao = document.createElement('viab-tela-resumo');
    // `estudo` fica NULO de propósito — como em `casos/kpis-resumo.ts` — para
    // não disparar carregamento por API; o estado já calculado entra direto.
    forcarEstado(incorporacao, {
      carregando: false,
      calc: calc(CRONO_INCORPORACAO),
      benchmarks: [],
      dados: { crono: CRONO_INCORPORACAO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    raiz.appendChild(incorporacao);

    const loteamento = document.createElement('viab-tela-resumo');
    forcarEstado(loteamento, {
      carregando: false,
      calc: calc(CRONO_LOTEAMENTO),
      benchmarks: [],
      dados: { crono: CRONO_LOTEAMENTO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    raiz.appendChild(loteamento);

    await Promise.all([
      (incorporacao as any).updateComplete,
      (loteamento as any).updateComplete,
    ]);
  },
};

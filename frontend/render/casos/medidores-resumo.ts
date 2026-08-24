// Render dos MEDIDORES vs. benchmark, aba Resumo (Avançado) — #451 etapa 1
// (a metade que faltou no PR 533).
//
// Espelha `casos/medidores-graficos.ts` (o Preliminar, já mergeado): a
// régua lê os 9 benchmarks configurados via `resolverIndicadoresBenchmark`
// (função pura, testada em `benchmarks-indicadores.test.ts`) e o estado
// "fora da escala" vem de `montarMedidor` (testado em
// `medidor-faixas.test.ts`). Nenhum dos dois testes de lógica pura prova
// que `tela-resumo.ts` de fato os CHAMA com a lista certa — medido por
// mutação no PR 533: voltar a chamada de `tela-graficos.ts` ao `MAPA`
// antigo de dois campos deixou a suíte de lógica pura 100% verde, e só o
// harness de render em Chromium reprovou. Este caso é quem mede a FIAÇÃO
// para o Avançado.
//
// O `exigir` de `urbi-badge.fora-escala` é a prova: sem a chamada ligada
// aos 4 indicadores (não só os 2 antigos) e sem o `foraEscala` propagado ao
// template, o seletor não casa nada e o harness rejeita o caso.

import '../../tela-resumo.js';
import { CRONO, DATA_INICIO, fluxo, forcarEstado } from './dados.js';

// Valores REAIS do `FluxoCalc` de `fluxo()` (conferidos rodando
// `calcularFluxo` com os dados deste espelho, no PR): `custoObrasVgvPct` ≈
// 51,32, `margemLiquidaPct` ≈ 21,62, `roiPct` ≈ 29,07. Os limites abaixo são
// calibrados para deixar dois de cada tipo — dentro e fora da escala — nos 4
// campos que `resolverIndicadoresBenchmark` reconhece hoje. `roi` reusa a
// meta e o medidor REAIS da semente (`backend/rotas/benchmarks.ts:25-31`:
// 11/18/22/29), que já estouram o valor deste espelho por construção.
const BENCHMARKS = [
  // FORA da escala (acima do máximo) — nao_exceder. 51,32 > 25.
  { id: 1, campo: 'custo_obras_vgv', valor: 35, regra_comparacao: 'nao_exceder',
    medidor_min: 10, medidor_faixa1_ate: 15, medidor_faixa2_ate: 20, medidor_max: 25 },
  // DENTRO da escala — atingir_ou_superar. 21,62 em [15, 35].
  { id: 2, campo: 'margem_liquida', valor: 20, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 15, medidor_faixa1_ate: 25, medidor_faixa2_ate: 30, medidor_max: 35 },
  // DENTRO da escala — a entrada NOVA no Avançado (não existia no MAPA de 2
  // campos antes da #451). 21,62 em [12, 35].
  { id: 3, campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 12, medidor_faixa1_ate: 18, medidor_faixa2_ate: 25, medidor_max: 35 },
  // FORA da escala — a outra entrada NOVA, com a meta e o medidor REAIS da
  // semente (11/18/22/29). 29,07 > 29.
  { id: 4, campo: 'roi', valor: 15, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 11, medidor_faixa1_ate: 18, medidor_faixa2_ate: 22, medidor_max: 29 },
  // Sem indicador correspondente hoje (#453) — prova que ele é DESCARTADO,
  // não que trava a tela nem que aparece com valor errado.
  { id: 5, campo: 'margem_bruta', valor: 30, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 30, medidor_faixa1_ate: 40, medidor_faixa2_ate: 50, medidor_max: 70 },
  // Indicador de sensibilidade — também descartado, motivo diferente.
  { id: 6, campo: 'preco', valor: 0, regra_comparacao: 'atingir_ou_superar' },
];

export const caso = {
  nome: 'medidores-resumo',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    // Os 4 indicadores que `resolverIndicadoresBenchmark` reconhece hoje —
    // não só os 2 que o `MAPA` hardcoded lia antes da #451.
    { seletor: 'urbi-grafico-medidor', minimo: 4 },
    // A prova de fiação do estado novo: sem `cfg.foraEscala` chegando ao
    // template, este seletor não casa nada.
    { seletor: 'urbi-badge.fora-escala', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    // O espelho não desenha o ponteiro do velocímetro nem a legenda das 3
    // faixas por dentro — só o `:host` do primitivo.
    'urbi-grafico-medidor.faixas',
    'urbi-grafico-medidor.formato',
    'urbi-grafico-medidor.min',
    'urbi-grafico-medidor.max',
    'urbi-card.titulo',
    // `viab-tela-resumo` monta a aba INTEIRA (faixa de KPIs, gráficos de
    // fluxo, pizza de custos), não só a seção de medidores que este caso
    // mede — as props abaixo são dessas outras seções, sem restringir caixa
    // nenhuma que a asserção deste caso confira.
    'urbi-badge.cor',
    'urbi-kpi.variante',
    'urbi-grafico-pizza.categorias',
    'urbi-grafico-pizza.formato',
    'urbi-grafico-pizza.series',
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-resumo');
    // `estudo` fica NULO de propósito, como em `casos/kpis-resumo.ts` — é o
    // que impede o `updated()` de disparar carregamento por API. O estado já
    // carregado (inclusive os benchmarks acima) entra direto abaixo.
    forcarEstado(el, {
      carregando: false,
      calc: fluxo(),
      benchmarks: BENCHMARKS,
      dados: { crono: CRONO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

// Render dos MEDIDORES vs. benchmark, aba Gráficos (Preliminar) — #451.
//
// A régua lê os 9 benchmarks configurados via `resolverIndicadoresBenchmark`
// (função pura, testada em `benchmarks-indicadores.test.ts`) e o estado "fora
// da escala" vem de `montarMedidor` (testado em `medidor-faixas.test.ts`).
// Nenhum dos dois testes de lógica pura prova que `tela-graficos.ts` de fato
// os CHAMA com a lista certa: apagar a chamada em `_renderMedidores` — e só
// ela — deixaria a suíte de lógica pura inteiramente verde, porque nenhum
// teste dela monta a tela. Este caso é quem mede a FIAÇÃO, não o cálculo —
// mesmo padrão do `modal-absorcao` (#431) e do `proforma-avancada-funding`
// (#447).
//
// O `exigir` de `urbi-badge.fora-escala` é a prova: sem a chamada ligada aos
// 4 indicadores (não só os 2 antigos) e sem o `foraEscala` propagado ao
// template, o seletor não casa nada e o harness rejeita o caso — em vez de
// reportar "limpo" para uma tela que nunca desenhou o aviso.
//
// Os valores dos benchmarks abaixo NÃO são os medidos em Pinguim (dados.ts é
// deliberadamente pequeno e fixo — ver o topo daquele arquivo); o de `roi`
// reusa as metas REAIS da semente (`backend/rotas/benchmarks.ts:25-31`:
// 11/18/22/29) porque o `roiPct` do fixture (58%) já as estoura por
// construção, sem precisar inventar limite.

import '../../tela-graficos.js';
import { ESTUDO, PRODUTOS, forcarEstado } from './dados.js';

// `custoObrasVgvPct` ≈ 37,45 e `roiPct` ≈ 58,03 para o `ESTUDO` deste espelho
// (calculado por `calcularProforma`, conferido no PR). Os medidores abaixo
// são calibrados para deixar um de cada tipo — dentro e fora da escala — nos
// 4 campos que `resolverIndicadoresBenchmark` agora reconhece.
const BENCHMARKS = [
  // FORA da escala (acima do máximo) — nao_exceder.
  { id: 1, campo: 'custo_obras_vgv', valor: 35, regra_comparacao: 'nao_exceder',
    medidor_min: 10, medidor_faixa1_ate: 15, medidor_faixa2_ate: 20, medidor_max: 25 },
  // DENTRO da escala — atingir_ou_superar.
  { id: 2, campo: 'margem_liquida', valor: 20, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 15, medidor_faixa1_ate: 25, medidor_faixa2_ate: 35, medidor_max: 45 },
  // DENTRO da escala — a entrada NOVA (não existia no MAPA antes da #451).
  { id: 3, campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 12, medidor_faixa1_ate: 18, medidor_faixa2_ate: 25, medidor_max: 35 },
  // FORA da escala — a outra entrada NOVA, com a meta e o medidor REAIS da
  // semente (11/18/22/29).
  { id: 4, campo: 'roi', valor: 15, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 11, medidor_faixa1_ate: 18, medidor_faixa2_ate: 22, medidor_max: 29 },
  // Sem indicador correspondente hoje (#453) — prova que ele é DESCARTADO, não
  // que trava a tela nem que aparece com valor errado.
  { id: 5, campo: 'margem_bruta', valor: 30, regra_comparacao: 'atingir_ou_superar',
    medidor_min: 30, medidor_faixa1_ate: 40, medidor_faixa2_ate: 50, medidor_max: 70 },
  // Indicador de sensibilidade — também descartado, motivo diferente.
  { id: 6, campo: 'preco', valor: 0, regra_comparacao: 'atingir_ou_superar' },
];

export const caso = {
  nome: 'medidores-graficos',
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
    // faixas por dentro — só o `:host` do primitivo. O que este caso mede é
    // se o CONJUNTO certo de medidores (e o aviso) chega ao DOM, não o
    // desenho interno do `urbi-grafico-medidor`.
    'urbi-grafico-medidor.faixas',
    'urbi-grafico-medidor.formato',
    'urbi-grafico-medidor.min',
    'urbi-grafico-medidor.max',
    'urbi-card.titulo',
    // `viab-tela-graficos` monta a aba INTEIRA (pizza de custos, barras
    // Receita×Custos, faixa de KPIs), não só a seção de medidores que este
    // caso mede — as props abaixo são dessas outras seções, sem restringir
    // caixa nenhuma que a asserção deste caso confira.
    'urbi-badge.cor',
    'urbi-checkbox.label',
    'urbi-grafico-colunas.categorias',
    'urbi-grafico-colunas.empilhado',
    'urbi-grafico-colunas.formato',
    'urbi-grafico-colunas.legenda',
    'urbi-grafico-colunas.series',
    'urbi-grafico-pizza.categorias',
    'urbi-grafico-pizza.formato',
    'urbi-grafico-pizza.series',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Resposta específica de `/benchmarks` — mutação do MESMO objeto
    // `urbiVerso` que o script clássico do harness define (ver o comentário
    // em `scripts/render-check.mjs` sobre este padrão). `_init()` de
    // `tela-graficos.ts` chama `listarBenchmarks`/`buscarConfig` de verdade;
    // isto é o que faz o Preliminar carregar OS 4 benchmarks configurados
    // acima, em vez do `{ dados: [] }` default do espelho.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/benchmarks')) return { dados: BENCHMARKS };
      // O catálogo é a fonte do VGV, e `tela-graficos.ts` o carrega por esta
      // rota. Com `{ dados: [] }` o estudo ficaria sem receita e os dois
      // indicadores em % de VGV cairiam em zero — outros números, outro caso.
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-graficos');
    forcarEstado(el, { estudo: ESTUDO });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

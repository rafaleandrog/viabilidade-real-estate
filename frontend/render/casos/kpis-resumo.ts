// Caso de render: a faixa de KPIs da aba RESUMO do Avançado.
//
// É o caso que EXISTE PARA FALHAR. `frontend/tela-resumo.ts:67` aplica
// `width: 100%` de fora a um `urbi-kpi`, cujo `:host` soma `padding: 14px 16px`
// e `border: 1px` SEM `box-sizing: border-box`. A caixa renderizada mede
// `largura da célula + 34px` e invade a coluna vizinha.
//
// Reportado quatro vezes — #176, #262, #326, #352 — e fechado quatro. O
// conserto é da Onda 2 (#488) e NÃO é deste PR (regra R3). O que este caso
// entrega é a prova de que o defeito está vivo, medida em pixel.

import '../../tela-resumo.js';
import { CRONO, DATA_INICIO, fluxo, forcarEstado } from './dados.js';

export const caso = {
  nome: 'kpis-resumo',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  // Estes seletores são a prova de que a tela sob medição está na tela.
  exigir: [
    { seletor: 'div.kpis', minimo: 1 },
    { seletor: 'div.kpi-cel', minimo: 7 },
    { seletor: 'urbi-kpi', minimo: 7 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // Só cor/semântica e conteúdo — nenhuma restringe a caixa, que é o que este
    // caso mede. `altura` do gráfico É reproduzida (PROPS_QUE_DIMENSIONAM).
    'urbi-card.titulo',
    'urbi-grafico-pizza.categorias',
    'urbi-grafico-pizza.formato',
    'urbi-grafico-pizza.series',
    'urbi-kpi.variante',
    // ⚠️ Este é de outra natureza, e vale ler antes de tirar. `.opcoes` é
    // binding de PROPRIEDADE (o Lit nem escreve atributo), e o stub não desenha
    // opção nenhuma: o `urbi-select` da pizza fica com 1183x0 px. Ou seja, a
    // caixa do seletor NÃO tem geometria neste caso, e nada do que este teste
    // afere diz respeito a ela. O que se mede aqui é a faixa de KPIs, acima.
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-resumo');
    // `estudo` fica NULO de propósito: é o que impede o `updated()` de disparar
    // o carregamento por API. O estado já carregado entra logo abaixo.
    forcarEstado(el, {
      carregando: false,
      calc: fluxo(),
      benchmarks: [],
      dados: { crono: CRONO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

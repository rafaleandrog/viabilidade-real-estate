// Caso de render: a faixa de KPIs da PROFORMA (Preliminar).
//
// É o CASO DE CONTROLE, e o papel dele é passar. `frontend/tela-proforma.ts:53`
// usa a mesma grade de `urbi-kpi` do Resumo e a única diferença é não impor
// largura de fora: `min-width: 0` deixa o card encolher em vez de estourar.
//
// Se este caso falhar, o errado é o harness, não o app. Um verificador que
// acusa os dois lados não distingue nada — e a primeira coisa que se faz com
// um verificador assim é desligá-lo.

import '../../tela-proforma.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'kpis-proforma',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  // Estes seletores são a prova de que a tela sob medição está na tela.
  // 4 KPIs fixos (Área vendável, Nº de unidades, Custo obras/VGV, Margem
  // líquida); o de Área permutada só aparece com permuta, que a fixtura não tem.
  exigir: [
    { seletor: 'div.kpis', minimo: 1 },
    { seletor: 'urbi-kpi', minimo: 4 },
    { seletor: 'table.pf', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    // `urbi-botao.pequeno` muda o padding do botão de verdade; aqui os botões
    // ficam FORA da faixa de KPIs medida, então não deslocam o que se afere.
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-proforma');
    // `_init()` roda no `connectedCallback` e vai à API por benchmarks, config
    // e produtos. Com o stub devolvendo `{ dados: [] }` isso é inofensivo: os
    // três caem em lista vazia, que é o estado de um estudo sem catálogo.
    forcarEstado(el, { estudo: ESTUDO, secao: 'proforma', benchmarks: [], produtos: [], aliquotaRet: 4 });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

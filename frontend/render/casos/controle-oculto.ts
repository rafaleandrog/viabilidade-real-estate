// CONTROLE NEGATIVO — o caso EXIGIDO-PORÉM-OCULTO.
//
// O terceiro controle, e o mais sutil dos três. Os outros dois cobrem "não
// montou nada" e "não declarou o que exigir". Este cobre o buraco que sobrou
// entre eles, achado na rodada 2 da revisão do PR 506:
//
//   · a prova de montagem contava o nó exigido com `el.matches(seletor)`, que
//     casa mesmo com o nó OCULTO;
//   · o spinner visível ao lado dava `areaVisivel` positiva, então o piso
//     genérico também passava;
//   · e as lentes de layout PULAM subárvore invisível, por definição.
//
// Resultado: tela concluída sob `display: none`, spinner na frente, tudo
// "limpo" — a mesma falha que a prova de montagem existe para impedir, entrando
// pela porta dos fundos. É a forma que uma regressão de estado assume de
// verdade: o componente renderiza, mas o que se queria medir não está na tela.
//
// O `harness.render.test.ts` exige que `verificarRender` REJEITE este caso.
// ⚠️ Se ele passar a ser aceito, a prova de montagem voltou a contar nó que
// ninguém vê. Não "conserte" tornando o conteúdo visível.

import '../../tela-resumo.js';
import { CRONO, DATA_INICIO, fluxo, forcarEstado } from './dados.js';

export const caso = {
  nome: 'controle-oculto',
  exigir: [{ seletor: 'urbi-kpi', minimo: 7 }],
  async montar(raiz: HTMLElement): Promise<void> {
    // Algo VISÍVEL na tela, para o piso de área não salvar o caso sozinho —
    // é o papel que o spinner faz numa regressão real.
    const spinner = document.createElement('div');
    spinner.textContent = 'Consolidando o resumo...';
    spinner.style.cssText = 'padding:24px;font-size:14px';
    raiz.appendChild(spinner);

    // A tela de verdade, com os 7 urbi-kpi montados — e escondida.
    const escondido = document.createElement('div');
    escondido.style.display = 'none';
    raiz.appendChild(escondido);
    const el = document.createElement('viab-tela-resumo');
    forcarEstado(el, {
      carregando: false,
      calc: fluxo(),
      benchmarks: [],
      dados: { crono: CRONO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    escondido.appendChild(el);
    await (el as any).updateComplete;
  },
};

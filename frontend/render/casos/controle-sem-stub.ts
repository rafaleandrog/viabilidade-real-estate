// CONTROLE NEGATIVO — primitivo `urbi-*` que não existe no espelho.
//
// O quinto controle, e o irmão dos outros: o espelho é gerado varrendo os
// `<urbi-*>` de `frontend/*.ts` **sem recursão**, então um primitivo usado só
// por um caso de `frontend/render/casos/` não entra nele. Sem entrada no
// espelho não há stub, e o navegador trata a tag como elemento desconhecido —
// `display: inline`, sem shadow root, sem nenhuma das declarações `:host` que
// governam o box model.
//
// A geometria daquela região passa a ser ficção, e nenhuma lente reclama:
// exatamente a família "reporta limpo por não ter medido", entrando por mais
// uma porta.
//
// O `harness.render.test.ts` exige que `verificarRender` REJEITE este caso.

export const caso = {
  nome: 'controle-sem-stub',
  exigir: [{ seletor: 'urbi-primitivo-que-nao-existe', minimo: 1 }],
  async montar(raiz: HTMLElement): Promise<void> {
    const x = document.createElement('urbi-primitivo-que-nao-existe');
    x.textContent = 'sem stub';
    // `display:block` + tamanho para o nó ser visível: o ponto do controle é a
    // AUSÊNCIA de stub, não a invisibilidade — que já tem controle próprio.
    x.setAttribute('style', 'display:block;width:200px;height:40px');
    raiz.appendChild(x);
  },
};

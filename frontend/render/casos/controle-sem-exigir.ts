// CONTROLE NEGATIVO — caso que ESQUECE de declarar `exigir`.
//
// O par do `controle-vazio`. Aquele cobre "declarou e não cumpriu"; este cobre
// "não declarou", que é como um caso novo nasce se ninguém obrigar. Sem a
// obrigação, o caso novo mede o que der e reporta limpo.
//
// O `harness.render.test.ts` exige que `verificarRender` REJEITE este caso.

import '../../tela-resumo.js';

export const caso = {
  nome: 'controle-sem-exigir',
  // sem `exigir`: é este o ponto
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-resumo');
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

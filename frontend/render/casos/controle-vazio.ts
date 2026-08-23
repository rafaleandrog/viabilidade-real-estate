// CONTROLE NEGATIVO — este caso não monta nada, de propósito.
//
// Existe porque a ausência de prova de montagem foi um defeito real deste
// harness, achado na revisão do PR 506: um caso que não renderiza nada — ou que
// renderiza só o spinner — passava por TODAS as lentes com "600px — limpo ·
// 900px — limpo · 1280px — limpo". Basta um campo de estado renomear lá em cima
// para a suíte inteira ficar verde sem medir um pixel.
//
// O `harness.render.test.ts` exige que `verificarRender` REJEITE este caso. É o
// mesmo princípio da bateria dos guards de UI: verificação precisa ser testada
// nos DOIS sentidos, porque o falso negativo é justamente o que ela nunca acusa
// sozinha.
//
// ⚠️ Se algum dia este caso passar a ser aceito, o harness voltou a medir nada
// e a reportar limpo. Não "conserte" fazendo-o montar alguma coisa.

export const caso = {
  nome: 'controle-vazio',
  // Declara `exigir` normalmente — o ponto do controle é que a EXIGÊNCIA não é
  // atendida, não que ela esteja faltando (esse é o outro controle, abaixo).
  exigir: [{ seletor: 'div.jamais-existe', minimo: 1 }],
  async montar(_raiz: HTMLElement): Promise<void> {
    // nada, de propósito
  },
};

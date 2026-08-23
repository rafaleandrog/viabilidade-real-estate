// CONTROLE NEGATIVO — usa prop que o stub não reproduz e NÃO a declara.
//
// O quarto controle. Sem ele, o confronto de `aceitaNaoReproduzido` poderia
// estar quebrado (por exemplo devolvendo lista sempre vazia) e os quatro casos
// reais continuariam verdes — verificação que nunca acusa nada passa por
// verificação boa. É o mesmo motivo pelo qual `scripts/testar-guards-ui.sh`
// exercita os guards nos dois sentidos.
//
// O `harness.render.test.ts` exige que `verificarRender` aponte
// `urbi-botao.variante` como não declarada aqui.

export const caso = {
  nome: 'controle-prop-nao-declarada',
  exigir: [{ seletor: 'urbi-botao', minimo: 1 }],
  // sem `aceitaNaoReproduzido`: é este o ponto
  async montar(raiz: HTMLElement): Promise<void> {
    const b = document.createElement('urbi-botao');
    b.setAttribute('variante', 'secundario');
    b.textContent = 'Botão do controle';
    raiz.appendChild(b);
  },
};

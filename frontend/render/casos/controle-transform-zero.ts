// CONTROLE do DISCRIMINADOR entre as duas causas de caixa com tamanho zero.
//
// Zero não quer dizer a mesma coisa nos dois casos, e este controle exercita os
// DOIS sentidos de uma vez — que é o único jeito de provar que a distinção
// distingue, em vez de só existir:
//
//   · `urbi-select` com `.opcoes` → zerado PELO STUB (o stub não desenha opção
//     nenhuma). A prop não reproduzida é a CAUSA de a caixa ter sumido, então
//     ela PRECISA continuar sendo cobrada. Este caso NÃO a declara, e o teste
//     exige que ela apareça em `naoDeclaradas`.
//   · `urbi-botao` com `variante`, dentro de `transform: scale(0)` → zerado pelo
//     CSS do caso. Todas as lentes descartam a subárvore, então cobrar
//     declaração dela seria forçar dispensa para conteúdo que não participa de
//     medição nenhuma — e a dispensa continuaria válida se a transformação
//     sumisse depois. O teste exige que ela NÃO apareça.
//
// O discriminador é `offsetWidth`/`offsetHeight` (métricas de layout, que
// ignoram transform) contra o retângulo (que a aplica). Ver a tabela em
// `scripts/render-check.mjs`. Achado do Codex, rodada 4.

export const caso = {
  nome: 'controle-transform-zero',
  exigir: [{ seletor: 'urbi-kpi', minimo: 1 }],
  // sem `aceitaNaoReproduzido`: o teste confere exatamente o que é cobrado
  async montar(raiz: HTMLElement): Promise<void> {
    // Âncora visível, para a prova de montagem passar e o caso chegar às lentes.
    const kpi = document.createElement('urbi-kpi');
    kpi.setAttribute('rotulo', 'Âncora');
    kpi.setAttribute('valor', 'R$ 1,00');
    raiz.appendChild(kpi);

    // Zerado PELO STUB: 5 opções, nenhuma desenhada, altura zero.
    const sel = document.createElement('urbi-select');
    (sel as any).opcoes = [{ valor: 'a', rotulo: 'A' }, { valor: 'b', rotulo: 'B' }];
    raiz.appendChild(sel);

    // Zerado pelo CSS DO CASO.
    const encolhido = document.createElement('div');
    encolhido.style.transform = 'scale(0)';
    raiz.appendChild(encolhido);
    const bot = document.createElement('urbi-botao');
    bot.setAttribute('variante', 'secundario');
    bot.textContent = 'invisível por transform';
    encolhido.appendChild(bot);
  },
};

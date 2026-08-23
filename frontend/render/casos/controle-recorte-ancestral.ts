// CONTROLE do RECORTE POR ANCESTRAL — a décima terceira forma de ocultação.
//
// Um painel recolhido (`height: 0; overflow: hidden`) não zera o retângulo do
// descendente e não é visto pelo `checkVisibility`: o nó contava como visível
// com zero pixel na tela. E como o ancestral tem retângulo zero, a lente de
// corte também o pulava — a prova de montagem passava e todas as lentes
// reportavam limpo. Achado do Codex, rodada 5.
//
// O caso exercita os DOIS sentidos, que é o que prova que a distinção
// distingue em vez de só existir:
//
//   · `urbi-kpi` dentro de `height: 0; overflow: hidden` → RECORTADO. O
//     `exigir` pede 2 e só a âncora aparece, então a prova de montagem reprova;
//   · `urbi-kpi` dentro de `overflow: auto` com altura pequena → NÃO recortado.
//     Ali o conteúdo é alcançável pelo usuário, e tratá-lo como oculto erraria
//     para o lado que PULA a medição.

export const caso = {
  nome: 'controle-recorte-ancestral',
  exigir: [{ seletor: 'urbi-kpi', minimo: 3 }],
  async montar(raiz: HTMLElement): Promise<void> {
    const kpi = (rotulo: string) => {
      const el = document.createElement('urbi-kpi');
      el.setAttribute('rotulo', rotulo);
      el.setAttribute('valor', 'R$ 1,00');
      return el;
    };

    // Âncora visível, para o caso chegar às lentes.
    raiz.appendChild(kpi('Âncora'));

    // Recolhido: recorta de verdade, e nada dentro aparece.
    const recolhido = document.createElement('div');
    recolhido.style.height = '0';
    recolhido.style.overflow = 'hidden';
    recolhido.appendChild(kpi('Dentro do painel recolhido'));
    raiz.appendChild(recolhido);

    // Rolável: o conteúdo é alcançável, então CONTINUA contando como visível.
    const rolavel = document.createElement('div');
    rolavel.style.height = '20px';
    rolavel.style.overflow = 'auto';
    rolavel.appendChild(kpi('Dentro do painel rolável'));
    raiz.appendChild(rolavel);
  },
};

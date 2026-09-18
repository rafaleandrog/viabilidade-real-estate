// Caso de render standalone: <viab-grafico-tornado> (Rodada 13, issue #728).
//
// Duas coisas que só o DOM prova: (1) a escala é pela MAIOR amplitude do
// conjunto, nunca pela primeira (o achado mais caro da Rodada 12, PR #707) —
// medida abaixo comparando a largura em px das barras; (2) rótulo longo
// ("Permuta financeira", "Custo de infraestrutura") e uma amplitude MUITO
// maior que as outras, que é justamente quando uma escala errada aparece.

import '../../grafico-tornado.js';
import { forcarEstado } from './dados.js';
import type { Alavanca } from '../../tornado-alavancas.js';

// Amplitude dividida IGUALMENTE entre os dois lados (bear e bull se afastam
// da base na mesma medida): as duas barras de cada linha ficam visíveis, e a
// largura de qualquer um dos lados continua diretamente proporcional à
// amplitude — o fator 0,5 é o mesmo em toda linha, então a RAZÃO entre
// linhas (o que a prova de escala mede) não muda.
const alavanca = (variavel: Alavanca['variavel'], rotulo: string, amplitude: number, circular = false): Alavanca => {
  const metade = amplitude / 2;
  return {
    variavel, rotulo,
    resultadoBase: 1_000_000,
    resultadoBear: 1_000_000 - metade,
    resultadoBull: 1_000_000 + metade,
    amplitudeRS: amplitude,
    amplitudePct: (amplitude / (2 * 1_000_000)) * 100,
    circular,
  };
};

const ALAVANCAS: Alavanca[] = [
  alavanca('preco', 'Preço de venda', 8_000_000),
  alavanca('custo_obras', 'Custo de obra', 3_200_000),
  alavanca('permuta_fisica', 'Permuta física', 1_400_000),
  alavanca('permuta_financeira', 'Permuta financeira', 600_000),
  // Rótulo longo + circular: fica atenuada e FORA da contagem de 3 em
  // destaque mesmo tendo a 3ª maior amplitude — issue #728, item 5.
  alavanca('custo_infra', 'Custo de infraestrutura', 500_000, true),
];

export const caso = {
  nome: 'grafico-tornado',
  exigir: [
    { seletor: 'div.linha', minimo: 5 },
    { seletor: 'div.trilho', minimo: 5 },
    { seletor: 'div.eixo', minimo: 5 },
    { seletor: 'div.barra', minimo: 10 }, // 2 por linha (esquerda + direita)
    { seletor: 'div.linha.circular', minimo: 1 },
    { seletor: 'div.linha.ativa', minimo: 1 },
    { seletor: 'div.barra.destaque', minimo: 1 },
    { seletor: 'div.barra.neutra', minimo: 1 },
    { seletor: 'div[role="listitem"][tabindex="0"]', minimo: 5 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-grafico-tornado');
    forcarEstado(el, { alavancas: ALAVANCAS, ativa: 'preco' });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },

  // Sonda de SELEÇÃO (clique + teclado) e de ESCALA — nenhum seletor sozinho
  // prova que a largura de cada barra reage à amplitude, ou que clicar emite
  // o evento com a variável certa.
  async medir(raiz: HTMLElement): Promise<{
    selecionouPorClique: string | null;
    selecionouPorEnter: string | null;
    larguraPrecoPx: number;
    larguraObraPx: number;
    larguraPermutaFinPx: number;
    rotulosValor: string[];
  }> {
    const el = raiz.querySelector('viab-grafico-tornado')! as any;
    const linhas = [...el.shadowRoot!.querySelectorAll('div.linha')] as HTMLElement[];

    let selecionouPorClique: string | null = null;
    let selecionouPorEnter: string | null = null;
    const ouvir = (guardar: (v: string) => void) => (ev: Event) => {
      guardar((ev as CustomEvent).detail.variavel);
    };
    const linhaObra = linhas[1]; // 2ª linha montada = 'custo_obras', ordem da fixture
    const linhaPermutaFin = linhas[3];

    el.addEventListener('viab:tornado-selecionar', ouvir((v) => { selecionouPorClique = v; }), { once: true });
    linhaObra.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;

    el.addEventListener('viab:tornado-selecionar', ouvir((v) => { selecionouPorEnter = v; }), { once: true });
    linhaPermutaFin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;

    const largura = (linha: HTMLElement) => {
      const direita = linha.querySelector('div.barra.direita') as HTMLElement;
      return direita.getBoundingClientRect().width;
    };
    const rotulosValor = [...el.shadowRoot!.querySelectorAll('span.valor')]
      .map((n: Element) => (n.textContent ?? '').trim());

    return {
      selecionouPorClique, selecionouPorEnter,
      larguraPrecoPx: largura(linhas[0]),
      larguraObraPx: largura(linhas[1]),
      larguraPermutaFinPx: largura(linhas[3]),
      rotulosValor,
    };
  },
};

// Caso de render: #664, o ponto que a revisão do PR 669 pediu medir — o que
// `viab-num` FAZ ao receber `null` onde antes recebia número (o campo de
// Permuta física, canônico presente + grandeza de ligação ZERADA).
//
// `frontend/premissas-valor-unidade.test.ts` para em `_valorUnidade`, que já
// devolvia `null` corretamente antes do conserto — o defeito morava no `??`
// da fiação, não no cálculo (classe de defeito nº 1 do CLAUDE.md). Aquele
// teste não atravessa `.valor=${...}` nem o comportamento real de `viab-num`,
// então a suíte continuaria verde se o componente renderizasse `NaN`,
// `"null"`, ou disparasse `urbi:input-numero-change` sozinho ao receber a
// prop nova. Este caso mede exatamente isso, na única camada que enxerga —
// DOM de verdade em Chromium (armadilha 12 do CLAUDE.md: "isto eu não
// exercitei" não é o mesmo que medir).
//
// ⚠️ Os campos da permuta vão no `estudo`, não num `form` à parte no
// `forcarEstado`. `_init()` (`connectedCallback`) roda `this.form =
// {...this.estudo}` de forma SÍNCRONA, antes de qualquer `await` — um `form`
// forçado seria apagado por essa cópia antes mesmo do primeiro
// `updateComplete`. Medido: sem isto, `this.form` no componente montado é uma
// cópia da fixture `ESTUDO`, sem os três campos de permuta.
//
// ⚠️ Incorporação, não Loteamento — a mesma escolha do teste de fiação
// (`frontend/premissas-valor-unidade.test.ts`). No Loteamento a base da
// permuta física é a cascata de área do TERRENO (`areaVendavel`), que a
// fixture `ESTUDO` deixa em 4.800 m² mesmo sem produto — não zera por causa
// só de `produtos: []`. Na Incorporação, sem catálogo (`semProdutos`), a base
// é `area_pvt_r_fechada` (`frontend/proforma.ts:558`): zerando esse campo dá
// a ligação ZERADA sem precisar reconstruir a cascata de terreno inteira.
//
// ⚠️ DESENHO INVERTIDO (rodada 5 de revisão — Codex achou defeito real e
// DISTINTO em cada uma das quatro tentativas anteriores de medir "o evento
// não dispara", todas na mesma camada estreita — armadilha 14 do CLAUDE.md:
// na entrada suja repetida da mesma classe, pare de acrescentar guarda e
// inverta). As quatro tentativas erradas, para não repetir:
//   1. Teste parava em `_valorUnidade`, sem atravessar `.valor=${...}`.
//   2. Listener registrado só depois do assentamento — perdia o ciclo
//      inicial de `update()`.
//   3. Reatribuir `.valor = null` no `viab-num` já conectado — mas o Lit
//      aplica os bindings ao FRAGMENTO CLONADO antes de inserir na shadow
//      tree, e um evento no primeiro render nunca alcançaria um listener em
//      `raiz`, mesmo registrado antes do `appendChild`: não há ancestral
//      nenhum enquanto o nó está desconectado — não é observável por
//      bubbling.
//   4. Reatribuir `.valor = null` de novo — mas `num.valor` JÁ era `null`
//      nesse ponto: é reatribuição do MESMO valor, o `hasChanged` padrão do
//      Lit não agenda update nenhum, e a transição número→`null` (o cenário
//      real que esta issue corrige) nunca é exercitada.
//
// A saída: montar com a ligação NÃO-zero primeiro (`_valorUnidade` devolve
// um NÚMERO de verdade), deixar assentar, instalar o listener no `viab-num`
// já conectado, e só ENTÃO mudar `estudo.area_pvt_r_fechada` para 0 — o que
// dispara um re-render REAL de `tela-premissas`, que recalcula
// `_valorUnidade` (agora `null`) e reatribui `.valor` do `viab-num` conectado
// com um valor DIFERENTE do anterior. É a única forma de exercitar a
// transição de verdade, e o `hasChanged` do Lit não tem como suprimi-la.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'premissas-valor-unidade-null',
  // `exigir` é OBRIGATÓRIO em todo caso. Só a sub-aba "permutas" está
  // montada, Incorporação: Permuta física residencial + não residencial +
  // Permuta financeira residencial + não residencial = 4 `div.campo-unidade`.
  exigir: [
    { seletor: 'div.campo-unidade', minimo: 4 },
    { seletor: 'viab-num.cu-valor', minimo: 4 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.interativo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      // ⚠️ `area_pvt_r_fechada` NASCE NÃO-ZERO — 200 m² é suficiente para
      // `_valorUnidade` devolver um número real (500 / 200 × 100 = 250%,
      // qualquer valor serve: o que importa é ser finito e diferente de
      // `null`). É o estado "antes" da transição que este caso mede.
      estudo: {
        ...ESTUDO,
        area_pvt_r_fechada: 200,
        permuta_fisica_area_canonica: 500,
        permuta_fisica_pct: 30,
        permuta_fisica_modo: 'pct_area_venda',
      },
      secao: 'permutas',
      editavel: true,
      benchmarks: [],
      produtos: [],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  // Roda DENTRO do navegador, depois do assentamento (ver
  // `scripts/render-check.mjs`) — é o que permite ler o `<input>` real de um
  // `viab-num` aninhado em shadow root, e observar a transição de verdade.
  async medir(raiz: HTMLElement): Promise<{
    valorAntes: string; valorInput: string; eventoDisparou: boolean;
  }> {
    const tela = raiz.querySelector('viab-tela-premissas')! as any;
    const acharNum = (): HTMLElement => {
      const campos = [...tela.shadowRoot!.querySelectorAll('div.campo-unidade')];
      const permutaFisica = campos.find(
        (c) => c.querySelector('.cu-rotulo')?.textContent?.includes('Permuta física'),
      )!;
      return permutaFisica.querySelector('viab-num.cu-valor')!;
    };

    // Estado "antes": ligação não-zero, `_valorUnidade` devolve número.
    const numAntes = acharNum() as any;
    const inputAntes = numAntes.shadowRoot!.querySelector('input') as HTMLInputElement;
    const valorAntes = inputAntes.value;

    // Listener no `viab-num` JÁ CONECTADO, ANTES da mudança que provoca a
    // transição — cobre o `update()` que a mudança de estado vai agendar.
    let eventoDisparou = false;
    numAntes.addEventListener('urbi:input-numero-change', () => { eventoDisparou = true; });

    // A transição de verdade: zera a ligação por uma mudança de ESTADO real
    // — é isto que faz `tela-premissas` recalcular `_valorUnidade` e
    // reatribuir `.valor` com um valor DIFERENTE (null), o único jeito de o
    // `hasChanged` do Lit não suprimir o update.
    //
    // ⚠️ Em `this.form`, NÃO em `this.estudo`. `_ctxConversao()` deriva a
    // ligação de `this._entradaProforma()`, que espalha `this.form` — a
    // cópia que `_init()` faz de `estudo` UMA VEZ, no `connectedCallback`.
    // Mudar `tela.estudo` depois disso não toca `this.form`, porque
    // `updated()` só rechama `_init()` quando `estudo.id` muda (linha
    // `frontend/tela-premissas.ts:464`) — e aqui o id é o mesmo. É a mesma
    // via que o usuário edita de verdade (`_set`, ao digitar num campo de
    // Terreno & Áreas).
    tela.form = { ...tela.form, area_pvt_r_fechada: 0 };
    await tela.updateComplete;
    // Segunda volta: `viab-num` é filho, e seu próprio `updateComplete` pode
    // resolver um ciclo depois do pai.
    const numDepois = acharNum() as any;
    await numDepois.updateComplete;

    const input = numDepois.shadowRoot!.querySelector('input') as HTMLInputElement;
    return { valorAntes, valorInput: input.value, eventoDisparou };
  },
};

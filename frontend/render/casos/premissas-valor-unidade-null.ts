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
// Medido: com `tipo_empreendimento: 'loteamento'` este caso não pegava a
// mutação de `_valorUnidade` — o `<input>` saía preenchido nos dois lados.
//
// Cenário, o mesmo do teste de fiação: canônico gravado (500 m²) e a área
// privativa residencial fechada (a ligação de "% área venda") em ZERO, sem
// produto nenhum no catálogo. A coluna histórica de percentual carrega 30, de
// quando a ligação não era zero.

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
  // ⚠️ Achado do revisor (Codex, PR 669): registrar o listener só em `medir` —
  // depois de `montar` e do assentamento inteiro — deixa a janela entre o
  // PRIMEIRO `.valor=${null}` (dentro de `montar`) e a leitura sem testemunha
  // nenhuma. Um evento disparado durante o setter ou o ciclo inicial de
  // `update()` do Lit passaria batido. Por isso o listener mora aqui, em
  // capture na fase de bubble/composed do próprio `raiz` — ANTES de o
  // elemento sequer existir — e não em `medir`.
  _eventoDisparou: false,
  async montar(raiz: HTMLElement): Promise<void> {
    caso._eventoDisparou = false;
    raiz.addEventListener('urbi:input-numero-change', () => { caso._eventoDisparou = true; });

    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: {
        ...ESTUDO,
        area_pvt_r_fechada: 0,
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
  // `viab-num` aninhado em shadow root. O evento em si já foi capturado (ou
  // não) por `montar`, bem antes deste ponto — ver o comentário acima.
  async medir(raiz: HTMLElement): Promise<{ valorInput: string; eventoDisparou: boolean }> {
    const tela = raiz.querySelector('viab-tela-premissas')!;
    const campos = [...tela.shadowRoot!.querySelectorAll('div.campo-unidade')];
    const permutaFisica = campos.find(
      (c) => c.querySelector('.cu-rotulo')?.textContent?.includes('Permuta física'),
    )!;
    const num = permutaFisica.querySelector('viab-num.cu-valor')!;
    const input = num.shadowRoot!.querySelector('input') as HTMLInputElement;

    return { valorInput: input.value, eventoDisparou: caso._eventoDisparou };
  },
};

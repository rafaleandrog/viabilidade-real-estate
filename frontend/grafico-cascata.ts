// Cascata VERTICAL do resultado (Rodada 12, handoff de KPIs/gráficos §4.1;
// virada de horizontal para vertical a pedido do autor).
//
// Componente customizado — **não existe primitivo de cascata/waterfall** na
// família `urbi-grafico-*` (fechada em `colunas`, `linha`, `area`, `pizza`,
// `medidor`; conferido em `docs/ui-urbiverso/primitivos.json`, carimbo
// `0.53.11`/`ec0e347`). `urbi-grafico-colunas` com `empilhado` desenharia a
// geometria, mas não serve para este pedido por três razões medidas:
//   · não desenha rótulo de valor POR BARRA — o valor só aparece nos ticks do
//     eixo Y e no `<title>` de hover, e o pedido é o número ao lado da coluna;
//   · `formato` só tem `numero`/`moeda`/`porcentagem` e nenhum é compacto, então
//     não há como publicar "R$ 26,5";
//   · `empilhado` BLOQUEIA valores negativos (estado de erro), e cascata
//     deficitária é justamente o caso que precisa sobreviver ao desenho.
//
// O que ele TOMA do contrato de UI da plataforma, em vez de inventar: os tokens
// de cor (`--cor-sucesso`/`--cor-erro`/`--cor-texto-*`/`--cor-borda-sutil`), o
// `urbi-estado-vazio` do irmão ranqueado, o `title` como equivalente DOM do
// `<title>` SVG que a família usa para tooltip, e o default de `altura`
// (`240px`) de `UrbiGraficoBase`. Cor NUNCA viaja como dado (decisão das
// #595/#632) — ela vem de CSS.
//
// ⚠️ Dentro do bloco `static styles = css`...``, NENHUM comentário pode usar
// crase: ela fecha o template literal, e o erro que sai é um TS1005 a dezenas
// de linhas dali, que não aponta para a causa.
//
// Consome `EtapaCascata[]` já pronta de `frontend/cascata-resultado-motor.ts` —
// não recalcula nada. A geometria que o motor devolve é neutra de eixo
// (`inicioPct`/`tamanhoPct`); é AQUI que ela vira `bottom`/`height`.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EtapaCascata } from './cascata-resultado-motor.js';
import { fmtR$, fmtR$Milhoes } from './viab-format.js';

/**
 * Altura minima, em px, da barra que nao tem altura propria. Interpolada nos
 * DOIS lugares que precisam concordar: o min-height da folha e o clamp do
 * bottom no template. Duplicar o literal deixava o clamp defasado quando o
 * filete mudasse, e o corte que ele evita voltaria calado (achado da rodada 2).
 */
const FILETE_PX = 2;

@customElement('viab-grafico-cascata')
export class ViabGraficoCascata extends LitElement {
  @property({ attribute: false }) etapas: EtapaCascata[] = [];
  /** Rótulo da coluna clicável que expande detalhamento (ex.: "custo_direto"). */
  @property({ attribute: false }) idExpandivel: string | null = null;
  /** Altura do trilho das colunas. Mesmo nome e default de `UrbiGraficoBase`. */
  @property() altura = '240px';
  /**
   * Se o painel que a coluna de `idExpandivel` abre está aberto AGORA. Só
   * existe para alimentar `aria-expanded`: quem guarda o estado é a tela, e sem
   * ele o leitor de tela anunciaria um botão de alternância cujo estado nunca
   * muda (achado da rodada 2 de revisão).
   */
  @property({ type: Boolean }) expandido = false;

  static styles = css`
    :host { display: block; }
    /* Rola por dentro do card em viewport estreita: 14 colunas não cabem a
       600px, e estourar o documento reprova no harness de render. */
    .colunas {
      display: flex;
      align-items: flex-end;
      /* flex-start, e NAO center: num container com overflow-x, centralizar
         empurra o inicio do conteudo para fora da caixa quando ele estoura, e
         a area que sobra a esquerda fica INALCANCAVEL pelo scroll — a primeira
         coluna (VGV de tabela) simplesmente nao teria como ser vista a 600px. */
      justify-content: flex-start;
      gap: 18px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    /* flex-basis 0 com flex-grow 1: as colunas dividem a largura disponivel em
       partes iguais e o grafico ocupa a faixa inteira do card, em vez de
       terminar num vazio a direita. min-width e o piso que forca o rolamento
       interno em viewport estreita, em vez de espremer a barra ate sumir; com
       ele, o gap largo sobrevive e sobra espaco para o titulo na horizontal. */
    .coluna {
      flex: 1 1 0;
      min-width: 76px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }
    .valor {
      font-size: 11px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
    }
    /* A altura vem INLINE, da prop altura, e nao de uma custom property
       propria: o harness de render exige que todo var() citado pelo CSS
       resolva em todas as variantes de tema, e uma custom property definida
       por este componente nao resolve quando o CSS e analisado fora dele. */
    .trilho {
      position: relative;
      width: 100%;
      background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08));
      border-radius: 3px;
      overflow: hidden;
    }
    /* min-height e o filete da barra que nao tem altura propria. Sao tres casos,
       e eles diferem no que o rotulo mostra -- a versao anterior deste
       comentario dizia que os tres colapsavam para "R$ 0,0", e isso e falso em
       dois deles (achado da rodada 2 de revisao):
         - deducao maior que o acumulado, e resultado deficitario: a GEOMETRIA e
           clampada a zero pelo motor, mas o campo de valor fica integro, entao
           o rotulo publica o numero de verdade (um deficit de 5 milhoes sai
           como -R$ 5,0);
         - deducao real de valor minusculo: ai sim o rotulo em milhoes colapsa
           para "R$ 0,0", e o unico canal com o numero exato e o title.
       Sem o filete, nos tres a coluna sumiria da tela sem deixar rastro. */
    .barra {
      position: absolute;
      left: 12%;
      right: 12%;
      min-height: ${FILETE_PX}px;
      border-radius: 3px;
    }
    /* Cor por natureza economica, a pedido do autor: subtotal e RECEITA
       (VGV de tabela, receita bruta, liquida, operacional) e sai verde;
       deducao e DESPESA e sai vermelha; o Resultado final, que nao e nem uma
       nem outra, sai azul para se distinguir dos dois. Sem cinza. */
    .barra.subtotal { background: var(--cor-sucesso, #13a98d); }
    .barra.deducao { background: var(--cor-erro, #d45a3a); }
    .barra.total { background: var(--cor-primaria-solida, #2aa9e0); }
    /* Rotulo na HORIZONTAL: com a coluna dividindo a largura toda e um gap de
       18px, o titulo cabe em ate tres linhas, que le muito melhor que texto
       girado. Altura fixa para as colunas alinharem a base entre si;
       overflow-wrap quebra "residencial" quando a coluna e estreita, e o
       title (tooltip) guarda o rotulo inteiro do que passar de tres linhas. */
    .rotulo {
      height: 44px;
      text-align: center;
      font-size: 11px;
      line-height: 1.25;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .rotulo.clicavel, .coluna.clicavel .trilho { cursor: pointer; }
    .rotulo.clicavel { text-decoration: underline dotted; }
    .coluna.clicavel:focus-visible {
      outline: 2px solid var(--cor-primaria-solida, #2aa9e0);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .rodape {
      margin-top: 8px;
      font-size: 11px;
      color: var(--cor-texto-fraco, rgba(255, 255, 255, 0.4));
    }
  `;

  private _clique(id: string) {
    if (id !== this.idExpandivel) return;
    this.dispatchEvent(new CustomEvent('viab:cascata-linha-click', { detail: { id }, bubbles: true, composed: true }));
  }

  // Enter e Espaco, porque a coluna expansivel e um `div` com `role="button"`:
  // o navegador so ativa por teclado o que e botao de verdade, e sem isto o
  // detalhamento de custo direto seria alcancavel apenas por mouse.
  //
  // `ev.repeat` é descartado: segurar a tecla dispara auto-repeat, e sem a
  // guarda o evento sairia em rajada, alternando o painel dezenas de vezes
  // (achado da rodada 2). Botão nativo ativa o Espaço no `keyup`, uma vez por
  // pressão; aqui a guarda de repetição resolve o efeito prático sem a
  // maquinaria de rastrear a pressão entre dois handlers.
  private _tecla(ev: KeyboardEvent, id: string) {
    if (ev.repeat) return;
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    this._clique(id);
  }

  render(): TemplateResult {
    if (this.etapas.length === 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-simple" mensagem="Sem etapas para exibir."></urbi-estado-vazio>`;
    }
    const base = this.etapas.find((e) => e.id === 'vgv_tabela')?.valor ?? 0;
    return html`
      <div class="colunas">
        ${this.etapas.map((e) => {
          const clicavel = e.id === this.idExpandivel;
          const exato = fmtR$(e.valor);
          return html`
            <div
              class="coluna ${clicavel ? 'clicavel' : ''}"
              title="${e.rotulo} — ${exato}"
              role=${clicavel ? 'button' : nothing}
              tabindex=${clicavel ? '0' : nothing}
              aria-label=${clicavel ? `${e.rotulo} — ${exato}` : nothing}
              aria-expanded=${clicavel ? String(this.expandido) : nothing}
              @click=${clicavel ? () => this._clique(e.id) : nothing}
              @keydown=${clicavel ? (ev: KeyboardEvent) => this._tecla(ev, e.id) : nothing}
            >
              <span class="valor">${fmtR$Milhoes(e.valor)}</span>
              <div class="trilho" style="height: ${this.altura};">
                <div
                  class="barra ${e.tipo}"
                  style="bottom: min(${e.inicioPct}%, calc(100% - ${FILETE_PX}px)); height: ${e.tamanhoPct}%;"
                ></div>
              </div>
              <span class="rotulo ${clicavel ? 'clicavel' : ''}">${e.rotulo}</span>
            </div>
          `;
        })}
      </div>
      ${base > 0
        ? html`<div class="rodape">
            Escala: altura total = VGV de tabela (${fmtR$(base)}). Valores das barras em R$ milhões;
            o valor exato aparece ao passar o mouse.
          </div>`
        : nothing}
    `;
  }
}

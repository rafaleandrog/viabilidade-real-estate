// Tornado de alavancas (Rodada 13, handoff §4.2 — issue #728). Barras
// horizontais SIMÉTRICAS a partir de um eixo central (zero do Resultado),
// ordenadas por amplitude — geometria que nenhum primitivo `urbi-*` desenha
// (confirmado na Rodada 12 contra `referencia/ui-urbiverso/primitivos.json`:
// `urbi-grafico-colunas` só faz barra vertical, e nenhum deles é bidirecional
// a partir de um zero central).
//
// Consome `Alavanca[]` já ranqueada por `frontend/tornado-alavancas.ts` — não
// recalcula nada. Mesma grade de três colunas de `grafico-barra-ranqueada.ts`
// (112px · trilho · valor), para os dois gráficos da app ficarem alinhados.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Alavanca } from './tornado-alavancas.js';
import type { VariavelSensibilidade } from './proforma.js';
import { rotuloComposto, type CenarioComposto } from './cenario-composto.js';

/** #735: o que o tornado seleciona — uma alavanca, ou o cenário composto. */
export type SelecaoTornado = VariavelSensibilidade | 'composto';
import { fmtR$, fmtPct } from './viab-format.js';

const N_DESTAQUE = 3;

@customElement('viab-grafico-tornado')
export class ViabGraficoTornado extends LitElement {
  @property({ attribute: false }) alavancas: Alavanca[] = [];
  /** Variável hoje selecionada — dirige a tabela Bear/Base/Bull abaixo. */
  @property({ attribute: false }) ativa: SelecaoTornado | null = null;
  /**
   * #735: o cenário composto, desenhado como o item do TOPO — pré-existente
   * à seleção das barras individuais. `null` = sem composto (menos de duas
   * alavancas não circulares).
   */
  @property({ attribute: false }) composto: CenarioComposto | null = null;

  static styles = css`
    :host { display: block; }
    .linha {
      display: grid;
      grid-template-columns: 112px 1fr 78px;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      padding: 3px 4px;
      border-radius: 4px;
      cursor: pointer;
    }
    .linha + .linha { margin-top: 2px; }
    .linha:hover { background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08)); }
    .linha:focus-visible {
      outline: 2px solid var(--cor-primaria-solida, #2aa9e0);
      outline-offset: 1px;
    }
    .linha.ativa {
      background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08));
      box-shadow: inset 2px 0 0 var(--cor-primaria-solida, #2aa9e0);
    }
    .linha.circular { opacity: 0.55; }
    /* #735: o composto, no topo, separado das alavancas individuais. */
    .linha.composto { margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed var(--cor-borda-sutil, rgba(255, 255, 255, 0.08)); }
    .linha.composto .rotulo { color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95)); font-weight: 600; }
    .rotulo {
      font-size: 12px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trilho {
      position: relative;
      height: 14px;
      background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08));
      border-radius: 3px;
      overflow: hidden;
    }
    .eixo {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 1px dashed var(--cor-texto-fraco, rgba(255, 255, 255, 0.3));
    }
    .barra {
      position: absolute;
      top: 1px;
      bottom: 1px;
      border-radius: 2px;
    }
    .barra.esquerda { right: 50%; border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .barra.direita { left: 50%; border-top-left-radius: 0; border-bottom-left-radius: 0; }
    .barra.destaque { background: var(--cor-primaria-solida, #2aa9e0); }
    .barra.neutra { background: var(--cor-texto-fraco, rgba(255, 255, 255, 0.35)); }
    .valor {
      font-size: 12px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
    }
  `;

  private _selecionar(variavel: SelecaoTornado) {
    this.dispatchEvent(new CustomEvent('viab:tornado-selecionar', { detail: { variavel }, bubbles: true, composed: true }));
  }

  // Mesmo par Enter/Espaço de `viab-grafico-cascata` — a linha é um `div` com
  // `role="button"`, e o navegador só ativa por teclado o que é botão nativo.
  private _tecla(ev: KeyboardEvent, variavel: SelecaoTornado) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    if (ev.repeat) return;
    this._selecionar(variavel);
  }

  render(): TemplateResult {
    if (this.alavancas.length === 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-simple" mensagem="Sem alavancas para exibir."></urbi-estado-vazio>`;
    }
    // Escalado pela MAIOR amplitude do conjunto, nunca pela primeira — foi o
    // achado mais caro da Rodada 12 (PR #707, cadeia de áreas): a lista chega
    // ordenada, mas ordenada é contrato do chamador, não do desenho.
    // #735: o composto entra na escala — é, por construção, a maior amplitude.
    const maiorAmplitude = Math.max(...this.alavancas.map((a) => a.amplitudeRS), this.composto?.amplitudeRS ?? 0, 0.01);
    // As 3 primeiras em destaque, mas a base circular NUNCA entra na contagem
    // — mesmo rankeada alto, ela sai atenuada (issue #728, item 5).
    const destaque = new Set(
      this.alavancas.filter((a) => !a.circular).slice(0, N_DESTAQUE).map((a) => a.variavel),
    );
    const c = this.composto;
    const compostoAtivo = this.ativa === 'composto';
    return html`
      <div>
        ${c ? html`
          <div
            class="linha composto ${compostoAtivo ? 'ativa' : ''}"
            data-variavel="composto"
            role="button"
            aria-pressed=${compostoAtivo ? 'true' : 'false'}
            tabindex="0"
            title="${rotuloComposto(c)}: ${fmtR$(c.resultadoBear)} a ${fmtR$(c.resultadoBull)} — as três estressadas juntas"
            @click=${() => this._selecionar('composto')}
            @keydown=${(ev: KeyboardEvent) => this._tecla(ev, 'composto')}
          >
            <span class="rotulo" title=${rotuloComposto(c)}>${rotuloComposto(c)}</span>
            <div class="trilho">
              <div class="eixo"></div>
              <div class="barra esquerda destaque" style="width: ${(Math.max(0, c.resultadoBase - c.resultadoBear) / maiorAmplitude) * 50}%;"></div>
              <div class="barra direita destaque" style="width: ${(Math.max(0, c.resultadoBull - c.resultadoBase) / maiorAmplitude) * 50}%;"></div>
            </div>
            <span class="valor">${fmtR$(c.amplitudeRS)}</span>
          </div>` : nothing}
        ${this.alavancas.map((a) => {
          const ativa = this.ativa === a.variavel;
          const emDestaque = destaque.has(a.variavel);
          const direitaRS = Math.max(0, a.resultadoBull - a.resultadoBase);
          const esquerdaRS = Math.max(0, a.resultadoBase - a.resultadoBear);
          const direitaPct = (direitaRS / maiorAmplitude) * 50;
          const esquerdaPct = (esquerdaRS / maiorAmplitude) * 50;
          const rotuloValor = a.amplitudePct === null ? fmtR$(a.amplitudeRS) : `±${fmtPct(a.amplitudePct)}`;
          const titulo = a.circular
            ? `${a.rotulo}: base orçada como % do VGV — estressar esta premissa move o preço junto e não mede nada isolado.`
            : `${a.rotulo}: ${fmtR$(a.resultadoBear)} a ${fmtR$(a.resultadoBull)}`;
          return html`
            <div
              class="linha ${a.circular ? 'circular' : ''} ${ativa ? 'ativa' : ''}"
              data-variavel=${a.variavel}
              role="button"
              aria-pressed=${ativa ? 'true' : 'false'}
              tabindex="0"
              title=${titulo}
              @click=${() => this._selecionar(a.variavel)}
              @keydown=${(ev: KeyboardEvent) => this._tecla(ev, a.variavel)}
            >
              <span class="rotulo" title=${a.rotulo}>${a.rotulo}</span>
              <div class="trilho">
                <div class="eixo"></div>
                <div class="barra esquerda ${emDestaque ? 'destaque' : 'neutra'}" style="width: ${esquerdaPct}%;"></div>
                <div class="barra direita ${emDestaque ? 'destaque' : 'neutra'}" style="width: ${direitaPct}%;"></div>
              </div>
              <span class="valor">${rotuloValor}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}

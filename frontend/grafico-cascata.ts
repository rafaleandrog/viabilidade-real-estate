// Cascata horizontal do resultado (Rodada 12, handoff de KPIs/gráficos §4.1).
// Componente customizado — nenhum primitivo `urbi-*` cobre cascata/waterfall
// (confirmado contra `docs/ui-urbiverso/primitivos.json` e
// `node_modules/@urbiverso/sdk/dist/index.d.ts` antes de escrever este
// arquivo). Consome `EtapaCascata[]` já pronta de
// `frontend/cascata-resultado-motor.ts` — não recalcula nada.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EtapaCascata } from './cascata-resultado-motor.js';
import { fmtR$ } from './viab-format.js';

@customElement('viab-grafico-cascata')
export class ViabGraficoCascata extends LitElement {
  @property({ attribute: false }) etapas: EtapaCascata[] = [];
  /** Rótulo da linha clicável que expande detalhamento (ex.: "custo_direto"). */
  @property({ attribute: false }) idExpandivel: string | null = null;

  static styles = css`
    :host { display: block; }
    .linha {
      display: grid;
      grid-template-columns: 148px 1fr 78px;
      align-items: center;
      gap: 8px;
      min-height: 28px;
    }
    .linha + .linha { margin-top: 2px; }
    .rotulo {
      font-size: 12px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rotulo.clicavel { cursor: pointer; text-decoration: underline dotted; }
    .trilho {
      position: relative;
      height: 14px;
      background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08));
      border-radius: 3px;
      overflow: hidden;
    }
    .barra { position: absolute; top: 0; bottom: 0; border-radius: 3px; }
    .barra.subtotal { background: var(--cor-texto-fraco, #9aa5b1); }
    .barra.deducao { background: var(--cor-erro, #d45a3a); }
    .barra.total { background: var(--cor-sucesso, #13a98d); }
    .valor {
      font-size: 12px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
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

  render(): TemplateResult {
    if (this.etapas.length === 0) return html``;
    const base = this.etapas.find((e) => e.id === 'vgv_tabela')?.valor ?? 0;
    return html`
      <div>
        ${this.etapas.map((e) => {
          const clicavel = e.id === this.idExpandivel;
          return html`
            <div class="linha">
              <span
                class="rotulo ${clicavel ? 'clicavel' : ''}"
                title=${e.rotulo}
                @click=${() => this._clique(e.id)}
              >${e.rotulo}</span>
              <div class="trilho">
                <div
                  class="barra ${e.tipo}"
                  style="left: ${e.leftPct}%; width: ${e.widthPct}%;"
                ></div>
              </div>
              <span class="valor">${fmtR$(e.valor)}</span>
            </div>
          `;
        })}
      </div>
      ${base > 0
        ? html`<div class="rodape">Escala: largura total = VGV de tabela (${fmtR$(base)}).</div>`
        : nothing}
    `;
  }
}

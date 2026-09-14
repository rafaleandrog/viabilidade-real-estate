// Cadeia de áreas (Rodada 12, handoff de KPIs/gráficos §4.4) — substitui as
// pizzas de alocação de área por uma barra empilhada horizontal única
// mostrando a cadeia física (Loteamento: poligonal → parcelável → líquida →
// ALV; Incorporação: terreno → construída total → privativa total), com a
// eficiência como número ao lado. Componente customizado — nenhum primitivo
// `urbi-*` desenha barra empilhada horizontal.
//
// Cada estágio é um SUBCONJUNTO físico do anterior (não uma soma de partes
// lado a lado) — por isso o desenho é um funil de barras alinhadas à
// esquerda, largura proporcional ao primeiro estágio (a âncora), não uma
// pilha de segmentos concatenados.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LinhaResolvida } from './areas-cascata.js';
import { fmtNum } from './viab-format.js';
import { corCategorica } from './paleta-categorica.js';

@customElement('viab-grafico-cadeia-areas')
export class ViabGraficoCadeiaAreas extends LitElement {
  @property({ attribute: false }) etapas: LinhaResolvida[] = [];
  /** Rótulo da eficiência (ex.: "Privativa / construída", "ALV / poligonal"). */
  @property() rotuloEficiencia = '';
  /** Eficiência já calculada (0–100), ou `null` quando não há base para julgá-la. */
  @property({ attribute: false }) eficienciaPct: number | null = null;

  static styles = css`
    :host { display: block; }
    .linha {
      display: grid;
      grid-template-columns: 148px 1fr 78px;
      align-items: center;
      gap: 8px;
      min-height: 26px;
    }
    .linha + .linha { margin-top: 4px; }
    .rotulo {
      font-size: 12px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trilho {
      position: relative;
      height: 16px;
      background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08));
      border-radius: 3px;
      overflow: hidden;
    }
    .barra { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 3px; }
    .valor {
      font-size: 12px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
    }
    .eficiencia {
      margin-top: 10px;
      font-size: 12px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    }
    .eficiencia strong {
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
      font-variant-numeric: tabular-nums;
    }
  `;

  render(): TemplateResult {
    if (this.etapas.length === 0) return html``;
    const base = this.etapas[0]?.m2 ?? 0;
    return html`
      <div>
        ${this.etapas.map((e, i) => html`
          <div class="linha">
            <span class="rotulo" title=${e.label}>${e.label}</span>
            <div class="trilho">
              <div
                class="barra"
                style="width: ${base > 0 ? (e.m2 / base) * 100 : 0}%; background: ${corCategorica(i)};"
              ></div>
            </div>
            <span class="valor">${fmtNum(e.m2)} m²</span>
          </div>
        `)}
      </div>
      ${this.rotuloEficiencia && this.eficienciaPct !== null
        ? html`<div class="eficiencia">${this.rotuloEficiencia}: <strong>${fmtNum(this.eficienciaPct, 1)}%</strong></div>`
        : nothing}
    `;
  }
}

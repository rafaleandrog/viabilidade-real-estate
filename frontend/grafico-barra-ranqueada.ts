// Barra horizontal ranqueada (Rodada 12, handoff de KPIs/gráficos §5.6):
// "pizza só com quatro categorias ou menos; acima disso, barra horizontal
// ranqueada". Componente genérico e customizado — nenhum primitivo `urbi-*`
// desenha barra horizontal (`urbi-grafico-colunas` só faz barras verticais,
// confirmado contra `referencia/ui-urbiverso/primitivos.json`).
//
// Reusado em dois lugares (Rodada 12): o detalhamento de "Custo direto" que
// a cascata do resultado expande ao clicar, e qualquer pizza do Preliminar
// que hoje excede 4 fatias.

import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { fmtR$ } from './viab-format.js';
import { corCategorica } from './paleta-categorica.js';

export interface ItemBarraRanqueada { l: string; v: number; }

@customElement('viab-grafico-barra-ranqueada')
export class ViabGraficoBarraRanqueada extends LitElement {
  @property({ attribute: false }) itens: ItemBarraRanqueada[] = [];

  static styles = css`
    :host { display: block; }
    .linha {
      display: grid;
      grid-template-columns: 112px 1fr 78px;
      align-items: center;
      gap: 8px;
      min-height: 24px;
    }
    .linha + .linha { margin-top: 2px; }
    .rotulo {
      font-size: 12px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trilho {
      position: relative;
      height: 12px;
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
  `;

  render(): TemplateResult {
    const validos = this.itens.filter((i) => i.v > 0.005);
    if (validos.length === 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-simple" mensagem="Sem itens para exibir."></urbi-estado-vazio>`;
    }
    const ranqueados = [...validos].sort((a, b) => b.v - a.v);
    const maior = ranqueados[0].v;
    return html`
      <div>
        ${ranqueados.map((item, i) => html`
          <div class="linha">
            <span class="rotulo" title=${item.l}>${item.l}</span>
            <div class="trilho">
              <div
                class="barra"
                style="width: ${maior > 0 ? (item.v / maior) * 100 : 0}%; background: ${corCategorica(i)};"
              ></div>
            </div>
            <span class="valor">${fmtR$(item.v)}</span>
          </div>
        `)}
      </div>
    `;
  }
}

import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estilosBase } from './viab-shared.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';

const CORES = ['#2AA9E0', '#F7A111', '#13A98D', '#D45A3A', '#8E7CC3', '#5AA469', '#E0679B', '#C9A227', '#4A90D9', '#6FB3A0'];

function polar(cx: number, cy: number, r: number, ang: number) {
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}
function fatiaPath(cx: number, cy: number, r: number, ini: number, fim: number): string {
  const p0 = polar(cx, cy, r, ini), p1 = polar(cx, cy, r, fim);
  const grande = fim - ini > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${grande} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)} Z`;
}

@customElement('viab-tela-graficos')
export class ViabTelaGraficos extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @state() private excluirTerreno = false;

  static styles = [estilosBase, css`
    :host { display: block; }
    .graficos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .legenda { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; font-size: 0.82rem; }
    .legenda .item { display: flex; align-items: center; gap: 8px; }
    .legenda .cor { width: 12px; height: 12px; border-radius: 3px; flex: none; }
    .legenda .val { margin-left: auto; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); font-variant-numeric: tabular-nums; }
    .check { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.85rem; }
    svg { max-width: 100%; height: auto; }
    .barras-legenda { display: flex; gap: 16px; justify-content: center; margin-top: 8px; font-size: 0.82rem; }
  `];

  render() {
    if (!this.estudo) return nothing;
    const p = calcularProforma({ ...this.estudo } as ProformaInput);
    return html`
      <div class="graficos">
        <div class="card">
          <h3 style="margin-top:0">Composição dos custos</h3>
          <div class="check">
            <input type="checkbox" .checked=${this.excluirTerreno} @change=${(e: Event) => this.excluirTerreno = (e.target as HTMLInputElement).checked} />
            <label>Excluir custo de aquisição do terreno</label>
          </div>
          ${this._renderPizza(p)}
        </div>
        <div class="card">
          <h3 style="margin-top:0">Receita × Custos</h3>
          ${this._renderBarras(p)}
        </div>
      </div>
    `;
  }

  private _custos(p: Proforma) {
    const itens = [
      { l: 'Terreno', v: p.custoTerreno, terreno: true },
      { l: 'Infraestrutura', v: p.infraestrutura },
      { l: 'Construção', v: p.construcao },
      { l: 'Decoração', v: p.decoracao },
      { l: 'Gestão da construção', v: p.gestaoConstrucao },
      { l: 'Projetos', v: p.projetos },
      { l: 'Outorga', v: p.outorga },
      { l: 'Incorporação e registro', v: p.incorporacaoRegistro },
      { l: 'Manutenção', v: p.manutencao },
      { l: 'Contingências', v: p.contingencias },
      { l: 'Marketing global', v: p.marketingGlobal },
      { l: 'Gestão e indiretos', v: p.gestaoIndiretos },
    ];
    return itens.filter((i) => i.v > 0.005 && !(i.terreno && this.excluirTerreno));
  }

  private _renderPizza(p: Proforma) {
    const custos = this._custos(p);
    const total = custos.reduce((s, c) => s + c.v, 0);
    if (total <= 0) return html`<p class="sec">Sem custos para exibir.</p>`;
    let ang = -Math.PI / 2;
    const fatias = custos.map((c, i) => {
      const frac = c.v / total;
      const ini = ang, fim = ang + frac * 2 * Math.PI;
      ang = fim;
      return { path: fatiaPath(100, 100, 90, ini, fim), cor: CORES[i % CORES.length], ...c, frac };
    });
    return html`
      <svg viewBox="0 0 200 200" role="img" aria-label="Composição dos custos">
        ${fatias.map((f) => svg`<path d=${f.path} fill=${f.cor}><title>${f.l}: ${fmtR$(f.v)}</title></path>`)}
      </svg>
      <div class="legenda">
        ${fatias.map((f) => html`<div class="item">
          <span class="cor" style="background:${f.cor}"></span>
          <span>${f.l}</span>
          <span class="val">${fmtR$(f.v)} · ${fmtPct(f.frac * 100)}</span>
        </div>`)}
      </div>`;
  }

  private _renderBarras(p: Proforma) {
    const receita = p.vgv;
    const custos = p.custoDiretoTotal + p.custoIndiretoTotal;
    const max = Math.max(receita, custos, 1);
    const alt = (v: number) => Math.round(v / max * 160);
    const barra = (x: number, v: number, cor: string, rot: string) => {
      const h = alt(v);
      return svg`
        <rect x=${x} y=${180 - h} width="70" height=${h} rx="4" fill=${cor}></rect>
        <text x=${x + 35} y=${180 - h - 6} text-anchor="middle" font-size="9" fill="currentColor">${fmtR$(v)}</text>
        <text x=${x + 35} y="196" text-anchor="middle" font-size="10" fill="currentColor">${rot}</text>`;
    };
    return html`
      <svg viewBox="0 0 240 210" role="img" aria-label="Receita versus Custos">
        <line x1="20" y1="180" x2="230" y2="180" stroke="currentColor" stroke-opacity="0.2"></line>
        ${barra(45, receita, '#13A98D', 'Receita')}
        ${barra(140, custos, '#D45A3A', 'Custos')}
      </svg>
      <div class="barras-legenda">
        <span>Resultado: <strong>${fmtR$(receita - custos)}</strong></span>
      </div>`;
  }
}

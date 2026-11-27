import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SerieGrafico } from './funding-janela-dados.js';

// O gráfico de UMA operação do Funding: entradas, saídas e saldo, mês a mês.
// É o mesmo componente na "Prévia do fluxo" da janela de operação (o rascunho)
// e na página da operação (a gravada). SVG próprio, pintado só com tokens, no
// padrão do gráfico do Financiamento à produção. Série sem movimento não chega
// aqui (`serieDoGrafico` devolve null) e o componente sem série não desenha.
@customElement('viab-funding-grafico-operacao')
export class ViabFundingGraficoOperacao extends LitElement {
  @property({ attribute: false }) serie: SerieGrafico | null = null;
  /** Título curto do gráfico, também o nome acessível do SVG. */
  @property() titulo = 'Fluxo da operação';

  static styles = css`
    :host { display: block; min-width: 0; }
    h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo); text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--cor-texto-sec);
    }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .entradas { stroke: var(--cor-sucesso); fill: none; stroke-width: 2; }
    .saidas { stroke: var(--cor-erro); fill: none; stroke-width: 2; }
    .saldo { stroke: var(--cor-alerta); fill: none; stroke-width: 2.5; }
    .zero { stroke: var(--cor-borda); stroke-width: 1; }
    .eixo { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--cor-texto-sec); margin-top: 2px; }
    .legenda { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.72rem; margin-top: 6px; color: var(--cor-texto-sec); }
    .legenda span { display: inline-flex; align-items: center; gap: 4px; }
    .ponto { width: 8px; height: 8px; border-radius: var(--raio-pill); display: inline-block; }
    .ponto.entradas { background: var(--cor-sucesso); }
    .ponto.saidas { background: var(--cor-erro); }
    .ponto.saldo { background: var(--cor-alerta); }
  `;

  render() {
    const s = this.serie;
    if (!s) return nothing;
    const meses = Math.max(s.entradas.length, s.saidas.length, s.saldo.length);
    if (meses === 0) return nothing;
    const todos = [...s.entradas, ...s.saidas, ...s.saldo];
    const max = Math.max(1, ...todos);
    const min = Math.min(0, ...todos);
    const largura = 400, altura = 140, base = 2;
    const x = (t: number) => (meses <= 1 ? 0 : (t / (meses - 1)) * largura);
    const y = (v: number) => (altura - base) - ((v - min) / (max - min)) * (altura - base);
    const pontos = (xs: number[]) => xs.map((v, i) => `${x(i)},${y(v ?? 0)}`).join(' ');
    return html`
      <h4>${this.titulo}</h4>
      <svg viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="xMinYMin meet" role="img" aria-label=${this.titulo}>
        ${svg`<line class="zero" x1="0" x2=${largura} y1=${y(0)} y2=${y(0)}></line>`}
        ${svg`<polyline class="entradas" points=${pontos(s.entradas)}></polyline>`}
        ${svg`<polyline class="saidas" points=${pontos(s.saidas)}></polyline>`}
        ${svg`<polyline class="saldo" points=${pontos(s.saldo)}></polyline>`}
      </svg>
      <div class="eixo" aria-hidden="true"><span>mês 1</span><span>mês ${meses}</span></div>
      <div class="legenda">
        <span><i class="ponto entradas"></i>Entradas</span>
        <span><i class="ponto saidas"></i>Saídas</span>
        <span><i class="ponto saldo"></i>${s.rotuloSaldo}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'viab-funding-grafico-operacao': ViabFundingGraficoOperacao }
}

// `<viab-faixa-cenarios>` — a faixa bear–base–bull contra o benchmark de UM
// indicador (Rodada 13, handoff §4.6.C — issue #731). Substitui as três
// pílulas com bola colorida da tabela de indicadores da aba Cenários.
//
// Componente customizado: nenhum primitivo `urbi-*` desenha uma barra
// horizontal com faixas ao fundo e marcadores (`urbi-grafico-medidor` é um
// arco com UMA agulha; `urbi-grafico-colunas` é vertical). Toma do contrato
// de UI só o que a família já usa — tokens de cor (as faixas vêm de
// `montarMedidor`, que já entrega `var(--cor-*)`), `title` como tooltip.
// Cor NUNCA viaja como dado do app para o primitivo: aqui o dado É do app.
//
// Consome `FaixaCenarios` pronta de `frontend/faixa-cenarios-motor.ts` — não
// recalcula nada: a escala única é decisão do motor, o desenho é daqui.
//
// ⚠️ Dentro do bloco `static styles = css`...``, NENHUM comentário pode usar
// crase: ela fecha o template literal.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { FaixaCenarios } from './faixa-cenarios-motor.js';
import { fmtPct } from './viab-format.js';

@customElement('viab-faixa-cenarios')
export class ViabFaixaCenarios extends LitElement {
  @property() rotulo = '';
  @property({ attribute: false }) faixa: FaixaCenarios | null = null;

  static styles = css`
    :host { display: block; }
    .linha {
      display: grid;
      grid-template-columns: minmax(112px, 160px) 1fr auto;
      align-items: center;
      gap: 12px;
      min-height: 32px;
      padding: 4px 0;
    }
    .rotulo {
      font-size: 12px;
      font-weight: 600;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trilho {
      position: relative;
      height: 14px;
      border-radius: 3px;
      overflow: visible;
      background: var(--cor-borda-sutil, rgba(255, 255, 255, 0.08));
    }
    .segmento { position: absolute; top: 0; bottom: 0; opacity: 0.55; }
    .segmento.primeiro { border-radius: 3px 0 0 3px; }
    .segmento.ultimo { border-radius: 0 3px 3px 0; }
    /* O segmento bear-bull liga os dois marcadores finos: e o TRECHO que o
       estresse varre, e e ele que mostra quao perto da borda o projeto anda. */
    .ligacao {
      position: absolute;
      top: 5px;
      height: 4px;
      background: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
      opacity: 0.6;
    }
    .marcador { position: absolute; top: -3px; bottom: -3px; width: 2px; transform: translateX(-50%); }
    .marcador.bear { background: var(--cor-erro, #D45A3A); }
    .marcador.bull { background: var(--cor-info, #2AA9E0); }
    /* A base e o marcador CHEIO: mais largo, cor forte, borda para se
       destacar sobre qualquer faixa. */
    .marcador.base {
      width: 6px;
      top: -5px;
      bottom: -5px;
      border-radius: 2px;
      background: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
      box-shadow: 0 0 0 1px var(--cor-borda-forte, rgba(255, 255, 255, 0.3));
    }
    .valores {
      display: flex;
      gap: 10px;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .valores .bear { color: var(--cor-erro, #D45A3A); }
    .valores .base { color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95)); font-weight: 700; }
    .valores .bull { color: var(--cor-info, #2AA9E0); }
    .extremos {
      grid-column: 2;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--cor-texto-fraco, rgba(255, 255, 255, 0.4));
      margin-top: -2px;
    }
  `;

  render(): TemplateResult {
    const f = this.faixa;
    if (!f) return html`${nothing}`;
    const v = (x: number | null) => (x === null ? '—' : fmtPct(x));
    const m = f.marcadores;
    const ligacao = m.bear !== null && m.bull !== null
      ? { de: Math.min(m.bear, m.bull), ate: Math.max(m.bear, m.bull) }
      : null;
    const titulo = `${this.rotulo}: Bear ${v(f.valores.bear)} · Base ${v(f.valores.base)} · Bull ${v(f.valores.bull)} — escala de ${fmtPct(f.min)} a ${fmtPct(f.max)}${f.estendida ? ' (estendida além do benchmark para caber os cenários)' : ''}`;
    return html`
      <div class="linha" title=${titulo} role="img" aria-label=${titulo}>
        <span class="rotulo">${this.rotulo}</span>
        <div class="trilho">
          ${f.segmentos.map((s, i) => html`<div
            class="segmento ${i === 0 ? 'primeiro' : ''} ${i === f.segmentos.length - 1 ? 'ultimo' : ''}"
            style="left: ${s.dePct}%; width: ${Math.max(0, s.atePct - s.dePct)}%; background: ${s.cor};"
          ></div>`)}
          ${ligacao ? html`<div class="ligacao" style="left: ${ligacao.de}%; width: ${Math.max(0, ligacao.ate - ligacao.de)}%;"></div>` : nothing}
          ${m.bear !== null ? html`<div class="marcador bear" style="left: ${m.bear}%;"></div>` : nothing}
          ${m.bull !== null ? html`<div class="marcador bull" style="left: ${m.bull}%;"></div>` : nothing}
          ${m.base !== null ? html`<div class="marcador base" style="left: ${m.base}%;"></div>` : nothing}
        </div>
        <div class="valores">
          <span class="bear">📉 ${v(f.valores.bear)}</span>
          <span class="base">📊 ${v(f.valores.base)}</span>
          <span class="bull">🚀 ${v(f.valores.bull)}</span>
        </div>
        <div class="extremos"><span>${fmtPct(f.min)}</span><span>${f.estendida ? 'escala estendida · ' : ''}${fmtPct(f.max)}</span></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'viab-faixa-cenarios': ViabFaixaCenarios; }
}

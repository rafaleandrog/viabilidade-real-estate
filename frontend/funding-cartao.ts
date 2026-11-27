// Cartão de uma operação de funding — dívida, equity ou antecipação.
//
// Componente de domínio deste app (como a cascata e a cadeia de áreas): não há
// primitivo de "cartão clicável com grade de KPIs". O que ele toma da
// plataforma: o `urbi-badge` do tipo, com a cor pela prop `cor`, e os tokens do
// tema. Só desenha: recebe `DadosCartao` pronto (`funding-cartao-dados.ts`) e
// não simula nada.
//
// O cartão inteiro é UM controle: `role="button"`, `tabindex="0"`, nome
// acessível "Abrir operação <nome>", Enter e Espaço abrem. Nada interativo mora
// dentro dele. Abrir é o evento `viab:abrir-operacao`, com o `id` da operação;
// quem troca de página é a tela.
//
// Dentro do bloco de estilos, nenhum comentário pode usar crase: ela fecha o
// template literal.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { DadosCartao, KpiCartao, ValorCartao } from './funding-cartao-dados.js';
import { AVISO_SEM_LASTRO } from './funding-cartao-dados.js';
import { corDoTipo } from './funding-cores.js';

@customElement('viab-funding-cartao')
export class ViabFundingCartao extends LitElement {
  @property({ attribute: false }) dados: DadosCartao | null = null;

  static styles = css`
    :host {
      display: block;
      min-width: 0;
      box-sizing: border-box;
      background: var(--cor-superficie);
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md);
      cursor: pointer;
      outline: none;
    }
    :host(:hover) { border-color: var(--cor-texto-sec); }
    :host(:focus-visible) { outline: 2px solid var(--cor-foco); outline-offset: 2px; }
    .moldura {
      box-sizing: border-box;
      border-left: 4px solid;
      border-radius: var(--raio-md) 0 0 var(--raio-md);
      padding: 12px 14px;
      min-width: 0;
    }
    .cab { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
    .nome {
      font-weight: 700; font-size: 1rem; color: var(--cor-texto);
      min-width: 0; overflow-wrap: anywhere;
    }
    .termos, .kpis {
      display: grid; gap: 8px 12px; margin-top: 10px;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    }
    .item { min-width: 0; }
    .rot {
      font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec); font-weight: 700;
    }
    .val {
      color: var(--cor-texto); font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere; word-break: break-word;
    }
    .termos .val { font-size: 0.85rem; margin-top: 2px; }
    .kpis {
      border-top: 1px solid; border-top-color: var(--cor-borda);
      padding-top: 10px;
    }
    .kpis .val { font-size: 0.95rem; font-weight: 700; margin-top: 3px; }
    .antes {
      color: var(--cor-texto-sec); font-weight: 400;
      text-decoration: line-through; text-decoration-color: currentColor;
    }
    .seta { color: var(--cor-texto-sec); font-weight: 400; margin: 0 4px; }
    .leitura { margin-top: 10px; }
    .leitura h4 {
      margin: 0 0 4px; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec);
    }
    .leitura p { margin: 0 0 4px; font-size: 0.82rem; color: var(--cor-texto); }
    .aviso { font-size: 0.78rem; color: var(--cor-texto-sec); margin: 8px 0 0; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    this.addEventListener('click', this._abrir);
    this.addEventListener('keydown', this._tecla);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._abrir);
    this.removeEventListener('keydown', this._tecla);
    super.disconnectedCallback();
  }

  updated(): void {
    this.setAttribute('aria-label', `Abrir operação ${this.dados?.nome ?? ''}`.trim());
  }

  private _abrir = (): void => {
    if (!this.dados) return;
    this.dispatchEvent(new CustomEvent('viab:abrir-operacao', {
      detail: { id: this.dados.id }, bubbles: true, composed: true,
    }));
  };

  private _tecla = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    this._abrir();
  };

  private _valor(v: ValorCartao): TemplateResult {
    return html`<span title=${v.titulo ?? nothing}>${v.texto}</span>`;
  }

  private _kpi(k: KpiCartao): TemplateResult {
    return html`
      <div class="item kpi">
        <div class="rot">${k.rotulo}</div>
        <div class="val">${k.antes ? html`<s class="antes" title=${k.antes.titulo ?? nothing}>${k.antes.texto}</s><span class="seta" aria-hidden="true">→</span>` : nothing}${this._valor(k.valor)}</div>
      </div>`;
  }

  render() {
    const d = this.dados;
    if (!d) return html`${nothing}`;
    return html`
      <div class="moldura" style="border-left-color: ${corDoTipo(d.tipo)}">
        <div class="cab">
          <urbi-badge cor=${d.corBadge}>${d.rotuloTipo}</urbi-badge>
          <span class="nome">${d.nome}</span>
        </div>
        <div class="termos">
          ${d.termos.map((t) => html`
            <div class="item termo"><div class="rot">${t.rotulo}</div><div class="val">${this._valor(t.valor)}</div></div>`)}
        </div>
        ${d.leitura.length > 0 ? html`
          <div class="leitura">
            <h4>Leitura da operação</h4>
            ${d.leitura.map((f) => html`<p>${f}</p>`)}
          </div>` : nothing}
        <div class="kpis">${d.kpis.map((k) => this._kpi(k))}</div>
        ${d.semLastro ? html`<p class="aviso">${AVISO_SEM_LASTRO}</p>` : nothing}
      </div>
    `;
  }
}

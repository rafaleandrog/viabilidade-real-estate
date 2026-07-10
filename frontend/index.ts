import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './tela-dashboard.js';
import './tela-estudo.js';
import './viabilidade-config-benchmarks.js';
import { urbiVerso } from './viabilidade-api.js';

// Web component raiz da app. O shell monta <app-viabilidade> e injeta window.urbiVerso.
// Roteamento interno por sub-rota: '/', '/terrenos', '/detalhe/{id}'.

interface Rota {
  tela: 'dashboard' | 'estudo';
  aba?: 'estudos' | 'terrenos';
  estudoId?: number;
}

function parsearSubRota(sub: string): Rota {
  const partes = (sub || '').replace(/^\//, '').split('/').filter(Boolean);
  if (partes[0] === 'detalhe' && partes[1]) {
    const id = parseInt(partes[1]);
    if (!isNaN(id)) return { tela: 'estudo', estudoId: id };
  }
  if (partes[0] === 'terrenos') return { tela: 'dashboard', aba: 'terrenos' };
  return { tela: 'dashboard', aba: 'estudos' };
}

@customElement('app-viabilidade')
export class AppViabilidade extends LitElement {
  @state() private rota: Rota = { tela: 'dashboard', aba: 'estudos' };
  private _cleanupRota?: () => void;

  static styles = css`
    :host {
      display: block;
      min-height: 100%;
      background: var(--cor-fundo, #0D1B2A);
      color: var(--cor-texto, rgba(255, 255, 255, 0.85));
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.rota = parsearSubRota(urbiVerso.subRota());
    this._cleanupRota = urbiVerso.escutarRota((sub) => { this.rota = parsearSubRota(sub); });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanupRota?.();
  }

  render() {
    if (this.rota.tela === 'estudo') {
      return html`<viab-tela-estudo .estudoId=${this.rota.estudoId || 0}></viab-tela-estudo>`;
    }
    return html`<viab-tela-dashboard .aba=${this.rota.aba || 'estudos'}></viab-tela-dashboard>`;
  }
}

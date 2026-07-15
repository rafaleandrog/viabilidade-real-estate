import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './tela-dashboard.js';
import './tela-estudo.js';
import './viabilidade-config-benchmarks.js';
import { urbiVerso } from './viabilidade-api.js';
import { estiloPagina } from './estilos.js';

// Web component raiz da app. O shell monta <app-viabilidade> e injeta window.urbiVerso.
// Roteamento interno por sub-rota: '/', '/terrenos', '/detalhe/{id}'.

interface Rota {
  tela: 'dashboard' | 'estudo';
  aba?: 'estudos' | 'terrenos';
  estudoId?: number;
  abaEstudo?: string; // guia dentro do estudo: premissas|proforma|graficos|apelo
}

function parsearSubRota(sub: string): Rota {
  const partes = (sub || '').replace(/^\//, '').split('/').filter(Boolean);
  if (partes[0] === 'detalhe' && partes[1]) {
    const id = parseInt(partes[1]);
    if (!isNaN(id)) return { tela: 'estudo', estudoId: id, abaEstudo: partes[2] };
  }
  if (partes[0] === 'terrenos') return { tela: 'dashboard', aba: 'terrenos' };
  return { tela: 'dashboard', aba: 'estudos' };
}

@customElement('app-viabilidade')
export class AppViabilidade extends LitElement {
  @state() private rota: Rota = { tela: 'dashboard', aba: 'estudos' };
  private _cleanupRota?: () => void;

  // Contrato de página: o shell provê fundo e cor; a raiz só ancora a
  // cadeia de altura (height:100%) pras telas filhas herdarem.
  static styles = [estiloPagina];

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
      return html`<viab-tela-estudo
        .estudoId=${this.rota.estudoId || 0}
        .aba=${this.rota.abaEstudo || 'premissas'}
      ></viab-tela-estudo>`;
    }
    return html`<viab-tela-dashboard .aba=${this.rota.aba || 'estudos'}></viab-tela-dashboard>`;
  }
}

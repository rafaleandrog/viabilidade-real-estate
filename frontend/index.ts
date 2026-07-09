import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

// Web component raiz da app. O shell monta <app-viabilidade> e injeta window.urbiVerso.
// Etapa 0: esqueleto. Roteamento interno, Dashboard e telas chegam a partir da Etapa 4.
@customElement('app-viabilidade')
export class AppViabilidade extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--cor-texto, rgba(255, 255, 255, 0.85));
      padding: var(--espaco-4, 16px);
    }
  `;

  render() {
    return html`<div>Estudo de Viabilidade — em construção.</div>`;
  }
}

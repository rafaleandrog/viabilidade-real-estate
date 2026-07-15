import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { parseNumeroBR } from './viab-format.js';

// Input numérico com máscara pt-BR (bug #1): separador de milhar "." e decimal
// ",". Espelha a API do `urbi-input-numero` (valor: number|null, label, sufixo,
// desabilitado, evento `urbi:input-numero-change`) para ser drop-in — mas, ao
// contrário do primitivo (que usa <input type="number"> e por isso NÃO consegue
// exibir separador de milhar), mostra o número agrupado no estado de repouso.
//
// Estratégia (evita "pulo" de cursor): agrupamento no repouso (sem foco); ao
// focar, mostra o valor cru com vírgula decimal, fácil de editar; ao digitar,
// faz o parse e emite o número limpo.
//
// A flag `atenuado` (bug #15) deixa o campo em cinza para sinalizar que o dado
// não está sendo usado no cálculo naquele momento.
@customElement('viab-num')
export class ViabNum extends LitElement {
  @property() label = '';
  @property({ type: Number }) valor: number | null = null;
  @property() sufixo = '';
  @property() placeholder = '';
  @property({ type: Boolean }) desabilitado = false;
  @property({ type: Boolean, reflect: true }) atenuado = false;
  @property({ type: Number, attribute: 'casas-decimais' }) casasDecimais = 2;

  @state() private _foco = false;
  @state() private _rascunho = '';

  static styles = css`
    :host { display: block; }
    .campo { display: flex; flex-direction: column; gap: 4px; }
    label {
      font-size: 0.75rem; text-transform: uppercase;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-weight: 700; letter-spacing: 0.4px;
    }
    .input-wrap {
      display: flex; align-items: center; gap: 6px;
      background: var(--cor-superficie-hover, rgba(255,255,255,0.08));
      border: 1px solid var(--cor-borda-forte, rgba(255,255,255,0.15));
      border-radius: 8px; padding: 0 10px; transition: border-color 0.15s, opacity 0.15s;
    }
    .input-wrap:focus-within { border-color: var(--cor-primaria-solida, #2AA9E0); }
    .afixo {
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-size: 0.875rem; font-variant-numeric: tabular-nums;
      flex-shrink: 0; user-select: none;
    }
    input {
      flex: 1; min-width: 0; background: none; border: none; outline: none;
      color: var(--cor-texto, rgba(255,255,255,0.85));
      font-family: inherit; font-size: 0.875rem; padding: 8px 0;
      font-variant-numeric: tabular-nums;
    }
    input::placeholder { color: var(--cor-texto-fraco, rgba(255,255,255,0.4)); }
    input:disabled { opacity: 0.5; }
    /* #15: dado não utilizado no cálculo → cinza/atenuado. */
    :host([atenuado]) .input-wrap { opacity: 0.45; }
    :host([atenuado]) label { opacity: 0.6; }
  `;

  private _fmtAgrupado(v: number | null): string {
    if (v == null) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0, maximumFractionDigits: this.casasDecimais,
    }).format(v);
  }

  // Valor cru para edição: vírgula decimal, sem separador de milhar.
  private _paraEdicao(v: number | null): string {
    if (v == null) return '';
    return String(v).replace('.', ',');
  }

  private _display(): string {
    return this._foco ? this._rascunho : this._fmtAgrupado(this.valor);
  }

  render() {
    return html`
      <div class="campo">
        ${this.label ? html`<label>${this.label}</label>` : nothing}
        <div class="input-wrap">
          <input
            type="text"
            inputmode="decimal"
            .value=${this._display()}
            placeholder=${this.placeholder}
            ?disabled=${this.desabilitado}
            @focus=${this._onFocus}
            @blur=${this._onBlur}
            @input=${this._onInput}
          />
          ${this.sufixo ? html`<span class="afixo">${this.sufixo}</span>` : nothing}
        </div>
      </div>
    `;
  }

  private _onFocus() {
    this._foco = true;
    this._rascunho = this._paraEdicao(this.valor);
  }

  private _onBlur() {
    this._foco = false;
  }

  private _onInput(e: Event) {
    const bruto = (e.target as HTMLInputElement).value;
    this._rascunho = bruto;
    const valor = parseNumeroBR(bruto);
    this.valor = valor;
    this.dispatchEvent(new CustomEvent('urbi:input-numero-change', {
      detail: { valor }, bubbles: true, composed: true,
    }));
  }
}

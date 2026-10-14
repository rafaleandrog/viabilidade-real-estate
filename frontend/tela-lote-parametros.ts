import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fmtNum } from './viab-format.js';
import './viab-num.js';
import {
  formDoRegistro, corpoDoForm, validarForm, carimboDoLote, ROTULO_STATUS,
  type FormParametros, type LoteNucleo, type StatusVinculo,
} from './lote-parametros.js';

// Modal "Parâmetros do lote" da aba Terrenos do Painel: coeficiente mínimo e máximo, gabarito máximo
// (e UOS/uso, informativos). Um registro por lote do módulo, no schema do app (`lote_parametros`),
// ligado pelo id do lote. O módulo é só leitura aqui — nada disto volta para ele.
//
// O PUT NÃO mora aqui: o modal pode sair da tela (cancelar, troca de aba) com a requisição em voo, e o
// resultado se perderia. Ele emite `viab-parametros-salvar` (detail: { imovelId, corpo }) e
// `viab-parametros-fechar`; quem salva, atualiza o cache e fecha é o Painel, que continua vivo.
// `salvando` e `erro` vêm de lá.

@customElement('viab-lote-parametros')
export class ViabLoteParametros extends LitElement {
  /** Lote do módulo (linha da aba Terrenos): `{ id, id_legivel, area, rua, numero_lote, parcelamento_id, … }`. */
  @property({ attribute: false }) lote: LoteNucleo | null = null;
  /** Registro de `lote_parametros` desse lote, ou `null` se ainda não há. */
  @property({ attribute: false }) registro: any = null;
  /** Conferência do carimbo do registro contra o lote de hoje. */
  @property() status: StatusVinculo = 'sem-dados';
  @property({ type: Boolean }) editavel = false;
  /** O Painel está com o PUT em voo: fechar é ignorado e os botões ficam desabilitados. */
  @property({ type: Boolean }) salvando = false;
  /** Erro do último salvamento, devolvido pelo Painel. */
  @property() erro = '';

  @state() private form: FormParametros = {};
  @state() private erroLocal = '';

  static styles = css`
    .resumo { margin: 0 0 12px; color: var(--cor-texto-sec); font-size: var(--texto-rotulo, 0.75rem); }
    .grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('registro') || changed.has('lote')) {
      this.form = formDoRegistro(this.registro);
      this.erroLocal = '';
    }
  }

  /** Sem permissão, vínculo a conferir ou PUT em voo: uma edição feita depois de Salvar seria descartada ao fechar. */
  private get _bloqueado(): boolean {
    return !this.editavel || this.salvando || this.status === 'identificacao' || this.status === 'removido';
  }

  private _set(campo: string, valor: string | number | null) { this.form = { ...this.form, [campo]: valor }; }

  // Enquanto o Painel salva, fechar é ignorado e os botões ficam desabilitados.
  private _fechar = () => {
    if (this.salvando) return;
    this.dispatchEvent(new CustomEvent('viab-parametros-fechar', { bubbles: true, composed: true }));
  };

  private _pedir(corpo: Record<string, any>) {
    this.dispatchEvent(new CustomEvent('viab-parametros-salvar', {
      detail: { imovelId: Number(this.lote!.id), corpo }, bubbles: true, composed: true,
    }));
  }

  private _salvar = () => {
    if (this.salvando || !this.lote) return;
    const msg = validarForm(this.form);
    if (msg) { this.erroLocal = msg; return; }
    this.erroLocal = '';
    this._pedir(corpoDoForm(this.form, this.lote, this.registro != null));
  };

  /** Regrava o carimbo com o lote de hoje: o usuário confirma que é o mesmo lote (ex.: retificação de área). */
  private _reconfirmar = () => {
    if (this.salvando || !this.lote) return;
    this.erroLocal = '';
    this._pedir(carimboDoLote(this.lote));
  };

  private _texto(campo: string, rotulo: string, placeholder = ''): TemplateResult {
    return html`
      <urbi-input
        label=${rotulo}
        placeholder=${placeholder}
        ?desabilitado=${this._bloqueado}
        .valor=${String(this.form[campo] ?? '')}
        @urbi:input-change=${(e: CustomEvent) => this._set(campo, e.detail.valor)}
      ></urbi-input>`;
  }

  private _num(campo: string, rotulo: string, casas = 2): TemplateResult {
    return html`
      <viab-num
        label=${rotulo}
        casas-decimais=${casas}
        ?desabilitado=${this._bloqueado}
        .valor=${this.form[campo] as number | null}
        @urbi:input-numero-change=${(e: CustomEvent) => this._set(campo, e.detail.valor)}
      ></viab-num>`;
  }

  private _avisoStatus(): TemplateResult | typeof nothing {
    if (this.status === 'identificacao') {
      return html`<urbi-banner variante="alerta">O lote mudou no módulo desde o cadastro (parcelamento, rua, número,
        quadra ou conjunto diferentes). Confira que é o mesmo lote antes de usar estes valores.</urbi-banner>`;
    }
    if (this.status === 'area') {
      return html`<urbi-banner variante="info">A área do lote no módulo mudou desde o cadastro
        (${fmtNum(Number(this.registro?.area_m2) || 0)} m² → ${fmtNum(Number(this.lote?.area) || 0)} m²).
        Pode ser retificação: os valores continuam valendo.</urbi-banner>`;
    }
    return nothing;
  }

  render(): TemplateResult {
    if (!this.lote) return html`${nothing}`;
    const nome = this.lote.id_legivel || `#${this.lote.id}`;
    const reconfirmavel = this.editavel && (this.status === 'identificacao' || this.status === 'area');
    return html`
      <urbi-modal title="Lote ${nome}" maxWidth="720px" @urbi-modal:close=${this._fechar}>
        <p class="resumo">
          Área no módulo: ${fmtNum(Number(this.lote.area) || 0)} m² · Vínculo: ${ROTULO_STATUS[this.status]}.
          Estes parâmetros são da app de viabilidade e não alteram o cadastro do módulo.
        </p>
        ${this._avisoStatus()}
        <div class="grade">
          ${this._num('coef_minimo', 'Coeficiente de aproveitamento mínimo')}
          ${this._num('coef_maximo', 'Coeficiente de aproveitamento máximo')}
          ${this._num('gabarito_maximo', 'Gabarito máximo (pavimentos)')}
          ${this._texto('uos', 'UOS (zoneamento)', 'Ex: CSIIR 2')}
          ${this._texto('uso', 'Uso', 'Ex: Misto')}
        </div>
        ${(this.erroLocal || this.erro) ? html`<urbi-banner variante="erro">${this.erroLocal || this.erro}</urbi-banner>` : nothing}
        <div class="acoes">
          <urbi-botao variante="fantasma" ?desabilitado=${this.salvando} @click=${this._fechar}>${this.editavel ? 'Cancelar' : 'Fechar'}</urbi-botao>
          ${reconfirmavel
            ? html`<urbi-botao variante="fantasma" ?desabilitado=${this.salvando} @click=${this._reconfirmar}>Reconfirmar vínculo</urbi-botao>`
            : nothing}
          ${this.editavel
            ? html`<urbi-botao variante="primario" ?desabilitado=${this._bloqueado} ?carregando=${this.salvando} @click=${this._salvar}>Salvar</urbi-botao>`
            : nothing}
        </div>
      </urbi-modal>`;
  }
}

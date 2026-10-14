import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fmtNum } from './viab-format.js';
import './viab-num.js';
import {
  SITUACOES, TOPOGRAFIAS, INFRAESTRUTURAS, formDoComplemento, payloadDoForm, validarForm,
  type FormComplemento,
} from './terrenos-complemento.js';

// Modal de "Informações do terreno" da aba Terrenos do Painel: dados de viabilidade de uma gleba
// ou de um lote que o módulo imobiliário não guarda. Um registro por imóvel (tabela
// `terrenos_complemento`). O Núcleo é só leitura aqui — nada disto volta para ele.
// O PUT NÃO mora aqui: o modal pode sair da tela (cancelar, troca de aba) com a requisição em voo, e o
// resultado se perderia. Ele emite `viab-complemento-salvar` (detail: o corpo do PUT) e `viab-complemento-fechar`;
// quem salva, atualiza o cache e fecha é o Painel, que continua vivo. `salvando` e `erro` vêm de lá.

const SEM_VALOR = { valor: '', rotulo: 'Não informado' };

@customElement('viab-terreno-complemento')
export class ViabTerrenoComplemento extends LitElement {
  /** Linha da aba Terrenos: `{ id, _tipo: 'gleba' | 'lote', id_legivel, area }`. */
  @property({ attribute: false }) terreno: any = null;
  /** Registro de `terrenos_complemento` desse imóvel, ou `null` se ainda não há. */
  @property({ attribute: false }) complemento: any = null;
  @property({ type: Boolean }) editavel = false;
  /** O Painel está com o PUT em voo: fechar é ignorado e os botões ficam desabilitados. */
  @property({ type: Boolean }) salvando = false;
  /** Erro do último salvamento, devolvido pelo Painel. */
  @property() erro = '';

  @state() private form: FormComplemento = {};
  @state() private erroLocal = '';

  static styles = css`
    .resumo { margin: 0 0 12px; color: var(--cor-texto-sec); font-size: var(--texto-rotulo, 0.75rem); }
    .grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .cheio { grid-column: 1 / -1; }
    .acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('complemento') || changed.has('terreno')) {
      this.form = formDoComplemento(this.complemento);
      this.erroLocal = '';
    }
  }

  private _set(campo: string, valor: string | number | null) {
    this.form = { ...this.form, [campo]: valor };
  }

  // Enquanto o Painel salva, fechar é ignorado e os botões ficam desabilitados: o resultado do PUT
  // atualiza o cache e fecha o modal por conta do Painel.
  private _fechar = () => {
    if (this.salvando) return;
    this.dispatchEvent(new CustomEvent('viab-complemento-fechar', { bubbles: true, composed: true }));
  };

  private _salvar = () => {
    if (this.salvando) return;
    const msg = validarForm(this.form);
    if (msg) { this.erroLocal = msg; return; }
    this.erroLocal = '';
    this.dispatchEvent(new CustomEvent('viab-complemento-salvar', {
      detail: { tipo: this.terreno._tipo, imovelId: Number(this.terreno.id), corpo: payloadDoForm(this.form) },
      bubbles: true, composed: true,
    }));
  };

  private _texto(campo: string, rotulo: string, placeholder = ''): TemplateResult {
    return html`
      <urbi-input
        label=${rotulo}
        placeholder=${placeholder}
        ?desabilitado=${!this.editavel}
        .valor=${String(this.form[campo] ?? '')}
        @urbi:input-change=${(e: CustomEvent) => this._set(campo, e.detail.valor)}
      ></urbi-input>`;
  }

  private _num(campo: string, rotulo: string, opcoes: { sufixo?: string; casas?: number; minimas?: number } = {}): TemplateResult {
    return html`
      <viab-num
        label=${rotulo}
        sufixo=${opcoes.sufixo ?? ''}
        casas-decimais=${opcoes.casas ?? 2}
        casas-minimas=${opcoes.minimas ?? 0}
        ?desabilitado=${!this.editavel}
        .valor=${this.form[campo] as number | null}
        @urbi:input-numero-change=${(e: CustomEvent) => this._set(campo, e.detail.valor)}
      ></viab-num>`;
  }

  private _select(campo: string, rotulo: string, opcoes: { valor: string; rotulo: string }[]): TemplateResult {
    return html`
      <urbi-select
        label=${rotulo}
        ?desabilitado=${!this.editavel}
        .valor=${String(this.form[campo] ?? '')}
        .opcoes=${[SEM_VALOR, ...opcoes]}
        @urbi:select-change=${(e: CustomEvent) => this._set(campo, e.detail.valor)}
      ></urbi-select>`;
  }

  render(): TemplateResult {
    if (!this.terreno) return html`${nothing}`;
    const tipo = this.terreno._tipo === 'gleba' ? 'Gleba' : 'Lote';
    const nome = this.terreno.id_legivel || `#${this.terreno.id}`;
    return html`
      <urbi-modal title="${tipo} ${nome}" maxWidth="760px" @urbi-modal:close=${this._fechar}>
        <p class="resumo">
          Área no Núcleo: ${fmtNum(Number(this.terreno.area) || 0)} m². Estas informações são da app de
          viabilidade e não alteram o cadastro do Núcleo.
        </p>
        <div class="grade">
          ${this._select('situacao_negociacao', 'Situação da negociação', SITUACOES)}
          ${this._num('preco_pedido', 'Preço pedido', { sufixo: 'R$', casas: 2, minimas: 2 })}
          ${this._texto('proprietario', 'Proprietário / vendedor')}
          ${this._texto('contato', 'Contato')}
          ${this._texto('zoneamento', 'Zoneamento', 'Ex: ZUR 2')}
          ${this._num('coeficiente_aproveitamento', 'Coeficiente de aproveitamento', { casas: 2 })}
          ${this._num('taxa_ocupacao_pct', 'Taxa de ocupação', { sufixo: '%', casas: 0 })}
          ${this._num('gabarito_pavimentos', 'Gabarito', { sufixo: 'pavimentos', casas: 0 })}
          ${this._select('topografia', 'Topografia', TOPOGRAFIAS)}
          ${this._select('infraestrutura', 'Infraestrutura', INFRAESTRUTURAS)}
          <div class="cheio">
            <urbi-textarea
              label="Restrições (ambientais, jurídicas, servidões)"
              rows="3"
              ?desabilitado=${!this.editavel}
              .valor=${String(this.form.restricoes ?? '')}
              @urbi:input-change=${(e: CustomEvent) => this._set('restricoes', e.detail.valor)}
            ></urbi-textarea>
          </div>
          <div class="cheio">
            <urbi-textarea
              label="Observações"
              rows="3"
              ?desabilitado=${!this.editavel}
              .valor=${String(this.form.observacoes ?? '')}
              @urbi:input-change=${(e: CustomEvent) => this._set('observacoes', e.detail.valor)}
            ></urbi-textarea>
          </div>
        </div>
        ${(this.erroLocal || this.erro) ? html`<urbi-banner variante="erro">${this.erroLocal || this.erro}</urbi-banner>` : nothing}
        <div class="acoes">
          <urbi-botao variante="fantasma" ?desabilitado=${this.salvando} @click=${this._fechar}>${this.editavel ? 'Cancelar' : 'Fechar'}</urbi-botao>
          ${this.editavel
            ? html`<urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar</urbi-botao>`
            : nothing}
        </div>
      </urbi-modal>`;
  }
}

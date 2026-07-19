import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';

// Aba "Fluxo de Caixa" — EXCLUSIVA do nível Avançado. Renderizada por
// tela-estudo somente quando estudo.nivel_analise === 'avancado'; ainda assim
// o próprio componente reforça o guard e não renderiza nada num Preliminar.
//
// Sub-navegação interna por urbi-badge (não urbi-abas — é navegação de segundo
// nível dentro da aba): Cronograma · Receitas · Custos · Ver Fluxo.

type SubTela = 'cronograma' | 'receitas' | 'custos' | 'ver_fluxo';

const SUBTELAS: { id: SubTela; label: string }[] = [
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'receitas', label: 'Receitas' },
  { id: 'custos', label: 'Custos' },
  { id: 'ver_fluxo', label: 'Ver Fluxo' },
];

@customElement('viab-tela-fluxo')
export class ViabTelaFluxo extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private subTela: SubTela = 'cronograma';

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .sub-nav { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
    .placeholder { padding: 8px 0; }
  `];

  render() {
    if (this.estudo?.nivel_analise !== 'avancado') return nothing;
    return html`
      <div class="sub-nav" role="group" aria-label="Seções do fluxo de caixa">
        ${SUBTELAS.map((s) => html`
          <urbi-badge cor="info" interativo ?ativo=${this.subTela === s.id}
            @click=${() => { this.subTela = s.id; }}
          >${s.label}</urbi-badge>`)}
      </div>
      ${this._renderSubTela()}
    `;
  }

  private _renderSubTela(): TemplateResult {
    switch (this.subTela) {
      case 'cronograma': return this._renderCronograma();
      case 'receitas': return this._renderReceitas();
      case 'custos': return this._renderCustos();
      case 'ver_fluxo': return this._renderVerFluxo();
    }
  }

  // Conteúdo das sub-telas é implementado nas fases seguintes do Avançado.
  private _renderCronograma(): TemplateResult {
    return html`
      <urbi-card titulo="Cronograma do empreendimento">
        <p class="sec placeholder">Defina a data de início, a taxa de desconto e as fases do projeto. (em construção)</p>
      </urbi-card>
    `;
  }

  private _renderReceitas(): TemplateResult {
    return html`
      <urbi-card titulo="Linhas de receita">
        <p class="sec placeholder">Tipologias, absorção de vendas e fluxo de pagamento. (em construção)</p>
      </urbi-card>
    `;
  }

  private _renderCustos(): TemplateResult {
    return html`
      <urbi-card titulo="Custos">
        <p class="sec placeholder">Custos do terreno, de obra e indiretos, distribuídos no tempo. (em construção)</p>
      </urbi-card>
    `;
  }

  private _renderVerFluxo(): TemplateResult {
    return html`
      <urbi-card titulo="Fluxo de caixa">
        <p class="sec placeholder">Tabela mensal com TIR, VPL, payback e exposição máxima. (em construção)</p>
      </urbi-card>
    `;
  }
}

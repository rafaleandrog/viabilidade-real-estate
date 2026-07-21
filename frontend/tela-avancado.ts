import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { urbiVerso } from './viabilidade-api.js';
import './tela-premissas.js';
import './tela-proforma.js';
import './tela-graficos.js';
import './tela-apelo.js';
import './tela-fluxo-cronograma.js';
import './tela-empreendimento-info.js';
import './tela-empreendimento-tipologias.js';
import './tela-fluxo-receitas.js';
import './tela-fluxo-custos.js';
import './tela-fluxo-ver.js';

// ─────────────────────────────────────────────────────────────────────────
// Tela do estudo AVANÇADO — reestruturação de abas (Lote 3 · #15).
//
// É a FUNDAÇÃO da árvore Avançado: as 7 abas de topo (nível 1). O conteúdo
// definitivo de cada sub-aba chega nos lotes seguintes (4–8). Aqui as telas
// EXISTENTES são preservadas no lugar — cada uma roteada para a aba nova
// correspondente — para o Avançado seguir 100% funcional durante a transição.
// Placeholders só nas sub-abas genuinamente novas (Informações, Tipologias),
// que o Lote 4 (#16) constrói.
//
// Padrão de navegação:
//  · Nível 1 (topo): urbi-abas, sincronizado com a URL (/detalhe/:id/:aba).
//  · Nível 2 (sub-aba): urbi-badge interativo — mesmo padrão que a antiga aba
//    Fluxo de Caixa já usava; estado interno, não vai para a URL.
//
// Mapa de topo → conteúdo (Lote que assume cada aba entre parênteses):
//   Resumo            → Proforma            (Lote 8 · #23 reconstrói)
//   Empreendimento    → Informações* · Cronograma · Tipologias*   (Lote 4 · #16)
//   Viabilidade       → Premissas · Receitas   (Lote 6 · #19–21)
//   Obra              → Custos                 (Lote 5 · #17–18)
//   Fluxo de Caixa    → Ver Fluxo
//   Cenários          → Gráficos
//   Análise de mercado→ Apelo Comercial
//   (* = placeholder até o Lote 4)
// ─────────────────────────────────────────────────────────────────────────

type AbaTopo = 'resumo' | 'empreendimento' | 'viabilidade' | 'obra' | 'fluxo' | 'cenarios' | 'mercado';

const ABAS_TOPO: { id: AbaTopo; label: string; icone: string }[] = [
  { id: 'resumo',         label: 'Resumo',             icone: 'fa-solid fa-gauge-high' },
  { id: 'empreendimento', label: 'Empreendimento',     icone: 'fa-solid fa-building' },
  { id: 'viabilidade',    label: 'Viabilidade',        icone: 'fa-solid fa-scale-balanced' },
  { id: 'obra',           label: 'Obra',               icone: 'fa-solid fa-helmet-safety' },
  { id: 'fluxo',          label: 'Fluxo de Caixa',     icone: 'fa-solid fa-money-bill-transfer' },
  { id: 'cenarios',       label: 'Cenários',           icone: 'fa-solid fa-chart-line' },
  { id: 'mercado',        label: 'Análise de mercado', icone: 'fa-solid fa-bullhorn' },
];
const IDS_TOPO = ABAS_TOPO.map((a) => a.id) as AbaTopo[];

// Sub-abas (nível 2) por aba de topo — só as abas com mais de uma sub-aba.
const SUBABAS: Partial<Record<AbaTopo, { id: string; label: string }[]>> = {
  empreendimento: [
    { id: 'informacoes', label: 'Informações' },
    { id: 'cronograma',  label: 'Cronograma' },
    { id: 'tipologias',  label: 'Tipologias' },
  ],
  viabilidade: [
    { id: 'premissas', label: 'Premissas' },
    { id: 'receitas',  label: 'Receitas' },
  ],
  // Custos em 5 sub-abas (Lote 5 · #17–18). Cada uma exibe o grupo
  // correspondente em viab-fluxo-custos (tabela + consolidado próprio).
  obra: [
    { id: 'terreno',    label: 'Terreno' },
    { id: 'obra',       label: 'Obra' },
    { id: 'diretos',    label: 'Diretos' },
    { id: 'indireto',   label: 'Indiretos' },
    { id: 'financeiro', label: 'Financeiro' },
  ],
};

@customElement('viab-tela-avancado')
export class ViabTelaAvancado extends LitElement {
  @property({ type: Object }) estudo: any = null;
  // Guardas de edição vêm de tela-estudo (permissão + status); computados aqui
  // para cada tela conforme o mesmo critério de antes da reestruturação.
  @property({ type: Boolean }) podeEditar = false;
  @property({ type: String }) status = '';

  // Aba de topo ativa — vem da URL via tela-estudo. Setter normaliza para uma
  // das 7 (URLs antigas do Preliminar, ex. 'premissas', caem em 'resumo').
  @property({ type: String })
  set aba(v: string) {
    const val = IDS_TOPO.includes(v as AbaTopo) ? (v as AbaTopo) : 'resumo';
    const antigo = this._aba;
    this._aba = val;
    this.requestUpdate('aba', antigo);
  }
  get aba(): AbaTopo { return this._aba; }
  private _aba: AbaTopo = 'resumo';

  // Sub-aba ativa por aba de topo (default: 1ª sub-aba de cada uma).
  @state() private subAtiva: Record<string, string> = {
    empreendimento: 'informacoes',
    viabilidade: 'premissas',
    obra: 'terreno',
  };

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .sub-nav { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
  `];

  private get _editavelPremissas(): boolean {
    return this.podeEditar && this.status !== 'aprovado' && this.status !== 'reprovado';
  }
  private get _editavelFluxo(): boolean {
    return this.podeEditar && this.status !== 'aprovado' && this.status !== 'reprovado' && this.status !== 'arquivado';
  }

  render(): TemplateResult {
    return html`
      <urbi-abas
        expandir
        .abas=${ABAS_TOPO}
        .ativa=${this.aba}
        @urbi:aba-selecionar=${(e: CustomEvent) => {
          const id = (e.detail?.id || 'resumo') as AbaTopo;
          this.dispatchEvent(new CustomEvent('viab:aba-topo', { detail: { id }, bubbles: true, composed: true }));
        }}
      >
        <urbi-hospedeiro slot="resumo">${this._renderResumo()}</urbi-hospedeiro>
        <urbi-hospedeiro slot="empreendimento">${this._renderComSubNav('empreendimento')}</urbi-hospedeiro>
        <urbi-hospedeiro slot="viabilidade">${this._renderComSubNav('viabilidade')}</urbi-hospedeiro>
        <urbi-hospedeiro slot="obra">${this._renderComSubNav('obra')}</urbi-hospedeiro>
        <urbi-hospedeiro slot="fluxo">${this._renderFluxo()}</urbi-hospedeiro>
        <urbi-hospedeiro slot="cenarios">${this._renderCenarios()}</urbi-hospedeiro>
        <urbi-hospedeiro slot="mercado">${this._renderMercado()}</urbi-hospedeiro>
      </urbi-abas>
    `;
  }

  // Barra de sub-navegação (nível 2) por urbi-badge interativo + conteúdo da
  // sub-aba selecionada.
  private _renderComSubNav(topo: AbaTopo): TemplateResult {
    const subs = SUBABAS[topo] || [];
    const ativa = this.subAtiva[topo] || subs[0]?.id;
    return html`
      <div class="sub-nav" role="group" aria-label="Seções de ${topo}">
        ${subs.map((s) => html`
          <urbi-badge cor="info" interativo ?ativo=${ativa === s.id}
            @click=${() => { this.subAtiva = { ...this.subAtiva, [topo]: s.id }; }}
          >${s.label}</urbi-badge>`)}
      </div>
      ${this._renderSubConteudo(topo, ativa)}
    `;
  }

  private _renderSubConteudo(topo: AbaTopo, sub?: string): TemplateResult {
    if (topo === 'empreendimento') {
      switch (sub) {
        case 'cronograma':
          return html`<viab-fluxo-cronograma .estudo=${this.estudo} .editavel=${this._editavelFluxo}></viab-fluxo-cronograma>`;
        case 'tipologias':
          return html`<viab-empreendimento-tipologias .estudo=${this.estudo} .editavel=${this._editavelFluxo}></viab-empreendimento-tipologias>`;
        case 'informacoes':
        default:
          return html`<viab-empreendimento-info .estudo=${this.estudo} .editavel=${this._editavelPremissas} .podeEditar=${this.podeEditar}></viab-empreendimento-info>`;
      }
    }
    if (topo === 'viabilidade') {
      switch (sub) {
        case 'receitas':
          return html`<viab-fluxo-receitas .estudo=${this.estudo} .editavel=${this._editavelFluxo}></viab-fluxo-receitas>`;
        case 'premissas':
        default:
          return html`<viab-tela-premissas .estudo=${this.estudo} .editavel=${this._editavelPremissas}></viab-tela-premissas>`;
      }
    }
    if (topo === 'obra') {
      // Uma instância do componente por grupo (sub-aba). Cada uma carrega seus
      // custos e mostra a tabela + consolidado do seu grupo.
      return html`<viab-fluxo-custos .estudo=${this.estudo} .editavel=${this._editavelFluxo} .grupo=${sub || 'terreno'}></viab-fluxo-custos>`;
    }
    return html`${nothing}`;
  }

  private _renderResumo(): TemplateResult {
    // A Proforma é o consolidado atual; o Lote 8 (#23) reconstrói o Resumo.
    return html`<viab-tela-proforma .estudo=${this.estudo}></viab-tela-proforma>`;
  }

  private _renderFluxo(): TemplateResult {
    return html`<viab-fluxo-ver .estudo=${this.estudo}></viab-fluxo-ver>`;
  }

  private _renderCenarios(): TemplateResult {
    return html`<viab-tela-graficos .estudo=${this.estudo}></viab-tela-graficos>`;
  }

  private _renderMercado(): TemplateResult {
    return html`<viab-tela-apelo .estudo=${this.estudo} .editavel=${this.podeEditar}></viab-tela-apelo>`;
  }
}

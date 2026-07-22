import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { urbiVerso } from './viabilidade-api.js';
import './tela-premissas.js';
import './tela-graficos.js';
import './tela-apelo.js';
import './tela-fluxo-cronograma.js';
import './tela-empreendimento-info.js';
import './tela-empreendimento-tipologias.js';
import './tela-fluxo-receitas.js';
import './tela-fluxo-custos.js';
import './tela-fluxo-ver.js';
import './tela-financeiro.js';
import './tela-resumo.js';

// ─────────────────────────────────────────────────────────────────────────
// Tela do estudo AVANÇADO — reestruturação de navegação (Etapa 3 · #39/#40).
//
// Nova arquitetura de navegação (item 7):
//  · Nível 1 (PÁGINAS): urbi-nav lateral (lista à esquerda), sincronizado com
//    a URL (/detalhe/:id/:aba). Emite viab:aba-topo → tela-estudo navega.
//  · Nível 2 (ABAS): urbi-abas no topo da página (nome + ícone por aba),
//    estado interno (não vai para a URL) — só nas páginas com mais de uma seção.
//
// O conteúdo de cada seção é o mesmo já roteado nos lotes 4–8; a Etapa 3 só
// troca o CHASSI de navegação (urbi-abas de topo → urbi-nav; urbi-badge de
// sub-nav → urbi-abas). O Preliminar não muda (árvore própria em tela-estudo).
//
// Mapa de páginas → conteúdo (#40: "Obra" renomeada para "Custos"):
//   Resumo            → Resumo consolidado
//   Empreendimento    → Informações · Cronograma · Tipologias
//   Viabilidade       → Premissas · Receitas · Financeiro
//   Custos            → Terreno · Obra · Diretos · Indiretos · Financeiro
//   Fluxo de Caixa    → Ver Fluxo
//   Cenários          → Gráficos
//   Análise de mercado→ Apelo Comercial
// ─────────────────────────────────────────────────────────────────────────

type AbaTopo = 'resumo' | 'empreendimento' | 'viabilidade' | 'obra' | 'fluxo' | 'cenarios' | 'mercado';

// Páginas (nível 1) — ordem da lista lateral (urbi-nav). O id 'obra' é
// preservado como slug de rota; só o rótulo virou "Custos" (#40).
const PAGINAS: { id: AbaTopo; label: string }[] = [
  { id: 'resumo',         label: 'Resumo' },
  { id: 'empreendimento', label: 'Empreendimento' },
  { id: 'viabilidade',    label: 'Viabilidade' },
  { id: 'obra',           label: 'Custos' },
  { id: 'fluxo',          label: 'Fluxo de Caixa' },
  { id: 'cenarios',       label: 'Cenários' },
  { id: 'mercado',        label: 'Análise de mercado' },
];
const IDS_TOPO = PAGINAS.map((a) => a.id) as AbaTopo[];

// Abas (nível 2) por página — só as páginas com mais de uma seção. Cada aba
// leva nome + ícone (urbi-abas suporta `icone` FontAwesome por aba).
type SubAba = { id: string; label: string; icone: string };
const SUBABAS: Partial<Record<AbaTopo, SubAba[]>> = {
  empreendimento: [
    { id: 'informacoes', label: 'Informações', icone: 'fa-solid fa-circle-info' },
    { id: 'cronograma',  label: 'Cronograma',  icone: 'fa-solid fa-calendar-days' },
    { id: 'tipologias',  label: 'Tipologias',  icone: 'fa-solid fa-table-list' },
  ],
  viabilidade: [
    { id: 'premissas',  label: 'Premissas',  icone: 'fa-solid fa-sliders' },
    { id: 'receitas',   label: 'Receitas',   icone: 'fa-solid fa-hand-holding-dollar' },
    { id: 'financeiro', label: 'Financeiro', icone: 'fa-solid fa-percent' },
  ],
  // Custos em 5 abas (#40 renomeou a página). Cada uma exibe o grupo
  // correspondente em viab-fluxo-custos (tabela + consolidado próprio).
  obra: [
    { id: 'terreno',    label: 'Terreno',    icone: 'fa-solid fa-mountain-sun' },
    { id: 'obra',       label: 'Obra',       icone: 'fa-solid fa-helmet-safety' },
    { id: 'diretos',    label: 'Diretos',    icone: 'fa-solid fa-truck-ramp-box' },
    { id: 'indireto',   label: 'Indiretos',  icone: 'fa-solid fa-briefcase' },
    { id: 'financeiro', label: 'Financeiro', icone: 'fa-solid fa-building-columns' },
  ],
};

@customElement('viab-tela-avancado')
export class ViabTelaAvancado extends LitElement {
  @property({ type: Object }) estudo: any = null;
  // Guardas de edição vêm de tela-estudo (permissão + status); computados aqui
  // para cada tela conforme o mesmo critério de antes da reestruturação.
  @property({ type: Boolean }) podeEditar = false;
  @property({ type: String }) status = '';

  // Página ativa — vem da URL via tela-estudo. Setter normaliza para uma das 7
  // (URLs antigas do Preliminar, ex. 'premissas', caem em 'resumo').
  @property({ type: String })
  set aba(v: string) {
    const val = IDS_TOPO.includes(v as AbaTopo) ? (v as AbaTopo) : 'resumo';
    const antigo = this._aba;
    this._aba = val;
    this.requestUpdate('aba', antigo);
  }
  get aba(): AbaTopo { return this._aba; }
  private _aba: AbaTopo = 'resumo';

  // Aba ativa por página (default: 1ª aba de cada uma).
  @state() private subAtiva: Record<string, string> = {
    empreendimento: 'informacoes',
    viabilidade: 'premissas',
    obra: 'terreno',
  };

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .layout {
      display: flex;
      gap: 20px;
      align-items: flex-start;
    }
    .nav-col {
      flex: 0 0 210px;
      max-width: 210px;
      border: 1px solid var(--cor-borda);
      border-radius: 8px;
      background: var(--cor-superficie-sutil, transparent);
      position: sticky;
      top: 0;
    }
    .conteudo {
      flex: 1 1 0%;
      min-width: 0;
    }
    /* Empilha em telas estreitas: a lista de páginas vira barra superior. */
    @media (max-width: 900px) {
      .layout { flex-direction: column; }
      .nav-col { flex: 0 0 auto; max-width: none; width: 100%; position: static; }
    }
  `];

  private get _editavelPremissas(): boolean {
    return this.podeEditar && this.status !== 'aprovado' && this.status !== 'reprovado';
  }
  private get _editavelFluxo(): boolean {
    return this.podeEditar && this.status !== 'aprovado' && this.status !== 'reprovado' && this.status !== 'arquivado';
  }

  render(): TemplateResult {
    return html`
      <div class="layout">
        <div class="nav-col">
          <urbi-nav
            .secoes=${[{ itens: PAGINAS }]}
            .ativo=${this.aba}
            @urbi:nav-selecionar=${(e: CustomEvent) => {
              const id = (e.detail?.id || 'resumo') as AbaTopo;
              this.dispatchEvent(new CustomEvent('viab:aba-topo', { detail: { id }, bubbles: true, composed: true }));
            }}
          ></urbi-nav>
        </div>
        <div class="conteudo">${this._renderPagina()}</div>
      </div>
    `;
  }

  private _renderPagina(): TemplateResult {
    switch (this.aba) {
      case 'empreendimento':
      case 'viabilidade':
      case 'obra':
        return this._renderComAbas(this.aba);
      case 'fluxo':
        return html`<viab-fluxo-ver .estudo=${this.estudo}></viab-fluxo-ver>`;
      case 'cenarios':
        return html`<viab-tela-graficos .estudo=${this.estudo}></viab-tela-graficos>`;
      case 'mercado':
        return html`<viab-tela-apelo .estudo=${this.estudo} .editavel=${this.podeEditar}></viab-tela-apelo>`;
      case 'resumo':
      default:
        // Resumo consolidado do Avançado: KPIs-chave + gráficos que leem os
        // resultados calculados pelas outras páginas. Frontend puro.
        return html`<viab-tela-resumo .estudo=${this.estudo}></viab-tela-resumo>`;
    }
  }

  // Página com abas de topo (urbi-abas): nome + ícone por aba; a aba ativa é
  // estado interno. Todas as seções são montadas (slots); urbi-abas exibe a ativa.
  private _renderComAbas(topo: AbaTopo): TemplateResult {
    const subs = SUBABAS[topo] || [];
    const ativa = this.subAtiva[topo] || subs[0]?.id;
    return html`
      <urbi-abas
        .abas=${subs.map((s) => ({ id: s.id, label: s.label, icone: s.icone }))}
        .ativa=${ativa}
        @urbi:aba-selecionar=${(e: CustomEvent) => {
          const id = e.detail?.id || subs[0]?.id;
          this.subAtiva = { ...this.subAtiva, [topo]: id };
        }}
      >
        ${subs.map((s) => html`
          <urbi-hospedeiro slot=${s.id}>${this._renderSubConteudo(topo, s.id)}</urbi-hospedeiro>`)}
      </urbi-abas>
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
        case 'financeiro':
          return html`<viab-tela-financeiro .estudo=${this.estudo} .editavel=${this._editavelPremissas}></viab-tela-financeiro>`;
        case 'premissas':
        default:
          return html`<viab-tela-premissas .estudo=${this.estudo} .editavel=${this._editavelPremissas}></viab-tela-premissas>`;
      }
    }
    if (topo === 'obra') {
      // Uma instância do componente por grupo (aba). Cada uma carrega seus
      // custos e mostra a tabela + consolidado do seu grupo.
      return html`<viab-fluxo-custos .estudo=${this.estudo} .editavel=${this._editavelFluxo} .grupo=${sub || 'terreno'}></viab-fluxo-custos>`;
    }
    return html`${nothing}`;
  }
}

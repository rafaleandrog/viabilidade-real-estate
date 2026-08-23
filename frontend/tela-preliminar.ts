import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import './tela-premissas.js';
import './tela-proforma.js';
import './tela-graficos.js';
import './tela-apelo.js';

// ─────────────────────────────────────────────────────────────────────────
// Tela do estudo PRELIMINAR — reestruturação de navegação (2026-08-03), a
// pedido do autor: mesmo chassi de 2 níveis já usado no Avançado
// (tela-avancado.ts) — nível 1 (páginas) em `urbi-nav` lateral, nível 2
// (sub-abas) em `urbi-abas` no topo da página, só nas páginas com mais de
// uma seção. Extraído de tela-estudo.ts, que antes montava um único
// `urbi-abas` de nível único inline.
//
// Diferença deliberada do padrão do Avançado: lá, cada sub-aba de uma página
// com abas (ex. Custos: Terreno/Obra/Diretos/Indireto/Financeiro) instancia
// um componente PRÓPRIO por sub-aba, todos montados ao mesmo tempo (custo
// aceito, documentado em PROGRESSO.md) — funciona porque cada instância lê
// uma fatia DISJUNTA do dado (`.grupo` filtra linhas de custo diferentes).
// Aqui não: "Terreno & Áreas"/"Produtos & Custos"/"Permutas" são recortes
// visuais do MESMO formulário (`viab-tela-premissas`, um só `form`/`_dirty`/
// Salvar) — instanciar 3 cópias faria 3 fetches redundantes e 3 cópias de
// `form` fora de sincronia entre si. Por isso aqui existe só UMA instância
// por página; o `slot` dela é reatribuído dinamicamente conforme a sub-aba
// ativa (o componente ganha uma prop `secao`/`secao` — ver tela-premissas.ts/
// tela-proforma.ts — que gate qual parte do seu próprio render() mostrar).
// ─────────────────────────────────────────────────────────────────────────

type AbaTopo = 'premissas' | 'proforma' | 'graficos' | 'apelo';

// Páginas (nível 1). Id 'proforma' preservado como slug de rota — só o
// rótulo virou "Resultado", mesmo padrão do #250 (Custos/'obra') no Avançado.
const PAGINAS: { id: AbaTopo; label: string }[] = [
  { id: 'premissas', label: 'Premissas' },
  { id: 'proforma',  label: 'Resultado' },
  { id: 'graficos',  label: 'Gráficos' },
  { id: 'apelo',     label: 'Análise de Mercado' },
];
const IDS_TOPO = PAGINAS.map((a) => a.id) as AbaTopo[];

// Sub-abas (nível 2) — só Premissas e Resultado têm mais de uma seção.
type SubAba = { id: string; label: string; icone: string };
const SUBABAS: Partial<Record<AbaTopo, SubAba[]>> = {
  // #309: "Produtos & Custos" virou duas abas — Custos (à direita de Terreno &
  // Áreas) e Produtos por último, depois de Permutas (#483, decisão D14: a
  // cláusula "Produtos é a última da lista" é literal — última de todas).
  premissas: [
    { id: 'terreno',  label: 'Terreno & Áreas', icone: 'fa-solid fa-mountain-sun' },
    { id: 'custos',   label: 'Custos',          icone: 'fa-solid fa-sack-dollar' },
    { id: 'permutas', label: 'Permutas',        icone: 'fa-solid fa-right-left' },
    { id: 'produtos', label: 'Produtos',        icone: 'fa-solid fa-boxes-stacked' },
  ],
  proforma: [
    { id: 'proforma', label: 'Proforma', icone: 'fa-solid fa-table-cells' },
    { id: 'cenarios', label: 'Cenários', icone: 'fa-solid fa-chart-line' },
  ],
};

@customElement('viab-tela-preliminar')
export class ViabTelaPreliminar extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) podeEditar = false;
  @property({ type: String }) status = '';

  // Página ativa — vem da URL via tela-estudo. Setter normaliza para uma das
  // 4 (URLs desconhecidas caem em 'premissas').
  @property({ type: String })
  set aba(v: string) {
    const val = IDS_TOPO.includes(v as AbaTopo) ? (v as AbaTopo) : 'premissas';
    const antigo = this._aba;
    this._aba = val;
    this.requestUpdate('aba', antigo);
  }
  get aba(): AbaTopo { return this._aba; }
  private _aba: AbaTopo = 'premissas';

  // Sub-aba (2º nível) vinda da URL — mesmo padrão do #251 no Avançado.
  @property({ type: String }) subAba = '';

  @state() private subAtiva: Record<string, string> = { premissas: 'terreno', proforma: 'proforma' };

  updated(changed: Map<string, unknown>) {
    if ((changed.has('aba') || changed.has('subAba')) && this.subAba) {
      const subs = SUBABAS[this._aba];
      if (subs?.some((s) => s.id === this.subAba) && this.subAtiva[this._aba] !== this.subAba) {
        this.subAtiva = { ...this.subAtiva, [this._aba]: this.subAba };
      }
    }
  }

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .layout { display: flex; gap: 20px; align-items: flex-start; }
    .nav-col {
      flex: 0 0 210px; max-width: 210px;
      border: 1px solid var(--cor-borda); border-radius: 8px;
      background: var(--cor-superficie-sutil, transparent);
      position: sticky; top: 0;
    }
    .conteudo { flex: 1 1 0%; min-width: 0; }
    @media (max-width: 900px) {
      .layout { flex-direction: column; }
      .nav-col { flex: 0 0 auto; max-width: none; width: 100%; position: static; }
    }
  `];

  private get _editavelPremissas(): boolean {
    return this.podeEditar && this.status !== 'aprovado' && this.status !== 'reprovado';
  }

  render(): TemplateResult {
    return html`
      <div class="layout">
        <div class="nav-col">
          <urbi-nav
            .secoes=${[{ itens: PAGINAS }]}
            .ativo=${this.aba}
            @urbi:nav-selecionar=${(e: CustomEvent) => {
              const id = e.detail?.id || 'premissas';
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
      case 'premissas':
      case 'proforma':
        return this._renderComAbas(this.aba);
      case 'graficos':
        return html`<viab-tela-graficos .estudo=${this.estudo}></viab-tela-graficos>`;
      case 'apelo':
        // BUG7-13: só o rótulo do Preliminar virou "Análise de Mercado" (D2) — o
        // Avançado já tem uma aba homônima (mercado_regioes) e ficaria ambíguo.
        // Slug 'apelo', elemento, evento e tabelas apelo_comercial* ficam intactos.
        return html`<viab-tela-apelo .estudo=${this.estudo} .editavel=${this.podeEditar} titulo="Análise de Mercado do Imóvel (IA)"></viab-tela-apelo>`;
      default:
        return html`${nothing}`;
    }
  }

  // Página com sub-abas — uma ÚNICA instância do componente da página, com
  // `slot` reatribuído dinamicamente à sub-aba ativa (ver comentário no
  // topo do arquivo). `urbi-abas` mostra as demais sub-abas vazias até serem
  // selecionadas (sem custo, já que não há conteúdo montado para elas).
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
          this.dispatchEvent(new CustomEvent('viab:subaba-topo', {
            detail: { aba: topo, sub: id }, bubbles: true, composed: true,
          }));
        }}
      >
        <urbi-hospedeiro slot=${ativa}>${this._renderSubConteudo(topo, ativa)}</urbi-hospedeiro>
      </urbi-abas>
    `;
  }

  private _renderSubConteudo(topo: AbaTopo, sub: string): TemplateResult {
    if (topo === 'premissas') {
      return html`<viab-tela-premissas .estudo=${this.estudo} .editavel=${this._editavelPremissas} .secao=${sub}></viab-tela-premissas>`;
    }
    if (topo === 'proforma') {
      return html`<viab-tela-proforma .estudo=${this.estudo} .secao=${sub}></viab-tela-proforma>`;
    }
    return html`${nothing}`;
  }
}

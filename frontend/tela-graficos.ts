import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { listarBenchmarks, buscarConfig } from './viabilidade-api.js';

const n = (v: any): number => Number(v) || 0;

// Paleta categórica para segmentar os custos por cor (12 tons distintos —
// mais que os 6 da paleta padrão do gráfico, para não repetir cor entre custos).
const PALETA_CUSTOS = [
  '#2AA9E0', '#13A98D', '#F7A111', '#D45A3A', '#8E7CC3', '#5BAF7A',
  '#E0699B', '#7FB3D5', '#C0A16B', '#59C3C3', '#B57EDC', '#9AA5B1',
];

@customElement('viab-tela-graficos')
export class ViabTelaGraficos extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @state() private excluirTerreno = false;
  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  private _idCarregado: number | null = null;

  static styles = [estiloConteudo, css`
    .graficos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .graficos + .graficos { margin-top: 16px; }
    .medidores { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .resultado { margin-top: 12px; }
  `];

  connectedCallback() { super.connectedCallback(); this._init(); }
  updated(ch: Map<string, unknown>) {
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  private async _init() {
    if (!this.estudo) return;
    this._idCarregado = this.estudo.id ?? null;
    try {
      const [bm, cfg] = await Promise.all([listarBenchmarks(this.estudo.tipo_empreendimento), buscarConfig()]);
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
    } catch (e) { console.error(e); }
  }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma({ ...this.estudo, aliquota_ret_pct: this.aliquotaRet } as ProformaInput);
    return html`
      <div class="graficos">
        <urbi-card titulo="Composição dos custos">
          <urbi-checkbox
            label="Excluir custo de aquisição do terreno"
            ?marcado=${this.excluirTerreno}
            @urbi:checkbox-change=${(e: CustomEvent) => this.excluirTerreno = e.detail.marcado}
          ></urbi-checkbox>
          ${this._renderPizza(p)}
        </urbi-card>
        <urbi-card titulo="Receita × Custos">
          ${this._renderBarras(p)}
        </urbi-card>
      </div>
      ${this._renderAlocacaoAreas(p, lot)}
      ${this._renderMedidores(p)}
    `;
  }

  private _custos(p: Proforma, excluirTerreno = this.excluirTerreno) {
    const itens = [
      { l: 'Terreno', v: p.custoTerreno, terreno: true },
      { l: 'Infraestrutura', v: p.infraestrutura },
      { l: 'Construção', v: p.construcao },
      { l: 'Decoração', v: p.decoracao },
      { l: 'Gestão da construção', v: p.gestaoConstrucao },
      { l: 'Projetos', v: p.projetos },
      { l: 'Outorga', v: p.outorga },
      { l: 'Incorporação e registro', v: p.incorporacaoRegistro },
      { l: 'Manutenção', v: p.manutencao },
      { l: 'Contingências', v: p.contingencias },
      { l: 'Marketing global', v: p.marketingGlobal },
      { l: 'Gestão e indiretos', v: p.gestaoIndiretos },
    ];
    return itens.filter((i) => i.v > 0.005 && !(i.terreno && excluirTerreno));
  }

  private _renderPizza(p: Proforma): TemplateResult {
    const custos = this._custos(p);
    const total = custos.reduce((s, c) => s + c.v, 0);
    if (total <= 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-pie" mensagem="Sem custos para exibir."></urbi-estado-vazio>`;
    }
    return html`
      <urbi-grafico-pizza
        formato="moeda"
        .categorias=${custos.map((c) => c.l)}
        .series=${[{ rotulo: 'Custos', valores: custos.map((c) => c.v) }]}
      ></urbi-grafico-pizza>
    `;
  }

  private _renderBarras(p: Proforma): TemplateResult {
    // Coluna "Custos" empilhada e segmentada por cor (um segmento por custo),
    // ao lado da coluna "Receita". Cada custo é uma série própria com valor só
    // na categoria "Custos" (0 em "Receita", que o empilhado ignora). A legenda
    // do gráfico mapeia cor → custo.
    const itens = this._custos(p, false); // bars: sempre com todos os custos
    const series = [
      { rotulo: 'Receita (VGV)', valores: [p.vgv, 0], cor: 'var(--cor-sucesso, #13A98D)' },
      ...itens.map((c, i) => ({ rotulo: c.l, valores: [0, c.v], cor: PALETA_CUSTOS[i % PALETA_CUSTOS.length] })),
    ];
    const custosTotal = itens.reduce((s, c) => s + c.v, 0);
    const resultado = p.vgv - custosTotal;
    return html`
      <urbi-grafico-colunas
        empilhado
        legenda="sempre"
        formato="moeda"
        .categorias=${['Receita', 'Custos']}
        .series=${series}
      ></urbi-grafico-colunas>
      <div class="resultado">
        <urbi-kpi rotulo="Resultado" .valor=${fmtR$(resultado)} variante=${resultado >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      </div>
    `;
  }

  // #14: pizza(s) de alocação de áreas. Loteamento: composição da gleba. Incorporação:
  // dois subgrupos — "geral" (áreas detalhadas) e "macro" (privativa R + privativa NR +
  // áreas comuns = 100%).
  private _renderAlocacaoAreas(p: Proforma, lot: boolean): TemplateResult {
    const e = this.estudo;
    if (lot) {
      const g = p.areaTerreno;
      const ded = (k: string) => n(e[k]) / 100 * g;
      const itens = [
        { l: 'APP', v: ded('app_pct') },
        { l: 'Faixas não edificáveis', v: ded('faixas_nao_edificaveis_pct') },
        { l: 'Sistema viário', v: ded('sistema_viario_pct') },
        { l: 'ELUP', v: ded('elup_pct') },
        { l: 'EPC', v: ded('epc_pct') },
        { l: 'EPU', v: ded('epu_pct') },
        { l: 'Priv. não vendáveis', v: ded('areas_privativas_nao_vendaveis_pct') },
        { l: 'Área vendável (lotes)', v: p.areaVendavel },
      ];
      return html`<div class="graficos">
        <urbi-card titulo="Alocação de áreas da gleba">${this._pizzaAreas(itens)}</urbi-card>
      </div>`;
    }
    const rF = n(e.area_pvt_r_fechada), rA = n(e.area_pvt_r_aberta);
    const nrF = n(e.area_pvt_nr_fechada), nrA = n(e.area_pvt_nr_aberta);
    const comum = n(e.area_comum_total);
    const geral = [
      { l: 'Priv. residencial fechada', v: rF },
      { l: 'Priv. residencial aberta', v: rA },
      { l: 'Priv. não residencial fechada', v: nrF },
      { l: 'Priv. não residencial aberta', v: nrA },
      { l: 'Áreas comuns', v: comum },
    ];
    const macro = [
      { l: 'Privativa residencial', v: rF + rA },
      { l: 'Privativa não residencial', v: nrF + nrA },
      { l: 'Áreas comuns', v: comum },
    ];
    return html`<div class="graficos">
      <urbi-card titulo="Alocação de áreas — geral">${this._pizzaAreas(geral)}</urbi-card>
      <urbi-card titulo="Alocação de áreas — macro">${this._pizzaAreas(macro)}</urbi-card>
    </div>`;
  }

  private _pizzaAreas(itens: { l: string; v: number }[]): TemplateResult {
    const validos = itens.filter((i) => i.v > 0.005);
    if (validos.length === 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-pie" mensagem="Defina as áreas nas Premissas."></urbi-estado-vazio>`;
    }
    return html`
      <urbi-grafico-pizza
        formato="numero"
        .categorias=${validos.map((i) => i.l)}
        .series=${[{ rotulo: 'Áreas (m²)', valores: validos.map((i) => i.v) }]}
      ></urbi-grafico-pizza>
    `;
  }

  // #15: medidores de indicadores a partir dos benchmarks do estudo. As faixas de
  // status usam a `regra_comparacao`: `atingir_ou_superar` (maior é melhor) → verde
  // acima da meta; `nao_exceder` (menor é melhor, ex.: Custo obra/VGV) → verde ABAIXO
  // da meta (inversão pedida no item 15).
  private _renderMedidores(p: Proforma): TemplateResult {
    const MAPA: Record<string, number> = {
      resultado_final: p.margemLiquidaPct,
      margem_liquida: p.margemLiquidaPct,
      margem_bruta: p.margemBrutaPct,
      roi: p.roiPct,
      custo_obras_vgv: p.custoObrasVgvPct,
      eficiencia_aproveitamento: p.eficienciaPct,
    };
    const ROTULOS: Record<string, string> = {
      resultado_final: 'Resultado final',
      margem_liquida: 'Margem líquida',
      margem_bruta: 'Margem bruta',
      roi: 'ROI',
      custo_obras_vgv: 'Custo obra / VGV',
      eficiencia_aproveitamento: 'Eficiência de aproveitamento',
    };
    const medidores = this.benchmarks
      .map((b) => {
        const val = MAPA[b.campo];
        const meta = Number(b.valor) || 0;
        if (val === undefined || meta <= 0) return null;
        const max = Math.max(meta * 2, val * 1.2, meta + 10);
        const naoExceder = b.regra_comparacao === 'nao_exceder';
        // Faixa boa (verde) do lado bom da meta; ruim (vermelho) do outro.
        const faixas = naoExceder
          ? [{ ate: meta, cor: 'var(--cor-sucesso)' }, { ate: max, cor: 'var(--cor-erro)' }]
          : [{ ate: meta, cor: 'var(--cor-erro)' }, { ate: max, cor: 'var(--cor-sucesso)' }];
        return html`<urbi-grafico-medidor
          rotulo=${ROTULOS[b.campo] ?? b.campo}
          .min=${0} .max=${max} .valor=${val}
          .faixas=${faixas}
          formato="porcentagem"
        ></urbi-grafico-medidor>`;
      })
      .filter((m) => m !== null);
    if (medidores.length === 0) return html``;
    return html`
      <urbi-card titulo="Indicadores vs. benchmark">
        <div class="medidores">${medidores}</div>
      </urbi-card>
    `;
  }
}

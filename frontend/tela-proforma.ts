import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import { urbiVerso, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { exportarPDF, exportarExcel } from './exportar.js';

interface Linha { l: string; v: number; cls?: 'sub' | 'res'; soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean; isPct?: boolean; }

type VarSens = 'preco' | 'permuta_fisica' | 'permuta_financeira' | 'custo_infra' | 'custo_obras';

@customElement('viab-tela-proforma')
export class ViabTelaProforma extends LitElement {
  @property({ attribute: false }) estudo: any = null;

  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  @state() private varSens: VarSens = 'preco';

  static styles = [estiloConteudo, css`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpis urbi-kpi { min-width: 0; }
    .barra-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; justify-content: flex-end; }
    .sens-var { max-width: 320px; margin-bottom: 12px; }
    urbi-card + urbi-card { margin-top: 16px; }
    strong.total { color: var(--cor-texto-forte, rgba(255,255,255,0.95)); }
  `];

  private _idCarregado: number | null = null;

  connectedCallback() { super.connectedCallback(); this._init(); }
  updated(ch: Map<string, unknown>) {
    // Recarrega benchmarks só quando muda o estudo; edições ao vivo de Premissas
    // (#6) só atualizam os números, não os benchmarks.
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

  private _entrada(over: Partial<ProformaInput> = {}): ProformaInput {
    return { ...this.estudo, aliquota_ret_pct: this.aliquotaRet, ...over } as ProformaInput;
  }
  private _bm(campo: string) { return this.benchmarks.find((b) => b.campo === campo); }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    return html`
      ${this._renderKpis(p)}
      <urbi-card titulo="Proforma">
        ${this._renderTabela(p, lot)}
        <div class="barra-acoes">
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-excel" @click=${() => this._exportar('excel')}>Exportar Excel</urbi-botao>
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-pdf" @click=${() => this._exportar('pdf')}>Exportar PDF</urbi-botao>
        </div>
      </urbi-card>
      ${this._renderSensibilidade(lot)}
    `;
  }

  private _renderKpis(p: Proforma): TemplateResult {
    const co = this._bm('custo_obras_vgv');
    const ml = this._bm('margem_liquida');
    const temPermuta = p.areaPermutaFisica > 0 || p.permutaFinResidencial > 0 || p.permutaFinNaoResidencial > 0;
    const kpis: { rot: string; val: string; variante: string }[] = [
      { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²`, variante: '' },
      { rot: 'Preço médio/unid.', val: fmtR$(p.precoMedioUnidade), variante: '' },
      { rot: 'Nº de unidades', val: fmtNum(p.numUnidades), variante: '' },
    ];
    if (temPermuta) kpis.push({ rot: 'Área permutada', val: `${fmtNum(p.areaPermutaFisica)} m²`, variante: '' });
    kpis.push({ rot: 'Custo obras / VGV', val: fmtPct(p.custoObrasVgvPct), variante: co ? (p.custoObrasVgvPct <= Number(co.valor) ? 'sucesso' : 'erro') : '' });
    kpis.push({ rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), variante: ml ? (p.margemLiquidaPct >= Number(ml.valor) ? 'sucesso' : 'erro') : '' });
    return html`<div class="kpis">
      ${kpis.map((k) => html`<urbi-kpi rotulo=${k.rot} .valor=${k.val} variante=${k.variante}></urbi-kpi>`)}
    </div>`;
  }

  private _linhas(p: Proforma): Linha[] {
    return [
      { l: 'Receita bruta (VGV)', v: p.vgv, cls: 'sub' },
      { l: '(-) Imposto', v: p.imposto },
      { l: '(-) Corretagem', v: p.corretagem },
      { l: '(-) Marketing', v: p.marketing },
      { l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, ocultarSeZero: true },
      { l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, ocultarSeZero: true },
      { l: '= Receita líquida', v: p.receitaLiquida, cls: 'sub' },
      { l: '(-) Terreno', v: p.custoTerreno },
      { l: '(-) Projetos e aprovação', v: p.projetos },
      { l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true },
      { l: '(-) Outorga', v: p.outorga, soInc: true },
      { l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true },
      { l: '(-) Construção', v: p.construcao, soInc: true },
      { l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true },
      { l: '(-) Decoração', v: p.decoracao, soInc: true },
      { l: '(-) Manutenção pós-obra', v: p.manutencao },
      { l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true },
      { l: '= Custo direto total', v: p.custoDiretoTotal, cls: 'sub' },
      { l: '(-) Marketing global e estrutura', v: p.marketingGlobal },
      { l: '(-) Gestão e outros indiretos', v: p.gestaoIndiretos },
      { l: '= Custo indireto total', v: p.custoIndiretoTotal, cls: 'sub' },
      { l: '= Resultado', v: p.resultado, cls: 'res' },
      { l: 'Resultado + permutas financeiras', v: p.resultadoComPermutasFin, ocultarSeZero: true },
      { l: 'Resultado + permutas (com físicas)', v: p.resultadoComPermutasFisicas, ocultarSeZero: true },
      { l: 'Margem líquida', v: p.margemLiquidaPct, cls: 'res', isPct: true },
    ];
  }

  private _renderTabela(p: Proforma, lot: boolean): TemplateResult {
    const linhas = this._linhas(p).filter((r) =>
      !(r.soLot && !lot) && !(r.soInc && lot) && !(r.ocultarSeZero && Math.abs(r.v) < 0.005));
    const colunas = [
      {
        id: 'linha', label: 'Linha',
        render: (r: any) => r.cls ? html`<strong class="total">${r.l}</strong>` : html`${r.l}`,
      },
      {
        id: 'rs', label: 'R$', alinhamento: 'direita',
        render: (r: any) => {
          if (r.isPct) return html`<urbi-badge cor=${r.v < 0 ? 'perigo' : 'sucesso'}>${fmtPct(r.v)}</urbi-badge>`;
          const texto = fmtR$(r.v);
          if (r.cls === 'res') return html`<urbi-badge cor=${r.v < 0 ? 'perigo' : 'sucesso'}>${texto}</urbi-badge>`;
          if (r.cls === 'sub') return html`<strong class="total">${texto}</strong>`;
          return html`${texto}`;
        },
      },
      {
        id: 'pct', label: '% VGV', alinhamento: 'direita',
        valor: (r: any) => (r.isPct ? '' : p.vgv > 0 ? fmtPct(Math.abs(r.v) / p.vgv * 100) : '—'),
      },
    ];
    return html`<urbi-tabela .colunas=${colunas} .linhas=${linhas}></urbi-tabela>`;
  }

  private _variaveis(lot: boolean): { valor: VarSens; rotulo: string }[] {
    return [
      { valor: 'preco', rotulo: lot ? 'Preço/m² de venda' : 'Preço/m² (res + não res)' },
      { valor: 'permuta_fisica', rotulo: 'Permuta física' },
      { valor: 'permuta_financeira', rotulo: 'Permuta financeira' },
      lot ? { valor: 'custo_infra' as VarSens, rotulo: 'Custo de infraestrutura' } : { valor: 'custo_obras' as VarSens, rotulo: 'Custo de obras' },
    ];
  }

  private _aplicarFator(fator: number): ProformaInput {
    const e = this.estudo;
    const mul = (x: any) => (Number(x) || 0) * fator;
    switch (this.varSens) {
      case 'preco': return this._entrada({ preco_venda_m2: mul(e.preco_venda_m2), preco_venda_m2_residencial: mul(e.preco_venda_m2_residencial), preco_venda_m2_nao_residencial: mul(e.preco_venda_m2_nao_residencial) });
      case 'permuta_fisica': return this._entrada({ permuta_fisica_area_m2: mul(e.permuta_fisica_area_m2), permuta_fisica_pct: mul(e.permuta_fisica_pct) });
      case 'permuta_financeira': return this._entrada({ permuta_financeira_residencial_pct: mul(e.permuta_financeira_residencial_pct), permuta_financeira_nao_residencial_pct: mul(e.permuta_financeira_nao_residencial_pct) });
      case 'custo_infra': return this._entrada({ custo_infra_m2: mul(e.custo_infra_m2), infra_pct: mul(e.infra_pct) });
      case 'custo_obras': return this._entrada({ custo_construcao_m2: mul(e.custo_construcao_m2) });
    }
  }

  private _renderSensibilidade(lot: boolean): TemplateResult {
    const varPos = Number(this.estudo.sensibilidade_variacao_positiva_pct) || 10;
    const varNeg = Number(this.estudo.sensibilidade_variacao_negativa_pct) || 10;
    // Bull = cenário otimista (melhor resultado); Bear = pessimista. Para o
    // PREÇO, otimista é preço maior. Para variáveis de CUSTO/permuta (que pioram
    // o resultado quando sobem), o Bull é uma REDUÇÃO — a conta é invertida
    // em relação ao preço (bug #13).
    const custoLike = this.varSens !== 'preco';
    const fatorBull = custoLike ? 1 - varPos / 100 : 1 + varPos / 100;
    const fatorBear = custoLike ? 1 + varNeg / 100 : 1 - varNeg / 100;
    const bear = calcularProforma(this._aplicarFator(fatorBear));
    const base = calcularProforma(this._aplicarFator(1));
    const bull = calcularProforma(this._aplicarFator(fatorBull));
    const linhas: { l: string; f: (p: Proforma) => number; pct?: boolean }[] = [
      { l: 'VGV', f: (p) => p.vgv },
      { l: 'Receita líquida', f: (p) => p.receitaLiquida },
      { l: 'Custo direto total', f: (p) => p.custoDiretoTotal },
      { l: 'Resultado', f: (p) => p.resultado },
      { l: 'Margem líquida', f: (p) => p.margemLiquidaPct, pct: true },
    ];
    const fmt = (m: any, v: number) => (m.pct ? fmtPct(v) : fmtR$(v));
    // Cores por cenário (contrato de UI — tokens do design system): Bear=vermelho,
    // Base=verde, Bull=azul. Aplicadas no cabeçalho e nos valores da coluna.
    const CORES = {
      bear: 'var(--cor-erro, #D45A3A)',
      base: 'var(--cor-sucesso, #13A98D)',
      bull: 'var(--cor-primaria-solida, #2AA9E0)',
    } as const;
    const colCenario = (id: 'bear' | 'base' | 'bull', rot: string, cen: Proforma) => ({
      id, alinhamento: 'direita',
      label: html`<span style="color:${CORES[id]}">${rot}</span>`,
      render: (m: any) => html`<span style="color:${CORES[id]};font-variant-numeric:tabular-nums">${fmt(m, m.f(cen))}</span>`,
    });
    const colunas = [
      { id: 'linha', label: 'Linha', valor: (m: any) => m.l },
      colCenario('bear', 'Bear', bear),
      colCenario('base', 'Base', base),
      colCenario('bull', 'Bull', bull),
    ];
    return html`<urbi-card titulo="Análise de sensibilidade">
      <div class="sens-var">
        <urbi-select
          label="Variável estressada (−${varNeg}% / +${varPos}%)"
          .valor=${this.varSens}
          .opcoes=${this._variaveis(lot)}
          @urbi:select-change=${(e: CustomEvent) => this.varSens = e.detail.valor as VarSens}
        ></urbi-select>
      </div>
      <urbi-tabela .colunas=${colunas} .linhas=${linhas}></urbi-tabela>
    </urbi-card>`;
  }

  private _exportar(formato: string) {
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    if (formato === 'excel') exportarExcel(this.estudo, p, lot);
    else if (!exportarPDF(this.estudo, p, lot)) urbiVerso.notificar('Permita pop-ups para exportar em PDF.', 'alerta');
  }
}

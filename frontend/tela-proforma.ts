import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estilosBase } from './viab-shared.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import { urbiVerso, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { exportarPDF, exportarExcel } from './exportar.js';

interface Linha { l: string; v: number; cls?: string; soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean; }

type VarSens = 'preco' | 'permuta_fisica' | 'permuta_financeira' | 'custo_infra' | 'custo_obras';

@customElement('viab-tela-proforma')
export class ViabTelaProforma extends LitElement {
  @property({ attribute: false }) estudo: any = null;

  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  @state() private cenarios: { nome: string; p: Proforma }[] = [];
  @state() private mostrarSens = false;
  @state() private varSens: VarSens = 'preco';

  static styles = [estilosBase, css`
    :host { display: block; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi { background: var(--cor-fundo, #0D1B2A); border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; }
    .kpi .rot { font-size: 0.7rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; }
    .kpi .val { font-size: 1.1rem; font-weight: 700; margin-top: 4px; }
    .kpi.ok .val { color: var(--cor-sucesso, #13A98D); }
    .kpi.ruim .val { color: var(--cor-erro, #D45A3A); }
    table.pf { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    table.pf td { padding: 6px 10px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.06)); }
    table.pf td.v { text-align: right; font-variant-numeric: tabular-nums; }
    tr.sub td { font-weight: 700; border-top: 1px solid var(--cor-borda, rgba(255,255,255,0.15)); }
    tr.res td { font-weight: 700; color: var(--cor-primaria-solida, #2AA9E0); border-top: 2px solid var(--cor-primaria-solida, #2AA9E0); }
    tr.res.neg td { color: var(--cor-erro, #D45A3A); border-top-color: var(--cor-erro, #D45A3A); }
    .barra-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0; }
    .comp td.delta.pos { color: var(--cor-sucesso, #13A98D); }
    .comp td.delta.neg { color: var(--cor-erro, #D45A3A); }
    .disabled-note { opacity: 0.6; font-size: 0.8rem; }
  `];

  connectedCallback() { super.connectedCallback(); this._init(); }
  updated(ch: Map<string, unknown>) { if (ch.has('estudo')) this._init(); }

  private async _init() {
    if (!this.estudo) return;
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
      ${this._renderKpis(p, lot)}
      <div class="card">
        <h3 style="margin-top:0">Proforma</h3>
        ${this._renderTabela(p, lot)}
        <div class="barra-acoes">
          <button class="btn-sec btn-sm" @click=${() => this._salvarCenario(p)}>Salvar cenário</button>
          ${this.cenarios.length > 0 ? html`<button class="btn-sec btn-sm" @click=${() => this.cenarios = []}>Limpar cenários</button>` : nothing}
          <button class="btn-sec btn-sm" @click=${() => this.mostrarSens = !this.mostrarSens}>${this.mostrarSens ? 'Ocultar' : 'Mostrar'} sensibilidade</button>
          <button class="btn-sec btn-sm" @click=${() => this._exportar('excel')}>Exportar Excel</button>
          <button class="btn-sec btn-sm" @click=${() => this._exportar('pdf')}>Exportar PDF</button>
        </div>
      </div>
      ${this.cenarios.length > 0 ? this._renderComparacao() : nothing}
      ${this.mostrarSens ? this._renderSensibilidade(lot) : nothing}
    `;
  }

  private _renderKpis(p: Proforma, lot: boolean) {
    const co = this._bm('custo_obras_vgv');
    const ml = this._bm('margem_liquida');
    const temPermuta = p.areaPermutaFisica > 0 || p.permutaFinResidencial > 0 || p.permutaFinNaoResidencial > 0;
    const kpis: { rot: string; val: string; ok?: boolean }[] = [
      { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²` },
      { rot: 'Preço médio/unid.', val: fmtR$(p.precoMedioUnidade) },
      { rot: 'Nº de unidades', val: fmtNum(p.numUnidades) },
    ];
    if (temPermuta) kpis.push({ rot: 'Área permutada', val: `${fmtNum(p.areaPermutaFisica)} m²` });
    kpis.push({ rot: 'Custo obras / VGV', val: fmtPct(p.custoObrasVgvPct), ok: co ? p.custoObrasVgvPct <= Number(co.valor) : undefined });
    kpis.push({ rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), ok: ml ? p.margemLiquidaPct >= Number(ml.valor) : undefined });
    return html`<div class="kpis">
      ${kpis.map((k) => html`<div class="kpi ${k.ok === undefined ? '' : k.ok ? 'ok' : 'ruim'}">
        <div class="rot">${k.rot}</div><div class="val">${k.val}</div></div>`)}
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
    ];
  }

  private _renderTabela(p: Proforma, lot: boolean) {
    const linhas = this._linhas(p).filter((r) =>
      !(r.soLot && !lot) && !(r.soInc && lot) && !(r.ocultarSeZero && Math.abs(r.v) < 0.005));
    return html`
      <div style="overflow-x:auto">
        <table class="pf">
          <thead><tr><td>Linha</td><td class="v">R$</td><td class="v">% VGV</td></tr></thead>
          <tbody>
            ${linhas.map((r) => {
              const neg = r.cls === 'res' && r.v < 0;
              return html`<tr class="${r.cls || ''} ${neg ? 'neg' : ''}">
                <td>${r.l}</td>
                <td class="v">${fmtR$(r.v)}</td>
                <td class="v">${p.vgv > 0 ? fmtPct(Math.abs(r.v) / p.vgv * 100) : '—'}</td>
              </tr>`;
            })}
            <tr class="res ${p.margemLiquidaPct < 0 ? 'neg' : ''}">
              <td>Margem líquida</td><td class="v">${fmtPct(p.margemLiquidaPct)}</td><td class="v"></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  // ── Comparação de cenários (transiente, máx. 2) ──
  private _salvarCenario(p: Proforma) {
    const nome = `Cenário ${this.cenarios.length + 1}`;
    const novo = [...this.cenarios, { nome, p }];
    this.cenarios = novo.slice(-2); // mantém no máximo os 2 últimos
    urbiVerso.notificar(`${nome} salvo (transiente).`, 'sucesso');
  }

  private _renderComparacao() {
    if (this.cenarios.length < 2) {
      return html`<div class="card" style="margin-top:16px"><p class="sec">1 cenário salvo. Ajuste as premissas e salve um segundo para comparar.</p></div>`;
    }
    const [a, b] = this.cenarios;
    const metricas: { l: string; f: (p: Proforma) => number; pct?: boolean }[] = [
      { l: 'VGV', f: (p) => p.vgv },
      { l: 'Receita líquida', f: (p) => p.receitaLiquida },
      { l: 'Custo total', f: (p) => p.custoDiretoTotal + p.custoIndiretoTotal },
      { l: 'Resultado', f: (p) => p.resultado },
      { l: 'Margem líquida', f: (p) => p.margemLiquidaPct, pct: true },
    ];
    return html`<div class="card comp" style="margin-top:16px">
      <h3 style="margin-top:0">Comparação de cenários</h3>
      <div style="overflow-x:auto"><table class="pf">
        <thead><tr><td>Métrica</td><td class="v">${a.nome}</td><td class="v">${b.nome}</td><td class="v">Δ%</td></tr></thead>
        <tbody>
          ${metricas.map((m) => {
            const va = m.f(a.p), vb = m.f(b.p);
            const delta = va !== 0 ? (vb - va) / Math.abs(va) * 100 : 0;
            return html`<tr>
              <td>${m.l}</td>
              <td class="v">${m.pct ? fmtPct(va) : fmtR$(va)}</td>
              <td class="v">${m.pct ? fmtPct(vb) : fmtR$(vb)}</td>
              <td class="v delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%</td>
            </tr>`;
          })}
        </tbody>
      </table></div>
    </div>`;
  }

  // ── Análise de sensibilidade (Bear / Base / Bull) ──
  private _variaveis(lot: boolean): { v: VarSens; l: string }[] {
    return [
      { v: 'preco', l: lot ? 'Preço/m² de venda' : 'Preço/m² (res + não res)' },
      { v: 'permuta_fisica', l: 'Permuta física' },
      { v: 'permuta_financeira', l: 'Permuta financeira' },
      lot ? { v: 'custo_infra' as VarSens, l: 'Custo de infraestrutura' } : { v: 'custo_obras' as VarSens, l: 'Custo de obras' },
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

  private _renderSensibilidade(lot: boolean) {
    const varPos = Number(this.estudo.sensibilidade_variacao_positiva_pct) || 10;
    const varNeg = Number(this.estudo.sensibilidade_variacao_negativa_pct) || 10;
    const bear = calcularProforma(this._aplicarFator(1 - varNeg / 100));
    const base = calcularProforma(this._aplicarFator(1));
    const bull = calcularProforma(this._aplicarFator(1 + varPos / 100));
    const linhas: { l: string; f: (p: Proforma) => number; pct?: boolean }[] = [
      { l: 'VGV', f: (p) => p.vgv },
      { l: 'Receita líquida', f: (p) => p.receitaLiquida },
      { l: 'Custo direto total', f: (p) => p.custoDiretoTotal },
      { l: 'Resultado', f: (p) => p.resultado },
      { l: 'Margem líquida', f: (p) => p.margemLiquidaPct, pct: true },
    ];
    return html`<div class="card" style="margin-top:16px">
      <h3 style="margin-top:0">Análise de sensibilidade</h3>
      <div class="campo" style="max-width:320px">
        <label>Variável estressada (−${varNeg}% / +${varPos}%)</label>
        <select .value=${this.varSens} @change=${(e: Event) => this.varSens = (e.target as HTMLSelectElement).value as VarSens}>
          ${this._variaveis(lot).map((o) => html`<option value=${o.v} ?selected=${o.v === this.varSens}>${o.l}</option>`)}
        </select>
      </div>
      <div style="overflow-x:auto"><table class="pf">
        <thead><tr><td>Linha</td><td class="v">Bear</td><td class="v">Base</td><td class="v">Bull</td></tr></thead>
        <tbody>
          ${linhas.map((m) => html`<tr>
            <td>${m.l}</td>
            <td class="v">${m.pct ? fmtPct(m.f(bear)) : fmtR$(m.f(bear))}</td>
            <td class="v">${m.pct ? fmtPct(m.f(base)) : fmtR$(m.f(base))}</td>
            <td class="v">${m.pct ? fmtPct(m.f(bull)) : fmtR$(m.f(bull))}</td>
          </tr>`)}
        </tbody>
      </table></div>
    </div>`;
  }

  private _exportar(formato: string) {
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    if (formato === 'excel') exportarExcel(this.estudo, p, lot);
    else if (!exportarPDF(this.estudo, p, lot)) urbiVerso.notificar('Permita pop-ups para exportar em PDF.', 'alerta');
  }
}

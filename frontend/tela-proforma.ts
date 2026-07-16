import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import { urbiVerso, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { exportarPDF, exportarExcel } from './exportar.js';

// `tipo` dá a categoria visual (#3): receita | consolidado | resultado;
// ausente = item comum (sub-linha discreta). `grupo` marca sub-linhas
// colapsáveis (#2); `toggle` marca a linha-total que colapsa aquele grupo.
interface Linha {
  l: string; v: number;
  tipo?: 'receita' | 'consolidado' | 'resultado';
  grupo?: 'direto' | 'indireto';
  toggle?: 'direto' | 'indireto';
  soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean;
}

type VarSens = 'preco' | 'permuta_fisica' | 'permuta_financeira' | 'custo_infra' | 'custo_obras';

@customElement('viab-tela-proforma')
export class ViabTelaProforma extends LitElement {
  @property({ attribute: false }) estudo: any = null;

  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  @state() private varSens: VarSens = 'preco';
  // #2: grupos de custo colapsados (default: expandido).
  @state() private colapso: { direto: boolean; indireto: boolean } = { direto: false, indireto: false };

  static styles = [estiloConteudo, css`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpis urbi-kpi { min-width: 0; }
    .barra-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; justify-content: flex-end; }
    .sens-var { max-width: 320px; margin-bottom: 12px; }
    urbi-card + urbi-card { margin-top: 16px; }
    strong.total { color: var(--cor-texto-forte, rgba(255,255,255,0.95)); }

    /* #3: tabela da Proforma com 4 tipos de linha, só cores do design system. */
    .pf-wrap { overflow-x: auto; }
    table.pf { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 0.85rem; }
    .pf th, .pf td { padding: 8px 10px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); }
    .pf th {
      text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .pf td { text-align: left; color: var(--cor-texto, rgba(255,255,255,0.85)); }
    .pf .num { text-align: right; white-space: nowrap; }
    .toggle {
      background: none; border: none; color: inherit; cursor: pointer;
      font-size: 0.85rem; line-height: 1; padding: 0 8px 0 0; width: 20px;
    }
    /* Tipo 1 — Receita (identidade UP: azul primária), simples. */
    .pf tr.receita td { color: var(--cor-primaria-solida, #2AA9E0); font-weight: 600; }
    /* Tipo 2 — Consolidado (bold + fundo de destaque). */
    .pf tr.consolidado td {
      font-weight: 700; background: var(--cor-superficie-hover, rgba(255,255,255,0.08));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
    }
    /* Tipo 3 — Resultado final (bold + grande + highlight forte). */
    .pf tr.resultado td {
      font-weight: 800; font-size: 1.05rem; background: var(--cor-primaria-fundo, rgba(42,169,224,0.12));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
    }
    .pf tr.resultado td.pos { color: var(--cor-sucesso, #13A98D); }
    .pf tr.resultado td.neg { color: var(--cor-erro, #D45A3A); }
    /* Tipo 4 — Itens/sub-linhas (discreto/neutro). */
    .pf tr.item td { color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
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
      { l: 'Receita bruta (VGV)', v: p.vgv, tipo: 'receita' },
      { l: '(-) Imposto', v: p.imposto },
      { l: '(-) Corretagem', v: p.corretagem },
      { l: '(-) Marketing', v: p.marketing },
      { l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, ocultarSeZero: true },
      { l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, ocultarSeZero: true },
      { l: '= Receita líquida', v: p.receitaLiquida, tipo: 'receita' },
      { l: '(-) Terreno', v: p.custoTerreno, grupo: 'direto' },
      { l: '(-) Projetos e aprovação', v: p.projetos, grupo: 'direto' },
      { l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true, grupo: 'direto' },
      { l: '(-) Outorga', v: p.outorga, soInc: true, grupo: 'direto' },
      { l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true, grupo: 'direto' },
      { l: '(-) Construção', v: p.construcao, soInc: true, grupo: 'direto' },
      { l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true, grupo: 'direto' },
      { l: '(-) Decoração', v: p.decoracao, soInc: true, grupo: 'direto' },
      { l: '(-) Manutenção pós-obra', v: p.manutencao, grupo: 'direto' },
      { l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true, grupo: 'direto' },
      { l: '= Custo direto total', v: p.custoDiretoTotal, tipo: 'consolidado', toggle: 'direto' },
      { l: '(-) Marketing global e estrutura', v: p.marketingGlobal, grupo: 'indireto' },
      { l: '(-) Gestão e outros indiretos', v: p.gestaoIndiretos, grupo: 'indireto' },
      { l: '= Custo indireto total', v: p.custoIndiretoTotal, tipo: 'consolidado', toggle: 'indireto' },
      { l: '(memo) Permuta física entregue', v: p.valorPermutaFisica, ocultarSeZero: true },
      { l: '= Resultado', v: p.resultado, tipo: 'resultado' },
      // (#7) Linha "Margem líquida" removida — o valor aparece no % VGV do Resultado.
    ];
  }

  private _toggle(g: 'direto' | 'indireto') {
    this.colapso = { ...this.colapso, [g]: !this.colapso[g] };
  }

  // % VGV: no Resultado é a margem (com sinal); nas demais, magnitude sobre o VGV.
  private _pctVgv(r: Linha, p: Proforma): string {
    if (p.vgv <= 0) return '—';
    return r.tipo === 'resultado'
      ? fmtPct(r.v / p.vgv * 100)
      : fmtPct(Math.abs(r.v) / p.vgv * 100);
  }

  private _renderTabela(p: Proforma, lot: boolean): TemplateResult {
    const linhas = this._linhas(p).filter((r) =>
      !(r.soLot && !lot) && !(r.soInc && lot)
      && !(r.ocultarSeZero && Math.abs(r.v) < 0.005)
      && !(r.grupo && this.colapso[r.grupo]));   // #2: esconde sub-linhas do grupo colapsado
    return html`
      <div class="pf-wrap">
        <table class="pf">
          <thead>
            <tr><th>Linha</th><th class="num">R$</th><th class="num">% VGV</th></tr>
          </thead>
          <tbody>
            ${linhas.map((r) => {
              const cls = r.tipo ?? 'item';
              const sinal = r.tipo === 'resultado' ? (r.v < 0 ? 'neg' : 'pos') : '';
              return html`<tr class=${cls}>
                <td>
                  ${r.toggle
                    ? html`<button class="toggle" title="Expandir/recolher"
                        @click=${() => this._toggle(r.toggle!)}>${this.colapso[r.toggle!] ? '▸' : '▾'}</button>`
                    : nothing}
                  ${r.l}
                </td>
                <td class="num ${sinal}">${fmtR$(r.v)}</td>
                <td class="num">${this._pctVgv(r, p)}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
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
    // #6: emoji + cor por cenário (tokens do design system). Bull=verde (positivo),
    // Base=neutro, Bear=vermelho (negativo). Aplicados no cabeçalho e nos valores.
    const CORES = {
      bear: 'var(--cor-erro, #D45A3A)',
      base: 'var(--cor-texto, rgba(255,255,255,0.85))',
      bull: 'var(--cor-sucesso, #13A98D)',
    } as const;
    const colCenario = (id: 'bear' | 'base' | 'bull', rot: string, cen: Proforma) => ({
      id, alinhamento: 'direita',
      label: html`<span style="color:${CORES[id]}">${rot}</span>`,
      render: (m: any) => html`<span style="color:${CORES[id]};font-variant-numeric:tabular-nums">${fmt(m, m.f(cen))}</span>`,
    });
    const colunas = [
      { id: 'linha', label: 'Linha', valor: (m: any) => m.l },
      colCenario('bear', '📉 Bear', bear),
      colCenario('base', '📊 Base', base),
      colCenario('bull', '🚀 Bull', bull),
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

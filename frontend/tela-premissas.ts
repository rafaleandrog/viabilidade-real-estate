import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estilosBase } from './viab-shared.js';
import { urbiVerso, atualizarEstudo, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, precoSugeridoM2, type ProformaInput } from './proforma.js';

type T = 'num' | 'txt' | 'bool';
interface Campo { k: string; label: string; t: T; sufixo?: string; }

// Campos por seção. `so` limita a um tipo ('loteamento' | 'incorporacao').
const CUSTOS: (Campo & { so?: string })[] = [
  { k: 'custo_terreno_m2', label: 'Custo do terreno', t: 'num', sufixo: 'R$/m²' },
  { k: 'custo_infra_m2', label: 'Infraestrutura (R$/m²)', t: 'num', sufixo: 'R$/m²', so: 'loteamento' },
  { k: 'infra_pct', label: 'Infraestrutura (% VGV)', t: 'num', sufixo: '%', so: 'loteamento' },
  { k: 'custo_construcao_m2', label: 'Construção', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'custo_decoracao_m2', label: 'Decoração', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'taxa_gestao_pct', label: 'Gestão da construção', t: 'num', sufixo: '%', so: 'incorporacao' },
  { k: 'incorporacao_registro_pct', label: 'Incorporação e registro', t: 'num', sufixo: '% VGV', so: 'incorporacao' },
  { k: 'valor_venal_terreno_m2', label: 'Valor venal do terreno (outorga)', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'projetos_pct', label: 'Projetos', t: 'num', sufixo: '% VGV' },
  { k: 'manutencao_pct', label: 'Manutenção pós-obra', t: 'num', sufixo: '% VGV' },
  { k: 'contingencias_pct', label: 'Contingências', t: 'num', sufixo: '% VGV' },
  { k: 'stand_vendas_valor', label: 'Stand de vendas', t: 'num', sufixo: 'R$', so: 'loteamento' },
  { k: 'marketing_global_pct', label: 'Marketing global / estrutura', t: 'num', sufixo: '% VGV' },
  { k: 'gestao_indiretos_pct', label: 'Gestão e indiretos', t: 'num', sufixo: '% VGV' },
];

const DEDUCOES: Campo[] = [
  { k: 'imposto_percentual', label: 'Imposto (se não RET)', t: 'num', sufixo: '%' },
  { k: 'corretagem_percentual', label: 'Corretagem', t: 'num', sufixo: '%' },
  { k: 'marketing_percentual', label: 'Marketing', t: 'num', sufixo: '%' },
  { k: 'permuta_financeira_residencial_pct', label: 'Permuta financeira residencial', t: 'num', sufixo: '%' },
  { k: 'permuta_financeira_nao_residencial_pct', label: 'Permuta financeira não residencial', t: 'num', sufixo: '%' },
];

const AREAS_LOT: Campo[] = [
  { k: 'app_pct', label: 'APP', t: 'num', sufixo: '% gleba' },
  { k: 'faixas_nao_edificaveis_pct', label: 'Faixas não edificáveis', t: 'num', sufixo: '% gleba' },
  { k: 'sistema_viario_pct', label: 'Sistema viário', t: 'num', sufixo: '% gleba' },
  { k: 'elup_pct', label: 'ELUP', t: 'num', sufixo: '% gleba' },
  { k: 'epc_pct', label: 'EPC', t: 'num', sufixo: '% gleba' },
  { k: 'epu_pct', label: 'EPU', t: 'num', sufixo: '% gleba' },
  { k: 'areas_privativas_nao_vendaveis_pct', label: 'Priv. não vendáveis', t: 'num', sufixo: '% gleba' },
  { k: 'area_media_lote_m2', label: 'Área média do lote', t: 'num', sufixo: 'm²' },
  { k: 'preco_venda_m2', label: 'Preço de venda', t: 'num', sufixo: 'R$/m²' },
];

const AREAS_INC: Campo[] = [
  { k: 'coef_aproveitamento_basico', label: 'Coef. aproveitamento básico', t: 'num' },
  { k: 'coef_aproveitamento_maximo', label: 'Coef. aproveitamento máximo', t: 'num' },
  { k: 'area_pvt_r_fechada', label: 'Área PVT R Fechada', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_nr_fechada', label: 'Área PVT NR Fechada', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_r_aberta', label: 'Área PVT R Aberta', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_nr_aberta', label: 'Área PVT NR Aberta', t: 'num', sufixo: 'm²' },
  { k: 'area_comum_total', label: 'Área comum total', t: 'num', sufixo: 'm²' },
  { k: 'num_unidades', label: 'Nº de unidades', t: 'num' },
  { k: 'preco_venda_m2_residencial', label: 'Preço venda residencial', t: 'num', sufixo: 'R$/m²' },
  { k: 'preco_venda_m2_nao_residencial', label: 'Preço venda não residencial', t: 'num', sufixo: 'R$/m²' },
];

const TODOS_NUM = new Set<string>([
  ...CUSTOS, ...DEDUCOES, ...AREAS_LOT, ...AREAS_INC,
  { k: 'permuta_fisica_area_m2' } as any, { k: 'permuta_fisica_pct' } as any, { k: 'terreno_manual_area' } as any,
].filter((c: any) => c.t === 'num' || ['permuta_fisica_area_m2', 'permuta_fisica_pct', 'terreno_manual_area'].includes(c.k)).map((c: any) => c.k));

const fmtR$ = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtNum = (v: number, d = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

@customElement('viab-tela-premissas')
export class ViabTelaPremissas extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;

  static styles = [estilosBase, css`
    :host { display: block; }
    .secao { margin-bottom: 18px; }
    .secao h4 { margin: 0 0 10px; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .campo-in { position: relative; }
    .campo-in .suf { position: absolute; right: 10px; top: 30px; font-size: 0.7rem; color: var(--cor-texto-sec, rgba(255,255,255,0.4)); pointer-events: none; }
    .toggle { display: inline-flex; border: 1px solid var(--cor-borda, rgba(255,255,255,0.14)); border-radius: 6px; overflow: hidden; }
    .toggle button { border: none; border-radius: 0; background: none; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); padding: 5px 10px; }
    .toggle button.on { background: var(--cor-primaria-solida, #2AA9E0); color: #06121c; font-weight: 600; }
    .check { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 6px; }
    .kpi { background: var(--cor-fundo, #0D1B2A); border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; }
    .kpi .rot { font-size: 0.7rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; letter-spacing: 0.03em; }
    .kpi .val { font-size: 1.15rem; font-weight: 700; margin-top: 4px; }
    .kpi.ok .val { color: var(--cor-sucesso, #13A98D); }
    .kpi.ruim .val { color: var(--cor-erro, #D45A3A); }
    .preco-sugerido { margin-top: 12px; padding: 12px 14px; border-radius: 8px; background: rgba(247,161,17,0.10); border: 1px solid rgba(247,161,17,0.3); font-size: 0.9rem; }
    .preco-sugerido strong { color: var(--cor-cta, #F7A111); }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._init();
  }
  updated(ch: Map<string, unknown>) {
    if (ch.has('estudo')) this._init();
  }

  private async _init() {
    if (!this.estudo) return;
    this.form = { ...this.estudo };
    try {
      const [bm, cfg] = await Promise.all([listarBenchmarks(this.estudo.tipo_empreendimento), buscarConfig()]);
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
    } catch (e) { console.error(e); }
  }

  private _entradaProforma(): ProformaInput {
    return { ...this.form, aliquota_ret_pct: this.aliquotaRet } as ProformaInput;
  }

  private _set(k: string, v: any) { this.form = { ...this.form, [k]: v }; }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const areas = lot ? AREAS_LOT : AREAS_INC;
    const custos = CUSTOS.filter((c) => !c.so || c.so === this.estudo.tipo_empreendimento);
    const dis = !this.editavel;

    return html`
      <div class="card">
        <h3 style="margin-top:0">Premissas</h3>

        <div class="secao">
          <h4>Terreno</h4>
          ${this.estudo.origem_terreno === 'nucleo'
            ? html`<p class="sec">Origem: Núcleo (área em modo leitura — indisponível nesta instância).</p>`
            : html`<div class="grid">
                ${this._input({ k: 'terreno_manual_nome', label: 'Nome do terreno', t: 'txt' }, dis)}
                ${this._input({ k: 'terreno_manual_area', label: 'Área do terreno', t: 'num', sufixo: 'm²' }, dis)}
              </div>`}
        </div>

        <div class="secao">
          <h4>Produto e áreas</h4>
          <div class="grid">${areas.map((c) => this._input(c, dis))}</div>
        </div>

        <div class="secao">
          <h4>Custos</h4>
          <div class="check">
            <input type="checkbox" ?disabled=${dis} .checked=${this.form.considerar_custo_terreno !== false}
              @change=${(e: Event) => this._set('considerar_custo_terreno', (e.target as HTMLInputElement).checked)} />
            <label>Considerar custo de aquisição do terreno</label>
          </div>
          ${lot ? this._toggle('infra_modo', [{ v: 'pct_vgv', l: '% VGV' }, { v: 'valor_m2', l: 'R$/m²' }], 'Infraestrutura', dis) : nothing}
          ${this._toggle('projetos_modo', [{ v: 'pct_vgv', l: '% VGV' }, { v: 'valor_fixo', l: 'R$ fixo' }], 'Projetos', dis)}
          <div class="grid">${custos.map((c) => this._input(c, dis))}</div>
        </div>

        <div class="secao">
          <h4>Impostos e deduções</h4>
          <div class="check">
            <input type="checkbox" ?disabled=${dis} .checked=${!!this.form.sujeito_ret}
              @change=${(e: Event) => this._set('sujeito_ret', (e.target as HTMLInputElement).checked)} />
            <label>Sujeito a RET (alíquota fixa ${this.aliquotaRet}%)</label>
          </div>
          <div class="grid">${DEDUCOES.map((c) => this._input(c, dis || (c.k === 'imposto_percentual' && !!this.form.sujeito_ret)))}</div>
        </div>

        <div class="secao">
          <h4>Permuta física</h4>
          ${this._toggle('permuta_fisica_modo', [{ v: 'area_m2', l: 'm²' }, { v: 'pct_area_venda', l: '% área venda' }], 'Modo', dis)}
          <div class="grid">
            ${this._input({ k: 'permuta_fisica_area_m2', label: 'Permuta física (m²)', t: 'num', sufixo: 'm²' }, dis || this.form.permuta_fisica_modo === 'pct_area_venda')}
            ${this._input({ k: 'permuta_fisica_pct', label: 'Permuta física (% área venda)', t: 'num', sufixo: '%' }, dis || this.form.permuta_fisica_modo !== 'pct_area_venda')}
          </div>
        </div>

        ${this.editavel ? html`<div class="acoes">
          <button class="btn-cta" ?disabled=${this.salvando} @click=${this._salvar}>${this.salvando ? 'Salvando…' : 'Salvar premissas'}</button>
        </div>` : html`<p class="sec">Somente leitura neste status/função.</p>`}
      </div>

      ${this._renderResumo(lot)}
    `;
  }

  private _input(c: Campo, dis: boolean) {
    if (c.t === 'txt') {
      return html`<div class="campo campo-in">
        <label>${c.label}</label>
        <input type="text" ?disabled=${dis} .value=${String(this.form[c.k] ?? '')}
          @input=${(e: Event) => this._set(c.k, (e.target as HTMLInputElement).value)} />
      </div>`;
    }
    return html`<div class="campo campo-in">
      <label>${c.label}</label>
      <input type="number" ?disabled=${dis} .value=${String(this.form[c.k] ?? '')}
        @input=${(e: Event) => this._set(c.k, (e.target as HTMLInputElement).value)} />
      ${c.sufixo ? html`<span class="suf">${c.sufixo}</span>` : nothing}
    </div>`;
  }

  private _toggle(k: string, ops: { v: string; l: string }[], rotulo: string, dis: boolean) {
    const atual = this.form[k] ?? ops[0].v;
    return html`<div class="campo">
      <label>${rotulo}</label>
      <div class="toggle">
        ${ops.map((o) => html`<button class=${atual === o.v ? 'on' : ''} ?disabled=${dis} @click=${() => this._set(k, o.v)}>${o.l}</button>`)}
      </div>
    </div>`;
  }

  private _benchmark(campo: string): any { return this.benchmarks.find((b) => b.campo === campo); }

  private _renderResumo(lot: boolean) {
    const p = calcularProforma(this._entradaProforma());
    const kpis: { rot: string; val: string; bm?: { ok: boolean } }[] = [];

    if (lot) {
      const ef = this._benchmark('eficiencia_aproveitamento');
      kpis.push(
        { rot: 'Área da gleba', val: `${fmtNum(p.areaTerreno)} m²` },
        { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²` },
        { rot: 'Vendável / gleba', val: fmtPct(p.eficienciaPct), bm: ef ? { ok: p.eficienciaPct >= Number(ef.valor) } : undefined },
        { rot: 'VGV', val: fmtR$(p.vgv) },
        { rot: 'Nº de lotes', val: fmtNum(p.numUnidades) },
        { rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct) },
      );
    } else {
      const co = this._benchmark('custo_obras_vgv');
      const ml = this._benchmark('margem_liquida');
      kpis.push(
        { rot: 'Área privativa total', val: `${fmtNum(p.areaPrivativa)} m²` },
        { rot: 'Área construída', val: `${fmtNum(p.areaConstruida)} m²` },
        { rot: 'Nº de unidades', val: fmtNum(p.numUnidades) },
        { rot: 'Preço médio/unid.', val: fmtR$(p.precoMedioUnidade) },
        { rot: 'Custo obras / VGV', val: fmtPct(p.custoObrasVgvPct), bm: co ? { ok: p.custoObrasVgvPct <= Number(co.valor) } : undefined },
        { rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), bm: ml ? { ok: p.margemLiquidaPct >= Number(ml.valor) } : undefined },
      );
    }

    // Preço sugerido/m² a partir do piso de resultado final
    const piso = this._benchmark('resultado_final');
    let precoSug: number | null = null;
    if (piso && Number(piso.valor) > 0) precoSug = precoSugeridoM2(this._entradaProforma(), Number(piso.valor));

    return html`
      <div class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Resumo</h3>
        <div class="kpis">
          ${kpis.map((k) => html`
            <div class="kpi ${k.bm ? (k.bm.ok ? 'ok' : 'ruim') : ''}">
              <div class="rot">${k.rot}</div>
              <div class="val">${k.val}</div>
            </div>
          `)}
        </div>
        ${piso ? html`
          <div class="preco-sugerido">
            Preço sugerido/m² para atingir o piso de resultado final (${fmtNum(Number(piso.valor))}%):
            <strong>${precoSug !== null ? fmtR$(precoSug) + '/m²' : 'inatingível com as premissas atuais'}</strong>
          </div>
        ` : html`<p class="sec" style="margin-top:12px">Defina o benchmark “resultado_final” para calcular o preço sugerido/m².</p>`}
      </div>
    `;
  }

  private _salvar = async () => {
    this.salvando = true;
    try {
      const dados: Record<string, any> = {};
      for (const [k, v] of Object.entries(this.form)) {
        if (['id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id', 'criado_em', 'atualizado_em',
          'membros', 'imoveis', '_permissao', '_funcao', 'autor_nome', 'autor_avatar_url'].includes(k)) continue;
        if (TODOS_NUM.has(k)) dados[k] = v === '' || v == null ? null : Number(v);
        else dados[k] = v;
      }
      const res = await atualizarEstudo(this.estudo.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      urbiVerso.notificar('Premissas salvas.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvando = false;
    }
  };
}

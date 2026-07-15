import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct, fmtPctEntrada } from './viab-format.js';
import { urbiVerso, atualizarEstudo, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, precoSugeridoM2, type ProformaInput } from './proforma.js';
import './tela-terreno-nucleo.js';

type T = 'num' | 'txt';
interface Campo { k: string; label: string; t: T; sufixo?: string; }
interface Opcao { valor: string; rotulo: string; }

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
].map((c) => c.k).concat(['permuta_fisica_area_m2', 'permuta_fisica_pct', 'terreno_manual_area']));

@customElement('viab-tela-premissas')
export class ViabTelaPremissas extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;

  static styles = [estiloConteudo, css`
    .secao { margin-bottom: 20px; }
    .secao h4 {
      margin: 0 0 12px; font-size: var(--texto-rotulo, 0.75rem);
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .kpis urbi-kpi { min-width: 0; }
    .checks { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .form-acoes { display: flex; justify-content: flex-end; margin-top: 8px; }
    urbi-card + urbi-card { margin-top: 16px; }
    urbi-banner { margin-top: 12px; }
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

  private _num(k: string): number | null {
    const v = this.form[k];
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const areas = lot ? AREAS_LOT : AREAS_INC;
    const custos = CUSTOS.filter((c) => !c.so || c.so === this.estudo.tipo_empreendimento);
    const dis = !this.editavel;

    return html`
      <urbi-card titulo="Premissas">
        <div class="secao">
          <h4>Terreno</h4>
          ${this.estudo.origem_terreno === 'nucleo'
            ? html`<viab-terreno-nucleo
                .estudo=${this.estudo}
                .editavel=${this.editavel && this.estudo.status === 'rascunho'}
              ></viab-terreno-nucleo>`
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
          <div class="checks">
            <urbi-checkbox
              label="Considerar custo de aquisição do terreno"
              ?desabilitado=${dis}
              ?marcado=${this.form.considerar_custo_terreno !== false}
              @urbi:checkbox-change=${(e: CustomEvent) => this._set('considerar_custo_terreno', e.detail.marcado)}
            ></urbi-checkbox>
          </div>
          <div class="grid">
            ${lot ? this._modo('infra_modo', [{ valor: 'pct_vgv', rotulo: '% VGV' }, { valor: 'valor_m2', rotulo: 'R$/m²' }], 'Infraestrutura', dis) : nothing}
            ${this._modo('projetos_modo', [{ valor: 'pct_vgv', rotulo: '% VGV' }, { valor: 'valor_fixo', rotulo: 'R$ fixo' }], 'Projetos', dis)}
            ${custos.map((c) => this._input(c, dis))}
          </div>
        </div>

        <div class="secao">
          <h4>Impostos e deduções</h4>
          <div class="checks">
            <urbi-checkbox
              label="Sujeito a RET (alíquota fixa ${this.aliquotaRet}%)"
              ?desabilitado=${dis}
              ?marcado=${!!this.form.sujeito_ret}
              @urbi:checkbox-change=${(e: CustomEvent) => this._set('sujeito_ret', e.detail.marcado)}
            ></urbi-checkbox>
          </div>
          <div class="grid">${DEDUCOES.map((c) => this._input(c, dis || (c.k === 'imposto_percentual' && !!this.form.sujeito_ret)))}</div>
        </div>

        <div class="secao">
          <h4>Permuta física</h4>
          <div class="grid">
            ${this._modo('permuta_fisica_modo', [{ valor: 'area_m2', rotulo: 'm²' }, { valor: 'pct_area_venda', rotulo: '% área venda' }], 'Modo', dis)}
            ${this._input({ k: 'permuta_fisica_area_m2', label: 'Permuta física (m²)', t: 'num', sufixo: 'm²' }, dis || this.form.permuta_fisica_modo === 'pct_area_venda')}
            ${this._input({ k: 'permuta_fisica_pct', label: 'Permuta física (% área venda)', t: 'num', sufixo: '%' }, dis || this.form.permuta_fisica_modo !== 'pct_area_venda')}
          </div>
        </div>

        ${this.editavel
          ? html`<div class="form-acoes">
              <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar premissas</urbi-botao>
            </div>`
          : html`<p class="sec">Somente leitura neste status/função.</p>`}
      </urbi-card>

      ${this._renderResumo(lot)}
    `;
  }

  private _input(c: Campo, dis: boolean): TemplateResult {
    if (c.t === 'txt') {
      return html`<urbi-input
        label=${c.label} ?desabilitado=${dis}
        .valor=${String(this.form[c.k] ?? '')}
        @urbi:input-change=${(e: CustomEvent) => this._set(c.k, e.detail.valor)}
      ></urbi-input>`;
    }
    return html`<urbi-input-numero
      label=${c.label} sufixo=${c.sufixo ?? ''} ?desabilitado=${dis}
      .valor=${this._num(c.k)}
      @urbi:input-numero-change=${(e: CustomEvent) => this._set(c.k, e.detail.valor)}
    ></urbi-input-numero>`;
  }

  private _modo(k: string, ops: Opcao[], rotulo: string, dis: boolean): TemplateResult {
    return html`<urbi-select
      label=${rotulo} ?desabilitado=${dis}
      .valor=${this.form[k] ?? ops[0].valor}
      .opcoes=${ops}
      @urbi:select-change=${(e: CustomEvent) => this._set(k, e.detail.valor)}
    ></urbi-select>`;
  }

  private _benchmark(campo: string): any { return this.benchmarks.find((b) => b.campo === campo); }

  private _renderResumo(lot: boolean): TemplateResult {
    const p = calcularProforma(this._entradaProforma());
    const kpis: { rot: string; val: string; variante: string }[] = [];
    const variante = (bm: any | undefined, ok: () => boolean) => (bm ? (ok() ? 'sucesso' : 'erro') : '');

    if (lot) {
      const ef = this._benchmark('eficiencia_aproveitamento');
      kpis.push(
        { rot: 'Área da gleba', val: `${fmtNum(p.areaTerreno)} m²`, variante: '' },
        { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²`, variante: '' },
        { rot: 'Vendável / gleba', val: fmtPct(p.eficienciaPct), variante: variante(ef, () => p.eficienciaPct >= Number(ef.valor)) },
        { rot: 'VGV', val: fmtR$(p.vgv), variante: '' },
        { rot: 'Nº de lotes', val: fmtNum(p.numUnidades), variante: '' },
        { rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), variante: '' },
      );
    } else {
      const co = this._benchmark('custo_obras_vgv');
      const ml = this._benchmark('margem_liquida');
      kpis.push(
        { rot: 'Área privativa total', val: `${fmtNum(p.areaPrivativa)} m²`, variante: '' },
        { rot: 'Área construída', val: `${fmtNum(p.areaConstruida)} m²`, variante: '' },
        { rot: 'Nº de unidades', val: fmtNum(p.numUnidades), variante: '' },
        { rot: 'Preço médio/unid.', val: fmtR$(p.precoMedioUnidade), variante: '' },
        { rot: 'Custo obras / VGV', val: fmtPct(p.custoObrasVgvPct), variante: variante(co, () => p.custoObrasVgvPct <= Number(co.valor)) },
        { rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), variante: variante(ml, () => p.margemLiquidaPct >= Number(ml.valor)) },
      );
    }

    const piso = this._benchmark('resultado_final');
    let precoSug: number | null = null;
    if (piso && Number(piso.valor) > 0) precoSug = precoSugeridoM2(this._entradaProforma(), Number(piso.valor));

    return html`
      <urbi-card titulo="Resumo">
        <div class="kpis">
          ${kpis.map((k) => html`
            <urbi-kpi rotulo=${k.rot} .valor=${k.val} variante=${k.variante}></urbi-kpi>
          `)}
        </div>
        ${piso
          ? html`<urbi-banner variante="alerta">
              Preço sugerido/m² para atingir o piso de resultado final (${fmtPctEntrada(Number(piso.valor))}):
              <strong>${precoSug !== null ? fmtR$(precoSug) + '/m²' : 'inatingível com as premissas atuais'}</strong>
            </urbi-banner>`
          : html`<p class="sec">Defina o benchmark “resultado_final” para calcular o preço sugerido/m².</p>`}
      </urbi-card>
    `;
  }

  private _salvar = async () => {
    this.salvando = true;
    try {
      const dados: Record<string, any> = {};
      for (const [k, v] of Object.entries(this.form)) {
        if (['id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id', 'criado_em', 'atualizado_em',
          'removido_em', 'removido_por_id',
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

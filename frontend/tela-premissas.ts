import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct, fmtPctEntrada } from './viab-format.js';
import { urbiVerso, atualizarEstudo, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, precoSugeridoM2, type ProformaInput } from './proforma.js';
import './tela-terreno-nucleo.js';
import './viab-num.js';

type T = 'num' | 'txt';
interface Campo { k: string; label: string; t: T; sufixo?: string; }

// Campos por seção. `so` limita a um tipo ('loteamento' | 'incorporacao').
const CUSTOS: (Campo & { so?: string })[] = [
  { k: 'custo_terreno_m2', label: 'Custo do terreno', t: 'num', sufixo: 'R$/m²' },
  { k: 'custo_decoracao_m2', label: 'Decoração', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'taxa_gestao_pct', label: 'Gestão da construção', t: 'num', sufixo: '%', so: 'incorporacao' },
  { k: 'incorporacao_registro_pct', label: 'Incorporação e registro', t: 'num', sufixo: '% VGV', so: 'incorporacao' },
  { k: 'valor_venal_terreno_m2', label: 'Valor venal do terreno (outorga)', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'manutencao_pct', label: 'Manutenção pós-obra', t: 'num', sufixo: '% VGV' },
  { k: 'contingencias_pct', label: 'Contingências', t: 'num', sufixo: '% VGV' },
  { k: 'stand_vendas_valor', label: 'Stand de vendas', t: 'num', sufixo: 'R$', so: 'loteamento' },
  { k: 'marketing_global_pct', label: 'Marketing global / estrutura', t: 'num', sufixo: '% VGV' },
  { k: 'gestao_indiretos_pct', label: 'Gestão e indiretos', t: 'num', sufixo: '% VGV' },
];

// Custos com opção de UNIDADE (#3/#4): um seletor de unidade + um único campo de
// valor cuja chave/sufixo dependem da unidade escolhida. Só o campo da unidade
// ativa é exibido (o outro fica oculto — não some do schema).
interface CustoUnidade {
  modoKey: string; rotulo: string; so?: string; padrao: string;
  opcoes: { valor: string; rotulo: string; campo: string; sufixo: string }[];
}
const CUSTOS_UNIDADE: CustoUnidade[] = [
  {
    modoKey: 'infra_modo', rotulo: 'Infraestrutura', so: 'loteamento', padrao: 'pct_vgv',
    opcoes: [
      { valor: 'pct_vgv', rotulo: '% VGV', campo: 'infra_pct', sufixo: '% VGV' },
      { valor: 'valor_m2', rotulo: 'R$/m²', campo: 'custo_infra_m2', sufixo: 'R$/m²' },
    ],
  },
  {
    modoKey: 'construcao_modo', rotulo: 'Construção', so: 'incorporacao', padrao: 'valor_m2',
    opcoes: [
      { valor: 'valor_m2', rotulo: 'R$/m²', campo: 'custo_construcao_m2', sufixo: 'R$/m²' },
      { valor: 'valor_total', rotulo: 'R$ (total)', campo: 'construcao_valor_total', sufixo: 'R$' },
    ],
  },
  {
    modoKey: 'projetos_modo', rotulo: 'Projetos', padrao: 'pct_vgv',
    opcoes: [
      { valor: 'pct_vgv', rotulo: '% VGV', campo: 'projetos_pct', sufixo: '% VGV' },
      { valor: 'valor_fixo', rotulo: 'R$ (fixo)', campo: 'projetos_valor_fixo', sufixo: 'R$' },
    ],
  },
];

// Permuta física: mesmo padrão de campo único com unidade (a permuta reduz o VGV;
// entra por área em m² ou por % da área de venda). Renderizada na sua própria seção.
const PERMUTA_UNIDADE: CustoUnidade = {
  modoKey: 'permuta_fisica_modo', rotulo: 'Permuta física', padrao: 'area_m2',
  opcoes: [
    { valor: 'area_m2', rotulo: 'm²', campo: 'permuta_fisica_area_m2', sufixo: 'm²' },
    { valor: 'pct_area_venda', rotulo: '% área venda', campo: 'permuta_fisica_pct', sufixo: '%' },
  ],
};

const IMPOSTOS: Campo[] = [
  { k: 'imposto_percentual', label: 'Imposto (se não RET)', t: 'num', sufixo: '%' },
];

const DEDUCOES: Campo[] = [
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

// Coeficientes de aproveitamento (mín/máx): característica do terreno/zoneamento
// (só Incorporação). Renderizados dentro da seção Terreno (#9).
const TERRENO_COEF: Campo[] = [
  { k: 'coef_aproveitamento_basico', label: 'Coeficiente mínimo', t: 'num' },
  { k: 'coef_aproveitamento_maximo', label: 'Coeficiente máximo', t: 'num' },
];

const AREAS_INC: Campo[] = [
  { k: 'area_pvt_r_fechada', label: 'Área PVT R Fechada', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_nr_fechada', label: 'Área PVT NR Fechada', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_r_aberta', label: 'Área PVT R Aberta', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_nr_aberta', label: 'Área PVT NR Aberta', t: 'num', sufixo: 'm²' },
  { k: 'area_comum_total', label: 'Área comum total', t: 'num', sufixo: 'm²' },
  { k: 'num_unidades_residencial', label: 'Nº de unidades residenciais', t: 'num' },
  { k: 'num_unidades_nao_residencial', label: 'Nº de unidades não residenciais', t: 'num' },
  { k: 'preco_venda_m2_residencial', label: 'Preço venda residencial', t: 'num', sufixo: 'R$/m²' },
  { k: 'preco_venda_m2_nao_residencial', label: 'Preço venda não residencial', t: 'num', sufixo: 'R$/m²' },
];

const TODOS_NUM = new Set<string>([
  ...CUSTOS, ...IMPOSTOS, ...DEDUCOES, ...AREAS_LOT, ...AREAS_INC, ...TERRENO_COEF,
].map((c) => c.k).concat(
  ['permuta_fisica_area_m2', 'permuta_fisica_pct', 'terreno_manual_area'],
  CUSTOS_UNIDADE.flatMap((cu) => cu.opcoes.map((o) => o.campo)),
));

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
    .subgrid { margin-top: 12px; }
    /* #10: cada grupo é uma faixa delimitada por uma linha horizontal no topo,
       com duas cores do design system intercaladas (A/B). Tokens theme-aware. */
    .grupo { margin-bottom: 0; padding: 16px 14px; border-top: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .grupo-a { background: var(--cor-superficie-sutil, rgba(255,255,255,0.02)); }
    .grupo-b { background: var(--cor-superficie, rgba(255,255,255,0.04)); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .kpis urbi-kpi { min-width: 0; }
    .checks { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .form-acoes { display: flex; justify-content: flex-end; margin-top: 8px; }
    urbi-card + urbi-card { margin-top: 16px; }
    urbi-banner { margin-top: 12px; }
    /* Campo único com unidade: rótulo em cima; [tag de unidade][valor] embutidos. */
    .campo-unidade { display: flex; flex-direction: column; gap: 4px; }
    .cu-rotulo {
      font-size: 0.75rem; text-transform: uppercase;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-weight: 700; letter-spacing: 0.4px;
    }
    .cu-linha { display: flex; align-items: flex-end; gap: 6px; }
    .cu-unidade { flex: 0 0 auto; width: 132px; }
    .cu-valor { flex: 1 1 auto; min-width: 0; }
  `];

  private _idCarregado: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._init();
  }
  updated(ch: Map<string, unknown>) {
    // Só recarrega (e refaz o fetch de benchmarks/config) quando muda o ESTUDO
    // de fato — não a cada tecla propagada de volta via viab:premissas-change (#6).
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  private async _init() {
    if (!this.estudo) return;
    this._idCarregado = this.estudo.id ?? null;
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

  private _set(k: string, v: any) {
    this.form = { ...this.form, [k]: v };
    // Propaga em tempo real para a tela do estudo, que reflete em Proforma e
    // Gráficos instantaneamente (#6). Não persiste — persistência é no Salvar.
    this.dispatchEvent(new CustomEvent('viab:premissas-change', {
      detail: { dados: this.form }, bubbles: true, composed: true,
    }));
  }

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
        <div class="secao grupo grupo-a">
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
          ${!lot
            ? html`<div class="grid subgrid">${TERRENO_COEF.map((c) => this._input(c, dis))}</div>`
            : nothing}
        </div>

        <div class="secao grupo grupo-b">
          <h4>Áreas</h4>
          <div class="grid">${areas.filter((c) => c.label.startsWith('Área')).map((c) => this._input(c, dis))}</div>
        </div>

        <div class="secao grupo grupo-a">
          <h4>Produtos</h4>
          <div class="grid">${areas.filter((c) => !c.label.startsWith('Área')).map((c) => this._input(c, dis))}</div>
        </div>

        <div class="secao grupo grupo-b">
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
            ${CUSTOS_UNIDADE
              .filter((cu) => !cu.so || cu.so === this.estudo.tipo_empreendimento)
              .map((cu) => this._custoUnidade(cu, dis))}
            ${custos.map((c) => this._input(c, dis, c.k === 'custo_terreno_m2' && this.form.considerar_custo_terreno === false))}
          </div>
        </div>

        <div class="secao grupo grupo-a">
          <h4>Impostos</h4>
          <div class="checks">
            <urbi-checkbox
              label="Sujeito a RET (alíquota fixa ${this.aliquotaRet}%)"
              ?desabilitado=${dis}
              ?marcado=${!!this.form.sujeito_ret}
              @urbi:checkbox-change=${(e: CustomEvent) => this._set('sujeito_ret', e.detail.marcado)}
            ></urbi-checkbox>
          </div>
          <div class="grid">${IMPOSTOS.map((c) => {
            const bloqImposto = !!this.form.sujeito_ret;
            return this._input(c, dis || bloqImposto, bloqImposto);
          })}</div>
        </div>

        <div class="secao grupo grupo-b">
          <h4>Deduções</h4>
          <div class="grid">${DEDUCOES.map((c) => this._input(c, dis))}</div>
        </div>

        <div class="secao grupo grupo-a">
          <h4>Permuta física</h4>
          <div class="grid">
            ${this._custoUnidade(PERMUTA_UNIDADE, dis)}
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

  // `aten` (bug #15): campo cujo dado não entra no cálculo naquele momento
  // (ex.: custo do terreno desligado, lado não escolhido da permuta) — fica cinza.
  private _input(c: Campo, dis: boolean, aten = false): TemplateResult {
    if (c.t === 'txt') {
      return html`<urbi-input
        label=${c.label} ?desabilitado=${dis}
        .valor=${String(this.form[c.k] ?? '')}
        @urbi:input-change=${(e: CustomEvent) => this._set(c.k, e.detail.valor)}
      ></urbi-input>`;
    }
    return html`<viab-num
      label=${c.label} sufixo=${c.sufixo ?? ''} ?desabilitado=${dis} ?atenuado=${aten}
      .valor=${this._num(c.k)}
      @urbi:input-numero-change=${(e: CustomEvent) => this._set(c.k, e.detail.valor)}
    ></viab-num>`;
  }

  // Campo ÚNICO com unidade (#3/#4): rótulo em cima; abaixo, o seletor de unidade
  // (tag) + o valor da unidade ativa lado a lado, como um só campo — o mesmo
  // padrão do orçamento de obra (troca a tag → muda a unidade inserida). Só o
  // campo da unidade ativa é escrito; o outro fica intocado no schema (guarda os
  // possíveis valores diferentes por unidade).
  private _custoUnidade(cu: CustoUnidade, dis: boolean): TemplateResult {
    const modo = this.form[cu.modoKey] ?? cu.padrao;
    const op = cu.opcoes.find((o) => o.valor === modo) ?? cu.opcoes[0];
    return html`
      <div class="campo-unidade">
        <label class="cu-rotulo">${cu.rotulo}</label>
        <div class="cu-linha">
          <urbi-select class="cu-unidade" ?desabilitado=${dis}
            .valor=${modo}
            .opcoes=${cu.opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
            @urbi:select-change=${(e: CustomEvent) => this._set(cu.modoKey, e.detail.valor)}
          ></urbi-select>
          <viab-num class="cu-valor" sufixo=${op.sufixo} ?desabilitado=${dis}
            .valor=${this._num(op.campo)}
            @urbi:input-numero-change=${(e: CustomEvent) => this._set(op.campo, e.detail.valor)}
          ></viab-num>
        </div>
      </div>
    `;
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

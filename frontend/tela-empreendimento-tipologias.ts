import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtNum } from './viab-format.js';
import {
  urbiVerso,
  listarTipologiasCatalogo, criarTipologia, atualizarTipologia, removerTipologia,
} from './viabilidade-api.js';
import './viab-num.js';

// Sub-aba "Empreendimento → Tipologias" (nível Avançado · Lote 4 · #16, Lote 6 · #19).
//
// Catálogo consolidado de tipologias do estudo. A partir do Lote 6 as tipologias
// são um CATÁLOGO desacoplado (nível estudo) — a venda vira "alocação" na aba
// Viabilidade → Receitas, que referencia a tipologia pelo nome. Aqui só se
// cadastra o catálogo (nome, área, quantidade total, etc.).
//
// Colunas: Nome · Tipo · Área privativa · Dormitórios · Vagas · Unidades ·
// Unidades permutadas. Loteamento oculta Tipo/Dormitórios/Vagas. Nada aqui é
// usado pelo estudo Preliminar.

const TIPOS_UNIDADE_INC = [
  { valor: 'apartamento', rotulo: 'Apartamento' },
  { valor: 'cobertura', rotulo: 'Cobertura' },
  { valor: 'loja', rotulo: 'Loja' },
  { valor: 'outro', rotulo: 'Outro' },
];

const n = (v: any): number => Number(v) || 0;

@customElement('viab-empreendimento-tipologias')
export class ViabEmpreendimentoTipologias extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private tipologias: any[] = [];
  @state() private carregando = true;
  @state() private confirmRemover: any | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    /* #44 — larguras fixas para alinhar cabeçalho e células uniformemente */
    table.tip {
      width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums;
      table-layout: fixed;
    }
    table.tip th {
      text-align: left; font-weight: 600; padding: 8px 8px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-size: var(--texto-rotulo, 0.75rem);
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
      overflow: hidden;
    }
    table.tip th.num, table.tip td.num { text-align: right; }
    table.tip td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      font-size: var(--texto-corpo, 0.8125rem);
      overflow: hidden;
    }
    /* Larguras por coluna (th e td herdadas do table-layout: fixed) */
    col.c-nome   { width: auto; }
    col.c-tipo   { width: 160px; }
    col.c-area   { width: 130px; }
    col.c-dorm   { width: 90px; }
    col.c-vagas  { width: 90px; }
    col.c-un     { width: 100px; }
    col.c-perm   { width: 200px; }
    col.c-acao   { width: 90px; }

    table.tip td.nome urbi-input { width: 100%; }
    table.tip td.tipo urbi-select { width: 148px; }
    table.tip td viab-num { width: 100%; }

    /* #45 — texto calculado de permutadas */
    .perm-wrap { display: flex; align-items: center; gap: 8px; }
    .perm-calc {
      font-size: 0.72rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      white-space: nowrap; line-height: 1.3;
    }

    tr.total td {
      font-weight: 700; border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.2));
      border-bottom: none; padding-top: 10px;
    }
    .acoes-topo { margin-top: 16px; }
    .vazio { padding: 8px 0; }
  `];

  updated() {
    if (this.estudo?.id && !this.carregado) {
      this.carregado = true;
      this._carregar();
    }
  }

  private async _carregar() {
    if (this.estudo?.nivel_analise !== 'avancado') { this.carregando = false; return; }
    this.carregando = true;
    try {
      const r = await listarTipologiasCatalogo(this.estudo.id);
      if (!r?.erro) this.tipologias = r.dados || [];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar tipologias', 'erro');
    }
    this.carregando = false;
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    if (this.carregando) return html`<urbi-loading mensagem="Carregando tipologias..."></urbi-loading>`;
    const lote = this.estudo?.tipo_empreendimento === 'loteamento';
    return html`
      <urbi-card titulo="Tipologias do empreendimento">
        ${this.tipologias.length === 0 ? html`
          <div class="vazio">
            <urbi-estado-vazio icone="fa-solid fa-table-list"
              mensagem="Nenhuma tipologia cadastrada — adicione a primeira."></urbi-estado-vazio>
          </div>` : this._renderTabela(this.tipologias, lote)}

        ${this.editavel ? html`
          <div class="acoes-topo">
            <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionar}>
              Adicionar Tipologia
            </urbi-botao>
          </div>` : nothing}
      </urbi-card>
      ${this.confirmRemover ? this._renderConfirm() : nothing}
    `;
  }

  private _renderTabela(tips: any[], lote: boolean): TemplateResult {
    const dis = !this.editavel;
    const totalUnidades = tips.reduce((s, t) => s + n(t.quantidade), 0);
    const totalPermutadas = tips.reduce((s, t) => s + n(t.unidades_permutadas), 0);
    const areaTotal = tips.reduce((s, t) => s + n(t.area_privativa_m2) * n(t.quantidade), 0);
    const totalVagas = tips.reduce((s, t) => s + n(t.vagas) * n(t.quantidade), 0);
    const areaPermutadaTotal = tips.reduce((s, t) => s + n(t.unidades_permutadas) * n(t.area_privativa_m2), 0);
    return html`
      <table class="tip">
        <colgroup>
          <col class="c-nome">
          ${lote ? nothing : html`<col class="c-tipo">`}
          <col class="c-area">
          ${lote ? nothing : html`<col class="c-dorm"><col class="c-vagas">`}
          <col class="c-un">
          <col class="c-perm">
          ${dis ? nothing : html`<col class="c-acao">`}
        </colgroup>
        <thead>
          <tr>
            <th>Nome</th>
            ${lote ? nothing : html`<th>Tipo</th>`}
            <th class="num">Área privativa</th>
            ${lote ? nothing : html`<th class="num">Dormitórios</th><th class="num">Vagas</th>`}
            <th class="num">Unidades</th>
            <th class="num">Un. permutadas</th>
            ${dis ? nothing : html`<th></th>`}
          </tr>
        </thead>
        <tbody>
          ${tips.map((t) => this._linha(t, lote, dis))}
          <tr class="total">
            <td>Total</td>
            ${lote ? nothing : html`<td></td>`}
            <td class="num">${fmtNum(areaTotal)} m²</td>
            ${lote ? nothing : html`<td></td><td class="num">${fmtNum(totalVagas)}</td>`}
            <td class="num">${fmtNum(totalUnidades)}</td>
            <td class="num">${fmtNum(totalPermutadas)} un · ${fmtNum(areaPermutadaTotal)} m²</td>
            ${dis ? nothing : html`<td></td>`}
          </tr>
        </tbody>
      </table>
    `;
  }

  private _linha(t: any, lote: boolean, dis: boolean): TemplateResult {
    const num = (campo: string, sufixo: string, casas = 2) => html`
      <viab-num sufixo=${sufixo} casas-decimais=${casas} ?desabilitado=${dis}
        .valor=${t[campo] !== null && t[campo] !== undefined ? Number(t[campo]) : null}
        @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(t, { [campo]: e.detail.valor })}
      ></viab-num>`;

    // #45 — texto calculado de permutadas (% e m²) ao lado do campo
    const qtd = n(t.quantidade);
    const perm = n(t.unidades_permutadas);
    const area = n(t.area_privativa_m2);
    const pctPerm = qtd > 0 ? ((perm / qtd) * 100).toFixed(1) : null;
    const m2Perm = area > 0 ? perm * area : null;

    return html`
      <tr>
        <td class="nome">
          <urbi-input ?desabilitado=${dis} .valor=${t.nome || ''}
            placeholder=${lote ? 'Lote' : 'Ex.: Studio'}
            @urbi:input-change=${(e: CustomEvent) => this._salvar(t, { nome: e.detail.valor })}
          ></urbi-input>
        </td>
        ${lote ? nothing : html`
          <td class="tipo">
            <urbi-select .valor=${t.tipo_unidade || 'apartamento'} .opcoes=${TIPOS_UNIDADE_INC}
              @urbi:select-change=${(e: CustomEvent) => this._salvar(t, { tipo_unidade: e.detail.valor })}
            ></urbi-select>
          </td>`}
        <td class="num">${num('area_privativa_m2', 'm²')}</td>
        ${lote ? nothing : html`
          <td class="num">${num('dormitorios', '', 0)}</td>
          <td class="num">${num('vagas', '', 0)}</td>`}
        <td class="num">${num('quantidade', '', 0)}</td>
        <td class="num">
          <div class="perm-wrap">
            ${num('unidades_permutadas', '', 0)}
            ${perm > 0 ? html`
              <div class="perm-calc">
                ${pctPerm !== null ? html`${pctPerm}%` : nothing}
                ${m2Perm !== null ? html`<br>${fmtNum(m2Perm)} m²` : nothing}
              </div>` : nothing}
          </div>
        </td>
        ${dis ? nothing : html`
          <td class="num">
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => { this.confirmRemover = t; }}>Remover</urbi-botao>
          </td>`}
      </tr>
    `;
  }

  // ── CRUD (catálogo — nível estudo) ──

  private _adicionar = async () => {
    try {
      const res = await criarTipologia(this.estudo.id, { ordem: this.tipologias.length });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar tipologia', 'erro'); return; }
      this.tipologias = [...this.tipologias, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar tipologia', 'erro');
    }
  };

  private async _salvar(t: any, dados: Record<string, any>) {
    try {
      const res = await atualizarTipologia(this.estudo.id, t.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.tipologias = this.tipologias.map((y) => (y.id === t.id ? { ...y, ...dados } : y));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private _renderConfirm(): TemplateResult {
    const c = this.confirmRemover!;
    return html`
      <urbi-modal title="Remover tipologia" maxWidth="420px" @urbi-modal:close=${() => this.confirmRemover = null}>
        <p>Remover a tipologia "${c?.nome || 'sem nome'}"?</p>
        <p class="sec">Não é possível remover uma tipologia com alocações de venda — remova as alocações primeiro.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <urbi-botao variante="secundario" @click=${() => this.confirmRemover = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmar}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmar = async () => {
    const c = this.confirmRemover!;
    this.confirmRemover = null;
    try {
      const res = await removerTipologia(this.estudo.id, c.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.tipologias = this.tipologias.filter((y) => y.id !== c.id);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };
}

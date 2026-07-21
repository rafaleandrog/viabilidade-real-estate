import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtNum } from './viab-format.js';
import {
  urbiVerso,
  listarReceitasAvancado, criarReceitaAvancado,
  criarTipologia, atualizarTipologia, removerTipologia,
} from './viabilidade-api.js';
import './viab-num.js';

// Sub-aba "Empreendimento → Tipologias" (nível Avançado · Lote 4 · #16).
//
// Catálogo consolidado de tipologias do estudo, transferido do antigo
// "Fluxo de Caixa → Receitas". As tipologias seguem VINCULADAS às linhas de
// receita (o modelo de catálogo desacoplado é do Lote 6 · #19, que exige spec
// conjunta) — aqui elas são apresentadas numa única tabela, com a linha de
// consolidado ao final. Adicionar a 1ª tipologia cria uma linha de receita
// padrão quando o estudo ainda não tem nenhuma.
//
// Colunas: Nome · Tipo · Área privativa · Dormitórios · Vagas · Unidades ·
// Unidades permutadas. Loteamento oculta Tipo/Dormitórios/Vagas (como na tela
// de Receitas). Nada aqui é usado pelo estudo Preliminar.

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

  @state() private linhas: any[] = [];
  @state() private carregando = true;
  @state() private confirmRemover: { linhaId: number; tip: any } | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    table.tip { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.tip th {
      text-align: left; font-weight: 600; padding: 8px 10px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-size: var(--texto-rotulo, 0.75rem);
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    table.tip th.num, table.tip td.num { text-align: right; }
    table.tip td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      font-size: var(--texto-corpo, 0.8125rem);
    }
    table.tip td viab-num { width: 92px; }
    table.tip td.nome urbi-input { width: 160px; }
    table.tip td.tipo urbi-select { min-width: 130px; }
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
      const receitas = await listarReceitasAvancado(this.estudo.id);
      if (!receitas?.erro) this.linhas = receitas.dados || [];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar tipologias', 'erro');
    }
    this.carregando = false;
  }

  /** Todas as tipologias do estudo (achatadas), com a linha de receita de origem. */
  private get _tipologias(): any[] {
    return this.linhas.flatMap((l) => (l.tipologias || []).map((t: any) => ({ ...t, _linhaId: l.id })));
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    if (this.carregando) return html`<urbi-loading mensagem="Carregando tipologias..."></urbi-loading>`;
    const lote = this.estudo?.tipo_empreendimento === 'loteamento';
    const tips = this._tipologias;
    return html`
      <urbi-card titulo="Tipologias do empreendimento">
        ${tips.length === 0 ? html`
          <div class="vazio">
            <urbi-estado-vazio icone="fa-solid fa-table-list"
              mensagem="Nenhuma tipologia cadastrada — adicione a primeira."></urbi-estado-vazio>
          </div>` : this._renderTabela(tips, lote)}

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
    return html`
      <table class="tip">
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
            <td class="num">${fmtNum(totalPermutadas)}</td>
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
        <td class="num">${num('unidades_permutadas', '', 0)}</td>
        ${dis ? nothing : html`
          <td class="num">
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => { this.confirmRemover = { linhaId: t._linhaId, tip: t }; }}>Remover</urbi-botao>
          </td>`}
      </tr>
    `;
  }

  // ── CRUD (tipologias seguem vinculadas a uma linha de receita) ──

  /** Garante uma linha de receita para pendurar tipologias; cria uma padrão se não houver. */
  private async _linhaAlvo(): Promise<any | null> {
    if (this.linhas.length > 0) return this.linhas[0];
    const res = await criarReceitaAvancado(this.estudo.id, { nome: 'Vendas' });
    if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar linha de receita', 'erro'); return null; }
    this.linhas = [...this.linhas, { ...res, tipologias: res.tipologias || [] }];
    return this.linhas[0];
  }

  private _adicionar = async () => {
    try {
      const alvo = await this._linhaAlvo();
      if (!alvo) return;
      const res = await criarTipologia(this.estudo.id, alvo.id, { ordem: (alvo.tipologias?.length ?? 0) });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar tipologia', 'erro'); return; }
      this.linhas = this.linhas.map((l) =>
        l.id === alvo.id ? { ...l, tipologias: [...(l.tipologias || []), res] } : l);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar tipologia', 'erro');
    }
  };

  private async _salvar(t: any, dados: Record<string, any>) {
    try {
      const res = await atualizarTipologia(this.estudo.id, t._linhaId, t.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.linhas = this.linhas.map((l) =>
        l.id === t._linhaId
          ? { ...l, tipologias: (l.tipologias || []).map((y: any) => (y.id === t.id ? { ...y, ...dados } : y)) }
          : l);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private _renderConfirm(): TemplateResult {
    const c = this.confirmRemover!;
    return html`
      <urbi-modal title="Remover tipologia" maxWidth="420px" @urbi-modal:close=${() => this.confirmRemover = null}>
        <p>Remover a tipologia "${c.tip?.nome || 'sem nome'}"?</p>
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
      const res = await removerTipologia(this.estudo.id, c.linhaId, c.tip.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.linhas = this.linhas.map((l) =>
        l.id === c.linhaId ? { ...l, tipologias: (l.tipologias || []).filter((y: any) => y.id !== c.tip.id) } : l);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };
}

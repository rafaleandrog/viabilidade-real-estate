import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtNum } from './viab-format.js';
import {
  urbiVerso,
  listarTipologiasCatalogo, criarTipologia, atualizarTipologia, removerTipologia,
  listarReceitasAvancado, listarCustosAvancado,
} from './viabilidade-api.js';
import { unidadesNaoAlocadasPorTipologia } from './fluxo-invariantes.js';
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
  // #331: rascunho local do Nome (padrão #51/#252) — digitar rápido não perde
  // caractere porque o round-trip do PATCH não reescreve `this.tipologias`
  // no meio da digitação; persiste só no clique em "Salvar". Os demais campos
  // (viab-num) não precisam disso: já mascaram o mesmo bug com `_rascunho` local.
  @state() private draftNome: Record<number, string> = {};
  // #340: só para calcular o aviso de unidades não alocadas — a tela não
  // edita nem exibe estes dados de outra forma.
  @state() private receitas: any[] = [];
  @state() private custosPermuta: any[] = [];
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
    /* Larguras por coluna (th e td herdadas do table-layout: fixed).
       #334: dimensionadas em "ch" (1ch = largura do dígito "0" na fonte) para
       casar direto com o pedido do autor — cabe exatamente o número de
       dígitos citado, sem sobra. Overhead fixo do viab-num (padding do
       input-wrap + borda ≈ 3ch) soma-se aos dígitos de cada coluna.

       #489 (Problema 1, 2026-08-24): "1ch" resolve contra a fonte COMPUTADA
       do elemento onde a largura é declarada — aqui, col. A folha não dava
       font-size a col, então ele herdava de table -> host -> :root =
       1rem (16px); o conteúdo renderiza em td a 0.8125rem (13px,
       --texto-corpo, linha 66 acima). As colunas ficavam dimensionadas
       para dígitos de 16px e preenchidas com dígitos de 13px — ~23% mais
       largas que o pedido do autor. Cada regra abaixo agora declara o MESMO
       font-size do td, para o ch resolver contra a fonte que de fato
       preenche a célula — a "alternativa aceitável" que a issue nomeia
       (mantém ch, iguala o font-size ao do td). Isto NÃO resolve o
       Problema 3 (a largura ainda muda entre as duas famílias de fonte do
       tema — Montserrat x Chakra Petch) nem o Problema 2 (cabeçalho
       cortado): os dois exigem medição por tema que o harness de render não
       faz hoje (Achados.variantes só carrega cor,
       scripts/render-check.d.mts) — ver o corpo do PR e o quadro vermelho
       da própria issue. */
    col.c-nome   { width: 150px; }
    col.c-tipo   { width: 160px; }
    col.c-area   { width: 16ch; font-size: var(--texto-corpo, 0.8125rem); }    /* 6 dígitos + milhar + decimais + sufixo "m²" */
    col.c-dorm   { width: 7ch; font-size: var(--texto-corpo, 0.8125rem); }     /* 2 dígitos */
    col.c-vagas  { width: 7ch; font-size: var(--texto-corpo, 0.8125rem); }     /* 2 dígitos */
    col.c-un     { width: 8ch; font-size: var(--texto-corpo, 0.8125rem); }     /* 4 dígitos (5 com separador de milhar em ≥1000) */
    col.c-areatot { width: 17ch; font-size: var(--texto-corpo, 0.8125rem); }   /* área privativa × unidades — tende a ser maior */
    col.c-acao   { width: 90px; }

    table.tip td.nome urbi-input { width: 100%; }
    table.tip td.tipo urbi-select { width: 148px; }
    table.tip td viab-num { width: 100%; }
    table.tip td.acoes .acoes-grupo { display: flex; gap: 4px; justify-content: flex-end; align-items: center; }

    tr.total td {
      font-weight: 700; border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.2));
      border-bottom: none; padding-top: 10px; font-size: 0.9rem;
    }
    .acoes-topo { margin-top: 16px; }
    .vazio { padding: 8px 0; }
    .aviso-lista { margin: 4px 0 0; padding-left: 20px; }
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
      const [r, receitas, custos] = await Promise.all([
        listarTipologiasCatalogo(this.estudo.id),
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
      ]);
      if (!r?.erro) this.tipologias = r.dados || [];
      if (!receitas?.erro) this.receitas = receitas.dados || [];
      if (!custos?.erro) this.custosPermuta = custos.dados || [];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar tipologias', 'erro');
    }
    this.carregando = false;
  }

  // #340: unidades do catálogo ainda não alocadas em Receitas nem
  // reservadas para permuta física — mesma conta do alerta PRODUTO_SUBALOCADO
  // da Reconciliação (fluxo-invariantes.ts), aqui como aviso local.
  private get _naoAlocadas() {
    return unidadesNaoAlocadasPorTipologia(this.receitas, this.custosPermuta, this.tipologias);
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
      ${this._renderAvisoNaoAlocadas()}
      ${this.confirmRemover ? this._renderConfirm() : nothing}
    `;
  }

  // #340: aviso, por tipologia, de quantas unidades ainda faltam ser
  // alocadas em grupos de Receitas — já descontando a permuta física.
  private _renderAvisoNaoAlocadas(): TemplateResult {
    const naoAlocadas = this._naoAlocadas;
    if (naoAlocadas.length === 0) return html`${nothing}`;
    return html`
      <urbi-banner variante="alerta">
        <strong>Unidades ainda não alocadas em Receitas:</strong>
        <ul class="aviso-lista">
          ${naoAlocadas.map((t) => html`
            <li>${t.nome}: ${fmtNum(t.naoAlocado)} de ${fmtNum(t.quantidadeTotal)}</li>`)}
        </ul>
      </urbi-banner>
    `;
  }

  private _renderTabela(tips: any[], lote: boolean): TemplateResult {
    const dis = !this.editavel;
    const totalUnidades = tips.reduce((s, t) => s + n(t.quantidade), 0);
    const areaTotal = tips.reduce((s, t) => s + n(t.area_privativa_m2) * n(t.quantidade), 0);
    const totalVagas = tips.reduce((s, t) => s + n(t.vagas) * n(t.quantidade), 0);
    return html`
      <table class="tip">
        <colgroup>
          <col class="c-nome">
          ${lote ? nothing : html`<col class="c-tipo">`}
          <col class="c-area">
          ${lote ? nothing : html`<col class="c-dorm"><col class="c-vagas">`}
          <col class="c-un">
          <col class="c-areatot">
          ${dis ? nothing : html`<col class="c-acao">`}
        </colgroup>
        <thead>
          <tr>
            <th>Nome</th>
            ${lote ? nothing : html`<th>Tipo</th>`}
            <th class="num">Área privativa</th>
            ${lote ? nothing : html`<th class="num">Dormitórios</th><th class="num">Vagas</th>`}
            <th class="num">Unidades</th>
            <th class="num">Área total</th>
            ${dis ? nothing : html`<th></th>`}
          </tr>
        </thead>
        <tbody>
          ${tips.map((t) => this._linha(t, lote, dis))}
          <tr class="total">
            <td>Total</td>
            ${lote ? nothing : html`<td></td>`}
            <td class="num"></td>
            ${lote ? nothing : html`<td></td><td class="num">${fmtNum(totalVagas)}</td>`}
            <td class="num">${fmtNum(totalUnidades)}</td>
            <td class="num">${fmtNum(areaTotal)} m²</td>
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

    const nomeSujo = this._nomeSujo(t);
    return html`
      <tr>
        <td class="nome">
          <urbi-input ?desabilitado=${dis} .valor=${this.draftNome[t.id] ?? (t.nome || '')}
            placeholder=${lote ? 'Lote' : 'Ex.: Studio'}
            @urbi:input-change=${(e: CustomEvent) => this._editarNome(t, e.detail.valor)}
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
        <td class="num">${fmtNum(n(t.area_privativa_m2) * n(t.quantidade))} m²</td>
        ${dis ? nothing : html`
          <td class="num acoes">
            <div class="acoes-grupo">
              ${nomeSujo ? html`
                <urbi-botao variante="primario" pequeno icone="fa-solid fa-check" title="Salvar nome"
                  @click=${() => this._salvarNome(t)}></urbi-botao>` : nothing}
              <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
                @click=${() => { this.confirmRemover = t; }}></urbi-botao>
            </div>
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

  // #331: edição do Nome fica só no rascunho local — nenhum PATCH por tecla.
  private _editarNome(t: any, valor: string) {
    this.draftNome = { ...this.draftNome, [t.id]: valor };
  }

  private _nomeSujo(t: any): boolean {
    const d = this.draftNome[t.id];
    return d !== undefined && d !== (t.nome || '');
  }

  private async _salvarNome(t: any) {
    const valor = this.draftNome[t.id];
    if (valor === undefined) return;
    await this._salvar(t, { nome: valor });
    const { [t.id]: _descartado, ...resto } = this.draftNome;
    this.draftNome = resto;
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

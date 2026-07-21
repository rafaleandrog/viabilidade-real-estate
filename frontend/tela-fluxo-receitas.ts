import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import {
  rotuloPeriodo, rotuloMesRelativo, absorcaoMensal, faixasAbsorcao, pctPosObraDerivado,
  type EventoCrono,
} from './fluxo-shared.js';
import { pctRepasseDerivado } from './fluxo-caixa-motor.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarFasesAvancado, criarFaseAvancado, atualizarFaseAvancado, removerFaseAvancado,
  listarTipologiasCatalogo,
  criarAlocacao, atualizarAlocacao, removerAlocacao,
} from './viabilidade-api.js';
import './viab-num.js';

// Sub-aba "Viabilidade → Receitas" (nível Avançado · Lote 6 · #19 #20 #21).
//
// Modelo: um card por FASE. Cada fase é dona da Absorção de Vendas e do Fluxo
// de Pagamento (modais). Dentro da fase, uma tabela de ALOCAÇÕES de venda: cada
// linha escolhe uma tipologia do catálogo (Empreendimento → Tipologias), define
// unidades e preço/m². Ao esgotar as unidades da tipologia na fase, ela some das
// opções de novas linhas (trava de saldo por fase). Nada aqui é usado pelo
// estudo Preliminar.

const n = (v: any): number => Number(v) || 0;

const PERIODICIDADES = ['mensal', 'trimestral', 'semestral', 'anual'];
const ROTULO_PER: Record<string, string> = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };

@customElement('viab-fluxo-receitas')
export class ViabFluxoReceitas extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private fases: any[] = [];
  @state() private tipologias: any[] = [];      // catálogo do estudo
  @state() private carregando = true;
  @state() private crono: EventoCrono[] = [];
  @state() private dataInicio: string | null = null;
  @state() private confirmRemover: { tipo: 'fase' | 'alocacao'; fase: any; aloc?: any } | null = null;

  // Modais
  @state() private modalAbs: any = null;      // fase em edição
  @state() private absForm: any = null;
  @state() private modalPag: any = null;
  @state() private pagForm: any = null;
  @state() private modalErro = '';
  @state() private aplicando = false;

  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .cards { display: flex; flex-direction: column; gap: 16px; }
    .card-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-cab urbi-input.nome { width: 200px; }
    .card-cab .espaco { flex: 1; }
    table.aloc { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.aloc th {
      text-align: left; font-weight: 600; padding: 7px 8px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem);
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    table.aloc th.num, table.aloc td.num { text-align: right; }
    table.aloc td {
      padding: 5px 8px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      font-size: var(--texto-corpo, 0.8125rem);
    }
    table.aloc td viab-num { width: 96px; }
    table.aloc td.tipo urbi-select { min-width: 150px; }
    .saldo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.7rem); }
    .saldo.zero { color: var(--cor-erro, #d45a3a); }
    .rodape-tip { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-top: 10px; }
    .rodape-tip .espaco { flex: 1; }
    .total-rotulo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem); margin-right: 6px; }
    .total-valor { font-weight: 600; font-variant-numeric: tabular-nums; }
    .add-linha { margin-top: 16px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
    .aviso-cat { padding: 8px 0; }

    /* Modal de absorção */
    .abs-grid { display: grid; grid-template-columns: 1fr 300px; gap: 16px; }
    @media (max-width: 760px) { .abs-grid { grid-template-columns: 1fr; } }
    .abs-grafico svg { display: block; width: 100%; height: auto; }
    table.abs { width: 100%; border-collapse: collapse; }
    table.abs td, table.abs th {
      padding: 6px; font-size: var(--texto-corpo, 0.8125rem);
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); text-align: left;
    }
    table.abs viab-num { width: 110px; }
    .derivado { font-weight: 600; font-variant-numeric: tabular-nums; }
    .modal-rodape { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .modal-rodape .espaco { flex: 1; }
    .badges-par { display: inline-flex; gap: 6px; }

    /* Modal de pagamento */
    .pag-grid { display: grid; grid-template-columns: 240px 1fr; gap: 16px; }
    @media (max-width: 760px) { .pag-grid { grid-template-columns: 1fr; } }
    .pag-secao { margin-bottom: 14px; }
    .pag-secao h4 {
      margin: 0 0 8px; font-size: var(--texto-rotulo, 0.75rem); letter-spacing: 0.04em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase;
    }
    .pag-linha { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
    .pag-linha viab-num { width: 120px; }
    .repasse-box {
      padding: 10px 12px; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12)); border-radius: 8px;
      background: var(--cor-superficie-hover, rgba(255,255,255,0.03));
    }
    .repasse-box .derivado { font-size: 1.05rem; }
  `];

  updated() {
    if (this.estudo?.id && !this.carregado) {
      this.carregado = true;
      this._carregar();
    }
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const [fases, tipologias, crono, params] = await Promise.all([
        listarFasesAvancado(this.estudo.id),
        listarTipologiasCatalogo(this.estudo.id),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
      ]);
      if (!fases?.erro) this.fases = fases.dados || [];
      if (!tipologias?.erro) this.tipologias = tipologias.dados || [];
      if (!crono?.erro) this.crono = crono.dados || [];
      if (!params?.erro) this.dataInicio = params.data_inicio_projeto ?? null;
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar receitas', 'erro');
    }
    this.carregando = false;
  }

  private _tip(id: any): any {
    return this.tipologias.find((t) => Number(t.id) === Number(id));
  }

  /** Saldo de unidades de uma tipologia numa fase = quantidade − Σ alocado (ignorando 1 alocação). */
  private _saldo(fase: any, tipologiaId: any, ignorarAlocId?: any): number {
    const tip = this._tip(tipologiaId);
    if (!tip) return 0;
    const usado = (fase.alocacoes || [])
      .filter((a: any) => Number(a.tipologia_id) === Number(tipologiaId) && Number(a.id) !== Number(ignorarAlocId))
      .reduce((s: number, a: any) => s + n(a.unidades), 0);
    return n(tip.quantidade) - usado;
  }

  private _vgvFase(fase: any): number {
    return (fase.alocacoes || []).reduce((s: number, a: any) => {
      const tip = this._tip(a.tipologia_id);
      return s + n(a.unidades) * n(tip?.area_privativa_m2) * n(a.preco_m2);
    }, 0);
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando receitas..."></urbi-loading>`;
    const semCatalogo = this.tipologias.length === 0;
    return html`
      ${semCatalogo ? html`
        <div class="aviso-cat">
          <urbi-banner variante="info">
            Nenhuma tipologia no catálogo. Cadastre as tipologias em <b>Empreendimento → Tipologias</b> antes de alocar vendas.
          </urbi-banner>
        </div>` : nothing}
      ${this.fases.length === 0 ? html`
        <urbi-estado-vazio icone="fa-solid fa-layer-group" mensagem="Nenhuma fase definida"></urbi-estado-vazio>` : nothing}
      <div class="cards">
        ${this.fases.map((f) => this._renderFase(f))}
      </div>
      ${this.editavel ? html`
        <div class="add-linha">
          <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionarFase}>
            Adicionar Fase
          </urbi-botao>
        </div>` : nothing}
      ${this.modalAbs ? this._renderModalAbsorcao() : nothing}
      ${this.modalPag ? this._renderModalPagamento() : nothing}
      ${this.confirmRemover ? this._renderConfirmRemover() : nothing}
    `;
  }

  // ── Card da fase ──

  private _renderFase(f: any): TemplateResult {
    const dis = !this.editavel;
    const vgv = this._vgvFase(f);
    return html`
      <urbi-card>
        <div class="card-cab">
          <urbi-input class="nome" ?desabilitado=${dis} .valor=${f.nome || ''}
            placeholder="Nome da fase"
            @urbi:input-change=${(e: CustomEvent) => this._salvarFase(f, { nome: e.detail.valor })}
          ></urbi-input>
          <span class="espaco"></span>
          <urbi-botao variante="secundario" pequeno @click=${() => this._abrirAbsorcao(f)}>Absorção de Vendas</urbi-botao>
          <urbi-botao variante="secundario" pequeno @click=${() => this._abrirPagamento(f)}>Fluxo de Pagamento</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => { this.confirmRemover = { tipo: 'fase', fase: f }; }}>Remover</urbi-botao>` : nothing}
        </div>

        ${this._renderTabelaAlocacoes(f, dis)}

        <div class="rodape-tip">
          ${!dis ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
              ?desabilitado=${this._tipologiasDisponiveis(f).length === 0}
              @click=${() => this._adicionarAlocacao(f)}>Adicionar Alocação</urbi-botao>` : nothing}
          <span class="espaco"></span>
          <span><span class="total-rotulo">VGV da fase</span><span class="total-valor">${fmtR$(vgv)}</span></span>
        </div>
      </urbi-card>
    `;
  }

  /** Tipologias com saldo > 0 na fase (para novas alocações). */
  private _tipologiasDisponiveis(fase: any): any[] {
    return this.tipologias.filter((t) => this._saldo(fase, t.id) > 0);
  }

  private _renderTabelaAlocacoes(f: any, dis: boolean): TemplateResult {
    const alocacoes = f.alocacoes || [];
    if (alocacoes.length === 0) {
      return html`<p class="sec">Nenhuma alocação — adicione a primeira.</p>`;
    }
    const lote = this.estudo?.tipo_empreendimento === 'loteamento';
    return html`
      <table class="aloc">
        <thead>
          <tr>
            <th>${lote ? 'Lote' : 'Tipologia'}</th>
            <th class="num">Área privativa</th>
            <th class="num">Unidades</th>
            <th class="num">Saldo</th>
            <th class="num">Preço / m²</th>
            <th class="num">Preço unitário</th>
            <th class="num">Preço total</th>
            ${dis ? nothing : html`<th></th>`}
          </tr>
        </thead>
        <tbody>
          ${alocacoes.map((a: any) => this._renderAlocacao(f, a, dis))}
        </tbody>
      </table>
    `;
  }

  private _renderAlocacao(f: any, a: any, dis: boolean): TemplateResult {
    const tip = this._tip(a.tipologia_id);
    const area = n(tip?.area_privativa_m2);
    const precoUnit = area * n(a.preco_m2);
    const precoTotal = precoUnit * n(a.unidades);
    const saldo = this._saldo(f, a.tipologia_id, a.id);
    // Opções: tipologias com saldo (na fase) + a atual (sempre presente).
    const opcoes = this.tipologias
      .filter((t) => Number(t.id) === Number(a.tipologia_id) || this._saldo(f, t.id) > 0)
      .map((t) => ({ valor: String(t.id), rotulo: t.nome || 'Sem nome' }));
    return html`
      <tr>
        <td class="tipo">
          <urbi-select .valor=${String(a.tipologia_id)} .opcoes=${opcoes} ?desabilitado=${dis}
            @urbi:select-change=${(e: CustomEvent) => this._salvarAlocacao(f, a, { tipologia_id: Number(e.detail.valor) })}
          ></urbi-select>
        </td>
        <td class="num">${area ? `${area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : '—'}</td>
        <td class="num">
          <viab-num casas-decimais="0" ?desabilitado=${dis}
            .valor=${a.unidades !== null && a.unidades !== undefined ? Number(a.unidades) : null}
            @urbi:input-numero-change=${(e: CustomEvent) => this._salvarAlocacao(f, a, { unidades: e.detail.valor ?? 0 })}
          ></viab-num>
        </td>
        <td class="num"><span class="saldo ${saldo <= 0 ? 'zero' : ''}">${saldo}</span></td>
        <td class="num">
          <viab-num sufixo="R$/m²" ?desabilitado=${dis}
            .valor=${a.preco_m2 !== null && a.preco_m2 !== undefined ? Number(a.preco_m2) : null}
            @urbi:input-numero-change=${(e: CustomEvent) => this._salvarAlocacao(f, a, { preco_m2: e.detail.valor ?? 0 })}
          ></viab-num>
        </td>
        <td class="num">${fmtR$(precoUnit)}</td>
        <td class="num">${fmtR$(precoTotal)}</td>
        ${dis ? nothing : html`
          <td class="num">
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => { this.confirmRemover = { tipo: 'alocacao', fase: f, aloc: a }; }}>Remover</urbi-botao>
          </td>`}
      </tr>
    `;
  }

  // ── CRUD ──

  private _adicionarFase = async () => {
    try {
      const res = await criarFaseAvancado(this.estudo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar fase', 'erro'); return; }
      this.fases = [...this.fases, { ...res, alocacoes: res.alocacoes || [] }];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar fase', 'erro');
    }
  };

  private async _salvarFase(f: any, dados: Record<string, any>) {
    try {
      const res = await atualizarFaseAvancado(this.estudo.id, f.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.fases = this.fases.map((x) => (x.id === f.id ? { ...x, ...dados } : x));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private async _adicionarAlocacao(f: any) {
    const disponiveis = this._tipologiasDisponiveis(f);
    if (disponiveis.length === 0) { urbiVerso.notificar('Sem tipologias com saldo nesta fase.', 'alerta'); return; }
    try {
      const res = await criarAlocacao(this.estudo.id, f.id, { tipologia_id: disponiveis[0].id, unidades: 0 });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar alocação', 'erro'); return; }
      this.fases = this.fases.map((x) =>
        x.id === f.id ? { ...x, alocacoes: [...(x.alocacoes || []), res] } : x);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar alocação', 'erro');
    }
  }

  private async _salvarAlocacao(f: any, a: any, dados: Record<string, any>) {
    try {
      const res = await atualizarAlocacao(this.estudo.id, f.id, a.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.fases = this.fases.map((x) =>
        x.id === f.id
          ? { ...x, alocacoes: x.alocacoes.map((y: any) => (y.id === a.id ? { ...y, ...dados } : y)) }
          : x);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private _renderConfirmRemover(): TemplateResult {
    const c = this.confirmRemover!;
    const rotulo = c.tipo === 'fase'
      ? `a fase "${c.fase.nome || 'sem nome'}" e todas as suas alocações`
      : `a alocação de "${this._tip(c.aloc?.tipologia_id)?.nome || 'tipologia'}"`;
    return html`
      <urbi-modal title="Remover" maxWidth="420px" @urbi-modal:close=${() => this.confirmRemover = null}>
        <p>Remover ${rotulo}?</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.confirmRemover = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemocao}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmarRemocao = async () => {
    const c = this.confirmRemover!;
    this.confirmRemover = null;
    try {
      if (c.tipo === 'fase') {
        const res = await removerFaseAvancado(this.estudo.id, c.fase.id);
        if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
        this.fases = this.fases.filter((x) => x.id !== c.fase.id);
      } else {
        const res = await removerAlocacao(this.estudo.id, c.fase.id, c.aloc.id);
        if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
        this.fases = this.fases.map((x) =>
          x.id === c.fase.id ? { ...x, alocacoes: x.alocacoes.filter((y: any) => y.id !== c.aloc.id) } : x);
      }
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal "Absorção de Vendas" (Distribuído — 3 períodos; pós-obra derivado)
  // ─────────────────────────────────────────────────────────────────

  private _abrirAbsorcao(f: any) {
    const a = f.absorcao || {};
    const blocos = Array.isArray(a.blocos) ? a.blocos : [];
    const pct = (ev: string) => Number((blocos.find((b: any) => b?.evento === ev) || {}).pct) || 0;
    this.absForm = {
      correcao_estoque: Boolean(a.correcao_estoque),
      lancamento_pct: pct('lancamento'),
      obra_pct: pct('obra'),
    };
    this.modalErro = '';
    this.modalAbs = f;
  }

  private _absorcaoJson(): any {
    const f = this.absForm;
    return {
      modo: 'distribuido',
      correcao_estoque: f.correcao_estoque,
      blocos: [
        { evento: 'lancamento', pct: n(f.lancamento_pct) },
        { evento: 'obra', pct: n(f.obra_pct) },
        { evento: 'pos_obra', pct: 0 }, // derivado no motor
      ],
    };
  }

  private _renderModalAbsorcao(): TemplateResult {
    const f = this.absForm;
    const dis = !this.editavel;
    const faixas = faixasAbsorcao(this.crono);
    const posDerivado = pctPosObraDerivado(this._absorcaoJson().blocos);
    const rot = (fx?: { inicio: number; fim: number }) =>
      fx ? rotuloPeriodo(this.dataInicio, fx.inicio, fx.fim - fx.inicio + 1) : '—';
    return html`
      <urbi-modal title="Absorção de vendas" maxWidth="820px" @urbi-modal:close=${() => this.modalAbs = null}>
        <p class="sec">Distribuído em 3 períodos (o Pós-obra é calculado automaticamente). Os períodos vêm do Cronograma.</p>
        <div class="abs-grid">
          <div>
            <table class="abs">
              <thead><tr><th>Período</th><th>% Vendido</th></tr></thead>
              <tbody>
                <tr>
                  <td>Pré-lançamento + Lançamento<br /><span class="sec">${rot(faixas?.prelancamento)}</span></td>
                  <td><viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.lancamento_pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, lancamento_pct: e.detail.valor ?? 0 }}></viab-num></td>
                </tr>
                <tr>
                  <td>Durante a obra<br /><span class="sec">${rot(faixas?.obra)}</span></td>
                  <td><viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.obra_pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, obra_pct: e.detail.valor ?? 0 }}></viab-num></td>
                </tr>
                <tr>
                  <td>Pós-obra <span class="sec">(calculado)</span><br /><span class="sec">${rot(faixas?.pos_obra)}</span></td>
                  <td><span class="derivado">${posDerivado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="abs-grafico">${this._graficoAbsorcao()}</div>
        </div>

        ${this.modalErro ? html`<urbi-banner variante="erro">${this.modalErro}</urbi-banner>` : nothing}

        <div class="modal-rodape">
          <span class="sec">Correção de estoque</span>
          <span class="badges-par">
            <urbi-badge cor="info" interativo ?ativo=${!f.correcao_estoque}
              @click=${() => { if (!dis) this.absForm = { ...f, correcao_estoque: false }; }}>Não</urbi-badge>
            <urbi-badge cor="info" interativo ?ativo=${f.correcao_estoque}
              @click=${() => { if (!dis) this.absForm = { ...f, correcao_estoque: true }; }}>Sim</urbi-badge>
          </span>
          <span class="espaco"></span>
          <urbi-botao variante="secundario" @click=${() => this.modalAbs = null}>Cancelar</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="primario" ?carregando=${this.aplicando} @click=${this._aplicarAbsorcao}>Aplicar</urbi-botao>` : nothing}
        </div>
      </urbi-modal>
    `;
  }

  /** Gráfico de absorção acumulada (SVG linha + área). */
  private _graficoAbsorcao(): TemplateResult {
    const r = absorcaoMensal(this._absorcaoJson(), this.crono);
    if (!r || r.pcts.length === 0) {
      return html`<p class="sec">Defina o cronograma para visualizar a absorção.</p>`;
    }
    const W = 420; const H = 240; const padL = 34; const padB = 22; const padT = 10; const padR = 8;
    const gw = W - padL - padR; const gh = H - padT - padB;
    let acc = 0;
    const acum = r.pcts.map((p) => { acc += p; return Math.min(acc, 100); });
    const nPts = acum.length;
    const x = (i: number) => padL + (nPts <= 1 ? 0 : (i / (nPts - 1)) * gw);
    const y = (v: number) => padT + (1 - v / 100) * gh;
    const linha = acum.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${linha} L${x(nPts - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
    const corLinha = 'var(--cor-primaria-solida, #7a5af8)';
    const corTexto = 'var(--cor-texto-sec, #8a8f98)';
    const ticksY = [0, 25, 50, 75, 100];
    const passoX = Math.max(1, Math.round(nPts / 6));
    const ticksX: number[] = [];
    for (let i = 0; i < nPts; i += passoX) ticksX.push(i);
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Absorção acumulada">
        ${ticksY.map((t) => svg`
          <line x1=${padL} y1=${y(t)} x2=${W - padR} y2=${y(t)} stroke="var(--cor-borda-sutil, rgba(128,128,128,0.2))" stroke-width="1" />
          <text x=${padL - 6} y=${y(t) + 3} font-size="9" fill=${corTexto} text-anchor="end">${t}%</text>`)}
        ${ticksX.map((i) => svg`
          <text x=${x(i)} y=${H - 6} font-size="9" fill=${corTexto} text-anchor="middle">
            ${rotuloMesRelativo(this.dataInicio, r.inicio + i)}
          </text>`)}
        <path d=${area} fill=${corLinha} opacity="0.12" />
        <path d=${linha} fill="none" stroke=${corLinha} stroke-width="2" />
      </svg>
    `;
  }

  private _aplicarAbsorcao = async () => {
    this.aplicando = true;
    this.modalErro = '';
    try {
      const json = this._absorcaoJson();
      const res = await atualizarFaseAvancado(this.estudo.id, this.modalAbs.id, { absorcao: json });
      if (res?.erro) { this.modalErro = res.mensagem || 'Erro ao aplicar'; return; }
      this.fases = this.fases.map((x) => (x.id === this.modalAbs.id ? { ...x, absorcao: json } : x));
      this.modalAbs = null;
      urbiVerso.notificar('Absorção de vendas aplicada.', 'sucesso');
    } catch (e: any) {
      this.modalErro = e?.message || 'Erro ao aplicar';
    } finally {
      this.aplicando = false;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal "Fluxo de Pagamento" (multi-linha; Repasse derivado)
  // ─────────────────────────────────────────────────────────────────

  private _abrirPagamento(f: any) {
    const fp = f.fluxo_pagamento || {};
    const arr = (v: any) => Array.isArray(v) ? v.map((x) => ({ ...x })) : (v ? [{ ...v }] : []);
    this.pagForm = {
      comissao: { ativo: fp.comissao?.ativo ?? true, tipo: fp.comissao?.tipo ?? 'embutida', pct: n(fp.comissao?.pct) },
      ret: { ativo: fp.ret?.ativo ?? false, pct: n(fp.ret?.pct) },
      entrada: arr(fp.entrada).length ? arr(fp.entrada) : [{ pct: 15, parcelas: 1 }],
      parcelas: arr(fp.parcelas).length ? arr(fp.parcelas) : [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 15 }],
      repasse: { apos_entrega_meses: n(fp.repasse?.apos_entrega_meses) },
    };
    this.modalErro = '';
    this.modalPag = f;
  }

  private _setPag(caminho: string, campo: string, valor: any) {
    const f = this.pagForm;
    this.pagForm = { ...f, [caminho]: { ...f[caminho], [campo]: valor } };
  }

  private _setLinha(bloco: 'entrada' | 'parcelas', i: number, campo: string, valor: any) {
    const f = this.pagForm;
    const linhas = f[bloco].map((x: any, j: number) => (j === i ? { ...x, [campo]: valor } : x));
    this.pagForm = { ...f, [bloco]: linhas };
  }

  private _addLinha(bloco: 'entrada' | 'parcelas') {
    const f = this.pagForm;
    const nova = bloco === 'entrada'
      ? { pct: 0, parcelas: 1 }
      : { periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, juros: false, pct: 0 };
    this.pagForm = { ...f, [bloco]: [...f[bloco], nova] };
  }

  private _delLinha(bloco: 'entrada' | 'parcelas', i: number) {
    const f = this.pagForm;
    this.pagForm = { ...f, [bloco]: f[bloco].filter((_: any, j: number) => j !== i) };
  }

  private _renderModalPagamento(): TemplateResult {
    const f = this.pagForm;
    const dis = !this.editavel;
    const repasse = pctRepasseDerivado(f);
    return html`
      <urbi-modal title="Fluxo de pagamento" maxWidth="860px" @urbi-modal:close=${() => this.modalPag = null}>
        <div class="pag-grid">
          <div>
            <div class="pag-secao">
              <h4>Definições</h4>
              <div class="pag-linha">
                <urbi-checkbox label="Comissão" ?desabilitado=${dis} ?marcado=${f.comissao.ativo}
                  @urbi:checkbox-change=${(e: CustomEvent) => this._setPag('comissao', 'ativo', e.detail.marcado)}></urbi-checkbox>
              </div>
              ${f.comissao.ativo ? html`
                <div class="pag-linha">
                  <span class="badges-par">
                    <urbi-badge cor="info" interativo ?ativo=${f.comissao.tipo === 'destacada'}
                      @click=${() => { if (!dis) this._setPag('comissao', 'tipo', 'destacada'); }}>Destacada</urbi-badge>
                    <urbi-badge cor="info" interativo ?ativo=${f.comissao.tipo === 'embutida'}
                      @click=${() => { if (!dis) this._setPag('comissao', 'tipo', 'embutida'); }}>Embutida</urbi-badge>
                  </span>
                  <viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.comissao.pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this._setPag('comissao', 'pct', e.detail.valor ?? 0)}></viab-num>
                </div>
                <p class="sec">${f.comissao.tipo === 'embutida'
                  ? 'Embutida: já está no preço de venda (não deduz do VGV).'
                  : 'Destacada: custo adicional (deduz do VGV).'}</p>` : nothing}
              <div class="pag-linha">
                <urbi-checkbox label="RET" ?desabilitado=${dis} ?marcado=${f.ret.ativo}
                  @urbi:checkbox-change=${(e: CustomEvent) => this._setPag('ret', 'ativo', e.detail.marcado)}></urbi-checkbox>
                ${f.ret.ativo ? html`
                  <viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.ret.pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this._setPag('ret', 'pct', e.detail.valor ?? 0)}></viab-num>` : nothing}
              </div>
              ${f.ret.ativo ? html`<p class="sec">Regime Especial de Tributação — patrimônio de afetação.</p>` : nothing}
            </div>
          </div>
          <div>
            <div class="pag-secao">
              <h4>Condições de entrada</h4>
              ${f.entrada.map((e: any, i: number) => html`
                <div class="pag-linha">
                  <viab-num label="% do total" sufixo="%" ?desabilitado=${dis} .valor=${e.pct}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('entrada', i, 'pct', ev.detail.valor ?? 0)}></viab-num>
                  <viab-num label="Nº parcelas" sufixo="x" casas-decimais="0" ?desabilitado=${dis} .valor=${e.parcelas}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('entrada', i, 'parcelas', ev.detail.valor ?? 1)}></viab-num>
                  ${!dis && f.entrada.length > 1 ? html`
                    <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-xmark"
                      @click=${() => this._delLinha('entrada', i)}></urbi-botao>` : nothing}
                </div>`)}
              ${!dis ? html`
                <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
                  @click=${() => this._addLinha('entrada')}>Adicionar entrada</urbi-botao>` : nothing}
            </div>
            <div class="pag-secao">
              <h4>Parcelamento</h4>
              ${f.parcelas.map((p: any, i: number) => html`
                <div class="pag-linha">
                  <viab-num label="% do total" sufixo="%" ?desabilitado=${dis} .valor=${p.pct}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'pct', ev.detail.valor ?? 0)}></viab-num>
                  <span class="badges-par">
                    ${PERIODICIDADES.map((per) => html`
                      <urbi-badge cor="info" interativo ?ativo=${p.periodicidade === per}
                        @click=${() => { if (!dis) this._setLinha('parcelas', i, 'periodicidade', per); }}>${ROTULO_PER[per]}</urbi-badge>`)}
                  </span>
                  <viab-num label="Nº parcelas" sufixo="x" casas-decimais="0"
                    ?desabilitado=${dis || p.ao_longo_obra} .valor=${p.parcelas}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'parcelas', ev.detail.valor ?? 0)}></viab-num>
                  <urbi-checkbox label="Ao longo da obra" ?desabilitado=${dis} ?marcado=${p.ao_longo_obra}
                    @urbi:checkbox-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'ao_longo_obra', ev.detail.marcado)}></urbi-checkbox>
                  ${!dis && f.parcelas.length > 1 ? html`
                    <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-xmark"
                      @click=${() => this._delLinha('parcelas', i)}></urbi-botao>` : nothing}
                </div>`)}
              ${!dis ? html`
                <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
                  @click=${() => this._addLinha('parcelas')}>Adicionar parcelamento</urbi-botao>` : nothing}
            </div>
            <div class="pag-secao">
              <h4>Repasse</h4>
              <div class="pag-linha">
                <div class="repasse-box">
                  <span class="sec">Repasse (calculado)</span><br />
                  <span class="derivado">${repasse.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                </div>
                <viab-num label="Após entrega" sufixo="meses" casas-decimais="0" ?desabilitado=${dis} .valor=${f.repasse.apos_entrega_meses}
                  @urbi:input-numero-change=${(e: CustomEvent) => this._setPag('repasse', 'apos_entrega_meses', e.detail.valor ?? 0)}></viab-num>
              </div>
              <p class="sec">Repasse = 100% − entradas − parcelas.</p>
            </div>
          </div>
        </div>

        ${this.modalErro ? html`<urbi-banner variante="erro">${this.modalErro}</urbi-banner>` : nothing}

        <div class="modal-rodape">
          <span class="espaco"></span>
          <urbi-botao variante="secundario" @click=${() => this.modalPag = null}>Cancelar</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="primario" ?carregando=${this.aplicando} @click=${this._aplicarPagamento}>Aplicar</urbi-botao>` : nothing}
        </div>
      </urbi-modal>
    `;
  }

  private _aplicarPagamento = async () => {
    this.aplicando = true;
    this.modalErro = '';
    try {
      const res = await atualizarFaseAvancado(this.estudo.id, this.modalPag.id, { fluxo_pagamento: this.pagForm });
      if (res?.erro) { this.modalErro = res.mensagem || 'Erro ao aplicar'; return; }
      this.fases = this.fases.map((x) => (x.id === this.modalPag.id ? { ...x, fluxo_pagamento: this.pagForm } : x));
      this.modalPag = null;
      urbiVerso.notificar('Fluxo de pagamento aplicado.', 'sucesso');
    } catch (e: any) {
      this.modalErro = e?.message || 'Erro ao aplicar';
    } finally {
      this.aplicando = false;
    }
  };
}

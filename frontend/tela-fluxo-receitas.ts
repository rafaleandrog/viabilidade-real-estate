import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import {
  rotuloPeriodo, rotuloMesRelativo,
  vgvLinha, vglLinha, absorcaoMensal, type EventoCrono,
} from './fluxo-shared.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, criarReceitaAvancado, atualizarReceitaAvancado, removerReceitaAvancado,
  criarTipologia, atualizarTipologia, removerTipologia,
} from './viabilidade-api.js';
import './viab-num.js';

// Sub-tela "Receitas" do Fluxo de Caixa (nível Avançado): um card por Linha de
// Receita com tabela de tipologias inline + modais de Absorção de Vendas e
// Fluxo de Pagamento. Nada aqui é usado pelo estudo Preliminar.

const TIPOS_UNIDADE_INC = [
  { valor: 'apartamento', rotulo: 'Apartamento' },
  { valor: 'cobertura', rotulo: 'Cobertura' },
  { valor: 'loja', rotulo: 'Loja' },
  { valor: 'outro', rotulo: 'Outro' },
];

@customElement('viab-fluxo-receitas')
export class ViabFluxoReceitas extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private linhas: any[] = [];
  @state() private carregando = true;
  @state() private crono: EventoCrono[] = [];
  @state() private dataInicio: string | null = null;
  @state() private confirmRemover: { tipo: 'linha' | 'tipologia'; linha: any; tip?: any } | null = null;

  // Modais
  @state() private modalAbs: any = null;      // linha de receita em edição
  @state() private absForm: any = null;
  @state() private modalPag: any = null;
  @state() private pagForm: any = null;
  @state() private modalErro = '';
  @state() private aplicando = false;

  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .cards { display: flex; flex-direction: column; gap: 16px; }
    .card-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-cab urbi-input.nome { width: 180px; }
    .card-cab urbi-input.fase { width: 90px; }
    .card-cab .espaco { flex: 1; }
    .rodape-tip { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-top: 10px; }
    .rodape-tip .espaco { flex: 1; }
    .total-rotulo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem); margin-right: 6px; }
    .total-valor { font-weight: 600; font-variant-numeric: tabular-nums; }
    .add-linha { margin-top: 16px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }

    /* Modal de absorção — 3 colunas */
    .abs-grid { display: grid; grid-template-columns: 180px 1fr 260px; gap: 16px; }
    @media (max-width: 860px) { .abs-grid { grid-template-columns: 1fr; } }
    .abs-opcao {
      border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
      border-radius: 8px; padding: 10px 12px; cursor: pointer; margin-bottom: 8px;
    }
    .abs-opcao.ativa { border-color: var(--cor-primaria-solida, #7a5af8); background: var(--cor-superficie-hover, rgba(255,255,255,0.04)); }
    .abs-opcao h4 { margin: 0 0 4px; font-size: var(--texto-corpo, 0.8125rem); }
    .abs-opcao p { margin: 0; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .abs-grafico svg { display: block; width: 100%; height: auto; }
    table.abs { width: 100%; border-collapse: collapse; }
    table.abs td, table.abs th {
      padding: 5px 6px; font-size: var(--texto-corpo, 0.8125rem);
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      text-align: left;
    }
    table.abs viab-num { width: 110px; }
    .abs-meses { max-height: 320px; overflow-y: auto; }
    .soma { margin-top: 8px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .soma.invalida { color: var(--cor-erro, #d45a3a); }
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
    .pag-linha viab-num { width: 130px; }
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
      const [receitas, crono, params] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
      ]);
      if (!receitas?.erro) this.linhas = receitas.dados || [];
      if (!crono?.erro) this.crono = crono.dados || [];
      if (!params?.erro) this.dataInicio = params.data_inicio_projeto ?? null;
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar receitas', 'erro');
    }
    this.carregando = false;
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando receitas..."></urbi-loading>`;
    return html`
      ${this.linhas.length === 0 ? html`
        <urbi-estado-vazio icone="fa-solid fa-sack-dollar" mensagem="Nenhuma linha de receita definida"></urbi-estado-vazio>` : nothing}
      <div class="cards">
        ${this.linhas.map((l) => this._renderLinha(l))}
      </div>
      ${this.editavel ? html`
        <div class="add-linha">
          <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionarLinha}>
            Adicionar Linha de Receita
          </urbi-botao>
        </div>` : nothing}
      ${this.modalAbs ? this._renderModalAbsorcao() : nothing}
      ${this.modalPag ? this._renderModalPagamento() : nothing}
      ${this.confirmRemover ? this._renderConfirmRemover() : nothing}
    `;
  }

  // ── Card da linha de receita ──

  private _renderLinha(l: any): TemplateResult {
    const dis = !this.editavel;
    const vgv = vgvLinha(l.tipologias);
    const vgl = vglLinha(vgv, l.fluxo_pagamento);
    return html`
      <urbi-card>
        <div class="card-cab">
          <urbi-input class="nome" ?desabilitado=${dis} .valor=${l.nome || ''}
            placeholder="Nome da linha"
            @urbi:input-change=${(e: CustomEvent) => this._salvarLinha(l, { nome: e.detail.valor })}
          ></urbi-input>
          <urbi-input class="fase" ?desabilitado=${dis} .valor=${l.fase_label || ''}
            placeholder="Fase 1"
            @urbi:input-change=${(e: CustomEvent) => this._salvarLinha(l, { fase_label: e.detail.valor })}
          ></urbi-input>
          <urbi-select
            .valor=${l.tipo || 'venda'}
            .opcoes=${[{ valor: 'venda', rotulo: 'Venda' }]}
            @urbi:select-change=${() => { /* único tipo por ora */ }}
          ></urbi-select>
          <span class="espaco"></span>
          <urbi-botao variante="secundario" pequeno @click=${() => this._abrirAbsorcao(l)}>Absorção de Vendas</urbi-botao>
          <urbi-botao variante="secundario" pequeno @click=${() => this._abrirPagamento(l)}>Fluxo de Pagamento</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => { this.confirmRemover = { tipo: 'linha', linha: l }; }}>Remover</urbi-botao>` : nothing}
        </div>

        <urbi-tabela
          expandir
          .colunas=${this._colunasTipologia(l)}
          .linhas=${l.tipologias || []}
          mensagem-vazio="Nenhuma tipologia — adicione a primeira."
        ></urbi-tabela>

        <div class="rodape-tip">
          ${!dis ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
              @click=${() => this._adicionarTipologia(l)}>Adicionar Tipologia</urbi-botao>` : nothing}
          <span class="espaco"></span>
          <span><span class="total-rotulo">VGL</span><span class="total-valor">${fmtR$(vgl)}</span></span>
          <span><span class="total-rotulo">VGV</span><span class="total-valor">${fmtR$(vgv)}</span></span>
        </div>
      </urbi-card>
    `;
  }

  private _colunasTipologia(l: any) {
    const dis = !this.editavel;
    const lote = this.estudo?.tipo_empreendimento === 'loteamento';
    const num = (t: any, campo: string, sufixo: string, casas = 2) => html`
      <viab-num sufixo=${sufixo} casas-decimais=${casas} ?desabilitado=${dis}
        .valor=${t[campo] !== null && t[campo] !== undefined ? Number(t[campo]) : null}
        @urbi:input-numero-change=${(e: CustomEvent) => this._salvarTipologia(l, t, { [campo]: e.detail.valor })}
      ></viab-num>`;

    const colunas: any[] = [
      {
        id: 'nome', label: 'Nome',
        render: (t: any) => html`
          <urbi-input ?desabilitado=${dis} .valor=${t.nome || ''}
            placeholder=${lote ? 'Lote' : 'Ex.: Studio'}
            @urbi:input-change=${(e: CustomEvent) => this._salvarTipologia(l, t, { nome: e.detail.valor })}
          ></urbi-input>`,
      },
      {
        id: 'tipo_unidade', label: 'Tipo',
        render: (t: any) => lote
          ? html`Lote`
          : html`
            <urbi-select .valor=${t.tipo_unidade || 'apartamento'} .opcoes=${TIPOS_UNIDADE_INC}
              @urbi:select-change=${(e: CustomEvent) => this._salvarTipologia(l, t, { tipo_unidade: e.detail.valor })}
            ></urbi-select>`,
      },
      { id: 'area', label: 'Área privativa', render: (t: any) => num(t, 'area_privativa_m2', 'm²') },
    ];
    if (!lote) {
      colunas.push(
        { id: 'dorm', label: 'Dormitórios', render: (t: any) => num(t, 'dormitorios', '', 0) },
        { id: 'vagas', label: 'Vagas', render: (t: any) => num(t, 'vagas', '', 0) },
      );
    }
    colunas.push(
      { id: 'qtd', label: 'Un. na linha', render: (t: any) => num(t, 'quantidade', '', 0) },
      { id: 'preco_m2', label: 'Preço / m²', render: (t: any) => num(t, 'preco_m2', 'R$/m²') },
      {
        id: 'preco_unit', label: 'Preço unitário', alinhamento: 'direita',
        valor: (t: any) => fmtR$((Number(t.area_privativa_m2) || 0) * (Number(t.preco_m2) || 0)),
      },
      {
        id: 'preco_total', label: 'Preço total', alinhamento: 'direita',
        valor: (t: any) => fmtR$((Number(t.area_privativa_m2) || 0) * (Number(t.preco_m2) || 0) * (Number(t.quantidade) || 0)),
      },
    );
    if (!dis) {
      colunas.push({
        id: 'acoes', label: '',
        render: (t: any) => html`
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
            @click=${() => { this.confirmRemover = { tipo: 'tipologia', linha: l, tip: t }; }}>Remover</urbi-botao>`,
      });
    }
    return colunas;
  }

  // ── CRUD ──

  private async _adicionarLinha() {
    try {
      const res = await criarReceitaAvancado(this.estudo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar linha', 'erro'); return; }
      this.linhas = [...this.linhas, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar linha', 'erro');
    }
  }

  private async _salvarLinha(l: any, dados: Record<string, any>) {
    try {
      const res = await atualizarReceitaAvancado(this.estudo.id, l.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.linhas = this.linhas.map((x) => (x.id === l.id ? { ...x, ...dados } : x));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private async _adicionarTipologia(l: any) {
    try {
      const res = await criarTipologia(this.estudo.id, l.id, { ordem: (l.tipologias?.length ?? 0) });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar tipologia', 'erro'); return; }
      this.linhas = this.linhas.map((x) =>
        x.id === l.id ? { ...x, tipologias: [...(x.tipologias || []), res] } : x);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar tipologia', 'erro');
    }
  }

  private async _salvarTipologia(l: any, t: any, dados: Record<string, any>) {
    try {
      const res = await atualizarTipologia(this.estudo.id, l.id, t.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.linhas = this.linhas.map((x) =>
        x.id === l.id
          ? { ...x, tipologias: x.tipologias.map((y: any) => (y.id === t.id ? { ...y, ...dados } : y)) }
          : x);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private _renderConfirmRemover(): TemplateResult {
    const c = this.confirmRemover!;
    const rotulo = c.tipo === 'linha'
      ? `a linha de receita "${c.linha.nome || 'sem nome'}" e todas as suas tipologias`
      : `a tipologia "${c.tip?.nome || 'sem nome'}"`;
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
      if (c.tipo === 'linha') {
        const res = await removerReceitaAvancado(this.estudo.id, c.linha.id);
        if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
        this.linhas = this.linhas.filter((x) => x.id !== c.linha.id);
      } else {
        const res = await removerTipologia(this.estudo.id, c.linha.id, c.tip.id);
        if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
        this.linhas = this.linhas.map((x) =>
          x.id === c.linha.id ? { ...x, tipologias: x.tipologias.filter((y: any) => y.id !== c.tip.id) } : x);
      }
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal "Absorção de Vendas"
  // ─────────────────────────────────────────────────────────────────

  private _abrirAbsorcao(l: any) {
    const a = l.absorcao || {};
    const blocos = Array.isArray(a.blocos) ? a.blocos : [];
    const bloco = (ev: string) => blocos.find((b: any) => b?.evento === ev) || {};
    this.absForm = {
      modo: a.modo || 'linear',
      correcao_estoque: Boolean(a.correcao_estoque),
      lancamento_pct: Number(bloco('lancamento').pct) || 0,
      obra_pct: Number(bloco('obra').pct) || 0,
      pos_obra_pct: Number(bloco('pos_obra').pct) || 0,
      pos_obra_meses: Number(bloco('pos_obra').duracao_meses)
        || Number(this.crono.find((e) => e.evento === 'pos_obra')?.duracao_meses) || 12,
      meses: this._mesesPersonalizados(a),
    };
    this.modalErro = '';
    this.modalAbs = l;
  }

  /** Linhas do modo personalizado: uma por mês do período, preservando valores salvos. */
  private _mesesPersonalizados(a: any): { mes: number; pct: number }[] {
    const salvos = new Map<number, number>(
      (Array.isArray(a.meses) ? a.meses : []).map((m: any) => [Number(m.mes), Number(m.pct) || 0]));
    const lanc = this.crono.find((e) => e.evento === 'lancamento');
    const pos = this.crono.find((e) => e.evento === 'pos_obra');
    if (!lanc || !pos) return [...salvos.entries()].map(([mes, pct]) => ({ mes, pct }));
    const inicio = Number(lanc.inicio_mes);
    const fim = Number(pos.inicio_mes) + Number(pos.duracao_meses) - 1;
    const linhas: { mes: number; pct: number }[] = [];
    for (let m = inicio; m <= fim; m++) linhas.push({ mes: m, pct: salvos.get(m) ?? 0 });
    return linhas;
  }

  private _absorcaoJson(): any {
    const f = this.absForm;
    const json: any = { modo: f.modo, correcao_estoque: f.correcao_estoque };
    if (f.modo === 'distribuido') {
      json.blocos = [
        { evento: 'lancamento', pct: f.lancamento_pct },
        { evento: 'obra', pct: f.obra_pct },
        { evento: 'pos_obra', pct: f.pos_obra_pct, duracao_meses: f.pos_obra_meses },
      ];
    }
    if (f.modo === 'personalizado') {
      json.meses = f.meses.filter((m: any) => (Number(m.pct) || 0) > 0)
        .map((m: any) => ({ mes: m.mes, pct: Number(m.pct) || 0 }));
    }
    return json;
  }

  private _somaAbsorcao(): number {
    const f = this.absForm;
    if (f.modo === 'distribuido') return (f.lancamento_pct || 0) + (f.obra_pct || 0) + (f.pos_obra_pct || 0);
    if (f.modo === 'personalizado') return f.meses.reduce((s: number, m: any) => s + (Number(m.pct) || 0), 0);
    return 100;
  }

  private _renderModalAbsorcao(): TemplateResult {
    const f = this.absForm;
    const dis = !this.editavel;
    const soma = this._somaAbsorcao();
    const somaOk = Math.abs(soma - 100) <= 0.01;
    const opcoes = [
      { id: 'linear', titulo: 'Linear', desc: 'Percentual constante durante todo o período.' },
      { id: 'distribuido', titulo: 'Distribuído', desc: 'Percentuais distribuídos por blocos de tempo.' },
      { id: 'personalizado', titulo: 'Personalizado', desc: 'Percentual específico para cada mês.' },
    ];
    return html`
      <urbi-modal title="Absorção de vendas" maxWidth="960px" @urbi-modal:close=${() => this.modalAbs = null}>
        <div class="abs-grid">
          <div>
            ${opcoes.map((o) => html`
              <div class="abs-opcao ${f.modo === o.id ? 'ativa' : ''}" role="button" tabindex="0"
                @click=${() => { if (!dis) this.absForm = { ...f, modo: o.id }; }}
                @keydown=${(e: KeyboardEvent) => { if (!dis && (e.key === 'Enter' || e.key === ' ')) this.absForm = { ...f, modo: o.id }; }}>
                <h4>${o.titulo} ${f.modo === o.id ? '✓' : ''}</h4>
                <p>${o.desc}</p>
              </div>`)}
          </div>
          <div class="abs-grafico">${this._graficoAbsorcao()}</div>
          <div>${this._configAbsorcao(dis)}</div>
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
          ${f.modo !== 'linear' ? html`
            <span class="soma ${somaOk ? '' : 'invalida'}">Σ Total: ${soma.toFixed(2).replace('.', ',')}%</span>` : nothing}
          <span class="espaco"></span>
          <urbi-botao variante="secundario" @click=${() => this.modalAbs = null}>Cancelar</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="primario" ?carregando=${this.aplicando} @click=${this._aplicarAbsorcao}>Aplicar</urbi-botao>` : nothing}
        </div>
      </urbi-modal>
    `;
  }

  private _configAbsorcao(dis: boolean): TemplateResult {
    const f = this.absForm;
    const lanc = this.crono.find((e) => e.evento === 'lancamento');
    const obra = this.crono.find((e) => e.evento === 'obra');
    if (f.modo === 'linear') {
      const r = absorcaoMensal({ modo: 'linear' }, this.crono);
      return html`
        <p class="sec">Distribuição uniforme automática.</p>
        ${r ? html`<p class="sec">Período: ${rotuloPeriodo(this.dataInicio, r.inicio, r.pcts.length)}</p>` : nothing}
      `;
    }
    if (f.modo === 'distribuido') {
      return html`
        <table class="abs">
          <thead><tr><th>Período</th><th>% Vendido</th></tr></thead>
          <tbody>
            <tr>
              <td>Lançamento<br /><span class="sec">${lanc ? rotuloPeriodoSeguro(this.dataInicio, lanc) : '—'}</span></td>
              <td><viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.lancamento_pct}
                @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, lancamento_pct: e.detail.valor ?? 0 }}></viab-num></td>
            </tr>
            <tr>
              <td>Durante a obra<br /><span class="sec">${obra ? rotuloPeriodoSeguro(this.dataInicio, obra) : '—'}</span></td>
              <td><viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.obra_pct}
                @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, obra_pct: e.detail.valor ?? 0 }}></viab-num></td>
            </tr>
            <tr>
              <td>Pós-obra<br /><span class="sec">após o término da obra</span></td>
              <td>
                <viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.pos_obra_pct}
                  @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, pos_obra_pct: e.detail.valor ?? 0 }}></viab-num>
                <viab-num sufixo="meses" casas-decimais="0" ?desabilitado=${dis} .valor=${f.pos_obra_meses}
                  @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, pos_obra_meses: e.detail.valor ?? 1 }}></viab-num>
              </td>
            </tr>
          </tbody>
        </table>
      `;
    }
    // personalizado
    return html`
      <div class="abs-meses">
        <table class="abs">
          <thead><tr><th>Mês</th><th>%</th></tr></thead>
          <tbody>
            ${f.meses.map((m: any, i: number) => html`
              <tr>
                <td>${rotuloMesRelativo(this.dataInicio, m.mes)}</td>
                <td><viab-num sufixo="%" ?desabilitado=${dis} .valor=${m.pct || null}
                  @urbi:input-numero-change=${(e: CustomEvent) => {
                    const meses = f.meses.map((x: any, j: number) => (j === i ? { ...x, pct: e.detail.valor ?? 0 } : x));
                    this.absForm = { ...f, meses };
                  }}></viab-num></td>
              </tr>`)}
          </tbody>
        </table>
      </div>
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
    const corLinha = 'var(--cor-erro, #d45a3a)';
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
    const soma = this._somaAbsorcao();
    if (Math.abs(soma - 100) > 0.01) {
      this.modalErro = `A soma deve ser 100% — atual: ${soma.toFixed(2).replace('.', ',')}%.`;
      return;
    }
    this.aplicando = true;
    this.modalErro = '';
    try {
      const json = this._absorcaoJson();
      const res = await atualizarReceitaAvancado(this.estudo.id, this.modalAbs.id, { absorcao: json });
      if (res?.erro) { this.modalErro = res.mensagem || 'Erro ao aplicar'; return; }
      this.linhas = this.linhas.map((x) => (x.id === this.modalAbs.id ? { ...x, absorcao: json } : x));
      this.modalAbs = null;
      urbiVerso.notificar('Absorção de vendas aplicada.', 'sucesso');
    } catch (e: any) {
      this.modalErro = e?.message || 'Erro ao aplicar';
    } finally {
      this.aplicando = false;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Modal "Fluxo de Pagamento"
  // ─────────────────────────────────────────────────────────────────

  private _abrirPagamento(l: any) {
    const fp = l.fluxo_pagamento || {};
    this.pagForm = {
      comissao: { ativo: fp.comissao?.ativo ?? true, tipo: fp.comissao?.tipo ?? 'embutida', pct: Number(fp.comissao?.pct) || 0 },
      ret: { ativo: fp.ret?.ativo ?? false, pct: Number(fp.ret?.pct) || 0 },
      entrada: { modo: fp.entrada?.modo ?? 'entrada', parcelas: Number(fp.entrada?.parcelas) || 1, pct: Number(fp.entrada?.pct) || 0 },
      parcelas: {
        periodicidade: fp.parcelas?.periodicidade ?? 'mensal',
        parcelas: Number(fp.parcelas?.parcelas) || 0,
        ao_longo_obra: fp.parcelas?.ao_longo_obra ?? true,
        juros: fp.parcelas?.juros ?? false,
        pct: Number(fp.parcelas?.pct) || 0,
      },
      repasse: { pct: Number(fp.repasse?.pct) || 0, apos_entrega_meses: Number(fp.repasse?.apos_entrega_meses) || 0 },
    };
    this.modalErro = '';
    this.modalPag = l;
  }

  private _renderModalPagamento(): TemplateResult {
    const f = this.pagForm;
    const dis = !this.editavel;
    const soma = (f.entrada.pct || 0) + (f.parcelas.pct || 0) + (f.repasse.pct || 0);
    const somaOk = Math.abs(soma - 100) <= 0.01;
    const set = (caminho: 'comissao' | 'ret' | 'entrada' | 'parcelas' | 'repasse', campo: string, valor: any) => {
      this.pagForm = { ...f, [caminho]: { ...f[caminho], [campo]: valor } };
    };
    const periodicidades = ['mensal', 'trimestral', 'semestral', 'anual'];
    const rotuloPer: Record<string, string> = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
    return html`
      <urbi-modal title="Fluxo de pagamento" maxWidth="820px" @urbi-modal:close=${() => this.modalPag = null}>
        <div class="pag-grid">
          <div>
            <div class="pag-secao">
              <h4>Definições</h4>
              <div class="pag-linha">
                <urbi-checkbox label="Comissão" ?desabilitado=${dis} ?marcado=${f.comissao.ativo}
                  @urbi:checkbox-change=${(e: CustomEvent) => set('comissao', 'ativo', e.detail.marcado)}></urbi-checkbox>
              </div>
              ${f.comissao.ativo ? html`
                <div class="pag-linha">
                  <span class="badges-par">
                    <urbi-badge cor="info" interativo ?ativo=${f.comissao.tipo === 'destacada'}
                      @click=${() => { if (!dis) set('comissao', 'tipo', 'destacada'); }}>Destacada</urbi-badge>
                    <urbi-badge cor="info" interativo ?ativo=${f.comissao.tipo === 'embutida'}
                      @click=${() => { if (!dis) set('comissao', 'tipo', 'embutida'); }}>Embutida</urbi-badge>
                  </span>
                  <viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.comissao.pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => set('comissao', 'pct', e.detail.valor ?? 0)}></viab-num>
                </div>
                <p class="sec">${f.comissao.tipo === 'embutida'
                  ? 'Embutida: já está no preço de venda (não deduz do VGV).'
                  : 'Destacada: custo adicional (deduz do VGV).'}</p>` : nothing}
              <div class="pag-linha">
                <urbi-checkbox label="RET" ?desabilitado=${dis} ?marcado=${f.ret.ativo}
                  @urbi:checkbox-change=${(e: CustomEvent) => set('ret', 'ativo', e.detail.marcado)}></urbi-checkbox>
                ${f.ret.ativo ? html`
                  <viab-num sufixo="%" ?desabilitado=${dis} .valor=${f.ret.pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => set('ret', 'pct', e.detail.valor ?? 0)}></viab-num>` : nothing}
              </div>
              ${f.ret.ativo ? html`<p class="sec">Regime Especial de Tributação — patrimônio de afetação.</p>` : nothing}
            </div>
          </div>
          <div>
            <div class="pag-secao">
              <h4>Condições de entrada</h4>
              <div class="pag-linha">
                <span class="badges-par">
                  <urbi-badge cor="info" interativo ?ativo=${f.entrada.modo === 'ato'}
                    @click=${() => { if (!dis) set('entrada', 'modo', 'ato'); }}>Ato</urbi-badge>
                  <urbi-badge cor="info" interativo ?ativo=${f.entrada.modo === 'entrada'}
                    @click=${() => { if (!dis) set('entrada', 'modo', 'entrada'); }}>Entrada</urbi-badge>
                </span>
                <viab-num label="Nº parcelas" sufixo="parcelas" casas-decimais="0" ?desabilitado=${dis} .valor=${f.entrada.parcelas}
                  @urbi:input-numero-change=${(e: CustomEvent) => set('entrada', 'parcelas', e.detail.valor ?? 1)}></viab-num>
                <viab-num label="% do total" sufixo="%" ?desabilitado=${dis} .valor=${f.entrada.pct}
                  @urbi:input-numero-change=${(e: CustomEvent) => set('entrada', 'pct', e.detail.valor ?? 0)}></viab-num>
              </div>
            </div>
            <div class="pag-secao">
              <h4>Parcelamento</h4>
              <div class="pag-linha">
                <span class="badges-par">
                  ${periodicidades.map((p) => html`
                    <urbi-badge cor="info" interativo ?ativo=${f.parcelas.periodicidade === p}
                      @click=${() => { if (!dis) set('parcelas', 'periodicidade', p); }}>${rotuloPer[p]}</urbi-badge>`)}
                </span>
              </div>
              <div class="pag-linha">
                <viab-num label="Nº parcelas" sufixo="parcelas" casas-decimais="0"
                  ?desabilitado=${dis || f.parcelas.ao_longo_obra} .valor=${f.parcelas.parcelas}
                  @urbi:input-numero-change=${(e: CustomEvent) => set('parcelas', 'parcelas', e.detail.valor ?? 0)}></viab-num>
                <viab-num label="% do total" sufixo="%" ?desabilitado=${dis} .valor=${f.parcelas.pct}
                  @urbi:input-numero-change=${(e: CustomEvent) => set('parcelas', 'pct', e.detail.valor ?? 0)}></viab-num>
              </div>
              <div class="pag-linha">
                <urbi-checkbox label="Ao longo da obra" ?desabilitado=${dis} ?marcado=${f.parcelas.ao_longo_obra}
                  @urbi:checkbox-change=${(e: CustomEvent) => set('parcelas', 'ao_longo_obra', e.detail.marcado)}></urbi-checkbox>
                <urbi-checkbox label="Juros" ?desabilitado=${dis} ?marcado=${f.parcelas.juros}
                  @urbi:checkbox-change=${(e: CustomEvent) => set('parcelas', 'juros', e.detail.marcado)}></urbi-checkbox>
              </div>
              ${f.parcelas.ao_longo_obra ? html`
                <p class="sec">Duração do parcelamento = duração do evento Obra do cronograma.</p>` : nothing}
            </div>
            <div class="pag-secao">
              <h4>Repasse</h4>
              <div class="pag-linha">
                <viab-num label="Repasse" sufixo="%" ?desabilitado=${dis} .valor=${f.repasse.pct}
                  @urbi:input-numero-change=${(e: CustomEvent) => set('repasse', 'pct', e.detail.valor ?? 0)}></viab-num>
                <viab-num label="Após entrega" sufixo="meses" casas-decimais="0" ?desabilitado=${dis} .valor=${f.repasse.apos_entrega_meses}
                  @urbi:input-numero-change=${(e: CustomEvent) => set('repasse', 'apos_entrega_meses', e.detail.valor ?? 0)}></viab-num>
              </div>
            </div>
          </div>
        </div>

        ${this.modalErro ? html`<urbi-banner variante="erro">${this.modalErro}</urbi-banner>` : nothing}

        <div class="modal-rodape">
          <span class="soma ${somaOk ? '' : 'invalida'}">Entrada + Parcelas + Repasse: ${soma.toFixed(2).replace('.', ',')}%</span>
          <span class="espaco"></span>
          <urbi-botao variante="secundario" @click=${() => this.modalPag = null}>Cancelar</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="primario" ?carregando=${this.aplicando} @click=${this._aplicarPagamento}>Aplicar</urbi-botao>` : nothing}
        </div>
      </urbi-modal>
    `;
  }

  private _aplicarPagamento = async () => {
    const f = this.pagForm;
    const soma = (f.entrada.pct || 0) + (f.parcelas.pct || 0) + (f.repasse.pct || 0);
    if (Math.abs(soma - 100) > 0.01) {
      this.modalErro = `Entrada + Parcelas + Repasse deve somar 100% — atual: ${soma.toFixed(2).replace('.', ',')}%.`;
      return;
    }
    this.aplicando = true;
    this.modalErro = '';
    try {
      const res = await atualizarReceitaAvancado(this.estudo.id, this.modalPag.id, { fluxo_pagamento: f });
      if (res?.erro) { this.modalErro = res.mensagem || 'Erro ao aplicar'; return; }
      this.linhas = this.linhas.map((x) => (x.id === this.modalPag.id ? { ...x, fluxo_pagamento: f } : x));
      this.modalPag = null;
      urbiVerso.notificar('Fluxo de pagamento aplicado.', 'sucesso');
    } catch (e: any) {
      this.modalErro = e?.message || 'Erro ao aplicar';
    } finally {
      this.aplicando = false;
    }
  };
}

/** Período de um evento com labels de calendário (helper local do template). */
function rotuloPeriodoSeguro(dataInicio: string | null, ev: EventoCrono): string {
  return rotuloPeriodo(dataInicio, Number(ev.inicio_mes), Number(ev.duracao_meses));
}

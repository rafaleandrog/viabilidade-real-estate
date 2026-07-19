import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { STATUS_LABEL, TIPO_LABEL, NIVEL_LABEL, COR_STATUS, formatarData } from './viab-shared.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct, fmtNum } from './viab-format.js';
import { calcularProforma } from './proforma.js';
import {
  urbiVerso, listarEstudos, criarEstudo, duplicarEstudo, removerEstudo,
  listarGlebasNucleo, listarLotesNucleo,
} from './viabilidade-api.js';
import './viabilidade-config-benchmarks.js';

@customElement('viab-tela-dashboard')
export class ViabTelaDashboard extends LitElement {
  @property({ type: String }) aba: 'estudos' | 'terrenos' | 'benchmark' = 'estudos';

  @state() private estudos: any[] = [];
  @state() private carregando = true;
  @state() private filtros: Record<string, string> = {};
  @state() private mostrarForm = false;
  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  @state() private formErro = '';
  @state() private removerAlvo: any = null;
  @state() private terrenos: any[] = [];
  @state() private filtroTerreno = '';
  @state() private terrenosCarregando = false;
  @state() private terrenosDisponivel = true;
  @state() private terrenosMotivo = '';
  private terrenosCarregados = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .form-campos { display: flex; flex-direction: column; gap: 12px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
    .acoes-linha { display: inline-flex; gap: 6px; }
    .filtros-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .filtros-bar urbi-select { min-width: 200px; }
    .nivel-campo label { display: block; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-bottom: 6px; }
    .nivel-badges { display: flex; gap: 6px; }
    .nivel-apoio { margin-top: 6px; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
  `];

  private readonly _abas = [
    { id: 'estudos', label: 'Estudos', icone: 'fa-solid fa-chart-line' },
    { id: 'terrenos', label: 'Terrenos', icone: 'fa-solid fa-map-location-dot' },
    { id: 'benchmark', label: 'Benchmark', icone: 'fa-solid fa-gauge-high' },
  ];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('aba') && this.aba === 'estudos') this._carregar();
    if (changed.has('aba') && this.aba === 'terrenos' && !this.terrenosCarregados) this._carregarTerrenos();
  }

  private async _carregarTerrenos() {
    this.terrenosCarregando = true;
    this.terrenosDisponivel = true;
    this.terrenosMotivo = '';
    try {
      const [glebas, lotes] = await Promise.all([listarGlebasNucleo(), listarLotesNucleo()]);
      const g = (glebas?.dados ?? []).map((o: any) => ({ ...o, _tipo: 'gleba' }));
      const l = (lotes?.dados ?? []).map((o: any) => ({ ...o, _tipo: 'lote' }));
      this.terrenos = [...g, ...l];
      this.terrenosCarregados = true;
    } catch (e: any) {
      this.terrenosDisponivel = false;
      this.terrenosMotivo = e?.message || 'Indisponível';
    }
    this.terrenosCarregando = false;
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const res = await listarEstudos({});
      this.estudos = res?.dados || [];
    } catch (e) {
      console.error('Erro ao listar estudos:', e);
    }
    this.carregando = false;
  }

  render() {
    return html`
      <urbi-shell-page dashboard titulo="Estudos de Viabilidade">
        ${this.aba === 'estudos'
          ? html`
              <urbi-botao
                slot="actions"
                variante="primario"
                pequeno
                icone="fa-solid fa-plus"
                @click=${this._abrirForm}
              >Criar estudo</urbi-botao>`
          : nothing}

        <urbi-abas
          expandir
          .abas=${this._abas}
          .ativa=${this.aba}
          @urbi:aba-selecionar=${(e: CustomEvent) => {
            const id = e.detail?.id;
            urbiVerso.navegarSub(id === 'terrenos' ? '/terrenos' : id === 'benchmark' ? '/benchmarks' : '/');
          }}
        >
          <urbi-hospedeiro slot="estudos">${this._renderEstudos()}</urbi-hospedeiro>
          <urbi-hospedeiro slot="terrenos">${this._renderTerrenos()}</urbi-hospedeiro>
          <urbi-hospedeiro slot="benchmark">
            <viabilidade-config-benchmarks
              .somenteLeitura=${urbiVerso.contexto()?.nivel !== 'admin'}
            ></viabilidade-config-benchmarks>
          </urbi-hospedeiro>
        </urbi-abas>
      </urbi-shell-page>

      ${this.mostrarForm ? this._renderForm() : nothing}
      ${this.removerAlvo ? this._renderConfirmRemover() : nothing}
    `;
  }

  private _colunas() {
    const numero = (fn: (p: any) => string): (l: unknown) => string =>
      (l) => { const p = calcularProforma(l as any); return p.vgv > 0 ? fn(p) : '—'; };
    return [
      { id: 'nome', label: 'Estudo', valor: (l: any) => l.nome_exibicao || l.nome },
      {
        id: 'tipo', label: 'Tipo',
        valor: (l: any) => TIPO_LABEL[l.tipo_empreendimento] || l.tipo_empreendimento,
      },
      {
        id: 'nivel', label: 'Nível',
        render: (l: any) => html`<urbi-badge cor=${l.nivel_analise === 'avancado' ? 'info' : 'padrao'}>${NIVEL_LABEL[l.nivel_analise] || 'Preliminar'}</urbi-badge>`,
      },
      { id: 'vgv', label: 'VGV', alinhamento: 'direita', valor: numero((p) => fmtR$(p.vgv)) },
      { id: 'resultado', label: 'Resultado', alinhamento: 'direita', valor: numero((p) => fmtR$(p.resultado)) },
      { id: 'margem', label: 'Margem', alinhamento: 'direita', valor: numero((p) => fmtPct(p.margemLiquidaPct)) },
      {
        id: 'status', label: 'Status',
        render: (l: any) => html`<urbi-badge cor=${COR_STATUS[l.status] ?? 'padrao'}>${STATUS_LABEL[l.status] || l.status}</urbi-badge>`,
      },
      { id: 'criado', label: 'Criado em', valor: (l: any) => formatarData(l.criado_em) },
      {
        id: 'acoes', label: '',
        render: (l: any) => html`
          <div class="acoes-linha">
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-copy"
              @click=${(ev: Event) => { ev.stopPropagation(); this._duplicar(l.id); }}
              title="Duplicar">Duplicar</urbi-botao>
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${(ev: Event) => { ev.stopPropagation(); this.removerAlvo = l; }}
              title="Remover">Remover</urbi-botao>
          </div>`,
      },
    ];
  }

  private _linhasFiltradas() {
    return this.estudos.filter((e) =>
      (!this.filtros.tipo || e.tipo_empreendimento === this.filtros.tipo) &&
      (!this.filtros.status || e.status === this.filtros.status));
  }

  private _renderEstudos(): TemplateResult {
    return html`
      <div class="filtros-bar">
        <urbi-select
          label="Tipo de estudo"
          .valor=${this.filtros.tipo ?? ''}
          .opcoes=${[
            { valor: '', rotulo: 'Todos os tipos' },
            { valor: 'loteamento', rotulo: 'Loteamento' },
            { valor: 'incorporacao', rotulo: 'Incorporação' },
          ]}
          @urbi:select-change=${(e: CustomEvent) => { this.filtros = { ...this.filtros, tipo: e.detail.valor }; }}
        ></urbi-select>
        <urbi-select
          label="Status"
          .valor=${this.filtros.status ?? ''}
          .opcoes=${[
            { valor: '', rotulo: 'Todos os status' },
            ...Object.entries(STATUS_LABEL).map(([valor, rotulo]) => ({ valor, rotulo })),
          ]}
          @urbi:select-change=${(e: CustomEvent) => { this.filtros = { ...this.filtros, status: e.detail.valor }; }}
        ></urbi-select>
      </div>
      <urbi-tabela
        expandir
        clicavel
        .colunas=${this._colunas()}
        .linhas=${this._linhasFiltradas()}
        ?carregando=${this.carregando}
        mensagem-vazio="Nenhum estudo ainda. Clique em “Criar estudo”."
        @urbi:tabela-click=${(e: CustomEvent) => {
          const l = e.detail?.linha; if (l?.id) urbiVerso.navegarSub(`/detalhe/${l.id}`);
        }}
      ></urbi-tabela>
    `;
  }

  private _renderTerrenos(): TemplateResult {
    if (this.terrenosCarregando) {
      return html`<urbi-loading mensagem="Carregando imóveis do Núcleo..."></urbi-loading>`;
    }
    if (!this.terrenosDisponivel) {
      return html`
        <urbi-card titulo="Terrenos (via Núcleo)">
          <urbi-banner variante="alerta">
            Integração com o Núcleo indisponível ou sem permissão de leitura (${this.terrenosMotivo}).
            Um administrador pode liberar em <strong>Admin → Apps → viabilidade → Núcleo</strong>.
            Enquanto isso, cadastre o terreno no estudo pelo modo <strong>“Inserir novo”</strong>.
          </urbi-banner>
        </urbi-card>
      `;
    }
    const colunas = [
      { id: 'tipo', label: 'Tipo', valor: (l: any) => (l._tipo === 'gleba' ? 'Gleba' : 'Lote') },
      { id: 'nome', label: 'Imóvel', valor: (l: any) => l.id_legivel || `#${l.id}` },
      { id: 'area', label: 'Área', alinhamento: 'direita', valor: (l: any) => `${fmtNum(Number(l.area) || 0)} m²` },
    ];
    const linhas = this.filtroTerreno
      ? this.terrenos.filter((t) => t._tipo === this.filtroTerreno)
      : this.terrenos;
    return html`
      <div class="filtros-bar">
        <urbi-select
          label="Tipo de terreno"
          .valor=${this.filtroTerreno}
          .opcoes=${[
            { valor: '', rotulo: 'Todos os terrenos' },
            { valor: 'gleba', rotulo: 'Glebas' },
            { valor: 'lote', rotulo: 'Lotes' },
          ]}
          @urbi:select-change=${(e: CustomEvent) => { this.filtroTerreno = e.detail.valor; }}
        ></urbi-select>
      </div>
      <urbi-tabela
        expandir
        .colunas=${colunas}
        .linhas=${linhas}
        mensagem-vazio="Nenhuma gleba ou lote cadastrado no Núcleo."
      ></urbi-tabela>
    `;
  }

  private _abrirForm = () => {
    this.form = {
      nome: '', tipo_empreendimento: 'loteamento', nivel_analise: 'preliminar',
      origem_terreno: 'manual', uf: '',
    };
    this.formErro = '';
    this.mostrarForm = true;
  };

  private _renderForm(): TemplateResult {
    return html`
      <urbi-modal title="Novo estudo" @urbi-modal:close=${() => this.mostrarForm = false}>
        <div class="form-campos">
          <urbi-input
            label="Nome do estudo"
            obrigatorio
            placeholder="Ex: Pátio Urbitá 1"
            .valor=${this.form.nome || ''}
            @urbi:input-change=${(e: CustomEvent) => this.form = { ...this.form, nome: e.detail.valor }}
          ></urbi-input>

          <urbi-select
            label="Tipo de empreendimento"
            .valor=${this.form.tipo_empreendimento}
            .opcoes=${[
              { valor: 'loteamento', rotulo: 'Loteamento' },
              { valor: 'incorporacao', rotulo: 'Incorporação' },
            ]}
            @urbi:select-change=${(e: CustomEvent) => this.form = { ...this.form, tipo_empreendimento: e.detail.valor }}
          ></urbi-select>

          <div class="nivel-campo">
            <label>Nível de análise</label>
            <div class="nivel-badges" role="group" aria-label="Nível de análise">
              <urbi-badge cor="info" interativo ?ativo=${this.form.nivel_analise !== 'avancado'}
                @click=${() => this.form = { ...this.form, nivel_analise: 'preliminar' }}
              >Preliminar</urbi-badge>
              <urbi-badge cor="info" interativo ?ativo=${this.form.nivel_analise === 'avancado'}
                @click=${() => this.form = { ...this.form, nivel_analise: 'avancado' }}
              >Avançado</urbi-badge>
            </div>
            <div class="nivel-apoio">
              ${this.form.nivel_analise === 'avancado'
                ? 'Fluxo de caixa mês a mês com TIR, VPL e payback.'
                : 'Proforma estática, sem dimensão temporal.'}
            </div>
          </div>

          <urbi-select
            label="Origem do terreno"
            .valor=${this.form.origem_terreno}
            .opcoes=${[
              { valor: 'manual', rotulo: 'Inserir novo (manual)' },
              { valor: 'nucleo', rotulo: 'Buscar terreno (Núcleo)' },
            ]}
            @urbi:select-change=${(e: CustomEvent) => this.form = { ...this.form, origem_terreno: e.detail.valor }}
          ></urbi-select>

          <urbi-input
            label="UF"
            placeholder="DF"
            .valor=${this.form.uf || ''}
            @urbi:input-change=${(e: CustomEvent) => this.form = { ...this.form, uf: String(e.detail.valor || '').toUpperCase().slice(0, 2) }}
          ></urbi-input>

          ${this.formErro ? html`<urbi-banner variante="erro">${this.formErro}</urbi-banner>` : nothing}

          <div class="form-acoes">
            <urbi-botao variante="fantasma" @click=${() => this.mostrarForm = false}>Cancelar</urbi-botao>
            <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Criar estudo</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }

  private _renderConfirmRemover(): TemplateResult {
    const nome = this.removerAlvo.nome_exibicao || this.removerAlvo.nome;
    return html`
      <urbi-modal title="Remover estudo" maxWidth="420px" @urbi-modal:close=${() => this.removerAlvo = null}>
        <div class="form-campos">
          <p>Remover o estudo <strong>${nome}</strong>? Esta ação não pode ser desfeita.</p>
          <div class="form-acoes">
            <urbi-botao variante="fantasma" @click=${() => this.removerAlvo = null}>Cancelar</urbi-botao>
            <urbi-botao variante="perigo" @click=${this._confirmarRemover}>Remover</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }

  private _salvar = async () => {
    if (!this.form.nome?.trim()) { this.formErro = 'Informe o nome do estudo.'; return; }
    this.salvando = true;
    this.formErro = '';
    try {
      const res = await criarEstudo({
        nome: this.form.nome.trim(),
        tipo_empreendimento: this.form.tipo_empreendimento,
        nivel_analise: this.form.nivel_analise,
        origem_terreno: this.form.origem_terreno,
        uf: this.form.uf || null,
      });
      if (res?.erro) { this.formErro = res.mensagem || 'Erro ao criar estudo'; return; }
      this.mostrarForm = false;
      urbiVerso.notificar('Estudo criado (rascunho).', 'sucesso');
      if (res?.id) urbiVerso.navegarSub(`/detalhe/${res.id}`);
    } catch (e: any) {
      this.formErro = e?.message || 'Erro ao criar estudo';
    } finally {
      this.salvando = false;
    }
  };

  private async _duplicar(id: number) {
    try {
      const res = await duplicarEstudo(id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao duplicar', 'erro'); return; }
      urbiVerso.notificar('Estudo duplicado.', 'sucesso');
      if (res?.id) urbiVerso.navegarSub(`/detalhe/${res.id}`);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao duplicar', 'erro');
    }
  }

  private _confirmarRemover = async () => {
    const estudo = this.removerAlvo;
    this.removerAlvo = null;
    if (!estudo) return;
    try {
      const res = await removerEstudo(estudo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      urbiVerso.notificar('Estudo removido.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };
}

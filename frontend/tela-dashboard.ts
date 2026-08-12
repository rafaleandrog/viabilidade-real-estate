import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { STATUS_LABEL, TIPO_LABEL, NIVEL_LABEL, COR_STATUS, formatarData } from './viab-shared.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct, fmtNum } from './viab-format.js';
import { calcularProforma } from './proforma.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { areaPrivativaTotalLinhas, mesRepasse } from './fluxo-shared.js';
import { proformaAvancado } from './proforma-avancado.js';
import {
  receitaLiquidaComCorretagemMensal, fundingDoEstudo,
  type FundingNoFluxo,
} from './funding-motor.js';
import {
  urbiVerso, listarEstudos, criarEstudo, duplicarEstudo, removerEstudo,
  listarGlebasNucleo, listarLotesNucleo,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  buscarCronogramaAvancado, buscarParametrosAvancado, listarFundingOperacoes,
} from './viabilidade-api.js';
import './viabilidade-config-benchmarks.js';
import './viabilidade-config-curvas.js';

/** VGV / Resultado / Margem prontos para a listagem — a mesma grandeza que a sub-aba Proforma mostra. */
export interface ResumoListagem { vgv: number; resultado: number; margemPct: number }

/**
 * #406: um estudo Avançado não tem os campos fixos que `calcularProforma`
 * (motor do Preliminar) lê — por isso a listagem mostrava "—" em VGV,
 * Resultado e Margem para todo estudo Avançado, mesmo com os números prontos
 * na sub-aba Proforma. `calculosAvancado` é preenchido de forma assíncrona
 * (`_calcularUmAvancado`, cálculo pesado — várias chamadas de API + motor),
 * então esta função tem TRÊS desfechos possíveis para um estudo Avançado,
 * não dois:
 *
 *   - a chave está ausente do mapa → ainda não terminou de calcular;
 *   - a chave é `'indisponivel'` → calculou e deu erro, ou não há receita
 *     modelada (`vgv <= 0`, mesmo guard do Preliminar);
 *   - a chave tem o resultado → pronto para exibir.
 *
 * Pura e exportada para ter teste sem precisar montar o componente Lit —
 * mesmo padrão de `linhasFinanciaveisPadrao`/`instrumentoDeRegistro` em
 * `capital-stack-motor.ts`: a lógica de decisão fica testável, a tela só
 * consome o resultado.
 */
export function resumoListagem(
  linha: any,
  calculosAvancado: Record<number, ResumoListagem | 'indisponivel'>,
): ResumoListagem | null | 'carregando' {
  if (linha.nivel_analise === 'avancado') {
    const calc = calculosAvancado[linha.id];
    if (calc === undefined) return 'carregando';
    if (calc === 'indisponivel') return null;
    return calc.vgv > 0 ? calc : null;
  }
  const p = calcularProforma(linha);
  return p.vgv > 0 ? { vgv: p.vgv, resultado: p.resultado, margemPct: p.margemLiquidaPct } : null;
}

@customElement('viab-tela-dashboard')
export class ViabTelaDashboard extends LitElement {
  // BUG7-16: 'curvas' — dupla exposição igual ao Benchmark (aba de topo aqui +
  // telas_config.curvas em Admin → Apps, inalterado).
  @property({ type: String }) aba: 'estudos' | 'terrenos' | 'benchmark' | 'curvas' = 'estudos';

  @state() private estudos: any[] = [];
  // #406: VGV/Resultado/Margem dos estudos Avançados, preenchidos sob demanda
  // (não bloqueia o primeiro render da tabela — as linhas Preliminar aparecem
  // na hora, as Avançadas mostram "…" até a própria linha resolver).
  @state() private calculosAvancado: Record<number, ResumoListagem | 'indisponivel'> = {};
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
    { id: 'curvas', label: 'Curvas', icone: 'fa-solid fa-wave-square' },
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
    this.calculosAvancado = {};
    try {
      const res = await listarEstudos({});
      this.estudos = res?.dados || [];
    } catch (e) {
      console.error('Erro ao listar estudos:', e);
    }
    this.carregando = false;
    this._calcularAvancados();
  }

  /**
   * #406: dispara o cálculo de VGV/Resultado/Margem de todo estudo Avançado
   * da página — em paralelo, sem bloquear `_carregar()`. `listarCurvas()` é
   * GLOBAL (não por estudo), então é buscada UMA vez aqui e compartilhada
   * entre todas as linhas, em vez de N vezes dentro de cada uma.
   */
  private async _calcularAvancados() {
    const avancados = this.estudos.filter((e) => e.nivel_analise === 'avancado');
    if (avancados.length === 0) return;
    const curvasRes = await listarCurvas().catch(() => null);
    const curvas = curvasRes?.erro ? [] : (curvasRes?.dados || []);
    await Promise.all(avancados.map((e) => this._calcularUmAvancado(e, curvas)));
  }

  /**
   * Reproduz exatamente o caminho da sub-aba Proforma (`tela-fluxo-ver.ts`
   * `_carregar`/`_recalcular`, com `funding` incluído quando há Capital
   * Stack ativo) — para que o número da listagem nunca divirja do que o
   * usuário vê ao abrir o estudo. Cada linha resolve de forma independente:
   * uma falha não derruba as demais.
   */
  private async _calcularUmAvancado(estudo: any, curvas: any[]) {
    try {
      const [receitas, custos, crono, params, operacoes] = await Promise.all([
        listarReceitasAvancado(estudo.id),
        listarCustosAvancado(estudo.id),
        buscarCronogramaAvancado(estudo.id),
        buscarParametrosAvancado(estudo.id),
        listarFundingOperacoes(estudo.id),
      ]);
      const linhasReceita = receitas?.erro ? [] : (receitas.dados || []);
      const linhasCusto = custos?.erro ? [] : (custos.dados || []);
      const cronograma = crono?.erro ? [] : (crono.dados || []);
      const operacoesFunding = operacoes?.erro ? [] : (operacoes.dados || []);
      const taxaDescontoAa = params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12);
      const config: FluxoConfig = {
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxaDescontoAa,
        cronograma,
        linhasReceita,
        linhasCusto,
        curvas,
        areaTerreno: Number(estudo?.terreno_manual_area) || Number(estudo?.area_terreno_nucleo) || 0,
        ret: params?.erro ? undefined : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
      };
      const c = calcularFluxo(config);

      // Sem operações de Funding, `fundingDoEstudo` devolve `null` e
      // `proformaAvancado` calcula desalavancado (mesma regra da tela de
      // Resultados, blast radius zero em estudo sem captação).
      let funding: FundingNoFluxo | null = null;
      if (operacoesFunding.length > 0) {
        const receitaLiquida = receitaLiquidaComCorretagemMensal(c.receitaMensal, c.linhasCusto, linhasCusto);
        const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
        const fundingCalc = fundingDoEstudo(
          operacoesFunding, c.fluxoMensal, receitaLiquida, resultadoFinal,
          mesRepasse(cronograma), taxaDescontoAa,
          { custosRaw: linhasCusto, linhasCusto: c.linhasCusto, cronograma },
        );
        funding = fundingCalc?.noFluxo ?? null;
      }

      const area = areaPrivativaTotalLinhas(linhasReceita);
      const p = proformaAvancado(c, area, funding);
      this.calculosAvancado = {
        ...this.calculosAvancado,
        [estudo.id]: { vgv: p.vgv, resultado: p.resultado, margemPct: p.margemPct },
      };
    } catch (e) {
      console.error(`Erro ao calcular VGV/Resultado/Margem do estudo ${estudo.id}:`, e);
      this.calculosAvancado = { ...this.calculosAvancado, [estudo.id]: 'indisponivel' };
    }
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
            urbiVerso.navegarSub(
              id === 'terrenos' ? '/terrenos'
                : id === 'benchmark' ? '/benchmarks'
                : id === 'curvas' ? '/curvas'
                : '/');
          }}
        >
          <urbi-hospedeiro slot="estudos">${this._renderEstudos()}</urbi-hospedeiro>
          <urbi-hospedeiro slot="terrenos">${this._renderTerrenos()}</urbi-hospedeiro>
          <urbi-hospedeiro slot="benchmark">
            <viabilidade-config-benchmarks
              .somenteLeitura=${urbiVerso.contexto()?.nivel !== 'admin'}
            ></viabilidade-config-benchmarks>
          </urbi-hospedeiro>
          <urbi-hospedeiro slot="curvas">
            <viabilidade-config-curvas></viabilidade-config-curvas>
          </urbi-hospedeiro>
        </urbi-abas>
      </urbi-shell-page>

      ${this.mostrarForm ? this._renderForm() : nothing}
      ${this.removerAlvo ? this._renderConfirmRemover() : nothing}
    `;
  }

  private _colunas() {
    // #406: "…" enquanto a linha Avançada ainda está calculando (assíncrono,
    // não bloqueia o resto da tabela); "—" quando terminou e não há dado
    // suficiente — mesmo guard de sempre (`vgv > 0`), agora também para o
    // Avançado. Preliminar não muda: mesma chamada síncrona de antes.
    const numero = (fn: (p: ResumoListagem) => string): (l: unknown) => string =>
      (l) => {
        const r = resumoListagem(l, this.calculosAvancado);
        if (r === 'carregando') return '…';
        return r ? fn(r) : '—';
      };
    return [
      { id: 'nome', label: 'Estudo', valor: (l: any) => l.nome_exibicao || l.nome },
      {
        id: 'tipo', label: 'Tipo',
        valor: (l: any) => TIPO_LABEL[l.tipo_empreendimento] || l.tipo_empreendimento,
      },
      {
        id: 'nivel', label: 'Nível',
        render: (l: any) => html`<urbi-badge cor=${l.nivel_analise === 'avancado' ? 'info' : 'alerta'}>${NIVEL_LABEL[l.nivel_analise] || 'Preliminar'}</urbi-badge>`,
      },
      { id: 'vgv', label: 'VGV', alinhamento: 'direita', valor: numero((p) => fmtR$(p.vgv)) },
      { id: 'resultado', label: 'Resultado', alinhamento: 'direita', valor: numero((p) => fmtR$(p.resultado)) },
      { id: 'margem', label: 'Margem', alinhamento: 'direita', valor: numero((p) => fmtPct(p.margemPct)) },
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
              title="Remover"></urbi-botao>
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

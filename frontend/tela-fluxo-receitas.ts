import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import {
  rotuloPeriodo, rotuloMesRelativo, absorcaoMensal, faixasAbsorcao, pctPosChavesDerivado, APOS_CHAVES_MESES,
  erroFormularioAbsorcao, totalAntesAlocacao, ramoLegadoDeRecebiveis,
  type EventoCrono,
} from './fluxo-shared.js';
import {
  pctRepasseDerivado, parcelasAoLongoObra, jurosTabelaAnualPct, type ResiduoAteMarco,
} from './fluxo-caixa-motor.js';
import {
  erroFormularioPagamento, fluxoPagamentoParaSalvar, formularioPagamento,
  taxasDistintasDoPlano,
} from './fluxo-pagamento-editor.js';
// #431: a lógica do modal de Absorção mora fora do componente, como a do modal
// de Pagamento — método privado de LitElement não é testável neste repo.
import {
  absorcaoParaSalvar, absorcaoSubstituiCurva, curvaNaoRepresentavel, formularioAbsorcao,
  type FormularioAbsorcao,
} from './fluxo-absorcao-editor.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarFasesAvancado, criarFaseAvancado, atualizarFaseAvancado, removerFaseAvancado,
  listarTipologiasCatalogo,
  criarAlocacao, atualizarAlocacao, removerAlocacao,
  listarCustosAvancado,
} from './viabilidade-api.js';
import './viab-num.js';

// Sub-aba "Viabilidade → Receitas" (nível Avançado · Lote 6 · #19 #20 #21).
//
// #222: na linguagem do usuário este agrupador comercial chama-se GRUPO (antes
// "Fase"). Os identificadores internos seguem sendo `avancado_fases`/`fase_id`/
// `fase_label` (não são renomeados) — só o rótulo mudou. "Fase" continua válido
// no Cronograma, onde representa tempo.
//
// Modelo: um card por GRUPO. Cada grupo é dono da Absorção de Vendas e do Fluxo
// de Pagamento (modais). Dentro da fase, uma tabela de ALOCAÇÕES de venda: cada
// linha escolhe uma tipologia do catálogo (Empreendimento → Tipologias), define
// unidades e preço/m². As unidades da tipologia CASCATEIAM pelas fases (#170):
// o "Total" de cada linha é o que sobrou das linhas acima e o "Saldo" é esse
// total menos as unidades da própria linha. Ao esgotar as unidades no estudo
// inteiro, a tipologia some das opções de novas linhas (trava de saldo agregada
// por estudo, espelhando a do backend). Nada aqui é usado pelo estudo Preliminar.

const n = (v: any): number => Number(v) || 0;

// #248/#342: só "Mensal" é oferecido para linhas NOVAS/editadas — periodicidades
// fora do padrão aprovado (padrao-incorporacao.md §11, "Modelo funcional de
// referência": "quantidade de parcelas mensais... sem periodicidades fora do
// padrão aprovado"). Dado legado com outra periodicidade continua sendo lido
// e calculado normalmente pelo motor (`INTERVALO_PERIODICIDADE`, fluxo-caixa-
// motor.ts) — só não é mais exposto na UI (a #342 removeu a badge seletora,
// que só tinha uma opção sempre ativa desde a #248).
const PERIODICIDADES = ['mensal'];

@customElement('viab-fluxo-receitas')
export class ViabFluxoReceitas extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private fases: any[] = [];
  @state() private tipologias: any[] = [];      // catálogo do estudo
  @state() private custosPermuta: any[] = [];    // reservas físicas feitas em Custos (#266)
  @state() private carregando = true;
  @state() private crono: EventoCrono[] = [];
  @state() private dataInicio: string | null = null;
  @state() private confirmRemover: { tipo: 'fase' | 'alocacao'; fase: any; aloc?: any } | null = null;

  // Modais
  @state() private modalAbs: any = null;      // fase em edição
  @state() private absForm: FormularioAbsorcao | null = null;
  // #431: confirmação explícita antes de substituir uma curva que o formulário
  // não sabe desenhar. O app já tinha o padrão em casa
  // (`confirmRemoverProduto`, tela-premissas.ts) — e reabrir este modal e
  // clicar "Aplicar" destrói mais dado do que aquela exclusão.
  @state() private confirmAbs: { modo: string; pontos: number } | null = null;
  @state() private modalPag: any = null;
  @state() private pagForm: any = null;
  @state() private modalErro = '';
  @state() private aplicando = false;
  // #51 — rascunho local do nome da fase (evita que o re-render/round-trip
  // sobrescreva o input enquanto o usuário digita). Persiste via botão "Salvar".
  @state() private draftNome: Record<number, string> = {};

  private carregado = false;
  // #458: dedupe do console.warn por Grupo — sem isto, cada re-render (a tela
  // é reativa) reimprimiria o mesmo aviso, afogando o console.
  private _avisadoRamoLegado = new Set<any>();

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .cards { display: flex; flex-direction: column; gap: 16px; }
    .card-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .card-cab urbi-input.nome { width: 200px; }
    .card-cab .espaco { flex: 1; }

    /* #48 — table-layout fixo + colgroup (mesmo padrão do #44/Tipologias): cabeçalho
       e células alinham por coluna; campos ocupam 100% da célula. */
    table.aloc {
      width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums;
      table-layout: fixed;
    }
    table.aloc th {
      text-align: left; font-weight: 600; padding: 7px 8px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem);
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
      overflow: hidden;
    }
    table.aloc th.num, table.aloc td.num { text-align: right; }
    table.aloc td {
      padding: 5px 8px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      font-size: var(--texto-corpo, 0.8125rem); overflow: hidden;
    }
    /* Larguras por coluna (th e td herdadas do table-layout: fixed) */
    col.c-tipo   { width: 190px; }
    col.c-area   { width: 120px; }
    col.c-total  { width: 68px; }
    col.c-un     { width: 92px; }
    col.c-saldo  { width: 68px; }
    col.c-preco  { width: 140px; }
    col.c-punit  { width: 120px; }
    col.c-ptotal { width: 120px; }
    col.c-acao   { width: 56px; }
    table.aloc td viab-num { width: 100%; }
    table.aloc td.tipo urbi-select { width: 100%; }

    /* #49 — bola de status (pendente → aplicado) nos botões de Absorção e Fluxo
       de Pagamento. Slot do urbi-botao herda estes estilos.
       #92 — pendente vermelha (erro).
       #247 — aplicado usa o token de SUCESSO (verde), não info (azul): o azul
       comunica informação, não conclusão; verde é "aplicado/concluído", o
       mesmo token de sucesso usado no resto do app. */
    .stat {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      margin-right: 6px; vertical-align: middle;
      background: var(--cor-erro, #d45a3a);
    }
    .stat.ok { background: var(--cor-sucesso, #13a98d); }
    .saldo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.7rem); }
    .saldo.zero { color: var(--cor-erro, #d45a3a); }
    .rodape-tip { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-top: 10px; }
    .rodape-tip .espaco { flex: 1; }
    .total-rotulo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem); margin-right: 6px; }
    .total-valor { font-weight: 600; font-variant-numeric: tabular-nums; }
    .add-linha { margin-top: 16px; }
    .nota-regime-comercial { display: block; margin-top: 6px; font-size: var(--texto-rotulo, 0.75rem); max-width: 60ch; }
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
    /* #436/#431: a nota sobre os juros precisa competir com o número que ela
       qualifica, senão vira letra miúda ao lado de um destaque. O texto mudou
       na #431 — "Aplicar apaga estes juros" virou "estes juros são
       preservados; o que falta é onde criar taxa" —, mas o destaque continua
       valendo: é a única linha da tela que fala do limite do formulário. */
    .aviso-juros { color: var(--cor-alerta, #b45309); }
    .pag-secao h4 {
      margin: 0 0 8px; font-size: var(--texto-rotulo, 0.75rem); letter-spacing: 0.04em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase;
    }
    .pag-linha { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
    .pag-linha viab-num { width: 92px; }
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
      const [fases, tipologias, crono, params, custos] = await Promise.all([
        listarFasesAvancado(this.estudo.id, 'receita'),
        listarTipologiasCatalogo(this.estudo.id),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
      ]);
      if (!fases?.erro) this.fases = fases.dados || [];
      if (!tipologias?.erro) this.tipologias = tipologias.dados || [];
      if (!crono?.erro) this.crono = crono.dados || [];
      if (!params?.erro) this.dataInicio = params.data_inicio_projeto ?? null;
      if (!custos?.erro) this.custosPermuta = custos.dados || [];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar receitas', 'erro');
    }
    this.carregando = false;
  }

  private _tip(id: any): any {
    return this.tipologias.find((t) => Number(t.id) === Number(id));
  }

  /**
   * Saldo global de unidades: quantidade do catálogo − Σ de todas as alocações
   * (todas as fases). Usado para checar disponibilidade ao adicionar/trocar tipologia.
   * #52: saldo agrega todas as fases para não exceder o total do catálogo.
   */
  private _saldo(tipologiaId: any): number {
    const tip = this._tip(tipologiaId);
    if (!tip) return 0;
    let usado = 0;
    for (const fase of this.fases) {
      for (const a of (fase.alocacoes || [])) {
        if (Number(a.tipologia_id) === Number(tipologiaId)) {
          usado += n(a.unidades);
        }
      }
    }
    const permutado = this.custosPermuta
      .filter((c) => c.grupo === 'terreno' && c.categoria === 'Preço'
        && c.subcategoria === 'Permuta física'
        && Number(c.permuta_tipologia_id) === Number(tipologiaId))
      .reduce((s, c) => s + Math.max(0, Math.round(n(c.permuta_quantidade))), 0);
    return n(tip.quantidade) - usado - permutado;
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
        <urbi-estado-vazio icone="fa-solid fa-layer-group" mensagem="Nenhum grupo definido"></urbi-estado-vazio>` : nothing}
      <div class="cards">
        ${this.fases.map((f) => this._renderFase(f))}
      </div>
      ${this.editavel ? html`
        <div class="add-linha">
          <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionarFase}>
            Adicionar Grupo
          </urbi-botao>
          <!-- #477: cada Grupo já é a unidade de regime comercial — absorção,
               plano de pagamento e juros de tabela próprios. Precisa de dois
               regimes (ex.: Residencial × Não residencial)? É dois Grupos. -->
          <span class="sec nota-regime-comercial">
            Cada Grupo tem sua própria absorção, plano de pagamento e juros de tabela — para dois
            regimes comerciais diferentes (ex.: Residencial × Não residencial), crie dois Grupos.
            O default de juros para Grupos novos fica em Financeiro.
          </span>
        </div>` : nothing}
      ${this.modalAbs ? this._renderModalAbsorcao() : nothing}
      ${this.confirmAbs ? this._renderConfirmAbsorcao() : nothing}
      ${this.modalPag ? this._renderModalPagamento() : nothing}
      ${this.confirmRemover ? this._renderConfirmRemover() : nothing}
    `;
  }

  // ── Card da fase ──

  private _renderFase(f: any): TemplateResult {
    const dis = !this.editavel;
    const vgv = this._vgvFase(f);
    const ramoLegado = ramoLegadoDeRecebiveis(f?.fluxo_pagamento);
    this._avisarRamoLegadoSeNecessario(f, ramoLegado);
    return html`
      <urbi-card>
        <div class="card-cab">
          <urbi-input class="nome" ?desabilitado=${dis}
            .valor=${this.draftNome[f.id] ?? (f.nome || '')}
            placeholder="Nome do grupo"
            @urbi:input-change=${(e: CustomEvent) => this._editarNome(f, e.detail.valor)}
          ></urbi-input>
          ${!dis && this._nomeSujo(f) ? html`
            <urbi-botao variante="primario" pequeno icone="fa-solid fa-check"
              @click=${() => this._salvarNome(f)}>Salvar</urbi-botao>` : nothing}
          <span class="espaco"></span>
          <!-- #169: "primario" (mesma cor de "Salvar") deixava a Absorção indistinguível
               da ação de salvar o nome; "secundario" alinha com o botão irmão Fluxo de
               Pagamento — as duas abrem modal, nenhuma é o CTA principal do card. -->
          <urbi-botao variante="secundario" pequeno @click=${() => this._abrirAbsorcao(f)}>
            <span class="stat ${this._aplicado(f, 'absorcao') ? 'ok' : ''}"></span>Absorção de Vendas
          </urbi-botao>
          <urbi-botao variante="secundario" pequeno @click=${() => this._abrirPagamento(f)}>
            <span class="stat ${this._aplicado(f, 'fluxo') ? 'ok' : ''}"></span>Fluxo de Pagamento
          </urbi-botao>
          <!-- #458: torna visível qual motor de recebíveis esta linha usa —
               hoje a escolha é invisível, decidida só pela forma do JSON
               (Array.isArray(fp?.componentes), o mesmo teste que
               recebimentoBrutoMensal faz em fluxo-caixa-motor.ts). -->
          ${ramoLegado ? html`
            <urbi-badge cor="alerta" title="Plano não migrado: abra Fluxo de Pagamento e aplique para usar o modelo de safras.">
              Plano não migrado
            </urbi-badge>` : nothing}
          ${!dis ? html`
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
              @click=${() => { this.confirmRemover = { tipo: 'fase', fase: f }; }}></urbi-botao>` : nothing}
        </div>

        ${this._renderTabelaAlocacoes(f, dis)}

        <div class="rodape-tip">
          ${!dis ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
              ?desabilitado=${this._tipologiasDisponiveis(f).length === 0}
              @click=${() => this._adicionarAlocacao(f)}>Adicionar tipologia</urbi-botao>` : nothing}
          <span class="espaco"></span>
          <span><span class="total-rotulo">VGV do grupo</span><span class="total-valor">${fmtR$(vgv)}</span></span>
        </div>
      </urbi-card>
    `;
  }

  /** Tipologias com saldo > 0 (agregado por todas as fases; para novas alocações). */
  private _tipologiasDisponiveis(_fase: any): any[] {
    return this.tipologias.filter((t) => this._saldo(t.id) > 0);
  }

  private _renderTabelaAlocacoes(f: any, dis: boolean): TemplateResult {
    const alocacoes = f.alocacoes || [];
    if (alocacoes.length === 0) {
      return html`<p class="sec">Nenhuma alocação — adicione a primeira.</p>`;
    }
    const lote = this.estudo?.tipo_empreendimento === 'loteamento';
    return html`
      <table class="aloc">
        <colgroup>
          <col class="c-tipo">
          <col class="c-area">
          <col class="c-total">
          <col class="c-un">
          <col class="c-saldo">
          <col class="c-preco">
          <col class="c-punit">
          <col class="c-ptotal">
          ${dis ? nothing : html`<col class="c-acao">`}
        </colgroup>
        <thead>
          <tr>
            <th>${lote ? 'Lote' : 'Tipologia'}</th>
            <th class="num">Área privativa</th>
            <th class="num">Total</th>
            <th class="num">Unidades</th>
            <th class="num">Saldo</th>
            <th class="num">Preço / m²</th>
            <th class="num">Preço unitário</th>
            <th class="num">VGV</th>
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
    // #170: as unidades da tipologia cascateiam pelas fases. "Total" é o que
    // ainda estava disponível ao chegar nesta linha (catálogo − vendido acima);
    // "Saldo" é esse total menos as unidades vendidas na própria linha.
    const total = totalAntesAlocacao(this.fases, this.tipologias, a.id, a.tipologia_id);
    const saldo = total - n(a.unidades);
    // Opções: tipologias com saldo global > 0 + a atual (sempre inclusa).
    const opcoes = this.tipologias
      .filter((t) => Number(t.id) === Number(a.tipologia_id) || this._saldo(t.id) > 0)
      .map((t) => ({ valor: String(t.id), rotulo: t.nome || 'Sem nome' }));
    return html`
      <tr>
        <td class="tipo">
          <urbi-select .valor=${String(a.tipologia_id)} .opcoes=${opcoes} ?desabilitado=${dis}
            @urbi:select-change=${(e: CustomEvent) => this._salvarAlocacao(f, a, { tipologia_id: Number(e.detail.valor) })}
          ></urbi-select>
        </td>
        <td class="num">${area ? `${area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²` : '—'}</td>
        <td class="num">${tip ? total : '—'}</td>
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
        <td class="num">${fmtNum(precoUnit)}</td>
        <td class="num">${fmtNum(precoTotal)}</td>
        ${dis ? nothing : html`
          <td class="num">
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
              @click=${() => { this.confirmRemover = { tipo: 'alocacao', fase: f, aloc: a }; }}></urbi-botao>
          </td>`}
      </tr>
    `;
  }

  // ── CRUD ──

  private _adicionarFase = async () => {
    try {
      const res = await criarFaseAvancado(this.estudo.id, { tipo: 'receita' });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar grupo', 'erro'); return; }
      this.fases = [...this.fases, { ...res, alocacoes: res.alocacoes || [] }];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar grupo', 'erro');
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

  // #51 — edição do nome sem persistir a cada tecla (evita sync que apaga letras).
  private _editarNome(f: any, valor: string) {
    this.draftNome = { ...this.draftNome, [f.id]: valor };
  }

  private _nomeSujo(f: any): boolean {
    const d = this.draftNome[f.id];
    return d !== undefined && d !== (f.nome || '');
  }

  private async _salvarNome(f: any) {
    const valor = this.draftNome[f.id];
    if (valor === undefined) return;
    await this._salvarFase(f, { nome: valor });
    const { [f.id]: _descartado, ...resto } = this.draftNome;
    this.draftNome = resto;
    urbiVerso.notificar('Nome do grupo salvo.', 'sucesso');
  }

  // #49 — estado "aplicado" (verde) por fase, guardado no próprio JSON da seção.
  private _aplicado(f: any, tipo: 'absorcao' | 'fluxo'): boolean {
    return tipo === 'absorcao'
      ? Boolean(f.absorcao?.aplicado)
      : Boolean(f.fluxo_pagamento?.aplicado);
  }

  /**
   * #458: `console.warn` no ramo legado, nomeando a linha — mesma dupla de
   * sinais que a issue pede (badge + warn), do mesmo lado (a tela sabe qual
   * Grupo está em qual ramo sem precisar chamar o motor). Deduplicado por
   * `f.id`: dispara uma vez por Grupo por sessão de tela, não a cada render.
   */
  private _avisarRamoLegadoSeNecessario(f: any, ramoLegado: boolean): void {
    if (!ramoLegado || f?.id === undefined || this._avisadoRamoLegado.has(f.id)) return;
    this._avisadoRamoLegado.add(f.id);
    console.warn(
      `viab-fluxo-receitas: Grupo "${f?.nome || f?.id}" (fase ${f?.id}) ainda está no ramo ` +
      'legado de recebíveis (fluxo_pagamento sem componentes) — abra "Fluxo de Pagamento" e ' +
      'aplique para migrar ao modelo de safras.',
    );
  }

  private async _adicionarAlocacao(f: any) {
    const disponiveis = this._tipologiasDisponiveis(f);
    if (disponiveis.length === 0) { urbiVerso.notificar('Sem tipologias com saldo neste grupo.', 'alerta'); return; }
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
      ? `o grupo "${c.fase.nome || 'sem nome'}" e todas as suas alocações`
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
  // Modal "Absorção de Vendas" (Distribuído — 3 ou 4 períodos conforme o
  // Cronograma tem Pré-lançamento ou não, #330/#347; pós-obra derivado)
  // ─────────────────────────────────────────────────────────────────

  // #347: a fase Pré-lançamento é opcional (#330) — sem ela no Cronograma,
  // `faixasAbsorcao` devolve uma faixa vazia (fim < início) e `absorcaoMensal`
  // simplesmente não espalha esse % em lugar nenhum. Um `pre_lancamento_pct`
  // legado > 0 nesse cenário é % de venda que desaparece em silêncio — por
  // isso a linha some da tela (não só desabilita) e o valor é zerado ao abrir.
  private _temPreLancamento(): boolean {
    return this.crono.some((e) => e.evento === 'pre_lancamento');
  }

  private _abrirAbsorcao(f: any) {
    this.absForm = formularioAbsorcao(f.absorcao, this._temPreLancamento());
    this.modalErro = '';
    this.confirmAbs = null;
    this.modalAbs = f;
  }

  /**
   * O que será gravado. #431: já não é "o formulário renderizado como JSON" —
   * é `absorcaoParaSalvar`, que devolve o persistido verbatim quando os blocos
   * não mudaram. A tabela derivada e o gráfico leem daqui de propósito: eles
   * mostram o que vai ser salvo, não uma projeção parecida.
   */
  private _absorcaoJson(): any {
    return absorcaoParaSalvar(this.absForm!, this.modalAbs?.absorcao);
  }

  private _renderModalAbsorcao(): TemplateResult {
    const f = this.absForm!;
    const dis = !this.editavel;
    // #431: a curva própria que este formulário não sabe desenhar. Enquanto o
    // usuário não editar bloco nenhum ela sobrevive ao "Aplicar"; se editar,
    // ela é substituída — e é por isso que o aviso existe.
    const curva = curvaNaoRepresentavel(this.modalAbs?.absorcao);
    const temPre = this._temPreLancamento();
    const faixas = faixasAbsorcao(this.crono);
    const posDerivado = pctPosChavesDerivado(this._absorcaoJson().blocos);
    const erroAbs = erroFormularioAbsorcao(f);
    // rot: formata o rótulo de período; retorna '—' para faixas vazias (fim < inicio).
    const rot = (fx?: { inicio: number; fim: number }) =>
      fx && fx.fim >= fx.inicio ? rotuloPeriodo(this.dataInicio, fx.inicio, fx.fim - fx.inicio + 1) : '—';
    return html`
      <urbi-modal title="Absorção de vendas" maxWidth="820px" @urbi-modal:close=${() => this.modalAbs = null}>
        <p class="sec">Distribuído em ${temPre ? '4' : '3'} períodos — ${temPre ? 'Pré-lançamento, ' : ''}Lançamento, Obra e Pós-chaves (calculado automaticamente). Os períodos vêm do Cronograma.</p>
        <div class="abs-grid">
          <div>
            <table class="abs">
              <thead><tr><th>Período</th><th>% Vendido</th></tr></thead>
              <tbody>
                ${temPre ? html`
                <tr>
                  <td>Pré-lançamento<br /><span class="sec">${rot(faixas?.pre_lancamento)}</span></td>
                  <td><viab-num sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${f.pre_lancamento_pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, pre_lancamento_pct: e.detail.valor ?? 0 }}></viab-num></td>
                </tr>` : nothing}
                <tr>
                  <td>Lançamento<br /><span class="sec">${rot(faixas?.lancamento)}</span></td>
                  <td><viab-num sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${f.lancamento_pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, lancamento_pct: e.detail.valor ?? 0 }}></viab-num></td>
                </tr>
                <tr>
                  <td>Durante a obra<br /><span class="sec">${rot(faixas?.obra)}</span></td>
                  <td><viab-num sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${f.obra_pct}
                    @urbi:input-numero-change=${(e: CustomEvent) => this.absForm = { ...f, obra_pct: e.detail.valor ?? 0 }}></viab-num></td>
                </tr>
                <tr>
                  <!-- #348: "Pós-chaves" — janela COMERCIAL fixa em 12 meses
                       (APOS_CHAVES_MESES, fluxo-shared.ts), sem relação com a
                       duração da fase "Pós-obras" do Cronograma (#328), que é
                       livre e serve de âncora de CUSTO. Nomes parecidos, dois
                       conceitos diferentes — não confundir. -->
                  <!-- #430: a duração fixa passa a ser DITA, não só implicada
                       pela faixa — é o que impede o usuário de procurá-la no
                       campo "Pós-obras" do Cronograma, que é de custo. -->
                  <td>Pós-chaves<br /><span class="sec">${rot(faixas?.pos_chaves)} · ${APOS_CHAVES_MESES} meses fixos</span></td>
                  <td><span class="derivado">${posDerivado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="abs-grafico">${this._graficoAbsorcao()}</div>
        </div>

        ${curva ? html`
          <urbi-banner variante="alerta">
            Este Grupo tem uma curva de absorção própria (modo "${curva.modo}"${curva.pontos
              ? html`, ${curva.pontos} ponto${curva.pontos === 1 ? '' : 's'} mensais`
              : nothing}) que este formulário não sabe desenhar — por isso os
            percentuais acima aparecem zerados. Aplicar sem mexer neles
            <strong>preserva a curva</strong>. Editar qualquer percentual a
            <strong>substitui</strong> pelos períodos distribuídos, e não há como
            recriá-la por aqui.
          </urbi-banner>` : nothing}
        ${erroAbs ? html`<urbi-banner variante="erro">${erroAbs}</urbi-banner>` : nothing}
        ${this.modalErro && this.modalErro !== erroAbs ? html`<urbi-banner variante="erro">${this.modalErro}</urbi-banner>` : nothing}

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
            <urbi-botao variante="primario" ?desabilitado=${Boolean(erroAbs)}
              ?carregando=${this.aplicando} @click=${this._aplicarAbsorcao}>Aplicar</urbi-botao>` : nothing}
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

  /**
   * #431: porta de entrada do "Aplicar". Se esta aplicação for substituir uma
   * curva que o formulário não sabe recriar, ela PARA aqui e pede confirmação
   * explícita — o mesmo padrão de `confirmRemoverProduto` em tela-premissas.ts.
   * Nos demais casos segue direto, porque não há o que confirmar.
   */
  private _aplicarAbsorcao = async () => {
    const substitui = absorcaoSubstituiCurva(this.absForm!, this.modalAbs?.absorcao);
    if (substitui) { this.confirmAbs = substitui; return; }
    await this._gravarAbsorcao();
  };

  private _renderConfirmAbsorcao(): TemplateResult {
    const c = this.confirmAbs!;
    return html`
      <urbi-modal title="Substituir a curva de absorção?" maxWidth="480px"
        @urbi-modal:close=${() => this.confirmAbs = null}>
        <p>Este Grupo tem uma curva própria (modo "${c.modo}"${c.pontos
          ? html`, com ${c.pontos} ponto${c.pontos === 1 ? '' : 's'} mensais`
          : nothing}). Aplicar os percentuais editados a substitui pelos períodos
          distribuídos, e <strong>não há como recriá-la por esta tela</strong>.</p>
        <div class="modal-rodape">
          <span class="espaco"></span>
          <urbi-botao variante="secundario" @click=${() => this.confirmAbs = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" ?carregando=${this.aplicando}
            @click=${() => { this.confirmAbs = null; void this._gravarAbsorcao(); }}>Substituir</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private async _gravarAbsorcao(): Promise<void> {
    this.modalErro = '';
    const invalido = erroFormularioAbsorcao(this.absForm!);
    if (invalido) { this.modalErro = invalido; return; }
    this.aplicando = true;
    try {
      // #49: `aplicado: true` (bola verde) já vem de `absorcaoParaSalvar`.
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
  }

  // ─────────────────────────────────────────────────────────────────
  // Modal "Fluxo de Pagamento" (multi-linha; Repasse derivado)
  // ─────────────────────────────────────────────────────────────────

  private _abrirPagamento(f: any) {
    this.pagForm = formularioPagamento(f.fluxo_pagamento);
    this.modalErro = '';
    this.modalPag = f;
  }

  /**
   * #428 — a taxa de juros de tabela do plano. É UM campo por Grupo (D-Q02),
   * não um por componente: gravá-lo aqui faz `componentesDoLegado` escrever a
   * mesma `taxaMensal` em todo componente financiado do plano.
   *
   * Escrever a chave `juros_tabela_aa` no formulário é o que marca "o usuário
   * mexeu": enquanto ela não existir, `componentesParaSalvar` trata a taxa
   * como só-canônica e preserva a que está persistida, componente a
   * componente. Ver `fluxo-pagamento-editor.ts` § `taxaFoiEditada`.
   */
  private _setJurosTabela(valor: number) {
    this.pagForm = { ...this.pagForm, juros_tabela_aa: valor };
  }

  /**
   * #460 — destino do resíduo de um Parcelamento "Ao longo da obra" sem prazo
   * (venda contratada no mês do marco ou depois): rolar para o Repasse
   * (`concentrado`) ou virar caixa imediato (o comportamento de sempre).
   * Escrever a chave é o que marca "o usuário escolheu" — `formularioPagamento`
   * só a propaga quando já existia no persistido (ver a nota de contrato em
   * `FormularioPagamento`).
   */
  private _setResiduoAteMarco(valor: ResiduoAteMarco) {
    this.pagForm = { ...this.pagForm, residuoAteMarco: valor };
  }

  private _setLinha(bloco: 'entrada' | 'parcelas', i: number, campo: string, valor: any) {
    const f = this.pagForm;
    const linhas = f[bloco].map((x: any, j: number) => (j === i ? { ...x, [campo]: valor } : x));
    this.pagForm = { ...f, [bloco]: linhas };
  }

  /**
   * #190/#191: nº de parcelas exibido numa linha de Parcelamento. Em "Ao longo
   * da obra" o número não é digitado nem persistido — sai do Cronograma e da
   * periodicidade da linha (`max(1, floor(duração da obra / intervalo))`), a
   * mesma conta que o motor usa para montar os vencimentos
   * (`parcelasAoLongoObra`). Trocar a periodicidade recalcula na hora: Mensal
   * numa obra de 24 meses mostra 24; Trimestral, 8. Nas demais combinações
   * (sem "ao longo da obra") segue o valor salvo, digitado pelo usuário.
   */
  private _parcelasExibidas(p: any): number {
    if (p?.ao_longo_obra) return parcelasAoLongoObra(this.crono, p?.periodicidade);
    return p?.parcelas ?? 0;
  }

  private _addLinha(bloco: 'entrada' | 'parcelas') {
    const f = this.pagForm;
    if (bloco === 'parcelas' && f.parcelas.length >= 4) return; // #105 — máximo 4
    let nova: any;
    if (bloco === 'entrada') {
      nova = { pct: 0, parcelas: 1, descontoPct: 0 };
    } else {
      // #105 — escolhe a primeira periodicidade ainda não usada
      const usadas = new Set(f.parcelas.map((p: any) => p.periodicidade));
      const disponivel = PERIODICIDADES.find((per) => !usadas.has(per)) ?? 'mensal';
      nova = { periodicidade: disponivel, parcelas: 0, ao_longo_obra: true, pct: 0 };
    }
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
    const erroPagamento = erroFormularioPagamento(f, this.crono);
    // #436/#428: o bloco de juros. A #436 o criou somente-leitura, lendo o
    // fluxo_pagamento PERSISTIDO; a #428 lhe deu o campo editável, e o campo lê
    // `pagForm` — é ele que o "Aplicar" grava.
    //
    // As duas leituras convivem de propósito e NÃO são redundantes:
    //  - `jurosAA` é a taxa DO PLANO, uma só (D-Q02). Sai de `pagForm` pela
    //    chave `juros_tabela_aa` se ela existir, senão derivada dos componentes
    //    persistidos — sem esse segundo ramo, o estudo 5 (que recebeu a taxa
    //    pela API, sem a chave) abriria em 0% e o primeiro Aplicar a apagaria;
    //  - `taxasPlano` continua lendo o persistido para responder UMA pergunta
    //    que o campo único não responde: o plano tem mais de uma taxa gravada?
    //    Esse é o caso residencial × não residencial da EVI, e é a única
    //    situação em que mexer no campo achata dado. O aviso abaixo só aparece
    //    nela.
    //
    // Os KPIs que se movem com a taxa são Receita Bruta, Resultado, margem, VPL
    // e TIR — NÃO o "VGV Vendável", que sai de `vgvLinha(tipologias)` (área ×
    // preço) e não conhece juros. Medido na Rodada 8 sobre o estudo 5:
    // R$ 1.259.273,59 de juros, TIR 18,59% contra 17,53%, VPL -R$ 959.500,19.
    // Revisao da #428, B3 — o gatilho do aviso NAO pode ser
    // `jurosDeTabelaConfigurados`, que descarta taxa zero por contrato da #436:
    // no plano canonico do estudo 5 (12,5% no `ate_marco`, 0% no Repasse de
    // 70%) isso suprimia o aviso exatamente onde alterar o campo move mais
    // dinheiro. `taxasDistintasDoPlano` conta o zero.
    const taxasPlano = taxasDistintasDoPlano(this.modalPag?.fluxo_pagamento);
    const jurosAA = jurosTabelaAnualPct(f);
    return html`
      <urbi-modal title="Fluxo de pagamento" maxWidth="860px" @urbi-modal:close=${() => this.modalPag = null}>
        <div class="pag-grid">
          <div>
            <div class="pag-secao">
              <h4>Definições</h4>
              <!-- #346: corretagem e RET saíram deste bloco — corretagem porque
                   já era só informativa (#228, sem efeito no motor: a linha
                   real é "Corretagem de vendas" em Custos → Diretos), RET
                   porque virou controle GLOBAL do estudo (era por Grupo). -->
              <p class="sec">Corretagem: configurada na linha de custo obrigatória "Corretagem de
                vendas" (Custos → Diretos).</p>
              <p class="sec">RET: controle global do estudo, em Custos → Financeiro.</p>
            </div>
          </div>
          <div>
            <div class="pag-secao">
              <h4>Juros de tabela</h4>
              <!-- #428: o campo editável, um por Grupo/plano (decisão D-Q02) e
                   NÃO um por componente. A persistência grava a mesma taxa
                   mensal equivalente em todo componente financiado do plano.
                   O sinal (sinalPct, #455) é por LINHA de Parcelamento —
                   ver o bloco "Parcelamento" abaixo. -->
              <p class="sec">Juros da tabela de venda a prazo, em % ao ano. Valem para o plano
                inteiro — entrada parcelada, parcelamento e repasse —, convertidos para a taxa
                mensal equivalente pela composição (1 + i)^(1/12) - 1, nunca por i/12.
                0% é venda sem juros, e é como fica todo plano em que ninguém digitar nada.</p>
              <div class="pag-linha">
                <viab-num label="Juros de tabela (% a.a.)" sufixo="%" casas-minimas="2"
                  ?desabilitado=${dis} .valor=${jurosAA}
                  @urbi:input-numero-change=${(ev: CustomEvent) => this._setJurosTabela(ev.detail.valor ?? 0)}></viab-num>
              </div>
              ${taxasPlano.length > 1 ? html`
                <p class="sec aviso-juros">Este plano tem <strong>${taxasPlano.length} taxas
                  diferentes</strong> gravadas (${taxasPlano.map((j) => fmtPct(j.anualPct) + ' a.a. em ' + j.rotulos.join(', ')).join(' · ')}),
                  e este campo guarda <strong>uma</strong>. Enquanto você não mexer nele, as taxas
                  dos componentes que sobrevivem à edição são preservadas como estão; ao
                  alterá-lo, a taxa acima passa a valer para <strong>todos</strong> os componentes
                  do plano — inclusive os que hoje estão em 0%.</p>` : nothing}
            </div>
            <div class="pag-secao">
              <h4>Condições de entrada</h4>
              <p class="sec">Pagamento no ato — 1 parcela paga no mês da contratação; mais de uma
                parcela aqui é o pagamento inicial dividido, ainda começando naquele mês.</p>
              ${f.entrada.map((e: any, i: number) => html`
                <div class="pag-linha">
                  <viab-num label="% do total" sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${e.pct}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('entrada', i, 'pct', ev.detail.valor ?? 0)}></viab-num>
                  <viab-num label="Nº parcelas" sufixo="x" casas-decimais="0" ?desabilitado=${dis} .valor=${e.parcelas}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('entrada', i, 'parcelas', ev.detail.valor ?? 1)}></viab-num>
                  <!-- #227: desconto comercial — abate esta fração ANTES da formação do
                       recebível (ex.: 5% no pagamento à vista). Série própria no motor
                       (descontoComercialMensal), nunca embutida no VGV. 0 = sem desconto,
                       comportamento idêntico ao de antes desta issue. -->
                  <viab-num label="Desconto" sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${n(e.descontoPct)}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('entrada', i, 'descontoPct', ev.detail.valor ?? 0)}></viab-num>
                  ${!dis && f.entrada.length > 1 ? html`
                    <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
                      @click=${() => this._delLinha('entrada', i)}></urbi-botao>` : nothing}
                </div>`)}
              ${!dis ? html`
                <urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
                  @click=${() => this._addLinha('entrada')}>Adicionar entrada</urbi-botao>` : nothing}
            </div>
            <div class="pag-secao">
              <h4>Parcelamento</h4>
              <p class="sec">Quantidade de parcelas mensais — "Ao longo da obra" liquida no evento
                do Cronograma (a quantidade vem de lá); sem marcar, é um prazo fixo de N parcelas.</p>
              <!-- #455: a distinção que o critério de aceite exige — Entrada é
                   % do TOTAL da venda; Sinal é % DESTE componente. -->
              <p class="sec">Sinal: um adiantamento pago no mês da contratação, em % <strong>deste
                componente</strong> — diferente da Entrada (acima), que é % do total da venda. O
                sinal não entra na base de juros da parcela (a PMT roda sobre o valor já líquido do
                sinal). 0% é o comportamento de sempre.</p>
              ${f.parcelas.map((p: any, i: number) => {
                return html`
                <div class="pag-linha">
                  <viab-num label="% do total" sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${p.pct}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'pct', ev.detail.valor ?? 0)}></viab-num>
                  <viab-num label="Sinal" sufixo="%" casas-minimas="2" ?desabilitado=${dis} .valor=${n(p.sinalPct)}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'sinalPct', ev.detail.valor ?? 0)}></viab-num>
                  ${/* #342: a badge de periodicidade foi removida — só "Mensal"
                       existe desde a #248, então marcar/clicar não tinha mais
                       função (era sempre a única opção, sempre ativa). A
                       periodicidade continua persistida ('mensal' em toda
                       linha nova) porque o motor depende dela
                       (fluxo-caixa-motor.ts). Linha legada com periodicidade
                       diferente (trimestral/semestral/anual) mantém o valor
                       gravado, só sem controle visual para trocá-lo — o motor
                       lê e calcula normalmente, como sempre leu. */ ''}
                  ${/* #190/#191/#344: "Ao longo da obra" → nº de parcelas sai
                       da duração da obra no Cronograma dividida pelo intervalo
                       da periodicidade. O valor é DERIVADO (não persistido): o
                       motor calcula os vencimentos a partir do cronograma,
                       então gravar o número aqui criaria uma segunda fonte de
                       verdade que ficaria velha assim que a duração da obra ou
                       a periodicidade mudasse. Por isso o campo fica oculto
                       (não só desabilitado) nesse modo — não há nada editável
                       para mostrar. */ ''}
                  ${!p.ao_longo_obra ? html`
                  <viab-num label="Nº parcelas" sufixo="x" casas-decimais="0"
                    ?desabilitado=${dis}
                    .valor=${this._parcelasExibidas(p)}
                    @urbi:input-numero-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'parcelas', ev.detail.valor ?? 0)}></viab-num>` : nothing}
                  <urbi-checkbox label="Ao longo da obra" ?desabilitado=${dis} ?marcado=${p.ao_longo_obra}
                    @urbi:checkbox-change=${(ev: CustomEvent) => this._setLinha('parcelas', i, 'ao_longo_obra', ev.detail.marcado)}></urbi-checkbox>
                  ${!dis && f.parcelas.length > 1 ? html`
                    <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
                      @click=${() => this._delLinha('parcelas', i)}></urbi-botao>` : nothing}
                </div>`;
              })}
              ${!dis && f.parcelas.length < 4 ? html`
                <urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
                  @click=${() => this._addLinha('parcelas')}>Adicionar parcelamento</urbi-botao>` : nothing}
            </div>
            <div class="pag-secao">
              <h4>Repasse</h4>
              <p class="sec">Evento de liquidação concentrada — o saldo que restar após entrada e
                parcelamento é pago de uma vez, sempre no 1º mês após o fim da obra (#345).</p>
              <div class="pag-linha">
                <div class="repasse-box">
                  <span class="sec">Repasse</span><br />
                  <span class="derivado">${repasse.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                </div>
              </div>
              <!-- #460: destino do resíduo de um "Ao longo da obra" sem prazo
                   (venda no mês do marco ou depois). 'imediato' preserva todo
                   estudo existente; 'concentrado' é a regra da EVI — rola
                   para o Repasse e passa a capitalizar com ele. -->
              <p class="sec">Quando uma venda "Ao longo da obra" acontece no próprio mês do marco
                (ou depois), sem prazo restante para parcelar, o valor pode virar caixa imediato
                (padrão) ou rolar para o Repasse, capitalizando junto com ele.</p>
              <div class="pag-linha">
                <urbi-select label="Resíduo sem prazo" ?desabilitado=${dis}
                  .valor=${f.residuoAteMarco ?? 'imediato'}
                  .opcoes=${[
                    { valor: 'imediato', rotulo: 'Caixa imediato (padrão)' },
                    { valor: 'concentrado', rotulo: 'Rola para o Repasse' },
                  ]}
                  @urbi:select-change=${(ev: CustomEvent) =>
                    this._setResiduoAteMarco(ev.detail.valor as ResiduoAteMarco)}></urbi-select>
              </div>
            </div>
          </div>
        </div>

        ${erroPagamento ? html`<urbi-banner variante="erro">${erroPagamento}</urbi-banner>` : nothing}
        ${this.modalErro && this.modalErro !== erroPagamento ? html`<urbi-banner variante="erro">${this.modalErro}</urbi-banner>` : nothing}

        <div class="modal-rodape">
          <span class="espaco"></span>
          <urbi-botao variante="secundario" @click=${() => this.modalPag = null}>Cancelar</urbi-botao>
          ${!dis ? html`
            <urbi-botao variante="primario" ?desabilitado=${Boolean(erroPagamento)}
              ?carregando=${this.aplicando} @click=${this._aplicarPagamento}>Aplicar</urbi-botao>` : nothing}
        </div>
      </urbi-modal>
    `;
  }

  private _aplicarPagamento = async () => {
    this.modalErro = '';
    const invalido = erroFormularioPagamento(this.pagForm, this.crono);
    if (invalido) { this.modalErro = invalido; return; }
    this.aplicando = true;
    try {
      // #248: `componentes` é o contrato canônico opt-in. O espelho legado
      // preserva o cálculo até a integração do motor na #283.
      const fluxo = fluxoPagamentoParaSalvar(this.pagForm, this.crono);
      const res = await atualizarFaseAvancado(this.estudo.id, this.modalPag.id, { fluxo_pagamento: fluxo });
      if (res?.erro) { this.modalErro = res.mensagem || 'Erro ao aplicar'; return; }
      this.fases = this.fases.map((x) => (x.id === this.modalPag.id ? { ...x, fluxo_pagamento: fluxo } : x));
      this.modalPag = null;
      urbiVerso.notificar('Fluxo de pagamento aplicado.', 'sucesso');
    } catch (e: any) {
      this.modalErro = e?.message || 'Erro ao aplicar';
    } finally {
      this.aplicando = false;
    }
  };
}

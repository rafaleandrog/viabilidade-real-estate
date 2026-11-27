import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { urbiVerso } from './viabilidade-api.js';
import { mesRepasse, operacaoComRascunho, rotuloMesRelativo, type EventoCrono } from './fluxo-shared.js';
import type { FundingCalc, OperacaoFunding, SerieOperacao } from './funding-motor.js';
import type { PassoEstrutura, SequenciaEstrutura } from './funding-estrutura.js';
import {
  CAMPO_MES, EVENTOS_ANCORA, MODOS_RETORNO,
  corpoDeCriacao, errosDaJanela, etapasDoTipo, nomePadrao, padroesDoTipo, patchDaEdicao, resumoDaEtapa,
  resumoDaJanela, serieDoGrafico, valoresDaOperacao,
  type CampoJanela, type ErroJanela, type KpiResumo, type SerieGrafico, type TipoDaJanela,
} from './funding-janela-dados.js';
import './viab-num.js';
import './funding-grafico-operacao.js';

/** O que a tela devolve para uma lista de operações: o funding e a sequência por senioridade. */
export interface SimulacaoJanela {
  funding: FundingCalc | null;
  sequencia: SequenciaEstrutura | null;
  vgvTotal: number;
}

/** O que a janela entrega ao confirmar: o corpo do POST, ou o PATCH só com o que mudou. */
export type ConfirmacaoJanela =
  | { modo: 'criar'; tipo: TipoDaJanela; corpo: Record<string, any> }
  | { modo: 'editar'; tipo: TipoDaJanela; id: number | string; patch: Record<string, any> };

// ─────────────────────────────────────────────────────────────────────────
// A janela de criar e editar uma operação de dívida, equity ou antecipação.
//
// Nada é gravado aqui: a janela guarda o rascunho, recalcula a prévia a cada
// tecla com a simulação que a tela lhe dá (`simular`) e, ao confirmar, ENTREGA
// à tela o corpo do POST ou o PATCH (evento `viab:janela-confirmar`). Quem grava
// é a tela; se o servidor recusar, a tela devolve a mensagem por `erroServidor`
// e a janela continua aberta, com o rascunho intacto. Cancelar não grava nada.
//
// O rascunho entra na simulação na posição de senioridade dele: na criação,
// sem `id`, por último entre as do tipo; na edição, com o `id` e a `ordem`
// dela. O mês da âncora é o derivado do Cronograma (`operacaoComRascunho`).
// A simulação roda em `willUpdate`, nunca em `render()`.
// ─────────────────────────────────────────────────────────────────────────
@customElement('viab-funding-janela')
export class ViabFundingJanela extends LitElement {
  @property() modo: 'criar' | 'editar' = 'criar';
  /** A operação gravada, na edição. */
  @property({ attribute: false }) gravada: Record<string, any> | null = null;
  /** As operações gravadas do estudo. */
  @property({ attribute: false }) salvas: OperacaoFunding[] = [];
  /** `ordem` da operação nova: a próxima livre. */
  @property({ type: Number }) ordemNova = 0;
  @property({ attribute: false }) crono: EventoCrono[] = [];
  @property({ attribute: false }) dataInicio: string | null = null;
  /** Os tipos que a janela oferece, com os rótulos da tela. */
  @property({ attribute: false }) tipos: { valor: TipoDaJanela; rotulo: string }[] = [];
  @property({ attribute: false }) simular: ((ops: OperacaoFunding[]) => SimulacaoJanela | null) | null = null;
  /** A chamada de gravação está em curso (a tela desabilita o confirmar). */
  @property({ type: Boolean }) gravando = false;
  /** A recusa do servidor, mostrada dentro da janela. */
  @property() erroServidor = '';

  @state() private tipo: TipoDaJanela = 'divida';
  @state() private valores: Record<string, any> = {};
  @state() private etapa = 'geral';
  @state() private tocado = false;
  @state() private nomeTocado = false;
  // Calculados em `willUpdate` (nunca em `render()`).
  @state() private resumo: KpiResumo[] = [];
  @state() private grafico: SerieGrafico | null = null;
  @state() private erros: ErroJanela[] = [];
  @state() private tentouConfirmar = false;
  private iniciada = false;
  private perguntando = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    :host { display: contents; }
    /* Largura explícita: o painel do urbi-modal se ajusta ao conteúdo, e um
       conteúdo de colunas em fr encolheria até o mínimo. Cabe no maxWidth do
       modal (980px) com a margem do painel, e acompanha a tela estreita. */
    .janela {
      display: flex; flex-direction: column; gap: 12px; min-width: 0; box-sizing: border-box;
      width: min(920px, calc(100vw - 120px)); max-width: 100%;
    }
    .topo { min-width: 0; }
    .topo urbi-input { display: block; max-width: 420px; }
    .colunas {
      display: grid; gap: 16px; min-width: 0;
      grid-template-columns: minmax(150px, 190px) minmax(0, 1fr) minmax(220px, 280px);
      align-items: start;
    }
    .trilho, .campos, .lado { min-width: 0; }
    .campos h3 { margin: 0 0 8px; font-size: 1rem; color: var(--cor-texto); }
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .grid > * { width: 190px; max-width: 100%; box-sizing: border-box; }
    .sel-campo { display: flex; flex-direction: column; gap: 4px; width: 190px; max-width: 100%; }
    .sel-campo.p2 { width: 300px; }
    .sel-rotulo { font-size: 0.75rem; text-transform: uppercase; color: var(--cor-texto-sec); font-weight: 700; }
    .travado { color: var(--cor-texto); font-weight: 700; }
    .cadeado { font-size: 0.75em; margin-left: 4px; color: var(--cor-texto-sec); }
    .nota { font-size: 0.78rem; color: var(--cor-texto-sec); margin-top: 8px; }
    .erro-etapa { margin-top: 10px; }
    .lado { display: flex; flex-direction: column; gap: 12px; }
    .lado h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo); text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--cor-texto-sec);
    }
    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .kpi {
      background: var(--cor-superficie); border: 1px solid var(--cor-borda);
      border-radius: var(--raio-md); padding: 8px 10px; min-width: 0;
    }
    .kpi .rot { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.4px; color: var(--cor-texto-sec); font-weight: 700; }
    .kpi .val {
      font-size: 0.95rem; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums;
      color: var(--cor-texto); overflow-wrap: anywhere; word-break: break-word;
    }
    .sem-previa { font-size: 0.78rem; color: var(--cor-texto-sec); }
    .rodape { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .rodape .espaco { flex: 1; }
    .rodape .pendencias { font-size: 0.78rem; color: var(--cor-erro); }
    @media (max-width: 1000px) {
      .colunas { grid-template-columns: minmax(0, 1fr); }
      .kpis { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    }
  `];

  // ── estado ──────────────────────────────────────────────────────────

  protected willUpdate(mudou: PropertyValues<this>) {
    if (!this.iniciada) this._iniciar();
    if (mudou.has('valores' as any) || mudou.has('tipo' as any) || mudou.has('simular') || mudou.has('salvas')
      || mudou.has('crono') || mudou.has('gravada')) {
      this._recalcular();
    }
  }

  private _iniciar() {
    this.iniciada = true;
    if (this.modo === 'editar' && this.gravada) {
      this.tipo = this.gravada.tipo as TipoDaJanela;
      this.valores = valoresDaOperacao(this.gravada);
    } else {
      this.tipo = this.tipos[0]?.valor ?? 'divida';
      this.valores = { nome: nomePadrao(this.tipo, this.salvas), ...padroesDoTipo(this.tipo) };
    }
    this.etapa = 'geral';
  }

  /** A operação em rascunho como a simulação a vê. */
  private _efetiva(): OperacaoFunding {
    if (this.modo === 'editar' && this.gravada) {
      return operacaoComRascunho(this.gravada, patchDaEdicao(this.gravada, this.valores), this.crono) as OperacaoFunding;
    }
    const corpo = corpoDeCriacao(this.tipo, this.valores, this.ordemNova);
    const comMes = { valor: 0, inicio_mes: Number(this.valores.inicio_mes) || 0, ...corpo };
    return operacaoComRascunho({} as Record<string, any>, comMes, this.crono) as OperacaoFunding;
  }

  private _recalcular() {
    const efetiva = this._efetiva();
    const ops = this.modo === 'editar' && this.gravada
      ? this.salvas.map((o) => (String(o.id) === String(this.gravada!.id) ? efetiva : o))
      : [...this.salvas, efetiva];
    const sim = this.simular ? this.simular(ops) : null;
    const serie: SerieOperacao | null = sim?.funding?.operacoes.find((s) => s.operacao === efetiva) ?? null;
    const passo: PassoEstrutura | null = sim?.sequencia?.passos.find((p) => p.operacao === efetiva) ?? null;
    this.resumo = resumoDaJanela(this.tipo, serie, passo, sim?.vgvTotal ?? 0);
    this.grafico = serieDoGrafico(serie);
    this.erros = errosDaJanela({
      modo: this.modo, tipo: this.tipo, valores: this.valores, gravada: this.gravada,
      salvas: this.salvas, ordem: this.ordemNova,
    });
  }

  private _set(campo: string, valor: unknown) {
    this.valores = { ...this.valores, [campo]: valor };
    this.tocado = true;
    if (campo === 'nome') this.nomeTocado = true;
  }

  private _trocarTipo(tipo: TipoDaJanela) {
    if (this.modo !== 'criar' || tipo === this.tipo) return;
    const nome = this.nomeTocado ? this.valores.nome : nomePadrao(tipo, this.salvas);
    this.tipo = tipo;
    this.valores = { nome, ...padroesDoTipo(tipo) };
    this.tocado = true;
  }

  /** Há o que perder ao fechar: na criação, qualquer alteração; na edição, um PATCH não vazio. */
  get alterada(): boolean {
    if (this.modo === 'editar' && this.gravada) return Object.keys(patchDaEdicao(this.gravada, this.valores)).length > 0;
    return this.tocado;
  }

  // ── foco ────────────────────────────────────────────────────────────

  /** Ao abrir, o foco vai ao primeiro campo: o seletor de tipo na criação, o nome na edição. */
  protected firstUpdated() {
    const alvo = this.shadowRoot?.querySelector(this.modo === 'criar' ? '[data-campo="tipo"]' : '[data-campo="nome"]') as HTMLElement | null;
    alvo?.focus();
  }

  // ── ações ───────────────────────────────────────────────────────────

  private async _cancelar() {
    if (this.perguntando) return;
    if (this.alterada) {
      this.perguntando = true;
      let sair = false;
      try {
        sair = await urbiVerso.confirmar({
          titulo: 'Descartar alterações?',
          mensagem: this.modo === 'criar'
            ? 'A operação ainda não foi criada. Fechar a janela descarta o que foi preenchido.'
            : 'As alterações ainda não foram salvas. Fechar a janela as descarta.',
          rotuloConfirmar: 'Descartar',
          rotuloCancelar: 'Continuar editando',
          perigo: true,
        });
      } finally {
        this.perguntando = false;
      }
      if (!sair) return;
    }
    this.dispatchEvent(new CustomEvent('viab:janela-cancelar', { bubbles: true, composed: true }));
  }

  private _confirmar() {
    if (this.gravando) return;
    this.tentouConfirmar = true;
    if (this.erros.length) {
      this.etapa = this.erros[0].etapa;
      return;
    }
    const detail: ConfirmacaoJanela = this.modo === 'editar' && this.gravada
      ? { modo: 'editar', tipo: this.tipo, id: this.gravada.id, patch: patchDaEdicao(this.gravada, this.valores) }
      : { modo: 'criar', tipo: this.tipo, corpo: corpoDeCriacao(this.tipo, this.valores, this.ordemNova) };
    this.dispatchEvent(new CustomEvent('viab:janela-confirmar', { detail, bubbles: true, composed: true }));
  }

  // ── desenho ─────────────────────────────────────────────────────────

  private _rotuloTipo(t: string): string {
    return this.tipos.find((x) => x.valor === t)?.rotulo ?? t;
  }

  private _num(c: Extract<CampoJanela, { tipo: 'num' }> | typeof CAMPO_MES): TemplateResult {
    return html`<viab-num data-campo=${c.campo} label=${c.rotulo} sufixo=${c.sufixo} casas-decimais=${String(c.casas)}
      .valor=${this.valores[c.campo] ?? null}
      @urbi:input-numero-change=${(e: CustomEvent) => this._set(c.campo, e.detail.valor ?? 0)}
    ></viab-num>`;
  }

  private _ancora(rotulo: string): TemplateResult {
    const evento = String(this.valores.cronograma_evento ?? 'customizado');
    const mes = Number(this._efetiva().inicio_mes) || 0;
    return html`
      <div class="sel-campo p2">
        <urbi-select data-campo="cronograma_evento" label=${rotulo} .valor=${evento} .opcoes=${EVENTOS_ANCORA}
          @urbi:select-change=${(e: CustomEvent) => this._set('cronograma_evento', e.detail.valor)}
        ></urbi-select>
      </div>
      ${evento === 'customizado'
        ? this._num(CAMPO_MES)
        : html`<div class="sel-campo">
            <span class="sel-rotulo">Início derivado</span>
            <span class="mes-derivado">${rotuloMesRelativo(this.dataInicio, mes)}
              <urbi-icone class="cadeado" classe="fa-solid fa-lock" title="Derivado do Cronograma"></urbi-icone></span>
          </div>`}
    `;
  }

  private _campo(c: CampoJanela): TemplateResult | typeof nothing {
    switch (c.tipo) {
      case 'tipo':
        return this.modo === 'criar'
          ? html`<div class="sel-campo p2">
              <urbi-select data-campo="tipo" label="Tipo" .valor=${this.tipo}
                .opcoes=${this.tipos.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
                @urbi:select-change=${(e: CustomEvent) => this._trocarTipo(e.detail.valor)}
              ></urbi-select>
            </div>`
          : html`<div class="sel-campo p2">
              <span class="sel-rotulo">Tipo</span>
              <span class="travado" data-campo="tipo">${this._rotuloTipo(this.tipo)}
                <urbi-icone class="cadeado" classe="fa-solid fa-lock" title="O tipo não muda depois de criada"></urbi-icone></span>
            </div>`;
      case 'nome':
        return nothing; // o nome mora no topo da janela
      case 'num':
        if (c.so === 'distribuir' && this.valores.distribuir_aporte !== true) return nothing;
        return this._num(c);
      case 'ancora':
        return this._ancora(c.rotulo);
      case 'checkbox':
        return html`<urbi-checkbox data-campo=${c.campo} label=${c.rotulo} ?marcado=${this.valores[c.campo] === true}
          @urbi:checkbox-change=${(e: CustomEvent) => this._set(c.campo, e.detail.marcado)}></urbi-checkbox>`;
      case 'modo':
        return html`<div class="sel-campo p2">
          <urbi-select data-campo="modo_retorno" label=${c.rotulo} .valor=${String(this.valores.modo_retorno ?? 'permuta_financeira')}
            .opcoes=${MODOS_RETORNO}
            @urbi:select-change=${(e: CustomEvent) => this._set('modo_retorno', e.detail.valor)}
          ></urbi-select>
        </div>`;
      case 'info':
        return html`<div class="sel-campo"><span class="sel-rotulo">${c.rotulo}</span><span class="travado">${c.texto}</span></div>`;
    }
  }

  /** As notas explicativas de cada etapa — as mesmas do formulário da página. */
  private _nota(etapa: string): TemplateResult | typeof nothing {
    const t = this.tipo;
    if (etapa === 'geral' && this.modo === 'editar') {
      return html`<p class="nota">O tipo é escolhido ao criar e não muda depois. Para outro tipo, crie uma operação nova.</p>`;
    }
    if (t === 'divida' && etapa === 'amortizacao') {
      return html`<p class="nota">A carência faz parte do prazo de amortização — a parcela é calculada sobre
        <strong>amortização − carência</strong>. Durante a carência paga-se só os juros.</p>`;
    }
    if (t === 'divida' && etapa === 'custos') {
      return html`<p class="nota">Entram em <strong>saídas</strong> — reduzem a TIR do investidor e o fluxo alavancado —,
        nunca no saldo devedor (não são principal). A estruturação é cobrada uma vez, no mês da
        1ª liberação; os outros encargos, uma vez, no mês da contratação; a administração,
        todo mês enquanto houver saldo devedor.</p>`;
    }
    if (t === 'equity' && etapa === 'retorno') {
      const modo = String(this.valores.modo_retorno ?? 'permuta_financeira');
      return html`<p class="nota">${modo === 'permuta_financeira'
        ? html`Incide sobre a <strong>receita líquida</strong> de cada mês, progressivamente.`
        : html`Incide sobre o <strong>resultado final do projeto</strong> e é pago de uma vez, no
            repasse (${rotuloMesRelativo(this.dataInicio, mesRepasse(this.crono))}).`}
        Base calculada pelo estudo — não é digitada aqui.</p>`;
    }
    if (t === 'antecipacao_recebiveis' && etapa === 'cessao') {
      return html`<p class="nota">Cede esse percentual de tudo o que as vendas feitas até o mês da cessão ainda
        vão pagar depois dele — parcelas, saldo a repassar e carteira própria —, descontado o que
        outra antecipação anterior já cedeu. Só os planos de pagamento já aplicados entram no lastro.</p>`;
    }
    if (t === 'antecipacao_recebiveis' && etapa === 'desconto') {
      return html`<p class="nota">O cessionário paga à vista o valor presente dessas parcelas à taxa de desconto;
        a partir do mês seguinte, as parcelas cedidas passam a ir para ele.</p>`;
    }
    if (t === 'antecipacao_recebiveis' && etapa === 'custos') {
      return html`<p class="nota">A estruturação (sobre o valor presente) e os outros custos são cobrados no mês
        da cessão; a administração, todo mês enquanto houver parcela cedida a receber. Entram nas
        saídas e no custo efetivo — não reduzem o lastro.</p>`;
    }
    return nothing;
  }

  render() {
    const etapas = etapasDoTipo(this.tipo);
    const ativa = etapas.find((e) => e.id === this.etapa) ?? etapas[0];
    const comErro = new Set(this.erros.map((e) => e.etapa));
    const errosDaAtiva = this.erros.filter((e) => e.etapa === ativa.id);
    const erroNome = this.erros.find((e) => /“Nome”/.test(e.mensagem));
    const titulo = this.modo === 'criar' ? 'Nova operação' : `Editar ${this.valores.nome || 'operação'}`;
    const secoes = [{
      itens: etapas.map((e) => ({
        id: e.id,
        label: e.label,
        descricao: resumoDaEtapa(this.tipo, e.id, this.valores, this._rotuloTipo(this.tipo), this.dataInicio),
        indicador: comErro.has(e.id) ? 'alerta' : '',
      })),
    }];
    return html`
      <urbi-modal title=${titulo} maxWidth="980px" .closeOnBackdrop=${false}
        @urbi-modal:close=${() => this._cancelar()}>
        <div class="janela">
          <div class="topo">
            <urbi-input data-campo="nome" label="Nome da operação" .valor=${this.valores.nome ?? ''}
              erro=${erroNome ? erroNome.mensagem : ''}
              @urbi:input-change=${(e: CustomEvent) => this._set('nome', e.detail.valor)}
            ></urbi-input>
          </div>
          <div class="colunas">
            <nav class="trilho" aria-label="Etapas da operação">
              <urbi-nav .secoes=${secoes} .ativo=${ativa.id}
                @urbi:nav-selecionar=${(e: CustomEvent) => { if (e.detail?.id) this.etapa = e.detail.id; }}
              ></urbi-nav>
            </nav>
            <section class="campos" aria-label=${ativa.label} data-etapa=${ativa.id}>
              <h3>${ativa.label}</h3>
              <div class="grid">${ativa.campos.map((c) => this._campo(c))}</div>
              ${this._nota(ativa.id)}
              ${errosDaAtiva.length ? html`
                <urbi-banner class="erro-etapa" variante="erro" icone="fa-solid fa-triangle-exclamation">
                  ${errosDaAtiva.map((e) => html`<div>${e.mensagem}</div>`)}
                </urbi-banner>` : nothing}
            </section>
            <aside class="lado" aria-label="Resumo e prévia">
              <div class="resumo">
                <h4>Resumo</h4>
                <div class="kpis">
                  ${this.resumo.map((k) => html`<div class="kpi"><div class="rot">${k.rotulo}</div><div class="val">${k.texto}</div></div>`)}
                </div>
              </div>
              <div class="previa">
                ${this.grafico
                  ? html`<viab-funding-grafico-operacao .serie=${this.grafico} titulo="Prévia do fluxo"></viab-funding-grafico-operacao>`
                  : html`<h4>Prévia do fluxo</h4><p class="sem-previa">Sem movimento a mostrar com estes valores.</p>`}
              </div>
            </aside>
          </div>
          ${this.erroServidor ? html`
            <urbi-banner class="erro-servidor" variante="erro" icone="fa-solid fa-triangle-exclamation">
              ${this.erroServidor}
            </urbi-banner>` : nothing}
          <div class="rodape">
            ${this.tentouConfirmar && this.erros.length
              ? html`<span class="pendencias" role="status">Corrija ${this.erros.length === 1 ? 'a etapa marcada' : 'as etapas marcadas'} antes de ${this.modo === 'criar' ? 'criar' : 'salvar'}.</span>`
              : nothing}
            <span class="espaco"></span>
            <urbi-botao variante="fantasma" @click=${() => this._cancelar()}>Cancelar</urbi-botao>
            <urbi-botao variante="primario" class="confirmar"
              ?desabilitado=${this.gravando || (this.modo === 'editar' && !this.alterada)}
              @click=${() => this._confirmar()}>${this.modo === 'criar' ? 'Criar operação' : 'Salvar alterações'}</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'viab-funding-janela': ViabFundingJanela }
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarFunding, criarOperacaoFunding, atualizarOperacaoFunding, removerOperacaoFunding,
} from './viabilidade-api.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { mesRepasse, rotuloMesRelativo, type EventoCrono } from './fluxo-shared.js';
import {
  fundingDoEstudo, indicadoresOperacao, receitaLiquidaComCorretagemMensal,
  reordenarCamadas, camadasComOrdemAlterada, eDivida,
  type FundingCalc, type OperacaoFunding, type TipoOperacao,
} from './funding-motor.js';
import './viab-num.js';

// ─────────────────────────────────────────────────────────────────────────
// Sub-aba "Viabilidade → Funding" (#355, item 48 da Rodada 7).
//
// Reescrita completa da antiga tela de Capital Stack. O modelo tem 3 tipos de
// operação INDEPENDENTES (sem waterfall, sem prioridades, sem status), com os
// campos da planilha `fluxo_investidor_FORMULAS` — ver
// docs/viabilidade/fluxo-investidor-formulas.md.
//
// O que a tela mostra, por operação: os campos de ENTRADA (só o que é da
// operação) e o painel "visão do investidor" (investimento, retorno, TIR, VPL,
// payback), que é a leitura que dá nome ao documento do autor e que a tela
// antiga não tinha por instrumento.
//
// D8: as premissas do projeto (receita líquida, resultado final, mês do
// repasse) NÃO são redigitadas aqui — vêm do próprio estudo, via
// `calcularFluxo`. É o que impede esta aba de contar uma história diferente
// da aba Resultados.
//
// Prévia por tecla: cada campo recalcula sobre um DRAFT em memória, sem tocar
// a API; só "Salvar" persiste — mesmo padrão da tela anterior e do #51/#252.
// ─────────────────────────────────────────────────────────────────────────

const TIPOS: { valor: TipoOperacao; rotulo: string; icone: string }[] = [
  { valor: 'financiamento_producao', rotulo: 'Financiamento à produção', icone: 'fa-solid fa-building-columns' },
  { valor: 'divida', rotulo: 'Dívida', icone: 'fa-solid fa-file-invoice-dollar' },
  { valor: 'equity', rotulo: 'Equity', icone: 'fa-solid fa-handshake' },
];

const MODOS_RETORNO: { valor: string; rotulo: string }[] = [
  { valor: 'permuta_financeira', rotulo: 'Permuta financeira (% da receita líquida, mês a mês)' },
  { valor: 'resultado_final', rotulo: '% do resultado final (pago no repasse)' },
];

// Mesmas âncoras das linhas de Custo (#249/#339) — número de mês absoluto
// quebra quando o Cronograma muda; âncora acompanha (D11).
const EVENTOS_ANCORA: { valor: string; rotulo: string }[] = [
  { valor: 'planejamento', rotulo: 'Planejamento' },
  { valor: 'pre_lancamento', rotulo: 'Pré-lançamento' },
  { valor: 'lancamento', rotulo: 'Lançamento' },
  { valor: 'obra', rotulo: 'Obra' },
  { valor: 'pos_obra', rotulo: 'Pós-obras' },
  { valor: 'customizado', rotulo: 'Mês específico' },
];

const rotuloTipo = (t: string) => TIPOS.find((x) => x.valor === t)?.rotulo ?? t;

@customElement('viab-funding')
export class ViabFunding extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private operacoes: any[] = [];
  @state() private carregando = true;
  @state() private draft: Record<number, any> = {};
  @state() private salvandoId: number | null = null;
  @state() private movendoId: number | null = null;
  @state() private removerId: number | null = null;
  @state() private criando = false;
  @state() private calc: FluxoCalc | null = null;
  @state() private funding: FundingCalc | null = null;

  private carregado = false;
  private crono: EventoCrono[] = [];
  private dataInicio: string | null = null;
  private custos: any[] = [];
  private taxaDescontoAa = 12;
  // Cache do que `_carregar` já buscou, para a prévia por tecla recalcular sem
  // refazer chamadas de API a cada dígito.
  private receitaLiquida: number[] = [];

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .barra { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .barra .espaco { flex: 1; }
    .ops { display: flex; flex-direction: column; gap: 14px; }
    .op-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .op-cab .espaco { flex: 1; }
    .op-cab urbi-input { min-width: 220px; }
    .secao { margin-top: 12px; }
    .secao h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .grid > * { width: 190px; max-width: 100%; box-sizing: border-box; }
    .grid > .p2 { width: 300px; }
    .sel-campo { display: flex; flex-direction: column; gap: 4px; width: 190px; }
    .sel-campo.p2 { width: 300px; }
    .sel-rotulo { font-size: 0.75rem; text-transform: uppercase; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700; }
    .form-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

    /* Painel do investidor: markup próprio + tokens, mesmo padrão adotado na
       #352 — urbi-kpi não serve aqui porque a caixa precisa de rótulo, valor e
       uma legenda de contexto na mesma moldura. */
    .ind { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 6px; }
    .ind-card {
      background: var(--cor-superficie, rgba(255,255,255,0.04));
      border: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
      border-radius: 8px; padding: 10px 12px; min-width: 0;
    }
    .ind-card .rot {
      font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .ind-card .val { font-size: 1.05rem; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums; }
    .ind-card.pos .val { color: var(--cor-sucesso, #13A98D); }
    .ind-card.neg .val { color: var(--cor-erro, #D45A3A); }
    .nota { font-size: 0.78rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-top: 8px; }
  `];

  updated(mudou: Map<string, unknown>) {
    if (mudou.has('estudo') && this.estudo?.id && !this.carregado) {
      this.carregado = true;
      this._carregar();
    }
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const [receitas, custos, curvas, crono, params, ops] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarFunding(this.estudo.id),
      ]);
      this.operacoes = ops?.erro ? [] : (ops.dados || []);
      this.custos = custos?.erro ? [] : (custos.dados || []);
      this.crono = crono?.erro ? [] : (crono.dados || []);
      this.dataInicio = params?.erro ? null : (params.data_inicio_projeto ?? null);
      this.taxaDescontoAa = params?.erro ? 12 : (Number(params.taxa_desconto_aa) || 12);

      const config: FluxoConfig = {
        dataInicio: this.dataInicio,
        taxaDescontoAa: this.taxaDescontoAa,
        cronograma: this.crono,
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: this.custos,
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
        ret: params?.erro ? undefined : (params.ret ?? undefined),
      } as FluxoConfig;
      this.calc = calcularFluxo(config);
      this.receitaLiquida = receitaLiquidaComCorretagemMensal(
        this.calc.receitaMensal, this.calc.linhasCusto, this.custos,
      );
      this._recalcular();
    } finally {
      this.carregando = false;
    }
  }

  /** Prévia sobre o DRAFT: o que está sendo digitado já aparece nos indicadores. */
  private _recalcular() {
    if (!this.calc) { this.funding = null; return; }
    const efetivas = this.operacoes.map((o) => ({ ...o, ...(this.draft[o.id] ?? {}) })) as OperacaoFunding[];
    const resultadoFinal = this.calc.fluxoAcumulado[this.calc.fluxoAcumulado.length - 1] ?? 0;
    this.funding = fundingDoEstudo(
      efetivas, this.calc.fluxoMensal, this.receitaLiquida,
      resultadoFinal, mesRepasse(this.crono), this.taxaDescontoAa,
    );
  }

  private _set(o: any, campo: string, valor: any) {
    this.draft = { ...this.draft, [o.id]: { ...(this.draft[o.id] ?? {}), [campo]: valor } };
    this._recalcular();
  }

  private _valor(o: any, campo: string): any {
    const d = this.draft[o.id];
    return d && campo in d ? d[campo] : o[campo];
  }

  /** Nome padrão por tipo, no formato do #341 (maior sufixo + 1, não contagem). */
  private _nomePadrao(tipo: TipoOperacao): string {
    if (tipo === 'financiamento_producao') return 'Financiamento à produção';
    const rotulo = tipo === 'divida' ? 'Dívida' : 'Equity';
    const usados = this.operacoes
      .filter((o) => o.tipo === tipo)
      .map((o) => /^(\d+)/.exec(String(o.nome ?? ''))?.[1])
      .map((s) => Number(s) || 0);
    const proximo = (usados.length ? Math.max(...usados) : 0) + 1;
    return `${proximo}º ${rotulo}`;
  }

  private _temFinanciamento(): boolean {
    return this.operacoes.some((o) => o.tipo === 'financiamento_producao');
  }

  private async _adicionar(tipo: TipoOperacao) {
    if (this.criando) return;
    this.criando = true;
    try {
      const r = await criarOperacaoFunding(this.estudo.id, {
        tipo,
        nome: this._nomePadrao(tipo),
        ordem: this.operacoes.length,
        // Defaults úteis por tipo — evitam a operação nascer inerte e sem
        // sentido (dívida sem prazo nunca amortiza).
        ...(eDivida(tipo)
          ? { taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12, aporte_meses: 1 }
          : { modo_retorno: 'permuta_financeira', pct_retorno: 0 }),
      });
      if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Não foi possível criar a operação.', 'erro'); return; }
      await this._carregar();
    } finally {
      this.criando = false;
    }
  }

  private async _salvar(o: any) {
    const patch = this.draft[o.id];
    if (!patch || this.salvandoId) return;
    this.salvandoId = o.id;
    try {
      const r = await atualizarOperacaoFunding(this.estudo.id, o.id, patch);
      if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Não foi possível salvar.', 'erro'); return; }
      const { [o.id]: _, ...resto } = this.draft;
      this.draft = resto;
      urbiVerso.notificar('Operação salva.', 'sucesso');
      await this._carregar();
    } finally {
      this.salvandoId = null;
    }
  }

  private async _remover(id: number) {
    this.removerId = null;
    const r = await removerOperacaoFunding(this.estudo.id, id);
    if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Não foi possível remover.', 'erro'); return; }
    await this._carregar();
  }

  private async _mover(id: any, direcao: 'cima' | 'baixo') {
    if (this.movendoId) return;
    this.movendoId = id;
    try {
      const nova = reordenarCamadas(this.operacoes, id, direcao);
      const mudaram = camadasComOrdemAlterada(this.operacoes, nova);
      if (mudaram.length === 0) return;
      this.operacoes = nova;
      for (const o of mudaram) {
        const r = await atualizarOperacaoFunding(this.estudo.id, o.id, { ordem: o.ordem });
        if (r?.erro) { urbiVerso.notificar('Não foi possível reordenar.', 'erro'); await this._carregar(); return; }
      }
    } finally {
      this.movendoId = null;
    }
  }

  private _num(o: any, campo: string, label: string, sufixo: string, casas = 2): TemplateResult {
    return html`<viab-num label=${label} sufixo=${sufixo} casas-decimais=${String(casas)}
      ?desabilitado=${!this.editavel}
      .valor=${this._valor(o, campo) ?? null}
      @urbi:input-numero-change=${(e: CustomEvent) => this._set(o, campo, e.detail.valor ?? 0)}
    ></viab-num>`;
  }

  private _renderAncora(o: any): TemplateResult {
    const evento = String(this._valor(o, 'cronograma_evento') ?? 'customizado');
    return html`
      <div class="sel-campo p2">
        <span class="sel-rotulo">Mês do aporte</span>
        <urbi-select .valor=${evento} .opcoes=${EVENTOS_ANCORA.map((e) => ({ valor: e.valor, rotulo: e.rotulo }))}
          ?desabilitado=${!this.editavel}
          @urbi:select-change=${(e: CustomEvent) => this._set(o, 'cronograma_evento', e.detail.valor)}
        ></urbi-select>
      </div>
      ${evento === 'customizado'
        ? this._num(o, 'inicio_mes', 'Mês', 'º mês', 0)
        : html`<div class="sel-campo">
            <span class="sel-rotulo">Início derivado</span>
            <span>${rotuloMesRelativo(this.dataInicio, Number(this._valor(o, 'inicio_mes')) || 0)} 🔒</span>
          </div>`}
    `;
  }

  private _renderCamposDivida(o: any): TemplateResult {
    const distribuir = this._valor(o, 'distribuir_aporte') === true;
    return html`
      <div class="secao">
        <h4>Operação</h4>
        <div class="grid">
          ${this._num(o, 'valor', 'Valor', 'R$')}
          ${this._renderAncora(o)}
        </div>
      </div>
      <div class="secao">
        <h4>Liberação</h4>
        <div class="grid">
          <urbi-checkbox ?marcado=${distribuir} ?desabilitado=${!this.editavel}
            label="Distribuir aporte"
            @urbi:checkbox-change=${(e: CustomEvent) => this._set(o, 'distribuir_aporte', e.detail.marcado)}
          ></urbi-checkbox>
          ${distribuir ? this._num(o, 'aporte_meses', 'Aporte em', 'meses', 0) : nothing}
        </div>
      </div>
      <div class="secao">
        <h4>Custo e prazos</h4>
        <div class="grid">
          ${this._num(o, 'taxa_anual', 'Taxa', '% a.a.')}
          ${this._num(o, 'periodo_amortizacao_meses', 'Amortização', 'meses', 0)}
          ${this._num(o, 'periodo_carencia_meses', 'Carência', 'meses', 0)}
        </div>
        <p class="nota">A carência faz parte do prazo de amortização — a parcela é calculada sobre
          <strong>amortização − carência</strong>. Durante a carência paga-se só os juros.</p>
      </div>
    `;
  }

  private _renderCamposEquity(o: any): TemplateResult {
    const modo = String(this._valor(o, 'modo_retorno') ?? 'permuta_financeira');
    return html`
      <div class="secao">
        <h4>Aporte</h4>
        <div class="grid">
          ${this._num(o, 'valor', 'Valor do aporte', 'R$')}
          ${this._renderAncora(o)}
        </div>
      </div>
      <div class="secao">
        <h4>Retorno</h4>
        <div class="grid">
          <div class="sel-campo p2">
            <span class="sel-rotulo">Modo</span>
            <urbi-select .valor=${modo} .opcoes=${MODOS_RETORNO}
              ?desabilitado=${!this.editavel}
              @urbi:select-change=${(e: CustomEvent) => this._set(o, 'modo_retorno', e.detail.valor)}
            ></urbi-select>
          </div>
          ${this._num(o, 'pct_retorno', '% de retorno', '%')}
        </div>
        <p class="nota">${modo === 'permuta_financeira'
          ? html`Incide sobre a <strong>receita líquida</strong> de cada mês, progressivamente.`
          : html`Incide sobre o <strong>resultado final do projeto</strong> e é pago de uma vez, no
              repasse (${rotuloMesRelativo(this.dataInicio, mesRepasse(this.crono))}).`}
          Base calculada pelo estudo — não é digitada aqui.</p>
      </div>
    `;
  }

  /** Painel "visão do investidor" — o que dá nome ao documento do autor. */
  private _renderIndicadores(o: any): TemplateResult {
    const serie = this.funding?.operacoes.find((s) => String(s.operacao.id) === String(o.id));
    if (!serie) return html`${nothing}`;
    const ind = indicadoresOperacao(serie, this.taxaDescontoAa);
    const card = (rot: string, val: string, classe = '') =>
      html`<div class="ind-card ${classe}"><div class="rot">${rot}</div><div class="val">${val}</div></div>`;
    return html`
      <div class="secao">
        <h4>Visão do investidor</h4>
        <div class="ind">
          ${card('Investimento', fmtR$(ind.investimentoTotal), 'neg')}
          ${card('Retorno total', fmtR$(ind.retornoTotal), 'pos')}
          ${card('Lucro', fmtR$(ind.lucro), ind.lucro >= 0 ? 'pos' : 'neg')}
          ${card('TIR', ind.tirAnual === null ? '—' : `${fmtPct(ind.tirAnual * 100)} a.a.`)}
          ${card('VPL', fmtR$(ind.vpl), ind.vpl >= 0 ? 'pos' : 'neg')}
          ${card('Payback', ind.paybackMes === null ? '—' : rotuloMesRelativo(this.dataInicio, ind.paybackMes))}
          ${eDivida(o.tipo) ? card('Juros pagos', fmtR$(ind.jurosPagos)) : nothing}
          ${eDivida(o.tipo) ? card('Saldo final', fmtR$(ind.saldoFinal), Math.abs(ind.saldoFinal) < 0.01 ? '' : 'neg') : nothing}
        </div>
        ${eDivida(o.tipo) && Math.abs(ind.saldoFinal) >= 0.01
          ? html`<p class="nota">⚠️ A dívida não zera dentro do horizonte do estudo: o prazo de
              amortização ultrapassa o fim do projeto.</p>`
          : nothing}
      </div>
    `;
  }

  private _renderOperacao(o: any, i: number): TemplateResult {
    const temDraft = !!this.draft[o.id];
    return html`
      <urbi-card>
        <div class="op-cab">
          <urbi-icone classe=${TIPOS.find((t) => t.valor === o.tipo)?.icone ?? 'fa-solid fa-coins'}></urbi-icone>
          <urbi-input .valor=${this._valor(o, 'nome') ?? ''} ?desabilitado=${!this.editavel}
            @urbi:input-change=${(e: CustomEvent) => this._set(o, 'nome', e.detail.valor)}
          ></urbi-input>
          <urbi-badge>${rotuloTipo(o.tipo)}</urbi-badge>
          <span class="espaco"></span>
          ${this.editavel ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-up"
              ?desabilitado=${i === 0 || !!this.movendoId} @click=${() => this._mover(o.id, 'cima')}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-down"
              ?desabilitado=${i === this.operacoes.length - 1 || !!this.movendoId}
              @click=${() => this._mover(o.id, 'baixo')}></urbi-botao>
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => { this.removerId = o.id; }}></urbi-botao>` : nothing}
        </div>

        ${eDivida(o.tipo) ? this._renderCamposDivida(o) : this._renderCamposEquity(o)}
        ${this._renderIndicadores(o)}

        ${this.editavel ? html`
          <div class="form-acoes">
            <urbi-botao variante="primario" pequeno icone="fa-solid fa-floppy-disk"
              ?desabilitado=${!temDraft || this.salvandoId === o.id}
              @click=${() => this._salvar(o)}>Salvar</urbi-botao>
          </div>` : nothing}
      </urbi-card>
    `;
  }

  render() {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    if (this.carregando) return html`<urbi-loading mensagem="Carregando funding..."></urbi-loading>`;

    return html`
      ${this.editavel ? html`
        <div class="barra">
          ${TIPOS.map((t) => html`
            <urbi-botao variante="secundario" pequeno icone=${t.icone}
              ?desabilitado=${this.criando || (t.valor === 'financiamento_producao' && this._temFinanciamento())}
              title=${t.valor === 'financiamento_producao' && this._temFinanciamento()
                ? 'Só pode haver um Financiamento à produção por estudo'
                : `Adicionar ${t.rotulo}`}
              @click=${() => this._adicionar(t.valor)}>${t.rotulo}</urbi-botao>`)}
        </div>` : nothing}

      ${this.operacoes.length === 0
        ? html`<urbi-estado-vazio icone="fa-solid fa-coins"
            mensagem="Nenhuma operação de funding. O Fluxo de Caixa real é igual ao Livre."></urbi-estado-vazio>`
        : html`<div class="ops">${this.operacoes.map((o, i) => this._renderOperacao(o, i))}</div>`}

      ${this.removerId !== null ? html`
        <urbi-modal title="Remover operação" maxWidth="420px"
          @urbi-modal:close=${() => { this.removerId = null; }}>
          <p>Remover <strong>${this.operacoes.find((o) => o.id === this.removerId)?.nome ?? 'a operação'}</strong>?
            Ela sai do estudo e do Fluxo de Caixa.</p>
          <div class="form-acoes">
            <urbi-botao variante="fantasma" @click=${() => { this.removerId = null; }}>Cancelar</urbi-botao>
            <urbi-botao variante="perigo" @click=${() => this._remover(this.removerId as number)}>Remover</urbi-botao>
          </div>
        </urbi-modal>` : nothing}
    `;
  }
}

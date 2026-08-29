import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtR$Kpi, fmtPct } from './viab-format.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarFundingOperacoes, criarFundingOperacao, atualizarFundingOperacao, removerFundingOperacao,
} from './viabilidade-api.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { dinheiroParaRotulo, mesRepasse, rotuloMesRelativo, type EventoCrono } from './fluxo-shared.js';
import {
  fundingDoEstudo, indicadoresOperacao, indicadoresFinanciamentoProducao,
  receitaLiquidaComCorretagemMensal, linhasFinanciaveisPadrao,
  reordenarCamadas, camadasComOrdemAlterada, eDivida, riscoTarifaDuplicada,
  PADRAO_EXPOSICAO_MINIMA, PADRAO_PERCENTUAL_FINANCIAVEL, PADRAO_AMORTIZAR_COM_CAIXA,
  type FundingCalc, type OperacaoFunding, type TipoOperacao, type SerieOperacao,
} from './funding-motor.js';
import './viab-num.js';

// ─────────────────────────────────────────────────────────────────────────
// Sub-aba "Viabilidade → Funding" (#355, item 48 da Rodada 7).
//
// Reescrita completa da antiga tela de Capital Stack (4 instrumentos com
// waterfall). O modelo novo tem 3 tipos de operação INDEPENDENTES (sem
// waterfall, sem prioridades, sem status):
//
//  · `financiamento_producao` — ÚNICO por estudo. Decisão do autor
//    (2026-08-12): preserva o modelo de exposição mínima/catch-up
//    retroativo/cash sweep aprovado na #405 (planilha `Incorp Individual`) —
//    NÃO a matemática de calendário/Price da planilha
//    `fluxo_investidor_FORMULAS`. Por isso tem seu PRÓPRIO editor de campos
//    (`_renderCamposFinanciamentoProducao`) e seu próprio painel de
//    indicadores (§37) + gráfico (§39), em vez de reusar
//    `_renderCamposDivida`/o painel genérico de investidor;
//  · `divida`                 — calendário + Price com carência, campos da
//    planilha `fluxo_investidor_FORMULAS`;
//  · `equity`                 — aporte + retorno, em dois modos.
//
// Para `divida`/`equity`, a tela mostra os campos de ENTRADA e o painel
// "visão do investidor" (investimento, retorno, TIR, VPL, payback) —
// `indicadoresOperacao`, da própria planilha `fluxo_investidor_FORMULAS`.
//
// D8: as premissas do projeto (receita líquida, resultado final, mês do
// repasse) NÃO são redigitadas aqui — vêm do próprio estudo, via
// `calcularFluxo`. É o que impede esta aba de contar uma história diferente
// da aba Resultados.
//
// Prévia por tecla: cada campo recalcula sobre um DRAFT em memória, sem tocar
// a API; só "Salvar" persiste — mesmo padrão da tela anterior e do #51/#252.
// ─────────────────────────────────────────────────────────────────────────

// #466: `divida` já É o produto de capital de giro por calendário — a própria
// planilha do autor rotula a aba `divida` de `fluxo_investidor_FORMULAS.xlsx`
// como a folha de Capital de Giro (A8 = "Valor CG (R$):", B18 = "Libera CG",
// C18 = "Carencia CG"). O rótulo abaixo deixa isso visível na UI; o
// identificador persistido (`tipo='divida'`) não muda.
//
// 🛑 DECISÃO DO AUTOR, 2026-08-22 — linha de crédito rotativa RECUSADA. Não
// ressuscitar. O desenho (saque dirigido por falta de caixa, devolução
// automática quando sobra, limite reutilizável) foi proposto e recusado: ele
// reintroduziria a competição por caixa entre operações que a reescrita do
// funding (#355) apagou de propósito. Não há migração para isso, não há
// bump de `versao`.
const TIPOS: { valor: TipoOperacao; rotulo: string; icone: string }[] = [
  { valor: 'financiamento_producao', rotulo: 'Financiamento à produção', icone: 'fa-solid fa-building-columns' },
  { valor: 'divida', rotulo: 'Dívida / Capital de giro', icone: 'fa-solid fa-file-invoice-dollar' },
  { valor: 'equity', rotulo: 'Equity', icone: 'fa-solid fa-handshake' },
];

const MODOS_RETORNO: { valor: string; rotulo: string }[] = [
  { valor: 'permuta_financeira', rotulo: 'Permuta financeira (% da receita líquida, mês a mês)' },
  { valor: 'resultado_final', rotulo: '% do resultado final (pago no repasse)' },
];

// Mesmas âncoras das linhas de Custo (#249/#339) — número de mês absoluto
// quebra quando o Cronograma muda; âncora acompanha (D11). Não se aplica a
// `financiamento_producao`: a janela dele vem do Cronograma diretamente
// (marcosObra), não de `inicio_mes`.
const EVENTOS_ANCORA: { valor: string; rotulo: string }[] = [
  { valor: 'planejamento', rotulo: 'Planejamento' },
  { valor: 'pre_lancamento', rotulo: 'Pré-lançamento' },
  { valor: 'lancamento', rotulo: 'Lançamento' },
  { valor: 'obra', rotulo: 'Obra' },
  { valor: 'pos_obra', rotulo: 'Pós-obras' },
  { valor: 'customizado', rotulo: 'Mês específico' },
];

const rotuloTipo = (t: string) => TIPOS.find((x) => x.valor === t)?.rotulo ?? t;
const n = (v: any): number => Number(v) || 0;

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
    /* §17: aviso regulatório permanente, acima de tudo na aba. */
    urbi-banner.aviso-regulatorio { display: block; margin-bottom: 16px; }
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
    .custo-lista { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow: auto; }

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
    .ind-card .val {
      font-size: 1.05rem; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums;
      /* #579: fmtR$ intercala R$ e o número com um ESPAÇO NÃO-QUEBRÁVEL
         (Intl.NumberFormat pt-BR/BRL — U+00A0) — sem overflow-wrap o valor é
         UM token que não quebra sozinho. Markup próprio (sem shadow DOM),
         mesmo mecanismo de fluxo-tabela.ts .kpi-card .valor. */
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .ind-card.pos .val { color: var(--cor-sucesso, #13A98D); }
    .ind-card.neg .val { color: var(--cor-erro, #D45A3A); }
    .nota { font-size: 0.78rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-top: 8px; }

    /* §39 — mesmo padrão de gráfico SVG inline da antiga tela-capital-stack.ts. */
    .grafico-card { margin-top: 12px; }
    svg.grafico { width: 100%; height: auto; overflow: visible; font-variant-numeric: tabular-nums; }
    .linha-entradas { stroke: var(--cor-sucesso, #13a98d); fill: none; stroke-width: 2; }
    .linha-saidas { stroke: var(--cor-erro, #d45a3a); fill: none; stroke-width: 2; }
    .linha-custo-elegivel { stroke: var(--cor-texto-sec, rgba(255,255,255,0.45)); fill: none; stroke-width: 1.5; stroke-dasharray: 4 3; }
    .linha-saldo-devedor { stroke: var(--cor-alerta, #e0a33e); fill: none; stroke-width: 2.5; }
    .eixo-mes { fill: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: 9px; }
    .grafico-legenda { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.72rem; margin-top: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.7)); }
    .grafico-legenda .ponto { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
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
        listarFundingOperacoes(this.estudo.id),
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
        ret: params?.erro ? undefined : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
        // #473: default true preserva o comportamento histórico (VGV bruto).
        corretagemSobrePermutaFisica: this.estudo?.corretagem_sobre_permuta_fisica !== false,
        // #446: o horizonte precisa cobrir a quitação das operações, senão a
        // série é cortada e `saldoFinal` exibe um saldo truncado.
        operacoesFunding: this.operacoes,
      };
      this.calc = calcularFluxo(config);
      this.receitaLiquida = receitaLiquidaComCorretagemMensal(
        this.calc.receitaMensal, this.calc.linhasCusto, this.custos,
      );
      this._recalcular();
    } finally {
      this.carregando = false;
    }
  }

  // #474 (Passos 23–25, D-Q03 2026-08-22): esta montagem
  // (resultadoFinal → fundingDoEstudo) é LOCAL. O app não tem uma função
  // única para essa sequência (`docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`)
  // — cada consumidor remonta à mão, e pode divergir (R-A36). Fonte única
  // foi CONSIDERADA E RECUSADA pelo autor; ver
  // `docs/viabilidade/fluxo-investidor-formulas.md` §9. Os outros quatro
  // consumidores: frontend/tela-fluxo-ver.ts:179 · frontend/tela-cenarios.ts:240
  // · frontend/tela-resumo.ts:182 (só remonta resultadoFinal, não chama
  // fundingDoEstudo) · scripts/conferir-estudo.ts:153.
  /** Prévia sobre o DRAFT: o que está sendo digitado já aparece nos indicadores. */
  private _recalcular() {
    if (!this.calc) { this.funding = null; return; }
    const efetivas = this.operacoes.map((o) => ({ ...o, ...(this.draft[o.id] ?? {}) })) as OperacaoFunding[];
    const resultadoFinal = this.calc.fluxoAcumulado[this.calc.fluxoAcumulado.length - 1] ?? 0;
    this.funding = fundingDoEstudo(
      efetivas, this.calc.fluxoMensal, this.receitaLiquida,
      resultadoFinal, mesRepasse(this.crono), this.taxaDescontoAa,
      { custosRaw: this.custos, linhasCusto: this.calc.linhasCusto, cronograma: this.crono },
    );
  }

  // #442: este rótulo lia `orcamento_valor` cru — a mesma coluna que a issue
  // mostrou congelada. A decisão mora em `dinheiroParaRotulo`, pura e testada.
  private _rotuloValor(custo: any): string {
    const v = dinheiroParaRotulo(custo, this.calc?.linhasCusto ?? []);
    return v === null ? '—' : fmtR$(v);
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
      const defaults = tipo === 'financiamento_producao'
        // §4.3 — os defaults da planilha `Incorp Individual`, para a camada
        // não nascer inerte (sem gatilho de exposição mínima ela nunca libera).
        ? {
          taxa_anual: 12.5, exposicao_minima: PADRAO_EXPOSICAO_MINIMA,
          percentual_financiavel: PADRAO_PERCENTUAL_FINANCIAVEL,
          amortizar_com_caixa_disponivel: PADRAO_AMORTIZAR_COM_CAIXA,
        }
        : eDivida(tipo)
          ? { taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12, aporte_meses: 1 }
          : { modo_retorno: 'permuta_financeira', pct_retorno: 0 };
      const r = await criarFundingOperacao(this.estudo.id, {
        tipo, nome: this._nomePadrao(tipo), ordem: this.operacoes.length, ...defaults,
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
      const r = await atualizarFundingOperacao(this.estudo.id, o.id, patch);
      if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Não foi possível salvar.', 'erro'); return; }
      const { [o.id]: _removido, ...resto } = this.draft;
      this.draft = resto;
      urbiVerso.notificar('Operação salva.', 'sucesso');
      await this._carregar();
    } finally {
      this.salvandoId = null;
    }
  }

  private async _remover(id: number) {
    this.removerId = null;
    const r = await removerFundingOperacao(this.estudo.id, id);
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
        const r = await atualizarFundingOperacao(this.estudo.id, o.id, { ordem: o.ordem });
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
      <div class="secao">
        <h4>Tarifas e encargos</h4>
        <div class="grid">
          ${this._num(o, 'taxa_estruturacao_pct', 'Estruturação', '%')}
          ${this._num(o, 'taxa_administracao_mensal', 'Administração', 'R$/mês')}
          ${this._num(o, 'outros_encargos_iniciais', 'Outros encargos', 'R$')}
        </div>
        <p class="nota">
          Entram em <strong>saídas</strong> — reduzem a TIR do investidor e o fluxo alavancado —,
          nunca no saldo devedor (não são principal). A estruturação é cobrada uma vez, no mês da
          1ª liberação; os outros encargos, uma vez, no mês da contratação; a administração,
          todo mês enquanto houver saldo devedor.
        </p>
      </div>
    `;
  }

  /**
   * Financiamento à produção (§4.3) — o contrato é único: liberação por
   * medição do custo elegível com catch-up retroativo e cash sweep. Por isso
   * NÃO há aqui seletor de política de amortização, carência, prazo,
   * vencimento nem liberação programada: são parâmetros da planilha
   * `fluxo_investidor_FORMULAS`, que este produto não usa (ver o cabeçalho de
   * `funding-motor.ts`). Quem precisa deles usa Dívida.
   */
  private _renderCamposFinanciamentoProducao(o: any): TemplateResult {
    const selecao: number[] | null | undefined = this._valor(o, 'custo_linha_ids');
    const padrao = linhasFinanciaveisPadrao(this.custos);
    const usandoPadrao = !Array.isArray(selecao) || selecao.length === 0;
    const efetiva = usandoPadrao ? padrao : selecao;
    const amortizaAntes = this._valor(o, 'amortizar_com_caixa_disponivel');
    const percentualFinanciavel = this._valor(o, 'percentual_financiavel');
    return html`
      <div class="secao">
        <h4>Contrato</h4>
        <div class="grid">
          ${this._num(o, 'taxa_anual', 'Taxa', '% a.a.')}
          ${this._num(o, 'exposicao_minima', 'Exposição mín. p/ liberação', '%')}
          ${this._num(o, 'percentual_financiavel', '% do custo financiado', '%')}
        </div>
        <p class="nota">
          O banco só começa a liberar quando o custo financiável incorrido atinge a exposição
          mínima; nesse mês a liberação cobre retroativamente todo o custo já incorrido. A janela de
          liberação e o mês das chaves vêm do Cronograma do estudo, não daqui.
          Deixe o Valor em zero para não ter teto de crédito — o principal para sozinho em
          ${fmtPct(percentualFinanciavel !== undefined && percentualFinanciavel !== null
            ? Number(percentualFinanciavel) : PADRAO_PERCENTUAL_FINANCIAVEL)}
          da base financiável.
        </p>
        <urbi-checkbox
          label="Caixa disponível amortiza antes das chaves"
          ?desabilitado=${!this.editavel}
          ?marcado=${amortizaAntes === undefined || amortizaAntes === null ? PADRAO_AMORTIZAR_COM_CAIXA : Boolean(amortizaAntes)}
          @urbi:checkbox-change=${(e: CustomEvent) => this._set(o, 'amortizar_com_caixa_disponivel', e.detail.marcado)}
        ></urbi-checkbox>
        <p class="nota">Depois da entrega das chaves a amortização passa a ser obrigatória, marcado ou não.</p>
      </div>
      <div class="secao">
        <div class="op-cab">
          <h4>Base financiável (linhas de custo do estudo)</h4>
          <span class="espaco"></span>
          ${this.editavel ? html`<urbi-botao variante="secundario" pequeno
            @click=${() => this._set(o, 'custo_linha_ids', padrao)}>Usar base padrão</urbi-botao>` : nothing}
        </div>
        ${usandoPadrao ? html`<p class="nota">
          Sem seleção própria — usando a base padrão: pagamento à vista do terreno, construção,
          outorga, projetos e aprovações.
        </p>` : nothing}
        <div class="custo-lista">
          ${this.custos.map((custo) => html`
            <urbi-checkbox
              label=${`${custo.categoria || 'Custo'} — ${this._rotuloValor(custo)}`}
              ?desabilitado=${!this.editavel}
              ?marcado=${efetiva.includes(custo.id)}
              @urbi:checkbox-change=${(e: CustomEvent) => {
                const atuais: number[] = Array.isArray(selecao) ? selecao : efetiva;
                const novos = e.detail.marcado
                  ? [...new Set([...atuais, custo.id])]
                  : atuais.filter((id) => id !== custo.id);
                this._set(o, 'custo_linha_ids', novos);
              }}
            ></urbi-checkbox>`)}
        </div>
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

  /** Painel "visão do investidor" — o que dá nome ao documento do autor (planilha `fluxo_investidor_FORMULAS`). */
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
          ${card('Investimento', fmtR$Kpi(ind.investimentoTotal), 'neg')}
          ${card('Retorno total', fmtR$Kpi(ind.retornoTotal), 'pos')}
          ${card('Lucro', fmtR$Kpi(ind.lucro), ind.lucro >= 0 ? 'pos' : 'neg')}
          ${card('TIR', ind.tirAnual === null ? '—' : `${fmtPct(ind.tirAnual * 100)} a.a.`)}
          ${card('VPL', fmtR$Kpi(ind.vpl), ind.vpl >= 0 ? 'pos' : 'neg')}
          ${card('Payback', ind.paybackMes === null ? '—' : rotuloMesRelativo(this.dataInicio, ind.paybackMes))}
          ${eDivida(o.tipo) ? card('Juros pagos', fmtR$Kpi(ind.jurosPagos)) : nothing}
          ${eDivida(o.tipo) ? card('Saldo final', fmtR$Kpi(ind.saldoFinal), Math.abs(ind.saldoFinal) < 0.01 ? '' : 'neg') : nothing}
        </div>
        ${eDivida(o.tipo) && Math.abs(ind.saldoFinal) >= 0.01
          ? html`<p class="nota">⚠️ A dívida não zera: no mês da quitação contratual ainda resta
              saldo devedor.</p>`
          : nothing}
      </div>
    `;
  }

  /**
   * §37 — indicadores de resumo do Financiamento à produção. Lidos de
   * `indicadoresFinanciamentoProducao`, que só consulta as séries que o motor
   * já produziu: nenhuma regra de negócio vive aqui.
   */
  private _renderIndicadoresFinanciamentoProducao(serie: SerieOperacao): TemplateResult {
    const ind = indicadoresFinanciamentoProducao(serie);
    if (!ind) return html`${nothing}`;
    const mes = (m: number | null) => (m == null ? '—' : rotuloMesRelativo(this.dataInicio, m));
    return html`
      <div class="secao">
        <h4>Financiamento à produção — resumo</h4>
        <div class="ind">
          <div class="ind-card"><div class="rot">Custo financiável total</div><div class="val">${fmtR$Kpi(ind.custoFinanciavelTotal)}</div></div>
          <div class="ind-card"><div class="rot">% financiado</div><div class="val">${fmtPct(ind.percentualFinanciado * 100)}</div></div>
          <div class="ind-card"><div class="rot">Principal máximo previsto</div><div class="val">${fmtR$Kpi(ind.principalMaximoPrevisto)}</div></div>
          <div class="ind-card"><div class="rot">1º mês de liberação</div><div class="val">${mes(ind.primeiroMesLiberacao)}</div></div>
          <div class="ind-card"><div class="rot">1ª liberação (catch-up)</div><div class="val">${fmtR$Kpi(ind.primeiraLiberacao)}</div></div>
          <div class="ind-card"><div class="rot">Total liberado</div><div class="val">${fmtR$Kpi(ind.totalLiberado)}</div></div>
          <div class="ind-card"><div class="rot">Total de juros</div><div class="val">${fmtR$Kpi(ind.totalJuros)}</div></div>
          <div class="ind-card"><div class="rot">Pico do saldo devedor</div><div class="val">${fmtR$Kpi(ind.picoSaldoDevedor)} (${mes(ind.mesPicoSaldoDevedor)})</div></div>
          <div class="ind-card"><div class="rot">1º mês de amortização</div><div class="val">${mes(ind.primeiroMesAmortizacao)}</div></div>
          <div class="ind-card"><div class="rot">Último mês com dívida</div><div class="val">${mes(ind.ultimoMesComDivida)}</div></div>
          <div class="ind-card"><div class="rot">Total amortizado</div><div class="val">${fmtR$Kpi(ind.totalAmortizado)}</div></div>
        </div>
        ${this._renderGraficoFinanciamentoProducao(serie)}
      </div>
    `;
  }

  /**
   * §39 — as quatro curvas que contam a história do financiamento: quando o
   * banco entra (custo elegível × principal liberado), até onde a alavancagem
   * vai (saldo devedor) e quando ela se desfaz (amortizações). SVG inline,
   * sem lib externa, mesmo padrão dos outros gráficos do app. 0-based — sem o
   * `slice(1)` que a versão 1-based precisava.
   */
  private _renderGraficoFinanciamentoProducao(serie: SerieOperacao): TemplateResult {
    const d = serie.diagnostico;
    if (!d || serie.entradas.every((v) => v === 0)) return html`${nothing}`;
    const custoAcum = d.custoElegivelAcumulado;
    const liberadoAcum = d.liberacaoAcumulada;
    const saldo = serie.saldo;
    const amort = serie.saidas;
    const meses = custoAcum.length;
    const max = Math.max(1, ...custoAcum, ...saldo, ...liberadoAcum, ...amort);
    const largura = 400, altura = 160, margemBaixo = 16;
    const x = (t: number) => (meses <= 1 ? 0 : (t / (meses - 1)) * largura);
    const y = (v: number) => altura - margemBaixo - (v / max) * (altura - margemBaixo);
    const pontos = (s: number[]) => s.map((v, i) => `${x(i)},${y(v ?? 0)}`).join(' ');
    return html`
      <div class="grafico-card">
        <h4>Alavancagem mês a mês</h4>
        <svg class="grafico" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="xMinYMin meet">
          <polyline points=${pontos(custoAcum)} class="linha-custo-elegivel"></polyline>
          <polyline points=${pontos(liberadoAcum)} class="linha-entradas"></polyline>
          <polyline points=${pontos(saldo)} class="linha-saldo-devedor"></polyline>
          <polyline points=${pontos(amort)} class="linha-saidas"></polyline>
          <text x="0" y=${altura} class="eixo-mes">mês 1</text>
          <text x=${largura} y=${altura} text-anchor="end" class="eixo-mes">mês ${meses}</text>
        </svg>
        <div class="grafico-legenda">
          <span><i class="ponto" style="background:var(--cor-texto-sec, rgba(255,255,255,0.45))"></i>Custo financiável acumulado</span>
          <span><i class="ponto" style="background:var(--cor-sucesso, #13a98d)"></i>Principal liberado acumulado</span>
          <span><i class="ponto" style="background:var(--cor-alerta, #e0a33e)"></i>Saldo devedor</span>
          <span><i class="ponto" style="background:var(--cor-erro, #d45a3a)"></i>Amortizações</span>
        </div>
      </div>
    `;
  }

  private _renderOperacao(o: any, i: number): TemplateResult {
    const temDraft = !!this.draft[o.id];
    const serie = this.funding?.operacoes.find((s) => String(s.operacao.id) === String(o.id));
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

        ${o.tipo === 'financiamento_producao' ? this._renderCamposFinanciamentoProducao(o)
          : eDivida(o.tipo) ? this._renderCamposDivida(o) : this._renderCamposEquity(o)}
        ${o.tipo === 'financiamento_producao' && serie
          ? this._renderIndicadoresFinanciamentoProducao(serie)
          : this._renderIndicadores(o)}

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
      <!-- §17 / #277: o app simula CONTRATOS PRIVADOS e não valida a legalidade
           da captação. Aviso permanente e não fechável, FORA do ramo de lista
           vazia: ele é sobre a ferramenta, não sobre o dado — quem ainda não
           cadastrou operação nenhuma é exatamente quem mais precisa lê-lo.
           Entregue na #277 (PR #296) em tela-capital-stack.ts e perdido quando
           a #355 substituiu aquele arquivo por este; a §17 nunca foi
           supersedida. -->
      <urbi-banner class="aviso-regulatorio" variante="info">
        Esta é uma <strong>simulação de contratos privados</strong>. O app não valida a legalidade da
        captação nem substitui assessoria jurídica, tributária ou regulatória — e uma captação
        oferecida ao público, ou com característica de contrato de investimento coletivo, pode ter
        obrigações regulatórias próprias. Antes de usar esta estrutura numa oferta real, submeta-a
        aos responsáveis jurídicos e financeiros.
      </urbi-banner>

      ${riscoTarifaDuplicada(this.operacoes, this.custos) ? html`
        <!-- #478: mesma classe de defeito do EVI-008 — dedução contada duas
             vezes. Aviso, não trava: as duas representações (linha de custo
             do projeto × tarifa da operação) são legítimas isoladamente. -->
        <urbi-banner variante="alerta" icone="fa-solid fa-triangle-exclamation">
          Há tarifa configurada numa operação de <strong>Dívida</strong> e, ao mesmo tempo, uma
          linha de custo em "Taxas bancárias" ou "Estruturação de dívida" no grupo Financeiro.
          Confira se não é a <strong>mesma</strong> tarifa lançada duas vezes — uma vez como custo
          do projeto, outra como encargo da operação.
        </urbi-banner>
      ` : nothing}

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
            mensagem="Nenhuma operação de funding. O Fluxo de Caixa é igual ao Livre."></urbi-estado-vazio>`
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

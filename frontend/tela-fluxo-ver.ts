import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import {
  periodosAnuais, areaPrivativaTotalLinhas, mesRepasse, type EventoCrono, type PeriodoAgregado,
} from './fluxo-shared.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import { proformaAvancado } from './proforma-avancado.js';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado, seriesEconomicasFluxo } from './fluxo-graficos.js';
import {
  estiloFluxoTabela, kpisFluxo, tabelaFluxo,
  chavesColapso, alternarColapso, controlesFluxo, relatorioReconciliacao,
  tabelaPermutaFisica,
} from './fluxo-tabela.js';
import { exportarFluxoCSV, exportarFluxoPDF } from './exportar.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal, agregarFundingPorPeriodos,
  type FundingCalc, type FundingNoFluxo, type OperacaoFunding,
} from './funding-motor.js';
import {
  validarFluxoCalc, validarProduto, validarContratacao, validarSafrasReceita,
  validarFunding, validarPermutaFisica, validarCustosDuplicados, permutaFisicaPorTipologia,
  type Divergencia, type PermutaFisicaTipologia,
} from './fluxo-invariantes.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarFundingOperacoes, listarTipologiasCatalogo,
} from './viabilidade-api.js';

// Sub-tela "Ver Fluxo" (nível Avançado): KPIs, tabela mensal com colunas fixas
// (sticky) + scroll horizontal, e gráficos SVG de fluxo mensal e acumulado.
// Todo o cálculo vem do motor puro (fluxo-caixa-motor). A tabela e os KPIs são
// funções puras compartilhadas (fluxo-tabela), reusadas pela aba Cenários (#56).
// Nada toca o Preliminar.

@customElement('viab-fluxo-ver')
export class ViabFluxoVer extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private calc: FluxoCalc | null = null;
  @state() private colapso: Record<string, boolean> = {};
  @state() private faseFiltro = '';
  /** View das colunas da tabela e dos gráficos (#127) — sempre uma das duas. */
  @state() private visao: 'mensal' | 'anual' = 'mensal';
  /**
   * #351: qual das 3 sub-abas de Resultados renderizar. As três compartilham
   * um único carregamento e um único `calcularFluxo` — por isso são uma prop
   * deste componente, e não três telas independentes.
   */
  @property({ type: String }) vista: 'fluxo-caixa' | 'proforma' | 'analise' = 'fluxo-caixa';
  // item 2 (docs/viabilidade/funding-capital-stack.md §10): resultado do
  // Capital Stack, calculado sobre o fluxo mensal.
  // #349: a restrição "só na view Mensal" acabou — o funding entrou na tabela
  // principal e `agregarFundingPorPeriodos` o reagrupa junto com ela na view
  // Anual. Os KPIs seguem lendo só o cálculo mensal, como sempre.
  @state() private operacoes: OperacaoFunding[] = [];
  @state() private fundingCalc: FundingCalc | null = null;
  // #349: o funding projetado nas categorias da tabela principal — substitui a
  // tabela separada "Programa Financeiro (Capital Stack)", removida.
  @state() private funding: FundingNoFluxo | null = null;
  @state() private divergencias: Divergencia[] = [];
  @state() private permutaFisica: PermutaFisicaTipologia[] = [];
  private dados: {
    receitas: any[]; custos: any[]; curvas: any[];
    tipologias: any[]; crono: EventoCrono[]; dataInicio: string | null; taxa: number;
    ret: { ativo: boolean; pct: number };
  } | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, estiloFluxoTabela, css`
    .graficos { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
    .graf svg { display: block; width: 100%; height: auto; min-width: 560px; }
    .graf-wrap { overflow-x: auto; }

    /* #351: tabela da Proforma e do quadro Livre × real — poucas linhas, sem
       sticky nem scroll horizontal (não é a tabela mensal do fluxo). */
    table.proforma { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.proforma th, table.proforma td {
      padding: 6px 10px; font-size: 0.82rem; text-align: left;
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
    }
    table.proforma th.num, table.proforma td.num { text-align: right; }
    table.proforma th { color: var(--cor-texto-sec, rgba(255,255,255,0.55)); font-weight: 600; }
    table.proforma tr.n1 td:first-child { padding-left: 26px; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
    table.proforma tr.n0 td { font-weight: 700; border-top: 1px solid var(--cor-borda, rgba(255,255,255,0.14)); }
    table.proforma tr.resultado td { border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.2)); }
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
      const [receitas, custos, curvas, crono, params, operacoes, tipologias] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarFundingOperacoes(this.estudo.id),
        listarTipologiasCatalogo(this.estudo.id),
      ]);
      this.operacoes = operacoes?.erro ? [] : (operacoes.dados || []);
      this.dados = {
        receitas: receitas?.erro ? [] : (receitas.dados || []),
        custos: custos?.erro ? [] : (custos.dados || []),
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        tipologias: tipologias?.erro ? [] : (tipologias.dados || []),
        crono: crono?.erro ? [] : (crono.dados || []),
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        // #346: RET global (era por Grupo, avancado_fases.fluxo_pagamento.ret).
        ret: params?.erro ? { ativo: false, pct: 4 } : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
      };
      this._recalcular();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar o fluxo', 'erro');
    }
    this.carregando = false;
  }

  private _recalcular() {
    if (!this.dados) return;
    const d = this.dados;
    const receitas = this.faseFiltro
      ? d.receitas.filter((l) => (l.fase_label || '') === this.faseFiltro)
      : d.receitas;
    const config: FluxoConfig = {
      dataInicio: d.dataInicio,
      taxaDescontoAa: d.taxa,
      cronograma: d.crono,
      linhasReceita: receitas,
      linhasCusto: d.custos,
      curvas: d.curvas,
      areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
      ret: d.ret,
    };
    this.calc = calcularFluxo(config);
    this.fundingCalc = null;
    this.funding = null;

    // Sem operações de Funding, `fundingDoEstudo` devolve `null` e a tabela
    // não ganha nenhuma linha nova (blast radius zero em estudo sem captação).
    if (this.operacoes.length > 0) {
      const receitaLiquida = receitaLiquidaComCorretagemMensal(this.calc.receitaMensal, this.calc.linhasCusto, d.custos);
      const resultadoFinal = this.calc.fluxoAcumulado[this.calc.fluxoAcumulado.length - 1] ?? 0;
      // D8: receita líquida, resultado final e mês do repasse vêm do ESTUDO,
      // não de campos redigitados na aba de Funding — é o que impede a aba de
      // contar uma história diferente da tabela de Resultados.
      this.fundingCalc = fundingDoEstudo(
        this.operacoes, this.calc.fluxoMensal, receitaLiquida, resultadoFinal, mesRepasse(d.crono), d.taxa,
        { custosRaw: d.custos, linhasCusto: this.calc.linhasCusto, cronograma: d.crono },
      );
      this.funding = this.fundingCalc?.noFluxo ?? null;
    }
    this.divergencias = [
      ...validarProduto(d.receitas, d.custos, d.tipologias, d.crono, this.calc.prazo),
      // #269: validarProduto já cobre alocado+permutado > estoque para tipologias do
      // catálogo; esta é a única que pega permuta_tipologia_id "solto" (referência sem
      // tipologia correspondente no catálogo) — validarProduto nunca visita esse caso
      // porque itera o catálogo, não as linhas de custo.
      ...validarPermutaFisica(d.custos, d.tipologias),
      // #335: categoria de custo repetida no mesmo grupo — reversão da #179
      // deixou de bloquear, agora é alerta visível na Reconciliação.
      ...validarCustosDuplicados(d.custos),
      ...validarContratacao(receitas, d.crono, this.calc.prazo, this.calc.vendaBrutaContratada),
      ...validarSafrasReceita(receitas, d.crono, this.calc.prazo),
      ...validarFluxoCalc(this.calc),
      ...(this.fundingCalc ? validarFunding(this.fundingCalc, this.calc.fluxoMensal) : []),
    ];
    // #269: mesma fonte para tela e exportação — computado uma vez aqui.
    this.permutaFisica = permutaFisicaPorTipologia(d.custos, d.tipologias);
  }

  /**
   * Faixas de meses da view Anual (#127) — `null` na view Mensal, em que cada
   * coluna já é um mês. Derivadas da data de início e do prazo do cálculo.
   */
  private _periodos(): PeriodoAgregado[] | null {
    if (this.visao !== 'anual' || !this.calc) return null;
    return periodosAnuais(this.dados?.dataInicio ?? null, this.calc.prazo);
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Calculando fluxo de caixa..."></urbi-loading>`;
    const c = this.calc;
    if (!c || (c.linhasReceita.length === 0 && c.linhasCusto.length === 0)) {
      return html`
        <urbi-estado-vazio icone="fa-solid fa-money-bill-transfer"
          mensagem="Defina o cronograma, receitas e custos para ver o fluxo de caixa."></urbi-estado-vazio>`;
    }
    // A view (#127) só troca as COLUNAS: `exib` é o mesmo cálculo mensal com as
    // colunas reagrupadas por ano. Os KPIs seguem lendo o cálculo mensal — TIR,
    // VPL, payback e exposição são grandezas do fluxo mês a mês.
    const periodos = this._periodos();
    const exib = periodos ? agregarFluxoPorPeriodos(c, periodos) : c;
    // #349: o funding agora vive DENTRO da tabela principal, então precisa
    // acompanhar a view Anual — a tabela separada só existia na Mensal e
    // sumia ao trocar de view, escondendo o funding sem avisar.
    const fundingExib = this.funding && periodos ? agregarFundingPorPeriodos(this.funding, periodos) : this.funding;
    // #351: as 3 sub-abas de Resultados são 3 leituras do MESMO cálculo — o
    // componente carrega e roda `calcularFluxo` uma vez e a `vista` escolhe o
    // que renderizar, em vez de três telas repetindo fetch e motor.
    if (this.vista === 'proforma') return this._renderProforma(c);
    if (this.vista === 'analise') return this._renderAnaliseFinanceira(c, exib, periodos);
    return html`
      ${kpisFluxo(c)}
      ${this._renderControles()}
      ${tabelaFluxo(exib, this.dados?.dataInicio ?? null, this.colapso, (ch) => this._t(ch), fundingExib)}
      ${relatorioReconciliacao(this.divergencias)}
      ${tabelaPermutaFisica(this.permutaFisica)}
    `;
  }

  /**
   * #351 · aba Proforma — leitura econômica do mesmo `FluxoCalc`, na
   * segmentação da imagem de referência da planilha (aba `#43`): três colunas
   * (R$ · R$/m² da área privativa · % VGV).
   *
   * ⚠️ #426: a proforma é DESALAVANCADA e a função nem recebe `funding` —
   * nenhuma ponta entra, nem liberação na receita nem serviço da dívida no
   * custo. `this.funding` continua servindo à tabela do fluxo e aos KPIs da
   * aba Análise Financeira, que são outra leitura. Ver a nota do topo de
   * `proforma-avancado.ts`.
   */
  private _renderProforma(c: FluxoCalc): TemplateResult {
    const area = areaPrivativaTotalLinhas(this.dados?.receitas ?? []);
    const p = proformaAvancado(c, area);
    const porM2 = (v: number) => (p.areaPrivativa > 0 ? v / p.areaPrivativa : 0);
    const pctVgv = (v: number) => (p.vgv > 0 ? (v / p.vgv) * 100 : 0);
    return html`
      <urbi-card titulo="Proforma">
        <table class="proforma">
          <thead>
            <tr><th>Linha</th><th class="num">R$</th><th class="num">R$/m²</th><th class="num">% VGV</th></tr>
          </thead>
          <tbody>
            ${p.linhas.map((l) => html`
              <tr class=${`n${l.nivel} ${l.tipo}`}>
                <td>${l.nome}</td>
                <td class="num">${fmtR$(l.valor)}</td>
                <td class="num">${fmtNum(porM2(l.valor))}</td>
                <td class="num">${fmtPct(pctVgv(l.valor))}</td>
              </tr>`)}
          </tbody>
        </table>
        <p class="sec">Área privativa: ${fmtNum(p.areaPrivativa)} m² · Margem sobre VGV: ${fmtPct(p.margemPct)}.
          Esta proforma é desalavancada: nenhuma ponta do funding entra aqui — nem liberações e aportes
          na receita, nem amortização e juros no custo. “Custos Financeiros” vale só as linhas de custo
          que você classificou nesse grupo. Quem quiser ler o efeito do funding lê a aba Fluxo de Caixa,
          não esta.</p>
      </urbi-card>
    `;
  }

  /**
   * #351 · aba Análise Financeira — indicadores principais, a diferença
   * explícita entre Fluxo de Caixa Livre (desalavancado, base de TIR/VPL por
   * §8.1) e o Fluxo de Caixa real (pós-funding), e os gráficos que antes
   * ficavam empilhados embaixo da tabela.
   */
  private _renderAnaliseFinanceira(
    c: FluxoCalc, exib: FluxoCalc, periodos: PeriodoAgregado[] | null,
  ): TemplateResult {
    const titulo = this.visao === 'anual' ? 'Anual' : 'Mensal';
    const livre = c.fluxoMensal.reduce((s, v) => s + v, 0);
    const real = this.funding ? this.funding.fluxoMensal.reduce((s, v) => s + v, 0) : livre;
    const custoFunding = this.funding
      ? this.funding.linhasSaida.reduce((s, l) => s + l.total, 0) - this.funding.entradas.reduce((s, v) => s + v, 0)
      : 0;
    return html`
      ${kpisFluxo(c)}
      <urbi-card titulo="Fluxo de Caixa Livre × Fluxo de Caixa real">
        <table class="proforma">
          <tbody>
            <tr class="n0 receita">
              <td>Fluxo de Caixa Livre (sem despesas financeiras)</td>
              <td class="num">${fmtR$(livre)}</td>
            </tr>
            <tr class="n1 custo">
              <td>(-) Efeito líquido do funding (saídas − entradas)</td>
              <td class="num">${fmtR$(-custoFunding)}</td>
            </tr>
            <tr class="n0 resultado">
              <td>= Fluxo de Caixa (resultado real)</td>
              <td class="num">${fmtR$(real)}</td>
            </tr>
          </tbody>
        </table>
        <p class="sec">${this.funding
          ? html`TIR, VPL e Payback continuam <strong>desalavancados</strong> — leem o Fluxo de Caixa Livre
              (funding-capital-stack.md §8.1, para manter comparabilidade entre estruturas de capital).`
          : html`Este estudo não tem camadas de Capital Stack: sem funding, o Fluxo de Caixa real é
              igual ao Livre.`}</p>
      </urbi-card>
      ${this._renderControles()}
      <div class="graficos">
        <urbi-card titulo="Contratação, Receita Bruta, Carteira e Repasse — ${titulo}">
          <div class="graf-wrap"><div class="graf">
            <urbi-grafico-linha
              formato="moeda"
              legenda="sempre"
              .categorias=${exib.meses}
              .series=${seriesEconomicasFluxo(exib)}
            ></urbi-grafico-linha>
          </div></div>
        </urbi-card>
        <urbi-card titulo="Fluxo de Caixa ${titulo}">
          <div class="graf-wrap"><div class="graf">${graficoFluxoMensal(exib, this.dados?.dataInicio ?? null, this.dados?.crono ?? [], periodos ?? undefined)}</div></div>
        </urbi-card>
        <urbi-card titulo="Fluxo de Caixa Acumulado">
          <div class="graf-wrap"><div class="graf">${graficoFluxoAcumulado(exib, this.dados?.dataInicio ?? null, this.dados?.crono ?? [], periodos ?? undefined)}</div></div>
        </urbi-card>
      </div>
    `;
  }

  private _renderControles(): TemplateResult {
    const fases = [...new Set((this.dados?.receitas ?? []).map((l) => String(l.fase_label || '')).filter(Boolean))];
    const tudoRecolhido = Object.values(this.colapso).some(Boolean);
    return controlesFluxo({
      tudoRecolhido,
      onToggleTudo: () => this._toggleTudo(!tudoRecolhido),
      visao: this.visao,
      onVisao: (v) => { this.visao = v; },
      fases,
      faseFiltro: this.faseFiltro,
      onFase: (v) => { this.faseFiltro = v; this._recalcular(); },
      extra: html`
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-download" @click=${this._csv}>CSV</urbi-botao>
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-pdf" @click=${this._pdf}>PDF</urbi-botao>
      `,
    });
  }

  private _toggleTudo(recolher: boolean) {
    const chaves = this.calc ? chavesColapso(this.calc, this.funding) : [];
    const novo: Record<string, boolean> = {};
    for (const k of chaves) novo[k] = recolher;
    this.colapso = novo;
  }

  private _t(chave: string) {
    this.colapso = alternarColapso(this.colapso, chave);
  }

  // ── Exportação ──

  // CSV e PDF seguem a view selecionada (#127): exportam as mesmas colunas que
  // estão na tela. As colunas Início/Duração e os KPIs continuam em meses.
  private _exportavel(): FluxoCalc | null {
    if (!this.calc) return null;
    const periodos = this._periodos();
    return periodos ? agregarFluxoPorPeriodos(this.calc, periodos) : this.calc;
  }

  // #349: o funding exportado segue a MESMA view da tela. Antes ele só saía na
  // view Mensal (não havia agregação anual do resultado do motor); com
  // `agregarFundingPorPeriodos` a restrição deixou de existir, e tela e arquivo
  // voltam a mostrar exatamente as mesmas linhas em qualquer view.
  private _fundingExportavel(): FundingNoFluxo | null {
    if (!this.funding) return null;
    const periodos = this._periodos();
    return periodos ? agregarFundingPorPeriodos(this.funding, periodos) : this.funding;
  }

  private _csv = () => {
    const c = this._exportavel();
    if (!c) return;
    exportarFluxoCSV(this.estudo, c, this.dados?.dataInicio ?? null, this._fundingExportavel(), this.divergencias, this.permutaFisica);
    urbiVerso.notificar('CSV do fluxo exportado.', 'sucesso');
  };

  private _pdf = () => {
    const c = this._exportavel();
    if (!c) return;
    const ok = exportarFluxoPDF(this.estudo, c, this.dados?.dataInicio ?? null,
      this.visao === 'anual' ? 'Anos' : 'Meses', this._fundingExportavel(), this.divergencias, this.permutaFisica);
    if (!ok) urbiVerso.notificar('Permita pop-ups para exportar o PDF.', 'alerta');
  };
}

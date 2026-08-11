import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { periodosAnuais, type EventoCrono, type PeriodoAgregado } from './fluxo-shared.js';
import { calcularFluxo, agregarFluxoPorPeriodos, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado, seriesEconomicasFluxo } from './fluxo-graficos.js';
import {
  estiloFluxoTabela, kpisFluxo, tabelaFluxo,
  chavesColapso, controlesFluxo, relatorioReconciliacao,
  tabelaPermutaFisica,
} from './fluxo-tabela.js';
import { exportarFluxoCSV, exportarFluxoPDF } from './exportar.js';
import {
  simularCapitalStackDoEstudo, receitaLiquidaComCorretagemMensal,
  fundingNoFluxo, agregarFundingPorPeriodos,
  type ResultadoCapitalStack, type FundingNoFluxo,
} from './capital-stack-motor.js';
import {
  validarFluxoCalc, validarProduto, validarContratacao, validarSafrasReceita,
  validarCapitalStack, validarPermutaFisica, validarCustosDuplicados, permutaFisicaPorTipologia,
  type Divergencia, type PermutaFisicaTipologia,
} from './fluxo-invariantes.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarCapitalInstrumentos, listarTipologiasCatalogo,
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
  // item 2 (docs/viabilidade/funding-capital-stack.md §10): resultado do
  // Capital Stack, calculado sobre o fluxo mensal.
  // #349: a restrição "só na view Mensal" acabou — o funding entrou na tabela
  // principal e `agregarFundingPorPeriodos` o reagrupa junto com ela na view
  // Anual. Os KPIs seguem lendo só o cálculo mensal, como sempre.
  @state() private camadas: any[] = [];
  @state() private resultadoCapitalStack: ResultadoCapitalStack | null = null;
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
      const [receitas, custos, curvas, crono, params, camadas, tipologias] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarCapitalInstrumentos(this.estudo.id),
        listarTipologiasCatalogo(this.estudo.id),
      ]);
      this.camadas = camadas?.erro ? [] : (camadas.dados || []);
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
    this.resultadoCapitalStack = null;
    this.funding = null;

    // §13.3: só camadas ATIVAS têm efeito — sem nenhuma, `simularCapitalStackDoEstudo`
    // devolve entradas/saídas zero e `fundingNoFluxo` devolve `null`, de modo que a
    // tabela não ganha nenhuma linha nova (blast radius zero sem Capital Stack).
    if (this.camadas.length > 0) {
      const receitaLiquida = receitaLiquidaComCorretagemMensal(this.calc.receitaMensal, this.calc.linhasCusto, d.custos);
      const fluxoLivre1based = [0, ...this.calc.fluxoMensal];
      const receitaLiquida1based = [0, ...receitaLiquida];
      this.resultadoCapitalStack = simularCapitalStackDoEstudo(
        fluxoLivre1based, receitaLiquida1based, this.camadas, this.calc.linhasCusto, 0,
      );
      this.funding = fundingNoFluxo(this.resultadoCapitalStack, this.camadas, this.calc.fluxoMensal, d.taxa);
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
      ...(this.resultadoCapitalStack
        ? validarCapitalStack(this.resultadoCapitalStack, this.calc.fluxoMensal) : []),
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
    const titulo = this.visao === 'anual' ? 'Anual' : 'Mensal';
    return html`
      ${kpisFluxo(c)}
      ${this._renderControles()}
      ${tabelaFluxo(exib, this.dados?.dataInicio ?? null, this.colapso, (ch) => this._t(ch), fundingExib)}
      ${relatorioReconciliacao(this.divergencias)}
      ${tabelaPermutaFisica(this.permutaFisica)}
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
    const chaves = this.calc ? chavesColapso(this.calc) : [];
    const novo: Record<string, boolean> = {};
    for (const k of chaves) novo[k] = recolher;
    this.colapso = novo;
  }

  private _t(chave: string) {
    this.colapso = { ...this.colapso, [chave]: !this.colapso[chave] };
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

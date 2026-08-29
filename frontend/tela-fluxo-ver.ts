import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import {
  periodosAnuais, areaPrivativaTotalLinhas, mesRepasse, rotuloMesRelativo,
  type EventoCrono, type PeriodoAgregado,
} from './fluxo-shared.js';
import { fmtR$, fmtNum, fmtPct, fmtPctOuIndef } from './viab-format.js';
import {
  proformaAvancado, linhaInformativaFunding, linhaInformativaReceitaLiquidaEvi,
  type LinhaProformaAv,
} from './proforma-avancado.js';
import { calcularFluxo, agregarFluxoPorPeriodos, receitaLiquidaDeProformaMensal, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado, seriesEconomicasFluxo } from './fluxo-graficos.js';
import {
  estiloFluxoTabela, kpisFluxo, tabelaFluxo,
  chavesColapso, alternarColapso, controlesFluxo, relatorioReconciliacao,
  tabelaPermutaFisica,
} from './fluxo-tabela.js';
import { exportarFluxoCSV, exportarFluxoPDF } from './exportar.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal, agregarFundingPorPeriodos,
  indicadoresOperacao, tranchesDeInvestimento, eDivida,
  type FundingCalc, type FundingNoFluxo, type OperacaoFunding, type SerieOperacao,
} from './funding-motor.js';
import {
  validarFluxoCalc, validarProduto, validarContratacao, validarSafrasReceita, validarReconciliacaoCamadas,
  validarFunding, validarPermutaFisica, validarCustosDuplicados, permutaFisicaPorTipologia, TOLERANCIA_PADRAO,
  type Divergencia, type PermutaFisicaTipologia,
} from './fluxo-invariantes.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarFundingOperacoes, listarTipologiasCatalogo,
} from './viabilidade-api.js';

/**
 * #593 — sinal (`pos`/`neg`) da célula numérica da Proforma do Avançado.
 *
 * É o espelho de `sinalSensibilidade`/`ehLinhaReceitaOuResultado` do
 * Preliminar (`frontend/tela-proforma.ts`, decisão da #567): só linha de
 * RECEITA ou de RESULTADO ganha a classe; custo e informativo ficam sem
 * nenhuma, porque ali o negativo é o estado normal — marcar "neg" numa linha
 * de custo diria que algo está errado quando não está.
 *
 * Existe como função exportada, e não inline no template, por dois motivos:
 * o mapeamento fica aferível sem montar a tela, e apagar a CHAMADA
 * (`class="num ${sinal}"`) deixa o caso de render vermelho — que é onde a
 * fiação é medida.
 */
export function sinalLinhaProformaAv(l: Pick<LinhaProformaAv, 'tipo' | 'valor'>): '' | 'pos' | 'neg' {
  if (l.tipo !== 'receita' && l.tipo !== 'resultado') return '';
  return l.valor < 0 ? 'neg' : 'pos';
}

/**
 * #594 · P1 — o ROI GERAL do projeto exibido na aba Análise Financeira.
 *
 * ⚠️ Ela é um ALIAS de propósito, e o alias é a defesa. O corpo é uma linha só
 * (`proformaAvancado(c, area).roiPct`) porque a issue proíbe um segundo ROI:
 * a coluna ROI do Painel de estudos publica esse MESMO `roiPct`
 * (`frontend/tela-dashboard.ts`, `_calcularUmAvancado`), e dois ROIs
 * divergentes para o mesmo estudo é a classe de defeito que a #443 registrou
 * em VGV e Margem.
 *
 * Existir como símbolo exportado dá ao critério de aceite 1 um lugar onde
 * comparar os DOIS caminhos sem montar componente Lit
 * (`frontend/retorno-por-parte.test.ts`). Se alguém trocar o corpo por uma
 * conta própria, a comparação fica vermelha aqui — é o ponto de a função
 * existir, e não de ela ser esperta.
 */
export function roiProjetoAnalise(c: FluxoCalc, areaPrivativa: number): number | null {
  return proformaAvancado(c, areaPrivativa).roiPct;
}

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
  /**
   * #594 — o MESMO par (fluxo, funding), porém SEMPRE sobre o projeto inteiro:
   * sem o filtro de fase que `_recalcular` aplica a `calc`/`fundingCalc`.
   *
   * ⚠️ Ele existe por um achado P1 do App de revisão, e o defeito é sutil: o
   * filtro de fase recorta as linhas de RECEITA e mantém TODOS os custos
   * (`_recalcular`, abaixo). Isso é o certo para a tabela e os gráficos, que
   * mostram a fase escolhida — e é ruína para um indicador que se anuncia como
   * "do projeto": com uma fase selecionada, o ROI da Análise Financeira
   * deixaria de bater com a coluna ROI do Painel de estudos (critério de
   * aceite 1 da issue), e as tranches e o resíduo do incorporador mudariam de
   * valor só porque alguém mexeu num filtro de exibição.
   *
   * Sem filtro os dois pares são o MESMO objeto — nenhum cálculo a mais no
   * caminho comum. Com filtro, roda-se `calcularFluxo` uma segunda vez.
   */
  @state() private calcProjeto: FluxoCalc | null = null;
  @state() private fundingCalcProjeto: FundingCalc | null = null;
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
    /* #632 — mesmo diagnóstico da #595 (frontend/tela-cenarios.ts): a cor de
       cada série do gráfico "Contratação, Receita Bruta, Carteira e Repasse"
       sai DAQUI, e não de uma chave "cor" dentro do dado (ver o comentário de
       seriesEconomicasFluxo, frontend/fluxo-graficos.ts). As quatro custom
       properties abaixo são as que o espelho declara no :host de
       UrbiGraficoBase, na mesma ORDEM em que seriesEconomicasFluxo devolve as
       séries — --urbi-grafico-cor-1 é a 1ª ("Venda líquida contratada"), e
       assim por diante.
       --cor-primaria é um GRADIENTE nas 4 variantes de tema do espelho —
       inválido em contexto de cor de série (IACVT / atributo descartado), a
       mesma falha silenciosa que esta issue diagnostica.
       ⚠️ achado do Codex (rodada 1, PR 651): a variante SÓLIDA
       (--cor-primaria-solida) resolve para o MESMO hex que --cor-info nas 3
       primeiras variantes de tema (#2AA9E0/#0D75A9/#14688F) — a 1ª e a 3ª
       série ficariam com a mesma cor em 3 dos 4 temas. --cor-categoria-1 é um
       dos 8 tokens que o espelho já expõe para series de gráfico (é o próprio
       DEFAULT de --urbi-grafico-cor-1 no :host de UrbiGraficoBase), e não
       colide com --cor-sucesso/--cor-info/--cor-alerta em NENHUMA variante —
       ver o teste de distinção em frontend/fluxo-economico-series.test.ts. */
    .graf urbi-grafico-linha {
      --urbi-grafico-cor-1: var(--cor-categoria-1, #6ca1ff);
      --urbi-grafico-cor-2: var(--cor-sucesso, #13a98d);
      --urbi-grafico-cor-3: var(--cor-info, #3b82f6);
      --urbi-grafico-cor-4: var(--cor-alerta, #d59b2d);
    }

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

    /* #593 — cor por natureza de linha, o mesmo princípio que o Preliminar já
       usa. As classes (receita / custo / resultado / informativo, mais n0/n1)
       já chegavam ao DOM desde sempre; o que faltava eram as REGRAS.

       As declarações abaixo são CÓPIA LITERAL das do Preliminar
       (frontend/tela-proforma.ts) — mesmos tokens, mesmas proporções de
       color-mix, mesmos fallbacks. Isso é critério de aceite da #593 (o
       usuário que alterna entre os dois estudos lê a mesma convenção), e
       frontend/proforma-cores.test.ts confronta os DOIS arquivos entre si:
       mudar uma proporção aqui sem mudar lá (ou vice-versa) fica vermelho.
       Não "ajuste" um valor isolado — a origem é o Preliminar.

       Estas regras vêm DEPOIS de tr.n0 td de propósito: tr.receita td tem a
       mesma especificidade, então quem decide é a ordem do arquivo. */
    table.proforma tr.n1.custo { background: color-mix(in srgb, var(--cor-erro) 8%, transparent); }
    table.proforma tr.n0.custo td {
      font-weight: 700; background: var(--cor-superficie-hover, rgba(255,255,255,0.08));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
    }
    table.proforma tr.receita td {
      background: color-mix(in srgb, var(--cor-sucesso) 14%, transparent);
      color: var(--cor-sucesso);
    }
    /* #567 (herdada do Preliminar): receita NEGATIVA num estudo deficitário —
       o verde fixo acima mentiria que é receita "boa". Precisa vir DEPOIS. */
    table.proforma tr.receita td.neg {
      background: color-mix(in srgb, var(--cor-erro) 14%, transparent);
      color: var(--cor-erro);
    }
    table.proforma tr.resultado td {
      font-weight: 800; font-size: 1.05rem; background: var(--cor-primaria-fundo, rgba(42,169,224,0.12));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
      padding-top: 14px; border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    table.proforma tr.resultado td.pos { color: var(--cor-sucesso, #13A98D); }
    table.proforma tr.resultado td.neg { color: var(--cor-erro, #D45A3A); }
    /* #447: linha informativa do funding — nunca somada, por isso o itálico
       e a borda tracejada (não é uma linha da hierarquia de totais acima). */
    table.proforma tr.informativo td {
      font-style: italic; color: var(--cor-texto-sec, rgba(255,255,255,0.55));
      border-top: 1px dashed var(--cor-borda-sutil, rgba(255,255,255,0.14));
    }
    /* #427 — nota do denominador do fecho "= Resultado + Permutas", só
       exibida quando a base difere do VGV (molde de Premissas e
       Resultados K36 da EVI: a nota é gerada e some quando não se aplica). */
    table.proforma .nota-base { font-size: 0.72rem; font-weight: 400; color: var(--cor-texto-sec, rgba(255,255,255,0.55)); }

    /* #594 — a abertura por parte tem 8 colunas, contra as 2 das tabelas
       acima. A classe .tabela-wrap é o MESMO padrão declarado do Cronograma
       (frontend/tela-fluxo-cronograma.ts): scroller com overflow-x auto, que a
       sonda de render reconhece como intenção do autor e não acusa como
       transbordo. Sem ele, a tabela empurraria a rolagem horizontal do
       DOCUMENTO inteiro numa largura estreita — que é o único transbordo que
       aquela sonda trata como defeito.
       As regras ficam DEPOIS de todo o bloco da #593 de propósito: nenhuma
       delas casa os seletores que frontend/proforma-cores.test.ts confronta
       com o Preliminar, e vir por último garante que também não os sombreia.
       ⚠️ Sem crase nesta prosa: o bloco inteiro mora dentro do template
       literal da tag css, e uma crase aqui FECHA o template — o arquivo
       deixa de parsear. */
    .tabela-wrap { overflow-x: auto; }
    .tabela-wrap table.partes { min-width: 720px; }
    table.proforma tr.parte-incorporador td { font-weight: 700; }
    table.proforma td.vazio { color: var(--cor-texto-sec, rgba(255,255,255,0.45)); }
    table.proforma td.pos { color: var(--cor-sucesso, #13A98D); }
    table.proforma td.neg { color: var(--cor-erro, #D45A3A); }
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

  /**
   * #594 — o `FluxoConfig` do estudo para um conjunto de linhas de receita.
   * Extraído de `_recalcular` porque a aba Análise Financeira precisa rodar o
   * MESMO cálculo com as receitas do projeto INTEIRO quando há filtro de fase
   * (ver `calcProjeto`). Duplicar o config em vez de extraí-lo faria os dois
   * caminhos divergirem no primeiro campo novo que alguém acrescentasse a um
   * e esquecesse no outro.
   */
  private _configFluxo(receitas: any[]): FluxoConfig {
    const d = this.dados!;
    return {
      dataInicio: d.dataInicio,
      taxaDescontoAa: d.taxa,
      cronograma: d.crono,
      linhasReceita: receitas,
      linhasCusto: d.custos,
      curvas: d.curvas,
      areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
      ret: d.ret,
      // #473: default true preserva o comportamento histórico (VGV bruto).
      corretagemSobrePermutaFisica: this.estudo?.corretagem_sobre_permuta_fisica !== false,
      // #446: o horizonte precisa cobrir a quitação das operações, senão a
      // série é cortada e `saldoFinal` exibe um saldo truncado.
      operacoesFunding: this.operacoes,
    };
  }

  /**
   * #594 — a montagem `resultadoFinal → fundingDoEstudo` para UM `FluxoCalc`.
   * Extraída pelo mesmo motivo de `_configFluxo`: ela roda duas vezes quando
   * há filtro de fase, e duas cópias divergiriam. Continua sendo a montagem
   * LOCAL de que fala a nota #474 abaixo — extrair para um método privado
   * deste arquivo não a torna a fonte única que o autor recusou.
   */
  private _fundingDe(calc: FluxoCalc, receitaLiquida: number[]): FundingCalc | null {
    const d = this.dados!;
    const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
    // D8: receita líquida, resultado final e mês do repasse vêm do ESTUDO,
    // não de campos redigitados na aba de Funding — é o que impede a aba de
    // contar uma história diferente da tabela de Resultados.
    return fundingDoEstudo(
      this.operacoes, calc.fluxoMensal, receitaLiquida, resultadoFinal, mesRepasse(d.crono), d.taxa,
      { custosRaw: d.custos, linhasCusto: calc.linhasCusto, cronograma: d.crono },
    );
  }

  private _recalcular() {
    if (!this.dados) return;
    const d = this.dados;
    const receitas = this.faseFiltro
      ? d.receitas.filter((l) => (l.fase_label || '') === this.faseFiltro)
      : d.receitas;
    this.calc = calcularFluxo(this._configFluxo(receitas));
    this.fundingCalc = null;
    this.funding = null;
    // #474 (Passos 23–25, D-Q03 2026-08-22): esta montagem
    // (resultadoFinal → fundingDoEstudo) é LOCAL. O app não tem uma função
    // única para essa sequência (`docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`)
    // — cada consumidor remonta à mão, e pode divergir (R-A36). Fonte única
    // foi CONSIDERADA E RECUSADA pelo autor; ver
    // `docs/viabilidade/fluxo-investidor-formulas.md` §9. Os outros quatro
    // consumidores: frontend/tela-funding.ts:239 · frontend/tela-cenarios.ts:240
    // · frontend/tela-resumo.ts:182 (só remonta resultadoFinal, não chama
    // fundingDoEstudo) · scripts/conferir-estudo.ts:153.
    //
    // Sem operações de Funding, `fundingDoEstudo` devolve `null` e a tabela
    // não ganha nenhuma linha nova (blast radius zero em estudo sem captação).
    //
    // #445: `receitaLiquida` içada para fora do `if` — a checagem (b) de
    // `validarFunding` (equity em modo permuta_financeira × receita líquida
    // do mês) precisa dela mesmo quando `this.fundingCalc` é `null`. Sem
    // operações a variável fica `undefined` e a checagem simplesmente não
    // roda (não há equity para checar).
    let receitaLiquida: number[] | undefined;
    if (this.operacoes.length > 0) {
      receitaLiquida = receitaLiquidaComCorretagemMensal(this.calc.receitaMensal, this.calc.linhasCusto, d.custos);
      this.fundingCalc = this._fundingDe(this.calc, receitaLiquida);
      this.funding = this.fundingCalc?.noFluxo ?? null;
    }
    // #594 — o par do PROJETO INTEIRO, que a Análise Financeira consome. Sem
    // filtro de fase ele É o par de exibição (mesmo objeto, zero cálculo a
    // mais); com filtro, roda de novo sobre `d.receitas` inteiras. Ver o
    // comentário de `calcProjeto` para o defeito que isto impede.
    if (this.faseFiltro) {
      const cProjeto = calcularFluxo(this._configFluxo(d.receitas));
      this.calcProjeto = cProjeto;
      this.fundingCalcProjeto = this.operacoes.length > 0
        ? this._fundingDe(
            cProjeto,
            receitaLiquidaComCorretagemMensal(cProjeto.receitaMensal, cProjeto.linhasCusto, d.custos),
          )
        : null;
    } else {
      this.calcProjeto = this.calc;
      this.fundingCalcProjeto = this.fundingCalc;
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
      ...validarContratacao(receitas, d.crono, this.calc.prazo, this.calc.vendaBrutaContratada, TOLERANCIA_PADRAO, d.custos),
      ...validarSafrasReceita(receitas, d.crono, this.calc.prazo, TOLERANCIA_PADRAO, d.custos),
      ...validarFluxoCalc(this.calc),
      // #441: reconciliação Catálogo × Premissas — só emite algo em estudo
      // `nivel_analise === 'avancado'`.
      ...validarReconciliacaoCamadas(this.estudo, d.custos, d.tipologias),
      ...(this.fundingCalc
        ? validarFunding(this.fundingCalc, this.calc.fluxoMensal, TOLERANCIA_PADRAO, receitaLiquida)
        : []),
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
   *
   * #447: a linha informativa do serviço da dívida é montada AQUI — não
   * dentro de `proformaAvancado` — e só por isso `this.funding` (que a
   * função não recebe) chega até ela. `linhaInformativaFunding` devolve
   * `null` sem funding ou sem saída, e o `.filter` a tira da lista.
   */
  private _renderProforma(c: FluxoCalc): TemplateResult {
    const area = areaPrivativaTotalLinhas(this.dados?.receitas ?? []);
    const p = proformaAvancado(c, area);
    const totalSaidasFunding = this.funding
      ? this.funding.linhasSaida.reduce((s, l) => s + l.total, 0)
      : 0;
    const informativa = linhaInformativaFunding(totalSaidasFunding);
    // #465: "Receita líquida de proforma" — composição de 4 parcelas da EVI
    // (imposto + corretagem + marketing + permuta financeira), ao lado da
    // "= Receita líquida" existente (que só deduz RET + permuta financeira,
    // #228). As duas convivem; nenhuma substitui a outra.
    const receitaLiquidaEvi = receitaLiquidaDeProformaMensal(c.receitaMensal, c.linhasCusto, this.dados?.custos ?? [])
      .reduce((s, v) => s + v, 0);
    const informativaEvi = linhaInformativaReceitaLiquidaEvi(receitaLiquidaEvi);
    const linhas: LinhaProformaAv[] = [...p.linhas, informativa, informativaEvi].filter((l): l is LinhaProformaAv => l !== null);
    const porM2 = (v: number) => (p.areaPrivativa > 0 ? v / p.areaPrivativa : 0);
    // #427 — % VGV de toda linha usa o VGV puro, EXCETO os fechos cujo
    // `pctOverride` já veio calculado com a base própria (`= Resultado +
    // Permutas` soma a permuta física ao denominador — ver proforma-avancado.ts).
    //
    // #604 — com VGV ≤ 0 devolve `null`, não 0: a coluna imprime "—" via
    // `fmtPctOuIndef`, porque um percentual sem denominador não foi medido.
    // Mesmo mecanismo que a #571 levou ao Preliminar.
    const pctVgv = (v: number): number | null => (p.vgv > 0 ? (v / p.vgv) * 100 : null);
    return html`
      <urbi-card titulo="Proforma">
        <table class="proforma">
          <thead>
            <tr><th>Linha</th><th class="num">R$</th><th class="num">R$/m²</th><th class="num">% VGV</th></tr>
          </thead>
          <tbody>
            ${linhas.map((l) => {
              // #593 — mesma decisão do Preliminar (#567): o sinal vai nas TRÊS
              // colunas numéricas, não só na de R$, para que o negativo de uma
              // receita/resultado se leia igual em R$, R$/m² e % VGV.
              const sinal = sinalLinhaProformaAv(l);
              return html`
              <tr class=${`n${l.nivel} ${l.tipo}`}>
                <td>${l.nome}${l.notaBase ? html` <span class="nota-base">(${l.notaBase})</span>` : ''}</td>
                <td class="num ${sinal}">${fmtR$(l.valor)}</td>
                <td class="num ${sinal}">${fmtNum(porM2(l.valor))}</td>
                <td class="num ${sinal}">${fmtPctOuIndef(
                  // ⚠️ #604 — `!== undefined`, e NÃO `??`, porque `null` aqui
                  // significa "base própria inválida", não "sem override": o
                  // `??` cairia no VGV puro e publicaria um número com o
                  // denominador errado.
                  //
                  // ⚠️ E A HONESTIDADE SOBRE O ALCANCE: hoje essa troca é
                  // **inobservável**, e isso está MEDIDO — reverter para `??`
                  // deixa a suíte inteira verde. O motivo é estrutural: as três
                  // bases de `pctOverride` derivam de `receitaBruta`
                  // (`baseComPermutaFisica = receitaBruta + vgvPermutaFisica`,
                  // com a permuta ≥ 0) e `p.vgv` É `receitaBruta` — então
                  // `pctOverride === null` IMPLICA `pctVgv(...) === null`, e os
                  // dois operadores dão o mesmo resultado.
                  //
                  // Fica assim mesmo: é o contrato de três estados que torna
                  // seguro existir `pctOverride: null`, e ele passa a morder no
                  // dia em que alguma linha ganhar base própria independente do
                  // VGV. Trocar de volta seria escrever uma armadilha para essa
                  // linha futura. Não é conserto de defeito vivo — é guarda, e
                  // está declarada como tal em vez de contada como entrega.
                  l.pctOverride !== undefined ? l.pctOverride : pctVgv(l.valor),
                )}</td>
              </tr>`;
            })}
          </tbody>
        </table>
        <p class="sec">Área privativa: ${fmtNum(p.areaPrivativa)} m² · Margem sobre Receita Bruta: ${fmtPctOuIndef(p.margemPct)}.
          A coluna "Margem" do Painel de estudos usa esta mesma linha — "= Resultado", sem permutas
          (para a linha do Avançado; ver o atributo "title" da célula no Painel — #443).
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
   * §8.1) e o Fluxo de Caixa (pós-funding), e os gráficos que antes
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
    // #593 — esta tabela é a SEGUNDA `<table class="proforma">` do arquivo, e o
    // seletor das regras de cor é `table.proforma …`: as regras alcançam as duas
    // desde o primeiro commit desta issue, mas o sinal só estava fiado em
    // `_renderProforma`. Sem estas três chamadas, um estudo com Fluxo de Caixa
    // Livre NEGATIVO era pintado de VERDE aqui — `tr.receita td` casa e o
    // override `td.neg` nunca aparecia. Mesma função, mesma decisão do
    // Preliminar (#567): a linha de custo fica sem sinal de propósito, porque
    // ali o negativo é o estado normal.
    const sinalLivre = sinalLinhaProformaAv({ tipo: 'receita', valor: livre });
    const sinalFunding = sinalLinhaProformaAv({ tipo: 'custo', valor: -custoFunding });
    const sinalReal = sinalLinhaProformaAv({ tipo: 'resultado', valor: real });
    return html`
      ${kpisFluxo(c)}
      ${this._renderRoiProjeto(this.calcProjeto ?? c)}
      <urbi-card titulo="Fluxo de Caixa Livre × Fluxo de Caixa">
        <table class="proforma">
          <tbody>
            <tr class="n0 receita">
              <td>Fluxo de Caixa Livre (sem despesas financeiras)</td>
              <td class="num ${sinalLivre}">${fmtR$(livre)}</td>
            </tr>
            <tr class="n1 custo">
              <td>(-) Efeito líquido do funding (saídas − entradas)</td>
              <td class="num ${sinalFunding}">${fmtR$(-custoFunding)}</td>
            </tr>
            <tr class="n0 resultado">
              <td>= Fluxo de Caixa</td>
              <td class="num ${sinalReal}">${fmtR$(real)}</td>
            </tr>
          </tbody>
        </table>
        <p class="sec">${this.funding
          ? html`TIR, VPL e Payback continuam <strong>desalavancados</strong> — leem o Fluxo de Caixa Livre,
              para manter comparabilidade entre estruturas de capital.`
          : html`Este estudo não tem operações de Funding: sem funding, o Fluxo de Caixa é
              igual ao Livre.`}</p>
      </urbi-card>
      ${this._renderRetornoPorParte()}
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

  /**
   * #594 · P1 — ROI GERAL do projeto na Análise Financeira.
   *
   * ⚠️ Nenhuma fórmula nasce aqui: o número é `roiProjetoAnalise`, que devolve
   * o `roiPct` de `proformaAvancado` — LITERALMENTE o mesmo valor que a coluna
   * ROI do Painel de estudos publica para este estudo (o caminho de lá está em
   * `frontend/tela-dashboard.ts`, `_calcularUmAvancado`, que também lê
   * `p.roiPct`). Um segundo ROI, calculado aqui com denominador próprio, seria
   * exatamente a divergência entre listagem e tela que a #443 documentou para
   * VGV e Margem — e é o que o critério de aceite 1 da issue existe para
   * impedir. `frontend/retorno-por-parte.test.ts` compara os dois caminhos.
   *
   * As duas linhas de cima existem para o ROI ser AUDITÁVEL na tela: quem lê
   * "18,4%" vê de que resultado e de que investimento ele saiu, sem precisar
   * abrir a Proforma.
   */
  private _renderRoiProjeto(cProjeto: FluxoCalc): TemplateResult {
    // ⚠️ `cProjeto` é `calcProjeto` — o fluxo SEM filtro de fase —, e a área
    // privativa também sai de `dados.receitas` INTEIRAS. As duas pontas têm de
    // ser do mesmo recorte: um ROI de projeto calculado sobre a receita de uma
    // fase e o custo de todas não é o ROI de nada. Ver `calcProjeto`.
    const area = areaPrivativaTotalLinhas(this.dados?.receitas ?? []);
    const p = proformaAvancado(cProjeto, area);
    const roi = roiProjetoAnalise(cProjeto, area);
    // `investimentoTotal <= 0` é estudo sem custo direto nem indireto
    // modelado. Desde a #611, `proformaAvancado`/`roiProjetoAnalise` já
    // devolvem `null` nesse caso (nunca 0 inventado, nunca NaN, nunca
    // Infinity) — `medido` continua o MESMO predicado da divisão
    // (`investimentoTotal > 0`), e por isso é sempre `roi !== null` quando
    // `medido` é verdadeiro; os `!` abaixo dizem exatamente isso ao
    // typechecker, não abrem uma exceção nova.
    const medido = p.investimentoTotal > 0;
    return html`
      <urbi-card titulo="ROI do projeto">
        <table class="proforma">
          <tbody>
            <tr class="n1"><td>Resultado</td><td class="num">${fmtR$(p.resultado)}</td></tr>
            <tr class="n1"><td>Investimento (custo direto + indireto)</td><td class="num">${fmtR$(p.investimentoTotal)}</td></tr>
            <tr class="n0 resultado">
              <td>= ROI</td>
              <td class="num roi-projeto ${medido ? (roi! >= 0 ? 'pos' : 'neg') : 'vazio'}">${medido ? fmtPct(roi!) : '—'}</td>
            </tr>
          </tbody>
        </table>
        <p class="sec">${medido
          ? html`Mesma fórmula da coluna <strong>ROI</strong> do Painel de estudos — resultado sobre
              custo direto + indireto. Os dois números são o mesmo para este estudo, de propósito.`
          : html`Sem custo direto ou indireto modelado não há denominador: o ROI não é exibido em vez
              de sair como 0,0%.`}
          ${this.faseFiltro
            ? html` O filtro de fase <strong>${this.faseFiltro}</strong> não afeta este card: ele é
                sempre do projeto inteiro.`
            : nothing}</p>
      </urbi-card>
    `;
  }

  /**
   * #594 · P2 e P3 — a ABERTURA POR PARTE: o incorporador e cada tranche de
   * investimento (`divida` e `equity`) criada no Funding.
   *
   * ⚠️ Três decisões que valem mais que o código:
   *
   * 1. **Nenhum indicador de tranche é calculado aqui.** Todos vêm de
   *    `indicadoresOperacao` (`frontend/funding-motor.ts`), a mesma função
   *    que a tela de Funding usa no painel "Visão do investidor" — é a fonte
   *    única e testada, e recalcular aqui criaria a segunda fonte de verdade
   *    (critério de aceite 4).
   * 2. **`financiamento_producao` NÃO é uma parte.** Quem filtra é
   *    `tranchesDeInvestimento`; o porquê está no comentário dela. O custo
   *    dele já está dentro do resíduo do incorporador, que é o parágrafo
   *    seguinte.
   * 3. **O incorporador sai SEM ROI, e a tela diz por quê.** Ele é o resíduo:
   *    o total do Fluxo de Caixa alavancado DO PROJETO INTEIRO — o mesmo
   *    número da linha "= Fluxo de Caixa" do card acima quando não há filtro
   *    de fase (com filtro, aquele card mostra a fase e este continua
   *    mostrando o projeto; a nota do card avisa). Para virar ROI
   *    faltaria o denominador, e o app **não modela** capital próprio do
   *    incorporador; inventar um (a exposição máxima, por exemplo) seria
   *    escolha, não dedução. Publicar "0,0%" ali seria pior que a ausência.
   *    A issue registra isso como saída (a), e as saídas (b)/(c) dependem de
   *    decisão do autor.
   */
  private _renderRetornoPorParte(): TemplateResult {
    // ⚠️ `calcProjeto`/`fundingCalcProjeto`, NUNCA `calc`/`fundingCalc`: com
    // filtro de fase os segundos descrevem a fase escolhida (receita recortada,
    // custo inteiro), e publicar isso como "retorno por parte" faria o resíduo
    // do incorporador e os indicadores de cada tranche mudarem porque alguém
    // mexeu num controle de exibição. Achado P1 do App de revisão; ver o
    // comentário de `calcProjeto`.
    const fundingProjeto = this.fundingCalcProjeto;
    const tranches = tranchesDeInvestimento(fundingProjeto);
    const retornoIncorporador = fundingProjeto
      ? fundingProjeto.noFluxo.fluxoMensal.reduce((s, v) => s + v, 0)
      : (this.calcProjeto ?? this.calc)?.fluxoMensal.reduce((s, v) => s + v, 0) ?? 0;
    const taxa = this.dados?.taxa ?? 0;
    const dataInicio = this.dados?.dataInicio ?? null;
    const vazio = html`<td class="num vazio">—</td>`;
    return html`
      <urbi-card titulo="Retorno por parte">
        <div class="tabela-wrap">
          <table class="proforma partes">
            <thead>
              <tr>
                <th>Parte</th>
                <th class="num">Investimento</th>
                <th class="num">Retorno total</th>
                <th class="num">Lucro</th>
                <th class="num">MOIC</th>
                <th class="num">TIR a.a.</th>
                <th class="num">VPL</th>
                <th class="num">Payback</th>
              </tr>
            </thead>
            <tbody>
              <tr class="n0 parte-incorporador">
                <td>Incorporador — resíduo de caixa</td>
                ${vazio}
                <td class="num ${retornoIncorporador >= 0 ? 'pos' : 'neg'}">${fmtR$(retornoIncorporador)}</td>
                ${vazio}${vazio}${vazio}${vazio}${vazio}
              </tr>
              ${tranches.map((s) => this._linhaTranche(s, taxa, dataInicio))}
            </tbody>
          </table>
        </div>
        <p class="sec">
          O <strong>incorporador</strong> fica com o resíduo: é o total do Fluxo de Caixa
          alavancado (a linha "= Fluxo de Caixa" acima), depois de servir todo o funding.
          Ele sai <strong>sem ROI</strong> de propósito — o app não modela o capital próprio
          aportado por ele, então não existe denominador; "0,0%" ali seria um número inventado.
          <strong>MOIC</strong> é múltiplo sobre o capital investido (retorno ÷ investimento:
          1,00× é empatar), e não ROI — a diferença entre os dois é exatamente 1.
          ${this.faseFiltro
            ? html`O filtro de fase <strong>${this.faseFiltro}</strong> está ligado e <strong>não afeta
                este card</strong>: ele é sempre do projeto inteiro. A tabela, os gráficos e o card
                "Fluxo de Caixa Livre × Fluxo de Caixa" acima seguem o filtro.`
            : nothing}
          ${fundingProjeto && tranches.length === 0
            ? html`As operações de <strong>Financiamento à produção</strong> deste estudo não
                aparecem aqui: são crédito bancário atrelado à obra, não uma parte que divide o
                resultado — o custo delas já está dentro do resíduo do incorporador.`
            : nothing}
          ${tranches.length === 0
            ? html`Este estudo não tem tranche de investimento (dívida ou equity):
                o resultado é <strong>100% do incorporador</strong>.`
            : nothing}
        </p>
      </urbi-card>
    `;
  }

  /**
   * #594 — uma linha da abertura por parte. Toda célula é leitura direta de
   * `indicadoresOperacao`; a única decisão local é QUANDO exibir "—" em vez de
   * um número, e ela existe pelo critério de aceite 7: operação criada e não
   * configurada é caso real, com `investimentoTotal = 0`.
   *
   * `moic` já devolve 0 sem aporte (`funding-motor.ts`, `aportes > 0 ? … : 0`),
   * então não há divisão por zero em lugar nenhum — mas "0,00×" afirmaria que o
   * investidor perdeu tudo, quando o que houve foi não haver investimento.
   */
  private _linhaTranche(s: SerieOperacao, taxa: number, dataInicio: string | null): TemplateResult {
    const ind = indicadoresOperacao(s, taxa);
    const investiu = ind.investimentoTotal < 0;
    const nome = s.operacao.nome || (eDivida(s.operacao.tipo) ? 'Dívida' : 'Equity');
    const rotulo = eDivida(s.operacao.tipo) ? 'Dívida' : 'Equity';
    return html`
      <tr class="n1 parte-tranche">
        <td>${nome} <span class="nota-base">(${rotulo})</span></td>
        <td class="num">${fmtR$(ind.investimentoTotal)}</td>
        <td class="num">${fmtR$(ind.retornoTotal)}</td>
        <td class="num ${ind.lucro >= 0 ? 'pos' : 'neg'}">${fmtR$(ind.lucro)}</td>
        <td class="num ${investiu ? '' : 'vazio'}">${investiu ? `${fmtNum(ind.moic, 2)}×` : '—'}</td>
        <td class="num ${ind.tirAnual === null ? 'vazio' : ''}">${ind.tirAnual === null ? '—' : fmtPct(ind.tirAnual * 100)}</td>
        <td class="num ${ind.vpl >= 0 ? 'pos' : 'neg'}">${fmtR$(ind.vpl)}</td>
        <td class="num ${ind.paybackMes === null ? 'vazio' : ''}">${ind.paybackMes === null ? '—' : rotuloMesRelativo(dataInicio, ind.paybackMes)}</td>
      </tr>
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

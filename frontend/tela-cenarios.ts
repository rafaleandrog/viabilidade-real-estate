import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import {
  type EventoCrono, type PeriodoAgregado, periodosAnuais, rotuloMesRelativo, mesRepasse,
} from './fluxo-shared.js';
import {
  calcularFluxo, aplicarCenario, agregarFluxoPorPeriodos,
  type FluxoCalc, type FluxoConfig, type CenarioParams,
} from './fluxo-caixa-motor.js';
import { marcos, comparacaoCenario } from './fluxo-graficos.js';
import {
  estiloFluxoTabela, kpisFluxo, tabelaFluxo, chavesColapso, alternarColapso, controlesFluxo,
} from './fluxo-tabela.js';
import { calcularVariacao } from './cenario-variacao.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal, agregarFundingPorPeriodos,
  type FundingCalc, type OperacaoFunding,
} from './funding-motor.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarBenchmarks, listarCenarios, criarCenario, removerCenario,
  listarFundingOperacoes,
} from './viabilidade-api.js';

// ─────────────────────────────────────────────────────────────────────────
// Aba CENÁRIOS do Avançado (Etapa 8 · #56) — exclusiva do nível Avançado.
//
// Simula variações de dois parâmetros sobre o estudo inteiro — preço de venda
// (R$/m²) e custo de obra (R$/m²) — via range sliders cujos limites vêm dos
// benchmarks de sensibilidade (`preco` / `custo_obras`). Arrastar reaplica os
// deltas ao motor (aplicarCenario) e recalcula o fluxo em tempo real:
//  · esquerda: sliders + salvar/nomear cenário;
//  · direita: fluxo acumulado (base cheia + cenário tracejado);
//  · abaixo: o fluxo de caixa completo do cenário (mesmos campos da aba Fluxo);
//  · fim: tabela dos cenários salvos (persistem no estudo) com botão remover.
//
// Reuso: a tabela/KPIs vêm de fluxo-tabela (idênticos à aba Fluxo de Caixa) e o
// gráfico de fluxo-graficos. O Preliminar NÃO usa esta tela (segue em
// viab-tela-graficos, sua aba Gráficos estática).
// ─────────────────────────────────────────────────────────────────────────

const n = (v: any): number => Number(v) || 0;

interface Faixa { min: number; max: number; }

@customElement('viab-tela-cenarios')
export class ViabTelaCenarios extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private precoPct = 0;
  @state() private custoPct = 0;
  @state() private nomeNovo = '';
  @state() private salvando = false;
  @state() private cenarios: any[] = [];
  @state() private colapso: Record<string, boolean> = {};
  @state() private removerId: number | null = null;
  // #186: mesmos controles do Fluxo de Caixa (Recolher tudo, Mensal/Anual,
  // filtro Global/por fase), aplicados ao FluxoCalc do cenário SIMULADO.
  @state() private faseFiltro = '';
  @state() private visao: 'mensal' | 'anual' = 'mensal';
  // Item 5 (Cenários × Funding, decisão do autor 2026-08-02): operações de
  // Funding reagem ao cenário simulado — mesmo `fundingDoEstudo` já usado em
  // tela-fluxo-ver.ts, sobre o `FluxoCalc` do cenário em vez do real.
  // #349: o funding passou a ser lido dentro da tabela principal (a separada
  // foi apagada) e acompanha as duas views — a antiga restrição "só na
  // Mensal" caiu com `agregarFundingPorPeriodos`.
  //
  // ⚠️ #596: aqui havia a nota de que a coluna "Resultado após custo financ."
  // da tabela de cenários salvos nunca dependeu da view. Essa coluna SAIU — a
  // nota foi junto, senão descreveria UI que não existe mais.
  @state() private operacoes: OperacaoFunding[] = [];

  private baseConfig: FluxoConfig | null = null;
  // Último FluxoCalc do cenário em exibição (mensal, não-agregado) — guardado
  // fora do render() para `_toggleTudo` (chavesColapso) poder lê-lo.
  private ultimoCalc: FluxoCalc | null = null;
  private crono: EventoCrono[] = [];
  private dataInicio: string | null = null;
  private faixaPreco: Faixa = { min: -15, max: 15 };
  private faixaCusto: Faixa = { min: -15, max: 15 };
  private carregado = false;
  // Memória dos fluxos já calculados, por par de deltas (#131). Arrastar um
  // slider dispara um render por pixel e cada render precisa do fluxo da base,
  // do cenário vivo E de cada cenário salvo — sem cache seriam N+2 execuções do
  // motor por quadro. Com ele só o par novo é calculado; base, salvos e valores
  // já visitados (arrastar de volta) saem do mapa.
  private cacheCalc = new Map<string, FluxoCalc>();

  static styles = [estiloPrimitivo, estiloConteudo, estiloFluxoTabela, css`
    .topo { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 16px; align-items: start; }
    @media (max-width: 860px) { .topo { grid-template-columns: 1fr; } }
    .graf-wrap { overflow-x: auto; }
    /* #595: a cor de cada serie sai DAQUI, e nao de uma chave "cor" no dado —
       nao porque o primitivo IGNORE "cor" (o dist/index.d.ts do SDK confirma
       que series[i].cor e honrada, ver o paragrafo do #185 mais abaixo), mas
       porque o CANAL certo pra entregar uma referencia a variavel CSS e uma
       PROPRIEDADE CSS, nao uma string dentro do dado. var(--x, #hex) so
       resolve em valor de propriedade CSS: entregue como STRING dentro do
       dado, so funciona se o primitivo a injetar tambem num valor de
       propriedade CSS, e e INVALIDO se ele a injetar num atributo de
       apresentacao SVG (stroke="var(...)") — caso em que o traco cai para o
       inicial (none: some a linha) e o marcador para o fill inicial (preto).
       Definir as duas custom properties, que scripts/guard-tokens-css.mjs
       reconhece como ponto de customizacao legitimo no :host de
       UrbiGraficoBase, vale nos dois casos — e e o que garante o criterio 1
       da #595: series em cores DISTINTAS entre si.
       (Este bloco nao usa crase de proposito: o CSS mora dentro de um template
       literal marcado, e uma crase encerraria o template ali mesmo — erro que
       o typecheck acusa longe daqui, na linha do "static styles".) */
    .graf urbi-grafico-linha {
      --urbi-grafico-cor-1: var(--cor-texto-forte, #e8e8ea);
      /* --cor-primaria e um GRADIENTE nas 4 variantes de tema do espelho —
         gradiente e invalido em contexto de cor de serie (IACVT / atributo
         descartado), a mesma falha silenciosa que esta issue diagnostica.
         A variante solida existe exatamente para contexto de cor. */
      --urbi-grafico-cor-2: var(--cor-primaria-solida, #7c5cff);
    }
    /* #185: marcos do cronograma + Payback/Exposicao em texto — a migracao para
       urbi-grafico-linha abriu mao da linha tracejada e dos marcadores verticais
       que o SVG customizado desenhava.

       ⚠️ #595 CORRIGIU ESTE PARAGRAFO UMA SEGUNDA VEZ, NA DIRECAO OPOSTA. A
       redacao anterior dizia que "SerieGrafico so declara { rotulo, valores,
       cor }, sem dasharray/anotacao" nao tinha fonte, porque o unico lugar que
       responderia — o dist/index.d.ts do SDK — nao existia neste ambiente
       (GitHub Packages privado, 401). O 401 acabou (CLAUDE.md, secao
       Validacao): node_modules/@urbiverso/sdk/dist/index.d.ts esta no disco, e
       ele CONFIRMA a afirmacao original, nao a desmente. "interface
       SerieGrafico { rotulo: string; valores: (number | null)[]; cor?: string
       }" — sem dasharray nem anotacao, exatamente como o paragrafo original
       dizia. E o doc da familia, no mesmo arquivo, sobre UrbiGraficoLinha:
       "Cores via paleta CSS (--urbi-grafico-cor-1..6), sobrescritas por
       series[i].cor" — "cor" SEMPRE foi honrada; a tentativa por dado nunca
       teve como funcionar por falta de fonte NENHUMA, so por outro motivo (a
       colisao de contexto SVG que a custom property acima resolve). O que
       continua VERDADE, e basta para a decisao da #185, e que o primitivo nao
       declara prop de dasharray nem de anotacao. Quem for mexer aqui le o
       dist/index.d.ts do SDK, nao este paragrafo. */
    .marcos-lista { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px; font-size: 0.78rem; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
    .marcos-lista strong { color: var(--cor-texto, rgba(255,255,255,0.85)); font-weight: 600; }

    .slider { margin: 14px 0; }
    .slider-topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .slider-topo .rot { font-weight: 600; }
    /* #633 — mesmo diagnóstico do bloco --urbi-grafico-cor-2 acima (#595): */
    /* --cor-primaria é um GRADIENTE nas 4 variantes de tema, inválido em */
    /* contexto de cor (color/accent-color) — invalid-at-computed-value-time. */
    /* --cor-primaria-solida é a variante pensada para isto. */
    .slider-topo .val { font-variant-numeric: tabular-nums; color: var(--cor-primaria-solida, #7c5cff); font-weight: 700; }
    .slider input[type="range"] { width: 100%; accent-color: var(--cor-primaria-solida, #7c5cff); }
    .slider-lim { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-top: 2px; }
    .salvar { display: flex; gap: 8px; align-items: flex-end; margin-top: 18px; flex-wrap: wrap; }
    .salvar urbi-input { flex: 1; min-width: 140px; }
    .reset { margin-top: 8px; }

    .secao-fluxo { margin-top: 20px; }
    .secao-fluxo h3, .secao-cenarios h3 { margin: 0 0 10px; }
    .secao-cenarios { margin-top: 24px; }

    /* #265: reversão consciente da #187 (PROGRESSO §547-551). A #187 pôs
       width:auto para a tabela não esticar e as colunas não ficarem largas
       demais para o dado; o efeito colateral foi a tabela encolher e "flutuar"
       à esquerda do card. Volta a ocupar 100% da largura, mas a folga é
       absorvida SÓ pela coluna do nome (width:100% na 1ª coluna abaixo) — as
       numéricas seguem no seu min-content e as estreitas/var no tamanho fixo,
       então nada se espalha. */
    table.cen { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.cen th, table.cen td { padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.08)); font-size: 0.82rem; white-space: nowrap; }
    table.cen th { color: var(--cor-texto-sec, rgba(255,255,255,0.55)); font-weight: 600; }
    /* Coluna do nome do cenário absorve a folga da largura total. */
    table.cen th:first-child, table.cen td:first-child { text-align: left; width: 100%; }
    table.cen td.pos { color: var(--cor-sucesso, #13a98d); }
    table.cen td.neg { color: var(--cor-erro, #d45a3a); }
    table.cen tr.linha-real td { font-weight: 700; background: var(--cor-primaria-fundo, rgba(124,92,255,0.12)); }
    table.cen tr.linha-real td:first-child urbi-icone { margin-right: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.55)); }
    /* #187/#265: Preço venda/Custo obra estreitas (só "±NN%") — largura fixa. */
    table.cen th.cen-estreita, table.cen td.cen-estreita { width: 84px; }
    /* #187: coluna própria para a variação (badge) de VPL/TIR/Exposição máx.,
       separada do valor — cabeçalho vazio (rótulo só em aria-label). */
    table.cen th.cen-var, table.cen td.cen-var { width: 68px; padding-left: 2px; }
    table.cen td urbi-badge { vertical-align: middle; }
    .cen-wrap { overflow-x: auto; }
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
      const [receitas, custos, curvas, crono, params, bm, cens, operacoes] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarBenchmarks(this.estudo.tipo_empreendimento),
        listarCenarios(this.estudo.id),
        listarFundingOperacoes(this.estudo.id),
      ]);
      this.operacoes = operacoes?.erro ? [] : (operacoes.dados || []);
      this.crono = crono?.erro ? [] : (crono.dados || []);
      this.dataInicio = params?.erro ? null : (params.data_inicio_projeto ?? null);
      this.baseConfig = {
        dataInicio: this.dataInicio,
        taxaDescontoAa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        cronograma: this.crono,
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: custos?.erro ? [] : (custos.dados || []),
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: n(this.estudo?.terreno_manual_area) || n(this.estudo?.area_terreno_nucleo),
        // #346: RET global (era por Grupo, avancado_fases.fluxo_pagamento.ret).
        ret: params?.erro ? undefined : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
        // #473: default true preserva o comportamento histórico (VGV bruto).
        corretagemSobrePermutaFisica: this.estudo?.corretagem_sobre_permuta_fisica !== false,
        // #585: a taxa de tabela e GLOBAL do estudo — a unica entrada e a aba
        // Viabilidade → Financeiro (`estudos.juros_tabela_aa_padrao`). Campo
        // OBRIGATORIO de `FluxoConfig`: parar de passa-lo vira TS2741, nao silencio.
        jurosTabelaAaEstudo: Number(this.estudo?.juros_tabela_aa_padrao) || 0,
        // #446: o horizonte precisa cobrir a quitação das operações, senão a
        // série é cortada e `saldoFinal` exibe um saldo truncado.
        operacoesFunding: this.operacoes,
      };
      this.faixaPreco = this._faixa(bm?.dados || [], 'preco');
      this.faixaCusto = this._faixa(bm?.dados || [], 'custo_obras');
      this.cenarios = cens?.erro ? [] : (cens.dados || []);
      this.cacheCalc.clear();  // baseConfig novo invalida tudo que estava memorizado
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar os cenários', 'erro');
    }
    this.carregando = false;
  }

  // Limites do slider a partir do benchmark de sensibilidade (variação ± %).
  // Sem benchmark configurado, cai num padrão de ±15%.
  private _faixa(benchmarks: any[], campo: string): Faixa {
    const b = benchmarks.find((x) => String(x.campo) === campo);
    const pos = b && b.variacao_positiva_pct != null ? Math.abs(n(b.variacao_positiva_pct)) : 15;
    const neg = b && b.variacao_negativa_pct != null ? Math.abs(n(b.variacao_negativa_pct)) : 15;
    return { min: -Math.round(neg), max: Math.round(pos) };
  }

  /** Teto do cache: arrastar os dois sliders de ponta a ponta gera no máximo
   *  algumas centenas de pares; passando disso, esvazia (recalcular é barato). */
  private static readonly LIMITE_CACHE = 240;

  // #186: filtro por fase incide sobre as linhas de RECEITA do config-base —
  // mesmo campo (`fase_label`, cru da API) e mesmo critério de tela-fluxo-ver.ts.
  private _configFiltrado(): FluxoConfig {
    const cfg = this.baseConfig!;
    if (!this.faseFiltro) return cfg;
    return { ...cfg, linhasReceita: cfg.linhasReceita.filter((l: any) => (l.fase_label || '') === this.faseFiltro) };
  }

  private _calc(params: CenarioParams): FluxoCalc {
    // A chave inclui o filtro de fase (#186) — sem isso, trocar o filtro
    // reaproveitaria do cache um cálculo da fase anterior.
    const chave = `${this.faseFiltro}|${n(params.precoVendaPct)}|${n(params.custoObraPct)}`;
    const memo = this.cacheCalc.get(chave);
    if (memo) return memo;
    const calc = calcularFluxo(aplicarCenario(this._configFiltrado(), params));
    if (this.cacheCalc.size >= ViabTelaCenarios.LIMITE_CACHE) this.cacheCalc.clear();
    this.cacheCalc.set(chave, calc);
    return calc;
  }

  /** Faixas de meses da view Anual (#186/#127) — `null` na view Mensal. */
  private _periodos(prazo: number): PeriodoAgregado[] | null {
    if (this.visao !== 'anual') return null;
    return periodosAnuais(this.dataInicio, prazo);
  }

  // #474 (Passos 23–25, D-Q03 2026-08-22): esta montagem
  // (resultadoFinal → fundingDoEstudo) é LOCAL. O app não tem uma função
  // única para essa sequência (`docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`)
  // — cada consumidor remonta à mão, e pode divergir (R-A36). Fonte única
  // foi CONSIDERADA E RECUSADA pelo autor; ver
  // `docs/viabilidade/fluxo-investidor-formulas.md` §9. Os outros quatro
  // consumidores: frontend/tela-fluxo-ver.ts:179 · frontend/tela-funding.ts:239
  // · frontend/tela-resumo.ts:182 (só remonta resultadoFinal, não chama
  // fundingDoEstudo) · scripts/conferir-estudo.ts:153. (Este arquivo remonta
  // resultadoFinal DE NOVO em `:263`, como `resultadoDesalavancado`.)
  /** §13.3/item 5: simula o Funding sobre o `FluxoCalc` de UM cenário (base ou simulado). `null` sem operações. */
  private _fundingCalcDe(calc: FluxoCalc): FundingCalc | null {
    if (this.operacoes.length === 0) return null;
    const receitaLiquida = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, this.baseConfig!.linhasCusto);
    const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
    return fundingDoEstudo(
      this.operacoes, calc.fluxoMensal, receitaLiquida, resultadoFinal,
      mesRepasse(this.crono), this.baseConfig?.taxaDescontoAa ?? 12,
      { custosRaw: this.baseConfig!.linhasCusto, linhasCusto: calc.linhasCusto, cronograma: this.crono },
    );
  }

  /**
   * #349: o funding do cenário projetado nas categorias da tabela principal —
   * as mesmas funções puras da aba Fluxo de Caixa, que é o que faz a correção
   * valer para as duas telas de uma vez (o autor reportou o mesmo defeito
   * aqui). Já reagrupado pela view Anual quando ela está ativa: a tabela
   * separada só existia na Mensal e o funding sumia ao trocar de view.
   */
  private _fundingDe(calc: FluxoCalc, periodos: PeriodoAgregado[] | null) {
    const f = this._fundingCalcDe(calc)?.noFluxo ?? null;
    if (!f) return null;
    return periodos ? agregarFundingPorPeriodos(f, periodos) : f;
  }

  // ─────────────────────────────────────────────────────────────────────
  // #596: o KPI e a coluna "Resultado após custo financeiro" SAÍRAM — decisão
  // do autor, e junto saiu `_resultadoAposCustoFinanceiro`, que era o único
  // produtor da grandeza.
  //
  // O motivo não é que o número estivesse errado — ele estava certo, e era uma
  // leitura legítima. É que depois da #592 esta MESMA tela passou a exibir três
  // grandezas próximas e diferentes, e a terceira competia com o vocabulário
  // novo sem que o rótulo dissesse em quê:
  //
  //   Fluxo de Caixa Livre (acum.) = c.fluxoAcumulado[último]
  //   Fluxo de Caixa (acum.)       = Livre + entradas − saídas   (saídas = principal + juros)
  //   Resultado após custo financ. = Livre − (juros + retorno de equity)   ← saiu
  //
  // A que saiu não descontava o PRINCIPAL — era por isso que ela não era
  // redundante, e é por isso que a distinção era invisível para quem lesse os
  // três rótulos lado a lado.
  //
  // ⚠️ Quem for reintroduzi-la: o problema não era a conta, era exibi-la sem
  // dizer que ela ignora o principal. A tabela de leituras de
  // `frontend/proforma-avancado.ts` registra as que sobraram.
  // ─────────────────────────────────────────────────────────────────────

  /** Sliders fora do zero — há um cenário alternativo a comparar com a base. */
  private get _alterado(): boolean {
    return this.precoPct !== 0 || this.custoPct !== 0;
  }

  private _rotuloCenario(): string {
    const p = (v: number) => `${v > 0 ? '+' : ''}${v}%`;
    return `Cenário · preço ${p(this.precoPct)} · obra ${p(this.custoPct)}`;
  }

  // #185: marcos do cronograma (Lançamento/Início/Fim de Obra) + Payback e
  // Exposição máxima do cenário exibido — texto fora do gráfico, mitigação
  // aceita pela remoção dos marcadores verticais e da linha tracejada do SVG.
  private _renderMarcos(c: FluxoCalc): TemplateResult {
    const itens = [
      ...marcos(this.crono).map((m) => ({ rotulo: m.rotulo, valor: rotuloMesRelativo(this.dataInicio, m.mes) })),
      { rotulo: 'Payback', valor: c.paybackData ?? '—' },
      { rotulo: 'Exposição máxima', valor: fmtR$(Math.abs(c.exposicaoMaxima)) },
    ];
    return html`
      <div class="marcos-lista">
        ${itens.map((i) => html`<span><strong>${i.rotulo}:</strong> ${i.valor}</span>`)}
      </div>
    `;
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando cenários..."></urbi-loading>`;
    const cfg = this.baseConfig;
    if (!cfg || (cfg.linhasReceita.length === 0 && cfg.linhasCusto.length === 0)) {
      return html`
        <urbi-estado-vazio icone="fa-solid fa-sliders"
          mensagem="Defina o cronograma, as receitas e os custos nas outras abas para simular cenários."></urbi-estado-vazio>`;
    }
    // Base = cenário real (deltas zerados). Enquanto os sliders estiverem nele
    // o cenário É a base — nada de setas de variação nos KPIs (#131/#132), mas
    // o GRÁFICO continua mostrando as duas séries mesmo coincidindo (#354): o
    // autor quer as duas linhas sempre visíveis, para não sumir a série
    // simulada quando o slider volta a 0%.
    const base = this._calc({ precoVendaPct: 0, custoObraPct: 0 });
    const alterado = this._alterado;
    const cenario = alterado
      ? this._calc({ precoVendaPct: this.precoPct, custoObraPct: this.custoPct })
      : base;
    this.ultimoCalc = cenario;
    // #186: Mensal/Anual só reagrupa as COLUNAS do gráfico e da tabela — os
    // KPIs (VPL/TIR/Payback/Exposição) seguem lendo o cálculo mensal, mesma
    // convenção de tela-fluxo-ver.ts.
    const periodos = this._periodos(Math.max(base.prazo, cenario.prazo));
    const exibBase = periodos ? agregarFluxoPorPeriodos(base, periodos) : base;
    const exibCenario = periodos ? agregarFluxoPorPeriodos(cenario, periodos) : cenario;
    // #595: eixo e séries do card de comparação saem de uma função PURA
    // (`comparacaoCenario`), e não montados no template. Duas razões: o
    // alinhamento das duas séries ao eixo vira coisa testável (era ele que
    // podia quebrar o `path` e deixar só os pontos), e a cor deixa de viajar
    // como dado — ver a nota da função e o bloco CSS de `.graf urbi-grafico-linha`.
    // Ela recebe os cálculos MENSAIS (não `exibBase`/`exibCenario`): na view
    // Anual o alinhamento tem que acontecer ANTES da amostragem de período,
    // porque `agregarFluxoPorPeriodos` preenche a cauda da série mais curta
    // com zeros (`serie[p.fim] ?? 0`) e a curva desabaria em vez de ficar
    // plana — ver a nota da função.
    const comparacao = comparacaoCenario(
      base, cenario, alterado ? this._rotuloCenario() : 'Cenário simulado', periodos,
    );
    return html`
      <div class="topo">
        ${this._renderControles()}
        <urbi-card titulo="Fluxo acumulado — cenário real × cenário simulado">
          <div class="graf-wrap"><div class="graf">
            <urbi-grafico-linha
              formato="moeda"
              legenda="sempre"
              marcadores
              .categorias=${comparacao.categorias}
              .series=${comparacao.series}
            ></urbi-grafico-linha>
          </div></div>
          ${this._renderMarcos(cenario)}
        </urbi-card>
      </div>

      <section class="secao-fluxo">
        <h3>${alterado ? 'Fluxo de caixa do cenário' : 'Fluxo de caixa do cenário real'}</h3>
        ${kpisFluxo(cenario, alterado ? base : null)}
        ${this._renderControlesFluxo()}
        ${tabelaFluxo(exibCenario, this.dataInicio, this.colapso, (ch) => this._t(ch), this._fundingDe(cenario, periodos))}
      </section>

      ${this._renderCenariosSalvos(base)}
    `;
  }

  private _renderControlesFluxo(): TemplateResult {
    const fases = [...new Set((this.baseConfig?.linhasReceita ?? [])
      .map((l: any) => String(l.fase_label || '')).filter(Boolean))];
    const tudoRecolhido = Object.values(this.colapso).some(Boolean);
    return controlesFluxo({
      tudoRecolhido,
      onToggleTudo: () => this._toggleTudo(!tudoRecolhido),
      visao: this.visao,
      onVisao: (v) => { this.visao = v; },
      fases,
      faseFiltro: this.faseFiltro,
      onFase: (v) => { this.faseFiltro = v; },
    });
  }

  private _toggleTudo(recolher: boolean) {
    const chaves = this.ultimoCalc ? chavesColapso(this.ultimoCalc, this._fundingDe(this.ultimoCalc, null)) : [];
    const novo: Record<string, boolean> = {};
    for (const k of chaves) novo[k] = recolher;
    this.colapso = novo;
  }

  private _renderControles(): TemplateResult {
    const alterado = this._alterado;
    return html`
      <urbi-card titulo="Parâmetros do cenário">
        ${this._slider('Preço de venda (R$/m²)', this.precoPct, this.faixaPreco, (v) => this.precoPct = v)}
        ${this._slider('Custo de obra (R$/m²)', this.custoPct, this.faixaCusto, (v) => this.custoPct = v)}
        <div class="reset">
          <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-rotate-left"
            ?desabilitado=${!alterado} @click=${() => { this.precoPct = 0; this.custoPct = 0; }}>
            Voltar à base
          </urbi-botao>
        </div>
        <div class="salvar">
          <urbi-input
            label="Nome do cenário"
            .valor=${this.nomeNovo}
            @urbi:input-change=${(e: CustomEvent) => this.nomeNovo = e.detail.valor}
          ></urbi-input>
          <urbi-botao variante="primario" icone="fa-solid fa-floppy-disk"
            ?desabilitado=${this.salvando} @click=${this._salvar}>Salvar cenário</urbi-botao>
        </div>
      </urbi-card>
    `;
  }

  private _slider(rotulo: string, valor: number, faixa: Faixa, set: (v: number) => void): TemplateResult {
    const sinal = valor > 0 ? '+' : '';
    return html`
      <div class="slider">
        <div class="slider-topo">
          <span class="rot">${rotulo}</span>
          <span class="val">${sinal}${valor}%</span>
        </div>
        <input type="range" min=${faixa.min} max=${faixa.max} step="1" .value=${String(valor)}
          @input=${(e: Event) => set(Number((e.target as HTMLInputElement).value))} />
        <div class="slider-lim"><span>${faixa.min}%</span><span>${faixa.max}%</span></div>
      </div>
    `;
  }

  private _t(chave: string) {
    this.colapso = alternarColapso(this.colapso, chave);
  }

  private _salvar = async () => {
    if (this.salvando || !this.estudo?.id) return;
    this.salvando = true;
    try {
      const nome = this.nomeNovo.trim() || `Preço ${this.precoPct >= 0 ? '+' : ''}${this.precoPct}% · Obra ${this.custoPct >= 0 ? '+' : ''}${this.custoPct}%`;
      const res = await criarCenario(this.estudo.id, {
        nome, preco_venda_pct: this.precoPct, custo_obra_pct: this.custoPct,
        ordem: this.cenarios.length,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar o cenário', 'erro'); return; }
      this.nomeNovo = '';
      const cens = await listarCenarios(this.estudo.id);
      this.cenarios = cens?.erro ? this.cenarios : (cens.dados || []);
      urbiVerso.notificar('Cenário salvo.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar o cenário', 'erro');
    }
    this.salvando = false;
  };

  private _confirmarRemover = async () => {
    const id = this.removerId;
    this.removerId = null;
    if (id == null || !this.estudo?.id) return;
    try {
      const res = await removerCenario(this.estudo.id, id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.cenarios = this.cenarios.filter((c) => Number(c.id) !== Number(id));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };

  private _renderCenariosSalvos(base: FluxoCalc): TemplateResult {
    // ⚠️ #596: esta tabela já teve uma coluna extra condicional ("Resultado
    // após custo financ.", só com operação de Funding). Ela saiu — a tabela
    // não ramifica mais por presença de funding.
    return html`
      <section class="secao-cenarios">
        <h3>Cenários salvos</h3>
        <div class="cen-wrap">
          <table class="cen">
            <thead>
              <tr>
                <th>Cenário</th>
                <th class="cen-estreita">Preço venda</th>
                <th class="cen-estreita">Custo obra</th>
                <th>VPL</th>
                <th class="cen-var" aria-label="Variação de VPL vs. cenário real" scope="col"></th>
                <th>TIR</th>
                <th class="cen-var" aria-label="Variação de TIR vs. cenário real" scope="col"></th>
                <th>Payback</th>
                <th>Exposição máx.</th>
                <th class="cen-var" aria-label="Variação de Exposição máxima vs. cenário real" scope="col"></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${this._linhaReal(base)}
              ${this.cenarios.map((c) => this._linhaCenario(c, base))}
            </tbody>
          </table>
        </div>
        ${this.cenarios.length === 0
          ? html`<urbi-estado-vazio icone="fa-solid fa-layer-group"
              mensagem="Nenhum cenário salvo. Ajuste os parâmetros acima e clique em “Salvar cenário”."></urbi-estado-vazio>`
          : nothing}
      </section>
      ${this.removerId != null ? this._renderConfirmRemover() : nothing}
    `;
  }

  // Linha travada, sempre primeira: o cenário real (sem alterações dos sliders),
  // referência de comparação para os cenários salvos pelo usuário.
  private _linhaReal(base: FluxoCalc): TemplateResult {
    const tir = base.tir === null ? '—' : fmtPct(base.tir);
    return html`
      <tr class="linha-real">
        <td><urbi-icone classe="fa-solid fa-lock"></urbi-icone>Cenário real</td>
        <td class="cen-estreita">—</td>
        <td class="cen-estreita">—</td>
        <td class=${base.vpl >= 0 ? 'pos' : 'neg'}>${fmtR$(base.vpl)}</td>
        <td class="cen-var"></td>
        <td>${tir}</td>
        <td class="cen-var"></td>
        <td>${base.paybackData ?? '—'}</td>
        <td class="neg">${fmtR$(Math.abs(base.exposicaoMaxima))}</td>
        <td class="cen-var"></td>
        <td></td>
      </tr>
    `;
  }

  /**
   * Badge de variação do indicador contra o cenário real (#132). VPL e TIR
   * são "maior é melhor" (`maiorMelhor = true`, o default). A Exposição
   * máxima (#491) é lida por MAGNITUDE, não por sinal — o chamador passa os
   * dois valores em módulo e `maiorMelhor = false`, a mesma convenção do KPI
   * de `frontend/fluxo-tabela.ts` (`varKpi`).
   */
  // #491 (auditoria de 2026-08-24): `maiorMelhor` NÃO tem default, de
  // propósito. O commit da #491 afirmava que já era assim e estava errado — a
  // obrigatoriedade valia só para `calcularVariacao` (cenario-variacao.ts), a
  // função pura; este wrapper, que é quem o template de fato chama, tinha
  // `= true`. Medido: apagar o `false` da chamada da Exposição máxima
  // compilava LIMPO e reintroduzia o bug que a #491 existe para consertar —
  // o badge voltava a ler por sinal em vez de por magnitude, em silêncio.
  //
  // Teste de função pura não alcança este ponto: a chamada mora dentro de um
  // template `html` do Lit. Com o parâmetro obrigatório, a omissão vira
  // TS2554 — é a defesa que o `CLAUDE.md` prescreve para a classe de defeito
  // nº 1, aplicada onde ela de fato precisava estar.
  private _badgeVar(novo: number | null, base: number | null, maiorMelhor: boolean) {
    const v = calcularVariacao(novo, base, maiorMelhor);
    if (!v) return nothing;
    return html`<urbi-badge cor=${v.melhor ? 'sucesso' : 'perigo'}>${v.texto}</urbi-badge>`;
  }

  private _linhaCenario(c: any, base: FluxoCalc): TemplateResult {
    const calc = this._calc({ precoVendaPct: n(c.preco_venda_pct), custoObraPct: n(c.custo_obra_pct) });
    const pctTxt = (v: number) => `${v > 0 ? '+' : ''}${v}%`;
    const tir = calc.tir === null ? '—' : `${fmtPct(calc.tir)}`;
    return html`
      <tr>
        <td>${c.nome || 'Cenário'}</td>
        <td class="cen-estreita">${pctTxt(n(c.preco_venda_pct))}</td>
        <td class="cen-estreita">${pctTxt(n(c.custo_obra_pct))}</td>
        <td class=${calc.vpl >= 0 ? 'pos' : 'neg'}>${fmtR$(calc.vpl)}</td>
        <td class="cen-var">${this._badgeVar(calc.vpl, base.vpl, true)}</td>
        <td>${tir}</td>
        <td class="cen-var">${this._badgeVar(calc.tir, base.tir, true)}</td>
        <td>${calc.paybackData ?? '—'}</td>
        <td class="neg">${fmtR$(Math.abs(calc.exposicaoMaxima))}</td>
        <td class="cen-var">${this._badgeVar(Math.abs(calc.exposicaoMaxima), Math.abs(base.exposicaoMaxima), false)}</td>
        <td>
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
            @click=${() => this.removerId = Number(c.id)}></urbi-botao>
        </td>
      </tr>
    `;
  }

  private _renderConfirmRemover(): TemplateResult {
    return html`
      <urbi-modal title="Remover cenário" maxWidth="380px" @urbi-modal:close=${() => this.removerId = null}>
        <p>Remover este cenário salvo?</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <urbi-botao variante="fantasma" @click=${() => this.removerId = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemover}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }
}

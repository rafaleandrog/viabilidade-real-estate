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
import { calcularFluxo, taxaDescontoOuPadrao, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { dinheiroParaRotulo, impostoDoEstudoAvancado, mesRepasse, operacaoComRascunho, rotuloMesRelativo, type ContextoCusto, type EventoCrono } from './fluxo-shared.js';
import {
  fundingDoEstudo, indicadoresOperacao, indicadoresFinanciamentoProducao, indicadoresAntecipacao,
  receitaLiquidaComCorretagemMensal, linhasFinanciaveisPadrao,
  reordenarDentroDoTipo, camadasComOrdemAlterada, eDivida, riscoTarifaDuplicada,
  PADRAO_EXPOSICAO_MINIMA, PADRAO_PERCENTUAL_FINANCIAVEL, PADRAO_AMORTIZAR_COM_CAIXA,
  type FundingCalc, type OperacaoFunding, type TipoOperacao, type SerieOperacao,
} from './funding-motor.js';
import './viab-num.js';
import './funding-cartao.js';
import './funding-janela.js';
import './funding-grafico-operacao.js';
import type { ConfirmacaoJanela, SimulacaoJanela } from './funding-janela.js';
import { nomePadrao, serieDoGrafico, termosDaOperacao, type TipoDaJanela } from './funding-janela-dados.js';
import {
  indicadoresEstrutura, sequenciaDeEstrutura, type SequenciaEstrutura,
} from './funding-estrutura.js';
import { AVISO_SEM_LASTRO, TIPOS_DE_CARTAO, dadosDoCartao, operacoesDeCartao, type ValorCartao } from './funding-cartao-dados.js';
import { dadosDaEstrutura, type LinhaSequencia } from './funding-estrutura-dados.js';
import './grafico-stack-capital.js';

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
//  · `equity`                 — aporte + retorno, em dois modos;
//  · `antecipacao_recebiveis` — cessão de parte da carteira (#851), cega ao
//    caixa; o valor sai do lastro e da taxa de desconto.
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
// Dívida, equity e antecipação são criadas e editadas na janela de operação
// (`viab-funding-janela`), com prévia por tecla sobre o rascunho dela, sem
// tocar a API; só "Criar operação" ou "Salvar alterações" gravam. A página da
// operação é leitura. O Financiamento à produção continua com o formulário na
// aba própria, com o rascunho em `draft` e o "Salvar" dele.
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
  // #851: cessão de parte da carteira de recebíveis (CRI, FIDC, banco), que
  // paga à vista o valor presente das parcelas cedidas.
  { valor: 'antecipacao_recebiveis', rotulo: 'Antecipação de recebíveis', icone: 'fa-solid fa-forward' },
];

// As abas da tela. As abas por tipo (Dívida, Equity, Antecipação) saíram por
// decisão do dono: dívida, equity e antecipação viram CARTÕES na aba
// Operações (`TIPOS_DE_CARTAO`, em `funding-cartao-dados.ts`), e clicar num
// cartão abre a página da operação, dentro da própria aba. O Financiamento à
// produção não tem cartão: é único por estudo e tem aba própria, roteada por
// `id` em `render()`. Todo tipo de `TIPOS` tem lugar — cartão ou aba —, e
// `frontend/funding-abas.test.ts` trava essa partição.
//
// A aba Estrutura de capital mostra o capital stack do projeto (totais, torre
// por senioridade e a sequência "antes → depois"); só leitura, roteada por `id`
// em `render()`.
const ABAS: { id: string; label: string; icone: string }[] = [
  { id: 'operacoes', label: 'Operações', icone: 'fa-solid fa-table-list' },
  { id: 'financiamento_producao', label: 'Financiamento à produção', icone: 'fa-solid fa-building-columns' },
  { id: 'estrutura', label: 'Estrutura de capital', icone: 'fa-solid fa-layer-group' },
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
  // A página da operação aberta dentro da aba Operações: o `id` dela, ou null
  // na lista de cartões. Estado interno, mesma convenção de `abaAtiva` (não vai
  // para a URL). Operação aberta que deixa de existir volta para a lista
  // (`_operacaoAberta`).
  @state() private opAbertaId: number | string | null = null;
  // A janela de criar ou editar operação (`viab-funding-janela`): null fechada.
  // Nada é gravado enquanto ela está aberta; quem grava é `_confirmarJanela`.
  @state() private janela: { modo: 'criar' } | { modo: 'editar'; gravada: any } | null = null;
  @state() private janelaGravando = false;
  @state() private janelaErro = '';
  // Para onde o foco vai quando a tela for desenhada de novo: o botão que abriu
  // a janela, ou um alvo estável da aba Operações depois de remover. Semântico,
  // e não a referência do elemento: `_carregar` troca a aba pelo carregando e o
  // botão de antes deixa de existir.
  private focarAlvo: 'nova' | 'editar' | 'lista' | null = null;
  // A sequência "antes → depois" por senioridade. Calculada em `_recalcular`,
  // NUNCA em `render()`: são N+1 simulações a cada tecla.
  @state() private sequencia: SequenciaEstrutura | null = null;
  // O fluxo do projeto com que a sequência foi calculada (com o rascunho,
  // quando houver): os totais da aba Estrutura de capital leem os usos dele, e
  // não de `calc`, para não misturarem duas versões do projeto.
  private calcDaSequencia: FluxoCalc | null = null;
  // Cartão a focar quando a lista voltar a ser desenhada (volta da página).
  private focarCartaoId: number | string | null = null;
  // #587: guarda contra criar duas vezes o Financiamento à produção — a
  // criação é assíncrona, e `_carregar` pode ser chamado de novo (troca de
  // estudo) antes da primeira resposta voltar.
  @state() private criandoFinanciamento = false;
  @state() private calc: FluxoCalc | null = null;
  @state() private funding: FundingCalc | null = null;
  // #586: aba ativa — estado INTERNO, não vai para a URL. É a convenção do
  // nível 2 declarada em `frontend/tela-avancado.ts:26-27`; esta tela é nível 3
  // (uma subaba de Viabilidade), então com mais razão ainda.
  @state() private abaAtiva: string = 'operacoes';

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
    /* #586: esta regra era .barra, a faixa dos TRÊS botões de criar no topo da
       tela. Com as abas, cada tipo tem o seu botão dentro da própria aba — um
       só —, então o nome mudou junto com o papel. A regra .barra .espaco morreu
       com ela: o único span.espaco desta tela vive em .op-cab.
       (Sem crase neste comentário: ele mora dentro de um template literal, e
       uma crase aqui FECHA o css e quebra o arquivo — foi o que aconteceu.) */
    .acao-aba { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    /* Aba Operações: a grade de cartões e a página da operação. */
    .cartoes {
      display: grid; gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    }
    .pagina-operacao .voltar { margin-bottom: 10px; }
    /* Aba Estrutura de capital. */
    .estrutura { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
    .totais {
      display: grid; gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
    }
    .total {
      padding: 10px 12px; min-width: 0;
      border: 1px solid; border-color: var(--cor-borda); border-radius: var(--raio-sm);
      background: var(--cor-superficie);
    }
    .total .rot { font-size: 12px; color: var(--cor-texto-sec); }
    .total .val {
      font-size: 1.1rem; font-weight: 700; margin-top: 4px; color: var(--cor-texto-forte);
      font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
    }
    .bloco-estrutura h4 { margin: 0 0 10px; font-size: 13px; color: var(--cor-texto-sec); font-weight: 600; }
    .apoio { margin: 0; padding-left: 18px; font-size: 12px; color: var(--cor-texto-sec); line-height: 1.5; }
    .apoio li + li { margin-top: 4px; }
    /* A página recebe o foco ao abrir (o cartão que o tinha saiu da tela); o
       Tab seguinte vai ao botão de voltar. Foco programático em contêiner não
       pede anel. */
    .pagina-operacao:focus { outline: none; }
    .op-nome { margin: 0; font-size: 1.05rem; color: var(--cor-texto); min-width: 0; overflow-wrap: anywhere; }
    /* Termos da operação em leitura, por etapa da janela. */
    .termos { display: grid; gap: 4px 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
    .termos dl { margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .termos .termo { display: flex; justify-content: space-between; gap: 12px; font-size: 0.85rem; min-width: 0; }
    .termos dt { color: var(--cor-texto-sec); }
    .termos dd { margin: 0; color: var(--cor-texto); font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .op-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .op-cab .espaco { flex: 1; }
    .op-cab urbi-input { min-width: 220px; }
    .secao { margin-top: 12px; }
    .secao h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--cor-texto-sec);
    }
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .grid > * { width: 190px; max-width: 100%; box-sizing: border-box; }
    .grid > .p2 { width: 300px; }
    .sel-campo { display: flex; flex-direction: column; gap: 4px; width: 190px; }
    .sel-campo.p2 { width: 300px; }
    .sel-rotulo { font-size: 0.75rem; text-transform: uppercase; color: var(--cor-texto-sec); font-weight: 700; }
    .form-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .custo-lista { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow: auto; }

    /* Painel do investidor: markup próprio + tokens, mesmo padrão adotado na
       #352 — urbi-kpi não serve aqui porque a caixa precisa de rótulo, valor e
       uma legenda de contexto na mesma moldura. */
    .ind { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 6px; }
    .ind-card {
      background: var(--cor-superficie);
      border: 1px solid var(--cor-borda);
      border-radius: 8px; padding: 10px 12px; min-width: 0;
    }
    .ind-card .rot {
      font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec); font-weight: 700;
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
    .ind-card.pos .val { color: var(--cor-sucesso); }
    .ind-card.neg .val { color: var(--cor-erro); }
    .nota { font-size: 0.78rem; color: var(--cor-texto-sec); margin-top: 8px; }
    /* Ícone no lugar de emoji: aviso (triângulo). */
    .icone-aviso { color: var(--cor-alerta); margin-right: 6px; }

    /* §39 — mesmo padrão de gráfico SVG inline da antiga tela-capital-stack.ts. */
    .grafico-card { margin-top: 12px; }
    svg.grafico { width: 100%; height: auto; overflow: visible; font-variant-numeric: tabular-nums; }
    .linha-entradas { stroke: var(--cor-sucesso); fill: none; stroke-width: 2; }
    .linha-saidas { stroke: var(--cor-erro); fill: none; stroke-width: 2; }
    .linha-custo-elegivel { stroke: var(--cor-texto-sec); fill: none; stroke-width: 1.5; stroke-dasharray: 4 3; }
    .linha-saldo-devedor { stroke: var(--cor-alerta); fill: none; stroke-width: 2.5; }
    .eixo-mes { fill: var(--cor-texto-sec); font-size: 9px; }
    .grafico-legenda { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.72rem; margin-top: 6px; color: var(--cor-texto-sec); }
    .grafico-legenda .ponto { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
  `];

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
      this.taxaDescontoAa = params?.erro ? 12 : taxaDescontoOuPadrao(params.taxa_desconto_aa);

      const config: FluxoConfig = {
        dataInicio: this.dataInicio,
        taxaDescontoAa: this.taxaDescontoAa,
        cronograma: this.crono,
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: this.custos,
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
        ret: impostoDoEstudoAvancado(params),
        // #585: a taxa de tabela e GLOBAL do estudo — a unica entrada e a aba
        // Viabilidade → Financeiro (`estudos.juros_tabela_aa_padrao`). Campo
        // OBRIGATORIO de `FluxoConfig`: parar de passa-lo vira TS2741, nao silencio.
        jurosTabelaAaEstudo: Number(this.estudo?.juros_tabela_aa_padrao) || 0,
        // #446: o horizonte precisa cobrir a quitação das operações, senão a
        // série é cortada e `saldoFinal` exibe um saldo truncado.
        operacoesFunding: this.operacoes,
      };
      this.config = config; this.calc = calcularFluxo(config);
      this.receitaLiquida = receitaLiquidaComCorretagemMensal(
        this.calc.receitaMensal, this.calc.linhasCusto, this.custos,
      );
      this._recalcular();

      // #587: cria a operação de FàP (desligada) se o estudo ainda não tiver
      // uma — DEPOIS do cálculo acima, porque ela muda `this.operacoes`.
      // Inativa, ela não move nenhum número (`funding-motor.ts` zera a série
      // e `fluxo-caixa-motor.ts` não a soma no horizonte), então não recalcula
      // `this.calc` — só `this.funding`, para o card achar sua própria série.
      await this._garantirFinanciamento();
      this._recalcular();
    } finally {
      this.carregando = false;
    }
  }

  // #474 (Passos 23–25, D-Q03 2026-08-22): esta montagem
  // (resultadoFinal → fundingDoEstudo) é LOCAL. O app não tem uma função
  // única para essa sequência (`referencia/inteligencia-evi-incorporacao.md:1584-1594`)
  // — cada consumidor remonta à mão, e pode divergir (R-A36). Fonte única
  // foi CONSIDERADA E RECUSADA pelo autor; ver
  // `referencia/fluxo-investidor-formulas.md` §9. Os outros quatro
  // consumidores: frontend/tela-fluxo-ver.ts:179 · frontend/tela-cenarios.ts:240
  // · frontend/tela-resumo.ts:182 (só remonta resultadoFinal, não chama
  // fundingDoEstudo) · scripts/conferir-estudo.ts:153.
  /** Prévia sobre o DRAFT: o que está sendo digitado já aparece nos indicadores.
   * Operação ancorada com rascunho entra com o mês derivado do Cronograma, o
   * mesmo que o servidor vai gravar no PATCH (`operacaoComRascunho`); operação
   * sem rascunho simula com o `inicio_mes` gravado, como as outras telas. */
  private _recalcular() {
    if (!this.calc) { this.funding = null; this.sequencia = null; this.calcDaSequencia = null; return; }
    const efetivas = this.operacoes.map((o) => operacaoComRascunho(o, this.draft[o.id], this.crono)) as OperacaoFunding[];
    // O horizonte de `this.calc` vem das operações GRAVADAS (`_carregar`). Com
    // rascunho, o fluxo-base é refeito com as efetivas (a mesma montagem de
    // `_simularJanela`), senão uma operação movida para mais tarde é
    // truncada pelo horizonte antigo e o Salvar muda o número.
    const comRascunho = !!this.config && Object.keys(this.draft).length > 0;
    const calc = comRascunho ? calcularFluxo({ ...this.config!, operacoesFunding: efetivas }) : this.calc;
    const receitaLiquida = comRascunho
      ? receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, this.custos)
      : this.receitaLiquida;
    const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
    const simularFunding = (ops: OperacaoFunding[]) => fundingDoEstudo(
      ops, calc.fluxoMensal, receitaLiquida,
      resultadoFinal, mesRepasse(this.crono), this.taxaDescontoAa,
      {
        custosRaw: this.custos, linhasCusto: calc.linhasCusto, cronograma: this.crono,
        recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal,
      },
    );
    this.funding = simularFunding(efetivas);
    this.calcDaSequencia = calc;
    // A sequência "antes → depois" dos cartões: cada passo roda o funding do
    // estudo sobre o MESMO fluxo do projeto (`calc`), com as operações mais
    // seniores até aquela — sem refazer o fluxo por passo. Lista vazia é o
    // projeto sem funding.
    this.sequencia = sequenciaDeEstrutura(
      efetivas,
      (ops) => indicadoresEstrutura(calc, ops.length ? simularFunding(ops) : null),
    );
  }

  // #442: este rótulo lia `orcamento_valor` cru — a mesma coluna que a issue
  // mostrou congelada. A decisão mora em `dinheiroParaRotulo`, pura e testada.
  private _rotuloValor(custo: any): string {
    // Contexto tipado e completo nos campos obrigatórios. Só `pct_vgv` chega à
    // conta aqui (ver `dinheiroParaRotulo`), e ela lê a base vendável; as áreas
    // não entram nessa unidade e ficam em zero. É o valor NOMINAL (% × base de
    // `pct_vgv`) que o rótulo mostra — para a permuta financeira o motor aplica
    // o % sobre o recebimento com deduções, e este rótulo não afirma essa conta.
    const ctx: ContextoCusto | undefined = this.calc
      ? {
        areaPrivativaTotal: 0, areaTerreno: 0,
        vgvTotal: this.calc.vgvTotal, vgvVendavel: this.calc.vgvVendavel,
      }
      : undefined;
    const v = dinheiroParaRotulo(custo, this.calc?.linhasCusto ?? [], ctx);
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
    return nomePadrao(tipo, this.operacoes);
  }

  /** Próxima `ordem` livre: MAX + 1, nunca `length` — ver o comentário em
   * `_adicionar`. Lista vazia começa em 0. */
  private _proximaOrdem(): number {
    return this.operacoes.reduce((m, o) => Math.max(m, Number(o?.ordem) || 0), -1) + 1;
  }

  private _temFinanciamento(): boolean {
    return this.operacoes.some((o) => o.tipo === 'financiamento_producao');
  }

  /** #587: a operação de FàP existente, se houver — a aba dedicada é dela. */
  private _operacaoFinanciamento(): any | undefined {
    return this.operacoes.find((o) => o.tipo === 'financiamento_producao');
  }

  /** §4.3 — os defaults da planilha `Incorp Individual`, para a camada não
   * nascer inerte (sem gatilho de exposição mínima ela nunca libera).
   * Extraído para não divergir entre `_adicionar` e `_garantirFinanciamento`
   * (#587) — as duas criam a mesma operação, por caminhos diferentes. */
  private _defaultsFinanciamentoProducao() {
    return {
      taxa_anual: 12.5, exposicao_minima: PADRAO_EXPOSICAO_MINIMA,
      percentual_financiavel: PADRAO_PERCENTUAL_FINANCIAVEL,
      amortizar_com_caixa_disponivel: PADRAO_AMORTIZAR_COM_CAIXA,
    };
  }

  /**
   * #587 — o Financiamento à produção é ÚNICO E FIXO: a tela cria a operação
   * sozinha, DESLIGADA, na primeira vez que um estudo sem ela é aberto em
   * modo edição, para a aba dedicada ter sempre um formulário sobre o qual
   * desenhar o checkbox. Nasce `ativo: false` — é o estado "estudo sem FàP
   * hoje" da regra de transição da #587: nenhum número entra no motor até o
   * usuário ligar. Estudo que JÁ tinha a operação nunca passa por aqui
   * (`_temFinanciamento()` corta antes) — o `ativo: true` default do
   * `schema.json` é quem preserva esses como ligados.
   *
   * Só roda em modo edição: leitor sem permissão de escrita não pode criar
   * nada, e `criarFundingOperacao` devolveria 403 — a aba trata a ausência
   * como estado de leitura em vez de tentar escrever (ver
   * `_renderAbaFinanciamentoProducao`).
   */
  private async _garantirFinanciamento(): Promise<void> {
    if (!this.editavel || this._temFinanciamento() || this.criandoFinanciamento) return;
    this.criandoFinanciamento = true;
    try {
      const r = await criarFundingOperacao(this.estudo.id, {
        tipo: 'financiamento_producao', nome: this._nomePadrao('financiamento_producao'),
        ordem: this._proximaOrdem(), ativo: false,
        ...this._defaultsFinanciamentoProducao(),
      });
      if (r?.erro) {
        urbiVerso.notificar(r.mensagem || 'Não foi possível preparar o Financiamento à produção.', 'erro');
        return;
      }
      const ops = await listarFundingOperacoes(this.estudo.id);
      this.operacoes = ops?.erro ? this.operacoes : (ops.dados || []);
    } finally {
      this.criandoFinanciamento = false;
    }
  }

  private async _ligarDesligarFinanciamento(o: any, ativo: boolean): Promise<void> {
    const r = await atualizarFundingOperacao(this.estudo.id, o.id, { ativo });
    if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Não foi possível salvar.', 'erro'); return; }
    await this._carregar();
  }

  /**
   * O confirmar da janela: o POST da operação nova (com a `ordem` que a janela
   * recebeu, `_proximaOrdem()`, a última do tipo na senioridade) ou o PATCH só
   * com o que mudou. Recusa do servidor fica DENTRO da janela, que continua
   * aberta com o rascunho; sucesso fecha a janela, recarrega e, na criação,
   * abre a página da operação criada.
   */
  private async _confirmarJanela(c: ConfirmacaoJanela) {
    if (this.janelaGravando || !this.editavel) return;
    this.janelaGravando = true;
    this.criando = c.modo === 'criar';
    this.janelaErro = '';
    try {
      const r = c.modo === 'criar'
        ? await criarFundingOperacao(this.estudo.id, c.corpo)
        : await atualizarFundingOperacao(this.estudo.id, c.id as number, c.patch);
      if (r?.erro) {
        this.janelaErro = r.mensagem || (c.modo === 'criar' ? 'Não foi possível criar a operação.' : 'Não foi possível salvar.');
        return;
      }
      this.janela = null;
      urbiVerso.notificar(c.modo === 'criar' ? 'Operação criada.' : 'Operação salva.', 'sucesso');
      if (c.modo === 'criar') {
        // A operação recém-criada abre na página dela; o foco vai para a página.
        this.focarAlvo = null;
        await this._carregar();
        if (r?.id != null) { this.abaAtiva = 'operacoes'; this.opAbertaId = r.id; }
      } else {
        this.focarAlvo = 'editar';
        await this._carregar();
      }
    } finally {
      this.janelaGravando = false;
      this.criando = false;
    }
  }

  private _abrirJanela(modo: 'criar' | 'editar', gravada?: any) {
    if (!this.editavel) return;
    this.janelaErro = '';
    this.janela = modo === 'editar' ? { modo, gravada } : { modo: 'criar' };
  }

  /** Cancelar não grava nada: fecha e devolve o foco ao botão que abriu. */
  private _fecharJanela() {
    this.focarAlvo = this.janela?.modo === 'editar' ? 'editar' : 'nova';
    this.janela = null;
    this.janelaErro = '';
  }

  /**
   * A simulação da janela: o funding do estudo e a sequência por senioridade
   * sobre as operações dadas (as gravadas com o rascunho no lugar dele). O
   * fluxo-base é refeito com essas operações, como em `_recalcular` com
   * rascunho: senão o horizonte das gravadas truncaria uma operação levada para
   * mais tarde. Arrow function para a janela receber o método sem perder o
   * `this`; quem a chama é a janela, em `willUpdate`.
   */
  private _simularJanela = (ops: OperacaoFunding[]): SimulacaoJanela | null => {
    if (!this.config) return null;
    const calc = calcularFluxo({ ...this.config, operacoesFunding: ops });
    const rl = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, this.custos);
    const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
    const simularFunding = (sub: OperacaoFunding[]) => fundingDoEstudo(
      sub, calc.fluxoMensal, rl, resultadoFinal, mesRepasse(this.crono), this.taxaDescontoAa,
      {
        custosRaw: this.custos, linhasCusto: calc.linhasCusto, cronograma: this.crono,
        recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal,
      },
    );
    return {
      funding: simularFunding(ops),
      sequencia: sequenciaDeEstrutura(ops, (sub) => indicadoresEstrutura(calc, sub.length ? simularFunding(sub) : null)),
      vgvTotal: calc.vgvTotal,
    };
  };

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
    // Remover a operação aberta volta para a lista de cartões, com o foco num
    // alvo estável dela (o primeiro cartão, ou "Nova operação").
    if (String(this.opAbertaId) === String(id)) this.opAbertaId = null;
    this.focarAlvo = 'lista';
    await this._carregar();
  }

  private async _mover(id: any, direcao: 'cima' | 'baixo') {
    if (this.movendoId) return;
    this.movendoId = id;
    try {
      // #586: dentro do TIPO, não na lista global — a `ordem` só decide a
      // posição entre operações do mesmo tipo (a senioridade decide o resto),
      // e trocar com um vizinho de outro tipo não mudaria nada na tela.
      const nova = reordenarDentroDoTipo(this.operacoes, id, direcao);
      const mudaram = camadasComOrdemAlterada(this.operacoes, nova);
      if (mudaram.length === 0) return;
      this.operacoes = nova;
      // A ordem dentro do tipo muda a sequência "antes → depois" dos cartões (e,
      // entre antecipações do mesmo mês, o lastro que sobra): recalcula já, com
      // a ordem nova, em vez de deixar os cartões com os números da antiga.
      this._recalcular();
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

  /** #851 — o que a antecipação rende e custa, lido de `indicadoresAntecipacao`. */
  private _renderIndicadoresAntecipacao(o: any): TemplateResult {
    const serie = this.funding?.operacoes.find((s) => String(s.operacao.id) === String(o.id));
    if (!serie) return html`${nothing}`;
    const ind = indicadoresAntecipacao(serie);
    const card = (rot: string, val: string, classe = '') =>
      html`<div class="ind-card ${classe}"><div class="rot">${rot}</div><div class="val">${val}</div></div>`;
    return html`
      <div class="secao resultado-antecipacao">
        <h4>Resultado da antecipação</h4>
        ${ind.valorFace > 0 ? html`
          <div class="ind">
            ${card('Parcelas cedidas (face)', fmtR$Kpi(ind.valorFace))}
            ${card('Valor presente', fmtR$Kpi(ind.valorPresente), 'pos')}
            ${card('Recebido líquido', fmtR$Kpi(ind.valorLiquido), 'pos')}
            ${card('Deságio', `${fmtR$Kpi(ind.desagio)} (${fmtPct(ind.desagioPct * 100)})`, 'neg')}
            ${card('Tarifas', fmtR$Kpi(ind.tarifas), ind.tarifas > 0 ? 'neg' : '')}
            ${card('Custo efetivo', ind.custoEfetivoAnual === null ? '—' : `${fmtPct(ind.custoEfetivoAnual * 100)} a.a.`)}
          </div>` : html`
          <p class="nota">${AVISO_SEM_LASTRO}</p>`}
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
          ? html`<p class="nota"><urbi-icone class="icone-aviso" classe="fa-solid fa-triangle-exclamation"></urbi-icone>A dívida não zera: no mês da quitação contratual ainda resta
              saldo devedor.</p>`
          : nothing}
      </div>
    `;
  }

  /** Config do fluxo montada em `_carregar`; `_recalcular` (com rascunho) e `_simularJanela` trocam só as operações de funding. */
  private config: FluxoConfig | null = null;

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
          <span><i class="ponto" style="background:var(--cor-texto-sec)"></i>Custo financiável acumulado</span>
          <span><i class="ponto" style="background:var(--cor-sucesso)"></i>Principal liberado acumulado</span>
          <span><i class="ponto" style="background:var(--cor-alerta)"></i>Saldo devedor</span>
          <span><i class="ponto" style="background:var(--cor-erro)"></i>Amortizações</span>
        </div>
      </div>
    `;
  }

  /** #586: as operações de UM tipo, na ordem global — é o que cada aba de tipo
   * mostra, e é a lista contra a qual as setas ↑↓ daquele card se posicionam. */
  private _operacoesDoTipo(tipo: TipoOperacao): any[] {
    return this.operacoes.filter((o) => o.tipo === tipo);
  }

  /**
   * A operação na página, em LEITURA: cabeçalho (nome, tipo, setas de ordem,
   * Editar e Remover para quem edita), os termos por etapa da janela, os
   * indicadores de sempre e o gráfico da operação — o mesmo componente da
   * "Prévia do fluxo" da janela, aqui com a operação gravada. A edição é só
   * pela janela.
   */
  private _renderOperacao(o: any, i: number, irmaos: any[]): TemplateResult {
    const serie = this.funding?.operacoes.find((s) => String(s.operacao.id) === String(o.id)) ?? null;
    const grafico = serieDoGrafico(serie);
    return html`
      <urbi-card>
        <div class="op-cab">
          <urbi-icone classe=${TIPOS.find((t) => t.valor === o.tipo)?.icone ?? 'fa-solid fa-coins'}></urbi-icone>
          <h3 class="op-nome">${o.nome || rotuloTipo(o.tipo)}</h3>
          <urbi-badge>${rotuloTipo(o.tipo)}</urbi-badge>
          <span class="espaco"></span>
          ${this.editavel ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-up" .ariaLabel=${'Mover para cima'}
              ?desabilitado=${i === 0 || !!this.movendoId} @click=${() => this._mover(o.id, 'cima')}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-down" .ariaLabel=${'Mover para baixo'}
              ?desabilitado=${i === irmaos.length - 1 || !!this.movendoId}
              @click=${() => this._mover(o.id, 'baixo')}></urbi-botao>
            <urbi-botao class="editar" variante="secundario" pequeno icone="fa-solid fa-pen"
              @click=${() => this._abrirJanela('editar', o)}>Editar</urbi-botao>
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" .ariaLabel=${'Remover operação'}
              @click=${() => { this.removerId = o.id; }}></urbi-botao>` : nothing}
        </div>

        <div class="termos">
          ${termosDaOperacao(o, this.dataInicio).map((g) => html`
            <div class="secao termos-grupo" data-etapa=${g.etapa}>
              <h4>${g.label}</h4>
              <dl>${g.termos.map((t) => html`<div class="termo"><dt>${t.rotulo}</dt><dd>${t.texto}</dd></div>`)}</dl>
            </div>`)}
        </div>

        ${o.tipo === 'antecipacao_recebiveis' ? this._renderIndicadoresAntecipacao(o) : this._renderIndicadores(o)}
        ${grafico ? html`<div class="secao grafico-operacao">
          <viab-funding-grafico-operacao .serie=${grafico} titulo="Fluxo da operação"></viab-funding-grafico-operacao>
        </div>` : nothing}
      </urbi-card>
    `;
  }

  /** A operação aberta na página, se ainda existir e tiver cartão. Operação que
   * deixou de existir (removida, outra aba, recarga) devolve undefined, e a aba
   * volta para a lista sozinha. */
  private _operacaoAberta(): any | undefined {
    if (this.opAbertaId === null) return undefined;
    return operacoesDeCartao(this.operacoes).find((o) => String(o.id) === String(this.opAbertaId));
  }

  private _abrirOperacao(id: number | string | null) {
    if (id === null || id === undefined) return;
    this.opAbertaId = id;
  }

  private _voltarParaOperacoes() {
    this.focarCartaoId = this.opAbertaId;
    this.opAbertaId = null;
  }

  /** Ao abrir a página, o foco vai para ela (o cartão focado saiu da tela, e
   * sem isto o foco cairia no corpo do documento); ao voltar para a lista, o
   * foco volta ao cartão de origem. */
  protected updated(mudou: Map<string, unknown>) {
    super.updated?.(mudou);
    if (mudou.has('estudo') && this.estudo?.id && !this.carregado) {
      this.carregado = true;
      this._carregar();
    }
    if (mudou.has('opAbertaId') && mudou.get('opAbertaId') == null && this.opAbertaId !== null) {
      (this.shadowRoot?.querySelector('div.pagina-operacao') as HTMLElement | null)?.focus();
    }
    if (this.focarAlvo !== null && !this.carregando && this.janela === null) {
      const alvo = this.focarAlvo;
      const r = this.shadowRoot;
      const el = alvo === 'editar'
        ? r?.querySelector('div.pagina-operacao urbi-botao.editar')
        : alvo === 'nova'
          ? r?.querySelector('urbi-botao.nova-operacao')
          : (r?.querySelector('viab-funding-cartao') ?? r?.querySelector('urbi-botao.nova-operacao'));
      if (el) { this.focarAlvo = null; (el as HTMLElement).focus(); }
    }
    if (this.focarCartaoId !== null && this.opAbertaId === null) {
      const alvo = [...(this.shadowRoot?.querySelectorAll('viab-funding-cartao') ?? [])]
        .find((c) => (c as HTMLElement).dataset.id === String(this.focarCartaoId)) as HTMLElement | undefined;
      this.focarCartaoId = null;
      alvo?.focus();
    }
  }

  /**
   * Aba Operações: um cartão por operação de dívida, equity e antecipação, na
   * ordem de senioridade, e "Nova operação" para quem edita. Clicar num cartão
   * abre a página da operação no lugar da lista.
   *
   * Os termos e KPIs do cartão saem da operação MESCLADA com o rascunho (a
   * mesma de `_recalcular`), para o cartão e a página nunca contarem histórias
   * diferentes.
   */
  private _renderAbaOperacoes(): TemplateResult {
    const aberta = this._operacaoAberta();
    if (aberta) return this._renderPaginaOperacao(aberta);

    const lista = operacoesDeCartao(this.operacoes);
    const fap = this._operacaoFinanciamento();
    const fapLigado = !!fap && fap.ativo !== false;
    const passos = new Map((this.sequencia?.passos ?? []).map((p) => [String(p.operacao.id), p]));
    return html`
      ${this.editavel ? html`
        <div class="acao-aba">
          <urbi-botao class="nova-operacao" variante="primario" pequeno icone="fa-solid fa-plus"
            ?desabilitado=${this.criando}
            @click=${() => this._abrirJanela('criar')}>Nova operação</urbi-botao>
        </div>` : nothing}
      ${lista.length === 0
        ? html`<urbi-estado-vazio icone="fa-solid fa-coins"
            mensagem=${fapLigado
              ? 'Nenhuma operação além do Financiamento à produção, que tem aba própria.'
              : 'Nenhuma operação de funding. O Fluxo de Caixa é igual ao Livre.'}></urbi-estado-vazio>`
        : html`
          <div class="cartoes">
            ${lista.map((o) => {
              const efetiva = operacaoComRascunho(o, this.draft[o.id], this.crono) as OperacaoFunding & { id: number };
              const dados = dadosDoCartao({
                operacao: efetiva,
                serie: this.funding?.operacoes.find((s) => String(s.operacao.id) === String(o.id)) ?? null,
                passo: passos.get(String(o.id)) ?? null,
                vgvTotal: this.calc?.vgvTotal ?? 0,
                dataInicio: this.dataInicio,
                rotuloTipo: rotuloTipo(o.tipo),
              });
              return html`<viab-funding-cartao data-id=${String(o.id)} .dados=${dados}
                @viab:abrir-operacao=${() => this._abrirOperacao(o.id)}></viab-funding-cartao>`;
            })}
          </div>`}
    `;
  }

  /**
   * A página da operação, dentro da aba Operações: o botão de voltar e a
   * operação em leitura (`_renderOperacao`) — termos, indicadores, gráfico,
   * setas de ordem, Editar e Remover.
   *
   * O botão de voltar não leva `href` nem `auto-voltar`: `auto-voltar` chamaria
   * o histórico do navegador e tiraria a pessoa da tela do estudo. A volta é só
   * troca de estado interno.
   */
  private _renderPaginaOperacao(o: any): TemplateResult {
    const irmaos = this._operacoesDoTipo(o.tipo);
    const i = irmaos.findIndex((x) => String(x.id) === String(o.id));
    return html`
      <div class="pagina-operacao" tabindex="-1">
        <div class="voltar">
          <urbi-botao-voltar texto="Operações" @urbi:voltar=${(e: Event) => {
            e.preventDefault();
            this._voltarParaOperacoes();
          }}></urbi-botao-voltar>
        </div>
        ${this._renderOperacao(o, i, irmaos)}
      </div>
    `;
  }

  /**
   * #587 — a aba `Financiamento à produção`: SEMPRE um formulário único,
   * nunca lista, nunca botão "adicionar". O checkbox liga/desliga sem apagar
   * a operação — é o que preserva os parâmetros que o `_remover` genérico
   * jogaria fora — por isso este card não tem o botão de lixeira nem as
   * setas ↑↓ de `_renderOperacao` (não há irmão do mesmo tipo para reordenar
   * contra, e não há como remover: a operação é fixa).
   */
  private _renderAbaFinanciamentoProducao(): TemplateResult {
    const o = this._operacaoFinanciamento();
    const t = TIPOS.find((x) => x.valor === 'financiamento_producao')!;
    if (!o) {
      // Só alcançável em modo leitura (`_garantirFinanciamento` já criou a
      // operação em modo edição, dentro de `_carregar`) — o leitor não pode
      // escrever, então não há o que mostrar além do estado vazio.
      return html`<urbi-estado-vazio icone=${t.icone}
        mensagem="Nenhum Financiamento à produção configurado neste estudo."></urbi-estado-vazio>`;
    }
    const ativo = o.ativo !== false; // undefined = ligado (default do banco, e todo estudo anterior à #587)
    const serie = this.funding?.operacoes.find((s) => String(s.operacao.id) === String(o.id));
    const temDraft = !!this.draft[o.id];
    return html`
      <urbi-card>
        <div class="op-cab">
          <urbi-icone classe=${t.icone}></urbi-icone>
          <urbi-input .valor=${this._valor(o, 'nome') ?? ''} ?desabilitado=${!this.editavel}
            @urbi:input-change=${(e: CustomEvent) => this._set(o, 'nome', e.detail.valor)}
          ></urbi-input>
          <span class="espaco"></span>
          <urbi-checkbox
            label="Ativo"
            ?desabilitado=${!this.editavel || this.criandoFinanciamento}
            ?marcado=${ativo}
            @urbi:checkbox-change=${(e: CustomEvent) => this._ligarDesligarFinanciamento(o, e.detail.marcado)}
          ></urbi-checkbox>
        </div>
        ${ativo ? nothing : html`
          <urbi-banner variante="info">
            Desligado — não entra no Fluxo de Caixa. Os parâmetros abaixo ficam guardados; religue
            para voltar a aplicá-los, sem digitar de novo.
          </urbi-banner>`}

        ${this._renderCamposFinanciamentoProducao(o)}
        ${ativo && serie ? this._renderIndicadoresFinanciamentoProducao(serie) : nothing}

        ${this.editavel ? html`
          <div class="form-acoes">
            <urbi-botao variante="primario" pequeno icone="fa-solid fa-floppy-disk"
              ?desabilitado=${!temDraft || this.salvandoId === o.id}
              @click=${() => this._salvar(o)}>Salvar</urbi-botao>
          </div>` : nothing}
      </urbi-card>
    `;
  }

  /**
   * A aba Estrutura de capital: os quatro totais, a torre por senioridade e a
   * tabela da sequência, mais o texto de apoio. Só leitura — não tem ação de
   * edição, e quem só lê vê a aba inteira.
   *
   * Nada é simulado aqui: a sequência e o funding são os que `_recalcular` já
   * calculou para os cartões da aba Operações, e os textos saem dos mesmos
   * formatadores do cartão (`dadosDaEstrutura`). Com rascunho, a aba reflete o
   * rascunho como o resto da tela.
   */
  private _renderAbaEstrutura(): TemplateResult {
    if (!this.sequencia || !this.calcDaSequencia) {
      return html`<urbi-estado-vazio icone="fa-solid fa-layer-group"
        mensagem="A estrutura de capital aparece quando o Fluxo de Caixa do estudo estiver calculado."></urbi-estado-vazio>`;
    }
    const d = dadosDaEstrutura({
      calc: this.calcDaSequencia,
      funding: this.funding,
      sequencia: this.sequencia,
      operacoes: this.operacoes.map((o) => operacaoComRascunho(o, this.draft[o.id], this.crono)),
      rotuloTipo,
    });
    const celula = (v: ValorCartao) => html`<span title=${v.titulo ?? nothing}>${v.texto}</span>`;
    const colunas = [
      { id: 'passo', label: 'Passo', render: (l: LinhaSequencia) => html`<span>${l.passo}</span>` },
      { id: 'tir', label: 'TIR alavancada', alinhamento: 'direita', render: (l: LinhaSequencia) => celula(l.tir) },
      { id: 'exposicao', label: 'Exposição máxima', alinhamento: 'direita', render: (l: LinhaSequencia) => celula(l.exposicao) },
    ];
    return html`
      <div class="estrutura">
        <div class="totais">
          ${d.totais.map((t) => html`
            <div class="total"><div class="rot">${t.rotulo}</div><div class="val">${celula(t.valor)}</div></div>`)}
        </div>
        <section class="bloco-estrutura">
          <h4>Camadas por senioridade</h4>
          <viab-grafico-stack-capital .camadas=${d.camadas}></viab-grafico-stack-capital>
        </section>
        <section class="bloco-estrutura">
          <h4>Sequência antes → depois</h4>
          <urbi-tabela class="sequencia" .colunas=${colunas} .linhas=${d.linhas}></urbi-tabela>
        </section>
        <ul class="apoio">
          <li>Senioridade aqui é a ordem de pagamento e a ordem de entrada na comparação. O app paga
            todo terceiro pelo contrato, e o incorporador cobre a falta de caixa: nenhuma operação
            recebe menos do que o contrato dela prevê por estar abaixo de outra.</li>
          <li>O restante dos usos é pago pelas vendas ao longo do projeto.</li>
          <li>As camadas não acontecem no mesmo mês, então a soma delas não é um saldo numa data.</li>
          <li>O tamanho de cada camada é o maior valor que aquela parte teve dentro do projeto. O
            Financiamento à produção amortiza e libera de novo, por isso a camada dele não é o total
            liberado.</li>
          <li>A camada do Financiamento à produção é medida na estrutura completa, e o "depois" dele na
            tabela é medido sozinho: os dois não se comparam, porque ele lê o caixa depois das outras
            operações.</li>
        </ul>
      </div>
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
          Há tarifa configurada numa operação de <strong>Dívida</strong> ou de
          <strong>Antecipação de recebíveis</strong> e, ao mesmo tempo, uma
          linha de custo em "Taxas bancárias" ou "Estruturação de dívida" no grupo Financeiro.
          Confira se não é a <strong>mesma</strong> tarifa lançada duas vezes — uma vez como custo
          do projeto, outra como encargo da operação.
        </urbi-banner>
      ` : nothing}

      <!-- #586: a barra de 3 urbi-botao que ficava aqui SAIU. Cada tipo passou a
           ter o seu botão de criar dentro da própria aba, e a navegação virou
           urbi-abas. Os dois avisos acima ficam FORA das abas de propósito: o
           regulatório é sobre a ferramenta, não sobre o dado, e o de tarifa
           duplicada cruza Dívida com linhas de custo — não pertence a uma aba
           isolada. (Sem crase: comentário dentro de template literal.) -->
      <urbi-abas
        .abas=${ABAS.map((a) => ({ id: a.id, label: a.label, icone: a.icone }))}
        .ativa=${this.abaAtiva}
        @urbi:aba-selecionar=${(e: CustomEvent) => { this.abaAtiva = e.detail?.id || 'operacoes'; }}
      >
        ${ABAS.map((a) => html`
          <urbi-hospedeiro slot=${a.id}>
            ${a.id === 'financiamento_producao' ? this._renderAbaFinanciamentoProducao()
              : a.id === 'estrutura' ? (this.abaAtiva !== 'estrutura' ? nothing : this._renderAbaEstrutura())
              : this._renderAbaOperacoes()}
          </urbi-hospedeiro>`)}
      </urbi-abas>

      ${this.janela && this.editavel ? html`<viab-funding-janela
        .modo=${this.janela.modo}
        .gravada=${this.janela.modo === 'editar' ? this.janela.gravada : null}
        .salvas=${this.operacoes} .ordemNova=${this._proximaOrdem()}
        .crono=${this.crono} .dataInicio=${this.dataInicio}
        .tipos=${TIPOS_DE_CARTAO.map((t) => ({ valor: t as TipoDaJanela, rotulo: rotuloTipo(t) }))}
        .simular=${this._simularJanela}
        .gravando=${this.janelaGravando} .erroServidor=${this.janelaErro}
        @viab:janela-confirmar=${(e: CustomEvent) => this._confirmarJanela(e.detail)}
        @viab:janela-cancelar=${() => this._fecharJanela()}
      ></viab-funding-janela>` : nothing}

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

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { CASAS_DECIMAIS_MONETARIAS, fmtR$ } from './viab-format.js';
import {
  rotuloMesRelativo, EVENTO_LABEL, CATEGORIA_CORRETAGEM, eCorretagem, ePrecoTerreno, ePermutaFisica, ePermutaFinanceira,
  CATEGORIA_CONSTRUCAO, eConstrucao, regimeCronogramaLinha,
  vgvLinha, receitaLiquidaLinha, areaPrivativaTotalLinhas, resolverCustoTotal, type EventoCrono, type ContextoCusto,
} from './fluxo-shared.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado, listarReceitasAvancado,
  listarCurvas, listarCustosAvancado, criarCustoAvancado, atualizarCustoAvancado, removerCustoAvancado,
  listarFasesAvancado, listarTipologiasCatalogo,
} from './viabilidade-api.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { converterUnidade, type ConvUnidade, type CtxConversao } from './premissas-conversao.js';
import './viab-num.js';

// Sub-tela "Custos" do nível Avançado (Viabilidade › Custos): cinco seções
// fixas (Terreno / Obra / Diretos / Indiretos / Financeiro) com linhas de custo
// editáveis inline — categoria/subcategoria, orçamento (unidade por badge +
// valor, com conversão automática igual ao Preliminar), curva de distribuição e
// ancoragem no cronograma. Nada aqui toca o estudo Preliminar.

type GrupoId = 'terreno' | 'obra' | 'diretos' | 'indireto' | 'financeiro';

interface Grupo {
  id: GrupoId;
  titulo: string;
  subtitulo: string;
  eventoPadrao: string;
}

const GRUPOS: Grupo[] = [
  { id: 'terreno', titulo: 'Custos do Terreno', subtitulo: 'Aquisição do terreno, permutas e estruturas de pagamento', eventoPadrao: 'planejamento' },
  { id: 'obra', titulo: 'Custos de Obra', subtitulo: 'Custos de construção e desenvolvimento físico', eventoPadrao: 'obra' },
  { id: 'diretos', titulo: 'Custos Diretos', subtitulo: 'Custos diretamente ligados à entrega do produto', eventoPadrao: 'obra' },
  { id: 'indireto', titulo: 'Custos Indiretos', subtitulo: 'Custos pré-desenvolvimento e administrativos do projeto', eventoPadrao: 'planejamento' },
  { id: 'financeiro', titulo: 'Financeiro', subtitulo: 'Juros, taxas, estruturação de dívida e investidores', eventoPadrao: 'obra' },
];

// Categorias e subcategorias por grupo. Categoria "Outro" libera texto livre na
// subcategoria. Divisão em 5 abas (Lote 5, #17): "Obra" concentra a obra física
// (opção do autor "Obra = tudo de construção"); "Diretos" recebe os custos de
// entrega do produto — inclui Decoração/Gestão da obra para as linhas migradas
// da migração 002. "Financeiro" nasce sem dados legados.
const CATEGORIAS: Record<GrupoId, { nome: string; subs: string[] }[]> = {
  terreno: [
    // "Compra" → "Preço" (#193): nome alinhado à referência visual da planilha
    // de bugs ("View Custos Terreno") — mesma linha obrigatória, mesmas
    // subcategorias.
    // #257: quatro subcategorias canônicas — "Permuta" genérica saiu (o motor
    // sempre tratava como financeira; a legada foi migrada para o rótulo
    // correto) e "Permuta física" entrou como preparação da fonte nova de
    // permuta física por tipologia (#258, ainda não implementada — a UI
    // oferece a opção, mas o motor não a trata de forma diferente da
    // financeira até o #268 existir).
    { nome: 'Preço', subs: ['Valor à vista', 'Parcelado', 'Permuta física', 'Permuta financeira'] },
    { nome: 'Registro', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
  obra: [
    { nome: 'Construção', subs: [] },
    // Outorga onerosa é contrapartida do potencial construtivo — custo de
    // desenvolvimento da obra, não de aquisição do terreno (#180).
    { nome: 'Outorga', subs: [] },
    { nome: 'Decoração', subs: [] },
    { nome: 'Gestão da obra', subs: [] },
    { nome: 'Contingência', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
  diretos: [
    { nome: 'Marketing & Publicidade', subs: [] },
    { nome: 'Corretagem de vendas', subs: [] },
    { nome: 'Projetos', subs: [] },
    { nome: 'Licenças e Aprovações', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
  indireto: [
    { nome: 'Marketing global', subs: [] },
    { nome: 'Stand de vendas', subs: [] },
    { nome: 'Gestão', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
  financeiro: [
    { nome: 'Juros de financiamento', subs: [] },
    { nome: 'Taxas bancárias', subs: [] },
    { nome: 'Estruturação de dívida', subs: [] },
    { nome: 'Investidores', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
};

// Descritor de conversão por unidade de orçamento (mesma base do motor em
// `resolverCustoTotal`): R$ absoluto, R$/m² × área privativa, R$/m² × terreno,
// % do VGV, % da receita (VGL — receita líquida, mesma base do motor; cai no VGV
// só quando não há receita definida). Alimenta a troca de unidade por badge.
const CONV_UNIDADE: Record<string, ConvUnidade> = {
  rs: { tipo: 'identidade' },
  rs_m2_priv: { tipo: 'por_area', link: 'areaPrivativa' },
  rs_m2_terreno: { tipo: 'por_area', link: 'areaTerreno' },
  pct_vgv: { tipo: 'pct', link: 'vgv' },
  pct_receita: { tipo: 'pct', link: 'receita' },
  pct_obra: { tipo: 'pct', link: 'vgv' }, // link=vgv usado só na conversão de display; motor usa totalObra
};

const UNIDADES = [
  { valor: 'rs', rotulo: 'R$' },
  { valor: 'rs_m2_priv', rotulo: 'R$/m² priv' },
  { valor: 'rs_m2_terreno', rotulo: 'R$/m² terreno' },
  { valor: 'pct_vgv', rotulo: '% VGV' },
  { valor: 'pct_receita', rotulo: '% Receita' },
  { valor: 'pct_obra', rotulo: '% Obra' },
];

// Unidades permitidas por grupo+categoria. Ausência = todas as unidades.
// Garante coerência entre a opção visível e o que o motor calcula.
const UNIDADES_CAT: Partial<Record<GrupoId, Record<string, string[]>>> = {
  terreno: {
    'Preço':   ['rs', 'rs_m2_terreno'],
    'Registro':['rs', 'rs_m2_priv'],
    'Outro':   ['rs', 'pct_vgv'],
  },
  obra: {
    'Construção':    ['rs', 'rs_m2_priv'],
    'Outorga':       ['rs', 'pct_vgv'],
    'Decoração':     ['rs', 'rs_m2_priv'],
    'Gestão da obra':['rs', 'pct_obra'],
    'Contingência':  ['rs', 'pct_vgv'],
    'Outro':         ['rs', 'pct_vgv'],
  },
  diretos: {
    'Marketing & Publicidade': ['rs', 'pct_vgv'],
    'Corretagem de vendas':    ['pct_vgv'],
    'Projetos':                ['rs', 'rs_m2_priv'],
    'Licenças e Aprovações':   ['rs', 'rs_m2_priv'],
    'Outro':                   ['rs', 'pct_vgv'],
  },
  indireto: {
    'Marketing global': ['rs', 'pct_vgv'],
    'Stand de vendas':  ['rs', 'pct_vgv'],
    'Gestão':           ['rs', 'pct_vgv'],
    'Outro':            ['rs', 'pct_vgv'],
  },
  // #181: Financeiro não tinha entrada aqui — sem restrição, `_unidsPerm` caía
  // no fallback "todas as unidades" e oferecia badges sem sentido para custo
  // financeiro (R$/m² terreno, % Obra). Mesmo padrão de Indiretos: R$ ou % VGV.
  financeiro: {
    'Juros de financiamento':  ['rs', 'pct_vgv'],
    'Taxas bancárias':         ['rs', 'pct_vgv'],
    'Estruturação de dívida':  ['rs', 'pct_vgv'],
    'Investidores':            ['rs', 'pct_vgv'],
    'Outro':                   ['rs', 'pct_vgv'],
  },
};

const EVENTOS_ANCORA = [
  { valor: 'planejamento', rotulo: 'Planejamento' },
  { valor: 'pre_lancamento', rotulo: 'Pré-lançamento' },
  { valor: 'obra', rotulo: 'Obra' },
  { valor: 'pos_obra', rotulo: 'Pós-obras' }, // BUG7-20
  { valor: 'customizado', rotulo: 'Customizado' },
];

// Modos de distribuição do Preço do Terreno (#194): "Fixo" segue o cronograma
// normal (evento + curva, igual às demais linhas); "Unit Delivery" e "Sales
// Revenue" não têm cronograma próprio — o motor rateia proporcionalmente à
// receita em caixa (entrada+parcelas+repasse) ou ao VGV vendido, respectivamente.
// #238: base econômica da permuta financeira. `bruta` é o default e preserva o
// resultado de todo estudo existente — a base líquida deduz imposto e
// corretagem da receita antes de aplicar o percentual, e só passa a valer se o
// usuário escolher explicitamente.
const BASES_PERMUTA_FINANCEIRA = [
  { valor: 'bruta', rotulo: 'Receita bruta' },
  { valor: 'liquida', rotulo: 'Receita líquida (− imposto e corretagem)' },
];

const MODOS_DISTRIBUICAO_PRECO = [
  { valor: 'fixo', rotulo: 'Fixo (cronograma)' },
  { valor: 'unit_delivery', rotulo: 'Unit Delivery' },
  { valor: 'sales_revenue', rotulo: 'Sales Revenue' },
];

// Linhas obrigatórias por grupo (na ordem declarada): sempre nas primeiras
// posições, categoria travada e não removíveis. A linha inexistente é criada ao
// abrir a tela. `unidade` fixa a unidade de orçamento na criação.
//
// A migração 002 moveu "Gestão da obra" de `obra` para `diretos` — este mapa
// só declara o que hoje é exigido em cada grupo. Não redeclarar "Gestão da
// obra" aqui: fazia `_garantirLinhasObrigatorias` recriar, em `obra`, uma
// linha que a migração já tinha movido para `diretos` — a origem da
// duplicação indeletável do #178 (a categoria existia, só que no grupo
// errado, então a checagem de existência falhava sempre).
// Categorias do grupo Obra referenciadas por nome no código (#192): a
// Construção é a linha obrigatória/ancorada e a Gestão da obra é a série
// opcional empilhada nos gráficos de avanço. Declaradas ANTES de
// `LINHAS_OBRIGATORIAS`, que as consome na inicialização do módulo.
const CATEGORIA_GESTAO_OBRA = 'Gestão da obra';

interface LinhaObrigatoria { categoria: string; posicao: number; unidade?: string }

const LINHAS_OBRIGATORIAS: Partial<Record<GrupoId, LinhaObrigatoria[]>> = {
  // Preço: 1ª linha de Custos do Terreno — todo estudo tem aquisição do
  // terreno (#180; renomeada de "Compra" no #193).
  terreno: [
    { categoria: 'Preço', posicao: 0 },
  ],
  obra: [
    { categoria: CATEGORIA_CONSTRUCAO, posicao: 0 },
  ],
  // Corretagem de vendas: 1ª linha de Custos Diretos, sempre em % VGV (#121).
  diretos: [
    { categoria: CATEGORIA_CORRETAGEM, posicao: 0, unidade: 'pct_vgv' },
  ],
};

function obrigatoriasDoGrupo(grupo: string | null | undefined): LinhaObrigatoria[] {
  return LINHAS_OBRIGATORIAS[grupo as GrupoId] ?? [];
}

// Identidade, não categoria (#178): `obrigatoria` é decidida pelo servidor na
// criação e marca só a linha oficial. Uma 2ª linha com a mesma categoria (dado
// legado, ou reclassificação futura de grupo) fica com `obrigatoria=false` e
// portanto editável/removível — nunca mais trava por coincidência de nome.
function eObrigatoria(c: any): boolean {
  return c.obrigatoria === true;
}

// Ordena as linhas de um grupo: obrigatórias primeiro (na ordem declarada),
// seguidas pelas demais na ordem original.
function ordenarLinhas(grupo: GrupoId, linhas: any[]): any[] {
  const obrigatorias = obrigatoriasDoGrupo(grupo);
  if (obrigatorias.length === 0) return linhas;
  const obrig: any[] = [];
  for (const cat of obrigatorias) {
    // Prioriza a linha marcada pelo servidor; cai para categoria só em dado
    // legado ainda não migrado (backfill roda na 006_linhas_custo_obrigatoria).
    const linha = linhas.find((c) => c.obrigatoria === true && c.categoria === cat.categoria)
      ?? linhas.find((c) => c.categoria === cat.categoria);
    if (linha) obrig.push(linha);
  }
  // Comparação por identidade: uma 2ª linha com a mesma categoria (dado legado)
  // continua listada, logo após a obrigatória, em vez de sumir da tabela.
  const resto = linhas.filter((c) => !obrig.includes(c));
  return [...obrig, ...resto];
}

@customElement('viab-fluxo-custos')
export class ViabFluxoCustos extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;
  // Grupo único a exibir (uma das 5 sub-abas de Custos). Vazio/ausente → todos
  // os grupos empilhados (fallback, ex.: uso fora da sub-navegação).
  @property({ type: String }) grupo: GrupoId | '' = '';

  @state() private custos: any[] = [];
  @state() private curvas: any[] = [];
  @state() private tipologiasCatalogo: any[] = []; // #266: opções do single-select de permuta física
  // Fases do Cronograma (tipo='cronograma', #168) — âncora alternativa aos 5
  // eventos fixos para a coluna Distribuição (#167).
  @state() private fasesCronograma: any[] = [];
  @state() private crono: EventoCrono[] = [];
  @state() private dataInicio: string | null = null;
  @state() private carregando = true;
  @state() private removerAlvo: any = null;
  // #192: empilha "Gestão da obra" junto da Construção nos gráficos de avanço.
  @state() private incluirGestaoObra = false;
  private ctxCusto: ContextoCusto = { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 0 };
  // #192: insumos do motor guardados para os gráficos de avanço da obra —
  // rodar `calcularFluxo` aqui é o que garante que os valores batam com a
  // linha Construção do Fluxo de Caixa, em vez de redistribuir por conta.
  private linhasReceita: any[] = [];
  private taxaDesconto = 12;
  private carregado = false;

  // Evento "Obra" do cronograma do empreendimento (fonte do Início/Duração
  // derivados da linha Construção — #120).
  private get _eventoObra(): EventoCrono | undefined {
    return this.crono.find((e) => e.evento === 'obra');
  }

  // Total do grupo Obra excluindo linhas com pct_obra (base para % Obra).
  private get _totalObra(): number {
    return this.custos
      .filter((c) => c.grupo === 'obra' && (c.orcamento_unidade || 'rs') !== 'pct_obra')
      .reduce((s, c) => s + resolverCustoTotal(c, this.ctxCusto), 0);
  }

  // Contexto completo incluindo totalObra (usado no render/cálculos).
  private _ctx(): ContextoCusto {
    return { ...this.ctxCusto, totalObra: this._totalObra };
  }

  // Unidades permitidas para o combo grupo+categoria. Sem categoria → todas.
  private _unidsPerm(grupo: GrupoId, categoria: string | null | undefined): string[] {
    if (!categoria) return UNIDADES.map((u) => u.valor);
    return UNIDADES_CAT[grupo]?.[categoria] ?? UNIDADES.map((u) => u.valor);
  }

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .secoes { display: flex; flex-direction: column; gap: 16px; }
    .card-cab { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .card-cab .titulos { flex: 1; }
    .card-cab h3 { margin: 0; }
    .card-cab p { margin: 2px 0 0; }
    /* #198: a linha de totais ficava só com um margin-top, sem separação visual
       da tabela acima — border + fundo destacam que ali fecha a soma do grupo,
       igual ao tratamento que fluxo-tabela.ts/tela-proforma.ts já dão às linhas
       de resultado/total (border-top 2px + leve destaque de fundo). */
    .rodape-custo {
      display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
      margin-top: 10px; padding: 10px 12px 4px;
      border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.2));
      background: var(--cor-superficie-hover, rgba(255,255,255,0.04));
      border-radius: 0 0 8px 8px;
    }
    .rodape-custo .espaco { flex: 1; }
    .total-rotulo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem); margin-right: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .total-valor { font-weight: 700; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
    .orc { display: inline-flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .orc-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .orc-badges urbi-badge { cursor: pointer; }
    .orc-badges .cu-badge-dis { cursor: default; opacity: 0.6; }
    .orc viab-num { width: 110px; }
    .res-calc { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: 0.85rem; }
    .mes-calc { white-space: nowrap; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    /* #261: só nas colunas Início/Duração, mesma largura reservada de
       .campo-mes — sem isso, a coluna "pulava" de largura entre linhas
       travadas (.mes-calc, sem largura própria) e editáveis (.campo-mes,
       140px), quebrando o alinhamento vertical quando linhas ancoradas e
       customizadas aparecem juntas no mesmo grupo. Escopado com uma classe
       própria (em vez de alargar .mes-calc genérico) porque a mesma classe
       também é reusada na coluna Distribuição, onde 140px cortaria o texto. */
    .mes-calc.mes-crono { display: inline-flex; align-items: center; gap: 4px; width: 140px; }
    /* #174: 80px cortava o número + sufixo ("º mês"/"meses") do viab-num, que
       fica DENTRO do span junto com o emoji — duas regras conflitantes
       existiam para .campo-mes (80px nas duas), unificadas aqui. */
    .campo-mes { display: inline-flex; align-items: center; gap: 4px; width: 140px; }
    .campo-mes viab-num { width: 100%; }
    /* #194: modo de distribuição do Preço do Terreno + curva (só em "Fixo"), empilhados. */
    .dist-preco { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    /* #192: gráficos de avanço da obra (barras mensais + área acumulada) + tabela mensal. */
    .avanco-ctrl { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .graf-bloco { margin-top: 12px; }
    .graf-bloco h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo, 0.75rem); font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .avanco-tabela-wrap { overflow-x: auto; margin-top: 16px; }
    .avanco-tabela { border-collapse: collapse; font-variant-numeric: tabular-nums; width: max-content; min-width: 100%; }
    .avanco-tabela th, .avanco-tabela td {
      padding: 5px 8px; font-size: 0.75rem; white-space: nowrap; text-align: right;
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
    }
    .avanco-tabela th {
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600;
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    .avanco-tabela th:first-child, .avanco-tabela td:first-child { text-align: left; font-weight: 600; }
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
      const [custos, curvas, fases, crono, params, receitas, tipologiasCatalogo] = await Promise.all([
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        listarFasesAvancado(this.estudo.id, 'cronograma'),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarReceitasAvancado(this.estudo.id),
        listarTipologiasCatalogo(this.estudo.id),
      ]);
      if (!custos?.erro) {
        this.custos = custos.dados || [];
        // Garante que as linhas obrigatórias existam no servidor.
        if (this.editavel) await this._garantirLinhasObrigatorias();
      }
      if (!curvas?.erro) this.curvas = curvas.dados || [];
      if (!fases?.erro) this.fasesCronograma = fases.dados || [];
      if (!tipologiasCatalogo?.erro) this.tipologiasCatalogo = tipologiasCatalogo.dados || [];
      if (!crono?.erro) this.crono = crono.dados || [];
      if (!params?.erro) {
        this.dataInicio = params.data_inicio_projeto ?? null;
        this.taxaDesconto = Number(params.taxa_desconto_aa ?? 12);
      }
      const linhas = receitas?.erro ? [] : (receitas.dados || []);
      this.linhasReceita = linhas;
      // Contexto de resolução idêntico ao do motor (fluxo-caixa-motor.ts): além de
      // área/VGV, calcula a RECEITA total (líquida do único imposto oficial do
      // Avançado — RET por Grupo, #228) para que a coluna Resultado de linhas em
      // `% Receita` bata exatamente com o que o motor computa (antes, sem
      // `receitaTotal`, o cálculo caía no fallback VGV e divergia do fluxo de
      // caixa — issue #118).
      this.ctxCusto = {
        areaPrivativaTotal: areaPrivativaTotalLinhas(linhas),
        areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
        vgvTotal: linhas.reduce((s: number, l: any) => s + vgvLinha(l.tipologias), 0),
        receitaTotal: linhas.reduce(
          (s: number, l: any) => s + receitaLiquidaLinha(vgvLinha(l.tipologias), l.fluxo_pagamento), 0),
      };
      // Alinha a linha Construção ao cronograma (evento Obra) — depende de crono +
      // custos já carregados. Editável apenas (#120).
      if (this.editavel) await this._sincronizarConstrucao();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar custos', 'erro');
    }
    this.carregando = false;
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando custos..."></urbi-loading>`;
    const grupos = this.grupo ? GRUPOS.filter((g) => g.id === this.grupo) : GRUPOS;
    return html`
      <div class="secoes">
        ${grupos.map((g) => this._renderGrupo(g))}
      </div>
      ${this.removerAlvo ? this._renderConfirmRemover() : nothing}
    `;
  }

  private _renderGrupo(g: Grupo): TemplateResult {
    const linhas = ordenarLinhas(g.id, this.custos.filter((c) => c.grupo === g.id));
    const ctx = this._ctx();
    const total = linhas.reduce((s, c) => s + resolverCustoTotal(c, ctx), 0);
    return html`
      <urbi-card>
        <div class="card-cab">
          <div class="titulos">
            <h3>${g.titulo}</h3>
            <p class="sec">${g.subtitulo}</p>
          </div>
          <urbi-botao variante="secundario" pequeno desabilitado icone="fa-solid fa-upload"
            title="Em breve">Importar Planilha</urbi-botao>
        </div>

        <urbi-tabela
          expandir
          .colunas=${this._colunas(g)}
          .linhas=${linhas}
          mensagem-vazio="Nenhum custo nesta seção."
        ></urbi-tabela>

        <div class="rodape-custo">
          ${this.editavel ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
              @click=${() => this._adicionar(g)}>Adicionar Custo</urbi-botao>` : nothing}
          <span class="espaco"></span>
          <span><span class="total-rotulo">Total ${g.titulo}</span><span class="total-valor">${fmtR$(total)}</span></span>
        </div>
      </urbi-card>
      ${g.id === 'obra' ? this._renderAvancoObra() : nothing}
    `;
  }

  // ── #192: gráficos de avanço da obra (só a linha Projetado) ──────────────
  //
  // Escopo decidido pelo autor (2026-07-27): a referência visual da planilha
  // traz Projetado/Realizado/Desvio/Forecast, mas "Realizado" não existe em
  // schema, backend nem motor — só o Projetado entra, sem migração.
  //
  // Requisito duro da issue: os valores têm de bater EXATAMENTE com a linha
  // Construção do Fluxo de Caixa. Por isso não há distribuição própria aqui —
  // roda-se o MESMO motor (`calcularFluxo`) com os mesmos insumos já
  // carregados por `_carregar`, e lê-se `c.linhasCusto`. Qualquer regra de
  // distribuição (curva, âncora de cronograma, unidade de orçamento) sai de
  // graça e não pode divergir por construção.
  // #238: total da linha na base econômica NÃO escolhida, para auditoria.
  // Vem do MESMO `calcularFluxo` que produz o número do fluxo (`_calcObra`),
  // então não há risco de a tela mostrar uma conta paralela que diverge do
  // motor. `null` quando a linha não é permuta em % VGV, ou quando ainda não
  // há insumo suficiente para rodar o fluxo.
  private _permutaAlternativa(c: any): number | null {
    if (!ePermutaFinanceira(c) || (c.orcamento_unidade || 'rs') !== 'pct_vgv') return null;
    const calc = this._calcObra();
    if (!calc) return null;
    // A permuta financeira é DEDUÇÃO DE RECEITA no motor, não linha de custo:
    // `calcDeducoesReceita` entra em `linhasReceita` (motor:1431).
    const linha: any = calc.linhasReceita?.find((l: any) => l.id === c.id);
    const alt = linha?.permutaAlternativa;
    return alt ? alt.total : null;
  }

  private _calcObra(): FluxoCalc | null {
    if (this.crono.length === 0 && this.custos.length === 0) return null;
    const config: FluxoConfig = {
      dataInicio: this.dataInicio,
      taxaDescontoAa: this.taxaDesconto,
      cronograma: this.crono,
      linhasReceita: this.linhasReceita,
      linhasCusto: this.custos,
      curvas: this.curvas,
      areaTerreno: this.ctxCusto.areaTerreno,
    };
    return calcularFluxo(config);
  }

  private _renderAvancoObra(): TemplateResult {
    const c = this._calcObra();
    // `linhasCusto` do motor carrega o nome de exibição já montado
    // (`nomeLinhaCusto`), que para o grupo `obra` é a própria categoria.
    const doGrupo = (cat: string) => (c?.linhasCusto ?? []).filter(
      (l) => l.grupo === 'obra' && l.nome === cat);
    const somar = (linhas: { mensal: number[] }[], prazo: number) => {
      const out = new Array<number>(prazo).fill(0);
      for (const l of linhas) for (let i = 0; i < prazo; i++) out[i] += l.mensal[i] ?? 0;
      return out;
    };
    const construcao = doGrupo(CATEGORIA_CONSTRUCAO);
    if (!c || construcao.length === 0 || this.crono.length === 0) {
      return html`
        <urbi-card titulo="Avanço da obra">
          <urbi-estado-vazio icone="fa-solid fa-chart-column"
            mensagem="Defina o Cronograma e a linha de custo Construção para ver o avanço da obra."></urbi-estado-vazio>
        </urbi-card>`;
    }
    const gestao = doGrupo(CATEGORIA_GESTAO_OBRA);
    const temGestao = gestao.length > 0;
    const incluirGestao = this.incluirGestaoObra && temGestao;

    const mensalConstrucao = somar(construcao, c.prazo);
    const mensalGestao = incluirGestao ? somar(gestao, c.prazo) : null;
    // Acumulado do que está no gráfico de barras — soma as séries exibidas.
    const acumulado: number[] = [];
    let corrente = 0;
    for (let i = 0; i < c.prazo; i++) {
      corrente += mensalConstrucao[i] + (mensalGestao?.[i] ?? 0);
      acumulado.push(corrente);
    }

    const series = [
      { rotulo: CATEGORIA_CONSTRUCAO, valores: mensalConstrucao, cor: 'var(--cor-primaria-solida, #2AA9E0)' },
      ...(mensalGestao ? [{ rotulo: CATEGORIA_GESTAO_OBRA, valores: mensalGestao, cor: 'var(--cor-alerta, #e0a82a)' }] : []),
    ];
    const totalExibido = acumulado[acumulado.length - 1] ?? 0;

    return html`
      <urbi-card titulo="Avanço da obra">
        <div class="avanco-ctrl">
          <urbi-checkbox
            label="Incluir Gestão da obra"
            ?marcado=${incluirGestao}
            ?desabilitado=${!temGestao}
            @urbi:checkbox-change=${(e: CustomEvent) => { this.incluirGestaoObra = e.detail.marcado; }}
          ></urbi-checkbox>
          ${!temGestao ? html`
            <span class="sec">Sem linha "Gestão da obra" neste estudo.</span>` : nothing}
        </div>

        <div class="graf-bloco">
          <h4>Custo mensal da obra</h4>
          <urbi-grafico-colunas
            ?empilhado=${incluirGestao}
            legenda="sempre"
            formato="moeda"
            .categorias=${c.meses}
            .series=${series}
          ></urbi-grafico-colunas>
        </div>

        <div class="graf-bloco">
          <h4>Desembolso acumulado</h4>
          <urbi-grafico-area
            formato="moeda"
            legenda="sempre"
            .categorias=${c.meses}
            .series=${[{ rotulo: 'Acumulado', valores: acumulado, cor: 'var(--cor-primaria-solida, #2AA9E0)' }]}
          ></urbi-grafico-area>
        </div>

        <div class="avanco-tabela-wrap">
          <table class="avanco-tabela">
            <thead>
              <tr>
                <th>Linha</th>
                <th>Total</th>
                ${c.meses.map((m) => html`<th>${m}</th>`)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Projetado</td>
                <td class="num">${fmtR$(totalExibido)}</td>
                ${mensalConstrucao.map((v, i) => html`
                  <td class="num">${fmtR$(v + (mensalGestao?.[i] ?? 0))}</td>`)}
              </tr>
              <tr>
                <td>Projetado acumulado</td>
                <td class="num">${fmtR$(totalExibido)}</td>
                ${acumulado.map((v) => html`<td class="num">${fmtR$(v)}</td>`)}
              </tr>
            </tbody>
          </table>
        </div>
      </urbi-card>
    `;
  }

  private _colunas(g: Grupo) {
    const dis = !this.editavel;
    const cats = CATEGORIAS[g.id];
    const colunas: any[] = [
      {
        id: 'categoria', label: 'Categoria',
        render: (c: any) => {
          if (eObrigatoria(c)) {
            // Linha obrigatória: categoria travada (texto, não seletor).
            return html`<strong>${c.categoria}</strong>`;
          }
          // #179: categorias obrigatórias (Preço/Construção/Corretagem de
          // vendas) já têm sua linha oficial garantida por
          // `_garantirLinhasObrigatorias` — oferecê-las aqui também deixava o
          // usuário criar uma 2ª linha com a mesma categoria, que o motor soma
          // independentemente (custo duplicado). Escondidas do seletor de
          // QUALQUER OUTRA linha; a própria categoria da linha continua
          // selecionável (evita sumir do combo se o dado já estiver assim).
          const obrigDoGrupo = obrigatoriasDoGrupo(g.id).map((o) => o.categoria);
          const opcoes = cats.filter((x) => !obrigDoGrupo.includes(x.nome) || x.nome === c.categoria);
          return html`
            <urbi-select placeholder="Selecione…"
              .valor=${c.categoria || ''}
              .opcoes=${opcoes.map((x) => ({ valor: x.nome, rotulo: x.nome }))}
              @urbi:select-change=${(e: CustomEvent) => this._salvarCategoria(c, g.id, e.detail.valor)}
            ></urbi-select>`;
        },
      },
      {
        id: 'subcategoria', label: 'Subcategoria',
        render: (c: any) => {
          const cat = cats.find((x) => x.nome === c.categoria);
          if (c.categoria === 'Outro') {
            return html`
              <urbi-input placeholder="Descreva…" ?desabilitado=${dis} .valor=${c.subcategoria || ''}
                @urbi:input-change=${(e: CustomEvent) => this._salvar(c, { subcategoria: e.detail.valor })}
              ></urbi-input>`;
          }
          if (!cat || cat.subs.length === 0) return html`<span class="sec">—</span>`;
          return html`
            <urbi-select placeholder="Selecione…"
              .valor=${c.subcategoria || ''}
              .opcoes=${cat.subs.map((s) => ({ valor: s, rotulo: s }))}
              @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { subcategoria: e.detail.valor })}
            ></urbi-select>`;
        },
      },
      {
        id: 'orcamento', label: 'Orçamento',
        render: (c: any) => {
          const modo = c.orcamento_unidade || 'rs';
          // #238: Permuta financeira aceita % VGV OU R$ — não R$/m² terreno
          // (as demais subcategorias de Preço), porque o valor é uma DEDUÇÃO
          // proporcional à receita, não um preço de aquisição por área.
          const perm = ePermutaFinanceira(c) ? ['rs', 'pct_vgv'] : this._unidsPerm(g.id, c.categoria);
          const unidsFilt = UNIDADES.filter((u) => perm.includes(u.valor));
          return html`
            <span class="orc">
              ${ePermutaFisica(c) ? html`
                <span class="orc-permuta-fisica">
                  <urbi-select placeholder="Tipologia…"
                    .valor=${c.permuta_tipologia_id ? String(c.permuta_tipologia_id) : ''}
                    .opcoes=${this.tipologiasCatalogo.map((t) => ({ valor: String(t.id), rotulo: t.nome || `Tipologia ${t.id}` }))}
                    @urbi:select-change=${(e: CustomEvent) =>
                      this._salvar(c, { permuta_tipologia_id: e.detail.valor ? Number(e.detail.valor) : null })}
                  ></urbi-select>
                  <viab-num ?desabilitado=${dis} casas-decimais="0" sufixo="un."
                    .valor=${c.permuta_quantidade !== null && c.permuta_quantidade !== undefined ? Number(c.permuta_quantidade) : null}
                    @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(c, { permuta_quantidade: e.detail.valor })}
                  ></viab-num>
                </span>
              ` : html`
                ${c.categoria ? html`
                  <span class="orc-badges" role="group" aria-label="Unidade do orçamento">
                    ${unidsFilt.map((u) => html`
                      <urbi-badge cor="info" interativo ?ativo=${u.valor === modo}
                        class=${dis ? 'cu-badge-dis' : ''}
                        @click=${() => { if (!dis) this._trocarUnidade(c, u.valor); }}
                      >${u.rotulo}</urbi-badge>`)}
                  </span>
                ` : nothing}
                <viab-num ?desabilitado=${dis}
                  casas-decimais=${String(CASAS_DECIMAIS_MONETARIAS)}
                  casas-minimas=${String(CASAS_DECIMAIS_MONETARIAS)}
                  .valor=${this._valorExibido(c)}
                  @urbi:input-numero-change=${(e: CustomEvent) => this._editarOrcamento(c, e.detail.valor)}
                ></viab-num>
              `}
            </span>`;
        },
      },
      {
        id: 'resultado', label: 'Resultado',
        // #175: sempre mostra o total resolvido em R$ — em `rs` é o próprio
        // orcamento_valor (sem conversão), mas ainda é o número que entra no
        // fluxo; escondê-lo ali deixava a coluna vazia na maioria das linhas.
        render: (c: any) => ePermutaFisica(c)
          ? html`<span class="res-calc sec">Sem valor monetário</span>`
          : html`<span class="res-calc">${fmtR$(resolverCustoTotal(c, this._ctx()))}</span>`,
      },
      {
        id: 'distribuicao', label: 'Distribuição',
        render: (c: any) => {
          if (eCorretagem(c)) return html`
            <span class="mes-calc" title="A corretagem é paga integralmente no mês em que a unidade é vendida">
              Mês da venda <span>🔒</span></span>`;
          if (ePermutaFisica(c)) return html`
            <span class="mes-calc" title="A entrega da unidade não segue curva de distribuição — é a transferência da tipologia selecionada">
              Entrega de unidades <span>🔒</span></span>`;
          if (ePermutaFinanceira(c)) {
            // #238: a distribuição é travada (sai conforme a receita entra), mas
            // a BASE é escolha do estudo — o motor já lia
            // `permuta_financeira_base` e o backend já a validava; faltava o
            // controle, que é o que tornava a capacidade invisível.
            // Só faz sentido em % VGV: em R$ o total é fixo e as duas bases dão
            // o mesmo valor (ver nota de permutaFinanceiraBrutaMensal).
            const ePct = (c.orcamento_unidade || 'rs') === 'pct_vgv';
            const alt = this._permutaAlternativa(c);
            return html`
              <div class="dist-preco">
                <span class="mes-calc" title="A permuta financeira sai proporcionalmente à receita de caixa do mês — não segue curva nem evento próprio (#238)">
                  Receita das vendas <span>🔒</span></span>
                ${ePct ? html`
                  <urbi-select .valor=${c.permuta_financeira_base || 'bruta'} .opcoes=${BASES_PERMUTA_FINANCEIRA}
                    ?desabilitado=${dis}
                    @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { permuta_financeira_base: e.detail.valor })}
                  ></urbi-select>
                  ${alt !== null ? html`
                    <span class="sec" title="Valor que esta linha teria na outra base econômica — disponível para auditoria (#238)">
                      base ${c.permuta_financeira_base === 'liquida' ? 'bruta' : 'líquida'}: ${fmtR$(alt)}</span>` : nothing}
                ` : nothing}
              </div>`;
          }
          if (ePrecoTerreno(c)) {
            const modo = c.distribuicao_modo || 'fixo';
            return html`
              <div class="dist-preco">
                <urbi-select .valor=${modo} .opcoes=${MODOS_DISTRIBUICAO_PRECO}
                  @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { distribuicao_modo: e.detail.valor })}
                ></urbi-select>
                ${modo === 'fixo' ? html`
                  <urbi-select
                    .valor=${c.curva_id ? String(c.curva_id) : ''}
                    .opcoes=${[{ valor: '', rotulo: 'Linear' },
                      ...this.curvas.map((k) => ({ valor: String(k.id), rotulo: k.nome }))]}
                    @urbi:select-change=${(e: CustomEvent) =>
                      this._salvar(c, { curva_id: e.detail.valor ? Number(e.detail.valor) : null })}
                  ></urbi-select>` : html`
                  <span class="mes-calc"
                    title=${modo === 'unit_delivery'
                      ? 'Rateado proporcionalmente à receita em caixa (entrada + parcelas + repasse na entrega)'
                      : 'Rateado proporcionalmente ao VGV vendido (mesma absorção da linha de receita)'}>
                    ${modo === 'unit_delivery' ? 'Receita em caixa' : 'VGV vendido'} <span>🔒</span></span>`}
              </div>`;
          }
          return html`
            <urbi-select
              .valor=${c.curva_id ? String(c.curva_id) : ''}
              .opcoes=${[{ valor: '', rotulo: 'Linear' },
                ...this.curvas.map((k) => ({ valor: String(k.id), rotulo: k.nome }))]}
              @urbi:select-change=${(e: CustomEvent) =>
                this._salvar(c, { curva_id: e.detail.valor ? Number(e.detail.valor) : null })}
            ></urbi-select>`;
        },
      },
      {
        id: 'cronograma', label: 'Cronograma',
        render: (c: any) => {
          // #255: a classificação vive em regimeCronogramaLinha (fluxo-shared),
          // fonte única para as três colunas. Corretagem segue as vendas (#121);
          // permuta e Preço distribuído seguem sua curva (#194).
          const regime = regimeCronogramaLinha(c);
          if (regime === 'sem_cronograma') return html`<span class="sec">—</span>`;
          if (regime === 'fixo_obra') {
            // Construção: cronograma fixo em "Obra" (sem seletor) — #120.
            return html`<span class="mes-calc"><strong>Obra</strong>
              <span title="Cronograma fixo na Obra">🔒</span></span>`;
          }
          // #167: além dos 5 eventos fixos, ancora numa fase do Cronograma
          // (tipo='cronograma', lista separada da de Receitas desde o #168).
          const valorAtual = c.fase_ancora_id ? `fase:${c.fase_ancora_id}` : (c.cronograma_evento || 'customizado');
          // #330: some do combo quando o estudo não tem Pré-lançamento — a
          // menos que esta linha já esteja ancorada nele (legado), caso em
          // que fica visível para não quebrar o select num valor sem opção.
          const temPreLancamento = this.crono.some((ev) => ev.evento === 'pre_lancamento');
          const eventosAncora = temPreLancamento || valorAtual === 'pre_lancamento'
            ? EVENTOS_ANCORA
            : EVENTOS_ANCORA.filter((ev) => ev.valor !== 'pre_lancamento');
          const opcoes = [...eventosAncora, ...this.fasesCronograma.map((f) => ({
            valor: `fase:${f.id}`, rotulo: f.nome || 'Fase',
          }))];
          return html`
            <urbi-select .valor=${valorAtual} .opcoes=${opcoes}
              @urbi:select-change=${(e: CustomEvent) => {
                const v = String(e.detail.valor);
                if (v.startsWith('fase:')) {
                  this._salvar(c, { fase_ancora_id: Number(v.slice(5)), cronograma_evento: 'customizado' });
                } else {
                  this._salvar(c, { cronograma_evento: v, fase_ancora_id: null });
                }
              }}
            ></urbi-select>`;
        },
      },
      {
        id: 'inicio', label: 'Início',
        render: (c: any) => {
          const regime = regimeCronogramaLinha(c);   // #255: fonte única
          if (regime === 'sem_cronograma') return html`<span class="sec">—</span>`;
          if (regime === 'fixo_obra') {
            // Início derivado do cronograma (evento Obra), bloqueado — #120.
            const obra = this._eventoObra;
            const ini = obra ? Number(obra.inicio_mes) : Number(c.inicio_mes) || 0;
            return html`<span class="mes-calc mes-crono">📅 ${rotuloMesRelativo(this.dataInicio, ini)}
              <span title="Derivado do cronograma (Obra)">🔒</span></span>`;
          }
          if (regime === 'fase_ancora') {
            // Início derivado da fase-âncora do Cronograma, bloqueado — #167.
            const fase = this.fasesCronograma.find((f) => Number(f.id) === Number(c.fase_ancora_id));
            return html`<span class="mes-calc mes-crono">📅 ${rotuloMesRelativo(this.dataInicio, Number(c.inicio_mes))}
              <span title=${`Ancorado na fase "${fase?.nome || c.fase_ancora_id}"`}>🔒</span></span>`;
          }
          if (regime === 'evento_fixo') {
            return html`<span class="mes-calc mes-crono">📅 ${rotuloMesRelativo(this.dataInicio, Number(c.inicio_mes))}
              <span title=${`Ancorado em ${EVENTO_LABEL[c.cronograma_evento] || c.cronograma_evento}`}>🔒</span></span>`;
          }
          return html`
            <span class="campo-mes">📅
              <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis}
                .valor=${Number(c.inicio_mes) || 1}
                @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(c, { inicio_mes: e.detail.valor })}
              ></viab-num>
            </span>`;
        },
      },
      {
        id: 'duracao', label: 'Duração',
        render: (c: any) => {
          const regime = regimeCronogramaLinha(c);   // #255: fonte única
          if (regime === 'sem_cronograma') return html`<span class="sec">—</span>`;
          if (regime === 'fixo_obra') {
            // Duração derivada do cronograma (evento Obra), bloqueada — #120.
            const obra = this._eventoObra;
            const dur = obra ? Number(obra.duracao_meses) : Number(c.duracao_meses) || 1;
            return html`<span class="mes-calc mes-crono">🕐 ${dur} ${dur === 1 ? 'mês' : 'meses'}
              <span title="Derivado do cronograma (Obra)">🔒</span></span>`;
          }
          // #249: simétrico ao Início — duração também trava quando ancorada a
          // uma fase ou a um evento fixo (antes só Construção bloqueava aqui;
          // fase-âncora e demais eventos deixavam o campo editável mesmo com o
          // backend agora recusando a alteração, o que produzia 422 silencioso
          // na tela ao salvar).
          if (regime === 'fase_ancora') {
            const fase = this.fasesCronograma.find((f) => Number(f.id) === Number(c.fase_ancora_id));
            const dur = Number(c.duracao_meses) || 1;
            return html`<span class="mes-calc mes-crono">🕐 ${dur} ${dur === 1 ? 'mês' : 'meses'}
              <span title=${`Ancorado na fase "${fase?.nome || c.fase_ancora_id}"`}>🔒</span></span>`;
          }
          if (regime === 'evento_fixo') {
            const dur = Number(c.duracao_meses) || 1;
            return html`<span class="mes-calc mes-crono">🕐 ${dur} ${dur === 1 ? 'mês' : 'meses'}
              <span title=${`Ancorado em ${EVENTO_LABEL[c.cronograma_evento] || c.cronograma_evento}`}>🔒</span></span>`;
          }
          return html`
            <span class="campo-mes">🕐
              <viab-num casas-decimais="0" sufixo="meses" ?desabilitado=${dis}
                .valor=${Number(c.duracao_meses) || 1}
                @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(c, { duracao_meses: e.detail.valor })}
              ></viab-num>
            </span>`;
        },
      },
    ];
    if (!dis) {
      colunas.push({
        id: 'acoes', label: '',
        render: (c: any) => eObrigatoria(c) ? nothing : html`
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
            @click=${() => { this.removerAlvo = c; }}></urbi-botao>`,
      });
    }
    // #173: Subcategoria só existe de fato em Terreno (Preço tem uma lista real
    // de subs); nos demais grupos a coluna ficava com "—" ou um campo de texto
    // livre sem função clara. Some para todo grupo que não seja Terreno.
    return g.id === 'terreno' ? colunas : colunas.filter((col) => col.id !== 'subcategoria');
  }

  // Alinha a linha Construção ao cronograma do empreendimento: fixa o evento em
  // "obra" e copia Início/Duração do evento Obra para o dado persistido, de modo
  // que o motor de fluxo distribua o custo no mesmo intervalo exibido (bloqueado)
  // na UI — #120. Idempotente: só faz PATCH quando algo diverge.
  private async _sincronizarConstrucao() {
    const obra = this._eventoObra;
    if (!obra) return;
    const c = this.custos.find((x) => eConstrucao(x));
    if (!c) return;
    const patch: Record<string, any> = {};
    if ((c.cronograma_evento || '') !== 'obra') patch.cronograma_evento = 'obra';
    if (Number(c.inicio_mes) !== Number(obra.inicio_mes)) patch.inicio_mes = Number(obra.inicio_mes);
    if (Number(c.duracao_meses) !== Number(obra.duracao_meses)) patch.duracao_meses = Number(obra.duracao_meses);
    if (Object.keys(patch).length) await this._salvar(c, patch);
  }

  // Cria as linhas obrigatórias (de todos os grupos) que ainda não existem.
  // Corretagem nasce sem âncora de cronograma: quem manda no seu calendário é a
  // absorção das vendas, resolvida no motor (#121).
  private async _garantirLinhasObrigatorias() {
    for (const [grupo, obrigatorias] of Object.entries(LINHAS_OBRIGATORIAS)) {
      for (const obrig of obrigatorias ?? []) {
        const existe = this.custos.some((c) => c.grupo === grupo && c.categoria === obrig.categoria);
        if (existe) continue;
        const dados: Record<string, any> = {
          grupo,
          categoria: obrig.categoria,
          cronograma_evento: grupo === 'obra' ? 'obra' : 'customizado',
          ordem: obrig.posicao,
        };
        if (obrig.unidade) dados.orcamento_unidade = obrig.unidade;
        const res = await criarCustoAvancado(this.estudo.id, dados);
        if (!res?.erro) this.custos = [...this.custos, res];
      }
    }
  }

  private async _adicionar(g: Grupo) {
    try {
      const res = await criarCustoAvancado(this.estudo.id, {
        grupo: g.id,
        cronograma_evento: g.eventoPadrao,
        ordem: this.custos.filter((c) => c.grupo === g.id).length,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar custo', 'erro'); return; }
      this.custos = [...this.custos, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar custo', 'erro');
    }
  }

  // Grandezas de ligação p/ conversão (do contexto já carregado). `receita` usa a
  // receita líquida real (VGL) — a mesma base que `resolverCustoTotal` aplica para
  // `pct_receita` —, então a conversão por badge e o Resultado ficam coerentes
  // entre si (#118). Sem receita definida, cai no VGV (fallback do motor).
  private _ctxConversao(): CtxConversao {
    return {
      areaPrivativa: this.ctxCusto.areaPrivativaTotal,
      areaTerreno: this.ctxCusto.areaTerreno,
      vgv: this.ctxCusto.vgvTotal,
      receita: this.ctxCusto.receitaTotal ?? this.ctxCusto.vgvTotal,
    };
  }

  // Salva mudança de categoria e corrige a unidade se necessário.
  private _salvarCategoria(c: any, grupo: GrupoId, novaCategoria: string) {
    const dados: Record<string, any> = { categoria: novaCategoria, subcategoria: null };
    const unidAtual = c.orcamento_unidade || 'rs';
    const perm = this._unidsPerm(grupo, novaCategoria);
    if (!perm.includes(unidAtual)) dados.orcamento_unidade = perm[0] ?? 'rs';
    this._salvar(c, dados);
  }

  private _valorCanonico(c: any): number | null {
    const salvo = c.orcamento_valor_canonico;
    if (salvo !== null && salvo !== undefined && Number.isFinite(Number(salvo))) return Number(salvo);
    const valor = c.orcamento_valor;
    if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return null;
    return converterUnidade(CONV_UNIDADE[c.orcamento_unidade || 'rs'], CONV_UNIDADE.rs, Number(valor), this._ctxConversao());
  }

  private _valorExibido(c: any): number | null {
    const canonico = this._valorCanonico(c);
    if (canonico === null) return null;
    return converterUnidade(CONV_UNIDADE.rs, CONV_UNIDADE[c.orcamento_unidade || 'rs'], canonico, this._ctxConversao());
  }

  private _editarOrcamento(c: any, valor: number | null) {
    const unidade = c.orcamento_unidade || 'rs';
    const canonico = valor === null ? null
      : converterUnidade(CONV_UNIDADE[unidade], CONV_UNIDADE.rs, Number(valor), this._ctxConversao());
    // O campo antigo acompanha somente uma edição consciente; a badge não o toca.
    this._salvar(c, { orcamento_valor: valor, orcamento_valor_canonico: canonico });
  }

  // A badge só troca a unidade de apresentação. Para linhas legadas, inicializa
  // o canônico uma vez a partir do valor ativo, sem alterar o orçamento legado.
  private _trocarUnidade(c: any, nova: string) {
    if (!this.editavel) return;
    const atual = c.orcamento_unidade || 'rs';
    if (nova === atual) return;
    const dados: Record<string, any> = { orcamento_unidade: nova };
    if (c.orcamento_valor_canonico === null || c.orcamento_valor_canonico === undefined) {
      const canonico = this._valorCanonico(c);
      if (canonico !== null) dados.orcamento_valor_canonico = canonico;
    }
    this._salvar(c, dados);
  }

  private async _salvar(c: any, dados: Record<string, any>) {
    if (!this.editavel) return;
    try {
      const res = await atualizarCustoAvancado(this.estudo.id, c.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      // Resposta traz início/duração reancorados quando o evento muda.
      this.custos = this.custos.map((x) => (x.id === c.id ? { ...x, ...dados, ...res } : x));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private _renderConfirmRemover(): TemplateResult {
    const c = this.removerAlvo;
    return html`
      <urbi-modal title="Remover custo" maxWidth="420px" @urbi-modal:close=${() => this.removerAlvo = null}>
        <p>Remover o custo <strong>${c.categoria || 'sem categoria'}${c.subcategoria ? ` — ${c.subcategoria}` : ''}</strong>?</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.removerAlvo = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemocao}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmarRemocao = async () => {
    const c = this.removerAlvo;
    this.removerAlvo = null;
    try {
      const res = await removerCustoAvancado(this.estudo.id, c.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.custos = this.custos.filter((x) => x.id !== c.id);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };
}

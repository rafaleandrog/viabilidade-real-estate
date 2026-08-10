import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct, fmtPctEntrada } from './viab-format.js';
import {
  urbiVerso, atualizarEstudo, listarBenchmarks, buscarConfig,
  listarProdutosPreliminar, criarProdutoPreliminar, atualizarProdutoPreliminar, removerProdutoPreliminar,
} from './viabilidade-api.js';
import { calcularProforma, precoSugeridoM2, vgvProduto, totalProdutos, type ProformaInput, type Proforma } from './proforma.js';
import { camposObrigatorios, validarObrigatorios } from './premissas-validacao.js';
import { converterUnidade, type ConvUnidade, type CtxConversao } from './premissas-conversao.js';
import { varianteFaixa } from './medidor-faixas.js';
import { calcularCascata, CASCATA_LOTEAMENTO, type EstadoLinha, type UnidadeMestre, type LinhaResolvida } from './areas-cascata.js';
import './tela-terreno-nucleo.js';
import './viab-num.js';
import './viab-imagem-principal.js';

type T = 'num' | 'txt';
type Largura = 'p1' | 'p2' | 'p3';
interface Campo { k: string; label: string; t: T; sufixo?: string; w?: Largura; }

// #6: três larguras de campo. p2 (média) é o default; a classe define a largura
// fixa no grid (ver estilos `.grid > .pN`).
//  · p1 (menor): % (qualquer), R$/m² e coeficientes mín/máx.
//  · p2 (média): área (m²) e moeda (R$), além de numéricos sem sufixo (contagens).
//  · p3 (maior): texto livre e selects.
function larguraClasse(c: Campo): Largura {
  if (c.w) return c.w;
  if (c.t === 'txt') return 'p3';
  const s = c.sufixo ?? '';
  if (s.includes('%') || s === 'R$/m²') return 'p1';
  return 'p2';
}

// Campos por seção. `so` limita a um tipo ('loteamento' | 'incorporacao').
const CUSTOS: (Campo & { so?: string })[] = [
  { k: 'custo_terreno_m2', label: 'Custo do terreno', t: 'num', sufixo: 'R$/m²' },
  { k: 'custo_decoracao_m2', label: 'Decoração', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'taxa_gestao_pct', label: 'Gestão da construção', t: 'num', sufixo: '%', so: 'incorporacao' },
  { k: 'incorporacao_registro_pct', label: 'Incorporação e registro', t: 'num', sufixo: '% VGV', so: 'incorporacao' },
  { k: 'valor_venal_terreno_m2', label: 'Valor venal do terreno (outorga)', t: 'num', sufixo: 'R$/m²', so: 'incorporacao' },
  { k: 'manutencao_pct', label: 'Manutenção pós-obra', t: 'num', sufixo: '% VGV' },
  { k: 'contingencias_pct', label: 'Contingências', t: 'num', sufixo: '% VGV' },
  { k: 'stand_vendas_valor', label: 'Stand de vendas', t: 'num', sufixo: 'R$', so: 'loteamento' },
  { k: 'marketing_global_pct', label: 'Marketing global / estrutura', t: 'num', sufixo: '% VGV' },
  { k: 'gestao_indiretos_pct', label: 'Gestão e outros custos indiretos', t: 'num', sufixo: '% VGV' },
];

// Custos com opção de UNIDADE (#3/#4): um seletor de unidade + um único campo de
// valor cuja chave/sufixo dependem da unidade escolhida. Só o campo da unidade
// ativa é exibido (o outro fica oculto — não some do schema).
interface CustoUnidade {
  modoKey: string; rotulo: string; so?: string; padrao: string;
  // Fonte de verdade da quantidade econômica. Para custos é R$; para a
  // permuta física é m². Os campos históricos por unidade permanecem apenas
  // como compatibilidade até que todos os consumidores passem ao resolver (#260).
  campoCanonico: string;
  // `conv` (Parte 2): como o valor da unidade converte para a base ao trocar de
  // unidade (identidade / % de uma grandeza / por m² de uma grandeza).
  opcoes: { valor: string; rotulo: string; campo: string; sufixo: string; conv: ConvUnidade }[];
}
const CUSTOS_UNIDADE: CustoUnidade[] = [
  {
    // #5: infraestrutura do loteamento tem 3 unidades — % VGV, R$ (fixo) ou R$/m².
    modoKey: 'infra_modo', rotulo: 'Infraestrutura', so: 'loteamento', padrao: 'pct_vgv', campoCanonico: 'infra_valor_canonico',
    opcoes: [
      { valor: 'pct_vgv', rotulo: '% VGV', campo: 'infra_pct', sufixo: '% VGV', conv: { tipo: 'pct', link: 'vgv' } },
      { valor: 'valor_fixo', rotulo: 'R$', campo: 'infra_valor_fixo', sufixo: 'R$', conv: { tipo: 'identidade' } },
      { valor: 'valor_m2', rotulo: 'R$/m²', campo: 'custo_infra_m2', sufixo: 'R$/m²', conv: { tipo: 'por_area', link: 'areaVendavel' } },
    ],
  },
  {
    modoKey: 'construcao_modo', rotulo: 'Construção', so: 'incorporacao', padrao: 'valor_m2', campoCanonico: 'construcao_valor_canonico',
    opcoes: [
      { valor: 'valor_m2', rotulo: 'R$/m²', campo: 'custo_construcao_m2', sufixo: 'R$/m²', conv: { tipo: 'por_area', link: 'areaPrivativa' } },
      { valor: 'valor_total', rotulo: 'R$ (total)', campo: 'construcao_valor_total', sufixo: 'R$', conv: { tipo: 'identidade' } },
    ],
  },
  {
    modoKey: 'projetos_modo', rotulo: 'Projetos', padrao: 'pct_vgv', campoCanonico: 'projetos_valor_canonico',
    opcoes: [
      { valor: 'pct_vgv', rotulo: '% VGV', campo: 'projetos_pct', sufixo: '% VGV', conv: { tipo: 'pct', link: 'vgv' } },
      { valor: 'valor_fixo', rotulo: 'R$ (fixo)', campo: 'projetos_valor_fixo', sufixo: 'R$', conv: { tipo: 'identidade' } },
    ],
  },
];

// Permuta física: campo único com unidade (a permuta reduz o VGV; entra por área
// em m² ou por % da área de venda). Loteamento usa uma só (produto único).
// Incorporação separa Residencial (campos legados `permuta_fisica_*`) e Não
// Residencial (`permuta_fisica_nr_*`) em dois campos (#10).
const PERMUTA_UNIDADE: CustoUnidade = {
  modoKey: 'permuta_fisica_modo', rotulo: 'Permuta física', padrao: 'area_m2', campoCanonico: 'permuta_fisica_area_canonica',
  opcoes: [
    { valor: 'area_m2', rotulo: 'm²', campo: 'permuta_fisica_area_m2', sufixo: 'm²', conv: { tipo: 'identidade' } },
    { valor: 'pct_area_venda', rotulo: '% área venda', campo: 'permuta_fisica_pct', sufixo: '%', conv: { tipo: 'pct', link: 'areaVendavelR' } },
  ],
};
const PERMUTA_FIS_R: CustoUnidade = { ...PERMUTA_UNIDADE, rotulo: 'Permuta física residencial' };
const PERMUTA_FIS_NR: CustoUnidade = {
  modoKey: 'permuta_fisica_nr_modo', rotulo: 'Permuta física não residencial', padrao: 'area_m2', campoCanonico: 'permuta_fisica_nr_area_canonica',
  opcoes: [
    { valor: 'area_m2', rotulo: 'm²', campo: 'permuta_fisica_nr_area_m2', sufixo: 'm²', conv: { tipo: 'identidade' } },
    { valor: 'pct_area_venda', rotulo: '% área venda', campo: 'permuta_fisica_nr_pct', sufixo: '%', conv: { tipo: 'pct', link: 'areaVendavelNR' } },
  ],
};

// Permuta financeira R e NR (#5): cada uma alterna entre % do VGV do tipo e um
// valor absoluto em R$. Renderizadas na seção Deduções.
const PERMUTA_FIN_R: CustoUnidade = {
  modoKey: 'permuta_financeira_residencial_modo', rotulo: 'Permuta financeira residencial', padrao: 'pct_vgv', campoCanonico: 'permuta_financeira_residencial_valor_canonico',
  opcoes: [
    { valor: 'pct_vgv', rotulo: '% VGV', campo: 'permuta_financeira_residencial_pct', sufixo: '% VGV', conv: { tipo: 'pct', link: 'vgvResidencial' } },
    { valor: 'valor_fixo', rotulo: 'R$', campo: 'permuta_financeira_residencial_valor', sufixo: 'R$', conv: { tipo: 'identidade' } },
  ],
};
const PERMUTA_FIN_NR: CustoUnidade = {
  modoKey: 'permuta_financeira_nao_residencial_modo', rotulo: 'Permuta financeira não residencial', padrao: 'pct_vgv', campoCanonico: 'permuta_financeira_nao_residencial_valor_canonico',
  opcoes: [
    { valor: 'pct_vgv', rotulo: '% VGV', campo: 'permuta_financeira_nao_residencial_pct', sufixo: '% VGV', conv: { tipo: 'pct', link: 'vgvNaoResidencial' } },
    { valor: 'valor_fixo', rotulo: 'R$', campo: 'permuta_financeira_nao_residencial_valor', sufixo: 'R$', conv: { tipo: 'identidade' } },
  ],
};

const IMPOSTOS: Campo[] = [
  { k: 'imposto_percentual', label: 'Imposto (se não RET)', t: 'num', sufixo: '%' },
];

// Permuta financeira R/NR saiu daqui (#5) para o padrão de campo com badge de
// unidade (ver PERMUTA_FIN_R/PERMUTA_FIN_NR).
const DEDUCOES: Campo[] = [
  { k: 'corretagem_percentual', label: 'Corretagem', t: 'num', sufixo: '%' },
  { k: 'marketing_percentual', label: 'Marketing', t: 'num', sufixo: '%' },
];

// Loteamento — Áreas = composição da área da gleba (deduções em % da gleba).
const AREAS_LOT: Campo[] = [
  { k: 'app_pct', label: 'APP', t: 'num', sufixo: '% gleba' },
  { k: 'faixas_nao_edificaveis_pct', label: 'Faixas não edificáveis', t: 'num', sufixo: '% gleba' },
  { k: 'sistema_viario_pct', label: 'Sistema viário', t: 'num', sufixo: '% gleba' },
  { k: 'elup_pct', label: 'ELUP', t: 'num', sufixo: '% gleba' },
  { k: 'epc_pct', label: 'EPC', t: 'num', sufixo: '% gleba' },
  { k: 'epu_pct', label: 'EPU', t: 'num', sufixo: '% gleba' },
  { k: 'areas_privativas_nao_vendaveis_pct', label: 'Priv. não vendáveis', t: 'num', sufixo: '% gleba' },
];
// Loteamento — Produtos = o lote (tamanho médio) e o preço de venda.
const PRODUTOS_LOT: Campo[] = [
  { k: 'area_media_lote_m2', label: 'Área média do lote', t: 'num', sufixo: 'm²' },
  { k: 'preco_venda_m2', label: 'Preço de venda', t: 'num', sufixo: 'R$/m²' },
];

// Coeficientes de aproveitamento (mín/máx): característica do terreno/zoneamento
// (só Incorporação). Renderizados dentro da seção Terreno (#9).
const TERRENO_COEF: Campo[] = [
  { k: 'coef_aproveitamento_basico', label: 'Coeficiente mínimo', t: 'num', w: 'p1' },
  { k: 'coef_aproveitamento_maximo', label: 'Coeficiente máximo', t: 'num', w: 'p1' },
];

// Incorporação — Áreas = as áreas privativas/comuns do produto.
const AREAS_INC: Campo[] = [
  { k: 'area_pvt_r_fechada', label: 'Área PVT R Fechada', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_nr_fechada', label: 'Área PVT NR Fechada', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_r_aberta', label: 'Área PVT R Aberta', t: 'num', sufixo: 'm²' },
  { k: 'area_pvt_nr_aberta', label: 'Área PVT NR Aberta', t: 'num', sufixo: 'm²' },
  { k: 'area_comum_total', label: 'Área comum total', t: 'num', sufixo: 'm²' },
];
// Incorporação — Produtos = unidades e preços por tipo (Residencial / Não res.).
const PRODUTOS_INC: Campo[] = [
  { k: 'num_unidades_residencial', label: 'Nº de unidades residenciais', t: 'num' },
  { k: 'num_unidades_nao_residencial', label: 'Nº de unidades não residenciais', t: 'num' },
  { k: 'preco_venda_m2_residencial', label: 'Preço venda residencial', t: 'num', sufixo: 'R$/m²' },
  { k: 'preco_venda_m2_nao_residencial', label: 'Preço venda não residencial', t: 'num', sufixo: 'R$/m²' },
];

// Tabela de áreas em cascata do Loteamento (2026-08-03) — mapa id da linha
// (motor genérico, `areas-cascata.ts`) → prefixo do campo no schema. `poligonal`
// não entra aqui: é a linha "Terreno" já renderizada acima (origem Núcleo/manual).
const CAMPO_POR_LINHA_LOT: Record<string, string> = {
  app: 'area_app', elup_epu: 'area_elup_epu', epc: 'area_epc',
  viario_publico: 'area_viario_publico', viario_privado: 'area_viario_privado',
  comuns_privadas: 'area_comuns_privadas', verdes: 'area_verdes',
};
// O motor usa nomes genéricos de âncora ('pct_ancora1'/'pct_ancora2'); o
// schema/UI usa os nomes de domínio do Loteamento ('pct_poligonal'/
// 'pct_parcelavel' — mesma tradução que proforma.ts faz para calcular).
const MODO_SCHEMA_PARA_MOTOR: Record<string, UnidadeMestre> = { m2: 'm2', pct_poligonal: 'pct_ancora1', pct_parcelavel: 'pct_ancora2' };
const MODO_MOTOR_PARA_SCHEMA: Record<UnidadeMestre, string> = { m2: 'm2', pct_ancora1: 'pct_poligonal', pct_ancora2: 'pct_parcelavel' };

// Todas as definições de campo-com-unidade (para coletar seus campos numéricos).
const CAMPOS_UNIDADE: CustoUnidade[] = [...CUSTOS_UNIDADE, PERMUTA_UNIDADE, PERMUTA_FIS_NR, PERMUTA_FIN_R, PERMUTA_FIN_NR];

const TODOS_NUM = new Set<string>([
  ...CUSTOS, ...IMPOSTOS, ...DEDUCOES, ...AREAS_LOT, ...AREAS_INC,
  ...PRODUTOS_LOT, ...PRODUTOS_INC, ...TERRENO_COEF,
].map((c) => c.k).concat(
  ['terreno_manual_area'],
  CAMPOS_UNIDADE.flatMap((cu) => cu.opcoes.map((o) => o.campo)),
  Object.values(CAMPO_POR_LINHA_LOT).map((campo) => `${campo}_valor`),
));

@customElement('viab-tela-premissas')
export class ViabTelaPremissas extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;
  // Sub-aba (2026-08-03, reestruturação do Preliminar): qual grupo de seções
  // mostrar. Uma única instância deste componente atende as 3 sub-abas — o
  // pai (tela-preliminar.ts) reatribui o `slot` dinamicamente em vez de
  // instanciar 3 componentes (evitaria 3 fetches redundantes e 3 cópias
  // independentes de `form`/`_dirty` fora de sincronia entre si). O
  // formulário, o "dirty" e o Salvar continuam ÚNICOS e globais — salvar em
  // qualquer sub-aba salva as premissas inteiras, como já era antes da
  // divisão visual.
  @property({ type: String }) secao: 'terreno' | 'custos' | 'produtos' | 'permutas' = 'terreno';

  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  @state() private _dirty = false;
  private _snapshot: Record<string, any> = {};
  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  // #315: catálogo de Produtos — CRUD à parte do form (uma linha = uma
  // persistência otimista, como `tela-empreendimento-tipologias.ts`), não faz
  // parte do "Salvar premissas" único.
  @state() private produtos: any[] = [];
  @state() private confirmRemoverProduto: any | null = null;
  // Validação de obrigatórios (ao salvar): `erros` por campo + resumo em banner.
  @state() private erros: Record<string, string> = {};
  @state() private erroGeral = '';
  // Set de campos obrigatórios do render atual (recalculado no topo de render()).
  private _obrigCache = new Set<string>();

  static styles = [estiloConteudo, css`
    .secao { margin-bottom: 20px; }
    .secao h4 {
      margin: 0 0 12px; font-size: var(--texto-rotulo, 0.75rem);
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    /* #6: três larguras fixas de campo. flex-wrap distribui da esquerda pra
       direita e quebra conforme couber; max-width:100% evita overflow em telas
       estreitas. p2 é o default; p1 menor, p3 maior. */
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; }
    .grid > * { width: 210px; max-width: 100%; box-sizing: border-box; }
    .grid > .p1 { width: 165px; }
    .grid > .p3 { width: 330px; }
    .subgrid { margin-top: 12px; }
    /* #10: cada grupo é uma faixa delimitada por uma linha horizontal no topo,
       com duas cores do design system intercaladas (A/B). Tokens theme-aware. */
    .grupo { margin-bottom: 0; padding: 16px 14px; border-top: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .grupo-a { background: var(--cor-superficie-sutil, rgba(255,255,255,0.02)); }
    .grupo-b { background: var(--cor-superficie, rgba(255,255,255,0.04)); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .kpis urbi-kpi { min-width: 0; }
    /* #7: nº e preço médio por unidade, Residencial / Não residencial. */
    .unid-tipo { display: flex; gap: 28px; flex-wrap: wrap; margin-top: 14px; }
    .ut-item { display: flex; flex-direction: column; gap: 2px; }
    .ut-rot {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .ut-val { font-size: 0.95rem; color: var(--cor-texto-forte, rgba(255,255,255,0.95)); font-variant-numeric: tabular-nums; }
    .checks { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .form-acoes { display: flex; justify-content: flex-end; margin-top: 8px; }
    urbi-card + urbi-card { margin-top: 16px; }
    urbi-banner { margin-top: 12px; }
    /* Campo único com unidade: rótulo em cima; [tag de unidade][valor] embutidos. */
    .campo-unidade { display: flex; flex-direction: column; gap: 4px; }
    /* #4: mesmo rótulo de 2 linhas ancorado ao rodapé do viab-num, para o campo
       composto alinhar com os vizinhos da fileira. */
    .cu-rotulo {
      font-size: 0.75rem; text-transform: uppercase;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-weight: 700; letter-spacing: 0.4px;
      display: flex; align-items: flex-end;
      min-height: 2.4em; line-height: 1.2;
    }
    .cu-req { color: var(--cor-erro, #d45a3a); margin-left: 2px; }
    .cu-linha { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    /* #5: badges de unidade (seleção mútua) à esquerda do valor. */
    .cu-badges { display: flex; gap: 4px; flex: 0 0 auto; }
    .cu-badges urbi-badge { cursor: pointer; }
    .cu-badge-dis { pointer-events: none; opacity: 0.5; }
    .cu-valor { flex: 1 1 120px; min-width: 0; }

    /* Tabela de áreas em cascata (2026-08-03) — mesma convenção de linha
       negrito/fundo claro para as linhas COMPUTADAS (âncoras/subtotais),
       espelhando a imagem de referência padrao_areas.png. */
    .areas-wrap { overflow-x: auto; }
    table.areas { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 0.85rem; }
    table.areas th, table.areas td { padding: 6px 10px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); text-align: left; }
    table.areas th { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    table.areas td.num, table.areas th.num { text-align: right; }
    table.areas tr.computada td { font-weight: 700; background: var(--cor-superficie-sutil, rgba(255,255,255,0.03)); }
    .area-seletor { display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; }
    .area-seletor urbi-badge { cursor: pointer; flex: 0 0 auto; }
    .area-valor { width: 130px; }

    /* Catálogo de Produtos (#315) — mesmo padrão de tabela dinâmica de
       tela-empreendimento-tipologias.ts: colgroup de larguras fixas, edição
       inline por célula, linha de total, VGV calculado (não editável). */
    table.prod { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; table-layout: fixed; }
    table.prod th {
      text-align: left; font-weight: 600; padding: 8px; font-size: var(--texto-rotulo, 0.75rem);
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    table.prod th.num, table.prod td.num { text-align: right; }
    table.prod td { padding: 6px 8px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); font-size: var(--texto-corpo, 0.8125rem); }
    col.p-nome { width: 26%; } col.p-area { width: 20%; } col.p-preco { width: 20%; }
    col.p-un { width: 12%; } col.p-vgv { width: 16%; } col.p-acao { width: 60px; }
    table.prod td.nome urbi-input { width: 100%; }
    table.prod td viab-num { width: 100%; }
    table.prod td.vgv-calc { font-weight: 600; color: var(--cor-texto-forte, rgba(255,255,255,0.95)); }
    table.prod tr.total td { font-weight: 700; border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.2)); border-bottom: none; padding-top: 10px; }
    .prod-vazio { padding: 8px 0; }
    .acoes-topo { margin-top: 16px; }
  `];

  private _idCarregado: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._init();
  }
  updated(ch: Map<string, unknown>) {
    // Só recarrega (e refaz o fetch de benchmarks/config) quando muda o ESTUDO
    // de fato — não a cada tecla propagada de volta via viab:premissas-change (#6).
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  private async _init() {
    if (!this.estudo) return;
    this._idCarregado = this.estudo.id ?? null;
    this.form = { ...this.estudo };
    this._snapshot = { ...this.estudo };
    this._dirty = false;
    this.erros = {};
    this.erroGeral = '';
    try {
      const [bm, cfg, prod] = await Promise.all([
        listarBenchmarks(this.estudo.tipo_empreendimento), buscarConfig(),
        listarProdutosPreliminar(this.estudo.id),
      ]);
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
      this.produtos = prod?.dados || [];
    } catch (e) { console.error(e); }
  }

  private _entradaProforma(): ProformaInput {
    return { ...this.form, aliquota_ret_pct: this.aliquotaRet, produtos: this.produtos } as ProformaInput;
  }

  private _set(k: string, v: any) {
    this.form = { ...this.form, [k]: v };
    this._dirty = this._formDifereSnapshot();
    // Ao editar, limpa o erro daquele campo (o resumo em banner persiste até o
    // próximo Salvar).
    if (this.erros[k]) { const { [k]: _omit, ...resto } = this.erros; this.erros = resto; }
    // Propaga em tempo real para a tela do estudo, que reflete em Proforma e
    // Gráficos instantaneamente (#6). Não persiste — persistência é no Salvar.
    this.dispatchEvent(new CustomEvent('viab:premissas-change', {
      detail: { dados: this.form }, bubbles: true, composed: true,
    }));
  }


  private _formDifereSnapshot(): boolean {
    for (const k of Object.keys(this.form)) {
      const a = this.form[k];
      const b = this._snapshot[k];
      const an = (a === '' || a == null) ? null : a;
      const bn = (b === '' || b == null) ? null : b;
      if (String(an) !== String(bn)) return true;
    }
    return false;
  }

  private _num(k: string): number | null {
    const v = this.form[k];
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  // Grandezas de ligação para a conversão de unidades (Parte 2), do estado atual.
  // O VGV e as áreas não dependem dos campos de custo/permuta, então não há
  // circularidade. areaVendavelR/NR = área de venda de cada tipo (loteamento é
  // produto único ⇒ R = área vendável, NR = 0).
  private _ctxConversao(): CtxConversao {
    const p = calcularProforma(this._entradaProforma());
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    return {
      vgv: p.vgv,
      vgvResidencial: p.vgvResidencial,
      vgvNaoResidencial: p.vgvNaoResidencial,
      areaVendavel: p.areaVendavel,
      areaVendavelR: lot ? p.areaVendavel : (Number(this.form.area_pvt_r_fechada) || 0),
      areaVendavelNR: lot ? 0 : (Number(this.form.area_pvt_nr_fechada) || 0),
      areaPrivativa: p.areaPrivativa,
    };
  }

  // Troca a unidade de um campo (Parte 2): converte o valor atual para a unidade
  // nova (equivalente), depois muda o modo. Se a base não estiver definida
  // (grandeza de ligação = 0) ou o valor estiver vazio, não converte — mantém o
  // valor atual do campo destino.
  private _trocarUnidade(cu: CustoUnidade, nova: CustoUnidade['opcoes'][number]) {
    const modoAtual = this.form[cu.modoKey] ?? cu.padrao;
    if (nova.valor === modoAtual) return;
    const atual = cu.opcoes.find((o) => o.valor === modoAtual) ?? cu.opcoes[0];
    // Estudos legados ainda não têm o canônico. Ao primeiro clique, derivamo-lo
    // do campo ativo; depois disso a badge só muda apresentação, nunca valor.
    if (this._num(cu.campoCanonico) === null) {
      const valorAtual = this._num(atual.campo);
      const canonico = valorAtual === null ? null
        : converterUnidade(atual.conv, { tipo: 'identidade' }, valorAtual, this._ctxConversao());
      if (canonico !== null) this._set(cu.campoCanonico, canonico);
    }
    this._set(cu.modoKey, nova.valor);
  }

  private _valorUnidade(cu: CustoUnidade, op: CustoUnidade['opcoes'][number]): number | null {
    const canonico = this._num(cu.campoCanonico);
    if (canonico === null) return this._num(op.campo); // estudo legado, sem mutação implícita
    return converterUnidade({ tipo: 'identidade' }, op.conv, canonico, this._ctxConversao()) ?? this._num(op.campo);
  }

  private _editarCustoUnidade(cu: CustoUnidade, op: CustoUnidade['opcoes'][number], valor: number | null) {
    this._set(op.campo, valor);
    if (valor === null) { this._set(cu.campoCanonico, null); return; }
    const canonico = converterUnidade(op.conv, { tipo: 'identidade' }, valor, this._ctxConversao());
    if (canonico !== null) this._set(cu.campoCanonico, canonico);
  }

  render() {
    if (!this.estudo) return nothing;
    // #88: no Avançado a aba Premissas não tem conteúdo — todo o formulário
    // estático (áreas/produtos/custos/impostos/deduções) é exclusivo do
    // Preliminar. O host (tela-avancado) já nem monta este componente para o
    // Avançado; este guard é a rede de segurança que garante "nenhum conteúdo".
    // Os campos seguem no schema: proforma.ts ainda os lê para os KPIs do Resumo.
    if (this.estudo.nivel_analise === 'avancado') return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    // No Avançado o Terreno vive em Empreendimento → Informações (#53).
    const avancado = this.estudo.nivel_analise === 'avancado';
    // Loteamento usa a tabela em cascata (2026-08-03) — AREAS_LOT só sobrevive
    // em TODOS_NUM, pra não perder o tipo numérico dos 7 campos antigos que
    // ainda existem no schema (dado histórico, sem leitura/escrita na tela).
    const areas = AREAS_INC;
    const custos = CUSTOS.filter((c) => !c.so || c.so === this.estudo.tipo_empreendimento);
    const dis = !this.editavel;
    this._obrigCache = camposObrigatorios(this.form, this.estudo.tipo_empreendimento);

    return html`
      ${this.secao === 'terreno' ? html`
        ${!avancado ? html`
          <urbi-card titulo="Imagem principal">
            <viab-imagem-principal .estudo=${this.estudo} .editavel=${this.editavel}></viab-imagem-principal>
          </urbi-card>` : nothing}

        <urbi-card titulo="Terreno & Áreas">
          ${!avancado ? html`
            <div class="secao grupo grupo-a">
              <h4>Terreno</h4>
              ${this.estudo.origem_terreno === 'nucleo'
                ? html`<viab-terreno-nucleo
                    .estudo=${this.estudo}
                    .editavel=${this.editavel && this.estudo.status === 'rascunho'}
                  ></viab-terreno-nucleo>`
                : html`<div class="grid">
                    ${this._input({ k: 'terreno_manual_nome', label: 'Nome do terreno', t: 'txt' }, dis)}
                    ${this._input({ k: 'terreno_manual_area', label: 'Área do terreno', t: 'num', sufixo: 'm²' }, dis)}
                  </div>`}
              ${!lot
                ? html`<div class="grid subgrid">${TERRENO_COEF.map((c) => this._input(c, dis))}</div>`
                : nothing}
            </div>` : nothing}

          <div class="secao grupo grupo-b">
            <h4>Áreas</h4>
            ${lot ? this._renderTabelaAreasLoteamento(dis) : html`<div class="grid">${areas.map((c) => this._input(c, dis))}</div>`}
          </div>

          ${this._renderRodapeForm()}
        </urbi-card>
      ` : nothing}

      ${this.secao === 'custos' ? html`
        <urbi-card titulo="Custos">
          <div class="secao grupo grupo-a">
            <h4>Custos</h4>
            <div class="checks">
              <urbi-checkbox
                label="Considerar custo de aquisição do terreno"
                ?desabilitado=${dis}
                ?marcado=${this.form.considerar_custo_terreno !== false}
                @urbi:checkbox-change=${(e: CustomEvent) => this._set('considerar_custo_terreno', e.detail.marcado)}
              ></urbi-checkbox>
            </div>
            <div class="grid">
              ${CUSTOS_UNIDADE
                .filter((cu) => !cu.so || cu.so === this.estudo.tipo_empreendimento)
                .map((cu) => this._custoUnidade(cu, dis))}
              ${custos.map((c) => this._input(c, dis, c.k === 'custo_terreno_m2' && this.form.considerar_custo_terreno === false))}
            </div>
          </div>

          <div class="secao grupo grupo-b">
            <h4>Impostos</h4>
            <div class="checks">
              <urbi-checkbox
                label="Sujeito a RET (alíquota fixa ${this.aliquotaRet}%)"
                ?desabilitado=${dis}
                ?marcado=${!!this.form.sujeito_ret}
                @urbi:checkbox-change=${(e: CustomEvent) => this._set('sujeito_ret', e.detail.marcado)}
              ></urbi-checkbox>
            </div>
            <div class="grid">${IMPOSTOS.map((c) => {
              const bloqImposto = !!this.form.sujeito_ret;
              return this._input(c, dis || bloqImposto, bloqImposto);
            })}</div>
          </div>

          <div class="secao grupo grupo-a">
            <h4>Deduções</h4>
            <div class="grid">${DEDUCOES.map((c) => this._input(c, dis))}</div>
          </div>

          ${this._renderRodapeForm()}
        </urbi-card>
      ` : nothing}

      ${this.secao === 'produtos' ? html`
        <urbi-card titulo="Produtos">
          <div class="secao grupo grupo-a">
            <h4>Produtos</h4>
            ${this._renderTabelaProdutos(dis)}
          </div>

          ${this._renderRodapeForm()}
        </urbi-card>
        ${this.confirmRemoverProduto ? this._renderConfirmRemoverProduto() : nothing}

        ${this._renderResumo(lot)}
      ` : nothing}

      ${this.secao === 'permutas' ? html`
        <urbi-card titulo="Permutas">
          <div class="secao grupo grupo-a">
            <h4>Permuta física</h4>
            <div class="grid">
              ${lot
                ? this._custoUnidade(PERMUTA_UNIDADE, dis)
                : html`${this._custoUnidade(PERMUTA_FIS_R, dis)}${this._custoUnidade(PERMUTA_FIS_NR, dis)}`}
            </div>
          </div>

          <div class="secao grupo grupo-b">
            <h4>Permuta financeira</h4>
            <div class="grid">
              ${this._custoUnidade(PERMUTA_FIN_R, dis)}
              ${lot ? nothing : this._custoUnidade(PERMUTA_FIN_NR, dis)}
            </div>
          </div>

          ${this._renderRodapeForm()}
        </urbi-card>
      ` : nothing}
    `;
  }

  // Rodapé de formulário (erro geral + banner de "não salvo" + botão Salvar)
  // — repetido em cada sub-aba porque o formulário/dirty/save são ÚNICOS e
  // globais (ver comentário na prop `secao`); salvar de qualquer sub-aba
  // salva as premissas inteiras.
  private _renderRodapeForm(): TemplateResult {
    return html`
      ${this.erroGeral ? html`<urbi-banner variante="erro">${this.erroGeral}</urbi-banner>` : nothing}
      ${this.editavel
        ? html`
            ${this._dirty ? html`<urbi-banner variante="alerta">
              As alterações não são salvas automaticamente — clique em “Salvar premissas” antes de sair desta página.
            </urbi-banner>` : nothing}
            <div class="form-acoes">
              <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar premissas</urbi-botao>
            </div>`
        : html`<p class="sec">Somente leitura neste status/função.</p>`}
    `;
  }

  // `aten` (bug #15): campo cujo dado não entra no cálculo naquele momento
  // (ex.: custo do terreno desligado, lado não escolhido da permuta) — fica cinza.
  private _input(c: Campo, dis: boolean, aten = false): TemplateResult {
    const w = larguraClasse(c);
    if (c.t === 'txt') {
      return html`<urbi-input
        class=${w}
        label=${c.label} ?desabilitado=${dis}
        .valor=${String(this.form[c.k] ?? '')}
        @urbi:input-change=${(e: CustomEvent) => this._set(c.k, e.detail.valor)}
      ></urbi-input>`;
    }
    return html`<viab-num
      class=${w}
      label=${c.label} sufixo=${c.sufixo ?? ''} ?desabilitado=${dis} ?atenuado=${aten}
      ?obrigatorio=${this._obrigCache.has(c.k)} erro=${this.erros[c.k] ?? ''}
      .valor=${this._num(c.k)}
      @urbi:input-numero-change=${(e: CustomEvent) => this._set(c.k, e.detail.valor)}
    ></viab-num>`;
  }

  // Campo ÚNICO com unidade (#5): rótulo em cima; abaixo, as BADGES interativas de
  // unidade (seleção mútua — só uma `?ativo` por vez) + o valor da unidade ativa,
  // como um só campo. Clicar numa badge troca `<modoKey>` → recalcula (a badge é o
  // gatilho; a regra unidade→cálculo mora aqui). O campo canônico é a fonte de
  // verdade; os campos históricos por unidade só dão compatibilidade a estudos
  // sem canônico e aos consumidores que a #260 ainda migrará.
  private _custoUnidade(cu: CustoUnidade, dis: boolean): TemplateResult {
    const modo = this.form[cu.modoKey] ?? cu.padrao;
    const op = cu.opcoes.find((o) => o.valor === modo) ?? cu.opcoes[0];
    // Obrigatório/erro seguem o campo da unidade ATIVA (ex.: Infraestrutura/Construção).
    const obrig = this._obrigCache.has(op.campo);
    const erro = this.erros[op.campo] ?? '';
    return html`
      <div class="campo-unidade p3">
        <label class="cu-rotulo">${cu.rotulo}${obrig ? html`<span class="cu-req" aria-hidden="true">*</span>` : nothing}</label>
        <div class="cu-linha">
          <div class="cu-badges" role="group" aria-label=${`Unidade de ${cu.rotulo}`}>
            ${cu.opcoes.map((o) => html`
              <urbi-badge
                cor="info" interativo ?ativo=${o.valor === modo}
                class=${dis ? 'cu-badge-dis' : ''}
                @click=${() => { if (!dis) this._trocarUnidade(cu, o); }}
              >${o.rotulo}</urbi-badge>`)}
          </div>
          <viab-num class="cu-valor" sufixo=${op.sufixo} ?desabilitado=${dis} erro=${erro}
            .valor=${this._valorUnidade(cu, op)}
            @urbi:input-numero-change=${(e: CustomEvent) => this._editarCustoUnidade(cu, op, e.detail.valor)}
          ></viab-num>
        </div>
      </div>
    `;
  }

  // ── Catálogo de Produtos (#315) — tabela add/remove, CRUD à parte do form ──

  private _renderTabelaProdutos(dis: boolean): TemplateResult {
    if (this.produtos.length === 0) {
      return html`
        <div class="prod-vazio">
          <urbi-estado-vazio icone="fa-solid fa-boxes-stacked"
            mensagem="Nenhum produto cadastrado — adicione o primeiro."></urbi-estado-vazio>
        </div>
        ${!dis ? html`
          <div class="acoes-topo">
            <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionarProduto}>
              Adicionar Produto
            </urbi-botao>
          </div>` : nothing}
      `;
    }
    const { vgv, unidades } = totalProdutos(this.produtos);
    return html`
      <table class="prod">
        <colgroup>
          <col class="p-nome"><col class="p-area"><col class="p-preco"><col class="p-un"><col class="p-vgv">
          ${dis ? nothing : html`<col class="p-acao">`}
        </colgroup>
        <thead>
          <tr>
            <th>Nome</th><th class="num">Área média do lote</th><th class="num">Preço de venda</th>
            <th class="num">Unidades</th><th class="num">VGV</th>
            ${dis ? nothing : html`<th></th>`}
          </tr>
        </thead>
        <tbody>
          ${this.produtos.map((p) => this._linhaProduto(p, dis))}
          <tr class="total">
            <td>Total</td><td></td><td></td>
            <td class="num">${fmtNum(unidades, 0)}</td>
            <td class="num">${fmtR$(vgv)}</td>
            ${dis ? nothing : html`<td></td>`}
          </tr>
        </tbody>
      </table>
      ${!dis ? html`
        <div class="acoes-topo">
          <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionarProduto}>
            Adicionar Produto
          </urbi-botao>
        </div>` : nothing}
    `;
  }

  private _linhaProduto(p: any, dis: boolean): TemplateResult {
    return html`
      <tr>
        <td class="nome">
          <urbi-input ?desabilitado=${dis} .valor=${p.nome || ''} placeholder="Ex.: Lote"
            @urbi:input-change=${(e: CustomEvent) => this._salvarProduto(p, { nome: e.detail.valor })}
          ></urbi-input>
        </td>
        <td class="num">
          <viab-num sufixo="m²" ?desabilitado=${dis}
            .valor=${p.area_media_m2 !== null && p.area_media_m2 !== undefined ? Number(p.area_media_m2) : null}
            @urbi:input-numero-change=${(e: CustomEvent) => this._salvarProduto(p, { area_media_m2: e.detail.valor })}
          ></viab-num>
        </td>
        <td class="num">
          <viab-num sufixo="R$/m²" ?desabilitado=${dis}
            .valor=${p.preco_venda_m2 !== null && p.preco_venda_m2 !== undefined ? Number(p.preco_venda_m2) : null}
            @urbi:input-numero-change=${(e: CustomEvent) => this._salvarProduto(p, { preco_venda_m2: e.detail.valor })}
          ></viab-num>
        </td>
        <td class="num">
          <viab-num casas-decimais="0" ?desabilitado=${dis}
            .valor=${p.unidades !== null && p.unidades !== undefined ? Number(p.unidades) : null}
            @urbi:input-numero-change=${(e: CustomEvent) => this._salvarProduto(p, { unidades: e.detail.valor })}
          ></viab-num>
        </td>
        <td class="num vgv-calc">${fmtR$(vgvProduto(p))}</td>
        ${dis ? nothing : html`
          <td class="num">
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
              @click=${() => { this.confirmRemoverProduto = p; }}></urbi-botao>
          </td>`}
      </tr>
    `;
  }

  private _adicionarProduto = async () => {
    try {
      const res = await criarProdutoPreliminar(this.estudo.id, { ordem: this.produtos.length });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar produto', 'erro'); return; }
      this.produtos = [...this.produtos, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar produto', 'erro');
    }
  };

  private async _salvarProduto(p: any, dados: Record<string, any>) {
    try {
      const res = await atualizarProdutoPreliminar(this.estudo.id, p.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar produto', 'erro'); return; }
      this.produtos = this.produtos.map((y) => (y.id === p.id ? { ...y, ...dados } : y));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar produto', 'erro');
    }
  }

  private _renderConfirmRemoverProduto(): TemplateResult {
    const c = this.confirmRemoverProduto!;
    return html`
      <urbi-modal title="Remover produto" maxWidth="420px" @urbi-modal:close=${() => this.confirmRemoverProduto = null}>
        <p>Remover o produto "${c?.nome || 'sem nome'}"?</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
          <urbi-botao variante="secundario" @click=${() => this.confirmRemoverProduto = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemoverProduto}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmarRemoverProduto = async () => {
    const c = this.confirmRemoverProduto!;
    this.confirmRemoverProduto = null;
    try {
      const res = await removerProdutoPreliminar(this.estudo.id, c.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover produto', 'erro'); return; }
      this.produtos = this.produtos.filter((y) => y.id !== c.id);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover produto', 'erro');
    }
  };

  // Área do terreno (mesma regra de proforma.ts/premissas-conversao.ts): do
  // Núcleo (soma das glebas) quando a origem é Núcleo, senão a manual.
  private _areaTerreno(): number {
    return this.form.origem_terreno === 'nucleo'
      ? (this._num('area_terreno_nucleo') ?? 0)
      : (this._num('terreno_manual_area') ?? 0);
  }

  private _estadosCascataAreasLot(): Record<string, EstadoLinha> {
    const estados: Record<string, EstadoLinha> = {};
    for (const [linhaId, campo] of Object.entries(CAMPO_POR_LINHA_LOT)) {
      const modoSchema = this.form[`${campo}_modo`] ?? 'm2';
      estados[linhaId] = {
        modo: MODO_SCHEMA_PARA_MOTOR[modoSchema] ?? 'm2',
        valor: this._num(`${campo}_valor`) ?? 0,
      };
    }
    return estados;
  }

  // Troca o campo mestre de uma linha da cascata (2026-08-03): o m² já
  // resolvido da linha (`linha.m2`, correto seja qual for o modo atual) é a
  // fonte da conversão — não há "campo destino" separado para preservar
  // (diferente de `_trocarUnidade`/`CustoUnidade`), é a MESMA coluna
  // reinterpretada, então não existe drift de ida-e-volta a evitar.
  private _trocarModoArea(campo: string, novoModoSchema: string, linha: LinhaResolvida, ancora1: number, ancora2: number | null) {
    const modoAtual = this.form[`${campo}_modo`] ?? 'm2';
    if (novoModoSchema === modoAtual) return;
    let novoValor: number;
    if (novoModoSchema === 'm2') novoValor = linha.m2;
    else if (novoModoSchema === 'pct_poligonal') novoValor = ancora1 > 0 ? (linha.m2 / ancora1) * 100 : 0;
    else novoValor = ancora2 != null && ancora2 > 0 ? (linha.m2 / ancora2) * 100 : 0;
    this._set(`${campo}_valor`, novoValor);
    this._set(`${campo}_modo`, novoModoSchema);
  }

  /**
   * §Tabela de áreas em cascata (2026-08-03, `padrao_areas.png`) — colunas
   * Descrição · (seletor sem título) · Área (m²) · ha · % Poligonal · %
   * Parcelável. A âncora 1 (Poligonal) é só exibida aqui — a edição dela é
   * a seção "Terreno" acima (origem Núcleo/manual, já existente).
   */
  private _renderTabelaAreasLoteamento(dis: boolean): TemplateResult {
    const ancora1 = this._areaTerreno();
    const linhas = calcularCascata(CASCATA_LOTEAMENTO, this._estadosCascataAreasLot(), ancora1);
    const ancora2 = linhas.find((l) => l.papel.tipo === 'computada' && l.papel.ehAncora2)?.m2 ?? null;
    return html`
      <div class="areas-wrap">
        <table class="areas">
          <thead>
            <tr>
              <th>Descrição</th><th></th>
              <th class="num">Área (m²)</th><th class="num">ha</th>
              <th class="num">% Poligonal</th><th class="num">% Parcelável</th>
            </tr>
          </thead>
          <tbody>
            ${linhas.map((l) => html`
              <tr class=${l.papel.tipo !== 'editavel' ? 'computada' : ''}>
                <td>${l.label}</td>
                <td>${this._renderSeletorArea(l, dis, ancora1, ancora2)}</td>
                <td class="num">${fmtNum(l.m2, 2)}</td>
                <td class="num">${fmtNum(l.ha, 4)}</td>
                <td class="num">${fmtPct(l.pctAncora1)}</td>
                <td class="num">${l.pctAncora2 === null ? '' : fmtPct(l.pctAncora2)}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
    `;
  }

  private _renderSeletorArea(l: LinhaResolvida, dis: boolean, ancora1: number, ancora2: number | null): TemplateResult {
    if (l.papel.tipo !== 'editavel') return html`${nothing}`;
    const campo = CAMPO_POR_LINHA_LOT[l.id];
    const modoAtual: string = this.form[`${campo}_modo`] ?? 'm2';
    const opcoes: { valor: string; rotulo: string }[] = [
      { valor: 'm2', rotulo: 'm²' },
      { valor: 'pct_poligonal', rotulo: '% Pol.' },
      ...(l.papel.permiteAncora2 ? [{ valor: 'pct_parcelavel', rotulo: '% Parc.' }] : []),
    ];
    const sufixo = modoAtual === 'm2' ? 'm²' : '%';
    return html`
      <div class="area-seletor" role="group" aria-label=${`Unidade de ${l.label}`}>
        ${opcoes.map((o) => html`
          <urbi-badge cor="info" interativo ?ativo=${o.valor === modoAtual} class=${dis ? 'cu-badge-dis' : ''}
            @click=${() => { if (!dis) this._trocarModoArea(campo, o.valor, l, ancora1, ancora2); }}
          >${o.rotulo}</urbi-badge>`)}
        <viab-num class="area-valor" sufixo=${sufixo} casas-decimais="2" ?desabilitado=${dis}
          .valor=${this._num(`${campo}_valor`)}
          @urbi:input-numero-change=${(e: CustomEvent) => this._set(`${campo}_valor`, e.detail.valor ?? 0)}
        ></viab-num>
      </div>
    `;
  }

  private _benchmark(campo: string): any { return this.benchmarks.find((b) => b.campo === campo); }

  // #7: detalhe de nº e preço médio por unidade, Residencial / Não residencial
  // (Incorporação). Mesmas métricas do motor exibidas na Proforma.
  private _unidadesTipo(p: Proforma): TemplateResult {
    if (p.numUnidadesResidencial === 0 && p.numUnidadesNaoResidencial === 0) return html``;
    const pmR = p.numUnidadesResidencial > 0 ? `${fmtR$(p.precoMedioUnidadeResidencial)}/un` : '—';
    const pmNR = p.numUnidadesNaoResidencial > 0 ? `${fmtR$(p.precoMedioUnidadeNaoResidencial)}/un` : '—';
    return html`
      <div class="unid-tipo">
        <div class="ut-item"><span class="ut-rot">Residencial</span><span class="ut-val">${fmtNum(p.numUnidadesResidencial)} un · ${pmR}</span></div>
        <div class="ut-item"><span class="ut-rot">Não residencial</span><span class="ut-val">${fmtNum(p.numUnidadesNaoResidencial)} un · ${pmNR}</span></div>
      </div>`;
  }

  private _renderResumo(lot: boolean): TemplateResult {
    const p = calcularProforma(this._entradaProforma());
    const kpis: { rot: string; val: string; variante: string }[] = [];
    // Texto colorido nos 3 níveis do velocímetro do benchmark (sem emoji; a bola
    // fica só nos badges da análise de sensibilidade, na Proforma).

    if (lot) {
      const ef = this._benchmark('eficiencia_aproveitamento');
      kpis.push(
        { rot: 'Área da gleba', val: `${fmtNum(p.areaTerreno)} m²`, variante: '' },
        { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²`, variante: '' },
        { rot: 'Vendável / gleba', val: fmtPct(p.eficienciaPct), variante: varianteFaixa(ef, p.eficienciaPct) },
        { rot: 'VGV', val: fmtR$(p.vgv), variante: '' },
        { rot: 'Nº de lotes', val: fmtNum(p.numUnidades), variante: '' },
        { rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), variante: '' },
      );
    } else {
      const co = this._benchmark('custo_obras_vgv');
      const ml = this._benchmark('margem_liquida');
      kpis.push(
        { rot: 'Área privativa total', val: `${fmtNum(p.areaPrivativa)} m²`, variante: '' },
        { rot: 'Área construída', val: `${fmtNum(p.areaConstruida)} m²`, variante: '' },
        { rot: 'Nº de unidades', val: fmtNum(p.numUnidades), variante: '' },
        { rot: 'Preço médio/unid.', val: fmtR$(p.precoMedioUnidade), variante: '' },
        { rot: 'Custo obras / VGV', val: fmtPct(p.custoObrasVgvPct), variante: varianteFaixa(co, p.custoObrasVgvPct) },
        { rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), variante: varianteFaixa(ml, p.margemLiquidaPct) },
      );
    }

    const piso = this._benchmark('resultado_final');
    let precoSug: number | null = null;
    if (piso && Number(piso.valor) > 0) precoSug = precoSugeridoM2(this._entradaProforma(), Number(piso.valor));

    return html`
      <urbi-card titulo="Resumo">
        <div class="kpis">
          ${kpis.map((k) => html`
            <urbi-kpi rotulo=${k.rot} .valor=${k.val} variante=${k.variante}></urbi-kpi>
          `)}
        </div>
        ${!lot ? this._unidadesTipo(p) : nothing}
        ${piso
          ? html`<urbi-banner variante="info">
              Preço sugerido/m² para atingir o piso de resultado final (${fmtPctEntrada(Number(piso.valor))}):
              <strong>${precoSug !== null ? fmtR$(precoSug) + '/m²' : 'inatingível com as premissas atuais'}</strong>
            </urbi-banner>`
          : html`<p class="sec">Defina o benchmark “resultado_final” para calcular o preço sugerido/m².</p>`}
      </urbi-card>
    `;
  }

  private _salvar = async () => {
    // Bloqueia o salvamento se houver obrigatórios não preenchidos (≠ vazio e ≠ 0).
    const { erros, faltando } = validarObrigatorios(this.form, this.estudo.tipo_empreendimento, this.produtos);
    this.erros = erros;
    if (faltando.length > 0) {
      this.erroGeral = `Preencha os campos obrigatórios: ${faltando.join(', ')}.`;
      urbiVerso.notificar('Há campos obrigatórios não preenchidos.', 'erro');
      return;
    }
    this.erroGeral = '';
    this.salvando = true;
    try {
      const dados: Record<string, any> = {};
      for (const [k, v] of Object.entries(this.form)) {
        if (['id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id', 'criado_em', 'atualizado_em',
          'removido_em', 'removido_por_id',
          'membros', 'imoveis', '_permissao', '_funcao', 'autor_nome', 'autor_avatar_url'].includes(k)) continue;
        if (TODOS_NUM.has(k)) dados[k] = v === '' || v == null ? null : Number(v);
        else dados[k] = v;
      }
      const res = await atualizarEstudo(this.estudo.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this._snapshot = { ...this.form };
      this._dirty = false;
      urbiVerso.notificar('Premissas salvas.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvando = false;
    }
  };
}

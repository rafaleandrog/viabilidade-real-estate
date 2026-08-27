import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct, fmtPctOuIndef, celula, negativoContabil } from './viab-format.js';
import { urbiVerso, listarBenchmarks, buscarConfig, listarProdutosPreliminar } from './viabilidade-api.js';
import { calcularProforma, vgvProduto, type Proforma, type ProformaInput, type VariavelSensibilidade } from './proforma.js';
import { exportarPDF, exportarExcel, avisoPermutaCapada } from './exportar.js';
import { bolaFaixa, varianteFaixa } from './medidor-faixas.js';

// `tipo` dá a categoria visual (#3): receita | consolidado | resultado;
// ausente = item comum (sub-linha discreta). `grupo` marca sub-linhas
// colapsáveis (#2); `toggle` marca a linha-total que colapsa aquele grupo.
// BUG7-10: 'receita' colapsa a Receita bruta (VGV) por tipo de unidade
// cadastrada no catálogo de Produtos, mesmo padrão dos grupos de custo.
type Grupo = 'receita' | 'deducoes' | 'direto' | 'indireto';
export interface Linha {
  l: string; v: number;
  tipo?: 'receita' | 'consolidado' | 'resultado';
  natureza?: 'receita';   // #74: consolidado de receita (fundo verde)
  grupo?: Grupo;          // #9: sub-linha colapsável do grupo cujo total é o header
  toggle?: Grupo;         // #9: linha-total (header) que colapsa o grupo abaixo dela
  semPermuta?: boolean;   // #10: linha "VGV sem permuta" (itálico, sub-linha de contexto)
  memo?: string;          // #8: descrição da conta, na 2ª coluna (menor, itálico)
  soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean;
}

// #567: receita (VGV, sub-linhas de produto, consolidados marcados
// `natureza: 'receita'`) e resultado mostram o SINAL REAL — negativo entre
// parênteses, positivo sem marca nenhuma. Toda outra linha (custo/dedução,
// inclusive os headers `tipo: 'consolidado'` sem `natureza`, como "Custo
// direto total") é notação contábil pura: SEMPRE entre parênteses,
// independente do sinal — a app grava custo como valor positivo. Pura e
// exportada para ser testável: era decidido inline dentro de dois métodos
// privados que nenhum teste tocava.
export function ehLinhaReceitaOuResultado(r: Pick<Linha, 'tipo' | 'natureza'>): boolean {
  return r.tipo === 'receita' || r.natureza === 'receita' || r.tipo === 'resultado';
}

// Coluna R$ da Proforma: delega para `celula` (frontend/viab-format.ts) —
// fonte única de 2 casas decimais (C7) e da regra de parênteses
// (`negativoContabil`), a mesma que o Fluxo de Caixa usa. `sempreExibir`
// porque a Proforma controla visibilidade por LINHA (`ocultarSeZero` no
// `Linha`), não por célula perto de zero como o Fluxo de Caixa — um header
// como "Custo indireto total" que fecha em zero precisa mostrar "(0,00)",
// não sumir.
export function celulaProforma(r: Pick<Linha, 'v' | 'tipo' | 'natureza'>): string {
  return celula(r.v, { comParenteses: true, custo: !ehLinhaReceitaOuResultado(r), sempreExibir: true });
}

// Coluna R$/m²: mesma decisão de sinal (`negativoContabil`) que `celula`
// usa — mas com a formatação numérica própria da coluna (`fmtNum`, sem "R$"
// e sem "/m²": a unidade já está no cabeçalho "R$/m²"). #9/#33.
export function celulaProformaM2(r: Pick<Linha, 'v' | 'tipo' | 'natureza'>, areaVendavel: number): string {
  if (areaVendavel <= 0) return '—';
  const abs = fmtNum(Math.abs(r.v / areaVendavel));
  return negativoContabil(r.v, !ehLinhaReceitaOuResultado(r)) ? `(${abs})` : abs;
}

// BUG7-08: mesmo conjunto de variáveis estressáveis que o motor resolve —
// reexportado como alias em vez de duplicar a união (proforma.ts é a fonte).
type VarSens = VariavelSensibilidade;

// #11: cada linha da tabela de cenários é receita ou despesa — é o que colore o
// rótulo e o fundo da linha. #568: é também o que decide a NOTAÇÃO da célula,
// no lugar do par `tipo`/`natureza` da tabela principal.
export type NaturezaSensibilidade = 'receita' | 'despesa';

/**
 * #568 — célula monetária da tabela de CENÁRIOS.
 *
 * Delega para `celulaProforma`, a mesma função da tabela principal: despesa
 * SEMPRE entre parênteses (a app grava custo como valor positivo), receita e
 * resultado com o SINAL REAL. Antes desta issue a sensibilidade formatava com
 * `fmtR$` cru — negativo saía com sinal de menos enquanto a tabela principal o
 * mostrava entre parênteses, e as duas discordavam por construção sobre a mesma
 * grandeza. Os dois parâmetros são obrigatórios: `natureza` esquecida vira erro
 * de compilação, não uma célula que silenciosamente troca de convenção.
 */
export function celulaSensibilidade(v: number, natureza: NaturezaSensibilidade): string {
  return celulaProforma({ v, natureza: natureza === 'receita' ? 'receita' : undefined });
}

/**
 * #568 — classe de sinal da célula de cenário, espelhando a da tabela principal
 * (`_renderTabela`): só linha de RECEITA/resultado ganha `pos`/`neg`; despesa
 * fica sem classe e mantém a cor do cenário. É `neg` que sobrepõe o verde do
 * Base num cenário deficitário — a mesma decisão da #567, que recusou pintar de
 * "receita boa" um valor negativo.
 */
export function sinalSensibilidade(v: number, natureza: NaturezaSensibilidade): '' | 'pos' | 'neg' {
  return natureza === 'receita' ? (v < 0 ? 'neg' : 'pos') : '';
}

@customElement('viab-tela-proforma')
export class ViabTelaProforma extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  // Sub-aba (2026-08-03, reestruturação do Preliminar → "Resultado"): qual
  // seção mostrar. Mesmo padrão de tela-premissas.ts — uma instância só,
  // `slot` reatribuído dinamicamente pelo pai.
  @property({ type: String }) secao: 'proforma' | 'cenarios' = 'proforma';

  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  @state() private varSens: VarSens = 'preco';
  // #9: grupos consolidados colapsados (default: expandido). O total é o header.
  @state() private colapso: Record<Grupo, boolean> = { receita: false, deducoes: false, direto: false, indireto: false };
  // BUG7-10: catálogo de Produtos, para as sub-linhas de Receita bruta (VGV).
  @state() private produtos: any[] = [];

  static styles = [estiloConteudo, css`
    /* BUG7-09: com o KPI de Preço médio/unid. removido, sobram 3-5 cards —
       minmax(180px, 1fr) os esticava até preencher a linha toda numa tela
       larga. Teto em 220px: cada card fica compacto e o espaço sobrando
       após o último vira respiro em vez de alargar os existentes. */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 220px)); gap: 12px; margin-bottom: 16px; }
    .kpis urbi-kpi { min-width: 0; }
    /* Aviso do excedente de permuta: acima da tabela, dentro do card. */
    urbi-banner.aviso-permuta { display: block; margin-bottom: 14px; }
    /* Mesmo respiro do estado vazio do catálogo em Premissas → Produtos. */
    .pf-vazio { padding: 8px 0; }
    .barra-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; justify-content: flex-end; }
    .sens-var { max-width: 320px; margin-bottom: 12px; }
    urbi-card + urbi-card { margin-top: 16px; }
    strong.total { color: var(--cor-texto-forte, rgba(255,255,255,0.95)); }

    /* #3: tabela da Proforma com 4 tipos de linha, só cores do design system. */
    .pf-wrap { overflow-x: auto; }
    table.pf { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 0.85rem; }
    .pf th, .pf td { padding: 8px 10px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); }
    /* Cabeçalhos maiores e centralizados; a coluna Descrição fica à esquerda. */
    .pf th {
      text-align: center; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .pf th.desc { text-align: left; }
    .pf th.num { text-align: center; }
    .pf td { text-align: left; color: var(--cor-texto, rgba(255,255,255,0.85)); }
    .pf .num { text-align: right; white-space: nowrap; }
    .toggle {
      background: none; border: none; color: inherit; cursor: pointer;
      font-size: 0.85rem; line-height: 1; padding: 0 8px 0 0; width: 20px;
    }
    /* Tipo 1 — Receita (identidade UP: azul primária). #10: mesmo peso/tamanho/
       destaque da linha Resultado (bold, maior, com fundo), mantendo a cor azul
       que a distingue do Resultado. */
    .pf tr.receita td {
      color: var(--cor-primaria-solida, #2AA9E0); font-weight: 800; font-size: 1.05rem;
      background: var(--cor-primaria-fundo, rgba(42,169,224,0.12));
    }
    /* Tipo 2 — Consolidado (bold + fundo de destaque). */
    .pf tr.consolidado td {
      font-weight: 700; background: var(--cor-superficie-hover, rgba(255,255,255,0.08));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
    }
    /* #74 — Receita líquida e operacional: fundo verde (consolidado de receita). */
    .pf tr.consolidado.nat-receita td {
      background: color-mix(in srgb, var(--cor-sucesso) 14%, transparent);
      color: var(--cor-sucesso);
    }
    /* #567 — mesma linha, mas NEGATIVA (ex.: Receita operacional num estudo
       deficitário): o verde fixo acima mentiria que é receita "boa". A classe
       td.neg (mesma que já marca o Resultado negativo) sobrepõe pela
       especificidade — precisa vir DEPOIS da regra acima. */
    .pf tr.consolidado.nat-receita td.neg {
      background: color-mix(in srgb, var(--cor-erro) 14%, transparent);
      color: var(--cor-erro);
    }
    /* Tipo 3 — Resultado final (bold + grande + highlight forte). #13: espaço extra
       acima, separando o Resultado da última linha de custos (onde saiu o memo). */
    .pf tr.resultado td {
      font-weight: 800; font-size: 1.05rem; background: var(--cor-primaria-fundo, rgba(42,169,224,0.12));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
      padding-top: 14px; border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    .pf tr.resultado td.pos { color: var(--cor-sucesso, #13A98D); }
    .pf tr.resultado td.neg { color: var(--cor-erro, #D45A3A); }
    /* Tipo 4 — Itens/sub-linhas (discreto/neutro). */
    .pf tr.item td { color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
    /* #8/#73 — "VGV sem permuta": itálico + fundo neutro diferenciado. */
    .pf tr.italico td { font-style: italic; background: var(--cor-superficie, rgba(255,255,255,0.04)); }
    /* #8 — 2ª coluna de descrição da conta: texto menor e itálico, cinza; o
       padding da célula garante o respiro (não cola no título). */
    .pf td.desc {
      font-style: italic; font-size: 0.72rem; max-width: 340px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    /* #34: indicadores da sensibilidade numa tabela separada com espaçamento. */
    .sens-indicadores { margin-top: 20px; }
    /* #11 — distinção receita × despesa: cor do rótulo (1ª coluna) + fundo da
       linha, exclusivamente por tokens do design system (color-mix mantém o
       token, sem cor literal). */
    .pf.sens tr.nat-receita td:first-child { color: var(--cor-sucesso); font-weight: 600; }
    .pf.sens tr.nat-despesa td:first-child { color: var(--cor-erro); font-weight: 600; }
    .pf.sens tr.nat-receita { background: color-mix(in srgb, var(--cor-sucesso) 8%, transparent); }
    .pf.sens tr.nat-despesa { background: color-mix(in srgb, var(--cor-erro) 8%, transparent); }
    /* Badges dos cenários (cabeçalho) e dos indicadores, alinhados à direita na
       coluna (BUG7-12 — antes centralizados). */
    .pf.sens .sens-cab { display: flex; justify-content: flex-end; }
    .pf.sens td .sens-cab { padding: 2px 0; }
    /* #78 — larguras fixas por colgroup (mesma geometria nas duas tabelas de
       sensibilidade: monetária e indicadores) para os cenários bear/base/bull
       alinharem entre si. */
    .pf.sens { table-layout: fixed; }
    /* BUG7-12 — cabeçalho (badge via .sens-cab, acima) e valores alinhados à
       direita, como o resto do app; sobrepõe o '.pf th.num { text-align: center }'
       genérico (usado pela tabela principal do Proforma) só dentro de '.pf.sens'. */
    .pf.sens th.num { text-align: right; }
    /* #76 — valores da sensibilidade em negrito. */
    .pf.sens td.num { font-weight: 700; text-align: right; }
    /* #11 — os NÚMEROS na cor do cenário. #568: por classe, e não mais por
       atributo style inline: declaração inline vence qualquer seletor, e a
       marca de negativo abaixo precisa poder sobrepô-la. (Sem crase neste
       bloco: ele mora dentro do template literal do css.) */
    .pf.sens td.num.cen-bear { color: var(--cor-erro, #D45A3A); }
    .pf.sens td.num.cen-base { color: var(--cor-sucesso, #13A98D); }
    .pf.sens td.num.cen-bull { color: var(--cor-info, #2AA9E0); }
    /* #568/#567 — receita ou resultado REALMENTE negativo: vermelho, sobrepondo
       a cor do cenário (o verde do Base mentiria "receita boa" num cenário
       deficitário — a mesma decisão que a #567 tomou na tabela principal).
       Mesma especificidade das três regras acima: vence por vir DEPOIS. */
    .pf.sens td.num.neg { color: var(--cor-erro, #D45A3A); }
    /* #11 — unidades e preço médio por tipo. */
    .unid-tipo { display: flex; gap: 28px; flex-wrap: wrap; }
    .ut-item { display: flex; flex-direction: column; gap: 2px; }
    .ut-rot {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .ut-val { font-size: 0.95rem; color: var(--cor-texto-forte, rgba(255,255,255,0.95)); font-variant-numeric: tabular-nums; }
  `];

  private _idCarregado: number | null = null;

  connectedCallback() { super.connectedCallback(); this._init(); }
  updated(ch: Map<string, unknown>) {
    // Recarrega benchmarks só quando muda o estudo; edições ao vivo de Premissas
    // (#6) só atualizam os números, não os benchmarks.
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  private async _init() {
    if (!this.estudo) return;
    this._idCarregado = this.estudo.id ?? null;
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

  private _entrada(over: Partial<ProformaInput> = {}): ProformaInput {
    return { ...this.estudo, aliquota_ret_pct: this.aliquotaRet, produtos: this.produtos, ...over } as ProformaInput;
  }
  private _bm(campo: string) { return this.benchmarks.find((b) => b.campo === campo); }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    // #10/BUG7-07: VGV bruto = VGV se a permuta física (R e NR) NÃO fosse
    // entregue (vendida). Antes rodava o motor de novo zerando só os campos
    // LEGADOS de permuta — mas o motor prioriza o canônico
    // (permuta_fisica_area_canonica/_nr_area_canonica, proforma.ts:252), que
    // ficava fora do override e o tornava um no-op (vgvBruto === p.vgv em
    // qualquer estudo editado depois da introdução do canônico). Mesma
    // identidade que exportar.ts:39 já usa (fonte única, sem 2ª execução), e
    // ela continua fechando com o cap: as duas permutas do resultado são as
    // EFETIVAS, então a soma reconstrói a base sem estourá-la.
    const vgvBruto = p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
    return html`
      ${this.secao === 'proforma'
        ? (p.semProdutos ? this._renderSemProdutos() : html`
        ${this._renderKpis(p)}
        ${!lot ? this._renderUnidadesTipo(p) : nothing}
        <urbi-card titulo="Proforma">
          ${this._renderAvisoPermuta(p)}
          ${this._renderTabela(p, lot, vgvBruto)}
          <div class="barra-acoes">
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-excel" @click=${() => this._exportar('excel')}>Exportar Excel</urbi-botao>
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-pdf" @click=${() => this._exportar('pdf')}>Exportar PDF</urbi-botao>
          </div>
        </urbi-card>
      `)
        : nothing}
      ${this.secao === 'cenarios' ? this._renderSensibilidade(lot) : nothing}
    `;
  }

  // Estado vazio: sem catálogo de Produtos que componha VGV não há receita
  // modelada, e a Proforma inteira (KPIs e tabela) sairia zerada. Mostrar a
  // tabela nessa condição era pior que nada — ela vinha preenchida a partir dos
  // pares legados de área × preço, que não têm campo em tela nenhuma e por isso
  // ninguém consegue conferir nem corrigir.
  private _renderSemProdutos(): TemplateResult {
    return html`<urbi-card titulo="Proforma">
      <div class="pf-vazio">
        <urbi-estado-vazio icone="fa-solid fa-boxes-stacked"
          mensagem="Nenhum produto com área, preço e unidades cadastrado."
          submensagem="A Proforma sai do catálogo de Produtos: preencha as três colunas em Premissas → Produtos para ver VGV, custos e resultado."
        ></urbi-estado-vazio>
      </div>
    </urbi-card>`;
  }

  // Aviso do corte de permuta física. `permutaCapada` só é verdade quando a
  // permuta pedida vale mais que a base — e nesse caso o VGV vai a zero, o que
  // sem aviso pareceria erro de digitação em vez de excedente.
  //
  // A frase vem de `avisoPermutaCapada`, a MESMA que o CSV e o PDF imprimem:
  // banner e exportação divergirem sobre o corte foi o defeito que a revisão
  // apontou. Ela declara os m² informados de propósito — as áreas NÃO são
  // capadas (o KPI "Área permutada" e a memo por linha seguem o que foi
  // digitado), e um aviso que só falasse de dinheiro deixaria o leitor com uma
  // área grande ao lado de um VGV zerado, sem ligar as duas coisas. O que a
  // tela acrescenta é só a orientação de onde corrigir.
  private _renderAvisoPermuta(p: Proforma): TemplateResult {
    if (!p.permutaCapada) return html``;
    return html`
      <urbi-banner class="aviso-permuta" variante="alerta">
        ${avisoPermutaCapada(p)}
        Reveja a área permutada em Premissas → Permutas ou o catálogo em Premissas → Produtos.
      </urbi-banner>`;
  }

  private _renderKpis(p: Proforma): TemplateResult {
    const co = this._bm('custo_obras_vgv');
    const ml = this._bm('margem_liquida');
    const temPermuta = p.areaPermutaFisica > 0 || p.permutaFinResidencial > 0 || p.permutaFinNaoResidencial > 0;
    const kpis: { rot: string; val: string; variante: string }[] = [
      { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²`, variante: '' },
      { rot: 'Nº de unidades', val: fmtNum(p.numUnidades), variante: '' },
    ];
    if (temPermuta) kpis.push({ rot: 'Área permutada', val: `${fmtNum(p.areaPermutaFisica)} m²`, variante: '' });
    // Texto colorido nos 3 níveis do velocímetro do benchmark (sem emoji; a bola
    // fica só nos badges da análise de sensibilidade).
    // #571: VGV ≤ 0 (ex.: permuta física capa 100% da base) — os dois vêm
    // `null` do motor, e `fmtPctOuIndef` mostra "—", nunca "0,0%".
    kpis.push({ rot: 'Custo obras / VGV', val: fmtPctOuIndef(p.custoObrasVgvPct), variante: varianteFaixa(co, p.custoObrasVgvPct) });
    kpis.push({ rot: 'Margem sobre VGV', val: fmtPctOuIndef(p.margemLiquidaPct), variante: varianteFaixa(ml, p.margemLiquidaPct) });
    return html`<div class="kpis">
      ${kpis.map((k) => html`<urbi-kpi rotulo=${k.rot} .valor=${k.val} variante=${k.variante}></urbi-kpi>`)}
    </div>`;
  }

  private _linhas(p: Proforma, vgvBruto: number): Linha[] {
    // #8: cada linha de custo/dedução ganha uma descrição (memo) com a conta que
    // a define, a partir das Premissas — exibida na 2ª coluna.
    const e = this.estudo;
    const lot = e.tipo_empreendimento === 'loteamento';
    const pct = (v: any) => `${fmtNum(Number(v) || 0, 2)}%`;
    const rsm2 = (v: any) => `${fmtR$(Number(v) || 0)}/m²`;
    const impostoMemo = e.sujeito_ret ? `RET ${pct(this.aliquotaRet)}` : `${pct(e.imposto_percentual)} do VGV`;
    const terrenoMemo = e.considerar_custo_terreno === false
      ? 'desconsiderado'
      : `${rsm2(e.custo_terreno_m2)} × ${fmtNum(p.areaTerreno)} m²`;
    const projetosMemo = e.projetos_modo === 'valor_fixo' ? 'valor fixo' : `${pct(e.projetos_pct)} do VGV`;
    const infraMemo = e.infra_modo === 'valor_m2' ? `${rsm2(e.custo_infra_m2)} × área vendável`
      : e.infra_modo === 'valor_fixo' ? 'valor fixo'
      : `${pct(e.infra_pct)} do VGV`;
    const construcaoMemo = e.construcao_modo === 'valor_total' ? 'valor total' : `${rsm2(e.custo_construcao_m2)} × área privativa`;
    const permutaFinRMemo = e.permuta_financeira_residencial_modo === 'valor_fixo' ? 'valor fixo' : `${pct(e.permuta_financeira_residencial_pct)} do VGV res.`;
    const permutaFinNRMemo = e.permuta_financeira_nao_residencial_modo === 'valor_fixo' ? 'valor fixo' : `${pct(e.permuta_financeira_nao_residencial_pct)} do VGV n/res.`;
    // #10: descrição da permuta física — m² entregues e % da área privativa total.
    const permMemo = (area: number) => p.areaPrivativa > 0
      ? `${fmtNum(area)} m² · ${fmtPct(area / p.areaPrivativa * 100)} da área privativa total`
      : `${fmtNum(area)} m²`;
    const deducoesVgv = p.imposto + p.corretagem + p.marketing + p.permutaFinResidencial + p.permutaFinNaoResidencial;

    const linhas: Linha[] = [];
    // BUG7-10: Receita bruta (VGV) primeiro — header colapsável, com uma
    // sub-linha por produto do catálogo (mesmo padrão dos grupos de custo).
    // O bloco de permuta física (context) vem DEPOIS do header, não antes —
    // o colapso pressupõe sub-linhas depois; permuta continua fora do grupo
    // 'receita' (é dedução do bruto, não parte da composição por unidade).
    linhas.push({ l: 'Receita bruta (VGV)', v: p.vgv, tipo: 'receita', toggle: 'receita' });
    for (const produto of this.produtos) {
      linhas.push({
        l: produto.nome || `Produto ${produto.id}`, v: vgvProduto(produto),
        grupo: 'receita', natureza: 'receita', ocultarSeZero: true,
      });
    }
    // #10: bloco de permuta física (só quando houver) — entre a Receita bruta
    // e as Deduções sobre VGV. Residencial e Não Residencial separados.
    if (p.areaPermutaFisica > 0) {
      linhas.push({ l: 'VGV sem permuta física', v: vgvBruto, semPermuta: true, ocultarSeZero: true });
      linhas.push({ l: lot ? '(-) Permuta física' : '(-) Permuta física residencial', v: p.vgvPermutaResidencial, ocultarSeZero: true, memo: permMemo(p.areaPermutaResidencial) });
      linhas.push({ l: '(-) Permuta física não residencial', v: p.vgvPermutaNaoResidencial, soInc: true, ocultarSeZero: true, memo: permMemo(p.areaPermutaNaoResidencial) });
    }
    // #9: "Deduções sobre VGV" consolida imposto+corretagem+marketing+permuta fin.,
    // como header colapsável logo abaixo da Receita bruta.
    linhas.push({ l: '= Deduções sobre VGV', v: deducoesVgv, tipo: 'consolidado', toggle: 'deducoes' });
    linhas.push({ l: '(-) Imposto', v: p.imposto, grupo: 'deducoes', ocultarSeZero: true, memo: impostoMemo });
    linhas.push({ l: '(-) Corretagem', v: p.corretagem, grupo: 'deducoes', ocultarSeZero: true, memo: `${pct(e.corretagem_percentual)} do VGV` });
    linhas.push({ l: '(-) Marketing', v: p.marketing, grupo: 'deducoes', ocultarSeZero: true, memo: `${pct(e.marketing_percentual)} do VGV` });
    linhas.push({ l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, grupo: 'deducoes', ocultarSeZero: true, memo: permutaFinRMemo });
    linhas.push({ l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, grupo: 'deducoes', ocultarSeZero: true, memo: permutaFinNRMemo });
    linhas.push({ l: '= Receita líquida', v: p.receitaLiquida, tipo: 'consolidado', natureza: 'receita' });
    // #9: totais de custo invertidos — o total é o header do grupo colapsável.
    linhas.push({ l: '= Custo direto total', v: p.custoDiretoTotal, tipo: 'consolidado', toggle: 'direto' });
    linhas.push({ l: '(-) Terreno', v: p.custoTerreno, grupo: 'direto', ocultarSeZero: true, memo: terrenoMemo });
    linhas.push({ l: '(-) Projetos e aprovação', v: p.projetos, grupo: 'direto', ocultarSeZero: true, memo: projetosMemo });
    linhas.push({ l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true, grupo: 'direto', ocultarSeZero: true, memo: infraMemo });
    linhas.push({ l: '(-) Outorga', v: p.outorga, soInc: true, grupo: 'direto', ocultarSeZero: true });
    linhas.push({ l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: `${pct(e.incorporacao_registro_pct)} do VGV` });
    linhas.push({ l: '(-) Construção', v: p.construcao, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: construcaoMemo });
    linhas.push({ l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: `${pct(e.taxa_gestao_pct)} das obras` });
    linhas.push({ l: '(-) Decoração', v: p.decoracao, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: `${rsm2(e.custo_decoracao_m2)} × área privativa` });
    linhas.push({ l: '(-) Manutenção pós-obra', v: p.manutencao, grupo: 'direto', ocultarSeZero: true, memo: `${pct(e.manutencao_pct)} do VGV` });
    linhas.push({ l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true, grupo: 'direto', memo: `${pct(e.contingencias_pct)} do VGV` });
    // Receita operacional = receita líquida − custo direto total (antes dos indiretos).
    linhas.push({ l: '= Receita operacional', v: p.receitaOperacional, tipo: 'consolidado', natureza: 'receita' });
    linhas.push({ l: '= Custo indireto total', v: p.custoIndiretoTotal, tipo: 'consolidado', toggle: 'indireto' });
    linhas.push({ l: '(-) Marketing global e estrutura', v: p.marketingGlobal, grupo: 'indireto', ocultarSeZero: true, memo: `${pct(e.marketing_global_pct)} do VGV${lot ? ' + stand' : ''}` });
    // #13: rename "Gestão e outros indiretos" → "…custos indiretos".
    linhas.push({ l: '(-) Gestão e outros custos indiretos', v: p.gestaoIndiretos, grupo: 'indireto', ocultarSeZero: true, memo: `${pct(e.gestao_indiretos_pct)} do VGV` });
    // #13: removida a linha "(memo) Permuta física entregue".
    linhas.push({ l: '= Resultado', v: p.resultado, tipo: 'resultado' });
    return linhas;
  }

  private _toggle(g: Grupo) {
    this.colapso = { ...this.colapso, [g]: !this.colapso[g] };
  }

  // % VGV: no Resultado é a margem (com sinal); nas demais (inclusive "VGV sem
  // permuta" do #8), magnitude sobre o VGV da Receita bruta — nunca sobre si.
  private _pctVgv(r: Linha, p: Proforma): string {
    if (p.vgv <= 0) return '—';
    return r.tipo === 'resultado'
      ? fmtPct(r.v / p.vgv * 100)
      : fmtPct(Math.abs(r.v) / p.vgv * 100);
  }

  private _renderTabela(p: Proforma, lot: boolean, vgvBruto: number): TemplateResult {
    const linhas = this._linhas(p, vgvBruto).filter((r) =>
      !(r.soLot && !lot) && !(r.soInc && lot)
      && !(r.ocultarSeZero && Math.abs(r.v) < 0.005)
      && !(r.grupo && this.colapso[r.grupo]));   // #9: esconde sub-linhas do grupo colapsado
    return html`
      <div class="pf-wrap">
        <table class="pf">
          <thead>
            <tr><th></th><th class="desc">Descrição</th><th class="num">R$</th><th class="num">R$/m²</th><th class="num">% VGV</th></tr>
          </thead>
          <tbody>
            ${linhas.map((r) => {
              const cls = `${r.tipo ?? 'item'}${r.semPermuta ? ' italico' : ''}${r.natureza ? ` nat-${r.natureza}` : ''}`;
              // #567: marca de negativo (parênteses + classe `neg`) vale para
              // toda linha de receita/resultado — antes só `tipo: 'resultado'`
              // ganhava a classe, e "Receita líquida"/"Receita operacional"
              // (`natureza: 'receita'`) num estudo deficitário ficavam sem
              // nenhuma marca visual mesmo exibindo o valor negativo.
              const sinal = ehLinhaReceitaOuResultado(r) ? (r.v < 0 ? 'neg' : 'pos') : '';
              return html`<tr class=${cls}>
                <td>
                  ${r.toggle
                    ? html`<button class="toggle" title="Expandir/recolher"
                        @click=${() => this._toggle(r.toggle!)}>${this.colapso[r.toggle!] ? '▸' : '▾'}</button>`
                    : nothing}
                  ${r.l}
                </td>
                <td class="desc">${r.memo ?? ''}</td>
                <td class="num ${sinal}">${celulaProforma(r)}</td>
                <td class="num ${sinal}">${celulaProformaM2(r, p.areaVendavel)}</td>
                <td class="num ${sinal}">${this._pctVgv(r, p)}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  // #7/#11: unidades e preço médio por tipo (Residencial / Não residencial),
  // direto do motor (fonte única, também usada na Premissas).
  private _renderUnidadesTipo(p: Proforma): TemplateResult {
    const qR = p.numUnidadesResidencial;
    const qNR = p.numUnidadesNaoResidencial;
    if (qR === 0 && qNR === 0) return html``;
    const pmR = qR > 0 ? `${fmtR$(p.precoMedioUnidadeResidencial)}/un` : '—';
    const pmNR = qNR > 0 ? `${fmtR$(p.precoMedioUnidadeNaoResidencial)}/un` : '—';
    return html`<urbi-card titulo="Unidades e preço médio por tipo">
      <div class="unid-tipo">
        <div class="ut-item"><span class="ut-rot">Residencial</span><span class="ut-val">${fmtNum(qR)} un · ${pmR}</span></div>
        <div class="ut-item"><span class="ut-rot">Não residencial</span><span class="ut-val">${fmtNum(qNR)} un · ${pmNR}</span></div>
      </div>
    </urbi-card>`;
  }

  private _variaveis(lot: boolean): { valor: VarSens; rotulo: string }[] {
    return [
      { valor: 'preco', rotulo: lot ? 'Preço/m² de venda' : 'Preço/m² (res + não res)' },
      { valor: 'permuta_fisica', rotulo: 'Permuta física' },
      { valor: 'permuta_financeira', rotulo: 'Permuta financeira' },
      lot ? { valor: 'custo_infra' as VarSens, rotulo: 'Custo de infraestrutura' } : { valor: 'custo_obras' as VarSens, rotulo: 'Custo de obras' },
    ];
  }

  // BUG7-08: antes escalava campos legados por variável/modo (frágil — o
  // motor prioriza o canônico quando existe, então escalar só o legado virava
  // no-op, e alguns modos sequer eram cobertos: custo_obras nunca escalava
  // construcao_valor_total; custo_infra não cobria infra_valor_fixo). Agora o
  // fator é parâmetro de calcularProforma, que escala o valor JÁ RESOLVIDO
  // (canônico ou legado, qualquer modo) num lugar só — ver proforma.ts.
  private _aplicarFator(fator: number): ProformaInput {
    return this._entrada({ sensibilidade: { variavel: this.varSens, fator } });
  }

  // Variável estressada (VarSens) → `campo` do indicador de sensibilidade no
  // benchmark. custo_infra (loteamento) e custo_obras (incorporação) compartilham
  // o mesmo indicador "custo_obras".
  private _campoSensibilidade(v: VarSens): string {
    return v === 'preco' ? 'preco'
      : v === 'permuta_fisica' ? 'permuta_fisica'
      : v === 'permuta_financeira' ? 'permuta_financeira'
      : 'custo_obras';
  }

  private _renderSensibilidade(lot: boolean): TemplateResult {
    // A variação +/- vem do indicador de sensibilidade do benchmark (por variável),
    // não mais de um par único do estudo. Sem benchmark → fallback 10%.
    const bmSens = this.benchmarks.find((b) => b.campo === this._campoSensibilidade(this.varSens));
    const varPos = Number(bmSens?.variacao_positiva_pct) || 10;
    const varNeg = Number(bmSens?.variacao_negativa_pct) || 10;
    // Bull = cenário otimista (melhor resultado); Bear = pessimista. Para o
    // PREÇO, otimista é preço maior. Para variáveis de CUSTO/permuta (que pioram
    // o resultado quando sobem), o Bull é uma REDUÇÃO — a conta é invertida
    // em relação ao preço (bug #13).
    const custoLike = this.varSens !== 'preco';
    const fatorBull = custoLike ? 1 - varPos / 100 : 1 + varPos / 100;
    const fatorBear = custoLike ? 1 + varNeg / 100 : 1 - varNeg / 100;
    // VGV bruto por cenário = VGV se a permuta física NÃO fosse entregue (vendida).
    // Difere da Receita bruta (VGV) só quando há permuta física. BUG7-07: mesma
    // omissão do canônico corrigida acima em vgvBruto — aqui, em vez de rodar o
    // motor de novo com os campos legados zerados (no-op quando há canônico),
    // deriva-se do próprio Proforma já calculado do cenário (mesma identidade
    // de exportar.ts:39), sem 2ª execução.
    const proforma = (fator: number) => calcularProforma(this._aplicarFator(fator));
    const vgvBrutoDe = (cen: Proforma) => cen.vgv + cen.vgvPermutaResidencial + cen.vgvPermutaNaoResidencial;
    // Linhas monetárias (6) e, separados por uma divisória com mais respiro, os dois
    // indicadores em % (Custo obras/VGV e Margem líquida) exibidos como urbi-badge
    // com a cor do cenário.
    // #11: `natureza` classifica cada linha como receita ou despesa para colorir o
    // rótulo (1ª coluna) e o fundo da linha (só tokens do design system).
    type Cen = { p: Proforma; vgvBruto: number };
    type Natureza = NaturezaSensibilidade;
    // #571: `f` pode devolver `null` — só as duas linhas `pct: true`
    // (Custo obras/VGV, Margem sobre VGV) o fazem, quando o cenário cai com
    // VGV ≤ 0; as monetárias continuam sempre `number`.
    const linhas: { l: string; f: (c: Cen) => number | null; natureza: Natureza; pct?: boolean; badge?: boolean; bmCampo?: string; divisoria?: boolean }[] = [
      { l: 'VGV', f: (c) => c.vgvBruto, natureza: 'receita' },
      { l: 'Receita bruta', f: (c) => c.p.vgv, natureza: 'receita' },
      { l: 'Receita líquida', f: (c) => c.p.receitaLiquida, natureza: 'receita' },
      { l: 'Custo direto total', f: (c) => c.p.custoDiretoTotal, natureza: 'despesa' },
      { l: 'Receita operacional', f: (c) => c.p.receitaOperacional, natureza: 'receita' },
      { l: 'Custo indireto total', f: (c) => c.p.custoIndiretoTotal, natureza: 'despesa' },
      { l: 'Resultado', f: (c) => c.p.resultado, natureza: 'receita' },
      { l: 'Custo obras / VGV', f: (c) => c.p.custoObrasVgvPct, natureza: 'despesa', pct: true, badge: true, bmCampo: 'custo_obras_vgv', divisoria: true },
      { l: 'Margem sobre VGV', f: (c) => c.p.margemLiquidaPct, natureza: 'receita', pct: true, badge: true, bmCampo: 'margem_liquida' },
    ];
    // BUG7-12: sem símbolo "R$" — número puro com 2 casas decimais.
    // #492: `fmtNum` com 2 casas dava *até* 2 casas (declara só o
    // `maximumFractionDigits`, nunca o `minimumFractionDigits`), então
    // a vírgula decimal não batia entre as linhas de uma coluna alinhada à direita.
    // #568: o arredondamento monetário do contrato C7 (#281) continua o mesmo —
    // ele agora chega por `celulaSensibilidade`, que é `celulaProforma`, que é
    // `celula`/`fmtR$(v, false)`. O que muda é a NOTAÇÃO: despesa entre
    // parênteses, receita/resultado com o sinal real, igual à tabela principal.
    // #571: `v === null` só acontece nas duas linhas `pct: true` com o
    // cenário em VGV ≤ 0 — "—", nunca "0,0%". As monetárias nunca chegam `null`.
    const fmt = (m: { pct?: boolean; natureza: Natureza }, v: number | null) =>
      (v === null ? '—' : (m.pct ? fmtPct(v) : celulaSensibilidade(v, m.natureza)));
    // #11: título de cada cenário num urbi-badge ESTÁTICO — Bear=perigo (vermelho),
    // Base=sucesso (verde), Bull=info (azul). Os NÚMEROS seguem a mesma cor do
    // cenário, por classe `cen-*` (ver o CSS) — exceto quando o valor é negativo.
    const COR_BADGE = { bear: 'perigo', base: 'sucesso', bull: 'info' } as const;
    const pBear = proforma(fatorBear), pBase = proforma(1), pBull = proforma(fatorBull);
    const cenarios: { id: 'bear' | 'base' | 'bull'; rot: string; p: Proforma; vgvBruto: number }[] = [
      { id: 'bear', rot: '📉 Bear', p: pBear, vgvBruto: vgvBrutoDe(pBear) },
      { id: 'base', rot: '📊 Base', p: pBase, vgvBruto: vgvBrutoDe(pBase) },
      { id: 'bull', rot: '🚀 Bull', p: pBull, vgvBruto: vgvBrutoDe(pBull) },
    ];
    const linhasMonetarias = linhas.filter((m) => !m.divisoria && !m.badge);
    const linhasIndicadores = linhas.filter((m) => m.divisoria || m.badge);
    // #78: colgroup compartilhado — rótulo + 3 cenários de largura igual. Com
    // `table-layout: fixed`, garante que as colunas bear/base/bull tenham a mesma
    // largura nas duas tabelas (monetária e indicadores) e que o cabeçalho fique
    // alinhado com o conteúdo.
    const colgroup = html`
      <colgroup>
        <col style="width: 40%" />
        <col style="width: 20%" />
        <col style="width: 20%" />
        <col style="width: 20%" />
      </colgroup>`;
    const cabecalho = html`
      <thead>
        <tr>
          <th></th>
          ${cenarios.map((c) => html`<th class="num"><div class="sens-cab"><urbi-badge cor=${COR_BADGE[c.id]}>${c.rot}</urbi-badge></div></th>`)}
        </tr>
      </thead>`;
    const renderLinha = (m: typeof linhas[0]) => html`
      <tr class="nat-${m.natureza}">
        <td>${m.l}</td>
        ${cenarios.map((c) => {
          const valNum = m.f(c);
          const txt = fmt(m, valNum);
          if (m.badge) {
            const bola = m.bmCampo ? bolaFaixa(this._bm(m.bmCampo), valNum) : '';
            return html`<td class="num"><div class="sens-cab"><urbi-badge cor=${COR_BADGE[c.id]}>${bola ? `${bola} ` : ''}${txt}</urbi-badge></div></td>`;
          }
          // #568: `neg` é o que faz um Resultado negativo aparecer vermelho
          // mesmo na coluna Base — e é a única marca desta tabela que depende
          // do NÚMERO do cenário, e não da coluna. `valNum` nunca é `null`
          // aqui: só as duas linhas `pct` (que são `badge`) podem sê-lo.
          const sinal = sinalSensibilidade(valNum ?? 0, m.natureza);
          return html`<td class="num cen-${c.id} ${sinal}">${txt}</td>`;
        })}
      </tr>`;
    return html`<urbi-card titulo="Análise de sensibilidade">
      <div class="sens-var">
        <urbi-select
          label="Variável estressada (−${varNeg}% / +${varPos}%)"
          .valor=${this.varSens}
          .opcoes=${this._variaveis(lot)}
          @urbi:select-change=${(e: CustomEvent) => this.varSens = e.detail.valor as VarSens}
        ></urbi-select>
      </div>
      <div class="pf-wrap">
        <table class="pf sens">
          ${colgroup}
          ${cabecalho}
          <tbody>${linhasMonetarias.map(renderLinha)}</tbody>
        </table>
      </div>
      <div class="pf-wrap sens-indicadores">
        <table class="pf sens">
          ${colgroup}
          ${cabecalho}
          <tbody>${linhasIndicadores.map(renderLinha)}</tbody>
        </table>
      </div>
    </urbi-card>`;
  }

  private _exportar(formato: string) {
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    if (formato === 'excel') exportarExcel(this.estudo, p, lot);
    else if (!exportarPDF(this.estudo, p, lot)) urbiVerso.notificar('Permita pop-ups para exportar em PDF.', 'alerta');
  }
}

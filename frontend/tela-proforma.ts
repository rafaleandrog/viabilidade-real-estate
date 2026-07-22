import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import { urbiVerso, listarBenchmarks, buscarConfig } from './viabilidade-api.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { exportarPDF, exportarExcel } from './exportar.js';
import { bolaFaixa, varianteFaixa } from './medidor-faixas.js';

// `tipo` dá a categoria visual (#3): receita | consolidado | resultado;
// ausente = item comum (sub-linha discreta). `grupo` marca sub-linhas
// colapsáveis (#2); `toggle` marca a linha-total que colapsa aquele grupo.
type Grupo = 'deducoes' | 'direto' | 'indireto';
interface Linha {
  l: string; v: number;
  tipo?: 'receita' | 'consolidado' | 'resultado';
  grupo?: Grupo;          // #9: sub-linha colapsável do grupo cujo total é o header
  toggle?: Grupo;         // #9: linha-total (header) que colapsa o grupo abaixo dela
  semPermuta?: boolean;   // #10: linha "VGV sem permuta" (itálico, sub-linha de contexto)
  memo?: string;          // #8: descrição da conta, na 2ª coluna (menor, itálico)
  soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean;
}

type VarSens = 'preco' | 'permuta_fisica' | 'permuta_financeira' | 'custo_infra' | 'custo_obras';

@customElement('viab-tela-proforma')
export class ViabTelaProforma extends LitElement {
  @property({ attribute: false }) estudo: any = null;

  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  @state() private varSens: VarSens = 'preco';
  // #9: grupos consolidados colapsados (default: expandido). O total é o header.
  @state() private colapso: Record<Grupo, boolean> = { deducoes: false, direto: false, indireto: false };

  static styles = [estiloConteudo, css`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpis urbi-kpi { min-width: 0; }
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
    /* #8 — "VGV sem permuta": itálico (linha de contexto). */
    .pf tr.italico td { font-style: italic; }
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
    /* Badges dos cenários (cabeçalho) e dos indicadores centralizados na coluna. */
    .pf.sens .sens-cab { display: flex; justify-content: center; }
    .pf.sens td .sens-cab { padding: 2px 0; }
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
      const [bm, cfg] = await Promise.all([listarBenchmarks(this.estudo.tipo_empreendimento), buscarConfig()]);
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
    } catch (e) { console.error(e); }
  }

  private _entrada(over: Partial<ProformaInput> = {}): ProformaInput {
    return { ...this.estudo, aliquota_ret_pct: this.aliquotaRet, ...over } as ProformaInput;
  }
  private _bm(campo: string) { return this.benchmarks.find((b) => b.campo === campo); }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    // #10: VGV bruto = VGV se a permuta física (R e NR) NÃO fosse entregue (vendida).
    const vgvBruto = calcularProforma(this._entrada({
      permuta_fisica_area_m2: 0, permuta_fisica_pct: 0,
      permuta_fisica_nr_area_m2: 0, permuta_fisica_nr_pct: 0,
    })).vgv;
    return html`
      ${this._renderKpis(p)}
      ${!lot ? this._renderUnidadesTipo(p) : nothing}
      <urbi-card titulo="Proforma">
        ${this._renderTabela(p, lot, vgvBruto)}
        <div class="barra-acoes">
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-excel" @click=${() => this._exportar('excel')}>Exportar Excel</urbi-botao>
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-pdf" @click=${() => this._exportar('pdf')}>Exportar PDF</urbi-botao>
        </div>
      </urbi-card>
      ${this._renderSensibilidade(lot)}
    `;
  }

  private _renderKpis(p: Proforma): TemplateResult {
    const co = this._bm('custo_obras_vgv');
    const ml = this._bm('margem_liquida');
    const temPermuta = p.areaPermutaFisica > 0 || p.permutaFinResidencial > 0 || p.permutaFinNaoResidencial > 0;
    const kpis: { rot: string; val: string; variante: string }[] = [
      { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²`, variante: '' },
      { rot: 'Preço médio/unid.', val: fmtR$(p.precoMedioUnidade), variante: '' },
      { rot: 'Nº de unidades', val: fmtNum(p.numUnidades), variante: '' },
    ];
    if (temPermuta) kpis.push({ rot: 'Área permutada', val: `${fmtNum(p.areaPermutaFisica)} m²`, variante: '' });
    // Texto colorido nos 3 níveis do velocímetro do benchmark (sem emoji; a bola
    // fica só nos badges da análise de sensibilidade).
    kpis.push({ rot: 'Custo obras / VGV', val: fmtPct(p.custoObrasVgvPct), variante: varianteFaixa(co, p.custoObrasVgvPct) });
    kpis.push({ rot: 'Margem líquida', val: fmtPct(p.margemLiquidaPct), variante: varianteFaixa(ml, p.margemLiquidaPct) });
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
    // #10: bloco de permuta física (só quando houver) — entre o VGV bruto (sem
    // permuta) e a Receita bruta (VGV). Residencial e Não Residencial separados.
    if (p.areaPermutaFisica > 0) {
      linhas.push({ l: 'VGV sem permuta física', v: vgvBruto, semPermuta: true });
      linhas.push({ l: lot ? '(-) Permuta física' : '(-) Permuta física residencial', v: p.vgvPermutaResidencial, ocultarSeZero: true, memo: permMemo(p.areaPermutaResidencial) });
      linhas.push({ l: '(-) Permuta física não residencial', v: p.vgvPermutaNaoResidencial, soInc: true, ocultarSeZero: true, memo: permMemo(p.areaPermutaNaoResidencial) });
    }
    linhas.push({ l: 'Receita bruta (VGV)', v: p.vgv, tipo: 'receita' });
    // #9: "Deduções sobre VGV" consolida imposto+corretagem+marketing+permuta fin.,
    // como header colapsável logo abaixo da Receita bruta.
    linhas.push({ l: '= Deduções sobre VGV', v: deducoesVgv, tipo: 'consolidado', toggle: 'deducoes' });
    linhas.push({ l: '(-) Imposto', v: p.imposto, grupo: 'deducoes', memo: impostoMemo });
    linhas.push({ l: '(-) Corretagem', v: p.corretagem, grupo: 'deducoes', memo: `${pct(e.corretagem_percentual)} do VGV` });
    linhas.push({ l: '(-) Marketing', v: p.marketing, grupo: 'deducoes', memo: `${pct(e.marketing_percentual)} do VGV` });
    linhas.push({ l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, grupo: 'deducoes', ocultarSeZero: true, memo: permutaFinRMemo });
    linhas.push({ l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, grupo: 'deducoes', ocultarSeZero: true, memo: permutaFinNRMemo });
    linhas.push({ l: '= Receita líquida', v: p.receitaLiquida, tipo: 'consolidado' });
    // #9: totais de custo invertidos — o total é o header do grupo colapsável.
    linhas.push({ l: '= Custo direto total', v: p.custoDiretoTotal, tipo: 'consolidado', toggle: 'direto' });
    linhas.push({ l: '(-) Terreno', v: p.custoTerreno, grupo: 'direto', memo: terrenoMemo });
    linhas.push({ l: '(-) Projetos e aprovação', v: p.projetos, grupo: 'direto', memo: projetosMemo });
    linhas.push({ l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true, grupo: 'direto', memo: infraMemo });
    linhas.push({ l: '(-) Outorga', v: p.outorga, soInc: true, grupo: 'direto' });
    linhas.push({ l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true, grupo: 'direto', memo: `${pct(e.incorporacao_registro_pct)} do VGV` });
    linhas.push({ l: '(-) Construção', v: p.construcao, soInc: true, grupo: 'direto', memo: construcaoMemo });
    linhas.push({ l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true, grupo: 'direto', memo: `${pct(e.taxa_gestao_pct)} das obras` });
    linhas.push({ l: '(-) Decoração', v: p.decoracao, soInc: true, grupo: 'direto', memo: `${rsm2(e.custo_decoracao_m2)} × área privativa` });
    linhas.push({ l: '(-) Manutenção pós-obra', v: p.manutencao, grupo: 'direto', memo: `${pct(e.manutencao_pct)} do VGV` });
    linhas.push({ l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true, grupo: 'direto', memo: `${pct(e.contingencias_pct)} do VGV` });
    // Receita operacional = receita líquida − custo direto total (antes dos indiretos).
    linhas.push({ l: '= Receita operacional', v: p.receitaOperacional, tipo: 'consolidado' });
    linhas.push({ l: '= Custo indireto total', v: p.custoIndiretoTotal, tipo: 'consolidado', toggle: 'indireto' });
    linhas.push({ l: '(-) Marketing global e estrutura', v: p.marketingGlobal, grupo: 'indireto', memo: `${pct(e.marketing_global_pct)} do VGV${lot ? ' + stand' : ''}` });
    // #13: rename "Gestão e outros indiretos" → "…custos indiretos".
    linhas.push({ l: '(-) Gestão e outros custos indiretos', v: p.gestaoIndiretos, grupo: 'indireto', memo: `${pct(e.gestao_indiretos_pct)} do VGV` });
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

  // Coluna R$ em notação contábil: sem "R$"; custos/deduções (itens e consolidados)
  // entre parênteses; receita plana; resultado pelo sinal real (negativo entre
  // parênteses).
  private _fmtContabil(r: Linha): string {
    const abs = fmtNum(Math.abs(r.v));
    if (r.tipo === 'receita') return abs;
    if (r.tipo === 'resultado') return r.v < 0 ? `(${abs})` : abs;
    return `(${abs})`;
  }

  // #9: R$ por m² vendável em notação contábil — análogo a _fmtContabil, mas com
  // sufixo "/m²" e sem prefixo "R$": custos/deduções entre parênteses, receita
  // plana, resultado pelo sinal real. (Antes usava fmtR$, que injeta "R$".)
  private _fmtContabilM2(r: Linha, p: Proforma): string {
    if (p.areaVendavel <= 0) return '—';
    const abs = fmtNum(Math.abs(r.v / p.areaVendavel));
    if (r.tipo === 'receita') return abs;
    if (r.tipo === 'resultado') return r.v < 0 ? `(${abs})` : abs;
    return `(${abs})`;
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
              const cls = `${r.tipo ?? 'item'}${r.semPermuta ? ' italico' : ''}`;
              const sinal = r.tipo === 'resultado' ? (r.v < 0 ? 'neg' : 'pos') : '';
              return html`<tr class=${cls}>
                <td>
                  ${r.toggle
                    ? html`<button class="toggle" title="Expandir/recolher"
                        @click=${() => this._toggle(r.toggle!)}>${this.colapso[r.toggle!] ? '▸' : '▾'}</button>`
                    : nothing}
                  ${r.l}
                </td>
                <td class="desc">${r.memo ?? ''}</td>
                <td class="num ${sinal}">${this._fmtContabil(r)}</td>
                <td class="num ${sinal}">${this._fmtContabilM2(r, p)}</td>
                <td class="num">${this._pctVgv(r, p)}</td>
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

  private _aplicarFator(fator: number): ProformaInput {
    const e = this.estudo;
    const mul = (x: any) => (Number(x) || 0) * fator;
    switch (this.varSens) {
      case 'preco': return this._entrada({ preco_venda_m2: mul(e.preco_venda_m2), preco_venda_m2_residencial: mul(e.preco_venda_m2_residencial), preco_venda_m2_nao_residencial: mul(e.preco_venda_m2_nao_residencial) });
      case 'permuta_fisica': return this._entrada({
        permuta_fisica_area_m2: mul(e.permuta_fisica_area_m2), permuta_fisica_pct: mul(e.permuta_fisica_pct),
        permuta_fisica_nr_area_m2: mul(e.permuta_fisica_nr_area_m2), permuta_fisica_nr_pct: mul(e.permuta_fisica_nr_pct),
      });
      case 'permuta_financeira': return this._entrada({ permuta_financeira_residencial_pct: mul(e.permuta_financeira_residencial_pct), permuta_financeira_nao_residencial_pct: mul(e.permuta_financeira_nao_residencial_pct) });
      case 'custo_infra': return this._entrada({ custo_infra_m2: mul(e.custo_infra_m2), infra_pct: mul(e.infra_pct) });
      case 'custo_obras': return this._entrada({ custo_construcao_m2: mul(e.custo_construcao_m2) });
    }
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
    // Difere da Receita bruta (VGV) só quando há permuta física.
    const semPermutaFisica = {
      permuta_fisica_area_m2: 0, permuta_fisica_pct: 0,
      permuta_fisica_nr_area_m2: 0, permuta_fisica_nr_pct: 0,
    };
    const proforma = (fator: number) => calcularProforma(this._aplicarFator(fator));
    const vgvBrutoDe = (fator: number) =>
      calcularProforma({ ...this._aplicarFator(fator), ...semPermutaFisica }).vgv;
    // Linhas monetárias (6) e, separados por uma divisória com mais respiro, os dois
    // indicadores em % (Custo obra/VGV e Margem líquida) exibidos como urbi-badge
    // com a cor do cenário.
    // #11: `natureza` classifica cada linha como receita ou despesa para colorir o
    // rótulo (1ª coluna) e o fundo da linha (só tokens do design system).
    type Cen = { p: Proforma; vgvBruto: number };
    type Natureza = 'receita' | 'despesa';
    const linhas: { l: string; f: (c: Cen) => number; natureza: Natureza; pct?: boolean; badge?: boolean; bmCampo?: string; divisoria?: boolean }[] = [
      { l: 'VGV', f: (c) => c.vgvBruto, natureza: 'receita' },
      { l: 'Receita bruta', f: (c) => c.p.vgv, natureza: 'receita' },
      { l: 'Receita líquida', f: (c) => c.p.receitaLiquida, natureza: 'receita' },
      { l: 'Custo direto total', f: (c) => c.p.custoDiretoTotal, natureza: 'despesa' },
      { l: 'Receita operacional', f: (c) => c.p.receitaOperacional, natureza: 'receita' },
      { l: 'Custo indireto total', f: (c) => c.p.custoIndiretoTotal, natureza: 'despesa' },
      { l: 'Resultado', f: (c) => c.p.resultado, natureza: 'receita' },
      { l: 'Custo obra / VGV', f: (c) => c.p.custoObrasVgvPct, natureza: 'despesa', pct: true, badge: true, bmCampo: 'custo_obras_vgv', divisoria: true },
      { l: 'Margem líquida', f: (c) => c.p.margemLiquidaPct, natureza: 'receita', pct: true, badge: true, bmCampo: 'margem_liquida' },
    ];
    const fmt = (m: { pct?: boolean }, v: number) => (m.pct ? fmtPct(v) : fmtR$(v));
    // #11: título de cada cenário num urbi-badge ESTÁTICO — Bear=perigo (vermelho),
    // Base=sucesso (verde), Bull=info (azul). Os NÚMEROS agora seguem a mesma cor
    // do cenário (tokens correspondentes ao badge).
    const COR_BADGE = { bear: 'perigo', base: 'sucesso', bull: 'info' } as const;
    const COR_TXT = {
      bear: 'var(--cor-erro, #D45A3A)',
      base: 'var(--cor-sucesso, #13A98D)',
      bull: 'var(--cor-info, #2AA9E0)',
    } as const;
    const cenarios: { id: 'bear' | 'base' | 'bull'; rot: string; p: Proforma; vgvBruto: number }[] = [
      { id: 'bear', rot: '📉 Bear', p: proforma(fatorBear), vgvBruto: vgvBrutoDe(fatorBear) },
      { id: 'base', rot: '📊 Base', p: proforma(1), vgvBruto: vgvBrutoDe(1) },
      { id: 'bull', rot: '🚀 Bull', p: proforma(fatorBull), vgvBruto: vgvBrutoDe(fatorBull) },
    ];
    const linhasMonetarias = linhas.filter((m) => !m.divisoria && !m.badge);
    const linhasIndicadores = linhas.filter((m) => m.divisoria || m.badge);
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
          return html`<td class="num" style="color:${COR_TXT[c.id]}">${txt}</td>`;
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
          ${cabecalho}
          <tbody>${linhasMonetarias.map(renderLinha)}</tbody>
        </table>
      </div>
      <div class="pf-wrap sens-indicadores">
        <table class="pf sens">
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

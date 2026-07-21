import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { rotuloMesRelativo, type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig, type LinhaCalc } from './fluxo-caixa-motor.js';
import { exportarFluxoCSV, exportarFluxoPDF } from './exportar.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
} from './viabilidade-api.js';

// Sub-tela "Ver Fluxo" (nível Avançado): KPIs, tabela mensal com colunas fixas
// (sticky) + scroll horizontal, e gráficos SVG de fluxo mensal e acumulado.
// Todo o cálculo vem do motor puro (fluxo-caixa-motor). Nada toca o Preliminar.

const GRUPO_CUSTO_LABEL: Record<string, string> = {
  terreno: 'Custos do Terreno',
  obra: 'Custos Diretos',
  indireto: 'Custos Indiretos',
};

/** R$ abreviado para eixos ("R$ 500K", "R$ 2,1M"). */
function abrevR$(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}R$ ${(a / 1e9).toFixed(1).replace('.', ',')}B`;
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toFixed(1).replace('.', ',')}M`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3)}K`;
  return `${s}R$ ${Math.round(a)}`;
}

/** Notação contábil da célula: vazio para zero; custos entre parênteses. */
function celula(v: number, negativoEntreParenteses: boolean): string {
  if (!v || Math.abs(v) < 0.5) return '';
  const abs = Math.round(Math.abs(v)).toLocaleString('pt-BR');
  if (negativoEntreParenteses) return `(${abs})`;
  return v < 0 ? `(${abs})` : abs;
}

@customElement('viab-fluxo-ver')
export class ViabFluxoVer extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private calc: FluxoCalc | null = null;
  @state() private colapso: Record<string, boolean> = {};
  @state() private faseFiltro = '';
  private dados: {
    receitas: any[]; custos: any[]; curvas: any[];
    crono: EventoCrono[]; dataInicio: string | null; taxa: number;
  } | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .controles .espaco { flex: 1; }
    .controles urbi-select { min-width: 160px; }

    .fx-wrap { overflow: auto; max-height: 72vh; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12)); border-radius: 8px; }
    table.fx { border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; width: max-content; min-width: 100%; }
    table.fx th, table.fx td {
      padding: 5px 8px; font-size: 0.75rem; white-space: nowrap;
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      background: var(--cor-superficie, #17181c);
    }
    table.fx thead th {
      position: sticky; top: 0; z-index: 3; font-weight: 600; text-align: right;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    table.fx td.num { text-align: right; }
    /* 5 colunas fixas à esquerda — largura TRAVADA (width = min = max, border-box) para
       que o "left" de cada sticky bata exatamente com a largura real da coluna anterior.
       Sem travar: a c1 (só min/max) encolhia abaixo do passo de 220px e abria um vão por
       onde os meses vazavam ao rolar (a "sobreposição" reportada); e as colunas numéricas
       (só min-width) cresciam além do passo com valores grandes e invadiam a vizinha.
       Cumulativo dos passos: 0 · 220 · 292 · 356 · 476 (fim em 596). */
    .c1, .c2, .c3, .c4, .c5 { box-sizing: border-box; overflow: hidden; }
    .c1 { position: sticky; left: 0;    z-index: 2; width: 220px; min-width: 220px; max-width: 220px; text-overflow: ellipsis; text-align: left; }
    .c2 { position: sticky; left: 220px; z-index: 2; width: 72px;  min-width: 72px;  max-width: 72px;  text-align: right; }
    .c3 { position: sticky; left: 292px; z-index: 2; width: 64px;  min-width: 64px;  max-width: 64px;  text-align: right; }
    .c4 { position: sticky; left: 356px; z-index: 2; width: 120px; min-width: 120px; max-width: 120px; text-align: right; }
    .c5 { position: sticky; left: 476px; z-index: 2; width: 120px; min-width: 120px; max-width: 120px; text-align: right;
      border-right: 2px solid var(--cor-borda, rgba(255,255,255,0.12)); }
    table.fx thead .c1, table.fx thead .c2, table.fx thead .c3, table.fx thead .c4, table.fx thead .c5 { z-index: 4; }
    table.fx thead .c1 { text-align: left; }

    tr.grupo td { font-weight: 700; }
    tr.subgrupo td { font-weight: 600; }
    tr.item td.c1 { padding-left: 28px; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
    tr.subitem td.c1 { padding-left: 44px; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
    tr.divisoria td { border-bottom: 2px solid var(--cor-borda, rgba(255,255,255,0.2)); padding: 0; height: 2px; }
    tr.resultado td { font-weight: 700; }
    td.pos { color: var(--cor-sucesso, #13a98d); }
    td.neg { color: var(--cor-erro, #d45a3a); }
    .toggle { cursor: pointer; user-select: none; background: none; border: none; color: inherit; font: inherit; padding: 0; }
    .toggle .seta { display: inline-block; width: 14px; }

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
      const [receitas, custos, curvas, crono, params] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
      ]);
      this.dados = {
        receitas: receitas?.erro ? [] : (receitas.dados || []),
        custos: custos?.erro ? [] : (custos.dados || []),
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        crono: crono?.erro ? [] : (crono.dados || []),
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
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
    };
    this.calc = calcularFluxo(config);
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Calculando fluxo de caixa..."></urbi-loading>`;
    const c = this.calc;
    if (!c || (c.linhasReceita.length === 0 && c.linhasCusto.length === 0)) {
      return html`
        <urbi-estado-vazio icone="fa-solid fa-money-bill-transfer"
          mensagem="Defina o cronograma, receitas e custos para ver o fluxo de caixa."></urbi-estado-vazio>`;
    }
    return html`
      ${this._renderKpis(c)}
      ${this._renderControles()}
      ${this._renderTabela(c)}
      <div class="graficos">
        <urbi-card titulo="Fluxo de Caixa Mensal">
          <div class="graf-wrap"><div class="graf">${this._graficoMensal(c)}</div></div>
        </urbi-card>
        <urbi-card titulo="Fluxo de Caixa Acumulado">
          <div class="graf-wrap"><div class="graf">${this._graficoAcumulado(c)}</div></div>
        </urbi-card>
      </div>
    `;
  }

  private _renderKpis(c: FluxoCalc): TemplateResult {
    const tirTxt = c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`;
    const tirVar = c.tir === null ? '' : (c.tir > 0 ? 'sucesso' : 'erro');
    return html`
      <div class="kpis">
        <urbi-kpi rotulo="TIR" .valor=${tirTxt} variante=${tirVar}></urbi-kpi>
        <urbi-kpi rotulo="VPL" .valor=${fmtR$(c.vpl)} variante=${c.vpl >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="Payback" .valor=${c.paybackData ?? '—'}></urbi-kpi>
        <urbi-kpi rotulo="Exposição máxima" .valor=${fmtR$(c.exposicaoMaxima)} variante="erro"></urbi-kpi>
      </div>
    `;
  }

  private _renderControles(): TemplateResult {
    const fases = [...new Set((this.dados?.receitas ?? []).map((l) => String(l.fase_label || '')).filter(Boolean))];
    const tudoRecolhido = Object.values(this.colapso).some(Boolean);
    return html`
      <div class="controles">
        <urbi-botao variante="secundario" pequeno @click=${() => this._toggleTudo(!tudoRecolhido)}>
          ${tudoRecolhido ? 'Expandir tudo' : 'Recolher tudo'}
        </urbi-botao>
        ${fases.length > 1 ? html`
          <urbi-select
            .valor=${this.faseFiltro}
            .opcoes=${[{ valor: '', rotulo: 'Global (todas as fases)' },
              ...fases.map((f) => ({ valor: f, rotulo: f }))]}
            @urbi:select-change=${(e: CustomEvent) => { this.faseFiltro = e.detail.valor; this._recalcular(); }}
          ></urbi-select>` : nothing}
        <span class="espaco"></span>
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-download" @click=${this._csv}>CSV</urbi-botao>
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-pdf" @click=${this._pdf}>PDF</urbi-botao>
      </div>
    `;
  }

  private _toggleTudo(recolher: boolean) {
    const chaves = ['receita', 'custo-terreno', 'custo-obra', 'custo-indireto',
      ...(this.calc?.linhasReceita ?? []).map((l) => `r${l.id}`)];
    const novo: Record<string, boolean> = {};
    for (const k of chaves) novo[k] = recolher;
    this.colapso = novo;
  }

  private _t(chave: string) {
    this.colapso = { ...this.colapso, [chave]: !this.colapso[chave] };
  }

  // ── Tabela ──

  private _renderTabela(c: FluxoCalc): TemplateResult {
    const somaLinhas = (linhas: LinhaCalc[]): number[] => {
      const out = new Array<number>(c.prazo).fill(0);
      for (const l of linhas) for (let i = 0; i < c.prazo; i++) out[i] += l.mensal[i];
      return out;
    };
    const custosPorGrupo = (g: string) => c.linhasCusto.filter((x) => x.grupo === g);
    const grupos = (['terreno', 'obra', 'indireto'] as const).filter((g) => custosPorGrupo(g).length > 0);

    return html`
      <div class="fx-wrap">
        <table class="fx">
          <thead>
            <tr>
              <th class="c1">Linha</th>
              <th class="c2">Início</th>
              <th class="c3">Duração</th>
              <th class="c4">Total</th>
              <th class="c5">VPL</th>
              ${c.meses.map((m) => html`<th>${m}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${this._linhaTabela('grupo', 'receita', 'Receita',
              { mensal: c.receitaMensal, total: c.receitaMensal.reduce((s, v) => s + v, 0) }, c, false)}
            ${!this.colapso['receita'] ? c.linhasReceita.map((l) => html`
              ${this._linhaTabela('subgrupo', `r${l.id}`,
                l.faseLabel ? `${l.nome} (${l.faseLabel})` : l.nome, l, c, false)}
              ${!this.colapso[`r${l.id}`] ? (l.itens ?? []).map((t) =>
                this._linhaTabela('subitem', '', t.nome, t, c, false)) : nothing}
            `) : nothing}

            ${this._linhaTabela('grupo', '', 'Custo Total',
              { mensal: c.custoMensal, total: c.custoMensal.reduce((s, v) => s + v, 0) }, c, true, false)}
            ${grupos.map((g) => html`
              ${this._linhaTabela('subgrupo', `custo-${g}`, GRUPO_CUSTO_LABEL[g],
                { mensal: somaLinhas(custosPorGrupo(g)), total: custosPorGrupo(g).reduce((s, x) => s + x.total, 0) }, c, true)}
              ${!this.colapso[`custo-${g}`] ? custosPorGrupo(g).map((x) =>
                this._linhaTabela('item', '', x.nome, x, c, true)) : nothing}
            `)}

            <tr class="divisoria"><td class="c1"></td><td class="c2"></td><td class="c3"></td><td class="c4"></td><td class="c5"></td>${c.meses.map(() => html`<td></td>`)}</tr>
            ${this._linhaResultado('Fluxo de Caixa Mensal', c.fluxoMensal, c)}
            ${this._linhaResultado('Fluxo de Caixa Acumulado', c.fluxoAcumulado, c)}
          </tbody>
        </table>
      </div>
    `;
  }

  private _linhaTabela(
    classe: 'grupo' | 'subgrupo' | 'item' | 'subitem',
    chaveToggle: string,
    nome: string,
    linha: Partial<LinhaCalc> & { mensal: number[]; total: number },
    c: FluxoCalc,
    ehCusto: boolean,
    expansivel = true,
  ): TemplateResult {
    const dataInicio = this.dados?.dataInicio ?? null;
    const toggle = chaveToggle && expansivel;
    return html`
      <tr class=${classe}>
        <td class="c1">
          ${toggle ? html`
            <button class="toggle" @click=${() => this._t(chaveToggle)} aria-expanded=${!this.colapso[chaveToggle]}>
              <span class="seta">${this.colapso[chaveToggle] ? '▸' : '▾'}</span>${nome}
            </button>` : nome}
        </td>
        <td class="c2">${linha.duracao ? rotuloMesRelativo(dataInicio, linha.inicio!) : ''}</td>
        <td class="c3">${linha.duracao ? `${linha.duracao}m` : ''}</td>
        <td class="c4 num">${celula(linha.total, ehCusto)}</td>
        <td class="c5 num">${linha.vpl !== undefined ? celula(linha.vpl, ehCusto) : ''}</td>
        ${linha.mensal.map((v) => html`<td class="num">${celula(v, ehCusto)}</td>`)}
      </tr>
    `;
  }

  private _linhaResultado(nome: string, valores: number[], c: FluxoCalc): TemplateResult {
    const total = nome.includes('Acumulado') ? valores[valores.length - 1] : valores.reduce((s, v) => s + v, 0);
    return html`
      <tr class="resultado">
        <td class="c1">${nome}</td>
        <td class="c2"></td><td class="c3"></td>
        <td class="c4 num ${total >= 0 ? 'pos' : 'neg'}">${celula(total, false)}</td>
        <td class="c5"></td>
        ${valores.map((v) => html`<td class="num ${v >= 0 ? 'pos' : 'neg'}">${celula(v, false)}</td>`)}
      </tr>
    `;
  }

  // ── Gráficos ──

  /** Marcos verticais do cronograma (Lançamento, Início/Fim da Obra). */
  private _marcos(): { mes: number; rotulo: string }[] {
    const crono = this.dados?.crono ?? [];
    const lanc = crono.find((e) => e.evento === 'lancamento');
    const obra = crono.find((e) => e.evento === 'obra');
    const marcos: { mes: number; rotulo: string }[] = [];
    if (lanc) marcos.push({ mes: Number(lanc.inicio_mes), rotulo: 'Lançamento' });
    if (obra) {
      marcos.push({ mes: Number(obra.inicio_mes), rotulo: 'Início Obra' });
      marcos.push({ mes: Number(obra.inicio_mes) + Number(obra.duracao_meses) - 1, rotulo: 'Fim Obra' });
    }
    return marcos;
  }

  private _graficoMensal(c: FluxoCalc): TemplateResult {
    const W = 900; const H = 260; const padL = 64; const padR = 10; const padT = 26; const padB = 24;
    const gw = W - padL - padR; const gh = H - padT - padB;
    const maxAbs = Math.max(1, ...c.fluxoMensal.map((v) => Math.abs(v)));
    const x = (i: number) => padL + (i / c.prazo) * gw;
    const bw = Math.max(1.5, gw / c.prazo - 1);
    const y = (v: number) => padT + (1 - (v + maxAbs) / (2 * maxAbs)) * gh;
    const y0 = y(0);
    const corTexto = 'var(--cor-texto-sec, #8a8f98)';
    const dataInicio = this.dados?.dataInicio ?? null;
    const passo = Math.max(3, Math.ceil(c.prazo / 10 / 3) * 3);
    const ticks: number[] = [];
    for (let m = 0; m < c.prazo; m += passo) ticks.push(m);
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fluxo de caixa mensal">
        ${[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((v) => svg`
          <line x1=${padL} y1=${y(v)} x2=${W - padR} y2=${y(v)} stroke="var(--cor-borda-sutil, rgba(128,128,128,0.15))" />
          <text x=${padL - 6} y=${y(v) + 3} font-size="9" fill=${corTexto} text-anchor="end">${abrevR$(v)}</text>`)}
        ${ticks.map((i) => svg`
          <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${rotuloMesRelativo(dataInicio, i)}</text>`)}
        ${c.fluxoMensal.map((v, i) => svg`
          <rect x=${x(i)} y=${Math.min(y(v), y0)} width=${bw} height=${Math.max(Math.abs(y(v) - y0), 0.5)}
            fill=${v >= 0 ? 'var(--cor-sucesso, #13a98d)' : 'var(--cor-erro, #d45a3a)'} opacity="0.9" />`)}
        ${this._marcos().map((m, idx) => svg`
          <line x1=${x(m.mes)} y1=${padT - 4} x2=${x(m.mes)} y2=${H - padB}
            stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.7" />
          <text x=${x(m.mes) + 3} y=${padT + 8 + (idx % 2) * 10} font-size="9" fill=${corTexto}>
            ${m.rotulo} · ${rotuloMesRelativo(dataInicio, m.mes)} · M+${m.mes}
          </text>`)}
      </svg>
    `;
  }

  private _graficoAcumulado(c: FluxoCalc): TemplateResult {
    const W = 900; const H = 280; const padL = 64; const padR = 10; const padT = 26; const padB = 24;
    const gw = W - padL - padR; const gh = H - padT - padB;
    const min = Math.min(0, ...c.fluxoAcumulado);
    const max = Math.max(1, ...c.fluxoAcumulado);
    const x = (i: number) => padL + (c.prazo <= 1 ? 0 : (i / (c.prazo - 1)) * gw);
    const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * gh;
    const y0 = y(0);
    const linha = c.fluxoAcumulado.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${linha} L${x(c.prazo - 1).toFixed(1)},${y0.toFixed(1)} L${x(0).toFixed(1)},${y0.toFixed(1)} Z`;
    const corTexto = 'var(--cor-texto-sec, #8a8f98)';
    const dataInicio = this.dados?.dataInicio ?? null;
    const iExp = c.fluxoAcumulado.indexOf(c.exposicaoMaxima);
    const passo = Math.max(3, Math.ceil(c.prazo / 10 / 3) * 3);
    const ticks: number[] = [];
    for (let m = 0; m < c.prazo; m += passo) ticks.push(m);
    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fluxo de caixa acumulado">
        <defs>
          <clipPath id="acima"><rect x="0" y="0" width=${W} height=${y0} /></clipPath>
          <clipPath id="abaixo"><rect x="0" y=${y0} width=${W} height=${H - y0} /></clipPath>
        </defs>
        ${ticks.map((i) => svg`
          <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${rotuloMesRelativo(dataInicio, i)}</text>`)}
        ${[min, 0, max].map((v) => svg`
          <text x=${padL - 6} y=${y(v) + 3} font-size="9" fill=${corTexto} text-anchor="end">${abrevR$(v)}</text>`)}
        <path d=${area} fill="var(--cor-sucesso, #13a98d)" opacity="0.15" clip-path="url(#acima)" />
        <path d=${area} fill="var(--cor-erro, #d45a3a)" opacity="0.15" clip-path="url(#abaixo)" />
        <line x1=${padL} y1=${y0} x2=${W - padR} y2=${y0} stroke=${corTexto} stroke-dasharray="4,3" opacity="0.6" />
        <path d=${linha} fill="none" stroke="var(--cor-texto-forte, #e8e8ea)" stroke-width="2" />
        ${this._marcos().map((m) => svg`
          <line x1=${x(m.mes)} y1=${padT - 4} x2=${x(m.mes)} y2=${H - padB}
            stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.5" />
          <text x=${x(m.mes) + 3} y=${padT + 8} font-size="9" fill=${corTexto}>${m.rotulo}</text>`)}
        ${c.paybackMes !== null ? svg`
          <line x1=${x(c.paybackMes)} y1=${padT} x2=${x(c.paybackMes)} y2=${H - padB}
            stroke="var(--cor-sucesso, #13a98d)" stroke-width="1.5" stroke-dasharray="2,2" />
          <text x=${x(c.paybackMes) + 3} y=${padT + 20} font-size="9" fill="var(--cor-sucesso, #13a98d)">
            Payback: ${c.paybackData} · M+${c.paybackMes}
          </text>` : nothing}
        ${iExp >= 0 ? svg`
          <circle cx=${x(iExp)} cy=${y(c.exposicaoMaxima)} r="4" fill="var(--cor-erro, #d45a3a)" />
          <text x=${x(iExp) + 6} y=${y(c.exposicaoMaxima) - 4} font-size="9" fill="var(--cor-erro, #d45a3a)">
            Exposição Máx.: ${abrevR$(c.exposicaoMaxima)}
          </text>` : nothing}
      </svg>
    `;
  }

  // ── Exportação ──

  private _csv = () => {
    if (!this.calc) return;
    exportarFluxoCSV(this.estudo, this.calc, this.dados?.dataInicio ?? null);
    urbiVerso.notificar('CSV do fluxo exportado.', 'sucesso');
  };

  private _pdf = () => {
    if (!this.calc) return;
    const ok = exportarFluxoPDF(this.estudo, this.calc, this.dados?.dataInicio ?? null);
    if (!ok) urbiVerso.notificar('Permita pop-ups para exportar o PDF.', 'alerta');
  };
}

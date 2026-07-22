import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado } from './fluxo-graficos.js';
import { estiloFluxoTabela, kpisFluxo, tabelaFluxo, chavesColapso } from './fluxo-tabela.js';
import { exportarFluxoCSV, exportarFluxoPDF } from './exportar.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
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
  private dados: {
    receitas: any[]; custos: any[]; curvas: any[];
    crono: EventoCrono[]; dataInicio: string | null; taxa: number;
  } | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, estiloFluxoTabela, css`
    .controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .controles .espaco { flex: 1; }
    .controles urbi-select { min-width: 160px; }

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
      ${kpisFluxo(c)}
      ${this._renderControles()}
      ${tabelaFluxo(c, this.dados?.dataInicio ?? null, this.colapso, (ch) => this._t(ch))}
      <div class="graficos">
        <urbi-card titulo="Fluxo de Caixa Mensal">
          <div class="graf-wrap"><div class="graf">${graficoFluxoMensal(c, this.dados?.dataInicio ?? null, this.dados?.crono ?? [])}</div></div>
        </urbi-card>
        <urbi-card titulo="Fluxo de Caixa Acumulado">
          <div class="graf-wrap"><div class="graf">${graficoFluxoAcumulado(c, this.dados?.dataInicio ?? null, this.dados?.crono ?? [])}</div></div>
        </urbi-card>
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
    const chaves = this.calc ? chavesColapso(this.calc) : [];
    const novo: Record<string, boolean> = {};
    for (const k of chaves) novo[k] = recolher;
    this.colapso = novo;
  }

  private _t(chave: string) {
    this.colapso = { ...this.colapso, [chave]: !this.colapso[chave] };
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

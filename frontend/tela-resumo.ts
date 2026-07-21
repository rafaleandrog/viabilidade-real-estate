import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado } from './fluxo-graficos.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { montarMedidor } from './medidor-faixas.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarBenchmarks, buscarConfig,
} from './viabilidade-api.js';

// ─────────────────────────────────────────────────────────────────────────
// Aba RESUMO do Avançado (Lote 8 · #23).
//
// Frontend puro, sem lógica de entrada própria: consolida os resultados já
// calculados pelas outras abas em "poucos itens destacados":
//  · 8 KPIs — 4 do Fluxo de Caixa (VPL, TIR, Payback, Exposição máx.) e 4 do
//    Proforma (VGV, Resultado, Margem líquida, ROI). Seleção definida com o autor.
//  · 4 gráficos-chave — Fluxo Acumulado (curva S) e Fluxo Mensal (reusados de
//    fluxo-graficos, idênticos à aba Fluxo de Caixa), Composição de custos
//    (pizza) e Indicadores vs. benchmark (medidores), reusados de Cenários.
//
// Reuso: os gráficos de fluxo vêm de `fluxo-graficos.ts` (mesmas funções puras
// que a aba Fluxo de Caixa) e os medidores de `medidor-faixas.ts` — nada é
// recalculado aqui de forma divergente das outras abas.
// ─────────────────────────────────────────────────────────────────────────

const n = (v: any): number => Number(v) || 0;

@customElement('viab-tela-resumo')
export class ViabTelaResumo extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private calc: FluxoCalc | null = null;
  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  private dados: {
    crono: EventoCrono[]; dataInicio: string | null;
  } | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .graficos { display: flex; flex-direction: column; gap: 16px; }
    .lado-a-lado { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .medidores { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
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
      const [receitas, custos, curvas, crono, params, bm, cfg] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarBenchmarks(this.estudo.tipo_empreendimento),
        buscarConfig(),
      ]);
      const cronoDados: EventoCrono[] = crono?.erro ? [] : (crono.dados || []);
      const dataInicio = params?.erro ? null : (params.data_inicio_projeto ?? null);
      const config: FluxoConfig = {
        dataInicio,
        taxaDescontoAa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        cronograma: cronoDados,
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: custos?.erro ? [] : (custos.dados || []),
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: n(this.estudo?.terreno_manual_area) || n(this.estudo?.area_terreno_nucleo),
      };
      this.dados = { crono: cronoDados, dataInicio };
      this.calc = calcularFluxo(config);
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar o resumo', 'erro');
    }
    this.carregando = false;
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Consolidando o resumo..."></urbi-loading>`;
    const c = this.calc;
    if (!c || (c.linhasReceita.length === 0 && c.linhasCusto.length === 0)) {
      return html`
        <urbi-estado-vazio icone="fa-solid fa-gauge-high"
          mensagem="Defina o cronograma, as receitas e os custos nas outras abas para ver o resumo consolidado."></urbi-estado-vazio>`;
    }
    const p = calcularProforma({ ...this.estudo, aliquota_ret_pct: this.aliquotaRet } as ProformaInput);
    const dataInicio = this.dados?.dataInicio ?? null;
    const crono = this.dados?.crono ?? [];
    return html`
      ${this._renderKpis(c, p)}
      <div class="graficos">
        <urbi-card titulo="Fluxo de Caixa Acumulado">
          <div class="graf-wrap"><div class="graf">${graficoFluxoAcumulado(c, dataInicio, crono)}</div></div>
        </urbi-card>
        <urbi-card titulo="Fluxo de Caixa Mensal">
          <div class="graf-wrap"><div class="graf">${graficoFluxoMensal(c, dataInicio, crono)}</div></div>
        </urbi-card>
        <div class="lado-a-lado">
          <urbi-card titulo="Composição dos custos">${this._renderPizza(p)}</urbi-card>
          ${this._renderMedidores(p)}
        </div>
      </div>
    `;
  }

  private _renderKpis(c: FluxoCalc, p: Proforma): TemplateResult {
    const tirTxt = c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`;
    const tirVar = c.tir === null ? '' : (c.tir > 0 ? 'sucesso' : 'erro');
    return html`
      <div class="kpis">
        <urbi-kpi rotulo="VPL" .valor=${fmtR$(c.vpl)} variante=${c.vpl >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="TIR" .valor=${tirTxt} variante=${tirVar}></urbi-kpi>
        <urbi-kpi rotulo="Payback" .valor=${c.paybackData ?? '—'}></urbi-kpi>
        <urbi-kpi rotulo="Exposição máxima" .valor=${fmtR$(c.exposicaoMaxima)} variante="erro"></urbi-kpi>
        <urbi-kpi rotulo="VGV" .valor=${fmtR$(p.vgv)}></urbi-kpi>
        <urbi-kpi rotulo="Resultado" .valor=${fmtR$(p.resultado)} variante=${p.resultado >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="Margem líquida" .valor=${fmtPct(p.margemLiquidaPct)} variante=${p.margemLiquidaPct >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="ROI" .valor=${fmtPct(p.roiPct)} variante=${p.roiPct >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      </div>
    `;
  }

  // Composição de custos — espelha `_custos` de tela-graficos (mesma lista de
  // linhas do Proforma); pizza pelo primitivo urbi-grafico-pizza.
  private _renderPizza(p: Proforma): TemplateResult {
    const itens = [
      { l: 'Terreno', v: p.custoTerreno },
      { l: 'Infraestrutura', v: p.infraestrutura },
      { l: 'Construção', v: p.construcao },
      { l: 'Decoração', v: p.decoracao },
      { l: 'Gestão da construção', v: p.gestaoConstrucao },
      { l: 'Projetos', v: p.projetos },
      { l: 'Outorga', v: p.outorga },
      { l: 'Incorporação e registro', v: p.incorporacaoRegistro },
      { l: 'Manutenção', v: p.manutencao },
      { l: 'Contingências', v: p.contingencias },
      { l: 'Marketing global', v: p.marketingGlobal },
      { l: 'Gestão e indiretos', v: p.gestaoIndiretos },
    ].filter((i) => i.v > 0.005);
    if (itens.length === 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-pie" mensagem="Sem custos para exibir."></urbi-estado-vazio>`;
    }
    return html`
      <urbi-grafico-pizza
        formato="moeda"
        .categorias=${itens.map((i) => i.l)}
        .series=${[{ rotulo: 'Custos', valores: itens.map((i) => i.v) }]}
      ></urbi-grafico-pizza>
    `;
  }

  // Indicadores vs. benchmark — mesmos medidores da aba Cenários (montarMedidor).
  private _renderMedidores(p: Proforma): TemplateResult {
    const MAPA: Record<string, number> = {
      custo_obras_vgv: p.custoObrasVgvPct,
      margem_liquida: p.margemLiquidaPct,
    };
    const ROTULOS: Record<string, string> = {
      custo_obras_vgv: 'Custo obra / VGV',
      margem_liquida: 'Margem líquida',
    };
    const medidores = this.benchmarks
      .map((b) => {
        const val = MAPA[b.campo];
        if (val === undefined) return null;
        const cfg = montarMedidor(b, val);
        if (!cfg) return null;
        return html`<urbi-grafico-medidor
          rotulo=${ROTULOS[b.campo] ?? b.campo}
          .min=${cfg.min} .max=${cfg.max} .valor=${val}
          .faixas=${cfg.faixas}
          formato="porcentagem"
        ></urbi-grafico-medidor>`;
      })
      .filter((m) => m !== null);
    if (medidores.length === 0) return html`${nothing}`;
    return html`
      <urbi-card titulo="Indicadores vs. benchmark">
        <div class="medidores">${medidores}</div>
      </urbi-card>
    `;
  }
}

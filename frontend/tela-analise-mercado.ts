import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  precoMedioM2Projeto, custoObraM2Projeto, vsoProjetoPct, compararProjetoMercado,
  ROTULO_ABRANGENCIA, type Comparacao,
} from './analise-mercado.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  buscarAnaliseMercado,
} from './viabilidade-api.js';

// ─────────────────────────────────────────────────────────────────────────
// Aba ANÁLISE DE MERCADO do Avançado (#199) — projeto × mercado.
//
// Até o #199 esta aba renderizava o Apelo Comercial, que é outra coisa: o
// Apelo é um score qualitativo do ATIVO (localização, infraestrutura, vetor de
// crescimento…), não a comparação do projeto com o mercado. Com esta issue a
// aba passa a ser a análise de mercado de verdade e o Apelo ganha aba própria
// (decisão registrada no §4 da issue e em docs/viabilidade/analise-mercado.md).
//
// Dois lados, origens diferentes:
//  · PROJETO — derivado do próprio estudo (`analise-mercado.ts`), nunca
//    digitado. Existe sempre que o estudo tiver tipologias/custos/cronograma.
//  · MERCADO — snapshot persistido em `analise_mercado`, preenchido pela rota
//    de IA (#200). Enquanto ela não existe, o lado mercado vem vazio — e isso
//    é ESTADO DE PRIMEIRA CLASSE, não erro: a tela mostra o lado projeto
//    normalmente e explica o que falta.
// ─────────────────────────────────────────────────────────────────────────

const n = (v: any): number => Number(v) || 0;

@customElement('viab-tela-analise-mercado')
export class ViabTelaAnaliseMercado extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private calc: FluxoCalc | null = null;
  @state() private analise: any = null;
  private receitas: any[] = [];
  private crono: EventoCrono[] = [];
  private areaPrivativaTotal = 0;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .secao { margin-bottom: 18px; }
    .secao h3 {
      margin: 0 0 10px; font-size: var(--texto-rotulo, 0.75rem); font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .kpis urbi-kpi { min-width: 0; width: 100%; }

    /* Card de comparação: urbi-kpi declara só rotulo/valor/variante/formato —
       sem slot para o par projeto×mercado — então o card é markup próprio,
       usando os mesmos tokens do design system. */
    .comp {
      border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
      border-radius: 10px; padding: 12px 14px;
      background: var(--cor-superficie-elevada, rgba(255,255,255,0.03));
      min-width: 0;
    }
    .comp-rot {
      font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .comp-linha { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 8px; }
    .comp-linha .lado { font-size: 0.72rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; letter-spacing: 0.04em; }
    .comp-linha .val { font-variant-numeric: tabular-nums; font-weight: 700; }
    .comp-linha .val.projeto { font-size: 1.15rem; }
    .comp-delta { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.08)); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
    .comp-delta.acima { color: var(--cor-alerta, #e0a82a); }
    .comp-delta.abaixo { color: var(--cor-info, #2aa9e0); }
    .comp-delta.alinhado { color: var(--cor-sucesso, #13a98d); }
    .sem-dado { color: var(--cor-texto-fraco, rgba(255,255,255,0.4)); font-style: italic; }
    .nota { font-size: 0.78rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-top: 8px; }
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
      const [receitas, custos, curvas, crono, params, mercado] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        buscarAnaliseMercado(this.estudo.id),
      ]);
      this.receitas = receitas?.erro ? [] : (receitas.dados || []);
      this.crono = crono?.erro ? [] : (crono.dados || []);
      const config: FluxoConfig = {
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxaDescontoAa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        cronograma: this.crono,
        linhasReceita: this.receitas,
        linhasCusto: custos?.erro ? [] : (custos.dados || []),
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: n(this.estudo?.terreno_manual_area) || n(this.estudo?.area_terreno_nucleo),
      };
      // Custo de obra por m² sai das linhas JÁ RESOLVIDAS pelo motor, para não
      // reimplementar a resolução de unidade e divergir do Fluxo de Caixa.
      this.calc = calcularFluxo(config);
      this.areaPrivativaTotal = this.receitas.reduce(
        (s: number, l: any) => s + (l.tipologias ?? []).reduce(
          (si: number, t: any) => si + n(t.area_privativa_m2) * n(t.quantidade), 0), 0);
      this.analise = mercado?.erro ? null : (mercado?.analise ?? null);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar a análise de mercado', 'erro');
    }
    this.carregando = false;
  }

  render(): TemplateResult {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando análise de mercado..."></urbi-loading>`;

    const m = this.analise;
    const precoProjeto = precoMedioM2Projeto(this.receitas);
    const custoProjeto = custoObraM2Projeto(this.calc?.linhasCusto ?? [], this.areaPrivativaTotal);
    const vsoProjeto = vsoProjetoPct(this.receitas, this.crono);

    // Sem NENHUM lado: o estudo ainda não tem dados para comparar nada.
    if (precoProjeto === null && custoProjeto === null && vsoProjeto === null && !m) {
      return html`
        <urbi-estado-vazio icone="fa-solid fa-chart-simple"
          mensagem="Defina as tipologias, os custos e o cronograma nas outras abas para comparar o projeto com o mercado."></urbi-estado-vazio>`;
    }

    return html`
      <urbi-banner variante="info" icone="fa-solid fa-circle-info">
        Dados externos, apenas referência — não é recomendação de investimento.
      </urbi-banner>

      ${this._renderProcedencia()}

      <div class="secao">
        <h3>Projeto × mercado</h3>
        <div class="cards">
          ${this._cardComparacao('Preço de venda (R$/m²)', precoProjeto, m ? n(m.preco_medio_m2) : null, fmtR$)}
          ${this._cardComparacao('Custo de obra (R$/m²)', custoProjeto, m ? n(m.custo_obra_m2) : null, fmtR$)}
          ${this._cardComparacao('Velocidade de vendas (%/mês)', vsoProjeto, m ? n(m.vso_pct) : null, fmtPct)}
        </div>
        <p class="nota">
          Os números do projeto são derivados deste estudo — preço é o VGV sobre a área privativa,
          custo de obra é o total do grupo Obra sobre a mesma área, e a velocidade é a premissa de
          absorção lida como VSO. Não há nada a digitar aqui.
        </p>
      </div>

      ${this._renderMacro()}
    `;
  }

  /** Procedência do dado de mercado — inclusive quando não existe (#199). */
  private _renderProcedencia(): TemplateResult {
    const m = this.analise;
    if (!m) {
      return html`
        <urbi-banner variante="alerta" icone="fa-solid fa-triangle-exclamation">
          Ainda não há dados de mercado para este estudo. Os números do projeto abaixo já estão
          calculados; a comparação aparece quando a análise de mercado for gerada.
        </urbi-banner>`;
    }
    const abr = String(m.abrangencia || 'municipio');
    const local = String(m.localidade || '').trim();
    return html`
      <p class="nota">
        Referência ${ROTULO_ABRANGENCIA[abr] ?? abr}${local ? html` — ${local}` : nothing}${m.data_referencia ? html` · ${m.data_referencia}` : nothing}${m.origem ? html` · fonte: ${m.origem}` : nothing}.
        ${abr !== 'municipio' ? html`
          <br />Sem série para o município do empreendimento; a comparação usa a abrangência
          ${ROTULO_ABRANGENCIA[abr] ?? abr}, que é mais ampla e menos específica.` : nothing}
      </p>
    `;
  }

  private _cardComparacao(
    rotulo: string,
    projeto: number | null,
    mercado: number | null,
    fmt: (v: number) => string,
  ): TemplateResult {
    const cmp: Comparacao | null = compararProjetoMercado(projeto, mercado);
    return html`
      <div class="comp">
        <div class="comp-rot">${rotulo}</div>
        <div class="comp-linha">
          <span class="lado">Projeto</span>
          <span class="val projeto">${projeto === null ? html`<span class="sem-dado">—</span>` : fmt(projeto)}</span>
        </div>
        <div class="comp-linha">
          <span class="lado">Mercado</span>
          <span class="val">${mercado === null || mercado === 0 ? html`<span class="sem-dado">sem dado</span>` : fmt(mercado)}</span>
        </div>
        ${cmp ? html`
          <div class="comp-delta ${cmp.posicao}">
            ${cmp.posicao === 'alinhado'
              ? 'Alinhado com o mercado'
              : html`${fmtPct(Math.abs(cmp.deltaPct))} ${cmp.posicao} do mercado (${fmt(Math.abs(cmp.delta))})`}
          </div>` : nothing}
      </div>
    `;
  }

  private _renderMacro(): TemplateResult {
    const m = this.analise;
    if (!m) return html`${nothing}`;
    const macros: { rotulo: string; valor: any }[] = [
      { rotulo: 'IPCA (12m)', valor: m.ipca_pct },
      { rotulo: 'Selic', valor: m.selic_pct },
      { rotulo: 'INCC (12m)', valor: m.incc_pct },
      { rotulo: 'Focus · IPCA', valor: m.focus_ipca_pct },
      { rotulo: 'Focus · Selic', valor: m.focus_selic_pct },
    ].filter((x) => x.valor !== null && x.valor !== undefined);
    if (macros.length === 0) return html`${nothing}`;
    return html`
      <div class="secao">
        <h3>Indicadores macro</h3>
        <div class="kpis">
          ${macros.map((x) => html`
            <urbi-kpi rotulo=${x.rotulo} .valor=${fmtPct(Number(x.valor))}></urbi-kpi>`)}
        </div>
      </div>
    `;
  }
}

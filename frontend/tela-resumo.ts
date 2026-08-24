import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado } from './fluxo-graficos.js';
import { GRUPOS_CUSTO, GRUPO_CUSTO_LABEL } from './fluxo-tabela.js';
import { montarMedidor } from './medidor-faixas.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarBenchmarks,
} from './viabilidade-api.js';

// ─────────────────────────────────────────────────────────────────────────
// Aba RESUMO do Avançado (Lote 8 · #23).
//
// Frontend puro, sem lógica de entrada própria: consolida os resultados já
// calculados pelas outras abas em "poucos itens destacados":
//  · 7 KPIs — 3 do Fluxo de Caixa (VPL, TIR, Exposição máx.) e 4 "de negócio"
//    (VGV potencial, Resultado, Margem de caixa, ROI sobre custo total).
//    Seleção definida com o autor. #325 removeu daqui Payback, VGV vendável e
//    VGV em permuta física.
//
//    #443: os quatro rótulos "de negócio" foram renomeados — "VGV"→"VGV
//    potencial", "Margem líquida"→"Margem de caixa", "ROI"→"ROI sobre custo
//    total" — para não colidir com os rótulos homônimos que outras telas
//    usam para FÓRMULAS DIFERENTES (Painel, Proforma do Avançado, Proforma
//    do Preliminar). Nenhum número muda; ver `frontend/rotulos-indicador.ts`
//    para o inventário completo rótulo → fórmula-fonte.
//  · 4 gráficos-chave — Fluxo Acumulado (curva S) e Fluxo Mensal (reusados de
//    fluxo-graficos, idênticos à aba Fluxo de Caixa), Composição de custos
//    (pizza) e Indicadores vs. benchmark (medidores), reusados de Cenários.
//
// Reuso: os gráficos de fluxo vêm de `fluxo-graficos.ts` (mesmas funções puras
// que a aba Fluxo de Caixa) e os medidores de `medidor-faixas.ts` — nada é
// recalculado aqui de forma divergente das outras abas.
//
// #182/#183/#184: esta tela NÃO consome mais `proforma.ts`. Os KPIs, os
// medidores e a pizza de custos vinham de `calcularProforma`, que só lê colunas
// estáticas de `estudos` (as Premissas, removidas do Avançado no #88) — num
// estudo criado direto como Avançado saíam todos zerados. Tudo agora deriva do
// `FluxoCalc`; o Proforma segue sendo a fonte do PRELIMINAR (tela-proforma,
// tela-graficos), onde aquelas colunas existem e são editáveis.
// ─────────────────────────────────────────────────────────────────────────

const n = (v: any): number => Number(v) || 0;

@customElement('viab-tela-resumo')
export class ViabTelaResumo extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private calc: FluxoCalc | null = null;
  @state() private benchmarks: any[] = [];
  // #184: visão da pizza de custos — '' = macro (uma fatia por grupo); um id de
  // grupo abre em uma fatia por linha daquele grupo.
  @state() private grupoPizza = '';
  private dados: {
    crono: EventoCrono[]; dataInicio: string | null;
  } | null = null;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    /* ⚠️ NÃO volte a impor largura ao urbi-kpi daqui de fora. O :host dele soma
       padding: 14px 16px + border: 1px e não declara box-sizing: border-box,
       então width: 100% é largura de CONTEÚDO: a caixa mede 34px a mais que a
       track e pinta sobre o vizinho. Reportado quatro vezes (#176, #262, #326,
       #352) e fechado quatro; a #326 chegou a embrulhar o KPI num div
       intermediário, mas manteve o width e só o desceu um nível.
       O item de grid com stretch já dimensiona a BORDER box — é por isso que
       o Preliminar sempre esteve certo. Esta regra é textualmente a dele
       (tela-proforma.ts:53), e o guard-box-model-urbi mais o render-check de
       frontend/render/kpis-resumo.render.test.ts guardam as duas pontas. */
    .kpis urbi-kpi { min-width: 0; }
    .graficos { display: flex; flex-direction: column; gap: 16px; }
    .lado-a-lado { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .medidores { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .graf svg { display: block; width: 100%; height: auto; min-width: 560px; }
    .graf-wrap { overflow-x: auto; }
    /* #184: seletor macro/por grupo acima da pizza de composição de custos. */
    .pizza-ctrl { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .pizza-ctrl urbi-select { flex: 1; min-width: 180px; }
    .pizza-rot {
      font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
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
      const [receitas, custos, curvas, crono, params, bm] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarBenchmarks(this.estudo.tipo_empreendimento),
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
        // #346: RET global (era por Grupo, avancado_fases.fluxo_pagamento.ret).
        ret: params?.erro ? undefined : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
      };
      this.dados = { crono: cronoDados, dataInicio };
      this.calc = calcularFluxo(config);
      this.benchmarks = bm?.dados || [];
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
    const k = this._kpisAvancado(c);
    const dataInicio = this.dados?.dataInicio ?? null;
    const crono = this.dados?.crono ?? [];
    return html`
      ${this._renderKpis(c, k)}
      <div class="graficos">
        <urbi-card titulo="Fluxo de Caixa Acumulado">
          <div class="graf-wrap"><div class="graf">${graficoFluxoAcumulado(c, dataInicio, crono)}</div></div>
        </urbi-card>
        <urbi-card titulo="Fluxo de Caixa Mensal">
          <div class="graf-wrap"><div class="graf">${graficoFluxoMensal(c, dataInicio, crono)}</div></div>
        </urbi-card>
        <div class="lado-a-lado">
          <urbi-card titulo="Composição dos custos">${this._renderPizza(c)}</urbi-card>
          ${this._renderMedidores(k)}
        </div>
      </div>
    `;
  }

  // #182/#183: os KPIs "de negócio" (VGV, Resultado, Margem líquida, ROI,
  // Custo obras/VGV) vinham do Proforma (`calcularProforma`), que só lê
  // colunas estáticas de `estudos` (Premissas) — removidas do Avançado no
  // #88. Num estudo criado direto como Avançado essas colunas são NULL e os
  // KPIs saíam zerados, mesmo com receitas/custos preenchidos nas outras
  // abas. Os dados certos já estão no `FluxoCalc` carregado (mesma fonte dos
  // KPIs de fluxo, que sempre estiveram corretos) — calculados uma vez aqui e
  // reusados pelos KPIs (#182) e pelos medidores vs. benchmark (#183).
  // #474 (Passos 23–25, D-Q03 2026-08-22): `resultado` abaixo remonta
  // `resultadoFinal` = `fluxoAcumulado[último]` — a MESMA remontagem que os
  // outros quatro consumidores fazem, cada um do seu jeito (R-A36). Esta
  // função NÃO chama `fundingDoEstudo` (é a leitura "de caixa" do Resumo,
  // #443 "Margem de caixa") mas remonta o mesmo `resultadoFinal` da sequência
  // descrita em
  // `docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`. Fonte
  // única foi CONSIDERADA E RECUSADA pelo autor — ver
  // `docs/viabilidade/fluxo-investidor-formulas.md` §9. Os outros quatro:
  // frontend/tela-fluxo-ver.ts:169 · frontend/tela-funding.ts:207 ·
  // frontend/tela-cenarios.ts:230 · scripts/conferir-estudo.ts:142.
  private _kpisAvancado(c: FluxoCalc) {
    const vgv = c.vgvTotal;
    const resultado = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] || 0;
    const custoTotal = c.linhasCusto.reduce((s, l) => s + l.total, 0);
    const custoObras = c.linhasCusto.filter((l) => l.grupo === 'obra').reduce((s, l) => s + l.total, 0);
    return {
      vgv, resultado,
      margemLiquidaPct: vgv > 0 ? (resultado / vgv) * 100 : 0,
      roiPct: custoTotal > 0 ? (resultado / custoTotal) * 100 : 0,
      custoObrasVgvPct: vgv > 0 ? (custoObras / vgv) * 100 : 0,
    };
  }

  private _renderKpis(c: FluxoCalc, k: ReturnType<ViabTelaResumo['_kpisAvancado']>): TemplateResult {
    const tirTxt = c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`;
    const tirVar = c.tir === null ? '' : (c.tir > 0 ? 'sucesso' : 'erro');
    return html`
      <div class="kpis">
        <urbi-kpi rotulo="VPL" .valor=${fmtR$(c.vpl)} variante=${c.vpl >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="TIR" .valor=${tirTxt} variante=${tirVar}></urbi-kpi>
        <!-- #353: exibida como magnitude (módulo) — sem cenário base para
             comparar aqui, a variante fica fixa em "erro" (é sempre risco). -->
        <urbi-kpi rotulo="Exposição máxima" .valor=${fmtR$(Math.abs(c.exposicaoMaxima))} variante="erro"></urbi-kpi>
        <urbi-kpi rotulo="VGV potencial" .valor=${fmtR$(k.vgv)}></urbi-kpi>
        <urbi-kpi rotulo="Resultado" .valor=${fmtR$(k.resultado)} variante=${k.resultado >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="Margem de caixa" .valor=${fmtPct(k.margemLiquidaPct)} variante=${k.margemLiquidaPct >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="ROI sobre custo total" .valor=${fmtPct(k.roiPct)} variante=${k.roiPct >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      </div>
    `;
  }

  /**
   * Composição de custos (#184). Antes montava 12 fatias a partir do Proforma
   * (`calcularProforma`), que só lê colunas estáticas de `estudos` (as
   * Premissas, removidas do Avançado no #88) — num estudo criado direto como
   * Avançado todas as 12 eram zero e a pizza saía SEMPRE vazia. Mesma causa
   * raiz do #182/#183; agora a fonte é `c.linhasCusto`, o mesmo array que
   * alimenta o Custo Total da tabela do Fluxo de Caixa (`custoMensal` é a soma
   * dessas linhas), então a pizza fecha com aquele total por construção.
   *
   * `grupoPizza` vazio = visão MACRO (uma fatia por grupo de custo); com um
   * grupo selecionado, abre em uma fatia por linha daquele grupo (agregando
   * linhas de mesmo nome).
   */
  private _renderPizza(c: FluxoCalc): TemplateResult {
    const doGrupo = (g: string) => c.linhasCusto.filter((l) => l.grupo === g);
    const comCusto = GRUPOS_CUSTO.filter((g) => doGrupo(g).reduce((s, l) => s + l.total, 0) > 0.005);
    if (comCusto.length === 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-pie" mensagem="Sem custos para exibir."></urbi-estado-vazio>`;
    }
    // Grupo selecionado que ficou sem custo (mudança nas outras abas) volta ao macro.
    const sel = comCusto.includes(this.grupoPizza as any) ? this.grupoPizza : '';
    let itens: { l: string; v: number }[];
    if (sel) {
      const porNome = new Map<string, number>();
      for (const l of doGrupo(sel)) porNome.set(l.nome, (porNome.get(l.nome) ?? 0) + l.total);
      itens = [...porNome].map(([l, v]) => ({ l, v }));
    } else {
      itens = comCusto.map((g) => ({
        l: GRUPO_CUSTO_LABEL[g],
        v: doGrupo(g).reduce((s, l) => s + l.total, 0),
      }));
    }
    itens = itens.filter((i) => i.v > 0.005);
    return html`
      <div class="pizza-ctrl">
        <span class="pizza-rot">Ver por</span>
        <urbi-select
          .valor=${sel}
          .opcoes=${[{ valor: '', rotulo: 'Custo macro (todos os grupos)' },
            ...comCusto.map((g) => ({ valor: g, rotulo: GRUPO_CUSTO_LABEL[g] }))]}
          @urbi:select-change=${(e: CustomEvent) => { this.grupoPizza = e.detail.valor; }}
        ></urbi-select>
      </div>
      ${itens.length === 0
        ? html`<urbi-estado-vazio icone="fa-solid fa-chart-pie" mensagem="Sem custos para exibir."></urbi-estado-vazio>`
        : html`
          <urbi-grafico-pizza
            formato="moeda"
            .categorias=${itens.map((i) => i.l)}
            .series=${[{ rotulo: 'Custos', valores: itens.map((i) => i.v) }]}
          ></urbi-grafico-pizza>`}
    `;
  }

  // Indicadores vs. benchmark — mesmos medidores da aba Cenários (montarMedidor).
  // #183: vinham do Proforma (zerados no Avançado, mesma causa do #182) — agora
  // usam os KPIs derivados do FluxoCalc (`_kpisAvancado`).
  private _renderMedidores(k: ReturnType<ViabTelaResumo['_kpisAvancado']>): TemplateResult {
    const MAPA: Record<string, number> = {
      custo_obras_vgv: k.custoObrasVgvPct,
      margem_liquida: k.margemLiquidaPct,
    };
    const ROTULOS: Record<string, string> = {
      // "Custo obras / VGV" (plural) — mesmo rótulo usado em exportar.ts,
      // tela-premissas.ts e tela-proforma.ts (o singular era inconsistência).
      custo_obras_vgv: 'Custo obras / VGV',
      // #443: "Margem de caixa" — mesmo rótulo do KPI acima (`_renderKpis`),
      // mesma fórmula (`k.margemLiquidaPct` = fluxoAcumulado/vgvTotal). NÃO
      // usar "Margem líquida" aqui: esse rótulo já está reservado ao Preliminar
      // (`resultado/vgv`, ver `frontend/rotulos-indicador.ts`).
      margem_liquida: 'Margem de caixa',
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

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$Kpi, fmtPct, fmtPctOuIndef } from './viab-format.js';
import { type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import { graficoFluxoMensal, graficoFluxoAcumulado } from './fluxo-graficos.js';
import { GRUPOS_CUSTO, GRUPO_CUSTO_LABEL } from './fluxo-tabela.js';
import { montarMedidor } from './medidor-faixas.js';
import { resolverIndicadoresBenchmark } from './benchmarks-indicadores.js';
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
    /* #579: track alargada de 180 para 230px — o VALOR de um KPI de 9 dígitos
       (R$ 171.448.400,00, o exemplo literal da issue) não cabe nos 180px
       herdados da #488, que resolveu a CAIXA (contra a track), não o VALOR
       (contra a caixa). urbi-kpi não declara prop de quebra/tamanho de fonte
       (docs/ui-urbiverso/primitivos.json), e o :host dele soma padding:
       14px 16px ao conteúdo — folga real de ~198px, medida contra o caso de
       render kpis-resumo (frontend/render/kpis-resumo.render.test.ts).
       NÃO é herança de overflow-wrap/word-break pelo shadow boundary: medi
       (não presumi, ver critério 2 da #579) que essas propriedades atravessam
       o boundary mas NÃO revertem um white-space: nowrap interno do primitivo
       real — é o mesmo mecanismo que o stub do harness reproduz
       (scripts/render-check.mjs:304-308). Alargar a track é a única defesa
       que não depende de markup interno que este repo não enxerga. */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-bottom: 20px; }
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
    .medidor-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
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
        // #473: default true preserva o comportamento histórico (VGV bruto).
        corretagemSobrePermutaFisica: this.estudo?.corretagem_sobre_permuta_fisica !== false,
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
  // frontend/tela-fluxo-ver.ts:179 · frontend/tela-funding.ts:239 ·
  // frontend/tela-cenarios.ts:240 · scripts/conferir-estudo.ts:153.
  private _kpisAvancado(c: FluxoCalc) {
    const vgv = c.vgvTotal;
    const resultado = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] || 0;
    const custoTotal = c.linhasCusto.reduce((s, l) => s + l.total, 0);
    const custoObras = c.linhasCusto.filter((l) => l.grupo === 'obra').reduce((s, l) => s + l.total, 0);
    return {
      vgv, resultado,
      // #571: `null`, não 0 — mesmo padrão do Preliminar (`proforma.ts`):
      // vgv ≤ 0 é "sem base", não "margem zero".
      margemLiquidaPct: vgv > 0 ? (resultado / vgv) * 100 : null,
      roiPct: custoTotal > 0 ? (resultado / custoTotal) * 100 : 0,
      custoObrasVgvPct: vgv > 0 ? (custoObras / vgv) * 100 : null,
    };
  }

  private _renderKpis(c: FluxoCalc, k: ReturnType<ViabTelaResumo['_kpisAvancado']>): TemplateResult {
    const tirTxt = c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`;
    const tirVar = c.tir === null ? '' : (c.tir > 0 ? 'sucesso' : 'erro');
    return html`
      <div class="kpis">
        <urbi-kpi rotulo="VPL" .valor=${fmtR$Kpi(c.vpl)} variante=${c.vpl >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="TIR" .valor=${tirTxt} variante=${tirVar}></urbi-kpi>
        <!-- #353: exibida como magnitude (módulo) — sem cenário base para
             comparar aqui, a variante fica fixa em "erro" (é sempre risco). -->
        <urbi-kpi rotulo="Exposição máxima" .valor=${fmtR$Kpi(Math.abs(c.exposicaoMaxima))} variante="erro"></urbi-kpi>
        <urbi-kpi rotulo="VGV potencial" .valor=${fmtR$Kpi(k.vgv)}></urbi-kpi>
        <urbi-kpi rotulo="Resultado" .valor=${fmtR$Kpi(k.resultado)} variante=${k.resultado >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        <urbi-kpi rotulo="Margem de caixa" .valor=${fmtPctOuIndef(k.margemLiquidaPct)}
          variante=${k.margemLiquidaPct === null ? '' : (k.margemLiquidaPct >= 0 ? 'sucesso' : 'erro')}></urbi-kpi>
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
  //
  // #451 (etapa 1, metade que faltava do PR 533): o mapa campo→indicador e o
  // descarte-com-motivo (`custo_obras`/`preco`/`permuta_*` = sensibilidade,
  // `margem_bruta` = sem fonte até a #453 ligar de verdade) vêm da tabela
  // ÚNICA `benchmarks-indicadores.ts`, compartilhada com `tela-graficos.ts`
  // (o Preliminar) — mesmo padrão dos 4 campos. Cada tela continua resolvendo
  // o VALOR na sua própria fonte (aqui, `_kpisAvancado`/`FluxoCalc`); não
  // unifica valores — isso é a alternativa (a) recusada pela D-Q03 (#443).
  //
  // ⚠️ `margem_liquida` e `roi` NÃO usam o rótulo devolvido pela tabela
  // compartilhada. Os dois já têm rótulo próprio, registrado em
  // `rotulos-indicador.ts`, para a MESMA fórmula usada aqui ("Margem de
  // caixa" = fluxoAcumulado/vgvTotal; "ROI sobre custo total" =
  // resultado/custoTotal — os dois em `_kpisAvancado`, `_renderKpis` acima).
  // O rótulo compartilhado representa uma fórmula DIFERENTE no Preliminar
  // ("Margem sobre VGV" = resultado/vgv; "ROI" bare = resultado/investimentoTotal,
  // só direto+indireto) — reusá-lo aqui reabriria a MESMA colisão rótulo↔fórmula
  // que a #443 fechou para os dois, dentro do MESMO arquivo. `resultado_final`
  // não tem rótulo próprio pré-existente no Avançado, então segue o
  // compartilhado ("Resultado final"), igual ao Preliminar.
  private static readonly ROTULO_OVERRIDE: Partial<Record<string, string>> = {
    margem_liquida: 'Margem de caixa',
    roi: 'ROI sobre custo total',
  };

  private _renderMedidores(k: ReturnType<ViabTelaResumo['_kpisAvancado']>): TemplateResult {
    // #571: vgv ≤ 0 → `k.custoObrasVgvPct`/`k.margemLiquidaPct` chegam `null`;
    // `montarMedidor` é null-seguro e não desenha o medidor sem valor definido.
    const { exibiveis } = resolverIndicadoresBenchmark(this.benchmarks, {
      custo_obras_vgv: k.custoObrasVgvPct,
      margem_liquida: k.margemLiquidaPct,
      resultado_final: k.margemLiquidaPct,
      roi: k.roiPct,
    });
    const medidores = exibiveis
      .map(({ benchmark, campo, rotulo, valor }) => {
        const cfg = montarMedidor(benchmark, valor);
        if (!cfg) return null;
        return html`<div class="medidor-item">
          <urbi-grafico-medidor
            rotulo=${ViabTelaResumo.ROTULO_OVERRIDE[campo] ?? rotulo}
            .min=${cfg.min} .max=${cfg.max} .valor=${valor}
            .faixas=${cfg.faixas}
            formato="porcentagem"
          ></urbi-grafico-medidor>
          ${cfg.foraEscala
            ? html`<urbi-badge cor="alerta" class="fora-escala">Fora da escala</urbi-badge>`
            : nothing}
        </div>`;
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

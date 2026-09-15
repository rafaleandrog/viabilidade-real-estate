import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$Kpi, fmtR$, fmtM2, fmtPctOuIndef } from './viab-format.js';
import {
  calcularProforma, eficienciaParaFaixa, roiParaFaixa, vgvBrutoDeProforma,
  type Proforma, type ProformaInput,
} from './proforma.js';
import {
  calcularCascata, CASCATA_LOTEAMENTO, CASCATA_INCORPORACAO,
  estadosCascataLoteamentoDoEstudo, estadosCascataIncorporacaoDoEstudo, etapasCadeiaAreas,
  type LinhaResolvida,
} from './areas-cascata.js';
import { listarBenchmarks, buscarConfig, listarProdutosPreliminar } from './viabilidade-api.js';
// A mesma guarda de corrida que `viab-imagem-principal.ts` usa nos três pontos
// do seu `_carregar()`. Reusada, e não recopiada: a cópia inline divergiria da
// função que o teste exercita.
import { respostaAindaVale } from './viab-imagem-principal.js';
import { montarMedidor } from './medidor-faixas.js';
import { resolverIndicadoresBenchmark } from './benchmarks-indicadores.js';
import { calcularCascataResultado } from './cascata-resultado-motor.js';
import './grafico-cascata.js';
import './grafico-barra-ranqueada.js';
import './grafico-cadeia-areas.js';

@customElement('viab-tela-graficos')
export class ViabTelaGraficos extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @state() private excluirTerreno = false;
  // Rodada 12 — a cascata do resultado expande o detalhamento de "Custo
  // direto total" por categoria (barra ranqueada) ao clicar na linha.
  @state() private custoExpandido = false;
  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  // O catálogo de Produtos é a fonte do VGV (`frontend/proforma.ts`). Sem ele
  // esta aba calculava com a mesma entrada da Proforma menos os produtos — ou
  // seja, outro VGV — e desenhava gráfico e medidores de um estudo diferente
  // do que a aba ao lado mostra.
  @state() private produtos: any[] = [];
  // Achado real da revisão (Codex, P2, PR #707): `produtos` nasce `[]` a
  // cada `_init()`, antes do catálogo carregar — sem este estado, a faixa
  // de consistência lia um catálogo vazio como "0 m² alocado" e desenhava
  // o aviso "ainda faltam alocar" numa piscada, mesmo em estudo consistente
  // (e para sempre, se a mesma `Promise.all` de benchmarks/config falhar).
  @state() private produtosCarregados = false;
  private _idCarregado: number | null = null;

  static styles = [estiloConteudo, css`
    .graficos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .graficos + .graficos { margin-top: 16px; }
    .medidores { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .medidor-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .resultado { margin-top: 12px; }
    /* Rodada 12 (handoff §3.1) — faixa de 5 KPIs com denominador visível. */
    .kpis-preliminar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .kpi-rotulo {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    }
    .kpi-valor {
      font-size: 20px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
    }
    .kpi-rodape {
      font-size: 11px;
      color: var(--cor-texto-fraco, rgba(255, 255, 255, 0.4));
    }
    .detalhamento-custo { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--cor-borda, rgba(255, 255, 255, 0.12)); }
    .detalhamento-custo urbi-checkbox { display: block; margin-bottom: 8px; }
    urbi-banner.aviso-consistencia { display: block; margin-bottom: 16px; }
  `];

  connectedCallback() { super.connectedCallback(); this._init(); }
  updated(ch: Map<string, unknown>) {
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  /**
   * ⚠️ Duas chamadas de `_init()` podem estar em voo ao mesmo tempo — navegar
   * do estudo A para o B dispara a segunda antes de a primeira responder, e
   * não há ordem garantida entre duas fetches HTTP. Sem guarda, a resposta de
   * A pode chegar por último e colar o catálogo de A num componente que já
   * mostra B: VGV, gráficos e medidores do estudo errado, sem nada indicando.
   *
   * São duas defesas, e as duas são necessárias:
   *   · o catálogo é LIMPO na troca de estudo — senão o de A fica na tela
   *     durante o carregamento de B, e PERMANECE se a busca de B falhar;
   *   · o id é capturado antes das chamadas e conferido depois, e a resposta
   *     que ficou para trás é descartada em silêncio (quem atualiza a tela é
   *     a chamada mais nova).
   */
  private async _init() {
    if (!this.estudo) return;
    const id = this.estudo.id;
    this._idCarregado = id ?? null;
    this.produtos = [];
    this.produtosCarregados = false;
    // Achado real da revisão (Codex, P2, rodada 3 do PR #707): produtos
    // não pode ficar preso ao MESMO Promise.all de benchmarks/config — se
    // `/preliminar/produtos` responde mas um dos outros dois falha,
    // `produtosCarregados` tem que virar `true` do mesmo jeito, senão a
    // faixa de consistência fica em branco para sempre mesmo com o
    // catálogo já conhecido. As duas cargas resolvem independentes.
    listarProdutosPreliminar(id).then((prod) => {
      if (!respostaAindaVale(id, this.estudo?.id)) return;
      this.produtos = prod?.dados || [];
      this.produtosCarregados = true;
    }).catch((e) => console.error(e));
    try {
      const [bm, cfg] = await Promise.all([
        listarBenchmarks(this.estudo.tipo_empreendimento), buscarConfig(),
      ]);
      if (!respostaAindaVale(id, this.estudo?.id)) return; // o estudo mudou enquanto isto estava em voo
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
    } catch (e) { console.error(e); }
  }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma({ ...this.estudo, aliquota_ret_pct: this.aliquotaRet, produtos: this.produtos } as ProformaInput);
    return html`
      ${this._renderKpisPreliminar(p)}
      ${this._renderConsistencia(p)}
      <div class="graficos">
        <urbi-card titulo="Cascata do resultado">
          ${this._renderCascata(p)}
        </urbi-card>
      </div>
      ${this._renderAlocacaoAreas(p, lot)}
      ${this._renderMedidores(p)}
    `;
  }

  // Rodada 12 (handoff de KPIs/gráficos §3.1) — faixa de 5 KPIs independentes,
  // cada um com denominador visível no rodapé (requisito, não enfeite). Usa
  // `urbi-card` (não `urbi-kpi`): o primitivo `urbi-kpi` não tem slot/prop de
  // rodapé e carrega um bug conhecido de box-model (recorrente em
  // #176/#262/#326/#352) — `urbi-card` não tem esse risco
  // (`docs/ui-urbiverso/primitivos.json`).
  //
  // #1 e #2 usam `fmtR$Kpi` (sem casas decimais) — a exceção declarada de
  // card de KPI (#581, `frontend/viab-format.ts:52`); entram no inventário
  // fechado de `frontend/kpi-casas-decimais.test.ts`. #3–#5 são percentuais
  // (`fmtPctOuIndef`, 1 casa, "—" quando o denominador é ≤0 — nunca "0,0%").
  private _renderKpisPreliminar(p: Proforma): TemplateResult {
    const vgvBruto = vgvBrutoDeProforma(p);
    const margemVgvTabela = vgvBruto > 0 ? (p.resultado / vgvBruto) * 100 : null;
    const margemReceitaLiquida = p.receitaLiquida > 0 ? (p.resultado / p.receitaLiquida) * 100 : null;
    const obraSobreVgvTabela = vgvBruto > 0 ? (p.custoObras / vgvBruto) * 100 : null;
    const kpis: { rotulo: string; valor: string; rodape: string }[] = [
      { rotulo: 'VGV do incorporador', valor: fmtR$Kpi(p.vgv), rodape: `VGV de tabela: ${fmtR$(vgvBruto)}` },
      { rotulo: 'Resultado final', valor: fmtR$Kpi(p.resultado), rodape: 'após indiretos' },
      { rotulo: 'Margem sobre VGV de tabela', valor: fmtPctOuIndef(margemVgvTabela), rodape: 'base: VGV de tabela' },
      { rotulo: 'Margem sobre receita líquida', valor: fmtPctOuIndef(margemReceitaLiquida), rodape: 'base: receita líquida' },
      {
        rotulo: 'Custo obras / VGV',
        valor: fmtPctOuIndef(p.custoObrasVgvPct),
        rodape: `sobre VGV de tabela: ${fmtPctOuIndef(obraSobreVgvTabela)}`,
      },
    ];
    return html`
      <div class="kpis-preliminar">
        ${kpis.map((k) => html`
          <urbi-card>
            <div class="kpi-card">
              <span class="kpi-rotulo">${k.rotulo}</span>
              <span class="kpi-valor">${k.valor}</span>
              <span class="kpi-rodape">${k.rodape}</span>
            </div>
          </urbi-card>
        `)}
      </div>
    `;
  }

  private _custos(p: Proforma, excluirTerreno = this.excluirTerreno) {
    const itens = [
      { l: 'Terreno', v: p.custoTerreno, terreno: true },
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
    ];
    return itens.filter((i) => i.v > 0.005 && !(i.terreno && excluirTerreno));
  }

  // Rodada 12 (handoff §4.1) — cascata horizontal do resultado, substituindo
  // a pizza de custos e o gráfico de barras Receita×Custos. Clicar na linha
  // "Custo direto total" expande o detalhamento por categoria abaixo, como
  // barra ranqueada (regra 6 do handoff: pizza com mais de 4 fatias vira
  // barra horizontal ranqueada) — é ali, e não mais na pizza, que mora o
  // toggle "excluir terreno".
  private _renderCascata(p: Proforma): TemplateResult {
    const etapas = calcularCascataResultado(p);
    return html`
      <viab-grafico-cascata
        .etapas=${etapas}
        .idExpandivel=${'custo_direto'}
        @viab:cascata-linha-click=${() => { this.custoExpandido = !this.custoExpandido; }}
      ></viab-grafico-cascata>
      ${this.custoExpandido ? html`
        <div class="detalhamento-custo">
          <urbi-checkbox
            label="Excluir custo de aquisição do terreno"
            ?marcado=${this.excluirTerreno}
            @urbi:checkbox-change=${(e: CustomEvent) => this.excluirTerreno = e.detail.marcado}
          ></urbi-checkbox>
          <viab-grafico-barra-ranqueada .itens=${this._custos(p)}></viab-grafico-barra-ranqueada>
        </div>
      ` : nothing}
    `;
  }

  // Rodada 12 (handoff §4.4) — cadeia de áreas, substituindo a(s) pizza(s) de
  // alocação de área. Loteamento: poligonal → parcelável → líquida → ALV.
  // Incorporação: terreno → construída total → privativa total. A eficiência
  // (ALV/poligonal no Loteamento, privativa/construída na Incorporação) vai
  // ao lado, não numa pizza à parte — é o "número" que o handoff pede.
  //
  // ⚠️ #574 (histórico, preservado do que esta função substitui): até
  // 2026-08-27 a pizza do Loteamento era montada a partir de 7 campos "% da
  // gleba" já aposentados pela migração `020` — a cascata de áreas (mesma
  // fonte que Premissas edita e que o motor usa para a área vendável) já
  // corrigiu isso, e `etapasCadeiaAreas` consome essa MESMA cascata.
  private _renderAlocacaoAreas(p: Proforma, lot: boolean): TemplateResult {
    const e = this.estudo;
    const linhas = lot
      ? calcularCascata(CASCATA_LOTEAMENTO, estadosCascataLoteamentoDoEstudo(e), p.areaTerreno)
      : calcularCascata(CASCATA_INCORPORACAO, estadosCascataIncorporacaoDoEstudo(e), p.areaTerreno);
    const etapas = etapasCadeiaAreas(linhas, lot);
    if (etapas.every((et) => et.m2 <= 0.005)) {
      return html`<div class="graficos">
        <urbi-card titulo="Cadeia de áreas">
          <urbi-estado-vazio icone="fa-solid fa-layer-group" mensagem="Defina as áreas nas Premissas."></urbi-estado-vazio>
        </urbi-card>
      </div>`;
    }
    return html`<div class="graficos">
      <urbi-card titulo="Cadeia de áreas">
        <viab-grafico-cadeia-areas
          .etapas=${etapas}
          rotuloEficiencia=${lot ? 'ALV / poligonal' : 'Privativa / construída'}
          .eficienciaPct=${this._eficienciaCadeia(etapas, lot)}
        ></viab-grafico-cadeia-areas>
      </urbi-card>
    </div>`;
  }

  private _eficienciaCadeia(etapas: LinhaResolvida[], lot: boolean): number | null {
    if (lot) {
      const poligonal = etapas[0]?.m2 ?? 0;
      const alv = etapas[etapas.length - 1]?.m2 ?? 0;
      return poligonal > 0 ? (alv / poligonal) * 100 : null;
    }
    const construida = etapas.find((l) => l.id === 'construida_total')?.m2 ?? 0;
    const privativa = etapas.find((l) => l.id === 'privativa_total')?.m2 ?? 0;
    return construida > 0 ? (privativa / construida) * 100 : null;
  }

  // Rodada 12 (handoff §4.5) — faixa de consistência: reexibe (não recalcula)
  // a mesma trava que `tela-premissas.ts` (`_renderAreaAlocada`) já produz —
  // continua só informativa, nunca bloqueia salvar (decisão registrada na
  // #693; o handoff pede bloqueio, mas isso fica fora de escopo desta rodada).
  private _renderConsistencia(p: Proforma): TemplateResult {
    // Achado real da revisão (Codex, P2, PR #707): sem este portão, o
    // instante entre `connectedCallback()` e o catálogo carregar (produtos
    // ainda `[]`) computava `diferencaAreaAlocada` contra 0 m² alocado e
    // desenhava "ainda faltam alocar" para qualquer estudo com área — uma
    // piscada de aviso falso, permanente se a mesma `Promise.all` falhar.
    if (!this.produtosCarregados) return html``;
    const excesso = p.diferencaAreaAlocada > 0;
    const sobra = p.diferencaAreaAlocada < 0;
    if (!excesso && !sobra) return html``;
    return html`
      ${excesso ? html`
        <urbi-banner class="aviso-consistencia" variante="alerta">
          A soma das áreas dos produtos (${fmtM2(p.areaProdutosAlocada)}) é maior que a área
          registrada em Terreno &amp; Áreas (${fmtM2(p.areaPrivativa)}) — ver Premissas.
        </urbi-banner>` : nothing}
      ${sobra ? html`
        <urbi-banner class="aviso-consistencia" variante="alerta">
          Ainda faltam ${fmtM2(Math.abs(p.diferencaAreaAlocada))} para alocar nos produtos — ver
          Premissas.
        </urbi-banner>` : nothing}
    `;
  }

  // #15/#451: medidores de indicadores a partir dos benchmarks do estudo. As
  // faixas de status usam a `regra_comparacao`: `atingir_ou_superar` (maior é
  // melhor) → verde acima da meta; `nao_exceder` (menor é melhor, ex.: Custo
  // obras/VGV) → verde ABAIXO da meta (inversão pedida no item 15).
  //
  // O mapa benchmark→indicador (nomes, não valores) é compartilhado com
  // tela-resumo.ts via `benchmarks-indicadores.ts`; cada tela resolve o VALOR
  // na sua própria fonte (aqui, `Proforma`). O benchmark `margem_bruta` fica
  // declaradamente sem fonte até existir um indicador de margem bruta de
  // verdade (#453) — `resolverIndicadoresBenchmark` já sabe disso.
  private _renderMedidores(p: Proforma): TemplateResult {
    // #571: `custoObrasVgvPct`/`margemLiquidaPct` vêm `null` do motor quando
    // vgv ≤ 0. `montarMedidor` é null-seguro (devolve `null`, sem desenhar o
    // medidor) — um ponteiro não tem como pousar honestamente numa escala
    // sem valor definido; é o mesmo desfecho de "sem indicador configurado".
    const { exibiveis } = resolverIndicadoresBenchmark(this.benchmarks, {
      custo_obras_vgv: p.custoObrasVgvPct,
      margem_liquida: p.margemLiquidaPct,
      // Rodada 12 (achado 2.3 da auditoria, docs/rodada-12/auditoria.md):
      // "Resultado final" plotava o MESMO valor de "Margem sobre VGV" — dois
      // rótulos, uma fórmula. Aposentado, não reescalado (decisão do autor):
      // a grandeza em R$ do resultado não cabe bem numa escala de 0–100%,
      // que é o que todo o resto dos medidores de benchmark usa. Sem essa
      // chave, `resolverIndicadoresBenchmark` descarta `resultado_final` com
      // `SEM_VALOR_NESTA_TELA_MOTIVO` — o mesmo motivo que já vale para
      // `eficiencia_aproveitamento` no Resumo do Avançado.
      // #611: sem investimento não há denominador — `roiPct` já vem `null`
      // do motor desde a fase 2 da issue, e `roiParaFaixa` é hoje um alias
      // dele (mantido pelo call site continuar nomeado). `montarMedidor` é
      // null-seguro desde a #571 e simplesmente não desenha o medidor.
      roi: roiParaFaixa(p),
      // #613: o único benchmark exclusivo do Loteamento
      // (`backend/rotas/benchmarks.ts`, `benchmarksPadrao`) finalmente tem
      // medidor. Ele NÃO é gateado por `lot` aqui de propósito: quem decide se
      // o medidor aparece é o benchmark estar CONFIGURADO no estudo, e a
      // semente só o cria para Loteamento. Uma Incorporação que ganhe o campo
      // à mão vê a mesma razão desenhada, com a mesma fórmula.
      //
      // `eficienciaParaFaixa` pela razão da #611: sem área de gleba
      // `eficienciaPct` já vem `null` do motor desde a fase 2 da issue, e
      // `null` = `montarMedidor` não desenha o medidor.
      eficiencia_aproveitamento: eficienciaParaFaixa(p),
    });
    const medidores = exibiveis
      .map(({ benchmark, rotulo, valor }) => {
        // Limites e faixas: configurados na aba Benchmark (3 faixas) ou automáticos
        // (2 faixas em torno da meta). Ver `montarMedidor`.
        const cfg = montarMedidor(benchmark, valor);
        if (!cfg) return null;
        return html`<div class="medidor-item">
          <urbi-grafico-medidor
            rotulo=${rotulo}
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
    if (medidores.length === 0) return html``;
    return html`
      <urbi-card titulo="Indicadores vs. benchmark">
        <div class="medidores">${medidores}</div>
      </urbi-card>
    `;
  }
}

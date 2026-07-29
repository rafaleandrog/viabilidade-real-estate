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
  buscarAnaliseMercado, rodarAnaliseMercado, listarRegioesMercado, definirRegiaoMercado,
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

// Eixos de risco — espelham os 6 fatores do Apelo Comercial (`backend/apelo-comercial.ts`),
// que é o framework já definido no app para avaliar uma região. Duplicado aqui
// só como RÓTULO de exibição; a lista canônica é a do backend (`EIXOS_RELEVANCIA`),
// que também restringe o enum do schema da IA.
const ROTULO_EIXO: Record<string, string> = {
  localizacao: 'Localização',
  infraestrutura: 'Infraestrutura',
  vetor_crescimento: 'Vetor de crescimento',
  concorrencia: 'Concorrência',
  demanda: 'Demanda',
  seguranca_juridica: 'Segurança jurídica',
};

@customElement('viab-tela-analise-mercado')
export class ViabTelaAnaliseMercado extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private carregando = true;
  @state() private calc: FluxoCalc | null = null;
  @state() private analise: any = null;
  // #200: região monitorada do estudo, coletas da rotina diária e estado do botão.
  @state() private regiao: any = null;
  @state() private coletas: any[] = [];
  @state() private regioes: any[] = [];
  @state() private analisando = false;
  private receitas: any[] = [];
  private crono: EventoCrono[] = [];
  private areaPrivativaTotal = 0;
  private unidades = 0;
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

    /* #200 — barra de ações, riscos e material coletado. */
    .acoes { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
    .acoes .espaco { flex: 1; }
    .acoes urbi-select { min-width: 200px; }
    .acoes-rot {
      font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .riscos, .coletas { display: flex; flex-direction: column; gap: 10px; }
    .risco, .coleta {
      border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
      border-left-width: 3px; border-radius: 8px; padding: 10px 12px;
      background: var(--cor-superficie-elevada, rgba(255,255,255,0.03));
    }
    .risco.sev-alta { border-left-color: var(--cor-erro, #d45a3a); }
    .risco.sev-media { border-left-color: var(--cor-alerta, #e0a82a); }
    .risco.sev-baixa { border-left-color: var(--cor-info, #2aa9e0); }
    .risco-cab, .coleta-cab { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .risco p, .coleta p { margin: 4px 0 0; font-size: 0.85rem; }
    .coleta a { color: var(--cor-primaria, #2aa9e0); }
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
      const [receitas, custos, curvas, crono, params, mercado, regioes] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        buscarAnaliseMercado(this.estudo.id),
        listarRegioesMercado(),
      ]);
      this.regioes = regioes?.erro ? [] : (regioes.dados || []);
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
      this.unidades = this.receitas.reduce(
        (s: number, l: any) => s + (l.tipologias ?? []).reduce(
          (si: number, t: any) => si + n(t.quantidade), 0), 0);
      this.analise = mercado?.erro ? null : (mercado?.analise ?? null);
      this.regiao = mercado?.erro ? null : (mercado?.regiao ?? null);
      this.coletas = mercado?.erro ? [] : (mercado?.coletas ?? []);
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

      ${this._renderAcoes(precoProjeto, custoProjeto, vsoProjeto)}
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

      ${this._renderRiscos()}
      ${this._renderMacro()}
      ${this._renderColetas()}
    `;
  }

  /**
   * #200 — região monitorada + botão de análise. A análise roda SOB DEMANDA,
   * nunca por carga de tela: ela custa IA e o usuário decide quando gastar.
   */
  private _renderAcoes(preco: number | null, custo: number | null, vso: number | null): TemplateResult {
    if (!this.editavel) return html`${nothing}`;
    return html`
      <div class="acoes">
        <span class="acoes-rot">Região monitorada</span>
        <urbi-select
          .valor=${this.regiao ? String(this.regiao.id) : ''}
          .opcoes=${[{ valor: '', rotulo: 'Não vinculada' },
            ...this.regioes.map((r: any) => ({ valor: String(r.id), rotulo: `${r.nome}${r.uf ? `/${r.uf}` : ''}` }))]}
          @urbi:select-change=${(e: CustomEvent) => this._trocarRegiao(e.detail.valor)}
        ></urbi-select>
        <span class="espaco"></span>
        <urbi-botao variante="primario" icone="fa-solid fa-wand-magic-sparkles"
          ?carregando=${this.analisando}
          @click=${() => this._analisar(preco, custo, vso)}>
          ${this.analise ? 'Refazer análise' : 'Analisar mercado'}
        </urbi-botao>
      </div>
      ${this.regioes.length === 0 ? html`
        <p class="nota">
          Nenhuma região monitorada cadastrada. Um administrador pode cadastrá-las em
          <strong>Admin → Apps → viabilidade → Regiões monitoradas</strong>; a coleta diária passa a
          varrer notícias e anúncios dessas regiões automaticamente.
        </p>` : nothing}
    `;
  }

  private async _trocarRegiao(valor: string) {
    const id = valor ? Number(valor) : null;
    try {
      const r = await definirRegiaoMercado(this.estudo.id, id);
      if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Erro ao vincular a região', 'erro'); return; }
      this.regiao = this.regioes.find((x: any) => Number(x.id) === id) ?? null;
      // Recarrega para trazer as coletas da região nova.
      this.carregado = false;
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao vincular a região', 'erro');
    }
  }

  private async _analisar(preco: number | null, custo: number | null, vso: number | null) {
    if (this.analisando) return;
    this.analisando = true;
    try {
      const r = await rodarAnaliseMercado(this.estudo.id, {
        preco_medio_m2: preco, custo_obra_m2: custo, vso_pct: vso,
        area_privativa_total: this.areaPrivativaTotal, unidades: this.unidades,
      });
      if (r?.erro) {
        // 422 IA_INDISPONIVEL é o caso previsto no aceite: mensagem clara, sem quebrar.
        urbiVerso.notificar(r.mensagem || 'Não foi possível rodar a análise', 'erro');
        return;
      }
      this.analise = r?.analise ?? null;
      this.coletas = r?.coletas ?? this.coletas;
      urbiVerso.notificar('Análise de mercado atualizada.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Não foi possível rodar a análise', 'erro');
    } finally {
      this.analisando = false;
    }
  }

  /** Sinais de risco devolvidos pela IA (#200/#201). */
  private _renderRiscos(): TemplateResult {
    const riscos = Array.isArray(this.analise?.riscos) ? this.analise.riscos : [];
    if (riscos.length === 0) return html`${nothing}`;
    return html`
      <div class="secao">
        <h3>Sinais de risco</h3>
        <div class="riscos">
          ${riscos.map((r: any) => html`
            <div class="risco sev-${r.severidade || 'baixa'}">
              <div class="risco-cab">
                <urbi-badge cor=${r.severidade === 'alta' ? 'perigo' : r.severidade === 'media' ? 'alerta' : 'info'}>
                  ${ROTULO_EIXO[r.eixo] ?? r.eixo}
                </urbi-badge>
                <strong>${r.titulo}</strong>
              </div>
              <p>${r.descricao}</p>
              ${r.origem ? html`<p class="nota">Fonte: ${r.origem}</p>` : nothing}
            </div>`)}
        </div>
      </div>
    `;
  }

  /** Material coletado pela rotina diária para a região do estudo. */
  private _renderColetas(): TemplateResult {
    if (this.coletas.length === 0) return html`${nothing}`;
    return html`
      <div class="secao">
        <h3>Coletado sobre a região</h3>
        <div class="coletas">
          ${this.coletas.map((c: any) => html`
            <div class="coleta">
              <div class="coleta-cab">
                <urbi-badge cor=${c.tipo === 'anuncio' ? 'sucesso' : 'info'}>
                  ${c.tipo === 'anuncio' ? 'Anúncio' : 'Notícia'}
                </urbi-badge>
                ${c.url
                  ? html`<a href=${c.url} target="_blank" rel="noopener noreferrer">${c.titulo}</a>`
                  : html`<strong>${c.titulo}</strong>`}
              </div>
              <p>${c.resumo}</p>
              <p class="nota">
                ${[c.fonte, c.publicado_em, c.data_coleta ? `coletado em ${c.data_coleta}` : '']
                  .filter(Boolean).join(' · ')}
              </p>
            </div>`)}
        </div>
      </div>
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

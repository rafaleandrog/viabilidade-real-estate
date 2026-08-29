import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { type EventoCrono } from './fluxo-shared.js';
import { calcularFluxo, type FluxoCalc, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  precoMedioM2Projeto, custoObraM2Projeto, vsoProjetoPct, compararProjetoMercado,
  lerIndicador, ROTULO_ABRANGENCIA, ROTULO_CONFIANCA,
  type Comparacao, type ProcedenciaIndicador,
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
    /* #579: min-width:0 (o item flex do .comp-linha por padrão recusa
       encolher abaixo do conteúdo) + overflow-wrap (a defesa que funciona de
       verdade em markup próprio — mesmo mecanismo de fluxo-tabela.ts
       .kpi-card .valor, contra o ESPAÇO NÃO-QUEBRÁVEL que fmtR$ intercala
       entre R$ e o número, Intl.NumberFormat pt-BR/BRL U+00A0).
       ⚠️ MEDIDO (frontend/render/comp-analise-mercado.render.test.ts,
       #579): ao contrário de fluxo-tabela.ts/tela-funding.ts, aqui a
       track de 260px (.cards) já dá folga suficiente para um R$/m² de 9
       dígitos mesmo SEM esta regra — a mutação que apaga estas duas linhas
       não deixa o teste vermelho. Fica por consistência com o resto do
       inventário da #579 e como defesa se a track encolher no futuro; a
       nota está aqui para não virar defesa fantasma citada como prova do
       que ela não prova (classe de defeito nº 1 do CLAUDE.md). */
    .comp-linha { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 8px; }
    .comp-linha .lado { font-size: 0.72rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; letter-spacing: 0.04em; }
    .comp-linha .val {
      font-variant-numeric: tabular-nums; font-weight: 700;
      min-width: 0; overflow-wrap: anywhere; word-break: break-word;
    }
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

    /* #201 — cabeçalho com a localidade, procedência por indicador e insight. */
    .cabecalho { margin-bottom: 10px; }
    .cab-local { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 1rem; }
    .cab-local .nota { margin-top: 0; }
    .comp-proc {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      margin-top: 8px; font-size: 0.74rem;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .comp-insight {
      display: flex; gap: 6px; align-items: flex-start;
      margin-top: 8px; padding-top: 8px;
      border-top: 1px dashed var(--cor-borda-sutil, rgba(255,255,255,0.08));
      font-size: 0.8rem; color: var(--cor-texto-sec, rgba(255,255,255,0.65));
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
        // #346: RET global (era por Grupo, avancado_fases.fluxo_pagamento.ret).
        ret: params?.erro ? undefined : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
        // #473: default true preserva o comportamento histórico (VGV bruto).
        corretagemSobrePermutaFisica: this.estudo?.corretagem_sobre_permuta_fisica !== false,
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

    // #201: ordem da referência visual — cabeçalho com a localidade e o aviso,
    // sinais de risco LOGO ABAIXO (não no rodapé), depois os indicadores.
    return html`
      ${this._renderCabecalho()}
      ${this._renderAcoes(precoProjeto, custoProjeto, vsoProjeto)}
      ${this._renderLimitacao()}
      ${this._renderRiscos()}

      <div class="secao">
        <h3>Projeto × mercado</h3>
        <div class="cards">
          ${this._cardComparacao('Preço de venda (R$/m²)', precoProjeto, lerIndicador(m, 'preco_medio_m2'), fmtR$)}
          ${this._cardComparacao('Custo de obra (R$/m²)', custoProjeto, lerIndicador(m, 'custo_obra_m2'), fmtR$)}
          ${this._cardComparacao('Velocidade de vendas (%/mês)', vsoProjeto, lerIndicador(m, 'vso_pct'), fmtPct)}
        </div>
        <p class="nota">
          Os números do projeto são derivados deste estudo — preço é o VGV sobre a área privativa,
          custo de obra é o total do grupo Obra sobre a mesma área, e a velocidade é a premissa de
          absorção lida como VSO. Não há nada a digitar aqui.
        </p>
      </div>

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
          Nenhuma região monitorada cadastrada. Um administrador pode cadastrá-las na aba
          <strong>Regiões monitoradas</strong> do Painel (ou em
          <strong>Admin → Apps → viabilidade → Regiões monitoradas</strong>); a coleta diária passa
          a varrer notícias e anúncios dessas regiões automaticamente.
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

  /**
   * #201 — cabeçalho da análise: a localidade a que os números se referem e o
   * aviso de isenção, que é obrigatório e não decorativo.
   */
  private _renderCabecalho(): TemplateResult {
    const m = this.analise;
    const local = String(m?.localidade || '').trim()
      || (this.regiao ? `${this.regiao.nome}${this.regiao.uf ? `/${this.regiao.uf}` : ''}` : '')
      || String(this.estudo?.uf || '').trim();
    const quando = String(m?.gerado_em || '').slice(0, 10);
    return html`
      <div class="cabecalho">
        <div class="cab-local">
          <urbi-icone classe="fa-solid fa-location-dot"></urbi-icone>
          <strong>${local || 'Localidade não definida'}</strong>
          ${m?.data_referencia ? html`<span class="nota">referência ${m.data_referencia}</span>` : nothing}
          ${quando ? html`<span class="nota">· análise de ${quando}</span>` : nothing}
        </div>
      </div>
      <urbi-banner variante="info" icone="fa-solid fa-circle-info">
        Dados de mercado externos, apenas para referência — não é recomendação de investimento.
      </urbi-banner>
    `;
  }

  /**
   * #201 — limitação como cidadã de primeira classe: quando falta dado, a tela
   * DIZ o que falta e por quê, em vez de simplesmente não mostrar a seção.
   */
  private _renderLimitacao(): TemplateResult {
    const m = this.analise;
    if (!m) {
      return html`
        <urbi-banner variante="alerta" icone="fa-solid fa-triangle-exclamation">
          Ainda não há dados de mercado para este estudo. Os números do projeto abaixo já estão
          calculados; a comparação aparece quando a análise de mercado for gerada.
        </urbi-banner>`;
    }
    const abr = String(m.abrangencia || 'municipio');
    const limitacoes = String(m?.resultado?.limitacoes || '').trim();
    if (abr === 'municipio' && !limitacoes) return html`${nothing}`;
    return html`
      <urbi-banner variante="alerta" icone="fa-solid fa-circle-exclamation">
        ${abr !== 'municipio' ? html`
          Sem dado no nível da cidade — análise limitada a ${ROTULO_ABRANGENCIA[abr] ?? abr}.
        ` : nothing}
        ${limitacoes ? html`<br />${limitacoes}` : nothing}
      </urbi-banner>
    `;
  }

  /**
   * #201 — card de comparação com PROCEDÊNCIA. Todo número de mercado exibido
   * carrega origem e confiança visíveis; sem origem, `lerIndicador` já devolve
   * `valor: null` e o card mostra "sem dado" em vez do número. O insight da IA
   * sobre aquele indicador aparece aqui, junto do que ele explica — não num
   * bloco solto no rodapé.
   */
  private _cardComparacao(
    rotulo: string,
    projeto: number | null,
    mercado: ProcedenciaIndicador,
    fmt: (v: number) => string,
  ): TemplateResult {
    const cmp: Comparacao | null = compararProjetoMercado(projeto, mercado.valor);
    return html`
      <div class="comp">
        <div class="comp-rot">${rotulo}</div>
        <div class="comp-linha">
          <span class="lado">Projeto</span>
          <span class="val projeto">${projeto === null ? html`<span class="sem-dado">—</span>` : fmt(projeto)}</span>
        </div>
        <div class="comp-linha">
          <span class="lado">Mercado</span>
          <span class="val">${mercado.valor === null ? html`<span class="sem-dado">—</span>` : fmt(mercado.valor)}</span>
        </div>
        ${mercado.valor === null
          ? html`<div class="comp-proc sem-dado">Sem dado de mercado para este indicador.</div>`
          : html`
            <div class="comp-proc">
              <urbi-badge cor=${mercado.confianca === 'alta' ? 'sucesso' : mercado.confianca === 'media' ? 'info' : 'alerta'}>
                ${ROTULO_CONFIANCA[mercado.confianca] ?? mercado.confianca}
              </urbi-badge>
              <span>${mercado.origem}</span>
            </div>`}
        ${cmp ? html`
          <div class="comp-delta ${cmp.posicao}">
            ${cmp.posicao === 'alinhado'
              ? 'Alinhado com o mercado'
              : html`${fmtPct(Math.abs(cmp.deltaPct))} ${cmp.posicao} do mercado (${fmt(Math.abs(cmp.delta))})`}
          </div>` : nothing}
        ${mercado.observacao
          ? html`<div class="comp-insight"><urbi-icone classe="fa-solid fa-lightbulb"></urbi-icone>${mercado.observacao}</div>`
          : nothing}
      </div>
    `;
  }

  private _renderMacro(): TemplateResult {
    const m = this.analise;
    if (!m) return html`${nothing}`;
    // #201: mesmo critério dos cards — macro só aparece COM procedência.
    const macros = [
      { rotulo: 'IPCA (12m)', campo: 'ipca_pct' },
      { rotulo: 'Selic', campo: 'selic_pct' },
      { rotulo: 'INCC (12m)', campo: 'incc_pct' },
      { rotulo: 'Focus · IPCA', campo: 'focus_ipca_pct' },
      { rotulo: 'Focus · Selic', campo: 'focus_selic_pct' },
    ].map((x) => ({ ...x, ind: lerIndicador(m, x.campo) }));
    const comDado = macros.filter((x) => x.ind.valor !== null);
    if (comDado.length === 0) {
      return html`
        <div class="secao">
          <h3>Indicadores macro</h3>
          <urbi-estado-vazio icone="fa-solid fa-chart-line"
            mensagem="A análise não trouxe indicadores macro com fonte identificada."></urbi-estado-vazio>
        </div>`;
    }
    return html`
      <div class="secao">
        <h3>Indicadores macro</h3>
        <div class="cards">
          ${comDado.map((x) => html`
            <div class="comp">
              <div class="comp-rot">${x.rotulo}</div>
              <div class="comp-linha">
                <span class="lado">Mercado</span>
                <span class="val projeto">${fmtPct(x.ind.valor as number)}</span>
              </div>
              <div class="comp-proc">
                <urbi-badge cor=${x.ind.confianca === 'alta' ? 'sucesso' : x.ind.confianca === 'media' ? 'info' : 'alerta'}>
                  ${ROTULO_CONFIANCA[x.ind.confianca] ?? x.ind.confianca}
                </urbi-badge>
                <span>${x.ind.origem}</span>
              </div>
              ${x.ind.observacao
                ? html`<div class="comp-insight"><urbi-icone classe="fa-solid fa-lightbulb"></urbi-icone>${x.ind.observacao}</div>`
                : nothing}
            </div>`)}
        </div>
      </div>
    `;
  }
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarCapitalInstrumentos, criarCapitalInstrumento, atualizarCapitalInstrumento, removerCapitalInstrumento,
} from './viabilidade-api.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { simularCapitalStackDoEstudo, moic, type ResultadoCapitalStack } from './capital-stack-motor.js';
import './viab-num.js';

// Sub-aba "Viabilidade → Capital Stack" (epic #239, FIN-08/#277 + FIN-09/#278).
//
// Escopo desta entrega, mais modesto que o §9/§10 completo de
// docs/viabilidade/funding-capital-stack.md — decisão de manter o risco
// baixo num ambiente sem navegador para validar layout/interação:
//  - Resumo superior: KPIs agregados (§9), calculados de verdade via
//    `simularCapitalStackDoEstudo` sobre o fluxo livre real do estudo.
//  - Lista de camadas com edição inline por tipo (§9 "Capital Stack" +
//    "Editor de camada", os 5 blocos como seções dentro do MESMO card, em
//    vez de um modal/wizard separado).
//  - SEM gráficos SVG (§9 "Visualizações") e SEM prévia de recálculo a cada
//    tecla — a mudança só é aplicada em "Salvar camada" (ainda assim, nunca
//    salva sem confirmação explícita, que é a garantia central do §9).
//  - `receitaLiquidaMensal` usa `receitaMensal` do motor (já líquida de RET
//    e permuta financeira, #228) SEM subtrair corretagem — o §6.2 pede as
//    duas; falta o mesmo `ContextoCusto` que `tela-fluxo-custos.ts` monta.
//    Registrado aqui em vez de fingir precisão que não existe.
//
// Nada aqui é usado pelo Preliminar. Camadas `rascunho`/`revisao_necessaria`/
// `encerrado` aparecem na lista mas NÃO entram no cálculo do resumo — só
// `ativo` tem efeito (§13.3), e a UI deixa isso visível no badge de status.

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: 'financiamento_producao', rotulo: 'Financiamento à produção' },
  { valor: 'capital_giro', rotulo: 'Capital de giro / dívida ponte' },
  { valor: 'preferred_equity', rotulo: 'Preferred Equity' },
  { valor: 'sponsor_equity', rotulo: 'Sponsor Equity' },
];
const STATUS: { valor: string; rotulo: string }[] = [
  { valor: 'rascunho', rotulo: 'Rascunho' },
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
  { valor: 'revisao_necessaria', rotulo: 'Revisão necessária' },
];
const POLITICAS: { valor: string; rotulo: string }[] = [
  { valor: 'cash_sweep', rotulo: 'Cash sweep' },
  { valor: 'bullet', rotulo: 'Bullet (no vencimento)' },
];
const MODOS_PE: { valor: string; rotulo: string }[] = [
  { valor: 'A', rotulo: 'A — Retorno preferencial fixo' },
  { valor: 'B', rotulo: 'B — % do residual no encerramento' },
  { valor: 'C', rotulo: 'C — % da receita líquida' },
];

const n = (v: any): number => Number(v) || 0;

@customElement('viab-capital-stack')
export class ViabCapitalStack extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private camadas: any[] = [];
  @state() private custos: any[] = [];
  @state() private resultado: ResultadoCapitalStack | null = null;
  @state() private resultadoDesalavancado = 0;
  @state() private carregando = true;
  @state() private draft: Record<number, any> = {};
  @state() private salvandoId: number | null = null;
  @state() private criando = false;

  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .resumo urbi-kpi { width: 100%; }
    .camadas { display: flex; flex-direction: column; gap: 14px; }
    .camada-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .camada-cab .espaco { flex: 1; }
    .secao { margin-top: 12px; }
    .secao h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .grid > * { width: 190px; max-width: 100%; box-sizing: border-box; }
    .grid > .p2 { width: 260px; }
    .sel-campo { display: flex; flex-direction: column; gap: 4px; width: 190px; }
    .sel-rotulo { font-size: 0.75rem; text-transform: uppercase; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700; }
    .linha-lista { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .form-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .custo-lista { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow: auto; }
    .add-topo { margin-bottom: 16px; }
    table.resultados { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-variant-numeric: tabular-nums; }
    table.resultados th, table.resultados td { padding: 6px 8px; font-size: 0.8125rem; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); text-align: left; }
    table.resultados th { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; text-align: left; }
    table.resultados td.num, table.resultados th.num { text-align: right; }
  `];

  updated() {
    if (this.estudo?.id && !this.carregado) { this.carregado = true; this._carregar(); }
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const [camadas, custos, receitas, curvas, crono, params] = await Promise.all([
        listarCapitalInstrumentos(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarReceitasAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
      ]);
      this.camadas = camadas?.erro ? [] : (camadas.dados || []);
      this.custos = custos?.erro ? [] : (custos.dados || []);

      const config: FluxoConfig = {
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxaDescontoAa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        cronograma: crono?.erro ? [] : (crono.dados || []),
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: this.custos,
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
      };
      const calc = calcularFluxo(config);
      this.resultadoDesalavancado = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] || 0;

      // Motor é 1-based (índice 0 ignorado); calcularFluxo é 0-based.
      const fluxoLivre1based = [0, ...calc.fluxoMensal];
      const receitaLiquida1based = [0, ...calc.receitaMensal];
      this.resultado = simularCapitalStackDoEstudo(
        fluxoLivre1based, receitaLiquida1based, this.camadas, calc.linhasCusto, 0,
      );
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar o Capital Stack', 'erro');
    }
    this.carregando = false;
  }

  private _draftDe(c: any): any {
    if (!(c.id in this.draft)) this.draft = { ...this.draft, [c.id]: { ...c, config: { ...(c.config ?? {}) } } };
    return this.draft[c.id];
  }

  private _setCampo(c: any, campo: string, valor: any) {
    const d = this._draftDe(c);
    this.draft = { ...this.draft, [c.id]: { ...d, [campo]: valor } };
  }

  private _setConfig(c: any, campo: string, valor: any) {
    const d = this._draftDe(c);
    this.draft = { ...this.draft, [c.id]: { ...d, config: { ...d.config, [campo]: valor } } };
  }

  private _toggleCustoElegivel(c: any, custoId: number, marcado: boolean) {
    const d = this._draftDe(c);
    const atuais: number[] = Array.isArray(d.config?.custoLinhaIds) ? d.config.custoLinhaIds : [];
    const novos = marcado ? [...new Set([...atuais, custoId])] : atuais.filter((id) => id !== custoId);
    this._setConfig(c, 'custoLinhaIds', novos);
  }

  private _addLinhaLista(c: any, campoConfig: string) {
    const d = this._draftDe(c);
    const lista = Array.isArray(d.config?.[campoConfig]) ? d.config[campoConfig] : [];
    this._setConfig(c, campoConfig, [...lista, { mes: 1, valor: 0 }]);
  }
  private _setLinhaLista(c: any, campoConfig: string, i: number, campo: 'mes' | 'valor', valor: number) {
    const d = this._draftDe(c);
    const lista = (d.config?.[campoConfig] ?? []).map((x: any, j: number) => (j === i ? { ...x, [campo]: valor } : x));
    this._setConfig(c, campoConfig, lista);
  }
  private _delLinhaLista(c: any, campoConfig: string, i: number) {
    const d = this._draftDe(c);
    const lista = (d.config?.[campoConfig] ?? []).filter((_: any, j: number) => j !== i);
    this._setConfig(c, campoConfig, lista);
  }

  private async _adicionar(tipo: string) {
    this.criando = true;
    try {
      const res = await criarCapitalInstrumento(this.estudo.id, {
        tipo, nome: TIPOS.find((t) => t.valor === tipo)?.rotulo || 'Nova camada', ordem: this.camadas.length,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar camada', 'erro'); return; }
      this.camadas = [...this.camadas, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar camada', 'erro');
    } finally {
      this.criando = false;
    }
  }

  private async _salvar(c: any) {
    const d = this.draft[c.id];
    if (!d) return;
    this.salvandoId = c.id;
    try {
      const dados = {
        nome: d.nome, status: d.status, prioridade_funding: n(d.prioridade_funding),
        prioridade_pagamento: n(d.prioridade_pagamento), compromisso: n(d.compromisso), config: d.config,
      };
      const res = await atualizarCapitalInstrumento(this.estudo.id, c.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar camada', 'erro'); return; }
      this.camadas = this.camadas.map((x) => (x.id === c.id ? res : x));
      const { [c.id]: _removida, ...resto } = this.draft;
      this.draft = resto;
      urbiVerso.notificar('Camada salva.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar camada', 'erro');
    } finally {
      this.salvandoId = null;
    }
  }

  private async _remover(c: any) {
    try {
      const res = await removerCapitalInstrumento(this.estudo.id, c.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover camada', 'erro'); return; }
      this.camadas = this.camadas.filter((x) => x.id !== c.id);
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover camada', 'erro');
    }
  }

  private _renderResumo(): TemplateResult {
    const r = this.resultado;
    const compromissoTotal = this.camadas.reduce((s, c) => s + n(c.compromisso), 0);
    const dividaMaxima = r ? Math.max(0, ...Object.values(r.saldoDividaPorInstrumento).flatMap((s) => s)) : 0;
    const equityAportado = r
      ? Object.values(r.aportePorInstrumentoPE).flatMap((s) => s).reduce((a, b) => a + b, 0)
        + r.aporteSponsorMensal.reduce((a, b) => a + b, 0)
      : 0;
    const custoFinanceiro = r
      ? Object.values(r.jurosPorInstrumento).flatMap((s) => s).reduce((a, b) => a + b, 0)
        + Object.values(r.remuneracaoPagaPE).flatMap((s) => s).reduce((a, b) => a + b, 0)
      : 0;
    const resultadoAposCustoFinanceiro = this.resultadoDesalavancado - custoFinanceiro;
    return html`
      <div class="resumo">
        <urbi-kpi rotulo="Capital comprometido" .valor=${fmtR$(compromissoTotal)}></urbi-kpi>
        <urbi-kpi rotulo="Dívida máxima" .valor=${fmtR$(dividaMaxima)}></urbi-kpi>
        <urbi-kpi rotulo="Equity aportado" .valor=${fmtR$(equityAportado)}></urbi-kpi>
        <urbi-kpi rotulo="Lacuna de funding (máx.)" .valor=${fmtR$(r?.lacunaFundingMaxima ?? 0)}
          variante=${(r?.lacunaFundingMaxima ?? 0) > 0 ? 'erro' : 'sucesso'}></urbi-kpi>
        <urbi-kpi rotulo="Resultado desalavancado" .valor=${fmtR$(this.resultadoDesalavancado)}></urbi-kpi>
        <urbi-kpi rotulo="Resultado após custo financeiro" .valor=${fmtR$(resultadoAposCustoFinanceiro)}
          variante=${resultadoAposCustoFinanceiro >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      </div>
      ${(r?.lacunaFundingMaxima ?? 0) > 0 ? html`
        <urbi-banner variante="alerta">
          Lacuna de funding de ${fmtR$(r!.lacunaFundingMaxima)} em algum mês — nenhuma camada ativa cobre
          toda a necessidade de caixa do projeto.
        </urbi-banner>` : nothing}
    `;
  }

  /**
   * §9 "lista ordenável de camadas" + §10 "resultado por instrumento" —
   * resumo tabular por camada, com o resultado real da simulação (§8.2/8.3)
   * quando a camada está ATIVA. Camadas rascunho/revisão/encerrada mostram
   * "—" nas colunas de resultado (não têm efeito no motor, §13.3).
   */
  private _renderResultadosPorCamada(): TemplateResult {
    if (this.camadas.length === 0) return html`${nothing}`;
    const r = this.resultado;
    return html`
      <table class="resultados">
        <thead>
          <tr>
            <th>Nome</th><th>Tipo</th><th>Status</th>
            <th class="num">Compromisso</th><th class="num">Liberado/aportado</th>
            <th class="num">Saldo final</th><th class="num">MOIC</th>
          </tr>
        </thead>
        <tbody>
          ${this.camadas.map((c) => {
            const ativa = c.status === 'ativo';
            const ehDivida = c.tipo === 'financiamento_producao' || c.tipo === 'capital_giro';
            const ehPE = c.tipo === 'preferred_equity';
            const liberado = ativa && r && ehDivida
              ? (r.liberacaoPorInstrumento[c.nome] ?? []).reduce((a, b) => a + b, 0)
              : ativa && r && ehPE
                ? (r.aportePorInstrumentoPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                : null;
            const saldoFinal = ativa && r && ehDivida
              ? (r.saldoDividaPorInstrumento[c.nome] ?? [])[(r.saldoDividaPorInstrumento[c.nome] ?? []).length - 1]
              : ativa && r && ehPE
                ? r.capitalNaoDevolvidoFinalPE[c.nome]
                : null;
            const moicPE = ativa && r && ehPE
              ? moic(
                  (r.aportePorInstrumentoPE[c.nome] ?? []).reduce((a, b) => a + b, 0),
                  (r.devolucaoPrincipalPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                    + (r.remuneracaoPagaPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                    + (r.participacaoResidualPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                    + (r.participacaoReceitaPE[c.nome] ?? []).reduce((a, b) => a + b, 0),
                )
              : null;
            return html`
              <tr>
                <td>${c.nome}</td>
                <td>${TIPOS.find((t) => t.valor === c.tipo)?.rotulo || c.tipo}</td>
                <td>${STATUS.find((s) => s.valor === c.status)?.rotulo || c.status}</td>
                <td class="num">${fmtR$(n(c.compromisso))}</td>
                <td class="num">${liberado === null ? '—' : fmtR$(liberado)}</td>
                <td class="num">${saldoFinal === null || saldoFinal === undefined ? '—' : fmtR$(saldoFinal)}</td>
                <td class="num">${moicPE === null ? '—' : moicPE.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x'}</td>
              </tr>`;
          })}
        </tbody>
      </table>
    `;
  }

  private _renderCamposDivida(c: any, d: any, dis: boolean): TemplateResult {
    const ehFinanciamento = c.tipo === 'financiamento_producao';
    return html`
      <div class="secao">
        <h4>Remuneração e amortização</h4>
        <div class="grid">
          ${this._numConfig(c, d, 'taxaAnual', 'Taxa', '% a.a.', dis)}
          <div class="sel-campo">
            <span class="sel-rotulo">Amortização</span>
            <urbi-select ?desabilitado=${dis} .valor=${d.config?.politicaAmortizacao || 'cash_sweep'} .opcoes=${POLITICAS}
              @urbi:select-change=${(e: CustomEvent) => this._setConfig(c, 'politicaAmortizacao', e.detail.valor)}></urbi-select>
          </div>
          ${d.config?.politicaAmortizacao === 'bullet'
            ? this._numConfig(c, d, 'vencimentoMes', 'Vencimento', 'mês', dis)
            : nothing}
          ${ehFinanciamento ? this._numConfig(c, d, 'percentualFinanciavel', '% financiável do custo elegível', '%', dis) : nothing}
        </div>
      </div>
      ${ehFinanciamento ? html`
        <div class="secao">
          <h4>Custos elegíveis (linhas de custo do estudo)</h4>
          <div class="custo-lista">
            ${this.custos.map((custo) => html`
              <urbi-checkbox
                label=${`${custo.categoria || 'Custo'} — ${fmtR$(n(custo.orcamento_valor))}`}
                ?desabilitado=${dis}
                ?marcado=${(d.config?.custoLinhaIds ?? []).includes(custo.id)}
                @urbi:checkbox-change=${(e: CustomEvent) => this._toggleCustoElegivel(c, custo.id, e.detail.marcado)}
              ></urbi-checkbox>`)}
          </div>
        </div>` : nothing}
      <div class="secao">
        <h4>Liberação programada (mês, valor)</h4>
        ${(d.config?.liberacaoProgramada ?? []).map((l: any, i: number) => html`
          <div class="linha-lista">
            <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis} .valor=${l.mes}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'liberacaoProgramada', i, 'mes', e.detail.valor ?? 1)}></viab-num>
            <viab-num casas-decimais="2" sufixo="R$" ?desabilitado=${dis} .valor=${l.valor}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'liberacaoProgramada', i, 'valor', e.detail.valor ?? 0)}></viab-num>
            ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => this._delLinhaLista(c, 'liberacaoProgramada', i)}></urbi-botao>` : nothing}
          </div>`)}
        ${!dis ? html`<urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          @click=${() => this._addLinhaLista(c, 'liberacaoProgramada')}>Adicionar liberação</urbi-botao>` : nothing}
      </div>
    `;
  }

  private _renderCamposPreferredEquity(c: any, d: any, dis: boolean): TemplateResult {
    const modo = d.config?.modo || 'A';
    return html`
      <div class="secao">
        <h4>Remuneração</h4>
        <div class="grid">
          <div class="sel-campo">
            <span class="sel-rotulo">Modo</span>
            <urbi-select ?desabilitado=${dis} .valor=${modo} .opcoes=${MODOS_PE}
              @urbi:select-change=${(e: CustomEvent) => this._setConfig(c, 'modo', e.detail.valor)}></urbi-select>
          </div>
          ${modo === 'A' ? html`
            ${this._numConfig(c, d, 'taxaAnual', 'Retorno preferencial', '% a.a.', dis)}
            <div class="sel-campo">
              <span class="sel-rotulo">Capitalização</span>
              <urbi-select ?desabilitado=${dis} .valor=${d.config?.capitalizacao || 'simples'}
                .opcoes=${[{ valor: 'simples', rotulo: 'Simples' }, { valor: 'composta', rotulo: 'Composta' }]}
                @urbi:select-change=${(e: CustomEvent) => this._setConfig(c, 'capitalizacao', e.detail.valor)}></urbi-select>
            </div>` : nothing}
          ${modo === 'B' ? html`
            ${this._numConfig(c, d, 'percentualResidualEvento', '% do residual', '%', dis)}
            ${this._numConfig(c, d, 'mesEvento', 'Mês do evento', 'mês', dis)}` : nothing}
          ${modo === 'C' ? this._numConfig(c, d, 'percentualReceitaLiquida', '% da receita líquida', '%', dis) : nothing}
        </div>
      </div>
      <div class="secao">
        <h4>Aportes (mês, valor)</h4>
        ${(d.config?.aportes ?? []).map((a: any, i: number) => html`
          <div class="linha-lista">
            <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis} .valor=${a.mes}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportes', i, 'mes', e.detail.valor ?? 1)}></viab-num>
            <viab-num casas-decimais="2" sufixo="R$" ?desabilitado=${dis} .valor=${a.valor}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportes', i, 'valor', e.detail.valor ?? 0)}></viab-num>
            ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => this._delLinhaLista(c, 'aportes', i)}></urbi-botao>` : nothing}
          </div>`)}
        ${!dis ? html`<urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          @click=${() => this._addLinhaLista(c, 'aportes')}>Adicionar aporte</urbi-botao>` : nothing}
      </div>
    `;
  }

  private _renderCamposSponsor(c: any, d: any, dis: boolean): TemplateResult {
    return html`
      <div class="secao">
        <h4>Cobertura e remuneração</h4>
        <div class="grid">
          <urbi-checkbox label="Cobre lacuna de funding automaticamente" ?desabilitado=${dis}
            ?marcado=${Boolean(d.config?.cobreLacunaAutomatica)}
            @urbi:checkbox-change=${(e: CustomEvent) => this._setConfig(c, 'cobreLacunaAutomatica', e.detail.marcado)}></urbi-checkbox>
          ${this._numConfig(c, d, 'percentualReceitaLiquida', '% da receita líquida (vazio = residual do waterfall)', '%', dis)}
        </div>
      </div>
      <div class="secao">
        <h4>Aportes programados (mês, valor)</h4>
        ${(d.config?.aportesProgramados ?? []).map((a: any, i: number) => html`
          <div class="linha-lista">
            <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis} .valor=${a.mes}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportesProgramados', i, 'mes', e.detail.valor ?? 1)}></viab-num>
            <viab-num casas-decimais="2" sufixo="R$" ?desabilitado=${dis} .valor=${a.valor}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportesProgramados', i, 'valor', e.detail.valor ?? 0)}></viab-num>
            ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => this._delLinhaLista(c, 'aportesProgramados', i)}></urbi-botao>` : nothing}
          </div>`)}
        ${!dis ? html`<urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          @click=${() => this._addLinhaLista(c, 'aportesProgramados')}>Adicionar aporte</urbi-botao>` : nothing}
      </div>
    `;
  }

  /** Campo numérico ligado a `config`, com valor guardado como % (÷100 na leitura pelo motor). */
  private _numConfig(c: any, d: any, campo: string, label: string, sufixo: string, dis: boolean): TemplateResult {
    return html`<viab-num label=${label} sufixo=${sufixo} casas-decimais="2" ?desabilitado=${dis}
      .valor=${d.config?.[campo] !== undefined ? Number(d.config[campo]) * (sufixo === '%' || sufixo === '% a.a.' ? 100 : 1) : null}
      @urbi:input-numero-change=${(e: CustomEvent) => {
        const bruto = e.detail.valor ?? 0;
        const salvar = (sufixo === '%' || sufixo === '% a.a.') ? bruto / 100 : bruto;
        this._setConfig(c, campo, salvar);
      }}
    ></viab-num>`;
  }

  private _renderCamada(c: any): TemplateResult {
    const dis = !this.editavel;
    const d = this._draftDe(c);
    const temAlteracao = c.id in this.draft;
    const foraDeUso = c.status !== 'ativo';
    return html`
      <urbi-card>
        <div class="camada-cab">
          <urbi-input ?desabilitado=${dis} .valor=${d.nome || ''}
            @urbi:input-change=${(e: CustomEvent) => this._setCampo(c, 'nome', e.detail.valor)}></urbi-input>
          <urbi-badge cor=${foraDeUso ? 'alerta' : 'sucesso'}>${STATUS.find((s) => s.valor === c.status)?.rotulo || c.status}</urbi-badge>
          <span class="espaco"></span>
          ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" @click=${() => this._remover(c)}></urbi-botao>` : nothing}
        </div>
        <div class="secao">
          <h4>Detalhes gerais</h4>
          <div class="grid">
            <span class="sec">${TIPOS.find((t) => t.valor === c.tipo)?.rotulo || c.tipo}</span>
            <div class="sel-campo">
              <span class="sel-rotulo">Status</span>
              <urbi-select ?desabilitado=${dis} .valor=${d.status || 'rascunho'} .opcoes=${STATUS}
                @urbi:select-change=${(e: CustomEvent) => this._setCampo(c, 'status', e.detail.valor)}></urbi-select>
            </div>
            <viab-num label="Compromisso" sufixo="R$" casas-decimais="2" ?desabilitado=${dis} .valor=${n(d.compromisso)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setCampo(c, 'compromisso', e.detail.valor ?? 0)}></viab-num>
            <viab-num label="Prioridade de funding" sufixo="" casas-decimais="0" ?desabilitado=${dis} .valor=${n(d.prioridade_funding)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setCampo(c, 'prioridade_funding', e.detail.valor ?? 0)}></viab-num>
            <viab-num label="Prioridade de pagamento" sufixo="" casas-decimais="0" ?desabilitado=${dis} .valor=${n(d.prioridade_pagamento)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setCampo(c, 'prioridade_pagamento', e.detail.valor ?? 0)}></viab-num>
          </div>
        </div>
        ${c.tipo === 'financiamento_producao' || c.tipo === 'capital_giro' ? this._renderCamposDivida(c, d, dis) : nothing}
        ${c.tipo === 'preferred_equity' ? this._renderCamposPreferredEquity(c, d, dis) : nothing}
        ${c.tipo === 'sponsor_equity' ? this._renderCamposSponsor(c, d, dis) : nothing}
        ${!dis ? html`
          <div class="form-acoes">
            <urbi-botao variante="primario" ?desabilitado=${!temAlteracao} ?carregando=${this.salvandoId === c.id}
              @click=${() => this._salvar(c)}>Salvar camada</urbi-botao>
          </div>` : nothing}
      </urbi-card>
    `;
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    if (this.carregando) return html`<p class="sec">Carregando…</p>`;
    return html`
      ${this._renderResumo()}
      ${this._renderResultadosPorCamada()}
      <div class="camadas">
        ${this.camadas.map((c) => this._renderCamada(c))}
      </div>
      ${this.editavel ? html`
        <div class="add-topo" style="margin-top:16px">
          <span class="sel-rotulo">Adicionar camada</span>
          <div class="grid" style="margin-top:6px">
            ${TIPOS.map((t) => html`
              <urbi-botao variante="secundario" pequeno ?carregando=${this.criando}
                @click=${() => this._adicionar(t.valor)}>${t.rotulo}</urbi-botao>`)}
          </div>
        </div>` : nothing}
    `;
  }
}

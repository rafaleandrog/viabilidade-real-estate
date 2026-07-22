import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { type EventoCrono } from './fluxo-shared.js';
import {
  calcularFluxo, aplicarCenario,
  type FluxoCalc, type FluxoConfig, type CenarioParams,
} from './fluxo-caixa-motor.js';
import { graficoCenarioAcumulado } from './fluxo-graficos.js';
import { estiloFluxoTabela, kpisFluxo, tabelaFluxo } from './fluxo-tabela.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarBenchmarks, listarCenarios, criarCenario, removerCenario,
} from './viabilidade-api.js';

// ─────────────────────────────────────────────────────────────────────────
// Aba CENÁRIOS do Avançado (Etapa 8 · #56) — exclusiva do nível Avançado.
//
// Simula variações de dois parâmetros sobre o estudo inteiro — preço de venda
// (R$/m²) e custo de obra (R$/m²) — via range sliders cujos limites vêm dos
// benchmarks de sensibilidade (`preco` / `custo_obras`). Arrastar reaplica os
// deltas ao motor (aplicarCenario) e recalcula o fluxo em tempo real:
//  · esquerda: sliders + salvar/nomear cenário;
//  · direita: fluxo acumulado (base cheia + cenário tracejado);
//  · abaixo: o fluxo de caixa completo do cenário (mesmos campos da aba Fluxo);
//  · fim: tabela dos cenários salvos (persistem no estudo) com botão remover.
//
// Reuso: a tabela/KPIs vêm de fluxo-tabela (idênticos à aba Fluxo de Caixa) e o
// gráfico de fluxo-graficos. O Preliminar NÃO usa esta tela (segue em
// viab-tela-graficos, sua aba Gráficos estática).
// ─────────────────────────────────────────────────────────────────────────

const n = (v: any): number => Number(v) || 0;

interface Faixa { min: number; max: number; }

@customElement('viab-tela-cenarios')
export class ViabTelaCenarios extends LitElement {
  @property({ type: Object }) estudo: any = null;

  @state() private carregando = true;
  @state() private precoPct = 0;
  @state() private custoPct = 0;
  @state() private nomeNovo = '';
  @state() private salvando = false;
  @state() private cenarios: any[] = [];
  @state() private colapso: Record<string, boolean> = {};
  @state() private removerId: number | null = null;

  private baseConfig: FluxoConfig | null = null;
  private crono: EventoCrono[] = [];
  private dataInicio: string | null = null;
  private faixaPreco: Faixa = { min: -15, max: 15 };
  private faixaCusto: Faixa = { min: -15, max: 15 };
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, estiloFluxoTabela, css`
    .topo { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 16px; align-items: start; }
    @media (max-width: 860px) { .topo { grid-template-columns: 1fr; } }
    .graf svg { display: block; width: 100%; height: auto; min-width: 480px; }
    .graf-wrap { overflow-x: auto; }

    .slider { margin: 14px 0; }
    .slider-topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .slider-topo .rot { font-weight: 600; }
    .slider-topo .val { font-variant-numeric: tabular-nums; color: var(--cor-primaria, #7c5cff); font-weight: 700; }
    .slider input[type="range"] { width: 100%; accent-color: var(--cor-primaria, #7c5cff); }
    .slider-lim { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-top: 2px; }
    .salvar { display: flex; gap: 8px; align-items: flex-end; margin-top: 18px; flex-wrap: wrap; }
    .salvar urbi-input { flex: 1; min-width: 140px; }
    .reset { margin-top: 8px; }

    .secao-fluxo { margin-top: 20px; }
    .secao-fluxo h3, .secao-cenarios h3 { margin: 0 0 10px; }
    .secao-cenarios { margin-top: 24px; }

    table.cen { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.cen th, table.cen td { padding: 7px 10px; text-align: right; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.08)); font-size: 0.82rem; white-space: nowrap; }
    table.cen th { color: var(--cor-texto-sec, rgba(255,255,255,0.55)); font-weight: 600; }
    table.cen th:first-child, table.cen td:first-child { text-align: left; }
    table.cen td.pos { color: var(--cor-sucesso, #13a98d); }
    table.cen td.neg { color: var(--cor-erro, #d45a3a); }
    .cen-wrap { overflow-x: auto; }
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
      const [receitas, custos, curvas, crono, params, bm, cens] = await Promise.all([
        listarReceitasAvancado(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarBenchmarks(this.estudo.tipo_empreendimento),
        listarCenarios(this.estudo.id),
      ]);
      this.crono = crono?.erro ? [] : (crono.dados || []);
      this.dataInicio = params?.erro ? null : (params.data_inicio_projeto ?? null);
      this.baseConfig = {
        dataInicio: this.dataInicio,
        taxaDescontoAa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        cronograma: this.crono,
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: custos?.erro ? [] : (custos.dados || []),
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: n(this.estudo?.terreno_manual_area) || n(this.estudo?.area_terreno_nucleo),
      };
      this.faixaPreco = this._faixa(bm?.dados || [], 'preco');
      this.faixaCusto = this._faixa(bm?.dados || [], 'custo_obras');
      this.cenarios = cens?.erro ? [] : (cens.dados || []);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar os cenários', 'erro');
    }
    this.carregando = false;
  }

  // Limites do slider a partir do benchmark de sensibilidade (variação ± %).
  // Sem benchmark configurado, cai num padrão de ±15%.
  private _faixa(benchmarks: any[], campo: string): Faixa {
    const b = benchmarks.find((x) => String(x.campo) === campo);
    const pos = b && b.variacao_positiva_pct != null ? Math.abs(n(b.variacao_positiva_pct)) : 15;
    const neg = b && b.variacao_negativa_pct != null ? Math.abs(n(b.variacao_negativa_pct)) : 15;
    return { min: -Math.round(neg), max: Math.round(pos) };
  }

  private _calc(params: CenarioParams): FluxoCalc {
    return calcularFluxo(aplicarCenario(this.baseConfig!, params));
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando cenários..."></urbi-loading>`;
    const cfg = this.baseConfig;
    if (!cfg || (cfg.linhasReceita.length === 0 && cfg.linhasCusto.length === 0)) {
      return html`
        <urbi-estado-vazio icone="fa-solid fa-sliders"
          mensagem="Defina o cronograma, as receitas e os custos nas outras abas para simular cenários."></urbi-estado-vazio>`;
    }
    const base = this._calc({ precoVendaPct: 0, custoObraPct: 0 });
    const cenario = this._calc({ precoVendaPct: this.precoPct, custoObraPct: this.custoPct });
    return html`
      <div class="topo">
        ${this._renderControles()}
        <urbi-card titulo="Fluxo acumulado — base × cenário">
          <div class="graf-wrap"><div class="graf">${graficoCenarioAcumulado(base, cenario, this.dataInicio, this.crono)}</div></div>
        </urbi-card>
      </div>

      <section class="secao-fluxo">
        <h3>Fluxo de caixa do cenário</h3>
        ${kpisFluxo(cenario)}
        ${tabelaFluxo(cenario, this.dataInicio, this.colapso, (ch) => this._t(ch))}
      </section>

      ${this._renderCenariosSalvos()}
    `;
  }

  private _renderControles(): TemplateResult {
    const alterado = this.precoPct !== 0 || this.custoPct !== 0;
    return html`
      <urbi-card titulo="Parâmetros do cenário">
        ${this._slider('Preço de venda (R$/m²)', this.precoPct, this.faixaPreco, (v) => this.precoPct = v)}
        ${this._slider('Custo de obra (R$/m²)', this.custoPct, this.faixaCusto, (v) => this.custoPct = v)}
        <div class="reset">
          <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-rotate-left"
            ?desabilitado=${!alterado} @click=${() => { this.precoPct = 0; this.custoPct = 0; }}>
            Voltar à base
          </urbi-botao>
        </div>
        <div class="salvar">
          <urbi-input
            label="Nome do cenário"
            placeholder="ex: Preço −5%, obra +10%"
            .valor=${this.nomeNovo}
            @urbi:input-change=${(e: CustomEvent) => this.nomeNovo = e.detail.valor}
          ></urbi-input>
          <urbi-botao variante="primario" icone="fa-solid fa-floppy-disk"
            ?desabilitado=${this.salvando} @click=${this._salvar}>Salvar cenário</urbi-botao>
        </div>
      </urbi-card>
    `;
  }

  private _slider(rotulo: string, valor: number, faixa: Faixa, set: (v: number) => void): TemplateResult {
    const sinal = valor > 0 ? '+' : '';
    return html`
      <div class="slider">
        <div class="slider-topo">
          <span class="rot">${rotulo}</span>
          <span class="val">${sinal}${valor}%</span>
        </div>
        <input type="range" min=${faixa.min} max=${faixa.max} step="1" .value=${String(valor)}
          @input=${(e: Event) => set(Number((e.target as HTMLInputElement).value))} />
        <div class="slider-lim"><span>${faixa.min}%</span><span>${faixa.max}%</span></div>
      </div>
    `;
  }

  private _t(chave: string) {
    this.colapso = { ...this.colapso, [chave]: !this.colapso[chave] };
  }

  private _salvar = async () => {
    if (this.salvando || !this.estudo?.id) return;
    this.salvando = true;
    try {
      const nome = this.nomeNovo.trim() || `Preço ${this.precoPct >= 0 ? '+' : ''}${this.precoPct}% · Obra ${this.custoPct >= 0 ? '+' : ''}${this.custoPct}%`;
      const res = await criarCenario(this.estudo.id, {
        nome, preco_venda_pct: this.precoPct, custo_obra_pct: this.custoPct,
        ordem: this.cenarios.length,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar o cenário', 'erro'); return; }
      this.nomeNovo = '';
      const cens = await listarCenarios(this.estudo.id);
      this.cenarios = cens?.erro ? this.cenarios : (cens.dados || []);
      urbiVerso.notificar('Cenário salvo.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar o cenário', 'erro');
    }
    this.salvando = false;
  };

  private _confirmarRemover = async () => {
    const id = this.removerId;
    this.removerId = null;
    if (id == null || !this.estudo?.id) return;
    try {
      const res = await removerCenario(this.estudo.id, id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.cenarios = this.cenarios.filter((c) => Number(c.id) !== Number(id));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };

  private _renderCenariosSalvos(): TemplateResult {
    return html`
      <section class="secao-cenarios">
        <h3>Cenários salvos</h3>
        ${this.cenarios.length === 0
          ? html`<urbi-estado-vazio icone="fa-solid fa-layer-group"
              mensagem="Nenhum cenário salvo. Ajuste os parâmetros acima e clique em “Salvar cenário”."></urbi-estado-vazio>`
          : html`
            <div class="cen-wrap">
              <table class="cen">
                <thead>
                  <tr>
                    <th>Cenário</th>
                    <th>Preço venda</th>
                    <th>Custo obra</th>
                    <th>VPL</th>
                    <th>TIR</th>
                    <th>Payback</th>
                    <th>Exposição máx.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${this.cenarios.map((c) => this._linhaCenario(c))}
                </tbody>
              </table>
            </div>`}
      </section>
      ${this.removerId != null ? this._renderConfirmRemover() : nothing}
    `;
  }

  private _linhaCenario(c: any): TemplateResult {
    const calc = this._calc({ precoVendaPct: n(c.preco_venda_pct), custoObraPct: n(c.custo_obra_pct) });
    const pctTxt = (v: number) => `${v > 0 ? '+' : ''}${v}%`;
    const tir = calc.tir === null ? '—' : `${fmtPct(calc.tir)}`;
    return html`
      <tr>
        <td>${c.nome || 'Cenário'}</td>
        <td>${pctTxt(n(c.preco_venda_pct))}</td>
        <td>${pctTxt(n(c.custo_obra_pct))}</td>
        <td class=${calc.vpl >= 0 ? 'pos' : 'neg'}>${fmtR$(calc.vpl)}</td>
        <td>${tir}</td>
        <td>${calc.paybackData ?? '—'}</td>
        <td class="neg">${fmtR$(calc.exposicaoMaxima)}</td>
        <td>
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
            @click=${() => this.removerId = Number(c.id)}>Remover</urbi-botao>
        </td>
      </tr>
    `;
  }

  private _renderConfirmRemover(): TemplateResult {
    return html`
      <urbi-modal title="Remover cenário" maxWidth="380px" @urbi-modal:close=${() => this.removerId = null}>
        <p>Remover este cenário salvo?</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <urbi-botao variante="fantasma" @click=${() => this.removerId = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemover}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }
}

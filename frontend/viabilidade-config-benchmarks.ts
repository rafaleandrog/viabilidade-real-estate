import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { TIPO_LABEL } from './viab-shared.js';
import { estiloConteudo } from './estilos.js';
import { fmtNum } from './viab-format.js';
import {
  urbiVerso, listarBenchmarks, atualizarBenchmark, removerBenchmark, criarBenchmark, semearBenchmarks,
} from './viabilidade-api.js';
import './viab-num.js';

// Tela de configuração de benchmarks (manifesto telas_config.benchmarks).
// Injetada pelo shell na área de config (Template C): NÃO renderiza
// urbi-shell-page; o respiro vem de <urbi-hospedeiro>. Escrita é admin-only.
//
// Item 2 (rodada 2026-07): a tela discrimina DOIS papéis do mesmo indicador em
// seções separadas — Indicador de Benchmark (meta: `valor` + `regra_comparacao`)
// e Indicador de Sensibilidade (faixa: `variacao_positiva_pct`/`_negativa_pct`).
// O schema `benchmarks` já carrega os dois papéis na mesma linha (genesis intacto).
//
// Props `tipoFixo` (trava o tipo e some com os chips) e `somenteLeitura`
// (não-admin vê os valores, mas não edita) seguem disponíveis para reuso.
@customElement('viabilidade-config-benchmarks')
export class ViabConfigBenchmarks extends LitElement {
  @property({ attribute: false }) tipoFixo: 'loteamento' | 'incorporacao' | '' = '';
  @property({ type: Boolean }) somenteLeitura = false;

  @state() private tipo: 'loteamento' | 'incorporacao' = 'loteamento';
  @state() private itens: any[] = [];
  @state() private carregando = true;
  @state() private mostrarNovo = false;
  @state() private novoCampo = '';
  @state() private removerId: number | null = null;

  static styles = [estiloConteudo, css`
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
    .topo h2 { margin: 0; }
    .chips { display: flex; gap: 6px; margin: 12px 0; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    .rodape { margin-top: 12px; }
    .secao { margin-top: 24px; }
    .secao h3 { margin: 0 0 2px; }
    .secao > p.sec { margin: 0 0 10px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    if (this.tipoFixo) this.tipo = this.tipoFixo;
    this._carregar();
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const res = await listarBenchmarks(this.tipo);
      this.itens = res?.dados || [];
    } catch (e) { console.error(e); }
    this.carregando = false;
  }

  private _num(v: any): number | null {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  render() {
    return html`
      <urbi-hospedeiro>
        <div class="topo">
          <h2>Benchmarks${this.tipoFixo ? html` · ${TIPO_LABEL[this.tipo]}` : nothing}</h2>
          ${this.somenteLeitura ? nothing : html`
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-seedling" @click=${this._semear}>Criar indicadores padrão</urbi-botao>`}
        </div>
        <p class="sec">
          Cada indicador tem dois papéis, separados abaixo: a <strong>meta de benchmark</strong>
          (comparação verde/vermelho) e a <strong>faixa de sensibilidade</strong> (cenários
          Bear/Base/Bull). ${this.somenteLeitura ? 'Edição restrita a administradores.' : ''}
        </p>

        ${this.tipoFixo ? nothing : html`
          <div class="chips">
            ${(['loteamento', 'incorporacao'] as const).map((t) => html`
              <urbi-badge
                cor="info" interativo ?ativo=${this.tipo === t}
                role="button" tabindex="0"
                @click=${() => { this.tipo = t; this._carregar(); }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tipo = t; this._carregar(); } }}
              >${TIPO_LABEL[t]}</urbi-badge>`)}
          </div>`}

        ${this.carregando
          ? html`<urbi-loading mensagem="Carregando benchmarks..."></urbi-loading>`
          : html`
            <section class="secao">
              <h3>Indicador de Benchmark</h3>
              <p class="sec">A meta a atingir. Alimenta os avisos verde/vermelho e a comparação de resultado.</p>
              <urbi-tabela
                .colunas=${this._colunasBenchmark()}
                .linhas=${this.itens}
                mensagem-vazio=${this.somenteLeitura ? 'Nenhum benchmark definido para este tipo.' : 'Nenhum benchmark. Clique em “Criar indicadores padrão”.'}
              ></urbi-tabela>
              ${this.somenteLeitura ? nothing : html`
                <div class="rodape">
                  <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus" @click=${() => { this.novoCampo = ''; this.mostrarNovo = true; }}>Novo indicador</urbi-botao>
                </div>`}
            </section>

            <section class="secao">
              <h3>Indicador de Sensibilidade</h3>
              <p class="sec">Faixa de variação que alimenta os cenários Bear / Base / Bull.</p>
              <urbi-tabela
                .colunas=${this._colunasSensibilidade()}
                .linhas=${this.itens}
                mensagem-vazio=${this.somenteLeitura ? 'Nenhum indicador definido para este tipo.' : 'Nenhum indicador. Clique em “Criar indicadores padrão”.'}
              ></urbi-tabela>
            </section>`}
      </urbi-hospedeiro>

      ${this.mostrarNovo ? this._renderNovo() : nothing}
      ${this.removerId != null ? this._renderConfirmRemover() : nothing}
    `;
  }

  // Célula numérica editável (ou só-leitura) para uma coluna decimal.
  private _celulaNum(b: any, key: string) {
    return this.somenteLeitura
      ? html`${fmtNum(Number(b[key]) || 0, 2)}`
      : html`<viab-num
          .valor=${this._num(b[key])}
          @urbi:input-numero-change=${(e: CustomEvent) => this._patch(b.id, { [key]: e.detail.valor })}
        ></viab-num>`;
  }

  // Colunas da seção "Indicador de Benchmark": meta (valor + regra).
  private _colunasBenchmark() {
    const ro = this.somenteLeitura;
    const regraLabel: Record<string, string> = {
      atingir_ou_superar: 'atingir ou superar', nao_exceder: 'não exceder',
    };
    const colunas: any[] = [
      { id: 'campo', label: 'Indicador', valor: (b: any) => b.campo },
      {
        id: 'valor', label: 'Valor', alinhamento: 'direita',
        render: (b: any) => this._celulaNum(b, 'valor'),
      },
      {
        id: 'regra', label: 'Regra',
        render: (b: any) => ro
          ? html`${regraLabel[b.regra_comparacao] || b.regra_comparacao}`
          : html`<urbi-select
              .valor=${b.regra_comparacao}
              .opcoes=${[
                { valor: 'atingir_ou_superar', rotulo: 'atingir ou superar' },
                { valor: 'nao_exceder', rotulo: 'não exceder' },
              ]}
              @urbi:select-change=${(e: CustomEvent) => this._patch(b.id, { regra_comparacao: e.detail.valor })}
            ></urbi-select>`,
      },
    ];
    if (!ro) {
      colunas.push({
        id: 'acoes', label: '',
        render: (b: any) => html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
          @click=${() => this.removerId = b.id}>Remover</urbi-botao>`,
      });
    }
    return colunas;
  }

  // Colunas da seção "Indicador de Sensibilidade": faixa de variação (± %).
  private _colunasSensibilidade() {
    return [
      { id: 'campo', label: 'Indicador', valor: (b: any) => b.campo },
      {
        id: 'varpos', label: 'Var + (%)', alinhamento: 'direita',
        render: (b: any) => this._celulaNum(b, 'variacao_positiva_pct'),
      },
      {
        id: 'varneg', label: 'Var − (%)', alinhamento: 'direita',
        render: (b: any) => this._celulaNum(b, 'variacao_negativa_pct'),
      },
    ];
  }

  private _renderNovo(): TemplateResult {
    return html`
      <urbi-modal title="Novo indicador" maxWidth="420px" @urbi-modal:close=${() => this.mostrarNovo = false}>
        <urbi-input
          label="Identificador do indicador"
          placeholder="ex: resultado_final"
          .valor=${this.novoCampo}
          @urbi:input-change=${(e: CustomEvent) => this.novoCampo = e.detail.valor}
        ></urbi-input>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.mostrarNovo = false}>Cancelar</urbi-botao>
          <urbi-botao variante="primario" ?desabilitado=${!this.novoCampo.trim()} @click=${this._novo}>Criar</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _renderConfirmRemover(): TemplateResult {
    return html`
      <urbi-modal title="Remover benchmark" maxWidth="380px" @urbi-modal:close=${() => this.removerId = null}>
        <p>Remover este benchmark?</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.removerId = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemover}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private async _patch(id: number, dados: Record<string, any>) {
    try {
      const res = await atualizarBenchmark(id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }

  private _confirmarRemover = async () => {
    const id = this.removerId;
    this.removerId = null;
    if (id == null) return;
    try {
      const res = await removerBenchmark(id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this._carregar();
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  };

  private async _novo() {
    const campo = this.novoCampo.trim();
    if (!campo) return;
    this.mostrarNovo = false;
    try {
      const res = await criarBenchmark({ tipo_empreendimento: this.tipo, campo, regra_comparacao: 'atingir_ou_superar' });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this._carregar();
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }

  private async _semear() {
    try {
      const res = await semearBenchmarks();
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      urbiVerso.notificar(`${res.criados ?? 0} indicador(es) criado(s).`, 'sucesso');
      this._carregar();
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }
}

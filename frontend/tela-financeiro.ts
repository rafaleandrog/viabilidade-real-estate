import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { urbiVerso, atualizarEstudo } from './viabilidade-api.js';
import './viab-num.js';

// Sub-aba "Viabilidade → Financeiro" (nível Avançado · Lote 7 · #22).
//
// Parâmetros financeiros do estudo, organizados em 5 seções roláveis
// (urbi-card empilhados — a alternativa que o próprio issue sugeriu ao 3º nível
// de aba): Estrutura · Custos Financeiros · Juros · Taxas e Impostos ·
// Financiamento & Investidores.
//
// ⚠️ ESCOPO (decisão do autor, Lote 7): "só persistir + realocar existentes".
// Estes campos são gravados/exibidos mas NÃO entram em nenhuma fórmula agora —
// o motor (proforma/fluxo) segue lendo exatamente os mesmos campos de antes.
// Isso é o que garante que nada de cálculo muda. A entrada dos juros/
// financiamento no fluxo de caixa é um passo futuro (spec de motor à parte).
//
// Campos REALOCADOS de outras telas (mesma coluna do schema, sem duplicar dado):
//  · `taxa_desconto_aa`  → editor mora aqui (removido do Cronograma no Lote 4;
//    é lido pelo motor de fluxo para VPL/TIR).
//  · `sujeito_ret` / `imposto_percentual` → também editáveis em Premissas
//    (componente compartilhado com o Preliminar, não mexido); aqui são a
//    referência do bloco de Impostos do Avançado. Editar em qualquer tela grava
//    a mesma coluna.

type Op = { valor: string; rotulo: string };

const OPT_INDICE: Op[] = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: 'incc', rotulo: 'INCC' },
  { valor: 'ipca', rotulo: 'IPCA' },
  { valor: 'igpm', rotulo: 'IGP-M' },
  { valor: 'cdi', rotulo: 'CDI' },
  { valor: 'tr', rotulo: 'TR' },
  { valor: 'inpc', rotulo: 'INPC' },
];
const OPT_REGIME: Op[] = [
  { valor: 'ret', rotulo: 'RET (patrimônio de afetação)' },
  { valor: 'lucro_presumido', rotulo: 'Lucro Presumido' },
  { valor: 'lucro_real', rotulo: 'Lucro Real' },
];
const OPT_AMORT: Op[] = [
  { valor: 'price', rotulo: 'PRICE (Tabela Price)' },
  { valor: 'sac', rotulo: 'SAC' },
];
const OPT_RETORNO: Op[] = [
  { valor: 'remunerado', rotulo: 'Remunerado (juros)' },
  { valor: 'pct_receita', rotulo: '% da Receita' },
  { valor: 'pct_resultado', rotulo: '% do Resultado' },
];

// Todos os campos numéricos (decimais + inteiros) — para coerção '' → null e
// Number(...) no salvar.
const CAMPOS_NUM: string[] = [
  'taxa_desconto_aa',
  'estrutura_capital_proprio_pct', 'estrutura_financiamento_pct', 'estrutura_investidores_pct',
  'taxa_juros_valor_futuro_aa',
  'tarifas_bancarias_pct', 'taxa_adm_carteira_pct', 'taxa_estruturacao_divida_pct', 'taxa_gerenciamento_obra_pct',
  'juros_financeiros_aa', 'juros_inicio_cobranca_mes', 'indice_correcao_taxa_aa',
  'aliquota_pis_pct', 'aliquota_cofins_pct', 'aliquota_csll_pct', 'aliquota_irpj_pct', 'aliquota_itbi_pct',
  'imposto_percentual',
  'financiamento_obra_pct', 'financiamento_juros_aa', 'financiamento_prazo_meses', 'financiamento_carencia_meses',
  'investidor_aporte_valor', 'investidor_juros_aa', 'investidor_carencia_meses', 'investidor_parcelas',
];
const NUM = new Set(CAMPOS_NUM);
// Inteiros (meses/parcelas) — viab-num com 0 casas decimais.
const INTEIROS = new Set([
  'juros_inicio_cobranca_mes', 'financiamento_prazo_meses', 'financiamento_carencia_meses',
  'investidor_carencia_meses', 'investidor_parcelas',
]);

@customElement('viab-tela-financeiro')
export class ViabTelaFinanceiro extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  private _idCarregado: number | null = null;

  static styles = [estiloConteudo, css`
    .secao h4 {
      margin: 0 0 4px; font-size: var(--texto-rotulo, 0.75rem);
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .dica { margin: 0 0 12px; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; }
    .grid > * { width: 210px; max-width: 100%; box-sizing: border-box; }
    .grid > .p1 { width: 165px; }
    .grid > .p3 { width: 330px; }
    .checks { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .sel-campo { display: flex; flex-direction: column; gap: 4px; }
    .sel-rotulo {
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
      display: flex; align-items: flex-end; min-height: 2.4em; line-height: 1.2;
    }
    .soma { margin: 10px 0 0; font-size: 0.78rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .soma strong { color: var(--cor-texto-forte, rgba(255,255,255,0.95)); font-variant-numeric: tabular-nums; }
    urbi-card + urbi-card { margin-top: 16px; }
    urbi-banner { margin-top: 12px; }
    .form-acoes { display: flex; justify-content: flex-end; margin-top: 16px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._init();
  }
  updated(ch: Map<string, unknown>) {
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  private _init() {
    if (!this.estudo) return;
    this._idCarregado = this.estudo.id ?? null;
    this.form = { ...this.estudo };
  }

  private _set(k: string, v: any) {
    this.form = { ...this.form, [k]: v };
  }

  private _num(k: string): number | null {
    const v = this.form[k];
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  private _str(k: string, padrao = ''): string {
    const v = this.form[k];
    return v == null || v === '' ? padrao : String(v);
  }

  // Campo numérico (decimal ou inteiro) com sufixo.
  private _n(k: string, label: string, sufixo: string, dis: boolean, w = 'p1'): TemplateResult {
    return html`<viab-num
      class=${w}
      label=${label} sufixo=${sufixo} ?desabilitado=${dis}
      casas-decimais=${INTEIROS.has(k) ? 0 : 2}
      .valor=${this._num(k)}
      @urbi:input-numero-change=${(e: CustomEvent) => this._set(k, e.detail.valor)}
    ></viab-num>`;
  }

  // Select (single) com rótulo alinhado ao padrão dos campos numéricos.
  private _s(k: string, label: string, opcoes: Op[], padrao: string, dis: boolean, w = 'p3'): TemplateResult {
    return html`
      <div class="sel-campo ${w}">
        <label class="sel-rotulo">${label}</label>
        <urbi-select
          ?desabilitado=${dis}
          .valor=${this._str(k, padrao)}
          .opcoes=${opcoes}
          @urbi:select-change=${(e: CustomEvent) => this._set(k, e.detail.valor)}
        ></urbi-select>
      </div>`;
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    const dis = !this.editavel;
    const somaEstrutura =
      (this._num('estrutura_capital_proprio_pct') || 0) +
      (this._num('estrutura_financiamento_pct') || 0) +
      (this._num('estrutura_investidores_pct') || 0);

    return html`
      <urbi-card titulo="Estrutura">
        <div class="secao">
          <h4>Estrutura de capital</h4>
          <p class="dica">Como o projeto é financiado. Informativo — os percentuais não precisam somar 100%.</p>
          <div class="grid">
            ${this._n('estrutura_capital_proprio_pct', 'Capital próprio', '%', dis)}
            ${this._n('estrutura_financiamento_pct', 'Financiamento', '%', dis)}
            ${this._n('estrutura_investidores_pct', 'Investidores', '%', dis)}
          </div>
          <p class="soma">Soma das fontes: <strong>${somaEstrutura.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong></p>
        </div>
        <div class="secao" style="margin-top:16px">
          <h4>Parâmetro base</h4>
          <div class="grid">
            ${this._n('taxa_juros_valor_futuro_aa', 'Taxa de juros p/ valor futuro', '% a.a.', dis)}
          </div>
        </div>
      </urbi-card>

      <urbi-card titulo="Custos Financeiros">
        <p class="dica">Valor presente e despesas financeiras paramétricas. Linhas manuais de custo financeiro seguem em Obra → Financeiro.</p>
        <div class="grid">
          ${this._n('taxa_desconto_aa', 'Taxa de desconto p/ VP', '% a.a.', dis)}
          ${this._n('tarifas_bancarias_pct', 'Tarifas bancárias', '% / receita', dis)}
          ${this._n('taxa_adm_carteira_pct', 'Taxa de adm. da carteira', '% / receita', dis)}
          ${this._n('taxa_estruturacao_divida_pct', 'Estruturação da dívida', '% financ.', dis)}
          ${this._n('taxa_gerenciamento_obra_pct', 'Taxa de gerenciamento', '% / obra', dis)}
        </div>
      </urbi-card>

      <urbi-card titulo="Juros">
        <div class="secao">
          <h4>Juros financeiros</h4>
          <div class="grid">
            ${this._n('juros_financeiros_aa', 'Taxa de juros', '% a.a.', dis)}
            ${this._n('juros_inicio_cobranca_mes', 'Início da cobrança', 'mês', dis)}
          </div>
        </div>
        <div class="secao" style="margin-top:16px">
          <h4>Correção / Indexação</h4>
          <p class="dica">Dois fatores: o índice de correção e uma taxa (% a.a.) informada pelo usuário.</p>
          <div class="grid">
            ${this._s('indice_correcao', 'Índice de correção', OPT_INDICE, 'nenhum', dis)}
            ${this._n('indice_correcao_taxa_aa', 'Taxa de correção', '% a.a.', dis)}
          </div>
        </div>
      </urbi-card>

      <urbi-card titulo="Taxas e Impostos">
        <div class="checks">
          <urbi-checkbox
            label="Sujeito a RET (patrimônio de afetação)"
            ?desabilitado=${dis}
            ?marcado=${!!this.form.sujeito_ret}
            @urbi:checkbox-change=${(e: CustomEvent) => this._set('sujeito_ret', e.detail.marcado)}
          ></urbi-checkbox>
          <urbi-checkbox
            label="Tributar permuta física"
            ?desabilitado=${dis}
            ?marcado=${!!this.form.imposto_sobre_permuta_fisica}
            @urbi:checkbox-change=${(e: CustomEvent) => this._set('imposto_sobre_permuta_fisica', e.detail.marcado)}
          ></urbi-checkbox>
        </div>
        <div class="grid">
          ${this._s('regime_tributario', 'Regime tributário', OPT_REGIME, 'ret', dis)}
          ${this._n('imposto_percentual', 'Imposto s/ vendas (se não RET)', '%', dis)}
          ${this._n('aliquota_pis_pct', 'PIS', '%', dis)}
          ${this._n('aliquota_cofins_pct', 'COFINS', '%', dis)}
          ${this._n('aliquota_csll_pct', 'CSLL', '%', dis)}
          ${this._n('aliquota_irpj_pct', 'IRPJ', '%', dis)}
          ${this._n('aliquota_itbi_pct', 'ITBI (terreno)', '%', dis)}
        </div>
      </urbi-card>

      <urbi-card titulo="Financiamento & Investidores">
        <div class="secao">
          <h4>Financiamento à produção</h4>
          <div class="grid">
            ${this._n('financiamento_obra_pct', 'Obra financiada', '%', dis)}
            ${this._n('financiamento_juros_aa', 'Juros', '% a.a.', dis)}
            ${this._s('financiamento_sistema_amortizacao', 'Sistema de amortização', OPT_AMORT, 'price', dis)}
            ${this._n('financiamento_prazo_meses', 'Prazo', 'meses', dis)}
            ${this._n('financiamento_carencia_meses', 'Carência', 'meses', dis)}
          </div>
        </div>
        <div class="secao" style="margin-top:16px">
          <h4>Investidores</h4>
          <div class="grid">
            ${this._n('investidor_aporte_valor', 'Aporte', 'R$', dis, 'p2')}
            ${this._s('investidor_retorno_tipo', 'Tipo de retorno', OPT_RETORNO, 'remunerado', dis)}
            ${this._n('investidor_juros_aa', 'Juros do investidor', '% a.a.', dis)}
            ${this._n('investidor_carencia_meses', 'Carência', 'meses', dis)}
            ${this._n('investidor_parcelas', 'Parcelas', 'x', dis)}
          </div>
        </div>
      </urbi-card>

      ${this.editavel
        ? html`
            <urbi-banner variante="alerta">
              As alterações não são salvas automaticamente — clique em “Salvar financeiro” antes de sair desta página.
            </urbi-banner>
            <div class="form-acoes">
              <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar financeiro</urbi-botao>
            </div>`
        : html`<p class="sec">Somente leitura neste status/função.</p>`}
    `;
  }

  private _salvar = async () => {
    this.salvando = true;
    try {
      const dados: Record<string, any> = {};
      for (const k of [
        ...CAMPOS_NUM,
        'indice_correcao', 'regime_tributario', 'financiamento_sistema_amortizacao', 'investidor_retorno_tipo',
        'sujeito_ret', 'imposto_sobre_permuta_fisica',
      ]) {
        if (!(k in this.form)) continue;
        const v = this.form[k];
        if (NUM.has(k)) dados[k] = v === '' || v == null ? null : Number(v);
        else dados[k] = v;
      }
      const res = await atualizarEstudo(this.estudo.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      urbiVerso.notificar('Financeiro salvo.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvando = false;
    }
  };
}

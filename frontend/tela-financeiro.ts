import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { urbiVerso, atualizarEstudo } from './viabilidade-api.js';
import './viab-num.js';

// Sub-aba "Viabilidade → Financeiro" (nível Avançado · Lote 7 · #22).
//
// Parâmetros financeiros do estudo: Custos Financeiros · Taxas e Impostos.
//
// #279 — CONTRATO ATUAL: todo controle desta tela tem efeito. O escopo original
// (Lote 7) era "só persistir + realocar", e a tela acumulou campos que nenhum
// motor lia; a #239 (Capital Stack) substituiu o modelo, e esta issue fecha o
// critério mais duro dela — "nenhum campo da aba Financeiro permanece inerte".
//
// Saíram da interface 9 controles sem consumidor: `taxa_juros_valor_futuro_aa`
// (esvaziou o card "Estrutura"); `tarifas_bancarias_pct`,
// `taxa_adm_carteira_pct`, `taxa_estruturacao_divida_pct` e
// `taxa_gerenciamento_obra_pct` (Custos Financeiros); `juros_financeiros_aa`,
// `juros_inicio_cobranca_mes`, `indice_correcao` e `indice_correcao_taxa_aa`
// (esvaziaram o card "Juros"). Estrutura de capital, financiamento e juros de
// dívida agora vivem no Capital Stack, com aporte e liberação mês a mês.
//
// ⚠️ As COLUNAS permanecem no schema e o dado histórico está intacto — a
// remoção física é issue própria, e esta tela simplesmente deixou de escrevê-las
// (saíram de CAMPOS_NUM e da lista de `_salvar`). Nada foi apagado.
//
// Os `aliquota_*` continuam na tela mesmo sem consumidor: são campos de regime
// tributário, escopo declarado da #228, e fora do escopo desta issue.
//
// Campos REALOCADOS de outras telas (mesma coluna do schema, sem duplicar dado):
//  · `taxa_desconto_aa`  → editor mora aqui (removido do Cronograma no Lote 4;
//    é lido pelo motor de fluxo para VPL/TIR).
//  · `sujeito_ret` / `imposto_percentual` → também editáveis em Premissas
//    (componente compartilhado com o Preliminar, não mexido); aqui são a
//    referência do bloco de Impostos do Avançado. Editar em qualquer tela grava
//    a mesma coluna.

type Op = { valor: string; rotulo: string };

const OPT_REGIME: Op[] = [
  { valor: 'ret', rotulo: 'RET (patrimônio de afetação)' },
  { valor: 'lucro_presumido', rotulo: 'Lucro Presumido' },
  { valor: 'lucro_real', rotulo: 'Lucro Real' },
];
// Todos os campos numéricos (decimais + inteiros) — para coerção '' → null e
// Number(...) no salvar.
//
// #239/FIN-10 (#279): `financiamento_*`, `investidor_*` e `estrutura_*_pct`
// SAÍRAM daqui (§13.4 — "o que foi substituído sai da interface"). O Capital
// Stack (`viab-capital-stack`, FIN-08/#277) cobriu financiamento à produção e
// Preferred Equity com o mesmo dado, de forma derivada (§2.6), não mais como
// input solto — e a #355 substituiu esse componente por `viab-funding`
// (aba "Funding"), preservando a mesma regra. As colunas continuam existindo
// no schema — dado histórico preservado — só o formulário saiu; nenhum motor
// de cálculo as lia (confirmado antes da #279: zero ocorrências em
// fluxo-caixa-motor.ts, fluxo-shared.ts, proforma.ts).
const CAMPOS_NUM: string[] = [
  'taxa_desconto_aa', 'juros_tabela_aa_padrao',
  'aliquota_pis_pct', 'aliquota_cofins_pct', 'aliquota_csll_pct', 'aliquota_irpj_pct', 'aliquota_itbi_pct',
  'imposto_percentual',
];
const NUM = new Set(CAMPOS_NUM);

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
      casas-decimais="2"
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

    return html`
      <urbi-banner variante="info">
        Estrutura de capital, financiamento à produção e investidores agora vivem na aba
        <strong>Funding</strong> — operações com aporte, liberação e retorno mês a mês, em vez de
        percentuais informativos soltos.
      </urbi-banner>
      <urbi-card titulo="Custos Financeiros">
        <p class="dica">Valor presente e despesas financeiras paramétricas. Linhas manuais de custo financeiro seguem em Obra → Financeiro.</p>
        <div class="grid">
          ${this._n('taxa_desconto_aa', 'Taxa de desconto p/ VP', '% a.a.', dis)}
        </div>
      </urbi-card>

      <urbi-card titulo="Regime comercial das linhas de receita">
        <!-- #477: cada linha de receita (Grupo, em Receitas) já é a unidade de
             regime comercial — tem sua própria absorção, plano de pagamento e
             juros de tabela. Este default só se aplica a linhas NOVAS, na
             criação; nunca sobrescreve uma linha já gravada. -->
        <p class="dica">
          Cada linha de receita (Grupo, na aba Receitas) tem seu próprio regime — absorção, plano de
          pagamento e juros de tabela. Para dois regimes diferentes (ex.: Residencial × Não
          residencial), crie duas linhas. O valor abaixo é só o <strong>default de linhas novas</strong>
          — editá-lo não muda nenhuma linha já criada.
        </p>
        <div class="grid">
          ${this._n('juros_tabela_aa_padrao', 'Juros de tabela padrão (linhas novas)', '% a.a.', dis)}
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
        'regime_tributario',
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

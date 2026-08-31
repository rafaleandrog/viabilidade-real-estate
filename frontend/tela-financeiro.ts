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
// #450 (D8/D-Q08, 2026-08-22): a auditoria seguinte achou mais 9 controles
// inertes NESTE nível — `regime_tributario`, os 5 `aliquota_*_pct` (o
// parágrafo acima dizia que eram "escopo da #228" e ficavam; não ficam mais),
// `imposto_sobre_permuta_fisica` e `sujeito_ret` só tinham leitor na proforma
// do Preliminar (o `sujeito_ret` de `frontend/proforma.ts:630`). Todos saíram
// do render e de `CAMPOS_NUM` — ver o bloco de comentário acima de
// `CAMPOS_NUM` para o destino de cada um.
//
// Campos REALOCADOS de outras telas (mesma coluna do schema, sem duplicar dado):
//  · `taxa_desconto_aa`   → editor mora aqui (removido do Cronograma no Lote 4;
//    é lido pelo motor de fluxo para VPL/TIR).
//  · `imposto_percentual` → visível aqui, mas SEMPRE DESABILITADO — o único
//    editor de verdade é Premissas (Preliminar, componente compartilhado, não
//    mexido). Editar lá grava a mesma coluna que esta tela mostra.

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
// #450 (D8/D-Q08, 2026-08-22): dos 10 controles que a aba tinha, 9 eram
// inertes no Avançado — só liam a proforma do PRELIMINAR (`imposto_percentual`,
// `sujeito_ret`) ou não tinham leitor nenhum (`regime_tributario`, os 5
// `aliquota_*_pct`, `imposto_sobre_permuta_fisica`). Destino, por controle:
//  · `sujeito_ret`                    → sai do RENDER (condição de nível —
//    D-Q08). A aba só existe para `nivel_analise === 'avancado'`, então a
//    condição colapsa em "sempre oculto aqui"; as funções puras abaixo
//    parametrizam por `nivel` para o teste provar a regra sem montar DOM.
//  · `imposto_percentual`             → fica VISÍVEL, sempre DESABILITADO,
//    com nota — é o único com leitor fora daqui (Preliminar:
//    `frontend/proforma.ts:245`, `frontend/tela-proforma.ts:226`).
//  · os outros 7 (`regime_tributario`, os 5 `aliquota_*_pct`,
//    `imposto_sobre_permuta_fisica`) → saem do render, do `_salvar` e de
//    `CAMPOS_NUM`. Nenhuma coluna sai do `schema.json` — dado histórico
//    preservado, só o formulário sai.

/** Campos de Taxas e Impostos que continuam no render da aba Financeiro do
 * Avançado — só `taxa_desconto_aa` (Custos Financeiros) e `imposto_percentual`
 * (desabilitado). Fora do Avançado a aba inteira não renderiza nada. */
export function camposVisiveisFinanceiro(nivel: string): string[] {
  if (nivel !== 'avancado') return [];
  return ['taxa_desconto_aa', 'imposto_percentual'];
}

/**
 * #585 — a taxa de tabela do estudo é válida?
 *
 * ⚠️ **Esta função existe porque a #585 REMOVEU uma validação e precisava
 * devolvê-la.** Enquanto a taxa era do plano, quem barrava taxa negativa era
 * `erroFormularioPagamento` (*"Revisao da #428, B2 — a taxa alimenta TODO
 * componente financiado do plano, e ate aqui nada a validava"*). O campo saiu do
 * modal e a validação saiu junto; sem ela, digitar `-5` aqui aplicava juros
 * NEGATIVOS a todo componente financiado de todo o estudo, sem erro nenhum.
 * Medido pelo caminho real: `parseNumeroBR('-5')` devolve `-5` (o regex de
 * `viab-format.ts` preserva o sinal), `viab-num` não tem piso, e
 * `taxaMensalDeAnual(-5)` devolve `-0,004265…`.
 *
 * A defesa de domínio do motor (`taxaMensalDeAnual`, que devolve `0` para
 * `aa <= -100` em vez de `NaN`) continua onde estava e cobre outra coisa: ela
 * impede o `NaN` de virar `null` no JSON. Ela **não** cobre a faixa
 * `-100 < aa < 0`, que é justamente a que um usuário digita sem querer.
 *
 * `null`/vazio é válido — significa "não configurado", e o motor lê 0.
 */
export function erroJurosTabelaEstudo(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const aa = Number(v);
  if (!Number.isFinite(aa) || aa < 0) {
    return 'Os juros de tabela devem ser um percentual ao ano maior ou igual a zero.';
  }
  return null;
}

/** #450 (D-Q08): `sujeito_ret` é condição de RENDER, não um campo desabilitado
 * — só aparece fora do Avançado. */
export function sujeitoRetVisivelFinanceiro(nivel: string): boolean {
  return nivel !== 'avancado';
}

/** `imposto_percentual` é o único campo do bloco de Impostos com leitor fora
 * desta tela (Preliminar) — fica visível, mas nunca editável por aqui. */
export function impostoPercentualEditavel(_nivel: string): boolean {
  return false;
}

const CAMPOS_NUM: string[] = [
  // #450 (D-Q08, 2026-08-22): os 5 `aliquota_*_pct` saíram daqui — inertes,
  // sem consumidor. Não reintroduzir; ver o bloco de comentário no topo do
  // arquivo. `juros_tabela_aa_padrao` é campo NOVO da #477, sem relação com
  // aquela remoção.
  'taxa_desconto_aa', 'juros_tabela_aa_padrao',
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

  render(): TemplateResult {
    const nivel = this.estudo?.nivel_analise;
    if (nivel !== 'avancado') return html`${nothing}`;
    const dis = !this.editavel;
    const visiveis = camposVisiveisFinanceiro(nivel);
    // #585: recalculado a cada render, então acompanha a digitação.
    const erroJuros = erroJurosTabelaEstudo(this.form['juros_tabela_aa_padrao']);

    return html`
      <urbi-banner variante="info">
        Estrutura de capital, financiamento à produção e investidores agora vivem na aba
        <strong>Funding</strong> — operações com aporte, liberação e retorno mês a mês, em vez de
        percentuais informativos soltos.
      </urbi-banner>
      <urbi-card titulo="Custos Financeiros">
        <p class="dica">Valor presente e despesas financeiras paramétricas. Linhas manuais de custo financeiro seguem em Obra → Financeiro.</p>
        <div class="grid">
          ${visiveis.includes('taxa_desconto_aa')
            ? this._n('taxa_desconto_aa', 'Taxa de desconto p/ VP', '% a.a.', dis) : nothing}
        </div>
      </urbi-card>

      <urbi-card titulo="Juros de tabela">
        <!-- #585 (decisão do autor, 2026-08-26): "campo juros de tabela funciona
             para todos os imóveis igualmente e o valor não é inserido aqui. será
             na aba financeiro". A taxa deixou de ser por Grupo (D-Q02 da #428) e
             de ser default de criação (#477): é UM valor do estudo, e muda o
             cálculo de TODAS as linhas de receita, as já criadas inclusive.
             Quem for "arrumar" isto de volta para uma taxa por linha: a taxa
             única é o pedido, não um descuido. -->
        <p class="dica">
          Juros da tabela de venda a prazo, em % ao ano, <strong>para o estudo inteiro</strong> —
          entrada parcelada, parcelamento e repasse de <strong>todas</strong> as linhas de receita.
          Convertidos para a taxa mensal equivalente pela composição (1 + i)^(1/12) − 1, nunca por
          i/12. Editar este campo <strong>muda o cálculo de todas as linhas já criadas</strong>;
          0% é venda sem juros.
        </p>
        <p class="dica">
          Cada linha de receita (Grupo, na aba Receitas) continua sendo a unidade de regime
          comercial — absorção e plano de pagamento são dela. Os <strong>juros</strong>, não: eles
          são um só para o estudo. Regimes com taxas diferentes (ex.: Residencial × Não residencial)
          não são representáveis nesta versão.
        </p>
        <div class="grid">
          ${this._n('juros_tabela_aa_padrao', 'Juros de tabela', '% a.a.', dis)}
        </div>
      </urbi-card>

      <urbi-card titulo="Taxas e Impostos">
        <div class="grid">
          ${visiveis.includes('imposto_percentual')
            ? this._n('imposto_percentual', 'Imposto (se não RET)', '%', !impostoPercentualEditavel(nivel))
            : nothing}
        </div>
        <p class="sec">Vale só para o Preliminar — editado aqui ou em Premissas, é o mesmo campo.
          O Avançado não tem consumidor para ele.</p>
      </urbi-card>

      ${this.editavel
        ? html`
            <urbi-banner variante="alerta">
              As alterações não são salvas automaticamente — clique em “Salvar financeiro” antes de sair desta página.
            </urbi-banner>
            ${erroJuros ? html`
              <urbi-banner variante="erro">${erroJuros}</urbi-banner>` : nothing}
            <div class="form-acoes">
              <!-- #585 (rodada 2): o botão trava ENQUANTO o valor é inválido, e
                   não só ao clicar. É o padrão que o modal irmão já usa em
                   tela-fluxo-receitas.ts, onde o "Aplicar" recebe desabilitado
                   a partir de erroFormularioPagamento: o usuário vê o erro no
                   ato de digitar, com a mensagem visível na tela, em vez de
                   descobri-lo por um toast que some e sem saber qual campo o
                   causou. A checagem dentro de _salvar FICA — botão é
                   affordance, não fronteira.
                   (Sem cifrão-chaves neste comentário de propósito: dentro de um
                   template do lit ele é uma INTERPOLAÇÃO mesmo dentro de
                   comentário HTML, e o guard acusa o erro na linha errada.) -->
              <urbi-botao variante="primario" ?carregando=${this.salvando}
                ?desabilitado=${Boolean(erroJuros)} @click=${this._salvar}>Salvar financeiro</urbi-botao>
            </div>`
        : html`<p class="sec">Somente leitura neste status/função.</p>`}
    `;
  }

  private _salvar = async () => {
    // #585/B1: a taxa de tabela do estudo alimenta TODA linha de receita — uma
    // taxa negativa aqui não é um campo estranho numa tela, é o cálculo do
    // estudo inteiro invertido. Barra antes de persistir.
    const invalido = erroJurosTabelaEstudo(this.form['juros_tabela_aa_padrao']);
    if (invalido) { urbiVerso.notificar(invalido, 'erro'); return; }
    this.salvando = true;
    try {
      const dados: Record<string, any> = {};
      for (const k of CAMPOS_NUM) {
        if (!(k in this.form)) continue;
        const v = this.form[k];
        if (NUM.has(k)) dados[k] = v === '' || v == null ? null : Number(v);
        else dados[k] = v;
      }
      const res = await atualizarEstudo(this.estudo.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      // #585/B3: PROPAGA o valor salvo para as outras abas.
      //
      // Sem esta linha o PATCH grava e a tela notifica, mas `tela-avancado`
      // continua distribuindo o `estudo` ANTIGO para Receitas, Resumo, Fluxo,
      // Cenários e Funding — que é de onde cada uma tira
      // `jurosTabelaAaEstudo`. O usuário salvaria 12,5%, navegaria sem
      // recarregar a página e veria o cálculo da taxa velha, sem erro nenhum.
      //
      // Enquanto a coluna era default de linhas novas (#477) a defasagem era
      // inofensiva: quem a aplicava era o backend, na criação. Desde a #585 ela
      // manda no cálculo de tudo, e a promessa do critério 2 — "editar este
      // campo muda todas as linhas" — passa a depender desta propagação.
      //
      // `viab:premissas-change` é o canal que já existe: `tela-premissas` o
      // emite e `tela-estudo` o escuta no `urbi-shell-page` que contém
      // `viab-tela-avancado`, refazendo `this.estudo` e reenviando-o para baixo.
      this.dispatchEvent(new CustomEvent('viab:premissas-change', {
        detail: { dados }, bubbles: true, composed: true,
      }));
      urbiVerso.notificar('Financeiro salvo.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvando = false;
    }
  };
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct } from './viab-format.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import type { OperacaoFunding } from './funding-motor.js';
import {
  MAX_ALTERNATIVAS, alternativaDoSalvo, novaOperacaoAlternativa, planoUsarAlternativa, planoVazio,
  lerAlternativas, gravarAlternativas, errosDoEstadoFinal, sincronizarAncoras, religarCriadas,
  type AlternativaFunding, type IndicadoresEstrutura, type PlanoUsarAlternativa,
} from './funding-alternativas.js';
import './viab-num.js';

// ─────────────────────────────────────────────────────────────────────────
// Aba "Comparar estruturas" do Funding.
//
// Apresentação e edição em memória: o componente NÃO calcula nada — pede cada
// simulação à tela por `simular` e só desenha os quatro indicadores lado a
// lado. As alternativas ficam no navegador (localStorage por estudo); a API só
// é tocada quando o usuário confirma "Usar esta", e quem grava é a tela, que
// recebe o plano pelo evento `viab:usar-alternativa`.
// ─────────────────────────────────────────────────────────────────────────

/** Operação de uma alternativa: o `__fora` é só da tela (operação que a alternativa dispensa) e nunca entra em simulação nem em plano. */
type OpAlt = OperacaoFunding & { __fora?: boolean };

const ROTULO_TIPO: Record<string, string> = {
  financiamento_producao: 'Financiamento à produção',
  divida: 'Dívida',
  equity: 'Equity',
  antecipacao_recebiveis: 'Antecipação',
};

const EVENTOS_ROTULO: Record<string, string> = {
  planejamento: 'Planejamento', pre_lancamento: 'Pré-lançamento', lancamento: 'Lançamento',
  obra: 'Obra', pos_obra: 'Pós-obras',
};

const efetivas = (alt: AlternativaFunding): OperacaoFunding[] =>
  (alt.operacoes as OpAlt[]).filter((o) => !o.__fora);

const ancorada = (o: OperacaoFunding): boolean => {
  const ev = (o as any).cronograma_evento;
  return (!!ev && ev !== 'customizado') || (o as any).fase_ancora_id != null;
};

/** O campo que carrega o "tamanho" da operação, por tipo (R$ ou %). */
function campoValor(o: OperacaoFunding): { campo: keyof OperacaoFunding; sufixo: string } {
  if (o.tipo === 'financiamento_producao') return { campo: 'percentual_financiavel', sufixo: '% financiado' };
  if (o.tipo === 'antecipacao_recebiveis') return { campo: 'pct_carteira_cedida', sufixo: '% da carteira' };
  return { campo: 'valor', sufixo: 'R$' };
}

function campoTaxa(o: OperacaoFunding): { campo: keyof OperacaoFunding; sufixo: string } {
  return o.tipo === 'equity'
    ? { campo: 'pct_retorno', sufixo: '% retorno' }
    : { campo: 'taxa_anual', sufixo: '% a.a.' };
}

@customElement('viab-funding-alternativas')
export class ViabFundingAlternativas extends LitElement {
  @property() estudoId: number | string | null = null;
  @property({ type: Boolean }) editavel = false;
  @property({ attribute: false }) salvas: OperacaoFunding[] = [];
  /** Obrigatório: sem o simulador a tabela sairia toda em "—" sem erro nenhum. */
  @property({ attribute: false }) simular!: (ops: OperacaoFunding[]) => IndicadoresEstrutura | null;
  @property() dataInicio: string | null = null;

  @state() private alternativas: AlternativaFunding[] = [];
  @state() private usarIdx: number | null = null;

  private _estudoCarregado: number | string | null = null;
  private _cache = new Map<string, IndicadoresEstrutura | null>();

  static styles = [estiloPrimitivo, estiloConteudo, css`
    :host { display: block; }
    .acao { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .nota { font-size: 0.78rem; color: var(--cor-texto-sec); margin: 0 0 12px; }
    .alt { margin-bottom: 16px; }
    .alt-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .alt-cab urbi-input { min-width: 220px; }
    .alt-cab .espaco { flex: 1; }
    .rolagem { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 6px 8px; vertical-align: middle; border-bottom: 1px solid; border-color: var(--cor-borda); }
    th {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec); font-weight: 700;
    }
    td.num, th.num { text-align: right; }
    td.fora { color: var(--cor-texto-sec); }
    .ops td viab-num { min-width: 120px; }
    .igual { font-size: 0.7rem; color: var(--cor-sucesso); font-weight: 700; display: block; }
    .comparativo { margin-top: 8px; }
    .comparativo h3 { margin: 0 0 8px; font-size: 1rem; }
    .neg { color: var(--cor-erro); }
    .form-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  `];

  willUpdate(mudou: Map<string, unknown>) {
    if (mudou.has('estudoId') && this.estudoId != null && this.estudoId !== this._estudoCarregado) {
      this._estudoCarregado = this.estudoId;
      this.alternativas = lerAlternativas(this.estudoId);
    }
    if (mudou.has('simular') || mudou.has('salvas')) {
      // O cache vale para UM simulador e UM conjunto de salvas: trocou, descarta.
      this._cache.clear();
    }
    if ((mudou.has('salvas') || mudou.has('estudoId')) && this.alternativas.length) {
      // A âncora pode ter andado desde que a alternativa foi guardada.
      const sinc = this.alternativas.map((a) => {
        // E as operações criadas por um "Usar esta" anterior recebem o id que ganharam.
        const ops = sincronizarAncoras(religarCriadas(a.operacoes, this.salvas ?? []), this.salvas ?? []);
        return ops === a.operacoes ? a : { ...a, operacoes: ops };
      });
      if (sinc.some((a, k) => a !== this.alternativas[k])) this._gravar(sinc);
    }
  }

  private _gravar(alts: AlternativaFunding[]) {
    this.alternativas = alts;
    if (this.estudoId != null) gravarAlternativas(this.estudoId, alts);
  }

  private _simular(ops: OperacaoFunding[]): IndicadoresEstrutura | null {
    const chave = JSON.stringify(ops);
    if (this._cache.has(chave)) return this._cache.get(chave) ?? null;
    let r: IndicadoresEstrutura | null = null;
    if (typeof this.simular !== 'function') throw new Error('viab-funding-alternativas: `simular` não informado');
    try { r = this.simular(ops); } catch { r = null; }
    if (this._cache.size > 24) this._cache.clear();
    this._cache.set(chave, r);
    return r;
  }

  private _nova() {
    if (this.alternativas.length >= MAX_ALTERNATIVAS) return;
    const nome = `Alternativa ${this.alternativas.length + 1}`;
    this._gravar([...this.alternativas, alternativaDoSalvo(this.salvas, nome)]);
  }

  private _remover(i: number) {
    this._gravar(this.alternativas.filter((_, k) => k !== i));
  }

  private _alterar(i: number, f: (a: AlternativaFunding) => AlternativaFunding) {
    this._gravar(this.alternativas.map((a, k) => (k === i ? f(a) : a)));
  }

  private _alterarOp(i: number, j: number, patch: Record<string, unknown>) {
    this._alterar(i, (a) => ({
      ...a, operacoes: a.operacoes.map((o, k) => (k === j ? { ...o, ...patch } : o)),
    }));
  }

  private _incluirOp(i: number, j: number, incluir: boolean) {
    const op = this.alternativas[i].operacoes[j];
    if (op.tipo === 'financiamento_producao') this._alterarOp(i, j, { ativo: incluir });
    else if (incluir) {
      // Re-incluir apaga o marcador em vez de deixar `__fora: false` na operação.
      this._alterar(i, (a) => ({
        ...a, operacoes: a.operacoes.map((o, k) => {
          if (k !== j) return o;
          const { __fora: _f, ...resto } = o as OpAlt;
          return resto as OperacaoFunding;
        }),
      }));
    } else this._alterarOp(i, j, { __fora: true });
  }

  private _addOp(i: number, tipo: 'divida' | 'equity') {
    const nome = tipo === 'divida' ? 'Nova dívida' : 'Novo equity';
    this._alterar(i, (a) => ({ ...a, operacoes: [...a.operacoes, novaOperacaoAlternativa(tipo, nome)] }));
  }

  private _plano(alt: AlternativaFunding): PlanoUsarAlternativa {
    return planoUsarAlternativa(this.salvas, { ...alt, operacoes: efetivas(alt) });
  }

  private _confirmarUso() {
    const i = this.usarIdx;
    this.usarIdx = null;
    if (i == null || !this.alternativas[i]) return;
    const alt = this.alternativas[i];
    const plano = this._plano(alt);
    if (planoVazio(plano) || errosDoEstadoFinal(alt).length) return;
    this.dispatchEvent(new CustomEvent('viab:usar-alternativa', {
      detail: { plano, nome: alt.nome, erros: errosDoEstadoFinal(alt) }, bubbles: true, composed: true,
    }));
  }

  private _linhaOp(i: number, j: number, o: OpAlt): TemplateResult {
    const fora = !!o.__fora;
    const incluida = o.tipo === 'financiamento_producao' ? o.ativo !== false : !fora;
    const v = campoValor(o);
    const t = campoTaxa(o);
    const inicioEditavel = !ancorada(o) && o.tipo !== 'financiamento_producao';
    const ev = (o as any).cronograma_evento as string | undefined;
    return html`<tr>
      <td>
        <urbi-checkbox ?marcado=${incluida} label="Incluir"
          @urbi:checkbox-change=${(e: CustomEvent) => this._incluirOp(i, j, !!e.detail.marcado)}
        ></urbi-checkbox>
      </td>
      <td>${ROTULO_TIPO[o.tipo] ?? o.tipo}</td>
      <td>
        <urbi-input .valor=${o.nome ?? ''}
          @urbi:input-change=${(e: CustomEvent) => this._alterarOp(i, j, { nome: e.detail.valor })}
        ></urbi-input>
      </td>
      <td>
        <viab-num label=${v.sufixo} sufixo=${v.sufixo} casas-decimais="2"
          .valor=${(o[v.campo] as number | undefined) ?? null}
          @urbi:input-numero-change=${(e: CustomEvent) => this._alterarOp(i, j, { [v.campo]: e.detail.valor ?? 0 })}
        ></viab-num>
      </td>
      <td>
        <viab-num label=${t.sufixo} sufixo=${t.sufixo} casas-decimais="2"
          .valor=${(o[t.campo] as number | undefined) ?? null}
          @urbi:input-numero-change=${(e: CustomEvent) => this._alterarOp(i, j, { [t.campo]: e.detail.valor ?? 0 })}
        ></viab-num>
      </td>
      <td>
        ${o.tipo === 'financiamento_producao'
          ? html`<span class="nota">Pelo Cronograma</span>`
          : inicioEditavel
            ? html`<viab-num label="Início" sufixo="º mês" casas-decimais="0"
                .valor=${o.inicio_mes ?? 0}
                @urbi:input-numero-change=${(e: CustomEvent) => this._alterarOp(i, j, { inicio_mes: e.detail.valor ?? 0 })}
              ></viab-num>`
            : html`<span class="nota">${ev && ev !== 'customizado' ? `${EVENTOS_ROTULO[ev] ?? ev}: ` : ''}${rotuloMesRelativo(this.dataInicio, o.inicio_mes ?? 0)} 🔒 (pelo Cronograma)</span>`}
      </td>
    </tr>`;
  }

  private _cardAlternativa(a: AlternativaFunding, i: number): TemplateResult {
    return html`
      <urbi-card class="alt">
        <div class="alt-cab">
          <urbi-input .valor=${a.nome}
            @urbi:input-change=${(e: CustomEvent) => this._alterar(i, (x) => ({ ...x, nome: e.detail.valor }))}
          ></urbi-input>
          <span class="espaco"></span>
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
            @click=${() => this._addOp(i, 'divida')}>Dívida</urbi-botao>
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
            @click=${() => this._addOp(i, 'equity')}>Equity</urbi-botao>
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" .ariaLabel=${'Remover alternativa'} title="Remover alternativa"
            @click=${() => this._remover(i)}></urbi-botao>
        </div>
        ${errosDoEstadoFinal(a).length ? html`<urbi-banner variante="alerta" icone="fa-solid fa-triangle-exclamation">
          <strong>Esta alternativa não pode ser usada:</strong>
          <ul>${errosDoEstadoFinal(a).map((m) => html`<li>${m}</li>`)}</ul>
        </urbi-banner>` : nothing}
        <div class="rolagem">
          <table class="ops">
            <thead><tr>
              <th>Incluir</th><th>Tipo</th><th>Nome</th><th>Valor</th><th>Taxa / retorno</th><th>Início</th>
            </tr></thead>
            <tbody>${a.operacoes.map((o, j) => this._linhaOp(i, j, o as OpAlt))}</tbody>
          </table>
        </div>
      </urbi-card>`;
  }

  /** `base` é o indicador do funding salvo: a célula de alternativa que difere dele leva `difere` (gancho do caso de render). */
  private _celula(ind: IndicadoresEstrutura | null, k: keyof IndicadoresEstrutura, base?: IndicadoresEstrutura | null): TemplateResult {
    const v = ind ? ind[k] : null;
    if (v === null || v === undefined) return html`<td class="num vazio">—</td>`;
    const difere = base != null && base[k] !== v ? 'difere' : '';
    if (k === 'tirAlavancada') return html`<td class="num com-valor ${difere}">${fmtPct(v)}</td>`;
    // A exposição sai em magnitude, como no resto do app; o sinal fica na cor.
    const mostrado = k === 'exposicaoMaxima' ? Math.abs(v) : v;
    return html`<td class="num com-valor ${difere} ${v < 0 ? 'neg' : ''}">${fmtR$(mostrado)}</td>`;
  }

  private _tabelaComparativa(): TemplateResult {
    const salvo = this._simular(this.salvas);
    const colunas = this.alternativas.map((a) => ({
      a, ind: this._simular(efetivas(a)), igual: planoVazio(this._plano(a)),
      invalida: errosDoEstadoFinal(a).length > 0,
    }));
    const linhas: { rotulo: string; chave: keyof IndicadoresEstrutura }[] = [
      { rotulo: 'Exposição máxima', chave: 'exposicaoMaxima' },
      { rotulo: 'TIR alavancada (% a.a.)', chave: 'tirAlavancada' },
      { rotulo: 'Custo financeiro do funding', chave: 'custoFinanceiro' },
      { rotulo: 'Resultado após funding', chave: 'resultadoAposFunding' },
    ];
    return html`
      <div class="comparativo">
        <h3>Comparação</h3>
        <div class="rolagem">
          <table class="comparacao">
            <thead><tr>
              <th>Indicador</th>
              <th class="num">Funding salvo</th>
              ${colunas.map((c, i) => html`<th class="num">
                ${c.a.nome}${c.igual ? html`<span class="igual">igual ao salvo</span>` : nothing}
                ${this.editavel ? html`<urbi-botao variante="primario" pequeno icone="fa-solid fa-check"
                  ?desabilitado=${c.igual || c.invalida}
                  @click=${() => { this.usarIdx = i; }}>Usar esta</urbi-botao>` : nothing}
              </th>`)}
            </tr></thead>
            <tbody>
              ${linhas.map((l) => html`<tr>
                <td>${l.rotulo}</td>
                ${this._celula(salvo, l.chave)}
                ${colunas.map((c) => this._celula(c.ind, l.chave, salvo))}
              </tr>`)}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  private _modalUsar(): TemplateResult | typeof nothing {
    const i = this.usarIdx;
    if (i == null || !this.alternativas[i]) return nothing;
    const alt = this.alternativas[i];
    const plano = this._plano(alt);
    const salvaPorId = new Map(this.salvas.map((s) => [s.id, s]));
    const desligadas = plano.atualizar.filter((u) =>
      salvaPorId.get(u.id)?.tipo === 'financiamento_producao' && u.campos.ativo === false).length;
    const alteradas = plano.atualizar.length - desligadas;
    return html`
      <urbi-modal title="Usar esta estrutura" maxWidth="460px"
        @urbi-modal:close=${() => { this.usarIdx = null; }}>
        <p>Aplicar <strong>${alt.nome}</strong> ao funding do estudo vai gravar:</p>
        <ul>
          <li>${plano.criar.length} operação(ões) criada(s)</li>
          <li>${alteradas} operação(ões) alterada(s)</li>
          <li>${plano.remover.length} operação(ões) removida(s)</li>
          ${desligadas ? html`<li>${desligadas} Financiamento à produção desligado (não é removido)</li>` : nothing}
        </ul>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => { this.usarIdx = null; }}>Cancelar</urbi-botao>
          <urbi-botao variante="primario" @click=${() => this._confirmarUso()}>Usar esta</urbi-botao>
        </div>
      </urbi-modal>`;
  }

  render() {
    const cheio = this.alternativas.length >= MAX_ALTERNATIVAS;
    return html`
      <p class="nota">
        Monte até ${MAX_ALTERNATIVAS} estruturas de capital e compare com o funding salvo. As alternativas
        ficam guardadas só neste navegador (sem armazenamento, duram até recarregar a página) e nada é gravado no estudo até você escolher "Usar esta".
      </p>
      <div class="acao">
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          ?desabilitado=${cheio}
          @click=${() => this._nova()}>Nova alternativa a partir do funding salvo</urbi-botao>
      </div>
      ${this.alternativas.length === 0
        ? html`<urbi-estado-vazio icone="fa-solid fa-scale-balanced"
            mensagem="Nenhuma alternativa ainda. Crie uma a partir do funding salvo e altere as operações."></urbi-estado-vazio>`
        : html`${this.alternativas.map((a, i) => this._cardAlternativa(a, i))}${this._tabelaComparativa()}`}
      ${this._modalUsar()}
    `;
  }
}

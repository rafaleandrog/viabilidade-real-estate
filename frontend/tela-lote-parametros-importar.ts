import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  lerCsv, casarPlanilha, itensDaImportacao, ROTULO_LINHA,
  type LoteNucleo, type ResultadoLinha, type StatusLinha,
} from './lote-parametros.js';

// Diálogo "Importar parâmetros dos lotes" (CSV): lê a planilha no navegador, casa cada linha com UM lote
// do módulo (rua + número, e confere a área) e mostra o que vai entrar ANTES de gravar. Só as linhas
// casadas entram. Como no modal de um lote, a gravação NÃO mora aqui: ele emite
// `viab-parametros-importar` (detail: { itens, origem }) e `viab-parametros-fechar`; o Painel grava.
// `importando` e `erro` vêm de lá, e `resumoFinal` traz o resultado depois da gravação.

@customElement('viab-lote-parametros-importar')
export class ViabLoteParametrosImportar extends LitElement {
  /** Lotes ATIVOS do módulo (a lista completa, não só a filtrada da aba). */
  @property({ attribute: false }) lotes: LoteNucleo[] = [];
  @property({ type: Boolean }) importando = false;
  @property() erro = '';
  /** Resultado da gravação feita pelo Painel: `{ ok, falhas: string[] }`. */
  @property({ attribute: false }) resumoFinal: { ok: number; falhas: string[] } | null = null;

  @state() private nomeArquivo = '';
  @state() private resultado: ResultadoLinha[] = [];
  @state() private errosLeitura: string[] = [];

  static styles = css`
    .corpo { display: flex; flex-direction: column; gap: 12px; }
    .resumo { margin: 0; color: var(--cor-texto-sec); font-size: var(--texto-rotulo, 0.75rem); }
    .acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    ul { margin: 0; padding-left: 20px; }
  `;

  private _fechar = () => {
    if (this.importando) return;
    this.dispatchEvent(new CustomEvent('viab-parametros-fechar', { bubbles: true, composed: true }));
  };

  private _arquivo = async (e: CustomEvent) => {
    const f: File | null = e.detail?.arquivo ?? null;
    this.resultado = []; this.errosLeitura = []; this.nomeArquivo = '';
    if (!f) return;
    this.nomeArquivo = f.name;
    try {
      const { linhas, erros } = lerCsv(await f.text());
      this.errosLeitura = erros;
      this.resultado = casarPlanilha(linhas, this.lotes);
    } catch (err: any) {
      this.errosLeitura = [err?.message || 'Não foi possível ler o arquivo.'];
    }
  };

  private get _itens() { return itensDaImportacao(this.resultado, this.nomeArquivo); }

  private _importar = () => {
    if (this.importando || this._itens.length === 0) return;
    this.dispatchEvent(new CustomEvent('viab-parametros-importar', {
      detail: { itens: this._itens, origem: this.nomeArquivo }, bubbles: true, composed: true,
    }));
  };

  private _contagens(): Array<[StatusLinha, number]> {
    const c = new Map<StatusLinha, number>();
    for (const r of this.resultado) c.set(r.status, (c.get(r.status) ?? 0) + 1);
    return [...c.entries()];
  }

  render(): TemplateResult {
    const itens = this._itens.length;
    const problemas = this.resultado.filter((r) => r.status !== 'casado');
    return html`
      <urbi-modal title="Importar parâmetros dos lotes" maxWidth="760px" @urbi-modal:close=${this._fechar}>
        <div class="corpo">
          <p class="resumo">
            CSV com as colunas <strong>logradouro</strong> (ou rua), <strong>numero</strong>, e ao menos uma de
            <strong>cmax</strong>, <strong>cmin</strong>, <strong>gabarito</strong>; opcionais <strong>area_m2</strong>
            (conferida contra o módulo), <strong>uos</strong> e <strong>uso</strong>. O lote é achado pela rua e pelo
            número, sem distinguir acento ou caixa. Nada é escrito no módulo.
          </p>
          ${this.resumoFinal ? nothing : html`
            <urbi-seletor-arquivo
              label="Planilha (CSV)"
              texto="Selecionar arquivo"
              accept=".csv,.txt"
              ?desabilitado=${this.importando}
              @urbi:seletor-arquivo-change=${this._arquivo}
            ></urbi-seletor-arquivo>`}
          ${this.errosLeitura.length ? html`
            <urbi-banner variante="alerta"><ul>${this.errosLeitura.slice(0, 8).map((m) => html`<li>${m}</li>`)}</ul></urbi-banner>` : nothing}
          ${this.resultado.length && !this.resumoFinal ? html`
            <p class="resumo">
              ${this.resultado.length} linha(s) em ${this.nomeArquivo}:
              ${this._contagens().map(([s, n]) => html`<span>${n} · ${ROTULO_LINHA[s]}. </span>`)}
            </p>
            ${problemas.length ? html`
              <urbi-banner variante="alerta">Estas linhas NÃO serão importadas:
                <ul>${problemas.slice(0, 12).map((r) => html`<li>Linha ${r.linha.linha} (${r.linha.rua} ${r.linha.numero}): ${ROTULO_LINHA[r.status]}</li>`)}
                ${problemas.length > 12 ? html`<li>… e mais ${problemas.length - 12}.</li>` : nothing}</ul>
              </urbi-banner>` : nothing}` : nothing}
          ${this.resumoFinal ? html`
            <urbi-banner variante=${this.resumoFinal.falhas.length ? 'alerta' : 'sucesso'}>
              ${this.resumoFinal.ok} lote(s) gravado(s)${this.resumoFinal.falhas.length ? `, ${this.resumoFinal.falhas.length} com erro:` : '.'}
              ${this.resumoFinal.falhas.length ? html`<ul>${this.resumoFinal.falhas.slice(0, 12).map((m) => html`<li>${m}</li>`)}</ul>` : nothing}
            </urbi-banner>` : nothing}
          ${this.erro ? html`<urbi-banner variante="erro">${this.erro}</urbi-banner>` : nothing}
          <div class="acoes">
            <urbi-botao variante="fantasma" ?desabilitado=${this.importando} @click=${this._fechar}>${this.resumoFinal ? 'Fechar' : 'Cancelar'}</urbi-botao>
            ${this.resumoFinal ? nothing : html`
              <urbi-botao variante="primario" ?desabilitado=${itens === 0 || this.importando} ?carregando=${this.importando} @click=${this._importar}>
                Importar ${itens} lote(s)
              </urbi-botao>`}
          </div>
        </div>
      </urbi-modal>`;
  }
}

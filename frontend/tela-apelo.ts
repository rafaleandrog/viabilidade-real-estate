import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import {
  urbiVerso, buscarApelo, uploadDocumentoApelo, anexarDocumentoApelo, removerDocumentoApelo, analisarApelo,
} from './viabilidade-api.js';

@customElement('viab-tela-apelo')
export class ViabTelaApelo extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private apelo: any = null;
  @state() private documentos: any[] = [];
  @state() private carregando = true;
  @state() private analisando = false;
  @state() private tipoDado = 'anuncios';
  @state() private textoAdicional = '';

  static styles = [estiloConteudo, css`
    .docs { display: flex; flex-direction: column; margin: 8px 0; }
    .doc { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); }
    .upload-form { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .upload-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
    .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 8px 0 16px; }
    .fator-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .perg { font-size: var(--texto-corpo, 0.8125rem); margin: 8px 0; }
    .perg-nota { margin-right: 6px; }
    .rel { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
    h4 { margin: 12px 0 8px; font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase; letter-spacing: 0.05em; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    urbi-card + urbi-card { margin-top: 16px; }
  `];

  connectedCallback() { super.connectedCallback(); this._carregar(); }
  updated(ch: Map<string, unknown>) { if (ch.has('estudo')) this._carregar(); }

  private async _carregar() {
    if (!this.estudo) return;
    this.carregando = true;
    try {
      const res = await buscarApelo(this.estudo.id);
      this.apelo = res?.apelo || null;
      this.documentos = res?.documentos || [];
    } catch (e) { console.error(e); }
    this.carregando = false;
  }

  render() {
    if (!this.estudo) return nothing;
    if (this.carregando) return html`<urbi-loading mensagem="Carregando análise..."></urbi-loading>`;
    const r = this.apelo?.resultado;
    return html`
      <urbi-card titulo="Apelo Comercial do Imóvel (IA)">
        <p class="sec">
          Avaliação qualitativa em 6 fatores a partir de documentos e dados de mercado.
          Anexe arquivos (PDF/Word/Excel) e/ou texto e dispare a análise.
        </p>

        <h4>Fontes anexadas</h4>
        ${this.documentos.length === 0
          ? html`<p class="sec">Nenhuma fonte anexada.</p>`
          : html`<div class="docs">
              ${this.documentos.map((d) => html`
                <div class="doc">
                  <span>${d.tipo_dado || 'fonte'}${d.texto_adicional ? ' · texto' : ''}${d.documento ? ' · arquivo' : ''}</span>
                  ${this.editavel
                    ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
                        @click=${() => this._remover(d.id)}>Remover</urbi-botao>`
                    : nothing}
                </div>`)}
            </div>`}

        ${this.editavel ? html`
          <div class="upload-form">
            <urbi-select
              label="Tipo de fonte"
              .valor=${this.tipoDado}
              .opcoes=${[
                { valor: 'anuncios', rotulo: 'Anúncios' },
                { valor: 'populacao', rotulo: 'População' },
                { valor: 'mercado', rotulo: 'Mercado' },
                { valor: 'outro', rotulo: 'Outro' },
              ]}
              @urbi:select-change=${(e: CustomEvent) => this.tipoDado = e.detail.valor}
            ></urbi-select>
            <urbi-seletor-arquivo
              label="Arquivo"
              texto="Selecionar arquivo"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              @urbi:seletor-arquivo-change=${this._arquivo}
            ></urbi-seletor-arquivo>
            <urbi-textarea
              label="Texto adicional"
              placeholder="Ex.: população do município/bairro"
              rows="3"
              .valor=${this.textoAdicional}
              @urbi:input-change=${(e: CustomEvent) => this.textoAdicional = e.detail.valor}
            ></urbi-textarea>
            <div class="upload-acoes">
              <urbi-botao variante="secundario" pequeno ?desabilitado=${!this.textoAdicional.trim()}
                @click=${this._anexarTexto}>Anexar texto</urbi-botao>
              <urbi-botao variante="primario" pequeno icone="fa-solid fa-robot"
                ?carregando=${this.analisando}
                ?desabilitado=${this.documentos.length === 0}
                @click=${this._analisar}>Analisar com IA</urbi-botao>
            </div>
          </div>` : nothing}
      </urbi-card>

      ${r ? this._renderResultado(r) : html`
        <urbi-card>
          <urbi-estado-vazio icone="fa-solid fa-robot" mensagem="Nenhuma análise ainda."></urbi-estado-vazio>
        </urbi-card>`}
    `;
  }

  private _renderResultado(r: any): TemplateResult {
    return html`
      <urbi-card titulo="Resultado">
        <div class="scores">
          <urbi-kpi rotulo="Score geral" .valor=${this.apelo?.score_geral ?? '—'} variante="alerta"></urbi-kpi>
          ${(r.fatores || []).map((f: any) => html`
            <urbi-kpi rotulo=${f.nome} .valor=${f.nota_consolidada ?? '—'}></urbi-kpi>`)}
        </div>

        ${(r.fatores || []).map((f: any) => html`
          <urbi-card>
            <div class="fator-head">
              <strong>${f.nome}</strong>
              <urbi-badge cor="info">${f.nota_consolidada ?? '—'}/5</urbi-badge>
            </div>
            ${(f.perguntas || []).map((p: any) => html`
              <div class="perg">
                <urbi-badge class="perg-nota" cor="info">${p.nota ?? '—'}</urbi-badge>${p.pergunta}
                <div class="sec">${p.justificativa}</div>
              </div>`)}
            ${f.justificativa_geral ? html`<p class="sec">${f.justificativa_geral}</p>` : nothing}
          </urbi-card>`)}

        ${r.relatorio ? html`
          <div class="rel">
            ${this._lista('Vantagens', r.relatorio.vantagens)}
            ${this._lista('Desvantagens', r.relatorio.desvantagens)}
            ${this._lista('Ganhos', r.relatorio.ganhos)}
            ${this._lista('Riscos', r.relatorio.riscos)}
          </div>` : nothing}
      </urbi-card>
    `;
  }

  private _lista(titulo: string, itens: string[]): TemplateResult {
    return html`
      <div>
        <strong>${titulo}</strong>
        <urbi-lista
          .itens=${itens || []}
          .render_item=${(i: unknown) => html`${i}`}
          mensagem-vazio="—"
          separador
        ></urbi-lista>
      </div>`;
  }

  private async _arquivo(e: CustomEvent) {
    const file: File | null = e.detail?.arquivo ?? (e.detail?.arquivos?.[0] ?? null);
    if (!file) return;
    try {
      const up = await uploadDocumentoApelo(file);
      if (!up?.upload_id) { urbiVerso.notificar('Falha no upload', 'erro'); return; }
      await anexarDocumentoApelo(this.estudo.id, { upload_id: up.upload_id, tipo_dado: this.tipoDado });
      urbiVerso.notificar('Documento anexado.', 'sucesso');
      this._carregar();
    } catch (err: any) { urbiVerso.notificar(err?.message || 'Erro no upload', 'erro'); }
  }

  private async _anexarTexto() {
    try {
      await anexarDocumentoApelo(this.estudo.id, { tipo_dado: this.tipoDado, texto_adicional: this.textoAdicional.trim() });
      this.textoAdicional = '';
      urbiVerso.notificar('Texto anexado.', 'sucesso');
      this._carregar();
    } catch (err: any) { urbiVerso.notificar(err?.message || 'Erro', 'erro'); }
  }

  private async _remover(docId: number) {
    try { await removerDocumentoApelo(this.estudo.id, docId); this._carregar(); }
    catch (err: any) { urbiVerso.notificar(err?.message || 'Erro', 'erro'); }
  }

  private async _analisar() {
    this.analisando = true;
    try {
      const res = await analisarApelo(this.estudo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro na análise', 'erro'); return; }
      this.apelo = res;
      urbiVerso.notificar('Análise concluída.', 'sucesso');
    } catch (err: any) { urbiVerso.notificar(err?.message || 'Erro na análise', 'erro'); }
    finally { this.analisando = false; }
  }
}

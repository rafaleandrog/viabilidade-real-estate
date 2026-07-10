import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estilosBase } from './viab-shared.js';
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

  static styles = [estilosBase, css`
    :host { display: block; }
    .doc { display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.06)); }
    .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 10px 0; }
    .score { background: var(--cor-fundo, #0D1B2A); border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 10px; }
    .score .rot { font-size: 0.68rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); text-transform: uppercase; }
    .score .val { font-size: 1.3rem; font-weight: 700; }
    .score.geral { border-color: var(--cor-cta, #F7A111); }
    .fator { border: 1px solid var(--cor-borda, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .fator h4 { margin: 0 0 8px; display: flex; justify-content: space-between; }
    .perg { font-size: 0.82rem; margin: 6px 0; }
    .perg .nota { font-weight: 700; color: var(--cor-primaria-solida, #2AA9E0); }
    .rel { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .rel ul { margin: 4px 0; padding-left: 18px; font-size: 0.84rem; }
    .upload-form { display: grid; gap: 8px; margin-top: 10px; }
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
    if (this.carregando) return html`<div class="card"><p class="sec">Carregando…</p></div>`;
    const r = this.apelo?.resultado;
    return html`
      <div class="card">
        <h3 style="margin-top:0">Apelo Comercial do Imóvel (IA)</h3>
        <p class="sec">Avaliação qualitativa em 6 fatores a partir de documentos e dados de mercado. Anexe arquivos (PDF/Word/Excel) e/ou texto e dispare a análise.</p>

        <h4>Fontes anexadas</h4>
        ${this.documentos.length === 0 ? html`<p class="sec">Nenhuma fonte anexada.</p>` : nothing}
        ${this.documentos.map((d) => html`
          <div class="doc">
            <span>${d.tipo_dado || 'fonte'} ${d.texto_adicional ? '· texto' : ''} ${d.documento ? '· arquivo' : ''}</span>
            ${this.editavel ? html`<button class="btn-perigo btn-sm" @click=${() => this._remover(d.id)}>×</button>` : nothing}
          </div>`)}

        ${this.editavel ? html`
          <div class="upload-form">
            <select .value=${this.tipoDado} @change=${(e: Event) => this.tipoDado = (e.target as HTMLSelectElement).value}>
              <option value="anuncios">Anúncios</option>
              <option value="populacao">População</option>
              <option value="mercado">Mercado</option>
              <option value="outro">Outro</option>
            </select>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" @change=${this._arquivo} />
            <textarea rows="3" placeholder="Texto adicional (ex.: população do município/bairro)"
              .value=${this.textoAdicional}
              @input=${(e: Event) => this.textoAdicional = (e.target as HTMLTextAreaElement).value}></textarea>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <button class="btn-sec btn-sm" @click=${this._anexarTexto} ?disabled=${!this.textoAdicional.trim()}>Anexar texto</button>
              <button class="btn-cta btn-sm" @click=${this._analisar} ?disabled=${this.analisando || this.documentos.length === 0}>
                ${this.analisando ? 'Analisando…' : 'Analisar com IA'}
              </button>
            </div>
          </div>` : nothing}
      </div>

      ${r ? this._renderResultado(r) : html`<div class="card" style="margin-top:16px"><p class="sec">Nenhuma análise ainda.</p></div>`}
    `;
  }

  private _renderResultado(r: any) {
    return html`
      <div class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Resultado</h3>
        <div class="scores">
          <div class="score geral"><div class="rot">Score geral</div><div class="val">${this.apelo?.score_geral ?? '—'}</div></div>
          ${(r.fatores || []).map((f: any) => html`
            <div class="score"><div class="rot">${f.nome}</div><div class="val">${f.nota_consolidada ?? '—'}</div></div>`)}
        </div>

        ${(r.fatores || []).map((f: any) => html`
          <div class="fator">
            <h4><span>${f.nome}</span><span class="nota">${f.nota_consolidada ?? '—'}/5</span></h4>
            ${(f.perguntas || []).map((p: any) => html`
              <div class="perg"><span class="nota">${p.nota ?? '—'}</span> — ${p.pergunta}<br /><span class="sec">${p.justificativa}</span></div>`)}
            ${f.justificativa_geral ? html`<p class="sec">${f.justificativa_geral}</p>` : nothing}
          </div>`)}

        ${r.relatorio ? html`
          <div class="rel">
            ${this._lista('Vantagens', r.relatorio.vantagens)}
            ${this._lista('Desvantagens', r.relatorio.desvantagens)}
            ${this._lista('Ganhos', r.relatorio.ganhos)}
            ${this._lista('Riscos', r.relatorio.riscos)}
          </div>` : nothing}
      </div>
    `;
  }

  private _lista(titulo: string, itens: string[]) {
    return html`<div><strong>${titulo}</strong><ul>${(itens || []).map((i) => html`<li>${i}</li>`)}</ul></div>`;
  }

  private async _arquivo(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
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

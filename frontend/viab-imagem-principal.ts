import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import {
  urbiVerso,
  listarDocumentosEmpreendimento, uploadDocumentoEmpreendimento,
  anexarDocumentoEmpreendimento, removerDocumentoEmpreendimento,
} from './viabilidade-api.js';

// Imagem principal (capa) do estudo — Preliminar e Avançado (S7 · #89).
//
// Componente reutilizável, hospedado tanto em Premissas (Preliminar) quanto em
// Empreendimento → Informações (Avançado). A imagem vive em `estudo_documentos`
// na categoria `imagem_principal` (mesma infra dos renders/plantas). Capa é
// ÚNICA: ao anexar uma nova, a anterior é removida.
//
// A tabela `estudo_documentos` é `restrito`, então a prévia usa a URL assinada
// (`url`) que o backend anexa a cada documento — não o download direto por sessão.

// Extraída para ser testável sem harness de DOM: decide se `updated()` deve
// recarregar, comparando o id do estudo atual contra o último carregado —
// nunca contra um booleano "já carreguei alguma vez", que ficava preso na
// capa do primeiro estudo ao navegar para outro sem reload de página.
export function precisaCarregar(estudoId: number | null | undefined, idCarregado: number | null): boolean {
  return estudoId != null && estudoId !== idCarregado;
}

@customElement('viab-imagem-principal')
export class ViabImagemPrincipal extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private doc: any = null;
  @state() private carregando = true;
  @state() private enviando = false;
  private idCarregado: number | null = null;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .previa {
      display: block; max-width: 320px; max-height: 220px; width: auto; height: auto;
      border-radius: 8px; object-fit: cover;
      border: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
    }
    p.vazio {
      margin: 0 0 8px; font-size: var(--texto-rotulo, 0.75rem);
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .acoes { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  `];

  updated() {
    if (precisaCarregar(this.estudo?.id, this.idCarregado)) {
      this.idCarregado = this.estudo.id;
      this._carregar();
    }
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const res = await listarDocumentosEmpreendimento(this.estudo.id);
      const docs: any[] = res?.dados || [];
      this.doc = docs.find((d) => d.categoria === 'imagem_principal') || null;
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar imagem', 'erro');
    }
    this.carregando = false;
  }

  render(): TemplateResult {
    if (this.carregando) {
      return html`<urbi-loading mensagem="Carregando imagem..."></urbi-loading>`;
    }
    const dis = !this.editavel;
    return html`
      ${this.doc?.url
        ? html`<img class="previa" src=${this.doc.url} alt="Imagem principal do estudo" />`
        : html`<p class="vazio">Nenhuma imagem principal definida.</p>`}
      ${!dis ? html`
        <div class="acoes">
          <urbi-seletor-arquivo
            texto=${this.doc ? 'Trocar imagem' : 'Adicionar imagem'}
            accept="image/*"
            @urbi:seletor-arquivo-change=${this._arquivo}
          ></urbi-seletor-arquivo>
          ${this.doc ? html`
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" ?carregando=${this.enviando}
              title="Remover" @click=${this._remover}></urbi-botao>` : nothing}
        </div>` : nothing}
    `;
  }

  private async _arquivo(e: CustomEvent) {
    const file: File | null = e.detail?.arquivo ?? (e.detail?.arquivos?.[0] ?? null);
    if (!file) return;
    this.enviando = true;
    try {
      const up = await uploadDocumentoEmpreendimento(file);
      if (!up?.upload_id) { urbiVerso.notificar('Falha no upload', 'erro'); return; }
      const doc = await anexarDocumentoEmpreendimento(this.estudo.id, {
        upload_id: up.upload_id, categoria: 'imagem_principal', nome_arquivo: file.name,
      });
      if (doc?.erro) { urbiVerso.notificar(doc.mensagem || 'Erro ao anexar', 'erro'); return; }
      // Capa única: remove a imagem anterior depois de anexar a nova com sucesso.
      const anterior = this.doc;
      this.doc = doc;
      if (anterior?.id) {
        try { await removerDocumentoEmpreendimento(this.estudo.id, anterior.id); } catch { /* melhor esforço */ }
      }
      urbiVerso.notificar('Imagem principal atualizada.', 'sucesso');
      this._notificarMudanca();
    } catch (err: any) {
      urbiVerso.notificar(err?.message || 'Erro no upload', 'erro');
    } finally {
      this.enviando = false;
    }
  }

  private async _remover() {
    if (!this.doc) return;
    this.enviando = true;
    try {
      const res = await removerDocumentoEmpreendimento(this.estudo.id, this.doc.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.doc = null;
      urbiVerso.notificar('Imagem removida.', 'sucesso');
      this._notificarMudanca();
    } catch (err: any) {
      urbiVerso.notificar(err?.message || 'Erro ao remover', 'erro');
    } finally {
      this.enviando = false;
    }
  }

  private _notificarMudanca() {
    this.dispatchEvent(new CustomEvent('viab:imagem-principal-change', { bubbles: true, composed: true }));
  }
}

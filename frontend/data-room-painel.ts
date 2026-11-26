import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { buscarApelo, listarDocumentosEmpreendimento } from './viabilidade-api.js';
import { precisaCarregar } from './viab-imagem-principal.js';
import {
  agruparDataRoom, categoriaIncompleta, categoriaSemTipo, CATEGORIAS_DATA_ROOM, checklistDataRoom, deveRecarregarDataRoom, respostaDaCargaVale,
  type CategoriaDataRoom, type ItemDataRoom,
} from './data-room.js';

// Data room do estudo — só LÊ os documentos já anexados (Empreendimento e Apelo
// Comercial) e os agrupa por categoria. Anexar e remover continuam nas telas de origem.

@customElement('viab-data-room')
export class ViabDataRoom extends LitElement {
  @property({ type: Object }) estudo: any = null;
  /** true quando a sub-aba Data room é a visível; a volta a ela recarrega. */
  @property({ type: Boolean }) ativa = false;

  @state() private carregando = true;
  @state() private docsEmpreendimento: any[] | null = null;
  @state() private docsApelo: any[] | null = null;
  @state() private avisos: string[] = [];
  private idCarregado: number | null = null;
  private ativaAntes = false;
  /** Contador de requisição: só a carga mais recente desta instância atualiza a tela. */
  private seqCarga = 0;
  /** true depois da primeira carga terminar (mesmo com falha): recarga não pisca o loading. */
  private cargaConcluida = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    :host { display: block; }
    .secoes { display: flex; flex-direction: column; gap: 12px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    li.doc { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .nome { color: var(--cor-texto); word-break: break-word; }
    .tipo { color: var(--cor-texto-sec); font-size: var(--texto-rotulo, 0.75rem); }
    p.vazio { margin: 0 0 8px; color: var(--cor-texto-sec); font-size: var(--texto-rotulo, 0.75rem); }
    .check { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--cor-borda); }
    .check li { color: var(--cor-texto-sec); font-size: var(--texto-rotulo, 0.75rem); }
    .check li.ok { color: var(--cor-texto); }
    /* Marca do item (presente/pendente): urbi-icone, no lugar de glifo de texto. */
    .check .marca { margin-right: 6px; }
    .acoes { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  `];

  updated() {
    const voltou = deveRecarregarDataRoom(this.ativaAntes, this.ativa, this.idCarregado != null);
    this.ativaAntes = this.ativa;
    if (precisaCarregar(this.estudo?.id, this.idCarregado)) {
      this.idCarregado = this.estudo.id;
      this.cargaConcluida = false;
      this._carregar();
    } else if (voltou && this.estudo?.id != null) {
      this._carregar();
    }
  }

  private async _carregar() {
    const id = this.estudo?.id;
    const seq = ++this.seqCarga;
    // Recarga depois de uma carga concluída mantém a lista na tela (sem piscar o loading).
    if (!this.cargaConcluida) this.carregando = true;
    const [emp, ape] = await Promise.allSettled([
      listarDocumentosEmpreendimento(id),
      buscarApelo(id),
    ]);
    // Descarta se o estudo trocou ou se uma carga mais nova do mesmo estudo já foi disparada.
    if (!respostaDaCargaVale(seq, this.seqCarga, id, this.estudo?.id)) return;
    const avisos: string[] = [];
    // O wrapper da API devolve `{ erro }` em vez de lançar: resposta com erro é falha, não lista vazia.
    if (emp.status === 'fulfilled' && !emp.value?.erro) this.docsEmpreendimento = emp.value?.dados || [];
    else { this.docsEmpreendimento = null; avisos.push('Não foi possível carregar os documentos do Empreendimento.'); }
    if (ape.status === 'fulfilled' && !ape.value?.erro) this.docsApelo = ape.value?.documentos || [];
    else { this.docsApelo = null; avisos.push('Não foi possível carregar as fontes do Apelo Comercial.'); }
    this.avisos = avisos;
    this.cargaConcluida = true;
    this.carregando = false;
  }

  private _ir(aba: string, sub?: string) {
    const nome = sub ? 'viab:subaba-topo' : 'viab:aba-topo';
    const detail = sub ? { aba, sub } : { id: aba };
    this.dispatchEvent(new CustomEvent(nome, { detail, bubbles: true, composed: true }));
  }

  private _renderItem(i: ItemDataRoom): TemplateResult {
    return html`
      <li class="doc">
        <span class="nome">${i.nome}</span>
        <span class="tipo">${i.rotuloTipo}${i.soTexto ? ' · só texto' : ''}</span>
        ${i.url
          ? html`<a href=${i.url} target="_blank" rel="noopener">Abrir</a>`
          : i.origem === 'apelo' && !i.soTexto
            ? html`<urbi-botao class="arquivo-apelo" variante="texto" pequeno @click=${() => this._ir('apelo')}>arquivo no Apelo Comercial</urbi-botao>`
            : nothing}
      </li>`;
  }

  private _renderOndeAnexar(id: CategoriaDataRoom): TemplateResult | typeof nothing {
    if (id === 'projeto') {
      return html`<div class="acoes">
        <span class="tipo">Anexe em Empreendimento › Informações</span>
        <urbi-botao variante="texto" pequeno @click=${() => this._ir('empreendimento', 'informacoes')}>Ir para Informações</urbi-botao>
      </div>`;
    }
    if (id === 'comercial') {
      return html`<div class="acoes">
        <span class="tipo">Anexe em Apelo Comercial</span>
        <urbi-botao variante="texto" pequeno @click=${() => this._ir('apelo')}>Ir para Apelo Comercial</urbi-botao>
      </div>`;
    }
    return nothing;
  }

  render(): TemplateResult {
    if (this.carregando) {
      return html`<urbi-loading mensagem="Carregando documentos..."></urbi-loading>`;
    }
    const grupos = agruparDataRoom(this.docsEmpreendimento, this.docsApelo);
    const indisponiveis = { empreendimento: this.docsEmpreendimento === null, apelo: this.docsApelo === null };
    const lista = checklistDataRoom(grupos, indisponiveis);
    return html`
      ${this.avisos.map((a) => html`<urbi-banner variante="alerta">${a}</urbi-banner>`)}
      <div class="secoes">
        ${CATEGORIAS_DATA_ROOM.map(({ id, rotulo }) => html`
          <urbi-card titulo=${rotulo} data-categoria=${id}>
            ${grupos[id].length
              ? html`<ul>${grupos[id].map((i) => this._renderItem(i))}</ul>
                ${categoriaIncompleta(id, indisponiveis)
                  ? html`<p class="vazio">Pode faltar documento: uma das fontes não carregou.</p>` : nothing}`
              : html`<p class="vazio">${categoriaSemTipo(id)
                  ? 'Ainda não há tipo de documento para esta categoria.'
                  : categoriaIncompleta(id, indisponiveis)
                    ? 'Não foi possível carregar estes documentos.'
                    : 'Nenhum documento nesta categoria.'}</p>`}
            ${lista[id].length ? html`
              <ul class="check">
                ${lista[id].map((c) => html`
                  <li class=${c.estado === 'presente' ? 'ok' : c.estado}>${c.estado === 'presente'
                    ? html`<urbi-icone class="marca" classe="fa-solid fa-check"></urbi-icone>`
                    : c.estado === 'pendente' ? html`<urbi-icone class="marca" classe="fa-regular fa-circle"></urbi-icone>` : nothing}${c.rotulo}${c.estado === 'pendente' ? ' — pendente' : c.estado === 'indisponivel' ? ' — não verificado' : ''}</li>`)}
              </ul>` : nothing}
            ${this._renderOndeAnexar(id)}
          </urbi-card>`)}
      </div>
    `;
  }
}

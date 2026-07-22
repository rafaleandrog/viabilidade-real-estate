import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import {
  urbiVerso, atualizarEstudo,
  listarDocumentosEmpreendimento, uploadDocumentoEmpreendimento,
  anexarDocumentoEmpreendimento, removerDocumentoEmpreendimento,
} from './viabilidade-api.js';
import './tela-terreno-nucleo.js';
import './viab-num.js';

// Sub-aba "Empreendimento → Informações" (nível Avançado · Lote 4 · #16).
//
// Dados de identificação do empreendimento + anexos. Matrícula e descrição são
// campos novos na tabela `estudos` (gravados via PATCH /estudos/:id). Os anexos
// (imagem principal, renders, plantas) vivem em `estudo_documentos` e usam o
// mesmo fluxo de upload do Apelo Comercial.

const CATEGORIAS: { id: string; rotulo: string; accept: string; dica: string }[] = [
  { id: 'imagem_principal', rotulo: 'Imagem principal', accept: 'image/*', dica: 'Uma imagem de capa do empreendimento.' },
  { id: 'render', rotulo: 'Renders', accept: 'image/*', dica: 'Imagens de perspectiva/render.' },
  { id: 'planta', rotulo: 'Plantas baixas', accept: 'image/*,.pdf', dica: 'Plantas em PDF ou imagem.' },
];

@customElement('viab-empreendimento-info')
export class ViabEmpreendimentoInfo extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;
  @property({ type: Boolean }) podeEditar = false;

  @state() private form: {
    nome: string; matricula: string; descricao: string;
    terreno_manual_nome: string;
    terreno_manual_area: number | null;
    coef_aproveitamento_basico: number | null;
    coef_aproveitamento_maximo: number | null;
  } = {
    nome: '', matricula: '', descricao: '',
    terreno_manual_nome: '', terreno_manual_area: null,
    coef_aproveitamento_basico: null, coef_aproveitamento_maximo: null,
  };
  @state() private documentos: any[] = [];
  @state() private carregando = true;
  @state() private salvando = false;
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .grid { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
    .campo { display: flex; flex-direction: column; gap: 4px; }
    .campo.nome urbi-input { width: 280px; }
    .campo.matricula urbi-input { width: 220px; }
    .rotulo { font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .valor-ro { font-weight: 600; font-variant-numeric: tabular-nums; padding: 8px 0; }
    .descricao { margin-top: 16px; }
    .acoes { margin-top: 14px; }
    .cat { margin-top: 8px; }
    .cat h4 { margin: 0 0 2px; font-size: var(--texto-corpo, 0.8125rem); }
    .cat p.dica { margin: 0 0 8px; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .docs { display: flex; flex-direction: column; }
    .doc { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); }
    urbi-card + urbi-card { margin-top: 16px; }
  `];

  updated() {
    if (this.estudo?.id && !this.carregado) {
      this.carregado = true;
      const e = this.estudo;
      this.form = {
        nome: e.nome || '',
        matricula: e.matricula || '',
        descricao: e.descricao || '',
        terreno_manual_nome: e.terreno_manual_nome || '',
        terreno_manual_area: e.terreno_manual_area != null ? Number(e.terreno_manual_area) : null,
        coef_aproveitamento_basico: e.coef_aproveitamento_basico != null ? Number(e.coef_aproveitamento_basico) : null,
        coef_aproveitamento_maximo: e.coef_aproveitamento_maximo != null ? Number(e.coef_aproveitamento_maximo) : null,
      };
      this._carregarDocumentos();
    }
  }

  private async _carregarDocumentos() {
    this.carregando = true;
    try {
      const res = await listarDocumentosEmpreendimento(this.estudo.id);
      if (!res?.erro) this.documentos = res.dados || [];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar anexos', 'erro');
    }
    this.carregando = false;
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    const dis = !this.editavel;
    return html`
      <urbi-card titulo="Informações do empreendimento">
        <div class="grid">
          <div class="campo nome">
            <span class="rotulo">Nome do empreendimento</span>
            <urbi-input ?desabilitado=${dis} .valor=${this.form.nome}
              @urbi:input-change=${(e: CustomEvent) => { this.form = { ...this.form, nome: e.detail.valor }; }}
            ></urbi-input>
          </div>
          <div class="campo matricula">
            <span class="rotulo">Matrícula</span>
            <urbi-input ?desabilitado=${dis} placeholder="Nº da matrícula" .valor=${this.form.matricula}
              @urbi:input-change=${(e: CustomEvent) => { this.form = { ...this.form, matricula: e.detail.valor }; }}
            ></urbi-input>
          </div>
        </div>

        <div class="descricao">
          <urbi-textarea label="Descrição" rows="4" ?desabilitado=${dis}
            placeholder="Descrição do empreendimento"
            .valor=${this.form.descricao}
            @urbi:input-change=${(e: CustomEvent) => { this.form = { ...this.form, descricao: e.detail.valor }; }}
          ></urbi-textarea>
        </div>
      </urbi-card>

      ${this._renderTerreno(dis)}

      ${!dis ? html`
        <div class="acoes">
          <urbi-botao variante="secundario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar informações</urbi-botao>
        </div>` : nothing}

      <urbi-card titulo="Anexos">
        ${this.carregando
          ? html`<urbi-loading mensagem="Carregando anexos..."></urbi-loading>`
          : CATEGORIAS.map((c) => this._renderCategoria(c, dis))}
      </urbi-card>
    `;
  }

  private _renderCategoria(cat: { id: string; rotulo: string; accept: string; dica: string }, dis: boolean): TemplateResult {
    const docs = this.documentos.filter((d) => (d.categoria || 'render') === cat.id);
    return html`
      <div class="cat">
        <h4>${cat.rotulo}</h4>
        <p class="dica">${cat.dica}</p>
        ${docs.length === 0 ? html`<p class="sec">Nenhum arquivo.</p>` : html`
          <div class="docs">
            ${docs.map((d) => html`
              <div class="doc">
                <span><strong>${d.nome_arquivo || 'arquivo'}</strong></span>
                ${!dis ? html`
                  <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
                    @click=${() => this._remover(d.id)}>Remover</urbi-botao>` : nothing}
              </div>`)}
          </div>`}
        ${!dis ? html`
          <urbi-seletor-arquivo
            texto="Adicionar arquivo"
            accept=${cat.accept}
            @urbi:seletor-arquivo-change=${(e: CustomEvent) => this._arquivo(e, cat.id)}
          ></urbi-seletor-arquivo>` : nothing}
      </div>
    `;
  }

  private _renderTerreno(dis: boolean): TemplateResult {
    const nucleo = this.estudo.origem_terreno === 'nucleo';
    const inc = this.estudo.tipo_empreendimento === 'incorporacao';
    return html`
      <urbi-card titulo="Dados do terreno">
        ${nucleo
          ? html`<viab-terreno-nucleo
              .estudo=${this.estudo}
              .editavel=${this.editavel && this.estudo.status === 'rascunho'}
            ></viab-terreno-nucleo>`
          : html`
              <div class="grid">
                <div class="campo nome">
                  <span class="rotulo">Nome do terreno</span>
                  <urbi-input ?desabilitado=${dis} .valor=${this.form.terreno_manual_nome}
                    @urbi:input-change=${(e: CustomEvent) => { this.form = { ...this.form, terreno_manual_nome: e.detail.valor }; }}
                  ></urbi-input>
                </div>
                <viab-num label="Área do terreno" sufixo="m²" ?desabilitado=${dis}
                  .valor=${this.form.terreno_manual_area}
                  @urbi:input-numero-change=${(e: CustomEvent) => { this.form = { ...this.form, terreno_manual_area: e.detail.valor }; }}
                ></viab-num>
              </div>`}
        ${inc ? html`
          <div class="grid" style="margin-top:12px">
            <viab-num label="Coeficiente mínimo" ?desabilitado=${dis}
              .valor=${this.form.coef_aproveitamento_basico}
              @urbi:input-numero-change=${(e: CustomEvent) => { this.form = { ...this.form, coef_aproveitamento_basico: e.detail.valor }; }}
            ></viab-num>
            <viab-num label="Coeficiente máximo" ?desabilitado=${dis}
              .valor=${this.form.coef_aproveitamento_maximo}
              @urbi:input-numero-change=${(e: CustomEvent) => { this.form = { ...this.form, coef_aproveitamento_maximo: e.detail.valor }; }}
            ></viab-num>
          </div>` : nothing}
      </urbi-card>
    `;
  }

  private async _salvar() {
    this.salvando = true;
    try {
      const nucleo = this.estudo.origem_terreno === 'nucleo';
      const inc = this.estudo.tipo_empreendimento === 'incorporacao';
      const dados: Record<string, any> = {
        nome: this.form.nome.trim() || this.estudo.nome,
        matricula: this.form.matricula.trim() || null,
        descricao: this.form.descricao.trim() || null,
      };
      if (!nucleo) {
        dados.terreno_manual_nome = this.form.terreno_manual_nome.trim() || null;
        dados.terreno_manual_area = this.form.terreno_manual_area != null ? Number(this.form.terreno_manual_area) : null;
      }
      if (inc) {
        dados.coef_aproveitamento_basico = this.form.coef_aproveitamento_basico != null ? Number(this.form.coef_aproveitamento_basico) : null;
        dados.coef_aproveitamento_maximo = this.form.coef_aproveitamento_maximo != null ? Number(this.form.coef_aproveitamento_maximo) : null;
      }
      const res = await atualizarEstudo(this.estudo.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      urbiVerso.notificar('Informações salvas.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvando = false;
    }
  }

  private async _arquivo(e: CustomEvent, categoria: string) {
    const file: File | null = e.detail?.arquivo ?? (e.detail?.arquivos?.[0] ?? null);
    if (!file) return;
    try {
      const up = await uploadDocumentoEmpreendimento(file);
      if (!up?.upload_id) { urbiVerso.notificar('Falha no upload', 'erro'); return; }
      const doc = await anexarDocumentoEmpreendimento(this.estudo.id, { upload_id: up.upload_id, categoria, nome_arquivo: file.name });
      if (doc?.erro) { urbiVerso.notificar(doc.mensagem || 'Erro ao anexar', 'erro'); return; }
      urbiVerso.notificar('Arquivo anexado.', 'sucesso');
      this._carregarDocumentos();
    } catch (err: any) {
      urbiVerso.notificar(err?.message || 'Erro no upload', 'erro');
    }
  }

  private async _remover(docId: number) {
    try {
      const res = await removerDocumentoEmpreendimento(this.estudo.id, docId);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.documentos = this.documentos.filter((d) => d.id !== docId);
    } catch (err: any) {
      urbiVerso.notificar(err?.message || 'Erro ao remover', 'erro');
    }
  }
}

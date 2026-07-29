import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import {
  urbiVerso, listarRegioesMercado, criarRegiaoMercado, atualizarRegiaoMercado,
  removerRegiaoMercado, listarColetasMercado,
} from './viabilidade-api.js';

// Tela de configuração das REGIÕES MONITORADAS (#200) — manifesto
// `telas_config.mercado_regioes`. Injetada pelo shell na área de config, sem
// urbi-shell-page (mesmo padrão de viabilidade-config-curvas/benchmarks).
//
// Cada região é uma região administrativa/bairro que a rotina diária
// (`rotinas.coleta_mercado_diaria`, framework de agenda) varre em busca de
// notícias e anúncios de imóveis, usando as palavras-chave daqui. O resultado
// aparece no estudo, na aba Análise de mercado.
//
// Escrita é admin-only (o backend também bloqueia).

@customElement('viabilidade-config-mercado')
export class ViabConfigMercado extends LitElement {
  @property({ type: Boolean }) somenteLeitura = false;

  @state() private regioes: any[] = [];
  @state() private carregando = true;
  @state() private editando: any = null;
  @state() private formNome = '';
  @state() private formUf = 'DF';
  @state() private formChaves = '';
  @state() private formAtiva = true;
  @state() private salvando = false;
  @state() private removerAlvo: any = null;
  @state() private coletasDe: any = null;
  @state() private coletas: any[] = [];

  static styles = [estiloConteudo, css`
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .topo h2 { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.08)); font-size: 0.85rem; }
    th { color: var(--cor-texto-sec, rgba(255,255,255,0.55)); font-weight: 600; }
    td.acoes { text-align: right; white-space: nowrap; }
    .chaves { color: var(--cor-texto-sec, rgba(255,255,255,0.6)); font-size: 0.8rem; }
    .status-ok { color: var(--cor-sucesso, #13a98d); }
    .status-alerta { color: var(--cor-alerta, #e0a82a); }
    .status-erro { color: var(--cor-erro, #d45a3a); }
    .form-linha { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 10px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .coleta { border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.08)); padding: 8px 0; }
    .coleta p { margin: 2px 0 0; font-size: 0.82rem; }
    .nota { font-size: 0.8rem; color: var(--cor-texto-sec, rgba(255,255,255,0.55)); }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const r = await listarRegioesMercado();
      this.regioes = r?.erro ? [] : (r.dados || []);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar as regiões', 'erro');
    }
    this.carregando = false;
  }

  render(): TemplateResult {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando regiões..."></urbi-loading>`;
    return html`
      <div class="topo">
        <div>
          <h2>Regiões monitoradas</h2>
          <p class="nota">
            A coleta roda <strong>uma vez por dia</strong> e usa o modelo de IA mais barato para
            triar o que encontrar. Sem uma fonte de busca configurada nos parâmetros da app
            (<code>mercado_busca_url</code>), a coleta registra "sem fonte externa" e não inventa
            conteúdo.
          </p>
        </div>
        ${!this.somenteLeitura ? html`
          <urbi-botao variante="primario" icone="fa-solid fa-plus" @click=${this._novo}>
            Adicionar região
          </urbi-botao>` : nothing}
      </div>

      ${this.regioes.length === 0
        ? html`<urbi-estado-vazio icone="fa-solid fa-location-dot"
            mensagem="Nenhuma região monitorada. Adicione as regiões administrativas ou bairros que interessam aos seus estudos."></urbi-estado-vazio>`
        : html`
          <table>
            <thead>
              <tr>
                <th>Região</th>
                <th>Palavras-chave</th>
                <th>Última coleta</th>
                ${!this.somenteLeitura ? html`<th></th>` : nothing}
              </tr>
            </thead>
            <tbody>
              ${this.regioes.map((r) => this._linha(r))}
            </tbody>
          </table>`}

      ${this.editando ? this._renderForm() : nothing}
      ${this.removerAlvo ? this._renderConfirm() : nothing}
      ${this.coletasDe ? this._renderColetas() : nothing}
    `;
  }

  private _linha(r: any): TemplateResult {
    const status = String(r.ultima_coleta_status || '');
    const classe = status === 'ok' ? 'status-ok'
      : status === 'sem_fonte_externa' || status === 'sem_ia' ? 'status-alerta'
      : status === 'erro' ? 'status-erro' : '';
    const rotulo: Record<string, string> = {
      ok: 'ok', sem_fonte_externa: 'sem fonte externa', sem_ia: 'IA indisponível', erro: 'erro',
    };
    return html`
      <tr>
        <td>
          <strong>${r.nome}</strong>${r.uf ? html`/${r.uf}` : nothing}
          ${!r.ativa ? html` <urbi-badge cor="alerta">inativa</urbi-badge>` : nothing}
        </td>
        <td class="chaves">${String(r.palavras_chave || '').trim() || '— (usa termos padrão)'}</td>
        <td>
          ${status ? html`
            <span class=${classe}>${rotulo[status] ?? status}</span>
            · ${r.ultima_coleta_itens ?? 0} item(ns)
            ${r.ultima_coleta_msg ? html`<br /><span class="nota">${r.ultima_coleta_msg}</span>` : nothing}`
            : html`<span class="nota">ainda não coletada</span>`}
        </td>
        ${!this.somenteLeitura ? html`
          <td class="acoes">
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-list" title="Ver coletas"
              @click=${() => this._verColetas(r)}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" title="Editar"
              @click=${() => this._editar(r)}></urbi-botao>
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
              @click=${() => this.removerAlvo = r}></urbi-botao>
          </td>` : nothing}
      </tr>
    `;
  }

  private _novo = () => {
    this.editando = { id: null };
    this.formNome = ''; this.formUf = 'DF'; this.formChaves = ''; this.formAtiva = true;
  };

  private _editar(r: any) {
    this.editando = r;
    this.formNome = r.nome || '';
    this.formUf = r.uf || 'DF';
    this.formChaves = r.palavras_chave || '';
    this.formAtiva = r.ativa !== false;
  }

  private _renderForm(): TemplateResult {
    const novo = !this.editando?.id;
    return html`
      <urbi-modal title=${novo ? 'Nova região' : 'Editar região'} maxWidth="560px"
        @urbi-modal:close=${() => this.editando = null}>
        <div class="form-linha">
          <urbi-input label="Nome" placeholder="Ceilândia" .valor=${this.formNome}
            @urbi:input-change=${(e: CustomEvent) => this.formNome = e.detail.valor}></urbi-input>
          <urbi-input label="UF" .valor=${this.formUf}
            @urbi:input-change=${(e: CustomEvent) => this.formUf = e.detail.valor}></urbi-input>
        </div>
        ${/* urbi-input (e não urbi-textarea): o SDK confirma `urbi:input-change`,
             mas não expõe o nome do evento do textarea, e evento errado deixaria
             o campo mudo sem erro nenhum — justo o campo de que a coleta inteira
             depende. `termosBusca` já aceita vírgula, ponto-e-vírgula ou quebra
             de linha como separador, então nada se perde. */ ''}
        <urbi-input
          label="Palavras-chave (separadas por vírgula)"
          placeholder="lançamento imobiliário, apartamento à venda, obras e infraestrutura"
          .valor=${this.formChaves}
          @urbi:input-change=${(e: CustomEvent) => this.formChaves = e.detail.valor}
        ></urbi-input>
        <p class="nota">
          Cada palavra-chave é combinada com o nome da região na busca diária. Em branco, a coleta
          usa termos padrão (lançamentos, imóveis à venda, obras e infraestrutura).
        </p>
        <urbi-checkbox label="Ativa (entra na coleta diária)" ?marcado=${this.formAtiva}
          @urbi:checkbox-change=${(e: CustomEvent) => this.formAtiva = e.detail.marcado}></urbi-checkbox>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.editando = null}>Cancelar</urbi-botao>
          <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _salvar = async () => {
    const nome = this.formNome.trim();
    if (!nome) { urbiVerso.notificar('Informe o nome da região.', 'erro'); return; }
    this.salvando = true;
    try {
      const dados = {
        nome, uf: this.formUf.trim().toUpperCase().slice(0, 2),
        palavras_chave: this.formChaves, ativa: this.formAtiva,
      };
      const r = this.editando?.id
        ? await atualizarRegiaoMercado(this.editando.id, dados)
        : await criarRegiaoMercado(dados);
      if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.editando = null;
      await this._carregar();
      urbiVerso.notificar('Região salva.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvando = false;
    }
  };

  private _renderConfirm(): TemplateResult {
    return html`
      <urbi-modal title="Remover região" maxWidth="380px" @urbi-modal:close=${() => this.removerAlvo = null}>
        <p>Remover <strong>${this.removerAlvo.nome}</strong> e todas as coletas dela?</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.removerAlvo = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemover}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmarRemover = async () => {
    const alvo = this.removerAlvo;
    this.removerAlvo = null;
    if (!alvo) return;
    try {
      const r = await removerRegiaoMercado(alvo.id);
      if (r?.erro) { urbiVerso.notificar(r.mensagem || 'Erro ao remover', 'erro'); return; }
      await this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };

  private async _verColetas(r: any) {
    this.coletasDe = r;
    this.coletas = [];
    try {
      const res = await listarColetasMercado(r.id);
      this.coletas = res?.erro ? [] : (res.dados || []);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar as coletas', 'erro');
    }
  }

  private _renderColetas(): TemplateResult {
    return html`
      <urbi-modal title=${`Coletas — ${this.coletasDe.nome}`} maxWidth="720px"
        @urbi-modal:close=${() => this.coletasDe = null}>
        ${this.coletas.length === 0
          ? html`<urbi-estado-vazio icone="fa-solid fa-inbox"
              mensagem="Nenhuma coleta registrada para esta região ainda."></urbi-estado-vazio>`
          : this.coletas.map((c) => html`
            <div class="coleta">
              <urbi-badge cor=${c.tipo === 'anuncio' ? 'sucesso' : 'info'}>
                ${c.tipo === 'anuncio' ? 'Anúncio' : 'Notícia'}
              </urbi-badge>
              ${c.url
                ? html`<a href=${c.url} target="_blank" rel="noopener noreferrer">${c.titulo}</a>`
                : html`<strong>${c.titulo}</strong>`}
              <p>${c.resumo}</p>
              <p class="nota">${[c.fonte, c.publicado_em, c.data_coleta].filter(Boolean).join(' · ')}</p>
            </div>`)}
      </urbi-modal>
    `;
  }
}

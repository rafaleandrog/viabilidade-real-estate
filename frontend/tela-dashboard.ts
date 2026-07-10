import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { estilosBase, STATUS_LABEL, TIPO_LABEL, formatarData } from './viab-shared.js';
import {
  urbiVerso, listarEstudos, criarEstudo, duplicarEstudo, removerEstudo,
} from './viabilidade-api.js';

@customElement('viab-tela-dashboard')
export class ViabTelaDashboard extends LitElement {
  @property({ type: String }) aba: 'estudos' | 'terrenos' = 'estudos';

  @state() private estudos: any[] = [];
  @state() private carregando = true;
  @state() private filtroTipo = '';
  @state() private filtroStatus = '';
  @state() private mostrarForm = false;
  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  @state() private formErro = '';

  static styles = [estilosBase, css`
    .topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .abas { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .aba {
      padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.9rem; cursor: pointer;
    }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-bottom-color: var(--cor-primaria-solida, #2AA9E0); }
    .filtros { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .acoes-linha { display: flex; gap: 6px; }
    :host { padding: 24px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('aba') && this.aba === 'estudos') this._carregar();
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const res = await listarEstudos({
        tipo_empreendimento: this.filtroTipo || undefined,
        status: this.filtroStatus || undefined,
      });
      this.estudos = res?.dados || [];
    } catch (e) {
      console.error('Erro ao listar estudos:', e);
    }
    this.carregando = false;
  }

  render() {
    return html`
      <div class="topo">
        <h1>Estudos de Viabilidade</h1>
        ${this.aba === 'estudos'
          ? html`<button class="btn-cta" @click=${this._abrirForm}>+ Criar estudo</button>`
          : nothing}
      </div>

      <div class="abas">
        <button class="aba ${this.aba === 'estudos' ? 'ativa' : ''}" @click=${() => urbiVerso.navegarSub('/')}>Estudos</button>
        <button class="aba ${this.aba === 'terrenos' ? 'ativa' : ''}" @click=${() => urbiVerso.navegarSub('/terrenos')}>Terrenos</button>
      </div>

      ${this.aba === 'estudos' ? this._renderEstudos() : this._renderTerrenos()}
      ${this.mostrarForm ? this._renderForm() : nothing}
    `;
  }

  private _renderEstudos() {
    return html`
      <div class="filtros">
        <select .value=${this.filtroTipo} @change=${(e: Event) => { this.filtroTipo = (e.target as HTMLSelectElement).value; this._carregar(); }}>
          <option value="">Todos os tipos</option>
          <option value="loteamento">Loteamento</option>
          <option value="incorporacao">Incorporação</option>
        </select>
        <select .value=${this.filtroStatus} @change=${(e: Event) => { this.filtroStatus = (e.target as HTMLSelectElement).value; this._carregar(); }}>
          <option value="">Todos os status</option>
          ${Object.entries(STATUS_LABEL).map(([v, l]) => html`<option value=${v}>${l}</option>`)}
        </select>
      </div>

      ${this.carregando
        ? html`<div class="vazio">Carregando…</div>`
        : this.estudos.length === 0
          ? html`<div class="vazio">Nenhum estudo ainda. Clique em “Criar estudo”.</div>`
          : html`
            <div class="card" style="padding:0; overflow-x:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Estudo</th><th>Tipo</th><th>Status</th><th>Criado em</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  ${this.estudos.map((e) => html`
                    <tr @click=${() => urbiVerso.navegarSub(`/detalhe/${e.id}`)}>
                      <td>${e.nome_exibicao || e.nome}</td>
                      <td>${TIPO_LABEL[e.tipo_empreendimento] || e.tipo_empreendimento}</td>
                      <td><span class="badge ${e.status}">${STATUS_LABEL[e.status] || e.status}</span></td>
                      <td class="sec">${formatarData(e.criado_em)}</td>
                      <td>
                        <div class="acoes-linha" @click=${(ev: Event) => ev.stopPropagation()}>
                          <button class="btn-sec btn-sm" @click=${() => this._duplicar(e.id)}>Duplicar</button>
                          <button class="btn-perigo btn-sm" @click=${() => this._remover(e)}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          `}
    `;
  }

  private _renderTerrenos() {
    return html`
      <div class="card">
        <h3 style="margin-top:0">Terrenos (via Núcleo)</h3>
        <p class="sec">
          A integração com o Núcleo (glebas/lotes) ainda não está disponível nesta instância.
          Enquanto isso, cadastre o terreno diretamente no estudo pelo modo <strong>“Inserir novo”</strong> na criação.
        </p>
      </div>
    `;
  }

  private _abrirForm = () => {
    this.form = {
      nome: '', tipo_empreendimento: 'loteamento', nivel_analise: 'preliminar',
      origem_terreno: 'manual', uf: '',
    };
    this.formErro = '';
    this.mostrarForm = true;
  };

  private _renderForm() {
    return html`
      <div class="modal-backdrop" @click=${(e: Event) => { if (e.target === e.currentTarget) this.mostrarForm = false; }}>
        <div class="modal">
          <h3>Novo estudo</h3>

          <div class="campo">
            <label>Nome do estudo *</label>
            <input type="text" placeholder="Ex: Pátio Urbitá 1"
              .value=${this.form.nome || ''}
              @input=${(e: Event) => this.form = { ...this.form, nome: (e.target as HTMLInputElement).value }} />
          </div>

          <div class="campo">
            <label>Tipo de empreendimento *</label>
            <select .value=${this.form.tipo_empreendimento}
              @change=${(e: Event) => this.form = { ...this.form, tipo_empreendimento: (e.target as HTMLSelectElement).value }}>
              <option value="loteamento">Loteamento</option>
              <option value="incorporacao">Incorporação</option>
            </select>
          </div>

          <div class="campo">
            <label>Nível de análise</label>
            <select .value=${this.form.nivel_analise}
              @change=${(e: Event) => this.form = { ...this.form, nivel_analise: (e.target as HTMLSelectElement).value }}>
              <option value="preliminar">Estudo Preliminar</option>
              <option value="avancado" disabled>Projeto Avançado (v2 — indisponível)</option>
            </select>
          </div>

          <div class="campo">
            <label>Origem do terreno</label>
            <select .value=${this.form.origem_terreno}
              @change=${(e: Event) => this.form = { ...this.form, origem_terreno: (e.target as HTMLSelectElement).value }}>
              <option value="manual">Inserir novo (manual)</option>
              <option value="nucleo">Buscar terreno (Núcleo)</option>
            </select>
          </div>

          <div class="campo">
            <label>UF</label>
            <input type="text" maxlength="2" placeholder="DF" style="max-width:80px; text-transform:uppercase"
              .value=${this.form.uf || ''}
              @input=${(e: Event) => this.form = { ...this.form, uf: (e.target as HTMLInputElement).value.toUpperCase() }} />
          </div>

          ${this.formErro ? html`<div class="erro">${this.formErro}</div>` : nothing}

          <div class="acoes">
            <button class="btn-sec" @click=${() => this.mostrarForm = false}>Cancelar</button>
            <button class="btn-cta" ?disabled=${this.salvando} @click=${this._salvar}>
              ${this.salvando ? 'Criando…' : 'Criar estudo'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _salvar = async () => {
    if (!this.form.nome?.trim()) { this.formErro = 'Informe o nome do estudo.'; return; }
    this.salvando = true;
    this.formErro = '';
    try {
      const res = await criarEstudo({
        nome: this.form.nome.trim(),
        tipo_empreendimento: this.form.tipo_empreendimento,
        nivel_analise: this.form.nivel_analise,
        origem_terreno: this.form.origem_terreno,
        uf: this.form.uf || null,
      });
      if (res?.erro) { this.formErro = res.mensagem || 'Erro ao criar estudo'; return; }
      this.mostrarForm = false;
      urbiVerso.notificar('Estudo criado (rascunho).', 'sucesso');
      if (res?.id) urbiVerso.navegarSub(`/detalhe/${res.id}`);
    } catch (e: any) {
      this.formErro = e?.message || 'Erro ao criar estudo';
    } finally {
      this.salvando = false;
    }
  };

  private async _duplicar(id: number) {
    try {
      const res = await duplicarEstudo(id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao duplicar', 'erro'); return; }
      urbiVerso.notificar('Estudo duplicado.', 'sucesso');
      if (res?.id) urbiVerso.navegarSub(`/detalhe/${res.id}`);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao duplicar', 'erro');
    }
  }

  private async _remover(estudo: any) {
    if (!confirm(`Remover o estudo "${estudo.nome_exibicao || estudo.nome}"?`)) return;
    try {
      const res = await removerEstudo(estudo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      urbiVerso.notificar('Estudo removido.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  }
}

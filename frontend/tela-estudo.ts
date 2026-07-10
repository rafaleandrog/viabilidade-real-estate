import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estilosBase, STATUS_LABEL, TIPO_LABEL } from './viab-shared.js';
import './tela-premissas.js';
import {
  urbiVerso, buscarEstudo, transicaoStatus,
  listarMembros, adicionarMembro, alterarFuncaoMembro, removerMembro, listarUsuarios,
} from './viabilidade-api.js';

type Aba = 'premissas' | 'proforma' | 'graficos';
const FUNCOES = ['leitor', 'editor', 'aprovador'];

@customElement('viab-tela-estudo')
export class ViabTelaEstudo extends LitElement {
  @property({ type: Number }) estudoId = 0;

  @state() private estudo: any = null;
  @state() private carregando = true;
  @state() private aba: Aba = 'premissas';
  @state() private membros: any[] = [];
  @state() private usuarios: any[] = [];
  @state() private mostrarMembros = false;

  static styles = [estilosBase, css`
    :host { padding: 24px; }
    .voltar { background: none; border: none; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); cursor: pointer; padding: 0; margin-bottom: 12px; }
    .cabecalho { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .cabecalho h1 { margin: 0; font-size: 1.4rem; }
    .meta { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
    .acoes-status { display: flex; gap: 8px; flex-wrap: wrap; }
    .abas { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08)); }
    .aba { padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent;
           color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.9rem; cursor: pointer; }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-bottom-color: var(--cor-primaria-solida, #2AA9E0); }
    .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
    .membros-lista { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .membro { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
    .placeholder { padding: 40px; text-align: center; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('estudoId')) this._carregar();
  }

  private async _carregar() {
    if (!this.estudoId) return;
    this.carregando = true;
    try {
      const estudo = await buscarEstudo(this.estudoId);
      if (estudo?.erro) { urbiVerso.notificar(estudo.mensagem || 'Sem acesso', 'erro'); this.estudo = null; }
      else {
        this.estudo = estudo;
        this.membros = estudo.membros || [];
      }
    } catch (e) {
      console.error('Erro ao carregar estudo:', e);
    }
    this.carregando = false;
  }

  render() {
    if (this.carregando) return html`<div class="placeholder">Carregando…</div>`;
    if (!this.estudo) return html`
      <button class="voltar" @click=${() => urbiVerso.navegarSub('/')}>← Voltar</button>
      <div class="placeholder">Estudo não encontrado ou sem acesso.</div>`;

    const p = this.estudo._permissao || {};
    const st = this.estudo.status;
    return html`
      <button class="voltar" @click=${() => urbiVerso.navegarSub('/')}>← Voltar aos estudos</button>
      <div class="cabecalho">
        <div>
          <h1>${this.estudo.nome_exibicao || this.estudo.nome}</h1>
          <div class="meta">
            <span class="badge ${st}">${STATUS_LABEL[st] || st}</span>
            <span class="sec">${TIPO_LABEL[this.estudo.tipo_empreendimento] || this.estudo.tipo_empreendimento}</span>
            ${p.funcao ? html`<span class="sec">· sua função: ${p.funcao}</span>` : nothing}
          </div>
        </div>
        <div class="acoes-status">${this._renderAcoesStatus(p, st)}</div>
      </div>

      <div class="abas">
        ${(['premissas', 'proforma', 'graficos'] as Aba[]).map((a) => html`
          <button class="aba ${this.aba === a ? 'ativa' : ''}" @click=${() => this.aba = a}>
            ${a === 'premissas' ? 'Premissas' : a === 'proforma' ? 'Proforma' : 'Gráficos'}
          </button>
        `)}
      </div>

      ${this.aba === 'premissas' ? this._renderPremissas(p) : nothing}
      ${this.aba === 'proforma' ? html`<div class="placeholder">Proforma — cálculos e sensibilidade chegam na Etapa 5/6.</div>` : nothing}
      ${this.aba === 'graficos' ? html`<div class="placeholder">Gráficos — visualizações chegam na Etapa 6.</div>` : nothing}
    `;
  }

  private _renderAcoesStatus(p: any, st: string) {
    const botoes = [];
    if (p.podeEditar && st === 'rascunho') {
      botoes.push(html`<button class="btn-primario btn-sm" @click=${() => this._status('em_analise')}>Submeter para análise</button>`);
    }
    if (p.podeAprovar && st === 'em_analise') {
      botoes.push(html`<button class="btn-primario btn-sm" @click=${() => this._status('aprovado')}>Aprovar</button>`);
      botoes.push(html`<button class="btn-perigo btn-sm" @click=${() => this._status('reprovado')}>Reprovar</button>`);
      botoes.push(html`<button class="btn-sec btn-sm" @click=${() => this._status('rascunho')}>Devolver ao rascunho</button>`);
    }
    if (p.podeAprovar && st === 'arquivado') {
      botoes.push(html`<button class="btn-sec btn-sm" @click=${() => this._status('rascunho')}>Reabrir</button>`);
    }
    botoes.push(html`<button class="btn-sec btn-sm" @click=${() => { this.mostrarMembros = !this.mostrarMembros; if (this.mostrarMembros) this._carregarUsuarios(); }}>Membros</button>`);
    return botoes;
  }

  private _renderPremissas(p: any) {
    const editavel = p.podeEditar && this.estudo.status !== 'aprovado' && this.estudo.status !== 'reprovado';
    return html`
      ${this.mostrarMembros ? this._renderMembros(p) : nothing}
      <viab-tela-premissas .estudo=${this.estudo} .editavel=${editavel}></viab-tela-premissas>
    `;
  }

  private _renderMembros(p: any) {
    const podeGerir = p.podeEditar;
    return html`
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-top:0">Membros do estudo</h3>
        <div class="membros-lista">
          ${this.membros.length === 0 ? html`<span class="sec">Nenhum membro.</span>` : nothing}
          ${this.membros.map((m) => html`
            <div class="membro">
              <span>${m.usuario_nome || `Usuário ${m.usuario_id}`}</span>
              <div style="display:flex; gap:6px; align-items:center">
                ${podeGerir ? html`
                  <select .value=${m.funcao} @change=${(e: Event) => this._alterarFuncao(m.usuario_id, (e.target as HTMLSelectElement).value)}>
                    ${FUNCOES.map((f) => html`<option value=${f} ?selected=${f === m.funcao}>${f}</option>`)}
                  </select>
                  <button class="btn-perigo btn-sm" @click=${() => this._removerMembro(m.usuario_id)}>Remover</button>
                ` : html`<span class="badge rascunho">${m.funcao}</span>`}
              </div>
            </div>
          `)}
        </div>
        ${podeGerir ? html`
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
            <select id="sel-usuario">
              <option value="">Selecionar usuário…</option>
              ${this.usuarios.map((u) => html`<option value=${u.id}>${u.nome}</option>`)}
            </select>
            <select id="sel-funcao">
              ${FUNCOES.map((f) => html`<option value=${f}>${f}</option>`)}
            </select>
            <button class="btn-sec btn-sm" @click=${this._adicionarMembro}>Adicionar</button>
          </div>` : nothing}
      </div>
    `;
  }

  private async _carregarUsuarios() {
    if (this.usuarios.length > 0) return;
    try { this.usuarios = await listarUsuarios(); } catch (e) { console.error(e); }
  }

  private async _status(novo: string) {
    const labels: Record<string, string> = { aprovado: 'aprovar', reprovado: 'reprovar', rascunho: 'devolver ao rascunho', em_analise: 'submeter' };
    if ((novo === 'aprovado' || novo === 'reprovado') && !confirm(`Confirma ${labels[novo]} este estudo?`)) return;
    try {
      const res = await transicaoStatus(this.estudoId, novo);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Transição não permitida', 'erro'); return; }
      urbiVerso.notificar(`Status alterado para ${STATUS_LABEL[novo] || novo}.`, 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro na transição', 'erro');
    }
  }

  private async _adicionarMembro() {
    const selU = this.renderRoot.querySelector('#sel-usuario') as HTMLSelectElement | null;
    const selF = this.renderRoot.querySelector('#sel-funcao') as HTMLSelectElement | null;
    const usuarioId = parseInt(selU?.value || '');
    const funcao = selF?.value || 'leitor';
    if (!usuarioId) { urbiVerso.notificar('Selecione um usuário.', 'alerta'); return; }
    try {
      const res = await adicionarMembro(this.estudoId, usuarioId, funcao);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this.membros = (await listarMembros(this.estudoId))?.dados || this.membros;
      urbiVerso.notificar('Membro adicionado.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro', 'erro');
    }
  }

  private async _alterarFuncao(usuarioId: number, funcao: string) {
    try {
      const res = await alterarFuncaoMembro(this.estudoId, usuarioId, funcao);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this.membros = (await listarMembros(this.estudoId))?.dados || this.membros;
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro', 'erro');
    }
  }

  private async _removerMembro(usuarioId: number) {
    try {
      const res = await removerMembro(this.estudoId, usuarioId);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this.membros = (await listarMembros(this.estudoId))?.dados || this.membros;
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro', 'erro');
    }
  }
}

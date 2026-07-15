import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { STATUS_LABEL, TIPO_LABEL, COR_STATUS } from './viab-shared.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import './tela-premissas.js';
import './tela-proforma.js';
import './tela-graficos.js';
import './tela-apelo.js';
import {
  urbiVerso, buscarEstudo, transicaoStatus,
  listarMembros, adicionarMembro, alterarFuncaoMembro, removerMembro, listarUsuarios,
} from './viabilidade-api.js';

type Aba = 'premissas' | 'proforma' | 'graficos' | 'apelo';
const FUNCOES = [
  { valor: 'leitor', rotulo: 'Leitor' },
  { valor: 'editor', rotulo: 'Editor' },
  { valor: 'aprovador', rotulo: 'Aprovador' },
];

@customElement('viab-tela-estudo')
export class ViabTelaEstudo extends LitElement {
  @property({ type: Number }) estudoId = 0;

  @state() private estudo: any = null;
  @state() private carregando = true;
  @state() private aba: Aba = 'premissas';
  @state() private membros: any[] = [];
  @state() private usuarios: any[] = [];
  @state() private mostrarMembros = false;
  @state() private novoMembroUsuario = '';
  @state() private novoMembroFuncao = 'leitor';
  @state() private confirmarStatus: { novo: string; label: string } | null = null;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .membros-lista { display: flex; flex-direction: column; gap: 8px; }
    .membro { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .membro-acoes { display: flex; gap: 8px; align-items: center; }
    .add-membro { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-top: 16px; }
    .add-membro urbi-select { min-width: 180px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  `];

  private readonly _abas = [
    { id: 'premissas', label: 'Premissas', icone: 'fa-solid fa-sliders' },
    { id: 'proforma', label: 'Proforma', icone: 'fa-solid fa-table-cells' },
    { id: 'graficos', label: 'Gráficos', icone: 'fa-solid fa-chart-pie' },
    { id: 'apelo', label: 'Apelo Comercial', icone: 'fa-solid fa-bullhorn' },
  ];

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
    if (this.carregando) {
      return html`<urbi-shell-page><urbi-loading mensagem="Carregando estudo..."></urbi-loading></urbi-shell-page>`;
    }
    if (!this.estudo) {
      return html`
        <urbi-shell-page titulo="Estudo">
          <urbi-botao-voltar slot="voltar" rotulo="Voltar aos estudos"
            @urbi:voltar=${() => urbiVerso.navegarSub('/')}></urbi-botao-voltar>
          <urbi-estado-vazio icone="fa-solid fa-file-circle-xmark"
            mensagem="Estudo não encontrado ou sem acesso."></urbi-estado-vazio>
        </urbi-shell-page>`;
    }

    const p = this.estudo._permissao || {};
    const st = this.estudo.status;
    return html`
      <urbi-shell-page dashboard .titulo=${this.estudo.nome_exibicao || this.estudo.nome}
        @viab:terreno-alterado=${() => this._carregar()}>
        <urbi-botao-voltar slot="voltar" rotulo="Voltar aos estudos"
          @urbi:voltar=${() => urbiVerso.navegarSub('/')}></urbi-botao-voltar>
        ${this._renderAcoesStatus(p, st)}

        <div class="meta">
          <urbi-badge cor=${COR_STATUS[st] ?? 'padrao'}>${STATUS_LABEL[st] || st}</urbi-badge>
          <span class="sec">${TIPO_LABEL[this.estudo.tipo_empreendimento] || this.estudo.tipo_empreendimento}</span>
          ${p.funcao ? html`<span class="sec">· sua função: ${p.funcao}</span>` : nothing}
        </div>

        <urbi-abas
          expandir
          .abas=${this._abas}
          .ativa=${this.aba}
          @urbi:aba-selecionar=${(e: CustomEvent) => { this.aba = (e.detail?.id || 'premissas') as Aba; }}
        >
          <urbi-hospedeiro slot="premissas">
            <viab-tela-premissas .estudo=${this.estudo}
              .editavel=${p.podeEditar && st !== 'aprovado' && st !== 'reprovado'}></viab-tela-premissas>
          </urbi-hospedeiro>
          <urbi-hospedeiro slot="proforma">
            <viab-tela-proforma .estudo=${this.estudo}></viab-tela-proforma>
          </urbi-hospedeiro>
          <urbi-hospedeiro slot="graficos">
            <viab-tela-graficos .estudo=${this.estudo}></viab-tela-graficos>
          </urbi-hospedeiro>
          <urbi-hospedeiro slot="apelo">
            <viab-tela-apelo .estudo=${this.estudo} .editavel=${p.podeEditar}></viab-tela-apelo>
          </urbi-hospedeiro>
        </urbi-abas>
      </urbi-shell-page>

      ${this.mostrarMembros ? this._renderMembros(p) : nothing}
      ${this.confirmarStatus ? this._renderConfirmStatus() : nothing}
    `;
  }

  private _renderAcoesStatus(p: any, st: string): TemplateResult {
    return html`
      <div slot="actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        ${p.podeEditar && st === 'rascunho'
          ? html`<urbi-botao pequeno variante="primario" @click=${() => this._status('em_analise')}>Submeter para análise</urbi-botao>`
          : nothing}
        ${p.podeAprovar && st === 'em_analise'
          ? html`
              <urbi-botao pequeno variante="sucesso" @click=${() => this._pedirConfirmacao('aprovado', 'aprovar')}>Aprovar</urbi-botao>
              <urbi-botao pequeno variante="perigo" @click=${() => this._pedirConfirmacao('reprovado', 'reprovar')}>Reprovar</urbi-botao>
              <urbi-botao pequeno variante="fantasma" @click=${() => this._status('rascunho')}>Devolver ao rascunho</urbi-botao>`
          : nothing}
        ${p.podeAprovar && st === 'arquivado'
          ? html`<urbi-botao pequeno variante="secundario" @click=${() => this._status('rascunho')}>Reabrir</urbi-botao>`
          : nothing}
        <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-users"
          @click=${() => { this.mostrarMembros = true; this._carregarUsuarios(); }}>Membros</urbi-botao>
      </div>
    `;
  }

  private _renderMembros(p: any): TemplateResult {
    const podeGerir = p.podeEditar;
    return html`
      <urbi-modal title="Membros do estudo" @urbi-modal:close=${() => this.mostrarMembros = false}>
        <div class="membros-lista">
          ${this.membros.length === 0 ? html`<span class="sec">Nenhum membro.</span>` : nothing}
          ${this.membros.map((m) => html`
            <div class="membro">
              <span>${m.usuario_nome || `Usuário ${m.usuario_id}`}</span>
              <div class="membro-acoes">
                ${podeGerir ? html`
                  <urbi-select
                    .valor=${m.funcao}
                    .opcoes=${FUNCOES}
                    @urbi:select-change=${(e: CustomEvent) => this._alterarFuncao(m.usuario_id, e.detail.valor)}
                  ></urbi-select>
                  <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
                    @click=${() => this._removerMembro(m.usuario_id)}>Remover</urbi-botao>
                ` : html`<urbi-badge cor="padrao">${m.funcao}</urbi-badge>`}
              </div>
            </div>
          `)}
        </div>
        ${podeGerir ? html`
          <div class="add-membro">
            <urbi-select
              label="Usuário"
              placeholder="Selecionar usuário…"
              .valor=${this.novoMembroUsuario}
              .opcoes=${this.usuarios.map((u) => ({ valor: String(u.id), rotulo: u.nome }))}
              pesquisavel
              @urbi:select-change=${(e: CustomEvent) => this.novoMembroUsuario = e.detail.valor}
            ></urbi-select>
            <urbi-select
              label="Função"
              .valor=${this.novoMembroFuncao}
              .opcoes=${FUNCOES}
              @urbi:select-change=${(e: CustomEvent) => this.novoMembroFuncao = e.detail.valor}
            ></urbi-select>
            <urbi-botao variante="primario" icone="fa-solid fa-plus" @click=${this._adicionarMembro}>Adicionar</urbi-botao>
          </div>` : nothing}
      </urbi-modal>
    `;
  }

  private _renderConfirmStatus(): TemplateResult {
    const c = this.confirmarStatus!;
    return html`
      <urbi-modal title="Confirmar" maxWidth="420px" @urbi-modal:close=${() => this.confirmarStatus = null}>
        <p>Confirma <strong>${c.label}</strong> este estudo?</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.confirmarStatus = null}>Cancelar</urbi-botao>
          <urbi-botao variante=${c.novo === 'reprovado' ? 'perigo' : 'sucesso'}
            @click=${() => { const n = c.novo; this.confirmarStatus = null; this._status(n); }}>Confirmar</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _pedirConfirmacao(novo: string, label: string) {
    this.confirmarStatus = { novo, label };
  }

  private async _carregarUsuarios() {
    if (this.usuarios.length > 0) return;
    try { this.usuarios = await listarUsuarios(); } catch (e) { console.error(e); }
  }

  private async _status(novo: string) {
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
    const usuarioId = parseInt(this.novoMembroUsuario || '');
    if (!usuarioId) { urbiVerso.notificar('Selecione um usuário.', 'alerta'); return; }
    try {
      const res = await adicionarMembro(this.estudoId, usuarioId, this.novoMembroFuncao);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this.membros = (await listarMembros(this.estudoId))?.dados || this.membros;
      this.novoMembroUsuario = '';
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

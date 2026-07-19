import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import {
  urbiVerso, listarCurvas, criarCurva, atualizarCurva, removerCurva, semearCurvas,
} from './viabilidade-api.js';
import './viab-num.js';

// Tela de configuração das Curvas de Distribuição (manifesto telas_config.curvas).
// Injetada pelo shell na área de config: NÃO renderiza urbi-shell-page (padrão
// da viabilidade-config-benchmarks). Curvas são GLOBAIS da instância e usadas
// pelas linhas de custo do estudo Avançado. Escrita é admin-only (o backend
// também bloqueia); a "Curva S" padrão nunca pode ser excluída.

@customElement('viabilidade-config-curvas')
export class ViabConfigCurvas extends LitElement {
  @property({ type: Boolean }) somenteLeitura = false;

  @state() private curvas: any[] = [];
  @state() private carregando = true;
  @state() private editando: any = null;   // curva em edição (null = fechado)
  @state() private formNome = '';
  @state() private formValores: { mes: number; pct: number }[] = [];
  @state() private formErro = '';
  @state() private salvando = false;
  @state() private removerAlvo: any = null;

  static styles = [estiloConteudo, css`
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .topo h2 { margin: 0; }
    .topo .acoes { display: flex; gap: 8px; }
    table.curva { width: 100%; border-collapse: collapse; }
    table.curva th, table.curva td {
      padding: 5px 8px; text-align: left; font-size: var(--texto-corpo, 0.8125rem);
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
    }
    table.curva viab-num { width: 120px; }
    .soma { margin-top: 8px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .soma.invalida { color: var(--cor-erro, #d45a3a); }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
    .valores-scroll { max-height: 340px; overflow-y: auto; }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const res = await listarCurvas();
      this.curvas = res?.dados || [];
    } catch (e) { console.error(e); }
    this.carregando = false;
  }

  render() {
    return html`
      <div class="topo">
        <div>
          <h2>Curvas de distribuição</h2>
          <p class="sec">Curvas reutilizáveis para distribuir custos no tempo (estudo Avançado). A soma de cada curva deve ser 100%.</p>
        </div>
        ${!this.somenteLeitura ? html`
          <div class="acoes">
            <urbi-botao variante="secundario" pequeno @click=${this._semear}>Criar Curva S padrão</urbi-botao>
            <urbi-botao variante="primario" pequeno icone="fa-solid fa-plus" @click=${() => this._abrirForm(null)}>Nova Curva</urbi-botao>
          </div>` : nothing}
      </div>

      <urbi-tabela
        expandir
        .colunas=${this._colunas()}
        .linhas=${this.curvas}
        ?carregando=${this.carregando}
        mensagem-vazio="Nenhuma curva ainda — a Curva S padrão é criada no primeiro uso."
      ></urbi-tabela>

      ${this.editando !== null ? this._renderForm() : nothing}
      ${this.removerAlvo ? this._renderConfirmRemover() : nothing}
    `;
  }

  private _colunas() {
    return [
      { id: 'nome', label: 'Curva', valor: (c: any) => c.nome },
      {
        id: 'padrao', label: '',
        render: (c: any) => c.is_padrao ? html`<urbi-badge cor="info">Padrão</urbi-badge>` : html``,
      },
      { id: 'meses', label: 'Meses', alinhamento: 'direita', valor: (c: any) => String((c.valores || []).length) },
      {
        id: 'acoes', label: '',
        render: (c: any) => this.somenteLeitura ? html`` : html`
          <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" @click=${() => this._abrirForm(c)}>Editar</urbi-botao>
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" ?desabilitado=${Boolean(c.is_padrao)}
            title=${c.is_padrao ? 'A Curva S padrão não pode ser excluída' : ''}
            @click=${() => { if (!c.is_padrao) this.removerAlvo = c; }}>Excluir</urbi-botao>`,
      },
    ];
  }

  private _abrirForm(curva: any) {
    this.editando = curva ?? { id: 0 };
    this.formNome = curva?.nome || '';
    this.formValores = (curva?.valores || [{ mes: 1, pct: 0 }]).map((v: any) => ({
      mes: Number(v.mes), pct: Number(v.pct) || 0,
    }));
    this.formErro = '';
  }

  private get _soma(): number {
    return this.formValores.reduce((s, v) => s + (Number(v.pct) || 0), 0);
  }

  private _renderForm(): TemplateResult {
    const soma = this._soma;
    const somaOk = Math.abs(soma - 100) <= 0.01;
    const nova = !this.editando?.id;
    return html`
      <urbi-modal title=${nova ? 'Nova curva' : 'Editar curva'} maxWidth="480px"
        @urbi-modal:close=${() => this.editando = null}>
        <urbi-input label="Nome da curva" obrigatorio placeholder="Ex.: Linear 24m"
          .valor=${this.formNome}
          @urbi:input-change=${(e: CustomEvent) => this.formNome = e.detail.valor}
        ></urbi-input>

        <div class="valores-scroll">
          <table class="curva">
            <thead><tr><th>Mês</th><th>% do total</th><th></th></tr></thead>
            <tbody>
              ${this.formValores.map((v, i) => html`
                <tr>
                  <td>${v.mes}</td>
                  <td>
                    <viab-num sufixo="%" .valor=${v.pct || null}
                      @urbi:input-numero-change=${(e: CustomEvent) => {
                        this.formValores = this.formValores.map((x, j) =>
                          j === i ? { ...x, pct: e.detail.valor ?? 0 } : x);
                      }}
                    ></viab-num>
                  </td>
                  <td>
                    <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-xmark"
                      ?desabilitado=${this.formValores.length <= 1}
                      @click=${() => {
                        this.formValores = this.formValores.filter((_, j) => j !== i)
                          .map((x, j) => ({ ...x, mes: j + 1 }));
                      }}>Tirar</urbi-botao>
                  </td>
                </tr>`)}
            </tbody>
          </table>
        </div>
        <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
          @click=${() => { this.formValores = [...this.formValores, { mes: this.formValores.length + 1, pct: 0 }]; }}
        >Adicionar mês</urbi-botao>

        <div class="soma ${somaOk ? '' : 'invalida'}">Σ Total: ${soma.toFixed(2).replace('.', ',')}%</div>
        ${this.formErro ? html`<urbi-banner variante="erro">${this.formErro}</urbi-banner>` : nothing}

        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.editando = null}>Cancelar</urbi-botao>
          <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Salvar</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _salvar = async () => {
    if (!this.formNome.trim()) { this.formErro = 'Informe o nome da curva.'; return; }
    if (Math.abs(this._soma - 100) > 0.01) {
      this.formErro = `A soma deve ser 100% — atual: ${this._soma.toFixed(2).replace('.', ',')}%.`;
      return;
    }
    this.salvando = true;
    this.formErro = '';
    try {
      const dados = { nome: this.formNome.trim(), valores: this.formValores };
      const res = this.editando?.id
        ? await atualizarCurva(this.editando.id, dados)
        : await criarCurva(dados);
      if (res?.erro) { this.formErro = res.mensagem || 'Erro ao salvar'; return; }
      this.editando = null;
      urbiVerso.notificar('Curva salva.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      this.formErro = e?.message || 'Erro ao salvar';
    } finally {
      this.salvando = false;
    }
  };

  private _renderConfirmRemover(): TemplateResult {
    return html`
      <urbi-modal title="Excluir curva" maxWidth="420px" @urbi-modal:close=${() => this.removerAlvo = null}>
        <p>Excluir a curva <strong>${this.removerAlvo.nome}</strong>? Linhas de custo que a usam voltam para distribuição Linear.</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.removerAlvo = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemocao}>Excluir</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmarRemocao = async () => {
    const alvo = this.removerAlvo;
    this.removerAlvo = null;
    try {
      const res = await removerCurva(alvo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao excluir', 'erro'); return; }
      urbiVerso.notificar('Curva excluída.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao excluir', 'erro');
    }
  };

  private _semear = async () => {
    try {
      const res = await semearCurvas();
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao semear', 'erro'); return; }
      urbiVerso.notificar(res.criadas > 0 ? 'Curva S criada.' : 'Curva S já existia.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao semear', 'erro');
    }
  };
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { customElement, property, state } from 'lit/decorators.js';
import { STATUS_LABEL, TIPO_LABEL, NIVEL_LABEL, COR_STATUS, COR_NIVEL } from './viab-shared.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { nomeEstudoLimpo, LIMITE_NOME_ESTUDO, podeEditarEstudo } from './estudo-status.js';
import './tela-preliminar.js';
import './tela-avancado.js';
import {
  urbiVerso, buscarEstudo, transicaoStatus, atualizarEstudo,
  listarMembros, adicionarMembro, alterarFuncaoMembro, removerMembro, listarUsuarios, derivarAvancado,
} from './viabilidade-api.js';
import {
  guardarRelatorio, consumirRelatorio, ordenarAlertasPrimeiro, resumirRelatorio, podeCriarAvancado, podeConfirmarCriacao,
  type ItemRelatorioDerivacao,
} from './relatorio-derivacao.js';

import { premissasNaoSalvas, reaplicarRascunho, estudoDepoisDaRecarga, avisarSaidaSeNaoSalvo, transicaoDescartaRascunho } from './premissas-rascunho.js';
import { SequenciaDeCargas } from './estudo-carga.js';
import { acoesDoMembro, opcoesDeFuncao, podeGerirMembros, formNovoMembro } from './membros-regras.js';

@customElement('viab-tela-estudo')
export class ViabTelaEstudo extends LitElement {
  @property({ type: Number }) estudoId = 0;
  // Guia ativa vem da URL (/detalhe/:id/:aba). O conjunto válido depende do
  // nível — cada um normaliza dentro do seu próprio componente
  // (viab-tela-preliminar / viab-tela-avancado). Aqui só guardamos o valor cru.
  @property({ type: String })
  set aba(v: string) {
    const antigo = this._aba;
    this._aba = v || 'premissas';
    this.requestUpdate('aba', antigo);
  }
  get aba(): string { return this._aba; }
  private _aba = 'premissas';

  // #251: subaba (2º nível) vinda da URL /detalhe/:id/:aba/:subaba — Avançado e
  // Preliminar (desde a reestruturação de 2026-08-03) usam. Valor cru; cada
  // ramo do render normaliza (viab-tela-avancado / viab-tela-preliminar).
  @property({ type: String }) subAba = '';

  @state() private estudo: any = null;
  // Retrato do SERVIDOR do estudo. `estudo` recebe o rascunho das Premissas a
  // cada tecla (`viab:premissas-change`), para a Proforma e os Gráficos
  // refletirem a edição ao vivo; este aqui só muda quando o servidor confirma
  // (carga, save das Premissas, renomear). A diferença entre os dois É o
  // rascunho — o que a tela de Premissas acusa ao ser remontada depois de uma
  // troca de página, e o que o aviso de saída (`beforeunload`) protege.
  @state() private _estudoSalvo: any = null;
  @state() private carregando = true;
  @state() private membros: any[] = [];
  @state() private usuarios: any[] = [];
  @state() private mostrarMembros = false;
  @state() private novoMembroUsuario = '';
  @state() private novoMembroFuncao = 'leitor';
  @state() private _versaoMembros = 0;
  @state() private confirmarStatus: { novo: string; label: string } | null = null;
  // #678: renomear virou ação do cabeçalho do estudo (saiu do Painel).
  @state() private editarAlvo = false;
  @state() private editarNome = '';
  @state() private editarErro = '';
  @state() private salvandoNome = false;
  // Criar um estudo Avançado a partir deste Preliminar: modal de confirmação e, no estudo NOVO, o
  // relatório da derivação (guardado por `guardarRelatorio` e consumido uma vez em `_carregar`).
  @state() private derivarAberto = false;
  @state() private derivando = false;
  @state() private derivarErro = '';
  @state() private relatorioDerivacao: ItemRelatorioDerivacao[] | null = null;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .membros-lista { display: flex; flex-direction: column; gap: 8px; }
    .membro { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .membro-acoes { display: flex; gap: 8px; align-items: center; }
    .add-membro { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-top: 16px; }
    .add-membro urbi-select { min-width: 180px; }
    .form-campos { display: flex; flex-direction: column; gap: 12px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
    .apoio-nome { font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec); }
    .derivar-lista { margin: 4px 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
    .relatorio-derivacao { margin-bottom: 16px; }
    .relatorio-itens { margin: 8px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
    .relatorio-alerta { font-weight: 600; }
    .relatorio-nota { color: var(--cor-texto-sec); }
  `];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('beforeunload', this._antesDeSair);
    // Na PRIMEIRA conexão a carga é do `updated` (que vê `estudoId` mudar); aqui
    // só a RECONEXÃO recarrega. Duas cargas do mesmo id na montagem faziam a
    // última — se falhasse — descartar o sucesso da primeira (#907).
    if (this.hasUpdated) this._carregar();
  }

  disconnectedCallback() {
    window.removeEventListener('beforeunload', this._antesDeSair);
    super.disconnectedCallback();
  }

  /**
   * Recarregar ou fechar a página com edição de Premissas não salva pede a
   * confirmação nativa do navegador. Arrow de instância: a MESMA referência é
   * registrada e removida, então desmontar o estudo não deixa listener vivo.
   */
  private _antesDeSair = (e: BeforeUnloadEvent) => {
    avisarSaidaSeNaoSalvo(e, premissasNaoSalvas(this.estudo, this._estudoSalvo));
  };

  updated(changed: Map<string, unknown>) {
    if (changed.has('estudoId')) {
      this.relatorioDerivacao = null;
      this._carregar();
    }
  }

  private _cargas = new SequenciaDeCargas();

  private async _carregar() {
    if (!this.estudoId) return;
    const id = this.estudoId;
    this.carregando = true;
    // Só o ÚLTIMO pedido é aplicado (resposta, erro e `carregando`): resposta
    // velha — de outro estudo ou do mesmo, recarregado depois — é descartada.
    const carga = await this._cargas.carregar(() => buscarEstudo(id));
    if (!carga.ultimo) return;
    if ('erro' in carga) {
      console.error('Erro ao carregar estudo:', carga.erro);
    } else {
      const estudo = carga.resposta;
      try {
        if (estudo?.erro) { urbiVerso.notificar(estudo.mensagem || 'Sem acesso', 'erro'); this.estudo = null; this._estudoSalvo = null; }
        else {
          // Recarga do mesmo estudo (terreno do Núcleo alterado, troca de
          // status) preserva o rascunho das Premissas ainda não salvo — regra e
          // exceção em `estudoDepoisDaRecarga`.
          this.estudo = estudoDepoisDaRecarga(estudo, this.estudo, this._estudoSalvo);
          this._estudoSalvo = estudo;
          this.membros = estudo.membros || [];
          // Estudo recém-criado por "Criar estudo Avançado a partir deste": o relatório vem de
          // `guardarRelatorio` e só a primeira abertura o mostra.
          const relatorio = consumirRelatorio(id);
          if (relatorio) this.relatorioDerivacao = relatorio;
        }
      } catch (e) {
        console.error('Erro ao carregar estudo:', e);
      }
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
    // MESMA elevação que o backend aplica em `funcaoEfetiva`
    // (`backend/rotas/estudos.ts`, PATCH /estudos/:id): admin de app age como
    // aprovador mesmo sem ser membro do estudo, e `_permissao.funcao` (que o
    // GET devolve cru, de `estudo_membros`) não carrega essa elevação —
    // `p.podeAprovar` sim (`perm.ehAprovador || perm.ehAdminApp`). Usar
    // `p.funcao` puro aqui esconderia o botão de um admin não-membro num
    // estudo travado, mesmo o PATCH permitindo.
    const funcaoEfetiva = p.podeAprovar ? 'aprovador' : (p.funcao === 'editor' ? 'editor' : 'leitor');
    return html`
      <urbi-shell-page dashboard .titulo=${this.estudo.nome_exibicao || this.estudo.nome}
        @viab:terreno-alterado=${() => this._carregar()}
        @viab:premissas-change=${(e: CustomEvent) => { this.estudo = { ...this.estudo, ...e.detail.dados }; }}
        @viab:premissas-salvas=${(e: CustomEvent) => { this._estudoSalvo = { ...this._estudoSalvo, ...e.detail.dados }; }}>
        <urbi-botao-voltar slot="voltar" rotulo="Voltar aos estudos"
          @urbi:voltar=${() => urbiVerso.navegarSub('/')}></urbi-botao-voltar>
        ${this._renderAcoesStatus(p, st)}

        <div class="meta">
          <urbi-badge cor=${COR_STATUS[st] ?? 'padrao'}>${STATUS_LABEL[st] || st}</urbi-badge>
          <urbi-badge cor=${COR_NIVEL[this.estudo.nivel_analise] ?? COR_NIVEL.preliminar}>
            ${NIVEL_LABEL[this.estudo.nivel_analise] || 'Preliminar'}
          </urbi-badge>
          <span class="sec">${TIPO_LABEL[this.estudo.tipo_empreendimento] || this.estudo.tipo_empreendimento}</span>
          ${p.funcao ? html`<span class="sec">· sua função: ${p.funcao}</span>` : nothing}
          ${podeEditarEstudo(st, funcaoEfetiva) ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen"
              @click=${this._abrirEditarNome}
              title="Renomear estudo"></urbi-botao>` : nothing}
        </div>

        ${this._renderRelatorioDerivacao()}

        ${this.estudo.nivel_analise === 'avancado'
          ? html`
            <viab-tela-avancado
              .estudo=${this.estudo}
              .podeEditar=${!!p.podeEditar}
              .podeAprovar=${!!p.podeAprovar}
              .status=${st}
              .aba=${this.aba}
              .subAba=${this.subAba}
              @viab:aba-topo=${(e: CustomEvent) => urbiVerso.navegarSub(`/detalhe/${this.estudoId}/${e.detail.id}`)}
              @viab:subaba-topo=${(e: CustomEvent) => urbiVerso.navegarSub(`/detalhe/${this.estudoId}/${e.detail.aba}/${e.detail.sub}`)}
            ></viab-tela-avancado>`
          : html`
            <viab-tela-preliminar
              .estudo=${this.estudo}
              .estudoSalvo=${this._estudoSalvo}
              .podeEditar=${!!p.podeEditar}
              .podeAprovar=${!!p.podeAprovar}
              .status=${st}
              .aba=${this.aba}
              .subAba=${this.subAba}
              @viab:aba-topo=${(e: CustomEvent) => urbiVerso.navegarSub(`/detalhe/${this.estudoId}/${e.detail.id}`)}
              @viab:subaba-topo=${(e: CustomEvent) => urbiVerso.navegarSub(`/detalhe/${this.estudoId}/${e.detail.aba}/${e.detail.sub}`)}
            ></viab-tela-preliminar>`}
      </urbi-shell-page>

      ${this.mostrarMembros ? this._renderMembros(p) : nothing}
      ${this.confirmarStatus ? this._renderConfirmStatus() : nothing}
      ${this.editarAlvo ? this._renderEditarNome() : nothing}
      ${this.derivarAberto ? this._renderDerivarAvancado() : nothing}
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
        ${podeCriarAvancado(this.estudo, p)
          ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-diagram-project"
              @click=${this._abrirDerivar}>Criar estudo Avançado a partir deste</urbi-botao>`
          : nothing}
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-users"
          @click=${() => { this.mostrarMembros = true; this._carregarUsuarios(); }}>Membros</urbi-botao>
      </div>
    `;
  }

  /** Modal de confirmação de "Criar estudo Avançado a partir deste" (só Preliminar, só editor). */
  private _renderDerivarAvancado(): TemplateResult {
    const naoSalvas = premissasNaoSalvas(this.estudo, this._estudoSalvo);
    return html`
      <urbi-modal title="Criar estudo Avançado a partir deste" maxWidth="560px"
        @urbi-modal:close=${this._fecharDerivar}>
        <div class="form-campos">
          <div>
            <strong>O que vai para o Avançado</strong>
            <ul class="derivar-lista">
              <li>O catálogo de produtos vira tipologias, com um grupo de receita.</li>
              <li>Os custos das Premissas, o imposto e a data de início.</li>
              <li>A análise de mercado e o apelo comercial.</li>
            </ul>
          </div>
          <div>
            <strong>O que fica a completar no Avançado</strong>
            <ul class="derivar-lista">
              <li>Cronograma, absorção e plano de pagamento.</li>
              <li>Juros de tabela, funding e cenários.</li>
            </ul>
          </div>
          <div class="apoio-nome">
            Este estudo Preliminar não muda. A área privativa aberta fica como referência: ela continua
            registrada nas Premissas e não entra no valor das tipologias do Avançado.
          </div>

          ${naoSalvas ? html`<urbi-banner variante="alerta" class="derivar-nao-salvo">
            Há alterações não salvas nas Premissas. O estudo Avançado é criado a partir do que está SALVO,
            e essas alterações ficariam de fora. Salve as Premissas antes de criar.
          </urbi-banner>` : nothing}
          ${this.derivarErro ? html`<urbi-banner variante="erro">${this.derivarErro}</urbi-banner>` : nothing}

          <div class="form-acoes">
            <urbi-botao variante="fantasma" ?desabilitado=${this.derivando}
              @click=${this._fecharDerivar}>Cancelar</urbi-botao>
            <urbi-botao variante="primario"
              ?carregando=${this.derivando}
              ?desabilitado=${!podeConfirmarCriacao(naoSalvas, this.derivando)}
              @click=${this._criarAvancado}>Criar</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }

  /** Relatório da derivação, no estudo NOVO: alertas primeiro, com botão para fechar. */
  private _renderRelatorioDerivacao(): TemplateResult | typeof nothing {
    const itens = this.relatorioDerivacao;
    if (!itens || itens.length === 0) return nothing;
    const { total, alertas } = resumirRelatorio(itens);
    return html`
      <div class="relatorio-derivacao">
        <urbi-banner variante=${alertas > 0 ? 'alerta' : 'info'}>
          <strong>Estudo criado a partir de um Preliminar:</strong>
          ${total} ${total === 1 ? 'item' : 'itens'} no relatório,
          ${alertas} ${alertas === 1 ? 'alerta' : 'alertas'}.
          <ul class="relatorio-itens">
            ${ordenarAlertasPrimeiro(itens).map((i) => html`
              <li>
                ${i.alerta ? html`<span class="relatorio-alerta">Alerta: </span>` : nothing}
                <strong>${i.origem}</strong> → ${i.destino}: ${i.regra}.
                ${i.nota ? html`<span class="relatorio-nota">${i.nota}</span>` : nothing}
              </li>`)}
          </ul>
          <div class="relatorio-nota">
            Este relatório aparece só agora, ao abrir o estudo novo: depois de fechado, ou ao recarregar a
            página, ele não volta à tela.
          </div>
          <urbi-botao slot="acao" pequeno variante="fantasma"
            @click=${() => { this.relatorioDerivacao = null; }}>Entendi, fechar</urbi-botao>
        </urbi-banner>
      </div>
    `;
  }

  private _abrirDerivar = () => {
    this.derivarErro = '';
    this.derivarAberto = true;
  };

  private _fecharDerivar = () => {
    if (this.derivando) return;
    this.derivarAberto = false;
  };

  private _criarAvancado = async () => {
    if (!podeConfirmarCriacao(premissasNaoSalvas(this.estudo, this._estudoSalvo), this.derivando)) return;
    this.derivando = true;
    this.derivarErro = '';
    try {
      const res = await derivarAvancado(this.estudoId);
      if (res?.erro) { this.derivarErro = res.mensagem || 'Erro ao criar o estudo Avançado'; return; }
      const novoId = Number(res?.estudo?.id);
      if (!Number.isFinite(novoId) || novoId <= 0) {
        this.derivarErro = 'O servidor não devolveu o estudo criado.';
        return;
      }
      guardarRelatorio(novoId, res.relatorio);
      this.derivarAberto = false;
      urbiVerso.notificar('Estudo Avançado criado (rascunho).', 'sucesso');
      urbiVerso.navegarSub(`/detalhe/${novoId}`);
    } catch (e: any) {
      this.derivarErro = e?.message || 'Erro ao criar o estudo Avançado';
    } finally {
      this.derivando = false;
    }
  };

  private _renderMembros(p: any): TemplateResult {
    // As regras moram em `membros-regras.ts`, as mesmas que o servidor aplica
    // (`recusaAlteracaoMembro` e o teto pelo nível do alvo no app), para a tela
    // não oferecer o que ele recusa. O nível de cada pessoa vem da lista de
    // usuários do app; enquanto ela não carrega, o teto não corta (o servidor
    // segue sendo o portão).
    const st = this.estudo?.status;
    const podeGerir = podeGerirMembros(p, st);
    const nivelDe = (id: unknown) => this._nivelDe(id);
    const opcoesNovo = opcoesDeFuncao(p, this.novoMembroUsuario ? nivelDe(this.novoMembroUsuario) : undefined);
    const formNovo = this._formNovo(p);
    return html`
      <urbi-modal title="Membros do estudo" @urbi-modal:close=${() => this.mostrarMembros = false}>
        <div class="membros-lista">
          ${this.membros.length === 0 ? html`<span class="sec">Nenhum membro.</span>` : nothing}
          ${this.membros.map((m) => {
            const a = acoesDoMembro(p, st, this.membros, m, nivelDe(m.usuario_id));
            return html`
            <div class="membro">
              <span>${m.usuario_nome || `Usuário ${m.usuario_id}`}</span>
              <div class="membro-acoes">
                ${a.podeTrocarFuncao ? html`
                  ${keyed(`${m.usuario_id}:${this._versaoMembros}`, html`<urbi-select
                    .valor=${m.funcao}
                    .opcoes=${a.opcoes}
                    @urbi:select-change=${(e: CustomEvent) => this._alterarFuncao(m.usuario_id, e.detail.valor, m.funcao)}
                  ></urbi-select>`)}
                ` : html`<urbi-badge cor="padrao">${m.funcao}</urbi-badge>`}
                ${a.podeRemover ? html`
                  <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
                    .ariaLabel=${'Remover membro'}
                    @click=${() => this._removerMembro(m.usuario_id)}></urbi-botao>` : nothing}
              </div>
            </div>
          `;
          })}
        </div>
        ${podeGerir ? html`
          <div class="add-membro">
            <urbi-select
              label="Usuário"
              placeholder="Selecionar usuário…"
              .valor=${this.novoMembroUsuario}
              .opcoes=${this.usuarios.map((u) => ({ valor: String(u.id), rotulo: u.nome }))}
              pesquisavel
              @urbi:select-change=${(e: CustomEvent) => this._escolherNovoMembro(p, e.detail.valor, nivelDe(e.detail.valor))}
            ></urbi-select>
            <urbi-select
              label="Função"
              .valor=${this.novoMembroFuncao}
              .opcoes=${opcoesNovo}
              @urbi:select-change=${(e: CustomEvent) => this.novoMembroFuncao = e.detail.valor}
            ></urbi-select>
            <urbi-botao variante="primario" icone="fa-solid fa-plus" ?desabilitado=${!formNovo.podeAdicionar}
              @click=${this._adicionarMembro}>Adicionar</urbi-botao>
          </div>
          ${this.novoMembroUsuario && formNovo.semFuncaoPossivel ? html`
            <span class="sec">Esta pessoa não tem nível no app para nenhuma função que você pode conceder.</span>` : nothing}` : nothing}
      </urbi-modal>
    `;
  }

  private _renderConfirmStatus(): TemplateResult {
    const c = this.confirmarStatus!;
    return html`
      <urbi-modal title="Confirmar" maxWidth="420px" @urbi-modal:close=${() => this.confirmarStatus = null}>
        <p>Confirma <strong>${c.label}</strong> este estudo?</p>
        ${transicaoDescartaRascunho(c.novo, this.estudo, this._estudoSalvo) ? html`
          <urbi-banner variante="alerta">
            Há alterações não salvas nas Premissas. Com este status elas ficam só de leitura, e as
            alterações serão descartadas — cancele e clique em “Salvar premissas” para mantê-las.
          </urbi-banner>` : nothing}
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.confirmarStatus = null}>Cancelar</urbi-botao>
          <urbi-botao variante=${c.novo === 'reprovado' ? 'perigo' : 'sucesso'}
            @click=${() => { const n = c.novo; this.confirmarStatus = null; this._status(n); }}>Confirmar</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  /**
   * #678 — modal de renomear, movido do Painel (#660) para o cabeçalho do
   * estudo. O campo edita `nome`, que é o campo REAL da coluna; a tela mostra
   * `nome_exibicao || nome`, e `nome_exibicao` é derivado de `nome` pelo
   * servidor a cada PATCH (ver `montarPatchEstudo`). Editar o nome de exibição
   * diretamente não é opção: ele carrega sigla, UF e sequência, que não são do
   * usuário.
   */
  private _renderEditarNome(): TemplateResult {
    const limpo = nomeEstudoLimpo(this.editarNome);
    return html`
      <urbi-modal title="Editar nome do estudo" maxWidth="480px"
        @urbi-modal:close=${() => this.editarAlvo = false}>
        <div class="form-campos">
          <urbi-input
            label="Nome do estudo"
            obrigatorio
            placeholder="Ex: Pátio Urbitá 1"
            .valor=${this.editarNome}
            @urbi:input-change=${(e: CustomEvent) => {
              this.editarNome = String(e.detail?.valor ?? '');
              this.editarErro = '';
            }}
          ></urbi-input>
          <div class="apoio-nome">
            O identificador (${this.estudo?.id_legivel || '—'}) não muda: renomear altera como o
            estudo aparece, não quem ele é.
          </div>

          ${this.editarErro ? html`<urbi-banner variante="erro">${this.editarErro}</urbi-banner>` : nothing}

          <div class="form-acoes">
            <urbi-botao variante="fantasma" @click=${() => this.editarAlvo = false}>Cancelar</urbi-botao>
            <urbi-botao variante="primario"
              ?carregando=${this.salvandoNome}
              ?desabilitado=${limpo === null}
              @click=${this._salvarNome}>Salvar</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }

  private _abrirEditarNome = () => {
    this.editarAlvo = true;
    // O campo editável é o `nome` cru — nunca o `nome_exibicao`, que é derivado.
    this.editarNome = String(this.estudo?.nome ?? '');
    this.editarErro = '';
  };

  private _salvarNome = async () => {
    const estudo = this.estudo;
    if (!estudo) return;
    // MESMO parser do portão (`montarPatchEstudo`), importado do módulo
    // compartilhado — não uma segunda regra de validação escrita aqui.
    const limpo = nomeEstudoLimpo(this.editarNome);
    if (limpo === null) {
      this.editarErro = `Informe um nome de 1 a ${LIMITE_NOME_ESTUDO} caracteres.`;
      return;
    }
    if (limpo === String(estudo.nome ?? '')) { this.editarAlvo = false; return; }
    this.salvandoNome = true;
    this.editarErro = '';
    try {
      const res = await atualizarEstudo(this.estudoId, { nome: limpo });
      if (res?.erro) { this.editarErro = res.mensagem || 'Erro ao renomear'; return; }
      // A resposta do PATCH é a linha gravada — inclusive o `nome_exibicao`
      // recomposto pelo servidor, que é o que o cabeçalho mostra. Espalhar
      // sobre `this.estudo` preserva o que já foi carregado e o PATCH não
      // devolve (ex.: `membros`, `_permissao`).
      // O retrato do servidor recebe a linha inteira; o `estudo` corrente
      // recebe a mesma linha com o rascunho das Premissas por cima — renomear
      // não pode apagar uma edição ainda não salva.
      this.estudo = reaplicarRascunho({ ...this.estudo, ...res }, this.estudo, this._estudoSalvo);
      this._estudoSalvo = { ...this._estudoSalvo, ...res };
      this.editarAlvo = false;
      urbiVerso.notificar('Nome do estudo atualizado.', 'sucesso');
    } catch (e: any) {
      this.editarErro = e?.message || 'Erro ao renomear';
    } finally {
      this.salvandoNome = false;
    }
  };

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

  /** Nível no app de uma pessoa, pela lista de usuários; `undefined` enquanto ela não carrega. */
  private _nivelDe(id: unknown): string | undefined {
    if (this.usuarios.length === 0) return undefined;
    return this.usuarios.find((u) => Number(u.id) === Number(id))?.nivel ?? 'nenhuma';
  }

  /**
   * Estado do formulário de adicionar membro — o MESMO no render (que habilita o
   * botão) e no handler (que manda o pedido), para o botão nunca enviar uma função
   * diferente da que o habilitou.
   */
  private _formNovo(p: any) {
    return formNovoMembro(p, !!this.novoMembroUsuario, this._nivelDe(this.novoMembroUsuario), this.novoMembroFuncao);
  }

  private async _adicionarMembro() {
    const usuarioId = parseInt(this.novoMembroUsuario || '');
    if (!usuarioId) { urbiVerso.notificar('Selecione um usuário.', 'alerta'); return; }
    const form = this._formNovo(this.estudo?._permissao || {});
    if (!form.podeAdicionar || !form.funcao) return;
    try {
      const res = await adicionarMembro(this.estudoId, usuarioId, form.funcao);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this.membros = (await listarMembros(this.estudoId))?.dados || this.membros;
      this.novoMembroUsuario = '';
      urbiVerso.notificar('Membro adicionado.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro', 'erro');
    }
  }

  /**
   * Escolher a pessoa a adicionar recorta as funções pelo nível dela no app; se a
   * função escolhida antes não cabe mais, volta para a primeira que cabe — senão
   * o Adicionar mandaria uma função que o servidor recusa (`NIVEL_INSUFICIENTE`).
   * Se nenhuma cabe, o Adicionar fica desabilitado (`formNovoMembro`).
   */
  private _escolherNovoMembro(p: any, usuario: string, nivel: string | undefined) {
    this.novoMembroUsuario = usuario;
    const f = formNovoMembro(p, !!usuario, nivel, this.novoMembroFuncao).funcao;
    if (f) this.novoMembroFuncao = f;
  }

  private async _alterarFuncao(usuarioId: number, funcao: string, atual?: string) {
    // Escolher de novo a função atual (ela fica no seletor só para ser mostrada)
    // não é troca: nenhum pedido sai.
    if (funcao === atual) return;
    try {
      const res = await alterarFuncaoMembro(this.estudoId, usuarioId, funcao);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); }
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro', 'erro');
    }
    // Relê sempre — inclusive na recusa — e RECRIA os seletores: sem isto o
    // seletor segue mostrando a função que o servidor recusou, porque `m.funcao`
    // não mudou e o lit não reaplica um `.valor` igual ao último que gravou. A
    // versão entra na chave do `keyed`, que descarta o elemento e monta outro.
    try { this.membros = (await listarMembros(this.estudoId))?.dados || this.membros; } catch { /* mantém */ }
    this._versaoMembros++;
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

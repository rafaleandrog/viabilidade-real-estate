import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import {
  EVENTO_LABEL, EVENTO_COR, corFaseExtra,
  rotuloPeriodo, rotuloMesRelativo, parseMesAno, problemaJanelaDuranteObra,
} from './fluxo-shared.js';
import {
  urbiVerso,
  buscarParametrosAvancado, atualizarParametrosAvancado,
  buscarCronogramaAvancado, atualizarCronogramaLote,
  listarFasesAvancado, criarFaseAvancado, atualizarFaseAvancado, removerFaseAvancado,
} from './viabilidade-api.js';
import './viab-num.js';

// Cronograma do empreendimento — EXCLUSIVO do nível Avançado.
//
// Mostra dois blocos:
//  1. 5 eventos fixos (planejamento … pos_obra) — editáveis pelo usuário (início
//     e duração; travados são calculados automaticamente).
//  2. Fases comerciais (avancado_fases, tipo='cronograma', #168) — criadas
//     SÓ aqui, com nome/início/duração livres, como marcadores do gantt. São
//     uma lista separada das fases de Receitas (tipo='receita', donas de
//     Absorção/Fluxo de Pagamento/Alocações) — antes as duas telas faziam
//     CRUD na mesma lista sem discriminador.
//
// #41 — cada evento padrão exibe sua cor de token distinta na lista e no gantt.
// #42 — CRUD de fases extras posicionadas no gantt.
// #43 — ⭐ sobre o evento Lançamento (sempre 1 mês); 🔑 ao fim da barra de Obra.

@customElement('viab-fluxo-cronograma')
export class ViabFluxoCronograma extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private paramsForm: Record<string, any> = {};
  @state() private salvandoParams = false;
  @state() private crono: any[] = [];
  @state() private fases: any[] = [];
  @state() private cronoCarregando = false;
  private cronoCarregado = false;

  // #252: rascunho local, tela inteira — nenhum campo (eventos fixos OU fases
  // customizadas) dispara PATCH nem toast por tecla. Tudo acumula aqui até o
  // clique em "Salvar cronograma": os eventos vão numa ÚNICA chamada em lote
  // (endpoint novo, backend/rotas/avancado.ts) — validação de todo o lote
  // antes de qualquer escrita, uma reancoragem só, um só toast. As fases são
  // uma entidade separada sem endpoint em lote (não há transação disponível
  // neste stack para uni-las de verdade às duas tabelas numa só chamada) —
  // continuam salvando uma PATCH por fase, mas só no clique, nunca por tecla.
  @state() private draftCrono: Record<string, { inicio_mes?: number; duracao_meses?: number }> = {};
  @state() private draftFases: Record<number, { nome?: string; inicio_mes?: number; duracao_meses?: number }> = {};
  @state() private salvandoCronograma = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .params { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 8px; }
    .params urbi-input { width: 160px; }
    /* #245: o viab-num agrega número + setas + sufixo ("meses") + sufixo-mes
       ("jun/29") na mesma linha. A correção do truncamento é no primitivo
       ("viab-num.ts": o input ganhou "min-width: 4ch", o afixo foi para corpo
       secundário) — aqui a largura deixa de ser um px fixo e passa a um
       intervalo em "ch", que acompanha a fonte em vez de assumir uma.
       "max-width" (~184px) preserva o tamanho confortável de antes; "min-width"
       deixa o campo CEDER em tela estreita, o que antes era impossível — medido
       no Chromium, o primitivo corrigido só trunca abaixo de 90px, contra 175px
       da versão anterior, então encolher aqui é seguro e evita overflow. */
    .params viab-num { width: auto; min-width: 10ch; max-width: 18ch; }

    table.crono { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    table.crono th {
      text-align: left; font-weight: 600; padding: 8px 10px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      font-size: var(--texto-rotulo, 0.75rem);
      border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    table.crono td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
      font-size: var(--texto-corpo, 0.8125rem);
    }
    table.crono td.evento { white-space: nowrap; }
    table.crono tbody tr { border-left: 3px solid transparent; }
    .ponto-cor {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%;
      margin-right: 8px; vertical-align: 1px; flex-shrink: 0;
    }
    .evento-label { display: inline-flex; align-items: center; }
    .campo-mes { display: inline-flex; align-items: center; gap: 6px; }
    /* #245: mesma regra de .params viab-num — Início e Duração compartilham o
       intervalo, que é o que garante a MESMA largura para os dois campos
       (critério de aceite), inclusive entre eventos fixos e fases customizadas,
       que usam este mesmo seletor. */
    .campo-mes viab-num { width: auto; min-width: 10ch; max-width: 18ch; }
    .cadeado { opacity: 0.7; font-size: 0.75rem; }
    td.periodo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); white-space: nowrap; }

    .secao-titulo {
      font-size: var(--texto-rotulo, 0.75rem); font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--cor-texto-sec, rgba(255,255,255,0.5));
      padding: 14px 10px 6px; border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    .acoes-fase { margin-top: 12px; }
    .acoes-cronograma { display: flex; gap: 8px; margin-bottom: 8px; }

    /* #245: em telas estreitas a soma das colunas (evento + Início + Duração +
       período) excede a viewport e a PÁGINA ganhava rolagem horizontal. Rolar
       a tabela, e não o documento, é o mesmo padrão que .gantt-wrap já usa
       logo abaixo. min-width impede as células de se espremerem a ponto de
       reintroduzir o truncamento que esta issue corrige. */
    .tabela-wrap { overflow-x: auto; }
    .tabela-wrap table.crono { min-width: 520px; }

    .gantt-wrap { margin-top: 16px; overflow-x: auto; }
    .gantt-wrap svg { display: block; min-width: 560px; width: 100%; height: auto; }
  `];

  updated() {
    if (this.estudo?.nivel_analise === 'avancado' && !this.cronoCarregado) {
      this.cronoCarregado = true;
      this._carregarCronograma();
    }
  }

  private async _carregarCronograma() {
    if (!this.estudo?.id) return;
    this.cronoCarregando = true;
    try {
      const [params, crono, fasesRes] = await Promise.all([
        buscarParametrosAvancado(this.estudo.id),
        buscarCronogramaAvancado(this.estudo.id),
        listarFasesAvancado(this.estudo.id, 'cronograma'),
      ]);
      if (!params?.erro) this.paramsForm = { ...params };
      if (!crono?.erro) this.crono = crono.dados || [];
      if (!fasesRes?.erro) this.fases = fasesRes.dados || [];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar o cronograma', 'erro');
    }
    this.cronoCarregando = false;
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    if (this.cronoCarregando && this.crono.length === 0) {
      return html`<urbi-loading mensagem="Carregando cronograma..."></urbi-loading>`;
    }
    const dataInicio = this.paramsForm.data_inicio_projeto ?? null;
    const dis = !this.editavel;
    // #225: Lançamento que alcança o fim da Obra deixa "Durante a obra" vazia.
    const probObra = this.crono.length > 0 ? problemaJanelaDuranteObra(this.crono) : null;
    return html`
      <urbi-card titulo="Cronograma do empreendimento">
        <div class="params">
          <urbi-input
            label="Data de início do projeto"
            placeholder="jan/2027"
            obrigatorio
            ?desabilitado=${dis}
            .valor=${this.paramsForm.data_inicio_projeto || ''}
            @urbi:input-change=${(e: CustomEvent) => {
              this.paramsForm = { ...this.paramsForm, data_inicio_projeto: String(e.detail.valor || '').toLowerCase() };
            }}
          ></urbi-input>
          ${!dis ? html`
            <urbi-botao variante="secundario" ?carregando=${this.salvandoParams}
              @click=${this._salvarParametros}>Salvar</urbi-botao>` : nothing}
        </div>
        ${dataInicio && !parseMesAno(dataInicio) ? html`
          <urbi-banner variante="erro">Data de início inválida — use o formato mmm/AAAA (ex.: jan/2027).</urbi-banner>` : nothing}
        ${!dataInicio ? html`
          <urbi-banner variante="alerta">Defina a data de início do projeto — ela ancora o mês 0 de todo o fluxo.</urbi-banner>` : nothing}
        ${probObra ? html`
          <urbi-banner variante="alerta">${probObra}</urbi-banner>` : nothing}
        ${!dis && this._sujo ? html`
          <urbi-banner variante="alerta">
            Alterações não salvas — clique em "Salvar cronograma" antes de sair desta página.
          </urbi-banner>` : nothing}

        ${!dis ? html`
          <div class="acoes-cronograma">
            <urbi-botao variante="primario" ?carregando=${this.salvandoCronograma}
              ?desabilitado=${!this._sujo} @click=${this._salvarCronograma}>Salvar cronograma</urbi-botao>
            <urbi-botao variante="fantasma" ?desabilitado=${!this._sujo || this.salvandoCronograma}
              @click=${this._cancelarCronograma}>Cancelar</urbi-botao>
          </div>` : nothing}

        <div class="tabela-wrap">
        <table class="crono">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Início</th>
              <th>Duração</th>
              <th>Período</th>
              ${!dis ? html`<th></th>` : nothing}
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="5" class="secao-titulo">Fases fixas</td></tr>
            ${this.crono.map((ev) => this._linhaEvento(ev, dataInicio, dis))}
            ${this.fases.length > 0 ? html`
              <tr><td colspan="5" class="secao-titulo">Fases customizadas</td></tr>
              ${this.fases.map((f, i) => this._linhaFase(f, i, dataInicio, dis))}
            ` : nothing}
          </tbody>
        </table>
        </div>

        ${!dis ? html`
          <div class="acoes-fase">
            <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${this._adicionarFase}>
              Adicionar fase
            </urbi-botao>
          </div>` : nothing}

        ${this._renderGantt(dataInicio)}
      </urbi-card>
    `;
  }

  private _linhaEvento(ev: any, dataInicio: string | null, dis: boolean): TemplateResult {
    // #165/#166: os overrides por nome de evento que existiam aqui (pre_lancamento
    // sempre travado, lancamento sempre destravado) tratavam só o SINTOMA — o
    // backend (recalcularTravados, avancado.ts) é quem decide travado_inicio/
    // travado_duracao de verdade, e agora já deriva pre_lancamento.inicio_mes do
    // fim do Planejamento (#165) e não força mais lancamento.duracao_meses = 1
    // (#166). Confiar direto nas flags evita o desalinho que gerava 422 ao editar.
    const travadoIni = Boolean(ev.travado_inicio);
    const travadoDur = Boolean(ev.travado_duracao);
    const cor = EVENTO_COR[ev.evento] || 'var(--cor-texto-sec)';
    // #252: enquanto houver rascunho, a tela exibe o valor DIGITADO (não o
    // persistido) — inclusive no Período, para o usuário ver o efeito antes de
    // salvar. Nada é enviado ao backend até o clique em "Salvar".
    const draft = this.draftCrono[ev.evento];
    const inicioExibido = draft?.inicio_mes ?? Number(ev.inicio_mes);
    const duracaoExibida = draft?.duracao_meses ?? Number(ev.duracao_meses);
    const temRascunho = draft !== undefined;
    const bloqueado = dis || this.salvandoCronograma;
    return html`
      <tr style="border-left: 3px solid ${cor}">
        <td class="evento">
          <span class="evento-label">
            <span class="ponto-cor" style="background:${cor}"></span>
            ${EVENTO_LABEL[ev.evento] || ev.evento}
          </span>
        </td>
        <td>
          <span class="campo-mes">
            <viab-num casas-decimais="0" sufixo="º mês" passo="1"
              sufixo-mes=${dataInicio ? rotuloMesRelativo(dataInicio, inicioExibido) : ''}
              ?desabilitado=${bloqueado || travadoIni}
              .valor=${inicioExibido}
              @urbi:input-numero-change=${(e: CustomEvent) => this._rascunharEvento(ev.evento, { inicio_mes: e.detail.valor })}
            ></viab-num>
            ${travadoIni ? html`<span class="cadeado" title="Calculado automaticamente">🔒</span>` : nothing}
          </span>
        </td>
        <td>
          <span class="campo-mes">
            <viab-num casas-decimais="0" sufixo="meses" passo="1"
              sufixo-mes=${dataInicio ? rotuloMesRelativo(dataInicio, inicioExibido + duracaoExibida - 1) : ''}
              ?desabilitado=${bloqueado || travadoDur}
              .valor=${duracaoExibida}
              @urbi:input-numero-change=${(e: CustomEvent) => this._rascunharEvento(ev.evento, { duracao_meses: e.detail.valor })}
            ></viab-num>
            ${travadoDur ? html`<span class="cadeado" title="Duração fixa">🔒</span>` : nothing}
          </span>
        </td>
        <td class="periodo">${rotuloPeriodo(dataInicio, inicioExibido, duracaoExibida)}</td>
        ${!dis ? html`
          <td>
            ${temRascunho ? html`
              <urbi-botao variante="fantasma" pequeno ?desabilitado=${this.salvandoCronograma}
                @click=${() => this._descartarRascunhoEvento(ev.evento)}>Descartar</urbi-botao>
            ` : nothing}
          </td>` : nothing}
      </tr>
    `;
  }

  // #252: acumula a edição no rascunho local — nenhuma chamada de rede aqui.
  private _rascunharEvento(evento: string, campo: Record<string, any>) {
    const valor = Object.values(campo)[0];
    if (valor === null || valor === undefined || Number(valor) < 0) return;
    this.draftCrono = { ...this.draftCrono, [evento]: { ...this.draftCrono[evento], ...campo } };
  }

  private _descartarRascunhoEvento(evento: string) {
    const { [evento]: _descartado, ...resto } = this.draftCrono;
    this.draftCrono = resto;
  }

  private _rascunharFase(f: any, campo: Record<string, any>) {
    const valor = Object.values(campo)[0];
    // `nome` pode ser string vazia legitimamente enquanto o usuário digita —
    // só início/duração negativos são recusados, como nos eventos fixos.
    if (typeof valor === 'number' && valor < 0) return;
    this.draftFases = { ...this.draftFases, [f.id]: { ...this.draftFases[f.id], ...campo } };
  }

  private _descartarRascunhoFase(id: number) {
    const { [id]: _descartado, ...resto } = this.draftFases;
    this.draftFases = resto;
  }

  private get _sujo(): boolean {
    return Object.keys(this.draftCrono).length > 0 || Object.keys(this.draftFases).length > 0;
  }

  private _cancelarCronograma() {
    this.draftCrono = {};
    this.draftFases = {};
  }

  // #252: um clique salva TUDO. Eventos fixos vão numa única chamada em lote
  // (endpoint novo) — o backend valida o lote inteiro antes de escrever
  // qualquer coisa, então uma falha aqui não persiste nada e preserva o
  // rascunho. Fases são uma tabela separada sem endpoint em lote (não há
  // transação disponível neste stack para unir as duas numa só chamada
  // atômica) — continuam uma PATCH por fase, mas só agora, não mais por
  // tecla; uma falha de fase não desfaz os eventos já salvos com sucesso.
  private async _salvarCronograma() {
    if (!this._sujo || this.salvandoCronograma) return;
    this.salvandoCronograma = true;
    try {
      if (Object.keys(this.draftCrono).length > 0) {
        const res = await atualizarCronogramaLote(this.estudo.id, this.draftCrono);
        if (res?.erro) {
          urbiVerso.notificar(res.mensagem || 'Erro ao salvar o cronograma — nada foi alterado.', 'erro');
          return;
        }
        this.crono = res.dados || this.crono;
        this.draftCrono = {};
      }

      let falhaFase = false;
      for (const [idStr, dados] of Object.entries(this.draftFases)) {
        const id = Number(idStr);
        const res = await atualizarFaseAvancado(this.estudo.id, id, dados);
        if (res?.erro) { falhaFase = true; continue; }
        this.fases = this.fases.map((x) => (x.id === id ? { ...x, ...dados } : x));
        this._descartarRascunhoFase(id);
      }

      if (falhaFase) {
        urbiVerso.notificar('O cronograma foi salvo, mas alguma fase falhou — o rascunho dela continua pendente.', 'erro');
      } else {
        urbiVerso.notificar('Cronograma salvo.', 'sucesso');
      }
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar o cronograma', 'erro');
    } finally {
      this.salvandoCronograma = false;
    }
  }

  private _linhaFase(f: any, idx: number, dataInicio: string | null, dis: boolean): TemplateResult {
    const cor = corFaseExtra(idx);
    // #252: mesmo padrão dos eventos fixos — enquanto houver rascunho, exibe
    // o valor digitado; nada vai ao backend até "Salvar cronograma".
    const draft = this.draftFases[f.id];
    const nomeExibido = draft?.nome ?? (f.nome || '');
    const inicioExibido = draft?.inicio_mes ?? Number(f.inicio_mes ?? 0);
    const duracaoExibida = draft?.duracao_meses ?? Number(f.duracao_meses ?? 12);
    const temRascunho = draft !== undefined;
    const bloqueado = dis || this.salvandoCronograma;
    return html`
      <tr style="border-left: 3px solid ${cor}">
        <td class="evento">
          <span class="evento-label">
            <span class="ponto-cor" style="background:${cor}"></span>
            ${dis ? html`${f.nome || 'Fase'}` : html`
              <urbi-input .valor=${nomeExibido} placeholder="Nome da fase" ?desabilitado=${bloqueado}
                @urbi:input-change=${(e: CustomEvent) => this._rascunharFase(f, { nome: e.detail.valor })}
              ></urbi-input>`}
          </span>
        </td>
        <td>
          <span class="campo-mes">
            <viab-num casas-decimais="0" sufixo="º mês" passo="1"
              sufixo-mes=${dataInicio ? rotuloMesRelativo(dataInicio, inicioExibido) : ''}
              ?desabilitado=${bloqueado}
              .valor=${inicioExibido}
              @urbi:input-numero-change=${(e: CustomEvent) => this._rascunharFase(f, { inicio_mes: e.detail.valor })}
            ></viab-num>
          </span>
        </td>
        <td>
          <span class="campo-mes">
            <viab-num casas-decimais="0" sufixo="meses" passo="1"
              sufixo-mes=${dataInicio ? rotuloMesRelativo(dataInicio, inicioExibido + duracaoExibida - 1) : ''}
              ?desabilitado=${bloqueado}
              .valor=${duracaoExibida}
              @urbi:input-numero-change=${(e: CustomEvent) => this._rascunharFase(f, { duracao_meses: e.detail.valor })}
            ></viab-num>
          </span>
        </td>
        <td class="periodo">${rotuloPeriodo(dataInicio, inicioExibido, duracaoExibida)}</td>
        ${!dis ? html`
          <td>
            ${temRascunho ? html`
              <urbi-botao variante="fantasma" pequeno ?desabilitado=${this.salvandoCronograma}
                @click=${() => this._descartarRascunhoFase(f.id)}>Descartar</urbi-botao>
            ` : nothing}
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" title="Remover"
              ?desabilitado=${this.salvandoCronograma}
              @click=${() => this._removerFase(f)}></urbi-botao>
          </td>` : nothing}
      </tr>
    `;
  }

  private async _salvarParametros() {
    const data = String(this.paramsForm.data_inicio_projeto || '').trim().toLowerCase();
    if (data && !parseMesAno(data)) {
      urbiVerso.notificar('Data de início inválida — use mmm/AAAA (ex.: jan/2027).', 'erro');
      return;
    }
    this.salvandoParams = true;
    try {
      const res = await atualizarParametrosAvancado(this.estudo.id, {
        data_inicio_projeto: data || null,
        taxa_desconto_aa: this.paramsForm.taxa_desconto_aa ?? 12,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      this.paramsForm = { ...res };
      urbiVerso.notificar('Parâmetros do fluxo salvos.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    } finally {
      this.salvandoParams = false;
    }
  }

  private _adicionarFase = async () => {
    try {
      const res = await criarFaseAvancado(this.estudo.id, {
        tipo: 'cronograma',
        nome: `Fase ${this.fases.length + 1}`,
        ordem: this.fases.length,
        inicio_mes: 0,
        duracao_meses: 12,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar fase', 'erro'); return; }
      this.fases = [...this.fases, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar fase', 'erro');
    }
  };

  private async _removerFase(f: any) {
    try {
      const res = await removerFaseAvancado(this.estudo.id, f.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover fase', 'erro'); return; }
      this.fases = this.fases.filter((x) => x.id !== f.id);
      this._descartarRascunhoFase(f.id); // #252: remoção esvazia o rascunho pendente dela.
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover fase', 'erro');
    }
  }

  // Gantt em SVG puro: eventos fixos (barras) + fases extras (tracejadas).
  // #43 — ⭐ sobre o evento Lançamento (1 mês); 🔑 ao fim da barra de Obra.
  private _renderGantt(dataInicio: string | null): TemplateResult {
    const todasLinhas: Array<{ label: string; inicio: number; duracao: number; cor: string; tracejado: boolean; marcador?: string }> = [
      ...this.crono.map((ev) => ({
        label: EVENTO_LABEL[ev.evento] || ev.evento,
        inicio: Number(ev.inicio_mes),
        duracao: Number(ev.duracao_meses),
        cor: EVENTO_COR[ev.evento] || 'var(--cor-texto-sec)',
        tracejado: false,
        marcador: ev.evento === 'lancamento' ? '⭐' : ev.evento === 'obra' ? '🔑' : undefined,
      })),
      ...this.fases.map((f, i) => ({
        label: f.nome || `Fase ${i + 1}`,
        inicio: Number(f.inicio_mes ?? 0),
        duracao: Number(f.duracao_meses ?? 12),
        cor: corFaseExtra(i),
        tracejado: true,
        marcador: undefined,
      })),
    ];

    if (todasLinhas.length === 0) return html``;

    const fim = Math.max(...todasLinhas.map((l) => l.inicio + l.duracao - 1), 1);
    const W = 800;
    const padL = 130;
    const padR = 20;
    const rowH = 26;
    const topo = 8;
    const eixoH = 22;
    const H = topo + todasLinhas.length * rowH + eixoH;

    const escala = (mes: number) => padL + (fim > 0 ? (mes / fim) : 0) * (W - padL - padR);
    const largura = (dur: number) => Math.max((dur / Math.max(fim, 1)) * (W - padL - padR), 4);

    const passo = Math.max(3, Math.ceil(fim / 8 / 3) * 3);
    const ticks: number[] = [];
    for (let m = 0; m <= fim; m += passo) ticks.push(m);

    const corTexto = 'var(--cor-texto-sec, #8a8f98)';
    const corGrade = 'var(--cor-borda-sutil, rgba(128,128,128,0.25))';

    return html`
      <div class="gantt-wrap" role="img" aria-label="Gantt do cronograma">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
          ${ticks.map((m) => svg`
            <line x1=${escala(m)} y1=${topo} x2=${escala(m)} y2=${H - eixoH} stroke=${corGrade} stroke-width="1" />
            <text x=${escala(m)} y=${H - 6} font-size="10" fill=${corTexto} text-anchor="middle">
              ${rotuloMesRelativo(dataInicio, m)}
            </text>`)}
          ${todasLinhas.map((linha, i) => {
            const y = topo + i * rowH;
            const x = escala(linha.inicio);
            const w = largura(linha.duracao);
            const { cor, tracejado, marcador } = linha;
            const umMes = linha.duracao <= 1;
            const xFim = x + w;

            return svg`
              <text x=${padL - 8} y=${y + rowH / 2 + 4} font-size="11" fill=${corTexto} text-anchor="end">
                ${linha.label}
              </text>
              ${umMes && !tracejado
                ? svg`
                  <circle cx=${x + 4} cy=${y + rowH / 2} r="6" fill=${cor} />
                  ${marcador === '⭐' ? svg`
                    <text x=${x - 4} y=${y + rowH / 2 + 4} font-size="13" text-anchor="end"
                      dominant-baseline="middle">⭐</text>` : nothing}`
                : svg`
                  <rect x=${x} y=${y + 6} width=${w} height=${rowH - 12} rx="3" fill=${cor}
                    opacity=${tracejado ? '0.55' : '0.9'}
                    stroke=${tracejado ? cor : 'none'} stroke-width=${tracejado ? '1.5' : '0'}
                    stroke-dasharray=${tracejado ? '4 3' : 'none'} />
                  ${marcador === '🔑' ? svg`
                    <text x=${xFim + 4} y=${y + rowH / 2 + 4} font-size="12"
                      dominant-baseline="middle">🔑</text>` : nothing}
                  ${marcador === '⭐' ? svg`
                    <text x=${x - 4} y=${y + rowH / 2 + 4} font-size="13" text-anchor="end"
                      dominant-baseline="middle">⭐</text>` : nothing}`}
            `;
          })}
        </svg>
      </div>
    `;
  }
}

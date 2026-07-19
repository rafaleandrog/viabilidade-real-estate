import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import {
  rotuloMesRelativo, EVENTO_LABEL,
  vgvLinha, areaPrivativaTotalLinhas, resolverCustoTotal, type EventoCrono, type ContextoCusto,
} from './fluxo-shared.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado, listarReceitasAvancado,
  listarCurvas, listarCustosAvancado, criarCustoAvancado, atualizarCustoAvancado, removerCustoAvancado,
} from './viabilidade-api.js';
import './viab-num.js';

// Sub-tela "Custos" do Fluxo de Caixa (nível Avançado): três seções fixas
// (Terreno / Obra / Indiretos) com linhas de custo editáveis inline —
// categoria/subcategoria, orçamento (unidade + valor), curva de distribuição e
// ancoragem no cronograma. Nada aqui toca o estudo Preliminar.

interface Grupo {
  id: 'terreno' | 'obra' | 'indireto';
  titulo: string;
  subtitulo: string;
  eventoPadrao: string;
}

const GRUPOS: Grupo[] = [
  { id: 'terreno', titulo: 'Custos do Terreno', subtitulo: 'Aquisição do terreno, permutas e estruturas de pagamento', eventoPadrao: 'planejamento' },
  { id: 'obra', titulo: 'Custos de Obra (Custos Diretos)', subtitulo: 'Custos de construção e desenvolvimento físico', eventoPadrao: 'obra' },
  { id: 'indireto', titulo: 'Custos Indiretos', subtitulo: 'Custos pré-desenvolvimento e administrativos do projeto', eventoPadrao: 'planejamento' },
];

// Categorias e subcategorias por grupo (spec §5B). Categoria "Outro" libera
// texto livre na subcategoria.
const CATEGORIAS: Record<string, { nome: string; subs: string[] }[]> = {
  terreno: [
    { nome: 'Preço', subs: ['Valor à vista', 'Permuta', 'Parcelado', 'Outro'] },
    { nome: 'Outorga', subs: [] },
    { nome: 'Registro', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
  obra: [
    { nome: 'Obra', subs: [] },
    { nome: 'Decoração', subs: [] },
    { nome: 'Gestão da obra', subs: [] },
    { nome: 'Contingência', subs: [] },
    { nome: 'Outro', subs: [] },
  ],
  indireto: [
    { nome: 'Projetos', subs: ['Arquitetura', 'Estrutural', 'Instalações', 'Outro'] },
    { nome: 'Licenças', subs: ['Alvarás', 'Aprovações', 'Outro'] },
    { nome: 'Marketing', subs: ['Publicidade', 'Stand de vendas', 'Outro'] },
    { nome: 'Administração', subs: ['Administrativo', 'Jurídico', 'Outro'] },
    { nome: 'Outro', subs: [] },
  ],
};

const UNIDADES = [
  { valor: 'rs', rotulo: 'R$' },
  { valor: 'rs_m2_priv', rotulo: 'R$/m² priv' },
  { valor: 'rs_m2_terreno', rotulo: 'R$/m² terreno' },
  { valor: 'pct_vgv', rotulo: '% VGV' },
  { valor: 'pct_receita', rotulo: '% Receita' },
];

const EVENTOS_ANCORA = [
  { valor: 'planejamento', rotulo: 'Planejamento' },
  { valor: 'pre_lancamento', rotulo: 'Pré-lançamento' },
  { valor: 'obra', rotulo: 'Obra' },
  { valor: 'pos_obra', rotulo: 'Pós-obra' },
  { valor: 'customizado', rotulo: 'Customizado' },
];

@customElement('viab-fluxo-custos')
export class ViabFluxoCustos extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private custos: any[] = [];
  @state() private curvas: any[] = [];
  @state() private crono: EventoCrono[] = [];
  @state() private dataInicio: string | null = null;
  @state() private carregando = true;
  @state() private removerAlvo: any = null;
  private ctxCusto: ContextoCusto = { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 0 };
  private carregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .secoes { display: flex; flex-direction: column; gap: 16px; }
    .card-cab { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .card-cab .titulos { flex: 1; }
    .card-cab h3 { margin: 0; }
    .card-cab p { margin: 2px 0 0; }
    .rodape-custo { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-top: 10px; }
    .rodape-custo .espaco { flex: 1; }
    .total-rotulo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: var(--texto-rotulo, 0.75rem); margin-right: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .total-valor { font-weight: 600; font-variant-numeric: tabular-nums; }
    .orc { display: inline-flex; gap: 6px; align-items: center; }
    .orc urbi-select { min-width: 120px; }
    .orc viab-num { width: 130px; }
    .mes-calc { white-space: nowrap; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .campo-mes { display: inline-flex; align-items: center; gap: 4px; }
    .campo-mes viab-num { width: 100px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  `];

  updated() {
    if (this.estudo?.id && !this.carregado) {
      this.carregado = true;
      this._carregar();
    }
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const [custos, curvas, crono, params, receitas] = await Promise.all([
        listarCustosAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
        listarReceitasAvancado(this.estudo.id),
      ]);
      if (!custos?.erro) this.custos = custos.dados || [];
      if (!curvas?.erro) this.curvas = curvas.dados || [];
      if (!crono?.erro) this.crono = crono.dados || [];
      if (!params?.erro) this.dataInicio = params.data_inicio_projeto ?? null;
      const linhas = receitas?.erro ? [] : (receitas.dados || []);
      this.ctxCusto = {
        areaPrivativaTotal: areaPrivativaTotalLinhas(linhas),
        areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
        vgvTotal: linhas.reduce((s: number, l: any) => s + vgvLinha(l.tipologias), 0),
      };
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar custos', 'erro');
    }
    this.carregando = false;
  }

  render() {
    if (this.carregando) return html`<urbi-loading mensagem="Carregando custos..."></urbi-loading>`;
    return html`
      <div class="secoes">
        ${GRUPOS.map((g) => this._renderGrupo(g))}
      </div>
      ${this.removerAlvo ? this._renderConfirmRemover() : nothing}
    `;
  }

  private _renderGrupo(g: Grupo): TemplateResult {
    const linhas = this.custos.filter((c) => c.grupo === g.id);
    const total = linhas.reduce((s, c) => s + resolverCustoTotal(c, this.ctxCusto), 0);
    return html`
      <urbi-card>
        <div class="card-cab">
          <div class="titulos">
            <h3>${g.titulo}</h3>
            <p class="sec">${g.subtitulo}</p>
          </div>
          <urbi-botao variante="secundario" pequeno desabilitado icone="fa-solid fa-upload"
            title="Em breve">Importar Planilha</urbi-botao>
        </div>

        <urbi-tabela
          expandir
          .colunas=${this._colunas(g)}
          .linhas=${linhas}
          mensagem-vazio="Nenhum custo nesta seção."
        ></urbi-tabela>

        <div class="rodape-custo">
          ${this.editavel ? html`
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus"
              @click=${() => this._adicionar(g)}>Adicionar Custo</urbi-botao>` : nothing}
          <span class="espaco"></span>
          <span><span class="total-rotulo">Total ${g.titulo}</span><span class="total-valor">${fmtR$(total)}</span></span>
        </div>
      </urbi-card>
    `;
  }

  private _colunas(g: Grupo) {
    const dis = !this.editavel;
    const cats = CATEGORIAS[g.id];
    const colunas: any[] = [
      {
        id: 'categoria', label: 'Categoria',
        render: (c: any) => html`
          <urbi-select placeholder="Selecione…"
            .valor=${c.categoria || ''}
            .opcoes=${cats.map((x) => ({ valor: x.nome, rotulo: x.nome }))}
            @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { categoria: e.detail.valor, subcategoria: null })}
          ></urbi-select>`,
      },
      {
        id: 'subcategoria', label: 'Subcategoria',
        render: (c: any) => {
          const cat = cats.find((x) => x.nome === c.categoria);
          if (c.categoria === 'Outro') {
            return html`
              <urbi-input placeholder="Descreva…" ?desabilitado=${dis} .valor=${c.subcategoria || ''}
                @urbi:input-change=${(e: CustomEvent) => this._salvar(c, { subcategoria: e.detail.valor })}
              ></urbi-input>`;
          }
          if (!cat || cat.subs.length === 0) return html`<span class="sec">—</span>`;
          return html`
            <urbi-select placeholder="Selecione…"
              .valor=${c.subcategoria || ''}
              .opcoes=${cat.subs.map((s) => ({ valor: s, rotulo: s }))}
              @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { subcategoria: e.detail.valor })}
            ></urbi-select>`;
        },
      },
      {
        id: 'orcamento', label: 'Orçamento',
        render: (c: any) => html`
          <span class="orc">
            <urbi-select .valor=${c.orcamento_unidade || 'rs'} .opcoes=${UNIDADES}
              @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { orcamento_unidade: e.detail.valor })}
            ></urbi-select>
            <viab-num ?desabilitado=${dis}
              .valor=${c.orcamento_valor !== null && c.orcamento_valor !== undefined ? Number(c.orcamento_valor) : null}
              @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(c, { orcamento_valor: e.detail.valor })}
            ></viab-num>
          </span>`,
      },
      {
        id: 'distribuicao', label: 'Distribuição',
        render: (c: any) => html`
          <urbi-select
            .valor=${c.curva_id ? String(c.curva_id) : ''}
            .opcoes=${[{ valor: '', rotulo: 'Linear' },
              ...this.curvas.map((k) => ({ valor: String(k.id), rotulo: k.nome }))]}
            @urbi:select-change=${(e: CustomEvent) =>
              this._salvar(c, { curva_id: e.detail.valor ? Number(e.detail.valor) : null })}
          ></urbi-select>`,
      },
      {
        id: 'cronograma', label: 'Cronograma',
        render: (c: any) => html`
          <urbi-select .valor=${c.cronograma_evento || 'customizado'} .opcoes=${EVENTOS_ANCORA}
            @urbi:select-change=${(e: CustomEvent) => this._salvar(c, { cronograma_evento: e.detail.valor })}
          ></urbi-select>`,
      },
      {
        id: 'inicio', label: 'Início',
        render: (c: any) => {
          const custom = (c.cronograma_evento || 'customizado') === 'customizado';
          if (!custom) {
            return html`<span class="mes-calc">📅 ${rotuloMesRelativo(this.dataInicio, Number(c.inicio_mes))}
              <span title=${`Ancorado em ${EVENTO_LABEL[c.cronograma_evento] || c.cronograma_evento}`}>🔒</span></span>`;
          }
          return html`
            <span class="campo-mes">📅
              <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis}
                .valor=${Number(c.inicio_mes) || 1}
                @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(c, { inicio_mes: e.detail.valor })}
              ></viab-num>
            </span>`;
        },
      },
      {
        id: 'duracao', label: 'Duração',
        render: (c: any) => html`
          <span class="campo-mes">🕐
            <viab-num casas-decimais="0" sufixo="meses" ?desabilitado=${dis}
              .valor=${Number(c.duracao_meses) || 1}
              @urbi:input-numero-change=${(e: CustomEvent) => this._salvar(c, { duracao_meses: e.detail.valor })}
            ></viab-num>
          </span>`,
      },
    ];
    if (!dis) {
      colunas.push({
        id: 'acoes', label: '',
        render: (c: any) => html`
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
            @click=${() => { this.removerAlvo = c; }}>Remover</urbi-botao>`,
      });
    }
    return colunas;
  }

  private async _adicionar(g: Grupo) {
    try {
      const res = await criarCustoAvancado(this.estudo.id, {
        grupo: g.id,
        cronograma_evento: g.eventoPadrao,
        ordem: this.custos.filter((c) => c.grupo === g.id).length,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar custo', 'erro'); return; }
      this.custos = [...this.custos, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar custo', 'erro');
    }
  }

  private async _salvar(c: any, dados: Record<string, any>) {
    if (!this.editavel) return;
    try {
      const res = await atualizarCustoAvancado(this.estudo.id, c.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
      // Resposta traz início/duração reancorados quando o evento muda.
      this.custos = this.custos.map((x) => (x.id === c.id ? { ...x, ...dados, ...res } : x));
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar', 'erro');
    }
  }

  private _renderConfirmRemover(): TemplateResult {
    const c = this.removerAlvo;
    return html`
      <urbi-modal title="Remover custo" maxWidth="420px" @urbi-modal:close=${() => this.removerAlvo = null}>
        <p>Remover o custo <strong>${c.categoria || 'sem categoria'}${c.subcategoria ? ` — ${c.subcategoria}` : ''}</strong>?</p>
        <div class="form-acoes">
          <urbi-botao variante="fantasma" @click=${() => this.removerAlvo = null}>Cancelar</urbi-botao>
          <urbi-botao variante="perigo" @click=${this._confirmarRemocao}>Remover</urbi-botao>
        </div>
      </urbi-modal>
    `;
  }

  private _confirmarRemocao = async () => {
    const c = this.removerAlvo;
    this.removerAlvo = null;
    try {
      const res = await removerCustoAvancado(this.estudo.id, c.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      this.custos = this.custos.filter((x) => x.id !== c.id);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };
}

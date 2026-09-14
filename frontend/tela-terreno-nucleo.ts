import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtNum } from './viab-format.js';
import {
  urbiVerso, listarGlebasNucleo, listarLotesNucleo, listarParcelamentosNucleo,
  buscarImovelNucleo, vincularImovel, desvincularImovel, atualizarEstudo,
} from './viabilidade-api.js';

// Seleção do terreno vindo do Núcleo (§4.1/§6.6).
//   Loteamento   → 1 gleba (single-select)
//   Incorporação → 1+ lotes (multi-select)
// O único dado consumido do Núcleo é a ÁREA (+ id_legível para exibição). A área
// somada é persistida em `estudos.area_terreno_nucleo` para a Proforma consumir
// em todas as telas (a engine calcula sobre o objeto estudo). Só editável em
// Rascunho por editor+ (o backend de vínculo reforça). Degrada com banner quando
// a flag de leitura do Núcleo não está concedida (403) — a app não quebra.
//
// A área autoritativa vem sempre de GET /imoveis/:id (a área é atributo do
// supertipo `imoveis`; a listagem de subtipo pode não trazê-la). A listagem de
// glebas/lotes serve só para o seletor de candidatos (rótulo = id_legivel).
//
// Filtro de lotes (Incorporação só): "regularização fundiária" é o booleano
// `parcelamentos.regularizacao` no Núcleo, não uma coluna de lote/imóvel — o
// lote herda isso via `parcelamento_id`. O Núcleo não tem filtro server-side
// por essa coluna (camposFiltro de /lotes não faz join até parcelamentos), então
// resolvemos o conjunto de ids "de regularização" à parte e filtramos no
// cliente. Como a exclusão acontece depois da paginação do servidor, a
// navegação por número de página deixa de fazer sentido (uma "página" pode vir
// com menos itens do que pedimos) — o seletor de lote acumula em lotes de 200
// (teto do Núcleo) com um botão "Carregar mais", em vez de Anterior/Próxima.
// Loteamento (glebas) não usa nada disso e mantém a paginação numérica antiga.

interface ImovelVinculado { vinculoId: number; imovelId: number; rotulo: string; area: number; }
interface OpcaoCandidato { valor: string; rotulo: string; }

const POR_PAGINA_GLEBA = 50;
const POR_PAGINA_LOTE = 200; // teto de paginação do Núcleo (docs/shell/nucleo.md § Paginação)
const DEBOUNCE_BUSCA_MS = 400;

@customElement('viab-terreno-nucleo')
export class ViabTerrenoNucleo extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private carregando = true;
  @state() private disponivel = true;
  @state() private motivo = '';
  @state() private opcoes: OpcaoCandidato[] = [];
  @state() private vinculados: ImovelVinculado[] = [];
  @state() private salvando = false;

  // Paginação numérica — só usada pelo ramo Loteamento (gleba).
  @state() private _pagina = 1;
  @state() private _totalItens = 0;

  // Acumulação — só usada pelo ramo Incorporação (lote).
  @state() private _loteCursor = 1;
  @state() private _loteTemMais = false;
  @state() private _loteTotalBruto = 0;
  @state() private _carregandoMais = false;
  @state() private _busca = '';
  private _buscaDebounce: ReturnType<typeof setTimeout> | null = null;

  // Conjunto de ids de parcelamento com regularizacao=true (Incorporação só).
  // null = ainda não resolvido; undefined de fetch (indisponível) não bloqueia
  // o seletor, só desliga o filtro com um aviso.
  @state() private _idsRegularizacao: Set<number> | null = null;
  @state() private _regularizacaoIndisponivel = false;
  // Promise em voo de `_carregarIdsRegularizacao()`, para as duas corridas do
  // primeiro mount (connectedCallback + updated()) ESPERAREM A MESMA busca em
  // vez de disparar duas e escrever `_idsRegularizacao`/`_regularizacaoIndisponivel`
  // sem guarda de sequência — a mais lenta das duas sobrescrevia o resultado
  // da mais rápida, mesmo já descartada pelo `_cargaSeq`. Achado do Codex no
  // PR #697.
  private _idsRegularizacaoPromise: Promise<void> | null = null;

  static styles = [estiloConteudo, css`
    .lista { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .item .nome { font-size: var(--texto-corpo, 0.8125rem); }
    .item .area { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-variant-numeric: tabular-nums; }
    .total { display: flex; justify-content: space-between; margin-top: 8px; font-weight: 600; }
    .add { display: flex; gap: 8px; align-items: flex-end; margin-top: 12px; }
    .add urbi-select { flex: 1; min-width: 180px; }
    .busca { display: block; width: 100%; min-height: 32px; box-sizing: border-box; margin-top: 12px; }
    urbi-banner { margin-bottom: 12px; }
    .pag-info { display: block; margin-top: 8px; font-size: 0.75rem; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
    .pag-btns { display: flex; gap: 8px; margin-top: 8px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }
  updated(ch: Map<string, unknown>) {
    // `1`, sempre — o ramo lote ignora este argumento (reseta o próprio
    // cursor em `_carregar`), mas o ramo gleba usa `paginaGleba` como
    // default de `_carregar()`. Sem o `1` explícito, trocar de estudo
    // enquanto o seletor de gleba está na página 3 pedia a página 3 do
    // estudo NOVO em vez de voltar para a 1.
    if (ch.has('estudo')) this._carregar(1);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._buscaDebounce) { clearTimeout(this._buscaDebounce); this._buscaDebounce = null; }
  }

  private get _ehLoteamento(): boolean {
    return this.estudo?.tipo_empreendimento === 'loteamento';
  }
  private get _subtipo(): string { return this._ehLoteamento ? 'gleba' : 'lote'; }
  private get _vinculos(): any[] { return this.estudo?.imoveis ?? []; }

  // `connectedCallback()` chama `_carregar()` e a primeira atribuição de
  // `estudo` (o Lit conta null→objeto como mudança) dispara `updated()`, que
  // chama de novo — as DUAS corridas acontecem sempre no primeiro mount. Para
  // o ramo gleba isso é inofensivo (cada chamada SUBSTITUI `this.opcoes`),
  // mas o ramo lote ACUMULA (`[...this.opcoes, ...novas]`) — sem guarda, as
  // duas corridas resolvem uma depois da outra e duplicam cada lote na lista.
  // Medido: sem este contador, o seletor mostrava "L2-OK" duas vezes.
  private _cargaSeq = 0;

  private async _carregar(paginaGleba = this._pagina) {
    if (!this.estudo) return;
    const seq = ++this._cargaSeq;
    this.carregando = true;
    this.disponivel = true;
    this.motivo = '';
    try {
      if (this._ehLoteamento) {
        const lista = await listarGlebasNucleo('', paginaGleba, POR_PAGINA_GLEBA);
        if (seq !== this._cargaSeq) return;
        this._totalItens = lista?.total ?? 0;
        this._pagina = paginaGleba;
        const usados = new Set(this._vinculos.map((v) => Number(v.imovel_nucleo_id)));
        this.opcoes = (lista?.dados ?? [])
          .filter((o: any) => !usados.has(Number(o.id)))
          .map((o: any) => ({ valor: String(o.id), rotulo: o.id_legivel || `#${o.id}` }));
      } else {
        if (this._idsRegularizacao === null) {
          this._idsRegularizacaoPromise ??= this._carregarIdsRegularizacao();
          await this._idsRegularizacaoPromise;
        }
        if (seq !== this._cargaSeq) return;
        this._loteCursor = 1;
        this.opcoes = [];
        await this._carregarLotes({ reiniciar: true, seq });
        if (seq !== this._cargaSeq) return;
      }
      // Detalhe autoritativo (área) dos imóveis já vinculados.
      const vinculados = await this._resolverVinculados(this._vinculos);
      if (seq !== this._cargaSeq) return;
      this.vinculados = vinculados;
    } catch (e: any) {
      if (seq !== this._cargaSeq) return;
      this.disponivel = false;
      this.motivo = e?.message || 'Indisponível';
    }
    if (seq === this._cargaSeq) this.carregando = false;
  }

  // Resolve o conjunto de parcelamentos "de regularização fundiária" uma vez
  // (não repete por lote/página). Pagina em laço até a página vir incompleta —
  // o Núcleo não tem "trazer tudo" (docs/shell/nucleo.md § Paginação).
  private async _carregarIdsRegularizacao(): Promise<void> {
    const ids = new Set<number>();
    try {
      let pagina = 1;
      for (;;) {
        const lista = await listarParcelamentosNucleo(pagina, POR_PAGINA_LOTE);
        const dados: any[] = lista?.dados ?? [];
        for (const p of dados) if (p?.regularizacao) ids.add(Number(p.id));
        const totalPaginas = Number(lista?.paginas) || 1;
        if (dados.length < POR_PAGINA_LOTE || pagina >= totalPaginas) break;
        pagina += 1;
      }
      this._idsRegularizacao = ids;
      this._regularizacaoIndisponivel = false;
    } catch {
      // Não bloqueia o seletor de lote por causa disto — só desliga o filtro
      // NESTA passada. Não grava um Set aqui: `_idsRegularizacao` fica
      // `null`, que é o mesmo gatilho de "ainda não carregado" usado em
      // `_carregar()` — uma falha transitória (rede, 5xx) não trava o filtro
      // desligado para sempre; a próxima `_carregar()` (troca de estudo,
      // por exemplo) tenta de novo, em vez de ficar presa ao resultado da
      // primeira tentativa pela vida inteira do componente.
      this._regularizacaoIndisponivel = true;
    } finally {
      this._idsRegularizacaoPromise = null;
    }
  }

  // Busca e acumula o próximo lote de candidatos (Incorporação). `reiniciar`
  // zera a acumulação antes de buscar (troca de busca por texto ou de estudo).
  // `seq` é o mesmo contador de `_carregar()` — sem checá-lo de novo aqui
  // (não só no chamador), uma corrida que passou pelo `if (seq !== ...)` de
  // `_carregar()` mas ainda está com este `await` em voo escreveria por cima
  // do resultado de uma corrida mais nova de qualquer forma.
  private async _carregarLotes(opts: { reiniciar?: boolean; seq?: number } = {}): Promise<void> {
    const seq = opts.seq ?? this._cargaSeq;
    if (opts.reiniciar) {
      this._loteCursor = 1;
      this.opcoes = [];
      // Some com "Carregar mais" enquanto a página 1 da busca nova está em
      // voo — sem isto, o botão da busca ANTERIOR fica visível e clicável
      // nessa janela; um clique nele dispara `_carregarMaisLotes()` lendo o
      // MESMO `_loteCursor` (1) e o MESMO `seq` da busca em andamento, e as
      // duas chamadas pedem a página 1 duas vezes, duplicam candidatos e
      // avançam o cursor duas vezes — a "próxima" página pula a 2. Achado do
      // Codex no PR #697.
      this._loteTemMais = false;
    }
    const lista = await listarLotesNucleo(this._busca, this._loteCursor, POR_PAGINA_LOTE);
    if (seq !== this._cargaSeq) return;
    const dados: any[] = lista?.dados ?? [];
    this._loteTotalBruto = Number(lista?.total) || 0;
    const totalPaginas = Number(lista?.paginas) || 1;
    // `<`, não `===` contra `POR_PAGINA_LOTE` — o Núcleo clampeia
    // `por_pagina` acima do teto silenciosamente (docs/shell/nucleo.md §
    // Paginação); se o teto real cair abaixo do que este arquivo pede, uma
    // igualdade estrita nunca mais bateria e "tem mais" ficaria preso em
    // falso para sempre, mesmo havendo mais páginas. Mesmo critério de
    // `_carregarIdsRegularizacao` (linha acima no arquivo).
    this._loteTemMais = this._loteCursor < totalPaginas;
    const usados = new Set(this._vinculos.map((v) => Number(v.imovel_nucleo_id)));
    const idsReg = this._idsRegularizacao ?? new Set<number>();
    const novas = dados
      .filter((o: any) => !usados.has(Number(o.id)))
      .filter((o: any) => !idsReg.has(Number(o.parcelamento_id)))
      .map((o: any) => ({ valor: String(o.id), rotulo: o.id_legivel || `#${o.id}` }));
    this.opcoes = [...this.opcoes, ...novas];
    this._loteCursor += 1;
  }

  private async _carregarMaisLotes() {
    if (this._carregandoMais || !this._loteTemMais) return;
    this._carregandoMais = true;
    const seq = this._cargaSeq;
    try {
      await this._carregarLotes({ seq });
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar mais lotes', 'erro');
    } finally {
      this._carregandoMais = false;
    }
  }

  private _onBuscaInput(texto: string) {
    this._busca = texto;
    if (this._buscaDebounce) clearTimeout(this._buscaDebounce);
    this._buscaDebounce = setTimeout(() => {
      this._buscaDebounce = null;
      // Bump do contador: invalida qualquer `_carregar()`/`_carregarLotes()`
      // ainda em voo de ANTES da busca — sem isto, uma resposta lenta do
      // carregamento inicial poderia chegar depois e sobrescrever o
      // resultado da busca do usuário.
      const seq = ++this._cargaSeq;
      // Sem `.catch`, uma rejeição de `/lotes` aqui virava rejeição não
      // tratada: `reiniciar:true` já zerou `this.opcoes`, e sem aviso nem
      // novo estado o seletor ficava vazio, em silêncio. Achado do Codex no
      // PR #697 — mesmo tratamento que `_carregarMaisLotes` já tinha.
      this._carregarLotes({ reiniciar: true, seq }).catch((e: any) => {
        urbiVerso.notificar(e?.message || 'Erro ao buscar lotes', 'erro');
      });
    }, DEBOUNCE_BUSCA_MS);
  }

  private _totalPaginas(): number {
    return Math.max(1, Math.ceil(this._totalItens / POR_PAGINA_GLEBA));
  }

  private async _resolverVinculados(vinculos: any[]): Promise<ImovelVinculado[]> {
    const out: ImovelVinculado[] = [];
    for (const v of vinculos) {
      const imovelId = Number(v.imovel_nucleo_id);
      try {
        const im = await buscarImovelNucleo(imovelId);
        out.push({ vinculoId: v.id, imovelId, rotulo: im?.id_legivel || `#${imovelId}`, area: Number(im?.area) || 0 });
      } catch {
        out.push({ vinculoId: v.id, imovelId, rotulo: `#${imovelId}`, area: 0 });
      }
    }
    return out;
  }

  private _areaTotal(): number {
    return this.vinculados.reduce((s, v) => s + v.area, 0);
  }

  // Recalcula a área somada (autoritativa) dos imóveis informados, persiste em
  // area_terreno_nucleo e avisa o pai para recarregar o estudo.
  private async _sincronizar(imovelIds: number[]) {
    let total = 0;
    for (const id of imovelIds) {
      try { total += Number((await buscarImovelNucleo(id))?.area) || 0; } catch { /* ignora */ }
    }
    await atualizarEstudo(this.estudo.id, { area_terreno_nucleo: total });
    this.dispatchEvent(new CustomEvent('viab:terreno-alterado', { bubbles: true, composed: true }));
  }

  private async _adicionar(imovelId: number) {
    if (!imovelId || this.salvando) return;
    this.salvando = true;
    try {
      const res = await vincularImovel(this.estudo.id, imovelId, this._subtipo);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao vincular', 'erro'); return; }
      const ids = [...this._vinculos.map((v) => Number(v.imovel_nucleo_id)), imovelId];
      await this._sincronizar(ids);
      urbiVerso.notificar(this._ehLoteamento ? 'Gleba vinculada.' : 'Lote vinculado.', 'sucesso');
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao vincular', 'erro');
    } finally {
      this.salvando = false;
    }
  }

  private async _remover(vinculado: ImovelVinculado) {
    if (this.salvando) return;
    this.salvando = true;
    try {
      const res = await desvincularImovel(this.estudo.id, vinculado.vinculoId);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao desvincular', 'erro'); return; }
      const ids = this._vinculos
        .map((v) => Number(v.imovel_nucleo_id))
        .filter((id) => id !== vinculado.imovelId);
      await this._sincronizar(ids);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao desvincular', 'erro');
    } finally {
      this.salvando = false;
    }
  }

  render() {
    if (!this.estudo) return nothing;
    if (this.carregando) return html`<urbi-loading mensagem="Carregando imóveis do Núcleo..."></urbi-loading>`;

    if (!this.disponivel) {
      return html`
        <urbi-banner variante="alerta">
          Integração com o Núcleo indisponível ou sem permissão de leitura (${this.motivo}).
          Um administrador pode liberar em <strong>Admin → Apps → viabilidade → Núcleo</strong>,
          ou use o modo <strong>“Inserir novo (manual)”</strong>.
        </urbi-banner>
        ${this._vinculos.length
          ? html`<div class="lista">
              ${this._vinculos.map((v) => html`<div class="item"><span class="nome">#${v.imovel_nucleo_id}</span></div>`)}
            </div>`
          : nothing}
      `;
    }

    return html`
      ${this.vinculados.length === 0
        ? html`<urbi-estado-vazio icone="fa-solid fa-map-location-dot"
            mensagem=${this._ehLoteamento
              ? 'Nenhuma gleba vinculada. Selecione a gleba do estudo abaixo.'
              : 'Nenhum lote vinculado. Adicione os lotes do estudo abaixo.'}></urbi-estado-vazio>`
        : html`
          <div class="lista">
            ${this.vinculados.map((v) => html`
              <div class="item">
                <span class="nome">${v.rotulo}</span>
                <span class="area">${fmtNum(v.area)} m²</span>
                ${this.editavel
                  ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-xmark"
                      ?carregando=${this.salvando} @click=${() => this._remover(v)}>Remover</urbi-botao>`
                  : nothing}
              </div>`)}
          </div>
          <div class="total"><span>Área total do terreno</span><span>${fmtNum(this._areaTotal())} m²</span></div>
        `}

      ${this.editavel ? this._renderAdd() : nothing}
    `;
  }

  private _renderAdd(): TemplateResult {
    return this._ehLoteamento ? this._renderAddGleba() : this._renderAddLote();
  }

  private _renderAddGleba(): TemplateResult {
    // Loteamento: 1 gleba só — some o seletor quando já há uma.
    if (this.vinculados.length >= 1) {
      return html`<p class="sec">Loteamento admite exatamente 1 gleba. Remova a atual para trocar.</p>`;
    }
    const totalPag = this._totalPaginas();
    const paginacaoInfo = this._totalItens > 0
      ? html`<span class="pag-info">Página ${this._pagina} de ${totalPag} (${this._totalItens} glebas)</span>`
      : nothing;
    const paginacaoBotoes = totalPag > 1 ? html`
      <div class="pag-btns">
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-chevron-left"
          ?desabilitado=${this._pagina <= 1 || this.salvando || this.carregando}
          @click=${() => this._carregar(this._pagina - 1)}>Anterior</urbi-botao>
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-chevron-right"
          ?desabilitado=${this._pagina >= totalPag || this.salvando || this.carregando}
          @click=${() => this._carregar(this._pagina + 1)}>Próxima</urbi-botao>
      </div>` : nothing;
    if (this.opcoes.length === 0) {
      return html`
        <p class="sec">Nenhuma gleba disponível nesta página para vincular.</p>
        ${paginacaoInfo}${paginacaoBotoes}
      `;
    }
    return html`
      <div class="add">
        <urbi-select
          label="Gleba"
          placeholder="Selecionar gleba…"
          pesquisavel
          .valor=${''}
          .opcoes=${this.opcoes}
          ?desabilitado=${this.salvando}
          @urbi:select-change=${(e: CustomEvent) => this._adicionar(parseInt(e.detail?.valor))}
        ></urbi-select>
      </div>
      ${paginacaoInfo}${paginacaoBotoes}
    `;
  }

  private _renderAddLote(): TemplateResult {
    const busca = html`
      <urbi-input class="busca" label="Buscar lote" placeholder="Número, quadra, conjunto ou rua…"
        .valor=${this._busca}
        @urbi:input-change=${(e: CustomEvent) => this._onBuscaInput(e.detail?.valor ?? '')}
      ></urbi-input>
      ${this._regularizacaoIndisponivel
        ? html`<urbi-banner variante="alerta">
            Não foi possível conferir a classificação de regularização fundiária no Núcleo — a
            lista abaixo não está filtrada por essa regra.
          </urbi-banner>`
        : nothing}
    `;
    const carregarMaisBtn = this._loteTemMais ? html`
      <div class="pag-btns">
        <urbi-botao variante="secundario" pequeno icone="fa-solid fa-arrow-down"
          ?carregando=${this._carregandoMais}
          ?desabilitado=${this.salvando}
          @click=${() => this._carregarMaisLotes()}>Carregar mais</urbi-botao>
      </div>` : nothing;
    const info = html`<span class="pag-info">
      ${this.opcoes.length} lote${this.opcoes.length === 1 ? '' : 's'} elegível(is) carregado(s)
      (de ${this._loteTotalBruto} no Núcleo, sem excluir regularização fundiária)
    </span>`;
    if (this.opcoes.length === 0) {
      return html`
        ${busca}
        <p class="sec">Nenhum lote disponível para vincular${this._busca ? ' com esse filtro' : ''}.</p>
        ${info}${carregarMaisBtn}
      `;
    }
    return html`
      ${busca}
      <div class="add">
        <urbi-select
          label="Adicionar lote"
          placeholder="Selecionar lote…"
          pesquisavel
          .valor=${''}
          .opcoes=${this.opcoes}
          ?desabilitado=${this.salvando}
          @urbi:select-change=${(e: CustomEvent) => this._adicionar(parseInt(e.detail?.valor))}
        ></urbi-select>
      </div>
      ${info}${carregarMaisBtn}
    `;
  }
}

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtNum } from './viab-format.js';
import {
  urbiVerso, listarGlebasNucleo, listarLotesNucleo, buscarImovelNucleo,
  vincularImovel, desvincularImovel, atualizarEstudo,
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

interface ImovelVinculado { vinculoId: number; imovelId: number; rotulo: string; area: number; }

@customElement('viab-terreno-nucleo')
export class ViabTerrenoNucleo extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private carregando = true;
  @state() private disponivel = true;
  @state() private motivo = '';
  @state() private opcoes: { valor: string; rotulo: string }[] = [];
  @state() private vinculados: ImovelVinculado[] = [];
  @state() private salvando = false;

  static styles = [estiloConteudo, css`
    .lista { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .item .nome { font-size: var(--texto-corpo, 0.8125rem); }
    .item .area { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-variant-numeric: tabular-nums; }
    .total { display: flex; justify-content: space-between; margin-top: 8px; font-weight: 600; }
    .add { display: flex; gap: 8px; align-items: flex-end; margin-top: 12px; }
    .add urbi-select { flex: 1; min-width: 180px; }
    urbi-banner { margin-bottom: 12px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }
  updated(ch: Map<string, unknown>) {
    if (ch.has('estudo')) this._carregar();
  }

  private get _ehLoteamento(): boolean {
    return this.estudo?.tipo_empreendimento === 'loteamento';
  }
  private get _subtipo(): string { return this._ehLoteamento ? 'gleba' : 'lote'; }
  private get _vinculos(): any[] { return this.estudo?.imoveis ?? []; }

  private async _carregar() {
    if (!this.estudo) return;
    this.carregando = true;
    this.disponivel = true;
    this.motivo = '';
    try {
      // Candidatos para o seletor (rótulo apenas).
      const lista = this._ehLoteamento ? await listarGlebasNucleo() : await listarLotesNucleo();
      const usados = new Set(this._vinculos.map((v) => Number(v.imovel_nucleo_id)));
      this.opcoes = (lista?.dados ?? [])
        .filter((o: any) => !usados.has(Number(o.id)))
        .map((o: any) => ({ valor: String(o.id), rotulo: o.id_legivel || `#${o.id}` }));
      // Detalhe autoritativo (área) dos imóveis já vinculados.
      this.vinculados = await this._resolverVinculados(this._vinculos);
    } catch (e: any) {
      this.disponivel = false;
      this.motivo = e?.message || 'Indisponível';
    }
    this.carregando = false;
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
    // Loteamento: 1 gleba só — some o seletor quando já há uma.
    if (this._ehLoteamento && this.vinculados.length >= 1) {
      return html`<p class="sec">Loteamento admite exatamente 1 gleba. Remova a atual para trocar.</p>`;
    }
    if (this.opcoes.length === 0) {
      return html`<p class="sec">Nenhum ${this._subtipo} disponível no Núcleo para vincular.</p>`;
    }
    return html`
      <div class="add">
        <urbi-select
          label=${this._ehLoteamento ? 'Gleba' : 'Adicionar lote'}
          placeholder=${this._ehLoteamento ? 'Selecionar gleba…' : 'Selecionar lote…'}
          pesquisavel
          .valor=${''}
          .opcoes=${this.opcoes}
          ?desabilitado=${this.salvando}
          @urbi:select-change=${(e: CustomEvent) => this._adicionar(parseInt(e.detail?.valor))}
        ></urbi-select>
      </div>
    `;
  }
}

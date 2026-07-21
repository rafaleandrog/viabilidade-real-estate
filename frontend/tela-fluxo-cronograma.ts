import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { EVENTO_LABEL, EVENTO_COR, rotuloPeriodo, rotuloMesRelativo, parseMesAno } from './fluxo-shared.js';
import {
  urbiVerso,
  buscarParametrosAvancado, atualizarParametrosAvancado,
  buscarCronogramaAvancado, atualizarEventoCronograma,
} from './viabilidade-api.js';
import './viab-num.js';

// Cronograma do empreendimento — EXCLUSIVO do nível Avançado.
//
// Extraído da antiga aba única "Fluxo de Caixa" (viab-tela-fluxo) na
// reestruturação de abas do Lote 3 (#15). Passou a ser um componente
// standalone para ser hospedado na aba de topo "Empreendimento → Cronograma".
// A lógica (parâmetros do projeto + tabela de eventos + gráfico de Gantt) é a
// mesma de antes — só mudou de casa.
//
// A taxa de desconto (`taxa_desconto_aa`) foi REMOVIDA desta tela no Lote 4 (#16)
// — será realocada em outra aba (Financeiro, Lote 7). O valor persiste no schema
// e o motor usa o padrão (12% a.a.) até a realocação.
// Convenção de tempo do cronograma: mês 0-based (mês 0 = início do projeto).

@customElement('viab-fluxo-cronograma')
export class ViabFluxoCronograma extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private paramsForm: Record<string, any> = {};
  @state() private salvandoParams = false;
  @state() private crono: any[] = [];
  @state() private cronoCarregando = false;
  private cronoCarregado = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .params { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 8px; }
    .params urbi-input { width: 160px; }
    .params viab-num { width: 160px; }

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
    .ponto-cor { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: 1px; }
    .campo-mes { display: inline-flex; align-items: center; gap: 6px; }
    .campo-mes viab-num { width: 120px; }
    .cadeado { opacity: 0.7; font-size: 0.75rem; }
    td.periodo { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); white-space: nowrap; }

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
      const [params, crono] = await Promise.all([
        buscarParametrosAvancado(this.estudo.id),
        buscarCronogramaAvancado(this.estudo.id),
      ]);
      if (!params?.erro) this.paramsForm = { ...params };
      if (!crono?.erro) this.crono = crono.dados || [];
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

        <table class="crono">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Início</th>
              <th>Duração</th>
              <th>Período</th>
            </tr>
          </thead>
          <tbody>
            ${this.crono.map((ev) => this._linhaCronograma(ev, dataInicio, dis))}
          </tbody>
        </table>

        ${this._renderGantt(dataInicio)}
      </urbi-card>
    `;
  }

  private _linhaCronograma(ev: any, dataInicio: string | null, dis: boolean): TemplateResult {
    const travadoIni = Boolean(ev.travado_inicio);
    const travadoDur = Boolean(ev.travado_duracao);
    return html`
      <tr>
        <td class="evento">
          <span class="ponto-cor" style="background:${EVENTO_COR[ev.evento]}"></span>
          ${EVENTO_LABEL[ev.evento] || ev.evento}
        </td>
        <td>
          <span class="campo-mes">
            <span aria-hidden="true">📅</span>
            <viab-num casas-decimais="0" sufixo="º mês"
              ?desabilitado=${dis || travadoIni}
              .valor=${Number(ev.inicio_mes)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._salvarEvento(ev.evento, { inicio_mes: e.detail.valor })}
            ></viab-num>
            ${travadoIni ? html`<span class="cadeado" title="Calculado automaticamente" aria-label="Calculado automaticamente">🔒</span>` : nothing}
          </span>
        </td>
        <td>
          <span class="campo-mes">
            <span aria-hidden="true">🕐</span>
            <viab-num casas-decimais="0" sufixo="meses"
              ?desabilitado=${dis || travadoDur}
              .valor=${Number(ev.duracao_meses)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._salvarEvento(ev.evento, { duracao_meses: e.detail.valor })}
            ></viab-num>
            ${travadoDur ? html`<span class="cadeado" title="Duração fixa" aria-label="Duração fixa">🔒</span>` : nothing}
          </span>
        </td>
        <td class="periodo">${rotuloPeriodo(dataInicio, Number(ev.inicio_mes), Number(ev.duracao_meses))}</td>
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

  private async _salvarEvento(evento: string, dados: Record<string, any>) {
    const valor = Object.values(dados)[0];
    // inicio_mes pode ser 0 (mês 0 = início); duração < 1 é barrada no backend.
    if (valor === null || valor === undefined || Number(valor) < 0) return;
    try {
      const res = await atualizarEventoCronograma(this.estudo.id, evento, dados);
      if (res?.erro) {
        urbiVerso.notificar(res.mensagem || 'Erro ao salvar o cronograma', 'erro');
        this._carregarCronograma(); // restaura o estado persistido
        return;
      }
      this.crono = res.dados || this.crono;
      if (res.custos_reancorados > 0) {
        urbiVerso.notificar(`${res.custos_reancorados} linha(s) de custo reancorada(s) ao novo cronograma.`, 'info');
      }
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar o cronograma', 'erro');
      this._carregarCronograma();
    }
  }

  // Gantt simplificado em SVG puro (sem urbi-grafico-*): uma barra por evento,
  // eixo em meses relativos com rótulos mmm/AA quando há data de início.
  private _renderGantt(dataInicio: string | null): TemplateResult {
    if (this.crono.length === 0) return html``;
    const fim = Math.max(...this.crono.map((e) => Number(e.inicio_mes) + Number(e.duracao_meses) - 1), 1);
    const W = 800;
    const padL = 120;
    const padR = 16;
    const rowH = 26;
    const topo = 8;
    const eixoH = 22;
    const H = topo + this.crono.length * rowH + eixoH;
    // Meses 0-based: mês 0 no início do eixo, mês `fim` na borda direita.
    const escala = (mes: number) => padL + (fim > 0 ? (mes / fim) : 0) * (W - padL - padR);
    const largura = (dur: number) => Math.max((dur / Math.max(fim, 1)) * (W - padL - padR), 3);

    // Ticks do eixo: ~8 marcas espaçadas em múltiplos de 3 meses, a partir do mês 0.
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
          ${this.crono.map((ev, i) => {
            const y = topo + i * rowH;
            const x = escala(Number(ev.inicio_mes));
            const w = largura(Number(ev.duracao_meses));
            const cor = EVENTO_COR[ev.evento];
            const umMes = Number(ev.duracao_meses) <= 1;
            return svg`
              <text x=${padL - 8} y=${y + rowH / 2 + 3} font-size="11" fill=${corTexto} text-anchor="end">
                ${EVENTO_LABEL[ev.evento] || ev.evento}
              </text>
              ${umMes
                ? svg`<circle cx=${x + 4} cy=${y + rowH / 2} r="6" fill=${cor} />`
                : svg`<rect x=${x} y=${y + 5} width=${w} height=${rowH - 10} rx="4" fill=${cor} opacity="0.9" />`}
            `;
          })}
        </svg>
      </div>
    `;
  }
}

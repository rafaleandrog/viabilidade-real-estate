import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { estilosBase, TIPO_LABEL } from './viab-shared.js';
import {
  urbiVerso, listarBenchmarks, atualizarBenchmark, removerBenchmark, criarBenchmark, semearBenchmarks,
} from './viabilidade-api.js';

// Tela de configuração de benchmarks (manifesto telas_config.benchmarks).
// Montada pelo shell na área de config. Escrita é admin-only (backend valida).
@customElement('viabilidade-config-benchmarks')
export class ViabConfigBenchmarks extends LitElement {
  @state() private tipo: 'loteamento' | 'incorporacao' = 'loteamento';
  @state() private itens: any[] = [];
  @state() private carregando = true;

  static styles = [estilosBase, css`
    :host { padding: 16px; }
    .abas { display: flex; gap: 4px; margin-bottom: 16px; }
    .aba { padding: 8px 14px; background: none; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
           border-radius: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; cursor: pointer; }
    .aba.ativa { color: var(--cor-primaria-solida, #2AA9E0); border-color: var(--cor-primaria-solida, #2AA9E0); }
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    td input, td select { width: 100%; box-sizing: border-box; }
    td.num input { max-width: 90px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const res = await listarBenchmarks(this.tipo);
      this.itens = res?.dados || [];
    } catch (e) { console.error(e); }
    this.carregando = false;
  }

  render() {
    return html`
      <div class="topo">
        <h2 style="margin:0">Benchmarks</h2>
        <button class="btn-sec btn-sm" @click=${this._semear}>Criar indicadores padrão</button>
      </div>
      <p class="sec">Valores de referência e faixas de sensibilidade por tipo de empreendimento. Edição restrita a administradores.</p>

      <div class="abas">
        ${(['loteamento', 'incorporacao'] as const).map((t) => html`
          <button class="aba ${this.tipo === t ? 'ativa' : ''}" @click=${() => { this.tipo = t; this._carregar(); }}>${TIPO_LABEL[t]}</button>
        `)}
      </div>

      ${this.carregando
        ? html`<div class="vazio">Carregando…</div>`
        : html`
          <div class="card" style="padding:0; overflow-x:auto;">
            <table>
              <thead><tr><th>Indicador</th><th>Valor</th><th>Regra</th><th>Var + (%)</th><th>Var − (%)</th><th></th></tr></thead>
              <tbody>
                ${this.itens.length === 0 ? html`<tr><td colspan="6" class="sec" style="text-align:center; padding:24px">Nenhum benchmark. Clique em “Criar indicadores padrão”.</td></tr>` : nothing}
                ${this.itens.map((b) => html`
                  <tr>
                    <td>${b.campo}</td>
                    <td class="num"><input type="number" .value=${String(b.valor ?? '')}
                      @change=${(e: Event) => this._patch(b.id, { valor: this._num((e.target as HTMLInputElement).value) })} /></td>
                    <td>
                      <select @change=${(e: Event) => this._patch(b.id, { regra_comparacao: (e.target as HTMLSelectElement).value })}>
                        <option value="atingir_ou_superar" ?selected=${b.regra_comparacao === 'atingir_ou_superar'}>atingir ou superar</option>
                        <option value="nao_exceder" ?selected=${b.regra_comparacao === 'nao_exceder'}>não exceder</option>
                      </select>
                    </td>
                    <td class="num"><input type="number" .value=${String(b.variacao_positiva_pct ?? '')}
                      @change=${(e: Event) => this._patch(b.id, { variacao_positiva_pct: this._num((e.target as HTMLInputElement).value) })} /></td>
                    <td class="num"><input type="number" .value=${String(b.variacao_negativa_pct ?? '')}
                      @change=${(e: Event) => this._patch(b.id, { variacao_negativa_pct: this._num((e.target as HTMLInputElement).value) })} /></td>
                    <td><button class="btn-perigo btn-sm" @click=${() => this._remover(b.id)}>×</button></td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px"><button class="btn-sec btn-sm" @click=${this._novo}>+ Novo indicador</button></div>
        `}
    `;
  }

  private _num(v: string): number | null { return v === '' ? null : Number(v); }

  private async _patch(id: number, dados: Record<string, any>) {
    try {
      const res = await atualizarBenchmark(id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar', 'erro'); return; }
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }

  private async _remover(id: number) {
    if (!confirm('Remover este benchmark?')) return;
    try {
      const res = await removerBenchmark(id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this._carregar();
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }

  private async _novo() {
    const campo = prompt('Identificador do indicador (ex: resultado_final):');
    if (!campo?.trim()) return;
    try {
      const res = await criarBenchmark({ tipo_empreendimento: this.tipo, campo: campo.trim(), regra_comparacao: 'atingir_ou_superar' });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      this._carregar();
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }

  private async _semear() {
    try {
      const res = await semearBenchmarks();
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro', 'erro'); return; }
      urbiVerso.notificar(`${res.criados ?? 0} indicador(es) criado(s).`, 'sucesso');
      this._carregar();
    } catch (e: any) { urbiVerso.notificar(e?.message || 'Erro', 'erro'); }
  }
}

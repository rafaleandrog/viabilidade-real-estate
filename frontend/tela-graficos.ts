import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';

@customElement('viab-tela-graficos')
export class ViabTelaGraficos extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  @state() private excluirTerreno = false;

  static styles = [estiloConteudo, css`
    .graficos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .resultado { margin-top: 12px; }
  `];

  render() {
    if (!this.estudo) return nothing;
    const p = calcularProforma({ ...this.estudo } as ProformaInput);
    return html`
      <div class="graficos">
        <urbi-card titulo="Composição dos custos">
          <urbi-checkbox
            label="Excluir custo de aquisição do terreno"
            ?marcado=${this.excluirTerreno}
            @urbi:checkbox-change=${(e: CustomEvent) => this.excluirTerreno = e.detail.marcado}
          ></urbi-checkbox>
          ${this._renderPizza(p)}
        </urbi-card>
        <urbi-card titulo="Receita × Custos">
          ${this._renderBarras(p)}
        </urbi-card>
      </div>
    `;
  }

  private _custos(p: Proforma) {
    const itens = [
      { l: 'Terreno', v: p.custoTerreno, terreno: true },
      { l: 'Infraestrutura', v: p.infraestrutura },
      { l: 'Construção', v: p.construcao },
      { l: 'Decoração', v: p.decoracao },
      { l: 'Gestão da construção', v: p.gestaoConstrucao },
      { l: 'Projetos', v: p.projetos },
      { l: 'Outorga', v: p.outorga },
      { l: 'Incorporação e registro', v: p.incorporacaoRegistro },
      { l: 'Manutenção', v: p.manutencao },
      { l: 'Contingências', v: p.contingencias },
      { l: 'Marketing global', v: p.marketingGlobal },
      { l: 'Gestão e indiretos', v: p.gestaoIndiretos },
    ];
    return itens.filter((i) => i.v > 0.005 && !(i.terreno && this.excluirTerreno));
  }

  private _renderPizza(p: Proforma): TemplateResult {
    const custos = this._custos(p);
    const total = custos.reduce((s, c) => s + c.v, 0);
    if (total <= 0) {
      return html`<urbi-estado-vazio icone="fa-solid fa-chart-pie" mensagem="Sem custos para exibir."></urbi-estado-vazio>`;
    }
    return html`
      <urbi-grafico-pizza
        formato="moeda"
        .categorias=${custos.map((c) => c.l)}
        .series=${[{ rotulo: 'Custos', valores: custos.map((c) => c.v) }]}
      ></urbi-grafico-pizza>
    `;
  }

  private _renderBarras(p: Proforma): TemplateResult {
    const receita = p.vgv;
    const custos = p.custoDiretoTotal + p.custoIndiretoTotal;
    const resultado = receita - custos;
    return html`
      <urbi-grafico-colunas
        formato="moeda"
        .categorias=${['Receita', 'Custos']}
        .series=${[{ rotulo: 'R$', valores: [receita, custos] }]}
      ></urbi-grafico-colunas>
      <div class="resultado">
        <urbi-kpi rotulo="Resultado" .valor=${fmtR$(resultado)} variante=${resultado >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      </div>
    `;
  }
}

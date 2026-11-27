// Torre do capital stack — a aba Estrutura de capital do Funding (modelo B).
//
// Uma torre só: a camada mais sênior embaixo e o incorporador no topo, cada
// camada com altura proporcional ao valor e o texto DENTRO dela (nome, nível,
// valor e % do total das camadas). Componente próprio porque nenhum gráfico
// `urbi-*` escreve texto dentro da barra — mesma justificativa dos precedentes
// `viab-grafico-cascata`, `viab-grafico-cadeia-areas` e
// `viab-grafico-barra-ranqueada` (componente de domínio que só existe nesta
// app, no registro de exceções do `ui.md` do SDK).
//
// Nenhuma regra de cálculo mora aqui: as camadas chegam prontas, na ordem de
// senioridade (da base para o topo), com rótulo de nível e cor. O componente
// só desenha — põe a base embaixo, deixa fora a camada de valor zero e reparte
// a altura.
//
// Cor: só tokens. O preenchimento mistura a cor da categoria com a superfície
// do tema (o mesmo recurso de `fluxo-tabela.ts`), e o texto usa a cor normal de
// texto, legível em todos os temas; a borda esquerda leva a cor pura da
// categoria, a mesma do badge do cartão.

import { LitElement, html, css, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { fmtR$, fmtR$Mi, fmtPct } from './viab-format.js';
import type { CamadaDaTorre } from './funding-estrutura-dados.js';
import {
  ALTURA_DUAS_LINHAS, ALTURA_MINIMA_CAMADA, ALTURA_TORRE, VAO_CAMADAS, alturasDasCamadas, nomeAcessivelCamada,
} from './stack-capital-desenho.js';


@customElement('viab-grafico-stack-capital')
export class ViabGraficoStackCapital extends LitElement {
  /** Camadas na ordem de senioridade, da base (mais sênior) para o topo. */
  @property({ attribute: false }) camadas: CamadaDaTorre[] = [];

  static styles = css`
    :host { display: block; }
    .grafico {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      max-width: 640px;
    }
    .eixo {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--cor-texto-sec);
      width: 64px;
      text-align: center;
    }
    .eixo .linha {
      flex: 1 1 auto;
      width: 0;
      margin: 4px 0;
      border-left: 1px dashed;
      border-left-color: var(--cor-borda);
    }
    .torre {
      display: flex;
      flex-direction: column-reverse;
      gap: ${unsafeCSS(VAO_CAMADAS)}px;
      min-width: 0;
    }
    .camada {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      overflow: hidden;
      padding: 0 10px;
      border-left: 4px solid;
      border-radius: 3px;
      color: var(--cor-texto);
      font-size: 12px;
      line-height: 16px;
    }
    .linha-texto {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      white-space: nowrap;
    }
    .nome {
      font-weight: 600;
      color: var(--cor-texto-forte);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 0 1 auto;
    }
    .nivel {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 0 100 auto;
    }
    .sep { flex: 0 0 auto; }
    .valor, .pct {
      flex: 0 0 auto;
      font-variant-numeric: tabular-nums;
    }
    .valor { font-weight: 600; color: var(--cor-texto-forte); }
    .vazio {
      margin: 0;
      font-size: 13px;
      color: var(--cor-texto-sec);
    }
  `;

  private _camada(c: CamadaDaTorre, altura: number): TemplateResult {
    const pct = c.pct === null ? '—' : fmtPct(c.pct);
    const valor = html`<span class="valor" title=${fmtR$(c.valor)}>${fmtR$Mi(c.valor)}</span>`;
    const sep = html`<span class="sep" aria-hidden="true">·</span>`;
    const estilo = `height: ${altura}px; border-left-color: ${c.cor}; `
      + `background: color-mix(in srgb, ${c.cor} 28%, var(--cor-superficie-elevada));`;
    const duas = altura >= ALTURA_DUAS_LINHAS;
    return html`
      <div class="camada ${duas ? 'duas' : 'uma'}" role="listitem" data-id=${String(c.id ?? '')}
        data-tipo=${c.tipo} style=${estilo} aria-label=${nomeAcessivelCamada(c)}>
        ${duas ? html`
          <div class="linha-texto"><span class="nome" title=${c.nome}>${c.nome}</span></div>
          <div class="linha-texto"><span class="nivel">${c.nivel}</span>${sep}${valor}${sep}<span class="pct">${pct}</span></div>
        ` : html`
          <div class="linha-texto"><span class="nome" title=${c.nome}>${c.nome}</span>${sep}<span class="nivel">${c.nivel}</span>${sep}${valor}${sep}<span class="pct">${pct}</span></div>
        `}
      </div>`;
  }

  render(): TemplateResult {
    const desenhadas = this.camadas.filter((c) => c.valor > 0);
    if (desenhadas.length === 0) return html`<p class="vazio">Nenhuma camada com valor.</p>`;
    // A ordem do DOM é a de senioridade (a mesma da tabela da sequência), e é
    // a que o leitor de tela lê; o `column-reverse` da torre põe a base embaixo.
    const alturas = alturasDasCamadas(desenhadas.map((c) => c.valor), ALTURA_TORRE, ALTURA_MINIMA_CAMADA);
    return html`
      <div class="grafico">
        <div class="eixo" aria-hidden="true">
          <span>mais júnior</span><span class="linha"></span><span>mais sênior</span>
        </div>
        <div class="torre" role="list" aria-label="Camadas do capital, da mais sênior para a mais júnior">
          ${desenhadas.map((c, i) => this._camada(c, alturas[i]))}
        </div>
      </div>
    `;
  }
}

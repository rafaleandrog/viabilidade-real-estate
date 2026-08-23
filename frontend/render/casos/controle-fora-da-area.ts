// CONTROLE NEGATIVO — a tela posicionada FORA DA ÁREA ROLÁVEL.
//
// A décima segunda forma de ocultação, e a que precisou de uma checagem nova:
// nem `checkVisibility` nem o retângulo a pegam. Medido: um nó em
// `left: -9999px` responde `checkVisibility === true` e tem retângulo 200x40 —
// só que `right = -9799`, e **coordenada negativa não amplia o scroll**. Não
// existe rolagem que chegue lá, então prova de montagem, área visível e a lente
// de overflow ficavam todas verdes com a tela invisível.
//
// É o idioma clássico de "esconder visualmente", e distingue-se de conteúdo
// legítimo abaixo da dobra (`top: 3000px`, que dá `bottom` positivo e é medido
// de propósito — o harness afere a página inteira, não a dobra).
//
// O `harness.render.test.ts` exige que `verificarRender` REJEITE este caso.
// A tabela com as doze formas está em `scripts/render-check.mjs`.

import '../../tela-resumo.js';
import { CRONO, DATA_INICIO, fluxo, forcarEstado } from './dados.js';

export const caso = {
  nome: 'controle-fora-da-area',
  exigir: [{ seletor: 'urbi-kpi', minimo: 7 }],
  async montar(raiz: HTMLElement): Promise<void> {
    const spinner = document.createElement('div');
    spinner.textContent = 'Consolidando o resumo...';
    spinner.style.cssText = 'padding:24px;font-size:14px';
    raiz.appendChild(spinner);

    // Nem `display:none` nem `opacity:0` — a caixa existe, tem tamanho, e o
    // computado não denuncia nada. Só as coordenadas.
    const fora = document.createElement('div');
    fora.style.cssText = 'position:absolute;left:-9999px;top:0;width:1200px';
    raiz.appendChild(fora);
    const el = document.createElement('viab-tela-resumo');
    forcarEstado(el, {
      carregando: false,
      calc: fluxo(),
      benchmarks: [],
      dados: { crono: CRONO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    fora.appendChild(el);
    await (el as any).updateComplete;
  },
};

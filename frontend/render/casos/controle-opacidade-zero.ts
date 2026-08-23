// CONTROLE NEGATIVO — ocultação por `opacity: 0` num ANCESTRAL.
//
// O irmão do `controle-oculto`, e a razão de ele existir separado: as duas
// formas se detectam por caminhos diferentes.
//
//   · `display: none` não gera caixa, então o retângulo do descendente zera e
//     qualquer checagem tropeça nele;
//   · `opacity: 0` **não se propaga** para o estilo computado do descendente.
//     Os filhos seguem com `opacity: 1` e retângulos positivos, e uma checagem
//     que olhe só o próprio nó os dá por visíveis — a tela concluída fica
//     invisível na tela e "presente" para o harness, com um spinner ao lado
//     fornecendo área visível. Achado P1 do Codex, rodada 3.
//
// Detectar isto exige travessia de ancestrais pela árvore COMPOSTA (atravessando
// shadow boundary), que é o que `Element.checkVisibility({ opacityProperty })`
// faz — conferido em Chromium 141, inclusive para nó dentro de shadow root cujo
// ancestral opaco está fora dele.
//
// O `harness.render.test.ts` exige que `verificarRender` REJEITE este caso.
// A tabela com todas as formas de ocultação está em `scripts/render-check.mjs`.

import '../../tela-resumo.js';
import { CRONO, DATA_INICIO, fluxo, forcarEstado } from './dados.js';

export const caso = {
  nome: 'controle-opacidade-zero',
  exigir: [{ seletor: 'urbi-kpi', minimo: 7 }],
  async montar(raiz: HTMLElement): Promise<void> {
    const spinner = document.createElement('div');
    spinner.textContent = 'Consolidando o resumo...';
    spinner.style.cssText = 'padding:24px;font-size:14px';
    raiz.appendChild(spinner);

    // `opacity: 0` — e NÃO `display: none`. O contêiner continua gerando caixa,
    // os 7 urbi-kpi continuam com retângulo positivo, e o computado deles diz
    // `opacity: 1`. É exatamente a configuração que passava batido.
    const opaco = document.createElement('div');
    opaco.style.opacity = '0';
    raiz.appendChild(opaco);
    const el = document.createElement('viab-tela-resumo');
    forcarEstado(el, {
      carregando: false,
      calc: fluxo(),
      benchmarks: [],
      dados: { crono: CRONO, dataInicio: DATA_INICIO },
      carregado: true,
    });
    opaco.appendChild(el);
    await (el as any).updateComplete;
  },
};

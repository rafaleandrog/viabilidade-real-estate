// Caso de render: o botão "Dossiê do projeto" na barra de ações da PROFORMA (Preliminar), ao lado de
// "Exportar Excel" e "Exportar PDF".
//
// ⚠️ POR QUE ESTE CASO EXISTE, e por que teste de função pura não o substitui. `dossiePreliminar` e
// `htmlDossie` são puras e estão testadas (`frontend/dossie-montar.test.ts`, `frontend/dossie.test.ts`);
// nenhuma delas fica vermelha se `viab-tela-proforma` parar de oferecer o botão. É a classe de defeito
// nº 1 do `CLAUDE.md` — o defeito mora na fiação — e só a montagem em Chromium enxerga "o componente
// não chamou". Apagar o botão (ou o `@click`) do template faz o seletor não casar e o harness
// REJEITA a montagem em vez de reportar "limpo".

import '../../tela-proforma.js';
import { ESTUDO, PRODUTOS, forcarEstado } from './dados.js';

export const SELETOR_DOSSIE = 'urbi-botao[data-acao="dossie"]';

export const caso = {
  nome: 'dossie-botao-proforma',
  exigir: [
    { seletor: SELETOR_DOSSIE, minimo: 1 },
    { seletor: 'table.pf', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-icone.classe',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback` e escreve por cima do estado forçado — mesma razão e mesmo
    // padrão de `kpis-proforma`.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, { estudo: ESTUDO, secao: 'proforma', benchmarks: [], produtos: PRODUTOS, aliquotaRet: 4 });
    raiz.appendChild(el);
    await (el as any).updateComplete;

    // `_init()` ainda está em voo (a tela passa por "sem produtos" até o catálogo voltar): espera o
    // botão aparecer, com teto, em vez de medir o primeiro quadro.
    let botao = (el as any).shadowRoot?.querySelector(SELETOR_DOSSIE);
    for (let i = 0; i < 40 && !botao; i++) {
      await new Promise((r) => setTimeout(r, 50));
      await (el as any).updateComplete;
      botao = (el as any).shadowRoot?.querySelector(SELETOR_DOSSIE);
    }
    // O texto do botão é o que o usuário lê: um rótulo trocado sem querer não pode passar.
    if (botao?.textContent?.trim() !== 'Dossiê do projeto') {
      throw new Error(`o botão do dossiê diz "${botao?.textContent?.trim()}", e deveria dizer "Dossiê do projeto"`);
    }
  },
};

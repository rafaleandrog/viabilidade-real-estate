// Caso de render: causa raiz do bug relatado pelo usuário em 2026-09-16 — a
// busca vazia de lote (Terreno & Áreas, Incorporação) pedia só a página 1 do
// Núcleo (ordenada por `id DESC`, não por elegibilidade) e, se essa página
// inteira caísse no filtro de regularização fundiária, a lista de resultados
// ficava vazia mesmo havendo lotes elegíveis na página seguinte — o usuário
// só via algo depois de digitar um termo (que muda para busca por texto no
// servidor, um conjunto diferente). Este caso reproduz exatamente isso: a
// página 1 de `/lotes` é 100% de um parcelamento de regularização, a página 2
// tem 1 lote elegível, e a medida prova que ele aparece SEM o usuário digitar
// nada — a fiação de `_carregarLotes` (não só a função pura) é o que este
// caso exercita.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'terreno-nucleo-lote-pagina-vazia',
  exigir: [
    { seletor: 'viab-terreno-nucleo', minimo: 1 },
    { seletor: 'urbi-input.busca', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-input.label',
    'urbi-input.placeholder',
    'urbi-kpi.variante',
    'urbi-seletor-arquivo.accept',
    'urbi-seletor-arquivo.texto',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).__chamadasNucleo = [];
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    (globalThis as any).urbiVerso.nucleo = async (rota: string) => {
      (globalThis as any).__chamadasNucleo.push(rota);
      if (rota.startsWith('/parcelamentos')) {
        // Parcelamento 10 = regularização fundiária; 20 = normal.
        return {
          dados: [{ id: 10, regularizacao: true }, { id: 20, regularizacao: false }],
          total: 2, pagina: 1, por_pagina: 200, paginas: 1,
        };
      }
      if (rota.startsWith('/lotes')) {
        const pagina = Number(new URL(rota, 'http://x').searchParams.get('pagina')) || 1;
        if (pagina === 1) {
          // Página 1 inteira do parcelamento de regularização — some do
          // filtro por completo. Só o cursor avançar sozinho revela a 2.
          return {
            dados: [{ id: 1, id_legivel: 'L1-REGULARIZACAO', parcelamento_id: 10 }],
            total: 2, pagina: 1, por_pagina: 200, paginas: 2,
          };
        }
        return {
          dados: [{ id: 2, id_legivel: 'L2-OK', parcelamento_id: 20 }],
          total: 2, pagina: 2, por_pagina: 200, paginas: 2,
        };
      }
      return { dados: [] };
    };

    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, origem_terreno: 'nucleo', status: 'rascunho', imoveis: [] },
      secao: 'terreno',
      editavel: true,
      benchmarks: [],
      produtos: [],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // `_carregar()` encadeia: ids de regularização, depois lotes (que agora
    // pode encadear DUAS páginas sozinho) — várias voltas de microtask antes
    // de assentar de verdade.
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    const tela = raiz.querySelector('viab-tela-premissas') as any;
    const terreno = tela.shadowRoot!.querySelector('viab-terreno-nucleo') as any;
    await terreno.updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{
    chamadasLotes: string[]; opcoesValores: string[]; opcoesRotulos: string[]; buscaDigitada: string;
  }> {
    const tela = raiz.querySelector('viab-tela-premissas') as any;
    const terreno = tela.shadowRoot!.querySelector('viab-terreno-nucleo') as any;
    await terreno.updateComplete;
    const botoes = Array.from(terreno.shadowRoot!.querySelectorAll('button.resultado-lote')) as HTMLButtonElement[];
    const buscaInput = terreno.shadowRoot!.querySelector('urbi-input.busca') as any;
    return {
      chamadasLotes: ((globalThis as any).__chamadasNucleo ?? []).filter((r: string) => r.startsWith('/lotes')),
      opcoesValores: botoes.map((b) => b.getAttribute('data-valor') ?? ''),
      opcoesRotulos: botoes.map((b) => (b.textContent ?? '').trim()),
      buscaDigitada: buscaInput?.valor ?? '',
    };
  },
};

// Caso de render: filtro da lista de resultados de lote (Terreno & Áreas,
// Incorporação) — excluir lotes de parcelamento com `regularizacao=true` e
// mostrar o campo de busca por texto. A função que faz a exclusão está em
// `viab-terreno-nucleo` (`_carregarLotes`), mas a FIAÇÃO é o que este caso
// mede: se o componente chama `/parcelamentos`, resolve o conjunto certo, e
// de fato tira o lote errado da lista de resultados anexada ao
// `<urbi-input class="busca">` — a classe de defeito nº 1 do CLAUDE.md
// (função pura correta, componente não liga, ou liga errado) só se prova
// atravessando o DOM real. Desde a redesenho de campo único (2026-09-16) não
// existe mais `<urbi-select>` nesse fluxo — a lista de resultados é um
// `<urbi-lista>` anexado ao mesmo `<urbi-input class="busca">`. Ver
// `terreno-nucleo-lote-pagina-vazia.ts` para o caso que cobre a causa raiz
// (página 1 zerada pelo filtro).

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'terreno-nucleo-filtro-regularizacao',
  exigir: [
    { seletor: 'viab-terreno-nucleo', minimo: 1 },
    { seletor: 'urbi-input.busca', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim, medidas —
  // quase todas da PÁGINA DE PREMISSAS inteira, que sobe junto (não há como
  // montar só `viab-terreno-nucleo`, ela é filha de `viab-tela-premissas`).
  aceitaNaoReproduzido: [
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-input.label',
    'urbi-input.placeholder',
    'urbi-kpi.variante',
    'urbi-lista.clicavel',
    'urbi-lista.itens',
    'urbi-lista.mensagemVazio',
    'urbi-lista.render_item',
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
        // Lote 1 pertence ao parcelamento de regularização (10) — tem que
        // sumir do seletor. Lote 2 pertence ao parcelamento normal (20).
        return {
          dados: [
            { id: 1, id_legivel: 'L1-REGULARIZACAO', parcelamento_id: 10 },
            { id: 2, id_legivel: 'L2-OK', parcelamento_id: 20 },
          ],
          total: 2, pagina: 1, por_pagina: 200, paginas: 1,
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
    // `_carregar()` do `viab-terreno-nucleo` encadeia dois `await` (ids de
    // regularização, depois lotes) — dá pelo menos duas voltas de microtask
    // antes de assentar de verdade (mesma técnica de `painel-abas-lazy-terrenos`).
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    const tela = raiz.querySelector('viab-tela-premissas') as any;
    const terreno = tela.shadowRoot!.querySelector('viab-terreno-nucleo') as any;
    await terreno.updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{
    chamadas: string[]; opcoesValores: string[]; opcoesRotulos: string[]; temBuscaInput: boolean;
    temSelect: boolean;
  }> {
    const tela = raiz.querySelector('viab-tela-premissas') as any;
    const terreno = tela.shadowRoot!.querySelector('viab-terreno-nucleo') as any;
    await terreno.updateComplete;
    const lista = terreno.shadowRoot!.querySelector('urbi-lista') as any;
    const opcoes = (lista?.itens ?? []) as { valor: string; rotulo: string }[];
    const buscaInput = terreno.shadowRoot!.querySelector('urbi-input.busca');
    return {
      chamadas: (globalThis as any).__chamadasNucleo ?? [],
      opcoesValores: opcoes.map((o) => o.valor),
      opcoesRotulos: opcoes.map((o) => o.rotulo),
      temBuscaInput: !!buscaInput,
      // Campo único: não pode existir um <urbi-select> separado neste fluxo.
      temSelect: !!terreno.shadowRoot!.querySelector('urbi-select'),
    };
  },
};

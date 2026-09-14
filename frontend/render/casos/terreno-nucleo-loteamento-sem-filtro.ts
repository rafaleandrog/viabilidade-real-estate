// Caso de render: o pedido do autor exclui explicitamente Loteamento — o
// seletor de GLEBA não pode ganhar busca por texto nem o filtro de
// regularização fundiária (que não faz sentido para gleba: a exclusão é por
// lote↔parcelamento, e Loteamento nem usa `parcelamento_id` de lote). Este
// caso mede que o ramo `_ehLoteamento` continua exatamente como antes: sem
// `/parcelamentos`, sem `urbi-input.busca`, com a paginação numérica antiga.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

export const caso = {
  nome: 'terreno-nucleo-loteamento-sem-filtro',
  exigir: [
    { seletor: 'viab-terreno-nucleo', minimo: 1 },
  ],
  // Mesma lista medida do caso irmão (terreno-nucleo-filtro-regularizacao) —
  // é a mesma página (`viab-tela-premissas`, secao 'terreno') só que com
  // `tipo_empreendimento: 'loteamento'`.
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-select.pesquisavel',
    'urbi-select.placeholder',
    'urbi-seletor-arquivo.accept',
    'urbi-seletor-arquivo.texto',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).__chamadasNucleo = [];
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    (globalThis as any).urbiVerso.nucleo = async (rota: string) => {
      (globalThis as any).__chamadasNucleo.push(rota);
      if (rota.startsWith('/glebas')) {
        return {
          dados: [{ id: 1, id_legivel: 'G1' }],
          total: 1, pagina: 1, por_pagina: 50, paginas: 1,
        };
      }
      return { dados: [] };
    };

    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: {
        ...ESTUDO, tipo_empreendimento: 'loteamento', origem_terreno: 'nucleo',
        status: 'rascunho', imoveis: [],
      },
      secao: 'terreno',
      editavel: true,
      benchmarks: [],
      produtos: [],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    const tela = raiz.querySelector('viab-tela-premissas') as any;
    const terreno = tela.shadowRoot!.querySelector('viab-terreno-nucleo') as any;
    await terreno.updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{ chamadas: string[]; temBuscaInput: boolean; temPaginacaoNumerica: boolean }> {
    const tela = raiz.querySelector('viab-tela-premissas') as any;
    const terreno = tela.shadowRoot!.querySelector('viab-terreno-nucleo') as any;
    await terreno.updateComplete;
    const buscaInput = terreno.shadowRoot!.querySelector('urbi-input.busca');
    const pagInfo = terreno.shadowRoot!.querySelector('span.pag-info');
    return {
      chamadas: (globalThis as any).__chamadasNucleo ?? [],
      temBuscaInput: !!buscaInput,
      temPaginacaoNumerica: !!pagInfo && /Página/.test(pagInfo.textContent ?? ''),
    };
  },
};

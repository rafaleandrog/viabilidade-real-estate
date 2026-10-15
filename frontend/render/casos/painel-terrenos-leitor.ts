// Caso de render: usuário com nível `leitura` na aba Terrenos.
//
// Vê os parâmetros e o vínculo, mas não importa nem edita: sem o botão de importar e com o modal somente
// leitura. O backend recusa a escrita de qualquer forma (403); a tela não pode oferecer o que vai falhar.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';
import { REGISTRO, medirParametros } from './painel-terrenos-parametros.js';

export interface MedidaLeitor { botaoImportar: boolean; modalEditavel: boolean; modalLote: string; coefMax: string }

export const caso = {
  nome: 'painel-terrenos-leitor',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-modal.title'],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.contexto = () => ({ nivel: 'leitura', roles: [] });
    await montarCaso('ok', [REGISTRO])(raiz);
  },
  async medir(raiz: HTMLElement): Promise<MedidaLeitor> {
    const el: any = raiz.querySelector('viab-tela-dashboard');
    const botaoImportar = [...el.shadowRoot.querySelectorAll('urbi-botao')].some((b: any) => /Importar coeficientes/.test(b.textContent));
    const m = await medirParametros(raiz);
    return { botaoImportar, modalEditavel: m.modalEditavel, modalLote: m.modalLote, coefMax: m.coefMax['LOTE-NORMAL'] };
  },
};

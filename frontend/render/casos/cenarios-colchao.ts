// Caso de render: o bloco de CONSUMO DO COLCHÃO abaixo do tornado (#734), no
// estado de ALERTA — que é o que ninguém olha até acontecer. No fixture da
// sub-aba Cenários o preço suporta cair só ~7,1% até o resultado zerar, e o
// Bear aplica −10%: o consumo passa de 100% e a tela tem de DIZER, em
// palavras, que o cenário Bear já é inviável.
//
// A sonda depois troca a seleção para "Permuta financeira" (amplitude zero
// neste fixture) e lê o bloco de novo: sem alerta, com a mensagem de baixa
// alavanca — os dois estados no mesmo DOM.

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from '../../fixtures/sensibilidade-catalogo.js';

export const caso = {
  nome: 'cenarios-colchao',
  exigir: [
    { seletor: 'div.colchao', minimo: 1 },
    { seletor: 'div.colchao.inviavel', minimo: 1 },
    { seletor: 'div.colchao urbi-banner', minimo: 1 },
    { seletor: 'p.colchao-var', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-badge.cor',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_SENSIBILIDADE };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_SENSIBILIDADE, secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS_SENSIBILIDADE, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    (el as any)._varSensManual = 'preco';
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{
    alerta: string; equilibrio: string; temBanner: boolean; temBaixa: boolean;
    depois: { texto: string; temBanner: boolean; temBaixa: boolean };
  }> {
    const el = raiz.querySelector('viab-tela-proforma') as any;
    await el.updateComplete;
    const sr = el.shadowRoot!;
    const texto = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const ler = () => {
      const bloco = sr.querySelector('div.colchao') as HTMLElement;
      return {
        texto: texto(bloco),
        temBanner: !!bloco.querySelector('urbi-banner'),
        temBaixa: !!bloco.querySelector('p.colchao-baixa'),
        equilibrio: texto(bloco.querySelector('p.colchao-texto')),
        alerta: texto(bloco.querySelector('urbi-banner')),
      };
    };
    const antes = ler();
    el._varSensManual = 'permuta_financeira';
    await el.updateComplete;
    const depois = ler();
    // ⚠️ `medir()` roda ANTES da sonda de montagem (`exigir`) no harness —
    // devolve a seleção ao preço, senão os seletores do estado de alerta
    // são contados sobre a variável trocada e o caso "não monta o que declara".
    el._varSensManual = 'preco';
    await el.updateComplete;
    return {
      alerta: antes.alerta, equilibrio: antes.equilibrio, temBanner: antes.temBanner, temBaixa: antes.temBaixa,
      depois: { texto: depois.texto, temBanner: depois.temBanner, temBaixa: depois.temBaixa },
    };
  },
};

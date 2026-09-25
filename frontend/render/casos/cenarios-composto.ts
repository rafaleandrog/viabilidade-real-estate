// Caso de render: o CENÁRIO COMPOSTO no topo do tornado (#735) — as três
// maiores alavancas estressadas juntas. Mede FIAÇÃO em Chromium: o item
// existe no topo da lista do tornado, é selecionável, e ao selecioná-lo o
// cabeçalho da tabela Bear/Base/Bull declara as TRÊS premissas com o sentido
// de cada uma (§4.6.E: nenhum cenário altera duas premissas sem declarar
// ambas) e o Resultado do Bear composto é PIOR que o do Bear do preço isolado.
//
// ⚠️ `medir()` roda antes da sonda `exigir` no harness — a sonda devolve a
// seleção ao preço no fim.

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from '../../fixtures/sensibilidade-catalogo.js';

export const caso = {
  nome: 'cenarios-composto',
  exigir: [
    { seletor: 'viab-grafico-tornado', minimo: 1 },
    { seletor: 'table.pf.sens', minimo: 1 },
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
      estudo: { ...ESTUDO_SENSIBILIDADE, permuta_financeira_residencial_pct: 5 }, secao: 'cenarios', benchmarks: [],
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
    primeiraLinha: string; primeiraEhComposto: boolean; nLinhas: number;
    resultadoBearPreco: string; cabecalhoBearComposto: string; resultadoBearComposto: string;
    subtitulo: string; compostoAtivoDepoisDoClique: boolean;
  }> {
    const el = raiz.querySelector('viab-tela-proforma') as any;
    await el.updateComplete;
    const sr = el.shadowRoot!;
    const texto = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const tornado = sr.querySelector('viab-grafico-tornado') as any;
    await tornado.updateComplete;
    const linhas = [...tornado.shadowRoot!.querySelectorAll('.linha')] as HTMLElement[];
    const linhaResultado = () => [...sr.querySelectorAll('table.pf.sens tbody tr')].find((tr) => texto(tr.querySelector('td:first-child')) === 'Resultado')!;
    const resultadoBearPreco = texto(linhaResultado().querySelector('td:nth-child(2)'));
    // Clica no item composto, como o usuário faria.
    (linhas[0].classList.contains('composto') ? linhas[0] : linhas.find((l) => l.classList.contains('composto'))!).click();
    await el.updateComplete;
    await tornado.updateComplete;
    const cabecalhoBearComposto = texto(sr.querySelector('table.pf.sens thead th:nth-child(2)'));
    const resultadoBearComposto = texto(linhaResultado().querySelector('td:nth-child(2)'));
    const subtitulo = texto(sr.querySelector('p.sens-var'));
    const compostoAtivoDepoisDoClique = ([...tornado.shadowRoot!.querySelectorAll('.linha.composto.ativa')].length === 1);
    // Devolve a seleção (medir roda antes da sonda de montagem).
    el._varSensManual = 'preco';
    await el.updateComplete;
    return {
      primeiraLinha: texto(linhas[0].querySelector('.rotulo')),
      primeiraEhComposto: linhas[0].classList.contains('composto'),
      nLinhas: linhas.length,
      resultadoBearPreco, cabecalhoBearComposto, resultadoBearComposto, subtitulo, compostoAtivoDepoisDoClique,
    };
  },
};

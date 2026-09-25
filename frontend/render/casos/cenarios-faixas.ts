// Caso de render: a sub-aba CENÁRIOS do Preliminar com BENCHMARKS válidos
// (#731) — os dois indicadores em % ("Custo obras / VGV", "Margem sobre VGV")
// saem como faixa bear–base–bull contra o benchmark (`viab-faixa-cenarios`),
// e não mais como três badges com bola colorida.
//
// Mede FIAÇÃO em Chromium: o motor `montarFaixaCenarios` correto e não
// chamado deixaria a suíte verde com as badges na tela. Aqui os segmentos, os
// marcadores e os valores só existem se a tela montou o componente com a
// faixa que o motor devolveu — e a sonda mede que os três marcadores estão
// na MESMA escala (a posição do Bear não depende do Bull).

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from '../../fixtures/sensibilidade-catalogo.js';

// Os dois benchmarks que os indicadores da tabela leem (`bmCampo`), um em
// cada regra: "Margem sobre VGV" atinge-ou-supera 20 (3 faixas configuradas),
// "Custo obras / VGV" não-excede 35 (fallback automático de 2 faixas).
export const BENCHMARKS_FAIXAS = [
  { id: 1, campo: 'margem_liquida', valor: 20, regra_comparacao: 'atingir_ou_superar', medidor_min: 0, medidor_faixa1_ate: 15, medidor_faixa2_ate: 20, medidor_max: 40, variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
  { id: 2, campo: 'custo_obras_vgv', valor: 35, regra_comparacao: 'nao_exceder', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
];

export const caso = {
  nome: 'cenarios-faixas',
  exigir: [
    { seletor: 'viab-faixa-cenarios', minimo: 2 },
    // Nenhum indicador sobrou como badge: a tabela de indicadores some.
    { seletor: 'table.pf.sens', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-badge.cor',
    'urbi-select.label',
    'urbi-select.opcoes',
    // #734: o alerta de cenário inviável (o preço deste fixture suporta cair
    // ~7% e o Bear aplica −10%) — a variante do banner não é reproduzida.
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_SENSIBILIDADE };
      if (rota.startsWith('/benchmarks')) return { dados: BENCHMARKS_FAIXAS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_SENSIBILIDADE, secao: 'cenarios', benchmarks: BENCHMARKS_FAIXAS,
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
    rotulos: string[]; segmentosPorFaixa: number[]; marcadoresPorFaixa: number[];
    coresPrimeiroSegmento: string[]; valores: string[][]; badgesDeIndicador: number;
    ordemMarcadores: string[][];
  }> {
    const el = raiz.querySelector('viab-tela-proforma') as any;
    await el.updateComplete;
    const sr = el.shadowRoot!;
    const faixas = [...sr.querySelectorAll('viab-faixa-cenarios')] as any[];
    for (const f of faixas) await f.updateComplete;
    const texto = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const esquerda = (n: Element) => parseFloat(((n as HTMLElement).style.left || '0').replace('%', ''));
    return {
      rotulos: faixas.map((f) => texto(f.shadowRoot!.querySelector('.rotulo'))),
      segmentosPorFaixa: faixas.map((f) => f.shadowRoot!.querySelectorAll('.segmento').length),
      marcadoresPorFaixa: faixas.map((f) => f.shadowRoot!.querySelectorAll('.marcador').length),
      coresPrimeiroSegmento: faixas.map((f) => (f.shadowRoot!.querySelector('.segmento') as HTMLElement).style.background),
      valores: faixas.map((f) => [...f.shadowRoot!.querySelectorAll('.valores span')].map(texto)),
      badgesDeIndicador: sr.querySelectorAll('table.pf.sens tbody urbi-badge').length,
      // Os marcadores lidos pela POSIÇÃO no trilho: crescente da esquerda para
      // a direita, que é o que "uma escala só" garante.
      ordemMarcadores: faixas.map((f) => [...f.shadowRoot!.querySelectorAll('.marcador')]
        .sort((a, b) => esquerda(a) - esquerda(b))
        .map((m) => (m as HTMLElement).classList.contains('bear') ? 'bear' : (m as HTMLElement).classList.contains('base') ? 'base' : 'bull')),
    };
  },
};

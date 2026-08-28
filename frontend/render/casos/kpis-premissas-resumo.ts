// Caso de render: o card "Resumo" de Premissas → Produtos (Incorporação),
// com "Preço médio/unid." de 9 DÍGITOS (#579 — "o VALOR salta para fora do
// quadro do KPI"). `_renderResumo` (`frontend/tela-premissas.ts:1244-1273`)
// só aparece na sub-aba `secao: 'produtos'`, e a MESMA `.kpis` que ele usa
// também rege `.kpis.aproveitamento` (#569) e `.kpis.area-alocada` (#573,
// que corenderiza aqui — `_renderAreaAlocada()` mora na mesma sub-aba): os
// três modificadores só ajustam `margin-top`, a track é uma regra só, e este
// caso prova a track para os três de uma vez.
//
// `precoMedioUnidade = vgv / numUnidades` (`frontend/proforma.ts:672-673`)
// e `vgv = área_média_m2 × preço_m2 × unidades` por produto — o `unidades`
// se CANCELA na divisão, então `precoMedioUnidade = area_media_m2 ×
// preco_venda_m2`, independente de quantas unidades o catálogo tiver. Por
// isso `100 × 1.714.484 = 171.448.400,00` (mesmos dígitos do exemplo
// literal da issue) sem precisar de um catálogo de 1 unidade só —
// `unidades: 80` continua normal, e o "Nº de unidades" da faixa não
// estressa nada.
//
// Deliberadamente NÃO ajusta `area_pvt_r_fechada`: mexer nela também
// dispararia estouro de % (Custo obras/VGV, Margem sobre VGV), que é OUTRA
// classe de defeito — não a que esta issue pede.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTOS_PRECO_LONGO: Record<string, any>[] = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 100, preco_venda_m2: 1_714_484, unidades: 80 },
];

export const caso = {
  nome: 'kpis-premissas-resumo',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. 3
  // `urbi-kpi` de `.kpis.area-alocada` (sempre presentes na sub-aba
  // Produtos) + 6 de `.kpis` do Resumo (branch Incorporação de
  // `_renderResumo`: Área privativa total, Área construída, Nº de
  // unidades, Preço médio/unid., Custo obras/VGV, Margem sobre VGV) = 9.
  exigir: [
    { seletor: 'div.kpis', minimo: 2 },
    { seletor: 'urbi-kpi', minimo: 9 },
    { seletor: 'table.prod', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-input.placeholder',
    'urbi-select.opcoes',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Mesmo mecanismo de `area-alocada-excedente.ts`: `_init()` roda no
    // `connectedCallback`, é assíncrono e escreve por cima do estado
    // forçado com o que a "API" devolver — o catálogo precisa vir por aqui,
    // não só por `produtos` no `forcarEstado`.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_PRECO_LONGO };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao' },
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS_PRECO_LONGO,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

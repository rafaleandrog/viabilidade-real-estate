// Caso de render: a TABELA do Fluxo de Caixa **com funding** (#592).
//
// O caso irmão `tabela-fluxo.ts` monta um estudo SEM funding — ele prova o
// contrato do O5 (uma seção de fecho só) e mede a geometria da tabela larga.
// Este aqui existe porque as seções novas **só são montadas quando há
// funding**: sem ele, nenhum seletor deste arquivo casaria, e a verificação
// do critério 8 mediria o vazio.
//
// ⚠️ O `exigir` abaixo é a asserção principal, e ele afirma ORDEM, não só
// presença. Um seletor CSS não casa por texto — daí as âncoras `data-linha`
// (mesmo mecanismo da #591) — e o combinador `~` (irmão geral) é o que torna
// "vem depois" verificável no DOM: `A ~ B` só casa se B aparece depois de A
// dentro do mesmo pai, que aqui é o `<tbody>`.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, fluxo, fundingDeFluxo, OPERACOES_FUNDING, forcarEstado } from './dados.js';

export const caso = {
  nome: 'tabela-fluxo-funding',
  exigir: [
    { seletor: 'table.fx', minimo: 1 },
    // As duas seções de fecho existem, cada uma com as suas duas linhas.
    { seletor: 'table.fx tbody tr.resultado[data-linha="fcl-mensal"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.resultado[data-linha="fcl-acumulado"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.resultado[data-linha="fc-mensal"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.resultado[data-linha="fc-acumulado"]', minimo: 1 },
    // Os dois blocos de funding, com a natureza certa: entradas são receita,
    // saídas são custo. Trocar a natureza troca a cor da faixa (#591).
    { seletor: 'table.fx tbody tr.grupo.receita[data-linha="funding-entradas"]', minimo: 1 },
    { seletor: 'table.fx tbody tr.grupo.custo[data-linha="funding-saidas"]', minimo: 1 },
    // A ORDEM, que é o coração da issue: o Livre fecha ANTES das duas pontas
    // do funding, e o Fluxo de Caixa fecha DEPOIS delas.
    { seletor: 'tr[data-linha="fcl-acumulado"] ~ tr[data-linha="funding-entradas"]', minimo: 1 },
    { seletor: 'tr[data-linha="funding-entradas"] ~ tr[data-linha="funding-saidas"]', minimo: 1 },
    { seletor: 'tr[data-linha="funding-saidas"] ~ tr[data-linha="fc-mensal"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-ver');
    const fundingCalc = fundingDeFluxo();
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: fluxo(),
      vista: 'fluxo-caixa',
      visao: 'mensal',
      colapso: {},
      operacoes: OPERACOES_FUNDING,
      fundingCalc,
      funding: fundingCalc?.noFluxo ?? null,
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS, custos: CUSTOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

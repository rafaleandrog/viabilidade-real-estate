// Render da aba Antecipação do Funding (#851), com uma cessão que tem lastro.
//
// O `fluxo()` de `dados.ts` usa um plano legado, que não tem recebimento por
// safra — uma antecipação sobre ele não teria o que ceder e a tela mostraria só
// o aviso de "nenhuma parcela". Por isso este caso monta o seu próprio fluxo,
// com o plano no contrato canônico (entrada à vista, saldo em carteira própria),
// e a cessão depois da entrega: é o que faz os seis cards do "Resultado da
// antecipação" existirem. Sem este caso, apagar o painel deixava a suíte de
// render inteira verde.

import '../../tela-funding.js';
import { calcularFluxo } from '../../fluxo-caixa-motor.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';
import { mesRepasse } from '../../fluxo-shared.js';
import { CRONO, DATA_INICIO, CUSTOS, forcarEstado } from './dados.js';

const LINHA = {
  id: 1, nome: 'Lotes', fase_label: 'lancamento',
  tipologias: [{ id: 1, quantidade: 200, area_privativa_m2: 300, preco_m2: 3_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: {
    componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 0 },
      { tipo: 'carteira_pos_marco', participacaoPct: 90, marcoMes: 36, carenciaMeses: 0, prazoMeses: 120 },
    ],
  },
};

const OPERACAO: OperacaoFunding & { id: number; ordem: number; cronograma_evento: string } = {
  id: 30, ordem: 0, tipo: 'antecipacao_recebiveis', nome: '1º Antecipação',
  valor: 0, inicio_mes: 40, cronograma_evento: 'customizado',
  pct_carteira_cedida: 50, taxa_anual: 18,
  taxa_estruturacao_pct: 2, taxa_administracao_mensal: 1_500, outros_encargos_iniciais: 25_000,
};

export const caso = {
  nome: 'funding-antecipacao',
  exigir: [
    { seletor: 'urbi-abas', minimo: 1 },
    // os seis cards do Resultado da antecipação
    { seletor: 'div.ind-card', minimo: 6 },
    // pct cedido, taxa de desconto e as três tarifas (o mês da cessão é customizado, + 1)
    { seletor: 'viab-num', minimo: 6 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-input.desabilitado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const calc = calcularFluxo({
      dataInicio: DATA_INICIO, taxaDescontoAa: 12, jurosTabelaAaEstudo: 12, cronograma: CRONO,
      linhasReceita: [LINHA], linhasCusto: CUSTOS, curvas: [], areaTerreno: 4_800,
      operacoesFunding: [OPERACAO],
    });
    const funding = fundingDoEstudo(
      [OPERACAO], calc.fluxoMensal, calc.receitaMensal, calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1],
      mesRepasse(CRONO), 12, { cronograma: CRONO, recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal },
    );
    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      calc,
      funding,
      operacoes: [OPERACAO],
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: false,
      abaAtiva: 'antecipacao_recebiveis',
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

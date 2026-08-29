// Caso de render: o CHASSI de abas da tela de Funding (#586).
//
// ⚠️ O que este caso existe para pegar, e nenhuma outra camada pega. Os testes
// de `frontend/funding-abas.test.ts` provam a REORDENAÇÃO (função pura) e o
// PARTICIONAMENTO (lógica de conjunto lida da fonte). Nenhum dos dois enxerga
// se a tela **monta** as abas: apagar o `<urbi-abas>` inteiro do `render()`,
// ou trocá-lo por um `<div>`, deixa aquele arquivo VERDE — é a classe de
// defeito nº 1 do `CLAUDE.md`, "o defeito mora na FIAÇÃO, não no cálculo".
//
// O `exigir` abaixo é a prova de montagem: quatro `urbi-hospedeiro` (um por
// aba, todos montados — `urbi-abas` exibe a ativa e mantém os demais no DOM,
// como em `tela-avancado.ts`) e a `urbi-tabela` compilada da aba Operações,
// que é a aba ativa por padrão.
//
// A fixture tem UMA operação de cada tipo, de propósito: é o menor conjunto que
// prova que a tabela compila os TRÊS tipos numa lista só (critério 2) e que
// nenhum tipo ficou sem aba.

import '../../tela-funding.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';
import { mesRepasse } from '../../fluxo-shared.js';
import { CRONO, DATA_INICIO, CUSTOS, fluxo, forcarEstado } from './dados.js';

const OPERACOES: (OperacaoFunding & { id: number; ordem: number })[] = [
  {
    id: 1, ordem: 0, tipo: 'divida', nome: 'Capital de giro',
    valor: 5_000_000, inicio_mes: 0, distribuir_aporte: true, aporte_meses: 3,
    taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12,
  },
  {
    id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
    taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80,
    amortizar_com_caixa_disponivel: true,
  } as any,
  {
    id: 3, ordem: 2, tipo: 'equity', nome: 'Investidor',
    valor: 3_000_000, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 15,
  } as any,
];

export const caso = {
  nome: 'funding-abas',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele: um caso que
  // não renderiza nada passaria por TODAS as lentes com "limpo".
  exigir: [
    { seletor: 'urbi-abas', minimo: 1 },
    // As quatro abas — Operações, Financiamento à produção, Dívida e Equity.
    // Apagar a montagem de UMA deixa este caso vermelho, que é o critério 5.
    { seletor: 'urbi-hospedeiro', minimo: 4 },
    // A tabela compilada da aba Operações (ativa por padrão).
    { seletor: 'urbi-tabela', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    // Banner regulatório (§17/#277) e o de tarifa duplicada (#478) — os dois
    // ficam FORA das abas, no topo, e são parte da tela sob medição.
    'urbi-banner.variante',
    // Cards das abas de tipo: todas as três estão montadas (urbi-abas mantém
    // no DOM), então os campos dos três formulários entram na medição.
    'urbi-checkbox.desabilitado',
    'urbi-checkbox.label',
    'urbi-checkbox.marcado',
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-icone.classe',
    'urbi-input.desabilitado',
    // `urbi-tabela` recebe colunas/linhas por PROPRIEDADE (o espelho declara
    // `so_propriedade: true` para as duas) — o stub não as reproduz.
    'urbi-tabela.clicavel',
    'urbi-tabela.mensagem-vazio',
    // `urbi-abas` idem: `abas` é só-propriedade, `ativa` tem atributo.
    'urbi-abas.ativa',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const calc = fluxo();
    const funding = fundingDoEstudo(
      OPERACOES, calc.fluxoMensal, calc.receitaMensal,
      calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1], mesRepasse(CRONO), 12,
    );
    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      calc,
      funding,
      operacoes: OPERACOES,
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: false,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};

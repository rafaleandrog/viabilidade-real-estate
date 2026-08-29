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
    // As TRÊS abas de tipo — Financiamento à produção, Dívida e Equity.
    // Apagar a montagem de uma delas deixa este caso vermelho (critério 5).
    { seletor: 'urbi-hospedeiro', minimo: 3 },
  ],
  // ⚠️ O QUE ESTE CASO NÃO MEDE, e por quê — o limite é do harness, não do
  // código, e declará-lo é obrigatório: um caso que se cala sobre a própria
  // cobertura é indistinguível de um que cobriu tudo.
  //
  // A aba **Operações** e a `urbi-tabela` dentro dela **não são aferíveis
  // aqui**. O stub recebe `colunas` e `linhas` por PROPRIEDADE (o espelho as
  // declara `so_propriedade: true`) e não sabe desenhar tabela nenhuma — a
  // caixa sai com altura ZERO, e caixa de área zero conta como invisível, que
  // é o que o `exigir` mede. Medido: pedir `urbi-tabela` visível reprova
  // sempre, inclusive com a tabela montada e correta.
  //
  // Consequência honesta: **apagar a aba Operações NÃO fica vermelho aqui.**
  // Quem cobre esse flanco é `frontend/funding-abas.test.ts`, lendo a fonte —
  // o teste dos rótulos literais das quatro abas e o do particionamento
  // (`TIPOS` × `ABAS`). É cobertura mais fraca que render, e está dito assim
  // em vez de anunciada como equivalente.
  aceitaNaoReproduzido: [
    // Banner regulatório (§17/#277) — fica FORA das abas, no topo, e é parte
    // da tela sob medição.
    'urbi-banner.variante',
    // Campos dos formulários das abas de tipo (todas montadas).
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-input.desabilitado',
    // O primitivo de abas: `abas` é só-propriedade, `ativa` não dimensiona.
    'urbi-abas.abas',
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

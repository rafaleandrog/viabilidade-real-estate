// As três provas de equity da #469 — E1, E2 e E3 — como casos versionados.
//
// ⚠️ ESTE ARQUIVO NÃO É UM ORÁCULO. O vizinho `calliandra-golden.ts`
// **reimplementa** a matemática de propósito, para confrontar o motor com uma
// segunda opinião. Aqui é o oposto, e é a mesma regra de `kpis-baseline.ts`:
// estas fixtures **chamam a cadeia real** (`calcularFluxo` →
// `receitaLiquidaComCorretagemMensal` → `fundingDoEstudo` → `validarFunding`) e
// afirmam o que ela produz. Nada de aritmética de negócio neste arquivo: sem
// `pmt`, sem taxa equivalente, sem recompor receita líquida à mão. Uma fixture
// que reimplemente o motor não prova divergência nenhuma — ela fica verde
// enquanto os dois estiverem errados juntos.
//
// ── O QUE MUDOU ENTRE A ABERTURA DA #469 E ESTE ARQUIVO (2026-08-24) ─────────
//
// A #469 foi escrita quando os três defeitos estavam VIVOS, e pedia que cada
// caso afirmasse o comportamento divergente **de então**, para que o PR que
// consertasse cada um tivesse de inverter a asserção, no diff. Os três
// consertaram antes desta fixture existir, todos em 2026-08-24:
//
//   E1 · #432 — clamp em 0 com carry-forward do déficit (`funding-motor.ts`,
//               bloco `#432` dentro de `simularEquity`);
//   E2 · #435 — teto nominal de `Σ pct_retorno` na rota (`somaRetornoExcede`,
//               `backend/rotas/funding.ts`) e #445 — leitura MENSAL do mesmo
//               teto na Reconciliação (`RETORNO_EQUITY_EXCEDE_RECEITA`);
//   E3 · #446 — o horizonte cobre a quitação contratual da dívida
//               (`janelaDivida`/`ultimoMesFunding`, `fluxo-shared.ts`).
//
// Então os casos afirmam o comportamento **atual**, que é o consertado, e cada
// um diz qual issue inverteu a asserção original. A troca é vantajosa: em vez
// de provarem o defeito **uma vez**, provam que ele foi consertado **e
// continua consertado**, a cada PR, no CI.
//
// ── POR QUE NÃO É DUPLICATA DOS TESTES DAQUELES PRs ─────────────────────────
//
// Os testes de #432 (`funding-motor.test.ts`, bloco `#432`) chamam
// `simularEquity` com séries escritas à mão; os de #435
// (`backend/rotas/funding.test.ts`) chamam `somaRetornoExcede` isolada; os de
// #445/#446 chamam `validarFunding` sobre `FundingCalc` montado à mão. Todos
// exercitam **funções puras**, e nenhum liga uma na outra.
//
// O que **não** existia é o elo: nenhum teste do repositório partia de um
// `FluxoConfig` e percorria `calcularFluxo → receitaLiquidaComCorretagemMensal
// → fundingDoEstudo → validarFunding`. É a classe de defeito nº 1 do
// `CLAUDE.md` — *"o defeito mora na FIAÇÃO, não no cálculo"* —, e ela tem duas
// consequências medidas aqui:
//
//   · o E1 é o único lugar do repositório onde a receita líquida NEGATIVA
//     aparece como saída do motor real, e não como array digitado no teste.
//     Esse é o ponto da divergência: o estado é estruturalmente
//     irrepresentável na planilha (`C = B × (1 − …)`, dedução multiplicativa) e
//     PERFEITAMENTE representável aqui (a corretagem é uma série subtraída com
//     cronograma próprio);
//   · o E2 e o E3 afirmam explicitamente a dependência do ARGUMENTO: sem o 4º
//     parâmetro de `validarFunding` a checagem mensal do teto não roda, e sem
//     `operacoesFunding` no `FluxoConfig` o horizonte trunca a dívida. Cada um
//     tem um caso "com" e um caso "sem", lado a lado.

import { calcularFluxo, type FluxoConfig } from '../fluxo-caixa-motor.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal,
  type OperacaoFunding,
} from '../funding-motor.js';
import { validarFunding, type Divergencia } from '../fluxo-invariantes.js';
import { mesRepasse, type EventoCrono } from '../fluxo-shared.js';

// ── cronograma comum aos três casos ─────────────────────────────────────────
//
// Curto de propósito (24 meses de operação) para que os arrays caibam na
// leitura de quem for depurar um caso vermelho.
const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 3 },
  { evento: 'pre_lancamento', inicio_mes: 3, duracao_meses: 3 },
  { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 7, duracao_meses: 12 },
  { evento: 'pos_obra', inicio_mes: 19, duracao_meses: 5 },
];

/** Mês (0-based) do evento `lancamento` do `CRONO` acima. */
export const MES_LANCAMENTO = 6;

/**
 * Base dos três casos: uma incorporação que vende TUDO no lançamento e recebe
 * quase tudo no repasse.
 *
 * ⚠️ O par "sinal pequeno + corretagem integral no mês da venda" **é o
 * cenário**, não um enfeite: é ele que produz receita líquida negativa no mês
 * do lançamento (2% recebidos contra 6% de corretagem paga), que é o estado
 * que a planilha não sabe representar. Mexer em qualquer um dos dois números
 * apaga o E1 sem deixar o teste vermelho — por isso estão comentados aqui.
 */
const BASE: FluxoConfig = {
  dataInicio: 'jan/2027',
  taxaDescontoAa: 12,
  cronograma: CRONO,
  areaTerreno: 0,
  linhasReceita: [{
    id: 1, nome: 'Torre única', fase_label: 'Torre A',
    tipologias: [
      { id: 11, nome: 'Dois quartos', quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 },
    ],
    // 100% vendido no mês do lançamento — concentra a corretagem num mês só.
    absorcao: { modo: 'distribuido', blocos: [
      { evento: 'pre_lancamento', pct: 0 },
      { evento: 'lancamento', pct: 100 },
      { evento: 'obra', pct: 0 },
      { evento: 'pos_obra', pct: 0 },
    ] },
    fluxo_pagamento: { componentes: [
      { tipo: 'imediato', participacaoPct: 2, descontoPct: 0, rotulo: 'Sinal' },
      { tipo: 'ate_marco', participacaoPct: 18, sinalPct: 0, marcoMes: 18,
        defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'Durante a obra' },
      { tipo: 'concentrado', participacaoPct: 80, mesPagamento: 19, taxaMensal: 0, rotulo: 'Repasse' },
    ] },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 1_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 4_000_000, orcamento_unidade: 'rs', inicio_mes: 7, duracao_meses: 12 },
    // 6% do VGV, pagos INTEGRALMENTE no mês da venda (#121) — o outro lado do E1.
    { id: 3, grupo: 'diretos', categoria: 'Corretagem de vendas', orcamento_valor: 6, orcamento_unidade: 'pct_vgv' },
  ],
};

// ── a fiação, num lugar só ──────────────────────────────────────────────────

export interface CenarioEquity {
  /** Horizonte efetivo do fluxo, em meses — o que a #446 pode esticar. */
  prazo: number;
  /** Mês (0-based) do repasse, derivado do cronograma — onde `resultado_final` paga. */
  mesRepasseValor: number;
  /** `fluxoAcumulado` no último mês: a base do modo `resultado_final`. */
  resultadoFinal: number;
  /** `receitaLiquidaComCorretagemMensal` sobre a saída do motor real. */
  receitaLiquida: number[];
  /** `Σ saídas de equity` por mês (todas as operações de equity somadas). */
  saidasEquityPorMes: number[];
  /** Total pago a todas as operações de equity no horizonte inteiro. */
  totalPagoEquity: number;
  /** Saldo da dívida no último mês do horizonte, por nome de operação. */
  saldoFinalPorOperacao: Record<string, number>;
  /** `validarFunding(...)` COM o 4º argumento (`receitaLiquidaMensal`, #445). */
  divergencias: Divergencia[];
  /** `validarFunding(...)` SEM o 4º argumento — a fiação esquecida. */
  divergenciasSemReceita: Divergencia[];
}

/**
 * Roda a cadeia real e devolve o que os três casos afirmam.
 *
 * ⚠️ Isto é **fiação**, não conta: encadeia `calcularFluxo` →
 * `receitaLiquidaComCorretagemMensal` → `fundingDoEstudo` → `validarFunding`
 * na mesma ordem que a aba Fluxo de Caixa (`tela-fluxo-ver.ts`, os quatro
 * passos do `atualizar`). Se esta função reproduzisse a matemática, os testes
 * parariam de vigiar o motor e passariam a vigiar a si mesmos.
 *
 * `comOperacoesNoHorizonte` existe para o E3 e é o interruptor da fiação da
 * #446: `false` reproduz o chamador que esqueceu de passar `operacoesFunding`
 * no `FluxoConfig`, e o horizonte volta a truncar a dívida.
 */
export function cenarioEquity(
  config: FluxoConfig,
  operacoes: OperacaoFunding[],
  comOperacoesNoHorizonte: boolean = true,
): CenarioEquity {
  const c = calcularFluxo(
    comOperacoesNoHorizonte ? { ...config, operacoesFunding: operacoes } : config,
  );
  const receitaLiquida = receitaLiquidaComCorretagemMensal(
    c.receitaMensal, c.linhasCusto, config.linhasCusto ?? [],
  );
  const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
  const fc = fundingDoEstudo(
    operacoes, c.fluxoMensal, receitaLiquida, resultadoFinal,
    mesRepasse(config.cronograma ?? []), config.taxaDescontoAa,
    { custosRaw: config.linhasCusto ?? [], linhasCusto: c.linhasCusto, cronograma: config.cronograma ?? [] },
  );
  if (!fc) throw new Error('cenarioEquity: fundingDoEstudo devolveu null — o caso precisa de operações');

  const prazo = c.fluxoMensal.length;
  const equities = fc.operacoes.filter((s) => s.operacao.tipo === 'equity');
  const saidasEquityPorMes: number[] = [];
  for (let t = 0; t < prazo; t++) {
    saidasEquityPorMes.push(equities.reduce((soma, s) => soma + Number(s.saidas[t] ?? 0), 0));
  }
  const saldoFinalPorOperacao: Record<string, number> = {};
  for (const s of fc.operacoes) {
    saldoFinalPorOperacao[s.operacao.nome || s.operacao.tipo] = Number(s.saldo[s.saldo.length - 1] ?? 0);
  }

  return {
    prazo,
    mesRepasseValor: mesRepasse(config.cronograma ?? []),
    resultadoFinal,
    receitaLiquida,
    saidasEquityPorMes,
    totalPagoEquity: saidasEquityPorMes.reduce((a, b) => a + b, 0),
    saldoFinalPorOperacao,
    divergencias: validarFunding(fc, c.fluxoMensal, undefined, receitaLiquida),
    divergenciasSemReceita: validarFunding(fc, c.fluxoMensal),
  };
}

/** Códigos emitidos, em ordem — o que os testes comparam. */
export function codigos(ds: Divergencia[]): string[] {
  return ds.map((d) => d.codigo);
}

// ── E1 · retorno de equity negativo (#432) ──────────────────────────────────
//
// Uma `equity` em `permuta_financeira`, ancorada no lançamento, num estudo
// cujo mês de lançamento tem receita líquida NEGATIVA.
//
// A asserção ORIGINAL da #469 era *"o retorno do mês é negativo — o investidor
// paga ao projeto"*. **A #432 inverteu-a em 2026-08-24:** o mês paga zero, o
// déficit fica registrado e abate os meses seguintes (carry-forward), e o
// total pago é `pct × Σ base` — não `pct × Σ max(0, base)`, que é o que um
// `Math.max(0, …)` sem memória produziria.
export const OPS_E1: OperacaoFunding[] = [{
  id: 'e1', tipo: 'equity', nome: 'Investidor E1',
  valor: 1_000_000, inicio_mes: MES_LANCAMENTO,
  modo_retorno: 'permuta_financeira', pct_retorno: 10,
}];

export const CONFIG_E1: FluxoConfig = BASE;

// ── E2 · teto de 100% (#435 nominal, #445 mensal) ───────────────────────────
//
// Três `equity` em `permuta_financeira`, 40% cada: 120% no nominal.
//
// A asserção ORIGINAL da #469 tinha duas partes, e as duas foram invertidas no
// mesmo dia: (1) *"a soma dos retornos do mês dá 120% da receita líquida"* —
// **continua verdadeira no MOTOR**, que não tem portão e não deve ter, porque
// quem barra é a rota; (2) *"`fluxo-invariantes.ts` não emite nada"* — **a
// #445 inverteu**: emite `RETORNO_EQUITY_EXCEDE_RECEITA`, e só quando o 4º
// argumento é passado.
//
// O elo "rota" (o nominal de 120% recusado com `422`) é a função pura
// `somaRetornoExcede` (`backend/rotas/funding.ts`), exercitada por
// `backend/rotas/funding.test.ts`. Ele NÃO é importado aqui de propósito:
// `backend/rotas/funding.ts` usa a augmentação `req.dados` que só o
// `tsconfig` do backend enxerga, e importá-lo daqui quebraria o typecheck do
// frontend — que é o único que este ambiente consegue rodar.
export const OPS_E2: OperacaoFunding[] = [
  { id: 'e2a', tipo: 'equity', nome: 'Investidor A', valor: 100_000, inicio_mes: MES_LANCAMENTO, modo_retorno: 'permuta_financeira', pct_retorno: 40 },
  { id: 'e2b', tipo: 'equity', nome: 'Investidor B', valor: 100_000, inicio_mes: MES_LANCAMENTO, modo_retorno: 'permuta_financeira', pct_retorno: 40 },
  { id: 'e2c', tipo: 'equity', nome: 'Investidor C', valor: 100_000, inicio_mes: MES_LANCAMENTO, modo_retorno: 'permuta_financeira', pct_retorno: 40 },
];

export const CONFIG_E2: FluxoConfig = BASE;

// ── E3 · resultado final e horizonte (#446) ─────────────────────────────────
//
// Uma `equity` em `resultado_final` ancorada no planejamento, MAIS uma
// `divida` com `periodo_amortizacao_meses` = 120, muito além do último evento
// operacional (mês 23).
//
// A asserção ORIGINAL da #469 era *"`saldoFinal` é o do último mês do
// horizonte, não o do mês 120"*. **A #446 inverteu:** o horizonte passou a
// cobrir `janelaDivida(op).fim + 1`, a dívida quita dentro dele e o saldo
// final zera. O caso guarda os DOIS lados — com e sem `operacoesFunding` no
// `FluxoConfig` —, porque a metade não-calculada do conserto é fiação, e
// fiação some sem deixar teste vermelho.
export const OPS_E3: OperacaoFunding[] = [
  { id: 'e3a', tipo: 'equity', nome: 'Investidor E3', valor: 1_000_000, inicio_mes: 0,
    modo_retorno: 'resultado_final', pct_retorno: 5 },
  { id: 'e3b', tipo: 'divida', nome: 'Dívida longa', valor: 2_000_000, inicio_mes: 0,
    taxa_anual: 12, periodo_amortizacao_meses: 120, periodo_carencia_meses: 0 },
];

export const CONFIG_E3: FluxoConfig = BASE;

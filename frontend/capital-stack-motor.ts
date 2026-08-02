// Motor do Programa Financeiro / Capital Stack (#239, FIN-03/#272).
// Funções puras — sem DOM, sem I/O — mesma convenção de fluxo-caixa-motor.ts
// (arrays mensais 1-based; índice 0 ignorado, mesmo padrão do oráculo
// `frontend/fixtures/capital-stack-golden.ts`, #270).
//
// Escopo desta issue: a INFRAESTRUTURA de reconciliação de caixa — "quanto
// falta" e "o que sobrou" (§3.1/§3.2/§12.4 de
// docs/viabilidade/funding-capital-stack.md) — não os instrumentos em si.
// Sem nenhuma camada com efeito no motor (todas nascem `rascunho`/
// `revisao_necessaria`, #271), `entradasFundingMensal`/`saidasFundingMensal`
// são sempre zero hoje — o fluxo após funding é idêntico ao fluxo livre do
// projeto. FIN-04 a FIN-07 preenchem essas duas séries por instrumento; esta
// issue só garante que a RECONCILIAÇÃO em cima delas já está certa e
// testada, reconciliada contra os Casos 1 e 16 do oráculo.

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Fluxo de caixa do PROJETO após funding (§2.1, §12.4):
 *
 *   fluxo_apos_funding_t = fluxo_livre_projeto_t + entradas_funding_t − saidas_funding_t
 *
 * Os três arrays são 1-based (índice 0 ignorado); o resultado tem o
 * comprimento do maior dos três, preenchendo com zero onde um array for
 * mais curto.
 */
export function fluxoAposFundingMensal(
  fluxoLivreMensal: number[],
  entradasFundingMensal: number[],
  saidasFundingMensal: number[],
): number[] {
  const n = Math.max(fluxoLivreMensal.length, entradasFundingMensal.length, saidasFundingMensal.length);
  const out = new Array<number>(n).fill(0);
  for (let t = 1; t < n; t++) {
    out[t] = round2((fluxoLivreMensal[t] ?? 0) + (entradasFundingMensal[t] ?? 0) - (saidasFundingMensal[t] ?? 0));
  }
  return out;
}

/** Caixa acumulado do projeto mês a mês, a partir de um fluxo mensal (1-based). */
export function caixaAcumuladoMensal(fluxoMensal: number[]): number[] {
  const out = new Array<number>(fluxoMensal.length).fill(0);
  let acc = 0;
  for (let t = 1; t < fluxoMensal.length; t++) {
    acc = round2(acc + (fluxoMensal[t] ?? 0));
    out[t] = acc;
  }
  return out;
}

/**
 * Necessidade de funding do mês (§3.1):
 *
 *   necessidade_funding_t = máximo(0, reserva_minima_caixa − caixa_provisorio_t)
 *
 * `caixaProvisorioMensal` já é o caixa acumulado ANTES de qualquer liberação
 * automática do mês (§7 passo 6) — quem chama decide o que entra nele; esta
 * função só aplica a fórmula.
 */
export function necessidadeFundingMensal(caixaProvisorioMensal: number[], reservaMinima: number): number[] {
  return caixaProvisorioMensal.map((v, i) => (i === 0 ? 0 : round2(Math.max(0, reservaMinima - v))));
}

/**
 * Caixa distribuível do mês (§3.2):
 *
 *   caixa_distribuivel_t = máximo(0, caixa_apos_operacao_e_divida_t − reserva_minima_caixa − obrigacoes_futuras_protegidas_t)
 *
 * `obrigacoesFuturasProtegidas` é opcional (default 0) — nenhum dos
 * instrumentos ainda em produção reserva caixa para obrigação futura;
 * FIN-04+ passa a preencher quando existir.
 */
export function caixaDistribuivelMensal(
  caixaAposOperacaoEDividaMensal: number[],
  reservaMinima: number,
  obrigacoesFuturasProtegidas: number[] = [],
): number[] {
  return caixaAposOperacaoEDividaMensal.map((v, i) =>
    i === 0 ? 0 : round2(Math.max(0, v - reservaMinima - (obrigacoesFuturasProtegidas[i] ?? 0))));
}

/**
 * Reconciliação completa de um estudo (§12.4), hoje trivial: sem nenhuma
 * camada com efeito no motor, `entradasFundingMensal`/`saidasFundingMensal`
 * são zero — `fluxoAposFundingMensal` é idêntico a `fluxoLivreMensal`. A
 * lacuna de funding continua sendo calculada e reportada mesmo assim (é só
 * um SINAL informativo — nunca altera o fluxo livre do projeto, #16 do §14).
 *
 * ⚠️ Esta função calcula a necessidade a partir do caixa JÁ SOMADO a
 * entradas/saídas — válido enquanto as duas são zero (hoje). Quando FIN-04+
 * ligar liberações automáticas de verdade, a ORDEM importa (§7 passo 6: a
 * necessidade precisa ser calculada ANTES da liberação automática que ela
 * mesma vai disparar — ver o oráculo `capital-stack-golden.ts`, que já
 * modela essa ordem). Quem escrever o motor completo dos instrumentos deve
 * montar essa sequência com os blocos desta função (`caixaAcumuladoMensal`,
 * `necessidadeFundingMensal`) chamados na ordem certa, não reusar este
 * atalho como está.
 */
export function reconciliarCapitalStack(
  fluxoLivreMensal: number[],
  entradasFundingMensal: number[],
  saidasFundingMensal: number[],
  reservaMinima: number,
): { fluxoAposFundingMensal: number[]; caixaProjetoMensal: number[]; necessidadeFundingMensal: number[]; lacunaFundingMaxima: number } {
  const fluxo = fluxoAposFundingMensal(fluxoLivreMensal, entradasFundingMensal, saidasFundingMensal);
  const caixaProjeto = caixaAcumuladoMensal(fluxo);
  const necessidade = necessidadeFundingMensal(caixaProjeto, reservaMinima);
  return {
    fluxoAposFundingMensal: fluxo,
    caixaProjetoMensal: caixaProjeto,
    necessidadeFundingMensal: necessidade,
    lacunaFundingMaxima: necessidade.length ? Math.max(...necessidade) : 0,
  };
}

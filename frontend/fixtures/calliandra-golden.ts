// ─────────────────────────────────────────────────────────────────────────
// Cenários dourados de recebíveis — referência Calliandra (#220 / EVI-001).
//
// Este módulo é a FIXTURE DOURADA e o ORÁCULO de recebíveis por safra. Ele NÃO
// é importado pelo runtime (não entra no bundle de index.ts) — serve só aos
// testes. Desde a #283, o motor de produção (fluxo-caixa-motor.ts) calcula
// safras, PMT, juros, carteira e repasse e é comparado contra este oráculo.
//
// Origem: dois EVIs do projeto Calliandra (um loteamento). Importa-se apenas a
// MECÂNICA de recebíveis — safra, sinal, primeiro vencimento (s+1), PMT, marco
// (N_s = M − s) e repasse concentrado —, idêntica na Incorporação. Não se
// importa produto, tipologia, custo nem obra. Ver `docs/viabilidade/
// padrao-incorporacao.md` Anexo G e `docs/revisao-recebiveis-calliandra-2026-07-31.md`.
//
// Convenções aprovadas (Fase 0, 2026-08-01):
//  · primeira parcela recorrente em s+1 (o mês da contratação recebe só os
//    pagamentos imediatos: à vista, entrada, sinal);
//  · componentes de pagamento em quatro regras econômicas — imediato, prazo
//    fixo, até marco, concentrado (#230);
//  · até marco: N_s = M − s; N_s ≤ 0 é ERRO (bloquear), nunca prazo negativo (#233);
//  · juros começam depois da contratação (saldo_s,s = principal_s), sem juros no
//    mês da venda por padrão (#234).
//
// ⚠️ Os valores numéricos abaixo são de UM estudo real e vivem SÓ aqui, como
// referência de teste. Nada disso é default de tela nem constante do runtime.
// ─────────────────────────────────────────────────────────────────────────

/** Parcela de um sistema PRICE. Taxa zero → divisão simples (sem juros). */
export function pmt(taxaMensal: number, n: number, principal: number): number {
  if (n <= 0) return 0;
  if (taxaMensal === 0) return principal / n;
  return (principal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -n));
}

/** Taxa mensal equivalente a uma taxa anual composta: (1+a)^(1/12) − 1. */
export function taxaMensalEquivalente(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

// Componente de pagamento (contrato de 4 regras econômicas · #230).
export type Componente =
  // Pago integralmente no mês da contratação. `desconto` reduz o caixa (à vista
  // com abatimento comercial). Ex.: à vista 20% com 5% de desconto.
  | { tipo: 'imediato'; participacao: number; desconto?: number; rotulo?: string }
  // Prazo fixo N, igual para toda safra. Sinal no mês da venda; principal em N
  // parcelas PMT a partir de s+1. Ex.: tabela curta (36) e longa (120).
  | { tipo: 'prazo_fixo'; participacao: number; sinalPct?: number; prazoN: number; taxaMensal: number; rotulo?: string }
  // Até um marco M fixo: N_s = M − s (varia com a safra). Parcelas de s+1 até M.
  // N_s ≤ 0 é erro. Ex.: parcelas "durante a obra" que terminam na entrega.
  | { tipo: 'ate_marco'; participacao: number; sinalPct?: number; marcoM: number; taxaMensal: number; rotulo?: string }
  // Pagamento único num mês fixo (repasse/liquidação concentrada).
  | { tipo: 'concentrado'; participacao: number; mesPagamento: number; rotulo?: string };

export interface CenarioRecebiveis {
  nome: string;
  baseContratada: number;
  /** Contratação bruta por mês, 1-based; índice 0 = 0 (não usado). */
  contratacaoPorMes: number[];
  componentes: Componente[];
  taxaAnual: number;
}

export interface DetalheSafra {
  componente: string;
  safra: number;            // mês da contratação (1-based)
  principal: number;        // base do parcelamento (após sinal); 0 para imediato/concentrado
  pagamentos: { mes: number; valor: number }[];
}

export interface ResultadoRecebiveis {
  /** Receita total por mês, 1-based; índice 0 = 0. */
  receitaPorMes: number[];
  /** Último mês com recebimento relevante. */
  horizonte: number;
  safras: DetalheSafra[];
}

/**
 * Motor de referência dos recebíveis por safra. Cada mês de contratação cria
 * uma safra; o caixa do mês é a soma dos pagamentos imediatos das vendas do mês
 * com as parcelas/liquidações de todas as safras anteriores ainda ativas.
 *
 * É a implementação-oráculo: reproduz os valores dourados POR CONSTRUÇÃO (das
 * premissas), não por cópia. #232–#237 implementam a mesma regra no motor de
 * produção e passam a ser comparadas contra este resultado.
 */
export function calcularRecebiveis(cen: CenarioRecebiveis): ResultadoRecebiveis {
  const contrat = cen.contratacaoPorMes;
  const maxSafra = contrat.length - 1;

  // Horizonte máximo possível a partir dos componentes (evita array subdimensionado).
  let maxMes = 0;
  for (let s = 1; s <= maxSafra; s++) {
    if (!contrat[s]) continue;
    for (const c of cen.componentes) {
      if (c.tipo === 'imediato') maxMes = Math.max(maxMes, s);
      else if (c.tipo === 'prazo_fixo') maxMes = Math.max(maxMes, s + c.prazoN);
      else if (c.tipo === 'ate_marco') maxMes = Math.max(maxMes, c.marcoM);
      else if (c.tipo === 'concentrado') maxMes = Math.max(maxMes, c.mesPagamento);
    }
  }

  const receitaPorMes = new Array<number>(maxMes + 1).fill(0);
  const safras: DetalheSafra[] = [];

  for (let s = 1; s <= maxSafra; s++) {
    const V = contrat[s];
    if (!V) continue;
    for (const c of cen.componentes) {
      const pagamentos: { mes: number; valor: number }[] = [];
      let principal = 0;

      if (c.tipo === 'imediato') {
        pagamentos.push({ mes: s, valor: c.participacao * (1 - (c.desconto ?? 0)) * V });
      } else if (c.tipo === 'prazo_fixo') {
        const valor = c.participacao * V;
        const sinal = (c.sinalPct ?? 0) * valor;
        principal = valor - sinal;
        if (sinal) pagamentos.push({ mes: s, valor: sinal });
        const parcela = pmt(c.taxaMensal, c.prazoN, principal);
        for (let k = 1; k <= c.prazoN; k++) pagamentos.push({ mes: s + k, valor: parcela });
      } else if (c.tipo === 'ate_marco') {
        const valor = c.participacao * V;
        const sinal = (c.sinalPct ?? 0) * valor;
        principal = valor - sinal;
        if (sinal) pagamentos.push({ mes: s, valor: sinal });
        const N = c.marcoM - s; // N_s = M − s
        if (N <= 0) {
          throw new Error(
            `ate_marco: N_s = ${N} ≤ 0 na safra ${s} (marco ${c.marcoM}). ` +
            'Converta para imediato ou concentrado — o motor não cria prazo negativo (#233).',
          );
        }
        const parcela = pmt(c.taxaMensal, N, principal);
        for (let k = 1; k <= N; k++) pagamentos.push({ mes: s + k, valor: parcela });
      } else {
        // concentrado
        pagamentos.push({ mes: c.mesPagamento, valor: c.participacao * V });
      }

      for (const p of pagamentos) receitaPorMes[p.mes] += p.valor;
      safras.push({ componente: c.tipo, safra: s, principal, pagamentos });
    }
  }

  let horizonte = 0;
  for (let m = 1; m <= maxMes; m++) if (receitaPorMes[m] > 1e-6) horizonte = m;

  return { receitaPorMes, horizonte, safras };
}

export interface Divergencia {
  linha: string;
  mes: number;
  safra?: number;
  esperado: number;
  obtido: number;
  delta: number;
}

/**
 * Primeira divergência entre a série esperada e a obtida, além da tolerância.
 * Reporta a linha (série), o mês e — quando informada — a safra. Ambas as séries
 * são 1-based (índice 0 ignorado). `null` = sem divergência.
 */
export function primeiraDivergencia(
  linha: string,
  esperado: readonly number[],
  obtido: readonly number[],
  tol: number,
  safra?: number,
): Divergencia | null {
  const n = Math.max(esperado.length, obtido.length);
  for (let m = 1; m < n; m++) {
    const e = esperado[m] ?? 0;
    const o = obtido[m] ?? 0;
    if (Math.abs(e - o) > tol) return { linha, mes: m, safra, esperado: e, obtido: o, delta: o - e };
  }
  return null;
}

// ── Cenário G.1 — prazo fixo ──────────────────────────────────────────────
// base 28.601.115,20; contratação 10% da base nos meses 1–4 e 7,5% nos 5–12.
// à vista 20% (−5%), curta 13,3%/36, longa ~64,8132%/120, sinal 15%, 15% a.a.
// A 4ª modalidade (`Venda Casas`, 1,8868% = 1/53 lotes, 240 parcelas/30% sinal)
// NÃO entra nas colunas de receita — as três modelas somam 98,1132% da base,
// não 100%. Não force fechamento contra a linha agregada de Vendas Contratadas.
const G1_TAXA_MENSAL = taxaMensalEquivalente(0.15);
const G1_LONGA_PART = 0.981132 - 0.20 - 0.133; // = 0,648132 (resto das três modalidades)

export const CALLIANDRA_G1: CenarioRecebiveis = {
  nome: 'Calliandra — prazo fixo',
  baseContratada: 28_601_115.20,
  contratacaoPorMes: [
    0,
    2_860_111.52, 2_860_111.52, 2_860_111.52, 2_860_111.52,
    2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64,
    2_145_083.64, 2_145_083.64, 2_145_083.64, 2_145_083.64,
  ],
  componentes: [
    { tipo: 'imediato',   participacao: 0.20, desconto: 0.05, rotulo: 'à vista' },
    { tipo: 'prazo_fixo', participacao: 0.133, sinalPct: 0.15, prazoN: 36,  taxaMensal: G1_TAXA_MENSAL, rotulo: 'curta' },
    { tipo: 'prazo_fixo', participacao: G1_LONGA_PART, sinalPct: 0.15, prazoN: 120, taxaMensal: G1_TAXA_MENSAL, rotulo: 'longa' },
  ],
  taxaAnual: 0.15,
};

// Valores de conferência (Anexo G.1) — receita total do mês, em reais.
export const G1_ESPERADO: ReadonlyArray<readonly [number, number]> = [
  [1, 878_539.92], [2, 914_119.61], [3, 949_699.31], [4, 985_279.01],
  [13, 355_796.98], [38, 344_737.04], [49, 245_197.58], [122, 220_677.83],
  [132, 18_389.82], [133, 0],
];

// ── Cenário G.2 — até Obra + repasse ──────────────────────────────────────
// base 28.547.740,29; contratação uniforme de 1/12 nos meses 1–12.
// entrada 15% (imediato), parcelas 15% até o marco 24 (N_s = 24 − s), repasse
// 70% no mês 25, taxa zero.
export const CALLIANDRA_G2: CenarioRecebiveis = {
  nome: 'Calliandra — até Obra + repasse',
  baseContratada: 28_547_740.29,
  contratacaoPorMes: [0, ...new Array<number>(12).fill(2_378_978.36)],
  componentes: [
    { tipo: 'imediato',    participacao: 0.15, rotulo: 'entrada' },
    { tipo: 'ate_marco',   participacao: 0.15, marcoM: 24, taxaMensal: 0, rotulo: 'parcelas' },
    { tipo: 'concentrado', participacao: 0.70, mesPagamento: 25, rotulo: 'repasse' },
  ],
  taxaAnual: 0,
};

// Valores de conferência (Anexo G.2). Meses 13–24 são constantes (todas as 12
// safras ativas em cada mês da janela).
export const G2_ESPERADO: ReadonlyArray<readonly [number, number]> = [
  [1, 356_846.75], [2, 372_361.83], [3, 388_582.14], [12, 582_045.90],
  [13, 254_936.38], [24, 254_936.38], [25, 19_983_418.20],
];

// Motor de cálculo do Fluxo de Caixa (nível Avançado).
// Funções puras, sem DOM e sem I/O — espelha o padrão de proforma.ts e é
// coberto por fluxo-caixa-motor.test.ts. Usado APENAS quando
// estudo.nivel_analise === 'avancado'; o Preliminar não passa por aqui.
//
// Convenções:
// - Tempo em meses RELATIVOS 0-based (mês 0 = data_inicio_projeto).
// - Arrays mensais são 0-based e o índice coincide com o número do mês: índice i = mês i.
// - Receitas positivas; custos positivos nos próprios arrays (o sinal entra na
//   consolidação: fluxo = receita − custo).
// - Permuta física NÃO entra no fluxo: o VGV derivado das tipologias já é o
//   valor de venda do incorporador.

import {
  absorcaoMensal, vgvLinha, vgvTipologia, vglLinha,
  areaPrivativaTotalLinhas, resolverCustoTotal, mesRelativoCompleto, rotuloMesRelativo,
  type EventoCrono, type ContextoCusto,
} from './fluxo-shared.js';

const n = (v: any): number => Number(v) || 0;

export type CurvaPersonalizada = { mes: number; pct: number }[];

// ─────────────────────────────────────────────────────────────────
// 6A. Distribuição mensal de uma linha
// ─────────────────────────────────────────────────────────────────

/**
 * Distribui `total` ao longo de `duracaoMeses` a partir de `inicioMes`
 * (0-based), devolvendo um array de `prazoTotal` posições (zeros fora do
 * intervalo).
 *
 * - 'linear': total/duracao em cada mês
 * - curva personalizada: os percentuais da curva são reamostrados (interpolação
 *   linear do acumulado) para a duração real e normalizados para somar 100%.
 */
export function distribuirLinha(
  total: number,
  inicioMes: number,
  duracaoMeses: number,
  curva: 'linear' | CurvaPersonalizada,
  prazoTotal: number,
): number[] {
  const saida = new Array<number>(Math.max(prazoTotal, 0)).fill(0);
  const dur = Math.max(1, Math.round(duracaoMeses));
  const inicio = Math.max(0, Math.round(inicioMes));

  let pesos: number[];
  if (curva === 'linear' || !Array.isArray(curva) || curva.length === 0) {
    pesos = new Array(dur).fill(1 / dur);
  } else {
    pesos = reamostrarCurva(curva, dur);
  }

  for (let i = 0; i < dur; i++) {
    const idx = inicio + i; // mês 0-based coincide com o índice do array
    if (idx >= 0 && idx < saida.length) saida[idx] += total * pesos[i];
  }
  return saida;
}

/**
 * Reamostra uma curva de N pontos (% por mês) para `dur` meses via
 * interpolação linear do ACUMULADO, normalizando para somar 1.
 */
export function reamostrarCurva(curva: CurvaPersonalizada, dur: number): number[] {
  const ordenada = [...curva].sort((a, b) => n(a.mes) - n(b.mes));
  const brutos = ordenada.map((p) => Math.max(0, n(p.pct)));
  const somaBruta = brutos.reduce((s, x) => s + x, 0) || 1;
  // Acumulado da curva-fonte em N+1 nós: 0, c1, c1+c2, ... , 1
  const N = brutos.length;
  const acum: number[] = [0];
  for (let i = 0; i < N; i++) acum.push(acum[i] + brutos[i] / somaBruta);

  // Acumulado alvo avaliado em frações j/dur (interp. linear entre nós i/N).
  const acumEm = (f: number): number => {
    if (f <= 0) return 0;
    if (f >= 1) return 1;
    const pos = f * N;
    const i = Math.floor(pos);
    const frac = pos - i;
    return acum[i] + (acum[i + 1] - acum[i]) * frac;
  };
  const pesos: number[] = [];
  for (let j = 1; j <= dur; j++) pesos.push(acumEm(j / dur) - acumEm((j - 1) / dur));
  return pesos;
}

// ─────────────────────────────────────────────────────────────────
// Tipos do fluxo consolidado
// ─────────────────────────────────────────────────────────────────

export interface FluxoConfig {
  dataInicio: string | null;       // "mmm/AAAA" (ancora os rótulos; pode faltar)
  prazoMeses?: number;             // horizonte fixo; se ausente, é derivado
  taxaDescontoAa: number;          // % a.a. para o VPL
  cronograma: EventoCrono[];
  linhasReceita: any[];            // { id, nome, fase_label, tipologias[], absorcao, fluxo_pagamento }
  linhasCusto: any[];              // { id, grupo, categoria, subcategoria, orcamento_*, curva_id, inicio_mes, duracao_meses }
  curvas?: any[];                  // avancado_curvas (lookup de curva_id → valores)
  areaTerreno: number;             // m² (Premissas)
}

export interface LinhaCalc {
  id: any;
  nome: string;
  grupo: 'receita' | 'terreno' | 'obra' | 'indireto';
  faseLabel?: string;
  inicio: number;                  // 1º mês com valor (0-based; use duracao===0 p/ "sem valores")
  duracao: number;                 // nº de meses entre o 1º e o último valor (0 = sem valores)
  total: number;
  vpl: number;
  mensal: number[];
  itens?: LinhaCalc[];             // tipologias (receita) — sub-linhas
}

export interface FluxoCalc {
  prazo: number;
  meses: string[];                 // rótulos "jan/27" (ou "M1" sem data)
  receitaMensal: number[];
  custoMensal: number[];
  fluxoMensal: number[];
  fluxoAcumulado: number[];
  vgvTotal: number;
  vpl: number;
  tir: number | null;              // % a.a.
  paybackMes: number | null;       // índice 0-based no array mensal
  paybackData: string | null;      // "jul/2030"
  exposicaoMaxima: number;         // min(fluxoAcumulado) — tipicamente negativo
  linhasReceita: LinhaCalc[];
  linhasCusto: LinhaCalc[];
}

// ─────────────────────────────────────────────────────────────────
// 6B. Motor de receita
// ─────────────────────────────────────────────────────────────────

const INTERVALO_PERIODICIDADE: Record<string, number> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12,
};

/**
 * Normaliza um bloco de pagamento (Entrada / Parcelamento) para uma LISTA de
 * linhas. O modelo vigente (Lote 6 · #20) permite múltiplas linhas em cada
 * bloco; o legado guardava um único objeto — aqui ele vira uma lista de 1.
 */
export function normalizarLinhasPagamento(bloco: any): any[] {
  if (Array.isArray(bloco)) return bloco.filter(Boolean);
  if (bloco && typeof bloco === 'object') return [bloco];
  return [];
}

/** % do Repasse = 100 − Σ(entrada) − Σ(parcelas), derivado (Lote 6 · #20). */
export function pctRepasseDerivado(fp: any): number {
  const somaEntrada = normalizarLinhasPagamento(fp?.entrada).reduce((s, e) => s + n(e?.pct), 0);
  const somaParcelas = normalizarLinhasPagamento(fp?.parcelas).reduce((s, p) => s + n(p?.pct), 0);
  return Math.max(0, 100 - somaEntrada - somaParcelas);
}

/**
 * Recebimentos mensais de uma linha de receita (fase), em meses relativos.
 * Aplica absorção → vendas/mês e o fluxo de pagamento sobre cada venda:
 * cada linha de Entrada (parcelável a partir do mês da venda), cada linha de
 * Parcelamento (ao longo da obra ou por periodicidade) e o Repasse — cujo %
 * é derivado (100 − entradas − parcelas) — concentrado N meses após a Obra.
 * Comissão destacada e RET deduzem o valor recebível.
 */
export function receitaMensalLinha(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const saida = new Array<number>(Math.max(prazoTotal, 0)).fill(0);
  const vgv = vgvLinha(linha?.tipologias ?? []);
  if (vgv <= 0) return saida;

  const abs = absorcaoMensal(linha?.absorcao ?? { modo: 'linear' }, cronograma);
  if (!abs) return saida;

  const fator = vgv > 0 ? vglLinha(vgv, linha?.fluxo_pagamento) / vgv : 1;
  const fp = linha?.fluxo_pagamento ?? null;
  const entradas = normalizarLinhasPagamento(fp?.entrada);
  const parcelasLinhas = normalizarLinhasPagamento(fp?.parcelas);
  const pctRepasse = pctRepasseDerivado(fp);
  // Sem fluxo configurado (null) → recebe à vista no mês da venda.
  const semConfig = !fp;

  const obra = cronograma.find((e) => e.evento === 'obra');
  const fimObra = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;
  const mesRepasse = fimObra + Math.max(0, Math.round(n(fp?.repasse?.apos_entrega_meses)));

  const deposita = (mes: number, valor: number) => {
    if (valor === 0) return;
    const idx = Math.max(0, mes); // mês 0-based = índice; recebimentos antes do mês 0 caem no mês 0
    if (idx < saida.length) saida[idx] += valor;
    else if (saida.length > 0) saida[saida.length - 1] += valor; // proteção de horizonte
  };

  for (let i = 0; i < abs.pcts.length; i++) {
    const mesVenda = abs.inicio + i;
    const venda = (vgv * abs.pcts[i]) / 100;
    if (venda <= 0) continue;
    const recebivel = venda * fator;

    if (semConfig) { deposita(mesVenda, recebivel); continue; }

    // Entrada — cada linha parcelável a partir do mês da venda.
    for (const e of entradas) {
      const total = recebivel * (n(e?.pct) / 100);
      if (total <= 0) continue;
      const nParc = Math.max(1, Math.round(n(e?.parcelas) || 1));
      for (let k = 0; k < nParc; k++) deposita(mesVenda + k, total / nParc);
    }

    // Parcelamento — cada linha ao longo da obra ou por periodicidade.
    for (const p of parcelasLinhas) {
      const total = recebivel * (n(p?.pct) / 100);
      if (total <= 0) continue;
      if (p?.ao_longo_obra && fimObra > mesVenda) {
        const meses = fimObra - mesVenda; // mensal, do mês seguinte até o fim da obra
        for (let k = 1; k <= meses; k++) deposita(mesVenda + k, total / meses);
      } else {
        const intervalo = INTERVALO_PERIODICIDADE[p?.periodicidade] ?? 1;
        const nParc = Math.max(1, Math.round(n(p?.parcelas) || 1));
        for (let k = 1; k <= nParc; k++) deposita(mesVenda + intervalo * k, total / nParc);
      }
    }

    // Repasse — % derivado, concentrado na entrega (independe do mês da venda).
    deposita(Math.max(mesRepasse, mesVenda), recebivel * (pctRepasse / 100));
  }
  return saida;
}

// ─────────────────────────────────────────────────────────────────
// Indicadores financeiros
// ─────────────────────────────────────────────────────────────────

/** VPL de um fluxo mensal à taxa anual dada (desconto mensal equivalente). */
export function vplFluxo(fluxoMensal: number[], taxaAa: number): number {
  const tm = Math.pow(1 + n(taxaAa) / 100, 1 / 12) - 1;
  return fluxoMensal.reduce((s, cf, i) => s + cf / Math.pow(1 + tm, i + 1), 0);
}

/**
 * TIR anual (%) por Newton-Raphson sobre a taxa mensal.
 * Retorna null se o fluxo não muda de sinal ou se não convergir.
 */
export function tirFluxo(fluxoMensal: number[]): number | null {
  const temPos = fluxoMensal.some((v) => v > 0);
  const temNeg = fluxoMensal.some((v) => v < 0);
  if (!temPos || !temNeg) return null;

  const npv = (r: number) => fluxoMensal.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i + 1), 0);
  const dnpv = (r: number) => fluxoMensal.reduce((s, cf, i) => s - ((i + 1) * cf) / Math.pow(1 + r, i + 2), 0);

  let r = 0.01;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-7) break;
    const d = dnpv(r);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
    const novo = r - f / d;
    if (!Number.isFinite(novo) || novo <= -0.999) return null;
    if (Math.abs(novo - r) < 1e-10) { r = novo; break; }
    r = novo;
  }
  if (Math.abs(npv(r)) > 1e-3) return null; // não convergiu
  return (Math.pow(1 + r, 12) - 1) * 100;
}

// ─────────────────────────────────────────────────────────────────
// 6D. Fluxo consolidado
// ─────────────────────────────────────────────────────────────────

function recorte(mensal: number[]): { inicio: number; duracao: number } {
  let primeiro = -1; let ultimo = -1;
  for (let i = 0; i < mensal.length; i++) {
    if (Math.abs(mensal[i]) > 1e-9) { if (primeiro < 0) primeiro = i; ultimo = i; }
  }
  // mês 0-based coincide com o índice → o 1º mês com valor é o próprio índice.
  if (primeiro < 0) return { inicio: 0, duracao: 0 };
  return { inicio: primeiro, duracao: ultimo - primeiro + 1 };
}

export function calcularFluxo(config: FluxoConfig): FluxoCalc {
  const crono = config.cronograma ?? [];
  const linhasReceita = config.linhasReceita ?? [];
  const linhasCusto = config.linhasCusto ?? [];
  const taxa = n(config.taxaDescontoAa) || 12;

  // Horizonte: usa prazoMeses se dado; senão deriva do conteúdo (+ folga de
  // repasse/parcelas, já protegida em receitaMensalLinha). Meses 0-based: o
  // último mês usado é `ultimo*`, então o comprimento do array é `ultimo* + 1`.
  const ultimoCrono = Math.max(0, ...crono.map((e) => n(e.inicio_mes) + n(e.duracao_meses) - 1));
  const ultimoCustos = Math.max(0, ...linhasCusto.map((c) => n(c.inicio_mes) + n(c.duracao_meses) - 1));
  const maxRepasse = Math.max(0, ...linhasReceita.map((l) => n(l?.fluxo_pagamento?.repasse?.apos_entrega_meses)));
  const prazoDerivado = Math.max(ultimoCrono + maxRepasse, ultimoCustos, 11) + 1;
  const prazo = Math.max(1, Math.round(n(config.prazoMeses) || prazoDerivado));

  const ctxCusto: ContextoCusto = {
    areaPrivativaTotal: areaPrivativaTotalLinhas(linhasReceita),
    areaTerreno: n(config.areaTerreno),
    vgvTotal: linhasReceita.reduce((s, l) => s + vgvLinha(l.tipologias), 0),
  };
  ctxCusto.receitaTotal = linhasReceita.reduce(
    (s, l) => s + vglLinha(vgvLinha(l.tipologias), l.fluxo_pagamento), 0);

  // Receitas por linha (e por tipologia, proporcional ao VGV da tipologia).
  const calcReceitas: LinhaCalc[] = linhasReceita.map((l) => {
    const mensal = receitaMensalLinha(l, crono, prazo);
    const vgvL = vgvLinha(l.tipologias);
    const r = recorte(mensal);
    const itens: LinhaCalc[] = (l.tipologias ?? []).map((t: any) => {
      const propor = vgvL > 0 ? vgvTipologia(t) / vgvL : 0;
      const mensalTip = mensal.map((v) => v * propor);
      const rt = recorte(mensalTip);
      return {
        id: t.id, nome: t.nome || 'Tipologia', grupo: 'receita' as const,
        inicio: rt.inicio, duracao: rt.duracao,
        total: mensalTip.reduce((s, v) => s + v, 0),
        vpl: vplFluxo(mensalTip, taxa),
        mensal: mensalTip,
      };
    });
    return {
      id: l.id, nome: l.nome || 'Receita', grupo: 'receita' as const,
      faseLabel: l.fase_label || undefined,
      inicio: r.inicio, duracao: r.duracao,
      total: mensal.reduce((s, v) => s + v, 0),
      vpl: vplFluxo(mensal, taxa),
      mensal, itens,
    };
  });

  // Custos por linha (valores positivos; sinal aplicado na consolidação).
  const curvasPorId = new Map<number, CurvaPersonalizada>(
    (config.curvas ?? []).map((k: any) => [Number(k.id), (k.valores ?? []) as CurvaPersonalizada]));
  const calcCustos: LinhaCalc[] = linhasCusto.map((c) => {
    const total = resolverCustoTotal(c, ctxCusto);
    const curva = c.curva_id ? (curvasPorId.get(Number(c.curva_id)) ?? 'linear') : 'linear';
    const mensal = distribuirLinha(total, n(c.inicio_mes), n(c.duracao_meses), curva, prazo);
    const nome = [c.categoria, c.subcategoria].filter(Boolean).join(' — ') || 'Custo';
    return {
      id: c.id, nome,
      grupo: (c.grupo === 'terreno' || c.grupo === 'obra' ? c.grupo : 'indireto') as LinhaCalc['grupo'],
      inicio: n(c.inicio_mes), duracao: n(c.duracao_meses),
      total,
      vpl: vplFluxo(mensal, taxa),
      mensal,
    };
  });

  const receitaMensal = new Array<number>(prazo).fill(0);
  for (const l of calcReceitas) for (let i = 0; i < prazo; i++) receitaMensal[i] += l.mensal[i];
  const custoMensal = new Array<number>(prazo).fill(0);
  for (const c of calcCustos) for (let i = 0; i < prazo; i++) custoMensal[i] += c.mensal[i];

  const fluxoMensal = receitaMensal.map((r, i) => r - custoMensal[i]);
  const fluxoAcumulado: number[] = [];
  let acc = 0;
  for (const v of fluxoMensal) { acc += v; fluxoAcumulado.push(acc); }

  const paybackMes = fluxoAcumulado.findIndex((v, i) => v >= 0 && fluxoMensal.slice(0, i + 1).some((x) => x < 0));
  const exposicaoMaxima = fluxoAcumulado.length ? Math.min(...fluxoAcumulado) : 0;

  return {
    prazo,
    meses: Array.from({ length: prazo }, (_, i) => rotuloMesRelativo(config.dataInicio, i)),
    receitaMensal, custoMensal, fluxoMensal, fluxoAcumulado,
    vgvTotal: ctxCusto.vgvTotal,
    vpl: vplFluxo(fluxoMensal, taxa),
    tir: tirFluxo(fluxoMensal),
    paybackMes: paybackMes >= 0 ? paybackMes : null,
    paybackData: paybackMes >= 0 ? mesRelativoCompleto(config.dataInicio, paybackMes) : null,
    exposicaoMaxima,
    linhasReceita: calcReceitas,
    linhasCusto: calcCustos,
  };
}

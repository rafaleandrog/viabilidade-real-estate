// Repartição de uma safra do plano de pagamento LEGADO (entrada, parcelas e
// repasse, sem `componentes`) em pedaços que somam o líquido contratado da safra
// ao centavo. Módulo puro: quem chama entrega os vencimentos já resolvidos.

const n = (v: any): number => Number(v) || 0;
const round2 = (v: number): number => Math.round(v * 100) / 100;

export interface PedacoSafraLegado {
  /** Valor do pedaço, a 2 casas. */
  total: number;
  /** Mês de cada parcela do pedaço (0-based). */
  meses: number[];
}

/**
 * Os pedaços da safra, na ordem entrada → parcelamento → repasse. Cada um
 * recebe `round2` da sua fatia; o ÚLTIMO pedaço com valor fica com o RESTO —
 * `round2(venda × Σpct/100) − round2(desconto) − Σ(anteriores)` —, de modo que a
 * soma é o líquido contratado da safra (o mesmo número do desconto comercial
 * mensal). Cada pedaço é depois partido em parcelas por `partirPedaco`.
 */
export function pedacosSafraLegado(
  venda: number,
  mesVenda: number,
  entradas: any[],
  parcelas: any[],
  pctRepasse: number,
  mesRepasse: number,
  intervaloDe: (p: any) => number,
  vencimentosAoLongoObra: (p: any) => number[],
): PedacoSafraLegado[] {
  const pedacos: PedacoSafraLegado[] = [];
  let somaPct = 0;
  let desconto = 0;
  for (const e of entradas) {
    const bruto = venda * (n(e?.pct) / 100);
    if (bruto <= 0) continue;
    somaPct += n(e?.pct);
    desconto += bruto * (n(e?.descontoPct) / 100);
    const nParc = Math.max(1, Math.round(n(e?.parcelas) || 1));
    pedacos.push({
      total: round2(bruto * (1 - n(e?.descontoPct) / 100)),
      meses: Array.from({ length: nParc }, (_, k) => mesVenda + k),
    });
  }
  for (const p of parcelas) {
    const total = venda * (n(p?.pct) / 100);
    if (total <= 0) continue;
    somaPct += n(p?.pct);
    const nParc = Math.max(1, Math.round(n(p?.parcelas) || 1));
    pedacos.push({
      total: round2(total),
      meses: p?.ao_longo_obra
        ? vencimentosAoLongoObra(p)
        : Array.from({ length: nParc }, (_, k) => mesVenda + intervaloDe(p) * (k + 1)),
    });
  }
  if (venda * (pctRepasse / 100) !== 0) {
    somaPct += pctRepasse;
    pedacos.push({ total: round2(venda * (pctRepasse / 100)), meses: [Math.max(mesRepasse, mesVenda)] });
  }
  let ultimo = -1;
  pedacos.forEach((p, i) => { if (p.total > 0 && p.meses.length > 0) ultimo = i; });
  if (ultimo >= 0) {
    const anteriores = pedacos.reduce((s, p, i) => (i === ultimo ? s : round2(s + p.total)), 0);
    pedacos[ultimo].total = round2(round2(venda * (somaPct / 100)) - round2(desconto) - anteriores);
  }
  return pedacos;
}

/** As parcelas de um pedaço: `round2` da fatia igual, e a última fica com o resto. */
export function partirPedaco(pedaco: PedacoSafraLegado): number[] {
  let depositado = 0;
  return pedaco.meses.map((_, k) => {
    const parcela = k === pedaco.meses.length - 1
      ? round2(pedaco.total - depositado)
      : round2(pedaco.total / pedaco.meses.length);
    depositado = round2(depositado + parcela);
    return parcela;
  });
}

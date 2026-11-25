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
 * Os pedaços da safra, na ordem entrada → parcelamento → repasse, somando o
 * líquido contratado da safra ao centavo:
 * `round2(venda × Σpct/100) − round2(desconto)` (o mesmo número do desconto
 * comercial mensal). A repartição é por ARREDONDAMENTO ACUMULADO: o pedaço `i`
 * recebe `round2(alvo × A_i) − round2(alvo × A_{i−1})`, onde `A_i` é a fração
 * acumulada do valor nominal até ele. Assim a soma fecha no alvo por
 * construção, nenhum pedaço fica negativo (as frações são crescentes) e nenhum
 * centavo some quando todos os pedaços são menores que meio centavo. Cada
 * pedaço é depois partido em parcelas por `partirPedaco`, pela mesma regra.
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
  const nominais: number[] = [];
  let somaPct = 0;
  let desconto = 0;
  for (const e of entradas) {
    const bruto = venda * (n(e?.pct) / 100);
    if (bruto <= 0) continue;
    somaPct += n(e?.pct);
    desconto += bruto * (n(e?.descontoPct) / 100);
    const nParc = Math.max(1, Math.round(n(e?.parcelas) || 1));
    nominais.push(bruto * (1 - n(e?.descontoPct) / 100));
    pedacos.push({
      total: 0,
      meses: Array.from({ length: nParc }, (_, k) => mesVenda + k),
    });
  }
  for (const p of parcelas) {
    const total = venda * (n(p?.pct) / 100);
    if (total <= 0) continue;
    somaPct += n(p?.pct);
    const nParc = Math.max(1, Math.round(n(p?.parcelas) || 1));
    nominais.push(total);
    pedacos.push({
      total: 0,
      meses: p?.ao_longo_obra
        ? vencimentosAoLongoObra(p)
        : Array.from({ length: nParc }, (_, k) => mesVenda + intervaloDe(p) * (k + 1)),
    });
  }
  if (venda * (pctRepasse / 100) !== 0) {
    somaPct += pctRepasse;
    nominais.push(venda * (pctRepasse / 100));
    pedacos.push({ total: 0, meses: [Math.max(mesRepasse, mesVenda)] });
  }
  const alvo = round2(round2(venda * (somaPct / 100)) - round2(desconto));
  repartirAcumulado(alvo, nominais).forEach((v, i) => { pedacos[i].total = v; });
  return pedacos;
}

/**
 * Reparte `alvo` (a 2 casas) proporcionalmente a `pesos`, por arredondamento
 * acumulado: a soma é exatamente `alvo`, e com pesos de mesmo sinal nenhuma
 * fatia tem sinal oposto ao do alvo. Sem peso (Σ = 0), tudo é zero.
 */
export function repartirAcumulado(alvo: number, pesos: number[]): number[] {
  const soma = pesos.reduce((s, p) => s + p, 0);
  if (soma === 0) return pesos.map(() => 0);
  let acumulado = 0;
  let anterior = 0;
  return pesos.map((p, i) => {
    acumulado += p;
    const ate = i === pesos.length - 1 ? alvo : round2(alvo * (acumulado / soma));
    const fatia = round2(ate - anterior);
    anterior = ate;
    return fatia;
  });
}

/** As parcelas de um pedaço, em fatias iguais por arredondamento acumulado: somam o total ao centavo. */
export function partirPedaco(pedaco: PedacoSafraLegado): number[] {
  return repartirAcumulado(pedaco.total, pedaco.meses.map(() => 1));
}

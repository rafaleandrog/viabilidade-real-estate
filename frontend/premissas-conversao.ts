// Conversão automática entre unidades de um mesmo campo (ao trocar a unidade via
// badge). Cada unidade representa a MESMA quantidade base — um valor em R$ (custos
// e permuta financeira) ou uma área em m² (permuta física) — e converte-se
// `unidade atual → base → unidade nova` usando a "grandeza de ligação" (VGV, área
// de venda, área privativa), que o motor calcula independentemente do próprio campo
// (sem circularidade). Funções puras, cobertas por testes nos dois tipos de estudo.

export type LinkKey =
  | 'vgv' | 'vgvResidencial' | 'vgvNaoResidencial'
  | 'areaVendavel' | 'areaVendavelR' | 'areaVendavelNR' | 'areaPrivativa';

// identidade: o valor já é a base (R$ fixo, R$ total, m²).
// pct: o valor é % da grandeza de ligação (ex.: % do VGV, % da área de venda).
// por_area: o valor é por m² da grandeza (ex.: R$/m² × área).
export type ConvUnidade =
  | { tipo: 'identidade' }
  | { tipo: 'pct'; link: LinkKey }
  | { tipo: 'por_area'; link: LinkKey };

export type CtxConversao = Record<LinkKey, number>;

// Valor da unidade → quantidade base. null = não há base definida (grandeza de
// ligação 0/indefinida) ou valor inválido — nesse caso não se converte.
export function paraBase(conv: ConvUnidade, valor: number, ctx: CtxConversao): number | null {
  if (!Number.isFinite(valor)) return null;
  if (conv.tipo === 'identidade') return valor;
  const x = ctx[conv.link];
  if (!(x > 0)) return null;
  return conv.tipo === 'pct' ? (valor / 100) * x : valor * x;
}

// Base → valor da unidade nova. null = não dá pra converter (grandeza 0).
export function daBase(conv: ConvUnidade, base: number, ctx: CtxConversao): number | null {
  if (!Number.isFinite(base)) return null;
  if (conv.tipo === 'identidade') return base;
  const x = ctx[conv.link];
  if (!(x > 0)) return null;
  return conv.tipo === 'pct' ? (base / x) * 100 : base / x;
}

// Converte o valor da unidade atual para a unidade nova. Arredonda a 2 casas.
// Retorna null quando não deve converter (base indefinida) — a UI mantém o valor
// atual do campo destino nesse caso.
export function converterUnidade(
  convAtual: ConvUnidade, convNova: ConvUnidade, valorAtual: number, ctx: CtxConversao,
): number | null {
  const base = paraBase(convAtual, valorAtual, ctx);
  if (base === null) return null;
  const novo = daBase(convNova, base, ctx);
  if (novo === null) return null;
  return Math.round(novo * 100) / 100;
}

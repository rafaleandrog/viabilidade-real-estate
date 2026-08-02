// Conversão automática entre unidades de um mesmo campo (ao trocar a unidade via
// badge). Cada unidade representa a MESMA quantidade base — um valor em R$ (custos
// e permuta financeira) ou uma área em m² (permuta física) — e converte-se
// `unidade atual → base → unidade nova` usando a "grandeza de ligação" (VGV, área
// de venda, área privativa), que o motor calcula independentemente do próprio campo
// (sem circularidade). Funções puras, cobertas por testes nos dois tipos de estudo.

export type LinkKey =
  | 'vgv' | 'vgvResidencial' | 'vgvNaoResidencial'
  | 'areaVendavel' | 'areaVendavelR' | 'areaVendavelNR' | 'areaPrivativa'
  // Grandezas adicionais usadas pelos custos do Avançado (tela-fluxo-custos):
  // R$/m² de terreno e % da receita. As de cima seguem servindo o Preliminar.
  | 'areaTerreno' | 'receita';

// identidade: o valor já é a base (R$ fixo, R$ total, m²).
// pct: o valor é % da grandeza de ligação (ex.: % do VGV, % da área de venda).
// por_area: o valor é por m² da grandeza (ex.: R$/m² × área).
export type ConvUnidade =
  | { tipo: 'identidade' }
  | { tipo: 'pct'; link: LinkKey }
  | { tipo: 'por_area'; link: LinkKey };

// Parcial: nem todo consumidor supre todas as grandezas (o Preliminar não usa
// areaTerreno/receita; o Avançado não usa areaVendavel*). Chave ausente = base
// indefinida → não converte (mesmo efeito de grandeza 0).
export type CtxConversao = Partial<Record<LinkKey, number>>;

// Valor da unidade → quantidade base. null = não há base definida (grandeza de
// ligação 0/indefinida) ou valor inválido — nesse caso não se converte.
export function paraBase(conv: ConvUnidade, valor: number, ctx: CtxConversao): number | null {
  if (!Number.isFinite(valor)) return null;
  if (conv.tipo === 'identidade') return valor;
  const x = ctx[conv.link];
  if (x === undefined || !(x > 0)) return null;
  return conv.tipo === 'pct' ? (valor / 100) * x : valor * x;
}

// Base → valor da unidade nova. null = não dá pra converter (grandeza 0).
export function daBase(conv: ConvUnidade, base: number, ctx: CtxConversao): number | null {
  if (!Number.isFinite(base)) return null;
  if (conv.tipo === 'identidade') return base;
  const x = ctx[conv.link];
  if (x === undefined || !(x > 0)) return null;
  return conv.tipo === 'pct' ? (base / x) * 100 : base / x;
}

// Converte o valor da unidade atual para a unidade nova. Retorna null quando não
// deve converter (base indefinida) — a UI mantém o valor atual do campo destino
// nesse caso.
//
// #259 (contrato C7 — decisão do autor, 2026-08-01): o valor canônico de uma
// premissa multiunidade é o MONETÁRIO (R$ ou m², `decimal(12,2)` na
// persistência) — só ele arredonda aqui, a 2 casas. `%` e `R$/m²` são
// representações DERIVADAS: carregam precisão plena e arredondam só para
// EXIBIR (`fmtPct`/`fmtR$`, na camada de UI, nunca aqui). Arredondar a
// derivada antes de devolver é o defeito que esta issue corrige — persistida,
// ela faz o valor canônico perder o round-trip (R$ 10.000.000 que passa por
// 12,09% arredondado volta como R$ 9.999.998,76).
export function converterUnidade(
  convAtual: ConvUnidade, convNova: ConvUnidade, valorAtual: number, ctx: CtxConversao,
): number | null {
  const base = paraBase(convAtual, valorAtual, ctx);
  if (base === null) return null;
  const novo = daBase(convNova, base, ctx);
  if (novo === null) return null;
  return convNova.tipo === 'identidade' ? Math.round(novo * 100) / 100 : novo;
}

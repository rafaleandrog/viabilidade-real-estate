// Funções puras usadas por `scripts/conferir-estudo.ts`, em módulo próprio para
// serem testáveis: o script exige `URBI_TOKEN` e encerra o processo ao ser
// importado. A conta é reescrita aqui de propósito (não importa o motor): é a
// conferência independente do `vgvTotal`.
const n = (v: any): number => Number(v) || 0;

// Mesma associação do motor: `fechada × preço + aberta × preço`, e não
// `(fechada + aberta) × preço` (muda o último bit em float).
const unitario = (fechada: any, aberta: any, preco: any): number =>
  n(fechada) * n(preco) + n(aberta) * n(preco);

/** Σ das alocações nas linhas de receita: `quantidade × (fechada×preço + aberta×preço)`, com o preço da ALOCAÇÃO. */
export function vgvAlocacoes(receitas: any[]): number {
  return (receitas ?? []).reduce((s: number, l: any) =>
    s + (l?.tipologias ?? []).reduce((a: number, t: any) =>
      a + n(t?.quantidade) * unitario(t?.area_privativa_m2, t?.area_privativa_aberta_m2, t?.preco_m2), 0), 0);
}

/**
 * VGV a partir do catálogo: as unidades alocadas de cada tipologia valem as
 * áreas do catálogo ao preço da alocação; o estoque não alocado
 * (`max(0, quantidade − Σ alocado)`) vale ao preço do catálogo. Com o estoque
 * todo alocado bate com o `vgvTotal` do motor; estoque não alocado continua
 * acusado (o motor só valora o que está alocado).
 */
export function vgvCatalogo(tipologias: any[], receitas: any[]): number {
  return (tipologias ?? []).reduce((s: number, t: any) => {
    const alocs = (receitas ?? []).flatMap((l: any) => l?.tipologias ?? [])
      .filter((a: any) => Number(a?.tipologia_id) === Number(t?.id));
    const alocado = alocs.reduce((q: number, a: any) => q + n(a?.quantidade), 0);
    const valorAlocado = alocs.reduce((v: number, a: any) =>
      v + n(a?.quantidade) * unitario(t?.area_privativa_m2, t?.area_privativa_aberta_m2, a?.preco_m2), 0);
    const resto = Math.max(0, n(t?.quantidade) - alocado);
    return s + valorAlocado + resto * unitario(t?.area_privativa_m2, t?.area_privativa_aberta_m2, t?.preco_m2);
  }, 0);
}

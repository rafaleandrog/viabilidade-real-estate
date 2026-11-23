// Permuta física DECLARADA POR PRODUTO do catálogo do Preliminar.
//
// Módulo próprio, sem importar `proforma.ts` (que o importa): a regra é pura e
// a tela de Permutas a lê pelo mesmo caminho do motor, para nunca mostrar um
// controle habilitado que a Proforma ignora — nem o contrário.

/** O mínimo que a regra lê de uma linha do catálogo — `ProdutoPreliminar` satisfaz. */
export interface LinhaPermuta {
  area_media_m2?: number | string | null;
  preco_venda_m2?: number | string | null;
  unidades?: number | string | null;
  unidades_permutadas?: number | string | null;
  tipo?: string | null;
}

/**
 * Unidades permutadas de uma linha do catálogo, já no domínio válido: número
 * finito ≥ 0 e NUNCA acima das `unidades` da própria linha — não se entrega em
 * permuta mais do que o produto tem. Lixo (texto, negativo, NaN) vale 0, o
 * fail-closed da armadilha 14: a API já recusa, mas o motor também lê estudo
 * gravado por outro caminho.
 */
export function unidadesPermutadasDoProduto(p: LinhaPermuta): number {
  const un = Math.max(0, Number(p.unidades) || 0);
  const perm = Number(p.unidades_permutadas);
  if (!Number.isFinite(perm) || perm <= 0) return 0;
  return Math.min(perm, un);
}

/** Permuta física declarada por produto, de UMA categoria: m² entregues e VGV a preço do produto. */
export interface PermutaPorProdutos { ativa: boolean; unidades: number; areaM2: number; vgv: number }

/**
 * Permuta física de uma categoria a partir das linhas do catálogo DELA —
 * área = Σ unidades_permutadas × área do produto; VGV = Σ unidades_permutadas ×
 * área × preço DO PRODUTO. As linhas chegam já reprecificadas pelo fator de
 * stress (`catalogoEstressado`): o preço de cada produto já carrega o fator, e
 * reaplicá-lo aqui o elevaria ao quadrado. `ativa` = alguma linha entrega
 * unidade em permuta; só então a categoria deixa o modo por área.
 */
export function permutaFisicaDeProdutos(linhas: LinhaPermuta[]): PermutaPorProdutos {
  let unidades = 0, areaM2 = 0, vgv = 0;
  for (const l of linhas) {
    const u = unidadesPermutadasDoProduto(l);
    if (u <= 0) continue;
    const area = u * (Number(l.area_media_m2) || 0);
    unidades += u;
    areaM2 += area;
    vgv += area * (Number(l.preco_venda_m2) || 0);
  }
  return { ativa: unidades > 0, unidades, areaM2, vgv };
}

/**
 * A permuta por produto de cada categoria. O Loteamento tem um bucket só
 * (residencial): a tela de Permutas dele só expõe o controle residencial, então
 * todas as linhas entram nele, como em `totaisPorTipoProdutos` no motor.
 */
export function permutaFisicaPorCategoria(
  catalogo: LinhaPermuta[], lot: boolean,
): { residencial: PermutaPorProdutos; nao_residencial: PermutaPorProdutos } {
  const daCategoria = (t: 'residencial' | 'nao_residencial') => permutaFisicaDeProdutos(
    lot ? (t === 'residencial' ? catalogo : []) : catalogo.filter((p) => (p.tipo === 'nao_residencial' ? 'nao_residencial' : 'residencial') === t),
  );
  return { residencial: daCategoria('residencial'), nao_residencial: daCategoria('nao_residencial') };
}


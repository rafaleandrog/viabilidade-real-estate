// Estudo sem catálogo de Produtos efetivo (`semProdutos` de `calcularProforma`):
// os textos e a escolha do texto que as telas do Preliminar mostram nessa
// condição. Fica fora das telas para a Proforma, a aba Gráficos e o Resumo de
// Premissas dizerem a MESMA coisa, e para a escolha ser testável sem montar tela.

export const SEM_PRODUTOS_ICONE = 'fa-solid fa-boxes-stacked';
export const SEM_PRODUTOS_MENSAGEM = 'Nenhum produto com área, preço e unidades cadastrado.';
export const SEM_PRODUTOS_SUBMENSAGEM =
  'Os resultados saem do catálogo de Produtos: preencha as três colunas em Premissas → Produtos para ver VGV, custos e resultado.';

export const PRECO_SUGERIDO_SEM_PRODUTOS =
  'cadastre os produtos (área, preço e unidades em Premissas → Produtos) para calcular';
export const PRECO_SUGERIDO_INATINGIVEL = 'inatingível com as premissas atuais';

/**
 * O que o banner do preço sugerido mostra no lugar do valor, ou `null` quando
 * há valor a formatar. Catálogo ainda carregando mantém o comportamento
 * anterior ao carregamento: só o `precoSug` decide.
 */
export function textoPrecoSugerido(a: {
  catalogoCarregado: boolean;
  semProdutos: boolean;
  precoSug: number | null;
}): string | null {
  if (a.catalogoCarregado && a.semProdutos) return PRECO_SUGERIDO_SEM_PRODUTOS;
  if (a.precoSug === null) return PRECO_SUGERIDO_INATINGIVEL;
  return null;
}

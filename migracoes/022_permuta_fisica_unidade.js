// 022_permuta_fisica_unidade.js — #317
//
// Adiciona a terceira unidade da Permuta física do Preliminar: "unidade" (nº
// de produtos do catálogo `preliminar_produtos`, #315), ao lado de m² e %
// área venda que já existiam. `permuta_fisica_modo`/`permuta_fisica_nr_modo`
// ganham o valor `unidade` (padrão continua `area_m2` — comportamento atual
// inalterado); `permuta_fisica_produto_id`/`_quantidade` (e os pares `_nr_*`)
// são colunas aditivas novas, com DEFAULT nulo/0.
//
// Forward-only. Colunas aditivas materializadas pelo sincronizador de schema
// do SDK; não há dado existente a transformar — nenhum estudo pré-existente
// tem produto/quantidade selecionados, e o modo de quem já usava m²/% área
// venda não muda.

export default async function ({ dados }) {
  void dados;
}

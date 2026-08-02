// 016_permuta_fisica_referencia.js — #266
//
// Adiciona `permuta_tipologia_id` e `permuta_quantidade` a
// avancado_linhas_custo: a linha de Preço do Terreno com subcategoria
// "Permuta física" (#257) passa a referenciar uma tipologia do catálogo do
// estudo + a quantidade entregue, em vez de um valor puramente em caixa —
// preparação de dado para a nova fonte de verdade da permuta física (#267),
// que substituirá `avancado_tipologias.unidades_permutadas`.
//
// Este PR entrega só o MODELO e a UI (#266); o motor que consome estas
// colunas para valorar a permuta (ADR: valor declarado pelo usuário, nunca
// derivado — ver docs/viabilidade/padrao-incorporacao.md §15.1) é o #268,
// e a migração de dado que desliga `unidades_permutadas` é o #267→#253.
//
// Forward-only. Colunas aditivas, nulas por padrão — materializadas pelo
// sincronizador de schema do SDK (schema.json é a fonte de verdade); não há
// dado existente a transformar aqui.

export default async function ({ dados }) {
  void dados;
}

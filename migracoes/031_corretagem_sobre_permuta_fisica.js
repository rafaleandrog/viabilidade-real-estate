// 031_corretagem_sobre_permuta_fisica.js — issue #473 (Rodada 8, R8-48)
//
// Adiciona `corretagem_sobre_permuta_fisica` a `estudos`: escolhe se a
// Corretagem de vendas do Avançado incide sobre o VGV BRUTO (permuta física
// inclusa, comportamento histórico) ou sobre o VGV VENDÁVEL (exclui a
// permuta física, alinhando a corretagem à mesma base de
// `vendaBrutaContratadaMensal`/baixa de estoque). Só o Avançado lê a chave
// (`CAMPOS_SOMENTE_AVANCADO`); o Preliminar não muda.
//
// NO-OP DOCUMENTADO, não backfill — mesmo padrão de
// `023_checkbox_custos_indiretos.js`. A coluna é aditiva, "padrao": true, e
// o sincronizador de schema do SDK materializa esse default em todo estudo
// pré-existente: nenhum dado precisa ser transformado, porque o default
// JÁ reproduz o comportamento de hoje (VGV bruto — nenhum estudo existente
// muda de número). Esta migração existe só para carregar o degrau de
// `versao` que o guard "migração nova ⇄ bump" exige.
//
// Forward-only. Nenhum seed, nenhuma linha criada, nenhum valor de negócio
// inventado.

export default async function ({ dados }) {
  void dados;
}

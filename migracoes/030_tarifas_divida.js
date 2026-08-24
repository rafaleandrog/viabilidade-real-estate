// 030_tarifas_divida.js — issue #478 (Rodada 8, R8-53)
//
// Três colunas novas em `avancado_funding_operacoes`, aplicáveis à dívida
// (`taxa_estruturacao_pct`, `taxa_administracao_mensal`,
// `outros_encargos_iniciais`) — o custo real de uma operação bancária
// (estruturação, administração, encargos iniciais) que hoje não é modelado
// por nenhuma operação de funding. Entram em `saidas` (TIR do investidor e
// fluxo alavancado), nunca no saldo devedor — tarifa não é principal.
//
// ⚠️ A numeração `030` não está queimada pela recusa do `linha_credito`
// (decisão do autor que motivou esta issue): a migração recusada NUNCA foi
// escrita neste repositório, então o número seguinte livre continua sendo
// `030`. Esta é uma dentre QUATRO migrações candidatas a `030` na Onda 8
// (#459, #462, #473, #478) — o número real depois do merge é o que
// `git ls-tree origin/main migracoes/` mostrar naquele momento; renumeie se
// outra tiver mergeado primeiro.
//
// NO-OP DOCUMENTADO, não backfill — mesmo padrão de
// `023_checkbox_custos_indiretos.js`. As três colunas são aditivas, com
// "padrao": 0, e o sincronizador de schema do SDK materializa esse default
// em toda operação pré-existente: nenhum dado precisa ser transformado,
// porque o default já reproduz o comportamento de hoje (nenhuma tarifa —
// nenhum estudo existente muda de número). Esta migração existe só para
// carregar o degrau de `versao` que o guard "migração nova ⇄ bump" exige.
//
// Forward-only. Nenhum seed, nenhuma linha criada, nenhum valor de negócio
// inventado.

export default async function ({ dados }) {
  void dados;
}

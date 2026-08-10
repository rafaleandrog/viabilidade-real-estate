// 026_cronograma_evento_lancamento.js — item 37 da planilha (Rodada 7,
// BUG7-31, #339).
//
// `avancado_linhas_custo.cronograma_evento` ganha a opção `lancamento` no
// schema (a coluna já é `texto` com `limite: 20` — "lancamento" cabe sem
// alterar o tamanho). Faltava nas três camadas espelhadas — frontend
// (EVENTOS_ANCORA, tela-fluxo-custos.ts), backend (EVENTOS_ANCORA,
// avancado.ts) e aqui no schema — enquanto `avancado_cronograma.evento` já
// tinha a opção desde sempre.
//
// Forward-only, no-op: nenhuma linha existente tem `cronograma_evento =
// 'lancamento'` (a opção não existia para ser escolhida), então não há dado a
// transformar — só a lista de valores aceitos mudou.

export default async function ({ dados }) {
  void dados;
}

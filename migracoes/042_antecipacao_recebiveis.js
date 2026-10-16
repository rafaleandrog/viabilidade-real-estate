// 042_antecipacao_recebiveis.js — #851.
//
// `avancado_funding_operacoes` ganha o quarto tipo de operação,
// `antecipacao_recebiveis` (opção nova em `tipo`), e a coluna
// `pct_carteira_cedida` (decimal 5,2, padrao 0) — o percentual do lastro de
// recebíveis cedido na operação. A taxa de desconto reaproveita `taxa_anual`;
// as tarifas reaproveitam `taxa_estruturacao_pct`, `taxa_administracao_mensal`
// e `outros_encargos_iniciais`; o mês da cessão reaproveita a âncora
// (`cronograma_evento`/`fase_ancora_id`/`inicio_mes`).
//
// Forward-only, NO-OP — mesmo padrão de `032_tarifas_divida.js` e
// `039_financiamento_producao_ativo.js`. A coluna é aditiva, com padrão 0, e o
// sincronizador de schema do SDK materializa o default; nenhuma operação
// existente é antecipação, então não há dado a transformar e nenhum número
// muda. A migração existe para carregar o degrau de `versao`: a coluna e a
// opção nova mudam o schema, e o SDK bumpa a `versao` nesse caso; o guard deste
// repositório só aceita bump com migração nova, então o degrau vem com esta.

export default async function ({ dados }) {
  void dados;
}

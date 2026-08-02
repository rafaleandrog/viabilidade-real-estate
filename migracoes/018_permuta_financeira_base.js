// 018_permuta_financeira_base.js — #238
//
// Adiciona `permuta_financeira_base` a avancado_linhas_custo: qual das duas
// visões do regime de caixa (padrao-incorporacao.md §15.2) alimenta o fluxo
// para a linha de Preço/Permuta financeira — `bruta` (receita de caixa × %
// de permuta) ou `liquida` (receita de caixa − imposto − corretagem, × % de
// permuta). Default `bruta` preserva o resultado de todo estudo existente,
// que hoje não deduz imposto/corretagem da base da permuta.
//
// Forward-only. Coluna aditiva, com padrão — materializada pelo
// sincronizador de schema do SDK (schema.json é a fonte de verdade); não há
// dado existente a transformar.

export default async function ({ dados }) {
  void dados;
}

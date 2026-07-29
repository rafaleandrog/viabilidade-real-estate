// 013_mercado_regioes_coletas.js — #200
//
// Cria as duas entidades da COLETA DIÁRIA de mercado (framework de rotinas do
// UrbiVerso, `rotinas.coleta_mercado_diaria`, frequência `diaria`):
//
//   · `mercado_regioes` — regiões administrativas/bairros que a instância
//     monitora, com as palavras-chave de busca. É registro GLOBAL da app (não
//     por estudo), editado em Admin → Apps → viabilidade → Regiões monitoradas.
//   · `mercado_coletas` — os itens coletados (notícias e anúncios), um por
//     linha, com procedência (`fonte`, `url`, `publicado_em`) e o payload bruto.
//
// Também adiciona `gerado_em` e `modelo` a `analise_mercado` (#199): a análise
// passa a registrar QUANDO foi gerada e por QUAL modelo — sem isso não dá para
// dizer se o número na tela é de hoje ou de três meses atrás.
//
// Ambas as tabelas são materializadas pelo sincronizador de schema do SDK a
// partir do `schema.json` (fonte de verdade). Esta migração é ADITIVA e não
// transforma dado existente — as entidades nascem aqui e as colunas novas são
// nulas em toda linha pré-existente.
//
// Seed fica de fora por contrato: nenhuma região é criada automaticamente. A
// lista de regiões é decisão da instância (o cenário do DF tem 30+ RAs, e
// varrer todas por padrão gastaria IA sem ninguém ter pedido).
//
// Forward-only. Instalação virgem e existente são igualmente inócuas.

export default async function ({ dados }) {
  void dados;
}

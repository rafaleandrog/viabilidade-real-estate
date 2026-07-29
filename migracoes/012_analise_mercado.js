// 012_analise_mercado.js — #199
//
// Cria a tabela `analise_mercado`: um SNAPSHOT por estudo com os números de
// MERCADO (preço médio R$/m², custo de obra R$/m², VSO, macros IPCA/Selic/INCC
// e as projeções Focus), os sinais de risco e a procedência do dado. O lado
// "projeto" da comparação NÃO mora aqui — é derivado do próprio estudo em
// tempo de render (tipologias, linha Construção, absorção), justamente para não
// duplicar dado que já existe e sair do ar assim que o estudo mudasse.
//
// A tabela é materializada pelo sincronizador de schema do SDK a partir do
// `schema.json` (fonte de verdade); esta migração é aditiva e NÃO transforma
// dado existente — não há de onde transformar, a entidade nasce aqui. Seed fica
// de fora por contrato: quem popula é a rota de IA do #200, sob ação do
// usuário.
//
// Forward-only. Instalação virgem e instalação existente são igualmente
// inócuas — daí o corpo vazio, mesmo padrão da 011_fase_ancora_id.js.

export default async function ({ dados }) {
  void dados;
}

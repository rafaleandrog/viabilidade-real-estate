// 005_cenarios.js — Etapa 8 (#56)
//
// Cria a tabela de cenários salvos do Avançado (avancado_cenarios). Cada linha
// guarda um cenário nomeado como par de variações percentuais sobre a base:
// preço de venda (R$/m²) e custo de obra (R$/m²). O motor reaplica esses deltas
// (aplicarCenario) ao recalcular o fluxo — não há dado derivado persistido.
//
// Forward-only. A tabela é materializada pelo sincronizador de schema do SDK
// (schema.json é a fonte de verdade); tabela nova = sempre vazia em instâncias
// pré-existentes, não há dado a transformar.

export default async function ({ dados }) {
  // Nenhuma transformação de dado necessária — avancado_cenarios é uma tabela
  // nova, criada pelo schema sync do SDK a partir do schema.json.
  void dados;
}

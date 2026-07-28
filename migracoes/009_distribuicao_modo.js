// 009_distribuicao_modo.js — #194
//
// Adiciona `distribuicao_modo` a avancado_linhas_custo: só a linha de Preço do
// Terreno (grupo `terreno`, categoria `Preço`) usa os valores `unit_delivery`/
// `sales_revenue` — o motor (fluxo-caixa-motor.ts) passa a ratear o custo
// proporcionalmente à receita em caixa ou ao VGV vendido, em vez do cronograma
// fixo. Qualquer outra linha permanece no modo `fixo` (comportamento atual,
// inalterado).
//
// Forward-only. A coluna é aditiva com DEFAULT 'fixo', materializada pelo
// sincronizador de schema do SDK (schema.json é a fonte de verdade); não há
// dado existente a transformar — toda linha pré-existente já nasce em 'fixo'.

export default async function ({ dados }) {
  void dados;
}

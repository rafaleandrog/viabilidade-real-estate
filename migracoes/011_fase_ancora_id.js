// 011_fase_ancora_id.js — #167
//
// Adiciona `fase_ancora_id` a avancado_linhas_custo: permite ancorar uma linha
// de custo a uma FASE do Cronograma (tipo='cronograma', #168), além dos 5
// eventos fixos que já existiam (`cronograma_evento`). Só foi seguro oferecer
// isso depois do #168 separar as fases de Cronograma das de Receitas — antes,
// a lista de fases misturava as duas telas e uma linha de custo poderia
// acabar ancorada numa fase de Receitas por engano.
//
// Forward-only. A coluna é aditiva (referência nula por padrão), materializada
// pelo sincronizador de schema do SDK (schema.json é a fonte de verdade); não
// há dado existente a transformar — toda linha pré-existente já nasce sem
// âncora de fase (continua ancorada por `cronograma_evento`, se estiver).

export default async function ({ dados }) {
  void dados;
}

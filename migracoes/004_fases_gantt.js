// 004_fases_gantt.js — Etapa 4 (#42)
//
// Adiciona início e duração às fases comerciais (avancado_fases) para que
// cada fase possa ser posicionada no gráfico de Gantt do Cronograma.
// As colunas são aditivas — fase sem posição explícita exibe inicio_mes=0 e
// duracao_meses=12, cabendo ao usuário ajustar pelo cronograma.
//
// Forward-only. As colunas são criadas pelo sincronizador de schema do SDK
// (schema.json é a fonte de verdade); não há dado existente a transformar.

export default async function ({ dados }) {
  // Nenhuma transformação de dado necessária — as novas colunas (inicio_mes,
  // duracao_meses) têm DEFAULT 0 e 12 respectivamente e são materializadas
  // pelo schema sync do SDK a partir do schema.json.
  void dados;
}

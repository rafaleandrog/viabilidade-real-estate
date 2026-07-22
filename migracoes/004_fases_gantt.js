// 004_fases_gantt.js — Etapa 4 (#42)
//
// Adiciona início e duração às fases comerciais (avancado_fases) para que
// cada fase possa ser posicionada no gráfico de Gantt do Cronograma.
// As colunas são aditivas — fase sem posição explícita exibe inicio_mes=0 e
// duracao_meses=12, cabendo ao usuário ajustar pelo cronograma.
//
// Forward-only. Numa instalação virgem a tabela avancado_fases pode estar
// vazia; as colunas são criadas com DEFAULT e nenhum dado é alterado.

exports.acima = async function (db) {
  await db.query(`
    ALTER TABLE viabilidade.avancado_fases
      ADD COLUMN IF NOT EXISTS inicio_mes    INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS duracao_meses INT NOT NULL DEFAULT 12
  `);
};

// 005_cenarios.js — Etapa 8 (#56)
//
// Cria a tabela de cenários salvos do Avançado (avancado_cenarios). Cada linha
// guarda um cenário nomeado como par de variações percentuais sobre a base:
// preço de venda (R$/m²) e custo de obra (R$/m²). O motor reaplica esses deltas
// (aplicarCenario) ao recalcular o fluxo — não há dado derivado persistido.
//
// Forward-only e idempotente (CREATE TABLE IF NOT EXISTS). O sincronizador do
// SDK também materializa a tabela a partir do schema.json; esta migração é a
// rede de segurança explícita pedida na issue e não transforma dado existente
// (tabela nova, sempre vazia numa instância pré-existente).

exports.acima = async function (db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS viabilidade.avancado_cenarios (
      id              BIGSERIAL PRIMARY KEY,
      estudo_id       BIGINT NOT NULL REFERENCES viabilidade.estudos(id) ON DELETE CASCADE,
      nome            VARCHAR(100),
      preco_venda_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      custo_obra_pct  NUMERIC(6,2) NOT NULL DEFAULT 0,
      ordem           INT NOT NULL DEFAULT 0,
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS avancado_cenarios_estudo_id_idx
      ON viabilidade.avancado_cenarios (estudo_id)
  `);
};

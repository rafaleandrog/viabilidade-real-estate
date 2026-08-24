// 034_area_privativa_aberta_deflator.js — #462 (R8-37): ponderar preço de
// tabela entre área fechada e área aberta com deflator.
//
// Duas colunas aditivas, com DEFAULT 0:
//   - `avancado_tipologias.area_privativa_aberta_m2` (decimal, escala 2)
//   - `estudos.deflator_area_aberta_pct` (inteiro — % DIGITADO, contrato de
//     precisão; não é `decimal`, porque o deflator não é resultado de
//     fórmula)
//
// Forward-only e NO-OP DOCUMENTADO, no padrão de
// `023_checkbox_custos_indiretos.js`: as colunas são materializadas pelo
// sincronizador de schema do SDK a partir do `schema.json` — esta migração
// não transforma nenhum dado existente, porque não há dado existente para
// transformar (as duas colunas nascem no schema desta versão). Área aberta
// 0 e deflator 0 reproduzem exatamente o cálculo de VGV anterior a esta
// mudança — nenhum estudo pré-existente muda de número. Nenhum seed.

export default async function ({ dados }) {
  void dados;
}

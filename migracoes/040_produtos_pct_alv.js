// 040_produtos_pct_alv.js — #781: Produtos do Loteamento Preliminar passam a ser
// cadastrados por % da ALV + unidades.
//
// Coluna aditiva, sem default:
//   - `preliminar_produtos.pct_alv` (decimal 7,4) — participação do produto na
//     Área Líquida de Venda, só usada no Loteamento.
//
// Forward-only e NO-OP DOCUMENTADO, no padrão de `035_produto_tipo_classificacao.js`:
// a coluna é materializada pelo sincronizador de schema do SDK a partir do
// `schema.json`; esta migração não transforma dado nenhum.
//
// Por que NÃO há backfill de `pct_alv` para os produtos legados: o percentual
// exige a ALV do estudo, que é o resultado da cascata de Terreno & Áreas
// (modos m² / % poligonal / % parcelável encadeados, em `frontend/areas-cascata.ts`).
// Reimplementá-la aqui criaria uma segunda cópia de uma regra que muda, e uma
// migração é retrato de um instante — a cópia envelheceria sozinha. O legado é
// resolvido na LEITURA, sem perda: produto sem `pct_alv` tem o percentual
// derivado da área antiga (`pctAlvEfetivo`, `frontend/produtos-alv.ts`), o que
// reproduz exatamente a mesma área total, o mesmo VGV e o mesmo nº de lotes. A
// coluna passa a ser gravada no primeiro salvamento da linha.

export default async function ({ dados }) {
  void dados;
}

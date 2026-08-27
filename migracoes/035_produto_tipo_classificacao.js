// 035_produto_tipo_classificacao.js — #565 (R10-2): classificação
// Residencial/Não Residencial no catálogo de Produtos do Preliminar.
//
// Coluna aditiva, com DEFAULT 'residencial':
//   - `preliminar_produtos.tipo` (texto, opções `residencial`/`nao_residencial`)
//
// Forward-only e NO-OP DOCUMENTADO, no padrão de
// `034_area_privativa_aberta_deflator.js`: a coluna é materializada pelo
// sincronizador de schema do SDK a partir do `schema.json` — esta migração
// não transforma nenhum dado existente, porque não há dado existente para
// transformar (a coluna nasce no schema desta versão). Todo produto
// pré-existente fica Residencial, que é a leitura correta: o app não tinha
// classificação até aqui e tratava o catálogo inteiro como um único bucket
// (ver `frontend/proforma.ts` — `vgvNaoResidencial = 0`, comentário do
// interim). Nenhum seed. O motor NÃO passa a ler esta coluna nesta migração
// — isso é a issue #570, que vem depois; aqui o campo só nasce, persiste e
// aparece na tela.

export default async function ({ dados }) {
  void dados;
}

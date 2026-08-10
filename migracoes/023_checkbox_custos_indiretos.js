// 023_checkbox_custos_indiretos.js — item 5 da planilha (Rodada 7)
//
// Adiciona `considerar_contingencias`, `considerar_marketing_global` e
// `considerar_gestao_indiretos` a `estudos` — mesmo padrão de
// `considerar_custo_terreno` (checkbox que, desmarcado, atenua o campo na
// tela e zera o efeito dele no motor).
//
// Forward-only. Três colunas aditivas com DEFAULT true, materializadas pelo
// sincronizador de schema do SDK; não há dado existente a transformar — todo
// estudo pré-existente nasce com os três marcados, preservando o
// comportamento atual (os três custos já entravam no cálculo antes desta
// mudança).

export default async function ({ dados }) {
  void dados;
}

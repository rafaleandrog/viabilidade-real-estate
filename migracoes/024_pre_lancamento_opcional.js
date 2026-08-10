// 024_pre_lancamento_opcional.js — item 19 da planilha (Rodada 7, BUG7-22, #330)
//
// Adiciona `tem_pre_lancamento` a `estudos` — mesmo padrão aditivo de
// `considerar_custo_terreno`/`considerar_contingencias`: booleano com
// DEFAULT true, materializado pelo sincronizador de schema do SDK.
//
// Forward-only. Não há dado existente a transformar — todo estudo
// pré-existente nasce com a fase de Pré-lançamento habilitada, preservando o
// comportamento atual (o evento sempre existia no cronograma antes desta
// mudança).

export default async function ({ dados }) {
  void dados;
}

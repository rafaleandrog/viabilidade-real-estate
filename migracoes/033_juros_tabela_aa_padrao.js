// 033_juros_tabela_aa_padrao.js — #477 (Rodada 8, R8-52).
//
// `estudos` ganha a coluna `juros_tabela_aa_padrao` (decimal(5,2), sem
// `padrao` — nula por default). É o "default herdado" que o painel de
// premissas do estudo (aba Financeiro) passa a oferecer: quando preenchido,
// toda LINHA DE RECEITA nova (POST /avancado/fases com `tipo: 'receita'`)
// nasce com `fluxo_pagamento.juros_tabela_aa` já igual a esse valor, em vez
// de 0% — sem tocar nenhuma linha já existente, e sem sobrescrever nada que
// o usuário já tenha digitado numa linha (a herança só acontece na CRIAÇÃO).
//
// Forward-only, no-op: coluna nova, nula em todo estudo existente — não há
// dado a transformar. Nenhuma linha de receita já persistida muda de
// comportamento (o motor só lê `juros_tabela_aa` de dentro do próprio
// `fluxo_pagamento` de cada linha — ver `frontend/fluxo-caixa-motor.ts:766-813`
// — nunca do default do estudo, que só é consultado no momento da criação).

export default async function ({ dados }) {
  void dados;
}

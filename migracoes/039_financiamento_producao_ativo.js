// 039_financiamento_producao_ativo.js — #587 (Rodada 10).
//
// `avancado_funding_operacoes` ganha a coluna `ativo` (booleano, padrao
// `true`). Genérica no schema (as 3 colunas de tipo compartilham a tabela),
// mas o USO é restrito ao Financiamento à produção — o backend
// (`backend/rotas/funding.ts`, `validarCamposOperacao`) recusa `ativo` em
// operação de `divida`/`equity`. É a saída que o autor pediu: "checkbox de
// ligar ou não" só faz sentido pro produto que agora é ÚNICO E FIXO por
// estudo (nunca criado/removido pelo usuário) — Dívida e Equity continuam
// se resolvendo por existir/não existir a linha.
//
// Forward-only, no-op: coluna nova, `true` em toda operação existente —
// nenhuma preserva menos do que já tinha. Estudo com Financiamento à
// produção hoje continua com ele LIGADO, mesmos parâmetros, nenhum número
// muda. Estudo sem Financiamento à produção continua sem a linha — a tela
// (`frontend/tela-funding.ts`) é quem passa a criá-la automaticamente,
// desligada, na primeira vez que a aba abre; não há dado a migrar para os
// estudos que ainda não têm a operação, porque a linha não existe até a
// tela criá-la.

export default async function ({ dados }) {
  void dados;
}

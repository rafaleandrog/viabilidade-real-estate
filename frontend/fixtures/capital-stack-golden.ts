// ─────────────────────────────────────────────────────────────────────────
// Casos de referência do Programa Financeiro / Capital Stack — FIN-01 (#270).
//
// Até o Grupo 2 da Fase 9 (FIN-04+05+06+07, #273-276), este arquivo tinha
// sua PRÓPRIA implementação de `simularCapitalStack` — um oráculo
// independente, no mesmo espírito de `calliandra-golden.ts`. O Grupo 2
// promoveu essa implementação (já correta e testada contra os 16 casos
// abaixo) para `frontend/capital-stack-motor.ts`, que agora é o motor real.
//
// Por que reaproveitar em vez de duplicar de novo: ao contrário de
// Calliandra (que reproduz uma planilha REAL, então uma segunda
// implementação independente tem valor de conferência cruzada), não existe
// planilha de referência para Capital Stack — os 16 casos abaixo já eram
// verificados por invariante fechada, não por comparação linha a linha
// contra uma terceira fonte (ver o ADR do #270). Duplicar a mesma lógica
// numa segunda cópia não aumentaria o rigor, só o risco de as duas
// divergirem silenciosamente com o tempo.
//
// Este módulo continua NÃO importado pelo runtime (não entra no bundle de
// index.ts) — só reexporta o motor para os 16 testes de referência.
// ─────────────────────────────────────────────────────────────────────────

export * from '../capital-stack-motor.js';

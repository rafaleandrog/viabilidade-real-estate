# CLAUDE.md — App `viabilidade` (UrbiVerso)

Este arquivo é lido automaticamente pelo Claude Code ao iniciar qualquer sessão neste repo.

---

## Contexto do projeto

App UrbiVerso de estudo de viabilidade imobiliária. Construída sobre o shell UrbiVerso (SDK `@urbiverso/sdk 0.50.3`). Dois tipos de estudo: **Preliminar** (análise estática) e **Avançado** (fluxo de caixa temporal). Frontend em Lit com web components `urbi-*`. Backend em `backend/rotas.js`, self-contained.

**Fontes de verdade:**
- `PROGRESSO.md` — estado atual, o que foi feito, pendências
- `INSTRUCOES-CODE.md` — master plan e contratos inegociáveis da plataforma
- `docs/lotes-bugs-2026-07-20.md` — lista completa dos lotes de bugs/melhorias com issues do GitHub
- `schema.json` — schema de dados atual
- `docs/shell/*.md` no monorepo `urbiverso/urbiverso` — fonte de verdade da plataforma

---

## Protocolo de sessão por lote

Quando o usuário disser **"Prossiga para os issues do lote X"**, siga este protocolo:

### 1. Carregar contexto (sempre, no início)
```
Ler nesta ordem:
1. PROGRESSO.md  → estado atual e o que já foi feito
2. docs/lotes-bugs-2026-07-20.md  → issues do lote pedido e suas dependências
3. schema.json  → schema atual (para saber o que precisa migrar)
4. Cada issue do GitHub listado no lote  → descrição completa e requisitos
```

### 2. Verificar pré-requisitos
Cada lote tem dependências listadas em `docs/lotes-bugs-2026-07-20.md`. **Não iniciar um lote se seus pré-requisitos não estiverem concluídos.** Se estiverem pendentes, reportar ao usuário em vez de prosseguir.

### 3. Implementar
- Uma issue por vez, na ordem do lote
- Manter os contratos inegociáveis de `INSTRUCOES-CODE.md`
- Usar tokens CSS do design system (`var(--cor-*)`) — nunca cores literais
- Migrações de schema: sempre forward-only, bumpar versão z
- Após cada issue: typecheck + build verdes antes de passar para a próxima

### 4. Encerrar sessão
1. `pnpm exec urbi-empacotar viabilidade` sem erros
2. Commit com mensagem `fix(lote-X): ...` ou `feat(lote-X): ...`
3. **Atualizar `PROGRESSO.md`**: marcar issues concluídas, registrar decisões tomadas e pendências
4. Fechar as issues do GitHub que foram implementadas

---

## Contratos inegociáveis (resumo — ver `INSTRUCOES-CODE.md` para o completo)

- Backend 100% self-contained (`backend/rotas.js`, sem `--packages=external`)
- Sem `instanceof` cruzando shell↔app
- Seed fora de migração; migração só transforma dados existentes
- `shell_min = "0.50.3"`
- Precisão: R$ e m² → `decimal(12,2)`; % digitado → inteiro; % calculado → `decimal(5,1)`
- Rotas relativas; shell prefixa `/api/viabilidade/`
- Tokens CSS do design system — nunca cores literais
- Só usar primitivos `urbi-*` disponíveis no `ui.md` do shell

---

## Mapa dos lotes (resumo rápido)

| Lote | Issues | Dependências |
|------|--------|--------------|
| **1** — Trivial Preliminar | #9 #10 #11 #12 #13 (#24 aguarda print) | Nenhuma |
| **2** — Bug sobreposição | #14 | Nenhuma (fazer antes de mover a tela) |
| **3** — Estrutura de abas Avançado | #15 | Nenhuma (fundação de tudo) |
| **4** — Aba Empreendimento | #16 | #15 |
| **5** — Custos (5 abas + tabela) | #17 #18 | #15, #16 |
| **6** — Receitas + Fases | #19 #20 #21 | #15, #16 — spec conjunta obrigatória |
| **7** — Financeiro sub-abas | #22 | #15, #17 — **bloqueado: aguarda spec dos campos** |
| **8** — Resumo | #23 | Todos os anteriores |

Detalhes completos, riscos e checklists em `docs/lotes-bugs-2026-07-20.md`.

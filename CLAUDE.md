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

## Protocolo de etapa (rodada 2) — disparo `Siga para a Etapa X`

Quando o usuário disser **"Siga para a Etapa X"**, isso **sozinho** basta para checar e resolver
as issues daquela etapa e **fechar o ciclo abrindo o PR e fazendo o merge na `main`**. Siga:

### 1. Carregar contexto (sempre, no início)
```
Ler nesta ordem:
1. PROGRESSO.md  → estado atual e o que já foi feito
2. docs/etapas-bugs-2026-07-22.md  → issues da etapa pedida, arquivos-alvo e dependências
3. schema.json  → schema atual (para saber o que precisa migrar)
4. Cada issue do GitHub listada na etapa  → descrição completa e requisitos
```

### 2. Verificar pré-requisitos
Cada etapa lista dependências em `docs/etapas-bugs-2026-07-22.md`. **Não iniciar uma etapa cujos
pré-requisitos não estejam concluídos** (ex.: Etapas 4–8 dependem da #39). Reportar em vez de prosseguir.

### 3. Branch (sempre a partir da `main` atualizada)
```
git fetch origin main
git checkout -B claude/etapa-X-<slug> origin/main
```
Etapas seguintes já pegam as anteriores porque cada etapa foi mergeada na `main`.

### 4. Implementar
- Uma issue por vez, na ordem da etapa.
- Manter os contratos inegociáveis de `INSTRUCOES-CODE.md`; tokens CSS (`var(--cor-*)`) — nunca cor literal.
- Migrações de schema: sempre **forward-only**, bumpar versão z.
- Só primitivos `urbi-*` do `ui.md` do shell (`urbi-nav`/`urbi-abas`/`urbi-badge` etc.).

### 5. Validar
- `bash scripts/validar-frontend.sh` (verde) + testes runáveis.
- `pnpm exec urbi-empacotar viabilidade`, typecheck/suíte de backend e execução de migração
  **só rodam no ambiente autenticado do autor (SDK gated)** — registrar no corpo do PR e no
  `PROGRESSO.md` **o que não foi validável aqui**.

### 6. Fechar o ciclo — automático (PR + merge)
1. Commit `fix(etapa-X): …` ou `feat(etapa-X): …` → `git push -u origin claude/etapa-X-<slug>`.
2. **Abrir o PR** contra `main` (usar template do repo se existir; corpo lista issues fechadas e
   o que ficou pendente de validação no ambiente do autor).
3. **Fazer o merge do PR na `main`** — **em TODAS as etapas**, assim que os checks disponíveis
   passarem (decisão do autor: merge automático inclusive nas etapas de backend/schema não
   valid��veis aqui; o risco assumido é subir algo pendente de validação no PC do autor).
4. Fechar as issues da etapa (`Closes #…` no PR já basta) e **atualizar** `PROGRESSO.md` + o
   checklist de `docs/etapas-bugs-2026-07-22.md` (marcar a etapa concluída).

> **Autorização:** o comando `Siga para a Etapa X` **é** a autorização explícita do autor para
> abrir PR e mergear na `main` — supera o default de "não criar PR / não commitar em main sem OK".
> Vale por etapa; não persiste para trabalho fora desse fluxo.

> A rodada 1 (`docs/lotes-bugs-2026-07-20.md`, issues #9–#24, lotes 1–8) está **concluída**. O
> protocolo antigo "Prossiga para os issues do lote X" foi substituído por este.

---

## Validação no ambiente Claude Code (web/remoto) — NÃO redescobrir isto

⚠️ **Regra de ouro:** neste ambiente o `@urbiverso/sdk` está no GitHub Packages **privado**
e a auth disponível **não tem acesso** a ele → `pnpm install` sempre falha com **401** e
aborta o link dos pacotes. **Isso é esperado.** Não perca tempo caçando `GITHUB_TOKEN`,
configurando `.npmrc` com token, tentando `--offline`, etc. — nada disso destrava o SDK aqui.

**Para mudanças de FRONTEND (a maioria dos lotes de UI):** o frontend **não importa o SDK**
(usa o global `window.urbiVerso`), então valida-se 100% só com os pacotes públicos. Use o
script pronto — é o "caminho simples" que sempre funciona:

```
bash scripts/validar-frontend.sh
```

Ele roda `pnpm install` (ignorando o 401 do SDK, que ainda assim baixa lit/typescript/tsx/
esbuild para `.pnpm/`), linka esses pacotes e executa **typecheck do frontend + testes de
frontend + build do bundle (esbuild)**. Verde = mudança de frontend validada.

**Backend, typecheck do backend, `urbi-empacotar` e a suíte completa** exigem o SDK →
**só rodam no ambiente autenticado do autor**. Se uma issue tocar backend/schema, implemente
e registre no `PROGRESSO.md` que a validação de backend/empacotamento fica para o autor
(não fique tentando instalar o SDK aqui). No PC do autor o fluxo canônico segue valendo:
`pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm exec urbi-empacotar viabilidade`
(no Windows, `urbi-empacotar` roda via **PowerShell**, não Git Bash — ver PROGRESSO).

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

## Mapa das etapas — rodada 2 (ativa) — disparo `Siga para a Etapa X`

| Etapa | Issues | Dependências |
|------|--------|--------------|
| **1** — Correções rápidas de UI | #33 #34 #35 #36 #37 | Nenhuma (frontend puro) |
| **2** — Backend & dados | #24 #38 | Nenhuma (schema/backend) |
| **3** — Fundação de navegação | #39 #40 | Nenhuma (pré-requisito das Etapas 4–8) |
| **4** — Empreendimento | #41 #42 #43 #44 #45 | #39 |
| **5** — Custos | #46 #47 | #39, #40 |
| **6** — Receitas | #48 #49 #50 #51 #52 | #39 |
| **7** — Redistribuição de Premissas | #53 #55 #54 | #39 + Etapa 4 |
| **8** — Cenários | #56 | #39 + motor de fluxo |

Detalhes, diagnóstico, arquivos-alvo, riscos e checklist em `docs/etapas-bugs-2026-07-22.md`.

> **Rodada 1 (concluída):** lotes 1–8, issues #9–#24, em `docs/lotes-bugs-2026-07-20.md`.

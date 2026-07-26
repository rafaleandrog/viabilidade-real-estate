# CLAUDE.md — App `viabilidade` (UrbiVerso)

Este arquivo é lido automaticamente pelo Claude Code ao iniciar qualquer sessão neste repo.

---

## Contexto do projeto

App UrbiVerso de estudo de viabilidade imobiliária. Construída sobre o shell UrbiVerso (SDK `@urbiverso/sdk 0.50.3`). Dois tipos de estudo: **Preliminar** (análise estática) e **Avançado** (fluxo de caixa temporal). Frontend em Lit com web components `urbi-*`. Backend em `backend/rotas.js`, self-contained.

**Fontes de verdade:**
- `PROGRESSO.md` — estado atual, o que foi feito, pendências
- `INSTRUCOES-CODE.md` — master plan e contratos inegociáveis da plataforma
- `schema.json` — schema de dados atual (genesis da app)
- `docs/shell/*.md` no monorepo `urbiverso/urbiverso` — fonte de verdade da plataforma

**Contexto de negócio (consultivo — NÃO governa comportamento):**
- `docs/viabilidade/padrao-incorporacao.md` — como o app raciocina sobre viabilidade de **Incorporação** (conceito, premissas, motor, indicadores). Leia-o quando precisar de contexto de negócio para implementar uma mudança ou resolver um issue. ⚠️ É **descritivo e consultivo**: não é contrato nem autoriza alterar a lógica existente. Se divergir do código/`schema.json`/spec, **o código está certo e o documento é que deve ser corrigido** — nunca ajuste o comportamento para casar com ele. Mudança de lógica nasce de issue/spec, não deste doc.

---

## Estado do backlog — todas as rodadas concluídas

As três rodadas de bugs/melhorias planejadas terminaram. **Não há issue aberta.** Os documentos
abaixo são **histórico**, não backlog ativo — nenhum deles dispara trabalho:

| Rodada | Escopo | Documento | Estado |
|--------|--------|-----------|--------|
| 1 — Lotes 1–8 | issues #9–#24 | `docs/lotes-bugs-2026-07-20.md` | ✅ concluída |
| 2 — Etapas 1–8 | issues #33–#56 | `docs/etapas-bugs-2026-07-22.md` | ✅ concluída |
| 3 — Sessões S1–S20 | issues #71–#132 | `docs/sessoes-bugs-2026-07-25.md` | ✅ concluída |

Os disparos antigos (`Prossiga para os issues do lote X`, `Siga para a Etapa X`, `Siga para a
Sessão SX`) **estão aposentados** — não há mais lote, etapa ou sessão a executar. Trabalho novo
nasce de issue nova ou de pedido direto do autor, na branch própria (`fix/…`, `feat/…`,
`claude/…`) a partir da `main` atualizada, com PR contra a `main`.

> **Merge é sempre decisão do autor**, salvo autorização explícita naquela conversa — e a
> autorização vale só para aquele pedido, não persiste.

---

## Validação no ambiente Claude Code (web/remoto) — NÃO redescobrir isto

⚠️ **Regra de ouro:** neste ambiente o `@urbiverso/sdk` está no GitHub Packages **privado**
e a auth disponível **não tem acesso** a ele → `pnpm install` sempre falha com **401** e
aborta o link dos pacotes. **Isso é esperado.** Não perca tempo caçando `GITHUB_TOKEN`,
configurando `.npmrc` com token, tentando `--offline`, etc. — nada disso destrava o SDK aqui.

**Para mudanças de FRONTEND (a maioria):** o frontend **não importa o SDK**
(usa o global `window.urbiVerso`), então valida-se 100% só com os pacotes públicos. Use o
script pronto — é o "caminho simples" que sempre funciona:

```
bash scripts/validar-frontend.sh
```

Ele roda, em 5 etapas: o **guard de aspas curvas em posição de atributo**, depois `pnpm install`
(ignorando o 401 do SDK, que ainda assim baixa lit/typescript/tsx/esbuild para `.pnpm/`), linka
esses pacotes e executa **typecheck do frontend + testes de frontend + build do bundle
(esbuild)**. Verde = mudança de frontend validada.

> **Por que o guard de aspas curvas existe:** `variante=”alerta”` (aspa curva, U+201D) deixa o
> atributo **inerte** — o parser inclui as aspas no valor, ele não casa com nada e o primitivo cai
> no default, sem erro em lugar nenhum. Como mora dentro de template literal do lit, atravessa
> typecheck, testes e esbuild **em verde**: foi assim que o #71/#160 sobreviveu a uma rodada
> inteira que "validou ✓". Aspas curvas em **conteúdo de texto** são tipografia legítima e não são
> acusadas — o padrão casa só `=` seguido de aspa curva.

O `.github/workflows/pr-guards.yml` é o CI de PR (só `git` + `grep`, sem SDK, então nunca fica
vermelho por falta de credencial). Barra **PR de diff vazio que declara fechar issue** — o caso do
PR #142, que fechou 12 issues sem alterar um arquivo — e repete o guard de aspas curvas para pegar
quem não rodou o script local.

**Backend, typecheck do backend, `urbi-empacotar` e a suíte completa** exigem o SDK →
**só rodam no ambiente autenticado do autor**. Se uma mudança tocar backend/schema, implemente
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
  - **Exceção real:** o CSS dos documentos de impressão/PDF em `frontend/exportar.ts` roda numa
    janela própria, fora do escopo das variáveis do shell — lá `var(--cor-*)` não resolve e cor
    literal é a única opção. Não "corrija" isso.
- Só usar primitivos `urbi-*` disponíveis no `ui.md` do shell — e **só as props que eles declaram**:
  atributo inexistente num primitivo não dá erro, ele simplesmente **não faz nada** (falha
  silenciosa). Na dúvida, leia `ui/src/urbi-<nome>.ts` no monorepo, não presuma a prop.

---

## Versão do manifesto e release

`versao` (`x.y.z`) do `manifesto.json` é a **versão de schema**, não de código — a regra da
plataforma (`docs/shell/distribuicao.md` § Identidade dupla) é: **`z` só bumpa quando há migração
nova**. Mudança só de frontend/backend **mantém** a versão.

Isso não impede publicar release de código: a plataforma decide instalar por
**`versao` maior** *ou* por **mesma versão com `build_sha` à frente** (ancestralidade git). Para o
segundo caminho funcionar, a tag **precisa carregar o sha**:

```
viabilidade-v<x.y.z>_<sha8>     ✅ permite upgrade de build em mesma versão
viabilidade-v<x.y.z>            ⚠️ aceita, mas trava upgrade dentro da mesma versão
```

O workflow `.github/workflows/release.yml` gera a tag com sha sozinho quando disparado por
**workflow_dispatch** (Actions → release → Run workflow) — é o caminho preferido.

> **Não bumpe `versao` "porque saiu código novo"** — a versão descreve o schema. Bumpar sem
> migração cria um degrau vazio; adicionar migração sem bumpar quebra a regra na direção oposta
> (aconteceu uma vez: a migração `004_fases_gantt.js` entrou sem bump — ver `PROGRESSO.md`).

---

## Sessões paralelas

Pode haver mais de uma sessão do Claude Code neste repo. Regras: **nunca duas sessões na mesma
branch**; `main` é só para puxar; cada árvore de trabalho tem seu próprio `pnpm install`.

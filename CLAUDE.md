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
São **dois documentos com papéis distintos**. ⚠️ A mesma ressalva vale para os dois: são
**consultivos**, não são contrato e **não autorizam alterar a lógica existente**. Se divergirem do
código/`schema.json`/spec, **o código está certo** — a divergência vira **issue**, nunca um ajuste
automático de comportamento.

- `docs/viabilidade/inteligencia-evi-incorporacao.md` — **significado econômico**: como a empresa raciocina sobre viabilidade de Incorporação (premissas, motor de vendas e recebíveis, carteira, repasse, indicadores de decisão). É conhecimento de negócio, **não descreve o app** e **não governa o runtime**. Também não deve ser rebaixado para casar com uma limitação atual do app.
- `docs/viabilidade/padrao-incorporacao.md` — **dinâmica funcional**: como o app representa esse conhecimento. Leia-o quando precisar de contexto para implementar uma mudança ou resolver um issue. Ele rotula explicitamente cada trecho como **Comportamento vigente** (o que o código faz hoje), **Modelo funcional de referência** (a regra aprovada) ou **Evolução dependente de issue** — não presuma que uma regra descrita ali já está implementada. Os **anexos A–E** guardam o material do app instalado: convenções de cálculo, dicionário de campos reais, modelo de dados, armadilhas conhecidas e API.

A conciliação entre os dois e o código — conceito a conceito, com evidência em `arquivo:linha` —
está em `docs/rodada-5-evi-2026-07-31.md`.

---

## Estado do backlog — NENHUMA rodada ativa · 21 issues EVI aguardando aprovação

🟡 **Não há rodada aberta, mas há uma lista preparada.** A sessão documental de **2026-07-31**
auditou o app contra os documentos EVI e deixou **21 issues prontas e NÃO abertas** em
`docs/issues-evi-propostas-2026-07-31.md` (identificadores locais `EVI-001`…`EVI-021`), com a matriz
de evidência em `docs/rodada-5-evi-2026-07-31.md`.

> ⚠️ **Elas dependem de aprovação explícita do autor para serem abertas** — a instrução da sessão
> exige isso, e receber o documento não equivale a aprovar a abertura. Enquanto não forem abertas,
> **não existem no GitHub**: nenhum número, nenhuma issue. Quem abrir atualiza esta seção **na mesma
> alteração**, transformando este bloco na Rodada 5.

A Rodada 4 foi **concluída em 2026-07-29**: as 35 issues (#165–#169 + #172–#201) estão mergeadas na
`main`. Trabalho novo nasce de **issue nova ou de pedido direto do autor**, na branch própria
(`fix/…`, `feat/…`, `claude/…`) a partir da `main` atualizada, com PR contra a `main`.

| Rodada | Escopo | Documento | Estado |
|--------|--------|-----------|--------|
| 1 — Lotes 1–8 | issues #9–#24 | `docs/lotes-bugs-2026-07-20.md` | ✅ concluída (histórico) |
| 2 — Etapas 1–8 | issues #33–#56 | `docs/etapas-bugs-2026-07-22.md` | ✅ concluída (histórico) |
| 3 — Sessões S1–S20 | issues #71–#132 | `docs/sessoes-bugs-2026-07-25.md` | ✅ concluída (histórico) |
| 4 — planilha `lista_bugs.xlsx` | #165–#169 + #172–#201 | `docs/rodada-4-planilha-2026-07-27.md` | ✅ **concluída (histórico)** |

Todas as rodadas são **histórico** e não disparam trabalho; os disparos antigos (`Prossiga para os
issues do lote X`, `Siga para a Etapa X`, `Siga para a Sessão SX`, `Resolva a issue #NNN` do mapa
mestre) **estão aposentados**. O mapa mestre da Rodada 4 continua útil como **referência de
decisões** (§8 traz as decisões do autor; §9, as causas raiz compartilhadas).

> ⚠️ **Se abrir uma rodada nova, atualize esta seção junto** — e quem a encerrar faz o mesmo, na
> mesma alteração. A Rodada 4 nasceu porque #165–#169 ficaram abertas uma rodada inteira sem
> ninguém perceber, com este arquivo dizendo "não há issue aberta".

**Pendências do autor no UrbiVerso** (o ambiente Claude Code não cobre): `urbi-empacotar`,
sincronização do `schema.json` (tabelas `analise_mercado`, `mercado_regioes`, `mercado_coletas`),
execução das migrações `012`/`013`, confirmação de que o shell descobre `export { rotinas }` em
`backend/rotas.ts` e configuração de `mercado_busca_url`/`mercado_busca_chave` para a coleta
diária sair do modo `sem_fonte_externa`. Detalhe no `PROGRESSO.md` (#199, #200).

> ⚠️ **#165–#169 estavam abertas há uma rodada sem ninguém perceber.** A sessão do PR #171 abriu
> seis issues a partir da planilha `lista_bugs.xlsx` e implementou **só a #170**; este `CLAUDE.md`
> continuou dizendo "não há issue aberta" e a informação se perdeu até a auditoria de 2026-07-27.
> Junto com o PR #142 (diff vazio fechando 12 issues), a lição completa é: **"fechou a issue" não é
> evidência de entrega — nem "abriu a issue" é evidência de que alguém vai pegá-la. O diff é.**
> Quem encerrar uma rodada atualiza esta seção **na mesma alteração**.

### Merge

> **Merge é sempre decisão do autor**, salvo autorização explícita — em geral valendo só para
> aquele pedido, sem persistir.

A autorização de auto-merge de **portões** existia só dentro da Rodada 4 (`Portão? = SIM` no mapa
mestre) e **expirou com ela**, em 2026-07-29. Não há hoje nenhuma autorização permanente: toda
sessão abre o PR e para, a menos que o autor peça o merge naquele pedido.

Quando o autor autorizar um merge, as condições que valiam para os portões continuam sendo o
padrão de qualidade: `scripts/validar-frontend.sh` verde · `scripts/validar-backend.sh` verde se
tocou backend/schema/migração · pré-requisitos já na `main` · diff **não vazio** · migração
numerada contra a `main` do momento, com a `versao` bumpada.

> **Nota de ambiente:** o `gh` CLI **não existe** neste ambiente — só `git`. Não dá para abrir PR
> pelo terminal; o fluxo que funciona é branch → push → (merge na `main`, se autorizado) → push.
> Ao terminar, diga ao autor que o PR formal não foi aberto e deixe o link
> `https://github.com/<owner>/<repo>/pull/new/<branch>`. Não gaste tempo procurando o `gh`.

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

**Para mudanças de BACKEND / SCHEMA / MIGRAÇÃO:** existe o segundo script, criado em 2026-07-29
depois de descobrir que a regra antiga ("backend só roda no ambiente do autor") era conservadora
demais:

```
bash scripts/validar-backend.sh
```

Ele roda **typecheck do backend + testes de lógica pura das rotas + harness de migrações + guard de
`versao`**. Funciona aqui porque:

- o `@urbiverso/sdk` **já está** em `node_modules/@urbiverso/sdk` com o `dist/index.d.ts` — o que
  falha com 401 é *reinstalar* o pacote, e o typecheck só precisa dos tipos, que estão no disco;
- só `backend/rotas.ts` importa o SDK (`import '@urbiverso/sdk/express'`, augmentação de tipo);
  todo o resto do backend depende só do `express`, que é **público**;
- os testes de backend importam apenas as **funções puras** dos módulos de rota — não sobem
  servidor nem banco.

O harness (`scripts/migracoes-harness.mjs`) exercita cada migração contra um banco em memória:
contrato do módulo, instalação virgem, **reexecução** e a cadeia completa em ordem. O guard final
barra os dois erros simétricos de versionamento: migração nova **sem** bump da `versao`, e bump
**sem** migração nova.

> ⚠️ O `dist/index.d.ts` do SDK é também a **fonte para conferir props de primitivo `urbi-*`**
> antes de usar (`grep -n "declare class UrbiGraficoArea" -A 30`). Atributo ou elemento inexistente
> **não dá erro, só não faz nada** — leia antes de presumir.

**Continua sendo do autor, no ambiente autenticado:** `urbi-empacotar`, a sincronização de
`schema.json` pelo SDK (uma migração pode passar aqui e mesmo assim citar coluna que o schema não
declara) e a execução real das migrações no Postgres. Registre isso no `PROGRESSO.md`/PR. No PC do
autor o fluxo canônico segue valendo: `pnpm typecheck`, `pnpm build`, `pnpm test`,
`pnpm exec urbi-empacotar viabilidade` (no Windows, `urbi-empacotar` roda via **PowerShell**, não
Git Bash — ver PROGRESSO).

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

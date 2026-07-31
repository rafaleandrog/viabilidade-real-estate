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
- `docs/viabilidade/padrao-incorporacao.md` — **dinâmica funcional**: como o app representa esse conhecimento. Leia-o quando precisar de contexto para implementar uma mudança ou resolver um issue. Ele rotula explicitamente cada trecho como **Comportamento vigente** (o que o código faz hoje), **Modelo funcional de referência** (a regra aprovada) ou **Evolução dependente de issue** — não presuma que uma regra descrita ali já está implementada. Os **anexos A–G** guardam o material do app instalado: convenções de cálculo, dicionário de campos reais, modelo de dados, armadilhas conhecidas, API, decisões históricas e os **cenários dourados de recebíveis**.

A conciliação entre os dois e o código — conceito a conceito, com evidência em `arquivo:linha` —
está em `docs/rodada-5-evi-2026-07-31.md`. A revisão de recebíveis por safras, que reconciliou os
dois documentos contra EVIs reais do projeto Calliandra, está em
`docs/revisao-recebiveis-calliandra-2026-07-31.md`.

---

## Estado do backlog — 🔴 RODADA 5 ABERTA · 22 issues EVI (#220–#241)

**A Rodada 5 foi aberta em 2026-07-31.** As **22 issues #220–#241** nasceram da auditoria do app
contra os documentos EVI e estão **todas abertas e nenhuma implementada**.

- **Mapa mestre:** `docs/issues-evi-propostas-2026-07-31.md` — corpo completo de cada uma, com a
  correspondência `EVI-0NN → #NNN`;
- **Evidência:** `docs/rodada-5-evi-2026-07-31.md` — matriz conceito → `arquivo:linha` → issue, com
  status e classe de impacto (D0/U1/M2/P3/I4).

**Ordem de execução é por onda, não por número.** `EVI-022` (#228) nasceu na 2ª auditoria e executa
na Onda 2 — os IDs são ordem de criação.

| Onda | Issues | Tema |
|---|---|---|
| **0** | #220, #221 | Portões: fixture dourada e inventário de dados legados |
| **1** | #222 … #226 | Nomenclatura (U1) e cronograma (M2) |
| **2** | #227, **#228**, #229 … #231 | Fundação comercial, fiscal e temporal |
| **3** | #232 … #237 | Recebíveis, carteiras e Receita Bruta |
| **4** | #238, #239 | Terreno e funding |
| **5** | #240, #241 | Invariantes, UI e relatórios |

**Três ordens não negociáveis:** #220/#221 antes de qualquer issue M2 · #231 antes de #232/#233 ·
**#228 antes de #237, #238 e #239**. Cada issue traz suas dependências no corpo — leia antes de
pegar.

> 🔴 **12 corpos de issue precisam de emenda antes de serem implementados.** A **revisão de
> recebíveis Calliandra** (2026-07-31) reconciliou os dois documentos EVI contra EVIs reais e
> derrubou premissas de **#220, #227, #229, #230, #231, #232, #233, #234, #236, #237, #240 e
> #241**. As emendas estão na seção *Emendas pendentes de aprovação* de
> `docs/issues-evi-propostas-2026-07-31.md`; a reconciliação, em
> `docs/revisao-recebiveis-calliandra-2026-07-31.md`.
>
> **Nenhuma dessas issues deve ser implementada com o corpo antigo.** A pior é a **#233**, cujo
> critério de aceite ainda diz *"a 1ª parcela ocorre no mês da venda"* — o oposto da regra
> aprovada, que é `s + 1` com `N_s = M − s`. As issues **não foram editadas no GitHub**: aplicar as
> emendas é decisão do autor.
>
> A ordem dos portões **não muda** e o total continua **22 issues, todas abertas, 0 implementadas**.

> ⚠️ **Quem encerrar a rodada atualiza esta seção na mesma alteração.** A Rodada 4 nasceu porque
> #165–#169 ficaram abertas uma rodada inteira sem ninguém perceber, com este arquivo dizendo "não
> há issue aberta".

Rodadas anteriores, todas mergeadas na `main`:

| Rodada | Escopo | Estado |
|--------|--------|--------|
| 1 — Lotes 1–8 | issues #9–#24 | ✅ concluída |
| 2 — Etapas 1–8 | issues #33–#56 | ✅ concluída |
| 3 — Sessões S1–S20 | issues #71–#132 | ✅ concluída |
| 4 — planilha `lista_bugs.xlsx` | #165–#169 + #172–#201 | ✅ concluída |
| **5 — EVI** | **#220–#241** | 🔴 **aberta, 0 implementadas** |

**Os quatro mapas mestres foram apagados em 2026-07-31**, com todas as issues mergeadas: eram
backlog fechado e não disparavam mais trabalho. Os disparos antigos (`Prossiga para os issues do
lote X`, `Siga para a Etapa X`, `Siga para a Sessão SX`, `Resolva a issue #NNN`) **não existem
mais** — não procure por eles. O histórico completo continua no `git log` e no `PROGRESSO.md`, que
guarda a narrativa de cada sessão.

O que ainda valia daqueles documentos foi **migrado antes da exclusão**: as decisões do autor que
não devem ser relitigadas (#185 sobre `SerieGrafico`, #190/#191 sobre as parcelas ancoradas na
Obra, #192 sobre a linha `Projetado`) estão no **Anexo F** de
`docs/viabilidade/padrao-incorporacao.md`. As causas raiz que aqueles mapas descreviam já foram
corrigidas pelas próprias issues.

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

> **Nota de ambiente:** o `gh` CLI **não existe** neste ambiente — só `git`. Não gaste tempo
> procurando o `gh`.
>
> Isso **não** significa que o PR não possa ser aberto: quando a sessão tiver as ferramentas MCP do
> GitHub (`mcp__github__create_pull_request`, `merge_pull_request`, …), o fluxo completo
> branch → push → PR → merge funciona por elas. Confirmado em 2026-07-31, na sessão da revisão
> Calliandra. Só quando essas ferramentas **não** estiverem disponíveis é que se faz
> branch → push e se deixa ao autor o link
> `https://github.com/<owner>/<repo>/pull/new/<branch>`.

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

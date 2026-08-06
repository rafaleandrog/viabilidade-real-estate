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

## Estado do backlog — 🟢 SEM RODADA ABERTA

| Rodada | Escopo | Issues | Estado |
|---|---|---|---|
| **5 — EVI** | Auditoria do app contra os documentos EVI | **#220–#241** (22) | ✅ **concluída em 2026-08-02** |
| **6 — lista de bugs** | `lista_bugs.xlsx`, 24 itens `BUGLIST-001`…`BUGLIST-024` | **#238, #239, #244–#281** (37 destinos) | ✅ **concluída em 2026-08-02** |

**As duas foram executadas juntas por uma trilha única de 10 fases** (plano aprovado pelo autor em
2026-08-01), com portão de merge ao fim de cada fase. Os quatro cruzamentos entre rodadas (itens 5,
11, 16 e 24 da lista de bugs) foram resolvidos sem duplicar implementação: item 5 (#248) é UX sobre a
cadeia EVI #230/#232–#237; item 11 (#254) é epic de rastreio, fechada quando as executoras EVI
fecharam com diff; item 16 (#238) e item 24 (#239) já eram issues compartilhadas desde a abertura.

**Todas as 59 issues distintas das duas rodadas estão mergeadas na `main`**, exceto duas cujo
critério de aceite não é código:

> 🔴 **Esta afirmação era enganosa e foi corrigida pela triagem de 2026-08-03.** 53 issues estavam
> abertas no GitHub porque os commits citaram `(#256)`, `(#273-276)` em vez de `Closes #NNN`
> (prevenção agora no lugar: § Fechamento de issue + guard no CI). Mas a conferência dos critérios
> de aceite contra o **código** revelou algo pior que a keyword faltando:
>
> | Veredito | Qtd |
> |---|---:|
> | ✅ confirmada e **fechada** | 23 |
> | 🟡 **parcial — segue aberta** | 29 |
> | ⚪ depende do autor (#264) | 1 |
>
> **Menos da metade das duas rodadas se sustenta no código.** "Mergeado" nunca significou
> "entregue". Cada issue aberta tem comentário dizendo o que falta; a tabela completa, com evidência
> `arquivo:linha`, está em **`docs/triagem-issues-2026-08-03.md`**.
>
> O maior buraco: nove issues da cadeia EVI de recebíveis (#230, #232–#237, #240, #241) têm a
> matemática pronta e testada, mas **não ligada a `calcularFluxo`** — o próprio motor declara isso
> em `frontend/fluxo-caixa-motor.ts:505-511`. A integração virou a **#283**, e ela é precondição
> das nove.

- **#254** (epic de rastreio) — fecha porque #220, #221, #227–#237, #240 e #241 (suas executoras)
  já fecharam com diff; não tem diff próprio.
- **#264** (`fix(cenarios)` confirmar as duas séries e decidir o estado 0%) — o código já mostra as
  duas séries quando o slider sai do zero e o estado 0% já era decisão explícita das #131/#132;
  o critério de aceite restante é o autor confirmar a **versão publicada na instância** (fora do
  ambiente Claude Code), não uma mudança de código.

A **segunda verificação da Fase 9** (Capital Stack, epic #239), pedida explicitamente pelo autor
depois do merge, achou e corrigiu 3 defeitos reais que os 16 golden cases não exerciam (ordem
principal×remuneração do §6.1, shape de migração da `preferred_equity`, `prioridade_pagamento`
nunca lida/editável) — detalhe em `docs/viabilidade/funding-capital-stack.md` §13.4 e no
`PROGRESSO.md`.

**Pendências do autor no ambiente autenticado** (o ambiente Claude Code não cobre — lista
consolidada de todas as rodadas): `urbi-empacotar`; sincronização do `schema.json` pelo SDK
(inclui as tabelas `analise_mercado`/`mercado_regioes`/`mercado_coletas` e a tabela nova
`avancado_capital_instrumentos`); execução real de **todas** as migrações no Postgres (`001` a
`019`, cadeia completa nunca rodada em produção); confirmação de que o shell descobre
`export { rotinas }` em `backend/rotas.ts`; configuração de `mercado_busca_url`/`mercado_busca_chave`
para a coleta diária de mercado sair do modo `sem_fonte_externa`; e a confirmação de versão
publicada que fecha a #264. Detalhe histórico no `PROGRESSO.md` (#199, #200).

Rodadas anteriores, todas mergeadas na `main`:

| Rodada | Escopo | Estado |
|--------|--------|--------|
| 1 — Lotes 1–8 | issues #9–#24 | ✅ concluída |
| 2 — Etapas 1–8 | issues #33–#56 | ✅ concluída |
| 3 — Sessões S1–S20 | issues #71–#132 | ✅ concluída |
| 4 — planilha `lista_bugs.xlsx` (1ª leva) | #165–#169 + #172–#201 | ✅ concluída |
| 5 — EVI | #220–#241 | ✅ concluída (2026-08-02) |
| 6 — lista de bugs (24 itens) | #238, #239, #244–#281 | ✅ concluída (2026-08-02) |

Os mapas mestres das Rodadas 1–4 foram apagados quando fecharam — eram backlog puro, sem valor de
evidência duradoura. **Os das Rodadas 5/6 foram mantidos** (`docs/issues-evi-propostas-2026-07-31.md`,
`docs/rodada-5-evi-2026-07-31.md`, `docs/revisao-recebiveis-calliandra-2026-07-31.md`,
`docs/lista-bugs-planejamento-2026-07-31.md`, `docs/viabilidade/funding-capital-stack.md`) — guardam
evidência `arquivo:linha` e o ADR de decisões (emendas Calliandra, waterfall do Capital Stack) que
vale a pena não perder. Nenhum deles dispara mais trabalho: os disparos antigos (`Siga para a Fase
N`, `Siga para o Grupo N`, `Resolva a issue #NNN`) **não existem mais** — não procure por eles. O
histórico completo está no `git log` e no `PROGRESSO.md`.

> ⚠️ **Lição das rodadas anteriores, ainda válida:** "fechou a issue" não é evidência de entrega —
> nem "abriu a issue" é evidência de que alguém vai pegá-la. **O diff é.** Se abrir uma rodada nova,
> atualize esta seção junto — e quem a encerrar faz o mesmo, na mesma alteração. A Rodada 4 nasceu
> porque #165–#169 ficaram abertas uma rodada inteira sem ninguém perceber, com este arquivo dizendo
> "não há issue aberta".

### Fechamento de issue — `Closes #123`, sempre em inglês

> ⚠️ **Só keyword em inglês fecha issue.** O GitHub vincula PR→issue exclusivamente por
> `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved` (maiúsculas
> indiferentes), e **só no corpo do PR ou na mensagem do commit — nunca no título**.

Quatro formas que falham **caladas** — sem erro, o PR mergeia, a issue fica aberta:

| Escrito | Fecha? |
|---|---|
| `Closes #244` no corpo do PR | ✅ |
| `(#244)` no assunto do commit — **só menção** | ❌ |
| `Fecha #244` (português) | ❌ |
| `Closes #273-276` / `#277+278` (intervalo/composto) | ❌ |
| `Closes #1, #2` — fecha só a **#1** | ⚠️ parcial |

Repita a keyword por issue: `closes #273, closes #274, closes #275`. **Depois de mergear, confira
que a issue fechou** em vez de assumir.

> **Por que esta seção existe:** em 2026-08-03 o autor tinha **53 issues abertas** descrevendo
> trabalho já implementado e mergeado — as Rodadas 5 e 6 inteiras. Os commits citavam a issue como
> `(#256)` ou `(FIN-04+05+06+07, #273-276)`. Na `main`, 6 commits usaram `Closes` e são exatamente
> as 6 issues que fecharam; as outras ~82 menções fecharam zero. A regra existia — mas no
> `CLAUDE.md` do monorepo `urbiverso/urbiverso`, que sessão deste repo não lê. Ver `PROGRESSO.md`.

O guard `scripts/guard-issue-fechamento.mjs` (job `issue-fechamento` no `pr-guards.yml`) barra PR
que cita issue sem declarar o que faz com ela. Para citar sem fechar (epic, contexto, "ver #260"),
declare no corpo: `Sem-fechamento: #NNN <motivo>` — o guard não obriga a fechar, obriga a **decidir**.

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

Ele roda, em 5 etapas: os **guards estáticos** (aspas curvas em posição de atributo + **JSON
estrito** em `schema.json`/`manifesto.json`), depois `pnpm install`
(ignorando o 401 do SDK, que ainda assim baixa lit/typescript/tsx/esbuild para `.pnpm/`), linka
esses pacotes e executa **typecheck do frontend + testes de frontend + build do bundle
(esbuild)**. Verde = mudança de frontend validada.

> **Por que o guard de aspas curvas existe:** `variante=”alerta”` (aspa curva, U+201D) deixa o
> atributo **inerte** — o parser inclui as aspas no valor, ele não casa com nada e o primitivo cai
> no default, sem erro em lugar nenhum. Como mora dentro de template literal do lit, atravessa
> typecheck, testes e esbuild **em verde**: foi assim que o #71/#160 sobreviveu a uma rodada
> inteira que "validou ✓". Aspas curvas em **conteúdo de texto** são tipografia legítima e não são
> acusadas — o padrão casa só `=` seguido de aspa curva.

O `.github/workflows/pr-guards.yml` é o CI de PR (só `git` + `grep` + `node`, sem SDK, então nunca
fica vermelho por falta de credencial). Barra **PR de diff vazio que declara fechar issue** — o caso
do PR #142, que fechou 12 issues sem alterar um arquivo — e repete os guards de **aspas curvas** e
de **JSON estrito** para pegar quem não rodou o script local.

O `.github/workflows/validation.yml` é o CI **pesado** (build + os dois validadores; precisa do
`secrets.URBIVERSO_PACKAGES_TOKEN` para o SDK). Ele **não** roda `pnpm test`/`pnpm typecheck`
soltos: são subconjunto estrito de `validar-frontend.sh` + `validar-backend.sh`, e rodar os dois
caminhos dobrava o tempo. O `pnpm build` fica, porque é o único passo que gera de verdade
`backend/rotas.js`.

### Duas regras de CI, sem exceção — `timeout-minutes` e `--test-timeout`

> ⚠️ **Todo job de CI declara `timeout-minutes`; todo `node --test` declara `--test-timeout`.**
> Sem `timeout-minutes` o default do GitHub é **6 horas**: em 2026-08-06 o job da PR #304 pendurou
> no passo `Testes` e ficou `in_progress` indefinidamente — e como a API do GitHub **só serve log de
> job concluído**, não havia absolutamente nada para ler. O baseline verde do mesmo job é **33s**
> (suíte inteira: 325 testes em 2,2s), então qualquer coisa acima de minutos já é travamento.

As duas defesas contra teste que não termina são **complementares** — não escolha uma:

| Defesa | Pega | Não pega |
|---|---|---|
| `--test-timeout=60000` | teste **assíncrono** pendurado, dizendo o **nome** dele | laço **síncrono**: `while(true){}` bloqueia o event loop e o timer do runner nunca dispara |
| `com_limite` (wrapper de `timeout`, nos dois scripts) | laço síncrono — mata o **processo** | não sabe qual teste travou |

Se o CI ficar pendente em vez de vermelho, o problema não é o teste: é um job sem timeout.

> **Por que o guard de JSON estrito existe:** um bloco de comentários `//` no `schema.json` derrubou
> a release **v0.1.19** com "Pacote reprovado na validacao". JSON não tem comentário — o
> `JSON.parse` do shell estoura e o pacote é reprovado **antes de olhar qualquer tabela**. Nem
> `tsc`, nem os testes, nem o `esbuild`, nem o harness de migrações leem o `schema.json`; o único
> parse estrito do repo (`scripts/validar-schema.mjs`) é a etapa 2/5 do `validar-backend.sh`, e a
> etapa 1/5 **aborta quando o SDK não está em `node_modules`** — o caso deste ambiente. Por isso o
> `scripts/guard-json.mjs` não depende de SDK e roda nos **três** lugares. Ver `PROGRESSO.md`
> (2026-08-03).

**Para mudanças de BACKEND / SCHEMA / MIGRAÇÃO:** existe o segundo script, criado em 2026-07-29
depois de descobrir que a regra antiga ("backend só roda no ambiente do autor") era conservadora
demais:

```
bash scripts/validar-backend.sh
```

Ele roda **guard de JSON estrito (etapa 0/5, antes do portão do SDK) + typecheck do backend +
testes de lógica pura das rotas + harness de migrações + guard de `versao`**. Funciona aqui porque:

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
- **Todo valor monetário resultado de fórmula tem 2 casas decimais** — na apresentação, na entrada e
  no motor. Representações derivadas **não monetárias** (% e R$/m²) carregam **precisão plena**
  internamente e arredondam **só para exibir**; nunca são persistidas arredondadas. Decisão do autor
  em 2026-08-01; é o contrato que fecha a #259 e dá regra às #260 e #281.
  > ⚠️ **Parcialmente resolvido — o texto anterior desta nota estava vencido** (dizia que `fmtR$`
  > usava `maximumFractionDigits: 0`, o que deixou de ser verdade e ninguém atualizou; foi pego na
  > triagem de 2026-08-03). Hoje `frontend/viab-format.ts:14` já usa 2 casas, e o Orçamento de
  > Custos em `rs` também (`frontend/tela-fluxo-custos.ts:673,933`). **O que ainda falta** é
  > `frontend/exportar.ts:10` deixar de definir o seu próprio `const R$ = v.toFixed(2)`: enquanto
  > houver duas fontes de formatação, tela e exportação podem divergir de novo. Continua sendo a
  > #281 — não corrija pontualmente.
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

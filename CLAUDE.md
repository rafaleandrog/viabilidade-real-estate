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

## Estado do backlog — ✅ RODADA 9 CONCLUÍDA (2026-08-24)

| Rodada | Escopo | Issues | Estado |
|---|---|---|---|
| **9 — execução da Rodada 8** | Ondas de PRs que entregam as issues #426–#493, na ordem de dependência | **#426–#493** | ✅ **concluída em 2026-08-24** — as 59 issues fechadas |
| **8 — auditoria cruzada** | Reverificação da `lista bugs 20260807.xlsx` + regras derivadas das 3 planilhas (EVI Urbitá, fluxo do investidor) + conferência numérica em Pinguim + auditoria de UI | **#426–#493** (61 abertas; #461 e #480 fecharam por decisão) | ✅ **auditoria concluída em 2026-08-22** — o saldo de **59 issues** é executado pela Rodada 9 |
| **7 — lista de bugs (2ª leva)** | `lista_bugs_20260807.xlsx`, 47 itens (numerados 1–41 e 43–48 — **o item 42 não existe na planilha**) | **#309–#355** (47) | ✅ **concluída em 2026-08-12** |
| **5 — EVI** | Auditoria do app contra os documentos EVI | **#220–#241** (22) | ✅ **concluída em 2026-08-02** |
| **6 — lista de bugs** | `lista_bugs.xlsx`, 24 itens `BUGLIST-001`…`BUGLIST-024` | **#238, #239, #244–#281** (37 destinos) | ✅ **concluída em 2026-08-02** |

### Rodada 8 — o que é, e o placar honesto

Oito agentes auditaram o app contra a lista de bugs `20260807`, a EVI Urbitá, a planilha
`fluxo_investidor_FORMULAS` e a instância Pinguim; documentos em `docs/rodada-8/` (comece por
`LEIA-PRIMEIRO.md`). A pergunta era: **o que da Rodada 7 realmente se sustenta no código, e que
regras as três planilhas do autor exigem que o app ainda não representa?**

**Placar da reverificação dos 47 itens** — a lista foi auditada **inteira**, item a item, pelo
**corpo** da coluna `Issue` e não pelo título:

| Veredito | Qtd | Itens |
|---|---:|---|
| ✅ confirmado no código | 38 | os demais |
| 🟡 parcial — uma cláusula sobreviveu | 5 | 2, 11, 22, 24, 41 |
| 🔴 reprovado/reaberto | 2 | 15, 31 |
| ⚪ correto na `main`, sem diff próprio | 1 | 20 |
| ⚫ indecidível sem o print da planilha | 1 | 45 |

> **O que fez a diferença no método:** ler o **corpo** da coluna `Issue` da planilha, não o título.
> O item 6 pedia "no máximo 3 campos por linha"; o **título** dizia "reordenar" — o oposto do
> pedido. Quatro itens (14, 18, 32, 43) teriam recebido veredito oposto se lidos pelo título.
> **Título de planilha não é requisito.**

**Decisões do autor, vinculantes:**

1. **Nenhum bug foi consertado na Rodada 8 — tudo virou issue.** O autor autorizou o conserto de 3
   bugs graves e depois **reverteu**; o material virou corpo de issue (`docs/rodada-8/09-consertos.md`).
2. **Capital de giro: só o rótulo.** O tipo `divida` já **é** o produto de CG por calendário. A
   linha de crédito **rotativa** foi **recusada**: reintroduziria a competição por caixa que a #355
   apagou.
3. **A base de receita líquida do equity não muda** (`frontend/funding-motor.ts:58-67`) — a
   divergência com as duas planilhas é **intencional**, e vira nota, não issue.
4. **`avancado_capital_instrumentos` não é apagada do `schema.json`** nesta rodada.
   > ⚠️ **A redação original desta decisão dizia que a tabela é mantida porque "guarda o dado
   > migrado pela `019`", e isso não se sustenta** — a `019` nunca rodou em Postgres. A #479
   > (mergeada em 2026-08-23) estabeleceu os motivos que **de fato** valem: remover é mudança de
   > schema, e portanto escopo; e a tabela é a evidência viva do modelo apagado. O caminho de
   > remoção **existe** (`dados.limparTabela` + poda do reconciliador) — não é falta de mecanismo.
   > Enquanto ela existir, quem guarda o reúso é `scripts/guard-tabelas-obsoletas.mjs`.

### Rodada 9 — como está sendo executada

Ondas de PRs, uma issue (ou um grupo coeso) por PR, em fila indiana, com merge ao fim de cada uma.
**Onda 1** (infra de verificação de UI: espelho `docs/ui-urbiverso/`, três guards estáticos e o
harness de render em Chromium) está concluída e mergeada. As ondas seguintes entregam o backlog na
ordem de dependência, com a cadeia do denominador (#426 → #433 → #429 → #431 → {#432, #435} → #434
→ #428) **estritamente serial**, porque todos movem o mesmo denominador.

**Encerrada em 2026-08-24.** As últimas a fechar foram #462 (deflator de área aberta, migração
`034`), #469 (fixture das três divergências de equity), #484 (decisão do autor: **manter** o
controle inerte de Correção de estoque) e #489 (larguras de coluna — Problemas 1 e 2 entregues, o 3
resolvido como cosmético por medição). A `main` fechou o dia em `versao` `0.1.33`, com 688 testes,
27 casos de render e a cadeia de migrações `030 → 034` íntegra.

#### O que a auditoria retrospectiva mediu, e por que ela valeu

Ao fim das ondas, cinco agentes conferiram **21 issues já mergeadas** contra os critérios de aceite
literais, com evidência `arquivo:linha` e teste de mutação — o mesmo método que em 2026-08-03
reprovou 29 de 52 issues fechadas. **Desta vez: zero 🔴.** Mas ela achou o que só se acha
conferindo:

- **Uma defesa declarada e inexistente.** O merge da #491 afirmava que `maiorMelhor` era parâmetro
  obrigatório em `_badgeVar`; a obrigatoriedade valia só para `calcularVariacao`, a função pura. O
  wrapper que o template chama tinha `= true`, e apagar o argumento **compilava limpo**,
  reintroduzindo o bug em silêncio. Consertado pelo PR 557.
- **Uma afirmação medida no ponto errado.** A #469 relatou "3 vermelhos" ao apagar o 4º argumento de
  `validarFunding` — verdade **dentro da fixture**, falsa na fiação do componente, onde a mesma
  mutação deixa 683/683 verdes. A fixture prova que a checagem funciona quando recebe o argumento;
  não impede a tela de parar de passá-lo.
- **Uma referência circular.** A #467 prometia uma nota no doc que apontava para si mesma, enquanto
  o comentário de código apontava de volta para o doc. Nenhum dos dois tinha o conteúdo (PR 560).

> **A lição do dia, e ela é diferente das anteriores:** as três descobertas vieram de **medir o
> ponto certo**, não de medir mais. Uma medição verdadeira sobre a pergunta errada é
> indistinguível de uma verificação boa — e foi assim que uma defesa inexistente atravessou um
> merge com o corpo do PR afirmando que ela existia.

#### Duas armadilhas de ferramenta que custaram tempo, e como reconhecê-las

- **`tsc` numa worktree sem `node_modules`** morre no carregador de módulos e devolve **saída
  vazia** — indistinguível de "nenhum erro". **Rode sempre o controle primeiro**: confirme que o
  código sem mutação passa, senão a mutação não significa nada.
- **`git checkout -B` com árvore suja carrega o não commitado para a outra branch**, e o `git add
  -A` seguinte o varre para o commit errado. Foi assim que a correção do Problema 2 da #489 entrou
  na `main` dentro do PR da #477 (`bc40d31`), sob um título que não a menciona. Use `git stash -u`
  antes de trocar de branch, e `git add` com caminho explícito.

#### ⚠️ O motor adversarial esteve AUSENTE nesta rodada

O App do Codex respondeu **`"To use Codex here, create an environment for this repo"`** em todos os
PRs em que foi acionado, e nos dois últimos não respondeu nada dentro do teto de 15 minutos. Ele
está instalado, recebe o `@codex review`, mas **não tem ambiente configurado** — então não executa.
Funcionava no PR 494 (2026-08-23) com achados P1 reais; parou entre aquela data e 2026-08-24.

Consequência a não esquecer: **toda revisão desta rodada é autoatestação**, feita por quem escreveu
ou por agentes da mesma família de modelo. Está declarado em cada relatório, inclusive o desvio de
publicar `bloqueantes=0` onde a regra manda `bloqueantes=1` quando o App não responde. **Restaurar o
ambiente do Codex é pré-requisito para a próxima rodada ter revisão independente de verdade.**

> ⚠️ **Quem abrir a Rodada 10 atualiza esta tabela junto, e quem a encerrar faz o mesmo, na MESMA
> alteração que fechar a última issue.** Não delegue para "depois": foi exatamente assim que a #416
> nasceu.

### Rodada 7 — como foi

Executada em 11 fases (E01→E47), uma issue por vez, com portão de merge entre fases. Cada issue leva
no título `[BUG7-NN]`, onde `NN` é a ordem de execução — **não** o número do item da planilha, que
está citado no corpo. Dependências usam `Sem-fechamento: #NNN pré-requisito`: não fecham a issue
citada, só declaram a ordem.

**O bloqueio D6 foi levantado.** A issue #355 (item 48, Funding/Capital Stack) esteve formalmente
bloqueada porque o documento `fluxo_investidor_FORMULAS` não estava no repositório; o autor o anexou
em **2026-08-11** e a Fase 11 foi entregue no dia seguinte pelo **PR #412**. A planilha está hoje
transcrita em **`docs/viabilidade/fluxo-investidor-formulas.md`** — que é a **especificação vigente**
de `divida` e `equity`.

O Capital Stack (4 instrumentos com waterfall) **deixou de existir**: saíram
`capital-stack-motor.ts`, `tela-capital-stack.ts`, `backend/rotas/capital-stack.ts` e os 16 golden
cases de `frontend/fixtures/`. No lugar, 3 operações independentes — sem waterfall, sem prioridades,
sem competição por caixa — em `funding-motor.ts` / `tela-funding.ts` / `backend/rotas/funding.ts`,
tabela `avancado_funding_operacoes` (migração `029`). `docs/viabilidade/funding-capital-stack.md`
virou ADR histórico, **exceto a §4.3** (Financiamento à produção), que continua vigente: a #405
aprovou ali o gatilho de exposição mínima, o catch-up retroativo e o cash sweep, e a #355 preservou
esse produto de propósito — ele é o único que **não** segue a planilha nova.

> ⚠️ **Auditoria de 2026-08-17 — as 4 lacunas, e o fechamento delas.** A Rodada 7 fechou com três
> passos do próprio plano da #355 sem executar: a spec `fluxo-investidor-formulas.md` (F11.1) nunca
> entrou no repo, embora 4 arquivos a citassem como fonte; a decisão **D14** (alerta de caixa
> negativo após funding) não foi implementada; e esta seção continuou dizendo "Rodada 7 aberta /
> #355 bloqueada" (F11.6). A quarta, o aviso regulatório da §17, a #277 entregou e a reescrita da
> #355 apagou junto com `tela-capital-stack.ts`.
>
> **As quatro viraram #413, #414, #415 e #416, e todas fecharam com diff no commit `ba06add`
> (PR #417, 2026-08-17).** Evidência hoje: `docs/viabilidade/fluxo-investidor-formulas.md` existe;
> D14 está em `frontend/fluxo-invariantes.ts:376-387`
> (`CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, severidade `alerta`); o aviso regulatório, em
> `frontend/tela-funding.ts:615-619`.
>
> A lição é a de sempre, com uma volta a mais: **"a issue fechou" não é evidência de entrega, e o
> plano publicado na issue também não** — só o diff é. Quando um plano tem passo de documentação ou
> de estado, ele morre calado se ninguém conferir, porque nenhum teste fica vermelho por causa dele.
> **E o corolário, que esta própria nota exemplifica: nota de auditoria também envelhece.** Quem
> fechar as issues de uma auditoria reescreve a nota na mesma alteração.

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
> O maior buraco daquela triagem — nove issues da cadeia EVI de recebíveis (#230, #232–#237, #240,
> #241) com a matemática pronta mas **não ligada a `calcularFluxo`** — **foi fechado pela #283**:
> `recebimentoBrutoMensal` consulta o contrato canônico em
> `frontend/fluxo-caixa-motor.ts:1340-1341` e `calcularFluxo` agrega juros, principal, carteira e
> repasse em `:2025-2053` (teste `frontend/fluxo-caixa-motor.test.ts:1762-1787`). A porta é
> `fluxo_pagamento.componentes`, que `fluxoPagamentoParaSalvar` grava em toda escrita.
> **O que continua faltando não é a integração, é o INPUT de taxa e de sinal no modal (#428):** há
> linha em produção com `taxaMensal: 0.0098636` (R$ 1.259.273,59 de juros). Abrir o modal e clicar
> "Aplicar" **apagava** esses juros; desde a #431 não apaga mais — `componentesParaSalvar` preserva
> o que o espelho legado não sabe representar.

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
`028`, cadeia completa nunca rodada em produção); confirmação de que o shell descobre
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

### Processo obrigatório de trabalho

> **Todo pedido de trabalho neste repositório passa por: branch → PR → revisão → rodadas → merge
> só com autorização do autor.** Não é modo opcional para pedido grande. **Pedido de uma linha
> também abre branch e PR.**

1. **Branch própria, criada de `origin/main`** — `main` é só para puxar (ver § Sessões paralelas).
   Logo depois de criar, `git branch --unset-upstream`: branch criada com `checkout -B <nome>
   origin/main` rastreia a **`main`**, e aí um `git push` pelado empurra para lá. Confira com
   `git rev-parse --abbrev-ref @{u}`; se responder `origin/main`, a armadilha está armada.
2. **Implementar e validar** com o script que couber (§ Validação): `validar-frontend.sh` sempre,
   `validar-backend.sh` se tocou backend, `schema.json` ou migração.
3. **Commit + `git push -u origin <branch>`** — sempre com o nome explícito, nunca `git push` pelado.
4. **Escrever o corpo do PR num arquivo e rodar o preflight** — `node scripts/preflight-pr.mjs
   --corpo <arquivo.md> --titulo "<título do PR>"`. **O título é obrigatório**: o job `diff-vazio`
   do CI concatena título + corpo + commits, e sem ele um PR com `Closes #NNN` só no título e diff
   vazio passa aqui e reprova lá. Ele roda, **antes** do PR existir, os guards que só leem corpo e diff:
   fechamento de issue, escopo R1, diff vazio, JSON, ciclos de schema, regra da migração, mais as
   armadilhas de árvore (branch `main`, upstream armado, árvore suja) que o CI já não pode pegar.
   Verde → **abra o PR passando esse mesmo arquivo**, sem reescrever o corpo na chamada do MCP;
   reescrever desfaz o que foi verificado.
5. **Abrir o PR pelas ferramentas MCP do GitHub** (o `gh` não existe aqui — ver a nota de ambiente
   da § Merge), com o template preenchido e `Closes #NNN` **em inglês** quando houver issue.
6. **Revisar, na mesma sessão**, invocando a skill **`revisar-pr-apps`**. Ela publica o relatório
   completo como comentário no PR e devolve à conversa só o resumo por severidade.
7. **Consertar e abrir rodada nova**, com lentes novas sobre o conserto. **O ciclo fecha quando não
   há bloqueante pendente** — consertado, ou retirado por contestação com evidência.
8. **Parar.** O PR fica pronto e parado. Merge é decisão do autor — ver § Merge, que não mudou.

> **Por que o passo 4 existe.** Os guards de `pr-guards.yml` leem duas coisas que não existem
> enquanto o PR não foi aberto: o **corpo** e o **diff**. Então o erro de metadado só aparece
> *depois* — o PR nasce vermelho, custa um ciclo de edição e re-run, e quem olha de fora lê "o
> código quebrou". No PR 501 foi uma citação `#440 → #450` em prosa sem linha `Sem-fechamento:`:
> nove jobs verdes, um vermelho, zero problema de código. O preflight move essa classe inteira
> para antes do push, onde consertar custa uma linha.

#### As três regras de escopo — o que impede o ciclo de não fechar

> ⚠️ **Escritas depois de um incidente, e o incidente está fechado** — PR 494, mergeado em
> 2026-08-23. Ele levou rodada após rodada de revisão para entregar o que já estava pronto no
> primeiro commit, e **nenhum achado do revisor foi falso**: o revisor funcionou, o escopo do PR é
> que estava errado. Estas três regras não são estilo — são a diferença entre uma rodada e dez.

**R1 · Mudança de processo não entra em PR que está sob revisão.**
Arquivo de processo é `.claude/**` — a skill de revisão, o motor da fan-out — mais a
§ *A revisão em si* deste arquivo. Eles **se referenciam**: toda regra nova precisa aparecer em
todos, e o revisor acusa, com razão, cada um que ficou para trás. Editá-los de dentro de um PR em
revisão cria um ciclo que **não converge por construção** — cada conserto vira o achado da rodada
seguinte. Vão em **PR próprio**, com todos os documentos propagados **no mesmo diff**.
O guard `scripts/guard-pr-escopo-processo.mjs` (job `escopo-processo`) barra o PR que misture
processo com código de produto.

**R2 · O ciclo fecha por convergência, não por contagem.**
Critério único, o mesmo do upstream: **zero bloqueantes pendentes** — consertado, ou **retirado por
contestação com evidência**. Rodada que acha defeito novo, distinto e real é rodada funcionando, e
**não tem teto**. Observação nunca segura o ciclo: vira registro no PR, e o autor decide.

O ciclo também termina antes disso em dois casos, e nos dois você **diz qual é a pergunta** que o
autor precisa responder, em vez de deixar "aguardando decisão" solto:

- **Decisão de desenho** — o conserto mexeria em algo que o autor decidiu. Com parcimônia: usado à
  toa, vira jeito de terceirizar julgamento que era seu.
- **Achado que não converge** — **o mesmo defeito** volta rodada após rodada. Pare, diga o que
  está girando, devolva. **Precedência: bloqueante que você julga distinto SEMPRE reabre**, mesmo
  caindo na mesma faixa ou pedindo o mesmo conserto; esta saída é só para o defeito que **continua
  recorrendo**. Sem essa ordem, uma sequência de bloqueantes reais e diferentes na mesma área
  satisfaz ao mesmo tempo "reabra" e "pare", e dois revisores encerram o mesmo histórico de formas
  opostas — um deles deixando bloqueante conhecido pendente.

> ⚠️ **A terminação é condicional, e quem termina de fato é o autor.** O teto antigo terminava por
> construção; isto **não**. Se cada conserto expuser bloqueante genuinamente novo, o ciclo reabre —
> e é o que se quer, porque a alternativa é mergear com defeito conhecido. O que fecha na prática é
> a **contestação com evidência**, que retira achado, e o fato de que **o merge é do autor**: ele
> encerra quando quiser, a qualquer rodada, e a sessão não pede essa autorização.

> ⚠️ **Não formalize "a mesma faixa volta".** Esta seção já teve um predicado formal — par
> `contrato + ocorrência`, âncoras estáveis, condições conjuntas — e ele levou **cinco rodadas de
> revisão e dez achados**, todos em maquinaria que o upstream não tem. Cada conserto criava o
> buraco seguinte: a chave com número de linha nunca dispararia, porque linha muda a cada conserto;
> a identidade só por contrato colapsava defeitos distintos; a rodada de confirmação satisfazia o
> próprio predicado de laço. E a defesa que eu tinha escrito contra não-terminação era **circular**
> — citava o teste de laço, que por construção não dispara quando os defeitos são novos.
>
> A frase informal é do upstream de propósito: **ela é um julgamento a ser exercido e registrado,
> não um teste a ser satisfeito.** Quem parar por ela diz o que está girando, e o autor confere.

> ⚠️ **Esta regra já foi "teto de duas rodadas", e o teto era invenção desta cópia — o upstream
> nunca teve contador.** Ele mede a coisa errada: trata como igual a rodada que descobre defeito
> novo e a que gira em falso. Medido em 2026-08-23: o PR 502 fez **seis** rodadas, todas com
> bloqueante de código real, cada uma achando um membro diferente da mesma classe — e uma delas
> pegou um defeito que o conserto anterior tinha *criado*. Um teto de duas teria mergeado um
> preflight que quebrava o CI de toda migração.
>
> O caso que motivou o teto — o PR 494, dez rodadas sem fechar — **era** não-convergência, e a
> causa raiz dele já é tratada pela **R1**: mudança de processo não entra em PR sob revisão. O teto
> tratava sintoma de doença curada, e cobrava o preço no PR que estava funcionando.

**R3 · Um assunto por PR.**
O PR 494 misturou cinco. Além de alargar a revisão, isso impede reverter uma parte sem reverter as
outras. A exceção declarada é o **PR único de documentação** que a decisão D-Q04 autorizou — ali o
assunto *é* "as correções de documentação".

> **Duas armadilhas de redação que custaram rodadas, e valem para qualquer PR:** não escreva no
> repositório uma frase que cite **o resultado de um comando que o próprio commit muda** (um `grep`
> que passa a casar por causa do diff), nem um **contador do estado corrente da revisão** (quantas
> rodadas, quantos achados) — ele envelhece a cada rodada por construção. O placar vive no PR.

**Não viu a linha `[processo]` no começo da sessão?** Então o hook `SessionStart` não rodou, e nem
o lembrete nem o aviso de branch estão te protegendo. Avise o autor em vez de seguir: hook que não
roda não imprime nada, e "não imprimiu" é indistinguível de "está tudo normal".

#### As cinco classes de defeito que esta rodada repetiu

> Escritas a partir do que a Rodada 9 achou PR após PR. Não são conselho geral: cada uma traz o
> número medido que a produziu e o mecanismo que hoje a barra. Onde o mecanismo é humano, ele está
> dito como passo, não como intenção.

**1 · O defeito mora na FIAÇÃO, não no cálculo.**
A função pura existe, está testada, e o componente pode nunca chamá-la — ou chamar com o argumento
errado. **Sete PRs desta rodada tiveram o bloqueante aí, nenhum no cálculo. Medido: apagar a chamada
no componente deixou 488, 513, 542 e 555 testes verdes**, em quatro deles. Teste de função pura não
prova ligação, e a suíte inteira não fica vermelha por causa dela.

**Defesa, e ela é um passo, não um princípio:** depois de implementar, **apague a chamada e rode a
suíte**. Se ficar verde, a cobertura daquele caminho é decoração — e o conserto não é escrever mais
um teste da função pura. Os dois consertos que funcionaram nesta rodada:

- **tornar o parâmetro obrigatório**, para a mutação virar erro de compilação (`TS2554`) em vez de
  silêncio;
- **caso de render em Chromium** que exige o seletor na tela (`frontend/render/*.render.test.ts`) —
  a única camada que enxerga "o componente não chamou".

**2 · Endereço `arquivo:linha` que deixou de resolver.**
Foi o achado nº 1 da rodada, em quase todo PR: o próprio diff, ou um merge da `main`, desloca as
linhas do arquivo citado e a prosa passa a apontar para outra coisa. Nada fica vermelho — nenhuma
etapa de validação lê prosa. Conferir à mão não resolve: a conferência é feita antes do último
merge e envelhece nele.

**Defesa: `scripts/guard-enderecos-doc.mjs`** (etapa 5/8 do `validar-frontend.sh`, job
`enderecos-doc` no `pr-guards.yml`). Ele confere que o arquivo existe, que a linha existe e que o
**símbolo citado pela frase** aparece a ±3 linhas do alvo — esta última é a que pega o caso comum,
em que o endereço continua dentro do arquivo e só deixou de apontar para o que o texto diz. A
dívida herdada está declarada, com motivo por linha, em `scripts/enderecos-doc-excecoes.mjs`, e o
guard **reprova quando uma exceção deixa de ser necessária**: entrada morta desligaria a
conferência daquele endereço para sempre, e caladamente.

> Ele é deliberadamente **conservador** — prefere deixar passar citação ambígua a acusar prosa
> correta, porque guard que atrapalha trabalho legítimo é desligado, e aí não guarda mais nada.
> `docs/rodada-8/**` fica de fora de propósito: é fotografia datada, e envelhecer é o comportamento
> certo dela.

**3 · CI verde sobre base vencida.**
**Medido: os check runs de um PR nasceram 37 segundos antes de a base dele mergear.** O CI valida o
**merge prospectivo** — então aquele verde descreve uma `main` que já não existia quando o merge
aconteceu. O PR não estava errado; o verde é que respondia a outra pergunta.

**Defesa:** antes de mergear, confira que os check runs são **posteriores ao último commit da
`main`**. Verde mais velho que a base não é verde: é resultado de outra corrida.

**4 · `Closes #NNN` numa issue com critério de aceite não cumprido.**
Aconteceu na **#451**: o PR declarava `Closes`, o próprio implementador registrava no corpo que o
critério 1 não fora cumprido, e a issue precisou ser reaberta. A keyword fecha sozinha, no merge,
sem ler nada — a divergência entre "o que o PR entrega" e "o que a issue pede" não tem quem a
acuse.

**Defesa:** `Closes` **só quando TODOS os critérios de aceite estão cumpridos**. Entrega parcial usa
`Sem-fechamento: #NNN <o que falta>`, que é exatamente o que o guard `issue-fechamento` existe para
permitir — ele não obriga a fechar, obriga a **decidir**.

> É a mesma lição de 2026-08-03, pelo avesso. Lá, 53 issues estavam **fechadas** descrevendo
> trabalho que não se sustentava no código; a conferência dos critérios contra o código reprovou 29
> delas. Fechar cedo e citar errado são o mesmo erro: tratar a keyword como registro do que foi
> feito, quando ela é uma **ação** que ninguém revisa depois.

**5 · Reimplementar à mão o que `validar-frontend.sh` já faz — e pendurar.**
Um agente inventou `find node_modules/.pnpm -maxdepth 4 -path '*typescript/bin/tsc'` para localizar
o compilador, em vez de usar o script. **Esse `find` devolve vazio**, e o `node ""` resultante
**pendura indefinidamente** — sem erro, sem saída, sem timeout. Medido em 2026-08-24: **~50 minutos
perdidos, 66 chamadas de Bash, o diff parado em 446 linhas**, com a máquina ociosa o tempo todo.

**Defesa, e ela é uma regra, não um conselho:**

- **rode `bash scripts/validar-frontend.sh`.** Ele já resolve `pnpm install`, o link dos pacotes, os
  guards, o typecheck, os testes, o build e o render;
- **precisa só do typecheck?** O caminho é **`node_modules/typescript/bin/tsc`**, literal — é o que o
  próprio script usa (`tsc="node_modules/typescript/bin/tsc"`). **Nunca** procure o binário com
  `find`, `which`, `npx` ou `pnpm exec`;
- **nunca invoque `node "$VAR"` sem checar que `$VAR` não está vazia.** `node ""` não falha: ele abre
  o REPL e espera para sempre. É a razão pela qual este defeito é caro — ele não aparece como erro,
  aparece como lentidão.

> **O sinal de que isto está acontecendo não é o agente parecer parado — é o DIFF parado.** Um
> agente `running` com `git diff --stat` congelado por minutos está preso, não pensando. Compare o
> `--stat` com o de alguns minutos antes antes de concluir que "está trabalhando".

#### As peças, e o que cada uma garante

| Peça | Onde | Garante | **Não** garante |
|---|---|---|---|
| Esta seção | `CLAUDE.md` | Entra no contexto de toda sessão | Obediência — e enfraquece depois de compactação |
| `preparar-sessao.sh` | hook `SessionStart` | Põe no contexto **fatos medidos**: branch, sujeira da árvore, motor de revisão | Não roda no meio do turno |
| `lembrete-processo.sh` | hook `UserPromptSubmit` | Reinjeta o estado a cada prompt — é o que sobrevive à compactação | Não bloqueia nada (e não deve: exit ≠0 ali trava o prompt do usuário) |
| `guarda-monorepo.sh` | hook `PreToolUse` | **Bloqueio real** de escrita no monorepo, inclusive por MCP | Não é sandbox |
| `guard-processo.mjs` | CI (`processo-integro`) | Que a rede acima não seja desmontada em silêncio | Não valida a semântica dos hooks |
| `revisao-registrada` | CI + commit status | Que "houve revisão neste head, com zero bloqueantes" seja um fato **greppável**, invalidado a cada push | **É autoatestação** — confere forma, não substância. E só vira portão com branch protection |

Nenhuma delas força uma revisão a ser **boa**. O que elas compram é que o caminho preguiçoso deixe
de ser o fácil, e que a ausência de revisão seja **visível** em vez de calada.

#### A revisão em si

> ⚠️ **Existem DUAS skills chamadas `revisar-pr-apps`, e a que responder pode ser a errada.** O
> monorepo tem uma cópia própria, e quando ele está clonado ao lado — o caso das sessões de nuvem,
> em `/home/user/urbiverso` — **as duas entram no catálogo com o mesmo nome**, sem prefixo de
> caminho na listagem. Invocar a skill **não diz qual cópia respondeu**.
>
> Esta advertência mora **aqui**, e não só na skill, de propósito: a revisão do PR 494 mostrou que
> um aviso escrito dentro da cópia do app **não é lido quando a cópia do monorepo é a servida**, e
> que conferir `git rev-parse --show-toplevel` não resolve — carregar a skill do monorepo não muda o
> diretório da sessão, então a cópia errada passa no teste. O `CLAUDE.md` é a única superfície que
> nenhuma skill sombreia.
>
> **Dois discriminadores materiais.** Se as instruções que a sessão está seguindo disserem que:
>
> - a `versao` do `manifesto.json` **bumpa** quando o PR mexe em `shell_min`/`sdk_min` — **é a cópia
>   errada**. Aqui é o contrário (§ Versão do manifesto, issue #422): subir piso não bumpa, porque a
>   `versao` descreve o **schema**. Acusar isso é bloqueante inventado, e acontece em todo PR que
>   sobe piso;
> - o diff se confronta contra `docs/shell/` do monorepo — **é a cópia errada**. Aqui a superfície é
>   o bundle do SDK publicado, e **sem bundle a lente é NÃO EXECUTADA** (§ Superfície de leitura da
>   skill).
>
> **Em qualquer divergência entre a skill e este arquivo, este arquivo vence** — e a divergência é
> para **contar ao autor**, porque significa que o catálogo serviu a cópia errada. Para reabrir a
> certa, derive o caminho em vez de cravá-lo:
> `"$(git rev-parse --show-toplevel)"/.claude/skills/revisar-pr-apps/SKILL.md`.

`.claude/skills/revisar-pr-apps/SKILL.md` é o revisor; `.claude/motor-revisao.md` é o motor da
fan-out. Os dois são **cópia** de `urbiverso/urbiverso` @ `b0361f6` (PR #2540), portados em
2026-08-18 e **substituídos pela geração nova em 2026-08-21**.

**O que foi apagado, e por quê** — para a próxima sessão não reportar como "faltando":
`protocolo-revisao-pr.md` e `skills/acompanhar-revisao/` implementavam revisão em **diálogo entre
duas sessões**, com header de máquina e teto de 3 rodadas. O upstream apagou esse modelo ("era o
contorno para despachar revisão a agentes de outro provedor de outra máquina, e o contorno morreu
quando a mesma sessão passou a conseguir isso sozinha"), e a cópia daqui estava **morta**: procurava
um plugin do Codex inexistente e, não achando, **parava para perguntar** — invocá-la produzia uma
pergunta, nunca uma revisão. O guard `processo-integro` barra a volta dos dois arquivos.

**Duas sessões continuam permitidas** quando você quiser independência de verdade: aponte outra
sessão para o mesmo PR e mande revisar. A **gramática compartilhada** que sobrou do protocolo antigo
é a linha de máquina no topo de todo relatório — `rodada`, `head`, `motor`, `bloqueantes`,
`contratos` —, e ela basta para a segunda sessão se localizar sem inventar formato próprio. O que
morreu junto com o protocolo foi o que só o modelo de duas sessões precisava: papéis, teto de
rodadas e encerramento obrigatório. Este último não faz falta porque a sessão revisora não se
inscreve em nada — ela revisa quando chamada e termina. Vale saber por que isso às vezes importa: **com uma sessão só, quem revisa
é quem escreveu** — a §8 da skill compensa com lentes novas a cada rodada, mas não é a mesma coisa.

**O motor é Codex, e ele está ligado** — por **`@codex review`** no PR, não pelo CLI. O GitHub App
está instalado neste repositório e foi exercitado em rodadas sucessivas no PR 494 (~2 min cada), com
achados P1 e P2 reais. É o **caminho normal**, e a sequência obrigatória — acionar, esperar com teto de 15 min,
colher os *review threads*, verificar, só então atestar — está em `.claude/motor-revisao.md`
§ *Sequência obrigatória do App*.

> ⚠️ **`bloqueantes=` conta os achados do Codex ainda não resolvidos**, porque
> `revisao-registrada.yml` filtra comentários **pelo autor do PR** e nunca enxerga o bot. E se o App
> não responder no teto, **publique a linha com `bloqueantes=1`**, tendo a ausência da review como o
> bloqueante. **Omitir a linha não serve**: o próprio relatório dispara `issue_comment`, o job varre
> todos os comentários do head e, se houver uma atestação `bloqueantes=0` anterior **no mesmo head**,
> **republica `success`**. Ausência de linha nova não apaga linha velha — só uma linha nova
> sobrescreve.

**São duas camadas que somam, não uma fila.** A **revisão do App** (`@codex review`) e a **fan-out
das lentes** rodam as duas. O que é condicional é o motor *dentro* da fan-out: **CLI local**
(`codex exec`) quando houver `OPENAI_API_KEY` **e** a liberação de `api.openai.com` — aqui não há, o
proxy dá **403 no CONNECT** —, e **subagente nativo** quando não houver, **declarado** no relatório
como menos adversarial, por revisar patch escrito pela mesma família de modelo. O App **não
dispensa** a fan-out: neste repositório os dois acharam classes de defeito diferentes.

**A camada de contratos não roda neste ambiente, e isso é estrutural.** Ela lê
`node_modules/@urbiverso/sdk/docs/`, e aqui **tanto o `pnpm install` quanto o `npm view
@urbiverso/sdk` dão 401** — o SDK é GitHub Packages privado. Toda revisão vai trazer
`contratos=nao-executados`. ⚠️ **Isso vira papel de parede se ninguém cobrar o que ficou
descoberto:** props de primitivo `urbi-*`, verbos do SDK, e a aderência de `shell_min`/`sdk_min` ao
que está **publicado** — esta última nem verificável daqui.

**Cópia, não link vivo.** Mudou no monorepo, alguém porta para cá à mão — nada sincroniza sozinho.
As adaptações deste repo estão marcadas `ADAPTADO` nos dois arquivos, **com o motivo ao lado**. Não
as "corrija" de volta. A maior delas: a skill do upstream manda bumpar a `versao` do `manifesto.json`
quando o PR mexe em `shell_min`/`sdk_min`; **aqui é o contrário** (§ Versão do manifesto, decisão da
issue #422), e sem essa correção o revisor acusaria bloqueante inventado em todo PR que sobe piso.

### O monorepo `urbiverso/urbiverso` é só leitura

**É proibido editar, commitar, empurrar, abrir issue ou abrir PR em `urbiverso/urbiverso`.** Ele é
**referência**: como o app roda no ambiente da plataforma, props de primitivo `urbi-*`, docs do
shell. Ler é o uso legítimo e continua livre.

A regra precisa estar escrita porque o pressuposto que a protegia é **falso nesta máquina**: as
skills portadas supunham que o monorepo simplesmente não estaria aqui (é o que
`urbiverso/CLAUDE.md` § "Sessão de app não enxerga o monorepo" prescreve), mas ele **está clonado em
`/home/user/urbiverso` e é gravável**.

Duas camadas defendem isso, redundantes de propósito — `permissions.deny` não alcança `Bash` nem
ferramenta MCP (ele casa **nome** de ferramenta, não argumento), e falha **calada** se o padrão de
caminho não casar:

| Camada | Cobre |
|---|---|
| `permissions.deny` em `.claude/settings.json` | `Write`/`Edit`/`NotebookEdit` sob `/home/user/urbiverso` |
| `.claude/guarda-monorepo.sh` (`PreToolUse`) | o mesmo, **mais** `Bash` com verbo de escrita, `cwd` dentro do monorepo, e **`mcp__github__*` com `owner=urbiverso`** |

> ⚠️ **A barra dupla de `Write(//home/user/urbiverso/**)` não é erro de digitação.** É a sintaxe de
> **caminho absoluto** em regra de permissão; com barra simples o caminho é lido como relativo ao
> projeto e a regra **deixa de casar, sem avisar**. Não "corrija" para uma barra só. E confira com
> `/permissions` que ela aparece **parseada** — regra de deny que não casa falha calada, que é
> exatamente por que o hook cobre o mesmo caso.

As baterias `scripts/testar-guarda-monorepo.sh` (57 casos) e
`scripts/testar-revisao-registrada.sh` (9 casos), as duas no CI, cobrem os dois sentidos: falso
negativo deixa a escrita passar; **falso positivo atrapalha trabalho legítimo, alguém desliga o
hook, e aí ele não guarda mais nada.**

> **Nenhuma das duas é sandbox.** `cd` + caminho relativo, symlink ou script intermediário passam.
> Elas guardam a sessão distraída, não a determinada. A defesa hermética seria **não anexar o
> monorepo a estas sessões** — decisão do autor, e o que o próprio `urbiverso/CLAUDE.md` prescreve.

**E quando a mudança pertence mesmo à plataforma?** Descreva-a — no relatório de revisão ou numa
issue **deste** repositório — com o texto pronto que o autor levaria: o que falta, por que a app não
consegue contornar, e o que ela precisaria. Quem transporta isso para o monorepo é ele.

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

> ⚠️ **O glob de teste precisa dos dois padrões: `frontend/*.test.ts frontend/fixtures/*.test.ts`.**
> `frontend/*.test.ts` sozinho **não alcança subdiretório** — foi assim que os 16 golden cases do
> Capital Stack (`frontend/fixtures/capital-stack-golden.test.ts`) ficaram desde a Rodada 6
> escritos, commitados e **nunca executados**, nem aqui nem em `pnpm test`. Corrigido em
> 2026-08-11 nos dois lugares (`package.json` e este script). Teste que não roda é pior que teste
> que não existe: ele dá a impressão de cobertura.

O `.github/workflows/pr-guards.yml` é o CI de PR (só `git` + `grep` + `node`, sem SDK, então nunca
fica vermelho por falta de credencial). Barra **PR de diff vazio que declara fechar issue** — o caso
do PR #142, que fechou 12 issues sem alterar um arquivo — e repete os guards de **aspas curvas** e
de **JSON estrito** para pegar quem não rodou o script local.

O `.github/workflows/validation.yml` é o CI **pesado** (build + os dois validadores; precisa do
`secrets.URBIVERSO_PACKAGES_TOKEN` para o SDK). Ele **não** roda `pnpm test`/`pnpm typecheck`
soltos: são subconjunto estrito de `validar-frontend.sh` + `validar-backend.sh`, e rodar os dois
caminhos duplicava trabalho sem cobrir nada a mais. O `pnpm build` fica, porque é o único passo que
gera de verdade `backend/rotas.js`.

> **Não espere ganho de tempo disso** — medido nos dois runs: 19s de passos de trabalho antes, 12s
> depois, com o **total do job praticamente igual** (33s → 32s), porque o job é dominado pelo setup
> (checkout + pnpm + node + install). O motivo da poda é atribuição de falha, não velocidade.

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
testes de lógica pura das rotas + harness de migrações + guard de `versao`**.

> 🔴 **Esta seção descrevia um estado que a sessão de nuvem não tem — corrigido em 2026-08-21.**
> O texto dizia que "o `@urbiverso/sdk` **já está** em `node_modules/@urbiverso/sdk`". Numa sessão
> nova o repositório é clonado do zero e **`node_modules/` não existe**, então o
> `validar-backend.sh` **aborta na etapa 1/5**, no portão do SDK. Backend, `schema.json` e migração
> **não têm typecheck aqui** — a validação deles é do autor, no ambiente autenticado, e o PR precisa
> **declarar isso** em vez de deixar implícito. "Não deu para rodar" nunca é "passou".
>
> Pior: **`npm view @urbiverso/sdk` dá o mesmo `E401`**. Não dá nem para perguntar ao registry o que
> está publicado — o que também derruba a camada de contratos da revisão (§ Processo obrigatório).
>
> O que **continua valendo** do texto original é a explicação de *por que ele funcionaria* com o
> `node_modules` no disco:

- o typecheck do backend só precisa dos **tipos** do SDK (`dist/index.d.ts`) — o que falha com 401 é
  baixar o pacote, não usá-lo depois de baixado;
- só `backend/rotas.ts` importa o SDK (`import '@urbiverso/sdk/express'`, augmentação de tipo);
  todo o resto do backend depende só do `express`, que é **público**;
- os testes de backend importam apenas as **funções puras** dos módulos de rota — não sobem
  servidor nem banco.

O harness (`scripts/migracoes-harness.mjs`) exercita cada migração contra um banco em memória:
contrato do módulo, instalação virgem, **reexecução** e a cadeia completa em ordem. O guard final
barra os dois erros simétricos de versionamento: migração nova **sem** bump da `versao`, e bump
**sem** migração nova.

> ⚠️ O `dist/index.d.ts` do SDK é a **fonte canônica para conferir props de primitivo `urbi-*`**
> antes de usar (`grep -n "declare class UrbiGraficoArea" -A 30`). Atributo ou elemento inexistente
> **não dá erro, só não faz nada** — leia antes de presumir.
>
> **Sem `node_modules` no disco, essa fonte não existe.** A alternativa é ler
> `ui/src/urbi-<nome>.ts` no monorepo (leitura é permitida — § O monorepo é só leitura), sabendo que
> ele está em `main` e **à frente** do SDK publicado. Conferiu por ali, **diga no PR** que a fonte
> foi o `main` e não o bundle: a prop pode existir lá e não na versão que a instância roda.

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
- `shell_min = "0.53.8"` — subiu de `0.50.3` em 2026-08-19 (issue #422). O piso existe para ser
  **honesto**, e a plataforma retirou a alternativa: o retorno declarativo de migração
  (`remover_colunas`) vira **gate** em 2026-08-23, e o fluxo canônico que o substitui exige
  `dados.limparColuna` (shell **0.53.5**) e `dados.varrerTudo` (shell **0.53.8**). Subir o piso
  **não** bumpa a `versao` — ela descreve o schema, e nada de schema mudou.
- Precisão: R$ e m² → `decimal(12,2)`; % digitado → inteiro; % calculado → `decimal(5,1)`
- **Todo valor monetário resultado de fórmula tem 2 casas decimais** — na apresentação, na entrada e
  no motor. Representações derivadas **não monetárias** (% e R$/m²) carregam **precisão plena**
  internamente e arredondam **só para exibir**; nunca são persistidas arredondadas. Decisão do autor
  em 2026-08-01; é o contrato que fecha a #259 e dá regra às #260 e #281.
  > ✅ **Resolvido em todo o app — a #449 fechou o que faltava (2026-08-24).**
  > `frontend/viab-format.ts:11-23` usa 2 casas com mínimo e máximo; o Orçamento de Custos em `rs`
  > também (`frontend/tela-fluxo-custos.ts:673,933`); `frontend/exportar.ts:16` importa `fmtR$` em
  > vez de definir formatador próprio; a tabela de sensibilidade da proforma usa `fmtR$(v, false)`
  > (`frontend/tela-proforma.ts:458`, #492). A #449 unificou a célula do Fluxo de Caixa: `celula`
  > (`frontend/fluxo-tabela.ts:40`) e `celulaFx` (`frontend/exportar.ts:171`, CSV/PDF) chamam a
  > mesma função (`celula` de `frontend/viab-format.ts`) — 2 casas, limiar de célula vazia
  > `< R$ 0,005`, mesma representação de negativo — e `_fmtContabil`
  > (`frontend/tela-proforma.ts:313`) e `precoUnit`/`precoTotal`
  > (`frontend/tela-fluxo-receitas.ts:416-417`) trocaram `fmtNum` sem 2º argumento por
  > `fmtR$(v, false)`. A #281 está fechada — a tabela de conformidade completa é
  > `docs/viabilidade/formulas.md` §"Estado de conformidade".
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

### A release nasce NÃO homologada — e é assim que tem que ser

Desde 2026-08-18 o `release.yml` publica com **`--prerelease`**. Para a plataforma,
"não homologado" ⟺ `prerelease=true`: é a **atestação na origem**, lida por todas as instâncias que
consomem o repo. O ciclo é:

| Passo | Onde | Quem |
|---|---|---|
| publica a release (`prerelease=true`) | Actions → release → Run workflow | workflow |
| instala e roda | **Pinguim** (`homolog.urbiverso.com.br`), `aceitacao = 'releases'` | auto-update, se ligado |
| testa de verdade, logado | Pinguim | autor |
| **Homologar** → flipa `prerelease=false` no GitHub | Admin → Apps → viabilidade → Geral | autor |
| instala a versão já atestada | **Laputa** (produção), `aceitacao = 'homologado'` (default) | auto-update / manual |

Até essa data o workflow chamava `gh release create` **sem** o flag, então toda release nascia
`prerelease=false` — ou seja, **atestada por ninguém**. Isso não dá erro em lugar nenhum: só
curto-circuita o ciclo, porque produção passa a enxergar na hora uma versão que nunca foi testada.

Dois detalhes que se aprende errado:

- **Prerelease não trava a primeira instalação.** Instalação de app **nova** é soberana, sem gate de
  aceitação — o gate só vale na *atualização*. Na tela de instalar, marque **"Incluir não
  homologadas"** (o checkbox nasce desligado) para a release aparecer.
- **O botão "Homologar" só existe com `aceitacao = 'releases'`.** Numa instância em `homologado` ele
  não aparece, e `POST /:appId/homologar` recusa com `422 ACEITACAO_NAO_ATESTA` — ela declarou
  consumir só o que outro já atestou. Configure a homolog em `releases` e deixe a produção em
  `homologado`.

---

## Sessões paralelas

Pode haver mais de uma sessão do Claude Code neste repo. Regras: **nunca duas sessões na mesma
branch**; `main` é só para puxar; cada árvore de trabalho tem seu próprio `pnpm install`.

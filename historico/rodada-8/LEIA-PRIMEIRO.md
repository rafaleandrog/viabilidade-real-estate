# Rodada 8 — LEIA PRIMEIRO

> Ponto de partida para uma sessão nova. **Leia só este arquivo antes de agir.** Os outros 11
> documentos desta pasta somam ~9.000 linhas — abra apenas o que a sua tarefa exigir, e apenas
> a seção indicada. Escrito em 2026-08-22, ao fim da Rodada 8.

---

## Onde a Rodada 8 parou

✅ **As 59 issues já existem no GitHub: `#426`–`#484`.** Foram criadas pela API, estão vivas, com
labels (`rodada-8` + `prioridade-1|2|3` + área). **Não é preciso `git pull` nem `push` para vê-las**
— issue não é arquivo; ela mora no banco do GitHub. Abra
`https://github.com/rafaleandrog/viabilidade-real-estate/issues`.

✅ **As 15 decisões do autor estão gravadas** em `24-perguntas-multipla-escolha.md`
§ *Respostas do autor* — e já aplicadas ao corpo das issues. **Leia-as antes de implementar
qualquer coisa**: três delas reformularam o problema em vez de escolher entre as opções, e é a
reformulação que vale.

✅ **A fonte de verdade das issues é `25-issues-final.md`.** Cada bloco tem `numero:` com a issue
correspondente. Para editar uma issue, edite o bloco e rode:

    node scripts/criar-issues-rodada-8.mjs                # ensaio, não toca em nada
    node scripts/criar-issues-rodada-8.mjs --sincronizar  # empurra título, corpo e labels

## A tarefa que vem a seguir

**Implementar as issues, uma por vez, com PR e revisão.** Não há mais consolidação a fazer.

Ordem sugerida: as **15 de `prioridade-1`** primeiro, e dentro delas as que têm dinheiro medido —
`#426` (proforma somando o principal do funding), `#428` (campo de juros de tabela, 5,41% do VGV),
`#431` (modais que reescrevem o plano), `#429` (descarte silencioso de vendas).

**Regra da casa, não opcional:** branch → PR → revisão pela skill `revisar-pr-apps` → conserto →
nova rodada de revisão → parar. **Merge é decisão do autor.**

### Ligar o Codex na revisão

> ✅ **CORRIGIDO em 2026-08-23 — o Codex já está ligado, e o texto abaixo dizia o contrário.**
> Esta seção afirmava que faltava *"uma coisa só"* (a `OPENAI_API_KEY`) e que sem ela a revisão cai
> para o motor nativo. **O caminho que funciona é outro, e não precisa de chave nenhuma:** o
> **GitHub App do Codex** está instalado neste repositório e revisa quando se comenta
> **`@codex review`** no PR — exercitado em rodadas sucessivas no PR 494, ~2 min cada, com achados
> P1 e P2 reais. **Comente `@codex review` — é o caminho normal.**
>
> A `OPENAI_API_KEY` continua sendo o que falta para o **CLI local** (`codex exec`), que é um
> caminho diferente — e neste *cloud environment* falta também liberar `api.openai.com` na política
> de rede, que hoje devolve **403 no CONNECT**. Nada disso bloqueia o App, que roda fora daqui.
> Detalhe em `.claude/motor-revisao.md` § *Sequência obrigatória do App*.

O motor de revisão está montado em `.claude/motor-revisao.md`, em **duas camadas que somam**: a
**revisão do App** (`@codex review`, sempre) e a **fan-out das lentes** (sempre). O condicional é o
motor *dentro* da fan-out — **CLI local** (`codex exec`) se houver chave e rede, **nativo** se não
houver, **declarado** como menos adversarial. O App **não dispensa** a fan-out.

> ⚠️ **A chave é por ambiente.** Numa sessão web, ela vai nas variáveis do *cloud environment*;
> numa sessão local, no ambiente da máquina. Definir num lado não vale para o outro.

⚠️ **A camada de contratos não roda em ambiente nenhum**, com Codex ou sem: ela lê
`node_modules/@urbiverso/sdk/docs/`, e o SDK é **stub** nos dois lugares. Toda revisão vai trazer
`contratos=nao-executados`. Props de primitivo `urbi-*` e aderência do `shell_min` ao publicado
seguem **sem verificação automática** — quem revisa cobra à mão.

---

## Decisões do autor — vinculantes, não rediscutir

| # | Decisão | Consequência |
|---|---|---|
| 1 | **Nenhum bug é consertado nesta rodada. Tudo vira issue.** O autor autorizou o conserto e depois reverteu | Os 3 consertos **foram revertidos**; a árvore está idêntica à `main`. `09-consertos.md` virou corpo de issue |
| 2 | **Capital de giro: só o rótulo.** `divida` **já é** o produto de CG por calendário | O desenho `linha_credito` rotativo do A3 foi **RECUSADO**. Sem migração `030`, sem bump para 0.1.29 |
| 3 | **Base de receita líquida do equity NÃO muda.** *"equity é um retorno líquido ao investidor, não importa esse fator para o cálculo"* | `funding-motor.ts:58-67` fica como está. A divergência com as duas planilhas é **intencional** → nota, não issue |
| 4 | ~~**Erros visuais sem navegador** — API + leitura de código~~ · 🔄 **REVOGADA em 2026-08-23** | A decisão descrevia a máquina Windows do autor. **Na sessão de nuvem há navegador**: Chromium e Playwright instalados (`/opt/pw-browsers/chromium`), e `scripts/render-check-cronograma.mjs` (#245) já os usa — medido, passa na `main` e sai com código 1 sob regressão injetada. O autor autorizou o caminho. **Verificação visual passa a ser render automatizado**, não print. Ver `PROGRESSO.md` (2026-08-23) |

---

## Fatos de ambiente que custam tempo se você os redescobrir

- ⚠️ **Estes fatos dependem da MÁQUINA. Confira antes de agir — corrigido em 2026-08-23.** O texto
  abaixo descrevia a máquina Windows do autor e mandava contornar os validadores. **Na sessão de
  nuvem é diferente**, e seguir o contorno é trabalhar às cegas.

  | | Máquina do autor (Windows) | **Sessão de nuvem, medido 2026-08-23** |
  |---|---|---|
  | `pnpm` | não existe | **existe** (`/opt/node22/bin/pnpm`) |
  | `scripts/validar-frontend.sh` | aborta cedo | **roda inteiro e passa** |
  | testes de frontend | 411 | **408** |
  | testes de backend | 104 | **101** |
  | navegador | nenhum | **Chromium + Playwright** (`/opt/pw-browsers/`) |

  **Na nuvem, use os scripts** — não o contorno:
  ```
  pnpm install                       # o 401 do @urbiverso/sdk é esperado e ignorado
  bash scripts/validar-frontend.sh   # typecheck + 408 testes + build
  ```
  Para o **backend**, chame `bash scripts/validar-backend.sh` **primeiro**, mesmo sabendo que ele
  aborta na etapa 1/5 no portão do SDK: as etapas 0 e 1 rodam antes e **linkam o `express`**. Só
  depois:
  ```
  node --import tsx/esm --test --test-timeout=60000 backend/rotas/*.test.ts backend/*.test.ts
  ```
  Sem esse passo, os 5 arquivos de `backend/rotas/` falham com `ERR_MODULE_NOT_FOUND: Cannot find
  package 'express'` — que **não é teste quebrado**, é a cascata do 401. Não confunda os dois.

  **O contorno manual abaixo continua válido onde `pnpm` de fato não existe:**
  ```
  echo '{ "extends": "./tsconfig.json", "include": ["frontend/**/*"] }' > tsconfig.fe.json
  node node_modules/typescript/bin/tsc --noEmit -p tsconfig.fe.json ; rm -f tsconfig.fe.json
  node --import tsx/esm --test --test-timeout=60000 frontend/*.test.ts
  node --import tsx/esm --test --test-timeout=60000 backend/rotas/*.test.ts backend/*.test.ts
  ```
- **O `@urbiverso/sdk` em `node_modules` é STUB** (só `express.d.ts`/`express.js`). Não há
  `dist/index.d.ts` nem `docs/`. Props de primitivo se conferem em
  `C:\Users\raafa\urbiverso\ui\src\urbi-*.ts` — **que é SÓ LEITURA** —, declarando no relatório que
  a fonte foi o `main` e não o bundle publicado.
- **O `gh` EXISTE** (`/c/Program Files/GitHub CLI`) mas **não está autenticado**. `git push` **não**
  resolve — são caminhos de auth diferentes. O autor precisa rodar `gh auth login`.
- **`/tmp` do Git Bash não é visível ao `node` do Windows.** Passe JSON por stdin ou use caminho
  absoluto.
- **Ler `.xlsx` sem openpyxl:** `unzip -p arq.xlsx xl/worksheets/sheet1.xml` + parser em `node -e`.
  A **fórmula** está em `<f>`, o valor em `<v>`. Receita completa no `00-dossie.md` §3.

## Instância viva

**Pinguim** — `https://homolog.urbiverso.com.br`, rodando `viabilidade@0.1.28` (mesma versão da
`main`). 6 estudos legíveis: **5 e 6 são Avançados**, 1–4 Preliminares. O token é do autor e **não
está em arquivo nenhum deste repositório** — peça a ele. Ele **não** é somente-leitura, então a
postura de só emitir `GET` é disciplina, não trava.

`scripts/conferir-estudo.ts` puxa os inputs e recalcula localmente. **O backend do app não calcula
nada** — todas as rotas devolvem inputs; fluxo, proforma e funding são calculados no navegador e
nada derivado é persistido. Não existe `GET` de resultado.

---

## O que NÃO refazer — já está apurado, com `arquivo:linha`

- **A lista de 47 itens está inteiramente auditada**, pelo corpo do pedido e não pelo título:
  **36 confirmados · 8 com a correção anterior reprovada (2, 11, 15, 17, 22, 24, 31, 41) · 3 dependem
  de print (38, 43, 45)**. Detalhe em `01-verificacao-47-itens.md` e `08-auditoria-39-itens.md`.
  > 🔴 **Corrigido em 2026-08-23 — a redação anterior custou seis issues.** Esta linha dizia
  > *"8 **não se sustentam**"*, que se lê como *"o bug relatado não existe"*. **Não é o que os
  > vereditos individuais dizem.** Do que aquele balde de 8 continha:
  > `:137` item 11 → "NÃO SE SUSTENTA **(parcial)**" · `:199` item 17 → título "NÃO SE SUSTENTA" com
  > corpo que prova o **oposto** (o bug é real; o que não se sustenta é **a correção da #326**) ·
  > `:254` item 24 → "🟡 **PARCIAL — reaberto**" · `:405` item 22 → "🟡 PARCIAL" · `:435` item 31 →
  > "🟡 PARCIAL". **Nenhum é "o bug não existe".**
  >
  > A consequência foi concreta: o **Bloco 8-A inteiro** — seis issues com corpo pronto em
  > `07-consolidado-issues.md` — ficou de fora de `25-issues-final.md`, que é o arquivo que alimenta
  > `scripts/criar-issues-rodada-8.mjs`, e **nenhuma das seis chegou ao GitHub**. Entre elas a do
  > `urbi-kpi`, que o autor já havia reportado em #176, #262, #326 e #352. Recuperadas em 2026-08-23
  > como **#488–#493** — ver o apêndice de `25-issues-final.md`.
  > **Lição de método da rodada:** o título da planilha **diverge do pedido com frequência**.
  > Quatro itens teriam recebido veredito oposto se lidos pelo título (14, 18, 32, 43). E a lição
  > desta correção: **um resumo que colapsa "a correção falhou" em "o pedido não procede" apaga
  > trabalho** — e apaga calado, porque ninguém confere um balde contra os vereditos que ele resume.
- **Zero problemas de prop `urbi-*`** — 391 tags, 29 primitivos, ~1.100 atributos varridos
  (`06-auditoria-ui.md`).
- **O motor de recebíveis por safras ESTÁ ligado ao `calcularFluxo`** desde a #283, e
  `fluxo-pagamento-editor.ts:90` grava `componentes` em **toda** escrita. Quatro lugares do repo
  ainda afirmam o contrário e **mentem** — os textos substitutos estão em
  `04-regras-reconciliacao.md` §6.1. **17 mentiras documentais** confirmadas ao todo.
- **`jurosClientes` NÃO é sempre 0.** O estudo 5 de Pinguim tem `taxaMensal: 0.0098636`
  (= 12,5% a.a., a taxa exata da EVI) e produz R$ 1.259.273,59. O estudo 6 tem 0 porque **passou
  pelo modal**. A formulação certa é: **os juros existem e viram zero no primeiro "Aplicar"**.

---

## Os três achados de maior consequência

1. **A proforma do Avançado soma o principal do funding ao custo** e nunca credita as entradas
   (`frontend/proforma-avancado.ts:92-93`). Estudo 5 exibe margem **−47,87%** onde o real é
   **18,94%**. O mesmo estudo mostra **4 margens e 3 resultados** em superfícies diferentes.
2. **Abrir o modal de pagamento reescreve o plano** — apaga R$ 1.259.273,59 de juros e troca
   `0/30/70` por `15/30/55`, sem aviso e sem undo. Corolário do A3: encolhe o retorno do
   investidor em ≈ R$ 50.371.
3. **R$ 8,98 MM — 5,41% do VGV da EVI é juros de tabela**, e o app reporta zero em qualquer estudo
   que tenha passado pelo modal. Falta **só um campo no modal**; `fluxo_pagamento` é coluna `json`,
   **sem migração**.

E o achado estrutural, que junta dois sintomas numa issue só: **`R-A313`** — a sequência dos
Passos 23–25 é remontada em **5 arquivos independentes**; falta um `estadoFinanceiroDoEstudo` como
fonte única. É a causa comum das 4 margens **e** do cash sweep cego às outras operações.

---

## Pendências do autor

- `gh auth login` — único bloqueio para as issues saírem do arquivo.
- Responder ~30 perguntas agrupadas nos documentos (as de A4 em §4, as de A2 em §4, as de A3 em §5).
- **Uma pergunta em aberto que muda o escopo de metade das issues:** a taxa de 12,5% do estudo 5 e a
  curva personalizada de 43 meses do estudo 6 **foram escritas por algo que não é a interface** — a
  tela não sabe gravar nenhuma das duas. Se existe caminho de escrita paralelo, "campo de taxa"
  deixa de ser feature nova e vira **a UI alcançando um modelo já em uso**.
- Aplicar os textos substitutos de `04-regras-reconciliacao.md` §6.1–§6.6 (inclui a seção do
  `CLAUDE.md` declarando a Rodada 8 aberta, em §6.5).
- Commit, push e PR — a branch `claude/rodada-8-auditoria` está **sem commit**, e o único conteúdo
  novo é `docs/rodada-8/` + `scripts/conferir-estudo.ts`. **Nenhum código foi alterado.**

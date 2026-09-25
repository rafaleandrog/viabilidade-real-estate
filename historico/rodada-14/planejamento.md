# Rodada 14 — Plano: reorganizar a documentação do app `viabilidade` como as apps do UrbiVerso

> Plano aprovado pelo autor em modo de planejamento (2026-09-25), a partir da captura da página
> Documentação da instância. Fotografia datada: descreve o estado ANTES da PR 1 e a fila prevista;
> o estado corrente de cada PR está no `PROGRESSO.md` e na tabela de rodadas do `CLAUDE.md`.

## Contexto

A página **Documentação** da instância (captura do usuário) mostra 6 itens — "Inventario legado
avancado 2026 08 01", "Triagem issues 2026 08 03" etc. — todos notas de trabalho datadas. Os 12
guias reais do app não aparecem. Causa, medida no shell:

- O shell lista **só os `.md` no topo** de `apps/<appId>/docs/`; subpasta é ignorada com aviso
  (`urbiverso/shell/backend/src/rotas/docs.ts:92-97`). Título sem frontmatter = nome do arquivo
  com hífen→espaço (`:107`). `README.md` fica sempre primeiro, com o **nome do app** como título;
  o resto ordena **alfabeticamente por `titulo`**; `ordem` é lido e **ignorado** (`:115-119`).
- Neste repo os guias vivem em **`docs/viabilidade/`** (invisíveis) e o topo de `docs/` tem só as
  notas datadas. Não existe `docs/README.md`.
- O empacotador copia **`docs/` inteiro, recursivo** (`urbiverso/scripts/lib/empacotar-core.js:30,126-131`,
  o mesmo core do `urbi-empacotar`): o tarball leva 48 arquivos / 2,2 MB, incluindo `rodada-8/`
  (18 dossiês), `spec/`, e os JSON de `docs/ui-urbiverso/`, para toda instância.
- Mesmo os guias "certos" estão em estilo de diário de desenvolvimento: números de issue, rodadas,
  correções "⚠️ esta linha já dizia…", endereços `arquivo:linha`, seções "evolução dependente de
  issue". O framework (`docs/shell/documentacao.md`, servido no bundle do SDK) manda: só feature
  implementada; um doc por macro-feature; seções progressivas usuário → admin → não humanos; sem
  `ordem`; termo identificador primeiro no `titulo`; ideias em `ideias.md` na raiz; nada além de
  `.md` em `docs/`. O modelo vivo é `apps/fabrica/docs/` (README + 4 docs por tema, ~200 linhas
  cada, `## O que é` → conceitos → `## Para usuários` → `## Instruções para não humanos` →
  `## Veja também`, zero issues/datas).

Resultado esperado: a página Documentação abre em "Estudo de Viabilidade" (visão geral) e lista
~12 guias por tema, legíveis por analista/admin/agente; o tarball leva só esses `.md`; o material
consultivo e o histórico continuam no repositório, fora do que é servido.

## Layout-alvo do repositório

```
docs/            ← SERVIDO na instância. Só .md no topo, sem subpasta, sem JSON.
  README.md            visão geral (hoje docs/viabilidade/visao-geral.md)
  preliminar.md        NOVO — estudo Preliminar: Premissas, Proforma, Cenários, Gráficos, Apelo
  avancado.md          NOVO — estudo Avançado: Resumo, Empreendimento, Custos, Viabilidade
                       (Financeiro/Funding), Resultados, Cenários, Análise de mercado
  formulas.md          Fórmulas da Proforma (existe)
  funding.md           operações de Funding (hoje fluxo-investidor-formulas.md + §4.3 do ADR)
  benchmarks.md        (existe)
  analise-mercado.md   (existe)
  apelo-comercial.md   (existe; título vira "Apelo Comercial (IA)" — hoje colide com o de cima)
  exportacao.md        (existe)
  permissoes.md        (existe)
  administracao.md     NOVO — 7 parâmetros do manifesto, telas de config (Benchmarks, Curvas de
                       distribuição, Regiões monitoradas), rotina "Coleta diária de mercado",
                       permissão do Núcleo (imoveis/parcelamentos), manutenção/varredura
  modelo-de-dados.md   (existe) + seção "Instruções para não humanos" com a API
referencia/      ← consultivo, NÃO servido, NÃO empacotado (fica fora de docs/ e migracoes/)
  padrao-incorporacao.md · inteligencia-evi-incorporacao.md · funding-capital-stack.md (ADR)
  ui-urbiverso/        espelho gerado (LEIA.md, primitivos.json, tokens.json)
historico/       ← notas datadas: rodada-8/…rodada-13/, spec/, *-2026-*.md, triagem, inventário
ideias.md        ← raiz, formato do framework (Braindump/Aprovadas/Descartadas), recebe as
                   "evoluções previstas" sem issue que hoje moram dentro dos guias
```

Decisões tomadas (o autor pode reverter na revisão):
- **Mover para fora de `docs/`, e não para subpasta de `docs/`**: subpasta é ignorada pela tela
  mas **viaja no tarball**; o framework proíbe subpasta e arquivo não-`.md` ali.
- **`padrao-incorporacao` e `inteligencia-evi` saem do que é servido**: são conhecimento de
  negócio consultivo (CLAUDE.md: "não descreve o app", "não governa o runtime"), 3.464 e 2.330
  linhas. O que neles é de fato doc do app instalado (Anexo B dicionário de campos, Anexo E API)
  migra, resumido, para `modelo-de-dados.md`/`avancado.md` nos PRs de conteúdo.
- **Nomes `referencia/` e `historico/`** na raiz. Nenhum deles vira "app" para o pnpm (o
  `pnpm-workspace.yaml` não declara packages).

## Fila de PRs — estritamente serial, uma por assunto (R3), processo do CLAUDE.md em cada uma
(branch de `origin/main` + `--unset-upstream` → `validar-frontend.sh` → commit → push com nome →
corpo em arquivo + `preflight-pr.mjs --titulo` → PR via MCP → `revisar-pr-apps` → parar; merge é
do autor). Toda PR prepende sua seção no `PROGRESSO.md` e nenhuma toca `schema.json`/`versao`.

### PR 1 — Estrutura: `docs/` passa a conter só a documentação servida
Só movimentação + ajustes mecânicos, **sem reescrever conteúdo**.
1. `git mv docs/viabilidade/visao-geral.md docs/README.md`; `git mv` dos outros 8 guias para
   `docs/` (`fluxo-investidor-formulas.md` → `docs/funding.md`); `git rm docs/viabilidade/.gitkeep`.
2. `git mv` de `padrao-incorporacao.md`, `inteligencia-evi-incorporacao.md`,
   `funding-capital-stack.md` → `referencia/`.
3. `git mv` de `docs/rodada-*`, `docs/spec`, e dos 7 `.md` datados do topo → `historico/`.
4. Frontmatter dos 12 servidos: manter só `titulo` + `descricao` (remover `tipo: app` e `ordem`),
   manter o comentário "Siga o framework…". Títulos com termo identificador primeiro
   ("Visão geral" no README é irrelevante — o shell mostra o nome do app; "Análise de Mercado do
   Imóvel (IA)" → "Apelo Comercial (IA)"; "Fluxo do Investidor — fórmulas…" → "Funding").
5. Links internos `[x](slug)`: `visao-geral` → `readme`; `fluxo-investidor-formulas` → `funding`;
   links para `padrao-incorporacao`/`inteligencia-evi-incorporacao`/`funding-capital-stack`
   deixam de resolver na tela (o visualizador só abre slug listado) → trocar por menção em prosa
   ("referência interna `referencia/padrao-incorporacao.md`"). Sem `.md` nos links, como a fabrica.
6. Ferramentas que citam caminho (todas conferidas — lista fechada):
   - `scripts/guard-enderecos-doc.mjs:93` `RAIZES` → `['docs/', 'referencia/', 'frontend/', 'backend/']`
     (o comentário `:44-47` sobre "resto de `docs/`" passa a falar de `historico/`).
   - `scripts/enderecos-doc-excecoes.mjs`: 17 entradas com `arquivo: "docs/viabilidade/…"` →
     novos caminhos (exceção que não casa mais **reprova**, `guard-enderecos-doc.mjs:460-493`).
   - `scripts/testar-guard-enderecos-doc.sh`: fixtures `docs/viabilidade/nota.md` → `docs/nota.md`,
     `docs/rodada-8/` → `historico/rodada-8/` (caso "histórico não é varrido").
   - `scripts/guard-tabelas-obsoletas.mjs:93` `PERMITIDOS_PREFIXO` += `'historico/'`, `'referencia/'`
     (9 arquivos de rodada-8 e `modelo-de-dados.md` citam `avancado_capital_instrumentos`);
     acrescentar caso em `scripts/testar-guard-tabelas-obsoletas.sh`.
   - Comentários de código com endereço para doc (o guard confere que o arquivo existe):
     `frontend/tela-resumo.ts:196`, `funding-motor.ts:916,941`, `funding-motor.test.ts:548`,
     `tela-fluxo-ver.ts:440`, `tela-cenarios.ts:284`, `tela-funding.ts:277`, `fluxo-shared.ts:660`,
     `tela-dashboard.ts:32` → `referencia/...`; `docs/formulas.md:253` cita
     `docs/rodada-8/04-regras-reconciliacao.md:1512` → `historico/rodada-8/...`.
   - Menções em prosa: `scripts/guard-schema-ciclos.mjs:113`, `scripts/criar-issues-rodada-8.mjs:38`,
     `README.md:45-49,104-106`, `INSTRUCOES-CODE.md:157`, e as ~24 citações do `CLAUDE.md`
     (`docs/viabilidade/...`, `docs/rodada-*/...`) → caminhos novos. `PROGRESSO.md` é histórico:
     não reescrever.
   - **Não** tocar `.claude/**` aqui (R1): a linha `.claude/skills/revisar-pr-apps/SKILL.md:492`
     ("mudança de comportamento → `docs/viabilidade/*.md`") vai na PR 3.
7. `CLAUDE.md`: seção nova curta "Documentação da app" com o layout acima e a régua de estilo
   (o que entra em `docs/`, o que vai para `referencia/`/`historico/`/`ideias.md`/issue), e
   atualizar "Fontes de verdade". `CLAUDE.md` não é arquivo de processo para o guard de escopo
   (`guard-pr-escopo-processo.mjs:58-84`), então pode viajar com a PR 1.

### PR 2 — Espelho de UI sai de `docs/`: `docs/ui-urbiverso/` → `referencia/ui-urbiverso/`
Caminho fixo em: `scripts/sincronizar-referencia-ui.mjs:43,350`, `guard-tokens-css.mjs:41`,
`guard-props-urbi.mjs:52`, `guard-box-model-urbi.mjs:56`, `render-check.mjs:80-81,275,298,424,1231`,
`render-em-escopo.mjs:36,69`, `testar-guards-ui.sh:73,77,97,203,206`,
`frontend/fluxo-economico-series.test.ts:111-112`, `validar-frontend.sh:24,118`,
`.github/workflows/pr-guards.yml:497-500` (nome do passo/comentário). Depois: `node
scripts/sincronizar-referencia-ui.mjs` não deve mudar nada além do caminho.

### PR 3 — Processo (só `.claude/`): a skill de revisão passa a exigir doc em `docs/*.md`
Uma linha em `.claude/skills/revisar-pr-apps/SKILL.md:492` (+ `carimbar-corpus-revisao.mjs` se
tocar `.claude/revisao/`). PR de processo puro, separado por R1.

### PRs 4–9 — Conteúdo, um doc (ou par coeso) por PR, no estilo da `fabrica`
Régua comum, aplicada em cada um: H1 + resumo de uma linha em `>`; `## O que é` →
conceitos → `## Para usuários` (passos, rótulos de tela em **negrito**, papéis em crase) →
`## Para administradores` quando couber → `## Instruções para não humanos` (rotas de
`backend/rotas/*.ts`, payloads, códigos de erro) → `## Veja também`. Presente do indicativo,
só comportamento vigente. **Sai**: número de issue/rodada, data, "⚠️ esta linha já dizia",
endereço `arquivo:linha` (evidência fica em `referencia/`/`PROGRESSO.md`), "evolução
prevista"/"dependente de issue" (vai para a issue, ou para `ideias.md` se não houver).
`descricao` do frontmatter informativa: ela alimenta o subtítulo da barra lateral e o índice do
assistente de docs (`docs.ts:263-267`).

4. **`README.md`** — reescrita da visão geral: o que é, Preliminar × Avançado, Loteamento ×
   Incorporação, origem do terreno (Núcleo × manual), ciclo de vida, mapa dos guias. Cria
   `ideias.md` na raiz com o que sobrar sem issue.
5. **`preliminar.md`** (novo) e **`avancado.md`** (novo) — tela a tela, a partir de
   `frontend/tela-*.ts` e das seções 4–20 de `referencia/padrao-incorporacao.md` (só o rotulado
   "Comportamento vigente"). Pode ser 2 PRs se o `avancado.md` passar de ~250 linhas.
6. **`funding.md`** — reescrita de `fluxo-investidor-formulas.md` + §4.3 (Financiamento à
   produção) do ADR: as 3 operações, campos, fórmulas, indicadores do investidor, como entram
   em Resultados; sem a §9 de rastreabilidade (vai para `referencia/`).
7. **`administracao.md`** (novo) — parâmetros (`manifesto.json` `parametros`, defaults vivos),
   `telas_config` (Benchmarks, Curvas, Regiões monitoradas), `rotinas.coleta_mercado_diaria` e
   `mercado_busca_url`/`mercado_busca_chave`, permissão do Núcleo, `backend/rotas/manutencao.ts`
   e `varrer-tudo.ts`, eventos do manifesto.
8. **`formulas.md`** e **`modelo-de-dados.md`** — limpeza pela régua; `modelo-de-dados` perde as
   seções "evolução prevista"/"cancelada" (vão para `referencia/` como ADR) e ganha a API.
9. **`analise-mercado.md`, `apelo-comercial.md`, `exportacao.md`, `permissoes.md`,
   `benchmarks.md`** — limpeza pela régua (um PR: "limpeza de estilo dos guias curtos").

## Verificação

- Por PR: `bash scripts/validar-frontend.sh` (inclui `guard-enderecos-doc`, guards de UI, render)
  e `bash scripts/testar-guard-enderecos-doc.sh`; PR 1 também
  `bash scripts/testar-guard-tabelas-obsoletas.sh`; PR 2 também `bash scripts/testar-guards-ui.sh`.
- **Prova do tarball** (PR 1 e PR 2): `pnpm build && pnpm exec urbi-empacotar viabilidade --dir .
  --saida ./dist` e `tar -tzf dist/*.tgz | grep '^docs/'` deve listar **só** os `.md` do topo de
  `docs/` — nada de `rodada-8/`, `spec/`, JSON.
- **Prova da tela**: simular o índice do shell — `ls docs/*.md`, frontmatter com `titulo` e
  `descricao`, sem subpasta; conferir que todo `[x](slug)` nos servidos aponta para um arquivo
  `docs/<slug>.md` existente (grep simples; hoje ninguém confere isso).
- Depois do merge, o autor instala a release na Pinguim e abre `/viabilidade/docs`: README com o
  nome do app primeiro, guias por tema em ordem alfabética, assistente de docs respondendo pelos
  guias novos.

## Anexo — texto proposto para o `CLAUDE.md` (não aplicado pela PR 1)

A PR 1 só atualizou caminhos no `CLAUDE.md`. Ficam para o autor: (1) a linha da Rodada 14 na
tabela "Estado do backlog" (escopo: este plano; issues: nenhuma, pedido direto com captura de
tela; estado: em andamento, PR 1 aberta em 2026-09-25), com o título da seção passando a
"RODADAS 13 E 14 EM ANDAMENTO"; (2) um bullet em "Fontes de verdade" apontando `docs/*.md` como a
documentação servida; (3) a seção abaixo, antes de "## Versão do manifesto e release".

### Documentação da app

A página **Documentação** da instância lista **só os `.md` do topo de `docs/`** (subpasta é ignorada
com aviso; `README.md` vem primeiro com o nome do app como título; o resto ordena alfabeticamente
por `titulo`, e `ordem` no frontmatter é ignorado). O empacotador copia `docs/` **inteiro** para o
tarball — subpasta e JSON viajam para toda instância mesmo sem aparecer. Daí o layout, fixado na
Rodada 14:

| Pasta | O que é | Servido? | Empacotado? |
|---|---|---|---|
| `docs/` | os guias do app, **só `.md` no topo**, um por macro-feature, `README.md` = visão geral | sim | sim |
| `referencia/` | conhecimento de negócio consultivo (`padrao-incorporacao`, `inteligencia-evi-incorporacao`), ADRs (`funding-capital-stack`) e o espelho de UI | não | não |
| `historico/` | notas datadas: rodadas, auditorias, triagens, a spec original | não | não |
| `ideias.md` (raiz) | braindump no formato do framework (Braindump / Aprovadas / Descartadas) | não | não |

Régua de um guia em `docs/` — a mesma do framework (`documentacao.md` no bundle do SDK) e de
`apps/fabrica/docs/` no monorepo, o modelo vivo: frontmatter só com `titulo` e `descricao` (a
`descricao` vira o subtítulo da barra lateral e alimenta o assistente de docs), termo
identificador **primeiro** no `titulo` (a ordem é alfabética), H1 + resumo de uma linha em `>`,
seções progressivas `## O que é` → conceitos → `## Para usuários` → `## Para administradores` →
`## Instruções para não humanos` → `## Veja também`; links entre guias como `[texto](slug)`, sem
`.md`, e só para slug que exista em `docs/`. **Não entra**: número de issue ou rodada, data,
correção de linha anterior ("esta linha já dizia…"), endereço `arquivo:linha` (evidência mora em
`referencia/` e no `PROGRESSO.md`), "evolução prevista" (vai para a issue, ou para `ideias.md`).
Mudança de comportamento do app atualiza o guia correspondente em `docs/` **no mesmo PR**.

Ferramentas que leem esses caminhos, para não redescobrir: `scripts/guard-enderecos-doc.mjs`
varre `docs/` e `referencia/` (e não `historico/`, que é fotografia datada e deve envelhecer);
`scripts/guard-tabelas-obsoletas.mjs` admite menção histórica nas três pastas.

# Avaliação do onboarding novo (`kit-apps`) — 2026-09-17

O autor recebeu três arquivos atualizados do time urbiverso — `primeiro-app.md`, `KIT.md` e
`instancia-no-ar.md` — e pediu para avaliar se algo mudou no nosso setup e garantir que o kit
está instalado. Este documento registra a avaliação e o que foi feito.

## O achado central: dois layouts oficiais, e somos o outro

Os três arquivos recebidos descrevem o onboarding do layout **"repo de solução"** — vários apps
sob `apps/<appId>/`, provisionado por `npx @urbiverso/kit-apps` — documentado no monorepo e
publicado como pacote npm (`@urbiverso/kit-apps`, hoje `71.2.2`).

Este repositório segue o **outro** layout oficial, **"app em repositório próprio"**: a app na
raiz (`manifesto.json`, `schema.json`, `backend/`, `frontend/` no topo), documentado em
`node_modules/@urbiverso/sdk/docs/apps-em-repo-proprio.md` (SDK `57.0.0`, o que temos instalado).
Os dois são trilhas independentes e igualmente suportadas pela plataforma — a diferença é onde o
código mora, não o que a instância aceita instalar (ela só conhece o tarball `.urbiapp.tgz`).

**Por isso `npx @urbiverso/kit-apps` não deve rodar direto neste repositório.** Testei em uma
árvore descartável (fora deste repo) para conferir o que o comando realmente escreve. Num
repositório novo ele:

- cria `apps/ola_mundo/` (app de exemplo) — porque não encontra pasta `apps/` e presume repo
  vazio;
- cria `CLAUDE.md`, `AGENTS.md`, `package.json`, `pnpm-workspace.yaml`, `.npmrc`,
  `.github/workflows/release.yml`, `.claude/settings.json`, `.claude/preparar-sessao.sh` — mas só
  quando o arquivo **não existe**; havendo um arquivo com esse nome, ele registra "DIVERGENTES" e
  **não toca**;
- **sobrescreve incondicionalmente** `.claude/skills/{especificar,implementar,instancia-urbiverso,qa,revisar-pr-apps}/`
  e o `KIT.md` — essas seis peças são as únicas que o kit se considera dono, e ele as reescreve a
  cada atualização, exista o quê existir.

No nosso repositório, quase tudo cairia no caminho seguro (`CLAUDE.md`, `package.json`,
`pnpm-workspace.yaml`, `.npmrc`, `.github/workflows/release.yml`, `.claude/settings.json`,
`.claude/preparar-sessao.sh` já existem — ficariam "DIVERGENTES", sem alteração). Mas dois efeitos
seriam ruins de verdade:

1. **`apps/ola_mundo/` seria semeado** mesmo — a detecção de "repo vazio" olha só se `apps/`
   existe, e a nossa app não mora lá. Ficaríamos com um app de exemplo desencontrado do layout
   real, ao lado do `manifesto.json`/`schema.json`/`backend/`/`frontend/` da raiz.
2. **`.claude/skills/revisar-pr-apps/` seria substituído por inteiro**, sem opção — é uma das seis
   peças que o kit sempre reescreve. A versão daqui tem customizações documentadas e vivas neste
   `CLAUDE.md` (§ "A revisão em si"): a inversão da regra de bump de `versao` quando o PR mexe em
   `shell_min`/`sdk_min` (issue #422 — aqui é o oposto do upstream) e a superfície de leitura
   correta para app-em-repo-próprio (bundle do SDK publicado, nunca `docs/shell/` do monorepo). A
   versão genérica do kit não necessariamente acerta as duas para este layout, e perderíamos as
   correções sem aviso — exatamente o modo de falha que o próprio `CLAUDE.md` já descreve para
   quando o catálogo serve a skill errada.

Portanto: **o kit não foi instalado como pacote.** O que fizemos foi avaliar cada peça dele e
adotar, seletivamente, o que é novo e não conflita.

## O que foi adotado

Duas skills novas, copiadas da árvore descartável para `.claude/skills/` — as duas **estão** na
lista de seis que o kit reescreve sozinho (ver acima), então um `npx @urbiverso/kit-apps` real
neste repositório voltaria a sobrescrevê-las sem pedir. O que as torna seguras de copiar não é
estarem fora dessa lista — é serem **agnósticas a onde o código do app mora**, porque operam
contra a **instância**, não contra o repositório, ao contrário de `especificar`/`implementar`/
`revisar-pr-apps`, que assumem o layout `apps/<appId>/`. Se o kit for atualizado de novo no
futuro, `instancia-urbiverso` e `qa` precisam ser reconferidas e recopiadas à mão, como
`revisar-pr-apps` já é — nenhuma das três sincroniza sozinha:

- **`instancia-urbiverso`** — Claude configura uma identidade própria na instância
  (`Claude - sob <nome da pessoa>`, um usuário de serviço com token e alçadas escolhidas por quem
  administra) e passa a agir na API dela com autorização por escrita: instalar/atualizar app,
  homologar release, criar pessoa, dar permissão, cadastrar domínio de e-mail, ler o que está
  instalado. É o que fecha várias das pendências que este `CLAUDE.md` listava como "do autor, no
  ambiente autenticado" (Rodada 7): confirmação de versão publicada, homologação, instalação.
  Contrato de ambiente: `URBIVERSO_URL` e `URBIVERSO_TOKEN`.
- **`qa`** — exercita a API de uma instância viva a partir do diff de um PR (ou de um roteiro
  escrito em comentário), com um pool reutilizável de usuários de serviço `QA <Tipo> <n>` que ela
  mesma reserva, configura e devolve a cada rodada. **Não verificado nesta sessão** (sem acesso à
  API da instância ainda — nenhuma das duas variáveis de ambiente existe aqui), mas pelo que
  sabemos não instalamos o `ola_mundo` nesta instância, então o roteiro fixo de smoke do primeiro
  app (`smoke-primeiro-app.md`, § 7 origem "c" da skill) provavelmente não se aplica aqui — ele
  veio junto por ser parte inseparável do pacote da skill, mas só dispara sob pedido explícito
  ("roda o smoke do primeiro app") e não atrapalha o resto. Contrato de ambiente:
  `URBIVERSO_QA_URL` e `URBIVERSO_QA_TOKEN_PCPAL`.

Nenhuma das duas está configurada nesta sessão — nenhuma das duas variáveis de ambiente existe
ainda. Para começar, peça **"configure o meu acesso à instância"** numa sessão nova (o roteiro
está em `.claude/skills/instancia-urbiverso/preparar-ambiente.md`).

## O que foi avaliado e descartado

- **`especificar` e `implementar`** — cobrem o ciclo ideia → issue-spec → PR para quem está
  começando um app do zero. Este repositório já tem um processo próprio, mais maduro e mais
  específico ao domínio (rodadas numeradas, `docs/rodada-N/planejamento.md`,
  `scripts/preflight-pr.mjs`, as regras R1–R3 de escopo), documentado extensamente no
  `CLAUDE.md` § "Processo obrigatório de trabalho". Adotar as duas skills genéricas por cima
  criaria dois caminhos concorrentes para a mesma pergunta ("como eu começo uma mudança"). Ficam
  de fora — quem quiser usá-las mesmo assim, elas estão descritas em
  `node_modules/@urbiverso/sdk/docs/` e podem ser copiadas à mão depois.
- **`.claude/skills/revisar-pr-apps/` do kit** — não foi trazido. Ver acima: a nossa cópia tem
  customizações vivas que a versão genérica do kit não carrega, e o kit a sobrescreveria por
  inteiro numa atualização real. Se um dia quisermos conferir o que mudou lá, o jeito seguro é
  ler a árvore descartável de novo (nunca rodar o kit dentro deste repositório) e portar à mão,
  como já é a prática descrita em `CLAUDE.md` § "A revisão em si" ("Cópia, não link vivo").
- **`apps/ola_mundo/`, `KIT.md` na raiz, `AGENTS.md`** — não fazem sentido no layout
  app-em-repositório-próprio; `KIT.md` em particular presumiria o fluxo `pnpm -r empacotar` e a
  lista `options` do `release.yml` multi-app, que não é como este repositório publica (nosso
  `release.yml` já é o `urbi-empacotar viabilidade --dir . --saida ./dist` mais `gh release
  create`, específico de app única).

## Deriva de versão — item para acompanhar, não para agir agora

O `KIT.md` recebido está carimbado `SDK 71 · @urbiverso/sdk 71.0.0 · shell 0.56.1`. O que este
repositório tem fixado é `@urbiverso/sdk` `57.0.0` (`package.json`), com `shell_min` `0.53.20`
(`manifesto.json`). É uma distância grande — 14 majors de SDK.

Conferi as sete obsolescências embutidas no SDK `57.0.0` instalado
(`node_modules/@urbiverso/sdk/obsolescencias.json`) contra o código deste repositório: nenhuma se
aplica hoje (`grep` por `urbi-hospedeiro ... preencher`, `usuario.natureza`, `severidade` em
`manifesto.json`, seletor de canal do Slack, `estiloCeuEstrelado`, `urbi-issue`/`Sentinela1` — zero
ocorrências; os parâmetros do manifesto já usam a chave `padrao`, não a `inicial` obsoleta). Não há
nada quebrado nem prestes a quebrar por causa da versão fixada.

Subir o pin do SDK é decisão separada, deliberada — o `apps-em-repo-proprio.md` é explícito que o
major do SDK em devDependency vira o `sdk_min` declarado (regra prática: "copie o major contra o
qual você compilou"), e subir de 57 para 71 pode expor obsolescências novas que só existem nas
versões intermediárias do pacote. Não fiz esse bump aqui. Quando o autor quiser avaliar, o caminho
é: checar a versão de shell que a instância realmente roda (Admin → Sistema, ou pela leitura via
`instancia-urbiverso` depois de configurada), depois decidir o degrau.

## O que ficou para o autor

- Rodar **"configure o meu acesso à instância"** numa sessão nova para ativar `instancia-urbiverso`
  e `qa` de verdade (cria o usuário de serviço, as alçadas e as variáveis de ambiente da sessão de
  nuvem).
- Confirmar, na instância, se o token de serviço já tem leitura liberada também para o pacote
  `kit-apps` (o passo 9.4 do `instancia-no-ar.md` novo pede os dois pacotes, `sdk` **e**
  `kit-apps`) — testei o acesso de leitura ao `@urbiverso/kit-apps` com o token atual do ambiente
  desta sessão e funcionou (`npm view` e `npx` resolveram a versão `71.2.2` normalmente), então
  aparentemente já está liberado; vale só a confirmação formal do lado do time urbiverso.

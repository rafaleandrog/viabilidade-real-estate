# Viabilidade — App UrbiVerso (Estudo de Viabilidade Imobiliária)

App UrbiVerso para análise econômico-financeira de empreendimentos imobiliários (**Loteamento** e **Incorporação**). Substitui planilhas dispersas por uma aplicação centralizada com cálculos automáticos, indicadores padronizados, comparação de cenários, análise de sensibilidade e avaliação de apelo comercial assistida por IA.

Este repositório contém o código-fonte da app. Ele **não é** o monorepo do UrbiVerso — é um repositório de app própria, que é empacotada como tarball e instalada em qualquer instância UrbiVerso pela UI admin.

---

## 🖥️ Demonstração navegável (GitHub Pages)

O app real depende do shell do UrbiVerso (que injeta `window.urbiVerso`, autenticação e backend), então **não roda sozinho**. Para permitir uma prévia visual, o repositório inclui uma **página de demonstração estática** que reusa exatamente os mesmos componentes do frontend, porém com um **mock do `window.urbiVerso`** e dados fictícios em memória.

- **Arquivos:** `index.html` (raiz) + `demo/demo.js` (bundle) + `demo/mock.ts` (backend fake).
- **O que dá pra ver:** dashboard de estudos, criar/duplicar/remover, detalhe com abas (Premissas/Proforma/Gráficos), transições de status, gestão de membros e a configuração de benchmarks.
- **Limite honesto:** é estático — os dados são fictícios e se perdem ao recarregar; não há backend real nem cálculo de Proforma (esse chega nas Etapas 5/6).

**Como habilitar o GitHub Pages** (após dar push): repositório → **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**. Em ~1 min o app fica em `https://<seu-usuario>.github.io/<nome-do-repo>/`.

**Rebuild do demo** (se mexer no frontend): `pnpm run build:demo` (regenera `demo/demo.js`, que é versionado).

---

## ⚠️ Leia isto primeiro (para o Claude Code)

Este README é o mapa do projeto. **Releia-o no início de cada sessão** antes de escrever qualquer código. As regras abaixo valem para **todas** as etapas.

### Fatos fixos do projeto (não mude)

| Item | Valor |
|---|---|
| **appId** | `viabilidade` (snake_case — é o nome da pasta, o schema PostgreSQL e o prefixo de rota) |
| **Nome da tag / release** | `viabilidade-v<x.y.z>_<sha8>` (ex.: `viabilidade-v0.1.0_c03c34e1`) — ver [Lançar uma release](#lançar-uma-release) |
| **Web component** | `app-viabilidade` |
| **Prefixo de rota** | shell prefixa tudo com `/api/viabilidade/` — **nunca** escreva o prefixo você mesmo |
| **Versão do shell / SDK alvo** | `0.50.3` (é o `shell_min` e a versão do `@urbiverso/sdk`) |
| **Escopo** | **Somente MVP.** Tudo marcado como "v2" na spec fica **de fora**. |

### Fontes de verdade que você DEVE ler (não invente contratos)

1. **Monorepo de referência:** `https://github.com/UP-Urbita/urbiverso` — você tem acesso de leitura. Dentro dele:
   - `docs/shell/banco-de-dados.md`, `docs/shell/permissoes.md`, `docs/shell/ia.md`, `docs/shell/ui.md`, `docs/shell/nucleo.md`, `docs/shell/eventos.md`, `docs/shell/documentacao.md`
   - `sdk/README.md` (o que o `@urbiverso/sdk` exporta, lockstep de versão)
   - `apps/` — leia um app existente que usa **permissão por membership** (OKRs e/ou Recrutamento) como modelo vivo de estrutura, rotas e frontend. **Copie o padrão, não reinvente.**
2. **A spec completa do app:** `docs/spec/estudo-de-viabilidade-spec.md` neste repositório (commitada antes de você começar). É o contrato funcional. Toda regra de negócio, fórmula, tabela, evento e tela está lá.

Se um contrato (comando, formato, assinatura de `req.*`, API do Núcleo) puder ser lido no monorepo, **leia-o de lá** em vez de deduzir. O que envelhece mora no framework, não na sua memória.

### Os 4 contratos inegociáveis

1. **Backend 100% self-contained.** `backend/rotas.js` roda em produção sem `npm install`. Use o comando de build canônico (com `--minify` e o banner `createRequire`). Nada de `--packages=external` no backend.
2. **Sem `instanceof` cruzando o limite shell↔app.** Faça matching por propriedade (`erro?.name === '...'` ou um `codigo` estável). Prefira `import type` quando só precisa da identidade de tipo.
3. **Seed inicial fora de migração.** `schema.json` é o genesis da app — numa instalação virgem o schema nasce no estado final e as migrações sofrem baseline (registradas sem rodar). Dados semente devem ser idempotentes no boot ou declarativos. Migração é só para transformar dados de instâncias que já têm a app.
4. **`shell_min` honesto.** `0.50.3`, formato `x.y.z` completo.

### Disciplina de trabalho (toda etapa)

- **Uma etapa por vez.** Não adiante trabalho de etapas futuras. O objetivo da divisão é manter o foco e não estourar o orçamento de tokens.
- **Não haverá teste manual entre etapas.** Por isso, **cada etapa termina com auto-validação sua**: `typecheck`/`build` verde e, quando aplicável, `pnpm exec urbi-empacotar viabilidade` sem erros.
- **Commit ao fim de cada etapa**, com mensagem clara (`feat(etapa-N): ...`).
- **Atualize `PROGRESSO.md`** (você cria na Etapa 0) ao fim de cada etapa: o que ficou pronto, decisões tomadas, pendências. É a sua memória entre sessões.
- **Se travar por acesso/permissão** (ex.: `@urbiverso/sdk` não instala), **pare e reporte** em vez de improvisar um workaround.

---

## O que se constrói

Uma app UrbiVerso é uma pasta com quatro peças:

```
viabilidade/
├── manifesto.json     ← quem a app é e o que ela usa (roles, nav, ia, eventos, params, deps do Núcleo)
├── schema.json        ← tabelas da app (o shell cria o schema PostgreSQL e injeta req.dados)
├── backend/rotas.ts   ← Express Router com todas as rotas customizadas de negócio
└── frontend/index.ts  ← web component app-viabilidade (Lit)
```

O pacote final é `viabilidade-<versao>.urbiapp.tgz` (+ sidecar `.sha256`), gerado por `urbi-empacotar`, contendo só o runtime — nunca `.ts`, `node_modules` ou `package.json`.

## Estrutura alvo do repositório

App na raiz (repo de app única):

```
viabilidade-real-estate/
├── manifesto.json
├── schema.json
├── backend/rotas.ts
├── frontend/index.ts
├── migracoes/                 (vazio no MVP — schema.json é o genesis)
├── docs/
│   ├── spec/                  (a spec original — commitada antes de começar)
│   └── viabilidade/           (docs do app, criados na Etapa 7, seguindo documentacao.md)
├── package.json
├── tsconfig.json
├── .npmrc                     (@urbiverso:registry=https://npm.pkg.github.com)
├── .gitignore
├── PROGRESSO.md               (memória entre sessões — criado na Etapa 0)
├── README.md
└── .github/workflows/release.yml
```

## Lançar uma release

A app é distribuída como pacote `viabilidade-<versao>.urbiapp.tgz`, publicado como **release do GitHub** por `.github/workflows/release.yml`.

Tag canônica: **`viabilidade-v<x.y.z>_<sha8>`** (ex.: `viabilidade-v0.1.0_c03c34e1`). Dois pedaços de identidade, papéis distintos:

- **`versao` (`x.y.z`)** vem do `manifesto.json` e é o contrato de **schema**: bump de `z` só quando há migração de banco. Mudança só de código **não** bumpa versão. Downgrade é recusado pelo instalador.
- **`_<sha8>`** é a identidade de **build**: o short sha (8 chars, hexa minúsculo) do commit do qual o tarball é buildado. É ele que permite à plataforma atualizar entre releases de **mesma versão** (compara por ancestralidade git). Tag sem sha instala, mas nunca gera upgrade de build.

O sha vive **só na tag** — o `manifesto.json` nunca o contém (ele não existe antes do commit). O nome do asset não muda: `viabilidade-<x.y.z>.urbiapp.tgz` + sidecar `.sha256`.

**Pré-requisito de CI (uma vez):** o workflow instala o `@urbiverso/sdk` (privado) do GitHub Packages. O `GITHUB_TOKEN` efêmero do repo **não** tem acesso cross-org a esse pacote (dá `403`), então crie um secret **`URBIVERSO_PACKAGES_TOKEN`** com um PAT `read:packages` em `Settings → Secrets and variables → Actions`. Sem esse secret, o passo *Instalar dependências* falha e nenhuma release é publicada.

**Como publicar:** Actions → **release** → Run workflow (ref `main`, ou a branch que contenha a correção). O workflow deriva a versão do `manifesto.json`, cria a tag com o sha8 do commit e publica a release — sem terminal. (Se e só se houve migração de schema, bumpe antes a `versao` no `manifesto.json` — e no `package.json`, por higiene.)

Push manual de tag também funciona (`git tag viabilidade-v0.1.0_<sha8> && git push origin <tag>`); o workflow valida que a versão bate com o manifesto e que o sha bate com o commit tagueado. Em ambos os caminhos ele builda, testa, empacota com `urbi-empacotar` e publica a release com tarball + `.sha256`.

> **Importante:** merge na `main` não vira release sozinho — o auto-update instala *releases*. Mudou código e quer o novo build nas instâncias? Publique release nova com a **mesma** versão e a tag com o sha novo.

## Acessos e pré-requisitos

- **Leitura do monorepo `UP-Urbita/urbiverso`:** garantida (a conta é contributor).
- **`@urbiverso/sdk` (GitHub Packages, escopo `@urbiverso`, registry `https://npm.pkg.github.com`):** entra como `devDependency`. Ter leitura no repo do monorepo **não** garante acesso ao pacote — é permissão separada. Também **não** basta o autor ser membro da org: o `GITHUB_TOKEN` do CI representa o repo, não a pessoa, e não herda esse acesso (dá `403`). São necessários **dois** pontos de auth com um PAT `read:packages`:
  - **Local:** `//npm.pkg.github.com/:_authToken=<PAT>` no `~/.npmrc`.
  - **CI:** secret do repo **`URBIVERSO_PACKAGES_TOKEN`** (`Settings → Secrets and variables → Actions`). O `release.yml` usa `NODE_AUTH_TOKEN: ${{ secrets.URBIVERSO_PACKAGES_TOKEN || secrets.GITHUB_TOKEN }}` no passo de install.
  - **Alternativa ao secret:** um admin da org liberar este repo em *Package settings → Manage Actions access* do `@urbiverso/sdk` — aí o fallback `GITHUB_TOKEN` passa a funcionar.
- **Instância dev de teste:** o app roda numa versão dev do UrbiVerso. O ID da gleba "Fazenda Paranoazinho" (usada no filtro de exclusão) é um **parâmetro configurável** do app; enquanto vazio, o filtro degrada mostrando todas as glebas.

## Etapas de construção

O trabalho segue 8 etapas. O detalhamento de cada uma está no documento de instruções (`INSTRUCOES-CODE.md`), fornecido pelo autor e trabalhado **uma etapa por sessão**.

| Etapa | Foco |
|---|---|
| 0 | Reconhecimento do monorepo + scaffolding do repo + validar acesso ao SDK |
| 1 | `schema.json` + `manifesto.json` (fundação de dados) |
| 2 | Backend núcleo (estudos, membros, ciclo de status, proxy do Núcleo) |
| 3 | Backend regras (benchmarks, preço sugerido, IA de apelo comercial, exportação, arquivamento) |
| 4 | Frontend base (Dashboard + aba Terrenos/Imóveis) |
| 5 | Frontend aba Premissas (formulário + KPI grid + preço sugerido) |
| 6 | Frontend aba Proforma (motor de cálculo, cenários, sensibilidade) + aba Gráficos |
| 7 | Exportação + UI de IA + UI de Benchmarks + docs do app + empacotamento final |

---

## Referência rápida de contratos técnicos

**tsconfig (Lit com decorators):** `experimentalDecorators: true`, `useDefineForClassFields: false`, `module/target ES2022`, `moduleResolution: bundler`, `strict: true`.

**Build canônico** (gera os dois bundles — frontend externaliza `@urbiverso/ui`; backend self-contained):

```bash
esbuild frontend/index.ts --bundle --external:@urbiverso/ui --format=esm --outfile=frontend/index.js --target=es2022 --minify --tsconfig=tsconfig.json \
  && esbuild backend/rotas.ts --bundle --minify --format=esm --outfile=backend/rotas.js --platform=node --target=node20 \
     --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"
```

**Backend:** `export const rotas: Router = Router()` com rotas **relativas**; `import '@urbiverso/sdk/express'` no topo para tipar `req.*`; `req.contexto` (usuário/nível/roles) já preenchido — a app **nunca** implementa autenticação; `req.dados` para persistência.

**Frontend:** Lit com decorators (`@customElement('app-viabilidade')`, `@state`, `@property`); chamadas via `urbiVerso.api('/viabilidade/rota')`; tokens CSS do design system (`var(--cor-primaria-solida)`, `var(--espaco-4)`, …); primitivos `urbi-*` disponíveis globalmente (use pela tag, `import type` apenas — nunca `import @urbiverso/ui` em runtime).

**Empacotar:** `pnpm build && pnpm exec urbi-empacotar viabilidade` → `dist/viabilidade-<versao>.urbiapp.tgz` + `.sha256`, já validado com as mesmas checagens do instalador.

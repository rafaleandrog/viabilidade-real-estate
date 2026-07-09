# Instruções para o Claude Code — App `viabilidade`

# Master Plan — App "Estudo de Viabilidade" (UrbiVerso)

> Documento para enviar ao Claude Code rodando na máquina do usuário. Ele constrói o app `viabilidade`
> no repo pessoal `rafaleandrog/viabilidade-real-estate`. **Uma etapa por sessão.**

## Context

Substituir planilhas dispersas de viabilidade imobiliária por um app UrbiVerso com cálculo automático,
indicadores padronizados, comparação de cenários, análise de sensibilidade e avaliação de apelo
comercial por IA. A spec funcional (`estudo-de-viabilidade-spec.md`) está completa (29 pendências
resolvidas); os padrões da plataforma estão comprovados por apps vivos em `urbiverso/urbiverso-apps-gestao`.
Este plano alinha o **desenho de alto nível** e organiza a construção em 8 etapas. O detalhamento por
etapa do autor virá em `INSTRUCOES-CODE.md` — quando chegar, **reconciliar** com este plano (o autor
autorizou readaptar).

---

## Desenho em alto nível (como o app funciona)

**Objeto central: o Estudo.**

- **Dois tipos:** Loteamento (parcelar gleba em lotes) e Incorporação (construir unidades sobre lotes).
  **MVP só nível Preliminar** (indicadores estáticos, sem dimensão temporal); Avançado = v2.
- **Origem do terreno** (escolhida na criação, imutável): *Buscar no Núcleo* (seleciona gleba/lote, só
  a **área** é consumida) ou *Inserir novo* (nome+área digitados, sem vínculo).
- **Permissão por estudo:** cada estudo tem membros próprios — **Leitor / Editor / Aprovador** — sobre
  os níveis do shell. Sem leitura global. (Modelo idêntico ao `ciclo_membros` do OKR.)
- **Ciclo de vida:** Rascunho → Em análise → (Aprovado | Reprovado), com devolução ao Rascunho e
  **arquivamento automático** após 30 dias parado. Imóvel vinculado só editável em Rascunho (trava
  absoluta, mesmo para aprovador).
- **Fluxo do usuário:** preenche **Premissas** (produto, áreas, preços, custos — defaults editáveis,
  toggles de modo de entrada, checkboxes RET/terreno) → app gera a **Proforma** em tempo real no
  frontend (receita → deduções → custos diretos → indiretos → resultado → margem líquida).
- **Benchmarks** (admin, por tipo): validam indicadores (verde/vermelho) e alimentam a **sensibilidade**
  (Bear/Base/Bull). O benchmark "resultado final %" é o piso que gera o **Preço Sugerido/m²** automático.
- **Comparação de cenários:** dois snapshots transientes lado a lado + variação % (não persiste).
- **Apelo Comercial (IA):** upload de documentos → IA pontua 6 fatores qualitativos (4 perguntas cada,
  nota 1–5) + relatório vantagens/desvantagens/ganhos/riscos.
- **Exportação** PDF/Excel a partir de "Em análise": estudo completo, comparação, sensibilidade.

**Três telas:** **Dashboard** (abas Estudos + Terrenos) · **Estudo** (abas Premissas / Proforma /
Gráficos) · **Imóveis** (imóveis do Núcleo e em quais estudos são usados).

---

## Pré-requisitos e riscos (checar antes/no início)

1. **[Bloqueador] Pacote `@urbiverso/sdk`** (escopo `@urbiverso`, `npm.pkg.github.com`). **Na Etapa 0,
   provar `pnpm install` cedo.** Se falhar por auth de packages, PARAR e reportar (PAT `read:packages`
   no `~/.npmrc` local e secret do CI).
2. **[Maior risco] Núcleo (`imoveis`) sem exemplo vivo.** Nenhum app de referência consome o Núcleo.
   Antes das Etapas 2/3, **ler `docs/shell/nucleo.md`** no monorepo e validar contra instância dev:
   supertipo `imoveis` (subtipos `gleba`/`lote`/`unidade`), campo `area`, relação `lote→parcelamento`,
   e como se lê (permissão `imoveis:["ler"]`). Enquanto o ID da gleba "Fazenda Paranoazinho" (param
   configurável) estiver vazio, o filtro degrada mostrando todas as glebas.
3. **Fontes de verdade no monorepo `UP-Urbita/urbiverso`** (`docs/shell/*.md`, `sdk/README.md`) — ler
   de lá, não deduzir. Confirmar que está clonado/acessível na máquina.
4. **Referência visual dos relatórios** (imagem "Versão pré-existente") não está no repo — layout do
   PDF/Excel fica a critério até o autor fornecer.

## Contratos inegociáveis (valem em todas as etapas)

- **Backend 100% self-contained** (`backend/rotas.js` roda sem `npm install`; build com `--minify` +
  banner `createRequire`; nada de `--packages=external`).
- **Sem `instanceof` cruzando shell↔app** — matching por propriedade (`erro?.name`/`codigo`), `import type`.
- **Seed fora de migração** — `schema.json` é o genesis; semente idempotente no boot; migração só
  transforma dados de instâncias que já têm a app.
- **`shell_min` = `0.50.3`** (formato `x.y.z`), SDK alvo `0.50.3`.
- **Precisão decimal:** R$ e m² → `decimal(12,2)`; % digitado/default → `inteiro`; % calculado →
  `decimal(5,1)`.
- **Rotas relativas**, shell prefixa `/api/viabilidade/`; app nunca faz auth (`req.contexto` já vem);
  persistência via `req.dados`; tabelas de negócio com `acesso_externo:"restrito"`.
- **Frontend:** Lit com decorators; `urbiVerso.api('/viabilidade/...')`; primitivos `urbi-*` por tag
  (`import type` apenas); tokens CSS do design system.

## Disciplina de trabalho (toda etapa)

Uma etapa por sessão · sem teste manual entre etapas → cada etapa termina com **auto-validação**
(typecheck/build verdes e, quando aplicável, `pnpm exec urbi-empacotar viabilidade` sem erros) ·
**commit** `feat(etapa-N): ...` · atualizar **`PROGRESSO.md`** (memória entre sessões) · se travar por
acesso/permissão, **parar e reportar** em vez de improvisar.

---

## Master plan — 8 etapas

Modelos vivos a **copiar, não reinventar**: `okr/` (membership + status + rotas customizadas + web
component Lit) e `recrutamento/` (IA + exportação).

### Etapa 0 — Reconhecimento + scaffolding + validar SDK
- Ler as docs do shell (`banco-de-dados`, `permissoes`, `ia`, `ui`, `nucleo`, `eventos`, `documentacao`)
  e o `sdk/README.md`; ler `okr/` e `recrutamento/` como modelos.
- Scaffold do repo (estrutura-alvo do README: `manifesto/schema/backend/frontend/migracoes/docs`,
  `package.json`, `tsconfig.json`, `.npmrc`, `.gitignore`, `release.yml`).
- **Provar `pnpm install` com o SDK.** Criar `PROGRESSO.md`.
- Done: install verde, scaffold builda vazio.

### Etapa 1 — `schema.json` + `manifesto.json` (fundação de dados)
- Tabelas (spec §6.1): `estudos`, `estudo_imoveis`, `estudo_membros`, `benchmarks`, `apelo_comercial`,
  `apelo_comercial_documentos` — todas `acesso_externo:"restrito"`, respeitando precisão decimal.
- Manifesto: `appId=viabilidade`, roles (leitor/editor/aprovador), nav, `ia`, eventos (§6.9),
  `dependencias_nucleo:["imoveis"]` + `permissoes_nucleo:{imoveis:["ler"]}`, params configuráveis (§6.5).
- Done: schema valida, manifesto valida, `urbi-empacotar` aceita.

### Etapa 2 — Backend núcleo
- Rotas customizadas: CRUD de estudos (filtrado por membership), membros, **transições de status** com
  regras (§3), proxy do Núcleo (`/nucleo/glebas`, `/nucleo/lotes`, `/nucleo/imoveis/:id`) com filtro
  excludente, eventos `estudo_criado`/`estudo_status_alterado`. Gates de permissão espelhando o padrão
  do OKR (`permissoes-ciclo.ts`). id_legivel/sequência por tipo.
- Done: typecheck/build verdes; rotas cobrem criar/editar/mover status/membros.

### Etapa 3 — Backend regras
- Benchmarks CRUD (admin only), cálculo de **Preço Sugerido/m²** (piso do benchmark), **IA de apelo
  comercial** (`req.ia`: extrair documentos + `consultar` com schema JSON dos 6 fatores, salvar scores +
  evento `apelo_comercial_concluido`), **exportação** PDF/Excel, **arquivamento automático** (30 dias).
- Done: build verde; rotas de regra funcionam contra instância dev.

### Etapa 4 — Frontend base
- Web component `app-viabilidade` (roteamento interno como `okr/frontend/index.ts`), **Dashboard**
  (tabela de estudos, filtros, criar/duplicar/remover) + aba **Terrenos/Imóveis**.
- Done: build frontend verde; navegação e listagem funcionam.

### Etapa 5 — Aba Premissas
- Formulário (terreno por origem, produto, custos com toggles, impostos/RET), **KPI grid** (`urbi-kpi`+
  `urbi-wrap`) atualizando em tempo real, exibição do **Preço Sugerido/m²**.
- Done: build verde; KPIs recalculam ao editar.

### Etapa 6 — Aba Proforma + Gráficos
- Motor de cálculo no frontend (linhas/fórmulas §6.2), KPIs de topo com benchmark (verde/vermelho),
  **comparação de cenários** (2 snapshots transientes + variação), **sensibilidade** (Bear/Base/Bull,
  unidimensional). Aba **Gráficos** (`urbi-grafico-pizza` custos + `urbi-grafico-colunas` receita×custo).
- `urbi-abas` deve preservar DOM ao trocar aba (estado transiente dos cenários).
- Done: build verde; Proforma bate com a spec em casos de teste.

### Etapa 7 — Exportação (UI) + IA (UI) + Benchmarks (UI) + docs + empacotamento
- Botões de exportação na Proforma, UI de disparo/exibição do apelo comercial, UI admin de benchmarks;
  docs do app (`docs/viabilidade/*.md` seguindo `documentacao.md`); empacotamento final e release.
- Done: `pnpm build && pnpm exec urbi-empacotar viabilidade` gera `.urbiapp.tgz` + `.sha256`; docs completas.

---

## Verificação

- **Por etapa:** typecheck/build verdes; quando aplicável `urbi-empacotar` sem erros; commit + `PROGRESSO.md`.
- **Etapa 0:** `pnpm install` resolve `@urbiverso/sdk` (senão parar/reportar).
- **Etapas 2/3:** validar contratos do Núcleo e do framework de IA contra `docs/shell/*.md` e instância
  dev antes de assumir.
- **Etapa 6:** validar a Proforma com casos numéricos derivados das fórmulas §6.2 (Loteamento e Incorporação).
- **Final:** instalar o tarball numa instância dev via `Admin → Apps` e exercitar o fluxo completo
  (criar estudo → premissas → proforma → cenários → sensibilidade → IA → exportar).
---

## Encerramento

Ao fim da Etapa 7, o repositório contém uma app UrbiVerso `viabilidade` completa no escopo MVP, empacotável e pronta para instalar via UI admin (upload do tarball ou release do repo). O `PROGRESSO.md` documenta o caminho e as pendências de v2.

# PROGRESSO — App `viabilidade`

Memória entre sessões. Uma etapa por sessão. Atualizar ao fim de cada etapa.

---

## Mapa de repositórios (na máquina)

| Repo | Caminho | Papel |
|---|---|---|
| **viabilidade-real-estate** | `C:\Users\Rafael.gualberto\viabilidade-real-estate` | **Este repo** — a app sendo construída (app na raiz) |
| **urbiverso** (monorepo shell) | `C:\Users\Rafael.gualberto\urbiverso` | Fonte de verdade: `docs/shell/*.md`, `nucleo/`, `shell/`, `apps/` |
| **urbiverso-apps-gestao** | `C:\Users\Rafael.gualberto\urbiverso-apps-gestao` | Apps vivas modelo: `okr/`, `recrutamento/`, `dd/` — **copiar padrão, não reinventar** |

> ⚠️ O `sdk/README.md` citado no README **não existe** localmente no monorepo. O `@urbiverso/sdk` só está disponível via GitHub Packages (`npm.pkg.github.com`). Contratos de `req.*` foram lidos de `docs/shell/*.md` e das apps modelo.

---

## Estado atual: Etapa 4 — ✅ CONCLUÍDA

### Feito (Etapa 4 — frontend: dashboard + detalhe + config)
- **`frontend/viabilidade-api.ts`** — wrapper sobre `window.urbiVerso.api` (APP `/viabilidade`) com todas as chamadas: estudos (CRUD/duplicar/status), membros, imóveis, benchmarks, config, glebas/lotes, `listarUsuarios` (via `/shell/apps/viabilidade/roles/usuarios`).
- **`frontend/viab-shared.ts`** — estilos base (tema escuro por tokens `var(--cor-*)`), labels de status/tipo, badges, botões, tabela, modal, `formatarData`.
- **`frontend/index.ts`** — `<app-viabilidade>` com roteamento por sub-rota (`/`, `/terrenos`, `/detalhe/{id}`) via `urbiVerso.subRota()`/`escutarRota`.
- **`frontend/tela-dashboard.ts`** — abas Estudos/Terrenos, tabela filtrável (tipo/status), criar (modal), duplicar, remover. Aba Terrenos avisa que o Núcleo está indisponível → usar modo manual.
- **`frontend/tela-estudo.ts`** — detalhe com abas Premissas/Proforma/Gráficos; botões de transição de status conforme `_permissao` (submeter/aprovar/reprovar/devolver/reabrir); painel de membros (add/mudar função/remover); formulário de Premissas inicial (subconjunto editável com Salvar via PATCH). Proforma/Gráficos são placeholders (Etapas 5/6).
- **`frontend/viabilidade-config-benchmarks.ts`** — `<viabilidade-config-benchmarks>` (manifesto `telas_config`): tabela editável por tipo, criar/remover/semear indicadores padrão.
- **Decisão de robustez:** componentes **autocontidos** (HTML puro + CSS por tokens), sem depender das APIs dos componentes `urbi-*` (não verificáveis offline). Adotar `urbi-tabela`/`urbi-kpi`/`urbi-abas` etc. quando houver instância rodando.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 17→47KB) · test 8/8 ✓ · empacotar ✓.
- ⏳ **Verificação em runtime pendente** — a UI não foi exercitada contra uma instância UrbiVerso real (o "teste na interface"). Offline validei por typecheck+build+empacotamento.

---

## Estado anterior: Etapa 3 — ✅ CONCLUÍDA

### Feito (Etapa 3 — benchmarks + config + Núcleo stub)
- **`backend/rotas/benchmarks.ts`** — CRUD admin-only (`nivelApp === 'admin'` = role aprovador): `GET /benchmarks` (leitura liberada a qualquer usuário da app), `POST`/`PATCH /:id`/`DELETE /:id` (admin), `POST /benchmarks/semear` (idempotente, cria os indicadores padrão §4.6 que faltam). Unicidade `[tipo_empreendimento, campo]` tratada (409). Indicadores padrão: `resultado_final`(piso), `margem_bruta`, `margem_liquida`, `roi`, `custo_obras_vgv`(teto); `eficiencia_aproveitamento` só Loteamento.
- **`backend/rotas/config.ts`** — `GET /config` expõe os 6 parâmetros da app (§6.5) via `req.parametros.obter` para o frontend pré-preencher defaults.
- **`backend/rotas/nucleo.ts`** — proxy `GET /nucleo/glebas|lotes|imoveis/:id` com **degradação graciosa** (`disponivel: false`). Motivo: este Núcleo **não tem** glebas/lotes (nem rota REST nem `req.nucleo.listar` — confirmado por grep em `nucleo/`; SDK v0.50.3 declara essas entidades como futuras). Frontend cai no modo manual. `permissoes_nucleo` segue vazio (install seguro).
- **Testes:** `benchmarks.test.ts` (3) + `estudos.test.ts` (5) = **8/8 verdes**.
- **Validado (verde):** typecheck ✓ · build ✓ (827→832KB) · test 8/8 ✓ · empacotar ✓.
- ⚠️ **Discrepância da spec:** §2 diz "editor edita benchmarks", mas §6.8 + schema `acesso_externo: restrito` dizem admin-only. Segui **admin-only** (aprovador). Revisar com o autor se necessário.

---

## Estado anterior: Etapa 2 — ✅ CONCLUÍDA

### Feito (Etapa 2 — permissão por estudo + rotas customizadas)
- **`backend/permissoes-estudo.ts`** — 4ª camada (membership) espelhando `permissoes-ciclo.ts` do OKR. `resolverPermissaoEstudo` lê `estudo_membros`; gates `exigirMembro`/`exigirEditor`/`exigirAprovador` (aprovador ⊇ editor ⊇ leitor; admin de app age como aprovador; estudo sem membros → escrita+ assume editor); `garantirMembro` idempotente.
- **`backend/eventos-viabilidade.ts`** — `publicarEvento` (best-effort, chave nua; shell prefixa `app.viabilidade.`), `inscreverMembroEstudo`/`desinscreverMembroEstudo` (inscrição **forte** filtrada por `estudo_id`; editores/aprovadores também seguem `apelo_comercial_concluido`), payload builders batendo exatamente com os `campos` do manifesto §6.9.
- **`backend/identificacao.ts`** — `id_legivel`/`nome_exibicao`/`sequencia` (§6.1). Template `{SIGLA} - {nome} - {UF} - {seq}`; sequência incrementa por `tipo_empreendimento` (conta removidos p/ não reusar); slug sem acentos/espaços.
- **`backend/rotas/estudos.ts`** — `POST /estudos` (cria + criador vira editor + evento `estudo_criado`), `GET /estudos` (filtrado por membership; admin vê tudo; leitor não vê rascunho/arquivado), `GET /estudos/:id` (detalhe + membros + imóveis + flags `_permissao`), `PATCH /estudos/:id` (editor+; travado em aprovado/reprovado/arquivado → só aprovador; `tipo_empreendimento` só em rascunho), `DELETE` (soft delete via `remover`), `POST /:id/duplicar` (copia campos+imóveis, novo id_legivel, evento), `POST /:id/status` (matriz de transição `gateTransicao` + evento `estudo_status_alterado`).
- **`backend/rotas/membros-estudo.ts`** — GET/POST/PATCH função/PATCH remover (editor+; reconcilia inscrições).
- **`backend/rotas/imoveis-estudo.ts`** — GET/POST/DELETE vínculo imóvel↔estudo; **editável só em Rascunho**; consistência tipo (loteamento→1 gleba, incorporação→N lotes).
- **`backend/rotas/estudos.test.ts`** — 5 testes da matriz de transição de status (todos passam).
- **Validado (verde):** `pnpm typecheck` ✓ · `pnpm build` ✓ (backend 812→827KB) · `pnpm test` ✓ (5/5) · `pnpm run empacotar` ✓.
- ⏳ **Verificação em runtime contra o shell fica pendente** — exige o app instalado numa instância UrbiVerso (o teste na interface que o usuário mencionará). Offline validei por typecheck+build+testes+empacotamento.

---

## Estado anterior: Etapa 1 — ✅ CONCLUÍDA

### Feito (Etapa 1 — schema.json + manifesto.json reais)
- **`schema.json` completo** com as 6 tabelas da spec §6.1, todas `acesso_externo: "restrito"`:
  - `estudos` (`soft_delete: true`) — meta/identidade (`id_legivel` único, `nome_exibicao`, `nome`, `tipo_empreendimento`, `uf`, `sequencia`, `nivel_analise`, `status`, `autor_id`), terreno (`origem_terreno` nucleo/manual + `terreno_manual_nome`/`terreno_manual_area`), produto (preços/m², coeficientes, áreas PVT R/NR aberta/fechada, %s da gleba), custos diretos/indiretos com toggles de modo (`infra_modo`, `projetos_modo`, `licenciamento_modo`, `permuta_fisica_modo`), impostos/RET, permutas e overrides de sensibilidade.
  - `estudo_imoveis` (junção N:M, `imovel_nucleo_id` inteiro = ref. lógica; `tipo_imovel` gleba/lote; único `[estudo_id, imovel_nucleo_id]`), `estudo_membros` (funcao leitor/editor/aprovador; único `[estudo_id, usuario_id]`), `benchmarks` (único `[tipo_empreendimento, campo]`), `apelo_comercial` (6 scores + `score_geral` + `resultado` json), `apelo_comercial_documentos` (`arquivo` com mimes PDF/DOCX/XLSX).
- **`manifesto.json` completo**: roles (leitor/editor/aprovador com stickers), `nav` (Estudos, Terrenos), `ia: true`, `telas_config.benchmarks`, `parametros` (§6.5 — impostos/RET/corretagem/marketing/indiretos/prazo arquivamento), `eventos` (§6.9 — `estudo_criado`, `estudo_status_alterado`, `apelo_comercial_concluido`).
- **Validado (verde):** JSON parse ✓ · `pnpm typecheck` ✓ · `pnpm build` ✓ · `pnpm run empacotar` ✓ → `dist/viabilidade-0.1.0.urbiapp.tgz` (schema+manifesto aceitos pelo empacotador).

### Decisões da Etapa 1 (reconciliação com a realidade)
- **Núcleo declarado vazio no MVP:** `dependencias_nucleo: []`, `permissoes_nucleo: {}`. Motivo: o módulo `imoveis`/`gleba`/`lote` da spec §6.6 **não existe** na instância real (só há `empreendimentos` e `unidades`); declarar dependência de módulo inexistente arriscaria travar o registro/instalação do app na interface. **Decisão do usuário:** o app aceita terreno do Núcleo **e** manual; no MVP tudo funciona pelo modo `manual` (nome+área digitados) e o schema já está preparado (`origem_terreno`, `estudo_imoveis.imovel_nucleo_id`) para quando houver conexão real — bastará adicionar dependência + rotas-proxy, **sem migração de schema**. Ver `[[nucleo-imoveis-nao-existe-usar-manual]]`.
- **`permissoes_nucleo` usa string** (`"leitura"`), não array `["ler"]` como na spec — corrigido conforme apps reais (`visualizador`, `fabrica`).
- **Percentuais de input unificados em `decimal(5,2)`** (não `inteiro` como diz §6.1). Motivo: vários defaults da spec são fracionários (imposto 6,73% arredondado p/ 7, projetos 1,6%, incorporação/registro 0,25%, gestão indiretos 1,25%); `inteiro` zeraria/corromperia esses valores. Monetários e áreas em `decimal(12,2)`, scores do apelo em `decimal(3,1)`, conforme spec.
- **`nivel_analise` usa `"avancado"` sem acento** (slug seguro para filtros de API), em vez de `"avançado"`.

---

## Estado anterior: Etapa 0 — ✅ CONCLUÍDA

### Feito
- **Reconhecimento** das docs do shell: `overview`, `banco-de-dados`, `permissoes`, `ui`, `barramento` (eventos), `agentes` (IA/usuários), `documentacao`. Apps modelo lidas: `okr` (membership `ciclo_membros`, status, rotas modulares, web component Lit) e `recrutamento` (bloco `ia` no manifesto).
- **Scaffold** criado na estrutura-alvo do README:
  - `manifesto.json` (placeholder mínimo válido — roles leitor/editor/aprovador), `schema.json` (`{ "tabelas": {} }`)
  - `backend/rotas.ts` (Router vazio + `import '@urbiverso/sdk/express'`), `frontend/index.ts` (`<app-viabilidade>` esqueleto Lit)
  - `package.json` (build canônico esbuild + `@urbiverso/sdk@0.50.3` + `@types/express`/`@types/node`), `tsconfig.json` (Lit decorators), `.npmrc`, `.gitignore`, `pnpm-workspace.yaml`
  - `migracoes/` (vazio — schema.json é o genesis), `docs/spec/estudo-de-viabilidade-spec.md` (spec movida), `docs/viabilidade/` (docs do app na Etapa 7)
  - `.github/workflows/release.yml` (adaptado para repo de app única, tag `viabilidade-v<x.y.z>_<sha8>`)
- **Ambiente resolvido e toolchain validado (tudo verde):**
  - `pnpm` 11.11 instalado (`npm i -g pnpm`); PAT `read:packages` em `~/.npmrc` → `@urbiverso/sdk@0.50.3` resolve.
  - `pnpm install` ✓ · `pnpm run typecheck` (`tsc --noEmit`) ✓ · `pnpm build` (esbuild) ✓ → `frontend/index.js` (17KB) + `backend/rotas.js` (812KB, self-contained).
  - `pnpm exec urbi-empacotar` ✓ → `dist/viabilidade-0.1.0.urbiapp.tgz` + `.sha256` (scaffold aceito pelo empacotador).

### ⚙️ Notas de ambiente (importante para próximas sessões)
- **`onlyBuiltDependencies` do pnpm 11 mora no `pnpm-workspace.yaml`** (o campo `pnpm` do `package.json` foi ignorado). Usei `allowBuilds: { esbuild: true }` (pnpm 11) + `onlyBuiltDependencies: [esbuild]` (pnpm 10/CI) para o esbuild baixar o binário nativo.
- **`urbi-empacotar` no Windows: rodar pelo PowerShell, não pelo Git Bash.** O GNU tar 1.35 do Git Bash trata `C:\...` como host remoto e quebra (`Cannot connect to C:`); o PowerShell resolve `tar` para o **bsdtar** do System32, que funciona. Na CI (Linux) não há problema.
- PAT do GitHub foi exposto no chat — **usuário deve rotacioná-lo** após concluir.

---

## Descobertas importantes (reconciliar nas próximas etapas)

- **Núcleo diverge da spec/plano.** O plano assume supertipo `imoveis` (subtipos `gleba`/`lote`/`unidade`), campo `area`, relação `lote→parcelamento`, leitura via permissão `imoveis:["ler"]`. Mas em `urbiverso/nucleo/backend/src/rotas/` **não existe** rota `imoveis`/`gleba`/`lote` — há `empreendimentos`, `unidades`, `pessoas`, `entidades`, `perfis-sociais`, `tarefas`, `tipos-tarefa`. E `nucleo/docs` está **vazio** (não há `nucleo.md`). → **Antes das Etapas 2/3, ler `nucleo/backend/src/rotas/*.ts` e validar o contrato real contra a instância dev.** Risco #2 do plano confirmado.
- **Já existe um protótipo `apps/analise_viabilidade` no monorepo** (v0.1.0): usa tabela própria `terrenos` (não consome o Núcleo, `dependencias_nucleo: []`), com `estudos`, `cenarios`, `benchmarks`, workflow rascunho→pendente→aprovado/rejeitado e ~30 campos `res_*` de proforma no schema. É uma **referência de fórmulas/campos de proforma** muito útil para as Etapas 5/6, embora o desenho-alvo (membership por estudo, consumo do Núcleo, IA de apelo comercial) seja diferente/mais amplo.
- **Permissão por estudo** (Leitor/Editor/Aprovador por estudo) deve espelhar `ciclo_membros`/`permissoes-ciclo.ts` do `okr` (Etapa 2).

---

## Demonstração estática (GitHub Pages)
- **`index.html`** (raiz) + **`demo/demo.ts`→`demo/demo.js`** (bundle versionado) + **`demo/mock.ts`** (mock de `window.urbiVerso` com backend fake em memória: estudos/membros/imóveis/benchmarks seed, roteamento por hash, toasts). Reusa os componentes reais do frontend.
- **`.nojekyll`** na raiz; script `pnpm run build:demo` (esbuild bundla lit inline, self-contained).
- Permite navegar todo o frontend sem shell/backend. Habilitar Pages: Settings → Pages → Deploy from branch → `main` / root.
- ⚠️ Não substitui teste real: dados fictícios, sem cálculo de Proforma (Etapas 5/6), sem `urbi-*` reais.

## Próximos passos
- **Etapa 5 (próxima):** formulário completo de Premissas (§4.4/§4.5 — todos os campos de produto/custos/áreas por tipo, toggles de modo) + engine de Proforma no frontend (§6.2, cálculos em tempo real) + KPI grids (§5.2) + Preço Sugerido/m². Ler o protótipo `apps/analise_viabilidade` (schema `res_*`) como referência de fórmulas.

### Descoberta (Etapa 2) — glebas/lotes existem no Núcleo via `req.nucleo`
Os tipos do SDK (`node_modules/@urbiverso/sdk/dist/express.d.ts`, `type EntidadeBatch`) listam `glebas`, `lotes`, `parcelamentos`, `unidades` como entidades do Núcleo acessíveis por `req.nucleo` (`batch`, `chamarSubrecurso`, `buscarPorChave`). Ou seja: **glebas/lotes existem** como entidades — só não há supertipo `imoveis` nem rota REST dedicada em `nucleo/backend/src/rotas/`. Isso **refina** (não invalida) a decisão da Etapa 1: MVP segue manual; a integração "Buscar terreno" usará `req.nucleo` e `permissoes_nucleo: { glebas: "leitura", lotes: "leitura" }`. Ver `[[nucleo-imoveis-nao-existe-usar-manual]]`.

## Pendências v2 (fora do MVP)
- Nível "Avançado" do estudo (dimensão temporal). MVP é só "Preliminar".
- Layout definitivo dos relatórios PDF/Excel (referência visual do autor ainda não fornecida).

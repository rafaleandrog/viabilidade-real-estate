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

## Estado atual: Etapa 7 (FINAL) — ✅ CONCLUÍDA — MVP completo

### Feito (Etapa 7 — IA Apelo Comercial + exportação + arquivamento + docs)
- **IA de Apelo Comercial (§6.7):**
  - `backend/apelo-comercial.ts` — 6 fatores × 4 perguntas-guia, `SCHEMA_RESPOSTA` (JSON), `instrucoesSistema()` (prompt contextualizado por tipo), `calcularScores()` (score por fator + geral).
  - `backend/rotas/apelo-comercial.ts` — GET resultado+documentos; POST/DELETE documentos (associa `upload_id` → coluna `documento`); **POST dispara a IA** (`req.ia.extrairConteudo` nos arquivos + `req.ia.consultar` com schema), salva `resultado`+scores e publica `apelo_comercial_concluido`. Guarda `IA_INDISPONIVEL` se `req.ia` ausente.
  - `frontend/tela-apelo.ts` — 4ª aba: upload de PDF/Word/Excel + texto, disparo da análise, exibição de scores, fatores (notas/justificativas) e relatório (vantagens/desvantagens/ganhos/riscos).
- **Exportação (§6.3):** `frontend/exportar.ts` — **PDF** via janela formatada com os estilos do app + `print()`; **Excel** via CSV (UTF-8/BOM, `;`, vírgula decimal). Reusa a engine e os valores da tela. Botões ligados na aba Proforma.
- **Arquivamento automático (§3):** `backend/rotas/manutencao.ts` — `POST /manutencao/arquivar-inativos` (admin, idempotente): arquiva estudos parados > `prazo_arquivamento_dias` (exceto Aprovado) e publica evento. ⚠️ **Disparo automático** ainda depende do agendador/rotina da instância (sem hook de boot na app) — documentado.
- **Docs do app (§6.10):** `docs/viabilidade/` — `visao-geral`, `modelo-de-dados`, `formulas`, `benchmarks`, `apelo-comercial`, `permissoes`, `exportacao` (frontmatter `tipo: app`, seguindo `documentacao.md`).
- **Demo:** mock da IA (resultado canned) + rotas de apelo/manutenção; bundle atualizado.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 75→86KB, backend 832→841KB) · test 15/15 ✓ · build:demo ✓ (99→114KB) · empacotar ✓ (inclui `docs/`).

### Pendências remanescentes (pós-MVP / bloqueios de ambiente)
- **Disparo automático do arquivamento** — a regra existe como endpoint; falta o agendador da instância chamá-la (contrato de rotina do shell não documentado para apps).
- **Filtro Núcleo** (Fazenda Paranoazinho / lotes em parcelamento) — bloqueado: esta instância do Núcleo não expõe glebas/lotes. Ver [[nucleo-imoveis-nao-existe-usar-manual]].
- **v2** (fora do MVP): Projeto Avançado (fluxo de caixa, TIR/VPL), curvas/índices, unidades ligadas ao Núcleo, busca web no Apelo, layout gráfico avançado dos relatórios.

---

## Estado anterior: Etapa 6 — ✅ CONCLUÍDA

### Feito (Etapa 6 — aba Proforma + cenários + sensibilidade + Gráficos)
- **`frontend/tela-proforma.ts`** — `<viab-tela-proforma>`: KPI grid do topo (§5.2, área permutada condicional, custo obras/VGV e margem com cor por benchmark); **tabela Proforma linha a linha** (§6.2, colunas R$ e % VGV, subtotais e resultado destacados, linhas exclusivas por tipo e ocultação de zeros); **comparação de cenários** transiente (máx. 2 snapshots + coluna Δ%); **análise de sensibilidade** Bear/Base/Bull por variável estressada (preço, permuta física/financeira, custo infra/obras) com faixas do estudo/benchmark; botões de exportação (placeholder → Etapa 7). Tudo reusa `proforma.ts`.
- **`frontend/tela-graficos.ts`** — `<viab-tela-graficos>`: pizza de composição de custos em **SVG autocontido** (com flag para excluir terreno) + barras Receita×Custos. Sem dependência de `urbi-grafico-*`.
- **`frontend/viab-format.ts`** — formatadores compartilhados (R$, número, %).
- **`tela-estudo`**: abas agora **preservam o DOM** (toggle por `?hidden`, não recriação) — atende §6.4 (estado transiente dos cenários sobrevive à troca de aba). Proforma/Gráficos recebem `.estudo`.
- **Demo**: seed enriquecido com defaults de premissas para a Proforma exibir números realistas.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 60→75KB) · test 15/15 ✓ · build:demo ✓ (81→99KB) · empacotar ✓.

---

## Estado anterior: Etapa 5 — ✅ CONCLUÍDA

### Feito (Etapa 5 — engine de Proforma + Premissas + KPIs + Preço Sugerido)
- **`frontend/proforma.ts`** — engine pura `calcularProforma(estudo)` para Loteamento e Incorporação (§6.2): áreas, VGV (áreas fechadas na Inc; área vendável líquida no Lot), deduções (imposto/RET, corretagem, marketing, permutas financeiras), custos diretos (terreno, infra/construção/decoração/gestão, projetos, outorga, registro, manutenção, contingências) e indiretos, resultado + margem, KPIs (eficiência, custo obras/VGV, ROI, margem bruta, nº unidades, preço médio). `precoSugeridoM2()` por bisseção sobre o piso de resultado final (§1).
- **`frontend/proforma.test.ts`** — 7 testes com números conferidos à mão (Lot completo, RET, terreno desconsiderado, Inc VGV, preço sugerido). **Total 15/15 verdes** (script `test` agora varre `frontend/` também).
- **`frontend/tela-premissas.ts`** — `<viab-tela-premissas>`: formulário completo por tipo (terreno, produto/áreas, custos com toggles infra/projetos, impostos+RET, permuta física com toggle), **KPI grid ao vivo** (§5.2, com cor verde/vermelho por benchmark) e **Preço Sugerido/m²** recalculados a cada digitação; Salvar via PATCH (conversão numérica). Integrado na `tela-estudo` (substitui o mini-form da Etapa 4).
- **Interpretações documentadas** no topo de `proforma.ts** (onde §4.4/§6.2 se contradizem): custo do terreno × área do terreno; obras = infra (Lot) / construção+decoração+gestão (Inc); projetos/licenciamento % sobre VGV.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 47→60KB) · test 15/15 ✓ · build:demo ✓ (66→81KB) · empacotar ✓.

---

## Estado anterior: Etapa 4 — ✅ CONCLUÍDA

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
- **Spec anotada como documento vivo:** `docs/spec/estudo-de-viabilidade-spec.md` ganhou a seção **“0. Status de Implementação (MVP v0.1.0)”** (cobertura por seção, decisões/ajustes de rota, pendências de ambiente) e o **backlog técnico** foi consolidado no §8. Base para encadear as próximas versões.
- **MVP completo (Etapas 0–7).** O app empacota e roda (backend + frontend + docs). Falta apenas **teste em runtime numa instância UrbiVerso real** — nada foi exercitado contra o shell; validação offline foi typecheck + build + 15 testes de unidade + empacotamento + demo estático no Pages.
- Ao instalar numa instância: validar fluxo ponta a ponta (criar/membros/status/proforma/benchmarks/IA), habilitar o framework de IA para a app (slot), e ligar o arquivamento a uma rotina/agendador.
- Considerar bump de versão (`0.1.0` → release) e rotação do PAT exposto na Etapa 0.

## Pendências de etapas anteriores (rastreadas)
- **Arquivamento automático 30 dias (§3)** — regra de backend não implementada; exige contrato de agendamento do shell (`req.eventos.agendar`/rotina). Fazer na Etapa 7.
- **Filtro Núcleo** (excluir Fazenda Paranoazinho / lotes em parcelamento) — bloqueado (Núcleo desta instância sem glebas/lotes). Ver [[nucleo-imoveis-nao-existe-usar-manual]].

### Descoberta (Etapa 2) — glebas/lotes existem no Núcleo via `req.nucleo`
Os tipos do SDK (`node_modules/@urbiverso/sdk/dist/express.d.ts`, `type EntidadeBatch`) listam `glebas`, `lotes`, `parcelamentos`, `unidades` como entidades do Núcleo acessíveis por `req.nucleo` (`batch`, `chamarSubrecurso`, `buscarPorChave`). Ou seja: **glebas/lotes existem** como entidades — só não há supertipo `imoveis` nem rota REST dedicada em `nucleo/backend/src/rotas/`. Isso **refina** (não invalida) a decisão da Etapa 1: MVP segue manual; a integração "Buscar terreno" usará `req.nucleo` e `permissoes_nucleo: { glebas: "leitura", lotes: "leitura" }`. Ver `[[nucleo-imoveis-nao-existe-usar-manual]]`.

## Pendências v2 (fora do MVP)
- Nível "Avançado" do estudo (dimensão temporal). MVP é só "Preliminar".
- Layout definitivo dos relatórios PDF/Excel (referência visual do autor ainda não fornecida).

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

## Estado atual: Etapa 1 — ✅ CONCLUÍDA

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

## Próximos passos
- **Etapa 2 (próxima):** permissão por estudo (membership 4ª camada) espelhando `ciclo_membros`/`permissoes-ciclo.ts` do `okr`. Rotas customizadas de `estudos` (listar filtrado por membership, criar com membros, detalhe/patch/delete, duplicar, transição de status com regras) + publicação dos eventos §6.9. Ler `docs/shell/permissoes.md` e o `permissoes-ciclo.ts` do okr antes.

## Pendências v2 (fora do MVP)
- Nível "Avançado" do estudo (dimensão temporal). MVP é só "Preliminar".
- Layout definitivo dos relatórios PDF/Excel (referência visual do autor ainda não fornecida).

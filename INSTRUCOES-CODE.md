# Instruções para o Claude Code — App `viabilidade`

Este documento contém o plano completo de construção da app UrbiVerso **Estudo de Viabilidade**, dividido em **8 etapas**. Cada etapa é um bloco de prompt autossuficiente.

## Como usar (para o autor humano)

- **Antes de começar, commite no repo `rafaleandrog/viabilidade-real-estate`:**
  1. `README.md` (fornecido junto com este documento).
  2. A spec, em `docs/spec/estudo-de-viabilidade-spec.md`.
- **Trabalhe uma etapa por sessão do Code.** Cole o bloco da etapa correspondente como sua mensagem. Não cole várias etapas de uma vez — a divisão existe para manter o foco e controlar o gasto de tokens.
- **Não haverá teste manual entre etapas.** Cada etapa termina com o próprio Code validando `build`/`typecheck` (e `urbi-empacotar` quando aplicável).
- **A imagem de referência dos relatórios** (`referencia-relatorio-viabilidade.png`) só é necessária na **Etapa 7** — anexe-a no chat naquele momento.

## Regras que valem para TODAS as etapas (o Code deve reler o `README.md` a cada sessão)

- **appId = `viabilidade`** (pasta, schema, prefixo de rota). Web component `app-viabilidade`. Tag `viabilidade-v<versao>`.
- **Somente MVP.** Ignore tudo marcado como "v2" na spec.
- **Leia os contratos do monorepo** (`UP-Urbita/urbiverso`) e da spec — **não invente** APIs, assinaturas de `req.*`, endpoints do Núcleo, nem o framework de IA. Copie o padrão de um app existente que use permissão por membership (OKRs/Recrutamento).
- **Respeite os 4 contratos inegociáveis** (backend self-contained; sem `instanceof` cruzando shell↔app; seed fora de migração; `shell_min` = `0.50.3`).
- **Ao fim de cada etapa:** rode a auto-validação, **commite** (`feat(etapa-N): ...`) e **atualize `PROGRESSO.md`**.
- **Se travar por acesso/permissão, PARE e reporte.** Não improvise workaround.

---

# ETAPA 0 — Reconhecimento do monorepo + scaffolding + validar acesso ao SDK

**Objetivo:** entender o ambiente real, montar o esqueleto do repositório e confirmar cedo que o `@urbiverso/sdk` instala. Nenhuma regra de negócio ainda.

**Leia antes (não pule — é a fundação de tudo):**
- No monorepo `UP-Urbita/urbiverso`: `docs/shell/banco-de-dados.md`, `docs/shell/permissoes.md`, `docs/shell/ui.md`, `docs/shell/nucleo.md`, `docs/shell/eventos.md`, `docs/shell/documentacao.md`, `docs/shell/ia.md` e `sdk/README.md`.
- Em `apps/`: identifique e leia **um app que usa permissão por membership** (procure OKRs e Recrutamento — a spec diz que o modelo de permissão desta app espelha os dois). Entenda como ele estrutura `manifesto.json`, `schema.json`, `backend/rotas.ts` e `frontend/index.ts`, como faz enforcement de membership, e como registra o web component. **Este app é seu molde vivo.**
- Neste repo: `README.md` e `docs/spec/estudo-de-viabilidade-spec.md` (leitura completa da spec).

**Construa (scaffolding do repo, app na raiz):**
- `package.json` conforme o modelo do README (name `viabilidade-real-estate`, `type: module`, script `build` com o esbuild canônico dos dois bundles, `express`+`lit` em dependencies, `@urbiverso/sdk@0.50.3`+`esbuild` em devDependencies). Confirme a versão exata do SDK contra `sdk/README.md` / releases do monorepo.
- `.npmrc` com `@urbiverso:registry=https://npm.pkg.github.com`.
- `tsconfig.json` para Lit (bloco canônico do README).
- `.gitignore` (ignore build artifacts: `backend/rotas.js`, `frontend/index.js`, `dist/`, `node_modules/`).
- `.github/workflows/release.yml` disparando em tags `*-v*` (modelo do guia de autoria, adaptado para app na raiz: `pnpm build` e `pnpm exec urbi-empacotar viabilidade --dir .`; validação da versão da tag contra `manifesto.versao`).
- Esqueleto de pastas: `backend/`, `frontend/`, `migracoes/` (vazio), `docs/viabilidade/`.
- `PROGRESSO.md` inicial (memória entre sessões): seção por etapa, com "concluído / decisões / pendências".

**Validação crítica de acesso ao SDK (faça logo):**
- Rode `pnpm install` (ou `npm install`) e confirme que `@urbiverso/sdk` baixa do GitHub Packages.
- **Se falhar com erro de autenticação de packages:** PARE. Reporte que é necessário um PAT com escopo `read:packages` (no `~/.npmrc` local e como secret no repo para o CI). Não prossiga.
- Se instalar, siga.

**Não faça:** nenhuma tabela, rota, tela ou lógica de negócio ainda. Só o esqueleto.

**Feche:** `pnpm build` deve rodar sem erro sobre arquivos-stub mínimos (crie um `backend/rotas.ts` e `frontend/index.ts` mínimos só para o build compilar). Commite (`chore(etapa-0): scaffolding e recon`). Atualize `PROGRESSO.md` anotando: versão real do shell encontrada, nome/caminho do app de referência lido, e resultado do teste de instalação do SDK.

---

# ETAPA 1 — `schema.json` + `manifesto.json`

**Objetivo:** a fundação de dados e a declaração da app. Sem backend/frontend ainda.

**Leia antes:** `docs/shell/banco-de-dados.md` (tipos de coluna, `id_legivel`, `acesso_externo`, referências, `campos_incluir`), a seção 6.1 da spec (tabelas e regras de precisão), 6.6 (deps do Núcleo), 6.9 (eventos) e 2 (roles).

**Regras de precisão (aplicar em todo o schema):**
- Monetário (R$) e área (m²): `decimal`, precisão 12, escala 2.
- Percentual digitado/default: `inteiro` (sem decimais).
- Percentual calculado: `decimal`, precisão 5, escala 1.

**Construa `schema.json`** com as 6 tabelas (colunas exatas conforme spec §6.1):
- `estudos` — inclui `id_legivel` (único), `nome_exibicao`, `nome`, `tipo_empreendimento` (loteamento/incorporacao), `uf` (limite 2), `nivel_analise` (preliminar/avancado), `status` (rascunho/em_analise/aprovado/reprovado/arquivado), `autor_id` (referência `shell.usuarios`, `campos_incluir: ["nome as autor_nome"]`), `origem_terreno` (nucleo/manual), `terreno_manual_nome`, `terreno_manual_area`, `notas` (texto_longo), `sujeito_ret` (booleano default false), `imposto_percentual` (inteiro default 7), `considerar_custo_terreno` (booleano default true), os campos numéricos de produto/custos/áreas (todos com a precisão acima), e `sensibilidade_variacao_positiva_pct` / `sensibilidade_variacao_negativa_pct` (inteiro, null = usa benchmark). `id_legivel` template: `"{tipo_empreendimento_sigla} - {nome} - {uf} - {sequencia}"` (sequência incrementa por `tipo_empreendimento`).
- `estudo_imoveis` (N:M): `estudo_id` (ref estudos), `imovel_nucleo_id` (inteiro), `tipo_imovel` ('gleba'/'lote'), único composto `[["estudo_id","imovel_nucleo_id"]]`.
- `estudo_membros`: `estudo_id`, `usuario_id` (ref `shell.usuarios`, `campos_incluir: ["nome as usuario_nome"]`), `funcao` (leitor/editor/aprovador), único `[["estudo_id","usuario_id"]]`.
- `benchmarks`: `tipo_empreendimento`, `campo`, `valor` (decimal 10,2), `regra_comparacao` (atingir_ou_superar/nao_exceder), `variacao_positiva_pct`, `variacao_negativa_pct`, único `[["tipo_empreendimento","campo"]]`, `acesso_externo: "restrito"`.
- `apelo_comercial`: `estudo_id`, `resultado` (json), 6 colunas de score por fator (decimal 3,1) + `score_geral` (decimal 3,1).
- `apelo_comercial_documentos`: `apelo_id`, `documento` (arquivo — mimes PDF/Word/Excel conforme spec), `tipo_dado`, `texto_adicional` (texto_longo).
- **`acesso_externo: "restrito"`** em: `estudos`, `estudo_membros`, `benchmarks`, `apelo_comercial`, `apelo_comercial_documentos`.

**Construa `manifesto.json`:**
- `nome`, `versao` `"0.1.0"`, `descricao` (uma linha), `shell_min` `"0.50.3"`.
- `roles` conforme spec §2 (leitura: `leitor`; escrita: `editor`; admin: `aprovador` com sticker `fa-solid fa-stamp`, cor `#D4860B`).
- `nav` para a app (entrada no menu; confirme o formato lendo o app de referência).
- `ia: true`.
- `eventos`: os 3 da spec §6.9 (`estudo_criado`, `estudo_status_alterado`, `apelo_comercial_concluido`) com campos, `conteudo`, `api`, `rota` exatos.
- `parametros` (config admin, spec §6.5): alíquota não-RET default 7, alíquota RET default 4, corretagem default 5, percentuais de indiretos, prazo de arquivamento default 30 dias, **e `id_gleba_excluida` (ID da Fazenda Paranoazinho) — vazio por default**, usado no filtro de glebas.
- `dependencias_nucleo: ["imoveis"]` e `permissoes_nucleo: { "imoveis": ["ler"] }`.
- Declare só o que a app usa; confira cada campo do manifesto contra o app de referência e `docs/shell`.

**Não faça:** nenhuma rota nem tela. Nenhum seed em migração (schema.json é o genesis).

**Valide:** o schema é declarativo — confira estrutura contra `banco-de-dados.md` e contra o schema do app de referência. `pnpm build` continua verde.

**Feche:** commit `feat(etapa-1): schema e manifesto`. Atualize `PROGRESSO.md`.

---

# ETAPA 2 — Backend núcleo (`backend/rotas.ts`, parte 1)

**Objetivo:** CRUD de estudos, membros, ciclo de status e proxy do Núcleo. Tudo por **rotas customizadas** (a API genérica não serve — spec §6.8).

**Leia antes:** `docs/shell/permissoes.md` (as 4 camadas; foco na 4ª — membership), `docs/shell/nucleo.md` (API de imóveis: como listar glebas/lotes, a relação lote→parcelamento, formato de resposta), `docs/shell/eventos.md` (`req.eventos.publicar()`), e o `backend/rotas.ts` do app de referência (padrão de router, enforcement de membership). Spec §3 (ciclo de vida), §4.3 (relação imóvel↔estudo), §6.6 e §6.8.

**Construa (rotas relativas — o shell prefixa `/api/viabilidade/`):**
- Topo: `import '@urbiverso/sdk/express'` para tipar `req.*`. `export const rotas: Router = Router()`.
- **Enforcement de membership** (helper reutilizável): cada operação valida a `funcao` do usuário no estudo (leitor/editor/aprovador) conforme spec §2. Leitor não vê Rascunho/Arquivado.
- `GET /estudos` — lista **filtrada por membership** (só estudos onde o usuário é membro), com os campos que o Dashboard precisa (spec §5.1).
- `POST /estudos` — cria estudo + membros iniciais; gera `id_legivel`/`nome_exibicao` com a sequência por `tipo_empreendimento`; grava `origem_terreno` e, se `manual`, `terreno_manual_*`; se `nucleo`, cria vínculos em `estudo_imoveis` (validando `tipo_imovel` vs `tipo_empreendimento`). **Publica evento `estudo_criado`.**
- `GET/PATCH/DELETE /estudos/:id` — detalhe, atualizar, remover (respeitando editabilidade por perfil/status da spec §5.2; imóvel vinculado só é editável em Rascunho — restrição **absoluta**, mesmo para aprovador).
- `POST /estudos/:id/duplicar` — duplica estudo (spec §5.1 ações).
- `POST /estudos/:id/status` — transição de status com **validação das regras** da máquina de estados (spec §3: quem submete, quem aprova/reprova/devolve). **Publica `estudo_status_alterado`.**
- `GET/POST /estudos/:id/membros` — gerenciar membros do estudo.
- **Proxy do Núcleo** (spec §6.6): `GET /nucleo/glebas` (exclui a gleba cujo ID = parâmetro `id_gleba_excluida`, se preenchido; senão mostra todas), `GET /nucleo/lotes` (exclui lotes contidos em Parcelamentos, usando a relação já existente no Núcleo), `GET /nucleo/imoveis/:id`. O único dado que interessa do imóvel é `area` (+ nome para exibição).

**Não faça:** benchmarks, preço sugerido, IA, exportação (são Etapa 3). Nenhum frontend.

**Valide:** `pnpm build` gera `backend/rotas.js` **self-contained** (sem `import ... from` externo remanescente; deps embutidas; banner `createRequire` presente). Confirme que o build não usou `--packages=external`.

**Feche:** commit `feat(etapa-2): backend nucleo — estudos, membros, status, proxy`. Atualize `PROGRESSO.md` (incluindo o formato real da API do Núcleo que você descobriu).

---

# ETAPA 3 — Backend regras (`backend/rotas.ts`, parte 2)

**Objetivo:** benchmarks (admin), cálculo do Preço Sugerido/m², IA de apelo comercial, exportação e arquivamento automático.

**Leia antes:** `docs/shell/ia.md` (framework de IA: `req.ia.extrairConteudo()`, `req.ia.consultar()`, slots `arquivos`/`normal`, schema JSON estruturado), e as seções da spec: §4.6 (benchmarks), §1 e §4.6 (preço sugerido/m²), §6.7 (IA — 6 fatores × 4 perguntas, prompts, scoring, output), §6.2 (fórmulas da Proforma — necessárias para o cálculo do preço sugerido), §6.3 (exportação), §3 (arquivamento).

**Construa:**
- **Benchmarks:** `GET/POST/PATCH/DELETE /benchmarks` — CRUD **admin-only** (tabela `restrito`). Um conjunto por `tipo_empreendimento`. Indicadores do MVP conforme spec §4.6 (Margem bruta, Margem líquida, ROI, Custo Obras/VGV, Eficiência de aproveitamento [só Loteamento], Resultado final [piso do preço sugerido]).
- **Preço Sugerido/m²:** função/rota que calcula o **menor preço de venda/m²** que faz o **resultado final (%) ≥ piso do benchmark**, a partir das premissas já preenchidas. **Valor único** mesmo para Incorporação (média simples sobre toda a área vendável). É informativo. Reaproveite as fórmulas da Proforma (§6.2) — considere expor o motor de cálculo de forma que frontend e backend usem a mesma lógica, evitando divergência.
- **IA — Apelo Comercial:** `POST /estudos/:id/apelo-comercial`. Fluxo: recebe/lê documentos e texto adicional → `req.ia.extrairConteudo()` (slot `arquivos`) nos PDFs/Excel → `req.ia.consultar()` (slot `normal`) com prompt contextualizado por `tipo_empreendimento`, as 6 categorias × 4 perguntas-guia (§6.7), abordagem comparativa/contextual, notas 1–5 → parse do **schema JSON estruturado** da §6.7 → calcula scores por fator (média das 4) e `score_geral` (média das 24) → grava em `apelo_comercial` (+ colunas de score). **Publica `apelo_comercial_concluido`.**
- **Exportação:** `GET /estudos/:id/exportar/:formato` (pdf|excel), disponível a partir do status **em_analise**. Três conteúdos (§6.3): estudo completo, comparação de cenários, análise de sensibilidade. (O **layout** de referência entra na Etapa 7; aqui, estruture a geração e os dados; deixe o layout final parametrizável.)
- **Arquivamento automático:** estudos parados (qualquer status exceto `aprovado`) por 30 dias → `arquivado`. Implemente conforme o padrão do shell (rotina/cron do framework, se existir; senão, checagem no boot/consulta). Prazo vem do parâmetro configurável.

**Não faça:** frontend. Não reescreva as rotas da Etapa 2.

**Valide:** `pnpm build` self-contained OK. Confirme que a chamada de IA segue exatamente as assinaturas de `req.ia.*` do `ia.md` (não invente nomes de método/slot).

**Feche:** commit `feat(etapa-3): backend regras — benchmarks, preco sugerido, IA, exportacao, arquivamento`. Atualize `PROGRESSO.md`.

---

# ETAPA 4 — Frontend base (`frontend/index.ts`: Dashboard + Terrenos)

**Objetivo:** o web component raiz, o Dashboard (tabela de estudos) e a aba de Imóveis. Ainda sem o detalhe do estudo.

**Leia antes:** `docs/shell/ui.md` (componentes `urbi-*`, tokens CSS, como registrar o web component e navegar), o `frontend/index.ts` do app de referência, e spec §5.0 (navegação), §5.1 (Dashboard), §5.3 (Imóveis), §6.4 (componentes). Consulte a skill de design de frontend do ambiente se disponível, mas **priorize os tokens e componentes do design system do UrbiVerso** — a app deve parecer nativa da plataforma, não um tema à parte.

**Construa:**
- `@customElement('app-viabilidade')` (Lit). Carregamento via `import()` dinâmico quando o usuário navega para `/viabilidade`.
- **Dashboard** com abas/guias **Estudos** e **Terrenos**. Escolha de criar **Estudo Preliminar** (ativo) e **Estudo Avançado** (desabilitado até v2).
- **Tabela de estudos** (`urbi-tabela`) com as colunas da §5.1: id_legivel, tipo, imóvel(is) (badges), área do imóvel (soma), área de venda total, VGV, resultado, margem, status (`urbi-badge` colorido), data. Filtros: `tipo_empreendimento`, `status`. Ações: criar, duplicar, remover.
- **Fluxo de criação** (§5.0): escolher nível (Preliminar), tipo (Loteamento/Incorporação), **origem do terreno** (Buscar terreno = `nucleo` / Inserir novo = `manual`) — single-select, determina os dados base. Chama `POST /estudos`.
- **Aba Terrenos/Imóveis** (§5.3): lista filtrada por subtipo (glebas p/ Loteamento, lotes p/ Incorporação, via `GET /nucleo/*`); cada imóvel mostra em quantos/quais estudos é usado; acesso ao detalhe.
- Todas as chamadas via `urbiVerso.api('/viabilidade/...')`. Componentes `urbi-*` pela tag (`import type` apenas). Tokens CSS do design system.

**Não faça:** o detalhe do estudo com as abas Premissas/Proforma/Gráficos (Etapas 5–6).

**Valide:** `pnpm build` gera `frontend/index.js` externalizando `@urbiverso/ui`. Typecheck verde (Lit decorators funcionando — confira o tsconfig).

**Feche:** commit `feat(etapa-4): frontend base — dashboard e terrenos`. Atualize `PROGRESSO.md`.

---

# ETAPA 5 — Frontend aba Premissas

**Objetivo:** a tela de detalhe do estudo com a aba **Premissas** completa (formulário + KPI grid + preço sugerido). As outras abas ficam como stubs.

**Leia antes:** spec §5.2 (aba Premissas, editabilidade por perfil), §4.4 (estrutura de custos/receitas, toggles, checkboxes), §4.5 (framework de áreas — Loteamento por % da gleba; Incorporação PVT R/NR Aberta/Fechada), §4.6 (benchmarks/sinalização), §1 (preço sugerido). `docs/shell/ui.md` para `urbi-abas`, `urbi-kpi`, `urbi-wrap`, `urbi-input`, `urbi-input-numero`, `urbi-botao`, `urbi-banner`, `urbi-card`.

**Construa (detalhe do estudo):**
- Container `urbi-abas` com **Premissas / Proforma / Gráficos**. **Preserve o DOM ao trocar de aba** (não destruir/recriar) — é requisito para manter o estado transiente dos cenários (Etapa 6).
- **Aba Premissas — formulário:**
  - **Terreno** conforme origem: *Buscar terreno* → dropdown de gleba (single) ou lotes (multi), área em **modo leitura** (do Núcleo); *Inserir novo* → campos editáveis de nome e área (sem dropdown). Dados do imóvel em `urbi-card` (leitura).
  - **Produto:** tipologia, áreas (PVT R/NR Aberta/Fechada p/ Incorporação; % da gleba p/ Loteamento — sistema viário default 25%), preços por m².
  - **Custos:** categorias com **toggle de modo de entrada** (dois `urbi-botao variante="texto"` agrupados, §4.4): Infraestrutura (Lot: R$/m² ↔ %VGV default 30%), Projetos, Licenciamento, Permuta física. **Checkbox "considerar" no custo do terreno** (desmarcado → terreno = 0).
  - **Impostos:** checkbox RET (marcado → 4% fixo; desmarcado → editável default 6,73%/campo `imposto_percentual`).
  - **Defaults sempre editáveis** (30% infra, 25% viário, etc.), pré-preenchidos e já influenciando as fórmulas.
- **Regras de precisão nos inputs** (§4.4): R$/m² com 2 casas; % digitado sem casas; % calculado com 1 casa.
- **KPI grid ao final** (`urbi-kpi` em `urbi-wrap`, auto fit), atualizando em **tempo real**. Itens da §5.2 por tipo (Loteamento vs Incorporação), com sinalização de benchmark (verde/vermelho) onde a spec indica.
- **Preço Sugerido/m²** ao final do formulário (texto informativo): valor único mínimo para atingir o piso de resultado final do benchmark, calculado a partir das premissas.
- **Editabilidade por perfil/status** (§5.2): editor edita tudo exceto quando Aprovado/Reprovado; aprovador edita qualquer campo (exceto imóvel fora de Rascunho); demais veem campos bloqueados.

**Não faça:** cálculo completo da Proforma, cenários, sensibilidade, gráficos (Etapa 6). Deixe as abas Proforma/Gráficos como placeholders.

**Valide:** `pnpm build` OK, typecheck verde. KPI grid recalcula ao editar (lógica de cálculo no frontend).

**Feche:** commit `feat(etapa-5): frontend premissas`. Atualize `PROGRESSO.md`. **Nota:** se você criar um módulo de cálculo compartilhado (fórmulas da Proforma) para o KPI e o preço sugerido, documente-o — ele será reusado inteiro na Etapa 6.

---

# ETAPA 6 — Frontend aba Proforma + aba Gráficos

**Objetivo:** o motor de cálculo da Proforma em tempo real, comparação de cenários, análise de sensibilidade e os dois gráficos do MVP.

**Leia antes:** spec §6.2 (todas as linhas e fórmulas da Proforma), §4.4 (resultado/margem), §5.2 (Proforma: KPI de topo, comparação de cenários, sensibilidade Bear/Base/Bull), §5.2 aba Gráficos (§ pizza + colunas), §4.6 (benchmarks/faixas). `docs/shell/ui.md` para `urbi-tabela`, `urbi-grafico-pizza`, `urbi-grafico-colunas`, `urbi-kpi`.

**Construa:**
- **Aba Proforma — KPI grid de topo** (§5.2): área vendável, preço médio da unidade, nº de unidades, área/valor permutado (**condicional:** só se permutas > 0), Custo Obras/VGV (com benchmark, verde/vermelho), Margem líquida (com benchmark) — mesmo valor da última linha da Proforma.
- **Proforma** (`urbi-tabela`): todas as linhas e fórmulas da §6.2 (Receita/VGV, Deduções, Custos Diretos, Custos Indiretos, Resultado, Margem), calculadas **no frontend em tempo real**. Reuse o motor de cálculo da Etapa 5 (não duplique fórmulas). Exclusividades por tipo (ex.: Outorga/Decoração só Incorporação; Infraestrutura só Loteamento).
- **Botão "Salvar"** — persiste os inputs (via `PATCH /estudos/:id`). A Proforma em si é derivada; o backend guarda inputs.
- **Comparação de cenários** (§5.2): "Salvar cenário" → snapshot **transiente em memória** (não persiste no BD); segundo cenário; exibição lado a lado + **terceira coluna com variação %** (cenário 2 vs 1). Sempre **máx. 2 cenários**. Botão "Exportar comparação". Cenários se perdem ao fechar a página (por isso o `urbi-abas` preserva DOM).
- **Análise de sensibilidade** (§5.2): botão exibe/esconde. Campos estressáveis do MVP (Preço/m² [Incorporação: 2], permuta física, permuta financeira, custo infra [Lot], custo obras [Inc]). Faixas ± vêm do **benchmark** (default) mas podem ser **sobrescritas por estudo** (`sensibilidade_variacao_*_pct`). Tabela 3 colunas **Bear | Base | Bull** (Bull = base×(1+var+); Bear = base×(1−var−)). **Unidimensional** (uma variável por vez). Botão "Exportar análise de sensibilidade".
- **Aba Gráficos** (§5.2, dois gráficos, independentes do tipo): `urbi-grafico-pizza` = composição de custos, com **flag/checkbox para excluir o custo de aquisição do terreno**; `urbi-grafico-colunas` = 2 séries (total de receita e total de custos), uma barra cada.

**Não faça:** o layout final dos relatórios exportados (Etapa 7 — só ligue os botões às rotas de exportação da Etapa 3, o polimento visual do PDF/Excel vem depois). UI de IA e de benchmarks são Etapa 7.

**Valide:** `pnpm build` OK. Confira alguns números da Proforma manualmente contra as fórmulas da §6.2 (ex.: um Loteamento e uma Incorporação de exemplo) para pegar erros grosseiros de fórmula.

**Feche:** commit `feat(etapa-6): frontend proforma, cenarios, sensibilidade e graficos`. Atualize `PROGRESSO.md`.

---

# ETAPA 7 — Exportação (layout) + UI de IA + UI de Benchmarks + docs + empacotamento final

**Objetivo:** fechar o MVP — relatórios com layout profissional, a interface do apelo comercial, a administração de benchmarks, a documentação do app e o pacote validado.

**⚠️ Anexe agora, no chat, a imagem `referencia-relatorio-viabilidade.png`.** Ela é a referência visual do layout dos relatórios.

**Leia antes:** `docs/shell/documentacao.md` (framework de documentação — **obrigatório seguir**), `docs/shell/ia.md` e `docs/shell/ui.md` novamente para a UI. Spec §6.3 (exportação), §6.7 (IA — output/scoring/fontes), §4.6 (benchmarks), §6.10 (docs a criar).

**Construa:**
- **Layout dos relatórios** (PDF e Excel), a partir da imagem de referência. Replique a **organização e hierarquia visual** (não os valores): estrutura em **blocos separados** (Premissas do Terreno / Produto / Custos / Resultado); **quadro-resumo de indicadores** no topo; **tabela de Proforma linha a linha com subtotais destacados**; cores sóbrias nos totais e sinalização **verde/vermelho** de benchmark; **cabeçalho** com identificação do estudo (id_legivel, tipo, data). Três relatórios: estudo completo, comparação de cenários, análise de sensibilidade. Ligue-os aos botões da aba Proforma e às rotas da Etapa 3. Disponível a partir de `em_analise`.
- **UI de Apelo Comercial** (por estudo): upload de documentos (PDF/Word/Excel) + campo de texto adicional (ex.: população); botão que dispara `POST /estudos/:id/apelo-comercial`; exibição dos **6 fatores** com notas por pergunta + justificativas, score por fator e `score_geral`, e o **relatório geral** (vantagens/desvantagens/ganhos/riscos). Estados de loading/erro na voz da interface.
- **UI de Benchmarks (admin)**: tela para o admin definir/editar os benchmarks por `tipo_empreendimento` (valor-alvo, regra de comparação, faixas ± de sensibilidade). Só visível/editável para admin.
- **Documentação do app** em `docs/viabilidade/` seguindo `documentacao.md` (§6.10): `visao-geral.md`, `modelo-de-dados.md`, `formulas.md`, `benchmarks.md`, `apelo-comercial.md`, `permissoes.md`, `exportacao.md`.

**Empacotamento final:**
- `pnpm build && pnpm exec urbi-empacotar viabilidade --dir .` → deve gerar `dist/viabilidade-0.1.0.urbiapp.tgz` + `.sha256`, **passando** nas validações do empacotador (manifesto ok, obrigatórios presentes, nenhum `.ts` vazado, `backend/rotas.js` self-contained).
- Se o empacotador acusar algo, corrija até passar limpo.

**Valide (checklist final do MVP):** build verde; pacote validado; nenhum `.ts`/`node_modules`/`package.json` no tarball; `manifesto.versao` == `0.1.0`; backend self-contained confirmado; docs criadas.

**Feche:** commit `feat(etapa-7): exportacao, IA UI, benchmarks UI, docs e pacote`. Atualize `PROGRESSO.md` com o estado final e um checklist do que está pronto vs. o que ficou para v2. **Não crie a release/tag automaticamente** — deixe o autor revisar e disparar `viabilidade-v0.1.0` quando quiser (o workflow de CI cuida do resto ao receber a tag).

---

## Encerramento

Ao fim da Etapa 7, o repositório contém uma app UrbiVerso `viabilidade` completa no escopo MVP, empacotável e pronta para instalar via UI admin (upload do tarball ou release do repo). O `PROGRESSO.md` documenta o caminho e as pendências de v2.

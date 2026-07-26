# PROGRESSO — App `viabilidade`

Memória entre sessões. Uma etapa por sessão. Atualizar ao fim de cada etapa.

---

## Auditoria da rodada 3 — issues #160, #161, #162 (2026-07-26)

Branch `claude/analyze-unimplemented-prs-79s2to-f0axc2`. Três consertos, **100% frontend/infra**
— sem backend, sem schema, sem migração. `versao` do `manifesto.json` **intacta** (regra do
CLAUDE.md: `z` só bumpa quando entra migração nova).

A auditoria das 62 issues da rodada 3 (#71–#132) achou 3 coisas dadas como entregues sem terem
sido. Um commit por issue, nesta ordem (#160 antes de #162 de propósito: o guard que o #162
adiciona nasce verde porque as aspas já foram corrigidas).

- **#160 — aspas curvas em posição de atributo (reabre #71).** `tela-premissas.ts:466,469`
  tinham `variante=”alerta”` e `class=”form-acoes”` com `”` (U+201D). O parser inclui as aspas
  no valor (`”alerta”`), o valor não casa com nada e o atributo fica **inerte**: o banner de
  "alterações não salvas" renderizava sem cor e a regra `.form-acoes` não aplicava, desalinhando
  o botão "Salvar premissas". Trocado por aspas retas. As aspas curvas em **conteúdo de texto**
  (linha 467, `“Salvar premissas”`) são tipografia legítima e ficaram intactas.
- **#161 — variante inerte no botão "Fluxo de Pagamento" (reabre #91).**
  `tela-fluxo-receitas.ts:275` usava `variante="info"`. Conferido na fonte de verdade
  (`ui/src/urbi-botao.ts` no monorepo): `urbi-botao` declara só
  `primario | secundario | perigo | sucesso | fantasma`. `info` é de `urbi-banner`, outro
  primitivo; `texto`, que a spec cita, **também não existe**. O `render()` joga o valor cru em
  `class`, então saía `class="info"`, sem regra CSS → botão só com o estilo base, sem fundo.
  Trocado por **`secundario`** — e não `primario` — porque o gradiente de `.primario` começa em
  `#2AA9E0`, idêntico ao `--cor-info` da bola de status "ok" que o próprio botão contém (a bola
  sumiria no fundo), e porque o botão irmão "Absorção de Vendas" já é `primario`.
- **#162 — guards contra reincidência.** Guard de aspas curvas como etapa **1/5** de
  `scripts/validar-frontend.sh` (etapas renumeradas) + workflow novo `.github/workflows/
  pr-guards.yml`, que barra PR com **diff vazio** que declara fechar issue, e replica o guard de
  aspas no CI. O workflow é só `git` + `grep`: **não** roda `pnpm install` nem a suíte completa,
  porque o `@urbiverso/sdk` é privado e o `GITHUB_TOKEN` deste repo toma 401 (só o `release.yml`
  tem o PAT). Assim o guard nunca fica vermelho por falta de credencial.

### A lição — o que passou por typecheck/teste/build e mesmo assim estava quebrado

Os dois bugs de UI (#160 e #161) são a **mesma classe de falha**: um valor inválido dentro de um
template literal do `lit`. Nada nessa cadeia enxerga isso —

- `tsc --noEmit` trata o interior de `` html`...` `` como string, não como HTML;
- o `variante` de um primitivo é `@property()`, então em runtime aceita **qualquer** string: o
  tipo TS é só compile-time e o app nem importa o primitivo (usa o global `window.urbiVerso`);
- os testes cobrem funções puras (motor, conversões), não render;
- o esbuild empacota, não valida markup.

O sintoma comum é o do CLAUDE.md: **atributo inexistente não dá erro, só não faz nada** — falha
silenciosa. Foi por isso que uma sessão inteira fechou #71 "validado ✓": leu a string `alerta` no
código e não viu as aspas ao redor. Daí o guard 1 ser um `grep`, não um linter: é a única coisa
que olha o *texto* do template.

O terceiro (#162) é de processo: o PR #142 (`e19d691`) foi mergeado com diff **literalmente
vazio** — zero arquivos — enquanto a mensagem descrevia 12 mudanças item a item e afirmava
`typecheck ✓ · testes 77/77 ✓ · build ✓`, com `Closes #91…#102`. O GitHub fechou as 12 sozinho.
Nove foram recuperadas depois; **a #91 ficou perdida** até esta auditoria. Nenhuma validação de
código pega isso, porque não havia código: o guard tem que ser no PR. Verificado localmente que
o `pr-guards.yml` bloqueia exatamente esse cenário e deixa passar PR com mudança real.

Corolário para as próximas sessões: **"fechou a issue" não é evidência de entrega — o diff é.**

### Varredura complementar (aproveitando o monorepo conectado)

Conferidos **todos** os atributos usados nos 24 primitivos `urbi-*` deste app contra o que cada
um declara em `ui/src/`, seguindo herança de classe-base. **Nenhum outro atributo inerte.** Os 10
candidatos que a varredura levantou são todos legítimos: `categorias`/`series`/`formato`/
`legenda`/`empilhado` dos gráficos vêm de `UrbiGraficoBase`, e `expandir` (`urbi-abas`,
`urbi-tabela`) é convenção de atributo lida no `connectedCallback()` de `UrbiPrimitivoDeLayout` e
usada como `:host([expandir])` em `UrbiPrimitivoDeConteudo` — não é `@property`, mas é suportado.
Os 3 casos conhecidos (`urbi-badge ?desabilitado`, `urbi-input estilo="compacto"` e este `#161`)
já estão todos corrigidos.

### Validação

`bash scripts/validar-frontend.sh` verde nos três commits (typecheck + 94/94 testes + build).
O guard novo foi testado nos **dois** sentidos: passa na árvore limpa e falha com exit 1
apontando `arquivo:linha` quando a aspa curva é reintroduzida. **Não exercido aqui** (exige o SDK,
fica para o ambiente autenticado do autor): typecheck de backend, `pnpm test` completo e
`urbi-empacotar`. Nenhuma das três mudanças toca backend ou schema.

---

## Lotes de bugs 2026-07-20 (sessões por lote — `docs/lotes-bugs-2026-07-20.md`)

### Lote 1 — Trivial Preliminar — ✅ CONCLUÍDO (issues #9, #10, #11, #12, #13)
Branch `claude/issues-lote-1-76fyc5`. Todas as mudanças **100% frontend** — sem schema,
sem backend, sem migração; `versao` intacta em 0.1.0.

- **#9 (R$/m² sem notação contábil):** novo `_fmtContabilM2(r, p)` em `tela-proforma.ts`,
  análogo a `_fmtContabil` mas com sufixo `/m²` e **sem prefixo "R$"** (antes usava `fmtR$`,
  que injeta "R$"): custos/deduções entre parênteses, receita plana, resultado pelo sinal
  real; `—` quando área vendável ≤ 0. Aplicado na 3ª coluna da tabela, agora com a mesma
  classe de sinal (`pos`/`neg`) do resultado. Método antigo `_rsM2` removido.
- **#10 (Receita Bruta sem destaque):** CSS de `.pf tr.receita td` igualado ao `resultado`
  em peso/tamanho/destaque (`font-weight: 800; font-size: 1.05rem;` + fundo
  `var(--cor-primaria-fundo)`), **mantendo a cor azul primária** que distingue Receita de
  Resultado. Aplica-se a todas as linhas-receita (VGV bruto, Receita bruta, líquida,
  operacional) — a mais proeminente delas é a Receita Bruta (VGV).
- **#11 (sensibilidade sem distinção receita×despesa):** cada linha da análise de
  sensibilidade ganhou `natureza: 'receita' | 'despesa'`; a `<tr>` recebe classe
  `nat-receita`/`nat-despesa`. CSS **só com tokens** (color-mix preserva o token, zero cor
  literal): 1ª coluna colorida por `var(--cor-sucesso)` (receita) / `var(--cor-erro)`
  (despesa) e fundo da linha com `color-mix(... 8%, transparent)`. Classificação: VGV,
  Receita bruta/líquida/operacional, Resultado e Margem líquida = receita; Custo direto
  total, Custo indireto total e Custo obra/VGV = despesa.
- **#12 (badge Preliminar amarelo):** `cor="padrao"` → `cor="alerta"` (token amarelo já
  usado no app e presente em `CorBadge` de `viab-shared.ts`) nos dois pontos:
  `tela-dashboard.ts` (coluna Nível) e `tela-estudo.ts` (cabeçalho do estudo). Avançado
  segue `info` (azul).
- **#13 (remover botão "Criar indicadores padrão" + auto-seed):** removido o botão do topo
  e o método `_semear` de `viabilidade-config-benchmarks.ts`. **Auto-seed silencioso** no 1º
  acesso dentro de `_carregar`: se a lista vier vazia, não for `somenteLeitura` e o seed ainda
  não tiver sido tentado (flag `_semeadoTentado`), chama `semearBenchmarks()` (idempotente,
  admin-only no backend) e recarrega. Guarda evita re-semear ao alternar de tipo. Mensagens
  de tabela vazia que citavam o botão foram neutralizadas.
- **#24 — permanece BLOQUEADA (aguarda print).** `taxa_desconto_aa` só é renderizado em
  `tela-fluxo.ts` (exclusivo do Avançado); o bug não se reproduz no código atual. Sem print,
  não há o que corrigir — issue mantida aberta.
- **Validação neste ambiente:** o `@urbiverso/sdk` é gated por GitHub Packages (auth
  indisponível → 401), então backend/typecheck-completo/`urbi-empacotar` não rodam aqui. Como
  as mudanças são 100% frontend (que **não** importa o SDK, usa o global `window.urbiVerso`),
  validei o frontend isolado com as deps públicas do store pnpm: **typecheck frontend ✓
  (exit 0)** · **testes frontend 70/70 ✓** · **build do bundle frontend (esbuild) ✓**.
  Empacotamento/backend a validar no ambiente do autor (autenticado).

### Lote 2 — Bug de sobreposição no Fluxo de Caixa — ✅ CONCLUÍDO (issue #14)
Branch `claude/issues-lote-2-iy51q4`. Mudança **100% frontend** (só CSS), sem schema/backend/
motor; `versao` intacta.

- **#14 (sobreposição ao rolar a tabela horizontalmente — `tela-fluxo-ver.ts`):** as 5 colunas
  sticky (`.c1`–`.c5`) tinham `left` fixos (0 · 220 · 292 · 356 · 476) mas larguras **não
  travadas** — `.c1` com `min-width:180 / max-width:220` e `.c2`–`.c5` só com `min-width`. Duas
  falhas daí: (a) com nome de linha curto a `.c1` encolhia abaixo do passo de 220px e abria um
  **vão** por onde as colunas de meses vazavam ao rolar (a "sobreposição" reportada — bleed-through,
  não overlap de sticky); (b) valores grandes em Total/VPL faziam `.c4`/`.c5` **crescerem além do
  passo** e invadirem a coluna vizinha (o `left` da seguinte é fixo). **Fix:** travar cada coluna
  com `width = min-width = max-width` + `box-sizing: border-box` + `overflow: hidden`, nos valores
  exatos que os passos de `left` já assumiam (220/72/64/120/120 → cumulativo 0·220·292·356·476, fim
  596). Assim a largura real de cada sticky bate exatamente com o `left` da próxima: sem vão, sem
  crescimento, sem sobreposição. Ellipsis mantido na `.c1` (nomes longos truncam como antes).
- **Nota (armadilha do template):** o comentário CSS vive dentro do tagged template ``css`…` `` —
  um backtick literal no texto fecha o template e quebra o typecheck. Comentário reescrito sem
  backticks (usa aspas).
- **Validação neste ambiente:** frontend isolado (deps públicas do store pnpm) — **typecheck ✓ ·
  testes 70/70 ✓ · build do bundle (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde).
  Empacotamento/backend não se aplicam (mudança puramente de CSS de frontend).

### Lote 3 — Reestruturação de abas do Avançado (FUNDAÇÃO) — ✅ CONCLUÍDO (issue #15)
Branch `claude/issues-lote-3-kz6rmc`. Mudança **100% frontend** (novos componentes + roteamento
de abas), sem schema/backend/motor; `versao` intacta.

- **Decisão de transição (confirmada com o autor):** *preservar tudo no lugar* — as 7 abas de topo
  novas são criadas e cada tela EXISTENTE do Avançado é roteada para a aba correspondente, mantendo
  o Avançado 100% funcional durante a transição. Placeholders só nas sub-abas genuinamente novas
  (Informações, Tipologias), que o Lote 4 (#16) constrói. **O Preliminar fica intocado** (suas 4
  abas de sempre: Premissas · Proforma · Gráficos · Apelo).
- **Novo `frontend/tela-avancado.ts` (`viab-tela-avancado`):** as 7 abas de topo (nível 1) em
  `urbi-abas`, sincronizadas com a URL (`/detalhe/:id/:aba`; emite `viab:aba-topo` → `navegarSub`).
  Navegação de nível 2 por **`urbi-badge` interativo** (mesmo padrão da antiga aba Fluxo — estado
  interno, fora da URL). **Mapa topo → conteúdo:**
  - **Resumo** → `viab-tela-proforma` (o consolidado atual; Lote 8/#23 reconstrói)
  - **Empreendimento** → sub-nav *Informações\* · Cronograma · Tipologias\** (Lote 4/#16)
  - **Viabilidade** → sub-nav *Premissas · Receitas* (Lote 6/#19–21)
  - **Obra** → `viab-fluxo-custos` (Lote 5/#17–18)
  - **Fluxo de Caixa** → `viab-fluxo-ver`
  - **Cenários** → `viab-tela-graficos`
  - **Análise de mercado** → `viab-tela-apelo`
  - (\* = placeholder `urbi-estado-vazio` apontando o Lote 4)
- **Cronograma extraído:** o Cronograma (parâmetros + tabela de eventos + Gantt SVG) vivia embutido
  em `tela-fluxo.ts`. Foi movido **verbatim** para o novo `frontend/tela-fluxo-cronograma.ts`
  (`viab-fluxo-cronograma`), standalone, para ser hospedado em Empreendimento → Cronograma. Os
  demais sub-componentes do fluxo (`viab-fluxo-receitas`/`-custos`/`-ver`) já eram standalone.
- **`tela-fluxo.ts` removido:** era só o wrapper da antiga aba única "Fluxo de Caixa" com sub-nav;
  totalmente superado por `viab-tela-avancado`. Nenhum teste dependia dele (os testes cobrem
  motor/shared). Único import era em `tela-estudo`.
- **`tela-estudo.ts`:** o render passou a ramificar por nível — Avançado renderiza
  `<viab-tela-avancado>` (recebe `estudo` + `podeEditar` + `status` e computa os guards de edição
  como antes: premissas sem checar `arquivado`; cronograma/receitas/custos com `arquivado`; apelo
  só `podeEditar`); Preliminar mantém a `urbi-abas` de 4 abas idêntica. Setter de `aba` agora só
  guarda o valor cru; cada ramo normaliza para o seu conjunto (Avançado normaliza dentro do
  componente; URLs antigas do Preliminar caem em `resumo` no Avançado).
- **Nota de comportamento:** como todos os slots da `urbi-abas` são renderizados (padrão do
  primitivo, já era assim no Preliminar), Custos (Obra) e Ver Fluxo passam a montar junto ao abrir
  o estudo — só marginalmente mais fetches iniciais; cada componente guarda seu próprio carregamento.
  Sem impacto de correção.
- **Escopo do lote:** só a FUNDAÇÃO (a árvore de abas). O conteúdo definitivo de cada sub-aba é dos
  lotes 4–8. `matricula`/`descricao`/anexos, mês 0, tipologias, 5 abas de custo, novo modelo de
  receitas/fases, Financeiro e o Resumo consolidado **não** entram aqui.
- **Validação neste ambiente:** frontend isolado (deps públicas do store pnpm) — **typecheck ✓ ·
  testes 70/70 ✓ · build do bundle (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde).
  Empacotamento/backend não se aplicam (sem schema/backend). ⏳ Render real das abas aninhadas só
  valida no deploy dev.

### Lote 4 — Aba Empreendimento (Informações · Cronograma · Tipologias) — ✅ IMPLEMENTADO (issue #16)
Branch `claude/issues-lote-4-sx0rel`. Toca **schema + backend + frontend**. `versao` **0.1.0 → 0.1.1**
(1ª migração real do app — `migracoes/001_mes_zero_cronograma.js`).

- **Decisões de rota (o autor pediu para prosseguir sem responder às perguntas — registrado):**
  1. **Tipologias: só realocadas, mantidas ACOPLADAS às linhas de receita** (`linha_receita_id`
     segue obrigatório). O modelo de **catálogo desacoplado** é do **Lote 6 (#19)**, que exige spec
     conjunta — não pré-emptado aqui. A sub-aba apresenta as tipologias de todas as linhas numa única
     tabela; adicionar a 1ª cria uma linha de receita padrão ("Vendas") se não houver nenhuma.
  2. **`taxa_desconto_aa`: editor REMOVIDO da tela de Cronograma** (conforme #16). O valor persiste no
     schema e o motor usa o padrão 12% a.a. até a realocação (**Financeiro, Lote 7 — bloqueado**).
  3. **Mês 0 com migração de dados existentes** (forward-only, desloca −1).
- **(2) Cronograma — convenção mês 1 → 0 (mês 0 = início do projeto):** mudança sistemática no motor
  puro (`fluxo-shared.ts`, `fluxo-caixa-motor.ts`) — rótulos e índices 0-based (índice do array =
  número do mês); horizonte derivado com `+1`; `recorte` devolve o índice direto e o gate de exibição
  passou a ser por **duração** (mês 0 é válido, não pode ser falsy). Consumidores ajustados:
  `tela-fluxo-ver.ts` (eixos/marcos/payback `M+`), `tela-fluxo-cronograma.ts` (Gantt, banner, guarda
  `>= 0`), `exportar.ts` (CSV/PDF). Backend: `cronogramaPadrao` 0-based (0·6·12·17·41), validação
  `inicio_mes >= 0`, default de custo `inicio_mes 0`. Schema: `avancado_cronograma.inicio_mes` e
  `avancado_linhas_custo.inicio_mes` padrão → 0. **Migração 001** desloca em −1 os `inicio_mes`
  persistidos (cronograma + custos) e os `absorcao.meses[].mes` (absorção personalizada). NÃO toca
  `duracao_meses`, `absorcao.blocos` (por evento) nem `fluxo_pagamento` (offsets relativos). Os **18
  testes de motor/shared** foram reancorados a 0-based (70/70 verde).
- **(1) Informações:** novos campos `matricula` (texto) e `descricao` (texto_longo) em `estudos`
  (passam pelo PATCH por blocklist); nova tabela **`estudo_documentos`** (espelha
  `apelo_comercial_documentos`, FK `estudo_id` cascata, coluna `categoria` =
  imagem_principal/render/planta, `documento` tipo `arquivo` com mimes imagem+PDF). Backend novo
  `backend/rotas/empreendimento.ts` (GET/POST/DELETE dos anexos, registrado em `rotas.ts`). Frontend
  `frontend/tela-empreendimento-info.ts` (`viab-empreendimento-info`): nome/matrícula/descrição
  editáveis + área do terreno read-only + upload por categoria (mesmo fluxo `__upload` do Apelo).
- **(3) Tipologias:** nova coluna `unidades_permutadas` (inteiro, padrão 0) em `avancado_tipologias`
  (+ `CAMPOS_TIPOLOGIA` no backend). Frontend `frontend/tela-empreendimento-tipologias.ts`
  (`viab-empreendimento-tipologias`): tabela consolidada com colunas **Nome · Tipo · Área privativa ·
  Dormitórios · Vagas · Unidades · Un. permutadas** (loteamento oculta Tipo/Dorm/Vagas) + **linha de
  consolidado** (total de unidades, área total = Σ área×un, total de vagas, total permutadas).
  **Decisão:** `areaPrivativaTotalLinhas` do motor **não** foi alterada (segue Σ área×quantidade, usada
  no custo `rs_m2_priv` e travada por teste); o efeito de `unidades_permutadas` sobre VGV/área líquida
  é do **Lote 6** (rework de Receitas) — aqui a coluna é coletada e somada no consolidado.
- **`tela-avancado.ts`:** os placeholders de Informações e Tipologias foram substituídos pelos novos
  componentes; `_placeholder` removido (sem uso).
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 70/70 ✓ · build (esbuild)
  ✓** (`bash scripts/validar-frontend.sh` verde; bundle 209→223kb). ⏳ **Pendente do autor
  (ambiente autenticado, SDK gated):** typecheck do backend, suíte de backend, `urbi-empacotar` e a
  **execução da migração 001** contra dados reais. Render real dos primitivos de upload/tabela só
  valida no deploy dev.
- **Não copiado no duplicar (nota):** `estudo_documentos` (anexos) não é copiado por
  `duplicarDadosAvancado` (blobs de arquivo); `matricula`/`descricao` viajam com a cópia do estudo
  (não estão no blocklist de cópia). Ajustar se o autor quiser duplicar anexos.

### Lote 5 — Custos em 5 abas + seletor de unidade unificado — ✅ IMPLEMENTADO (issues #17, #18)
Branch `claude/lote-5-issues-msebmq`. Toca **schema + backend + frontend**. `versao` **0.1.1 → 0.1.2**
(migração `migracoes/002_grupos_custo.js`). Pré-requisitos #15 e #16: concluídos.

- **Decisões do autor (perguntadas no início — respostas registradas):**
  1. **Divisão dos grupos ("Obra = tudo de construção"):** o menu de categorias da aba **Obra**
     mantém toda a obra física (Obra · Decoração · Gestão da obra · Contingência · Outro); **Diretos**
     nasce como grupo novo p/ o usuário cadastrar (entrega do produto: Decoração · Gestão da obra ·
     Stand de vendas · Comissão de vendas · Outro); **Financeiro** novo (Juros de financiamento ·
     Taxas bancárias · Estruturação de dívida · Investidores · Outro). Terreno e Indiretos: menus
     intactos.
  2. **Migração dos dados existentes ("Reclassificar por categoria"):** linhas em `obra` com categoria
     **Decoração** ou **Gestão da obra** → `diretos`; o resto de `obra` fica em `obra`; `terreno` e
     `indireto` ficam onde estão. `financeiro` sem dado legado.
  - **Reconciliação das duas respostas (nota):** a resposta 1 deixa o menu da aba Obra permissivo
    (oferece Decoração/Gestão) enquanto a 2 migra as linhas *já cadastradas* dessas categorias p/
    Diretos. Coerente: o menu é a oferta futura; a migração pré-classifica o dado existente. Para as
    linhas migradas renderizarem certo, o menu de **Diretos** também inclui Decoração/Gestão da obra.
- **#17 (5 grupos + seletor por badge):**
  - **Schema:** `avancado_linhas_custo.grupo.opcoes` 3→5 (`terreno`/`obra`/**`diretos`**/`indireto`/
    **`financeiro`** — mantido o valor legado `indireto` p/ não migrar linhas de indireto). Backend
    `GRUPOS_CUSTO` idem (valida POST/PATCH). **Migração 002** forward-only (obra+categoria → diretos).
  - **Seletor de unidade unificado com o Preliminar:** a coluna Orçamento trocou o `urbi-select` por
    **`urbi-badge` interativos** (5 unidades: R$ · R$/m² priv · R$/m² terreno · % VGV · % Receita) com
    **conversão automática de valor** ao trocar (mesmo padrão de `_custoUnidade` do Preliminar). Como a
    linha de custo guarda **um só par** `orcamento_valor`/`orcamento_unidade` (≠ Preliminar, que tem
    coluna por unidade), a troca converte o valor e persiste unidade+valor num só PATCH. Descritores
    `CONV_UNIDADE` batem com o motor (`resolverCustoTotal`): identidade / por_area(areaPrivativa) /
    por_area(areaTerreno) / pct(vgv) / pct(receita←fallback vgv). Reusa `converterUnidade` de
    `premissas-conversao.ts`, agora com as chaves `areaTerreno`/`receita` no `LinkKey` (e
    `CtxConversao` virou `Partial` — chave ausente = não converte).
- **#18 (formato de tabela + 5 abas):** os 5 grupos viraram **5 sub-abas** da aba de topo **Obra**
  (nível-2 `urbi-badge`, declaradas em `tela-avancado.ts` `SUBABAS.obra`), cada uma renderizando
  `viab-fluxo-custos` com a prop nova **`grupo`** (filtra p/ 1 grupo; vazio = todos, fallback). Colunas
  já batem com a spec (Categoria single-select por aba · Orçamento · Distribuição · Cronograma · Início ·
  Duração) + **subcategoria mantida** (aditiva, útil) + **consolidado por aba** (rodapé já existente).
  Regra 🔒 do Cronograma (evento trava Início/Duração) preservada.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 73/73 ✓** (+3 de conversão
  areaTerreno/receita) **· build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde; bundle
  ~225kb). ⏳ **Pendente do autor (SDK gated):** typecheck do backend, suíte de backend, `urbi-empacotar`
  e a **execução da migração 002** contra dados reais. Render real dos badges/sub-abas só no deploy dev.
- **Pré-existente não tocado (fora do escopo):** em `tela-fluxo-custos.ts` o campo Início customizado usa
  `Number(c.inicio_mes) || 1`, que exibe 1 quando o valor é o mês 0 (convenção do Lote 4). Bug latente de
  exibição do default, não do dado salvo; deixado para uma varredura própria.

### Lote 6 — Receitas + Fases + Absorção/Fluxo (spec conjunta) — ✅ IMPLEMENTADO (issues #19, #20, #21)
Branch `claude/lote-6-issues-b21wlr`. Toca **schema + backend + frontend + motor**. `versao` **0.1.2 → 0.1.3**
(migração `migracoes/003_receitas_fases_alocacoes.js`). Pré-requisitos #15 e #16: concluídos.

- **Decisões do autor (perguntadas no início — respostas registradas):**
  1. **Modelo de dados:** **Fase nova + Alocações** — `avancado_fases` (nome, ordem, `absorcao`, `fluxo_pagamento`)
     e `avancado_alocacoes` (fase_id, tipologia_id→catálogo, unidades, preco_m2). `avancado_tipologias` virou
     **catálogo do estudo** (desacoplado — `linha_receita_id` removido). `avancado_linhas_receita` **aposentada**
     (migrada p/ fases+alocações; preservada vestigial no schema para não exigir drop de tabela).
  2. **Integridade tipologia (#19):** **bloquear exclusão** de tipologia com alocações (422 `TIPOLOGIA_EM_USO`);
     a alocação guarda só unidades+preço e lê nome/área do catálogo **ao vivo** (edição reflete).
  3. **Trava de saldo:** **por fase** — saldo = `quantidade` da tipologia − Σ unidades alocadas **naquela fase**
     (a mesma tipologia pode ser realocada por inteiro noutra fase).
- **#19 (novo modelo de Receitas):** a aba **Viabilidade → Receitas** virou **1 card por Fase**; dentro, uma tabela
  de **alocações** (tipologia do catálogo · unidades · preço/m² · área read-only · preço unit/total · saldo). O
  `urbi-select` de tipologia só oferece as com **saldo > 0 na fase** (trava). Empreendimento → Tipologias virou o
  **cadastro do catálogo** (`tela-empreendimento-tipologias.ts` reescrita, endpoints estudo-level).
- **#20 (Absorção + Fluxo):** **Absorção** só **Distribuído** em 3 períodos — P1 = **Pré-lançamento+Lançamento**,
  P2 = Obra, **P3 = Pós-obra derivado** (`100 − p1 − p2`, período do Cronograma). Removidos `linear`/`personalizado`
  da UI, o campo **VGL** e a validação de soma=100%. **Fluxo de Pagamento** com **múltiplas linhas** de Entrada e
  Parcelamento; **Repasse derivado** (`100 − Σentrada − Σparcelas`), sem mensagem de soma.
- **#21 (Fases estruturadas):** `fase_label` (texto) virou entidade `avancado_fases`, dona da Absorção e do Fluxo;
  as alocações são organizadas **por fase**.
- **Motor (compat):** `fluxo-shared.ts` — `absorcaoMensal` distribuído reescrito p/ os 3 períodos (novos
  `faixasAbsorcao`/`pctPosObraDerivado`; `periodoAbsorcao` agora começa no Pré-lançamento). `fluxo-caixa-motor.ts`
  — `receitaMensalLinha` aceita Entrada/Parcelas em **lista** com Repasse derivado (`pctRepasseDerivado`,
  `normalizarLinhasPagamento`); **backward-compat** para o shape objeto legado. `GET /avancado/receitas` devolve as
  **fases no formato do motor** (fase = "linha de receita"; alocações joinadas ao catálogo = "tipologias"), então
  `tela-fluxo-ver`/gráficos/`exportar` seguem sem mudança.
- **Backend (`backend/rotas/avancado.ts`):** novas rotas — catálogo de tipologias (estudo-level, DELETE bloqueia se
  em uso), Fases (CRUD com `absorcao`/`fluxo_pagamento` validados sem soma), Alocações (CRUD nested por fase, trava de
  saldo por fase em POST/PATCH). Validadores `validarAbsorcao`/`validarFluxoPagamento` relaxados (sem soma=100).
  `duplicarDadosAvancado` reescrita (catálogo → mapa id, fases + alocações remapeadas). `montarLinhasReceita` exportada.
- **Migração 003 (forward-only):** cada `avancado_linhas_receita` → `avancado_fases` (absorção convertida p/ distribuído,
  fluxo p/ multi-linha); cada `avancado_tipologias` legada → uma `avancado_alocacoes` na fase da sua linha; drop de
  `avancado_tipologias.linha_receita_id` via `remover_colunas`. Numa instância virgem o runner faz baseline (inócua).
- **Decisão registrada (área p/ custos `rs_m2_priv`):** a área privativa total do motor passa a somar as **alocações**
  (unidades × área do catálogo), mantendo VGV e base de custo consistentes entre si. Se o autor quiser a área do
  **catálogo inteiro** (construído, não só vendido) para custo de obra, ajustar `montarLinhasReceita`/motor num passo próprio.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓** (+ absorção 3-períodos,
  fluxo multi-linha, `montarLinhasReceita`) **· build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde;
  bundle ~224kb). ⏳ **Pendente do autor (SDK gated):** typecheck do backend, suíte de backend (inclui os testes
  novos de `validar*`/`montarLinhasReceita`), `urbi-empacotar` e a **execução da migração 003** contra dados reais.
  Render real dos modais (Absorção 3 períodos, Fluxo multi-linha) e da trava de saldo só valida no deploy dev.

### Lote 7 — Financeiro (sub-abas de Viabilidade) — ✅ IMPLEMENTADO (issue #22)
Branch `claude/lote-7-issues-y8gvh9`. Toca **schema + frontend** (sem motor, sem migração). `versao`
**mantida** — só colunas aditivas em `estudos` (precedente da Etapa 3: adição de coluna não bumpa `versao`
nem exige migração; o sincronizador cria as colunas com seus padrões).

- **Destravamento do lote:** o issue estava 🚫 bloqueado por falta de spec dos campos. O autor forneceu a
  spec via **prints de uma ferramenta profissional de incorporação** (abas Juros/Taxas · Impostos ·
  Financiamento à Produção · Securitização) + 2 ajustes: (a) `taxa_desconto_aa` mora em **Custos Financeiros**;
  (b) a **Correção** tem 2 fatores — índice + taxa (% a.a.) digitada. Proposta rascunhada por mim e aprovada
  "com ajustes".
- **Decisões do autor (registradas):**
  1. **Motor:** "só persistir + realocar existentes" — os campos novos são **gravados/exibidos mas NÃO entram
     em nenhuma fórmula** agora. `proforma.ts`/`fluxo-caixa-motor.ts`/`fluxo-shared.ts` **intocados**. Entrada
     de juros/financiamento no fluxo é passo futuro (spec de motor à parte).
  2. **Layout:** `Financeiro` como **3º badge de Viabilidade** (`Premissas · Receitas · Financeiro`); as 5
     seções são **urbi-card empilhados (seções roláveis)**, não um 3º nível de aba — a alternativa que o
     próprio #22 sugeriu.
  3. **Overlap com Obra→Financeiro:** a seção Custos Financeiros aqui é **paramétrica**; as linhas manuais de
     custo financeiro seguem no grupo **Obra → Financeiro** (Lote 5) — papéis distintos, sem duplicar dado.
- **Avaliação severa dos prints (o que foi CORTADO):** rejeitados por exigirem motor temporal (adiado) ou por
  obsolescência — **CPMF** (extinto desde 2007), IOF adicional, curvas de liberação/amortização,
  financiamentos associativos CEF/MCMV, securitização de recebíveis, e as matrizes por-conta "Encargos sobre
  Incorridos"/"Projeção Inflacionária". Mantidos só os campos-cabeçalho que cabem barato no schema e ficam
  persist-only.
- **Schema (`estudos`, ~29 colunas aditivas):** Estrutura (`estrutura_capital_proprio_pct`,
  `estrutura_financiamento_pct`, `estrutura_investidores_pct`, `taxa_juros_valor_futuro_aa`); Custos Financeiros
  (`tarifas_bancarias_pct`, `taxa_adm_carteira_pct`, `taxa_estruturacao_divida_pct`, `taxa_gerenciamento_obra_pct`
  — + `taxa_desconto_aa` já existente, só realocado); Juros (`juros_financeiros_aa`, `juros_inicio_cobranca_mes`,
  `indice_correcao` [enum], `indice_correcao_taxa_aa`); Taxas e Impostos (`regime_tributario` [enum],
  `aliquota_pis_pct`, `aliquota_cofins_pct`, `aliquota_csll_pct`, `aliquota_irpj_pct`, `aliquota_itbi_pct`,
  `imposto_sobre_permuta_fisica` [bool] — reusando `sujeito_ret`/`imposto_percentual`); Financiamento &
  Investidores (`financiamento_obra_pct`, `financiamento_juros_aa`, `financiamento_sistema_amortizacao` [enum],
  `financiamento_prazo_meses`, `financiamento_carencia_meses`, `investidor_aporte_valor`,
  `investidor_retorno_tipo` [enum], `investidor_juros_aa`, `investidor_carencia_meses`, `investidor_parcelas`).
  Precisão seguindo o precedente local do `estudos`: % → `decimal(5,2)`, R$ → `decimal(12,2)`, meses/parcelas →
  `inteiro`.
- **Frontend:** novo `frontend/tela-financeiro.ts` (`viab-tela-financeiro`) — 5 urbi-card, `viab-num` (com
  `casas-decimais=0` p/ inteiros), `urbi-select` p/ os enums, `urbi-checkbox` p/ RET e permuta física, salvar via
  `atualizarEstudo` (coerção '' → null nos numéricos). `tela-avancado.ts`: `financeiro` adicionado ao `SUBABAS.viabilidade`
  e ao `_renderSubConteudo` (editável = guard de premissas). `taxa_desconto_aa` volta a ter editor (sumira no Lote 4).
- **Realocação sem duplicar dado:** `sujeito_ret`/`imposto_percentual` seguem editáveis também em Premissas
  (componente `viab-tela-premissas` é compartilhado com o Preliminar — **não** mexido para não afetar o Preliminar);
  editar em qualquer tela grava a mesma coluna. Registrado como dupla-superfície consciente.
- **Check de não-regressão (pedido do autor):** confirmado por `git diff` que **nenhum arquivo de motor** foi
  tocado (proforma/fluxo/conversão) → todas as fórmulas seguem idênticas; **typecheck ✓ · testes 76/76 ✓ · build
  (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~234kb). Como os campos são inertes ao cálculo,
  não há fórmula nova para quebrar.
- ⏳ **Pendente do autor (SDK gated):** typecheck do backend, suíte de backend, `urbi-empacotar` e a criação real
  das colunas aditivas (sincronizador) contra dados reais. Render real dos `urbi-select`/acordeões só valida no
  deploy dev.

### Lote 8 — Aba Resumo consolidada (ÚLTIMO) — ✅ IMPLEMENTADO (issue #23)
Branch `claude/lote-8-issues-jp59cw`. Mudança **100% frontend** — sem schema/backend/motor/migração;
`versao` intacta. Pré-requisitos (lotes 1–7): todos concluídos.

- **Seleção de itens (definida com o autor, conforme #23 "definida em conjunto"):**
  - **8 KPIs:** do Fluxo de Caixa → **VPL · TIR · Payback · Exposição máxima**; do Proforma →
    **VGV · Resultado · Margem líquida · ROI**.
  - **4 gráficos-chave:** **Fluxo de Caixa Acumulado** (curva S, com payback + exposição) ·
    **Fluxo de Caixa Mensal** (barras) · **Composição dos custos** (pizza) · **Indicadores vs.
    benchmark** (medidores).
- **Novo `frontend/tela-resumo.ts` (`viab-tela-resumo`):** frontend puro, **sem entrada própria** —
  consome os resultados das outras abas. Carrega os dados do Avançado (receitas, custos, curvas,
  cronograma, parâmetros) + benchmarks + config numa única `_carregar`, computa o **motor de fluxo**
  (`calcularFluxo`) e o **Proforma** (`calcularProforma`, com `aliquota_ret_pct` da config) e renderiza
  os 8 KPIs + os 4 gráficos. `urbi-estado-vazio` quando ainda não há receitas/custos.
- **Reuso, não reinvenção (headline):** os SVGs de fluxo (mensal + acumulado) foram **extraídos** de
  `tela-fluxo-ver.ts` para o novo módulo puro **`frontend/fluxo-graficos.ts`** (`graficoFluxoMensal`/
  `graficoFluxoAcumulado`, + `abrevR$` e os marcos do cronograma). `tela-fluxo-ver` passou a importar
  essas funções (removidas as cópias privadas `_graficoMensal`/`_graficoAcumulado`/`_marcos` e o
  `abrevR$` local; import de `svg` removido). Assim **Resumo e Fluxo de Caixa renderizam gráficos
  idênticos** a partir da mesma fonte. Os medidores reusam `montarMedidor` (`medidor-faixas.ts`) e a
  pizza reusa `urbi-grafico-pizza` com a mesma lista de custos do Proforma que a aba Cenários
  (`tela-graficos`).
- **`tela-avancado.ts`:** a aba **Resumo** deixou de renderizar `viab-tela-proforma` (placeholder do
  Lote 3) e passou a renderizar **`viab-tela-resumo`**; import de `tela-proforma` removido daqui (o
  Preliminar segue registrando-o via `tela-estudo`). Comentário do mapa de abas atualizado.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~239kb). Sem schema/backend → empacotamento não se
  aplica. ⏳ Render real dos `urbi-kpi`/`urbi-grafico-*` só valida no deploy dev.

---

## Rodada 3 — Sessões (2026-07-25) — `docs/sessoes-bugs-2026-07-25.md`

### Sessão S5 — Empreendimento Cronograma: Regras e bug Gantt — ✅ IMPLEMENTADA (issues #84, #85, #86)
Branch `claude/sessao-s5-rx8lrh` (PR #139). Mudança **100% frontend** (`frontend/tela-fluxo-cronograma.ts`) —
sem schema/backend/migração; `versao` intacta. Sem pré-requisitos.

- **#84 (Pré-lançamento derivado de Planejamento):** `pre_lancamento.inicio_mes` agora é sempre
  travado na UI (flag forçado para `true` no frontend, independente do servidor). Ao salvar
  `planejamento.inicio_mes`, o componente faz um segundo PATCH automático para `pre_lancamento` com
  `inicio_mes = planejamento.inicio_mes + 1`. O array `crono` é atualizado com o retorno do segundo PATCH.
- **#85 (Duração do Lançamento editável):** para o evento `lancamento`, `travadoDur` é forçado para
  `false` no frontend — o campo passa a ser editável como as demais fases, removendo a trava que vinha
  do flag do servidor.
- **#86 (Estrela à esquerda da barra):** a estrela ⭐ era renderizada em `x + 4` (em cima do início
  da barra). Corrigida para `x - 4` com `text-anchor="end"` — imediatamente à esquerda. Também
  adicionado suporte à estrela no branch `rect` (duração > 1 mês), já que após #85 o Lançamento pode
  ter qualquer duração.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde). Sem schema/backend → empacotamento não se aplica.
  ⏳ Render real do Gantt e do cascade-save só valida no deploy dev.

### Sessão S6 — Empreendimento: Bugs difíceis — ✅ IMPLEMENTADA (issues #87, #88)
Branch `claude/sessao-s6-votd43`. Mudança **100% frontend** — sem schema/backend/motor/migração;
`versao` intacta. Sem pré-requisitos.

- **#87 (campos de texto apagam ao digitar rápido — race de PATCH stale):** raiz do bug é uma
  resposta de PATCH antigo chegando **depois** e sobrescrevendo o valor atual do campo. Fix nos
  dois arquivos-alvo:
  - `frontend/viabilidade-api.ts`: `atualizarEstudo(id, dados, signal?)` ganhou 3º parâmetro
    **`AbortSignal` opcional** (repassado ao `fetch` via `RequestInit.signal`). Chamadas existentes
    (2 args) seguem idênticas.
  - `frontend/tela-empreendimento-info.ts`: os campos de texto (Nome · Matrícula · Descrição) agora
    fazem **auto-save com debounce (500ms) + AbortController**. Cada disparo **aborta o PATCH
    pendente anterior** antes de iniciar o novo (`_salvarCampos`), então a resposta de um PATCH
    obsoleto nunca volta para clobberar o campo; o componente também **nunca reescreve** o valor a
    partir da resposta da API. O botão "Salvar informações" continua (faz *flush* do debounce e
    grava tudo — texto + terreno/coeficientes — num único PATCH). Auto-save é silencioso; o botão
    mantém o toast de confirmação. `disconnectedCallback` limpa o timer e aborta o controller;
    `_agendarSalvarTexto` só dispara quando `editavel`.
- **#88 (remover todo o conteúdo da aba Premissas no Avançado):** revisita e **supera** a decisão da
  Etapa 7/#54 (que mantivera Premissas no Avançado). Remoção exclusiva do Avançado; Preliminar
  100% intocado.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~266.7kb). Sem schema/backend → empacotamento
  não se aplica.

### Sessão S9 — Receitas: UI & Validação — ✅ IMPLEMENTADA (issues #103, #104, #105, #106)
Branch `claude/sessao-s9-rs5ndx` (PR #143). Mudança **100% frontend** (`frontend/tela-fluxo-receitas.ts`) —
sem schema/backend/motor/migração; `versao` intacta. Pré-requisito S5: concluído.

- **#103–#106:** coluna Total, botões secundario, regras de parcelamento, lixeiras perigo.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓** (~266.7kb).

### Sessão S3 — Preliminar Proforma: Bugs de exibição — ✅ IMPLEMENTADA (issues #77, #78)
Branch `claude/sessao-s3-hcnifg` (PR #136). Mudança **100% frontend** (`frontend/tela-proforma.ts`) —
sem schema/backend/motor/migração; `versao` intacta. Sem pré-requisitos.

- **#77 (receita com notação contábil negativa):** **Receita líquida** e **Receita operacional** são
  consolidados de receita (`tipo: 'consolidado'` + `natureza: 'receita'`), mas o fallback de
  `_fmtContabil`/`_fmtContabilM2` envolvia qualquer não-receita/não-resultado em parênteses, incluindo-os.
  Agora ambos os formatadores testam também `natureza === 'receita'` → exibem valor **plano (absoluto
  positivo)** nas colunas R$ e R$/m². `proforma.ts` **não** foi tocado (os valores já vinham corretos; o
  bug era só de exibição).
- **#78 (títulos da sensibilidade desalinhados):** os números da tabela monetária herdavam
  `text-align: right` da regra global `.num`, enquanto o cabeçalho (badge do cenário) é centralizado via
  `.sens-cab`. Fix: `.pf.sens td.num` agora **centralizado** (casa com o cabeçalho, como já ocorria na
  tabela de indicadores) + **`colgroup` compartilhado** (rótulo 40% + 3 cenários 20%) e
  `table-layout: fixed` para as colunas bear/base/bull terem a mesma geometria nas duas tabelas.
- **Armadilha do template (relembrada):** backtick literal dentro do `` css`…` `` fecha o tagged template
  e quebra o typecheck — comentário reescrito sem backticks (usa aspas). Ver Lote 2.
- **Validação:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~265.8kb). Sem schema/backend → empacotamento não se
  aplica. ⏳ Render real do alinhamento só valida no deploy dev.

### Sessão S10 — Saldo de unidades + Absorção 4 períodos — ✅ IMPLEMENTADA (issues #107, #108)
Branch `claude/sessao-s10-fbqwwv`. Mudança **100% frontend** (`frontend/fluxo-shared.ts`,
`frontend/tela-fluxo-receitas.ts`, testes) — sem schema/backend/migração; `versao` intacta.
Pré-requisito: S5 (concluída).

- **#107 (Saldo de unidades: cálculo de cima para baixo):** introduzido `_saldoAntes(alocId, tipologiaId)`
  em `tela-fluxo-receitas.ts` — percorre `this.fases` em ordem e acumula unidades até encontrar a alocação
  alvo, retornando `quantidade - usado_acima`. O `_saldo()` simples (total restante) permanece para o campo
  readonly final. `_renderAlocacao` agora usa `_saldoAntes(a.id, a.tipologia_id)` para exibir o saldo
  disponível no momento daquela alocação específica.
- **#108 (Absorção: separar Pré-lançamento e Lançamento — 4 períodos):** `faixasAbsorcao` em
  `fluxo-shared.ts` agora retorna 4 faixas separadas (`pre_lancamento`, `lancamento`, `obra`, `pos_obra`).
  `pctPosObraDerivado` subtrai os 4 inputs. `absorcaoMensal` modo `distribuido` espalha cada período
  separadamente; faixa vazia (fim < inicio) quando Pré-lançamento ausente do cronograma. Modal de absorção
  em `tela-fluxo-receitas.ts` atualizado para 4 linhas/entradas. Backward-compat: bloco `pos_obra` com
  `pct: 0` se torna derivado de `100 − pré − lanc − obra`.
- **Testes:** `fluxo-shared.test.ts` e `fluxo-caixa-motor.test.ts` atualizados para o novo formato de 4 períodos.
- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde). Sem schema/backend → empacotamento não se aplica.

### Sessão S11 — Custos: Texto, CSS & Layout — ✅ IMPLEMENTADA (issues #109–#114)
Branch `claude/sessao-s11-*` (PR #145). Mudança **100% frontend** — sem schema/backend/migração;
`versao` intacta. Sem pré-requisitos.

- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**.

### Sessão S12 — Custos: Regras & Formatação — ✅ IMPLEMENTADA (issues #115, #116, #117)
Branch `claude/sessao-s12-0jed3r`. Mudança **100% frontend** (`frontend/tela-fluxo-custos.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisito S11: concluído.

- **#115 (Construção obrigatória — 1ª linha travada):** categoria "Obra" renomeada para "Construção"
  em `CATEGORIAS.obra`. Constante `OBRA_OBRIGATORIAS` define as 2 linhas obrigatórias do grupo Obra
  em ordem (`Construção` · `Gestão da obra`). Função `eObrigatoria(c)` identifica essas linhas.
  Ao carregar (modo editável), `_garantirLinhasObra()` cria as linhas faltantes via POST. Na coluna
  Categoria, linhas obrigatórias exibem `<strong>` (texto travado) em vez de `urbi-select`. Botão
  "Remover" omitido para essas linhas. Função `ordenarLinhasObra()` garante que Construção e Gestão
  da obra apareçam sempre nas posições 0 e 1, independente da `ordem` do servidor.
- **#116 (Gestão da obra obrigatória — 2ª linha travada):** implementado em conjunto com #115 via
  o mesmo mecanismo (`OBRA_OBRIGATORIAS`). A lógica é idêntica: categoria travada, posição fixada,
  não removível.
- **#117 (Orçamento em % com 2 casas decimais):** o `viab-num` da coluna Orçamento recebe
  `casas-decimais="2"` quando `modo.startsWith('pct_')`, e `casas-decimais="0"` nas demais unidades.
  Aplica-se a todas as abas de Custos (mesmo componente).
- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~273.3kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das linhas travadas e formatação % só valida no deploy dev.

### Sessão S13 — Custos: Lógica multi-arquivo — ✅ IMPLEMENTADA (issues #118, #119, #120)
Branch `claude/sessao-s13-sfftnq`. Mudança **100% frontend** (`frontend/tela-fluxo-custos.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisito S12: concluído.

- **#118 (coluna Resultado — multiplicação correta por unidade):** a coluna Resultado já usava
  `resolverCustoTotal` (motor puro em `fluxo-shared.ts`), mas o `ContextoCusto` montado na UI **não
  preenchia `receitaTotal`** — então linhas em **`% Receita`** caíam no fallback do motor
  (`ctx.receitaTotal ?? ctx.vgvTotal` → VGV) e **divergiam** do que o Fluxo de Caixa efetivamente
  computa (o motor em `fluxo-caixa-motor.ts` usa a receita líquida real). Fix: `_carregar` passou a
  calcular `receitaTotal` **exatamente como o motor** — Σ `vglLinha(vgvLinha(tipologias), fluxo_pagamento)`
  (VGL líquido de comissão destacada e RET) — e a incluí-lo no `ctxCusto`. Agora as 5 unidades batem
  com o motor: R$ direto · R$/m² priv × área privativa · R$/m² terreno × área do terreno · % VGV × VGV
  · % Receita × VGL · % Obra × total de Obra. `_ctxConversao()` também passou a usar a receita real
  (VGL) na chave `receita`, deixando a conversão por badge coerente com o cálculo do Resultado.
- **#119 (arredondamento de unidade igual ao padrão de Premissas):** a troca de badge já convertia o
  valor via `converterUnidade` (a mesma função das Premissas), mas arredondava só a 2 casas
  independentemente da unidade de destino — deixando **centavos ocultos** numa unidade inteira (R$,
  R$/m²) e desestabilizando o round-trip. Fix: `_trocarUnidade` passou a arredondar o valor convertido
  à **precisão de exibição da unidade de destino** (`_casasUnidade`: % → 2 casas, R$/R$-m² → 0), a
  mesma precisão do `viab-num` daquela unidade (#117). Assim o valor guardado é idêntico ao exibido/
  digitado e a ida-e-volta entre unidades não acumula drift.
- **#120 (Construção: Cronograma fixo em "Obra", Início/Duração derivados e bloqueados):** helper
  `eConstrucao(c)` (grupo obra + categoria Construção). Na coluna **Cronograma**, a linha Construção
  exibe **"Obra" travado** (texto + 🔒, sem `urbi-select`). **Início** e **Duração** passam a ser
  **derivados do evento Obra do cronograma** (getter `_eventoObra` sobre o `crono` já carregado por
  `buscarCronogramaAvancado`) e renderizados **bloqueados** (📅/🕐 + 🔒). Para o motor distribuir o
  custo no mesmo intervalo exibido, `_sincronizarConstrucao()` (chamado no `_carregar`, modo editável,
  idempotente) faz PATCH da linha Construção quando `cronograma_evento`/`inicio_mes`/`duracao_meses`
  divergem do evento Obra. `buscarCronogramaAvancado` já existia e foi reutilizado (sem mudança na API).
- **Validação:** frontend isolado — **typecheck ✓ · testes 78/78 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~274.6kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das colunas travadas, do sync da Construção e do
  Resultado em `% Receita` só valida no deploy dev.

### Sessão S14 — Custos Diretos: Motor de Corretagem — ✅ IMPLEMENTADA (issue #121)
Branch `claude/sessao-s14-svgouc`. Mudança **100% frontend** (`fluxo-shared.ts`, `fluxo-caixa-motor.ts`,
`tela-fluxo-custos.ts` + testes) — sem schema/backend/migração; `versao` intacta.
Pré-requisitos S13 e S10 (#108): concluídos e já na `main`.

- **Regra de negócio (#121):** a **Corretagem de vendas** não é um custo distribuído no tempo como os
  demais — ela é paga **integralmente no mês em que a unidade é vendida**. Logo a linha não tem
  Distribuição, Cronograma, Início nem Duração: quem define o calendário dela é a **absorção das
  vendas** (o mesmo `absorcaoMensal` das 4 faixas do #108).
- **Motor (`fluxo-shared.ts`):** dois primitivos puros novos — `vgvVendidoMensal(linhasReceita, crono,
  prazo)`, que soma o **VGV vendido mês a mês** repartindo o VGV de cada linha de receita pela sua
  própria curva de absorção; e `eCorretagem(custo)` + `CATEGORIA_CORRETAGEM`, que identificam a linha
  (grupo `diretos` + categoria "Corretagem de vendas") — um único predicado compartilhado entre motor
  e UI, sem duplicar a regra.
- **Motor (`fluxo-caixa-motor.ts`):** `corretagemMensal(custo, linhasReceita, crono, prazo, ctx)`
  aplica o **% de corretagem sobre o VGV vendido em cada mês** (unidade `pct_vgv`, a única oferecida
  na UI). Dado legado em outra unidade cai no mesmo calendário: o total resolvido é rateado
  proporcionalmente ao VGV vendido no mês. Sem vendas no horizonte → nenhum desembolso.
  Em `calcularFluxo`, a linha de corretagem **desvia de `distribuirLinha`**: `inicio`/`duracao` vêm do
  **recorte das vendas** (não dos campos persistidos, que passam a ser ignorados) e `total` é a soma do
  próprio mensal — ou seja, o que de fato entra no fluxo de caixa.
- **UI (`tela-fluxo-custos.ts`):** a máquina de "linhas obrigatórias" do grupo Obra (S12/S13) foi
  **generalizada por grupo** (`LINHAS_OBRIGATORIAS`, `obrigatoriasDoGrupo`, `ordenarLinhas`), e o grupo
  **Diretos** ganhou a Corretagem como **1ª linha obrigatória**, em `pct_vgv`: categoria travada
  (texto, sem seletor), **sem botão Remover** e com **Distribuição / Cronograma / Início / Duração
  sem campo** — Distribuição exibe "Mês da venda 🔒" (com tooltip da regra) e as outras três, "—".
  `_garantirLinhasObrigatorias` (ex-`_garantirLinhasObra`) cria a linha que faltar em qualquer grupo,
  já com a unidade fixa; a Corretagem nasce com `cronograma_evento: 'customizado'`, pois não se ancora
  em evento nenhum. `ordenarLinhas` passou a comparar por **identidade**, então uma 2ª linha legada com
  a mesma categoria continua listada em vez de sumir da tabela.
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ (4 novos) · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~275.9kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real da linha travada em Custos Diretos e a conferência da
  corretagem na tabela do Fluxo de Caixa só validam no deploy dev.

### Sessão S15 — Fluxo de Caixa: Visual & Layout — ✅ IMPLEMENTADA (issues #122, #123, #124)
Branch `claude/sessao-s15-096661`. Mudança **100% frontend** (`frontend/fluxo-tabela.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisitos S13/S14: concluídos.

- **#122 (sobreposição de colunas fixas ao rolar horizontalmente):** `--cor-superficie` é
  translúcida no design system (~4% alpha); ao usar `background: var(--cor-superficie)` nas
  células não-fixas, o conteúdo dos meses aparecia por cima das colunas sticky (cujo fundo
  era opaco mas ficava "atrás" visualmente). Fix: alterado `table.fx th, table.fx td` para
  usar `--cor-superficie-elevada` (opaca) em todas as células. As regras de row-color (#123)
  também usam `color-mix` com base opaca, reforçando a correção.
- **#123 (cores de fundo por tipo de linha no Proforma do Fluxo):** função `linhaTabela`
  ganhou classe `receita`/`custo` no `<tr>` (adicionada via template literal). CSS com seis
  regras `color-mix` de especificidade `[0,2,1]` (supera a regra de sticky `.c1`/`.c4`/`.c5`
  `[0,1,0]`), então a cor da linha aparece também nas colunas fixas:
  - Receita grupo (15%) → subgrupo/fase (8%) → subitem/tipologia (4%) em verde sucesso
  - Custo grupo (15%) → subgrupo/agrupamento (8%) → item (4%) em vermelho erro
  Linhas `resultado` e `divisoria` mantêm o fundo padrão.
- **#124 (ocultar colunas Início e Duração):** verificação confirmou que `inicio` e `duracao`
  são exibidos apenas para referência — o motor não os usa para calcular VPL. Fix via CSS:
  `.c2 { display: none }` e `.c3 { display: none }`. Ajustados os `left` das colunas
  subsequentes: `.c4` 356→220 px, `.c5` 476→340 px. Comentário de cumulativo atualizado.
  Células `.c2`/`.c3` permanecem no DOM (estrutura da tabela preservada; conteúdo oculto).
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~276.6kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das cores de linha e do scroll sticky só
  valida no deploy dev.

### Sessão S16 — Fluxo de Caixa: Estrutura & VPL — ✅ IMPLEMENTADA (issues #125, #126)
Branch `claude/sessao-s16-3scr7u`. Mudança **100% frontend** (`fluxo-caixa-motor.ts`,
`fluxo-tabela.ts`, `exportar.ts`) — sem schema/backend/migração; `versao` intacta.
Pré-requisito S15: concluído e na `main`.

- **#125 (renomear "Receita" + acrescentar Obras e Financeiro no Proforma do Fluxo):**
  1. A linha-grupo de receita passou de **"Receita"** para **"Receita Bruta (VGV)"** (mesmo rótulo
     no export CSV/PDF).
  2. O Proforma do Fluxo só listava **3 grupos de custo** (`terreno`/`obra`/`indireto`), mas as abas
     de Custos têm **5** (Terreno · Obra · Diretos · Indiretos · Financeiro, desde o Lote 5). A causa:
     o motor **colapsava** `diretos`/`financeiro` em `indireto` ao montar `LinhaCalc.grupo`. Fix:
     - `fluxo-caixa-motor.ts`: `LinhaCalc.grupo` ampliado para os 5 grupos; o `map` de custos agora
       **preserva o grupo real** (grupo desconhecido/legado ainda cai em `indireto` por segurança).
     - `fluxo-tabela.ts`: `GRUPO_CUSTO_LABEL` e a lista de `grupos` cobrem os 5, **na ordem das abas
       de Custos**. Rótulo de `obra` corrigido de "Custos Diretos" (herança do modelo antigo de 3
       grupos) para **"Custos de Obra"**; `diretos` = "Custos Diretos"; `financeiro` = "Custos
       Financeiros". `chavesColapso` inclui `custo-diretos`/`custo-financeiro`.
     - `exportar.ts` (não estava na lista de alvos, mas **consome `LinhaCalc.grupo`**): mesma expansão
       de rótulos/ordem — senão as linhas de `diretos`/`financeiro` **sumiriam** do CSV/PDF depois que
       o motor parou de remapeá-las para `indireto`.
- **#126 (VPL faltando em algumas linhas do Fluxo de Caixa):** o motor **já** calcula `vpl` por linha
  (receita, tipologia, custo). O que faltava eram as linhas **agregadas/subtotais e de resultado**, que
  a tabela montava sem `vpl` → coluna VPL vinha vazia em: **Receita Bruta (VGV)** (grupo), **Custo
  Total** (grupo), cada **subtotal de grupo de custo**, e **Fluxo de Caixa Mensal/Acumulado**
  (resultado). Fix (VPL é **linear** no fluxo mensal, então VPL do agregado = Σ VPL das linhas):
  - `fluxo-tabela.ts`: helper `somaVpl(linhas)`; passado `vpl` para a linha de Receita Bruta
    (Σ receitas), Custo Total (Σ custos) e cada subtotal de grupo (Σ do grupo). `linhaResultado` ganhou
    parâmetro `vpl` e renderiza o **VPL do projeto** (`c.vpl`) nas duas linhas de resultado (com classe
    `pos`/`neg`). Consistência garantida: VPL(Fluxo Mensal) = VPL(Receita) − VPL(Custo) = `c.vpl`.
  - `exportar.ts`: mesmos agregados ganharam `vpl` (a coluna VPL do CSV/PDF já renderizava quando
    presente), mantendo export e tela idênticos.
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~277.1kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real das novas seções (Diretos/Financeiro) e da coluna VPL
  preenchida só valida no deploy dev.

### Sessão S18 — Cenários: Texto & KPI — ✅ IMPLEMENTADA (issues #128, #129)
Branch `claude/sessao-s18-suhtuj` (PR #155). Mudança **100% frontend** (`frontend/tela-cenarios.ts`,
`frontend/fluxo-tabela.ts`) — sem schema/backend/migração; `versao` intacta. Pré-requisito S16:
concluído e na `main`.

- **#128 (remover placeholder do campo Nome):** Removido o atributo `placeholder` do `urbi-input`
  do campo "Nome do cenário" em `tela-cenarios.ts`.
- **#129 (adicionar KPI Resultado):** Adicionado o KPI "Resultado" como primeiro indicador da função
  `kpisFluxo` em `fluxo-tabela.ts`. O valor é calculado como o final do fluxo acumulado
  (`fluxoAcumulado[fluxoAcumulado.length - 1]`), com variante de cor (sucesso se ≥ 0, erro se < 0).
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~277.2kb). Sem schema/backend → empacotamento
  não se aplica.

### Sessão S8 — Receitas: CSS, Layout & Texto — ✅ IMPLEMENTADA (issues #91–#102)
Branch `claude/sessao-s16-3scr7u`. Mudança **100% frontend** (`frontend/tela-fluxo-receitas.ts`) —
sem schema/backend/migração; `versao` intacta. Sem pré-requisitos.

- **Contexto:** auditoria (a pedido do autor) revelou que a S8 nunca fora rodada como sessão — 11 das
  suas issues seguiam abertas e sem entrada no PROGRESSO. #91 já estava fechada; #96 (título "VGV") e
  #98 (texto "4 períodos") já estavam satisfeitas no código por trabalho anterior. As **9 restantes**
  foram implementadas aqui.
- **#92 (cores das bolas de status):** `.stat` (pendente) de `var(--cor-alerta)` → **`var(--cor-erro)`**
  (vermelha) e `.stat.ok` (aplicado) de `var(--cor-sucesso)` → **`var(--cor-info)`** (azul). Só tokens.
- **#93 (largura da coluna Tipologia):** `col.c-tipo` de `width: auto` → **`190px`**.
- **#94 (largura de "Preço / m²"):** `col.c-preco` `110px` → **`140px`** (cabe 5 dígitos + 2 casas + sufixo).
- **#95 (remover prefixo "R$"):** colunas Preço unitário e VGV trocaram `fmtR$` por **`fmtNum`** (mesma
  formatação de milhar, sem "R$"). `fmtNum` adicionado ao import.
- **#96 (título "Preço total" → "VGV"):** já estava no código (header "VGV"). Sem mudança.
- **#97 (botão "Adicionar Alocação" → "Adicionar tipologia"):** label trocado.
- **#98 (texto da Absorção p/ 4 períodos):** refinado para **nomear** os períodos — "Pré-lançamento,
  Lançamento, Obra e Pós-obra (calculado automaticamente)".
- **#99 (remover "(calculado)" do Pós-obra):** removido o `<span>` no label da tabela de Absorção.
- **#100 (reduzir campos % e nº parcelas no Fluxo de Pagamento):** `.pag-linha viab-num` `120px` → **`92px`**.
- **#101 (remover "(calculado)" do Repasse + fórmula):** label "Repasse (calculado)" → "Repasse" e
  removida a linha `<p>Repasse = 100% − entradas − parcelas.</p>`.
- **#102 ("Comissão" → "Corretagem" no modal):** label do `urbi-checkbox` trocado (a chave interna de
  dados `comissao` **não** mudou — só o texto visível).
- **Validação:** frontend isolado — **typecheck ✓ · testes 82/82 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~277.1kb). Sem schema/backend → empacotamento não
  se aplica. ⏳ Render real das cores de status, larguras e textos só valida no deploy dev.

### Sessão S17 — Fluxo de Caixa: View Mensal/Anual — ✅ IMPLEMENTADA (issue #127)
Branch `claude/sessao-s17-bus1bk`. Mudança **100% frontend** (`fluxo-shared.ts`, `fluxo-caixa-motor.ts`,
`fluxo-graficos.ts`, `tela-fluxo-ver.ts`, `exportar.ts`) — sem schema/backend/migração; `versao` intacta.
Pré-requisito S16: concluído e na `main`.

- **#127 (badges Mensal/Anual para alternar a view do Fluxo):** dois `urbi-badge` **interativos e
  exclusivos** (`cor="info"`, `?ativo`) ao lado do botão Expandir/Recolher tudo — um deles **sempre**
  ativo, porque o estado é um enum `visao: 'mensal' | 'anual'` (default `mensal`), não dois booleanos.
  Mesmo padrão de chip já usado em `tela-dashboard.ts` (nível de análise) e `tela-fluxo-custos.ts`.
- **Arquitetura — agregação é de EXIBIÇÃO, não recálculo.** O motor continua calculando **mês a mês**;
  a view Anual só reagrupa as colunas do resultado. Duas funções puras novas, ambas testadas:
  - `fluxo-shared.ts` · **`periodosAnuais(dataInicio, prazo)`** → faixas de meses por **ano-calendário**
    (`{ rotulo, inicio, fim }`). O corte segue o calendário real: com início em `abr/2027`, o 1º período é
    2027 e cobre só abr→dez (9 meses); o último é truncado no fim do horizonte. As faixas são **contíguas
    e cobrem exatamente todos os meses** — é o que garante que a soma anual bata com a mensal. Sem
    `data_inicio_projeto` válida degrada para blocos de 12 meses rotulados "Ano 1", "Ano 2"… (mesma
    degradação de `rotuloMesRelativo`).
  - `fluxo-caixa-motor.ts` · **`agregarFluxoPorPeriodos(calc, periodos)`** → novo `FluxoCalc` com
    `prazo`/`meses` por período. **Séries de fluxo** (receita, custo, fluxo, cada linha e cada tipologia):
    **soma** dos meses da faixa → `Σ colunas = Σ meses` em **toda** linha, e cada linha continua batendo
    com a sua coluna "Total". **Acumulado**: **último** mês da faixa (somar acumulados contaria o mesmo
    caixa várias vezes) — é o saldo no fim do ano.
- **O que NÃO muda com a view (decisão de negócio):** `vpl`, `tir`, `paybackMes`/`paybackData`,
  `exposicaoMaxima`, `vgvTotal` e o `total`/`vpl` de cada linha. São grandezas do fluxo **mensal** — o VPL
  desconta mês a mês e a exposição máxima é o pior saldo de um **mês**, não de um fim de ano. Os 4 KPIs do
  topo seguem lendo o `FluxoCalc` mensal. `inicio`/`duracao` das linhas também continuam em **meses**
  (é o calendário real da linha); quem desenha as colunas converte para índice de período.
- **Gráficos:** rótulos do eixo X passaram de `rotuloMesRelativo(dataInicio, i)` para **`c.meses[i]`** —
  no-op na view mensal (é literalmente o mesmo valor) e correto na anual. Marcos do cronograma e a linha
  de payback continuam em meses e são posicionados por um mapeador mês→coluna (`colunaDoMes`), com
  **fração dentro do ano** para não grudarem no início da coluna. O marcador de **exposição máxima** só
  aparece quando o pior saldo cai no fim de um período (`indexOf` em `fluxoAcumulado`) — assim ele nunca
  é desenhado em cima de um ponto que não é o mínimo real.
- **Exportações seguem a view** (CSV e PDF exportam as mesmas colunas da tela). `exportarFluxoPDF` ganhou
  o parâmetro opcional `rotuloColunas` ("Meses"/"Anos") só para o rodapé de paginação; as colunas
  Início/Duração e os KPIs do PDF continuam em meses.
- **Escopo intocado:** a aba **Cenários** (`tela-cenarios.ts`, que reusa `tabelaFluxo`/`kpisFluxo`) e a aba
  **Resumo** seguem 100% mensais — a issue é da tela Fluxo de Caixa. `fluxo-tabela.ts` **não precisou de
  mudança**: recebendo o `FluxoCalc` agregado, a tabela já renderiza uma coluna por período.
- **Doc:** `docs/viabilidade/padrao-incorporacao.md` § 3.2 ganhou o parágrafo das views Mensal/Anual.
- **Validação:** frontend isolado — **typecheck ✓ · testes 88/88 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~278.9kb). **6 testes novos**: 4 de `periodosAnuais`
  (anos parciais, ano cheio, degradação sem data, cobertura sem furo/sobreposição) e 2 de
  `agregarFluxoPorPeriodos` (soma anual = soma mensal em todas as linhas e tipologias; acumulado =
  saldo do último mês do ano + indicadores inalterados). Sem schema/backend → empacotamento não se
  aplica. ⏳ Render real dos badges e das colunas anuais só valida no deploy dev.

### Sessão S19 — Cenários: Tabela de Salvos — ✅ IMPLEMENTADA (issue #130)
Branch `claude/sessao-s19-merge-prs-7q8wuz`. Mudança **100% frontend** (`frontend/tela-cenarios.ts`) —
sem schema/backend/migração; `versao` intacta. Pré-requisito S16: concluído e na `main`.

- **#130 (linha do Cenário real travada como primeira linha da tabela de Cenários salvos):** nova
  `_linhaReal(base)` renderiza uma `<tr class="linha-real">` sempre em primeiro na tabela `table.cen`,
  usando o `FluxoCalc` **base** (`{ precoVendaPct: 0, custoObraPct: 0 }`) já calculado em `render()` —
  o mesmo cenário sem alterações que alimenta o gráfico "base × cenário". Colunas Preço venda/Custo
  obra mostram `—` (não são deltas aplicáveis à base) e a última coluna (ação) fica vazia — **sem**
  botão Remover, tornando a linha não removível. Ícone `fa-solid fa-lock` + destaque visual
  (`font-weight: 700` + fundo `var(--cor-primaria-fundo)`, tokens já usados em `tela-proforma.ts`).
- **Tabela sempre visível:** antes, `cenarios.length === 0` trocava a tabela inteira por
  `urbi-estado-vazio`; agora a tabela **sempre** renderiza (a linha real é permanente), e o estado
  vazio vira uma mensagem complementar **abaixo** da tabela só quando não há cenários salvos pelo
  usuário ainda.
- **Validação:** frontend isolado — **typecheck ✓ · testes 88/88 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~279.6kb). Sem schema/backend → empacotamento
  não se aplica. ⏳ Render real da linha travada só valida no deploy dev.

### Sessão S20 — Cenários: Gráfico Tracejado & Variação % — ✅ IMPLEMENTADA (issues #131, #132) — **ÚLTIMA DA RODADA 3**
Branch `claude/sessao-s20-issues-finais-9qwt68`. Mudança **100% frontend** (`frontend/tela-cenarios.ts`,
`frontend/fluxo-graficos.ts`, `frontend/fluxo-tabela.ts` + novo módulo puro `frontend/cenario-variacao.ts`
e seu teste) — sem schema/backend/migração; `versao` intacta. Pré-requisitos S16/S19: concluídos e na `main`.

- **#131 (linha tracejada em tempo real ao mover os sliders):** a segunda curva já existia desde a
  Etapa 8/#56 (`graficoCenarioAcumulado` desenhava base cheia + cenário tracejado) e o redesenho já
  era automático (os deltas moram em `@state`, então cada `input` do slider re-renderiza o SVG). O que
  faltava — e é o que S20 entrega — são as **duas falhas que tornavam esse comportamento inútil na
  prática**:
  1. **Tracejada fantasma na base.** Com os sliders em zero a curva do cenário era idêntica à da base e
     desenhada **por cima** dela, escondendo a linha sólida e sugerindo que havia dois cenários quando
     só havia um. Agora `graficoCenarioAcumulado` aceita `cenario: FluxoCalc | null` e o hospedeiro
     passa `null` enquanto `precoPct === 0 && custoPct === 0`: **a tracejada nasce ao mover o primeiro
     slider**, exatamente como o issue descreve. A legenda acompanha (só "Cenário real" na base) e
     ganhou o **rótulo com os deltas vivos** (`Cenário · preço +5% · obra -3%`) via novo parâmetro
     `rotuloCenario`; foi movida para o canto superior **esquerdo** para caber rótulo longo.
  2. **Redesenho não era barato o bastante para ser "tempo real".** Cada quadro do arraste recalculava
     o motor para a base, para o cenário vivo **e para cada cenário salvo** da tabela — N+2 execuções de
     `calcularFluxo` por pixel arrastado. Novo `cacheCalc: Map<string, FluxoCalc>` em `tela-cenarios.ts`
     memoiza por par de deltas (`"preco|custo"`): base e cenários salvos são calculados **uma vez**, e
     arrastar de volta a um valor já visitado é lookup. Cache limitado a `LIMITE_CACHE = 240` entradas
     (esvazia ao estourar) e **zerado em `_carregar`**, já que um `baseConfig` novo invalida tudo.
- **#132 (seta ↑/↓ + variação % nos KPIs e badge na tabela de salvos):** genuinamente novo.
  - **Novo módulo puro `frontend/cenario-variacao.ts`** — `calcularVariacao(novo, base, maiorMelhor)`
    → `{ pct, melhor, texto }` ou `null`. A regra que exigia teste é a **direção**: ela não vem do
    sinal da variação, vem do indicador. Os quatro KPIs afetados são "maior é melhor" — **inclusive a
    Exposição máxima**, que é `min(fluxoAcumulado)` e portanto negativa: ir de −1.000 para −800 é
    **melhora** de +20%. Por isso a variação normaliza pelo **módulo** da base (senão o sinal
    inverteria em indicadores negativos). Devolve `null` — nada é pintado — quando algum valor não é
    finito, quando a base é zero (sem denominador) ou quando |pct| < 0,05 (arredondaria para 0,0%).
    **6 testes novos** cobrem cada um desses ramos.
  - **KPIs:** `kpisFluxo(c, base?)` ganhou 2º parâmetro **opcional**. Com ele, Resultado · TIR · VPL ·
    Exposição máxima exibem `urbi-icone` de seta + o percentual no canto superior direito do próprio
    card, verde se melhor / vermelho se pior. **Payback ficou de fora de propósito**: é uma data, não
    um escalar comparável. Sem o 2º parâmetro o componente renderiza **exatamente como antes** — as
    abas Fluxo de Caixa (`tela-fluxo-ver`) e Resumo seguem intactas.
  - **Tabela de salvos:** `urbi-badge` (`sucesso`/`perigo`) à direita do valor em VPL, TIR e Exposição
    máxima de cada cenário salvo, comparando contra a linha do Cenário real (S19/#130). A própria
    linha real não recebe badge — ela **é** a referência.
- **Decisão registrada (por que não mexer no `urbi-kpi` do shell):** `urbi-kpi` só expõe
  `rotulo`/`valor`/`variante` e **não renderiza slot**, então não há como injetar a seta por dentro do
  primitivo. O caminho "correto" pelo `ui.md` seria estender o primitivo no monorepo — mas isso
  obrigaria a **bumpar `shell_min` (0.50.3)**, que é contrato inegociável do app, por um indicador de
  uma única tela. Os dois issues escopam explicitamente `frontend/tela-cenarios.ts`. Optei por ancorar
  o indicador na **célula do grid** (`.kpi-cel { position: relative }` + `.kpi-var` absoluto), CSS que
  vive no `static styles` do próprio app — mesmo padrão de `.fx-kpis`/`.fx-wrap` já usado aqui. **Se
  o padrão se repetir noutra app, aí sim vale promover `variacao` a prop do `urbi-kpi`.**
- **Faxina de contrato (varredura final):** o único `<i class="fa-solid fa-lock">` do frontend (linha do
  Cenário real, introduzido em S19) virou `<urbi-icone classe="...">` — o `ui.md` do shell proíbe
  `<i class="fa-...">` cru no consumidor. Varredura confirma **zero** ocorrências de `<i class=` e zero
  emoji unicode de status no frontend. As cores literais restantes em `exportar.ts` **não são
  violação**: são o CSS de documentos HTML autônomos de impressão/PDF, abertos fora do escopo das
  variáveis do shell, onde `var(--cor-*)` não resolve.
- **Validação:** frontend isolado — **typecheck ✓ · testes 94/94 ✓** (88 + 6 de `cenario-variacao`)
  **· build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~282.5kb). Sem
  schema/backend/migração → `urbi-empacotar` e suíte de backend não se aplicam a esta sessão.
  ⏳ Render real da tracejada, das setas nos KPIs e dos badges só valida no deploy dev.

---

## 🏁 Rodada 3 (bugs.xlsx) — CONCLUÍDA

As **62 issues #71–#132** das **20 sessões** de `docs/sessoes-bugs-2026-07-25.md` estão todas
implementadas e fechadas. Nenhuma issue aberta resta no repositório ao fim da S20.

**Pendências herdadas que permanecem com o autor (ambiente autenticado, SDK gated) — não são desta
sessão, mas seguem valendo antes de publicar:**
- `pnpm typecheck` completo (backend), suíte de backend e `pnpm exec urbi-empacotar viabilidade`.
- **Execução das migrações 001–005** contra dados reais (`versao` do manifesto está em **0.1.4**).
- Render real no deploy dev de tudo que só se vê no shell: primitivos `urbi-*`, uploads, Gantt,
  modais, tabelas sticky e os gráficos SVG.

### Verificação final de encerramento (2026-07-26)

Varredura estática do repo inteiro antes do release. **Nada quebrado encontrado**; dois atributos
inertes corrigidos e uma dívida histórica documentada.

**Integridade estrutural — tudo verde:**
- **JSON:** `schema.json` (15 tabelas), `manifesto.json`, `package.json`, `tsconfig.json` parseiam.
- **Componentes:** 22 `@customElement` declarados; **36/36 arquivos de frontend alcançáveis a partir
  de `index.ts`** (zero órfãos); zero tags `viab-*` usadas sem definição; zero componente definido em
  arquivo não importado. `telas_config` do manifesto aponta para componentes que existem.
- **Primitivos:** os **24** `urbi-*` usados pela app existem no `ui/` do shell (conferido um a um).
- **Eventos:** todo `@urbi:*` / `@viab:*` ouvido pela app é emitido por alguém — zero handler morto.
- **Rotas:** 40 rotas de backend × 44 chamadas do frontend cruzadas; nenhuma chamada sem rota. As
  únicas rotas não chamadas pela UI são falsos positivos (`Map.get('obra')` etc.) e a
  `POST /manutencao/arquivar-inativos`, que é **de agendador/admin por desenho** (ver pendência
  histórica do arquivamento automático, abaixo).
- **Contratos:** zero `instanceof` no backend · build sem `--packages=external` · `shell_min`
  `0.50.3` · nenhuma rota com o prefixo `/api/viabilidade` hardcoded (só em comentário) · nenhum
  `INSERT`/seed dentro de migração · `.gitignore` cobre `dist/`, `node_modules/`,
  `frontend/index.js` e `backend/rotas.js`, e nenhum output de build está rastreado — o **gate Git
  do `urbi-release`** (que aborta com árvore suja) passa.

**Dois atributos inertes corrigidos** (falha silenciosa: prop inexistente num primitivo não dá erro,
simplesmente não faz nada):
- `tela-fluxo-receitas.ts` — `<urbi-badge ?desabilitado=…>` nos chips de periodicidade. `urbi-badge`
  só declara `cor`/`interativo`/`ativo`, então a periodicidade já usada por outra linha **parecia
  clicável**. O clique já era barrado pelo próprio handler (comportamento estava correto); faltava o
  sinal visual. Trocado por `class="indisponivel"` + CSS local (`opacity`/`cursor`). **Sem** mexer no
  primitivo — `urbi-badge` não tem conceito de desabilitado e criá-lo exigiria bump de `shell_min`.
- `tela-fluxo-cronograma.ts` — `<urbi-input estilo="compacto">`. `urbi-input` não declara `estilo`;
  atributo removido (era no-op).

**Dívida histórica documentada (não corrigida de propósito):** a migração `004_fases_gantt.js` entrou
na Etapa 4 (commit `85a6429`) **sem bump de `z`** — viola "toda migração nova acompanha bump de `z`"
(`docs/shell/distribuicao.md` § Identidade dupla). **Não há dado em risco:** o runner é sequencial
por número e aplica todas as pendentes, então a 004 subiu junto com a 005 no bump 0.1.3 → 0.1.4 da
Etapa 8. Corrigir agora (bumpar para 0.1.5 sem migração nova) só criaria um degrau vazio e seria
*outro* desvio da mesma regra. Fica registrado como precedente a não repetir.

### Prontidão para o release (verificada)

Último release publicado: **`viabilidade-v0.1.4_79cbe46c`** (2026-07-22). **Toda a rodada 3 está
fora dele** — 40 commits desde então.

- **Versão continua 0.1.4, e isso está certo.** `git diff 79cbe46c..main -- migracoes/ schema.json
  manifesto.json` é **vazio**: a rodada 3 foi 100% frontend. A regra é `z` só bumpa com migração —
  não bumpar é o comportamento correto.
- **O upgrade é elegível assim mesmo.** A plataforma instala por versão maior **ou** por mesma
  versão com `build_sha` à frente (ancestralidade git). Verificado: `79cbe46c` **é ancestral** da
  `main` atual → o `compare` do GitHub devolve `ahead` → upgrade do tipo **`build`**.
- **Como publicar:** Actions → `release` → **Run workflow** (`workflow_dispatch`). O workflow deriva
  a tag `viabilidade-v0.1.4_<sha8>` sozinho, **com o sha** — indispensável, porque tag sem sha trava
  o upgrade dentro da mesma versão. Precedente na prática: já houve `0.1.0` e `0.1.4` publicados
  várias vezes com sha8 diferente, e o canal repo reconheceu cada um.

---

## Rodada 2 — Etapas (2026-07-22)

### Etapa 8 — Cenários — ✅ IMPLEMENTADA (issue #56)
Branch `claude/etapa-8-npe1vk`. Toca **schema + backend + frontend + motor**. `versao` **0.1.3 → 0.1.4**
(migração `migracoes/005_cenarios.js` — tabela nova `avancado_cenarios`). Pré-requisitos #39 (Etapa 3) e
motor de fluxo: ambos concluídos. Última etapa da rodada 2.

- **Decisão-chave (não repurposar `viab-tela-graficos`):** `viab-tela-graficos` é **dual-use** — é a aba
  **Gráficos** do **Preliminar** (`tela-estudo.ts`) *e* era a aba **Cenários** do Avançado (`tela-avancado.ts`).
  Reconstruir a Cenários dentro dela quebraria o Preliminar (que não tem fluxo/receitas/custos do Avançado).
  Por isso criei um componente **novo** `frontend/tela-cenarios.ts` (`viab-tela-cenarios`) só para o Avançado
  e reapontei o `case 'cenarios'` de `tela-avancado.ts` para ele. **O Preliminar segue intocado** com
  `viab-tela-graficos` (pizza/barras/áreas/medidores).

- **#56 (reconstrução da página Cenários):**
  - **Motor reparametrizado** (`fluxo-caixa-motor.ts`): nova função pura `aplicarCenario(config, {precoVendaPct,
    custoObraPct})` que devolve uma **nova** `FluxoConfig` escalando o `preco_m2` de **todas** as tipologias
    (preço de venda) e o `orcamento_valor` das linhas `grupo==='obra'` (custo de obra). `calcularFluxo(aplicarCenario(...))`
    dá o fluxo do cenário. Função **não muta** a base (testado). `0/0` = base.
  - **Sliders (esquerda):** `<input type="range">` (não há primitivo `urbi-slider` no shell) com limites vindos
    dos **benchmarks de sensibilidade** — `campo === 'preco'` e `campo === 'custo_obras'`, faixa `[-variacao_negativa_pct,
    +variacao_positiva_pct]` (padrão ±15% sem benchmark). Arrastar recalcula o fluxo em tempo real.
  - **Gráfico de linha (direita):** novo `graficoCenarioAcumulado(base, cenario, …)` em `fluxo-graficos.ts` —
    fluxo acumulado com **base (linha cheia)** + **cenário (linha tracejada roxa, `--cor-primaria`)** na mesma escala,
    com legenda e marcos do cronograma.
  - **Fluxo do cenário (largura inteira):** os **mesmos campos da aba Fluxo de Caixa** — KPIs + tabela mensal sticky.
    Para não duplicar ~150 linhas, extraí a tabela/KPIs para o módulo puro **`frontend/fluxo-tabela.ts`**
    (`estiloFluxoTabela`, `kpisFluxo`, `tabelaFluxo`, `chavesColapso`) e **refatorei `tela-fluxo-ver.ts`** para consumi-lo
    (mesmo padrão do Lote 8, que extraiu `fluxo-graficos.ts`). Fluxo de Caixa e Cenários renderizam tabela idêntica.
  - **Tabela de cenários salvos (fim):** persistem **permanentemente** no estudo (nova tabela `avancado_cenarios`).
    Colunas = indicadores (Preço venda · Custo obra · VPL · TIR · Payback · Exposição máx.), **recomputados** por
    `aplicarCenario` a cada render; cada linha com **botão remover** (modal de confirmação). Salvar + nomear na mesma
    área dos sliders (botão "Salvar cenário"; nome default derivado dos deltas se vazio).

- **Schema/backend (validação no ambiente do autor — SDK gated):**
  - `schema.json`: nova tabela **`avancado_cenarios`** (`estudo_id` FK cascata, `nome`, `preco_venda_pct` decimal(6,2),
    `custo_obra_pct` decimal(6,2), `ordem`).
  - `migracoes/005_cenarios.js`: forward-only, `CREATE TABLE IF NOT EXISTS` (rede de segurança; o sincronizador do SDK
    também materializa a tabela do schema). Tabela nova → não transforma dado existente.
  - `manifesto.json`: `versao` 0.1.3 → **0.1.4**.
  - `backend/rotas/avancado.ts`: CRUD `GET/POST/PATCH/DELETE /estudos/:id/avancado/cenarios` (mesmo padrão de custos;
    `CAMPOS_CENARIO`), + cópia no `duplicarDadosAvancado` (cenários viajam com a duplicação do estudo).
  - `frontend/viabilidade-api.ts`: `listarCenarios`/`criarCenario`/`atualizarCenario`/`removerCenario`.

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 77/77 ✓** (+ `aplicarCenario`:
  escala preço/obra, terreno intacto, pureza, cenário-zero = base) **· build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~263.8kb). ⏳ **Pendente do autor (SDK gated):** typecheck do
  backend, suíte de backend, `urbi-empacotar` e a **execução da migração 005** contra dados reais. Render real dos
  sliders/gráfico de cenário só valida no deploy dev.

### Etapa 7 — Redistribuição de Premissas — ✅ IMPLEMENTADA (issues #53, #55, #54)
Branch `claude/etapa-7-pu7kqg`. Mudança **100% frontend** (sem schema, sem backend, sem migração).
`versao` intacta. Pré-requisitos #39 (Etapa 3) e Etapa 4: ambos concluídos.

- **#53 (Terreno → Empreendimento → Informações, só Avançado):**
  - `frontend/tela-empreendimento-info.ts`: adicionado **card "Dados do terreno"** abaixo do card
    de Informações. Para `origem_terreno === 'nucleo'`, exibe `viab-terreno-nucleo` (componente
    self-contained). Para `manual`, exibe `terreno_manual_nome` (urbi-input) + `terreno_manual_area`
    (viab-num, m²) editáveis. Para Incorporação (qualquer origem), adiciona `coef_aproveitamento_basico`
    e `coef_aproveitamento_maximo` no mesmo card. Botão "Salvar informações" (após o card de Terreno,
    antes dos Anexos) persiste tudo via `atualizarEstudo` incluindo os novos campos de terreno. `form`
    expandido para incluir `terreno_manual_nome`, `terreno_manual_area`, `coef_aproveitamento_basico` e
    `coef_aproveitamento_maximo`; `updated()` os inicializa a partir de `this.estudo`. Importados
    `./tela-terreno-nucleo.js` e `./viab-num.js`. Campo de área lido só (da versão anterior) removido
    do card de Informações (agora está no card de Terreno).
  - `frontend/tela-premissas.ts`: seção `Terreno` (grupo-a completo com nome, área, coeficientes e
    viab-terreno-nucleo) fica **oculta quando `nivel_analise === 'avancado'`** — o Preliminar não é
    afetado (a seção continua aparecendo normalmente).

- **#55 (Taxa de Desconto na aba Financeiro — double-check):**
  - `taxa_desconto_aa` **já estava** na aba Financeiro desde o Lote 7 — card "Custos Financeiros",
    `tela-financeiro.ts` linha 194. Nenhuma alteração de código necessária.
  - Backend: `CAMPOS_SOMENTE_AVANCADO` em `backend/rotas/estudos.ts` **já inclui** `taxa_desconto_aa`
    (linha 28) — ao salvar Premissas de um Preliminar, o campo é ignorado antes da validação do shell.
    Double-check confirmado: o campo não interfere no Preliminar.
  - Issue fechada por confirmação; nenhuma regressão introduzida.

- **#54 (Avaliar e excluir a aba Premissas — só Avançado):**
  - **Avaliação realizada.** Após #53, a aba Premissas em Viabilidade ainda contém: Áreas (pvt R/NR
    fechada/aberta, comum), Produtos (num_unidades, preco_venda_m2), Custos (construção, decoração,
    etc.), Impostos (sujeito_ret), Deduções (corretagem, marketing) e Permuta física R/NR.
  - **Decisão: MANTER a aba Premissas** para o Avançado. Motivo: `tela-resumo.ts` chama
    `calcularProforma({ ...this.estudo, ... })` (linha 105) para os KPIs de VGV, Resultado, Margem
    líquida e ROI e para a pizza de custos e os medidores de benchmark. Remover a aba eliminaria a
    superfície de edição desses campos → o Resumo exibiria zeros ou valores obsoletos nesses 4 KPIs e
    nos gráficos. A remoção completa exigiria refatorar o Resumo para derivar esses números do motor
    de fluxo (`calcularFluxo`), em vez das premissas estáticas — passo futuro a especificar à parte.
  - Issue fechada como "avaliada: manter Premissas até refatorar o Resumo".

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~252.7kb). Sem schema/backend/migração →
  empacotamento não se aplica. ⏳ Render real da nova seção Terreno em Informações só valida no
  deploy dev.

### Etapa 3 — Fundação de navegação — ✅ IMPLEMENTADA (issues #39, #40)
Branch `claude/etapa-3-r86dld`. Mudança **100% frontend** (só o chassi de navegação do
Avançado; sem schema/backend/motor/migração). `versao` intacta. Pré-requisito das Etapas 4–8.

- **#39 (urbi-nav lateral + urbi-abas no topo):** `frontend/tela-avancado.ts` trocou o chassi
  de navegação do Avançado. **Nível 1 (páginas)** deixou de ser `urbi-abas` de topo e virou
  **`urbi-nav` lateral** (lista à esquerda), na ordem pedida: Resumo · Empreendimento ·
  Viabilidade · **Custos** · Fluxo de Caixa · Cenários · Análise de mercado. **Nível 2 (seções)**
  deixou de ser `urbi-badge` de sub-nav e virou **`urbi-abas` no topo da página**, com **nome +
  ícone** (FontAwesome via `icone`) por aba — só nas 3 páginas com múltiplas seções
  (Empreendimento: Informações/Cronograma/Tipologias; Viabilidade: Premissas/Receitas/Financeiro;
  Custos: Terreno/Obra/Diretos/Indiretos/Financeiro). **Nenhuma tela de conteúdo foi reescrita** —
  o roteamento de `_renderSubConteudo` (lotes 4–8) é o mesmo; só o container mudou.
- **Sync de URL preservado:** a página ativa continua vindo da prop `.aba` (URL
  `/detalhe/:id/:aba`) e o `urbi:nav-selecionar` re-emite o **mesmo** evento `viab:aba-topo` que
  `tela-estudo.ts` já escuta → **`tela-estudo.ts` não precisou mudar**. A aba de nível 2 segue
  como estado interno (`subAtiva`), fora da URL, como antes. Layout: flex-row (nav 210px sticky +
  conteúdo `flex:1`), que **empilha** (nav vira barra superior) em telas ≤900px.
- **#40 (renomear "Obra" → "Custos"):** o **rótulo** da página passou a **"Custos"** em `PAGINAS`.
  **Decisão (baixo risco):** o `id`/slug de rota permanece **`obra`** — muda-lo quebraria URLs
  salvas, a chave `SUBABAS.obra` e o roteamento `.grupo` de `viab-fluxo-custos`. Só o texto visível
  mudou, que é o que a issue pede ("renomear a página").
- **Contrato dos primitivos (confirmado nos docs do shell):** `urbi-nav` (`.secoes`
  `UrbiNavSecao[]`, `ativo`, evento `urbi:nav-selecionar {id}`) — `docs/shell/ui-componentes-conteudo.md`;
  `urbi-abas` (`icone` FontAwesome por aba, `urbi:aba-selecionar {id}`) —
  `docs/shell/ui-componentes-layout.md`. Nenhuma mudança no shell. Nota: `UrbiNavItem` não tem
  campo de ícone (só label/descricao/indicador) → a lista lateral é textual; o ícone mora nas abas.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild)
  ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~240.8kb). Sem schema/backend →
  empacotamento não se aplica. ⏳ Render real do `urbi-nav`/`urbi-abas` aninhados só valida no
  deploy dev.

### Etapa 4 — Cronograma + Tipologias — ✅ IMPLEMENTADA (issues #41, #42, #43, #44, #45)
Branch `claude/etapa-4-cronograma-tipologias-0dhw04` (commit `85a6429` mergeado direto na `main`).
Toca **schema + backend + frontend** (migração `migracoes/004_fases_gantt.js` — colunas aditivas
`inicio_mes`/`duracao_meses` em `avancado_fases`). Pré-requisito #39 (Etapa 3): concluído.

- **#41 (5 fases padrão com cores distintas):** `EVENTO_COR` em `fluxo-shared.ts` ganhou 5 tokens
  semânticos distintos — `planejamento` → `--cor-info`, `pre_lancamento` → `--cor-alerta`,
  `lancamento` → `--cor-sucesso`, `obra` → `--cor-primaria-solida`, `pos_obra` → `--cor-erro`. A tabela
  de cronograma exibe `border-left` colorida pelo token de cada fase; o ponto-cor (bolinha) cresceu de
  8px para 10px. `corFaseExtra(idx)` reusa a mesma paleta de 5 tokens ciclicamente para fases extras.

- **#42 (CRUD de fases comerciais no Cronograma):** colunas `inicio_mes` (int, padrão 0) e
  `duracao_meses` (int, padrão 12) adicionadas a `avancado_fases` via **migração 004** (forward-only,
  `ADD COLUMN IF NOT EXISTS`). Backend PATCH atualizado (`CAMPOS_FASE`). Frontend
  `tela-fluxo-cronograma.ts` — seção "Fases comerciais" abaixo das 5 fixas: edição inline de
  nome/início/duração e botão Remover por linha; botão "Adicionar fase" no rodapé; fases aparecem
  como **barras tracejadas** no gantt SVG com paleta de tokens cíclica.

- **#43 (emojis no gantt):** ⭐ posicionado acima da barra do evento `lancamento` (sempre 1 mês —
  renderizado como círculo); 🔑 ao final (`xFim + 4`) da barra do evento `obra`. Ambos renderizados
  como `<text>` no SVG, sem dependência externa.

- **#44 (largura/alinhamento das colunas de Tipologias):** `table-layout: fixed` + `<colgroup>` com
  larguras explícitas (Nome `auto` · Tipo 160px · Área 130px · Dorm/Vagas 90px · Unidades 100px ·
  Permutadas 200px · Ação 90px). Cabeçalho e células alinhados uniformemente; `overflow: hidden` nas
  células.

- **#45 (texto calculado de permutadas):** à direita do campo `unidades_permutadas`, um
  `<div class="perm-calc">` (0.72rem, `--cor-texto-sec`) com **% de unidades permutadas** e **m²
  permutados**, exibidos só quando `perm > 0`. Rodapé de totais também mostra a área total permutada
  (`Σ permutadas × área`).

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~225kb). ⏳ **Pendente do autor (SDK gated):**
  typecheck do backend, suíte de backend, `urbi-empacotar` e a **execução da migração 004** contra dados
  reais (ADD COLUMN IF NOT EXISTS — sem risco para dados existentes). Render real das barras do gantt
  e do alinhamento das tabelas só valida no deploy dev.

### Etapa 5 — Custos (unidade por categoria + coluna de resultado) — ✅ IMPLEMENTADA (issues #46, #47)
Branch `claude/etapa-5-p24nm1`. Toca **schema + frontend + motor** (sem backend, sem migração).
`versao` intacta — só adição de opção ao `orcamento_unidade` (genesis; sincronizador aplica).
Pré-requisitos #39 e #40: concluídos (Etapa 3).

- **#46 (unidade dependente da categoria):** o seletor de unidades por badge passou a ser **filtrado
  por categoria** via o mapa `UNIDADES_CAT` (Partial Record por grupo+categoria). Por aba:
  - **Terreno:** Preço → `R$`/`R$/m² terreno`; Outorga/Outro → `R$`/`% VGV`; Registro → `R$`/`R$/m² priv`.
  - **Obras:** Obra/Decoração → `R$`/`R$/m² priv`; Gestão da obra → `R$`/`% Obra` (nova unidade!);
    Contingência/Outro → `R$`/`% VGV`.
  - **Diretos** (categorias **atualizadas**): Marketing & Publicidade → `R$`/`% VGV`; Comissão de
    vendas → somente `% VGV`; Projetos/Licenças e Aprovações → `R$`/`R$/m² priv`; Outro → `R$`/`% VGV`.
  - **Indiretos** (categorias **atualizadas**): Marketing global/Stand de vendas/Gestão/Outro → `R$`/`% VGV`.
  - **Financeiro:** sem restrição (todas as unidades).
  - Quando a **categoria muda**, a unidade atual é verificada: se não estiver na lista permitida,
    reseta para a primeira da lista (`_salvarCategoria` + `_unidsPerm`). Evita dados incoerentes.
- **Nova unidade `% Obra`:** aplicada a "Gestão da obra" no grupo Obras. O `%` multiplica o
  **total do grupo Obra** (soma das linhas com `grupo=obra` excluindo as próprias linhas `pct_obra`).
  - `schema.json`: `orcamento_unidade.opcoes` += `pct_obra` (genesis aditivo; sem migração).
  - `fluxo-shared.ts`: `ContextoCusto` += campo opcional `totalObra`; `resolverCustoTotal` trata
    `case 'pct_obra'`.
  - `fluxo-caixa-motor.ts`: computa `ctxCusto.totalObra` (2ª passagem sobre linhas de obra
    excluindo `pct_obra`) antes do loop de custos — sem circularidade.
  - `tela-fluxo-custos.ts`: getter `_totalObra` reusa o mesmo cálculo; `_ctx()` injeta no contexto.
  - ⚠️ **Backend**: o validador de `orcamento_unidade` no genesis ainda não inclui `pct_obra`
    explicitamente — o schema.json foi atualizado mas o backend gated precisa rodar
    `urbi-empacotar` para aplicar o genesis. **Validação de backend no ambiente do autor**.
- **#47 (coluna Resultado + ajuste de larguras):**
  - Nova coluna **Resultado** imediatamente após Orçamento: exibe `fmtR$(resolverCustoTotal(c, ctx))`
    quando `orcamento_unidade !== 'rs'`; mostra `—` quando a unidade já é R$.
  - Largura do `viab-num` do Orçamento: 130px → **110px** (coluna mais estreita para caber o Resultado).
  - Largura do `viab-num` da Duração: 100px → **80px** (campo de no máx. 2 dígitos).
- **CATEGORIAS atualizadas — nota de migração:** os registros existentes no DB com as categorias
  antigas de Diretos (Decoração, Gestão da obra, Stand de vendas) e Indiretos (Projetos, Licenças,
  Marketing, Administração) continuarão exibindo seus valores no campo (o DB guarda string livre),
  mas a unidade não será filtrada para eles (UNIDADES_CAT não mapeia os nomes antigos → retorna
  todas as unidades como fallback). Sem perda de dado; só o dropdown de nova entrada muda.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild)
  ✓** (`bash scripts/validar-frontend.sh` verde; bundle ~248.2kb). ⏳ **Pendente do autor (SDK
  gated):** typecheck do backend, suíte de backend (inclui genesis com `pct_obra`) e `urbi-empacotar`.

### Etapa 6 — Receitas (layout, status, cores, save, saldo) — ✅ IMPLEMENTADA (issues #48–#52)
Branch `claude/etapa-6-69jii4`. Toca **frontend + backend** (sem schema, sem migração — a flag
`aplicado` mora dentro das colunas JSON `absorcao`/`fluxo_pagamento` já existentes). `versao` intacta.
Pré-requisito #39 (Etapa 3): concluído. Arquivo-alvo único no frontend: `frontend/tela-fluxo-receitas.ts`.

- **#48 (largura/alinhamento das colunas — mesmo bug do #44):** a tabela de alocações passou a usar
  **`table-layout: fixed` + `<colgroup>`** com larguras por coluna (Tipologia `auto` · Área 120 · Unidades 92 ·
  Saldo 68 · Preço/m² 110 · Preço unit. 120 · Preço total 120 · ação 92) + `overflow: hidden` em th/td,
  exatamente o padrão introduzido no #44 (Tipologias). Os campos (`viab-num`/`urbi-select`) passaram a
  `width: 100%` da célula, então **cabeçalho e campo alinham por coluna** (some o descasamento a partir de
  Unidades) e Área privativa fica encostada à esquerda com respiro em relação à Tipologia.
- **#49 (bola de status amarela→verde em Absorção/Fluxo):** cada botão ganhou um `<span class="stat">`
  (slot do `urbi-botao` herda os estilos deste componente). **Amarelo** (`var(--cor-alerta)`) = pendente,
  **verde** (`var(--cor-sucesso)`) = aplicado. O estado "aplicado" é persistido **dentro do próprio JSON da
  seção**: `_aplicarAbsorcao` grava `absorcao.aplicado = true` e `_aplicarPagamento` grava
  `fluxo_pagamento.aplicado = true`. Numa fase recém-criada os JSONs vêm sem a flag → bola amarela até o
  1º "Aplicar". Sem coluna nova (a flag é um campo aditivo no JSON, inócuo ao motor).
- **#50 (cores dos botões — Absorção roxo, Fluxo azul):** `Absorção de Vendas` → `variante="primario"`
  (roxo, cor primária/brand do UrbiVerso, token `--cor-primaria`); `Fluxo de Pagamento` → `variante="info"`
  (azul, token `--cor-info`). Só variantes do `urbi-botao` — nenhuma cor literal.
- **#51 (letras somem ao digitar + botão Salvar):** a raiz era o `nome` da fase persistir a **cada tecla**
  (`urbi:input-change` → PATCH assíncrono → re-render com `.valor` do servidor sobrescrevendo teclas mais
  novas). Agora o input escreve num **rascunho local** (`draftNome[faseId]`, estado do componente): digitar
  só atualiza o rascunho (sem round-trip), e o `.valor` sempre reflete o que foi digitado — nenhuma tecla se
  perde. Um botão **"Salvar"** (aparece só quando o nome está sujo, padrão dirty do #36) persiste via
  `_salvarFase` e limpa o rascunho. Demais campos são `viab-num`/`urbi-select` (numéricos/enum, sem o problema
  de digitação livre) — mantidos no fluxo de save direto.
- **#52 (saldo deve somar por TODAS as fases):** revê a decisão do Lote 6 ("trava por fase"). `_saldo` no
  frontend agora **agrega as alocações de todas as fases** por tipologia (quantidade do catálogo − Σ unidades
  em qualquer fase); `_tipologiasDisponiveis` e as opções do `urbi-select` seguem o mesmo saldo global.
  **Backend (`backend/rotas/avancado.ts`):** `saldoTipologiaNaFase` → **`saldoTipologiaNoEstudo`** (lista
  `avancado_alocacoes` por `tipologia_id`, que já é único por estudo, e soma tudo); POST/PATCH de alocação
  usam a nova trava, com mensagens de erro ajustadas ("somando todas as fases"). Assim não se aloca, no total,
  mais unidades do que o cadastrado em Tipologias.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build (esbuild) ✓**
  (`bash scripts/validar-frontend.sh` verde; bundle ~250.3kb). ⏳ **Pendente do autor (SDK gated):** typecheck
  do backend, suíte de backend e `urbi-empacotar` (a mudança de `saldoTipologiaNoEstudo` toca só lógica de
  validação, sem schema/migração). Render real dos botões coloridos/bolas de status só valida no deploy dev.

### Etapa 1 — Correções rápidas de UI (parcial: #34 e #36) — ✅ IMPLEMENTADA (issues #34, #36)
Branch `claude/etapa-1-sensibilidade-dirty-check-nm8x70`. Mudança **100% frontend** (sem
schema/backend/motor/migração). `versao` intacta.

**Nota:** #33, #35 e #37 já estavam implementados no código (commits anteriores da rodada);
apenas #34 e #36 foram o foco desta sessão.

- **#34 (indicadores da sensibilidade em tabela separada):** o código já separava corretamente
  as linhas em `linhasMonetarias` e `linhasIndicadores` e renderizava duas `<table class="pf
  sens">` distintas (a 2ª com `.sens-indicadores { margin-top: 20px }`). Confirmado por
  inspeção — nenhuma alteração necessária. Issue fechada.

- **#36 (dirty check por snapshot em Premissas):** a implementação anterior usava um booleano
  `_dirty = true` em qualquer chamada a `_set()`, mas **não desfazia o dirty** se o usuário
  revertesse o campo ao valor original. Implementado **deep comparison via snapshot**:
  - `_snapshot: Record<string, any>` (campo privado, não reativo) guarda uma cópia do form
    no momento do carregamento/save.
  - `_formDifereSnapshot()`: compara campo a campo (tratando `''`/`null`/`undefined` como
    equivalentes via `String(null)`) — retorna `true` só quando existe diferença real.
  - `_set()` agora atribui `this._dirty = this._formDifereSnapshot()` em vez de `= true` —
    assim reverter um campo ao valor original limpa o dirty automaticamente.
  - Após save bem-sucedido: `this._snapshot = { ...this.form }` atualiza o snapshot para
    refletir o estado recém-persistido → banner some.
  - `_init()` inicializa `_snapshot = { ...this.estudo }` junto com o form.

- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 77/77 ✓ · build
  (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde). Mudança puramente de frontend
  → empacotamento/backend não se aplicam.

### Etapa 2 — Backend & dados — ✅ IMPLEMENTADA (issues #24, #38)
Branch `claude/etapa-2-pykm15`. Toca **backend + frontend** (sem schema, sem migração).

- **#24 (campos do Avançado validados ao salvar Preliminar):** a raiz do bug é que ao
  salvar Premissas de um estudo Preliminar o frontend envia TODOS os campos do objeto
  estudo (incluindo os da aba Financeiro/Avançado, que chegam como `null`). O shell,
  ao receber `campo_numerico: null` no payload, dispara "deve ser um número". **Fix
  backend (`backend/rotas/estudos.ts`):** nova constante `CAMPOS_SOMENTE_AVANCADO` (28
  campos — `taxa_desconto_aa`, estrutura de capital, juros, impostos, financiamento,
  investidor etc.); no handler `PATCH /estudos/:id`, quando `nivel_analise ===
  'preliminar'`, campos dessa lista são ignorados antes de chegar ao validador do shell.
  Assim, salvar Premissas de um Preliminar nunca mais envia valores `null` para campos
  exclusivos do Avançado.
- **#38 (lista do Núcleo incompleta + paginação):** `listarGlebasNucleo` /
  `listarLotesNucleo` em `viabilidade-api.ts` agora aceitam `pagina` e `porPagina`
  (padrão 100 itens/página) e repassa esses parâmetros ao shell. O componente
  `viab-terreno-nucleo` ganha estado `_pagina` e `_totalItens`; exibe indicador
  "Página X de Y (Z glebas/lotes)" + botões Anterior/Próxima quando há mais de uma
  página. Reset para página 1 ao trocar de estudo.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ ·
  build (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde). ⏳ **Pendente do
  autor (SDK gated):** typecheck do backend, suíte de backend e `urbi-empacotar`.

---

## Mapa de repositórios (na máquina)

| Repo | Caminho | Papel |
|---|---|---|
| **viabilidade-real-estate** | `C:\Users\Rafael.gualberto\viabilidade-real-estate` | **Este repo** — a app sendo construída (app na raiz) |
| **urbiverso** (monorepo shell) | `C:\Users\Rafael.gualberto\urbiverso` | Fonte de verdade: `docs/shell/*.md`, `nucleo/`, `shell/`, `apps/` |
| **urbiverso-apps-gestao** | `C:\Users\Rafael.gualberto\urbiverso-apps-gestao` | Apps vivas modelo: `okr/`, `recrutamento/`, `dd/` — **copiar padrão, não reinventar** |

> ⚠️ O `sdk/README.md` citado no README **não existe** localmente no monorepo. O `@urbiverso/sdk` só está disponível via GitHub Packages (`npm.pkg.github.com`). Contratos de `req.*` foram lidos de `docs/shell/*.md` e das apps modelo.

> ℹ️ O monorepo da plataforma mudou de endereço: `UP-Urbita/urbiverso` → **`urbiverso/urbiverso`** (mesma org do SDK e das apps). URLs antigas ainda redirecionam; atualizar remotes/bookmarks. Só o endereço mudou — issues/PRs/branches vieram junto.

---

## Rodada correção 2026-07 — plano (`lista_bugs.csv`)

> Nova rodada de refinamento, guiada pelo documento `prompt-correcao-viabilidade`.
> **Uma etapa por sessão.** Numeração dos itens é a da `lista_bugs.csv` — **independente**
> da rodada "lista bugs.xlsx" (2026-07-15) mais abaixo, cujos `#N` são outra lista.
> 14 itens em escopo; **itens 12 e 16 removidos do escopo pelo autor** — não tocar.

**Baseline Etapa 0 (verde):** typecheck ✓ · build ✓ (frontend 102.7kb · backend 841.2kb) ·
test 25/25 ✓ · empacotar ✓ (via PowerShell; o `tar` do Git Bash falha em paths `C:` —
**usar PowerShell para `urbi-empacotar` neste ambiente**).

| Item | Descrição | Etapa | Área |
|---|---|---|---|
| 1 | Benchmark vira aba de topo (nível de Estudos/Terrenos), fora do detalhe do Estudo | **1** | manifesto/nav + frontend |
| 2 | Separar Indicador de **Benchmark** (meta, `regra_comparacao`) de Indicador de **Sensibilidade** (`variacao_*_pct` → cenários) | **1** | schema/frontend |
| 3 | Botão de Membros com UI errada → seguir contrato `urbi-botao` | **2** | frontend (UI) |
| 4 | Label de campo em 2 linhas desalinha a fileira → alinhar por grid/altura fixa | **2** | frontend (UI) |
| 6 | Padronizar `urbi-input*` em **3 larguras** (%/R$m²/coef · área/moeda · texto/select) | **2** | frontend (UI) |
| 5 | **Troca de unidade por badge interativa** com recálculo correto (CRÍTICA) | **3** | frontend + engine |
| 7 | Detalhar nº e preço médio por unidade **R e NR** em Premissas e Proforma | **4** | frontend + engine |
| 8 | Nova **coluna de descrição** na Proforma (2ª col, texto menor itálico) | **5** | frontend (tabela) |
| 9 | Linhas de consolidação: inverter posições + adicionar **"Deduções sobre VGV"** | **5** | frontend + engine |
| 10 | **Permuta física detalhada** (m² e % área privativa; R e NR em linhas separadas) | **5** | frontend + engine |
| 13 | Remover memo "Permuta física entregue" + renomear "Gestão e outros indiretos" → "…custos indiretos" | **5** | frontend + premissas |
| 11 | Cenários **Bear/Base/Bull** em `urbi-badge` estático colorido | **6** | frontend (UI) |
| 14 | **Pizza de alocação de áreas** (Loteamento e Incorporação; Inc com subgrupo geral+macro) | **7** | frontend (gráficos) |
| 15 | **Medidores de indicadores** por benchmark (Custo obra/VGV invertido) | **7** | frontend (gráficos) |
| ~~12~~ | ~~fora do escopo (decisão do autor)~~ | — | — |
| ~~16~~ | ~~fora do escopo (decisão do autor)~~ | — | — |

**Etapa 8:** fechamento + empacotamento. Não bumpar `versao` salvo migração de schema.

### Etapa 0 — ✅ CONCLUÍDA (reconhecimento + baseline)
Fontes de verdade confirmadas no monorepo `C:\Users\Rafael.gualberto\urbiverso\urbiverso\`
(`docs/shell/ui-componentes-conteudo.md`, `ui-componentes-layout.md`, `nucleo.md`, `ia.md`,
`sdk/src/contrato.ts`) e apps-modelo em `urbiverso-apps-gestao/`. Nenhuma correção feita.

### Etapa 1 — ✅ CONCLUÍDA (itens 1 e 2 — navegação + separação benchmark/sensibilidade)
- **Item 1 (Benchmark como aba de topo):** a aba de topo `/benchmarks` **já existia e
  funcionava** no dashboard (`tela-dashboard.ts` aba `benchmark` → `viabilidade-config-benchmarks`),
  honrando o `nav`/`telas_config.benchmarks` do manifesto. O que sobrava era a **5ª aba
  "Benchmarks" dentro do Estudo** (introduzida como #12 na rodada 2026-07-15). Removida de
  `tela-estudo.ts`: tirado o item de `_abas`, o `<urbi-hospedeiro slot="benchmarks">`, o
  `Aba`='benchmarks', o import e o helper `_ehAdmin` (que só servia àquele slot). Benchmark
  agora é **exclusivamente** aba de topo, no nível de Estudos/Terrenos.
- **Item 2 (separar os dois indicadores):** `viabilidade-config-benchmarks.ts` agora exibe **duas
  seções distintas** sobre as mesmas linhas da tabela `benchmarks` (genesis intacto):
  1. **Indicador de Benchmark** — colunas Indicador · Valor · Regra (`valor` + `regra_comparacao`);
     é a meta que alimenta os avisos verde/vermelho e a comparação de resultado.
  2. **Indicador de Sensibilidade** — colunas Indicador · Var + (%) · Var − (%)
     (`variacao_positiva_pct`/`_negativa_pct`); é a faixa dos cenários Bear/Base/Bull.
  Schema confirmado: a tabela `benchmarks` já suporta os dois papéis na mesma linha. Leitura já
  era separada — comparação de meta lê `valor`; os cenários leem os campos do **estudo**
  (`estudos.sensibilidade_variacao_*_pct`, fallback 10). **Decisão registrada:** não reconectei o
  cálculo dos cenários para consumir `benchmarks.variacao_*_pct` (risco de regressão e fora do
  escopo "UI/leitura" do item 2); as faixas globais servem como referência/padrão por tipo.
- **Nota de rota:** esta etapa **reverte** a decisão #12 da rodada "lista bugs.xlsx" (benchmark
  dentro do estudo). Conforme regra do documento, os itens desta rodada vencem.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 102.7→103.0kb · backend 841.2kb) ·
  test 25/25 ✓ · empacotar ✓ (PowerShell). Sem alteração de schema/migração; `versao` intacta.

### Etapa 2 — ✅ CONCLUÍDA (itens 3, 4, 6 — layout de formulário em Premissas)
- **Item 3 (botão de Membros com UI errada):** o contrato de `urbi-botao`
  (`docs/shell/ui-componentes-conteudo.md` §urbi-botao) só admite `variante` =
  `primario|secundario|perigo|sucesso` — **`fantasma` não existe** no contrato. O botão Membros
  usava `variante="fantasma"`; trocado para **`secundario`** (padrão das apps-modelo: 56 usos de
  `secundario` para ações secundárias). ⚠️ **Observação (não corrigida — fora do escopo do item 3):**
  há outros botões `fantasma` espalhados (tela-estudo "Devolver ao rascunho", tela-dashboard,
  config-benchmarks). Se forem inválidos em runtime, tratar numa varredura própria.
- **Item 4 (label de 2 linhas desalinha a fileira):** `viab-num` e o campo composto (`.cu-rotulo`)
  agora reservam **altura fixa de 2 linhas** no rótulo (`min-height: 2.4em; line-height: 1.2`),
  ancorado ao rodapé (`align-items: flex-end`) — o espaço de reserva fica acima do texto, mantendo
  o gap rótulo→campo constante e alinhando todos os campos da fileira, com label de 1 ou 2 linhas.
  Só afeta `viab-num` **com label** (exclusivo de Premissas); células de tabela/`cu-valor` não têm
  label. Nota: `urbi-input` (texto) tem label interno do primitivo, fora do nosso alcance — na
  prática os poucos labels de texto (p3) são de 1 linha, então o alinhamento se mantém.
- **Item 6 (três larguras de campo):** o `.grid` de Premissas deixou de ser `grid auto-fill 1fr`
  (largura uniforme) e virou **flex-wrap com 3 larguras fixas** por classe: **p1 (165px)** para
  `%`/`R$/m²`/coeficientes; **p2 (210px, default)** para área (`m²`)/moeda (`R$`) e numéricos sem
  sufixo; **p3 (330px)** para texto livre e o campo composto com select. Classe derivada em
  `larguraClasse(campo)` a partir do sufixo/tipo (coef marcados com `w:'p1'`). `max-width:100%`
  evita overflow em telas estreitas. `urbi-input`/`urbi-input-numero` não têm prop de largura — o
  controle é do container (confirmado no contrato).
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 103.0kb estável · backend 841.2kb) ·
  test 25/25 ✓ · empacotar ✓ (PowerShell). Frontend puro (CSS/tokens); sem cálculo, schema ou
  migração; `versao` intacta.

### Etapa 3 — ✅ CONCLUÍDA (item 5 — troca de unidade por badge interativa) — ETAPA CRÍTICA
- **Mecanismo de badge (headline):** `_custoUnidade` (tela-premissas) trocou o `urbi-select` de
  unidade por **`urbi-badge` interativos com seleção mútua** — só uma `?ativo` por vez; clicar troca
  o `<modoKey>` e recalcula ao vivo. Contrato confirmado (`ui-componentes-conteudo.md` §urbi-badge):
  `interativo` dá cursor/chip/cinza-quando-inativo e Enter/Espaço já disparam o mesmo `click` (sem
  `keydown` manual). Aplicado a: infra, construção, projetos e permuta física.
- **Infra do loteamento com 3 unidades (#5):** era `%VGV`/`R$/m²`; agora `%VGV` / **`R$` (fixo)** /
  `R$/m²`. Schema: `infra_modo` opcoes += `valor_fixo` e nova coluna `infra_valor_fixo` (aditivo, o
  sincronizador cria; sem migração). Motor: `infra_modo==='valor_fixo' → infra_valor_fixo`; `valor_m2
  → custo_infra_m2 × área vendável (= privativa dos lotes)`.
- **Permuta financeira R e NR como badge (#5):** as duas saíram das Deduções-plain-% e viraram
  campos com toggle **`% VGV` ↔ `R$`**. Schema aditivo: `permuta_financeira_{residencial,
  nao_residencial}_{modo,valor}`. Motor: `modo==='valor_fixo' → valor absoluto`, senão `pct × VGV do
  tipo`. **Correção de borda:** a permuta financeira NR fica oculta no **loteamento** (não há produto
  NR; no modo % era inócua ×0, mas no modo R$ deduziria valor espúrio).
- **Cálculo R$/m² travado por teste:** construção `R$/m² × área privativa TOTAL` (R+NR, fechada+aberta);
  infra `R$/m² × área vendável`. +5 testes (infra 3 modos, permuta financeira R$, construção total).
- **Memos da Proforma cientes do modo** (tela-proforma): `infra`/permuta financeira mostram
  "valor fixo" no modo R$ em vez de "% do VGV" enganoso. (Tabela completa é da Etapa 5.)
- **DECISÃO DE ROTA (reportada):** o **split R/NR da permuta física** (2 campos separados) foi
  **adiado para a Etapa 5 / item 10**, dona das "linhas separadas R e NR" na Proforma — evita
  duplicar schema/engine e mantém a etapa crítica isolada. Permuta física segue como campo único
  com badge (m²/% área venda) por ora.
- **Schema:** +5 colunas aditivas em `estudos` (`infra_valor_fixo`,
  `permuta_financeira_{residencial,nao_residencial}_{modo,valor}`) + 1 opção nova em `infra_modo`.
  Backend PATCH usa **blocklist** (não allowlist) → colunas passam e são validadas contra o genesis;
  sem alteração no backend. **`versao` mantida em 0.1.0** (só adição de coluna, sem migração — segue
  o precedente da rodada anterior).
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 103.0→105.3kb · backend 841.2kb) ·
  **test 28/28 ✓** (+3) · empacotar ✓ (PowerShell).

### Etapa 4 — ✅ CONCLUÍDA (item 7 — separação Residencial / Não Residencial)
- **Estado de partida:** Premissas **já coletava** os 4 campos R/NR (`num_unidades_{res,nao_res}`,
  `preco_venda_m2_{res,nao_res}` em `PRODUTOS_INC`) e a Proforma **já exibia** o card "Unidades e
  preço médio por tipo" (`_renderUnidadesTipo`, herança do #11). A engine já somava R+NR no VGV
  (`vgv = vgvResidencial + vgvNaoResidencial`). O gap real: a **Premissas** só mostrava totais no
  resumo, e as métricas por tipo eram calculadas ad-hoc na Proforma (não no motor).
- **Motor (fonte única):** `proforma.ts` passou a expor `numUnidades{Residencial,NaoResidencial}` e
  `precoMedioUnidade{Residencial,NaoResidencial}` (preço médio = VGV do tipo, já líquido de permuta
  física, ÷ nº de unidades do tipo). Loteamento não separa R/NR → ficam 0.
- **Proforma:** `_renderUnidadesTipo` refatorado para ler as métricas do motor (antes calculava
  `vgvResidencial/qR` inline). Comportamento idêntico, fonte única.
- **Premissas:** novo bloco `_unidadesTipo(p)` no resumo (só Incorporação, quando há unidades R/NR)
  espelhando a Proforma — "Residencial: N un · R$ x/un" / "Não residencial: …". Totais seguem no
  grid de KPIs.
- **Testes ampliados:** +2 casos (#7) — detalhe R/NR de nº e preço médio (VGV soma R+NR) e
  loteamento com métricas por tipo zeradas.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 105.3→106.7kb · backend 841.2kb) ·
  **test 30/30 ✓** (+2) · empacotar ✓ (PowerShell). Sem schema/migração; `versao` intacta.

### Etapa 5 — ✅ CONCLUÍDA (itens 8, 9, 10, 13 — tabela da Proforma)
- **Item 8 (coluna de descrição):** a tabela da Proforma passou de 4 para **5 colunas** —
  Linha · **Descrição** · R$ · R$/m² · % VGV. A descrição (antes um `(memo)` inline no título) virou
  **2ª coluna** própria (`td.desc`: texto menor `0.72rem` + itálico + cinza; respiro pelo padding da
  célula, não colado no título).
- **Item 9 (consolidação invertida + "Deduções sobre VGV"):** as linhas-total agora são o **header**
  do grupo colapsável (antes eram o rodapé): `= Custo direto total` logo abaixo de Receita líquida,
  `= Custo indireto total` logo abaixo do último custo direto. Nova linha **`= Deduções sobre VGV`**
  logo abaixo da Receita bruta, consolidando imposto + corretagem + marketing + permuta financeira
  (R+NR), também colapsável. Estado `colapso` ganhou a chave `deducoes`.
- **Item 10 (permuta física detalhada R/NR):** quando há permuta física, entre "VGV sem permuta" e
  "Receita bruta (VGV)" entram linhas **(-) Permuta física residencial** e **(-) …não residencial**
  (loteamento: uma só "(-) Permuta física"), com descrição **"X m² · Y% da área privativa total"**.
  Aqui entrou o **split R/NR adiado da Etapa 3**: schema aditivo `permuta_fisica_nr_{modo,area_m2,pct}`
  (o par legado `permuta_fisica_*` passou a ser o **Residencial** / e o único do loteamento — sem perda
  de dados). Premissas mostra 2 campos-badge (R e NR) na incorporação; motor reduz `vgvResidencial`
  por `permuta_fisica_*` e `vgvNaoResidencial` por `permuta_fisica_nr_*` (novas saídas
  `areaPermuta{R,NR}`, `vgvPermuta{R,NR}`). Loteamento inalterado (usa o campo legado, NR = 0).
- **Item 13 (remover memo + rename):** removida a linha "(memo) Permuta física entregue"; o Resultado
  ganhou `border-top` + `padding-top` para manter o espaçamento. "Gestão e outros indiretos" →
  **"Gestão e outros custos indiretos"** na Proforma **e** na Premissas (label do campo
  `gestao_indiretos_pct`).
- **exportar.ts:** `linhasProforma` espelha a nova estrutura (Deduções sobre VGV, permuta física R/NR,
  rename, sem o memo) — PDF e Excel seguem consistentes com a tela.
- **Testes ampliados:** +2 casos (#10) — permuta física R/NR separada reduz cada VGV; loteamento usa
  o campo legado com NR zerado.
- **Schema:** +3 colunas aditivas (`permuta_fisica_nr_{modo,area_m2,pct}`). Backend PATCH por blocklist
  → passam e validam no genesis; sem mudança de backend. **`versao` mantida em 0.1.0.**
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 106.7→109.0kb · backend 841.2kb) ·
  **test 32/32 ✓** (+2) · empacotar ✓ (PowerShell).

### Etapa 6 — ✅ CONCLUÍDA (item 11 — cenários Bear/Base/Bull em urbi-badge)
- Os títulos das colunas da análise de sensibilidade (📉 Bear, 📊 Base, 🚀 Bull) deixaram de ser
  `<span>` coloridos e viraram **`urbi-badge` estáticos** (sem `interativo` — badge estática aplica a
  `cor` direto, ver contrato §urbi-badge), cada um com a cor convencionada: **Bear=`perigo`** (vermelho),
  **Base=`sucesso`** (verde), **Bull=`info`** (azul). O emoji segue na frente, dentro do badge.
- **Ajuste de convenção:** a cor de `Base`/`Bull` estava divergente (Base=neutro, Bull=verde na versão
  anterior). O documento vence e fixa Base=verde/sucesso, Bull=azul/info — alinhado.
- **Valores neutros:** a tinta por cenário saiu das células de valor (antes coloridas). A identidade
  da coluna vem do badge no cabeçalho; evita interpretar número verde como "bom" (a cor agora é
  categoria, não semântica de bom/ruim).
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 109.0→108.9kb · backend 841.2kb) ·
  test 32/32 ✓ · empacotar ✓ (PowerShell). Frontend puro; sem schema/cálculo; `versao` intacta.

### Etapa 7 — ✅ CONCLUÍDA (itens 14 e 15 — gráficos nativos)
- **Item 14 (pizza de alocação de áreas):** novo bloco em `tela-graficos` com `urbi-grafico-pizza`
  (formato `numero`, m²). **Loteamento:** uma pizza da composição da gleba (APP, faixas não
  edificáveis, sistema viário, ELUP, EPC, EPU, priv. não vendáveis + área vendável dos lotes — soma =
  gleba). **Incorporação:** **dois** subgrupos — "geral" (5 áreas detalhadas: priv. R/NR fechada/aberta
  + comuns) e "macro" (privativa residencial + privativa não residencial + áreas comuns = 100%).
  Fatias zeradas são filtradas; sem áreas → `urbi-estado-vazio`.
- **Item 15 (medidores de indicadores):** novo card "Indicadores vs. benchmark" com
  `urbi-grafico-medidor` por benchmark do estudo. Mapa benchmark→valor atual do motor
  (`resultado_final`/`margem_liquida`→margem líquida, `margem_bruta`, `roi`, `custo_obras_vgv`,
  `eficiencia_aproveitamento`). Faixas de status derivadas da **`regra_comparacao`**:
  `atingir_ou_superar` → vermelho abaixo da meta / verde acima; **`nao_exceder` (Custo obra/VGV) →
  verde ABAIXO da meta / vermelho acima** (a inversão pedida). `min=0`, `max=máx(meta×2, valor×1,2,
  meta+10)` (garante faixas válidas: ascendentes, última `ate`===`max`, e a agulha não estoura),
  `formato="porcentagem"`, cores por token `var(--cor-sucesso|erro)`. `tela-graficos` passou a buscar
  benchmarks + config (alíquota RET) por estudo, como a Proforma.
- **Contratos confirmados no doc** (`ui-componentes-conteudo.md`): pizza usa `categorias`/`series`
  (1ª série, cor por categoria); medidor tem API própria (`min`/`max`/`valor`/`faixas`/`formato`/
  `rotulo`), faixas ascendentes cobrindo `[min,max]`.
- **Validado (verde):** typecheck ✓ · build ✓ (frontend 108.9→112.4kb · backend 841.2kb) ·
  test 32/32 ✓ · empacotar ✓ (PowerShell). Sem schema/cálculo novo (só leitura); `versao` intacta.
  ⏳ Render real dos primitivos `urbi-grafico-*` só valida no deploy dev.

### Etapa 8 — ✅ CONCLUÍDA (fechamento e empacotamento)
**Suíte completa verde:** typecheck ✓ · build ✓ (frontend **112.4kb**, backend **841.2kb**) ·
**test 32/32 ✓** · empacotar ✓ → `dist/viabilidade-0.1.0.urbiapp.tgz` (342 KB) + `.sha256`.

**Itens fechados (14/14):** 1, 2 (Etapa 1) · 3, 4, 6 (Etapa 2) · 5 (Etapa 3) · 7 (Etapa 4) ·
8, 9, 10, 13 (Etapa 5) · 11 (Etapa 6) · 14, 15 (Etapa 7).
**Fora do escopo por decisão do autor — não tocados:** **itens 12 e 16**.

**Versão:** mantida em **0.1.0**. Nenhuma migração criada (`migracoes/` só tem `.gitkeep`) — todas as
mudanças de schema foram **colunas/opções aditivas no genesis** (auto-criadas pelo sincronizador, sem
transformar dado de instância): `infra_valor_fixo`, `permuta_financeira_{res,nao_res}_{modo,valor}`,
`permuta_fisica_nr_{modo,area_m2,pct}`, e a opção `valor_fixo` em `infra_modo`. Backend inalterado
(PATCH por blocklist valida contra o genesis).

**Decisões de rota registradas (os itens desta rodada vencem a spec/rodadas anteriores):**
1. Benchmark voltou a ser **aba de topo** — reverte o #12 da rodada "lista bugs.xlsx" (Etapa 1).
2. Sensibilidade continua lendo `estudos.sensibilidade_variacao_*_pct` (as `variacao_*_pct` do
   benchmark são referência/padrão por tipo; **não** reconectei o cálculo dos cenários) (Etapa 1).
3. Botão de Membros: `fantasma`→`secundario`. Outros botões `fantasma` no app **não** foram tocados
   (fora do escopo do item 3) — varredura própria pendente se `fantasma` for inválido em runtime (Etapa 2).
4. Permuta física R/NR: par legado `permuta_fisica_*` virou o **Residencial** (e o único do
   loteamento); só a NR ganhou colunas novas — sem perda de dados (Etapas 3/5).
5. Permuta financeira NR **oculta no loteamento** (não há produto NR) (Etapa 3).
6. Cenários Bear/Base/Bull: cor de convenção corrigida para Base=verde/sucesso, Bull=azul/info; valores
   das células ficaram **neutros** (cor = categoria, não semântica de bom/ruim) (Etapa 6).

**Pendente para o deploy dev (validação visual real — nunca rodou contra shell real):**
- Render/ajuste fino dos primitivos migrados nesta rodada: `urbi-badge` interativo (troca de unidade),
  `urbi-badge` estático (cenários), `urbi-grafico-pizza` (alocação de áreas) e `urbi-grafico-medidor`
  (indicadores + faixas).
- Alinhamento de labels de 2 linhas e as 3 larguras de campo em Premissas (CSS conferido offline).
- `urbi-empacotar` neste ambiente **só roda via PowerShell** (o `tar` do Git Bash falha em paths `C:`).

**Fluxo:** code → commit → push. Release/deploy é responsabilidade do autor (não criei release nem
acionei workflows).

## Rodada pós-fechamento — campos obrigatórios + conversão de unidades

### Parte 1 — Campos obrigatórios em Premissas ✅
- **Contrato de UI:** obrigatório = `obrigatorio` (asterisco `*` no label) + `erro` (mensagem vermelha
  abaixo). Adicionado suporte a `viab-num` (não tinha), espelhando `urbi-input-numero`.
- **Regra (por tipo, decisão do autor — sem campo de classificação de uso):**
  - **Ambos:** Área do terreno (manual; via Núcleo já vem preenchida — valida a área somada) +
    **obras** (Infraestrutura no Loteamento / Custo de construção na Incorporação — sempre o campo da
    **unidade ativa**, ex.: `infra_pct` no modo %VGV, `custo_infra_m2` no R$/m²).
  - **Incorporação, por lado:** cada lado (R/NR) com **Nº de unidades > 0** exige a sua **Área PVT
    fechada** e o seu **Preço**. Exige **ao menos um lado**. Um estudo só residencial não exige dados
    de NR (e vice-versa).
  - "Preenchido" = ≠ vazio **e** ≠ 0.
- **Comportamento:** ao **Salvar**, se faltar obrigatório, bloqueia o PATCH, marca os campos (borda +
  "Obrigatório") e mostra `urbi-banner` de erro listando o que falta. Editar um campo limpa o erro
  dele. Asteriscos aparecem dinamicamente (ex.: preencher Nº un. R faz Área/Preço R ganharem `*`).
- **Regra pura e testável:** `frontend/premissas-validacao.ts` (`camposObrigatorios` / `validarObrigatorios`
  / `campoObrasAtivo`), coberta por **10 testes** nos dois tipos (loteamento, incorporação só-R, só-NR,
  misto, Núcleo, zero-não-conta). Frontend puro; sem schema/engine; `versao` intacta.
- **Validado:** typecheck ✓ · build ✓ (112.4→115.6kb) · **test 42/42 ✓** · empacotar ✓.

### Parte 2 — Conversão automática de unidades ✅
- **Comportamento:** ao trocar a unidade de um campo (badge), o valor é convertido para a unidade
  nova (equivalente) e o modo muda. Ex. (permuta física): 2.000 m² com área de venda 40.000 → clica
  "% área venda" → **5%**; muda para 10% e volta pra m² → **4.000 m²**.
- **Regra geral:** cada unidade representa a MESMA quantidade base — R$ (custos/permuta financeira) ou
  m² (permuta física) — e converte `unidade atual → base → unidade nova` via uma **grandeza de ligação**
  do motor (VGV, área de venda, área privativa), que **não depende do próprio campo** (sem
  circularidade). Descritor `conv` por opção: `identidade` / `pct` (link) / `por_area` (link).
- **Cobertura por campo** (confere com o motor nos dois tipos): permuta física m²↔% (link área de
  venda R/NR; loteamento usa a vendável total); infra %VGV↔R$↔R$/m² (VGV / área vendável); construção
  R$/m²↔R$ total (área privativa); projetos %VGV↔R$ (VGV); permuta financeira R/NR %VGV↔R$ (VGV do tipo).
- **Sem base definida** (grandeza de ligação = 0, ex.: áreas/preços ainda não preenchidos) → **não
  converte** (mantém o valor do destino); campo de origem vazio → só troca o modo. Arredonda a 2 casas.
- **Módulo puro e testado:** `frontend/premissas-conversao.ts` (`converterUnidade`/`paraBase`/`daBase`),
  **7 testes** (exemplo do autor, infra 3-modos, construção, permuta financeira R/NR, base zero, NaN,
  arredondamento). `_ctxConversao()` monta as grandezas do motor; `_trocarUnidade()` faz a troca.
- **Frontend puro; sem schema/engine.** Validado: typecheck ✓ · build ✓ (115.6→117.1kb) ·
  **test 49/49 ✓** · empacotar ✓. `versao` intacta.

## Rodada Proforma (ajustes visuais)

### Etapa 1 — Tabela da Proforma ✅
- **Notação contábil na coluna R$:** `_fmtContabil(linha)` — sem "R$"; custos/deduções (itens e
  consolidados) entre parênteses (ex.: `(1.546.210)`); receita plana; resultado pelo sinal real
  (negativo entre parênteses). Reusa `fmtNum` (pt-BR, 0 casas). Colunas R$/m² e % VGV inalteradas.
- **Cabeçalhos:** maiores (0.7→0.85rem) e **centralizados** nas colunas de valor; **Descrição à
  esquerda**; **1ª coluna sem o título "Linha"** (cabeçalho vazio). Valores seguem à direita.
- Validado: typecheck ✓ · build ✓ (117.1→117.4kb) · test 49/49 ✓ · empacotar ✓.

### Etapa 2 — Análise de sensibilidade ✅
- Convertida de `urbi-tabela` para **tabela HTML própria** (`table.pf.sens`, reusa os estilos da
  Proforma) para controlar cabeçalho, cores e divisória.
- **Cabeçalho da 1ª coluna vazio** (sem "Linha"); títulos Bear/Base/Bull seguem em `urbi-badge`.
- **Números na cor do cenário:** Bear=`--cor-erro` (vermelho), Base=`--cor-sucesso` (verde),
  Bull=`--cor-info` (azul) — antes eram neutros.
- **Novo indicador "Custo obra / VGV"** (`custoObrasVgvPct`).
- **Dois grupos:** 4 monetárias (VGV, Receita líquida, Custo direto total, Resultado) em cima; os 2
  indicadores em % (Custo obra/VGV, Margem líquida) embaixo, com **`border-top` de divisória** (linha
  `.div-top`).
- Validado: typecheck ✓ · build ✓ (117.4→118.0kb) · test 49/49 ✓ · empacotar ✓.

## Rodada Benchmark/Sensibilidade + Medidores

### Etapa A — Indicadores de Sensibilidade = as 4 variáveis da Proforma ✅
- **Problema:** a seção "Indicador de Sensibilidade" mostrava os mesmos campos das metas e não
  alimentava os cenários (a Proforma usava um par único `estudos.sensibilidade_variacao_*_pct`).
- **Backend seed:** +4 indicadores de sensibilidade (`preco`, `permuta_fisica`, `permuta_financeira`,
  `custo_obras`) com var+/var− (10/10); `valor`=0 (metas não se aplicam). Export `CAMPOS_SENSIBILIDADE`.
- **Config de benchmark:** a seção "Benchmark" lista só as **metas** (`_itensMeta`); a seção
  "Sensibilidade" lista só os **4 de sensibilidade** (`_itensSensibilidade`) com rótulos amigáveis
  (Preço R$/m², Permuta física, Permuta financeira, Custo de obras).
- **Proforma:** a Análise de Sensibilidade passou a ler a variação **por variável** do benchmark
  (`_campoSensibilidade(VarSens)`→`campo`; `custo_infra`/`custo_obras`→`custo_obras`), fallback 10%.
  Inversão Bull/Bear mantida na versão econômica (só Preço "subir = melhor"; Custo, Permuta física e
  Permuta financeira "subir = pior") — confirmada pelo autor.
- **Schema intacto** (a tabela `benchmarks` já tinha `variacao_*_pct`). `estudos.sensibilidade_*` ficou
  sem uso no cálculo (mantido no schema). Testes do seed atualizados. **test 50/50 ✓**.

### Etapa B — Medidores configuráveis por indicador (aba Benchmark) ✅
- **Confirmação de viabilidade:** `urbi-grafico-medidor` aceita `min`/`max`/`faixas` como **props** e
  `faixas` é um **array** (N bandas) — tudo API pública do primitivo. Customização é **100% no app**,
  sem tocar no urbiverso.
- **Schema (aditivo):** `benchmarks` += `medidor_min`, `medidor_max`, `medidor_faixa1_ate`,
  `medidor_faixa2_ate`. Backend PATCH liberou os 4 campos. Sem migração; `versao` intacta.
- **Config (aba Benchmark):** nova seção **"Faixas do medidor"** sobre os indicadores de meta —
  campos editáveis Mín · Faixa 1 até · Faixa 2 até · Máx. (A edição fica **só** aqui, nunca na aba
  Gráficos.)
- **Gráficos:** `montarMedidor(b, val)` (módulo puro `medidor-faixas.ts`) monta min/máx + faixas:
  **configurado** → **3 faixas** cor fixa **vermelho/amarelo/verde** (invertidas p/ `nao_exceder`);
  **em branco/ inválido** → fallback automático de 2 faixas em torno da meta (comportamento anterior).
  A tela de Gráficos só consome; não edita.
- **+5 testes** (`medidor-faixas.test.ts`): 3 faixas, inversão, fallback, config inválida, sem meta.
- Validado: typecheck ✓ · build ✓ (118.6→120.3kb · backend 841.5kb) · **test 55/55 ✓** · empacotar ✓.

### Pós-fechamento — nota
- **KPI R/NR na Proforma (revertido a pedido do autor).** Chegou a existir um commit dividindo o KPI
  do topo em "Nº un. residencial/não residencial/total" + preço médio R/NR (`4bef233`), mas o autor
  pediu para ignorar por ora — **revertido**. A separação R/NR do item 7 segue como estava (card
  "Unidades e preço médio por tipo" na Proforma + bloco no resumo da Premissas). Pode voltar depois.

---

## Rodada de correções — "lista bugs.xlsx" (2026-07-15)

Round de refinamento sobre o MVP (22 itens da planilha do autor). Branch `fix/lista-bugs`.
Validação: typecheck ✓ · build ✓ · 25 testes ✓ · empacotar ✓ (offline, sem runtime real).

- **Formatação (#5):** `fmtPct` calculado "xx,x%" (vírgula, 1 casa); `fmtPctEntrada` "xx,xx%".
  Números já agrupam milhar via Intl pt-BR. Novo `parseNumeroBR` (testado).
- **Input mascarado (#1):** `viab-num` (app-local) exibe separador de milhar nos campos
  preenchíveis — o `urbi-input-numero` é `<input type=number>` e não agrupa. Usado em
  Premissas e na config de Benchmarks. Flag `atenuado` = marcador cinza de dado não usado (#15).
- **Proforma:** removida a ação "Salvar cenário"/comparação transiente (#8); sensibilidade
  sempre visível (#10); cores Bear=vermelho/Base=verde/Bull=azul (#11); botões de exportar à
  direita (#9).
- **Sensibilidade — sinal do custo (#13):** Bull é otimista de verdade. Preço: otimista = maior;
  custo/permuta: otimista = menor (conta invertida em `_renderSensibilidade`).
- **Live Premissas→Proforma (#6):** `_set` emite `viab:premissas-change`; a tela do estudo funde
  no objeto e as abas recalculam na hora. Fetch de benchmarks guardado por id (não reroda por tecla).
- **Unidades de custo (#3/#4):** seletor de unidade + 1 campo por custo. Projetos %VGV/R$ fixo;
  Infra %VGV/R$/m²; Construção R$/m²/R$ total (novos `construcao_modo`/`construcao_valor_total`).
- **Campo único com unidade embutida (UI):** o par "seletor de unidade — campo de valor" (que antes
  eram duas células separadas no grid) virou **um só campo** — rótulo em cima e `[tag de unidade][valor]`
  lado a lado (`_custoUnidade` em `tela-premissas.ts`), replicando o padrão do orçamento de obra: troca a
  tag → muda a unidade inserida no mesmo campo. A **permuta física** foi trazida para esse mesmo padrão
  (`PERMUTA_UNIDADE`: m² / % área de venda), aposentando o `_modo` + dois inputs atenuados. Cada unidade
  guarda seu próprio valor nas colunas já existentes — **mudança 100% de UI, sem schema/proforma/migração**.
- **Permutas (#14 — decisão do autor):** permuta física reduz a área vendável e o VGV nos DOIS
  tipos (antes só no Loteamento); permuta financeira segue deduzida da receita. Ambas reduzem o
  **Resultado final** — removidas as linhas "Resultado + permutas" que somavam de volta;
  `valorPermutaFisica` vira memo.
- **Unidades R/NR (#2 — decisão do autor: só contagem):** dois campos de nº de unidades
  (Residencial/Não Residencial) na Incorporação; `numUnidades = R + NR` (fallback ao legado
  `num_unidades`). VGV segue por área × preço.
- **Benchmarks dentro do estudo (#12 — decisão do autor):** nova aba "Benchmarks" no estudo reusa
  `viabilidade-config-benchmarks` com `tipoFixo` (trava o tipo) e `somenteLeitura` (não-admin só lê;
  backend segue admin-only na escrita).
- **URL por guia (#7):** rota `/detalhe/:id/:aba` (premissas|proforma|graficos|apelo|benchmarks).
- **Telas/tabelas:** largura total `urbi-shell-page[dashboard]` (#16); gráfico de custos empilhado e
  colorido por custo com legenda (#17); nome real + formato do arquivo no Apelo, nova coluna
  `nome_arquivo` (#18); filtros de Estudos em barra acima da tabela (#19); filtro Glebas/Lotes em
  Terrenos (#20); grids de KPI mais largos p/ reduzir overflow (#21 — fix completo exige ajustar o
  primitivo `urbi-kpi` na plataforma).
- **Loteamento (#22):** coberto — física reduz VGV no Lot (já era) e agora no Inc; toggle de infra é
  do Lot; unidades R/NR são exclusivas do Inc por natureza.

**Colunas novas no schema** (auto-criadas pelo sincronizador, sem migração destrutiva):
`apelo_comercial_documentos.nome_arquivo`, `estudos.construcao_modo`,
`estudos.construcao_valor_total`, `estudos.num_unidades_residencial`,
`estudos.num_unidades_nao_residencial`. Versão mantida em 0.1.0 (só adição de coluna).

---

## Manutenção pós-MVP — alinhamento ao contrato do framework

- **Soft-delete: campos reservados no PATCH/duplicação.** Com `estudos` marcado `soft_delete: true`, o framework passou a gerir `removido_em`/`removido_por_id` (colunas auto-criadas, ver `docs/shell/banco-de-dados.md` §Soft-delete). Como o GET de estudo agora devolve esses dois campos, o frontend os ecoava de volta ao salvar premissas → `422 DADOS_CAMPO_RESERVADO` ("use PATCH /:tabela/:id/remover ou /restaurar"), quebrando o registro dos dados de um estudo recém-criado. Corrigido em 3 pontos: `tela-premissas.ts` (`_salvar` não reenvia os campos), `estudos.ts` PATCH (`bloqueados` inclui os dois) e `estudos.ts` `CAMPOS_NAO_COPIAVEIS` (nomes obsoletos `removido_por`/`removido` → `removido_por_id`, senão a duplicação recopiaria e falharia).
- **`urbi-shell-page preencher` removido.** Atributo extinto na fase 2 do contrato de slots (aceito mas inerte; breaking após 2026-08-15 — issue up-urbita/urbiverso#1687). Removido de `tela-dashboard.ts` e `tela-estudo.ts`; o filho `<urbi-abas expandir>` (primitivo de layout) já preenche a altura sozinho, então nenhum `[expandir]` novo foi necessário.
- **Integração com o Núcleo reativada (terreno via glebas/lotes).** O §6.6 tinha ficado como modo manual (`dependencias_nucleo: []`) porque a instância não expunha glebas/lotes. Reintroduzido no contrato padrão do Núcleo:
  - **Manifesto:** `dependencias_nucleo: ["imoveis"]` + `permissoes_nucleo: { "imoveis": ["ler"] }` (só leitura; o admin liga o toggle em Admin → Apps → viabilidade → Núcleo).
  - **Backend:** removido o stub `backend/rotas/nucleo.ts` (respondia "indisponível" e **sombreava** o proxy do shell — o router do app é montado antes de `/api/{appId}/nucleo`, ver `shell/backend/src/carregador-rotas.ts`). Sem o stub, o shell provê `/api/viabilidade/nucleo/*` sozinho. O vínculo `estudo_imoveis` (rotas `imoveis-estudo.ts`) já valida subtipo × tipo (gleba↔loteamento, lote↔incorporação) e mantém gleba única no loteamento.
  - **Frontend:** `urbiVerso.nucleo(...)` (lança em não-2xx → try/catch com banner de degradação). Novo componente `tela-terreno-nucleo.ts` (seleção gleba single / lote multi, só em Rascunho) usado na aba Premissas; aba **Terrenos** do dashboard passou a listar glebas+lotes do Núcleo. Novo campo `estudos.area_terreno_nucleo` guarda a área somada, e a Proforma (`proforma.ts`) usa essa área quando `origem_terreno === 'nucleo'` — assim todas as telas (premissas/proforma/gráficos/tabela do dashboard) calculam certo sobre o objeto estudo.
  - **Pendência mantida:** filtro de exclusão (Fazenda Paranoazinho / lotes em parcelamento) segue não implementado — degrada mostrando todos os imóveis do subtipo (comportamento previsto no §6.6).

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

# PROGRESSO — App `viabilidade`

Memória entre sessões. Uma etapa por sessão. Atualizar ao fim de cada etapa.

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

## Rodada 2 — Etapas (2026-07-22)

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

### Etapa 4 — Empreendimento (Cronograma + Tipologias) — ✅ IMPLEMENTADA (issues #41 #42 #43 #44 #45)
Branch `claude/etapa-4-l6d5ed`. Toca **schema + backend + frontend** (migração `migracoes/004_fases_gantt.js`).

- **#41 (cores distintas por fase — tokens):** `EVENTO_COR` em `fluxo-shared.ts` — `pos_obra`
  trocado de `--cor-texto-sec` (cinza) para `--cor-erro` (vermelho): todos os 5 eventos usam
  tokens semânticos distintos. Cada linha da tabela de cronograma recebe `border-left: 3px`
  colorida pelo token da sua fase; `ponto-cor` cresceu de 8px para 10px. Nova função
  `corFaseExtra(idx)` com paleta cíclica de 5 tokens para fases personalizadas.
- **#42 (fases extras posicionadas no gantt):** `avancado_fases` ganhou colunas aditivas
  `inicio_mes INT DEFAULT 0` e `duracao_meses INT DEFAULT 12` (migração 004 — `ADD COLUMN IF
  NOT EXISTS`). Backend `PATCH /avancado/fases/:fid` passa a aceitar esses campos;
  `CAMPOS_FASE_COPIA` atualizado. Frontend — cronograma carrega as fases via
  `listarFasesAvancado` e exibe seção "Fases comerciais" abaixo dos 5 eventos fixos, com CRUD
  inline (adicionar/renomear/editar início e duração/remover). No gantt, fases extras aparecem
  como barras tracejadas (opacity 0.55) com cores da paleta cíclica.
- **#43 (emojis no gantt SVG):** ⭐ posicionada acima do evento Lançamento (1 mês, renderizado
  como círculo no gantt); 🔑 posicionada à direita do fim da barra do evento Obra.
- **#44 (largura/alinhamento de Tipologias):** tabela convertida para `table-layout: fixed` com
  `<colgroup>` explícito — Tipo 160px, Área privativa 130px, Dormitórios/Vagas 90px,
  Unidades 100px, Un. permutadas 200px, Ações 90px. Padding uniformizado em 8px.
- **#45 (texto calculado de permutadas):** ao lado do campo `unidades_permutadas`, dois valores
  calculados (só quando `perm > 0`): % de unidades permutadas e m² permutados.
  Fonte 0.72rem / `--cor-texto-sec`. Rodapé de totais exibe também área total permutada.
- **Validação neste ambiente:** frontend isolado — **typecheck ✓ · testes 76/76 ✓ · build
  (esbuild) ✓** (`bash scripts/validar-frontend.sh` verde). ⏳ **Pendente do autor (SDK gated):**
  typecheck de backend, suíte de backend, **execução da migração 004** contra dados reais e
  `urbi-empacotar`. Render real dos emojis SVG e fases no gantt só valida no deploy dev.

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

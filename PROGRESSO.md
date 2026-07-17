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

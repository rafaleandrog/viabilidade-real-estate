# Rodada 10 · #574 — auditoria do Preliminar de LOTEAMENTO

> Fotografia de **2026-08-27**, contra a `main` em `968b6a4` (PR 606 mergeado — a sensibilidade já
> alcança o catálogo). O placar vivo está nas issues e nos PRs, não aqui.
>
> **Pergunta da auditoria**, nas palavras do autor: *"que os cálculos e funções do Preliminar de
> Loteamento estejam corretos, e que caiba nele tudo o que já foi corrigido no de Incorporação"*.
> As duas metades são conferidas juntas abaixo — cada linha diz se o Loteamento **está certo** e se
> a correção equivalente de Incorporação **chegou nele**.

## Veredito geral

**37 conferências (35 linhas da tabela + 2 transversais) · 27 linhas ✅ · 11 achados**
(2 P1, 5 P2, 2 P3, 2 registros — 9 vindos de 8 linhas da tabela, a linha 29 carrega dois,
e 2 das conferências transversais).
Três achados já estão **consertados neste PR** (4, 9 e 11); os outros oito viram issue ou nota.

O padrão que os achados desenham não é "o Loteamento calcula errado" — o motor dele está correto
linha a linha. É que **o Loteamento tem menos superfície de verificação que a Incorporação**, e por
isso as correções desta rodada o alcançaram de forma desigual: das 27 telas exercitadas em Chromium,
**zero** montavam um Loteamento; das 752 asserções, as do Loteamento passam por fixtures que
carregam campos que **nenhuma tela escreve**. Onde a Incorporação tem duas camadas conferindo,
o Loteamento tinha uma.

---

## 1 · Conferência tela a tela, fórmula a fórmula

### Premissas → Terreno & Áreas

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 1 | Área vendável = **ALV** da cascata de 11 linhas, em 3 degraus de subtração | ✅ | `frontend/areas-cascata.ts:116` (`CASCATA_LOTEAMENTO`), consumida em `frontend/proforma.ts:341-342` |
| 2 | 3 modos por linha editável (m² · % Poligonal · % Parcelável), com não-circularidade (`permiteAncora2: false` no APP) | ✅ | `frontend/areas-cascata.ts:118`; tradução schema→motor em `frontend/proforma.ts:287-291` |
| 3 | Área do terreno: Núcleo (soma das glebas) ou manual, mesma regra dos dois padrões | ✅ | `frontend/proforma.ts:310-312` |
| 4 | Indicador de aproveitamento do coeficiente (#569) **não se aplica** ao Loteamento | ✅ **por construção**, não por ramo `lot`: o schema não tem coeficiente, `coefMax` fica 0 e o par sai `null` | `frontend/proforma.ts:530-533`; teste `frontend/proforma.test.ts:254` |

### Premissas → Custos

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 5 | Custo do terreno = `custo_terreno_m2 × área do terreno`, zerável pelo checkbox | ✅ | `frontend/proforma.ts:449` |
| 6 | Infraestrutura em **3** unidades (% VGV · R$ fixo · R$/m² × área vendável **bruta**), com canônico e fator de sensibilidade | ✅ | `frontend/proforma.ts:453-458`; teste `frontend/proforma.test.ts:323` |
| 7 | Campos exclusivos: stand de vendas só no Loteamento; decoração, gestão da construção, outorga e incorporação/registro zerados nele | ✅ | `frontend/proforma.ts:460-473`, `:481-482`; `frontend/tela-premissas.ts:44` |
| 8 | RET / imposto, corretagem, marketing — idênticos aos dois padrões | ✅ | `frontend/proforma.ts:433-436` |

### Premissas → Produtos

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 9 | Catálogo é a **fonte única** do VGV também no Loteamento; sem linha efetiva → estado vazio | ✅ | `frontend/proforma.ts:357-358`; teste `frontend/proforma.test.ts:517` e `:1091` (o cap vale nos dois padrões) |
| 10 | Nº de lotes e preço médio saem do catálogo, não da área ÷ `area_media_lote_m2` | ✅ | `frontend/proforma.ts:513-514` |
| 11 | KPIs do Resumo do Loteamento com `fmtPctOuIndef` (#571) | 🟡 **ACHADO 5** — a margem sim, o indicador exclusivo do Loteamento não | `frontend/tela-premissas.ts:1075` (`Vendável / gleba` via `fmtPct`) |
| 12 | Preço sugerido/m² reprecifica o **catálogo**, não só o campo legado | ✅ | `frontend/proforma.ts:581-584` |

### Premissas → Permutas

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 13 | Campo **único** de permuta física no Loteamento (produto único), com a badge "Unidade" já retirada pela #566 | ✅ | `frontend/tela-premissas.ts:129-135`, `:621-623` |
| 14 | "% área venda" do Loteamento incide sobre a **ALV** | ✅ | `frontend/proforma.ts:377` (`areaVendavelR = areaVendavel` no ramo `lot`) |
| 15 | Permuta física **reduz o VGV** | 🔴 **ACHADO 1** — reduz a área, não o dinheiro | `frontend/proforma.ts:334`, `:398` |
| 16 | Permuta financeira: NR oculta no Loteamento, R incide sobre o VGV inteiro | ✅ | `frontend/tela-premissas.ts:630-631`; `frontend/proforma.ts:438-441` |

### Resultado → Proforma

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 17 | Estado vazio sem catálogo (#563) — a tela é agnóstica ao tipo | ✅ | `frontend/tela-proforma.ts:276`, `:298` |
| 18 | Aviso do excedente de permuta capada (#563), frase única com a exportação | ✅ no código; **inalcançável hoje no Loteamento** — consequência do ACHADO 1 | `frontend/tela-proforma.ts:320-326`; `frontend/exportar.ts:50` |
| 19 | Notação contábil com sinal real (#567) — receita/resultado × custo | ✅ agnóstica ao tipo | `frontend/tela-proforma.ts:46-48` |
| 20 | Linhas `soLot`/`soInc`: o Loteamento vê Infraestrutura e não vê Construção/Outorga/Registro/Decoração | ✅ | `frontend/tela-proforma.ts:406-411`, filtro em `:439-442` |
| 21 | KPIs indefinidos com VGV ≤ 0 (#571) | ✅ | `frontend/tela-proforma.ts:342-343` |
| 22 | Identidade `vgv + permutaR + permutaNR = VGV bruto` no Loteamento (resíduo do cap cai no NR, que ali é sempre zero) | ✅ | `frontend/proforma.ts:421-424` |

### Resultado → Cenários

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 23 | Stress de preço alcança o catálogo também no Loteamento (#568) | ✅ | `frontend/proforma.ts:368`; teste `frontend/proforma.test.ts:844` |
| 24 | Variável de custo do Loteamento é `custo_infra`, mapeada ao benchmark `custo_obras` | ✅ | `frontend/tela-proforma.ts:499`, `:516-521` |
| 25 | Estado vazio (#563) na sub-aba Cenários | 🔴 **ACHADO 3** — só a sub-aba Proforma tem | `frontend/tela-proforma.ts:289` |

### Gráficos

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 26 | "Alocação de áreas da gleba" reflete a cascata | 🔴 **ACHADO 4** — lia os 7 campos aposentados pela `020`. **Consertado neste PR** | `frontend/tela-graficos.ts:197` |
| 27 | Medidor do benchmark exclusivo do Loteamento (`eficiencia_aproveitamento`) | 🟡 **ACHADO 8** — descartado com "sem indicador correspondente" | `frontend/benchmarks-indicadores.ts:16` |
| 28 | Pizza de custos e Receita × Custos | ✅ agnósticas ao tipo | `frontend/tela-graficos.ts:137-150` |

### Exportação, Painel e backend

| # | Conferência | Veredito | Evidência |
|---|---|---|---|
| 29 | CSV/PDF do Loteamento: KPIs próprios e filtro `soLot` | 🟡 **ACHADO 7** (rótulo) e **ACHADO 10** (notação) | `frontend/exportar.ts:72`, `:155` |
| 30 | Painel de estudos: área construída de Loteamento cai na privativa; catálogo anexado ao payload | ✅ | `frontend/tela-dashboard.ts:83`; `backend/rotas/estudos.ts:194`, chamada em `:302` |
| 31 | Duplicar um estudo Preliminar preserva o produto | 🔴 **ACHADO 2** | `backend/rotas/estudos.ts:436-450` |
| 32 | Benchmarks-semente do Loteamento incluem `eficiencia_aproveitamento` | ✅ | `backend/rotas/benchmarks.ts:43-45` |
| 33 | Análise de Mercado / Apelo: contexto sai do catálogo nos dois padrões | ✅ | `backend/rotas/apelo-comercial.ts:159`, `:167` |
| 34 | Validação de obrigatórios do Loteamento (terreno + infraestrutura da unidade ativa + 1 produto) | ✅ | `frontend/premissas-validacao.ts:26-32`, `:66-71` |
| 35 | ALV nunca negativa | 🔴 **ACHADO 6** | `frontend/areas-cascata.ts:85-87` |

Duas conferências transversais fecham a lista: **cobertura de render do Loteamento** (🔴 **ACHADO
9**, zero casos — parcialmente consertado neste PR) e **a spec deste próprio documento** (🔴
**ACHADO 11**, `formulas.md` descrevia a fórmula de área revogada em 2026-08-03 — consertado neste
PR).

---

## 2 · Os achados

### ACHADO 1 · [P1] A permuta física do Loteamento reduz a ÁREA, mas não o VGV

`vgvPermutaSolicitadaR = areaPermutaResidencial × precoR` (`frontend/proforma.ts:398`) e, no
Loteamento, `precoR` é `precoLot = n(e.preco_venda_m2) × fator` (`frontend/proforma.ts:334-335`).
`estudos.preco_venda_m2` **não tem campo em tela nenhuma** — o array `PRODUTOS_LOT` que o declarava
sobrevive só dentro de `TODOS_NUM`, para o tipo numérico do `Salvar`
(`frontend/tela-premissas.ts:184-187`, usado em `:244-250`) — e **não tem `padrao` no schema**.
Num Loteamento criado depois da reestruturação do Preliminar ele é `NULL`, logo:

- `vgvPermutaResidencial = 0` → a permuta **não deduz** do VGV, e a tabela da Proforma esconde a
  linha por `ocultarSeZero`; sobra "VGV sem permuta física" com o mesmo valor do VGV;
- `permutaCapada` nunca dispara → o aviso do excedente da #563 é **inalcançável** no Loteamento;
- `valorPermutaFisica = areaPermutaFisica × precoLot = 0` (`frontend/proforma.ts:494-496`), enquanto
  na Incorporação o mesmo memo usa `vgv / areaVendavelLiquida`, que **é** derivado do catálogo.

A área continua sendo deduzida (`areaVendavelLiquida`), então a tela mostra m² permutados ao lado de
um VGV intacto. **Estudo ANTIGO com a coluna preenchida deduz; estudo novo não** — mesma premissa,
resultados diferentes, sem nada na tela dizendo por quê.

> **Por que os testes não pegam:** o fixture `LOT` de `frontend/proforma.test.ts:32` declara
> `preco_venda_m2: 1000`, e o teste `frontend/proforma.test.ts:438` afere a dedução com esse valor.
> Ele prova a matemática; não prova que exista de onde o número vir. É a classe 1 do `CLAUDE.md`
> (o defeito mora na fiação), pela porta do fixture.

**Relação com a #570:** a issue já ataca a raiz — critério 4, *"permuta física valorada pelo preço
médio da sua categoria no catálogo"*. Mas o corpo dela cita só `preco_venda_m2_residencial` e fala
em categorias R/NR, que o Loteamento não tem. **Duas cláusulas precisam ser decididas para o
Loteamento** antes de a #570 fechar, e é isso que este achado pede:

1. o preço da permuta do Loteamento passa a ser o preço médio do catálogo (bucket único) — sem isso
   o Loteamento sai da #570 do mesmo jeito que entrou;
2. a base de `% área venda` do Loteamento **continua sendo a ALV** (`frontend/proforma.ts:377`), e
   não a área do catálogo que o critério 2 propõe para a Incorporação. "% da área de venda" num
   loteamento é, literalmente, % da Área Líquida de Venda — trocar a base mudaria o significado do
   campo sem que ninguém tivesse pedido.

### ACHADO 2 · [P1] Duplicar um estudo Preliminar não copia o catálogo de Produtos

`POST /estudos/:id/duplicar` copia as colunas de `estudos` (`montarCopiaEstudo`,
`backend/rotas/estudos.ts:117`), os imóveis vinculados e — só no Avançado — toda a estrutura de
cronograma/receitas/custos (`backend/rotas/estudos.ts:436-450`). **Nada copia
`preliminar_produtos`**: fora do CRUD e do `anexarProdutos` da listagem, a única outra
referência viva no backend é a leitura do Apelo Comercial (`backend/rotas/apelo-comercial.ts:153`,
linha 33 desta tabela) — nenhuma delas copia.

Antes da #563 isso passava despercebido, porque o VGV caía no fallback dos pares legados de área ×
preço, que `montarCopiaEstudo` **copia**. Depois da #563 o fallback acabou: a cópia nasce em
**estado vazio** — sem VGV, sem Proforma, sem KPIs — carregando todas as premissas de custo,
dedução, área e permuta do original. O usuário duplica um estudo pronto e recebe uma casca.

Vale para os dois padrões; entra nesta auditoria porque é o Loteamento que mais depende da
duplicação (variações de gleba sobre o mesmo produto).

### ACHADO 3 · [P2] A sub-aba Cenários não tem estado vazio

O guard do estado vazio da #563 está no ramo `secao === 'proforma'`
(`frontend/tela-proforma.ts:276`). O ramo dos Cenários (`:289`) chama `_renderSensibilidade` sem
nenhuma checagem de `p.semProdutos`: um estudo sem catálogo desenha as três colunas Bear/Base/Bull
inteiras, todas zeradas, com os dois indicadores em "—". É exatamente o que a #563 chamou de
"número-fantasma", uma aba ao lado da que ela consertou.

### ACHADO 4 · [P2] A pizza da gleba lia os 7 campos aposentados pela migração `020` — **consertado neste PR**

`_renderAlocacaoAreas`, no ramo `lot`, montava as fatias a partir de `app_pct`,
`faixas_nao_edificaveis_pct`, `sistema_viario_pct`, `elup_pct`, `epc_pct`, `epu_pct` e
`areas_privativas_nao_vendaveis_pct`. A migração `020_areas_cascata_loteamento.js` migrou esses
campos para as colunas `area_*_modo`/`area_*_valor` em 2026-08-03; desde então **nenhuma tela os
escreve por UI** e `frontend/proforma.ts` **não os lê** (declarado em
`frontend/proforma.ts:22-26`). Eram os únicos **leitores** vivos no repositório; resta um
pass-through de escrita — `AREAS_LOT` alimenta `TODOS_NUM` em `frontend/tela-premissas.ts` e o
Salvar regrava as 7 colunas em todo save, sem UI e sem leitor — mesmo estado residual que o
ACHADO 1 registra para `PRODUTOS_LOT`.

Consequência num loteamento criado depois daquela data: as 7 deduções saem **zero**, `_pizzaAreas`
filtra fatia por `v > 0.005`, e a pizza fica com **uma fatia só** — "a gleba inteira é vendável",
com 100%. Num estudo MIGRADO é pior: a `020` **não limpa** as colunas antigas, então a pizza continua
mostrando a composição de antes da migração, congelada, enquanto Premissas e Proforma já usam a
cascata editada depois.

**Conserto:** a composição passa a sair da mesma cascata que Premissas edita e que o motor usa,
via `itensAlocacaoGleba` (`frontend/areas-cascata.ts:227`) — as 7 deduções editáveis mais a ALV,
que fecham na poligonal por construção.

### ACHADO 5 · [P2] A #571 não alcançou `eficienciaPct` nem `roiPct`

A #571 tornou `margemLiquidaPct`, `custoObrasVgvPct` e `receitaLiquidaSobreVgvPct` `number | null`
quando o denominador não existe. **`eficienciaPct` e `roiPct` continuam caindo em `0`**
(`frontend/proforma.ts:507-508`) — e `eficienciaPct` é justamente o indicador **exclusivo do
Loteamento**.

Num Loteamento sem área de terreno, o Resumo mostra `Vendável / gleba = 0,0%`
(`frontend/tela-premissas.ts:1075`) e — pior que o número — `varianteFaixa` recebe `0` em vez de
`null` e **pinta o KPI de vermelho**: um falso alarme de benchmark sobre uma grandeza que não foi
medida. O mesmo 0,0% sai no PDF (`frontend/exportar.ts:155`). O contraste está na própria linha ao
lado: a margem, no mesmo array de KPIs, já mostra "—".

### ACHADO 6 · [P2] A ALV pode ficar negativa, sem piso e sem aviso

`calcularCascata` subtrai sem piso (`frontend/areas-cascata.ts:85-87`). Deduções que somem mais que
a poligonal produzem ALV negativa e, a partir dela:

- `areaVendavel < 0` → `eficienciaPct` negativa;
- infraestrutura no modo `R$/m²` vira **custo NEGATIVO** (`frontend/proforma.ts:453-454`), que reduz
  o custo direto e **infla** o resultado;
- o KPI "Área vendável" da Proforma exibe m² negativos.

É a mesma classe que a #563 decidiu no VGV ("nunca negativo, capado com aviso"), no eixo de área e
só no Loteamento — a Incorporação soma parcelas e não tem como ficar negativa. O conserto exige
decisão do autor (piso em zero + aviso, como o cap da permuta? ou banner de validação em
Premissas?), por isso fica como issue e não como diff.

### ACHADO 7 · [P2] O rótulo da permuta física diverge entre tela e exportação, só no Loteamento

A tela escreve `(-) Permuta física` quando `lot`, e `(-) Permuta física residencial` quando não
(`frontend/tela-proforma.ts:390`). A exportação escreve **sempre** `(-) Permuta física residencial`
(`frontend/exportar.ts:72`) — num Loteamento, que não separa residencial de não residencial.

A **#572** unifica a ORDEM das linhas de permuta entre tela e exportação e o critério 3 dela diz
"nenhum rótulo alterado". Este achado não pede rótulo novo: pede que a exportação passe a usar o
rótulo que a **tela já usa** para o Loteamento — um `lot ? … : …` de uma linha, que cabe
naturalmente no PR da #572.

### ACHADO 8 · [P3] `eficiencia_aproveitamento` — o único benchmark exclusivo do Loteamento — não vira medidor

`INDICADORES_SUPORTADOS` tem 4 campos (`frontend/benchmarks-indicadores.ts:16`) e nenhum é
`eficiencia_aproveitamento`, embora o número exista (`p.eficienciaPct`) e já seja comparado ao
benchmark no Resumo de Premissas. Resultado: num Loteamento, o benchmark que só ele tem cai em
`descartados` com o motivo genérico "sem indicador correspondente" e emite um `console.warn` — e a
aba Gráficos mostra 4 medidores na Incorporação e 4 no Loteamento, faltando exatamente o dele.

Depende de uma decisão pequena mas real (qual rótulo: "Vendável / gleba", de Premissas, ou
"Eficiência", do PDF — hoje o mesmo número tem dois nomes), por isso é issue e não diff.

### ACHADO 9 · [P3] Nenhum dos casos de render montava um Loteamento — **parcialmente consertado neste PR**

Os 27 casos de `frontend/render/casos/` derivam de `dados.ts`, que declara
`tipo_empreendimento: 'incorporacao'` (`frontend/render/casos/dados.ts:78`) — é a **única** ocorrência
de `tipo_empreendimento` em todo o diretório. Todo ramo `if (lot)` de tela (a cascata de áreas de
Premissas, o KPI "Vendável / gleba", o campo único de permuta física, a pizza da gleba) nunca tinha
sido montado em DOM nenhum, na camada que o `CLAUDE.md` nomeia como a única que enxerga "o
componente não chamou".

Este PR acrescenta o primeiro (`alocacao-areas-loteamento`, a aba Gráficos). Os ramos de Premissas
continuam descobertos.

### ACHADO 10 · [registro] A notação de sinal da #567 não alcançou a exportação da Proforma

A tela decide parênteses × sinal por `celulaProforma` (`frontend/tela-proforma.ts:46-48`). O CSV e o
PDF da Proforma continuam formatando com `fmtR$` cru (`frontend/exportar.ts:125`, `:151`): uma
Receita operacional negativa sai `-R$ …` no arquivo e `(…)` na tela, sobre o mesmo número. Não é
específico do Loteamento e não é regressão desta rodada — fica registrado porque a #567 e a #449
declararam "fonte única" para a célula do Fluxo de Caixa, e a da Proforma ficou fora.

### ACHADO 11 · [registro] A spec da área do Loteamento estava revogada — **consertado neste PR**

`docs/viabilidade/formulas.md` descrevia `área vendável = gleba × (1 − Σ percentuais de dedução)`
com os 7 campos de "% da gleba" — a fórmula que a migração `020` aposentou em 2026-08-03. Uma
auditoria "contra a spec" que aceitasse esse texto teria reprovado o código correto. O documento
agora descreve a cascata, cita as linhas vivas e declara os 7 campos como aposentados; a seção de
custos diretos ganhou as **três** unidades de infraestrutura (dizia duas) e a nota de que o custo de
obras do Loteamento é a infraestrutura sozinha.

### Registro adicional, fora da contagem

`frontend/premissas-conversao.ts:222-223` afirma que "a badge não muda o modo quando o canônico não
pôde ser estabelecido" em Premissas, citando a #515. `_trocarUnidade` grava o modo **sempre**
(`frontend/tela-premissas.ts:487`), e a #515 está **aberta** e fora do escopo desta rodada. A prosa
descreve uma decisão, não o código — vale para a permuta física do Loteamento, que é um campo com
badge e cuja base (`areaVendavelR`) é zero enquanto a cascata não estiver preenchida.

---

## 3 · O que este PR entrega, e o que ele deliberadamente não toca

**Entrega:** o ACHADO 4 (com a cascata como fonte única da composição da gleba), o ACHADO 11 (a
spec) e o primeiro caso de render de Loteamento do repositório (ACHADO 9, parcial).

**Não toca**, por escopo declarado: `frontend/proforma.ts`, `frontend/tela-proforma.ts`,
`frontend/tela-premissas.ts` e `frontend/exportar.ts` — os quatro estavam com PR em voo na fila da
Rodada 10 quando esta auditoria rodou. Os achados 1, 3, 5, 7 e 10 moram neles e por isso vêm como
issue/nota, com a evidência e o conserto proposto acima, e não como diff (regra R3, um assunto por
PR). Os achados 2 e 6 mexem em backend e em decisão de desenho, respectivamente.

## 4 · O que o encerramento da Rodada 10 ainda espera

Esta issue é a última da rodada por construção (`docs/rodada-10/planejamento.md:68`), e o critério 3
dela manda o PR que a fechar carregar, **no mesmo diff**, a tabela de backlog do `CLAUDE.md` e o
`PROGRESSO.md`. Enquanto **#570, #572 e #573** estiverem abertas, esse critério não pode ser
cumprido — por isso este PR declara `Sem-fechamento: #574`. O encerramento é do PR que fechar a
última issue restante.

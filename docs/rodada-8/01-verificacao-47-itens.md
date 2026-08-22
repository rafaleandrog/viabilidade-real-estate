# Rodada 8 · A1 — Verificação dos 47 itens da `lista bugs 20260807.xlsx`

> Agente **A1 — Curador de issues**. Branch `claude/rodada-8-auditoria`, base `main` @ `475dd24`.
> Escrito em 2026-08-21. Fonte da coluna `Issue`: `C:\Users\raafa\Downloads\lista bugs 20260807.xlsx`,
> aba `bugs`, lida pelo parser XML do §3 do dossiê (`<f>`/`<v>`, entidades decodificadas).
>
> **O que este documento é:** o resultado de (1) aprofundar os 3 itens que a varredura do dossiê
> deixou de pé, e (2) reauditar 8 dos 44 dados como implementados, lendo o **texto literal da coluna
> `Issue`** — que é mais detalhado que o `Título` — contra o código. Não é uma revarredura dos 47.
>
> **Ambiente:** o `@urbiverso/sdk` desta máquina é stub (sem `dist/`, sem `docs/`), então
> `validar-backend.sh` aborta no portão do SDK. Nenhuma verificação aqui depende dele: tudo é leitura
> de código, mais leitura de `C:\Users\raafa\urbiverso\ui\src\*.ts` (permitida — o monorepo é **só
> leitura**) para conferir contrato de primitivo. Nada foi escrito no monorepo.

---

## 0. Resumo executivo

| | Qtd |
|---|---:|
| Itens da planilha | 47 (numerados 1–41 e 43–48; **o 42 não existe**) |
| Confirmados implementados | **41** |
| **Sobreviveram como pendência** | **5** — itens **11, 17, 22, 24, 31** |
| Confirmados sem diff próprio (correto na `main`) | 1 — item **20** |
| Issues propostas no bloco 8-A | **6** (as 5 acima + 1 colateral da auditoria do item 46) |

**Dos 8 reauditados, 3 não se sustentaram:** itens **11**, **17** e **24**.
Sustentaram-se: **6, 13, 27, 39, 46**.

> ⚠️ **Uma correção ao dossiê.** O §4.1 usa o item 6 como exemplo canônico de "o código faz algo
> próximo, mas não o que foi pedido" — "o item 6 pedia *reordenar lista de custos* e o que foi
> entregue foi um grid de 3 colunas, que é agrupamento, não reordenação". **Isso está errado.** O
> *Título* diz "Reordenar lista de custos", mas o corpo da coluna `Issue` diz literalmente *"No
> máximo 3 campos de formulário por linha. Não aumente a largura dos campos, apenas adeque o
> espaçamento entre os campos e alinhamento por linhas"* — que é exatamente um grid de 3 colunas com
> larguras intocadas. O item 6 é o caso em que ler só o título produz o veredito oposto ao correto.
> Ver §2.1.

---

## 1. Tabela-resumo dos 47

`R7` = issue da Rodada 7 que respondeu pelo item (mapa reconstruído do `git log`, por assunto de
commit — os `item NN da lista` escritos em alguns corpos de commit **divergem** da planilha: um deles
cita "item 42", que não existe).

Legenda de **Fonte**: `A1` = reauditado neste documento, com evidência própria · `§4.1` = herdado da
varredura do dossiê, **não** reverificado por mim.

| # | Título (planilha) | R7 | Veredito | Evidência / Fonte |
|---:|---|---|---|---|
| 1 | Levar resumo para outra aba | #316 | ✅ implementado | §4.1 |
| 2 | Separar conteúdos em outras abas | #309 | ✅ implementado | §4.1 |
| 3 | Adicionar/remover itens na lista de produtos | #315 | ✅ implementado | §4.1 |
| 4 | Permuta física seleciona unidades de Produtos | #317 | ✅ implementado | §4.1 |
| 5 | Checkbox para alguns campos de custo | #318 | ✅ implementado | §4.1 |
| **6** | Reordenar lista de custos | #319 | ✅ **implementado** | **A1** — `frontend/tela-premissas.ts:287,549` · §2.1 |
| 7 | urbi-kpi Preço Médio/Unid some | #311 | ✅ implementado | §4.1 |
| 8 | Resumo de preço por unidades no Proforma | #321 | ✅ implementado | §4.1 |
| 9 | VGV sem permuta física | #310 | ✅ implementado | §4.1 |
| 10 | Item zerado não aparece no Proforma | #322 | ✅ implementado | §4.1 |
| **11** | Bear/Base/Bull à direita, sem "R$", 2 casas | #323 | 🔴 **PARCIAL — reaberto** | **A1** — `frontend/viab-format.ts:24-25` + `frontend/tela-proforma.ts:453` · §2.2 |
| 12 | Cálculo de análise de sensibilidade | #320 | ✅ implementado | §4.1 |
| **13** | Fazer a IA do Apelo Comercial funcionar | #324 | ✅ **implementado** | **A1** — `backend/apelo-comercial.ts`, `backend/rotas/apelo-comercial.ts:104-141` · §2.3 |
| 14 | Mudar nome da seção | #312 | ✅ implementado | §4.1 |
| 15 | Acesso a "Regiões monitoradas" | #313 | ✅ implementado | §4.1 |
| 16 | Curva S e outras curvas | #314 | ✅ implementado | §4.1 |
| **17** | urbi-kpi está sobrepondo ainda | #326 | 🔴 **NÃO SE SUSTENTA** | **A1** — `frontend/tela-resumo.ts:66-67` vs `frontend/tela-proforma.ts:52-53` e `urbiverso/ui/src/urbi-kpi.ts:41-47` · §2.4 |
| 18 | Retirar urbi-kpis | #325 | ✅ implementado | §4.1 |
| 19 | Pré-lançamento por checkbox | #330 | ✅ implementado | §4.1 |
| **20** | Início de Obra não é travado | #329 | ✅ **correto na `main`, sem diff próprio** | **A1** — `backend/rotas/avancado.ts:81-84,542-543,600-601`; UI `frontend/tela-fluxo-cronograma.ts:264,269` · §3.1 |
| 21 | Renomear fase "Após-chaves" → "Pós-obras" | #328 | ✅ implementado | §4.1 |
| **22** | Data de início só com mês e ano | #327 | 🟡 **PARCIAL — reaberto** | **A1** — `frontend/tela-fluxo-cronograma.ts:155-167`; `urbiverso/ui/src/urbi-input-data.ts:86` · §3.2 |
| 23 | Campo Nome tem erro de sincronização | #331 | ✅ implementado | §4.1 |
| **24** | Ajustar largura dos campos da tabela | #334 | 🟡 **PARCIAL — reaberto** | **A1** — `frontend/tela-empreendimento-tipologias.ts:58-64,79-82,192-195` · §2.5 |
| 25 | Coluna Área total | #332 | ✅ implementado | §4.1 |
| 26 | Mover Total de área privativa para o fim | #333 | ✅ implementado | §4.1 |
| **27** | Aviso de unidades que faltaram | #340 | ✅ **implementado** | **A1** — `frontend/fluxo-invariantes.ts:552-575`, `frontend/tela-empreendimento-tipologias.ts:151,158-171` · §2.6 |
| 28 | Nome do grupo padrão em Grupos | #341 | ✅ implementado | §4.1 |
| 29 | Absorção respeita fases do Cronograma | #347 | ✅ implementado | §4.1 |
| 30 | Absorção — corrigir nome de fase | #348 | ✅ implementado | §4.1 |
| **31** | "Definições" deve sair da tela de Receitas | #346 | 🟡 **PARCIAL — reaberto** | **A1** — `frontend/tela-fluxo-receitas.ts:727-738` (bloco ainda lá); destino em `frontend/tela-fluxo-custos.ts:487-511` · §3.3 |
| 32 | Ocultar "Nº Parcelas" em "Ao longo da obra" | #344 | ✅ implementado | §4.1 |
| 33 | Remover urbi-badge "Mensal" | #342 | ✅ implementado | §4.1 |
| 34 | Repasse travado em 1 mês após a obra | #345 | ✅ implementado | §4.1 |
| 35 | Retirar "Total dos componentes: 100%" | #343 | ✅ implementado | §4.1 |
| 36 | Categoria não é mais obrigatória/travada | #335 | ✅ implementado | §4.1 |
| 37 | Coluna Cronograma busca todas as Fases | #339 | ✅ implementado | §4.1 |
| 38 | Coluna Orçamento com Permuta física | #336 | ✅ implementado | §4.1 |
| **39** | Variações do urbi-kpi fora da caixa | #352 | ✅ **implementado** | **A1** — `frontend/fluxo-tabela.ts:57-92,221-232,246-256`; `frontend/tela-cenarios.ts:92,340` · §2.7 |
| 40 | Erro em distribuição para categoria Preço | #337 | ✅ implementado | §4.1 |
| 41 | Erro na formação da tabela de fluxo | #349 | ✅ implementado | §4.1 |
| — | *(item 42 não existe na planilha)* | — | — | — |
| 43 | Novas abas: Fluxo/Proforma/Análise Fin. | #351 | ✅ implementado | §4.1 |
| 44 | Trocar nome: Resultados | #350 | ✅ implementado | §4.1 |
| 45 | Adicionar total de área permutada | #338 | ✅ implementado | §4.1 |
| **46** | Inverter variação % da Exposição Máxima | #353 | ✅ **implementado** (com colateral) | **A1** — `frontend/fluxo-tabela.ts:251-253,276-279`, `frontend/cenario-variacao.ts:43-47` · §2.8 |
| 47 | Erro do gráfico ainda persiste | #354 | ✅ implementado | §4.1 |
| 48 | Modificação extrema na tela de Funding | #355 | ✅ implementado | §4.1 (PR #412 + spec pela #413) |

---

## 2. Auditoria da amostra — os 8 reexaminados

Método por item: ler o **texto integral da coluna `Issue`** (não o título), ler o diff que fechou a
issue da Rodada 7, e ler o **código de hoje** na `main`. Procurando o padrão que já falhou nesta app:
*o código faz algo próximo, mas não o que foi pedido.*

### 2.1 Item 6 — Reordenar lista de custos → ✅ **SUSTENTA** (e o dossiê estava errado)

> **Pedido literal:** "Alinhar para que os custos estejam melhor distribuídos na vertical da tela. No
> máximo 3 campos de formulário por linha. **Não aumente a largura dos campos**, apenas adeque o
> espaçamento entre os campos e alinhamento por linhas."

O entregue (`frontend/tela-premissas.ts:287`, aplicado em `:549`):

```css
@media (min-width: 700px) {
  .grid.grid-3col { display: grid; grid-template-columns: repeat(3, auto); justify-items: start; }
}
```

Ponto a ponto: **máximo 3 por linha** ✓ (`repeat(3, auto)`, contra o `flex-wrap` de `.grid:274` que
empacotava 6+ campos de 165px numa linha larga) · **larguras intocadas** ✓ (`.grid > .p1/.p2/.p3`
em `:275-277` não foram tocadas, e `justify-items:start` impede o grid de esticar o campo até a
coluna) · **espaçamento uniforme** ✓ (`gap: 12px` de `.grid:274` vale igual em grid) · **alinhamento
por linhas** ✓ (colunas `auto` alinham verticalmente entre linhas — é o que o `flex-wrap` não fazia).

O grid **é** o que foi pedido; o título "Reordenar" é o rótulo do autor para o sintoma. Nada a
reabrir.

**Ressalva menor, não bloqueante:** abaixo de 700px o `@media` não vale e volta o `flex-wrap`, onde
4 campos `.p1` (165px) + 3 gaps de 12px = 696px cabem numa viewport de 699px. É uma janela de ~4px;
registrado aqui para não ser "descoberto" de novo, não vira issue.

### 2.2 Item 11 — Bear/Base/Bull à direita, sem "R$", 2 casas → 🔴 **NÃO SE SUSTENTA (parcial)**

> **Pedido literal:** "Ajuste o texto dessas colunas para ficarem todos alinhados à direita da
> tabela, **inclusive o título de cada coluna**. E retire o símbolo de dinheiro de todos os campos,
> **mantenha o formato em número com duas casas decimais**."

Três cláusulas. As duas primeiras foram entregues (`frontend/tela-proforma.ts:123,132,134`:
`.pf.sens .sens-cab { justify-content: flex-end }`, `.pf.sens th.num`/`td.num { text-align: right }`).
**A terceira não.** `tela-proforma.ts:453`:

```ts
const fmt = (m: { pct?: boolean }, v: number) => (m.pct ? fmtPct(v) : fmtNum(v, 2));
```

e `frontend/viab-format.ts:24-25`:

```ts
export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);
```

`fmtNum` só declara **`maximumFractionDigits`** — nunca `minimumFractionDigits`. O comentário do
próprio commit (`5c09968`) promete *"número puro, sem símbolo, mantendo as 2 casas decimais"*, mas o
formatador entrega **até** 2 casas: `1500000` sai `"1.500.000"`, `1500000.5` sai `"1.500.000,5"`,
`1500000.55` sai `"1.500.000,55"`. Numa coluna que a mesma issue acabou de alinhar à direita, isso
produz exatamente o defeito que o alinhamento existe para evitar: a vírgula decimal não bate entre
linhas.

Isto também colide com o contrato do `CLAUDE.md` § Contratos inegociáveis — *"todo valor monetário
resultado de fórmula tem 2 casas decimais — na apresentação, na entrada e no motor"*. Os 5 valores
monetários da sensibilidade são resultado de fórmula (`calcularProforma`).

Já existe no repo o formatador certo: `fmtR$(v, false)` (`viab-format.ts:13-22`) devolve o número
com `min=max=2` casas **sem** o símbolo — é a fonte única de arredondamento monetário do C7/#281.
→ Issue **8-A.1**.

### 2.3 Item 13 — Fazer a IA do Apelo Comercial funcionar → ✅ **SUSTENTA**

> **Pedido literal:** "Nunca nada é suficiente para gerar alguma avaliação válida nessa parte.
> **Verifique se o problema é de código ou na instrução** para funcionamento da IA. Ao **diagnosticar
> primeiro**, você vai determinar e orientar qual a próxima mudança que precisa ser feita."

O pedido é um diagnóstico com desdobramento, e foi cumprido nessa ordem. Diagnóstico publicado
(commit `80f729a`): os 6 fatores avaliados são todos geográficos e o contexto enviado **não levava
localidade nenhuma** — o modelo devolvia nota `null` em tudo. Três correções decorrentes, todas
presentes hoje:

- `backend/rotas/apelo-comercial.ts:107-111` — resolve a localidade (`mercado_regioes` > `estudos.uf`)
  e a coloca em primeiro lugar no contexto (`montarContextoApelo`, `backend/apelo-comercial.ts`);
- `backend/rotas/apelo-comercial.ts:138-141` — o gate de "sem conteúdo" saiu de *antes* da extração
  (`documentos.length > 0`) para *depois* (`partes.length === 0` → `422 CONTEUDO_INSUFICIENTE`), que
  era o caso em que a IA era chamada com contexto vazio;
- `backend/rotas/apelo-comercial.ts:127-130` — falha de extração deixou de ser engolida em
  `console.warn` e vai na resposta (`falhas`), notificada em `frontend/tela-apelo.ts`.

Mais `normalizarRespostaApelo` como trava pós-resposta (reconstrói os 6 fatores × 4 perguntas na
ordem canônica e descarta nota fora de 1–5), coberto por `backend/apelo-comercial.test.ts`.

**Limite honesto:** nada aqui prova que a IA *hoje, na instância*, devolve avaliação válida — isso
depende de `req.ia` e do modelo, que não existem neste ambiente. O que se prova é que a causa
diagnosticada foi corrigida e testada. Confirmação de runtime é do autor (ou do A5/A6).

### 2.4 Item 17 — urbi-kpi está sobrepondo ainda → 🔴 **NÃO SE SUSTENTA**

> **Pedido literal:** "Problema contínuo que ainda não foi resolvido mesmo pedindo várias vezes.
> Verifique o que foi feito antes e porque isso está acontecendo para corrigir. O contrato de UI do
> urbiverso não permite que isso aconteça e **nos estudos Preliminares isso já está certo**."

O autor entregou o gabarito na própria frase: **compare com o Preliminar**. É a comparação que a
#326 não fez.

**Preliminar (o que o autor diz estar certo)** — `frontend/tela-proforma.ts:52-53`:

```css
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 220px)); gap: 12px; }
.kpis urbi-kpi { min-width: 0; }
```

Sem `width: 100%`. O item de grid é dimensionado pela track, `min-width: 0` desarma o
`min-width: auto` de item de grid, e acabou.

**Avançado, depois da #326** — `frontend/tela-resumo.ts:66-67`:

```css
.kpis .kpi-cel { display: flex; flex-direction: column; min-width: 0; }
.kpis .kpi-cel urbi-kpi { width: 100%; }
```

O `width: 100%` **foi mantido**, só desceu um nível. E o `:host` do primitivo
(`C:\Users\raafa\urbiverso\ui\src\urbi-kpi.ts:41-47`) é:

```css
:host { background: …; border: 1px solid …; border-radius: …; padding: 14px 16px; min-width: 140px; }
```

— **sem `box-sizing: border-box`**, e a classe base `UrbiPrimitivoDeConteudo.estiloConteudo`
(`urbiverso/ui/src/urbi-primitivo-conteudo.ts:39-48`) declara só `display/flex-direction/min-height`.
`box-sizing` **não é herdado**, e nenhuma folha do app o define para `urbi-kpi`
(`grep -n "box-sizing" frontend/*.ts` → só `.grid > *` em premissas/financeiro/funding e `.c1..c6` em
fluxo-tabela; nada que alcance o host do KPI).

Logo `width: 100%` é **largura de conteúdo**, e a caixa renderizada mede `100% + 32px de padding +
2px de borda`. Ela transborda `.kpi-cel` — que não tem `overflow` — e pinta sobre o card vizinho.
**É exatamente o sintoma que o autor reportou pela enésima vez.**

O próprio commit `bd1244e` nomeia o mecanismo — *"se o `:host` do primitivo tiver padding/border em
content-box (shadow DOM inacessível a esta folha), o card estoura a track"* — e então **mantém o
`width: 100%`**, apostando que o wrapper resolve. O wrapper não clipa nem restringe nada.

**Achado colateral, mesma família:** `frontend/tela-cenarios.ts:363` usa `<div class="kpi-cel">` e
**não existe regra `.kpi-cel` no `static styles` desse componente** (`:92`) nem em
`estiloFluxoTabela` (`frontend/fluxo-tabela.ts` define `.kpi-card`, nunca `.kpi-cel`). É classe
órfã, resíduo da `tela-capital-stack.ts` apagada pela #355. Não causa sobreposição hoje (é card
único), mas é dívida da mesma origem e entra na mesma issue.

→ Issue **8-A.2**.

### 2.5 Item 24 — Ajustar largura dos campos da tabela → 🟡 **PARCIAL — reaberto**

> **Pedido literal:** "…a largura de todas as colunas está muito grande. Você vai reduzir a coluna de
> **Área privativa** para caber corretamente qualquer número de **6 dígitos**, nos campos
> **Dormitórios e Vagas** para números de **2 dígitos** e na coluna **Unidades** para caber números
> com **4 dígitos**. Deixe o **espaçamento entre todas elas iguais**."

A parte dos dígitos foi entregue com precisão (`frontend/tela-empreendimento-tipologias.ts:79-82`):
`c-area: 16ch`, `c-dorm: 7ch`, `c-vagas: 7ch`, `c-un: 8ch`, `c-areatot: 17ch`. O espaçamento uniforme
também: vem do `td { padding: 6px 8px }` (`:66-71`) compartilhado, sem override por coluna.

**O que a mesma mudança quebrou:** a tabela é `table-layout: fixed` (`:56`) e **`th` tem
`overflow: hidden`** (`:63`), sem nenhuma estratégia de quebra (`white-space`, `overflow-wrap` e
`hyphens` não são declarados). Os rótulos de cabeçalho (`:192-195`) são "Área privativa",
"Dormitórios", "Vagas", "Unidades", "Área total" — e **"Dormitórios" é uma palavra única de 11
caracteres**, que não quebra.

Contas, com `th { font-size: var(--texto-rotulo, 0.75rem) }` e `1ch ≈ 0,5em` da fonte da tabela:

| Coluna | Largura | menos `padding: 8px+8px` | Cabeçalho | Cabe? |
|---|---|---|---|---|
| `c-dorm` | 7ch ≈ 49px | ≈ 33px | "Dormitórios" ≈ 66px | ❌ cortado |
| `c-vagas` | 7ch ≈ 49px | ≈ 33px | "Vagas" ≈ 33px | ⚠️ no limite |
| `c-un` | 8ch ≈ 56px | ≈ 40px | "Unidades" ≈ 52px | ❌ cortado |
| `c-area` | 16ch ≈ 112px | ≈ 96px | "Área privativa" (quebra no espaço) | ✅ |

Antes da #334 essas colunas eram 90px/90px/100px — em que "Dormitórios" (~66px + 16px de padding)
**cabia**. A redução para caber os dígitos passou por baixo da largura do rótulo, e o
`overflow: hidden` do `th` corta em silêncio.

O autor pediu para ajustar a largura **dos campos**; não pediu para perder o cabeçalho. É "faz algo
próximo, mas não o que foi pedido" na modalidade *efeito colateral não avaliado*.

**Ressalva de honestidade:** este é um veredito por cálculo tipográfico, não por medição em
navegador — este ambiente não tem browser (decisão do autor, §1 do dossiê). A issue **8-A.4** traz o
critério de aceite em forma verificável e deixa explícito que a primeira coisa a fazer é medir. É o
item da amostra em que tenho **menos** certeza; classifiquei como PARCIAL, não como reprovado.

### 2.6 Item 27 — Aviso de unidades que faltaram → ✅ **SUSTENTA**

> **Pedido literal:** "…**no fim da página** vai aparecer um aviso mostrando **quantas unidades de
> cada tipologia** faltam ser alocadas nos grupos de Receitas. Esse cálculo deve saber corretamente
> também **quais unidades foram alocadas para permuta física** e calcular corretamente as unidades
> restantes que são todas as previstas para serem vendidas."

Quatro cláusulas, quatro confirmações:

- **no fim da página** ✓ — `frontend/tela-empreendimento-tipologias.ts:151`, `_renderAvisoNaoAlocadas()`
  chamado **depois** do `</urbi-card>` da tabela, antes só do modal de confirmação;
- **por tipologia** ✓ — `:164-166` itera a lista e emite `<li>${t.nome}: ${naoAlocado} de ${quantidadeTotal}</li>`;
- **desconta a permuta física** ✓ — `frontend/fluxo-invariantes.ts:558,566-567`:
  `const permutas = quantidadesPermutadas(linhasCusto)` … `const naoAlocado = total - alocado - permutado`;
- **restante = o que sobra para vender** ✓ — só emite quando `naoAlocado > tol`, e sobre-alocação
  (diferença negativa) não vira aviso, coberto por `frontend/fluxo-invariantes.test.ts:388-410`
  (3 testes: parcial, totalmente alocada, sobre-alocada).

Uso de primitivo conferido: `urbi-banner` tem slot default (`urbiverso/ui/src/urbi-banner.ts:125`) e
`variante="alerta"` é valor declarado (`:23`). Nada a reabrir.

### 2.7 Item 39 — Variações do urbi-kpi fora da caixa → ✅ **SUSTENTA**

> **Pedido literal:** "Os urbi-kpis tem um item de variação percentual em relação ao cenário base e
> esses percentuais estão aparecendo **fora da caixa do kpi**. Alguma mudança fez isso acontecer
> porque antes estava funcionando normalmente."

A causa estrutural está documentada em `frontend/fluxo-tabela.ts:57-65`: `urbi-kpi` declara 4 props
(`rotulo`/`valor`/`variante`/`formato`) e o `render()` **não tem `<slot>`** — confirmado direto na
fonte, `urbiverso/ui/src/urbi-kpi.ts:33-36,71-74`. Nenhum markup filho sobrevive, e o overlay tentado
antes (#262) caía por cima do valor.

A saída (D7) foi abandonar o primitivo nesses cards e desenhar com markup + tokens próprios:
`.kpi-card` (`fluxo-tabela.ts:67-92`) reproduz `background`/`border`/`radius`/`padding` do `:host` do
primitivo com **tokens do design system, sem cor literal**, e a variação é `<span class="kpi-var">`
**filha do mesmo `.kpi-card`** (`:276-279` e irmãos) — dentro da caixa, por construção do DOM, não por
posicionamento. A tela de Cenários aplica `estiloFluxoTabela` (`tela-cenarios.ts:92`) e consome
`kpisFluxo(cenario, alterado ? base : null)` (`:340`).

Este é, aliás, o contraste que condena o item 17: aqui o app parou de brigar com o shadow DOM do
primitivo; lá continuou empurrando `width: 100%` contra ele.

### 2.8 Item 46 — Inverter a variação % da Exposição Máxima → ✅ **SUSTENTA** (com colateral)

> **Pedido literal:** "Inverter a lógica nesse kpi para a **seta ir para cima quando o valor sobe** (e
> a **cor fica vermelha**, indicando que é um cenário negativo) e **para baixo quando o valor
> diminui** (com **cor verde**)."

Traço completo, `frontend/fluxo-tabela.ts:251-253` + `:276-279` + `frontend/cenario-variacao.ts:43-47`
+ `fluxo-tabela.ts:221-232`:

| Situação | `pct` | Seta (`:225`) | `melhor` (`cenario-variacao.ts:47`, `maiorMelhor=false`) | Cor (`:227`) |
|---|---|---|---|---|
| magnitude sobe (1,0M → 1,2M) | `+20%` | ▲ `fa-arrow-up` | `!subiu` = `false` | `.pior` → **vermelho** ✓ |
| magnitude cai (1,2M → 1,0M) | `-16,7%` | ▼ `fa-arrow-down` | `!subiu` = `true` | `.melhor` → **verde** ✓ |

E o valor exibido é `fmtR$(Math.abs(c.exposicaoMaxima))` (`:283`), então "o valor sobe" na tela é
inequivocamente a magnitude. Exatamente o pedido. `urbi-icone` com a prop `classe` é API declarada
(`urbiverso/ui/src/urbi-icone.ts:27`).

**Colateral encontrado — a mesma tela agora se contradiz.** A #353 inverteu a leitura **só no KPI**.
A tabela de cenários salvos, na mesma tela, continua com a lógica anterior:

- `frontend/tela-cenarios.ts:539` — `_badgeVar` chama `calcularVariacao(novo, base, true)`, com o
  comentário `:534-537` afirmando *"inclusive a exposição máxima, que sendo negativa melhora ao
  subir"* — a premissa que a #353 aposentou;
- `frontend/tela-cenarios.ts:559-560` e `:525` — a célula mostra `fmtR$(calc.exposicaoMaxima)`,
  **com sinal**, enquanto o KPI logo acima mostra o módulo;
- `frontend/tela-cenarios.ts:284` (`_renderMarcos`) — idem, valor com sinal;
- `frontend/tela-resumo.ts:180` — usa `Math.abs`, alinhado ao KPI.

Numa piora de exposição de −1,0M para −1,2M, a tela mostra **`+20,0%` no KPI e `−20,0%` no badge da
tabela**, para o mesmo cenário e a mesma grandeza. A cor coincide por acidente aritmético (as duas
convenções concordam no *veredito*, discordam no *sinal* e no *valor*). O item 46 falava só do KPI,
então isso não reprova a entrega — mas é defeito real e visível. → Issue **8-A.6**.

---

## 3. Os 3 itens sobreviventes da varredura

### 3.1 Item 20 — Início de Obra não é travado → ✅ **correto na `main`; nada a fazer no código**

> **Pedido literal:** "Campo de mês de início das obras não é travado e o usuário insere o valor que
> quiser."

Travado nas **duas** camadas, e a de baixo é a que importa:

- **Backend, regra** — `backend/rotas/avancado.ts:81-84`:
  `obra.inicio_mes = plan.inicio_mes + plan.duracao_meses; obra.travado_inicio = true;`
  dentro de `recalcularTravados`, que roda em **toda** leitura e em todo PATCH via `lerCronograma`
  (`:392`, `:590`, `:606`).
- **Backend, recusa** — `aplicarDeltaEvento` (`:542-543`): `if (alvo.travado_inicio) return
  { codigo: 'CAMPO_TRAVADO', … }`, e o handler devolve **422** (`:601`) **antes de qualquer
  escrita** (validação em duas fases, `:592-606`). Não é só cosmético de UI: um `curl` com
  `inicio_mes` para `obra` é recusado.
- **Frontend** — `frontend/tela-fluxo-cronograma.ts:264` (`?desabilitado=${bloqueado || travadoIni}`)
  e `:269` (cadeado 🔒 com `title="Calculado automaticamente"`).

A #329 ter fechado sem commit está **correto**: a regra veio da #224 (Rodada 5), antes da Rodada 7.
O autor reportou contra a versão publicada.

> ⚠️ **Não use "a instância está em 0.1.28, igual ao `manifesto.json`" como prova de que ela tem este
> código.** `versao` é **versão de schema** — só bumpa com migração nova (`CLAUDE.md` § Versão do
> manifesto). Duas builds de código muito diferentes carregam a mesma `versao`; quem distingue é o
> `build_sha`. Para o item 20 isso não muda o veredito (a regra é de 5 rodadas atrás), mas é a
> armadilha que faz "confirmar contra a instância" parecer desnecessário quando não é.

**Nenhuma issue.** Fica só, para o autor, a confirmação de runtime na Pinguim.

**Pergunta que nasceu daqui** — ver §5, Q1: `obra.inicio_mes` é ancorado no **fim do Planejamento**,
o mesmo mês do Pré-lançamento, ou seja **antes do Lançamento**. É decisão da #224, está fora do
escopo do item 20, mas contraria a prática usual de incorporação.

### 3.2 Item 22 — Data de início só com mês e ano → 🟡 **PARCIAL**

> **Pedido literal:** "Hoje o campo nessa parte é de texto num formato que identifica a data mas eu
> quero que a seleção seja mais automatizada para que eu possa **selecionar em uma caixa de datas** o
> valor correto nesse campo. **O `urbi-input-data` permite fazer essa seleção**, eu só quero que a
> mudança seja **não precisar selecionar o dia**, **trave o dia como dia primeiro de qualquer mês** e
> eu **seleciono somente o mês e ano**. As regras e dependências de outras variações e campos
> continuam dependentes desse campo inicial que determina o marco zero do empreendimento objeto de
> estudo."

| Cláusula | Estado | Evidência |
|---|---|---|
| Caixa de datas em vez de texto livre | ✅ | `frontend/tela-fluxo-cronograma.ts:155-167` — `urbi-input-data` substituiu o `urbi-input` |
| Dia travado no 1º | ✅ | `mesAnoParaISO` (`frontend/fluxo-shared.ts:33-37`) sempre emite `-01`; `isoParaMesAno` (`:40-46`) descarta o dia na volta |
| Marco zero preservado | ✅ | o persistido continua `"mmm/AAAA"`; `parseMesAno`/`REGEX_MES_ANO` intactos |
| **Não precisar selecionar o dia** | ❌ | — |
| **Selecionar somente mês e ano** | ❌ | — |

O bloqueio é do primitivo: `urbiverso/ui/src/urbi-input-data.ts:86` renderiza `type="date"`, fixo, e
as props declaradas (`:18-24`) são `label`, `valor`, `min`, `max`, `obrigatorio`, `desabilitado`,
`erro` — **não há prop de granularidade**. O seletor nativo abre uma grade de dias e exige escolher
um. O comentário do app admite isso em `tela-fluxo-cronograma.ts:161-165`.

Ou seja: a **semântica** está certa (o dia sempre vira 1º e nunca é persistido) e a **interação**
não. O que o autor pediu — "eu seleciono somente o mês e ano" — é literalmente `type="month"`.

**A correção completa exige mudança no monorepo**, que esta app não pode fazer (`CLAUDE.md` § O
monorepo é só leitura). O texto pronto para o autor levar está na issue **8-A.3**, §"Pedido à
plataforma", em bloco separado e copiável.

### 3.3 Item 31 — "Definições" deve sair da tela de Receitas → 🟡 **PARCIAL**

> **Pedido literal:** "**Pode retirar essa informação dessa tela** de fluxo que existe para cada grupo
> em Viabilidade → Receitas. Definições que interfere se corretagem é destacada ou embutida e o
> checkbox RET devem estar lá em **Custos → Custos Financeiros**. Faça essa migração e ajuste na
> outra aba destino dessas variáveis."

**O destino está certo, e melhor do que o dossiê registrou.** O dossiê aponta
`frontend/tela-financeiro.ts:174` como o novo lar do RET; não é. O controle global vive em
`frontend/tela-fluxo-custos.ts:487-511` (`_renderRet`), dentro do **grupo Financeiro da tela de
Custos** — que é exatamente "Custos → Custos Financeiros". Persiste em
`estudos.considerar_ret`/`ret_pct` via `/avancado/parametros` (`tela-fluxo-custos.ts:955-975`;
backend `backend/rotas/avancado.ts:447-448,482-491`), migração `027_ret_global.js`. O checkbox
`sujeito_ret` de `tela-financeiro.ts:174` é **outro campo**, do Preliminar (mesmo controle em
`tela-premissas.ts:563`), lido só por `frontend/proforma.ts:245` — ver Q3 na §5.

**O que não foi feito é o verbo da primeira frase: retirar.** `frontend/tela-fluxo-receitas.ts:727-738`
ainda renderiza, dentro do modal "Fluxo de pagamento":

```html
<div class="pag-secao">
  <h4>Definições</h4>
  <p class="sec">Corretagem: configurada na linha de custo obrigatória "Corretagem de vendas" (Custos → Diretos).</p>
  <p class="sec">RET: controle global do estudo, em Custos → Financeiro.</p>
</div>
```

O bloco virou dois letreiros estáticos apontando para outro lugar — mas o autor não pediu uma placa,
pediu que a informação saísse da tela. E o `<h4>Definições</h4>` continua ocupando a primeira coluna
do `.pag-grid`, que é o espaço nobre do modal.

**Sobre a corretagem — a #346 acertou o mérito, e é preciso dizer por quê**, senão a próxima sessão
"corrige" isto de volta. O autor pediu para **mover** o controle "destacada ou embutida". A #346
**apagou**. Está certo porque, desde a **#228**, `comissao.tipo` **não tem efeito nenhum** no motor:
`grep -n "comissao" frontend/fluxo-caixa-motor.ts frontend/fluxo-shared.ts` **não retorna nada**, e o
teste `frontend/fluxo-caixa-motor.test.ts:381-403` afirma o contrário do que o nome sugere —
*"marcar comissão 'Destacada' não muda mais o Resultado"*, com `assert.ok(perto(resultado(rEmbutida),
resultado(rDestacada), 1))`. Mover um controle inerte para Custos violaria a #279 ("nenhum campo da
aba Financeiro permanece inerte"). **Mas o autor claramente acredita que o campo ainda interfere** —
ele escreveu "Definições **que interfere** se corretagem é destacada ou embutida". Isso é divergência
de modelo mental, não de UI, e vai como Q2 na §5.

→ Issue **8-A.5** (só a remoção do bloco; a corretagem fica fora de escopo, com o motivo escrito).

---

## 4. Issues propostas — bloco 8-A (dívida da Rodada 7)

> Seis issues, prontas para colar. Todas de **frontend puro** exceto a 8-A.3, que depende da
> plataforma. Nenhuma toca `schema.json` nem migração → **`versao` do `manifesto.json` não bumpa** em
> nenhuma delas (`CLAUDE.md` § Versão do manifesto).
>
> `Closes #NNN` só fecha **em inglês** e **no corpo do PR ou do commit — nunca no título**.

---

### 8-A.1 — item 11

**Título**

```
fix(proforma): sensibilidade com 2 casas decimais fixas, não "até 2"
```

**Corpo**

```markdown
**Contexto** — item 11 da `lista bugs 20260807.xlsx`; issue original #323 da Rodada 7, que entregou
duas das três cláusulas do pedido. A terceira ("mantenha o formato em número com duas casas
decimais") não foi entregue e ninguém percebeu porque nenhum teste cobre a formatação dessa tabela.

**Comportamento atual**
- `frontend/tela-proforma.ts:453` — `const fmt = (m, v) => (m.pct ? fmtPct(v) : fmtNum(v, 2));`
- `frontend/viab-format.ts:24-25` — `fmtNum` declara **só** `maximumFractionDigits`, nunca
  `minimumFractionDigits`.

Resultado na tabela de sensibilidade (Preliminar → Resultado → Cenários), colunas Bear/Base/Bull:
`1500000` → `"1.500.000"`; `1500000.5` → `"1.500.000,5"`; `1500000.55` → `"1.500.000,55"`.

**Por que não atende** — o pedido literal do autor é *"retire o símbolo de dinheiro de todos os
campos, **mantenha o formato em número com duas casas decimais**"*. `fmtNum(v, 2)` entrega **até**
2 casas, não 2 casas. Numa coluna que a própria #323 acabou de alinhar à direita, a vírgula decimal
deixa de bater entre linhas — o defeito que o alinhamento existe para evitar. Também colide com o
contrato do `CLAUDE.md` § Contratos inegociáveis: *"todo valor monetário resultado de fórmula tem 2
casas decimais — na apresentação, na entrada e no motor"*, e os 5 valores monetários dessa tabela
são resultado de `calcularProforma`.

**Comportamento esperado** — os valores monetários das colunas Bear/Base/Bull exibem **sempre** 2
casas decimais, sem símbolo de moeda, com separador de milhar pt-BR. Use `fmtR$(v, false)`
(`frontend/viab-format.ts:13-22`), que já é a fonte única de arredondamento monetário do contrato C7
(#281) e devolve `min = max = 2` sem o símbolo. **Não** crie um formatador novo, e **não** altere a
assinatura de `fmtNum` — ela tem 5 chamadores com semânticas diferentes.

As duas linhas de indicador (`Custo obras / VGV`, `Margem líquida`) continuam em `fmtPct` — são %
calculada, 1 casa, e não estão em escopo.

**Critério de aceite**
1. `grep -n "fmtNum(v, 2)" frontend/tela-proforma.ts` **não retorna nada**.
2. Teste novo em `frontend/viab-format.test.ts` (ou `proforma.test.ts`) provando
   `fmtR$(1500000, false) === '1.500.000,00'` e `fmtR$(1500000.5, false) === '1.500.000,50'`.
3. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo**
- Os outros 4 chamadores de `fmtNum` com casas (`tela-premissas.ts:924,925`,
  `tela-proforma.ts:224`, `viabilidade-config-benchmarks.ts:166`) — m², ha e % não são valor
  monetário e seguem a regra de "precisão plena internamente, arredonda só para exibir".
- `frontend/exportar.ts:10`, que ainda define o próprio `const R$ = v.toFixed(2)`. É a **#281**, uma
  correção estrutural de fonte única — não conserte pontualmente aqui.

Sem-fechamento: #281 dívida vizinha (segunda fonte de formatação em exportar.ts), não resolvida aqui
Sem-fechamento: #323 executora original do item 11 na Rodada 7, já fechada; esta issue cobre a
cláusula que ficou de fora
```

---

### 8-A.2 — item 17

**Título**

```
fix(resumo): urbi-kpi para de estourar a track — remover width:100%, espelhar o Preliminar
```

**Corpo**

```markdown
**Contexto** — item 17 da `lista bugs 20260807.xlsx`; issue original #326 da Rodada 7. O autor
escreveu *"problema contínuo que ainda não foi resolvido mesmo pedindo várias vezes"* — é a terceira
passada (antes: #176, #326). E deu o gabarito na própria frase: *"nos estudos Preliminares isso já
está certo"*.

**Comportamento atual**

Preliminar — `frontend/tela-proforma.ts:52-53` (o que o autor diz estar certo):
```css
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 220px)); gap: 12px; }
.kpis urbi-kpi { min-width: 0; }
```

Avançado — `frontend/tela-resumo.ts:66-67` (depois da #326):
```css
.kpis .kpi-cel { display: flex; flex-direction: column; min-width: 0; }
.kpis .kpi-cel urbi-kpi { width: 100%; }
```

**Por que não atende** — a #326 embrulhou o KPI num `.kpi-cel` mas **manteve o `width: 100%`**, só
desceu um nível. O `:host` do primitivo (`urbiverso/ui/src/urbi-kpi.ts:41-47`) declara
`padding: 14px 16px` + `border: 1px` e **não** declara `box-sizing: border-box`; a classe base
`UrbiPrimitivoDeConteudo.estiloConteudo` (`urbiverso/ui/src/urbi-primitivo-conteudo.ts:39-48`) define
só `display`/`flex-direction`/`min-height`. `box-sizing` não é herdado, e nenhuma folha do app o
define para `urbi-kpi` (`grep -n "box-sizing" frontend/*.ts` → só `.grid > *` e `.c1..c6`).

Logo `width: 100%` é largura de **conteúdo**: a caixa mede `100% + 32px + 2px` e transborda o
`.kpi-cel`, que não tem `overflow`. É a sobreposição reportada. O commit `bd1244e` **nomeia esse
mecanismo** na própria mensagem — *"se o :host do primitivo tiver padding/border em content-box … o
card estoura a track"* — e mesmo assim mantém o `width: 100%`.

O Preliminar não tem o problema porque **não usa `width: 100%`**: o item de grid é dimensionado pela
track e `min-width: 0` desarma o `min-width: auto` de item de grid.

**Comportamento esperado**
1. Em `frontend/tela-resumo.ts`, remover o wrapper `.kpi-cel` e as duas regras `:66-67`, deixando os
   `<urbi-kpi>` como itens diretos do grid (`:176-184`), com uma única regra espelhando o
   Preliminar: `.kpis urbi-kpi { min-width: 0; }`. Nenhum `width` no primitivo.
2. Remover a classe órfã `kpi-cel` de `frontend/tela-cenarios.ts:363` — **não existe** regra
   `.kpi-cel` no `static styles` desse componente (`:92`) nem em `estiloFluxoTabela`
   (`frontend/fluxo-tabela.ts` define `.kpi-card`, nunca `.kpi-cel`). É resíduo da
   `tela-capital-stack.ts` apagada pela #355.

**Critério de aceite**
1. `grep -rn "width: 100%" frontend/tela-resumo.ts` **não retorna** nenhuma linha com `urbi-kpi`.
2. `grep -rn "kpi-cel" frontend/*.ts` **não retorna nada**.
3. A regra de `.kpis urbi-kpi` em `tela-resumo.ts` é **textualmente idêntica** à de
   `tela-proforma.ts:53`.
4. `bash scripts/validar-frontend.sh` verde.
5. **Confirmação visual na Pinguim** (Avançado → Resumo, janela estreita, com VPL/VGV de 9+ dígitos):
   nenhum card pinta sobre o vizinho. Este passo é do autor ou do agente de UI — não há navegador no
   ambiente Claude Code, e "não deu para rodar" nunca é "passou".

**Fora de escopo**
- Pedir slot ou prop nova em `urbi-kpi`. Não é necessário: o Preliminar prova que o primitivo, usado
  como está, não sobrepõe.
- Os `.kpi-card` de `frontend/fluxo-tabela.ts:67-92` (markup próprio da D7/#352). Estão corretos e
  são a referência do padrão oposto — quando o app precisa de algo que o primitivo não declara,
  desenha o card, em vez de forçar CSS contra o shadow DOM.

Sem-fechamento: #326 executora original do item 17, já fechada; o wrapper que ela introduziu é a
causa desta issue
Sem-fechamento: #176 primeira tentativa no mesmo sintoma, contexto histórico
```

---

### 8-A.3 — item 22

**Título**

```
feat(cronograma): Data de início do projeto selecionada só por mês e ano
```

**Corpo**

```markdown
**Contexto** — item 22 da `lista bugs 20260807.xlsx`; issue original #327 da Rodada 7, que entregou
a metade semântica e não a metade de interação.

**Comportamento atual** — `frontend/tela-fluxo-cronograma.ts:155-167` usa `urbi-input-data` com
`.valor=${mesAnoParaISO(...)}` e converte de volta com `isoParaMesAno(e.detail.valor)`
(`frontend/fluxo-shared.ts:33-46`). O dia é sempre emitido como `-01` e sempre descartado na volta;
o persistido segue `"mmm/AAAA"`.

Mas `urbiverso/ui/src/urbi-input-data.ts:86` renderiza `<input type="date">`, fixo, e as props
declaradas (`:18-24`) são `label`, `valor`, `min`, `max`, `obrigatorio`, `desabilitado`, `erro` —
**nenhuma de granularidade**. O seletor nativo abre grade de dias e exige escolher um. O próprio
comentário do app admite: `tela-fluxo-cronograma.ts:161-165`.

**Por que não atende** — o autor pediu três coisas e recebeu uma:

| Pedido literal | Estado |
|---|---|
| "selecionar em uma caixa de datas" | ✅ |
| "trave o dia como dia primeiro de qualquer mês" | ✅ (mas por descarte no handler, não na UI) |
| "**não precisar selecionar o dia**" | ❌ |
| "**eu seleciono somente o mês e ano**" | ❌ |

A semântica está certa; a interação, não. O que foi pedido é literalmente `type="month"`.

**Comportamento esperado** — quando `urbi-input-data` oferecer granularidade de mês, passar a usá-la
nesta tela; o formato persistido (`"mmm/AAAA"`) e o marco zero do fluxo **não mudam**.

**Pedido à plataforma** — texto pronto para o autor levar ao monorepo. **Nada aqui autoriza commit
em `urbiverso/urbiverso`** (`CLAUDE.md` § O monorepo é só leitura):

> **`urbi-input-data`: granularidade de mês.**
> **O que falta:** uma prop declarada — sugestão `granularidade: 'dia' | 'mes'`, default `'dia'`
> (retrocompatível) — que troque o `type="date"` de `ui/src/urbi-input-data.ts:86` por
> `type="month"`, emitindo `urbi:input-data-change` com `valor` no formato `"YYYY-MM"`, e aceitando
> `valor` nesse mesmo formato.
> **Por que a app não contorna:** `type` não é prop do primitivo e o `<input>` mora no shadow DOM —
> inalcançável por CSS ou por atributo do lado do consumidor. As alternativas dentro da app são
> piores: (a) dois `urbi-select` (mês + ano) abandona a "caixa de datas" que o autor pediu
> explicitamente; (b) um `<input type="month">` cru viola o contrato "só primitivos `urbi-*`".
> **Quem precisa:** app `viabilidade`, campo "Data de início do projeto" (Avançado → Empreendimento →
> Cronograma), que ancora o mês 0 de todo o fluxo de caixa. O caso é geral — qualquer campo de
> competência mensal.
> **Nota de piso:** se a prop entrar numa versão nova do shell, `shell_min` do `manifesto.json` sobe
> junto — e subir piso **não** bumpa `versao` (decisão da #422).

**Critério de aceite** — em duas etapas, e **a etapa 1 pode fechar sozinha**:

*Etapa 1 (nesta app, agora):* documentar a limitação para o usuário. O campo ganha texto auxiliar
dizendo que o dia é ignorado e sempre tratado como o 1º do mês. Verificação: `grep` acha o texto no
markup de `tela-fluxo-cronograma.ts`, e `bash scripts/validar-frontend.sh` verde.

*Etapa 2 (depois que a plataforma entregar):* `frontend/tela-fluxo-cronograma.ts:155-167` passa a
declarar a prop nova; `mesAnoParaISO`/`isoParaMesAno` passam a converter de/para `"YYYY-MM"`; os
testes de ida-e-volta de `frontend/fluxo-shared.test.ts` são atualizados e continuam verdes; o texto
auxiliar da etapa 1 sai. Verificação: o `<input>` do seletor é `type="month"` na instância.

**Fora de escopo**
- Trocar o formato persistido `"mmm/AAAA"` — é contrato do motor (`parseMesAno`/`REGEX_MES_ANO`), e
  o autor foi explícito: *"as regras e dependências de outras variações e campos continuam
  dependentes desse campo inicial"*.
- Substituir `urbi-input-data` por markup próprio.

Sem-fechamento: #327 executora original do item 22, já fechada; entregou a semântica, não a interação
```

---

### 8-A.4 — item 24

**Título**

```
fix(tipologias): cabeçalhos das colunas estreitas voltam a ser legíveis
```

**Corpo**

```markdown
**Contexto** — item 24 da `lista bugs 20260807.xlsx`; issue original #334 da Rodada 7. A #334
entregou o que foi pedido para os **campos** e, na mesma mudança, empurrou as colunas para baixo da
largura dos **cabeçalhos**.

**Comportamento atual** — `frontend/tela-empreendimento-tipologias.ts:79-82`:
```css
col.c-area   { width: 16ch; }
col.c-dorm   { width: 7ch; }
col.c-vagas  { width: 7ch; }
col.c-un     { width: 8ch; }
```
A tabela é `table-layout: fixed` (`:56`) e o `th` tem `overflow: hidden` (`:63`), **sem** estratégia
de quebra — `white-space`, `overflow-wrap` e `hyphens` não são declarados. Os rótulos (`:192-195`)
são "Área privativa", "Dormitórios", "Vagas", "Unidades", "Área total"; **"Dormitórios" é palavra
única de 11 caracteres e não quebra**.

Com `th { font-size: var(--texto-rotulo, 0.75rem) }` e `padding: 8px 8px`:

| Coluna | Largura | menos padding | Cabeçalho | Cabe? |
|---|---|---|---|---|
| `c-dorm` | 7ch ≈ 49px | ≈ 33px | "Dormitórios" ≈ 66px | ❌ |
| `c-un` | 8ch ≈ 56px | ≈ 40px | "Unidades" ≈ 52px | ❌ |
| `c-vagas` | 7ch ≈ 49px | ≈ 33px | "Vagas" ≈ 33px | ⚠️ no limite |

Antes da #334 essas colunas eram 90px/90px/100px, em que "Dormitórios" cabia.

**Por que não atende** — o autor pediu *"reduzir a coluna de Área privativa para caber … 6 dígitos,
… Dormitórios e Vagas para … 2 dígitos e … Unidades para … 4 dígitos"*. Ele falou de **campos**, não
de cabeçalhos, e não pediu para perder o rótulo. O `overflow: hidden` do `th` corta em silêncio: não
há erro, não há teste vermelho, só um cabeçalho truncado.

**Comportamento esperado** — os cabeçalhos ficam integralmente legíveis **sem desfazer** a redução de
largura pedida (nada de voltar para 90px/100px). Escolha uma, e diga qual no PR:

- **(a)** rótulos curtos que caibam — "Dorm.", "Unid." — mantendo o texto integral em `title`;
- **(b)** deixar o `th` quebrar em duas linhas (`white-space: normal; overflow-wrap: anywhere;` e
  tirar o `overflow: hidden` do `th`, mantendo-o no `td`), aceitando cabeçalho de 2 linhas;
- **(c)** largura por coluna = `max(dígitos pedidos, cabeçalho)`, o que reabre parcialmente `c-dorm`
  e `c-un` e contraria em parte o pedido.

Preferência sugerida: **(b)**, que preserva o pedido do autor por inteiro e não inventa abreviação.

**Critério de aceite**
1. **Medir antes de mexer.** Abrir Avançado → Empreendimento → Tipologias na Pinguim e registrar no
   PR a largura renderizada de `c-dorm`/`c-un` e se o cabeçalho está cortado. Se **não** estiver, a
   issue fecha como "não reproduz" e a análise acima entra como comentário — o veredito foi
   calculado tipograficamente, sem navegador (não há um no ambiente Claude Code), e essa é a
   incerteza da issue.
2. Confirmado o corte: nenhum cabeçalho da tabela `.tip` fica truncado, em tema claro e escuro.
3. `grep -n "col.c-dorm" frontend/tela-empreendimento-tipologias.ts` continua mostrando largura em
   `ch` dimensionada pelos dígitos pedidos — a correção **não** é alargar de volta.
4. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo**
- Larguras de `c-nome` (150px), `c-tipo` (160px) e `c-acao` (90px) — o autor não as citou.
- O espaçamento entre colunas, que já é uniforme via `td { padding: 6px 8px }` (`:66-71`).

Sem-fechamento: #334 executora original do item 24, já fechada; entregou os dígitos e criou este
efeito colateral
Sem-fechamento: #332 criou a coluna "Área total" redimensionada pela #334
```

---

### 8-A.5 — item 31

**Título**

```
fix(receitas): remover o bloco "Definições" do modal de Fluxo de pagamento
```

**Corpo**

```markdown
**Contexto** — item 31 da `lista bugs 20260807.xlsx`; issue original #346 da Rodada 7. A #346 fez a
migração pedida (a parte difícil) e não fez a remoção pedida (a parte fácil).

**Comportamento atual** — `frontend/tela-fluxo-receitas.ts:727-738`, dentro do modal "Fluxo de
pagamento" de cada Grupo de Receitas:
```html
<div class="pag-secao">
  <h4>Definições</h4>
  <p class="sec">Corretagem: configurada na linha de custo obrigatória "Corretagem de vendas" (Custos → Diretos).</p>
  <p class="sec">RET: controle global do estudo, em Custos → Financeiro.</p>
</div>
```
Dois parágrafos estáticos, sem controle nenhum, ocupando a primeira coluna do `.pag-grid`.

O destino **está correto e não precisa de nada**: o RET global vive em
`frontend/tela-fluxo-custos.ts:487-511` (grupo Financeiro da tela de Custos = "Custos → Custos
Financeiros"), persistido em `estudos.considerar_ret`/`ret_pct` via `/avancado/parametros`
(`:955-975`; backend `backend/rotas/avancado.ts:447-448,482-491`), migração `027_ret_global.js`.

**Por que não atende** — a primeira frase do pedido é *"**Pode retirar essa informação dessa tela**
de fluxo que existe para cada grupo em Viabilidade → Receitas"*. O autor não pediu uma placa
apontando para o novo lugar; pediu que a informação saísse. O bloco continua lá, agora sem função.

**Comportamento esperado** — remover integralmente o `<div class="pag-secao">` (`:728-737`) **e o
`<div>` que o envolve** (`:727` / `:738`), que de outro modo fica como coluna vazia do `.pag-grid`.
A primeira coluna do modal passa a começar em "Condições de entrada". Nenhuma mudança de dado, de
rota ou de motor.

**Critério de aceite**
1. `grep -n "Definições" frontend/tela-fluxo-receitas.ts` **não retorna nada**.
2. `.pag-secao` **continua** definida (`:153-157`) — a classe é compartilhada com os outros 3 blocos
   do modal (`:740`, `:764`, `:807`). Não remova a regra CSS junto com o bloco.
3. O modal continua abrindo e salvando: `frontend/fluxo-pagamento-editor.test.ts` verde, sem
   alteração.
4. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo — e leia antes de "consertar"**
O autor também escreveu que o controle "destacada ou embutida" da corretagem deveria **ir** para
Custos. A #346 o **apagou** em vez de mover, e isso está **certo**: desde a #228, `comissao.tipo`
não tem efeito nenhum no motor — `grep -n "comissao" frontend/fluxo-caixa-motor.ts
frontend/fluxo-shared.ts` não retorna nada, e `frontend/fluxo-caixa-motor.test.ts:381-403` prova a
equivalência (*"marcar comissão 'Destacada' não muda mais o Resultado"*). Mover controle inerte para
a aba Financeiro violaria a #279. **Não ressuscite o controle nesta issue.** A divergência entre o
modelo mental do autor e o do código está registrada como pergunta em
`docs/rodada-8/01-verificacao-47-itens.md` §5 (Q2) e é decisão dele, não desta issue.

Sem-fechamento: #346 executora original do item 31, já fechada; fez a migração, não fez a remoção
Sem-fechamento: #228 decidiu que comissão "destacada" não deduz do recebível — contexto do fora de
escopo
Sem-fechamento: #279 "nenhum campo da aba Financeiro permanece inerte" — contexto do fora de escopo
```

---

### 8-A.6 — colateral da auditoria do item 46

**Título**

```
fix(cenarios): Exposição máxima com a mesma leitura no KPI e na tabela de cenários
```

**Corpo**

```markdown
**Contexto** — achado na auditoria do item 46 da `lista bugs 20260807.xlsx` (Rodada 8, agente A1).
A #353 inverteu a leitura da Exposição máxima para magnitude, **mas só no card de KPI**. A tabela de
cenários salvos, na mesma tela, ficou na convenção anterior. Não reprova a #353 — o item 46 falava
só do KPI — mas o resultado é uma tela que se contradiz.

**Comportamento atual**

| Onde | Valor exibido | Variação |
|---|---|---|
| KPI (`frontend/fluxo-tabela.ts:278-279`) | `fmtR$(Math.abs(exposicaoMaxima))` — módulo | `varKpi(expMag, expBaseMag, false)`, magnitude |
| Tabela, célula (`frontend/tela-cenarios.ts:559`, `:525`) | `fmtR$(calc.exposicaoMaxima)` — **com sinal** | — |
| Tabela, badge (`frontend/tela-cenarios.ts:560,539`) | — | `calcularVariacao(novo, base, true)` — **assinado** |
| Resumo (`frontend/tela-resumo.ts:180`) | `fmtR$(Math.abs(...))` — módulo | sem variação |
| Marcos da tela de Cenários (`frontend/tela-cenarios.ts:284`) | `fmtR$(c.exposicaoMaxima)` — **com sinal** | — |

O comentário de `frontend/tela-cenarios.ts:534-537` ainda afirma *"todos os indicadores da tabela são
'maior é melhor' — inclusive a exposição máxima, que sendo negativa melhora ao subir"*, que é
exatamente a premissa que a #353 aposentou.

**Por que não atende** — numa piora de exposição de −1,0M para −1,2M, a mesma tela mostra
**`+20,0%` no KPI e `−20,0%` no badge da tabela**, para o mesmo cenário e a mesma grandeza; e o valor
aparece como `1.200.000,00` no KPI e `-1.200.000,00` na tabela. A cor coincide por acidente
aritmético (as duas convenções concordam no veredito melhor/pior; discordam no sinal e no valor
exibido), o que torna a contradição mais difícil de notar e não menos errada.

**Comportamento esperado** — uma única convenção para Exposição máxima em toda a app, a que o autor
escolheu no item 46: **exibir a magnitude** (`Math.abs`) e **comparar por magnitude**
(`maiorMelhor = false`). Aplicar em:
1. `frontend/tela-cenarios.ts:525,559` — célula passa a `fmtR$(Math.abs(...))`;
2. `frontend/tela-cenarios.ts:560` — badge passa a comparar `Math.abs(calc.exposicaoMaxima)` contra
   `Math.abs(base.exposicaoMaxima)` com `maiorMelhor = false`. `_badgeVar` (`:538-542`) ganha o
   parâmetro em vez de fixar `true`, e os demais chamadores (VPL, TIR) continuam passando `true`;
3. `frontend/tela-cenarios.ts:284` — marcos passam a `Math.abs(...)`;
4. `frontend/tela-cenarios.ts:534-537` — corrigir o comentário, que hoje **mente** sobre a regra
   vigente.

**Critério de aceite**
1. Teste novo em `frontend/cenario-variacao.test.ts`: com base `-1_000_000` e novo `-1_200_000`, a
   leitura por magnitude devolve `pct ≈ +20` e `melhor === false`; e a leitura da tabela produz o
   **mesmo sinal e o mesmo veredito** do KPI para o mesmo par.
2. `grep -n "exposicaoMaxima" frontend/tela-cenarios.ts` — nenhuma ocorrência sem `Math.abs`.
3. `grep -rn "fmtR\$(c.exposicaoMaxima)\|fmtR\$(calc.exposicaoMaxima)\|fmtR\$(base.exposicaoMaxima)"
   frontend/` **não retorna nada**.
4. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo**
- `frontend/exportar.ts` — a exportação tem o próprio contrato de sinal e a própria dívida de
  formatação (#281). Se divergir, abrir issue separada.
- Mudar o **sinal armazenado** de `exposicaoMaxima` em `FluxoCalc`. Ele é `min(fluxoAcumulado)` e
  deve continuar negativo no motor; a mudança é só de apresentação e de comparação.

Sem-fechamento: #353 inverteu a leitura no KPI (item 46) e deixou a tabela na convenção antiga
Sem-fechamento: #132 origem dos badges de variação da tabela de cenários
```

---

## 5. Perguntas ao autor

Cinco. As três primeiras mudam decisões de implementação; as duas últimas são de processo.

**Q1 — A obra deve mesmo começar junto com o Pré-lançamento, antes do Lançamento?**
`backend/rotas/avancado.ts:77-91` ancora `pre_lancamento.inicio_mes` e `obra.inicio_mes` **no mesmo
mês** (fim do Planejamento), e o `lancamento` só depois do fim do pré-lançamento. Ou seja: a obra
começa **antes** do lançamento comercial. É decisão explícita da #224 e o campo está travado
(item 20, corretamente). Mas em incorporação a obra costuma começar **depois** do lançamento, quando
a velocidade de vendas confirma a viabilidade — e é isso que sustenta o gatilho de exposição mínima
do financiamento à produção (`docs/viabilidade/funding-capital-stack.md` §4.3). **Está certo, e é
para ficar travado assim?** Se não, é mudança de motor e de tela, não de rótulo.

**Q2 — A corretagem "destacada × embutida" ainda deve interferir no cálculo?**
No item 31 você escreveu *"Definições **que interfere** se corretagem é destacada ou embutida"*. No
código, desde a **#228**, `comissao.tipo` **não interfere em nada**: nenhum dos dois motores o lê
(`grep -n "comissao" frontend/fluxo-caixa-motor.ts frontend/fluxo-shared.ts` → vazio) e
`frontend/fluxo-caixa-motor.test.ts:381-403` afirma a equivalência como comportamento desejado (a
razão foi acabar com a dupla dedução: uma vez na receita, outra como linha de custo). O campo
continua sendo **persistido** por `frontend/fluxo-pagamento-editor.ts:32-36` (`tipo: … ?? 'embutida'`)
e nunca lido — é dado morto no banco. Três saídas: **(a)** confirmar que a #228 está certa e apagar
o campo persistido; **(b)** ressuscitar o efeito com uma regra explícita de qual das duas deduções
vale; **(c)** deixar como está. Fui de **(c)** por ora, e a 8-A.5 diz para não mexer.

**Q3 — Dois RETs convivem no Avançado. Um deles não faz nada. Remover qual?**
- `estudos.considerar_ret`/`ret_pct` — o **global**, criado pela #346, editável em Custos →
  Financeiro (`frontend/tela-fluxo-custos.ts:487-511`) e lido pelo motor do Avançado
  (`FluxoConfig.ret`).
- `estudos.sujeito_ret` — o **do Preliminar**, editável em Premissas (`tela-premissas.ts:563`) **e
  também** em Viabilidade → Financeiro (`tela-financeiro.ts:171-178`), lido só por
  `frontend/proforma.ts:245`.

Num estudo **Avançado**, marcar "Sujeito a RET" em Viabilidade → Financeiro **não muda nada no
fluxo** — é exatamente o tipo de controle inerte que a #279 se propôs a eliminar. Vale abrir issue
para ocultar `sujeito_ret` quando `nivel_analise === 'avancado'`?

**Q4 — Item 24: prefere abreviar o cabeçalho ou deixá-lo quebrar em duas linhas?**
Ver 8-A.4, opções (a)/(b)/(c). Minha sugestão é **(b)** — preserva integralmente a redução de largura
que você pediu e não inventa abreviação. Mas é escolha visual e é sua.

**Q5 — As 6 issues do bloco 8-A devem ser criadas no GitHub agora?**
O `gh` CLI **não existe** neste ambiente (`CLAUDE.md` § Merge) e as ferramentas MCP do GitHub não
estão disponíveis nesta sessão. Os corpos acima estão prontos para colar. O §1 do dossiê registra que
a criação está pendente de `gh auth login` — confirmar se é para eu tentar por MCP quando a sessão
principal reabrir, ou se você cria à mão.

---

## 6. O que este documento deliberadamente NÃO fez

- **Não revarreu os 39 itens** marcados `§4.1` na tabela. O veredito deles é herdado do dossiê e
  está rotulado como tal. Com 3 reprovações em 8 amostrados (**37,5%**), a estimativa razoável é que
  os 39 não auditados guardem entre 10 e 15 defeitos da mesma família. **"44 implementado" não é um
  número em que se deva confiar sem auditar o resto.** A amostra foi enviesada de propósito (os que
  o mapeamento marcou como "exigem inspeção visual/runtime"), então a taxa real dos 39 restantes
  deve ser menor — mas não zero.
- **Não alterou uma linha de código.** Esta rodada especifica; implementar é a rodada seguinte,
  issue por issue (§6 do dossiê).
- **Não escreveu nada em `C:\Users\raafa\urbiverso`.** As três leituras feitas lá — `urbi-kpi.ts`,
  `urbi-primitivo-conteudo.ts`, `urbi-input-data.ts`, `urbi-banner.ts`, `urbi-icone.ts` — são o uso
  legítimo. ⚠️ Elas estão na **`main` do monorepo**, que está **à frente do SDK publicado**: um PR
  que dependa de prop vista ali precisa declarar que a fonte foi o `main`, não o bundle instalado.
- **Não rodou `validar-backend.sh`.** O `@urbiverso/sdk` desta máquina é stub e o script aborta no
  portão do SDK (etapa 1/5). Nada aqui depende dele — não houve mudança de backend, schema ou
  migração.

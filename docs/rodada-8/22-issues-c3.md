# Rodada 8 — issues do bloco C3 (funding, capital e estado financeiro)

> Fatia: dívida, equity, financiamento à produção, capital de giro, indicadores do investidor e o
> estado financeiro do estudo. Fontes: `03-regras-funding.md` §2 (`R-A31`…`R-A311`) e §7
> (`R-A312`…`R-A322`); `04-regras-reconciliacao.md` §6.3 (`E9`, `E10`).
>
> **Decisões do autor já incorporadas** (não rediscutir): capital de giro é **só o rótulo** — o
> desenho `linha_credito` rotativo foi **recusado**, sem migração `030` e sem bump para `0.1.29`;
> a **base de receita líquida do equity NÃO muda** (`funding-motor.ts:58-67` fica como está);
> **nenhum bug é consertado nesta rodada** — a árvore está idêntica à `main`.
>
> Ordenadas por consequência em R$, não por ordem de descoberta.

<<<ISSUE>>>
title: fix(funding): criar `estadoFinanceiroDoEstudo` como fonte única dos Passos 23–25
priority: 1
sources: R-A313 · R-A36 · R-A38 · R-A312 · 03 §7 · A5 (4 margens) · A4 (`formulas.md:61-86`)
---
## Contexto
Os Passos 23–25 do `inteligencia-evi-incorporacao.md:1584-1592` descrevem **uma** sequência,
executada **uma** vez: processar os instrumentos de funding → formar o fluxo final → atualizar
acumulados e indicadores. No app essa sequência não existe como código. Ela é **remontada, à mão,
por cinco consumidores independentes**, cada um com a sua montagem.

Esta é a issue de maior alcance do bloco 8-B: ela é a **causa comum** de dois sintomas que agentes
diferentes catalogaram separadamente — as **4 margens divergentes** do estudo 5 (lente A5) e o
**cash sweep cego às outras operações** (lente A3, `R-A38`). Convergência de duas lentes
independentes sobre a mesma ausência estrutural.

## Comportamento atual
Cinco arquivos montam a mesma cadeia, sem que nada os obrigue a coincidir:

| Consumidor | monta `calc` | monta `receitaLiquida` | monta `resultadoFinal` | chama `fundingDoEstudo` | chama `proformaAvancado` |
|---|---|---|---|---|---|
| `frontend/tela-fluxo-ver.ts` | sim | `:154` | `:155` | `:159` | — |
| `frontend/tela-funding.ts` | sim | `:193` | `:206` | `:207` | — |
| `frontend/tela-cenarios.ts` | sim | `:228` | `:229` | `:230` | — |
| `frontend/tela-dashboard.ts` | sim | `:262` | `:263` | `:264` | `:273` |
| `frontend/tela-proforma.ts` | sim | — | — | — | sim |

Nenhum é a fonte; **todos são cópias**. Consequências diretas, verificadas linha a linha:

- `resultadoFinal` é `calc.fluxoAcumulado[último]` reescrito em **três** lugares
  (`tela-fluxo-ver.ts:155`, `tela-funding.ts:206`, `tela-cenarios.ts:229`) — é o `R-A36`;
- dentro de `fundingDoEstudo`, `simularFinanciamentoProducao` recebe o fluxo **desalavancado**
  (`frontend/funding-motor.ts:731`) e o usa em `:356` (`caixaAntesFunding`) como teto do cash sweep
  (`:374-377`), porque **não existe um passo anterior** que já tenha somado `divida` e `equity` — é
  o `R-A38`, um nível abaixo, a mesma ausência de sequência;
- o defeito do `frontend/proforma-avancado.ts:92-93` (somar `funding.linhasSaida` ao grupo
  `financeiro` sem nunca creditar as entradas) **só conseguiu existir** porque um dos cinco
  consumidores tinha uma regra própria que nenhum outro tinha.

## Consequência
No estudo 5 de Pinguim convivem, na mesma sessão, **4 margens líquidas e 3 resultados** em
superfícies diferentes — a proforma exibindo −47,87% onde o valor real é 18,94%. E o financiamento
à produção amortiza como se um aporte de equity de R$ 5 MM ou um capital de giro de R$ 10 MM nunca
tivessem entrado no caixa; simetricamente, as parcelas de uma `divida` não consomem caixa aos olhos
do sweep.

Enquanto a montagem for por consumidor, **todo conserto é local e volta a divergir**. É o que
torna esta issue precondição das outras: consertar a proforma corrige dois dos cinco pontos; nada
impede o terceiro de divergir amanhã.

## Comportamento esperado
Uma função exportada — `estadoFinanceiroDoEstudo(config, operacoes)` — executa os Passos 23–25 na
ordem, **uma vez**, e devolve
`{ calc, receitaLiquidaBase, resultadoFinal, funding, proforma, indicadores }`.
Os cinco consumidores **leem** esse objeto; nenhum recalcula. O `R-A36` deixa de existir por
construção, e o `R-A38` passa a ser a ordem interna dessa função (issue separada).

## Como corrigir
1. Criar `estadoFinanceiroDoEstudo` (arquivo novo ou em `frontend/funding-motor.ts`), com a
   sequência dos Passos 23–25 escrita em comentário ao lado da assinatura, citando
   `inteligencia-evi-incorporacao.md:1584-1592`.
2. Migrar os cinco consumidores da tabela acima para lê-la. Nenhum deles chama mais
   `fundingDoEstudo`/`proformaAvancado` diretamente.
3. Documentar, junto da assinatura, **qual** é a definição de `resultadoFinal` que o app usa —
   `calc.fluxoAcumulado[último]`, o fluxo de caixa livre acumulado ao fim do horizonte — e registrar
   que ela **não** é a da planilha (`!equity!C19 = C18 − divida!C5`, total econômico sem tempo,
   transcrito em `docs/viabilidade/fluxo-investidor-formulas.md`). As duas coincidem quando o
   horizonte alcança o último evento financeiro e divergem quando não alcança. Qual das duas vale é
   pergunta ao autor, mas **a do código tem que estar escrita**.
4. Guard de grep no `pr-guards.yml`: `fundingDoEstudo(` e `proformaAvancado(` só podem aparecer
   dentro dessa função (e nos testes).

## Critério de aceite
- [ ] Um teste roda `estadoFinanceiroDoEstudo` uma vez e afirma que `proforma.resultado`, o rodapé
      da tabela de fluxo e o card do painel saem **do mesmo campo**. Hoje esse teste é impossível de
      escrever, porque não há um lugar onde os três se encontrem — é o critério que prova a entrega.
- [ ] `grep -n "fundingDoEstudo(" frontend/tela-*.ts` volta vazio.
- [ ] Os 4 KPIs (Resultado, Margem, ROI, TIR) dos estudos 5 e 6 ficam **idênticos ao centavo**
      antes e depois. Refatoração que move qualquer um dos quatro é bug, não refatoração (`R-A320`).
- [ ] `versao` do `manifesto.json` **não** bumpa — não há migração.

## Fora de escopo
- Consertar o cash sweep para enxergar as outras operações — é issue própria (`R-A38`), e tem que
  vir **depois** desta, de propósito: fazer as duas juntas mistura *"onde o número é calculado"*
  com *"quanto o número vale"* e a atribuição da variação some (`R-A320`).
- Consertar `proforma-avancado.ts:92-93` — issue própria, e vem **antes** desta.
- Mudar a base de receita líquida do equity — decisão do autor, fechada.
<<<END>>>

<<<ISSUE>>>
title: fix(funding): cash sweep do financiamento à produção tem que enxergar o caixa das outras operações
priority: 1
sources: R-A38 · R-A313 · R-A320 · 03 §2
---
## Contexto
Os Passos 23–24 do `inteligencia-evi-incorporacao.md:1584-1592` mandam *"processar o capital de giro
e outros instrumentos"* e depois formar o *"fluxo final = fluxo de caixa livre **+ fluxos líquidos
dos instrumentos de funding**"* — no plural e **numa ordem**. `funding-capital-stack.md:158` diz o
mesmo: liberações de funding entram no caixa financeiro.

⚠️ **Isto não é o waterfall que a #355 apagou.** Não há prioridade, não há competição por caixa, não
há fila. É só a **ordem de leitura do caixa**, que os Passos 23–24 já descrevem. A distinção importa
porque a #355 apagou o waterfall de propósito, e um conserto mal enunciado o ressuscitaria.

## Comportamento atual
`frontend/funding-motor.ts:725-736` simula **todas** as operações contra o mesmo `fluxoLivreMensal`
— o **desalavancado**. `simularFinanciamentoProducao` recebe esse array em `:732` e o usa em `:356`:

```
const caixaAntesFunding = round2(caixaFechamentoAnt + n(fluxoLivreMensal[t]));
```

`caixaAntesFunding` é o teto do cash sweep em `:374-377`
(`Math.min(dividaAmortizavel, Math.max(0, caixaAntesFunding))`).

## Consequência
Um aporte de equity de R$ 5 MM no mês 1 e um capital de giro de R$ 10 MM **não existem** para o
financiamento à produção: ele amortiza como se aquele dinheiro nunca tivesse entrado no caixa, e
deixa de amortizar caixa que de fato existe. Simetricamente, as parcelas de uma `divida` não
consomem caixa aos olhos do sweep — o financiamento amortiza contra um caixa que já foi gasto.

É o achado de maior impacto **numérico** do documento de funding: muda o saldo devedor, os juros
pagos, a TIR do investidor e o fluxo alavancado de **qualquer** estudo que tenha
`financiamento_producao` junto com `divida` ou `equity`.

## Comportamento esperado
`fundingDoEstudo` simula em **duas passadas**:

1. **cegas ao caixa** — `divida` e `equity`. Produzem `entradasCegas` / `saidasCegas`. A ordem
   **dentro** desta passada é irrelevante: elas não interagem.
2. **dirigidas por caixa** — `financiamento_producao`, contra
   `fluxoLivreMensal + entradasCegas − saidasCegas`.

Se um dia houver mais de uma operação dirigida por caixa, elas são processadas na ordem de `ordem` e
cada uma vê o caixa já alterado pela anterior — **e isso precisa estar escrito no código**, porque
passa a ser a única dependência de ordem do modelo. Hoje `financiamento_producao` é única por estudo
(`docs/viabilidade/fluxo-investidor-formulas.md:26`), então o caso não ocorre ainda.

## Como corrigir
1. Dentro de `estadoFinanceiroDoEstudo` (issue `R-A313`, precondição), separar o `operacoes.map` de
   `funding-motor.ts:725-737` em duas passadas.
2. `simularFinanciamentoProducao` passa a receber o fluxo **já somado das cegas**, não
   `fluxoLivreMensal` cru.
3. Comentário na função declarando a ordem e o motivo, com a citação dos Passos 23–24 e a frase
   *"não é waterfall: não há prioridade nem competição"*.

## Critério de aceite
- [ ] Teste novo: `financiamento_producao` + `equity` com aporte grande num mês de caixa apertado →
      a amortização daquele mês **aumenta** em relação ao comportamento atual.
- [ ] Teste simétrico: `financiamento_producao` + `divida` com parcela pesada → a amortização do mês
      **diminui**.
- [ ] O golden `frontend/fixtures/financiamento-producao-golden.test.ts` (80 períodos, cenário sem
      outras operações) **continua passando byte a byte** — é o que prova que a mudança só toca o
      caso multi-operação.
- [ ] O PR traz a tabela `antes → depois` dos 4 KPIs dos estudos 5 e 6 de Pinguim (`R-A320`).

## Fora de escopo
- Prioridade, fila, reserva mínima ou qualquer forma de competição por caixa — apagados pela #355 e
  **não voltam**.
- `LACUNA_FUNDING` como diagnóstico (`R-A311`) — recusado junto com a linha rotativa.
- A refatoração do estado financeiro em si — é a issue `R-A313`, e vem antes.
<<<END>>>

<<<ISSUE>>>
title: fix(funding): o conserto do modal de pagamento tem que provar que o retorno do investidor não muda
priority: 1
sources: R-A322 · A5 (`jurosClientes` zerado) · A6 (modal reescreve 0/30/70 → 15/30/55) · 03 §7
---
## Contexto
Esta é uma issue de **funding** que nasce de um defeito catalogado como sendo **de receitas**. Ela
não duplica a issue do modal de pagamento — ela adiciona **uma asserção** ao conserto que aquela
issue já vai fazer. Se a issue do modal ainda estiver aberta quando esta for triada, o caminho
barato é **absorvê-la lá**; se o conserto já tiver mergeado, esta vira trabalho novo.

## Comportamento atual
A cadeia, ponta a ponta, com evidência em cada elo:

1. os juros de tabela **integram a receita bruta recebida** —
   `inteligencia-evi-incorporacao.md` §6: *"Receita Bruta (VGV) — soma de todos os recebimentos de
   clientes, **inclusive juros**"* — e o motor os agrega em `frontend/fluxo-caixa-motor.ts:2014-2050`;
2. a base do equity em `permuta_financeira` é `receitaMensal − corretagem`
   (`frontend/funding-motor.ts:58-67`) — portanto **inclui os juros**;
3. abrir o modal e clicar em "Aplicar" **zera** `taxaMensal`
   (`frontend/fluxo-pagamento-editor.ts:90` → `componentesDoLegado`), destruindo
   R$ 1.259.273,59 de juros no estudo 5; e o mesmo modal **reescreve o plano**, trocando
   `0/30/70` por `15/30/55`.

## Consequência
A base do equity encolhe junto. Com os números medidos no estudo 5 e um investidor a 4%, abrir o
modal evapora **≈ R$ 50.371** de retorno do investidor. E a reescrita `0/30/70 → 15/30/55` muda
também **o mês** em que o retorno é pago, porque antecipa receita para o lançamento.

**O contrato do investidor muda porque alguém abriu uma tela** — sem aviso e sem undo.

O risco específico desta issue: o conserto do modal pode ser declarado bom **preservando a receita**
e ainda assim mover o retorno do investidor por outro caminho, porque ninguém olhou o funding.

## Comportamento esperado
O teste de regressão do conserto do modal afirma, além da receita: abrir e aplicar o modal **sem
alterar campo nenhum** mantém `Σ saidas` de **toda** operação de equity inalterada, ao centavo.

## Como corrigir
1. No teste de ida e volta do conserto — `fluxoPagamentoParaSalvar(formularioPagamento(fp))`
   idempotente —, acrescentar: rodar `simularEquity` sobre a base **antes** e **depois** e exigir
   igualdade ao centavo em `saidas` e em `entradas`.
2. Cobrir os dois modos de retorno: `permuta_financeira` (sensível à curva mês a mês) e
   `resultado_final` (sensível ao acumulado e ao `mesRepasse`).

## Critério de aceite
- [ ] O teste falha na `main` de hoje (com o modal ainda reescrevendo o plano) e passa depois do
      conserto — se passar nos dois, ele não está exercendo o caminho certo.
- [ ] A asserção cobre os dois modos de `modo_retorno`.

## Fora de escopo
- Consertar o modal — é a outra issue.
- Abrir o campo de taxa de juros no modal — issue própria, da lente A2, e move o mesmo denominador
  (`R-A320`): não pode entrar no mesmo PR.
<<<END>>>

<<<ISSUE>>>
title: fix(funding): definir o retorno de equity quando a receita líquida do mês é negativa
priority: 1
sources: R-A314 · R-A32 · divergência A3 × B1 · A2 (duas noções de "líquida") · A5 (sem equity em Pinguim)
---
## Contexto
⚠️ **Esta issue registra uma divergência entre duas lentes que NÃO deve ser resolvida por quem a
implementa.** A decisão é do autor, entre três opções. O que os dois agentes convergiram é que a
issue **não** é *"adicionar `max(0,…)`"* — é *"definir o que é retorno de equity quando a receita
líquida do mês é negativa"*.

**Os dois lados, com a evidência de cada um:**

**A3 — caiu na transcrição da #355.** O `capital-stack-motor.ts` apagado pela #355 (commit `927bf5a`)
tinha o clamp embarcado, **duas vezes**, no caminho exato:
`git show 927bf5a^:frontend/capital-stack-motor.ts` → `:740` e `:784`,
`const receitaLiq = Math.max(0, n(cen.receitaLiquidaMensal?.[t]));`, ambas no **modo C**. E
`migracoes/029_funding_operacoes.js:66-68` diz: *"Só o modo **C** (% da receita líquida) mapeia
**1:1** na permuta financeira"* — o `permuta_financeira` de hoje é o sucessor **declarado** daquele
modo. Fecha o argumento a lista do que a #355 declara ter apagado
(`docs/viabilidade/fluxo-investidor-formulas.md:35-38`: waterfall de 8 passos · `prioridade_funding`
/ `prioridade_pagamento` · liberação automática por lacuna · `reservaMinima` · os 4 modos de
Preferred Equity · políticas `cash_sweep`/`bullet`): **o clamp não está na lista**, e as outras seis
remoções deliberadas estão.

**B1 — é fidelidade à spec vigente.** `docs/viabilidade/fluxo-investidor-formulas.md:135` transcreve
`D — Retorno equity | SE(C24; C * C25; SE(t = C8; C19 * C25; 0))` — **sem `MAX`**. A planilha do
autor usa `MAX(0;…)` na aba `divida` e **não** na `equity`, o que torna a ausência difícil de ler
como esquecimento. E `funding-capital-stack.md:576` é **ADR histórico** (só a §4.3 é vigente, e o
equity não está nela), portanto não serve de norma.

**O que A3 concedeu ao B1, sem ressalva:** citar o ADR como norma foi erro de hierarquia de fontes, e
o código de hoje **reproduz a spec vigente**. **O que B1 concedeu ao A3:** a planilha é silenciosa
porque o estado é **estruturalmente impossível** nela — `!equity!C28 = B28*(1 − C15 − C16 − C17)` é
uma **dedução multiplicativa** sobre uma decomposição do VGV em frações não negativas, ou seja
`não-negativo × 0,86`. No app a dedução é uma **série subtraída com cronograma próprio**: a
corretagem é paga integralmente no mês da venda (`frontend/fluxo-shared.ts:491-497`, #121) enquanto o
recebimento é espalhado pelo plano. **Silêncio não é permissão** — é um estado que o modelo da
planilha não sabe representar.

## Comportamento atual
`frontend/funding-motor.ts:441` — `saidas[t] = round2(n(receitaLiquidaMensal[t]) * pct);`. Sem
clamp. Medido, com VGV 100 MM vendido no mês 0, sinal 5%, RET 4%, corretagem 5%, equity 10% em
`permuta_financeira`:

```
receita líquida base : −200.000    2.000.000    2.000.000
retorno ao investidor:  −20.000      200.000      200.000
```

O `saidas` negativo entra na costura (`funding-motor.ts:756-758`, categoria de custo com sinal
invertido) e no fluxo alavancado.

## Consequência
**O investidor paga R$ 20 mil ao projeto a título de "retorno"** no mês do lançamento. Um mês de
venda com sinal menor que a corretagem é a forma **normal** de um lançamento, não um caso de borda.
Não há contrato de investidor que preveja isso, e o número atravessa a Reconciliação sem uma palavra
(`R-A315`).

## Comportamento esperado
**Decisão do autor entre três respostas:**

| Resposta | Consequência | Precedente no app |
|---|---|---|
| **(a) clampar em 0** — o mês não gera retorno, sem compensação futura | equity nunca paga ao projeto; o retorno total cai | **existe**: `frontend/fluxo-caixa-motor.ts:1554-1555,1570` — *"A base líquida nunca fica negativa (clamp em 0): imposto e corretagem que excedam a receita do mês não geram permuta negativa"*, mesma base, mesmo par de deduções, mesmo descasamento de calendário |
| **(b) clampar em 0 com carry-forward** — o negativo abate o retorno dos meses seguintes | preserva o total, muda o *timing* | **nenhum** — mecanismo novo, e a planilha não tem |
| **(c) manter como está** | fiel à letra da spec; o investidor aporta capital extra sem contrato que o preveja | a spec, por silêncio |

A recomendação do A3 é **(a)**, pelo precedente interno do `:1570` e por ser a única que não inventa
mecanismo. O B1 está certo que o código de hoje **não é ilegal em face da spec**. Nenhum dos dois
deve decidir sozinho.

## Como corrigir
⚠️ **Consequência de forma, e ela é vinculante:** se a resposta for **(a)** ou **(b)**, o conserto é
**spec + motor na mesma issue**, com `docs/viabilidade/fluxo-investidor-formulas.md:135` corrigido
**antes** do código. Senão a próxima auditoria reabre isto como divergência código × spec, e o
argumento do B1 volta inteiro, agora com razão.

- **(a):** corrigir `:135` para `MAX(0; C) * C25`, com nota dizendo **por que** o app diverge da
  letra da planilha (o descasamento de calendário que a planilha não representa); depois
  `funding-motor.ts:441` → `round2(Math.max(0, n(receitaLiquidaMensal[t])) * pct)`.
- **(b):** a spec ganha a descrição do carry-forward **antes** de existir código.
- **(c):** comentário em `funding-motor.ts:441` dizendo que o negativo é aceito **por decisão**, com
  a data — senão a próxima sessão o "conserta" achando que é bug — e um teste que **fixa** o
  comportamento.

**Independente da resposta**, o diagnóstico `RETORNO_EQUITY_NEGATIVO` da issue `R-A315` entra: mesmo
em (c), o app **deve dizer em tela** que aquele mês teve retorno negativo.

## Critério de aceite
- [ ] O autor registrou a escolha (a)/(b)/(c) no corpo da issue, com data.
- [ ] Se (a) ou (b): o diff toca `fluxo-investidor-formulas.md` **e** `funding-motor.ts`, nessa ordem.
- [ ] Teste: `simularEquity(op, [0,−50000,100000], …).saidas` bate com a opção escolhida.
- [ ] O golden existente de equity (`funding-motor.test.ts:155`) **não muda** — a curva dele nunca é
      negativa.

## Fora de escopo
- A **composição** da base de receita líquida — decisão do autor, fechada
  (`funding-motor.ts:58-67` fica como está). Esta issue pergunta *"a base pode ser negativa?"*, não
  *"que deduções compõem a base?"*.
- O teto de `Σ pct_retorno` — issue própria.

> **Risco de regressão em produção: zero hoje.** Não há nenhuma operação de equity cadastrada em
> Pinguim (lente A5), o que faz desta a decisão mais barata de tomar **antes** que alguém cadastre a
> primeira.
<<<END>>>

<<<ISSUE>>>
title: fix(funding): barrar soma de `pct_retorno` acima de 100% da receita líquida
priority: 1
sources: R-A37 · R-A316 · decisão nº 2 do autor · 03 §2 e §7
---
## Contexto
`funding-capital-stack.md:578-579` — *"a soma das participações de receita **não pode superar
100%**"*. A planilha do autor não testa isso porque tem **uma** operação só.

**A decisão do autor sobre a base fortalece esta issue, não a enfraquece.** A frase *"equity é um
retorno líquido ao investidor, não importa esse fator para o cálculo"* resolve a **composição da
base** e, ao fazê-lo, transforma a base num **dado fixo do estudo**. Consequência direta:
`pct_retorno` passa a ser **a única variável** do lado do equity. Antes da decisão dava para
argumentar que uma soma alta era compensada por uma base mais larga; depois dela, não dá.

## Comportamento atual
`backend/rotas/funding.ts:65`:

```
const CAMPOS_PERCENTUAL_0_100 = ['exposicao_minima', 'percentual_financiavel'];
```

**`pct_retorno` não está na lista.** `CAMPOS_NAO_NEGATIVOS:59-64` o inclui, mas só barra negativo.
Três investidores a 40% cada são aceitos sem uma palavra, e o motor paga **120% da receita líquida**
como retorno, todo mês.

## Consequência
1. **Não é opinião, é impossibilidade contábil.** "Retorno líquido ao investidor" pressupõe que haja
   líquido. Distribuir 140% de uma grandeza é distribuir o que não existe — o instrumento deixa de
   ser equity e vira dívida disfarçada, sem saldo devedor, sem juros e sem quitação.
2. **Nada mais no app segura.** O waterfall que capava pelo caixa foi apagado pela #355; o D14
   (`frontend/fluxo-invariantes.ts:379`) olha o **acumulado** e não dispara num projeto rentável; a
   rota valida só `≥ 0` (`backend/rotas/funding.ts:59-64`). São **três redes ausentes**, não uma.
3. Um único investidor a 100% já distribui a receita inteira — o que é contratualmente possível e
   quase sempre erro de digitação.

## Comportamento esperado
- `pct_retorno` entra em `CAMPOS_PERCENTUAL_0_100`.
- `POST`/`PATCH` recusam com `422 RETORNO_EXCEDE_RECEITA` quando `Σ pct_retorno` das operações
  `equity` em modo `permuta_financeira` do estudo passar de 100.
- Operações em modo `resultado_final` entram numa **segunda** soma, também limitada a 100 — é % do
  **resultado**, não da receita, e as duas não competem pela mesma base.

## Como corrigir
1. `backend/rotas/funding.ts`: acrescentar `pct_retorno` a `CAMPOS_PERCENTUAL_0_100:65`.
2. Função pura `somaRetornoExcede(existentes, novo, ignorarId)`, no molde exato do
   `conflitoFinanciamentoUnico` (`backend/rotas/funding.ts:150-158`) — **incluindo o `ignorarId`**,
   sem o qual todo `PATCH` de uma operação existente se conta duas vezes e recusa a si mesmo.
3. Mensagem de erro dizendo qual é a soma atual e quanto sobra.

## Critério de aceite
- [ ] Teste puro de `somaRetornoExcede` em `backend/rotas/funding.test.ts`, no molde dos que já
      existem em `:22-30`, cobrindo: soma ok · soma estourada · `PATCH` da própria operação (não pode
      recusar) · as duas somas independentes por `modo_retorno`.
- [ ] `pct_retorno: 101` é recusado com `422`.
- [ ] `bash scripts/validar-backend.sh` — ou, se abortar no portão do SDK, o PR **declara** que a
      validação de backend é do autor no ambiente autenticado.

## Fora de escopo
- O alerta **mensal** (`RETORNO_EQUITY_EXCEDE_RECEITA`) — é a issue `R-A315`, e é complementar: a
  validação de rota pega só a soma **nominal**, não o mês em que a distribuição de fato excede.
- A base de receita líquida — fechada por decisão do autor.

> ⚠️ Um estudo já configurado acima de 100% passa a **recusar edições** até ser corrigido. É o
> comportamento desejado, mas a mensagem precisa dizer isso com todas as letras.
<<<END>>>

<<<ISSUE>>>
title: fix(reconciliacao): equity ganha invariantes próprias, hoje é pulado inteiro
priority: 2
sources: R-A315 · R-A316 · A5 (equity não conferível) · 03 §7
---
## Contexto
Equity é o **único** instrumento do app com **zero** invariantes. É por isso que as três divergências
de equity desta rodada nunca apareceram para ninguém: elas são invisíveis **por construção** na única
superfície do app que existe para tornar erro visível.

## Comportamento atual
`frontend/fluxo-invariantes.ts:347`:

```
if (s.saldo.every((v) => v === 0)) continue; // equity: sem dívida, nada a checar
```

Equity tem `saldo` zerado por construção (`frontend/funding-motor.ts:453`), então **toda operação de
equity é pulada**. O que sobra para ela:

| Checagem | Pega equity? |
|---|---|
| `DIVIDA_NEGATIVA` (`:349`) | ❌ pulada em `:347` |
| `DIVIDA_FINAL_NAO_ZERA` (`:356`) | ❌ pulada em `:347` |
| `FLUXO_FUNDING_NAO_RECONCILIA` (`:368`) | ⚠️ só a soma — um retorno **negativo** reconcilia perfeitamente |
| `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` (D14, `:379`) | ⚠️ olha o **acumulado**: um split de 140% num projeto de margem alta **nunca** derruba o acumulado, e o alerta nunca dispara |

O comentário do `:347` está **certo sobre a premissa** ("equity não tem dívida") e **errado sobre a
conclusão** ("nada a checar").

## Consequência
Nem o autor nem uma auditoria conseguem **ver** o defeito na instância. Foi exatamente o que
aconteceu: a lente A5, com acesso vivo a Pinguim, não conseguiu confirmar nenhuma das divergências
de equity — a Reconciliação atravessa um retorno negativo e um split de 120% sem uma palavra.

## Comportamento esperado
`validarFunding` ganha um ramo próprio de equity, **antes** do `continue` do `:347`:

- **(a) `RETORNO_EQUITY_NEGATIVO`** — `saidas[t] < −tol` em qualquer `t`. Severidade **erro**.
- **(b) `RETORNO_EQUITY_EXCEDE_RECEITA`** — `Σ saidas` das operações `permuta_financeira` no mês `t`
  maior que a receita líquida base do mês. Severidade **alerta**. É a leitura **mensal** do teto da
  issue `R-A37`, que a validação de rota (nominal) não alcança.
- **(c) `EQUITY_SEM_APORTE`** — operação com `pct_retorno > 0` e `valor = 0`: remunera sem ter
  aportado. É o simétrico exato do estado em que `migracoes/029_funding_operacoes.js:45-53` deixa um
  `preferred_equity` convertido, e hoje é aceito sem uma palavra.

## Como corrigir
Substituir o `continue` do `:347` por um desvio: se `s.operacao.tipo === 'equity'`, roda o ramo novo
e segue; senão, mantém as checagens de dívida como estão. O comentário do `:347` é reescrito para
dizer o que passou a ser verdade.

## Critério de aceite
- [ ] Três testes em `frontend/fluxo-invariantes.test.ts`, um por código novo.
- [ ] Um **teste negativo**: uma operação de equity saudável produz **zero** divergências — sem ele o
      ramo novo vira ruído na Reconciliação e alguém o desliga.
- [ ] Nenhum cálculo muda: os 4 KPIs dos estudos 5 e 6 ficam idênticos.

## Fora de escopo
- Decidir **o que fazer** com o retorno negativo — issue `R-A314`. Este diagnóstico entra
  **independente** daquela decisão: mesmo que o autor escolha manter o negativo, o app deve dizê-lo.
- A validação de rota do teto de 100% — issue `R-A37`.

> Esta é **precondição prática** das outras issues de equity: sem ela, nem o autor nem uma auditoria
> têm como *ver* o defeito na instância.
<<<END>>>

<<<ISSUE>>>
title: fix(funding): `saldoFinal` é o saldo no mês da quitação, não no fim do horizonte
priority: 2
sources: R-A33 · R-A36 (alerta de horizonte) · 03 §2
---
## Contexto
`!divida!C74` da planilha do autor é
`ÍNDICE($F$19:$F$66; CORRESP($C$9+SE($C$10;$C$11;1)−1+$C$13; $A$19:$A$66; 0))` — ela vai buscar o
saldo **no mês `fim` da operação**, deliberadamente, em vez de ler a última linha.

## Comportamento atual
`frontend/funding-motor.ts:509`:

```
saldoFinal: round2(s.saldo[s.saldo.length - 1] ?? 0),
```

Equivalente à planilha **enquanto `fim` couber no horizonte** — depois de `fim`, o saldo é carregado
inalterado em 0. Divergente quando **não** cabe: o app mostra o saldo **truncado no último mês do
estudo**, que é menor que o saldo real na data contratual de quitação.

A tela infere o problema do número em vez de saber dele: `frontend/tela-funding.ts:486-490` mostra o
aviso quando `Math.abs(ind.saldoFinal) >= 0.01`, e `frontend/fluxo-invariantes.ts:356-360`
(`DIVIDA_FINAL_NAO_ZERA`) faz o mesmo.

## Consequência
O KPI induz a erro exatamente no caso que importa — a dívida que **não** cabe no estudo. Quem lê
"saldo final R$ 3 MM" numa operação de 120 meses dentro de um horizonte de 48 lê um número que não
corresponde a compromisso nenhum: o saldo real na quitação é maior.

Correlato, do `R-A36`: o modo `resultado_final` do equity paga sobre `fluxoAcumulado[último]`, que
também depende do horizonte alcançar o último evento financeiro — a lacuna nº 16 do
`inteligencia-evi-incorporacao.md:1400-1416` diz que o horizonte tem que cobrir o fim de todas as
safras e do capital de giro, e nada no app verifica isso.

## Comportamento esperado
1. `indicadoresOperacao` expõe, para dívida por calendário, o saldo **no mês `fim`** da operação, e
   marca explicitamente `operacaoExcedeHorizonte: boolean` quando `fim >= horizonte`.
2. O aviso de `tela-funding.ts:486-490` e a divergência `DIVIDA_FINAL_NAO_ZERA` passam a **ler essa
   flag** em vez de inferir de `saldoFinal ≠ 0`.
3. Divergência nova `RESULTADO_FINAL_HORIZONTE_CURTO` (severidade **alerta**) quando existir equity
   em modo `resultado_final` e o horizonte não cobrir o último evento financeiro do estudo.

## Como corrigir
Calcular o saldo em `fim` a partir da série já simulada quando `fim < horizonte`; quando não couber,
decidir entre extrapolar a curva Price ou devolver `null` — **pergunta ao autor**, e `null` com a
flag ligada é a resposta conservadora (não fabrica número que a simulação não produziu).

## Critério de aceite
- [ ] Operação com `inicio_mes = 0` e `periodo_amortizacao_meses = 36` num horizonte de 24 →
      `operacaoExcedeHorizonte === true`, e o aviso de tela cita o mês da quitação contratual.
- [ ] Operação que cabe no horizonte → nenhum dos dois muda de valor, e a Reconciliação segue limpa.
- [ ] Teste do `RESULTADO_FINAL_HORIZONTE_CURTO` com horizonte truncado.

## Fora de escopo
- Impedir o cadastro de uma operação que estoure o horizonte — é diagnóstico, não trava: um estudo
  pode legitimamente ter dívida que sobrevive ao horizonte modelado.
- Mudar o fluxo. Esta issue toca **KPI e diagnóstico**, nunca a série mensal.
<<<END>>>

<<<ISSUE>>>
title: fix(proforma): renomear "Custos Financeiros" na proforma para declarar que exclui o serviço da dívida
priority: 2
sources: R-A312 · A5 (4 margens) · 04 §6.3 E10 · 03 §7
---
## Contexto
O conserto da proforma do Avançado (tirar o funding **inteiro** dela, em vez de creditar as entradas)
é a decisão **certa** do ponto de vista do modelo de capital. Esta issue não a contesta — ela conserta
o **desambiguador que o conserto cria** e que ninguém mais vai catalogar.

Por que (a) *"tirar tudo"* é melhor que (b) *"creditar as duas pontas"*, em três razões, nesta ordem:

1. **Amortização não é custo, e liberação não é receita.** Creditar as duas pontas deixa no Resultado
   o resíduo `Σ entradas − Σ saídas`, que **só** iguala o custo financeiro quando a operação amortiza
   inteira dentro do horizonte. Com saldo devedor remanescente — o caso da issue `R-A33`, que o app
   **não** impede — esse resíduo vaza para o Resultado **como se fosse lucro**. A opção (b) troca um
   erro visível e enorme por um erro **silencioso e proporcional ao saldo**: estritamente pior.
2. **Margem alavancada no meio de indicadores desalavancados não reconcilia com nada.** TIR, VPL,
   Payback e Exposição leem o fluxo livre por decisão registrada
   (`frontend/funding-motor.ts:645-655`). Uma proforma alavancada produziria a **quinta** definição
   de margem na mesma sessão.
3. **O painel compara Preliminar × Avançado nas mesmas colunas**
   (`frontend/tela-dashboard.ts:274-281`), e o Preliminar não modela funding nenhum. Alavancar um
   lado só compara coisas diferentes.

## Comportamento atual
Depois do conserto, o grupo `financeiro` passa a significar **duas coisas diferentes com o mesmo
rótulo**:

- na **aba Fluxo**, "Custos Financeiros" = linhas de custo do grupo **mais** as saídas de funding
  (`frontend/fluxo-tabela.ts:577-582`), e o grupo é renderizado **mesmo vazio** quando há funding
  (`:497-499`);
- na **Proforma**, só as linhas de custo (`frontend/proforma-avancado.ts:92-93`, depois do conserto).

Um estudo cujo único custo financeiro é o serviço da dívida mostra o grupo **cheio** numa aba e
**ausente** na outra.

## Consequência
O próximo a comparar as duas abas reabre o mesmo bug **ao contrário** — *"sumiu o custo financeiro
da proforma"* — e o conserto natural dele é somar `linhasSaida` de volta. Ou seja: sem esta issue, o
defeito de −47,87% tem uma rota de retorno.

⚠️ **A proforma NÃO contradiz `fluxo-tabela.ts`.** As duas superfícies respondem perguntas
diferentes, e é de propósito que difiram: a tabela é visão de **caixa** (as duas pontas existem, o
principal se cancela, o rodapé é o fluxo **alavancado**); a proforma é visão **econômica do
empreendimento, antes de decidir como ele é capitalizado**. É a distinção padrão entre resultado
econômico e demonstração de fluxos — não é contorno.

## Comportamento esperado
A proforma rotula o grupo como **"Custos Financeiros (exclui serviço da dívida)"** e traz, no rodapé,
uma linha **informativa e não somada** com `Σ funding.linhasSaida` e o texto *"efeito do funding: ver
a aba Fluxo de Caixa"*.

## Como corrigir
Rótulo em `frontend/proforma-avancado.ts` (ou na tela que a renderiza) + a linha informativa no
rodapé, explicitamente fora de qualquer total.

## Critério de aceite
- [ ] Teste de apresentação: a proforma **não** soma `linhasSaida` no grupo `financeiro` **e** o
      rótulo difere do da tabela.
- [ ] Um estudo com funding e **sem** linha de custo financeira própria renderiza o grupo nos
      **dois** lugares, com conteúdos declaradamente diferentes.
- [ ] Nenhum número muda.

## Fora de escopo
- O conserto da proforma em si — issue própria, e vem antes desta.
- Alavancar TIR/VPL/Payback — decisão registrada em `funding-motor.ts:645-655`, não se reabre aqui.
<<<END>>>

<<<ISSUE>>>
title: docs(formulas): declarar que a proforma do Avançado é desalavancada, e por quê
priority: 2
sources: 04 §6.3 E10 · R-A312 · A4 (varredura documental) · A5
---
## Contexto
O conserto da proforma do Avançado cria uma **verdade nova que nenhum documento declara**. A regra
passa a viver **só** no cabeçalho de `frontend/proforma-avancado.ts:21-64` — e a lição de método
desta rodada é exatamente essa: regra que só existe em comentário de código morre na primeira
compactação de contexto.

## Comportamento atual
`docs/viabilidade/formulas.md:11` fala da proforma do **Preliminar** (*"engine `frontend/proforma.ts`"*)
e **não menciona** `proforma-avancado.ts`. `docs/viabilidade/padrao-incorporacao.md:302-324` idem.

Ou seja: o app passa a ter **duas proformas e um único capítulo de fórmulas**, que descreve a outra.

## Consequência
A próxima sessão que ler `formulas.md` conclui que a proforma do Avançado **não existe**, ou que ela
roda `proforma.ts`. Foi assim que **quatro margens diferentes** conviveram na mesma sessão sem
ninguém achar estranho.

## Comportamento esperado
`formulas.md` ganha um bloco novo, depois da §Resultado, com o texto abaixo — que já está escrito e
conferido, e só precisa ser aplicado:

```markdown
## A segunda proforma — nível Avançado

O Avançado tem proforma própria (`frontend/proforma-avancado.ts`), que **não** roda as fórmulas
acima: ela relê as séries mensais já calculadas por `calcularFluxo` e as achata na mesma hierarquia
de linhas do Preliminar, para que os dois níveis se comparem na mesma coluna
(`investimentoTotal` e `roiPct` são literalmente a fórmula do Preliminar).

> ⚠️ **A proforma do Avançado é DESALAVANCADA — nenhum lado do funding entra nela.** Nem as saídas
> (parcelas, retorno ao investidor), nem as entradas (liberações, aportes). É visão **econômica** do
> empreendimento, antes de decidir como ele é capitalizado, e é o que mantém TIR, VPL e ROI
> comparáveis entre estudos com e sem funding (§8.1 de
> [Funding, Capital Stack e Retorno do Capital](funding-capital-stack)). Quem quiser ler o efeito do
> funding lê a **aba Fluxo de Caixa**, cuja tabela é visão de **caixa** e onde as duas pontas
> existem e se cancelam no principal (`FundingNoFluxo.fluxoMensal`).
>
> Até 2026-08-22 esta função somava `funding.linhasSaida` ao custo sem nunca creditar as entradas:
> o estudo 5 de Pinguim exibia −R$ 62.364.749,03 de resultado onde o valor real é
> R$ 24.668.189,10 (margem −47,87% contra **18,94%**), e o Δ era, ao centavo, a Σ das saídas de
> funding. Todo estudo Avançado **com** funding aparecia no painel como prejuízo catastrófico.
```

## Como corrigir
Aplicar o bloco em `docs/viabilidade/formulas.md`, e acrescentar em `padrao-incorporacao.md:302-324`
uma remissão de uma linha apontando para ele.

## Critério de aceite
- [ ] `grep -n "proforma-avancado" docs/viabilidade/formulas.md` casa.
- [ ] O bloco cita o `arquivo:linha` da regra no código, e a data.
- [ ] Aplicado **junto** com o conserto da proforma, ou logo depois — não antes, senão o documento
      passa a mentir na direção oposta.

## Fora de escopo
- As outras 16 mentiras documentais catalogadas pela lente A4 — issues de outra fatia.
<<<END>>>

<<<ISSUE>>>
title: feat(funding): rotular `divida` como "Dívida / Capital de giro" e varrer os restos de "Capital Stack"
priority: 2
sources: R-A31 · R-A319 · R-A310 (RECUSADA) · R-A311 (RECUSADA) · 04 §6.3 E9 · decisão nº 1 do autor
---
## Contexto
**Decisão do autor, 2026-08-22:** o tipo `divida` **já é** o produto de capital de giro por
calendário. A prova é a própria planilha dele: a aba `divida` de `fluxo_investidor_FORMULAS.xlsx`
rotula `A8` como **"Valor CG (R$):"**, `B18` como **"Libera CG"** e `C18` como **"Carencia CG"**.
É literalmente a folha de Capital de Giro. O que sobra é **vocabulário**, não motor.

> 🛑 **Registro de decisão — a linha de crédito ROTATIVA foi RECUSADA. Não ressuscitar.**
> O desenho `linha_credito` (saque dirigido por falta de caixa, devolução automática quando sobra,
> limite reutilizável), com modelo de dados, pseudocódigo, migração `030` e bump para `0.1.29`, foi
> proposto em `03-regras-funding.md` §3 e **recusado pelo autor**: ele reintroduziria a competição
> por caixa que a #355 apagou de propósito. **Não há migração `030`. Não há bump de `versao`.**
> Junto com ela caiu o diagnóstico `LACUNA_FUNDING` (`R-A311`), que só existia para dizer quando o
> limite de uma linha rotativa acabasse. Quem reabrir isto está **desfazendo decisão do autor**, não
> achando esquecimento.

**Por que o registro mora aqui e não numa issue própria:** uma issue cujo único conteúdo é *"não
faça X"* é fechada sem diff e some do `git log` — e a lição do `CLAUDE.md` ("a issue fechou não é
evidência, o diff é") tem um par: **decisão que não vira comentário no código morre na primeira
compactação de contexto**. Presa ao rótulo, a recusa entra num diff que fica em
`frontend/tela-funding.ts` para sempre, exatamente ao lado do lugar onde alguém tentaria adicionar o
tipo novo. É o único formato em que ela se defende sozinha.

## Comportamento atual
- `frontend/tela-funding.ts:56` rotula o tipo apenas como `"Dívida"`;
  `docs/viabilidade/fluxo-investidor-formulas.md:28` idem.
- `backend/rotas/funding.ts:43` aceita três tipos; `backend/rotas/funding.test.ts:26` **testa que
  `capital_giro` é recusado**; `frontend/funding-motor.ts:131` e `frontend/tela-funding.ts:54-58`
  idem.
- Restos do conceito apagado pela #355 ainda visíveis ou legíveis:
  `frontend/tela-fluxo-ver.ts:56,63,295` (o `:295` é **texto de tela para o usuário**:
  *"Este estudo não tem camadas de Capital Stack…"*), `frontend/tela-financeiro.ts:13,22`,
  `frontend/fluxo-tabela.ts:633`, `frontend/proforma-avancado.ts:67`, `frontend/tela-avancado.ts:94`,
  `frontend/viabilidade-api.ts:257`, `frontend/fluxo-apresentacao.test.ts:170`.
- `padrao-incorporacao.md:1820-1832` descreve capital de giro como conceito **ausente, a
  implementar** — fica falso no instante em que o rótulo mudar.

## Consequência
O usuário que procura "capital de giro" na aba Funding **não encontra** e conclui que o app não tem.
Foi exatamente o que aconteceu na abertura desta rodada: a lacuna nº 2 do dossiê nasceu desse engano,
e ela custou um desenho completo de produto que precisou ser recusado.

E o usuário que lê `tela-fluxo-ver.ts:295` encontra na tela um conceito — "camadas de Capital Stack"
— que **não existe mais no app** desde a #355.

## Comportamento esperado
1. O tipo `divida` é rotulado na UI como **"Dívida / Capital de giro"**, com nota explicando que
   cobre capital de giro, empréstimo-ponte e qualquer dívida por calendário com carência e Price.
   O identificador persistido (`tipo='divida'`) **não muda** — é rótulo, não schema.
2. Um comentário em `frontend/tela-funding.ts:56` registra a recusa do rotativo, com a data.
3. Nenhum texto voltado ao usuário fala em "Capital Stack".
4. `docs/viabilidade/fluxo-investidor-formulas.md` §1 e §4.1 registram que a aba `divida` da planilha
   é a folha de Capital de Giro do autor, com as três células (`A8`, `B18`, `C18`).
5. `padrao-incorporacao.md` §17.4 recebe o bloco substituto abaixo, já escrito:

```
> ✅ **Capital de giro existe — pelo tipo `divida`.** A aba `divida` da planilha
> `fluxo_investidor_FORMULAS` **é** a folha de Capital de Giro do autor (`A8` "Valor CG (R$)",
> `B18` "Libera CG", `C18` "Carencia CG"), e `simularDivida`
> (`frontend/funding-motor.ts:237-292`) a reproduz mês a mês. O que o app não tem, **por decisão
> explícita do autor em 2026-08-22**, é uma linha **rotativa**: sem saque dirigido pela falta de
> caixa, sem devolução automática quando sobra, sem limite reutilizável. Um desenho `linha_credito`
> nesse formato foi proposto e **recusado** — ele reintroduziria a competição por caixa que a #355
> apagou de propósito.
```

## Como corrigir
Rótulo + comentário + varredura de texto + os dois blocos de documentação, numa passada só.

## Critério de aceite
- [ ] `grep -n "Capital de giro" frontend/tela-funding.ts` casa.
- [ ] `grep -rn "Capital Stack" frontend/` volta vazio **em texto de tela**; menções em comentário
      histórico podem ficar, desde que digam que o conceito foi apagado pela #355.
- [ ] `versao` do `manifesto.json` **não** bumpa — não há migração e nada de schema mudou.
- [ ] Nenhum teste de motor muda.

## Fora de escopo
- Tipo novo, coluna nova, migração — **recusados**, ver o quadro de decisão acima.
- Apagar `avancado_capital_instrumentos` do `schema.json` — issue própria, e a resposta lá também é
  "não apagar".
<<<END>>>

<<<ISSUE>>>
title: docs(funding): declarar que a base de receita líquida do equity diverge das duas planilhas, de propósito
priority: 2
sources: R-A35 · R-A321 · decisão nº 2 do autor · A2 (`Premissas!N17`/`N18`) · A4 (17 mentiras documentais)
---
## Contexto
⚠️ **Esta issue NÃO muda cálculo.** O autor decidiu, em 2026-08-22: *"equity é um retorno líquido ao
investidor, não importa esse fator para o cálculo"*. `frontend/funding-motor.ts:58-67` **fica como
está**. A divergência com as planilhas é **intencional**.

O que ela conserta é outra coisa: a decisão criou uma **terceira base** que só existe **numa
conversa** e **não** no arquivo que ela governa. Hoje o documento marcado *"comportamento vigente"*
transcreve a fórmula que o código **não** segue — que é exatamente o gênero de mentira documental
que a lente A4 catalogou 17 vezes nesta rodada.

## Comportamento atual
Quatro composições de "receita líquida" convivem, e o documento vigente descreve a errada:

| Onde | Deduz |
|---|---|
| `!equity!C15/C16/C17` → `C18 = C4*(1 − C15 − C16 − C17)` | corretagem 5% + **marketing 3%** + impostos 6% |
| `docs/viabilidade/fluxo-investidor-formulas.md:133` (transcrição literal da célula) | idem — **e é o doc "vigente"** |
| `funding-capital-stack.md:565-577` §6.2 (ADR) | bruta − impostos − corretagem − permuta financeira, **sem marketing** |
| **`frontend/funding-motor.ts:58-67`, o que o app faz** | `receitaMensal − corretagem`, onde `receitaMensal` já é líquida de RET e permuta financeira (#228). **Marketing não entra.** |

## Consequência
Com o golden do próprio documento: sobre VGV 200 MM, marketing 3% = **R$ 6 MM de base a mais**; a 4%,
**R$ 240 mil de retorno a mais** para o investidor do que a planilha calcula — 13% acima dos R$ 1,88
MM de lucro do golden.

Sem esta issue, a próxima auditoria abre a mesma divergência de novo e, pior, alguém a "conserta"
alinhando o código à planilha — desfazendo a decisão do autor por achar que era bug.

## Comportamento esperado
1. `docs/viabilidade/fluxo-investidor-formulas.md` §4.2 ganha, ao lado da transcrição de
   `!equity!C18`, uma nota dizendo que aquela é a **fórmula da planilha** e que o app usa
   deliberadamente outra composição — com a **citação literal** da decisão do autor de 2026-08-22 e o
   `arquivo:linha` (`funding-motor.ts:58-67`).
2. `funding-motor.ts` passa a ter **uma única** função nomeada de base do equity, com a composição
   **declarada em texto ao lado da assinatura** (o comentário de `:50-57` já faz metade disso, mas
   ancora em `funding-capital-stack.md`, que é ADR — a âncora tem que passar a ser a decisão do
   autor).

## Como corrigir
Texto nos dois lugares. Nenhuma linha de cálculo muda.

## Critério de aceite
- [ ] O doc cita `funding-motor.ts:58-67` e a decisão, com data.
- [ ] Um leitor que compare doc e código não encontra mais divergência **sem explicação**.
- [ ] O golden do §6 do doc passa a ser gerado a partir da função real, não reconstruído à mão
      dentro do teste (`frontend/funding-motor.test.ts:126-144`) — senão o teste continua podendo
      concordar com um doc que o código contradiz.

## Fora de escopo
- Incluir ou excluir marketing da base — **decisão do autor, fechada**.
- O interruptor base bruta × base líquida — issue própria, e é pergunta.
<<<END>>>

<<<ISSUE>>>
title: docs(funding): registrar por que `mesRepasse` soma +1 e por que mexer nele quebra o equity
priority: 2
sources: R-A34 · 03 §2 · lacuna nº 15 do dossiê
---
## Contexto
Duas convenções erradas **se cancelam** no app, e o resultado bate com a planilha. Isso é frágil de
um jeito específico: quem consertar uma das duas sozinho **quebra o equity** sem que nenhum teste
fique vermelho por causa da outra.

## Comportamento atual
`!equity!C8 = C6+C7` (lançamento + duração da obra, 1-based) define o mês do repasse na planilha.
No app, `mesRepasse(crono)` (`frontend/fluxo-shared.ts:624-627`) = `marcosObra().mesEntrega + 1`, e
`marcosObra().mesEntrega` é o **último mês de obra** (`:612-613`), **não** o mês seguinte — que é a
definição da planilha. As duas convenções se cancelam: o golden bate (índice 31 = mês 32).

A nota que existe hoje (`frontend/fluxo-shared.ts:601-604`) explica a convenção de entrega, mas
`docs/viabilidade/fluxo-investidor-formulas.md` §4.2 **não** registra o `+1` nem o motivo dele.

## Consequência
A lacuna nº 15 do dossiê é justamente "as duas definições de entrega". Quem for consertá-la vai
encontrar o `+1` em `fluxo-shared.ts:624-627`, concluir que é bug (porque a definição de entrega
"certa" já seria o mês seguinte) e removê-lo. **O equity em modo `resultado_final` passa a pagar um
mês antes**, e nada acusa: o golden do equity usaria a nova `marcosObra`, então ele também se move.

## Comportamento esperado
`docs/viabilidade/fluxo-investidor-formulas.md` §4.2 registra, ao lado da fórmula `C8`, que o app
deriva o mês do repasse de `marcosObra().mesEntrega + 1` e **por que** o `+1` existe apesar de o app
usar uma definição de entrega diferente da planilha. Com um aviso explícito: **quem mexer em
`marcosObra` tem que mexer nos dois lados**.

## Como corrigir
Nota no doc + comentário em `frontend/fluxo-shared.ts:624-627` apontando para ela e para `!equity!C8`.

## Critério de aceite
- [ ] Teste de regressão: `mesRepasse(crono com obra 2..31) === 31`, com comentário apontando para
      `!equity!C8` — é a **trava** que faz o conserto ingênuo da lacuna 15 ficar vermelho.
- [ ] O doc cita as duas convenções e diz que elas se cancelam.

## Fora de escopo
- Consertar a lacuna nº 15 (as duas definições de entrega) — issue de outra fatia. Esta aqui existe
  **para protegê-la de um conserto parcial**.
<<<END>>>

<<<ISSUE>>>
title: chore(processo): capturar baseline dos KPIs e ordenar a cadeia de PRs que move o mesmo denominador
priority: 2
sources: R-A320 · A5 · A2 · R-A38 · R-A313 · 03 §7
---
## Contexto
Risco de **processo**, não de código — e é a issue que protege o valor de todas as outras.

Cinco mudanças distintas alteram **o mesmo conjunto de números exibidos** (Resultado, Margem, ROI,
TIR), por caminhos independentes:

| Mudança | Efeito no Resultado/Margem |
|---|---|
| tirar o funding da proforma (`proforma-avancado.ts:92-93`) | ⬆️ enorme — −47,87% → 18,94% no estudo 5 |
| modal deixar de reescrever o plano de pagamento | ⬆️ preserva R$ 1.259.273,59 de juros; TIR 17,53% → 18,59% |
| `PATCH` de tipologias validar saldo | pode **impedir** estados hoje salvos |
| campo de taxa no modal (lente A2) | ⬆️ até **5,41% do VGV** — R$ 8,98 MM na EVI |
| cash sweep enxergar as outras operações (`R-A38`) | ⬆️⬇️ em estudo com financiamento à produção + dívida/equity |

## Comportamento atual
Nada obriga essas cinco a saírem separadas, e nenhum PR desta rodada declara qual KPI move.

## Consequência
Se duas entrarem no mesmo PR, **nenhuma variação é atribuível**. A Rodada 8 inteira nasceu de achados
que só apareceram porque foi possível comparar número contra número — perder essa capacidade custa a
próxima rodada.

## Comportamento esperado
1. **Baseline capturado agora**, antes do primeiro merge que mova número: rodar
   `scripts/conferir-estudo.ts` nos estudos 5 e 6 de Pinguim e anexar a saída. É o único momento em
   que o "antes" ainda existe — e ele ainda existe hoje, porque os três consertos foram revertidos e
   a árvore está idêntica à `main`.
2. **Uma mudança de número por PR**, cada uma declarando no corpo **qual KPI move e em que direção**.
3. Ordem recomendada: **conserto da proforma → baseline → `R-A313` (refatoração, sem mudar número) →
   `R-A314`/`R-A37` (equity; risco zero em produção porque não há equity cadastrado) → `R-A38` (a que
   mais move) → campo de taxa no modal (A2)**.
   A `R-A313` vem antes da `R-A38` **de propósito**: fazer as duas juntas mistura *"onde o número é
   calculado"* com *"quanto o número vale"*, e a atribuição some.

## Como corrigir
Registrar a ordem e a regra no corpo desta issue e referenciá-la em cada PR da cadeia.

## Critério de aceite
- [ ] A saída de `scripts/conferir-estudo.ts` dos estudos 5 e 6, na `main` intocada, está anexada.
- [ ] Cada PR da cadeia traz a tabela `antes → depois` dos 4 KPIs dos estudos 5 e 6.
- [ ] **Um PR de refatoração que mova qualquer um dos quatro é um bug, não uma refatoração** — e é
      assim que o critério é enunciado no corpo dos PRs.

## Fora de escopo
- Implementar qualquer uma das cinco mudanças.
- Definir política de merge — merge continua sendo decisão do autor.
<<<END>>>

<<<ISSUE>>>
title: chore(funding): cadastrar em Pinguim as três operações de equity que provam as divergências
priority: 2
sources: R-A317 · A5 (nenhum equity cadastrado) · R-A314 · R-A37 · R-A36 · R-A33
---
## Contexto
Nenhuma das divergências de equity desta rodada tem **evidência viva**: não existe uma única operação
de equity cadastrada em Pinguim. Elas foram provadas **headless**, rodando o motor isolado — o que
prova a fórmula, mas **não** prova a cadeia inteira (rota → coluna → motor → tela → Reconciliação →
exportação).

⚠️ **Cadastro é `POST`.** Estas operações precisam ser criadas **pelo autor, na tela**, ou por uma
sessão com mandato de escrita explícito. A receita abaixo é para executar, não para deduzir.

O alvo é o estudo **5** (`inc_testepu1ideia1avancadobase_df_005`, avançado, rascunho) — é o que tem
`taxaMensal: 0.0098636` e portanto juros de clientes reais. O estudo 6 já passou pelo modal e está
carimbado `"(legado)"`; não serve de base.

## Comportamento atual
`equity` existe no schema, na rota e no motor, e **nunca foi exercido de ponta a ponta em
instância**.

## Consequência
Três issues desta fatia (`R-A314`, `R-A37`/`R-A316`, `R-A36`/`R-A33`) chegam ao autor sem que ele
consiga **ver** o defeito na tela dele. Isso vale mais que as issues: sem as operações, nenhuma é
reproduzível fora de um teste.

## Comportamento esperado
Três operações `[teste]` cadastradas, evidência capturada, operações removidas.

| # | Prova | Operação | O que observar |
|---|---|---|---|
| **E1** | retorno de equity negativo (`R-A314`) | tipo `equity` · nome `[teste] E1 base negativa` · **valor R$ 1.000.000** · âncora `lancamento`, deslocamento 0 · modo **`permuta_financeira`** · `pct_retorno` **10** | A linha *"…(Equity) — retorno"* na aba Fluxo de Caixa. **Basta um mês negativo.** O candidato é o do lançamento: corretagem integral (#121) contra o sinal apenas. Se a curva do estudo 5 não tiver mês negativo, reduzir o **% de entrada** do plano do Grupo até que tenha — o defeito é da fórmula, não do estudo |
| **E2** | teto de 100% (`R-A37`/`R-A316`) | **três** operações `equity`, `permuta_financeira`, `pct_retorno` **40** cada (`[teste] E2a/b/c`), R$ 100.000 cada, âncora `lancamento` | O `POST` da terceira **deve ser aceito hoje** — é o defeito. Depois: a soma de `Funding · … — retorno` do mês dá **120%** da receita líquida do mês, e a Reconciliação **não acusa nada**. Prova dupla: o defeito existe **e** é invisível |
| **E3** | resultado final e horizonte (`R-A36`/`R-A33`) | uma `equity` modo **`resultado_final`**, `pct_retorno` 5, R$ 1.000.000, âncora `planejamento`; **mais** uma `divida` com `periodo_amortizacao_meses` **maior que o horizonte** (ex.: 120) | E3-equity: o pagamento único cai em `mesRepasse` = último mês de obra + 1, e o valor é 5% do **fluxo livre acumulado final** — não de "receita líquida − despesa". E3-dívida: `saldoFinal` na tela é o do **último mês do horizonte**, não o do mês 120 → `R-A33` provada, e `DIVIDA_FINAL_NAO_ZERA` aparece na Reconciliação |

## Como corrigir
Cadastrar, capturar print/JSON de cada observação, anexar às issues correspondentes, remover as
operações. O `DELETE` da rota (`backend/rotas/funding.ts:288-303`) não deixa resíduo.

## Critério de aceite
- [ ] As três evidências anexadas às issues `R-A314`, `R-A37` e `R-A33`.
- [ ] As operações `[teste]` removidas ao fim, e o estudo 5 de volta ao estado anterior.

## Fora de escopo
- Consertar qualquer um dos três defeitos — issues próprias.
- Criar operações em produção (Laputa). Isto é homologação, em estudo rascunho.
<<<END>>>

<<<ISSUE>>>
title: feat(funding): modelar tarifas, estruturação e encargos das operações de dívida
priority: 3
sources: R-A39 · 03 §2 · lacuna nº 14 do dossiê
---
## Contexto
`funding-capital-stack.md:511-512` lista, entre as premissas de capital de giro, *"… **taxas** ·
juros pagos ou capitalizados …"*. O custo real de uma operação bancária brasileira —
estruturação, taxa de administração, avaliação/laudo, IOF — **não aparece em lugar nenhum do app**.

⚠️ Esta issue estava carregada pelo desenho `linha_credito`, que foi **recusado**. Ela **sobrevive
à recusa** por conta própria: tarifa não é conceito do rotativo, é conceito de qualquer dívida.

## Comportamento atual
`schema.json` → `avancado_funding_operacoes.colunas` tem 18 colunas, **nenhuma delas tarifa**.
Nenhuma menção em `frontend/funding-motor.ts`. `frontend/tela-financeiro.ts:16-19` registra que
`tarifas_bancarias_pct`, `taxa_adm_carteira_pct` e `taxa_estruturacao_divida_pct` **saíram da
interface** na #279 por não terem consumidor — as colunas ficaram no schema, inertes.

## Consequência
A TIR do investidor e o CET do projeto ficam **otimistas de forma sistemática** — sempre no mesmo
sentido, em todo estudo com dívida. Não é ruído: é viés.

## Comportamento esperado
Três colunas novas, aplicáveis aos dois tipos de dívida (`divida` e `financiamento_producao`):

| Coluna | Semântica |
|---|---|
| `taxa_estruturacao_pct` | % sobre o valor/limite contratado, pago **uma vez**, no mês da 1ª liberação |
| `taxa_administracao_mensal` | R$/mês enquanto houver saldo > 0 |
| `outros_encargos_iniciais` | R$, no mês da contratação |

Todos entram em `saidas` — portanto **na TIR do investidor e no fluxo alavancado** — e **nunca** no
saldo devedor: tarifa não é principal.

## Como corrigir
Migração `030` + as três colunas no `schema.json` + `versao` bumpada para `0.1.29` + campos na tela
+ termos em `simularDivida`/`simularFinanciamentoProducao`.

> ⚠️ **A numeração `030` e o bump `0.1.29` estão livres**: a decisão do autor recusou a migração `030`
> **do `linha_credito`**, não a numeração. Se esta issue for a primeira migração pós-`029`, ela toma
> o número — e o corpo do PR precisa dizer isso, senão alguém vai ler a recusa e achar que `030` está
> proibida.

## Critério de aceite
- [ ] Default `0` em todas as três → **nenhum estudo existente muda de número**. É adição pura, e é
      isso que a torna segura.
- [ ] Teste de conservação estendido: `Σ saidas = Σ entradas + Σ juros + Σ tarifas`.
- [ ] Harness de migrações verde (instalação virgem, reexecução, cadeia completa).
- [ ] `versao` bumpada **junto** com a migração — os dois erros simétricos de versionamento são
      barrados pelo guard do `validar-backend.sh`.
- [ ] Validação de backend/schema/migração é do autor no ambiente autenticado, e o PR **declara**
      isso — "não deu para rodar" nunca é "passou".

## Fora de escopo
- Financiamento da própria tarifa (tarifa capitalizada no principal).
- IOF calculado por regra fiscal — aqui é campo digitado, não motor tributário.
- Reativar as colunas inertes de `tela-financeiro.ts` — modelo diferente, por estudo e não por
  operação.
<<<END>>>

<<<ISSUE>>>
title: chore(schema): etiquetar `avancado_capital_instrumentos` como obsoleta e barrar seu reúso
priority: 3
sources: R-A318 · A6 · decisão nº 1 do autor · 03 §7
---
## Contexto
A tabela `avancado_capital_instrumentos` (`schema.json:380-390`) é o resto do modelo apagado pela
#355. **A conclusão é mantê-la** — mas o motivo que circulou ("guarda o dado migrado pela `019`")
**não se sustenta**, e a diferença importa para não decidir errado da próxima vez.

Os três motivos que se sustentam:

1. **Não dá para remover.** Sem DDL na camada de migração — `migracoes/029_funding_operacoes.js:55-58`
   diz isso com todas as letras: *"a camada de dados das migrações só tem listar/atualizar/criar —
   não há DDL"* — tirar do `schema.json` **não apaga a tabela** do Postgres: só faz o app parar de
   declará-la, deixando uma tabela **órfã** que nenhuma migração futura consegue alcançar.
   Estritamente pior que mantê-la declarada.
2. **O dado que se queria proteger provavelmente não existe.** O `CLAUDE.md` registra que a `019`
   **nunca rodou em Postgres**, e a `029:34-36` diz o mesmo (*"na prática esta migração é inócua em
   toda instalação existente"*). Manter por causa do dado é apostar num conteúdo que ninguém
   verificou e ninguém pode verificar daqui.
3. **É a única evidência viva do modelo antigo.** Com o rotativo recusado, o Capital Stack está
   encerrado nos dois sentidos — nem volta como waterfall, nem como linha rotativa. A tabela vira
   **registro de auditoria**, e é bom que fique: `funding-capital-stack.md` é ADR, e ADR sem rastro
   no schema é fácil de desacreditar.

## Comportamento atual
O único leitor da tabela em todo o repositório é a própria migração que a aposentou
(`migracoes/029_funding_operacoes.js:88`). Nenhuma rota, nenhum motor, nenhuma tela. Ela está no
`schema.json` **declarada, vazia e com nome sugestivo** — inclusive com `prioridade_funding` e
`prioridade_pagamento`, os campos de waterfall que a #355 apagou.

## Consequência
Uma sessão futura, ao implementar qualquer coisa de funding, encontra essa tabela e **a reusa** —
ressuscitando por acidente o modelo que **duas decisões separadas** enterraram.

## Comportamento esperado
1. A tabela ganha `"descricao": "OBSOLETA — substituída por avancado_funding_operacoes (#355). Só a
   migração 029 a lê. Não usar em código novo."`
2. Guard estático no `.github/workflows/pr-guards.yml`, no molde do
   `scripts/guard-issue-fechamento.mjs`, barrando qualquer referência a
   `avancado_capital_instrumentos` **fora** de `migracoes/` e `docs/`.

## Como corrigir
Metadado no `schema.json` + script de guard + job no `pr-guards.yml` (com `timeout-minutes`, como
todo job).

## Critério de aceite
- [ ] O guard **falha** num PR de teste que adicione a string em `frontend/` ou `backend/`, e
      **passa** na `main` atual.
- [ ] `versao` do `manifesto.json` **NÃO** bumpa — `descricao` não é mudança de schema e não há
      migração nova.
- [ ] O guard não depende do SDK (só `node` + `grep`), senão fica vermelho por falta de credencial.

## Fora de escopo
- Apagar a tabela — impossível sem DDL, e isso é pendência de plataforma, não desta app.
- Remover as colunas inertes de `tela-financeiro.ts` — issue separada desde a #279.
<<<END>>>

<<<ISSUE>>>
title: decide(funding): o equity ganha o interruptor de base bruta × base líquida que a permuta financeira já tem?
priority: 3
sources: R-A321 (P8) · A2 (`Premissas!N17`/`N18`) · decisão nº 2 do autor · 03 §7
---
## Contexto
⚠️ **Isto é pergunta ao autor, não trabalho.** Ela não reabre a decisão de 2026-08-22 — ela pergunta
**o que aquela decisão significa**, e as duas leituras possíveis levam a modelagens diferentes.

A pergunta só aparece quando o achado da lente A2 encosta no da A3, e nenhum dos dois a fez sozinho:
a EVI trata "líquida" como **duas grandezas distintas, com dois flags independentes**, e o app **já
reproduz esse par** — mas só para a permuta financeira.

## Comportamento atual
| Onde | Base "líquida" de quê | Deduz |
|---|---|---|
| EVI, `Premissas!P19` (flag `N17`) | resultado do projeto | imposto + corretagem + **marketing** |
| EVI, `cfINC!BN` (flag `N18`) | rateio da permuta financeira | imposto + corretagem, **sem marketing** |
| planilha `fluxo_investidor`, `!equity!C18` | retorno do equity | corretagem + **marketing** + impostos |
| app, `frontend/funding-motor.ts:58-67` | retorno do equity | impostos + corretagem + permuta física — **sem interruptor** |
| app, `frontend/fluxo-caixa-motor.ts:1549-1571` | rateio da permuta financeira | imposto + corretagem — **e é opcional**, via `permuta_financeira_base`, default `bruta` |

A decisão do autor fixa a linha 4 e está fechada. O equity **não tem** o interruptor equivalente ao
`permuta_financeira_base` que a linha 5 já tem.

## Consequência
Sem resposta, não dá para saber se `funding-motor.ts:58-67` é **uma escolha travada** ou **a única
existente** — e são coisas diferentes na hora de modelar um contrato real de investidor, em que a
base de cálculo do retorno é cláusula negociada.

## Comportamento esperado
**Pergunta (P8):** o equity deve ganhar o mesmo interruptor que a permuta financeira já tem — base
bruta × base líquida, escolhida **por operação** —, ou *"retorno líquido ao investidor"* quer dizer
que a base do equity é **sempre** a que o app já usa, sem opção?

*(Não se está propondo mudar a base: a decisão nº 2 fechou isso.)*

## Como corrigir
Nada a implementar até a resposta.

- **Se "sempre a mesma":** esta issue fecha sem diff, e a nota da issue de documentação já cobre o
  registro.
- **Se "ganha o interruptor":** vira issue de implementação com coluna nova
  (`equity_base_receita`, default = comportamento atual), migração e bump — no molde exato do
  `permuta_financeira_base`, que é o precedente pronto no app.

## Critério de aceite
- [ ] Resposta do autor registrada no corpo, com data.
- [ ] Se a resposta for "ganha o interruptor", a issue de implementação está aberta e esta fecha
      apontando para ela.

## Fora de escopo
- Mudar a composição da base — fechada.
- Implementar qualquer coisa antes da resposta.
<<<END>>>

---
titulo: Fluxo do Investidor — fórmulas das operações de Funding
descricao: Especificação vigente das operações de Funding (Dívida e Equity), transcrita da planilha fluxo_investidor_FORMULAS. Financiamento à produção é exceção e segue a §4.3 de funding-capital-stack.
tipo: app
ordem: 9
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Fluxo do Investidor — fórmulas das operações de Funding

> ✅ **Este documento descreve COMPORTAMENTO VIGENTE.** É a especificação de `divida` e `equity` no
> modelo implementado pela #355 (`frontend/funding-motor.ts`, `frontend/tela-funding.ts`,
> `backend/rotas/funding.ts`, tabela `avancado_funding_operacoes`, migração `029`).
>
> O modelo anterior — 4 instrumentos com waterfall e prioridades — está em
> [Funding, Capital Stack e Retorno do Capital](funding-capital-stack), hoje majoritariamente ADR
> histórico. **A exceção é a §4.3 daquele documento**, que continua vigente e descreve
> `financiamento_producao` — ver a §4.3 aqui.

## 1. Contexto e escopo

A aba **Funding** do estudo Avançado cria operações de captação. São **três tipos, independentes
entre si** — sem waterfall, sem prioridade, sem competição por caixa:

| Tipo | Cardinalidade | Matemática |
|---|---|---|
| `financiamento_producao` | **única por estudo** | medição de custo elegível + cash sweep (**§4.3** — não é esta planilha) |
| `divida` | quantas quiser, nomeáveis | calendário + Price — **é a folha de Capital de Giro do autor** (`A8` "Valor CG (R$):", `B18` "Libera CG", `C18` "Carencia CG"; **§4.1**) |
| `equity` | quantas quiser, nomeáveis | aporte + retorno em 2 modos (**§4.2**) |

A fonte de `divida` e `equity` é a planilha `fluxo_investidor_FORMULAS.xlsx`, entregue pelo autor em
2026-08-11 (é o documento que manteve a #355 bloqueada pela decisão D6 por uma rodada inteira). As
duas abas da planilha estão transcritas na §4.

**O que a simplificação apagou** em relação ao modelo antigo: waterfall de 8 passos ·
`prioridade_funding` / `prioridade_pagamento` · liberação automática por lacuna de caixa ·
`reservaMinima` · os 4 modos de Preferred Equity (viraram 2 modos de Equity) · as políticas
`cash_sweep` e `bullet` para dívida de calendário (resta Price com carência).

> ⚠️ **Consequência assumida:** na planilha os pagamentos **não são limitados pelo caixa do
> projeto** — o PMT é capado pelo saldo devedor, e o retorno do equity sai como % da receita, haja
> ou não caixa. O fluxo alavancado pode, portanto, ficar negativo. A decisão **D14** trata isso como
> risco visível, não como bloqueio: a Reconciliação (`frontend/fluxo-invariantes.ts`) alerta quando
> o acumulado após funding fica negativo.

## 2. Modelo de dados

Tabela `avancado_funding_operacoes` (migração `029_funding_operacoes.js`, que substitui
`avancado_capital_instrumentos` da `019`):

| Coluna | Aplica a | Papel |
|---|---|---|
| `estudo_id`, `tipo`, `nome`, `ordem` | todas | identidade e ordem de exibição |
| `valor` | todas | dívida: principal contratado · equity: aporte |
| `inicio_mes` | todas | mês do aporte/1ª liberação, **0-based** (ancorado, ver §3) |
| `distribuir_aporte`, `aporte_meses` | `divida` | liberação em N tranches iguais |
| `taxa_anual` | `divida` | % a.a., não fração |
| `periodo_amortizacao_meses`, `periodo_carencia_meses` | `divida` | prazo total e carência |
| `modo_retorno`, `pct_retorno` | `equity` | `permuta_financeira` \| `resultado_final`, e o % |
| `exposicao_minima`, `percentual_financiavel`, `amortizar_com_caixa`, `custo_linha_ids` | `financiamento_producao` | premissas da §4.3 |
| `taxa_estruturacao_pct`, `taxa_administracao_mensal`, `outros_encargos_iniciais` | `divida` | tarifas/encargos (#478, emenda do app — ver §4.1, sem oráculo de planilha) |

**Teto de `Σ pct_retorno` — duas somas, uma por `modo_retorno`.** A soma de `pct_retorno` das
operações `equity` de um estudo **não pode passar de 100%**, e a checagem é feita **por
`modo_retorno`, separadamente**:

| Soma | Operações que entram | Base que ela distribui |
|---|---|---|
| A | `tipo = equity` **e** `modo_retorno = permuta_financeira` | Receita Líquida mensal (planilha: `C18`) |
| B | `tipo = equity` **e** `modo_retorno = resultado_final` | Resultado Final (planilha: `C19`) |

As duas **não competem**: são grandezas diferentes, e a planilha as separa (`D28 = SE(C24; C×C25;
SE(t = C8; C19×C25; 0))`). Uma operação em cada modo pode ter 100% sem conflito.

Três regras de leitura que a validação tem de respeitar, sob pena de somar o que não deve:

- **`modo_retorno` tem default.** A coluna nasce `permuta_financeira` (`schema.json`, e o motor
  aplica o mesmo default em memória): uma operação gravada sem o campo conta na **soma A**, não
  fica de fora das duas.
- **`tipo ≠ equity` não entra.** `pct_retorno` existe na tabela para os três tipos, com default
  `0`, mas só é significativo em `equity`.
- **No `PATCH`, vale o estado FINAL** (`atual + payload`), e a operação sendo editada **não conta
  duas vezes** — senão toda edição recusaria a si mesma.

A comparação usa **tolerância** (`> 100.01`, não `> 100` estrito): `pct_retorno` é percentual e
carrega precisão plena, então `60 + 40,001` de ponto flutuante recusaria indevidamente. É o mesmo
padrão de `erroFormularioAbsorcao` e `erroFormularioPagamento`.

**Onde isso é imposto:** `backend/rotas/funding.ts` — `validarCamposOperacao` barra uma operação
isolada acima de 100 (`400 CAMPO_INVALIDO`) e `somaRetornoExcede` barra a soma do estudo no `POST`
e no `PATCH` (`422 RETORNO_EXCEDE_RECEITA`). A validação nasce **só no backend**: a tela ainda
deixa salvar e mostra o erro depois.

> ⚠️ **De onde vem esta regra, e por que ela está aqui.** O enunciado original é
> [funding-capital-stack](funding-capital-stack) §6.2 — *"a soma das participações de receita não
> pode superar 100%"* —, mas aquela §6 é **ADR histórico supersedido** pela reescrita do Funding, e
> não serve de norma. A planilha `fluxo_investidor_FORMULAS` é **fonte nula** para esta regra: ela
> tem **uma** operação só (`C25` é um número digitado, sem soma nem validação), então nunca
> exercita o caso. O que ela dá é o **denominador** — `C18` e `C19` são grandezas únicas e fixas, e
> `D28 = C28 × C25` distribui uma fração delas. Distribuir mais de 100% é distribuir o que não
> existe: o instrumento deixaria de ser equity e viraria dívida disfarçada, sem saldo devedor, sem
> juros e sem quitação. A regra passa a valer **aqui**, na spec vigente, pela **#435**.

## 3. Convenções

**Tempo.** Meses **relativos, 0-based** — índice do array = mês, igual a `fluxo-caixa-motor.ts` e
`fluxo-shared.ts`. A planilha conta a partir de 1; a conversão acontece na borda. Onde este
documento cita um mês da planilha, ele vem marcado como tal.

**Âncora (decisão D11).** "Mês do aporte" não é número cru na UI: é **âncora + deslocamento**
(`EVENTOS_ANCORA`), como nas linhas de Custo. Número absoluto quebraria quando o Cronograma muda.
O `inicio_mes` persistido já é o resultado 0-based dessa resolução.

**Sinal.** A planilha raciocina na **visão do investidor** (desembolso negativo, recebimento
positivo); a tabela de Resultados precisa da **visão do projeto**. O motor produz as duas e nomeia
cada uma:

- `entradas` / `saidas` — o que o **projeto** recebe / paga;
- `fluxoInvestidor` = `saidas − entradas` — o fluxo de quem põe o dinheiro, e a base da TIR/VPL/
  payback dele.

**Percentuais.** As colunas guardam percentual (`20` = 20% a.a.), não fração. As conversões ficam
todas em `funding-motor.ts`.

**Arredondamento.** Todo valor monetário sai com 2 casas (`round2`), conforme o contrato do
`CLAUDE.md`. A planilha arredonda **só o saldo devedor** (coluna F) e deixa juros/PMT com precisão
cheia — daí a tolerância de centavos nos golden cases da §6. O caminho do **saldo** é idêntico: o
motor carrega adiante o saldo já arredondado, como a coluna F.

## 4. Fórmulas das operações

### 4.1 Dívida (aba `divida` da planilha)

> Esta aba **é** a folha de Capital de Giro do autor — não um tipo de operação genérico com o
> nome "dívida" por acaso. A própria planilha rotula `A8` como **"Valor CG (R$):"**, `B18` como
> **"Libera CG"** e `C18` como **"Carencia CG"**. Qualquer dívida por calendário com carência e
> Price — capital de giro, empréstimo-ponte, ou outra — cabe aqui; ver `frontend/tela-funding.ts`
> (rótulo "Dívida / Capital de giro").

**Entradas:** `C8` Valor · `C9` Mês do aporte · `C10` Distribuir aporte? · `C11` Aporte em quantos
meses · `C12` Taxa anual · `C13` Período de amortização · `C14` Período de carência.

**Derivados:**

```
C15 (taxa mensal) = (1 + C12)^(1/12) − 1

C16 (PMT) = SE(C13 <= C14; 0;
            PMT(C15; C13 − C14; SE(C10; C8/C11 * ((1+C15)^C11 − 1)/C15 ; C8)))
```

> ⚠️ **Quando o aporte é distribuído, a base do PMT não é `C8`**: é o *valor futuro* das tranches
> liberadas ao fim do período de liberação — os juros do período de liberação capitalizam no saldo.
> Errar isso subestima a parcela.

Com `ini = C9 + SE(C10; C11; 1)` e `fim = ini − 1 + C13`:

| Coluna | Fórmula no mês `t` |
|---|---|
| B — Libera | `SE(C10; SE(C9 <= t <= C9+C11−1; C8/C11; 0); SE(t = C9; C8; 0))` |
| C — Carência | `1` se `ini <= t <= ini+C14−1` |
| D — Juros | `t=1 → 0`; senão `SE(t <= fim; saldo_ant * C15; 0)` |
| E — PMT | `0` se `t < ini` ou `t > fim`; `saldo_ant + B + D` se `t = fim` (quitação); `MIN(D; saldo_ant+B+D)` na carência (só juros); senão `MIN(C16; saldo_ant+B+D)` |
| F — Saldo | `MAX(0; ARRED(saldo_ant + B + D − E; 2))` |
| G — Fluxo investidor | `E − B` |

Juros incidem sobre o saldo de **abertura** e só dentro da janela da operação. Implementação:
`simularDivida` (`funding-motor.ts:299`).

> ⚠️ **Emenda do app — tarifas/estruturação/encargos (#478), a planilha NÃO modela isto.** A aba
> `divida` da `fluxo_investidor_FORMULAS` tem exatamente as entradas `C8:C14` acima — nenhuma
> tarifa, taxa de administração ou encargo. Três colunas foram acrescentadas ao modelo do app,
> **sem oráculo de planilha para os valores**:
>
> - `taxa_estruturacao_pct` — % sobre `C8` (Valor), cobrado **uma vez**, no mês da 1ª liberação;
> - `taxa_administracao_mensal` — R$/mês, cobrada em todo mês com saldo devedor (coluna F) `> 0`;
> - `outros_encargos_iniciais` — R$, cobrados **uma vez**, no mês da contratação (`C9`).
>
> As três entram na coluna **E — PMT** (renomeada, na prática, para "saídas": `PMT + tarifas`), e
> portanto na TIR do investidor (coluna G) — **nunca** na coluna **F — Saldo**, que continua
> `MAX(0; saldo_ant + B + D − PMT)` sem nenhum termo de tarifa. A única coisa que a planilha
> sustenta aqui é a **restrição estrutural**: tarifa não é nem principal (não soma em F) nem juros
> (D continua sendo só `saldo_ant × C15`) — a generalização de `Σ E − Σ B = Σ D` vira
> `Σ saídas − Σ B = Σ D + Σ tarifas`. Implementação: `simularDivida` (`funding-motor.ts:299`),
> campo `tarifas` de `SerieOperacao`.

### 4.2 Equity (aba `equity` da planilha)

**Entradas da operação:** `C22` Valor do aporte · `C23` Mês do aporte · `C24` modo · `C25` % de
retorno.

`C24` = **TRUE** → `permuta_financeira`: % progressivo sobre a Receita Líquida, mês a mês.
`C24` = **FALSE** → `resultado_final`: % do Resultado Final, pago **de uma vez**, no mês do repasse.

| Coluna | Fórmula no mês `t` |
|---|---|
| B — Receita bruta | `0` se `t > C5`; `C4*C9` se `t = C6`; `C4*C10/MAX(1; C7−1)` se `C6 < t < C8`; `C4*C12` se `t = C8`; `C4*C11/MAX(1; C5−C8)` se `t > C8` |
| C — Receita líquida | `B * (1 − C15 − C16 − C17)` |
| D — Retorno equity | `SE(C24; C * C25; SE(t = C8; C19 * C25; 0))` |
| E — Aporte | `SE(t = C23; C22; 0)` |
| F — Fluxo investidor | `D − E` |
| G — Caixa acumulado | `G_ant + F` |

> ⚠️ **Divergência deliberada do app — composição da base de receita líquida do equity (#465).**
> A linha `C` acima transcreve a planilha: `B * (1 − C15 − C16 − C17)`, onde `C15/C16/C17` somam as
> três deduções — corretagem, marketing e impostos (a mesma composição de
> `Premissas e Resultados!P19`, ≈ 14% no golden do §6 abaixo). O app usa outra composição —
> `receitaLiquidaComCorretagemMensal` (`frontend/funding-motor.ts:73-81`): `receitaMensal`
> (já líquido de RET + permuta financeira, #228) **menos só corretagem**. **Marketing não entra na
> base do retorno de equity.**
>
> **Decisão do autor, verbatim, 2026-08-21:** *"equity é um retorno líquido ao investidor, não
> importa esse fator para o cálculo"*. Registrada como intencional em `CLAUDE.md` § Decisões do
> autor (item 3) desde a Rodada 8, e tornada testável pela #465:
> `receitaLiquidaDeProformaMensal` (`frontend/fluxo-caixa-motor.ts`) **É** a composição de quatro
> parcelas desta planilha — deduz imposto, corretagem, marketing e permuta financeira juntos —,
> exposta na Proforma do Avançado como linha informativa separada ("Receita líquida de proforma —
> composição EVI"), sem substituir a base do equity. Um teste
> (`frontend/funding-motor.test.ts`, "#465 …divergem quando há marketing") **afirma que as duas
> divergem**: se algum dia alguém alinhar `receitaLiquidaComCorretagemMensal` a esta planilha
> (passando a deduzir marketing também), o teste fica vermelho — é a trava contra o "conserto"
> desfazer esta decisão por engano.
>
> ⚠️ **`C8`, referenciado nas linhas B e D acima, é o mês do repasse** — não faz parte das
> "Entradas da operação" listadas no topo desta seção porque é derivado, não digitado (Decisão D8,
> abaixo). Ver a nota **#467**, ao fim desta seção, para a convenção que o app usa para
> derivá-lo — e para o que ela obriga quem mexer em `marcosObra`.
>
> ⚠️ **Divergência deliberada do app — retorno de equity quando a receita líquida do mês é
> negativa (#432).** A linha `D` acima é a transcrição fiel da planilha, e a planilha **não** tem
> `MAX(0; …)` ali. Ela é **silenciosa, não permissiva**: `C = B × (1 − C15 − C16 − C17)` é uma
> dedução **multiplicativa** sobre uma decomposição do VGV em frações não negativas
> (`não-negativo × 0,86`), então o estado negativo é **estruturalmente irrepresentável** na
> planilha. No app a dedução é uma **série subtraída com cronograma próprio** — a corretagem é paga
> integralmente no mês da venda (`frontend/fluxo-shared.ts:502-509`, `eCorretagem`, #121) enquanto o
> recebimento é espalhado pelo plano —, e o estado **existe**: um mês de lançamento cujo sinal é
> menor que a corretagem produz receita líquida negativa.
>
> **O app aplica clamp em 0 com carry-forward do déficit**, no modo `permuta_financeira`:
>
> 1. o mês nunca paga negativo — se `base × pct < déficit acumulado`, `saidas[t] = 0`;
> 2. o que deixou de ser pago **não some**: vira déficit acumulado e abate os meses seguintes;
> 3. um mês que não zera o déficit inteiro paga zero e **carrega o resto**;
> 4. o **total** pago ao investidor é preservado quando o acumulado fecha não negativo — muda o
>    calendário, não o montante. Déficit que sobra ao fim do horizonte é **extinto**, e **não** vira
>    pagamento negativo: nesse caso o total pago é menor.
>
> O déficit é acumulado em **precisão plena** e vive **por operação** (variável local de
> `simularEquity`); só `saidas[t]` é arredondado, pelo contrato C7 do `CLAUDE.md`.
>
> **Decisão do autor, 2026-08-22.** Não é restauração do clamp que existia em
> `capital-stack-motor.ts` antes da #355 — aquele era um `Math.max(0, …)` seco, **sem memória de
> déficit**, e teria produzido um total pago maior. O precedente interno do clamp (sem a memória) é
> `frontend/fluxo-caixa-motor.ts:2056`, em `permutaFinanceiraLiquidaMensal` (`:1576-1587`). Implementação:
> `simularEquity` (`funding-motor.ts:516`).

**Decisão D8 — as premissas do projeto não são redigitadas.** A aba `equity` da planilha pede de
novo VGV, % entrada/parcelas/repasse, corretagem, marketing, impostos, duração da obra e mês do
repasse (`C4`–`C19`). O app **deriva tudo do próprio estudo**: `receitaLiquidaMensal`,
`resultadoFinal` e `mesRepasseValor` chegam prontos a `simularEquity` por
`fundingDoEstudo` (`funding-motor.ts:861`). Redigitar criaria uma segunda fonte de verdade,
divergindo em silêncio da aba Resultados — exatamente o que as #349/#351 eliminaram.

O invariante da curva vale como conferência: `Σ receita bruta = VGV`.

Implementação: `simularEquity` (`funding-motor.ts:516`).

> ⚠️ **#467 — o `+1` de `mesRepasse` existe para CANCELAR uma segunda divergência, não para
> corrigi-la.** Esta é a nota que a advertência sobre `C8`, mais acima nesta seção, promete.
>
> `!equity!C8 = C6+C7` (lançamento + duração da obra, 1-based) é o mês do repasse **na planilha**, e
> ela define "fim da obra" como o mês **seguinte** ao último mês de obra. O app adota outra
> convenção: `marcosObra(crono).mesEntrega` é o **último** mês de obra — um mês antes —, para não
> ter duas definições de entrega convivendo no motor de recebíveis.
>
> **As duas convenções erradas se cancelam.** `mesRepasse` soma `+1` sobre `mesEntrega`, e esse `+1`
> compensa exatamente a diferença de um mês da definição de entrega. O golden do equity bate com a
> planilha **porque as duas somam zero**, não porque cada uma esteja certa isoladamente.
>
> **Consequência operacional, e é ela que esta nota existe para registrar:** quem "corrigir" a
> definição de entrega em `marcosObra` — a lacuna nº 15 do dossiê, ainda aberta — **tem de mexer no
> `+1` no mesmo diff**. Do contrário o equity em modo `resultado_final` passa a pagar um mês antes
> (ou depois) do devido, e **nenhum teste acusa sozinho**: o golden do equity usaria a `marcosObra`
> nova e se moveria junto com ela.
>
> A trava contra isso é o teste de `frontend/fluxo-shared.test.ts`, que prende as duas pontas na
> mesma asserção — obra 2..31 dá `marcosObra(...).mesEntrega === 31` **e** `mesRepasse(...) === 32`.
> Mutar qualquer um dos dois lados deixa esse teste vermelho.
>
> Implementação: `mesRepasse` e `marcosObra` (`frontend/fluxo-shared.ts`).

### 4.3 Financiamento à produção — **exceção, não segue esta planilha**

> 🔴 **Leia isto antes de mexer no motor.** A planilha `fluxo_investidor_FORMULAS` modela dívida por
> calendário: aporte num mês (ou distribuído em N), amortização Price após carência. Aplicar isso a
> `financiamento_producao` **reverteria o modelo aprovado na #405**.

Decisão do autor (2026-08-12): as duas planilhas especificam **produtos diferentes**, e o app
precisa dos dois. `financiamento_producao` preserva o modelo da planilha `Incorp Individual`,
especificado na **§4.3 de [funding-capital-stack](funding-capital-stack)** — a única seção daquele
documento que continua vigente:

- liberação **incondicional contra medição de custo elegível**, não por necessidade de caixa;
- **gatilho de exposição mínima** sobre o custo incorrido antes da 1ª liberação;
- **catch-up retroativo** na 1ª liberação;
- janela de obra/chaves;
- caixa disponível e teto de amortização calculados **sem** a liberação do próprio mês;
- **cash sweep puro**, sem prestação contratual — este produto não tem parcela fixa;
- sem teto de crédito.

Por isso é a **única** operação cujo desembolso e amortização dependem do fluxo de caixa do projeto;
`divida` e `equity` seguem a matemática desta planilha sem checar caixa.

Implementação: `simularFinanciamentoProducao` (`funding-motor.ts:398`) — a matemática da §4.3 foi
apenas **realocada** de `capital-stack-motor.ts`, não reescrita. Oráculo próprio:
`frontend/financiamento-producao-golden.test.ts` (80 períodos do cenário real, tolerância R$ 0,15).

## 5. Indicadores do investidor

`indicadoresOperacao` (`funding-motor.ts:615`) devolve, na visão do investidor: investimento total
(negativo), retorno total, juros pagos, lucro, VPL, TIR mensal e anual, MOIC e payback.

**Duas divergências deliberadas em relação à planilha:**

| # | A planilha faz | O app faz | Por quê |
|---|---|---|---|
| **D9** | `NPV(0,1; série_mensal)` — 10% **ao mês** (≈214% a.a.) | VPL com a `taxaDescontoAa` **do estudo**, convertida a mês por `vplFluxo` | 10% ao mês produz VPL fortemente negativo numa operação que rende 20% a.a.; e a taxa do estudo é a que todo o resto do app usa |
| **D10** | `MATCH(...)+28−1` no payback — soma o deslocamento da linha à resposta e devolve **59** onde o caixa vira positivo no mês **32** | 1º mês com acumulado ≥ 0 | é erro de planilha, não regra de negócio; é a convenção já usada em `paybackMes` |

O payback só conta depois de ter havido desembolso — um fluxo que começa em zero não "pagou de
volta" nada no mês 0.

## 6. Exemplo numérico (golden case)

Conferido célula a célula contra a planilha; `Σ receita bruta = 199.999.999,99 ≈ VGV` ✓.
Reproduzido em `frontend/funding-motor.test.ts`.

**Dívida** — 10M, 20% a.a., 3 tranches, carência 12, amortização 36:

| Grandeza | Valor |
|---|---|
| Taxa mensal | `0,015309470499731193` |
| PMT | `508.746,97518660501` |
| Retorno total (Σ PMT) | `14.075.333,009917879` |
| Juros pagos | `4.075.332,9857015153` |
| Saldo final (mês 39 da planilha) | `0` |
| TIR mensal / anual | `0,015309470578088513` / `0,20000000111133076` |

**Equity** — 5M no mês 1 da planilha, modo `permuta_financeira`, 4%; projeto de VGV 200M em 36
meses, lançamento no mês 2, obra 30, repasse no 32, 20% entrada / 30% parcelas / 0% pós-chaves /
50% repasse, deduções 14%:

| Grandeza | Valor |
|---|---|
| Receita líquida total | `171.999.999,99999997` |
| Resultado final | `166.999.999,99999997` |
| Retorno total recebido | `6.879.999,9999999981` |
| Lucro do investidor | `1.879.999,9999999981` |
| TIR mensal | `0,016823843299068608` |
| Payback (**D10**) | mês 32 da planilha — **não** 59 |

## 7. Como o funding entra na tabela de Resultados

A costura é `FundingNoFluxo` (`funding-motor.ts:806`), criada pela #349 e preservada de propósito
pela reescrita: as liberações/aportes entram como categoria de receita e as parcelas/retornos como
categoria de custo, dentro da tabela principal — não há segunda tabela.

Consumidores: `fluxo-tabela.ts` · `exportar.ts` · `tela-fluxo-ver.ts` · `tela-cenarios.ts`.
As KPIs desalavancadas (§8.1) são preservadas pela linha "Fluxo de Caixa Livre (antes do funding)".

> ⚠️ **`proforma-avancado.ts` saiu da lista de consumidores com a #426.** A proforma do Avançado é
> **desalavancada** — a função não recebe mais `FundingNoFluxo`, nem pela ponta da receita nem pela
> do custo. Quem quiser ler o efeito do funding lê a aba Fluxo de Caixa.

## 8. Rastreabilidade

| O quê | Onde |
|---|---|
| Diagnóstico completo e decisões D8–D14 | issue **#355**, comentário de 2026-08-11 |
| Modelo antigo (ADR) e a §4.3 vigente | [funding-capital-stack](funding-capital-stack) |
| Financiamento à produção — decodificação da planilha `Incorp Individual` | PR **#405** |
| Motor | `frontend/funding-motor.ts` |
| Tela | `frontend/tela-funding.ts` |
| Rotas e validação de entrada | `backend/rotas/funding.ts` |
| Migração | `migracoes/029_funding_operacoes.js` |
| Golden cases | `frontend/funding-motor.test.ts` · `frontend/financiamento-producao-golden.test.ts` |
| Invariantes (inclui a **D14**) | `frontend/fluxo-invariantes.ts` — `validarFunding` |

## 9. Passos 23–25 — montagem por consumidor, e a recusa da fonte única (#474)

`docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594` (Passos 23–25) descreve **uma**
sequência, executada **uma** vez: processar os instrumentos de funding → formar o fluxo final →
atualizar acumulados e indicadores. **No app essa sequência não existe como código.** Ela é
remontada, à mão, por consumidores independentes, cada um com a sua montagem — e é o que a #474
existe para registrar, depois que o autor **recusou** a alternativa (fonte única,
`estadoFinanceiroDoEstudo`) em **D-Q03, 2026-08-22**: *"corrigir o erro da proforma, mas **não**
unificar as definições"*. A #426 (o "erro da proforma") já mergeou; a fonte única, não — e não vai.

### 9.1 A definição vigente de `resultadoFinal`

O app pratica:

```
resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1]
```

— o fluxo de caixa livre **acumulado ao fim do horizonte modelado**. É a MESMA leitura em todo
consumidor (ver §9.2); o que diverge entre consumidores é se e como esse número alimenta
`fundingDoEstudo` depois.

**Divergência em relação à planilha `fluxo_investidor_FORMULAS`:** lá o fecho é
`!equity!C19 = C18 − divida!C5` — a soma de TODAS as entradas e saídas de caixa do investidor ao
longo de toda a operação (um total econômico, sem corte de tempo), não um valor amarrado ao
horizonte que o `FluxoConfig` do estudo modela.

**As duas coincidem quando o horizonte alcança o último evento financeiro relevante** (última
parcela, último recebimento, quitação de toda dívida) **e divergem quando não alcança** — um
horizonte mais curto que a cauda de recebíveis/dívida do projeto deixa `resultadoFinal` sem contar
o que viria depois do corte, enquanto `C19` da planilha não tem esse problema (ela não corta no
tempo).

**O entregável desta seção é registrar a definição vigente, não escolher entre as duas.** Adotar a
definição da planilha seria mudança de comportamento — decisão do autor, issue própria. Ninguém
está autorizado a "corrigir" `resultadoFinal` para bater com `C19` a partir desta nota.

### 9.2 Os cinco consumidores (inventário executável)

| # | Consumidor | remonta `resultadoFinal` | chama `fundingDoEstudo` |
|---|---|---|---|
| 1 | `frontend/tela-fluxo-ver.ts` | `:175` | `:179` |
| 2 | `frontend/tela-funding.ts` | `:215` | `:216` |
| 3 | `frontend/tela-cenarios.ts` | `:239` (e de novo em `:273`, como `resultadoDesalavancado`) | `:240` |
| 4 | `frontend/tela-resumo.ts` | `:182` | — (só remonta; é a "Margem de caixa" da #443) |
| 5 | `scripts/conferir-estudo.ts` | `:152` | `:153` |

Cada um dos cinco arquivos carrega um comentário (`grep -c "Passos 23"` → `1`) citando os outros
quatro por `arquivo:linha` — é o formato em que a decisão se defende sozinha: quem for escrever a
próxima tela lê o aviso no arquivo que está copiando. O teste de inventário,
`frontend/consumidores-passos-23-25.test.ts`, conta os arquivos que casam os dois padrões acima
(fora de testes/fixtures/motor) e falha se o número deixar de ser exatamente 5 — é o que impede a
sexta montagem de entrar em silêncio.

**`frontend/tela-proforma.ts` NÃO é consumidor desta cadeia** — usa `calcularProforma` (o Preliminar
puro), nunca `proformaAvancado` nem `fundingDoEstudo`.

> ⚠️ **`frontend/tela-dashboard.ts` SAIU da lista com a #426/#529.** Numa vistoria anterior da
> issue #474 (contra `85e6d617`) ele constava como sexto consumidor, citando linhas onde chamava
> `fundingDoEstudo`. A proforma do Avançado ficou desalavancada nesse meio-tempo (`proformaAvancado`
> não recebe mais `funding`), e o Painel de estudos passou a ler só `proformaAvancado(c, area)` —
> sem funding, sem `fluxoAcumulado[...]` direto. Reintroduzir a chamada reabriria a lista para seis;
> não faça isso sem atualizar esta seção e o teste de inventário junto.

### 9.3 A consequência de não unificar — declarada

Enquanto a montagem for por consumidor, todo conserto local (ex.: a correção de sinal do funding
da #426) resolve **um** sintoma sem tocar os outros — as superfícies continuam podendo divergir
entre si, e nada impede que a **próxima tela** que alguém escrever crie mais uma definição
concorrente. O app aceita esse risco **por decisão, não por descuido**: a fonte única
(`estadoFinanceiroDoEstudo`, que executaria os Passos 23–25 uma vez só e devolveria um objeto que
os consumidores apenas leem) foi desenhada, revisada e **recusada** pelo autor em D-Q03. Os rótulos
que ajudam o usuário a distinguir as definições concorrentes (não a eliminá-las) são a #443.

**Contraponto da EVI (consultivo, não normativo):** na planilha do autor, o resultado é montado
**uma vez só** (`Premissas e Resultados!P39 = SUBTOTAL(9;P8:P33)`), e os outros dois fechos
(`P37`, `P35`) são **derivados** dele — a alternativa que o app recusou é o que o próprio oráculo
pratica. Registrar isso é mais honesto que registrar só a decisão do app, e é o tipo de frase que
poupa a próxima auditoria de "redescobrir" o assunto.

---
titulo: Fluxo do Investidor — fórmulas das operações de Funding
descricao: Transcrição integral da planilha fluxo_investidor_FORMULAS (abas divida e equity), que especifica as operações de Financiamento à produção, Dívida e Equity do estudo Avançado — entradas, fórmulas mês a mês, indicadores e o exemplo numérico de referência.
tipo: app
ordem: 9
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Fluxo do Investidor — fórmulas das operações de Funding

> ✅ **Este documento é a ESPECIFICAÇÃO** do modelo de Funding reescrito pela issue #355
> (Rodada 7, item 48). Ele transcreve a planilha `fluxo_investidor_FORMULAS.xlsx`, entregue pelo
> autor em 2026-08-11.

## Por que esta transcrição existe

A issue #355 ficou **formalmente bloqueada por uma rodada inteira** (decisão D6) porque a planilha
que a especifica não estava no repositório — existia só na máquina do autor. Sem ela não havia como
definir campos de entrada nem fórmulas com a precisão que o resto da rodada manteve.

Este arquivo existe para que isso não se repita: **a spec passa a viver no repo**. Se a planilha e
este documento divergirem, vale a regra geral do `CLAUDE.md` — o código e o `schema.json` são a
fonte de verdade do comportamento vigente, e a divergência vira issue.

A planilha tem duas abas, `divida` e `equity`, e ambas raciocinam em **visão do investidor**:
desembolso negativo, recebimento positivo. O projeto enxerga o sinal trocado (ver § Convenção de
sinal).

---

## 1. Aba `divida` — Financiamento à produção e Dívida

As duas operações de dívida compartilham esta matemática; diferem só na cardinalidade
(Financiamento à produção é **único por estudo**, Dívida é livre).

### 1.1 Entradas

| Célula | Campo | Exemplo |
|---|---|---|
| `C8` | Valor da operação (R$) | 10.000.000 |
| `C9` | Mês do aporte | 1 |
| `C10` | Distribuir aporte? (booleano) | TRUE |
| `C11` | Aporte em quantos meses | 3 |
| `C12` | Taxa anual | 20% |
| `C13` | Período de amortização (meses) | 36 |
| `C14` | Período de carência (meses) | 12 |

### 1.2 Derivados

```
C15 (taxa mensal equivalente) = (1 + C12)^(1/12) − 1
```

Taxa **composta**, não linear — corresponde a `taxaMensalEquivalente()` no motor.

```
C16 (PMT) = SE(C13 <= C14;  0;
            PMT(C15;  C13 − C14;
                SE(C10;  C8/C11 * ((1 + C15)^C11 − 1) / C15  ;  C8)))
```

> ⚠️ **A base do PMT não é `C8` quando o aporte é distribuído.** É o *valor futuro* das parcelas
> liberadas, capitalizado até o fim do período de liberação:
> `C8/C11 × ((1+i)^C11 − 1)/i`. A razão é que durante a liberação não há pagamento (a coluna E vale
> zero antes de `ini`), mas os juros já correm e capitalizam no saldo. Usar `C8` cru subestimaria a
> parcela e deixaria saldo residual no fim.
>
> O prazo do PMT é `C13 − C14` — a amortização desconta a carência.

Duas âncoras usadas por todas as colunas:

```
ini = C9 + SE(C10; C11; 1)      // 1º mês de carência/amortização
fim = ini − 1 + C13             // último mês da operação (quitação)
```

Com o exemplo: `ini = 1 + 3 = 4` e `fim = 4 − 1 + 36 = 39`.

### 1.3 Colunas mensais

`_ant` = valor da mesma coluna no mês anterior.

| Col | Nome | Fórmula (mês `t`) |
|---|---|---|
| A | Mês | `1, 2, 3, …` |
| B | Libera | `SE(C10; SE(C9 <= t <= C9+C11−1; C8/C11; 0); SE(t = C9; C8; 0))` |
| C | Carência | `1` se `ini <= t <= ini + C14 − 1`, senão `0` |
| D | Juros | `t = 1 → 0`; senão `SE(t <= fim; F_ant * C15; 0)` |
| E | PMT | ver abaixo |
| F | Saldo devedor | `MAX(0; ARRED(F_ant + B + D − E; 2))` |
| G | Fluxo investidor | `E − B` |

A coluna E, aberta:

```
E = 0                              se t < ini  ou  t > fim
  = F_ant + B + D                  se t = fim            (quitação total)
  = MIN(D; F_ant + B + D)          se C = 1              (carência: só juros)
  = MIN(C16; F_ant + B + D)        caso contrário        (parcela normal)
```

No primeiro mês (`t = 1`) não há `F_ant`: as fórmulas usam `B + D` no lugar de `F_ant + B + D`, e
`D = 0` por definição.

O `MIN(...)` em todos os ramos garante que nunca se pague mais do que o saldo devido — é o que faz
a operação encerrar exatamente em zero.

### 1.4 Indicadores

| Indicador | Fórmula |
|---|---|
| Investimento total (desembolso) | `−Σ B` |
| Retorno total recebido (PMT) | `Σ E` |
| Fluxo total / Caixa final | `Σ G` |
| Juros pagos | `Σ D` |
| Saldo final | `F` no mês `fim` (deve ser 0) |
| TIR mensal | `IRR(G)` |
| TIR anual | `(1 + TIR mensal)^12 − 1` |
| VPL | `NPV(taxa; G)` — ver § Divergências deliberadas |

---

## 2. Aba `equity`

### 2.1 Premissas do projeto (`C4`–`C19`)

A planilha redigita as premissas porque é um simulador isolado: VGV, duração, mês de lançamento,
duração da obra, mês do repasse (`= C6 + C7`), % entrada / parcelas / pós-chaves, % repasse
(`= 1 − C9 − C10 − C11`, derivado), % corretagem / MKT / impostos, Receita Líquida Total
(`= C4 × (1 − deduções)`) e Resultado Final (`= C18 − Despesa Total`).

> **No app, nada disso é redigitado.** Todas essas grandezas já são calculadas por `calcularFluxo`
> (`FluxoCalc`), pelo Cronograma e pela aba de Custos. Ver § Divergências deliberadas (D8).

### 2.2 Entradas da operação

| Célula | Campo | Exemplo |
|---|---|---|
| `C22` | Valor do aporte (R$) | 5.000.000 |
| `C23` | Mês do aporte | 1 |
| `C24` | Modo de retorno (booleano) | TRUE |
| `C25` | % de retorno | 4% |

O modo (`C24`) escolhe entre duas remunerações mutuamente exclusivas:

- **TRUE — permuta financeira:** `C25` incide sobre a **Receita Líquida mensal**, mês a mês,
  progressivamente, enquanto houver receita.
- **FALSE — % do Resultado Final:** `C25` incide sobre o **Resultado Final do projeto** e é pago de
  uma só vez, no mês do repasse.

### 2.3 Colunas mensais

| Col | Nome | Fórmula (mês `t`) |
|---|---|---|
| B | Receita bruta mensal | `0` se `t > C5`; `C4*C9` se `t = C6`; `C4*C10/MAX(1; C7−1)` se `C6 < t < C8`; `C4*C12` se `t = C8`; `C4*C11/MAX(1; C5−C8)` se `t > C8` |
| C | Receita líquida mensal | `B × (1 − C15 − C16 − C17)` |
| D | Retorno equity | `SE(C24;  C × C25;  SE(t = C8;  C19 × C25;  0))` |
| E | Aporte | `SE(t = C23; C22; 0)` |
| F | Fluxo investidor | `D − E` |
| G | Caixa acumulado | `G_ant + F` |

A coluna B é a curva de recebimento bruto: entrada no lançamento, parcelas diluídas durante a obra,
repasse na entrega das chaves, e vendas pós-chaves rateadas no restante do prazo. Ela conserva o
VGV — `Σ B = C4`, confirmado no exemplo (§4).

### 2.4 Indicadores

| Indicador | Fórmula |
|---|---|
| Investimento total (desembolso) | `−Σ E` |
| Retorno total recebido | `Σ D` |
| Caixa final | último `G` |
| Lucro do investidor | `Σ D − Σ E` |
| TIR mensal | `IRR(F)` |
| VPL | `NPV(taxa; F)` |
| Payback | primeiro mês com `G > 0` |

---

## 3. Convenção de sinal

A planilha é **visão do investidor**; a tabela de Resultados do app é **visão do projeto**:

```
projeto.entradas[t] = liberação da dívida (B)  +  aporte de equity (E)
projeto.saidas[t]   = PMT pago (E da dívida)   +  retorno pago ao equity (D)

fluxoInvestidor[t]  = − (entradas[t] − saidas[t])        por operação
```

Os indicadores das §1.4 e §2.4 são, portanto, **do investidor** — TIR, VPL e Payback de quem põe o
dinheiro, não do projeto. O projeto mantém seus próprios KPIs **desalavancados**, conforme
`funding-capital-stack.md` §8.1.

---

## 4. Exemplo numérico de referência (golden case)

Os valores abaixo saíram da própria planilha e são reproduzidos pelos testes do motor.

### 4.1 Dívida

Entradas: valor 10.000.000 · mês do aporte 1 · distribuir em 3 meses · 20% a.a. · amortização 36 ·
carência 12.

| Grandeza | Valor |
|---|---|
| Taxa mensal equivalente | `0,015309470499731193` |
| PMT | `508.746,97518660501` |
| Investimento total | `−10.000.000` |
| Retorno total recebido (Σ PMT) | `14.075.333,009917879` |
| Fluxo total / Caixa final | `4.075.333,0099178748` |
| Juros pagos | `4.075.332,9857015153` |
| Saldo final (mês 39) | `0` |
| TIR mensal | `0,015309470578088513` |
| TIR anual | `0,20000000111133076` |

> A TIR anual bate com a taxa contratada (20%) — é a verificação de sanidade da operação: um
> empréstimo precificado à própria taxa rende exatamente ela.

### 4.2 Equity

Entradas: VGV 200.000.000 · duração 36 · lançamento no mês 2 · obra até as chaves 30 meses ·
repasse no mês 32 · 20% entrada / 30% parcelas / 0% pós-chaves / 50% repasse (derivado) ·
corretagem 5% · MKT 3% · impostos 6% · aporte 5.000.000 no mês 1 · modo TRUE · retorno 4%.

| Grandeza | Valor |
|---|---|
| Receita líquida total | `171.999.999,99999997` |
| Resultado final do projeto | `166.999.999,99999997` |
| Investimento total | `−5.000.000` |
| Retorno total recebido | `6.879.999,9999999981` |
| Caixa final | `1.879.999,9999999972` |
| Lucro do investidor | `1.879.999,9999999981` |
| TIR mensal | `0,016823843299068608` |
| Payback | mês **32** |

### 4.3 Invariantes que o exemplo confirma

- `Σ receita bruta mensal = VGV` → `199.999.999,99999994 ≈ 200.000.000` ✓
- `Σ PMT − Σ liberado = Σ juros` → `14.075.333,01 − 10.000.000 ≈ 4.075.333,00` ✓
- `saldo devedor = 0` ao fim da amortização ✓

---

## 5. Divergências deliberadas entre a planilha e o app

A planilha é um simulador isolado; o app tem um modelo de projeto completo. Onde as duas divergem, o
app segue as decisões abaixo, registradas na issue #355 como **D8**–**D14**.

| # | Planilha | App | Motivo |
|---|---|---|---|
| **D8** | Redigita as premissas do projeto (VGV, %, deduções, prazos) | **Deriva do estudo** — `receitaMensal` e `fluxoAcumulado` do `FluxoCalc`, mês do repasse do Cronograma | Redigitar criaria uma segunda fonte de verdade, que divergiria em silêncio da aba Resultados |
| **D9** | `NPV(0,1; série mensal)` — 10% **ao mês** (≈214% a.a.) | Usa a `taxaDescontoAa` do estudo, convertida a mês | 10% ao mês produz VPL fortemente negativo numa operação que rende 20% a.a. — número impossível de explicar na tela |
| **D10** | Payback exibe **59**; o caixa vira positivo no mês **32** (`MATCH(...)+28−1` soma o deslocamento da linha à resposta) | Primeiro mês com acumulado ≥ 0 | Defeito de planilha, não regra de negócio |
| **D11** | "Mês do aporte" é número absoluto | Âncora de Cronograma + deslocamento, como em Custos | Número absoluto quebra quando o Cronograma muda; âncora acompanha |
| **D12** | Um só modelo de dívida | Mesma matemática para Financiamento à produção e Dívida; muda só a cardinalidade | É o que a planilha suporta. Liberação atrelada à curva da obra não está especificada nela |
| **D14** | Pagamento capado pelo **saldo devedor**, nunca pelo caixa do projeto | Idem — mas a Reconciliação passa a **alertar** quando o acumulado após funding fica negativo | Implementar o que foi pedido e tornar o risco visível, em vez de bloquear em silêncio |

### O que a simplificação removeu

O modelo desta planilha trata cada operação como **independente**: sem waterfall, sem prioridades,
sem competição por caixa. Saíram, em relação ao modelo anterior (documentado em
`funding-capital-stack.md` §4–§7): o waterfall de 8 passos, `prioridade_funding` /
`prioridade_pagamento`, liberação automática por lacuna de caixa, `reservaMinima`, os 4 modos de
Preferred Equity (A/B/C/D) e as políticas `cash_sweep` / `bullet`.

---

## Veja também

- `funding-capital-stack.md` — princípios que sobrevivem à reescrita (§2.1 projeto × capital,
  §2.2 funding nunca integra o VGV, §8.1 TIR/VPL do projeto permanecem desalavancados)
- `formulas.md` — convenções de cálculo do app
- `modelo-de-dados.md` — tabelas do estudo Avançado

# A3 — Regras pela lente funding / investidor

> Rodada 8, agente **A3**. Lente: **o lado do capital** — financiamento à construção, dívida,
> equity, capital de giro e empréstimos. Pergunta: *que regras o app precisa ter para representar
> corretamente como o projeto é financiado?*
>
> Este documento **especifica**. Nenhuma linha de código foi alterada.
> Base: `main` @ `475dd24`, branch `claude/rodada-8-auditoria`, `manifesto.json` `versao 0.1.28`.

---

## 0. Método e evidência

| O que fiz | Como |
|---|---|
| Li `fluxo_investidor_FORMULAS.xlsx` **célula a célula, extraindo `<f>`** | parser do §3 do dossiê, com resolução de **fórmula compartilhada** (`<f t="shared" si="N">`) — sem isso 90% das linhas voltam vazias |
| Confrontei com `docs/viabilidade/fluxo-investidor-formulas.md` | leitura integral, 242 linhas |
| Confrontei com o código | `frontend/funding-motor.ts`, `backend/rotas/funding.ts`, `frontend/tela-funding.ts`, `schema.json`, `migracoes/029` |
| **Rodei o motor headless** contra o cenário da planilha | `node --import tsx/esm` sobre `simularDivida`/`simularEquity`/`indicadoresOperacao` — os números abaixo são medidos, não deduzidos |

**O que NÃO consegui rodar:** `bash scripts/validar-backend.sh` — o `@urbiverso/sdk` neste ambiente é
stub (sem `dist/`), e o script aborta no portão do SDK (etapa 1/5). Nada de backend/schema/migração
deste documento está typechecado. *"Não deu para rodar" não é "passou".*

---

## 1. Conferência planilha × doc × código

### 1.0 Antes da tabela: a planilha `divida` **é a planilha do Capital de Giro**

Achado que reorganiza o resto do documento. As células de rótulo da aba `divida` são:

```
A8  = "Valor CG (R$):"          B18 = "Libera CG"      C18 = "Carencia CG"
```

Ou seja: **o instrumento que o autor especificou na aba `divida` é o Capital de Giro dele.** A #355
o implementou com o nome `divida`, e a migração `029` diz isso explicitamente
(`migracoes/029_funding_operacoes.js:38-43`): *"CAPITAL DE GIRO (`capital_giro`) converte SEM PERDA
para `divida`: os dois modelos têm exatamente os mesmos parâmetros"*.

Cruzando com o que os dois documentos de negócio **exigem** de um capital de giro:

| Exigido | Fonte | `divida` tem? |
|---|---|---|
| mês de entrada | `padrao-incorporacao.md:1823` | ✅ `inicio_mes` + âncora |
| valor | `:1824` | ✅ `valor` |
| taxa | `:1825` | ✅ `taxa_anual` |
| prazo | `:1826` | ✅ `periodo_amortizacao_meses` |
| carência | `:1827` | ✅ `periodo_carencia_meses` |
| regra de remuneração | `:1828` | ✅ Price sobre taxa mensal equivalente |
| pagamentos | `:1829` | ✅ série `saidas` |
| saldo final | `:1830` | ✅ série `saldo` + `indicadoresOperacao.saldoFinal` |
| volume · mês de tomada · taxa a.a. · carência · prazo total · saldo devedor | `inteligencia-evi-incorporacao.md:1886-1891` | ✅ os seis |
| `fim do CG = mês da tomada + prazo total` | `inteligencia-evi-incorporacao.md:1400` | ✅ `fim = ini − 1 + amort` (`funding-motor.ts:262`) |

**Conclusão:** a lacuna nº 2 do dossiê ("Capital de giro / linha rotativa / empréstimo-ponte:
AUSENTE") está **meio certa e meio errada**, e a distinção muda o desenho:

- ❌ **Errado** dizer que capital de giro não existe: o CG *da planilha do autor* e o CG *do padrão
  funcional* estão os dois inteiramente cobertos por `divida`. O que falta é **vocabulário**, não
  matemática.
- ✅ **Certo** dizer que falta a **linha rotativa**: o que `divida` não faz — e nenhum tipo faz — é
  *sacar por necessidade de caixa*, *repagar por sobra de caixa* e *voltar a sacar*. Isso é o que
  `funding-capital-stack.md:501-517` (§4.4) chamava de "modo de liberação automático por lacuna",
  e foi **deliberadamente apagado** pela #355.

Trato as duas separadamente: **R-A31** (vocabulário, custo zero) e **R-A310/R-A311** (linha rotativa,
tipo novo). Não misturo, porque a primeira é rótulo e a segunda é motor.

### 1.1 Aba `divida` — fórmula a fórmula

Notação: `t` 1-based na planilha, 0-based no app; `ini = C9 + SE(C10; C11; 1)`, `fim = ini − 1 + C13`.

| Célula / coluna | A planilha diz | O doc diz | O código faz | Veredito |
|---|---|---|---|---|
| `C15` taxa mensal | `(1+C12)^(1/12)−1` | idem, §4.1 | `taxaMensalEquivalente` `:70-72` | ✅ **fiel** |
| `C16` PMT | `SE(C13<=C14;0; −PMT(C15; C13−C14; SE(C10; C8/C11*((1+C15)^C11−1)/C15; C8)))` | idem, §4.1, com a nota do valor futuro das tranches | `:275-279` — inclusive o ramo `i=0` (`distribuir && i > 0 ? FV : valor`, espelha o `SE(C15=0;C8;…)`) | ✅ **fiel** |
| `B` libera | `SE(C10; SE(C9<=t<=C9+C11−1; C8/C11;0); SE(t=C9;C8;0))` | idem | `:283-285` | ✅ **fiel** |
| `C` carência | `1` se `ini<=t<=ini+C14−1` | idem | `:293` (`t <= ini + carencia − 1` dentro do ramo `t>=ini`) | ✅ **fiel** |
| `D` juros | `D19 = 0` literal; `D20+ = SE(t<=fim; F_ant*C15; 0)` | *"t=1 → 0; senão SE(t<=fim; saldo_ant*C15;0)"* | `:287` `t <= fim ? saldoAnt*i : 0` — em `t=0` o `saldoAnt` é 0, dá o mesmo | ✅ **fiel** (equivalente, não idêntico — está certo) |
| `E` PMT | `0` fora da janela · `saldo_ant+B+D` em `t=fim` · `MIN(D;devido)` na carência · `MIN(C16;devido)` | idem | `:290-293` | ✅ **fiel** |
| `F` saldo | `MAX(0; ARRED(saldo_ant+B+D−E; 2))` | idem | `:298` | ✅ **fiel** |
| `G` fluxo investidor | `E−B` (sem arredondar) | idem | `:307` `round2(saidas − entradas)` sobre valores já arredondados | 🟡 **divergência de centavos, documentada** (§3 do doc) |
| `C69` investimento | `−SOMA(B)` | §5 | `:491` | ✅ |
| `C70` retorno | `SOMA(E)` | §5 | `:492` | ✅ |
| `C73` juros pagos | `SOMA(D)` | §5 | `:493` | ✅ |
| `C74` saldo final | `ÍNDICE(F; CORRESP(fim; A; 0))` — o saldo **no mês da quitação** | §5 diz só "saldo final" | `:508` `s.saldo[último]` | 🟡 **equivalente quando `fim < horizonte`**, divergente quando não — ver **R-A33** |
| `C76/C78` TIR | `TIR(G)` · `(1+C76)^12−1` | §5 | `tirMensal`/`tirAnual` `:87-113` (bisseção) | ✅ |
| `C77` VPL | `VPL(0,1; G)` — 10% **ao mês** | **D9**, divergência deliberada | `vplFluxo(fluxoInvestidor, taxaDescontoAa)` `:509` | ✅ **divergência declarada** |

**Verificação numérica** (rodei `simularDivida` com o cenário da planilha: 10M · 20% a.a. · 3 tranches
· carência 12 · amortização 36 · horizonte 48):

| Grandeza | Planilha (`<v>`) | Motor (medido) | Δ |
|---|---|---|---|
| `F` mês 1/2/3 | `3.333.333,33` · `6.717.698,23` · `10.153.875,97` | idênticos | **0** |
| `D` mês 2/3/4 | `51.031,568…` · `102.844,402…` · `155.450,464…` | `51.031,57` · `102.844,40` · `155.450,46` | arred. |
| `E` mês 4 (1ª carência) | `155.450,464…` | `155.450,46` | arred. |
| `C70` retorno total | `14.075.333,009917879` | `14.075.333,07` | **+0,06** |
| `C73` juros pagos | `4.075.332,9857015153` | `4.075.332,90` | **−0,09** |
| `C76` TIR mensal | `0,015309470578088513` | `0,015309470774664` | **2·10⁻¹⁰** |
| `C74` saldo em `fim` (mês 39) | `0` | `0` | **0** |

**Veredito da aba `divida`: o código reproduz a planilha mês a mês.** Os desvios são exclusivamente
o arredondamento a 2 casas que o `CLAUDE.md` obriga, e estão dentro do que a §3 do doc já declara.

### 1.2 Aba `equity` — fórmula a fórmula

| Célula / coluna | A planilha diz | O doc diz | O código faz | Veredito |
|---|---|---|---|---|
| `C8` mês do repasse | `C6 + C7` (lançamento + duração da obra) | §4.2 usa `C8` sem redefinir | `mesRepasse` = `marcosObra().mesEntrega + 1` (`fluxo-shared.ts:624-627`) | 🟡 **coincide por um acaso de convenção** — ver **R-A34** |
| `C12` % repasse | `1−C9−C10−C11` (derivado) | idem | não existe: **D8**, a curva vem de `calcularFluxo` | ✅ decisão declarada |
| `C18` receita líquida | `C4*(1−C15−C16−C17)` = bruta − corretagem − **marketing** − impostos | §4.2 transcreve `(1−C15−C16−C17)` **sem ressalva** | `receitaLiquidaComCorretagemMensal` (`:58-67`) = bruta − impostos − corretagem − permuta física, **sem marketing** | 🔴 **DIVERGENTE e NÃO DOCUMENTADA** — ver **R-A35** |
| `C19` resultado final | `C18 − divida!C5` | §4.2 sob D8 | `calc.fluxoAcumulado[último]` (`tela-fluxo-ver.ts:155`, `tela-funding.ts:206`, `tela-cenarios.ts:229`) | 🟡 base diferente (fluxo livre acumulado × receita líquida − despesa) — ver **R-A36** |
| `B` receita bruta | 5 ramos por mês | idem | não existe (D8) | ✅ |
| `C` receita líquida | `B*(1−C15−C16−C17)` — **sempre ≥ 0**, porque `B ≥ 0` | idem | série do estudo, **pode ser negativa** | 🔴 ver **R-A35** |
| `D` retorno | `SE(C24; C*C25; SE(t=C8; C19*C25; 0))` | idem | `:441` / `:443` | 🔴 falta o `máximo(0; …)` do §6.2 — **R-A35** |
| `E` aporte | `SE(t=C23; C22; 0)` | idem | `:439` | ✅ |
| `F` fluxo investidor | `D−E` | idem | `:447` | ✅ |
| `G` caixa acumulado | `G_ant+F` | idem | `indicadoresOperacao:495-501` | ✅ |
| `C72` payback | `CORRESP(…)+28−1` → devolve **59** onde o caixa vira no mês **32** | **D10**, declarado erro de planilha | 1º mês com acumulado ≥ 0 | ✅ **divergência declarada — e a planilha é que está errada** |
| `C70/C71` TIR/VPL | idem `divida` | D9 | idem | ✅ |

**Verificação numérica** (golden do doc §6, reproduzido em `frontend/funding-motor.test.ts:155-170`):
retorno `6.880.000` ✓ · lucro `1.880.000` ✓ · TIR mensal `0,016823843299…` ✓ · payback índice `31`
(mês 32 da planilha) ✓.

⚠️ **Mas o golden reconstrói a receita líquida dentro do próprio teste**
(`funding-motor.test.ts:126-144`), com as deduções de 14% **incluindo marketing**. Ele prova que
`simularEquity` sabe multiplicar; ele **não prova** que a base que o app entrega em produção é a base
da planilha. É exatamente aí que mora a **R-A35**.

### 1.3 Financiamento à produção — a exceção

`simularFinanciamentoProducao` (`:312-410`) **não segue esta planilha** e não deve seguir. Confrontei
contra `funding-capital-stack.md` §4.3 (a única seção vigente daquele documento):

| Regra §4.3 | No código | Veredito |
|---|---|---|
| liberação incondicional contra medição de custo elegível | `:363-368` | ✅ |
| gatilho de exposição mínima sobre o custo incorrido | `:366` `pctIncorrido >= exposicaoMinima` | ✅ |
| catch-up retroativo na 1ª liberação | `:368` `alvo − liberadoAcum` | ✅ |
| janela de obra/chaves | `janelaLiberacaoDeMarcos` `:617-623` | ✅ |
| caixa e teto de amortização **sem** a liberação do próprio mês | `:349-356` (`dividaAmortizavel` e `caixaAntesFunding` congelados antes) | ✅ |
| cash sweep puro, sem prestação contratual | `:374-377` | ✅ |
| sem teto de crédito | `:337` `limiteContratado > 0 ? … : pctFinanciavel × custoTotal` | ✅ |
| **única por estudo** | `conflitoFinanciamentoUnico` (`backend/rotas/funding.ts:150-158`) | ✅ |

**Veredito: fiel à §4.3.** Não proponho tocar nele — exceto pelo problema de **ordem de simulação**
(**R-A38**), que não é da §4.3 e sim da costura.

### 1.4 Resumo dos vereditos

| # | Achado | Severidade |
|---|---|---|
| 1 | Aba `divida` reproduzida mês a mês pelo motor | ✅ fiel |
| 2 | Aba `equity`: aritmética fiel, **base de receita líquida divergente** (marketing) | 🔴 |
| 3 | Retorno de equity **não é capado em 0** — receita líquida negativa faz o investidor *pagar* ao projeto | 🔴 confirmado rodando |
| 4 | Soma de `pct_retorno` das operações de equity **sem teto de 100%** | 🟠 |
| 5 | `saldoFinal` lê o último mês do horizonte, não o mês da quitação | 🟡 |
| 6 | Capital de giro: já coberto por `divida`; falta **vocabulário** e a **linha rotativa** | 🟠 |
| 7 | `financiamento_producao` faz cash sweep contra o fluxo **desalavancado** — não enxerga `divida`/`equity` | 🔴 |
| 8 | Sem tarifas/estruturação/administração em nenhuma operação | 🟠 |

---

## 2. Regras

### R-A31 — Capital de giro tem que se chamar Capital de giro

**Veredito:** DIVERGENTE (vocabulário, não matemática)
**Fonte:** `fluxo_investidor_FORMULAS.xlsx!divida!A8` (`"Valor CG (R$):"`), `!B18` (`"Libera CG"`),
`!C18` (`"Carencia CG"`); `padrao-incorporacao.md:1820-1832`; `migracoes/029_funding_operacoes.js:38-43`
**No código hoje:** `frontend/tela-funding.ts:56` rotula o tipo apenas como `"Dívida"`;
`docs/viabilidade/fluxo-investidor-formulas.md:28` idem. O usuário que procura "capital de giro"
na aba Funding **não encontra**, e conclui que o app não tem — foi o que aconteceu com a lacuna nº 2
do próprio dossiê desta rodada.
**Regra proposta:** o tipo `divida` **deve** ser rotulado na UI como **"Dívida / Capital de giro"**,
com nota explicando que cobre capital de giro, empréstimo-ponte e qualquer dívida por calendário com
carência e Price. O identificador persistido (`tipo='divida'`) **não muda** — é rótulo, não schema.
O doc `fluxo-investidor-formulas.md` §1 e §4.1 devem registrar que a aba `divida` da planilha é a
folha de Capital de Giro do autor.
**Como verificar:** `grep -n "Capital de giro" frontend/tela-funding.ts` casa; nenhum teste de motor
muda; `versao` do manifesto **não** bumpa (não há migração).
**Custo/risco:** zero em cálculo. Rótulo em tela e em `docs/`.

---

### R-A32 — Retorno de equity nunca pode ser negativo

**Veredito:** DIVERGENTE — **confirmado rodando o motor**
**Fonte:** `!equity!C28` = `B28*(1−C15−C16−C17)` com `B28 ≥ 0` por construção (a curva de receita
bruta da planilha nunca é negativa) → `D28 = C28*C25 ≥ 0`. E, explicitamente,
`funding-capital-stack.md:576`: `participacao_receita_instrumento_t = percentual × máximo(0; receita_liquida_base_t)`.
**No código hoje:** `frontend/funding-motor.ts:441` — `saidas[t] = round2(n(receitaLiquidaMensal[t]) * pct)`.
Sem `Math.max(0, …)`. Medido:

```
simularEquity({pct_retorno:10}, [0, −50000, 100000], …) → saidas = [0, −5000, 10000]
```

Um `saidas` negativo significa que **o projeto recebe dinheiro do investidor a título de "retorno"** —
e entra assim na costura (`funding-motor.ts:753-757`, categoria de custo com sinal invertido) e no
fluxo alavancado. A situação é real: `receitaLiquidaComCorretagemMensal` subtrai a corretagem, que é
linha de custo com cronograma próprio (`fluxo-shared.ts:658` classifica corretagem como
`sem_cronograma`), então um mês de corretagem sem recebimento correspondente produz base negativa.
**Regra proposta:** o retorno de `equity` em modo `permuta_financeira` **deve** ser
`round2(max(0; receita_liquida_mensal_t) × pct)`. Base negativa num mês **não** gera crédito ao
projeto e **não** é compensada em meses seguintes — a planilha não tem esse mecanismo e inventá-lo
seria regra nova.
**Como verificar:** teste novo em `funding-motor.test.ts`:
`assert.ok(simularEquity(op, [0,−50000,100000],0,2,3).saidas.every(v => v >= 0))`. O golden
existente (`:155`) não muda: a curva dele nunca é negativa.
**Custo/risco:** muda número em estudo existente **apenas** nos meses de base negativa, e sempre no
sentido de aumentar o custo do funding (o crédito espúrio some). Estudos com receita líquida sempre
positiva ficam idênticos.

---

### R-A33 — `saldoFinal` é o saldo no mês da quitação, não no fim do horizonte

**Veredito:** DIVERGENTE (menor, mas induz a erro exatamente no caso que importa)
**Fonte:** `!divida!C74` = `ÍNDICE($F$19:$F$66; CORRESP($C$9+SE($C$10;$C$11;1)−1+$C$13; $A$19:$A$66; 0))`
— a planilha vai buscar o saldo **no mês `fim`**, deliberadamente, em vez de ler a última linha.
**No código hoje:** `frontend/funding-motor.ts:508` — `saldoFinal: round2(s.saldo[s.saldo.length−1] ?? 0)`.
Equivalente **enquanto `fim` couber no horizonte** (depois de `fim` o saldo é carregado inalterado em
0). Divergente quando não cabe: aí o app mostra o saldo **truncado no último mês do estudo**, que é
menor que o saldo real na data contratual de quitação.
**Regra proposta:** `indicadoresOperacao` **deve** expor, para operações de dívida por calendário,
o saldo no mês `fim` da operação, e **deve** marcar explicitamente quando `fim >= horizonte`
(`operacaoExcedeHorizonte: boolean`). O aviso da tela (`tela-funding.ts:488-491`) e a divergência
`DIVIDA_FINAL_NAO_ZERA` (`fluxo-invariantes.ts:355-360`) passam a ler essa flag em vez de inferir de
`saldoFinal ≠ 0`.
**Como verificar:** operação com `inicio_mes=0, amortizacao=36` num horizonte de 24 → hoje
`saldoFinal` mostra um número parcial; com a regra, `operacaoExcedeHorizonte === true` e `saldoFinal`
é o do mês 36 (ou `null`, se preferir não extrapolar — **pergunta P4**).
**Custo/risco:** nenhum em estudo cujo funding cabe no horizonte. Nos que não cabem, muda um KPI de
tela — nunca o fluxo.

---

### R-A34 — A definição de "mês do repasse" precisa estar escrita no doc de funding

**Veredito:** JÁ IMPLEMENTADA, mas **subdocumentada**
**Fonte:** `!equity!C8 = C6+C7` (lançamento + duração da obra, 1-based) e a nota já existente em
`frontend/fluxo-shared.ts:601-604`.
**No código hoje:** `mesRepasse(crono)` (`fluxo-shared.ts:624-627`) = `marcosObra().mesEntrega + 1`,
e `marcosObra().mesEntrega` = **último mês de obra** (`:612-613`), não o mês seguinte. As duas
convenções se cancelam: o resultado bate com a planilha no golden (índice 31 = mês 32).
**Regra proposta:** `docs/viabilidade/fluxo-investidor-formulas.md` §4.2 **deve** registrar, ao lado
da fórmula `C8`, que o app deriva o mês do repasse de `marcosObra().mesEntrega + 1` e **por que** o
"+1" existe apesar de o app usar a definição de entrega ≠ planilha. Sem isso, quem for consertar a
lacuna nº 15 do dossiê (as duas definições de entrega) vai "corrigir" o `+1` e **quebrar o equity**
em modo `resultado_final`.
**Como verificar:** teste de regressão `mesRepasse(crono com obra 2..31) === 31`, com comentário
apontando para `!equity!C8`.
**Custo/risco:** documentação. ⚠️ Esta regra é uma **trava** contra o conserto ingênuo da lacuna 15 —
quem mexer em `marcosObra` tem que mexer nos dois lados.

---

### R-A35 — Uma base única e declarada de "receita líquida" para o equity

**Veredito:** DIVERGENTE — e é a **única divergência planilha × código que o doc não declara**
**Fonte:** `!equity!C15` corretagem 5% · `!C16` **marketing 3%** · `!C17` impostos 6% →
`!C18 = C4*(1−C15−C16−C17)`. O doc transcreve essa fórmula literalmente
(`fluxo-investidor-formulas.md:133`: `C — Receita líquida | B * (1 − C15 − C16 − C17)`).
**No código hoje:** `frontend/funding-motor.ts:58-67` — `receitaLiquidaComCorretagemMensal` =
`receitaMensal − corretagem`, onde `receitaMensal` já é líquida de RET e permuta financeira (#228).
**Marketing não entra.** O comentário `:51-57` ancora isso no
`funding-capital-stack.md:565-577` §6.2, cuja definição é
`bruta − impostos − corretagem − permuta_financeira` — **sem marketing**, de propósito.

Então há **duas especificações vigentes que se contradizem**, e o documento marcado "comportamento
vigente" transcreve a que o código **não** segue. Consequência concreta com o golden do próprio doc:
sobre VGV 200M, marketing 3% = **R$ 6M de base a mais**; a 4%, são **R$ 240 mil de retorno a mais**
para o investidor do que a planilha calcula (13% acima dos R$ 1,88M de lucro do golden).

**Regra proposta:** `funding-motor.ts` **deve** ter **uma única** função `receitaLiquidaBaseMensal`,
com a composição **declarada em texto ao lado da assinatura**, e `docs/viabilidade/fluxo-investidor-formulas.md`
§4.2 **deve** citar essa composição em vez de transcrever `C15+C16+C17` como se fosse o que o app faz.
A escolha entre incluir ou não o marketing é do autor (**pergunta P1**); a regra que não é negociável
é: **a fórmula do doc e a do código têm que ser a mesma frase.**
**Como verificar:** teste que monta um estudo com marketing ≠ 0 e afirma a composição escolhida
célula a célula; e um guard de doc — o golden do §6 do doc passa a ser gerado a partir da função
real, não reconstruído à mão dentro do teste (`funding-motor.test.ts:126-144`).
**Custo/risco:** se o autor optar por **incluir marketing**, todo estudo com equity em
`permuta_financeira` e marketing > 0 **muda de número** — retorno menor, lucro do projeto maior.
É mudança de comportamento real e merece issue própria, com aviso na release.

---

### R-A36 — "Resultado final" do equity precisa de definição escrita

**Veredito:** DIVERGENTE (conceitual, sem prova de erro numérico)
**Fonte:** `!equity!C19 = C18 − divida!C5` — *receita líquida total menos despesa total*.
**No código hoje:** `resultadoFinal = calc.fluxoAcumulado[último]` em **três** lugares independentes:
`frontend/tela-fluxo-ver.ts:155`, `frontend/tela-funding.ts:206`, `frontend/tela-cenarios.ts:229`.
Isto é o **fluxo de caixa livre acumulado** ao fim do horizonte — que embute o *timing* dos
recebimentos e o horizonte escolhido, ao passo que o `C19` da planilha é um total econômico sem
tempo. Nos dois casos o número tende a coincidir quando o horizonte alcança o último evento
financeiro; divergem quando não alcança (lacuna nº 16 do `inteligencia-evi-incorporacao.md:1400-1416`:
o horizonte tem que cobrir o fim de todas as safras e do capital de giro).
**Regra proposta:** (a) a definição de `resultadoFinal` **deve** viver em **uma** função exportada de
`funding-motor.ts` (`resultadoFinalDoEstudo(calc)`), consumida pelas três telas — hoje são três
cópias que podem divergir uma a uma; (b) o doc §4.2 **deve** dizer qual das duas definições vale;
(c) quando o horizonte não cobrir o último evento financeiro, o modo `resultado_final` **deve**
emitir divergência `RESULTADO_FINAL_HORIZONTE_CURTO` (severidade `alerta`) na Reconciliação.
**Como verificar:** as três telas passam a importar a mesma função (grep); teste do alerta com
horizonte truncado.
**Custo/risco:** (a) e (c) são refatoração + alerta, sem mudar número. (b) pode mudar, se o autor
escolher a definição da planilha — **pergunta P2**.

---

### R-A37 — A soma dos percentuais de retorno de equity não pode passar de 100%

**Veredito:** AUSENTE
**Fonte:** `funding-capital-stack.md:578-579` — *"a soma das participações de receita **não pode
superar 100%**"*. A planilha não testa porque tem uma operação só.
**No código hoje:** `backend/rotas/funding.ts:65` — `CAMPOS_PERCENTUAL_0_100 = ['exposicao_minima',
'percentual_financiavel']`. **`pct_retorno` não está na lista**, e `CAMPOS_NAO_NEGATIVOS:60-63` só
barra negativo. Três investidores a 40% cada são aceitos sem uma palavra, e o motor paga 120% da
receita líquida como retorno, todo mês.
**Regra proposta:** (a) `pct_retorno` entra em `CAMPOS_PERCENTUAL_0_100`; (b) o POST/PATCH **deve**
recusar com `422 RETORNO_EXCEDE_RECEITA` quando `Σ pct_retorno` das operações `equity` em modo
`permuta_financeira` do estudo passar de 100 — a mesma forma do `conflitoFinanciamentoUnico`
(`:150-158`), incluindo o `ignorarId` do PATCH; (c) operações em modo `resultado_final` entram numa
**segunda** soma, também limitada a 100 (é % do resultado, não da receita — não competem pela mesma
base).
**Como verificar:** teste puro `somaRetornoExcede(existentes, novo, ignorarId)` em
`backend/rotas/funding.test.ts`, no molde dos que já existem em `:22-30`.
**Custo/risco:** só validação de entrada. Um estudo já configurado acima de 100% passa a recusar
edições até ser corrigido — comportamento desejado, mas precisa de mensagem clara.

---

### R-A38 — Cash sweep tem que enxergar o caixa que as outras operações produzem

**Veredito:** AUSENTE — e é o achado de maior impacto numérico deste documento
**Fonte:** `inteligencia-evi-incorporacao.md:1584-1592`, Passos 23–24: *"Processar o capital de giro
e outros instrumentos"* → *"fluxo final = fluxo de caixa livre **+ fluxos líquidos dos instrumentos
de funding**"*, no plural e numa ordem. `funding-capital-stack.md:158`: liberações de funding entram
no caixa financeiro.
**No código hoje:** `frontend/funding-motor.ts:726-737` simula **todas** as operações contra o mesmo
`fluxoLivreMensal` — o **desalavancado**. `simularFinanciamentoProducao` recebe esse array em `:732`
e o usa em `:356` para calcular `caixaAntesFunding`, que é o teto do cash sweep (`:374-377`).
Resultado: um aporte de equity de R$ 5M no mês 1 e um capital de giro de R$ 10M **não existem** para
o financiamento à produção — que amortiza como se aquele dinheiro nunca tivesse entrado no caixa,
e deixa de amortizar caixa que de fato existe. Simetricamente, as parcelas de uma `divida` não
consomem caixa aos olhos do sweep.

Isto **não é** o waterfall que a #355 apagou: não há prioridade, não há competição, não há fila. É
só a ordem de leitura do caixa, que os Passos 23–24 já descrevem.
**Regra proposta:** `fundingDoEstudo` **deve** simular em **duas passadas**:
1. **cegas ao caixa** — `divida`, `equity`, e a `linha_credito` em modo `programado`. Produzem
   `entradasCegas` / `saidasCegas`.
2. **dirigidas por caixa** — `financiamento_producao` e `linha_credito` em modo `necessidade`,
   contra `fluxoLivreMensal + entradasCegas − saidasCegas`.

A ordem **dentro** de cada passada continua irrelevante (as cegas não interagem). Se houver mais de
uma operação dirigida por caixa, elas são processadas na ordem de `ordem` e cada uma vê o caixa já
alterado pela anterior — **e isso precisa estar escrito**, porque é a única dependência de ordem que
o modelo passa a ter.
**Como verificar:** teste que monta `financiamento_producao` + `equity` com aporte grande num mês de
caixa apertado e afirma que a amortização do mês **aumenta**; o golden
`financiamento-producao-golden.test.ts` (80 períodos, cenário sem outras operações) **continua
passando byte a byte** — é o que prova que a mudança só toca o caso multi-operação.
**Custo/risco:** 🔴 **muda número em qualquer estudo que hoje tenha `financiamento_producao` junto
com `divida` ou `equity`.** Merece issue própria, separada da linha de crédito, e um aviso de release.
Não é conserto de arredondamento: é conserto de modelo.

---

### R-A39 — Tarifas e encargos das operações

**Veredito:** AUSENTE
**Fonte:** `funding-capital-stack.md:511-512` (premissas de capital de giro: *"… **taxas** · juros
pagos ou capitalizados …"*); lacuna nº 14 do dossiê.
**No código hoje:** nenhuma coluna de tarifa em `schema.json` →
`avancado_funding_operacoes.colunas` (18 colunas, nenhuma delas tarifa); nenhuma menção em
`funding-motor.ts`. O custo real de uma operação bancária brasileira — estruturação, taxa de
administração, avaliação/laudo, IOF — **não aparece em lugar nenhum**, o que faz a TIR do investidor
e o CET do projeto ficarem otimistas de forma sistemática.
**Regra proposta:** três colunas novas, aplicáveis aos **três** tipos de dívida:
`taxa_estruturacao_pct` (% sobre o valor/limite contratado, pago **uma vez**, no mês da 1ª
liberação), `taxa_administracao_mensal` (R$/mês enquanto houver saldo > 0) e
`outros_encargos_iniciais` (R$, mês da contratação). Todos entram em `saidas` — portanto **na TIR do
investidor e no fluxo alavancado** — e nunca no saldo devedor (tarifa não é principal, salvo
financiamento explícito da tarifa, que fica fora de escopo).
**Como verificar:** teste de conservação estendido: `Σ saidas = Σ entradas + Σ juros + Σ tarifas`.
**Custo/risco:** default `0` em todas → **nenhum estudo existente muda**. É adição pura.

---

### R-A310 — Linha de crédito rotativa: existe como conceito de negócio e não existe no app

**Veredito:** AUSENTE
**Fonte:** `funding-capital-stack.md:501-517` §4.4 (*"**Modos de liberação:** programado · **automático
por lacuna** · misto"*; *"capital de giro libera **por necessidade de caixa**, não por medição de
custo, e essa continua sendo a regra dele"*); `padrao-incorporacao.md:1820-1832`;
`inteligencia-evi-incorporacao.md:1584`.
**No código hoje:** `backend/rotas/funding.ts:43` aceita três tipos;
`backend/rotas/funding.test.ts:26` **testa que `capital_giro` é recusado**;
`frontend/funding-motor.ts:131` idem; `frontend/tela-funding.ts:54-58` idem. Não há saque por
necessidade, não há limite rotativo, não há repagamento por sobra de caixa. `divida` (§1.0) cobre o
CG **por calendário**; não cobre o rotativo.
**Regra proposta:** ver o desenho completo do **§3**.
**Como verificar:** §3.6.
**Custo/risco:** tipo novo, coluna nova, migração nova. Nenhum estudo existente muda — ninguém tem
operação do tipo novo até criar uma.

---

### R-A311 — Lacuna de funding volta como *diagnóstico*, nunca como waterfall

**Veredito:** AUSENTE (e deliberadamente removido)
**Fonte:** `funding-capital-stack.md:538-543` §5, passo 5: *"registrar **lacuna de funding** quando o
último instrumento não cobrir o déficit"*. A #355 apagou o §5 inteiro por ser waterfall.
**No código hoje:** `frontend/fluxo-invariantes.ts:332-376` `validarFunding` checa saldo negativo,
saldo final ≠ 0, reconciliação do fluxo e o **D14** (acumulado alavancado negativo). Não há nada
sobre demanda de caixa **não atendida**.
**Regra proposta:** quando existir `linha_credito` e o saque necessário for capado pelo limite,
`validarFunding` **deve** emitir `LACUNA_FUNDING` (severidade `alerta`, mesmo padrão do D14), com o
mês e o valor não coberto. **Não** existe fila, prioridade nem instrumento seguinte: é relatório, não
mecanismo. É a única parte do §5 que proponho recuperar, e só porque uma linha de crédito com limite
**precisa** dizer quando o limite acabou.
**Como verificar:** teste com déficit maior que o limite → uma divergência, com `mes` e `diferenca`
corretos; e o inverso (limite folgado) → zero divergências.
**Custo/risco:** só diagnóstico, um item por estudo (como o D14 em `:374-376`).

---

## 3. Desenho de Capital de Giro / Empréstimo

> Escopo: o que a **R-A310** abre. Reforço o §1.0 — o CG **por calendário** já existe como `divida`,
> e o que este desenho acrescenta é a **linha rotativa dirigida por caixa**. Chamo o tipo de
> `linha_credito` justamente para não colidir com o CG que já está entregue.

### 3.1 Modelo de dados

Tipo novo em `avancado_funding_operacoes` — **mesma tabela**, mesmo shape de 3 níveis
(rota → coluna → motor). Colunas reaproveitadas:

| Coluna existente | Papel em `linha_credito` |
|---|---|
| `estudo_id`, `tipo`, `nome`, `ordem` | idem |
| `valor` | **limite rotativo** contratado. `0` = sem limite |
| `cronograma_evento` / `fase_ancora_id` / `inicio_mes` | 1º mês de **disponibilidade** (âncora, D11 — igual às linhas de Custo) |
| `taxa_anual` | % a.a. sobre o **saldo utilizado** |
| `amortizar_com_caixa_disponivel` | liga/desliga o repagamento automático por sobra de caixa |

Colunas **novas** (todas com default que preserva o comportamento existente):

| Coluna | Tipo `schema.json` | Default | Papel |
|---|---|---|---|
| `modo_liberacao` | `texto`, limite 20, `opcoes: ['necessidade','programado']` | `'necessidade'` | `necessidade` = saca o que faltar para o caixa não furar; `programado` = saca `valor` no `inicio_mes` (aí é dívida cega ao caixa, e roda na 1ª passada da **R-A38**) |
| `disponibilidade_meses` | `inteiro` | `0` | por quantos meses a linha pode ser sacada a partir de `inicio_mes`. `0` = até o fim do horizonte |
| `prazo_total_meses` | `inteiro` | `0` | mês de **vencimento** relativo a `inicio_mes`; no vencimento o saldo é quitado integralmente. `0` = sem vencimento contratual (quita quando o caixa permitir) |
| `reserva_minima` | `decimal(15,2)` | `0` | caixa mínimo a manter. O saque cobre o déficit **até** deixar o caixa em `reserva_minima`; o repagamento só usa o que exceder |
| `juros_capitalizados` | `booleano` | `false` | `false` = juros pagos em caixa no mês; `true` = somados ao saldo |
| `taxa_estruturacao_pct` | `decimal(5,2)` | `0` | **R-A39** — vale para os 3 tipos de dívida |
| `taxa_administracao_mensal` | `decimal(15,2)` | `0` | **R-A39** |
| `outros_encargos_iniciais` | `decimal(15,2)` | `0` | **R-A39** |

Precisão conforme o `CLAUDE.md`: R$ → `decimal(15,2)` (o `valor` da tabela já é assim); % digitado
pelo usuário em campo de taxa segue o padrão vigente da tabela, `decimal(5,2)`.

### 3.2 Simulação (pseudocódigo)

Nova função `simularLinhaCredito`, **ao lado** de `simularDivida`, sem tocá-la:

```
função simularLinhaCredito(op, fluxoDisponivelMensal, prazo) -> SerieOperacao

  i         = taxaMensalEquivalente(op.taxa_anual / 100)
  m0        = max(0, floor(op.inicio_mes))
  fimSaque  = op.disponibilidade_meses > 0 ? m0 + op.disponibilidade_meses − 1 : prazo − 1
  venc      = op.prazo_total_meses     > 0 ? m0 + op.prazo_total_meses     − 1 : null
  limite    = op.valor > 0 ? op.valor : +∞
  reserva   = op.reserva_minima
  capitaliza= op.juros_capitalizados === true
  varrer    = op.amortizar_com_caixa_disponivel !== false

  saldoAnt = 0 ; caixaFechAnt = 0 ; lacuna = zeros(prazo)

  para t de 0 até prazo−1:

    # 1) juros sobre o saldo de ABERTURA — mesma convenção de simularDivida:287
    juros_t = saldoAnt * i

    # 2) encargos do contrato (R-A39). Estruturação e encargos iniciais só no
    #    mês da 1ª utilização; administração enquanto houver saldo.
    encargo_t = (t == mesPrimeiroSaque ? op.taxa_estruturacao_pct/100 * limiteBase
                                          + op.outros_encargos_iniciais : 0)
              + (saldoAnt > 0 ? op.taxa_administracao_mensal : 0)

    # 3) caixa ANTES desta operação — congelado, como financiamento_producao:356.
    #    Juros e encargos pagos em caixa saem aqui; capitalizados, não.
    saidaCaixa_t = encargo_t + (capitaliza ? 0 : juros_t)
    caixaAntes   = caixaFechAnt + fluxoDisponivelMensal[t] − saidaCaixa_t

    # 4) saque
    baseAntesSaque = saldoAnt + (capitaliza ? juros_t : 0)
    espaco   = max(0, limite − baseAntesSaque)          # rotativo: o repago volta a caber
    podeSacar= (t >= m0 e t <= fimSaque e (venc == null ou t < venc))

    se op.modo_liberacao == 'programado':
      saque_t = (t == m0) ? min(op.valor, espaco) : 0
    senão:
      deficit = max(0, reserva − caixaAntes)
      saque_t = podeSacar ? min(deficit, espaco) : 0
      lacuna[t] = podeSacar ? max(0, deficit − saque_t) : deficit   # R-A311

    base = baseAntesSaque + saque_t

    # 5) repagamento
    sobra   = max(0, caixaAntes + saque_t − reserva)
    amort_t = varrer ? min(base, sobra) : 0
    se venc != null e t == venc:
      amort_t = base                                    # quitação obrigatória; pode furar o caixa → D14

    saldo_t     = max(0, round2(base − amort_t))
    caixaFech   = caixaAntes + saque_t − amort_t

    entradas[t] = round2(saque_t)                       # o projeto RECEBE
    saidas[t]   = round2(amort_t + saidaCaixa_t)        # amortização + juros/encargos em caixa
    juros[t]    = round2(juros_t)
    saldo[t]    = saldo_t
    saldoAnt = saldo_t ; caixaFechAnt = caixaFech

  devolver { operacao: op, entradas, saidas,
             fluxoInvestidor: saidas − entradas,        # mesma convenção, funding-motor.ts:307
             juros, saldo, lacuna }
```

**Cinco decisões embutidas, e por que cada uma:**

1. **Juros sobre saldo de abertura** — idêntico a `simularDivida:287` e a
   `simularFinanciamentoProducao:349`. Uma terceira convenção de juros no mesmo motor seria uma
   armadilha permanente.
2. **Caixa congelado antes do saque** — a nota de `funding-motor.ts:354-356` (*"senão ela pagaria a
   si mesma"*) vale igual aqui, com o agravante do rotativo: sem congelar, saque e repago no mesmo
   mês entram em laço.
3. **Juros/encargos pagos em caixa entram em `saidas`** — em `simularDivida` os juros vão embutidos
   no PMT, então `saidas` já os cobre. Aqui, com `juros_capitalizados=false`, eles são pagamento
   separado; deixá-los fora quebraria a reconciliação `fluxoMensal = livre + entradas − saidas`
   que `validarFunding:361-372` verifica.
4. **Quitação no vencimento não é capada pelo caixa** — coerente com a **D14**: a planilha paga sem
   olhar caixa e o app **alerta** em vez de bloquear. Capar aqui e não no equity criaria duas
   filosofias no mesmo motor.
5. **`lacuna` não realimenta nada** — é série de diagnóstico da **R-A311**. Não existe "próximo
   instrumento".

### 3.3 Pontos de integração — `arquivo:linha`

| # | Arquivo:linha | Mudança |
|---|---|---|
| 1 | `frontend/funding-motor.ts:131` | `TipoOperacao` += `\| 'linha_credito'` |
| 2 | `frontend/funding-motor.ts:143-163` | `OperacaoFunding` += os 8 campos novos, opcionais |
| 3 | `frontend/funding-motor.ts:217-219` | `eDivida` += `'linha_credito'` — é dívida (tem `juros` e `saldo`), e é o que decide os rótulos `"liberações"/"parcelas"` em `:751-757` |
| 4 | `frontend/funding-motor.ts` (novo, após `:310`) | `simularLinhaCredito` |
| 5 | `frontend/funding-motor.ts:726-737` | **único ponto do fluxo que muda**: o despacho. Reescrito nas duas passadas da **R-A38** |
| 6 | `frontend/funding-motor.ts:680-684` | `TIPO_LABEL` += `linha_credito: 'Linha de crédito'` (`Record<TipoOperacao,…>` — o typecheck **exige** e é a rede de segurança do tipo novo) |
| 7 | `frontend/funding-motor.ts:204-212` | `SerieOperacao` += `lacuna?: number[]` |
| 8 | `backend/rotas/funding.ts:43` | `TIPOS_OPERACAO` += `'linha_credito'` |
| 9 | `backend/rotas/funding.ts:47-56` | `CAMPOS_OPERACAO` += os 8 campos (sem isso o POST/PATCH **descarta em silêncio**) |
| 10 | `backend/rotas/funding.ts:59-65` | `CAMPOS_NAO_NEGATIVOS` += `disponibilidade_meses`, `prazo_total_meses`, `reserva_minima`, `taxa_estruturacao_pct`, `taxa_administracao_mensal`, `outros_encargos_iniciais`; `CAMPOS_PERCENTUAL_0_100` += `taxa_estruturacao_pct` **e** `pct_retorno` (**R-A37**) |
| 11 | `backend/rotas/funding.ts:104-143` | `validarCamposOperacao` += `modo_liberacao` na lista fechada; `prazo_total_meses > 0 → prazo_total_meses >= disponibilidade_meses` |
| 12 | `frontend/tela-funding.ts:54-58` | `TIPOS` += `{ valor:'linha_credito', rotulo:'Linha de crédito (rotativa)', icone:'fa-solid fa-money-bill-transfer' }`; e `'divida'` vira `'Dívida / Capital de giro'` (**R-A31**) |
| 13 | `frontend/tela-funding.ts` (novo, ao lado de `_renderCamposEquity:433`) | `_renderCamposLinhaCredito` |
| 14 | `frontend/fluxo-invariantes.ts:332-376` | `LACUNA_FUNDING` (**R-A311**). As checagens de saldo já cobrem o tipo novo por construção |
| 15 | `schema.json` → `avancado_funding_operacoes` | `tipo.opcoes` += `'linha_credito'`; 8 colunas novas |
| 16 | `migracoes/030_linha_credito.js` | §3.4 |
| 17 | `manifesto.json` | `versao` `0.1.28` → **`0.1.29`** — migração nova **exige** bump |

**Não muda:** `FundingNoFluxo` (`:657-686`), `agregarFundingPorPeriodos` (`:814-839`),
`fluxo-tabela.ts`, `exportar.ts`, `proforma-avancado.ts`, `tela-cenarios.ts`, `tela-dashboard.ts`.
A costura da #349 é **agnóstica ao tipo** — é exatamente o que ela foi feita para ser, e é por isso
que este desenho cabe num despacho de uma linha.

⚠️ **Ordem entre os itens 5 e 17:** o item 5 embute a **R-A38**, que muda número em estudo existente.
Recomendo **duas issues**: uma só de R-A38 (com o golden de financiamento à produção como prova de
não-regressão) e outra da linha de crédito, dependente dela via `Sem-fechamento: #NNN pré-requisito`.

### 3.4 Esboço de migração

`migracoes/030_linha_credito.js` — numerada contra a `main` do momento (`029` é a última).
**Não há DDL** na camada de dados das migrações: as colunas nascem do `schema.json`, sincronizado
pelo SDK no ambiente do autor. A migração existe para **preencher os defaults em linha existente**,
e mais nada:

```js
// 030_linha_credito.js — Rodada 8, R-A310.
//
// Adiciona o tipo `linha_credito` e 8 colunas a `avancado_funding_operacoes`.
// As colunas em si vêm do schema.json (sincronizado pelo SDK); esta migração
// só garante que TODA linha existente tenha valor explícito nos campos novos,
// para o motor nunca ler `undefined` e cair em `Number(undefined) || 0` sem
// que ninguém tenha decidido isso.
//
// Idempotente: pula a linha que já tem `modo_liberacao` definido.
// Forward-only. NÃO cria operação nenhuma — seed fora de migração.

export default async function ({ dados }) {
  const { dados: ops } = await dados.listar('avancado_funding_operacoes', { por_pagina: 100000 });
  for (const op of ops) {
    if (op.modo_liberacao != null) continue;          // idempotência
    await dados.atualizar('avancado_funding_operacoes', op.id, {
      modo_liberacao:            'necessidade',
      disponibilidade_meses:     0,
      prazo_total_meses:         0,
      reserva_minima:            0,
      juros_capitalizados:       false,
      taxa_estruturacao_pct:     0,
      taxa_administracao_mensal: 0,
      outros_encargos_iniciais:  0,
    });
  }
}
```

Defaults escolhidos para **não mudar número em estudo nenhum**: taxas em `0`, sem vencimento, sem
reserva. Operações `divida`/`equity`/`financiamento_producao` existentes ficam idênticas.

O harness (`scripts/migracoes-harness.mjs`) exercita contrato do módulo, instalação virgem,
**reexecução** e a cadeia completa — a idempotência acima é o que faz a reexecução passar.

> ⚠️ Continua sendo do autor, no ambiente autenticado: sincronizar o `schema.json` pelo SDK, rodar
> `bash scripts/validar-backend.sh` (aqui aborta no portão do SDK) e executar a cadeia real no
> Postgres.

### 3.5 Tela

`_renderCamposLinhaCredito`, no molde de `_renderCamposEquity` (`tela-funding.ts:433-464`), com
`urbi-select`, `urbi-checkbox` e o `_num` que a tela já tem. Quatro blocos:

- **Linha** — limite (`valor`), âncora de disponibilidade (`_renderAncora`), `disponibilidade_meses`, `prazo_total_meses`.
- **Custo** — `taxa_anual`, `juros_capitalizados`, e os três campos da **R-A39**.
- **Política de caixa** — `modo_liberacao`, `reserva_minima`, `amortizar_com_caixa_disponivel`.
- **Diagnóstico** — série `lacuna` no mesmo formato do bloco `financiamentoProducao`
  (`funding-motor.ts:781-800`), quando houver lacuna.

O painel "visão do investidor" (`_renderIndicadores:466`) funciona **sem alteração**: lê
`indicadoresOperacao`, que é agnóstico ao tipo. Só primitivos `urbi-*` já usados nesta tela; tokens
CSS, nunca cor literal.

### 3.6 Como testar

`frontend/funding-motor.test.ts`, **sem oráculo de planilha** — não existe aba para este produto, e
inventar um "golden" seria fabricar autoridade. Em vez disso, **invariantes**:

| # | Teste | Afirma |
|---|---|---|
| 1 | conservação | `Σ saidas = Σ entradas + Σ juros + Σ encargos` (a identidade de `funding-capital-stack.md:470`, estendida) |
| 2 | caixa folgado | déficit nunca acontece → `entradas` todo zero, `saldo` todo zero, `lacuna` toda zero |
| 3 | rotatividade | déficit → saque → superávit → repago → **novo déficit → saca de novo**. É o teste que `simularDivida` **não** consegue passar, e portanto o que justifica o tipo novo |
| 4 | limite | `max(saldo) <= valor` para todo `t`, com `juros_capitalizados=false` |
| 5 | lacuna | déficit acima do limite → `lacuna[t] > 0` no mês certo, com o valor certo → uma divergência `LACUNA_FUNDING` |
| 6 | vencimento | `prazo_total_meses` definido → `saldo[venc] === 0`, mesmo com caixa insuficiente (e o D14 acusa) |
| 7 | reserva | `reserva_minima = X` → `caixaFechamento >= X` em todo mês em que houve limite disponível |
| 8 | modo programado | `modo_liberacao='programado'` com `disponibilidade_meses=1` e sem sweep produz série **idêntica** à de uma `divida` bullet equivalente — a ponte entre os dois tipos |
| 9 | não-regressão | `financiamento-producao-golden.test.ts` (80 períodos) **passa byte a byte** depois da **R-A38** |
| 10 | horizonte | operação que não cabe no horizonte → `DIVIDA_FINAL_NAO_ZERA` (já existe, `fluxo-invariantes.ts:355`) |

Backend, em `backend/rotas/funding.test.ts` (funções puras, sem servidor nem banco — é o padrão que o
arquivo já usa): `linha_credito` aceito; `modo_liberacao` fora da lista recusado;
`prazo_total_meses < disponibilidade_meses` recusado; `Σ pct_retorno > 100` recusado (**R-A37**).

> ⚠️ O glob de teste precisa continuar sendo `frontend/*.test.ts frontend/fixtures/*.test.ts` nos
> **dois** lugares (`package.json` e `scripts/validar-frontend.sh`) — foi assim que 16 golden cases
> ficaram meses sem rodar.

---

## 4. O que **não** proponho, e por quê

| Não proponho | Por quê |
|---|---|
| **Ressuscitar o waterfall de 8 passos** (`funding-capital-stack.md` §6) | A #355 o apagou por decisão do autor. A **R-A38** resolve o problema real (o sweep ver o caixa certo) **sem** fila, prioridade ou competição — são coisas diferentes, e confundi-las seria desfazer a decisão pela porta dos fundos. |
| **`prioridade_funding` / `prioridade_pagamento`** | Mesma decisão. O modelo novo é de operações independentes; a única dependência de ordem que a R-A38 introduz é entre operações **dirigidas por caixa**, e está declarada. |
| **Preferred equity com 4 modos, hurdle, preferred return, catch-up de sócio** | Apagado pela #355 (2 modos hoje). Reintroduzir sem pedido do autor é desfazer decisão — e é a lacuna nº 9 do dossiê, que continua sendo lacuna **por escolha**. |
| **Limitar pagamento de equity pelo caixa** | **D14 é consequência assumida**, documentada em `funding-motor.ts:419-423` e alertada em `fluxo-invariantes.ts:332-376`. Só o autor muda isso. A **R-A32** é outra coisa: não limita pelo caixa, só impede retorno **negativo** — que a planilha também não produz. |
| **Mexer em D9 (VPL) ou D10 (payback)** | Divergências deliberadas, documentadas em `funding-motor.ts:480-488` e no doc §5. A D10, aliás, corrige um **erro da planilha** (`MATCH+28−1` → 59 onde o mês é 32). |
| **Unificar as duas definições de "entrega"** | `fluxo-shared.ts:601-604` declara a divergência de 1 mês como deliberada. A **R-A34** vai no sentido oposto: **documentar a trava**, para que quem consertar a lacuna 15 não quebre o `mesRepasse` do equity. |
| **Alavancar TIR, payback e exposição máxima** | Decisão registrada em `funding-motor.ts:645-655` (§8.1): KPIs do projeto seguem desalavancadas; só o VPL do rodapé alavanca (`fluxo-tabela.ts:525`). É a lacuna nº 13 do dossiê, e é escolha, não esquecimento. |
| **Aplicar a matemática de calendário/Price ao `financiamento_producao`** | `fluxo-investidor-formulas.md:150-155` marca isso em vermelho: reverteria o modelo aprovado na #405. |
| **Fazer o backend calcular funding** | Todas as rotas são CRUD puro (§4.2 do dossiê). Mover cálculo para o backend é decisão de arquitetura, não item de rodada. |
| **Modelar inadimplência, distrato, securitização e antecipação de recebíveis** | Ausentes por decisão explícita do autor (`docs/issues-evi-propostas-2026-07-31.md:1057`). Todos afetam funding — a antecipação é literalmente um instrumento de capital —, mas não é minha decisão reabrir. |
| **Indexadores (INCC/IGPM/IPCA/CDI/TR) na dívida** | É a lacuna nº 3 do dossiê e vale para **todo** o motor, não só para funding. Resolver só dentro do funding criaria a terceira convenção de correção no mesmo app. |

---

## 5. Perguntas ao autor

**P1 — O marketing entra na base de retorno do equity?** (**R-A35**, 🔴 a mais importante)
Sua planilha deduz corretagem + **marketing** + impostos (`!equity!C15:C17`). O app deduz impostos +
corretagem + permuta física, **sem marketing**, seguindo o §6.2 do documento antigo — e o documento
que hoje se declara "comportamento vigente" transcreve a **sua** fórmula, não a do código. No golden
de VGV 200M, marketing 3% são R$ 6M de base e **R$ 240 mil de retorno a mais** para o investidor a
4%. Qual das duas vale? *(Incluir marketing muda número em todo estudo com equity progressivo e
marketing > 0.)*

**P2 — "Resultado final" é o seu `C18 − Despesa Total`, ou o fluxo de caixa livre acumulado?**
(**R-A36**) O app usa o segundo, em três lugares independentes
(`tela-fluxo-ver.ts:155`, `tela-funding.ts:206`, `tela-cenarios.ts:229`). Coincidem quando o
horizonte cobre o último evento financeiro; divergem quando não cobre.

**P3 — "Capital de giro" no app deve ser (a) só o rótulo novo da `Dívida` que já existe, (b) um tipo
rotativo novo, ou (c) os dois?** (§1.0, **R-A31**/**R-A310**) A sua própria planilha chama de "CG" o
que o app implementou como `divida` — os parâmetros são exatamente os que o padrão funcional pede.
O que genuinamente falta é o **rotativo**: sacar por necessidade de caixa, repagar por sobra e sacar
de novo. Minha recomendação é (c): o rótulo custa zero e resolve a confusão hoje; o rotativo é o
trabalho de verdade.

**P4 — Quando a dívida não cabe no horizonte, o app deve extrapolar o saldo até a data contratual de
quitação, ou marcar "não cabe" e parar?** (**R-A33**) Sua planilha busca o saldo no mês da quitação
(`!divida!C74`); o app lê o último mês do horizonte, que é um número parcial exibido sem ressalva.

**P5 — O cash sweep do financiamento à produção deve enxergar o caixa criado pelo equity e pelo
capital de giro?** (**R-A38**, 🔴 a de maior impacto numérico) Hoje **não enxerga**: todas as
operações são simuladas contra o mesmo fluxo desalavancado
(`funding-motor.ts:726-737`), então um aporte de R$ 5M no mês 1 não existe para o banco. Seus Passos
23–24 (`inteligencia-evi-incorporacao.md:1584-1592`) descrevem o oposto. Consertar **muda número em
qualquer estudo que combine financiamento à produção com dívida ou equity** — precisa da sua
autorização e de aviso de release.

**P6 — Tarifas bancárias entram no modelo?** (**R-A39**) Estruturação, taxa de administração, laudo,
IOF: hoje nenhum aparece, o que deixa a TIR do investidor e o custo efetivo do projeto
sistematicamente otimistas. Proponho três campos com default `0` — adição pura, nenhum estudo
existente muda.

**P7 — Um investidor pode receber mais de 100% da receita líquida?** (**R-A37**) Hoje pode: a rota
não soma os `pct_retorno` (`backend/rotas/funding.ts:65` não inclui o campo no teto de 100), e três
investidores a 40% pagam 120% da receita todo mês. Seu documento antigo dizia explicitamente que a
soma não pode passar de 100%.

---

## 6. O que este documento entrega para os outros agentes

- **Para A2 (EVI) e A4 (reconciliação):** a base de receita líquida do equity (**R-A35**) e a
  definição de resultado final (**R-A36**) atravessam as três lentes — se vocês chegarem a outra
  resposta pelo caminho de vocês, vira pergunta ao autor, não decisão.
- **Para A1 (issues):** as candidatas a issue nova, em ordem de risco:
  **R-A38** (🔴 muda número, precisa de autorização) · **R-A32** (🔴 defeito confirmado rodando) ·
  **R-A35** (🔴 doc e código dizem coisas diferentes) · **R-A37** (🟠 validação) ·
  **R-A310** + **R-A311** (🟠 feature, migração `030`, `versao` 0.1.29) · **R-A39** (🟠 adição pura) ·
  **R-A31** + **R-A34** (🟢 rótulo e documentação, custo zero) · **R-A33** (🟢 KPI de tela) ·
  **R-A36** (🟢 refatoração + alerta).
- **Para A5 (conferência numérica):** o cenário da planilha `divida` reproduz **mês a mês** no motor
  (§1.1). Se a instância divergir disso, a causa está na montagem do `FluxoConfig`, não no
  `funding-motor.ts`. E o `resultadoFinal` que o Funding consome é
  `calc.fluxoAcumulado[último]` — não é reconstruível pela API, que não serve fluxo.
- **Para A6 (UI):** `frontend/tela-funding.ts:56` diz só "Dívida" (**R-A31**), e
  `frontend/tela-fluxo-ver.ts:295` ainda fala em "**Capital Stack**", conceito apagado pela #355.

---

## 7. Convergência — issues emergentes (Rodada 2)

> Escrito depois do `10-digest-cruzado.md`. **Só material novo**: o que aparece no cruzamento e que
> nenhum agente veria sozinho. As regras do §2 não são repetidas.

> 🛑 **`linha_credito` ROTATIVO — RECUSADO PELO AUTOR (2026-08-22). Não ressuscitar.**
> O §3 inteiro deste documento (modelo de dados, pseudocódigo, migração `030`, bump para `0.1.29`)
> é **ADR histórico**: a análise que sustentou a recusa, **não** trabalho pendente. A decisão é que
> `divida` **já é** o produto de Capital de Giro por calendário — ver §1.0, onde a própria planilha
> do autor rotula a aba `divida` como "CG". **Não há migração `030`. Não há bump de `versao`.**
> Quem reabrir isto está desfazendo decisão do autor, não achando esquecimento.

**Nota de escopo — diretiva de fechamento.** Esta seção foi encerrada em uma passada. As duas
prioridades pedidas estão em **R-A314** (desempate com o B1 sobre a base negativa) e **R-A317**
(receita de teste do equity). Três achados ficam **registrados em aberto, sem investigação
adicional**, com a análise que já havia sido feita preservada inline:

- **R-A313** — cash sweep cego e as 4 margens do A5 têm a **mesma** causa (o estado financeiro do
  estudo é remontado por cinco consumidores independentes); **fica em aberto** porque é refatoração
  estrutural que não cabe numa rodada de especificação.
- **R-A316** — o teto de `Σ pct_retorno` **continua** sendo defeito depois da decisão nº 4 do autor
  (ela fixa a *composição da base*, não *quanto dela pode ser distribuído*); **fica em aberto**
  aguardando confirmação do autor de que 100% é o limite pretendido.
- **R-A318** — `avancado_capital_instrumentos` deve ser **mantida** (não há DDL na camada de
  migração; removê-la do `schema.json` deixaria uma tabela órfã inalcançável); **fica em aberto** a
  etiqueta `descricao` + guard que impedem seu reúso acidental.

### 7.0 Duas decisões do autor que fecham parte do §2 — registradas para ninguém "consertar" depois

| Decisão | O que fecha | Como fica |
|---|---|---|
| **Capital de giro: só o rótulo.** `divida` **já é** o produto de CG por calendário | **R-A310** (`linha_credito` rotativo) e **R-A311** (`LACUNA_FUNDING`) — **RECUSADAS pelo autor**. Sem migração `030`, sem bump para `0.1.29`. **R-A39** (tarifas) fica órfã do veículo que a carregava e volta a ser issue independente | ✅ **Decisão, não pendência.** O §3 inteiro deste documento passa a ser **ADR histórico** — a análise que sustentou a decisão, não trabalho a fazer. Quem reabrir isso está desfazendo decisão do autor, não achando esquecimento |
| **A base de receita líquida do equity NÃO muda.** *"equity é um retorno líquido ao investidor, não importa esse fator para o cálculo"* | **R-A35** e a **pergunta P1** | ✅ **Fechada.** A divergência com as duas planilhas (marketing dentro em `!equity!C16`, fora em `funding-motor.ts:58-67`) é **intencional**. O que sobra é a issue de **nota** — ver **R-A321** |

⚠️ A decisão sobre a base **não toca** o retorno negativo (§2, **R-A32** — reformulada pela
**R-A314** depois da contestação do B1), o teto de 100% (**R-A37**) nem o `saldoFinal` (**R-A33**). Ela responde *"que deduções compõem a base?"*, não *"a base pode ser
negativa?"* nem *"quanto dela pode ser distribuído?"*. Ver **R-A314** e **R-A316**.

---

### R-A312 — Tirar o funding da proforma é a decisão certa; o rótulo "Custos Financeiros" é o que sobra errado

**Combina:** A5 (4 margens, `proforma-avancado.ts:92-93`) × A3 (§1.3, §8.1 desalavancado) × conserto do **B2**
**Veredito:** conserto **CORRETO**; **AUSENTE** o desambiguador que ele cria
**Fonte:** `funding-capital-stack.md` §8.1 (KPIs desalavancadas); `fluxo-tabela.ts:495-503,575`.
**No código hoje:** o B2 já aplicou a opção (a) — `proformaAvancado(c, areaPrivativa)` sem
`funding` (`proforma-avancado.ts:21-64,107-110`, árvore de trabalho, não commitado).

**Do ponto de vista do modelo de capital, (a) é a certa, e (b) seria pior — três razões, nesta ordem:**

1. **Amortização não é custo, e liberação não é receita.** Lançar `linhasSaida` inteiro
   (amortização + juros) como custo faz o projeto pagar um principal que nunca recebeu. Mas creditar
   as duas pontas — a opção (b) — deixa no Resultado o resíduo `Σ entradas − Σ saídas`, que **só** é
   igual ao custo financeiro quando a operação amortiza inteira dentro do horizonte. Com saldo
   devedor remanescente (o caso da **R-A33**, que o app **não** impede), esse resíduo vaza para o
   Resultado **como se fosse lucro**. A opção (b) troca um erro visível e enorme por um erro
   silencioso e proporcional ao saldo — estritamente pior.
2. **Margem alavancada no meio de indicadores desalavancados não reconcilia com nada.** TIR, VPL,
   Payback e Exposição leem o fluxo livre por decisão registrada (`funding-motor.ts:645-655`). Uma
   proforma alavancada produziria a **quinta** definição de margem na mesma sessão — exatamente o
   defeito que o A5 catalogou.
3. **O painel compara Preliminar × Avançado nas mesmas colunas** (`tela-dashboard.ts:265-272`), e o
   Preliminar não modela funding nenhum. Alavancar um lado só compara coisas diferentes.

**A proforma NÃO contradiz `fluxo-tabela.ts`** — as duas superfícies respondem perguntas diferentes,
e é de propósito que difiram: a tabela é visão de **caixa** (as duas pontas existem, o principal se
cancela, o rodapé é o fluxo **alavancado**); a proforma é visão **econômica do empreendimento, antes
de decidir como ele é capitalizado**. É a distinção padrão entre resultado econômico e demonstração
de fluxos — não é um contorno.

**O que o conserto cria, e é a issue:** o grupo `financeiro` passa a significar **duas coisas
diferentes com o mesmo rótulo**. Na aba Fluxo, "Custos Financeiros" = linhas de custo do grupo
**mais** as saídas de funding (`fluxo-tabela.ts:575-580`); na Proforma, só as linhas de custo. Um
estudo cujo único custo financeiro é o serviço da dívida mostra o grupo **cheio** numa aba e
**ausente** na outra (`fluxo-tabela.ts:497-499` renderiza o grupo mesmo vazio quando há funding;
a proforma não).
**Regra proposta:** a proforma **deve** rotular o grupo como **"Custos Financeiros (exclui serviço
da dívida)"** e trazer, no rodapé, uma linha informativa **não somada** com
`Σ funding.linhasSaida` e o texto *"efeito do funding: ver a aba Fluxo de Caixa"*. Sem isso, o
próximo a comparar as duas abas reabre o mesmo bug ao contrário — "sumiu o custo financeiro".
**Como verificar:** teste de apresentação afirmando que a proforma **não** soma `linhasSaida` no
grupo `financeiro` **e** que o rótulo difere do da tabela; e um estudo com funding e sem linha de
custo financeira própria renderiza o grupo nos **dois** lugares, com conteúdos declaradamente
diferentes.
**Custo/risco:** rótulo + linha informativa. Nenhum número muda.

---

### R-A313 — A causa comum das 4 margens e do cash sweep cego: não existe um estado financeiro do estudo

**Combina:** A5 (4 margens líquidas e 3 resultados na mesma sessão) × A3 (**R-A38** cash sweep cego, **R-A36** resultado final em 3 cópias) × A4 (`formulas.md:61-86` descreve um funding que não existe mais)
**Veredito:** AUSENTE — **issue estrutural**, e é a que subsume as outras
**Fonte:** `inteligencia-evi-incorporacao.md:1584-1592`, Passos 23–25: processar os instrumentos →
formar o fluxo final → **atualizar acumulados e indicadores**. Uma sequência, uma vez.
**No código hoje:** a sequência acontece **cinco vezes, em cinco arquivos, com montagens diferentes**:

| Consumidor | monta `calc` | monta `receitaLiquida` | monta `resultadoFinal` | chama `fundingDoEstudo` | chama `proformaAvancado` |
|---|---|---|---|---|---|
| `tela-fluxo-ver.ts` | sim | `:154` | `:155` | `:159` | — |
| `tela-funding.ts` | sim | `:193` | `:206` | `:207` | — |
| `tela-cenarios.ts` | sim | `:228` | `:229` | `:230` | — |
| `tela-dashboard.ts` | sim | — | — | `:264` | `:256` |
| `tela-proforma.ts` | sim | — | — | — | sim |

Nenhum deles é a fonte; todos são cópias. Os dois sintomas catalogados separadamente são o **mesmo
defeito** visto de dois ângulos:

- **as 4 margens do A5** = cinco consumidores derivam o resultado por caminhos que ninguém obriga a
  coincidir — e o defeito do `proforma-avancado.ts:92-93` só conseguiu existir porque **um** deles
  tinha uma regra própria que nenhum outro tinha;
- **o cash sweep cego (R-A38)** = dentro de `fundingDoEstudo`, `simularFinanciamentoProducao` recebe
  o fluxo **desalavancado** (`funding-motor.ts:732`) porque não existe um passo anterior que já
  tenha somado as outras operações. É a mesma ausência de sequência, um nível abaixo.

Enquanto a montagem for por consumidor, **todo conserto é local e volta a divergir** — inclusive o
do B2, que hoje corrige a proforma em dois dos cinco pontos.
**Regra proposta:** criar **uma** função `estadoFinanceiroDoEstudo(config, operacoes)` que execute
os Passos 23–25 na ordem, uma vez, e devolva
`{ calc, receitaLiquidaBase, resultadoFinal, funding, proforma, indicadores }`. Os cinco
consumidores passam a **ler** esse objeto; nenhum recalcula. A **R-A38** vira a ordem interna dessa
função (duas passadas), e a **R-A36** deixa de existir por construção.
**Como verificar:** teste que roda `estadoFinanceiroDoEstudo` uma vez e afirma que
`proforma.resultado`, o rodapé da tabela e o card do painel saem do **mesmo campo** — hoje é
impossível escrever esse teste, porque não há um lugar onde os três se encontrem. E um guard de
grep: `fundingDoEstudo` e `proformaAvancado` só podem ser chamados de dentro dessa função.
**Custo/risco:** refatoração ampla, **sem mudar número** se feita depois do conserto do B2 e antes
da **R-A38**. ⚠️ Feita **junto** com a R-A38, ninguém consegue atribuir a variação — ver **R-A320**.

---

### R-A314 — Retorno de equity com base mensal negativa — **divergência registrada com o B1**

**Combina:** A3 (**R-A32**) × **B1** (contestação formal) × A2 (duas noções de "líquida") × A5 (nenhum equity em Pinguim)
**Veredito:** **REFORMULADO.** Não é "erro de transcrição" — o B1 tem razão nisso. É **lacuna de
domínio**, e a issue muda de nome: não é *"adicionar `max(0,…)`"*, é *"definir o que é retorno de
equity quando a receita líquida do mês é negativa"*.

#### A contestação do B1, e o que eu concedo

> **B1:** a ausência de `max(0,…)` em `funding-motor.ts:441,444` é **fidelidade à spec** —
> `fluxo-investidor-formulas.md:135` é o documento **vigente** de `equity` e também não tem `MAX`.
> A minha base (`funding-capital-stack.md:576`) é **ADR histórico**, e o equity não está na §4.3,
> a única seção vigente daquele documento.

**Concedo os dois pontos, sem ressalva:**

1. `fluxo-investidor-formulas.md:135` de fato transcreve `D — Retorno equity | SE(C24; C*C25; …)`
   **sem** `MAX`. Verificado agora, linha a linha. O código reproduz a spec vigente.
2. Citar `funding-capital-stack.md:576` como se fosse norma foi erro meu de hierarquia de fontes.
   Aquele documento é ADR **exceto a §4.3**, e o equity não está nela. **Retiro essa base.**

#### O que a planilha diz — resposta direta à pergunta 1

Li `!equity!` célula a célula. **Não há proteção contra base negativa, e não há porque ela é
estruturalmente impossível ali.** A razão é a forma da dedução, e é o ponto que decide tudo:

| | Planilha `!equity!` | App |
|---|---|---|
| Receita bruta do mês | `B28` = decomposição do VGV em **frações não negativas** (`C9`+`C10`+`C11`+`C12` = 1) → `B ≥ 0` sempre | série de recebimentos do plano de pagamento |
| Dedução | **fator multiplicativo**: `C28 = B28*(1 − C15 − C16 − C17)`, ou seja `B × 0,86` | **séries subtraídas**, com cronograma **próprio e independente** |
| Base pode ser negativa? | **Não** — `não-negativo × 0,86` | **Sim** |

Na planilha a dedução é **proporcional ao recebimento do próprio mês**, por construção. No app,
`eCorretagem` (`fluxo-shared.ts:485-492`) documenta que a corretagem é paga **integralmente no mês em
que a unidade é vendida** (#121), enquanto o recebimento é **espalhado** pelo plano. É um
descasamento de calendário que **o modelo da planilha não tem como representar**.

#### Resposta à pergunta 2: qual dos dois é

**É lacuna de domínio, não divergência de transcrição.** O app aceita um estado — base mensal
negativa — que a planilha **não sabe representar**. A spec não autoriza retorno negativo; ela é
**silenciosa**, porque o caso nunca ocorre no domínio dela. E silêncio não é permissão: nada em
`!equity!` nem em `fluxo-investidor-formulas.md` descreve o que significa `D < 0`, nem o que
significaria o investidor **pagar** ao projeto a título de retorno.

#### Resposta à pergunta 1 (a outra metade): removido de propósito, ou caiu na transcrição?

**Caiu na transcrição. Isto é verificável, e verifiquei.** O `capital-stack-motor.ts` que a #355
apagou (commit `927bf5a`) tinha o clamp **em código embarcado**, duas vezes, no caminho exato:

```
git show 927bf5a^:frontend/capital-stack-motor.ts
  :739  } else if (p.modo === 'C') {
  :740    const receitaLiq = Math.max(0, n(cen.receitaLiquidaMensal?.[t]));
  :784    const receitaLiq = Math.max(0, n(cen.receitaLiquidaMensal?.[t]));   // sponsor, mesmo modo
```

E `migracoes/029_funding_operacoes.js:66-68` diz, com todas as letras: *"Só o modo **C** (% da receita
líquida) mapeia **1:1** na permuta financeira."* Ou seja, o `permuta_financeira` de hoje é o
sucessor declarado de um modo que **tinha** o clamp.

Fecha o argumento a lista do que a #355 declara ter apagado
(`fluxo-investidor-formulas.md:35-38`): waterfall de 8 passos · `prioridade_funding` /
`prioridade_pagamento` · liberação automática por lacuna · `reservaMinima` · os 4 modos de Preferred
Equity · políticas `cash_sweep`/`bullet`. **O clamp não está na lista.** Uma remoção deliberada teria
entrado ali, como as outras seis entraram.

#### O que sobra de pé — e não é o ADR

Duas evidências que não dependem de `funding-capital-stack.md`:

1. **`fluxo-caixa-motor.ts:1553-1555,1570` — código vigente, não-ADR, do instrumento irmão.** Mesma
   base, mesmo par de deduções, mesmo descasamento de calendário, e o autor **já decidiu**:
   *"A base líquida nunca fica negativa (clamp em 0): imposto e corretagem que excedam a receita do
   mês **não geram permuta negativa**."* O app respondeu esta pergunta uma vez, no motor principal, e
   a resposta não chegou ao funding.
2. **O comportamento medido.** VGV 100M vendido no mês 0, sinal 5%, RET 4%, corretagem 5%,
   equity 10% em `permuta_financeira`:

```
receita líquida base : −200.000    2.000.000    2.000.000
retorno ao investidor:  −20.000      200.000      200.000
```

O investidor **paga R$ 20 mil ao projeto** no mês do lançamento, e isso entra na costura como
categoria de custo com sinal invertido (`funding-motor.ts:753-757`) e no fluxo alavancado. Um mês de
venda com sinal menor que a corretagem é a forma **normal** de um lançamento, não um caso de borda.

#### A issue reformulada

**Não** *"adicionar `max(0,…)`"*. **Sim:** *"Definir o retorno de equity quando a receita líquida
mensal é negativa"* — pergunta de modelo, decisão do autor, três respostas possíveis:

| Resposta | Consequência | Precedente no app |
|---|---|---|
| **(a) clampar em 0** — o mês não gera retorno, sem compensação futura | equity nunca paga ao projeto; o retorno total cai | `fluxo-caixa-motor.ts:1570`, mesma situação |
| **(b) clampar em 0 com carry-forward** — o negativo abate o retorno dos meses seguintes | preserva o total ao longo do projeto, muda o timing | **nenhum** — seria mecanismo novo, e a planilha não tem |
| **(c) manter como está** — retorno negativo é aceito e visível | fiel à letra da spec; o investidor aporta capital extra sem contrato que o preveja | a spec, por silêncio |

**Minha recomendação é (a)**, pelo precedente interno do `:1570` e por ser a única que não inventa
mecanismo. Mas **é decisão do autor**, e o B1 está certo que o código de hoje não é ilegal em face da
spec.
**Independente da resposta:** o **diagnóstico** da **R-A315(a)** entra de qualquer forma. Mesmo que
o autor escolha (c), o app **deve** dizer em tela que aquele mês teve retorno negativo — hoje ele
não diz, e o número atravessa a Reconciliação sem uma palavra.
**Como verificar:** se (a) ou (b), o teste da **R-A32** mais paridade com
`permutaFinanceiraLiquidaMensal`. Se (c), um teste que **fixa** o comportamento e um comentário em
`funding-motor.ts:441` dizendo que o negativo é aceito **por decisão**, com data — senão a próxima
sessão o "conserta" achando que é bug.
**Custo/risco:** com (a), muda número só nos meses de base negativa, sempre encarecendo o funding.
Como **não há equity em Pinguim** (A5), o risco de regressão em produção é **zero hoje** — o que faz
desta a decisão mais barata de tomar **antes** que alguém cadastre a primeira operação.

> 📌 **Divergência registrada.** A3 dizia "defeito"; B1 diz "fidelidade à spec". Depois da revisão:
> **B1 tem razão sobre a hierarquia de fontes; A3 tem razão sobre o estado ser irrepresentável.**
> Convergimos em que a issue muda de forma. O que **resta em aberto e é do autor**: escolher entre
> (a), (b) e (c). Nenhum de nós dois deve decidir isso sozinho.

---

### R-A315 — Equity é o único instrumento do app com zero invariantes, e é por isso que nada disto apareceu

**Combina:** A3 (**R-A32**, **R-A37**) × A5 (não conseguiu conferir equity) × A4 (documentos que afirmam entrega sem prova)
**Veredito:** AUSENTE
**No código hoje:** `frontend/fluxo-invariantes.ts:347` —
`if (s.saldo.every((v) => v === 0)) continue; // equity: sem dívida, nada a checar`.
Equity tem `saldo` **zerado por construção** (`funding-motor.ts:451`), então **toda operação de
equity é pulada** pelas checagens de `validarFunding`. O que sobra para ela:

| Checagem | Pega equity? |
|---|---|
| `DIVIDA_NEGATIVA` (`:349`) | ❌ pulada em `:347` |
| `DIVIDA_FINAL_NAO_ZERA` (`:355`) | ❌ pulada em `:347` |
| `FLUXO_FUNDING_NAO_RECONCILIA` (`:361`) | ⚠️ só a soma — um retorno negativo reconcilia perfeitamente |
| `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` (D14, `:379`) | ⚠️ olha o **acumulado**: um split de 140% num projeto de margem alta **nunca** derruba o acumulado, e o alerta nunca dispara |

Ou seja: as três divergências que achei em equity (`max(0,…)`, teto de 100%, base) são **invisíveis
por construção** na única superfície do app que existe para tornar erro visível. O comentário do
`:347` está certo sobre a premissa ("equity não tem dívida") e errado sobre a conclusão ("nada a
checar").
**Regra proposta:** `validarFunding` **deve** ter um ramo próprio de equity, antes do `continue`:
(a) `RETORNO_EQUITY_NEGATIVO` — `saidas[t] < −tol` em qualquer `t` (severidade **erro**);
(b) `RETORNO_EQUITY_EXCEDE_RECEITA` — `Σ saidas` das operações `permuta_financeira` no mês `t` maior
que a receita líquida base do mês (severidade **alerta**; é a leitura mensal do teto da **R-A37**);
(c) `EQUITY_SEM_APORTE` — operação com `pct_retorno > 0` e `valor = 0`, que remunera sem ter
aportado — o simétrico exato do estado em que a migração `029:45-53` deixa um `preferred_equity`
convertido, e que hoje é aceito sem uma palavra.
**Como verificar:** três testes em `fluxo-invariantes.test.ts`, e um teste negativo garantindo que
uma operação de equity saudável continua produzindo **zero** divergências.
**Custo/risco:** só diagnóstico. Nenhum cálculo muda. **Precondição prática das outras issues de
equity**: sem isso, nem o autor nem o A5 têm como *ver* o defeito na instância.

---

### R-A316 — A decisão do autor sobre a base **fortalece** o teto de 100%, não o enfraquece

**Combina:** A3 (**R-A37**) × decisão nº 4 do autor
**Veredito:** AUSENTE — e a gravidade **sobe**
**A pergunta:** o autor disse *"equity é um retorno líquido ao investidor, não importa esse fator
para o cálculo"*. Isso torna aceitável um investidor recebendo 140% da receita líquida?

**Não — e o argumento é o oposto.** A frase resolve **a composição da base** e, ao fazê-lo,
transforma a base num **dado fixo do estudo**: não há mais um "fator" a debater. Consequência
direta: `pct_retorno` passa a ser **a única variável** do lado do equity, e o app não tem **nenhuma**
trava sobre ela. Antes da decisão dava para argumentar que uma soma alta era compensada por uma base
mais larga; depois dela, não dá.

Três razões pelas quais 140% continua sendo defeito:

1. **Não é opinião, é impossibilidade contábil.** "Retorno líquido ao investidor" pressupõe que haja
   líquido. Distribuir 140% de uma grandeza é distribuir o que não existe — o instrumento deixa de
   ser equity e vira dívida disfarçada, sem saldo devedor, sem juros e sem quitação.
2. **Nada mais no app segura.** O waterfall que capava pelo caixa foi apagado pela #355; o D14 olha
   o **acumulado** e não dispara num projeto rentável (**R-A315**); a rota valida só `≥ 0`
   (`backend/rotas/funding.ts:60-65`). São três redes ausentes, não uma.
3. **O documento do próprio autor já dizia.** `funding-capital-stack.md:578`: *"a soma das
   participações de receita não pode superar 100%"*. Nada na decisão nº 4 revoga isso — ela fala de
   deduções, não de soma de participações.

**Regra proposta:** a da **R-A37**, sem alteração, **mais** o alerta mensal da **R-A315(b)** — porque
a validação de rota só pega a soma **nominal**, e um único investidor a 100% já distribui a receita
inteira, o que é contratualmente possível e quase sempre erro de digitação.
**Custo/risco:** validação de entrada + alerta. Nenhum cálculo muda.

---

### R-A317 — Receita de teste: as operações de equity que precisam existir em Pinguim

**Combina:** A5 (*"equity: nenhuma operação cadastrada — as divergências do A3 ficam sem evidência viva"*) × A3 (§1.2)
**Veredito:** AUSENTE — e **isto vale mais que as issues**, porque sem elas nenhuma das três é reproduzível
**Contexto:** estudo **5** (`inc_testepu1ideia1avancadobase_df_005`, avançado, rascunho) é o alvo — é
o que **tem** `taxaMensal: 0.0098636` e portanto juros de clientes reais (A5). O estudo 6 já passou
pelo modal e está carimbado `"(legado)"`; não serve de base.

⚠️ **Cadastro é `POST`, e a postura do A5 é somente-leitura por disciplina.** Estas operações
precisam ser criadas **pelo autor, na tela**, ou por uma sessão com mandato de escrita explícito. A
receita abaixo é para ele executar, não para um agente desta rodada.

| # | Prova qual divergência | Operação a cadastrar | O que observar |
|---|---|---|---|
| **E1** | **R-A314** — retorno negativo (prova o estado; a decisão (a)/(b)/(c) é do autor) | tipo `equity` · nome `[teste] E1 base negativa` · **valor R$ 1.000.000** · âncora `lancamento`, deslocamento 0 · modo **`permuta_financeira`** · **`pct_retorno` 10** | A linha *"…(Equity) — retorno"* na aba Fluxo de Caixa. **Basta um mês com valor negativo** para a divergência estar provada. O mês candidato é o do lançamento: corretagem integral (#121) contra o sinal apenas. Se a curva do estudo 5 não tiver mês negativo, reduzir o **% de entrada** do plano de pagamento do Grupo até que tenha — o defeito é da fórmula, não do estudo |
| **E2** | **R-A37 / R-A316** — teto de 100% | **três** operações `equity`, `permuta_financeira`, `pct_retorno` **40** cada (`[teste] E2a/b/c`), valor R$ 100.000 cada, âncora `lancamento` | O `POST` da terceira **deve** ser aceito hoje — é o defeito. Depois: a soma de `Funding · … — retorno` do mês tem que dar **120%** da receita líquida daquele mês, e a Reconciliação **não** acusa nada. É a prova dupla: o defeito existe **e** é invisível |
| **E3** | **R-A36 / R-A33** — resultado final e horizonte | uma `equity` modo **`resultado_final`**, `pct_retorno` 5, valor R$ 1.000.000, âncora `planejamento`; **mais** uma `divida` com `periodo_amortizacao_meses` **maior que o horizonte** (ex.: 120) | E3-equity: o pagamento único cai em `mesRepasse` = último mês de obra + 1, e o valor tem que ser 5% do **fluxo livre acumulado final** — não de "receita líquida − despesa". E3-dívida: `saldoFinal` na tela é o do **último mês do horizonte**, não o do mês 120 → **R-A33** provada, e `DIVIDA_FINAL_NAO_ZERA` tem que aparecer na Reconciliação |

**Como verificar sem a instância:** as três reproduzem headless com `node --import tsx/esm` sobre
`simularEquity`/`simularDivida` — foi assim que a E1 já foi provada (**R-A314**). O valor de
cadastrá-las em Pinguim é **outro**: provar que a cadeia inteira (rota → coluna → motor → tela →
Reconciliação → exportação) se comporta como o motor isolado. É a lacuna que o A5 não fechou.
**Custo/risco:** são estudos `[teste]` em rascunho, na instância de homologação. Depois de capturadas
as evidências, remover as operações restaura o estado atual — o `DELETE` da rota
(`backend/rotas/funding.ts:288-303`) não deixa resíduo.

---

### R-A318 — `avancado_capital_instrumentos`: lastro, mas lastro que precisa de etiqueta

**Combina:** A6 (*"não apagar do `schema.json` — guarda o dado migrado pela `019`"*) × A3 × decisão nº 3 do autor
**Veredito:** **manter** — mas o motivo do A6 não é o motivo certo, e a diferença importa
**No código hoje:** o único leitor da tabela em todo o repositório é a própria migração `029`
(`migracoes/029_funding_operacoes.js:88`). Nenhuma rota, nenhum motor, nenhuma tela. A `029:55-58`
já explica por que ela sobrevive: *"A tabela antiga NÃO é apagada (a camada de dados das migrações
só tem listar/atualizar/criar — **não há DDL**)"*.

**Concordo em manter, por três motivos — e nenhum deles é "guarda o dado da `019`":**

1. **Não dá para remover.** Sem DDL na camada de migração, tirar do `schema.json` **não apaga a
   tabela** do Postgres: só faz o app parar de declará-la, deixando uma tabela órfã que nenhuma
   migração futura consegue alcançar. É estritamente pior que mantê-la declarada.
2. **O dado que o A6 quer proteger provavelmente não existe.** O `CLAUDE.md` registra que a `019`
   **nunca rodou em Postgres**, e a `029:34-36` diz o mesmo em outras palavras (*"na prática esta
   migração é inócua em toda instalação existente"*). Manter a tabela por causa do dado é apostar
   num conteúdo que ninguém verificou — e ninguém pode verificar daqui (SDK stub). **Se a razão
   fosse essa, ela não se sustentaria.**
3. **Ela é a única evidência viva do modelo antigo.** Com o rotativo **recusado** (decisão nº 3), o
   Capital Stack está encerrado nos dois sentidos: nem volta como waterfall, nem volta como linha
   rotativa. A tabela vira **registro de auditoria** — e é bom que fique, porque
   `funding-capital-stack.md` é ADR, e ADR sem rastro no schema é fácil de desacreditar.

**O risco de mantê-la sem etiqueta**, e é a issue: uma sessão futura, ao implementar qualquer coisa
de funding, encontra uma tabela declarada, vazia e de nome sugestivo — e **a reusa**, ressuscitando
por acidente o modelo que duas decisões separadas enterraram.
**Regra proposta:** manter em `schema.json`, com (a) a chave `descricao` marcando
`"OBSOLETA — substituída por avancado_funding_operacoes (#355). Só a migração 029 a lê. Não usar em
código novo."`, e (b) um guard estático no `pr-guards.yml`, no molde do
`scripts/guard-issue-fechamento.mjs`, barrando qualquer referência a
`avancado_capital_instrumentos` **fora** de `migracoes/` e `docs/`.
**Como verificar:** o guard falha num PR de teste que adicione a string em `frontend/` ou `backend/`;
passa na `main` atual.
**Custo/risco:** metadado + guard de CI. **`versao` do manifesto NÃO bumpa** — `descricao` não é
mudança de schema e não há migração nova.

---

### R-A319 — Capital de giro: a issue que sobra é de vocabulário, e tem que carregar a decisão junto

**Combina:** decisão nº 3 do autor × A3 (§1.0) × A6 (`tela-fluxo-ver.ts:295` ainda diz "Capital Stack")
**Veredito:** DIVERGENTE (rótulo) — é a **R-A31**, agora com escopo fechado e um requisito novo
**Regra proposta:** além do rótulo `"Dívida / Capital de giro"` (**R-A31**), a issue **deve**
registrar, no corpo e no comentário de `frontend/tela-funding.ts:56`, que **o rotativo foi recusado
pelo autor em 2026-08-22** e que `divida` é a resposta oficial para capital de giro e
empréstimo-ponte. E deve varrer, na mesma passada, os lugares que ainda falam de um conceito
apagado: `frontend/tela-fluxo-ver.ts:56,63,295` e `frontend/tela-financeiro.ts:13,22`.
**Por que junto:** rótulo sem o "porquê" é rótulo que a próxima sessão reverte. A lição do
`CLAUDE.md` — *"a issue fechou não é evidência, o diff é"* — tem um par: **decisão que não vira
comentário no código morre na primeira compactação de contexto.**
**Como verificar:** `grep -rn "Capital Stack" frontend/` volta vazio; `grep -n "Capital de giro"
frontend/tela-funding.ts` casa; a `versao` **não** bumpa.
**Custo/risco:** texto. Nenhum número muda.

---

### R-A320 — Risco de ordem: três consertos e duas refatorações mexem no mesmo denominador

**Combina:** B2 (3 consertos em voo) × A5 (`jurosClientes` que vira 0 no modal) × A2 (campo de taxa no modal) × A3 (**R-A38**, **R-A313**)
**Veredito:** AUSENTE — risco de **processo**, não de código
**O problema:** cinco mudanças distintas alteram o **mesmo** conjunto de números exibidos
(Resultado, Margem, ROI, TIR), por caminhos independentes:

| Mudança | Quem | Efeito no Resultado/Margem |
|---|---|---|
| tirar funding da proforma | B2, agora | ⬆️ enorme (−47,87% → 18,94% no estudo 5) |
| modal deixar de reescrever o plano | B2, agora | ⬆️ preserva R$ 1.259.273,59 de juros (TIR 17,53% → 18,59%) |
| `PATCH` de tipologias validar saldo | B2, agora | pode **impedir** estados hoje salvos |
| campo de taxa no modal | A2, issue futura | ⬆️ até **5,41% do VGV** (R$ 8,98 MM na EVI) |
| **R-A38** (cash sweep enxergar as outras operações) | A3, issue futura | ⬆️⬇️ em estudo com financiamento à produção + dívida/equity |

Se duas entrarem no mesmo PR, **nenhuma variação é atribuível** — e a Rodada 8 inteira nasceu de
achados que só apareceram porque o A5 conseguiu comparar número contra número.
**Regra proposta:** (a) **capturar o baseline agora**, antes do merge do B2 — rodar
`scripts/conferir-estudo.ts` nos estudos 5 e 6 e anexar a saída ao PR; é o único momento em que o
"antes" ainda existe; (b) **uma mudança de número por PR**, cada uma declarando no corpo qual KPI
move e em que direção; (c) ordem recomendada: **B2 → baseline → R-A313 (refatoração sem mudar
número) → R-A314/R-A37 (equity, risco zero em produção porque não há equity cadastrado) → R-A38
(a que mais move) → A2 (taxa no modal)**. A **R-A313** vem antes da **R-A38** de propósito: fazer as
duas juntas mistura "onde o número é calculado" com "quanto o número vale", e a atribuição some.
**Como verificar:** cada PR desta cadeia traz a tabela `antes → depois` dos 4 KPIs dos estudos 5 e 6.
Um PR de refatoração que mova qualquer um dos quatro **é um bug**, não uma refatoração.
**Custo/risco:** processo. Custa disciplina de merge e economiza a próxima Rodada 8.

---

### R-A321 — Contradição a levar ao autor: a EVI tem **dois** flags de "líquida", e o app tem **um**

**Combina:** A2 (*"duas noções de líquida no mesmo modelo, de propósito"*, `Premissas!N17`/`N18`) × decisão nº 4 do autor × A3 (§1.2)
**Veredito:** **pergunta ao autor**, não veredito — os dois achados não se contradizem, mas juntos
abrem uma pergunta que nenhum dos dois fez
**Os fatos, lado a lado:**

| Onde | Base "líquida" de quê | Deduz |
|---|---|---|
| EVI, `Premissas!P19` (flag `N17`) | resultado do projeto | imposto + corretagem + **marketing** |
| EVI, `cfINC!BN` (flag `N18`) | rateio da permuta financeira | imposto + corretagem, **sem marketing** |
| Planilha `fluxo_investidor`, `!equity!C18` | retorno do equity | corretagem + **marketing** + impostos |
| App, `funding-motor.ts:58-67` | retorno do equity | impostos + corretagem + permuta física |
| App, `fluxo-caixa-motor.ts:1549` | rateio da permuta financeira | imposto + corretagem — **e é opcional**, via `permuta_financeira_base` |

A decisão nº 4 fixa a linha 4 e está fechada. O que ela **não** decide, e que só aparece quando o
achado do A2 encosta no meu:

> A EVI trata "líquida" como **duas grandezas distintas, com dois flags independentes**, e o app já
> reproduz esse par — mas só para a permuta financeira (`permuta_financeira_base`, default `bruta`).
> O equity **não tem** o interruptor equivalente.

**Pergunta ao autor (P8):** o equity deve ganhar o mesmo interruptor que a permuta financeira já tem
— base bruta × base líquida, escolhida por operação —, ou "retorno líquido ao investidor" quer dizer
que a base do equity é **sempre** a que o app já usa, sem opção? *(Não estou propondo mudar a base:
a decisão nº 4 fechou isso. Estou perguntando se ela é **uma escolha travada** ou **a única
existente** — são coisas diferentes na hora de modelar um contrato real de investidor.)*
**Regra proposta enquanto não houver resposta:** `docs/viabilidade/fluxo-investidor-formulas.md` §4.2
**deve** ganhar uma nota declarando que a transcrição de `!equity!C18` (`1−C15−C16−C17`) é a
**fórmula da planilha**, e que o app usa deliberadamente outra composição, com a citação literal da
decisão do autor de 2026-08-22 e o `arquivo:linha`. Hoje o documento marcado *"comportamento
vigente"* descreve um comportamento que o código não tem — que é exatamente o gênero de mentira
documental que o A4 catalogou 17 vezes.
**Como verificar:** o doc cita `funding-motor.ts:58-67` e a decisão; um leitor que compare doc e
código não encontra mais divergência sem explicação.
**Custo/risco:** documentação. Nenhum número muda.

---

### R-A322 — Abrir o modal de pagamento reduz o retorno do investidor, e ninguém catalogou isso

**Combina:** A5 (`jurosClientes` vira 0 no primeiro "Aplicar") × A6 (o modal fabrica uma entrada de 15% que não existe) × A3 (base do equity)
**Veredito:** DIVERGENTE — consequência **de funding** de um defeito catalogado como sendo **de receitas**
**A cadeia, ponta a ponta:**

1. os juros de tabela **integram a receita bruta recebida** (`inteligencia-evi-incorporacao.md` §6:
   *"Receita Bruta (VGV) — soma de todos os recebimentos de clientes, **inclusive juros**"*), e o
   motor os agrega em `calcularFluxo:2025-2053`;
2. a base do equity em `permuta_financeira` é `receitaMensal − corretagem`
   (`funding-motor.ts:58-67`) — portanto **inclui os juros**;
3. o A5 provou que abrir o modal e clicar em "Aplicar" **zera** `taxaMensal`
   (`fluxo-pagamento-editor.ts:90` → `componentesDoLegado`), destruindo R$ 1.259.273,59 de juros no
   estudo 5; o A6 provou que o mesmo modal ainda **reescreve o plano** (15/30/55 onde estava 0/30/70).

**Consequência que nenhum dos dois enunciou:** a base do equity encolhe junto. Com os números
medidos pelo A5 e um investidor a 4%, abrir o modal do estudo 5 evapora **≈ R$ 50.371** de retorno do
investidor — e a reescrita 0/30/70 → 15/30/55 muda também **o mês** em que o retorno é pago, porque
antecipa receita para o lançamento. O contrato do investidor muda porque alguém **abriu uma tela**.
**Regra proposta:** o conserto do modal (B2) **deve** incluir, no teste de regressão, uma asserção
sobre o **funding**, não só sobre a receita: abrir e aplicar o modal sem alterar campo nenhum mantém
`Σ saidas` de toda operação de equity **inalterada**. Sem essa asserção, o conserto pode ser
declarado bom preservando a receita e ainda assim mover o retorno do investidor por outro caminho.
**Como verificar:** teste de ida e volta — `fluxoPagamentoParaSalvar(formularioPagamento(fp))`
idempotente (que é o conserto do B2), **mais** `simularEquity` sobre a base antes e depois, exigindo
igualdade ao centavo.
**Custo/risco:** uma asserção a mais no conserto que já está sendo feito. Custo quase zero **agora**;
depois do merge, custa uma issue nova.

---

### Índice das emergentes

| Regra | Combina | Severidade | Muda número? |
|---|---|---|---|
| **R-A312** rótulo de "Custos Financeiros" na proforma | A5 × A3 × B2 | 🟢 | não |
| **R-A313** `estadoFinanceiroDoEstudo` — causa comum | A5 × A3 × A4 | 🔴 estrutural | não, se isolada |
| **R-A314** retorno de equity com base negativa — **divergência com o B1**, decisão do autor | A3 × **B1** × A2 × A5 | 🔴 pergunta | depende da resposta (risco 0 hoje) |
| **R-A315** equity sem invariantes | A3 × A5 × A4 | 🟠 | não |
| **R-A316** teto de 100% fortalecido pela decisão | A3 × decisão 4 | 🟠 | não |
| **R-A317** receita de teste do equity em Pinguim | A3 × A5 | 🔴 **precondição** | não |
| **R-A318** `avancado_capital_instrumentos` etiquetada | A6 × A3 × decisão 3 | 🟢 | não |
| **R-A319** vocabulário de CG + varrer "Capital Stack" | decisão 3 × A3 × A6 | 🟢 | não |
| **R-A320** ordem de merge e baseline | B2 × A5 × A2 × A3 | 🟠 processo | — |
| **R-A321** dois flags de "líquida" → **pergunta P8** | A2 × decisão 4 × A3 | 🟡 pergunta | não |
| **R-A322** modal encolhe o retorno do investidor | A5 × A6 × A3 | 🔴 | sim |

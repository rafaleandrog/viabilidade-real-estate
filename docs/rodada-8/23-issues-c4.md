# Rodada 8 · C4 — Issues de documentação e itens da lista de bugs

> Agente **C4**. Fatia: as 17 mentiras documentais do A4 (§1), os itens da lista de bugs que
> falharam e ainda não têm issue (2, 15, 41), os 3 indecidíveis sem print (38, 43, 45) e os
> comportamentos acidentais do A4 §3 que nenhum outro agente cobre.
>
> **13 issues.** Nenhuma bumpa a `versao` do `manifesto.json` — nenhuma traz migração.
> As seis issues do bloco 8-A (`07-consolidado-issues.md` §1: itens 11, 17, 22, 24, 31 e a
> colateral do 46) **não** são repetidas aqui. As issues emergentes `E1`–`E10`
> (`04-regras-reconciliacao.md` §6.3) também não — os acidentais **A1**, **A2**, **A3** e **A5**
> já viram issue lá (E7, E3, E6, E5) e foram deliberadamente omitidos desta lista.
>
> ⚠️ **Duas ressalvas que atravessam todas as issues de documentação:**
> 1. Os textos substitutos escritos na §1 do A4 afirmam, em M3/M4/M12/M14, que *"`jurosClientes` é
>    sempre 0 em estudo real"*. **Isso é falso** — o A5 mediu `taxaMensal: 0.0098636` e
>    R$ 1.259.273,59 no estudo 5 de Pinguim. A correção **C1** do próprio A4
>    (`04-regras-reconciliacao.md` §6.0) já reescreve o parágrafo; aplicar a §1 sem a §6.0 troca uma
>    mentira por outra.
> 2. O parágrafo de C1 diz que *"`componentesParaSalvar` fechou a destruição"*. **Os três consertos
>    foram revertidos** (decisão 1 do autor, `LEIA-PRIMEIRO.md`): a árvore está idêntica à `main`.
>    Onde C1 aparece abaixo, ela já vem com essa frase corrigida.

---

<<<ISSUE>>>
title: docs(recebiveis): quatro lugares afirmam que o motor de safras não está ligado ao calcularFluxo
priority: 1
sources: A4 §1 M1–M4 · A4 §6.0 C1 · A5 (medição em Pinguim) · LEIA-PRIMEIRO "O que NÃO refazer"
---
## Contexto
A cadeia EVI de recebíveis por safras foi ligada ao fluxo consolidado pela **#283**. Quatro lugares
do repositório — dois comentários de motor, o `CLAUDE.md` e o capítulo de fórmulas — continuam
afirmando o contrário, em tempo presente. É a **mesma mentira em quatro endereços**, por isso uma
issue só.

O dano não é estético: dois agentes desta rodada iam propor "integrar o motor de safras ao
`calcularFluxo`" como trabalho novo, e só não o fizeram porque a auditoria conferiu o código antes.
Quem ler `formulas.md:51-54` reimplementa do zero um motor que já existe e já é o caminho de cálculo
real.

## Comportamento atual
- `frontend/fluxo-caixa-motor.ts:509-514` — *"Este PR entrega o TIPO e o ADAPTER
  (`componentesDoLegado`); a matemática de safra/PMT que os CONSOME é #232+ — `receitaMensalLinha`
  continua lendo o `fluxo_pagamento` legado diretamente, sem mudança de comportamento nesta issue."*
- `frontend/fluxo-caixa-motor.ts:643-649` — *"NÃO estão ligadas a `receitaMensalLinha`/`calcularFluxo`
  nesta fase (…) a integração ao fluxo consolidado é trabalho de issue futura (…) até lá, o motor
  legado (`entrada`/`parcelas`/`repasse`) continua sendo o único caminho de cálculo real."*
- `CLAUDE.md:98-101` — *"nove issues da cadeia EVI de recebíveis (…) têm a matemática pronta e
  testada, mas não ligada a `calcularFluxo` — o próprio motor declara isso em
  `frontend/fluxo-caixa-motor.ts:505-511`. A integração virou a #283, e ela é precondição das nove."*
- `docs/viabilidade/formulas.md:38-59` (núcleo em `:51-54`) — *"Elas são modelo funcional de
  referência, não comportamento instalado: o motor atual rateia valor nominal e não tem safra, juros
  do cliente nem carteira."*

O código desmente os quatro: `recebimentoBrutoMensal` (`frontend/fluxo-caixa-motor.ts:1335`) consulta
o caminho canônico **antes** de qualquer coisa (`:1340-1341`); `calcularFluxo:2025-2053` agrega
principal, juros, carteira, repasse e as séries por componente; o teste
`frontend/fluxo-caixa-motor.test.ts:1762-1787` prova `jurosClientes > 0` e
`carteiraClientesMaxima > 0` saindo de `calcularFluxo`; e
`frontend/fluxo-pagamento-editor.ts:90` grava `componentes` em **toda** escrita, então todo Grupo
editado desde a #248 já roda pelo caminho canônico. O próprio motor se contradiz em `:626-627` e
`:2009-2011`.

## Consequência
Trabalho duplicado com alto custo: reimplementar safra, PMT, carteira e juros do cliente é semanas de
motor. Pior, o `CLAUDE.md:98-101` apresenta a #283 como **precondição não cumprida** de nove issues —
o que sugere que nove entregas estão bloqueadas quando não estão.

## Comportamento esperado
Os quatro trechos descrevem o estado real: o caminho canônico existe, é o padrão para linha com
`fluxo_pagamento.componentes` persistido, e o motor legado sobrevive apenas para linha nunca
reeditada. E o que **realmente** falta fica dito: a **entrada** de taxa e de sinal no modal.

## Texto substituto

**1) `frontend/fluxo-caixa-motor.ts:509-514` — sai:**
```
// ESTRATÉGIA CONSERVADORA (corpo da #230): definir o shape canônico → criar o
// normalizador do dado ATUAL → preservar a leitura legada → só migrar
// persistência se o ganho justificar. Este PR entrega o TIPO e o ADAPTER
// (`componentesDoLegado`); a matemática de safra/PMT que os CONSOME é #232+ —
// `receitaMensalLinha` continua lendo o `fluxo_pagamento` legado diretamente,
// sem mudança de comportamento nesta issue.
```
**entra:**
```
// ESTRATÉGIA CONSERVADORA (corpo da #230): definir o shape canônico → criar o
// normalizador do dado ATUAL → preservar a leitura legada → só migrar
// persistência se o ganho justificar. A #230 entregou o TIPO e o ADAPTER
// (`componentesDoLegado`); a matemática de safra/PMT veio em #232+; e a #283
// LIGOU as duas ao fluxo consolidado. Hoje `recebimentoBrutoMensal` (:1335)
// consulta `recebiveisComponentesLinha` PRIMEIRO e só cai no motor legado
// (`entrada`/`parcelas`/`repasse`) quando a linha não tem
// `fluxo_pagamento.componentes` persistido.
```

**2) `frontend/fluxo-caixa-motor.ts:643-649` — sai:**
```
// (`frontend/fixtures/calliandra-golden.ts`, #220). São o motor de cálculo
// que o corpo de #230 previa para #232+; NÃO estão ligadas a
// `receitaMensalLinha`/`calcularFluxo` nesta fase — nenhum estudo existente
// muda de resultado. A integração ao fluxo consolidado (para uma linha que
// opte pelo contrato de componentes) é trabalho de issue futura, quando a UI
// oferecer o novo modelo; até lá, o motor legado (`entrada`/`parcelas`/
// `repasse`) continua sendo o único caminho de cálculo real.
```
**entra:**
```
// (`frontend/fixtures/calliandra-golden.ts`, #220). São o motor de cálculo
// que o corpo de #230 previa para #232+, e desde a #283 ele É o caminho de
// cálculo real: `calcularRecebiveisComponentes` (:1064) consolida as safras
// de uma linha e `calcularFluxo` (:2025-2053) agrega principal, juros,
// carteira, repasse e as séries por componente. A porta de entrada é
// `fluxo_pagamento.componentes` na linha; sem ele, a linha segue pelo motor
// legado (`entrada`/`parcelas`/`repasse`), que continua existindo para
// estudo nunca reeditado. Como `fluxoPagamentoParaSalvar`
// (`frontend/fluxo-pagamento-editor.ts:90`) grava `componentes` em toda
// escrita, todo Grupo já editado desde a #248 usa este caminho.
```

**3) `CLAUDE.md:98-101` — sai** o parágrafo *"O maior buraco: nove issues da cadeia EVI…"*;
**entra:**
```
> O maior buraco daquela triagem — nove issues da cadeia EVI de recebíveis (#230, #232–#237, #240,
> #241) com a matemática pronta mas **não ligada a `calcularFluxo`** — **foi fechado pela #283**:
> `recebimentoBrutoMensal` consulta o contrato canônico em
> `frontend/fluxo-caixa-motor.ts:1340-1341` e `calcularFluxo` agrega juros, principal, carteira e
> repasse em `:2025-2053` (teste `frontend/fluxo-caixa-motor.test.ts:1762-1787`). A porta é
> `fluxo_pagamento.componentes`, que `frontend/fluxo-pagamento-editor.ts:90` grava em toda escrita.
> **O que continua faltando não é a integração, é o INPUT de taxa e de sinal no modal** — ver o
> aviso abaixo.
```

**4) `docs/viabilidade/formulas.md:38-59` — sai** a seção `## Fluxo avançado por safras — onde as
fórmulas vivem` inteira; **entra:**
````markdown
## Fluxo avançado por safras — onde as fórmulas vivem

> ⚠️ **Nada desta seção descreve a Proforma.** As fórmulas acima são a **Proforma** (Preliminar),
> que roda em `frontend/proforma.ts`. Esta seção é o **Avançado**, que roda em
> `frontend/fluxo-caixa-motor.ts`.

As fórmulas do **fluxo de caixa avançado por safras** — contratação bruta/desconto/líquido,
componentes de pagamento (imediato, prazo fixo, até marco, concentrado), PMT, primeiro vencimento
em `s + defasagemMeses`, carteira por safra e repasse — estão descritas nos dois documentos EVI:

- [Inteligência EVI — Incorporação](inteligencia-evi-incorporacao) — significado econômico;
- [Padrão de Viabilidade — Incorporação](padrao-incorporacao) §11 a §14 — dinâmica funcional, com
  os cenários dourados no Anexo G.

**Estão implementadas desde a #283** e são o caminho de cálculo real de toda linha de receita com
`fluxo_pagamento.componentes` persistido — o que a tela grava em toda escrita
(`frontend/fluxo-pagamento-editor.ts:90`). O motor legado (`entrada`/`parcelas`/`repasse`) sobrevive
apenas para linha nunca reeditada.

| Grandeza | Onde vive |
|---|---|
| Safra (mês de contratação) | `fluxo-caixa-motor.ts:958-962`, laço em `:1094` |
| PMT | `fluxo-caixa-motor.ts:653` |
| Pagamentos de uma safra | `pagamentosComponenteSafra`, `:1045` |
| Juros e principal separados | `:1113-1131` |
| Carteira por safra | `carteiraSaldoSafra`; consolidação em `:1191` |
| Agregação no `FluxoCalc` | `calcularFluxo`, `:2025-2053` |
| Regra Após-chaves (venda pós-entrega é à vista) | `ehVendaAposChaves` `:945`, aplicada em `:1096` |

> 🚫 **Não copiar fórmula de carteira do arquivo Urbitá.** As fórmulas de carteira daquele arquivo
> admitem saldo negativo e saldo que volta a crescer depois da última parcela. A recorrência correta
> é por safra: `saldo_s,s = principal_s`, depois
> `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t` — que é o que
> `validarComponentesSafra` (`frontend/fluxo-invariantes.ts:404`) fiscaliza.
````

**5) O aviso sobre juros — o MESMO parágrafo entra nos quatro lugares** (em `formulas.md` logo
depois da tabela; no `CLAUDE.md` logo depois do bloco 3; nos dois comentários de motor, adaptado à
sintaxe `//`). **Este é o texto corrigido pela §6.0 C1 do A4, já sem a frase sobre o conserto
revertido:**
```
> ⚠️ **A matemática de juros existe e é exercitada por estudo real; o que falta é a ENTRADA.** Há
> linha em produção com `taxaMensal` diferente de 0 persistida em `fluxo_pagamento.componentes`
> (estudo 5 de Pinguim: `0.0098636` = 12,5% a.a., R$ 1.259.273,59 de juros de clientes). O modal de
> Fluxo de Pagamento não oferece campo de **taxa** nem de **sinal**
> (`frontend/tela-fluxo-receitas.ts:741-816`), e o adaptador `componentesDoLegado` fixa
> `taxaMensal: 0` / `sinalPct: 0` (`frontend/fluxo-caixa-motor.ts:589,601,608,617`) porque o espelho
> legado não tem onde guardar essas grandezas. Como `fluxoPagamentoParaSalvar`
> (`frontend/fluxo-pagamento-editor.ts:90`) regenera os componentes do espelho em toda escrita,
> **abrir o modal e clicar "Aplicar" apaga os juros da linha**, sem aviso e sem undo. Escrever
> "`jurosClientes` é sempre 0" é errado: o certo é **"os juros existem e viram zero no primeiro
> Aplicar"**.
```

## Critério de aceite
1. `grep -n "não estão ligadas\|NÃO estão ligadas\|não ligada a .calcularFluxo" frontend/ docs/ CLAUDE.md`
   não retorna nada.
2. `grep -rn "sempre 0" docs/viabilidade/ CLAUDE.md frontend/fluxo-caixa-motor.ts` não retorna
   nenhuma afirmação sobre `jurosClientes`.
3. Os quatro trechos citam `frontend/fluxo-caixa-motor.ts:1340-1341` e `:2025-2053` como evidência,
   e citam a porta `fluxo_pagamento.componentes`.
4. `bash scripts/validar-frontend.sh` verde (os dois arquivos tocados de código são só comentário).
   Sem migração → **a `versao` não bumpa**.

## Fora de escopo
- **Abrir o campo de taxa/sinal no modal** — é feature, tem issue própria (ver `04` §6.2 e a
  decisão do autor). Aqui só se corrige o texto.
- **Consertar o "Aplicar" que apaga os juros** — issue de código, separada; esta issue apenas
  **documenta** que ele apaga.
<<<END>>>

<<<ISSUE>>>
title: docs(funding): três blocos declaram o funding como não instalado, e ele roda desde a #355
priority: 1
sources: A4 §1 M5 · A4 §1 M17 (§17) · A4 §2 R-A46
---
## Contexto
A #355 (2026-08-12) entregou funding: três operações independentes — `financiamento_producao`,
`divida` e `equity` —, motor de 862 linhas, tela, rotas e migração `029`. Dois documentos ainda
descrevem a aba `Viabilidade → Financeiro` como *"inteiramente inerte"* e o funding como *"modelo
funcional de referência, não comportamento instalado"*, com dependência de uma epic (#239, Capital
Stack) que **deixou de existir**.

## Comportamento atual
- `docs/viabilidade/formulas.md:61-86` (§ Funding e Capital Stack) — *"Nada desta seção descreve
  runtime. A aba `Viabilidade → Financeiro` é hoje inteiramente inerte: ~25 colunas persistidas e
  renderizadas, zero referências no motor. (…) A implementação depende da epic #239 e das dez
  sub-issues #270–#279."*
- `docs/viabilidade/padrao-incorporacao.md:1746-1750` e `:1789-1799` (§17) — a mesma afirmação, duas
  vezes: *"o Bloco G inteiro — ~25 colunas (…) — é persistido e renderizado, mas o motor não
  referencia nenhuma delas. Nada descrito abaixo, nem no documento novo, está implementado."*

Três fatos desmentem: (a) `frontend/funding-motor.ts` roda — `simularDivida:237`,
`simularFinanciamentoProducao:312`, `simularEquity:425`, `fundingDoEstudo:710`, com oráculo em
`frontend/financiamento-producao-golden.test.ts`; (b) a epic #239/Capital Stack foi substituída pela
#355 (`docs/viabilidade/funding-capital-stack.md:11-35` já registra isso, `formulas.md` não);
(c) a aba Financeiro **não** renderiza mais ~25 colunas — a #279 tirou 9 controles e a #355 tirou
`financiamento_*`, `investidor_*` e `estrutura_*_pct` (`frontend/tela-financeiro.ts:16-22,49-57`). O
que sobrou genuinamente inerte são **7 campos**: `regime_tributario` + os cinco `aliquota_*_pct`
(`frontend/tela-financeiro.ts:187-193`) e `imposto_sobre_permuta_fisica` (`:182`).

## Consequência
Quem ler qualquer um dos três blocos conclui que precisa **implementar funding do zero** — o achado
que o A4 classificou como a 2ª mentira mais perigosa do repositório. E o inverso também morde: quem
quiser saber onde vive a fórmula de dívida é mandado para uma epic apagada em vez de para
`docs/viabilidade/fluxo-investidor-formulas.md`, que é a spec vigente.

## Comportamento esperado
Os três blocos descrevem o funding como instalado, apontam a spec vigente de cada produto, e
delimitam com precisão o que sobrou inerte (7 campos, não ~25 colunas).

## Texto substituto

**1) `docs/viabilidade/formulas.md:61-86` — sai** a seção `## Funding e Capital Stack — onde as
fórmulas vivem` inteira; **entra:**
````markdown
## Funding — onde as fórmulas vivem

As fórmulas de **dívida** (aporte único ou em tranches, carência, PMT Price, quitação),
**equity** (aporte, retorno progressivo sobre receita líquida ou concentrado sobre o resultado
final, MOIC/TIR/ROI do investidor) e **financiamento à produção** (base de custos elegíveis,
gatilho de exposição mínima, catch-up retroativo, juros capitalizados e cash sweep) estão
**implementadas** em `frontend/funding-motor.ts`, tela em `frontend/tela-funding.ts`, rotas em
`backend/rotas/funding.ts`, tabela `avancado_funding_operacoes` (migração `029`).

| Documento | Papel hoje |
|---|---|
| [Fluxo do Investidor — fórmulas das operações de Funding](fluxo-investidor-formulas) | **Spec vigente** de `divida` e `equity` |
| [Funding, Capital Stack e Retorno do Capital](funding-capital-stack) | **ADR histórico** do modelo de 4 instrumentos com waterfall, apagado pela #355 — **exceto a §4.3**, que continua vigente e é a spec de `financiamento_producao` |

Duas identidades que o motor mantém:

```text
fluxo_apos_funding_t = fluxo_livre_projeto_t + entradas_funding_t − saidas_funding_t
```

fiscalizada por `validarFunding` (`frontend/fluxo-invariantes.ts:363-374`), que também acusa saldo
de dívida negativo, dívida que não zera no horizonte e — decisão **D14** — caixa acumulado negativo
depois do funding (`:376-387`, severidade `alerta`).

**Funding nunca integra a Receita Bruta — VGV.** Liberação de dívida e aporte de equity aparecem
**somente** no bloco de funding; o repasse continua sendo recebimento do cliente, ainda que o caixa
alimente o cash sweep.

> ⚠️ **Linha rotativa e empréstimo-ponte não existem.** Os tipos aceitos são exatamente
> `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`); `capital_giro` é
> rejeitado com `tipo deve ser um de…` (`backend/rotas/funding.test.ts:26`).

> ⚠️ **O que continua inerte na aba `Viabilidade → Financeiro`**, e só isso: `regime_tributario` e
> os cinco `aliquota_*_pct` (`frontend/tela-financeiro.ts:187-193`), mais
> `imposto_sobre_permuta_fisica` (`:182`). Nenhum motor os lê. Os campos de financiamento,
> investidor, estrutura de capital e correção monetária **saíram da tela** (#279/#355); as colunas
> continuam no schema, sem formulário e sem leitor.
````

**2) `docs/viabilidade/padrao-incorporacao.md:1746-1750` — sai** o aviso de §17; **entra:**
```
> ✅ **Comportamento vigente desde a #355 (2026-08-12).** O funding existe e roda: três operações
> independentes — `financiamento_producao` (única por estudo), `divida` e `equity` —, **sem
> waterfall, sem prioridades e sem competição por caixa**. Motor: `frontend/funding-motor.ts`;
> tela: `frontend/tela-funding.ts` (aba "Funding"); rotas: `backend/rotas/funding.ts`; tabela
> `avancado_funding_operacoes` (migração `029`). A spec de `divida`/`equity` é
> [Fluxo do Investidor](fluxo-investidor-formulas); a de `financiamento_producao` continua sendo a
> §4.3 de [Funding, Capital Stack e Retorno do Capital](funding-capital-stack), preservada de
> propósito. O resto daquele documento é **ADR histórico**.
>
> ⚠️ **O que sobrou inerte na aba `Viabilidade → Financeiro`**, e só isso: `regime_tributario` e os
> cinco `aliquota_*_pct` (`frontend/tela-financeiro.ts:187-193`), mais
> `imposto_sobre_permuta_fisica` (`:182`). Os campos de financiamento, investidor, estrutura de
> capital e correção monetária **saíram do formulário** (#279/#355); as colunas continuam no schema
> como dado histórico, sem tela e sem leitor.
```

**3) `docs/viabilidade/padrao-incorporacao.md:1789-1799` — o bloco deve ser APAGADO por inteiro**
(é a repetição do mesmo aviso; o texto acima já o cobre).

⚠️ **Um terceiro bloco sobre capital de giro** existia na proposta original do A4 e **não deve ser
escrito com a redação antiga** (*"capital de giro não existe"*): a decisão 2 do autor determina que
`divida` **é** o produto de capital de giro por calendário, e só falta o rótulo. A redação certa
para esse bloco está na issue **E9** (`04-regras-reconciliacao.md` §6.3) e deve ser aplicada **junto
com** ela, não aqui.

## Critério de aceite
1. `grep -n "inteiramente inerte\|não comportamento instalado\|~25 colunas" docs/viabilidade/`
   não retorna nada.
2. `grep -n "epic #239\|#270–#279\|#270-#279" docs/viabilidade/formulas.md` não retorna nada.
3. Os dois documentos apontam `fluxo-investidor-formulas.md` como spec de `divida`/`equity` e a
   §4.3 de `funding-capital-stack.md` como spec de `financiamento_producao`.
4. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
- O rótulo "capital de giro" na tela de Funding — é a issue **E9**, e é ela que traz o 3º bloco de
  §17.
- Apagar `avancado_capital_instrumentos` do `schema.json` — decisão 4 do autor: **não** nesta rodada.
<<<END>>>

<<<ISSUE>>>
title: docs(claude-md): dois blocos de estado do CLAUDE.md descrevem um repositório que não existe mais
priority: 2
sources: A4 §1 M7 · A4 §1 M8 · A4 §6.0 C2
---
## Contexto
O `CLAUDE.md` é lido automaticamente no início de **toda** sessão neste repositório. Dois blocos dele
descrevem estado vencido: um apresenta quatro issues fechadas como backlog aberto, o outro descreve
um arquivo que mudou. Custo direto: toda sessão começa com duas crenças falsas no contexto.

## Comportamento atual
- `CLAUDE.md:63-72` — a caixa *"⚠️ Auditoria de 2026-08-17"* diz, em tempo presente, que a spec
  `fluxo-investidor-formulas.md` *"nunca entrou no repo"*, que a decisão **D14** *"não foi
  implementada"* e que *"as três viraram as issues #413, #414 e #416"* + a #415. Lê-se como backlog
  aberto.
- `CLAUDE.md:471-477` — *"**O que ainda falta** é `frontend/exportar.ts:10` deixar de definir o seu
  próprio `const R$ = v.toFixed(2)`"*.

Os dois estão errados. **As quatro issues fecharam** no commit `ba06add` (PR #417,
`closes #413, closes #414, closes #415, closes #416`): `docs/viabilidade/fluxo-investidor-formulas.md`
existe (242 linhas), a D14 está em `frontend/fluxo-invariantes.ts:376-387`
(`CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`) e o aviso regulatório da §17 está em
`frontend/tela-funding.ts:106-107,615-619`. E `frontend/exportar.ts:10` é hoje
`import { fmtR$, fmtNum, fmtPct } from './viab-format.js';` — `grep` por `toFixed(2)` no arquivo dá
zero.

⚠️ **Mas a #281 não acabou — mudou de endereço.** `frontend/fluxo-tabela.ts:34` (`celula`) tem
formatador próprio: `Math.round` → **0 casas**, e célula **vazia** abaixo de R$ 0,50. `celulaFx`
(`frontend/exportar.ts:167`) usa `fmtR$` → 2 casas. A mesma célula sai `1.235` na tela e `1.234,56`
no PDF; R$ 0,20 sai **branco** na tela e `0,20` no PDF.

## Consequência
Uma sessão que leia `:63-72` acredita que há 4 issues abertas e pode "reimplementar" a D14 ou
recriar a spec. Uma sessão que leia `:471-477` procura em `exportar.ts` um `const R$` que não existe
— e, ao não achar, declara a #281 resolvida, que é exatamente o erro oposto ao que deve concluir.

## Comportamento esperado
Os dois blocos descrevem o estado de 2026-08-22, com evidência `arquivo:linha`, e o segundo aponta o
endereço **novo** da #281.

## Texto substituto

**1) `CLAUDE.md:63-72` — sai** a caixa *"⚠️ **Auditoria de 2026-08-17.**"* inteira; **entra:**
```
> ⚠️ **Auditoria de 2026-08-17 — as 4 lacunas, e o fechamento delas.** A Rodada 7 fechou com três
> passos do próprio plano da #355 sem executar: a spec `fluxo-investidor-formulas.md` (F11.1) nunca
> entrou no repo, embora 4 arquivos a citassem como fonte; a decisão **D14** (alerta de caixa
> negativo após funding) não foi implementada; e esta seção continuou dizendo "Rodada 7 aberta /
> #355 bloqueada" (F11.6). A quarta, o aviso regulatório da §17, a #277 entregou e a reescrita da
> #355 apagou junto com `tela-capital-stack.ts`.
>
> **As quatro viraram #413, #414, #415 e #416, e todas fecharam com diff no commit `ba06add`
> (PR #417, 2026-08-17).** Evidência hoje: `docs/viabilidade/fluxo-investidor-formulas.md` existe;
> D14 está em `frontend/fluxo-invariantes.ts:376-387`
> (`CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, severidade `alerta`); o aviso regulatório, em
> `frontend/tela-funding.ts:615-619`.
>
> A lição é a de sempre, com uma volta a mais: **"a issue fechou" não é evidência de entrega, e o
> plano publicado na issue também não** — só o diff é. Quando um plano tem passo de documentação ou
> de estado, ele morre calado se ninguém conferir, porque nenhum teste fica vermelho por causa dele.
> **E o corolário, que esta própria nota exemplifica: nota de auditoria também envelhece.** Quem
> fechar as issues de uma auditoria reescreve a nota na mesma alteração.
```

**2) `CLAUDE.md:471-477` — sai** a nota *"⚠️ **Parcialmente resolvido — o texto anterior desta nota
estava vencido**…"* inteira; **entra** (esta é a versão já corrigida pela §6.0 **C2** do A4 — a §1
dele dizia *"a fonte de formatação monetária é única"*, o que também é falso):
```
  > ⚠️ **Resolvido na exportação, ainda aberto na tela.** `frontend/viab-format.ts:13-23` usa 2
  > casas com mínimo e máximo, o Orçamento de Custos em `rs` também
  > (`frontend/tela-fluxo-custos.ts:673,933`), e `frontend/exportar.ts:10` passou a **importar**
  > `fmtR$` em vez de definir formatador próprio. **Duas fontes ainda divergem:**
  > `frontend/fluxo-tabela.ts:34` arredonda para **0 casas** e esconde valor abaixo de R$ 0,50,
  > então a mesma célula sai `1.235` na tela e `1.234,56` no PDF, e R$ 0,20 sai **branco** na tela;
  > e `fmtNum` (`frontend/viab-format.ts:24-25`) declara só `maximumFractionDigits`, então
  > `frontend/tela-proforma.ts:453` chama `fmtNum(v, 2)` e o número redondo sai sem casas. A #281
  > **mudou de endereço, não foi resolvida** — não corrija pontualmente.
```

## Critério de aceite
1. `grep -n "const R\$\|toFixed(2)" CLAUDE.md` não retorna nada.
2. `grep -n "#413\|#414\|#415\|#416" CLAUDE.md` aparece **só** dentro do parágrafo que diz que as
   quatro fecharam, com o commit `ba06add` citado.
3. O `CLAUDE.md` cita `frontend/fluxo-tabela.ts:34` como o endereço aberto da #281.
4. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
- Consertar `celula` em `frontend/fluxo-tabela.ts:34` e `fmtNum` — é a issue **E5**
  (`04-regras-reconciliacao.md` §6.3). Aqui só se corrige o texto que descreve o problema.
- O `CLAUDE.md:98-101` (a mentira das safras) e a seção de estado do backlog — issues próprias.
<<<END>>>

<<<ISSUE>>>
title: docs(claude-md): declarar a Rodada 8 aberta na seção de estado do backlog
priority: 1
sources: A4 §6.5 · B1 §1 (placar final) · LEIA-PRIMEIRO (decisões do autor)
---
## Contexto
O próprio `CLAUDE.md:145-149` ensina a regra: *"Se abrir uma rodada nova, atualize esta seção junto —
e quem a encerrar faz o mesmo, na mesma alteração. A Rodada 4 nasceu porque #165–#169 ficaram abertas
uma rodada inteira sem ninguém perceber, com este arquivo dizendo 'não há issue aberta'."* A Rodada 7
violou isso — é a lacuna F11.6, que virou a #416. A Rodada 8 não pode repetir, e hoje o arquivo ainda
diz `## Estado do backlog — ✅ RODADA 7 CONCLUÍDA` (`CLAUDE.md:30`).

## Comportamento atual
`CLAUDE.md:30` — cabeçalho `## Estado do backlog — ✅ RODADA 7 CONCLUÍDA`, com a tabela de rodadas
logo abaixo. Nenhuma menção à Rodada 8, cujos documentos já existem em `docs/rodada-8/` (11
arquivos, ~9.000 linhas) e cujas issues estão prestes a ser abertas.

## Consequência
Toda sessão nova lê "não há rodada aberta" enquanto dezenas de issues da Rodada 8 estão em
circulação — a reprodução exata do acidente que criou a Rodada 4 e a #416.

## Comportamento esperado
A seção declara a Rodada 8 aberta, com o placar honesto e as decisões vinculantes do autor
registradas, e diz explicitamente que quem a encerrar atualiza a tabela **na mesma alteração**.

## Texto substituto
**`CLAUDE.md:30` — sai** o cabeçalho `## Estado do backlog — ✅ RODADA 7 CONCLUÍDA`; **entra** o
bloco abaixo, **acima** da tabela existente (que fica intacta a partir da linha da Rodada 7):

````markdown
## Estado do backlog — 🟡 RODADA 8 ABERTA

| Rodada | Escopo | Issues | Estado |
|---|---|---|---|
| **8 — auditoria cruzada** | Reverificação da `lista bugs 20260807.xlsx` + regras derivadas das 3 planilhas (EVI Urbitá, fluxo do investidor) + conferência numérica em Pinguim + auditoria de UI | a abrir | 🟡 **em curso desde 2026-08-21** |
| **7 — lista de bugs (2ª leva)** | `lista_bugs_20260807.xlsx`, 47 itens | **#309–#355** (47) | ✅ concluída em 2026-08-12 |

### Rodada 8 — o que é, e o placar honesto

Seis agentes em duas rodadas, orquestrados por uma sessão principal; documentos em `docs/rodada-8/`
(comece por `LEIA-PRIMEIRO.md`). A pergunta era: **o que da Rodada 7 realmente se sustenta no
código, e que regras as três planilhas do autor exigem que o app ainda não representa?**

**Placar final da reverificação dos 47 itens** — a lista foi auditada **inteira**, item a item, pelo
**corpo** da coluna `Issue` e não pelo título:

| Veredito | Qtd | Itens |
|---|---:|---|
| ✅ confirmado no código | 38 | os demais |
| 🟡 parcial — uma cláusula sobreviveu | 5 | 2, 11, 22, 24, 41 |
| 🔴 reprovado/reaberto | 2 | 15, 31 |
| ⚪ correto na `main`, sem diff próprio | 1 | 20 |
| ⚫ indecidível sem o print da planilha | 1 | 45 (mais uma cláusula de 38 e de 43) |

> **O que fez a diferença no método:** ler o **corpo** da coluna `Issue` da planilha, não o título.
> O item 6 pedia "no máximo 3 campos por linha"; o **título** dizia "reordenar" — o oposto do
> pedido. Quatro itens (14, 18, 32, 43) teriam recebido veredito oposto se lidos pelo título.
> **Título de planilha não é requisito.**

**Decisões do autor tomadas nesta rodada** (vinculantes, registradas aqui porque não têm outra casa):

1. **Nenhum bug é consertado nesta rodada — tudo vira issue.** O autor autorizou o conserto dos 3
   bugs graves (proforma do Avançado somando o principal do funding ao custo; modal de Fluxo de
   Pagamento reescrevendo o plano ao abrir; `PATCH` de tipologias gravando `quantidade` sem validar
   o saldo) e depois **reverteu**: os consertos foram desfeitos e o material virou corpo de issue
   (`docs/rodada-8/09-consertos.md`). A árvore da Rodada 8 não altera código.
2. **Capital de giro: só o rótulo.** O tipo `divida` já **é** o produto de CG por calendário — a aba
   `divida` da planilha do autor tem as células `Valor CG`, `Libera CG`, `Carencia CG`. O desenho de
   uma linha de crédito **rotativa** foi **recusado**: reintroduziria a competição por caixa que a
   #355 apagou. Sem migração `030`, sem bump de `versao`.
3. **A base de receita líquida do equity não muda** (`frontend/funding-motor.ts:58-67`) — *"equity é
   um retorno líquido ao investidor, não importa esse fator para o cálculo"*. A divergência com as
   duas planilhas é **intencional**: vira nota, não issue.
4. **`avancado_capital_instrumentos` não é apagada do `schema.json`** nesta rodada — guarda o dado
   migrado pela `019`.

> ⚠️ **Esta seção é o que a Rodada 7 esqueceu de escrever.** Quem encerrar a Rodada 8 atualiza esta
> tabela **na mesma alteração** que fechar a última issue. Não delegue para "depois": foi
> exatamente assim que a #416 nasceu.
````

⚠️ **Duas correções ao rascunho da §6.5 do A4 já estão embutidas acima e não devem ser desfeitas:**
(a) a decisão 1 original dizia *"os 3 bugs graves são consertados nesta branch, não viram issue"* —
o autor **reverteu**; (b) o placar original (*"41 confirmados / 5 reabertos"*) era provisório, de
quando faltavam 36 itens auditar. O placar acima é o final, de `08-auditoria-39-itens.md` §1.

## Critério de aceite
1. `grep -n "RODADA 8 ABERTA" CLAUDE.md` retorna a linha do cabeçalho.
2. A tabela de rodadas antiga continua íntegra abaixo, com a linha da Rodada 7 preservada.
3. O placar publicado soma **47**.
4. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
Encerrar a rodada. Esta issue só a **abre** — o encerramento é a alteração que fecha a última issue
do bloco 8-B.
<<<END>>>

<<<ISSUE>>>
title: docs(padrao): oito blocos rotulam como pendência um comportamento que o código já entrega
priority: 2
sources: A4 §1 M9, M10, M11, M13, M14, M15, M16, M17(§15.2) · A4 §6.1 (P1 respondida)
---
## Contexto
`docs/viabilidade/padrao-incorporacao.md` rotula explicitamente cada trecho como **Comportamento
vigente**, **Modelo funcional de referência** ou **Evolução dependente de issue** — é o que o
`CLAUDE.md:23-27` manda usar para não presumir que uma regra descrita já está implementada. Oito
blocos carregam o rótulo errado: descrevem como pendente, ou como divergência, algo que o código
entregou entre a #225 e a #283.

## Comportamento atual
| Bloco | Diz | O código faz |
|---|---|---|
| `:609-615` (§8.3) | a faixa `obra` deriva do evento Obra inteiro e os três períodos **se sobrepõem**; "Evolução dependente de issue", EVI-006 | `frontend/fluxo-shared.ts:276-278` (#225): `obra.inicio = lanc.inicio_mes + max(1, lanc.duracao_meses)` — sem sobreposição; caso degenerado avisado por `problemaJanelaDuranteObra` (`:292-302`) |
| `:636-643` (§8.5) | a duração do Pós-chaves é **livre e editável**; pede issue EVI-007 para travar em 12 | `frontend/fluxo-shared.ts:237`: `APOS_CHAVES_MESES = 12`, usada em `faixasAbsorcao:281` e declarada em `absorcaoMensal:366-367` |
| `:813-822` (§10.2) | o JSON `absorcao` guarda **três** períodos; "Divergência: o padrão exige quatro" | são **quatro** — `frontend/tela-fluxo-receitas.ts:535-540`; `pctPosObraDerivado` em `fluxo-shared.ts:324-326`; validação em `erroFormularioAbsorcao` `:337-345` (#347) |
| `:1081-1086` (§11.8) | o motor **não distingue** venda anterior de posterior à entrega; EVI-015/#235 | `ehVendaAposChaves` (`fluxo-caixa-motor.ts:945-947`) + `componentesEfetivosSafra` (`:949-956`), aplicados por safra em `:1096` |
| `:1192-1200` (§13) | "não há safra, PMT, taxa aplicada ao saldo, carteira ou reconciliação por componente" | tudo existe: `:958-962`, `:653`, `:1122-1123`, `carteiraSaldoSafra`, `receitaPorComponenteMensal`/`carteiraPorComponenteMensal` `:1077-1083` |
| `:1528-1531` (§15.1) | a permuta física vem do catálogo de Tipologias; "não existe vínculo tipologia ↔ quantidade na linha de custo" | o vínculo é a fonte de verdade: `permuta_tipologia_id`/`permuta_quantidade` (`schema.json:373-374`), CRUD parou de ler `unidades_permutadas` (`backend/rotas/avancado.ts:744-749`, #253), reserva em `reservarPermutasFisicas` (`fluxo-caixa-motor.ts:1768`) |
| `:1580-1584` (§15.2) | "as duas séries que a visão líquida consome **não existem**" (imposto e corretagem) | `impostoMensal` (`fluxo-caixa-motor.ts:1434-1444`) e `corretagemMensal` (`:1503`) |
| `:1910-1914` (§18.4) | o motor deriva o prazo sem considerar todas as parcelas e tem **fallback que empilha excedentes no último mês**; EVI-011/#231 | horizonte por `max(…)` em `calcularFluxo:1762-1766`; o fallback silencioso **foi removido** (`:1358-1360`); fora do horizonte → `console.warn`, não computado (`:1085-1092`) |

## Consequência
O documento é a referência funcional citada pelo `CLAUDE.md` para "resolver um issue" — e ele
convida a implementar oito coisas prontas, três delas com número de issue EVI já atribuído
(EVI-006, EVI-007, EVI-011, EVI-015). O §8.5 é o pior caso: o dossiê da Rodada 8 registrou o
travamento em 12 meses como **lacuna** justamente por acreditar neste bloco.

## Comportamento esperado
Os oito blocos passam a levar o rótulo **✅ Comportamento vigente**, com a evidência `arquivo:linha`
que os sustenta, e nenhum deles continua pedindo issue para trabalho já feito. Onde sobrar
divergência real — o rótulo enganoso de `pos_obra.duracao_meses`, a taxa que o modal apaga —, ela é
declarada como ressalva do próprio bloco, não como pendência do comportamento inteiro.

## Texto substituto
Cada bloco troca o rótulo por **✅ Comportamento vigente**, com a evidência. Os oito textos, na
íntegra, estão em `docs/rodada-8/04-regras-reconciliacao.md` §1 (M9, M11, M13, M14, M15, M16 e o
1º bloco de M17) e §6.1 (o de §8.5, que é a **versão final** — não use o de M10). Reproduzidos aqui
os dois de maior consequência:

**`padrao-incorporacao.md:636-643` (§8.5) — entra** (versão da §6.1, que incorpora a evidência da
planilha EVI trazida pelo A2):
```
> ✅ **Comportamento vigente, alinhado ao padrão e à EVI (#226 / EVI-007).** O início é o mês
> seguinte ao fim da Obra (`pos_obra` travado por `recalcularTravados`) e a duração é a
> **constante** `APOS_CHAVES_MESES = 12` (`frontend/fluxo-shared.ts:237`), consumida em
> `faixasAbsorcao:281` e declarada em `absorcaoMensal:366-367`.
>
> **A planilha de referência vota do mesmo lado.** Na EVI Urbitá, `cfINC!J` divide por **12
> literal** e ignora os próprios inputs `EtapaChavesDuracao`/`EtapaPosChavesDuracao` — a janela de
> vendas pós-entrega nunca foi parâmetro, nem lá. O travamento **reproduz** o oráculo; não é
> simplificação do app.
>
> ⚠️ **`pos_obra.duracao_meses` continua editável e não faz o que o nome promete.** O evento nasce
> com `duracao_meses: 12` e `travado_duracao: false` (`backend/rotas/avancado.ts:42`); editá-lo
> **não** move a janela de vendas, só a **âncora de custos** pós-entrega — que é o motivo de não o
> terem travado junto. Medido em Pinguim: o estudo 6 tem `duracao_meses: 13` e uma curva de
> absorção `personalizado` que chega ao 13º mês; o 13º mês cai fora de `periodoAbsorcao` e
> `absorcaoMensal:375-376` o **descarta em silêncio** — **1,41% das vendas, R$ 2.007.856,95**.
> Esticar a janela faz vender menos. Ver a issue **E3**.
```

**`padrao-incorporacao.md:1192-1200` (§13, abre-alas) — entra:**
```
> ✅ **Esta seção descreve comportamento vigente desde a #283.** `frontend/fluxo-caixa-motor.ts`
> implementa safra (`:958-962`, laço em `:1094`), PMT (`:653`), taxa sobre o saldo de abertura
> (`:1122-1123`), carteira por safra (`carteiraSaldoSafra`; consolidação em `:1191`) e
> reconciliação por componente (`receitaPorComponenteMensal`/`carteiraPorComponenteMensal`,
> `:1077-1083`, agregadas em `calcularFluxo:2035-2047`; invariantes em
> `frontend/fluxo-invariantes.ts:404`).
>
> ⚠️ **Duas ressalvas.** (1) A porta é `fluxo_pagamento.componentes` — linha nunca reeditada segue
> pelo motor legado. (2) A **taxa** chega 0 pelo adaptador (`:589,601,608,617`) sempre que a linha
> passa pelo modal, porque ele não a oferece: a carteira existe, os juros são apagados no
> "Aplicar".
```

Os outros seis (§8.3, §10.2, §11.8, §15.1, §15.2, §18.4) devem ser copiados **literalmente** de
`04-regras-reconciliacao.md` §1 — M9, M11, M13, M16, M17(§15.2) e M15, nessa ordem.

⚠️ **Correção obrigatória em M13 e M14 antes de aplicar:** onde os textos dizem *"os juros não
existem"* / *"`jurosClientes` é sempre 0"*, use a formulação de C1 (§6.0): **os juros existem, há
linha em produção com `taxaMensal: 0.0098636`, e é o "Aplicar" do modal que os zera**.

## Critério de aceite
1. `grep -n "EVI-006\|EVI-007\|EVI-011\|EVI-015" docs/viabilidade/padrao-incorporacao.md` não
   retorna nenhum trecho pedindo implementação — só menção histórica, se houver.
2. Os oito blocos começam com `✅ **Comportamento vigente` e citam `arquivo:linha`.
3. Os quatro trechos que o A4 conferiu e **manteve** continuam intactos: `:262-269`, `:1136-1142`,
   `:1601-1604`, `:1779-1784`.
4. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
- `padrao-incorporacao.md:895-898` (§11, nota de UX do modal) e §17 — issues próprias.
- O rótulo enganoso de `pos_obra.duracao_meses` no Cronograma: é a issue **E3**, de código. Esta
  issue apenas **documenta** a divergência.
<<<END>>>

<<<ISSUE>>>
title: docs(padrao): a nota de UX do modal de pagamento descreve controles que não existem mais
priority: 3
sources: A4 §1 M12
---
## Contexto
`docs/viabilidade/padrao-incorporacao.md:895-898` (§11) descreve a interface do modal de Fluxo de
Pagamento. A descrição é de antes das #248/#342/#345/#346: cita um checkbox que foi removido, uma
badge que saiu, e **todas** as referências `arquivo:linha` estão deslocadas.

## Comportamento atual
O bloco diz: *"o editor expõe a estrutura de persistência (…) quatro periodicidades (`mensal`,
`trimestral`, `semestral`, `anual`), no máximo 4 linhas, uma periodicidade por linha, mais um
checkbox `juros` que **não alimenta cálculo nenhum**
(`frontend/tela-fluxo-receitas.ts:33-34,633-637,668-681,745-780`)."*

- O checkbox `juros` **não existe**: `grep -n "juros" frontend/tela-fluxo-receitas.ts` devolve
  **zero linhas**.
- A badge de periodicidade saiu na #342 (comentário em `frontend/tela-fluxo-receitas.ts:773-781`):
  linha nova nasce `mensal`, linha legada mantém o valor gravado sem controle visual, e o motor
  continua lendo (`INTERVALO_PERIODICIDADE`, `frontend/fluxo-caixa-motor.ts:318-320`).
- O modal vive hoje em `frontend/tela-fluxo-receitas.ts:720-830`, não nas linhas citadas.

## Consequência
Baixa gravidade isolada, alta em conjunto: é o único bloco que descreve a **superfície** do modal, e
é exatamente o modal em que a Rodada 8 concentrou três achados (juros apagados no "Aplicar", falta de
campo de taxa, falta de campo de sinal). Quem for mexer nele parte de um mapa errado.

## Comportamento esperado
O bloco descreve os três blocos que o modal tem hoje, com as linhas certas, sem citar controle
removido — e diz o que falta (taxa e sinal) em vez de descrever um checkbox `juros` que nunca
alimentou cálculo e já não existe.

## Texto substituto
**`docs/viabilidade/padrao-incorporacao.md:895-898` — sai** a nota de UX inteira; **entra:**
```
> **Comportamento vigente (pós-#248/#342/#345/#346).** O modal (`frontend/tela-fluxo-receitas.ts:
> 720-830`) tem três blocos: *Definições* (só texto — corretagem e RET migraram para Custos,
> `:728-737`), *Condições de entrada* (`% do total`, `Nº parcelas`, `Desconto %`, `:741-763`) e
> *Parcelamento* (`% do total`, `Nº parcelas` ou checkbox "Ao longo da obra", máximo 4 linhas,
> `:764-806`); o *Repasse* é **derivado e somente-leitura** (`100 − entradas − parcelas`, `:807-817`),
> sempre no 1º mês após o fim da Obra. O checkbox `juros` foi **removido**; a badge de periodicidade
> também (#342) — linha nova nasce `mensal` e linha legada mantém a periodicidade gravada, que o
> motor continua lendo (`fluxo-caixa-motor.ts:318-320`).
>
> **O que ainda falta para o modelo econômico:** não há campo de **taxa** nem de **sinal**. Como
> `fluxoPagamentoParaSalvar` grava `componentes: componentesDoLegado(...)`
> (`frontend/fluxo-pagamento-editor.ts:90`) e o adaptador fixa `taxaMensal: 0` / `sinalPct: 0`
> (`fluxo-caixa-motor.ts:589,601,608,617`), aplicar o modal numa linha que tinha juros **apaga os
> juros**: é o que acontece hoje com o estudo 5 de Pinguim (`taxaMensal: 0.0098636`,
> R$ 1.259.273,59).
```

## Critério de aceite
1. `grep -n "checkbox \`juros\`" docs/viabilidade/padrao-incorporacao.md` não retorna nada.
2. As referências de linha do bloco apontam para o modal em `frontend/tela-fluxo-receitas.ts:720-830`
   e conferem por conteúdo.
3. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
Abrir os campos de taxa e de sinal, e consertar o "Aplicar" destrutivo — issues de código,
separadas.
<<<END>>>

<<<ISSUE>>>
title: docs(formulas): a tabela "Estado de conformidade" acusa ❌ em cinco pontos já conformes
priority: 3
sources: A4 §1 M6 · A4 §6.0 C2
---
## Contexto
`docs/viabilidade/formulas.md:123-135` publica uma tabela "Estado de conformidade, conferido" do
contrato de precisão monetária (2 casas em todo valor que é resultado de fórmula). A conferência é
de antes da #281 e marca ❌ em pontos que hoje estão conformes — e, pior, **não lista** os dois
pontos que continuam divergindo.

## Comportamento atual
A tabela diz: `frontend/viab-format.ts:8 — fmtR$` com **0** casas ❌ ("53 usos em 11 telas");
`tela-fluxo-custos.ts:638,873-875` com **0** casas ❌; `fluxo-caixa-motor.ts` "float sem
quantização" ❌; e `frontend/exportar.ts:9 — toFixed(2)` ✅.

O código: `frontend/viab-format.ts:11-23` define `CASAS_DECIMAIS_MONETARIAS = 2` com `minimum` e
`maximumFractionDigits`; o Orçamento em `rs` usa 2 casas (`frontend/tela-fluxo-custos.ts:673,933`);
o motor quantiza com `round2` em cada série (`frontend/fluxo-caixa-motor.ts:432,472,483,1443` e todo
o laço `:2028-2047`); e `frontend/exportar.ts:10` **importa** `fmtR$` — não define mais formatador
próprio.

O que a tabela **não** diz, e devia: `frontend/fluxo-tabela.ts:34` (`celula`) tem formatador próprio
com `Math.round` (**0 casas**) e some com valor abaixo de R$ 0,50; e `fmtNum`
(`frontend/viab-format.ts:24-25`) declara só `maximumFractionDigits`, de modo que
`frontend/tela-proforma.ts:453` chama `fmtNum(v, 2)` e o número redondo sai sem casas.

## Consequência
A tabela é o mapa que qualquer sessão usa para saber onde a #281 está aberta. Hoje ela manda
consertar cinco lugares já corretos e **esconde os dois que estão errados** — inclusive o mais
visível ao usuário, que faz a mesma célula sair `1.235` na tela e `1.234,56` no PDF.

## Comportamento esperado
A tabela reflete a conferência de 2026-08-22: ✅ nos sete pontos conformes, ❌ **só** em
`frontend/fluxo-tabela.ts:34` e em `fmtNum` — que são o endereço vigente da #281.

## Texto substituto
**`docs/viabilidade/formulas.md:123-135` — sai** o bloco `**Estado de conformidade, conferido:**` e
sua tabela; **entra:**
```markdown
**Estado de conformidade, conferido em 2026-08-22:**

| Ponto | Casas hoje | Conforme? |
|---|---|---|
| `frontend/viab-format.ts:11-23` — `fmtR$` (`CASAS_DECIMAIS_MONETARIAS = 2`) | 2 | ✅ |
| `frontend/exportar.ts:10` — importa `fmtR$`, sem formatador próprio | 2 | ✅ |
| `frontend/exportar.ts:167` — `celulaFx` (CSV e PDF) | 2 | ✅ corte em R$ 0,005 |
| `frontend/tela-financeiro.ts:143` | 2 | ✅ |
| `frontend/tela-empreendimento-tipologias.ts:178` | 2 (default) | ✅ |
| `frontend/tela-fluxo-custos.ts:673,933` — Orçamento em `rs` | 2 | ✅ |
| `frontend/fluxo-caixa-motor.ts` — resultados monetários (`round2`, C7) | 2 | ✅ |
| **`frontend/fluxo-tabela.ts:34`** — `celula` da tabela do Fluxo | **0** | ❌ formatador próprio: `Math.round`, e célula **vazia** abaixo de R$ 0,50 → #281 |
| **`frontend/viab-format.ts:24-25`** — `fmtNum` | **≤ d, sem mínimo** | ❌ `tela-proforma.ts:453` chama `fmtNum(v, 2)` e número redondo sai sem as casas → #281 |

Áreas (m²) seguem `decimal(12,2)` na persistência; a regra de resultado acima é declarada para
**valor monetário**.
```

## Critério de aceite
1. Nenhuma linha ❌ da tabela aponta para `viab-format.ts:8`, `tela-fluxo-custos.ts:638` ou "float
   sem quantização".
2. As duas linhas ❌ novas (`fluxo-tabela.ts:34` e `viab-format.ts:24-25`) estão presentes.
3. A data de conferência no título do bloco é atualizada.
4. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
Consertar os dois pontos ❌ — é a issue **E5** (`04-regras-reconciliacao.md` §6.3).
<<<END>>>

<<<ISSUE>>>
title: fix(nav): expor "Regiões monitoradas" fora de Admin → Apps, como a #314 fez com Curvas
priority: 1
sources: B1 §3.1 (8-B.1) · B1 Errata E3
---
## Contexto
Item **15** da `lista bugs 20260807.xlsx`; issue original **#313** da Rodada 7. Pedido literal:
*"Não consigo acessar em lugar nenhum essa página de admin. **Torne isso visível para o admin**."*

O diff que fechou a #313 (`c487cce`) é legítimo e conserta um bug real — **outro**. Ele troca
`somenteLeitura` de `@property` para getter derivado de `urbiVerso.contexto()?.nivel`, porque o shell
instancia a tela com `document.createElement` sem passar props; isso fazia um não-admin ver botões de
escrita que tomavam `403`. Esse conserto fica — não é o que esta issue desfaz. A própria mensagem do
commit diz: *"O mecanismo (manifesto.json, elemento registrado, backend) já estava correto"*, ou
seja, o veredito foi "não há nada a tornar visível". Mas o autor não relatou permissão: relatou **não
achar a tela**.

## Comportamento atual
- `manifesto.json:70-74` — `mercado_regioes` existe **só** em `telas_config`.
- `frontend/viabilidade-config-mercado.ts:22-27` — `somenteLeitura` derivado do contexto (correto).
- `frontend/tela-analise-mercado.ts:260` — a própria app manda o usuário para
  `Admin → Apps → viabilidade → Regiões monitoradas`, que é o caminho que ele relatou não achar.

## Consequência
A única superfície da tela é o painel de Admin do shell, fora da navegação da app. E há assimetria
gritante com a tela irmã: o item **16** é a queixa **idêntica** sobre `viabilidade-config-curvas`
(*"aparecia antes na página de admin mas agora não aparece mais e não consigo encontrar"*), tocada
pelo **mesmo commit** `c487cce`, com a mesma troca de `@property` por getter — e ela **ganhou** a
segunda exposição, pela #314 (`ff0b63f`), descrita na mensagem como *"a 2ª exposição, no mesmo
padrão do Benchmark"*, sem nunca dizer por que a irmã ficaria de fora. Isso não tem cara de decisão;
tem cara de esquecimento.

## Comportamento esperado
`mercado_regioes` ganha uma segunda exposição, no mesmo padrão da #314, **sem** sair de
`telas_config` — a #314 também não removeu `telas_config.curvas`, e a dupla exposição é o padrão já
aceito para Benchmark e Curvas. Duas alternativas, e o autor escolhe:

1. **Aba de topo** `/regioes`, ao lado de Estudos · Terrenos · Benchmark · Curvas — simétrico à
   #314, custo idêntico.
2. **Link contextual** a partir de `frontend/tela-analise-mercado.ts:260`, que hoje descreve o
   caminho em texto e poderia navegar até ele.

A opção 1 é a que fecha o item pela letra ("visível"); a 2 só encurta o caminho. A escrita continua
admin-only nos dois casos — `somenteLeitura` já deriva do contexto e o backend repete a checagem.
Uma aba de topo visível a não-admin em modo leitura é o comportamento que Benchmark e Curvas já têm.

## Como corrigir
**O diff da #314 (`ff0b63f`) é o gabarito, ponto a ponto** (linhas conferidas na `main` @ `475dd24`):

| Arquivo | Linha | O que fazer aqui |
|---|---|---|
| `manifesto.json` | `:52-56` | copiar o item de `nav` (`titulo`/`rota`/`icone`) para "Regiões monitoradas" |
| `frontend/index.ts` | `:35-37` | caso novo em `parsearSubRota` + o valor no tipo `Rota.aba` |
| `frontend/tela-dashboard.ts` | `:92-94` | aceitar o valor novo no tipo e na prop `aba` |
| `frontend/tela-dashboard.ts` | `:148` | item novo em `_abas` |
| `frontend/tela-dashboard.ts` | `:330`, `:341-343` | rota da aba + `urbi-hospedeiro` com `viabilidade-config-mercado` |

Trocar `curvas` → `regioes` e `viabilidade-config-curvas` → `viabilidade-config-mercado` nesses cinco
pontos é, essencialmente, o diff inteiro.

⚠️ Se algum PR desta rodada mexer em `frontend/tela-dashboard.ts` antes deste, os dois últimos
pontos deslocam. **Confira pelo conteúdo, não pelo número.**

## Critério de aceite
1. Existe caminho para "Regiões monitoradas" **fora** de Admin → Apps, alcançável pela navegação da
   própria app.
2. `telas_config.mercado_regioes` continua em `manifesto.json` — é adição, não substituição.
3. Não-admin não vê botão de escrita (regressão da #313).
4. Escolhida a opção 1, **o `git diff` desta issue é estruturalmente igual ao de `ff0b63f`** — se
   for muito maior que ele, provavelmente está fazendo algo que a #314 não precisou fazer.
5. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
A configuração de `mercado_busca_url`/`mercado_busca_chave`, que é pendência do autor no ambiente
autenticado.

Sem-fechamento: #313 executora original do item 15, já fechada; entregou outro conserto (legítimo), não a cláusula "torne isso visível"
Sem-fechamento: #314 precedente de solução para a tela irmã (Curvas), a copiar aqui
<<<END>>>

<<<ISSUE>>>
title: fix(fluxo): o detalhamento do financiamento à produção sai da tabela principal
priority: 2
sources: B1 §3.2 (8-B.2)
---
## Contexto
Item **41** da `lista bugs 20260807.xlsx`; issue original **#349** da Rodada 7, que entregou 3 das 4
cláusulas — e bem: a tabela "Programa Financeiro (Capital Stack)" sumiu, as entradas de funding
viraram bloco de receita e as saídas entram em **Custos Financeiros**, com os subtotais somando
corretamente (`frontend/fluxo-tabela.ts:562-590`); Cenários usa a mesma função
(`frontend/tela-cenarios.ts:343`).

A cláusula que ficou é a mais literal do pedido: *"As linhas devem conter o VGV total, as divisões
por grupos definidos em Receitas, os 5 tipos de Custos e o Fluxo ao final. **Somente isso.**"* e
*"além de um campo separado para quando há funding na operação. Isso não deve acontecer."*

## Comportamento atual
- `frontend/fluxo-tabela.ts:593-606` — para cada operação de financiamento à produção, a tabela
  empilha, **depois** dos grupos de custo, um grupo `Financiamento à produção — <nome>
  (detalhamento)` com sub-linhas próprias (liberações, juros, amortizações), total e VPL zerados,
  colapsado por padrão.
- `frontend/fluxo-tabela.ts:610` — com funding, aparece também a linha de rodapé
  `Fluxo de Caixa Livre (antes do funding)`.
- Sem funding, a tabela é exatamente a pedida — os dois blocos só existem **na condição que a issue
  existia para tratar**.

## Consequência
O bloco é uma continuação da tabela que só existe por causa do funding: a forma exata do defeito
relatado, com outro rótulo. Que ele seja "de auditoria" e esteja fora da aritmética
(comentário `:594-597`) não o tira da tela — a queixa era a tabela ter ficado *"gigante e com várias
linhas desnecessárias"*. E a informação **não se perde** ao sair: liberações, juros e amortizações já
estão nas linhas de funding dentro de Custos Financeiros (`:574-590`) — é o próprio comentário
`:594-597` que diz isso, ao explicar por que o bloco tem total zerado.

A linha de rodapé é colateral menor e defensável (o autor pediu a diferença entre FCL e FC real no
item 43) — mas o lugar onde ele pediu foi a aba **Análise Financeira**, onde ela também existe
(`frontend/tela-fluxo-ver.ts:276-292`). Aqui é duplicação.

## Comportamento esperado
1. Remover o bloco `Financiamento à produção — … (detalhamento)` da tabela principal (e, por
   consequência, da de Cenários, que é a mesma função). Se o detalhamento for julgado necessário
   para auditoria, seu lugar é a aba **Análise Financeira** ou a Reconciliação — não a tabela que a
   #349 acabou de enxugar.
2. Remover a linha de rodapé `Fluxo de Caixa Livre (antes do funding)` da tabela principal: a
   comparação FCL × FC real é o conteúdo da aba Análise Financeira, onde já existe com as duas
   pontas e a ponte entre elas.
3. `chavesColapso` (`frontend/fluxo-tabela.ts:618-624`) perde as chaves `fin-prod-*` junto; o
   `chavesColapsoBase` não muda.

## Como corrigir
Retirar os blocos de `frontend/fluxo-tabela.ts:593-606` e `:610`, e as chaves correspondentes em
`:618-624`. Nada mais precisa mudar: os dois blocos removidos têm total e VPL **zerados**, logo não
participam de nenhum subtotal.

⚠️ **Antes de executar, confirme a P5 do B1 com o autor:** se ele usa esse bloco na prática para
conferir liberação × juros × amortização, a issue vira "**mover** para a aba Análise Financeira" em
vez de "remover".

## Critério de aceite
1. `grep -n "detalhamento" frontend/fluxo-tabela.ts` **não retorna nada**.
2. Com um estudo com financiamento à produção, a tabela de Fluxo tem exatamente: Receita Bruta — VGV
   (+ grupos de Receitas) · a ponte de deduções quando houver · Funding — Capital (entradas) · Custo
   Total (+ os 5 grupos, com as saídas dentro de Financeiro) · Fluxo Mensal · Fluxo Acumulado.
3. Os totais e o VPL do rodapé **não mudam** — o bloco removido já tinha total e VPL zerados, então
   este é um teste de regressão barato e decisivo.
4. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
O bloco `Funding — Capital (entradas)` (`frontend/fluxo-tabela.ts:562-569`). Ele é a tradução direta
da cláusula "capital entrando" do pedido e não tem categoria de receita preexistente onde caber; se o
autor quiser que ele também vire sub-linha de outro grupo, isso é decisão dele, não defeito.

Sem-fechamento: #349 executora original do item 41 na Rodada 7, já fechada; esta issue cobre a cláusula "Somente isso" na condição com funding
<<<END>>>

<<<ISSUE>>>
title: question(preliminar): "Produtos é a última da lista" quer dizer depois de Permutas?
priority: 3
sources: B1 §3.3 (8-B.3) · B1 §5 P1
---
## Contexto
Item **2** da `lista bugs 20260807.xlsx`. A cláusula é ambígua e **não é um defeito**: é uma frase do
autor que resolve. Escrever a issue de conserto antes da resposta seria inventar o requisito — por
isso esta é uma pergunta, não um `fix`.

## Comportamento atual
`frontend/tela-preliminar.ts:49-52` — a ordem das abas é
`Terreno & Áreas · Custos · Produtos · Permutas`.

O implementador registrou a interpretação que usou na própria mensagem do commit `74cb2c7`:
*"Produtos (última da lista, **antes de Permutas**)"*. Antes da divisão a ordem era
`Terreno & Áreas · Produtos & Custos · Permutas`, então a posição relativa a Permutas **não mudou** —
a leitura "última das duas novas" é defensável.

## Consequência
Nenhuma, além do item ficar 🟡 parcial na auditoria. É a diferença entre trocar duas linhas e não
trocar nada.

## Comportamento esperado
Uma das duas, conforme a resposta:
- **(a) leitura literal** — `Terreno & Áreas · Custos · Permutas · Produtos`;
- **(b) leitura do implementador** — fica como está, e o item 2 fecha como confirmado.

## Como corrigir
Se a resposta for (a): trocar duas linhas em `frontend/tela-preliminar.ts:51-52`. Se for (b):
nenhuma alteração de código — a issue fecha com o registro da decisão.

## Critério de aceite
1. Uma frase do autor escolhendo (a) ou (b).
2. Se (a): a ordem em `frontend/tela-preliminar.ts:49-52` reflete a escolha e
   `bash scripts/validar-frontend.sh` fica verde.
3. Em qualquer caso, sem migração → **a `versao` não bumpa**.

## Fora de escopo
Qualquer outra mudança na navegação do Preliminar.

Sem-fechamento: a executora original do item 2 na Rodada 7 (commit `74cb2c7`) já fechou; esta issue trata só da cláusula ambígua de ordem
<<<END>>>

<<<ISSUE>>>
title: question(auditoria): três itens da lista de bugs só fecham com os prints da planilha (38, 43, 45)
priority: 3
sources: B1 §4 · B1 §5 P3
---
## Contexto
As abas `#38`, `#39`, `#43` e `#45` da `lista bugs 20260807.xlsx` contêm imagens — confirmado no
pacote: `xl/media/image1..7.png`, referenciadas por `drawing1..4.xml`, uma por aba. **Nenhum agente
desta rodada consegue ver imagem.** O item 39 foi confirmado por código
(`frontend/fluxo-tabela.ts:57-92`); sobram três, e para os três o veredito depende de olhar a figura.

Esta issue existe pelo motivo que o B1 formulou na P3: *"deixar sem registro é como o item 45 chegou
até aqui sem ninguém notar que ninguém o verificou"*. Ela custa três olhadas do autor.

## Comportamento atual
**Item 38 — coluna Orçamento com Permuta física.** A renderização lado a lado existe
(`frontend/tela-fluxo-custos.ts:330-332`). O que não se sabe é se ela respeita a "largura atual"
que o pedido diz não poder aumentar: `urbi-select` 130px + gap 6px + `viab-num` 90px = **226px**,
contra o caso normal (`.orc` em coluna, `viab-num` 110px + badges que quebram linha). O comentário
`:327-329` **afirma** que não alarga; nada no repositório mede isso.

**Item 43 — formato da tabela da Proforma do Avançado.** A tabela existe, com segmentação própria
(`frontend/proforma-avancado.ts:110-126`): Receita bruta → deduções → Receita líquida → Custo direto
→ Custo indireto → Resultado, com Terreno/Construção/Gestão/Decoração/Manutenção/Despesas
Financeiras no direto e só Marketing global + Gestão indireta no indireto. O comentário
`:124-126` **afirma** ser "a tradução da segmentação da imagem". Isso não é conferível sem a imagem.

**Item 45 — cálculo automático de área permutada.** O corpo do pedido é literalmente *"Olhe a aba
#45 para saber como mostrar o cálculo automático de área permutada"* — **não há requisito textual
nenhum**. Existe hoje um total automático no rodapé do grupo Terreno, como par rótulo/valor "Área
permutada · X m²", só quando > 0 (`frontend/tela-fluxo-custos.ts:447-451,477-479`).

## Consequência
Três itens da lista de 47 ficam em estado indefinido. O item 45 é o mais grave: ele atravessou a
Rodada 7 inteira sem que ninguém registrasse que **ninguém tinha como verificá-lo**.

## Comportamento esperado
Um veredito "bate" / "não bate" por item, registrado nesta issue. Onde não bater, nasce uma issue de
conserto com o requisito finalmente escrito em texto.

## Como corrigir
**O que precisa ser visto, item a item:**

| Item | Abra | E responda |
|---:|---|---|
| **38** | aba `#38` | Qual é o layout-alvo da coluna Orçamento numa linha de Permuta física, e **qual é a "largura atual" que não pode aumentar**? Alternativa objetiva sem opinião: com a tela aberta, um `getBoundingClientRect()` na `<td>` de uma linha de permuta e na de uma linha comum **do mesmo grupo Terreno** — se a de permuta for mais larga, o item não está entregue |
| **43** | aba `#43` | A tabela da aba Proforma do Avançado bate com a imagem — **quais linhas, em que ordem, com que agrupamento**? O pedido diz explicitamente que *"é diferente da segmentação encontrada em fluxo de caixa"*, então a resposta precisa ser sobre a segmentação, não sobre os números |
| **45** | aba `#45` | O total de área permutada deve aparecer **por tipologia** ou **agregado**? E **onde** — dentro da tabela ou no rodapé do grupo? Se a imagem mostrar por tipologia, o item não está entregue: `permutaFisicaPorTipologia` já devolve a quebra e o código a **soma** |

Um agente com acesso à instância pode encurtar isto tirando o print equivalente da tela atual, para o
autor comparar os dois lado a lado. Não é preciso que nenhum agente veja a planilha — só que alguém
que veja emita o veredito.

## Critério de aceite
1. Três respostas registradas, uma por item.
2. Para cada "não bate", uma issue de conserto com o requisito **escrito em texto** — nunca "ver a
   aba #NN".
3. Nenhuma alteração de código nesta issue. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
Adivinhar o requisito a partir do código existente. Foi tentado nas duas rodadas de auditoria e não
produz veredito — produz a suposição de que o comentário do implementador está certo, que é
exatamente o que precisa ser conferido.

Sem-fechamento: as executoras dos itens 38, 43 e 45 na Rodada 7 já fecharam; esta issue confere o que nenhuma delas pôde conferir sem a imagem
<<<END>>>

<<<ISSUE>>>
title: docs(vocabulario): "Capital Stack" sobreviveu à #355 em texto de tela e no schema.json
priority: 2
sources: A4 §3 A6 · A4 §3 A7
---
## Contexto
A #355 apagou o Capital Stack do código — saíram `capital-stack-motor.ts`, `tela-capital-stack.ts`,
`backend/rotas/capital-stack.ts` e os 16 golden cases. O **vocabulário** não saiu junto: um texto
visível ao usuário e o `schema.json` ainda falam do modelo que deixou de existir.

## Comportamento atual
- **Visível ao usuário:** `frontend/tela-fluxo-ver.ts:295` — *"Este estudo não tem camadas de
  **Capital Stack**: sem funding, o Fluxo de Caixa real é…"*. É a única ocorrência que o usuário lê.
- **Em comentário** (não visível, mas desorienta quem lê o código): `frontend/tela-fluxo-ver.ts:56`
  e `:63`, `frontend/tela-financeiro.ts:13` e `:22`, `frontend/fluxo-tabela.ts:633`,
  `frontend/proforma-avancado.ts:67`, `frontend/tela-avancado.ts:94`, `frontend/tela-funding.ts:25`,
  `frontend/viabilidade-api.ts:257`, `frontend/fluxo-apresentacao.test.ts:170`.
- **No schema:** `schema.json:380-393` ainda declara `avancado_capital_instrumentos`, com `tipo` em
  `["financiamento_producao","capital_giro","preferred_equity","sponsor_equity"]` (`:384`) — o
  vocabulário do modelo apagado.

## Consequência
O texto de `:295` mostra ao usuário o nome de um conceito que a app não tem mais — o mesmo tipo de
resíduo que o item 41 da lista de bugs relatou como *"a continuação da tabela com o título que
começa com Programa Financeiro (Capital Sta…)"*.

E o `schema.json:384` é **a única fonte no repositório onde `capital_giro` aparece como conceito
válido** — exatamente o termo que um agente investigando capital de giro vai procurar primeiro, e
que o levará a concluir que o app tem um tipo que o backend rejeita
(`backend/rotas/funding.ts:43`, `backend/rotas/funding.test.ts:26`).

## Comportamento esperado
- O texto de tela usa o vocabulário vigente: **funding** / **operações de funding**.
- Os comentários que descrevem a substituição (#355) podem e devem citar "Capital Stack" — são
  história e ajudam. Os que ainda descrevem o Capital Stack como **presente** mudam de tempo verbal.
- `avancado_capital_instrumentos` **permanece** no `schema.json` (decisão 4 do autor: guarda o dado
  migrado pela `019`, e as migrações `019`/`028`/`029` a leem — apagá-la quebra a cadeia), mas passa
  a estar **documentada como tabela histórica** num lugar que alguém leia.

## Como corrigir
1. `frontend/tela-fluxo-ver.ts:295` — trocar *"não tem camadas de Capital Stack"* por *"não tem
   operações de funding"*, preservando o resto da frase.
2. Varrer os comentários listados acima e ajustar só os que descrevem o Capital Stack como presente
   (`tela-financeiro.ts:22` — *"dívida agora vivem no Capital Stack"* — é o caso mais claro).
3. **A anotação sobre `avancado_capital_instrumentos` NÃO vai no `schema.json`.** JSON não tem
   comentário, e um bloco `//` ali derrubou a release v0.1.19 — é a razão de existir o
   `scripts/guard-json.mjs` (ver `CLAUDE.md` § Validação). A anotação vai em
   `docs/viabilidade/funding-capital-stack.md`, que já é o ADR histórico do modelo, numa nota do
   tipo:
   > A tabela `avancado_capital_instrumentos` (`schema.json:380-393`) continua declarada e **não
   > deve ser apagada**: as migrações `019`/`028`/`029` a leem e ela guarda o dado migrado pela
   > `019`. Seu vocabulário — inclusive `capital_giro` em `:384` — é do modelo apagado pela #355 e
   > **não** descreve nenhum tipo aceito hoje; os tipos vigentes são
   > `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`).

## Critério de aceite
1. `grep -rn "Capital Stack" frontend/ | grep -v "^\S*:[0-9]*: *[/*]"` não retorna nenhuma
   ocorrência em template literal renderizado ao usuário.
2. `docs/viabilidade/funding-capital-stack.md` explica por que `avancado_capital_instrumentos`
   continua no schema e que `capital_giro` ali não é um tipo válido.
3. `schema.json` **não** é alterado (nem por comentário — `node scripts/guard-json.mjs` verde).
4. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
- Apagar a tabela `avancado_capital_instrumentos` — decisão 4 do autor: **não** nesta rodada.
- Dar a `divida` um rótulo que diga "capital de giro" — é a issue **E9**.
<<<END>>>

<<<ISSUE>>>
title: question(corretagem): a corretagem incide sobre a permuta física por decisão ou por base errada?
priority: 2
sources: A4 §3 A4 · A4 §2 (P7) · A4 §6.6 (P7 segue em aberto)
---
## Contexto
Duas bases de VGV concorrentes convivem no motor desde que a unificação pedida pela #227 ficou pela
metade — o próprio motor registra isso em `frontend/fluxo-caixa-motor.ts:258-263`. Esta é a **P7** do
A4, a única das sete perguntas da Rodada 1 que atravessou as duas rodadas **sem nenhum agente
tocá-la**: o A5 não tinha, na instância, estudo com permuta física ativa para medir o efeito.

## Comportamento atual
- `vgvVendidoMensal` (`frontend/fluxo-shared.ts:676-693`) — base da **corretagem** — reparte o
  **VGV bruto** (`vgvLinha`).
- `vendaBrutaContratadaMensal` (`frontend/fluxo-caixa-motor.ts:424`) — base da **baixa de estoque** —
  reparte o **VGV vendável**, que **exclui** a permuta física.

Ou seja, num estudo com permuta física as duas séries divergem, e a corretagem é calculada sobre uma
base que inclui unidades que não foram vendidas.

## Consequência
A corretagem é cobrada sobre unidades permutadas. O sinal do erro é conhecido (superestima o custo de
corretagem), a magnitude não — nenhum estudo medido nesta rodada tem permuta física ativa. O
`padrao-incorporacao.md:1136-1142` (§12.2) **já documenta** as duas bases divergentes e foi conferido
como verdadeiro pelo A4; o que falta não é documentação, é a decisão.

## Comportamento esperado
Uma das duas, conforme a resposta do autor:
- **(a) é intencional** — o corretor intermediou o negócio do terreno, a comissão é devida sobre a
  unidade permutada. Então `vgvVendidoMensal` está certo, o §12.2 ganha a justificativa econômica em
  vez de ser listado como divergência, e o assunto fecha.
- **(b) é base errada herdada da #227** — então a corretagem passa a usar a base vendável, e a
  unificação que a #227 pediu se completa em `frontend/fluxo-caixa-motor.ts:258-263`.

## Como corrigir
Se (b): unificar as duas funções numa só, como a #227 pedia, mantendo a distinção explícita entre
"bruto" e "vendável" no nome. **Antes de mexer**, construir um estudo de teste com permuta física
ativa e registrar a corretagem antes/depois — hoje não existe caso medido, e sem ele a regressão é
invisível.

## Critério de aceite
1. Uma frase do autor escolhendo (a) ou (b).
2. Se (a): `padrao-incorporacao.md:1136-1142` passa a explicar **por que** as bases diferem, e deixa
   de ser rotulado como divergência.
3. Se (b): existe teste com estudo de permuta física ativa comparando a corretagem nas duas bases, e
   `frontend/fluxo-caixa-motor.ts:258-263` deixa de registrar unificação incompleta.
4. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
Qualquer outra consequência das duas bases fora da corretagem e da baixa de estoque. Se algum agente
de receitas/absorção já abriu issue para a base de `vgvVendidoMensal`, **deduplique com ela** — o
conteúdo desta issue é a **decisão** sobre a permuta física, não a refatoração.
<<<END>>>

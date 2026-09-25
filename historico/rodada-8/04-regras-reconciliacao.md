# A4 — Lente adversarial: código × documentos

> Agente **A4** da Rodada 8. Deriva a regra a partir **do que o código faz**, e caça onde a
> documentação mente. Contraponto de A2 (planilha EVI) e A3 (planilha do investidor): onde os três
> convergirem, a regra é sólida; onde divergirem, vira pergunta ao autor.
>
> Base: `main` em `475dd24`, branch `claude/rodada-8-auditoria`. Todo achado tem `arquivo:linha`.
> **Nada aqui altera código ou documento** — os textos substitutos estão prontos para aplicar numa
> rodada seguinte.

---

## 0. Resumo executivo

**17 mentiras documentais confirmadas** (linha por linha, todas verificadas contra o código de hoje),
distribuídas assim:

| Arquivo | Mentiras |
|---|---:|
| `docs/viabilidade/padrao-incorporacao.md` | 9 |
| `docs/viabilidade/formulas.md` | 3 |
| `CLAUDE.md` | 3 |
| `frontend/fluxo-caixa-motor.ts` (comentários) | 2 |

**Zero mentiras** em `docs/viabilidade/inteligencia-evi-incorporacao.md` — ele não faz nenhuma
afirmação sobre o app (só `:13`, `:16` e `:20`, que **declaram** não descrever o app). Está limpo e
não deve ser tocado.

As três mais perigosas, por ordem de dano:

1. **A cadeia de recebíveis por safras está integrada desde a #283 e quatro lugares dizem que não.**
   Bloqueia A2 e A3 — os dois iam propor "integrar o motor de safras" como trabalho novo.
2. **`docs/viabilidade/formulas.md:63-76` diz que funding é "modelo de referência, não instalado".**
   É o oposto: `funding-motor.ts` (862 l) roda 3 operações, com cash sweep e golden test de 80
   períodos. Quem ler isso reimplementa funding do zero.
3. **`padrao-incorporacao.md:636-643` afirma que a duração do Pós-chaves é "livre e editável" e pede
   uma issue para travá-la em 12.** O código já a travou (`APOS_CHAVES_MESES`) — e o dossiê da
   Rodada 8 registra o travamento como *lacuna* (§4.5 item 5). Documento e dossiê discordam entre si
   e os dois discordam do modelo aprovado no próprio §8.5. **Isso precisa do autor.**

---

## 1. Mentiras documentais confirmadas

Formato: onde está → o que diz → o que o código faz (com prova) → **texto substituto pronto**.

### M1 — `frontend/fluxo-caixa-motor.ts:509-514`

**Diz:** *"Este PR entrega o TIPO e o ADAPTER (`componentesDoLegado`); a matemática de safra/PMT que
os CONSOME é #232+ — `receitaMensalLinha` continua lendo o `fluxo_pagamento` legado diretamente, sem
mudança de comportamento nesta issue."*

**O código faz:** `recebimentoBrutoMensal` (`:1335`) consulta o caminho canônico **antes** de
qualquer coisa: `:1340-1341` — `const canonico = recebiveisComponentesLinha(...); if (canonico)
return canonico.recebimentoBrutoMensal;`. `recebiveisComponentesLinha` (`:1165-1183`) dispara sempre
que `Array.isArray(linha.fluxo_pagamento.componentes)`. O mesmo arquivo já se contradiz em `:626-627`
(*"Desde a #283, o motor real consome o contrato canônico"*) e em `:2009-2011`.

**Texto substituto (substitui as linhas 509-514):**

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

---

### M2 — `frontend/fluxo-caixa-motor.ts:643-649`

**Diz:** *"São o motor de cálculo que o corpo de #230 previa para #232+; NÃO estão ligadas a
`receitaMensalLinha`/`calcularFluxo` nesta fase — nenhum estudo existente muda de resultado. A
integração ao fluxo consolidado (…) é trabalho de issue futura, quando a UI oferecer o novo modelo;
até lá, o motor legado (`entrada`/`parcelas`/`repasse`) continua sendo o único caminho de cálculo
real."*

**O código faz:** `calcularFluxo:2025-2053` agrega, por linha, `principalRecebidoMensal`,
`jurosClientesMensal`, `carteiraClientesMensal`, `repasseMensal` e as duas famílias de séries por
componente, **a partir de `recebiveisComponentesLinha`**. Teste `frontend/fluxo-caixa-motor.test.ts:
1762-1787` (*"#283 linha opt-in alimenta juros, principal e carteira no FluxoCalc"*) prova
`r.jurosClientes > 0` e `r.carteiraClientesMaxima > 0` saindo de `calcularFluxo`. O contrário está em
`:1828-1854`. Mais forte ainda: **a UI grava `componentes` em toda escrita** —
`fluxo-pagamento-editor.ts:90` (`componentes: componentesDoLegado(form, cronograma)`), então todo
Grupo cujo modal de pagamento foi aplicado desde a #248 já roda pelo caminho canônico.

**Texto substituto (substitui as linhas 643-649):**

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

---

### M3 — `CLAUDE.md:98-101`

**Diz:** *"O maior buraco: nove issues da cadeia EVI de recebíveis (#230, #232–#237, #240, #241) têm
a matemática pronta e testada, mas **não ligada a `calcularFluxo`** — o próprio motor declara isso em
`frontend/fluxo-caixa-motor.ts:505-511`. A integração virou a **#283**, e ela é precondição das
nove."*

**O código faz:** a #283 **fechou com diff** — ver M1/M2. A citação `:505-511` aponta hoje para o
comentário morto, não para uma limitação real.

**Texto substituto (substitui as linhas 98-101):**

```
> O maior buraco daquela triagem — nove issues da cadeia EVI de recebíveis (#230, #232–#237, #240,
> #241) com a matemática pronta mas **não ligada a `calcularFluxo`** — **foi fechado pela #283**:
> `recebimentoBrutoMensal` consulta o contrato canônico em
> `frontend/fluxo-caixa-motor.ts:1340-1341` e `calcularFluxo` agrega juros, principal, carteira e
> repasse em `:2025-2053` (teste `frontend/fluxo-caixa-motor.test.ts:1762-1787`). A porta é
> `fluxo_pagamento.componentes`, que `frontend/fluxo-pagamento-editor.ts:90` grava em toda escrita.
> **O que continua faltando não é a integração, é o INPUT**: o adaptador legado fixa `taxaMensal: 0`
> e `sinalPct: 0` (`frontend/fluxo-caixa-motor.ts:589,601,608,617`) e o modal não tem campo de taxa
> nem de sinal (`frontend/tela-fluxo-receitas.ts:741-816`) — então `jurosClientes` é **sempre 0** em
> estudo real, com toda a matemática de juros exercitada só por teste.
```

---

### M4 — `docs/viabilidade/formulas.md:38-59` (bloco inteiro; o núcleo da mentira é `:51-54`)

**Diz:** *"Elas são **modelo funcional de referência**, não comportamento instalado: o motor atual
(`frontend/fluxo-caixa-motor.ts`) rateia valor nominal e não tem safra, juros do cliente nem carteira.
A implementação depende das issues #230–#237 da Rodada 5, cujos corpos ainda precisam de emenda."*

**O código faz:** tem safra (`ContratacaoSafra`, `:958-962`; laço `:1094`), tem juros do cliente
(`jurosSafra`, alocado em `:1113-1127`), tem carteira (`carteiraSaldoSafra`,
`consolidarCarteiraClientes` `:1191`), e tem PMT (`pmt`, `:653`).

**Texto substituto (substitui as linhas 38-59):**

```markdown
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

> ⚠️ **A matemática de juros existe, mas nenhum estudo real a exercita.** O adaptador legado fixa
> `taxaMensal: 0` e `sinalPct: 0` (`fluxo-caixa-motor.ts:589,601,608,617`) e o modal de Fluxo de
> Pagamento não tem campo de taxa nem de sinal (`frontend/tela-fluxo-receitas.ts:741-816`). Logo
> `jurosClientes` é **sempre 0** fora de teste. Abrir esses dois campos é o que falta.

> 🚫 **Não copiar fórmula de carteira do arquivo Urbitá.** As fórmulas de carteira daquele arquivo
> admitem saldo negativo e saldo que volta a crescer depois da última parcela. A recorrência correta
> é por safra: `saldo_s,s = principal_s`, depois
> `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t` — que é o que
> `validarComponentesSafra` (`frontend/fluxo-invariantes.ts:404`) fiscaliza.
```

---

### M5 — `docs/viabilidade/formulas.md:61-76` (§ Funding e Capital Stack)

**Diz:** *"Nada desta seção descreve runtime. A aba `Viabilidade → Financeiro` é hoje **inteiramente
inerte**: ~25 colunas persistidas e renderizadas, **zero** referências no motor. (…) São **modelo
funcional de referência**, não comportamento instalado. A implementação depende da epic #239 e das
dez sub-issues #270–#279."*

**O código faz:** três coisas desmentem isso.
(a) o funding roda — `frontend/funding-motor.ts` (862 l): `simularDivida:237`,
`simularFinanciamentoProducao:312`, `simularEquity:425`, `fundingDoEstudo:710`, com oráculo
`frontend/financiamento-producao-golden.test.ts`;
(b) a epic #239/Capital Stack **deixou de existir** — a #355 a substituiu por 3 operações sem
waterfall (`docs/viabilidade/funding-capital-stack.md:11-35` já diz isso; `formulas.md` não foi
atualizado);
(c) a aba Financeiro **não** renderiza mais ~25 colunas — a #279 retirou 9 controles e a #355 tirou
`financiamento_*`, `investidor_*`, `estrutura_*_pct` (`frontend/tela-financeiro.ts:16-22,49-57`). O
que sobrou em tela é `taxa_desconto_aa` (lido: VPL/TIR), `sujeito_ret`/`imposto_percentual` (lidos
pelo **Preliminar**, `frontend/proforma.ts:245`) e 6 controles genuinamente inertes —
`regime_tributario` e os 5 `aliquota_*_pct` (`tela-financeiro.ts:187-193`) — mais
`imposto_sobre_permuta_fisica` (`:182`).

**Texto substituto (substitui as linhas 61-86):**

```markdown
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

> ⚠️ **Capital de giro, linha rotativa e empréstimo-ponte não existem.** Os tipos aceitos são
> exatamente `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`);
> `capital_giro` é rejeitado com `tipo deve ser um de…` (`backend/rotas/funding.test.ts:26`).

> ⚠️ **O que continua inerte na aba `Viabilidade → Financeiro`**, e só isso: `regime_tributario` e
> os cinco `aliquota_*_pct` (`frontend/tela-financeiro.ts:187-193`), mais
> `imposto_sobre_permuta_fisica` (`:182`). Nenhum motor os lê. Os campos de financiamento,
> investidor, estrutura de capital e correção monetária **saíram da tela** (#279/#355); as colunas
> continuam no schema, sem formulário e sem leitor.
```

---

### M6 — `docs/viabilidade/formulas.md:123-132` (tabela "Estado de conformidade, conferido")

**Diz:** `frontend/viab-format.ts:8 — fmtR$` com **0** casas ❌; `tela-fluxo-custos.ts:638,873-875`
com **0** casas ❌; `fluxo-caixa-motor.ts` "float sem quantização" ❌.

**O código faz:** `viab-format.ts:11-23` — `CASAS_DECIMAIS_MONETARIAS = 2`, com `minimum` e
`maximumFractionDigits` nos dois. O orçamento em `rs` já usa 2 casas
(`tela-fluxo-custos.ts:673,933`). O motor quantiza com `round2` em cada série
(`fluxo-caixa-motor.ts:432,472,483,1443` e todo o laço `:2028-2047`), com a convenção C7 citada nos
próprios comentários. E `frontend/exportar.ts` **não define mais formatador próprio** — importa
`fmtR$` de `viab-format.js` (`exportar.ts:10`); `grep` por `toFixed(2)` no arquivo dá **zero**.

**Texto substituto (substitui as linhas 123-135):**

```markdown
**Estado de conformidade, conferido em 2026-08-21:**

| Ponto | Casas hoje | Conforme? |
|---|---|---|
| `frontend/viab-format.ts:11-23` — `fmtR$` (`CASAS_DECIMAIS_MONETARIAS = 2`) | 2 | ✅ |
| `frontend/exportar.ts:10` — importa `fmtR$`, sem formatador próprio | 2 | ✅ |
| `frontend/tela-financeiro.ts:143` | 2 | ✅ |
| `frontend/tela-empreendimento-tipologias.ts:178` | 2 (default) | ✅ |
| `frontend/tela-fluxo-custos.ts:673,933` — Orçamento em `rs` | 2 | ✅ |
| `frontend/fluxo-caixa-motor.ts` — resultados monetários (`round2`, C7) | 2 | ✅ |
| **`frontend/viab-format.ts:24-25` — `fmtNum`** | **≤ d, sem mínimo** | ❌ **`tela-proforma.ts:453` chama `fmtNum(v, 2)` e número redondo sai sem as casas** |

Áreas (m²) seguem `decimal(12,2)` na persistência; a regra de resultado acima é declarada para
**valor monetário**.
```

---

### M7 — `CLAUDE.md:471-477` (nota do contrato de precisão)

**Diz:** *"**O que ainda falta** é `frontend/exportar.ts:10` deixar de definir o seu próprio
`const R$ = v.toFixed(2)`: enquanto houver duas fontes de formatação, tela e exportação podem
divergir de novo. Continua sendo a #281."*

**O código faz:** `frontend/exportar.ts:10` é `import { fmtR$, fmtNum, fmtPct } from
'./viab-format.js';`. Não existe `const R$` nem `toFixed(2)` no arquivo. A #281 entregou esta parte.

**Texto substituto (substitui as linhas 471-477):**

```
  > ⚠️ **Resolvido para R$, ainda aberto para `fmtNum`.** `frontend/viab-format.ts:13-23` usa 2
  > casas com mínimo e máximo, o Orçamento de Custos em `rs` também
  > (`frontend/tela-fluxo-custos.ts:673,933`), e `frontend/exportar.ts:10` passou a **importar**
  > `fmtR$` em vez de definir formatador próprio — a fonte de formatação monetária é única. **O que
  > falta** é `fmtNum` (`frontend/viab-format.ts:24-25`), que declara só `maximumFractionDigits`:
  > `frontend/tela-proforma.ts:453` chama `fmtNum(v, 2)` prometendo 2 casas e o número redondo sai
  > sem elas. Resto da #281 — não corrija pontualmente.
```

---

### M8 — `CLAUDE.md:63-68` (caixa "Auditoria de 2026-08-17")

**Diz:** que a spec `fluxo-investidor-formulas.md` nunca entrou no repo, que a decisão **D14** não
foi implementada, que a seção continuava dizendo "Rodada 7 aberta", e que *"as três viraram as issues
#413, #414 e #416"* + a #415 do aviso regulatório. Redação em tempo presente: lê-se como backlog
aberto.

**O código faz:** as quatro fecharam pelo commit `ba06add` (*"fix: as 4 lacunas de issues fechadas
sem entrega (auditoria de 2026-08-17) (#417)"*, `closes #413, closes #414, closes #415, closes
#416`). Prova: `docs/viabilidade/fluxo-investidor-formulas.md` existe (242 l);
`frontend/fluxo-invariantes.ts:376-387` implementa D14 (`CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`);
`frontend/tela-funding.ts:106-107,615-619` traz o aviso regulatório da §17.

**Texto substituto (substitui as linhas 63-72):**

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

---

### M9 — `docs/viabilidade/padrao-incorporacao.md:609-615` (§8.3)

**Diz:** *"`faixasAbsorcao` (…) deriva a faixa `obra` como `inicio_mes` até `inicio_mes +
duracao_meses − 1` do **evento Obra inteiro**. Como a Obra cobre o Pré-lançamento e o Lançamento, os
três períodos comerciais **se sobrepõem**. **Evolução dependente de issue.** EVI-006."*

**O código faz:** `frontend/fluxo-shared.ts:276-278` — *"#225: 'Durante a obra' começa no mês
seguinte ao fim do Lançamento"*: `obra: { inicio: lanc.inicio_mes + max(1, lanc.duracao_meses), fim:
obra.inicio_mes + max(1, obra.duracao_meses) − 1 }`. A sobreposição foi eliminada; o caso degenerado
tem aviso próprio (`problemaJanelaDuranteObra`, `:292-302`).

**Texto substituto:**

```
> ✅ **Comportamento vigente, alinhado ao padrão (#225).** `faixasAbsorcao`, em
> `frontend/fluxo-shared.ts:257-283`, deriva "Durante a obra" a partir do **mês seguinte ao fim do
> Lançamento** (`:276-278`), não do início físico da Obra — os quatro períodos comerciais são
> contíguos e não se sobrepõem. Quando o Lançamento termina em ou depois do fim da Obra, a faixa
> fica vazia e `problemaJanelaDuranteObra` (`:292-302`) devolve o texto que a UI mostra, em vez de
> calcular em silêncio. Pré-lançamento ausente vira faixa vazia (`fim < inicio`, `:270-272`).
```

---

### M10 — `docs/viabilidade/padrao-incorporacao.md:636-643` (§8.5)

**Diz:** *"O início já é o mês seguinte ao fim da Obra (…), mas a **duração é livre e editável**:
`faixasAbsorcao` lê `Math.max(1, Math.round(posObraMeses ?? pos.duracao_meses))`. Há estudos gravados
com duração diferente de 12. **Evolução dependente de issue.** EVI-007 — fixar a janela em 12 meses."*

**O código faz:** exatamente o contrário. `frontend/fluxo-shared.ts:237` —
`export const APOS_CHAVES_MESES = 12;`, com o comentário `:228-236` declarando que é **constante do
motor, não campo editável**. `faixasAbsorcao:281` usa `pos.inicio_mes + APOS_CHAVES_MESES − 1`;
`absorcaoMensal:366-367` repete que a duração não vem mais do bloco nem do evento.

> ⚠️ **Ponto de conflito de três vias.** O §8.5 do padrão pede 12 fixos (é o **modelo aprovado**);
> o código já entrega 12 fixos; **e o dossiê da Rodada 8 registra isso como lacuna** (§4.5 item 5,
> *"Pós-chaves travado em 12 meses — não editável"*). Ver **P1** na §4.

**Texto substituto:**

```
> ✅ **Comportamento vigente, alinhado ao padrão (#226 / EVI-007).** O início é o mês seguinte ao
> fim da Obra (`pos_obra` travado por `recalcularTravados`) e a duração é a **constante**
> `APOS_CHAVES_MESES = 12` (`frontend/fluxo-shared.ts:237`), consumida em `faixasAbsorcao:281`.
> `pos_obra.duracao_meses` do Cronograma **não é lido pela absorção** — ele continua editável
> (`backend/rotas/avancado.ts:42`, `travado_duracao: false`) e continua servindo de **âncora de
> custo** para linhas pós-entrega, que é o motivo de não tê-lo travado junto. Estudos legados com
> duração diferente de 12 passaram a calcular com 12 sem migração de dado.
```

---

### M11 — `docs/viabilidade/padrao-incorporacao.md:813-822` (§10.2)

**Diz:** *"O JSON `absorcao` de `avancado_fases` guarda o modo Distribuído em **três** períodos:
`lancamento` (que cobre Pré-lançamento **e** Lançamento juntos), `obra` e `pos_obra`. (…)
**Divergência:** o padrão exige **quatro** períodos informados separadamente."*

**O código faz:** são **quatro** blocos. `frontend/tela-fluxo-receitas.ts:535-540` grava
`pre_lancamento`, `lancamento`, `obra` e `pos_obra`; `absorcaoMensal:393-396` espalha os quatro;
`pctPosObraDerivado` (`fluxo-shared.ts:324-326`) é `100 − pre − lanc − obra`. A validação de entrada
mudou de lugar e de forma: `erroFormularioAbsorcao` (`fluxo-shared.ts:337-345`, #347) barra
`pre + lanc + obra > 100`, exatamente para impedir o clamp silencioso que o `Math.max(0, …)`
escondia.

**Texto substituto:**

```
> ✅ **Comportamento vigente, alinhado ao padrão (#108/#347).** O JSON `absorcao` de
> `avancado_fases` guarda o modo **Distribuído** em **quatro** blocos —
> `pre_lancamento`, `lancamento`, `obra` e `pos_obra` (`frontend/tela-fluxo-receitas.ts:535-540`).
> Os três primeiros são informados; o Pós-chaves é **derivado**
> (`pctPosObraDerivado`, `frontend/fluxo-shared.ts:324-326`: `100 − p1 − p2 − p3`). A soma dos três
> informados é validada por `erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:337-345`) — sem
> isso, um total acima de 100% clampava no derivado e a absorção fechava abaixo de 100% sem aviso.
> Quando o Cronograma não tem Pré-lançamento, a tela nem mostra o campo e o bloco chega zerado
> (`tela-fluxo-receitas.ts:522`).
```

---

### M12 — `docs/viabilidade/padrao-incorporacao.md:895-898` (§11, nota de UX)

**Diz:** *"o editor expõe a estrutura de persistência (…) quatro periodicidades (`mensal`,
`trimestral`, `semestral`, `anual`), no máximo 4 linhas, uma periodicidade por linha, mais um checkbox
`juros` que **não alimenta cálculo nenhum** (`frontend/tela-fluxo-receitas.ts:33-34,633-637,668-681,
745-780`)."*

**O código faz:** o checkbox `juros` **não existe mais** — `grep -n "juros"
frontend/tela-fluxo-receitas.ts` devolve **zero linhas**. A badge de periodicidade também saiu
(#342, comentário em `:773-781`): toda linha nova nasce `mensal`; linha legada mantém o valor
gravado, sem controle visual, e o motor continua lendo
(`INTERVALO_PERIODICIDADE`, `fluxo-caixa-motor.ts:318-320`). Todas as referências `arquivo:linha` da
nota estão deslocadas — o modal vive hoje em `:720-830`.

**Texto substituto:**

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
> (`fluxo-caixa-motor.ts:589,601,608,617`), a matemática de juros do motor nunca é exercitada por
> estudo real.
```

---

### M13 — `docs/viabilidade/padrao-incorporacao.md:1081-1086` (§11.8)

**Diz:** *"O motor **não distingue** venda anterior de venda posterior à entrega: o mesmo
`fluxo_pagamento` do Grupo é aplicado a todas as safras, inclusive às contratadas no Após-chaves —
que assim geram parcelas e repasse como se fossem vendas pré-entrega (`frontend/fluxo-caixa-motor.ts`
→ `receitaMensalLinha`). **Evolução dependente de issue.** EVI-015 / #235."*

**O código faz:** `ehVendaAposChaves(safra, mesEntrega) → safra > mesEntrega`
(`fluxo-caixa-motor.ts:945-947`); `componentesEfetivosSafra` (`:949-956`) troca **todos** os
componentes por um `imediato` de 100% sem desconto; `componentesIntegradosSafra` (`:1030-1043`) é o
que `calcularRecebiveisComponentes:1096` chama por safra. Verdadeiro **só no caminho legado** — linha
sem `componentes` persistido.

**Texto substituto:**

```
> ✅ **Comportamento vigente no caminho canônico (#235/#283).** `ehVendaAposChaves`
> (`frontend/fluxo-caixa-motor.ts:945-947`) marca como Após-chaves toda safra com
> `safra > mesEntrega`, e `componentesEfetivosSafra` (`:949-956`) substitui os componentes do Grupo
> por um único `imediato` de 100% sem desconto — sem sinal futuro, parcela nem repasse para aquela
> venda. Cada safra é tratada isoladamente: contratos antigos não são afetados. A aplicação por
> safra está em `calcularRecebiveisComponentes:1096`, via `componentesIntegradosSafra:1030-1043`.
>
> ⚠️ **Vale só para linha com `fluxo_pagamento.componentes` persistido.** A linha que nunca passou
> pelo modal desde a #248 cai no motor legado (`recebimentoBrutoMensal:1342` em diante), que
> **não** distingue a fronteira da entrega — aplica o plano do Grupo a toda safra.
```

---

### M14 — `docs/viabilidade/padrao-incorporacao.md:1192-1200` (§13, abre-alas)

**Diz:** *"⚠️ Esta seção descreve o modelo funcional de referência, não o app instalado.
**Comportamento vigente.** `frontend/fluxo-caixa-motor.ts` distribui valores nominais por linhas de
entrada, parcelas e repasse. Não há safra, PMT, taxa aplicada ao saldo, carteira ou reconciliação por
componente."*

**O código faz:** o mesmo desmentido de M4. Além disso a **reconciliação por componente** existe:
`receitaPorComponenteMensal` e `carteiraPorComponenteMensal` (`:1077-1083`, agregadas em
`:2035-2047`) e `validarComponentesSafra` (`frontend/fluxo-invariantes.ts:404`).

**Texto substituto:**

```
> ✅ **Esta seção descreve comportamento vigente desde a #283.** `frontend/fluxo-caixa-motor.ts`
> implementa safra (`:958-962`, laço em `:1094`), PMT (`:653`), taxa sobre o saldo de abertura
> (`:1122-1123`), carteira por safra (`carteiraSaldoSafra`; consolidação em `:1191`) e
> reconciliação por componente (`receitaPorComponenteMensal`/`carteiraPorComponenteMensal`,
> `:1077-1083`, agregadas em `calcularFluxo:2035-2047`; invariantes em
> `frontend/fluxo-invariantes.ts:404`).
>
> ⚠️ **Duas ressalvas.** (1) A porta é `fluxo_pagamento.componentes` — linha nunca reeditada segue
> pelo motor legado. (2) A **taxa** chega sempre 0 pelo adaptador (`:589,601,608,617`), porque o
> modal não a oferece: a carteira existe, os juros não.
```

---

### M15 — `docs/viabilidade/padrao-incorporacao.md:1910-1914` (§18.4)

**Diz:** *"`frontend/fluxo-caixa-motor.ts` deriva o prazo sem considerar todas as parcelas e possui
fallback que empilha excedentes no último mês. **Evolução dependente de issue.** EVI-011 / #231."*

**O código faz:** `calcularFluxo:1762-1766` deriva o horizonte de
`max(ultimoCrono, ultimoRecebivel, ultimoCustos, 11) + 1`, onde `ultimoRecebivel` vem de
`ultimoMesRecebivelLinha`. O fallback silencioso foi removido — comentário `:1358-1360`: *"o fallback
SILENCIOSO que empilhava excedente no último mês foi removido"*. No caminho canônico, pagamento fora
do horizonte emite `console.warn` e **não** é computado (`deposita`, `:1085-1092`).

**Texto substituto:**

```
> ✅ **Comportamento vigente (#231).** `calcularFluxo` (`frontend/fluxo-caixa-motor.ts:1762-1766`)
> dimensiona o horizonte por `max(último mês do Cronograma, último recebível de qualquer linha,
> último mês de custo, 11) + 1`, com `ultimoMesRecebivelLinha` derivando o recebível a partir dos
> componentes normalizados. O fallback silencioso que empilhava excedente no último mês **foi
> removido** (`:1358-1360`); no caminho canônico, um pagamento fora do horizonte emite
> `console.warn` e não é computado (`:1085-1092`), em vez de deformar o último mês em silêncio.
```

---

### M16 — `docs/viabilidade/padrao-incorporacao.md:1528-1531` (§15.1, "Comportamento vigente")

**Diz:** *"a quantidade permutada é informada no **catálogo de Tipologias**
(`frontend/tela-empreendimento-tipologias.ts:212`, `schema.json:289`) e consumida pelo motor via
`vgvPermutaFisicaLinha` (`frontend/fluxo-shared.ts:149-154`, #195). Não existe vínculo tipologia ↔
quantidade na linha de custo do Terreno."*

**O código faz:** o vínculo existe. A linha de custo tem `permuta_tipologia_id` e
`permuta_quantidade` (`schema.json:373-374`), o CRUD **parou de ler/escrever**
`unidades_permutadas` (`backend/rotas/avancado.ts:744-749`, #253), e o motor faz a reserva a partir
das linhas de custo (`reservarPermutasFisicas`, chamado em `fluxo-caixa-motor.ts:1768`, projetado nas
tipologias em `:1780-1788`). Sem linha de custo `Permuta física`, o KPI é **0** e não há fallback
para o campo legado — decisão do autor de 2026-08-02 (`:1999-2006`).

**Texto substituto:**

```
> ✅ **Comportamento vigente (#266/#267/#268).** A fonte de verdade da permuta física é a **linha de
> custo** `Preço → Permuta física`, com `permuta_tipologia_id` + `permuta_quantidade`
> (`schema.json:373-374`) e valor declarado explicitamente. O CRUD de tipologias deixou de ler e
> escrever `unidades_permutadas` (`backend/rotas/avancado.ts:744-749`, #253); a coluna permanece no
> schema como dado histórico. O motor resolve a reserva em `reservarPermutasFisicas`
> (`frontend/fluxo-caixa-motor.ts:1768`) e a projeta de volta nas tipologias uma única vez
> (`:1780-1788`), para que toda função que já lia `t.unidades_permutadas` fique correta sem
> replicar a reserva. **Sem linha de custo de Permuta física, o KPI é 0** — não há fallback para o
> campo legado (`:1999-2006`, decisão do autor de 2026-08-02).
```

---

### M17 — `docs/viabilidade/padrao-incorporacao.md:1580-1584` (§15.2) e `:1746-1750` + `:1789-1799` (§17)

**§15.2 diz:** *"As duas séries que a fórmula da visão líquida consome não existem. Não há série
mensal de imposto (…) nem de corretagem."*
**O código faz:** `impostoMensal` (`frontend/fluxo-caixa-motor.ts:1434-1444`) devolve a série mensal
de RET sobre o recebimento bruto; `corretagemMensal` (`:1503`) devolve a série mensal de corretagem
com base bruto/VGV. As duas existem. O que **continua verdadeiro** no bloco é a ressalva de que
`regime_tributario`/`aliquota_*` é ignorado e que os descontos são multiplicativos.

**§17 diz** (duas vezes, `:1746-1750` e `:1789-1799`): *"a aba `Viabilidade → Financeiro` é
**inerte**. O Bloco G inteiro — ~25 colunas de financiamento, estrutura de capital, investidor e
correção — é persistido e renderizado, mas o motor não referencia nenhuma delas. Nada descrito
abaixo, nem no documento novo, está implementado."*
**O código faz:** ver M5. Financiamento à produção, dívida e equity rodam; os campos citados
**saíram da tela** na #279/#355.

**Texto substituto de §15.2 (`:1580-1589`):**

```
> ✅ **As duas séries existem (#227/#228/#346).** `impostoMensal`
> (`frontend/fluxo-caixa-motor.ts:1434-1444`) devolve a série mensal do RET aplicada ao recebimento
> bruto, com o RET já resolvido como parâmetro **global** do estudo; `corretagemMensal` (`:1503`)
> devolve a série mensal da linha de custo obrigatória "Corretagem de vendas", com base
> **bruto/VGV** — a única fonte oficial desde que a #228 removeu a dedução concorrente de
> `vglLinha`.
>
> ⚠️ **O que continua divergente:** o bloco `regime_tributario`/`aliquota_*` da aba Financeiro
> segue **ignorado** pelo motor do Avançado (`frontend/fluxo-shared.ts:208-222`), e o app aplica os
> descontos de forma **multiplicativa**, que é o que o padrão pede para evitar quando o contrato
> determina subtração direta.
```

**Texto substituto de §17 (`:1746-1750`), e o bloco `:1789-1799` deve ser APAGADO por inteiro:**

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
>
> ⚠️ **Continua ausente:** capital de giro, linha rotativa e empréstimo-ponte. Os tipos aceitos são
> exatamente `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`);
> `capital_giro` é rejeitado (`backend/rotas/funding.test.ts:26`). A §17.4 abaixo descreve o
> conceito como **modelo funcional de referência**, não como comportamento instalado.
```

---

### Trechos "vigentes" que **conferi e continuam verdadeiros** — não mexer

| Trecho | Por quê |
|---|---|
| `padrao-incorporacao.md:262-269` (§ Fase → Grupo) | A entidade continua `avancado_fases`/`fase_id`; a renomeação é só de linguagem e segue fora do backlog. |
| `padrao-incorporacao.md:1136-1142` (§12.2, bases divergentes) | Confirmado: `vgvVendidoMensal` (`fluxo-shared.ts:676-693`) usa `vgvLinha` (**bruto**) e `vendaBrutaContratadaMensal` (`fluxo-caixa-motor.ts:424`) usa `vgvVendavelLinha`. O próprio motor registra a unificação incompleta em `:258-263`. |
| `padrao-incorporacao.md:1601-1604` (§15.2, campos da permuta financeira) | Confirmado: os campos ainda somem por `distribuicao_modo`, não por subcategoria. |
| `padrao-incorporacao.md:1779-1784` (§17.2, os nove itens do financiamento à produção) | Confirmado: `simularFinanciamentoProducao` (`funding-motor.ts:312`) + golden test. |
| `inteligencia-evi-incorporacao.md` inteiro | Não faz afirmação sobre o app. **Nem A2 nem ninguém deve rebaixá-lo para casar com limitação atual.** |

---

## 2. As regras que o código pratica hoje

Formato do §6 do dossiê. Estas **não são propostas** — são o baseline contra o qual medir A2 e A3.

### R-A41 — Velocidade de vendas é % de VGV distribuído uniformemente em 4 janelas

**Veredito:** JÁ IMPLEMENTADA (e mais pobre que qualquer planilha)
**Fonte:** o código; espelhada em `padrao-incorporacao.md` §10 (com M11 corrigida)
**No código hoje:**
- `absorcaoMensal` (`frontend/fluxo-shared.ts:360-402`) só tem três modos: `distribuido` (o único que
  a UI grava), `personalizado` (dado legado) e `linear` (fallback).
- No modo `distribuido`, cada janela recebe `pct / duração` **igual em todo mês** (`:384-392`).
- As janelas vêm do Cronograma (`faixasAbsorcao:257-283`): Pré-lançamento, Lançamento, "Durante a
  obra" (do mês seguinte ao fim do Lançamento até o fim da Obra) e Pós-chaves (12 meses fixos).
- A UI fixa `modo: 'distribuido'` (`frontend/tela-fluxo-receitas.ts:533`) e nunca grava
  `personalizado`.

**Regra praticada:** *A absorção é declarada como três percentuais de VGV (Pré-lançamento,
Lançamento, Durante a obra), somando no máximo 100%; o Pós-chaves é o resíduo. Dentro de cada janela
a venda é rigorosamente uniforme. Não existe curva S, sazonalidade, VSO alvo, velocidade em
unidades/mês nem estoque físico consumido.*

**Como verificar:** `absorcaoMensal({modo:'distribuido', blocos:[{evento:'obra',pct:60}]}, crono)`
devolve `60/duração` idêntico em todo mês da janela `obra`.

**Custo/risco de mudar:** qualquer curva não-uniforme muda o mês de contratação de cada safra e,
por consequência, **toda** a série de recebíveis, a carteira e o VPL de todo estudo existente. É a
mudança de maior alcance retroativo desta rodada.

> **Para A2/A3:** o motor **já sabe** consumir uma curva arbitrária —
> `absorcaoMensal:373-379` (`modo:'personalizado'` com `absorcao.meses[]`) existe e é testado. O que
> falta é **a UI gravar**. Propor curva S custa uma tela, não um motor.

---

### R-A42 — Condições de pagamento: 4 componentes econômicos, com taxa e sinal amarrados em zero

**Veredito:** DIVERGENTE (motor completo, input capado)
**Fonte:** o código; `padrao-incorporacao.md` §11–§13
**No código hoje:**
- Contrato canônico: `ComponentePagamento` (`frontend/fluxo-caixa-motor.ts:517+`) com quatro tipos —
  `imediato` (desconto comercial), `prazo_fixo` (N parcelas, `sinalPct`, `defasagemMeses`,
  `taxaMensal`), `ate_marco` (até um marco fixo M, `N_s = M − s`) e `concentrado` (mês único).
- Persistência: `fluxoPagamentoParaSalvar` (`frontend/fluxo-pagamento-editor.ts:81-93`) grava
  **sempre** `componentes: componentesDoLegado(form, cronograma)` — mais o espelho legado.
- `componentesDoLegado` (`:573-621`) fixa `taxaMensal: 0` em `:589`, `:601`, `:608` e `:617`, e
  `sinalPct: 0` em `:588`, `:600`, `:606`.
- A UI não tem campo de taxa nem de sinal (`frontend/tela-fluxo-receitas.ts:741-816`).
- Validação: entrada + parcelas ≤ 100% (`fluxo-pagamento-editor.ts:65-68`) e componentes = 100%
  exatos (`:69-73`).
- Repasse é sempre o resíduo `100 − entradas − parcelas`, concentrado em `fimObra + 1`
  (`REPASSE_MESES_APOS_ENTREGA = 1`, `fluxo-caixa-motor.ts:325`, `#345`);
  `repasse.apos_entrega_meses` persistido **não é lido** (`fluxo-pagamento-editor.ts:14-18`).

**Regra praticada:** *Um plano de pagamento é uma lista de linhas de Entrada (% + nº de parcelas +
desconto) e até 4 linhas de Parcelamento (% + nº de parcelas, ou "ao longo da obra"), com o Repasse
derivado como resíduo e travado no 1º mês após a entrega. **A taxa de juros é sempre zero e o sinal é
sempre zero**, porque o único produtor de `componentes` é o adaptador do formato legado.*

**Como verificar:** em qualquer estudo real, `calcularFluxo(config).jurosClientes === 0`. Só o teste
`fluxo-caixa-motor.test.ts:1762` produz juros > 0, e ele monta `componentes` à mão.

**Custo/risco:** abrir taxa e sinal **não** muda estudo existente (`taxaMensal: 0` continua sendo o
default do adaptador), mas muda o VGV econômico assim que alguém preencher: com juros, a Receita
Bruta passa a exceder a Venda Líquida Contratada — e `fluxo-caixa-motor.test.ts:1781` já fixa essa
identidade (`receitaBruta ≈ vendaLiquidaContratada + jurosClientes`).

---

### R-A43 — Financiamento à construção: medição de custo com catch-up e cash sweep, um por estudo

**Veredito:** JÁ IMPLEMENTADA
**Fonte:** `docs/viabilidade/funding-capital-stack.md` §4.3 (única parte vigente daquele documento)
**No código hoje:**
- `simularFinanciamentoProducao` (`frontend/funding-motor.ts:312`) — **não usa calendário nem PMT**:
  a liberação é dirigida pela medição do **custo elegível incorrido**, com gatilho de exposição
  mínima, catch-up retroativo na 1ª liberação, juros capitalizados sobre o saldo anterior e
  amortização por **cash sweep** contra o caixa livre do projeto.
- Base financiável: `custo_linha_ids` da operação; sem seleção explícita, cai em
  `linhasFinanciaveisPadrao` (`:614-616`) via `eFinanciavelPadrao`. Seleção **explicitamente vazia**
  (`[]`) é respeitada — quem desmarcou tudo quis desmarcar tudo (`:611-612`, `fundingDoEstudo:728-730`).
- Janela: meses de obra + mês da entrega (`janelaLiberacaoDeMarcos:619-626`); gate de chaves em
  `mesEntrega + 1` (`fundingDoEstudo:724`).
- Defaults: exposição mínima 20%, financiável 80%, amortizar com caixa = true (`:123-125`).
- **Único por estudo**, por exigência explícita do autor: `conflitoFinanciamentoUnico`
  (`backend/rotas/funding.ts:150-158`).
- Degradação segura: sem cronograma/custos, roda sem janela e sem base → **nenhuma liberação**
  (`funding-motor.ts:705-708`).
- Oráculo: `frontend/financiamento-producao-golden.test.ts`, 80 períodos, tolerância R$ 0,15.

**Regra praticada:** *É o único produto de dívida cujo desembolso e amortização dependem do fluxo de
caixa do projeto, e o único que **não** segue a planilha `fluxo_investidor_FORMULAS`. Não tem
tarifa, taxa de administração nem taxa de estruturação.*

**Custo/risco:** nenhum, se não for tocado. **A3 tende a propor modelá-lo pela planilha nova** — o
que reverteria o catch-up retroativo aprovado na #405. Ver **P3** na §4.

---

### R-A44 — Dívida (`divida`): calendário puro, PMT Price, sem checar caixa

**Veredito:** JÁ IMPLEMENTADA
**Fonte:** `docs/viabilidade/fluxo-investidor-formulas.md`, aba `divida`
**No código hoje:** `simularDivida` (`frontend/funding-motor.ts:237-292`).
- Duas âncoras: `ini = inicio_mes + nTranches`; `fim = ini − 1 + amortização` (`:250-252`).
- Aporte único ou em `aporte_meses` tranches iguais (`:264-266`).
- Juros sobre o **saldo de abertura**, só dentro da janela (`:268`).
- **Base do PMT com aporte distribuído não é `valor`**: é o valor futuro das tranches capitalizado,
  `valor/n × ((1+i)^n − 1)/i` (`:255-257`) — usar `valor` cru deixaria saldo residual.
- Carência paga só juros (`:274`); o mês `fim` quita o devido inteiro (`:273`).
- `taxaMensalEquivalente` (`:69`) converte a.a. → a.m. por equivalência composta, não linear.

**Regra praticada:** *A dívida paga pelo calendário, independentemente de haver caixa no projeto. O
risco de o caixa alavancado mergulhar é sinalizado por `validarFunding`
(`frontend/fluxo-invariantes.ts:376-387`, alerta D14), nunca bloqueado.*

**Custo/risco:** limitar o pagamento ao caixa mudaria todo estudo com dívida e contrariaria a
planilha. Não fazer sem decisão explícita.

---

### R-A45 — Equity: aporte único e retorno em dois modos, sem preferred return e sem waterfall

**Veredito:** DIVERGENTE do vocabulário de mercado; **aderente** à planilha
**Fonte:** `docs/viabilidade/fluxo-investidor-formulas.md`, aba `equity`
**No código hoje:** `simularEquity` (`frontend/funding-motor.ts:425-455`).
- Aporte: **um valor, num mês** (`:439`) — não há chamada de capital em tranches.
- `permuta_financeira`: `pct` sobre a **receita líquida mensal**, mês a mês (`:441`).
- `resultado_final`: `pct` sobre o **resultado final**, num pagamento único no mês do repasse (`:443`).
- `juros` e `saldo` são séries **sempre zeradas** (`:452-453`) — equity não abre saldo devedor, e por
  isso `validarFunding` o ignora (`fluxo-invariantes.ts:347`).
- Indicadores por operação: `investimentoTotal`, `retornoTotal`, MOIC (`:117`), TIR
  (`tirMensal:90` / `tirAnual:111`).

**Regra praticada:** *Não existe preferred return, hurdle, catch-up nem waterfall. O equity é um
percentual fixo sobre uma de duas bases, pago sem teto de caixa.*

**Custo/risco:** introduzir hurdle é modelo novo, não ajuste — e o autor já retirou o waterfall uma
vez, de propósito (#355). Ver **P4**.

---

### R-A46 — Capital de giro, rotativo e ponte: rejeitados na porta

**Veredito:** AUSENTE, por construção
**Fonte:** `padrao-incorporacao.md:1820-1832` (§17.4) pede o conceito
**No código hoje:** `TIPOS_OPERACAO = ['financiamento_producao','divida','equity']`
(`backend/rotas/funding.ts:43`); `capital_giro` devolve `tipo deve ser um de…`
(`backend/rotas/funding.test.ts:26`). A tabela morta `avancado_capital_instrumentos` ainda declara
`capital_giro` em `schema.json:384`, mas nenhuma rota a serve — sobrevive porque as migrações `019`,
`028` e `029` a leem.

**Regra praticada:** *Necessidade de caixa de curto prazo não é modelável. O usuário só pode
representá-la torcendo uma `divida` de amortização curta.*

**Como verificar:** `POST /estudos/:id/avancado/funding` com `tipo: 'capital_giro'` → `400`.

**Custo/risco de adicionar:** baixo em dados (tipo novo, nenhuma linha existente muda), alto em
modelo: capital de giro que "puxa quando falta e devolve quando sobra" é o **oposto** da regra R-A44
(pagar pelo calendário sem olhar caixa) e reintroduz a competição por caixa que a #355 apagou.

---

### R-A47 — Correção monetária: cinco índices persistidos, nenhum lido, nenhum na tela

**Veredito:** AUSENTE
**No código hoje:** `indice_correcao` e `indice_correcao_taxa_aa` são persistíveis
(`backend/rotas/estudos.ts:34`) e existem no `schema.json`. **Não são renderizados** — a #279 os
retirou do formulário; a única menção em `frontend/tela-financeiro.ts` é o comentário `:19-20` que
**lista o que saiu**. Zero leituras em `fluxo-caixa-motor.ts`, `fluxo-shared.ts`, `proforma.ts` e
`funding-motor.ts`.

> ⚠️ **Correção ao dossiê.** A §4.5 item 3 diz que a correção é *"renderizada em
> `frontend/tela-financeiro.ts:19-20`"*. Não é: aquilo é comentário. O estado real é **coluna morta
> sem UI**, não "UI inerte" — o que muda a issue: não há controle para remover, só há capacidade
> para construir.

**Regra praticada:** *Todo valor do fluxo é nominal. Não há INCC na obra, IGPM/IPCA no recebível nem
CDI/TR na dívida.*

**Custo/risco de adicionar:** alto — corrigir o recebível muda a carteira e o VGV econômico de todo
estudo; corrigir o custo muda o custo elegível e, por tabela, a liberação do financiamento à
produção (R-A43).

---

### R-A48 — Cenários variam exatamente duas coisas

**Veredito:** JÁ IMPLEMENTADA (e estreita)
**No código hoje:** `aplicarCenario` (`frontend/fluxo-caixa-motor.ts:1712-1730`) escala `preco_m2`
de **todas** as tipologias e `orcamento_valor` (+ `orcamento_valor_canonico`) das linhas do grupo
`obra`. Nada mais. O backend guarda só os deltas (`{nome, preco_venda_pct, custo_obra_pct, ordem}`) e
**não grava indicador derivado** (`backend/rotas/avancado.ts`, bloco de cenários).

**Regra praticada:** *Cenário = (Δ% preço de venda, Δ% custo de obra). Velocidade de vendas, taxa de
juros, prazo de obra e condição de pagamento não são variáveis de cenário.*

**Custo/risco:** aditivo. Um delta novo com default 0 não muda cenário existente.

---

### R-A49 — Repasse: um mês fixo, não um produto bancário

**Veredito:** DIVERGENTE do modelo de mercado, **por decisão** (#345)
**No código hoje:** `REPASSE_MESES_APOS_ENTREGA = 1` (`fluxo-caixa-motor.ts:325`), usado no legado
(`:1356`) e no canônico (`componentesDoLegado:616`). O campo
`fluxo_pagamento.repasse.apos_entrega_meses` sobrevive só como passagem, sem leitor
(`fluxo-pagamento-editor.ts:14-18`). O texto da tela declara isso ao usuário
(`tela-fluxo-receitas.ts:809-810`).

**Regra praticada:** *O saldo restante é pago 100% no 1º mês após o fim da obra. Não há prazo de
análise de crédito, taxa de repasse, repasse parcial nem inadimplência no repasse.*

---

### R-A410 — Entrega é o **último** mês de obra; a planilha usa o seguinte

**Veredito:** DIVERGENTE, **assumido e documentado**
**No código hoje:** `marcosObra` (`frontend/fluxo-shared.ts:608-614`) define `mesEntrega = fimObra =
inicioObra + duracao − 1`, com a ressalva explícita `:600-604`: *"A planilha de referência marca
`Chaves` no mês SEGUINTE ao último mês de obra"*. Seis pontos de `fluxo-caixa-motor.ts` repetem a
definição à mão (`:1176`, `:1355`, `:595`…), o que o próprio helper registra como dívida (`:596-598`).

**Por que importa para A2/A3:** a fronteira do Após-chaves (R-A42/M13), o mês do repasse (R-A49) e o
gate de chaves do financiamento à produção (R-A43) **todos** pendem desta definição. Um deslocamento
de um mês na conferência numérica contra a planilha quase certamente é isto, não um erro de conta.

---

### R-A411 — Impostos: RET no Avançado, `sujeito_ret` no Preliminar, e um bloco fiscal que ninguém lê

**Veredito:** DIVERGENTE (três entradas fiscais concorrentes)
**No código hoje:**
| Entrada | Onde é editada | Quem lê |
|---|---|---|
| `considerar_ret` + `ret_pct` (global do estudo, #346) | Custos → Financeiro (`frontend/tela-fluxo-custos.ts:955-965`) | **Avançado**: `impostoMensal` e `receitaLiquidaLinha`, via `config.ret` |
| `sujeito_ret` + `imposto_percentual` + parâmetro `aliquota_ret_pct` | Premissas **e** aba Financeiro (`tela-financeiro.ts:176,188`) | **Preliminar**: `frontend/proforma.ts:245` |
| `regime_tributario` + 5 × `aliquota_*_pct` + `imposto_sobre_permuta_fisica` | aba Financeiro (`tela-financeiro.ts:182,187-193`) | **ninguém** |

**Regra praticada:** *O mesmo estudo tem dois interruptores de RET independentes, que não se falam, e
um regime tributário decorativo.* O comentário `frontend/fluxo-shared.ts:211-212` diz que o bloco
`regime_tributario`/`aliquota_*` é *"exclusivo do Preliminar"* — **também é impreciso**: a Proforma
lê `sujeito_ret`/`imposto_percentual`/`aliquota_ret_pct`, nunca `regime_tributario` nem os cinco
`aliquota_*_pct`.

**Como verificar:** marcar "Sujeito a RET" na aba Financeiro **não** altera o fluxo do Avançado.

---

## 3. Comportamentos acidentais — o código faz sem ninguém ter decidido

### A1 — `correcao_estoque` é editável, é persistido, e não faz absolutamente nada

Duas badges "Não/Sim" no rodapé do modal de Absorção (`frontend/tela-fluxo-receitas.ts:597-603`),
gravadas em `_absorcaoJson` (`:534`) e defaultadas no backend (`backend/rotas/avancado.ts:283`).
`grep -rn "correcao_estoque"` no repo devolve **apenas** `frontend/tela-fluxo-receitas.ts:521,534,
599-602`, `backend/rotas/avancado.ts:283` e o dossiê desta rodada — ou seja, só o formulário e o
default. **Nenhum motor a lê.** Nem sequer é uma coluna: vive dentro do JSON `absorcao`.

É o pior formato de campo morto — um controle *interativo*, no rodapé de um modal, ao lado do botão
Aplicar, que o usuário toma por uma premissa e que não altera número nenhum. Nem aviso, nem tooltip.

### A2 — `pos_obra.duracao_meses` é editável e mudou de significado sem avisar

O evento `pos_obra` do Cronograma nasce com `duracao_meses: 12` e `travado_duracao: false`
(`backend/rotas/avancado.ts:42`) — ou seja, **o usuário pode editá-lo**. Desde a #226, editá-lo não
muda mais a janela comercial de vendas (`fluxo-shared.ts:281`, `APOS_CHAVES_MESES`), mas **continua**
mudando a âncora de custos pós-entrega. O campo passou de "duração do Pós-chaves" para "duração da
janela de custos pós-obra" sem mudar de rótulo. Estudos legados gravados com 18 ou 24 meses hoje
vendem em 12 e gastam em 18 — sem migração e sem aviso.

### A3 — O "opt-in" da #283 virou "sempre ligado" para quem editou, e ninguém escreveu isso

`fluxoPagamentoParaSalvar` grava `componentes` em **toda** escrita (`fluxo-pagamento-editor.ts:90`).
Logo, todo Grupo cujo modal de pagamento foi aplicado desde a #248 roda pelo caminho canônico — que
tem a regra do Após-chaves (M13) e emite `console.warn` fora do horizonte. Grupo nunca reeditado roda
pelo legado, que não tem nem uma coisa nem outra.

**Consequência prática, invisível:** dois Grupos do mesmo estudo, com o mesmo plano de pagamento
declarado, calculam **diferente** se um deles nunca passou pelo modal. Não há indicação em tela de
qual caminho a linha usa.

### A4 — Duas bases de VGV concorrentes na corretagem e na baixa de estoque

`vgvVendidoMensal` (`fluxo-shared.ts:676-693`, base da corretagem) reparte o **VGV bruto**
(`vgvLinha`); `vendaBrutaContratadaMensal` (`fluxo-caixa-motor.ts:424`) reparte o **VGV vendável**
(exclui permuta física). O motor registra em `:258-263` que a #227 pedia uma função única e a
unificação "ficou incompleta". Efeito: em estudo com permuta física, **a corretagem é cobrada sobre
unidades que não foram vendidas**.

### A5 — `fmtNum` promete casas que não entrega

`viab-format.ts:24-25` declara só `maximumFractionDigits`. `tela-proforma.ts:453` chama
`fmtNum(v, 2)` com a intenção declarada em comentário (*"BUG7-12: número puro com 2 casas
decimais"*), e um valor redondo sai sem casa nenhuma — a coluna da Proforma fica desalinhada entre
linhas.

### A6 — "Capital Stack" ainda aparece para o usuário

`frontend/tela-fluxo-ver.ts:295`: *"Este estudo não tem camadas de **Capital Stack**"*. O conceito
foi apagado do código pela #355; o texto de tela sobreviveu. Também em `:56`, `:63` (comentários) e
`frontend/tela-financeiro.ts:13,22` (comentários). Só `:295` é visível ao usuário.

### A7 — `schema.json` ainda declara a tabela do modelo apagado

`avancado_capital_instrumentos` (`schema.json:380-393`), com `tipo` em
`["financiamento_producao","capital_giro","preferred_equity","sponsor_equity"]` — o vocabulário do
modelo que deixou de existir. **Não é bug hoje** (as migrações `019`/`028`/`029` a leem, e apagá-la
quebraria a cadeia), mas é a única fonte no repo onde `capital_giro` aparece como conceito válido —
exatamente o termo que A3 vai procurar. Precisa de comentário, não de remoção.

---

## 4. Perguntas ao autor

### P1 — Pós-chaves: 12 fixos é a regra aprovada ou é a lacuna?

Três fontes discordam:

| Fonte | Diz |
|---|---|
| `padrao-incorporacao.md:631` (§8.5, modelo de referência) | `duração do Após-chaves = 12 meses` — **é a regra** |
| `frontend/fluxo-shared.ts:237` | `APOS_CHAVES_MESES = 12`, constante, "não campo editável" — **cumpre a regra** |
| `docs/rodada-8/00-dossie.md` §4.5 item 5 | *"Pós-chaves travado em 12 meses — não editável. `pos_obra.duracao_meses` é ignorado"* — **lista como lacuna** |

**A pergunta:** a janela de vendas pós-entrega deve continuar fixa em 12 (e a lacuna do dossiê se
fecha reescrevendo o rótulo do campo `pos_obra.duracao_meses`, que hoje mente), ou deve voltar a ser
premissa por estudo? Se voltar, o que fazer com os estudos que hoje calculam com 12 e foram gravados
com outro valor (A2 acima)?

**Impacto se ninguém decidir:** A2 e A3 vão propor torná-la editável — desfazendo a #226 sem saber.

---

### P2 — Taxa de juros do cliente: abrir o campo, ou assumir que o app é sem juros?

A matemática de PMT, carteira e alocação de juros está pronta, testada contra o oráculo Calliandra e
**ligada** ao `calcularFluxo`. Mas nenhum estudo real produz um centavo de juros, porque o único
produtor de `componentes` é o adaptador legado, que fixa `taxaMensal: 0`
(`fluxo-caixa-motor.ts:589,601,608,617`).

**A pergunta:** o modal de Fluxo de Pagamento ganha campo de **taxa mensal** e de **sinal**
(fechando a lacuna 1 do dossiê), ou o app assume oficialmente que a tabela é sem juros e a
matemática fica como capacidade dormente?

**Se ganhar:** decidir também se a taxa é por componente (como o tipo já permite) ou uma só por
Grupo, e se `jurosClientes` entra na Receita Bruta exibida — a identidade
`receitaBruta = vendaLiquidaContratada + jurosClientes` já está fixada em teste
(`fluxo-caixa-motor.test.ts:1781`).

---

### P3 — Financiamento à produção segue fora da planilha nova?

A §4.3 de `funding-capital-stack.md` foi preservada de propósito na #355 porque a planilha
`fluxo_investidor_FORMULAS` modelaria `financiamento_producao` como **dívida de calendário**, o que
reverteria o catch-up retroativo aprovado na #405.

**A pergunta:** confirma que esse produto continua fora da planilha? Se A3 propuser alinhá-lo à aba
`divida`, isso deve ser rejeitado por decisão anterior, ou reaberto?

---

### P4 — Capital de giro entra? E se entrar, ele compete por caixa?

A §17.4 do padrão pede o conceito; o backend o rejeita; a #355 apagou de propósito toda competição
por caixa entre operações.

**A pergunta, em duas partes:**
(a) capital de giro / linha rotativa entra como quarto tipo de operação?
(b) se entrar, ele **puxa quando falta caixa e devolve quando sobra** — o que reintroduz dependência
do fluxo (hoje só `financiamento_producao` tem isso) e recria, na prática, uma ordem de execução
entre operações? Ou é só uma `divida` de prazo curto com nome diferente?

---

### P5 — `correcao_estoque` some da tela, ou ganha motor?

O controle existe, é interativo, e não faz nada (A1). Duas saídas honestas: **remover** do modal
(uma linha), ou **especificar** o que é (reajuste do preço do estoque não vendido por um índice ao
longo do tempo — que é o que o nome sugere, e que depende de R-A47, correção monetária, que também
não existe). Manter como está é a única opção que não deveria estar na mesa.

---

### P6 — Os dois RET se unificam?

Um estudo tem `considerar_ret`/`ret_pct` (Avançado, Custos → Financeiro) e
`sujeito_ret`/`imposto_percentual` (Preliminar, Premissas **e** aba Financeiro). São independentes e
não se sincronizam (R-A411). Um estudo Avançado que teve premissas preenchidas no Preliminar mostra
"Sujeito a RET" marcado na aba Financeiro e continua sem RET no fluxo, se `considerar_ret` estiver
falso.

**A pergunta:** unificar (um interruptor por estudo, lido pelos dois motores), ou separar
visualmente com rótulo explícito ("RET do Preliminar" × "RET do Avançado")?

---

### P7 — Corretagem sobre permuta física é intencional?

`vgvVendidoMensal` usa VGV **bruto**, então a linha obrigatória de Corretagem incide também sobre as
unidades permutadas fisicamente, que nunca foram vendidas (A4). O motor registra a divergência como
unificação incompleta da #227 (`fluxo-caixa-motor.ts:258-263`), não como decisão.

**A pergunta:** a corretagem é devida sobre a permuta física (o corretor intermediou o negócio do
terreno) ou é um resíduo de base errada a corrigir?

---

## 5. Nota de método e limitações

- **Nada foi executado.** `bash scripts/validar-frontend.sh` não foi rodado nesta sessão — este
  documento não altera código, e a validação pertence a quem aplicar os textos substitutos. Os
  vereditos vêm de leitura de `arquivo:linha`, não de execução. Onde eu disse "o teste prova",
  significa que li o teste, não que o rodei.
- **Todas as linhas citadas** foram lidas na `main` em `475dd24`. Textos substitutos foram escritos
  para **encaixar no arquivo atual** — se outro agente alterar esses arquivos antes da aplicação, os
  números de linha precisam ser reconferidos.
- **`docs/viabilidade/inteligencia-evi-incorporacao.md` não foi corrigido de propósito**: ele não
  descreve o app, e rebaixá-lo para casar com o app é exatamente o que o `CLAUDE.md` proíbe.
- **Correções que este documento faz ao próprio dossiê da Rodada 8**, para a sessão principal
  propagar: §4.1 (`exportar.ts:10` já usa `fmtR$`, ver M7), §4.5 item 3 (correção monetária **não** é
  renderizada, ver R-A47), §4.5 item 5 (12 meses fixos é o modelo aprovado, ver P1).

---

## 6. Convergência — issues emergentes (Rodada 2)

> Escrito depois de ler `docs/rodada-8/10-digest-cruzado.md`. Só o que **não existe** na Rodada 1
> deste documento: correção do que a realidade refutou, as perguntas que caíram, e as issues que só
> aparecem no cruzamento. Estado do código lido em `475dd24` **+ árvore de trabalho do B2**
> (`git status`: `fluxo-pagamento-editor.ts`, `proforma-avancado.ts`, `tela-dashboard.ts`,
> `tela-fluxo-ver.ts`, `fluxo-apresentacao.test.ts` modificados).

### 6.0 Correções ao meu próprio documento — a Rodada 1 me refutou em 4 pontos

Escrevo isto primeiro porque **meus textos substitutos da Rodada 1 contêm afirmações que agora são
falsas**. Aplicá-los sem estas correções trocaria uma mentira documental por outra — exatamente o
defeito que este agente existe para caçar.

| # | O que eu afirmei | Quem refutou | O que é verdade |
|---|---|---|---|
| **C1** | *"`jurosClientes` é **sempre 0** em estudo real"* — em **M3**, **M4**, **M12**, **M14** e **R-A42** | **A5** | O estudo 5 de Pinguim **tem** `taxaMensal: 0.0098636` e o motor produz **R$ 1.259.273,59**. Não é "sempre 0": é **"vira 0 na primeira vez que alguém clicar em Aplicar"**. O estudo 6, que passou pelo modal, tem `rotulo: "ao longo da obra (legado)"` — carimbo de `componentesDoLegado`. |
| **C2** | *"a fonte de formatação monetária é única"* — em **M6** e **M7** | **A6** | `frontend/fluxo-tabela.ts:34` (`celula`) tem formatador **próprio**: `Math.round` → **0 casas**, e sumiço em `< 0,50`. `frontend/exportar.ts:167` (`celulaFx`) usa `fmtR$` → **2 casas**, corte em `< 0,005`. R$ 1.234,56 sai `1.235` na tela e `1.234,56` no PDF; R$ 0,20 sai **branco** na tela e `0,20` no PDF. A #281 **mudou de endereço**. |
| **C3** | Acidente **A3**: *"dois Grupos com o mesmo plano calculam diferente porque um está no legado"* | **A5** | O discriminador **não é** legado × canônico: as 6 linhas dos dois estudos estão **todas no canônico**. O discriminador é **ter passado pelo modal** — que zerava a taxa. A divergência entre os dois ramos **continua real** (tabela R-A2-21 do A2), mas não é ela que explica os números medidos. |
| **C4** | **R-A41**: *"a UI fixa `modo:'distribuido'` e nunca grava `personalizado`"* | **A5** | `modo:'personalizado'` **existe na instância** — estudo 6, curva de 43 meses, `aplicado: true`. A UI de hoje não o grava, mas o dado vivo tem. Isso muda o custo de qualquer mudança na absorção: há curva personalizada em produção para preservar. |

**Correção de C1 — o parágrafo que substitui o bloco de aviso em M3, M4, M12 e M14** (o mesmo texto
nos quatro, com a citação de linha adaptada):

```
> ⚠️ **A matemática de juros existe, é exercitada por estudo real, e o modal a destruía.** Há linha
> em produção com `taxaMensal` diferente de 0 persistida em `fluxo_pagamento.componentes` (estudo 5
> de Pinguim: `0.0098636`, R$ 1.259.273,59 de juros de clientes, TIR 18,59% a.a.). O que o modal
> não oferece é **entrada** de taxa e de sinal (`frontend/tela-fluxo-receitas.ts:741-816`): o
> adaptador `componentesDoLegado` fixa `taxaMensal: 0` e `sinalPct: 0`
> (`frontend/fluxo-caixa-motor.ts:589,601,608,617`) porque o espelho legado não tem onde guardar
> essas grandezas. Até 2026-08-22, `fluxoPagamentoParaSalvar` regenerava os componentes do espelho
> em toda escrita — abrir o modal e clicar "Aplicar" **apagava os juros da linha**, sem aviso, sem
> diff e sem undo. `componentesParaSalvar` (`frontend/fluxo-pagamento-editor.ts`) fechou a
> destruição; **abrir um campo de taxa continua sendo trabalho pendente.**
```

**Correção de C2 — a linha da tabela de M6 e o parágrafo de M7.** A tabela de conformidade de
`formulas.md` ganha uma linha ❌ nova, e a nota do `CLAUDE.md` deixa de declarar fonte única:

```markdown
| **`frontend/fluxo-tabela.ts:34`** — `celula` da tabela do Fluxo | **0** | ❌ formatador próprio: `Math.round`, e célula **vazia** abaixo de R$ 0,50 |
| `frontend/exportar.ts:167` — `celulaFx` (CSV e PDF) | 2 | ✅ usa `fmtR$`, corte em R$ 0,005 |
```

```
  > ⚠️ **Resolvido na exportação, ainda aberto na tela.** `frontend/viab-format.ts:13-23` usa 2
  > casas com mínimo e máximo, e `frontend/exportar.ts:167` passou a consumir `fmtR$` em vez de
  > definir formatador próprio. **Duas fontes ainda divergem:** `frontend/fluxo-tabela.ts:34`
  > arredonda para **0 casas** e esconde valor abaixo de R$ 0,50, então a mesma célula sai `1.235`
  > na tela e `1.234,56` no PDF, e R$ 0,20 sai **branco** na tela; e `fmtNum`
  > (`frontend/viab-format.ts:24-25`) declara só `maximumFractionDigits`, então
  > `frontend/tela-proforma.ts:453` chama `fmtNum(v, 2)` e o número redondo sai sem casas. A #281
  > **mudou de endereço, não foi resolvida** — não corrija pontualmente.
```

---

### 6.1 P1 respondida — texto substituto final de `padrao-incorporacao.md` §8.5

A Rodada 1 me deixou com três fontes discordando. O **A2 trouxe a quinta e decisiva**: a EVI Urbitá
`cfINC!J` divide por **12 literal**, ignorando os próprios inputs `EtapaChavesDuracao` /
`EtapaPosChavesDuracao` da planilha. Ou seja, **a planilha de referência também trava em 12** — e a
#226 não inventou nada, reproduziu o oráculo.

O placar final é 4 × 1: modelo funcional (§8.5 `= 12 meses`) + código (`APOS_CHAVES_MESES`) + EVI
(`cfINC!J`) + A2 **contra** o rótulo "Comportamento vigente" de `:636-643`, que descreve o app de
**antes** da #226. **Não há pergunta ao autor aqui — há texto vencido.** Substitui `:636-643`:

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

---

### 6.2 P2 reescrita — deixou de ser "o app tem juros?" e virou "quem manda no plano de pagamento?"

A pergunta original era binária: *abrir campo de taxa, ou assumir oficialmente que o app é sem
juros?* **A realidade respondeu as duas metades e nenhuma era a certa.** O app **tem** juros
(A5: R$ 1.259.273,59 num estudo real) e **os destruía** (A6: o modal nem lia `fp.componentes`; A5: a
TIR caía 18,59% para 17,53% ao clicar em Aplicar). Não era escolha de produto — era perda de dado.

O conserto do B2 (`componentesParaSalvar`, `frontend/fluxo-pagamento-editor.ts`) fecha a destruição
com uma regra explícita: *o legado manda no que ele sabe dizer; o canônico persistido manda no que
só ele sabe*. Com isso, **P2 morre e nascem três perguntas menores, todas de escopo definido**:

> **P2a — quem pode criar uma linha com juros, já que a UI não pode?** Hoje, só escrita direta na
> API (foi assim que o estudo 5 nasceu). Isso é: (i) fluxo de importação legítimo a documentar,
> (ii) porta a fechar, ou (iii) o argumento de que o campo no modal é inevitável?
>
> **P2b — o `rotulo` vira contrato?** `"ao longo da obra (legado)"` é hoje o único jeito de saber,
> olhando o dado, se uma linha passou pelo adaptador ou foi escrita com intenção econômica — o A5
> usou exatamente isso como forense. Se vira contrato, precisa de teste; se não, ninguém deve
> depender dele de novo.
>
> **P2c — a taxa é por componente ou uma por Grupo?** O tipo `ComponentePagamento` já a carrega
> **por componente** (`fluxo-caixa-motor.ts:517+`), e o `componentesParaSalvar` transplanta **por
> índice + tipo**. Se a decisão for "uma taxa por Grupo", o transplante por índice deixa de ser
> necessário e o risco da **E2** desaparece junto.

**Fora de escopo por decisão do autor** (decisão 1 do digest): o campo de taxa no modal é *feature*
e não entra neste conserto. Ele continua sendo issue — agora com preço conhecido: a EVI reporta
**R$ 8,98 MM, 5,41% do VGV** em juros de tabela (A2, `Areas e Precos!C30`), e o app reporta zero em
todo estudo que passou pelo modal.

---

### 6.3 As issues emergentes

Formato do §6 do dossiê. Cada uma diz **quais achados de quais agentes** combina — e nenhuma repete
o que já está nas §§1–5 deste documento.

#### E1 — O modal de **Absorção** tem o mesmo defeito do de Pagamento, e está **fora** do conserto

**Veredito:** AUSENTE (defeito real, sem conserto na árvore)
**Combina:** A5 (curva de 43 meses destruída, VPL −R$ 360.591,41) + A4 acidente A3 + leitura do
`git status` da árvore do B2
**No código hoje:**
- `_abrirAbsorcao` (`frontend/tela-fluxo-receitas.ts:516-528`) lê **só** `correcao_estoque` e os três
  `pct` por evento. Numa linha `modo:'personalizado'` não há `blocos` — `pct(...)` devolve **0** nos
  três, e o modal abre **zerado**.
- `_absorcaoJson` (`:530-542`) devolve **sempre** `modo: 'distribuido'`. Aplicar converte a linha e
  descarta `absorcao.meses[]` inteiro.
- Resultado: uma curva personalizada de 43 meses vira `0/0/0` com Pós-chaves derivado em 100%.

**Por que é emergente:** a decisão 1 do autor cobre *"modal de pagamento que reescreve o plano"*. O
`git status` da árvore mostra `frontend/tela-fluxo-receitas.ts` **não modificado** — a Absorção não
está no conserto. E o A5 mostrou que **existe curva personalizada em produção** (C4 acima), então o
alvo não é hipotético.

**Regra proposta:** *Abrir e aplicar um modal sem alterar campo nenhum é NO-OP, em qualquer modal do
app.* O que `componentesParaSalvar` acabou de garantir para Pagamento, `_absorcaoJson` precisa
garantir para Absorção: linha `personalizado` abre em modo somente-leitura com aviso explícito, ou o
formulário ganha o modo — mas **nunca** converte em silêncio.

**Como verificar:** `GET /avancado/receitas` do estudo 6, abrir o modal de Absorção da linha com 43
meses, Aplicar sem tocar em nada, `GET` de novo → o `absorcao` devolvido tem de ser byte-idêntico.

**Custo/risco:** o conserto é defensivo e não muda cálculo de linha `distribuido` (a esmagadora
maioria). **Não consertar** custa VPL de seis dígitos por clique acidental.

---

#### E2 — O transplante por índice do conserto do B2 migra `taxaMensal` para o componente errado

**Veredito:** DIVERGENTE (residual estreito do conserto que acabou de entrar)
**Combina:** diff do B2 (`componentesParaSalvar`, caso 3) + A2 R-A2-21 (os dois ramos não são
equivalentes) + A6 (o modal não edita as três grandezas canônicas)
**No código hoje:** `componentesParaSalvar` tem três casos. O caso 3 — *"o usuário mexeu de verdade
no espelho legado"* — regenera do legado e transplanta `taxaMensal`/`sinalPct`/
`jurosNoMesDaContratacao`/`rotulo` **por índice + tipo**:

```ts
return regenerados.map((r, i) => {
  const orig: any = originais[i];
  if (!orig || orig.tipo !== r.tipo) return r;   // sem par de mesmo tipo -> nasce sem taxa
  ...
});
```

**O buraco:** `componentesDoLegado` emite os componentes na ordem `entradas → parcelas → repasse`.
Inserir uma linha de Parcelamento **no meio** desloca todos os índices seguintes. Se o Grupo tem dois
`prazo_fixo` com taxas diferentes, a taxa do primeiro migra para o segundo — mesmo `tipo`, índice
deslocado, guarda não dispara. E se o usuário **remove** uma linha, o último componente perde o par e
nasce com `taxaMensal: 0` **em silêncio** — a mesma perda que o conserto veio evitar, num caminho
mais estreito.

**Regra proposta:** *O transplante de campos só-canônicos casa por **identidade estável do
componente**, não por posição.* Duas saídas: (a) `id` estável no componente persistido, ou (b)
casar por `(tipo, participacaoPct, prazoMeses/marcoMes)` — a mesma tupla que `mesmaEstrutura` já
compara — e, **quando não houver par**, recusar a gravação com mensagem em vez de zerar.

**Como verificar:** teste em `fluxo-pagamento-editor.test.ts` — linha com dois `prazo_fixo` de taxas
0,98% e 0,50%; inserir uma Entrada nova no topo; aplicar; as duas taxas têm de continuar nos seus
componentes.

**Custo/risco:** zero para o caso 1 e o caso 2 (linha nova e no-op). Só o caso 3 muda, e hoje ele
está errado.

> ⚠️ **Se P2c for respondida com "uma taxa por Grupo"**, esta issue desaparece: sem taxa por
> componente, não há o que transplantar.

---

#### E3 — `pos_obra.duracao_meses` deixa de ser acidente arquitetural e vira issue com preço

**Veredito:** DIVERGENTE
**Combina:** A4 acidente **A2** (campo mudou de significado sem mudar de rótulo) + A5
(R$ 2.007.856,95 descartados no estudo 6) + A2 (a EVI também trava em 12 — §6.1)
**A cadeia completa, que nenhum agente via sozinho:**

1. A #226 tirou a duração do Pós-chaves de `pos_obra.duracao_meses` e a fixou em
   `APOS_CHAVES_MESES` (**correto** — §6.1 prova com a EVI).
2. O campo **continuou editável** (`backend/rotas/avancado.ts:42`, `travado_duracao: false`) porque
   ainda serve de âncora de custo. O **rótulo não mudou**.
3. `periodoAbsorcao` (`fluxo-shared.ts:309-315`) fecha o horizonte em `pos_obra.inicio + 12 − 1`.
4. `absorcaoMensal` em modo `personalizado` (`:373-379`) descarta, **sem `console.warn` e sem erro**,
   todo mês fora desse intervalo — enquanto o caminho canônico de recebíveis avisa no caso simétrico
   (`fluxo-caixa-motor.ts:1085-1092`).
5. Estudo 6: `duracao_meses: 13`, curva `personalizado` de 43 meses chegando ao 13º →
   **1,41% do VGV, R$ 2.007.856,95, evaporados**.

**Regra proposta:** *Percentual de absorção que cai fora do período derivado é **erro de
validação**, não descarte. Enquanto não for, `absorcaoMensal` avisa como `deposita` avisa.* E o
campo `pos_obra.duracao_meses` é **renomeado na tela** para o que ele faz — janela de custos
pós-entrega —, ou é travado junto com o início.

**Como verificar:** `absorcaoMensal({modo:'personalizado', meses:[{mes: 99, pct: 10}]}, crono)` hoje
devolve soma 90 sem dizer nada. Depois, ou soma 100, ou grita.

**Custo/risco:** o aviso é aditivo. Renomear o campo é texto. **Travar** a duração mexeria em âncora
de custo de estudo existente — não fazer sem decidir.

---

#### E4 — A trava de saldo de tipologias: o documento a declara completa, o `PATCH` a contorna

**Veredito:** DIVERGENTE — **18ª mentira documental**, e a primeira que um conserto vai apagar
**Combina:** A5 (234 alocadas + 42 permutadas sobre estoque de 234; forense: tipologia atualizada
10–11 s depois da linha de permuta, nos **dois** estudos) + A4 (varredura documental)
**Onde a documentação mente:**

| Linha | Diz |
|---|---|
| `padrao-incorporacao.md:682-683` | *"A trava de saldo é **agregada por estudo** (`saldoTipologiaNoEstudo`): a soma das unidades alocadas da tipologia em **todos** os Grupos não pode exceder a `quantidade` do catálogo."* |
| `padrao-incorporacao.md:1188` | *"a soma das alocações não pode ultrapassar o catálogo."* |

**O código faz:** `saldoTipologiaNoEstudo` (`backend/rotas/avancado.ts:1039`) é chamado em exatamente
**dois** lugares — `:1080` e `:1126`, as rotas de **alocação**. O `PATCH
/estudos/:id/avancado/tipologias/:tid` (`:809-832`) copia `CAMPOS_TIPOLOGIA` — que inclui
`quantidade` (`:749`) — e grava direto, **sem consultar o saldo**. Reduzir a `quantidade` do catálogo
abaixo do que já está alocado é uma escrita legítima para a API.

> ⚠️ **Este é o único dos 3 bugs graves que ainda não está na árvore do B2**: `git status` não
> mostra `backend/rotas/avancado.ts` modificado. Registro como estado de leitura, não como
> acusação — pode estar em curso.

**Texto substituto para `:682-683`, a aplicar SÓ depois que a trava existir de verdade:**

```
> A trava de saldo é **agregada por estudo** (`saldoTipologiaNoEstudo`, `backend/rotas/avancado.ts`):
> a soma das unidades alocadas da tipologia em **todos** os Grupos, mais as unidades reservadas em
> linhas de custo de Permuta física, não pode exceder a `quantidade` do catálogo. Ela é verificada
> nas rotas de alocação **e** no `PATCH` da própria tipologia — reduzir a `quantidade` abaixo do que
> já está comprometido é recusado, não gravado. Na tela, as unidades **cascateiam** de um Grupo para
> o seguinte (#170).
```

**Custo/risco do conserto:** os dois estudos de Pinguim **já estão** em estado inválido (234 + 42
sobre 234). Uma trava nova vai **recusar o próximo `PATCH`** nesses estudos, inclusive um que não
mexa em `quantidade`. Decidir: a trava valida só a **transição** (recusa piorar) ou o **estado**
(recusa qualquer escrita enquanto inválido)? A primeira é a única que não trava trabalho legítimo em
dado legado.

---

#### E5 — A #281 mudou de endereço: tela e exportação divergem no mesmo número

**Veredito:** DIVERGENTE
**Combina:** A6 (medição das duas funções) + A4 **M6/M7** (que declaravam fonte única — **C2**
acima) + A1 item **11** (reaberto: `fmtNum(v,2)` entrega *até* 2 casas)
**A causa comum, que nenhum dos três viu inteira:** existem **três** políticas monetárias no app,
não duas.

| Função | Casas | Corte | Onde aparece |
|---|---|---|---|
| `fmtR$` (`viab-format.ts:13`) | 2, com mínimo | — | KPIs, telas, PDF, CSV |
| `celula` (`fluxo-tabela.ts:34`) | **0**, `Math.round` | **< R$ 0,50 vira vazio** | tabela do Fluxo de Caixa |
| `fmtNum` (`viab-format.ts:24`) | **até** `d`, sem mínimo | — | Proforma (`tela-proforma.ts:453`) |

Efeito composto: R$ 1.234,56 sai `1.235` na tela e `1.234,56` no PDF do **mesmo** relatório; R$ 0,20
sai **branco** na tela e `0,20` no PDF; e a coluna da Proforma alinhada à direita não alinha a
vírgula, que é exatamente a 3ª cláusula do item 11 que o A1 reabriu.

**Regra proposta:** *Uma política monetária por app. A tabela do Fluxo pode **exibir** arredondada
por densidade, mas então declara a unidade no cabeçalho ("R$ mil") em vez de mentir o centavo, e
nunca esconde valor não-nulo.* `fmtNum` ganha `minimumFractionDigits` igual a `d`.

**Como verificar:** teste de paridade — para uma lista de valores, `celula(v)` e `celulaFx(v)` têm de
descrever o mesmo número, e nenhum valor não-nulo pode virar string vazia nos dois.

**Custo/risco:** puramente de apresentação; nenhum motor muda. Mexe em snapshot de tabela.

---

#### E6 — A narrativa "opt-in por linha" promete uma auditoria que não existe

**Veredito:** DIVERGENTE — **19ª mentira documental** (por omissão, não por afirmação falsa)
**Combina:** A4 (o editor grava `componentes` em **toda** escrita) + A5 (as 6 linhas dos 2 estudos
estão **todas** no canônico) + A2 R-A2-21 (os dois ramos **não são equivalentes**)
**Onde:** `padrao-incorporacao.md:1026-1033`, §11.6. Cada bala está tecnicamente correta, e o
parágrafo de fecho não: *"Essa escolha evita uma migração global silenciosa e **permite auditar a
adoção linha a linha**."*

**O que é verdade:** a migração **é** global na prática — qualquer "Aplicar" no modal converte a
linha —, e **não há superfície nenhuma** para auditar a adoção. Nem tela, nem rota, nem campo. O A5
só conseguiu distinguir os dois estudos porque leu o `rotulo` `"ao longo da obra (legado)"` no JSON
cru, via API. E como o A2 provou que os dois ramos produzem **números diferentes** com o mesmo
`fluxo_pagamento` (PMT × divisão simples; 1ª parcela em `s+1` × no mês da venda; venda pós-entrega),
saber em qual ramo a linha está **não é curiosidade, é premissa de leitura do resultado**.

**Texto substituto do parágrafo de fecho (`:1033`):**

```
Essa escolha evita reinterpretar dado durante a leitura. Na prática, porém, a adoção **não é
gradual**: `fluxoPagamentoParaSalvar` (`frontend/fluxo-pagamento-editor.ts`) grava `componentes` em
toda escrita, então qualquer "Aplicar" no modal de Fluxo de Pagamento converte a linha para o
canônico. Só linha nunca reeditada desde a #248 permanece no legado — e os dois ramos **produzem
números diferentes** com o mesmo `fluxo_pagamento` (PMT contra divisão simples, 1º vencimento em
`s+1` contra o mês da venda, venda pós-entrega à vista contra plano do Grupo).

⚠️ **Não existe superfície para saber em qual ramo uma linha está.** Nem tela, nem rota, nem
indicador. Hoje o único sinal é o `rotulo` carimbado por `componentesDoLegado`
(`"ao longo da obra (legado)"`) no JSON cru. Enquanto os dois ramos coexistirem, isso precisa ser
visível a quem lê o resultado.
```

**Issue derivada:** ou a UI marca a linha ("plano econômico" × "compatibilidade"), ou o legado é
migrado de uma vez e o ramo morre. Manter dois motores invisíveis não é opção — é o que fez o A5
gastar forense para explicar dois números.

---

#### E7 — `correcao_estoque`: **P5 deixa de ser pergunta**, o padrão já tem a resposta

**Veredito:** AUSENTE (a especificação existe; a implementação, não)
**Combina:** A4 acidente **A1** + A4 **P5** + A5 (*"inerte, mas as 6 linhas estão em `false` →
estrutural, sem número atrás"*) + `padrao-incorporacao.md:865-874` (§10.6), que eu não havia
cruzado com o controle
**O que o padrão já diz** (§10.6, e é **modelo de referência**, não comportamento vigente):

> *"Quando existir uma opção de correção de estoque, seu comportamento deve ser explícito e
> testável. Ela não pode: criar um quinto período; alterar o VGV total; esconder percentuais que não
> fecham; produzir estoque negativo; modificar silenciosamente preços ou condições de pagamento."*

**O controle de hoje viola a premissa da frase inteira:** ele **existe** (duas badges interativas no
rodapé do modal, ao lado do botão Aplicar — `frontend/tela-fluxo-receitas.ts:597-603`), é
**persistido** (`:534`, default em `backend/rotas/avancado.ts:283`), e não é nem explícito nem
testável, porque **não faz nada**.

**Por que a prioridade cai, e por que a issue continua:** o A5 mediu — as 6 linhas dos 2 estudos
estão em `false`. **Não há dinheiro atrás**, então isto não disputa prioridade com E1/E3/E4. Mas é o
pior formato de campo morto que o app tem: um controle interativo que o usuário toma por premissa.

**Regra proposta:** *Retirar o controle da tela nesta rodada* (uma linha; `absorcao.correcao_estoque`
continua sendo aceito no JSON e ignorado, sem migração). Reintroduzi-lo **só** junto com o motor que
a §10.6 exige — o que depende de correção monetária (**R-A47**), que também não existe.

---

#### E8 — A ausência de evidência é ela própria uma issue: equity e cenários não são conferíveis

**Veredito:** DIVERGENTE (risco de processo, não de cálculo)
**Combina:** A3 (`simularEquity` sem `max(0,…)`; `Σ pct_retorno` sem teto; `saldoFinal` lê o último
mês em vez do mês da quitação) + A5 (*"não deu para conferir: cenários vazios nos 2, equity sem
nenhuma operação"*) + A3 (*"o golden test não pega porque **reconstrói a curva dentro do próprio
teste**"*, `funding-motor.test.ts:126-144`)
**A cadeia:** as divergências de equity do A3 são de **leitura de código**, sem oráculo vivo, e o
teste que deveria ser o oráculo **fabrica a própria entrada** — então ele não pode falhar por
divergência de base. Somando: há uma classe inteira de comportamento (equity, cenários) que **nem a
instância nem a suíte** conseguem contradizer.

**Regra proposta:** *Todo motor com spec numérica externa tem um golden que consome a **série
gravada**, não uma série reconstruída no teste.* E: um estudo-semente em Pinguim com **uma operação
de cada tipo** e **um cenário não-vazio**, para que a próxima conferência tenha o que ler.

**Como verificar:** o golden de funding tem de quebrar se a curva de custo elegível mudar de forma —
hoje não quebra.

**Custo/risco:** nenhum em produção. É custo de teste e de dado de homologação.

> ⚠️ **Consequência imediata para esta rodada:** as duas issues de equity do A3
> (`max(0,…)` e teto de `Σ pct_retorno`) **não podem ser fechadas por conferência numérica** — só
> por leitura e por teste novo. Registrar isso no corpo delas, ou alguém vai tentar "confirmar em
> Pinguim" e não vai conseguir.

---

#### E9 — Capital de giro: a decisão do autor torna dois textos vencidos no instante em que o rótulo mudar

**Veredito:** DIVERGENTE (documental, antecipatório)
**Combina:** decisão **3** do autor (*"capital de giro: só o rótulo; o tipo `divida` já é o produto
de CG por calendário"* — desenho rotativo **recusado**) + A3 (a aba `divida` da planilha **é** a
folha de CG do autor: `A8 "Valor CG (R$)"`, `B18 "Libera CG"`, `C18 "Carencia CG"`) + A4 **R-A46** e
**M17**
**O que fica vencido no momento em que o rótulo mudar:**

| Onde | Diz | Fica falso porque |
|---|---|---|
| `padrao-incorporacao.md` §17.4 (`:1820-1832`) | descreve capital de giro como conceito ausente, a implementar | o produto passa a existir, com outro nome |
| **meu** R-A46 e o 3º bloco do substituto de M17 | *"Capital de giro, linha rotativa e empréstimo-ponte não existem"* | metade deixa de ser verdade |

**Texto substituto para o 3º bloco de M17** (o que eu havia escrito para `padrao-incorporacao.md`
§17), a aplicar junto com o rótulo:

```
> ✅ **Capital de giro existe — pelo tipo `divida`.** A aba `divida` da planilha
> `fluxo_investidor_FORMULAS` **é** a folha de Capital de Giro do autor (`A8` "Valor CG (R$)",
> `B18` "Libera CG", `C18` "Carencia CG"), e `simularDivida`
> (`frontend/funding-motor.ts:237-292`) a reproduz mês a mês. O que o app não tem, **por decisão
> explícita do autor em 2026-08-21**, é uma linha **rotativa**: sem saque dirigido pela falta de
> caixa, sem devolução automática quando sobra, sem limite reutilizável. Um desenho `linha_credito`
> nesse formato foi proposto e **recusado** — ele reintroduziria a competição por caixa que a #355
> apagou de propósito.
>
> ⚠️ **Sobra trabalho de vocabulário, não de motor:** o tipo se chama `divida`
> (`backend/rotas/funding.ts:43`), o rótulo de tela não diz "capital de giro" em lugar nenhum, e
> `capital_giro` só aparece no repo como opção da tabela **morta**
> `avancado_capital_instrumentos` (`schema.json:384`) — que **não deve ser apagada** nesta rodada,
> porque guarda o dado migrado pela `019`.
```

**Regra proposta:** *A tela de Funding nomeia `divida` de forma que um usuário procurando "capital de
giro" a encontre* — rótulo, placeholder ou texto de ajuda. Sem migração, sem tipo novo, sem bump
para 0.1.29.

---

#### E10 — O conserto da proforma cria uma verdade que nenhum documento declara

**Veredito:** AUSENTE (lacuna documental **criada pelo conserto**, não corrigida por ele)
**Combina:** A5 (proforma somando principal do funding: −R$ 62.364.749,03 onde o real é
R$ 24.668.189,10) + o conserto do B2 (`proforma-avancado.ts:21` — *"A PROFORMA É DESALAVANCADA:
nenhum lado do funding entra aqui"*) + A4 (varredura documental)
**O que o conserto decidiu:** tirar o funding **inteiro** da proforma do Avançado, em vez de creditar
as entradas. É a decisão certa — e ela é **coerente com a §8.1 de `funding-capital-stack.md`**, que
manda manter TIR e VPL desalavancados (`:646-650`) para preservar comparabilidade entre estudos.

**O que nenhum documento diz:** que a **proforma** do Avançado é desalavancada, e por quê. Hoje a
regra vive **só** no cabeçalho de `frontend/proforma-avancado.ts:21-64`. `formulas.md` fala de
Proforma do **Preliminar** (`:11`, *"engine `frontend/proforma.ts`"*) e não menciona
`proforma-avancado.ts`; `padrao-incorporacao.md:302-324` idem. Ou seja: **o app passa a ter duas
proformas e um único capítulo de fórmulas**, que descreve a outra.

**Texto proposto — bloco NOVO em `formulas.md`, depois da §Resultado:**

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

**Custo/risco de não fazer:** a próxima sessão que ler `formulas.md` conclui que a proforma do
Avançado não existe, ou que ela roda `proforma.ts`. Foi assim que quatro margens diferentes
conviveram na mesma sessão sem ninguém achar estranho.

---

#### E11 — Os dois RETs: três agentes chegaram lá por caminhos separados, e isso encerra P6

**Veredito:** DIVERGENTE
**Combina:** A1 (*"dois RETs convivem e um não faz nada"*) + A6 (*"uma segunda caixa 'Sujeito a RET'
que só a proforma do **Preliminar** lê, numa tela que só renderiza no **Avançado**"*) + A4
**R-A411**/**P6**
**Convergência independente = a regra é sólida.** Não é mais pergunta de desenho, é defeito
confirmado por três lentes:

- `considerar_ret` + `ret_pct` → editados em **Custos → Financeiro**
  (`frontend/tela-fluxo-custos.ts:955-965`), lidos pelo **Avançado**.
- `sujeito_ret` + `imposto_percentual` → editados em **Premissas** *e* na **aba Financeiro**
  (`frontend/tela-financeiro.ts:176,188`), lidos **só** pela proforma do **Preliminar**
  (`frontend/proforma.ts:245`).
- A aba Financeiro **só renderiza no Avançado** (A6) — logo, a caixa "Sujeito a RET" que ela mostra é
  garantidamente inerte naquele contexto.

**Regra proposta:** *A aba Financeiro do Avançado não exibe controle que só o Preliminar lê.* Duas
saídas: (a) retirar `sujeito_ret`/`imposto_percentual` da aba Financeiro — eles continuam em
Premissas, que é onde o Preliminar vive; ou (b) rotulá-los explicitamente ("RET do Preliminar") e
mostrar ao lado o RET vigente do Avançado, somente-leitura, com link para Custos → Financeiro.

**Custo/risco:** (a) é remoção de UI, sem migração e sem efeito de cálculo — mesmo padrão da #279.
Prefiro (a): a opção (b) mantém dois interruptores na mesma tela, que é a causa da confusão.

**Nota:** isto resolve **9 dos 10 controles inertes** que o A6 contou na aba Financeiro, quando
somado ao que a §M5/M17 já propõe para `regime_tributario` e os cinco `aliquota_*`.

---

### 6.4 O que vai passar a mentir por causa do conserto — antecipação

Esta é a pergunta que só este agente pode responder antes do fato. Três documentos mudam de valor de
verdade quando os consertos do B2 fecharem:

| Documento | Hoje | Depois do conserto |
|---|---|---|
| `padrao-incorporacao.md:682-683` e `:1188` (trava de saldo) | **mente** — o `PATCH` a contorna | **passa a ser verdade**, e o texto de **E4** é o que descreve a trava completa |
| `padrao-incorporacao.md:1026-1033` (opt-in por linha) | mente por omissão | **continua mentindo** — o conserto do modal **não** cria a superfície de auditoria. Ver **E6** |
| **nenhum documento** (proforma desalavancada do Avançado) | a regra não existe em lugar nenhum | **passa a existir só em comentário de código**. Ver **E10** |

E um risco de **dois consertos juntos** que nenhum agente levantou: o conserto do modal de Pagamento
torna `fluxo_pagamento` **estável entre aberturas**, e o conserto da proforma muda o resultado
exibido de todo estudo com funding. **Aplicados na mesma branch**, um estudo aberto antes e depois vai
mostrar número diferente por **duas** causas independentes. Se alguém reconferir Pinguim depois do
merge e achar uma divergência, o instinto vai ser atribuir ao conserto errado. **Recomendação:** os
testes de regressão de cada conserto citam explicitamente o estudo e a grandeza que **aquele**
conserto move — 5/juros/TIR para o modal, 5/resultado/margem para a proforma.

---

### 6.5 `CLAUDE.md` — a seção que declara a Rodada 8 aberta

O próprio arquivo ensina a lição (`:145-149`): *"Se abrir uma rodada nova, atualize esta seção junto
— e quem a encerrar faz o mesmo, na mesma alteração. A Rodada 4 nasceu porque #165–#169 ficaram
abertas uma rodada inteira sem ninguém perceber, com este arquivo dizendo 'não há issue aberta'."*
A Rodada 7 violou isso (é a lacuna **F11.6**, que virou a #416). **A Rodada 8 não pode repetir.**

Texto proposto — substitui o cabeçalho `## Estado do backlog — ✅ RODADA 7 CONCLUÍDA` e entra acima
da tabela existente:

```markdown
## Estado do backlog — 🟡 RODADA 8 ABERTA

| Rodada | Escopo | Issues | Estado |
|---|---|---|---|
| **8 — auditoria cruzada** | Reverificação da `lista bugs 20260807.xlsx` + regras derivadas das 3 planilhas (EVI Urbitá, fluxo do investidor) + conferência numérica em Pinguim + auditoria de UI | a abrir | 🟡 **em curso desde 2026-08-21** |
| **7 — lista de bugs (2ª leva)** | `lista_bugs_20260807.xlsx`, 47 itens | **#309–#355** (47) | ✅ concluída em 2026-08-12 |

### Rodada 8 — o que é, e o placar honesto

Seis agentes em duas rodadas, orquestrados por uma sessão principal; documentos em `docs/rodada-8/`.
A pergunta era: **o que da Rodada 7 realmente se sustenta no código, e que regras as três planilhas
do autor exigem que o app ainda não representa?**

**Placar da reverificação dos 47 itens — provisório, e é assim que deve ser lido:**

| Veredito | Qtd |
|---|---:|
| ✅ confirmado no código | 41 |
| 🔴 **reaberto** (11, 17, 22, 24, 31) | 5 |
| ⚪ sem diff próprio, mas correto na `main` (20) | 1 |

> ⚠️ **41 é otimista e o método diz por quê.** A reverificação cobriu **8** dos 44 "implementados" e
> **3 falharam — 37,5%**. Os **36 restantes** estão em auditoria (`docs/rodada-8/08-auditoria-39-itens.md`);
> até ela fechar, "41 confirmados" quer dizer "8 conferidos de perto, 36 herdados da Rodada 7".
>
> **O que fez a diferença no método:** ler o **corpo** da coluna `Issue` da planilha, não o título.
> O item 6 pedia "no máximo 3 campos por linha"; o **título** dizia "reordenar" — o oposto do pedido.
> Título de planilha não é requisito.

**Decisões do autor tomadas nesta rodada** (vinculantes, registradas aqui porque não têm outra casa):

1. **Os 3 bugs graves são consertados nesta branch**, não viram issue: proforma do Avançado somando
   o principal do funding ao custo; modal de Fluxo de Pagamento reescrevendo o plano ao abrir;
   `PATCH` de tipologias gravando `quantidade` sem validar o saldo alocado. **O campo de taxa de
   juros no modal é feature e fica de fora** — vira issue.
2. **Capital de giro: só o rótulo.** O tipo `divida` já **é** o produto de CG por calendário — a aba
   `divida` da planilha do autor tem as células `Valor CG`, `Libera CG`, `Carencia CG`. O desenho de
   uma linha de crédito **rotativa** foi **recusado**: reintroduziria a competição por caixa que a
   #355 apagou. Sem migração `030`, sem bump de `versao`.
3. **A base de receita líquida do equity não muda** (`frontend/funding-motor.ts:58-67`) — *"equity é
   um retorno líquido ao investidor, não importa esse fator para o cálculo"*. A divergência com as
   duas planilhas é **intencional**: vira nota, não issue. Continua valendo como issue o
   `simularEquity` sem `max(0, …)`.
4. **`avancado_capital_instrumentos` não é apagada do `schema.json`** nesta rodada — guarda o dado
   migrado pela `019`.

> ⚠️ **Esta seção é o que a Rodada 7 esqueceu de escrever.** Quem encerrar a Rodada 8 atualiza esta
> tabela **na mesma alteração** que fechar a última issue. Não delegue para "depois": foi
> exatamente assim que a #416 nasceu.
```

---

### 6.6 As 7 perguntas da Rodada 1 — placar

| # | Pergunta | Estado depois da Rodada 2 |
|---|---|---|
| **P1** | Pós-chaves 12 fixos: regra ou lacuna? | ✅ **RESPONDIDA** — regra, 4 × 1. A EVI (`cfINC!J`) vota com a #226. Texto substituto em §6.1. Sobra o **rótulo** de `pos_obra.duracao_meses` → **E3**. |
| **P2** | Abrir campo de taxa, ou assumir-se sem juros? | ✅ **DISSOLVIDA** — a premissa era falsa: o app tem juros e os destruía. Virou P2a/P2b/P2c em §6.2. O campo continua fora de escopo por decisão do autor. |
| **P3** | Financiamento à produção segue fora da planilha nova? | ⚪ **EM ABERTO** — nenhum agente tocou. O A3 confirmou `simularDivida` contra a planilha, mas não propôs migrar o `financiamento_producao`, então o risco que eu temia **não se materializou**. Baixa urgência. |
| **P4** | Capital de giro entra? Compete por caixa? | ✅ **RESPONDIDA pelo autor** (decisão 3): entra **só como rótulo** sobre `divida`; rotativo **recusado**. Sobra vocabulário → **E9**. |
| **P5** | `correcao_estoque` some ou ganha motor? | ✅ **RESPONDIDA pelo documento** — a §10.6 do padrão já especifica o comportamento exigido, e o controle atual não o cumpre. A5 mediu: sem dinheiro atrás. Proposta: **retirar da tela** → **E7**. |
| **P6** | Os dois RET se unificam? | ✅ **CONVERGÊNCIA TRIPLA** (A1 + A6 + A4) — deixa de ser pergunta de desenho e vira issue com proposta → **E11**. |
| **P7** | Corretagem sobre permuta física é intencional? | 🔴 **EM ABERTO, e agora sozinha** — nenhum agente da Rodada 1 a tocou, e o A5 não tinha estudo com permuta financeira ativa para medir o efeito. **Continua precisando do autor**: a corretagem é devida sobre a unidade permutada (o corretor intermediou o negócio do terreno), ou é base errada herdada da unificação incompleta da #227 (`frontend/fluxo-caixa-motor.ts:258-263`)? |

**Duas respostas vieram de fora da minha lente**, e vale registrar por quê: P1 caiu porque o A2 leu
uma **planilha** que eu não tinha; P5 caiu porque eu não havia cruzado o controle morto com a §10.6
do **próprio documento** que eu estava auditando. A segunda é erro meu de varredura — procurei
mentiras em trechos rotulados "Comportamento vigente" e não em trechos de **modelo de referência**
que descrevem coisa já construída pela metade.

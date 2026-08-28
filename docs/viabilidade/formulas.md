---
titulo: Fórmulas da Proforma
descricao: Referência das linhas e cálculos da Proforma do Preliminar (Loteamento e Incorporação) e da proforma desalavancada do Avançado.
tipo: app
ordem: 3
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Fórmulas da Proforma

As fórmulas rodam no **frontend em tempo real** (engine `frontend/proforma.ts`, coberta por testes). O backend persiste apenas os inputs.

## Áreas e VGV

**Áreas** (por tipo de empreendimento):

- **Loteamento:** a área vendável é a **Área Líquida de Venda (ALV)** de uma tabela em **cascata**,
  não uma soma plana de percentuais. A cascata tem 11 linhas
  (`CASCATA_LOTEAMENTO`, `frontend/areas-cascata.ts:183`) e subtrai em três degraus:

  ```text
  Poligonal − APP                                              = Área Parcelável   (âncora 2)
  Parcelável − (ELUP/EPU + EPC + viário público)               = Área Líquida
  Líquida − (viário privado + comuns privadas + áreas verdes)  = ALV  ← área vendável
  ```

  Cada uma das **7 linhas editáveis** é digitada em **m²**, **% da Poligonal** ou **% da
  Parcelável** (a última só para as linhas posteriores à âncora 2 — regra de não-circularidade),
  no par de colunas `area_<x>_modo`/`area_<x>_valor`. A ALV é lida em
  `frontend/proforma.ts:464`. Após permuta física → **área vendável líquida**.

  > **Piso em zero (#612).** Nenhuma linha da cascata sai negativa — decisão do autor em
  > 2026-08-28, verbatim: *"Nunca pode ser negativo, não faz sentido ser menor que zero em nenhum
  > caso."* O piso é aplicado **na passada 1** de `calcularCascata`, antes de a linha ser guardada,
  > então o valor cortado é o que as linhas seguintes e a âncora 2 enxergam. Ele vale para as três
  > subtrações **e** para a linha editável (negativo digitado vira 0, e por isso deixa de inflar a
  > linha computada seguinte).
  >
  > Cada linha devolve em `deficitM2` o tamanho do corte, e Premissas → Terreno & Áreas mostra o
  > banner `urbi-banner.aviso-area-negativa` quando ele atuou — capar e avisar, a mesma decisão que
  > a #563 tomou no VGV da permuta. Enquanto o piso atua, as 8 fatias da pizza da gleba deixam de
  > fechar na poligonal: a soma passa dela, e é o número honesto ali (ver `itensAlocacaoGleba`).

  > ⚠️ Os 7 campos antigos de "% da gleba" (`app_pct`, `faixas_nao_edificaveis_pct`,
  > `sistema_viario_pct`, `elup_pct`, `epc_pct`, `epu_pct`,
  > `areas_privativas_nao_vendaveis_pct`) que esta seção descrevia até 2026-08-27 estão
  > **aposentados** desde a migração `020_areas_cascata_loteamento.js` (2026-08-03): continuam no
  > schema, **sem escritor em tela nenhuma**, e nenhuma fórmula os lê. Ler um deles hoje devolve
  > zero em todo estudo criado depois daquela data — foi assim que a pizza "Alocação de áreas da
  > gleba" passou a mostrar uma fatia só (#574).
- **Incorporação:** `área vendável = Área PVT R Fechada + Área PVT NR Fechada` (as **áreas fechadas**); `área privativa` soma também as abertas, e `área construída` soma a área comum.

**VGV — fonte única: o catálogo de Produtos** (`preliminar_produtos`), nos dois tipos:

```
VGV bruto da categoria = Σ (área média × preço de venda/m² × unidades) das linhas daquele `tipo`
VGV da categoria       = VGV bruto da categoria − permuta física EFETIVA da categoria
VGV                    = VGV residencial + VGV não residencial
```

Duas regras governam essa fonte, e as duas existem porque a alternativa produzia número que
ninguém conseguia conferir na tela:

- **Só compõe catálogo a linha com as três grandezas > 0** (área média, preço e unidades).
  "Adicionar Produto" grava a linha em branco, e contá-la como catálogo presente dava VGV zero com
  aparência de catálogo cheio. Sem nenhuma linha efetiva o estudo está em **estado vazio**
  (`semProdutos`): a Proforma não mostra tabela nem KPI, e **nenhuma** despesa em % de VGV produz
  valor. **Não há fallback** para os pares legados de área × preço da linha `estudos` — eles não
  têm campo em tela nenhuma desde a reestruturação do Preliminar.
- **A permuta física é capada no VGV bruto da própria categoria** (#570). A permuta pedida de cada
  `tipo` (`área entregue × preço médio daquele tipo`) é cortada quando vale mais que o VGV bruto
  daquele `tipo` — cada categoria capa sozinha, sem corte proporcional entre as duas e sem que o
  excedente de uma coma o VGV da outra. O VGV da categoria capada para em **zero** e nunca fica
  negativo, e a Proforma mostra um aviso do excedente. A permuta que sai no resultado é a
  **efetiva**, então as duas identidades por categoria — `VGV R + permuta R = VGV bruto R`, idem
  NR — continuam fechando, e a soma delas com elas.

Cada linha do catálogo carrega `tipo` (`residencial`/`nao_residencial`, padrão `residencial`,
#565). **A separação em duas categorias é da INCORPORAÇÃO** (#570): lá, VGV, área total e preço
médio ponderado (`Σ VGV ÷ Σ área`) são calculados por categoria, e é sobre o total da categoria que
as duas permutas do tipo incidem — a física converte `% área venda` sobre a área daquele `tipo` e
valora os m² entregues pelo preço médio daquele `tipo`; a financeira em `% VGV` incide sobre o VGV
daquele `tipo`. **No Loteamento não há categorias**: o motor normaliza o catálogo inteiro para o
bucket residencial antes da separação (a tela de Permutas do Loteamento só expõe os controles
residenciais, e o grid de Produtos não exibe o seletor de tipo ali) — a permuta física valora pelo
preço médio do catálogo, mas a base do `% área venda` continua sendo a **área vendável da cascata**.
Produto gravado antes da migração `035` não tem `tipo` e conta como **residencial**.

Nada disso vale para o estudo **sem catálogo efetivo**: ali não há receita modelada, e as bases das
permutas continuam sendo as legadas (área vendável no Loteamento, `area_pvt_*_fechada` e
`preco_venda_m2_*` na Incorporação). Não há fallback de uma fonte para a outra, em nenhum dos dois
sentidos.

> **O Loteamento não tem fonte legada de PREÇO — #615.** Decisão do autor em 2026-08-28, verbatim:
> *"retire isso então"*. Até ali, a permuta física do Loteamento sem catálogo era valorada por
> `estudos.preco_venda_m2`, um campo que **não tem entrada em tela nenhuma** (o array `PRODUTOS_LOT`
> que o declarava sobrevive só dentro de `TODOS_NUM`, para o tipo numérico do Salvar) **nem `padrao`
> no schema** — então um estudo criado depois da reestruturação do Preliminar tinha a coluna vazia,
> a permuta deduzia **área** e não deduzia **VGV**, e um estudo antigo com a coluna preenchida
> deduzia. O motor não lê mais a coluna, e o campo saiu do `ProformaInput`: os dois estudos agora
> calculam igual.
>
> **Consequência que esta spec declara em vez de esconder:** no Loteamento **sem catálogo efetivo**,
> a permuta física vale **zero** e o cap (`permutaCapada`) é **inalcançável por construção** — a
> permuta pedida e a base do cap são as duas zero, e `>` nunca é verdade. Não é dedução zerada em
> silêncio: `semProdutos` manda a Proforma inteira para o estado vazio da #563 — sem VGV, sem
> tabela e sem o KPI de área permutada ao lado. **Com** catálogo o cap é normalmente alcançável,
> pelo preço médio do catálogo (é o caminho que o PR 607 entregou).
>
> A **Incorporação** mantém a fonte legada (`preco_venda_m2_residencial`/`_nao_residencial`), e lá o
> cap continua alcançável por ela. A assimetria é deliberada: o escopo da #615 é o Loteamento.

## Deduções da receita

Imposto (`4%` se sujeito a RET, senão `imposto_percentual`), corretagem, marketing e permutas financeiras (% do VGV residencial/não residencial — cada uma sobre o VGV da **sua** categoria na Incorporação; no Loteamento só a residencial existe, sobre o bucket único, #570). `Receita líquida = VGV − deduções`.

## Custos diretos

Terreno (`custo/m² × área do terreno`, zerável pelo checkbox “considerar”), projetos, manutenção, contingências (% VGV) e, por tipo: **Loteamento** → infraestrutura (**três** unidades — `% VGV`, `R$` fixo ou `R$/m² × área vendável BRUTA`, antes da permuta física); **Incorporação** → construção, decoração, gestão da construção, outorga, incorporação e registro.

No Loteamento a "gestão da construção" (`taxa_gestao_pct`) **não incide**: o produto de obra ali é a
infraestrutura, e `gestaoConstrucao` sai zerado — assim como construção, decoração, outorga e
incorporação/registro. O **custo de obras** do Loteamento (o numerador de `Custo obras / VGV`) é,
portanto, a infraestrutura sozinha.

## Custos indiretos

Marketing global/estrutura (+ stand de vendas no Loteamento) e gestão/indiretos (% VGV).

## Resultado

`Resultado = Receita líquida − Custo direto total − Custo indireto total`. Também: `+ permutas financeiras` e `+ permutas físicas`. `Margem líquida (%) = Resultado / VGV × 100`.

## Preço Sugerido/m²

Menor preço de venda por m² para a margem atingir o **piso do benchmark `resultado_final`**. Resolvido por bisseção sobre o preço (valor único, mesmo na Incorporação). Ver [Benchmarks](benchmarks).

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
(`fluxoPagamentoParaSalvar`, `frontend/fluxo-pagamento-editor.ts`). O motor legado
(`entrada`/`parcelas`/`repasse`) sobrevive apenas para linha nunca reeditada.

| Grandeza | Onde vive |
|---|---|
| Safra (mês de contratação) | `fluxo-caixa-motor.ts:958-962`, laço em `:1094` |
| PMT | `fluxo-caixa-motor.ts:666` |
| Pagamentos de uma safra | `pagamentosComponenteSafra`, `:1058` |
| Juros e principal separados | `:1126-1141` |
| Carteira por safra | `carteiraSaldoSafra` `:826`; consolidação em `:1149-1169` |
| Agregação no `FluxoCalc` | `calcularFluxo` `:1788`; séries somadas em `:2070-2076` |
| Regra Após-chaves (venda pós-entrega é à vista) | `ehVendaAposChaves` `:958`, aplicada em `:1109` |

> ⚠️ **A matemática de juros existe e é exercitada por estudo real; o que falta é a ENTRADA.** Há
> linha em produção com `taxaMensal` diferente de 0 persistida em `fluxo_pagamento.componentes`
> (estudo 5 de Pinguim: `0.0098636` = 12,5% a.a., R$ 1.259.273,59 de juros de clientes). O modal de
> Fluxo de Pagamento não oferece campo de **taxa** nem de **sinal** (`_renderModalPagamento`,
> `frontend/tela-fluxo-receitas.ts`) — é a **#428** —, e o adaptador `componentesDoLegado` fixa
> `taxaMensal: 0` (`frontend/fluxo-caixa-motor.ts:591,603,610,619`) e `sinalPct: 0`
> (`:590,602,608` — o ramo `concentrado` de `:619` não emite `sinalPct`) porque o espelho legado não
> tem onde guardar essas grandezas.
>
> **Até a #431 isso significava que "Aplicar" APAGAVA os juros da linha**, porque
> `fluxoPagamentoParaSalvar` regenerava os componentes pelo espelho em toda escrita. Desde a #431
> quem grava é `componentesParaSalvar`, que devolve o array persistido verbatim quando o espelho não
> mudou e transplanta `taxaMensal`/`sinalPct`/`jurosNoMesDaContratacao`/`rotulo` — por identidade,
> não por índice — quando mudou. Abrir o modal e aplicar é **no-op**; editar preserva o que o
> espelho não sabe dizer. O que continua faltando é a ENTRADA: uma linha de parcelamento criada
> agora nasce sem taxa e não há onde digitá-la. Escrever "`jurosClientes` é sempre 0" é errado — e
> escrever "os juros viram zero no primeiro Aplicar" passou a ser errado também.

> 🚫 **Não copiar fórmula de carteira do arquivo Urbitá.** As fórmulas de carteira daquele arquivo
> admitem saldo negativo e saldo que volta a crescer depois da última parcela. A recorrência correta
> é por safra: `saldo_s,s = principal_s`, depois
> `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t` — que é o que `carteiraSaldoSafra`
> (`frontend/fluxo-caixa-motor.ts:826`) implementa.
>
> ⚠️ **`validarComponentesSafra` NÃO é fiscalização independente dessa recorrência** — e o texto
> anterior dizia que era. Ele lê os saldos da **própria** `carteiraSaldoSafra`
> (`frontend/fluxo-invariantes.ts:496+`) e confere três coisas: as participações somam 100%, o
> saldo final zera e a série não volta a crescer. **Não reconstrói** `saldo anterior + juros −
> pagamento` a partir dos pagamentos, e o produtor ainda força o último saldo a zero. Uma regressão
> que mantenha a carteira monotonicamente decrescente mas erre juros ou pagamento intermediário
> **passa**. O oráculo de verdade são os cenários dourados, não o validador.

## A segunda proforma — nível Avançado

O Avançado tem proforma própria (`frontend/proforma-avancado.ts`), que **não** roda as fórmulas
do Preliminar: ela relê as séries mensais já calculadas por `calcularFluxo` e as achata na mesma
hierarquia de linhas do Preliminar, para que os dois níveis se comparem na mesma coluna
(`investimentoTotal` e `roiPct` são literalmente a fórmula do Preliminar — ver
`frontend/proforma-avancado.ts:150-162`).

> ⚠️ **A proforma do Avançado é DESALAVANCADA — nenhum lado do funding entra nela.** Nem as saídas
> (parcelas, retorno ao investidor), nem as entradas (liberações, aportes). É visão **econômica** do
> empreendimento, antes de decidir como ele é capitalizado, e é o que mantém TIR, VPL e ROI
> comparáveis entre estudos com e sem funding — a mesma decisão que `frontend/funding-motor.ts:685-689`
> registra para as KPIs do projeto (e que a §8.1 de
> [Funding, Capital Stack e Retorno do Capital](funding-capital-stack) guarda como **ADR histórico**,
> não como norma vigente — a seção está carimbada "Supersedida pela #355"). Quem quiser ler o efeito
> do funding lê a **aba Fluxo de Caixa**, cuja tabela é visão de **caixa** e onde as duas pontas
> existem e se cancelam no principal (`FundingNoFluxo.fluxoMensal`).
>
> Até 2026-08-22 esta função somava `funding.linhasSaida` ao custo sem nunca creditar as entradas:
> o estudo 5 de Pinguim exibia −R$ 62.364.749,03 de resultado onde o valor real é
> R$ 24.668.189,10 (margem −47,87% contra **18,94%**), e o Δ era, ao centavo, a Σ das saídas de
> funding. Todo estudo Avançado **com** funding aparecia no painel como prejuízo catastrófico.
> Corrigido pela issue #426 (medição em Pinguim: `docs/rodada-8/04-regras-reconciliacao.md:1512-1517`).

> ⚠️ **"Custos Financeiros" não significa a mesma coisa em toda tela.** Na proforma (aqui) o grupo
> vale só o custo que o usuário classificou como financeiro — por isso o rótulo desta tela leva o
> parêntese "(exclui serviço da dívida)" (#447). Na aba Fluxo de Caixa e no Resumo o rótulo
> permanece sem parêntese e inclui as duas pontas do funding — são visões diferentes de propósito,
> não uma inconsistência. A tabela completa das três superfícies está no cabeçalho de
> `frontend/proforma-avancado.ts:48-70`.

### O fecho de três linhas (#427)

> Esta subseção migrou para dentro do bloco "proforma desalavancada" (#448) — o corpo do PR #530
> já declarava essa migração como o destino planejado assim que este bloco existisse.

A EVI fecha a proforma com **três** leituras do mesmo projeto
(`Premissas e Resultados!K35/K37/K39` do `EVI_Urbita.xlsx`), cada uma com sua própria base — "a
base acompanha a grandeza": quando a linha soma a permuta física ao numerador, ela soma também ao
denominador; a permuta financeira não entra na base, porque já está dentro do VGV.

| Linha | Fórmula (app) | Fórmula (EVI) | Denominador |
|---|---|---|---|
| `= Resultado` | `resultado` | `P39 = SUBTOTAL(9;P8:P33)` | VGV |
| `= Resultado + Perm. Financ.` | `resultado + c.permutaFinanceiraTotal` | `P37 = P39 − P15 − P16` (ESTORNO, não soma) | VGV |
| `= Resultado + Permutas` | `resultadoMaisPermutaFinanceira + c.vgvPermutaFisica` | `P35 = P37 + permutasFisicasValorTotal` | VGV + permutas físicas |

`c.permutaFinanceiraTotal` (`frontend/fluxo-caixa-motor.ts`) é o total ISOLADO da dedução de
permuta financeira, já com o sinal estornado (positivo) — soma direto de `calcDeducoesReceita`
(que já filtra só `ePermutaFinanceira`). `c.vgvPermutaFisica` já existia (#188/#268).

O rótulo/nota da 3ª linha é condicional, no molde de `K35`/`K36` da EVI: só aparece quando há
permuta física. Com física **e** financeira zeradas, as três linhas coincidem em valor e
percentual, e a linha 3 cai de volta para o rótulo `= Resultado`, sem nota de denominador — a
mesma degenerescência que a linha informativa do funding (acima) também respeita: cada extra some
sozinho quando a grandeza que ele mede é zero, em vez de aparecer com valor zerado.

**Qual das três alimenta cada superfície:** hoje, todas as superfícies (Painel de estudos —
`frontend/tela-dashboard.ts` — e a linha `resultado` lida em `frontend/tela-fluxo-ver.ts`)
continuam usando a **1ª leitura** (`= Resultado`, sem permutas) — a #427 só **acrescenta** as
outras duas à tabela da aba Proforma; nenhuma coluna existente mudou de definição. Unificar
qual leitura cada superfície deveria mostrar é a **#443**, não esta.

## Funding — onde as fórmulas vivem

As fórmulas de **dívida** (aporte único ou em tranches, carência, PMT Price, quitação),
**equity** (aporte, retorno progressivo sobre receita líquida ou concentrado sobre o resultado
final, MOIC e TIR do investidor) e **financiamento à produção** (base de custos elegíveis,
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

fiscalizada por `validarFunding` (`frontend/fluxo-invariantes.ts:496`), que também acusa saldo
de dívida negativo, dívida que não zera no horizonte, diagnóstico próprio de equity (#445) e —
decisão **D14** — caixa acumulado negativo depois do funding (severidade `alerta`).

**Funding nunca integra a Receita Bruta — VGV.** Liberação de dívida e aporte de equity aparecem
**somente** no bloco de funding; o repasse continua sendo recebimento do cliente, ainda que o caixa
alimente o cash sweep.

> ⚠️ **Linha rotativa e empréstimo-ponte não existem — capital de giro EXISTE.** Os tipos aceitos
> são exatamente `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`), e o
> literal `capital_giro` é recusado como tipo novo (`backend/rotas/funding.test.ts:26`). **Isso não
> quer dizer que o produto falte:** `divida` **é** o capital de giro por calendário (decisão 2 do
> autor), a migração `029_funding_operacoes.js:38-43,127-130` converte `capital_giro` para `divida`, e
> `frontend/funding-motor.test.ts:28-38` exercita uma operação `divida` chamada "Capital de giro".
>
> ⚠️ **A conversão preserva valor, taxa anual, carência e prazo — mas NÃO o calendário de
> liberações.** A migração guarda só o **primeiro mês** e a **quantidade** (`inicio_mes` `:149`,
> `aporte_meses` `:156`), descartando os meses e valores individuais de `liberacaoProgramada`; e
> `simularDivida` recria **tranches iguais em meses consecutivos**
> (`frontend/funding-motor.ts:245`). Liberação **não contígua ou de valores diferentes** muda o
> caixa e os juros mesmo com todos os outros parâmetros iguais. Dizer "sem perda de parâmetro" era
> verdade sobre os quatro escalares e falso sobre o cronograma.
>
> ⚠️ **A conversão não é fiel em todo caso, e o próprio código sinaliza:** `politicaAmortizacao`
> deixa de existir no modelo novo, que só tem Price com carência. Camada legada com `cash_sweep` ou
> `bullet` vira Price com o mesmo prazo e recebe **`[revisar]` no nome**
> (`migracoes/029_funding_operacoes.js:138-159`) — é pedido de conferência humana, não equivalência.
>
> O que foi recusado, por decisão, é a linha **rotativa** — ela reintroduziria a competição por
> caixa que a #355 apagou. Falta o **rótulo** na tela (#466), não o produto.

> ✅ **#450 (2026-08-24): não sobrou mais nada inerte na aba `Viabilidade → Financeiro`.**
> `regime_tributario`, os cinco `aliquota_*_pct` e `imposto_sobre_permuta_fisica` saíram do render
> (não tinham leitor em nível nenhum). `sujeito_ret` também saiu — é condição de nível
> (`sujeitoRetVisivelFinanceiro`, `frontend/tela-financeiro.ts:81-83`): a aba só existe para
> `nivel_analise === 'avancado'`, onde a Proforma não é consultada, então a condição colapsa em
> "sempre oculto". `imposto_percentual` fica **visível, sempre desabilitado**
> (`impostoPercentualEditavel`, `:87-89`) — o único editor de verdade continua sendo Premissas
> (Preliminar, `frontend/proforma.ts:245`), que grava a mesma coluna.
>
> Os campos de financiamento, investidor, estrutura de capital e correção monetária **saíram da
> tela** antes (#279/#355); as colunas continuam no schema, sem formulário e sem leitor.

## Valor canônico dos campos multiunidade

**ADR #259 — valor canônico (implementado).** Todo campo multiunidade guarda uma quantidade
canônica: R$ a duas casas para custos e permutas financeiras; m² a duas casas para permuta física.
A unidade exibida é apresentação. **Emenda da #442:** alternar a badge **regrava o campo legado**
na unidade nova — o mesmo número que a tela exibe sob aquela badge —, porque deixá-lo congelado na
unidade antiga fazia a coluna descrever outro valor. O canônico continua intocado, e é ele que
carrega precisão plena; a coluna por unidade é espelho de compatibilidade, na mesma condição de
`infra_pct` em Premissas. Estudos antigos
permanecem legíveis: seu valor ativo é adotado como canônico apenas na primeira interação deliberada.

No Preliminar, os novos campos `*_canonico` coexistem com os campos legados por unidade. No
Avançado, `orcamento_valor_canonico` coexiste com `orcamento_valor` + `orcamento_unidade`; o
resolver já prefere o canônico. A migração dos demais consumidores é a #260.

**Modelo funcional de referência:** cada premissa multiunidade tem uma quantidade econômica
**canônica**; a unidade exibida é apresentação. Toda fórmula — Proforma, Fluxo, Resumo, benchmarks,
sensibilidade, cenários e exportações — consome o **valor resolvido**, e cada percentual declara seu
denominador. Fundação em **#259**, consumidores em **#260**.

### Precisão de resultado — contrato de 2026-08-01

> **Todo valor monetário que é resultado de fórmula tem 2 casas decimais** — na apresentação, na
> entrada e no motor. Convenção **C7** do
> [Padrão de Viabilidade](padrao-incorporacao#anexo-a--convenções-de-cálculo-do-app).

É essa regra que define **qual** representação é canônica: o **valor monetário**. `% do VGV` e
`R$/m²` são **derivados** — carregam precisão plena internamente e arredondam **só para exibir**.

```text
canônico (R$, 2 casas)  ──derivação exata──▶  % do VGV, R$/m²   (exibidos com arredondamento)
        ▲                                              │
        └──────── só muda por edição deliberada ───────┘
```

`converterUnidade` quantiza somente o destino de identidade (R$ ou m²). Percentuais e R$/m² seguem
com precisão plena até a apresentação. Assim, R$ 10.000.000 pode atravessar uma porcentagem com
dízima e retornar exatamente ao mesmo canônico.

**Estado de conformidade, conferido em 2026-08-23:**

| Ponto | Casas hoje | Conforme? |
|---|---|---|
| `frontend/viab-format.ts:11-23` — `fmtR$` (`CASAS_DECIMAIS_MONETARIAS = 2`) | 2 | ✅ |
| `frontend/exportar.ts:16` — importa `fmtR$`, sem formatador próprio | 2 | ✅ |
| `frontend/exportar.ts:242` — `celulaFx` (CSV e PDF), desde a #449 delega para `celula` de `viab-format.ts` — fonte única com a tela | 2 | ✅ corte em R$ 0,005 |
| `frontend/tela-financeiro.ts:154` — `_n` (`casas-decimais="2"`) | 2 | ✅ |
| `frontend/tela-empreendimento-tipologias.ts:178` | 2 (default) | ✅ |
| `frontend/tela-fluxo-custos.ts:673,933` — Orçamento em `rs` | 2 | ✅ |
| `frontend/tela-proforma.ts:83` — `celulaSensibilidade`, a tabela de cenários | 2 | ✅ desde a #492; pela #568 delega para `celulaProforma` (fonte única com a tabela principal, inclusive na notação de sinal) |
| `frontend/fluxo-caixa-motor.ts` — **séries mensais** (`deposita`/`round2`) | 2 | ✅ |
| `frontend/fluxo-caixa-motor.ts:2125-2133` — **agregados escalares** do `FluxoCalc` | plena | 🟡 **não quantizados** — ver a nota abaixo |
| `frontend/fluxo-tabela.ts:40` — `celula` da tabela do Fluxo | 2 | ✅ desde a #449, fonte única com a exportação (ver `viab-format.ts`) |
| `frontend/tela-proforma.ts:50` — `celulaProforma`, a coluna R$ da Proforma | 2 | ✅ desde a #449, via `fmtR$(v, false)`; extraída de método privado (`_fmtContabil`) para função pura testável pela #567 |
| `frontend/tela-fluxo-receitas.ts:485,486` — `precoUnit` e `precoTotal` | 2 | ✅ desde a #449, via `fmtR$(v, false)` |

> 🟡 **O motor não é integralmente conforme ao C7, e marcar a linha inteira ✅ escondia isso.** As
> **séries mensais** passam por `round2` a cada depósito. Mas quatro **agregados escalares** saem do
> `calcularFluxo` com precisão plena: `vgvTotal` (vem direto de `ctxCusto.vgvTotal`, e o acumulador
> é `usada × area_privativa_m2 × preco_m2` sem arredondar, `:85`), `vpl` (`vplFluxo` `:1594-1597` é
> um `reduce` com divisão, sem `round2`), `vgvPermutaFisica` e `receitaBrutaVgv` (`:2050`, subtração
> crua dos dois anteriores).
>
> Área × preço e desconto de VPL produzem fração de centavo com facilidade, então esses quatro
> **podem** carregar mais de duas casas. Hoje o dano é contido porque quem os exibe formata com
> `fmtR$`; vira dano real no dia em que alguém os consumir direto (export, BI, API). Quantizar é
> mudança de motor e **não** cabe num PR de documentação — fica registrado aqui como divergência
> conhecida, não como conformidade.

> ✅ **Resolvido pela #449 (2026-08-24).** A #492 fechou o primeiro ponto (`fmtNum(v, 2)` da
> tabela de sensibilidade, `frontend/tela-proforma.ts:532` desde então); o problema de fundo — quem
> chamava `fmtNum` **sem** o segundo argumento numa posição monetária (`_fmtContabil`, a coluna R$
> da Proforma inteira; e `precoUnit`/`precoTotal` da alocação de receitas) — a #449 trocou por
> `fmtR$(v, false)`, que fixa 2 casas sempre (`fmtNum` declara só `maximumFractionDigits`, então
> "até 2" podia sair "0"). `fmtNum` em si **não mudou de assinatura** — continua servindo m²,
> hectare, unidades e percentual, grandezas **não monetárias** que carregam precisão plena e
> arredondam só para exibir; `celulaProformaM2` (`frontend/tela-proforma.ts:57`, R$/m²) é da mesma
> família e continua fora do escopo do C7 monetário.
>
> ✅ **A #567 (2026-08-27) extraiu `_fmtContabil`/`_fmtContabilM2` — métodos privados de
> `ViabTelaProforma`, sem teste algum — para as funções puras `celulaProforma`/`celulaProformaM2`
> acima, e fechou um bug de SINAL que era ortogonal às casas decimais (por isso não mudava a tabela
> acima): as duas versões antigas mostravam TODA linha de receita/resultado em `Math.abs`,
> escondendo o sinal negativo de uma Receita operacional ou Resultado deficitários. Hoje as duas
> delegam a decisão de parênteses para `negativoContabil`/`celula` (`frontend/viab-format.ts`) — a
> MESMA regra que o Fluxo de Caixa usa: linha de custo sempre entre parênteses, linha de
> receita/resultado só quando o valor é realmente negativo.



Áreas (m²) seguem `decimal(12,2)` na persistência; a regra de resultado acima é declarada para
**valor monetário**.

## Interpretações

Onde a spec era ambígua/contraditória, seguimos o app-protótipo e o bom senso: custo do terreno incide sobre a **área do terreno**; “obras” = infraestrutura (Loteamento) / construção+decoração+gestão (Incorporação); projetos e licenciamento no modo % incidem sobre o **VGV**. Detalhes no cabeçalho de `frontend/proforma.ts`.

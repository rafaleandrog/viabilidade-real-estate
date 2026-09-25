# Rodada 8 — Issues C2 · Receitas, absorção e condições de pagamento

> Escrito por C2 em 2026-08-22. Fontes: `02-regras-evi.md` §2 (R-A2-01…R-A2-22) e §6
> (E-A2-01…E-A2-10); `04-regras-reconciliacao.md` §6.3 itens E1, E3, E6, E7.
> Só as regras rotuladas **DIVERGENTE** ou **AUSENTE** viraram issue. As quatro
> **JÁ IMPLEMENTADAS** que batem com a planilha célula a célula — `R-A2-04` (repasse em
> `fimObra+1`), `R-A2-05` (PMT com prazo decrescente), `R-A2-06` (venda pós-entrega à vista) e
> `R-A2-14` (corretagem sobre contratado × imposto sobre recebido) — estão citadas nominalmente na
> seção **Fora de escopo** de toda issue que poderia quebrá-las.

<<<ISSUE>>>
title: feat(fluxo-pagamento): abrir campo de juros de tabela por componente no modal de Pagamento
priority: 1
sources: R-A2-01 · R-A2-03 · R-A2-18 · E-A2-01 · E-A2-10
---
## Contexto
A EVI Urbitá pratica juros de tabela em **toda** venda a prazo: `Premissas e Resultados!H14`
(`ClienteJurosAA = 12,5% a.a.`) e `!H22` (`ClienteNaoResidJurosAA = 13% a.a.`), convertidos por
`ClienteJurosAM = (1+ClienteJurosAA)^(1/12) − 1`. Eles aparecem em três lugares de `cfINC`: nas
parcelas de obra (cols. AD/AE, `PMT`), nas parcelas de tabela curta (cols. AY/AZ) e — o maior
item — nos juros do saldo a repassar (cols. AJ/AK/AL, `saldo_anterior × ClienteJurosAM`).

O efeito agregado está em `Areas e Precos!C30`+`E30`: **R$ 8.981.262 = 5,41% do VGV**, com a nota
da própria planilha dizendo que *"só é zero se a tabela do cliente não tiver juros"*.

⚠️ **O enquadramento é contraintuitivo e precisa ser lido antes de tudo: não é que o app não tenha
juros.** O estudo 5 de Pinguim tem hoje `taxaMensal: 0.0098636` numa linha de receita — que é
exatamente `(1,125)^(1/12) − 1`, a taxa da EVI — e o motor produz com ela
**R$ 1.259.273,59** de `jurosClientes`. A cadeia inteira funciona em produção. O que falta é a
**superfície de entrada**: não existe campo, e por isso os juros só sobrevivem enquanto ninguém
abrir o modal (ver a issue do pareamento, `E-A2-02`).

## Comportamento atual
- O contrato já tem o campo: `frontend/fluxo-caixa-motor.ts:527-550` — `ComponentePagamento`
  declara `taxaMensal` nos três tipos financiados.
- A matemática já está ligada: `calcularRecebiveisComponentes`
  (`frontend/fluxo-caixa-motor.ts:1064-1163`), consumida por `calcularFluxo` (`:1340-1341`) e
  agregada em `jurosClientes` (`:2050`). `pagamentosConcentrado` (`:774-786`) já capitaliza o
  saldo a repassar por `principal × (1 + taxaMensal)^(mesPagamento − safra)`, com a mesma
  convenção da planilha ("juros começam no mês seguinte à contratação").
- O que zera tudo: `componentesDoLegado` grava `taxaMensal: 0` nos **quatro** caminhos —
  `frontend/fluxo-caixa-motor.ts:589` (entrada parcelada), `:601` (parcelamento de prazo fixo),
  `:608` (ao longo da obra), `:617` (repasse).
- E `fluxoPagamentoParaSalvar` (`frontend/fluxo-pagamento-editor.ts:82-93`) chama
  `componentesDoLegado` em **toda** escrita.
- O modal de Pagamento (`frontend/tela-fluxo-receitas.ts:740-820`) tem `% do total`,
  `Nº parcelas`, `Desconto`, checkbox "Ao longo da obra" e o repasse derivado. **Nenhum campo de
  taxa.**

## Consequência
Todo estudo que passou pelo modal reporta `jurosClientes = 0`. Na escala da EVI isso é
**R$ 8.981.262 — 5,41% do VGV** que não entram em Receita Bruta, Resultado, margem, TIR nem na
base do RET. No único caso medido em produção (estudo 5 de Pinguim), são **R$ 1.259.273,59** que
existem hoje e desaparecem no primeiro "Aplicar".

Na safra do mês 0 do cenário dourado (`02-regras-evi.md` §3), a decomposição mostra onde o
dinheiro está: o saldo a repassar sozinho responde por **R$ 1.457.825,50** de juros — **78% dos
juros daquela safra** —, porque `R$ 4.257.692,43` de principal (`cfINC!AH19`) viram
`R$ 5.715.517,93` no mês 30.

## Comportamento esperado
O plano de pagamento de cada linha de receita declara uma **taxa de juros de tabela em % a.a.**,
convertida para mensal por `i_m = (1 + i_aa)^(1/12) − 1` com precisão plena internamente e
arredondamento só na exibição.

- A taxa é **por componente**: cada linha de Entrada parcelada, cada linha de Parcelamento e o
  Repasse têm a sua, com default herdado de um campo único do plano ("Juros de tabela (% a.a.)").
- `componentesDoLegado` propaga a taxa do formulário nos quatro caminhos, em vez de escrever `0`.
- `0%` continua válido e é o **default de todo estudo existente**: nenhum estudo muda de número
  sem alguém digitar a taxa.
- Taxonomia: **editável por estudo/linha** (`% a.a.`). **Fórmula** derivada: `taxaMensal`.
  **Fixo:** nada. Os 12,5% da EVI são exemplo, nunca hardcode.

## Como implementar
1. `frontend/tela-fluxo-receitas.ts` — um `viab-num` "Juros de tabela (% a.a.)" no cabeçalho do
   modal (default do plano) e um por linha de Entrada/Parcelamento, mais o do bloco Repasse.
2. `frontend/fluxo-pagamento-editor.ts` — o `FormularioPagamento` carrega a taxa em % a.a.;
   `componentesDoLegado` (`frontend/fluxo-caixa-motor.ts:580-620`) converte para mensal e a grava
   em `taxaMensal` nos quatro pontos, em vez de `0`.
3. Exibição: converter de volta por `(1 + i_m)^12 − 1` na leitura, para o usuário nunca ver a taxa
   mensal crua.
4. **Não exige migração.** `fluxo_pagamento` é coluna `json` (`schema.json:305` em
   `avancado_linhas_receita` e `:320` em `avancado_fases`) — **a `versao` do `manifesto.json` não
   bumpa.**

## Critério de aceite
1. **Teste de safra única** replicando o mês 0 da EVI (`02-regras-evi.md` §3): componente
   `prazo_fixo` com `participacaoPct 10 / sinalPct 15 / prazoMeses 36 / defasagemMeses 1 /
   taxaMensal 0,0098635806` sobre `R$ 7.603.022,19` produz sinal de `R$ 114.045,33` no mês 0 e
   **36 parcelas de R$ 21.414,48** (= `cfINC!AY20`).
2. **Repasse:** `4.257.692,43 × 1,0098635806^30 = R$ 5.715.517,93`, dos quais
   `R$ 1.457.825,50` classificados como juros e **não** como principal.
3. **Invariante `R-A2-18`:** `frontend/fluxo-invariantes.ts:66`
   (`vendaLiquidaContratada + jurosClientes`) continua fechando **com taxa ≠ 0**. É este teste que
   prova que os juros estão separados do principal, e não há critério melhor.
4. **Regressão:** rodar a suíte inteira sem informar taxa nenhuma e conferir que **nenhum número
   muda**.
5. Prova de ponta a ponta: abrir o modal do estudo 5, aplicar sem mexer, e o `GET` seguinte
   devolver `taxaMensal` intacto.

## Fora de escopo
- **Não muda a data do repasse.** `REPASSE_MESES_APOS_ENTREGA = 1`
  (`frontend/fluxo-caixa-motor.ts:325`) e `mesRepasse = fimObra + 1` (`:616`) conferem célula a
  célula com `cfINC!AL` (**R-A2-04**, travado pela #345) — capitalizar o saldo **não** é pretexto
  para tornar `apos_entrega_meses` editável de novo.
- **Não mexe no cálculo de parcelas.** `pagamentosAteMarco` (`:713-751`) reproduz o `PMT` de
  prazo decrescente de `cfINC!AD` (**R-A2-05**) e `componentesEfetivosSafra` (`:949-956`)
  reproduz `cfINC!O` para venda pós-entrega (**R-A2-06**). A taxa entra **nesses** cálculos; a
  forma deles não muda.
- ⚠️ **Não alinhar as bases de corretagem e imposto.** Ligar os juros **aumenta a base do RET**
  (`impostoMensal`, `:1434-1444`, incide sobre recebido, que passa a incluir juros) e **não**
  aumenta a base da corretagem (`corretagemMensal`, `:1503`, incide sobre contratado bruto). Isso
  é **R-A2-14**, confere com `cfINC!BK` × `cfINC!BL`, e é correto apesar de parecer inconsistente.
  Qualquer PR que "harmonize" as duas bases está quebrando a paridade com a planilha.
- Não cria KPI de tela (issue própria), não adiciona sinal por componente (issue própria), e não
  resolve o pareamento do editor (issue própria) — sem esse último, este campo é preenchido e
  perdido no clique seguinte.
<<<END>>>

<<<ISSUE>>>
title: fix(fluxo-pagamento): preservar juros e sinal ao adicionar, remover ou reordenar linha do plano
priority: 1
sources: E-A2-02 · R-A2-01
---
## Contexto
O achado nº 2 da rodada é que abrir o modal de Pagamento reescreve o plano e apaga
**R$ 1.259.273,59** de juros do estudo 5. O conserto projetado para ele preserva os campos
só-canônicos (`taxaMensal`, `sinalPct`, `jurosNoMesDaContratacao`, `rotulo`) transplantando-os do
persistido para o regenerado — mas **por índice + tipo**:

```ts
return regenerados.map((r, i) => {
  const orig = originais[i];
  if (!orig || orig.tipo !== r.tipo) return r;   // ← sem par: taxa volta a 0
  …
});
```

Esta issue é o **residual** desse conserto, não ele. Ela existe porque o transplante posicional
cobre exatamente os dois casos que os testes exercitam e deixa passar os dois que o usuário
alcança com um clique.

## Comportamento atual
`componentesDoLegado` (`frontend/fluxo-caixa-motor.ts:580-620`) emite os componentes na ordem
`entradas → parcelas → repasse`, e `fluxoPagamentoParaSalvar`
(`frontend/fluxo-pagamento-editor.ts:82-93`) regenera a lista inteira a cada "Aplicar". Com o
transplante por índice, um plano `[ate_marco 30, concentrado 70]` — que é **exatamente o do
estudo 5** — se comporta assim:

| Ação no modal | Regenerados | Pareamento por índice | Resultado |
|---|---|---|---|
| Aplicar sem mexer | `[ate_marco, concentrado]` | mesma estrutura → verbatim | ✅ preservado |
| Mudar 30% → 40% | `[ate_marco, concentrado]` | tipos casam | ✅ preservado |
| **"Adicionar entrada"** (`frontend/tela-fluxo-receitas.ts:761-763`) | `[imediato, ate_marco, concentrado]` | `[0] imediato×ate_marco` ✗ · `[1] ate_marco×concentrado` ✗ | 🔴 **taxa zerada nos dois** |
| **Remover a linha de parcelamento** (`:804-806`) | `[concentrado 100]` | `[0] concentrado×ate_marco` ✗ | 🔴 **taxa zerada no repasse** |

Há ainda o caso de **migração para o componente errado**: com dois `prazo_fixo` de taxas
diferentes, inserir uma linha no meio desloca os índices e a taxa do primeiro passa para o
segundo — mesmo `tipo`, a guarda não dispara, nenhum erro em lugar nenhum.

## Consequência
O dano é **idêntico ao que o conserto existe para impedir**: silencioso, sem undo, sem campo onde
redigitar. No estudo 5 são os mesmos **R$ 1.259.273,59**, a um clique de distância. E a suíte
nova não cobre nenhum dos dois casos — nenhum teste de `frontend/fluxo-pagamento-editor.test.ts`
adiciona ou remove linha. É o padrão que o `CLAUDE.md` chama de *"a issue fechou não é evidência
de entrega"*: verde, fechada, defeito vivo.

## Comportamento esperado
O pareamento entre componentes persistidos e regenerados **não pode ser posicional**.

1. Parear por **`tipo` + ordem de ocorrência daquele tipo** (o 1º `ate_marco` regenerado herda do
   1º `ate_marco` persistido), ou por identidade estável (`id` gravado no componente).
2. Quando não houver par, **herdar do plano** (a taxa default da linha) em vez de cair em `0`.
3. Se o pareamento robusto não couber no escopo: **bloquear** a edição que perderia dado, com
   banner explícito — *"este plano tem juros de tabela configurados; adicionar linha os
   removerá"*. Um aviso é infinitamente melhor que uma perda calada.

## Como implementar
Mesmo arquivo do conserto (`frontend/fluxo-pagamento-editor.ts`), na função que transplanta os
campos só-canônicos. Trocar o `map((r, i) => originais[i])` por um consumo de fila por tipo:
um índice de ocorrência por `tipo`, com fallback na taxa do plano. Sem migração, sem schema, sem
bump da `versao`.

## Critério de aceite
Um teste de **matriz** em `frontend/fluxo-pagamento-editor.test.ts`, partindo de um plano
`0/30/70` com taxa de 12,5% a.a., cobrindo: adicionar entrada · remover entrada · adicionar
parcelamento · remover parcelamento · reordenar · marcar/desmarcar "Ao longo da obra". Em todas,
`taxaMensal` dos componentes sobreviventes tem de continuar no valor original — hoje os dois
primeiros casos vão a `0`.

A formulação do critério que fecha a issue, e é ela que precisa aparecer no teste:
**para toda sequência de edições no modal, nenhum campo só-canônico de um componente sobrevivente
muda de valor sem que o usuário o tenha editado.**

Caso adicional, para o transplante cruzado: dois `prazo_fixo` com taxas `0,0098636` e `0,0050`;
inserir uma Entrada no topo; as duas taxas continuam **nos seus** componentes.

## Fora de escopo
- Não é a issue do modal que reescreve o plano (achado nº 2 da rodada) — esta **depende** dela e
  deve nascer com `Sem-fechamento: #NNN pré-requisito` apontando para ela.
- Não adiciona campo de taxa (issue própria). Preservar dado que a UI não sabe escrever é
  exatamente o ponto: enquanto não houver campo, perder é irreversível.
- Não toca no motor. `pagamentosAteMarco` / `pagamentosConcentrado` / `componentesEfetivosSafra`
  (**R-A2-05**, **R-A2-04**, **R-A2-06**) não são lidos nem alterados por este diff.
<<<END>>>

<<<ISSUE>>>
title: feat(fluxo-pagamento): exibir em tela, somente-leitura, os juros de tabela já configurados
priority: 1
sources: E-A2-10 · R-A2-01 · R-A2-12
---
## Contexto
Enquanto o campo editável de taxa (issue própria) não existir, há estudos em produção cujos juros
**existem, entram no resultado e não aparecem em lugar nenhum da interface**. No estudo 5 de
Pinguim, `taxaMensal: 0.0098636` produz **R$ 1.259.273,59**, que entram em VGV, Resultado, margem
e TIR (18,59% contra 17,53% sem eles). O usuário vê a TIR e **não tem como descobrir de onde ela
vem**.

O contraste é difícil de defender em voz alta: 9 dos 10 controles da aba Financeiro não fazem
nada, e a grandeza que responde por **5,41% do VGV** da EVI não tem controle nenhum.

## Comportamento atual
`frontend/tela-fluxo-receitas.ts:740-820` renderiza o modal de Pagamento com `% do total`,
`Nº parcelas`, `Desconto`, "Ao longo da obra" e o repasse derivado. `taxaMensal`,
`sinalPct` e `jurosNoMesDaContratacao` — as três grandezas canônicas de
`ComponentePagamento` (`frontend/fluxo-caixa-motor.ts:527-550`) — **não são exibidas nem
mencionadas**. O único lugar do app onde `jurosClientes` aparece é a exportação
(`frontend/exportar.ts:351-352,442-443`).

## Consequência
Sem número novo: o dano é de visibilidade. Mas é ele que torna a destruição do plano
**indetectável pelo usuário** — se a linha "Juros de tabela: 12,5% a.a." estivesse na tela, o
sumiço dela depois de um "Aplicar" seria visto na hora, em vez de virar forense de API meses
depois.

## Comportamento esperado
O modal de Pagamento exibe um **bloco somente-leitura** quando algum componente persistido tiver
`taxaMensal ≠ 0`:

> *Juros de tabela configurados: **12,5% a.a.** (não editáveis nesta versão)*

O valor é lido de `componentes[].taxaMensal` e convertido por `(1 + i_m)^12 − 1`. Quando as taxas
dos componentes divergirem entre si, listar por componente. Quando todas forem `0`, o bloco não
aparece.

Zero input, zero migração, zero mudança de cálculo — **só deixa de esconder**.

## Como implementar
~10 linhas de template em `frontend/tela-fluxo-receitas.ts`, no modal de Pagamento, lendo o
`fluxo_pagamento.componentes` já carregado. Sem lógica de motor. Sem migração, sem bump da
`versao`.

## Critério de aceite
Abrir o modal da linha do estudo 5 e ler `12,5% a.a.`; abrir o do estudo 6 e não ver o bloco.
Teste de unidade sobre a conversão: `taxaMensal = 0.0098636` → rótulo `12,5% a.a.`.

## Fora de escopo
- **Não é a issue do campo editável** — é o pré-requisito dela, não a alternativa. A issue do
  campo deve nascer citando esta.
- Não move `jurosClientes` para KPI de resultado (issue própria).
- Não muda cálculo nenhum, portanto não pode quebrar **R-A2-04/05/06/14**: é template puro.
<<<END>>>

<<<ISSUE>>>
title: fix(absorcao): percentual fora da janela derivada é erro de validação, não descarte silencioso
priority: 1
sources: E-A2-04 · E-A2-05 · 04 §6.3 E3 · R-A2-10
---
## Contexto
A EVI carrega um bloco de fechamento cujo único propósito é pegar esta classe de erro:
`Perfil Vendas!C54:G55` (`VGV SOMADO`, com tolerância declarada em `F55`: *erro máximo 1*), e um
livro de estoque físico em `cfINC!M/N` no qual venda descartada apareceria como unidade não
vendida no fim do horizonte. **O app não tem fechamento nenhum para a absorção.**

## Comportamento atual
`absorcaoMensal`, modo `personalizado` (`frontend/fluxo-shared.ts:373-379`):

```ts
for (const m of absorcao.meses) {
  const idx = n(m?.mes) - periodo.inicio;
  if (idx >= 0 && idx < tamanho) pcts[idx] += n(m?.pct);   // ← fora da janela: SUMIDO
}
```

Não há `else`, não há `console.warn`, não há erro. `periodo.fim` vem de
`periodoAbsorcao` (`:309-315`) → `faixasAbsorcao().pos_obra.fim`, que usa
`APOS_CHAVES_MESES = 12`. `Σ pcts` deixa de ser 100 e **ninguém confere**:
`erroFormularioAbsorcao` (`:328-343`) valida os três campos do formulário **distribuído** e não
toca no `personalizado`; `pctPosObraDerivado` (`:324-326`) faz `Math.max(0, …)`, que também
clampa em silêncio.

O caminho canônico de recebíveis **avisa** no caso simétrico
(`frontend/fluxo-caixa-motor.ts:1085-1092`) — a assimetria é do lado da absorção.

## Consequência
Estudo 6 de Pinguim: `pos_obra.duracao_meses = 13`, curva `personalizado` de 43 meses chegando ao
13º mês pós-obra → **1,41% do VGV, R$ 2.007.856,95, evaporados**, sem uma linha de log. O
resultado exibido é internamente consistente e simplesmente menor que a realidade do estudo.

## Comportamento esperado
Percentual de absorção que cai fora do período derivado é **erro de validação**, não descarte.

1. `absorcaoMensal` devolve também `pctDescartado` (o que caiu fora da janela) e `pctTotal`.
2. `calcularFluxo` **avisa** quando `|Σ pcts − 100| > 0,01`.
3. `frontend/fluxo-invariantes.ts` ganha a asserção de conservação da absorção.
4. Nenhum número de estudo existente muda — a camada **denuncia**, não corrige.

## Como implementar
Três linhas em `frontend/fluxo-shared.ts` (acumular o descartado em vez de ignorá-lo), a asserção
em `frontend/fluxo-invariantes.ts` e o aviso em `calcularFluxo`. Sem migração, sem bump da
`versao`.

## Critério de aceite
1. `absorcaoMensal({modo:'personalizado', meses:[{mes: 99, pct: 10}]}, crono)` hoje devolve soma
   90 sem dizer nada; depois, ou soma 100, ou acusa `pctDescartado = 10`.
2. **Critério numérico próprio, e é ele que fecha a issue:** carregada a curva de 43 meses do
   estudo 6, `Σ pcts` fecha em 100% **ou** o invariante acusa. Se der `98,59%` em silêncio, a
   issue não está entregue.

⚠️ **Armadilha de encerramento, registrada de propósito** (`E-A2-05`): o conserto do modal de
Absorção — outra issue — vai fazer a curva personalizada **sobreviver** ao "Aplicar", o número do
estudo 6 vai mudar, e vai *parecer* que o descarte foi resolvido. Não foi: a curva volta e
continua truncada em 12 meses de pós-chaves. **Verificar "a curva voltou" não fecha esta issue.**
Ela deve nascer com `Sem-fechamento: #NNN pré-requisito` para a issue do modal de Absorção.

## Fora de escopo
- ⚠️ **Não devolve a edição da janela Pós-chaves.** `APOS_CHAVES_MESES = 12`
  (`frontend/fluxo-shared.ts:237`) é decisão da #226 e a EVI **vota com ela**: `cfINC!J` divide
  por **12 literais**, ignorando os próprios inputs de duração da planilha (`Premissas!H9`,
  `Etapas!E11`). Quem está errado é o *Comportamento vigente* de
  `docs/viabilidade/padrao-incorporacao.md:634-637`, que descreve o app de antes da #226 — é
  **texto vencido**, e corrigi-lo é trabalho de documentação, não de motor. Isto é **R-A2-08**.
- Não trava a venda no estoque: a EVI também não trava (o estoque dela fica negativo se os %
  somarem >100%).
- Não altera a distribuição uniforme por janela (**R-A2-09**, `absorcaoMensal` modo `distribuido`,
  `:381-397`), que confere com `cfINC!J49 = 888,885 m² = 0,0541667 × 16.410,18`.
- Não implementa o livro de estoque em m²/unidades — issue própria, que é a camada 2 deste mesmo
  invariante.
<<<END>>>

<<<ISSUE>>>
title: fix(absorcao): impedir que o modal converta curva personalizada em distribuída sem avisar
priority: 1
sources: 04 §6.3 E1 · E-A2-05 · E-A2-06
---
## Contexto
A regra que o app precisa honrar em qualquer modal: **abrir e aplicar sem alterar campo nenhum é
NO-OP.** O modal de Pagamento tem esse defeito e está sendo consertado; o de **Absorção** tem o
mesmo defeito e **não está no conserto** — `frontend/tela-fluxo-receitas.ts` não foi tocado.

E o alvo não é hipotético: existe curva `modo: 'personalizado'` com 43 meses e `aplicado: true`
em produção (estudo 6 de Pinguim).

## Comportamento atual
- `_abrirAbsorcao` (`frontend/tela-fluxo-receitas.ts:516-528`) lê **só** `correcao_estoque` e os
  três `pct` por evento, de `absorcao.blocos`. Numa linha `modo: 'personalizado'` **não há
  `blocos`** — `pct(...)` devolve `0` nos três e o modal **abre zerado**.
- `_absorcaoJson` (`:530-542`) devolve **sempre** `modo: 'distribuido'`, com os quatro blocos
  reconstruídos do formulário. Aplicar converte a linha e **descarta `absorcao.meses[]`
  inteiro**.
- Resultado: uma curva de 43 meses vira `0/0/0` com Pós-chaves derivado em 100%.

## Consequência
**VPL −R$ 360.591,41** medido no estudo 6, por um clique que o usuário considera inofensivo — ele
abriu o modal para *olhar*. Sem aviso, sem undo, e sem forma de reconstruir a curva pela
interface, porque a tela **não sabe gravar `personalizado`** (ver a issue de inventário: essa
curva entrou por um caminho que não é a UI).

## Comportamento esperado
`_absorcaoJson` **nunca** converte modo em silêncio. Duas saídas aceitáveis:

1. Linha `personalizado` abre em **modo somente-leitura**, com aviso explícito de que a curva foi
   definida fora do formulário e que aplicar a substituiria; ou
2. o formulário ganha o modo `personalizado` (edição da série mês a mês).

Para linha `distribuido` — a esmagadora maioria — nada muda.

## Como implementar
`frontend/tela-fluxo-receitas.ts`: `_abrirAbsorcao` passa a detectar `a.modo === 'personalizado'`
e a marcar o formulário como não editável; `_absorcaoJson` preserva `modo` e `meses` quando a
linha for personalizada e o usuário não tiver editado nada. `absorcao` é coluna `json`
(`schema.json:304,319`) — **sem migração, sem bump da `versao`.**

## Critério de aceite
`GET /estudos/6/avancado/receitas`; abrir o modal de Absorção da linha com 43 meses; Aplicar sem
tocar em nada; `GET` de novo → o `absorcao` devolvido é **byte-idêntico** ao anterior. Teste de
unidade equivalente sobre `_absorcaoJson`, com um `absorcao` personalizado de entrada.

## Fora de escopo
- **Não resolve o descarte de R$ 2.007.856,95** — depois deste conserto a curva sobrevive e
  continua truncada em 12 meses de pós-chaves. Isso é a issue do descarte silencioso, com
  critério numérico próprio (`E-A2-05`). Fechar uma por tabela da outra é o erro a evitar aqui.
- Não altera `APOS_CHAVES_MESES = 12` nem a distribuição uniforme por janela (**R-A2-08** e
  **R-A2-09**, ambas conferidas contra `cfINC!J`).
- Não decide o destino do controle "Correção de estoque" no rodapé do mesmo modal — issue própria.
<<<END>>>

<<<ISSUE>>>
title: feat(fluxo-pagamento): permitir sinal na contratação por componente parcelado
priority: 2
sources: R-A2-02 · R-A2-01
---
## Contexto
A EVI separa, dentro da Tabela Curta, o que é **sinal** do que é **parcelado**:
`Premissas e Resultados!D15` (`VendaTCurtaSinalPercSobreTabela = 15%`), `!H20` para o não
residencial, `Perfil Vendas!I19/I20` e `cfINC!AU`
(`Sinal TCurta Resid = 15% × Vendas TCurta Contratadas`). O sinal é % **daquele componente**, não
% do total da venda — o que o distingue da linha de Entrada.

## Comportamento atual
O contrato já tem: `ComponentePagamento.sinalPct` existe em `prazo_fixo` e `ate_marco`
(`frontend/fluxo-caixa-motor.ts:534,543`) e é honrado por `pagamentosPrazoFixo` (`:688`) e
`pagamentosAteMarco` (`:731`) — o sinal é pago no mês da contratação e **fora do cálculo de
juros** (`principal = valor − sinal`, o sinal não amortiza).

`componentesDoLegado` grava `sinalPct: 0` em todos os casos
(`frontend/fluxo-caixa-motor.ts:589,601,608`), e o modal
(`frontend/tela-fluxo-receitas.ts:740-820`) não tem campo.

## Consequência
Sem preço medido isoladamente — o sinal é parte da mesma composição de recebíveis cujo efeito
agregado é `R$ 8.981.262` (5,41% do VGV) na EVI. O que se perde é a **forma**: hoje o mesmo
efeito só se obtém criando uma segunda linha de Entrada com o % equivalente do total
(1,5% = 15% × 10%), o que amarra o sinal a um percentual global e quebra quando o % do componente
muda.

## Comportamento esperado
Cada componente parcelado (`prazo_fixo`, `ate_marco`) aceita um **sinal em % do próprio
componente**, pago no mês da contratação, fora da base de juros. Default `0`, `%` com 2 casas,
**editável por componente**.

A distinção precisa estar dita na própria tela: *Entrada é % do total da venda; sinal é % deste
componente.*

## Como implementar
Campo `viab-num` "Sinal" nas linhas de Parcelamento do modal
(`frontend/tela-fluxo-receitas.ts`), propagado por `componentesDoLegado`
(`frontend/fluxo-caixa-motor.ts:601,608`) para `sinalPct`. O motor já consome. Coluna `json` —
**sem migração, sem bump da `versao`**.

## Critério de aceite
Cenário dourado, safra do mês 0 (`02-regras-evi.md` §3): com `sinalPct = 15` sobre o componente
de 10%, o mês 0 recebe `R$ 760.302,22` (à vista) + `R$ 114.045,33` (sinal) = **R$ 874.347,55**,
que é exatamente `cfINC!BI19` (Receita Total do mês 0). Regressão: com `sinalPct = 0` em toda
parte, nenhum número muda.

## Fora de escopo
- Não remove nem desencoraja a forma atual (segunda linha de Entrada). As duas coexistirão — e
  isso é uma pergunta de UX em aberto (Q3 do `02-regras-evi.md` §4), não uma decisão desta issue.
- Não altera a forma de `pagamentosPrazoFixo`/`pagamentosAteMarco` (**R-A2-05**, PMT com prazo
  decrescente conferido contra `cfINC!AD`): o sinal já é subtraído do principal antes do PMT, e é
  assim que a planilha faz.
- Não toca em **R-A2-06** (venda pós-entrega vira `imediato` de 100%, `:949-956`): componente
  substituído não tem sinal, e isso não muda.
<<<END>>>

<<<ISSUE>>>
title: feat(resultado): mostrar juros de clientes, carteira máxima e exposição máxima como KPIs de tela
priority: 2
sources: R-A2-12 · E-A2-10 · R-A2-01
---
## Contexto
A EVI trata esses três como indicadores de decisão de primeira classe, com o **mês** em que
ocorrem: `Premissas!V8/V9` (*"Exposição máx. pós lançamento"*, *"Exposição máxima"* —
`"5,84% VGV no mês 28"`), `cfINC!BF` (`Carteira Clientes`, pico de **R$ 38,79 MM no mês 28 =
22,2% do VGV**) e `cfINC!DA`, que marca graficamente o mínimo e o máximo da carteira.

## Comportamento atual
`frontend/fluxo-caixa-motor.ts:2050-2053` já calcula `jurosClientes`,
`carteiraClientesMaxima` e `mesCarteiraClientesMaxima`. Eles aparecem **só na exportação**
(`frontend/exportar.ts:351-352,442-443`). Nenhum KPI de tela.

Os mapas de rótulos `ROTULOS_COMPONENTES_RECEITA` / `_CARTEIRA`
(`frontend/fluxo-caixa-motor.ts:1013-1027`) estão sem consumidor, com comentário no código
admitindo isso.

## Consequência
Sem número novo: as grandezas existem e ninguém as vê. O efeito prático é que a única
informação de carteira e exposição do app vive num PDF, enquanto as decisões são tomadas na tela.

## Comportamento esperado
A tela de resultado do Avançado exibe, como KPIs:

- **Juros de clientes** — R$ e % da Receita Bruta;
- **Carteira máxima de clientes** — R$, % do VGV **e o mês**;
- **Exposição máxima de caixa** — R$, % do VGV e o mês.

Tudo **derivado**, nada editável.

## Como implementar
Consumir `FluxoCalc` na tela de resultado do Avançado; aproveitar
`ROTULOS_COMPONENTES_RECEITA`/`_CARTEIRA`, que existem para isso. Formatar por `fmtR$`
(`frontend/viab-format.ts:13`), **não** por uma terceira função local. Sem migração.

## Critério de aceite
`carteiraClientesMaxima` e `mesCarteiraClientesMaxima` renderizados batem com o `max` / `indexOf`
de `carteiraClientesMensal`, em teste de unidade. Snapshot da tela com um estudo de fixture.

## Fora de escopo
- ⚠️ **Ordem importa:** hoje os três KPIs leriam **zero ou quase** em qualquer estudo que tenha
  passado pelo modal, porque `jurosClientes = 0` e a carteira é só principal. Implementar isto
  **antes** ou **junto** do campo de taxa faz o KPI nascer mentindo. Declarar dependência.
- Não muda nenhuma fórmula do motor — é superfície. **R-A2-04/05/06/14** não são tocadas.
- Não unifica política de formatação monetária (issue de outro escopo), mas **também não cria uma
  nova**: usar `fmtR$`.
<<<END>>>

<<<ISSUE>>>
title: feat(receitas): expor velocidade de vendas em área, unidades e estoque, com VSO
priority: 2
sources: R-A2-10 · E-A2-04 · E-A2-08
---
## Contexto
A EVI lê velocidade de vendas em **m² e unidades**, não em % de VGV: `cfINC!J/K/L` (área vendida
por mês), `cfINC!M/N` (`Estoque Residencial` / `Estoque Não Residencial`, decrementados por venda
**e** por permuta física) e `Areas e Precos!C17/F17/I17` (área privativa **de venda** = privativa
− permuta física). O fechamento `estoque_final = estoque_inicial − Σ vendidas − permutadas` é o
invariante de conservação da planilha.

## Comportamento atual
A absorção do app é % de VGV: `vendaBrutaContratadaMensal`
(`frontend/fluxo-caixa-motor.ts:417-431`) faz `vgv × pct / 100`. Não há série de área, de
unidades nem de estoque. Os dados existem: `avancado_tipologias` tem `area_privativa_m2`,
`quantidade` e `unidades_permutadas` (`schema.json:331,334,335`).

## Consequência
Sem preço próprio — o valor desta issue é ser a **camada 2 do invariante de conservação**. Foi a
ausência de livro de estoque que permitiu os **R$ 2.007.856,95** do estudo 6 sumirem em silêncio:
num livro de estoque, descartar 1,41% das vendas deixa 1,41% de unidades não vendidas no fim do
horizonte — resíduo visível e diferente de zero. A EVI carrega exatamente esse livro; o app não
carrega nenhum.

## Comportamento esperado
O motor expõe, além do % e do R$:

- **área vendida por mês (m²)**, **unidades vendidas por mês** e **estoque remanescente** (m² e
  unidades), tudo **derivado** da absorção e das tipologias da linha — sem input novo;
- **VSO mensal** na tela: `vendas do mês ÷ estoque disponível no início do mês`;
- a **permuta física baixa o estoque no mês do Lançamento**, como em `cfINC!G/H`.

Unidades usam arredondamento **de exibição**; o estoque canônico é em m², como na planilha.
Taxonomia: **fórmula**, 100% derivado. Nada editável.

## Como implementar
Séries novas em `frontend/fluxo-caixa-motor.ts`, derivadas das tipologias já carregadas, mais o
fechamento como asserção em `frontend/fluxo-invariantes.ts`. Sem migração, sem bump da `versao`.

⚠️ **Pré-requisito de dado, não de código** (`E-A2-08`): os dois estudos de Pinguim têm
**234 unidades alocadas + 42 permutadas sobre um estoque de 234**, gravado por um `PATCH` de
tipologia que não consulta saldo. Ligar o invariante hoje faria ele acusar `−42` **antes de
qualquer absorção**, em 100% dos estudos conferíveis, sem distinguir "o motor de absorção está
errado" de "a tipologia foi gravada sem saldo". Por isso:

1. esta issue nasce com `Sem-fechamento: #NNN pré-requisito` para a issue da trava do `PATCH` de
   tipologias;
2. o plano inclui um passo explícito de **saneamento**: varrer as tipologias e listar as que
   violam `quantidade ≥ alocadas + permutadas` **antes** de ligar a asserção.

## Critério de aceite
1. Linha com 1 tipologia de `16.410,185 m²` e absorção 15/20/65 → `m²(mês 0) = 820,509` e
   `estoque(mês 0) = 15.589,676`, que é `cfINC!M19` (já descontada a permuta física de
   `2.028,225 m²` no mesmo mês).
2. `GET /estudos/:id/avancado/tipologias` de todos os estudos com
   `quantidade < alocadas + permutadas` vem **vazio** — ou a lista vira anexo da issue.
3. O invariante de fechamento passa em todo estudo de fixture.

## Fora de escopo
- **Não trava a venda no estoque.** A EVI também não trava, e `erroFormularioAbsorcao`
  (`frontend/fluxo-shared.ts:328-343`) já barra soma acima de 100% no formulário distribuído.
- **Não liga `unidades_permutadas` ao `calcularFluxo`** para reduzir VGV — esse é um gap
  conhecido e separado; aqui a permuta física entra **só** no livro de estoque.
- Não altera **R-A2-09** (absorção uniforme por janela) nem **R-A2-08** (`APOS_CHAVES_MESES = 12`).
- Não muda nenhum número financeiro: são séries novas, sem consumidor no cálculo de caixa.
<<<END>>>

<<<ISSUE>>>
title: fix(receitas): tornar visível qual motor de recebíveis cada linha está usando
priority: 2
sources: R-A2-21 · E-A2-03 · 04 §6.3 E6
---
## Contexto
A EVI tem **um** motor de recebíveis. O app tem **dois**, e escolhe entre eles por um critério
invisível ao usuário: se `fluxo_pagamento.componentes` é um array, roda o canônico; se não,
roda o legado.

Três lentes independentes convergiram nisto: a regra `R-A2-21` (pela forma do código), o
inventário da instância (`E-A2-03`) e a auditoria documental (`04 §6.3 E6`, que classifica como a
**19ª mentira documental** o parágrafo de `docs/viabilidade/padrao-incorporacao.md:1026-1033`
prometendo *"auditar a adoção linha a linha"*).

## Comportamento atual
- `frontend/fluxo-pagamento-editor.ts:82-93` grava `componentes` em **toda** escrita → todo Grupo
  editado desde a #248 está no canônico. A adoção **não é gradual**: qualquer "Aplicar" converte.
- `recebiveisComponentesLinha` (`frontend/fluxo-caixa-motor.ts:1165-1168`) devolve `null` quando
  `componentes` não é array; `:1339-1341` então cai no ramo legado.
- **Nada em tela, em rota ou em campo distingue os dois casos.** O único sinal existente é o
  `rotulo` carimbado por `componentesDoLegado` (`"ao longo da obra (legado)"`, `:608`) dentro do
  JSON cru.

Com o **mesmo** `fluxo_pagamento`, os ramos produzem números diferentes:

| Aspecto | Ramo legado (`:1339-1416`) | Ramo canônico (`:1064-1163`) |
|---|---|---|
| Parcelamento de prazo fixo | `total / nParc`, divisão simples | PMT, resíduo na última parcela |
| "Ao longo da obra" | vencimentos ancorados em `obra.inicio_mes + k×intervalo`, **incluindo o mês da venda** | `N_s = fimObra − safra`, 1ª parcela em `safra+1` |
| Venda após a entrega | segue os componentes | **100% à vista** (#235) |
| Juros / carteira / principal | não existem | séries completas |
| Repasse antes da safra | silencioso | lança erro |

## Consequência
Sem preço medido — o inventário mostrou que as 6 linhas dos 2 estudos de Pinguim estão **todas**
no canônico, e nenhum dano observado se explica pela escolha de ramo. O que existe é risco de
leitura: saber em qual ramo a linha está **não é curiosidade, é premissa para interpretar o
resultado**, e hoje só se descobre por forense de API. Uma linha legada, além disso, **nunca
poderá receber juros de tabela**, e a regra "venda pós-entrega é à vista" (**R-A2-06**) não vale
para ela.

## Comportamento esperado
O passo mínimo, e é o desta issue:

1. A tela **marca visivelmente** todo Grupo que ainda cai no ramo legado — *"plano não migrado:
   abra e aplique para usar o modelo de safras"*.
2. `console.warn` no ramo legado, nomeando a linha.
3. Um **teste que afirma a divergência conhecida** entre os dois ramos (a tabela acima), para que
   "unificar" os ramos sem decisão fique **vermelho** em vez de silencioso.
4. Substituir o parágrafo de fecho de `padrao-incorporacao.md:1033` pelo texto já redigido em
   `04-regras-reconciliacao.md` §6.3 E6, que diz a verdade: a migração é global na prática e não
   existe superfície de auditoria.

## Como implementar
Badge em `frontend/tela-fluxo-receitas.ts` derivado de `Array.isArray(fp?.componentes)`; `warn`
em `frontend/fluxo-caixa-motor.ts:1339-1341`; teste em `frontend/fluxo-caixa-motor.test.ts` com
dois Grupos de mesmo `fluxo_pagamento`, um com `componentes` e outro sem, afirmando que
divergem. Sem migração, sem bump da `versao`.

## Critério de aceite
O teste novo falha se alguém unificar os ramos sem decisão explícita — é essa proteção que falta
hoje. E a badge aparece num estudo de fixture sem `componentes`, e não aparece num com.

## Fora de escopo
- **Não remove o ramo legado.** Removê-lo muda resultado de todo estudo com Grupo não migrado, e
  só pode ser decidido depois de o inventário cobrir **todas** as instâncias — não uma. Esta
  issue é deliberadamente a opção (b) de `R-A2-21`: cosmética e no-op numérico.
- **Não migra dados.** Nenhum `fluxo_pagamento` é reescrito por este diff.
- Não pode alterar `componentesEfetivosSafra` (**R-A2-06**, `:949-956`), `pagamentosAteMarco`
  (**R-A2-05**) nem `mesRepasse = fimObra + 1` (**R-A2-04**) — o teste de divergência **afirma** o
  comportamento dos dois ramos, não o corrige.
<<<END>>>

<<<ISSUE>>>
title: fix(absorcao): retirar da tela o controle inerte de Correção de estoque
priority: 2
sources: R-A2-19 · 04 §6.3 E7
---
## Contexto
`docs/viabilidade/padrao-incorporacao.md:865-874` (§10.6, **modelo de referência**) já
especifica: *"Quando existir uma opção de correção de estoque, seu comportamento deve ser
explícito e testável. Ela não pode: criar um quinto período; alterar o VGV total; esconder
percentuais que não fecham; produzir estoque negativo; modificar silenciosamente preços ou
condições de pagamento."*

O controle de hoje viola a premissa da frase inteira: ele **existe**, é **persistido**, e não é
nem explícito nem testável, porque **não faz nada**.

A EVI, note-se, **também não pratica** correção monetária em `cfINC`: a busca por
INCC/IGPM/IPCA/CDI/TR nos ~200 `definedName`s e nas 114 colunas não retorna nada. A planilha
embute a correção **dentro** da taxa nominal de tabela (12,5% a.a.), sem índice separado.

## Comportamento atual
- Duas badges interativas "Não/Sim" no rodapé do modal de Absorção, ao lado do botão Aplicar:
  `frontend/tela-fluxo-receitas.ts:597-603`.
- Lido no `_abrirAbsorcao` (`:521`), gravado no `_absorcaoJson` (`:534`), com default no backend
  (`backend/rotas/avancado.ts:283`).
- `grep -rn "correcao_estoque" frontend/ backend/ --include=*.ts | grep -v test` retorna **só**
  esses pontos — **nenhum consumidor no motor**.

## Consequência
Sem dinheiro atrás: as 6 linhas dos 2 estudos de Pinguim estão em `false`. Mas é o **pior formato
de campo morto que o app tem** — um controle interativo, ao lado do botão de confirmar, que o
usuário liga acreditando ter ativado uma premissa do estudo.

## Comportamento esperado
Retirar o controle da tela. `absorcao.correcao_estoque` continua sendo **aceito** no JSON e
ignorado — o dado persistido fica intacto, nada é apagado.

Reintroduzi-lo **só** junto com o motor que a §10.6 exige, que depende de um modelo de correção
que não existe. E, se um dia existir, o modelo da EVI é **taxa nominal única por componente**
(a issue do campo de juros), **não** índice separado — implementar índice seria ir além da
planilha, sem oráculo.

## Como implementar
Remover o bloco de badges de `frontend/tela-fluxo-receitas.ts:597-603` e o campo do `absForm`.
Manter a leitura/escrita tolerante no backend. **Sem migração, sem bump da `versao`** — nenhuma
coluna sai do schema.

## Critério de aceite
`grep -rn "correcao_estoque" frontend/ --include=*.ts | grep -v test` deixa de retornar
`tela-fluxo-receitas.ts`. Um `GET` de linha com `correcao_estoque: true` gravado continua
respondendo `true` — o dado não foi destruído, só deixou de ter controle.

## Fora de escopo
- **Não decide o destino de `indice_correcao` / `indice_correcao_taxa_aa`**
  (`schema.json:151-152`, `backend/rotas/estudos.ts:34`). São um problema **diferente**: coluna
  morta **sem** UI desde a #279, sem dano ativo, só dívida. A decisão — dar motor ou remover do
  schema com migração — é do autor, e esta rodada **registra, não decide**.
  ⚠️ Registre-se também a correção de um erro anterior: `frontend/tela-financeiro.ts:9-30` **não
  renderiza** esses campos; aquelas linhas são um bloco de comentário `//` documentando a remoção
  da #279.
- Não implementa correção monetária de espécie alguma.
- Não toca no cálculo de absorção (**R-A2-08**, **R-A2-09**).
<<<END>>>

<<<ISSUE>>>
title: feat(receitas): separar a base da permuta financeira em dois flags de dedução independentes
priority: 2
sources: R-A2-15
---
## Contexto
A EVI declara **dois booleanos separados** para a base da permuta financeira:
`Premissas!N17` (`permutaFinanceiraCorretagemDeduzir`) e `!N18`
(`permutaFinanceiraImpostosDeduzir`), consumidos em
`cfINC!BN = −|perm%| × Receita Total Resid × MAX(0; 1 − deduzImp×|imp%| − deduzCorr×|corr%|)`.

## Comportamento atual
O app tem **um** flag para os dois: `permuta_financeira_base` é um enum `bruta | liquida`
(`schema.json:375` em `avancado_linhas_custo`, migração `018_permuta_financeira_base.js`, #238),
lido em `frontend/fluxo-caixa-motor.ts:1550-1555,1961` e editável em
`frontend/tela-fluxo-custos.ts:769-771`. A base líquida deduz imposto **e** corretagem, sempre
juntos (`permutaFinanceiraLiquidaMensal`, `:1565-1572`).

## Consequência
Sem preço medido. É lacuna de expressividade: as duas combinações mistas da planilha
(deduzir só imposto, ou só corretagem) **não são representáveis**.

## Comportamento esperado
A base da permuta financeira declara **duas** deduções independentes: `deduzir_imposto` e
`deduzir_corretagem`.

- `bruta` (hoje o default) ≡ ambas falsas; `liquida` ≡ ambas verdadeiras — **nenhum estudo
  existente muda**.
- Manter as **séries realizadas** de imposto e corretagem como base, e **não** as alíquotas:
  isso é mais correto que a planilha, porque a corretagem da EVI incide sobre **contratado** e a
  aproximação por alíquota erra no tempo.
- Taxonomia: **editável por linha de custo**, dois booleanos, defaults `false/false`.

## Como implementar
**Exige migração** e, portanto, **bump da `versao` do `manifesto.json`**: duas colunas booleanas
em `avancado_linhas_custo`, com backfill a partir do enum existente (`liquida` → `true/true`,
`bruta` → `false/false`). O caminho sem colunas novas — estender as `opcoes` do enum — não serve:
`limite: 10` não comporta os rótulos das combinações mistas, e alterá-lo também é migração.
`permuta_financeira_base` continua sendo aceito na escrita, mapeado para o par de booleanos.

## Critério de aceite
`(false,false)` reproduz `permutaFinanceiraBrutaMensal` exatamente; `(true,true)` reproduz
`permutaFinanceiraLiquidaMensal` exatamente (testes existentes em
`frontend/fluxo-caixa-motor.test.ts:1915,1978` continuam verdes sem alteração); as combinações
mistas ficam **entre** as duas.

## Fora de escopo
- ⚠️ **Não converte a base para alíquotas.** A divergência com `cfINC!BN` (séries realizadas ×
  alíquotas) é **intencional** e precisa estar escrita no corpo do PR, ou alguém a "conserta"
  depois.
- **Não unifica as bases de corretagem e imposto.** `corretagemMensal`
  (`frontend/fluxo-caixa-motor.ts:1503`) incide sobre **contratado bruto** e `impostoMensal`
  (`:1434-1444`) sobre **recebido** — são bases e momentos diferentes de propósito
  (**R-A2-14**, `cfINC!BL` × `cfINC!BK`), e este é o par mais fácil do app de "consertar" por
  engano para uma base só.
- Não decide se corretagem incide sobre permuta física (pergunta em aberto, P7 de
  `04-regras-reconciliacao.md` §4).
<<<END>>>

<<<ISSUE>>>
title: fix(receitas): resíduo de parcelamento sem prazo deve rolar para o repasse, não virar caixa imediato
priority: 2
sources: R-A2-07
---
## Contexto
Na EVI, uma venda contratada **no próprio mês do marco** não vira parcela de obra: o
`IF(m até chaves > 0; 30% × contratado; 0)` de `cfINC!AH` falha e os 30% da tabela longa daquela
safra **rolam inteiros para o saldo a repassar**, sendo pagos no mês seguinte com juros.
`cfINC!AH48` (mês 29) absorve **100%** da TL daquela safra, não 70% —
`AH48 = AN47 + V48 = R$ 36.141.701,63`.

## Comportamento atual
`componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030-1042`) converte o componente
`ate_marco` com `N_s ≤ 0` em **`imediato`** — recebido no próprio mês do marco, sem juros. A
escolha está documentada no código e é defensável, mas **não é a da EVI**.

## Consequência
Pequena em valor, real em conceito: afeta **uma única safra** (a do mês do marco), mas
antecipa em um mês um caixa que a planilha só reconhece depois — e num mês crítico para a
exposição máxima, que é indicador de decisão (`Premissas!V8/V9`).

## Comportamento esperado
Quando um componente `ate_marco` não tem prazo (`N_s ≤ 0`), sua participação é **transferida para
o componente `concentrado` da mesma linha**, se houver, e só vira `imediato` se não houver
nenhum.

O comportamento é **declarado no plano** — `residuoAteMarco: 'concentrado' | 'imediato'` — com
default **`imediato`**, que preserva todo estudo existente. Taxonomia: **editável** (enum).

## Como implementar
Campo no `fluxo_pagamento` (coluna `json`, `schema.json:305,320`) — **sem migração, sem bump da
`versao`** — lido em `componentesIntegradosSafra`
(`frontend/fluxo-caixa-motor.ts:1030-1042`). Controle no modal de Pagamento.

## Critério de aceite
Estudo com absorção 100% no último mês de obra e plano `24% ate_marco + 56% concentrado`:
com `'imediato'`, 24% entra no mês `fimObra`; com `'concentrado'`, 80% entra no mês
`fimObra + 1`, corrigido pela taxa do componente. Regressão: sem o campo, nenhum número muda.

## Fora de escopo
- **Não muda o mês do repasse.** `mesRepasse = fimObra + 1`
  (`frontend/fluxo-caixa-motor.ts:616`, `REPASSE_MESES_APOS_ENTREGA = 1`, `:325`) confere com
  `cfINC!AL` (**R-A2-04**) e continua travado pela #345.
- **Não muda a fórmula de `pagamentosAteMarco`** (`:713-751`), que reproduz `cfINC!AD` célula a
  célula (**R-A2-05**): só o tratamento do caso degenerado `N_s ≤ 0` muda, e só sob opt-in.
- **Não muda a regra de venda pós-entrega** (**R-A2-06**, `componentesEfetivosSafra:949-956`,
  100% à vista a partir de `fimObra + 1`). Este resíduo é o mês `fimObra`, **anterior** a ela —
  os dois casos são vizinhos e não podem ser fundidos.
<<<END>>>

<<<ISSUE>>>
title: feat(receitas): permitir fração do repasse antecipada na assinatura
priority: 2
sources: R-A2-13
---
## Contexto
A EVI reserva estrutura para o produto bancário em que o banco antecipa parte do repasse ao
incorporador: `Premissas!H15` (`FinancProdPercentualRepasseAntecipado`, rótulo `E15`
*"Repasse antecip a VP na assin."*), `Perfil Vendas!I23`
(`(1 − VendaTLongaObraPercSobreTabela) × FinancProdPercentualRepasseAntecipado`) e as colunas
`cfINC!X–AC` (`Repasse a antecipar`, `Liberação repasse antecipado`,
`Rep. a antecipar acum.`) — presentes, nomeadas, e **fixas em `0` neste arquivo**.

## Comportamento atual
Não existe. O componente `concentrado` (`frontend/fluxo-caixa-motor.ts:774-786`) é único e
integral: todo o saldo é pago no `mesPagamento`.

## Consequência
Sem preço medido, e **sem caso de teste real**: a EVI zera o campo. É lacuna de modelo, não
defeito.

## Comportamento esperado
O componente de repasse admite uma **fração antecipada**: `p%` do saldo é liquidado no **mês da
assinatura** (a própria safra), a valor presente, e `(1−p)%` segue para o repasse no marco, com a
capitalização normal.

Taxonomia: **editável por componente**, `%` com 2 casas, default **0** — que reproduz o
comportamento atual **e** o arquivo da EVI.

## Como implementar
Campo no `fluxo_pagamento` (coluna `json`) e ramo em `pagamentosConcentrado`
(`frontend/fluxo-caixa-motor.ts:774-786`). **Sem migração, sem bump da `versao`.**

⚠️ **Depende de resposta do autor** (Q5 de `02-regras-evi.md` §4): a planilha não exercita o
campo, então não há oráculo numérico. Abrir com `Sem-fechamento` para a issue de perguntas, ou
segurar até a resposta.

## Critério de aceite
Com `p = 0`, **nenhum número muda** em nenhum estudo (regressão da suíte inteira). Com `p = 30%`,
a safra `s` recebe `0,30 × principal` no mês `s` e `0,70 × principal × (1+i)^(R−s)` no mês `R`.

## Fora de escopo
- **Não altera o mês do repasse** nem o torna editável: `mesRepasse = fimObra + 1` continua
  travado (**R-A2-04**, #345, conferido contra `cfINC!AL`). Antecipar uma fração é diferente de
  mover a data.
- **Não altera a capitalização do saldo remanescente**, que continua
  `principal × (1 + taxaMensal)^(mesPagamento − safra)` com juros começando no mês seguinte à
  contratação — a convenção de `cfINC!AJ`.
- Não modela o lado do banco (custo do dinheiro antecipado) — isso é funding, fora deste escopo.
<<<END>>>

<<<ISSUE>>>
title: feat(receitas): ponderar preço de tabela entre área fechada e área aberta com deflator
priority: 2
sources: R-A2-16
---
## Contexto
A EVI forma o preço médio da tipologia ponderando duas áreas com preços diferentes:
`Premissas!O10` (`PrecoAreasAbertasDeflator = 50%`), `Areas e Precos!F8 = F7 × (1 − deflator)`,
`Areas e Precos!F6 = F20/F14` (preço médio ponderado) e `Projetos Inc!K10/K11` (privativa
residencial **fechada** × **aberta**).

## Comportamento atual
`avancado_tipologias` tem um único `area_privativa_m2` e um único `preco_m2`
(`schema.json:331,336`). Não há noção de área aberta nem de deflator.

## Consequência
Sem preço medido no app — o efeito é sobre o **VGV potencial**, não sobre o motor de recebíveis.
Hoje o usuário só consegue representar varanda/terraço/quintal embutindo-os na área fechada (o
que superestima o VGV) ou omitindo-os (o que o subestima).

## Comportamento esperado
Cada tipologia declara, **opcionalmente**, uma **área privativa aberta**, e o estudo declara um
**deflator de preço da área aberta** (% do preço da área fechada). O preço efetivo passa a ser

```
(fechada × preço + aberta × preço × (1 − deflator)) / (fechada + aberta)
```

e o VGV usa esse preço. **Default: área aberta = 0**, que reproduz exatamente o cálculo atual.
Taxonomia: **editável por tipologia** (m², 2 casas) e **por estudo** (deflator, %), defaults 0.

## Como implementar
**Exige migração e bump da `versao` do `manifesto.json`**: 2 colunas em `avancado_tipologias`
(área aberta e, se for o caso, preço próprio) e 1 em `avancado_parametros` (deflator). A migração
só adiciona colunas com default 0 — não transforma dado existente.

## Critério de aceite
Fechada `17.530,944 m²`, aberta `907,466 m²`, preço `9.500`, deflator `50%` → preço médio
`9.266,2236553` e VGV `170.854.431,21`, que são `Areas e Precos!F6` e `!F20`. Regressão: com
área aberta 0 em toda tipologia, nenhum VGV muda.

## Fora de escopo
- **Prioridade menor que as issues de juros e absorção**: isto impacta o VGV potencial, não o
  motor de recebíveis nem a carteira.
- Não altera a base da corretagem nem a do imposto (**R-A2-14**) — só o preço que forma o VGV.
- Não introduz preço por unidade nem tabela de preços por andar/posição.
<<<END>>>

<<<ISSUE>>>
title: feat(testes): trazer a EVI Urbitá para o repositório como fixture golden de recebíveis
priority: 2
sources: E-A2-09 · R-A2-01 · R-A2-18
---
## Contexto
O cenário dourado de `02-regras-evi.md` §3 é reconciliável com a planilha célula a célula, mas
**não é executável por ninguém**: ele descreve um estudo que não existe. E a rodada mostrou que
depender da instância não funciona — não foi possível conferir cenários (vazios nos dois estudos)
nem equity (nenhuma operação cadastrada), e a versão publicada não foi confirmada.

O que faltaria em Pinguim para a §3 ser verificável:

| Precisa | Estado |
|---|---|
| Linha com os 4 componentes da EVI (`imediato 10` · `prazo_fixo 10` sinal 15 prazo 36 · `ate_marco 24` marco=`fimObra` · `concentrado 56`), todos com a taxa de 12,5% a.a. | estudo 5 tem **a taxa**, mas o plano é `0/30/70` — não valida sinal nem tabela curta |
| Cronograma com Lançamento 0..2 e Obra 0..29 (`fimObra = 29`, repasse no mês 30) | não confirmado |
| Tipologias com área e quantidade consistentes | 🔴 quebrado (`234 + 42 > 234`) |
| ≥ 1 cenário cadastrado | 🔴 vazio |

## Comportamento atual
As 22 regras da lente EVI vivem em prosa, num documento. Nenhum teste do repositório afirma
nenhuma delas contra os números da planilha.

## Consequência
Sem número próprio. A consequência é de método: enquanto a EVI não for fixture, toda regra desta
rodada é uma afirmação que ninguém pode contradizer automaticamente — e é assim que paridade se
perde numa refatoração sem nenhum teste ficar vermelho.

## Comportamento esperado
A EVI Urbitá vira **fixture no repositório**, não expectativa sobre uma instância:

- `frontend/fixtures/evi-urbita-golden.ts` — premissas + séries esperadas de `cfINC` para a safra
  do mês 0 e para os totais do projeto;
- `frontend/fixtures/evi-urbita-golden.test.ts` — mesmo padrão do `calliandra-golden`.

A instância continua servindo para o que só ela sabe: **dado real, com as formas que a UI
produz**. O que ela não pode ser é a única fonte de verdade de um teste.

## Como implementar
Escrever os dois arquivos, com os números já apurados: safra do mês 0 sobre `R$ 7.603.022,19`,
36 parcelas de `R$ 21.414,48` (`cfINC!AY20`), 29 parcelas de `R$ 72.656,88` (`cfINC!AD20`),
repasse de `R$ 5.715.517,93` no mês 30, receita total do mês 0 de `R$ 874.347,55`
(`cfINC!BI19`), juros totais de `R$ 8.981.262` (`Areas e Precos!C30`, 5,41% do VGV) e receita
líquida em 90,26% do VGV (`Premissas!R19`). Sem migração.

## Critério de aceite
⚠️ **A prova é que o fixture EXECUTA**, não que existe: o número de testes reportado por
`bash scripts/validar-frontend.sh` tem de **subir**, e o fixture tem de falhar se a §3 divergir.

Lição registrada no `CLAUDE.md` e que esta issue não pode repetir: os 16 golden cases do Capital
Stack existiram, commitados, e **nunca rodaram** — o glob `frontend/*.test.ts` não alcança
subdiretório. O glob **já foi corrigido** nos dois lugares (`package.json:10` e
`scripts/validar-frontend.sh`), então o caminho está aberto — mas confira a contagem, não o
arquivo.

## Fora de escopo
- Não implementa nenhuma das regras que testa. Enquanto a taxa não for configurável, o fixture
  precisa injetar `taxaMensal` diretamente no contrato canônico — o que é legítimo, e prova a
  matemática independentemente da UI.
- Não substitui o `calliandra-golden`, que cobre recebíveis por safras de outra origem.
- Não cria dado em Pinguim (isso é pendência do autor, em ambiente autenticado).
<<<END>>>

<<<ISSUE>>>
title: feat(auditoria): inventariar planos com juros configurados e mapear o caminho de escrita paralelo
priority: 2
sources: E-A2-01 · E-A2-06 · R-A2-01
---
## Contexto
Dois dados de qualidade-EVI existem em Pinguim e **nenhum deles pode ter sido escrito pela
interface**:

- **estudo 5** — `taxaMensal: 0.0098636`, que é `(1,125)^(1/12) − 1` até a 7ª casa, exatamente
  `Premissas e Resultados!H14`. `fluxoPagamentoParaSalvar`
  (`frontend/fluxo-pagamento-editor.ts:82-93`) **nunca** gravou isso: `componentesDoLegado`
  escreve `taxaMensal: 0` nos quatro caminhos, e o modal não tem campo
  (`frontend/tela-fluxo-receitas.ts:740-820`).
- **estudo 6** — `absorcao.modo: 'personalizado'` com 43 meses e `aplicado: true`.
  `_absorcaoJson` (`frontend/tela-fluxo-receitas.ts:530-542`) grava **sempre**
  `modo: 'distribuido'`. O motor **lê** `personalizado` (`frontend/fluxo-shared.ts:373-379`), mas
  a tela não o produz.

Os dois casos mais sofisticados da instância — os que **mais se aproximam do modelo da EVI** —
foram escritos por algo que não é a UI.

## Comportamento atual
Não há inventário, nem superfície que mostre quantas linhas têm taxa, sinal ou curva
personalizada. A única forma de saber é ler o JSON cru pela API, estudo por estudo.

## Consequência
Sem número — e é justamente esse o problema. **Enquanto o inventário não existir, toda estimativa
de impacto desta rodada é chute:** o estudo 5 pode ser um caso isolado ou a ponta de uma carteira
inteira de estudos configurados no modelo EVI, todos a um clique de perder os juros.

## Comportamento esperado
1. **Varredura `GET`-only** do `fluxo_pagamento` e do `absorcao` de **todas** as linhas de receita
   de **todos** os estudos de **todas** as instâncias, contando quantas têm
   `componentes[].taxaMensal ≠ 0`, `sinalPct ≠ 0`, `jurosNoMesDaContratacao = true` ou
   `absorcao.modo = 'personalizado'`. O resultado vira **anexo da issue**.
2. **Pergunta ao autor, e ela muda o escopo de metade das issues desta fatia:** existe um caminho
   de escrita paralelo (script, seed, `PATCH` manual, importador, outra app do shell) alimentando
   `fluxo_pagamento` e `absorcao`? Se existir:
   - ele é um **cliente de fato do contrato canônico** e precisa entrar na matriz de regressão —
     hoje nenhum teste o representa;
   - as issues de "feature ausente" (campo de taxa, curva personalizada editável) **mudam de
     natureza**: não são features novas, são **a UI alcançando um modelo já em uso**;
   - a prioridade da issue de pareamento sobe, porque o dano recai sobre o trabalho de alguém.

## Como implementar
Estender `scripts/conferir-estudo.ts`, que já está na árvore e já fala com a API. Somente `GET`.
Nenhuma escrita, nenhuma migração, nenhum bump da `versao`.

## Critério de aceite
Tabela anexada à issue com, por instância e por estudo: nº de linhas de receita, nº com
`taxaMensal ≠ 0`, nº com `sinalPct ≠ 0`, nº com `modo: 'personalizado'`, nº ainda no ramo legado
(sem `componentes`). E a resposta do autor sobre o caminho de escrita, registrada no corpo.

## Fora de escopo
- Não altera nenhum dado. Não altera nenhum código de produção.
- Não decide o que fazer com o resultado — mas **é pré-requisito declarado** das issues de taxa e
  de pareamento: decidir sem o inventário é o risco que ela existe para eliminar.
<<<END>>>

<<<ISSUE>>>
title: feat(proforma): nomear a Receita líquida de proforma e registrar no código a divergência da base do equity
priority: 3
sources: R-A2-22 · E-A2-07
---
## Contexto
A EVI tem uma grandeza "Receita líquida" explícita, em `Premissas e Resultados!P19`
(`SUBTOTAL(9; P8:P18)`):

```text
Receita bruta (VGV)              P8   = 174.870.231,97
(-) Imposto            (4,00%)   P12  =  -6.994.809,28
(-) Corretagem         (4,74%)   P13  =  -8.294.448,51
(-) Marketing          (1,00%)   P14  =  -1.748.702,32     ← MARKETING ENTRA
(-) Permuta Financeira Resid     P15  =           0,00
(-) Permuta Financeira Não Res.  P16  =           0,00
= Receita líquida                P19  = 157.832.271,87  (90,26% do VGV — Premissas!R19)
```

E tem **outra** base, deliberadamente diferente, para ratear a permuta financeira (`cfINC!BN`),
que **não** deduz marketing. São duas noções de "líquida" no mesmo modelo, de propósito. As duas
planilhas concordam entre si: `fluxo_investidor_FORMULAS!equity!C18 = C4*(1−C15−C16−C17)` faz o
mesmo com os 3%.

## Comportamento atual
O app tem a **segunda** (`permutaFinanceiraLiquidaMensal`,
`frontend/fluxo-caixa-motor.ts:1565-1572`, deduz imposto e corretagem) e **não tem a primeira**:
não existe grandeza "Receita líquida" no `FluxoCalc` que desconte marketing. Marketing é linha de
custo do grupo `indireto`, somada no consolidado.

E há uma **terceira** base em uso: `frontend/funding-motor.ts:58-67`, que dimensiona equity, é
**deliberadamente diferente das duas planilhas** — por decisão explícita do autor em 2026-08-21
(*"equity é um retorno líquido ao investidor, não importa esse fator para o cálculo"*). Essa
decisão vive **numa conversa**, não no arquivo que ela governa.

## Consequência
Sem R$ — é dívida de nomenclatura, e o mecanismo dela já foi catalogado 17 vezes nesta rodada
(mentiras documentais). O próximo agente que abrir `funding-motor.ts:58-67` com
`fluxo_investidor_FORMULAS!equity!C18` ao lado vai ver uma divergência de 3%, "consertar", e
**mudar silenciosamente toda simulação de equity já feita**. O terreno está adubado:
`docs/viabilidade/formulas.md:61-86` já mente sobre funding.

## Comportamento esperado
Nenhum cálculo muda. Três coisas de nome e de registro:

1. A taxonomia do Avançado ganha **Receita líquida de proforma**, nomeada e derivada:
   `Receita Bruta − imposto − corretagem − marketing − permuta financeira`, exposta na proforma e
   declarável por quem precisar dela.
2. Os nomes existentes ficam **qualificados**: `permutaFinanceiraLiquidaMensal` documentado como
   "líquida **de imposto e corretagem**"; qualquer consumidor de "receita líquida" **declara qual
   das duas usa**.
3. Comentário em `frontend/funding-motor.ts:58-67` com a decisão do autor **verbatim e datada
   (2026-08-21)**, dizendo que a divergência com `equity!C18` e com `Premissas!P19` é
   **intencional** e que marketing não entra por decisão de produto — no formato dos `ADAPTADO`
   que o repo já usa para este fim.

## Como implementar
Grandeza derivada em `frontend/fluxo-caixa-motor.ts` + exibição na proforma do Avançado;
comentários; e um **teste que afirma a divergência** (`base do equity ≠ base da proforma`), para
que alinhá-las fique vermelho. Sem migração, sem bump da `versao`.

## Critério de aceite
1. Com os % da EVI (imposto 4%, corretagem 5% sobre contratado, marketing 1%, permuta 0),
   `Receita líquida de proforma / Receita Bruta = 90,26%` (`Premissas!R19`).
2. `permutaFinanceiraLiquidaMensal` continua **sem** marketing — o teste **afirma** que as duas
   séries divergem, não as corrige.
3. O teste da base do equity falha se alguém alinhá-la à planilha.

## Fora de escopo
- ⚠️ **A base de receita líquida do equity NÃO muda.** É decisão vinculante do autor;
  `frontend/funding-motor.ts:58-67` fica exatamente como está. Esta issue **registra** a
  divergência, não a resolve.
- **Não estende a dedução de marketing à permuta financeira.** A EVI explicitamente não autoriza
  isso: `cfINC!BN` deduz apenas imposto e corretagem, por flag (**R-A2-15**).
- **Não altera as bases de corretagem e imposto** (**R-A2-14**): corretagem sobre contratado
  (`:1503`), imposto sobre recebido (`:1434-1444`).
<<<END>>>

<<<ISSUE>>>
title: feat(receitas): declarar a linha de receita como unidade de regime comercial, com defaults herdados
priority: 3
sources: R-A2-11
---
## Contexto
A EVI permite regimes comerciais distintos por segmento: `Premissas!H16`
(`VendasNaoResidDiferenciarCondicoes`) é um flag que, ligado, substitui **todo** o bloco de
premissas comerciais pelo espelho não residencial (`D17:D20`, `H17:H22`), via 12 `definedName`s
do tipo `IF(VendasNaoResidDiferenciarCondicoes; …Input; …Residencial)`. Ela vai além: distingue
"NR normal" de "NR diferenciada", esta vendida à vista num único mês
(`vendaDiferenciadaNaoResidInicioObra`, `Premissas!M11`: `"início"` ou `"final"` da obra).

## Comportamento atual
Cada linha de receita já tem `absorcao` e `fluxo_pagamento` próprios
(`schema.json:304-305`), então **duas linhas já dão dois regimes** — a estrutura existe. O que
falta: a UI não sugere esse uso, não há herança de premissas globais para linhas novas, e não há
como declarar "esta tipologia inteira é vendida à vista no mês X".

## Consequência
Sem preço medido. É lacuna de UX e de documentação: o usuário que precisa de dois regimes não
descobre sozinho que o caminho é criar duas linhas.

## Comportamento esperado
1. Confirmar **por escrito**, na documentação de fórmulas e no padrão de incorporação, que
   **linha de receita é a unidade de regime comercial**: cada uma tem sua absorção, seu plano de
   pagamento e sua taxa.
2. O painel de premissas do estudo guarda um **default herdado** por linhas **novas** — nunca um
   valor que sobrescreva o que a linha já gravou.
3. Texto de ajuda na tela de Receitas dizendo isso.

Taxonomia: **editável por linha**; o default global é **editável por estudo**.

## Como implementar
Predominantemente texto e template. O default herdado é campo novo no painel de premissas do
estudo, aplicado só na criação de linha — sem tocar em linha existente. Se o default precisar de
coluna própria, é migração e bump da `versao`; se couber no JSON de parâmetros já existente,
não é.

## Critério de aceite
Dois grupos — Residencial a 12,5% a.a. e Não residencial a 13% a.a. — produzem `jurosClientes`
igual à soma dos dois, e `receitaPorComponenteMensal` agrega os dois **sem misturar carteiras**
(cada safra é isolada, `frontend/fluxo-caixa-motor.ts:1094`). Criar uma linha nova herda o
default; editar o default **não** altera nenhuma linha já gravada.

## Fora de escopo
- Não implementa "venda à vista num único mês" como modo de absorção (a "NR diferenciada" da
  EVI) — é modelo novo, sem demanda registrada.
- Não cria flag global de "diferenciar não residencial": no app isso é uma segunda linha, e a
  issue **documenta** essa equivalência em vez de replicar o flag da planilha.
- Não altera a absorção uniforme por janela (**R-A2-09**) nem `APOS_CHAVES_MESES = 12`
  (**R-A2-08**, decisão da #226 corroborada por `cfINC!J`).
<<<END>>>

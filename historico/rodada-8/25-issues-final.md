# Rodada 8 — lista final de issues, deduplicada e ordenada

> Consolidação dos quatro cadernos de redação (`20-issues-c1.md`, `21-issues-c2.md`,
> `22-issues-c3.md`, `23-issues-c4.md`), escritos por agentes que **não enxergaram o trabalho uns
> dos outros**. Escrito em 2026-08-22. Este arquivo é a fonte para `gh issue create` — um bloco por
> issue, na ordem em que devem ser abertas.

## Placar

| | |
|---|---:|
| Blocos que entraram (C1 19 · C2 18 · C3 17 · C4 13) | **67** |
| Fundidos — 12 blocos colapsaram em **5** issues | **−7** |
| Divididos — 1 bloco virou 1 conserto **+** 1 pergunta ao autor | **0** |
| Retirados — resolvidos pela leitura dos prints da planilha | **−1** |
| Nascidos da leitura dos prints | **+1** |
| **Issues finais** | **60** |

Por prioridade: **16 P1 · 33 P2 · 10 P3**.
Por área (uma issue pode ter mais de uma): `ui` 28 · `motor` 25 · `docs` 19 · `funding` 16 ·
`backend` 7 · `decisao` 2.

> **Recontado em 2026-08-22**, depois de o autor responder as 15 decisões. `decisao` caiu de **6
> para 2**: #430, #432, #473 e #483 foram respondidas e perderam o label; sobram **#480** (fecha
> apontando para #465) e **#484** (`correcao_estoque`, adiada de propósito). A #446 subiu de P2
> para P1 ao trocar o sintoma pela causa. As respostas na íntegra estão em
> `24-perguntas-multipla-escolha.md` § *Respostas do autor*.

## As cinco fusões, e por quê

| Issues fundidas | Vira | Por quê |
|---|---|---|
| `fix(receitas): modal de Fluxo de Pagamento…` (C1) + `fix(fluxo-pagamento): preservar juros e sinal…` (C2) + `fix(funding): o conserto do modal tem que provar…` (C3) | **R8-07** | **Duas metades e uma asserção do mesmo conserto, na mesma função.** C1 tem a medição e o desenho; C2 provou que o transplante **por índice** falha ao adicionar/remover linha; C3 exigiu que o teste cubra o retorno do investidor. A própria C3 dizia *"o caminho barato é absorvê-la lá"* |
| `fix(receitas): modal de Absorção…` (C1) + `fix(absorcao): impedir que o modal converta…` (C2) | **R8-06** | Mesmo defeito, mesmo `arquivo:linha`. C2 acrescenta que o modal **abre zerado** e um critério verificável contra a instância (`GET` byte-idêntico) |
| `fix(absorcao): janela de vendas…` (C1, metade do descarte) + `fix(absorcao): percentual fora da janela…` (C2) | **R8-04** | Mesmo laço de `frontend/fluxo-shared.ts:374-377`. C1 traz a medição em R$; C2, a formulação como erro de validação |
| `feat(proforma): nomear a Receita líquida…` (C2) + `docs(funding): declarar que a base do equity diverge…` (C3) | **R8-43** | A **mesma decisão do autor**, documentada duas vezes por lentes diferentes. A fusão eleva de P3 para P2 — juntas, elas mostram **quatro** composições de "receita líquida" convivendo |
| `fix(invariantes)` ×3 (C1: `§D1`, `§D2`, `§D5`) | **R8-21** | Três falsos positivos determinísticos, no **mesmo arquivo**, com **um conserto de uma linha cada**, e **nenhum muda número**. O dano é o **composto**: cinco erros vermelhos permanentes treinam o usuário a ignorar o painel onde moram os verdadeiros positivos |

## A divisão, e por quê

`fix(absorcao): janela de vendas respeita a duração do Pós-obras e nenhuma venda é descartada em
silêncio` (C1) misturava **duas coisas com estatutos diferentes**:

- ✅ **o descarte silencioso é defeito puro** — `absorcaoMensal` soma só quando `idx < tamanho`,
  **sem `else`**, e o 43º ponto da curva do estudo 6 some: **−R$ 2.007.856,95**. Virou **R8-04**,
  P1, sem controvérsia;
- 🔴 **fazer a janela obedecer `pos_obra.duracao_meses` contradiz uma decisão do autor**
  (`APOS_CHAVES_MESES = 12`, #226 — e a EVI vota junto: `cfINC!J` divide por 12 literal, ignorando
  os próprios inputs). **Não pode sair como conserto.** Virou **R8-05**,
  `question(cronograma)`, apresentando o conflito: ou a janela passa a obedecer o campo (e a decisão
  dos 12 muda), ou o campo ganha cadeado na tela para parar de mentir.

## Uma separação que NÃO virou fusão

`feat(funding): rotular divida…` (C3) e `docs(vocabulario): "Capital Stack" sobreviveu à #355` (C4)
tinham a **varredura dos resíduos** nas duas. Ficaram **separadas**: o rótulo de capital de giro e o
registro da recusa do rotativo são **R8-44**; a varredura de texto de tela é **R8-31**, que já
cobria as mesmas linhas por outra lente (`fix(textos)`, fatia C1) e absorveu a redação da C4. O
critério `grep -rn "Capital Stack" frontend/` mora numa issue só — a R8-31 —, e as duas ficam
ligadas em **Relacionadas**. Fundir daria uma issue com dois entregáveis disjuntos e um critério de
aceite que ninguém consegue fechar de uma vez.

## Os três itens que dependiam do print da planilha — resolvidos

Os PNGs foram extraídos de `xl/media/*.png` da `lista bugs 20260807.xlsx` **depois** de os cadernos
serem escritos. Com isso, a issue `question(auditoria): três itens da lista de bugs só fecham com os
prints (38, 43, 45)` **foi retirada** — os três têm veredito:

| Item | Veredito | Consequência |
|---:|---|---|
| **45** — cálculo automático de área permutada | ✅ **confirmado** | O print pede o rodapé `ÁREA PERMUTADA 1.650 m²` ao lado de `TOTAL TERRENO`, que é o que `frontend/tela-fluxo-custos.ts:445-450,477-478` já entrega. **Nenhuma issue.** ⚠️ O print traz `Unit Delivery`/`Sales Revenue` em inglês, mas é **captura antiga**: no código de hoje os rótulos já estão em português (`frontend/tela-fluxo-custos.ts:754,767`). Abrir issue de tradução seria falso positivo |
| **38** — largura da coluna Orçamento com Permuta física | ✅ **cláusula atendida** | O print mostra o Orçamento virando select de Tipologia + quantidade, Resultado `Sem valor monetário` e Distribuição `Entrega de unidades 🔒`, **na mesma largura das linhas em R$**. **Nenhuma issue** |
| **43** — formato da tabela da Proforma | 🔴 **achado novo** | O print é a **PROFORMA INCORPORAÇÃO da EVI**, e ela fecha com **três linhas de resultado**; o app tem **uma**. Virou **R8-02**, P1 |

O mesmo print de #43 traz **evidência visual** para duas issues que já vinham das fórmulas: a
dedução de **Marketing (−1,00%)** para chegar à Receita líquida (**R8-43**) e o par de checkboxes
*"Deduzir das permutas financeiras: ☑ corretagem ☑ impostos"* (**R8-37**). As duas ganharam a
citação no corpo.

## Como esta lista está ordenada

**P1 antes de P2 antes de P3**; dentro da prioridade, **por consequência medida em R$**, e as issues
sem valor medido vêm depois das com valor.

Duas convenções, ditas porque mudam a ordem:

1. **Figura que é falso alarme não conta como consequência.** A R8-21 (invariantes) carrega
   Δ R$ 28.637.634,53 — mas é a diferença entre o que o **validador** espera e o que o motor produz
   **corretamente**. Nenhum centavo se move; ela fica no grupo sem valor.
2. **Esta numeração não é a ordem de merge.** A ordem da cadeia que move o mesmo denominador
   (Resultado, Margem, ROI, TIR) está na **R8-46** (`chore(processo)`), e ela é por dependência, não
   por tamanho. Abrir na ordem daqui, mergear na ordem de lá.

## Formato de cada bloco

```
<<<ISSUE>>>
id: R8-NN
title: [P1] fix(escopo): …
labels: P1, motor
sources: …
---
<corpo em markdown>
<<<END>>>
```

`labels` traz **exatamente uma** prioridade (`P1`/`P2`/`P3`) e uma ou mais áreas
(`motor`·`ui`·`backend`·`docs`·`funding`·`decisao`). `decisao` marca issue cuja entrega é **uma
resposta do autor**, não código — toda issue com prefixo `question(` ou `decide(` a leva.

> ⚠️ **Nenhuma issue desta lista fecha issue antiga por keyword.** As que se apoiam em executoras da
> Rodada 7 já trazem a linha `Sem-fechamento: #NNN <motivo>` no corpo, como o guard
> `scripts/guard-issue-fechamento.mjs` exige.

---

<<<ISSUE>>>
id: R8-01
numero: 426
title: [P1] fix(proforma): parar de contar o principal do funding como custo na proforma do Avançado
labels: P1, motor, ui
sources: 05-conferencia-numerica.md §D14 · §D15 · 06-auditoria-ui.md §5.4 · 09-consertos.md BUG 1 · C1
---
## Contexto
Medido pelo agente A5 contra a instância Pinguim (`https://homolog.urbiverso.com.br`, `viabilidade@0.1.28`), reexecutando os motores do repo sobre os inputs reais dos estudos 5 e 6 (`05-conferencia-numerica.md` §D14). A auditoria de UI chegou ao mesmo `arquivo:linha` por outro caminho — mapeando as 12 superfícies que exibem VGV/Resultado/Margem/ROI (`06-auditoria-ui.md` §5.4). O conserto foi projetado, escrito e executado em verde por outro agente, e depois **revertido por decisão do autor** (`09-consertos.md`, aviso do topo): a árvore está idêntica à `main`. O corpo daquele documento é a especificação desta issue.

## Comportamento atual
`frontend/proforma-avancado.ts:92-93` soma **todo** o `funding.linhasSaida` ao grupo `financeiro` do custo direto:

    const totalDoGrupo = (g: string) => linhasDoGrupo(g).reduce((s, x) => s + x.total, 0)
      + (g === 'financeiro' ? (funding?.linhasSaida ?? []).reduce((s, l) => s + l.total, 0) : 0);

`linhasSaida` é **amortização + juros**, não custo financeiro. E as `linhasEntrada` (liberações e aportes) **não aparecem em lugar nenhum da função** — o projeto "paga" o principal inteiro e nunca o "recebe". O resultado (`frontend/proforma-avancado.ts:112`) é `receitaLiquida − custoDireto − custoIndireto`.

Dois call sites, os dois de decisão:
- `frontend/tela-fluxo-ver.ts:232` — aba **Resultados** do estudo Avançado, `proformaAvancado(c, area, this.funding)`.
- `frontend/tela-dashboard.ts:273` — **painel de estudos**, alimentando as colunas VGV, Resultado, Margem e ROI de todos os estudos.

## Consequência
O Δ é, **ao centavo**, a soma das saídas de funding:

| Indicador | Estudo 5 exibido | Estudo 5 correto | Estudo 6 exibido | Estudo 6 correto |
|---|---:|---:|---:|---:|
| Resultado | −R$ 62.364.749,03 | R$ 24.668.189,10 | −R$ 62.950.054,14 | R$ 28.358.402,21 |
| Margem | **−47,87%** | 18,94% | **−44,84%** | 20,20% |
| ROI | **−33,27%** | 24,57% | **−31,86%** | 26,69% |
| Investimento total | R$ 187.423.251,83 | R$ 100.390.313,70 | R$ 197.559.191,50 | R$ 106.250.735,15 |

Δ do estudo 5: **R$ 87.032.938,13** (= Σ `linhasSaida`); do 6: **R$ 91.308.456,35**. Entradas ignoradas: R$ 72.873.413,68 e R$ 77.723.686,54.

**Todo estudo Avançado com funding aparece no painel como prejuízo catastrófico** — e os dois únicos estudos Avançados da instância estão nessa condição.

## Comportamento esperado
A proforma do Avançado é **desalavancada**: existir funding **não move nenhum número** dela. Nem as saídas entram no custo, nem as entradas entram na receita.

Invariantes a valer depois do conserto:
- `p.resultado === Σ c.fluxoMensal` (reconcilia com o fluxo livre);
- a linha "(-) Custos Financeiros" vale **exatamente** o custo financeiro próprio do estudo (as linhas de custo do grupo `financeiro`), **não** o serviço da dívida;
- `p.investimentoTotal === Σ c.custoMensal`.

## Como corrigir
Alternativa **(a)**, já projetada e executada em verde antes da reversão (`09-consertos.md` BUG 1): `proformaAvancado` **deixa de receber o parâmetro `funding`** — removido da assinatura, não ignorado, para que reintroduzi-lo exija mudança deliberada nos call sites em vez de uma linha esquecida.

- `frontend/proforma-avancado.ts:1-3` — remover `import type { FundingNoFluxo }`.
- `frontend/proforma-avancado.ts:100-110` — assinatura passa a `(c, areaPrivativa)`.
- `frontend/proforma-avancado.ts:128-137` — `totalDoGrupo` sem o termo de funding; o filtro `temLinha` volta a ser `linhasDoGrupo(g).length === 0 → continue`.
- `frontend/tela-fluxo-ver.ts:226-233` — `proformaAvancado(c, area)`; `this.funding` continua servindo à tabela do fluxo, que **não** muda.
- `frontend/tela-dashboard.ts:5-16` e `:219-256` — o bloco que montava `funding` e a chamada `listarFundingOperacoes(estudo.id)` saem junto: eram o único consumidor. Efeito colateral positivo: **um request a menos por estudo Avançado da página**.
- `scripts/conferir-estudo.ts:240-243` — call site do script reexecutável.

Justificativa a escrever no topo de `frontend/proforma-avancado.ts`, para ninguém reabrir ao contrário:
1. financiamento é atividade de financiamento, não custo econômico — amortização devolve principal, e o custo do capital já é remunerado no VPL/TIR que descontam a TMA;
2. TIR, VPL, Payback e Exposição já são desalavancados por decisão explícita (§8.1 de `docs/viabilidade/funding-capital-stack.md`, preservada na reescrita da #355) — proforma alavancada no meio de indicadores desalavancados produz margem que nenhum outro número reconcilia;
3. o painel compara Preliminar e Avançado nas **mesmas colunas**, e o Preliminar não modela funding;
4. a alternativa **(b)** — creditar as duas pontas — **foi descartada e o teste a reprova**: as duas pontas não se cancelam (`|Σ entradas − Σ saídas| > 0,01` na fixture `CONFIG_COMPLETA`), e qualquer saldo devedor remanescente vazaria para o Resultado como se fosse lucro.

⚠️ **Desambiguação obrigatória do rótulo** (correção 2 do topo de `09-consertos.md`): tirar o funding da proforma faz **"Custos Financeiros" significar coisas diferentes** em duas telas, e sem isso alguém reabre o bug ao contrário — *"sumiu o custo financeiro"*. Escrever nos dois arquivos:

| Superfície | Visão | Funding |
|---|---|---|
| `frontend/fluxo-tabela.ts:560-580` (aba Fluxo de Caixa) | **caixa** | as duas pontas — e por isso o principal se cancela |
| `frontend/proforma-avancado.ts` (aba Resultados) | **econômica**, antes de decidir como o projeto é capitalizado | nenhuma ponta |

com a frase "quem quiser ler o efeito do funding lê a aba Fluxo de Caixa, não esta". `frontend/fluxo-tabela.ts` **não muda**.

## Critério de aceite
1. `grep -n "linhasSaida" frontend/proforma-avancado.ts` **não retorna nada**.
2. `grep -n "proformaAvancado(" frontend/ scripts/ -r` — nenhum call site passa terceiro argumento.
3. O teste `#351 proforma: custo do funding entra em Custos Financeiros; aporte NÃO vira receita` em `frontend/fluxo-apresentacao.test.ts` **trava o defeito** (afirma que o Resultado cai exatamente `Σ linhasSaida`) e **precisa ser substituído** por `proforma do Avançado é DESALAVANCADA: existir funding não move nenhum número (D14)`, que: monta a mesma operação de dívida, prova que `|Σ entradas − Σ saídas| > 0,01` (é isto que reprova também a alternativa (b)) e trava as três invariantes da seção anterior.
4. Rodando `scripts/conferir-estudo.ts` contra os estudos 5 e 6 de Pinguim, o Resultado da proforma bate com `Σ c.fluxoMensal`: **R$ 24.668.189,10** e **R$ 28.358.402,21**.
5. `bash scripts/validar-frontend.sh` verde (baseline na `main`: 411 testes de frontend, typecheck exit 0).

## Fora de escopo
- `frontend/fluxo-tabela.ts` — a aba Fluxo de Caixa é visão de caixa e continua mostrando as duas pontas.
- A **incoerência de definição** entre Resumo, Resultados, painel e Proforma do Preliminar. Consertar o sinal resolve metade; as definições continuam divergindo. Issue própria (`fix(indicadores): uma definição por rótulo…`).
- `funding-motor.ts` — nenhuma linha muda.
- `manifesto.json` — sem migração, **a `versao` não bumpa**.

## Relacionadas
- **R8-49** (registro das cinco montagens dos Passos 23–25) — a causa **estrutural** de este defeito ter conseguido existir: um dos cinco consumidores tinha regra própria. ⚠️ A fonte única que a resolveria foi **recusada** pelo autor (D-Q03), então aquela issue registra a causa em vez de eliminá-la — e este conserto **não** espera por ela.
- **R8-18** (uma definição por rótulo) — **depende** desta: unificar em cima da função que soma o principal do funding propagaria o erro para o Resumo.
- **R8-22** (renomear "Custos Financeiros") — entrega a *"Desambiguação obrigatória do rótulo"* que a seção **Como corrigir** acima exige. Sem ela, o defeito tem rota de retorno.
- **R8-23** (docs: a proforma do Avançado é desalavancada) — a metade documental do mesmo conserto.
- **R8-43** (baseline dos KPIs) — esta é a **primeira** mudança da cadeia que move número; o baseline tem de ser capturado antes.
<<<END>>>

<<<ISSUE>>>
id: R8-02
numero: 427
title: [P1] feat(proforma): a proforma do Avançado fecha com três linhas de resultado, como a EVI
labels: P1, motor, ui
sources: `lista bugs 20260807.xlsx` aba #43 (print embutido) · B1 §4 (item 43) · A2 (`Premissas e Resultados`) · leitura dos prints, 2026-08-22 · resposta do autor, 2026-08-22
---
## Contexto
Item **43** da `lista bugs 20260807.xlsx`; issue original **#350** da Rodada 7. O item ficou duas
auditorias inteiras marcado como **indecidível sem o print** — a aba `#43` da planilha contém uma
imagem, e nenhum agente de auditoria vê imagem. Em **2026-08-22** os PNGs foram extraídos do próprio
pacote (`xl/media/*.png`, referenciados por `xl/drawings/drawing*.xml`) e lidos. O item deixou de ser
indecidível — **e o que a imagem mostra não é uma questão de formato, é uma linha de resultado que o
app não tem.**

O print é a **PROFORMA INCORPORAÇÃO da EVI Urbitá**. A segmentação dela **bate** com a do app em tudo
que vem antes do fecho:

| Linha da EVI | Onde o app já faz |
|---|---|
| `= Receita líquida` | `frontend/proforma-avancado.ts:85` |
| `= Custo direto total` | `:104` |
| `= Custo indireto total` | `:110` |

O pedido original dizia que *"é diferente da segmentação encontrada em fluxo de caixa"* — e é: a
segmentação está certa. **O que difere é o fecho.**

## Comportamento atual
`frontend/proforma-avancado.ts:113` empurra `'= Resultado'` e a tabela termina ali. **Uma linha de
resultado, sem qualificação.** O corpo inteiro da função (`:75-126`) não conhece outra.

## Comportamento esperado
A EVI fecha com **três** linhas, e são três leituras do **mesmo projeto**:

| Linha da EVI | Valor | % declarado no print |
|---|---:|---:|
| `Resultado + Permutas` | 44.083.724 | **22,8%** |
| `Resultado + Perm. Financ.` | 26.998.281 | **15,3%** |
| `Resultado` | 10.696.879 | **6,1%** |

As diferenças, lidas do próprio print: a permuta **financeira** vale
`26.998.281 − 10.696.879 = R$ 16.301.402`; a **física**, `44.083.724 − 26.998.281 = R$ 17.085.443`.

**Cada linha tem a sua própria base** — respondido pelo autor em **2026-08-22**, e é o que reconcilia
os três percentuais do print:

| Linha da EVI | Grandeza que soma | Denominador do % |
|---|---|---|
| `Resultado` | resultado do projeto, sem permuta | **VGV** (`Premissas e Resultados!P8`, R$ 174.870.231,97) |
| `Resultado + Perm. Financ.` | resultado **+** permuta financeira (R$ 16.301.402) | **VGV** |
| `Resultado + Permutas` | resultado **+** permuta financeira **+** permuta física (R$ 17.085.443) | **VGV + permutas físicas** (≈ R$ 193,3 MM) |

Confere com o print nos três: `10.696.879 / 174.870.232` = **6,12%** ≈ 6,1% ✅;
`26.998.281 / 174.870.232` = **15,44%** ≈ 15,3% ✅; e `44.083.724 / 193.300.000` ≈ **22,8%** ✅ —
enquanto sobre o VGV puro daria 25,2%, que **não** é o número do print. É também o que explica a nota
`1/(VGV + Permutas Físicas)` visível na própria planilha, ao lado da linha de baixo.

A regra, em uma frase: **a base acompanha a grandeza.** Quando a linha soma a permuta física ao
numerador, ela a soma também ao denominador; a permuta **financeira** não entra na base, porque já
está dentro do VGV.

## Consequência
São **três leituras do mesmo projeto separadas por 16,7 pontos percentuais**, e o app mostra **uma**
sem dizer qual das três é.

Contra a meta de **20%** do benchmark `margem_liquida` — que o autor calibrou em 2026-08-21 — o mesmo
empreendimento **aprova folgado** pela linha de cima (22,8%) e **reprova em dois terços** pela de
baixo (6,1%). Não é diferença de arredondamento: é a diferença entre um projeto que passa e um que
não passa, decidida por uma escolha de linha que o app não expõe e o usuário não sabe que existe.

E o efeito se compõe com o que já foi catalogado: o estudo 5 de Pinguim já exibe **4 margens líquidas
e 3 resultados** em superfícies diferentes. Esta issue mostra que, mesmo depois de unificadas, o
número **certo** ainda é três — e que a unificação tem de decidir **qual dos três** cada superfície
mostra.

## Como implementar
1. `frontend/proforma-avancado.ts:75-126` passa a devolver os três fechos, nomeados, em vez de um
   `resultado` único. O campo `resultado` de hoje **continua existindo** e continua sendo o mesmo
   número — quem o lê hoje não pode mudar de valor sem aviso (`frontend/tela-fluxo-ver.ts:232`,
   `frontend/tela-dashboard.ts:273`).
2. As três definições — grandeza **e** denominador, como na tabela acima — entram escritas em
   `docs/viabilidade/formulas.md`, no bloco da proforma do Avançado. Não há mais o que confirmar: a
   base de cada linha está decidida.
3. A tela exibe as três, com o rótulo da EVI, e o painel de estudos declara **qual** delas alimenta a
   coluna "Margem".
4. Coluna `json` nenhuma é tocada; **sem migração, sem bump da `versao`**.

## Critério de aceite
1. A proforma do Avançado exibe as três linhas, cada uma com o seu percentual e o seu denominador
   declarado.
2. Um teste com os números do print reproduz os três valores e os três percentuais — e **falha** se
   alguém unificar os denominadores.
3. O campo `resultado` lido por `tela-fluxo-ver.ts:232` e `tela-dashboard.ts:273` **não muda de
   valor** neste PR: esta issue **acrescenta** linhas, não redefine a existente.
4. O PR declara, em uma tabela, qual das três linhas cada superfície do app passa a exibir.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Alavancar a proforma. Ela é **desalavancada** por decisão registrada — issue própria, e é
  pré-requisito desta.
- Mudar a segmentação das linhas anteriores ao fecho, que o print **confirma** estarem certas.

> **Fonte:** aba `#43` da `lista bugs 20260807.xlsx` (imagem embutida no pacote). Os PNGs extraídos
> em 2026-08-22 eram temporários e **não** são fonte durável — cite a aba.

Sem-fechamento: #350 executora original do item 43 na Rodada 7, já fechada; ela entregou a segmentação, que o print confirma. Esta issue cobre o fecho de três linhas, que só a imagem revelava

## Relacionadas
- **R8-01** (proforma: parar de contar o principal do funding) — **pré-requisito**: acrescentar linhas de resultado a uma função que soma o principal do funding ao custo multiplicaria o erro por três.
- **R8-18** (rótulos que distinguem) — o autor decidiu **não unificar** as definições, só rotulá-las (D-Q03). Esta issue **acrescenta três** ao inventário: os rótulos agora têm de dizer também **qual dos três fechos** cada superfície mostra.
- **R8-26** (benchmarks) — é contra a meta de 20% de `margem_liquida` que os 16,7 pontos percentuais cobram o preço: o mesmo projeto aprova ou reprova conforme a linha.
- **R8-40** (Receita líquida de proforma) — o **mesmo print** confirma a dedução de Marketing (−1,00%) que aquela issue nomeia.
- **R8-34** (dois flags da permuta financeira) — o **mesmo print** mostra os dois checkboxes independentes.
- **R8-23** (docs: proforma desalavancada) — as três definições novas entram no mesmo bloco de `formulas.md`.
<<<END>>>

<<<ISSUE>>>
id: R8-03
numero: 428
title: [P1] feat(fluxo-pagamento): abrir campo de juros de tabela por Grupo no modal de Pagamento
labels: P1, ui, motor
sources: R-A2-01 · R-A2-03 · R-A2-18 · E-A2-01 · E-A2-10 · decisão do autor D-Q02 · C2
---
> ✅ **Decisão do autor — D-Q02, 2026-08-22: o campo ENTRA, com uma taxa por Grupo/plano.**
> **Não** por componente. A persistência escreve **a mesma taxa em todos os componentes daquele
> plano**; o sinal continua expresso por `sinalPct`, que é campo à parte (issue própria). Onde o
> corpo abaixo dizia "por componente", vale esta decisão — os trechos afetados já foram
> corrigidos no texto.
>
> **A granularidade não é só simplificação: ela desarma um risco.** Com uma taxa por plano, o
> transplante de campos só-canônicos na regeneração deixa de depender de parear componente a
> componente para a **taxa** — o valor é o mesmo em todos. O pareamento por identidade continua
> necessário para `sinalPct` e `jurosNoMesDaContratacao`, mas o campo de maior consequência em
> R$ sai da zona de risco.

> 🔎 **Enquadramento corrigido pelo `git log` (2026-08-22): isto NÃO é feature especulativa.**
> `taxaMensal` **nunca** apareceu em `frontend/tela-fluxo-receitas.ts`, em commit nenhum da
> história — a taxa de 12,5% a.a. do estudo 5 foi escrita **pela API, direto**. A prova está nos
> rótulos: os daquele estudo são escritos à mão (`"…juros 12,5% a.a."`), contra o carimbo
> automático `"ao longo da obra (legado)"` do estudo 6. **Existe dado real, em produção,
> rodando um modelo que a tela não alcança.** Esta issue é a UI alcançando esse modelo, não
> uma aposta sobre demanda futura.

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

- A taxa é **uma por Grupo/plano** (decisão do autor **D-Q02**): um campo único, "Juros de
  tabela (% a.a.)", no cabeçalho do modal. A persistência grava **a mesma `taxaMensal` em todos os
  componentes daquele plano**. Não há taxa por componente, e não haverá sem decisão nova.
- `componentesDoLegado` propaga a taxa do formulário nos quatro caminhos, em vez de escrever `0`.
- `0%` continua válido e é o **default de todo estudo existente**: nenhum estudo muda de número
  sem alguém digitar a taxa.
- Taxonomia: **editável por estudo/linha** (`% a.a.`). **Fórmula** derivada: `taxaMensal`.
  **Fixo:** nada. Os 12,5% da EVI são exemplo, nunca hardcode.

## Como implementar
1. `frontend/tela-fluxo-receitas.ts` — **um** `viab-num` "Juros de tabela (% a.a.)" no cabeçalho
   do modal, e só ele. Nenhum campo por linha de Entrada/Parcelamento, nenhum no bloco Repasse
   (**D-Q02**).
2. `frontend/fluxo-pagamento-editor.ts` — o `FormularioPagamento` carrega a taxa em % a.a.;
   `componentesDoLegado` (`frontend/fluxo-caixa-motor.ts:580-620`) converte para mensal e a grava
   em `taxaMensal` nos quatro pontos, em vez de `0` — **o mesmo valor nos quatro**.
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

## Relacionadas
- **R8-06** (os modais param de reescrever) — **pré-requisito**: sem ele, este campo é preenchido e perdido no clique seguinte.
- **R8-11** (exibir os juros já configurados, somente-leitura) — pré-requisito barato desta, não alternativa.
- **R8-39** (inventário de `taxaMensal ≠ 0`) — dimensiona quantos estudos já rodam o modelo que esta issue traz para a tela.
- **R8-31** (KPIs de juros/carteira/exposição) — não implementar **antes** desta, ou o KPI nasce mentindo.
- **R8-38** (fixture EVI Urbitá) — o oráculo numérico desta.
- **R8-43** (baseline) — move até **5,41% do VGV**; é a última da ordem recomendada da cadeia.
<<<END>>>

<<<ISSUE>>>
id: R8-04
numero: 429
title: [P1] fix(absorcao): percentual fora da janela derivada é erro de validação, não descarte silencioso
labels: P1, motor
sources: E-A2-04 · E-A2-05 · 04 §6.3 E3 · R-A2-10 · 05-conferencia-numerica.md §D6 · §D17 · 06-auditoria-ui.md §5.3/C2 · C1 · C2
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

---

## Fusão e divisão — a medição da fatia C1, e o que saiu daqui

A fatia C1 encontrou o mesmo descarte pela instância e pela UI (`§D6`, `§D17`, `§5.3/C2`) e o
precificou nos dois estudos Avançados de Pinguim. A medição dela entra aqui.

> 🔪 **O que NÃO está nesta issue, de propósito.** A redação original da C1 juntava o descarte
> silencioso com *"a janela de vendas passa a respeitar `pos_obra.duracao_meses`"*. As duas coisas
> têm **estatutos diferentes**: o descarte é defeito puro e é esta issue; mexer na janela
> **contradiz uma decisão do autor** (`APOS_CHAVES_MESES = 12`, #226, com a EVI votando junto —
> `cfINC!J` divide por 12 literal). Essa metade virou **pergunta ao autor**, na issue de
> `question(cronograma)` listada em Relacionadas. Não a reintroduza aqui.

### Consequência
Estudo 6 de Pinguim: `absorcao.meses` tem **43 pontos, meses 11 a 53, somando 100,0000000001%**; a janela do motor é **11..52**. O ponto do mês 53 é descartado (`idx = 42 >= tamanho = 42`).

| Grandeza | Esperado (curva gravada) | Obtido (motor) | Δ |
|---|---:|---:|---:|
| Absorção efetiva, nas 3 linhas | 100,0000% | **98,5900%** | **−1,4100 pp** |
| Venda bruta contratada | R$ 142.401.199,98 | R$ 140.393.343,03 | **−R$ 2.007.856,95** |
| Resultado final | R$ 30.172.333,96 | R$ 28.358.402,21 | **−R$ 1.813.931,75** |

O estudo 5, com `pos_obra.duracao_meses = 12`, fecha 100,0000% e não perde nada. **A perda só aparece quando o usuário estica o Pós-obras — que é exatamente quando ele acha que está ganhando janela de venda.** Esticar a fase faz **vender menos**, e nenhuma tela reporta a perda; `erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:337-345`) tampouco olha para isso, porque só valida a soma dos três primeiros blocos.

### A assimetria que a C1 documentou, e que sobrevive a esta issue

| Consumidor de `pos_obra.duracao_meses` | Comportamento |
|---|---|
| **Janela de absorção** (`frontend/fluxo-shared.ts:281`) | 🔴 **descartado** — `fim = inicio_mes + APOS_CHAVES_MESES − 1` |
| **Ancoragem de custo** (linhas ancoradas em `pos_obra`) | ✅ **obedecido** — a duração real vale |

Depois desta issue o percentual deixa de sumir em silêncio — mas o campo **continua** com dois
destinos opostos sob um rótulo só. É isso que a pergunta ao autor resolve.

## Relacionadas
- **R8-05** (`question(cronograma)`) — a **metade dividida** desta redação. Ela decide se a janela passa a obedecer o campo; esta issue fecha **independente** da resposta.
- **R8-06** (modal de Absorção) — **pré-requisito prático**, e a armadilha de encerramento está na seção Critério de aceite: *"verificar que a curva voltou não fecha esta issue"*.
- **R8-32** (livro de estoque em m²/unidades) — é a **camada 2** deste mesmo invariante de conservação.
<<<END>>>

<<<ISSUE>>>
id: R8-05
numero: 430
title: [P1] fix(cronograma): separar Pós-obras (custos) de Pós-chaves (vendas e pagamento)
labels: P1, motor, ui
sources: 05-conferencia-numerica.md §D6 · §D17 · 06-auditoria-ui.md §5.3/C2 · R-A2-08 · 04 §6.1 (§8.5) · C1 (metade dividida) · C2 · resposta do autor, 2026-08-22
---
## Contexto
Esta issue é a **metade dividida** da redação original de `fix(absorcao): janela de vendas respeita a
duração do Pós-obras…` (fatia C1). A outra metade — o descarte silencioso — é defeito puro e virou
issue de conserto (**R8-04**).

A redação anterior desta issue perguntava se `pos_obra.duracao_meses` deveria passar a valer para a
janela de vendas **ou** ganhar cadeado. **O autor desfez a premissa da pergunta em 2026-08-22:** não
há um campo com dois destinos a arbitrar — há **duas variáveis diferentes que o app trata como uma**.
Palavras dele:

> *"A taxonomia deve estar igual, mas representam duas variáveis diferentes. Em Cronograma, o prazo
> de pós-obras refere-se a um período que interfere os custos escolhidos nessa seção de desembolsos
> relacionados a serviços de pós-obras ou qualquer outro custo que seja escolhido dentro desse prazo
> no cronograma. O outro que está constante em 12 meses na verdade se chama Pós-chaves e interfere a
> duração de pagamento e período de vendas assim como pré-lançamento, lançamento e durante as obras
> interferem o quanto é vendido em cada período. Ajuste essa taxonomia e a identificação de cada
> campo corretamente para separá-los e não tratar como o mesmo."*

Ou seja: o comportamento do motor **já está certo nos dois lados**. O que está errado é a
**taxonomia** — nome, campo e rótulo compartilhados por dois conceitos distintos.

> ⚠️ **Não faz parte desta issue destravar os 12 meses do Pós-chaves.** Essa duração é decisão
> explícita da #226, corroborada pela EVI Urbitá (`cfINC!J` divide por **12 literal** e ignora os
> próprios inputs de duração da planilha, `Premissas!H9` e `Etapas!E11`), e **fica**. Separar os dois
> conceitos é exatamente o que permite que ela fique sem mentir.

## Os dois conceitos, e onde cada um é lido hoje

| | **Pós-obras** | **Pós-chaves** |
|---|---|---|
| O que é | Fase de **custo** do Cronograma: janela em que caem desembolsos de serviços de pós-obras (ou qualquer custo que o usuário ancore ali) | Janela **comercial**: período em que ainda se vende e em que o cliente termina de pagar, ao lado de Pré-lançamento, Lançamento e Durante a obra |
| Quem define a duração | **O usuário**, digitando no Cronograma | **O motor**, constante de 12 meses (#226) |
| Onde vive hoje | `pos_obra.duracao_meses` do evento de Cronograma; criado em `backend/rotas/avancado.ts:42` com `duracao_meses: 12` e `travado_duracao: false`; editável em `frontend/tela-fluxo-cronograma.ts:269,276` | `APOS_CHAVES_MESES = 12` em `frontend/fluxo-shared.ts:237`, com a nota da #226 em `:229-236` |
| Quem consome | Ancoragem de custo: linhas de custo ancoradas em `pos_obra` **obedecem** a duração digitada | Derivação das janelas de absorção: `frontend/fluxo-shared.ts:281` monta a faixa como `inicio: pos.inicio_mes`, `fim: pos.inicio_mes + APOS_CHAVES_MESES - 1`; daí saem janela de vendas e duração de pagamento |
| Estado | ✅ correto | ✅ correto |

**O defeito é a costura entre as duas linhas.** Três sintomas, todos de nomenclatura:

1. **A chave da janela comercial se chama `pos_obra`** (`frontend/fluxo-shared.ts:281`) — o objeto de
   janelas de absorção usa o nome da fase de custo para nomear a fase de venda.
2. **O campo do Cronograma se chama "Pós-obras" e é o único visível** — o usuário que quer esticar a
   janela de vendas edita esse campo, porque é o único que existe, e ele não faz isso.
3. **O motor já sabe que são coisas diferentes, e só o comentário diz** — `fluxo-shared.ts:229-236`
   registra literalmente *"Não confundir com 'Pós-obras' (#328), a fase de CUSTO do Cronograma —
   nomes parecidos, conceitos diferentes"*. A distinção existe em comentário e **não existe em
   identificador, campo ou rótulo de tela**.

## O que está medido, e que é o custo da confusão
Estudo 6 de Pinguim: `pos_obra.duracao_meses = 13`, curva `personalizado` de **43 pontos, meses 11 a
53, somando 100,0000000001%**; a janela do motor é **11..52**. O ponto do mês 53 é descartado
(`idx = 42 >= tamanho = 42`).

| Grandeza | Esperado (curva gravada) | Obtido (motor) | Δ |
|---|---:|---:|---:|
| Absorção efetiva, nas 3 linhas | 100,0000% | **98,5900%** | **−1,4100 pp** |
| Venda bruta contratada | R$ 142.401.199,98 | R$ 140.393.343,03 | **−R$ 2.007.856,95** |
| Resultado final | R$ 30.172.333,96 | R$ 28.358.402,21 | **−R$ 1.813.931,75** |

O estudo 5, com `pos_obra.duracao_meses = 12`, fecha 100,0000% e não perde nada. **A perda só aparece
quando o usuário estica o Pós-obras — que é exatamente quando ele acha que está ganhando janela de
venda.** Esticar a fase de custo faz **vender menos**, porque a curva de absorção continua sendo
recortada pelos 12 meses do Pós-chaves. Com os dois conceitos separados e rotulados, o usuário para
de esticar o campo errado.

## Comportamento esperado
**Os dois conceitos deixam de compartilhar campo e rótulo.**

1. **Pós-obras continua sendo o que é:** fase de custo do Cronograma, com duração **editável**,
   consumida **só** pela ancoragem de custo. Nada muda no comportamento.
2. **Pós-chaves ganha nome e identidade próprios** na derivação comercial: a chave `pos_obra` do
   objeto de janelas de `frontend/fluxo-shared.ts:281` passa a se chamar `pos_chaves` (ou equivalente
   explícito), acompanhando `APOS_CHAVES_MESES`, que já tem o nome certo desde a #348.
3. **A tela nomeia os dois.** No Cronograma, a linha "Pós-obras" diz — no rótulo ou no `title` — que
   a duração vale para **custos**. Onde a janela comercial aparece (Absorção e plano de Pagamento),
   ela se chama **Pós-chaves** e declara a duração de **12 meses fixos**, ao lado de Pré-lançamento,
   Lançamento e Durante a obra, que já são nomeados assim.
4. **A duração do Pós-chaves não vira campo.** Ela permanece constante do motor por decisão da #226;
   esta issue só faz o app **dizer** isso em vez de esconder atrás do campo de outra fase.
5. Sem migração → **a `versao` não bumpa**. Se a separação exigir chave nova em coluna `json`
   existente, o PR precisa dizer explicitamente que não há mudança de schema.

## Critério de aceite
1. Nenhum identificador do motor usa `pos_obra` para nomear a janela comercial: `grep -rn "pos_obra"
   frontend/*.ts` só retorna ocorrências ligadas a **custo/cronograma**, e a janela comercial aparece
   sob o nome de Pós-chaves.
2. Nenhum rótulo de tela usa "Pós-obras" para a janela de vendas/pagamento, nem "Pós-chaves" para a
   fase de custo.
3. **Nenhum número muda.** Teste de regressão nos estudos 5 e 6: venda bruta, absorção efetiva e
   resultado ficam idênticos ao baseline. Esta issue é de taxonomia — se algum valor se mover, a
   mudança extrapolou o escopo.
4. Editar a duração do Pós-obras no Cronograma continua movendo **só** as âncoras de custo, e a tela
   deixa isso explícito antes de o usuário digitar.
5. O bloco §8.5 de `docs/viabilidade/padrao-incorporacao.md`, que hoje trata os dois como um só, entra
   na **mesma alteração** com a distinção escrita.
6. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- **Tornar a duração do Pós-chaves editável, ou fazê-la obedecer `pos_obra.duracao_meses`.** Está
  decidido (#226, corroborado pela EVI) e **fica em 12 meses**.
- O descarte silencioso do ponto de curva que cai fora da janela — é **R8-04**, defeito puro, e fecha
  independente desta.
- Mexer na ancoragem de custo, que hoje está **correta**.
- Renumerar ou mover as fases do Cronograma.

## Relacionadas
- **R8-04** (descarte silencioso) — a **outra metade** da redação original. É defeito puro e independente desta.
- **R8-06** (modal de Absorção) — mesma curva, outro mecanismo.
- **R8-46** (oito blocos do padrão) — o §8.5 de `padrao-incorporacao.md` descreve este campo tratando os dois conceitos como um; o texto substituto passa a carregar a separação.
<<<END>>>

<<<ISSUE>>>
id: R8-06
numero: 431
title: [P1] fix(receitas): os modais param de reescrever o que não sabem representar (Pagamento e Absorção)
labels: P1, ui, motor, funding
sources: 05-conferencia-numerica.md §D10 · §D18 · 06-auditoria-ui.md §4.1 · §5.5 · 09-consertos.md BUG 2 · 04 §6.3 E1 · E-A2-02 · E-A2-05 · E-A2-06 · R-A2-01 · R-A322 · decisão do autor D-Q05 · C1 · C2 · C3
---
## Decisão do autor — as duas viram uma
> ✅ **D-Q05, 2026-08-22.** *"Os dois modais destrutivos viram UMA issue só."* Pagamento e Absorção
> têm **o mesmo mecanismo** — o formulário regenera o JSON inteiro a partir de uma projeção mais
> pobre que o dado persistido, e apaga o que não sabe mostrar — e **o mesmo conserto**: o
> formulário só sobrescreve o que sabe representar e preserva o resto. O escopo desta issue é a
> **classe inteira**, não os dois casos.

Isso muda o critério de pronto: não basta os dois modais pararem de destruir. **O terceiro modal
que alguém escrever tem de nascer certo**, e é para isso que a regra abaixo é enunciada como
invariante do app, e não como conserto de duas telas.

## A regra que a classe tem de honrar
> **Abrir um modal e aplicar sem alterar campo nenhum é NO-OP.** O JSON persistido resultante é
> `deepEqual` ao de entrada. E aplicar de novo sobre o que foi gravado também não move nada
> (idempotência).
>
> **Corolário, que é a parte que hoje falha:** quando o usuário **edita de verdade**, o que o
> formulário não sabe representar **sobrevive** à regeneração. O formulário é uma **projeção**
> do dado, não o dado.

Quando a projeção não consegue carregar o que existe — uma curva `personalizado` que o formulário
não sabe desenhar —, o usuário é **avisado antes de aplicar** e confirma explicitamente a
substituição. Nunca em silêncio.

## O que está medido, somando os dois casos

| Modal | Estudo | O que some ao clicar "Aplicar" sem mudar nada | Efeito |
|---|---|---|---|
| **Pagamento** | 5 | `taxaMensal: 0.0098636` (12,5% a.a.) e o plano `0/30/70` | juros **−R$ 1.259.273,59** · Resultado −R$ 1.208.902,63 · VPL −R$ 959.500,19 · TIR **−1,06 pp** · plano vira `15/30/55` · retorno do investidor **≈ −R$ 50.371** |
| **Absorção** | 6 | a curva `personalizado` de **43 pontos** | **VPL −R$ 360.591,41**, com o Resultado *subindo* R$ 1.813.931,75 — a distribuição no tempo muda, e a curva **não é recriável pela interface de hoje** |

**Nos dois casos: sem aviso, sem confirmação, sem diff, sem undo — e irreversível pela UI.**

> 🔎 **Achado do `git log` (2026-08-22) que muda o enquadramento do caso da Absorção.** A curva
> personalizada **veio da tela**: o commit `2c0e793` tinha o seletor com
> `{ id: 'personalizado', titulo: 'Personalizado', desc: 'Percentual específico para cada mês.' }`
> e uma linha por mês. A UI **perdeu** o modo depois; o motor continuou lendo. **Não é caminho de
> escrita paralelo — é UI amputada.** Ou seja: a curva do estudo 6 é dado legítimo, escrito pela
> própria app, e o que a destrói hoje é uma **regressão de interface**, não uma feature que nunca
> existiu. Onde os corpos abaixo disserem "a tela não sabe gravar `personalizado`", leia
> "**deixou** de saber".

---

## Caso 1 — modal de Fluxo de Pagamento

### Contexto
Quatro lentes independentes convergiram (A2 pela planilha, A4 pelo código, A5 pela instância, A6 pela UI). O A5 mediu contra os dados reais de Pinguim: o estudo 5 tem `taxaMensal: 0.0098636` (= 12,5% a.a., a taxa exata da EVI) persistida e produzindo juros; o estudo 6 tem tudo zerado **porque passou pelo modal**. O conserto foi projetado, revisado e executado em verde, e depois **revertido por decisão do autor** (`09-consertos.md`, aviso do topo).

> ⚠️ **A afirmação antiga de que `jurosClientes` é sempre 0 está REFUTADA.** A formulação certa é: **os juros existem e viram zero no primeiro "Aplicar"**. Nenhuma issue deve dizer que juros de tabela nunca existem.

### Comportamento atual
A cadeia, toda em `main`:

1. `frontend/tela-fluxo-receitas.ts:843` — `_aplicarPagamento` chama `fluxoPagamentoParaSalvar(this.pagForm, this.crono)`.
2. `frontend/fluxo-pagamento-editor.ts:88-90` — grava `componentes: componentesDoLegado(form, cronograma)`, **regenerando** os componentes a partir do formulário legado, em **toda** escrita.
3. `frontend/fluxo-caixa-motor.ts:589,601,608,617` — `componentesDoLegado` fixa **`taxaMensal: 0`** e **`sinalPct: 0`** nos quatro ramos, e reescreve o `rotulo` para `'entrada (legado)'` / `'ao longo da obra (legado)'` / `'repasse (legado)'`.
4. `frontend/fluxo-pagamento-editor.ts:28-42` — `formularioPagamento`, que **abre** o modal, lê `comissao/ret/entrada/parcelas/repasse` e **nunca lê `fp.componentes`**.
5. `frontend/tela-fluxo-receitas.ts:741-816` — o modal **não tem campo de taxa de juros nem de sinal**.
6. `frontend/fluxo-pagamento-editor.ts:37` — `entrada: entradas.length ? entradas : [{ pct: 15, parcelas: 1, descontoPct: 0 }]` **fabrica** uma entrada de 15% quando o dado persistido tem `entrada: []`.

Dado real, `GET /estudos/5/avancado/receitas`, linha `Tabela curta (10%)`:

    "componentes": [
      { "tipo": "imediato",  "rotulo": "Sinal 15%", "participacaoPct": 15, "descontoPct": 0 },
      { "tipo": "ate_marco", "rotulo": "Tabela curta - parcelas ate a entrega, juros 12,5% a.a.",
        "marcoMes": 38, "sinalPct": 0, "taxaMensal": 0.0098636,
        "defasagemMeses": 1, "participacaoPct": 85, "jurosNoMesDaContratacao": false }
    ]

O caminho termina em `urbiVerso.notificar('Fluxo de pagamento aplicado.', 'sucesso')` (`frontend/tela-fluxo-receitas.ts:848`). **Sem aviso, sem confirmação, sem diff, sem undo** — e é **irreversível pela UI**, porque não existe superfície para redigitar a taxa.

### Consequência
Cenário medido: o usuário abre o modal do estudo 5 e clica em **Aplicar sem mudar nada**.

| Indicador | Antes | Depois | Δ |
|---|---:|---:|---:|
| Juros de clientes | R$ 1.259.273,59 | **R$ 0,00** | −R$ 1.259.273,59 |
| Receita bruta | R$ 130.269.273,58 | R$ 129.009.999,99 | −R$ 1.259.273,59 |
| Resultado | R$ 24.668.189,10 | R$ 23.459.286,47 | −R$ 1.208.902,63 |
| VPL | R$ 8.314.824,98 | R$ 7.355.324,79 | −R$ 959.500,19 |
| TIR | 18,59% a.a. | **17,53% a.a.** | −1,06 pp |

**E há um dano de funding que o catálogo original não registrou** (correção 3 do topo de `09-consertos.md`): o A3 mediu que abrir o modal **encolhe o retorno do investidor em ≈ R$ 50.371** no estudo 5. É consequência **de funding** de um bug catalogado como **de receitas**.

Pior ainda na linha `Tabela longa (80%)` do mesmo estudo: o persistido é `entrada: []` + `componentes: [ate_marco 30%, concentrado 70% no mês 39]`. O modal **exibe** uma entrada de 15% que não existe no dado; a validação fecha em 100% porque `pctRepasseDerivado` (`frontend/fluxo-caixa-motor.ts:487-491`) vira 55%; e "Aplicar" grava **15/30/55** no lugar de **0/30/70**. **15 pontos percentuais de plano de pagamento trocados de bolso, em silêncio, antes de o usuário tocar em nada.**

### Comportamento esperado
> **Abrir o modal e aplicar sem alterar nada é NO-OP.** O `fluxo_pagamento` resultante é igual ao de entrada, `taxaMensal`, `sinalPct` e `rotulo` inclusive. E aplicar de novo sobre o que foi gravado também não move nada (idempotência).

Quando o usuário **edita de verdade** o espelho legado, a estrutura acompanha a edição e **o que o espelho legado não sabe representar sobrevive** à regeneração.

Atendível **sem campo novo na UI** — nenhum controle de taxa é adicionado por esta issue.

### Como corrigir
Duas metades, ambas em `frontend/fluxo-pagamento-editor.ts`:

**Metade 1 — parar de fabricar dado que não existe.** Os placeholders de 15% (`entrada` e `parcelas`, hoje em `:37` e vizinhança) só nascem quando a linha **não tem `componentes` canônicos**. O espelho legado de uma Entrada de 0% **é vazio**. O default continua valendo para linha nova; para linha existente, **o dado manda**. O form ganha o campo `componentes: ComponentePagamento[] | null`, declarado **não editável** — é a memória do que o modal não sabe editar.

**Metade 2 — `fluxoPagamentoParaSalvar` deixa de regenerar tudo pelo legado.** Nova função `componentesParaSalvar`, com três casos em ordem:

| Caso | Condição | O que faz |
|---|---|---|
| 1 | linha **sem** `componentes` persistidos | regenera pelo legado — comportamento de sempre |
| 2 | o regenerado tem a **mesma estrutura** do persistido | devolve o persistido **verbatim** ← é o no-op |
| 3 | o usuário mexeu de verdade no espelho legado | regenera e **transplanta** `taxaMensal`, `sinalPct`, `jurosNoMesDaContratacao` e `rotulo` |

"Mesma estrutura" compara **só o que o espelho legado sabe dizer**: `participacaoPct`, `descontoPct`, `prazoMeses`, `defasagemMeses`, `marcoMes`, `mesPagamento`. Diferença em `taxaMensal`/`sinalPct` **não pode** contar como "o usuário mudou algo", já que a UI não tem como mudá-los. Guarda extra: espelho legado inteiramente vazio (sem `entrada` e sem `parcelas`) não tem de onde regenerar — `componentesDoLegado` devolveria um repasse de 100% que ninguém pediu; **o persistido fica de pé**.

🔴 **O transplante do caso 3 tem de ser por IDENTIDADE, não por índice.** A primeira versão do conserto casava por índice, e o agente A2 achou o buraco: **adicionar ou remover uma linha desloca os índices e a taxa morre nos dois componentes preexistentes** — o mesmo dano que o conserto existe para impedir, a um clique de distância. A versão final parea em **dois passes**: casamento exato de estrutura primeiro, depois mesmo `tipo` na ordem de aparição.

**Terceira mudança, pequena e necessária:** `erroFormularioPagamento` passa a validar **o array que `fluxoPagamentoParaSalvar` vai gravar**, não uma projeção parecida. Com dois caminhos diferentes, o modal pode aprovar uma coisa e persistir outra.

### Critério de aceite
Testes em `frontend/fluxo-pagamento-editor.test.ts`, sobre a fixture `FP_TABELA_LONGA` que reproduz o shape real da linha "Tabela longa" do estudo 5 (`entrada: []`, parcelamento de 30%, repasse derivado de 70%, `taxaMensal = 0.0098636` no componente `ate_marco`):

1. **`abrir o modal e aplicar SEM MUDAR NADA é no-op — inclusive taxaMensal e sinalPct`**: `form.entrada` continua `[]`; `salvo.componentes` é `deepEqual` ao original; `taxaMensal` intacta; `0/30/70` continua `0/30/70`; aplicar de novo sobre o gravado também não move nada.
2. **`editar de verdade o espelho legado regenera — e preserva o que o legado não sabe dizer`**: mudar o parcelamento de 30% para 40% produz `ate_marco 40` + `concentrado 60`, e a taxa **sobrevive**.
3. **`linha sem componentes canônicos segue no comportamento de sempre`**: sem `componentes` persistidos os placeholders continuam nascendo (`15/15/70`) e a regeneração é integral.
4. **Os três testes de identidade, que a versão por índice reprovaria**: **adicionar** linha, **remover** linha e **reordenar** linha no espelho legado — em nenhum dos três a `taxaMensal` de um componente preexistente vai a zero.
5. **Teste de regressão que assere o funding, não só a receita** — o retorno do investidor do estudo 5 não muda ao aplicar sem alterar nada (o dano de ≈ R$ 50.371 medido pelo A3).
6. `bash scripts/validar-frontend.sh` verde.

### Fora de escopo
- **Campo de taxa de juros e de sinal no modal.** É *feature*, não conserto: esta issue faz o modal parar de **destruir** o dado, mas ele continua **sem superfície para digitá-lo**. Issue própria do bloco 8-B.
- ~~O modal de **Absorção**, que sofre do mesmo mecanismo por outro caminho~~ — **está DENTRO
  desta issue** (decisão D-Q05: os dois modais viram uma issue só, porque o mecanismo é o mesmo e
  separar garantiria que o segundo ficasse para trás — já ficou uma vez).
- `fluxo_pagamento.ret` por linha, morto desde a #346.
- `manifesto.json`: `fluxo_pagamento` é coluna `json` — **sem migração, sem bump de `versao`**.

---

### Fusão de três redações independentes

Esta issue funde três blocos escritos **sem que os autores se enxergassem** — a fatia **C1** (pela
instância e pela UI), a **C2** (pela planilha EVI) e a **C3** (pelo funding). As três descrevem o
mesmo conserto, na mesma função, e **cada uma trouxe uma metade que as outras não tinham**:

| Fatia | O que só ela viu |
|---|---|
| **C1** | a medição na instância (R$ 1.259.273,59), a reescrita `0/30/70 → 15/30/55` e o desenho dos três casos de `componentesParaSalvar` |
| **C2** | que o transplante **por índice** falha ao adicionar, remover ou reordenar linha — o mesmo dano que o conserto existe para impedir, a um clique de distância |
| **C3** | que a base do equity encolhe junto, e que o conserto pode ser declarado bom **preservando a receita** e ainda assim mover o retorno do investidor |

Convergência de três lentes independentes sobre a mesma função é a evidência mais forte desta
rodada. As duas seções abaixo preservam, verbatim, o que C2 e C3 acrescentam — e as duas entram no
**mesmo** conserto: sem a matriz de C2 o transplante nasce quebrado, sem a asserção de C3 ele passa
verde movendo o contrato do investidor.

#### C2 — a matriz de edições que o pareamento posicional perde

##### Comportamento atual
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

##### Consequência
O dano é **idêntico ao que o conserto existe para impedir**: silencioso, sem undo, sem campo onde
redigitar. No estudo 5 são os mesmos **R$ 1.259.273,59**, a um clique de distância. E a suíte
nova não cobre nenhum dos dois casos — nenhum teste de `frontend/fluxo-pagamento-editor.test.ts`
adiciona ou remove linha. É o padrão que o `CLAUDE.md` chama de *"a issue fechou não é evidência
de entrega"*: verde, fechada, defeito vivo.

##### Comportamento esperado
O pareamento entre componentes persistidos e regenerados **não pode ser posicional**.

1. Parear por **`tipo` + ordem de ocorrência daquele tipo** (o 1º `ate_marco` regenerado herda do
   1º `ate_marco` persistido), ou por identidade estável (`id` gravado no componente).
2. Quando não houver par, **herdar do plano** (a taxa default da linha) em vez de cair em `0`.
3. Se o pareamento robusto não couber no escopo: **bloquear** a edição que perderia dado, com
   banner explícito — *"este plano tem juros de tabela configurados; adicionar linha os
   removerá"*. Um aviso é infinitamente melhor que uma perda calada.

##### Como implementar
Mesmo arquivo do conserto (`frontend/fluxo-pagamento-editor.ts`), na função que transplanta os
campos só-canônicos. Trocar o `map((r, i) => originais[i])` por um consumo de fila por tipo:
um índice de ocorrência por `tipo`, com fallback na taxa do plano. Sem migração, sem schema, sem
bump da `versao`.

##### Critério de aceite
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

#### C3 — a asserção de funding, que o conserto tem de carregar

##### Contexto
Esta é uma issue de **funding** que nasce de um defeito catalogado como sendo **de receitas**. Ela
não duplica a issue do modal de pagamento — ela adiciona **uma asserção** ao conserto que aquela
issue já vai fazer. Se a issue do modal ainda estiver aberta quando esta for triada, o caminho
barato é **absorvê-la lá**; se o conserto já tiver mergeado, esta vira trabalho novo.

##### Comportamento atual
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

##### Consequência
A base do equity encolhe junto. Com os números medidos no estudo 5 e um investidor a 4%, abrir o
modal evapora **≈ R$ 50.371** de retorno do investidor. E a reescrita `0/30/70 → 15/30/55` muda
também **o mês** em que o retorno é pago, porque antecipa receita para o lançamento.

**O contrato do investidor muda porque alguém abriu uma tela** — sem aviso e sem undo.

O risco específico desta issue: o conserto do modal pode ser declarado bom **preservando a receita**
e ainda assim mover o retorno do investidor por outro caminho, porque ninguém olhou o funding.

##### Comportamento esperado
O teste de regressão do conserto do modal afirma, além da receita: abrir e aplicar o modal **sem
alterar campo nenhum** mantém `Σ saidas` de **toda** operação de equity inalterada, ao centavo.

##### Como corrigir
1. No teste de ida e volta do conserto — `fluxoPagamentoParaSalvar(formularioPagamento(fp))`
   idempotente —, acrescentar: rodar `simularEquity` sobre a base **antes** e **depois** e exigir
   igualdade ao centavo em `saidas` e em `entradas`.
2. Cobrir os dois modos de retorno: `permuta_financeira` (sensível à curva mês a mês) e
   `resultado_final` (sensível ao acumulado e ao `mesRepasse`).

##### Critério de aceite
- [ ] O teste falha na `main` de hoje (com o modal ainda reescrevendo o plano) e passa depois do
      conserto — se passar nos dois, ele não está exercendo o caminho certo.
- [ ] A asserção cobre os dois modos de `modo_retorno`.

---

## Caso 2 — modal de Absorção

### Contexto
O A5 encontrou na instância Pinguim uma curva de absorção **personalizada de 43 pontos mensais**, gravada e ativa no estudo 6 — e o A6 confirmou no código que a UI de hoje não sabe nem exibir nem recriar essa curva, mas sabe destruí-la. Mesmo mecanismo do modal de Fluxo de Pagamento, por outro caminho.

> ✅ **Correção a documentação anterior, que esta issue precisa carregar:** o dossiê afirmava que `modo: 'personalizado'` *"existe no motor mas a UI nunca o grava"*. A primeira metade é exata; a segunda esconde o que importa — **o modo existe na instância, com `aplicado: true`**. Não é lacuna de funcionalidade: é **dado vivo em rota de colisão**. Nenhuma issue deve dizer "modo personalizado nunca é usado".

### Comportamento atual
- `frontend/tela-fluxo-receitas.ts:516-527` — `_abrirAbsorcao` lê **só `correcao_estoque` + os 3 percentuais de bloco**. Nunca lê `absorcao.modo` nem `absorcao.meses`.
- `frontend/tela-fluxo-receitas.ts:527-542` — `_absorcaoJson` grava **`modo: 'distribuido'` hard-coded** (`:533`) e reconstrói `blocos` do zero, com 4 eventos fixos.
- `frontend/fluxo-shared.ts:337-345` — `erroFormularioAbsorcao` só barra soma **acima** de 100%; nada olha para o que está sendo sobrescrito.
- `frontend/tela-fluxo-receitas.ts:661` — o caminho termina em `urbiVerso.notificar('Absorção de vendas aplicada.', 'sucesso')`.

Nenhuma `urbi-banner variante="alerta"` no corpo do modal avisa que aplicar reescreve o registro inteiro; a única `urbi-banner` ali é `variante="erro"`, e só quando a validação falha (`:817-818`). **Sem aviso, sem confirmação, sem undo.** O backend aceita o blob sem validar `modo`.

### Consequência
Cenário medido: o usuário abre o modal de Absorção do estudo 6 e clica em **Aplicar sem mudar nada**.

| Indicador | Antes (curva de 43 meses) | Depois (`distribuido`) | Δ |
|---|---:|---:|---:|
| Venda bruta contratada | R$ 140.393.343,03 | R$ 142.401.199,98 | +R$ 2.007.856,95 |
| Resultado | R$ 28.358.402,21 | R$ 30.172.333,96 | +R$ 1.813.931,75 |
| VPL | R$ 10.416.945,03 | R$ 10.056.353,62 | **−R$ 360.591,41** |

A curva é apagada e substituída pelos 3 blocos. O **VPL cai R$ 360.591,41 mesmo com o resultado subindo**, porque a distribuição no tempo muda — e a curva de 43 meses **não é recriável pela UI**, então a perda é irreversível pela interface.

Note o par com o defeito da janela de absorção: os "+R$ 2.007.856,95" que aparecem aqui são exatamente as vendas que o motor **descartava** da curva personalizada (issue `fix(absorcao): janela de vendas…`). Consertar uma sem a outra troca um dano por outro.

### Comportamento esperado
Abrir o modal de Absorção e aplicar sem alterar nada é **NO-OP**: `absorcao.modo`, `absorcao.meses` e `aplicado` chegam do jeito que estavam.

Quando o dado persistido tem algo que o formulário **não sabe representar** (`absorcao.modo !== 'distribuido'`, ou `meses` com pontos próprios), o usuário é avisado **antes** de aplicar e confirma explicitamente a substituição.

### Como corrigir
O conserto de fundo é o mesmo do modal de Pagamento e tem nome: **o modal reconstrói o JSON persistido a partir de um formulário mais pobre que o dado, em vez de fazer merge.** O que o formulário não sabe representar, ele apaga.

1. **Merge, não reconstrução** — `_absorcaoJson` (`frontend/tela-fluxo-receitas.ts:527-542`) só sobrescreve `modo`/`meses` quando o usuário **editou** os blocos; caso contrário devolve o persistido verbatim, no mesmo desenho de três casos usado no editor de pagamento.
2. **Aviso** — `urbi-banner variante="alerta"` no corpo do modal quando `absorcao.modo !== 'distribuido'`, dizendo que aplicar converte a curva própria em blocos distribuídos, com o número de pontos que serão descartados.
3. **Confirmação** — o app já tem o padrão em casa (`confirmRemoverProduto` em `frontend/tela-premissas.ts`). Reabrir um modal e clicar em "Aplicar" destrói mais dado que aquela exclusão e não confirma nada.

**Os três entram.** (2)+(3) sozinhos apenas pedem licença para destruir; é (1) que fecha o defeito, e é (1) que a regra da classe, enunciada no topo desta issue, exige.

### Critério de aceite
1. Teste: fixture com `modo: 'personalizado'` e curva de 43 pontos → `_absorcaoJson` sem edição do usuário devolve `deepEqual` ao persistido, `modo` e `meses` inclusive.
2. Teste: com edição real de um bloco, o resultado é `distribuido` com os blocos novos — o caminho de sempre continua funcionando.
3. `grep -n "modo: 'distribuido'" frontend/tela-fluxo-receitas.ts` — nenhuma ocorrência que grave incondicionalmente.
4. Reexecutar `scripts/conferir-estudo.ts 6`: `absorcao.modo` continua `personalizado` depois de um ciclo abrir/aplicar simulado.
5. `bash scripts/validar-frontend.sh` verde.

### Fora de escopo
- **Editar** a curva personalizada pela UI (criar/mover pontos). É *feature*; esta issue só impede a destruição.
- A janela fixa de 12 meses que trunca a curva — issue própria.
- ~~O modal de Fluxo de Pagamento — mesmo mecanismo, issue própria.~~ — **está DENTRO desta
  issue** (decisão D-Q05). Os dois modais são o mesmo defeito visto de dois lados.
- `manifesto.json`: `absorcao` é coluna `json` — **sem migração, sem bump de `versao`**.

---

### Fusão — o que a fatia C2 acrescenta

A fatia C2 chegou ao mesmo defeito pela planilha EVI e pela auditoria documental (`04 §6.3 E1`),
sem enxergar a redação da C1. Duas coisas dela não estavam na primeira e ficam aqui verbatim: que o
modal **abre zerado** numa linha `personalizado` (porque `blocos` não existe nela), e um critério de
aceite verificável contra a instância — o `GET` byte-idêntico. E a advertência de encerramento, que
é a mais importante das duas issues de absorção.

#### Comportamento atual
- `_abrirAbsorcao` (`frontend/tela-fluxo-receitas.ts:516-528`) lê **só** `correcao_estoque` e os
  três `pct` por evento, de `absorcao.blocos`. Numa linha `modo: 'personalizado'` **não há
  `blocos`** — `pct(...)` devolve `0` nos três e o modal **abre zerado**.
- `_absorcaoJson` (`:530-542`) devolve **sempre** `modo: 'distribuido'`, com os quatro blocos
  reconstruídos do formulário. Aplicar converte a linha e **descarta `absorcao.meses[]`
  inteiro**.
- Resultado: uma curva de 43 meses vira `0/0/0` com Pós-chaves derivado em 100%.

#### Comportamento esperado
`_absorcaoJson` **nunca** converte modo em silêncio. Duas saídas aceitáveis:

1. Linha `personalizado` abre em **modo somente-leitura**, com aviso explícito de que a curva foi
   definida fora do formulário e que aplicar a substituiria; ou
2. o formulário ganha o modo `personalizado` (edição da série mês a mês).

Para linha `distribuido` — a esmagadora maioria — nada muda.

#### Como implementar
`frontend/tela-fluxo-receitas.ts`: `_abrirAbsorcao` passa a detectar `a.modo === 'personalizado'`
e a marcar o formulário como não editável; `_absorcaoJson` preserva `modo` e `meses` quando a
linha for personalizada e o usuário não tiver editado nada. `absorcao` é coluna `json`
(`schema.json:304,319`) — **sem migração, sem bump da `versao`.**

#### Critério de aceite
`GET /estudos/6/avancado/receitas`; abrir o modal de Absorção da linha com 43 meses; Aplicar sem
tocar em nada; `GET` de novo → o `absorcao` devolvido é **byte-idêntico** ao anterior. Teste de
unidade equivalente sobre `_absorcaoJson`, com um `absorcao` personalizado de entrada.

#### Fora de escopo
- **Não resolve o descarte de R$ 2.007.856,95** — depois deste conserto a curva sobrevive e
  continua truncada em 12 meses de pós-chaves. Isso é a issue do descarte silencioso, com
  critério numérico próprio (`E-A2-05`). Fechar uma por tabela da outra é o erro a evitar aqui.
- Não altera `APOS_CHAVES_MESES = 12` nem a distribuição uniforme por janela (**R-A2-08** e
  **R-A2-09**, ambas conferidas contra `cfINC!J`).
- Não decide o destino do controle "Correção de estoque" no rodapé do mesmo modal — issue própria.

---

## Critério de aceite da issue inteira
1. Os critérios dos dois casos acima, na íntegra — inclusive os **três testes de identidade** do
   Caso 1 (adicionar · remover · reordenar linha) e o `GET` byte-idêntico do Caso 2.
2. **Um teste que enuncia a regra da classe**, não os dois casos: para cada modal que edita coluna
   `json`, `parse → serializa` sem edição é `deepEqual`. É este que faz o terceiro modal nascer
   certo, e é o que justifica a fusão.
3. A asserção de **funding** do Caso 1 (o retorno do investidor não muda), nos **dois** modos de
   `modo_retorno`.
4. `bash scripts/validar-frontend.sh` verde. As duas colunas são `json` — **sem migração, sem bump
   da `versao`**.

## Fora de escopo (da issue inteira)
- **Os campos que faltam** — taxa e sinal no modal de Pagamento, edição da curva no de Absorção.
  São issues próprias. Esta faz os modais pararem de **destruir**; não dá superfície nova.
- `fluxo_pagamento.ret` por linha, morto desde a #346 — issue própria, e **mexe no mesmo arquivo**.
- O descarte silencioso do percentual fora da janela — issue própria, com critério numérico
  próprio. ⚠️ **Depois deste conserto a curva do estudo 6 sobrevive e continua truncada em 12 meses
  de pós-chaves.** "A curva voltou" **não** fecha aquela issue.

## Relacionadas
- **R8-03** (campo de taxa por Grupo) — esta issue faz o modal parar de **destruir** o dado; aquela dá **onde digitá-lo**. Esta vem primeiro.
- **R8-11** (exibir os juros em tela) — enquanto não houver campo, é o que torna a destruição **detectável** pelo usuário.
- **R8-04** (descarte silencioso) — ⚠️ **consertar uma sem a outra troca um dano por outro**, e fechar esta **não** fecha aquela.
- **R8-05** (`question(cronograma)`) — a curva de 43 pontos que esta issue preserva é justamente a que não cabe na janela.
- **R8-27** (campos derivados persistidos) — mexe no **mesmo arquivo** (`fluxo-pagamento-editor.ts`, o leitor de `fluxo_pagamento.ret`); mergear fora de ordem quebra o `deepEqual` do no-op desta.
- **R8-39** (inventário de `taxaMensal`) — mede quantos planos estão a um clique da perda.
- **R8-43** (baseline) — move Resultado, VPL e TIR; declare o antes/depois.
<<<END>>>

<<<ISSUE>>>
id: R8-07
numero: 432
title: [P1] fix(funding): definir o retorno de equity quando a receita líquida do mês é negativa
labels: P1, funding, motor
sources: R-A314 · R-A32 · divergência A3 × B1 · A2 (duas noções de "líquida") · A5 (sem equity em Pinguim) · C3 · decisão do autor, 2026-08-22
---
## A decisão, já tomada
✅ **O autor decidiu em 2026-08-22: clampar em 0 com carry-forward.** O mês cuja receita líquida é
negativa **paga zero** ao investidor, e o déficit **fica registrado**, abatendo os pagamentos dos
meses seguintes até se extinguir. Preserva o retorno total e muda só o *timing*.

Duas coisas que precisam estar escritas para a próxima auditoria não reabrir isto:

- **A spec vigente era silenciosa**, não contrária. `docs/viabilidade/fluxo-investidor-formulas.md:135`
  transcreve a célula da planilha **sem `MAX`** porque o estado negativo é **estruturalmente
  impossível** na planilha (ver abaixo) — não porque alguém tenha decidido permitir retorno negativo.
- **O carry-forward é decisão nova do autor, não restauração.** Ele **não** é o clamp que existia em
  `capital-stack-motor.ts` antes da #355: aquele era um `Math.max(0, …)` seco, sem memória de
  déficit. Quem ler o histórico não deve confundir os dois.

O registro do conflito que produziu a pergunta fica abaixo, porque é o que justifica a forma do
conserto — em duas etapas, spec antes do motor.

## Contexto — a divergência que levou à pergunta
O que as duas lentes convergiram é que a issue **não** era *"adicionar `max(0,…)`"* — era *"definir o
que é retorno de equity quando a receita líquida do mês é negativa"*.

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
**Clamp em 0 com carry-forward do déficit.** Para cada mês `t`, com `base = receitaLiquidaMensal[t]`
e `pct` o percentual de retorno da operação:

1. O mês **nunca paga negativo**: se `base < 0`, `saidas[t] = 0`.
2. O que deixou de ser pago **não some**: o déficit acumulado (o `base` negativo × `pct`, ou o resto
   dele) é guardado e **abatido dos meses seguintes**, reduzindo o retorno até se extinguir.
3. Um mês que não zera o déficit inteiro paga zero e **carrega o resto** para o mês seguinte.
4. O **total** pago ao investidor ao longo do horizonte é o mesmo que a fórmula sem clamp produziria
   quando o acumulado é não negativo — o carry-forward preserva o total e muda o calendário. Se o
   déficit sobrar ao fim do horizonte, ele **não** vira pagamento negativo: fica extinto e o total
   pago é menor, o que precisa aparecer em teste.

O precedente interno mais próximo é `frontend/fluxo-caixa-motor.ts:1554-1555,1570` — *"A base líquida
nunca fica negativa (clamp em 0): imposto e corretagem que excedam a receita do mês não geram permuta
negativa"* —, mesma base, mesmo par de deduções, mesmo descasamento de calendário. O que o autor
acrescentou àquele precedente é a **memória do déficit**, que lá não existe.

## Como corrigir
⚠️ **A ordem é vinculante e faz parte do critério de aceite: o diff sai em duas etapas, nesta
ordem.** Não é preferência de estilo — é o que impede a próxima auditoria de reabrir isto como
divergência código × spec, com razão.

**Etapa 1 — a spec, primeiro.** `docs/viabilidade/fluxo-investidor-formulas.md:135` hoje transcreve a
célula da planilha sem `MAX`
(`D — Retorno equity | SE(C24; C * C25; SE(t = C8; C19 * C25; 0))`). Ela passa a **descrever o
carry-forward**: clamp em 0, acúmulo do déficit, abatimento nos meses seguintes, e uma nota dizendo
**por que** o app diverge da letra da planilha — na planilha,
`!equity!C28 = B28*(1 − C15 − C16 − C17)` é uma **dedução multiplicativa** sobre uma decomposição do
VGV em frações não negativas (`não-negativo × 0,86`), e o estado negativo não é representável; no app
a dedução é uma **série subtraída com cronograma próprio** (corretagem integral no mês da venda,
`frontend/fluxo-shared.ts:491-497`, #121), e o estado existe. A nota deve dizer, com a data, que o
carry-forward é **decisão do autor de 2026-08-22**, não restauração do clamp que existia em
`capital-stack-motor.ts` antes da #355.

**Etapa 2 — o motor, depois.** `frontend/funding-motor.ts:441` deixa de ser
`saidas[t] = round2(n(receitaLiquidaMensal[t]) * pct)` e passa a aplicar o clamp com o déficit
acumulado, mantendo `round2` na saída.

**Independente disso**, o diagnóstico `RETORNO_EQUITY_NEGATIVO` da issue `R-A315` entra — agora
significando "houve mês com base negativa e déficit carregado", que é informação que o usuário
precisa ver em tela mesmo com o clamp no lugar.

## Critério de aceite
- [ ] **A spec é corrigida antes do motor**, e o PR deixa a ordem visível (dois commits, ou a ordem
      declarada no corpo). Um diff que toque só `funding-motor.ts` **não fecha esta issue**.
- [ ] `fluxo-investidor-formulas.md:135` descreve o carry-forward, com a nota do *porquê* da
      divergência com a planilha e a data da decisão.
- [ ] Teste: `simularEquity(op, [−200000, 2000000, 2000000], …).saidas` com `pct = 10%` → o mês 0 paga
      **0**, e o mês 1 paga o valor cheio **menos** os R$ 20.000 do déficit.
- [ ] Teste: déficit maior que o retorno do mês seguinte → esse mês também paga 0 e o resto continua
      carregado.
- [ ] Teste: déficit que sobra ao fim do horizonte não vira pagamento negativo, e o total pago é
      menor — comportamento fixado, não acidental.
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

## Relacionadas
- **R8-20** (invariantes de equity) — o diagnóstico `RETORNO_EQUITY_NEGATIVO` entra **independente** desta issue; com o clamp no lugar ele passa a sinalizar "mês com base negativa, déficit carregado", que o usuário precisa ver em tela.
- **R8-10** (teto de `Σ pct_retorno`) — a outra metade da rota de validação de equity.
- **R8-44** (cadastrar as três operações em Pinguim) — a **E1** de lá é a evidência viva desta issue.
<<<END>>>

<<<ISSUE>>>
id: R8-08
numero: 433
title: [P1] fix(avancado): PATCH de tipologias valida saldo antes de gravar quantidade
labels: P1, backend
sources: 05-conferencia-numerica.md §D3 · 09-consertos.md BUG 3 · C1
---
## Contexto
O A5 encontrou, nos dois estudos Avançados de Pinguim, um estado que as rotas de escrita **deveriam** tornar impossível — e localizou a porta que não valida nada. O conserto foi projetado e executado em verde (74 testes de backend passando à mão) antes de ser **revertido por decisão do autor** (`09-consertos.md`).

## Comportamento atual
Três das quatro portas validam saldo; a quarta não valida nada:

| Rota | Guarda | Onde |
|---|---|---|
| `POST/PATCH .../alocacoes` | ✅ `SALDO_EXCEDIDO` = `quantidade − vendido − permutadas` | `backend/rotas/avancado.ts:1051,1082,1085,1128` |
| `POST/PATCH .../custos` (permuta física) | ✅ `PERMUTA_SALDO_EXCEDIDO` | `backend/rotas/avancado.ts:1325-1358` |
| `DELETE .../tipologias/:tid` | ✅ `TIPOLOGIA_EM_USO` | `backend/rotas/avancado.ts:842-846` |
| **`PATCH .../tipologias/:tid`** | ❌ **nenhuma** — grava `quantidade` direto | **`backend/rotas/avancado.ts:809-832`** |

Os carimbos de tempo da instância mostram exatamente a sequência que explora o buraco, **duas vezes**:

| Estudo | Linha de permuta criada | Tipologia Residencial atualizada | Tipologia NR (sem permuta) |
|---|---|---|---|
| 5 | `19:41:14.510Z` | `19:41:24.917Z` (**+10 s**) | nunca tocada |
| 6 | `19:21:14.730Z` | `19:21:25.971Z` (**+11 s**) | nunca tocada |

A permuta de 42 unidades foi aceita quando havia saldo; segundos depois a `quantidade` da tipologia foi reduzida pelo `PATCH` sem guarda, e o estoque virou negativo **sem 422 nenhum**. É o único caminho que chega a este estado sem ser barrado.

## Consequência
Estado gravado hoje na instância, nos **dois** estudos Avançados:

| Estudo | Alocado | Permutado | Estoque | Comprometido | Estoque mensal negativo |
|---|---:|---:|---:|---:|---|
| 5 | 234 | 42 | 234 | **276** (Δ +42) | mês 48: **−3,975 un.** |
| 6 | 234 | 42 | 234 | **276** (Δ +42) | mês 44: **−9,006 un.** |

O painel de Reconciliação dispara `PRODUTO_EXCEDE_ESTOQUE` + `ESTOQUE_MENSAL_NEGATIVO`, e o motor calcula VGV sobre unidades que não existem. Não é dado de teste ruim: é dado que o backend **não deveria ter aceitado**.

## Comportamento esperado
`PATCH /estudos/:id/avancado/tipologias/:tid` recusa com **422 `SALDO_EXCEDIDO`** quando a `quantidade` nova é menor que o total já comprometido (alocações **+** permutas) daquela tipologia no estudo. Igual ou acima do comprometido passa. `PATCH` parcial **sem** o campo `quantidade` não é assunto desta regra e não pode ser barrado.

## Como corrigir
Nova função pura exportada `erroQuantidadeTipologia` em `backend/rotas/avancado.ts`, e o portão na rota (`backend/rotas/avancado.ts:809-832`, hoje sem guarda):

    if (dados.quantidade !== undefined) {
      const saldo = await saldoTipologiaNoEstudo(req, tip);
      const comprometidas = (Number(tip.quantidade) || 0) - saldo;
      const msg = erroQuantidadeTipologia(dados.quantidade, comprometidas);
      if (msg) { erro(res, 422, 'SALDO_EXCEDIDO', msg); return; }
    }

**Não reescrever a contagem do comprometido.** Ela sai de `saldoTipologiaNoEstudo` (`backend/rotas/avancado.ts:1079-1091`) — a **mesma** função que a porta das alocações usa, e que já desconta alocações **e** permutas via `unidadesPermutadasNoEstudo` (`:1066-1077`). O comprometido é o complemento aritmético do saldo: `quantidade − saldo`.

Código de erro **`SALDO_EXCEDIDO`, 422** — o mesmo que POST e PATCH de alocações já emitem, mesma família semântica; nenhuma tela mapeia códigos, então não há regressão de mensagem.

A regra é função **pura** separada porque a contagem é assíncrona e depende de `req.dados`, mas a **decisão** não — assim ela é testável sem servidor nem banco, o mesmo desenho de `validarCamposOperacao` em `backend/rotas/funding.ts`.

`POST` de tipologia **não** precisa do portão: tipologia recém-criada tem zero comprometido.

## Critério de aceite
Testes em `backend/rotas/avancado.test.ts`:
1. **`reduzir a quantidade abaixo do comprometido é barrado`** — reproduz o estado real da instância: 234 alocadas + 42 permutadas = 276 comprometidas; estoque não pode voltar para 234.
2. **`quantidade igual ou acima do comprometido passa`** — 276 e 300 passam; tipologia sem nada comprometido aceita 0.
3. **`campo ausente ou não numérico não é assunto desta regra`** — PATCH parcial sem `quantidade` não é barrado; comprometido inválido degrada para 0 em vez de barrar tudo com `NaN`.
4. `node --import tsx/esm --test --test-timeout=60000 backend/rotas/*.test.ts backend/*.test.ts` verde (baseline na `main`: 104 testes).
5. ⚠️ **`bash scripts/validar-backend.sh` aborta na etapa 1/5 neste ambiente** (o `@urbiverso/sdk` é stub). O typecheck de backend com o SDK real e a execução das migrações **continuam sendo do autor**, no ambiente autenticado — o PR precisa **declarar isso**. *"Não deu para rodar" nunca é "passou".*

## Fora de escopo
- **Corrigir o dado já gravado** nos estudos 5 e 6 de Pinguim. Esta issue fecha a porta; a limpeza do estado inconsistente é decisão do autor.
- Os falsos positivos das invariantes `VENDA_BRUTA_NAO_RECONCILIA` e `COMPONENTE_INVALIDO`, que aparecem no mesmo painel — issues próprias, causas diferentes.
- `manifesto.json` — sem migração, **a `versao` não bumpa**.

## Relacionadas
- **R8-32** (livro de estoque) — esta é **pré-requisito** declarado: ligar a asserção hoje faria ela acusar `−42` em 100% dos estudos conferíveis.
- **R8-19** (falsos positivos das invariantes) — os alarmes do mesmo painel; a diferença é que **este** é verdadeiro.
- **R8-38** (fixture EVI) — o estado `234 + 42 > 234` é uma das quatro coisas que faltam para a §3 ser verificável em instância.
<<<END>>>

<<<ISSUE>>>
id: R8-09
numero: 434
title: [P1] fix(funding): cash sweep do financiamento à produção tem que enxergar o caixa das outras operações
labels: P1, funding, motor
sources: R-A38 · R-A313 · R-A320 · 03 §2 · C3
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
1. Dentro do próprio `fundingDoEstudo`, separar o `operacoes.map` de `funding-motor.ts:725-737`
   em duas passadas.

   > ⚠️ **A redação original mandava fazer isto dentro de `estadoFinanceiroDoEstudo`. Aquela
   > refatoração foi RECUSADA pelo autor (D-Q03, 2026-08-22.)** O conserto passa a ser **local ao
   > motor de funding** e **deixa de ter precondição estrutural** — o que também o torna mais barato
   > e mais fácil de atribuir. Ver a issue de registro em Relacionadas.
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
- A refatoração do estado financeiro em si — **recusada pelo autor** (D-Q03). Este conserto
  **não** espera por ela e não a pressupõe.

## Relacionadas
- **R8-49** (registro das cinco montagens) — a fonte única foi **recusada**; aquela issue registra a recusa e a consequência. Esta **não** depende dela.
- **R8-43** (baseline) — é a mudança que **mais** move número em estudo com financiamento à produção + dívida/equity.
<<<END>>>

<<<ISSUE>>>
id: R8-10
numero: 435
title: [P1] fix(funding): barrar soma de `pct_retorno` acima de 100% da receita líquida
labels: P1, backend, funding
sources: R-A37 · R-A316 · decisão nº 2 do autor · 03 §2 e §7 · C3
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

## Relacionadas
- **R8-20** (invariantes de equity) — **complementar**: a rota pega a soma **nominal**, a invariante pega o **mês** em que a distribuição de fato excede.
- **R8-44** (cadastrar em Pinguim) — a prova **E2** de lá é a evidência desta.
- **R8-07** (retorno negativo) — o outro lado do mesmo instrumento.
<<<END>>>

<<<ISSUE>>>
id: R8-11
numero: 436
title: [P1] feat(fluxo-pagamento): exibir em tela, somente-leitura, os juros de tabela já configurados
labels: P1, ui
sources: E-A2-10 · R-A2-01 · R-A2-12 · C2
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

## Relacionadas
- **R8-03** (campo editável de taxa) — esta é **pré-requisito** dela, não alternativa.
- **R8-06** (modal para de reescrever) — é esta issue que torna aquela destruição **visível na hora**, em vez de virar forense de API meses depois.
<<<END>>>

<<<ISSUE>>>
id: R8-12
numero: 437
title: [P1] fix(nav): expor "Regiões monitoradas" fora de Admin → Apps, como a #314 fez com Curvas
labels: P1, ui
sources: B1 §3.1 (8-B.1) · B1 Errata E3 · C4
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
aceito para Benchmark e Curvas.

> ✅ **Decidido pelo autor — D10, 2026-08-22: aba de topo, no padrão da #314.**

A exposição é uma **aba de topo** `/regioes`, ao lado de Estudos · Terrenos · Benchmark · Curvas —
simétrica à #314, custo idêntico, e é o que fecha o item pela letra do pedido ("torne isso
visível"). O link contextual a partir de `frontend/tela-analise-mercado.ts:260` **não** substitui a
aba; se for feito, é encurtamento de caminho por cima dela, não em vez dela.

A escrita continua admin-only — `somenteLeitura` já deriva do contexto e o backend repete a
checagem. Uma aba de topo visível a não-admin em modo leitura é o comportamento que Benchmark e
Curvas já têm.

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
1. **O `git diff` desta issue é estruturalmente igual ao de `ff0b63f`** — os mesmos cinco pontos da
   tabela acima, com `curvas` → `regioes` e `viabilidade-config-curvas` →
   `viabilidade-config-mercado`. Se for muito maior que ele, provavelmente está fazendo algo que a
   #314 não precisou fazer.
2. A aba **Regiões monitoradas** aparece na navegação de topo da própria app, ao lado de Estudos ·
   Terrenos · Benchmark · Curvas, e a rota `/regioes` monta `viabilidade-config-mercado`.
3. `telas_config.mercado_regioes` continua em `manifesto.json` — é adição, não substituição.
4. Não-admin não vê botão de escrita (regressão da #313).
5. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
A configuração de `mercado_busca_url`/`mercado_busca_chave`, que é pendência do autor no ambiente
autenticado.

Sem-fechamento: #313 executora original do item 15, já fechada; entregou outro conserto (legítimo), não a cláusula "torne isso visível"
Sem-fechamento: #314 precedente de solução para a tela irmã (Curvas), a copiar aqui
<<<END>>>

<<<ISSUE>>>
id: R8-13
numero: 438
title: [P1] docs(claude-md): declarar a Rodada 8 aberta na seção de estado do backlog
labels: P1, docs
sources: A4 §6.5 · B1 §1 (placar final) · LEIA-PRIMEIRO (decisões do autor) · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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

## Relacionadas
- **R8-54** (etiquetar `avancado_capital_instrumentos`) — ⚠️ a **decisão 4** transcrita no texto substituto justifica manter a tabela porque *"guarda o dado migrado pela `019`"*; a R8-54 mostra, com `arquivo:linha`, que **esse motivo não se sustenta** (a `019` nunca rodou em Postgres) e dá os três que se sustentam. Ajuste a redação da decisão 4 antes de aplicá-la, ou o `CLAUDE.md` nasce com uma mentira nova.
- **R8-14**, **R8-15**, **R8-45** — as outras alterações do `CLAUDE.md` e da documentação de estado. Coordene para não conflitarem no mesmo arquivo.
<<<END>>>

<<<ISSUE>>>
id: R8-14
numero: 439
title: [P1] docs(recebiveis): quatro lugares afirmam que o motor de safras não está ligado ao calcularFluxo
labels: P1, docs
sources: A4 §1 M1–M4 · A4 §6.0 C1 · A5 (medição em Pinguim) · LEIA-PRIMEIRO "O que NÃO refazer" · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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

## Relacionadas
- **R8-06** (modal para de reescrever) — é o conserto do que este texto passa a **documentar**.
- **R8-03** (campo de taxa) — é o *"o que realmente falta"* que o texto substituto declara.
- **R8-46** (oito blocos do padrão) — mesma família, e o §13 de lá cita as mesmas linhas de motor.
<<<END>>>

<<<ISSUE>>>
id: R8-15
numero: 440
title: [P1] docs(funding): três blocos declaram o funding como não instalado, e ele roda desde a #355
labels: P1, docs
sources: A4 §1 M5 · A4 §1 M17 (§17) · A4 §2 R-A46 · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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

## Relacionadas
- **R8-25** (aba Financeiro) — os **7 campos inertes** que este texto delimita são exatamente os que aquela issue decide o destino. Se ela mergear primeiro, o número muda.
- **R8-41** (rótulo "Dívida / Capital de giro") — traz o **3º bloco** da §17, que esta issue deliberadamente não escreve.
<<<END>>>

<<<ISSUE>>>
id: R8-16
numero: 441
title: [P2] fix(estudo): Preliminar e Avançado do mesmo estudo param de descrever projetos diferentes
labels: P2, motor, ui
sources: 05-conferencia-numerica.md §D9 · 06-auditoria-ui.md §5.2 · C1 · resposta do autor, 2026-08-22
---
## Contexto
O A5 comparou, nos estudos 5 e 6 de Pinguim, as duas camadas do **mesmo** estudo — Premissas (Preliminar) e Catálogo (Avançado) — e encontrou divergência em área, VGV e, sobretudo, na permuta física. O A6 achou a mesma coisa por outro ângulo, olhando os estados condicionais: *"a conversão Preliminar → Avançado perdeu os 18%"*.

## Comportamento atual
Área e VGV divergem por arredondamento de área:

| | Premissas (Preliminar) | Catálogo (Avançado) | Δ |
|---|---:|---:|---:|
| Área vendável R | 15.212,26 m² | 234 × 65 = 15.210,00 m² | 2,26 m² |
| Área vendável NR | 1.107,39 m² | 22 × 50 = 1.100,00 m² | 7,39 m² |
| **Total** | **16.319,65 m²** | **16.310,00 m²** | **9,65 m²** |

Pior que a área: **a permuta física de 42 unidades existe só no Avançado.** Nas Premissas dos dois estudos, `permuta_fisica_area_m2 = null`, `permuta_fisica_area_canonica = null`, `permuta_fisica_quantidade = 0`. E os 4 Preliminares da instância têm `permuta_fisica_pct: 18.00` com `modo: 'pct_area_venda'`, enquanto os 2 Avançados — **o mesmo empreendimento** — têm `modo: 'area_m2'` com `area_m2: null` e `pct: null`.

O app **não reconcilia as duas camadas nem avisa que divergem**. Um estudo Avançado continua exibindo a aba Proforma do Preliminar.

## Consequência

| Estudo | VGV Preliminar | VGV Avançado | Δ | O Δ é exatamente |
|---|---:|---:|---:|---|
| 5 | R$ 155.036.675,00 | R$ 154.945.000,00 | R$ 91.675,00 | 9,65 × R$ 9.500 |
| 6 | R$ 171.537.035,00 | R$ 171.448.400,00 | R$ 88.635,00 | 2,26×10.640 + 7,39×8.740 |

| Estudo | Resultado Preliminar | Resultado Avançado | Δ |
|---|---:|---:|---:|
| 5 | R$ 41.918.698,77 | R$ 24.668.189,10 | **R$ 17.250.509,67** |
| 6 | R$ 51.389.892,70 | R$ 28.358.402,21 | **R$ 23.031.490,49** |

**R$ 17,25 MM e R$ 23,03 MM de diferença de resultado, no mesmo estudo, em duas abas** — porque uma delas não sabe que o projeto tem 42 unidades em permuta. Quem abrir a aba Proforma de um estudo Avançado lê um projeto que não existe, sem nenhuma marca de que aquilo é a camada antiga.

## Comportamento esperado
**As duas camadas são reconciliadas** — decisão do autor, **2026-08-22**. A permuta física do Avançado
passa a se refletir nas Premissas, e vice-versa: um estudo Avançado com 42 unidades em permuta
descreve, nas duas abas, **o mesmo projeto**.

As alternativas consideradas antes — esconder as abas do Preliminar num estudo Avançado, ou exibi-las
com aviso de divergência — estão **descartadas**. Esconder perde funcionalidade em uso; avisar apenas
documenta a incoerência em vez de resolvê-la.

## Como corrigir
1. **Reconciliar o dado.** Num estudo `nivel_analise = 'avancado'`, a permuta física declarada no
   Catálogo (`unidades_permutadas` por tipologia) alimenta os campos de permuta das Premissas
   (`permuta_fisica_quantidade`, `permuta_fisica_area_m2`/`_canonica`), e a área vendável das
   Premissas passa a derivar do Catálogo em vez de conviver com um valor próprio. Os R$ 91.675,00 e
   R$ 88.635,00 de Δ de VGV dos estudos 5 e 6 são consequência do arredondamento de área e
   desaparecem quando a fonte é uma só.
2. **Guardar a reconciliação com uma invariante.** Uma verificação nova em
   `frontend/fluxo-invariantes.ts` compara, para estudo Avançado, área vendável e quantidade de
   permuta física entre Premissas e Catálogo, e emite alerta quando divergirem além da tolerância
   padrão (R$ 0,01 / arredondamento de área declarado). Ela é a rede que impede a divergência de
   voltar sem ninguém notar — não substitui a reconciliação.
3. A direção da reconciliação é **Catálogo → Premissas** para permuta e área vendável: no Avançado, o
   Catálogo é a camada com granularidade de unidade e é onde o usuário declara a permuta física. O PR
   precisa declarar essa direção explicitamente, com teste.

## Critério de aceite
1. Teste com fixture de estudo Avançado cuja permuta física existe só no Catálogo: a invariante nova acusa divergência.
2. Teste de regressão: estudo com as duas camadas coerentes não acusa nada.
3. Reexecutar `scripts/conferir-estudo.ts 5 6`: a divergência de R$ 91.675,00 / R$ 88.635,00 **deixa de existir** — as duas camadas passam a somar o mesmo VGV —, e qualquer resíduo acima da tolerância aparece **reportado**, não silencioso.
4. Confirmação do autor na Pinguim de que a aba Proforma de um estudo Avançado descreve o mesmo projeto que o Catálogo. Não há navegador no ambiente Claude Code.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Unificar as **definições** de margem/VGV/ROI entre as telas — issue própria.
- Apagar as colunas de Premissas do `schema.json`.
- Corrigir o dado já gravado nos estudos 5 e 6 de Pinguim.
- **Investigar por que a promoção Preliminar → Avançado perde os 18% de permuta** — issue própria, ver Relacionadas.

## Relacionadas
- **R8-18** (uma definição por rótulo) — a divergência **de definição** entre as telas; esta é a divergência **de dado** entre as duas camadas.
- **#486** — a **perda dos 18% na promoção Preliminar → Avançado** virou issue própria. Os 4 Preliminares da instância têm `permuta_fisica_pct: 18.00` com `modo: 'pct_area_venda'`; os 2 Avançados do **mesmo empreendimento** têm `modo: 'area_m2'` com `area_m2: null` e `pct: null`. Isso é suspeita de **bug no caminho de promoção de nível**, não de reconciliação de camadas — investigá-lo aqui misturaria duas causas. Esta issue reconcilia o que existe; aquela apura por que o dado se perde na conversão.
<<<END>>>

<<<ISSUE>>>
id: R8-17
numero: 442
title: [P2] fix(custos): orcamento_valor deixa de mentir quando existe orcamento_valor_canonico
labels: P2, ui
sources: 05-conferencia-numerica.md §D19 · C1
---
## Contexto
Achado do A5 no estudo 6 de Pinguim, ao conferir linha a linha os custos contra o que o motor aplica. O número **exibido e usado está certo**; o dano é no dado persistido.

## Comportamento atual
Estudo 6, linha `terreno/Registro/Incorporação e registro`:

    orcamento_unidade        = 'rs'
    orcamento_valor          = '0.24'
    orcamento_valor_canonico = '411476.16'

`resolverOrcamento` (`frontend/fluxo-shared.ts:428-429`) prefere o canônico, e o motor aplica **R$ 411.476,16** — que é `0,24% × R$ 171.448.400`, de quando a unidade era `pct_vgv`. Mas a coluna `orcamento_valor` ficou **congelada em `0.24` com unidade `rs`**.

`_trocarUnidade` (`frontend/tela-fluxo-custos.ts:1058-1068`) só inicializa o canônico quando ele é nulo e **nunca reconverte `orcamento_valor`**.

## Consequência
**Quem ler a API sem conhecer a regra do canônico lê R$ 0,24 onde o motor usa R$ 411.476,16** — uma linha de custo de quatrocentos mil reais aparecendo como vinte e quatro centavos. Severidade baixa hoje, porque nenhum consumidor externo existe; **alta no dia em que qualquer consumidor novo (export, BI, IA) ler a coluna direta** — e o próprio A5 quase caiu nela ao montar a conferência.

## Comportamento esperado
Ao trocar a unidade de um orçamento, `orcamento_valor` é **reconvertido** para a unidade nova, de forma que `orcamento_valor` + `orcamento_unidade` sempre descrevam o mesmo dinheiro que `orcamento_valor_canonico`.

## Como corrigir
`_trocarUnidade` (`frontend/tela-fluxo-custos.ts:1058-1068`) passa a reescrever `orcamento_valor` na unidade de destino, usando o canônico como fonte — exatamente o que `resolverOrcamento` já faz para ler. A conversão já existe no app; falta aplicá-la na escrita.

Há uma segunda saída defensável: **parar de persistir `orcamento_valor`** quando o canônico existe, deixando a coluna nula. É mais limpa e mais arriscada — qualquer leitor que hoje caia no fallback de `orcamento_valor` passa a receber `null`. **Recomendação: reconverter**, que não muda o contrato da coluna.

## Critério de aceite
1. Teste: linha com `orcamento_unidade = 'pct_vgv'` e valor `0.24` sobre VGV R$ 171.448.400 → trocar para `'rs'` produz `orcamento_valor === '411476.16'` e `orcamento_valor_canonico` inalterado.
2. Teste no sentido inverso (`rs` → `pct_vgv`) fechando no mesmo dinheiro.
3. Teste de que `resolverOrcamento` devolve o mesmo número antes e depois da troca de unidade — a troca é de representação, **não de valor**.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Corrigir o dado já gravado no estudo 6 de Pinguim.
- Os outros campos derivados persistidos com valor não-efetivo (`pos_obra.pct`, Σ legado, `fluxo_pagamento.ret`) — issue própria.
- Mudar a precedência de `resolverOrcamento`, que está **correta**.

## Relacionadas
- **R8-27** (campos derivados persistidos) — mesma família: coluna persistida que não carrega o valor efetivo. Causas diferentes, consertos diferentes.
<<<END>>>

<<<ISSUE>>>
id: R8-18
numero: 443
title: [P2] fix(indicadores): rótulos que distinguem Margem líquida, VGV e ROI — sem unificar as definições
labels: P2, ui, motor
sources: 05-conferencia-numerica.md §D15 · 06-auditoria-ui.md §5.4 · §8 A18 · A20 · C1
---
> ✅ **Decisão do autor — D-Q03, 2026-08-22: a saída é a (b). A (a) foi recusada.**
> *"Corrigir o erro da proforma, mas **não** unificar as definições."* As fórmulas concorrentes
> **ficam**; o que muda são os **rótulos**, que passam a dizer qual é qual: "VGV potencial" ×
> "Receita Bruta", "Margem de caixa" × "Margem sobre Receita Bruta". O Resumo **continua** com a
> conta inline de `frontend/tela-resumo.ts:159-166`.
>
> Por isso o título mudou: a issue não é mais *"uma definição por rótulo"* — é **um rótulo por
> definição**, que é o inverso. O levantamento abaixo (4 margens, 3 resultados, 12 superfícies,
> 3 funções-fonte) continua sendo a evidência, e agora é também o **inventário do que precisa
> ganhar nome**.
>
> ⚠️ **A consequência foi aceita explicitamente:** com quatro definições vivas, a régua de
> benchmark julga um número que depende da tela em que o usuário está. Os rótulos transferem a
> taxonomia interna do motor para o usuário — era o custo declarado da (b), e o autor o assumiu.

## Contexto
O A5 mediu contra Pinguim **4 margens líquidas e 3 resultados distintos para o mesmo estudo, na mesma sessão**. O A6 auditou a apresentação e mapeou **12 superfícies** que exibem esses indicadores, alimentadas por **3 funções-fonte concorrentes**. As duas lentes chegaram à mesma conclusão por caminhos diferentes: **o bug de sinal do funding não é a única causa da divergência — nem a principal.**

## Comportamento atual
Quatro margens para o estudo 5, todas exibidas hoje:

| Onde | Fórmula | Estudo 5 | Estudo 6 |
|---|---|---:|---:|
| Aba **Resumo** (Avançado) | `fluxoAcumulado[último] / vgvTotal` — `frontend/tela-resumo.ts:165` | **15,92%** | **16,54%** |
| `proformaAvancado` sem funding | `resultado / receitaBruta` — `frontend/proforma-avancado.ts:115` | 18,94% | 20,20% |
| Aba **Resultados** + painel | idem, com funding somado ao custo | **−47,87%** | **−44,84%** |
| Aba **Proforma** (Preliminar) | `resultado / vgv` — `frontend/proforma.ts:309` | **27,04%** | **29,96%** |

São **três numeradores e três denominadores diferentes sob um rótulo só** — regimes contábeis diferentes (caixa × competência) sobre bases diferentes.

**"VGV" significa duas grandezas dentro do mesmo estudo Avançado:**

| Superfície | Campo | Grandeza |
|---|---|---|
| **Resumo**, KPI rotulado "VGV" | `c.vgvTotal` | **grandeza 1 — VGV potencial**, inclui a permuta física |
| **Painel de estudos**, coluna rotulada "VGV" (`frontend/tela-dashboard.ts:74,289,404`) | `p.vgv = c.receitaBruta` | **grandeza 6 — Receita Bruta** |

O próprio motor declara as duas como grandezas **distintas e numeradas** (`frontend/fluxo-caixa-motor.ts:229-246`), e o comentário de `:239-241` registra que confundi-las foi exatamente o defeito que a #227/#229 corrigiu. **Duas telas voltaram a chamar as duas de "VGV".** A coluna do painel ainda mistura grandezas por nível: `receitaBruta` no Avançado, `proforma.vgv` no Preliminar.

**"ROI" tem dois denominadores:** `resultado / custoTotal` no Resumo (`frontend/tela-resumo.ts:166`) × `resultado / investimentoTotal` no painel (`frontend/proforma-avancado.ts:124`). O comentário de `frontend/proforma-avancado.ts:47-58` justifica o segundo dizendo que *"ROI sem denominador comum entre os dois níveis compara coisas diferentes na mesma coluna"* — **o raciocínio está certo, e é exatamente o argumento contra a versão do Resumo**.

Única superfície que rotula certo: a exportação do Avançado, `frontend/exportar.ts:433` — **"Receita Bruta — VGV"**.

## Consequência
Contra a meta de 20% do benchmark `margem_liquida`, o **mesmo estudo** reprova na aba Resumo, passa raspando sem funding, desaba na aba Resultados e passa folgado na aba Proforma. O usuário do estudo 5 vê **"Margem líquida −47,87%"** na aba Resultados e margem **positiva** no Resumo, no mesmo instante, com o mesmo rótulo, e nada na tela diz que são medidas diferentes. A exportação não traz margem nenhuma, então nem serve de desempate.

**Um mesmo rótulo significando coisas diferentes em telas diferentes é pior que uma prop errada: a prop errada não faz nada e o usuário percebe. O rótulo ambíguo produz um número plausível — e ele acredita.**

## Comportamento esperado
Uma definição por rótulo, em todo o app. Consertar o sinal do funding (issue `fix(proforma): parar de contar o principal…`) resolve o **sinal**, **não** a incoerência: mesmo com ela mergeada, Resumo e Resultados continuariam divergindo.

## Como corrigir
A pergunta de `06-auditoria-ui.md` §7 Q8 **foi respondida: (b)**. A (a) fica registrada abaixo
como o que foi considerado e recusado — não a implemente.

- **(a)** o **Resumo passa a chamar `proformaAvancado`**, e a conta inline de `frontend/tela-resumo.ts:159-166` some. O app fica com **uma** definição por indicador. **Muda o número que o usuário vê hoje no Resumo** — o PR precisa declarar o antes/depois dos estudos 5 e 6. **Recomendada:** é a única que não exige que o usuário conheça a taxonomia interna do motor.
- **(b)** mantêm-se as duas definições e os **rótulos passam a distingui-las**: "VGV potencial" × "Receita Bruta", "Margem de caixa" × "Margem sobre Receita Bruta". Não muda número nenhum, mas transfere a taxonomia interna do motor para o usuário.

Em **qualquer** das duas, a coluna "VGV" do painel de estudos (`frontend/tela-dashboard.ts:74,289,404`) para de guardar duas grandezas: ou passa a exibir a mesma grandeza nos dois níveis, ou muda de nome.

Esta issue **depende** do conserto de `frontend/proforma-avancado.ts:92-93`: unificar em cima de uma função que soma o principal do funding ao custo propagaria o erro para o Resumo.

## Critério de aceite
1. `grep -rn "margemLiquida\|margem_liquida\|margemPct" frontend/*.ts` — **uma** fórmula de margem líquida no app, ou tantas quantas forem os rótulos distintos, com cada rótulo mapeado a uma só.
2. ~~Se (a)…~~ — **recusada**. `frontend/tela-resumo.ts:159-166` **mantém** a conta inline, e nenhum teste deve exigir que Resumo e Resultados exibam o mesmo número: eles medem coisas diferentes, e é exatamente isso que os rótulos passam a declarar.
3. **(b), a saída escolhida:** teste ou grep provando que nenhum rótulo literal `"VGV"`, `"Margem líquida"` ou `"ROI"` sobrevive em duas telas com fórmulas diferentes por trás.
4. `frontend/exportar.ts:433` continua desambiguando ("Receita Bruta — VGV") e passa a ser **coerente** com a tela que gerou o arquivo.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- O **sinal** do funding em `frontend/proforma-avancado.ts:92-93` — issue própria, e **pré-requisito** desta.
- A divergência Preliminar × Avançado do mesmo estudo (Δ R$ 17,25 M no estudo 5) — outra causa, issue própria.
- Trocar as fórmulas por definições novas de negócio. Esta issue **unifica** o que existe; mudar a definição de margem é decisão do autor e outra issue.

## Relacionadas
- **R8-01** (proforma) — **pré-requisito**.
- **R8-49** (registro das cinco montagens) — a causa estrutural, cuja unificação o autor **recusou** na mesma resposta. Aquela issue **delega a esta** o item 3 dela (os rótulos que distinguem); as duas saem juntas ou o registro fica descrevendo trabalho que ninguém fez.
- **R8-28** (`margemBrutaPct`) — a quarta definição divergente, com issue própria.
- **R8-26** (benchmarks) — é contra a régua de `margem_liquida` que a ambiguidade cobra o preço.
<<<END>>>

<<<ISSUE>>>
id: R8-19
numero: 444
title: [P2] fix(invariantes): o painel de Reconciliação para de emitir os três falsos positivos determinísticos
labels: P2, motor
sources: 05-conferencia-numerica.md §D1 · §D2 · §D5 · C1 (três blocos fundidos)
---
## Contexto
O A5 rodou as 7 funções de `frontend/fluxo-invariantes.ts` contra os inputs reais dos estudos 5 e 6
de Pinguim: **13 divergências, e 5 delas são falso positivo do validador, não do motor.** Os três
defeitos abaixo são **determinísticos**, moram no **mesmo arquivo**, têm **um conserto de uma linha
cada** e **nenhum deles muda número de estudo nenhum** — só o que o painel de Reconciliação exibe.

> 🔗 **Por que uma issue e não três.** Foram escritas como três blocos separados (fatia C1, `§D1`,
> `§D2`, `§D5`) e estão fundidas aqui **de propósito**: o dano real não é nenhum dos três isolado —
> é o **composto**. Cinco erros vermelhos permanentes mais um alerta garantido em toda incorporação
> com permuta treinam o usuário a ignorar o painel; e o painel é onde moram os verdadeiros positivos,
> como o `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` da D14. Além disso a regra de "uma mudança de
> número por PR" **não se aplica**: nenhum dos três move um centavo. Cada um mantém abaixo o seu
> próprio critério de aceite, e um PR pode entregá-los em três commits.

---

## 1) `VENDA_BRUTA_NAO_RECONCILIA` deixa de acusar erro em estudo com permuta física

### Contexto
O A5 rodou as 7 funções de `frontend/fluxo-invariantes.ts` contra os inputs reais dos estudos 5 e 6 de Pinguim. **13 divergências, e 5 delas são falso positivo do validador, não do motor.** Esta é a primeira, e é determinística.

### Comportamento atual
`validarContratacao` (`frontend/fluxo-invariantes.ts:150-159`) soma o VGV de **todas** as unidades alocadas × absorção. O motor tira a permuta física do VGV vendável (`vgvVendavelLinha`, via `calc.vgvPermutaFisica`). **Os dois nunca podem bater num estudo com permuta.**

### Consequência

| Estudo | Esperado (validador) | Obtido (motor) | Δ | O Δ é exatamente |
|---|---:|---:|---:|---|
| 5 | R$ 154.945.000,00 | R$ 129.009.999,99 | **−R$ 25.935.000,01** | 42 un × 65 m² × R$ 9.500 = R$ 25.935.000 |
| 6 | R$ 169.030.977,56 | R$ 140.393.343,03 | **−R$ 28.637.634,53** | 42 × 65 × R$ 10.640 × 98,59% = R$ 28.637.634,53 |

O painel de Reconciliação mostra **erro vermelho permanente** nos dois estudos — num estudo cujo fluxo está **correto**. É o pior tipo de alarme: **o que treina o usuário a ignorar alarme.** E o app inteiro depende desse painel para sinalizar os erros de verdade (o `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, por exemplo, é verdadeiro positivo e está afogado no meio dos falsos).

### Comportamento esperado
`validarContratacao` reconcilia contra o **VGV vendável** — o mesmo que o motor usa —, descontando `calc.vgvPermutaFisica`. Num estudo correto com permuta física, o painel de Reconciliação fica **limpo**.

### Como corrigir
`frontend/fluxo-invariantes.ts:150-159` passa a deduzir a permuta física do valor esperado, lendo a **mesma** grandeza que o motor (`calc.vgvPermutaFisica` / `vgvVendavelLinha`), em vez de recalcular a soma bruta das alocações. A regra tem de vir do motor, não ser reimplementada — foi a reimplementação que criou a divergência.

### Critério de aceite
1. Teste com fixture que tenha permuta física > 0: `validarContratacao` **não** emite `VENDA_BRUTA_NAO_RECONCILIA`.
2. Teste de regressão: fixture **sem** permuta continua reconciliando e continua acusando uma divergência artificial injetada (a invariante não pode virar sempre-verde).
3. Reexecutar `scripts/conferir-estudo.ts 5 6` contra Pinguim: zero ocorrências de `VENDA_BRUTA_NAO_RECONCILIA`.
4. `bash scripts/validar-frontend.sh` verde.

### Fora de escopo
- `COMPONENTE_INVALIDO` e `CATEGORIA_CUSTO_DUPLICADA`, também falsos positivos, com causas diferentes — issues próprias.
- `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, que é **verdadeiro positivo** e está funcionando (a D14 da #355). Não mexer.
- O estoque comprometido em 276/234 que o `PATCH` sem guarda criou — issue própria; aquele alarme é **verdadeiro**.

---

## 2) `COMPONENTE_INVALIDO` passa a aplicar a mesma regra que o motor

### Contexto
Segundo falso positivo determinístico encontrado pelo A5 ao rodar `frontend/fluxo-invariantes.ts` contra os dados reais de Pinguim. A causa raiz é mecânica e tem uma linha só.

### Comportamento atual
O motor converte um `ate_marco` degenerado (`N_s ≤ 0`, venda contratada no próprio mês do marco) em `imediato`, dentro de `componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030-1043`), com comentário explícito: *"não se cria prazo negativo nem se invalida toda a safra"*.

O validador (`frontend/fluxo-invariantes.ts:184`) chama **só** `componentesEfetivosSafra`, que **não** faz essa conversão — e aí `pagamentosAteMarco` (`frontend/fluxo-caixa-motor.ts:733-738`) lança.

**Causa raiz:** `componentesIntegradosSafra` **não é exportada** (`frontend/fluxo-caixa-motor.ts:1030`, sem `export`), então a invariante não tem como usar a mesma regra.

### Consequência
- Estudo 5: **2 erros**, safra 38 / marco 38 (linhas *Tabela curta* e *Tabela longa*).
- Estudo 6: **3 erros**, safra 40 / marco 40 (as três linhas).

O `calcularFluxo` das mesmas linhas roda **sem exceção e produz número**. Ou seja, a mensagem *"converta o componente para imediato ou concentrado"* pede ao usuário que faça **algo que o motor já fez** — e não há nada que ele possa fazer na tela que apague o erro. Junto com o `VENDA_BRUTA_NAO_RECONCILIA`, são 5 dos 9 erros vermelhos que os dois estudos exibem permanentemente.

### Comportamento esperado
A invariante e o motor aplicam **a mesma regra** sobre os mesmos componentes. Um `ate_marco` degenerado que o motor converte para `imediato` **não** produz `COMPONENTE_INVALIDO`.

### Como corrigir
Exportar `componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030`) e usá-la em `frontend/fluxo-invariantes.ts:184` no lugar de `componentesEfetivosSafra`. É a correção mínima e mantém **uma** definição da regra.

Se houver motivo para a invariante não usar a função integrada, a alternativa é a invariante deixar de tratar o caso degenerado como erro — mas aí a regra fica duplicada, que é exatamente a causa deste defeito. **A exportação é a saída preferida.**

### Critério de aceite
1. `grep -n "export.*componentesIntegradosSafra" frontend/fluxo-caixa-motor.ts` retorna a declaração.
2. Teste com safra e marco no mesmo mês (`N_s ≤ 0`): a invariante **não** emite `COMPONENTE_INVALIDO`, e `calcularFluxo` produz o mesmo número de antes.
3. Teste de regressão: um componente genuinamente inválido continua sendo acusado.
4. Reexecutar `scripts/conferir-estudo.ts 5 6`: zero ocorrências de `COMPONENTE_INVALIDO`.
5. `bash scripts/validar-frontend.sh` verde.

### Fora de escopo
- Mudar o comportamento do motor na conversão do `ate_marco` degenerado — ele está **certo** e é o que produz número correto hoje.
- Os outros dois falsos positivos das invariantes — issues próprias.

---

## 3) Duplicata de custo considera a subcategoria antes de alertar

### Contexto
Terceiro falso positivo das invariantes encontrado pelo A5 contra os dados reais de Pinguim. É `alerta`, não `erro`, mas é **garantido** em toda incorporação com permuta.

### Comportamento atual
`validarCustosDuplicados` (`frontend/fluxo-invariantes.ts:222-226`) chaveia por `grupo::categoria` e **descarta `subcategoria`** — que é justamente o campo que distingue as linhas.

### Consequência
No grupo `terreno`, categoria `Preço`, o estudo 6 tem **4 linhas legítimas** (`—`, `Valor à vista`, `Permuta financeira`, `Permuta física`) e leva alerta de duplicata; o estudo 5 tem 2 e leva também. Severidade `alerta`, então não bloqueia — mas é **ruído garantido em todo estudo de incorporação com permuta**, no mesmo painel que já exibe 5 erros vermelhos falsos. O efeito composto é o painel de Reconciliação inteiro perder credibilidade.

### Comportamento esperado
Duas linhas de custo só são reportadas como duplicadas quando `grupo`, `categoria` **e** `subcategoria` coincidem.

### Como corrigir
`frontend/fluxo-invariantes.ts:222-226` passa a chavear por `grupo::categoria::subcategoria`, tratando `subcategoria` ausente/vazia como uma chave própria (para que duas linhas sem subcategoria continuem sendo duplicata entre si).

### Critério de aceite
1. Teste com as 4 linhas de `terreno/Preço` do estudo 6 (`—`, `Valor à vista`, `Permuta financeira`, `Permuta física`): **nenhum** `CATEGORIA_CUSTO_DUPLICADA`.
2. Teste de regressão: duas linhas com grupo, categoria **e** subcategoria idênticos continuam sendo acusadas.
3. Reexecutar `scripts/conferir-estudo.ts 5 6`: zero ocorrências de `CATEGORIA_CUSTO_DUPLICADA`.
4. `bash scripts/validar-frontend.sh` verde.

### Fora de escopo
- As linhas órfãs `terreno/Preço/—` e `terreno/Preço/Permuta financeira` do estudo 6, ambas com `orcamento_valor: null`. São **preenchimento parcial de dado de teste**, não defeito do app.
- Os outros dois falsos positivos das invariantes — issues próprias.

---

## Critério de aceite da issue inteira
1. Os três critérios de aceite acima, cada um com os seus testes.
2. Reexecutar `scripts/conferir-estudo.ts 5 6` contra Pinguim: das 13 divergências medidas, as **5**
   ocorrências de `VENDA_BRUTA_NAO_RECONCILIA` + `COMPONENTE_INVALIDO` e o alerta
   `CATEGORIA_CUSTO_DUPLICADA` **desaparecem**, e as que sobram são verdadeiras.
3. **Nenhum dos 4 KPIs (Resultado, Margem, ROI, TIR) dos estudos 5 e 6 muda** — é validador, não
   motor. Um PR que mova qualquer um deles está mexendo em algo que esta issue não autoriza.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, que é **verdadeiro positivo** e está funcionando (a D14
  da #355). Não mexer.
- `PRODUTO_EXCEDE_ESTOQUE` / `ESTOQUE_MENSAL_NEGATIVO` nos estudos 5 e 6: aquele alarme é
  **verdadeiro** — foi o `PATCH` de tipologias sem guarda que criou o estado. Issue própria.
- As invariantes que **faltam** (equity, conservação da absorção, reconciliação Preliminar ×
  Avançado) — issues próprias, todas de acrescentar, não de corrigir falso positivo.

## Relacionadas
- **R8-08** (`PATCH` de tipologias) — o alarme **verdadeiro** do mesmo painel; consertar os falsos sem fechar aquela porta deixa o painel vermelho por motivo certo.
- **R8-48** (`question(corretagem)`) — a base `vgvVendidoMensal` × `vendaBrutaContratadaMensal` é a mesma divergência de base que o falso positivo nº 1 expõe do lado do validador.
- **R8-20** (invariantes de equity) — o mesmo arquivo, na direção oposta: lá faltam checagens, aqui sobram.
<<<END>>>

<<<ISSUE>>>
id: R8-20
numero: 445
title: [P2] fix(reconciliacao): equity ganha invariantes próprias, hoje é pulado inteiro
labels: P2, funding, motor
sources: R-A315 · R-A316 · A5 (equity não conferível) · 03 §7 · C3
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

## Relacionadas
- **R8-07** (retorno negativo) — este diagnóstico entra **independente** daquela decisão.
- **R8-10** (teto de 100%) — a leitura **mensal** do que aquela valida no **nominal**.
- **R8-44** (cadastrar em Pinguim) — sem operação cadastrada, nem o autor nem uma auditoria conseguem *ver* o defeito.
- **R8-19** (falsos positivos) — mesmo arquivo; ordene para não conflitar.
<<<END>>>

<<<ISSUE>>>
id: R8-21
numero: 446
title: [P1] fix(fluxo): o horizonte do fluxo cobre todo mês em que algo entra ou sai
labels: P1, motor, funding
sources: R-A33 · R-A36 (alerta de horizonte) · 03 §2 · C3 · resposta do autor, 2026-08-22
---
## Contexto
A redação anterior desta issue enquadrava o problema como um KPI mal lido: `saldoFinal`
(`frontend/funding-motor.ts:509`) pega a última posição da série em vez do saldo no mês `fim` da
operação, divergindo de `!divida!C74` da planilha do autor
(`ÍNDICE($F$19:$F$66; CORRESP($C$9+SE($C$10;$C$11;1)−1+$C$13; $A$19:$A$66; 0))`, que busca
deliberadamente o mês `fim`).

**O autor recusou o enquadramento em 2026-08-22:**

> *"não tem essa de cair depois do fim do estudo. todo o estudo é mapeado e o fluxo vai até o último
> mês que é enquanto alguma coisa está entrando ou saindo do fluxo, só isso. se existe um limite de
> meses que atrapalha isso, então o número de meses no fluxo deve ser sempre o maior possível.
> corrija isso."*

Ele está certo, e a leitura do código confirma: **a causa não é o KPI, é o horizonte**. O
`saldoFinal` truncado é **consequência** — com o horizonte certo, a última posição da série *é* o mês
da quitação, e ele passa a ler o número certo sozinho. Por isso a issue subiu de **P2 para P1**: a
causa move o fluxo inteiro, não só um indicador.

## Comportamento atual
O horizonte é derivado uma única vez, em `frontend/fluxo-caixa-motor.ts:1762-1766`:

```js
const ultimoCrono = Math.max(0, ...crono.map((e) => n(e.inicio_mes) + n(e.duracao_meses) - 1));
const ultimoCustos = Math.max(0, ...linhasCusto.map((c) => n(c.inicio_mes) + n(c.duracao_meses) - 1));
const ultimoRecebivel = Math.max(0, ...linhasReceitaOriginal.map((l) => ultimoMesRecebivelLinha(l, crono)));
const prazoDerivado = Math.max(ultimoCrono, ultimoRecebivel, ultimoCustos, 11) + 1;
const prazo = Math.max(1, Math.round(n(config.prazoMeses) || prazoDerivado));
```

**Dois defeitos, independentes um do outro:**

1. **As operações de funding não entram no `max`.** Cronograma, custos e recebíveis entram; **dívida
   e equity não**. O funding herda o horizonte já fechado — `frontend/funding-motor.ts:720` faz
   `const prazo = fluxoLivreMensal.length` —, então uma operação cuja amortização termina depois do
   último evento operacional é simplesmente **cortada**. Em `simularDivida`, o mês de quitação é
   `fim = inicio_mes + nTranches - 1 + periodo_amortizacao_meses` (`funding-motor.ts:250-252`), e
   nada nessa conta chega até a derivação do prazo.
2. **`config.prazoMeses`, quando preenchido, substitui o derivado em vez de ser piso.** O `||` da
   última linha descarta `prazoDerivado` inteiro assim que houver um valor digitado — um prazo menor
   que o necessário **trunca o fluxo todo**, não só o funding. O próprio motor já sabe que isso
   acontece e se limita a avisar no console (`fluxo-caixa-motor.ts:1361,1372`: *"prazoMeses explícito
   menor que o necessário? Valor NÃO computado."*).

## Consequência
O estudo mostra um fluxo que **termina antes do projeto**. A dívida some do gráfico no mês do corte;
`saldoFinal` exibe o saldo truncado, que é **menor** que o compromisso real na data contratual de
quitação; a tela infere o problema do número em vez de sabê-lo
(`frontend/tela-funding.ts:486-490` alerta quando `Math.abs(ind.saldoFinal) >= 0.01`, e
`frontend/fluxo-invariantes.ts:356-360`, `DIVIDA_FINAL_NAO_ZERA`, faz o mesmo). Quem lê "saldo final
R$ 3 MM" numa operação de 120 meses dentro de um horizonte de 48 lê um número que não corresponde a
compromisso nenhum.

O mesmo corte atinge o equity: o modo `resultado_final` paga sobre `fluxoAcumulado[último]`, que só
é o resultado do projeto se o horizonte tiver alcançado o último evento financeiro. A lacuna nº 16
de `inteligencia-evi-incorporacao.md:1400-1416` já dizia que o horizonte tem de cobrir o fim de todas
as safras e do capital de giro — e nada no app verifica isso.

## Comportamento esperado
1. **O horizonte cobre todo mês em que algo entra ou sai.** A derivação de
   `fluxo-caixa-motor.ts:1762-1766` passa a incluir o último mês das operações de funding — quitação
   de dívida (`fim`), aportes e retornos de equity, e o fim do financiamento à produção — ao lado de
   cronograma, custos e recebíveis.
2. **`config.prazoMeses` vira piso, não teto:**
   `const prazo = Math.max(prazoDerivado, Math.round(n(config.prazoMeses) || 0), 1)`. Um prazo
   digitado pode **esticar** o fluxo; nunca pode encurtá-lo.
3. `saldoFinal` continua sendo a última posição da série — e passa a **ser** o saldo na quitação,
   porque a série agora chega lá. Nenhuma lógica nova de KPI é necessária.
4. Consequência de forma: o aviso de `tela-funding.ts:486-490` e a divergência
   `DIVIDA_FINAL_NAO_ZERA` deixam de disparar por truncamento e passam a significar o que dizem —
   dívida que realmente não zerou.

## Critério de aceite
- [ ] Operação de dívida com `inicio_mes = 0` e `periodo_amortizacao_meses = 36`, num estudo cujo
      último evento de cronograma/custo/recebível é o mês 23 → o horizonte do fluxo tem **pelo menos
      36 meses**, e `saldoFinal ≈ 0` porque a série alcançou a quitação.
- [ ] `config.prazoMeses = 12` num estudo cujo derivado é 48 → o fluxo tem **48** meses; nada é
      truncado, e o aviso de console de `:1372` não dispara mais para esse caso.
- [ ] `config.prazoMeses = 60` num estudo cujo derivado é 48 → o fluxo tem **60** meses (o piso
      digitado ainda estica).
- [ ] Estudo sem funding → horizonte **idêntico** ao baseline. Nenhum dos 6 estudos de Pinguim muda
      de número por causa desta issue, exceto onde havia truncamento.
- [ ] Equity em modo `resultado_final` passa a ler um `fluxoAcumulado` que cobre o último evento
      financeiro.
- [ ] `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Impedir o cadastro de operação longa — não há mais o que impedir: o horizonte a acompanha.
- Mudar a **forma** de qualquer série mensal. Esta issue muda só o **comprimento** do horizonte e a
  semântica de `prazoMeses`.
- Extrapolar curva Price para além do que a simulação produz — deixou de ser necessário.

## Relacionadas
- **R8-44** (cadastrar em Pinguim) — a prova **E3** de lá é a evidência desta.
- **R8-49** (registro das cinco montagens dos Passos 23–25) — `resultadoFinal` é remontado em três lugares e a fonte única foi **recusada** (D-Q03); um horizonte mais longo muda o valor lido em **todas** elas, então a issue precisa nascer sabendo disso.
- **R8-09** (cash sweep) — o sweep passa a enxergar meses que antes nem existiam na série.
<<<END>>>

<<<ISSUE>>>
id: R8-22
numero: 447
title: [P2] fix(proforma): renomear "Custos Financeiros" na proforma para declarar que exclui o serviço da dívida
labels: P2, ui, funding
sources: R-A312 · A5 (4 margens) · 04 §6.3 E10 · 03 §7 · C3
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

## Relacionadas
- **R8-01** (proforma) — vem **antes** desta, e a seção *"Desambiguação obrigatória do rótulo"* de lá é o contrato que esta issue entrega.
- **R8-23** (docs) — a mesma desambiguação, no documento.
<<<END>>>

<<<ISSUE>>>
id: R8-23
numero: 448
title: [P2] docs(formulas): declarar que a proforma do Avançado é desalavancada, e por quê
labels: P2, docs
sources: 04 §6.3 E10 · R-A312 · A4 (varredura documental) · A5 · C3
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

## Relacionadas
- **R8-01** (proforma) — aplicar **junto** ou logo depois; **nunca antes**, senão o documento mente na direção oposta.
- **R8-22** (rótulo) — a mesma verdade, na tela.
<<<END>>>

<<<ISSUE>>>
id: R8-24
numero: 449
title: [P2] fix(formatacao): tela e exportação passam a formatar o mesmo número com a mesma regra
labels: P2, ui
sources: 06-auditoria-ui.md §3.3/B4 · §3.3/B5 · §8 A3 · A15 · C1
---
## Contexto
O A6 levantou o mapa **completo** dos pontos de formatação de número do app e achou o duplicado que sobrou. Registro importante: **a #281 não foi resolvida, foi mudada de endereço.** `frontend/exportar.ts:10` **não** define mais `const R$ = v.toFixed(2)` — hoje é `import { fmtR$, fmtNum, fmtPct } from './viab-format.js';`. O duplicado de hoje é `frontend/fluxo-tabela.ts`, e a nota do `CLAUDE.md` que ainda descreve o estado antigo é assunto de outra issue (documentação).

## Comportamento atual
**A mesma célula do Fluxo de Caixa tem duas implementações que discordam:**

| | tela — `frontend/fluxo-tabela.ts:33-39` | exportação — `frontend/exportar.ts:167-174` |
|---|---|---|
| decimais | `Math.round(Math.abs(v))` → **0** | `fmtR$(Math.abs(v), false)` → **2** |
| limiar de célula vazia | `Math.abs(v) < 0.5` | `Math.abs(v) < 0.005` |
| percentual | não trata | `pct1(v*100)` |

E há um segundo par divergente: `pct1` (`frontend/exportar.ts:14`) usa `toFixed(1)` **sem separador de milhar**; `fmtPct` (`frontend/viab-format.ts:38-39`) usa `Intl`, **com**. Mais três pontos que montam formatação à mão em vez de chamar o módulo: `frontend/tela-fluxo-receitas.ts:367` (m², deveria ser `fmtM2`), `:585` e `:814` (% derivado, deveria ser `fmtPct`/`fmtPctEntrada`).

## Consequência
- **R$ 1.234,56** → `1.235` na tela, `1.234,56` no PDF/CSV.
- **R$ 0,20** → **célula em branco** na tela, `0,20` no PDF/CSV. **O usuário vê a exportação inventar linhas que a tela nega.**
- **1234,5%** → `1234,5` na exportação, `1.234,5%` na tela. Percentual de quatro dígitos é raro mas existe (ROI de estudo alavancado).

Viola o contrato **C7** do `CLAUDE.md`: *"todo valor monetário resultado de fórmula tem 2 casas decimais — **na apresentação**, na entrada e no motor"*. A tela do Fluxo de Caixa — a peça central do Avançado — não cumpre. A ironia é que `frontend/exportar.ts:162-165` documenta a própria função como *"Fonte ÚNICA para CSV e PDF: as duas exportações têm de mostrar o mesmo texto"*: verdade para as duas exportações, **esqueceu a tela**.

## Comportamento esperado
Um número monetário exibido na tabela de Fluxo de Caixa e o **mesmo** número na exportação em PDF/CSV são **textualmente idênticos** — mesmas casas decimais, mesmo separador, mesmo limiar de célula vazia. O mesmo para percentuais.

## Como corrigir
1. `frontend/fluxo-tabela.ts:33-39` (`celula`) e `frontend/exportar.ts:167-174` (`celulaFx`) passam a chamar **a mesma função**, exportada de `frontend/viab-format.ts` — a fonte única que o contrato C7 já elege. Regra vencedora: **2 casas** e limiar `< 0,005`, que é a do contrato.
2. `pct1` (`frontend/exportar.ts:14`) é apagado e seus chamadores passam a `fmtPct`.
3. Os três `toLocaleString` inline de `frontend/tela-fluxo-receitas.ts:367,585,814` passam a `fmtM2` / `fmtPct` / `fmtPctEntrada`.

⚠️ **Isto muda o texto que a tela do Fluxo de Caixa exibe hoje** (de 0 para 2 casas em toda a tabela) e faz aparecerem células que hoje ficam em branco por valor abaixo de R$ 0,50. É a mudança pretendida, mas o PR precisa declará-la — é a peça central do Avançado.

## Critério de aceite
1. `grep -n "Math.round" frontend/fluxo-tabela.ts` — nenhuma ocorrência em posição de formatação monetária.
2. `grep -n "pct1" frontend/exportar.ts` — **não retorna nada**.
3. `grep -n "toLocaleString" frontend/*.ts` — nenhuma ocorrência fora de `frontend/viab-format.ts` e `frontend/viab-num.ts`.
4. Teste novo que roda os **dois** formatadores de célula sobre a mesma lista de valores — incluindo `1234.56`, `0.20`, `0.004`, `-1234.56`, `0` — e afirma `deepEqual` das saídas.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- `fmtNum(v, 2)` prometer 2 casas e não entregar (`frontend/viab-format.ts:24-25`, `frontend/tela-proforma.ts:453`) — **já é a issue 8-A.1** do bloco 8-A; não duplicar. Esta issue **não** altera a assinatura de `fmtNum`, que tem 5 chamadores com semânticas diferentes.
- O CSS literal do documento de impressão em `frontend/exportar.ts` — exceção legítima do `CLAUDE.md`.
- `abreviar` (`frontend/fluxo-graficos.ts:40-41`) e a máscara de entrada de `frontend/viab-num.ts` — formatações legítimas de outra natureza.
- Corrigir a nota vencida do `CLAUDE.md:471-477` — issue de documentação.

## Relacionadas
- **R8-45** (dois blocos do `CLAUDE.md`) e **R8-57** (tabela de conformidade) — são os **dois textos que descrevem esta issue** e hoje apontam para o endereço errado da #281. Idealmente saem na mesma leva.
<<<END>>>

<<<ISSUE>>>
id: R8-25
numero: 450
title: [P2] fix(financeiro): aba Financeiro do Avançado para de exibir controles que não fazem nada
labels: P2, ui
sources: 06-auditoria-ui.md §5.1 · §4.3 · §8 A2 · A14 · C1
---
> ✅ **Decisão do autor — D-Q08, 2026-08-22, e ela resolve o pior dos dez controles:**
> **ocultar a caixa `sujeito_ret` quando `nivel_analise === 'avancado'`.** Uma **condição de
> render**, e só. **Não** unificar com `considerar_ret`, **não** renomear, **não** migrar:
> nenhum dado muda, nenhuma coluna sai do schema.
>
> Isso fecha o item **3** da seção "Como corrigir" abaixo — a desambiguação `sujeito_ret` ×
> `considerar_ret` — por **supressão**, não por fusão. No Avançado passa a existir **uma** caixa
> de RET, a viva (`considerar_ret`, em Custos → Financeiro); no Preliminar, onde `sujeito_ret`
> tem leitor de verdade (`proforma.ts:245`), nada muda.
>
> ✅ **E os outros oito ganharam destino — D8, 2026-08-22:** **sete saem da tela** e
> **`imposto_percentual` fica visível porém desabilitado**, com nota dizendo que vale só no
> Preliminar. A tabela de **Comportamento esperado** dá o destino um a um. Não sobra controle sem
> decisão nesta issue.

## Contexto
Duas lentes convergiram, com contagens diferentes que o A6 reconciliou contra os motores: o A4 contou 7 controles inertes; o A6 confirmou os 7 como inertes em **todo** o app e acrescentou 2 que são inertes **onde são editáveis**. A documentação que fala em "~25" está contando colunas do `schema.json`, não controles de tela.

## Comportamento atual
Cada controle renderizado em `frontend/tela-financeiro.ts:154-197`, cruzado com quem o lê nos motores (`fluxo-caixa-motor.ts`, `fluxo-shared.ts`, `proforma.ts`, `proforma-avancado.ts`, `funding-motor.ts`, `fluxo-invariantes.ts`):

| # | Controle | render | Lido por | Efeito no Avançado |
|---|---|---|---|---|
| 1 | `taxa_desconto_aa` | `:166` | `tela-fluxo-ver.ts:120,139` | ✅ **vivo** |
| 2 | `sujeito_ret` | `:172-178` | `proforma.ts:245` (**Preliminar**) | 🔴 inerte |
| 3 | `imposto_sobre_permuta_fisica` | `:179-184` | **ninguém** | 🔴 inerte |
| 4 | `regime_tributario` | `:187` | **ninguém** (só comentário em `fluxo-shared.ts:211`) | 🔴 inerte |
| 5 | `imposto_percentual` | `:188` | `proforma.ts:245` (**Preliminar**) | 🔴 inerte |
| 6–10 | `aliquota_pis_pct`, `_cofins_pct`, `_csll_pct`, `_irpj_pct`, `_itbi_pct` | `:189-193` | **ninguém** | 🔴 inertes |

`frontend/tela-financeiro.ts:155` faz `return html\`${nothing}\`` quando `nivel_analise !== 'avancado'` — ou seja, os controles 2 e 5 só têm leitor numa proforma que esta tela nunca alcança. **Total: 7 globalmente inertes, 9 inertes em contexto, de 10.**

Dois rótulos agravam:
- `frontend/tela-financeiro.ts:174` diz **"Sujeito a RET (patrimônio de afetação)"** e grava `sujeito_ret`; `frontend/tela-fluxo-custos.ts:497` diz **"RET (Regime Especial de Tributação — patrimônio de afetação)"** e grava `considerar_ret`. **Dois checkboxes, dois campos, um vivo e um morto, no mesmo estudo Avançado.**
- `frontend/tela-financeiro.ts:188` ("Imposto s/ vendas (se não RET)") e `frontend/tela-premissas.ts:154` ("Imposto (se não RET)") são **o mesmo campo** `imposto_percentual` com **dois rótulos diferentes**.

## Consequência
Dado real dos 6 estudos de Pinguim confirma que a divergência **já está gravada**: os 4 Preliminares têm `sujeito_ret: true` **e** `considerar_ret: false`; os 2 Avançados têm ambos `true`. O par 2↔5 é o **mesmo empreendimento** ("PU 1 Ideia 1") em dois níveis, e os dois campos de RET **divergem entre eles** sem que nada na UI diga que são campos diferentes.

`regime_tributario: 'ret'` está gravado nos 6, com **todas** as `aliquota_*` em `0.00`: o regime não-RET nunca foi exercitado, e não teria efeito se fosse.

O dano não é numérico — é de confiança. O usuário digita a alíquota de IRPJ, salva, vê "sucesso", e nenhum número do estudo muda. E marca "Sujeito a RET" na aba Financeiro achando que está ligando o RET do Avançado, quando a caixa viva é outra, noutra aba.

## Comportamento esperado
Nenhum controle editável da aba Financeiro do Avançado é exibido sem ter leitor no Avançado. O destino dos 9 inertes em contexto está fechado — `sujeito_ret` pela D-Q08 e os outros oito pela D8, ambas de 2026-08-22:

| # | Controle | render | Destino |
|---|---|---|---|
| 2 | `sujeito_ret` | `:172-178` | **oculto** no Avançado (condição de render, D-Q08) |
| 3 | `imposto_sobre_permuta_fisica` | `:179-184` | **sai da tela** |
| 4 | `regime_tributario` | `:187` | **sai da tela** |
| 5 | `imposto_percentual` | `:188` | **fica visível, desabilitado**, com nota *"vale só no Preliminar"* |
| 6–10 | `aliquota_pis_pct`, `_cofins_pct`, `_csll_pct`, `_irpj_pct`, `_itbi_pct` | `:189-193` | **saem da tela** (5) |

**Sete saem, um fica desabilitado, um fica oculto.** `imposto_percentual` é o único que sobrevive à
vista porque é o único com leitor real fora daqui — `frontend/proforma.ts:245` o consome no
Preliminar —, e a nota existe justamente para dizer isso ao usuário em vez de deixá-lo adivinhar por
que o campo não aceita digitação.

**Ligar qualquer um deles ao motor do Avançado continua sendo *feature*, não conserto**, e vira
issue própria por controle. Nada disso remove coluna do `schema.json` — ver *Como corrigir* §4.

E vale para o que sobrar: **um único rótulo por campo**. `imposto_percentual` recebe o mesmo texto nas duas telas.

## Como corrigir
1. Aplicar a tabela de destinos acima em `frontend/tela-financeiro.ts:154-197` — remoção de render para os sete, `?desabilitado` fixo mais nota para `imposto_percentual`, condição de render para `sujeito_ret`.
2. Unificar o rótulo de `imposto_percentual` entre `frontend/tela-financeiro.ts:188` e `frontend/tela-premissas.ts:154`.
3. Desambiguar `sujeito_ret` × `considerar_ret` — ou fundir os dois campos (exige migração e **bump de `versao`**; declare no PR se essa for a escolha), ou rotular cada um pelo nível em que vale.
4. **Não apagar** as colunas do `schema.json` nesta issue: a remoção de coluna passa pelo fluxo canônico com `dados.limparColuna`/`dados.varrerTudo` (shell ≥ 0.53.8) e é decisão à parte.

## Critério de aceite
1. `grep -n "imposto_sobre_permuta_fisica\|regime_tributario\|aliquota_pis_pct\|aliquota_cofins_pct\|aliquota_csll_pct\|aliquota_irpj_pct\|aliquota_itbi_pct" frontend/tela-financeiro.ts` **não retorna nada** — os sete saíram do render.
2. `sujeito_ret` não renderiza quando `nivel_analise === 'avancado'`.
3. `imposto_percentual` **renderiza**, sempre desabilitado nesta tela, acompanhado de nota visível dizendo que vale só no Preliminar. Um teste de frontend cobre o estado desabilitado.
4. Para cada controle que **permanece editável** em `frontend/tela-financeiro.ts` — só `taxa_desconto_aa` — existe pelo menos um leitor em `frontend/fluxo-caixa-motor.ts`, `frontend/fluxo-shared.ts`, `frontend/proforma-avancado.ts`, `frontend/funding-motor.ts` ou `frontend/tela-fluxo-ver.ts`, comprovável por `grep -n "<campo>" frontend/*.ts` no PR.
5. `grep -n "imposto_percentual" frontend/tela-financeiro.ts frontend/tela-premissas.ts` — os dois rótulos são **textualmente idênticos**.
6. Nenhuma coluna sai do `schema.json`, não há migração → **a `versao` não bumpa**.
7. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- **Implementar** o regime não-RET (PIS/COFINS/CSLL/IRPJ/ITBI) no motor do Avançado — é feature, e é grande.
- `correcao_estoque` (`frontend/tela-fluxo-receitas.ts:521,534`), controle vivo e inerte da **outra** tela — já é issue do bloco 8-B.
- Remover colunas do `schema.json`.

## Relacionadas
- **R8-15** (docs: funding instalado) — delimita os **7 campos** genuinamente inertes; se o destino deles mudar aqui, aquele texto muda junto.
- **R8-59** (`correcao_estoque`) — mesma família — controle vivo sem leitor —, outra tela.
<<<END>>>

<<<ISSUE>>>
id: R8-26
numero: 451
title: [P2] fix(benchmarks): a régua lê os 9 benchmarks configurados e sinaliza valor fora da escala
labels: P2, ui
sources: 05-conferencia-numerica.md §D11 · §D12 · C1
---
## Contexto
`GET /benchmarks?tipo_empreendimento=incorporacao` devolve **9 benchmarks**, 5 deles com faixas de medidor configuradas e `atualizado_em = 2026-08-21` — ou seja, **calibradas pelo autor no dia anterior à auditoria**. O A5 cruzou a régua com os 6 estudos da instância.

## Comportamento atual
**O `MAPA` de indicador→benchmark é literalmente `{ custo_obras_vgv, margem_liquida }`**, nos dois únicos lugares que desenham medidor: `frontend/tela-resumo.ts:247-250` (Avançado) e `frontend/tela-graficos.ts:194-196` (Preliminar). Todo benchmark fora do mapa é descartado em `.filter((m) => m !== null)`, **silenciosamente**.

| Campo | Meta | Medidor (min/f1/f2/max) | Lido pelo app? |
|---|---:|---|---|
| `custo_obras_vgv` | 35,00 | 20 / 25 / 30 / 40 | ✅ |
| `margem_liquida` | 20,00 | 15 / 25 / 35 / 45 | ✅ |
| `resultado_final` | 25,00 | 12 / 18 / 25 / 35 | ❌ |
| `roi` | 15,00 | 11 / 18 / 22 / 29 | ❌ |
| `margem_bruta` | 30,00 | 30 / 40 / 50 / 70 | ❌ |
| `custo_obras`, `preco`, `permuta_fisica`, `permuta_financeira` | 0,00 | — | ❌ |

E `montarMedidor` (`frontend/medidor-faixas.ts:16-40`) devolve `min`/`max` fixos e **não clampa nem sinaliza** valor fora do intervalo: o ponteiro encosta no limite e **nada avisa que ele estourou**.

## Consequência
Os 3 primeiros ❌ foram **configurados com faixa completa** e não aparecem em tela nenhuma. O painel de estudos até mostra uma coluna **ROI** (`frontend/tela-dashboard.ts:406`) — sem nenhuma comparação com o benchmark `roi` que existe e está calibrado.

E os 2 medidores que existem estão **fora de escala nos 6 estudos**:

`custo_obras_vgv` — medidor 20–40%:

| Estudo | Valor | Dentro? |
|---|---:|---|
| 1 · PU 2 Esquadra | 70,32% | ❌ +30,32 pp acima do máx. |
| 2 · PU 1 Ideia 1 | 69,83% | ❌ |
| 3 · PU 3 Zoom | 70,32% | ❌ |
| 4 · PU 4 Reis | 70,70% | ❌ |
| 5 (Avançado) | 55,40% | ❌ |
| 6 (Avançado) | 53,03% | ❌ |

`margem_liquida` — medidor 15–45%: estudos 1, 3 e 4 abaixo do mínimo (14,67% / 14,73% / 14,46%); o 2 passa por 0,05 pp.

**Nos 6 estudos da instância, pelo menos um dos dois medidores está fora da escala — e em 3 deles os dois.** A régua oficial não cobre nenhum dos projetos que ela deveria julgar, e o usuário vê um ponteiro encostado no fim da escala sem saber se é 40% ou 70%.

## Comportamento esperado
1. Todo benchmark configurado com faixa completa e com indicador correspondente calculado pelo app **é exibido**; benchmark sem indicador correspondente é **ignorado com aviso no console/log**, não em silêncio.
2. Valor fora do intervalo `[min, max]` do medidor é **sinalizado visualmente** — o número exibido continua sendo o real, e a peça diz que ele está fora da escala em vez de fingir que encostou no limite.

## Como corrigir
- Substituir o `MAPA` literal de `frontend/tela-resumo.ts:247-250` e `frontend/tela-graficos.ts:194-196` por uma tabela **única**, compartilhada pelas duas telas, cobrindo `resultado_final`, `roi` e `margem_bruta` além dos dois atuais. `custo_obras`, `preco`, `permuta_fisica` e `permuta_financeira` estão com meta `0,00` e sem faixa — decidir se entram (o app calcula essas grandezas) ou se ficam declaradamente fora.
- `frontend/medidor-faixas.ts:16-40` passa a devolver o estado "fora da escala" junto com o valor, e a tela o pinta.
- ⚠️ **`margem_bruta` entra em etapa própria, depois da #453 — não junto com os outros dois.**
  `frontend/proforma.ts:315` calcula `receitaLiquida / vgv * 100` = **90%**, contra um medidor 30–70:
  ligá-lo hoje exibiria um ponteiro estourado permanente. A **#453** (R8-28) renomeia o campo — pela
  decisão **D3** do autor, de 2026-08-22, é conserto de **nome**, não de fórmula, e nenhum número
  muda. A ordem é, portanto:

  | Etapa | O que entra | Depende de |
  |---|---|---|
  | **1** — esta issue | `resultado_final` e `roi` no mapa, mais o estado "fora da escala" | nada |
  | **2** — depois que a **#453** mergear | `margem_bruta` no mapa, contra o indicador já renomeado | **#453** |

  A etapa 1 **não espera** pela #453 e fecha sozinha; a 2 é um diff pequeno, de uma linha no mapa
  compartilhado, e pode sair na própria #453 ou logo atrás dela.
- A faixa dos dois medidores existentes estar mal calibrada para a realidade dos projetos é decisão do autor (a régua é dele, e ele a calibrou em 2026-08-21) — esta issue **não** mexe nos valores de faixa, só faz o app parar de mentir sobre eles.

## Critério de aceite
1. `grep -n "MAPA" frontend/tela-resumo.ts frontend/tela-graficos.ts` — uma definição só, importada nas duas telas.
2. Teste: dado o payload de 9 benchmarks da instância, a função de mapeamento devolve medidor para todos os que têm indicador correspondente **na etapa 1** (`custo_obras_vgv`, `margem_liquida`, `resultado_final`, `roi`), e **lista** os descartados — `margem_bruta` entre eles, com o motivo, até a **#453** mergear.
3. Teste: `montarMedidor` com valor 70,32 num medidor 20–40 devolve estado "fora da escala" (e não um ponteiro em 40 indistinguível de um valor 40).
4. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
- Recalibrar as faixas dos benchmarks — é dado do autor, editável pela tela de configuração.
- Corrigir a definição de `margemBrutaPct` — é a **#453**, pré-requisito só da etapa 2.
- Adicionar indicadores novos ao app.

Sem-fechamento: #453 pré-requisito da etapa 2 (ligar `margem_bruta` ao mapa); a etapa 1 desta issue não depende dela

## Relacionadas
- **R8-28 · #453** (`margemBrutaPct`) — **pré-requisito datado** da etapa 2, e só dela: ligar `margem_bruta` antes do rename exibiria 90% contra um medidor 30–70. Pela D3 o rename não muda número nenhum, então a etapa 2 é diff de uma linha.
- **R8-18** (uma definição por rótulo) — a régua julga `margem_liquida`, e hoje há quatro.
<<<END>>>

<<<ISSUE>>>
id: R8-27
numero: 452
title: [P2] fix(api): campos derivados param de ser persistidos com valor que não é o efetivo
labels: P2, ui, docs
sources: 05-conferencia-numerica.md §D7 · §D8 · 06-auditoria-ui.md §5.3/C7 · C1
---
## Contexto
Três achados da mesma família, medidos contra os dados reais de Pinguim: colunas que o app grava com um valor e o motor calcula com outro. Nenhum deles muda número **hoje**, porque o motor nunca lê o campo persistido — o dano é para **qualquer consumidor da API** (exportação, BI, IA, ou o próximo agente que auditar o app pela API, como aconteceu nesta rodada).

## Comportamento atual

**1. `pos_obra.pct` gravado é sempre 0; o motor usa 65%.**
As 6 linhas de receita da instância gravam `blocos: [..., { evento: 'pos_obra', pct: 0 }]` (`frontend/tela-fluxo-receitas.ts:536`, comentado *"derivado no motor"*), enquanto `pctPosObraDerivado` (`frontend/fluxo-shared.ts:324-326`) usa **65,00%** (estudo 5) e **65,53%** (estudo 6). **Δ de 65 pontos percentuais entre o que a API devolve e o que o motor aplica, nas 6 linhas.**

**2. Σ legado (`entrada` + `parcelas`) ≠ 100% em 3 das 6 linhas.**

| Estudo | Linha | Σ entrada + parcelas | Σ componentes |
|---|---|---:|---:|
| 5 | Tabela longa (80%) | **30,00%** | 100,00% |
| 6 | À vista (10,81%) | **30,00%** | 100,00% |
| 6 | Tabela longa (80,15%) | **45,00%** | 100,00% |

O resto (70% / 70% / 55%) é o Repasse **derivado** — `pctRepasseDerivado` = `100 − entradas − parcelas`.

**3. `fluxo_pagamento.ret` sobrevive por linha depois de a RET virar global.**
As 3 linhas do estudo 5 trazem `"ret": { "pct": 4, "ativo": false }` enquanto o estudo tem `considerar_ret: true, ret_pct: 4`. A #346 tornou o RET global (`frontend/fluxo-caixa-motor.ts:173`), o modal já diz *"RET: controle global do estudo, em Custos → Financeiro"* (`frontend/tela-fluxo-receitas.ts:736`), mas `formularioPagamento` (`frontend/fluxo-pagamento-editor.ts:36`) continua **lendo e regravando** o sub-objeto morto.

## Consequência
Quem ler `pos_obra.pct` pela API lê **zero** e conclui que não há venda pós-chaves — quando são **dois terços das vendas**. Quem conferir `fluxo_pagamento.entrada/parcelas` acusa buraco de 70/70/55 pontos percentuais que não existe. Quem ler `fluxo_pagamento.ret.ativo: false` num estudo com `considerar_ret: true` conclui que a linha não tem RET, quando tem.

Nenhum dos três dá erro, e é isso que os torna perigosos: **produzem um número plausível.** O A6 registrou o terceiro como *"passagem inofensiva hoje; armadilha para quem abrir o JSON e acreditar nele"*.

## Comportamento esperado
Um campo persistido ou (a) carrega o valor **efetivo** que o motor usa, ou (b) **não é persistido**. Não existe terceira opção: persistir um placeholder com valor plausível é pior que não persistir.

Para os três casos:
1. `pos_obra.pct` — ou grava o derivado (65,00% / 65,53%), ou o bloco `pos_obra` sai do JSON e o consumidor sabe que é derivado pela ausência.
2. `entrada`/`parcelas` — ou o JSON passa a carregar o repasse derivado explicitamente, ou documenta-se no contrato da rota que a soma dos dois **não** fecha 100% por construção.
3. `fluxo_pagamento.ret` — o sub-objeto para de ser gravado; o leitor de `frontend/fluxo-pagamento-editor.ts:36` some junto.

## Como corrigir
- `frontend/tela-fluxo-receitas.ts:536` grava o valor devolvido por `pctPosObraDerivado` em vez de `0`, **ou** omite o bloco. A escolha muda o contrato da rota — declare qual no PR.
- `frontend/fluxo-pagamento-editor.ts:36` para de ler `fp.ret`, e `fluxoPagamentoParaSalvar` para de gravá-lo. ⚠️ **Coordenar com a issue do modal de Pagamento** — as duas mexem no mesmo arquivo e a issue do modal é a que tem o teste de no-op; mergeá-las fora de ordem quebra aquele `deepEqual`.
- Se algum dos três exigir tocar `schema.json` ou migração, o PR **bumpa a `versao` do `manifesto.json`** (regra do `CLAUDE.md` § Versão do manifesto). Pelo que foi lido, os três são conteúdo de coluna `json` — **sem migração**.

## Critério de aceite
1. Teste: para uma linha com absorção distribuída, o `pct` gravado no bloco `pos_obra` é `=== pctPosObraDerivado(...)` — ou o bloco não existe no JSON.
2. `grep -n "\.ret" frontend/fluxo-pagamento-editor.ts` — nenhuma leitura de `fluxo_pagamento.ret`.
3. Reexecutar `scripts/conferir-estudo.ts 5 6` depois de uma escrita simulada: `pos_obra.pct` deixa de ser 0 num estudo que vende 65% no pós-chaves.
4. O contrato da rota de receitas documenta explicitamente quais campos são derivados.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- `orcamento_valor` congelado quando existe `orcamento_valor_canonico` — mesma família, causa diferente, issue própria.
- O modal de Pagamento **destruir** `componentes` — issue própria e **de maior prioridade**.
- `correcao_estoque`, campo persistido, editável e sem leitor — já é issue do bloco 8-B.

## Relacionadas
- **R8-06** (modal de Pagamento) — ⚠️ **mesma função, mesmo arquivo**; aquela tem o teste de no-op, e mergear esta antes quebra o `deepEqual`. Ordem: R8-06 primeiro.
- **R8-17** (`orcamento_valor`) — mesma família, causa diferente.
<<<END>>>

<<<ISSUE>>>
id: R8-28
numero: 453
title: [P2] fix(proforma): margemBrutaPct deixa de chamar de margem o que é "1 − deduções"
labels: P2, motor
sources: 05-conferencia-numerica.md §D13 · §D11 · C1 · conferência contra a EVI Urbitá, 2026-08-22
---
## Contexto
Achado do A5 ao cruzar os 9 benchmarks configurados na instância com o que o app calcula. Não é exibido hoje (o app só lê 2 dos 9 benchmarks), mas **é a definição que qualquer tela futura herdaria** — e a issue que liga os 9 benchmarks esbarra nele.

## Comportamento atual
`frontend/proforma.ts:315`:

    margemBrutaPct = receitaLiquida / vgv * 100

Isso é **"1 − deduções"**, não margem. Não há custo nenhum no numerador.

## Consequência
Medido nos 6 estudos: **90,00%** nos estudos 1–5 e **90,30%** no 6 — que é exatamente `100% − (4% RET + 5% corretagem + 1% marketing)` e `100% − (4,12% + 4,60% + 1,10%)`.

O benchmark `margem_bruta` da instância pede **meta 30% com medidor 30–70**. O valor **nasce 20 pontos percentuais acima do teto da escala** e é **inatingível por construção**: nenhum projeto real poderia sair do intervalo, porque o número não mede o que o benchmark julga. Qualquer tela que passe a exibir esse indicador exibirá 90% para todo projeto, sempre.

## A conferência contra a EVI Urbitá
O autor pediu que a taxonomia fosse conferida contra a planilha antes de qualquer decisão. **Foi
conferida em 2026-08-22**, linha a linha da PROFORMA INCORPORAÇÃO:

| Linha da EVI Urbitá | Campo do app hoje | Veredito |
|---|---|---|
| `Receita bruta (VGV)` | `vgv` | ✅ mesmo conceito |
| `Receita líquida` | `receitaLiquida` | ✅ |
| `Custo direto total` | `custoDireto` | ✅ |
| `Custo indireto total` | `custoIndireto` | ✅ |
| `Resultado` | `resultado` + `margemLiquidaPct` | ✅ |
| `Resultado + Perm. Financ.` | — | ❌ ausente no app |
| `Resultado + Permutas` | — | ❌ ausente no app |
| % VGV da linha `Receita líquida` (81,03% no print) | `margemBrutaPct` | ⚠️ **nome errado** |

**Duas conclusões, e elas fecham a issue:**

1. **A EVI não tem "Receita operacional" nem "Resultado líquido".** A espinha dela é exatamente a do
   app — VGV, Receita líquida, Custo direto, Custo indireto, Resultado. Não há camada intermediária
   faltando, e nenhum nome de linha precisa mudar. O que falta no app são as **duas linhas de fecho**
   com permuta, que já são a **R8-02**.
2. **`margemBrutaPct` não é margem, e a EVI também não chama isso de margem.** `frontend/proforma.ts:315`
   calcula `receitaLiquida / vgv * 100` — que é, letra por letra, a coluna **"% VGV"** da linha
   `Receita líquida` da planilha (81,03% no print). É um percentual de dedução, não uma margem. O
   erro é só o **nome**.

## Comportamento esperado
**Renomear, não mudar fórmula.** `margemBrutaPct` passa a se chamar o que ele calcula — p. ex.
`receitaLiquidaSobreVgvPct` —, e o rótulo de tela correspondente vira "Receita líquida / VGV" (ou
"% VGV", como na planilha).

**Nenhum número muda.** A fórmula de `proforma.ts:315` fica intacta; o que sai é a palavra "margem"
de cima de um número que não mede margem.

Uma **margem bruta de verdade**, se for desejada, é **issue própria**, aberta com a fórmula que o
autor declarar — a definição de margem bruta é conhecimento de negócio, não de código, e
`docs/viabilidade/inteligencia-evi-incorporacao.md` é consultivo, não governa o runtime.

## Como corrigir
1. Renomear o campo em `frontend/proforma.ts:315` e em todos os chamadores.
2. Ajustar os rótulos de tela que hoje dizem "margem bruta".
3. O benchmark `margem_bruta` da instância — meta 30%, medidor 30–70 — **não** passa a ser alimentado
   por este campo. Enquanto não existir uma margem bruta de verdade, ele fica sem fonte, e a issue
   dos benchmarks precisa saber disso.

## Critério de aceite
1. `grep -rn "margemBrutaPct" frontend/*.ts` → **zero ocorrências**; o nome novo descreve a fórmula.
2. Teste travando `receitaLiquida / vgv * 100` sob o nome novo, com um caso conhecido.
3. **Nenhum valor exibido muda** nos estudos 1–6: 90,00% nos estudos 1–5 e 90,30% no 6 continuam
   sendo os mesmos números, agora sob o rótulo certo.
4. Nenhum rótulo de tela chama de "margem" o que é "% VGV".
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- **Criar a margem bruta de verdade.** Issue própria, com a fórmula declarada pelo autor.
- Ligar o benchmark `margem_bruta` na tela — issue própria, e ela **não** pode usar este campo.
- As **outras** definições divergentes (margem líquida, VGV, ROI) — issue própria.
- Recalibrar a meta e as faixas do benchmark, que são dado do autor.
- As duas linhas de fecho com permuta que faltam na proforma — são a **R8-02**.

## Relacionadas
- **R8-26** (benchmarks) — **depende** desta para o campo `margem_bruta`.
- **R8-18** (uma definição por rótulo) — as outras definições divergentes.
<<<END>>>

<<<ISSUE>>>
id: R8-29
numero: 454
title: [P2] fix(textos): tirar da tela as referências internas do repositório e o vocabulário do Capital Stack
labels: P2, ui, docs
sources: 06-auditoria-ui.md §4.2 · §8 A8 · A4 §3 A6 · A4 §3 A7 · C1 · C4
---
## Contexto
O A6 varreu `capital.?stack`, `waterfall`, `preferred.?equity`, `prioridade_pagamento` e `capital_giro` em `frontend/`, `backend/`, `schema.json` e `migracoes/`, separando **o que o usuário vê** do que é comentário de código — distinção que auditorias anteriores não faziam.

## Comportamento atual
**Visível ao usuário — 3 ocorrências:**

| `arquivo:linha` | Texto | Problema |
|---|---|---|
| `frontend/tela-fluxo-ver.ts:295` | "Este estudo não tem camadas de **Capital Stack**: sem funding, o Fluxo de Caixa real é igual ao Livre." | Conceito **apagado** pela reescrita do item 48 (#355). Hoje chama-se **Funding**, e são operações, não camadas |
| `frontend/tela-fluxo-ver.ts:294` | "…leem o Fluxo de Caixa Livre (**funding-capital-stack.md §8.1**, para manter comparabilidade…)" | Cita um **arquivo interno do repo** — ADR histórico — no corpo do texto da tela |
| `frontend/tela-fluxo-receitas.ts:810` | "…é pago de uma vez, sempre no 1º mês após o fim da obra **(#345)**." | **Número de issue** em texto de ajuda visível |

**Visível como tooltip nativo (`title=`) — 2 ocorrências:**

| `arquivo:linha` | Texto |
|---|---|
| `frontend/tela-fluxo-custos.ts:766` | "…não segue curva nem evento próprio **(#238)**" |
| `frontend/tela-fluxo-custos.ts:774` | "…disponível para auditoria **(#238)**" |

## Consequência
O usuário lê o nome de um conceito que **não existe mais no app** ("Capital Stack"), o caminho de um arquivo Markdown do repositório e números de issue do GitHub. Não quebra nada e não muda nenhum número — é dano de credibilidade da interface, e o único achado desta família que chega à tela.

## Comportamento esperado
Nenhum texto visível ao usuário — incluindo `title=` — cita nome de arquivo do repositório, número de issue ou conceito aposentado. O conteúdo da explicação **permanece**; só a referência interna sai.

Redações sugeridas:
- `frontend/tela-fluxo-ver.ts:295` — "Este estudo não tem operações de **Funding**: sem funding, o Fluxo de Caixa real é igual ao Livre."
- `frontend/tela-fluxo-ver.ts:294` — manter a explicação de comparabilidade, retirar a citação do `.md`.
- As três referências a issue (`(#345)`, `(#238)` ×2) — apagar o parêntese, manter a frase.

## Como corrigir
Edição de texto nas 5 linhas. Os **12 comentários de código** que citam o mesmo vocabulário (`frontend/fluxo-invariantes.ts:326-336`, `frontend/fluxo-shared.ts:552`, `frontend/fluxo-tabela.ts:633`, `frontend/funding-motor.ts:7,10,154,295,650`, `frontend/proforma-avancado.ts:67`, `frontend/tela-avancado.ts:94`, `frontend/tela-financeiro.ts:13,22,51,52`, `frontend/tela-fluxo-ver.ts:55,56,63`, `frontend/tela-funding.ts:25,26,27,146,612`, `frontend/viabilidade-api.ts:257`, `backend/rotas/funding.ts:9`) **não devem ser apagados** — são o registro de por que o modelo mudou, e o A6 recomendou explicitamente mantê-los.

## Critério de aceite
1. `grep -rn "Capital Stack" frontend/*.ts` — nenhuma ocorrência **dentro de template literal renderizado** (comentário pode ficar).
2. `grep -rnE "\(#[0-9]{2,4}\)" frontend/*.ts` — nenhuma ocorrência em posição de conteúdo de texto ou de `title=`.
3. `grep -rn "\.md" frontend/*.ts` — nenhuma ocorrência em texto visível.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Os 12 comentários de código listados acima — ficam.
- A tabela órfã `avancado_capital_instrumentos` em `schema.json:380-394` — resíduo estrutural, decisão de schema, issue própria.
- O bloco "Definições" órfão do modal de Receitas — **já é a issue 8-A.5** do bloco 8-A; não duplicar.

---

## Fusão — o vocabulário do Capital Stack, pela lente documental

A fatia C4 varreu o mesmo vocabulário pelo ângulo documental (`A4 §3 A6`/`A7`) e apontou **a mesma**
linha `frontend/tela-fluxo-ver.ts:295` — duas lentes independentes, o mesmo `arquivo:linha`. Ela
acrescenta duas coisas que a varredura de UI não tinha: o critério de **tempo verbal** para os
comentários (os que descrevem a substituição ficam; os que descrevem o Capital Stack como
**presente** mudam) e a ocorrência em `schema.json:384`, que é a única fonte do repositório onde
`capital_giro` aparece como conceito válido.

⚠️ **A fusão eleva a prioridade de P3 para P2** — a redação da C4 já a trazia assim, e o motivo é o
segundo achado: `schema.json:384` não é cosmético, é a armadilha que faz um agente concluir que o
app tem um tipo que o backend rejeita.

### Comportamento atual
- **Visível ao usuário:** `frontend/tela-fluxo-ver.ts:295` — *"Este estudo não tem camadas de
  **Capital Stack**: sem funding, o Fluxo de Caixa real é…"*. É a única ocorrência que o usuário lê.
- **Em comentário** (não visível, mas desorienta quem lê o código): `frontend/tela-fluxo-ver.ts:56`
  e `:63`, `frontend/tela-financeiro.ts:13` e `:22`, `frontend/fluxo-tabela.ts:633`,
  `frontend/proforma-avancado.ts:67`, `frontend/tela-avancado.ts:94`, `frontend/tela-funding.ts:25`,
  `frontend/viabilidade-api.ts:257`, `frontend/fluxo-apresentacao.test.ts:170`.
- **No schema:** `schema.json:380-393` ainda declara `avancado_capital_instrumentos`, com `tipo` em
  `["financiamento_producao","capital_giro","preferred_equity","sponsor_equity"]` (`:384`) — o
  vocabulário do modelo apagado.

### Consequência
O texto de `:295` mostra ao usuário o nome de um conceito que a app não tem mais — o mesmo tipo de
resíduo que o item 41 da lista de bugs relatou como *"a continuação da tabela com o título que
começa com Programa Financeiro (Capital Sta…)"*.

E o `schema.json:384` é **a única fonte no repositório onde `capital_giro` aparece como conceito
válido** — exatamente o termo que um agente investigando capital de giro vai procurar primeiro, e
que o levará a concluir que o app tem um tipo que o backend rejeita
(`backend/rotas/funding.ts:43`, `backend/rotas/funding.test.ts:26`).

### Comportamento esperado
- O texto de tela usa o vocabulário vigente: **funding** / **operações de funding**.
- Os comentários que descrevem a substituição (#355) podem e devem citar "Capital Stack" — são
  história e ajudam. Os que ainda descrevem o Capital Stack como **presente** mudam de tempo verbal.
- `avancado_capital_instrumentos` **permanece** no `schema.json` (decisão 4 do autor: guarda o dado
  migrado pela `019`, e as migrações `019`/`028`/`029` a leem — apagá-la quebra a cadeia), mas passa
  a estar **documentada como tabela histórica** num lugar que alguém leia.

### Como corrigir
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

### Critério de aceite
1. `grep -rn "Capital Stack" frontend/ | grep -v "^\S*:[0-9]*: *[/*]"` não retorna nenhuma
   ocorrência em template literal renderizado ao usuário.
2. `docs/viabilidade/funding-capital-stack.md` explica por que `avancado_capital_instrumentos`
   continua no schema e que `capital_giro` ali não é um tipo válido.
3. `schema.json` **não** é alterado (nem por comentário — `node scripts/guard-json.mjs` verde).
4. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Relacionadas
- **R8-54** (etiquetar `avancado_capital_instrumentos`) — a ocorrência de `schema.json:384` é tratada lá, com o metadado `descricao`; **não** escreva comentário `//` no `schema.json`.
- **R8-41** (rótulo "Dívida / Capital de giro") — a outra metade do mesmo vocabulário; as duas tocam `frontend/tela-funding.ts` e `tela-fluxo-ver.ts`.
<<<END>>>

<<<ISSUE>>>
id: R8-30
numero: 455
title: [P2] feat(fluxo-pagamento): permitir sinal na contratação por componente parcelado
labels: P2, ui, motor
sources: R-A2-02 · R-A2-01 · C2
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

## Relacionadas
- **R8-03** (campo de taxa) — mesmo modal, mesmo adaptador (`componentesDoLegado`); saem juntas ou em sequência declarada.
- **R8-06** (modal para de reescrever) — `sinalPct` é um dos campos só-canônicos que o transplante tem de preservar.
<<<END>>>

<<<ISSUE>>>
id: R8-31
numero: 456
title: [P2] feat(resultado): mostrar juros de clientes, carteira máxima e exposição máxima como KPIs de tela
labels: P2, ui
sources: R-A2-12 · E-A2-10 · R-A2-01 · C2
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

## Relacionadas
- **R8-03** (campo de taxa) — ⚠️ **ordem importa**: hoje os três KPIs leriam zero em qualquer estudo que tenha passado pelo modal.
- **R8-24** (formatação) — usar `fmtR$`, **não** criar uma terceira função local.
<<<END>>>

<<<ISSUE>>>
id: R8-32
numero: 457
title: [P2] feat(receitas): expor velocidade de vendas em área, unidades e estoque, com VSO
labels: P2, motor
sources: R-A2-10 · E-A2-04 · E-A2-08 · C2
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

## Relacionadas
- **R8-08** (`PATCH` de tipologias) — **pré-requisito de dado**: `234 + 42 > 234` faria a asserção acusar `−42` antes de qualquer absorção.
- **R8-04** (descarte silencioso) — este livro de estoque é a **camada 2** do mesmo invariante: foi a ausência dele que deixou R$ 2.007.856,95 sumirem.
<<<END>>>

<<<ISSUE>>>
id: R8-33
numero: 458
title: [P2] fix(receitas): tornar visível qual motor de recebíveis cada linha está usando
labels: P2, ui, motor, docs
sources: R-A2-21 · E-A2-03 · 04 §6.3 E6 · C2
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

## Relacionadas
- **R8-14** (docs do motor de safras) — o parágrafo de `padrao-incorporacao.md:1026-1033` citado aqui é da mesma família de mentira documental.
- **R8-06** (modal para de reescrever) — é o "Aplicar" que converte a linha para o canônico; a badge é o que torna isso visível.
<<<END>>>

<<<ISSUE>>>
id: R8-34
numero: 459
title: [P2] feat(receitas): separar a base da permuta financeira em dois flags de dedução independentes
labels: P2, motor, backend
sources: R-A2-15 · C2
---
> 📸 **Evidência visual, acrescentada em 2026-08-22.** Esta issue nasceu das fórmulas
> (`Premissas!N17`/`N18` e `cfINC!BN`). O print embutido na aba **#43** da
> `lista bugs 20260807.xlsx` — a PROFORMA INCORPORAÇÃO da EVI — mostra os **dois checkboxes**
> na tela do autor: *"Deduzir das permutas financeiras: ☑ corretagem ☑ impostos"*. São dois
> controles independentes, lado a lado, exatamente como a issue propõe. Não é inferência de
> fórmula: é a interface que ele usa.

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

## Relacionadas
- **R8-40** (Receita líquida de proforma) — as **duas noções de líquida** que esta issue separa são as mesmas que aquela nomeia.
- **R8-48** (`question(corretagem)`) — a decisão sobre a permuta **física** é a pergunta irmã desta, que trata da **financeira**.
<<<END>>>

<<<ISSUE>>>
id: R8-35
numero: 460
title: [P2] fix(receitas): resíduo de parcelamento sem prazo deve rolar para o repasse, não virar caixa imediato
labels: P2, motor, ui
sources: R-A2-07 · C2
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

## Relacionadas
- **R8-03** (campo de taxa) — o resíduo transferido para o `concentrado` é capitalizado **pela taxa do componente**; sem campo, o efeito é nulo.
<<<END>>>

<<<ISSUE>>>
id: R8-36
numero: 461
title: [P2] feat(receitas): permitir fração do repasse antecipada na assinatura
labels: P2, motor, ui
sources: R-A2-13 · C2
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

## Relacionadas
- **R8-03** (campo de taxa) — mesmo componente `concentrado`, mesma capitalização.
<<<END>>>

<<<ISSUE>>>
id: R8-37
numero: 462
title: [P2] feat(receitas): ponderar preço de tabela entre área fechada e área aberta com deflator
labels: P2, motor, backend
sources: R-A2-16 · C2
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
id: R8-38
numero: 463
title: [P2] feat(testes): trazer a EVI Urbitá para o repositório como fixture golden de recebíveis
labels: P2, motor
sources: E-A2-09 · R-A2-01 · R-A2-18 · C2
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

## Relacionadas
- **R8-03** (campo de taxa) — o fixture prova a matemática **independentemente** da UI, injetando `taxaMensal` no contrato canônico.
- **R8-08** (`PATCH` de tipologias) — uma das quatro coisas que faltam para a §3 ser verificável em instância.
- **R8-44** (cadastrar em Pinguim) — a alternativa **cara** que esta issue existe para não depender.
<<<END>>>

<<<ISSUE>>>
id: R8-39
numero: 464
title: [P2] feat(auditoria): inventariar quantos planos têm juros de tabela configurados
labels: P2, docs
sources: E-A2-01 · E-A2-06 · R-A2-01 · `git log` 2026-08-22 · C2
---
> 🔎 **A pergunta que motivava metade desta issue FOI RESPONDIDA — pelo `git log`, em
> 2026-08-22 —, e a resposta é diferente para os dois casos.** O escopo encolheu: o que sobra é
> o **inventário**, que continua valendo por si.
>
> - **A curva `personalizado` do estudo 6 veio da tela.** O commit `2c0e793` tinha o seletor com
>   `{ id: 'personalizado', titulo: 'Personalizado', desc: 'Percentual específico para cada
>   mês.' }` e uma linha por mês. A UI **perdeu** o modo depois; o motor continuou lendo.
>   **Não é caminho de escrita paralelo — é UI amputada**, e isso reclassifica o conserto do
>   modal de Absorção de *feature* para **regressão**.
> - **A taxa de 12,5% do estudo 5 nunca pôde vir da tela.** `taxaMensal` não aparece em
>   `frontend/tela-fluxo-receitas.ts` em **commit nenhum** da história. Foi escrita **pela API,
>   direto** — e a assinatura está nos `rotulo`, escritos à mão (`"…juros 12,5% a.a."`), contra
>   o carimbo automático `"ao longo da obra (legado)"` do estudo 6.
>
> **O que isso muda:** não há mistério de procedência a investigar, e o item 2 do "Comportamento
> esperado" abaixo está respondido. **O que isso NÃO muda:** ainda não se sabe **quantos**
> estudos têm `taxaMensal ≠ 0` — e é esse número que dimensiona o estrago do modal. O
> inventário fica.

## Contexto
Dois dados de qualidade-EVI existem em Pinguim, e a procedência dos dois foi apurada no
`git log` (ver a nota acima): um veio de uma **UI que existiu e foi amputada**, o outro **da API**.

- **estudo 5** — `taxaMensal: 0.0098636`, que é `(1,125)^(1/12) − 1` até a 7ª casa, exatamente
  `Premissas e Resultados!H14`. `fluxoPagamentoParaSalvar`
  (`frontend/fluxo-pagamento-editor.ts:82-93`) **nunca** gravou isso: `componentesDoLegado`
  escreve `taxaMensal: 0` nos quatro caminhos, e o modal não tem campo
  (`frontend/tela-fluxo-receitas.ts:740-820`).
- **estudo 6** — `absorcao.modo: 'personalizado'` com 43 meses e `aplicado: true`.
  `_absorcaoJson` (`frontend/tela-fluxo-receitas.ts:530-542`) grava **sempre**
  `modo: 'distribuido'`. O motor **lê** `personalizado` (`frontend/fluxo-shared.ts:373-379`), mas
  a tela **deixou de** o produzir — ela sabia, no commit `2c0e793`.

Os dois casos mais sofisticados da instância são os que **mais se aproximam do modelo da EVI** —
e nenhum dos dois é alcançável pela interface de hoje.

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
2. ~~Pergunta ao autor sobre o caminho de escrita paralelo~~ — **respondida pelo `git log`** (ver
   a nota do topo). O que **permanece** dela, e é conclusão, não pergunta:
   - **a escrita direta na API é um cliente de fato do contrato canônico** e nenhum teste a
     representa — o dado do estudo 5 é a prova de que existe;
   - as issues de "feature ausente" (campo de taxa, curva personalizada editável) **mudam de
     natureza**: não são features novas, são **a UI alcançando um modelo já em uso** — no caso da
     curva, **recuperando** um modo que a própria tela já teve;
   - o dano do modal recai sobre trabalho de alguém, e não sobre dado de teste.

## Como implementar
Estender `scripts/conferir-estudo.ts`, que já está na árvore e já fala com a API. Somente `GET`.
Nenhuma escrita, nenhuma migração, nenhum bump da `versao`.

## Critério de aceite
Tabela anexada à issue com, por instância e por estudo: nº de linhas de receita, nº com
`taxaMensal ≠ 0`, nº com `sinalPct ≠ 0`, nº com `modo: 'personalizado'`, nº ainda no ramo legado
(sem `componentes`). **Só isso** — a procedência dos dois casos já está apurada pelo `git log` na
nota do topo, e não é mais critério.

## Fora de escopo
- Não altera nenhum dado. Não altera nenhum código de produção.
- Não decide o que fazer com o resultado — mas **é pré-requisito declarado** das issues de taxa e
  de pareamento: decidir sem o inventário é o risco que ela existe para eliminar.

## Relacionadas
- **R8-03** (campo de taxa por Grupo) — o inventário **dimensiona** o valor dela; não a bloqueia mais.
- **R8-06** (os modais param de reescrever) — o número que este inventário produz é o tamanho do estrago que aquela issue impede.
<<<END>>>

<<<ISSUE>>>
id: R8-40
numero: 465
title: [P2] feat(proforma): nomear a Receita líquida de proforma e registrar a divergência da base do equity
labels: P2, docs, funding, motor
sources: R-A2-22 · E-A2-07 · R-A35 · R-A321 · decisão do autor 2026-08-22 · A2 (`Premissas!N17`/`N18`) · A4 (17 mentiras documentais) · aba #43 (print) · C2 · C3
---
> 📸 **Evidência visual, acrescentada em 2026-08-22.** A dedução de **Marketing** para chegar
> à Receita líquida — o que separa a primeira noção de "líquida" da segunda — aparece na tela
> do autor, e não só nas fórmulas: o print embutido na aba **#43** da
> `lista bugs 20260807.xlsx` (PROFORMA INCORPORAÇÃO da EVI) traz a linha
> **`Marketing 1.766.797 −1,00%`** dentro do bloco de deduções que fecha em `= Receita
> líquida`. É a confirmação independente do que A2 leu em `Premissas e Resultados!P14` e do
> que A3 leu em `!equity!C16`.

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

---

## Fusão — a mesma decisão do autor, documentada por duas lentes

A fatia C3 escreveu esta mesma issue por outro caminho (`R-A35`/`R-A321`, pela planilha do
investidor) e chegou à mesma conclusão: a decisão do autor de 2026-08-22 criou uma **terceira base**
que vive **numa conversa** e não no arquivo que ela governa. Duas lentes independentes pedindo o
mesmo registro é o argumento de que ele não é opcional.

⚠️ **A fusão eleva a prioridade de P3 para P2.** Isoladamente, cada redação parecia dívida de
nomenclatura. Juntas, elas mostram que **quatro** composições de "receita líquida" convivem e que a
documentação vigente transcreve a que o código não segue — o gênero de mentira documental que esta
rodada catalogou 17 vezes, e que já custou uma proposta de conserto que teria desfeito a decisão do
autor.

### Comportamento atual
Quatro composições de "receita líquida" convivem, e o documento vigente descreve a errada:

| Onde | Deduz |
|---|---|
| `!equity!C15/C16/C17` → `C18 = C4*(1 − C15 − C16 − C17)` | corretagem 5% + **marketing 3%** + impostos 6% |
| `docs/viabilidade/fluxo-investidor-formulas.md:133` (transcrição literal da célula) | idem — **e é o doc "vigente"** |
| `funding-capital-stack.md:565-577` §6.2 (ADR) | bruta − impostos − corretagem − permuta financeira, **sem marketing** |
| **`frontend/funding-motor.ts:58-67`, o que o app faz** | `receitaMensal − corretagem`, onde `receitaMensal` já é líquida de RET e permuta financeira (#228). **Marketing não entra.** |

### Consequência
Com o golden do próprio documento: sobre VGV 200 MM, marketing 3% = **R$ 6 MM de base a mais**; a 4%,
**R$ 240 mil de retorno a mais** para o investidor do que a planilha calcula — 13% acima dos R$ 1,88
MM de lucro do golden.

Sem esta issue, a próxima auditoria abre a mesma divergência de novo e, pior, alguém a "conserta"
alinhando o código à planilha — desfazendo a decisão do autor por achar que era bug.

### Comportamento esperado
1. `docs/viabilidade/fluxo-investidor-formulas.md` §4.2 ganha, ao lado da transcrição de
   `!equity!C18`, uma nota dizendo que aquela é a **fórmula da planilha** e que o app usa
   deliberadamente outra composição — com a **citação literal** da decisão do autor de 2026-08-22 e o
   `arquivo:linha` (`funding-motor.ts:58-67`).
2. `funding-motor.ts` passa a ter **uma única** função nomeada de base do equity, com a composição
   **declarada em texto ao lado da assinatura** (o comentário de `:50-57` já faz metade disso, mas
   ancora em `funding-capital-stack.md`, que é ADR — a âncora tem que passar a ser a decisão do
   autor).

### Critério de aceite
- [ ] O doc cita `funding-motor.ts:58-67` e a decisão, com data.
- [ ] Um leitor que compare doc e código não encontra mais divergência **sem explicação**.
- [ ] O golden do §6 do doc passa a ser gerado a partir da função real, não reconstruído à mão
      dentro do teste (`frontend/funding-motor.test.ts:126-144`) — senão o teste continua podendo
      concordar com um doc que o código contradiz.

## Relacionadas
- **R8-55** (`decide(funding)`) — pergunta **o que a decisão significa**; esta issue **registra** a decisão. As duas nascem da mesma frase do autor.
- **R8-34** (dois flags da permuta financeira) — a segunda noção de "líquida", com issue própria.
- **R8-23** (docs da proforma desalavancada) — mesma família documental, mesmo arquivo de fórmulas.
<<<END>>>

<<<ISSUE>>>
id: R8-41
numero: 466
title: [P2] feat(funding): rotular `divida` como "Dívida / Capital de giro" e registrar a recusa do rotativo
labels: P2, ui, docs, funding
sources: R-A31 · R-A319 · R-A310 (RECUSADA) · R-A311 (RECUSADA) · 04 §6.3 E9 · decisão nº 1 do autor · C3
---
> 🔀 **Deduplicação — o que saiu desta issue.** A redação original juntava o rótulo de capital de
> giro com a **varredura dos resíduos de "Capital Stack"**, que também estava escrita na fatia C4.
> As duas foram **separadas** em vez de fundidas, porque têm entregáveis e critérios de aceite
> disjuntos: aqui é **rótulo + registro de decisão + dois blocos de documentação de funding**; a
> varredura de texto de tela e de comentário é a **R8-29**, que já cobria as mesmas linhas por
> outra lente. Consertar o rótulo sem varrer o vocabulário deixa a tela dizendo "camadas de
> Capital Stack" ao lado de um seletor que diz "Dívida / Capital de giro" — por isso as duas
> continuam ligadas em **Relacionadas**, e o critério `grep -rn "Capital Stack" frontend/` mora
> na R8-29, não aqui.

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

## Relacionadas
- **R8-29** (varredura de textos e vocabulário) — ⚠️ **a metade separada desta issue**. O critério `grep -rn "Capital Stack" frontend/` é de lá; aqui ficam o rótulo, a recusa registrada e os blocos de documentação.
- **R8-54** (etiquetar `avancado_capital_instrumentos`) — o resto estrutural do mesmo modelo apagado.
- **R8-15** (docs: funding instalado) — esta issue traz o **3º bloco** da §17 que aquela deliberadamente não escreve.
<<<END>>>

<<<ISSUE>>>
id: R8-42
numero: 467
title: [P2] docs(funding): registrar por que `mesRepasse` soma +1 e por que mexer nele quebra o equity
labels: P2, docs, funding
sources: R-A34 · 03 §2 · lacuna nº 15 do dossiê · C3
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
id: R8-43
numero: 468
title: [P2] chore(processo): capturar baseline dos KPIs e ordenar a cadeia de PRs que move o mesmo denominador
labels: P2, docs, funding
sources: R-A320 · A5 · A2 · R-A38 · R-A313 · 03 §7 · C3
---
> 🔁 **A ordem recomendada mudou com as decisões do autor de 2026-08-22 — use esta, não a do
> corpo abaixo.** Duas mudanças: a refatoração `estadoFinanceiroDoEstudo` **saiu da cadeia**
> (recusada, D-Q03), e as **duas issues de absorção** entraram — elas movem os mesmos quatro
> KPIs pelo lado da receita e não estavam na tabela original.
>
> 1. **baseline capturado** (agora, na `main` intocada — os três consertos foram revertidos e a
>    árvore está idêntica);
> 2. **conserto da proforma** (`proforma-avancado.ts:92-93`) — o maior salto, e sozinho;
> 3. **`PATCH` de tipologias** — pode impedir estados hoje salvos, então vai cedo;
> 4. **descarte silencioso da absorção** e depois **os modais destrutivos** — nessa ordem, ou o
>    segundo faz parecer que o primeiro foi resolvido;
> 5. **equity** (retorno negativo · teto de 100%) — risco zero em produção, não há equity
>    cadastrado;
> 6. **cash sweep** — a que mais move em estudo com financiamento à produção + dívida/equity;
> 7. **campo de taxa por Grupo** — até 5,41% do VGV; por último, de propósito.
>
> A regra não mudou: **uma mudança de número por PR**, cada uma declarando qual KPI move e em
> que direção.

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
3. Ordem recomendada: **ver a nota do topo desta issue**, que substitui a ordem originalmente
   proposta aqui. A `R-A313` saiu da cadeia (recusada pelo autor) e as duas issues de absorção
   entraram.

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

## Relacionadas
- A cadeia que move o mesmo denominador: **R8-01** (proforma) · **R8-08** (`PATCH` de tipologias) · **R8-04** (descarte da absorção) · **R8-06** (os modais destrutivos) · **R8-09** (cash sweep) · **R8-03** (campo de taxa).
- **R8-49** (registro das cinco montagens) — **saiu da cadeia**: era o passo de refatoração pura, e o autor o recusou.
<<<END>>>

<<<ISSUE>>>
id: R8-44
numero: 469
title: [P2] chore(funding): cadastrar em Pinguim as três operações de equity que provam as divergências
labels: P2, funding
sources: R-A317 · A5 (nenhum equity cadastrado) · R-A314 · R-A37 · R-A36 · R-A33 · C3
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

## Relacionadas
- **R8-07** (retorno negativo) ← prova **E1** · **R8-10** (teto de 100%) ← prova **E2** · **R8-21** (`saldoFinal`) ← prova **E3**.
- **R8-20** (invariantes de equity) — é ela que torna as três provas **visíveis na Reconciliação**; sem ela, E2 fica invisível por construção.
<<<END>>>

<<<ISSUE>>>
id: R8-45
numero: 470
title: [P2] docs(claude-md): dois blocos de estado do CLAUDE.md descrevem um repositório que não existe mais
labels: P2, docs
sources: A4 §1 M7 · A4 §1 M8 · A4 §6.0 C2 · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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

## Relacionadas
- **R8-24** (formatação) — é o conserto do que este texto passa a descrever corretamente.
- **R8-57** (tabela de conformidade) — o mesmo mapa da #281, no outro arquivo. Saem juntas ou uma contradiz a outra.
- **R8-13** (Rodada 8 aberta) — mesmo arquivo; coordene para não conflitarem.
<<<END>>>

<<<ISSUE>>>
id: R8-46
numero: 471
title: [P2] docs(padrao): oito blocos rotulam como pendência um comportamento que o código já entrega
labels: P2, docs
sources: A4 §1 M9, M10, M11, M13, M14, M15, M16, M17(§15.2) · A4 §6.1 (P1 respondida) · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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
> ⚠️ **São duas variáveis distintas, e o app hoje as chama pelo mesmo nome.** Decisão do autor de
> 2026-08-22 (**D1**, issue **#430**): **Pós-obras** é o prazo do Cronograma que rege os
> **desembolsos** de pós-obra; **Pós-chaves** é a janela de **vendas e pagamento** posterior à
> entrega, ao lado de pré-lançamento, lançamento e durante-obras. Os 12 meses travados acima são o
> **Pós-chaves** — e ficam. O que muda é a taxonomia: cada um passa a ter nome e campo próprios.
>
> ⚠️ **Enquanto isso, `pos_obra.duracao_meses` continua editável e não faz o que o nome promete.**
> O evento nasce com `duracao_meses: 12` e `travado_duracao: false`
> (`backend/rotas/avancado.ts:42`); editá-lo **não** move a janela de vendas, só a **âncora de
> custos** pós-entrega — que é exatamente por que a D1 os separa. Medido em Pinguim: o estudo 6 tem
> `duracao_meses: 13` e uma curva de absorção `personalizado` que chega ao 13º mês; o 13º mês cai
> fora de `periodoAbsorcao` e `absorcaoMensal:375-376` o **descarta em silêncio** — **1,41% das
> vendas, R$ 2.007.856,95**. Esticar a janela faz vender menos. Ver a issue **E3**.
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

## Relacionadas
- **R8-05 · #430** (separar Pós-obras de Pós-chaves) — a pergunta que pendia sobre o §8.5 foi respondida pela **D1**: os 12 meses do **Pós-chaves** ficam, e o que muda é a taxonomia. O texto substituto acima já incorpora isso, então o §8.5 **não muda de novo**. Quando a #430 mergear, confira só que os nomes de campo citados no bloco são os que sobraram.
- **R8-04** (descarte silencioso) — o §8.5 cita a perda de R$ 2.007.856,95 e aponta para ela.
- **R8-14** (docs do motor de safras) — o §13 cita as mesmas linhas de motor.
<<<END>>>

<<<ISSUE>>>
id: R8-47
numero: 472
title: [P2] fix(fluxo): o detalhamento do financiamento à produção sai da tabela principal
labels: P2, ui, funding
sources: B1 §3.2 (8-B.2) · C4
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
   consequência, da de Cenários, que é a mesma função). **Remover, não mover** — decisão D12.
2. Remover a linha de rodapé `Fluxo de Caixa Livre (antes do funding)` da tabela principal: a
   comparação FCL × FC real é o conteúdo da aba Análise Financeira, onde já existe com as duas
   pontas e a ponte entre elas.
3. `chavesColapso` (`frontend/fluxo-tabela.ts:618-624`) perde as chaves `fin-prod-*` junto; o
   `chavesColapsoBase` não muda.

## Como corrigir
Retirar os blocos de `frontend/fluxo-tabela.ts:593-606` e `:610`, e as chaves correspondentes em
`:618-624`. Nada mais precisa mudar: os dois blocos removidos têm total e VPL **zerados**, logo não
participam de nenhum subtotal.

> ✅ **Decidido pelo autor — D12, 2026-08-22: remover.** A P5 do B1 está respondida: o bloco de
> detalhamento **sai da tabela principal**, não é movido para outra aba. A informação não se perde —
> liberações, juros e amortizações continuam nas linhas de funding dentro de Custos Financeiros
> (`:574-590`).

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

## Relacionadas
- **R8-22** (rótulo "Custos Financeiros") — mexe na mesma tabela (`frontend/fluxo-tabela.ts`), no mesmo grupo `financeiro`. Coordene o diff.
<<<END>>>

<<<ISSUE>>>
id: R8-48
numero: 473
title: [P2] feat(receitas): corretagem sobre permuta física vira configurável por estudo, com default no comportamento atual
labels: P2, motor, ui, backend
sources: A4 §3 A4 · A4 §2 (P7) · A4 §6.6 (P7 segue em aberto) · C4
---
> ✅ **Decidido pelo autor — D7, 2026-08-22: nem (a) nem (b) — as duas.** A incidência da corretagem
> sobre a permuta física vira **configurável por estudo**, e o **default é o comportamento de hoje**
> (incide sobre o VGV bruto, permuta física inclusa). Isso deixa de ser pergunta e vira feature.
>
> **Nenhum estudo existente muda de número.** O default preserva byte a byte o resultado de todos os
> estudos já gravados — a migração só acrescenta a coluna com o valor que reproduz o cálculo atual,
> e quem quiser a outra base desliga a chave conscientemente.

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
As duas bases passam a ser **escolha do estudo**, não herança silenciosa:

- **default — corretagem sobre o VGV bruto**, permuta física inclusa. É o comportamento de hoje, e é
  economicamente defensável: o corretor intermediou o negócio do terreno, a comissão é devida sobre a
  unidade permutada.
- **alternativa — corretagem sobre a base vendável**, que exclui a permuta física, alinhando a
  corretagem a `vendaBrutaContratadaMensal`.

O `padrao-incorporacao.md:1136-1142` (§12.2) deixa de listar as duas bases como divergência a
resolver e passa a descrevê-las como as **duas configurações legítimas**, dizendo qual é o default.

## Como corrigir
1. **Coluna nova no `schema.json`**, na tabela `estudos`, booleana, ao lado de `corretagem_percentual`
   (`schema.json:69`) — nome sugerido `corretagem_sobre_permuta_fisica`, `"padrao": true`.
2. **Migração nova**, com o próximo número livre contra a `main` do momento (a última na `main` é
   `migracoes/029_funding_operacoes.js`), preenchendo `true` nos estudos existentes. Migração nova →
   **a `versao` do `manifesto.json` bumpa** (hoje `0.1.28`).
3. **Controle na tela**, junto do campo de corretagem, com rótulo que diga o que cada estado faz —
   não um booleano nu.
4. **Motor:** `vgvVendidoMensal` (`frontend/fluxo-shared.ts:676-693`) passa a repartir o VGV bruto ou
   o vendável conforme a chave. A distinção "bruto" × "vendável" fica **explícita no nome** das
   funções, que é o que a #227 pedia e ficou pela metade em
   `frontend/fluxo-caixa-motor.ts:258-263`.
5. **Antes de mexer**, construir um estudo de teste com permuta física ativa e registrar a corretagem
   nos dois estados — hoje não existe caso medido, e sem ele a regressão é invisível.

## Critério de aceite
1. Existe teste com estudo de **permuta física ativa** provando que, com a chave no default, a
   corretagem é **idêntica** à calculada pelo motor de hoje — dígito a dígito. É este o critério que
   prova a preservação dos estudos existentes.
2. O mesmo teste, com a chave desligada, mostra a corretagem sobre a base vendável, e a diferença
   entre os dois valores é exatamente a corretagem das unidades permutadas.
3. A migração roda no harness (`bash scripts/validar-backend.sh`) em instalação virgem, em
   reexecução e na cadeia completa; a `versao` do `manifesto.json` bumpa junto.
4. O controle aparece na tela com estado inicial = default, e um estudo salvo sem tocar nele mantém
   o número de antes.
5. `padrao-incorporacao.md:1136-1142` descreve as duas configurações e diz qual é o default.
6. `frontend/fluxo-caixa-motor.ts:258-263` deixa de registrar unificação incompleta.
7. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
Qualquer outra consequência das duas bases fora da corretagem e da baixa de estoque. Se algum agente
de receitas/absorção já abriu issue para a base de `vgvVendidoMensal`, **deduplique com ela** — o
entregável desta issue é a **chave por estudo** sobre a corretagem, não a refatoração geral das duas
bases.

## Relacionadas
- **R8-19** (falsos positivos das invariantes) — o falso positivo nº 1 (`VENDA_BRUTA_NAO_RECONCILIA`) é a **mesma** divergência de base (`vgvLinha` × VGV vendável), vista do lado do validador. Como a chave passa a permitir os **dois** estados, o conserto de lá tem de valer nos dois — releia antes de mergear.
- **R8-34** (dois flags da permuta financeira) — a pergunta irmã, do lado da permuta **financeira**.
<<<END>>>

<<<ISSUE>>>
id: R8-49
numero: 474
title: [P2] docs(funding): registrar as cinco montagens concorrentes dos Passos 23–25 e a recusa da fonte única
labels: P2, docs, funding
sources: R-A313 · R-A36 · R-A38 · R-A312 · 03 §7 · A5 (4 margens) · A4 (`formulas.md:61-86`) · decisão do autor D-Q03 · C3
---
> 🛑 **Decisão do autor — D-Q03, 2026-08-22: a fonte única foi RECUSADA. Não ressuscitar.**
> O autor escolheu **manter as definições concorrentes** e apenas **distinguir os rótulos**. Não
> há `estadoFinanceiroDoEstudo`; os cinco consumidores continuam montando a cadeia cada um do seu
> jeito; e o Resumo **continua** com a conta inline de `frontend/tela-resumo.ts:159-166` — não
> proponha trocá-la.
>
> Esta issue foi **rebaixada de P1 estrutural para registro/rótulo**, e mudou de título. O corpo
> original está preservado abaixo porque o **levantamento** continua valendo: a tabela das cinco
> montagens, com `arquivo:linha`, é exatamente o que esta issue existe para registrar.
>
> ⚠️ **O conserto de `frontend/proforma-avancado.ts:92-93` NÃO foi recusado** — é issue P1 à
> parte, e o autor a confirmou na mesma resposta. Recusada foi só a refatoração.

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

## O desenho que foi proposto — e recusado
> 🛑 As três seções seguintes — o desenho, o "como corrigir" e o critério de aceite — estão
> preservadas **verbatim, como registro do que foi considerado**. Elas **não são o trabalho desta
> issue**. O trabalho está em "O que sobra para fazer", adiante.

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
   horizonte alcança o último evento financeiro e divergem quando não alcança. **O código pratica a
   primeira** — `calc.fluxoAcumulado[último]` —, e é essa que tem de estar escrita: o entregável é
   registrar a definição vigente, não escolher entre as duas. Adotar a da planilha seria mudança de
   comportamento e é **issue própria**, com número seu.
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

## O que sobra para fazer
Três coisas, todas de **registro e rótulo**:

1. **Um comentário na cabeça de cada um dos cinco consumidores** dizendo que a montagem dos
   Passos 23–25 é local, que existem outras quatro, e que **elas podem divergir** — com o
   `arquivo:linha` das outras quatro. É o único formato em que a decisão se defende sozinha:
   quem for escrever a **sexta** tela lê o aviso no arquivo que está copiando.
2. **A definição de `resultadoFinal` escrita**, com a divergência em relação à planilha
   (`!equity!C19`), exatamente como o item 3 de "Como corrigir" descreve. Este item
   **sobrevive à recusa**: não depende de fonte única, e sem ele a lacuna nº 16 do dossiê
   continua aberta.
3. **Os rótulos que distinguem** — "VGV potencial" × "Receita Bruta", "Margem de caixa" ×
   "Margem sobre Receita Bruta". ⚠️ Este item é **entregue pela issue de rótulos** (ver
   Relacionadas), não aqui; está listado para ninguém o fazer duas vezes.

**A consequência de não unificar, declarada — e é ela que precisa acabar dentro do código:**
as superfícies continuam podendo divergir, e nada impede que a **próxima tela** que alguém
escrever crie uma **quinta** definição. O app aceita esse risco **por decisão, não por
descuido**. Sem essa frase escrita, a próxima auditoria reencontra as cinco montagens e
propõe a mesma refatoração de novo — que é exatamente o custo que esta issue existe para
evitar.

## Critério de aceite (o que vale depois da recusa)
- [ ] Os cinco arquivos da tabela acima carregam o comentário, e ele cita os outros quatro.
- [ ] A definição de `resultadoFinal` está escrita, com a divergência em relação a
      `!equity!C19`.
- [ ] A recusa da fonte única está registrada **no código**, com data, e não só nesta issue.
- [ ] **Nenhum número muda** — é comentário e rótulo.
- [ ] `versao` do `manifesto.json` **não** bumpa.

## Fora de escopo
- **Criar a fonte única** — recusada. Quem a reabrir está desfazendo decisão do autor, não
  achando esquecimento.
- **O guard de grep** no `pr-guards.yml`, proposto no item 4 acima: sem fonte única não há o
  que guardar.
- Consertar o cash sweep para enxergar as outras operações — é issue própria (`R-A38`) e, com a
  recusa, **deixou de depender desta**: o conserto passou a ser local ao `fundingDoEstudo`.
- Consertar `proforma-avancado.ts:92-93` — issue própria, e vem **antes** desta.
- Mudar a base de receita líquida do equity — decisão do autor, fechada.

## Relacionadas
- **R8-18** (uma definição por rótulo) — **entrega o item 3** desta issue. As duas nasceram da mesma resposta do autor: manter as definições, distinguir os rótulos.
- **R8-01** (proforma) — o conserto que **não** foi recusado, e cujo defeito só pôde existir porque um dos cinco consumidores tinha regra própria.
- **R8-09** (cash sweep) — era "depois desta"; com a recusa, é **independente**.
- **R8-43** (baseline) — a ordem da cadeia muda com a recusa: sai um passo de refatoração pura.
<<<END>>>

<<<ISSUE>>>
id: R8-50
numero: 475
title: [P3] fix(ui): trocar --cor-superficie-2 por um token que existe no shell
labels: P3, ui
sources: 06-auditoria-ui.md §3.2/B1 · §8 A6 · C1
---
## Contexto
O A6 cruzou os 21 tokens `var(--…)` que o app usa contra os definidos em `urbiverso/compartilhado/tokens.css`. **20 existem. Um não.**

> ⚠️ **Fonte:** a conferência foi feita contra o **`main`** do monorepo `C:\Users\raafa\urbiverso` (só leitura), **não** contra o SDK/shell publicado — o pacote instalado nesta máquina é um stub e `npm view @urbiverso/sdk` dá `E401`. Um token pode existir no `main` e não na versão que a instância roda; neste caso o token não existe **em nenhum dos dois**, o que torna o veredito seguro.

## Comportamento atual
`frontend/tela-dashboard.ts:131` e `:135`:

    background: var(--cor-superficie-2, rgba(255,255,255,0.06));

`--cor-superficie-2` **não existe** — nem em `urbiverso/compartilhado/tokens.css`, nem em nenhum `.ts`/`.css` do monorepo inteiro. O que existe é `--cor-superficie`, `--cor-superficie-sutil`, `--cor-superficie-elevada` e `--cor-superficie-hover`.

## Consequência
O fallback literal `rgba(255,255,255,0.06)` é a cor **efetiva, sempre**. É branco translúcido, desenhado para tema escuro. Em **2026-08-19** o shell ganhou os temas **sépia** e **cyberpunk** (`urbiverso` @ `043f652e`) e mantém tema claro; nesses, **branco a 6% sobre fundo claro some** — a superfície do painel de estudos deixa de existir visualmente.

É exatamente a falha silenciosa que o contrato *"tokens do design system, nunca cor literal"* do `CLAUDE.md` existe para impedir — só que **disfarçada de token**: a linha parece conforme e não é.

## Comportamento esperado
`frontend/tela-dashboard.ts:131,135` usa um token que existe. Pela intenção do código (superfície de segundo nível dentro de um card), o candidato é `--cor-superficie-sutil` ou `--cor-superficie-elevada` — a escolha depende de qual profundidade a peça deve ter, e é decisão de design.

## Como corrigir
1. Trocar o token nas duas linhas.
2. Manter fallback, mas um que sobreviva a tema claro — ou nenhum, se o token for garantido pelo piso `shell_min = "0.53.8"`.
3. Vale a pena um guard: um script que cruze os `var(--…)` do `frontend/` contra a lista de tokens conhecidos falharia neste caso e é barato. **Opcional**, e se entrar, entra como passo dos guards estáticos de `scripts/validar-frontend.sh` (etapa 1/5), junto do guard de aspas curvas.

## Critério de aceite
1. `grep -rn "cor-superficie-2" frontend/` — **não retorna nada**.
2. O token escolhido aparece em `urbiverso/compartilhado/tokens.css` — cite `arquivo:linha` no PR, **declarando que a fonte foi o `main` do monorepo e não o bundle publicado**.
3. Confirmação visual do autor na Pinguim, no painel de estudos, nos temas **claro e escuro** (e sépia, se disponível). Não há navegador no ambiente Claude Code.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- A paleta categórica literal de `frontend/tela-graficos.ts:13-16` — issue própria.
- O CSS de impressão de `frontend/exportar.ts`, exceção legítima documentada no `CLAUDE.md`.
- Pedir token novo ao monorepo: não é preciso, existem quatro `--cor-superficie-*` publicados.
<<<END>>>

<<<ISSUE>>>
id: R8-51
numero: 476
title: [P3] fix(graficos): pizza de custos passa a usar os tokens categóricos do tema
labels: P3, ui
sources: 06-auditoria-ui.md §3.2/B2 · §8 A7 · C1
---
## Contexto
Segundo achado de cor do A6, na mesma varredura que encontrou o token inexistente. **Verificado e limpo no resto do app:** zero cores literais em qualquer propriedade CSS fora de `frontend/exportar.ts` — todas as 200+ ocorrências de `#hex`/`rgba()` estão na forma `var(--token, fallback)`, que é o padrão dos próprios primitivos. Esta é a única exceção não coberta.

## Comportamento atual
`frontend/tela-graficos.ts:13-16`:

    const PALETA_CUSTOS = [
      '#2AA9E0', '#13A98D', '#F7A111', '#D45A3A', '#8E7CC3', '#5BAF7A',
      '#E0699B', '#7FB3D5', '#C0A16B', '#59C3C3', '#B57EDC', '#9AA5B1',
    ];

Usada em `frontend/tela-graficos.ts:112` para colorir as fatias da pizza de custos. **12 cores literais, sem token, sem fallback.** Isto **não** é `frontend/exportar.ts`, então a exceção do `CLAUDE.md` não cobre.

O comentário de `:11-12` justifica com *"mais que os 6 da paleta padrão do gráfico"*. O shell hoje expõe **8** tokens categóricos (`--cor-categoria-1` … `--cor-categoria-8`), mais `--cor-escala-1..4` e `--cor-escala-neutra`, todos theme-aware.

> ⚠️ **Fonte:** os tokens foram conferidos no **`main`** do monorepo (só leitura), não no bundle publicado. Declare isso no PR.

## Consequência
**A pizza de custos é o único gráfico do app que não segue o tema.** Nos temas claro, sépia e cyberpunk (o shell tem os quatro desde 2026-08-19) as 12 cores continuam as mesmas, calibradas para um tema só, enquanto todos os outros gráficos do app — que passam `cor: 'var(--cor-…, #…)'` em `frontend/fluxo-graficos.ts:18-24`, `frontend/tela-cenarios.ts:329-330`, `frontend/tela-fluxo-custos.ts:590-591,625` e `frontend/tela-graficos.ts:111` — acompanham.

## Comportamento esperado
> ✅ **Decidido pelo autor — D15, 2026-08-22: 8 tokens categóricos + 4 de escala = 12**, preservando
> **exatamente** a contagem de hoje.

A paleta continua com **12 posições**, na mesma ordem, e cada posição troca o literal por um token:

| Posições | Token |
|---|---|
| 1–8 | `--cor-categoria-1` … `--cor-categoria-8` |
| 9–12 | `--cor-escala-1` … `--cor-escala-4` |

Isso é o ponto da decisão: **nada do que o usuário vê muda de tamanho**. A paleta tinha 12 entradas e
continua com 12, então o comportamento com N categorias de custo — inclusive o ciclo do primitivo
quando N > 12 — é **idêntico ao de hoje**. A troca é literal → token, e só; o que muda é que agora
ela acompanha os quatro temas do shell.

## Como corrigir
Substituir cada entrada de `PALETA_CUSTOS` (`frontend/tela-graficos.ts:13-16`) por
`var(--cor-categoria-N, #hex)` nas 8 primeiras e `var(--cor-escala-N, #hex)` nas 4 últimas,
**mantendo os hexadecimais atuais como fallback, na mesma posição** — é o que os outros gráficos
fazem (`frontend/fluxo-graficos.ts:18-24`) e é o que garante a aparência atual num shell sem os
tokens. O comentário de `:11-12`, que justifica a paleta própria com *"mais que os 6 da paleta padrão
do gráfico"*, é reescrito para dizer de onde vêm as 12.

## Critério de aceite
1. `grep -n "'#" frontend/tela-graficos.ts` — nenhuma cor literal fora da posição de fallback de `var()`.
2. `PALETA_CUSTOS` tem **exatamente 12** entradas, na mesma ordem, e cada fallback é o hexadecimal que ocupava aquela posição antes — diff conferível linha a linha.
3. Nenhuma mudança de lógica em `frontend/tela-graficos.ts:112`: a indexação da paleta é a de antes.
4. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.
5. Confirmação visual do autor na Pinguim, nos temas claro e escuro — **conferência, não pré-requisito**: com fallback na mesma posição, o tema claro reproduz a pizza de hoje. Não há navegador no ambiente Claude Code.

## Fora de escopo
- `--cor-superficie-2` inexistente em `frontend/tela-dashboard.ts` — issue própria.
- O CSS de impressão de `frontend/exportar.ts`.
- Redesenhar o gráfico ou trocar de primitivo.
<<<END>>>

<<<ISSUE>>>
id: R8-52
numero: 477
title: [P3] feat(receitas): declarar a linha de receita como unidade de regime comercial, com defaults herdados
labels: P3, docs, ui
sources: R-A2-11 · C2
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

## Relacionadas
- **R8-03** (campo de taxa) — o critério de aceite desta issue (dois grupos, 12,5% e 13% a.a.) **só é executável** depois dela.
<<<END>>>

<<<ISSUE>>>
id: R8-53
numero: 478
title: [P3] feat(funding): modelar tarifas, estruturação e encargos das operações de dívida
labels: P3, funding, backend, motor
sources: R-A39 · 03 §2 · lacuna nº 14 do dossiê · C3
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

## Relacionadas
- **R8-37** (área aberta com deflator) e **R8-34** (dois flags da permuta financeira) — as outras duas issues desta rodada que **exigem migração e bump da `versao`**. Só uma delas pode tomar o número `030`; a segunda toma `031`. Declare no PR qual é qual.
<<<END>>>

<<<ISSUE>>>
id: R8-54
numero: 479
title: [P3] chore(schema): etiquetar `avancado_capital_instrumentos` como obsoleta e barrar seu reúso
labels: P3, backend, docs
sources: R-A318 · A6 · decisão nº 1 do autor · 03 §7 · C3
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

## Relacionadas
- **R8-29** (varredura de vocabulário) — a ocorrência `capital_giro` em `schema.json:384` é citada lá; o conserto é aqui.
- **R8-13** (Rodada 8 aberta no `CLAUDE.md`) — ⚠️ o texto substituto de lá justifica manter a tabela com um motivo (*"guarda o dado migrado pela `019`"*) que **esta issue mostra não se sustentar**. Corrija a redação lá antes de aplicá-la.
- **R8-41** (rótulo de capital de giro) — o mesmo modelo apagado, pelo lado do vocabulário vivo.
<<<END>>>

<<<ISSUE>>>
id: R8-55
numero: 480
title: [P3] decide(funding): o equity ganha o interruptor de base bruta × base líquida que a permuta financeira já tem?
labels: P3, decisao, funding
sources: R-A321 (P8) · A2 (`Premissas!N17`/`N18`) · decisão nº 2 do autor · 03 §7 · C3
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

## Relacionadas
- **R8-40** (Receita líquida / base do equity) — **registra** a decisão que esta issue **interpreta**. Se a resposta for "ganha o interruptor", a issue de implementação nasce citando as duas.
- **R8-34** (dois flags da permuta financeira) — o **precedente pronto no app** que a implementação copiaria.
<<<END>>>

<<<ISSUE>>>
id: R8-56
numero: 481
title: [P3] docs(padrao): a nota de UX do modal de pagamento descreve controles que não existem mais
labels: P3, docs
sources: A4 §1 M12 · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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

## Relacionadas
- **R8-06** (modal para de reescrever) e **R8-03** (campo de taxa) — o texto substituto descreve o modal de hoje; se as duas mergearem antes, ele muda.
<<<END>>>

<<<ISSUE>>>
id: R8-57
numero: 482
title: [P3] docs(formulas): a tabela "Estado de conformidade" acusa ❌ em cinco pontos já conformes
labels: P3, docs
sources: A4 §1 M6 · A4 §6.0 C2 · C4
---
> ✅ **Autorizada pelo autor — D-Q04, 2026-08-22.** As **17 correções de documentação** desta
> rodada estão aprovadas em bloco, incluindo as três do `CLAUDE.md` e a seção que declara a
> Rodada 8 aberta. **Saem num PR só, de documentação** — nenhuma delas toca código de produção,
> nenhuma tem migração, e a `versao` do `manifesto.json` **não** bumpa em nenhuma.
>
> Consequência prática: esta issue **não espera** por nenhum conserto de código para ser
> aplicada. A única ordem que importa dentro do PR de docs é não deixar dois textos do mesmo
> arquivo brigarem — ver **Relacionadas**.

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

## Relacionadas
- **R8-24** (formatação) — é o conserto dos dois ❌ que esta tabela passa a listar.
- **R8-45** (dois blocos do `CLAUDE.md`) — o mesmo mapa da #281, no outro arquivo.
<<<END>>>

<<<ISSUE>>>
id: R8-58
numero: 483
title: [P3] fix(preliminar): Produtos passa a ser a última aba, depois de Permutas
labels: P3, ui
sources: B1 §3.3 (8-B.3) · B1 §5 P1 · C4
---
> ✅ **Decidido pelo autor — D14, 2026-08-22: leitura literal.** "Produtos é a última da lista"
> quer dizer **depois de Permutas**. Ordem final:
> `Terreno & Áreas · Custos · Permutas · Produtos`.

## Contexto
Item **2** da `lista bugs 20260807.xlsx`. A cláusula era ambígua e a auditoria a deixou como
pergunta em vez de inventar o requisito; respondida, virou conserto de duas linhas.

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
`Terreno & Áreas · Custos · Permutas · Produtos` — Produtos por último, depois de Permutas.

## Como corrigir
Trocar as duas linhas de `frontend/tela-preliminar.ts:51-52` (`produtos` e `permutas` invertem de
ordem no array `SUBABAS.premissas`). O comentário de `frontend/tela-preliminar.ts:46-47`, que hoje
diz *"Produtos (por último, **antes de Permutas**)"*, muda junto — senão o código passa a mentir na
linha de cima do conserto.

## Critério de aceite
1. `frontend/tela-preliminar.ts:49-52` lista, nesta ordem: `terreno`, `custos`, `permutas`,
   `produtos`.
2. O comentário de `:46-47` descreve a ordem nova.
3. `bash scripts/validar-frontend.sh` verde. Sem migração → **a `versao` não bumpa**.

## Fora de escopo
Qualquer outra mudança na navegação do Preliminar.

Sem-fechamento: a executora original do item 2 na Rodada 7 (commit `74cb2c7`) já fechou; esta issue trata só da cláusula ambígua de ordem
<<<END>>>

<<<ISSUE>>>
id: R8-59
numero: 484
title: [P3] decide(absorcao): o que fazer com o controle inerte de Correção de estoque — decisão adiada, registrada
labels: P3, decisao
sources: R-A2-19 · 04 §6.3 E7 · decisão do autor D-Q09 · C2
---
> 🛑 **Decisão do autor — D-Q09, 2026-08-22: NÃO MEXER. A decisão foi adiada de propósito.**
> *"Tome o caminho mais fácil que não mude nada, só se for para corrigir um erro evidente."*
> Esta issue **deixou de propor execução** e virou **registro**: ela descreve o problema e as
> saídas possíveis, e espera. O mesmo vale para as colunas de índice de correção
> (`indice_correcao`, `indice_correcao_taxa_aa`) citadas em "Fora de escopo".
>
> **Qual é o custo de adiar, dito com todas as letras** — porque adiar sem declarar o custo é
> como um campo morto vira permanente: o badge "Não/Sim" continua **clicável, ao lado do botão
> Aplicar**, e o usuário continua podendo ligá-lo acreditando ter configurado uma premissa do
> estudo que **o motor ignora inteiramente**. Não há dano em R$ hoje (as 6 linhas dos 2 estudos
> de Pinguim estão em `false`), e é isso que torna o adiamento defensável — não a ausência do
> problema.
>
> **As três saídas, para quando a decisão for tomada:** (a) retirar o controle da tela,
> mantendo a coluna aceita e ignorada — é o que o corpo abaixo detalha; (b) dar-lhe o motor que
> a §10.6 do padrão exige, o que depende de um modelo de correção que não existe; (c) deixar
> como está, com uma nota na tela dizendo que não tem efeito. **Nenhuma delas é executada por
> esta issue.**

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

## Comportamento esperado (a saída (a), NÃO executada nesta rodada)
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

## Relacionadas
- **R8-25** (aba Financeiro) — mesma família: controle editável sem leitor no motor. Lá o autor decidiu **um** dos dez (`sujeito_ret`, por supressão); aqui decidiu **adiar**. As duas juntas são o mapa dos controles inertes do app.
- **R8-06** (os modais param de reescrever) — mesmo modal. Se aquela mergear primeiro, o badge continua na tela, intocado, como esta decisão determina.
<<<END>>>

---

# Apêndice — issues criadas fora deste arquivo (2026-08-22)

Duas issues nasceram depois da consolidação, das decisões do autor. Os corpos completos estão no
GitHub; ficam registradas aqui para o mapa `R8-NN → #NNN` não mentir por omissão.

| Issue | Título | Origem |
|---|---|---|
| **#485** | `[P2] fix(cronograma): início da obra deixa de ser travado e passa a ser escolha do usuário` | Decisão **D6**. A pergunta existia desde a Rodada 1 e **nunca virou issue** — ficou num relatório de agente. Hoje `backend/rotas/avancado.ts:77-91` ancora com `travado_inicio = true` e `:542-543` recusa a escrita com `422 CAMPO_TRAVADO` |
| **#486** | `[P1] fix(estudo): investigar a perda da permuta física na promoção Preliminar → Avançado` | Isolada de **#441**. Os 4 Preliminares têm `permuta_fisica_pct: 18.00`/`pct_area_venda`; os 2 Avançados do mesmo empreendimento têm `area_m2` com tudo `null`. Se a promoção não converte, atinge **todo estudo promovido** |

**Elas não têm bloco aqui de propósito.** O `--sincronizar` só toca blocos com `numero:`; acrescentá-las
exigiria copiar o corpo inteiro, e duas fontes de verdade para o mesmo texto é como se cria
divergência. Para editá-las, use o GitHub — ou traga o corpo para cá e acrescente `numero:`.

---

# Apêndice 2 — o Bloco 8-A, recuperado (2026-08-23)

🔴 **Seis issues deste arquivo nunca existiram.** O `07-consolidado-issues.md` escreveu o **Bloco
8-A** — a dívida da Rodada 7 — com título, corpo, mecanismo em `arquivo:linha` e critério de aceite,
seis issues completas. **Nenhuma delas entrou aqui**, e como é este arquivo que alimenta
`scripts/criar-issues-rodada-8.mjs`, **nenhuma chegou ao GitHub**. As 59 criadas eram só o Bloco 8-B.

A causa está registrada em `LEIA-PRIMEIRO.md`, na seção *"O que NÃO refazer"*: o resumo colapsou
*"a correção anterior não se sustenta"* em *"o item não se sustenta"* e levou o bloco junto. A
gravidade: entre as seis está a do `urbi-kpi`, que o autor já reportara em **#176, #262, #326 e
#352** — quatro correções fechadas, o bug vivo, e na quinta passada a issue sumiu.

| Issue | Título | Origem | P |
|---|---|---|---|
| **#488** | `fix(resumo): urbi-kpi para de estourar a track — remover width:100%, espelhar o Preliminar` | `07-consolidado-issues.md` § 8-A.2 (`:180`) · item 17 | P1 |
| **#489** | `fix(tipologias): larguras de coluna medidas contra a fonte certa, cabeçalho legível` | § 8-A.4 (`:354`) · item 24 | P2 |
| **#490** | `fix(receitas): remover o bloco "Definições" do modal de Fluxo de pagamento` | § 8-A.5 (`:456`) · item 31 | P3 |
| **#491** | `fix(cenarios): Exposição máxima com a mesma leitura no KPI e na tabela de cenários` | § 8-A.6 (`:524`) · colateral do item 46 | P2 |
| **#492** | `fix(proforma): sensibilidade com 2 casas decimais fixas, não "até 2"` | § 8-A.1 (`:113`) · item 11 | P2 |
| **#493** | `feat(cronograma): Data de início do projeto selecionada só por mês e ano` | § 8-A.3 (`:276`) · item 22 | P3 |

**Também sem bloco aqui, pela mesma razão da nota acima** — o corpo vivo está no GitHub, a origem
está em `07-consolidado-issues.md`. Duplicar seria criar a divergência que aquela nota descreve.

⚠️ **Duas delas foram publicadas com o texto emendado**, e a emenda está marcada no corpo da issue:
**#488** (critério 5) e **#489** (passo 1) mandavam *"confirmar na Pinguim"* porque *"não há navegador
no ambiente Claude Code"*. **Isso deixou de ser verdade** — Chromium e Playwright estão instalados
(`/opt/pw-browsers/chromium`) e `scripts/render-check-cronograma.mjs` já os usa; verificado em
2026-08-23, passando na `main` e saindo com código 1 sob regressão injetada (`--largura 148px`). Nas
duas, a verificação virou caso de render automatizado.

## As três issues que perderam a dependência de instância viva

Mesma data, mesma razão — decisão do autor de que a correção tem de valer para todos, sem depender de
teste externo. Corpo vivo no GitHub:

| Issue | O que era | O que passou a ser |
|---|---|---|
| **#468** | baseline colado, tirado de `conferir-estudo.ts` nos estudos 5 e 6 de Pinguim | **fixture de regressão dos 4 KPIs** no repo — uma catraca: PR que move KPI sem declarar fica vermelho |
| **#469** | cadastrar 3 operações `[teste]` de equity em Pinguim por `POST`, printar, apagar | **três casos de teste** que afirmam as divergências hoje; o PR que conserta inverte a asserção |
| **#464** | fechava só com a tabela do censo anexada | fecha com **a função de contagem testada + o subcomando**; o número vira comentário, não critério |

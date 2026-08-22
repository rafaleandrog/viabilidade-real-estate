# Rodada 8 — As 20 perguntas, em múltipla escolha

> ✅ **RESPONDIDAS EM 2026-08-22.** As decisões estão na **§ Respostas do autor**, no fim deste
> arquivo, e já foram aplicadas ao texto das issues no GitHub. **Leia as respostas antes das
> perguntas** — várias reformularam o problema em vez de escolher entre as opções oferecidas, e a
> reformulação é o que vale.

> Compilado de **~34 perguntas** espalhadas por 6 documentos desta pasta. **14 foram descartadas**
> — 6 por já terem resposta sua, 8 por duplicidade ou alcance pequeno (apêndice no fim).
> Cada pergunta é respondível **sem abrir outro arquivo**: o fato do código ou da planilha está
> escrito nela, com `arquivo:linha` ou `aba!célula`.
>
> Ordenadas por **quantas issues cada resposta destrava**. Basta responder `Q01 (a)`, `Q02 (c)`…
> — e, onde nenhuma opção servir, escrever livre.

## Índice

| id | tema | A pergunta, em uma linha | destrava |
|---|---|---|---:|
| **Q01** | backend | Existe um caminho de escrita paralelo (script, importador, `PATCH` manual) alimentando `fluxo_pagamento` e `absorcao`? | 5 |
| **Q02** | receitas | O modal de Pagamento ganha campo de taxa de juros e de sinal — e a taxa é por Grupo ou por componente? | 4 |
| **Q03** | ui | O app passa a ter **uma** definição por indicador (Margem, VGV, ROI), ou mantém duas com rótulos distintos? | 4 |
| **Q04** | docs | Aplico as 17 correções de documentação já escritas, incluindo as 3 do `CLAUDE.md`? | 5 |
| **Q05** | ui | Os dois modais destrutivos (Pagamento e Absorção) viram uma issue de merge, ou duas? | 3 |
| **Q06** | funding | O cash sweep do financiamento à produção passa a enxergar o caixa criado por equity e dívida? | 2 |
| **Q07** | funding | Retorno de equity com base mensal negativa: clampa em 0, carrega para frente, ou aceita negativo? | 2 |
| **Q08** | backend | Os dois RETs (`considerar_ret` × `sujeito_ret`) se unificam, se escondem por nível, ou se rotulam? | 3 |
| **Q09** | receitas | `correcao_estoque` e os 5 índices de correção: saem da tela/schema, ou ganham motor? | 2 |
| **Q10** | receitas | Absorção que soma 35% e deixa 65% escorrer para o pós-obra: exibir, validar, ou criar invariante? | 2 |
| **Q11** | funding | A soma dos `pct_retorno` de equity pode passar de 100% da receita líquida? | 1 |
| **Q12** | funding | A corretagem é devida sobre as unidades de permuta física, que nunca foram vendidas? | 1 |
| **Q13** | backend | A obra deve mesmo começar junto com o Pré-lançamento, antes do Lançamento comercial? | 1 |
| **Q14** | funding | Quando a dívida não cabe no horizonte, o app extrapola até a quitação ou marca "não cabe"? | 1 |
| **Q15** | funding | "Resultado final" é `receita líquida − despesa total`, ou o fluxo de caixa livre acumulado? | 1 |
| **Q16** | funding | A base de retorno do equity é uma escolha travada ou a única existente (interruptor bruta × líquida)? | 1 |
| **Q17** | receitas | O resíduo de `ate_marco` com prazo zero vira repasse com juros (EVI) ou fica à vista (app)? | 1 |
| **Q18** | receitas | Área aberta com deflator de 50% entra agora (migração + bump), vira backlog, ou fica de fora? | 1 |
| **Q19** | ui | Item 24: como resolver o cabeçalho "Dormitórios" cortado e a sobra sistemática de 23%? | 1 |
| **Q20** | processo | Quem cria as ~25 issues no GitHub — `gh auth login` e a próxima sessão, ou você à mão? | todas |

---

<<<PERGUNTA>>>
id: Q01
tema: backend
destrava: 5 issues (E-A2-01, E-A2-02, campo de taxa, curva personalizada editável, matriz de regressão)
fontes: A4 §6.2 P2a · A2 §6 E-A2-06 · A5 (estudos 5 e 6 de Pinguim)
---
## A pergunta
Existe algum caminho de escrita além da interface — script, seed, importador, `PATCH` manual — que já alimenta `fluxo_pagamento` e `absorcao` em Pinguim?

## O que você precisa saber para responder
Os **dois estudos mais sofisticados da instância** contêm dado que a tela **não sabe gravar**:
- Estudo 5 tem `componentes[].taxaMensal: 0.0098636` (= 12,5% a.a., a taxa exata da EVI). O modal de Pagamento não tem campo de taxa (`frontend/tela-fluxo-receitas.ts:741-816`) e `fluxoPagamentoParaSalvar` nunca gravou isso.
- Estudo 6 tem `absorcao.modo: 'personalizado'` com curva de 43 meses e `aplicado: true`. `_absorcaoJson()` (`frontend/tela-fluxo-receitas.ts:531-542`) grava **sempre** `'distribuido'`. O motor **lê** `personalizado` (`frontend/fluxo-shared.ts:373-379`); a tela não o produz.

Não é verificável por código — é fato que só você tem.

## Opções
**(a)** Existe e é legítimo (importação, seed, integração) — então ele é cliente de fato do contrato canônico: entra na matriz de regressão, e "campo de taxa" deixa de ser feature nova para virar **a UI alcançando um modelo já em uso**.
**(b)** Existe e é para fechar — a porta é vedada e os dados dos estudos 5 e 6 viram acidente a normalizar; as issues seguem como feature nova, mas com um caso real para testar.
**(c)** Não existe / foi você digitando direto na API uma vez — as issues seguem como feature nova e os dois estudos deixam de contar como evidência de demanda.

## Recomendação
Sem recomendação: não é pergunta de preferência, é de fato. Qualquer das três serve — o que custa é a ausência de resposta, porque três documentos desta rodada assumem **(a)** implicitamente.

## Se você não responder
Toda estimativa de "quantos estudos quebram" desta rodada carrega erro de fonte desconhecida, e as issues E-A2-01/E-A2-02 nascem com escopo indefinido — feature nova e correção de UI são trabalhos de tamanho diferente.
<<<END>>>

<<<PERGUNTA>>>
id: Q02
tema: receitas
destrava: 4 issues (campo de taxa, E-A2-10 bloco somente-leitura, E2 transplante por índice, rótulo Receita Bruta × VGV)
fontes: A2 §4 Q1 e Q3 · A4 §4 P2 e §6.2 P2c · A2 §6 E-A2-10 · A6 §4.1
---
## A pergunta
O modal de Fluxo de Pagamento ganha campo de **taxa de juros de tabela** (e de **sinal**), e — se ganhar — a taxa é uma por Grupo ou uma por componente?

## O que você precisa saber para responder
- A EVI reporta **R$ 8,98 MM = 5,41% do VGV** em juros de tabela (`Areas e Precos!C30`), com **12,5% a.a.** em `Premissas!H14`. Na safra de lançamento isolada, 24,53%.
- **A matemática já existe e já está ligada.** `pagamentosConcentrado` (`frontend/fluxo-caixa-motor.ts:774-786`) capitaliza com a **mesma convenção da planilha**. Falta só a superfície de entrada.
- `fluxo_pagamento` é coluna `json` → **sem migração, sem bump de `versao`**.
- O tipo `ComponentePagamento` já carrega `taxaMensal` **por componente** (`fluxo-caixa-motor.ts:517+`); o adaptador legado fixa `taxaMensal: 0` em quatro pontos (`:589,601,608,617`).
- Sobre o **sinal**: os 15% da tabela curta da EVI podem ser escritos como `prazo_fixo.sinalPct = 15` **ou** como segunda linha de Entrada de 1,5% do total. As duas produzem fluxo idêntico — manter as duas cria dois estudos "iguais" que não conferem na leitura.

## Opções
**(a)** Campo editável, **uma taxa por Grupo/plano**, escrita em todos os componentes na persistência; sinal só por `sinalPct`. — Reproduz a EVI (uma taxa por segmento), a expressividade fica no dado sem sobrecarregar a tela, e o transplante por índice do conserto (risco E2) deixa de ser necessário.
**(b)** Campo editável, **uma taxa por componente**. — Máxima expressividade; quatro campos no modal e nenhum oráculo numérico que exija essa granularidade.
**(c)** Sem campo agora: o modal ganha só um **bloco somente-leitura** — *"Juros de tabela configurados: 12,5% a.a. (não editáveis nesta versão)"* — lido de `componentes[].taxaMensal`. — ~10 linhas, zero lógica, e torna a destruição de dado detectável pelo próprio usuário; o campo editável vira backlog com esse bloco como pré-requisito.
**(d)** Nada: o app se declara oficialmente **sem juros de tabela** e a matemática fica dormente. — Contradiz o estudo 5, que **tem** R$ 1.259.273,59 de juros rodando hoje.

## Recomendação
**(a)**, porque é a granularidade da própria EVI e é a única que também desarma o risco E2 do conserto do modal. Se o apetite for menor nesta rodada, **(c)** é o degrau intermediário honesto — e não conflita com (a) depois.

## Se você não responder
O app continua reportando **zero** juros em todo estudo que passou pelo modal, e a grandeza que responde por 5,41% do VGV segue viva, invisível e não editável.
<<<END>>>

<<<PERGUNTA>>>
id: Q03
tema: ui
destrava: 4 issues (proforma do Avançado, R-A313 estado financeiro, E10, colateral do item 46)
fontes: A6 §7 Q8 e §5.4 · A2 §4 Q2 · A3 §7 R-A313 · A5
---
## A pergunta
O app passa a ter **uma** definição por indicador (Margem, VGV, ROI, Resultado), aceitando que o número exibido hoje no Resumo mude — ou mantém as definições concorrentes e só distingue os rótulos?

## O que você precisa saber para responder
- O **mesmo estudo 5**, na **mesma sessão**, exibe **4 margens líquidas e 3 resultados diferentes** em 12 superfícies.
- Causa nº 1: `frontend/proforma-avancado.ts:92-93` soma o **principal do funding ao custo** e nunca credita as entradas → margem **−47,87%** onde o real é **18,94%**.
- Causa nº 2: `frontend/tela-resumo.ts:159-166` faz a conta **inline**, em vez de chamar `proformaAvancado`.
- Causa de fundo: a sequência dos Passos 23–25 é remontada em **5 arquivos independentes**; não existe um `estadoFinanceiroDoEstudo` como fonte única (R-A313). **Consertar o sinal do funding não reconcilia as 4 margens** — só corrige uma delas.
- Nomenclatura: seus contratos C9/C10 (`inteligencia-evi-incorporacao.md:155-156`) mandam chamar de "Receita Bruta (VGV)" o valor **com** juros, e reservar "VGV potencial" para o valor sem.

## Opções
**(a)** Uma definição por indicador: o Resumo passa a chamar `proformaAvancado`, some a conta inline. — Muda o número que o usuário vê hoje no Resumo; barato.
**(b)** Mantêm-se as duas definições e os **rótulos** passam a distingui-las ("VGV potencial" × "Receita Bruta", "Margem de caixa" × "Margem sobre Receita Bruta"). — Não muda número nenhum, mas exige do usuário a taxonomia interna do motor.
**(c)** (a) **mais** extrair o `estadoFinanceiroDoEstudo` como fonte única dos cinco consumidores. — Elimina a causa, não só o sintoma; é refatoração estrutural e o maior escopo dos três.

## Recomendação
**(c)**, porque (a) sozinha reconcilia as superfícies de hoje e volta a divergir na próxima que alguém escrever — foi exatamente assim que se chegou a quatro. Os rótulos de (b) entram como apoio no tooltip, não como solução.

## Se você não responder
As issues da proforma e do colateral do item 46 ficam **sem critério de aceite** — não dá para dizer qual dos quatro números é o certo.
<<<END>>>

<<<PERGUNTA>>>
id: Q04
tema: docs
destrava: 5 issues de documentação (M1–M17 agrupadas por arquivo) + a seção do `CLAUDE.md` que declara a Rodada 8
fontes: A4 §1 (17 mentiras) e §6.1/§6.4/§6.5 · A6 §7 Q3
---
## A pergunta
Autoriza aplicar as **17 correções de documentação** já escritas — incluindo as 3 que tocam o `CLAUDE.md`, que é contrato?

## O que você precisa saber para responder
As 17 estão confirmadas com **texto substituto pronto**: `padrao-incorporacao.md` 9 · `formulas.md` 3 · `CLAUDE.md` 3 · comentários de `fluxo-caixa-motor.ts` 2. **Zero** em `inteligencia-evi-incorporacao.md`. Três amostras:
- `CLAUDE.md:471-477` afirma que `frontend/exportar.ts:10` define `const R$ = v.toFixed(2)`. **Não define mais** — hoje é `import { fmtR$ } from './viab-format.js'`. É a **segunda vez** que essa nota fica vencida.
- `CLAUDE.md:63-72` apresenta #413/#414/#415/#416 como backlog aberto. **As quatro fecharam** no commit `ba06add` (PR #417).
- `docs/viabilidade/formulas.md:61-86` diz que funding é "modelo de referência, não instalado" e aponta para a epic #239/Capital Stack, **apagado pela #355**. `funding-motor.ts` tem 862 linhas e um golden de 80 períodos.

Quatro lugares do repo ainda negam que o motor de safras esteja ligado ao `calcularFluxo` — e **todos os quatro mentem** desde a #283.

## Opções
**(a)** Aplicar os 17 num PR só de documentação, agora, junto com a seção do `CLAUDE.md` que declara a Rodada 8 aberta (texto pronto em `04-regras-reconciliacao.md` §6.5). — Custo zero de código; nenhum teste muda.
**(b)** Aplicar só os 6 que tocam `CLAUDE.md` e `formulas.md` (contrato + fórmulas) e deixar `padrao-incorporacao.md` para depois. — Metade do valor, e o documento mais lido pelos agentes fica errado.
**(c)** Virar issue por arquivo e não mexer nesta rodada. — Backlog de documentação nunca é priorizado; foi assim que duas dessas notas ficaram vencidas duas vezes.

## Recomendação
**(a)**, porque o texto já está escrito e a única coisa que o impede é uma frase sua. Documentação vencida é a forma mais barata de fazer a próxima sessão redescobrir trabalho já entregue — foi o que aconteceu na auditoria de 2026-08-17.

## Se você não responder
A próxima sessão lê os quatro lugares que negam a integração das safras, acredita neles, e reabre trabalho fechado.
<<<END>>>

<<<PERGUNTA>>>
id: Q05
tema: ui
destrava: 3 issues (modal de Pagamento, E1 modal de Absorção, E-A2-02 "Adicionar linha")
fontes: A6 §7 Q9 e §5.5 · A4 §6.3 E1/E2 · A5 · `09-consertos.md`
---
## A pergunta
Os dois modais que destroem dado ao serem reabertos viram **uma** issue de merge, ou o conserto barato (aviso + confirmação) vem primeiro e o merge depois?

## O que você precisa saber para responder
- `formularioPagamento` **nunca lê `fp.componentes`** e fabrica uma entrada de **15%** que não existe (`frontend/fluxo-pagamento-editor.ts:37`). Passa na validação porque o repasse derivado fecha 100%, e grava **15/30/55** onde estava **0/30/70** — apagando R$ 1.259.273,59 de juros (TIR 18,59% → 17,53%). Corolário de funding: encolhe o retorno do investidor em ≈ R$ 50.371.
- O modal de **Absorção** tem o mesmo defeito: destrói a curva `personalizado` de 43 meses do estudo 6 (VPL −R$ 360.591,41) — e estava **fora** do conserto projetado (E1).
- Os dois anunciam **"sucesso"**. Não há aviso e não há undo.
- O conserto que o B2 escreveu **foi revertido** por decisão sua: a árvore está idêntica à `main`. Isto é escolha da **forma da issue**, não do código.

## Opções
**(a)** Uma issue só: **merge** nos dois modais — o formulário só sobrescreve o que sabe representar, e preserva o que só o dado persistido sabe. — Resolve a classe inteira; é o maior escopo.
**(b)** Duas issues: merge no de Pagamento agora (que tem R$ atrás), Absorção depois.
**(c)** Conserto barato primeiro nos dois — `urbi-banner variante="alerta"` quando o dado persistido tem algo que o formulário não mostra (`componentes` com `taxaMensal > 0`, `absorcao.modo !== 'distribuido'`), mais confirmação antes de aplicar — e o merge como issue separada.

## Recomendação
**(a)**, porque o mecanismo é literalmente o mesmo nos dois e separar garante que o segundo fique para trás — o modal de Absorção já ficou de fora uma vez.

## Se você não responder
E1 fica órfã, e consertar só o Pagamento cria a ilusão de que a classe de defeito foi resolvida.
<<<END>>>

<<<PERGUNTA>>>
id: Q06
tema: funding
destrava: 2 issues (R-A38 cash sweep, R-A313 estado financeiro) — 🔴 muda número
fontes: A3 §5 P5 e R-A38 · A3 §7 R-A313
---
## A pergunta
O cash sweep do financiamento à produção deve passar a enxergar o caixa que o equity e a dívida criam?

## O que você precisa saber para responder
`frontend/funding-motor.ts:726-737` simula **todas** as operações contra o mesmo `fluxoLivreMensal` **desalavancado**: um aporte de equity de R$ 5M no mês 1 **não existe** para o banco na hora de calcular o sweep. Seus Passos 23–24 (`inteligencia-evi-incorporacao.md:1584-1592`) descrevem o oposto.

**Isto não é o waterfall que a #355 apagou** — não há fila, prioridade nem competição por caixa. É ordem de leitura do caixa. Consertar **muda número em qualquer estudo que combine financiamento à produção com dívida ou equity**, o que exige autorização sua e aviso de release.

## Opções
**(a)** O sweep passa a ler o caixa já alavancado pelas demais operações, agora. — Corrige o número; muda estudos existentes.
**(b)** Fica como está, e o app declara — em tela e no doc de funding — que cada operação é simulada sobre o fluxo **desalavancado**. — Nenhum número muda; a divergência com os Passos 23–24 vira decisão escrita.
**(c)** (a), mas **só depois** de existir o `estadoFinanceiroDoEstudo` da Q03. — Sequenciamento: o conserto pressupõe um caixa único, que hoje é remontado por cinco consumidores.

## Recomendação
**(c)**, porque consertar o sweep isolado significa escrever uma **sexta** remontagem do estado financeiro — exatamente o mecanismo que produziu as 4 margens.

## Se você não responder
R-A38 fica sem autorização e nenhuma issue que mexe em número de estudo existente pode ser aberta.
<<<END>>>

<<<PERGUNTA>>>
id: Q07
tema: funding
destrava: 2 issues (R-A314, R-A32) — ⚠️ dois agentes divergiram
fontes: A3 §7 R-A314 · B1 §5 P4 · A3 §2 R-A32
---
## A pergunta
Quando a receita líquida do mês é negativa, o retorno do investidor deve ser clampado em zero, carregado para os meses seguintes, ou aceito como negativo?

## O que você precisa saber para responder
`frontend/funding-motor.ts:441,444` **não tem `max(0, …)`**. Medido: VGV 100M vendido no mês 0, sinal 5%, RET 4%, corretagem 5%, equity 10% em `permuta_financeira`:

```
receita líquida base : −200.000    2.000.000    2.000.000
retorno ao investidor:  −20.000      200.000      200.000
```

O investidor **paga R$ 20 mil ao projeto** no mês do lançamento. Um mês de venda com sinal menor que a corretagem é a forma **normal** de um lançamento, não caso de borda.

**Os dois lados, e nenhum é fraco:**
- **A3 diz que é defeito.** O instrumento irmão já resolveu isto: `frontend/fluxo-caixa-motor.ts:1553-1555,1570`, mesma base, mesmo par de deduções, com **decisão sua** registrada — *"a base líquida nunca fica negativa (clamp em 0)"*.
- **B1 diz que é fiel à spec.** `docs/viabilidade/fluxo-investidor-formulas.md:135` **não** tem `MAX` — e a **mesma planilha usa** `MAX(0; …)` na aba `divida` (`:116`), o que torna a ausência difícil de ler como esquecimento.

**Não há nenhuma operação de equity cadastrada em Pinguim** → risco de regressão hoje é **zero**. É a decisão mais barata de tomar antes que alguém cadastre a primeira.

## Opções
**(a)** Clampar em 0: o mês não gera retorno, sem compensação futura. — Precedente interno (`:1570`); o retorno total cai.
**(b)** Clampar em 0 **com carry-forward**: o negativo abate o retorno dos meses seguintes. — Preserva o total e muda o timing; **mecanismo novo**, sem precedente no app e ausente das duas planilhas.
**(c)** Manter como está, com teste que **fixa** o comportamento e comentário datado em `:441`. — Fiel à letra da spec; o investidor aporta capital extra sem contrato que o preveja.

## Recomendação
**Sem recomendação: os dois agentes divergiram.** B1 tem razão sobre a hierarquia de fontes; A3 tem razão sobre o estado ser irrepresentável num contrato real. Só você decide. **Independente da resposta**, o app deve **dizer em tela** que aquele mês teve retorno negativo — hoje o número atravessa a Reconciliação sem uma palavra.

## Se você não responder
A próxima sessão "conserta" achando que é bug, ou reverte achando que é spec — e a auditoria seguinte reabre a divergência código × spec.
<<<END>>>

<<<PERGUNTA>>>
id: Q08
tema: backend
destrava: 3 issues (E11, limpeza da aba Financeiro/#279, item 3 da lista)
fontes: A1 §5 Q3 · A4 §4 P6 e §6.3 E11 · A6 §5.1 — convergência tripla
---
## A pergunta
Os dois RETs que convivem num mesmo estudo se unificam num interruptor só, ou o do Preliminar apenas some da tela quando o estudo é Avançado?

## O que você precisa saber para responder
São **dois campos independentes que não se sincronizam**:
- `estudos.considerar_ret` / `ret_pct` — o **global**, criado pela #346, editável em Custos → Financeiro (`frontend/tela-fluxo-custos.ts:487-511`) e lido pelo motor do Avançado (`FluxoConfig.ret`).
- `estudos.sujeito_ret` — o **do Preliminar**, editável em Premissas (`frontend/tela-premissas.ts:563`) **e também** em Viabilidade → Financeiro (`frontend/tela-financeiro.ts:171-178`), lido só por `frontend/proforma.ts:245`.

Num estudo **Avançado**, marcar "Sujeito a RET" na aba Financeiro **não muda nada no fluxo** — e essa aba só renderiza no Avançado, onde **9 de 10 controles não fazem nada** (só `taxa_desconto_aa` tem efeito). É exatamente o controle inerte que a #279 se propôs a eliminar.

## Opções
**(a)** Ocultar `sujeito_ret` quando `nivel_analise === 'avancado'`. — Uma condição de render; nenhum dado muda, nenhum número muda.
**(b)** Unificar: um interruptor por estudo, lido pelos dois motores. — Migração de dados e mudança de número em todo estudo cujos dois campos divergem hoje.
**(c)** Manter os dois, com rótulos explícitos: "RET do Preliminar" × "RET do Avançado". — Honesto, mas ensina ao usuário uma distinção que é acidente de implementação.

## Recomendação
**(a)**, porque resolve o controle inerte hoje com custo zero e não fecha a porta para (b) depois. (c) documenta o problema em vez de removê-lo.

## Se você não responder
E11 fica sem forma e a limpeza da aba Financeiro que a #279 começou permanece pela metade.
<<<END>>>

<<<PERGUNTA>>>
id: Q09
tema: receitas
destrava: 2 issues (E7 `correcao_estoque`, remoção de `indice_correcao` do schema)
fontes: A2 §4 Q7 · A4 §4 P5, §3 acidente A1 e §6.3 E7 · A5
---
## A pergunta
`correcao_estoque` sai da tela, e os cinco índices de correção monetária saem do schema — ou algum dos dois ganha motor?

## O que você precisa saber para responder
São **dois problemas com donos diferentes**:
1. `indice_correcao` / `indice_correcao_taxa_aa` — **coluna morta sem UI** desde a #279 (`frontend/tela-financeiro.ts:9-30` é comentário, não render). Cinco índices persistidos, **nenhum lido, nenhum na tela**. A própria #279 registrou que "a remoção física é issue própria".
2. `absorcao.correcao_estoque` — **controle vivo e inerte**: badge Não/Sim interativa no rodapé do modal, ao lado do botão Aplicar (`frontend/tela-fluxo-receitas.ts:597-603`), persistida (`:534`, default em `backend/rotas/avancado.ts:283`), que **nenhuma linha do motor lê**.

Duas medições que reduzem o risco de qualquer decisão: as **6 linhas dos 2 estudos de Pinguim estão em `false`** — não há dinheiro atrás. E a **EVI não usa índice de correção em coluna nenhuma**: embute tudo na taxa nominal de tabela.

O seu próprio `padrao-incorporacao.md:865-874` (§10.6) já especifica o que uma correção de estoque teria de fazer — e o controle de hoje viola a premissa da frase inteira, porque não é nem explícito nem testável.

## Opções
**(a)** Retirar o badge da tela agora (uma linha; o campo continua aceito no JSON e ignorado, **sem migração**) e abrir issue separada para tirar `indice_correcao` do schema. — Elimina o pior formato de campo morto: um controle interativo que o usuário toma por premissa.
**(b)** Especificar e implementar o motor da §10.6. — Depende de correção monetária, que também não existe; é a maior das três.
**(c)** Manter os dois como estão.

## Recomendação
**(a)**. (c) é a única opção que não deveria estar na mesa: o usuário clica, o app grava, e nada acontece.

## Se você não responder
E7 fica aberta e o badge continua vendendo uma premissa inexistente em toda tela de Receitas do Avançado.
<<<END>>>

<<<PERGUNTA>>>
id: Q10
tema: receitas
destrava: 2 issues (E-A2-04 invariante de conservação, E-A2-05)
fontes: A6 §7 Q6 · A2 §6 E-A2-04 e E-A2-05 · A5
---
## A pergunta
Uma absorção que soma 35% e deixa 65% escorrer para o pós-obra derivado é intencional — e, se for, o app deve apenas **exibir** o derivado, ou também **detectar** quando a distribuição perde venda?

## O que você precisa saber para responder
- As 3 linhas de receita do estudo 5 têm `pre_lancamento 0% + lancamento 15% + obra 20% = 35%`. Os outros **65%** escorrem para o pós-obra derivado, sem que a tela diga isso em lugar nenhum.
- `erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:337-345`) só barra distribuição **acima** de 100%. Não há piso.
- O caso que mostra o custo: no estudo 6, `pos_obra.duracao_meses = 13` é **ignorado** contra a janela fixa de 12, e o app **descarta 1,41% das vendas em silêncio — R$ 2.007.856,95**. Esticar a janela de vendas faz **vender menos**, e nada avisa.

## Opções
**(a)** 35% é intencional e a tela passa a **exibir o total distribuído e o derivado** ("65% no pós-obra"). — Nenhum número muda; o usuário passa a ver para onde foi o resto.
**(b)** Falta validação de **piso**: o formulário exige que as quatro janelas fechem 100%. — Bloqueia estudos como o 5, que hoje são válidos.
**(c)** (a) **mais** um **invariante de conservação** no motor, que falha quando a absorção efetivamente distribuída ≠ 100% do VGV. — É ele, não a série em m², que teria feito o descarte de R$ 2 MM ser barulhento.

## Recomendação
**(c)**, porque (a) sozinha informa e não impede: o descarte silencioso é defeito de **motor**, não de tela, e nenhum rótulo o pegaria.

## Se você não responder
E-A2-04 e E-A2-05 ficam abertas e o descarte de R$ 2 MM segue sem detector — inclusive depois de a Absorção ser "consertada".
<<<END>>>

<<<PERGUNTA>>>
id: Q11
tema: funding
destrava: 1 issue (R-A37 / R-A316)
fontes: A3 §5 P7 e R-A37 · A3 §7 R-A316
---
## A pergunta
A soma dos `pct_retorno` das operações de equity de um estudo pode passar de 100% da receita líquida?

## O que você precisa saber para responder
Hoje **pode**: `backend/rotas/funding.ts:60-65` valida apenas `≥ 0` e **não soma** os `pct_retorno`. Três investidores a 40% distribuem **120%** da receita líquida todo mês.

Três redes ausentes, não uma: o waterfall que capava pelo caixa foi apagado pela #355; o alerta D14 olha o **acumulado** e não dispara em projeto rentável; a rota valida só o sinal.

O seu próprio documento já dizia: `docs/viabilidade/funding-capital-stack.md:578` — *"a soma das participações de receita não pode superar 100%"*. A decisão nº 4 (base do equity não muda) **não revoga isso**: ela fala de deduções, não de soma de participações — e, ao fixar a base, torna `pct_retorno` a **única** variável do lado do equity.

## Opções
**(a)** Validação de rota: `Σ pct_retorno ≤ 100` por estudo, rejeitando `POST`/`PATCH` que estourem.
**(b)** (a) **mais** alerta mensal em tela quando a soma se aproxima de 100%. — Pega também o caso de **um único investidor a 100%**, que é contratualmente possível e quase sempre erro de digitação — e que a validação nominal deixa passar.
**(c)** Sem teto: a soma é responsabilidade de quem cadastra.

## Recomendação
**(b)**, porque a validação sozinha só pega a soma nominal, e o erro que se vê na prática é o de um dígito a mais numa operação só.

## Se você não responder
R-A37 e R-A316 ficam abertas e nada no app segura um estudo distribuindo 140% do que existe.
<<<END>>>

<<<PERGUNTA>>>
id: Q12
tema: funding
destrava: 1 issue (acidente A4 / P7 da Rodada 1)
fontes: A4 §4 P7, §3 acidente A4 e §6.6 (a única pergunta da Rodada 1 ainda inteira)
---
## A pergunta
A corretagem é devida sobre as unidades entregues em permuta física, que nunca foram vendidas?

## O que você precisa saber para responder
`vgvVendidoMensal` usa VGV **bruto**, então a linha obrigatória de Corretagem incide também sobre as unidades permutadas fisicamente. O motor **registra a divergência como unificação incompleta da #227** (`frontend/fluxo-caixa-motor.ts:258-263`) — ou seja, como pendência, **não** como decisão.

Nenhum agente conseguiu medir o efeito: não há estudo com permuta financeira ativa em Pinguim para quantificar. É a única das 7 perguntas da Rodada 1 que atravessou a rodada inteira sem nenhum agente conseguir respondê-la sozinho.

## Opções
**(a)** É devida — o corretor intermediou o negócio do terreno. O comentário de `:258-263` vira **decisão datada** e um teste fixa o comportamento. — Nenhum número muda.
**(b)** É base errada: a corretagem passa a incidir sobre VGV **líquido de permuta física**. — Muda número em todo estudo com permuta física.
**(c)** Vira flag por estudo, como a permuta financeira já tem (`permuta_financeira_base`).

## Recomendação
**(a)** se a prática comercial da empresa for essa — é a única que não mexe em estudo existente, e o custo é um comentário mais um teste. Mas o fato é seu, não do código: se o corretor **não** é remunerado pela unidade permutada, (b) é obrigatória e (a) está cobrando comissão inexistente.

## Se você não responder
O comentário do motor continua dizendo "pendência" e a próxima auditoria levanta isto pela terceira vez.
<<<END>>>

<<<PERGUNTA>>>
id: Q13
tema: backend
destrava: 1 issue (encerra o item 20 da planilha)
fontes: A1 §5 Q1
---
## A pergunta
A obra deve mesmo começar junto com o Pré-lançamento, antes do Lançamento comercial?

## O que você precisa saber para responder
`backend/rotas/avancado.ts:77-91` ancora `pre_lancamento.inicio_mes` e `obra.inicio_mes` no **mesmo mês** (fim do Planejamento), e o `lancamento` só depois do fim do pré-lançamento. Ou seja: **a obra começa antes do lançamento comercial**. É decisão explícita da **#224** e o campo está travado — o item 20 da planilha ("Início de Obra não é travado") está, portanto, correto na `main`.

O contraponto: em incorporação a obra costuma começar **depois** do lançamento, quando a velocidade de vendas confirma a viabilidade — e é isso que sustenta o **gatilho de exposição mínima** do financiamento à produção (`docs/viabilidade/funding-capital-stack.md` §4.3, que continua vigente).

## Opções
**(a)** Está certo e fica travado assim. — O item 20 se encerra e o texto do padrão passa a dizer **por quê**, em vez de deixar a coincidência sem explicação.
**(b)** A obra passa a ancorar no fim do **Lançamento**. — Mudança de motor e de tela; **recalcula o calendário de todo estudo Avançado gravado**.
**(c)** `obra.inicio_mes` volta a ser editável, com o comportamento de hoje como default. — Devolve a premissa ao usuário e reabre o item 20 no sentido oposto.

## Recomendação
**(a)**, porque (b) recalcula todo estudo existente e a #224 escolheu isto de propósito. Se o modelo de negócio exigir (b), é rodada própria com aviso de release.

## Se você não responder
Fica registrado como dúvida em vez de decisão, e a próxima auditoria propõe (b) ou (c) sem saber que a #224 já decidiu.
<<<END>>>

<<<PERGUNTA>>>
id: Q14
tema: funding
destrava: 1 issue (R-A33)
fontes: A3 §5 P4 e R-A33
---
## A pergunta
Quando a dívida não se quita dentro do horizonte do estudo, o app deve extrapolar o saldo até a data contratual de quitação, ou marcar "não cabe no horizonte"?

## O que você precisa saber para responder
A sua planilha busca o saldo **no mês da quitação**, por `ÍNDICE/CORRESP` (`fluxo_investidor_FORMULAS!divida!C74`). O app lê o **último mês do horizonte** — que, quando a quitação é posterior, é um **número parcial exibido como se fosse final**, sem nenhuma ressalva na tela.

Fora esse ponto, `simularDivida` reproduz a planilha **mês a mês** (F = 3.333.333,33 / 6.717.698,23 / 10.153.875,97; TIR batendo em 2·10⁻¹⁰). É a única divergência estrutural da aba.

## Opções
**(a)** Ler o mês da quitação contratual, extrapolando o saldo para além do horizonte. — Fica igual à planilha; o KPI passa a mostrar um mês que a tabela de fluxo não exibe.
**(b)** Manter a leitura de hoje e **marcar "não cabe no horizonte"** no KPI quando a quitação é posterior ao último mês. — Nenhum cálculo muda; o usuário passa a saber que o número é parcial.
**(c)** As duas: extrapolar **e** avisar.

## Recomendação
**(c)**, porque extrapolar sem avisar troca um número errado por um número certo calculado fora do horizonte que o usuário escolheu — e ele não teria como saber.

## Se você não responder
R-A33 fica aberta e o KPI continua exibindo saldo parcial com cara de saldo final.
<<<END>>>

<<<PERGUNTA>>>
id: Q15
tema: funding
destrava: 1 issue (R-A36)
fontes: A3 §5 P2 e R-A36
---
## A pergunta
"Resultado final" é `receita líquida − despesa total` (a sua planilha), ou o fluxo de caixa livre acumulado (o app)?

## O que você precisa saber para responder
A planilha define resultado final como `!equity!C18 − Despesa Total`. O app usa o **fluxo de caixa livre acumulado**, em **três lugares independentes**: `frontend/tela-fluxo-ver.ts:155`, `frontend/tela-funding.ts:206`, `frontend/tela-cenarios.ts:229`.

As duas **coincidem** quando o horizonte cobre o último evento financeiro, e **divergem** quando não cobre. Isso importa porque o `resultadoFinal` do modo `bullet` do equity é calculado sobre essa grandeza.

## Opções
**(a)** A definição do app vira a oficial, escrita no doc de funding, **com alerta** quando o horizonte não cobre o último evento financeiro. — Nenhum número muda.
**(b)** O app adota a definição da planilha. — Muda o número exibido nas três telas e no cálculo do equity bullet.
**(c)** As duas convivem, com rótulos distintos: "Resultado do projeto" × "Caixa acumulado no horizonte".

## Recomendação
**(a)**, porque é o que o app já pratica em três lugares e a divergência só aparece com horizonte curto — que é exatamente o caso a sinalizar, não a recalcular.

## Se você não responder
R-A36 fica aberta e o `resultadoFinal` que o Funding consome continua sem definição escrita em lugar nenhum.
<<<END>>>

<<<PERGUNTA>>>
id: Q16
tema: funding
destrava: 1 issue (E-A2-07 / R-A321)
fontes: A2 §4 Q9 · A3 §7 R-A321 (P8) · decisão nº 4 do autor
---
## A pergunta
A base de retorno do equity que você fixou é **a única existente**, ou é **uma escolha travada** — que poderia ganhar interruptor, como a permuta financeira já tem?

## O que você precisa saber para responder
A sua decisão nº 4 fechou **qual** é a base: `frontend/funding-motor.ts:58-67` fica como está (impostos + corretagem + permuta física, **sem** marketing). Isso não está em discussão.

O que ela não decidiu aparece só quando a EVI encosta no código: **a EVI trata "líquida" como duas grandezas com dois flags independentes** — `Premissas!N17` (base de proforma: deduz imposto + corretagem + **marketing**, 90,26% do VGV) e `Premissas!N18` (base de rateio da permuta financeira: deduz **só** imposto + corretagem). **O app já reproduz esse par** — mas apenas para a permuta financeira (`permuta_financeira_base`, default `bruta`, em `frontend/fluxo-caixa-motor.ts:1549`). O equity **não tem** o interruptor equivalente.

## Opções
**(a)** A base do equity é **sempre** a que o app usa — sem opção. A divergência com as duas planilhas vira **nota datada** em `docs/viabilidade/fluxo-investidor-formulas.md` §4.2 e comentário verbatim em `funding-motor.ts:58-67`.
**(b)** O equity ganha o mesmo interruptor por operação que a permuta financeira já tem (base bruta × base líquida).

## Recomendação
**(a)**, porque é a leitura literal da decisão nº 4 e (b) é feature com zero demanda medida — não há nenhuma operação de equity cadastrada em Pinguim. Nos **dois** casos a **nota é obrigatória**: hoje `fluxo-investidor-formulas.md` §4.2, marcado "comportamento vigente", transcreve `!equity!C18` e descreve um comportamento que o código deliberadamente não tem — que é exatamente o gênero de mentira documental catalogado 17 vezes nesta rodada.

## Se você não responder
A divergência intencional continua indistinguível de bug, e a próxima sessão "conserta" o motor para casar com o documento.
<<<END>>>

<<<PERGUNTA>>>
id: Q17
tema: receitas
destrava: 1 issue (R-A2-07)
fontes: A2 §4 Q6 e R-A2-07
---
## A pergunta
O resíduo de `ate_marco` que cai com prazo zero — venda contratada no próprio mês do marco — vira repasse com juros (como na EVI), ou fica à vista sem juros (como no app)?

## O que você precisa saber para responder
Quando a safra é contratada no mês do próprio marco, não sobra prazo para parcelar: a EVI **rola** a fração para o repasse, com juros, no mês seguinte; o app **paga à vista no mês do marco**, sem juros.

A diferença atinge **uma safra só** — mas justamente a do mês de **maior exposição** de caixa, que é onde o financiamento à produção decide gatilho e sweep.

Vale registrar que, fora este ponto, o app converge com a planilha **célula a célula** nesta família: repasse em `fimObra+1` (#345), venda pós-entrega 100% à vista (#235), `ate_marco` com prazo decrescente por safra (#233).

## Opções
**(a)** Alinhar com a EVI: o resíduo vira repasse, com juros, no mês seguinte.
**(b)** Manter o comportamento atual (à vista, sem juros) e escrevê-lo como decisão datada, com teste que o fixe.
**(c)** Tornar configurável por plano de pagamento.

## Recomendação
**(a)**, porque a EVI é o oráculo numérico desta família inteira de regras e o desvio é de uma safra só — barato de conciliar, e deixa a reconciliação fechando exata. (c) adiciona um controle para um caso de borda.

## Se você não responder
R-A2-07 fica aberta e a reconciliação com a EVI nunca fecha na safra que mais importa.
<<<END>>>

<<<PERGUNTA>>>
id: Q18
tema: receitas
destrava: 1 issue (R-A2-16) — exige migração e bump de `versao`
fontes: A2 §4 Q8 e R-A2-16
---
## A pergunta
A ponderação de preço entre área fechada e área aberta com deflator entra na próxima rodada de implementação, vira backlog, ou fica de fora?

## O que você precisa saber para responder
A EVI pondera o preço de tabela entre **área fechada** e **área aberta** com **deflator de 50%**; ~5,6% da área privativa do projeto é aberta. No exemplo, o preço médio cai de **R$ 9.500 para R$ 9.266,22 (−2,5%)**.

É a **única regra da lista do A2 que altera o VGV potencial** — o topo da cascata — e exige **coluna nova** em `avancado_tipologias`, portanto **migração + bump de `versao`** (as demais regras da rodada cabem em coluna `json` existente).

## Opções
**(a)** Entra na próxima rodada de implementação, com migração e bump. — Muda o VGV de todo estudo que preencher a coluna nova.
**(b)** Vira backlog: issue escrita agora, sem data. — Preserva o conhecimento sem abrir migração numa rodada que não tem nenhuma.
**(c)** Fica de fora: o usuário continua embutindo o deflator no preço médio que já digita.

## Recomendação
**(b)**, porque mexe no topo da cascata e não tem urgência — mas merece issue escrita **agora**, com a fórmula e o deflator, ou o conhecimento se perde junto com o resto da rodada.

## Se você não responder
R-A2-16 fica sem destino e desaparece com o fim da rodada.
<<<END>>>

<<<PERGUNTA>>>
id: Q19
tema: ui
destrava: 1 issue (8-A.4, já escrita e pronta para abrir — falta o critério de aceite)
fontes: A1 §5 Q4 e §4 8-A.4 · A6 §6 item 24
---
## A pergunta
Item 24 — como resolver o cabeçalho "Dormitórios" cortado, sabendo que as larguras em `ch` estão sendo medidas contra a fonte errada?

## O que você precisa saber para responder
Dois problemas, e o segundo ninguém tinha levantado:
- **O corte.** `frontend/tela-empreendimento-tipologias.ts` usa `table-layout: fixed` (`:56`) e `th { overflow: hidden }` (`:63`), sem `white-space`, `overflow-wrap` nem `hyphens`. "Dormitórios" é palavra única de 11 caracteres, que não quebra. **O corte confirmado é só esse** — o A6 diverge do A1 e calcula que "Unidades" provavelmente cabe, no limite.
- **A sobra sistemática.** As larguras estão em `<col>` (`:79-85`), e a folha **não dá `font-size` a `col`**: `1ch` resolve contra **1rem = 16px**, enquanto `td` renderiza a **13px** e `th` a **12px**. As colunas são dimensionadas para dígitos de 16px e preenchidas com dígitos de 13px → **~23% mais largas que a intenção**, ao contrário do comentário `:75-78`, que promete "sem sobra".
- **E `ch` depende de tema:** `--fonte` troca de Montserrat para Chakra Petch no tema cyberpunk, então **toda largura em `ch` muda de tamanho ao trocar de tema**, e o `overflow: hidden` corta em silêncio.

Ressalva: veredito por construção CSS e métrica tipográfica, **não por medição em navegador** — este ambiente não tem browser, por decisão sua.

## Opções
**(a)** Rótulos curtos — "Dorm.", "Unid." — com o texto integral em `title`. — Resolve o corte; inventa abreviação.
**(b)** Deixar o `th` quebrar em duas linhas (`white-space: normal; overflow-wrap: anywhere`). — Preserva integralmente a redução de largura que você pediu e não inventa abreviação; a linha de cabeçalho fica mais alta.
**(c)** Largura por coluna = `max(dígitos pedidos, cabeçalho)`. — Reabre parcialmente a redução de largura pedida no item 24.
**(d)** Trocar `ch` por `min-width` em **px**, calculado para a métrica mais larga, com `tabular-nums` (já declarado em `:55`), **e** deixar o `th` quebrar. — Resolve o corte, a sobra de 23% e a dependência de tema numa mudança só.

## Recomendação
**(d)**, porque (a)/(b)/(c) tratam só o corte e deixam de pé os dois defeitos que o A6 mediu — e o critério "cabe N dígitos" é insustentável enquanto a unidade mudar de tamanho com o tema.

## Se você não responder
A issue 8-A.4 fica escrita mas sem critério de aceite — não dá para dizer quando ela está pronta.
<<<END>>>

<<<PERGUNTA>>>
id: Q20
tema: processo
destrava: todas as ~25 issues (portão operacional, não decisão de modelo — por isso está por último)
fontes: A1 §5 Q5 · B1 §5 P3 · `LEIA-PRIMEIRO.md` § Pendências
---
## A pergunta
Quem transforma os corpos já escritos em issues no GitHub?

## O que você precisa saber para responder
O `gh` **existe** nesta máquina (`/c/Program Files/GitHub CLI`) mas **não está autenticado** — e `git push` **não** resolve, são caminhos de auth diferentes. As ferramentas MCP do GitHub também não estão disponíveis nesta sessão. As 6 issues do bloco 8-A estão com **corpo completo, pronto para colar** (`07-consolidado-issues.md` §1); o bloco 8-B ainda precisa ser consolidado a partir de quatro documentos.

Ponto anexo, de 30 segundos: os itens **43 e 45** da planilha dependem de um print que só você tem. Abrir issue "conferir contra o print" gera backlog sem trabalho; não registrar é como o item 45 chegou até aqui sem ninguém notar que ninguém o verificou.

## Opções
**(a)** Você roda `gh auth login` e a próxima sessão cria as issues uma a uma, com `Closes #NNN` correto.
**(b)** Você cola os corpos à mão no GitHub. — Funciona, mas são ~25 e o risco de perder uma é real.
**(c)** As issues ficam neste arquivo e só o PR de documentação sobe. — O trabalho da rodada vira documento e o backlog não existe.

## Recomendação
**(a)** — é um comando, e sem ele nenhuma das ~25 sai do arquivo. Sobre 43/45: **confira os prints direto** e responda numa linha, em vez de gerar duas issues de conferência.

## Se você não responder
Tudo desta rodada permanece como documento — que é exatamente o estado em que #165–#169 ficaram uma rodada inteira sem ninguém perceber.
<<<END>>>

---

## Apêndice — o que **não** foi perguntado, e por quê

### Já respondidas por você — não voltam à mesa (6)

| Pergunta original | Onde estava | Estado |
|---|---|---|
| Pós-chaves: 12 meses fixos é regra ou lacuna? | A2 §4 Q4 · A4 §4 P1 | ✅ **Regra, 4 × 1.** A EVI vota com a #226 — `cfINC!J` divide por **12 literal**, ignorando os próprios inputs `EtapaChavesDuracao`/`EtapaPosChavesDuracao`. O que sobra é **corrigir `padrao-incorporacao.md:634-643`**, que descreve o app de antes da #226 — está dentro da **Q04**, não é decisão nova. O rótulo mentiroso de `pos_obra.duracao_meses` vira issue (E3). |
| Capital de giro entra? Compete por caixa? | A3 §5 P3 · A4 §4 P4 | ✅ **Só o rótulo.** `divida` já é o produto de CG por calendário — a sua própria planilha rotula a aba como "CG" (`A8 "Valor CG (R$)"`, `B18 "Libera CG"`). O `linha_credito` rotativo foi **recusado**: sem migração `030`, sem bump para 0.1.29. Sobra issue de vocabulário (E9 / R-A319). |
| O marketing entra na base de retorno do equity? | A3 §5 P1 | ✅ **Não muda.** `funding-motor.ts:58-67` fica como está. O que restou é a **Q16** (a base é escolha travada ou única?) e a nota obrigatória. |
| Os 3 bugs graves são consertados nesta rodada? | digest, decisão 1 | ✅ **Não.** Tudo vira issue; os consertos foram revertidos e a árvore está idêntica à `main`. |
| Consertos não commitados na árvore — o que são? | B1 §5 P6 | ✅ Respondida pela sessão principal: eram do agente B2, e foram revertidos. |
| Os itens 43/45 e a criação das issues | A1 §5 Q5 · B1 §5 P3 | Absorvidas pela **Q20**. |

### Descartadas por duplicidade — uma pergunta por decisão (8 fusões)

| Perguntas fundidas | Virou |
|---|---|
| A2 Q1 (taxa por plano ou componente) + A2 Q3 (sinal × entrada) + A4 P2c + E-A2-10 | **Q02** |
| A6 Q8 (unificar margem/VGV/ROI) + A2 Q2 (renomear VGV) + R-A313 | **Q03** |
| A6 Q3 (corrigir `CLAUDE.md:471-477`) + as 17 mentiras documentais do A4 | **Q04** |
| A6 Q9 (modais destrutivos) + A4 E1 (Absorção fora do conserto) + A5 | **Q05** |
| A3 R-A314 (defeito) + B1 P4 (fiel à spec) + A3 R-A32 — a divergência canônica | **Q07** |
| A1 Q3 (dois RETs) + A4 P6 + A6 §5.1 — convergência tripla | **Q08** |
| A2 Q7 (`correcao_estoque` + `indice_correcao`) + A4 P5 + A4 acidente A1 + E7 | **Q09** |
| A2 Q9 (duas noções de "líquida") + A3 R-A321/P8 | **Q16** |

### Cortadas por alcance — a recomendação segue como padrão, e uma linha sua a derruba

| Não perguntada | Fonte | O que vai acontecer sem sua resposta |
|---|---|---|
| **Tarifas bancárias** (estruturação, administração, laudo, IOF) entram no modelo? | A3 §5 P6 / R-A39 | Vira issue de **adição pura com default `0`**: nenhum estudo existente muda de número. Se você não quiser o campo, feche a issue. |
| **Corretagem "destacada × embutida"** ainda deve interferir? | A1 §5 Q2 | **Não interfere desde a #228** e `frontend/fluxo-caixa-motor.test.ts:381-403` fixa a equivalência (a razão foi acabar com a dupla dedução). O campo continua persistido (`fluxo-pagamento-editor.ts:32-36`) e nunca lido — dado morto. Fica como está; a issue 8-A.5 manda não mexer. |
| **`avancado_capital_instrumentos`** sai do `schema.json`? | A6 §7 Q4 / R-A318 | **Não apagar.** Guarda `tipo: 'capital_giro'` e o dado migrado pela `019`, e não há DDL na camada de migração — removê-la deixaria tabela órfã inalcançável. Vira issue de **etiqueta `descricao` + guard** contra reúso acidental. |
| **Financiamento à produção** segue fora da planilha nova? | A4 §4 P3 | Sim — a §4.3 de `funding-capital-stack.md` foi preservada de propósito pela #355, e a #405 aprovou catch-up retroativo e cash sweep. **Nenhum agente propôs alinhá-lo à aba `divida`**, então o risco não se materializou. Nada a fazer. |
| **Repasse antecipado na assinatura** (R-A2-13): implementar sem oráculo? | A2 §4 Q5 | **Adiar.** As colunas existem na EVI, nomeadas e cabeadas, mas **zeradas** — é a única regra da lista sem oráculo numérico. Implementar às cegas contra a fórmula é como se criam divergências que ninguém consegue refutar. |
| **`viab-num`** continua fork, ou vira pedido ao monorepo? | A6 §7 Q1 | Vira issue **neste** repo com o texto pronto para você levar ao monorepo (o caminho permitido): *"`urbi-input-numero` precisa de modo de exibição agrupado pt-BR"*. O fork de 210 linhas fica onde está enquanto isso. |
| **Guard de aspas curvas** com duas brechas (`= ”x”` com espaço, `="x”` mista) | A6 §7 Q2 | O repo está **limpo hoje** nos três padrões. É mudança de 1 linha em `scripts/validar-frontend.sh:66`; entra junto com o próximo PR que tocar o script. |
| **`rotulo` vira contrato?** (`"ao longo da obra (legado)"` como carimbo do adaptador) | A4 §6.2 P2b | **Não vira.** Ele foi usado como forense nesta rodada e funcionou, mas depender dele de novo é depender de string de UI. A distinção legado × canônico deve sair de `componentes`, não do rótulo. |
| **"Definições" órfã de Receitas** (item 31): consertar junto ou separado? | A6 §7 Q7 | Junto — está no mesmo arquivo, a 15 linhas do modal do achado 4.1. Já coberto pela issue **8-A.5**. |
| **Item 2** ("Produtos é a última da lista"), **item 10** (zeros nos subtotais), **item 41** (bloco de detalhamento do financiamento) | B1 §5 P1, P2, P5 | Cada um é uma frase sua e nenhum destrava mais de uma issue cosmética. Recomendações registradas nas issues: item 2 → **manter a ordem atual** (leitura do implementador, commit `74cb2c7`); item 10 → **(b)**, some o grupo inteiro quando todos os seus itens são zero, mantendo sempre `= Resultado` e `= Receita líquida`; item 41 → **remover** o bloco, cuja informação já está nas linhas de Custos Financeiros, com total/VPL zerados. Discorde numa linha e a issue muda. |
| **`modo_retorno` e `valor`** fazem sentido nos 3 tipos de operação de funding? | A6 §7 Q5 | As 4 operações da instância têm `modo_retorno: "permuta_financeira"` — **inclusive as duas de `financiamento_producao`**, com `valor: "0.00"` e `pct_retorno: "0.00"`. Vira issue de **esconder o campo por tipo**, com a ressalva de que é a única desta auditoria que um print seu resolveria em 5 segundos. |
| **Estudo-semente em Pinguim** com uma operação de cada tipo e um cenário não-vazio | A3 R-A317 · A4 E8 | Não é pergunta, é **issue de dado de homologação**: hoje equity e cenários **não são conferíveis nem pela instância nem pela suíte** (o golden de funding reconstrói a própria entrada, `funding-motor.test.ts:126-144`). As issues de equity precisam registrar no corpo que **não podem ser fechadas por conferência numérica**. |

---

# Respostas do autor — 2026-08-22

As 15 decisões desta sessão, na forma em que foram dadas. **Três delas não escolheram nenhuma das
opções oferecidas: reformularam o problema.** Essas estão marcadas 🔄 e são as mais importantes,
porque a pergunta é que estava mal feita.

## 🔄 As três reformulações

### D1 — `pos_obra` e Pós-chaves são DUAS variáveis, não uma
*(pergunta original: a janela de vendas passa a obedecer `pos_obra.duracao_meses`, ou o campo ganha
cadeado? — resolve **#430**)*

> *"A taxonomia deve estar igual, mas representam duas variáveis diferentes. Em Cronograma, o prazo
> de pós-obras refere-se a um período que interfere os custos escolhidos nessa seção de desembolsos
> relacionados a serviços de pós-obras ou qualquer outro custo que seja escolhido dentro desse prazo
> no cronograma. O outro que está constante em 12 meses na verdade se chama **Pós-chaves** e
> interfere a duração de pagamento e período de vendas assim como pré-lançamento, lançamento e
> durante as obras interferem o quanto é vendido em cada período. Ajuste essa taxonomia e a
> identificação de cada campo corretamente para separá-los e não tratar como o mesmo."*

**O que isso desfaz:** a auditoria descreveu "dois destinos opostos para o mesmo campo" e propôs
escolher um. Nunca foram o mesmo campo. **Os 12 meses do Pós-chaves ficam** (a EVI vota com a #226 —
`cfINC!J` divide por 12 literal); o que muda é a separação de taxonomia.

### D2 — Não existe operação "fora do horizonte"
*(pergunta original: `saldoFinal` extrapola até a quitação ou devolve `null`? — resolve **#446**)*

> *"não tem essa de cair depois do fim do estudo. todo o estudo é mapeado e o fluxo vai até o último
> mês que é enquanto alguma coisa está entrando ou saindo do fluxo, só isso. se existe um limite de
> meses que atrapalha isso, então o número de meses no fluxo deve ser sempre o maior possível.
> corrija isso."*

**Conferido, e ele está certo** — `frontend/fluxo-caixa-motor.ts:1762-1766`:

    const prazoDerivado = Math.max(ultimoCrono, ultimoRecebivel, ultimoCustos, 11) + 1;
    const prazo = Math.max(1, Math.round(n(config.prazoMeses) || prazoDerivado));

Dois defeitos: as operações de **funding não entram no `max`**, e `config.prazoMeses` **substitui**
o derivado em vez de servir de **piso**. `saldoFinal` (`frontend/funding-motor.ts:509`) é
consequência, não causa.

### D3 — A taxonomia de resultado deve casar com a EVI
*(pergunta original: renomear `margemBrutaPct` ou trocar a fórmula? — resolve **#453**)*

> *"você precisa olhar a planilha para comparar com os nomes, campos e taxonomia usada no app
> atualmente. devem ter receita bruta, líquida, operacional, resultado líquido, adeque cada um
> calculando a fórmula correta."*

**Conferido contra `20260730_EVI_Urbita_corrigido.xlsx`:**

| EVI Urbitá | App hoje | Veredito |
|---|---|---|
| `Receita bruta (VGV)` | `vgv` | ✅ mesmo conceito |
| `Receita líquida` | `receitaLiquida` | ✅ |
| `Custo direto total` | `custoDireto` | ✅ |
| `Custo indireto total` | `custoIndireto` | ✅ |
| `Resultado` | `resultado` + `margemLiquidaPct` | ✅ |
| `Resultado + Perm. Financ.` | — | ❌ ausente |
| `Resultado + Permutas` | — | ❌ ausente |
| % VGV da linha Receita líquida (81,03%) | `margemBrutaPct` | ⚠️ **nome errado** |

Duas conclusões: **a EVI não tem "Receita operacional" nem "Resultado líquido"** — a espinha dela é
exatamente a do app, e faltam só as duas variantes de resultado. E **`margemBrutaPct` não é uma
margem**: `frontend/proforma.ts:315` calcula `receitaLiquida / vgv * 100`, que é a coluna "% VGV" da
linha Receita líquida da planilha, e a EVI não chama isso de margem. **Conserto é de nome, não de
fórmula** — nenhum número muda.

## As outras 12

| # | Assunto | Decisão | Issue |
|---|---|---|---|
| D4 | Bases dos três resultados | **Cada linha tem a sua**: `Resultado + Permutas` ÷ (VGV + permutas físicas); as outras duas ÷ VGV. Reconcilia os 6,1% / 15,3% / 22,8% do print | #427 |
| D5 | Equity com receita líquida mensal negativa | **Clampar com carry-forward** — o mês paga zero e o déficit abate os seguintes. É decisão **nova**, não restauração do clamp da #355 | #432 |
| D6 | Âncora da obra × Pré-lançamento | **Escolha do usuário** — destrava o que a #224 travou (`travado_inicio`) | *issue nova* |
| D7 | Corretagem sobre permuta física | **Configurável por estudo**, default = comportamento atual | #473 |
| D8 | Aba Financeiro do Avançado | **Sete controles saem**; `imposto_percentual` fica **desabilitado com nota** ("vale só no Preliminar") | #450 |
| D9 | Preliminar × Avançado divergindo | **Reconciliar as duas camadas** | #441 |
| D10 | Regiões monitoradas | **Aba de topo**, no padrão da #314 | #437 |
| D11 | Base de receita líquida do equity | **Sempre a mesma, sem interruptor** → fecha sem código, apontando para #465 | #480 |
| D12 | Bloco de detalhamento do financiamento | **Remover** da tabela principal | #472 |
| D13 | Repasse antecipado na assinatura | **Fora de escopo** — não é praticado | #461 |
| D14 | Ordem das abas do Preliminar | **Produtos depois de Permutas** — leitura literal do item 2 | #483 |
| D15 | Paleta do gráfico de custos | **8 tokens categóricos + 4 de escala = 12**, preservando a contagem atual | #476 |

## Decisões anteriores, ainda vigentes

Tomadas antes desta sessão e já carimbadas nas issues: capital de giro **só o rótulo** (o rotativo
`linha_credito` foi **recusado**) · base do equity **não muda** · Pós-chaves **12 meses** · taxa de
juros **por Grupo**, não por componente · corrigir o erro da proforma **sem unificar** as definições
de margem (a refatoração `estadoFinanceiroDoEstudo` foi **recusada**) · as **17 correções de
documentação** estão autorizadas · os dois modais destrutivos viram **uma issue só** ·
`sujeito_ret` **oculto** no Avançado · `correcao_estoque` **não mexer**, decisão adiada de propósito.

## O que ainda não foi decidido

Depois desta sessão sobra **uma** issue com label `decisao`: **#484** (`correcao_estoque`), e ela
está adiada **de propósito** — o autor pediu o caminho que não muda nada. As outras cinco que
carregavam o label foram resolvidas: #430, #432, #473 e #483 pelas decisões acima, e #480 fechada.

O custo de adiar a #484 está declarado no corpo dela e vale repetir: enquanto durar, o badge
"Correção de estoque" segue clicável na tela de Receitas, o app grava o valor, e **nenhum código o
lê** — quem usar pode crer que configurou uma premissa que o motor ignora.

O **apêndice** acima (12 perguntas cortadas por alcance) não virou issue: cada uma tem a
recomendação que vale como padrão se ninguém decidir o contrário.

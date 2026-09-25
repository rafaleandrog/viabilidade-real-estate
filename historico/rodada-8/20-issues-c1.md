<<<ISSUE>>>
title: fix(proforma): parar de contar o principal do funding como custo na proforma do Avançado
priority: 1
sources: 05-conferencia-numerica.md §D14 · §D15 · 06-auditoria-ui.md §5.4 · 09-consertos.md BUG 1
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
<<<END>>>
<<<ISSUE>>>
title: fix(receitas): modal de Fluxo de Pagamento para de reescrever o plano persistido
priority: 1
sources: 05-conferencia-numerica.md §D10 · 06-auditoria-ui.md §4.1 · §5.5 · 09-consertos.md BUG 2
---
## Contexto
Quatro lentes independentes convergiram (A2 pela planilha, A4 pelo código, A5 pela instância, A6 pela UI). O A5 mediu contra os dados reais de Pinguim: o estudo 5 tem `taxaMensal: 0.0098636` (= 12,5% a.a., a taxa exata da EVI) persistida e produzindo juros; o estudo 6 tem tudo zerado **porque passou pelo modal**. O conserto foi projetado, revisado e executado em verde, e depois **revertido por decisão do autor** (`09-consertos.md`, aviso do topo).

> ⚠️ **A afirmação antiga de que `jurosClientes` é sempre 0 está REFUTADA.** A formulação certa é: **os juros existem e viram zero no primeiro "Aplicar"**. Nenhuma issue deve dizer que juros de tabela nunca existem.

## Comportamento atual
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

## Consequência
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

## Comportamento esperado
> **Abrir o modal e aplicar sem alterar nada é NO-OP.** O `fluxo_pagamento` resultante é igual ao de entrada, `taxaMensal`, `sinalPct` e `rotulo` inclusive. E aplicar de novo sobre o que foi gravado também não move nada (idempotência).

Quando o usuário **edita de verdade** o espelho legado, a estrutura acompanha a edição e **o que o espelho legado não sabe representar sobrevive** à regeneração.

Atendível **sem campo novo na UI** — nenhum controle de taxa é adicionado por esta issue.

## Como corrigir
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

## Critério de aceite
Testes em `frontend/fluxo-pagamento-editor.test.ts`, sobre a fixture `FP_TABELA_LONGA` que reproduz o shape real da linha "Tabela longa" do estudo 5 (`entrada: []`, parcelamento de 30%, repasse derivado de 70%, `taxaMensal = 0.0098636` no componente `ate_marco`):

1. **`abrir o modal e aplicar SEM MUDAR NADA é no-op — inclusive taxaMensal e sinalPct`**: `form.entrada` continua `[]`; `salvo.componentes` é `deepEqual` ao original; `taxaMensal` intacta; `0/30/70` continua `0/30/70`; aplicar de novo sobre o gravado também não move nada.
2. **`editar de verdade o espelho legado regenera — e preserva o que o legado não sabe dizer`**: mudar o parcelamento de 30% para 40% produz `ate_marco 40` + `concentrado 60`, e a taxa **sobrevive**.
3. **`linha sem componentes canônicos segue no comportamento de sempre`**: sem `componentes` persistidos os placeholders continuam nascendo (`15/15/70`) e a regeneração é integral.
4. **Os três testes de identidade, que a versão por índice reprovaria**: **adicionar** linha, **remover** linha e **reordenar** linha no espelho legado — em nenhum dos três a `taxaMensal` de um componente preexistente vai a zero.
5. **Teste de regressão que assere o funding, não só a receita** — o retorno do investidor do estudo 5 não muda ao aplicar sem alterar nada (o dano de ≈ R$ 50.371 medido pelo A3).
6. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- **Campo de taxa de juros e de sinal no modal.** É *feature*, não conserto: esta issue faz o modal parar de **destruir** o dado, mas ele continua **sem superfície para digitá-lo**. Issue própria do bloco 8-B.
- O modal de **Absorção**, que sofre do mesmo mecanismo por outro caminho — issue própria.
- `fluxo_pagamento.ret` por linha, morto desde a #346.
- `manifesto.json`: `fluxo_pagamento` é coluna `json` — **sem migração, sem bump de `versao`**.
<<<END>>>
<<<ISSUE>>>
title: fix(avancado): PATCH de tipologias valida saldo antes de gravar quantidade
priority: 1
sources: 05-conferencia-numerica.md §D3 · 09-consertos.md BUG 3
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
<<<END>>>
<<<ISSUE>>>
title: fix(absorcao): janela de vendas respeita a duração do Pós-obras e nenhuma venda é descartada em silêncio
priority: 1
sources: 05-conferencia-numerica.md §D6 · §D17 · 06-auditoria-ui.md §5.3/C2 · §1
---
## Contexto
Três lentes convergiram (A4 pelo código, A5 pela instância, A6 pela UI). O A5 precificou: é a única das três lacunas do dossiê §4.5 item (e) com número real atrás. `09-consertos.md` registra explicitamente que este defeito **não estava coberto** pelos três consertos revertidos e **continua sendo issue própria**.

## Comportamento atual
Duas peças, na mesma cadeia:

1. **A janela é fixa.** `faixasAbsorcao` ancora o Pós-chaves em `pos_obra.inicio_mes` com duração **fixa** `APOS_CHAVES_MESES = 12` (`frontend/fluxo-shared.ts:237`, usada em `:281`), **ignorando** o `pos_obra.duracao_meses` que o cronograma do estudo declara.
2. **O que cai fora da janela é jogado fora sem uma linha de aviso.** `absorcaoMensal` (`frontend/fluxo-shared.ts:374-377`, confira pelo conteúdo — é o laço do ramo `modo === 'personalizado'`):

       for (const m of absorcao.meses) {
         const idx = n(m?.mes) - periodo.inicio;
         if (idx >= 0 && idx < tamanho) pcts[idx] += n(m?.pct);
       }

   **Sem `else`, sem `throw`, sem log, sem retorno de resíduo.** O percentual do mês que não cabe simplesmente some — não é redistribuído.

E o campo tem **dois destinos opostos** sob um único rótulo:

| Consumidor de `pos_obra.duracao_meses` | Comportamento |
|---|---|
| **Janela de absorção** (`frontend/fluxo-shared.ts:281`) | 🔴 **descartado** — `fim = inicio_mes + APOS_CHAVES_MESES − 1` |
| **Ancoragem de custo** (linhas ancoradas em `pos_obra`) | ✅ **obedecido** — a duração real vale |

O campo aparece **editável e sem cadeado** na linha "Pós-obras" (`frontend/tela-fluxo-cronograma.ts:269,276` só desabilitam quando `travado_duracao === true`, e os dois estudos têm `false`). A tela **tem** o vocabulário para avisar — o cadeado 🔒 com `title="Calculado automaticamente"` existe e é usado nos campos que o backend trava. **`pos_obra.duracao_meses` é o único campo do Cronograma que o motor sobrescreve sem que a tela avise.**

## Consequência
Estudo 6 de Pinguim: `absorcao.meses` tem **43 pontos, meses 11 a 53, somando 100,0000000001%**; a janela do motor é **11..52**. O ponto do mês 53 é descartado (`idx = 42 >= tamanho = 42`).

| Grandeza | Esperado (curva gravada) | Obtido (motor) | Δ |
|---|---:|---:|---:|
| Absorção efetiva, nas 3 linhas | 100,0000% | **98,5900%** | **−1,4100 pp** |
| Venda bruta contratada | R$ 142.401.199,98 | R$ 140.393.343,03 | **−R$ 2.007.856,95** |
| Resultado final | R$ 30.172.333,96 | R$ 28.358.402,21 | **−R$ 1.813.931,75** |

O estudo 5, com `pos_obra.duracao_meses = 12`, fecha 100,0000% e não perde nada. **A perda só aparece quando o usuário estica o Pós-obras — que é exatamente quando ele acha que está ganhando janela de venda.** Esticar a fase faz **vender menos**, e nenhuma tela reporta a perda; `erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:337-345`) tampouco olha para isso, porque só valida a soma dos três primeiros blocos.

## Comportamento esperado
Nenhum percentual de absorção gravado pode desaparecer do cálculo sem que o usuário seja informado. Duas saídas, **e a escolha é do autor** — as duas são defensáveis:

- **(a) o motor passa a respeitar `pos_obra.duracao_meses` na janela de absorção**, como já respeita na ancoragem de custo. É o que o usuário espera do campo que ele editou; muda o número dos estudos que hoje truncam. **Recomendada** — é a única que faz um campo com um rótulo ter um significado só.
- **(b) o campo continua não valendo para vendas, e a tela passa a dizer isso** — nota ao lado do campo ("a janela de vendas é fixa em 12 meses") **mais** um erro de validação quando a curva personalizada tem pontos fora da janela, em vez do descarte mudo.

Em **qualquer** das duas, o descarte silencioso de `frontend/fluxo-shared.ts:374-377` deixa de existir: ou o ponto cabe, ou o usuário é avisado.

## Como corrigir
- Se **(a)**: `frontend/fluxo-shared.ts:281` passa a usar a duração declarada em vez de `APOS_CHAVES_MESES`; `APOS_CHAVES_MESES` vira **default** para cronograma sem `pos_obra.duracao_meses`, não teto. Reler o comentário de `:229-232`, que registra a decisão anterior — ele precisa ser reescrito junto, senão passa a mentir.
- Em **qualquer** cenário: o laço de `:374-377` ganha o ramo que falta — acumular o resíduo descartado e devolvê-lo, para `erroFormularioAbsorcao` (`:337-345`) recusar a aplicação (ou a tela exibir alerta) quando `resíduo > 0`.
- ⚠️ Mexer na janela de absorção **muda número de estudo existente**. O PR precisa declarar quais e quanto — para os estudos 5 e 6, os números estão na tabela acima.

## Critério de aceite
1. Teste em `frontend/` com uma curva personalizada cujo último ponto cai fora da janela: **falha a aplicação ou soma 100%** — em nenhum caso o total efetivo fica em 98,59% sem que nada seja reportado.
2. Teste de que `Σ pcts` da saída de `absorcaoMensal` é igual a `Σ absorcao.meses[].pct` sempre que a função retorna sem erro.
3. Se a saída for (a): teste com `pos_obra.duracao_meses = 13` produzindo janela de 13 meses; e teste de regressão com `= 12` mantendo o comportamento atual (estudo 5 não pode mudar).
4. `grep -n "APOS_CHAVES_MESES" frontend/fluxo-shared.ts` — nenhuma ocorrência que fixe a **janela de absorção** sem consultar o cronograma (se a saída for (a)).
5. Reexecutar `scripts/conferir-estudo.ts 6` contra Pinguim: venda bruta contratada **R$ 142.401.199,98**, se (a).
6. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- O modal de **Absorção** apagar a curva personalizada ao ser reaberto — mesmo dado, outro mecanismo, issue própria.
- A validação de **piso** da soma de absorção (as 3 linhas do estudo 5 somam 35% e o resto escorre para o pós-obra derivado). Depende de resposta do autor (`06-auditoria-ui.md` §7 Q6).
- Renomear a fase ou mexer na ancoragem de custo, que hoje está **correta**.
<<<END>>>
<<<ISSUE>>>
title: fix(receitas): modal de Absorção para de apagar a curva personalizada
priority: 1
sources: 05-conferencia-numerica.md §D18 · 06-auditoria-ui.md §5.5
---
## Contexto
O A5 encontrou na instância Pinguim uma curva de absorção **personalizada de 43 pontos mensais**, gravada e ativa no estudo 6 — e o A6 confirmou no código que a UI de hoje não sabe nem exibir nem recriar essa curva, mas sabe destruí-la. Mesmo mecanismo do modal de Fluxo de Pagamento, por outro caminho.

> ✅ **Correção a documentação anterior, que esta issue precisa carregar:** o dossiê afirmava que `modo: 'personalizado'` *"existe no motor mas a UI nunca o grava"*. A primeira metade é exata; a segunda esconde o que importa — **o modo existe na instância, com `aplicado: true`**. Não é lacuna de funcionalidade: é **dado vivo em rota de colisão**. Nenhuma issue deve dizer "modo personalizado nunca é usado".

## Comportamento atual
- `frontend/tela-fluxo-receitas.ts:516-527` — `_abrirAbsorcao` lê **só `correcao_estoque` + os 3 percentuais de bloco**. Nunca lê `absorcao.modo` nem `absorcao.meses`.
- `frontend/tela-fluxo-receitas.ts:527-542` — `_absorcaoJson` grava **`modo: 'distribuido'` hard-coded** (`:533`) e reconstrói `blocos` do zero, com 4 eventos fixos.
- `frontend/fluxo-shared.ts:337-345` — `erroFormularioAbsorcao` só barra soma **acima** de 100%; nada olha para o que está sendo sobrescrito.
- `frontend/tela-fluxo-receitas.ts:661` — o caminho termina em `urbiVerso.notificar('Absorção de vendas aplicada.', 'sucesso')`.

Nenhuma `urbi-banner variante="alerta"` no corpo do modal avisa que aplicar reescreve o registro inteiro; a única `urbi-banner` ali é `variante="erro"`, e só quando a validação falha (`:817-818`). **Sem aviso, sem confirmação, sem undo.** O backend aceita o blob sem validar `modo`.

## Consequência
Cenário medido: o usuário abre o modal de Absorção do estudo 6 e clica em **Aplicar sem mudar nada**.

| Indicador | Antes (curva de 43 meses) | Depois (`distribuido`) | Δ |
|---|---:|---:|---:|
| Venda bruta contratada | R$ 140.393.343,03 | R$ 142.401.199,98 | +R$ 2.007.856,95 |
| Resultado | R$ 28.358.402,21 | R$ 30.172.333,96 | +R$ 1.813.931,75 |
| VPL | R$ 10.416.945,03 | R$ 10.056.353,62 | **−R$ 360.591,41** |

A curva é apagada e substituída pelos 3 blocos. O **VPL cai R$ 360.591,41 mesmo com o resultado subindo**, porque a distribuição no tempo muda — e a curva de 43 meses **não é recriável pela UI**, então a perda é irreversível pela interface.

Note o par com o defeito da janela de absorção: os "+R$ 2.007.856,95" que aparecem aqui são exatamente as vendas que o motor **descartava** da curva personalizada (issue `fix(absorcao): janela de vendas…`). Consertar uma sem a outra troca um dano por outro.

## Comportamento esperado
Abrir o modal de Absorção e aplicar sem alterar nada é **NO-OP**: `absorcao.modo`, `absorcao.meses` e `aplicado` chegam do jeito que estavam.

Quando o dado persistido tem algo que o formulário **não sabe representar** (`absorcao.modo !== 'distribuido'`, ou `meses` com pontos próprios), o usuário é avisado **antes** de aplicar e confirma explicitamente a substituição.

## Como corrigir
O conserto de fundo é o mesmo do modal de Pagamento e tem nome: **o modal reconstrói o JSON persistido a partir de um formulário mais pobre que o dado, em vez de fazer merge.** O que o formulário não sabe representar, ele apaga.

1. **Merge, não reconstrução** — `_absorcaoJson` (`frontend/tela-fluxo-receitas.ts:527-542`) só sobrescreve `modo`/`meses` quando o usuário **editou** os blocos; caso contrário devolve o persistido verbatim, no mesmo desenho de três casos usado no editor de pagamento.
2. **Aviso** — `urbi-banner variante="alerta"` no corpo do modal quando `absorcao.modo !== 'distribuido'`, dizendo que aplicar converte a curva própria em blocos distribuídos, com o número de pontos que serão descartados.
3. **Confirmação** — o app já tem o padrão em casa (`confirmRemoverProduto` em `frontend/tela-premissas.ts`). Reabrir um modal e clicar em "Aplicar" destrói mais dado que aquela exclusão e não confirma nada.

⚠️ Há **duas saídas defensáveis para o escopo**: fazer só (2)+(3) — barato, de UI pura — ou incluir (1), que é o conserto de fundo e é maior. A pergunta está aberta ao autor em `06-auditoria-ui.md` §7 Q9. **Recomendação: (1) é o que fecha o defeito; (2)+(3) sozinhos apenas pedem licença para destruir.**

## Critério de aceite
1. Teste: fixture com `modo: 'personalizado'` e curva de 43 pontos → `_absorcaoJson` sem edição do usuário devolve `deepEqual` ao persistido, `modo` e `meses` inclusive.
2. Teste: com edição real de um bloco, o resultado é `distribuido` com os blocos novos — o caminho de sempre continua funcionando.
3. `grep -n "modo: 'distribuido'" frontend/tela-fluxo-receitas.ts` — nenhuma ocorrência que grave incondicionalmente.
4. Reexecutar `scripts/conferir-estudo.ts 6`: `absorcao.modo` continua `personalizado` depois de um ciclo abrir/aplicar simulado.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- **Editar** a curva personalizada pela UI (criar/mover pontos). É *feature*; esta issue só impede a destruição.
- A janela fixa de 12 meses que trunca a curva — issue própria.
- O modal de Fluxo de Pagamento — mesmo mecanismo, issue própria.
- `manifesto.json`: `absorcao` é coluna `json` — **sem migração, sem bump de `versao`**.
<<<END>>>
<<<ISSUE>>>
title: fix(formatacao): tela e exportação passam a formatar o mesmo número com a mesma regra
priority: 2
sources: 06-auditoria-ui.md §3.3/B4 · §3.3/B5 · §8 A3 · A15
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
<<<END>>>
<<<ISSUE>>>
title: fix(financeiro): aba Financeiro do Avançado para de exibir controles que não fazem nada
priority: 2
sources: 06-auditoria-ui.md §5.1 · §4.3 · §8 A2 · A14
---
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
Nenhum controle editável da aba Financeiro do Avançado é exibido sem ter leitor no Avançado. Para cada um dos 9, exatamente uma das três saídas — **a escolha por controle é do autor**:

- **(a) remover da tela** (o precedente existe: a #279 já removeu 9 controles desta mesma tela);
- **(b) manter, desabilitado, com nota dizendo que só vale no Preliminar** — cabe em `sujeito_ret` e `imposto_percentual`, que têm leitor lá;
- **(c) ligar ao motor** — é *feature*, não conserto, e vira issue própria por controle.

Independentemente da escolha: **um único rótulo por campo**. `imposto_percentual` recebe o mesmo texto nas duas telas; e as duas caixas de RET, se sobreviverem as duas, passam a dizer qual é qual.

## Como corrigir
1. Decidir (a)/(b)/(c) por controle e aplicar em `frontend/tela-financeiro.ts:154-197`.
2. Unificar o rótulo de `imposto_percentual` entre `frontend/tela-financeiro.ts:188` e `frontend/tela-premissas.ts:154`.
3. Desambiguar `sujeito_ret` × `considerar_ret` — ou fundir os dois campos (exige migração e **bump de `versao`**; declare no PR se essa for a escolha), ou rotular cada um pelo nível em que vale.
4. **Não apagar** as colunas do `schema.json` nesta issue: a remoção de coluna passa pelo fluxo canônico com `dados.limparColuna`/`dados.varrerTudo` (shell ≥ 0.53.8) e é decisão à parte.

## Critério de aceite
1. Para cada controle que **permanece editável** em `frontend/tela-financeiro.ts`, existe pelo menos um leitor em `frontend/fluxo-caixa-motor.ts`, `frontend/fluxo-shared.ts`, `frontend/proforma-avancado.ts` ou `frontend/funding-motor.ts` — comprovável por `grep -n "<campo>" frontend/*.ts` no PR, campo a campo, numa tabela.
2. `grep -n "imposto_percentual" frontend/tela-financeiro.ts frontend/tela-premissas.ts` — os dois rótulos são **textualmente idênticos**.
3. `bash scripts/validar-frontend.sh` verde.
4. Confirmação do autor na Pinguim de que a aba não perdeu controle que ele usa. Não há navegador no ambiente Claude Code.

## Fora de escopo
- **Implementar** o regime não-RET (PIS/COFINS/CSLL/IRPJ/ITBI) no motor do Avançado — é feature, e é grande.
- `correcao_estoque` (`frontend/tela-fluxo-receitas.ts:521,534`), controle vivo e inerte da **outra** tela — já é issue do bloco 8-B.
- Remover colunas do `schema.json`.
<<<END>>>
<<<ISSUE>>>
title: fix(indicadores): uma definição por rótulo para Margem líquida, VGV e ROI
priority: 2
sources: 05-conferencia-numerica.md §D15 · 06-auditoria-ui.md §5.4 · §8 A18 · A20
---
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
Duas saídas, e **a escolha é do autor** (pergunta aberta em `06-auditoria-ui.md` §7 Q8):

- **(a)** o **Resumo passa a chamar `proformaAvancado`**, e a conta inline de `frontend/tela-resumo.ts:159-166` some. O app fica com **uma** definição por indicador. **Muda o número que o usuário vê hoje no Resumo** — o PR precisa declarar o antes/depois dos estudos 5 e 6. **Recomendada:** é a única que não exige que o usuário conheça a taxonomia interna do motor.
- **(b)** mantêm-se as duas definições e os **rótulos passam a distingui-las**: "VGV potencial" × "Receita Bruta", "Margem de caixa" × "Margem sobre Receita Bruta". Não muda número nenhum, mas transfere a taxonomia interna do motor para o usuário.

Em **qualquer** das duas, a coluna "VGV" do painel de estudos (`frontend/tela-dashboard.ts:74,289,404`) para de guardar duas grandezas: ou passa a exibir a mesma grandeza nos dois níveis, ou muda de nome.

Esta issue **depende** do conserto de `frontend/proforma-avancado.ts:92-93`: unificar em cima de uma função que soma o principal do funding ao custo propagaria o erro para o Resumo.

## Critério de aceite
1. `grep -rn "margemLiquida\|margem_liquida\|margemPct" frontend/*.ts` — **uma** fórmula de margem líquida no app, ou tantas quantas forem os rótulos distintos, com cada rótulo mapeado a uma só.
2. Se **(a)**: `frontend/tela-resumo.ts` não contém mais conta inline de margem/ROI; chama `proformaAvancado`. Teste afirmando que o valor de margem exibido no Resumo é `=== ` ao exibido na aba Resultados para a mesma fixture.
3. Se **(b)**: teste ou grep provando que nenhum rótulo literal `"VGV"`, `"Margem líquida"` ou `"ROI"` sobrevive em duas telas com fórmulas diferentes por trás.
4. `frontend/exportar.ts:433` continua desambiguando ("Receita Bruta — VGV") e passa a ser **coerente** com a tela que gerou o arquivo.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- O **sinal** do funding em `frontend/proforma-avancado.ts:92-93` — issue própria, e **pré-requisito** desta.
- A divergência Preliminar × Avançado do mesmo estudo (Δ R$ 17,25 M no estudo 5) — outra causa, issue própria.
- Trocar as fórmulas por definições novas de negócio. Esta issue **unifica** o que existe; mudar a definição de margem é decisão do autor e outra issue.
<<<END>>>
<<<ISSUE>>>
title: fix(benchmarks): a régua lê os 9 benchmarks configurados e sinaliza valor fora da escala
priority: 2
sources: 05-conferencia-numerica.md §D11 · §D12
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
- ⚠️ **`margem_bruta` não pode ser ligado antes de a definição ser corrigida** — `frontend/proforma.ts:315` calcula `receitaLiquida / vgv * 100` = **90%**, contra um medidor 30–70. Ver issue `fix(proforma): margemBrutaPct não é margem bruta`, que é **pré-requisito** para este campo específico.
- A faixa dos dois medidores existentes estar mal calibrada para a realidade dos projetos é decisão do autor (a régua é dele, e ele a calibrou em 2026-08-21) — esta issue **não** mexe nos valores de faixa, só faz o app parar de mentir sobre eles.

## Critério de aceite
1. `grep -n "MAPA" frontend/tela-resumo.ts frontend/tela-graficos.ts` — uma definição só, importada nas duas telas.
2. Teste: dado o payload de 9 benchmarks da instância, a função de mapeamento devolve medidor para todos os que têm indicador correspondente, e **lista** os descartados.
3. Teste: `montarMedidor` com valor 70,32 num medidor 20–40 devolve estado "fora da escala" (e não um ponteiro em 40 indistinguível de um valor 40).
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Recalibrar as faixas dos benchmarks — é dado do autor, editável pela tela de configuração.
- Corrigir a definição de `margemBrutaPct` — issue própria, pré-requisito só para aquele campo.
- Adicionar indicadores novos ao app.
<<<END>>>
<<<ISSUE>>>
title: fix(invariantes): VENDA_BRUTA_NAO_RECONCILIA deixa de acusar erro em estudo com permuta física
priority: 2
sources: 05-conferencia-numerica.md §D1
---
## Contexto
O A5 rodou as 7 funções de `frontend/fluxo-invariantes.ts` contra os inputs reais dos estudos 5 e 6 de Pinguim. **13 divergências, e 5 delas são falso positivo do validador, não do motor.** Esta é a primeira, e é determinística.

## Comportamento atual
`validarContratacao` (`frontend/fluxo-invariantes.ts:150-159`) soma o VGV de **todas** as unidades alocadas × absorção. O motor tira a permuta física do VGV vendável (`vgvVendavelLinha`, via `calc.vgvPermutaFisica`). **Os dois nunca podem bater num estudo com permuta.**

## Consequência

| Estudo | Esperado (validador) | Obtido (motor) | Δ | O Δ é exatamente |
|---|---:|---:|---:|---|
| 5 | R$ 154.945.000,00 | R$ 129.009.999,99 | **−R$ 25.935.000,01** | 42 un × 65 m² × R$ 9.500 = R$ 25.935.000 |
| 6 | R$ 169.030.977,56 | R$ 140.393.343,03 | **−R$ 28.637.634,53** | 42 × 65 × R$ 10.640 × 98,59% = R$ 28.637.634,53 |

O painel de Reconciliação mostra **erro vermelho permanente** nos dois estudos — num estudo cujo fluxo está **correto**. É o pior tipo de alarme: **o que treina o usuário a ignorar alarme.** E o app inteiro depende desse painel para sinalizar os erros de verdade (o `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, por exemplo, é verdadeiro positivo e está afogado no meio dos falsos).

## Comportamento esperado
`validarContratacao` reconcilia contra o **VGV vendável** — o mesmo que o motor usa —, descontando `calc.vgvPermutaFisica`. Num estudo correto com permuta física, o painel de Reconciliação fica **limpo**.

## Como corrigir
`frontend/fluxo-invariantes.ts:150-159` passa a deduzir a permuta física do valor esperado, lendo a **mesma** grandeza que o motor (`calc.vgvPermutaFisica` / `vgvVendavelLinha`), em vez de recalcular a soma bruta das alocações. A regra tem de vir do motor, não ser reimplementada — foi a reimplementação que criou a divergência.

## Critério de aceite
1. Teste com fixture que tenha permuta física > 0: `validarContratacao` **não** emite `VENDA_BRUTA_NAO_RECONCILIA`.
2. Teste de regressão: fixture **sem** permuta continua reconciliando e continua acusando uma divergência artificial injetada (a invariante não pode virar sempre-verde).
3. Reexecutar `scripts/conferir-estudo.ts 5 6` contra Pinguim: zero ocorrências de `VENDA_BRUTA_NAO_RECONCILIA`.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- `COMPONENTE_INVALIDO` e `CATEGORIA_CUSTO_DUPLICADA`, também falsos positivos, com causas diferentes — issues próprias.
- `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING`, que é **verdadeiro positivo** e está funcionando (a D14 da #355). Não mexer.
- O estoque comprometido em 276/234 que o `PATCH` sem guarda criou — issue própria; aquele alarme é **verdadeiro**.
<<<END>>>
<<<ISSUE>>>
title: fix(invariantes): COMPONENTE_INVALIDO passa a aplicar a mesma regra que o motor
priority: 2
sources: 05-conferencia-numerica.md §D2
---
## Contexto
Segundo falso positivo determinístico encontrado pelo A5 ao rodar `frontend/fluxo-invariantes.ts` contra os dados reais de Pinguim. A causa raiz é mecânica e tem uma linha só.

## Comportamento atual
O motor converte um `ate_marco` degenerado (`N_s ≤ 0`, venda contratada no próprio mês do marco) em `imediato`, dentro de `componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030-1043`), com comentário explícito: *"não se cria prazo negativo nem se invalida toda a safra"*.

O validador (`frontend/fluxo-invariantes.ts:184`) chama **só** `componentesEfetivosSafra`, que **não** faz essa conversão — e aí `pagamentosAteMarco` (`frontend/fluxo-caixa-motor.ts:733-738`) lança.

**Causa raiz:** `componentesIntegradosSafra` **não é exportada** (`frontend/fluxo-caixa-motor.ts:1030`, sem `export`), então a invariante não tem como usar a mesma regra.

## Consequência
- Estudo 5: **2 erros**, safra 38 / marco 38 (linhas *Tabela curta* e *Tabela longa*).
- Estudo 6: **3 erros**, safra 40 / marco 40 (as três linhas).

O `calcularFluxo` das mesmas linhas roda **sem exceção e produz número**. Ou seja, a mensagem *"converta o componente para imediato ou concentrado"* pede ao usuário que faça **algo que o motor já fez** — e não há nada que ele possa fazer na tela que apague o erro. Junto com o `VENDA_BRUTA_NAO_RECONCILIA`, são 5 dos 9 erros vermelhos que os dois estudos exibem permanentemente.

## Comportamento esperado
A invariante e o motor aplicam **a mesma regra** sobre os mesmos componentes. Um `ate_marco` degenerado que o motor converte para `imediato` **não** produz `COMPONENTE_INVALIDO`.

## Como corrigir
Exportar `componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030`) e usá-la em `frontend/fluxo-invariantes.ts:184` no lugar de `componentesEfetivosSafra`. É a correção mínima e mantém **uma** definição da regra.

Se houver motivo para a invariante não usar a função integrada, a alternativa é a invariante deixar de tratar o caso degenerado como erro — mas aí a regra fica duplicada, que é exatamente a causa deste defeito. **A exportação é a saída preferida.**

## Critério de aceite
1. `grep -n "export.*componentesIntegradosSafra" frontend/fluxo-caixa-motor.ts` retorna a declaração.
2. Teste com safra e marco no mesmo mês (`N_s ≤ 0`): a invariante **não** emite `COMPONENTE_INVALIDO`, e `calcularFluxo` produz o mesmo número de antes.
3. Teste de regressão: um componente genuinamente inválido continua sendo acusado.
4. Reexecutar `scripts/conferir-estudo.ts 5 6`: zero ocorrências de `COMPONENTE_INVALIDO`.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Mudar o comportamento do motor na conversão do `ate_marco` degenerado — ele está **certo** e é o que produz número correto hoje.
- Os outros dois falsos positivos das invariantes — issues próprias.
<<<END>>>
<<<ISSUE>>>
title: fix(invariantes): duplicata de custo considera a subcategoria antes de alertar
priority: 2
sources: 05-conferencia-numerica.md §D5
---
## Contexto
Terceiro falso positivo das invariantes encontrado pelo A5 contra os dados reais de Pinguim. É `alerta`, não `erro`, mas é **garantido** em toda incorporação com permuta.

## Comportamento atual
`validarCustosDuplicados` (`frontend/fluxo-invariantes.ts:222-226`) chaveia por `grupo::categoria` e **descarta `subcategoria`** — que é justamente o campo que distingue as linhas.

## Consequência
No grupo `terreno`, categoria `Preço`, o estudo 6 tem **4 linhas legítimas** (`—`, `Valor à vista`, `Permuta financeira`, `Permuta física`) e leva alerta de duplicata; o estudo 5 tem 2 e leva também. Severidade `alerta`, então não bloqueia — mas é **ruído garantido em todo estudo de incorporação com permuta**, no mesmo painel que já exibe 5 erros vermelhos falsos. O efeito composto é o painel de Reconciliação inteiro perder credibilidade.

## Comportamento esperado
Duas linhas de custo só são reportadas como duplicadas quando `grupo`, `categoria` **e** `subcategoria` coincidem.

## Como corrigir
`frontend/fluxo-invariantes.ts:222-226` passa a chavear por `grupo::categoria::subcategoria`, tratando `subcategoria` ausente/vazia como uma chave própria (para que duas linhas sem subcategoria continuem sendo duplicata entre si).

## Critério de aceite
1. Teste com as 4 linhas de `terreno/Preço` do estudo 6 (`—`, `Valor à vista`, `Permuta financeira`, `Permuta física`): **nenhum** `CATEGORIA_CUSTO_DUPLICADA`.
2. Teste de regressão: duas linhas com grupo, categoria **e** subcategoria idênticos continuam sendo acusadas.
3. Reexecutar `scripts/conferir-estudo.ts 5 6`: zero ocorrências de `CATEGORIA_CUSTO_DUPLICADA`.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- As linhas órfãs `terreno/Preço/—` e `terreno/Preço/Permuta financeira` do estudo 6, ambas com `orcamento_valor: null`. São **preenchimento parcial de dado de teste**, não defeito do app.
- Os outros dois falsos positivos das invariantes — issues próprias.
<<<END>>>
<<<ISSUE>>>
title: fix(estudo): Preliminar e Avançado do mesmo estudo param de descrever projetos diferentes
priority: 2
sources: 05-conferencia-numerica.md §D9 · 06-auditoria-ui.md §5.2
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
Num estudo `nivel_analise = 'avancado'`, ou (a) as abas do Preliminar **não são exibidas**, ou (b) elas são exibidas com aviso explícito de que descrevem a camada de Premissas e **divergem** do Avançado, ou (c) as duas camadas são **reconciliadas** — a permuta física do Avançado se reflete nas Premissas e vice-versa.

**A escolha é do autor.** (c) é a mais correta e a mais cara; (b) é honesta e barata; (a) perde funcionalidade que pode estar em uso.

## Como corrigir
Independentemente da saída escolhida, o mínimo verificável é **detectar e reportar a divergência**: uma invariante nova em `frontend/fluxo-invariantes.ts` que compare, para estudo Avançado, área vendável e quantidade de permuta física entre Premissas e Catálogo, e emita alerta quando divergirem além da tolerância padrão (R$ 0,01 / arredondamento de área declarado).

A perda dos 18% na conversão Preliminar → Avançado (`permuta_fisica_pct: 18.00` com `modo: 'pct_area_venda'` virando `modo: 'area_m2'` com tudo `null`) precisa ser investigada em separado no caminho que faz a promoção de nível — pode ser bug de conversão, e nesse caso é priority 1 por si só.

## Critério de aceite
1. Teste com fixture de estudo Avançado cuja permuta física existe só no Catálogo: a invariante nova acusa divergência.
2. Teste de regressão: estudo com as duas camadas coerentes não acusa nada.
3. Reexecutar `scripts/conferir-estudo.ts 5 6`: a divergência de R$ 91.675,00 / R$ 88.635,00 aparece **reportada**, não silenciosa.
4. Se a saída for (a) ou (b): confirmação do autor na Pinguim de que a aba Proforma de um Avançado deixou de enganar. Não há navegador no ambiente Claude Code.
5. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Unificar as **definições** de margem/VGV/ROI entre as telas — issue própria.
- Apagar as colunas de Premissas do `schema.json`.
- Corrigir o dado já gravado nos estudos 5 e 6 de Pinguim.
<<<END>>>
<<<ISSUE>>>
title: fix(api): campos derivados param de ser persistidos com valor que não é o efetivo
priority: 2
sources: 05-conferencia-numerica.md §D7 · §D8 · 06-auditoria-ui.md §5.3/C7
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
<<<END>>>
<<<ISSUE>>>
title: fix(custos): orcamento_valor deixa de mentir quando existe orcamento_valor_canonico
priority: 2
sources: 05-conferencia-numerica.md §D19
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
<<<END>>>
<<<ISSUE>>>
title: fix(proforma): margemBrutaPct deixa de chamar de margem o que é "1 − deduções"
priority: 2
sources: 05-conferencia-numerica.md §D13 · §D11
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

## Comportamento esperado
`margemBrutaPct` mede margem **bruta**: resultado antes de custos indiretos e financeiros sobre a base declarada — ou o campo é **renomeado** para o que ele de fato é (`receitaLiquidaSobreVgvPct`, "Receita líquida / VGV").

**A escolha é do autor**, e as duas são defensáveis:
- **(a) mudar a fórmula** para uma margem bruta de verdade. Muda número em qualquer superfície que já leia o campo — o PR precisa listar quais.
- **(b) renomear o campo e o rótulo**, e criar `margemBrutaPct` de verdade quando o benchmark for ligado. Não muda número nenhum.

## Como corrigir
Seja qual for a saída, o PR precisa declarar **qual definição de margem bruta a empresa usa** — a fórmula é conhecimento de negócio, não de código. `docs/viabilidade/inteligencia-evi-incorporacao.md` é consultivo e **não governa o runtime**: se ele divergir, isso vira issue, não ajuste automático.

Esta issue é **pré-requisito** de ligar o benchmark `margem_bruta` na issue `fix(benchmarks): a régua lê os 9 benchmarks…`.

## Critério de aceite
1. Teste travando a fórmula escolhida contra um caso conhecido, com o nome do campo batendo com o que ele calcula.
2. `grep -rn "margemBrutaPct" frontend/*.ts` — todos os chamadores exibem um rótulo coerente com a fórmula.
3. Se a saída for (a): o PR lista as superfícies afetadas e o antes/depois nos estudos 1–6.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- Ligar o benchmark `margem_bruta` na tela — issue própria, que depende desta.
- As **outras** definições divergentes (margem líquida, VGV, ROI) — issue própria.
- Recalibrar a meta e as faixas do benchmark, que são dado do autor.
<<<END>>>
<<<ISSUE>>>
title: fix(ui): trocar --cor-superficie-2 por um token que existe no shell
priority: 3
sources: 06-auditoria-ui.md §3.2/B1 · §8 A6
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
title: fix(graficos): pizza de custos passa a usar os tokens categóricos do tema
priority: 3
sources: 06-auditoria-ui.md §3.2/B2 · §8 A7
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
As fatias usam `--cor-categoria-1..8` (e `--cor-escala-*` se precisar de mais de 8), no formato `var(--token, #fallback)` que o resto do app já usa. Se um estudo tiver mais categorias de custo do que tokens disponíveis, a paleta **cicla** ou o gráfico agrupa o excedente em "Outros" — a escolha é do autor.

## Como corrigir
Substituir `PALETA_CUSTOS` por uma lista de `var(--cor-categoria-N, #hex)`, mantendo os hexadecimais atuais como fallback (é o que os outros gráficos fazem, e preserva a aparência atual em qualquer shell que não tenha os tokens). Resolver o caso de mais de 8 categorias explicitamente, em vez de deixar `undefined` cair para a cor default do primitivo.

## Critério de aceite
1. `grep -n "'#" frontend/tela-graficos.ts` — nenhuma cor literal fora da posição de fallback de `var()`.
2. Teste ou inspeção do PR mostrando o comportamento com **mais de 8** categorias de custo.
3. Confirmação visual do autor na Pinguim, nos temas claro e escuro. Não há navegador no ambiente Claude Code.
4. `bash scripts/validar-frontend.sh` verde.

## Fora de escopo
- `--cor-superficie-2` inexistente em `frontend/tela-dashboard.ts` — issue própria.
- O CSS de impressão de `frontend/exportar.ts`.
- Redesenhar o gráfico ou trocar de primitivo.
<<<END>>>
<<<ISSUE>>>
title: fix(textos): tirar da tela as referências internas do repositório
priority: 3
sources: 06-auditoria-ui.md §4.2 · §8 A8
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
<<<END>>>

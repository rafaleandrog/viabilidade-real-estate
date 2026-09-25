# Modelo de dados — evoluções previstas e a que foi cancelada (registro histórico)

> **Registro consultivo, fora da documentação servida.** Estas seções moraram em
> `docs/modelo-de-dados.md` até a Rodada 14 e saíram de lá porque o guia servido descreve só o
> que existe no `schema.json`, em migração e em runtime. Nada aqui é tabela ou coluna a criar —
> só a partir de issue aprovada. O guia vigente é `docs/modelo-de-dados.md`.

## Evolução de domínio prevista para recebíveis

> ⚠️ **Seção consultiva.** Nada aqui existe no `schema.json`, em migração ou em runtime. Ela
> registra os conceitos que o modelo de dados precisará representar quando as issues de recebíveis
> da Rodada 5 forem aprovadas e implementadas. **Nenhuma tabela ou coluna deve ser criada a partir
> deste texto** — só a partir de issue aprovada.

A revisão de recebíveis Calliandra (`historico/revisao-recebiveis-calliandra-2026-07-31.md`) concluiu que
a unidade financeira elementar do fluxo avançado **não é o mês**, e sim a **safra**.

| Conceito | O que precisa ser representado |
|---|---|
| **Safra** | Contratos originados no mesmo `mês × Grupo × alocação × componente`. É a chave econômica mínima; hoje não existe entidade equivalente |
| **Componente de pagamento** | Regra que converte parte do contrato em recebimentos. Quatro tipos: **imediato**, **prazo fixo**, **até marco**, **concentrado em marco**. O contrato já pode ser persistido em `fluxo_pagamento.componentes`; o motor por safras ainda será conectado na #283 |
| **Bruto / desconto / líquido** | Três séries mensais separadas por Grupo e tipologia. Hoje existe uma única série derivada do VGV, e o desconto comercial não existe |
| **Primeiro vencimento** | Defasagem configurável, com padrão `s + 1`. Hoje não há campo — as parcelas partem do mês da venda ou do cronograma da Obra |
| **Prazo fixo** | `N` fixo por componente, contado a partir de cada safra (36, 120, outros) |
| **Marco** | Mês comum de encerramento; o prazo da safra passa a ser `N_s = M − s` |
| **Saldo** | Saldo por safra e componente, com `saldo_s,s = principal_s` e `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t`. A carteira total é a soma desses saldos, nunca uma recorrência agregada |

Duas restrições que a evolução precisa respeitar: **compatibilidade de leitura** dos estudos já
gravados (via adapter do JSON legado, EVI-010 / #230) e o inventário de dados legados
(EVI-002 / #221), que é portão da rodada.

## Evolução de domínio prevista para Terreno, valores e funding

> ⚠️ **Seção consultiva, acrescentada em 2026-08-01.** Como a de cima: **nada aqui existe** no
> `schema.json`, em migração ou em runtime. Ela registra o que o modelo de dados precisará
> representar quando as issues da lista de bugs forem aprovadas e implementadas. **Nenhuma tabela
> ou coluna deve ser criada a partir deste texto.**

| Conceito | O que precisa ser representado | Issue |
|---|---|---|
| **Linha Preço canônica** | Identidade `obrigatoria` garantida em **todo** estudo, inclusive nos que o backfill da `007` não alcançou — a migração cobre só `terreno/Compra` de menor id por estudo | #256 |
| **Subcategoria de Preço** | Quatro valores exatos: `Valor à vista`, `Parcelado`, `Permuta física`, `Permuta financeira`. Hoje há uma única `Permuta`, que o motor trata como **financeira** (`frontend/fluxo-caixa-motor.ts:399`). Migração aprovada: toda `Permuta` legada → `Permuta financeira`, preservando o resultado de todo estudo | #257 |
| **Permuta física por tipologia** | Referência de tipologia + quantidade **na linha de custo do Terreno**, substituindo `avancado_tipologias.unidades_permutadas` como fonte de verdade. Exige base de valoração declarada quando a tipologia tem `preco_m2` diferente por Grupo | #258 · #266–#269 |
| **Valor canônico multiunidade** | Quantidade econômica com precisão suficiente, independente da unidade exibida. Hoje o valor **exibido é o persistido**, em duas arquiteturas distintas: um campo por unidade nas Premissas, um único `orcamento_valor` + `orcamento_unidade` em Custos | #259 · #260 |
| ~~**Instrumento de capital**~~ | 🔴 **Evolução CANCELADA pela #355 (2026-08-12)** — ver o bloco abaixo | ~~#239 · #271~~ |

Duas restrições valem para todas: nenhum estudo **aprovado, reprovado ou arquivado** pode mudar de
resultado por migração, e toda migração nova exige **bump da `versao`** do manifesto.

Detalhe completo em `historico/lista-bugs-planejamento-2026-07-31.md` e, para o Capital Stack, em
Funding, Capital Stack e Retorno do Capital (`referencia/funding-capital-stack.md`).

## 🔴 "Instrumento de capital" — a evolução que foi cancelada, e o que existe no lugar

> **Seção PRÓPRIA, e isto é deliberado.** Ela ficou primeiro como subseção da consultiva acima — e
> herdava o banner *"nada aqui existe no `schema.json`, em migração ou em runtime"*, que é falso
> para o modelo vigente descrito no fim dela. Quem seguisse o banner leria
> `avancado_funding_operacoes` como proposta, quando ela roda. Achado do revisor externo.
>
> **Registro histórico, não previsão.** Preservado com o motivo, seguindo o precedente de
> Funding, Capital Stack e Retorno do Capital (`referencia/funding-capital-stack.md`): a memória de por que o
> waterfall foi projetado tem valor, e apagá-la faria a próxima sessão reinventá-lo.

A linha acima descrevia uma entidade de camada do **Capital Stack** — tipo, compromisso, prioridade
de utilização, prioridade de pagamento, calendário de aporte/liberação e status — que substituiria
`financiamento_*`, `investidor_*` e `estrutura_*_pct` como entrada. **Ela nunca foi implementada, e
deixou de ser o caminho.** A **#355** apagou o modelo de 4 instrumentos com waterfall em 2026-08-12;
a epic #239 e as sub-issues #270–#279 não existem mais como plano.

⚠️ **Por que isto era enganoso mesmo estando numa seção consultiva.** A seção inteira avisa que
"nada aqui existe" — mas ela promete o que **vai** existir, e esta linha prometia um futuro
cancelado. Quem a lesse sairia procurando (ou pior, recriando) uma competição por caixa que a
Rodada 7 eliminou de propósito.

**O que existe hoje**, e é a entidade vigente do domínio de funding:

| Entidade vigente | Onde mora | Spec |
|---|---|---|
| **Operação de funding** — três tipos independentes, **sem waterfall, sem prioridades, sem competição por caixa**: `financiamento_producao` (única por estudo), `divida` e `equity` (quantas quiser, nomeáveis) | tabela `avancado_funding_operacoes` (migração `029`); motor `frontend/funding-motor.ts`; tela `frontend/tela-funding.ts`; rotas `backend/rotas/funding.ts` | [Fluxo do Investidor](funding) para `divida` e `equity` |

⚠️ **`financiamento_producao` tem SPEC PRÓPRIA, e ela continua vigente.** A **§4.3** de
Funding, Capital Stack e Retorno do Capital (`referencia/funding-capital-stack.md`) — gatilho de exposição mínima,
catch-up retroativo e cash sweep — foi **preservada de propósito** pela #355 e aprovada pela #405.
Rebaixar aquele documento inteiro a histórico seria erro: só o resto dele é ADR.

⚠️ **Não confunda isso com "o único que diverge da planilha".** Esta frase já esteve aqui nessa
forma, e era **falsa** — achado do revisor externo. `divida` e `equity` seguem a planilha do Fluxo
do Investidor **como spec**, mas têm divergências deliberadas e documentadas dentro dela:

- **`divida`** — tarifas, estruturação e encargos (#478) **não existem na planilha**; foram
  acrescentados sem oráculo de valores, e entram na coluna de saídas, nunca no saldo;
- **`equity`** — a base de receita líquida do retorno (#465) usa composição **diferente** da
  planilha: só corretagem, sem marketing. É decisão do autor, verbatim, registrada no `CLAUDE.md`.

Quem tratar essas duas como bug e "corrigir" **muda o resultado de estudos existentes**. A distinção
que vale: `financiamento_producao` tem **outra spec**; `divida` e `equity` seguem a planilha **com
emendas declaradas**.

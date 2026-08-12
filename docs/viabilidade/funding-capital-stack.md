---
titulo: Funding, Capital Stack e Retorno do Capital
descricao: ADR do modelo de Capital Stack (4 instrumentos com waterfall), supersedido pela #355 — preserva vigente só a §4.3 (Financiamento à produção, catch-up retroativo); Dívida e Equity mudaram para fluxo-investidor-formulas.md.
tipo: app
ordem: 8
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Funding, Capital Stack e Retorno do Capital

> 🔴 **Reescrita pela #355 em 2026-08-12 — este documento é agora majoritariamente ADR/histórico.**
> O modelo de **4 instrumentos com waterfall** que o resto deste arquivo descreve (Sponsor Equity
> §4.1, Preferred Equity §4.2, Capital de giro/dívida ponte §4.4, prioridade de funding §5,
> waterfall de pagamentos §6, ordem mensal do motor §7, KPIs §8, interface §9, relatórios §10,
> validações §12, migração §13) foi **substituído** por 3 operações independentes — sem waterfall,
> sem prioridades, sem competição por caixa — especificadas em
> **[Fluxo do Investidor — fórmulas das operações de Funding](fluxo-investidor-formulas)**:
> `financiamento_producao` (única por estudo), `divida` (livre) e `equity` (2 modos). Tabela nova:
> `avancado_funding_operacoes` (migração `029`); motor novo: `frontend/funding-motor.ts`; tela nova:
> `frontend/tela-funding.ts` (`viab-funding`, aba "Funding"). O modelo antigo (tabela
> `avancado_capital_instrumentos`, migração `019`, `frontend/capital-stack-motor.ts`,
> `viab-capital-stack`) foi apagado do código — **as seções abaixo que o descrevem ficam só como
> registro de decisão (ADR)**, não como comportamento vigente.
>
> **Exceção: a §4.3 (Financiamento à produção) continua vigente**, palavra por palavra — é o único
> pedaço do modelo antigo que a #355 preservou de propósito (decisão do autor, 2026-08-12): a
> planilha nova (`fluxo_investidor_FORMULAS`) modelaria `financiamento_producao` como dívida de
> calendário, o que reverteria o catch-up retroativo aprovado nesta seção. A matemática da §4.3 foi
> só **realocada** para `simularFinanciamentoProducao` em `frontend/funding-motor.ts` — onde este
> texto cita `frontend/capital-stack-motor.ts`, leia `frontend/funding-motor.ts`.
>
> Por que o texto não foi todo reescrito: as seções supersedidas continuam sendo a referência de
> **por que** os 4 instrumentos, o waterfall e as prioridades existiam e o que cada decisão resolvia
> — útil para quem perguntar "por que não voltamos ao waterfall". O comportamento **atual**, porém,
> é só o que `fluxo-investidor-formulas.md` e a §4.3 abaixo descrevem.

> ✅ **Este documento descrevia COMPORTAMENTO VIGENTE** desde o fechamento da FIN-10 (#279) — texto
> original preservado abaixo como histórico da epic #239, que a #355 substituiu.
>
> O aviso anterior — *"nada neste documento descreve o runtime atual"* — valia quando a aba
> `Viabilidade → Financeiro` era inteiramente inerte, com ~25 controles que nenhum motor lia. A epic
> **#239** (`BUGLIST-024`) e suas dez sub-issues **FIN-01 a FIN-10** (#270–#279) substituíram aquele
> modelo pelo Capital Stack: camadas de capital com aporte, liberação e retorno mês a mês
> (`frontend/capital-stack-motor.ts`, `backend/rotas/capital-stack.ts`, tabela
> `avancado_capital_instrumentos`, migração `019`).
>
> **Onde o texto ainda descreve alvo e não instalado, isso está dito na própria seção** — as
> lacunas conhecidas seguem registradas nas issues #272–#277, abertas com o que falta em cada uma.
> Continua valendo: nenhuma tabela, coluna, rota ou regra nasce deste texto, só de issue aprovada.
>
> **Papel de `Custos → Financeiro` (critério da #279):** aquele grupo de custos **não foi absorvido
> pelo Capital Stack** e continua sendo o que sempre foi — **custos operacionais** de natureza
> financeira lançados como linha de orçamento (tarifas, taxas de administração, gerenciamento),
> com curva e ancoragem próprias, como qualquer outro grupo de custo. O Capital Stack trata de
> **estrutura de capital**: quem financia, quanto aporta, quando libera e como é remunerado. São
> eixos distintos e nenhum dos dois substitui o outro.
>
> **Campos que saíram da aba Financeiro na #279** (9 controles sem consumidor):
> `taxa_juros_valor_futuro_aa`, `tarifas_bancarias_pct`, `taxa_adm_carteira_pct`,
> `taxa_estruturacao_divida_pct`, `taxa_gerenciamento_obra_pct`, `juros_financeiros_aa`,
> `juros_inicio_cobranca_mes`, `indice_correcao` e `indice_correcao_taxa_aa`. As **colunas
> permanecem no schema** e o dado histórico está intacto — a tela apenas deixou de escrevê-las. A
> remoção física é issue própria e deliberadamente posterior. Os `aliquota_*` seguem na tela por
> serem regime tributário, escopo da #228.

> ✅ **FIN-01 (#270) — portão fechado em 2026-08-02.** Três entregas:
>
> 1. **ADR — dependências revisadas.** As duas notas de "dependência dura" deste documento (§6.2 e
>    §6.4) estavam corretas quando escritas, mas **as issues que travavam já fecharam**: `impostoMensal`
>    e `corretagemMensal` existem como séries próprias desde a Fase 4 (#228) e já alimentam a
>    identidade bruta/líquida da permuta financeira (#238, Fase 7); o horizonte derivado (#231) e o
>    relatório de reconciliação (#240) também já estão na `main`. **Nenhuma das duas notas bloqueia
>    mais FIN-02 em diante** — mantidas no texto original abaixo só como registro histórico do que
>    trancava a epic quando ela foi escrita.
> 2. **Glossário e timing mensal — já formalizados** nas §3 (Conceitos canônicos) e §7 (Ordem mensal
>    completa do motor) deste documento; FIN-01 os declara **travados** — mudar o vocabulário ou a
>    ordem dos 17 passos exige revisar esta seção, não só o código.
> 3. **16 golden cases — `frontend/fixtures/capital-stack-golden.ts`** (+ `.test.ts`), mesmo papel
>    que `calliandra-golden.ts` teve para #232–#237: um oráculo de referência (`simularCapitalStack`)
>    e os 16 cenários do §14, cada um executável e reconciliado. **Diferença de método:** não existe
>    planilha real de Capital Stack para reproduzir — os cenários usam números redondos e são
>    verificados por invariante fechada (saldo final, total de juros, MOIC/ROI), não por comparação
>    linha a linha contra uma terceira fonte.
>
> **Simplificações do oráculo, registradas como `Evolução dependente de issue` para FIN-02+:**
> juros na carência sempre capitalizam (o modo "pago" do §4.3 não está no oráculo); amortização
> contratual SAC/Price não está modelada (só `cash_sweep` e `bullet`, os dois usados pelos 16 casos);
> Preferred Equity automático por lacuna não está modelado (todos os 16 casos usam aporte
> programado); o "saldo de distribuição pendente" do §6.2 (quando o caixa do mês não cobre a
> participação desejada) não é carregado para o mês seguinte — a diferença é simplesmente perdida
> nesta referência, e o Caso 10 documenta esse comportamento explicitamente. Quem implementar
> FIN-04/FIN-06/FIN-07 decide se alguma dessas simplificações vira regra definitiva ou é corrigida.
>
> **Adição ao §4.1** (não estava explícito no texto original): o Sponsor Equity no modo
> "participação na receita líquida" é **mutuamente exclusivo** com o resíduo do waterfall nesta
> referência — uma camada de sponsor está num modo ou no outro, nunca nos dois ao mesmo tempo. Ver
> Caso 11.

**Rótulos de status usados aqui**, no mesmo padrão de
[Padrão de Viabilidade — Incorporação](padrao-incorporacao):

| Rótulo | Significado |
|---|---|
| **Comportamento vigente** | O que o código faz hoje |
| **Modelo funcional de referência** | Regra aprovada, ainda não implementada |
| **Evolução dependente de issue** | Depende de decisão ou de outra issue antes de virar regra |

---

## 1. Objetivo

**Modelo funcional de referência.**

Transformar a aba **`Viabilidade → Financeiro`** numa ferramenta que modele, mês a mês, como o
empreendimento é financiado e como cada provedor de capital é remunerado.

> **Alvo confirmado:** `Viabilidade → Financeiro` (`frontend/tela-financeiro.ts`, o Bloco G).
> A planilha `lista_bugs.xlsx` registra o item 24 em *"Seção: Custos · Aba: Financeiro"*, mas o
> conteúdo do pedido — financiamento à produção, capital de giro, investidores e dívida — é o do
> Bloco G. **Decisão do autor em 2026-08-01.** O grupo de custos `Custos → Financeiro` permanece
> sendo despesa financeira operacional e **não** é absorvido pelo Capital Stack; a `FIN-10`
> (#279) declara isso explicitamente ao encerrar o programa.

O módulo deve responder, sem misturar conceitos:

1. Quanto capital o projeto exige antes de qualquer funding?
2. Quanto dessa necessidade é coberta por dívida, equity preferencial e capital do incorporador?
3. Em quais meses cada instrumento aporta, recebe remuneração, recupera principal e encerra o saldo?
4. Qual é o custo financeiro do projeto?
5. Qual é o retorno de cada investidor e do incorporador?
6. Existe lacuna de funding, dívida não quitada ou distribuição incompatível com o caixa?

O módulo **não altera** a lógica comercial de VGV, vendas, recebíveis, carteira ou repasse. Ele
consome o fluxo de caixa livre produzido por essas rotinas como entrada.

---

## 2. Princípios obrigatórios

**Modelo funcional de referência.**

### 2.1 Projeto e capital são duas camadas diferentes

O app deve manter simultaneamente:

- **Fluxo de caixa livre do projeto** — recebimentos de clientes menos impostos, permutas
  financeiras e custos operacionais, **antes** de qualquer aporte, dívida, juros ou distribuição;
- **Fluxo após funding** — o livre, acrescido de aportes e liberações, reduzido por taxas, juros,
  amortizações e distribuições;
- **Fluxo do sponsor/incorporador** — aportes como saídas, distribuições como entradas;
- **Fluxo de cada investidor** — aportes como saídas, recebimentos como entradas.

> Funding resolve **liquidez** e altera **custo de capital** e **retorno do equity**. Funding não
> transforma um projeto economicamente ruim em receita adicional.

### 2.2 Funding nunca integra Receita Bruta — VGV

Não entram na Receita Bruta: liberação de financiamento à produção · tomada de capital de giro ·
aporte de equity preferencial · aporte do incorporador · refinanciamento ou nova dívida.

Esses valores aparecem **apenas** no bloco de funding.

### 2.3 Repasse permanece recebimento de cliente

O repasse liquida o saldo do comprador, integra a Receita Bruta recebida e pode gerar caixa para
amortizar dívida — mas **nunca** deve ser renomeado ou contabilizado como liberação de
financiamento à produção.

### 2.4 Cada instrumento tem razão própria

Cada camada precisa possuir, no mínimo: compromisso ou limite · aportes/liberações mensais ·
remuneração · devolução de principal · saldo devedor ou capital ainda não devolvido ·
recebimentos/distribuições · fluxo visto pelo provedor de capital · encerramento explícito.

> **Não é permitido** calcular somente um total final sem demonstrar o caminho mensal.

### 2.5 Nenhum plug silencioso

Se as fontes configuradas não cobrirem a necessidade de caixa, o app deve mostrar **lacuna de
funding**. Não pode criar capital próprio infinito sem informar ao usuário.

O sponsor pode ser configurado como camada automática de cobertura residual, mas isso deve estar
**visível** e possuir compromisso ilimitado explícito ou limite informado.

### 2.6 Estrutura de capital é resultado, não premissa solta

Os percentuais `estrutura_capital_proprio_pct`, `estrutura_financiamento_pct` e
`estrutura_investidores_pct` (`schema.json:106-108`) **não permanecem** como inputs independentes.
O Capital Stack passa a ser **derivado** de compromissos contratados, valores efetivamente
liberados/aportados e saldo máximo por instrumento.

O app pode mostrar duas composições: **Capital Stack comprometido** e **Capital Stack
efetivamente utilizado**.

---

## 3. Conceitos canônicos

**Modelo funcional de referência.**

### 3.1 Necessidade de funding

```text
caixa_provisorio_t
= caixa_inicial_t
+ fluxo_livre_projeto_t
− obrigações_financeiras_mandatórias_t
+ aportes_programados_t
```

```text
necessidade_funding_t = máximo(0, reserva_minima_caixa − caixa_provisorio_t)
```

A reserva mínima pode ser zero ou uma premissa do estudo.

### 3.2 Caixa distribuível

```text
caixa_distribuivel_t
= máximo(
    0,
    caixa_apos_operacao_e_divida_t
    − reserva_minima_caixa
    − obrigações_futuras_imediatas_protegidas_t
  )
```

Distribuições de equity só podem utilizar caixa distribuível.

### 3.3 Compromisso, aporte e saldo

| Termo | Definição |
|---|---|
| **Compromisso** | Teto que o instrumento aceita fornecer |
| **Aporte / liberação** | Valor efetivamente entregue ao projeto no mês |
| **Saldo devedor** | Principal e valores capitalizados ainda devidos numa dívida |
| **Capital não devolvido** | Aporte de equity ainda não recuperado pelo investidor |
| **Remuneração acumulada** | Retorno preferencial vencido e ainda não pago |

### 3.4 Resultado e retorno

- **Resultado econômico desalavancado** — resultado do projeto antes de juros e taxas de funding.
- **Resultado após custo financeiro** — desalavancado menos juros e taxas. **Não** desconta
  devolução de principal nem distribuição de lucro: esses são movimentos de **capital**, não de
  resultado.
- **Retorno do sponsor** — distribuições ao sponsor menos aportes do sponsor.
- **Retorno de cada investidor** — distribuições do instrumento menos aportes do instrumento.

---

## 4. Instrumentos suportados

**Modelo funcional de referência.** Quatro tipos na primeira versão completa. Novos tipos só devem
ser criados quando não puderem ser representados por estes motores.

### 4.1 Sponsor Equity — capital do incorporador

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Função:** cobrir capital próprio exigido · cobrir a necessidade residual não atendida pelas
demais fontes · receber o residual econômico depois das prioridades contratadas.

**Modos de aporte:** programado (valor, primeiro mês, nº de parcelas, frequência) · automático por
lacuna (até o compromisso, conforme a prioridade) · misto.

**Modos de retorno:** residual do waterfall (**padrão recomendado**) · participação na receita
líquida (percentual mensal, sem devolução separada de principal).

> Deve existir **ao menos uma** camada de Sponsor Equity. Quando houver mais de uma camada
> residual, os percentuais residuais devem somar **100%**.

### 4.2 Preferred Equity — equity preferencial

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Função:** aportar capital com prioridade econômica sobre o sponsor; receber principal e
remuneração conforme a waterfall contratada; opcionalmente participar do residual ou da receita
líquida.

**Modos de aporte:** programado · automático por lacuna até o compromisso · misto.

**Modos de remuneração:**

**A. Retorno preferencial fixo** — taxa efetiva anual convertida em mensal efetiva; remuneração
simples sobre capital não devolvido **ou** composta sobre saldo preferencial, conforme escolha
**explícita**; devolução de principal; participação residual adicional opcional.

**B. Participação no residual em evento** — devolução de principal; percentual sobre o caixa
residual distribuível; evento de pagamento (entrega, fim das vendas ou encerramento do estudo). O
pagamento só acontece se houver caixa distribuível e nenhuma prioridade anterior vencida.

> Este modo representa a referência "percentual do lucro", mas a base canônica do app é o
> **residual de caixa após as prioridades**, não lucro contábil indefinido.

**C. Participação na receita líquida** — percentual da receita líquida de vendas **recebida** em
cada mês, pro rata conforme o caixa comercial, sem devolução separada de principal. A participação
mensal compõe todo o retorno do instrumento.

> **Evolução dependente de issue.** `investidor_retorno_tipo` já existe no schema com as opções
> `remunerado | pct_receita | pct_resultado` (`schema.json:136`) — elas mapeiam nos modos A, C e B,
> nessa ordem. O campo é **inerte** hoje; a migração da `FIN-02` (#271) o usa como pista, exigindo
> revisão do usuário quando a associação for ambígua.

**D. Participação no lucro final, parcelada na entrega** (adicionada 2026-08-03, a pedido do
autor) — percentual sobre o **resultado desalavancado do projeto inteiro** (`Σ fluxoLivreMensal`,
a MESMA grandeza que já é o KPI "Resultado desalavancado" em §8.1 — não é o "lucro contábil
indefinido" que a ressalva do modo B evita; é uma base canônica e já existente). O total
(`percentual × resultado`, zerado se o resultado for negativo — participação sobre prejuízo não
existe) é dividido em **N parcelas mensais iguais**, pagas a partir do mês **seguinte** ao mês de
entrega/fim de obras. Sem devolução de principal separada (mesma convenção do modo C — a
participação é o retorno inteiro). Insuficiência de caixa num mês vira saldo pendente, cobrado nos
meses seguintes (nunca força caixa negativo, §12.3).

> **Viabilidade confirmada:** o total distribuível só é computável de antemão porque o motor recebe
> `fluxoLivreMensal` com o horizonte **inteiro** de uma vez — não é cálculo em streaming mês a mês.
> A leitura acontece uma única vez, antes do loop mensal começar; nenhuma fórmula existente do §7
> foi alterada para viabilizar isso.

### 4.3 Financiamento à produção

**Comportamento vigente desde 2026-08-11.** A fonte de verdade desta seção é a aba
`Incorp Individual` da planilha de referência (`20260730_EVI_Urbita`), colunas **BW:CH**, decodificada
fórmula a fórmula. O oráculo de regressão é `frontend/financiamento-producao-golden.test.ts`, que
reproduz os 80 períodos do cenário real com tolerância de R$ 0,15.

**Função:** financiar custos elegíveis do empreendimento, liberando recursos conforme
medição/evolução acumulada, com juros, taxas, amortização e saldo devedor próprios.

**Premissas do app:** taxa de juros efetiva anual · **exposição mínima para liberação** ·
percentual financiável dos custos elegíveis · seleção das linhas de custo elegíveis ·
**caixa disponível amortiza antes das chaves (sim/não)** · limite comprometido (opcional).
A **janela de liberação** e o **mês das chaves** NÃO são digitados: saem do Cronograma do estudo
(`marcosObra`, `frontend/fluxo-shared.ts`).

Continuam **fora**, sem caso real que as exija: indexador e taxa projetada · taxas de contratação ·
mês inicial/final de elegibilidade digitado · reserva mínima de caixa por camada.

#### Base financiável padrão

Quatro grupos, e só eles (`eFinanciavelPadrao`, `frontend/fluxo-shared.ts`):

1. pagamento **cash** do terreno — a linha de Preço, exceto as subcategorias de permuta;
2. custo de construção;
3. outorga;
4. projetos e aprovações (categorias `Projetos` e `Licenças e Aprovações`).

Ficam de fora, deliberadamente: impostos, corretagem, marketing, permuta física e financeira,
incorporação e registro, manutenção pós-obra, mobiliário, contingências, gestão e demais indiretos.
Todos continuam pesando no fluxo de caixa — só não aumentam a base sobre a qual o banco libera.

A camada pode escolher outras linhas em `config.custoLinhaIds`; sem seleção própria, a base padrão é
resolvida **em runtime**, não persistida — congelar a lista a faria envelhecer assim que o usuário
adicionasse uma linha de custo.

#### Liberação mensal — catch-up retroativo

Os custos elegíveis são reconhecidos quando **incorridos** no fluxo. A liberação ocorre ao final do
mês, depois da medição econômica daquele mês.

```text
percentual_incorrido_t         = custo_elegivel_acumulado_t / custo_elegivel_TOTAL

liberacao_habilitada_t         = percentual_incorrido_t ≥ exposicao_minima
                                 E (obra ativa em t OU t é o mês das chaves)

liberacao_desejada_acumulada_t = mínimo(
                                   limite_efetivo,
                                   percentual_financiavel × custo_elegivel_acumulado_t
                                 )

liberacao_t                    = liberacao_habilitada_t
                                 ? máximo(0, liberacao_desejada_acumulada_t
                                             − liberações_acumuladas_anteriores)
                                 : 0
```

Duas consequências que **não** são código especial — caem da fórmula, e é por elas que o modelo se
distingue de um financiamento genérico:

- **A primeira liberação é um catch-up.** No mês em que o gatilho abre, `liberacao_desejada_acumulada`
  já cobre TODO o custo incorrido desde o mês 1. No cenário de referência isso são
  R$ 17.108.298,25 de uma vez (80% de R$ 21,385 MM acumulados), contra R$ 2,79 MM se fosse só o custo
  daquele mês.
- **A exposição mínima é um GATILHO, não uma franquia.** Os primeiros 20% não ficam permanentemente
  por conta do equity: o banco os reconhece retroativamente. Modelar como "equity first" — a
  incorporadora banca os primeiros 20% e o banco financia só o que vem depois — é um produto
  **diferente**, e não está implementado.

`limite_efetivo` é o `compromisso` da camada quando ele existe; com `compromisso = 0` (o caso da
planilha, que não tem teto contratual) é `percentual_financiavel × custo_elegivel_total` — o
principal para sozinho ali: R$ 83.236.939,35 no cenário de referência.

> **A regra "não liberar dívida sem necessidade de caixa" vale para o Capital de giro (§4.4), não
> para este produto.** Financiamento à produção é liberação **contratual** por medição: o banco
> libera o que a medição autoriza, tenha o projeto caixa sobrando ou não. Era esta a exceção que o
> parágrafo antigo previa como "modo contratual explicitamente selecionado".

#### Juros e saldo

Por convenção mensal do app, medição e liberação ocorrem no **fim do mês**. Assim, a nova liberação
começa a gerar juros **no mês seguinte**.

```text
taxa_mensal = (1 + taxa_anual)^(1/12) − 1      # efetiva composta, NUNCA taxa_anual/12

juros_t = saldo_abertura_t × taxa_mensal        # o saldo de ABERTURA, sem a liberação de t

saldo_fechamento_t = saldo_abertura_t
                   + liberacao_real_t
                   + juros_capitalizados_t
                   + taxas_capitalizadas_t
                   − amortizacao_principal_t
```

Duas armadilhas que o oráculo cobre explicitamente, porque erram sem dar erro:

- **juros sobre `saldo_abertura + liberacao_do_mes`** produziriam R$ 196,3 mil no mês 6 do cenário de
  referência, contra os R$ 168,7 mil corretos;
- **`taxa_anual / 12`** em vez da efetiva composta erra ~5 pontos-base ao mês, e o desvio capitaliza
  por 30 meses de obra.

Os juros são **capitalizados**, não pagos em caixa: por isso o saldo devedor supera o principal
liberado. No cenário de referência, R$ 83,2 MM de principal viram R$ 95,9 MM de saldo no pico.
Eles são **custo financeiro**, não custo do projeto — não entram na base financiável e não alteram o
custo de obra.

#### Amortização — cash sweep

**Financiamento à produção não tem prestação contratual.** Não é SAC nem Price: não há parcela fixa,
prazo de parcelas nem principal dividido. A dívida é liquidada por **cash sweep** — existe caixa
disponível, existe dívida amortizável, o caixa reduz a dívida — e o prazo é emergente. Por isso o
editor da camada não oferece política de amortização, carência, prazo nem vencimento; quem precisa
disso usa **Capital de giro** (§4.4), que mantém as três políticas.

```text
caixa_disponivel_t  = caixa_fechamento_{t−1} + fluxo_livre_t     # SEM a liberação de t

divida_amortizavel_t = saldo_abertura_t + juros_t                # SEM a liberação de t

amortizacao_permitida_t = amortizar_com_caixa_disponivel OU chaves_já_ocorreram_t

amortizacao_t = amortizacao_permitida_t
                ? máximo(0, mínimo(divida_amortizavel_t, caixa_disponivel_t − reserva))
                : 0
```

**Por que `caixa_disponivel` exclui a liberação do próprio mês.** Se não excluísse, a liberação do
banco pagaria a si mesma no mês em que entrou — o mesmo real gasto duas vezes. No motor isso é um
snapshot: o caixa é congelado logo depois do fluxo livre do mês entrar e antes de qualquer liberação
(`caixaAntesFunding`, `frontend/funding-motor.ts` → `simularFinanciamentoProducao`). Esta é a ÚNICA
operação de Funding cujo desembolso/amortização depende do caixa do projeto — `divida` e `equity`
seguem a matemática de calendário de `fluxo-investidor-formulas.md`, sem checar caixa algum.

**O toggle e as chaves.** Com `amortizar_com_caixa_disponivel = false`, nada é pago antes da entrega
— mesmo com caixa sobrando. Depois da entrega a amortização passa a ser **obrigatória**, marcado ou
não. No cenário de referência o toggle está ligado e ainda assim não há amortização durante a obra:
o caixa disponível é negativo o tempo todo. **A amortização começar nas chaves é consequência do
fluxo econômico daquele cenário, não de proibição matemática.**

**O gatilho de liberação não governa a amortização.** Do mês 31 em diante a janela de liberação está
fechada (a obra acabou) e o cash sweep continua rodando até zerar, no mês 36.

Repasse e demais recebimentos alimentam o cash sweep, mas **continuam classificados como receita do
cliente** (§17.3 de `padrao-incorporacao.md`).

Com a dívida começando e terminando em zero, vale a identidade que serve de teste de consistência:

```text
Σ amortizado = Σ liberado + Σ juros
```

No cenário de referência: R$ 98.277.107,77 = R$ 83.236.939,35 + R$ 15.040.168,42.

##### As outras políticas (Capital de giro)

**Cash sweep** (aplica o caixa disponível acima da reserva à dívida, respeitando vencimento e
outras prioridades) · **bullet** (principal no vencimento) · **SAC** (amortização constante após
carência) · **Price** (parcela constante após carência).

> ✅ **Price + carência implementados em 2026-08-03**, decodificados de `Incorp Individual!CK:CQ`
> da planilha de referência (Capital de Giro): liberação → **carência** (juros pagos em caixa,
> principal intocado — não capitalizado) → **parcela Price fixa** (`PMT`, calculada uma única vez
> sobre o total liberado, ao entrar na fase de amortização) até quitar. As 3 políticas
> (`cash_sweep`/`bullet`/`price`) dividem uma ÚNICA fila de prioridade de pagamento (§9),
> corrigindo uma inconsistência que existia antes (cash sweep sempre processado antes de bullet,
> independente da prioridade configurada).
>
> ⚠️ **Correção de 2026-08-11:** este bloco dizia que a política era genérica para qualquer
> `InstrumentoDivida`, "independente do `tipo` da camada". Deixou de ser: `financiamento_producao`
> é sempre cash sweep (acima). Price e bullet valem só para `capital_giro`.
>
> **Uma divergência deliberada da planilha:** o Excel sempre paga o juros da carência, sem checar
> caixa disponível. Este motor capa pelo caixa disponível, como toda amortização (§12.2/12.3) — não
> força caixa negativo. Numa carência bem financiada isso não muda nada; só diverge quando o
> projeto genuinamente não tem caixa para os juros daquele mês.
>
> **SAC continua não implementado** — nenhum caso real pediu ainda; a planilha de referência só usa
> Price.

### 4.4 Capital de giro / dívida ponte

> 🔴 **Supersedida pela #355 (2026-08-12).** `capital_giro` virou `divida` no modelo novo (calendário + Price com carência, sem cash sweep automático nem gate de chaves) — ADR/histórico. Ver o banner do topo do documento.

**Função:** cobrir descasamentos de caixa não atendidos pelo financiamento à produção; financiar
despesas não elegíveis ou períodos intermediários. **Não depende** de medição de custos elegíveis.

**Modos de liberação:** programado · automático por lacuna · misto.

**Premissas:** limite · mês disponível · prazo · carência · taxa e indexador · taxas · juros pagos
ou capitalizados · amortização cash sweep, bullet, SAC ou Price.

Uma **dívida ponte** usa o mesmo motor, mudando nome, prazo e regra de pagamento. **Não** herda as
nuances de "Financiamento à produção" (exposição mínima, catch-up retroativo, janela de obra, caixa
disponível defasado, gate de chaves): capital de giro libera **por necessidade de caixa**, não por
medição de custo, e essa continua sendo a regra dele.

> As nuances acima ficaram fora da Rodada 6 por decisão do autor (2026-08-03) e foram
> **implementadas em 2026-08-11**, a partir da planilha anexada pelo autor — ver §4.3.

---

## 5. Prioridade de funding

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.**

Cada instrumento recebe uma **ordem de utilização**. No mês, o motor deve:

1. aplicar aportes e liberações **programados**;
2. calcular a lacuna restante;
3. percorrer os instrumentos **automáticos** pela ordem configurada;
4. respeitar limite, elegibilidade e período de cada camada;
5. registrar **lacuna de funding** quando o último instrumento não cobrir o déficit.

**Ordem padrão recomendada:** aportes programados de equity → financiamento à produção elegível →
equity preferencial automático → capital de giro/dívida ponte → Sponsor Equity residual.

A ordem é **editável**, porque contratos reais podem exigir equity antes da dívida. O app deve
alertar quando a configuração gerar circularidade ou uso impossível.

---

## 6. Waterfall de pagamentos e distribuições

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.**

### 6.1 Ordem padrão obrigatória

1. impostos, permutas financeiras e custos operacionais já pertencentes ao fluxo livre;
2. juros, taxas e serviço obrigatório de dívida;
3. amortização contratual e cash sweep de dívida;
4. devolução do principal de Preferred Equity;
5. pagamento da remuneração preferencial acumulada;
6. participação adicional do Preferred Equity no residual;
7. distribuição residual ao Sponsor Equity;
8. saldo não distribuído permanece como caixa do projeto.

> O usuário pode ordenar instrumentos **dentro da mesma classe**, mas **não pode** colocar equity à
> frente de dívida vencida.

### 6.2 Participação na receita líquida

Participações mensais sobre receita são calculadas **antes** do waterfall residual, porque são
obrigações vinculadas ao recebimento comercial.

```text
receita_liquida_base_t = receita_bruta_recebida_t
                       − impostos_sobre_receita_t
                       − corretagem_t
                       − permuta_financeira_t

participacao_receita_instrumento_t = percentual_instrumento × máximo(0, receita_liquida_base_t)
```

**Regras:** a base é **caixa recebido**, nunca valor contratado · juros recebidos de clientes
integram a receita bruta recebida · a soma das participações de receita não pode superar 100% · por
padrão não há devolução separada de principal · o pagamento é limitado pelo caixa disponível depois
das obrigações de dívida e da reserva mínima, e eventual insuficiência vira **saldo de distribuição
pendente**, nunca caixa negativo silencioso.

> ⚠️ **Dependência dura.** `impostos_sobre_receita_t` e `corretagem_t` **não existem como série**
> hoje: corretagem e RET vivem dobrados no `fator` do recebível (`frontend/fluxo-shared.ts` →
> `vglLinha`). Sem **EVI-022 / #228** não há o que subtrair. É a mesma dependência que trava a
> #238.

### 6.3 Participação no residual

```text
residual_distribuivel_t = caixa_distribuivel_t
                        − principal_preferencial_devido_t
                        − retorno_preferencial_devido_t
```

O percentual incide **apenas** sobre residual positivo. Nunca cria obrigação quando não há residual.

### 6.4 Encerramento do projeto

No último mês econômico: todas as dívidas quitadas ou **erro de saldo terminal**; capital
preferencial e remuneração pagos ou explicitamente marcados como saldo não realizado; caixa
residual distribuído ao sponsor conforme participação; o horizonte ampliado até o último pagamento
contratual, **sem empurrar valores para um mês artificial**.

> **Dependência dura.** O horizonte atual empilha o excedente no último mês
> (`frontend/fluxo-caixa-motor.ts` → `deposita`). **EVI-011 / #231** precisa estar fechada.

---

## 7. Ordem mensal completa do motor

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.**

1. calcular vendas, recebimentos, repasse, impostos, permuta financeira e custos;
2. formar o fluxo de caixa livre do projeto;
3. abrir saldos de caixa, dívida e equity;
4. calcular juros e taxas vencidas sobre saldos de **abertura**;
5. calcular amortizações contratuais obrigatórias;
6. calcular a necessidade de funding e a reserva mínima;
7. aplicar aportes/liberações programados;
8. executar liberações automáticas por prioridade;
9. pagar juros, taxas e amortizações obrigatórias;
10. executar cash sweep de dívida;
11. calcular participações sobre receita líquida;
12. calcular devolução de principal e retorno preferencial;
13. executar distribuição residual ao sponsor;
14. fechar caixa e saldos de todos os instrumentos;
15. calcular KPIs do projeto, das dívidas e dos investidores;
16. executar reconciliações e alertas;
17. ampliar o horizonte quando existir obrigação futura.

---

## 8. KPIs

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.**

### 8.1 Projeto

Receita Bruta — VGV · resultado econômico desalavancado · juros e taxas de funding · resultado após
custo financeiro · VPL e TIR **desalavancados** · exposição máxima antes do funding · necessidade
máxima de funding · lacuna máxima de funding.

> A TIR e o VPL do projeto permanecem **desalavancados**, para manter comparabilidade entre
> estruturas de capital.

### 8.2 Dívida (por instrumento)

Limite comprometido · total liberado · endividamento máximo · juros e taxas totais · custo total ·
datas de primeira e última liberação · data de quitação · saldo terminal · cobertura do serviço da
dívida, quando houver parcela contratual.

### 8.3 Equity (por instrumento e para o sponsor)

```text
MOIC     = distribuições totais / aportes totais
ROI      = (distribuições totais − aportes totais) / aportes totais
TIR a.a. = (1 + TIR mensal)^12 − 1
```

Também: capital comprometido · capital efetivamente aportado · capital ainda não devolvido ·
remuneração acumulada · retorno total · payback · mês do último recebimento.

> MOIC, ROI e TIR usam o **fluxo do investidor**, nunca o fluxo do projeto.

---

## 9. Interface da aba Financeiro

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.** Entrega em `FIN-08` (#277).

**Resumo superior:** exposição máxima sem funding · capital comprometido total · capital utilizado
total · dívida máxima · equity efetivamente aportado · lacuna de funding · resultado após custo
financeiro.

**Capital Stack:** lista ordenável de camadas com nome · tipo · prioridade de utilização ·
prioridade de pagamento · compromisso · valor utilizado · saldo atual/máximo · custo ou forma de
remuneração · status (`rascunho` · `ativo` · `encerrado` · `revisão necessária`). Deve ser possível
adicionar **várias camadas do mesmo tipo**.

**Editor de camada**, em cinco blocos: detalhes gerais · aporte/liberação · remuneração ·
amortização/waterfall · resumo e fluxo esperado. Toda alteração recalcula a **prévia sem salvar**;
o usuário confirma em **Salvar camada**.

**Visualizações:** gráfico de Capital Stack comprometido e utilizado · gráfico mensal de
aportes/liberações e pagamentos/distribuições · tabela de fluxo esperado por camada · avisos de
lacuna, dívida terminal, retorno não pago e configuração incompatível.

> ⚠️ **Contrato de UI do UrbiVerso.** Só usar primitivos `urbi-*` disponíveis e **só as props que
> eles declaram**: atributo inexistente num primitivo **não dá erro, simplesmente não faz nada**.
> Ler `ui/src/urbi-<nome>.ts` no monorepo antes de presumir. Tokens CSS do design system — nunca
> cor literal.

---

## 10. Fluxo de Caixa e relatórios

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.** Entrega em `FIN-09` (#278).

```text
Fluxo de Caixa Livre do Projeto

Funding — Entradas
├── Financiamento à produção — liberações
├── Capital de giro — liberações
├── Equity preferencial — aportes
└── Sponsor Equity — aportes

Funding — Saídas
├── Juros e taxas de dívida
├── Amortização de principal
├── Devolução de Preferred Equity
├── Retorno preferencial
├── Participações sobre receita/residual
└── Distribuições ao sponsor

Fluxo Líquido de Funding
Fluxo após Funding
Caixa Final

Saldos
├── Dívida por instrumento
├── Capital preferencial não devolvido
├── Retorno preferencial acumulado
└── Lacuna de funding
```

Exportação CSV/PDF e cenários devem usar **exatamente os mesmos arrays** do motor. Ver
[Exportação](exportacao).

---

## 11. Cenários

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.**

Toda mudança de preço, custo, absorção ou recebimento deve recalcular automaticamente: necessidade
de funding · liberações automáticas · juros · cash sweep · retorno dos instrumentos · retorno do
sponsor.

Na primeira entrega **não é obrigatório** criar novos sliders financeiros. É obrigatório que os
instrumentos **reajam corretamente** aos cenários existentes.

**Evolução dependente de issue:** uma etapa posterior pode permitir variar taxa de juros,
percentual financiável, limite de dívida, retorno preferencial e participação na receita/residual.

---

## 12. Validações e invariantes

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.**

### 12.1 Projeto

- Funding **não** altera Receita Bruta — VGV.
- O fluxo livre independe da fonte de capital.
- Custo financeiro altera o resultado após funding; principal e aportes **não** alteram o resultado
  econômico.

### 12.2 Dívida

Liberação acumulada não supera o limite · financiamento à produção não supera o percentual dos
custos elegíveis acumulados · amortização não supera o saldo · saldo nunca é negativo · a dívida
termina em zero ou apresenta **erro bloqueante** · taxa zero não produz juros · carência menor que
o prazo · método de amortização compatível com o prazo restante.

### 12.3 Equity

Aporte acumulado não supera o compromisso, exceto sponsor explicitamente ilimitado · devolução de
principal não supera o capital não devolvido · distribuição não supera o caixa distribuível ·
participação sobre receita usa o recebimento **líquido do mês** · participações de receita somam no
máximo 100% · percentuais residuais de sponsor somam 100% · MOIC, ROI e TIR usam o fluxo do
investidor.

### 12.4 Reconciliação

```text
fluxo_apos_funding_t = fluxo_livre_projeto_t + entradas_funding_t − saidas_funding_t

saldo_divida_fechamento = saldo_abertura + liberações
                        + juros_capitalizados + taxas_capitalizadas − amortizações

capital_preferencial_fechamento = capital_abertura + aportes − devoluções_de_principal
```

Todas as diferenças devem ser **zero** dentro da tolerância definida pelo motor.

---

## 13. Compatibilidade e migração

> 🔴 **Supersedida pela #355 (2026-08-12).** Descreve o modelo de 4 instrumentos com waterfall — ADR/histórico, não comportamento vigente. Ver o banner do topo do documento.

**Modelo funcional de referência.** Entrega em `FIN-02` (#271) e `FIN-10` (#279).

### 13.1 Regra conservadora

Os campos atuais são **inertes**. A migração **não pode** ativá-los silenciosamente e mudar estudos
existentes.

### 13.2 Conversão proposta

| Campo legado | Destino |
|---|---|
| `financiamento_*` preenchido | Camada **rascunho** de Financiamento à produção |
| `investidor_*` preenchido | Camada **rascunho** de Equity preferencial |
| `estrutura_*_pct` | Preservado como **metadado legado**; substituído na UI por percentuais derivados |
| `indice_correcao`, `indice_correcao_taxa_aa`, `juros_financeiros_aa` | Associação **sugerida** ao instrumento migrado, com revisão obrigatória quando ambígua |
| `regime_tributario`, `aliquota_*` | **Fora desta epic** — pertencem à issue fiscal **#228** |

### 13.3 Ativação

Instrumentos migrados nascem com status **Revisão necessária** e **sem efeito no motor** até
confirmação do usuário. Estudos aprovados, reprovados ou arquivados **nunca** têm instrumento
ativado automaticamente.

### 13.4 Descontinuação do Bloco G

Ao final do programa: nenhum campo antigo permanece editável sem efeito · o que foi substituído sai
da interface · os dados legados permanecem preservados pelo período necessário · a **remoção física
de colunas**, se desejada, é issue posterior e específica.

> ✅ **FIN-10 (#279) — fechado em 2026-08-02.** `frontend/tela-financeiro.ts` perdeu o cartão
> "Financiamento & Investidores" (`financiamento_*`/`investidor_*`) e a seção "Estrutura de capital"
> (`estrutura_*_pct`) — substituídos pela aba Capital Stack (FIN-08/#277), que já cobre os mesmos
> conceitos de forma derivada (§2.6). Um `urbi-banner` aponta para a aba nova no lugar onde o cartão
> antigo estava. Nenhuma coluna foi removida do schema (nenhum campo é `obrigatorio`, nenhum motor
> de cálculo os lê — confirmado antes da mudança); a "remoção física de colunas" continua sendo
> issue posterior, como o texto acima já previa. Sem migração nesta issue.
>
> **"Ativação definitiva" (§13.3) não ganhou fluxo dedicado** — a decisão foi reaproveitar o editor
> genérico de status que a FIN-08 já entrega (qualquer camada, migrada ou nova, muda de status via
> o mesmo seletor + "Salvar camada"). Isso já satisfaz "sem efeito no motor até confirmação do
> usuário" (mudar o status é a confirmação); um fluxo de ativação com aviso dedicado, se algum dia
> fizer falta, é decisão de produto futura, não um requisito não atendido desta issue.
>
> **Programa Financeiro (epic #239) encerrado nesta sessão** — FIN-01 a FIN-10 (#270–#279)
> implementadas em 4 grupos (ver `docs/lista-bugs-planejamento-2026-07-31.md` §15 e o histórico da
> Fase 9 na trilha). O motor (`frontend/capital-stack-motor.ts`) cobre os 4 instrumentos do §4, a
> prioridade de funding (§5) e o waterfall (§6); a interface (`viab-capital-stack`) consome o motor
> de verdade. Fora de escopo nesta entrega original, registrado explicitamente em cada grupo:
> gráficos SVG, prévia de recálculo por tecla, integração com `fluxo-tabela.ts`/exportações CSV/PDF,
> reação a Cenários (§11), e a base de receita líquida do §6.2 sem subtrair corretagem. **Todos
> fechados nas rodadas de 2026-08-02 — ver blocos abaixo.**

> 🔎 **Segunda verificação (2026-08-02)** — releitura linha a linha de todo o entregue na Fase 9
> contra este doc, achou e corrigiu 3 defeitos reais; 2 lacunas ficaram documentadas (não corrigidas
> agora, por exigirem decisão de produto):
>
> 1. **Corrigido — ordem principal×remuneração invertida (§6.1).** `simularCapitalStack` (modo A)
>    pagava a remuneração preferencial ANTES do principal; o item 4 do §6.1 exige o oposto. Os 16
>    golden cases não pegaram porque nenhum tinha caixa insuficiente para os dois no mesmo mês.
>    Corrigido em `frontend/capital-stack-motor.ts`; caso 8 do §14 recalculado à mão; regressão
>    isolada em `capital-stack-motor.test.ts`.
> 2. **Corrigido — migração 019 gerava Preferred Equity permanentemente inerte.** A config gravada
>    para instrumentos migrados do Bloco G usava `aporteValor`/`retornoTipoLegado`, mas
>    `instrumentoDeRegistro` lê `aportes`/`modo` — mesmo depois do usuário confirmar `status: ativo`,
>    o instrumento nunca teria efeito. Corrigido em `migracoes/019_capital_stack_camadas.js`
>    (mapeamento remunerado→A / pct_receita→C / pct_resultado→B, §4.2); verificado com script
>    standalone + `scripts/migracoes-harness.mjs`.
> 3. **Corrigido — `prioridade_pagamento` nunca lido pelo motor nem editável na UI.** É coluna real
>    do schema e campo do §9 ("prioridade de pagamento", distinto de "prioridade de utilização"),
>    mas `simularCapitalStack` reusava a ordem de FUNDING para as amortizações e as Preferred
>    Equity não tinham ordem alguma entre si — só importa com 2+ instrumentos do mesmo tipo, por
>    isso nenhum dos 16 casos exercia o bug. Adicionado `prioridadePagamento` aos dois tipos de
>    instrumento, ordenação própria para as fases de pagamento (steps 5/6), e o campo editável em
>    `tela-capital-stack.ts` (o `_salvar` já enviava o campo — só faltava o input). Regressão
>    isolada com 2 dívidas de prioridades invertidas.
> 4. **Lacuna documentada, não corrigida — um único Sponsor Equity é simulado.** `simularCapitalStack`
>    usa `cen.instrumentos.find(...)` para achar o sponsor — se o usuário criar 2+ camadas
>    `sponsor_equity` (a UI permite), só a primeira participa; as demais ficam silenciosamente sem
>    efeito mesmo com `status: ativo`. Não corrigido agora porque generalizar exige uma decisão de
>    negócio ainda não escrita no §4.1/§6.1 (como dividir a cobertura de lacuna ou o resíduo entre
>    múltiplos sponsors). Registrar como issue futura se o caso de uso aparecer.
> 5. **Ambiguidade de leitura, não um bug de código.** §3.1 (fórmula da necessidade de funding) e §7
>    (lista numerada da ordem mensal) podem ser lidos como discordantes sobre se "aportes
>    programados" entra antes ou depois do cálculo de necessidade; o código segue §3.1 (aportes
>    primeiro, depois necessidade sobre o caixa já com aporte) — comportamento inalterado nesta
>    verificação, só registrado para quem revisar o doc depois.

> ✅ **Terceira rodada (2026-08-02) — os 4 itens fora de escopo fechados a pedido do autor.**
>
> 1. **Prévia por tecla + gráficos SVG (§9 "Visualizações").** `tela-capital-stack.ts` recalcula a
>    simulação a cada alteração no editor (`_recalcular`, sobrepõe o draft em memória sobre as
>    camadas persistidas — nada é enviado à API antes de "Salvar camada", a garantia central do §9
>    continua intacta) e ganhou dois gráficos SVG puros (sem lib externa): comprometido × utilizado
>    por camada, e o mensal de entradas × saídas de funding.
> 2. **Integração com `fluxo-tabela.ts`/exportações CSV/PDF (§10).** Nova função pura
>    `fundingEntradasSaidasMensal` em `capital-stack-motor.ts` é a ÚNICA fonte da agregação
>    Entradas/Saídas — consumida pelo gráfico mensal (item 1), pela tabela nova `tabelaCapitalStack`
>    (`fluxo-tabela.ts`, renderizada em `tela-fluxo-ver.ts` logo abaixo da tabela principal) e pela
>    exportação (`linhasCapitalStack` em `exportar.ts`), exatamente a árvore do §10: Funding
>    Entradas/Saídas (4+6 sub-linhas fixas por tipo, não por camada) → Fluxo Líquido de Funding →
>    Fluxo após Funding → Caixa Final → Saldos (dívida e os dois saldos de PE agora têm série
>    MENSAL, não só o valor final — novos campos `capitalNaoDevolvidoPorInstrumentoPE`/
>    `remuneracaoAcumuladaPorInstrumentoPE`). Escopo consciente: só a view **Mensal** (a view Anual
>    não tem uma agregação do resultado do Capital Stack por período — mesma restrição que já vale
>    para os KPIs, que também nunca reagregam por ano).
> 3. **Corretagem na receita líquida (§6.2).** Nova função pura
>    `receitaLiquidaComCorretagemMensal` (única fonte, usada por `tela-capital-stack.ts` e
>    `tela-fluxo-ver.ts`) lê a linha de custo "Corretagem de vendas" já calculada em
>    `calc.linhasCusto` (a mesma fonte oficial única do #227/#228) em vez de duplicar
>    `corretagemMensal`. `receitaLiquidaMensal` agora bate exatamente com a fórmula do §6.2.
>
> Validação: 315 testes (4 novos — `fundingEntradasSaidasMensal`, as séries mensais de saldo PE, e
> a prioridade de pagamento entre dívidas), typecheck e build limpos, harness de migrações verde.
>
> **Quarta rodada, mesmo dia — as 3 decisões pendentes (achados 4/5 + §11), resolvidas pelo autor:**
>
> 4. **Múltiplos Sponsor Equity — rateio pro-rata pelo aporte acumulado.** `simularCapitalStack`
>    trocou `.find()` (só o primeiro) por `.filter()` — todos os `sponsor_equity` ativos
>    participam. Regra: `% da receita líquida` continua contratual e INDEPENDENTE por sponsor (não
>    é pool — se A tem 10% e B tem 5%, cada recebe o seu, sem afetar o outro); cobertura automática
>    de lacuna e o resíduo do waterfall SÃO pools compartilhados entre os sponsors sem % próprio,
>    rateados pelo peso `aporte_acumulado_do_sponsor / Σ aporte_acumulado_de_todos` — sem nenhum
>    aporte ainda, divide igualmente. Novos campos `aportePorInstrumentoSponsor`/
>    `distribuicaoPorInstrumentoSponsor` (por instrumento; os agregados `aporteSponsorMensal`/
>    `distribuicaoSponsorMensal` continuam existindo, agora como a SOMA de todos). Com 1 só sponsor
>    (todos os 16 golden cases), o peso é sempre 1 — comportamento idêntico a antes.
> 5. **Ordem §3.1×§7 — mantida a leitura atual, ambiguidade do texto registrada, não do código.**
>    O autor confirmou: aportes programados ENTRAM no caixa antes do cálculo de necessidade de
>    funding (§3.1) — mais eficiente em capital, evita puxar dívida automática que um aporte já
>    programado no mesmo mês tornaria innecessária. §7 continua com a ordem numerada imprecisa
>    nesse detalhe; não foi reescrito porque o comportamento correto (o do código) já está
>    documentado aqui, e a lista do §7 é descritiva, não normativa quando conflita com §3.1.
> 6. **Cenários (§11) — reação mecânica confirmada + tabela completa por cenário, decisão do
>    autor: os dois.** Não era uma lacuna de regra de negócio (correção de leitura própria): bastou
>    reusar `simularCapitalStackDoEstudo` sobre o `FluxoCalc` de cada cenário (`aplicarCenario` já
>    gera um `fluxoMensal` próprio por cenário). `tela-cenarios.ts` ganhou (a) um KPI "Resultado
>    após custo financeiro" para o cenário em exibição — sem tocar TIR/VPL, que §8.1 explicitamente
>    mantém desalavancados —, (b) a mesma `tabelaCapitalStack` do item 2 abaixo da tabela do fluxo
>    (só view Mensal), e (c) uma coluna "Resultado após custo financ." na tabela de Cenários salvos,
>    condicional a `camadas.length > 0` — sem nenhuma camada, a tabela e a tela ficam idênticas a
>    antes desta rodada.
>
> Validação: 317 testes, typecheck, build e harness de migrações verdes.

> ✅ **Quinta rodada (2026-08-03) — planilha `20260730_EVI_Urbita_corrigido.xlsx` (`Incorp
> Individual!CK:CQ`, Capital de Giro) usada como referência para generalizar a política de dívida
> e criar o modo D de equity.** Achados e decisões do autor:
>
> 1. **Dívida: Price + carência**, decodificados linha a linha da planilha (§4.3/4.4 acima) —
>    genérico para qualquer `InstrumentoDivida`; Capital de Giro é só a referência do modelo, não
>    vira um tipo de instrumento à parte. SAC continua fora (nenhum caso real pede ainda).
> 2. **Equity: modo D**, "% do lucro final parcelado na entrega" (§4.2 acima) — base = resultado
>    desalavancado do projeto INTEIRO (não de um mês, como o modo B), confirmada como computável
>    sem alterar nenhuma fórmula existente do §7.
> 3. **TIR por instrumento** (§8.3) — o comentário do código já citava "MOIC/ROI/TIR" desde a Fase
>    9, mas só MOIC/ROI tinham sido implementados; `tirMensal`/`tirAnual` (bisseção sobre o fluxo
>    de caixa do investidor/credor) fecham o que faltava. Exibido na tabela de resultados por
>    camada (`tela-capital-stack.ts`), ao lado do MOIC.
>
> Validação: 325 testes (14 novos — Price+carência reproduzindo o oráculo exato da planilha, modo
> D, TIR, adapter), typecheck e build limpos.

---

## 14. Casos de teste de referência

**Modelo funcional de referência.** `FIN-01` (#270) transforma cada caso em fixture conferida à
mão, com inputs e valores esperados mês a mês.

| # | Caso |
|---:|---|
| 1 | Projeto sem funding |
| 2 | Sponsor automático cobrindo toda a exposição |
| 3 | Financiamento à produção com custo elegível, liberações mensais e cash sweep |
| 4 | Financiamento com taxa zero |
| 5 | Financiamento atingindo o limite antes do fim da obra |
| 6 | Capital de giro automático durante descasamento |
| 7 | Dívida bullet com juros capitalizados |
| 8 | Preferred Equity com aporte único, retorno preferencial e devolução de principal |
| 9 | Preferred Equity com 20% do residual no encerramento |
| 10 | Preferred Equity com 10% da receita líquida, sem devolução separada de principal |
| 11 | Sponsor Equity com participação na receita líquida |
| 12 | Múltiplos instrumentos com ordem de funding e waterfall |
| 13 | Compromisso insuficiente gerando lacuna |
| 14 | Dívida não quitada no horizonte |
| 15 | Cenário adverso aumentando a necessidade de funding |
| 16 | Migração de estudo legado sem alteração automática de resultado |

As quatro imagens da aba `Dívida Equity` da planilha são **referências de interação** e exemplos de
modos de retorno. Elas **não substituem** estas regras canônicas.

---

## 15. Divisão em issues

A epic **#239** (`BUGLIST-024`) aponta para dez sub-issues, executadas **uma por sessão, um PR por
sub-issue**:

| # | Código | Entrega | Depende de |
|---|---|---|---|
| #270 | **FIN-01** | ADR, glossário, timing mensal e golden cases | #239 — **portão** |
| #271 | **FIN-02** | Camadas de capital e migração do Bloco G como rascunho | FIN-01 |
| #272 | **FIN-03** | Necessidade de funding, fluxo após funding e saldos | FIN-01, FIN-02 |
| #273 | **FIN-04** | Financiamento à produção por custos elegíveis | FIN-03 + recebíveis estáveis |
| #274 | **FIN-05** | Capital de giro e dívida ponte | FIN-03 |
| #275 | **FIN-06** | Sponsor e Preferred Equity | FIN-03 |
| #276 | **FIN-07** | Waterfall, retorno preferencial, residual e revenue share | FIN-04, FIN-05, FIN-06 |
| #277 | **FIN-08** | Interface de Capital Stack e editor de camadas | FIN-02 a FIN-07 |
| #278 | **FIN-09** | Fluxo, KPIs, cenários e exportações | FIN-03 a FIN-08 |
| #279 | **FIN-10** | Limpeza, ativação definitiva e compatibilidade | FIN-02 a FIN-09 |

---

## 16. Dependências do programa

O programa depende de: motor mensal de recebíveis por safras estável · horizonte derivado (#231) ·
Receita Bruta e carteira reconciliadas (#237) · regime tributário resolvido fora desta epic (#228) ·
relatório de reconciliação (#240) · regras de UI e exportação da Rodada 5 (#241) · fixture dourada
(#220) e inventário de dados legados (#221).

> **As issues de dívida e equity não devem avançar sobre um motor de receita ainda instável.**

---

## 17. Limites regulatórios e jurídicos

O app simula **contratos privados** e estruturas de capital. Ele **não** valida a legalidade da
captação nem substitui assessoria jurídica, tributária ou regulatória.

Quando uma captação for oferecida ao público ou tiver características de contrato de investimento
coletivo, pode haver obrigações regulatórias. O produto deve exibir aviso de que a estrutura
simulada precisa ser revisada pelos responsáveis jurídicos e financeiros antes de ser utilizada
numa oferta real.

**Fontes oficiais consultadas para validar os conceitos de mercado:**

- CAIXA — Apoio à Produção: <https://www.caixa.gov.br/empresa/construcao-civil/apoio-a-producao/Paginas/default.aspx>
- CAIXA — Plano Empresário: <https://www.caixa.gov.br/empresa/construcao-civil/plano-empresario-caixa/Paginas/default.aspx>
- CVM — alerta sobre ofertas de investimento em empreendimentos imobiliários: <https://www.gov.br/cvm/pt-br/assuntos/noticias/2013/cvm-alerta-para-ofertas-irregulares-de-investimento-em-empreendimentos-imobiliarios-e37fd0a6fd4c4f55958d899e693669b5c>

Elas confirmam que **financiamento à produção é operação da empresa/SPE**, com liberações ligadas à
execução/medição, enquanto os financiamentos dos compradores e o **repasse** são operações
distintas. As regras específicas de cada contrato continuam sendo premissas do estudo.

---

## Veja também

- [Visão Geral](visao-geral) · [Modelo de Dados](modelo-de-dados) · [Fórmulas](formulas) · [Exportação](exportacao)
- [Padrão de Viabilidade — Incorporação](padrao-incorporacao) §17 — dinâmica funcional do Bloco G
- [Inteligência EVI — Incorporação](inteligencia-evi-incorporacao) — significado econômico do custo de capital
- `docs/lista-bugs-planejamento-2026-07-31.md` — mapa mestre dos 24 itens da lista de bugs
- `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência e evidência em `arquivo:linha`

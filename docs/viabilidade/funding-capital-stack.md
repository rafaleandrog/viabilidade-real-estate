---
titulo: Funding, Capital Stack e Retorno do Capital
descricao: Modelo funcional de referência para financiamento à produção, capital de giro, equity preferencial e capital do incorporador no estudo Avançado — necessidade de funding, waterfall de pagamentos, retorno por instrumento e reconciliação mensal.
tipo: app
ordem: 8
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Funding, Capital Stack e Retorno do Capital

> 🚫 **NADA NESTE DOCUMENTO DESCREVE O RUNTIME ATUAL.**
>
> A aba `Viabilidade → Financeiro` é hoje **inteiramente inerte**: `frontend/tela-financeiro.ts`
> renderiza ~25 controles, `backend/rotas/estudos.ts` os persiste, e
> `frontend/fluxo-caixa-motor.ts` **não referencia nenhum deles** (grep confirmado: zero
> ocorrências, também em `proforma.ts` e `fluxo-shared.ts`).
>
> Este documento é o **modelo funcional de referência** aprovado para a epic **#239**
> (`BUGLIST-024`) e suas dez sub-issues **FIN-01 a FIN-10** (#270–#279). Cada seção descreve o
> comportamento-alvo, não o instalado. **Nenhuma tabela, coluna, rota ou regra deve ser criada a
> partir deste texto** — só a partir de issue aprovada.

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

**Função:** cobrir capital próprio exigido · cobrir a necessidade residual não atendida pelas
demais fontes · receber o residual econômico depois das prioridades contratadas.

**Modos de aporte:** programado (valor, primeiro mês, nº de parcelas, frequência) · automático por
lacuna (até o compromisso, conforme a prioridade) · misto.

**Modos de retorno:** residual do waterfall (**padrão recomendado**) · participação na receita
líquida (percentual mensal, sem devolução separada de principal).

> Deve existir **ao menos uma** camada de Sponsor Equity. Quando houver mais de uma camada
> residual, os percentuais residuais devem somar **100%**.

### 4.2 Preferred Equity — equity preferencial

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

### 4.3 Financiamento à produção

**Função:** financiar custos elegíveis do empreendimento, liberando recursos conforme
medição/evolução acumulada, com juros, taxas, amortização e saldo devedor próprios.

**Premissas mínimas:** limite comprometido · percentual financiável dos custos elegíveis · seleção
das linhas de custo elegíveis · mês inicial e final de elegibilidade · exigência de equity/obra
executada antes da primeira liberação, quando aplicável · taxa de juros efetiva anual · indexador
e taxa projetada · taxas de contratação · regra de juros na carência (pagos ou capitalizados) ·
política de amortização · reserva mínima de caixa · vencimento final.

#### Liberação mensal

Os custos elegíveis são reconhecidos quando **incorridos** no fluxo. A liberação ocorre ao final do
mês, depois da medição econômica daquele mês.

```text
custo_elegivel_acumulado_t     = Σ custos elegíveis incorridos até t

liberacao_desejada_acumulada_t = mínimo(
                                   limite_comprometido,
                                   percentual_financiavel × custo_elegivel_acumulado_t
                                 )

liberacao_disponivel_t         = máximo(0, liberacao_desejada_acumulada_t
                                           − liberações_acumuladas_anteriores)

liberacao_real_t               = mínimo(liberacao_disponivel_t,
                                        necessidade a ser coberta pelo instrumento)
```

> O app **não** deve liberar mais dívida apenas porque o limite existe quando o projeto não
> necessita do caixa — salvo modo contratual de liberação programada explicitamente selecionado.

#### Juros e saldo

Por convenção mensal do app, medição e liberação ocorrem no **fim do mês**. Assim, a nova liberação
começa a gerar juros **no mês seguinte**.

```text
juros_t = saldo_abertura_t × taxa_mensal

saldo_fechamento_t = saldo_abertura_t
                   + liberacao_real_t
                   + juros_capitalizados_t
                   + taxas_capitalizadas_t
                   − amortizacao_principal_t
```

#### Amortização

**Cash sweep** (aplica o caixa disponível acima da reserva à dívida, respeitando vencimento e
outras prioridades) · **bullet** (principal no vencimento) · **SAC** (amortização constante após
carência) · **Price** (parcela constante após carência).

Para financiamento à produção, o padrão recomendado é **cash sweep com vencimento final**. Repasse
e demais recebimentos podem alimentar o cash sweep, mas **continuam classificados como receita do
cliente**.

### 4.4 Capital de giro / dívida ponte

**Função:** cobrir descasamentos de caixa não atendidos pelo financiamento à produção; financiar
despesas não elegíveis ou períodos intermediários. **Não depende** de medição de custos elegíveis.

**Modos de liberação:** programado · automático por lacuna · misto.

**Premissas:** limite · mês disponível · prazo · carência · taxa e indexador · taxas · juros pagos
ou capitalizados · amortização cash sweep, bullet, SAC ou Price.

Uma **dívida ponte** usa o mesmo motor, mudando nome, prazo e regra de pagamento.

---

## 5. Prioridade de funding

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
> de verdade. Fora de escopo, registrado explicitamente em cada grupo: gráficos SVG, prévia de
> recálculo por tecla, integração com `fluxo-tabela.ts`/exportações CSV/PDF, reação a Cenários
> (§11), e a base de receita líquida do §6.2 sem subtrair corretagem.

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

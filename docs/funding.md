---
titulo: Funding
descricao: As três operações de captação do estudo Avançado — Dívida, Equity e Financiamento à produção —, o que cada uma pede, como cada uma é calculada mês a mês e como entram no Fluxo de Caixa.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Funding

> Três operações independentes — dívida por calendário, equity com retorno sobre receita ou resultado, e financiamento à produção liberado por medição de obra — sem waterfall, sem prioridade e sem competição por caixa entre elas.

## O que é

A página **Funding** do estudo Avançado cadastra quem põe dinheiro no projeto e como é remunerado.
Cada operação é calculada sozinha, pela própria matemática, e depois somada ao fluxo de caixa: as
liberações e aportes entram como receita, as parcelas e retornos como custo. O resultado é o fluxo
**alavancado**, lido na aba Fluxo de Caixa; TIR, VPL e payback do projeto continuam calculados sobre
o Fluxo de Caixa Livre, antes do funding, para que a decisão sobre o empreendimento não se misture
com a decisão sobre como financiá-lo.

| Tipo | Quantas por estudo | Como funciona |
|---|---|---|
| **Dívida / Capital de giro** | quantas quiser, com nome | aporte num mês (ou em tranches), carência e amortização Price por calendário |
| **Equity** | quantas quiser, com nome | aporte num mês e retorno em um de dois modos: percentual da receita líquida mês a mês, ou percentual do resultado final no repasse |
| **Financiamento à produção** | uma | liberação contra a medição dos custos elegíveis da obra, com gatilho de exposição mínima e amortização por varredura de caixa |

Dívida e equity seguem a planilha do investidor: os pagamentos **não são limitados pelo caixa do
projeto** — a parcela é capada pelo saldo devedor e o retorno do equity sai como percentual da
receita ou do resultado, haja caixa ou não. Por isso o fluxo alavancado pode ficar negativo, e a
Reconciliação da aba Fluxo de Caixa alerta quando o acumulado depois do funding fica abaixo de zero.
O financiamento à produção é a única operação que olha o caixa do projeto: a amortização é uma
varredura do caixa disponível.

## Para usuários

Na página **Funding**, a aba **Operações** lista as operações do estudo. Cada linha traz **Tipo**,
**Nome**, **Valor** (no financiamento à produção, o percentual do custo financiável — o principal
não é digitado), **Início** e **Taxa / retorno**. Para dívida e equity, o início (**Aporte em**) é
uma **âncora do cronograma** — Planejamento, Pré-lançamento, Lançamento, Obra, Pós-obras — mais um
deslocamento em meses, ou um **Mês específico**; assim a operação acompanha o cronograma quando ele
muda. A janela do financiamento à produção vem sempre do Cronograma (a obra). Acima da lista há um
aviso permanente: o app simula contratos privados e não valida a legalidade da captação — uma
oferta ao público pode ter obrigações regulatórias próprias.

### Dívida / Capital de giro

Informe o **Valor do aporte**, o início (**Aporte em**), a **Taxa** anual, a **Amortização** (prazo
em meses) e a **Carência**. Com **Distribuir aporte** ligado, o valor entra em tranches mensais
iguais ao longo do número de meses informado, e a parcela é calculada sobre o valor futuro das
tranches, com os juros do período de liberação capitalizados no saldo. Durante a carência paga-se só
juros; depois, a parcela Price; no último mês, a quitação do saldo. Juros incidem sobre o saldo de
abertura do mês. Opcionalmente, **Estruturação** (percentual do valor, cobrado uma vez na primeira
liberação), **Administração** (R$ por mês, enquanto houver saldo devedor) e **Outros encargos**
(cobrados uma vez no mês da contratação) — as três entram nas saídas do investidor, nunca no saldo.
Se uma dessas tarifas for informada aqui e também houver uma linha de custo financeiro do mesmo
tipo no Orçamento, a página avisa: o custo estaria contado duas vezes.

### Equity

Informe o **Valor do aporte**, o início (**Aporte em**) e o modo de retorno:

- **Permuta financeira (% da receita líquida, mês a mês)** — o investidor recebe o percentual sobre
  a receita líquida de cada mês, enquanto houver receita.
- **% do resultado final (pago no repasse)** — o investidor recebe o percentual sobre o resultado
  final, de uma vez, no mês do repasse.

A soma dos percentuais de retorno das operações de equity é validada no servidor.

### Financiamento à produção

Uma por estudo. Informe a **Taxa** anual, a **Exposição mín. p/ liberação**, o percentual
financiável do custo e as linhas de custo elegíveis — o botão **Usar base padrão** seleciona o
pagamento do terreno (sem as permutas), a construção, a outorga, os projetos e as licenças e
aprovações — e se o **Caixa disponível amortiza antes das chaves**. É a única operação com o
interruptor **Ativo**: desligada, fica cadastrada e sai do fluxo. A janela de liberação e o mês das
chaves vêm do Cronograma.

Como o banco libera: os custos elegíveis são reconhecidos quando incorridos; quando o percentual
incorrido atinge a exposição mínima e a obra está ativa, a liberação daquele mês cobre tudo o que
o percentual financiável autoriza sobre o acumulado até ali — a primeira liberação é, portanto, um
**catch-up** de todo o custo já incorrido, e a exposição mínima é um gatilho, não uma franquia que
fica por conta do incorporador. Não há parcela contratual: o saldo é amortizado por **varredura do
caixa** disponível, calculado sem a liberação do próprio mês.

### Onde o funding aparece

- **Resultados → Fluxo de Caixa**: as liberações e aportes como receita, as parcelas e retornos
  como custo, na mesma tabela; a linha **Fluxo de Caixa Livre (antes do funding)** preserva a leitura
  desalavancada; o quadro **Retorno por parte** mostra, por operação, o que o investidor põe e recebe.
- **Resultados → Análise Financeira**: TIR, VPL e payback continuam desalavancados.
- **Resultados → Proforma**: não recebe funding — é a proforma desalavancada.
- **Cenários**: comparam o cenário simulado com o real já com o funding.

Para cada operação o app calcula, na visão do investidor: investimento total, retorno total, juros
pagos, lucro, VPL (à taxa de desconto do estudo), TIR mensal e anual, MOIC e payback (o primeiro mês
em que o acumulado do investidor volta a zero ou mais, contado depois do primeiro desembolso).

## Instruções para não humanos

Rotas do estudo (membro com alçada de edição para escrever):

| Rota | O que faz |
|---|---|
| `GET /estudos/:id/avancado/funding` | lista as operações do estudo |
| `POST /estudos/:id/avancado/funding` | cria uma operação (`tipo`: `divida`, `equity` ou `financiamento_producao`) |
| `PATCH /estudos/:id/avancado/funding/:oid` | altera uma operação |
| `DELETE /estudos/:id/avancado/funding/:oid` | remove uma operação |

Campos por tipo: todos têm `tipo`, `nome`, `ordem`, `valor` e `inicio_mes` (mês relativo, começando
em zero, já resolvido a partir da âncora); `ativo: false` só é aceito no financiamento à produção.
Dívida: `distribuir_aporte`, `aporte_meses`,
`taxa_anual` (percentual, não fração), `periodo_amortizacao_meses`, `periodo_carencia_meses`,
`taxa_estruturacao_pct`, `taxa_administracao_mensal`, `outros_encargos_iniciais`. Equity:
`modo_retorno` (`permuta_financeira` ou `resultado_final`) e `pct_retorno`. Financiamento à
produção: `exposicao_minima`, `percentual_financiavel`, `amortizar_com_caixa_disponivel`, `custo_linha_ids`.
Só pode haver uma operação de `financiamento_producao` por estudo. Valores monetários saem com duas
casas; percentuais são guardados como percentual.

## Veja também

- [Estudo Avançado](avancado) · [Fórmulas da Proforma](formulas) · [Modelo de Dados](modelo-de-dados)
- O modelo anterior, de quatro instrumentos com waterfall, e a especificação completa do
  financiamento à produção estão no arquivo de referência do repositório
  (`referencia/funding-capital-stack.md`), fora da documentação servida.

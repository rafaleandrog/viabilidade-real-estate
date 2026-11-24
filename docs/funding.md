---
titulo: Funding
descricao: As operações de captação do estudo Avançado — Dívida, Equity, Financiamento à produção e Antecipação de recebíveis —, o que cada uma pede, como cada uma é calculada mês a mês e como entram no Fluxo de Caixa.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Funding

> Operações independentes — dívida por calendário, equity com retorno sobre receita ou resultado, financiamento à produção liberado por medição de obra e antecipação da carteira de recebíveis — sem waterfall, sem prioridade e sem competição por caixa entre elas.

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
| **Antecipação de recebíveis** | quantas quiser, com nome | cessão de um percentual da carteira de recebíveis num mês: o projeto recebe à vista o valor presente das parcelas cedidas, e elas passam a ir para quem comprou |

Dívida e equity seguem a planilha do investidor: os pagamentos **não são limitados pelo caixa do
projeto** — a parcela é capada pelo saldo devedor e o retorno do equity sai como percentual da
receita ou do resultado, haja caixa ou não. Por isso o fluxo alavancado pode ficar negativo, e a
Reconciliação da aba Fluxo de Caixa alerta quando o acumulado depois do funding fica abaixo de zero.
O financiamento à produção é a única operação que olha o caixa do projeto: a amortização é uma
varredura do caixa disponível.

## Para usuários

Na página **Funding**, a aba **Operações** lista as operações do estudo. Cada linha traz **Tipo**,
**Nome**, **Valor** (no financiamento à produção, o percentual do custo financiável, e na
antecipação de recebíveis, o percentual da carteira cedida — nos dois o valor não é digitado),
**Início** e **Taxa / retorno** (na antecipação, a taxa de desconto). Para dívida e equity, o **Mês do aporte** é
uma **âncora do cronograma** — Planejamento, Pré-lançamento, Lançamento, Obra, Pós-obras, com o mês
derivado mostrado ao lado, só para leitura — ou um **Mês específico** digitado; assim a operação
acompanha o cronograma quando ele muda. A janela do financiamento à produção vem sempre do Cronograma (a obra). Acima da lista há um
aviso permanente: o app simula contratos privados e não valida a legalidade da captação — uma
oferta ao público pode ter obrigações regulatórias próprias.

As abas **Dívida**, **Equity** e **Antecipação** editam as operações daquele tipo. Havendo mais de uma, cada uma
ganha sua própria sub-aba, identificada pelo nome — criar uma nova operação já abre nela; com uma
só, o formulário aparece direto, sem sub-navegação.

### Dívida / Capital de giro

Informe o **Valor**, o **Mês do aporte**, a **Taxa** anual, a **Amortização** (prazo em meses) e a
**Carência**. Com **Distribuir aporte** ligado, o valor entra em tranches mensais iguais ao longo do
número de meses informado em **Aporte em**, e a parcela é calculada sobre o valor futuro das
tranches, com os juros do período de liberação capitalizados no saldo. Durante a carência paga-se só
juros; depois, a parcela Price; no último mês, a quitação do saldo. Juros incidem sobre o saldo de
abertura do mês. Opcionalmente, **Estruturação** (percentual do valor, cobrado uma vez na primeira
liberação), **Administração** (R$ por mês, enquanto houver saldo devedor) e **Outros encargos**
(cobrados uma vez no mês da contratação) — as três entram nas saídas do investidor, nunca no saldo.
Se uma dessas tarifas for informada aqui e também houver uma linha de custo financeiro do mesmo
tipo no Orçamento, a página avisa: o custo estaria contado duas vezes.

### Equity

Informe o **Valor do aporte**, o **Mês do aporte** e o modo de retorno:

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

### Antecipação de recebíveis

É a cessão de parte da carteira de recebíveis a uma securitizadora (CRI), um fundo (FIDC) ou um
banco, que paga à vista o valor presente das parcelas cedidas. Informe:

- o **Mês da cessão** (âncora do cronograma ou mês específico);
- a **Carteira cedida**, em percentual;
- a **Taxa de desconto** anual;
- opcionalmente, **Estruturação** (percentual do valor presente), **Administração** (R$ por mês) e
  **Outros custos** (R$).

O valor não é digitado: ele sai do lastro e da taxa.

- **O lastro.** É tudo o que as vendas contratadas até o mês da cessão ainda vão pagar **depois**
  dele: parcelas, saldo a repassar e carteira própria. Só entram os planos de pagamento já
  aplicados. A parcela entra cheia: se houver permuta financeira sobre a receita, ela continua
  saindo do projeto, que segue devendo ao permutante.
- **Duas antecipações.** Cada uma cede um percentual do que **ainda é da empresa**. Se uma cessão
  anterior já cedeu 80% de uma venda, a seguinte, com 50%, cede metade dos 20% que sobraram. Assim
  duas cessões nunca passam de 100% do lastro.
- **No mês da cessão:** o projeto recebe o valor presente das parcelas cedidas à taxa de desconto,
  e paga a estruturação e os outros custos.
- **Nos meses seguintes:** as parcelas cedidas saem do caixa, porque agora vão para o cessionário,
  junto com a administração.
- **Deságio e custo efetivo.** O deságio é a diferença entre as parcelas cedidas e o valor
  presente. O **custo efetivo** é a taxa anual da operação inteira, com as tarifas.
- **Tarifa contada duas vezes.** Como na Dívida, se uma tarifa da antecipação for informada e
  também houver uma linha de custo financeiro do mesmo tipo no Orçamento, a página avisa.

A aba mostra, em **Resultado da antecipação**:
- as parcelas cedidas (face);
- o valor presente;
- o recebido líquido;
- o deságio, em reais e em percentual da face;
- as tarifas;
- o custo efetivo.

Quem compra assume o risco das parcelas. Como o app não modela inadimplência, a cessão com ou sem
coobrigação dá os mesmos números, e não há campo para isso.

### Comparar estruturas

A aba **Comparar estruturas** põe até três estruturas de capital alternativas lado a lado com o
funding salvo, sem mexer no estudo. **Nova alternativa a partir do funding salvo** copia as operações
atuais para um cartão que você altera à vontade: o nome da alternativa e, em cada operação, **Incluir**
(tira a operação da alternativa; no financiamento à produção, desliga), o **Nome**, o **Valor** (em
reais; no financiamento à produção, o percentual financiado; na antecipação, o percentual da carteira
cedida), a **Taxa / retorno** e o **Início**. O início só é editável quando a operação usa um **Mês
específico**; numa operação ancorada ao cronograma ele aparece só para leitura, porque o app o
recalcula pela âncora. **+ Dívida** e **+ Equity** acrescentam operações novas.

As alternativas ficam guardadas **só neste navegador**, por estudo: não vão para o
servidor, outras pessoas e outros navegadores não as veem e limpar os dados do navegador as apaga. Sem armazenamento
disponível, elas funcionam na sessão aberta e se perdem ao sair.

A tabela **Comparação** tem uma coluna **Funding salvo**, de referência, e uma por alternativa, com
quatro indicadores, todos calculados com o mesmo motor da página:

- **Exposição máxima**: o pior ponto do caixa acumulado do projeto já com o funding — o quanto de
  capital próprio a estrutura exige no pior momento;
- **TIR alavancada (% a.a.)**: a TIR do fluxo com o funding; fica em "—" quando o fluxo não troca
  de sinal;
- **Custo financeiro do funding**: tudo que o projeto paga às operações menos tudo que recebe delas;
- **Resultado após funding**: a soma do fluxo com o funding.

Uma alternativa idêntica ao funding salvo reproduz exatamente a coluna de referência e é marcada
como **igual ao salvo**. Com permissão de edição, **Usar esta** abre uma confirmação que diz quantas
operações serão criadas, alteradas e removidas; ao confirmar, o funding do estudo passa a ser o da
alternativa. O **Financiamento à produção** nunca é removido: se a alternativa o dispensa, ele é
**desligado** e seus parâmetros ficam preservados. Depois de aplicar, os dados do funding são recarregados e a
alternativa continua guardada para novas comparações.

### Onde o funding aparece

- **Resultados → Fluxo de Caixa**: as liberações e aportes como receita, as parcelas e retornos
  como custo, na mesma tabela, e a linha **Fluxo de Caixa Livre (antes do funding)** preserva a
  leitura desalavancada.
- **Resultados → Análise Financeira**: TIR, VPL e payback do projeto continuam desalavancados; o
  quadro **Retorno por parte** mostra, para cada dívida e cada equity, o que o investidor põe e
  recebe — o financiamento à produção e a antecipação de recebíveis não entram ali: nenhum dos dois
  é investidor do projeto, e o custo deles é custo do projeto.
- **Resultados → Proforma**: não recebe funding — é a proforma desalavancada. O deságio de uma
  antecipação, portanto, não aparece como despesa financeira na Proforma: ele está no fluxo
  alavancado e no Resultado da antecipação.
- **Cenários**: comparam o cenário simulado com o real já com o funding.

Para cada dívida e cada equity o app calcula, na visão do investidor: investimento total, retorno
total, juros pagos, lucro, VPL (à taxa de desconto do estudo), TIR mensal e anual, MOIC e payback (o
primeiro mês em que o acumulado do investidor fica em zero ou acima; numa operação que só desembolsa
a partir de um mês posterior, os meses anteriores já satisfazem essa condição).

Na Análise Financeira do Avançado, o card **Visão do investidor** resume o projeto inteiro em três
indicadores: **Equity Multiple** (retorno total pago ao equity ÷ aportes de equity; 1,00× é empatar,
**—** sem equity), **Yield a.a.** (Fluxo de Caixa Livre médio por ano, do início do estudo ao último mês com fluxo livre, ÷ exposição máxima, já que o
app não modela o capital próprio do incorporador; **—** quando o acumulado nunca fica negativo) e
**LTV** (principal liberado de cada dívida ÷ VGV potencial; **—** sem dívida ou com VGV potencial zero). Detalhes em
[Estudo Avançado](avancado).

## Instruções para não humanos

Rotas do estudo (membro com alçada de edição para escrever):

| Rota | O que faz |
|---|---|
| `GET /estudos/:id/avancado/funding` | lista as operações do estudo |
| `POST /estudos/:id/avancado/funding` | cria uma operação (`tipo`: `divida`, `equity`, `financiamento_producao` ou `antecipacao_recebiveis`) |
| `PATCH /estudos/:id/avancado/funding/:oid` | altera uma operação |
| `PATCH /estudos/:id/avancado/funding/:oid/remover` | remove uma operação |

Campos por tipo: todos têm `tipo`, `nome`, `ordem`, `valor` e `inicio_mes` (mês relativo, começando
em zero, já resolvido a partir da âncora); `ativo: false` só é aceito no financiamento à produção.
Dívida: `distribuir_aporte`, `aporte_meses`,
`taxa_anual` (percentual, não fração), `periodo_amortizacao_meses`, `periodo_carencia_meses`,
`taxa_estruturacao_pct`, `taxa_administracao_mensal`, `outros_encargos_iniciais`. Equity:
`modo_retorno` (`permuta_financeira` ou `resultado_final`) e `pct_retorno`. Financiamento à
produção: `exposicao_minima`, `percentual_financiavel`, `amortizar_com_caixa_disponivel`, `custo_linha_ids`.
Antecipação de recebíveis: `pct_carteira_cedida` (0 a 100), `taxa_anual` (a taxa de desconto) e as
três tarifas da dívida; o mês da cessão é o `inicio_mes`.
Só pode haver uma operação de `financiamento_producao` por estudo. Valores monetários saem com duas
casas; percentuais são guardados como percentual.

## Veja também

- [Estudo Avançado](avancado) · [Fórmulas da Proforma](formulas) · [Modelo de Dados](modelo-de-dados)
- O modelo anterior, de quatro instrumentos com waterfall, e a especificação completa do
  financiamento à produção estão no arquivo de referência do repositório
  (`referencia/funding-capital-stack.md`), fora da documentação servida.

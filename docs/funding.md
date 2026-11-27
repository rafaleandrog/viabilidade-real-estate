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

A página **Funding** tem três abas: **Operações**, **Financiamento à produção** e **Estrutura de
capital**. Acima delas há um aviso permanente: o app simula contratos privados e não valida a
legalidade da captação — uma oferta ao público pode ter obrigações regulatórias próprias.

### A aba Operações

Cada dívida, equity e antecipação de recebíveis do estudo é um **cartão**. Os cartões seguem a
ordem de senioridade — primeiro as dívidas, depois as antecipações, por fim o equity; dentro do
mesmo tipo, a posição que a operação tem (as setas da página da operação a mudam). O
financiamento à produção não tem cartão: ele tem aba própria.

Cada cartão mostra:

- **o tipo**, numa etiqueta com a cor do tipo, e **o nome** da operação;
- **quatro termos** do contrato. Dívida: aporte (à vista ou em quantos meses), taxa ao ano, prazo
  com a carência e a amortização (Price). Equity: aporte, retorno (o percentual e sobre o que
  incide), quando o investidor recebe e o retorno total. Antecipação: carteira cedida, taxa de
  desconto, mês da cessão e valor antecipado;
- **Leitura da operação**: até três frases montadas dos números — o que a operação faz com a
  exposição máxima do incorporador, quando o projeto recebe e paga (ou o investidor aporta e
  recebe) e o custo dela contra a TIR alavancada de antes dela. O veredito pode ser negativo. Sem
  número que sustente frase, a leitura não aparece;
- **quatro indicadores**. Dívida: LTV (principal liberado ÷ VGV potencial), custo efetivo (a taxa
  anual do fluxo do credor, com as tarifas), TIR alavancada e exposição máxima. Equity: ROI do
  investidor (lucro ÷ aporte; −100% quando nada volta), TIR do investidor, TIR alavancada e
  exposição máxima. Antecipação: deságio (em percentual da face), custo efetivo, TIR alavancada e
  exposição máxima.

**TIR alavancada** e **exposição máxima** aparecem como "antes → depois", com o "antes" riscado.
As operações entram numa sequência, na ordem de senioridade, a partir do financiamento à produção
(quando ligado): o "antes" de uma operação é o projeto com as operações anteriores na sequência, e
o "depois" é com ela também; o "depois" de uma é o "antes" da seguinte. A ordem só muda a leitura —
o resultado do estudo é o mesmo em qualquer ordem. A exceção é o empate de duas antecipações no
mesmo mês e na mesma posição: a ordem em que o app simula as duas muda o resultado. Indicador sem base de cálculo mostra "—", nunca
zero. Uma antecipação sem parcela a ceder mostra deságio e custo efetivo em "—" e, abaixo dos
indicadores, o aviso de por que não há lastro.

Valores em reais nos cartões aparecem em milhões, com uma casa ("R$ 20,1 mi"); passar o ponteiro
sobre o valor mostra o número exato. Os percentuais digitados (taxa, retorno, carteira cedida) saem
com duas casas; os indicadores em percentual, com uma.

Os cartões mostram a operação gravada. O que está sendo digitado aparece na prévia da janela de
operação, até ser gravado.

Com permissão de edição, **Nova operação** abre a janela de operação (abaixo) em **Detalhes gerais**,
com a escolha do tipo — Dívida / Capital de giro, Equity ou Antecipação de recebíveis. Sem nenhuma dívida, equity ou antecipação, a aba diz que não há operação de funding e que o
Fluxo de Caixa é igual ao Livre; se o financiamento à produção estiver ligado, diz que não há
operação além dele, que tem aba própria.

### A página da operação

Clicar num cartão — ou focá-lo pelo teclado e apertar Enter ou Espaço — abre a página da operação,
no lugar da lista, com o foco nela (o próximo Tab vai ao botão de voltar). O botão **Operações**, no topo, volta para a lista, com o foco de volta no
cartão de onde se saiu. A página mostra a operação em leitura: o nome e o tipo, os **termos**
agrupados pelas etapas da janela (os campos do tipo, abaixo, com os valores gravados), o painel de
indicadores — **Visão do investidor** na dívida e no equity, **Resultado da antecipação** na
antecipação —, o **gráfico da operação** (entradas, saídas e saldo, mês a mês; o mesmo gráfico da
prévia da janela, aqui com a operação gravada) e, para quem edita, as setas que mudam a posição da
operação entre as do mesmo tipo, **Editar** e **Remover**. Operação sem movimento não desenha o
gráfico. Quem só lê vê a página sem as setas, sem Editar e sem Remover. Remover a operação aberta
volta para a lista, com o foco no primeiro cartão (ou em **Nova operação**, se não sobrar cartão).
Na página, os valores aparecem em reais cheios.

### A janela de operação

**Nova operação** e **Editar** abrem a mesma janela. No topo, o **nome da operação**. À esquerda,
as **etapas** do tipo, cada uma com o resumo do que já foi preenchido nela; a etapa com um valor
que o app recusaria ganha um ponto vermelho. No centro, os campos da etapa escolhida. À direita, o
**Resumo**, com quatro indicadores do tipo, e a **Prévia do fluxo**, o gráfico de entradas, saídas
e saldo da operação. Em telas estreitas as três partes ficam uma abaixo da outra.

| Tipo | Etapas |
|---|---|
| Dívida / Capital de giro | Detalhes gerais · Aporte · Amortização · Juros · Custos |
| Equity | Detalhes gerais · Aporte · Retorno |
| Antecipação de recebíveis | Detalhes gerais · Cessão · Desconto · Custos |

O Resumo e a prévia recalculam a cada tecla, sem gravar nada, com a operação na posição dela na
ordem de senioridade (uma operação nova entra como a última do tipo):

- **Dívida**: custo efetivo, custo financeiro (juros mais tarifas), maior saldo devedor e capital
  do incorporador no pico (a exposição máxima do projeto depois desta operação);
- **Equity**: ROI do investidor, TIR do investidor, retorno total e capital do incorporador no pico;
- **Antecipação**: valor antecipado, deságio, custo efetivo e capital do incorporador no pico.

Na janela os valores aparecem em reais cheios. Indicador sem base de cálculo mostra "—", nunca zero.

**Nada é gravado antes de Criar operação** (na edição, **Salvar alterações**, que só se habilita
depois de alguma mudança). Cancelar, o botão de
fechar e a tecla Esc fecham a janela sem gravar; se algo foi alterado, o app pergunta antes de
descartar. Clicar fora da janela não a fecha. Ao fechar, o foco volta ao botão que a abriu. Na
criação, a operação criada abre em seguida na página dela. Enquanto a operação está sendo gravada,
a janela fica travada até a resposta: os campos, Cancelar e Esc esperam.

Antes de gravar, a janela aplica as mesmas regras do servidor e mostra a recusa na etapa do campo:
valor, taxa ou prazo negativo, percentual acima de 100, carência igual ou maior que a amortização (quando a amortização é maior que zero),
"Aporte em" menor que 1, número inválido, nome vazio ou com mais de 100 caracteres (também na
edição) e, no equity, retorno somado acima de 100% entre as operações do mesmo modo. Criar operação
com uma regra violada leva à etapa do erro, avisa no rodapé que é preciso corrigir as etapas
marcadas e não grava. Se o servidor ainda assim recusar, a
mensagem aparece dentro da janela, que continua aberta com tudo o que foi digitado, e o foco vai
para essa mensagem.

**O tipo é escolhido ao criar e não muda depois.** Na edição ele aparece travado; para outro tipo,
crie uma operação nova. Na edição, só os campos alterados vão ao servidor.

Para dívida, equity e antecipação, o **Mês do aporte** (na antecipação, o **Mês da cessão**) é uma
**âncora do cronograma** — Planejamento, Pré-lançamento, Lançamento, Obra, Pós-obras, com o mês
derivado mostrado ao lado, só para leitura — ou um **Mês específico** digitado; assim a operação
acompanha o cronograma quando ele muda. Na janela, com a âncora trocada ou qualquer outro campo
alterado, o mês derivado, o Resumo e a prévia já usam o mês que a gravação vai registrar; um evento que o estudo não tem (Pré-lançamento num estudo sem
pré-lançamento) mantém o mês que a operação já tinha. Operação sem edição em andamento usa o mês
gravado — o mesmo que Fluxo de Caixa, Cenários e Resumo usam —, ainda que o Cronograma tenha mudado
depois: o mês só é rederivado quando a operação é salva de novo. A janela do financiamento à
produção vem sempre do Cronograma (a obra).

### Dívida / Capital de giro

Na janela: **Aporte** (valor, mês e distribuição), **Amortização** (prazo, carência e o sistema
Price), **Juros** (taxa) e **Custos** (as três tarifas). Informe o **Valor**, o **Mês do aporte**, a **Taxa** anual, a **Amortização** (prazo em meses) e a
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

Na janela: **Aporte** (valor e mês) e **Retorno** (modo e percentual). Informe o **Valor do
aporte**, o **Mês do aporte** e o modo de retorno:

- **Permuta financeira (% da receita líquida, mês a mês)** — o investidor recebe o percentual sobre
  a receita líquida de cada mês, enquanto houver receita.
- **% do resultado final (pago no repasse)** — o investidor recebe o percentual sobre o resultado
  final, de uma vez, no mês do repasse.

A soma dos percentuais de retorno das operações de equity do mesmo modo não passa de 100%: a janela
recusa antes de gravar, e o servidor também.

### Financiamento à produção

Uma por estudo, editada na aba própria, não na janela de operação. No cabeçalho da aba ficam o
nome, editável, e o liga/desliga. Informe a **Taxa** anual, a **Exposição mín. p/ liberação**, o
**% do custo financiado** e as linhas de custo elegíveis — o botão **Usar base padrão** seleciona o
pagamento do terreno (sem as permutas), a construção, a outorga, os projetos e as licenças e
aprovações — e se o **Caixa disponível amortiza antes das chaves**; esses campos e o nome são gravados pelo
botão **Salvar** da aba. É a única operação que liga e desliga: o interruptor no cabeçalho da aba, com o estado escrito ao lado (**Ligado** ou
**Desligado**), grava na hora. Desligada, ela fica cadastrada, com os parâmetros guardados, sai do
fluxo e da aba Estrutura de capital, e um aviso na aba lembra que ela não entra no Fluxo de Caixa;
religar volta a aplicá-la sem digitar de novo. Se o servidor recusar a mudança, o interruptor volta à
posição gravada. Quem só lê o estudo vê o interruptor desabilitado. Se a instância não oferecer o
interruptor, aparece no lugar a caixa de seleção **Ativo**, que funciona do mesmo jeito. A janela de
liberação e o mês das chaves vêm do Cronograma. Ligado, a aba mostra também o **resumo** do
financiamento (custo financiável total, percentual financiado, principal máximo previsto, primeiro
mês e valor da primeira liberação, total liberado, total de juros, pico do saldo devedor e o mês
dele, primeiro mês de amortização, último mês com dívida e total amortizado) e o gráfico
**Alavancagem mês a mês**, com o custo financiável acumulado, o principal liberado acumulado, o saldo
devedor e as amortizações. Quem só lê um estudo em que o financiamento à produção nunca foi criado
vê a aba vazia.

Como o banco libera: os custos elegíveis são reconhecidos quando incorridos; quando o percentual
incorrido atinge a exposição mínima e a obra está ativa, a liberação daquele mês cobre tudo o que
o percentual financiável autoriza sobre o acumulado até ali — a primeira liberação é, portanto, um
**catch-up** de todo o custo já incorrido, e a exposição mínima é um gatilho, não uma franquia que
fica por conta do incorporador. Não há parcela contratual: o saldo é amortizado por **varredura do
caixa** disponível, calculado sem a liberação do próprio mês.

### Antecipação de recebíveis

É a cessão de parte da carteira de recebíveis a uma securitizadora (CRI), um fundo (FIDC) ou um
banco, que paga à vista o valor presente das parcelas cedidas. Na janela: **Cessão** (mês e
carteira cedida), **Desconto** (taxa) e **Custos** (as três tarifas). Informe:

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

A página da operação mostra, em **Resultado da antecipação**:
- as parcelas cedidas (face);
- o valor presente;
- o recebido líquido;
- o deságio, em reais e em percentual da face;
- as tarifas;
- o custo efetivo.

Quem compra assume o risco das parcelas. Como o app não modela inadimplência, a cessão com ou sem
coobrigação dá os mesmos números, e não há campo para isso.

### A aba Estrutura de capital

A aba **Estrutura de capital** mostra o capital stack do projeto: de onde vem o dinheiro que paga os
usos, camada por camada, na ordem de senioridade. Ela só lê — não tem ação de edição, e quem só lê o
estudo a vê inteira. Os números são os mesmos dos cartões da aba Operações, calculados juntos.
Enquanto o Fluxo de Caixa do estudo não está calculado, a aba diz que a estrutura aparece quando ele
estiver.

No topo, **quatro totais**: **usos totais** (a soma dos custos do projeto), **dívida** (as camadas
de dívida e do financiamento à produção), **equity de terceiros** (os aportes) e **incorporador no
pico** (a exposição máxima do incorporador com toda a estrutura). Os valores aparecem em milhões,
com uma casa ("R$ 20,1 mi"); passar o ponteiro sobre o valor mostra o número exato.

Abaixo, a **torre das camadas**: uma barra só, com a camada mais sênior embaixo e o incorporador no
topo — financiamento à produção (quando ligado; desligado, não aparece), dívidas, antecipações,
equity e, por último, o incorporador. Dentro do mesmo tipo vale a posição da operação. Ao lado, um
eixo diz o sentido: "mais sênior" embaixo, "mais júnior" em cima. Cada camada tem a cor do tipo (a
mesma da etiqueta do cartão; o incorporador tem cor própria) e a altura proporcional ao valor, e
traz escritos dentro dela o nome, o nível, o valor e o percentual sobre o total das camadas. O nível
é "sênior · base" no financiamento à produção, "dívida" na dívida, "cessão de recebíveis" na
antecipação, "recebe sobre a receita" ou "participa do resultado" no equity (conforme o retorno
incide sobre a receita líquida ou sobre o resultado final) e "recebe por último" no incorporador.
Uma camada pequena tem uma altura mínima para o texto caber numa linha, e o percentual escrito
continua sendo o verdadeiro; nome comprido é cortado com reticências, e o valor e o percentual
ficam sempre visíveis. Camada de valor zero não é desenhada, mas continua visível em texto: uma
operação de valor zero (uma antecipação sem parcela a ceder, por exemplo) continua sendo uma linha
da tabela da sequência, e o incorporador de um projeto que nunca fica no vermelho aparece como
"incorporador no pico" zerado.
Sem nenhuma camada com valor, a torre dá lugar ao texto "Nenhuma camada com valor.". Para leitor
de tela, cada camada é um item de lista com o nome, o nível, o valor exato e o percentual.

O tamanho de cada camada é o **maior valor que aquela parte teve dentro do projeto**: o maior
saldo devedor na dívida e no financiamento à produção, o valor antecipado na antecipação, o aporte
no equity e a exposição máxima no incorporador. O financiamento à produção amortiza e libera de
novo, por isso a camada dele não é o total liberado.

Por fim, a **tabela da sequência**: uma linha para o projeto sem funding e uma para cada operação,
na ordem de senioridade, com a **TIR alavancada** e a **exposição máxima** depois daquele passo — os
mesmos textos do "depois" de cada cartão. A última linha é a estrutura completa, e a exposição dela
é o "incorporador no pico". A exceção é o empate de duas antecipações no mesmo mês e na mesma
posição: a ordem em que o app simula as duas muda o resultado, e a última linha (calculada na ordem
de senioridade) pode diferir do "incorporador no pico" e da torre (calculados na ordem em que as
operações estão salvas).

O texto de apoio, abaixo da tabela, lembra como ler a aba:

- senioridade aqui é a ordem de pagamento e a ordem de entrada na comparação; o app paga todo
  terceiro pelo contrato, e o incorporador cobre a falta de caixa — nenhuma operação recebe menos do
  que o contrato dela prevê por estar abaixo de outra;
- o restante dos usos é pago pelas vendas ao longo do projeto, que ficam fora da torre;
- as camadas não acontecem no mesmo mês, então a soma delas não é um saldo numa data;
- o tamanho de cada camada é o maior valor que aquela parte teve dentro do projeto, e por isso a do
  financiamento à produção não é o total liberado;
- a camada do financiamento à produção é medida na estrutura completa, e o "depois" dele na tabela
  é medido sozinho; os dois não se comparam, porque ele lê o caixa depois das outras operações.

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
| `PATCH /estudos/:id/avancado/funding/:oid` | altera uma operação; o `tipo` não muda (veja abaixo) |
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

O `tipo` de uma operação é fixado na criação. Um `PATCH` com `tipo` válido e diferente do gravado é
recusado com **422** e código `TIPO_IMUTAVEL`, sem gravar nada — nos dois sentidos, inclusive para
deixar de ser `financiamento_producao`. Um `tipo` que não é nenhum dos quatro (vazio, `null`, em
maiúsculas) não é troca de tipo: volta **400** `CAMPO_INVALIDO`, com a mesma mensagem que a criação
dá, também sem gravar nada. A recusa vem antes das regras de campo
(carência, percentuais, prazos), então uma regra violada no mesmo pedido não a esconde; só um número
malformado no mesmo pedido volta antes, como 400 `CAMPO_INVALIDO`. Mandar o **mesmo** `tipo` já gravado é aceito, e o
`PATCH` sem `tipo` continua como sempre. Para trocar de tipo, remova a operação e crie outra. Na
antecipação de recebíveis o `valor` não é lido pelo cálculo; a tela não o manda.

O `POST` recusa `nome` vazio (400 `NOME_OBRIGATORIO`); o `PATCH` não recusa. A tela é mais estrita:
recusa nome vazio, ou só com espaços, também na edição.

## Veja também

- [Estudo Avançado](avancado) · [Fórmulas da Proforma](formulas) · [Modelo de Dados](modelo-de-dados)
- O modelo anterior, de quatro instrumentos com waterfall, e a especificação completa do
  financiamento à produção estão no arquivo de referência do repositório
  (`referencia/funding-capital-stack.md`), fora da documentação servida.

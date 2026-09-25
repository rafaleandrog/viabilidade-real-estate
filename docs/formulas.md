---
titulo: Fórmulas da Proforma
descricao: Como o app calcula áreas, VGV, deduções, custos, resultado e preço sugerido no Preliminar, como a Proforma do Avançado se monta a partir do fluxo mensal, e o contrato de precisão dos valores.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Fórmulas da Proforma

> As fórmulas rodam no navegador, em tempo real, a cada edição; o servidor guarda só as premissas. Esta página é a referência de cada linha — para conferir um número, não para aprender a usar a tela (isso está em [Estudo Preliminar](preliminar) e [Estudo Avançado](avancado)).

## O que é

A Proforma é a tabela de resultado de um estudo: receita bruta, deduções, custos diretos e
indiretos, resultado e indicadores. No **Preliminar** ela sai diretamente das premissas. No
**Avançado** ela é uma segunda leitura do fluxo de caixa mensal, achatada na mesma hierarquia de
linhas para os dois níveis se compararem. As duas obedecem ao mesmo contrato de precisão, no fim
desta página.

## Áreas

**Loteamento.** A área vendável é a **Área Líquida de Venda (ALV)** de uma tabela em cascata, não
uma soma plana de percentuais. A cascata tem onze linhas e subtrai em três degraus:

```text
Poligonal − APP                                              = Área Parcelável
Parcelável − (ELUP/EPU + EPC + viário público)               = Área Líquida
Líquida − (viário privado + comuns privadas + áreas verdes)  = ALV  ← área vendável
```

Cada uma das sete linhas editáveis é digitada em m², % da Poligonal ou % da Parcelável (esta só
para as linhas posteriores à Parcelável, para não haver circularidade). Nenhuma linha sai negativa:
o piso é zero, aplicado antes de a linha ser lida pelas seguintes, e a tela avisa quando o piso
atuou — enquanto ele atua, as fatias da gleba deixam de fechar na poligonal, e é o número honesto.
Depois da permuta física a ALV vira a **área vendável líquida**.

**Incorporação.** `área vendável = Área PVT R Fechada + Área PVT NR Fechada` (as áreas fechadas);
a `área privativa` soma também as abertas, e a `área construída` soma a área comum.

## VGV

A fonte única do VGV, nos dois tipos, é o catálogo de **Produtos**:

```text
VGV bruto da categoria = Σ (área média × preço de venda/m² × unidades) das linhas daquele tipo
VGV da categoria       = VGV bruto da categoria − permuta física efetiva da categoria
VGV                    = VGV residencial + VGV não residencial
```

Duas regras governam essa fonte:

- **Só compõe catálogo a linha com as três grandezas maiores que zero** (área média, preço e
  unidades). Uma linha recém-adicionada, em branco, não conta. Sem nenhuma linha efetiva o estudo
  está em **estado vazio**: a Proforma e a sub-aba **Cenários** não mostram tabela nem KPI, e nenhuma
  despesa em % do VGV produz valor. Não há fallback para os campos antigos de área × preço da
  linha do estudo — eles não têm entrada em tela.
- **A permuta física é capada no VGV bruto da própria categoria.** A permuta pedida de cada tipo
  (`área entregue × preço médio daquele tipo`) é cortada quando vale mais que o VGV bruto daquele
  tipo; cada categoria capa sozinha, sem corte proporcional entre as duas. O VGV da categoria
  capada para em zero, nunca negativo, e a Proforma avisa o excedente. A permuta que sai no
  resultado é a **efetiva**, e as identidades `VGV R + permuta R = VGV bruto R` (idem NR) fecham.

Cada linha do catálogo tem um `tipo` (residencial ou não residencial; sem tipo conta como
residencial). **A separação em categorias é da Incorporação**: VGV, área total e preço médio
ponderado (`Σ VGV ÷ Σ área`) saem por categoria, e é sobre o total da categoria que as duas
permutas do tipo incidem — a física converte o `% área venda` sobre a área daquele tipo e valora
os m² entregues pelo preço médio daquele tipo; a financeira em `% VGV` incide sobre o VGV daquele
tipo. **No Loteamento não há categorias**: o catálogo inteiro é tratado como residencial, a tela de
Permutas só expõe os controles residenciais, e a permuta física valora pelo preço médio do
catálogo — mas a base do `% área venda` continua sendo a área vendável da cascata. No Loteamento
sem catálogo efetivo a permuta física vale zero; a Incorporação sem catálogo ainda valora a
permuta pelas premissas de preço por m² por uso.

## Deduções da receita

Imposto (a alíquota do RET, parâmetro do app, quando o estudo está **Sujeito a RET**; senão a
alíquota digitada), corretagem, marketing e as permutas financeiras — cada uma em % do VGV da sua
categoria na Incorporação; no Loteamento só a residencial existe, sobre o VGV único.

```text
Receita líquida = VGV − deduções
```

## Custos diretos

Terreno (`custo por m² × área do terreno`, zerável pela caixa **Considerar custo de aquisição do
terreno**), projetos,
manutenção pós-obra e contingências (% do VGV) e, por tipo:

- **Loteamento** — infraestrutura, em uma de três unidades: % do VGV, R$ fixo ou
  `R$/m² × área vendável bruta` (antes da permuta física).
- **Incorporação** — construção, decoração, gestão da construção, outorga, incorporação e registro.

No Loteamento a gestão da construção não incide, e construção, decoração, outorga e incorporação e
registro saem zerados: o produto de obra ali é a infraestrutura, que é sozinha o **custo de obras**
(o numerador de **Custo obras / VGV**).

## Custos indiretos

Marketing global e estrutura (mais o stand de vendas no Loteamento) e gestão e outros custos
indiretos, em % do VGV.

## Resultado

```text
Receita operacional = Receita líquida − Custo direto total
Resultado           = Receita operacional − Custo indireto total
Margem sobre VGV    = Resultado ÷ VGV × 100
```

A tabela do Preliminar termina em `= Resultado`; as leituras com as permutas somadas de volta
existem só na Proforma do Avançado — ver **O fecho de três linhas**, abaixo.

## Preço sugerido por m²

O menor preço de venda por m² para o resultado atingir o piso do benchmark `resultado_final`,
resolvido numericamente sobre o preço (um valor único, também na Incorporação). Sem esse benchmark
a tela pede que ele seja definido. Ver [Benchmarks](benchmarks).

## Cenários do Preliminar

- **Alavancas do resultado** varia cada alavanca (preço, permuta física, permuta financeira, custo
  de obra ou de infraestrutura, custo indireto) em ±5, ±10 ou ±15 % e ranqueia pela amplitude do
  impacto no resultado. O custo do terreno fica de fora do tornado.
- **Margem de segurança** resolve numericamente, para cada uma de quatro premissas, quanto ela pode
  errar até o resultado zerar (queda de preço, estouro de obra ou de infraestrutura, permuta
  física) — e, para o terreno, o valor residual até a margem-alvo sobre a receita líquida.
- **Análise de sensibilidade** recalcula a Proforma inteira com a variável escolhida em Bear e
  Bull, usando as variações do indicador de sensibilidade do benchmark daquela variável (10 % sem
  benchmark). Para o preço, Bull é preço maior; para custos e permutas, Bull é valor menor.

## A Proforma do Avançado

O Avançado não roda as fórmulas acima. A sua Proforma relê as séries mensais já calculadas pelo
fluxo de caixa — a contratação por safra, os componentes de pagamento, a carteira e o repasse, os
custos distribuídos no tempo — e as achata na hierarquia de linhas do Preliminar, para que os dois
níveis se comparem na mesma coluna.

As fórmulas do fluxo por safras — contratação bruta, desconto e líquido, os componentes de
pagamento (imediato, prazo fixo, até marco, concentrado), a parcela, o primeiro vencimento, a
carteira e o repasse — estão descritas, com os cenários de referência, nos documentos consultivos
do repositório: `referencia/padrao-incorporacao.md` (seções 11 a 14 e o anexo G, os cenários
dourados) e `referencia/inteligencia-evi-incorporacao.md` (o significado econômico). A recorrência da carteira é por safra: `saldo_s,s = principal_s` e
`saldo_s,t = saldo_s,t−1 + juros_s,t − pagamento_s,t`; o saldo nunca fica negativo nem volta a
crescer depois da última parcela.

- **Itemizada por linha de custo, em blocos canônicos.** Cada linha cadastrada em Custos aparece
  pelo nome que o usuário deu (fora do Terreno, o nome é a categoria escolhida), na ordem: Terreno
  → Projetos e aprovações → Outorga → Incorporação e registro → Construção → Gestão da construção →
  Decoração → Despesas Financeiras → Contingências no bloco direto; Marketing global → Stand e
  estrutura de vendas → Gestão e outros custos indiretos no bloco indireto — independentemente do
  grupo em que a linha foi classificada na aba Custos. Corretagem de vendas e Marketing &
  Publicidade saem do custo direto para a dedução de receita, ao lado do imposto e da permuta
  financeira, como no Preliminar. Item sem categoria canônica cai no bloco do seu grupo original;
  item com valor zero não aparece.
- **Desalavancada.** Nenhum lado do funding entra: nem as saídas (parcelas, retorno ao investidor)
  nem as entradas (liberações, aportes). É a visão econômica do empreendimento, antes de decidir
  como ele é capitalizado, e é o que mantém TIR, VPL e ROI comparáveis entre estudos com e sem
  funding. O efeito do funding se lê na sub-aba **Fluxo de Caixa**. Por isso **Despesas Financeiras** aqui
  é só o custo que o usuário classificou como financeiro — o rótulo diz "exclui serviço da dívida"
  —, enquanto na sub-aba **Fluxo de Caixa** e no **Resumo** "Custos Financeiros" inclui as duas pontas do
  funding. São visões diferentes de propósito.
- **Investimento total e ROI** são a mesma fórmula do Preliminar, somando todo o custo do motor.

### O fecho de três linhas

A tabela fecha com três leituras do mesmo projeto, cada uma com a sua base — a base acompanha a
grandeza: quando a linha soma a permuta física ao numerador, soma também ao denominador; a permuta
financeira não entra na base, porque já está dentro do VGV.

| Linha | Fórmula | Denominador do % |
|---|---|---|
| `= Resultado + Permutas` | `resultado + permuta financeira + permuta física` | VGV + permutas físicas |
| `= Resultado + Perm. Financ.` | `resultado + permuta financeira` | VGV |
| `= Resultado` | `resultado` | VGV |

A leitura mais inclusiva vem primeiro e a última linha é o resultado efetivo. As três linhas
aparecem sempre; sem permuta física, a primeira perde a nota de denominador e passa a se chamar
`= Resultado`, e com as duas permutas zeradas as três coincidem em valor. O Painel e os KPIs usam
a leitura `= Resultado`.

## Funding

As fórmulas de dívida, equity e financiamento à produção estão em [Funding](funding). Duas coisas
que o fluxo de caixa mantém: `fluxo após funding = fluxo livre do projeto + entradas de funding −
saídas de funding`, conferido pela reconciliação da aba Fluxo de Caixa — que também acusa saldo de
dívida negativo, dívida que não zera no horizonte e caixa acumulado negativo depois do funding; e
**funding nunca integra a Receita bruta (VGV)**: liberações e aportes aparecem só no bloco de
funding, e o repasse continua sendo recebimento do cliente.

## Valor canônico dos campos multiunidade

Todo campo que aceita mais de uma unidade (R$, R$/m², % do VGV; m² ou % da área nas permutas
físicas) guarda uma quantidade **canônica**: R$ a duas casas para custos e permutas financeiras, m²
a duas casas para a permuta física. A unidade exibida é apresentação, e toda fórmula — Proforma,
fluxo, Resumo, benchmarks, sensibilidade, cenários e exportações — consome o valor resolvido.
Trocar a unidade não muda o canônico. Nas Premissas do Preliminar, a troca grava só o canônico e
o modo: a coluna por unidade é um valor histórico que só muda quando você digita. Nos Custos do
Avançado, que têm uma coluna única de orçamento, a troca a regrava na unidade nova com o número que
a tela mostra. Estudos antigos continuam legíveis: o valor ativo vira canônico na primeira edição
deliberada.

## Precisão

**Persistência** — o que a coluna guarda: R$ e m² em `decimal(12,2)`; percentuais de entrada em
`decimal(5,2)`; scores do apelo comercial em `decimal(3,1)`.

**Resultado** — o que o cálculo produz: **todo valor monetário resultado de fórmula tem duas casas
decimais**, na apresentação, na entrada e no motor. `% do VGV` e `R$/m²` são representações
derivadas: carregam precisão plena internamente e arredondam só para exibir, nunca são persistidas
arredondadas. É o que permite R$ 10.000.000 atravessar um percentual com dízima e voltar ao mesmo
canônico.

```text
canônico (R$, 2 casas)  ──derivação exata──▶  % do VGV, R$/m²   (exibidos com arredondamento)
        ▲                                              │
        └──────── só muda por edição deliberada ───────┘
```

No fluxo de caixa, as séries mensais são quantizadas a duas casas a cada depósito, e os agregados
escalares (VGV total, VPL, VGV da permuta física, receita bruta) na saída; a origem que rateia os
custos em % do VGV segue com precisão plena, de propósito. A visão anual soma as séries mensais sem
requantizar — a célula é formatada em duas casas, mas o número bruto agregado por período pode
carregar mais casas. Os três campos de VGV fecham a identidade
`VGV vendável = VGV total − VGV da permuta física` porque o terceiro é derivado dos dois já
publicados.

### Estado de conformidade

Três exceções de **exibição**, e só três — nenhuma muda o que é persistido, o motor ou a entrada:

| Onde | Casas | Regra |
|---|---|---|
| Card de KPI (Resumo, Gráficos, Premissas) | 0 em R$, 1 em % | a figura grande do card; o detalhe e as tabelas seguem em 2 casas |
| Rótulo das colunas da cascata do resultado (aba Gráficos) | R$ milhões, 1 casa | o valor exato fica no detalhe de cada coluna |
| Coluna R$ da Proforma (Preliminar e Avançado, tabela de sensibilidade, CSV e PDF) | 0 (inteiros) | tela e arquivo compartilham a mesma célula; `% VGV` e `R$/m²` não mudam de precisão, mas herdam o sinal do R$ publicado |

Tudo o mais — Fluxo de Caixa (tela, CSV e PDF), orçamento de custos, tipologias, parâmetros
financeiros, preço unitário e total das alocações, as demais tabelas de Resultados — sai em duas
casas, e cada função de formatação monetária é única entre tela e exportação. Na tabela da
Proforma, linha de custo sai sempre entre parênteses; linha de receita ou resultado, só quando o
valor é de fato negativo.

## Interpretações

Onde a especificação original era ambígua, o app segue o protótipo e o bom senso: o custo do
terreno incide sobre a área do terreno; "obras" é infraestrutura no Loteamento e construção,
decoração e gestão na Incorporação; projetos e licenciamento em % incidem sobre o VGV.

## Veja também

- [Estudo Preliminar](preliminar) · [Estudo Avançado](avancado) · [Funding](funding)
- [Benchmarks](benchmarks) · [Modelo de Dados](modelo-de-dados) · [Exportação](exportacao)

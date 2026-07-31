---
titulo: Inteligência EVI — Incorporação
descricao: Base de conhecimento de negócio sobre viabilidade econômico-financeira de incorporação — premissas, motor de vendas e recebíveis, sequência mensal de cálculo e indicadores de decisão.
tipo: app
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Padrão EVI — Inteligência de Mercado e Viabilidade Econômico-Financeira de Incorporação

**Base de conhecimento de negócio · Departamento de Novos Negócios · Frente: Viabilidade Financeira**

> ⚠️ **Status: documento CONSULTIVO de negócio, não normativo sobre o runtime.** Ele explica o
> **significado econômico** esperado de um EVI — não descreve o que o app faz hoje e **não autoriza
> alterar** cálculo, schema, API ou interface. A verdade sobre o comportamento instalado está no
> código, no `schema.json`, na spec (`docs/spec/estudo-de-viabilidade-spec.md`) e nos docs de
> referência. **Divergência entre este documento e o app gera issue** — nunca mudança automática.
>
> O caminho inverso também vale: este documento **não deve ser rebaixado** para coincidir com uma
> limitação atual do app. A dinâmica funcional correspondente, com o contraste explícito entre
> comportamento vigente e modelo de referência, está em
> [Padrão de Viabilidade — Incorporação](padrao-incorporacao); a matriz de aderência conceito a
> conceito está em `docs/rodada-5-evi-2026-07-31.md`.

Este documento define como a empresa raciocina sobre a viabilidade econômico-financeira de um empreendimento de incorporação: quais premissas descrevem o negócio, como produto, preço, comercialização, recebíveis, custos e funding se combinam, e como o dinheiro entra e sai ao longo do tempo.

Ele é a **fonte de verdade conceitual de negócio** para estudos, análises, simuladores e aplicações. Seu objetivo é preservar o significado econômico das informações e permitir que qualquer solução futura represente o empreendimento com fidelidade.

O documento foi escrito para ser compreendido sem uma planilha, sistema ou código ao lado. Não define tabelas de banco de dados, endpoints, componentes de interface ou decisões de implementação. Esses assuntos pertencem à especificação funcional e técnica da aplicação.

As regras aqui são o padrão adotado pela empresa. Quando uma prática contratual específica diferir do padrão, a diferença deve ser explicitada como premissa do estudo, sem alterar silenciosamente o significado dos indicadores.

---

## Índice

1. [O que um EVI decide](#1-o-que-um-evi-decide)
2. [Convenções fundamentais](#2-convenções-fundamentais)
3. [Os seis blocos de premissas](#3-os-seis-blocos-de-premissas)
4. [O motor de vendas, recebíveis e carteira](#4-o-motor-de-vendas-recebíveis-e-carteira)
5. [Sequência mensal de cálculo](#5-sequência-mensal-de-cálculo)
6. [Indicadores de decisão](#6-indicadores-de-decisão)
7. [Dicionário de campos de negócio](#7-dicionário-de-campos-de-negócio)
8. [Validações e invariantes](#8-validações-e-invariantes)
9. [Armadilhas conhecidas](#9-armadilhas-conhecidas)
10. [Glossário](#10-glossário)

---

## 1. O que um EVI decide

### 1.1 A função do estudo

O Estudo de Viabilidade de Incorporação — EVI — existe para responder se um produto imobiliário:

- gera valor econômico;
- exige um volume de capital compatível com a empresa;
- remunera adequadamente o risco e o prazo;
- possui estrutura comercial e financeira executável;
- permanece viável quando receitas e despesas são posicionadas no tempo correto.

O EVI não é apenas uma conta de margem. Ele precisa transformar produto, preço, prazo, absorção, condição de pagamento, custos e funding em um fluxo mensal reconciliado.

### 1.2 A tese econômica da incorporação

Incorporação é a conversão de **potencial construtivo** em **área privativa vendável**. O resultado nasce de três fontes distintas:

1. **Margem de produto** — vender a área privativa por mais do que custa produzi-la e comercializá-la.
2. **Eficiência de projeto** — extrair mais área privativa vendável por m² de terreno, por m² computável e por m² construído.
3. **Estrutura de capital e tempo** — reduzir o capital próprio exposto e o período em que ele permanece exposto.

Separar essas fontes permite diagnosticar um empreendimento. Dois projetos com o mesmo resultado nominal podem ser economicamente muito diferentes se um exigir mais capital, permanecer negativo por mais tempo ou concentrar a maior parte da receita somente depois da obra.

### 1.3 Os quatro eixos

```text
PRODUTO
quanta área será produzida, de quais tipologias e com qual eficiência

    ×

PREÇO
quanto vale cada m² em cada Grupo comercial

    =

VENDAS CONTRATADAS
quanto foi comercialmente fechado, sem os juros futuros

    ⊗

TEMPO E CONDIÇÃO DE PAGAMENTO
quando vende, como recebe, quando gasta e como se financia

    =

FLUXO DE CAIXA
quanto capital exige, por quanto tempo e qual retorno produz
```

A Receita Bruta (VGV) é uma grandeza final do fluxo: corresponde à soma de todos os recebimentos dos clientes ao longo do empreendimento, inclusive os juros gerados pelo financiamento direto.

### 1.4 As perguntas que o EVI precisa responder

| Pergunta | Resposta esperada do estudo |
|---|---|
| O produto é eficiente? | Razões entre área privativa, construída, computável e terreno |
| Quanto pode ser vendido? | Estoque vendável, área por tipologia, preço por m² e vendas contratadas |
| Quanto efetivamente será recebido? | Receita Bruta (VGV), incluindo juros e repasse |
| O projeto gera resultado? | Resultado, margem e resultado por m² privativo vendável |
| Quanto capital próprio exige? | Exposição máxima e mês de ocorrência |
| Por quanto tempo o capital fica exposto? | Curva de caixa acumulado e payback |
| O retorno compensa o risco e o prazo? | TIR e VPL |
| Quanto crédito é concedido aos clientes? | Carteira de clientes total e por componente |
| Quanto endividamento é necessário? | Liberações, amortizações e saldo devedor dos instrumentos de funding |
| O modelo fecha matematicamente? | Estoque, receita, carteira, repasse, dívida e caixa reconciliados |

### 1.5 Critérios de aprovação

Este padrão não fixa margem mínima, TIR mínima, VPL mínimo ou exposição máxima aceitável. Esses limites são política de portfólio e podem mudar conforme custo de capital, disponibilidade de caixa e apetite de risco.

O padrão exige, porém, que os indicadores estruturais sejam apresentados em conjunto:

- resultado e margem;
- TIR e VPL;
- exposição máxima;
- carteira máxima;
- endividamento máximo.

Nenhum deles decide sozinho. Um projeto com margem elevada e exposição incompatível com a capacidade financeira da empresa continua sendo um projeto inviável para execução.

---

## 2. Convenções fundamentais

Estas convenções resolvem ambiguidades que, se deixadas em aberto, produzem estudos incomparáveis ou fluxos incorretos.

| # | Convenção | Consequência |
|---|---|---|
| **C1** | **O motor econômico vende m², não unidades individualizadas.** | A quantidade de unidades controla estoque e produto; o cálculo financeiro usa área privativa alocada e preço por m². |
| **C2** | **Tipologia e Grupo são conceitos diferentes.** | Tipologia descreve o produto. Grupo reúne uma seleção de tipologias, quantidades, preços, absorção e fluxo de pagamento. |
| **C3** | **Grupo não é um período de tempo.** | “1º Grupo”, “2º Grupo” e outros nomes não criam início, duração ou fim próprios. Todos usam os períodos globais do empreendimento. |
| **C4** | **O mês zero é o primeiro mês após o Planejamento.** | Pré-lançamento e Obra física começam simultaneamente no mês zero. O Planejamento ocupa meses negativos na régua analítica. |
| **C5** | **Obra física e período comercial “Durante a obra” não são a mesma janela.** | A Obra começa com o Pré-lançamento; as vendas “Durante a obra” começam somente depois do fim do Lançamento. |
| **C6** | **Não existe período independente de vendas “nas chaves”.** | A entrega é um marco. O estoque remanescente é vendido no período Após-chaves. |
| **C7** | **Após-chaves dura 12 meses.** | É uma constante do padrão e começa no primeiro mês imediatamente posterior ao fim da Obra. |
| **C8** | **Tabela curta dura 36 meses.** | É uma constante do padrão. O sinal ocorre na contratação e a primeira parcela no mês seguinte. |
| **C9** | **Vendas contratadas e Receita Bruta (VGV) são grandezas distintas.** | Contratação mede o valor comercial fechado; Receita Bruta mede o caixa recebido dos clientes, inclusive juros. |
| **C10** | **Quando o termo VGV aparece sem qualificador, significa Receita Bruta (VGV).** | Valores sem juros devem ser chamados de VGV potencial, VGV vendável ou vendas contratadas, conforme o caso. |
| **C11** | **As condições de financiamento direto aplicam-se somente às vendas anteriores à entrega.** | Novas vendas Após-chaves entram integralmente no caixa no mês da venda. |
| **C12** | **O repasse ocorre integralmente no primeiro mês Após-chaves.** | Não há antecipação, repasse parcial ou novo saldo de repasse criado por vendas posteriores à entrega. |
| **C13** | **Financiamento à produção e repasse são operações diferentes.** | O primeiro é dívida da incorporadora; o segundo é recebimento do cliente, normalmente financiado pelo banco comprador. |
| **C14** | **Permuta física reduz o estoque que pode gerar receita.** | Não é venda, não entra no caixa e não integra a Receita Bruta (VGV). |
| **C15** | **Permuta financeira acompanha o recebimento.** | A saída ocorre no mesmo mês em que a receita correspondente entra no caixa. |
| **C16** | **Existe uma única carteira econômica real.** | Seus componentes podem ser exibidos separadamente, mas nenhum saldo pode ser negativo e todos precisam fechar em zero. |
| **C17** | **Receitas são positivas e despesas são negativas no fluxo.** | A consolidação é feita por soma algébrica, sem inversões de sinal na apresentação final. |
| **C18** | **Taxas anuais são convertidas para taxas mensais equivalentes.** | Não se misturam juros simples e compostos no mesmo fluxo. |

A conversão de taxa anual para mensal é:

```text
taxa mensal = (1 + taxa anual)^(1/12) − 1
```

---

## 3. Os seis blocos de premissas

Um EVI completo é formado por seis blocos interdependentes:

```text
A. PRODUTO E ESTOQUE
        ↓
B. PREÇOS E GRUPOS COMERCIAIS
        ↓
C. CRONOGRAMA GLOBAL
        ↓
D. ABSORÇÃO E FLUXO DE PAGAMENTO
        ↓
E. CUSTOS E DESPESAS
        ↓
F. FUNDING
        ↓
MOTOR MENSAL DE FLUXO
```

---

### Bloco A — Produto, áreas, tipologias e estoque

#### A.1 Taxonomia de áreas

| Área | Definição | Papel no estudo |
|---|---|---|
| **Terreno** | Área da gleba ou do conjunto de lotes | Base do potencial construtivo e da outorga |
| **Computável** | Área que consome coeficiente de aproveitamento | Limite urbanístico de construção |
| **Construída** | Tudo que será construído, computável ou não | Base física do empreendimento |
| **Equivalente** | Área ponderada pelo custo relativo de construção | Base auxiliar de orçamento |
| **Comum** | Área construída de uso condominial | Parcela não privativa do produto |
| **Privativa** | Área pertencente às unidades | Base comercial e principal unidade econômica |
| **Privativa vendável** | Área privativa disponível depois da permuta física | Área capaz de gerar contratação e caixa |

Os derivados mínimos são:

```text
área privativa total
= área residencial fechada
+ área residencial aberta
+ área não residencial fechada
+ área não residencial aberta
```

```text
área privativa vendável
= área privativa total
− área destinada à permuta física
```

```text
razão privativa / construída
= área privativa total ÷ área construída total
```

```text
razão privativa / computável
= área privativa total ÷ área computável total
```

```text
fração não residencial
= área privativa não residencial ÷ área privativa total
```

#### A.2 Tipologias

Uma tipologia é um conjunto homogêneo de unidades, como Studio de 21 m², apartamento de 2 dormitórios de 55 m², apartamento de 3 dormitórios de 85 m² ou loja de 60 m².

Cada tipologia precisa ter, no mínimo:

- nome;
- classificação de uso;
- área privativa unitária;
- quantidade total;
- quantidade ou área destinada à permuta física, quando aplicável;
- características relevantes de produto.

A área total da tipologia é:

```text
área total da tipologia
= área privativa unitária × quantidade total
```

A área vendável da tipologia é:

```text
área vendável da tipologia
= área privativa unitária
× (quantidade total − quantidade destinada à permuta física)
```

O cálculo econômico mensal trabalha em m². Assim, uma curva de absorção pode gerar áreas equivalentes fracionárias em determinado mês sem exigir a identificação de apartamentos específicos. A definição de quais unidades físicas foram vendidas pertence à execução comercial; o EVI mede o valor econômico agregado.

#### A.3 Grupos comerciais

Um **Grupo** é um agrupamento comercial. Ele não é um período do cronograma.

Cada Grupo reúne:

- uma ou mais tipologias;
- quantidade alocada de cada tipologia;
- preço por m² de cada alocação;
- um perfil próprio de absorção de vendas;
- um perfil próprio de fluxo de pagamento.

A mesma tipologia pode aparecer em mais de um Grupo, com quantidades e preços diferentes. Exemplo:

```text
Studio de 21 m²
├── 10 unidades no 1º Grupo a determinado preço por m²
└── 90 unidades no 2º Grupo a outro preço por m²
```

Os nomes “1º Grupo”, “2º Grupo” ou semelhantes não significam que um começa depois do outro. Os Grupos podem utilizar os mesmos períodos globais e ter absorções iguais ou diferentes.

A alocação de uma tipologia em um Grupo é definida por:

```text
área alocada
= quantidade alocada × área privativa unitária
```

```text
valor contratado potencial da alocação
= área alocada × preço por m² do Grupo
```

A soma das quantidades alocadas de uma tipologia em todos os Grupos nunca pode exceder seu estoque vendável.

#### A.4 Áreas abertas e fechadas

Quando uma tipologia contém áreas fechadas e abertas, o preço médio por m² pode ser ponderado por um deflator de áreas abertas:

```text
preço da área aberta
= preço da área fechada × (1 − deflator da área aberta)
```

```text
preço médio ponderado da tipologia
= (área fechada × preço fechado + área aberta × preço aberto)
  ÷ área privativa total da unidade
```

Esse preço médio pode ser utilizado na alocação do Grupo sem perder o efeito econômico das áreas abertas.

#### A.5 Permuta física

Permuta física é a transferência de unidades ou área do próprio empreendimento como pagamento do terreno ou de outra obrigação.

Sua regra econômica é:

- reduz a área privativa vendável;
- reduz o VGV potencial que pode gerar receita;
- não gera venda contratada;
- não gera recebimento;
- não gera saída de caixa no momento da transferência;
- pode possuir valor econômico informativo para comparação das formas de aquisição do terreno.

A forma operacional de identificar e inserir as unidades permutadas pode evoluir, mas o princípio econômico é invariável: **área permutada não pode ser tratada como área vendida por caixa**.

#### A.6 Produto orçado e produto inferido

Quando ainda não existe projeto arquitetônico consolidado, o estudo pode inferir áreas, eficiência e custo a partir de empreendimentos de referência.

Cada premissa relevante deve ser identificada como:

- **orçada ou projetada especificamente**; ou
- **inferida por benchmark**.

O estudo deve permitir a leitura do grau de inferência. Um produto majoritariamente inferido possui risco de premissa maior do que um produto com projeto e orçamento consolidados.

---

### Bloco B — Preços, contratação e Receita Bruta

#### B.1 Preço por alocação

O preço comercial pertence à alocação da tipologia dentro do Grupo. Isso permite que a mesma tipologia seja comercializada por preços diferentes em Grupos diferentes.

```text
valor contratado potencial do Grupo
= soma de (área alocada × preço por m²)
```

Uma venda não residencial em bloco, a investidor ou parceiro, com preço diferenciado, deve ser tratada como um Grupo próprio quando possuir preço, absorção ou condição de pagamento diferentes.

#### B.2 As cinco grandezas de valor

| Grandeza | Definição | Uso |
|---|---|---|
| **VGV potencial bruto do produto** | Valor de toda a área privativa, antes da permuta física | Medida econômica do produto completo |
| **Valor econômico da permuta física** | Valor informativo da área transferida | Comparação de aquisição do terreno; não é receita |
| **VGV potencial vendável** | Potencial bruto menos a parcela da permuta física | Valor nominal máximo capaz de ser contratado |
| **Vendas contratadas** | Soma dos valores efetivamente fechados no mês, sem juros futuros | Estoque, corretagem, safras e aderência comercial |
| **Receita Bruta (VGV)** | Soma de todos os recebimentos dos clientes em todos os meses, inclusive juros | Resultado, margem e fluxo final de receita |

A identidade estrutural do potencial é:

```text
VGV potencial bruto do produto
= VGV potencial vendável
+ valor econômico da permuta física
```

A identidade do fluxo, depois que todo o recebível foi liquidado, é:

```text
Receita Bruta (VGV)
= vendas contratadas acumuladas
+ juros recebidos dos clientes
```

A Receita Bruta (VGV) não inclui:

- permuta física;
- liberação de financiamento à produção;
- capital de giro;
- aportes de sócios ou investidores;
- qualquer outra entrada de funding.

#### B.3 Formação mensal das vendas contratadas

```text
vendas contratadas no mês
= soma, em todos os Grupos e alocações,
  de (área contratada no mês × preço por m²)
```

A contratação ocorre quando a área sai do estoque comercial. O recebimento pode ocorrer no mesmo mês ou ao longo de meses futuros.

#### B.4 Formação da Receita Bruta (VGV)

```text
Receita Bruta do mês
= recebimentos à vista
+ sinais e entradas
+ parcelas de tabela curta
+ parcelas do componente obra da tabela longa
+ repasse
+ recebimentos de novas vendas Após-chaves
```

```text
Receita Bruta (VGV)
= soma da Receita Bruta de todos os meses
```

Os juros fazem parte das parcelas e do saldo liquidado no repasse. Por isso a Receita Bruta (VGV) pode superar as vendas contratadas.

---

### Bloco C — Cronograma global

#### C.1 Marco temporal

A régua analítica adota o mês zero como o primeiro mês imediatamente posterior ao fim do Planejamento.

- O Planejamento ocupa meses negativos.
- Pré-lançamento e Obra física começam simultaneamente no mês zero.
- O Lançamento começa imediatamente depois do Pré-lançamento.
- O período comercial “Durante a obra” começa imediatamente depois do Lançamento.
- A entrega acontece ao fim da Obra.
- Após-chaves começa no primeiro mês posterior ao fim da Obra.

A representação em datas de calendário pode mudar entre aplicações; as relações entre os períodos não podem mudar.

#### C.2 Etapas e períodos

| Etapa ou período | Início | Duração | Natureza |
|---|---|---|---|
| **Planejamento** | Antes do mês zero | Premissa editável | Produto, projetos, aprovações e preparação |
| **Pré-lançamento** | Mês zero | Premissa editável | Primeiro período comercial; Obra física já ativa |
| **Lançamento** | Após o Pré-lançamento | Premissa editável | Período de abertura formal e maior esforço comercial |
| **Durante a obra** | Após o Lançamento | Derivada | Período comercial até o último mês da Obra |
| **Obra física** | Mês zero | Premissa editável | Execução física; sobrepõe-se ao Pré-lançamento e ao Lançamento |
| **Entrega das chaves** | Fim da Obra | Marco | Encerra a Obra e separa vendas pré e pós-entrega |
| **Após-chaves** | Primeiro mês posterior à Obra | **12 meses fixos** | Venda linear do estoque remanescente |
| **Posterior** | Depois do Após-chaves | Derivada | Cauda de parcelas, manutenção e dívida |

#### C.3 Relações temporais obrigatórias

Considerando períodos inclusivos:

```text
início do Pré-lançamento
= fim do Planejamento + 1 mês
```

```text
início da Obra física
= início do Pré-lançamento
```

```text
início do Lançamento
= fim do Pré-lançamento + 1 mês
```

```text
início das vendas Durante a obra
= fim do Lançamento + 1 mês
```

```text
fim das vendas Durante a obra
= último mês da Obra física
```

```text
início do Após-chaves
= fim da Obra física + 1 mês
```

```text
duração do Após-chaves
= 12 meses
```

```text
mês do repasse
= primeiro mês Após-chaves
```

Não existe uma janela autônoma de “vendas nas chaves”. A entrega é um marco, não um período de absorção.

#### C.4 Prazos correlatos

- **Manutenção pós-obra** — período de assistência técnica após a entrega; é premissa editável e pode ultrapassar a janela Após-chaves.
- **Tabela curta** — 36 meses fixos por safra.
- **Repasse** — primeiro mês Após-chaves.
- **Capital de giro** — prazo, carência e início são premissas próprias.

Somente a tabela curta e a janela Após-chaves são prazos fixos deste padrão. Os demais prazos devem ser informados ou derivados de premissas nomeadas.

---

### Bloco D — Absorção e fluxo de pagamento

Cada Grupo possui duas configurações independentes:

1. **Absorção de vendas** — quando a área alocada será contratada.
2. **Fluxo de pagamento** — como o valor contratado antes da entrega será recebido.

As duas configurações aplicam-se a todas as alocações do Grupo.

#### D.1 Absorção por Grupo

Cada Grupo informa três percentuais:

- Pré-lançamento;
- Lançamento;
- Durante a obra.

O percentual Após-chaves é residual:

```text
percentual Após-chaves do Grupo
= 100%
− percentual Pré-lançamento
− percentual Lançamento
− percentual Durante a obra
```

Cada percentual é distribuído uniformemente na respectiva janela global.

#### D.2 Condições de pagamento antes da entrega

Cada Grupo informa:

- percentual à vista;
- percentual de tabela curta;
- percentual da tabela longa, calculado como resíduo.

```text
percentual da tabela longa
= 100%
− percentual à vista
− percentual da tabela curta
```

A tabela curta possui sinal e 36 parcelas. A tabela longa divide-se em componente pago durante a Obra e componente destinado ao repasse.

#### D.3 Regra após a entrega

As configurações de financiamento direto do Grupo não se aplicam a novas vendas Após-chaves.

```text
recebimento de nova venda Após-chaves
= 100% do valor contratado no próprio mês
```

O mesmo mês pode também receber parcelas e repasses de vendas contratadas antes da entrega.

---

### Bloco E — Custos e despesas

Cada linha de custo precisa declarar três atributos:

1. valor ou percentual;
2. base de cálculo;
3. curva temporal.

Sem curva temporal existe cálculo de margem, mas não existe estudo de viabilidade completo.

| Custo | Base de cálculo padrão | Curva temporal padrão |
|---|---|---|
| **Terreno em caixa** | Valor total ou valor por m² privativo, conforme a negociação | Pagamento no período contratualmente definido |
| **Permuta física** | Área ou unidades transferidas | Sem fluxo de caixa; reduz estoque vendável |
| **Permuta financeira** | Percentual da receita recebida | Mesmo mês do recebimento correspondente |
| **Outorga onerosa** | Fórmula urbanística aplicável | Pagamento único ou parcelamento configurável |
| **Projetos e aprovações** | Percentual da construção ou valor orçado | Planejamento e, quando aplicável, continuidade durante a Obra |
| **Construção** | Custo direto por m² privativo × área privativa total | Distribuição ao longo da Obra |
| **Gestão da construção** | Percentual do custo direto de construção | Acompanha a construção |
| **Decoração e mobiliário** | Valor por m² privativo ou valor total | Momento configurável antes da entrega |
| **Incorporação e registro** | Percentual da Receita Bruta (VGV) ou valor orçado | Momento configurável, normalmente associado ao Lançamento |
| **Manutenção pós-obra** | Percentual da Receita Bruta (VGV) ou orçamento | Ao longo da manutenção |
| **Contingências** | Percentual da Receita Bruta (VGV) ou da construção | Ao longo da Obra |
| **Publicidade de lançamento** | Percentual da Receita Bruta (VGV) ou orçamento | Planejamento, Pré-lançamento e Lançamento |
| **Marketing global e estrutura de vendas** | Percentual da Receita Bruta (VGV) | Curva comercial definida |
| **Gestão e custos indiretos** | Percentual da Receita Bruta (VGV) | Ao longo do ciclo definido |
| **Impostos** | Percentual da receita recebida no mês | Regime de caixa |
| **Corretagem** | Percentual das vendas contratadas no mês | Mês da contratação |

#### E.1 Corretagem e imposto não usam a mesma base

```text
corretagem do mês
= vendas contratadas do mês × percentual de corretagem
```

```text
imposto do mês
= receita recebida no mês × percentual de imposto
```

Numa venda financiada pela incorporadora, a corretagem pode ser paga integralmente na contratação enquanto a receita entra ao longo de anos. Essa defasagem é uma fonte real de exposição de caixa.

#### E.2 Gestão da construção

Custo direto de construção e taxa de gestão são linhas distintas. A taxa não pode estar embutida no custo por m² e ser lançada novamente em separado.

#### E.3 Permuta financeira: duas visões obrigatórias

A permuta financeira é calculada no mesmo mês em que a incorporadora recebe a receita correspondente.

**Visão sem deduções:**

```text
permuta financeira bruta do mês
= receita recebida do mês × percentual de permuta financeira
```

**Visão com deduções:**

```text
base líquida da permuta do mês
= receita recebida do mês
− impostos dedutíveis incidentes sobre essa receita
− corretagem dedutível atribuída à mesma venda
```

```text
permuta financeira líquida do mês
= base líquida da permuta do mês
× percentual de permuta financeira
```

As duas visões precisam existir para análise. O fluxo principal utiliza a visão que representa o contrato e a realidade de caixa do incorporador.

As deduções devem ser calculadas em valores monetários. Aplicar sucessivamente fatores como `(1 − imposto) × (1 − corretagem)` cria um efeito cruzado e só deve ser feito se o contrato estabelecer expressamente essa base.

---

### Bloco F — Funding

#### F.1 Financiamento à produção

Financiamento à produção é crédito concedido à incorporadora ou à SPE para financiar custos do empreendimento. Ele gera dívida da incorporadora e não integra a Receita Bruta (VGV).

A base financiável pode reunir, conforme o instrumento:

- terreno;
- construção;
- outorga;
- projetos e aprovações.

```text
custo financiável acumulado
= soma dos custos elegíveis incorridos até o mês
```

```text
percentual incorrido
= custo financiável acumulado ÷ custo financiável total
```

A liberação ocorre quando o percentual incorrido alcança a exposição mínima exigida e as demais condições do financiamento foram satisfeitas.

```text
saldo-alvo de financiamento no mês
= percentual financiado × custo financiável acumulado
```

```text
liberação do mês
= máximo entre zero e
  (saldo-alvo − liberações acumuladas anteriores)
```

```text
juros do mês
= saldo devedor inicial × taxa mensal
```

```text
saldo devedor final
= saldo devedor inicial
+ liberação
+ juros
− amortização
```

```text
fluxo líquido do financiamento
= liberação − amortização
```

Uma política define se caixa excedente amortiza a dívida antes da entrega. Independentemente dessa política, a dívida precisa ser integralmente quitada até o encerramento do fluxo.

#### F.2 Repasse não é financiamento à produção

| Elemento | Financiamento à produção | Repasse |
|---|---|---|
| Devedor econômico | Incorporadora ou SPE | Comprador da unidade |
| Finalidade | Financiar a produção | Financiar a aquisição do imóvel |
| Efeito na incorporadora | Gera dívida | Gera recebimento de cliente |
| Saldo associado | Saldo devedor bancário | Saldo a repassar da carteira |
| Entrada no VGV | Não | Sim |
| Relação entre ambos | O caixa do repasse pode amortizar a dívida | Não transforma as operações numa só |

#### F.3 Capital de giro

Capital de giro cobre descasamentos que não são atendidos pelo financiamento à produção. Suas premissas mínimas são:

- volume;
- mês da tomada;
- taxa;
- carência;
- prazo total;
- sistema de amortização.

Liberação e amortização de capital de giro também são funding, não receita.

#### F.4 Taxa de desconto

A taxa de desconto representa o custo de capital da empresa. Deve ser aplicada de forma consistente entre estudos para que os VPLs permaneçam comparáveis.

---

## 4. O motor de vendas, recebíveis e carteira

Esta é a seção central do padrão. Ela descreve como a área alocada em um Grupo sai do estoque, vira venda contratada, gera recebíveis e finalmente se converte em caixa.

### 4.1 As três camadas do motor

```text
CAMADA 1 — GRUPO E ALOCAÇÃO
Qual tipologia, quantidade, área e preço estão sendo comercializados

    ×

CAMADA 2 — ABSORÇÃO
Em qual período global a área será contratada

    ×

CAMADA 3 — FLUXO DE PAGAMENTO
Como o valor contratado antes da entrega será recebido
```

A mesma tipologia pode ter alocações em Grupos diferentes. Cada alocação conserva sua área e preço, mas herda a absorção e o fluxo de pagamento do Grupo ao qual pertence.

### 4.2 Absorção mensal por Grupo e alocação

Para cada Grupo e cada alocação:

```text
área contratada na janela
= área alocada × percentual de absorção da janela
```

```text
área contratada no mês
= área contratada na janela ÷ duração da janela
```

As janelas são:

- Pré-lançamento;
- Lançamento;
- Durante a obra;
- Após-chaves, com 12 meses.

Exemplo conceitual: se um Grupo aloca 1.000 m² de determinada tipologia e define 10% no Pré-lançamento de dois meses:

```text
área contratada no Pré-lançamento = 1.000 × 10% = 100 m²
área contratada por mês = 100 ÷ 2 = 50 m²
```

O cálculo por m² mantém a proporcionalidade mesmo quando a área mensal não corresponde a um número inteiro de unidades.

### 4.3 Vendas contratadas por mês

```text
venda contratada da alocação no mês
= área contratada no mês × preço por m² da alocação
```

```text
vendas contratadas do Grupo no mês
= soma das vendas contratadas de suas alocações
```

```text
vendas contratadas do empreendimento no mês
= soma das vendas contratadas de todos os Grupos
```

As vendas contratadas são a base de:

- baixa de estoque;
- corretagem;
- formação das safras de recebimento;
- aderência da absorção;
- reconciliação comercial.

### 4.4 Controle de estoque

O estoque inicial já deve excluir a permuta física.

```text
estoque vendável inicial
= área privativa total − área de permuta física
```

```text
estoque final do mês
= estoque inicial do mês − área contratada no mês
```

O estoque nunca pode ser negativo e precisa terminar em zero ao final do Após-chaves, quando a absorção total é de 100%.

### 4.5 Safras de vendas

Uma **safra** é o conjunto de contratos originados no mesmo mês, dentro do mesmo Grupo, alocação e modalidade de pagamento.

Safras são necessárias porque:

- contratos feitos em meses diferentes possuem prazos diferentes até a entrega;
- a tabela curta começa a pagar no mês seguinte;
- a tabela longa começa a pagar no mesmo mês;
- o saldo para repasse acumula juros por tempos diferentes.

O fluxo mensal é a soma dos recebimentos de todas as safras ativas.

### 4.6 Decomposição das vendas anteriores à entrega

Para vendas contratadas no Pré-lançamento, Lançamento e Durante a obra:

```text
valor à vista
= vendas contratadas × percentual à vista
```

```text
valor em tabela curta
= vendas contratadas × percentual de tabela curta
```

```text
valor em tabela longa
= vendas contratadas × percentual de tabela longa
```

```text
percentual de tabela longa
= 100% − percentual à vista − percentual de tabela curta
```

Os três componentes precisam somar exatamente 100%.

### 4.7 Modalidade à vista

```text
receita à vista do mês
= valor contratado à vista no mês
```

Não gera juros, carteira ou saldo de repasse.

### 4.8 Tabela curta

A tabela curta é financiamento direto com sinal e prazo fixo de 36 meses.

#### 4.8.1 Contratação

```text
sinal da safra
= valor contratado em tabela curta × percentual de sinal
```

```text
principal parcelado da safra
= valor contratado em tabela curta × (1 − percentual de sinal)
```

O sinal entra no caixa no mês da contratação.

#### 4.8.2 Parcelas

A primeira parcela ocorre no mês seguinte à contratação.

```text
parcela mensal da safra
= PMT(taxa mensal do cliente; 36; principal parcelado)
```

Cada safra paga exatamente 36 parcelas. O total recebido no mês é a soma das parcelas de todas as safras ativas.

#### 4.8.3 Carteira da tabela curta

A ordem econômica mensal é:

1. a carteira que veio do mês anterior capitaliza juros;
2. as parcelas do mês são recebidas;
3. o principal dos novos contratos do mês é adicionado à carteira.

```text
juros da carteira curta no mês
= carteira curta inicial × taxa mensal
```

```text
carteira curta final
= carteira curta inicial
+ juros
− parcelas recebidas
+ novo principal parcelado
```

O novo principal não recebe juros no mês da contratação, pois sua primeira parcela ocorre somente no mês seguinte.

A carteira da tabela curta precisa terminar exatamente em zero depois da última parcela da última safra.

### 4.9 Tabela longa

A tabela longa não possui sinal. O valor contratado é separado em dois componentes:

```text
componente pago durante a Obra
= valor contratado em tabela longa
× percentual pago durante a Obra
```

```text
componente destinado ao repasse
= valor contratado em tabela longa
× (1 − percentual pago durante a Obra)
```

#### 4.9.1 Componente pago durante a Obra

A primeira parcela ocorre no mesmo mês da contratação.

O número de parcelas da safra é a quantidade de meses entre o mês da venda e o último mês da Obra, incluindo as duas extremidades:

```text
prazo da safra
= último mês da Obra − mês da contratação + 1
```

Uma venda no último mês da Obra possui uma única parcela. Uma venda no Pré-lançamento possui o maior prazo.

```text
parcela mensal da safra
= PMT(taxa mensal do cliente;
      prazo da safra;
      componente pago durante a Obra)
```

A parcela total do mês é a soma das parcelas de todas as safras ativas.

#### 4.9.2 Carteira do componente obra

Como a primeira parcela ocorre no próprio mês da contratação, o novo principal capitaliza no mês e depois é abatido pela parcela:

```text
saldo antes da parcela
= carteira inicial do componente obra
+ novo principal do mês
```

```text
juros do mês
= saldo antes da parcela × taxa mensal
```

```text
carteira final do componente obra
= saldo antes da parcela
+ juros
− parcelas recebidas
```

A carteira do componente obra precisa chegar a zero no último mês da Obra. Saldo negativo não representa carteira real e é erro de cálculo.

### 4.10 Saldo para repasse

O componente de repasse acumula novas contratações e juros até o primeiro mês Após-chaves.

```text
saldo antes dos juros
= saldo para repasse inicial
+ novo componente de repasse contratado no mês
```

```text
juros do mês
= saldo antes dos juros × taxa mensal
```

Antes do mês do repasse:

```text
saldo para repasse final
= saldo antes dos juros + juros
```

No primeiro mês Após-chaves:

```text
valor repassado
= saldo antes dos juros + juros
```

```text
saldo para repasse final
= zero
```

Características obrigatórias:

- o repasse é integral;
- ocorre no primeiro mês Após-chaves;
- não pode ser antecipado;
- não é distribuído por vários meses;
- zera o saldo;
- não recebe novas contratações depois da entrega;
- integra a Receita Bruta (VGV), pois é recebimento de cliente;
- pode gerar caixa para amortizar o financiamento à produção, mas não é a mesma operação.

### 4.11 Vendas Após-chaves

O percentual Após-chaves é o resíduo da absorção de cada Grupo e é distribuído por 12 meses.

```text
percentual Após-chaves
= 100%
− percentual Pré-lançamento
− percentual Lançamento
− percentual Durante a obra
```

```text
percentual mensal Após-chaves
= percentual Após-chaves ÷ 12
```

Toda nova venda Após-chaves é recebida integralmente no mesmo mês:

```text
receita de nova venda Após-chaves
= venda contratada Após-chaves
```

O banco pode financiar uma parte da aquisição e o comprador pagar outra parte diretamente, mas ambas chegam à incorporadora no mesmo mês. Para o fluxo da incorporadora, é uma única entrada à vista.

A regra não elimina recebimentos antigos. Um mês Após-chaves pode conter simultaneamente:

- receita de novas vendas à vista;
- parcelas remanescentes de tabela curta;
- repasse das vendas anteriores à entrega;
- outros recebimentos já contratados antes da entrega.

### 4.12 Carteira de clientes

A carteira total é o saldo econômico que os compradores ainda devem à incorporadora:

```text
carteira total de clientes
= carteira da tabela curta
+ carteira do componente obra da tabela longa
+ saldo para repasse
```

A carteira é um indicador de risco de crédito, não de caixa.

Regras obrigatórias:

- nenhuma carteira pode ser negativa;
- o componente obra da tabela longa zera no fim da Obra;
- o saldo para repasse zera no mês do repasse;
- a tabela curta zera após a última parcela;
- a carteira total zera no encerramento do fluxo.

Existe uma única carteira econômica real. Os componentes são aberturas analíticas dessa carteira, não versões alternativas do mesmo indicador.

### 4.13 Receita mensal e Receita Bruta (VGV)

Por Grupo e alocação:

```text
receita mensal
= receita à vista
+ sinal da tabela curta
+ parcelas da tabela curta
+ parcelas do componente obra da tabela longa
+ repasse
+ recebimentos de novas vendas Após-chaves
```

Para o empreendimento:

```text
Receita Bruta do mês
= soma das receitas de todos os Grupos e alocações
```

```text
Receita Bruta (VGV)
= soma da Receita Bruta de todos os meses
```

Depois do fechamento completo:

```text
juros recebidos dos clientes
= Receita Bruta (VGV)
− vendas contratadas acumuladas
```

### 4.14 Segmentos e produtos diferenciados

O motor deve manter a rastreabilidade por Grupo e tipologia. Residencial e não residencial podem ser consolidados separadamente, mas não precisam possuir motores diferentes.

Quando uma parte do produto tiver:

- preço diferenciado;
- venda em bloco;
- absorção própria;
- condição de pagamento própria;

ela deve ser representada por um Grupo específico. Isso permite incluir lojas, lajes, coberturas ou vendas institucionais sem alterar o núcleo do cálculo.

### 4.15 Horizonte do fluxo

O horizonte não termina na entrega nem ao fim dos 12 meses Após-chaves. Ele precisa alcançar o último evento financeiro.

```text
fim da tabela curta
= mês da última contratação em tabela curta + 36 meses
```

```text
fim das vendas Após-chaves
= primeiro mês Após-chaves + 11 meses
```

```text
fim da manutenção
= início da manutenção + prazo de manutenção − 1
```

```text
fim do capital de giro
= mês da tomada + prazo total
```

```text
fim do fluxo
= maior entre todos os últimos eventos
```

O fluxo só pode ser encerrado quando:

- não há estoque;
- não há carteira;
- não há saldo para repasse;
- não há dívida;
- não há despesa futura prevista.

---

## 5. Sequência mensal de cálculo

A ordem de cálculo importa. O motor deve percorrer os meses do primeiro desembolso ao último recebimento e executar a seguinte sequência.

### Passo 1 — Classificar o mês

Identificar:

- Planejamento;
- Pré-lançamento;
- Lançamento;
- vendas Durante a obra;
- Obra física ativa;
- entrega;
- Após-chaves;
- manutenção;
- período posterior.

Calcular quantos meses restam até o fim da Obra.

### Passo 2 — Definir estoque vendável inicial

Deduzir a permuta física da área total antes de qualquer venda.

### Passo 3 — Calcular a absorção por Grupo

Aplicar o percentual do período global e distribuí-lo pela duração da janela.

### Passo 4 — Calcular a área contratada por alocação

Converter a absorção do Grupo em área contratada de cada tipologia alocada.

### Passo 5 — Baixar o estoque

Subtrair a área contratada e impedir saldo negativo.

### Passo 6 — Calcular vendas contratadas

Multiplicar a área contratada pelo preço por m² de cada alocação.

### Passo 7 — Calcular corretagem

Aplicar a corretagem sobre as vendas contratadas do mês.

### Passo 8 — Separar as modalidades pré-entrega

Nas vendas anteriores à entrega, decompor o valor em:

- à vista;
- tabela curta;
- tabela longa.

Nas vendas Após-chaves, classificar 100% como recebimento do próprio mês.

### Passo 9 — Processar a tabela curta

Calcular:

- sinal;
- novo principal parcelado;
- parcelas das safras ativas;
- juros;
- carteira final.

### Passo 10 — Processar o componente obra da tabela longa

Calcular:

- novo principal;
- prazo por safra;
- parcela por safra;
- soma das parcelas ativas;
- juros;
- carteira final.

### Passo 11 — Processar o saldo para repasse

Adicionar novas contratações, capitalizar juros e, no primeiro mês Após-chaves, liquidar integralmente o saldo.

### Passo 12 — Consolidar receita e carteira

Somar todos os recebimentos dos clientes e compor a carteira total.

### Passo 13 — Calcular impostos

Aplicar os impostos sobre a receita recebida no mês.

### Passo 14 — Calcular permuta financeira

Calcular as duas visões:

- sem deduções;
- com deduções.

Lançar no fluxo a visão contratualmente aplicável.

### Passo 15 — Calcular as demais despesas

Aplicar cada custo conforme sua base e curva temporal.

### Passo 16 — Formar o fluxo de caixa livre

```text
fluxo de caixa livre do mês
= Receita Bruta do mês + despesas do mês
```

Como despesas são negativas, a consolidação é uma soma.

Esse fluxo é desalavancado: ainda não inclui liberação e amortização dos instrumentos de funding.

### Passo 17 — Processar o financiamento à produção

Calcular:

- custo financiável acumulado;
- gatilho de liberação;
- liberação;
- juros;
- amortização;
- saldo devedor;
- fluxo líquido do instrumento.

### Passo 18 — Processar o capital de giro

Calcular liberação, juros, carência, amortização e saldo.

### Passo 19 — Formar o fluxo final

```text
fluxo final do mês
= fluxo de caixa livre
+ fluxo líquido do financiamento à produção
+ fluxo líquido do capital de giro
```

### Passo 20 — Atualizar acumulados e indicadores

Calcular:

- caixa acumulado;
- caixa livre acumulado;
- fluxo descontado;
- exposição máxima;
- carteira total;
- endividamento total;
- payback;
- TIR;
- VPL.

### Passo 21 — Executar validações de fechamento

O mês final só é aceito quando estoque, carteira, repasse e dívida estão zerados e todas as identidades do modelo fecham.

---

## 6. Indicadores de decisão

| Indicador | Definição | Leitura |
|---|---|---|
| **Receita Bruta (VGV)** | Soma de todos os recebimentos de clientes, inclusive juros | Tamanho financeiro realizado do empreendimento |
| **Vendas contratadas** | Soma dos valores comerciais fechados, sem juros futuros | Tamanho comercial nominal |
| **Juros recebidos** | Receita Bruta menos vendas contratadas | Remuneração do financiamento direto ao cliente |
| **Resultado** | Receita Bruta mais todas as despesas operacionais | Lucro econômico do projeto antes da tributação da holding |
| **Margem** | Resultado ÷ Receita Bruta (VGV) | Rentabilidade sobre a receita total |
| **Resultado por m² vendável** | Resultado ÷ área privativa vendável | Comparação entre produtos e tipologias |
| **TIR do projeto** | TIR do fluxo de caixa livre, anualizada | Retorno desalavancado do empreendimento |
| **VPL do projeto** | Fluxo de caixa livre descontado ao custo de capital | Valor criado acima da taxa de desconto |
| **Exposição máxima livre** | Maior saldo negativo do caixa livre | Capital exigido pelo projeto antes do funding |
| **Exposição máxima final** | Maior saldo negativo depois do funding | Capital próprio efetivamente necessário |
| **Payback** | Primeiro mês em que o caixa acumulado se recupera de forma definitiva | Prazo de recuperação do capital |
| **Carteira máxima** | Pico da carteira total de clientes | Exposição de crédito aos compradores |
| **Endividamento máximo** | Pico dos saldos devedores dos instrumentos | Alavancagem bancária máxima |
| **Mês do pico de exposição** | Mês em que ocorre o menor caixa acumulado | Janela crítica de execução |

Margem, TIR, VPL e exposição devem ser lidos juntos. A carteira e o endividamento explicam de onde vem o risco financeiro que não aparece na margem.

---

## 7. Dicionário de campos de negócio

**Convenções:**

- `IN` — premissa informada;
- `DER` — valor derivado;
- `CFG` — configuração fixa ou organizacional;
- áreas em m²;
- valores monetários em R$;
- taxas como fração ou percentual claramente identificado;
- prazos em meses inteiros.

### 7.1 Produto e tipologias

| Campo | Unidade | Origem |
|---|---:|---|
| área do terreno | m² | IN |
| coeficiente de aproveitamento básico | — | IN |
| coeficiente de aproveitamento máximo | — | IN |
| gabarito máximo | m | IN |
| área computável total | m² | IN |
| área construída total | m² | IN |
| área equivalente total | m² | IN |
| área comum total | m² | IN |
| área privativa residencial fechada | m² | IN |
| área privativa residencial aberta | m² | IN |
| área privativa não residencial fechada | m² | IN |
| área privativa não residencial aberta | m² | IN |
| origem do produto: orçado ou inferido | enum | IN |
| nome da tipologia | texto | IN |
| classificação de uso da tipologia | enum | IN |
| área privativa unitária | m²/unidade | IN |
| quantidade total da tipologia | unidades | IN |
| quantidade ou área de permuta física | unidades ou m² | IN |
| área total da tipologia | m² | DER |
| área vendável da tipologia | m² | DER |
| área privativa total | m² | DER |
| área privativa vendável | m² | DER |
| razão privativa/construída | — | DER |
| razão privativa/computável | — | DER |
| fração não residencial | — | DER |

### 7.2 Grupos e alocações

| Campo | Unidade | Origem |
|---|---:|---|
| nome do Grupo | texto | IN |
| ordem de exibição do Grupo | inteiro | IN |
| tipologia alocada | referência de negócio | IN |
| quantidade alocada | unidades | IN |
| área alocada | m² | DER |
| preço por m² da alocação | R$/m² | IN |
| valor contratado potencial da alocação | R$ | DER |
| saldo vendável da tipologia após a alocação | unidades e m² | DER |

### 7.3 Preços e valores econômicos

| Campo | Unidade | Origem |
|---|---:|---|
| preço da área fechada | R$/m² | IN |
| deflator da área aberta | % | IN |
| preço da área aberta | R$/m² | DER |
| preço médio ponderado da tipologia | R$/m² | DER |
| VGV potencial bruto do produto | R$ | DER |
| valor econômico da permuta física | R$ | DER |
| VGV potencial vendável | R$ | DER |
| vendas contratadas do mês | R$ | DER |
| vendas contratadas acumuladas | R$ | DER |
| juros recebidos dos clientes | R$ | DER |
| Receita Bruta do mês | R$ | DER |
| Receita Bruta (VGV) | R$ | DER |

### 7.4 Cronograma

| Campo | Unidade | Origem |
|---|---:|---|
| prazo de Planejamento | meses | IN |
| duração do Pré-lançamento | meses | IN |
| duração do Lançamento | meses | IN |
| prazo da Obra física | meses | IN |
| duração comercial Durante a obra | meses | DER |
| duração do Após-chaves | meses | CFG: 12 |
| prazo de manutenção pós-obra | meses | IN |
| mês zero | mês relativo | DER |
| início e fim de cada período global | mês relativo | DER |
| mês da entrega | mês relativo | DER |
| mês do repasse | mês relativo | DER |
| horizonte final do fluxo | meses | DER |

### 7.5 Absorção por Grupo

| Campo | Unidade | Origem |
|---|---:|---|
| percentual no Pré-lançamento | % | IN |
| percentual no Lançamento | % | IN |
| percentual Durante a obra | % | IN |
| percentual Após-chaves | % | DER |
| área contratada por período e alocação | m² | DER |
| área contratada por mês e alocação | m² | DER |

### 7.6 Fluxo de pagamento por Grupo

| Campo | Unidade | Origem |
|---|---:|---|
| percentual à vista | % | IN |
| percentual em tabela curta | % | IN |
| percentual em tabela longa | % | DER |
| percentual de sinal da tabela curta | % | IN |
| duração da tabela curta | meses | CFG: 36 |
| percentual da tabela longa pago durante a Obra | % | IN |
| percentual da tabela longa destinado ao repasse | % | DER |
| taxa anual de juros do cliente | % a.a. | IN |
| taxa mensal equivalente do cliente | % a.m. | DER |
| mês da primeira parcela curta | mês relativo | DER |
| prazo da safra longa | meses | DER |
| parcela curta por safra | R$ | DER |
| parcela longa por safra | R$ | DER |
| mês do repasse | mês relativo | DER |

### 7.7 Carteira

| Campo | Unidade | Origem |
|---|---:|---|
| novo principal da tabela curta | R$ | DER |
| carteira da tabela curta | R$ | DER |
| novo principal do componente obra | R$ | DER |
| carteira do componente obra | R$ | DER |
| novo componente de repasse | R$ | DER |
| saldo para repasse | R$ | DER |
| juros do saldo para repasse | R$ | DER |
| valor repassado | R$ | DER |
| carteira total de clientes | R$ | DER |

### 7.8 Permutas

| Campo | Unidade | Origem |
|---|---:|---|
| área ou quantidade de permuta física | m² ou unidades | IN |
| valor econômico da permuta física | R$ | DER |
| percentual de permuta financeira | % | IN |
| impostos dedutíveis da permuta | booleano ou regra contratual | IN |
| corretagem dedutível da permuta | booleano ou regra contratual | IN |
| permuta financeira bruta do mês | R$ | DER |
| base líquida da permuta do mês | R$ | DER |
| permuta financeira líquida do mês | R$ | DER |
| valor de permuta utilizado no fluxo | R$ | DER |

### 7.9 Custos

| Campo | Unidade | Origem |
|---|---:|---|
| custo do terreno | R$ ou R$/m² | IN |
| período de pagamento do terreno | enum/período | IN |
| valor venal do terreno por m² | R$/m² | IN |
| fator legal de outorga | % | IN ou CFG |
| forma de pagamento da outorga | regra | IN |
| custo direto de construção por m² privativo | R$/m² | IN |
| taxa de gestão da construção | % | IN |
| custo de decoração e mobiliário | R$ ou R$/m² | IN |
| projetos e aprovações | R$ ou % | IN |
| imposto sobre receita recebida | % | IN ou CFG |
| corretagem sobre contratação | % | IN |
| publicidade | R$ ou % do VGV | IN |
| marketing global | R$ ou % do VGV | IN |
| gestão e indiretos | R$ ou % do VGV | IN |
| incorporação e registro | R$ ou % do VGV | IN |
| manutenção pós-obra | R$ ou % do VGV | IN |
| contingências | R$ ou % | IN |

### 7.10 Funding

| Campo | Unidade | Origem |
|---|---:|---|
| exposição mínima para liberação | % | IN |
| percentual do custo financiado | % | IN |
| taxa do financiamento à produção | % a.a. | IN |
| política de amortização antecipada | regra | IN |
| custos elegíveis ao financiamento | conjunto | IN |
| liberação do financiamento no mês | R$ | DER |
| juros do financiamento no mês | R$ | DER |
| amortização do financiamento no mês | R$ | DER |
| saldo devedor do financiamento | R$ | DER |
| volume de capital de giro | R$ | IN |
| mês de tomada do capital de giro | mês | IN |
| taxa do capital de giro | % a.a. | IN |
| carência do capital de giro | meses | IN |
| prazo total do capital de giro | meses | IN |
| saldo devedor do capital de giro | R$ | DER |
| taxa de desconto | % a.a. | CFG |

---

## 8. Validações e invariantes

### 8.1 Validações estruturais — impedem o cálculo

| Regra | Verificação |
|---|---|
| Consistência das áreas | A soma das áreas privativas deve igualar a área privativa total |
| Área privativa contida na construída | Área privativa não pode exceder a construída |
| Potencial construtivo respeitado | Área computável não pode exceder o limite urbanístico |
| Tipologia válida | Área unitária e quantidade não podem ser negativas ou nulas quando a tipologia é utilizada |
| Permuta física válida | Quantidade ou área permutada não pode exceder a tipologia ou o produto |
| Alocação válida | Soma das quantidades alocadas em todos os Grupos não pode exceder o estoque vendável |
| Preço válido | Preço por m² de alocação deve ser positivo |
| Absorção válida | Pré-lançamento + Lançamento + Durante a obra não pode exceder 100% |
| Após-chaves derivado | Percentual Após-chaves deve ser o resíduo e não pode ser negativo |
| Janela Durante a obra | Pré-lançamento e Lançamento precisam caber dentro do prazo da Obra |
| Condição de pagamento válida | À vista + tabela curta não pode exceder 100% |
| Tabela longa derivada | Percentual da tabela longa deve ser o resíduo e não pode ser negativo |
| Sinal válido | Percentual de sinal deve estar entre 0% e 100% |
| Componente obra válido | Percentual pago durante a Obra deve estar entre 0% e 100% |
| Prazos válidos | Todo prazo editável precisa ser inteiro e coerente com seu evento |
| Repasse único | Mês do repasse deve ser o primeiro mês Após-chaves |
| Sem antecipação | Nenhum recebimento de repasse pode ocorrer antes do mês definido |
| Vendas Após-chaves | Novas vendas depois da entrega precisam ser 100% recebidas no mês da contratação |
| Capital de giro coerente | Carência deve ser menor do que o prazo total |

### 8.2 Invariantes de fechamento — verificam o resultado

Falha em um invariante indica erro do motor, não uma simples premissa desfavorável.

| Invariante | Regra |
|---|---|
| **Fechamento de estoque** | Estoque nunca é negativo e termina em zero |
| **Conservação da alocação** | Área alocada não supera a área vendável da tipologia |
| **Aderência da absorção** | Cada Grupo contrata exatamente 100% da área alocada |
| **Conservação da contratação** | Vendas contratadas acumuladas igualam a soma de área contratada × preço por m² |
| **Conservação da receita** | Soma da receita mensal iguala a Receita Bruta (VGV) |
| **Identidade dos juros** | Receita Bruta (VGV) menos vendas contratadas iguala os juros recebidos |
| **Permuta física fora do caixa** | Permuta física não gera receita nem despesa de caixa |
| **Permuta financeira no mês correto** | Saída acompanha o recebimento correspondente |
| **Carteira curta não negativa** | Saldo nunca é negativo e zera após a última parcela |
| **Carteira longa não negativa** | Saldo nunca é negativo e zera no fim da Obra |
| **Fechamento do repasse** | Saldo para repasse zera no primeiro mês Após-chaves e permanece zerado |
| **Carteira total real** | Soma dos três componentes; nunca negativa; zera no encerramento |
| **Nenhum novo financiamento pós-entrega** | Venda Após-chaves não cria tabela curta, longa ou saldo para repasse |
| **Cobertura do horizonte** | O fluxo alcança a última parcela, despesa e amortização |
| **Funding fora da receita** | Liberações de dívida não integram a Receita Bruta (VGV) |
| **Repasse separado do funding** | Repasse integra receita de cliente, não liberação do financiamento à produção |
| **Quitação de dívida** | Todo saldo devedor termina em zero |
| **Fechamento do caixa** | Caixa final reconcilia resultado e fluxos de funding |
| **Conservação da proforma** | Resultado iguala a soma algébrica de todas as linhas econômicas |

### 8.3 Alertas de qualidade — não bloqueiam, exigem leitura

| Alerta | Gatilho |
|---|---|
| Custo fora do benchmark | Custo de construção por m² desvia materialmente da referência |
| Eficiência atípica | Razão privativa/construída fora da faixa esperada |
| Velocidade agressiva | Concentração elevada no Pré-lançamento ou Lançamento |
| Estoque tardio elevado | Percentual Após-chaves materialmente alto |
| Contingência zerada | Ausência de reserva para imprevistos |
| Terreno sem custo aparente | Não há caixa nem permuta identificada |
| Estudo majoritariamente inferido | Produto e custos dependem predominantemente de benchmark |
| Carteira excessiva | Pico de recebíveis incompatível com a capacidade de gestão de crédito |
| Exposição incompatível | Pico de caixa negativo supera a capacidade financeira da empresa |

---

## 9. Armadilhas conhecidas

### 1 — Confundir Grupo com período

Grupo é um agrupamento comercial de tipologias, quantidades, preços, absorção e pagamento. Ele não possui calendário próprio. Criar início e fim para “1º Grupo” ou “2º Grupo” muda indevidamente o significado do modelo.

### 2 — Tratar quantidade de unidades como motor financeiro

A quantidade controla estoque, mas o cálculo econômico é feito por m². Forçar vendas mensais em números inteiros de unidades distorce a absorção e cria degraus artificiais.

### 3 — Confundir vendas contratadas com Receita Bruta (VGV)

Vendas contratadas não incluem juros futuros. Receita Bruta (VGV) é a soma do caixa recebido. Usar uma coluna no lugar da outra distorce corretagem, margem, carteira e reconciliação.

### 4 — Somar permuta física à receita

Permuta física reduz a área vendável. Seu valor pode ser exibido para análise do terreno, mas não é recebimento do incorporador.

### 5 — Aplicar permuta financeira em mês diferente do recebimento

Permuta financeira acompanha o caixa. Distribuí-la pela contratação ou por uma curva independente altera a exposição real.

### 6 — Aplicar deduções da permuta financeira de forma multiplicativa sem base contratual

Subtrair imposto e corretagem em valores monetários evita efeito cruzado. A fórmula multiplicativa só é válida quando o contrato a estabelece.

### 7 — Criar uma etapa de vendas nas chaves

A entrega é um marco. O estoque remanescente começa a ser vendido no primeiro mês Após-chaves e é distribuído em 12 meses.

### 8 — Financiar novas vendas Após-chaves pela incorporadora

Depois da entrega, novas vendas entram integralmente no caixa no mês da contratação. Parcelas posteriores só podem vir de contratos celebrados antes da entrega.

### 9 — Confundir repasse com financiamento à produção

Repasse é recebimento do cliente. Financiamento à produção é dívida da incorporadora. O fato de o repasse normalmente ajudar a amortizar a dívida não torna as operações equivalentes.

### 10 — Antecipar ou parcelar o repasse

Neste padrão, o repasse ocorre integralmente no primeiro mês Após-chaves. Antecipação e fracionamento não fazem parte do modelo.

### 11 — Calcular tabela curta com início no mês errado

O sinal entra no mês da contratação. A primeira das 36 parcelas entra no mês seguinte. Capitalizar o novo principal já no mês da venda superestima a carteira.

### 12 — Usar prazo fixo para o componente obra da tabela longa

O prazo depende do mês da contratação e do tempo restante até o fim da Obra. Uma venda tardia possui menos parcelas e parcelas maiores.

### 13 — Dividir linearmente o componente obra da tabela longa

A parcela precisa incorporar juros e ser calculada por safra. Divisão simples do principal subestima ou desloca os recebimentos.

### 14 — Aceitar carteira negativa

Carteira é saldo devido por clientes e não pode ser negativa. Resíduo negativo significa erro de recorrência, de juros, de prazo ou de ordem dos eventos.

### 15 — Encerrar o fluxo no fim da Obra ou do Após-chaves

A tabela curta pode continuar além desses períodos. O horizonte precisa alcançar a última parcela, a última despesa e a quitação de todas as dívidas.

### 16 — Tratar corretagem como percentual do recebimento

Corretagem acompanha contratação. Imposto acompanha caixa. Confundir as bases esconde a pressão financeira do início do empreendimento.

### 17 — Incluir funding na Receita Bruta (VGV)

Liberação de financiamento e capital de giro aumentam caixa, mas também criam dívida. Não são receita de venda.

### 18 — Confundir base de custo

Custo por m² construído, equivalente, de terreno e privativo não são intercambiáveis. Toda premissa precisa declarar sua base e, quando necessário, ser convertida para a base comparável do estudo.

### 19 — Dupla contagem da gestão de construção

Se a taxa de gestão já está incluída no custo por m², não pode ser lançada novamente como linha separada.

### 20 — Deixar resíduos numéricos abertos

Pequenas frações por arredondamento podem gerar juros indefinidos. Saldos imateriais precisam ser zerados dentro de uma tolerância declarada, sem mascarar diferenças econômicas reais.

### 21 — Deixar um único indicador decidir

Margem não substitui exposição, TIR não substitui VPL e VPL não substitui capacidade de execução. A decisão exige leitura conjunta.

---

## 10. Glossário

| Termo | Definição |
|---|---|
| **Absorção de vendas** | Distribuição percentual da área alocada de um Grupo pelos períodos comerciais globais |
| **Alocação** | Quantidade de uma tipologia destinada a um Grupo, com preço por m² próprio |
| **Após-chaves** | Período fixo de 12 meses iniciado no primeiro mês posterior ao fim da Obra |
| **Área computável** | Área que consome o coeficiente de aproveitamento do terreno |
| **Área construída** | Total físico construído, computável ou não |
| **Área equivalente** | Área ponderada por custo relativo de construção |
| **Área privativa** | Área de propriedade exclusiva das unidades |
| **Área privativa vendável** | Área privativa capaz de gerar contratação depois da permuta física |
| **Carteira de clientes** | Saldo total ainda devido pelos compradores à incorporadora |
| **Carteira da tabela curta** | Saldo dos principais parcelados em 36 meses, acrescido de juros e líquido das parcelas recebidas |
| **Carteira do componente obra** | Saldo das parcelas da tabela longa que devem ser pagas até o fim da Obra |
| **Chaves ou entrega** | Marco de conclusão da Obra que separa vendas pré e pós-entrega |
| **Coeficiente de aproveitamento** | Multiplicador da área do terreno que limita a área computável |
| **Durante a obra** | Período comercial iniciado após o Lançamento e encerrado no último mês da Obra física |
| **Exposição máxima** | Maior saldo negativo de caixa ao longo do empreendimento |
| **Financiamento à produção** | Dívida da incorporadora destinada a financiar custos do empreendimento |
| **Grupo** | Agrupamento comercial de tipologias, quantidades, preços, absorção e fluxo de pagamento; não é período temporal |
| **Juros recebidos** | Diferença entre Receita Bruta (VGV) e vendas contratadas depois do fechamento do fluxo |
| **Lançamento** | Período comercial iniciado imediatamente depois do Pré-lançamento |
| **Obra física** | Período de execução da construção, iniciado junto com o Pré-lançamento |
| **Outorga onerosa** | Contrapartida pelo potencial construtivo acima do coeficiente básico |
| **Payback** | Mês em que o caixa acumulado recupera de forma definitiva a exposição anterior |
| **Permuta financeira** | Pagamento atrelado à receita recebida pela incorporadora |
| **Permuta física** | Pagamento por meio de unidades ou área do próprio empreendimento |
| **Planejamento** | Período anterior ao mês zero, que precede e determina o início do Pré-lançamento e da Obra |
| **Pré-lançamento** | Primeiro período comercial, iniciado junto com a Obra após o Planejamento |
| **Receita Bruta (VGV)** | Soma de todos os recebimentos dos clientes, inclusive juros e repasse |
| **Repasse** | Liquidação bancária do saldo do comprador junto à incorporadora no primeiro mês Após-chaves |
| **Safra de vendas** | Conjunto de contratos originados no mesmo mês, Grupo, alocação e modalidade |
| **Saldo para repasse** | Componente da tabela longa que acumula juros até ser liquidado pelo repasse |
| **Sinal** | Entrada paga no mês da contratação da tabela curta |
| **Tabela curta** | Financiamento direto com sinal e 36 parcelas iniciadas no mês seguinte |
| **Tabela longa** | Financiamento direto sem sinal, com componente pago durante a Obra e saldo liquidado no repasse |
| **Tipologia** | Conjunto homogêneo de unidades com mesma área e características de produto |
| **Valor contratado** | Área contratada multiplicada pelo preço por m², sem juros futuros |
| **Vendas contratadas** | Soma dos valores contratados no mês |
| **VGV potencial bruto** | Valor econômico de toda a área privativa antes da permuta física |
| **VGV potencial vendável** | Valor nominal da área capaz de ser comercializada por caixa |
| **VPL** | Valor presente dos fluxos descontados ao custo de capital |

---

## Veja também

- [Padrão de Viabilidade — Incorporação](padrao-incorporacao) — a dinâmica funcional do app, com o contraste entre comportamento vigente e modelo de referência
- [Visão Geral](visao-geral) · [Modelo de Dados](modelo-de-dados) · [Fórmulas da Proforma](formulas) · [Benchmarks](benchmarks) · [Permissões](permissoes) · [Exportação](exportacao)
- `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência entre este documento e o código

---

*Padrão EVI · Inteligência de Mercado e Viabilidade Econômico-Financeira de Incorporação · Departamento de Novos Negócios*

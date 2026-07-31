---
titulo: Inteligência EVI — Incorporação
descricao: Base de conhecimento de negócio sobre viabilidade econômico-financeira de incorporação — premissas, contratação por safras, recebíveis, carteiras, repasse, sequência mensal de cálculo e indicadores de decisão.
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

A mecânica temporal deste padrão foi reconciliada contra dois modelos reais de referência do projeto Calliandra:

- **financiamento de prazo fixo por safra**, com sinal na contratação e primeira parcela no mês seguinte;
- **pagamento até um marco comum**, com entrada, parcelas até o fim da Obra e repasse concentrado depois da entrega.

Os dois modelos comprovam a mesma regra estrutural: **cada mês de venda cria uma safra própria de recebimentos**. O caixa de um mês é a soma dos pagamentos imediatos das vendas atuais com as parcelas e liquidações de todas as safras anteriores ainda ativas.

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
11. [Cenários de referência para validação](#11-cenários-de-referência-para-validação)

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
| **C8** | **A modalidade curta usa 36 parcelas.** | Quando utilizada, possui sinal configurável no mês da contratação e primeira parcela no mês seguinte. |
| **C9** | **Vendas contratadas e Receita Bruta (VGV) são grandezas distintas.** | Contratação mede o valor comercial líquido fechado; Receita Bruta mede o caixa recebido dos clientes, inclusive juros. |
| **C10** | **Quando o termo VGV aparece sem qualificador, significa Receita Bruta (VGV).** | Valores sem juros devem ser chamados de VGV potencial, VGV vendável ou vendas contratadas, conforme o caso. |
| **C11** | **As condições de financiamento direto aplicam-se somente às vendas anteriores à entrega.** | Novas vendas Após-chaves entram integralmente no caixa no mês da venda. |
| **C12** | **O repasse ocorre integralmente no primeiro mês Após-chaves.** | Não há antecipação, repasse parcial ou novo saldo de repasse criado por vendas posteriores à entrega. |
| **C13** | **Financiamento à produção e repasse são operações diferentes.** | O primeiro é dívida da incorporadora; o segundo é recebimento do cliente, normalmente financiado pelo banco comprador. |
| **C14** | **Permuta física reduz o estoque que pode gerar receita.** | Não é venda, não entra no caixa e não integra a Receita Bruta (VGV). |
| **C15** | **Permuta financeira acompanha o recebimento.** | A saída ocorre no mesmo mês em que a receita correspondente entra no caixa. |
| **C16** | **Existe uma única carteira econômica real.** | Seus componentes podem ser exibidos separadamente, mas nenhum saldo pode ser negativo e todos precisam fechar em zero. |
| **C17** | **Receitas são positivas e despesas são negativas no fluxo.** | A consolidação é feita por soma algébrica, sem inversões de sinal na apresentação final. |
| **C18** | **Taxas anuais são convertidas para taxas mensais equivalentes.** | Não se misturam juros simples e compostos no mesmo fluxo. |
| **C19** | **Cada mês de contratação cria uma safra própria.** | O recebimento do mês é a soma das safras atuais e anteriores ainda ativas; não se aplica uma única curva de caixa ao VGV total. |
| **C20** | **A primeira parcela recorrente ocorre, por padrão, no mês seguinte à venda.** | Pagamento no próprio mês precisa ser componente imediato explícito — à vista, entrada, sinal ou parcela no ato. |
| **C21** | **O plano de pagamento é composto por regras econômicas, não apenas por rótulos.** | O motor precisa suportar pagamento imediato, parcelamento de prazo fixo, parcelamento até um marco e pagamento concentrado em marco. |
| **C22** | **Desconto comercial reduz a base contratual antes da geração dos recebíveis.** | `valor contratado líquido = valor bruto de tabela − descontos`; ao final, `Receita Bruta = valor contratado líquido + juros recebidos`. |
| **C23** | **A incidência de juros no mês da contratação deve ser explícita.** | O padrão é não contar o mês da venda como período financeiro completo; exceção contratual precisa ser configurada e testada. |

A conversão de taxa anual para mensal é:

```text
taxa mensal = (1 + taxa anual)^(1/12) − 1
```

A regra de caixa por safra é:

```text
receita do mês t
= pagamentos imediatos das vendas do mês t
+ soma das parcelas das safras anteriores e atuais com vencimento em t
+ pagamentos concentrados ou repasses com vencimento em t
```

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

### Bloco B — Preços, contratação, descontos e Receita Bruta

#### B.1 Preço por alocação

O preço comercial pertence à alocação da tipologia dentro do Grupo. Isso permite que a mesma tipologia seja comercializada por preços diferentes em Grupos diferentes.

```text
valor bruto potencial do Grupo
= soma de (área alocada × preço por m²)
```

Uma venda não residencial em bloco, a investidor ou parceiro, com preço diferenciado, deve ser tratada como um Grupo próprio quando possuir preço, absorção ou condição de pagamento diferentes.

#### B.2 As oito grandezas de valor

| Grandeza | Definição | Uso |
|---|---|---|
| **VGV potencial bruto do produto** | Valor de toda a área privativa, antes da permuta física | Medida econômica do produto completo |
| **Valor econômico da permuta física** | Valor informativo da área transferida | Comparação de aquisição do terreno; não é receita |
| **VGV potencial vendável** | Potencial bruto menos a parcela da permuta física | Valor máximo de tabela capaz de ser comercializado |
| **Valor bruto contratado** | Área contratada × preço por m², antes de descontos comerciais | Referência de tabela e medição do desconto |
| **Descontos comerciais** | Reduções concedidas na contratação, como desconto à vista | Ponte entre preço de tabela e obrigação do cliente |
| **Valor contratado líquido** | Valor bruto contratado menos descontos | Base que será decomposta no plano de pagamento |
| **Juros recebidos** | Remuneração financeira gerada pelos componentes parcelados | Diferença entre recebimento final e principal contratado |
| **Receita Bruta (VGV)** | Soma de todos os recebimentos dos clientes, inclusive juros | Resultado, margem e fluxo final de receita |

A identidade estrutural do potencial é:

```text
VGV potencial bruto do produto
= VGV potencial vendável
+ valor econômico da permuta física
```

A identidade da contratação é:

```text
valor contratado líquido
= valor bruto contratado
− descontos comerciais
```

A identidade do fluxo, depois que todo o recebível foi liquidado, é:

```text
Receita Bruta (VGV)
= valor contratado líquido acumulado
+ juros recebidos dos clientes
```

Se não houver desconto comercial:

```text
valor bruto contratado = valor contratado líquido
```

A Receita Bruta (VGV) não inclui:

- permuta física;
- liberação de financiamento à produção;
- capital de giro;
- aportes de sócios ou investidores;
- qualquer outra entrada de funding.

#### B.3 Formação mensal das vendas contratadas

Para cada alocação e mês:

```text
valor bruto contratado no mês
= área contratada no mês × preço por m²
```

```text
desconto comercial do mês
= valor bruto contratado no mês × percentual de desconto aplicável
```

```text
valor contratado líquido no mês
= valor bruto contratado no mês − desconto comercial do mês
```

O valor contratado líquido é a base de:

- formação das safras;
- principal das modalidades de pagamento;
- reconciliação com a Receita Bruta;
- análise dos juros recebidos.

A corretagem segue a regra contratual definida pela empresa. Como padrão, incide sobre a contratação e deve declarar se sua base é o valor bruto de tabela ou o valor contratado líquido. A base não pode ficar implícita.

#### B.4 Formação da Receita Bruta (VGV)

```text
Receita Bruta do mês
= pagamentos imediatos
+ parcelas de prazo fixo
+ parcelas até marcos
+ pagamentos concentrados
+ repasse
+ recebimentos de novas vendas Após-chaves
```

```text
Receita Bruta (VGV)
= soma da Receita Bruta de todos os meses
```

Os juros fazem parte das parcelas e dos saldos liquidados. Por isso a Receita Bruta (VGV) pode superar o valor contratado líquido.

Quando existir desconto comercial, a reconciliação correta é:

```text
Receita Bruta (VGV)
= valor bruto contratado acumulado
− descontos comerciais acumulados
+ juros recebidos acumulados
```

Não se deve reconciliar a Receita Bruta contra o valor bruto de tabela sem descontar os abatimentos concedidos.

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
2. **Plano de pagamento** — como o valor contratado será convertido em recebimentos.

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

#### D.2 O plano de pagamento é composto por componentes

O valor contratado líquido de cada safra é dividido entre componentes de pagamento. A soma das participações deve fechar exatamente 100%.

```text
soma das participações dos componentes
= 100% do valor contratado líquido
```

Cada componente precisa declarar:

- participação no contrato;
- regra temporal;
- eventual sinal ou entrada;
- mês do primeiro vencimento;
- prazo fixo ou marco de encerramento;
- periodicidade;
- taxa de juros;
- regra de capitalização;
- regra de pagamento final.

As quatro regras econômicas suportadas são:

| Regra | Comportamento |
|---|---|
| **Imediato** | Recebido integralmente no mês da contratação |
| **Prazo fixo** | Número fixo de parcelas contado a partir de cada safra |
| **Até um marco** | Parcelas da safra terminam em um marco comum, como o fim da Obra |
| **Concentrado em marco** | Principal e juros são liquidados em um único mês, como o repasse |

#### D.3 Modelos comerciais usuais

O padrão deve conseguir representar, no mínimo, estes modelos.

**À vista**

```text
100% ou participação configurada
→ recebimento no mês da contratação
```

**Tabela curta**

```text
sinal no mês da contratação
+ 36 parcelas
+ primeira parcela no mês seguinte
```

**Tabela de prazo fixo longo**

```text
sinal ou entrada configurável
+ N parcelas fixas
+ primeira parcela no mês seguinte
```

O prazo pode ser, por exemplo, 120 meses. Essa modalidade é financiamento direto de longo prazo e não deve ser confundida com repasse bancário.

**Pagamento durante a Obra + repasse**

```text
entrada ou sinal no mês da contratação
+ parcelas do mês seguinte até o fim da Obra
+ saldo concentrado no primeiro mês Após-chaves
```

A participação, a taxa e a existência de juros em cada componente são premissas do Grupo.

#### D.4 Primeiro vencimento

A convenção padrão é:

```text
mês da contratação
→ somente pagamentos imediatos

mês seguinte
→ primeira parcela recorrente
```

Caso um contrato preveja parcela no ato, ela deve ser cadastrada como componente imediato ou com defasagem zero explicitamente configurada. O motor não deve criar uma parcela no próprio mês de forma implícita.

#### D.5 Regra após a entrega

As configurações de financiamento direto do Grupo não se aplicam a novas vendas Após-chaves.

```text
recebimento de nova venda Após-chaves
= 100% do valor contratado líquido no próprio mês
```

O mesmo mês pode também receber parcelas e repasses de vendas contratadas antes da entrega.

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

Uma **safra** é o conjunto de contratos originados no mesmo mês, dentro do mesmo Grupo, alocação e componente de pagamento.

Uma safra conserva, no mínimo:

- mês da contratação;
- Grupo;
- tipologia e alocação;
- valor bruto contratado;
- desconto comercial;
- valor contratado líquido;
- participação do componente;
- principal financiado;
- sinal ou entrada;
- taxa;
- regra temporal;
- primeiro vencimento;
- quantidade de parcelas ou marco final;
- parcela;
- saldo.

O fluxo mensal é a soma dos pagamentos de todas as safras com vencimento naquele mês.

```text
receita_t
= pagamentos imediatos das safras criadas em t
+ Σ pagamentos_s,t de todas as safras s ainda ativas
```

Essa estrutura reproduz a realidade comercial:

```text
mês 1
= entrada/sinal das vendas do mês 1

mês 2
= entrada/sinal das vendas do mês 2
+ primeira parcela das vendas do mês 1

mês 3
= entrada/sinal das vendas do mês 3
+ segunda parcela das vendas do mês 1
+ primeira parcela das vendas do mês 2
```

Contar apenas quantas safras estão ativas pode ser usado como atalho em uma planilha homogênea, mas o motor da aplicação deve calcular cada safra individualmente. Preços, descontos, taxas, prazos e valores podem variar entre meses.

### 4.6 Base contratual e decomposição em componentes

Para cada safra:

```text
valor bruto contratado_s
= área contratada_s × preço por m²
```

```text
desconto comercial_s
= valor bruto contratado_s × percentual de desconto_s
```

```text
valor contratado líquido_s
= valor bruto contratado_s − desconto comercial_s
```

Cada componente `c` recebe uma participação do valor líquido:

```text
valor do componente_s,c
= valor contratado líquido_s × participação_c
```

A soma dos componentes deve fechar:

```text
Σ valor do componente_s,c
= valor contratado líquido_s
```

Quando um componente possui sinal ou entrada:

```text
pagamento imediato_s,c
= valor do componente_s,c × percentual de sinal_c
```

```text
principal financiado_s,c
= valor do componente_s,c − pagamento imediato_s,c
```

### 4.7 Componentes de pagamento imediato

Um componente imediato entra integralmente no mês da contratação.

Pode representar:

- pagamento à vista;
- entrada;
- sinal;
- parcela no ato expressamente prevista.

```text
recebimento imediato_s
= valor do componente_s
```

Não gera saldo, juros ou carteira futura.

Se houver desconto à vista, o desconto reduz o valor contratado líquido antes da decomposição do plano.

### 4.8 Parcelamento de prazo fixo

No parcelamento de prazo fixo, cada safra possui o mesmo número `N` de parcelas, contado a partir de sua própria contratação.

Exemplos:

- tabela curta: 36 parcelas;
- financiamento direto longo: 120 parcelas;
- outro prazo contratualmente definido.

A convenção padrão é:

```text
primeiro vencimento = mês da contratação + 1
último vencimento = mês da contratação + N
```

O principal é:

```text
principal_s
= valor do componente_s − sinal_s
```

Com taxa mensal `r`:

```text
parcela_s
= principal_s × r × (1+r)^N
  ÷ ((1+r)^N − 1)
```

Se `r = 0`:

```text
parcela_s = principal_s ÷ N
```

A receita do componente no mês `t` é:

```text
receita_prazo_fixo_t
= Σ parcela_s
  para todas as safras em que:
  s + 1 ≤ t ≤ s + N
```

Uma venda do mês atual não gera parcela recorrente no mesmo mês. O que é recebido no ato deve estar em sinal, entrada ou componente imediato.

### 4.9 Parcelamento até um marco

Nesse modelo, todas as safras encerram suas parcelas no mesmo marco, como o último mês da Obra.

Definições:

- `s` = mês da contratação;
- `M` = último mês em que uma parcela pode ser recebida;
- primeiro vencimento = `s + 1`.

O número de parcelas é:

```text
N_s = M − s
```

Uma venda mais tardia possui menos parcelas e, portanto, parcela maior.

Sem juros:

```text
parcela_s
= principal_s ÷ N_s
```

Com juros:

```text
parcela_s
= PMT(taxa mensal; N_s; principal_s)
```

A janela é:

```text
s + 1 ≤ t ≤ M
```

Se `N_s ≤ 0`, a condição comercial é incompatível com o marco. O motor deve bloquear a configuração ou exigir que o valor seja classificado como pagamento imediato ou concentrado; não deve criar prazo negativo nem empilhar o valor no último mês.

### 4.10 Pagamento concentrado em marco e repasse

Um componente concentrado acumula principal e, quando aplicável, juros até um mês definido.

No caso do repasse:

```text
mês do repasse
= primeiro mês Após-chaves
```

Para cada safra:

```text
principal para repasse_s
= valor contratado líquido_s × participação do repasse
```

A incidência de juros precisa ser explícita.

**Convenção padrão — juros começam depois da contratação:**

```text
saldo_s,s = principal para repasse_s
```

Nos meses seguintes:

```text
juros_s,t
= saldo_s,t-1 × taxa mensal
```

```text
saldo_s,t
= saldo_s,t-1 + juros_s,t
```

No mês do repasse `R`:

```text
repasse_s,R
= saldo_s,R-1 + juros_s,R
```

```text
saldo_s,R = 0
```

Quando a taxa é zero:

```text
repasse_R
= soma dos principais destinados ao repasse
```

O padrão não admite:

- antecipação;
- repasse parcial;
- fracionamento do saldo em vários meses;
- novos saldos de repasse gerados por vendas Após-chaves.

O repasse é recebimento de cliente. Não é liberação de financiamento à produção.

### 4.11 Carteira por safra

A carteira real deve ser calculada a partir do saldo de cada safra e componente.

Para componente cuja primeira parcela ocorre no mês seguinte:

#### Mês da contratação

```text
saldo_s,s = principal_s
```

#### Meses seguintes

```text
juros_s,t
= saldo_s,t-1 × taxa mensal
```

```text
saldo_s,t
= saldo_s,t-1
+ juros_s,t
− pagamento_s,t
```

No último vencimento:

```text
saldo_s,t = 0
```

O último pagamento pode absorver uma diferença de arredondamento dentro da tolerância definida. A correção não pode alterar o principal econômico nem esconder diferença material.

Se o contrato contar o mês da contratação como período de juros, essa exceção deve ser indicada por uma premissa específica e testada separadamente. Não pode ser inferida apenas porque a venda e a parcela aparecem no mesmo mês.

### 4.12 Carteira agregada

A carteira agregada do mês é:

```text
carteira_t
= Σ saldo_s,c,t
  de todas as safras e componentes
```

As aberturas mínimas são:

- carteira de prazo fixo curto;
- carteira de prazo fixo longo, quando houver;
- carteira de componentes até marco;
- saldo concentrado para repasse;
- carteira total.

A carteira total é um indicador de risco de crédito, não de caixa.

Regras obrigatórias:

- nenhum saldo pode ser negativo;
- cada safra termina em zero;
- o saldo não pode voltar a crescer depois do último pagamento;
- a carteira total termina em zero no fim do horizonte;
- a soma dos saldos por safra precisa fechar com a visão consolidada.

### 4.13 Vendas Após-chaves

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
= valor contratado líquido Após-chaves
```

O banco pode financiar uma parte da aquisição e o comprador pagar outra diretamente, mas ambas chegam à incorporadora no mesmo mês.

A regra não elimina recebimentos antigos. Um mês Após-chaves pode conter simultaneamente:

- novas vendas à vista;
- parcelas de safras de prazo fixo contratadas antes da entrega;
- repasse;
- outros recebimentos já contratados.

### 4.14 Receita mensal e Receita Bruta (VGV)

Por Grupo e alocação:

```text
receita mensal
= pagamentos imediatos
+ parcelas de prazo fixo
+ parcelas até marco
+ pagamentos concentrados
+ repasse
+ novas vendas Após-chaves
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
juros recebidos
= Receita Bruta (VGV)
− valor contratado líquido acumulado
```

Ou, partindo do valor bruto de tabela:

```text
Receita Bruta (VGV)
= valor bruto contratado acumulado
− descontos comerciais acumulados
+ juros recebidos acumulados
```

### 4.15 Segmentos e produtos diferenciados

O motor deve manter a rastreabilidade por Grupo e tipologia. Residencial e não residencial podem ser consolidados separadamente, mas não precisam possuir motores diferentes.

Quando uma parte do produto tiver:

- preço diferenciado;
- desconto próprio;
- venda em bloco;
- absorção própria;
- condição de pagamento própria;

ela deve ser representada por um Grupo específico. Isso permite incluir lojas, lajes, coberturas ou vendas institucionais sem alterar o núcleo do cálculo.

### 4.16 Horizonte do fluxo

O horizonte não termina na entrega nem ao fim dos 12 meses Após-chaves. Ele precisa alcançar o último evento financeiro de todas as safras.

```text
fim de componente de prazo fixo
= mês da última contratação nesse componente
+ prazo em parcelas
```

```text
fim de componente até marco
= marco final configurado
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
- não há safra ativa;
- não há carteira;
- não há saldo para repasse;
- não há dívida;
- não há despesa futura prevista.

Nenhum valor pode ser deslocado para o último mês apenas porque o horizonte foi dimensionado de forma insuficiente.

### 4.17 Precisão e fechamento das safras

Os cálculos internos devem preservar precisão superior à apresentação.

O motor precisa:

- calcular PMT com precisão financeira;
- arredondar apenas na apresentação ou no momento contratualmente definido;
- ajustar a última parcela para zerar resíduo imaterial;
- registrar tolerância de fechamento;
- identificar o primeiro mês e a primeira safra divergente quando um invariante falhar.

Atalhos agregados só são aceitáveis quando produzirem exatamente o mesmo resultado da matriz de safras.

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

Calcular os marcos e os meses restantes até cada um deles.

### Passo 2 — Definir o estoque vendável inicial

Deduzir a permuta física da área total antes de qualquer venda.

### Passo 3 — Calcular a absorção por Grupo

Aplicar o percentual do período global e distribuí-lo pela duração da janela.

### Passo 4 — Calcular a área contratada por alocação

Converter a absorção do Grupo em área contratada de cada tipologia alocada.

### Passo 5 — Baixar o estoque

Subtrair a área contratada e impedir saldo negativo.

### Passo 6 — Calcular o valor bruto contratado

Multiplicar a área contratada pelo preço por m² de cada alocação.

### Passo 7 — Calcular descontos e valor contratado líquido

Aplicar os descontos comerciais válidos para a safra.

```text
valor contratado líquido
= valor bruto contratado − descontos
```

### Passo 8 — Calcular corretagem

Aplicar a corretagem sobre a base contratual declarada, sem duplicar a despesa em outra linha.

### Passo 9 — Determinar o tratamento pré ou pós-entrega

- Vendas anteriores à entrega seguem o plano de pagamento do Grupo.
- Novas vendas Após-chaves entram integralmente no próprio mês.

### Passo 10 — Decompor a safra em componentes

Distribuir o valor contratado líquido entre os componentes do plano, garantindo soma de 100%.

### Passo 11 — Registrar pagamentos imediatos

Lançar à vista, entrada, sinal e parcela no ato no mês da contratação.

### Passo 12 — Criar componentes de prazo fixo

Para cada componente:

- calcular principal;
- definir primeiro vencimento;
- calcular parcela;
- gerar o calendário da safra;
- registrar o saldo inicial.

### Passo 13 — Criar componentes até um marco

Calcular o prazo remanescente entre o mês seguinte à contratação e o marco final. Bloquear prazo incompatível.

### Passo 14 — Criar componentes concentrados

Registrar principal, taxa, marco de liquidação e convenção de incidência de juros.

### Passo 15 — Processar todas as safras ativas

No mês corrente:

- capitalizar os saldos que completaram um período;
- receber parcelas com vencimento;
- liquidar pagamentos concentrados;
- ajustar apenas resíduos imateriais na última parcela;
- atualizar o saldo de cada safra.

### Passo 16 — Consolidar as carteiras

Somar os saldos por componente, Grupo, tipologia e empreendimento.

### Passo 17 — Consolidar a Receita Bruta

Somar:

- pagamentos imediatos;
- parcelas;
- repasse;
- outras liquidações de clientes;
- novas vendas Após-chaves.

Separar principal recebido e juros recebidos.

### Passo 18 — Calcular impostos

Aplicar os impostos sobre a receita tributável recebida no mês.

### Passo 19 — Calcular permuta financeira

Calcular as duas visões:

- sem deduções;
- com deduções.

Lançar no fluxo a visão contratualmente aplicável.

### Passo 20 — Calcular as demais despesas

Aplicar cada custo conforme sua base e curva temporal.

### Passo 21 — Formar o fluxo de caixa livre

```text
fluxo de caixa livre do mês
= Receita Bruta do mês + despesas do mês
```

Como despesas são negativas, a consolidação é uma soma.

Esse fluxo é desalavancado: ainda não inclui liberação e amortização dos instrumentos de funding.

### Passo 22 — Processar o financiamento à produção

Calcular:

- custo financiável acumulado;
- gatilho de liberação;
- liberação;
- juros;
- amortização;
- saldo devedor;
- fluxo líquido do instrumento.

### Passo 23 — Processar o capital de giro e outros instrumentos

Calcular liberação, juros, carência, amortização e saldo.

### Passo 24 — Formar o fluxo final

```text
fluxo final do mês
= fluxo de caixa livre
+ fluxos líquidos dos instrumentos de funding
```

### Passo 25 — Atualizar acumulados e indicadores

Calcular:

- caixa acumulado;
- caixa livre acumulado;
- fluxo descontado;
- exposição máxima;
- descontos acumulados;
- juros recebidos;
- carteira total;
- endividamento total;
- payback;
- TIR;
- VPL.

### Passo 26 — Executar validações de fechamento

O mês final só é aceito quando:

- estoque está zerado;
- não há safra ativa;
- todas as carteiras estão zeradas;
- repasse está liquidado;
- dívidas estão quitadas;
- a Receita Bruta reconcilia com valor contratado líquido e juros;
- todas as identidades do modelo fecham.

## 6. Indicadores de decisão

| Indicador | Definição | Leitura |
|---|---|---|
| **Receita Bruta (VGV)** | Soma de todos os recebimentos de clientes, inclusive juros | Tamanho financeiro realizado do empreendimento |
| **Valor bruto contratado** | Soma de área contratada × preço por m², antes dos descontos | Tamanho comercial de tabela |
| **Descontos comerciais** | Diferença entre valor bruto e valor contratado líquido | Custo comercial concedido ao comprador |
| **Valor contratado líquido** | Obrigação principal assumida pelos clientes, sem juros futuros | Base econômica das safras |
| **Juros recebidos** | Receita Bruta menos valor contratado líquido | Remuneração do financiamento direto ao cliente |
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
| valor bruto contratado do mês | R$ | DER |
| desconto comercial do mês | R$ | DER |
| percentual de desconto comercial | % | IN |
| valor contratado líquido do mês | R$ | DER |
| valor contratado líquido acumulado | R$ | DER |
| principal recebido | R$ | DER |
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

### 7.6 Plano de pagamento por Grupo

| Campo | Unidade | Origem |
|---|---:|---|
| participação do componente | % | IN |
| tipo do componente | enum: imediato, prazo fixo, até marco, concentrado em marco | IN |
| percentual de sinal ou entrada do componente | % | IN |
| principal financiado do componente | R$ | DER |
| prazo fixo | meses/parcelas | IN ou CFG |
| prazo da modalidade curta | parcelas | CFG: 36 |
| marco final | evento ou mês relativo | IN/DER |
| defasagem do primeiro vencimento | meses | IN; padrão 1 |
| periodicidade | mensal, trimestral, semestral ou anual | IN |
| taxa anual de juros do cliente | % a.a. | IN |
| taxa mensal equivalente do cliente | % a.m. | DER |
| juros no mês da contratação | booleano | IN; padrão falso |
| quantidade de parcelas da safra | inteiro | DER |
| parcela por safra | R$ | DER |
| mês do pagamento concentrado | mês relativo | DER |
| participação destinada ao repasse | % | DER |
| soma das participações | % | DER: 100% |

### 7.7 Safras e carteira

| Campo | Unidade | Origem |
|---|---:|---|
| identificador econômico da safra | Grupo × alocação × mês × componente | DER |
| mês da contratação | mês relativo | DER |
| valor bruto da safra | R$ | DER |
| desconto da safra | R$ | DER |
| valor líquido da safra | R$ | DER |
| pagamento imediato da safra | R$ | DER |
| principal financiado da safra | R$ | DER |
| juros da safra no mês | R$ | DER |
| pagamento da safra no mês | R$ | DER |
| saldo da safra | R$ | DER |
| carteira de prazo fixo curto | R$ | DER |
| carteira de prazo fixo longo | R$ | DER |
| carteira de componentes até marco | R$ | DER |
| saldo para repasse | R$ | DER |
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
| Desconto válido | Desconto não pode ser negativo nem superar o valor bruto contratado |
| Absorção válida | Pré-lançamento + Lançamento + Durante a obra não pode exceder 100% |
| Após-chaves derivado | Percentual Após-chaves deve ser o resíduo e não pode ser negativo |
| Janela Durante a obra | Pré-lançamento e Lançamento precisam caber dentro do prazo da Obra |
| Plano de pagamento válido | Soma das participações dos componentes deve ser exatamente 100% |
| Sinal válido | Percentual de sinal ou entrada deve estar entre 0% e 100% do componente |
| Prazo fixo válido | Número de parcelas deve ser inteiro positivo |
| Marco válido | Marco final precisa ocorrer depois do primeiro vencimento da safra |
| Primeiro vencimento válido | Defasagem não pode ser negativa; valor zero precisa ser explícito |
| Taxa válida | Taxa e convenção de capitalização precisam estar definidas |
| Sem parcela implícita no ato | Pagamento no mês da venda deve estar classificado como imediato ou defasagem zero explícita |
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
| **Conservação do valor bruto** | Valor bruto contratado iguala a soma de área contratada × preço por m² |
| **Conservação dos descontos** | Valor bruto contratado menos descontos iguala o valor contratado líquido |
| **Conservação dos componentes** | Soma dos componentes de cada safra iguala seu valor contratado líquido |
| **Pagamento imediato único** | Componente imediato é recebido uma única vez no mês correto |
| **Fechamento por safra** | Sinal + amortização do principal igualam o principal contratado |
| **Identidade das parcelas** | Soma das parcelas da safra iguala principal + juros |
| **Conservação da receita** | Soma da receita mensal iguala a Receita Bruta (VGV) |
| **Identidade dos juros** | Receita Bruta menos valor contratado líquido iguala os juros recebidos |
| **Permuta física fora do caixa** | Permuta física não gera receita nem despesa de caixa |
| **Permuta financeira no mês correto** | Saída acompanha o recebimento correspondente |
| **Carteira não negativa** | Nenhum saldo de safra ou componente pode ser negativo |
| **Fechamento das carteiras** | Cada safra e componente zera no último vencimento |
| **Fechamento do repasse** | Saldo para repasse zera no primeiro mês Após-chaves e permanece zerado |
| **Nenhum novo financiamento pós-entrega** | Venda Após-chaves não cria componente parcelado ou saldo para repasse |
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
| Desconto comercial elevado | Diferença material entre valor bruto e valor líquido contratado |
| Concentração no repasse | Parcela relevante da Receita Bruta depende de um único marco |
| Prazo de carteira longo | Parte material do recebível se estende muito além da entrega |
| Contingência zerada | Ausência de reserva para imprevistos |
| Terreno sem custo aparente | Não há caixa nem permuta identificada |
| Estudo majoritariamente inferido | Produto e custos dependem predominantemente de benchmark |
| Carteira excessiva | Pico de recebíveis incompatível com a capacidade de gestão de crédito |
| Exposição incompatível | Pico de caixa negativo supera a capacidade financeira da empresa |

## 9. Armadilhas conhecidas

### 1 — Confundir Grupo com período

Grupo é um agrupamento comercial de tipologias, quantidades, preços, absorção e pagamento. Ele não possui calendário próprio. Criar início e fim para “1º Grupo” ou “2º Grupo” muda indevidamente o significado do modelo.

### 2 — Tratar quantidade de unidades como motor financeiro

A quantidade controla estoque, mas o cálculo econômico é feito por m². Forçar vendas mensais em números inteiros de unidades distorce a absorção e cria degraus artificiais.

### 3 — Aplicar uma única curva de recebimento ao VGV total

A absorção gera contratações mensais. Cada contratação cria sua própria safra. Distribuir o VGV total diretamente por percentuais mensais elimina a sobreposição real de entradas e parcelas.

### 4 — Confundir valor bruto, valor líquido e Receita Bruta

O valor bruto de tabela pode sofrer desconto. O valor líquido é o principal contratado. A Receita Bruta inclui o valor líquido e os juros. Usar uma grandeza no lugar da outra quebra a reconciliação.

### 5 — Somar permuta física à receita

Permuta física reduz a área vendável. Seu valor pode ser exibido para análise do terreno, mas não é recebimento do incorporador.

### 6 — Aplicar permuta financeira em mês diferente do recebimento

Permuta financeira acompanha o caixa. Distribuí-la pela contratação ou por uma curva independente altera a exposição real.

### 7 — Aplicar deduções da permuta financeira de forma multiplicativa sem base contratual

Subtrair imposto e corretagem em valores monetários evita efeito cruzado. A fórmula multiplicativa só é válida quando o contrato a estabelece.

### 8 — Criar uma etapa de vendas nas chaves

A entrega é um marco. O estoque remanescente começa a ser vendido no primeiro mês Após-chaves e é distribuído em 12 meses.

### 9 — Financiar novas vendas Após-chaves pela incorporadora

Depois da entrega, novas vendas entram integralmente no caixa no mês da contratação. Parcelas posteriores só podem vir de contratos celebrados antes da entrega.

### 10 — Confundir repasse com financiamento à produção

Repasse é recebimento do cliente. Financiamento à produção é dívida da incorporadora. O fato de o repasse normalmente ajudar a amortizar a dívida não torna as operações equivalentes.

### 11 — Antecipar ou parcelar o repasse

Neste padrão, o repasse ocorre integralmente no primeiro mês Após-chaves. Antecipação e fracionamento não fazem parte do modelo.

### 12 — Colocar a primeira parcela recorrente no mês da venda sem regra explícita

A convenção padrão é sinal ou entrada no ato e primeira parcela no mês seguinte. Pagamento no mesmo mês precisa ser componente imediato ou defasagem zero declarada.

### 13 — Contar o mês da contratação como período cheio de juros

O novo principal não deve receber juros antes de completar um período, salvo regra contratual explícita. Esse erro superestima carteira, repasse e Receita Bruta.

### 14 — Confundir financiamento de prazo fixo longo com componente até a Obra e repasse

Uma tabela de 120 meses termina 120 meses depois de cada venda. Um componente até a Obra termina num marco comum e pode deixar saldo para repasse. São modelos diferentes.

### 15 — Usar prazo fixo para todas as safras de um componente até marco

Quando todas as safras terminam na entrega, uma venda tardia tem menos parcelas e parcela maior. Fixar o mesmo prazo desloca caixa para depois do marco.

### 16 — Dividir principal por número de meses quando há juros

Com taxa positiva, a parcela deve ser calculada por PMT ou fórmula financeira equivalente. Divisão simples subestima os recebimentos.

### 17 — Usar contador de safras como motor principal

Contadores funcionam em planilhas homogêneas. No app, cada safra pode ter preço, desconto, taxa e prazo diferentes; o cálculo precisa ser individual.

### 18 — Aceitar carteira negativa

Carteira é saldo devido por clientes e não pode ser negativa. Resíduo negativo significa erro de recorrência, juros, prazo ou ordem dos eventos.

### 19 — Deixar a carteira crescer depois do último pagamento

Depois que a última parcela foi recebida, a safra precisa estar zerada. Capitalizar um resíduo indefinidamente é erro de fechamento.

### 20 — Encerrar o fluxo no fim da Obra ou do Após-chaves

Componentes de prazo fixo podem continuar além desses períodos. O horizonte precisa alcançar a última parcela, a última despesa e a quitação de todas as dívidas.

### 21 — Empilhar valores excedentes no último mês

Se um recebimento ultrapassar o array, o horizonte está errado. Mover o valor para o último mês altera TIR, VPL e exposição e mascara o defeito.

### 22 — Tratar corretagem como percentual do recebimento

Corretagem acompanha contratação. Imposto acompanha caixa. Confundir as bases esconde a pressão financeira do início do empreendimento.

### 23 — Incluir funding na Receita Bruta (VGV)

Liberação de financiamento e capital de giro aumentam caixa, mas também criam dívida. Não são receita de venda.

### 24 — Confundir base de custo

Custo por m² construído, equivalente, de terreno e privativo não são intercambiáveis. Toda premissa precisa declarar sua base e, quando necessário, ser convertida para a base comparável do estudo.

### 25 — Dupla contagem da gestão de construção

Se a taxa de gestão já está incluída no custo por m², não pode ser lançada novamente como linha separada.

### 26 — Deixar resíduos numéricos abertos

Pequenas frações por arredondamento podem gerar juros indefinidos. Saldos imateriais precisam ser zerados na última parcela dentro de tolerância declarada, sem mascarar diferença econômica real.

### 27 — Deixar um único indicador decidir

Margem não substitui exposição, TIR não substitui VPL e VPL não substitui capacidade de execução. A decisão exige leitura conjunta.

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
| **Carteira de clientes** | Soma dos saldos econômicos ainda devidos pelos compradores |
| **Componente até marco** | Parcela do contrato paga de forma recorrente até um mês comum, como o fim da Obra |
| **Componente concentrado** | Parcela do contrato liquidada em um único marco, como o repasse |
| **Componente de prazo fixo** | Parcela do contrato paga em número fixo de prestações contado a partir de cada safra |
| **Contrato bruto** | Área contratada × preço por m², antes de descontos comerciais |
| **Contrato líquido** | Contrato bruto menos descontos; principal econômico que será recebido |
| **Desconto comercial** | Redução concedida sobre o valor bruto de tabela antes da formação dos recebíveis |
| **Durante a obra** | Período comercial iniciado após o Lançamento e encerrado no último mês da Obra física |
| **Exposição máxima** | Maior saldo negativo de caixa ao longo do empreendimento |
| **Financiamento à produção** | Dívida da incorporadora destinada a financiar custos do empreendimento |
| **Grupo** | Agrupamento comercial de tipologias, quantidades, preços, absorção e fluxo de pagamento; não é período temporal |
| **Juros no mês da contratação** | Convenção que define se o mês da venda conta como período financeiro; padrão falso |
| **Juros recebidos** | Diferença entre Receita Bruta (VGV) e valor contratado líquido depois do fechamento do fluxo |
| **Lançamento** | Período comercial iniciado imediatamente depois do Pré-lançamento |
| **Obra física** | Período de execução da construção, iniciado junto com o Pré-lançamento |
| **Pagamento imediato** | Valor recebido no mês da contratação: à vista, entrada, sinal ou parcela no ato |
| **Payback** | Mês em que o caixa acumulado recupera de forma definitiva a exposição anterior |
| **Permuta financeira** | Pagamento atrelado à receita recebida pela incorporadora |
| **Permuta física** | Pagamento por meio de unidades ou área do próprio empreendimento |
| **Planejamento** | Período anterior ao mês zero, que precede e determina o início do Pré-lançamento e da Obra |
| **PMT** | Parcela periódica calculada a partir de principal, taxa e prazo |
| **Pré-lançamento** | Primeiro período comercial, iniciado junto com a Obra após o Planejamento |
| **Primeiro vencimento** | Primeiro mês em que a prestação recorrente é devida; padrão mês seguinte à contratação |
| **Receita Bruta (VGV)** | Soma de todos os recebimentos dos clientes, inclusive juros e repasse |
| **Repasse** | Liquidação bancária do saldo do comprador junto à incorporadora no primeiro mês Após-chaves |
| **Safra de vendas** | Conjunto de contratos originados no mesmo mês, Grupo, alocação e componente de pagamento |
| **Saldo para repasse** | Componente que acumula principal e, quando aplicável, juros até a liquidação bancária |
| **Sinal** | Pagamento imediato vinculado a um componente financiado |
| **Tabela curta** | Modelo de prazo fixo com sinal e 36 parcelas iniciadas no mês seguinte |
| **Tabela longa de prazo fixo** | Financiamento direto com prazo longo contado a partir de cada safra, como 120 meses |
| **Tabela longa com repasse** | Modelo que combina pagamento durante a Obra e saldo concentrado no repasse |
| **Tipologia** | Conjunto homogêneo de unidades com mesma área e características de produto |
| **Valor contratado líquido** | Obrigação principal do cliente depois de descontos, sem juros futuros |
| **Vendas contratadas** | Série mensal do valor contratado líquido; pode ser acompanhada também pelo valor bruto e pelos descontos |
| **VGV potencial bruto** | Valor econômico de toda a área privativa antes da permuta física |
| **VGV potencial vendável** | Valor nominal da área capaz de ser comercializada por caixa |
| **VPL** | Valor presente dos fluxos descontados ao custo de capital |

## 11. Cenários de referência para validação

Os cenários abaixo não substituem as premissas de cada empreendimento. Eles existem como referências de fechamento para comprovar que o motor respeita safras, vencimentos, juros, carteiras e marcos.

> **Origem da referência.** Os dois cenários vêm de EVIs do projeto **Calliandra**, que é um
> **loteamento**. O que se aproveita deles é a **mecânica econômica dos recebíveis** — safra, sinal,
> primeiro vencimento, PMT, marco comum e liquidação concentrada —, que independe do tipo de
> empreendimento. Produto, tipologia, custo e estrutura de obra **não** são importados.

### 11.1 Calliandra — prazo fixo por safra

O EVI detalhado de Calliandra utiliza:

| Premissa | Valor de referência |
|---|---:|
| Participação à vista | 20,0% |
| Desconto à vista | 5,0% |
| Participação em prazo curto | 13,3% |
| Prazo curto | 36 parcelas |
| Participação em prazo longo | aproximadamente 64,81% |
| Prazo longo | 120 parcelas |
| Venda de casa em linha separada | aproximadamente 1,8868% |
| Sinal nos componentes parcelados | 15,0% |
| Taxa do cliente | 15,0% a.a. |
| Primeiro vencimento | mês seguinte à contratação |

A taxa mensal equivalente é:

```text
r = (1 + 15%)^(1/12) − 1
r ≈ 1,1714917% a.m.
```

A base contratada e sua distribuição no tempo fazem parte do cenário — sem elas os valores
esperados não são reproduzíveis:

```text
base contratada total = R$ 28.601.115,20

meses 1 a 4   → R$ 2.860.111,52 por mês   (10,0% da base por mês)
meses 5 a 12  → R$ 2.145.083,64 por mês   ( 7,5% da base por mês)
meses 13+     → sem contratação
```

A linha de `Vendas Contratadas` do primeiro mês é, portanto, R$ 2.860.111,52 — e ela **inclui** a
parcela denominada **Venda Casas**, que corresponde a **1 de 53 lotes** (1 ÷ 53 = 1,8868%) e possui
regra própria: **240 parcelas com 30% de sinal**. Essa regra existe nas premissas do estudo, mas
**não foi levada para as colunas de receita do fluxo**, que abrem somente à vista, tabela curta e
tabela longa.

Por isso, o cenário dourado deve:

- isolar a base de recebíveis de lotes representada nas três modalidades — que somam **98,1132%**,
  não 100%; ou
- incluir uma regra de pagamento própria para a casa antes de exigir fechamento de 100%.

Os valores mensais abaixo validam as três modalidades efetivamente representadas no fluxo:

| Mês | Receita esperada |
|---:|---:|
| 1 | R$ 878.539,92 |
| 2 | R$ 914.119,61 |
| 3 | R$ 949.699,31 |
| 4 | R$ 985.279,01 |

O crescimento ocorre porque cada novo mês adiciona:

- pagamentos imediatos da nova safra;
- parcelas das safras anteriores.

Depois do fim das vendas, as parcelas continuam. À medida que cada safra conclui suas 36 ou 120 prestações, a receita cai em degraus, não de uma só vez.

Valores de controle adicionais:

| Mês | Receita esperada |
|---:|---:|
| 13 | R$ 355.796,98 |
| 38 | R$ 344.737,04 |
| 49 | R$ 245.197,58 |
| 122 | R$ 220.677,83 |
| 132 | R$ 18.389,82 |
| 133 | R$ 0,00 |

Esse cenário valida a mecânica temporal das modalidades representadas, mas não deve ser usado
para afirmar que a linha agregada `Vendas Contratadas` fecha com a receita sem antes tratar a
`Venda Casas`.

Ele valida:

- sinal no mês da venda;
- primeira parcela no mês seguinte;
- safras sobrepostas;
- prazos fixos diferentes;
- juros por PMT;
- encerramento gradual;
- horizonte até a última parcela.

### 11.2 Calliandra — parcelas até a Obra e repasse

O fluxo sintético de Calliandra é reproduzido por:

| Componente | Participação |
|---|---:|
| Entrada no mês da venda | 15% |
| Parcelas do mês seguinte até o fim da Obra | 15% |
| Repasse no primeiro mês posterior | 70% |

No cenário:

- vendas distribuídas **uniformemente** por 12 meses — curva diferente da do cenário anterior;
- último mês de parcelas durante a Obra: mês 24;
- repasse: mês 25;
- taxa dos componentes: zero.

```text
base contratada total = R$ 28.547.740,29

meses 1 a 12  → R$ 2.378.978,36 por mês   (1/12 da base por mês)
meses 13+     → sem contratação
```

Para uma safra vendida no mês `s`:

```text
quantidade de parcelas
= 24 − s
```

```text
parcela da safra
= principal durante a Obra ÷ (24 − s)
```

As três conferências que fecham o cenário:

```text
mês 1        = 15% × 2.378.978,36                        = R$    356.846,75
meses 13–24  = 15% × 2.378.978,36 × Σ_{s=1..12} 1/(24−s) = R$    254.936,38
mês 25       = 70% × 28.547.740,29                       = R$ 19.983.418,20
```

Valores de controle:

| Mês | Receita esperada |
|---:|---:|
| 1 | R$ 356.846,75 |
| 2 | R$ 372.361,83 |
| 3 | R$ 388.582,14 |
| 12 | R$ 582.045,90 |
| 13 a 24 | R$ 254.936,38 por mês |
| 25 | R$ 19.983.418,20 |

Esse cenário valida:

- entrada no mês da contratação;
- primeira parcela no mês seguinte;
- prazo decrescente por safra;
- parcelas maiores para vendas tardias;
- marco comum de encerramento;
- repasse concentrado;
- fechamento de 100% do valor contratado.

### 11.3 Urbitá — uso limitado como referência

O fluxo de recebimentos de Urbitá também acumula parcelas de safras anteriores. Portanto, a sua linha de caixa não deve ser descartada integralmente.

Entretanto, as fórmulas de carteira analisadas não representam saldo econômico real:

- a carteira longa pode ficar negativa;
- a carteira curta pode manter resíduo e voltar a crescer depois da última parcela;
- a carteira total pode ser contaminada por esses saldos.

Consequência:

> Urbitá pode ser usado para conferir a sobreposição de recebimentos, mas não deve ser usado como referência para recorrência de carteira, juros do saldo ou fechamento final.

### 11.4 Critério de equivalência

Uma implementação é aderente quando reproduz os valores mensais dos cenários dentro da tolerância monetária definida e, simultaneamente:

- fecha valor contratado, descontos e principal;
- separa principal e juros;
- zera cada safra;
- zera a carteira total;
- não desloca vencimentos;
- não empilha excedentes no último mês;
- identifica a primeira divergência por linha e mês.

---

## Veja também

- [Padrão de Viabilidade — Incorporação](padrao-incorporacao) — a dinâmica funcional do app, com o contraste entre comportamento vigente e modelo de referência
- [Visão Geral](visao-geral) · [Modelo de Dados](modelo-de-dados) · [Fórmulas da Proforma](formulas) · [Benchmarks](benchmarks) · [Permissões](permissoes) · [Exportação](exportacao)
- `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência entre este documento e o código

---

*Padrão EVI · Inteligência de Mercado e Viabilidade Econômico-Financeira de Incorporação · Departamento de Novos Negócios*

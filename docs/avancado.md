---
titulo: Estudo Avançado
descricao: As páginas do estudo Avançado — Resumo, Empreendimento, Custos, Viabilidade, Funding, Resultados, Cenários, Análise de mercado e Apelo Comercial — e como o fluxo de caixa mensal é montado.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Estudo Avançado

> O estudo com dimensão de tempo: cronograma, vendas por safra, custos distribuídos por curvas, funding e um fluxo de caixa mensal que devolve TIR, VPL, payback e exposição máxima.

## O que é

No Avançado o resultado não sai de uma tabela estática: cada receita e cada custo é posicionado no
calendário do empreendimento, e o app soma tudo mês a mês. As vendas seguem uma curva de absorção e
um fluxo de pagamento (sinal, parcelas, resíduo nas chaves); os custos seguem curvas de distribuição
sobre as fases do cronograma; o funding entra e sai conforme as operações cadastradas. Do fluxo
mensal saem a Proforma do Avançado — a mesma hierarquia de linhas do Preliminar, para os dois níveis
se compararem — e a Análise Financeira.

O nível é escolhido na criação e não muda depois. As premissas estáticas do Preliminar não aparecem
aqui: o que existe é o que se descreve abaixo.

## Para usuários

As páginas ficam na lista lateral, nesta ordem. Cada uma abre em
`/viabilidade/detalhe/<id>/<pagina>/<subaba>`, e a sub-aba faz parte da URL.

### Resumo

Os KPIs do estudo, a **Composição dos custos**, o **Fluxo de Caixa Mensal**, o **Fluxo de Caixa
Acumulado** e os **Indicadores vs. benchmark** — a página de leitura do estudo.

### Empreendimento

| Sub-aba | O que se informa |
|---|---|
| **Informações** | Descrição do empreendimento, os dados do terreno (área e coeficientes mínimo e máximo), a imagem principal e os anexos. |
| **Cronograma** | A **Data de início do projeto** e as fases — Planejamento, Pré-lançamento (ligado pelo interruptor **Este empreendimento tem Pré-lançamento**), Lançamento, Obra e Pós-obras — com duração em meses, desenhadas no **Gantt do cronograma**. As fases são o calendário sobre o qual custos e vendas se distribuem. |
| **Tipologias** | O catálogo de unidades: nome, tipo de unidade (apartamento, cobertura, loja ou outro), área privativa, quantidade e vagas. Os preços ficam em Viabilidade → Receitas. |

### Custos

Cinco sub-abas, uma por grupo: **Terreno**, **Obras**, **Diretos**, **Indiretos** e **Financeiro**.
Cada linha de custo tem uma **categoria** — no Terreno, o preço e o registro; nas Obras, construção,
outorga, decoração, gestão da obra e contingência; nos Diretos, marketing e publicidade, corretagem
de vendas, projetos, licenças e aprovações e manutenção pós-obra (que já nasce ancorada no
evento Pós-obras: escolher a categoria substitui o início que a linha já tinha); nos Indiretos, marketing global, stand de vendas e
gestão; no Financeiro, juros de financiamento, taxas bancárias, estruturação de dívida e
investidores; e em todo grupo a categoria **Outro**. Só o Terreno tem a coluna **Subcategoria**:
para o preço, à vista, parcelado, permuta física ou permuta financeira; para Outro, o texto de
**Descreva…**. O orçamento é lançado na unidade escolhida (R$, R$/m² privativo, R$/m² de terreno, %
do VGV, % da receita, % da obra, % do recebido ou % da construção) e a **distribuição no tempo** diz o início (uma fase do
cronograma, ou **Customizado** para um mês), a duração e a forma — **Linear** ou uma **curva** do
catálogo do Painel (aba **Curvas**), que reparte o valor pelos meses. O preço do terreno pode, em
vez disso, acompanhar a receita das vendas: **Unit Delivery** o distribui na proporção da receita
que entra em caixa (sinal, parcelas e repasse) e **Sales Revenue** na proporção do VGV vendido pela
curva de absorção; três linhas não escolhem — a corretagem sai no mês da venda, a permuta física na
entrega das unidades e a permuta financeira conforme a receita entra. Cada sub-aba mostra o
consolidado do seu grupo; o **Avanço da obra** aparece junto do custo de construção, no grupo Obras.

As unidades em % diferem na base. **% da receita** é a receita líquida do RET, sem juros; **% do
recebido** é o que de fato entra em caixa, com os juros de tabela — oferecido no marketing, na
manutenção pós-obra, no marketing global, na gestão e no Outro dos custos diretos e indiretos. **% da obra** é o grupo Obras inteiro, outorga
e contingência inclusas; **% da construção** é só construção, decoração e gestão da obra — oferecido
em Projetos. As bases estão em [Fórmulas](formulas).

Três linhas são **semeadas**: ao abrir um estudo editável, a aba Custos cria o **Preço** no Terreno,
a **Construção** nas Obras e a **Corretagem de vendas** nos Diretos (em % do VGV) que ainda não
existirem no grupo. Cada uma é criada uma única vez por estudo, mesmo que o estudo seja aberto em
duas abas ao mesmo tempo. Depois de criadas são linhas comuns, que se editam como as outras; a que
for removida, ou tiver a categoria trocada, volta a ser semeada na abertura seguinte, porque a aba
recria a categoria que faltar no grupo. Uma segunda linha de Preço com subcategoria (a permuta
física ou financeira) continua sendo uma linha nova.

A **permuta física** aponta uma tipologia do catálogo e a quantidade entregue, e essas unidades
saem das que já estão **alocadas** em Viabilidade → Receitas — não se somam a elas. O saldo de uma
tipologia para alocar é o catálogo menos o alocado, e o catálogo não pode ser reduzido abaixo do
alocado nem abaixo da quantidade permutada. A quantidade permutada não pode passar do alocado: nem ao gravar a permuta, nem depois, ao
reduzir ou excluir uma alocação ou um grupo de Receitas. Com um catálogo de 200 unidades e 20
permutadas, alocam-se as 200 em Receitas: o VGV total conta as 200, o VGV da permuta física as 20 e
o VGV vendável as 180. Enquanto sobrar catálogo sem alocar, a reconciliação e a aba Tipologias
avisam a tipologia com unidades ainda não alocadas; permuta acima do alocado é erro na
reconciliação.

### Viabilidade

| Sub-aba | O que se informa |
|---|---|
| **Receitas** | A **absorção de vendas** — quanto do estoque se vende em cada mês, em percentual acumulado, a partir de uma curva que pode ser substituída — e o **fluxo de pagamento** de cada safra de vendas: **Sinal**, **Nº parcelas**, o que é pago **Ao longo da obra**, o **Desconto** e o **Resíduo sem prazo** (o saldo nas chaves: caixa imediato, o padrão, ou rolando para o repasse). |
| **Financeiro** | Os parâmetros financeiros do estudo: a **Taxa de desconto p/ VP** (usada no VPL; `0` é uma taxa válida e não desconta nada, de modo que o VPL iguala a soma do fluxo; estudo sem taxa gravada usa 12% a.a.) e os **Juros de tabela** padrão aplicados às parcelas. A alíquota de imposto aparece aqui só para leitura. |

A **Absorção de vendas** de cada Grupo distribui o percentual vendido em até quatro períodos que vêm
do Cronograma: **Pré-lançamento** (quando o estudo tem essa fase), **Lançamento**, **Durante a
obra** e **Pós-chaves** — este último é o que sobra para fechar 100% e é calculado sozinho. Cada
período espalha o seu percentual por igual pelos meses que tem. O Pós-chaves começa no mês seguinte
à entrega e dura o que o Grupo definir em **Janela Pós-chaves**, de 1 a 12 meses (12 é o padrão);
ele não depende da duração da fase Pós-obras do Cronograma, que é de custo. Uma janela curta
concentra as vendas das chaves em poucos meses. O atalho **À vista, mês único (1º mês das chaves)**
vende o Grupo inteiro no primeiro mês depois da entrega: ele zera os três primeiros períodos e põe
a janela em 1 mês. Com o plano de pagamento do Grupo já aplicado, toda venda feita depois da entrega
é recebida à vista, qualquer que seja o plano. Num Grupo com **Plano não migrado** o atalho fica
indisponível até o **Fluxo de Pagamento** ser aplicado, porque o plano antigo não recebe à vista a
venda posterior à entrega.

### Funding

As operações que financiam o projeto, cada uma independente das outras: **Dívida** (ou capital de
giro), **Equity** e **Financiamento à produção**. Dívida e Equity pedem nome, valor, o início (uma
fase do cronograma ou um mês específico) e a taxa ou o retorno — o Equity pode ser remunerado como
percentual do resultado final ou como permuta financeira sobre a receita líquida. O Financiamento à
produção não tem valor nem início digitados: a janela vem do Cronograma e o principal, da base
financiável; é a única operação com o interruptor **Ativo**. As regras de cada tipo estão em
[Funding](funding).

### Resultados

| Sub-aba | O que mostra |
|---|---|
| **Fluxo de Caixa** | Os KPIs do fluxo, a tabela mensal ou anual de todas as entradas e saídas (com as operações de funding dentro dela), a reconciliação com os avisos de consistência e a tabela da permuta física. Exporta em **CSV** e **PDF** na visão escolhida. |
| **Proforma** | A Proforma do Avançado: as séries mensais somadas na hierarquia de linhas do Preliminar, com os custos itemizados pelo nome dado em Custos e agrupados em blocos canônicos; a coluna R$ sai em inteiros. |
| **Análise Financeira** | O quadro **Fluxo de Caixa Livre × Fluxo de Caixa** e os gráficos **Contratação, Receita Bruta, Carteira e Repasse**, **Fluxo de Caixa** e **Fluxo de Caixa Acumulado**; **TIR a.a.**, **VPL** à taxa de desconto e **Payback** do projeto, calculados sobre o Fluxo de Caixa Livre (antes do funding); o **ROI do projeto**; e o **Retorno por parte** (o que cabe a cada operação de funding, com o **MOIC** de cada uma). |

A **carteira de clientes** é o saldo a receber das vendas já contratadas, somado safra a safra
(cada mês de venda decai isolado, com a sua taxa e o seu principal): ela sobe com as parcelas da
tabela e o saldo a repassar e zera no último vencimento de cada safra; o pico é a **carteira
máxima**. Quando o plano paga a 1ª parcela no próprio mês da venda, essa parcela já abate a
carteira daquele mês: os juros dela são reconhecidos nesse mês e só a amortização sai do saldo. O
que entra em caixa é o mesmo; a carteira e a carteira máxima desses planos já descontam essa
parcela.

A **reconciliação** confere o fluxo contra regras que o cálculo deve respeitar: a venda bruta
contratada recomposta linha a linha, mês a mês, com o mesmo arredondamento do fluxo; os
componentes de pagamento somando 100% em cada safra; a carteira de cada componente zerando no
último vencimento; e a carteira dos componentes que amortizam nunca voltando a crescer — o saldo a
repassar fica fora desta última, porque capitaliza até o repasse. Cada aviso aparece uma vez por
componente, na primeira safra em que acontece, e um aviso numa safra não esconde os das safras
seguintes.

### Comparar com a planilha EVI

Quem põe um estudo ao lado da planilha EVI Urbitá (aba **Incorp Individual**) encontra quatro
indicadores com definições diferentes das do app. Nenhum é defeito: o app usa as definições abaixo, e
a tabela traz o caminho para chegar ao número da planilha. A conversão do VPL e do Resultado está em
[Fórmulas da Proforma](formulas).

| Indicador | No app | Na planilha | Para comparar |
|---|---|---|---|
| **Resultado** | Desalavancado: não deduz os juros do financiamento à produção. A linha informativa **Serviço da dívida do funding** é o total das saídas de todas as operações de funding (principal, juros e retorno), não só os juros; o valor dos juros está no **Total de juros** do resumo do Financiamento à produção, na página Funding. | Deduz esses juros no Resultado. | Subtraia do Resultado do app o **Total de juros** do financiamento à produção. |
| **Exposição máxima** | O pior ponto do fluxo acumulado **livre** (desalavancado), em todo o período — inclusive nos meses anteriores ao lançamento. | O pior ponto do caixa **alavancado**, só nos meses a partir do lançamento. | Na tabela mensal da sub-aba Fluxo de Caixa, leia o menor valor da linha **Fluxo de Caixa Acumulado** (a última linha da tabela, depois do funding) a partir do mês do lançamento. Os KPIs e gráficos de fluxo livre não servem para esta comparação. |
| **VPL** | O início do planejamento é o mês de índice 0: o fluxo do mês de índice `i` é descontado `(1 + tm)^(i + 1)`. | A origem do tempo é o lançamento (mês 0). | Multiplique o VPL do app por `(1 + tm)^(n + 1)`, com `n` o número de meses entre o início do planejamento e o lançamento. A **TIR** não depende da origem. |
| **Séries mensais** | O VPL total e por linha, sem a série de FC descontado mês a mês. Não há um endividamento total consolidado de todas as operações de funding; para o financiamento à produção, o resumo da página Funding traz o **Pico do saldo devedor** e o mês em que ocorre. | **FC descontado** mês a mês e **Endividamento total**. | Para um estudo cuja única dívida é o financiamento à produção, leia o **Pico do saldo devedor** na página Funding; fora disso não há equivalente. |

Duas convenções do fluxo de recebíveis também diferem da versão mais recente da planilha, e o app
mantém as suas:

- **Juros do repasse.** O app capitaliza o saldo concentrado por `mês do pagamento − mês da venda`
  períodos: os juros começam no mês **seguinte** ao da venda. A planilha capitaliza um mês a mais, e já
  rende juros no próprio mês da venda. Um estudo com repasse a juros maior que zero recebe, no app,
  um mês de juros a menos do que na planilha.
- **Primeira parcela da tabela longa.** O app paga a primeira parcela no mês seguinte ao da venda; a
  planilha paga no mês da venda. O motor aceita a primeira parcela no mês da venda (`defasagemMeses`
  igual a `0` no componente de pagamento), que reproduz o valor e o mês do recebimento da planilha; a
  tela de Receitas não tem controle para isso. A carteira de clientes já abate essa parcela
  no mês da venda (ver acima).

### Cenários

Cenários simulados sobre o estudo real: dê um nome, altere os **parâmetros do cenário** e compare a
variação de TIR, VPL e exposição máxima contra o cenário real, com o gráfico **Fluxo acumulado —
cenário real × cenário simulado (R$ milhões)**. O eixo vertical do gráfico é fixo: ele cobre o
fluxo acumulado da base e o de todas as posições dos dois controles, então mover um controle move
a curva, não a escala, e a ordem de grandeza da variação fica visível. Os cenários ficam salvos no
estudo.

### Análise de mercado e Apelo Comercial

**Análise de mercado** compara os números do estudo com os do mercado da região monitorada —
**Projeto × mercado** (preço de venda e custo de obra por m², velocidade de vendas), **Sinais de
risco**, o que foi **Coletado sobre a região** e os **Indicadores macro** (IPCA, Selic, INCC e o
Focus); o lado "projeto" é derivado do próprio estudo (ver [Análise de Mercado](analise-mercado)). **Apelo Comercial** é a avaliação qualitativa do imóvel por
IA, a partir dos documentos anexados (ver [Apelo Comercial (IA)](apelo-comercial)).

## Instruções para não humanos

As rotas com `/estudos/:id/` exigem membro do estudo — ou `admin` do app; num estudo que ainda
não tem membros, qualquer usuário com nível `escrita` ou superior é aceito — e as de escrita seguem
a alçada do estudo (ver [Permissões e ciclo de vida](permissoes)). O catálogo de curvas é global: `GET` para qualquer
usuário do app, escrita e `semear` só para o `admin` do app.

| Recurso | Rotas |
|---|---|
| Cronograma e fases | `GET`/`PATCH /estudos/:id/avancado/cronograma` · `GET`/`POST /estudos/:id/avancado/fases` · `PATCH`/`DELETE /estudos/:id/avancado/fases/:fid` · alocações: `POST /estudos/:id/avancado/fases/:fid/alocacoes`, `PATCH`/`DELETE …/alocacoes/:aid` |
| Tipologias | `GET`/`POST /estudos/:id/avancado/tipologias` · `PATCH`/`DELETE /estudos/:id/avancado/tipologias/:tid` |
| Receitas | `GET /estudos/:id/avancado/receitas` |
| Custos | `GET`/`POST /estudos/:id/avancado/custos` · `PATCH`/`DELETE /estudos/:id/avancado/custos/:cid` |
| Parâmetros financeiros | `GET`/`PATCH /estudos/:id/avancado/parametros` |
| Funding | `GET`/`POST /estudos/:id/avancado/funding` · `PATCH`/`DELETE /estudos/:id/avancado/funding/:oid` |
| Cenários | `GET`/`POST /estudos/:id/avancado/cenarios` · `PATCH`/`DELETE /estudos/:id/avancado/cenarios/:cid` |
| Curvas (catálogo do app) | `GET`/`POST /avancado/curvas` · `PATCH`/`DELETE /avancado/curvas/:cid` · `POST /avancado/curvas/semear` |
| Anexos do empreendimento | `GET`/`POST /estudos/:id/empreendimento/documentos` · `DELETE …/documentos/:docId` |

O `POST /estudos/:id/avancado/custos` com `"semeadura": true` no corpo é idempotente para as três
linhas semeadas: com `categoria` `Preço` em `terreno`, `Construção` em `obra` ou `Corretagem de
vendas` em `diretos`, **sem** `subcategoria` (ausente, vazia ou só com espaços), e o estudo já tendo
uma linha assim, a rota devolve a existente (`200`, a de menor `id`) em vez de criar outra; a criação
de verdade responde `201`. É o que a aba Custos manda ao semear. Sem `"semeadura": true`, ou com
qualquer outra combinação — inclusive a mesma categoria com subcategoria —, a rota cria sempre.

O fluxo de caixa não é persistido: o cliente o calcula a partir desses dados, e a listagem do
Painel refaz o mesmo cálculo para mostrar VGV, resultado e margem de cada estudo Avançado.

## Veja também

- [Funding](funding) · [Fórmulas da Proforma](formulas) · [Exportação](exportacao)
- [Estudo Preliminar](preliminar) · [Análise de Mercado](analise-mercado) · [Modelo de Dados](modelo-de-dados)

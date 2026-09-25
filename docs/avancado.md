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
Cada linha de custo tem categoria e subcategoria — no Terreno, o preço (à vista ou parcelado), as
permutas física e financeira e o registro; nas Obras, construção, outorga, decoração, gestão da obra
e contingência; nos Diretos, marketing e publicidade, corretagem de vendas, projetos e licenças e
aprovações; nos Indiretos, marketing global, stand de vendas e gestão; no Financeiro, juros de
financiamento, taxas bancárias, estruturação de dívida e investidores; cada grupo aceita ainda a
categoria **Outro**, e só no Terreno a subcategoria é digitada (**Descreva…**). O orçamento é
lançado na unidade escolhida (R$, R$/m² privativo, R$/m² de terreno, % do VGV, % da receita ou % da
obra) e a **distribuição no tempo** diz o início (uma fase do cronograma, ou **Customizado** para um
mês), a duração e a forma — **Linear** ou uma **curva** do catálogo do Painel (aba **Curvas**), que
reparte o valor pelos meses. O preço do terreno pode, em vez disso, acompanhar a receita das vendas:
**Unit Delivery** o distribui na proporção da receita que entra em caixa (sinal, parcelas e repasse)
e **Sales Revenue** na proporção do VGV vendido pela curva de absorção; três linhas não escolhem — a
corretagem sai no mês da venda, a permuta física na entrega das unidades e a permuta financeira
conforme a receita entra. Cada sub-aba mostra o consolidado do seu grupo; o **Avanço da obra**
aparece junto do custo de construção, no grupo Obras.

### Viabilidade

| Sub-aba | O que se informa |
|---|---|
| **Receitas** | A **absorção de vendas** — quanto do estoque se vende em cada mês, em percentual acumulado, a partir de uma curva que pode ser substituída — e o **fluxo de pagamento** de cada safra de vendas: **Sinal**, **Nº parcelas**, o que é pago **Ao longo da obra**, o **Desconto** e o **Resíduo sem prazo** (o saldo nas chaves: caixa imediato, o padrão, ou rolando para o repasse). |
| **Financeiro** | Os parâmetros financeiros do estudo: a **Taxa de desconto p/ VP** (usada no VPL) e os **Juros de tabela** padrão aplicados às parcelas. A alíquota de imposto aparece aqui só para leitura. |

### Funding

As operações que financiam o projeto, cada uma independente das outras: **Dívida** (ou capital de
giro), **Equity** e **Financiamento à produção**. Para cada operação se informa nome, tipo, valor, o
início (uma fase do cronograma ou um mês específico), a taxa ou o retorno, e se está ativa. Equity
pode ser remunerado como percentual do resultado final ou como permuta financeira sobre a receita
líquida. As regras de cada tipo estão em [Funding](funding).

### Resultados

| Sub-aba | O que mostra |
|---|---|
| **Fluxo de Caixa** | Os KPIs do fluxo, a tabela mensal ou anual de todas as entradas e saídas (com as operações de funding dentro dela), a reconciliação com os avisos de consistência e a tabela da permuta física. Exporta em **CSV** e **PDF** na visão escolhida. |
| **Proforma** | A Proforma do Avançado: as séries mensais somadas na hierarquia de linhas do Preliminar, com os custos itemizados pelo nome dado em Custos e agrupados em blocos canônicos; a coluna R$ sai em inteiros. |
| **Análise Financeira** | O quadro **Fluxo de Caixa Livre × Fluxo de Caixa** e os gráficos **Contratação, Receita Bruta, Carteira e Repasse**, **Fluxo de Caixa** e **Fluxo de Caixa Acumulado**; **TIR a.a.**, **VPL** à taxa de desconto e **Payback** do projeto, calculados sobre o Fluxo de Caixa Livre (antes do funding); o **ROI do projeto**; e o **Retorno por parte** (o que cabe a cada operação de funding, com o **MOIC** de cada uma). |

### Cenários

Cenários simulados sobre o estudo real: dê um nome, altere os **parâmetros do cenário** e compare a
variação de TIR, VPL e exposição máxima contra o cenário real, com o gráfico **Fluxo acumulado —
cenário real × cenário simulado**. Os cenários ficam salvos no estudo.

### Análise de mercado e Apelo Comercial

**Análise de mercado** compara os números do estudo com os do mercado da região monitorada —
**Projeto × mercado** (preço de venda e custo de obra por m², velocidade de vendas), **Sinais de
risco**, o que foi **Coletado sobre a região** e os **Indicadores macro** (IPCA, Selic, INCC e o
Focus); o lado "projeto" é derivado do próprio estudo (ver [Análise de Mercado](analise-mercado)). **Apelo Comercial** é a avaliação qualitativa do imóvel por
IA, a partir dos documentos anexados (ver [Apelo Comercial (IA)](apelo-comercial)).

## Instruções para não humanos

As rotas com `/estudos/:id/` exigem membro do estudo, e as de escrita seguem a alçada do estudo
(ver [Permissões e ciclo de vida](permissoes)). O catálogo de curvas é global: `GET` para qualquer
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

O fluxo de caixa não é persistido: o cliente o calcula a partir desses dados, e a listagem do
Painel refaz o mesmo cálculo para mostrar VGV, resultado e margem de cada estudo Avançado.

## Veja também

- [Funding](funding) · [Fórmulas da Proforma](formulas) · [Exportação](exportacao)
- [Estudo Preliminar](preliminar) · [Análise de Mercado](analise-mercado) · [Modelo de Dados](modelo-de-dados)

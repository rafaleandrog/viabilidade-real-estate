---
titulo: Estudo Preliminar
descricao: As quatro abas do estudo Preliminar — Premissas, Resultado (Proforma e Cenários), Gráficos e Análise de Mercado — e o que cada campo alimenta.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Estudo Preliminar

> Análise estática: as premissas entram, a Proforma sai na hora. Sem cronograma, sem fluxo de caixa — é o estudo para decidir em minutos se um terreno merece o estudo Avançado.

## O que é

O estudo Preliminar calcula a Proforma diretamente das premissas: área do terreno e áreas vendáveis,
custos por m² ou por percentual do VGV, permutas, catálogo de produtos e preço de venda. Cada edição
recalcula os KPIs na hora. O que ele **não** tem é a dimensão do tempo: não há cronograma, curva de
vendas, funding nem TIR — isso é o [Estudo Avançado](avancado). O nível é escolhido na criação e
não muda depois — nem na cópia feita por **Duplicar**, que herda o nível; para levar um Preliminar
adiante, crie um estudo Avançado.

## Para usuários

O estudo abre em quatro abas: **Premissas**, **Resultado**, **Gráficos** e **Análise de Mercado**.
As Premissas são editáveis em Rascunho e Em análise por `editor` e `aprovador`. Num estudo
Aprovado ou Reprovado as quatro sub-abas de Premissas ficam em modo de leitura para todos; num
Arquivado a tela deixa digitar, mas só o `aprovador` consegue salvar (ver
[Permissões e ciclo de vida](permissoes)).

### Premissas

Quatro sub-abas, cada uma com os campos que valem para o tipo do estudo (Loteamento ou Incorporação):

| Sub-aba | O que se informa |
|---|---|
| **Terreno & Áreas** | A área do terreno vem do Núcleo ou do terreno manual, e a tabela de áreas é uma cascata. Na Incorporação, o seletor **Buscar lote** lista só os lotes elegíveis: os de parcelamento em regularização fundiária ou vinculado a um setor habitacional ficam de fora (se o Núcleo não responder por parcelamentos, um aviso diz que a lista não está filtrada). Em **Loteamento**: da **Área da Poligonal** menos a APP sai a **Área Parcelável**; dela saem ELUP/EPU, EPC e o sistema viário público até a **Área Líquida**; e desta saem o sistema viário privado, as áreas comuns privadas e as áreas verdes até a **Área Líquida de Venda (ALV)** — cada linha em m², ha, % da poligonal e % do parcelável. Em **Incorporação**: os **Coeficiente mínimo** e **Coeficiente máximo** de aproveitamento e a cascata que parte da **Área do Terreno**: as quatro áreas privativas (residencial e não residencial, fechada e aberta) somadas na **Área Privativa Total**, mais a **Área Comum Total**, até a **Área Construída Total**, com os KPIs de aproveitamento do coeficiente. |
| **Custos** | Três custos têm seletor de unidade — Infraestrutura em R$, R$/m² ou % do VGV; Construção em R$/m² ou R$ total; Projetos em % do VGV ou R$ fixo — e o app converte para a base da Proforma; os demais custos têm unidade fixa. Loteamento: infraestrutura, projetos, stand de vendas. Incorporação: construção, decoração, gestão da construção, incorporação e registro, valor venal do terreno (outorga). Comuns: custo do terreno, manutenção pós-obra, contingências, marketing global, gestão e outros indiretos, corretagem, marketing e o imposto — com a opção **Sujeito a RET**, que troca o imposto pela alíquota fixa do regime. Os interruptores **Considerar…** ligam ou desligam um custo sem apagar o valor. |
| **Permutas** | **Permuta física** (em m² ou em percentual da área de venda; residencial e não residencial na Incorporação) e **permuta financeira** (percentual do VGV ou valor). A física reduz a área que o incorporador vende; a financeira é dedução sobre a receita. |
| **Produtos** | O catálogo de tipologias: nome, tipo, área média, preço de venda e unidades. O VGV de cada produto aparece na linha, e o total alimenta a Proforma quando o catálogo existe. |

Na sub-aba Produtos, abaixo do catálogo, o card **Resumo** mostra os KPIs do tipo. No Loteamento:
**Área da gleba**, **Área vendável**, **Vendável / gleba** (contra o benchmark), **VGV**, **Nº de
lotes** e **Margem sobre VGV**. Na Incorporação: **Área privativa total**, **Área construída**,
**Nº de unidades**, **Preço médio/unid.**, **Custo obras / VGV** e **Margem sobre VGV** (os dois
últimos contra o benchmark). Abaixo deles, o preço sugerido por m² — o preço que faria o resultado
bater o piso definido no benchmark `resultado_final`. Tudo recalculado a cada edição.

### Resultado

Duas sub-abas.

**Proforma.** Acima da tabela, os cards **Área vendável**, **Nº de unidades**, **Custo obras / VGV**
e **Margem sobre VGV** — mais **Vendável / gleba** no Loteamento e **Área permutada** quando há
permuta física. A tabela, de cima para baixo: **Receita bruta (VGV)** (precedida de **VGV sem
permuta física** e das permutas quando há permuta física); **= Deduções sobre VGV**, que abre
imposto, corretagem, marketing e permuta financeira; **= Receita líquida**; **= Custo direto total**,
que abre os custos diretos; **= Receita operacional**; **= Custo indireto total**, que abre os
indiretos; e **= Resultado**. A primeira linha da receita (**VGV sem permuta física** quando há
permuta, **Receita bruta (VGV)** quando não há) e os três totais de grupo são cabeçalhos que
mostram ou escondem as linhas do grupo, e linha de grupo zerada não aparece. Cada linha traz R$, percentual do VGV e R$/m²; a coluna R$ sai em inteiros. O bloco
**Unidades e preço médio por tipo** resume o catálogo. Os botões **Exportar Excel** e **Exportar PDF** geram a mesma
tabela (ver [Exportação](exportacao)). As fórmulas de cada linha estão em [Fórmulas da Proforma](formulas).

**Cenários.** Três blocos que respondem "o que derruba este resultado?":

- **Alavancas do resultado** — o tornado: cada alavanca (**Preço de venda** — **Preço/m² de venda** no Loteamento —, **Permuta física**,
  **Permuta financeira**, **Custo de obra** ou **Custo de infraestrutura**, **Custo indireto**) é
  variada em ±5, ±10 ou ±15 % (o passo é escolhido no card) e ranqueada pela amplitude do impacto
  no resultado. A barra mais longa é a premissa que mais merece atenção. O custo do terreno não
  entra no tornado: ele tem o próprio cartão ao lado.
- **Margem de segurança** — quatro cartões. **Queda máxima de preço**, **Estouro máximo de obra**
  (**de infraestrutura**, no Loteamento) e **Permuta física máxima** dizem, em percentual sobre o
  valor atual, quanto a premissa pode errar até o resultado zerar; **Terreno máximo** sai em R$ e é
  o valor residual do terreno até a margem-alvo sobre a receita líquida.
- **Análise de sensibilidade** — a variável escolhida em **Bear**, **Base** e **Bull**, com as linhas
  afetadas lado a lado. As variações para cima e para baixo vêm do indicador de sensibilidade do
  benchmark daquela variável; sem benchmark, 10 %.

### Gráficos

Faixa de cinco KPIs com o denominador visível (VGV do incorporador, Resultado final, Margem sobre
VGV de tabela, Margem sobre receita líquida, Custo obras / VGV); a **cascata do resultado**, do VGV
ao resultado, barra a barra (os rótulos saem em R$ milhões, o valor exato fica no detalhe de cada
barra; num projeto deficitário o resultado é desenhado abaixo de uma linha do zero, e o rodapé diz a
escala); a **cadeia de áreas**, do terreno à área vendida, em barras proporcionais; e os indicadores
contra benchmark. Um aviso aparece quando o catálogo de produtos não fecha com as áreas informadas —
é informativo e não impede salvar.

### Análise de Mercado

A avaliação qualitativa do imóvel por IA, a partir dos documentos anexados ao estudo (anúncios,
dados de população, de mercado ou outros) e de um texto adicional: seis fatores pontuados, um
**Score geral** e um relatório. Ver [Apelo Comercial (IA)](apelo-comercial).

## Instruções para não humanos

O estudo Preliminar é um registro de `estudos` com `nivel_analise = 'preliminar'`; as premissas são
colunas desse registro e o catálogo de produtos é lido junto. As rotas são as gerais do app (ver a
seção correspondente em [Estudo de Viabilidade](readme)): `GET /estudos/:id` devolve o estudo com
`membros`, `imoveis` e `_permissao` (o catálogo vem por `GET /estudos/:id/preliminar/produtos`);
`PATCH /estudos/:id` grava premissas — campos exclusivos do Avançado são ignorados num
Preliminar, `tipo_empreendimento` só muda em Rascunho (`422 TIPO_TRAVADO`) e `nivel_analise` nunca
muda (`422 NIVEL_IMUTAVEL`). A Proforma não é persistida: o cliente a calcula com o mesmo motor da
tela, e o `GET /estudos` anexa `produtos` a cada estudo para a listagem calcular VGV, resultado e
margem do mesmo jeito.

## Veja também

- [Fórmulas da Proforma](formulas) · [Benchmarks](benchmarks) · [Exportação](exportacao)
- [Estudo Avançado](avancado) · [Apelo Comercial (IA)](apelo-comercial) · [Modelo de Dados](modelo-de-dados)

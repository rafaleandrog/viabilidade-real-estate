---
titulo: Estudo de Viabilidade
descricao: Estudos de viabilidade econômico-financeira de Loteamento e Incorporação — Proforma automática, fluxo de caixa mensal, cenários, benchmarks e análise de mercado por IA.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Estudo de Viabilidade

> Análise econômico-financeira de empreendimentos imobiliários (Loteamento e Incorporação), do estudo rápido de uma premissa ao fluxo de caixa mensal com funding.

## O que é

O app substitui as planilhas de viabilidade por estudos guardados na instância, calculados
automaticamente e compartilhados por membros com funções distintas. Um estudo parte de um terreno e
de um conjunto de premissas (áreas, custos, preços, permutas, produtos) e devolve uma **Proforma** —
a tabela de receitas, deduções, custos e resultado — com indicadores comparados a **benchmarks** da
empresa, cenários de sensibilidade e uma leitura do mercado local.

## Conceitos

| Conceito | O que significa |
|---|---|
| **Tipo de empreendimento** | **Loteamento** (venda de lotes de uma gleba) ou **Incorporação** (venda de unidades construídas sobre um ou mais lotes). Define quais premissas, custos e indicadores aparecem. Só muda enquanto o estudo está em Rascunho. |
| **Nível de análise** | **Preliminar**: análise estática, sem dimensão temporal — a Proforma sai das premissas na hora. **Avançado**: cronograma, vendas por safra, custos distribuídos no tempo, funding e fluxo de caixa mensal, com TIR, VPL, payback e exposição máxima. Escolhido na criação e imutável depois. |
| **Terreno** | Vem do **Núcleo** da instância (uma gleba para Loteamento; um ou mais lotes para Incorporação, com a área somada) ou é **inserido manualmente** (nome e área digitados). A origem se escolhe na criação e o vínculo só muda em Rascunho. |
| **Proforma** | A tabela de resultado do estudo: VGV, deduções da receita, custos diretos e indiretos, resultado e indicadores (margem, ROI, custo de obras sobre VGV). Ver [Fórmulas da Proforma](formulas). |
| **Benchmark** | Valores de referência por tipo de empreendimento, mantidos pelo administrador: validam os indicadores (verde ou vermelho) e dão as faixas padrão dos cenários. Ver [Benchmarks](benchmarks). |
| **Membro e função** | Cada estudo tem os próprios membros. `leitor` vê e exporta; `editor` cria e edita; `aprovador` aprova, reprova e devolve. Ver [Permissões e ciclo de vida](permissoes). |

## Para usuários

### O Painel

A tela inicial tem cinco abas: **Estudos**, **Terrenos**, **Benchmark**, **Curvas** e **Regiões
monitoradas**. A aba **Estudos** lista os estudos aos quais você tem acesso, com filtros por tipo e
status e as colunas Nome, Status, Nível, Área do terreno, Área líquida de venda, VGV e Margem. Na
linha de cada estudo ficam as ações que a sua função permite: abrir, renomear, duplicar, remover e
os botões de transição de status. A aba **Terrenos** mostra os imóveis do Núcleo disponíveis para
vincular. As outras três são telas de configuração: **Benchmark** ([Benchmarks](benchmarks)), **Curvas**
(curvas de distribuição de custos no tempo, usadas pelo estudo Avançado) e **Regiões monitoradas**
([Análise de Mercado](analise-mercado)).

### Criar um estudo

1. Em **Estudos**, clique em **Criar estudo**.
2. Informe o nome, a UF, o **tipo de empreendimento** e o **nível de análise**. O nível não muda
   depois; o tipo só muda em Rascunho.
3. Escolha a origem do terreno: **Buscar terreno** (Núcleo) ou **Inserir novo** (manual). Se a
   instância ainda não liberou o Núcleo para o app, o modo Núcleo avisa e o manual continua
   disponível.
4. O estudo nasce em **Rascunho**, com você como `editor`.

O estudo recebe um identificador legível e estável, composto pela sigla do tipo, a UF e uma
sequência. Renomear o estudo não altera esse identificador.

### Estudo Preliminar

Quatro abas. Em **Premissas** você preenche, em sub-abas, **Terreno & Áreas**, **Custos**,
**Permutas** e **Produtos** (o catálogo de tipologias com preço), e vê os KPIs e o preço sugerido
por m² recalculados a cada edição. Em **Resultado** ficam a **Proforma** completa e a aba
**Cenários** — o tornado de alavancas, a margem de segurança e a sensibilidade Bear, Base e Bull —
com exportação para PDF e Excel. **Gráficos** traz a faixa de KPIs, a cascata do resultado, a
cadeia de áreas e os indicadores contra benchmark. **Análise de Mercado** é a avaliação qualitativa
do imóvel por IA, a partir de documentos anexados.

### Estudo Avançado

Páginas na lista lateral, nesta ordem: **Resumo**, **Empreendimento** (cronograma, tipologias,
receitas e absorção, terreno), **Custos** (orçamento distribuído no tempo por curvas), **Viabilidade**
(parâmetros financeiros), **Funding** (dívida, equity e financiamento à produção), **Resultados**
(Fluxo de Caixa, Proforma e Análise Financeira), **Cenários**, **Análise de mercado** (os números do
estudo contra os do mercado) e **Apelo Comercial** (a avaliação por IA). Ver
[Funding](funding) e [Análise de Mercado](analise-mercado).

### Endereço das telas

Cada estudo abre em `/viabilidade/detalhe/<id>/<pagina>`; as sub-abas não entram na URL, então
um link direto ou um refresh volta à sub-aba padrão daquela página.

### Ciclo de vida

`Rascunho → Em análise → Aprovado | Reprovado`. O `editor` envia para análise; o `aprovador` aprova,
reprova ou devolve ao Rascunho. Estudos parados (exceto os Aprovados) são arquivados
automaticamente depois do prazo configurado pelo administrador; o `aprovador` pode reabrir um
Arquivado. Aprovado é estado final. Detalhe em [Permissões e ciclo de vida](permissoes).

### Exportar

A Proforma sai em PDF e Excel a partir da própria aba, no Preliminar e no Avançado; o fluxo de
caixa do Avançado também. Ver [Exportação](exportacao).

## Para administradores

Antes do primeiro estudo: conceda ao app a leitura de **imóveis** e **parcelamentos** do Núcleo em
*Admin → Apps → viabilidade → Núcleo* (sem isso, só o terreno manual funciona); crie os
**benchmarks** de cada tipo de empreendimento; revise os **parâmetros** do app (alíquotas e
percentuais padrão, prazo de arquivamento, limite da coleta de mercado) em *Admin → Apps →
viabilidade*; e, se for usar a análise de mercado, cadastre as **regiões monitoradas**
na aba do Painel. Ver [Benchmarks](benchmarks) e [Análise de Mercado](analise-mercado).

## Instruções para não humanos

Rotas relativas; a instância as expõe sob `/api/viabilidade/`. A permissão é por estudo: quem não
é membro (nem `admin` do app) recebe `403`, e um `leitor` não vê estudos em Rascunho ou Arquivado.

| Recurso | Rotas |
|---|---|
| Estudos | `GET /estudos` · `POST /estudos` · `GET /estudos/:id` · `PATCH /estudos/:id` · `DELETE /estudos/:id` · `POST /estudos/:id/duplicar` · `POST /estudos/:id/status` |
| Membros | `GET /estudos/:id/membros` · `POST /estudos/:id/membros` · `PATCH /estudos/:id/membros/:usuarioId` · `PATCH /estudos/:id/membros/:usuarioId/remover` |
| Terreno (Núcleo) | `GET /estudos/:id/imoveis` · `POST /estudos/:id/imoveis` · `DELETE /estudos/:id/imoveis/:vinculoId` |
| Apelo comercial | `GET`/`POST /estudos/:id/apelo-comercial` · `POST /estudos/:id/apelo-comercial/documentos` · `DELETE …/documentos/:docId` |
| Análise de mercado | `GET`/`POST /estudos/:id/analise-mercado` · `PATCH /estudos/:id/analise-mercado/regiao` · `GET`/`POST /mercado/regioes` · `PATCH`/`DELETE /mercado/regioes/:rid` · `GET /mercado/regioes/:rid/coletas` |
| Benchmarks | `GET /benchmarks` · `POST`/`PATCH`/`DELETE /benchmarks` · `POST /benchmarks/semear` |
| Configuração e manutenção | `GET /config` · `POST /manutencao/arquivar-inativos` |

As páginas do estudo Avançado têm as próprias rotas, descritas em [Funding](funding) e em
[Análise de Mercado](analise-mercado). As transições de status são validadas no servidor: uma transição inválida
responde `422 TRANSICAO_INVALIDA`, e uma sem alçada `403 SEM_PERMISSAO`.

O app publica três eventos no barramento da instância: `estudo_criado`, `estudo_status_alterado` e
`apelo_comercial_concluido`. Os membros do estudo são inscritos automaticamente.

## Veja também

- Regras: [Fórmulas da Proforma](formulas) · [Funding](funding) · [Benchmarks](benchmarks) · [Permissões e ciclo de vida](permissoes)
- Mercado: [Análise de Mercado](analise-mercado) · [Apelo Comercial (IA)](apelo-comercial)
- Dados: [Modelo de Dados](modelo-de-dados) · [Exportação](exportacao)

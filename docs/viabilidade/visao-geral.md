---
titulo: Estudo de Viabilidade — Visão Geral
descricao: Propósito, escopo e fluxo do app de análise de viabilidade imobiliária.
tipo: app
ordem: 1
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Estudo de Viabilidade — Visão Geral

> Análise econômico-financeira de empreendimentos imobiliários (Loteamento e Incorporação).

## O que é

App do UrbiVerso que substitui planilhas dispersas por uma aplicação centralizada: cria estudos de viabilidade, calcula automaticamente uma **Proforma** com indicadores financeiros, compara cenários, roda análise de sensibilidade e avalia o **apelo comercial** do imóvel com IA.

**Tipos de empreendimento:** Loteamento e Incorporação. **Níveis de análise:** **Preliminar** (indicadores estáticos, sem dimensão temporal) e **Avançado** (fluxo de caixa mensal, TIR, VPL, payback e exposição), este último com páginas próprias descritas abaixo.

## Para usuários

- **Dashboard** — tabela de estudos (filtros por tipo e status), com criar, duplicar e remover. Aba **Terrenos** lista imóveis (via Núcleo, quando disponível).
  - **VGV / Resultado / Margem na listagem** (#406/#407) — Preliminar lê os campos fixos do estudo (motor `proforma.ts`), incluindo o catálogo de Produtos quando presente (#315/#407: `GET /estudos` devolve `produtos`, senão o guard `vgv > 0` mostrava "—" mesmo com o catálogo preenchido). **Avançado não tem campos fixos** — a listagem calcula sob demanda no cliente, por linha, reproduzindo exatamente a sub-aba **Proforma** de Resultados (`proformaAvancado`, com o funding do Capital Stack incluído quando há camada ativa) — não a aba Resumo, que usa outra base (VGV potencial com permuta física, resultado de caixa em vez de econômico). Cada linha Avançada mostra "…" até o próprio cálculo terminar; "—" é só para estudo sem receita modelada. Decisão deliberada de **não** agregar isso no backend, para preservar o contrato de que as fórmulas rodam no frontend.
- **Detalhe do estudo** — quatro abas:
  - **Premissas** — formulário de entrada + KPIs ao vivo + Preço Sugerido/m².
  - **Proforma** — tabela linha a linha, comparação de cenários e análise de sensibilidade; exportação PDF/Excel.
  - **Gráficos** — composição de custos (pizza) e Receita × Custos (barras).
  - **Apelo Comercial** — análise qualitativa por IA (6 fatores) a partir de documentos anexados.
- **Estudo Avançado** — páginas próprias: Resumo, Empreendimento, Viabilidade, Custos, Fluxo de Caixa, Cenários, **Análise de mercado** e **Apelo Comercial**.
  - **Análise de mercado** (#199) — compara os números do estudo com os do mercado (preço e custo por m², velocidade de vendas, macros). O lado "projeto" é derivado do próprio estudo, não digitado. Ver [Análise de Mercado](analise-mercado).
  - **Viabilidade → Financeiro** — hoje a aba do **Bloco G**, cujos ~25 campos são persistidos e renderizados mas **não alimentam o motor**. A epic **#239** a transforma no módulo **Capital Stack** (funding, dívida, equity e waterfall); ver [Funding, Capital Stack e Retorno do Capital](funding-capital-stack). `Custos → Financeiro` é outra coisa: permanece grupo de **custos** operacionais.

## Endereços das telas

**Comportamento vigente:** a URL é `/detalhe/:id/:pagina` (`frontend/index.ts` → `parsearSubRota`).
As **subabas** — Cronograma, Tipologias, Receitas, Terreno, Obras e as demais — vivem apenas no
estado do componente e **não participam do histórico do navegador**: abrir um link direto ou dar
refresh volta à subaba padrão. O slug da página de Custos ainda é o legado `/obra` (a #40 renomeou o
rótulo e preservou o id).

**Evolução dependente de issue:** a gramática passa a `/detalhe/:id/:pagina/:subaba` — por exemplo
`/detalhe/11/empreendimento/cronograma` —, com deep link, refresh e back/forward preservando a
subaba, e as URLs antigas continuando válidas como alias da subaba padrão (**#251**). No mesmo
movimento, `/custos` vira o slug público e `/obra` permanece como alias legado (**#250**). Nenhuma
das duas altera identificador interno de domínio nem o `manifesto.json`.

## Origem do terreno

Na criação, escolhe-se **Buscar terreno** (Núcleo) ou **Inserir novo** (manual, nome + área digitados).

No modo **Núcleo**, o estudo referencia imóveis do Núcleo compartilhado — **1 gleba** para Loteamento, **1 ou mais lotes** para Incorporação — e o app consome a **área** desses imóveis (somada) como área do terreno da Proforma. A seleção é feita na aba Premissas e só é editável em Rascunho. O acesso ao Núcleo é declarado no manifesto (`dependencias_nucleo: ["imoveis"]`, `permissoes_nucleo: { "imoveis": ["ler"] }`) e precisa ser **autorizado pelo admin da instância** em *Admin → Apps → viabilidade → Núcleo*. Enquanto a permissão não for concedida (ou a instância não expuser glebas/lotes), o modo Núcleo degrada com um aviso e o modo **manual** continua disponível.

## Ciclo de vida

`Rascunho → Em análise → Aprovado | Reprovado`, com devolução ao Rascunho e reabertura de Arquivado pelo aprovador. Estudos parados (exceto Aprovado) por 30 dias são arquivados automaticamente.

## Veja também

- [Modelo de dados](modelo-de-dados) · [Fórmulas](formulas) · [Benchmarks](benchmarks) · [Apelo Comercial](apelo-comercial) · [Análise de Mercado](analise-mercado) · [Permissões](permissoes) · [Exportação](exportacao)
- Incorporação: [Padrão de Viabilidade](padrao-incorporacao) (dinâmica funcional do app) · [Inteligência EVI](inteligencia-evi-incorporacao) (significado econômico de negócio)
  - Os dois são **consultivos**. O modelo de recebíveis por **safras** que eles descrevem — safra, componentes de pagamento, primeiro vencimento em `s + 1`, PMT, carteira e repasse — é **modelo funcional de referência, ainda não implementado**; depende das issues da Rodada 5. Ver `docs/revisao-recebiveis-calliandra-2026-07-31.md`.

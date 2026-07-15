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

**Tipos de empreendimento:** Loteamento e Incorporação. **Nível de análise (MVP):** Estudo Preliminar (indicadores estáticos, sem dimensão temporal). Projeto Avançado (fluxo de caixa, TIR, VPL) é v2.

## Para usuários

- **Dashboard** — tabela de estudos (filtros por tipo e status), com criar, duplicar e remover. Aba **Terrenos** lista imóveis (via Núcleo, quando disponível).
- **Detalhe do estudo** — quatro abas:
  - **Premissas** — formulário de entrada + KPIs ao vivo + Preço Sugerido/m².
  - **Proforma** — tabela linha a linha, comparação de cenários e análise de sensibilidade; exportação PDF/Excel.
  - **Gráficos** — composição de custos (pizza) e Receita × Custos (barras).
  - **Apelo Comercial** — análise qualitativa por IA (6 fatores) a partir de documentos anexados.

## Origem do terreno

Na criação, escolhe-se **Buscar terreno** (Núcleo) ou **Inserir novo** (manual, nome + área digitados).

No modo **Núcleo**, o estudo referencia imóveis do Núcleo compartilhado — **1 gleba** para Loteamento, **1 ou mais lotes** para Incorporação — e o app consome a **área** desses imóveis (somada) como área do terreno da Proforma. A seleção é feita na aba Premissas e só é editável em Rascunho. O acesso ao Núcleo é declarado no manifesto (`dependencias_nucleo: ["imoveis"]`, `permissoes_nucleo: { "imoveis": ["ler"] }`) e precisa ser **autorizado pelo admin da instância** em *Admin → Apps → viabilidade → Núcleo*. Enquanto a permissão não for concedida (ou a instância não expuser glebas/lotes), o modo Núcleo degrada com um aviso e o modo **manual** continua disponível.

## Ciclo de vida

`Rascunho → Em análise → Aprovado | Reprovado`, com devolução ao Rascunho e reabertura de Arquivado pelo aprovador. Estudos parados (exceto Aprovado) por 30 dias são arquivados automaticamente.

## Veja também

- [Modelo de dados](modelo-de-dados) · [Fórmulas](formulas) · [Benchmarks](benchmarks) · [Apelo Comercial](apelo-comercial) · [Permissões](permissoes) · [Exportação](exportacao)

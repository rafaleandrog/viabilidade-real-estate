---
titulo: Apelo Comercial (IA)
descricao: Análise qualitativa do imóvel por IA — 6 fatores, scoring e relatório.
tipo: app
ordem: 5
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Apelo Comercial do Imóvel (IA)

Usa o framework de IA do UrbiVerso (`req.ia`) para avaliar fatores qualitativos que as fórmulas financeiras não capturam.

## Como funciona

1. Na aba **Apelo Comercial**, o editor anexa **documentos** (PDF, Word, Excel) e/ou **texto** (ex.: população do município/bairro), marcando o `tipo_dado` (anúncios, população, mercado…).
2. Clica em **“Analisar com IA”**. O backend extrai o conteúdo dos arquivos (`req.ia.extrairConteudo`) e consulta o modelo (`req.ia.consultar`) com um schema JSON estruturado.
3. O resultado é salvo em `apelo_comercial` e o evento `apelo_comercial_concluido` é publicado (editores e aprovadores são inscritos).

## Fatores (MVP)

Seis fatores, cada um com 4 perguntas-guia: **Localização**, **Infraestrutura no Entorno**, **Vetor de Crescimento**, **Concorrência**, **Demanda Estrutural** e **Segurança Jurídica e Regulatória**.

A IA atribui **nota de 1 a 5** por pergunta (5 = mais favorável), com justificativa. Dados insuficientes → nota nula. A avaliação é comparativa e contextual, sem critérios numéricos rígidos.

## Scoring

- **Score por fator** = média das 4 notas → colunas `score_localizacao`, `score_infraestrutura`, etc.
- **Score geral** = média de todas as notas válidas → `score_geral`.

## Saída

Além das notas, um **relatório** com vantagens, desvantagens, ganhos e riscos de prosseguir.

## Limites (MVP)

Apenas uploads e texto — **sem busca na web** e **sem URLs** (v2). O framework de IA precisa estar habilitado para a app na instância; caso contrário a análise responde `IA_INDISPONIVEL`.

## API

`GET /estudos/:id/apelo-comercial` · `POST /estudos/:id/apelo-comercial/documentos` · `DELETE …/documentos/:docId` · `POST /estudos/:id/apelo-comercial` (dispara a IA). Requerem função de editor no estudo.

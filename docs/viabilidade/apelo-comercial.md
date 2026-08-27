---
titulo: Análise de Mercado do Imóvel (IA)
descricao: Análise qualitativa do imóvel por IA — 6 fatores, scoring e relatório.
tipo: app
ordem: 5
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Análise de Mercado do Imóvel (IA)

> BUG7-13: rótulo renomeado só no **Preliminar** (D2) — o Avançado mantém a aba
> "Apelo Comercial", pois já tem uma aba homônima "Análise de mercado" (coleta
> regional, `mercado_regioes`), e as duas juntas ficariam ambíguas. É a mesma
> funcionalidade nos dois níveis: slug `apelo`, elemento `viab-tela-apelo`,
> evento `apelo_comercial_concluido` e as tabelas `apelo_comercial*` continuam
> intactos — só o texto do card muda por nível.

Usa o framework de IA do UrbiVerso (`req.ia`) para avaliar fatores qualitativos que as fórmulas financeiras não capturam.

## Como funciona

1. Na aba **Análise de Mercado** (Preliminar) ou **Apelo Comercial** (Avançado), o editor anexa **documentos** (PDF, Word, Excel) e/ou **texto** (ex.: população do município/bairro), marcando o `tipo_dado` (anúncios, população, mercado…).
2. Clica em **“Analisar com IA”**. O backend extrai o conteúdo dos arquivos (`req.ia.extrairConteudo`) e consulta o modelo (`req.ia.consultar`) com um schema JSON estruturado.
3. O resultado é salvo em `apelo_comercial` e o evento `apelo_comercial_concluido` é publicado (editores e aprovadores são inscritos).

## Contexto do empreendimento

Antes das fontes anexadas, o prompt inclui um bloco descritivo do empreendimento — localidade,
tipo, unidades, área média por unidade e preço de venda praticado — para ajudar o modelo a
dimensionar o que está avaliando. Não é cálculo de viabilidade, só contexto best-effort.

- **Localidade**: região monitorada (`mercado_regioes`) se o estudo tiver uma vinculada, senão a
  UF do estudo (BUG7-15 — é a causa dominante do diagnóstico: os 6 fatores são todos geográficos).
- **Unidades / área média / preço de venda**: derivados do catálogo **efetivo** de Produtos
  (`preliminar_produtos`) — a mesma regra `produtoCompoeCatalogo`/`catalogoEfetivo` que
  `calcularProforma` usa para o VGV (`frontend/proforma.ts`). Uma linha só entra se tiver área,
  preço **e** unidades preenchidos; a agregação usa `resumoCatalogoProdutos` (mesmo arquivo):
  unidades é soma simples, área média é ponderada por unidades, e preço/m² é ponderado pela área
  total de cada linha — as duas ponderações são consistentes entre si (área média × preço × unidades
  reproduz o VGV total do catálogo efetivo). Estudo sem catálogo efetivo (ou catálogo com só linhas
  em branco) omite as três linhas do prompt — nunca mostra zero como se fosse um dado real.
  > ⚠️ Até a #588 esses três campos vinham de colunas legadas de `estudos`
  > (`area_media_lote_m2`, `num_unidades*`, `preco_venda_m2*`) — sem UI desde a #315 e que
  > `calcularProforma` já não lê desde a #563. Um estudo novo herdava contexto `null` silencioso;
  > um estudo antigo com o catálogo editado mandava para a IA um preço/área que não batia com a
  > Proforma. `backend/rotas/apelo-comercial.ts` importa a agregação diretamente de
  > `frontend/proforma.ts` (funções puras, sem DOM) em vez de espelhar a regra — fonte única entre
  > o contexto da IA e a Proforma.

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

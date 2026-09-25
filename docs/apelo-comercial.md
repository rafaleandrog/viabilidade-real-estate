---
titulo: Apelo Comercial (IA)
descricao: A avaliação qualitativa do imóvel por IA — seis fatores pontuados de 1 a 5 a partir dos documentos e do texto anexados ao estudo, um score geral e um relatório.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Apelo Comercial (IA)

> O que as fórmulas não capturam: localização, infraestrutura, vetor de crescimento, concorrência, demanda e segurança jurídica, avaliados pela IA sobre as fontes que você anexa.

## O que é

O Apelo Comercial usa o framework de IA do UrbiVerso para pontuar o ativo em seis fatores
qualitativos, a partir de documentos e texto anexados ao estudo. É a mesma funcionalidade nos
dois níveis, com nomes diferentes na tela: no Preliminar é a aba **Análise de Mercado**; no
Avançado é a página **Apelo Comercial**, porque lá existe outra página chamada Análise de mercado,
a comparação numérica com o mercado da região (ver [Análise de Mercado](analise-mercado)).

## Para usuários

1. Na aba, anexe as fontes: um **Arquivo** (PDF, Word, Excel) com o **Tipo de fonte** (Anúncios,
   População, Mercado ou Outro) e, se quiser, um **Texto adicional** (a população do município ou
   do bairro, por exemplo).
2. Clique em **Analisar com IA**. O servidor extrai o conteúdo dos arquivos, monta o prompt e
   consulta o modelo com um esquema de resposta estruturado.
3. O card **Resultado** mostra o **Score geral**, o score de cada fator e o relatório; o evento
   `apelo_comercial_concluido` é publicado para os membros do estudo.

**Contexto do empreendimento.** Antes das fontes, o prompt inclui um bloco com a localidade, o
tipo de empreendimento, o número de unidades, a área média por unidade e o preço de venda
praticado, para o modelo dimensionar o que avalia. A localidade é a região monitorada vinculada ao
estudo, ou a UF quando não há vínculo. Unidades, área média e preço vêm do catálogo efetivo de
Produtos, pela mesma agregação que a Proforma usa para o VGV (área média ponderada por unidades,
preço por m² ponderado pela área); estudo sem catálogo efetivo omite as três linhas do prompt em
vez de mandar zero.

**Os seis fatores**, cada um com quatro perguntas-guia: **Localização**, **Infraestrutura no
Entorno**, **Vetor de Crescimento**, **Concorrência**, **Demanda Estrutural** e **Segurança
Jurídica e Regulatória**. A IA dá nota de 1 a 5 por pergunta (5 é o mais favorável), com
justificativa; sem dado suficiente a nota fica nula. A avaliação é comparativa e contextual, sem
critério numérico rígido.

**Scores.** O score de cada fator é a média das quatro notas; o **Score geral** é a média de todas
as notas válidas. O relatório traz vantagens, desvantagens, ganhos e riscos de prosseguir.

**Limites.** Só o que for anexado entra: a IA não navega na web nem abre URLs. O framework de IA
precisa estar habilitado para o app na instância; caso contrário a análise responde
`IA_INDISPONIVEL`.

## Instruções para não humanos

| Rota | O que faz |
|---|---|
| `GET /estudos/:id/apelo-comercial` | o resultado, os documentos anexados e a lista de fatores |
| `POST /estudos/:id/apelo-comercial/documentos` · `DELETE …/documentos/:docId` | anexa e remove fontes |
| `POST /estudos/:id/apelo-comercial` | dispara a IA; `422 IA_INDISPONIVEL` sem o framework |

Escrever exige a função de `editor` no estudo. O resultado fica em `apelo_comercial` (`resultado`
JSON, `score_localizacao`, `score_infraestrutura`, `score_vetor_crescimento`, `score_concorrencia`,
`score_demanda`, `score_seguranca_juridica`, `score_geral`); as fontes, em
`apelo_comercial_documentos`.

## Veja também

- [Análise de Mercado](analise-mercado) · [Estudo Preliminar](preliminar) · [Estudo Avançado](avancado)
- [Modelo de Dados](modelo-de-dados) · [Permissões e ciclo de vida](permissoes)

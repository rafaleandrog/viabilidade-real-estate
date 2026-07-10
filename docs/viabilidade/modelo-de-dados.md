---
titulo: Modelo de Dados
descricao: Tabelas, relações e regras de precisão do app de viabilidade.
tipo: app
ordem: 2
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Modelo de Dados

Todas as tabelas usam `acesso_externo: "restrito"` — a escrita passa pelas rotas customizadas (regras de negócio e permissão por estudo).

## Tabelas

| Tabela | Papel |
|---|---|
| `estudos` | Registro central (`soft_delete`). Identidade (`id_legivel`, `nome_exibicao`, `sequencia` por tipo), status, origem do terreno, e todos os campos de premissas (produto, áreas, custos, impostos, permutas). |
| `estudo_imoveis` | Junção N:M com imóveis do Núcleo (`imovel_nucleo_id` como referência lógica; `tipo_imovel` gleba/lote). Único `[estudo_id, imovel_nucleo_id]`. |
| `estudo_membros` | Permissão por estudo (`funcao` leitor/editor/aprovador). Único `[estudo_id, usuario_id]`. |
| `benchmarks` | Valores de referência por tipo de empreendimento. Único `[tipo_empreendimento, campo]`. |
| `apelo_comercial` | Resultado da IA (`resultado` JSON + 6 scores por fator + `score_geral`). |
| `apelo_comercial_documentos` | Fontes anexadas (`documento` arquivo, `tipo_dado`, `texto_adicional`). |

## Regras de precisão

- Monetários (R$) e áreas (m²): `decimal(12,2)`.
- Percentuais de entrada: `decimal(5,2)` (comporta defaults fracionários como 6,73% / 1,6% / 0,25%).
- Scores do apelo: `decimal(3,1)`.

## id_legivel

Template `{SIGLA} - {nome} - {UF} - {sequência}` (ex.: `INC - Pátio Urbitá 1 - DF - 002`). Na base, sem espaços/acentos: `inc_patiourbita1_df_002`. A sequência incrementa por `tipo_empreendimento`.

## Núcleo

O app consome apenas a **área** (e nome) do imóvel. Coeficientes, áreas dedutíveis e demais parâmetros são inputs do estudo. Ver [Visão Geral](visao-geral) para a origem manual vs. Núcleo.

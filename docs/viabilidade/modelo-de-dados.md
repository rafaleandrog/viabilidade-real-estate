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
| `estudos` | Registro central (`soft_delete`). Identidade (`id_legivel`, `nome_exibicao`, `sequencia` por tipo), status, origem do terreno, área do terreno (`terreno_manual_area` quando manual; `area_terreno_nucleo` = soma das áreas dos imóveis do Núcleo), e todos os campos de premissas (produto, áreas, custos, impostos, permutas). |
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

O app declara `dependencias_nucleo: ["imoveis"]` e `permissoes_nucleo: { "imoveis": ["ler"] }` no manifesto — só leitura de glebas/lotes (o supertipo `imoveis` cobre ambos os subtipos). O consumo segue o contrato padrão do Núcleo (`docs/shell/nucleo.md`): o shell provê as rotas `/api/viabilidade/nucleo/*` e o frontend chama via `urbiVerso.nucleo('/glebas' | '/lotes' | '/imoveis/:id')`. O gate real (por entidade/flag) é ligado pelo admin da instância; sem isso, os endpoints retornam 403 e a UI degrada com aviso (sem quebrar).

O app consome apenas a **área** (e o `id_legivel` para exibição) do imóvel. Ao vincular/desvincular imóveis (só em Rascunho, via `estudo_imoveis`), a área somada é persistida em `estudos.area_terreno_nucleo` para a Proforma calcular sobre o objeto estudo em todas as telas. Coeficientes, áreas dedutíveis e demais parâmetros continuam inputs do estudo. Ver [Visão Geral](visao-geral) para origem manual vs. Núcleo.

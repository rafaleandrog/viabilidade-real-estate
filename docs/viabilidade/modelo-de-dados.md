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
| `estudo_documentos` | Anexos do Empreendimento (imagem principal, renders, plantas). |

### Avançado — fluxo de caixa (nível `avancado`)

| Tabela | Papel |
|---|---|
| `avancado_cronograma` | 5 eventos por estudo (planejamento, pré-lançamento, lançamento, obra, pós-obra) com `inicio_mes` 0-based e `duracao_meses`. Único `[estudo_id, evento]`. |
| `avancado_curvas` | Curvas de distribuição globais da instância (Curva S padrão + customizadas). |
| `avancado_tipologias` | **Catálogo de tipologias do estudo** (Lote 6 · #19) — nome, tipo, área privativa, dormitórios, vagas, `quantidade` (total de unidades), `unidades_permutadas`. Cadastrado em Empreendimento → Tipologias, **desacoplado** da receita. |
| `avancado_fases` | **Fase** (Lote 6 · #21) — entidade dona da **Absorção** (`absorcao` JSON) e do **Fluxo de Pagamento** (`fluxo_pagamento` JSON). Substitui o antigo `fase_label` de texto. |
| `avancado_alocacoes` | **Alocação de venda** (Lote 6 · #19) — vende `unidades` de uma `tipologia_id` (catálogo) numa `fase_id`, a um `preco_m2`. Várias alocações por tipologia (preços diferentes). Trava de saldo **por fase**: Σ unidades alocadas da tipologia na fase ≤ `quantidade` do catálogo. |
| `avancado_linhas_receita` | **Vestigial** — modelo antigo (linha de receita com tipologias filhas). Preservada no schema, mas o app não a lê/escreve após a migração 003 (fases + alocações). |
| `avancado_linhas_custo` | Linhas de custo em 5 grupos (terreno/obra/diretos/indireto/financeiro) com unidade de orçamento e ancoragem ao cronograma. |

**Absorção (`avancado_fases.absorcao`)** — só o modo **Distribuído** em 3 períodos (Lote 6 · #20): `blocos: [{evento:'lancamento',pct}, {evento:'obra',pct}, {evento:'pos_obra',pct}]`. O período 1 (`lancamento`) cobre **Pré-lançamento + Lançamento**; o Pós-obra é **derivado** (`100 − p1 − p2`) e seu período vem do Cronograma.

**Fluxo de Pagamento (`avancado_fases.fluxo_pagamento`)** — `comissao`, `ret`, **`entrada` e `parcelas` como LISTAS** de linhas (Lote 6 · #20), e `repasse: { apos_entrega_meses }`. O `%` do Repasse é **derivado** (`100 − Σentrada − Σparcelas`), não persistido.

Integridade (Lote 6 · #19): excluir uma tipologia do catálogo com alocações é **bloqueado** (422 `TIPOLOGIA_EM_USO`); editar nome/área reflete ao vivo nas alocações (a alocação guarda só unidades + preço).

## Regras de precisão

- Monetários (R$) e áreas (m²): `decimal(12,2)`.
- Percentuais de entrada: `decimal(5,2)` (comporta defaults fracionários como 6,73% / 1,6% / 0,25%).
- Scores do apelo: `decimal(3,1)`.

## id_legivel

Template `{SIGLA} - {nome} - {UF} - {sequência}` (ex.: `INC - Pátio Urbitá 1 - DF - 002`). Na base, sem espaços/acentos: `inc_patiourbita1_df_002`. A sequência incrementa por `tipo_empreendimento`.

## Núcleo

O app declara `dependencias_nucleo: ["imoveis"]` e `permissoes_nucleo: { "imoveis": ["ler"] }` no manifesto — só leitura de glebas/lotes (o supertipo `imoveis` cobre ambos os subtipos). O consumo segue o contrato padrão do Núcleo (`docs/shell/nucleo.md`): o shell provê as rotas `/api/viabilidade/nucleo/*` e o frontend chama via `urbiVerso.nucleo('/glebas' | '/lotes' | '/imoveis/:id')`. O gate real (por entidade/flag) é ligado pelo admin da instância; sem isso, os endpoints retornam 403 e a UI degrada com aviso (sem quebrar).

O app consome apenas a **área** (e o `id_legivel` para exibição) do imóvel. Ao vincular/desvincular imóveis (só em Rascunho, via `estudo_imoveis`), a área somada é persistida em `estudos.area_terreno_nucleo` para a Proforma calcular sobre o objeto estudo em todas as telas. Coeficientes, áreas dedutíveis e demais parâmetros continuam inputs do estudo. Ver [Visão Geral](visao-geral) para origem manual vs. Núcleo.

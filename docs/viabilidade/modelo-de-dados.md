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
| `preliminar_produtos` | Catálogo de Produtos do Preliminar (#315) — quando preenchido, é a **fonte do VGV**, no lugar dos campos legados de área × preço da linha `estudos`. `GET /estudos` devolve a lista em `produtos` de cada estudo, porque `calcularProforma` escolhe a fonte do VGV pela **presença** dela: sem os produtos no payload, um estudo cujo VGV vem só do catálogo calcularia `vgv = 0` (#407). |
| `estudo_imoveis` | Junção N:M com imóveis do Núcleo (`imovel_nucleo_id` como referência lógica; `tipo_imovel` gleba/lote). Único `[estudo_id, imovel_nucleo_id]`. |
| `estudo_membros` | Permissão por estudo (`funcao` leitor/editor/aprovador). Único `[estudo_id, usuario_id]`. |
| `benchmarks` | Valores de referência por tipo de empreendimento. Único `[tipo_empreendimento, campo]`. |
| `apelo_comercial` | Resultado da IA (`resultado` JSON + 6 scores por fator + `score_geral`). |
| `apelo_comercial_documentos` | Fontes anexadas (`documento` arquivo, `tipo_dado`, `texto_adicional`). |
| `estudo_documentos` | Anexos do Empreendimento (imagem principal, renders, plantas). |
| `analise_mercado` | **Snapshot de MERCADO** do estudo (#199) — preço e custo por m², VSO, macros (IPCA/Selic/INCC + Focus), `riscos` JSON, `abrangencia` (município/UF/nacional), `origem` e `data_referencia`. Guarda **só o lado mercado**: o lado "projeto" é derivado do estudo em tempo de render, nunca persistido. Ver [Análise de Mercado](analise-mercado). |

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

**Fluxo de Pagamento (`avancado_fases.fluxo_pagamento`)** — o JSON legado mantém `comissao`, `ret`, **`entrada` e `parcelas` como LISTAS** de linhas (Lote 6 · #20), e `repasse: { apos_entrega_meses }`; nele, o `%` do Repasse é **derivado** (`100 − Σentrada − Σparcelas`), não persistido. Desde a #230, o mesmo campo também aceita o contrato canônico opt-in `componentes`: lista não vazia dos tipos `imediato`, `prazo_fixo`, `ate_marco` ou `concentrado`, cujas `participacaoPct` fecham 100%. A leitura legada segue preservada por adaptador até o motor por safras passar a consumir os componentes (#283).

Integridade (Lote 6 · #19): excluir uma tipologia do catálogo com alocações é **bloqueado** (422 `TIPOLOGIA_EM_USO`); editar nome/área reflete ao vivo nas alocações (a alocação guarda só unidades + preço).

## Evolução de domínio prevista para recebíveis

> ⚠️ **Seção consultiva.** Nada aqui existe no `schema.json`, em migração ou em runtime. Ela
> registra os conceitos que o modelo de dados precisará representar quando as issues de recebíveis
> da Rodada 5 forem aprovadas e implementadas. **Nenhuma tabela ou coluna deve ser criada a partir
> deste texto** — só a partir de issue aprovada.

A revisão de recebíveis Calliandra (`docs/revisao-recebiveis-calliandra-2026-07-31.md`) concluiu que
a unidade financeira elementar do fluxo avançado **não é o mês**, e sim a **safra**.

| Conceito | O que precisa ser representado |
|---|---|
| **Safra** | Contratos originados no mesmo `mês × Grupo × alocação × componente`. É a chave econômica mínima; hoje não existe entidade equivalente |
| **Componente de pagamento** | Regra que converte parte do contrato em recebimentos. Quatro tipos: **imediato**, **prazo fixo**, **até marco**, **concentrado em marco**. O contrato já pode ser persistido em `fluxo_pagamento.componentes`; o motor por safras ainda será conectado na #283 |
| **Bruto / desconto / líquido** | Três séries mensais separadas por Grupo e tipologia. Hoje existe uma única série derivada do VGV, e o desconto comercial não existe |
| **Primeiro vencimento** | Defasagem configurável, com padrão `s + 1`. Hoje não há campo — as parcelas partem do mês da venda ou do cronograma da Obra |
| **Prazo fixo** | `N` fixo por componente, contado a partir de cada safra (36, 120, outros) |
| **Marco** | Mês comum de encerramento; o prazo da safra passa a ser `N_s = M − s` |
| **Saldo** | Saldo por safra e componente, com `saldo_s,s = principal_s` e `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t`. A carteira total é a soma desses saldos, nunca uma recorrência agregada |

Duas restrições que a evolução precisa respeitar: **compatibilidade de leitura** dos estudos já
gravados (via adapter do JSON legado, EVI-010 / #230) e o inventário de dados legados
(EVI-002 / #221), que é portão da rodada.

## Evolução de domínio prevista para Terreno, valores e funding

> ⚠️ **Seção consultiva, acrescentada em 2026-08-01.** Como a de cima: **nada aqui existe** no
> `schema.json`, em migração ou em runtime. Ela registra o que o modelo de dados precisará
> representar quando as issues da lista de bugs forem aprovadas e implementadas. **Nenhuma tabela
> ou coluna deve ser criada a partir deste texto.**

| Conceito | O que precisa ser representado | Issue |
|---|---|---|
| **Linha Preço canônica** | Identidade `obrigatoria` garantida em **todo** estudo, inclusive nos que o backfill da `007` não alcançou — a migração cobre só `terreno/Compra` de menor id por estudo | #256 |
| **Subcategoria de Preço** | Quatro valores exatos: `Valor à vista`, `Parcelado`, `Permuta física`, `Permuta financeira`. Hoje há uma única `Permuta`, que o motor trata como **financeira** (`frontend/fluxo-caixa-motor.ts:385`). Migração aprovada: toda `Permuta` legada → `Permuta financeira`, preservando o resultado de todo estudo | #257 |
| **Permuta física por tipologia** | Referência de tipologia + quantidade **na linha de custo do Terreno**, substituindo `avancado_tipologias.unidades_permutadas` como fonte de verdade. Exige base de valoração declarada quando a tipologia tem `preco_m2` diferente por Grupo | #258 · #266–#269 |
| **Valor canônico multiunidade** | Quantidade econômica com precisão suficiente, independente da unidade exibida. Hoje o valor **exibido é o persistido**, em duas arquiteturas distintas: um campo por unidade nas Premissas, um único `orcamento_valor` + `orcamento_unidade` em Custos | #259 · #260 |
| **Instrumento de capital** | Entidade de camada do Capital Stack: tipo, compromisso, prioridade de utilização, prioridade de pagamento, calendário de aporte/liberação, status (`rascunho` · `ativo` · `encerrado` · `revisão necessária`). Substitui `financiamento_*`, `investidor_*` e `estrutura_*_pct` como entrada; estes viram metadado legado | #239 · #271 |

Duas restrições valem para todas: nenhum estudo **aprovado, reprovado ou arquivado** pode mudar de
resultado por migração, e toda migração nova exige **bump da `versao`** do manifesto.

Detalhe completo em `docs/lista-bugs-planejamento-2026-07-31.md` e, para o Capital Stack, em
[Funding, Capital Stack e Retorno do Capital](funding-capital-stack).

## Regras de precisão

**Precisão de persistência** — o que a coluna guarda:

- Monetários (R$) e áreas (m²): `decimal(12,2)`.
- Percentuais de entrada: `decimal(5,2)` (comporta defaults fracionários como 6,73% / 1,6% / 0,25%).
- Scores do apelo: `decimal(3,1)`.

**Precisão de resultado** — o que o cálculo produz (contrato de 2026-08-01):

> **Todo valor monetário que é resultado de fórmula tem 2 casas decimais**, na apresentação, na
> entrada e no motor.

São duas regras diferentes e é fácil confundi-las. `decimal(12,2)` já permite centavos desde o
início; o que faltava era dizer que **o cálculo também é quantizado a 2 casas**. Consequências:

- o **valor canônico** de uma premissa multiunidade é o **monetário**, a 2 casas;
- `% do VGV` e `R$/m²` são **representações derivadas**: carregam precisão plena internamente e
  arredondam **só para exibir**. Persistir a representação arredondada é o defeito que a #259
  corrige — foi assim que R$ 10.000.000 virou R$ 9.999.998,76 ao passar por 12,09%;
- áreas (m²) seguem `decimal(12,2)` na persistência; a regra de resultado acima é declarada para
  **valor monetário**.

> ⚠️ **Divergência viva hoje:** a tela formata R$ com **zero** casas (`frontend/viab-format.ts:8`,
> `maximumFractionDigits: 0`) e a exportação com **duas** (`frontend/exportar.ts:9`, `toFixed(2)`) —
> o mesmo estudo mostra números diferentes em CSV e em tela. Correção rastreada pela **#281**.

## id_legivel

Template `{SIGLA} - {nome} - {UF} - {sequência}` (ex.: `INC - Pátio Urbitá 1 - DF - 002`). Na base, sem espaços/acentos: `inc_patiourbita1_df_002`. A sequência incrementa por `tipo_empreendimento`.

## Núcleo

O app declara `dependencias_nucleo: ["imoveis"]` e `permissoes_nucleo: { "imoveis": ["ler"] }` no manifesto — só leitura de glebas/lotes (o supertipo `imoveis` cobre ambos os subtipos). O consumo segue o contrato padrão do Núcleo (`docs/shell/nucleo.md`): o shell provê as rotas `/api/viabilidade/nucleo/*` e o frontend chama via `urbiVerso.nucleo('/glebas' | '/lotes' | '/imoveis/:id')`. O gate real (por entidade/flag) é ligado pelo admin da instância; sem isso, os endpoints retornam 403 e a UI degrada com aviso (sem quebrar).

O app consome apenas a **área** (e o `id_legivel` para exibição) do imóvel. Ao vincular/desvincular imóveis (só em Rascunho, via `estudo_imoveis`), a área somada é persistida em `estudos.area_terreno_nucleo` para a Proforma calcular sobre o objeto estudo em todas as telas. Coeficientes, áreas dedutíveis e demais parâmetros continuam inputs do estudo. Ver [Visão Geral](visao-geral) para origem manual vs. Núcleo.

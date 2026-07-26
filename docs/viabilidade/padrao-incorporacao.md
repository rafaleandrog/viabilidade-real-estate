---
titulo: Padrão de Viabilidade — Incorporação
descricao: Documento canônico de como o app raciocina sobre viabilidade de Incorporação — conceito, premissas, motor de cálculo e implementação, ancorado no schema e nas engines existentes.
tipo: app
ordem: 8
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Padrão de Viabilidade — Incorporação

> **App:** Estudo de Viabilidade (UrbiVerso) · **Tipo de empreendimento:** Incorporação (SIGLA `INC`)
> **Escopo:** um empreendimento de incorporação (residencial e/ou não residencial), analisado como **Estudo Preliminar** (indicadores estáticos) ou **Avançado** (fluxo de caixa temporal). Loteamento tem seu próprio conjunto de premissas e não é coberto aqui.
> **Uso:** material de **contexto de negócio** para entender *por que* a viabilidade de uma incorporação funciona como funciona e onde cada conceito vive no código (`schema.json`, `frontend/proforma.ts`, `frontend/fluxo-caixa-motor.ts`).

> ⚠️ **Status: documento CONSULTIVO, não normativo.** Consulte-o para ganhar contexto de negócio ao implementar uma mudança, atualização ou resolver um issue — **nunca** o use como autoridade para *alterar* a lógica que já existe. Ele **descreve** o app; não o **define**. A verdade sobre comportamento está sempre no código, no `schema.json`, na spec (`docs/spec/estudo-de-viabilidade-spec.md`) e nos docs de referência. **Se este texto divergir do que o código faz, o código está certo e é ESTE documento que deve ser corrigido** — jamais o contrário. Uma mudança de comportamento nasce de uma issue/spec, não de uma frase daqui.

Este documento **não introduz vocabulário novo** nem regra nova: toda linguagem, convenção e fórmula aqui apenas reflete o que já existe no app. Onde houver dúvida, valem as fontes de verdade: [Visão Geral](visao-geral), [Modelo de Dados](modelo-de-dados), [Fórmulas da Proforma](formulas), [Benchmarks e Sensibilidade](benchmarks), [Permissões e Ciclo de Vida](permissoes), `schema.json` e as engines cobertas por teste (`frontend/proforma.ts`, `frontend/fluxo-caixa-motor.ts`).

---

## 0. Como este documento funciona

Ele tem quatro camadas, e cada leitor entra pela sua:

| Camada | Seções | Para quem |
|---|---|---|
| **Conceitual** — o que é viabilidade e o que ela decide | 1 | Diretoria, avaliador (aprovador) |
| **Premissas** — os blocos de entrada do estudo | 2 | Autor/editor do estudo |
| **Motor de cálculo** — Proforma (Preliminar) e Fluxo de Caixa (Avançado) | 3 | Editor + desenvolvedor |
| **Implementação** — dicionário, schema, indicadores, validações, API | 4 a 9 | Desenvolvedor |

**Regra de ouro do app:** a Proforma **roda no frontend em tempo real** e é determinística — dado o mesmo conjunto de premissas, o resultado é sempre o mesmo. O backend **persiste apenas os inputs**; nenhum indicador é gravado. Toda a arte está em (i) declarar as premissas de forma completa e (ii) tornar visível qual premissa está carregando o resultado (é o papel dos KPIs ao vivo, dos benchmarks e da análise de sensibilidade).

---

## 1. Camada conceitual

### 1.1 A tese econômica da incorporação

Incorporação é a conversão de **potencial construtivo** (área do terreno × coeficiente de aproveitamento) em **área privativa vendável**, financiada em boa parte pelo próprio comprador ao longo do ciclo. O resultado do empreendimento nasce de três alavancas, e é útil separá-las porque cada uma responde a um grupo de premissas diferente:

1. **Margem de produto** — vender área privativa por mais do que custa produzi-la. Alavancas: `preco_venda_m2_residencial` / `preco_venda_m2_nao_residencial` e `custo_construcao_m2`.
2. **Eficiência de projeto** — extrair mais área privativa por m² de terreno. Alavancas: `coef_aproveitamento_maximo`, o mix de áreas privativas (`area_pvt_*`) e a razão privativa/construída.
3. **Estrutura de capital e tempo** — reduzir o capital próprio exposto e o tempo em que ele fica exposto. Só o nível **Avançado** mede isso, via Cronograma, Absorção, Fluxo de Pagamento e Funding.

Um estudo que só mede (1) e (2) é o **Preliminar** — responde "o projeto gera valor?". O **Avançado** acrescenta a dimensão temporal e responde "quanto capital exige e por quanto tempo?".

### 1.2 Os eixos que geram o resto

```
PRODUTO (quanta área privativa, R e NR)
   ×
PREÇO (R$/m² por tipo: residencial, não residencial)
   =  VGV
        ⊗  (só no nível Avançado)
TEMPO (Cronograma · Absorção · Fluxo de Pagamento)
   =  FLUXO DE CAIXA  →  VPL, TIR, Payback, Exposição máxima
```

No Preliminar, o VGV e a Proforma bastam para os indicadores estáticos (Resultado, Margem, ROI). No Avançado, o mesmo VGV é distribuído no tempo pelas fases para produzir a curva de caixa.

### 1.3 O que o estudo precisa responder

| Pergunta | O que o app entrega | Nível |
|---|---|---|
| O projeto gera valor? | Resultado final, Margem bruta, Margem líquida, ROI, Resultado por unidade | Preliminar |
| A estrutura de custo é competitiva? | Custo de obras / VGV, KPIs contra benchmark | Preliminar |
| Quanto capital exige, e por quanto tempo? | Exposição máxima (`min(fluxoAcumulado)`), Payback (mês/data) | Avançado |
| O retorno compensa o prazo? | TIR (% a.a.), VPL à `taxa_desconto_aa` | Avançado |
| O que precisa dar errado para virar problema? | Análise de sensibilidade (Bear/Base/Bull) e Cenários | Ambos |
| O imóvel tem apelo de mercado? | Apelo Comercial (IA, 6 fatores) | Ambos |

### 1.4 Convenções fundamentais do app

Estas convenções são **decisões metodológicas explícitas** do app. Um cálculo que as adote diferente produz números não comparáveis com os do estudo.

| # | Convenção | Onde vive |
|---|---|---|
| **C1** | **VGV da Incorporação usa as áreas fechadas.** `VGV = área_pvt_r_fechada × preço residencial + área_pvt_nr_fechada × preço não residencial`. Áreas abertas (varandas/terraços) entram na área privativa, mas não somam VGV direto. | `formulas.md`, `proforma.ts` |
| **C2** | **Custo do terreno incide sobre a área do terreno**, não sobre a privativa: `custo_terreno_m2 × área do terreno`, zerável pelo `considerar_custo_terreno`. | `proforma.ts` (cabeçalho) |
| **C3** | **Receita positiva, custos positivos nos arrays; o sinal entra na consolidação** (`fluxo = receita − custo`). A Proforma e o Fluxo somam linhas, nunca invertem sinal na apresentação. | `fluxo-caixa-motor.ts` |
| **C4** | **No Avançado, o tempo é em meses relativos 0-based**: mês 0 = `data_inicio_projeto`; o índice do array mensal coincide com o número do mês. **Não há meses negativos.** | `fluxo-caixa-motor.ts` |
| **C5** | **Permuta física não entra no fluxo** — reduz a área/VGV vendável do incorporador (área vendável líquida). **Permuta financeira é dedução da receita**, % do VGV residencial/não residencial (ou valor fixo). | `proforma.ts`, `formulas.md` |
| **C6** | **Imposto segue o regime tributário**: `4%` quando `sujeito_ret`, senão `imposto_percentual`. Corretagem, marketing e permutas financeiras são deduções da receita antes dos custos. | `formulas.md`, schema |

---

## 2. Premissas — os blocos de entrada

As premissas de um estudo de Incorporação vivem na tabela `estudos` (nível Preliminar) e nas tabelas `avancado_*` (nível Avançado). A aba **Premissas** organiza os blocos abaixo; a Proforma recalcula ao vivo a cada mudança.

### Bloco A — Produto e áreas

| Campo | Un. | Papel |
|---|---|---|
| `area_terreno_nucleo` / `terreno_manual_area` | m² | Área do terreno — soma dos lotes do Núcleo ou valor manual |
| `coef_aproveitamento_basico` · `coef_aproveitamento_maximo` | — | Potencial construtivo; `coef_maximo` default 3 |
| `gabarito_maximo` | m | Altura máxima permitida |
| `area_pvt_r_fechada` · `area_pvt_r_aberta` | m² | Privativa residencial fechada / aberta (varandas) |
| `area_pvt_nr_fechada` · `area_pvt_nr_aberta` | m² | Privativa não residencial fechada / aberta |
| `area_comum_total` | m² | Áreas de uso condominial |
| `num_unidades` · `num_unidades_residencial` · `num_unidades_nao_residencial` | — | Contagem de unidades |

**Derivados** (calculados na Proforma, nunca gravados): `areaPrivativa`, `areaConstruida`, `areaVendavel`, `areaPermutaFisica`, `areaVendavelLiquida`, `precoMedioUnidade` (e por tipo R/NR).

### Bloco B — Preços e mix

- `preco_venda_m2_residencial` (R$/m²) — aplicado à área privativa residencial fechada.
- `preco_venda_m2_nao_residencial` (R$/m²) — aplicado à área privativa não residencial fechada.
- `valor_venal_terreno_m2` (R$/m²) — base de cálculo da outorga.

O VGV total é a soma do VGV residencial e do não residencial (C1). A permuta física residencial e não residencial reduz o VGV disponível (área vendável líquida).

### Bloco C — Deduções da receita

| Campo | Base |
|---|---|
| Imposto (`sujeito_ret` → 4% · senão `imposto_percentual`) | % do VGV |
| `corretagem_percentual` | % do VGV |
| `marketing_percentual` | % do VGV |
| `permuta_financeira_residencial_pct` / `_valor` (modo `pct_vgv`\|`valor_fixo`) | % do VGV residencial ou valor fixo |
| `permuta_financeira_nao_residencial_pct` / `_valor` | % do VGV não residencial ou valor fixo |

`Receita líquida = VGV − deduções`.

### Bloco D — Custos diretos

| Campo | Base de cálculo |
|---|---|
| `considerar_custo_terreno` + `custo_terreno_m2` | R$/m² × **área do terreno** (C2) |
| `projetos_modo` (`pct_vgv`\|`valor_fixo`) + `projetos_pct` / `projetos_valor_fixo` | % do VGV ou valor fixo (default 1,6%) |
| `licenciamento_modo` + `licenciamento_pct` / `licenciamento_valor_fixo` | valor fixo ou % do VGV |
| `construcao_modo` (`valor_m2`\|`valor_total`) + `custo_construcao_m2` / `construcao_valor_total` | R$/m² privativo × área privativa, ou valor total (default 4800/m²) |
| `taxa_gestao_pct` | % sobre o custo de construção (default 6%) |
| `custo_decoracao_m2` | R$/m² privativo (default 150) |
| `incorporacao_registro_pct` | % do VGV (default 0,25%) |
| `manutencao_pct` · `contingencias_pct` | % do VGV |

A outorga é derivada do `valor_venal_terreno_m2` e do diferencial de coeficiente. **Obras** na Incorporação = construção + decoração + gestão da construção (contraste com Loteamento, onde "obras" = infraestrutura).

### Bloco E — Custos indiretos

- `marketing_global_pct` — marketing global / estrutura (% do VGV, default 1%).
- `gestao_indiretos_pct` — gestão e indiretos (% do VGV, default 1,25%).

`Resultado = Receita líquida − Custo direto total − Custo indireto total` (mais o efeito das permutas). `Margem líquida (%) = Resultado / VGV × 100`.

### Bloco F — Permutas

| Tipo | Campos | Efeito |
|---|---|---|
| **Física** | `permuta_fisica_modo` (`area_m2`\|`pct_area_venda`), `_area_m2`, `_pct` (e o par `_nr_*` para não residencial) | Reduz a área/VGV vendável. **Não entra no fluxo** (C5) |
| **Financeira** | ver Bloco C | Dedução da receita, proporcional ao VGV (ou valor fixo) |

### Bloco G — Regime tributário e Funding (nível Avançado)

Além do imposto simplificado do Preliminar, o estudo Avançado detalha:

- **Regime tributário** — `regime_tributario` (`ret`\|`lucro_presumido`\|`lucro_real`) e alíquotas (`aliquota_pis_pct`, `_cofins_pct`, `_csll_pct`, `_irpj_pct`, `_itbi_pct`), `imposto_sobre_permuta_fisica`.
- **Estrutura de capital** — `estrutura_capital_proprio_pct`, `estrutura_financiamento_pct`, `estrutura_investidores_pct`.
- **Financiamento à obra** — `financiamento_obra_pct`, `financiamento_juros_aa`, `financiamento_sistema_amortizacao` (`price`\|`sac`), `financiamento_prazo_meses`, `financiamento_carencia_meses`.
- **Investidor** — `investidor_aporte_valor`, `investidor_retorno_tipo` (`remunerado`\|`pct_receita`\|`pct_resultado`), `investidor_juros_aa`, `investidor_carencia_meses`, `investidor_parcelas`.
- **Custo de capital e correção** — `taxa_desconto_aa` (default 12%, base do VPL), `indice_correcao` (`incc`\|`ipca`\|`igpm`\|`cdi`\|`tr`\|`inpc`\|`nenhum`), `juros_financeiros_aa`, `juros_inicio_cobranca_mes`.

### Bloco H — Dimensão temporal (nível Avançado)

O nível Avançado acrescenta a régua de tempo e a mecânica de recebimento, em tabelas próprias:

**Cronograma (`avancado_cronograma`)** — 5 eventos, `inicio_mes` 0-based e `duracao_meses`:

| Evento | Papel |
|---|---|
| `planejamento` | Pré-desenvolvimento; gasta-se sem vender |
| `pre_lancamento` | Preparo comercial |
| `lancamento` | Pico de velocidade de vendas |
| `obra` | Execução física; sobrepõe-se às vendas |
| `pos_obra` | Entrega, repasse e venda de estoque |

**Tipologias (`avancado_tipologias`)** — catálogo do estudo: `nome`, `tipo_unidade` (`apartamento`\|`cobertura`\|`loja`\|`lote`\|`outro`), `area_privativa_m2`, `dormitorios`, `vagas`, `quantidade`, `unidades_permutadas`, `preco_m2`. Desacoplado da receita.

**Fases (`avancado_fases`)** — entidade dona da **Absorção** e do **Fluxo de Pagamento**:

- **Absorção** (`absorcao` JSON) — modo **Distribuído** em 3 períodos: `lancamento` (cobre Pré-lançamento + Lançamento), `obra`, `pos_obra`. O Pós-obra é **derivado** (`100 − p1 − p2`) e seu período vem do Cronograma.
- **Fluxo de Pagamento** (`fluxo_pagamento` JSON) — `comissao`, `ret`, **`entrada` e `parcelas` como LISTAS** de linhas, e `repasse: { apos_entrega_meses }`. O `%` do Repasse é **derivado** (`100 − Σ entrada − Σ parcelas`), não persistido.

**Alocações (`avancado_alocacoes`)** — vende `unidades` de uma `tipologia_id` numa `fase_id` a um `preco_m2`. Várias alocações por tipologia (preços diferentes). Trava de saldo por fase: `Σ unidades alocadas da tipologia na fase ≤ quantidade` do catálogo.

**Linhas de custo (`avancado_linhas_custo`)** — 5 grupos (`terreno`\|`obra`\|`diretos`\|`indireto`\|`financeiro`), `orcamento_valor` + `orcamento_unidade` (`rs`\|`rs_m2_priv`\|`rs_m2_terreno`\|`pct_vgv`\|`pct_receita`\|`pct_obra`), ancoradas ao Cronograma (`cronograma_evento`, `inicio_mes`, `duracao_meses`) e a uma curva (`curva_id`).

**Curvas (`avancado_curvas`)** — distribuição de valores no tempo (Curva S padrão + customizadas da instância). A engine reamostra a curva para a duração real e normaliza para somar 100% (`reamostrarCurva`), com fallback `linear`.

---

## 3. Motor de cálculo

O app tem **dois motores puros, sem DOM e sem I/O**, ambos cobertos por teste. O backend nunca calcula indicadores — só persiste inputs.

### 3.1 Proforma (nível Preliminar) — `frontend/proforma.ts`

Sequência de cálculo, tudo em cima do objeto `estudo`:

```
1. Áreas         → áreaTerreno, áreaPrivativa, áreaConstruída, área vendável líquida (após permuta física)
2. VGV           → VGV = área_pvt_r_fechada × preço R + área_pvt_nr_fechada × preço NR
3. Deduções      → imposto (RET/percentual) + corretagem + marketing + permutas financeiras
                   Receita líquida = VGV − deduções
4. Custos diretos→ terreno + projetos + construção + gestão + decoração + outorga
                   + incorporação/registro + manutenção + contingências
5. Custos indiretos → marketing global + gestão/indiretos
6. Resultado     → Receita líquida − Custo direto total − Custo indireto total (+ permutas)
7. KPIs          → Margem bruta, Margem líquida, ROI, Custo obras/VGV, Investimento total,
                   Resultado por unidade (e por tipo R/NR)
```

A engine devolve a interface `Proforma` (áreas, VGV, deduções, linhas de custo, `resultado`, `margemLiquidaPct`, `roiPct`, `custoObrasVgvPct`, `investimentoTotal`, …). É ela que alimenta a aba **Proforma**, os KPIs da aba **Premissas** e a exportação.

### 3.2 Fluxo de Caixa (nível Avançado) — `frontend/fluxo-caixa-motor.ts`

Distribui receitas e custos ao longo de meses relativos 0-based (C4) e consolida a curva de caixa:

```
Receita da fase(t):
  absorção → vendas/mês (distribuído em lançamento/obra/pós-obra)
  para cada venda, aplica o Fluxo de Pagamento:
    - Entrada (parcelável a partir do mês da venda)
    - Parcelas (ao longo da obra / por periodicidade)
    - Repasse (% derivado) concentrado N meses após a Obra (repasse.apos_entrega_meses)
  Comissão e RET deduzem o valor recebível.

Custo(t):
  cada linha de custo é distribuída por distribuirLinha(total, inicio_mes, duracao_meses, curva)
  ancorada ao cronograma_evento; a base (rs_m2_priv, pct_vgv, …) resolve o total antes de distribuir.

Consolidação:
  fluxoMensal(t)    = receitaMensal(t) − custoMensal(t)
  fluxoAcumulado(t) = fluxoAcumulado(t−1) + fluxoMensal(t)
```

**Saídas do Fluxo** (`FluxoCalc`): `vgvTotal`, `vpl` (à `taxa_desconto_aa`), `tir` (% a.a.), `paybackMes`/`paybackData`, `exposicaoMaxima` (= `min(fluxoAcumulado)`, tipicamente negativo — o capital próprio que o projeto exige), além das séries `receitaMensal`, `custoMensal`, `fluxoMensal`, `fluxoAcumulado` e das linhas de receita/custo detalhadas.

**Views Mensal e Anual (#127):** a tela oferece dois modos de exibição das colunas, exclusivos entre si (um sempre ativo). Em **Mensal** cada coluna é um mês; em **Anual**, `agregarFluxoPorPeriodos` reagrupa as colunas em anos-calendário (recortados por `periodosAnuais` a partir de `data_inicio_projeto` — o primeiro e o último ano podem ser parciais). A agregação é só de **exibição**: as séries de fluxo são somadas dentro do ano (a soma anual bate com a mensal em toda linha), o acumulado é o saldo do **último mês** do ano, e `vpl`, `tir`, `paybackMes`/`paybackData` e `exposicaoMaxima` **não mudam** — são grandezas do fluxo mês a mês. Tabela, gráficos e as exportações CSV/PDF seguem a view selecionada.

> **Permuta física no Avançado:** não entra no fluxo — o VGV derivado das tipologias já é o valor de venda do incorporador (as `unidades_permutadas` saem do total vendável).

---

## 4. Dicionário de premissas (campos reais)

Nomes em **snake_case, em português**, exatamente como no `schema.json`. Valores monetários e áreas em `decimal(12,2)`; percentuais de entrada em `decimal(5,2)`; scores em `decimal(3,1)`. Percentuais são **digitados como número inteiro/decimal** (ex.: `7` = 7%), não como fração.

**Identidade & ciclo:** `id_legivel`, `nome`, `nome_exibicao`, `tipo_empreendimento` (`incorporacao`), `uf`, `sequencia`, `nivel_analise` (`preliminar`\|`avancado`), `status`, `autor_id`, `origem_terreno` (`nucleo`\|`manual`).

**Produto:** `area_terreno_nucleo`, `terreno_manual_area`, `coef_aproveitamento_basico`, `coef_aproveitamento_maximo`, `gabarito_maximo`, `area_pvt_r_fechada`, `area_pvt_r_aberta`, `area_pvt_nr_fechada`, `area_pvt_nr_aberta`, `area_comum_total`, `num_unidades`, `num_unidades_residencial`, `num_unidades_nao_residencial`.

**Preços:** `preco_venda_m2_residencial`, `preco_venda_m2_nao_residencial`, `valor_venal_terreno_m2`.

**Deduções:** `sujeito_ret`, `imposto_percentual`, `corretagem_percentual`, `marketing_percentual`, `permuta_financeira_residencial_pct`/`_modo`/`_valor`, `permuta_financeira_nao_residencial_pct`/`_modo`/`_valor`.

**Custos diretos:** `considerar_custo_terreno`, `custo_terreno_m2`, `projetos_modo`/`_pct`/`_valor_fixo`, `licenciamento_modo`/`_pct`/`_valor_fixo`, `construcao_modo`/`custo_construcao_m2`/`construcao_valor_total`, `taxa_gestao_pct`, `custo_decoracao_m2`, `incorporacao_registro_pct`, `manutencao_pct`, `contingencias_pct`.

**Custos indiretos:** `marketing_global_pct`, `gestao_indiretos_pct`, `stand_vendas_valor` (Loteamento).

**Permuta física:** `permuta_fisica_modo`/`_area_m2`/`_pct` e `permuta_fisica_nr_modo`/`_nr_area_m2`/`_nr_pct`.

**Sensibilidade & desconto:** `sensibilidade_variacao_positiva_pct`, `sensibilidade_variacao_negativa_pct`, `taxa_desconto_aa`, `data_inicio_projeto`.

**Funding (Avançado):** `estrutura_capital_proprio_pct`, `estrutura_financiamento_pct`, `estrutura_investidores_pct`, `financiamento_obra_pct`, `financiamento_juros_aa`, `financiamento_sistema_amortizacao`, `financiamento_prazo_meses`, `financiamento_carencia_meses`, `investidor_aporte_valor`, `investidor_retorno_tipo`, `investidor_juros_aa`, `investidor_carencia_meses`, `investidor_parcelas`, `regime_tributario`, `aliquota_*_pct`, `indice_correcao`/`_taxa_aa`, `juros_financeiros_aa`, `juros_inicio_cobranca_mes`.

Para os campos das tabelas `avancado_*`, ver [Modelo de Dados](modelo-de-dados).

---

## 5. Modelo de dados

O registro central é a tabela `estudos` (`soft_delete`, `acesso_externo: "restrito"`). Um estudo Avançado acrescenta as tabelas `avancado_cronograma`, `avancado_tipologias`, `avancado_fases`, `avancado_alocacoes`, `avancado_linhas_custo`, `avancado_curvas` e `avancado_cenarios`. Membership por estudo em `estudo_membros`; vínculo com o Núcleo em `estudo_imoveis`; benchmarks em `benchmarks`; IA em `apelo_comercial` (+ `_documentos`) e anexos do empreendimento em `estudo_documentos`.

Todas as escritas passam pelas rotas customizadas (`acesso_externo: "restrito"`) — regras de negócio e permissão por estudo. Detalhes de cada tabela, relações e `id_legivel` em [Modelo de Dados](modelo-de-dados).

**id_legivel** — template `{SIGLA} - {nome} - {UF} - {sequência}` (ex.: `INC - Pátio Urbitá 1 - DF - 002`; na base `inc_patiourbita1_df_002`). A sequência incrementa por `tipo_empreendimento`.

---

## 6. Indicadores, benchmarks, sensibilidade e cenários

### 6.1 Indicadores estruturais

O padrão exige exibir os indicadores juntos — nenhum decide sozinho:

| Indicador | Origem | Nível |
|---|---|---|
| **Resultado final** | `Receita líquida − custos (+ permutas)` | Preliminar |
| **Margem bruta / Margem líquida** | `margemBrutaPct`, `margemLiquidaPct` | Preliminar |
| **ROI** | `roiPct` | Preliminar |
| **Custo de obras / VGV** | `custoObrasVgvPct` | Preliminar |
| **VPL** | à `taxa_desconto_aa` | Avançado |
| **TIR** | `tir` (% a.a.) | Avançado |
| **Payback** | `paybackMes` / `paybackData` | Avançado |
| **Exposição máxima** | `min(fluxoAcumulado)` | Avançado |

### 6.2 Benchmarks

Registro geral do app (não do Núcleo), definido pelo **administrador** por `tipo_empreendimento`. Cada benchmark tem `campo`, `valor` e `regra_comparacao` (`atingir_ou_superar` \| `nao_exceder`), com faixas de medidor (`medidor_min`/`_max`/`_faixa1_ate`/`_faixa2_ate`). O botão **"Criar indicadores padrão"** semeia o conjunto do MVP: `resultado_final`, `margem_bruta`, `margem_liquida`, `roi`, `custo_obras_vgv` (e, só no Loteamento, `eficiencia_aproveitamento`). Cada KPI aparece verde/vermelho contra seu benchmark. Ver [Benchmarks e Sensibilidade](benchmarks).

### 6.3 Preço Sugerido/m²

Menor preço de venda por m² para a margem atingir o **piso do benchmark `resultado_final`**. Resolvido por **bisseção** sobre o preço (valor único, mesmo na Incorporação). Ver [Fórmulas](formulas).

### 6.4 Análise de sensibilidade

Na aba Proforma, escolhe-se **uma** variável a estressar (preço/m², permuta física/financeira, custo de obras na Incorporação). O app calcula **Bear** (`base × (1 − var⁻)`), **Base** e **Bull** (`base × (1 + var⁺)`) e exibe as linhas afetadas lado a lado. MVP é **unidimensional**. As faixas vêm do benchmark (`variacao_positiva_pct`/`_negativa_pct`), sobrescrevíveis por estudo (`sensibilidade_variacao_*_pct`).

### 6.5 Cenários

`avancado_cenarios` guarda variações nomeadas por dois eixos: `preco_venda_pct` e `custo_obra_pct`. Cada cenário reaplica o motor sobre o mesmo estudo com esses deltas, para comparação lado a lado.

---

## 7. Validações e invariantes

### 7.1 Validações de premissas (bloqueiam/avisam na entrada)

Rodam no frontend (`frontend/premissas-validacao.ts`). Exemplos coerentes com o schema:

| Regra | Descrição |
|---|---|
| Percentuais de dedução somando > 100% | Loteamento (não se aplica à Incorporação, mas o mesmo guarda-chuva vale) |
| Absorção por fase excede 100% | `lancamento + obra > 100` (pós-obra é o resíduo) |
| Fluxo de pagamento excede 100% | `Σ entrada + Σ parcelas > 100` (repasse é o resíduo) |
| Trava de alocação por fase | `Σ unidades alocadas da tipologia na fase > quantidade` do catálogo |
| Excluir tipologia com alocações | Bloqueado (`422 TIPOLOGIA_EM_USO`) |
| Carência ≥ prazo | `financiamento_carencia_meses ≥ financiamento_prazo_meses` com financiamento > 0 |

### 7.2 Invariantes de fechamento (checagem sobre a saída do motor)

| Invariante | Regra |
|---|---|
| **Conservação da Proforma** | `Resultado = Σ linhas da Proforma` |
| **Fechamento de estoque** | Unidades vendidas por tipologia = alocadas; nunca negativo |
| **Conservação de receita** | `Σ receitaMensal = VGV recebível` (líquido de comissão/RET) |
| **Repasse derivado** | `% repasse = 100 − Σ entrada − Σ parcelas` |
| **Zeramento de saldos** | Saldos residuais de centavo zerados na apresentação (arredondamento só na saída) |

---

## 8. Armadilhas conhecidas

São os erros que o app já resolve por construção — documentados no cabeçalho de `frontend/proforma.ts` e `frontend/fluxo-caixa-motor.ts`.

**A1 — Base do custo de terreno.** Custo de terreno incide sobre a **área do terreno**, não sobre a privativa (C2). Trocar a base infla a maior linha de aquisição.

**A2 — VGV das áreas fechadas.** O VGV usa `area_pvt_*_fechada` (C1); áreas abertas entram na privativa mas não geram VGV direto. Somá-las ao VGV superestima a receita.

**A3 — "Obras" depende do tipo.** Na Incorporação, obras = construção + decoração + gestão da construção; na Incorporação **não** existe infraestrutura de loteamento. O `custoObrasVgvPct` reflete isso.

**A4 — Permuta física vs. financeira.** Física reduz a área/VGV vendável e **não entra no fluxo** (C5); financeira é dedução da receita. Tratá-las igual distorce Receita líquida e Resultado.

**A5 — Meses relativos 0-based.** No Avançado o mês 0 é `data_inicio_projeto` e o índice do array coincide com o mês; **não há meses negativos** (C4). Ancorar eventos fora dessa régua desloca toda a curva.

**A6 — Repasse é derivado.** O `%` do Repasse é `100 − Σ entrada − Σ parcelas`; persistir um valor independente quebra a conservação de receita.

**A7 — Curva reamostrada.** A curva de distribuição é reamostrada para a duração real e normalizada para 100% (`reamostrarCurva`); usar os pontos brutos sem normalizar vaza valor para fora do horizonte.

**A8 — Um único indicador decide.** Margem alta com exposição de caixa incompatível é projeto inviável. Exibir os indicadores estruturais juntos, contra benchmark, é requisito de produto.

---

## 9. Ciclo de vida, permissões e API

**Ciclo de vida:** `rascunho → em_analise → aprovado | reprovado`, com devolução ao Rascunho e reabertura de Arquivado pelo aprovador. Estudos parados (exceto Aprovado) por 30 dias são arquivados automaticamente. Ver [Permissões e Ciclo de Vida](permissoes).

**Permissões:** por estudo (`estudo_membros.funcao` = `leitor`\|`editor`\|`aprovador`), sobre a permissão de app (`nivelApp`/`rolesApp`) do shell. A app **nunca** implementa autenticação — usa `req.contexto`.

**API:** rotas **relativas**; o shell prefixa tudo com `/api/viabilidade/`. O frontend chama via `urbiVerso.api('/viabilidade/…')` e o Núcleo via `urbiVerso.nucleo('/glebas' | '/lotes' | '/imoveis/:id')`. Persistência via `req.dados`; o cálculo é do frontend (a API não tem endpoint de "simular"). Endpoints principais: `/estudos` (CRUD + duplicar + ciclo de status), `/benchmarks` (leitura livre; `POST`/`PATCH`/`DELETE` e `POST /benchmarks/semear` para admin), rotas de Empreendimento/Tipologias/Fases/Custos do Avançado, `/apelo-comercial` e exportação.

---

## 10. Glossário

| Termo | Definição |
|---|---|
| **Área privativa** | Área de propriedade exclusiva da unidade; base do produto (`area_pvt_*`) |
| **Área vendável líquida** | Área/VGV disponível após a permuta física |
| **Absorção** | Distribuição das vendas de uma fase nos períodos lançamento/obra/pós-obra |
| **Apelo Comercial** | Análise qualitativa por IA (6 fatores) do imóvel |
| **Benchmark** | Indicador de referência por tipo de empreendimento, definido pelo admin |
| **Exposição máxima** | Maior saldo negativo do fluxo acumulado; o capital próprio exigido |
| **Fase** | Entidade dona da Absorção e do Fluxo de Pagamento (Avançado) |
| **Fluxo de Pagamento** | Como cada venda é recebida: entrada, parcelas e repasse (+ comissão/RET) |
| **Nível de análise** | `preliminar` (estático) ou `avancado` (fluxo de caixa) |
| **Outorga onerosa** | Contrapartida pelo potencial construtivo acima do coeficiente básico |
| **Permuta física / financeira** | Pagamento do terreno em unidades (física) ou em % da receita/valor (financeira) |
| **Preço Sugerido/m²** | Menor preço para atingir o piso do benchmark `resultado_final` |
| **Repasse** | Quitação do saldo do comprador via financiamento bancário, após a entrega |
| **RET** | Regime Especial de Tributação (imposto de 4% quando `sujeito_ret`) |
| **Tipologia** | Item do catálogo de unidades do estudo (Avançado) |
| **VGV** | Valor Geral de Vendas — área privativa fechada × preço. Medida de tamanho |

---

## Veja também

- [Visão Geral](visao-geral) · [Modelo de Dados](modelo-de-dados) · [Fórmulas](formulas) · [Benchmarks](benchmarks) · [Apelo Comercial](apelo-comercial) · [Permissões](permissoes) · [Exportação](exportacao)

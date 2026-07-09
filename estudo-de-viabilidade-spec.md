# Estudo de Viabilidade — Spec (v1.0)

> Plataforma para análise econômico-financeira de empreendimentos imobiliários (Loteamento e Incorporação). Substitui planilhas dispersas por uma aplicação centralizada no UrbiVerso com cálculos automáticos, indicadores padronizados, comparação de cenários, análise de sensibilidade e avaliação de apelo comercial assistida por IA.

---

## 1. Visão Geral

O app permite criar, organizar e calcular estudos de viabilidade para empreendimentos imobiliários. O usuário seleciona imóveis do Núcleo (glebas ou lotes, conforme o tipo de empreendimento), define parâmetros do produto, estrutura custos e o sistema gera automaticamente uma Proforma com indicadores financeiros.

**Tipos de empreendimento:** Loteamento, Incorporação.

**Origem do terreno (single-select na criação do estudo):**

Na criação de cada estudo, o usuário escolhe a origem do terreno:
- **Buscar terreno** (valor interno: `nucleo`) — seleciona imóvel existente no Núcleo (gleba para Loteamento, lote(s) para Incorporação). O único dado que vem do Núcleo é a **área** do imóvel (campo `area` do supertipo `imoveis`), exibida em modo leitura. Nome do imóvel também vem do Núcleo.
- **Inserir novo** (valor interno: `manual`) — informa nome e área do terreno diretamente no estudo. Sem vínculo com o Núcleo. Dados registrados no próprio estudo.

A escolha é feita uma vez na criação e determina de onde vêm os dados base do terreno.

**Relação com imóveis do Núcleo (quando origem = Núcleo):**
- **Loteamento** → referencia 1 **Gleba** (o imóvel original antes do parcelamento; os lotes são a saída hipotética do exercício de viabilidade — ainda não existem)
- **Incorporação** → referencia 1 ou mais **Lotes** (resultado de parcelamento já existente; a incorporação acontece sobre lotes definidos)

O Núcleo não possui entidade "Terreno" — o modelo usa `imoveis` (supertipo) com subtipos `gleba`, `lote` e `unidade`. Este app trabalha com glebas e lotes. Quando a origem é Núcleo, imóveis não cadastrados devem ser criados lá primeiro.

**Filtragem de imóveis:** O app exclui do seletor imóveis que não interessam à viabilidade. A lógica é **excludente** (proibir específicos, permitir o resto):
- **Lotes:** excluir lotes contidos em Parcelamentos (relação lote→parcelamento já existe no Núcleo — confirmado).
- **Glebas:** excluir a gleba "Fazenda Paranoazinho" (gleba-mãe já cadastrada). Demais glebas são selecionáveis.

**Níveis de análise:**
- **Estudo Preliminar (MVP):** validação rápida do potencial econômico com indicadores estáticos (sem dimensão temporal).
- **Projeto Avançado (v2):** modelagem financeira completa com fluxo de caixa, financiamento, TIR, VPL. Vinculado a Estudo Preliminar existente.

Na criação do estudo, o usuário escolhe entre Estudo Preliminar e Avançado (este bloqueado na v1). A escolha determina quais abas, campos e conteúdo ficam disponíveis.

**Indicador automático — Preço Sugerido/m² (MVP):** O app calcula automaticamente o preço mínimo de venda por m² necessário para que o **resultado final (%) do estudo seja igual ou superior ao definido no benchmark**. Se o benchmark define resultado final mínimo de 25%, o preço sugerido é o menor valor que atinge esse piso. Cada tipo de estudo (Loteamento, Incorporação) tem seu próprio benchmark. O preço sugerido aparece no resumo ao final do formulário de Premissas como informação calculada.

**Preço sugerido é sempre um valor único**, mesmo para Incorporação (que tem preços residencial e não residencial separados). O cálculo considera o preço mínimo necessário como uma média simples sobre toda a área disponível para venda. É um aviso informativo — logo após consultá-lo, o usuário preenche os valores reais diferenciando residencial e não residencial.

---

## 2. Roles e Permissões

**Modelo: permissão por estudo** (mesmo padrão dos OKRs e Recrutamento). Cada estudo tem seus próprios membros e funções — não há leitura global para todos.

Três funções por estudo:

- **Leitor** — visualiza o estudo e exporta PDF/Excel. Não vê estudos em Rascunho ou Arquivado.
- **Editor** — cria, edita, duplica estudos. Pode avançar de Rascunho → Em análise. Edita benchmarks. Tudo que o Leitor faz.
- **Aprovador** — tudo do Editor + aprovar, reprovar e devolver estudos ao Rascunho. Pode editar qualquer campo mesmo após submissão (exceto alterar imóvel vinculado fora de Rascunho).

```json
{
  "roles": {
    "leitura": {
      "leitor": "Visualiza estudos e exporta relatórios"
    },
    "escrita": {
      "editor": "Cria e edita estudos de viabilidade"
    },
    "admin": {
      "aprovador": {
        "descricao": "Aprova ou rejeita estudos pendentes (Diretoria)",
        "sticker": { "icone": "fa-solid fa-stamp", "cor": "#D4860B" }
      }
    }
  }
}
```

---

## 3. Ciclo de Vida do Estudo

```
                    ┌──────────────┐
                    │   Rascunho   │ ← estado inicial
                    └──────┬───────┘
                           │ editor submete
                    ┌──────▼───────┐
                    │  Em análise  │ ← simulações e relatórios disponíveis
                    └──────┬───────┘
                     ╱     │     ╲
          aprovador /      │      \ aprovador
        ┌──────────▼┐      │    ┌──▼─────────┐
        │  Aprovado  │      │    │  Reprovado  │
        └────────────┘      │    └─────────────┘
                           │
                    aprovador devolve
                    ┌──────▼───────┐
                    │   Rascunho   │ (volta com informações adicionais)
                    └──────────────┘
```

**Arquivamento automático:** Estudos parados em qualquer status (exceto Aprovado) por 30 dias → status "Arquivado". Pode ser reaberto por aprovador.

**Imóveis vinculados:** seleção editável apenas em Rascunho. A partir de Em análise, o imóvel fica travado — essa restrição é absoluta, mesmo para aprovadores.

---

## 4. Entidades e Modelo de Dados

### 4.1 Imóveis (via Núcleo)

Duas modalidades de origem do terreno:

**Modo "Buscar terreno" (origem = nucleo):** O app consome dados diretamente do Núcleo. O único dado consumido é a **área** do imóvel (e nome para exibição). Todos os demais parâmetros (coeficientes, áreas dedutíveis, etc.) são inputs do estudo. Imóveis não cadastrados devem ser criados no Núcleo primeiro.

**Modo "Inserir novo" (origem = manual):** O app permite que o usuário insira nome e área do terreno diretamente no estudo, sem vínculo com o Núcleo. O campo de conexão com lote/gleba fica vazio. Os dados são registrados em campos próprios do estudo (`terreno_manual_nome`, `terreno_manual_area`).

**Dados consumidos do Núcleo (quando origem = nucleo):**

Para ambos os tipos, o Núcleo provê apenas a **área total do terreno** (gleba ou lote). Todo o resto (áreas dedutíveis, coeficientes, etc.) é registrado no estudo — são inputs que variam por estudo e não são características inatas do imóvel.

*Nota: Coeficientes de aproveitamento e gabarito máximo são registrados no estudo (não existem no Núcleo atualmente). Se futuramente o Núcleo implementar esses campos, o app poderá pré-preencher a partir de lá.*

**Filtragem de imóveis no seletor:**
- **Loteamento → mostra glebas**, excluindo a Fazenda Paranoazinho (gleba-mãe cadastrada).
- **Incorporação → mostra lotes**, excluindo lotes contidos em Parcelamentos.

A lógica de exclusão usa dados já existentes no Núcleo (relação lote→parcelamento já existente). Não requer nova coluna de classificação.

**Enquanto o filtro de exclusão não estiver implementado:** O seletor mostra todos os imóveis do subtipo correto (todos glebas ou todos lotes). O filtro de exclusão pode ser adicionado progressivamente.

Dados do imóvel aparecem em **modo leitura** no estudo. O que pode ser alterado é a **seleção** de qual imóvel está vinculado (apenas em Rascunho).

### 4.2 Estudos

Registro central. Cada estudo tem:
- **Identificador humano (id_legivel):** composto por tipo (sigla) + nome do estudo + estado (UF) + sequência numérica. Exemplo: `INC - Pátio Urbitá 1 - DF - 002`. Na base de dados: `inc_patiourbita1_df_002` (sem espaços nem caracteres especiais). Este é o campo de identificação única principal, visível ao usuário em todas as telas.
- Tipo de empreendimento: `loteamento` | `incorporacao`
- Nível de análise: `preliminar` (MVP) | `avançado` (v2)
- Status: `rascunho` | `em_analise` | `aprovado` | `reprovado` | `arquivado`
- Relação com imóveis: Loteamento → 1 gleba (single-select); Incorporação → 1+ lotes (multiple-select)
- Membros com funções (leitor/editor/aprovador)
- Autor, datas

### 4.3 Relação Imóvel ↔ Estudo

- **Loteamento:** exatamente 1 gleba por estudo (single-select no seletor)
- **Incorporação:** 1 ou mais lotes por estudo (multiple-select no seletor)
- Mesmo imóvel pode participar de múltiplos estudos simultâneos
- No dashboard, cada estudo mostra os imóveis associados
- Na tela de imóveis, cada imóvel mostra em quantos e quais estudos é usado
- Área total do terreno: se múltiplos lotes selecionados, soma das áreas individuais (vindas do Núcleo)

### 4.4 Estrutura de Custos e Receitas

**Regras de precisão decimal:**
- Campos monetários (R$) e de área (m²): **2 casas decimais**
- Percentuais digitados pelo usuário ou com valor default: **sem casas decimais** (inteiro)
- Percentuais resultantes de cálculo/fórmula: **1 casa decimal**

#### Receita

- **Receita bruta (VGV):**
  - Loteamento: área vendável líquida × preço/m²
  - Incorporação: (área PVT R Fechada × preço/m² residencial) + (área PVT NR Fechada × preço/m² não residencial)

*Nota: Para VGV e áreas de venda, usam-se as **Áreas Fechadas** (PVT R Fechada e PVT NR Fechada), não as áreas totais.*

#### Deduções da Receita

- **Imposto:** imposto_percentual × VGV
  - **Mecanismo RET:** checkbox "Sujeito a RET". Se marcado → alíquota fixa 4%. Se desmarcado → campo editável com default 6,73%.
- **Corretagem:** corretagem_percentual (default −5%) × valor dos contratos (a valor presente)
- **Marketing:** marketing_percentual (default −1%) × VGV
- **Permuta financeira residencial:** permuta_financeira_residencial_pct × VGV residencial
- **Permuta financeira não residencial:** permuta_financeira_nao_residencial_pct × VGV não residencial

**Receita líquida** = VGV − imposto − corretagem − marketing − permutas financeiras

#### Custos Diretos

| Categoria | Fórmula | Loteamento | Incorporação |
|---|---|:-:|:-:|
| Terreno | custo_terreno_por_m² × área privativa | ✓ | ✓ |
| Projetos e aprovação | projetos_pct (default 1,6%) × custo total de construção | ✓ | ✓ |
| Infraestrutura | custo_infra_m2 × area_vendavel OU infra_pct (default 30%) × VGV (toggle) | ✓ | ✗ |
| Outorga | (valor_venal_terreno_m² ÷ coef_basico) × área_terreno × (coef_maximo − coef_basico) × 20% | ✗ | ✓ |
| Incorporação e registro | incorporacao_registro_pct (default 0,25%) × VGV | ✗ | ✓ |
| Construção | custo_construcao_m² (default 4.800) × área privativa | ✓ | ✓ |
| Gestão da construção | taxa_gestao (default 6%) × custo total de construção | ✓ | ✓ |
| Decoração | custo_decoracao_m² (default 150) × área privativa | ✗ | ✓ |
| Manutenção pós-obra | manutencao_pct (default 1%) × VGV | ✓ | ✓ |
| Contingências | contingencias_pct (default 0%) × VGV | ✓ | ✓ |

**Custo direto total** = soma de todos os custos diretos acima

**Infraestrutura (Loteamento):** Valor único, resultado de uma das duas fórmulas. O toggle alterna entre:
- **Modo A:** custo_infra_m² × área_vendavel (R$/m² de área vendável)
- **Modo B:** infra_pct × VGV (% do VGV, default 30%)
Ambos os modos produzem um valor em R$. Não há subcategorias (terraplenagem, pavimentação, etc.) — é um valor consolidado.

**Custo do terreno — checkbox "considerar":** O campo de preço de aquisição do terreno (R$/m²) tem um checkbox ao lado. Se desmarcado, custo do terreno = 0 em todo o estudo (independente do valor digitado). Isso permite simular cenários com e sem aquisição de terreno.

**Defaults:** Todos os valores default (30% infra, 25% viário, 6,73% impostos, etc.) são pré-preenchidos mas **sempre editáveis** pelo usuário. O estudo começa com esses valores que já influenciam todas as fórmulas, mas podem ser alterados a qualquer momento.

#### Custos Indiretos

| Categoria | Fórmula | Loteamento | Incorporação |
|---|---|:-:|:-:|
| Marketing global, stand e estrutura de vendas | marketing_global_pct (default 1%) × VGV | ✓ (opcional) | ✓ |
| Gestão e outros custos indiretos | gestao_indiretos_pct (default 1,25%) × VGV | ✓ | ✓ |

**Custo indireto total** = soma dos custos indiretos

**Stand de vendas (Loteamento):** campo opcional. Quando presente, incluso na categoria "Marketing global, stand e estrutura de vendas". Quando zero, a categoria reflete apenas os demais itens.

#### Modos de Entrada Alternativos (toggle por categoria)

| Categoria | Modo A | Modo B |
|-----------|--------|--------|
| Infraestrutura (Loteamento) | R$/m² (de área vendável) | % VGV (default 30%) |
| Projetos | R$ (fixo) | % VGV |
| Licenciamento e custos ambientais | R$ (fixo) | % VGV |
| Permuta física | m² (área a permutar) | % da área total de venda |

Cada categoria tem um toggle com dois botões acima da caixa de registro. O estudo já vem com um modo padrão selecionado e o usuário pode alternar. O resultado final é sempre em R$ — o toggle muda apenas a forma de entrada.

#### Resultado

- **Resultado** = receita líquida − custos diretos − custos indiretos
- **Resultado + permutas financeiras** = resultado + permuta financeira residencial + permuta financeira não residencial
- **Resultado + permutas (com físicas)** = resultado + permutas financeiras + valor das permutas físicas
- **Margem líquida (%)** = resultado final / VGV × 100

### 4.5 Framework de Áreas

#### Loteamento

```
Área Bruta da Gleba                      ← vem do Núcleo (campo `area`)
  (-) APP                                ← input do estudo (% da gleba)
  (-) Faixas não edificáveis             ← input do estudo (% da gleba)
= Área Aproveitável

  (-) Sistema Viário                     ← input do estudo (% da gleba, default 25%, editável)
  (-) ELUP (Equipamento Local de Uso Público)  ← input do estudo (% da gleba)
  (-) EPC (Equipamento Público Comunitário)    ← input do estudo (% da gleba)
  (-) EPU (Espaço Público de Uso)              ← input do estudo (% da gleba)
  (-) Áreas privativas não vendáveis           ← input do estudo (% da gleba)
= Área de Lotes Privados (= Área Vendável)

  (-) Permutas físicas (m² ou % da Área de Lotes Privados)
= Área Vendável Líquida (usada no VGV)
```

**Regra de áreas (Loteamento):** Todos os campos de área (exceto Área Bruta da Gleba, que vem do Núcleo) são **inputs manuais** no estudo, preenchidos como **percentual sobre a área da gleba**. O valor em m² é calculado automaticamente. Todos os defaults são editáveis.

**Unidade de venda em Loteamento:** O campo relevante é a **área média das unidades vendidas** (m²/lote). Não há cadastro individual de lotes no MVP.

#### Incorporação

**Campos de área do estudo — nomenclatura oficial:**

| Abreviação | Campo completo | Descrição |
|---|---|---|
| Área PVT R Aberta | Área Privativa Residencial Aberta | Varandas, terraços residenciais |
| Área PVT R Fechada | Área Privativa Residencial Fechada | Área interna das unidades residenciais |
| Área PVT NR Aberta | Área Privativa Não Residencial Aberta | Varandas, terraços comerciais |
| Área PVT NR Fechada | Área Privativa Não Residencial Fechada | Área interna das unidades comerciais |
| Área Comum Total | — | Circulação, lazer, hall, etc. |
| Área Construída Total | — | Soma de todas as áreas construídas |
| Área Computável Total | — | Área que conta no coeficiente de aproveitamento |
| Área Equivalente Total | — | Áreas reais ponderadas por coeficientes de custo |
| Área Privativa Total | — | Soma de todas as áreas privativas (PVT R + PVT NR, abertas + fechadas) |
| Eficiência (%) | Área Privativa / Área Construída | Ratio de eficiência |

**Para VGV e áreas de venda:** usam-se as **Áreas Fechadas** (PVT R Fechada e PVT NR Fechada). Áreas abertas não entram no cálculo de VGV.

**Estrutura de áreas:**

```
Área do Terreno                          ← vem do Núcleo
  (×) Coeficiente de Aproveitamento (Básico/Máximo)  ← input do estudo
= Potencial Construtivo

  (-) Áreas não computáveis              ← input do estudo
= Área Computável Utilizada

Área Construída Total = Área privativa + Área comum + Garagem + demais

Área Privativa Vendável = PVT R Fechada + PVT NR Fechada

Área Comercializável Total = Área privativa vendável + vagas/deps/lojas/acessórios vendáveis

Área Equivalente de Construção = Áreas reais ponderadas por coeficientes de custo
```

**Coeficientes e gabarito:** São inputs do estudo (não vêm do Núcleo no MVP). Campos: coeficiente de aproveitamento básico, coeficiente de aproveitamento máximo (default: 3), gabarito máximo. Quando múltiplos lotes são selecionados, o coeficiente se aplica à **área total combinada** dos lotes como se fosse um único terreno. Todos editáveis.

**Unidades (MVP):** As unidades trabalhadas neste app (resultado de loteamento ou incorporação) **não têm conexão** com o objeto Unidade do Núcleo. A unidade aqui é parte do estudo — pode mudar sempre que novos estudos são criados, mesmo sobre o mesmo lote/gleba. A conexão com Unidades do Núcleo é escopo de v2.

### 4.6 Benchmarks

Objeto do app (não do Núcleo). **Registro geral definido pelo usuário admin, servindo como base para todos os estudos.** Cada tipo de empreendimento (Loteamento, Incorporação) tem seu próprio conjunto de benchmarks. Dois propósitos:

**1. Validação de indicadores:** Cada benchmark define um valor-alvo para um campo do estudo, com uma regra de comparação:
- Campos de resultado/margem → estudo deve **atingir ou superar** o benchmark (ex: Resultado final ≥ 25%)
- Campos de custo/percentual → estudo **não pode exceder** o benchmark (ex: Custo Obras / VGV ≤ 35%)

Quando o valor do estudo não atinge o benchmark, o campo é sinalizado visualmente com aviso. Nos KPI grids: verde (benchmark atingido), vermelho (não atingido).

**2. Faixas de sensibilidade:** Cada benchmark pode incluir variação positiva (%) e variação negativa (%) sobre o valor base. Essas faixas são o **default** e alimentam a análise de sensibilidade (Bear/Base/Bull Case). **Percentuais de sensibilidade podem ser sobrescritos por estudo** — o estudo pode definir faixas próprias que prevalecem sobre o benchmark.

**3. Piso de viabilidade (Preço Sugerido/m²):** O benchmark de "Resultado final (%)" define o piso de retorno. O app calcula automaticamente qual preço de venda/m² atinge esse piso a partir das premissas já preenchidas no estudo. Esse **preço sugerido/m²** aparece no resumo de Premissas.

**Indicadores com benchmark (MVP):**
- Margem bruta (%) = (Receita operacional / VGV) × 100
- Margem líquida (%) = (Resultado final / VGV) × 100
- ROI (%) = (Resultado final / Investimento Total) × 100
- Relação Custo Obras / VGV (%)
- Eficiência de aproveitamento (área vendável / área da gleba %) — apenas Loteamento
- Resultado final (%) — **piso para cálculo do preço sugerido/m²**

**Indicadores com benchmark (v2+):**
- ROE (%) = (Resultado final / Capital Próprio Investido) × 100 — requer campos de aportes de terceiros
- TIR e TIRM (%) — dependem de fluxo financeiro no tempo
- TMA (%) = SELIC + Prêmio de risco — referência que TIR/TIRM devem superar
- VPL — depende de fluxo financeiro no tempo
- Payback e Payback descontado — cenário de locação

*Nota: Valores-alvo são definidos pelo usuário admin em uma etapa inicial do app, diferenciados por Loteamento e Incorporação. Servem como base para todos os estudos e podem ser alterados a qualquer momento.*

---

## 5. Telas do MVP

### 5.0 Fluxo de Navegação

```
Dashboard (Início)
  ├── [Criar Estudo] → Estudo (Detalhe) — novo, status Rascunho
  ├── [Clique na linha] → Estudo (Detalhe) — existente
  └── [Aba Terrenos] → Imóveis (via Núcleo)

Estudo (Detalhe)
  ├── Aba Premissas — formulário de entrada
  ├── Aba Proforma — cálculos, sensibilidade, comparação, exportação
  └── Aba Gráficos — visualizações

Imóveis (via Núcleo)
  └── [Clique na linha] → detalhe do imóvel (mostra estudos vinculados)
```

O Dashboard é a tela raiz com abas/guias para Estudos e Terrenos. O detalhe do Estudo é a principal tela de trabalho.

### 5.1 Dashboard (Início)

Tela principal do app. Permite escolher entre criar **Estudo Preliminar** e **Estudo Avançado** (este bloqueado/desabilitado até v2).

Tabela de estudos com colunas:
- Nome do estudo (id_legivel — ex: "INC - Pátio Urbitá 1 - DF - 002")
- Tipo (Loteamento / Incorporação)
- Imóvel(is) — campo multiple-select com badges dos imóveis associados
- Área do imóvel (soma se múltiplos)
- Área de venda total
- VGV
- Resultado
- Margem
- Status (badge colorido)
- Data de criação

Filtros: tipo_empreendimento, status. Ações: criar, duplicar, remover.

### 5.2 Estudo (Detalhe)

**Três abas:**

#### Aba Premissas

**Formulário de entrada — conteúdo:**
- **Terreno:** conforme a origem escolhida na criação:
  - *Buscar terreno:* seleção de gleba (Loteamento, single-select) ou lote(s) (Incorporação, multiple-select) via dropdown. Área do imóvel em modo leitura (vem do Núcleo).
  - *Inserir novo:* campos editáveis para nome do terreno e área (m²). Sem dropdown de imóveis.
- **Produto:** tipologia, áreas (PVT R/NR Aberta/Fechada para Inc; % da gleba para Lot), preços por m²
- **Custos:** categorias com toggle de modo de entrada (ver seção 4.4), com checkbox de terreno
- **Impostos:** checkbox RET (se marcado: 4% fixo; se desmarcado: campo editável com default 6,73%)

**Resumo ao final: KPI grid auto fit** (`urbi-kpi` em `urbi-wrap`). Aparece embaixo do formulário e atualiza em tempo real conforme dados são preenchidos.

Itens do grid para **Loteamento**:
- Área da gleba (m²)
- Área de sistema viário (m²)
- Área pública/verdes (m²)
- Área vendável (m²)
- Relação área vendável / área da gleba (%) — **com benchmark** (medida de eficiência)
- VGV estimado (R$)

Itens para **Incorporação**:
- Área Privativa Total (m²)
- Área construída total (m²)
- Nº de unidades
- Preço médio por unidade (R$)
- Relação custo obras / VGV (%)
- Margem líquida (%)

**Preço sugerido/m²:** Ao final do formulário (acima ou junto do KPI), texto informativo com o preço mínimo de venda por m² para atingir o piso de resultado final definido no benchmark. Calculado automaticamente a partir das premissas já preenchidas.

#### Aba Proforma

**Topo: KPI grid auto fit** com métricas de viabilidade:
- Área vendável (m²)
- Preço médio da unidade (R$)
- Nº de unidades
- Área permutada (m²) ou valor permutado (R$) — **condicional:** só aparece se permutas > 0
- Relação custo obras / VGV (%) — **com benchmark** (cor verde/vermelho)
- Margem líquida (%) — **com benchmark** (cor verde/vermelho) — mesmo valor da última linha do Proforma

**Conteúdo:**
- Proforma gerado automaticamente a partir dos inputs. Cálculos no frontend em tempo real. Linhas e fórmulas conforme seção 6.2.
- Resultados salvos por ação explícita do usuário (botão "Salvar").
- Comparação de cenários (ver abaixo)
- Análise de sensibilidade (ver abaixo)
- **Botões de exportação** (Excel e PDF) ficam dentro desta aba.

#### Aba Gráficos

Visualizações gráficas do estudo usando componentes do framework de UI do UrbiVerso.

**MVP — dois gráficos (independente do tipo de estudo):**
1. **Gráfico de pizza** (`urbi-grafico-pizza`): Composição total dos custos dentro do estudo. **Flag para excluir custo de aquisição de terreno** da visualização (checkbox ou toggle no gráfico).
2. **Gráfico de barras** (`urbi-grafico-colunas`): 2 séries em um único ponto — total de receita e total de custos, consolidados em uma barra cada

v2: mais gráficos serão adicionados a esta aba.

#### Editabilidade por perfil

- Editor (criador): edita todos os campos, exceto quando status é Aprovado ou Reprovado
- Aprovador (Diretoria): edita qualquer campo a qualquer momento (exceto alterar imóvel vinculado fora de Rascunho)
- Demais: campos aparecem bloqueados/indisponíveis (seguir spec de UI do UrbiVerso — campos de texto, dropdown, single-select etc. demarcados como bloqueados)

#### Comparação de Cenários (dentro da aba Proforma)

Seção ao final da aba Proforma. Mecanismo:
1. Usuário preenche/edita dados do estudo
2. Clica "Salvar cenário" → snapshot da Proforma atual é salvo em memória (transiente, não persiste no BD)
3. Edita parâmetros e salva segundo cenário
4. Dois cenários aparecem lado a lado
5. Terceira coluna à direita mostra variação percentual do cenário 2 em relação ao cenário 1
6. Exportável: botão "Exportar comparação" gera Excel/PDF com os dois cenários + variação. Sempre limitado a dois cenários.

Se o usuário quiser persistir: salva o estudo (BD) ou exporta (Excel/PDF). Cenários transientes se perdem ao fechar a página.

#### Análise de Sensibilidade (dentro da aba Proforma)

Nomenclatura própria:
- **Bear Case** (cenário pessimista)
- **Base Case** (cenário base = valores registrados no estudo)
- **Bull Case** (cenário otimista)

**Campos de sensibilidade (MVP):**
- Preço por m² de venda (Incorporação tem 2 campos: residencial e não residencial)
- Permuta física (m²)
- Permuta financeira (R$)
- Custo de infraestrutura (apenas Loteamento)
- Custo de obras (apenas Incorporação)

Mecanismo:
- Usuário escolhe qual premissa estressar dentre os campos acima
- Faixas de variação (%) para cima e para baixo vêm do **benchmark** como default, mas podem ser **sobrescritas por estudo**
- Valor base = valor registrado no estudo
- Bull Case = base × (1 + variação positiva)
- Bear Case = base × (1 - variação negativa)
- No MVP, análise **unidimensional**: uma variável por vez
- v2: análise multidimensional (variar múltiplos parâmetros simultaneamente)

Visualização: botão que exibe/esconde a análise abaixo do Proforma. Tabela com 3 colunas (Bear Case | Base Case | Bull Case). Linhas = itens principais de receitas e custos do Proforma afetados pela variável estressada.

Exportável: botão "Exportar análise de sensibilidade" gera Excel/PDF.

### 5.3 Imóveis (via Núcleo)

Visualização filtrada dos imóveis do Núcleo relevantes para viabilidade. Cada imóvel mostra:
- Dados do imóvel (vindos do Núcleo — nome, área)
- Em quantos e quais estudos está sendo usado
- Acesso ao detalhe

Filtro por subtipo (glebas para loteamento, lotes para incorporação).

---

## 6. Implementação no UrbiVerso

### 6.1 Framework de Dados (schema.json)

**Regras de precisão decimal para todo o schema:**
- Campos monetários (R$): `decimal`, precisão 12, escala 2
- Campos de área (m²): `decimal`, precisão 12, escala 2
- Percentuais digitados/default: `inteiro` (sem decimais)
- Percentuais calculados: `decimal`, precisão 5, escala 1

**Tabela `estudos`:**
- id_legivel (texto, unico — ex: "inc_patiourbita1_df_002")
- nome_exibicao (texto — ex: "INC - Pátio Urbitá 1 - DF - 002")
- nome (texto — nome livre dado pelo usuário, ex: "Pátio Urbitá 1")
- tipo_empreendimento (texto, opções: loteamento/incorporacao)
- uf (texto, limite 2 — estado da federação)
- nivel_analise (texto, opções: preliminar/avançado)
- status (texto, opções: rascunho/em_analise/aprovado/reprovado/arquivado)
- autor_id (referência shell.usuarios, campos_incluir: ["nome as autor_nome"])
- origem_terreno (texto, opções: nucleo/manual — escolha na criação do estudo)
- terreno_manual_nome (texto — preenchido apenas quando origem = manual)
- terreno_manual_area (decimal, precisão 12, escala 2 — área em m², preenchido apenas quando origem = manual)
- notas (texto_longo)
- sujeito_ret (booleano, default false)
- imposto_percentual (inteiro, default 7 — sem decimais para %)
- considerar_custo_terreno (booleano, default true)
- Campos numéricos de produto, custos e áreas — todos seguindo as regras de precisão acima
- sensibilidade_variacao_positiva_pct (inteiro) — override por estudo (null = usa benchmark)
- sensibilidade_variacao_negativa_pct (inteiro) — override por estudo (null = usa benchmark)

*id_legivel:* template para id_legivel no schema: `"{tipo_empreendimento_sigla} - {nome} - {uf} - {sequencia}"`. A sequência é numérica e incrementa por tipo_empreendimento.

**Tabela `estudo_imoveis`:** (junção N:M)
- estudo_id (referência estudos)
- imovel_nucleo_id (inteiro — referência lógica ao supertipo `imoveis` do Núcleo)
- tipo_imovel (texto — 'gleba' ou 'lote', para validação de consistência com tipo_empreendimento)
- Único composto: `[["estudo_id", "imovel_nucleo_id"]]`

**Tabela `estudo_membros`:** (permissões por estudo)
- estudo_id (referência estudos)
- usuario_id (referência shell.usuarios, campos_incluir: ["nome as usuario_nome"])
- funcao (texto, opções: leitor/editor/aprovador)
- Único composto: `[["estudo_id", "usuario_id"]]`

**Tabela `benchmarks`:**
- tipo_empreendimento (texto, opções: loteamento/incorporacao)
- campo (texto — identificador do indicador)
- valor (decimal, precisão 10, escala 2)
- regra_comparacao (texto, opções: atingir_ou_superar/nao_exceder)
- variacao_positiva_pct (inteiro)
- variacao_negativa_pct (inteiro)
- Único composto: `[["tipo_empreendimento", "campo"]]`
- acesso_externo: "restrito" — edição apenas por rotas customizadas (apenas admin)

**Tabela `apelo_comercial`:**
- estudo_id (referência estudos)
- resultado (json — 6 fatores com notas e justificativas + relatório geral)
- score_localizacao (decimal, precisão 3, escala 1 — média das 4 notas do fator)
- score_infraestrutura (decimal, precisão 3, escala 1)
- score_vetor_crescimento (decimal, precisão 3, escala 1)
- score_concorrencia (decimal, precisão 3, escala 1)
- score_demanda (decimal, precisão 3, escala 1)
- score_seguranca_juridica (decimal, precisão 3, escala 1)
- score_geral (decimal, precisão 3, escala 1 — média geral das 24 notas)

**Tabela `apelo_comercial_documentos`:**
- apelo_id (referência apelo_comercial)
- documento (arquivo — PDF, Word, Excel; mimes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])
- tipo_dado (texto — ex: 'anuncios', 'populacao', 'mercado')
- texto_adicional (texto_longo — campo de texto para dados como população)

### 6.2 Proforma — Linhas e Fórmulas

Referência completa das linhas do Proforma e seus cálculos. Todas as fórmulas rodam no **frontend** em tempo real. Backend persiste apenas os inputs.

#### Receita

| Linha | Fórmula |
|---|---|
| Receita bruta (VGV) | area_vendavel × preco_venda_m2 (Loteamento) OU (area_pvt_r_fechada × preco_res) + (area_pvt_nr_fechada × preco_nao_res) (Incorporação) |

#### Deduções da Receita

| Linha | Fórmula | Default |
|---|---|---|
| Imposto | imposto_pct × VGV | 4% (RET) ou 7% |
| Corretagem | corretagem_pct × valor contratos (valor presente) | 5% |
| Marketing | marketing_pct × VGV | 1% |
| Permuta financeira residencial | permuta_fin_res_pct × VGV residencial | — |
| Permuta financeira não residencial | permuta_fin_nao_res_pct × VGV não residencial | — |
| **Receita líquida** | VGV − imposto − corretagem − marketing − permutas financeiras | — |

#### Custos Diretos

| Linha | Fórmula | Default | Exclusivo |
|---|---|---|---|
| Terreno | custo_terreno_m2 × area_privativa (× checkbox "considerar") | — | — |
| Projetos e aprovação | projetos_pct × custo_total_construcao | 2% | — |
| Infraestrutura | custo_infra_m2 × area_vendavel OU infra_pct × VGV (toggle) | 30% (modo %) | Lot |
| Outorga | (venal_m2 ÷ coef_basico) × area_terreno × (coef_max − coef_basico) × 20% | — | Inc |
| Incorporação e registro | inc_registro_pct × VGV | 0% | Inc |
| Construção | custo_construcao_m2 × area_privativa | 4.800 | — |
| Gestão da construção | taxa_gestao × custo_total_construcao | 6% | — |
| Decoração | custo_decoracao_m2 × area_privativa | 150 | Inc |
| Manutenção pós-obra | manutencao_pct × VGV | 1% | — |
| Contingências | contingencias_pct × VGV | 0% | — |
| **Custo direto total** | Σ custos diretos | — | — |

#### Custos Indiretos

| Linha | Fórmula | Default |
|---|---|---|
| Marketing global, stand e estrutura de vendas | marketing_global_pct × VGV | 1% |
| Gestão e outros custos indiretos | gestao_indiretos_pct × VGV | 1% |
| **Custo indireto total** | Σ custos indiretos | — |

#### Resultado

| Linha | Fórmula |
|---|---|
| Resultado | receita_liquida − custo_direto_total − custo_indireto_total |
| Resultado + permutas financeiras | resultado + permuta_fin_res + permuta_fin_nao_res |
| Resultado + permutas (com físicas) | resultado_com_permutas_fin + valor_permutas_fisicas |
| Margem líquida (%) | resultado_final / VGV × 100 |

### 6.3 Exportação

Relatórios exportáveis em PDF e Excel a partir do status "Em análise":
- **Estudo completo:** resumo de tudo na tela (Premissas + Proforma + indicadores)
- **Comparação de cenários:** dois cenários lado a lado + variação
- **Análise de sensibilidade:** tabela Bear/Base/Bull Case

Botões de exportação ficam na aba Proforma.

**Layout de referência:** Usar como inspiração o modelo de simulador de investimento imobiliário fornecido (imagem em "Versão pré-existente"). Estrutura limpa com seções bem demarcadas, dados organizados em blocos, formatação profissional. O modelo já está bem completo e serve como referência direta.

v2: gráficos, fluxo de caixa, indicadores financeiros avançados nos relatórios.

### 6.4 Componentes de UI

O app utiliza componentes existentes do framework de UI do UrbiVerso:

| Componente | Uso |
|---|---|
| `urbi-abas` | Container de abas (Premissas / Proforma / Gráficos). Deve preservar DOM ao trocar aba (não destruir/recriar) para manter estado transiente da comparação de cenários. |
| `urbi-kpi` + `urbi-wrap` | KPI grid auto fit no final de Premissas e no topo de Proforma |
| `urbi-tabela` | Dashboard de estudos, tabela do Proforma, tabela de sensibilidade |
| `urbi-grafico-pizza` | Composição de custos (aba Gráficos) |
| `urbi-grafico-colunas` | Receita vs. Custos (aba Gráficos) |
| `urbi-badge` | Status dos estudos, badges de imóveis |
| `urbi-input`, `urbi-input-numero` | Campos de entrada |
| `urbi-botao` | Ações (salvar, exportar, submeter). Toggle de modo de entrada: dois `urbi-botao variante="texto"` agrupados. |
| `urbi-banner` | Avisos de benchmark não atingido |
| `urbi-card` | Dados do imóvel em modo leitura |

### 6.5 Config da App (parâmetros)

Candidatos a parâmetros configuráveis pelo admin:
- Alíquotas de impostos padrão (default não-RET: 7%)
- Alíquota RET (default: 4%)
- Percentuais de despesas comerciais padrão
- Taxas de corretagem padrão (default: 5%)
- Percentuais padrão para custos indiretos
- Prazo de arquivamento automático (default: 30 dias)

### 6.6 Dependências do Núcleo

```json
{
  "dependencias_nucleo": ["imoveis"],
  "permissoes_nucleo": {
    "imoveis": ["ler"]
  }
}
```

O app consome glebas e lotes via endpoints do Núcleo:
- `GET /api/{appId}/nucleo/glebas` — listar glebas (excluindo Fazenda Paranoazinho)
- `GET /api/{appId}/nucleo/lotes` — listar lotes (excluindo lotes contidos em Parcelamentos)
- `GET /api/{appId}/nucleo/imoveis/:id` — detalhe do imóvel selecionado

**Filtro excludente (decisão confirmada):**
- Lotes contidos em Parcelamento (relação já existente no Núcleo) são excluídos
- Gleba "Fazenda Paranoazinho" é excluída por ID específico
- Todo o restante é selecionável

### 6.7 IA — Apelo Comercial do Imóvel

O app utiliza o framework de IA do UrbiVerso para gerar uma análise automatizada de **Apelo Comercial do Imóvel**, avaliando fatores qualitativos que não são capturados por fórmulas financeiras.

**Fatores avaliados (MVP) — 6 fatores:**

| # | Fator | Tipo |
|---|---|---|
| 1 | Localização | Inerente ao terreno |
| 2 | Infraestrutura no Entorno | Inerente ao terreno |
| 3 | Vetor de Crescimento | Inerente ao terreno |
| 4 | Concorrência | Misto |
| 5 | Demanda Estrutural | Misto |
| 6 | Segurança Jurídica e Regulatória | Inerente ao terreno |

**Perguntas-guia por fator** (incluídas no prompt da IA):

**Localização:**
- Nível de acessibilidade da região aos principais polos de emprego, comércio e serviços
- Existência de barreiras físicas/geográficas que limitem integração com a cidade
- Percepção positiva da região pelo mercado imobiliário
- Histórico de valorização imobiliária comparado com regiões concorrentes

**Infraestrutura no Entorno:**
- Oferta adequada de água, esgoto, energia e telecomunicações
- Infraestrutura viária suficiente para o crescimento previsto
- Disponibilidade de equipamentos públicos e áreas de lazer
- Investimentos públicos/privados anunciados para infraestrutura local

**Vetor de Crescimento:**
- Evidências de expansão urbana na direção da área
- Volume recente de novos empreendimentos lançados/aprovados na região
- Tendência de crescimento populacional
- Migração de moradores, empresas ou atividades econômicas para a área

**Concorrência:**
- Volume de estoque imobiliário concorrente disponível
- Velocidade de vendas nos empreendimentos concorrentes
- Adequação dos produtos concorrentes à demanda local (lacunas de mercado)
- Diferenciais competitivos do empreendimento proposto frente à oferta existente

**Demanda Estrutural:**
- Tendência de geração de empregos e renda na região
- Déficit habitacional ou insuficiência de oferta imobiliária
- Atração de população de outras localidades
- Compatibilidade dos indicadores socioeconômicos com o produto pretendido

**Segurança Jurídica e Regulatória:**
- Zoneamento e normas urbanísticas permitem tipo/densidade do empreendimento
- Passivos ambientais, restrições ecológicas ou exigências de licenciamento
- Segurança jurídica da situação fundiária/documental
- Riscos regulatórios, políticos ou institucionais

**Abordagem de avaliação:** A IA deve analisar todas as evidências disponíveis nos documentos e atribuir notas de 1 a 5 para cada pergunta. A avaliação é **comparativa e contextual**, levando em conta mercado local, tendências, riscos e oportunidades. Não segue critérios numéricos rígidos. Nota 1 = cenário muito desfavorável; Nota 5 = cenário muito favorável para desenvolvimento imobiliário. Justificativa breve dos principais fatores que influenciaram cada nota.

**Scoring:**
- **Score por fator:** Média simples das 4 notas de cada fator. Armazenado como coluna individual na tabela `apelo_comercial` (score_localizacao, score_infraestrutura, etc.).
- **Score geral:** Média geral de todas as 24 notas (6 fatores × 4 perguntas). Armazenado como `score_geral`.
- Ambos servem para comparação rápida entre estudos e para visualização no dashboard.

**Output da IA por fator:**
- Nota de 1 a 5 (5 = mais favorável) para cada pergunta. Se dados insuficientes → campo vazio / "impossível avaliar"
- Justificativa sintética (texto explicando a nota de cada pergunta)
- Nota consolidada do fator (média das 4 perguntas)

**Output geral:**
- Relatório listando vantagens e desvantagens do produto na região
- Principais ganhos e riscos ao prosseguir com o projeto

**Fontes de dados (MVP):**
- Arquivos enviados pelo usuário: **documentos** (PDF, Word) e **planilhas** (Excel)
- Campo de texto separado para dados como população do município/bairro
- ⚠️ **Sem links/URLs no MVP.** Apenas uploads de arquivos e texto.
- ⚠️ Busca na web NÃO é nativa do framework de IA do UrbiVerso. Para v2.

**Dados esperados nos documentos enviados:**

| Dado | Loteamento | Incorporação |
|---|:-:|:-:|
| Localização (até nível de bairro) | ✓ | ✓ |
| Área do lote | ✓ | — |
| Faixa de áreas das unidades (construída, privativa) | — | ✓ |
| Tipologia (dormitórios, banheiros, garagem) | — | ✓ |
| Preço médio da unidade e preço por m² | ✓ | ✓ |
| População do município e do bairro | ✓ | ✓ |
| Nº de anúncios nos últimos 180 dias | ✓ | ✓ |
| Nº de anúncios nos últimos 365 dias | ✓ | ✓ |

O formato mais comum será tabela de anúncios com colunas dos parâmetros acima. Dados de população podem vir de campo de texto separado.

**Implementação técnica:**
- Manifesto: `"ia": true`
- Slots usados: `arquivos` (extração de PDFs/Excel), `normal` (análise e classificação)
- Documentos processados via `req.ia.extrairConteudo()`, análise via `req.ia.consultar()` com schema JSON estruturado
- Schema JSON de resposta:
```json
{
  "fatores": [
    {
      "nome": "Localização",
      "perguntas": [
        { "pergunta": "...", "nota": 4, "justificativa": "..." }
      ],
      "nota_consolidada": 4,
      "justificativa_geral": "..."
    }
  ],
  "relatorio": {
    "vantagens": ["..."],
    "desvantagens": ["..."],
    "ganhos": ["..."],
    "riscos": ["..."]
  }
}
```
- Os resultados são salvos no estudo (tabela `apelo_comercial`, campo JSON `resultado` + colunas de score individuais)
- Prompt contextualizado por tipo de empreendimento, com as perguntas-guia e abordagem comparativa/contextual

### 6.8 Rotas e API

**Decisão: rotas customizadas** para todas as operações de negócio do app. A API genérica de dados não é adequada porque:
- Estudos têm permissão por membership (4ª camada) — a API genérica só conhece nível de app
- Benchmarks são editáveis apenas por admin — precisam de rota restrita
- Transições de status têm regras de negócio (quem pode avançar, devolver, aprovar)
- Cálculos de Preço Sugerido e validação de benchmark requerem lógica de backend

**Rotas customizadas previstas:**
- `GET/POST /api/{appId}/estudos` — listar (filtrado por membership) e criar
- `GET/PATCH/DELETE /api/{appId}/estudos/:id` — detalhe, atualizar, remover
- `POST /api/{appId}/estudos/:id/duplicar` — duplicar estudo
- `POST /api/{appId}/estudos/:id/status` — transição de status (com validação de regras)
- `GET/POST /api/{appId}/estudos/:id/membros` — gerenciar membros
- `GET/POST/PATCH/DELETE /api/{appId}/benchmarks` — CRUD de benchmarks (admin only)
- `POST /api/{appId}/estudos/:id/apelo-comercial` — disparar análise de IA
- `GET /api/{appId}/estudos/:id/exportar/:formato` — exportar PDF/Excel
- `GET /api/{appId}/nucleo/glebas` — proxy filtrado do Núcleo
- `GET /api/{appId}/nucleo/lotes` — proxy filtrado do Núcleo

**Tabelas com `acesso_externo: "restrito"`:** estudos, estudo_membros, benchmarks, apelo_comercial, apelo_comercial_documentos.

**Páginas públicas:** Nenhuma. O app não possui rotas públicas.

**Webhooks:** Nenhum no MVP.

### 6.9 Eventos

Eventos declarados no manifesto, publicados via `req.eventos.publicar()` nas rotas customizadas. Seguem o padrão `app.{slug}.{tipo}`:

#### `estudo_criado`
- **Campos:** estudo_id, nome_estudo, tipo_empreendimento, autor
- **Conteúdo:** "Novo estudo criado por {autor}: {nome_estudo} ({tipo_empreendimento})"
- **API:** `estudos/{estudo_id}`
- **Rota:** `detalhe/{estudo_id}`
- **Inscrição:** automática (forte) para todos os membros do estudo

#### `estudo_status_alterado`
- **Campos:** estudo_id, nome_estudo, tipo_empreendimento, status_anterior, status_novo, autor
- **Conteúdo:** "{nome_estudo}: status alterado de {status_anterior} para {status_novo} por {autor}"
- **API:** `estudos/{estudo_id}`
- **Rota:** `detalhe/{estudo_id}`
- **Inscrição:** automática (forte) para todos os membros do estudo
- **Nota:** cobre aprovação, reprovação, devolução e arquivamento — não é necessário evento separado por status

#### `apelo_comercial_concluido`
- **Campos:** estudo_id, nome_estudo, score_geral
- **Conteúdo:** "Análise de apelo comercial concluída para {nome_estudo} — Score: {score_geral}"
- **API:** `estudos/{estudo_id}`
- **Rota:** `detalhe/{estudo_id}`
- **Inscrição:** automática (forte) para membros com função editor ou aprovador

Bloco no manifesto:
```json
{
  "eventos": {
    "estudo_criado": {
      "campos": ["estudo_id", "nome_estudo", "tipo_empreendimento", "autor"],
      "conteudo": "Novo estudo criado por {autor}: {nome_estudo} ({tipo_empreendimento})",
      "api": "estudos/{estudo_id}",
      "rota": "detalhe/{estudo_id}"
    },
    "estudo_status_alterado": {
      "campos": ["estudo_id", "nome_estudo", "tipo_empreendimento", "status_anterior", "status_novo", "autor"],
      "conteudo": "{nome_estudo}: status alterado de {status_anterior} para {status_novo} por {autor}",
      "api": "estudos/{estudo_id}",
      "rota": "detalhe/{estudo_id}"
    },
    "apelo_comercial_concluido": {
      "campos": ["estudo_id", "nome_estudo", "score_geral"],
      "conteudo": "Análise de apelo comercial concluída para {nome_estudo} — Score: {score_geral}",
      "api": "estudos/{estudo_id}",
      "rota": "detalhe/{estudo_id}"
    }
  }
}
```

**Triggers:**
- `estudo_criado` → publicado na rota `POST /estudos` após criação do estudo e seus membros
- `estudo_status_alterado` → publicado na rota `POST /estudos/:id/status` após transição validada
- `apelo_comercial_concluido` → publicado na rota `POST /estudos/:id/apelo-comercial` após IA retornar e scores serem salvos

### 6.10 Documentação

**Docs a ler antes da implementação:**
- `docs/shell/banco-de-dados.md` — framework de dados
- `docs/shell/permissoes.md` — sistema de permissões (4 camadas)
- `docs/shell/ia.md` — framework de IA
- `docs/shell/ui.md` — componentes de UI
- `docs/shell/nucleo.md` — API do Núcleo (imóveis)
- `docs/shell/eventos.md` — sistema de eventos
- `docs/shell/documentacao.md` — framework de documentação (obrigatório seguir)

**Docs a criar durante implementação:**
- `docs/viabilidade/visao-geral.md` — visão geral do app, propósito, escopo
- `docs/viabilidade/modelo-de-dados.md` — schema, tabelas, relações
- `docs/viabilidade/formulas.md` — referência completa de fórmulas da Proforma
- `docs/viabilidade/benchmarks.md` — como funcionam benchmarks e sensibilidade
- `docs/viabilidade/apelo-comercial.md` — como funciona a análise de IA
- `docs/viabilidade/permissoes.md` — membership, funções, regras de acesso
- `docs/viabilidade/exportacao.md` — formatos e conteúdo dos relatórios

Toda documentação deve seguir o framework de documentação do UrbiVerso (`docs/shell/documentacao.md`).

---

## 7. Objetos do App (Roadmap)

### MVP
- **Estudo** — principal, com membros/permissões, inputs, proforma
- **Benchmark** — métricas de referência por tipo de empreendimento, com faixas de sensibilidade. Registro geral definido pelo admin.
- **Apelo Comercial** — relatório de IA por estudo (6 fatores + relatório geral)
- **Preço Sugerido/m²** — cálculo automático do preço mínimo para atingir piso de benchmark

### v2+
- **Curvas** — velocidade de eventos (vendas, obras, pagamentos). Tabela com N linhas representando períodos, cada uma com % do total. Curvas nomeadas e reutilizáveis (ex: "Avanço linear 10m").
- **Índices** — tabela de índices de correção (IPCA, IGPM, taxas fixas). Coluna por índice, linha por mês. Fonte oficial (API) ou fórmula. Ingestão via serviço de backend que consulta APIs públicas (BCB/SGS, IBGE/Sidra) periodicamente. Tabela própria no Núcleo, atualizada mensalmente com histórico completo.
- **Unidades** — cadastro individual com conexão ao Núcleo (v2). Duas fontes possíveis: (a) puxar do Núcleo se cadastradas, ou (b) cadastrar localmente para simulação. No MVP, unidades são apenas agregados numéricos (nº unidades, área média).

---

## 8. v2 — Escopo Futuro

*(Documentado para contexto, fora do MVP)*

- Projetos Avançados vinculados a Estudos Preliminares existentes
- Cronograma de obras
- Velocidade e distribuição de vendas + tabela de vendas por unidade (com cadastro de unidades diferentes)
- Fluxo de caixa ao longo do tempo
- Financiamento e estrutura de capital (exposição, juros, dívida)
- Cenários financeiros e operacionais avançados
- Análise de sensibilidade multidimensional
- Análises: FC Descontado, TIR, VPL, exposição financeira
- Gráficos e curvas financeiras adicionais
- Indicadores avançados na análise de sensibilidade (Margens, ROI, VPL, TIR, Exposição máxima)
- Comentários/impressões de leitores por estudo
- Busca web automatizada para Apelo Comercial (complementar uploads manuais)
- Ingestão de índices econômicos (SELIC, IPCA, IGPM) via APIs públicas (BCB, IBGE)
- Preço sugerido/m² com base em indicadores econômicos (complementar ao cálculo do MVP)
- Conexão de unidades do estudo com Unidades do Núcleo

---

## Pendências Abertas

1. ~~Relação Imóvel ↔ Estudo~~ ✅ Definido
2. ~~Status do estudo~~ ✅ Definido
3. ~~Comparação de cenários~~ ✅ Definido
4. ~~Perfil de usuários~~ ✅ Definido
5. ~~Estrutura de custos~~ ✅ Definido (Incorporação e Loteamento completos)
6. ~~Integração Núcleo~~ ✅ Definido (filtro excludente, relação lote→parcelamento confirmada)
7. ~~Análise de sensibilidade~~ ✅ Definido
8. ~~Imóvel não cadastrado~~ ✅ Cadastrar via Núcleo
9. ~~Fórmulas da Proforma~~ ✅ Documentadas (seção 6.2)
10. ~~KPI grids~~ ✅ Definidos (Premissas e Proforma, ambos os tipos)
11. ~~Campos por tipo (Loteamento)~~ ✅ Áreas são inputs do estudo como % da gleba. Sistema viário default 25%.
12. ~~Campos de sensibilidade~~ ✅ Definidos: Preço/m², permuta física/financeira, custo infra/obras.
13. **Relatórios (PDF/Excel):** Layout detalhado dos relatórios de exportação. *Referência visual fornecida.*
14. ~~Benchmarks~~ ✅ Indicadores definidos. Valores-alvo são admin-configuráveis.
15. ~~Classificação no Núcleo~~ ✅ Resolvido: filtro excludente.
16. ~~KPI grid Incorporação (Premissas)~~ ✅ Definido.
17. ~~Nomenclatura de campos de área~~ ✅ Definido: PVT R/NR Aberta/Fechada. VGV usa Áreas Fechadas.
18. ~~Fatores mistos da IA~~ ✅ Definido.
19. ~~Schema.json~~ ✅ Estrutura detalhada incluída com regras de precisão, id_legivel, tabelas completas.
20. ~~Manifesto.json~~ ✅ Eventos definidos. Manifesto pronto para montagem (nav, roles, eventos, dependências — todos os dados estão no spec).
21. ~~Loteamento — fórmulas de infraestrutura~~ ✅ Valor único, toggle.
22. ~~Prompts da IA~~ ✅ 6 fatores com 4 perguntas-guia cada.
23. ~~Eventos~~ ✅ 3 eventos definidos com campos, templates, rotas e triggers (seção 6.9).
24. ~~Rotas customizadas~~ ✅ Definido: todas as operações via rotas customizadas. Lista de endpoints incluída.
25. ~~Páginas públicas~~ ✅ Nenhuma.
26. ~~Webhooks~~ ✅ Nenhum no MVP.
27. ~~Fluxo de navegação~~ ✅ Definido (seção 5.0).
28. ~~Preço sugerido/m²~~ ✅ Promovido para MVP. Baseado no piso de resultado final do benchmark.
29. ~~Origem do terreno~~ ✅ Single-select na criação: Núcleo ou Manual. Dados manuais registrados no estudo.


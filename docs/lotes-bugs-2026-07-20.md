# Lotes de bugs/melhorias — 2026-07-20

Originados da `lista_bugs.xlsx` (17 itens) analisados em `analise-lista-bugs-2026-07-20.md`.
Cada lote tem issues abertas no GitHub. Uma sessão por lote.

**Legenda de risco:**
- 🟢 Trivial / zero risco
- 🟡 Atenção / decisão de design ou refactor não-trivial
- 🔴 Schema migration obrigatória ou bloqueio de spec

---

## Lote 1 — Trivial Preliminar
**Pré-requisitos:** Nenhum. Pode ser executado imediatamente.

### Issue #9 — 🟢 Coluna R$/m² com R$ e sem notação contábil
- **Arquivo:** `frontend/tela-proforma.ts:262`
- **Fix:** Criar `_fmtContabilM2()` análogo a `_fmtContabil()`, sem prefixo R$, com parênteses para custos. Aplicar na coluna R$/m².
- **Risco:** Zero.

### Issue #10 — 🟢 Linha "Receita Bruta (VGV)" sem destaque visual
- **Arquivo:** CSS da tabela da proforma
- **Fix:** Igualar tipografia/tamanho/peso da linha `receita` ao da linha `resultado`.
- **Risco:** Zero.

### Issue #11 — 🟢 Análise de sensibilidade sem distinção receita × despesa
- **Fix:** Cor de texto diferente na 1ª coluna + fundo de linha distinto para receita vs. despesa. Usar exclusivamente `var(--cor-sucesso)` / `var(--cor-erro)` ou tokens equivalentes do `ui.md`. **Proibido cor literal.**
- **Risco:** Zero.

### Issue #12 — 🟢 Badge do nível "Preliminar" deve ser amarelo
- **Arquivos:** `frontend/tela-dashboard.ts:136`, `frontend/tela-estudo.ts`
- **Fix:** Trocar `cor="padrao"` para o token de alerta/amarelo do `urbi-badge` (confirmar nome exato no `ui.md`).
- **Risco:** Zero.

### Issue #13 — 🟢 Remover botão "Criar indicadores padrão" + auto-seed
- **Arquivo:** `frontend/viabilidade-config-benchmarks.ts:85`
- **Fix:** (1) Remover o botão. (2) Implementar auto-seed silencioso no primeiro acesso: antes de renderizar, verificar se existem benchmarks; se não, chamar `POST /benchmarks/semear` automaticamente.
- **Risco:** Baixo. Seed já é idempotente. Sem migração de schema.

### Issue #24 — 🔴 AGUARDA PRINT — taxa_desconto_aa no Preliminar
- **Status:** Bloqueado. O bug não aparece no código atual. Necessário print mostrando onde o campo aparece no Preliminar antes de qualquer correção.
- **Fix (quando reproduzido):** Garantir que `taxa_desconto_aa` não seja renderizado quando `nivel_analise !== 'avancado'`.

---

## Lote 2 — Bug de sobreposição no Fluxo de Caixa
**Pré-requisitos:** Nenhum. Executar antes do Lote 3 (a tela será movida de lugar).

### Issue #14 — 🟡 Sobreposição ao rolar a tabela horizontalmente
- **Arquivo:** `frontend/tela-fluxo-ver.ts`
- **Diagnóstico:** 5 colunas sticky (`.c1`–`.c5`) já existem com `background: var(--cor-superficie)`. O problema provável: `.c1` tem `max-width: 220px` e `.c2` começa em `left: 220px`. Se um nome de linha ultrapassar 220px, ocorre sobreposição.
- **Fix:** (1) Reproduzir o bug com nome longo. (2) Garantir que o `left` de cada coluna sticky seja coerente com a largura real da anterior. (3) Fixar larguras se necessário.
- **Atenção:** A 1ª coluna JÁ está travada. Não é problema de sticky, é de encaixe entre as 5 colunas.
- **Risco:** Médio — requer reprodução antes de corrigir.

---

## Lote 3 — Reestruturação de abas do Avançado (FUNDAÇÃO)
**Pré-requisitos:** Nenhum. Este lote é o pré-requisito de todos os outros do Avançado.
⚠️ Implementar uma aba de nível 1 por vez para reduzir risco.

### Issue #15 — 🟡 Nova estrutura de abas principais do Avançado
- **Novas abas (nível 1):** Resumo · Empreendimento · Viabilidade · Obra · Fluxo de Caixa · Cenários · Análise de mercado
- **Tecnologia:** `urbi-abas` suporta aninhamento (auto-declara `[expandir]`). Alternativa já usada: `urbi-badge interativo` como sub-nav (padrão atual em Fluxo de Caixa). Decisão de UX fica a critério na implementação.
- **Escopo:** Reorganizar toda a árvore de telas do Avançado. Conteúdo de cada sub-aba vem nos lotes seguintes.
- **Risco:** Alto esforço; tecnicamente viável.

---

## Lote 4 — Aba Empreendimento
**Pré-requisitos:** Lote 3 (#15) concluído.
⚠️ Implementar mês 0 em etapa isolada com reteste completo do motor de fluxo.

### Issue #16 — 🔴 Nova aba Empreendimento com sub-abas: Informações, Cronogramas, Tipologias

#### Sub-aba (1) Informações
- Campos: Nome, Área do terreno, **Matrícula** (novo campo), **Descrição** (novo campo), uploads: imagem principal, renders, plantas baixas (PDF + imagem)
- **Migração de schema:** adicionar `matricula` e `descricao` em `estudos` + tabela/coluna de anexos espelhando `apelo_comercial_documentos`. Colunas de arquivo usam tipo `arquivo`.

#### Sub-aba (2) Cronogramas
- Mover conteúdo atual de **Fluxo de Caixa → Cronograma** para cá.
- **⚠️ ALTO RISCO:** Alterar convenção de mês início de **1 → 0**. Impacta TODAS as fórmulas em `fluxo-caixa-motor.ts`, `fluxo-shared.ts`, `tela-fluxo-*`. Requer varredura completa + reteste dos 9 testes do motor. Implementar e testar ISOLADO antes de continuar.
- Remover `taxa_desconto_aa` desta tela (será realocado em outro lote).

#### Sub-aba (3) Tipologias
- Mover cadastro atual de Fluxo de Caixa → Receitas para cá.
- Colunas: Nome · Tipo (single-select) · Área privativa (2 casas decimais) · Dormitórios · Vagas · Unidades · **Unidades permutadas** (novo)
- Linha final: total unidades, área total, total vagas.
- **Migração de schema:** adicionar `unidades_permutadas` em `avancado_tipologias`. Atualizar fórmula de área total.

---

## Lote 5 — Custos (5 abas + formato de tabela)
**Pré-requisitos:** Lotes 3 (#15) e 4 (#16) concluídos.
⚠️ Antes de implementar: definir o mapa de reclassificação dos grupos de custo (ver abaixo).

### Issue #17 — 🔴 Dividir custos em 5 abas + unificar seletor de unidade com Preliminar

#### Divisão dos custos
- Hoje: enum `grupo` em `avancado_linhas_custo` com 3 valores: `terreno` / `obra` / `indireto`
- Novos grupos (5): **Custos do Terreno · Custos de Obra · Custos Diretos · Custos Indiretos · Financeiro**
- **Migração de schema:** expandir o enum `grupo` de 3 para 5 valores + reclassificar linhas existentes.
- **⚠️ Decisão pendente com o usuário:** qual o mapa de reclassificação? Ex: o que era `obra` vai para `obra` ou `diretos`? O que entra em `financeiro`? **Perguntar no início da sessão.**

#### Seletor de unidade
- Preliminar usa `urbi-badge interativo` + conversão automática de valor (`_custoUnidade()`). Avançado usa `urbi-select` sem conversão.
- Portar o padrão do Preliminar para o Avançado, cobrindo as 2 unidades adicionais: `rs_m2_terreno` e `pct_receita`.

### Issue #18 — 🟡 Formato padrão de tabela para todas as abas de custo
Colunas obrigatórias em todas as abas:
| Categoria | Orçamento | Distribuição | Cronograma | Início | Duração |
|---|---|---|---|---|---|
| single-select (opções únicas por aba) | valor + seletor de unidade (padrão Preliminar) | forma de distribuição no tempo | evento do Cronograma + "Customizado" | automático ou livre | automático ou livre |

- Se Cronograma = evento → Início e Duração travados (comportamento 🔒 já existe em `tela-fluxo-custos.ts`).
- Se Cronograma = Customizado → usuário edita livremente.
- Linha de consolidado ao final de cada aba.
- A estrutura base já existe em `tela-fluxo-custos.ts` — adaptar para as 5 novas abas.

---

## Lote 6 — Receitas + Absorção + Fases
**Pré-requisitos:** Lotes 3 (#15) e 4 (#16) concluídos.
⚠️ Os três issues deste lote formam um sistema integrado. Necessário spec conjunta antes de implementar qualquer um dos três. Alinhar com o usuário no início da sessão.

### Issue #19 — 🔴 Novo modelo Receitas: seleção de tipologia + alocação por faixa de preço
- Tipologias viram catálogo (cadastradas em Empreendimento → Tipologias, issue #16).
- Em Receitas, o usuário seleciona a tipologia pelo nome e define unidades + preço/m² por linha.
- Múltiplas linhas para a mesma tipologia com preços diferentes são permitidas.
- **Trava de saldo:** ao esgotar o total de unidades da tipologia, o nome fica bloqueado/cinza para novas linhas.
- **Migração de schema:** nova tabela de alocações com FK para `avancado_tipologias`.
- **Decisão a confirmar:** o que acontece a uma alocação se a tipologia-mãe for editada ou excluída?

### Issue #20 — 🟡 Ajustes em Absorção de Vendas e Fluxo de Pagamento

#### Absorção
- Manter só o modo "Distribuído" em 3 períodos: Pré-lançamento+Lançamento / Durante a obra / Pós-obra.
- Pós-obra = `100% − período 1 − período 2` (calculado, período derivado do Cronograma).
- Remover modos `linear` e `personalizado`. Remover validação de soma = 100%.
- Remover campo **VGL** da tela (confirmar que nenhum downstream depende de exibi-lo).

#### Fluxo de Pagamento
- Repasse (%) = `100% − %Entrada − %Parcelas` (calculado automaticamente).
- Permitir múltiplas linhas em Entrada e em Parcelamento (soma do % de cada etapa definida uma vez).
- Remover mensagem de verificação de soma = 100%.
- ⚠️ **Risco:** mudança na forma do JSON `fluxo_pagamento`. Registros existentes precisam de parse/migração leve no deserializar.

### Issue #21 — 🔴 Divisão por Fases com Absorção e Fluxo por fase
- Elevar "Fase" de `fase_label` (texto livre) para entidade estruturada.
- Cada fase carrega seus próprios parâmetros de Absorção e Fluxo de Pagamento.
- **Migração de schema:** fase como entidade (ou agrupador estruturado) com `absorcao` e `fluxo_pagamento` no nível da fase.
- **Não implementar isolado** — spec e implementação conjuntas com #19 e #20.

---

## Lote 7 — Financeiro sub-abas
**Pré-requisitos:** Lotes 3 (#15) e 5 (#17) concluídos.
🚫 **BLOQUEADO — aguarda especificação dos campos** de cada sub-aba.

### Issue #22 — 🔴 Financeiro: criar sub-abas
- Sub-abas: Estrutura · Custos Financeiros · Juros · Taxas e Impostos · Financiamento & Investidores
- **Não implementar** até que os campos de cada sub-aba sejam definidos pelo usuário.
- Nota técnica: 3 níveis de aba são possíveis com `urbi-abas` aninhado, mas avaliar se acordeões/seções roláveis não seriam melhor UX para o 3º nível.

---

## Lote 8 — Resumo (último)
**Pré-requisitos:** TODOS os lotes anteriores concluídos.

### Issue #23 — 🟡 Aba Resumo consolidando métricas e gráficos
- Frontend puro — lê resultados calculados pelas outras abas.
- Exibir KPIs principais + gráficos chave. Seleção dos itens a definir com o usuário no início da sessão.
- Sem lógica de entrada própria.
- **Fazer por último** — depende de todos os outros estarem prontos.

---

## Checklist de status dos lotes

| Lote | Status | Observações |
|------|--------|-------------|
| 1 | ⏳ Pendente | #24 aguarda print do usuário |
| 2 | ⏳ Pendente | |
| 3 | ⏳ Pendente | |
| 4 | ⏳ Pendente | |
| 5 | ⏳ Pendente | Mapa de reclassificação de grupos aguarda decisão |
| 6 | ⏳ Pendente | Spec conjunta Receitas+Fases obrigatória antes de iniciar |
| 7 | 🚫 Bloqueado | Aguarda spec dos campos das sub-abas de Financeiro |
| 8 | ⏳ Pendente | |

**Atualizar esta tabela ao concluir cada lote.**

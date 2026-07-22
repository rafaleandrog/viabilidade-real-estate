# Etapas de bugs/melhorias — 2026-07-22 (rodada 2)

Originadas da 2ª `lista_bugs.xlsx` (**28 itens**), analisadas contra o código atual e as regras do
`urbiverso`. É a rodada seguinte aos **lotes 1–8** (issues #9–#24), já implementados — ver
`docs/lotes-bugs-2026-07-20.md`. Aqui há **regressões**, **refinamentos** e **features novas**.

**Uma etapa ≈ uma sessão do Code.** Disparo: **`Siga para a Etapa X`** (protocolo em `CLAUDE.md`).
Ao final de cada etapa o processo **abre o PR e faz merge na `main`** automaticamente (decisão do
autor; ver protocolo).

**Legenda de risco:**
- 🟢 Trivial / frontend puro / validável 100% neste ambiente
- 🟡 Atenção / decisão de design ou refactor não-trivial
- 🔴 Schema/backend/motor — validação parcial aqui (resto no ambiente do autor)

**Todo o escopo é no repo `viabilidade-real-estate`.** O `urbiverso` é só fonte de regras/UI.
`urbi-nav` e `urbi-abas` já existem no shell (nenhuma mudança no shell é necessária).

---

## Etapa 1 — Correções rápidas de UI 🟢
**Pré-requisitos:** nenhum. Frontend puro — verde no `scripts/validar-frontend.sh`.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#33** | 2 | Coluna R$/m² ainda concatena "/m²" no valor (regressão #9) | `frontend/tela-proforma.ts:275` (`_fmtContabilM2`) |
| **#34** | 3 | Separar os 2 indicadores da Análise de sensibilidade em tabela própria (segue #11) | `frontend/tela-proforma.ts` |
| **#35** | 4 | Voltar linhas ao tamanho padrão; só VGV e Resultado maiores (regressão #10) | `frontend/tela-proforma.ts` (CSS `.pf`) |
| **#36** | 5 | Aviso "não salvo" só quando houver mudança real (dirty) | `frontend/tela-premissas.ts` |
| **#37** | 27 | Sobreposição no Fluxo persiste — dar `background` opaco às `.c1–.c5` do corpo (regressão #14) | `frontend/tela-fluxo-ver.ts:72` |

> #33/#34/#35 tocam o mesmo arquivo — resolver juntos.

---

## Etapa 2 — Backend & dados 🔴
**Pré-requisitos:** nenhum. Toca schema/backend/Núcleo → validação parcial aqui.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#24** | 1 | Campos do Avançado (`taxa_desconto_aa` etc.) validados ao salvar Preliminar (mensagem do shell `validacao-dados.ts`) | `schema.json`, `backend/rotas/estudos.ts` |
| **#38** | 6 | Terrenos: lista do Núcleo incompleta + paginação | `frontend/tela-terreno-nucleo.ts`, `backend/rotas/imoveis-estudo.ts` |

---

## Etapa 3 — Fundação de navegação 🟡 (pré-requisito das Etapas 4–8)
**Pré-requisitos:** nenhum. Reorganiza a navegação do Avançado — o Preliminar não muda.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#39** | 7 | `urbi-nav` (páginas à esquerda) + `urbi-abas` (itens no topo, nome+emoji) | `frontend/tela-avancado.ts` (+ rotas) |
| **#40** | 20 | Renomear página "Obra" → "Custos" (após #39) | `frontend/tela-avancado.ts` |

---

## Etapa 4 — Empreendimento (Cronograma + Tipologias) 🟡
**Pré-requisitos:** #39.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#41** | 8 | 5 fases padrão com cores distintas (tokens) | `frontend/tela-fluxo-cronograma.ts` |
| **#42** | 9 | Adicionar fases (nome/início/duração) refletindo gantt + selects | `tela-fluxo-cronograma.ts` (+ `avancado_fases`) |
| **#43** | 10 | Emojis no gantt (⭐ Lançamento, 🔑 fim da Obra) | `tela-fluxo-cronograma.ts` |
| **#44** | 11 | Corrigir largura/alinhamento das colunas de Tipologias | `frontend/tela-empreendimento-tipologias.ts` |
| **#45** | 12 | Texto calculado de permutadas (% e m²) ao lado do campo | `tela-empreendimento-tipologias.ts` |

---

## Etapa 5 — Custos (unidade por categoria + coluna de resultado) 🔴
**Pré-requisitos:** #39, #40.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#46** | 22–25 | Unidade do Orçamento dependente da Categoria (Terreno/Obras/Diretos/Indiretos) — inclui `% Obra` (Gestão de obra) | `frontend/tela-fluxo-custos.ts` (+ resolvedor de custo) |
| **#47** | 26 | Nova coluna com resultado quando unidade ≠ R$ + ajustar larguras (↓Orçamento, +col, ↓Duração) | `tela-fluxo-custos.ts` |

---

## Etapa 6 — Receitas (layout, status, cores, save, saldo) 🔴
**Pré-requisitos:** #39. #48 reaproveita o layout do #44.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#48** | 14 | Corrigir largura/alinhamento das colunas (mesmo bug do #44) | `frontend/tela-fluxo-receitas.ts` |
| **#49** | 15 | Bola de status (amarela→verde ao Aplicar) em Absorção/Fluxo | `tela-fluxo-receitas.ts` |
| **#50** | 16 | Cores dos botões — Absorção roxo, Fluxo azul (tokens) | `tela-fluxo-receitas.ts` |
| **#51** | 17 | Bug de digitação (letras somem/sync) + botão Salvar | `tela-fluxo-receitas.ts` |
| **#52** | 18 | Saldo de unidades deve somar por TODAS as fases | `tela-fluxo-receitas.ts` (+ `avancado_alocacoes`) |

---

## Etapa 7 — Redistribuição de Premissas (trio conjunto) 🔴
**Pré-requisitos:** #39 + Etapa 4. Fazer os três juntos; #54 por último.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#53** | 13 | Dados do terreno só em Informações, não em Viabilidade → Premissas | `frontend/tela-empreendimento-info.ts` |
| **#55** | 21 | Campo Taxa de Desconto na aba Financeiro + double-check Preliminar (par com #24) | `tela-financeiro.ts`, `backend/rotas/avancado.ts` |
| **#54** | 19 | Avaliar e **excluir** a aba Premissas (se não quebrar cálculos) — só Avançado | telas de Viabilidade + motor |

---

## Etapa 8 — Cenários (feature grande) 🔴
**Pré-requisitos:** #39 + motor de fluxo. Última etapa.

| Issue | Item | Resumo | Arquivo-alvo |
|---|---|---|---|
| **#56** | 28 | Reconstrução: range sliders (benchmark), gráfico de linha (fluxo acumulado + cenário), fluxo do cenário, tabela de cenários persistente | `frontend/tela-graficos.ts`, `fluxo-caixa-motor.ts`, `fluxo-graficos.ts`, `viabilidade-config-benchmarks.ts` (+ schema cenários) |

---

## Cobertura dos 28 itens (nenhum órfão)

1→#24 · 2→#33 · 3→#34 · 4→#35 · 5→#36 · 6→#38 · 7→#39 · 8→#41 · 9→#42 · 10→#43 · 11→#44 ·
12→#45 · 13→#53 · 14→#48 · 15→#49 · 16→#50 · 17→#51 · 18→#52 · 19→#54 · 20→#40 · 21→#55 ·
22→#46 · 23→#46 · 24→#46 · 25→#46 · 26→#47 · 27→#37 · 28→#56.

(#16 da rodada 1 foi fechado como concluído; os refinamentos de Empreendimento viraram #41–#45/#53.)

---

## Checklist de status das etapas

| Etapa | Issues | Status | Observações |
|------|--------|--------|-------------|
| 1 | #33 #34 #35 #36 #37 | ⬜ Pendente | Frontend puro |
| 2 | #24 #38 | ✅ Concluída | Backend + frontend — validação de backend no ambiente do autor |
| 3 | #39 #40 | ✅ Concluída | Fundação — urbi-nav lateral + urbi-abas no topo (frontend puro) |
| 4 | #41 #42 #43 #44 #45 | ⬜ Pendente | Depende de #39 |
| 5 | #46 #47 | ✅ Concluída | Schema + frontend + motor — validação de backend no ambiente do autor |
| 6 | #48 #49 #50 #51 #52 | ✅ Concluída | Frontend + backend (saldo global) — validação de backend no ambiente do autor |
| 7 | #53 #55 #54 | ✅ Concluída | Frontend puro — Terreno → Informações; Premissas mantida (#54 avaliado) |
| 8 | #56 | ✅ Concluída | Schema + backend + frontend + motor — novo viab-tela-cenarios; validação de backend/migração no ambiente do autor |

**Atualizar esta tabela ao concluir cada etapa.**

# Rodada 10 — lista de bugs dos estudos Preliminares (`lista_bugs_20260826.xlsx`)

> Aberta em 2026-08-26. Fonte: planilha `lista_bugs_20260826.xlsx` do autor (aba `bugs`, 9 itens)
> + 2 screenshots de produção (Proforma e Cenários de um estudo de Incorporação). As abas
> `#38/#39/#45` da planilha são resquícios de trabalhos anteriores (decisão do autor em
> 2026-08-26 — nenhuma issue sai delas); a aba `#43` traz 3 prints da EVI "PROFORMA INCORPORAÇÃO"
> e serve de **gabarito de cálculo** para as issues de Proforma/Cenários.
>
> Este documento é fotografia do planejamento. O placar vivo está nas issues e nos PRs.

## Placar das etapas concluídas (fatos encerrados; o que resta vive nas issues)

- **Etapa 1** (2026-08-26/27) — abertura da rodada (PR 575) e os dois primeiros trilhos: PR 576
  (#564, cascata de Incorporação) e PR 580 (#563, fonte do VGV). Leva Avançado registrada em
  issues (#577–#596).
- **Etapa 2** (2026-08-27) — o Preliminar de Incorporação inteiro: PRs 598–603, 605–608, 614,
  616 e 617; issues #565–#573, #588 e #597 fechadas (+#577, antecipada da leva Avançado). A
  `main` fechou a etapa em versão `0.1.35`, migrações `030 → 036`.
- **Etapa 3** (2026-08-28) — auditoria do Preliminar de Loteamento (#574, este PR):
  `docs/rodada-10/relatorio-574-loteamento.md`, conserto da pizza da gleba e o primeiro caso de
  render de Loteamento; achados grandes viraram #609–#613 e #615.

**Política de revisão da rodada, nas palavras em que foi decidida:** de 2026-08-27 a 2026-08-28
valeu o **Codex seletivo** — o App do Codex só nos PRs que fechavam #563, #568, #570 ou #592
(as 4 issues de motor mais arriscadas); os demais fecharam com uma rodada de lente nativa,
declarada no relatório de cada PR. Em **2026-08-28 o autor reativou o App para todos os PRs**,
com teto de interações por PR (um acionamento por head com mudança de lógica; reacionamento só
quando o conserto toca lógica de motor; delta trivial fecha por verificação do orquestrador).

## Mapa item → issue

| Item | Seção / Aba | Pedido (resumo) | Issue(s) |
|---|---|---|---|
| 1 | Premissas / Terreno & Áreas | Tabelas no modelo visual do Loteamento, nomenclatura de Incorporação | #564 |
| 2 | Premissas / Produtos | Single-select Residencial/Não Residencial entre Nome e Área média | #565 |
| 3 | Premissas / Permutas | Divisões Física e Financeira calculam sobre o total de cada categoria | #570 |
| 4 | Premissas / Permutas | Retirar permuta física por seleção de unidade (só m² e % área venda) | #566 |
| 5 | Premissas / Terreno & Áreas | Métrica de aproveitamento do coef. máximo, com aviso ao ultrapassar | #569 |
| 6 | Premissas / Produtos | Indicador de área privativa alocada nos produtos | #573 |
| 7 | Geral | Estudo sem produto cadastrado calcula VGV e despesas mesmo assim | #563 |
| 8 | Resultado / Cenários | Conferência completa dos cálculos da Proforma e da sensibilidade | #563, #567, #571, #568, #572 |
| 9 | Loteamento / Geral | Conferência geral do Preliminar de Loteamento + propagação | #574 |

## O diagnóstico em uma frase por issue

- **#563 (P1, motor)** — produto vazio troca a fonte do VGV e a permuta física deduz sem trava:
  o estudo do screenshot tem VGV **negativo**; sem produto nenhum, o motor calcula
  números-fantasma a partir de campos legados sem UI. Decisão do autor: VGV nunca negativo
  (excedente capado com aviso) e estado vazio explícito.
- **#567 (P1, ui)** — a tabela da Proforma imprime **módulo** nas linhas de receita; um resultado
  operacional negativo aparece como se o custo tivesse sido somado. A convenção contábil
  compartilhada (`celula`, em `frontend/viab-format.ts`) já distingue custo de valor negativo — a
  tela mantém cópia própria que perde o sinal.
- **#571 (P1, ui/motor)** — com `vgv ≤ 0`, a coluna "% VGV" colapsa inteira para "—" e os KPIs
  viram 0,0% em vez de "indefinido" — nos Cenários, em Premissas, Resumo e Gráficos.
- **#568 (P1, motor)** — o fator da sensibilidade **não alcança o catálogo de Produtos**:
  estressar Preço/m² não move o VGV quando a fonte é o catálogo (o caso normal). Confirmação
  numérica: 24.764.117,40 × 0,9 e × 1,1 são exatamente os valores do print.
- **#572 (P2, ui)** — tela e exportação ordenam as linhas de permuta de formas **opostas**, e a
  sequência da tela não fecha aritmeticamente de cima para baixo. Rótulos mantidos (decisão do
  autor).
- **#564 (P2, ui)** — liga a `CASCATA_INCORPORACAO` (pronta e testada em
  `frontend/areas-cascata.ts` desde 2026-08-03, nunca importada em produção) no lugar do grid
  plano de 5 campos.
- **#569 (P2, ui)** — teto derivado `área do terreno × coef. máximo` + indicador de
  aproveitamento + aviso; hoje o coeficiente só alimenta a outorga.
- **#565 (P2, ui/schema)** — coluna `tipo` em `preliminar_produtos` (migração `035`, no-op
  aditiva; bump `0.1.34`).
- **#566 (P2, ui/schema)** — remove a opção "unidade" da permuta física nas 4 camadas em que ela
  vive (migração `036` converte `modo='unidade'` → `'area_m2'` pelo canônico; bump `0.1.35`).
- **#570 (P2, motor)** — com a classificação da #565, permutas Física e Financeira passam a
  incidir sobre o total **da sua categoria** no catálogo (hoje `vgvNaoResidencial` é zerado e a
  permuta é valorada por preço legado).
- **#573 (P3, ui)** — indicador na aba Produtos: m² alocados × m² registrados em Terreno & Áreas.
- **#574 (P2)** — auditoria do Preliminar de Loteamento contra `docs/viabilidade/formulas.md` +
  propagação do que couber; o PR que fechar a última issue da rodada carrega o encerramento
  (tabela do `CLAUDE.md` + `PROGRESSO.md`) no mesmo diff.

## Fila de PRs

Dois trilhos de arquivos, merges seriais dentro de cada trilho; desenvolvimento pode ser paralelo
entre trilhos (worktrees isoladas, uma branch por PR):

- **Trilho A (Proforma):** #563 → #567 → #571 → #568 → #572
- **Trilho B (Premissas):** #564 → #569 e, em paralelo ao par anterior, #565 → #566 → #570 → #573
  (as migrações `035`/`036` são numeradas contra a `main` do momento do merge)
- **Fecho:** #574 (depende de todas)

Processo por PR: o obrigatório do `CLAUDE.md` (branch própria de `origin/main` + unset-upstream,
`validar-frontend.sh`, corpo em arquivo + `preflight-pr.mjs`, PR via MCP, revisão via skill
`revisar-pr-apps` com `@codex review` em todos, merge pela sessão com autorização do autor de
2026-08-26 — condicionado a zero bloqueantes e às condições-padrão do § Merge). PRs com
schema/migração declaravam a validação de backend pendente do autor (SDK 401 na sessão de nuvem).
⚠️ Isso valeu até 2026-09-03: com a auth em `scripts/lib/sdk-auth.sh`, `validar-backend.sh` roda as
5 etapas aqui, e o PR que declarar backend "pendente" a partir daí está errado.

## Fora do escopo

Issues abertas de antes da rodada, não cobertas pela planilha: #504 (docs modelo-de-dados), #512
(round2 em agregados do Avançado), #514 (badge "% Obra" do Avançado), #515 (badge de ligação em
Premissas). Ficam para decisão do autor.

# Sessões de bugs — lista_bugs.xlsx (62 itens)

**Data:** 2026-07-25  
**Issues GitHub:** #63–#124  
**Branch padrão de cada sessão:** `claude/sX-<slug>` a partir da `main` atualizada

---

## Como disparar cada sessão no Claude Code

Cada sessão é iniciada com o comando:

```
Siga para a Sessão SX
```

Substitua `X` pelo número da sessão desejada. O Claude vai carregar os issues da sessão, implementar, validar e abrir o PR automaticamente.

---

## Mapa de sessões

| Sessão | Tema | Issues | Dif. | Pré-requisitos |
|--------|------|--------|------|----------------|
| **S1** | Preliminar Premissas: Cores de avisos | #63 #64 | F | — |
| **S2** | Preliminar Proforma: Cores | #65 #66 #67 #68 | F | — |
| **S3** | Preliminar Proforma: Bugs de exibição | #69 #70 | M | — |
| **S4** | Empreendimento: Texto & Layout | #71 #72 #73 #74 #75 | F | — |
| **S5** | Empreendimento Cronograma: Regras e bug Gantt | #76 #77 #78 | M | — |
| **S6** | Empreendimento: Bugs difíceis | #79 #80 | D | — |
| **S7** | Feature: Imagem Principal + Thumbnail | #81 #82 | D | — |
| **S8** | Receitas: CSS, Layout & Texto | #83 #84 #85 #86 #87 #88 #89 #90 #91 #92 #93 #94 | F | — |
| **S9** | Receitas: UI & Validação | #95 #96 #97 #98 | M | S5 |
| **S10** | Receitas: Saldo e Absorção | #99 #100 | D | S5 |
| **S11** | Custos: Texto, CSS & Layout | #101 #102 #103 #104 #105 #106 | F | — |
| **S12** | Custos: Regras & Formatação | #107 #108 #109 | M | S11 |
| **S13** | Custos: Lógica multi-arquivo | #110 #111 #112 | D | S12 |
| **S14** | Custos Diretos: Motor de Corretagem | #113 | C | S13 + S10 |
| **S15** | Fluxo de Caixa: Visual & Layout | #114 #115 #116 | M | S13/S14 |
| **S16** | Fluxo de Caixa: Estrutura & VPL | #117 #118 | D | S15 |
| **S17** | Fluxo de Caixa: View Mensal/Anual | #119 | C | S16 |
| **S18** | Cenários: Texto & KPI | #120 #121 | F | S16 |
| **S19** | Cenários: Tabela de Salvos | #122 | M | S16 |
| **S20** | Cenários: Gráfico Tracejado & Variação % | #123 #124 | D | S16/S19 |

---

## Legenda de dificuldade

| Sigla | Significado |
|-------|-------------|
| **F** | Fácil — CSS/texto puro, 1–2 linhas |
| **M** | Médio — lógica em 1 arquivo |
| **D** | Difícil — multi-arquivo / lógica complexa |
| **C** | Complexo — motor de cálculo + backend |

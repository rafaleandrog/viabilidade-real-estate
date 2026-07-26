# Sessões de bugs — lista_bugs.xlsx (62 itens)

> 🏁 **RODADA CONCLUÍDA (2026-07-26).** As 20 sessões (S1–S20) e as 62 issues (#71–#132) estão
> implementadas e fechadas — nenhuma issue aberta resta no repositório. Detalhe de cada sessão em
> `PROGRESSO.md`. O que permanece pendente é apenas a validação no ambiente autenticado do autor
> (typecheck/suíte de backend, `urbi-empacotar`, execução das migrações 001–005 e render real no
> deploy dev) — ver a seção "Rodada 3 — CONCLUÍDA" do `PROGRESSO.md`.

⚠️ **DOCUMENTO OFICIAL** — Este é o mapa mestre das 62 issues organizadas em 20 sessões Claude Code. **Todos os chats de sessões devem consultar ESTE ARQUIVO para saber exatamente quais issues pertencem a cada sessão SX.**

**Data:** 2026-07-25  
**Issues GitHub:** #71–#132 (62 issues em 20 sessões)  
**Branch padrão de cada sessão:** `claude/sX-<slug>` a partir da `main` atualizada

---

## Como disparar cada sessão no Claude Code

Cada sessão é iniciada com o comando:

```
Siga para a Sessão SX
```

Substitua `X` pelo número da sessão desejada. O Claude vai carregar os issues da sessão, implementar, validar e **abrir o PR contra `main`**. O **merge fica a cargo do autor** após revisão — não é feito automaticamente.

---

## Mapa de sessões

| Sessão | Tema | Issues | Dif. | Pré-requisitos |
|--------|------|--------|------|----------------|
| **S1** ✅ | Preliminar Premissas: Cores de avisos | #71 #72 | F | — |
| **S2** ✅ | Preliminar Proforma: Cores | #73 #74 #75 #76 | F | — |
| **S3** ✅ | Preliminar Proforma: Bugs de exibição | #77 #78 | M | — |
| **S4** ✅ | Empreendimento: Texto & Layout | #79 #80 #81 #82 #83 | F | — |
| **S5** ✅ | Empreendimento Cronograma: Regras e bug Gantt | #84 #85 #86 | M | — |
| **S6** ✅ | Empreendimento: Bugs difíceis | #87 #88 | D | — |
| **S7** ✅ | Feature: Imagem Principal + Thumbnail | #89 #90 | D | — |
| **S8** ✅ | Receitas: CSS, Layout & Texto | #91 #92 #93 #94 #95 #96 #97 #98 #99 #100 #101 #102 | F | — |
| **S9** ✅ | Receitas: UI & Validação | #103 #104 #105 #106 | M | S5 |
| **S10** ✅ | Receitas: Saldo e Absorção | #107 #108 | D | S5 |
| **S11** ✅ | Custos: Texto, CSS & Layout | #109 #110 #111 #112 #113 #114 | F | — |
| **S12** ✅ | Custos: Regras & Formatação | #115 #116 #117 | M | S11 |
| **S13** ✅ | Custos: Lógica multi-arquivo | #118 #119 #120 | D | S12 |
| **S14** ✅ | Custos Diretos: Motor de Corretagem | #121 | C | S13 + S10 |
| **S15** ✅ | Fluxo de Caixa: Visual & Layout | #122 #123 #124 | M | S13/S14 |
| **S16** ✅ | Fluxo de Caixa: Estrutura & VPL | #125 #126 | D | S15 |
| **S17** ✅ | Fluxo de Caixa: View Mensal/Anual | #127 | C | S16 |
| **S18** ✅ | Cenários: Texto & KPI | #128 #129 | F | S16 |
| **S19** ✅ | Cenários: Tabela de Salvos | #130 | M | S16 |
| **S20** ✅ | Cenários: Gráfico Tracejado & Variação % | #131 #132 | D | S16/S19 |

---

## Legenda de dificuldade

| Sigla | Significado |
|-------|-------------|
| **F** | Fácil — CSS/texto puro, 1–2 linhas |
| **M** | Médio — lógica em 1 arquivo |
| **D** | Difícil — multi-arquivo / lógica complexa |
| **C** | Complexo — motor de cálculo + backend |

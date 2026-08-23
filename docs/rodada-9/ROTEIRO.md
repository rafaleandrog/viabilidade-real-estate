# Rodada 9 — roteiro de execução

> **Leia este arquivo antes de agir.** Ele existe para que a Rodada 9 não dependa da memória de
> nenhuma sessão. Escrito em 2026-08-23, no meio da execução.
>
> As regras que governam o trabalho estão no **`CLAUDE.md` § Processo obrigatório** — em especial as
> três de escopo (R1, R2, R3). Este arquivo diz **o quê** e **em que ordem**; o `CLAUDE.md` diz
> **como**.

## Onde a rodada está

| Onda | O que faz | Estado |
|---|---|---|
| **0** | Recuperar o Bloco 8-A e corrigir o resumo que o apagou | ✅ **PR 494 mergeado** |
| **0.1** | As três regras de escopo viram contrato, com guard; maquinaria de revisão | ✅ **PR 496 mergeado** (fecha #495) |
| **1.1** | Espelho da referência de UI do urbiverso | ✅ **PR 497 mergeado** |
| **1.2** | Os três guards estáticos (tokens, props, box model) | ⬜ **próximo** |
| **1.3** | `scripts/render-check.mjs` generalizado + casos + CI | ⬜ |
| **2** | O `urbi-kpi` consertado e **verificado pelo render-check** | ⬜ #488 |
| **3** | Documentação (PR único, D-Q04) + schema | ⬜ #479, depois #438 #439 #440 #470 #471 #481 #482 |
| **4** | UI que não move número | 🟡 #483 ✅ · #492 ✅ · faltam #437 #442 #430 #486 #490 |
| **5** | **Cadeia do denominador** — serial, um KPI por PR | ⬜ |
| **6** | Satélites, cada um após seu pré-requisito | ⬜ |
| **7** | Invariantes, vocabulário e formatação | ⬜ #489 #491 e os demais |
| **8** | Migrações — 4 PRs isolados, um número cada | ⬜ #459 #473 #462 #478 |
| **9** | Restos e registros | ⬜ |

Fora de onda, aberto: **PR 500** (o Codex responde de duas formas — conserto de defeito do 496).

## A cadeia do denominador — Onda 5, estritamente serial

Ordem fixada pela **#468**. Cada PR sai sozinho, com a tabela `antes → depois` dos 4 KPIs:

```
#426 → #433 → #429 → #431 → {#432, #435} → #434 → #428
```

Armadilhas que o corpo do PR precisa carregar:
- **#429** — *"verificar que a curva voltou não fecha esta issue"*; o critério é `Σ pcts` fechar em 100%.
- **#432** — ordem interna vinculante: a spec `fluxo-investidor-formulas.md:135` **antes** do motor.

## Pré-requisitos duros — conferidos, não presumidos

| Precede | Sucede | Motivo |
|---|---|---|
| #426 | #427, #443, #447, #448 | somar linhas a uma função que erra o sinal multiplica o erro |
| #431 | #428, #452 | sem ele o campo é preenchido e perdido no clique seguinte |
| #436 | #428 | pré-requisito barato, não alternativa |
| #429 | #431 | ou o segundo faz parecer que o primeiro foi resolvido |
| #433 | #457 | pré-requisito de **dado**: `234 + 42 > 234` |
| #453 | #451 etapa 2 | a etapa 1 da #451 não depende de nada |
| #428 | #456, #460, #477 | os KPIs nasceriam mentindo |
| #479 | #438 | corrige o motivo que a #438 usaria |
| **#440** | **#450** | ⚠️ o doc delimita 7 campos inertes; se a #450 mergear antes, o número muda |
| #445 | #469 | sem ela a prova E2 fica invisível |
| #443 + #474 | — | saem **juntas** |

**Independências declaradas, para não inventar bloqueio:** #429 fecha independente da #430 · #434
**não** depende da #474 · #445 entra independente da #432 · as 17 correções de documentação não
esperam conserto nenhum.

## Colisão de arquivos — onde os PRs brigam

| Arquivo | Issues que o citam |
|---|---|
| `frontend/fluxo-caixa-motor.ts` | **25** |
| `frontend/funding-motor.ts` | 15 |
| `frontend/tela-fluxo-receitas.ts` | 14 |
| `frontend/fluxo-shared.ts` · `frontend/fluxo-invariantes.ts` | 13 cada |

Colisões declaradas, a ordenar: **#431 × #452** (#431 primeiro, ou quebra o `deepEqual` do no-op) ·
**#444 × #445** (mesmo arquivo, direções opostas) · **#447 × #472** · **#454 × #466** ·
**#437** antes de qualquer outro que toque `tela-dashboard.ts`.

## Migrações — Onda 8

Quatro issues exigem migração **e bump da `versao`** (hoje `0.1.28`): **#459 · #473 · #462 · #478**.
Só uma toma o número `030`; as outras tomam `031`/`032`/`033`, e o PR **declara qual**. O `030` está
livre — o que o autor recusou foi a migração `030` **do `linha_credito`**, não o número.
**As demais issues não bumpam `versao`.**

## Fora de alcance de sessão de nuvem

**Pinguim e produção são inalcançáveis** (403 no proxy de saída) e o token é do autor. As três
issues que dependiam disso — **#468**, **#464**, **#469** — foram **reescritas** para entregar
fixture e código testado no repo, com a execução contra instância virando passo opcional do autor.

## Pendências do autor

- **Branch protection** com `revisao/bloqueantes` como required check. Hoje `main` está
  `protected: false`, então o portão é conselho.
- Fazer os hooks do repo carregarem: o projeto do Claude Code é `/home/user`, e o
  `.claude/settings.json` do app mora num subdiretório, então **hooks e `permissions.deny` não são
  lidos**. Consequência: a proteção de escrita do monorepo fica desligada.
- `OPENAI_API_KEY` + liberação de `api.openai.com` — só para o **CLI local** do Codex, que é
  fallback. O **GitHub App já funciona** e é o caminho normal.

## Como retomar numa sessão nova

1. Ler `CLAUDE.md` (as três regras de escopo) e este arquivo.
2. `PROGRESSO.md`, só as duas ou três entradas do topo.
3. Olhar os PRs abertos e as issues com label `rodada-8`.
4. Pegar a próxima onda da tabela de estado, no topo.

**O que NÃO refazer:** `docs/rodada-8/25-issues-final.md` é a fonte de verdade das issues, com dois
apêndices; `docs/rodada-8/07-consolidado-issues.md` guarda os corpos do Bloco 8-A. As decisões do
autor estão em `docs/rodada-8/24-perguntas-multipla-escolha.md:645` e são **vinculantes**.

## Divisão de trabalho que funcionou

A sessão principal **orquestra**: decide ordem, resolve conflito, mergeia. **Subagentes implementam**
— um por PR, cada um levando a issue até o PR revisado pelo Codex, **sem mergear**. O merge fica com
a sessão principal, porque é ele que preserva a ordem de pré-requisitos.

Ganho medido: um subagente entregou dois PRs completos e revisados consumindo o próprio contexto,
custando à sessão principal apenas o resumo final.

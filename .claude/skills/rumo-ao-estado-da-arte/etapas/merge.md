# Etapa MERGE — no fim do dia, o que ficou pronto entra

Não implementa item novo. Leva até o merge o que o Construtor deixou pronto e escreve o painel do
dia.

## 1. O que entra

Os PRs desta rotina (branch `claude/rotina-*`) com o rótulo `pronto-para-merge`, mais os PRs cuja
caixa o dono marcou no painel. Do mais antigo para o mais novo, **um de cada vez**.

## 2. Para cada PR

1. Sincronize com a branch principal **por merge** (nunca rebase nem force-push).
2. A sincronização mudou arquivo do PR? Faça a rodada delta de revisão pela `revisar-pr-apps`.
   Não mudou? A revisão anterior vale.
3. Espere o CI do head atual, que tem de ser **posterior** ao último commit da branch principal, e
   confira a revisão sem bloqueante no head atual (no app de viabilidade, `revisao/bloqueantes`).
4. Pode mergear se a exceção de merge do processo do repositório libera esta tarefa agendada para
   aquele item (no app de viabilidade, `CLAUDE.md` § Merge: pequeno ou médio, nada sensível) ou se
   o dono aprovou no painel. Senão, vai para "Aprovados, aguardando o seu merge", com o motivo.
5. Não passou (CI vermelho, bloqueante, conflito que não se resolve): tire o
   `pronto-para-merge`, explique no `Continuação:` e deixe para o Construtor.
6. Mergeou: confira que a issue fechou, deixe o `Continuação:` e liste em "Feito sem perguntar"
   com o jeito de desfazer.

## 3. Release e painel

A proposta de release é desta etapa (`etapas/execucao.md` § 6, que segue valendo para a regra). Por
fim, escreva o painel do dia: o que entrou, o que espera o dono e a fila para o Construtor do dia
seguinte. Título da sessão: `[<apelido>] merge #PR1, #PR2 - DD/MM` (SKILL.md § 8).

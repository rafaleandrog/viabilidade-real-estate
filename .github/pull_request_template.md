## O que mudou

<!-- Resuma a alteração e o impacto para quem usa ou mantém o app. -->

## Issues

<!--
Toda referência #NNN no corpo ou nos commits precisa ser classificada abaixo.

Issue entregue: repita a keyword para cada número.
  Closes #NNN

Issue citada apenas como contexto:
  Sem-fechamento: #NNN motivo para permanecer aberta.

Para mencionar outra pull request sem acionar o guard, escreva "PR NNN" ou
cole a URL /pull/NNN; não use "PR #NNN".

Apague as linhas que não se aplicam. Não use intervalos nem listas como
"Closes #NNN, #NNN": a keyword precisa ser repetida para cada issue.
-->

Closes #NNN

Sem-fechamento: #NNN motivo.

## Revisão

<!--
O passo 6 do processo obrigatório (CLAUDE.md § Processo obrigatório de trabalho).
O relatório completo é um COMENTÁRIO neste PR, publicado pela skill revisar-pr-apps —
não cole o relatório aqui. Estas três linhas são só o ponteiro para ele.

O commit status `revisao/bloqueantes` é publicado a partir do comentário, não daqui:
preencher estas linhas sem ter revisado não deixa o PR verde.
-->

- Relatório: <!-- link do comentário da última rodada -->
- Head revisado: <!-- sha curto -->
- Motor: <!-- codex | nativo (e o motivo, se nativo) -->

## Validação

<!-- Liste os comandos/checks executados e qualquer limitação conhecida. -->

- [ ] `node scripts/preflight-pr.mjs --corpo <arquivo>` verde ANTES de abrir o PR
- [ ] Guards locais aplicáveis
- [ ] Testes aplicáveis
- [ ] Typecheck/build aplicáveis


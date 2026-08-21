#!/bin/bash
# Guarda do monorepo — roda como PreToolUse hook (.claude/settings.json).
#
# REGRA QUE ELE DEFENDE: `urbiverso/urbiverso` é SÓ LEITURA. Ele existe nesta
# máquina (em /home/user/urbiverso) para consulta de referência — como o app roda
# no ambiente da plataforma, prop de primitivo `urbi-*`, doc do shell. É proibido
# editar, commitar, empurrar, abrir issue ou abrir PR nele.
#
# POR QUE UM HOOK, E NÃO SÓ `permissions.deny`:
#   - deny casa NOME DE FERRAMENTA, não argumento. Não há como negar
#     `mcp__github__create_pull_request` só para owner=urbiverso — ou nega para
#     todo mundo, ou não nega. Este hook lê o argumento.
#   - deny não cobre `Bash`: `sed -i`, `tee`, heredoc, `git -C <path> commit`.
#   - E se o padrão de caminho do deny não casar, ele falha CALADO.
# Os dois mecanismos são redundantes DE PROPÓSITO.
#
# O QUE ELE NÃO É: sandbox. `cd` + caminho relativo, symlink, caminho montado em
# variável ou script intermediário passam. Ele guarda a sessão distraída, não a
# determinada. A defesa hermética seria não anexar o monorepo a estas sessões.
#
# Contrato: exit 0 = deixa passar; exit 2 = BLOQUEIA (o stderr volta ao modelo).
# Qualquer erro interno deixa passar — um guard quebrado não pode travar a sessão.
set -uo pipefail

MONO_PATH='/home/user/urbiverso'
MONO_REPO='urbiverso/urbiverso'

ENTRADA="$(cat)" || exit 0
command -v jq >/dev/null 2>&1 || exit 0

FERRAMENTA="$(printf '%s' "$ENTRADA" | jq -r '.tool_name // empty' 2>/dev/null)" || exit 0
[ -n "$FERRAMENTA" ] || exit 0

bloqueia() {
  echo "BLOQUEADO pela guarda do monorepo: $1" >&2
  echo "" >&2
  echo "\`$MONO_REPO\` é SÓ LEITURA nesta sessão — referência, nunca destino de escrita." >&2
  echo "Não edite, não commite, não empurre, não abra issue nem PR lá." >&2
  echo "Ler (Read/Grep/Glob/git log) continua liberado e é para isso que ele está aqui." >&2
  echo "" >&2
  echo "Se a mudança pertence à plataforma, o desfecho é DESCREVÊ-LA — no relatório de revisão" >&2
  echo "ou numa issue DESTE repositório — para o autor levar adiante na conta dele." >&2
  echo "Ver CLAUDE.md § \"O monorepo \\\`urbiverso/urbiverso\\\` é só leitura\"." >&2
  exit 2
}

case "$FERRAMENTA" in
  Write|Edit|MultiEdit|NotebookEdit)
    ALVO="$(printf '%s' "$ENTRADA" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)"
    case "$ALVO" in
      "$MONO_PATH"|"$MONO_PATH"/*) bloqueia "$FERRAMENTA em $ALVO" ;;
    esac
    ;;

  Bash)
    CMD="$(printf '%s' "$ENTRADA" | jq -r '.tool_input.command // empty' 2>/dev/null)"
    # Só interessa comando que ENCOSTA no monorepo. Sem isso, o guard acusaria
    # `rm` de qualquer coisa e viraria ruído — e guard ruidoso é desligado.
    if printf '%s' "$CMD" | grep -qF -e "$MONO_PATH" -e "$MONO_REPO"; then
      # git -C <monorepo> com verbo que escreve, em qualquer posição
      if printf '%s' "$CMD" | grep -qE "git[[:space:]]+(-C[[:space:]]+)?[^|;&]*${MONO_PATH//\//\\/}[^|;&]*[[:space:]]+(commit|push|add|checkout|switch|merge|rebase|reset|apply|am|cherry-pick|tag|worktree|clean|rm|mv|stash)"; then
        bloqueia "comando git de escrita no monorepo"
      fi
      if printf '%s' "$CMD" | grep -qE "git[[:space:]]+-C[[:space:]]+${MONO_PATH//\//\\/}"; then
        # `git -C <mono>` com verbo de leitura (log, show, diff, status) é legítimo.
        if printf '%s' "$CMD" | grep -qvE "git[[:space:]]+-C[[:space:]]+${MONO_PATH//\//\\/}[[:space:]]+(log|show|diff|status|rev-parse|rev-list|ls-files|ls-tree|cat-file|blame|describe|branch[[:space:]]+--show-current|config[[:space:]]+--get)"; then
          bloqueia "comando git potencialmente de escrita no monorepo"
        fi
      fi
      # Verbos de escrita de shell apontando para lá
      if printf '%s' "$CMD" | grep -qE "(^|[[:space:]]|\||&)(rm|mv|cp|mkdir|touch|tee|truncate|chmod|chown|ln|dd)([[:space:]]|$)" \
         && printf '%s' "$CMD" | grep -qF "$MONO_PATH"; then
        bloqueia "comando de escrita de arquivo apontando para o monorepo"
      fi
      if printf '%s' "$CMD" | grep -qE "sed[[:space:]]+(-[a-zA-Z]*i|--in-place)"; then
        bloqueia "sed --in-place tocando o monorepo"
      fi
      if printf '%s' "$CMD" | grep -qE ">>?[[:space:]]*[\"']?${MONO_PATH//\//\\/}"; then
        bloqueia "redirecionamento de saída para dentro do monorepo"
      fi
    fi
    ;;

  mcp__github__*)
    OWNER="$(printf '%s' "$ENTRADA" | jq -r '.tool_input.owner // empty' 2>/dev/null)"
    if [ "$OWNER" = "urbiverso" ]; then
      # Leitura pelo GitHub é referência legítima; só a escrita é proibida.
      #
      # O verbo casa por PREFIXO ou por SUFIXO `_write`, nunca por substring solta:
      # `pull_request_read` contém "request" e seria bloqueado por engano — o que
      # quebraria a própria revisão de PR, que precisa ler PR. Falso positivo aqui
      # não é inofensivo: um guard que atrapalha o trabalho legítimo é desligado, e
      # aí ele não guarda mais nada.
      LOCAL="${FERRAMENTA#mcp__github__}"
      case "$LOCAL" in
        create_*|update_*|delete_*|add_*|merge_*|push_*|fork_*|enable_*|disable_*|request_*|resolve_*|unresolve_*|run_*|*_write|actions_run_trigger)
          bloqueia "$FERRAMENTA com owner=urbiverso" ;;
      esac
    fi
    ;;
esac

exit 0

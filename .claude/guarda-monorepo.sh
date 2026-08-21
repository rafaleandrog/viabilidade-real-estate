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
# ─── DESENHO, e por que ele mudou (revisão do PR #424, rodada 1) ───────────────
#
# A v1 decidia por "não é verbo de leitura → bloqueia". Isso produziu os DOIS
# erros ao mesmo tempo, e os dois foram provados na revisão:
#
#   - FALSO POSITIVO: `grep -v` inverte por LINHA. Um comando de duas linhas
#     (`git -C mono log` + `echo x`) era bloqueado, embora fosse leitura pura.
#     Falso positivo aqui não é inofensivo: guard que atrapalha é desligado.
#   - FALSO NEGATIVO: `cd /home/user/urbiverso && git commit` passava, porque o
#     caminho não aparecia depois do `git` na mesma cláusula. É o idioma MAIS
#     natural para editar o monorepo — e foi exatamente assim que a própria
#     sessão que escreveu esta guarda escreveu no monorepo sem querer, minutos
#     depois de escrevê-la, com `cd` + caminho relativo.
#
# A v2 inverte a lógica: **passa por padrão, bloqueia em VERBO DE ESCRITA
# explícito.** Nunca "não reconheci, então bloqueio". E soma o `cwd` do payload
# do hook ao teste de "isto encosta no monorepo?", que é o que fecha o buraco do
# `cd` — o comando pode não citar caminho nenhum.
#
# O QUE ELE CONTINUA NÃO SENDO: sandbox. Symlink, caminho montado em variável ou
# script intermediário passam. Ele guarda a sessão distraída, não a determinada.
# A defesa hermética seria não anexar o monorepo a estas sessões.
#
# Contrato: exit 0 = deixa passar; exit 2 = BLOQUEIA (o stderr volta ao modelo).
# Erro interno deixa passar — um guard quebrado não pode travar a sessão.
set -uo pipefail

MONO_PATH='/home/user/urbiverso'
MONO_REPO='urbiverso/urbiverso'

ENTRADA="$(cat)" || exit 0

# `jq` é o caminho normal. Sem ele, NÃO viramos no-op: caímos num extrator de
# emergência por grep, que é grosseiro mas cobre os casos de caminho literal.
# Virar no-op calado seria a mesma falha que este arquivo existe para evitar.
campo() { # campo <chave>
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$ENTRADA" | jq -r --arg k "$1" '.[$k] // .tool_input[$k] // empty' 2>/dev/null
  else
    printf '%s' "$ENTRADA" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//'
  fi
}

FERRAMENTA="$(campo tool_name)"
[ -n "$FERRAMENTA" ] || exit 0
CWD="$(campo cwd)"

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

dentro_do_mono() { case "$1" in "$MONO_PATH"|"$MONO_PATH"/*) return 0 ;; *) return 1 ;; esac; }

case "$FERRAMENTA" in
  Write|Edit|MultiEdit|NotebookEdit)
    ALVO="$(campo file_path)"; [ -n "$ALVO" ] || ALVO="$(campo notebook_path)"
    # Caminho relativo com a sessão dentro do monorepo é escrita no monorepo.
    case "$ALVO" in /*) ;; *) [ -n "$CWD" ] && dentro_do_mono "$CWD" && bloqueia "$FERRAMENTA em caminho relativo com cwd no monorepo ($CWD)" ;; esac
    dentro_do_mono "$ALVO" && bloqueia "$FERRAMENTA em $ALVO"
    ;;

  Bash)
    CMD="$(campo command)"
    [ -n "$CMD" ] || exit 0

    # 1. Isto encosta no monorepo? Três formas — e a terceira é a que a v1 não via.
    ENCOSTA=0
    printf '%s' "$CMD" | grep -qF -e "$MONO_PATH" -e "$MONO_REPO" && ENCOSTA=1
    printf '%s' "$CMD" | grep -qE "cd[[:space:]]+[\"']?${MONO_PATH}" && ENCOSTA=1
    [ -n "$CWD" ] && dentro_do_mono "$CWD" && ENCOSTA=1
    [ "$ENCOSTA" = "1" ] || exit 0

    # 2. Encostando, procure VERBO DE ESCRITA. Só bloqueia se achar um: leitura
    #    desconhecida passa, de propósito (ver o desenho, no cabeçalho).
    GIT_ESCRITA='commit|push|add|checkout|switch|merge|rebase|reset|apply|am|cherry-pick|tag|worktree|clean|stash|fetch|pull|remote|init|gc|prune|filter-branch|update-ref|symbolic-ref|notes|replace'
    if printf '%s' "$CMD" | grep -qE "(^|[[:space:];&|])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)?[[:space:]]+($GIT_ESCRITA)([[:space:]]|$)"; then
      bloqueia "comando git de escrita encostando no monorepo"
    fi
    # `git branch`/`git config` só escrevem com flag; a forma nua lista e passa.
    if printf '%s' "$CMD" | grep -qE "(^|[[:space:];&|])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)?[[:space:]]+(branch[[:space:]]+-[dDmMf]|config[[:space:]]+--(global|local|add|unset|replace-all))"; then
      bloqueia "git branch/config de escrita encostando no monorepo"
    fi
    if printf '%s' "$CMD" | grep -qE "(^|[[:space:];&|])(rm|mv|cp|mkdir|rmdir|touch|tee|truncate|chmod|chown|ln|dd|install)([[:space:]]|$)"; then
      bloqueia "comando de escrita de arquivo encostando no monorepo"
    fi
    if printf '%s' "$CMD" | grep -qE "(^|[[:space:];&|])sed[[:space:]]+(-[a-zA-Z]*i|--in-place)"; then
      bloqueia "sed --in-place encostando no monorepo"
    fi
    if printf '%s' "$CMD" | grep -qE ">>?[[:space:]]*[\"']?(${MONO_PATH}|[^[:space:]/])"; then
      # Redirecionamento para caminho no monorepo, ou para caminho relativo com
      # a sessão dentro dele. `> /outro/lugar` absoluto fora do mono não casa.
      bloqueia "redirecionamento de saída encostando no monorepo"
    fi
    # Interpretador em uma linha é opaco para qualquer regex: `python3 -c
    # "open('<mono>/x','w')"` escreve sem usar nenhum verbo de shell. Encostando
    # no monorepo, ele é bloqueado por princípio — leitura se faz com Read/Grep.
    if printf '%s' "$CMD" | grep -qE "(^|[[:space:];&|])(python3?|node|perl|ruby|php)[[:space:]]+(-[a-zA-Z]*[ce])[[:space:]]"; then
      bloqueia "interpretador em uma linha encostando no monorepo (use Read/Grep para ler)"
    fi
    exit 0
    ;;

  mcp__github__*)
    OWNER="$(campo owner)"
    if [ "$OWNER" = "urbiverso" ]; then
      # Leitura pelo GitHub é referência legítima; só a escrita é proibida.
      #
      # O verbo casa por PREFIXO ou por SUFIXO `_write`, nunca por substring
      # solta: `pull_request_read` contém "request" e seria bloqueado por engano
      # — o que quebraria a própria revisão de PR, que precisa ler PR.
      LOCAL="${FERRAMENTA#mcp__github__}"
      case "$LOCAL" in
        create_*|update_*|delete_*|add_*|merge_*|push_*|fork_*|enable_*|disable_*|request_*|resolve_*|unresolve_*|run_*|*_write|actions_run_trigger)
          bloqueia "$FERRAMENTA com owner=urbiverso" ;;
      esac
    fi
    ;;
esac

exit 0

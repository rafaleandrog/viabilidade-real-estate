#!/bin/bash
# Bateria da guarda do monorepo (.claude/guarda-monorepo.sh).
#
# Existe porque um hook de PreToolUse falha CALADO nos dois sentidos, e os dois
# custam caro:
#   - falso negativo → a escrita no monorepo passa, e ninguém percebe;
#   - falso positivo → o guard atrapalha trabalho legítimo, alguém o desliga, e
#     aí ele não guarda mais nada. (Já aconteceu na escrita dele: a regex casava
#     "request" dentro de `pull_request_read` e bloqueava a leitura de PR — isto
#     é, quebrava a própria revisão.)
#
# Roda sem credencial, sem rede e sem SDK: só bash + jq.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

GUARDA='.claude/guarda-monorepo.sh'
[ -x "$GUARDA" ] || { echo "ERRO: $GUARDA não existe ou não é executável"; exit 1; }

FALHAS=0
t() { # t <esperado:BLOQUEIA|PASSA> <descrição> <json>
  local esp="$1" desc="$2" json="$3" rc got
  printf '%s' "$json" | bash "$GUARDA" >/dev/null 2>&1; rc=$?
  [ "$rc" = "2" ] && got=BLOQUEIA || got=PASSA
  if [ "$got" = "$esp" ]; then
    printf '  ok    %s\n' "$desc"
  else
    printf '  FALHA %s — esperado=%s obtido=%s\n' "$desc" "$esp" "$got"
    FALHAS=$((FALHAS+1))
  fi
}
mcp() { printf '{"tool_name":"mcp__github__%s","tool_input":{"owner":"%s","repo":"%s"}}' "$1" "$2" "$3"; }
bash_cmd() { jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
arq() { printf '{"tool_name":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2"; }

echo "Escrita em arquivo do monorepo — bloqueia:"
t BLOQUEIA "Write no CLAUDE.md do monorepo" "$(arq Write /home/user/urbiverso/CLAUDE.md)"
t BLOQUEIA "Edit em ui/src"                 "$(arq Edit /home/user/urbiverso/ui/src/urbi-badge.ts)"
t BLOQUEIA "MultiEdit no monorepo"          "$(arq MultiEdit /home/user/urbiverso/x.ts)"

echo "Escrita por Bash no monorepo — bloqueia:"
t BLOQUEIA "git -C mono commit"      "$(bash_cmd 'git -C /home/user/urbiverso commit -m x')"
t BLOQUEIA "git -C mono push"        "$(bash_cmd 'git -C /home/user/urbiverso push origin main')"
t BLOQUEIA "rm -rf no monorepo"      "$(bash_cmd 'rm -rf /home/user/urbiverso/docs')"
t BLOQUEIA "redirect para o mono"    "$(bash_cmd 'echo oi > /home/user/urbiverso/nota.txt')"
t BLOQUEIA "sed -i no monorepo"      "$(bash_cmd 'sed -i s/a/b/ /home/user/urbiverso/CLAUDE.md')"

echo "Escrita pelo GitHub no monorepo — bloqueia:"
for f in create_pull_request issue_write sub_issue_write add_issue_comment merge_pull_request \
         push_files create_or_update_file delete_file update_pull_request_branch fork_repository \
         enable_pr_auto_merge request_copilot_review resolve_review_thread unresolve_review_thread \
         pull_request_review_write add_comment_to_pending_review actions_run_trigger; do
  t BLOQUEIA "$f" "$(mcp "$f" urbiverso urbiverso)"
done

echo "Leitura do monorepo — passa (é para isso que ele está aqui):"
t PASSA "Read de ui/src"     "$(arq Read /home/user/urbiverso/ui/src/urbi-badge.ts)"
t PASSA "cat do monorepo"    "$(bash_cmd 'cat /home/user/urbiverso/CLAUDE.md')"
t PASSA "git -C mono log"    "$(bash_cmd 'git -C /home/user/urbiverso log --oneline -5')"
t PASSA "grep no monorepo"   "$(bash_cmd 'grep -n prop /home/user/urbiverso/ui/src/urbi-avatar.ts')"
for f in pull_request_read issue_read get_file_contents list_issues search_code \
         list_pull_requests get_commit list_branches get_check_run actions_list; do
  t PASSA "$f" "$(mcp "$f" urbiverso urbiverso)"
done

echo "Trabalho neste repositório — passa:"
t PASSA "Write neste repo"   "$(arq Write /home/user/viabilidade-real-estate/frontend/x.ts)"
t PASSA "rm neste repo"      "$(bash_cmd 'rm -f /home/user/viabilidade-real-estate/tmp.txt')"
t PASSA "git commit aqui"    "$(bash_cmd 'git commit -m x')"
for f in create_pull_request issue_write merge_pull_request add_issue_comment; do
  t PASSA "$f (rafaleandrog)" "$(mcp "$f" rafaleandrog viabilidade-real-estate)"
done

echo
if [ "$FALHAS" = "0" ]; then
  echo "ok: guarda do monorepo passou em todos os casos."
  exit 0
fi
echo "FALHOU: $FALHAS caso(s) da guarda do monorepo."
exit 1

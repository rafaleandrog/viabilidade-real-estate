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
# Com `cwd` — o eixo que a v1 não tinha e por onde a escrita acidental passou.
bash_cwd() { jq -nc --arg c "$1" --arg d "$2" '{tool_name:"Bash",cwd:$d,tool_input:{command:$c}}'; }
arq() { printf '{"tool_name":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2"; }
arq_cwd() { jq -nc --arg t "$1" --arg f "$2" --arg d "$3" '{tool_name:$t,cwd:$d,tool_input:{file_path:$f}}'; }
MONO=/home/user/urbiverso

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

echo "cwd dentro do monorepo — bloqueia (o caso que escapou de verdade):"
# Uma sessão rodou `cd /home/user/urbiverso` para inspecionar, o cwd do shell
# persistiu, e o comando seguinte usou caminho RELATIVO achando estar no repo da
# app — escrevendo no monorepo. Nenhum caminho literal aparecia no comando, então
# a v1 não tinha como ver. Estes casos são a regressão dessa falha.
t BLOQUEIA "cd mono && git commit"        "$(bash_cmd "cd $MONO && git commit -am x")"
t BLOQUEIA "cd mono && git push"          "$(bash_cmd "cd $MONO && git push origin main")"
t BLOQUEIA "git commit com cwd no mono"   "$(bash_cwd 'git commit -am x' "$MONO")"
t BLOQUEIA "python3 -c escrevendo lá"     "$(bash_cmd "python3 -c \"open('$MONO/x','w').write('1')\"")"
t BLOQUEIA "python3 relativo, cwd no mono" "$(bash_cwd "python3 -c \"open('.claude/settings.json','w')\"" "$MONO")"
t BLOQUEIA "Write relativo, cwd no mono"  "$(arq_cwd Write .claude/settings.json "$MONO")"
t BLOQUEIA "git branch -D"                "$(bash_cmd "git -C $MONO branch -D main")"

echo "Leitura do monorepo — passa (é para isso que ele está aqui):"
# Falso positivo NÃO é inofensivo: guard que atrapalha trabalho legítimo é
# desligado, e aí ele não guarda mais nada. A v1 bloqueava leitura multilinha
# porque decidia por "não é verbo de leitura"; a v2 decide por verbo de escrita.
t PASSA "leitura em 2 linhas"   "$(bash_cmd "$(printf 'git -C %s log --oneline\necho pronto' "$MONO")")"
t PASSA "echo + status"         "$(bash_cmd "$(printf 'echo x\ngit -C %s status' "$MONO")")"
t PASSA "git branch (lista)"    "$(bash_cmd "git -C $MONO branch")"
t PASSA "git show | head"       "$(bash_cmd "git -C $MONO show HEAD:CLAUDE.md | head")"
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

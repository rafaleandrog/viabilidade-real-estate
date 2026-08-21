#!/bin/bash
# Bateria do parsing do workflow `revisao-registrada`.
#
# POR QUE EXISTE: o job publica um commit status a partir de uma linha HTML nos
# comentários do PR. Se o pipeline de extração quebrar, ele não fica vermelho —
# ele reprova um PR revisado com "nenhuma revisão registrada", que parece um
# veredito legítimo. Aconteceu no head 310156e: `gh api --jq --arg a "$AUTOR" …`
# morreu com "accepts 1 arg(s), received 4" (o `gh api --jq` aceita UMA expressão
# e nada mais), a busca voltou vazia, e o PR revisado foi reprovado.
#
# O `gh` não existe no ambiente de desenvolvimento, então a bateria exercita o
# que dá para exercitar sem ele: a expressão `jq` e o `grep`/`cut` que decidem o
# veredito. É exatamente a parte que quebrou.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

WF='.github/workflows/revisao-registrada.yml'
FALHAS=0
ok()   { printf '  ok    %s\n' "$1"; }
falha(){ printf '  FALHA %s — %s\n' "$1" "$2"; FALHAS=$((FALHAS+1)); }

# A expressão que o workflow usa, extraída DELE — se alguém mudar lá sem mudar
# aqui, a bateria passa a testar outra coisa e não avisa. Por isso é lida, não
# copiada.
EXPR="$(grep -o "\.\[\] | select(\.user\.login == env\.AUTOR) | \.body" "$WF" | head -1)"
if [ -z "$EXPR" ]; then
  falha "expressão jq" "não achei a expressão de filtro por autor em $WF (mudou o formato?)"
else
  ok "expressão jq encontrada em $WF"
fi

# ⚠️ Guard contra a regressão exata: `gh api --jq` com `--arg` é erro de uso.
# Linha de COMENTÁRIO fica de fora — o próprio workflow explica no cabeçalho por
# que essa forma não serve, e um guard que reprovasse a explicação obrigaria a
# apagar a memória do conserto. Mesma regra do job `migracao-declarativa`.
if grep -v '^[[:space:]]*#' "$WF" | grep -q -- '--jq --arg'; then
  falha "gh api --jq --arg" "gh api aceita UMA expressão em --jq; use env.VAR"
else
  ok "nenhum 'gh api --jq --arg' (o erro que reprovou o head 310156e)"
fi

COMENTARIOS='[
 {"user":{"login":"autor"},   "body":"<!-- revisao-viabilidade rodada=1 head=aaaa1111 motor=nativo bloqueantes=0 contratos=nao-executados -->\nrelatorio"},
 {"user":{"login":"forjador"},"body":"<!-- revisao-viabilidade rodada=9 head=aaaa1111 motor=codex bloqueantes=0 contratos=ok -->"},
 {"user":{"login":"autor"},   "body":"<!-- revisao-viabilidade rodada=1 head=bbbb2222 motor=nativo bloqueantes=3 contratos=ok -->"}
]'
extrai() { # extrai <autor>
  printf '%s' "$COMENTARIOS" | AUTOR="$1" jq -r "$EXPR" 2>/dev/null \
    | grep -o '<!-- revisao-viabilidade [^>]*-->' || true
}
veredito() { # veredito <linhas> <head-curto>
  local deste; deste="$(printf '%s\n' "$1" | grep -F "head=$2" || true)"
  [ -n "$deste" ] || { echo "sem-revisao"; return; }
  local b; b="$(printf '%s\n' "$deste" | tail -1 | grep -o 'bloqueantes=[0-9]*' | cut -d= -f2)"
  [ "${b:-1}" = "0" ] && echo "success" || echo "failure"
}

L="$(extrai autor)"
[ "$(printf '%s\n' "$L" | wc -l)" = "2" ] && ok "filtra por autor (2 linhas do autor, 0 do forjador)" \
  || falha "filtro por autor" "esperava 2 linhas, veio: $(printf '%s' "$L" | wc -l)"
printf '%s' "$L" | grep -q 'rodada=9' && falha "comentário forjado" "a linha do forjador entrou" \
  || ok "comentário forjado por terceiro é ignorado"

[ "$(veredito "$L" aaaa1111)" = "success" ] && ok "head revisado com 0 bloqueantes → success" \
  || falha "veredito success" "veio $(veredito "$L" aaaa1111)"
[ "$(veredito "$L" bbbb2222)" = "failure" ] && ok "head com 3 bloqueantes → failure" \
  || falha "veredito failure" "veio $(veredito "$L" bbbb2222)"
[ "$(veredito "$L" cccc3333)" = "sem-revisao" ] && ok "head nunca revisado → sem revisão" \
  || falha "veredito sem-revisao" "veio $(veredito "$L" cccc3333)"

# `set +e` é o que mantém a invariante "o job sempre passa": o shell do Actions é
# `bash -e {0}`, e `set -uo pipefail` NÃO remove o errexit herdado.
grep -q '^          set +e$' "$WF" && ok "'set +e' presente (o Actions roda bash -e)" \
  || falha "set +e" "sem ele, um grep sem casamento mata o job antes de publicar o status"

echo
if [ "$FALHAS" = "0" ]; then echo "ok: parsing do revisao-registrada passou em todos os casos."; exit 0; fi
echo "FALHOU: $FALHAS caso(s)."; exit 1

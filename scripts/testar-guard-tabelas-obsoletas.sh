#!/bin/bash
# Bateria do `scripts/guard-tabelas-obsoletas.mjs`.
#
# POR QUE EXISTE, e por que testa os DOIS sentidos: é a mesma lição das baterias
# `testar-guarda-monorepo.sh` e `testar-revisao-registrada.sh`. Falso NEGATIVO
# deixa o reúso da tabela aposentada entrar em `frontend/`/`backend/` sem que
# nada fique vermelho — o guard vira papel de parede. Falso POSITIVO atrapalha
# trabalho legítimo, alguém tira o job do CI, e aí ele não guarda mais nada.
#
# DETERMINÍSTICA POR CONSTRUÇÃO: cada caso monta uma árvore de fixtures nova em
# `mktemp -d` e roda o guard contra ELA (`node … <raiz>`). Nenhum caso depende do
# estado da árvore de trabalho, então o veredito não muda conforme o que mais
# estiver commitado, em stage ou sujo no repositório. O guard rodando contra o
# repositório real é o job de CI, não esta bateria — são coisas diferentes e
# ficam separadas de propósito.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

GUARD="$PWD/scripts/guard-tabelas-obsoletas.mjs"
ALVO='avancado_capital_instrumentos'   # a entrada real do registro OBSOLETAS
FALHAS=0
ok()    { printf '  ok    %s\n' "$1"; }
falha() { printf '  FALHA %s — %s\n' "$1" "$2"; FALHAS=$((FALHAS+1)); }

TMPRAIZ="$(mktemp -d)"
trap 'rm -rf "$TMPRAIZ"' EXIT

# arvore <nome> — cria uma árvore de fixtures com a base LEGÍTIMA (as mesmas
# classes de caminho que a `main` tem hoje) e ecoa a raiz.
arvore() {
  local raiz="$TMPRAIZ/$1"
  mkdir -p "$raiz"/{migracoes,docs,scripts,frontend,backend/rotas,.github/workflows}
  printf 'await dados.listar("%s", {});\n'          "$ALVO" > "$raiz/migracoes/029_funding.js"
  printf 'await dados.atualizar("%s", id, {});\n'   "$ALVO" > "$raiz/migracoes/028_retro.js"
  printf 'A tabela `%s` foi aposentada pela #355.\n' "$ALVO" > "$raiz/docs/adr.md"
  printf '  %s: [ { id: 1 } ],\n'                    "$ALVO" > "$raiz/scripts/migracoes-harness.mjs"
  printf '{ "tabelas": { "%s": {} } }\n'             "$ALVO" > "$raiz/schema.json"
  printf 'a tabela nova `%s`);\n'                    "$ALVO" > "$raiz/CLAUDE.md"
  printf 'tabela nova `%s`);\n'                      "$ALVO" > "$raiz/PROGRESSO.md"
  # Menção em COMENTÁRIO dentro de caminho BARRADO — o caso real de
  # `backend/rotas/funding.ts:8`, que precisa continuar passando.
  printf '// Substituem as rotas de `%s` (modelo descartado).\nexport const x = 1;\n' "$ALVO" \
    > "$raiz/backend/rotas/funding.ts"
  printf 'export const y = 2;\n' > "$raiz/frontend/tela-funding.ts"
  printf 'jobs:\n  guard:\n    runs-on: ubuntu-latest\n' > "$raiz/.github/workflows/pr-guards.yml"
  printf '%s' "$raiz"
}

# roda <raiz> — ecoa o exit code do guard, engolindo a saída.
roda() { node "$GUARD" "$1" >/dev/null 2>&1; echo $?; }

# ── Sentido 1: FALSO POSITIVO — a base legítima tem que PASSAR ───────────────
# É a réplica do critério de aceite "passa na main atual", só que sem depender
# da main: as sete classes de caminho permitidas estão todas exercitadas.
R="$(arvore base)"
[ "$(roda "$R")" = "0" ] && ok "árvore só com menções legítimas passa (migracoes/ docs/ scripts/ schema.json CLAUDE.md PROGRESSO.md)" \
  || falha "falso positivo na base" "o guard reprovou uma árvore que só tem menções permitidas"

# ── Sentido 2: FALSO NEGATIVO — consumidor novo tem que ser BARRADO ──────────
R="$(arvore fe)"
printf 'const t = "%s";\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "1" ] && ok "consumidor novo em frontend/ é barrado" \
  || falha "falso negativo em frontend/" "o guard aprovou código novo que consome a tabela aposentada"

R="$(arvore be)"
printf "await req.dados.listar('%s', {});\n" "$ALVO" >> "$R/backend/rotas/funding.ts"
[ "$(roda "$R")" = "1" ] && ok "consumidor novo em backend/ é barrado" \
  || falha "falso negativo em backend/" "o guard aprovou rota nova que consome a tabela aposentada"

R="$(arvore raiz)"
printf 'const t = "%s";\n' "$ALVO" > "$R/algum-script.ts"
[ "$(roda "$R")" = "1" ] && ok "consumidor na RAIZ é barrado ('o resto' também é barrado, não só frontend/backend/)" \
  || falha "falso negativo na raiz" "caminho fora da allowlist tem que ser barrado"

R="$(arvore ci)"
printf '      run: grep -r %s frontend/\n' "$ALVO" >> "$R/.github/workflows/pr-guards.yml"
[ "$(roda "$R")" = "1" ] && ok ".github/ não é caminho permitido" \
  || falha "falso negativo em .github/" "workflow não está na allowlist e deveria ser barrado"

# ── As QUATRO combinações de comentário × código ─────────────────────────────
# A primeira versão do guard descartava a LINHA INTEIRA quando ela começava com
# qualquer marcador de qualquer linguagem. Dava exit 0 para código executável
# real — o Codex provou executando. Guard que dá licença é pior que guard
# nenhum, então as quatro combinações são fixadas aqui, uma a uma.

# (1) comentário PURO → passa. É o precedente do job `migracao-declarativa`: a
#     base já traz o cabeçalho de `backend/rotas/funding.ts`, e reprová-lo
#     obrigaria a apagar a memória do conserto.
R="$(arvore com1)"
printf '// menção histórica em comentário de linha: %s\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
printf '/* menção histórica\n   em bloco multi-linha: %s\n */\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "0" ] && ok "(1) comentário puro em caminho barrado NÃO é acusado (linha e bloco multi-linha)" \
  || falha "(1) comentário acusado" "reprovar a explicação obrigaria a apagar a memória do conserto"

# (2) código PURO → barra.
R="$(arvore com2)"
printf 'const t = "%s";\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "1" ] && ok "(2) código puro é barrado" \
  || falha "(2) falso negativo" "referência em código executável tem que ser barrada"

# (3) código DEPOIS de bloco fechado na mesma linha → barra.
#     ⚠️ REGRESSÃO VERIFICADA: antes do conserto isto dava exit 0.
R="$(arvore com3)"
printf '/* compat */ const t = "%s";\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "1" ] && ok "(3) código depois de bloco /* … */ fechado é barrado (dava exit 0 antes do conserto)" \
  || falha "(3) falso negativo do bloco fechado" "a dispensa é da PORÇÃO comentada, nunca da linha inteira"

# (4) campo privado de classe `#` em TS → barra.
#     ⚠️ REGRESSÃO VERIFICADA: antes do conserto isto dava exit 0, porque `#`
#     era tratado como comentário em TODO tipo de arquivo. `#` é comentário em
#     shell/YAML e é campo privado em JS/TS — a família importa.
R="$(arvore com4)"
printf 'class Repo {\n  #tabela = "%s";\n}\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "1" ] && ok "(4) campo privado #tabela em TS é barrado (dava exit 0 antes do conserto)" \
  || falha "(4) falso negativo do campo privado" "'#' é comentário em shell/YAML, NÃO em JS/TS"

# ── Consequências do scanner ser por FAMÍLIA e ciente de string ──────────────
R="$(arvore fam)"
printf '# comentário de YAML: %s\n' "$ALVO" >> "$R/.github/workflows/pr-guards.yml"
[ "$(roda "$R")" = "0" ] && ok "'#' É comentário em .yml (o job novo cita a tabela num comentário)" \
  || falha "família yaml" "'#' precisa continuar valendo como comentário em YAML"

R="$(arvore str)"
printf 'const u = "http://api/%s";\n' "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "1" ] && ok "'//' dentro de string NÃO vira comentário (scanner é ciente de aspas)" \
  || falha "string engolida" "http:// não pode cegar o resto da linha"

R="$(arvore blk)"
printf '/* abre bloco\n%s\n*/ const t = "%s";\n' "$ALVO" "$ALVO" >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "1" ] && ok "bloco multi-linha dispensa o miolo mas NÃO o código depois do fechamento" \
  || falha "estado de bloco" "o código depois de */ na última linha tem que ser barrado"

# ── Casamento: não pode ser substring solta nem perder o alvo ────────────────
R="$(arvore vizinho)"
printf 'const t = "avancado_funding_operacoes";\nconst u = "avancado_capital_instrumentos_v2";\n' \
  >> "$R/frontend/tela-funding.ts"
[ "$(roda "$R")" = "0" ] && ok "tabela substituta e nome com sufixo não disparam o guard" \
  || falha "casamento largo demais" "o guard acusou nome que não está no registro"

# ── Autoconferência do registro ──────────────────────────────────────────────
node -e '
  import("file://'"$GUARD"'").then(({ OBSOLETAS }) => {
    const n = Object.keys(OBSOLETAS ?? {});
    if (n.length === 0) process.exit(1);
    for (const m of Object.values(OBSOLETAS)) {
      if (!m.substituta || !m.issue || !m.motivo) process.exit(1);
      // `consumidores` entrou porque o `motivo` afirmava que so a 029 lia a
      // tabela — falso: a 019 cria e a 028 le E ESCREVE. Texto de diagnostico
      // do CI nao pode nascer mentindo.
      if (!Array.isArray(m.consumidores) || m.consumidores.length < 3) process.exit(1);
      if (!m.consumidores.some((c) => c.includes("028"))) process.exit(1);
    }
    if (!OBSOLETAS["'"$ALVO"'"]) process.exit(1);
    process.exit(0);
  }).catch(() => process.exit(1));
' && ok "registro OBSOLETAS exportado, com substituta/issue/motivo/consumidores (as 3 migrações, a 028 inclusive)" \
  || falha "registro OBSOLETAS" "a etiqueta é o registro; sem ele o guard não tem o que guardar"

# ── O guard não pode depender de SDK nem de rede ─────────────────────────────
if grep -qE "from '(@urbiverso|node:https|node:http)" scripts/guard-tabelas-obsoletas.mjs; then
  falha "dependência proibida" "o guard importa SDK ou rede; o CI de PR não tem credencial e ficaria vermelho"
else
  ok "guard usa só módulos de node:fs/path/url (sem SDK, sem rede)"
fi

# ── O job existe no CI, com timeout ──────────────────────────────────────────
WF='.github/workflows/pr-guards.yml'
grep -q '^  tabelas-obsoletas:$' "$WF" && ok "job 'tabelas-obsoletas' presente em $WF" \
  || falha "job ausente" "o guard só protege se estiver ligado no CI"
awk '/^  tabelas-obsoletas:$/,0' "$WF" | grep -q 'timeout-minutes:' \
  && ok "job declara timeout-minutes (sem ele o default do GitHub é 6 HORAS)" \
  || falha "sem timeout-minutes" "regra do CLAUDE.md § Duas regras de CI"
awk '/^  tabelas-obsoletas:$/,0' "$WF" | grep -q 'scripts/testar-guard-tabelas-obsoletas.sh' \
  && ok "o job também roda esta bateria" \
  || falha "bateria não ligada" "bateria que não roda no CI é pior que bateria que não existe"

echo
if [ "$FALHAS" = "0" ]; then echo "ok: guard de tabelas obsoletas passou em todos os casos."; exit 0; fi
echo "FALHOU: $FALHAS caso(s)."; exit 1

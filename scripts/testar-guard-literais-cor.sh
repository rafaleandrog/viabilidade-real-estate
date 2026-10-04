#!/bin/bash
# Bateria do `scripts/guard-literais-cor-bundle.mjs` e do contador
# `scripts/lib/literais-cor.mjs`.
#
# POR QUE TESTA OS DOIS SENTIDOS: falso negativo deixa o aviso da instância
# voltar sem ninguém ver aqui; falso positivo reprova bundle correto, alguém
# desliga o guard, e ele para de guardar. E o contador é CÓPIA do da
# plataforma: os casos de "não conta" (dígitos puros curtos, comentário de
# bloco, chamada de método) são as exclusões dela, e se um deles passar a
# contar, a cópia divergiu.
#
# DETERMINÍSTICA: cada caso monta um diretório em `mktemp -d`; nenhum lê a
# árvore de trabalho nem depende de build.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

GUARD="$PWD/scripts/guard-literais-cor-bundle.mjs"
FALHAS=0
ok()    { printf '  ok    %s\n' "$1"; }
falha() { printf '  FALHA %s — %s\n' "$1" "$2"; FALHAS=$((FALHAS+1)); }

TMPRAIZ="$(mktemp -d)"
trap 'rm -rf "$TMPRAIZ"' EXIT

# caso <nome> <saída esperada> <arquivo> <conteúdo>
caso() {
  local nome="$1" esperado="$2" arquivo="$3" conteudo="$4"
  local dir="$TMPRAIZ/$nome"
  mkdir -p "$dir/$(dirname "$arquivo")"
  printf '%s' "$conteudo" > "$dir/$arquivo"
  node "$GUARD" "$dir" >/dev/null 2>&1
  local saiu=$?
  if [ "$saiu" = "$esperado" ]; then ok "$nome"; else falha "$nome" "saiu $saiu, esperado $esperado"; fi
}

# ── conta (sai 1) ───────────────────────────────────────────────────────────
caso hex-3           1 index.js 'const s = `td { border-color: #eee; }`;'
caso hex-6           1 index.js 'x = "#13a98d"'
caso hex-8           1 index.js 'x = "#13a98dff"'
caso hex-digitos-6   1 index.js 'x = "#111111"'
caso rgba            1 index.js 'x = "rgba(0,0,0,.5)"'
caso hsl             1 index.js 'x = "hsl(10 20% 30%)"'
caso oklch           1 index.js 'x = "oklch(0.7 0.1 200)"'
caso fallback-token  1 index.js 'x = "var(--cor-texto, #fff)"'
caso css             1 estilo.css 'a { color: #abc }'
caso html            1 pagina.html '<p style="color:#abcdef">x</p>'
caso subdiretorio    1 sub/dir/index.js 'x = "#abc"'
caso comentario-linha 1 index.js '// #abcdef ainda conta: a plataforma só tira comentário de bloco'

# ── não conta (sai 0) ───────────────────────────────────────────────────────
caso limpo           0 index.js 'const s = `td { color: var(--cor-texto); border-bottom: 1px solid; }`;'
caso digitos-curtos  0 index.js 'x = "#111 #666 #1234 #12345"'
caso comentario-bloco 0 index.js '/* #abcdef rgba(0,0,0,1) */ x = 1'
caso metodo          0 index.js 'x = chroma.color(1); y = d3.lab(2)'
caso identificador   0 index.js 'x = matlab(1)'
caso hash-longo      0 index.js 'x = "#0123456789abcdef"'
# Sozinhos, os dois abaixo saem 2 (nada lido) — o que já prova que o arquivo
# ficou FORA da varredura. Depois, com um .js limpo ao lado, têm de sair 0.
caso extensao-fora   2 index.js.map '{"x":"#abcdef"}'
caso node-modules    2 node_modules/lib/index.js 'x = "#abcdef"'

for nome in extensao-fora node-modules; do
  printf 'x = 1' > "$TMPRAIZ/$nome/index.js"
  node "$GUARD" "$TMPRAIZ/$nome" >/dev/null 2>&1
  saiu=$?
  if [ "$saiu" = 0 ]; then ok "$nome (com .js limpo ao lado)"; else falha "$nome (com .js limpo ao lado)" "saiu $saiu, esperado 0"; fi
done

# ── não deu para conferir (sai 2) ──────────────────────────────────────────
node "$GUARD" >/dev/null 2>&1; s=$?
[ "$s" = 2 ] && ok "sem argumento" || falha "sem argumento" "saiu $s, esperado 2"
node "$GUARD" "$TMPRAIZ/nao-existe" >/dev/null 2>&1; s=$?
[ "$s" = 2 ] && ok "diretório inexistente" || falha "diretório inexistente" "saiu $s, esperado 2"
mkdir -p "$TMPRAIZ/vazio"
node "$GUARD" "$TMPRAIZ/vazio" >/dev/null 2>&1; s=$?
[ "$s" = 2 ] && ok "diretório sem .js/.css/.html" || falha "diretório sem .js/.css/.html" "saiu $s, esperado 2"

# ── a contagem, não só a presença ──────────────────────────────────────────
n=$(node -e "import('$PWD/scripts/lib/literais-cor.mjs').then((m) => console.log(m.contarLiteraisDeCor('#abc #111 rgba(1,2,3,1) /* #def */ #1234 #a1b2c3 x.rgb(1)')))")
[ "$n" = 3 ] && ok "contagem exata (3)" || falha "contagem exata" "contou $n, esperado 3"

echo
if [ "$FALHAS" -eq 0 ]; then echo "testar-guard-literais-cor: todos os casos verdes"; exit 0; fi
echo "testar-guard-literais-cor: $FALHAS caso(s) FALHARAM"; exit 1

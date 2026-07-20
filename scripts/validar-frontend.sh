#!/usr/bin/env bash
# Validação de mudanças de FRONTEND no ambiente Claude Code (web/remoto).
#
# Por que este script existe:
#   O `@urbiverso/sdk` só está no GitHub Packages (privado) e a auth deste
#   ambiente NÃO tem acesso a ele → `pnpm install` sempre termina em 401 e aborta
#   o LINK dos pacotes. Porém, antes de falhar, o pnpm já baixa os pacotes PÚBLICOS
#   (lit, typescript, tsx, esbuild, @types/*) para `node_modules/.pnpm/`.
#   O frontend deste app NÃO importa o SDK (usa o global `window.urbiVerso`), então
#   dá para validar 100% do frontend só com esses pacotes públicos.
#
# O que faz (o "caminho simples" — não perca tempo redescobrindo auth/token):
#   1. roda `pnpm install` (a falha de 401 do SDK é ESPERADA e ignorada);
#   2. cria os symlinks de topo dos pacotes públicos a partir de `.pnpm/`;
#   3. typecheck do frontend (tsconfig só-frontend), testes de frontend e build
#      do bundle via esbuild.
#
# Backend / `urbi-empacotar` / typecheck do backend precisam do SDK → só rodam no
# ambiente autenticado do autor. Para mudanças de frontend, este script basta.
#
# Uso:  bash scripts/validar-frontend.sh
set -uo pipefail
cd "$(dirname "$0")/.."
raiz="$(pwd)"

echo "== 1/4 pnpm install (401 do @urbiverso/sdk é esperado e ignorado) =="
pnpm install >/dev/null 2>&1 || true
if [ ! -d node_modules/.pnpm ]; then
  echo "ERRO: node_modules/.pnpm não existe — o pnpm não conseguiu baixar nem os pacotes públicos (sem rede?)." >&2
  exit 1
fi

echo "== 2/4 linkando pacotes públicos do store virtual (.pnpm) =="
# link_pkg <glob-do-dir-em-.pnpm> <subcaminho-interno> <alvo-em-node_modules>
link_pkg() {
  local glob="$1" interno="$2" alvo="$3"
  local dir
  dir="$(ls -d node_modules/.pnpm/$glob/node_modules/$interno 2>/dev/null | head -1)"
  if [ -z "$dir" ]; then echo "  aviso: não achei $glob ($interno) no store" >&2; return 0; fi
  mkdir -p "$(dirname "node_modules/$alvo")"
  ln -sfn "$raiz/$dir" "node_modules/$alvo"
  echo "  ok: $alvo"
}
link_pkg 'lit@*'                     'lit'                    'lit'
link_pkg 'lit-html@*'                'lit-html'               'lit-html'
link_pkg 'lit-element@*'             'lit-element'            'lit-element'
link_pkg '@lit+reactive-element@*'   '@lit/reactive-element'  '@lit/reactive-element'
link_pkg '@types+node@20*'           '@types/node'            '@types/node'
link_pkg '@types+trusted-types@*'    '@types/trusted-types'   '@types/trusted-types'
link_pkg 'typescript@*'              'typescript'             'typescript'
link_pkg 'tsx@*'                     'tsx'                    'tsx'
link_pkg 'esbuild@0.24*'             'esbuild'                'esbuild'

tsc="node_modules/typescript/bin/tsc"
esbuild_bin="node_modules/esbuild/bin/esbuild"

echo "== 3/4 typecheck do frontend =="
cat > tsconfig.frontend.json <<'JSON'
{ "extends": "./tsconfig.json", "include": ["frontend/**/*"] }
JSON
node "$tsc" --noEmit -p tsconfig.frontend.json
tc=$?
rm -f tsconfig.frontend.json
[ $tc -eq 0 ] && echo "  typecheck OK" || { echo "  typecheck FALHOU"; exit 1; }

echo "== 4/4 testes de frontend + build do bundle =="
node --import tsx/esm --test frontend/*.test.ts
tst=$?
[ $tst -eq 0 ] || { echo "  testes FALHARAM"; exit 1; }

node "$esbuild_bin" frontend/index.ts --bundle --external:@urbiverso/ui \
  --format=esm --outfile=/dev/null --target=es2022 --minify --tsconfig=tsconfig.json
bd=$?
[ $bd -eq 0 ] || { echo "  build FALHOU"; exit 1; }

echo
echo "✅ Frontend validado: typecheck + testes + build OK."

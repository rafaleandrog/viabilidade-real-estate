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
#   1. guards estáticos: aspas curvas em posição de atributo (#162 — bug que nenhuma
#      das etapas abaixo enxerga, porque mora num template literal do lit) e JSON
#      estrito em schema.json/manifesto.json (comentário `//` neles reprova o pacote
#      na instalação — foi o que derrubou a v0.1.19);
#   2. roda `pnpm install` (a falha de 401 do SDK é ESPERADA e ignorada);
#   3. cria os symlinks de topo dos pacotes públicos a partir de `.pnpm/`;
#   4. typecheck do frontend (tsconfig só-frontend);
#   5. testes de frontend e build do bundle via esbuild.
#
# Backend / `urbi-empacotar` / typecheck do backend precisam do SDK → só rodam no
# ambiente autenticado do autor. Para mudanças de frontend, este script basta.
#
# Uso:  bash scripts/validar-frontend.sh
set -uo pipefail
cd "$(dirname "$0")/.."
raiz="$(pwd)"

# Teste que NÃO TERMINA é o pior modo de falha do CI: em 2026-08-06 o job da PR #304
# ficou `in_progress` no passo `Testes` por horas, sem log nenhum para ler (a API do
# GitHub só serve log de job concluído). São duas defesas, porque cobrem casos
# diferentes e nenhuma cobre as duas:
#   - `--test-timeout` (usado na etapa 5/5) mata teste ASSÍNCRONO pendurado e diz o
#     NOME do teste. Não pega laço síncrono: `while(true){}` bloqueia o event loop e o
#     próprio timer do runner nunca dispara.
#   - `com_limite` mata o PROCESSO inteiro — é esta que pega o laço síncrono.
# O `command -v` existe porque o Git Bash do Windows nem sempre traz o `timeout`;
# sem ele o comando roda igual, só sem a rede de segurança.
com_limite() {
  local seg="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seg" "$@"
    local rc=$?
    [ $rc -eq 124 ] && echo "  ABORTADO: passou de ${seg}s sem terminar — provável laço infinito." >&2
    return $rc
  fi
  "$@"
}

# Aspas curvas em posição de ATRIBUTO deixam o atributo INERTE: o parser lê o valor
# com as aspas dentro dele (”alerta” em vez de alerta), o valor não casa com nada e o
# primitivo cai no default — sem erro em lugar nenhum. Como isso mora dentro de um
# template literal do lit, `tsc --noEmit`, os testes e o esbuild passam todos em verde
# (foi assim que o #160 sobreviveu a uma sessão inteira que "validou ✓").
#
# O padrão casa só com `=` seguido de aspa curva, então NÃO acusa as aspas curvas em
# conteúdo de texto (clique em “Salvar premissas”), que são tipografia legítima.
#
# Por que alternância `\(”\|“\)` e não a classe `[”“]`: sem locale UTF-8 (o caso deste
# ambiente, LANG vazio) o grep casa a classe BYTE a byte, e como ”/“/—/→ compartilham
# o primeiro byte 0xE2, `=[”“]` daria falso positivo em `=—` e `=→`. A alternância
# compara as sequências de 3 bytes inteiras e acerta em qualquer locale.
echo "== 1/5 guards estáticos (aspas curvas + JSON estrito) =="
if grep -rn '=\(”\|“\|‘\|’\)' frontend/; then
  echo "  FALHOU: aspas curvas em atributo — o atributo fica inerte. Use aspas retas." >&2
  exit 1
fi

# `schema.json`/`manifesto.json` têm que ser JSON estrito — comentário `//` neles
# reprova o pacote na instalação ("Pacote reprovado na validacao") e não aparece em
# nenhuma outra etapa daqui. Mora neste script, e não só no validar-backend.sh, porque
# aquele aborta antes do parse quando o SDK não está em node_modules (o caso deste
# ambiente). Ver o cabeçalho de scripts/guard-json.mjs.
node scripts/guard-json.mjs || exit 1
echo "  ok: nenhuma aspa curva em atributo"

echo "== 2/5 pnpm install (401 do @urbiverso/sdk é esperado e ignorado) =="
pnpm install >/dev/null 2>&1 || true
if [ ! -d node_modules/.pnpm ]; then
  echo "ERRO: node_modules/.pnpm não existe — o pnpm não conseguiu baixar nem os pacotes públicos (sem rede?)." >&2
  exit 1
fi

echo "== 3/5 linkando pacotes públicos do store virtual (.pnpm) =="
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

echo "== 4/5 typecheck do frontend =="
cat > tsconfig.frontend.json <<'JSON'
{ "extends": "./tsconfig.json", "include": ["frontend/**/*"] }
JSON
node "$tsc" --noEmit -p tsconfig.frontend.json
tc=$?
rm -f tsconfig.frontend.json
[ $tc -eq 0 ] && echo "  typecheck OK" || { echo "  typecheck FALHOU"; exit 1; }

echo "== 5/5 testes de frontend + build do bundle =="
# `frontend/*.test.ts` NÃO alcança subdiretório: até 2026-08-11 os 16 golden
# cases do Capital Stack (frontend/fixtures/capital-stack-golden.test.ts, hoje
# apagado — a #355 substituiu o modelo) nunca rodaram, nem aqui nem no
# `pnpm test`. O segundo glob conserta isso, e continua necessário pelos
# golden cases de recebíveis (frontend/fixtures/calliandra-golden.test.ts).
com_limite 300 node --import tsx/esm --test --test-timeout=60000 frontend/*.test.ts frontend/fixtures/*.test.ts
tst=$?
[ $tst -eq 0 ] || { echo "  testes FALHARAM"; exit 1; }

"$esbuild_bin" frontend/index.ts --bundle --external:@urbiverso/ui \
  --format=esm --outfile=/dev/null --target=es2022 --minify --tsconfig=tsconfig.json
bd=$?
[ $bd -eq 0 ] || { echo "  build FALHOU"; exit 1; }

echo
echo "✅ Frontend validado: typecheck + testes + build OK."

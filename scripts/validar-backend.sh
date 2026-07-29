#!/usr/bin/env bash
# Validação de mudanças de BACKEND / SCHEMA / MIGRAÇÃO no ambiente Claude Code.
#
# Descoberta de 2026-07-29 que contraria o que o CLAUDE.md dizia ("backend só
# roda no ambiente autenticado do autor"): dá para validar bastante coisa aqui.
#
#   · o `@urbiverso/sdk` já ESTÁ em `node_modules/@urbiverso/sdk` (com o
#     `dist/index.d.ts`). O que falha com 401 é o `pnpm install` REINSTALAR o
#     pacote — os tipos, que é o que o typecheck precisa, estão no disco;
#   · só `backend/rotas.ts` importa o SDK, e é `import '@urbiverso/sdk/express'`
#     (augmentação de tipo, efeito colateral). Todo o resto do backend depende
#     só do `express`, que é PÚBLICO e está no store do pnpm;
#   · os testes de backend importam apenas as funções PURAS dos módulos de rota,
#     então rodam com `tsx` sem subir servidor nem banco.
#
# O que este script NÃO cobre — continua sendo do autor, no UrbiVerso:
#   · `urbi-empacotar` (empacotamento e publicação);
#   · a materialização real das tabelas no Postgres — o passo 2 confere o
#     `schema.json` contra o contrato do SDK (foi o que reprovou o pacote
#     `0.1.12`: `"tipo": "logico"`, que nunca existiu), mas não executa o DDL;
#   · execução real das migrações contra o Postgres da instância;
#   · qualquer coisa que dependa de request/sessão/permissão de verdade.
#
# Uso:  bash scripts/validar-backend.sh
set -uo pipefail
cd "$(dirname "$0")/.."
raiz="$(pwd)"

echo "== 1/5 dependências públicas (express) =="
if [ ! -d node_modules/.pnpm ]; then
  echo "ERRO: node_modules/.pnpm não existe — rode antes: bash scripts/validar-frontend.sh" >&2
  exit 1
fi
link_pkg() {
  local glob="$1" interno="$2" alvo="$3" dir
  dir="$(ls -d node_modules/.pnpm/$glob/node_modules/$interno 2>/dev/null | head -1)"
  if [ -z "$dir" ]; then echo "  aviso: não achei $glob ($interno) no store" >&2; return 0; fi
  mkdir -p "$(dirname "node_modules/$alvo")"
  ln -sfn "$raiz/$dir" "node_modules/$alvo"
  echo "  ok: $alvo"
}
link_pkg 'express@4*'        'express'          'express'
link_pkg '@types+express@4*' '@types/express'   '@types/express'
link_pkg '@types+node@20*'   '@types/node'      '@types/node'
link_pkg 'typescript@*'      'typescript'       'typescript'
link_pkg 'tsx@*'             'tsx'              'tsx'

if [ ! -d node_modules/@urbiverso/sdk ]; then
  echo "ERRO: node_modules/@urbiverso/sdk ausente — sem os tipos do SDK o typecheck do" >&2
  echo "      backend não roda aqui. Esta validação fica para o ambiente do autor." >&2
  exit 1
fi

echo "== 2/5 schema.json vs contrato do SDK =="
node scripts/validar-schema.mjs
[ $? -eq 0 ] || { echo "  schema FALHOU — o shell reprovaria o pacote na instalação"; exit 1; }

echo "== 3/5 typecheck do backend =="
cat > tsconfig.backend.json <<'JSON'
{ "extends": "./tsconfig.json", "include": ["backend/**/*"] }
JSON
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.backend.json
tc=$?
rm -f tsconfig.backend.json
[ $tc -eq 0 ] && echo "  typecheck OK" || { echo "  typecheck FALHOU"; exit 1; }

echo "== 4/5 testes de backend (lógica pura) =="
# Dois níveis: módulos de domínio em `backend/` (ex.: mercado-ia) e as rotas em
# `backend/rotas/`. O glob antigo só pegava o segundo e deixou 16 testes novos
# passarem batido no #200 — daí os dois padrões explícitos.
node --import tsx/esm --test backend/*.test.ts backend/rotas/*.test.ts
[ $? -eq 0 ] || { echo "  testes FALHARAM"; exit 1; }

echo "== 5/5 migrações (contrato, banco vazio, reexecução, cadeia) =="
node scripts/migracoes-harness.mjs
[ $? -eq 0 ] || { echo "  migrações FALHARAM"; exit 1; }

# Guard do erro que já aconteceu uma vez (a `004_fases_gantt.js` entrou sem bump):
# migração nova na branch obriga a `versao` do manifesto a subir; e mexer só em
# frontend/backend, sem migração nova, obriga a versão a NÃO subir (a `versao` é
# de SCHEMA, não de código — ver CLAUDE.md § Versão do manifesto).
echo
echo "== guard: migração nova ⇄ bump da versao =="
base="${BASE_REF:-origin/main}"
if git rev-parse --verify --quiet "$base" >/dev/null; then
  # Conta migrações novas COMMITADAS e também as que ainda estão na árvore de
  # trabalho (untracked ou staged). Sem a segunda parte o guard fica cego
  # justamente quando é mais útil — antes do commit, que é quando se roda a
  # validação (foi o que aconteceu na primeira execução dele, no #199).
  n_commit="$(git diff --name-only --diff-filter=A "$base"...HEAD -- migracoes/ | wc -l | tr -d ' ')"
  n_wt="$(git status --porcelain -- migracoes/ | grep -Ec '^(\?\?|A |M )' || true)"
  novas=$(( n_commit + n_wt ))
  ver_base="$(git show "$base:manifesto.json" 2>/dev/null | grep -o '"versao"[^,]*' || echo '')"
  ver_agora="$(grep -o '"versao"[^,]*' manifesto.json || echo '')"
  if [ "$novas" -gt 0 ] && [ "$ver_base" = "$ver_agora" ]; then
    echo "  FALHOU: $novas migração(ões) nova(s) e a versao continua $ver_agora." >&2
    echo "          Bumpe o z da versao no manifesto.json, no mesmo commit." >&2
    exit 1
  fi
  if [ "$novas" -eq 0 ] && [ -n "$ver_base" ] && [ "$ver_base" != "$ver_agora" ]; then
    echo "  FALHOU: versao mudou ($ver_base → $ver_agora) sem migração nova." >&2
    echo "          A versao descreve o SCHEMA; bumpar sem migração cria degrau vazio." >&2
    exit 1
  fi
  echo "  ok: $novas migração(ões) nova(s) vs $base, versao coerente"
else
  echo "  (pulado: $base não existe neste clone)"
fi

echo
echo "✅ Backend validado: schema + typecheck + testes de rota + migrações + guard de versao."
echo "   Falta o autor rodar no UrbiVerso: urbi-empacotar, sincronização de schema.json"
echo "   e execução real das migrações."

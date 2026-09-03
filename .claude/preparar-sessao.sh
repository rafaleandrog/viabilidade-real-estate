#!/bin/bash
# Preparação de sessão — roda como SessionStart hook (.claude/settings.json).
#
# Existe para pôr no contexto de TODA sessão três fatos que a prosa do CLAUDE.md
# não consegue saber: em que branch a sessão está, se a árvore está suja, e qual
# motor a revisão de PR vai usar. Regra em arquivo é lembrada; fato medido é lido.
#
# Diferenças deliberadas em relação ao hook do monorepo (não as "corrija"):
#
#   1. NÃO roda `pnpm install`. Não é por causa do 401 — essa premissa caiu em
#      2026-09-03, quando se descobriu que o URBIVERSO_PACKAGES_TOKEN está no
#      ambiente e que scripts/lib/sdk-auth.sh basta para o install terminar
#      limpo. É porque install em TODA sessão custa segundos que a maioria delas
#      não usa: quem precisa de dependências chama scripts/validar-frontend.sh,
#      que já autentica sozinho. O hook só REPORTA se a auth está disponível.
#   2. NÃO é escopado a CLAUDE_CODE_REMOTE. O lembrete de processo vale em sessão
#      local também; só o `codex login` depende de a chave existir.
#
# Contrato do hook: NUNCA derruba a sessão. Sai 0 em qualquer cenário.
set -uo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$RAIZ" 2>/dev/null || exit 0

# ── A linha-sentinela ────────────────────────────────────────────────────────
# Se ela NÃO aparecer no começo da sessão, o hook não rodou — e "não rodou" é
# indistinguível de "tudo normal" sem uma marca fixa para procurar.
echo '[processo] viabilidade — branch → PR → revisão → rodadas → merge só com autorização do autor'

# ── Onde a sessão está ───────────────────────────────────────────────────────
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
SUJO="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
if [ "$SUJO" = "0" ]; then ESTADO="árvore limpa"; else ESTADO="$SUJO alteração(ões) não commitada(s)"; fi
echo "[processo] branch=$BRANCH · $ESTADO"

if [ "$BRANCH" = "main" ]; then
  echo '[processo] ⚠️  VOCÊ ESTÁ NA MAIN. Ela é só para puxar. Trabalho novo abre branch ANTES'
  echo '[processo]     de editar qualquer arquivo: git checkout -b claude/<descrição>'
  echo '[processo]     e logo depois git branch --unset-upstream (senão um push pelado vai pra main).'
fi

# ── SDK: medido, não presumido ───────────────────────────────────────────────
# Esta linha existe porque a ausência de auth é INDISTINGUÍVEL de "tudo normal"
# até alguém rodar o validar-backend.sh e tomar o abort na etapa 1/5 — que foi
# como o repositório passou meses declarando backend/schema/migração "pendentes
# do autor" por uma causa que não era a declarada.
if [ -n "${URBIVERSO_PACKAGES_TOKEN:-}" ]; then
  echo '[processo] SDK: autenticável — validar-backend.sh roda aqui (as 5 etapas).'
  echo '[processo]     Contratos: props de urbi-* SIM (dist/index.d.ts); doc do SDK NÃO — o pin'
  echo '[processo]     0.50.3 não traz docs/. Atestação segue contratos=nao-executados.'
else
  echo '[processo] SDK: SEM token (URBIVERSO_PACKAGES_TOKEN ausente) — backend, schema e'
  echo '[processo]     migração ficam pendentes do autor, e o PR precisa DECLARAR isso.'
fi

# ── Motor de revisão: medido, não presumido ──────────────────────────────────
# Sem isto, a queda para o motor nativo só é descoberta no relatório, no fim.
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo '[processo] motor de revisão: NATIVO (OPENAI_API_KEY ausente no ambiente)'
  echo '[processo]     → para ter Codex, o autor põe a chave nas variáveis do cloud environment.'
elif ! command -v codex >/dev/null 2>&1; then
  echo '[processo] motor de revisão: CODEX após instalar (chave presente, CLI ausente)'
  echo '[processo]     → o preflight do .claude/motor-revisao.md instala o @openai/codex sozinho.'
elif [ -s "$HOME/.codex/auth.json" ]; then
  echo '[processo] motor de revisão: CODEX (já autenticado)'
elif printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null 2>&1; then
  echo '[processo] motor de revisão: CODEX (autenticado agora por API key)'
else
  echo '[processo] motor de revisão: NATIVO (codex login falhou)'
fi

exit 0

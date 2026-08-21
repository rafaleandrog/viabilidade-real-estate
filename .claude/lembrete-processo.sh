#!/bin/bash
# Lembrete de processo — roda como UserPromptSubmit hook (.claude/settings.json).
#
# Por que existe: o CLAUDE.md entra no contexto no início e ENFRAQUECE depois de
# compactação e de turnos longos — que é exatamente quando o atalho ("edito
# direto, é pequeno") fica tentador. Este hook reinjeta o ESTADO a cada prompt.
#
# Imprime estado, nunca regra. Regra repetida vira papel de parede; estado muda,
# e por isso continua sendo lido. Teto de 4 linhas, de propósito: ~40 tokens por
# turno é o preço, e ele só se paga enquanto for curto.
#
# ⚠️ NUNCA sai != 0. Em UserPromptSubmit, exit != 0 BLOQUEIA o prompt do usuário.
set -uo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$RAIZ" 2>/dev/null || exit 0

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
SUJO="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
[ "$SUJO" = "0" ] && ESTADO="limpo" || ESTADO="$SUJO alteração(ões)"

# "Empurrado" é o que dá para medir daqui; PR aberto exige o MCP do GitHub.
# Não afirme o que não mediu: a diferença entre as duas coisas é o tipo de
# imprecisão que faz alguém achar que já abriu o PR.
if git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null 2>&1; then
  ADIANTE="$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo '?')"
  [ "$ADIANTE" = "0" ] && REMOTO="empurrada" || REMOTO="$ADIANTE commit(s) não empurrado(s)"
else
  REMOTO="nunca empurrada"
fi

MOTOR="nativo"
[ -n "${OPENAI_API_KEY:-}" ] && MOTOR="codex"

echo "[processo] branch=$BRANCH · $ESTADO · $REMOTO · motor=$MOTOR"

if [ "$BRANCH" = "main" ] && [ "$SUJO" != "0" ]; then
  echo '[processo] ⚠️  ALTERAÇÃO NÃO COMMITADA NA MAIN — mova para uma branch antes de commitar.'
fi

exit 0

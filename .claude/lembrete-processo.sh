#!/bin/bash
# Lembrete de processo — roda como UserPromptSubmit hook (.claude/settings.json).
#
# Por que existe: o CLAUDE.md entra no contexto no início e ENFRAQUECE depois de
# compactação e de turnos longos — que é exatamente quando o atalho ("edito
# direto, é pequeno") fica tentador. Este hook reinjeta o ESTADO a cada prompt.
#
# Imprime estado, nunca regra. Regra repetida vira papel de parede; estado muda,
# e por isso continua sendo lido. Emite UMA linha no caso normal e uma segunda só
# no aviso de `main` suja — teto de 2, de propósito: ~25 tokens por turno é o
# preço, e ele só se paga enquanto for curto. Cresceu? Corte antes de somar.
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

# Prontidão dos DOIS motores externos (.claude/motor-revisao.md). Medir só o Codex fazia esta
# linha dizer `motor=nativo` num ambiente com o Kimi instalado e funcionando — e ela é reinjetada
# a cada prompt, então o fato errado é o que sobrevive à compactação.
#
# O predicado é a CHAVE, igual para os dois: o preflight de cada motor instala o próprio CLI.
# Mesmo critério de `preparar-sessao.sh`, e pelo mesmo motivo escrito lá.
#
# `codex+kimi` é informativo e NUNCA é o valor da linha de máquina da atestação — aquela aceita
# um valor só, minúsculo (`grep -o 'motor=[a-z]*'`), e um composto seria truncado em silêncio.
MOTOR="nativo"
[ -n "${MOONSHOT_API_KEY:-}" ] && MOTOR="kimi"
# `auth.json` entra aqui pelo mesmo motivo que entra no outro hook: sessão de ChatGPT já
# feita vale sem a variável. Sem ela, os dois hooks discordariam do motor no mesmo ambiente,
# e o comentário acima ("mesmo critério") seria falso — a classe que este bloco combate.
# `${HOME:-}` e não `$HOME`: este hook roda sob `set -u`, e um HOME ausente mataria o
# script com "unbound variable" — que aqui não é um aviso a menos, é rc≠0 no
# UserPromptSubmit, e rc≠0 ali TRAVA o prompt do usuário (ver o cabeçalho).
if [ -n "${OPENAI_API_KEY:-}" ] || { [ -n "${HOME:-}" ] && [ -s "$HOME/.codex/auth.json" ]; }; then
  [ "$MOTOR" = "kimi" ] && MOTOR="codex+kimi" || MOTOR="codex"
fi

echo "[processo] branch=$BRANCH · $ESTADO · $REMOTO · motor=$MOTOR"

if [ "$BRANCH" = "main" ] && [ "$SUJO" != "0" ]; then
  echo '[processo] ⚠️  ALTERAÇÃO NÃO COMMITADA NA MAIN — mova para uma branch antes de commitar.'
fi

exit 0

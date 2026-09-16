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
  echo '[processo]     Contratos: as DUAS lentes são executáveis — props de urbi-* (dist/index.d.ts)'
  echo '[processo]     e doc do SDK (docs/ + obsolescencias.json, no pin 57.0.0). contratos=ok só'
  echo '[processo]     quando as duas de fato rodarem na revisão.'
else
  echo '[processo] SDK: SEM token (URBIVERSO_PACKAGES_TOKEN ausente) — backend, schema e'
  echo '[processo]     migração ficam pendentes do autor, e o PR precisa DECLARAR isso.'
fi

# ── Motor de revisão: medido, não presumido ──────────────────────────────────
# Sem isto, a queda para o motor nativo só é descoberta no relatório, no fim.
#
# ⚠️ São DOIS motores externos desde 2026-09-16 (ver .claude/motor-revisao.md), e este bloco
# media só um. Enquanto media só o Codex, ele imprimia NATIVO num ambiente em que o Kimi
# estava instalado, com chave e funcionando — fato medido e falso é pior que fato ausente,
# porque ninguém confere o que o hook afirma.
#
# Aqui a medição é barata e de PRONTIDÃO (binário + chave), não de turno completo: o smoke
# test de verdade (`kimi -p`) leva ~10s e mora no preflight da revisão, não num hook que roda
# na abertura de toda sessão.
#
# ⚠️ A prontidão é medida pela CHAVE, não pelo binário, e para os DOIS motores igual. O
# preflight de cada um instala o próprio CLI (`npm i -g @openai/codex` / `@moonshot-ai/kimi-code`),
# então binário ausente não é motor ausente. Exigir o binário só de um dos dois — que foi a
# primeira versão deste bloco — reproduz o defeito que ele existe para consertar: ambiente com
# MOONSHOT_API_KEY e sem o CLI seria reportado NATIVO, e o autor mandado pôr uma chave que já
# está lá. Achado de três lentes independentes na revisão do PR que trouxe este bloco.
CODEX_PRONTO=0
# `auth.json` cobre a sessão de ChatGPT já feita, que vale sem a variável — era um ramo do
# bloco anterior e voltaria a sumir se a prontidão olhasse só o ambiente.
if [ -n "${OPENAI_API_KEY:-}" ] || [ -s "$HOME/.codex/auth.json" ]; then CODEX_PRONTO=1; fi
KIMI_PRONTO=0
if [ -n "${MOONSHOT_API_KEY:-}" ]; then KIMI_PRONTO=1; fi

if [ "$CODEX_PRONTO" = 1 ] && [ "$KIMI_PRONTO" = 1 ]; then
  echo '[processo] motor de revisão: CODEX+KIMI (os dois prontos; o smoke test de cada um é no preflight)'
elif [ "$KIMI_PRONTO" = 1 ]; then
  echo '[processo] motor de revisão: KIMI (Codex sem OPENAI_API_KEY nem sessão em ~/.codex)'
  echo '[processo]     → a fan-out roda pela coluna Kimi da tabela de tier; atestação sai motor=kimi.'
elif [ "$CODEX_PRONTO" = 1 ]; then
  echo '[processo] motor de revisão: CODEX (Kimi sem MOONSHOT_API_KEY no ambiente)'
else
  echo '[processo] motor de revisão: NATIVO (nenhum motor externo pronto)'
  echo '[processo]     → o autor põe OPENAI_API_KEY e/ou MOONSHOT_API_KEY nas variáveis do ambiente.'
fi

exit 0

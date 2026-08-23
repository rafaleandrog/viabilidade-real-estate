#!/usr/bin/env bash
# Bateria do preflight de PR.
#
# Por que existe: o preflight é um PORTÃO, e portão que falha calado é pior que
# portão nenhum — ele dá licença. Falso NEGATIVO deixa passar o corpo errado e o
# CI fica vermelho depois (exatamente o que o script existe para evitar); falso
# POSITIVO reprova corpo correto, alguém para de rodar o script, e aí ele não
# guarda mais nada. Os dois sentidos precisam de caso.
#
# Só `bash` + `node` + `git`: roda no CI sem credencial.

set -uo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
WT=''
# O trap DESREGISTRA a worktree antes de apagar o diretório. Sem isso, uma
# execução interrompida entre o `git worktree add` e a remoção explícita deixa
# `.git/worktrees/*` órfão, e as órfãs se acumulam a cada interrupção local.
# Achado do Codex no PR 502, rodada 3.
limpar() {
  [ -n "$WT" ] && git worktree remove --force "$WT" >/dev/null 2>&1
  rm -rf "$TMP"
}
trap limpar EXIT

passou=0
falhou=0

# A bateria DECLARA o diff em vez de herdar o da árvore de trabalho. Sem isso o
# resultado depende do que já foi commitado: rodando antes do commit o diff é
# zero, a regra do PR #142 (fecha issue com diff vazio) dispara, e casos
# corretos aparecem como falha. Teste que muda de veredito conforme o estado da
# árvore não é teste.
DIFF="frontend/exemplo.ts"

# A bateria declara TAMBÉM as mensagens de commit, não só os arquivos. Sem
# isso o preflight ainda lia `git log base..HEAD` da árvore real: um commit
# desta branch que cite uma issue entra na entrada de todo caso, e os casos
# positivos passam a falhar por um motivo que não é o deles. Medido — 7 dos 20
# casos quebraram no instante em que o próprio trabalho foi commitado. Achado
# do Codex no PR 502.
: > "$TMP/commits.txt"

# E declara TAMBEM as duas versoes do manifesto. Sem isso a comparacao lia o
# manifesto.json do disco: num PR que legitimamente bumpasse a versao, os casos
# desta bateria seriam reprovados com "versao bumpada sem migracao nova" — e
# como este job roda em TODO PR, toda migracao corretamente versionada
# derrubaria o CI. Terceira override pelo mesmo motivo que as duas anteriores.
VERSAO='0.1.28:0.1.28'   # sem bump, o caso comum
ARVORE='claude/teste:'   # branch propria, sem upstream — o estado saudavel

# esperar <exit-esperado> <rotulo> <corpo...>
esperar() {
  local esperado="$1" rotulo="$2"; shift 2
  printf '%s\n' "$@" > "$TMP/corpo.md"
  local saida; saida="$(node scripts/preflight-pr.mjs --corpo "$TMP/corpo.md" \
    --titulo "" --declarado --arquivos "$DIFF" --commits "$TMP/commits.txt" --versao "$VERSAO" \
    --arvore "$ARVORE" 2>&1)"
  local obtido=$?
  if [ "$obtido" -eq "$esperado" ]; then
    passou=$((passou + 1))
    printf '  ok   %s\n' "$rotulo"
  else
    falhou=$((falhou + 1))
    printf '  FALHA %s — esperava exit %s, veio %s\n' "$rotulo" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/        /'
  fi
}

# contem <padrao> <rotulo> <corpo...>
# Exige o texto do aviso E exit 0. Só o texto não basta: a seção diz que o
# aviso aparece "sem bloquear", e um caso que passasse com exit 1 mascararia
# uma regressão que transformou aviso em bloqueante.
contem() {
  local padrao="$1" rotulo="$2"; shift 2
  printf '%s\n' "$@" > "$TMP/corpo.md"
  local saida; saida="$(node scripts/preflight-pr.mjs --corpo "$TMP/corpo.md" \
    --titulo "" --declarado --arquivos "$DIFF" --commits "$TMP/commits.txt" --versao "$VERSAO" \
    --arvore "$ARVORE" 2>&1)"
  local obtido=$?
  if [ "$obtido" -ne 0 ]; then
    falhou=$((falhou + 1))
    printf '  FALHA %s — aviso deveria ser não-bloqueante, mas o exit foi %s\n' "$rotulo" "$obtido"
    return
  fi
  if printf '%s' "$saida" | grep -qF "$padrao"; then
    passou=$((passou + 1))
    printf '  ok   %s\n' "$rotulo"
  else
    falhou=$((falhou + 1))
    printf '  FALHA %s — a saída não menciona "%s"\n' "$rotulo" "$padrao"
  fi
}

echo "Bateria do preflight de PR:"

# ── Falso negativo: o que TEM que reprovar ──────────────────────────────────
esperar 1 'issue citada em prosa, sem declaração' \
  'Corrige a cadeia, ver #440 e #450.'
esperar 1 'intervalo composto não fecha nada' \
  'Closes #273-276'
esperar 1 'keyword seguida de lista fecha só a primeira' \
  'Closes #1, #2'

# ── Falso positivo: o que NÃO pode reprovar ─────────────────────────────────
esperar 0 'issue declarada como isenta' \
  'Sem-fechamento: #440 #450 contexto da ordem.'
esperar 0 'keyword repetida por issue' \
  'closes #1, closes #2' \
  '' \
  'Sem-fechamento: #3 contexto.'
esperar 0 'corpo sem nenhuma referência a issue' \
  'Ajuste de redação, nenhuma issue envolvida.'
# A URL de PR tem `/pull/499` e NENHUM `#`: o guard não pode inventar citação.
esperar 0 'URL de PR não vira issue citada' \
  'Segue o padrão de https://github.com/o/r/pull/499.'

# ── A regra do PR #142, exercitada de propósito ─────────────────────────────
DIFF='-'
esperar 1 'fecha issue com diff vazio (o caso do PR #142)' \
  'Closes #1'
esperar 0 'diff vazio sem fechar issue é só aviso' \
  'Nada a citar.'
DIFF="frontend/exemplo.ts"

# ── Regras de migração ──────────────────────────────────────────────────────
DIFF='migracoes/030_algo.js'
esperar 1 'migração nova sem bump da versao' 'Nada a citar.'
DIFF='migracoes/030_algo.js,migracoes/031_outra.js,manifesto.json'
esperar 1 'duas migrações no mesmo PR' 'Nada a citar.'
# Tocar o manifesto NÃO basta — o preflight compara o VALOR de `versao`.
DIFF='migracoes/030_algo.js,manifesto.json'
esperar 1 'manifesto tocado sem bump da versao ainda reprova' 'Nada a citar.'

# O caminho POSITIVO, que a rodada 1 não conseguia exercitar. A override
# `--versao` o destravou: agora a bateria prova os dois sentidos da regra.
VERSAO='0.1.28:0.1.29'
esperar 0 'migração nova COM bump da versao passa' 'Nada a citar.'
DIFF='frontend/exemplo.ts'
esperar 1 'bump da versao SEM migração nova reprova' 'Nada a citar.'
VERSAO='0.1.28:0.1.28'
DIFF="frontend/exemplo.ts"

# ── Regra R1: processo não viaja com código de produto ──────────────────────
DIFF='.claude/motor-revisao.md,frontend/tela-resumo.ts'
esperar 1 'processo misturado com produto (R1)' 'Nada a citar.'
DIFF='.claude/motor-revisao.md'
esperar 0 'processo sozinho passa na R1' 'Nada a citar.'
DIFF="frontend/exemplo.ts"

# ── Estado de árvore — os dois eixos que a hermeticidade NÃO alcança ────────
#
# Nem o checkout de PR nem a worktree hermética têm branch nomeada ou upstream:
# as duas são destacadas. Sem estes casos, uma regressão que volte a tornar
# `branch === 'main'` ou `upstream === 'origin/main'` bloqueante em modo
# declarado passaria verde — a lacuna que a hermeticidade deveria cobrir.
# Achado do Codex no PR 502, rodada 6.
ARVORE='main:'
contem 'informativo no modo declarado' 'na main, modo declarado: informativo' 'Nada a citar.'
ARVORE='claude/teste:origin/main'
contem 'informativo no modo declarado' 'upstream origin/main, declarado: informativo' 'Nada a citar.'
ARVORE='claude/teste:'

# ── Avisos: têm que aparecer, sem bloquear ──────────────────────────────────
contem 'keyword em PORTUGUÊS' 'avisa sobre "Fecha #NNN"' \
  'Fecha #123' '' 'Sem-fechamento: #123 contexto.'
contem 'o guard lê isso como issue citada' 'avisa sobre "PR #NNN"' \
  'Ver PR #499.' '' 'Sem-fechamento: #499 é PR, não issue.'
contem 'ACIONA o App' 'avisa sobre @codex no corpo' \
  'Pedi @codex review antes.'
# Asserta o PREFIXO estável, não o texto da branch: no CI o checkout deixa HEAD
# destacado e o nome da branch não existe. Um caso que assertasse o nome passa
# aqui e falha lá — e foi assim que este PR ficou vermelho.
contem 'estado da árvore:' 'reporta o estado da árvore em qualquer ambiente' \
  'Nada a citar.'

# ── Contrato de uso ─────────────────────────────────────────────────────────
node scripts/preflight-pr.mjs > /dev/null 2>&1
if [ $? -eq 2 ]; then
  passou=$((passou + 1)); echo '  ok   sem --corpo sai com 2 (erro de uso, não veredito)'
else
  falhou=$((falhou + 1)); echo '  FALHA sem --corpo deveria sair com 2'
fi

node scripts/preflight-pr.mjs --corpo "$TMP/nao-existe.md" > /dev/null 2>&1
if [ $? -eq 2 ]; then
  passou=$((passou + 1)); echo '  ok   arquivo inexistente sai com 2'
else
  falhou=$((falhou + 1)); echo '  FALHA arquivo inexistente deveria sair com 2'
fi

# ── Hermeticidade — a propriedade, não mais um caso ─────────────────────────
#
# POR QUE ESTA SEÇÃO EXISTE. Quatro vezes seguidas o preflight leu do ambiente
# algo que a bateria achava estar declarando: a lista de arquivos, as mensagens
# de commit, o nome da branch e a `versao` do manifesto. As quatro passavam aqui
# e falhavam noutro lugar; a quarta foi CAUSADA pelo conserto da segunda.
#
# Caso novo cobre a instância que já se conhece — e o defeito era sempre a
# leitura seguinte, ainda desconhecida. Isto aqui é a PROPRIEDADE: a bateria
# inteira roda de novo numa worktree separada, com branch de nome diferente e
# `versao` diferente, e o resultado tem que ser IDÊNTICO. Qualquer leitura de
# ambiente não declarada — inclusive as que ninguém mapeou — aparece como
# divergência, sem precisar ser prevista.
#
# A worktree é descartável e a árvore real NÃO é tocada. O preflight resolve a
# raiz a partir da própria localização do arquivo, então rodá-lo de lá troca o
# ambiente inteiro de uma vez.
# A worktree filha sai de HEAD, entao ela roda a bateria COMMITADA. Com trabalho
# nao commitado as duas execucoes comparam versoes diferentes do script, e a
# divergencia que aparece e artefato disso, nao vazamento de ambiente. Pular com
# aviso e o desfecho honesto — e o preflight ja exige arvore limpa fora do modo
# declarado, entao o uso canonico nunca cai aqui.
if [ -z "${PREFLIGHT_BATERIA_FILHA:-}" ] && [ "$falhou" -eq 0 ] && [ -n "$(git status --porcelain -- scripts/ 2>/dev/null)" ]; then
  echo "  --   hermeticidade: pulada — ha mudanca nao commitada em scripts/, e a"
  echo "       worktree filha sai de HEAD; a comparacao seria entre versoes diferentes."
elif [ -z "${PREFLIGHT_BATERIA_FILHA:-}" ] && [ "$falhou" -eq 0 ]; then
  WT="$TMP/wt-hermetica"
  if git worktree add --detach "$WT" HEAD >/dev/null 2>&1; then
    node -e '
      const fs = require("fs"), f = process.argv[1] + "/manifesto.json";
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      j.versao = "9.9.9";
      fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
    ' "$WT"
    filha="$(PREFLIGHT_BATERIA_FILHA=1 bash "$WT/scripts/testar-preflight-pr.sh" 2>&1 | tail -1)"
    git worktree remove --force "$WT" >/dev/null 2>&1
    WT=''
    esperado="ok: $passou caso(s) do preflight passaram."
    if [ "$filha" = "$esperado" ]; then
      passou=$((passou + 1))
      echo "  ok   hermeticidade: mesmo veredito noutra worktree, outro branch, outra versao"
    else
      falhou=$((falhou + 1))
      echo "  FALHA hermeticidade: o veredito MUDOU com o ambiente."
      echo "        aqui:  $esperado"
      echo "        lá:    $filha"
      echo "        Alguma entrada esta vindo do ambiente em vez de ser declarada."
    fi
  else
    WT=''
    echo "  --   hermeticidade: pulada (git worktree indisponivel aqui)"
  fi
fi

echo
if [ "$falhou" -eq 0 ]; then
  echo "ok: $passou caso(s) do preflight passaram."
  exit 0
fi
echo "✖ $falhou de $((passou + falhou)) caso(s) do preflight falharam."
exit 1

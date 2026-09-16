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
    --titulo "titulo sintetico" --declarado --arquivos "$DIFF" --commits "$TMP/commits.txt" --versao "$VERSAO" \
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
    --titulo "titulo sintetico" --declarado --arquivos "$DIFF" --commits "$TMP/commits.txt" --versao "$VERSAO" \
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
# Duas migrações com bump PASSAM: o guard previsto (validar-backend.sh) testa
# `novas > 0` contra a mudança de versão e aceita qualquer contagem positiva.
# "Um número por PR" é regra de organização da Rodada 9, não previsão de CI —
# este script prevê o CI, e misturar política com previsão o inutiliza.
DIFF='migracoes/030_algo.js,migracoes/031_outra.js,manifesto.json'
VERSAO='0.1.28:0.1.29'
esperar 0 'duas migrações COM bump passam — o guard previsto aceita' 'Nada a citar.'
VERSAO='0.1.28:0.1.28'
esperar 1 'duas migrações SEM bump reprovam' 'Nada a citar.'
# Tocar o manifesto NÃO basta — o preflight compara o VALOR de `versao`.
DIFF='migracoes/030_algo.js,manifesto.json'
esperar 1 'manifesto tocado sem bump da versao ainda reprova' 'Nada a citar.'

# O caminho POSITIVO, que a rodada 1 não conseguia exercitar. A override
# `--versao` o destravou: agora a bateria prova os dois sentidos da regra.
VERSAO='0.1.28:0.1.29'
esperar 0 'migração nova COM bump da versao passa' 'Nada a citar.'
DIFF='frontend/exemplo.ts'
esperar 1 'bump da versao SEM migração nova reprova' 'Nada a citar.'

# A assimetria do `-n "$ver_base"` em `validar-backend.sh:120`. Quando a BASE não
# tem o campo `versao`, o guard previsto NÃO reprova o PR que o acrescenta — e o
# preflight reprovava. Bloquear o que o guard aceita é o oposto do que este
# script promete. O caso simétrico, abaixo, continua bloqueando: ali a base TEM o
# campo e o PR o REMOVE, e aí o guard reprova de verdade.
VERSAO=':0.1.29'
esperar 0 'base SEM o campo versao — acrescentá-lo não reprova, como no guard' 'Nada a citar.'
VERSAO='0.1.28:'
esperar 1 'base COM o campo e o PR o REMOVE — continua reprovando' 'Nada a citar.'

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

# ── Fiação das baterias: elas rodam em modo REAL ────────────────────────────
# ⚠️ ESTE caso é o único que invoca o preflight SEM `--declarado`, e é de propósito. Todos os
# outros usam o modo declarado — que existe para exercitar o parsing com entrada sintética e, por
# isso, PULA as baterias (senão a suíte as re-executava dezenas de vezes: medido, 96s contra 8s).
#
# O efeito colateral disso é que as chamadas das baterias ficariam sem consumidor de teste:
# inverter o gate para `if (MODO_DECLARADO)` deixava ZERO baterias rodando em modo real e a suíte
# inteira VERDE — medido. É a classe de defeito nº 1 do `CLAUDE.md` (o defeito mora na FIAÇÃO)
# dentro da própria máquina que o repositório usa para não cair nela. Achado de lente.
#
# Uma invocação real custa ~1,9s; o teto do job é 5 min. Uma é o preço certo por cobrir a fiação.
saida_real="$(node scripts/preflight-pr.mjs --corpo "$TMP/corpo.md" --titulo 'titulo sintetico' 2>&1)"
faltando=''
# ⚠️ Casa a LINHA DE SUCESSO (`  ✓ <rótulo> — `), não a substring em qualquer lugar da saída. O
# próprio preflight imprime o rótulo FORA do caminho de sucesso em dois lugares: o aviso de
# ferramenta ausente imprime `<rótulo> NÃO rodou aqui` (um aviso por bateria faltante, em
# `preflight-pr.mjs`, no laço de `BATERIAS`), e o ramo de falha do `rodar` imprime
# `<rótulo> reprovou:`. Com `case *"$b"*`, uma máquina sem `jq` — estado que o preflight trata como
# legítimo — daria VERDE com ZERO das três tendo rodado, e a mutação que este caso existe para
# matar passaria junto. Guarda que falha ABERTA, § 7 do corpo de conhecimento, dentro do caso
# escrito para fechar a fiação. Achado de lente, na rodada seguinte à que criou o caso.
# ⚠️ E exige só o que é OBSERVÁVEL neste ambiente. Três das quatro dependem de `jq`, e o preflight
# trata a ausência dele como estado legítimo (aviso, não bloqueante) — então exigi-las numa máquina
# sem `jq` transformaria este caso num bloqueio falso, que é o defeito simétrico. Com `jq`, as
# quatro; sem, a do corpo, que não depende dele. O que não dá para observar é DITO, não presumido.
esperadas='bateria do corpo de conhecimento'
if command -v jq > /dev/null 2>&1; then
  esperadas="$esperadas
bateria da colheita do motor
bateria da guarda do monorepo
bateria do parsing do revisao-registrada"
else
  echo '  nota  `jq` ausente: só a bateria do corpo é observável neste ambiente'
fi
while IFS= read -r b; do
  case "$saida_real" in *"✓ $b — "*) ;; *) faltando="$faltando $b" ;; esac
done <<EOF_ESPERADAS
$esperadas
EOF_ESPERADAS
if [ -z "$faltando" ]; then
  n_esp=$(printf '%s\n' "$esperadas" | grep -c .)
  passou=$((passou + 1)); echo "  ok   em modo REAL o preflight roda as $n_esp bateria(s) observavel(is) aqui"
else
  falhou=$((falhou + 1))
  echo "  FALHA em modo real faltaram baterias:$faltando"
  echo '        (sem este caso, inverter o gate de MODO_DECLARADO fica verde)'
  # ⚠️ Rótulo ausente tem DUAS causas, e elas pedem consertos opostos: a bateria não rodou
  # (fiação — o que este caso existe para pegar) ou rodou e REPROVOU (defeito de conteúdo, ex.:
  # corpo editado sem re-carimbo). Nas duas o `✓` some, então sem despejar a saída o operador lê
  # "faltaram baterias" e vai procurar na fiação um defeito que está no conteúdo. Achado de lente.
  echo '        --- linhas de reprovação/aviso da invocação real ---'
  printf '%s\n' "$saida_real" | grep -E '(reprovou|NÃO rodou aqui|^[[:space:]]*✖)' || \
    echo '        (nenhuma; a saída real não acusou reprovação nem ferramenta ausente)'
fi

# ── Ferramenta ausente vira AVISO, nunca bloqueante ─────────────────────────
# ⚠️ Este caso existe porque o RAMO DO AVISO não tinha consumidor de teste — e é a mesma classe
# que o caso acima fecha do outro lado: apagar o `avisos.push` do laço de `BATERIAS` deixava tudo
# VERDE, porque no CI (ubuntu, com `jq`) o ramo nunca executa. Guarda cuja remoção não fica
# vermelha é decoração. Achado de lente, na rodada seguinte à que criou o gate.
#
# O PATH sintético é um diretório de symlinks para tudo que o PATH real tem MENOS o `jq`. Não
# adianta pôr um `jq` que sai 1: `temFerramenta` usa `spawnSync(...).error`, que só acusa
# binário que não pode ser EXECUTADO — um `jq` quebrado continua "presente", e o teste mediria
# outra coisa.
if command -v jq > /dev/null 2>&1; then
  SEM_JQ="$TMP/path-sem-jq"; mkdir -p "$SEM_JQ"
  printf '%s\n' "$PATH" | tr ':' '\n' | while IFS= read -r d; do
    [ -d "$d" ] || continue
    for b in "$d"/*; do
      [ -x "$b" ] || continue
      n=$(basename "$b")
      [ "$n" = jq ] && continue
      [ -e "$SEM_JQ/$n" ] || ln -s "$b" "$SEM_JQ/$n" 2> /dev/null || true
    done
  done
  saida_sem_jq="$(PATH="$SEM_JQ" node scripts/preflight-pr.mjs --corpo "$TMP/corpo.md" \
    --titulo 'titulo sintetico' 2>&1)"; rc_sem_jq=$?
  # As três asserções são conjuntas de propósito: (a) o aviso saiu e NOMEIA a ferramenta e a
  # bateria; (b) a bateria que NÃO depende de `jq` ainda rodou — sem isso, "avisou de tudo"
  # passaria; (c) NENHUM bloqueante nomeia bateria, que é o predicado deste ramo: ferramenta
  # ausente é estado legítimo, não PR reprovado.
  #
  # ⚠️ (c) NÃO é `exit 0`, e a diferença custou uma medição: o preflight também reprova por
  # ÁRVORE SUJA, e esta suíte roda justamente enquanto alguém edita `scripts/`. Exigir exit 0
  # mediria o estado da árvore de quem rodou o teste, não o comportamento do gate — o caso
  # ficaria vermelho por um motivo que não é defeito nenhum.
  falta_sem_jq=''
  case "$saida_sem_jq" in *'`jq` não está nesta máquina: a bateria da colheita do motor NÃO rodou aqui'*) ;;
    *) falta_sem_jq="$falta_sem_jq aviso-nomeando-jq-e-a-bateria" ;; esac
  case "$saida_sem_jq" in *'✓ bateria do corpo de conhecimento — '*) ;;
    *) falta_sem_jq="$falta_sem_jq bateria-do-corpo-ainda-roda" ;; esac
  # ⚠️ `grep` LINHA A LINHA, e não `case *'bateria'*'reprovou:'*`. O glob do `case` casa através
  # de quebra de linha: com um bloqueante legítimo de outra causa (árvore suja) o padrão fechava
  # com a palavra "bateria" de uma linha `✓` lá em cima e o `reprovou:` da linha de baixo, e o
  # caso acusava um defeito que não existe. Medido ao escrever este próprio caso.
  if printf '%s\n' "$saida_sem_jq" | grep -qE '^[[:space:]]*- bateria .* reprovou:'; then
    falta_sem_jq="$falta_sem_jq nenhuma-bateria-vira-bloqueante"
  fi
  if [ -z "$falta_sem_jq" ]; then
    passou=$((passou + 1))
    echo '  ok   sem `jq` no PATH: aviso nomeado, bateria independente roda, nenhum bloqueante'
  else
    falhou=$((falhou + 1)); echo "  FALHA sem jq faltou:$falta_sem_jq"
  fi
else
  echo '  nota  `jq` ausente nesta máquina: o caso do PATH sem `jq` não tem contraste a medir'
fi

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

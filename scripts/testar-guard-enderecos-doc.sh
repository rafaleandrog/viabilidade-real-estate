#!/bin/bash
# Bateria do `scripts/guard-enderecos-doc.mjs`.
#
# POR QUE EXISTE, e por que testa os DOIS sentidos: é a mesma lição das baterias
# `testar-guarda-monorepo.sh`, `testar-revisao-registrada.sh` e
# `testar-guard-tabelas-obsoletas.sh`. Falso NEGATIVO deixa o endereço vencido
# passar, e aí o guard vira papel de parede — pior que guard nenhum, porque
# alguém lê "ok" e acredita. Falso POSITIVO atrapalha trabalho legítimo, alguém
# tira o job do CI, e aí ele não guarda mais nada.
#
# ⚠️ O SENTIDO 1 (não acusar o correto) tem MAIS casos que o sentido 2, e isso é
# deliberado: a calibragem declarada do guard é "falso positivo é pior que falso
# negativo", então é o lado conservador que precisa de prova, não o lado que
# acusa. Cada caso de "não acusa" corresponde a uma decisão de projeto escrita no
# cabeçalho do guard — se alguém apertar a heurística sem querer, um destes fica
# vermelho e diz qual decisão foi quebrada.
#
# DETERMINÍSTICA POR CONSTRUÇÃO: cada caso monta uma árvore de fixtures nova em
# `mktemp -d` e roda o guard contra ELA (`node … <raiz>`), com a lista de
# exceções DA PRÓPRIA árvore. Nenhum caso depende do estado da árvore de
# trabalho, então o veredito não muda conforme o que estiver commitado, em stage
# ou sujo. O guard rodando contra o repositório real é o job de CI e a etapa do
# `validar-frontend.sh` — são coisas diferentes, e ficam separadas de propósito.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

RAIZ_REPO="$PWD"
GUARD="$RAIZ_REPO/scripts/guard-enderecos-doc.mjs"
FALHAS=0
ok()    { printf '  ok    %s\n' "$1"; }
falha() { printf '  FALHA %s — %s\n' "$1" "$2"; FALHAS=$((FALHAS+1)); }

TMPRAIZ="$(mktemp -d)"
trap 'rm -rf "$TMPRAIZ"' EXIT

# ── arvore <nome> ───────────────────────────────────────────────────────────
# Monta uma árvore com uma base LEGÍTIMA: um alvo de verdade em `frontend/`, um
# documento que o cita CERTO, e a lista de exceções vazia. Ecoa a raiz.
#
# O alvo tem 40 linhas e o símbolo `calcularCoisa` na 20 — folga suficiente para
# um caso mexer no número da citação sem esbarrar no fim do arquivo.
arvore() {
  local raiz="$TMPRAIZ/$1"
  mkdir -p "$raiz"/{docs/viabilidade,docs/rodada-8,frontend,backend/rotas,scripts}

  {
    echo "// alvo de teste"
    for i in $(seq 2 19); do echo "const preenchimento$i = $i;"; done
    echo "export function calcularCoisa(x: number): number {"
    echo "  return x * 2;"
    echo "}"
    for i in $(seq 23 40); do echo "const depois$i = $i;"; done
  } > "$raiz/frontend/alvo.ts"

  printf 'export const LIMITE_DE_CAIXA = 12;\nexport const outro = 1;\n' > "$raiz/frontend/constantes.ts"

  # A citação CERTA: `calcularCoisa` está na linha 20 do alvo.
  printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:20`).\n' \
    > "$raiz/docs/viabilidade/nota.md"

  # Exceções vazias — a base legítima não precisa de nenhuma.
  printf 'export const EXCECOES = [];\n' > "$raiz/scripts/enderecos-doc-excecoes.mjs"

  printf '%s' "$raiz"
}

# roda <raiz> — ecoa o exit code do guard, engolindo a saída.
roda() { node "$GUARD" "$1" >/dev/null 2>&1; echo $?; }
# saida <raiz> — ecoa a saída do guard (para conferir o texto do diagnóstico).
saida() { node "$GUARD" "$1" 2>&1; }

echo "== Sentido 1: FALSO POSITIVO — o que está CERTO tem que passar =="

R="$(arvore base)"
[ "$(roda "$R")" = 0 ] && ok "base legítima passa" \
  || falha "base legítima passa" "guard reprovou árvore sem defeito: $(saida "$R" | head -3)"

# Citação sem caminho (`alvo.ts:20`) — forma dominante na prosa deste repo.
R="$(arvore sem_caminho)"
printf 'A conta é feita por `calcularCoisa` (`alvo.ts:20`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "citação sem caminho resolve pelo nome do arquivo" \
  || falha "citação sem caminho" "$(saida "$R" | head -3)"

# Símbolo a 3 linhas do alvo — o limite da janela, que tem que PASSAR.
R="$(arvore janela_limite)"
printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:23`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "símbolo a exatamente 3 linhas ainda passa" \
  || falha "janela de 3 linhas" "$(saida "$R" | head -3)"

# Frase que não cita símbolo nenhum: só existência de arquivo e linha.
R="$(arvore sem_simbolo)"
printf 'Ver o motor (`frontend/alvo.ts:5`) para o contexto.\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "frase sem símbolo é conferida só por existência" \
  || falha "frase sem símbolo" "$(saida "$R" | head -3)"

# ⚠️ Prosa portuguesa em crase NÃO é símbolo. Sem esta decisão o guard media 23
# acusações falsas na árvore real. `divida` e `equity` não existem no alvo.
R="$(arvore prosa)"
printf 'O tipo `divida` já é o produto (`frontend/alvo.ts:5`), e `equity` não muda.\n' \
  > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "palavra portuguesa em crase não vira símbolo" \
  || falha "prosa em crase" "$(saida "$R" | head -3)"

# ⚠️ `palavra (` NÃO é forma de chamada — o parêntese abre a CITAÇÃO. Media 7
# acusações falsas na árvore real, todas em português corrente.
R="$(arvore paren_prosa)"
printf 'O campo para descrever o custo (`frontend/alvo.ts:5`) é livre.\n' \
  > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "\"palavra (\" não é lida como chamada de função" \
  || falha "parêntese de citação" "$(saida "$R" | head -3)"

# ⚠️ Sigla curta em maiúsculas é prosa (`GET`, `RET`, `PATCH`, `API`).
R="$(arvore sigla)"
printf 'O `GET` das coletas (`frontend/alvo.ts:5`) não exige admin.\n' \
  > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "sigla curta em maiúsculas não vira símbolo" \
  || falha "sigla em maiúsculas" "$(saida "$R" | head -3)"

# ⚠️ Família de campos com glob (`limite_de_*`) não existe literalmente.
R="$(arvore glob)"
printf 'A família `limite_de_*` some junto (`frontend/alvo.ts:5`).\n' \
  > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "família com glob (termina em _) não vira símbolo" \
  || falha "glob de família" "$(saida "$R" | head -3)"

# ⚠️ Endereço sem arquivo (`:1094`) é fora de escopo — declarado no cabeçalho.
R="$(arvore bare)"
printf 'A conta (`frontend/alvo.ts:20`), com o laço em `:9999`.\n' \
  > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "endereço sem arquivo é ignorado (fora de escopo)" \
  || falha "endereço sem arquivo" "$(saida "$R" | head -3)"

# ⚠️ Nome de arquivo AMBÍGUO sem caminho: não se escolhe um dos dois.
R="$(arvore ambiguo)"
mkdir -p "$R/backend/rotas"
printf 'export const z = 1;\n' > "$R/backend/rotas/alvo.ts"
printf 'A conta é feita por `calcularCoisa` (`alvo.ts:1`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 0 ] && ok "nome de arquivo ambíguo não é acusado" \
  || falha "arquivo ambíguo" "$(saida "$R" | head -3)"

# ⚠️ Em CÓDIGO, só comentário. Endereço em string literal é dado do programa.
R="$(arvore string_literal)"
printf 'export const msg = "veja `calcularCoisa` em frontend/alvo.ts:1";\n' \
  > "$R/frontend/tela.ts"
[ "$(roda "$R")" = 0 ] && ok "endereço dentro de string literal não é conferido" \
  || falha "string literal" "$(saida "$R" | head -3)"

# ⚠️ `docs/rodada-8/` é arquivo histórico DATADO e fica FORA da varredura.
R="$(arvore historico)"
printf 'Medido em Pinguim: `calcularCoisa` (`frontend/alvo.ts:1`).\n' \
  > "$R/docs/rodada-8/04-regras.md"
[ "$(roda "$R")" = 0 ] && ok "docs/rodada-8/ não é varrido (histórico datado)" \
  || falha "docs/rodada-8 fora de escopo" "$(saida "$R" | head -3)"

echo "== Sentido 2: FALSO NEGATIVO — o que está QUEBRADO tem que reprovar =="

# O caso central: o endereço deslizou e o símbolo ficou longe.
R="$(arvore deslocado)"
printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 1 ] && ok "endereço deslocado (símbolo a 15 linhas) reprova" \
  || falha "endereço deslocado" "guard não acusou — é o defeito que ele existe para pegar"

# E o diagnóstico tem que dizer ONDE o símbolo está hoje, senão não é acionável.
R="$(arvore diagnostico)"
printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\n' > "$R/docs/viabilidade/nota.md"
# ⚠️ A saída vai para uma VARIÁVEL antes do grep, e não por pipe. Com
# `set -o pipefail`, `saida … | grep -q` reprova mesmo quando o padrão CASA: o
# `grep -q` sai no primeiro acerto, o `node` do outro lado toma SIGPIPE, e o
# pipefail adota o status dele. O caso ficava vermelho com o guard certo.
DIAG="$(saida "$R")"
case "$DIAG" in
  *'está em :20'*) ok "diagnóstico aponta a linha certa do símbolo" ;;
  *) falha "diagnóstico acionável" "não disse onde o símbolo está: $(printf '%s' "$DIAG" | head -4)" ;;
esac

# Arquivo que não existe.
R="$(arvore arquivo_sumido)"
printf 'Ver `calcularCoisa` (`frontend/nao-existe.ts:10`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 1 ] && ok "arquivo inexistente reprova" \
  || falha "arquivo inexistente" "guard não acusou"

# Linha além do fim do arquivo.
R="$(arvore linha_alem)"
printf 'Ver `calcularCoisa` (`frontend/alvo.ts:9000`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 1 ] && ok "linha além do fim do arquivo reprova" \
  || falha "linha inexistente" "guard não acusou"

# Endereço vencido dentro de COMENTÁRIO de código — a outra metade da varredura.
R="$(arvore comentario_ts)"
printf '// A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\nexport const y = 1;\n' \
  > "$R/frontend/tela.ts"
[ "$(roda "$R")" = 1 ] && ok "endereço vencido em comentário de .ts reprova" \
  || falha "comentário de .ts" "guard não acusou"

# Faixa `N-M`: a janela é a faixa inteira, mais ±3 de cada lado.
R="$(arvore faixa)"
printf 'Ver `calcularCoisa` (`frontend/alvo.ts:30-34`).\n' > "$R/docs/viabilidade/nota.md"
[ "$(roda "$R")" = 1 ] && ok "faixa N-M longe do símbolo reprova" \
  || falha "faixa N-M" "guard não acusou"

echo "== Sentido 3: a LISTA DE EXCEÇÕES e as travas dela =="

# Exceção legítima silencia a violação.
R="$(arvore excecao_ok)"
printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\n' > "$R/docs/viabilidade/nota.md"
cat > "$R/scripts/enderecos-doc-excecoes.mjs" <<'EOF'
export const EXCECOES = [
  { arquivo: 'docs/viabilidade/nota.md', endereco: 'frontend/alvo.ts:35',
    motivo: 'VENCIDO DE VERDADE — conserto sai em PR separado, pela regra R3.' },
];
EOF
[ "$(roda "$R")" = 0 ] && ok "exceção declarada silencia a violação" \
  || falha "exceção declarada" "$(saida "$R" | head -3)"

# ⚠️ A TRAVA: exceção que não é mais violação REPROVA. Sem isto a lista só
# cresce, e cada entrada morta desliga a conferência daquele endereço para
# sempre — calada, inclusive contra uma quebra futura por outro motivo.
R="$(arvore excecao_obsoleta)"
cat > "$R/scripts/enderecos-doc-excecoes.mjs" <<'EOF'
export const EXCECOES = [
  { arquivo: 'docs/viabilidade/nota.md', endereco: 'frontend/alvo.ts:20',
    motivo: 'Este endereço resolve perfeitamente — a exceção não é necessária.' },
];
EOF
[ "$(roda "$R")" = 1 ] && ok "exceção que não é mais violação reprova" \
  || falha "exceção obsoleta" "guard aceitou entrada morta — a lista viraria papel de parede"

# Exceção sem motivo de verdade não passa.
R="$(arvore excecao_sem_motivo)"
printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\n' > "$R/docs/viabilidade/nota.md"
cat > "$R/scripts/enderecos-doc-excecoes.mjs" <<'EOF'
export const EXCECOES = [
  { arquivo: 'docs/viabilidade/nota.md', endereco: 'frontend/alvo.ts:35', motivo: 'TODO' },
];
EOF
[ "$(roda "$R")" = 1 ] && ok "exceção com motivo vazio/curto reprova" \
  || falha "exceção sem motivo" "guard aceitou exceção sem justificativa"

# Exceção duplicada não passa.
R="$(arvore excecao_dup)"
printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\n' > "$R/docs/viabilidade/nota.md"
cat > "$R/scripts/enderecos-doc-excecoes.mjs" <<'EOF'
export const EXCECOES = [
  { arquivo: 'docs/viabilidade/nota.md', endereco: 'frontend/alvo.ts:35',
    motivo: 'VENCIDO DE VERDADE — conserto sai em PR separado, pela regra R3.' },
  { arquivo: 'docs/viabilidade/nota.md', endereco: 'frontend/alvo.ts:35',
    motivo: 'VENCIDO DE VERDADE — entrada repetida, que a autoconferência barra.' },
];
EOF
[ "$(roda "$R")" = 1 ] && ok "exceção duplicada reprova" \
  || falha "exceção duplicada" "guard aceitou chave repetida"

# ⚠️ As DUAS classes numa execução só. É o caso mais comum de todos: um merge
# que desloca um arquivo citado quebra endereços novos E faz algum endereço já
# vencido voltar a acertar por acaso. Reportar uma e sair esconderia a outra até
# a execução seguinte — o ciclo "conserta um, descobre o próximo".
R="$(arvore duas_classes)"
{
  printf 'A conta é feita por `calcularCoisa` (`frontend/alvo.ts:35`).\n'
  printf 'O limite é `LIMITE_DE_CAIXA` (`frontend/constantes.ts:1`).\n'
} > "$R/docs/viabilidade/nota.md"
cat > "$R/scripts/enderecos-doc-excecoes.mjs" <<'EOF'
export const EXCECOES = [
  { arquivo: 'docs/viabilidade/nota.md', endereco: 'frontend/constantes.ts:1',
    motivo: 'Este endereço resolve perfeitamente — a exceção está morta e deve sair.' },
];
EOF
DUAS="$(saida "$R")"
if [ "$(roda "$R")" = 1 ] \
  && case "$DUAS" in *'deixou de resolver'*) true ;; *) false ;; esac \
  && case "$DUAS" in *'NÃO são mais violação'*) true ;; *) false ;; esac
then ok "endereço vencido e exceção morta saem na MESMA execução"
else falha "duas classes numa execução" "uma das duas ficou escondida: $(printf '%s' "$DUAS" | head -6)"
fi

# ⚠️ Lista de exceções AUSENTE não vira "verde": "não deu para ler" nunca é
# "está limpo". É o mesmo modo de falha invertido do resto da família.
R="$(arvore excecao_ausente)"
rm -f "$R/scripts/enderecos-doc-excecoes.mjs"
[ "$(roda "$R")" = 1 ] && ok "lista de exceções ausente reprova (não sai verde)" \
  || falha "lista ausente" "guard saiu verde sem a lista — 'não deu para ler' virou 'está limpo'"

echo
if [ "$FALHAS" -eq 0 ]; then
  echo "✅ bateria do guard-enderecos-doc: todos os casos passaram"
  exit 0
fi
echo "❌ bateria do guard-enderecos-doc: $FALHAS caso(s) falharam"
exit 1

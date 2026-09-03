# Auth do @urbiverso/sdk (GitHub Packages privado) — arquivo SOURCED, nunca executado.
#
# POR QUE ELE EXISTE
#
# Até 2026-09-03 este repositório operava sob a premissa de que o SDK era
# inalcançável aqui: o CLAUDE.md mandava, em caixa alta, NÃO perder tempo com
# `.npmrc` porque "a auth disponível não tem acesso". A premissa era falsa —
# `URBIVERSO_PACKAGES_TOKEN` está nas variáveis do cloud environment, e faltava
# só entregá-lo ao pnpm. O custo de não ter isto era estrutural, não pontual:
# `validar-backend.sh` abortava na etapa 1/5, backend/schema/migração saíam de
# toda sessão com "pendente do autor", e a camada de contratos da revisão
# reportava `contratos=nao-executados` em 100% dos PRs.
#
# COMO ELE ENTREGA O TOKEN, E POR QUE NÃO PELO ~/.npmrc
#
# O caminho óbvio — escrever `~/.npmrc` — é DESTRUTIVO: este script roda também
# na máquina do autor, e sobrescrever o `~/.npmrc` dele apagaria configuração
# alheia. O caminho usado aqui é `NPM_CONFIG_USERCONFIG` apontando para um
# arquivo temporário, apagado no fim do processo. Nada é escrito no repositório
# nem na casa de ninguém.
#
# ⚠️ A forma que NÃO funciona, para não ser redescoberta: a variável de config do
# npm para este caso chama-se `npm_config_//npm.pkg.github.com/:_authToken`, e o
# `export` do bash RECUSA esse nome ("not a valid identifier") — barra e dois
# pontos não são identificador. Só `env NOME=valor comando` a passaria, e isso
# obrigaria a prefixar toda chamada de pnpm do script.
#
# QUANDO ELE É NO-OP, E ISSO É O DESENHO
#
#   · **`URBIVERSO_PACKAGES_TOKEN` presente** — configura, e é o caminho normal
#     desta sessão. Vem PRIMEIRO de propósito: é a única auth que sabemos usável;
#   · **npmrc efetivo com token USÁVEL** — silêncio, nada a fazer;
#   · **nada disso, mas o SDK já está em `node_modules`** — silêncio: não há o que
#     baixar. É o caso dos passos "Validar frontend/backend" do CI, onde o passo
#     anterior já instalou;
#   · **nada disso e nada instalado** — aviso, e quem falha depois é o
#     `pnpm install`, com a mensagem do próprio pnpm.
#
# ⚠️ **"Token usável" é fail-CLOSED, e a inversão foi paga duas vezes.** Testar só
# a presença da CHAVE `_authToken=` no npmrc aceita duas linhas que não autenticam
# nada: o valor vazio, e o placeholder `${NODE_AUTH_TOKEN}` que o `setup-node`
# escreve literalmente no npmrc do runner — que resolve para vazio em todo passo
# do workflow onde aquela variável não está no `env:`. Nos dois casos a guarda
# antiga se calava dizendo "já tem auth", com um token bom parado no ambiente ao
# lado. É a armadilha 14 do CLAUDE.md: na segunda entrada suja da mesma classe,
# pare de enumerar e inverta.
#
# ⚠️ **E uma correção de fato, porque a versão anterior deste comentário afirmava
# o contrário:** o `setup-node` **DEFINE** `NPM_CONFIG_USERCONFIG`
# (`actions/setup-node`, `src/authutil.ts`: `core.exportVariable('NPM_CONFIG_USERCONFIG', …)`).
# A frase que dizia que ele "NÃO define" era plausível e falsa — e o sintoma que
# ela explicava (aviso falso no CI) era real, só que por outro mecanismo: o
# placeholder sem valor. Armadilha 11.
#
# ⚠️ Ele NÃO se invoca sozinho — `scripts/lib/LEIA.md` é explícito: *"aqui dentro
# nada se roda sozinho"*. Quem chama é o validador, com `urbi_sdk_auth` na linha
# seguinte ao `source`. A exceção que este arquivo abre à outra metade da regra
# (*"funções puras, sem efeito colateral"*) está declarada lá, com o motivo.
#
# ⚠️ Enquanto ativo, `NPM_CONFIG_USERCONFIG` SUBSTITUI o `~/.npmrc` para os
# processos filhos: config pessoal de registry/proxy não é lida durante a
# validação. É aceitável porque só acontece onde o token existe (sessão de
# nuvem, container efêmero) e dura o tempo do script.
#
# Uso:  . "$raiz"/scripts/lib/sdk-auth.sh
#       urbi_sdk_auth
#
# ⚠️ O caminho do `source` sai de `$raiz`, NUNCA de `$(dirname "$0")`: os dois
# validadores fazem `cd "$(dirname "$0")/.."` logo no começo, então na hora do
# source o `$0` já é relativo a um diretório que não é mais a cwd. Com
# `$(dirname "$0")` o source falha, e como nenhum dos dois usa `set -e`, ele
# falha CALADO — o script segue, o `pnpm install || true` engole o 401, e o SDK
# não fica no disco. Exatamente o estado que este arquivo existe para eliminar.

# Verdadeiro só quando o npmrc efetivo carrega um token USÁVEL para o GitHub
# Packages — não basta a chave existir (ver a nota de fail-closed no cabeçalho).
# `${HOME:-}` e não `$HOME`: sob `set -u` do chamador, `$HOME` indefinido MATA o
# validador na expansão, e um helper de auth não pode derrubar quem o chama.
urbi_sdk_auth_ja_configurada() {
  local arq="${NPM_CONFIG_USERCONFIG:-${HOME:-}/.npmrc}" linha valor
  [ -f "$arq" ] || return 1
  linha="$(grep -s -m1 '^//npm\.pkg\.github\.com/:_authToken=' "$arq")" || return 1
  valor="${linha#*=}"
  # vazio, ou placeholder `${VAR}` não resolvido → NÃO é auth.
  case "$valor" in ''|'${'*) return 1 ;; esac
  return 0
}

urbi_sdk_auth() {
  if [ -z "${URBIVERSO_PACKAGES_TOKEN:-}" ]; then
    urbi_sdk_auth_ja_configurada && return 0
    # Nada a baixar: o pacote já está no disco (o caso dos passos de validação do
    # CI, onde o passo de install rodou antes, com a credencial dele).
    [ -d node_modules/@urbiverso/sdk ] && return 0
    echo "  aviso: sem auth para o npm.pkg.github.com (URBIVERSO_PACKAGES_TOKEN ausente" >&2
    echo "         e nenhum token usável no npmrc) — o @urbiverso/sdk não será baixado," >&2
    echo "         e o typecheck do backend não roda." >&2
    return 0
  fi

  local rc
  # `mktemp` já cria 0600; o modo é reafirmado por ser um arquivo com segredo.
  rc="$(mktemp "${TMPDIR:-/tmp}/urbi-npmrc.XXXXXX")" || {
    echo "  aviso: mktemp falhou — seguindo SEM auth do SDK (o pnpm dirá o resto)." >&2
    return 0
  }
  chmod 600 "$rc"
  printf '//npm.pkg.github.com/:_authToken=%s\n' "$URBIVERSO_PACKAGES_TOKEN" > "$rc"
  export NPM_CONFIG_USERCONFIG="$rc"
  URBI_SDK_AUTH_RC="$rc"
  # O `trap` mora aqui, e não no chamador, para o arquivo com o token sumir mesmo
  # que a validação aborte no meio (`exit 1` de qualquer etapa). Nenhum dos dois
  # validadores tem `trap` próprio hoje; quem acrescentar um, some com este.
  trap 'rm -f "${URBI_SDK_AUTH_RC:-}"' EXIT
}

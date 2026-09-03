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
#   · **auth já configurada** — o npmrc efetivo já tem linha de token para
#     `npm.pkg.github.com`. É o caso do CI, onde o `setup-node` escreve o npmrc do
#     runner a partir de `NODE_AUTH_TOKEN`. ⚠️ Esta guarda vem PRIMEIRO, e a ordem
#     importa: a versão anterior testava só `NPM_CONFIG_USERCONFIG`, que o
#     `setup-node` NÃO define — então no CI, autenticado, ela caía no ramo do
#     token ausente e imprimia um aviso falso em todo run;
#   · **sem `URBIVERSO_PACKAGES_TOKEN` e sem auth configurada** (máquina do autor
#     sem credencial) — segue sem auth, com um aviso, e quem falha depois é o
#     `pnpm install`, com a mensagem do próprio pnpm.
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

# Verdadeiro quando o npmrc efetivo já autentica o GitHub Packages. Cobre o CI
# (setup-node escreve `~/.npmrc` a partir de NODE_AUTH_TOKEN) e a máquina de quem
# já configurou a auth à mão.
urbi_sdk_auth_ja_configurada() {
  grep -qs 'npm\.pkg\.github\.com/:_authToken' "${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
}

urbi_sdk_auth() {
  urbi_sdk_auth_ja_configurada && return 0
  [ -n "${NPM_CONFIG_USERCONFIG:-}" ] && return 0

  [ -n "${URBIVERSO_PACKAGES_TOKEN:-}" ] || {
    echo "  aviso: sem auth para o npm.pkg.github.com (URBIVERSO_PACKAGES_TOKEN ausente)" >&2
    echo "         — o @urbiverso/sdk não será baixado, e o typecheck do backend não roda." >&2
    return 0
  }

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

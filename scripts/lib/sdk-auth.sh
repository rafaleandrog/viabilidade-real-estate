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
#   · sem `URBIVERSO_PACKAGES_TOKEN` (máquina do autor) — segue sem auth, e quem
#     falha é o `pnpm install`, com a mensagem do próprio pnpm;
#   · com `NPM_CONFIG_USERCONFIG` já definido (o CI usa `setup-node`, que escreve
#     o npmrc do runner e passa o token por `NODE_AUTH_TOKEN`) — não sobrescreve
#     o que o chamador configurou.
#
# ⚠️ Enquanto ativo, `NPM_CONFIG_USERCONFIG` SUBSTITUI o `~/.npmrc` para os
# processos filhos: config pessoal de registry/proxy não é lida durante a
# validação. É aceitável porque só acontece onde o token existe (sessão de
# nuvem, container efêmero) e dura o tempo do script.
#
# Uso:  . scripts/lib/sdk-auth.sh   (antes do primeiro `pnpm install`)

urbi_sdk_auth() {
  [ -n "${URBIVERSO_PACKAGES_TOKEN:-}" ] || {
    echo "  aviso: URBIVERSO_PACKAGES_TOKEN ausente — o @urbiverso/sdk não será baixado." >&2
    return 0
  }
  [ -n "${NPM_CONFIG_USERCONFIG:-}" ] && return 0

  local rc
  rc="$(mktemp "${TMPDIR:-/tmp}/urbi-npmrc.XXXXXX")" || return 0
  chmod 600 "$rc"
  printf '//npm.pkg.github.com/:_authToken=%s\n' "$URBIVERSO_PACKAGES_TOKEN" > "$rc"
  export NPM_CONFIG_USERCONFIG="$rc"
  URBI_SDK_AUTH_RC="$rc"
  # O `trap` mora aqui, e não no chamador, para o arquivo com o token sumir mesmo
  # que a validação aborte no meio (`exit 1` de qualquer etapa).
  trap 'rm -f "${URBI_SDK_AUTH_RC:-}"' EXIT
}

urbi_sdk_auth
